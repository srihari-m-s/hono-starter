import env from "@/env";
import { tooManyRequestsResponse } from "@/lib/constants";
import { createRateLimiter, type RateLimitOptions } from "@/lib/rate-limit";
import type { AppBindings, BunServer } from "@/lib/types";
import type { Context, MiddlewareHandler } from "hono";

/**
 * Reads the socket peer address from Bun's server object.
 *
 * `Bun.Server.requestIP` has to be invoked on the server itself — it is a host
 * method that checks its receiver — so the call is made on the owning object
 * rather than on a copied function reference.
 */
function requestIpFrom(
  c: Context<AppBindings>,
  request: Request,
): string | undefined {
  const bindings = c.env as
    | { requestIP?: BunServer["requestIP"]; server?: BunServer }
    | undefined;

  if (!bindings) return undefined;

  // Wired as `app.fetch(request, { server })`.
  const server = bindings.server;
  if (server && typeof server.requestIP === "function") {
    return server.requestIP(request)?.address;
  }

  // Wired as `fetch: app.fetch`, where Hono surfaces Bun's server as `c.env`.
  if (typeof bindings.requestIP === "function") {
    return bindings.requestIP(request)?.address;
  }

  return undefined;
}

/**
 * Resolves the client address used for rate limiting and session auditing.
 *
 * The socket peer address is the only value here a client cannot choose, so it
 * is the default. `X-Forwarded-For` is consulted **only** when
 * `TRUST_PROXY_HOPS` says a proxy you control appended to it, and the entry is
 * read from the right-hand end — the left end is attacker-supplied, and the
 * usual `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` idiom
 * appends rather than replaces.
 */
export function clientIp(
  c: Context<AppBindings>,
  trustProxyHops = env.TRUST_PROXY_HOPS,
): string {
  if (trustProxyHops > 0) {
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) {
      const entries = forwarded
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      const client = entries[entries.length - trustProxyHops];
      if (client) return client;
    }
  }

  const socketAddress = requestIpFrom(c, c.req.raw);
  if (socketAddress) return socketAddress;

  // Nothing trustworthy to key on. Every such caller shares one bucket, which
  // is the safe direction to fail: it throttles rather than lets through.
  return "unknown";
}

/**
 * Sliding-window rate limit, keyed by client IP and a prefix.
 *
 * Applied to the credential endpoints (login, signup, password reset) so a
 * single IP cannot grind through passwords or spam reset emails.
 */
export function rateLimit(
  options: RateLimitOptions & {
    keyPrefix: string;
    trustProxyHops?: number;
  },
): MiddlewareHandler<AppBindings> {
  const limiter = createRateLimiter(options);

  return async (c, next) => {
    const key = `${options.keyPrefix}:${clientIp(c, options.trustProxyHops)}`;
    const result = limiter.check(key);

    c.header("X-RateLimit-Limit", String(options.max));
    c.header("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      c.header("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
      return tooManyRequestsResponse(c);
    }

    await next();
  };
}
