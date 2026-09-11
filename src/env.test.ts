import { describe, expect, test } from "bun:test";
import { parseEnv } from "./env";

const validEnv = {
  NODE_ENV: "development",
  LOG_LEVEL: "info",
  AUTH_COOKIE: "starter_auth",
  AUTH_SECRET: "secret",
  AUTH_TOKEN_EXPIRY: "1",
  DB_HOST: "localhost",
  DB_USER: "postgres",
  DB_PASSWORD: "postgres",
  DB_NAME: "hono_starter",
  DB_PORT: "5432",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/hono_starter",
};

describe("parseEnv", () => {
  test("parses a valid environment", () => {
    const env = parseEnv(validEnv);
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(8080);
    expect(env.DB_MIGRATING).toBe(false);
  });

  test("coerces numbers", () => {
    const env = parseEnv({ ...validEnv, PORT: "4000", AUTH_TOKEN_EXPIRY: "2" });
    expect(env.PORT).toBe(4000);
    expect(env.AUTH_TOKEN_EXPIRY).toBe(2);
  });

  test("throws when AUTH_SECRET is missing", () => {
    const rest = { ...validEnv } as Partial<typeof validEnv>;
    delete rest.AUTH_SECRET;
    expect(() => parseEnv(rest)).toThrow();
  });

  test("throws on an invalid LOG_LEVEL", () => {
    expect(() => parseEnv({ ...validEnv, LOG_LEVEL: "shouty" })).toThrow();
  });

  test("throws on an invalid DATABASE_URL", () => {
    expect(() =>
      parseEnv({ ...validEnv, DATABASE_URL: "not-a-url" }),
    ).toThrow();
  });
});