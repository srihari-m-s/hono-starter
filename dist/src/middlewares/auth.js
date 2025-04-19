import env from "@/env";
import { jwt } from "hono/jwt";
export const authMiddleware = (c, next) => {
    const jwtMiddleware = jwt({
        secret: env.AUTH_SECRET,
        cookie: env.AUTH_COOKIE,
    });
    return jwtMiddleware(c, next);
};
