import type { FC } from "./jsx.d.ts";

export function monoRoutes(
  routes: Record<string, FC<any> | Promise<{ default: FC<any> }>>,
  handler: (req: Request) => Response,
): Record<string, (req: Request) => Response>;
