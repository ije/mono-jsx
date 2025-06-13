import type { FC } from "./types/jsx.d.ts";
import type { RenderOptions } from "./types/render.d.ts";

type ServerHandler = (req: Request) => Response;

/**
 * `buildRoutes` creates a routing map for bun server.
 */
export function buildRoutes(handler: ServerHandler): Record<string, ServerHandler> {
  const { routes = {} } = handler(Symbol.for("mono.setup") as unknown as Request) as unknown as RenderOptions;
  return monoRoutes(routes, handler);
}

/**
 * `monoRoutes` creates a routing map for bun server.
 * @deprecated Use `buildRoutes` instead.
 */
export function monoRoutes(
  routes: Record<string, FC<any> | Promise<{ default: FC<any> }>>,
  handler: ServerHandler,
): Record<string, ServerHandler> {
  const handlers: Record<string, ServerHandler> = {};
  for (const [path, fc] of Object.entries(routes)) {
    handlers[path] = (request: Request): Response => {
      Reflect.set(request, "x-route", fc);
      return handler(request);
    };
  }
  return handlers;
}
