import type { BaseAttributes } from "../jsx.d.ts";

export interface Elements {
  /**
   * A built-in element of mono-jsx that toggles the visibility of its children.
   * @mono-jsx
   */
  if: BaseAttributes & {
    /**
     * The visibility of the children.
     */
    value?: any;

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
}

declare global {
  /**
   *  Defines the Signals/Context/Refs types.
   */
  type FC<Signals = {}, Refs = {}> = {
    /**
     * Initializes the signals.
     */
    readonly init: (initValue: Signals) => void;
    /**
     * Creates a new signals object.
     */
    readonly create: <T extends {}>(initValue: T) => Omit<T, "effect">;
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
  } & Omit<Signals, "init" | "refs" | "computed" | "$" | "effect">;

  /**
   *  Defines the `refs` type.
   */
  type Refs<T, R = {}> = T extends FC<infer S> ? FC<S, R> : never;
}
