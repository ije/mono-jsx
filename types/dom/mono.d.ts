import type { BaseAttributes } from "../jsx.d.ts";

export interface Elements {
  /**
   * A built-in element of mono-jsx that toggles the visibility of its children.
   * @mono-jsx
   */
  show: BaseAttributes & {
    /**
     * Show the children if the value is truthy.
     */
    when?: any;

    /**
     * Enables view transition for the children.
     */
    viewTransition?: string | boolean;
  };

  hidden: BaseAttributes & {
    /**
     * Hide the children if the value is truthy.
     */
    when?: any;

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
  interface FCExtension<FC> {
    /**
     * Creates a new signals object.
     *
     * **⚠ This is a client-side only API.**
     */
    extend<T extends Record<string, unknown>>(initValue: T): FC & T;
  }

  /**
   * Creates a new signals object.
   * @mono-jsx
   */
  var Store: <T extends Record<string, unknown>>(initValue: T) => FC & T;
}
