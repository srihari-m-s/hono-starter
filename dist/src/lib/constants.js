import { jsonContent } from "stoker/openapi/helpers";
import { createMessageObjectSchema } from "stoker/openapi/schemas";
import { HttpStatusCodes } from "./http-status-codes";
import { HttpStatusPhrases } from "./http-status-phrases";
export const notFoundSchema = createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND);
export const unauthorizedResponseDef = {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(createMessageObjectSchema(HttpStatusPhrases.UNAUTHORIZED), HttpStatusPhrases.UNAUTHORIZED),
};
export const unauthorizedResponse = (c) => {
    return c.json({ message: HttpStatusPhrases.UNAUTHORIZED }, HttpStatusCodes.UNAUTHORIZED);
};
export const notFoundResponseDef = {
    [HttpStatusCodes.NOT_FOUND]: jsonContent(createMessageObjectSchema(HttpStatusPhrases.NOT_FOUND), HttpStatusPhrases.NOT_FOUND),
};
export const notFoundResponse = (c) => {
    return c.json({ message: HttpStatusPhrases.NOT_FOUND }, HttpStatusCodes.NOT_FOUND);
};
