/// <reference path="./htmx.d.ts" />

import type { FC } from "./jsx.d.ts";

export type MaybeModule<T> = T | Promise<{ default: T }>;

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

/**
 * Cookie options for mono-jsx.
 */
export type CookieOptions = {
  /**
   * The name of the cookie.
   */
  name?: string;
  /**
   * The domain of the cookie.
   */
  domain?: string;
  /**
   * The path of the cookie.
   */
  path?: string;
  /**
   * The expires date of the cookie.
   */
  expires?: Date;
  /**
   * The max age of the cookie in seconds. If `expires` is provided, this option is ignored.
   */
  maxAge?: number;
  /**
   * The secure policy of the cookie.
   */
  secure?: boolean;
  /**
   * The same site policy of the cookie.
   */
  sameSite?: "lax" | "strict" | "none";
  /**
   * The secret is used to sign the cookie.
   */
  secret?: string;
};

/**
 * Session options for the `session` middleware.
 */
export type SessionOptions = {
  /**
   * The cookie options to be used by the session.
   */
  cookie?: CookieOptions;
  // TODO: add session store options
};

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
  components?: Record<string, MaybeModule<FC<any>>>;
  /**
   * Routes to be used by the `<router>` element.
   */
  routes?: Record<string, MaybeModule<FC<any>>>;
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
   * The session options to be used by the session.
   */
  session?: SessionOptions;
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
