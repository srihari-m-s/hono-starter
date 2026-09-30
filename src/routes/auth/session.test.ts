import { describe, expect, test } from "bun:test";
import { db } from "@/db";
import { sessionsTable } from "@/db/schema";
import { hashToken } from "@/lib/crypto";
import {
  cookieHeader,
  jsonHeaders,
  loggedInUser,
  testApp,
} from "../../../tests/helpers";

const app = testApp();

describe("current session", () => {
  test("returns the caller", async () => {
    const { user, row, cookie } = await loggedInUser();

    const res = await app.request("/auth/session", {
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(row.id);
    expect(body.email).toBe(user.email);
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("tokenHash");
  });

  test("returns 401 without a cookie", async () => {
    const res = await app.request("/auth/session");
    expect(res.status).toBe(401);
  });

  test("returns 401 for a forged cookie", async () => {
    const res = await app.request("/auth/session", {
      headers: { Cookie: "starter_session=not-a-real-session" },
    });
    expect(res.status).toBe(401);
  });

  test("authenticates API clients with a bearer token", async () => {
    const { user, cookie } = await loggedInUser();
    const token = cookieHeader(cookie).Cookie.split("=")[1];

    const res = await app.request("/auth/session", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { email: string }).email).toBe(user.email);
  });

  test("rejects an expired session", async () => {
    const { row } = await loggedInUser();
    const token = `expired-${crypto.randomUUID()}`;

    await db.insert(sessionsTable).values({
      tokenHash: hashToken(token),
      userId: row.id,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    const res = await app.request("/auth/session", {
      headers: { Cookie: `starter_session=${token}` },
    });

    expect(res.status).toBe(401);
  });
});

describe("logout", () => {
  test("revokes the session and clears the cookie", async () => {
    const { cookie } = await loggedInUser();

    const logout = await app.request("/auth/logout", {
      method: "POST",
      headers: cookieHeader(cookie),
    });

    expect(logout.status).toBe(204);
    const setCookie = logout.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("Max-Age=0");

    // The old cookie must stop working immediately.
    const after = await app.request("/auth/session", {
      headers: cookieHeader(cookie),
    });
    expect(after.status).toBe(401);
  });

  test("does not revoke the user's other sessions", async () => {
    const { user, password, cookie: first } = await loggedInUser();

    const second = await app.request("/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ identifier: user.email, password }),
    });
    const secondCookie = second.headers.get("set-cookie") ?? "";

    await app.request("/auth/logout", {
      method: "POST",
      headers: cookieHeader(first),
    });

    const stillValid = await app.request("/auth/session", {
      headers: cookieHeader(secondCookie),
    });
    expect(stillValid.status).toBe(200);
  });

  test("requires authentication", async () => {
    const res = await app.request("/auth/logout", { method: "POST" });
    expect(res.status).toBe(401);
  });
});

describe("session management", () => {
  test("lists active sessions and flags the current one", async () => {
    const { user, password, cookie } = await loggedInUser();

    const second = await app.request("/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ identifier: user.email, password }),
    });
    expect(second.status).toBe(200);

    const res = await app.request("/auth/sessions", {
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(200);
    const sessions = (await res.json()) as Array<{
      id: number;
      current: boolean;
      tokenHash?: string;
    }>;

    expect(sessions).toHaveLength(2);
    expect(sessions.filter((s) => s.current)).toHaveLength(1);
    for (const session of sessions) {
      expect(session).not.toHaveProperty("tokenHash");
    }
  });

  test("revokes a single session by id", async () => {
    const { user, password, cookie } = await loggedInUser();

    const second = await app.request("/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ identifier: user.email, password }),
    });
    const secondCookie = second.headers.get("set-cookie") ?? "";

    const list = (await (
      await app.request("/auth/sessions", { headers: cookieHeader(cookie) })
    ).json()) as Array<{ id: number; current: boolean }>;
    const other = list.find((s) => !s.current);
    expect(other).toBeDefined();

    const revoke = await app.request(`/auth/sessions/${other?.id}`, {
      method: "DELETE",
      headers: cookieHeader(cookie),
    });
    expect(revoke.status).toBe(204);

    const gone = await app.request("/auth/session", {
      headers: cookieHeader(secondCookie),
    });
    expect(gone.status).toBe(401);

    // The session used to make the call still works.
    const stillHere = await app.request("/auth/session", {
      headers: cookieHeader(cookie),
    });
    expect(stillHere.status).toBe(200);
  });

  test("cannot revoke a session belonging to someone else", async () => {
    const victim = await loggedInUser();
    const attacker = await loggedInUser();

    const victimSessions = (await (
      await app.request("/auth/sessions", {
        headers: cookieHeader(victim.cookie),
      })
    ).json()) as Array<{ id: number }>;
    const victimSessionId = victimSessions[0]?.id;

    const res = await app.request(`/auth/sessions/${victimSessionId}`, {
      method: "DELETE",
      headers: cookieHeader(attacker.cookie),
    });

    // 404 rather than 403: the attacker learns nothing about the id.
    expect(res.status).toBe(404);

    const untouched = await app.request("/auth/session", {
      headers: cookieHeader(victim.cookie),
    });
    expect(untouched.status).toBe(200);
  });

  test("returns 404 for a missing session id", async () => {
    const { cookie } = await loggedInUser();

    const res = await app.request("/auth/sessions/99999999", {
      method: "DELETE",
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(404);
  });

  test("logging out everywhere revokes every session", async () => {
    const { user, password, cookie } = await loggedInUser();

    const second = await app.request("/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ identifier: user.email, password }),
    });
    const secondCookie = second.headers.get("set-cookie") ?? "";

    const res = await app.request("/auth/sessions", {
      method: "DELETE",
      headers: cookieHeader(cookie),
    });
    expect(res.status).toBe(204);

    for (const stale of [cookie, secondCookie]) {
      const check = await app.request("/auth/session", {
        headers: cookieHeader(stale),
      });
      expect(check.status).toBe(401);
    }
  });

  test("requires authentication to list sessions", async () => {
    const res = await app.request("/auth/sessions");
    expect(res.status).toBe(401);
  });
});
