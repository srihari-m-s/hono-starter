import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import { corsMiddleware } from "./middlewares/cors";
import { languageMiddleware } from "./middlewares/language";
import { originCheck } from "./middlewares/origin-check";
import auth from "./routes/auth";
import index from "./routes/index.route";
import notes from "./routes/note";
import users from "./routes/user";

const app = createApp();

const routes = [index, auth, users, notes] as const;

configureOpenAPI(app);

app.use("*", corsMiddleware());
app.use("*", originCheck);
app.use("*", ...languageMiddleware);

routes.forEach((route) => {
  app.route("/", route);
});

export default app;
