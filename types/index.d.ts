import type { FC } from "./jsx.d.ts";

/**
 * `createRoutes` creates a routing map for bun server.
 */
export function createRoutes(
  handler: (req: Request) => Response,
): Record<string, (req: Request) => Response>;

/**
 * `monoRoutes` creates a routing map for bun server.
 * @deprecated Use `createRoutes` instead.
 */
export function monoRoutes(
  routes: Record<string, FC<any> | Promise<{ default: FC<any> }>>,
  handler: (req: Request) => Response,
): Record<string, (req: Request) => Response>;
