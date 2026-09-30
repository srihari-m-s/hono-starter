import { db } from "@/db";
import { publicUserColumns, usersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Detects a PostgreSQL unique-violation error (SQLSTATE 23505).
 *
 * Thrown when an insert or update violates a unique constraint (e.g. a
 * duplicate email or mobile on signup). Drizzle wraps driver errors in a
 * `DrizzleQueryError`, so the original postgres error is found via `cause`.
 */
export function isUniqueViolation(error: unknown, depth = 5): boolean {
  if (depth < 0 || typeof error !== "object" || error === null) {
    return false;
  }

  if ("code" in error && (error as { code?: unknown }).code === "23505") {
    return true;
  }

  return "cause" in error
    ? isUniqueViolation((error as { cause?: unknown }).cause, depth - 1)
    : false;
}

/**
 * Looks a user up by email address or mobile number, including the password
 * hash. Only for the login flow — never for a response body.
 */
export async function findUserByIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes("@");
  const value = isEmail ? trimmed.toLowerCase() : trimmed;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(isEmail ? eq(usersTable.email, value) : eq(usersTable.mobile, value));

  return user;
}

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.trim().toLowerCase()));

  return user;
}

/** The safe projection: everything except the password hash. */
export async function findPublicUserById(id: number) {
  const [user] = await db
    .select(publicUserColumns)
    .from(usersTable)
    .where(eq(usersTable.id, id));

  return user;
}

/**
 * Inserts a user and returns the public projection.
 * Returns `null` when the email or mobile is already taken.
 */
export async function insertUser(values: typeof usersTable.$inferInsert) {
  try {
    const [created] = await db
      .insert(usersTable)
      .values(values)
      .returning(publicUserColumns);

    return created ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

export function listPublicUsers() {
  return db.select(publicUserColumns).from(usersTable);
}

export async function getPasswordHash(userId: number) {
  const [row] = await db
    .select({ password: usersTable.password })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  return row?.password;
}

export async function setPasswordHash(userId: number, hash: string) {
  await db
    .update(usersTable)
    .set({ password: hash })
    .where(eq(usersTable.id, userId));
}

export async function markEmailVerified(userId: number) {
  await db
    .update(usersTable)
    .set({ emailVerifiedAt: new Date().toISOString() })
    .where(eq(usersTable.id, userId));
}
