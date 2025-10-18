import type { FC, VNode } from "../types/jsx.d.ts";
import type { ChildType } from "../types/mono.d.ts";
import { applyStyle, cx, isObject, isString, NullProtoObject } from "../runtime/utils.ts";
import { $fragment, $html, $signal, $vnode } from "../symbols.ts";

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
const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;

const render = (node: ChildType, root: HTMLElement) => {
  switch (typeof node) {
    case "string":
      root.insertAdjacentText("beforeend", node);
      break;
    case "number":
    case "bigint":
      root.insertAdjacentText("beforeend", String(node));
      break;
    case "object":
      if (node === null) {
        // skip null
      } else if (isSignal(node)) {
        // TODO: render signal
      } else if (isVNode(node)) {
        const [tag, props] = node;
        switch (tag) {
          // fragment element
          case $fragment: {
            const { children } = props;
            if (children !== undefined) {
              renderChildren(children, root);
            }
            break;
          }

          // XSS!
          case $html: {
            const { innerHTML } = props;
            if (isSignal(innerHTML)) {
              // TODO: render signal
            } else if (isString(innerHTML)) {
              root.insertAdjacentText("beforeend", innerHTML);
            }
            break;
          }

          // `<slot>` element
          case "slot": {
            break;
          }

          // `<toggle>` element
          case "toggle": {
            let { show, hidden, viewTransition, children } = props;
            if (children !== undefined) {
            }
            break;
          }

          // `<switch>` element
          case "switch": {
            const { value: valueProp, viewTransition, children } = props;
            if (children !== undefined) {
            }
            break;
          }

          // `<router>` element
          case "router": {
            // todo: client side router
            break;
          }

          case "component":
          case "cache":
          case "static":
          case "redirect":
          case "invalid":
          case "formslot": {
            // ignore in CSR
            break;
          }

          default: {
            // function component
            if (typeof tag === "function") {
              renderFC(tag as FC, props, root);
              break;
            }

            // regular html element
            if (isString(tag)) {
              if (customElements.has(tag)) {
                renderFC(customElements.get(tag)!, props, root);
                break;
              }
              const { mount, children, ...attrs } = props;
              const el = document.createElement(tag);
              for (const [key, value] of Object.entries(attrs)) {
                switch (key) {
                  case "class":
                    // todo: signals
                    el.className = cx(value);
                    break;
                  case "style": {
                    // todo: signals
                    if (isObject(value)) {
                      applyStyle(el, value);
                    } else if (isString(value)) {
                      el.style.cssText = value;
                    }
                    break;
                  }
                  default:
                    if (key === "action" && typeof value === "function" && tag === "form") {
                      el.addEventListener("submit", (evt) => {
                        evt.preventDefault();
                        value(new FormData(evt.target as HTMLFormElement), evt);
                      });
                    } else if (key.startsWith("on") && typeof value === "function") {
                      // todo: dispose
                      el.addEventListener(key.slice(2).toLowerCase(), value);
                    } else if (isSignal(value)) {
                      // TODO: render signal
                    } else {
                      el.setAttribute(key, String(value));
                    }
                    break;
                }
              }
              if (mount instanceof HTMLElement) {
                mount.appendChild(el);
              } else {
                root.appendChild(el);
              }
              if (children !== undefined) {
                renderChildren(children, el);
              }
            }
          }
        }
      } else if (Array.isArray(node)) {
        for (const child of node) {
          render(child, root);
        }
      }
      break;
  }
};

function renderChildren(children: ChildType | ChildType[], root: HTMLElement) {
  if (Array.isArray(children) && !isVNode(children)) {
    for (const child of children) {
      render(child, root);
    }
  } else {
    render(children as ChildType, root);
  }
}

function renderFC(fc: FC, props: Record<string, unknown>, root: HTMLElement) {
  const scope = new NullProtoObject();
}

export { customElements, isSignal, JSX, render };
