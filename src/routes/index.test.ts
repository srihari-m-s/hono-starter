import { describe, expect, test } from "bun:test";
import { testApp } from "../../tests/helpers";

const app = testApp();

describe("index route", () => {
  test("GET / returns a welcome message", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("GET: Starter api index");
  });

  test("GET /doc returns the OpenAPI document", async () => {
    const res = await app.request("/doc");
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; info: { title: string } };
    expect(doc.openapi).toBe("3.0.0");
    expect(doc.info.title).toBe("Starter API");
  });

  test("GET /reference renders the Scalar docs page", async () => {
    const res = await app.request("/reference");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("text/html");
  });

  test("unknown routes return 404 JSON", async () => {
    const res = await app.request("/definitely-not-a-route");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { message: string };
    expect(body.message.startsWith("Not Found")).toBe(true);
  });
});

describe("cross-origin policy", () => {
  test("allows CORS for a configured origin", async () => {
    const res = await app.request("/", {
      headers: { Origin: "http://localhost:5173" },
    });

    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  test("withholds CORS for an unknown origin", async () => {
    const res = await app.request("/", {
      headers: { Origin: "https://evil.example" },
    });

    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("rejects a state-changing request from an unknown origin", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "https://evil.example",
      },
      body: JSON.stringify({ identifier: "a@b.com", password: "whatever" }),
    });

    expect(res.status).toBe(403);
  });

  test("lets a configured origin reach the handler", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({ identifier: "a@b.com", password: "whatever" }),
    });

    expect(res.status).toBe(401);
  });
});