import type { FC, VNode } from "../jsx.d.ts";
import type * as Mono from "./mono.d.ts";

export const html: JSX.Raw;
export const JSX: typeof globalThis.JSX;
export const Fragment: (props: {}) => VNode;
export const jsx: (tag: string | FC, props: Record<string, unknown>, key?: string | number) => VNode;

// aliases
export { html as css, html as js, jsx as jsxDEV, jsx as jsxs };

declare global {
  namespace JSX {
    // extends built-in JSX elements
    interface BuiltinElements extends Mono.Elements {}
  }
}
