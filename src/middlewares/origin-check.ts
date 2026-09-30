import env from "@/env";
import { forbiddenResponse } from "@/lib/constants";
import type { AppBindings } from "@/lib/types";
import type { MiddlewareHandler } from "hono";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Rejects state-changing requests from unexpected origins.
 *
 * Cookie auth is attached to the request automatically by the browser, so a
 * hostile page could otherwise trigger writes on a logged-in user's behalf.
 * `SameSite=Lax` on the session cookie already blocks the classic form-POST
 * CSRF; this is the second layer, and it also documents the origins your API
 * is willing to serve.
 *
 * Requests with no `Origin` header (curl, server-to-server, same-origin
 * navigations) are allowed through — browsers always send `Origin` on the
 * cross-origin requests we care about.
 */
export const originCheck: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (!STATE_CHANGING_METHODS.has(c.req.method)) return next();

  const origin = c.req.header("origin");
  if (!origin) return next();

  const allowed = new Set([new URL(env.APP_URL).origin, ...env.ALLOWED_ORIGINS]);
  if (!allowed.has(origin)) return forbiddenResponse(c);

  await next();
};
