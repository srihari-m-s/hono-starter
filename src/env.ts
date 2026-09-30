import { z, ZodError } from "zod";

import { config } from "dotenv";
import { expand } from "dotenv-expand";

expand(config());

const stringBoolean = z
  .enum(["true", "false"])
  .default("false")
  .transform((val) => {
    return val === "true";
  });

/** Comma-separated string -> trimmed, non-empty list. */
const stringList = z
  .string()
  .default("")
  .transform((val) =>
    val
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

const EnvSchema = z
  .object({
    // Constrained rather than free-form: `NODE_ENV === "production"` gates both
    // the `Secure` cookie flag and stack-trace suppression, so a typo like
    // "prod" would silently disable both.
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(8080),
    LOG_LEVEL: z.enum([
      "fatal",
      "error",
      "warn",
      "info",
      "debug",
      "trace",
      "silent",
    ]),

    // ── Public origin ─────────────────────────────────────────────────
    // Used to build links in emails and to decide which origins may send
    // credentialed (cookie) cross-origin requests.
    APP_URL: z.string().url().default("http://localhost:8080"),
    ALLOWED_ORIGINS: stringList,

    /**
     * Number of reverse proxies in front of the app that append to
     * `X-Forwarded-For`.
     *
     * `0` (the default) means the header is not trusted at all and the client
     * address is taken from the socket. Raising it makes the app read that many
     * entries from the right-hand end of `X-Forwarded-For`. Never set it to a
     * value larger than the number of proxies you actually run: `X-Forwarded-For`
     * is client-controlled, so trusting it without a proxy in front lets a
     * caller pick their own rate-limit bucket.
     */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

    // ── Sessions ──────────────────────────────────────────────────────
    AUTH_COOKIE: z.string().default("starter_session"),
    SESSION_TTL_HOURS: z.coerce.number().positive().default(24 * 7),

    // ── One-time tokens ───────────────────────────────────────────────
    EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().positive().default(24),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().positive().default(30),

    // ── Rate limiting ─────────────────────────────────────────────────
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(900_000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().positive().default(10),

    /**
     * Optional breach-corpus screening for new passwords.
     *
     * The bundled common-password list is always checked. Setting this to
     * `hibp` additionally consults Have I Been Pwned's Pwned Passwords range
     * API, which covers full breach corpuses at the cost of a network call
     * per signup, reset and password change.
     */
    PASSWORD_BREACH_LOOKUP: z.enum(["off", "hibp"]).default("off"),

    // ── Email ─────────────────────────────────────────────────────────
    MAIL_TRANSPORT: z.enum(["console", "memory", "smtp"]).default("console"),
    MAIL_FROM: z.string().default("Hono Starter <no-reply@example.com>"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_SECURE: stringBoolean,

    // ── Database (PostgreSQL) ─────────────────────────────────────────
    DB_HOST: z.string().default("localhost"),
    DB_USER: z.string(),
    DB_PASSWORD: z.string(),
    DB_NAME: z.string(),
    DB_PORT: z.coerce.number().default(5432),
    DATABASE_URL: z.string().url(),
    DB_MIGRATING: stringBoolean,
    DB_SEEDING: stringBoolean,
  })
  .superRefine((value, ctx) => {
    if (value.MAIL_TRANSPORT === "smtp" && !value.SMTP_HOST) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "SMTP_HOST is required when MAIL_TRANSPORT=smtp",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  return EnvSchema.parse(input);
}

let env: Env;

try {
  env = parseEnv(process.env);
} catch (e) {
  const error = e as ZodError;
  console.error("❌ Invalid env:");
  console.error(error.flatten().fieldErrors);
  process.exit(1);
}

export default env;
