import type { FC, VNode } from "../types/jsx.d.ts";
import { JSX } from "../jsx.ts";
import { domEscapeHTML, isString, NullProtoObject } from "../runtime/utils.ts";
import { $fragment, $html, $vnode } from "../symbols.ts";
import { isReactive, render } from "./render.ts";

const Fragment = $fragment as unknown as FC;

const jsx = (tag: string | FC, props: Record<string, unknown> = new NullProtoObject(), key?: string | number): VNode => {
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
    innerHTML: isString(template) || isReactive(template) ? template : String.raw(template, ...values.map(jsxEscape)),
  },
  $vnode,
];

// inject mount method to HTMLElement prototype
HTMLElement.prototype.mount = function(node: VNode, aboutSignal?: AbortSignal) {
  render(new NullProtoObject() as any, node as JSX.Element, this, aboutSignal);
};

// inject global variables
Object.assign(globalThis, {
  JSX,
  html,
  css: html,
  js: html,
});

export { Fragment, html, html as css, html as js, JSX, jsx, jsx as jsxDEV, jsx as jsxs };
