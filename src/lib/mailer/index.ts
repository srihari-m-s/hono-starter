import env from "@/env";
import { createConsoleMailer, createMemoryMailer, createSmtpMailer } from "./transports";
import type { Mailer } from "./types";

let mailer: Mailer | undefined;

/**
 * Resolves the configured mailer.
 *
 * - `console` (default) logs emails to stdout, so the whole flow is testable
 *   with no provider account and no network.
 * - `memory` captures them in-process for assertions in the test suite.
 * - `smtp` delivers through whatever SMTP server `SMTP_*` points at.
 */
export function getMailer(): Mailer {
  if (!mailer) {
    mailer =
      env.MAIL_TRANSPORT === "smtp"
        ? createSmtpMailer()
        : env.MAIL_TRANSPORT === "memory"
          ? createMemoryMailer()
          : createConsoleMailer();
  }

  return mailer;
}

/** Sends a message through the configured transport. */
export function sendEmail(message: Parameters<Mailer["send"]>[0]) {
  return getMailer().send(message);
}

export type { EmailMessage, Mailer } from "./types";
export {
  clearOutbox,
  lastEmailTo,
  outbox,
} from "./transports";
export {
  passwordChangedEmail,
  passwordResetEmail,
  verificationEmail,
} from "./templates";
