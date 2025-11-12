import type { FC, VNode } from "../jsx.d.ts";

export const html: JSX.Raw;
export const JSX: typeof globalThis.JSX;
export const Fragment: (props: {}) => VNode;
export const jsx: (tag: string | FC, props: Record<string, unknown>, key?: string | number) => VNode;
export { html as css, html as js, jsx as jsxDEV, jsx as jsxs };

declare global {
  namespace JSX {
    interface MonoElements {}
    interface HtmlCustomAttributes {}
  }
}
