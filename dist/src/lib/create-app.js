import { OpenAPIHono } from "@hono/zod-openapi";
import { notFound, serveEmojiFavicon } from "stoker/middlewares";
import { handleError } from "@/middlewares/handle-error";
import { usePinoLogger } from "@/middlewares/pino-logger";
import { defaultHook } from "stoker/openapi";
export function createRouter() {
    return new OpenAPIHono({
        strict: false,
        defaultHook: defaultHook,
    });
}
export default function createApp() {
    const app = createRouter();
    app.use(serveEmojiFavicon("💲"));
    app.use(usePinoLogger());
    app.notFound(notFound);
    app.onError(handleError);
    return app;
}
