import { index, integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./user";

export const authTokenPurposes = ["email_verification", "password_reset"] as const;
export type AuthTokenPurpose = (typeof authTokenPurposes)[number];
export const authTokenPurposeEnum = pgEnum("auth_token_purpose", authTokenPurposes);

/**
 * Single-use, purpose-scoped tokens for email verification and password
 * resets.
 *
 * Keeping the purpose in the row (rather than overloading a session token)
 * is what stops a stolen session from being replayed as a password reset.
 * `consumedAt` makes each token usable exactly once.
 */
export const authTokensTable = pgTable(
  "auth_tokens",
  {
    id: serial("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    purpose: authTokenPurposeEnum("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("auth_tokens_user_id_purpose_idx").on(table.userId, table.purpose),
  ],
);
