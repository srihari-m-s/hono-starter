import { describe, expect, test } from "bun:test";
import { jsonHeaders, testApp } from "../../../tests/helpers";

const app = testApp();

describe("notes", () => {
  test("lists notes", async () => {
    const res = await app.request("/note");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("creates a note", async () => {
    const res = await app.request("/note", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ content: "hello world" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: number; content: string };
    expect(body.content).toBe("hello world");
    expect(body.id).toBeGreaterThan(0);

    const list = (await (await app.request("/note")).json()) as Array<{
      id: number;
    }>;
    expect(list.some((n) => n.id === body.id)).toBe(true);
  });

  test("creates a note without content", async () => {
    const res = await app.request("/note", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { content: string | null };
    expect(body.content).toBeNull();
  });

  test("rejects a non-string content with 422", async () => {
    const res = await app.request("/note", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ content: 123 }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });
});