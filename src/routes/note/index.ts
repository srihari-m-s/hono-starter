import { createRouter } from "../../lib/create-app";
import * as routes from "./routes";
import * as handlers from "./handlers";

const router = createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.create, handlers.create)
  .openapi(routes.read, handlers.read)
  .openapi(routes.patch, handlers.patch)
  .openapi(routes.remove, handlers.remove);

export default router;
