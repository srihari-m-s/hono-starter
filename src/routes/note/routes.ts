import { createRoute } from "@hono/zod-openapi";
import { HttpStatusCodes } from "../../lib/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import {
  insertNotesSchema,
  notesListSchema,
  readNoteSchema,
} from "../../db/schema/note";
import { createErrorSchema } from "stoker/openapi/schemas";

const tags = ["note"];

export const list = createRoute({
  tags,
  method: "get",
  path: "/",
  responses: {
    [HttpStatusCodes.OK]: jsonContent(notesListSchema, "note list"),
  },
});
export type ListRoute = typeof list;

export const create = createRoute({
  tags,
  method: "post",
  path: "/",
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
