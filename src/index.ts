import app from "./app.js";
import env from "./env.js";

const port = env.PORT;

console.log(`Server is running on port http://localhost:${port}`);

Bun.serve({
  fetch: app.fetch,
  port,
});