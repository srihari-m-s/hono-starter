import env from "@/env";
import { cors } from "hono/cors";

/**
 * CORS for browser clients that live on a different origin.
 *
 * `credentials: true` is required because the session travels in a cookie, and
 * it is only safe because the allowed origins are an explicit allowlist — a
 * wildcard is illegal with credentials anyway. `APP_URL` is always allowed;
 * add your frontend to `ALLOWED_ORIGINS`.
 *
 * Origins that are not on the list simply get no CORS headers, so the browser
 * blocks the response.
 */
export function corsMiddleware() {
  const allowedOrigins = new Set([
    new URL(env.APP_URL).origin,
    ...env.ALLOWED_ORIGINS,
  ]);

  return cors({
    origin: (origin) => (allowedOrigins.has(origin) ? origin : null),
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86_400,
  });
}
