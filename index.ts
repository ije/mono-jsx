import type { FC } from "./types/jsx.d.ts";

type ServerHandler = (req: Request) => Response;

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
