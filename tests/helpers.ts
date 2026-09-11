import app from "@/app";
import { db } from "@/db";
import { usersTable } from "@/db/schema";
import { hashPassword } from "@/lib/protect-password";

const VALID_PASSWORD = "TestPass123!";

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
}

export function makeUser(overrides: Partial<NewUser> = {}): NewUser {
  return {
    firstName: "Test",
    lastName: "User",
    email: randomEmail(),
    mobile: randomMobile(),
    ...overrides,
  };
}

/** Sign up through the public API. Returns the created user body. */
export async function signUp(overrides: Partial<NewUser> = {}) {
  const user = makeUser(overrides);
  const res = await app.request("/users/sign_up", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(user),
  });
  if (res.status !== 200) {
    throw new Error(`signUp failed: ${res.status} ${await res.text()}`);
  }
  const created = (await res.json()) as Record<string, unknown>;
  return { user, created, res };
}

/** Insert a user directly into the DB with a known password. */
export async function createUserWithPassword(
  password = VALID_PASSWORD,
  overrides: Partial<NewUser> = {},
) {
  const user = makeUser(overrides);
  const [row] = await db
    .insert(usersTable)
    .values({ ...user, password: await hashPassword(password) })
    .returning();
  return { user, password, row };
}

/** Log in through the public API. Returns the response and Set-Cookie value. */
export async function login(identifier: string, password: string) {
  const res = await app.request("/users/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  return { res, cookie: res.headers.get("set-cookie") };
}

/** Build an auth header for protected routes from a Set-Cookie value. */
export function cookieHeader(cookie: string): Record<string, string> {
  return { Cookie: cookie.split(";")[0] };
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

export function jsonHeaders(): Record<string, string> {
  return { "content-type": "application/json" };
}