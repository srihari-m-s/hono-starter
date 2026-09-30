import env from "@/env";
import { unauthorizedResponse } from "@/lib/constants";
import { getSessionByToken } from "@/lib/session";
import type { AppBindings } from "@/lib/types";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";

/**
 * Where the session token comes from.
 *
 * Browsers use the httpOnly cookie. The `Authorization: Bearer` fallback
 * exists so non-browser clients (mobile apps, scripts, other services) can
 * authenticate without cookie handling.
 */
export function extractSessionToken(c: Context<AppBindings>) {
  const fromCookie = getCookie(c, env.AUTH_COOKIE);
  if (fromCookie) return fromCookie;

  const header = c.req.header("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice("bearer ".length).trim();
  }

  return undefined;
}

/**
 * Authenticates the request and exposes the caller on the context.
 *
 * Downstream handlers read `c.get("user")` / `c.get("session")`. Because the
 * session is a database row, a token that has been revoked stops working
 * immediately instead of lingering until an expiry timestamp.
 */
export const authMiddleware: MiddlewareHandler<AppBindings> = async (
  c,
  next,
) => {
  const token = extractSessionToken(c);
  if (!token) return unauthorizedResponse(c);

  const authenticated = await getSessionByToken(token);
  if (!authenticated) return unauthorizedResponse(c);

  c.set("user", authenticated.user);
  c.set("session", authenticated.session);

  await next();
};
