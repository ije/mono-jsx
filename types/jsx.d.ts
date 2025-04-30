// deno-lint-ignore-file no-explicit-any

import type * as Mono from "./mono.d.ts";
import type { HTML } from "./html.d.ts";

export type ChildType = VNode | string | number | bigint | boolean | null;

export type VNode = readonly [
  tag: string | symbol | FC<any>,
  props: Record<string, any>,
  $vnode: symbol,
];

export interface FC<P = {}> {
  (props: P): ChildType | Promise<ChildType> | Generator<ChildType> | AsyncGenerator<ChildType>;
  displayName?: string;
  rendering?: string;
}

export interface TC {
  (strings: TemplateStringsArray, ...values: unknown[]): VNode;
}

declare global {
  namespace JSX {
    type ElementType<P = any> =
      | {
        [K in keyof IntrinsicElements]: P extends IntrinsicElements[K] ? K : never;
      }[keyof IntrinsicElements]
      | FC<P>;
    interface Element extends VNode, Response {}
    interface IntrinsicAttributes extends Mono.BaseAttributes, Mono.AsyncComponentAttributes {}
    interface IntrinsicElements extends HTML.Elements, HTML.SVGElements, Mono.Elements {}
  }
  var html: TC, css: TC, js: TC, safeHtml: TC;
}
