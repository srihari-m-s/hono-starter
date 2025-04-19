import { createRouter } from "../../lib/create-app";
import * as routes from "./routes";
import * as handlers from "./handlers";

const router = createRouter()
  .basePath("/note")
  .openapi(routes.list, handlers.list)
  .openapi(routes.create, handlers.create);

export default router;
