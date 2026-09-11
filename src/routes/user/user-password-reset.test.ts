import { describe, expect, test } from "bun:test";
import { sign } from "hono/jwt";
import {
  createUserWithPassword,
  jsonHeaders,
  login,
  randomEmail,
  testApp,
} from "../../../tests/helpers";

const app = testApp();
const PASSWORD = "KnownPass123!";
const NEW_PASSWORD = "NewPass456!";
const AUTH_SECRET = process.env.AUTH_SECRET as string;

async function resetSlug(userId: number): Promise<string> {
  return sign(
    { userId, exp: Math.floor(Date.now() / 1000) + 60 * 15 },
    AUTH_SECRET,
    "HS256",
  );
}

describe("password reset", () => {
  test("forgot_password succeeds for an existing email", async () => {
    const { user } = await createUserWithPassword(PASSWORD);
    const res = await app.request("/users/forgot_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: user.email }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain(user.email);
  });

  test("forgot_password returns 404 for an unknown email", async () => {
    const res = await app.request("/users/forgot_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: randomEmail("unknown") }),
    });
    expect(res.status).toBe(404);
  });

  test("resetting the password lets the user log in with the new one", async () => {
    const { user, row } = await createUserWithPassword(PASSWORD);
    const slug = await resetSlug(row.id);

    const reset = await app.request(`/users/reset_password/${slug}`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ password: NEW_PASSWORD }),
    });
    expect(reset.status).toBe(200);

    const oldLogin = await login(user.email, PASSWORD);
    expect(oldLogin.res.status).toBe(401);

    const newLogin = await login(user.email, NEW_PASSWORD);
    expect(newLogin.res.status).toBe(200);
    expect(newLogin.cookie).toBeTruthy();
  });

  test("rejects an invalid reset slug with 403", async () => {
    const res = await app.request("/users/reset_password/garbage-token", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ password: NEW_PASSWORD }),
    });
    expect(res.status).toBe(403);
  });
});