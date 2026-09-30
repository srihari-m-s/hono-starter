import { beforeEach, describe, expect, test } from "bun:test";
import { clearOutbox, lastEmailTo } from "@/lib/mailer";
import { PASSWORD_REJECTION_MESSAGES } from "@/lib/password-policy";
import {
  COMMON_PASSWORD,
  VALID_PASSWORD,
  cookieHeader,
  createUserWithPassword,
  jsonHeaders,
  login,
  loggedInUser,
  randomEmail,
  requestPasswordReset,
  signUp,
  testApp,
  tokenFromLastEmail,
} from "../../../tests/helpers";

const app = testApp();
const NEW_PASSWORD = "NewPassphrase456!";

beforeEach(() => {
  clearOutbox();
});

describe("forgot password", () => {
  test("sends a reset link to a registered address", async () => {
    const { user } = await createUserWithPassword();

    await requestPasswordReset(user.email);

    const message = lastEmailTo(user.email);
    expect(message?.subject).toBe("Reset your password");
    expect(message?.text).toContain("/auth/reset_password?token=");
  });

  test("answers identically for an unknown address", async () => {
    const known = await createUserWithPassword();

    const knownRes = await app.request("/auth/forgot_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: known.user.email }),
    });
    const unknownRes = await app.request("/auth/forgot_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: randomEmail("ghost") }),
    });

    // No account enumeration: same status, same body.
    expect(knownRes.status).toBe(200);
    expect(unknownRes.status).toBe(200);
    expect(await knownRes.json()).toEqual(await unknownRes.json());
  });

  test("rejects a malformed email with 422", async () => {
    const res = await app.request("/auth/forgot_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: "not-an-email" }),
    });

    expect(res.status).toBe(422);
  });
});

describe("reset password", () => {
  test("swaps the password and lets the user log in with the new one", async () => {
    const { user } = await createUserWithPassword();
    const token = await requestPasswordReset(user.email);

    const reset = await app.request("/auth/reset_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token, password: NEW_PASSWORD }),
    });
    expect(reset.status).toBe(200);

    const oldLogin = await login(user.email, VALID_PASSWORD);
    expect(oldLogin.res.status).toBe(401);

    const newLogin = await login(user.email, NEW_PASSWORD);
    expect(newLogin.res.status).toBe(200);
    expect(newLogin.cookie).toBeTruthy();
  });

  test("a reset token can only be used once", async () => {
    const { user } = await createUserWithPassword();
    const token = await requestPasswordReset(user.email);

    const first = await app.request("/auth/reset_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token, password: NEW_PASSWORD }),
    });
    const second = await app.request("/auth/reset_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token, password: "AnotherPassphrase789!" }),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(403);
  });

  test("rejects an unknown token with 403", async () => {
    const res = await app.request("/auth/reset_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token: "garbage-token", password: NEW_PASSWORD }),
    });

    expect(res.status).toBe(403);
  });

  test("the emailed link renders a working reset form", async () => {
    const { user } = await createUserWithPassword();
    const token = await requestPasswordReset(user.email);

    const res = await app.request(
      `/auth/reset_password?token=${encodeURIComponent(token)}`,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("text/html");

    const html = await res.text();
    expect(html).toContain("Choose a new password");
    // The token is read from the URL by the browser, never echoed into markup.
    expect(html).not.toContain(token);
  });

  test("the reset page does not reflect a crafted token", async () => {
    const payload = "</script><script>alert(1)</script>";

    const res = await app.request(
      `/auth/reset_password?token=${encodeURIComponent(payload)}`,
    );

    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  test("the reset page reports a missing token", async () => {
    const res = await app.request("/auth/reset_password");
    expect(res.status).toBe(400);
  });

  test("a verification token cannot be replayed as a reset token", async () => {
    const { user } = await signUp();
    const verificationToken = tokenFromLastEmail(user.email);

    const res = await app.request("/auth/reset_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        token: verificationToken,
        password: NEW_PASSWORD,
      }),
    });

    expect(res.status).toBe(403);
  });

  test("enforces the password policy", async () => {
    const { user } = await createUserWithPassword();
    const token = await requestPasswordReset(user.email);

    const res = await app.request("/auth/reset_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token, password: "weak" }),
    });

    expect(res.status).toBe(422);
  });

  test("rejects a common password without burning the reset token", async () => {
    const { user } = await createUserWithPassword();
    const token = await requestPasswordReset(user.email);

    const rejected = await app.request("/auth/reset_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token, password: COMMON_PASSWORD }),
    });

    expect(rejected.status).toBe(422);
    expect(((await rejected.json()) as { message: string }).message).toBe(
      PASSWORD_REJECTION_MESSAGES.common,
    );

    // The link has to survive a rejected password, otherwise a user who picks a
    // bad password has to request a whole new reset email just to try again.
    const retry = await app.request("/auth/reset_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token, password: NEW_PASSWORD }),
    });
    expect(retry.status).toBe(200);

    const after = await login(user.email, NEW_PASSWORD);
    expect(after.res.status).toBe(200);
  });

  test("revokes every existing session", async () => {
    const { user, cookie } = await loggedInUser();

    const token = await requestPasswordReset(user.email);
    const reset = await app.request("/auth/reset_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ token, password: NEW_PASSWORD }),
    });
    expect(reset.status).toBe(200);

    // Whoever reset the password takes the account over; the old session dies.
    const stale = await app.request("/auth/session", {
      headers: cookieHeader(cookie),
    });
    expect(stale.status).toBe(401);
  });
});

describe("change password", () => {
  test("changes the password when the current one is supplied", async () => {
    const { user, cookie } = await loggedInUser();

    const res = await app.request("/auth/change_password", {
      method: "POST",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({
        currentPassword: VALID_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    });

    expect(res.status).toBe(200);

    const newLogin = await login(user.email, NEW_PASSWORD);
    expect(newLogin.res.status).toBe(200);
  });

  test("rejects a wrong current password with 401", async () => {
    const { cookie } = await loggedInUser();

    const res = await app.request("/auth/change_password", {
      method: "POST",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({
        currentPassword: "not-the-password",
        newPassword: NEW_PASSWORD,
      }),
    });

    expect(res.status).toBe(401);
  });

  test("keeps the caller signed in but drops other sessions", async () => {
    const { user, password, cookie } = await loggedInUser();

    const second = await app.request("/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ identifier: user.email, password }),
    });
    const secondCookie = second.headers.get("set-cookie") ?? "";

    await app.request("/auth/change_password", {
      method: "POST",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({
        currentPassword: password,
        newPassword: NEW_PASSWORD,
      }),
    });

    const current = await app.request("/auth/session", {
      headers: cookieHeader(cookie),
    });
    const other = await app.request("/auth/session", {
      headers: cookieHeader(secondCookie),
    });

    expect(current.status).toBe(200);
    expect(other.status).toBe(401);
  });

  test("rejects a commonly used password", async () => {
    const { cookie } = await loggedInUser();

    const res = await app.request("/auth/change_password", {
      method: "POST",
      headers: { ...cookieHeader(cookie), ...jsonHeaders() },
      body: JSON.stringify({
        currentPassword: VALID_PASSWORD,
        newPassword: COMMON_PASSWORD,
      }),
    });

    expect(res.status).toBe(422);
    expect(((await res.json()) as { message: string }).message).toBe(
      PASSWORD_REJECTION_MESSAGES.common,
    );
  });

  test("requires authentication", async () => {
    const res = await app.request("/auth/change_password", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        currentPassword: VALID_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    });

    expect(res.status).toBe(401);
  });
});
