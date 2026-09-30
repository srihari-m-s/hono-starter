import env from "@/env";
import { consumeAuthToken, createAuthToken, peekAuthToken } from "@/lib/auth-token";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/constants";
import { HttpStatusCodes } from "@/lib/http-status-codes";
import { HttpStatusPhrases } from "@/lib/http-status-phrases";
import {
  passwordChangedEmail,
  passwordResetEmail,
  sendEmail,
  verificationEmail,
} from "@/lib/mailer";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  checkPassword,
  PASSWORD_REJECTION_MESSAGES,
  type PasswordRejection,
} from "@/lib/password-policy";
import {
  findPublicUserById,
  findUserByEmail,
  findUserByIdentifier,
  getPasswordHash,
  insertUser,
  markEmailVerified,
  setPasswordHash,
} from "@/lib/users";
import {
  createSession,
  deleteAllSessions,
  deleteOtherSessions,
  deleteSessionById,
  deleteSessionByToken,
  listSessions,
} from "@/lib/session";
import type { AppBindings, AppRouteHandler } from "@/lib/types";
import { extractSessionToken } from "@/middlewares/auth";
import { clientIp } from "@/middlewares/rate-limit";
import type { Context, Handler } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type {
  ChangePasswordRoute,
  ForgotPasswordRoute,
  ListSessionsRoute,
  LoginRoute,
  LogoutRoute,
  ReadSessionRoute,
  ResendVerificationRoute,
  ResetPasswordRoute,
  RevokeAllSessionsRoute,
  RevokeSessionRoute,
  SignUpRoute,
  VerifyEmailRoute,
} from "./routes";

const INVALID_TOKEN_MESSAGE = "Invalid or expired token";

/**
 * A verified-looking hash used to burn the same CPU time when the account
 * does not exist. Without it, "user not found" returns measurably faster than
 * "wrong password" and leaks which addresses are registered.
 */
let decoyHash: Promise<string> | undefined;
function getDecoyHash() {
  decoyHash ??= hashPassword("timing-attack-decoy-password");
  return decoyHash;
}

function setSessionCookie(c: Context<AppBindings>, token: string) {
  setCookie(c, env.AUTH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: env.SESSION_TTL_HOURS * 60 * 60,
  });
}

function clearSessionCookie(c: Context<AppBindings>) {
  deleteCookie(c, env.AUTH_COOKIE, { path: "/" });
}

/**
 * Password screening is a policy failure, not a schema failure, so it is
 * enforced in the handlers and reported the same way a validation error is.
 * NIST requires the reason for rejection to be given.
 */
function passwordRejected(c: Context<AppBindings>, reason: PasswordRejection) {
  return c.json(
    { message: PASSWORD_REJECTION_MESSAGES[reason] },
    HttpStatusCodes.UNPROCESSABLE_ENTITY,
  );
}

export const signUp: AppRouteHandler<SignUpRoute> = async (c) => {
  const payload = c.req.valid("json");

  const rejection = await checkPassword(payload.password, {
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName ?? undefined,
  });
  if (rejection) return passwordRejected(c, rejection);

  const hashedPassword = await hashPassword(payload.password);

  // The public projection is selected directly, so the password hash never
  // even leaves the database.
  const created = await insertUser({ ...payload, password: hashedPassword });
  if (!created) return conflictResponse(c);

  const token = await createAuthToken(
    created.id,
    "email_verification",
    env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
  );
  await sendEmail(verificationEmail(created.email, token));

  return c.json(created, HttpStatusCodes.CREATED);
};

export const login: AppRouteHandler<LoginRoute> = async (c) => {
  const { identifier, password } = c.req.valid("json");

  const user = await findUserByIdentifier(identifier);

  if (!user) {
    await verifyPassword(password, await getDecoyHash());
    return unauthorizedResponse(c);
  }

  const passwordMatches = await verifyPassword(password, user.password);
  if (!passwordMatches) return unauthorizedResponse(c);

  if (!user.emailVerifiedAt) return forbiddenResponse(c);

  const { token } = await createSession(user.id, {
    userAgent: c.req.header("user-agent") ?? null,
    ipAddress: clientIp(c),
  });

  setSessionCookie(c, token);

  return c.json({ message: HttpStatusPhrases.OK }, HttpStatusCodes.OK);
};

