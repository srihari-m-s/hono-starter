import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import index from "@/routes/index.route";
import users from "./routes/user";
import notes from "./routes/note";
import { languageMiddleware } from "./middlewares/language";

const app = createApp();

const routes = [index, users, notes] as const;

configureOpenAPI(app);

app.use("*", ...languageMiddleware);

routes.forEach((route) => {
  app.route("/", route);
});

export default app;
