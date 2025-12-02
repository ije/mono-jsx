import type { ComponentType, VNode } from "../types/jsx.d.ts";
import { JSX } from "../jsx.ts";
import { domEscapeHTML, isString, NullPrototypeObject } from "../runtime/utils.ts";
import { $fragment, $html, $vnode } from "../symbols.ts";
import { createStore, Reactive, render } from "./render.ts";

const Fragment = $fragment as unknown as ComponentType;

const jsx = (tag: string | ComponentType, props: Record<string, unknown> = new NullPrototypeObject(), key?: string | number): VNode => {
  const vnode: VNode = [tag, props, $vnode];
  if (key !== undefined) {
    props.key = key;
  }
  return vnode;
};

const jsxEscape = (value: unknown): string => {
  switch (typeof value) {
    case "bigint":
    case "number":
      return String(value);
    case "string":
      return domEscapeHTML(value);
    default:
      return "";
  }
};

const html = (template: string | TemplateStringsArray, ...values: unknown[]): VNode => [
  $html,
  {
    innerHTML: isString(template) || template instanceof Reactive ? template : String.raw(template, ...values.map(jsxEscape)),
  },
  $vnode,
];

// inject mount method to HTMLElement prototype
HTMLElement.prototype.mount = function(node: VNode, aboutSignal?: AbortSignal) {
  render(null as any, node as JSX.Element, this, aboutSignal);
};

// inject global variables
Object.assign(globalThis, {
  createStore,
  JSX,
  html,
  css: html,
  js: html,
});

export { Fragment, html, html as css, html as js, JSX, jsx, jsx as jsxDEV, jsx as jsxs };