export const logout: AppRouteHandler<LogoutRoute> = async (c) => {
  const token = extractSessionToken(c);
  if (token) await deleteSessionByToken(token);

  clearSessionCookie(c);

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};

export const readSession: AppRouteHandler<ReadSessionRoute> = async (c) => {
  return c.json(c.get("user"), HttpStatusCodes.OK);
};

export const listSessionsHandler: AppRouteHandler<ListSessionsRoute> = async (
  c,
) => {
  const user = c.get("user");
  const current = c.get("session");

  const sessions = await listSessions(user.id);

  return c.json(
    sessions.map((session) => ({
      ...session,
      current: session.id === current.id,
    })),
    HttpStatusCodes.OK,
  );
};

export const revokeAllSessions: AppRouteHandler<
  RevokeAllSessionsRoute
> = async (c) => {
  const user = c.get("user");

  await deleteAllSessions(user.id);
  clearSessionCookie(c);

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};

export const revokeSession: AppRouteHandler<RevokeSessionRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const user = c.get("user");
  const current = c.get("session");

  const removed = await deleteSessionById(id, user.id);
  if (!removed) return notFoundResponse(c);

  // Revoking the session you are using is a valid way to log out.
  if (id === current.id) clearSessionCookie(c);

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};

export const verifyEmail: AppRouteHandler<VerifyEmailRoute> = async (c) => {
  const { token } = c.req.valid("json");

  const userId = await consumeAuthToken(token, "email_verification");
  if (!userId) {
    return c.json({ message: INVALID_TOKEN_MESSAGE }, HttpStatusCodes.FORBIDDEN);
  }

  await markEmailVerified(userId);

  return c.json({ message: "Email verified" }, HttpStatusCodes.OK);
};

export const resendVerification: AppRouteHandler<
  ResendVerificationRoute
> = async (c) => {
  const { email } = c.req.valid("json");

  const user = await findUserByEmail(email);

  // Re-issuing drops any earlier token, so only the newest link works.
  if (user && !user.emailVerifiedAt) {
    const token = await createAuthToken(
      user.id,
      "email_verification",
      env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
    );
    await sendEmail(verificationEmail(user.email, token));
  }

  return c.json(
    { message: "If that email needs verifying, a new link has been sent" },
    HttpStatusCodes.OK,
  );
};

export const forgotPassword: AppRouteHandler<ForgotPasswordRoute> = async (
  c,
) => {
  const { email } = c.req.valid("json");

  const user = await findUserByEmail(email);

  if (user) {
    const token = await createAuthToken(
      user.id,
      "password_reset",
      env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
    );
    await sendEmail(passwordResetEmail(user.email, token));
  }

  // Same response either way — see the route definition for why.
  return c.json(
    { message: "If that email is registered, a reset link has been sent" },
    HttpStatusCodes.OK,
  );
};

export const resetPassword: AppRouteHandler<ResetPasswordRoute> = async (c) => {
  const { token, password } = c.req.valid("json");

  // Resolve the token before redeeming it: an unacceptable password must not
  // burn the reset link, or the user has to request another one to retry.
  const tokenUserId = await peekAuthToken(token, "password_reset");
  if (!tokenUserId) {
    return c.json({ message: INVALID_TOKEN_MESSAGE }, HttpStatusCodes.FORBIDDEN);
  }

  const user = await findPublicUserById(tokenUserId);
  if (!user) {
    return c.json({ message: INVALID_TOKEN_MESSAGE }, HttpStatusCodes.FORBIDDEN);
  }

  const rejection = await checkPassword(password, {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName ?? undefined,
  });
  if (rejection) return passwordRejected(c, rejection);

  const userId = await consumeAuthToken(token, "password_reset");
  if (!userId) {
    return c.json({ message: INVALID_TOKEN_MESSAGE }, HttpStatusCodes.FORBIDDEN);
  }

  await setPasswordHash(userId, await hashPassword(password));

  // Whoever reset the password takes over the account; every existing session
  // dies, including any the attacker was holding.
  await deleteAllSessions(userId);

  await sendEmail(passwordChangedEmail(user.email));

  return c.json({ message: "Password reset" }, HttpStatusCodes.OK);
};

