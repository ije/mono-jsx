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
  interface FCExtension {
    /**
     * Creates a new signals object.
     *
     * **⚠ This is a client-side only API.**
     */
    readonly createStore: <T extends {}>(initValue: T) => Omit<T, "effect">;
  }
}
