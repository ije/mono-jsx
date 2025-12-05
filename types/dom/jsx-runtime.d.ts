import type { ComponentType, VNode } from "../jsx.d.ts";
import type * as Mono from "./mono.d.ts";

export const html: JSX.Raw;
export const JSX: typeof globalThis.JSX;
export const Fragment: (props: {}) => VNode;
export const jsx: (tag: string | ComponentType, props: Record<string, unknown>, key?: string | number) => VNode;

// aliases
export { html as css, html as js, jsx as jsxDEV, jsx as jsxs };

declare global {
  namespace JSX {
    interface BuiltinElements extends Mono.Elements {}
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
