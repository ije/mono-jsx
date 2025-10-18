import type { FC, VNode } from "../types/jsx.d.ts";
import { escapeHTML, isString, NullProtoObj } from "../runtime/utils.ts";
import { $fragment, $html, $vnode } from "../symbols.ts";
import { isSignal, JSX, render } from "./render.ts";

export const Fragment = $fragment as unknown as FC;

export const jsx = (tag: string | FC, props: Record<string, unknown> = new NullProtoObj(), key?: string | number): VNode => {
  const vnode: VNode = [tag, props, $vnode];
  if (key !== undefined) {
    props.key = key;
  }
  // if the tag name is `html`, render it to a `Response` object
  if (props.mount instanceof HTMLElement) {
    props.mount.append(...render(vnode));
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
