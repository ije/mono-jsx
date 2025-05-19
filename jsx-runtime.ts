import type { FC, VNode } from "./types/jsx.d.ts";
import { JSX, render } from "./render.ts";
import { $fragment, $html, $vnode } from "./symbols.ts";
import { escapeHTML } from "./runtime/utils.ts";

const Fragment = $fragment as unknown as FC;

const jsx = (tag: string | FC, props: Record<string, unknown> = Object.create(null), key?: string | number): VNode => {
  const vnode = new Array(3).fill(null);
  vnode[0] = tag;
  vnode[1] = props;
  vnode[2] = $vnode;
  if (key !== undefined) {
    props.key = key;
  }
  // if the tag name is `html`, render it to a `Response` object
  if (tag === "html") {
    const renderOptions = Object.create(null);
    const optionsKeys = new Set(["app", "context", "request", "status", "headers", "rendering", "htmx"]);
    for (const [key, value] of Object.entries(props)) {
      if (optionsKeys.has(key) || key.startsWith("htmx-ext-")) {
        renderOptions[key] = value;
        delete props[key];
      }
    }
    return render(vnode as unknown as VNode, renderOptions) as unknown as VNode;
  }
  return vnode as unknown as VNode;
};

const jsxEscape = (value: unknown): string => {
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return escapeHTML(String(value));
};

const html = (raw: string, ...values: unknown[]): VNode => [
  $html,
  { innerHTML: String.raw({ raw }, ...values.map(jsxEscape)) },
  $vnode,
];

// inject global variables
Object.assign(globalThis, {
  JSX,
  html,
  css: html,
  js: html,
});

export { Fragment, jsx, jsx as jsxDEV, jsx as jsxs };
