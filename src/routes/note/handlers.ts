import type { AppRouteHandler } from "../../lib/types";
import type { CreateRoute, ListRoute } from "./routes";
import db from "../../db";
import { notesTable } from "../../db/schema";
import { HttpStatusCodes } from "../../lib/http-status-codes";

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const notesList = await db
    .select({
      id: notesTable.id,
      content: notesTable.content,
      createdAt: notesTable.createdAt,
      updatedAt: notesTable.updatedAt,
    })
    .from(notesTable);
  return c.json(notesList);
};

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const note = c.req.valid("json");

  const [insertedNote] = await db.insert(notesTable).values(note).returning();

  return c.json(insertedNote, HttpStatusCodes.CREATED);
};
