import type { FC } from "./types/jsx.d.ts";
import type { RenderOptions } from "./types/render.d.ts";

type ServerHandler = (req: Request) => Response;

/**
 * `createRoutes` creates a routing map for bun server.
 */
export function createRoutes(handler: ServerHandler): Record<string, ServerHandler> {
  const { routes = {} } = handler(Symbol.for("mono.peek") as unknown as Request) as unknown as RenderOptions;
  return monoRoutes(routes, handler);
}

/**
 * `monoRoutes` creates a routing map for bun server.
 * @deprecated Use `createRoutes` instead.
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
