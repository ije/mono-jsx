import type { FC, VNode } from "../types/jsx.d.ts";
import { isString, NullProtoObject } from "../runtime/utils.ts";
import { $fragment, $html, $vnode } from "../symbols.ts";
import { isSignal, JSX, render } from "./render.ts";

const div = document.createElement("div");
const Fragment = $fragment as unknown as FC;

const jsx = (tag: string | FC, props: Record<string, unknown> = new NullProtoObject(), key?: string | number): VNode => {
  const vnode: VNode = [tag, props, $vnode];
  if (key !== undefined) {
    props.key = key;
  }
  // if the tag name is `html`, render it to a `Response` object
  if (props.mount instanceof HTMLElement) {
    render({}, vnode as JSX.Element, props.mount);
  }
  return vnode;
};

const jsxEscape = (value: unknown): string => {
  if (value === null || value === undefined || typeof value === "boolean") {
    return "";
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  div.textContent = String(value);
  return div.innerHTML;
};

const html = (template: string | TemplateStringsArray, ...values: unknown[]): VNode => [
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

export { Fragment, html, html as css, html as js, JSX, jsx, jsx as jsxDEV, jsx as jsxs };
