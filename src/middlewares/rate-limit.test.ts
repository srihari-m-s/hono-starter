import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import type { AppBindings } from "@/lib/types";
import { rateLimit } from "./rate-limit";

function scratchApp(options: { max: number; trustProxyHops?: number }) {
  const app = new Hono<AppBindings>();
  app.use(
    "*",
    rateLimit({
      keyPrefix: "test",
      windowMs: 60_000,
      max: options.max,
      trustProxyHops: options.trustProxyHops,
    }),
  );
  app.get("/", (c) => c.json({ ok: true }));
  return app;
}

describe("rateLimit middleware", () => {
  test("allows requests under the limit", async () => {
    const app = scratchApp({ max: 2 });
    expect((await app.request("/")).status).toBe(200);
    expect((await app.request("/")).status).toBe(200);
  });

  test("returns 429 once the limit is exceeded", async () => {
    const app = scratchApp({ max: 1 });
    await app.request("/");

    const res = await app.request("/");
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ message: "Too Many Requests" });
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  test("advertises the budget in headers", async () => {
    const app = scratchApp({ max: 3 });
    const res = await app.request("/");
    expect(res.headers.get("x-ratelimit-limit")).toBe("3");
    expect(res.headers.get("x-ratelimit-remaining")).toBe("2");
  });

  test("ignores X-Forwarded-For when no proxy is trusted", async () => {
    const app = scratchApp({ max: 1 });

    // `x-forwarded-for` is attacker-controlled. If it were honoured without a
    // trusted proxy, a fresh value per request would grant an unlimited budget.
    const first = await app.request("/", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    });
    const second = await app.request("/", {
      headers: { "x-forwarded-for": "2.2.2.2" },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  test("reads X-Forwarded-For from the trusted end", async () => {
    const app = scratchApp({ max: 1, trustProxyHops: 1 });

    // The left-most entries are client-supplied; only the right-most hop was
    // appended by the trusted proxy we run.
    const clientA = await app.request("/", {
      headers: { "x-forwarded-for": "9.9.9.9, 1.1.1.1" },
    });
    const clientB = await app.request("/", {
      headers: { "x-forwarded-for": "9.9.9.9, 2.2.2.2" },
    });
    const clientAAgain = await app.request("/", {
      headers: { "x-forwarded-for": "9.9.9.9, 1.1.1.1" },
    });

    expect(clientA.status).toBe(200);
    expect(clientB.status).toBe(200); // a genuinely different client
    expect(clientAAgain.status).toBe(429); // same client, spoofed prefix ignored
  });

  test("falls back to one shared bucket when no address is available", async () => {
    const app = scratchApp({ max: 1 });

    // No trustworthy source: throttling everyone together is the safe failure.
    expect((await app.request("/")).status).toBe(200);
    expect((await app.request("/")).status).toBe(429);
  });
});
