import type { ComponentType, VNode } from "../jsx.d.ts";

export const html: JSX.Raw;
export const JSX: typeof globalThis.JSX;
export const Fragment: (props: {}) => VNode;
export const jsx: (tag: string | ComponentType, props: Record<string, unknown>, key?: string | number) => VNode;

// aliases
export { html as css, html as js, jsx as jsxDEV, jsx as jsxs };

declare global {
  interface FCExtension<FC> {
    /**
     * Creates a new signals object.
     *
     * **⚠ This is a client-side only API.**
     */
    extend<T extends Record<string, unknown>>(initValue: T): FC & T;
  }

  interface HTMLElement {
    /**
     * Mounts a VNode to the DOM element.
     *
     * @mono-jsx
     */
    mount(node: VNode, aboutSignal?: AbortSignal): void;
  }
}
