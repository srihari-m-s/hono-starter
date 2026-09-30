import { beforeEach, describe, expect, test } from "bun:test";
import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { clearOutbox, lastEmailTo } from "@/lib/mailer";
import { PASSWORD_REJECTION_MESSAGES } from "@/lib/password-policy";
import { eq } from "drizzle-orm";
import {
  COMMON_PASSWORD,
  VALID_PASSWORD,
  createUserWithPassword,
  jsonHeaders,
  login,
  makeUser,
  randomEmail,
  signUp,
  signUpVerified,
  testApp,
  tokenFromLastEmail,
} from "../../../tests/helpers";

const app = testApp();

beforeEach(() => {
  clearOutbox();
});

describe("sign up", () => {
  test("creates an unverified user and never leaks the password", async () => {
    const { user, created } = await signUp({
      firstName: "Ada",
      lastName: "Lovelace",
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.firstName).toBe("Ada");
    expect(created.email).toBe(user.email);
    expect(created.role).toBe("user");
    expect(created.emailVerifiedAt).toBeNull();
    expect(created).not.toHaveProperty("password");
  });

  test("stores the password as a hash, never the plaintext", async () => {
    const { user, password } = await signUp();

    const [row] = await db
      .select({ password: usersTable.password })
      .from(usersTable)
      .where(eq(usersTable.email, user.email));

    expect(row?.password).not.toBe(password);
    expect(row?.password.startsWith("$argon2id$")).toBe(true);
  });

  test("sends a verification email", async () => {
    const { user } = await signUp();

    const message = lastEmailTo(user.email);
    expect(message?.subject).toBe("Verify your email address");
    expect(message?.text).toContain("/auth/verify_email?token=");
    expect(() => tokenFromLastEmail(user.email)).not.toThrow();
  });

  test("does not issue a session before the email is verified", async () => {
    const res = await app.request("/auth/sign_up", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ ...makeUser(), password: VALID_PASSWORD }),
    });

    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("rejects a duplicate email with 409", async () => {
    const email = randomEmail("dup");
    await createUserWithPassword(VALID_PASSWORD, { email });

    const res = await app.request("/auth/sign_up", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ ...makeUser({ email }), password: VALID_PASSWORD }),
    });

    expect(res.status).toBe(409);
    expect(((await res.json()) as { message: string }).message).toBe("Conflict");
  });

  test("rejects a duplicate mobile with 409", async () => {
    const { user } = await createUserWithPassword();

    const res = await app.request("/auth/sign_up", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        ...makeUser({ mobile: user.mobile }),
        password: VALID_PASSWORD,
      }),
    });

    expect(res.status).toBe(409);
  });

  test("rejects an invalid payload with 422", async () => {
    const res = await app.request("/auth/sign_up", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ firstName: "ab" }),
    });

    expect(res.status).toBe(422);
    expect(((await res.json()) as { success: boolean }).success).toBe(false);
  });

  test("rejects a weak password with 422", async () => {
    const res = await app.request("/auth/sign_up", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ ...makeUser(), password: "weak" }),
    });

    expect(res.status).toBe(422);
  });

  test("rejects a password that is too short", async () => {
    const res = await app.request("/auth/sign_up", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ ...makeUser(), password: "weak" }),
    });

    expect(res.status).toBe(422);
  });

  test("rejects a commonly used password", async () => {
    const res = await app.request("/auth/sign_up", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ ...makeUser(), password: COMMON_PASSWORD }),
    });

    expect(res.status).toBe(422);
    expect(((await res.json()) as { message: string }).message).toBe(
      PASSWORD_REJECTION_MESSAGES.common,
    );
  });

  test("rejects a password derived from the account's own email", async () => {
    const email = `lovelace-${crypto.randomUUID()}@example.com`;

    const res = await app.request("/auth/sign_up", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ ...makeUser({ email }), password: email }),
    });

    expect(res.status).toBe(422);
  });

  test("accepts a long passphrase with no digits or symbols", async () => {
    // The previous policy required a letter and a number. NIST forbids
    // composition rules, so this must succeed.
    const res = await app.request("/auth/sign_up", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        ...makeUser(),
        password: "onlylowercaselettershere",
      }),
    });

    expect(res.status).toBe(201);
  });
});

