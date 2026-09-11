import { describe, expect, test } from "bun:test";
import {
  cookieHeader,
  createUserWithPassword,
  jsonHeaders,
  loggedInUser,
  login,
  makeUser,
  randomEmail,
  testApp,
} from "../../../tests/helpers";

const app = testApp();

const PASSWORD = "KnownPass123!";

describe("user sign up", () => {
  test("creates a user and does not leak the password", async () => {
    const res = await app.request("/users/sign_up", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(makeUser()),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("id");
    expect(body.firstName).toBe("Test");
    expect(body).not.toHaveProperty("password");
  });

  test("rejects an invalid payload with 422", async () => {
    const res = await app.request("/users/sign_up", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ firstName: "ab" }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { success: boolean; error: unknown };
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
  });

  test("rejects a duplicate email with 409", async () => {
    const email = randomEmail("dup");
    await createUserWithPassword(PASSWORD, { email });
    const res = await app.request("/users/sign_up", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(makeUser({ email })),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe("Conflict");
  });
});

describe("user login", () => {
  test("returns 200 and sets an auth cookie for valid credentials", async () => {
    const { user, password } = await createUserWithPassword(PASSWORD);
    const { res, cookie } = await login(user.email, password);
    expect(res.status).toBe(200);
    expect(cookie).toBeTruthy();
    expect(cookie?.toLowerCase()).toContain("httponly");
  });

  test("accepts a mobile number as identifier", async () => {
    const { user, password } = await createUserWithPassword(PASSWORD);
    const { res } = await login(user.mobile, password);
    expect(res.status).toBe(200);
  });

  test("rejects a wrong password with 401", async () => {
    const { user } = await createUserWithPassword(PASSWORD);
    const { res } = await login(user.email, "wrong-password");
    expect(res.status).toBe(401);
  });

  test("rejects an invalid identifier with 401", async () => {
    const { res } = await login("not-an-identifier", "whatever");
    expect(res.status).toBe(401);
  });

  test("rejects a missing user with 401", async () => {
    const { res } = await login(randomEmail("ghost"), PASSWORD);
    expect(res.status).toBe(401);
  });
});

describe("protected routes", () => {
  test("returns 401 without a cookie", async () => {
    const res = await app.request("/users");
    expect(res.status).toBe(401);
  });

  test("returns the user list with a valid cookie", async () => {
    const { user, cookie } = await loggedInUser();
    const res = await app.request("/users", { headers: cookieHeader(cookie) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ email: string }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((u) => u.email === user.email)).toBe(true);
  });
});