import type { authTokensTable } from "@/db/schema/auth-token";
import type { sessionsTable } from "@/db/schema/session";
import type { usersTable } from "@/db/schema/user";
import {
  OpenAPIHono,
  type RouteConfig,
  type RouteHandler,
} from "@hono/zod-openapi";
import { PinoLogger } from "hono-pino";

export type User = typeof usersTable.$inferSelect;
export type PublicUser = Omit<User, "password">;
export type Session = typeof sessionsTable.$inferSelect;
export type AuthToken = typeof authTokensTable.$inferSelect;
export type { UserRole } from "@/db/schema/user";

/**
 * The part of Bun's `Server` object this app relies on.
 *
 * Bun passes the server as the second argument to `fetch`, and Hono surfaces
 * that argument as `c.env`. `requestIP` is the real TCP peer address, which —
 * unlike `X-Forwarded-For` — a client cannot forge.
 */
export interface BunServer {
  requestIP?: (request: Request) => { address: string } | null;
}

export interface AppBindings {
  Bindings: {
    /** Bun's server, as passed by `fetch: app.fetch`. */
    requestIP?: BunServer["requestIP"];
    /** Bun's server, as passed by the explicit `app.fetch(request, { server })` form. */
    server?: BunServer;
  };
  Variables: {
    logger: PinoLogger;
    /** Set by `authMiddleware` on authenticated requests. */
    user: PublicUser;
    /** The session backing the current request. */
    session: Session;
  };
}

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
  R,
  AppBindings
>;
