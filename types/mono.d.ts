import type * as CSS from "./css.d.ts";

type D9 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type D100 = 0 | D9 | `${D9}${0 | D9}` | 100;

export interface BaseCSSProperties extends CSS.Properties<string | number> {
  /**
   * The field-sizing CSS property enables you to control the sizing behavior of elements that are given a default preferred size, such as form control elements. This property enables you to override the default sizing behavior, allowing form controls to adjust in size to fit their contents.
   * @see https://developer.mozilla.org/docs/Web/CSS/field-sizing
   */
  fieldSizing?: "fixed" | "content";
  /**
   * The view-transition-class CSS property provides the selected elements with an identifying class (a <custom-ident>), providing an additional method of styling the view transitions for those elements.
   * @see https://developer.mozilla.org/docs/Web/CSS/view-transition-class
   */
  viewTransitionClass?: string;
  /**
   * The view-transition-name CSS property specifies the view transition snapshot that selected elements will participate in, which enables an element to be animated separately from the rest of the page during a view transition.
   * @see https://developer.mozilla.org/docs/Web/CSS/view-transition-name
   */
  viewTransitionName?: string;
}

export interface AtRuleCSSProperties {
  [key: `@container${" " | "("}${string}`]: BaseCSSProperties;
  [key: `@media${" " | "("}${string}`]: BaseCSSProperties;
  [key: `@supports${" " | "("}${string}`]: BaseCSSProperties;
  [key: `@keyframes ${string}`]: {
    [key in "from" | "to" | `${D100}%`]?: BaseCSSProperties;
  };
  "@view-transition"?: {
    /**
     * Specifies the effect this at-rule will have on the document's view transition behavior.
     */
    navigation?: "auto" | "none";
  };
}

export interface PseudoCSSProperties {
  ":active"?: BaseCSSProperties;
  ":link"?: BaseCSSProperties;
  ":visited"?: BaseCSSProperties;
  ":checked"?: BaseCSSProperties;
  ":disabled"?: BaseCSSProperties;
  ":enable"?: BaseCSSProperties;
  ":empty"?: BaseCSSProperties;
  ":first"?: BaseCSSProperties;
  ":first-child"?: BaseCSSProperties;
  ":first-of-type"?: BaseCSSProperties;
  ":focus"?: BaseCSSProperties;
  ":focus-visible"?: BaseCSSProperties;
  ":focus-within"?: BaseCSSProperties;
  ":fullscreen"?: BaseCSSProperties;
  ":hover"?: BaseCSSProperties;
  ":in-range"?: BaseCSSProperties;
  ":out-of-range"?: BaseCSSProperties;
  ":indeterminate"?: BaseCSSProperties;
  ":invalid"?: BaseCSSProperties;
  ":last-child"?: BaseCSSProperties;
  ":last-of-type"?: BaseCSSProperties;
  ":only-child"?: BaseCSSProperties;
  ":only-of-type"?: BaseCSSProperties;
  ":optional"?: BaseCSSProperties;
  "::after"?: BaseCSSProperties;
  "::backdrop"?: BaseCSSProperties;
  "::before"?: BaseCSSProperties;
  "::first-letter"?: BaseCSSProperties;
  "::first-line"?: BaseCSSProperties;
  "::placeholder"?: BaseCSSProperties;
  "::selection"?: BaseCSSProperties;
  "::view-transition"?: BaseCSSProperties;
  [key: `:has(${string})`]: BaseCSSProperties;
  [key: `:is(${string})`]: BaseCSSProperties;
  [key: `:lang(${string})`]: BaseCSSProperties;
  [key: `:not(${string})`]: BaseCSSProperties;
  [key: `:nth-child(${string})`]: BaseCSSProperties;
  [key: `:nth-last-child(${string})`]: BaseCSSProperties;
  [key: `:nth-of-type(${string})`]: BaseCSSProperties;
  [key: `::view-transition-group(${string})`]: BaseCSSProperties;
  [key: `::view-transition-image-pair(${string})`]: BaseCSSProperties;
  [key: `::view-transition-new(${string})`]: BaseCSSProperties;
  [key: `::view-transition-old(${string})`]: BaseCSSProperties;
}

export interface CSSProperties extends BaseCSSProperties, AtRuleCSSProperties, PseudoCSSProperties {
  [key: `--${string}`]: string | number;
  [key: `&${" " | "." | "[" | ">"}${string}`]: CSSProperties;
}

export type MaybeArray<T> = T | T[];
export type ChildType = MaybeArray<JSX.Element | string | number | bigint | boolean | null | undefined>;
export type WithParams<T> = T & { params?: Record<string, string> };

export interface BaseAttributes {
  children?: MaybeArray<ChildType>;
  key?: string | number;
  /**
   * The `slot` attribute assigns a slot in a [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) shadow tree to an element: An element with a `slot` attribute is assigned to the slot created by the `<slot>` element whose name attribute's value matches that slot attribute's value.
   */
  slot?: string;
}

export interface AsyncComponentAttributes {
  /**
   * Catch errors in an async component.
   */
  catch?: (err: any) => JSX.Element;
  /**
   * The loading spinner for an async component.
   */
  placeholder?: JSX.Element;
  /**
   * Rendering mode of an async component.
   * - `eager`: render async components eagerly
   */
  rendering?: "eager";
}

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
   * Creates XSS-unsafed HTML content.
   */
  var html: JSX.Raw;
  /**
   * An alias to `html`.
   */
  var css: JSX.Raw;
  /**
   * An alias to `html`.
   */
  var js: JSX.Raw;
  /**
   *  Defines the Signals/Context/Refs types.
   */
  type FC<Signals = {}, AppSignals = {}, Context = {}, Refs = {}, AppRefs = {}> = {
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
    readonly effect: (fn: () => void | (() => void)) => void;
  } & Omit<Signals, "app" | "context" | "request" | "session" | "form" | "refs" | "computed" | "$" | "effect">;
  /**
   *  Defines the `refs` type.
   */
  type Refs<T, R = {}, RR = {}> = T extends FC<infer S, infer A, infer C> ? FC<S, A, C, R, RR> : never;
  /**
   * Defines the `context` type.
   */
  type Context<T, C = {}> = T extends FC<infer S, infer A, infer _, infer R, infer RR> ? FC<S, A, C, R, RR> : never;
  /**
   * The `<component>` element.
   */
  type ComponentElement = {
    name: string;
    props: Record<string, unknown> | undefined;
    refresh: () => Promise<void>;
  };
  /**
   * The `<router>` element.
   */
  type RouterElement = {
    navigate: (url: string | URL, options?: { replace?: boolean }) => Promise<void>;
  };
}
