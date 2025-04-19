import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "@hono/zod-openapi";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  content: text("content"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .defaultNow()
    .$onUpdateFn(() => new Date().toISOString())
    .notNull(),
});

const fullNotesSchema = createSelectSchema(notesTable);

export const insertNotesSchema = fullNotesSchema
  .pick({
    content: true,
  })
  .openapi("NoteCreate");

export const readNoteSchema = fullNotesSchema.openapi("Note");

export const notesListSchema = z.array(fullNotesSchema);

export const patchNoteSchema = fullNotesSchema.partial().openapi("NotePatch");

export const deleteNoteSchema = fullNotesSchema
  .pick({ id: true })
  .openapi("NoteDelete");
