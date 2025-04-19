import env from '@/env';
import { createRouter } from '@/lib/create-app';
import * as handlers from './users.handlers';
import * as routes from './users.routes';
const router = createRouter()
    .openapi(routes.signUp, handlers.signUp)
    .openapi(routes.login, handlers.login)
    .openapi(routes.list, handlers.list)
    .openapi(routes.getOne, handlers.getOne)
    .openapi(routes.patch, handlers.patch)
    .openapi(routes.remove, handlers.remove)
    .openapi(routes.forgotPassword, handlers.forgotPassword)
    .openapi(routes.resetPassword, handlers.resetPassword);
router.openAPIRegistry.registerComponent('securitySchemes', 'Cookie Auth', {
    type: 'apiKey',
    in: 'cookie',
    name: env.AUTH_COOKIE,
});
export default router;
