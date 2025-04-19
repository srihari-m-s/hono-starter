import { unauthorizedResponse } from "@/lib/constants";
import { HttpStatusCodes } from "@/lib/http-status-codes";
import { onError } from "stoker/middlewares";
/**
 * Error handler middleware to handle errors and provide a custom response based on the error status.
 *
 * @param {Error} err - The error object that triggered this handler.
 * @param {Context} c - The Hono context object representing the request and response.
 * @returns {Response} - A custom unauthorized response if the error status is 401 (UNAUTHORIZED),
 *                       otherwise it calls a generic error handler.
 *
 * @throws {Error} - Rethrows the error if the default `onError` handler doesn't handle it.
 *
 * @example
 * // Usage in a Hono app setup:
 * app.use('*', handleError);
 */
export const handleError = (err, c) => {
    const currentStatus = "status" in err ? err.status : undefined;
    if (currentStatus === HttpStatusCodes.UNAUTHORIZED) {
        return unauthorizedResponse(c);
    }
    else {
        return onError(err, c);
    }
};
