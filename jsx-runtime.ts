import type { FC, VNode } from "./types/jsx.d.ts";
import { JSX, renderToWebStream } from "./render.ts";
import { escapeHTML, isString, NullProtoObject } from "./runtime/utils.ts";
import { isSignal } from "./signal.ts";
import { $fragment, $html, $setup, $vnode } from "./symbols.ts";

export const Fragment = $fragment as unknown as FC;

export const jsx = (tag: string | FC, props: Record<string, unknown> = new NullProtoObject(), key?: string | number): VNode => {
  const vnode: VNode = [tag, props, $vnode];
  if (key !== undefined) {
    props.key = key;
  }
  if (tag === "html") {
    if (props.request as unknown === $setup) {
      // if the request is a 'setup' request, return the props
      // this is used for `buildRoutes` function
      return props as unknown as VNode;
    }
    const renderOptions = new NullProtoObject();
    const optionsKeys = new Set(["app", "context", "components", "routes", "request", "session", "status", "headers", "htmx"]);
    for (const [key, value] of Object.entries(props)) {
      if (optionsKeys.has(key) || key.startsWith("htmx-ext-")) {
        renderOptions[key] = value;
        delete props[key];
      }
    }
    // if the tag name is `html`, render it to a `Response` object
    return renderToWebStream(vnode as unknown as VNode, renderOptions) as unknown as VNode;
  } else if (tag === "static") {
    // track the stack of the static element to identify the caller
    props.$stack = new Error().stack?.split("at ", 3)[2]?.trim();
  }
  return vnode;
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
