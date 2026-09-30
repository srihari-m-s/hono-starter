import { notesTable } from "../../db/schema";
import db from "../../db";
import { notFoundResponse } from "../../lib/constants";
import { HttpStatusCodes } from "../../lib/http-status-codes";
import type { AppRouteHandler } from "../../lib/types";
import { and, desc, eq } from "drizzle-orm";
import type {
  CreateRoute,
  ListRoute,
  PatchRoute,
  ReadRoute,
  RemoveRoute,
} from "./routes";

/**
 * Every query is scoped by `userId` taken from the session. Ownership is
 * enforced in the `where` clause rather than by checking after the read, so a
 * note belonging to someone else is indistinguishable from a missing one.
 */

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const user = c.get("user");

  const notesList = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.userId, user.id))
    .orderBy(desc(notesTable.createdAt));

  return c.json(notesList, HttpStatusCodes.OK);
};

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const note = c.req.valid("json");
  const user = c.get("user");

  const [insertedNote] = await db
    .insert(notesTable)
    .values({ ...note, userId: user.id })
    .returning();

  return c.json(insertedNote, HttpStatusCodes.CREATED);
};

export const read: AppRouteHandler<ReadRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const user = c.get("user");

  const [note] = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, user.id)));

  if (!note) return notFoundResponse(c);

  return c.json(note, HttpStatusCodes.OK);
};

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const user = c.get("user");

  const owned = and(eq(notesTable.id, id), eq(notesTable.userId, user.id));

  // `patchNoteSchema` is entirely optional, so `{}` is valid input. Drizzle
  // throws on an empty update, so treat it as the no-op it is.
  if (Object.keys(body).length === 0) {
    const [existing] = await db.select().from(notesTable).where(owned);
    if (!existing) return notFoundResponse(c);
    return c.json(existing, HttpStatusCodes.OK);
  }

  const [updated] = await db
    .update(notesTable)
    .set(body)
    .where(owned)
    .returning();

  if (!updated) return notFoundResponse(c);

  return c.json(updated, HttpStatusCodes.OK);
};

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const user = c.get("user");

  const removed = await db
    .delete(notesTable)
    .where(and(eq(notesTable.id, id), eq(notesTable.userId, user.id)))
    .returning({ id: notesTable.id });

  if (!removed.length) return notFoundResponse(c);

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};
