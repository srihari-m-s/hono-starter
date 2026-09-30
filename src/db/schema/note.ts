import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "@hono/zod-openapi";
import { usersTable } from "./user";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  /** Owner. Every query must be scoped by this. */
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .$onUpdateFn(() => new Date().toISOString())
    .notNull(),
});

const fullNotesSchema = createSelectSchema(notesTable);

/** The owner is taken from the session, never from the request body. */
export const insertNotesSchema = fullNotesSchema
  .pick({
    content: true,
  })
  .partial()
  .openapi("NoteCreate");

export const readNoteSchema = fullNotesSchema.openapi("Note");

export const notesListSchema = z.array(readNoteSchema);

export const patchNoteSchema = fullNotesSchema
  .pick({
    content: true,
  })
  .partial()
  .openapi("NotePatch");
