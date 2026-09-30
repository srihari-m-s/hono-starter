import env from "@/env";
import nodemailer from "nodemailer";
import type { EmailMessage, Mailer } from "./types";

/** Pretty-prints an email to stdout. The default for local development. */
export function createConsoleMailer(): Mailer {
  return {
    async send(message) {
      console.log(
        [
          "",
          "📧 ────────────────────────────────────────────────",
          `   To:      ${message.to}`,
          `   Subject: ${message.subject}`,
          "   ────────────────────────────────────────────────",
          message.text
            .split("\n")
            .map((line) => `   ${line}`)
            .join("\n"),
          "   ────────────────────────────────────────────────",
          "",
        ].join("\n"),
      );
    },
  };
}

/** Emails captured in-process, for assertions in tests. */
export const outbox: EmailMessage[] = [];

export function clearOutbox(): void {
  outbox.length = 0;
}

/** Returns the most recent email sent to an address, if any. */
export function lastEmailTo(address: string) {
  const normalised = address.toLowerCase();
  return outbox
    .filter((message) => message.to.toLowerCase() === normalised)
    .at(-1);
}

export function createMemoryMailer(): Mailer {
  return {
    async send(message) {
      outbox.push({
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    },
  };
}

/**
 * Delivers over SMTP. Works with any provider that speaks SMTP — Gmail app
 * passwords, Resend, Brevo, Mailgun, SES, or a local Mailpit instance.
 */
export function createSmtpMailer(): Mailer {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
  });

  return {
    async send(message) {
      await transporter.sendMail({
        from: env.MAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  };
}
