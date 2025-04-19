import env from "@/env";
import type { Context, Next } from "hono";
import { jwt } from "hono/jwt";

export const authMiddleware = (c: Context, next: Next) => {
  const jwtMiddleware = jwt({
    secret: env.AUTH_SECRET,
    cookie: env.AUTH_COOKIE,
  });

  return jwtMiddleware(c, next);
};
