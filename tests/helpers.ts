import app from "@/app";
import { db } from "@/db";
import { usersTable, type UserRole } from "@/db/schema";
import { lastEmailTo } from "@/lib/mailer";
import { hashPassword } from "@/lib/password";

export const VALID_PASSWORD = "TestPassphrase123!";

/**
 * Long enough to satisfy the 15-character floor but present on the common
 * password blocklist, so it isolates the policy check from schema validation.
 */
export const COMMON_PASSWORD = "password123456789";

export type TestApp = typeof app;

export function testApp(): TestApp {
  return app;
}

/** Unique 10-digit mobile number per call. */
export function randomMobile(): string {
  const digits = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  return `98${digits}`;
}

/** Unique email address per call. */
export function randomEmail(prefix = "user"): string {
  return `${prefix}-${crypto.randomUUID()}@example.com`;
}

export interface NewUser {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  role: UserRole;
}

export function makeUser(overrides: Partial<NewUser> = {}): NewUser {
  return {
    firstName: "Test",
    lastName: "User",
    email: randomEmail(),
    mobile: randomMobile(),
    role: "user",
    ...overrides,
  };
}

export function jsonHeaders(): Record<string, string> {
  return { "content-type": "application/json" };
}

/**
 * Signs up through the public API. The account is created unverified, exactly
 * as a real client would get it.
 */
export async function signUp(
  overrides: Partial<NewUser> & { password?: string } = {},
) {
  const { password = VALID_PASSWORD, ...userOverrides } = overrides;
  const user = makeUser(userOverrides);

  const res = await app.request("/auth/sign_up", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ ...user, password }),
  });

  if (res.status !== 201) {
    throw new Error(`signUp failed: ${res.status} ${await res.text()}`);
  }

  const created = (await res.json()) as Record<string, unknown>;
  return { user, password, created, res };
}

/**
 * Signs up and immediately verifies the address using the token from the
 * captured verification email — the same path a real user takes.
 */
export async function signUpVerified(
  overrides: Partial<NewUser> & { password?: string } = {},
) {
  const result = await signUp(overrides);
  const token = tokenFromLastEmail(result.user.email);

  const res = await app.request("/auth/verify_email", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ token }),
  });

  if (res.status !== 200) {
    throw new Error(`verifyEmail failed: ${res.status} ${await res.text()}`);
  }

  return result;
}

/**
 * Inserts a user directly with a known password and an already-verified
 * address, for tests that are not about the signup or verification flow.
 */
export async function createUserWithPassword(
  password = VALID_PASSWORD,
  overrides: Partial<NewUser> = {},
) {
  const user = makeUser(overrides);

  const [row] = await db
    .insert(usersTable)
    .values({
      ...user,
      password: await hashPassword(password),
      emailVerifiedAt: new Date().toISOString(),
    })
    .returning();

  return { user, password, row };
}

/** Log in through the public API. Returns the response and Set-Cookie value. */
export async function login(identifier: string, password: string) {
  const res = await app.request("/auth/login", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ identifier, password }),
  });

  return { res, cookie: res.headers.get("set-cookie") };
}

/** Build an auth header for protected routes from a Set-Cookie value. */
export function cookieHeader(cookie: string): Record<string, string> {
  return { Cookie: cookie.split(";")[0] ?? "" };
}

/** Extract the raw Set-Cookie value (just `name=value`). */
export function cookiePair(setCookie: string): string {
  return setCookie.split(";")[0] ?? "";
}

export async function loggedInUser(overrides: Partial<NewUser> = {}) {
  const { user, password, row } = await createUserWithPassword(
    VALID_PASSWORD,
    overrides,
  );
  const { res, cookie } = await login(user.email, password);

  if (res.status !== 200 || !cookie) {
    throw new Error(`login failed: ${res.status} ${await res.text()}`);
  }

  return { user, password, row, cookie };
}

/** A logged-in caller with the `admin` role. */
export function loggedInAdmin(overrides: Partial<NewUser> = {}) {
  return loggedInUser({ role: "admin", ...overrides });
}

/** Pulls the `token:` line out of the last email sent to an address. */
export function tokenFromLastEmail(address: string): string {
  const message = lastEmailTo(address);
  if (!message) throw new Error(`no email was sent to ${address}`);

  const match = message.text.match(/token:\s*(\S+)/);
  if (!match?.[1]) throw new Error(`no token found in email to ${address}`);

  return match[1];
}

/** Drives the forgot-password flow and returns the reset token. */
export async function requestPasswordReset(email: string): Promise<string> {
  const res = await app.request("/auth/forgot_password", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ email }),
  });

  if (res.status !== 200) {
    throw new Error(`forgotPassword failed: ${res.status} ${await res.text()}`);
  }

  return tokenFromLastEmail(email);
}
