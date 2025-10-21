import type { FC, VNode } from "../types/jsx.d.ts";
import type { ChildType } from "../types/mono.d.ts";
import { applyStyle, cx, isFunction, isObject, isString, NullProtoObject } from "../runtime/utils.ts";
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
    case "number":
    case "bigint":
      root.appendChild(document.createTextNode(String(node)));
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
              root.insertAdjacentHTML("beforeend", innerHTML);
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
                  case "ref":
                    if (isFunction(value)) {
                      // todo: clean up
                      value(el);
                    }
                    break;
                  case "slot":
                  case "$checked":
                  case "$value":
                  case "viewTransition":
                    break;
                  case "action":
                    if (isFunction(value) && tag === "form") {
                      el.addEventListener("submit", (evt) => {
                        evt.preventDefault();
                        value(new FormData(evt.target as HTMLFormElement), evt);
                      });
                    } else if (isString(value)) {
                      el.setAttribute(key, value);
                    }
                    break;
                  default:
                    if (key.startsWith("on") && isFunction(value)) {
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

const renderToFragment = (node: ChildType) => {
  const div = document.createElement("div");
  render(node, div);
  return [...div.childNodes];
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
  const thisProxy = createThisProxy();
  const v = fc.call(thisProxy, props);
  if (isObject(v) && !isVNode(v)) {
    if (v instanceof Promise) {
      let placeholder: ChildNode[] | undefined;
      if (isVNode(props.placeholder)) {
        placeholder = renderToFragment(props.placeholder as ChildType);
      }
      if (!placeholder?.length) {
        placeholder = [document.createComment("")];
      }
      root.append(...placeholder);
      v.then((node) => {
        placeholder[0].replaceWith(...renderToFragment(node as ChildType));
      }).catch((err) => {
        let msg: ChildNode[] = [];
        if (isFunction(props.catch)) {
          const v = props.catch(err);
          if (isVNode(v)) {
            msg = renderToFragment(v as ChildType);
          }
        } else {
          console.error(err);
        }
        placeholder[0].replaceWith(...msg);
      }).finally(() => {
        for (let i = 1; i < placeholder.length; i++) {
          placeholder[i].remove();
        }
      });
    } else if (Symbol.asyncIterator in v) {
      // todo: render async generator components
    } else if (Symbol.iterator in v) {
      for (const node of v) {
        render(node as ChildType, root);
      }
    }
  } else {
    render(v as ChildType, root);
  }
}

function createThisProxy() {
  return new Proxy(new NullProtoObject(), {
    get(target, key, receiver) {
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      return Reflect.set(target, key, value, receiver);
    },
  });
}

export { customElements, isSignal, JSX, render };
