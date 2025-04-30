import type { FC, VNode } from "./types/jsx.d.ts";
import { $fragment, $html, $vnode } from "./symbols.ts";
import { render } from "./render.ts";
import { escapeHTML } from "./runtime/utils.ts";

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
    const optionsKeys = new Set(["appState", "context", "request", "status", "headers", "rendering", "htmx"]);
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

const Fragment = $fragment as unknown as FC;

const html = (raw: TemplateStringsArray, ...values: unknown[]): VNode => [
  $html,
  { innerHTML: String.raw({ raw }, ...values) },
  $vnode,
];

const safeHtml = (raw: TemplateStringsArray, ...values: unknown[]): VNode => {
  const fullHtml = raw.reduce((acc, str, i) => {
    const value = values[i - 1];
    return acc + (value !== undefined ? escapeHTML(String(value)) : "") + str;
  });

  return [
    $html,
    { innerHTML: fullHtml },
    $vnode,
  ];
};

// global variables
Object.assign(globalThis, {
  html,
  safeHtml,
  css: html,
  js: html,
});

export { Fragment, jsx, jsx as jsxDEV, jsx as jsxs };
