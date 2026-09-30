import { afterAll, describe, expect, test } from "bun:test";
import app from "./app";

describe("server bootstrap", () => {
  const server = Bun.serve({ fetch: app.fetch, port: 0 });

  afterAll(() => {
    server.stop(true);
  });

  test("boots the app on an ephemeral port and serves /", async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("GET: Starter api index");
  });

  test("resolves the socket client address through the real server", async () => {
    // Regression guard: `Bun.Server.requestIP` only works when called on the
    // server object, so this path has to be exercised against a live server
    // rather than through `app.request()` (which has no server binding).
    const res = await fetch(`http://127.0.0.1:${server.port}/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Must be ignored while TRUST_PROXY_HOPS is 0.
        "x-forwarded-for": "203.0.113.9",
      },
      body: JSON.stringify({ identifier: "nobody@example.com", password: "x" }),
    });

    expect(res.status).toBe(401);
    expect(res.headers.get("x-ratelimit-remaining")).not.toBeNull();
  });
});