describe("email verification", () => {
  test("login is refused until the address is verified", async () => {
    const { user, password } = await signUp();

    const { res } = await login(user.email, password);
    expect(res.status).toBe(403);
  });

  test("the emailed token verifies the address and unlocks login", async () => {
    const { user, password } = await signUp();
    const token = tokenFromLastEmail(user.email);

    const verify = await app.request("/auth/verify_email", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token }),
    });
    expect(verify.status).toBe(200);

    const { res, cookie } = await login(user.email, password);
    expect(res.status).toBe(200);
    expect(cookie).toBeTruthy();
  });

  test("a token can only be used once", async () => {
    const { user } = await signUp();
    const token = tokenFromLastEmail(user.email);

    const first = await app.request("/auth/verify_email", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token }),
    });
    const second = await app.request("/auth/verify_email", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token }),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(403);
    expect(((await second.json()) as { message: string }).message).toBe(
      "Invalid or expired token",
    );
  });

  test("rejects an unknown token with 403", async () => {
    const res = await app.request("/auth/verify_email", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token: "not-a-real-token" }),
    });

    expect(res.status).toBe(403);
  });

  test("the emailed link verifies in a browser", async () => {
    const { user } = await signUp();
    const token = tokenFromLastEmail(user.email);

    const res = await app.request(
      `/auth/verify_email?token=${encodeURIComponent(token)}`,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("text/html");
    expect(await res.text()).toContain("verified");
  });

  test("the emailed link reports a bad token", async () => {
    const res = await app.request("/auth/verify_email?token=nope");

    expect(res.status).toBe(403);
    expect(await res.text()).toContain("Invalid or expired token");
  });

  test("a password-reset token cannot be replayed as a verification token", async () => {
    const { user } = await signUp();

    await app.request("/auth/forgot_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: user.email }),
    });
    const resetToken = tokenFromLastEmail(user.email);

    const res = await app.request("/auth/verify_email", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token: resetToken }),
    });

    expect(res.status).toBe(403);
  });
});

describe("resend verification", () => {
  test("responds identically for an unknown address", async () => {
    const res = await app.request("/auth/resend_verification", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: randomEmail("ghost") }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      message: "If that email needs verifying, a new link has been sent",
    });
  });

  test("does not send mail to an already verified account", async () => {
    const { user } = await createUserWithPassword();

    await app.request("/auth/resend_verification", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: user.email }),
    });

    expect(lastEmailTo(user.email)).toBeUndefined();
  });

  test("issues a fresh link that invalidates the previous one", async () => {
    const { user } = await signUp();
    const staleToken = tokenFromLastEmail(user.email);

    await app.request("/auth/resend_verification", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: user.email }),
    });
    const freshToken = tokenFromLastEmail(user.email);

    expect(freshToken).not.toBe(staleToken);

    const stale = await app.request("/auth/verify_email", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token: staleToken }),
    });
    expect(stale.status).toBe(403);
  });
});

describe("login", () => {
  test("sets a hardened session cookie", async () => {
    const { user, password } = await signUpVerified();

    const { res, cookie } = await login(user.email, password);
    expect(res.status).toBe(200);

    const lowered = cookie?.toLowerCase() ?? "";
    expect(lowered).toContain("httponly");
    expect(lowered).toContain("samesite=lax");
    expect(lowered).toContain("path=/");
    expect(lowered).toContain("max-age=");
    // `secure` would break plain-http local development.
    expect(lowered).not.toContain("secure");
  });

  test("accepts a mobile number as identifier", async () => {
    const { user, password } = await signUpVerified();

    const { res } = await login(user.mobile, password);
    expect(res.status).toBe(200);
  });

  test("accepts an email regardless of case", async () => {
    const { user, password } = await signUpVerified();

    const { res } = await login(user.email.toUpperCase(), password);
    expect(res.status).toBe(200);
  });

  test("rejects a wrong password with 401", async () => {
    const { user } = await createUserWithPassword();

    const { res } = await login(user.email, "wrong-password");
    expect(res.status).toBe(401);
  });

  test("rejects an invalid identifier with 401", async () => {
    const { res } = await login("not-an-identifier", "whatever");
    expect(res.status).toBe(401);
  });

  test("rejects an unknown user with 401", async () => {
    const { res } = await login(randomEmail("ghost"), VALID_PASSWORD);
    expect(res.status).toBe(401);
  });

  test("does not set a cookie when credentials are rejected", async () => {
    const { user } = await createUserWithPassword();

    const { cookie } = await login(user.email, "wrong-password");
    expect(cookie).toBeNull();
  });
});
