import type * as Mono from "./mono.d.ts";
import type { HTML } from "./html.d.ts";

export type VNode = readonly [
  tag: string | symbol | FC<any>,
  props: Record<string, any>,
  $vnode: symbol,
];

export type MaybePromiseOrGenerator<T> = T | Promise<T> | Generator<T> | AsyncGenerator<T>;

export interface FC<P = {}> {
  (props: P): MaybePromiseOrGenerator<VNode | string | null>;
  rendering?: string;
}

declare global {
  namespace JSX {
    type ElementType<P = any> =
      | {
        [K in keyof IntrinsicElements]: P extends IntrinsicElements[K] ? K : never;
      }[keyof IntrinsicElements]
      | FC<P>;
    type Raw = (template: string | TemplateStringsArray, ...values: unknown[]) => Element;
    interface CustomElements {}
    interface Element extends VNode, Response {}
    interface IntrinsicAttributes extends Mono.BaseAttributes, Mono.AsyncComponentAttributes {}
    interface IntrinsicElements extends HTML.Elements, HTML.SVGElements, HTML.CustomElements, Mono.Elements {}
  }
  var JSX: {
    customElements: {
      define: (tagName: string, fc: FC<any>) => void;
    };
  };
}
