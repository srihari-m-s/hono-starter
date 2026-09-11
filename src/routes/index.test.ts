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