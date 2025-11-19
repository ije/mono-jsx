import type { AsyncComponentAttributes, BaseAttributes } from "./jsx.d.ts";

export type WithParams<T> = T & { params?: Record<string, string> };

export interface Elements {
  /**
   * A built-in element of mono-jsx that toggles the visibility of its children.
   * @mono-jsx
   */
  toggle: BaseAttributes & {
    /**
     * The visibility of the children.
     */
    show?: any;
    /**
     * The visibility of the children.
     */
    hidden?: any;

    /**
     * Enables view transition for the children.
     */
    viewTransition?: string | boolean;
  };

  /**
   * A a built-in element of mono-jsx that chooses one of its children based on the `slot` attribute to display.
   * It is similar to a switch statement in programming languages.
   * @mono-jsx
   */
  switch: BaseAttributes & {
    /**
     * Which child to display.
     */
    value?: string | number | boolean | null;

    /**
     * Enables view transition for the children.
     */
    viewTransition?: string | boolean;
  };

  /**
   * A built-in element of mono-jsx that is used to load components lazily,
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
    is?: import("./jsx.d.ts").FC<any>;
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
   * A built-in element of mono-jsx that provides SPA routing.
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
   * A built-in element of mono-jsx that caches the rendered content of the child nodes
   * with the given key and TTL.
   * @mono-jsx
   */
  cache: BaseAttributes & {
    /**
     * The key of the cache.
     */
    key?: string;
    /**
     * The time-to-live of the cache in seconds.
     */
    ttl?: number;
  };

  /**
   * A built-in element of mono-jsx that treats the child nodes as static content,
   * When the child nodes are rendered once, they will be cached in memory and reused on subsequent renders.
   * @mono-jsx
   */
  static: BaseAttributes;

  /**
   * A built-in element of mono-jsx that redirects to the given URL in the client side.
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
   * A built-in element of mono-jsx that sets custom validation
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
   * A built-in element of mono-jsx that is used to display the content of the route form
   * in the `form` element.
   * @mono-jsx
   */
  formslot: BaseAttributes & {
    /**
     * The insert position of the formslot.
     */
    mode?: "insertbefore" | "insertafter" | "replace";
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
 * The `<router>` element.
 */
export type RouterElement = {
  navigate: (url: string | URL, options?: { replace?: boolean }) => Promise<void>;
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

declare global {
  /**
   *  Defines the Signals/Context/Refs types.
   */
  type FC<Signals = {}, AppSignals = {}, Context = {}, Refs = {}, AppRefs = {}> = {
    /**
     * Initializes the signals.
     */
    readonly init: (initValue: Signals) => void;
    /**
     * The global signals shared across the application.
     */
    readonly app: {
      /**
       * The `app.refs` object stores variables in the application scope.
       * It is similar to `refs`, but it is shared across all components in the application.
       *
       * **⚠ This is a client-side only API.**
       */
      readonly refs: AppRefs;
      /**
       * The `app.url` object contains the current URL.
       */
      readonly url: WithParams<URL>;
    } & Omit<AppSignals, "refs" | "url">;
    /**
     * The rendering context object.
     *
     * **⚠ This is a server-side only API.**
     */
    readonly context: Context;
    /**
     * The `request` object contains the current request.
     *
     * **⚠ This is a server-side only API.**
     */
    readonly request: WithParams<
      Request & {
        /**
         * Returns the URL of the request as a URL object.
         */
        URL: URL;
      }
    >;
    /**
     * The `form` object created by the route form.
     *
     * **⚠ This is a server-side only API.**
     */
    readonly form?: FormData;
    /**
     * The `session` object contains the current session.
     *
     * **⚠ This is a server-side only API.**
     */
    readonly session: Session;
    /**
     * The `refs` object stores variables in clide side.
     *
     * **⚠ This is a client-side only API.**
     */
    readonly refs: Refs;
    /**
     * Creates a computed signal.
     */
    readonly computed: <T = unknown>(fn: () => T) => T;
    /**
     * A shortcut for `this.computed(fn)`.
     */
    readonly $: FC["computed"];
    /**
     * Creates a side effect.
     * **The effect function is only called on client side.**
     */
    readonly effect: (fn: () => (() => void) | void) => void;
  } & Omit<Signals, "init" | "app" | "context" | "request" | "session" | "form" | "refs" | "computed" | "$" | "effect">;

  /**
   * Defines the `context` type.
   */
  type Context<T, C = {}> = T extends FC<infer S, infer A, infer _, infer R, infer RR> ? FC<S, A, C, R, RR> : never;

  /**
   *  Defines the `refs` type.
   */
  type Refs<T, R = {}, RR = {}> = T extends FC<infer S, infer A, infer C> ? FC<S, A, C, R, RR> : never;
}
