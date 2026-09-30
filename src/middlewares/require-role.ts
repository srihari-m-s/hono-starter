import { forbiddenResponse } from "@/lib/constants";
import type { AppBindings, UserRole } from "@/lib/types";
import type { MiddlewareHandler } from "hono";

/**
 * Authorization gate. Must run after `authMiddleware` (which
 * `createPrivateRoute` guarantees), since it reads the caller off the context.
 *
 * @example
 * createPrivateRoute({
 *   path: "/admin/thing",
 *   middleware: [requireRole("admin")],
 *   ...
 * })
 */
export function requireRole(
  ...roles: UserRole[]
): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const user = c.get("user");

    if (!user || !roles.includes(user.role)) {
      return forbiddenResponse(c);
    }

    await next();
  };
}
