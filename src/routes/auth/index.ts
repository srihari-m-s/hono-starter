import env from "@/env";
import { createRouter } from "@/lib/create-app";
import * as handlers from "./handlers";
import * as routes from "./routes";

const router = createRouter()
  .openapi(routes.signUp, handlers.signUp)
  .openapi(routes.login, handlers.login)
  .openapi(routes.logout, handlers.logout)
  .openapi(routes.readSession, handlers.readSession)
  .openapi(routes.listSessions, handlers.listSessionsHandler)
  .openapi(routes.revokeAllSessions, handlers.revokeAllSessions)
  .openapi(routes.revokeSession, handlers.revokeSession)
  .openapi(routes.verifyEmail, handlers.verifyEmail)
  .openapi(routes.resendVerification, handlers.resendVerification)
  .openapi(routes.forgotPassword, handlers.forgotPassword)
  .openapi(routes.resetPassword, handlers.resetPassword)
  .openapi(routes.changePassword, handlers.changePassword);

// Browser entry points for the links in the auth emails. Not part of the
// OpenAPI document because they render HTML rather than JSON.
router.get("/auth/verify_email", handlers.verifyEmailPage);
router.get("/auth/reset_password", handlers.resetPasswordPage);

router.openAPIRegistry.registerComponent("securitySchemes", "Session Cookie", {
  type: "apiKey",
  in: "cookie",
  name: env.AUTH_COOKIE,
});

export default router;
