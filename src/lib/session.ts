import env from "@/env";
import { db } from "@/db";
import {
  publicUserColumns,
  sessionsTable,
  usersTable,
} from "@/db/schema";
import type { PublicUser, Session } from "@/lib/types";
import { and, desc, eq, gt, lt, ne, sql } from "drizzle-orm";
import { generateToken, hashToken } from "./crypto";

export interface SessionMetadata {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface AuthenticatedSession {
  session: Session;
  user: PublicUser;
}

function futureExpiry(): string {
  return new Date(
    Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();
}

/**
 * Creates a session row and returns the raw token to hand to the client.
 * Only the token's hash is persisted.
 */
export async function createSession(
  userId: number,
  metadata: SessionMetadata = {},
): Promise<{ token: string; session: Session }> {
  const token = generateToken();

  const [session] = await db
    .insert(sessionsTable)
    .values({
      tokenHash: hashToken(token),
      userId,
      userAgent: metadata.userAgent ?? null,
      ipAddress: metadata.ipAddress ?? null,
      expiresAt: futureExpiry(),
    })
    .returning();

  return { token, session };
}

/**
 * Resolves a raw token to its session and owner.
 * Returns `undefined` for unknown, expired or revoked tokens.
 */
export async function getSessionByToken(
  token: string,
): Promise<AuthenticatedSession | undefined> {
  const [row] = await db
    .select({ session: sessionsTable, user: publicUserColumns })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(
      and(
        eq(sessionsTable.tokenHash, hashToken(token)),
        gt(sessionsTable.expiresAt, sql`now()`),
      ),
    );

  return row;
}

/** Active (non-expired) sessions for a user, newest first. */
export function listSessions(userId: number) {
  return db
    .select({
      id: sessionsTable.id,
      userId: sessionsTable.userId,
      userAgent: sessionsTable.userAgent,
      ipAddress: sessionsTable.ipAddress,
      expiresAt: sessionsTable.expiresAt,
      createdAt: sessionsTable.createdAt,
    })
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.userId, userId),
        gt(sessionsTable.expiresAt, sql`now()`),
      ),
    )
    .orderBy(desc(sessionsTable.createdAt));
}

/** Logout: removes exactly the session behind the given token. */
export async function deleteSessionByToken(token: string): Promise<void> {
  await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.tokenHash, hashToken(token)));
}

/**
 * Revokes one of the caller's sessions by its public id.
 * Scoped by `userId` so one user cannot revoke another user's session.
 * Returns false when no such session exists for that user.
 */
export async function deleteSessionById(
  id: number,
  userId: number,
): Promise<boolean> {
  const removed = await db
    .delete(sessionsTable)
    .where(and(eq(sessionsTable.id, id), eq(sessionsTable.userId, userId)))
    .returning({ id: sessionsTable.id });

  return removed.length > 0;
}

/** "Log out everywhere". */
export async function deleteAllSessions(userId: number): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
}

/** Used after a password change: keep the current session, drop the rest. */
export async function deleteOtherSessions(
  userId: number,
  keepSessionId: number,
): Promise<void> {
  await db
    .delete(sessionsTable)
    .where(
      and(
        eq(sessionsTable.userId, userId),
        ne(sessionsTable.id, keepSessionId),
      ),
    );
}

/** Housekeeping: drop rows that can no longer authenticate anyone. */
export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, sql`now()`));
}
