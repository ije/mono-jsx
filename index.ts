import type { RenderOptions } from "./types/render.d.ts";

type ServerHandler = (req: Request) => Response;

/**
 * `buildRoutes` creates a routing map for bun server.
 */
export function buildRoutes(handler: ServerHandler): Record<string, ServerHandler> {
  const { routes = {} } = handler(Symbol.for("mono.setup") as unknown as Request) as unknown as RenderOptions;
  const handlers: Record<string, ServerHandler> = {};
  for (const [path, fc] of Object.entries(routes)) {
    handlers[path] = (request: Request): Response => {
      Reflect.set(request, "routeFC", fc);
      return handler(request);
    };
  }
  return handlers;
}

let rpcIndex = 0;

export function createRPC<V extends Record<string, (...args: any[]) => any>>(
  rpcFunctions: V,
): { [K in keyof V]: (...args: Parameters<V[K]>) => Promise<Awaited<ReturnType<V[K]>>> } {
  for (const [key, value] of Object.entries(rpcFunctions)) {
    if (typeof value !== "function") {
      throw new Error(`createRPC: ${key} is not a function`);
    }
  }
  Reflect.set(rpcFunctions, Symbol.for("mono.rpc"), rpcIndex++);
  return rpcFunctions;
}
