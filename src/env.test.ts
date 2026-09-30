import { describe, expect, test } from "bun:test";
import { parseEnv } from "./env";

/** Only these are required; everything else has a default. */
const validEnv = {
  LOG_LEVEL: "info",
  DB_USER: "postgres",
  DB_PASSWORD: "postgres",
  DB_NAME: "hono_starter",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/hono_starter",
};

describe("parseEnv", () => {
  test("parses a valid environment and fills in defaults", () => {
    const env = parseEnv(validEnv);

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(8080);
    expect(env.DB_MIGRATING).toBe(false);
    expect(env.AUTH_COOKIE).toBe("starter_session");
    expect(env.MAIL_TRANSPORT).toBe("console");
    expect(env.SESSION_TTL_HOURS).toBe(168);
  });

  test("coerces numbers", () => {
    const env = parseEnv({
      ...validEnv,
      PORT: "4000",
      SESSION_TTL_HOURS: "48",
    });

    expect(env.PORT).toBe(4000);
    expect(env.SESSION_TTL_HOURS).toBe(48);
  });

  test("splits and trims ALLOWED_ORIGINS", () => {
    const env = parseEnv({
      ...validEnv,
      ALLOWED_ORIGINS: "http://a.test, http://b.test ,",
    });

    expect(env.ALLOWED_ORIGINS).toEqual(["http://a.test", "http://b.test"]);
  });

  test("defaults ALLOWED_ORIGINS to an empty list", () => {
    expect(parseEnv(validEnv).ALLOWED_ORIGINS).toEqual([]);
  });

  test("throws when a required field is missing", () => {
    const rest = { ...validEnv } as Partial<typeof validEnv>;
    delete rest.DB_USER;

    expect(() => parseEnv(rest)).toThrow();
  });

  test("throws on an invalid LOG_LEVEL", () => {
    expect(() => parseEnv({ ...validEnv, LOG_LEVEL: "shouty" })).toThrow();
  });

  test("rejects an unrecognised NODE_ENV", () => {
    // A typo here would silently disable the `Secure` cookie flag and
    // stack-trace suppression, so it has to fail loudly at boot.
    expect(() => parseEnv({ ...validEnv, NODE_ENV: "prod" })).toThrow();
    expect(() => parseEnv({ ...validEnv, NODE_ENV: "Production" })).toThrow();

    for (const value of ["development", "test", "production"] as const) {
      expect(parseEnv({ ...validEnv, NODE_ENV: value }).NODE_ENV).toBe(value);
    }
  });

  test("defaults TRUST_PROXY_HOPS to 0 so headers are not trusted", () => {
    expect(parseEnv(validEnv).TRUST_PROXY_HOPS).toBe(0);
    expect(parseEnv({ ...validEnv, TRUST_PROXY_HOPS: "2" }).TRUST_PROXY_HOPS).toBe(2);
    expect(() => parseEnv({ ...validEnv, TRUST_PROXY_HOPS: "-1" })).toThrow();
  });

  test("throws on an invalid DATABASE_URL", () => {
    expect(() =>
      parseEnv({ ...validEnv, DATABASE_URL: "not-a-url" }),
    ).toThrow();
  });

  test("throws on an unknown MAIL_TRANSPORT", () => {
    expect(() => parseEnv({ ...validEnv, MAIL_TRANSPORT: "carrier-pigeon" })).toThrow();
  });

  test("requires SMTP_HOST when MAIL_TRANSPORT is smtp", () => {
    expect(() => parseEnv({ ...validEnv, MAIL_TRANSPORT: "smtp" })).toThrow();

    expect(() =>
      parseEnv({
        ...validEnv,
        MAIL_TRANSPORT: "smtp",
        SMTP_HOST: "localhost",
      }),
    ).not.toThrow();
  });
});
