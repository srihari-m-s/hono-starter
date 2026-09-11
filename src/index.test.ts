import { afterAll, describe, expect, test } from "bun:test";
import { serve, type ServerType } from "@hono/node-server";
import app from "./app";

describe("server bootstrap", () => {
  let server: ServerType;
  let port: number;

  afterAll(() => {
    server.close();
  });

  test("boots the app on an ephemeral port and serves /", async () => {
    server = serve({ fetch: app.fetch, port: 0 });
    if (!server.listening) {
      await new Promise((resolve) => server.once("listening", resolve));
    }
    const address = server.address();
    if (typeof address === "string" || address === null) {
      throw new Error("expected a TCP address");
    }
    port = address.port;

    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("GET: Starter api index");
  });
});