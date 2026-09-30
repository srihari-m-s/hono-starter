import env from "@/env";
import { selectSessionSchema } from "@/db/schema/session";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  selectUsersSchema,
  signUpUsersSchema,
  verifyEmailSchema,
} from "@/db/schema/user";
import {
  conflictResponseDef,
  notFoundResponseDef,
  tooManyRequestsResponseDef,
} from "@/lib/constants";
import { createPrivateRoute } from "@/lib/create-private-route";
import { HttpStatusCodes } from "@/lib/http-status-codes";
import { HttpStatusPhrases } from "@/lib/http-status-phrases";
import { rateLimit } from "@/middlewares/rate-limit";
import { createRoute, z } from "@hono/zod-openapi";
import {
  jsonContent,
  jsonContentRequired,
} from "stoker/openapi/helpers";
import {
  createErrorSchema,
  createMessageObjectSchema,
  IdParamsSchema,
} from "stoker/openapi/schemas";

const tags = ["auth"];

/**
 * Brute-force guards. Each endpoint gets its own budget so hammering login
 * does not lock a legitimate user out of password reset.
 */
function credentialLimit(keyPrefix: string) {
  return rateLimit({
    keyPrefix,
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
  });
}

/**
 * Email-sending endpoints get a tighter budget: every accepted request costs
 * money or sender reputation, so a smaller ceiling is worthwhile.
 */
function emailLimit(keyPrefix: string) {
  return rateLimit({
    keyPrefix,
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: Math.max(3, Math.floor(env.AUTH_RATE_LIMIT_MAX / 3)),
  });
}

const loginRateLimit = credentialLimit("login");
const signUpRateLimit = credentialLimit("sign_up");
const resetRateLimit = credentialLimit("reset_password");
const forgotPasswordRateLimit = emailLimit("forgot_password");
const resendVerificationRateLimit = emailLimit("resend_verification");

export const signUp = createRoute({
  tags,
  method: "post",
  path: "/auth/sign_up",
  middleware: [signUpRateLimit],
  request: {
    body: jsonContentRequired(signUpUsersSchema, "sign-up payload"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(selectUsersSchema, "created user"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.union([
        createErrorSchema(signUpUsersSchema),
        createMessageObjectSchema("Password rejected"),
      ]),
      "sign-up validation error, or a password that is too common or breached",
    ),
    ...conflictResponseDef,
    ...tooManyRequestsResponseDef,
  },
});
export type SignUpRoute = typeof signUp;

export const login = createRoute({
  tags,
  method: "post",
  path: "/auth/login",
  middleware: [loginRateLimit],
  request: {
    body: jsonContentRequired(loginSchema, "login payload"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createMessageObjectSchema("Logged in"),
      "Session cookie set",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.UNAUTHORIZED),
      "invalid credentials",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema(HttpStatusPhrases.FORBIDDEN),
      "email address is not verified yet",
    ),
    ...tooManyRequestsResponseDef,
  },
});
export type LoginRoute = typeof login;

export const logout = createPrivateRoute({
  tags,
  method: "post",
  path: "/auth/logout",
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: "Session revoked" },
  },
});
export type LogoutRoute = typeof logout;

export const readSession = createPrivateRoute({
  tags,
  method: "get",
  path: "/auth/session",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectUsersSchema, "the current user"),
  },
});
export type ReadSessionRoute = typeof readSession;

export const listSessions = createPrivateRoute({
  tags,
  method: "get",
  path: "/auth/sessions",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(selectSessionSchema),
      "active sessions, newest first",
    ),
  },
});
export type ListSessionsRoute = typeof listSessions;

export const revokeAllSessions = createPrivateRoute({
  tags,
  method: "delete",
  path: "/auth/sessions",
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: "All sessions revoked" },
  },
});
export type RevokeAllSessionsRoute = typeof revokeAllSessions;

export const revokeSession = createPrivateRoute({
  tags,
  method: "delete",
  path: "/auth/sessions/{id}",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: "Session revoked" },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      "invalid id error",
    ),
    ...notFoundResponseDef,
  },
});
export type RevokeSessionRoute = typeof revokeSession;

export const verifyEmail = createRoute({
  tags,
  method: "post",
  path: "/auth/verify_email",
  request: {
    body: jsonContentRequired(verifyEmailSchema, "email verification token"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createMessageObjectSchema("Email verified"),
      "email verified",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(verifyEmailSchema),
      "verification error",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema("Invalid or expired token"),
      "invalid or expired token",
    ),
  },
});
export type VerifyEmailRoute = typeof verifyEmail;

export const resendVerification = createRoute({
  tags,
  method: "post",
  path: "/auth/resend_verification",
  middleware: [resendVerificationRateLimit],
  request: {
    body: jsonContentRequired(resendVerificationSchema, "account email"),
  },
  responses: {
    // Same reasoning as forgot_password: identical response whether or not the
    // address exists, and whether or not it still needs verifying.
    [HttpStatusCodes.OK]: jsonContent(
      createMessageObjectSchema(
        "If that email needs verifying, a new link has been sent",
      ),
      "verification email sent when it is needed",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(resendVerificationSchema),
      "validation error",
    ),
    ...tooManyRequestsResponseDef,
  },
});
export type ResendVerificationRoute = typeof resendVerification;

export const forgotPassword = createRoute({
  tags,
  method: "post",
  path: "/auth/forgot_password",
  middleware: [forgotPasswordRateLimit],
  request: {
    body: jsonContentRequired(forgotPasswordSchema, "account email"),
  },
  responses: {
    // Always 200, whether or not the address exists: telling the caller which
    // emails are registered hands an attacker a free account-enumeration API.
    [HttpStatusCodes.OK]: jsonContent(
      createMessageObjectSchema(
        "If that email is registered, a reset link has been sent",
      ),
      "reset link sent when the account exists",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(forgotPasswordSchema),
      "validation error",
    ),
    ...tooManyRequestsResponseDef,
  },
});
export type ForgotPasswordRoute = typeof forgotPassword;
export const resetPassword = createRoute({
  tags,
  method: "post",
  path: "/auth/reset_password",
  middleware: [resetRateLimit],
  request: {
    body: jsonContentRequired(resetPasswordSchema, "new password and token"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createMessageObjectSchema("Password reset"),
      "password reset",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.union([
        createErrorSchema(resetPasswordSchema),
        createMessageObjectSchema("Password rejected"),
      ]),
      "validation error, or a password that is too common or breached",
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      createMessageObjectSchema("Invalid or expired token"),
      "invalid or expired token",
    ),
    ...tooManyRequestsResponseDef,
  },
});
export type ResetPasswordRoute = typeof resetPassword;

export const changePassword = createPrivateRoute({
  tags,
  method: "post",
  path: "/auth/change_password",
  request: {
    body: jsonContentRequired(changePasswordSchema, "password change"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createMessageObjectSchema("Password changed"),
      "password changed",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.union([
        createErrorSchema(changePasswordSchema),
        createMessageObjectSchema("Password rejected"),
      ]),
      "validation error, or a password that is too common or breached",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      createMessageObjectSchema("Current password is incorrect"),
      "current password is incorrect",
    ),
  },
});
export type ChangePasswordRoute = typeof changePassword;
