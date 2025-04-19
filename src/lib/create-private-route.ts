import { authMiddleware } from "@/middlewares/auth";
import { createRoute, type RouteConfig } from "@hono/zod-openapi";
import { unauthorizedResponseDef } from "./constants";

type RoutingPath<
  P extends string,
  Depth extends unknown[] = [],
> = Depth["length"] extends 20 // limit depth to 20
  ? P
  : P extends `${infer Head}/{${infer Param}}${infer Tail}`
    ? `${Head}/:${Param}${RoutingPath<Tail, [unknown, ...Depth]>}`
    : P;

/**
 * Creates a private route configuration by applying authorization middleware and adding a default unauthorized response.
 *
 * @template P - Type of the path string with placeholders for URL parameters.
 * @template R - Type of the route configuration object extending `RouteConfig`.
 *
 * @param {R} props - The route configuration properties, including path and optionally other middleware or response definitions.
 * @returns {R & { getRoutingPath(): RoutingPath<R['path']> }} - The modified route configuration with additional middleware
 *                                                              and unauthorized response, along with a helper to generate
 *                                                              a routing path.
 *
 * @example
 * const privateRoute = createPrivateRoute({
 *   path: '/users/{userId}/details',
 *   middleware: [customLogger],
 *   responses: { ...someResponseDefinitions },
 * });
 *
 * const routePath = privateRoute.getRoutingPath(); // '/users/:userId/details'
 */
export function createPrivateRoute<
  P extends string,
  R extends Omit<RouteConfig, "path"> & { path: P },
>(
  props: R,
): R & {
  getRoutingPath(): RoutingPath<R["path"]>;
} {
  const privateRouteMiddlewares = props.middleware
    ? Array.isArray(props.middleware)
      ? [authMiddleware, ...props.middleware]
      : [authMiddleware, props.middleware]
    : authMiddleware;

  const routeConfigWithMiddleware: R = {
    ...props,
    middleware: privateRouteMiddlewares,
    responses: {
      ...props.responses,
      ...unauthorizedResponseDef,
    },
  };

  return createRoute(routeConfigWithMiddleware) as R & {
    getRoutingPath(): RoutingPath<R["path"]>;
  };
}
