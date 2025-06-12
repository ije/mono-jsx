import type * as CSS from "./css.d.ts";

type D9 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type D100 = 0 | D9 | `${D9}${0 | D9}` | 100;

export interface BaseCSSProperties extends CSS.Properties<string | number> {}

export interface AtRuleCSSProperties {
  [key: `@container${" " | "("}${string}`]: BaseCSSProperties;
  [key: `@media${" " | "("}${string}`]: BaseCSSProperties;
  [key: `@supports${" " | "("}${string}`]: BaseCSSProperties;
  [key: `@keyframes ${string}`]: {
    [key in "from" | "to" | `${D100}%`]?: BaseCSSProperties;
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

export interface BaseAttributes {
  children?: MaybeArray<ChildType>;
  slot?: string;
}

export interface AsyncComponentAttributes {
  /**
   * Try to catch errors in the component.
   */
  catch?: (err: any) => JSX.Element;
  /**
   * The loading spinner for the async component.
   */
  placeholder?: JSX.Element;
  /**
   * Rendering mode
   * - `eager`: render async component eagerly
   */
  rendering?: "eager";
}

export interface Elements {
  /**
   * The `toggle` element is a built-in element that toggles the visibility of its children.
   */
  toggle: BaseAttributes & {
    show?: any;
    hidden?: any;
  };
  /**
   * The `switch` element is a built-in element that chooses one of its children based on the `slot` attribute to display.
   * It is similar to a switch statement in programming languages.
   */
  switch: BaseAttributes & {
    value?: string | number | boolean | null;
  };
  /**
   * The `component` element is a built-in element that is used to load components lazily,
   * which can improve performance by reducing the initial load time of the application.
   */
  component: BaseAttributes & AsyncComponentAttributes & {
    name: string;
    props?: Record<string, unknown>;
    ref?: ComponentElement | ((el: ComponentElement) => void);
  };
  /**
   * The `router` element is a built-in element that implements client-side routing.
   */
  router: BaseAttributes & AsyncComponentAttributes & {
    /**
     * The `base` attribute is used to set the base URL for the router.
     */
    base?: string;
    ref?: RouterElement | ((el: RouterElement) => void);
  };
}

declare global {
  /**
   * The `html` function is used to create XSS-unsafed HTML content.
   */
  var html: JSX.Raw;
  /**
   * The `css` function is an alias to `html`.
   */
  var css: JSX.Raw;
  /**
   * The `js` function is an alias to `html`.
   */
  var js: JSX.Raw;
  /**
   *  The `FC` type defines Signals/Context/Refs API.
   */
  type FC<Signals = {}, AppSignals = {}, Context = {}, Refs = {}> = {
    /**
     * The global signals shared across the application.
     */
    readonly app: {
      /**
       * The `url` object contains the current URL information.
       */
      readonly url: URL & { params?: Record<string, string> };
    } & Omit<AppSignals, "url">;
    /**
     * The rendering context.
     *
     * **⚠ This is a server-side only API.**
     */
    readonly context: Context;
    /**
     * The `request` object contains the current request information.
     *
     * **⚠ This is a server-side only API.**
     */
    readonly request: Request & { URL: URL; params?: Record<string, string> };
    /**
     * The `refs` object is used to store variables in clide side.
     */
    readonly refs: Refs;
    /**
     * The `computed` method is used to create a computed signal.
     */
    readonly computed: <T = unknown>(fn: () => T) => T;
    /**
     * `this.$(fn)` is a shortcut for `this.computed(fn)`.
     */
    readonly $: FC["computed"];
    /**
     * The `effect` method is used to create a side effect.
     * **The effect function is only called on client side.**
     */
    readonly effect: (fn: () => void | (() => void)) => void;
  } & Omit<Signals, "app" | "context" | "request" | "refs" | "forIndex" | "forItem" | "computed" | "$" | "effect">;
  /**
   *  The `Refs` defines the `refs` types.
   */
  type Refs<T, R = {}> = T extends FC<infer S, infer A, infer C> ? FC<S, A, C, R> : never;
  /**
   * The `Context` defines the `context` types.
   */
  type Context<T, C = {}> = T extends FC<infer S, infer A, infer _, infer R> ? FC<S, A, C, R> : never;
  /**
   * The `Component` type defines the component element.
   */
  type ComponentElement = HTMLElement & {
    refresh: () => Promise<void>;
  };
  /**
   * The `Router` type defines the router element.
   */
  type RouterElement = HTMLElement & {
    navigate: (url: string | URL, options?: { replace?: boolean }) => Promise<void>;
  };
}