export const changePassword: AppRouteHandler<ChangePasswordRoute> = async (
  c,
) => {
  const { currentPassword, newPassword } = c.req.valid("json");
  const user = c.get("user");
  const session = c.get("session");

  const currentHash = await getPasswordHash(user.id);

  if (!currentHash || !(await verifyPassword(currentPassword, currentHash))) {
    return c.json(
      { message: "Current password is incorrect" },
      HttpStatusCodes.UNAUTHORIZED,
    );
  }

  const rejection = await checkPassword(newPassword, {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName ?? undefined,
  });
  if (rejection) return passwordRejected(c, rejection);

  await setPasswordHash(user.id, await hashPassword(newPassword));

  // Keep the caller signed in, sign out everywhere else.
  await deleteOtherSessions(user.id, session.id);
  await sendEmail(passwordChangedEmail(user.email));

  return c.json({ message: "Password changed" }, HttpStatusCodes.OK);
};

/**
 * Browser-friendly companion to `POST /auth/verify_email`, so the link in the
 * verification email works with no frontend in the loop. Point `APP_URL` at
 * your own app if you would rather handle the token there.
 */
export const verifyEmailPage: Handler<AppBindings> = async (c) => {
  const token = c.req.query("token");

  if (!token) return c.html(tokenPage("Missing token", false), 400);

  const userId = await consumeAuthToken(token, "email_verification");
  if (!userId) return c.html(tokenPage(INVALID_TOKEN_MESSAGE, false), 403);

  await markEmailVerified(userId);

  return c.html(tokenPage("Your email address is verified. You can log in.", true));
};

/**
 * Browser-friendly companion to `POST /auth/reset_password`.
 *
 * Verification can be a plain link, but choosing a new password needs a form,
 * so this page renders one and submits to the JSON endpoint.
 *
 * The page is entirely static: the token is read from the URL by the browser
 * rather than interpolated into the markup, so a crafted `?token=` cannot
 * break out of the script or the HTML.
 */
export const resetPasswordPage: Handler<AppBindings> = (c) => {
  if (!c.req.query("token")) return c.html(resetPasswordForm(), 400);

  return c.html(resetPasswordForm());
};

function resetPasswordForm(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset password</title>
  </head>
  <body style="font-family: system-ui, sans-serif; max-width: 24rem; margin: 4rem auto; padding: 0 1rem;">
    <h1>Choose a new password</h1>
    <form id="reset-form">
      <input
        name="password"
        type="password"
        required
        minlength="8"
        placeholder="New password"
        autocomplete="new-password"
        style="width: 100%; padding: .5rem; box-sizing: border-box;"
      />
      <button type="submit" style="margin-top: .75rem; padding: .5rem 1rem;">
        Set password
      </button>
    </form>
    <p id="result" role="status"></p>
    <script>
      const form = document.getElementById("reset-form");
      const result = document.getElementById("result");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        result.textContent = "";

        const response = await fetch("/auth/reset_password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token: new URLSearchParams(window.location.search).get("token"),
            password: new FormData(form).get("password"),
          }),
        });

        const body = await response.json().catch(() => ({}));
        result.textContent = response.ok
          ? "Password updated. You can now log in."
          : body.message || "That link is invalid or has expired.";
      });
    </script>
  </body>
</html>`;
}

function tokenPage(message: string, ok: boolean): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${ok ? "Verified" : "Verification failed"}</title>
  </head>
  <body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem;">
    <h1>${ok ? "✅" : "⚠️"} ${ok ? "Verified" : "Verification failed"}</h1>
    <p>${message}</p>
  </body>
</html>`;
}
