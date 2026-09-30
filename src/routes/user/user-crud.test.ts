import { describe, expect, test } from "bun:test";
import { clearOutbox, lastEmailTo } from "@/lib/mailer";
import {
  VALID_PASSWORD,
  cookieHeader,
  createUserWithPassword,
  jsonHeaders,
  loggedInAdmin,
  loggedInUser,
  login,
  randomEmail,
  testApp,
  tokenFromLastEmail,
} from "../../../tests/helpers";

const app = testApp();

describe("listing users", () => {
  test("an admin sees every user", async () => {
    const { cookie } = await loggedInAdmin();

    const res = await app.request("/users", { headers: cookieHeader(cookie) });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(Array.isArray(body)).toBe(true);
    for (const user of body) {
      expect(user).not.toHaveProperty("password");
    }
  });

  test("a regular user is refused with 403", async () => {
    const { cookie } = await loggedInUser();

    const res = await app.request("/users", { headers: cookieHeader(cookie) });
    expect(res.status).toBe(403);
  });

  test("unauthenticated requests get 401", async () => {
    const res = await app.request("/users");
    expect(res.status).toBe(401);
  });
});

describe("reading a user", () => {
  test("a user can read themselves", async () => {
    const { cookie, row } = await loggedInUser();

    const res = await app.request(`/users/${row.id}`, {
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(row.id);
    expect(body).not.toHaveProperty("password");
  });

  test("a user cannot read someone else", async () => {
    const { cookie } = await loggedInUser();
    const { row: other } = await createUserWithPassword();

    const res = await app.request(`/users/${other.id}`, {
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(403);
  });

  test("an admin can read anyone", async () => {
    const { cookie } = await loggedInAdmin();
    const { row: other } = await createUserWithPassword();

    const res = await app.request(`/users/${other.id}`, {
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(200);
  });

  test("returns 404 for a missing user", async () => {
    const { cookie } = await loggedInAdmin();

    const res = await app.request("/users/99999999", {
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(404);
  });

  test("returns 422 for a non-numeric id", async () => {
    const { cookie } = await loggedInAdmin();

    const res = await app.request("/users/abc", {
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(422);
  });
});

describe("updating a user", () => {
  test("a user can update themselves", async () => {
    const { cookie, row } = await loggedInUser();

    const res = await app.request(`/users/${row.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ firstName: "Ada" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { firstName: string };
    expect(body.firstName).toBe("Ada");
    expect(body).not.toHaveProperty("password");
  });

  test("a user cannot update someone else", async () => {
    const { cookie } = await loggedInUser();
    const { row: other } = await createUserWithPassword();

    const res = await app.request(`/users/${other.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ firstName: "Hijacked" }),
    });

    expect(res.status).toBe(403);
  });

  test("an admin can update anyone", async () => {
    const { cookie } = await loggedInAdmin();
    const { row: other } = await createUserWithPassword();

    const res = await app.request(`/users/${other.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ firstName: "Renamed" }),
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { firstName: string }).firstName).toBe(
      "Renamed",
    );
  });

  test("a user cannot promote themselves to admin", async () => {
    const { cookie, row } = await loggedInUser();

    const res = await app.request(`/users/${row.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ role: "admin" }),
    });

    expect(res.status).toBe(403);
  });

  test("an admin can change a role", async () => {
    const { cookie } = await loggedInAdmin();
    const { row: other } = await createUserWithPassword();

    const res = await app.request(`/users/${other.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ role: "admin" }),
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { role: string }).role).toBe("admin");
  });

  test("returns 404 when patching a missing user", async () => {
    const { cookie } = await loggedInAdmin();

    const res = await app.request("/users/99999999", {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ firstName: "Ada" }),
    });

    expect(res.status).toBe(404);
  });

  test("an empty patch is a no-op, not a 500", async () => {
    const { cookie, row } = await loggedInUser();

    const res = await app.request(`/users/${row.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: number }).id).toBe(row.id);
  });

  test("changing the email address un-verifies the account", async () => {
    const { cookie, row } = await loggedInUser();
    const newEmail = randomEmail("moved");

    const res = await app.request(`/users/${row.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ email: newEmail }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      email: string;
      emailVerifiedAt: string | null;
    };
    expect(body.email).toBe(newEmail);
    expect(body.emailVerifiedAt).toBeNull();

    // The login gate must close again for an address nobody confirmed.
    const relogin = await login(body.email, VALID_PASSWORD);
    expect(relogin.res.status).toBe(403);
  });

  test("changing the email sends a fresh verification link", async () => {
    clearOutbox();
    const { cookie, row } = await loggedInUser();
    const newEmail = randomEmail("moved");

    await app.request(`/users/${row.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ email: newEmail }),
    });

    const message = lastEmailTo(newEmail);
    expect(message?.subject).toBe("Verify your email address");
    expect(() => tokenFromLastEmail(newEmail)).not.toThrow();
  });

  test("patching other fields leaves verification intact", async () => {
    const { cookie, row } = await loggedInUser();

    const res = await app.request(`/users/${row.id}`, {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ firstName: "Ada" }),
    });

    expect(res.status).toBe(200);
    expect(
      ((await res.json()) as { emailVerifiedAt: string | null }).emailVerifiedAt,
    ).not.toBeNull();
  });

  test("returns 422 when patching a non-numeric id", async () => {
    const { cookie } = await loggedInAdmin();

    const res = await app.request("/users/abc", {
      method: "PATCH",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({ firstName: "Ada" }),
    });

    expect(res.status).toBe(422);
  });
});

describe("deleting a user", () => {
  test("a user can delete their own account", async () => {
    const { cookie, row } = await loggedInUser();

    const remove = await app.request(`/users/${row.id}`, {
      method: "DELETE",
      headers: cookieHeader(cookie),
    });
    expect(remove.status).toBe(204);

    const after = await app.request(`/users/${row.id}`, {
      headers: cookieHeader(cookie),
    });
    expect(after.status).toBe(401); // their session went with them
  });

  test("a user cannot delete someone else", async () => {
    const { cookie } = await loggedInUser();
    const { row: other } = await createUserWithPassword();

    const res = await app.request(`/users/${other.id}`, {
      method: "DELETE",
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(403);
  });

  test("an admin can delete another user", async () => {
    const { cookie } = await loggedInAdmin();
    const { row: other } = await createUserWithPassword();

    const res = await app.request(`/users/${other.id}`, {
      method: "DELETE",
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(204);
  });

  test("returns 404 when removing a missing user", async () => {
    const { cookie } = await loggedInAdmin();

    const res = await app.request("/users/99999999", {
      method: "DELETE",
      headers: cookieHeader(cookie),
    });

    expect(res.status).toBe(404);
  });

  test("unauthenticated requests get 401", async () => {
    const { row } = await createUserWithPassword();

    const res = await app.request(`/users/${row.id}`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });
});
