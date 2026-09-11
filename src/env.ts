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

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
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
  AUTH_COOKIE: z.string(),
  AUTH_SECRET: z.string(),
  AUTH_TOKEN_EXPIRY: z.coerce.number().default(1),
  DB_HOST: z.string().default("localhost"),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  DB_PORT: z.coerce.number().default(5432),
  DATABASE_URL: z.string().url(),
  DB_MIGRATING: stringBoolean,
  DB_SEEDING: stringBoolean,
  // GMAIL_USER: z.string(),
  // GMAIL_APP_PASSWORD: z.string(),
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
