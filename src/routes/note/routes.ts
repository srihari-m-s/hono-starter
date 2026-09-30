import { createPrivateRoute } from "../../lib/create-private-route";
import { HttpStatusCodes } from "../../lib/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import {
  insertNotesSchema,
  notesListSchema,
  patchNoteSchema,
  readNoteSchema,
} from "../../db/schema/note";
import { notFoundResponseDef } from "../../lib/constants";
import { createErrorSchema, IdParamsSchema } from "stoker/openapi/schemas";

const tags = ["note"];

/** Notes are private: every endpoint is scoped to the caller's own rows. */
export const list = createPrivateRoute({
  tags,
  method: "get",
  path: "/note",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(notesListSchema, "note list"),
  },
});
export type ListRoute = typeof list;

export const create = createPrivateRoute({
  tags,
  method: "post",
  path: "/note",
  request: {
    body: jsonContentRequired(insertNotesSchema, "create note"),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(readNoteSchema, "note created"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(insertNotesSchema),
      "create note error",
    ),
  },
});
export type CreateRoute = typeof create;

export const read = createPrivateRoute({
  tags,
  method: "get",
  path: "/note/{id}",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(readNoteSchema, "note by id"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      "invalid id error",
    ),
    ...notFoundResponseDef,
  },
});
export type ReadRoute = typeof read;

export const patch = createPrivateRoute({
  tags,
  method: "patch",
  path: "/note/{id}",
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(patchNoteSchema, "note patch"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(readNoteSchema, "patched note"),
    ...notFoundResponseDef,
  },
});
export type PatchRoute = typeof patch;

export const remove = createPrivateRoute({
  tags,
  method: "delete",
  path: "/note/{id}",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: "Note deleted" },
    ...notFoundResponseDef,
  },
});
export type RemoveRoute = typeof remove;
