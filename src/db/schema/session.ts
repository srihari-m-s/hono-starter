import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "@hono/zod-openapi";
import { usersTable } from "./user";

/**
 * Server-side sessions. The cookie holds a random token; only its SHA-256
 * digest is stored, so a database leak does not hand over live sessions.
 *
 * Because sessions live in the database, logout, revocation, "log out
 * everywhere" and session listing are all plain SQL.
 */
export const sessionsTable = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

/**
 * Session shape for API responses. The token hash is never exposed — the
 * public `id` is what a client passes back to revoke a session.
 */
export const selectSessionSchema = createSelectSchema(sessionsTable)
  .omit({ tokenHash: true })
  .extend({ current: z.boolean() })
  .openapi("Session");
