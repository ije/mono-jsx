import type { FC, VNode } from "./types/jsx.d.ts";
import { JSX, renderHtml } from "./render.ts";
import { escapeHTML, isString, NullProtoObj } from "./runtime/utils.ts";
import { $fragment, $html, $vnode } from "./symbols.ts";

const Fragment = $fragment as unknown as FC;

const jsx = (tag: string | FC, props: Record<string, unknown> = new NullProtoObj(), key?: string | number): VNode => {
  const vnode = new Array(3).fill(null);
  vnode[0] = tag;
  vnode[1] = props;
  vnode[2] = $vnode;
  if (key !== undefined) {
    props.key = key;
  }
  // if the tag name is `html`, render it to a `Response` object
  if (tag === "html") {
    const renderOptions = new NullProtoObj();
    const optionsKeys = new Set(["app", "context", "components", "request", "status", "headers", "htmx"]);
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

const jsxEscape = (value: unknown): string => {
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return escapeHTML(String(value));
};

const html = (template: string | TemplateStringsArray, ...values: unknown[]): VNode => [
  $html,
  { innerHTML: isString(template) ? template : String.raw(template, ...values.map(jsxEscape)) },
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
