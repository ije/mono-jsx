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
   * The `toggle` element is a builtin element that toggles the visibility of its children.
   */
  toggle: BaseAttributes & {
    show?: boolean | 0 | 1;
  };
  /**
   * The `switch` element is a builtin element that chooses one of its children based on the `slot` attribute to display.
   * It is similar to a switch statement in programming languages.
   */
  switch: BaseAttributes & {
    value?: string | number | boolean | null;
  };
  /**
   * The `component` element is a builtin element that is used to load components lazily,
   * which can improve performance by reducing the initial load time of the application.
   */
  component: BaseAttributes & AsyncComponentAttributes & {
    name: string;
    props?: Record<string, unknown>;
  };
  /**
   * The `router` element is a builtin element that implements client-side routing.
   */
  router: BaseAttributes & AsyncComponentAttributes & {};
}

declare global {
  /**
   * The `html` function is used to create XSS-unsafe HTML elements.
   */
  var html: JSX.Raw;
  var css: JSX.Raw;
  var js: JSX.Raw;

  /**
   * mono-jsx `this` object that is bound to the function component.
   */
  type FC<Signals = {}, AppSignals = {}, Context = {}> = {
    /**
     * Application signals.
     */
    readonly app: AppSignals;
    /**
     * Rendering context.
     *
     * **⚠ This is a server-side only API.**
     */
    readonly context: Context;
    /**
     * Current request object.
     *
     * **⚠ This is a server-side only API.**
     */
    readonly request: Request & { params?: Record<string, string> };
    /**
     * The `refs` object is used to store references to DOM elements.
     */
    readonly refs: Record<string, HTMLElement | null>;
    /**
     * The `computed` method is used to create a computed signal.
     */
    readonly computed: <T = unknown>(fn: () => T) => T;
    /**
     * The `effect` method is used to create a side effect.
     * **The effect function is only called on client side.**
     */
    readonly effect: (fn: () => void | (() => void)) => void;
  } & Omit<Signals, "app" | "context" | "request" | "computed" | "effect">;
}
