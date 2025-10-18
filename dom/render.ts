import type { VNode } from "../types/jsx.d.ts";
import { isObject } from "../runtime/utils.ts";
import { $signal } from "../symbols.ts";

interface Signal {
  [$signal]: {
    readonly scope: number;
    readonly key: string | Compute;
    readonly value: unknown;
  };
}

interface Compute {
  readonly compute: (() => unknown) | string;
  readonly deps: Set<string>;
}

const customElements = new Map<string, FC>();
const JSX = {
  customElements: {
    define(tagName: string, fc: FC) {
      customElements.set(tagName, fc);
    },
  },
};

const isSignal = (v: unknown): v is Signal => isObject(v) && !!(v as any)[$signal];

const render = (vnode: VNode): (Element | string)[] => {
  const [tag, props] = vnode;
  if (tag === "html") {
    return props.mount;
  }
  return [];
};

export { customElements, isSignal, JSX, render };
