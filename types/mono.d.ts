import type { AsyncComponentAttributes, BaseAttributes, ComponentType, MaybeGetter, WithParams } from "./jsx.d.ts";

export interface Elements {
  /**
   * The `<component>` element is used to load components lazily,
   * which can improve performance by reducing the initial load time of the application.
   * @mono-jsx
   */
  component: BaseAttributes & AsyncComponentAttributes & {
    /**
     * The name of the component to render.
     */
    name?: string;
    /**
     * The component to render.
     */
    is?: ComponentType<any>;
    /**
     * The element to render.
     */
    as?: JSX.Element;
    /**
     * The props of the component to render.
     */
    props?: Record<string, unknown>;
    /**
     * The ref of the component.
     */
    ref?: ComponentElement | ((el: ComponentElement) => void);

    /**
     * Enables view transition for the children.
     */
    viewTransition?: string | boolean;
  };

  /**
   * The `<router>` element provides SPA routing.
   * @mono-jsx
   */
  router: BaseAttributes & AsyncComponentAttributes & {
    /**
     * The base URL for the router.
     */
    base?: string;
    /**
     * The ref of the router.
     */
    ref?: RouterElement | ((el: RouterElement) => void);
    /**
     * Enables view transition for the children.
     * @mono-jsx
     */
    viewTransition?: string | boolean;
  };

  /**
   * The `<cache>` element caches the rendered content of the child nodes
   * with the given key and TTL.
   * @mono-jsx
   */
  cache: BaseAttributes & {
    /**
     * The key of the cache.
     */
    key?: string;
    /**
     * The maximum age of the cache in seconds.
     */
    maxAge?: number;
  };

  /**
   * The `<static>` element treats the child nodes as static content,
   * When the child nodes are rendered once, they will be cached in memory and reused on subsequent renders.
   * @mono-jsx
   */
  static: BaseAttributes;

  /**
   * The `<redirect>` element redirects to the given URL in the client side.
   * @mono-jsx
   */
  redirect: {
    /**
     * The redirect URL.
     */
    to?: string | URL;
    /**
     * The replace behavior of the redirect.
     * Only works when the `router` element is used.
     */
    replace?: boolean;
  };

  /**
   * The `<invalid>` element sets custom validation
   * state for the form elements.
   * @mono-jsx
   */
  invalid: BaseAttributes & {
    /**
     * Which form elements to set the custom validation state for.
     */
    for?: string;
  };

  /**
   * The `<formslot>` element is used to display the content of the route form
   * in the `form` element.
   * @mono-jsx
   */
  formslot: BaseAttributes & {
    /**
     * The name of the formslot element.
     */
    name?: string;
    /**
     * The insert mode of the formslot.
     * - "insertbefore": Insert HTML before the formslot element.
     * - "insertafter": Insert HTML after the formslot element.
     * - "replaceChildren": Replace the formslot element's children with the HTML.
     * @default "replaceChildren"
     */
    mode?: "insertbefore" | "insertafter" | "replaceChildren";

    /**
     * If true, the formslot element will be hidden.
     */
    hidden?: boolean;

    /**
     * The callback function to be called when the formslot element is updated.
     */
    onUpdate?: (evt: { type: "update"; target: HTMLElement }) => void | Promise<void>;
  };
}

/**
 * The `<component>` element.
 */
export type ComponentElement = {
  name: string;
  props: Record<string, unknown> | undefined;
  refresh: () => Promise<void>;
};

/**
 * The options for the `navigate` method of the `<router>` element.
 */
export type RouterNavigateOptions = {
  /**
   * If true, `history.replaceState` will be called instead of `history.pushState`.
   * This is useful when you want to replace the current navigation without adding a new entry to the history.
   */
  replace?: boolean;
  /**
   * If true, the router will ignore the cache and fetch the page HTML from the server.
   */
  refresh?: boolean;
};

/**
 * The `<router>` element.
 */
export type RouterElement = {
  /**
   * Navigates to the given URL.
   */
  navigate: (url: string | URL, options?: RouterNavigateOptions) => Promise<void>;
};

/**
 * The session storage API.
 */
export interface Session {
  /**
   * The session ID.
   */
  readonly sessionId: string;
  /**
   * If true, update the session cookie to the client.
   */
  readonly isDirty: boolean;
  /**
   * If true, the session is expired.
   */
  readonly isExpired: boolean;
  /**
   * Gets a value from the session.
   */
  get<T = unknown>(key: string): T | undefined;
  /**
   * Gets all the entries from the session.
   */
  all(): Record<string, unknown>;
  /**
   * Sets a value in the session.
   */
  set(key: string, value: string | number | boolean | any[] | Record<string, unknown>): void;
  /**
   * Deletes a value from the session.
   */
  delete(key: string): void;
  /**
   * Destroys the session.
   */
  destroy(): void;
}

/**
 * Mono request type.
 * It is a extended request object with the parsed `URL` object and the optional `params` property.
 */
export type MonoRequest = WithParams<Request & { URL: URL }>;

declare global {
  interface FCExtension<FC> {
    /**
     * The global signals shared across the application.
     */
    readonly app: {
      /**
       * The `app.refs` stores variables in the application scope.
       * It is similar to `refs`, but it is shared across all components in the application.
       *
       * **⚠ This is a client-side only API.**
       */
      readonly refs: Record<string, HTMLElement>;
      /**
       * The `app.url` represents the current URL.
       */
      readonly url: WithParams<URL>;
    };
    /**
     * The `request` represents the current request.
     *
     * **⚠ This is a server-side only API.**
     */
    readonly request: MonoRequest;
    /**
     * The `context` represents the current context.
     *
     * **⚠ This is a server-side only API.**
     */
    readonly context: Record<string, unknown>;
    /**
     * The `session` represents the current session.
     *
     * **⚠ This is a server-side only API.**
     */
    readonly session: Session;
  }

  /**
   * The `RPC` represents the current RPC request context.
   */
  interface RPC<Context extends Record<string, unknown> = {}> {
    /**
     * The `request` represents the current request.
     *
     * **⚠ This is a server-side only API.**
     */
    request: Request;
    /**
     * The `context` represents the current context.
     *
     * **⚠ This is a server-side only API.**
     */
    context: Context;
    /**
     * The `session` represents the current session.
     *
     * **⚠ This is a server-side only API.**
     */
    session: Session;
  }

  /**
   * Defines the `this.app` type.
   */
  type WithAppSignals<T, AppSignals = {}, AppRefs extends Record<string, HTMLElement> = Record<string, HTMLElement>> = T extends
    FC<infer S, infer R> ? FC<S, R> & {
      /**
       * The global signals shared across the application.
       */
      readonly app: {
        /**
         * The `app.refs` stores variables in the application scope.
         * It is similar to `refs`, but it is shared across all components in the application.
         *
         * **⚠ This is a client-side only API.**
         */
        readonly refs: AppRefs;
        /**
         * The `app.url` represents the current URL.
         */
        readonly url: WithParams<URL>;
      } & Omit<AppSignals, "refs" | "url">;
    }
    : never;

  /**
   * Defines the `this.context` type.
   */
  type WithContext<T, Context extends Record<string, unknown>> = T extends FC<infer S, infer R> ? FC<S, R> & {
      /**
       * The rendering context object.
       *
       * **⚠ This is a server-side only API.**
       */
      readonly context: Context;
    }
    : T extends RPC ? RPC & {
        readonly context: Context;
      }
    : never;
}

export type { AsyncComponentAttributes, BaseAttributes, MaybeGetter };
