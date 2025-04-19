import { Scalar } from "@scalar/hono-api-reference";
import packageJSON from "../../package.json";
import type { AppOpenAPI } from "./types";

export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: packageJSON.version,
      title: "Starter API",
    },
  });

  app.get(
    "/reference",
    Scalar({
      url: "/doc",
      layout: "classic",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
    }),
  );
}
