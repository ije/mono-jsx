import type { FC, VNode } from "./types/jsx.d.ts";
import { isSignal, JSX, renderHtml } from "./render.ts";
import { escapeHTML, isString, NullProtoObj } from "./runtime/utils.ts";
import { $fragment, $html, $setup, $vnode } from "./symbols.ts";

export const Fragment = $fragment as unknown as FC;

export const jsx = (tag: string | FC, props: Record<string, unknown> = new NullProtoObj(), key?: string | number): VNode => {
  const vnode = new Array(3).fill(null);
  vnode[0] = tag;
  vnode[1] = props;
  vnode[2] = $vnode;
  if (key !== undefined) {
    props.key = key;
  }
  // if the tag name is `html`, render it to a `Response` object
  if (tag === "html") {
    if (props.request as unknown === $setup) {
      // if the request is a 'setup' request, return the props as a VNode
      return props as unknown as VNode;
    }
    const renderOptions = new NullProtoObj();
    const optionsKeys = new Set(["app", "context", "components", "routes", "request", "status", "headers", "htmx"]);
    for (const [key, value] of Object.entries(props)) {
      if (optionsKeys.has(key) || key.startsWith("htmx-ext-")) {
        renderOptions[key] = value;
        delete props[key];
      }
    }
    return renderHtml(vnode as unknown as VNode, renderOptions) as unknown as VNode;
  }
  return vnode as unknown as VNode;
};

export const jsxEscape = (value: unknown): string => {
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return escapeHTML(String(value));
};

export const html = (template: string | TemplateStringsArray, ...values: unknown[]): VNode => [
  $html,
  { innerHTML: isString(template) || isSignal(template) ? template : String.raw(template, ...values.map(jsxEscape)) },
  $vnode,
];

// inject global variables
Object.assign(globalThis, {
  JSX,
  html,
  css: html,
  js: html,
});

export { html as css, html as js, JSX, jsx as jsxDEV, jsx as jsxs };
