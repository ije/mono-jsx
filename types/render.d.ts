import type { FC } from "./jsx.d.ts";

/**
 * Htmx extensions.
 * @see https://htmx.org/docs/#extensions
 */
type HtmxExts = {
  [key in `htmx-ext-${JSX.HtmxExtensions[keyof JSX.HtmxExtensions]}`]:
    | number
    | string
    | boolean;
};

export type FCModule = FC<any> | Promise<{ default: FC<any> }>;

/**
 * Render options for the `render` function.
 */
export interface RenderOptions extends Partial<HtmxExts> {
  /**
   * Initial signals of the application.
   */
  app?: Record<string, unknown>;
  /**
   * The context object to be passed to components.
   */
  context?: Record<string, unknown>;
  /**
   * Components to be rendered by the `<lazy>` element.
   */
  components?: Record<string, FCModule>;
  /**
   * Routes to be used by the `<router>` element.
   */
  routes?: Record<string, FCModule>;
  /**
   * Current `Request` object to be passed to components.
   */
  request?: Request;
  /**
   * The HTTP status code to be sent with the response.
   * @defaultValue `200`
   */
  status?: number;
  /**
   * The HTTP headers to be sent with the response.
   */
  headers?: {
    [key: string]: string | undefined;
    contentSecurityPolicy?: string;
    cacheControl?: "public, max-age=31536000, immutable" | "public, max-age=0, must-revalidate" | (string & {});
    etag?: string;
    lastModified?: string;
    setCookie?: string;
  };
  /**
   * Install htmx script with the given version.
   * @see https://htmx.org/
   * @defaultValue `false`
   */
  htmx?: number | string | boolean;
}
