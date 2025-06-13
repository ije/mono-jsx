import type { FC } from "./jsx.d.ts";

/**
 * `buildRoute` creates a routing map for bun server.
 */
export function buildRoute(
  handler: (req: Request) => Response,
): Record<string, (req: Request) => Response>;

/**
 * `monoRoutes` creates a routing map for bun server.
 * @deprecated Use `buildRoute` instead.
 */
export function monoRoutes(
  routes: Record<string, FC<any> | Promise<{ default: FC<any> }>>,
  handler: (req: Request) => Response,
): Record<string, (req: Request) => Response>;
