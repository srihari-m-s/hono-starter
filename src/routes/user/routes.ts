import { patchUserSchema, selectUsersSchema } from "@/db/schema/user";
import { forbiddenResponseDef, notFoundResponseDef } from "@/lib/constants";
import { createPrivateRoute } from "@/lib/create-private-route";
import { HttpStatusCodes } from "@/lib/http-status-codes";
import { requireRole } from "@/middlewares/require-role";
import { z } from "@hono/zod-openapi";
import {
  jsonContent,
  jsonContentOneOf,
  jsonContentRequired,
} from "stoker/openapi/helpers";
import { createErrorSchema, IdParamsSchema } from "stoker/openapi/schemas";

const tags = ["users"];

/**
 * Admin only. Every other user-management endpoint is scoped to the caller —
 * see the handlers for the "self or admin" rule.
 */
export const list = createPrivateRoute({
  tags,
  method: "get",
  path: "/users",
  middleware: [requireRole("admin")],
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(selectUsersSchema), "users list"),
    ...forbiddenResponseDef,
  },
});
export type ListRoute = typeof list;

export const read = createPrivateRoute({
  tags,
  method: "get",
  path: "/users/{id}",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectUsersSchema, "user by id"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      "Invalid Id error",
    ),
    ...notFoundResponseDef,
    ...forbiddenResponseDef,
  },
});
export type ReadRoute = typeof read;

export const patch = createPrivateRoute({
  tags,
  method: "patch",
  path: "/users/{id}",
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(patchUserSchema, "user patch"),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectUsersSchema, "patched user"),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContentOneOf(
      [createErrorSchema(patchUserSchema), createErrorSchema(IdParamsSchema)],
      "user patch error",
    ),
    ...notFoundResponseDef,
    ...forbiddenResponseDef,
  },
});
export type PatchRoute = typeof patch;

export const remove = createPrivateRoute({
  tags,
  method: "delete",
  path: "/users/{id}",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [HttpStatusCodes.NO_CONTENT]: { description: "User deleted" },
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      "Invalid Id error",
    ),
    ...notFoundResponseDef,
    ...forbiddenResponseDef,
  },
});
export type RemoveRoute = typeof remove;
