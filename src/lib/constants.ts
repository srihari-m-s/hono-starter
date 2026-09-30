import type { AppBindings } from "@/lib/types";
import type { Context } from "hono";
import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { HttpStatusCodes } from "./http-status-codes";
import { HttpStatusPhrases } from "./http-status-phrases";

type AppContext = Context<AppBindings>;

export const notFoundSchema = createMessageObjectSchema(
  HttpStatusPhrases.NOT_FOUND,
);

export const unauthorizedResponseDef = {
  [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
    createMessageObjectSchema(HttpStatusPhrases.UNAUTHORIZED),
    HttpStatusPhrases.UNAUTHORIZED,
  ),
};

export const forbiddenResponseDef = {
  [HttpStatusCodes.FORBIDDEN]: jsonContent(
    createMessageObjectSchema(HttpStatusPhrases.FORBIDDEN),
    HttpStatusPhrases.FORBIDDEN,
  ),
};

export const conflictResponseDef = {
  [HttpStatusCodes.CONFLICT]: jsonContent(
    createMessageObjectSchema(HttpStatusPhrases.CONFLICT),
    HttpStatusPhrases.CONFLICT,
  ),
};

export const tooManyRequestsResponseDef = {
  [HttpStatusCodes.TOO_MANY_REQUESTS]: jsonContent(
    createMessageObjectSchema(HttpStatusPhrases.TOO_MANY_REQUESTS),
    HttpStatusPhrases.TOO_MANY_REQUESTS,
  ),
};

export const notFoundResponseDef = {
  [HttpStatusCodes.NOT_FOUND]: jsonContent(
    createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND),
    HttpStatusPhrases.NOT_FOUND,
  ),
};

export const unauthorizedResponse = (c: AppContext) =>
  c.json(
    { message: HttpStatusPhrases.UNAUTHORIZED },
    HttpStatusCodes.UNAUTHORIZED,
  );

export const forbiddenResponse = (c: AppContext) =>
  c.json({ message: HttpStatusPhrases.FORBIDDEN }, HttpStatusCodes.FORBIDDEN);

export const conflictResponse = (c: AppContext) =>
  c.json({ message: HttpStatusPhrases.CONFLICT }, HttpStatusCodes.CONFLICT);

export const tooManyRequestsResponse = (c: AppContext) =>
  c.json(
    { message: HttpStatusPhrases.TOO_MANY_REQUESTS },
    HttpStatusCodes.TOO_MANY_REQUESTS,
  );

export const notFoundResponse = (c: AppContext) =>
  c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
