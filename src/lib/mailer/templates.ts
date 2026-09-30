import env from "@/env";
import type { EmailMessage } from "./types";

/**
 * Builds the email that carries an email-verification token.
 *
 * The link points at `APP_URL`, which is the browser-facing entry point. By
 * default that is this API's own `GET /auth/verify_email`, so the flow works
 * end to end with no frontend; point `APP_URL` at your app and handle the
 * token there instead.
 */
export function verificationEmail(to: string, token: string): EmailMessage {
  const link = `${env.APP_URL}/auth/verify_email?token=${token}`;

  return {
    to,
    subject: "Verify your email address",
    text: [
      "Welcome!",
      "",
      "Confirm your email address by opening this link:",
      link,
      "",
      `Link expires in ${env.EMAIL_VERIFICATION_TTL_HOURS} hour(s).`,
      "",
      "Or POST the token to /auth/verify_email:",
      `token: ${token}`,
    ].join("\n"),
  };
}

/** Builds the email that carries a password-reset token. */
export function passwordResetEmail(to: string, token: string): EmailMessage {
  const link = `${env.APP_URL}/auth/reset_password?token=${token}`;

  return {
    to,
    subject: "Reset your password",
    text: [
      "Someone asked to reset the password for this account.",
      "",
      "Open this link to choose a new password:",
      link,
      "",
      `Link expires in ${env.PASSWORD_RESET_TTL_MINUTES} minute(s).`,
      "",
      "Or POST the token to /auth/reset_password:",
      `token: ${token}`,
      "",
      "If this wasn't you, you can ignore this email.",
    ].join("\n"),
  };
}

/** Notification sent after a password change, so a takeover is noticeable. */
export function passwordChangedEmail(to: string): EmailMessage {
  return {
    to,
    subject: "Your password was changed",
    text: [
      "The password for this account was just changed.",
      "",
      "All other sessions have been signed out.",
      "",
      "If this wasn't you, reset your password immediately.",
    ].join("\n"),
  };
}
