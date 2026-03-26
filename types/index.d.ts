/**
 * `buildRoutes` creates a routing map for bun server.
 */
export function buildRoutes(
  handler: (req: Request) => Response,
): Record<string, (req: Request) => Response>;

export function createRPC<V extends Record<string, (...args: any[]) => any>>(
  rpcFunctions: V,
): { [K in keyof V]: (...args: Parameters<V[K]>) => Promise<Awaited<ReturnType<V[K]>>> };
