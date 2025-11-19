import type { HTML } from "./html.d.ts";

export type ChildType = MaybeArray<JSX.Element | string | number | bigint | boolean | null | undefined>;
export type MaybeArray<T> = T | T[];
export type MaybePromiseOrGenerator<T> = T | Promise<T> | Generator<T> | AsyncGenerator<T>;

export interface BaseAttributes {
  /**
   * The children of the element.
   */
  children?: MaybeArray<ChildType>;
  /**
   * The key of the element.
   * @deprecated The prop `key` is ignored in mono-jsx.
   */
  key?: string | number;
  /**
   * The `slot` attribute assigns a slot in a [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) shadow tree to an element: An element with a `slot` attribute is assigned to the slot created by the `<slot>` element whose name attribute's value matches that slot attribute's value.
   */
  slot?: string;
  /**
   * The `portal` attribute is used to mount the component to a specified DOM element.
   * @mono-jsx
   */
  portal?: HTMLElement;
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

export type VNode = readonly [
  tag: string | symbol | ComponentType<any>,
  props: Record<string, any>,
  $vnode: symbol,
];

export interface ComponentType<P = {}> {
  (props: P): MaybePromiseOrGenerator<VNode | string | null>;
  rendering?: string;
}

declare global {
  namespace JSX {
    type ElementType<P = any> =
      | {
        [K in keyof IntrinsicElements]: P extends IntrinsicElements[K] ? K : never;
      }[keyof IntrinsicElements]
      | ComponentType<P>;
    type Raw = (template: string | TemplateStringsArray, ...values: unknown[]) => Element;
    interface CustomAttributes {}
    interface HtmlCustomAttributes {}
    interface BuiltinElements {}
    interface CustomElements {}
    interface Element extends VNode, Response {}
    interface IntrinsicAttributes extends BaseAttributes, AsyncComponentAttributes {}
    interface IntrinsicElements extends HTML.Elements, HTML.SVGElements, HTML.CustomElements, JSX.BuiltinElements {}
  }

  interface FCExtension<AppSignals = {}, AppRefs = {}, Context = {}> {}

  /**
   *  Defines the Signals/Context/Refs types.
   */
  type FC<Signals = {}, Refs = {}, AppSignals = {}, AppRefs = {}, Context = {}> =
    & {
      /**
       * Initializes the signals.
       */
      readonly init: (initValue: Signals) => void;
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
    }
    & FCExtension<AppSignals, AppRefs, Context>
    & Omit<Omit<Signals, "init" | "refs" | "computed" | "$" | "effect">, keyof FCExtension>;

  /**
   * Defines the `this.app` type.
   */
  type App<T, A = {}, RR = {}> = T extends FC<infer S, infer R, infer _, infer _, infer C> ? FC<S, R, A, RR, C> : never;

  /**
   * Defines the `this.context` type.
   */
  type Context<T, C = {}> = T extends FC<infer S, infer R, infer A, infer RR> ? FC<S, R, A, RR, C> : never;

  /**
   *  Defines the `this.refs` type.
   */
  type Refs<T, R = {}, RR = {}> = T extends FC<infer S, infer _, infer A, infer _, infer C> ? FC<S, R, A, RR, C> : never;

  /**
   * The JSX global object.
   * @mono-jsx
   */
  var JSX: {
    customElements: {
      define: (tagName: string, fc: ComponentType<any>) => void;
    };
  };

  /**
   * Creates XSS-unsafed HTML content.
   * @mono-jsx
   */
  var html: JSX.Raw;
  /**
   * An alias to `html`.
   * @mono-jsx
   */
  var css: JSX.Raw;
  /**
   * An alias to `html`.
   * @mono-jsx
   */
  var js: JSX.Raw;
}
