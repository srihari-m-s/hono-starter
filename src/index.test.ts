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
});