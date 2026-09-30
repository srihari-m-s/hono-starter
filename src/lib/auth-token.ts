import { db } from "@/db";
import { authTokensTable, type AuthTokenPurpose } from "@/db/schema";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { generateToken, hashToken } from "./crypto";

/**
 * Issues a single-use token for `purpose`.
 *
 * Any outstanding token for the same user and purpose is dropped first, so
 * "resend verification" invalidates the previous link instead of leaving
 * several valid ones in circulation.
 */
export async function createAuthToken(
  userId: number,
  purpose: AuthTokenPurpose,
  ttlMs: number,
): Promise<string> {
  const token = generateToken();

  // Both statements in one transaction so two concurrent resends cannot each
  // leave a live token behind.
  await db.transaction(async (tx) => {
    await tx
      .delete(authTokensTable)
      .where(
        and(
          eq(authTokensTable.userId, userId),
          eq(authTokensTable.purpose, purpose),
        ),
      );

    await tx.insert(authTokensTable).values({
      tokenHash: hashToken(token),
      userId,
      purpose,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    });
  });

  return token;
}

/**
 * Resolves a token without redeeming it.
 *
 * Used when work has to happen before the token is spent — a password reset
 * validates the new password first, so a rejected password does not burn the
 * link and force the user to request another one.
 *
 * Returns null when the token is unknown, already used, expired, or issued for
 * another purpose.
 */
export async function peekAuthToken(
  token: string,
  purpose: AuthTokenPurpose,
): Promise<number | null> {
  const [row] = await db
    .select({ userId: authTokensTable.userId })
    .from(authTokensTable)
    .where(
      and(
        eq(authTokensTable.tokenHash, hashToken(token)),
        eq(authTokensTable.purpose, purpose),
        isNull(authTokensTable.consumedAt),
        gt(authTokensTable.expiresAt, sql`now()`),
      ),
    );

  return row?.userId ?? null;
}

/**
 * Atomically redeems a token and returns the user it belongs to.
 *
 * The validation lives in the `UPDATE`'s `WHERE` clause, so two concurrent
 * requests can never both succeed with the same token. Returns null when the
 * token is unknown, already used, expired, or issued for another purpose.
 */
export async function consumeAuthToken(
  token: string,
  purpose: AuthTokenPurpose,
): Promise<number | null> {
  const redeemed = await db
    .update(authTokensTable)
    .set({ consumedAt: new Date().toISOString() })
    .where(
      and(
        eq(authTokensTable.tokenHash, hashToken(token)),
        eq(authTokensTable.purpose, purpose),
        isNull(authTokensTable.consumedAt),
        gt(authTokensTable.expiresAt, sql`now()`),
      ),
    )
    .returning({ userId: authTokensTable.userId });

  return redeemed[0]?.userId ?? null;
}
