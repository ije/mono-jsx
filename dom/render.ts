import type { FC, VNode } from "../types/jsx.d.ts";
import type { ChildType } from "../types/mono.d.ts";
import { customElements } from "../jsx.ts";
import { applyStyle, cx, isFunction, isObject, isString, NullProtoObject } from "../runtime/utils.ts";
import { $fragment, $html, $vnode } from "../symbols.ts";

interface Scope {
  [key: string]: unknown;
  readonly [$ac]: AbortController;
  readonly [$slots]: ChildType[] | undefined;
  readonly [$afterCall]: () => void;
  readonly [$runCompute]: (compute: Compute) => unknown;
  readonly [$watch]: (key: string, effect: () => void) => void;
}

class Signal {
  constructor(
    public readonly key: string,
  ) {}
}

class Compute {
  deps?: Set<string>;
  constructor(
    public readonly compute: () => unknown,
  ) {}
}

const $ac = Symbol();
const $slots = Symbol();
const $afterCall = Symbol();
const $runCompute = Symbol();
const $watch = Symbol();
const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;
const isSignal = (v: unknown): v is Signal => v instanceof Signal;
const isCompute = (v: unknown): v is Compute => v instanceof Compute;
const createTextNode = (text: string) => document.createTextNode(text);
const createDocumentFragment = () => document.createDocumentFragment();

const render = (scope: Scope, node: ChildType, root: HTMLElement | DocumentFragment, abortSignal?: AbortSignal) => {
  switch (typeof node) {
    case "string":
    case "number":
    case "bigint": {
      const textNode = createTextNode(String(node));
      abortSignal?.addEventListener("abort", () => textNode.remove());
      root.appendChild(textNode);
      break;
    }
    case "object":
      if (node === null) {
        // skip null
      } else if (isSignal(node) || isCompute(node)) {
        const textNode = createTextNode("");
        const watch = scope[$watch];
        const update = () => {
          let value: unknown;
          if (isSignal(node)) {
            value = scope[node.key];
          } else {
            value = scope[$runCompute](node);
          }
          switch (typeof value) {
            case "string":
            case "number":
            case "bigint":
              textNode.textContent = String(value);
          }
        };
        update();
        if (isSignal(node)) {
          watch(node.key, update);
        } else {
          node.deps?.forEach((key) => watch(key, update));
        }
        root.appendChild(textNode);
        abortSignal?.addEventListener("abort", () => textNode.remove());
      } else if (isVNode(node)) {
        const [tag, props] = node;
        switch (tag) {
          // fragment element
          case $fragment: {
            const { children } = props;
            if (children !== undefined) {
              renderChildren(scope, children, root, abortSignal);
            }
            break;
          }

          // XSS!
          case $html: {
            const { innerHTML } = props;
            if (isSignal(innerHTML) || isCompute(innerHTML)) {
              // TODO: render signal
            } else if (isString(innerHTML)) {
              // root.insertAdjacentHTML("beforeend", innerHTML);
            }
            break;
          }

          // `<slot>` element
          case "slot": {
            const slots = scope[$slots];
            if (slots) {
              renderChildren(scope, slots, root, abortSignal);
            }
            break;
          }

          // `<toggle>` element
          case "toggle": {
            // todo: support viewTransition
            let { show, hidden, children } = props;
            if (children !== undefined) {
              if (show === undefined && hidden !== undefined) {
                if (isSignal(hidden)) {
                  show = new Compute(() => !scope[hidden.key]);
                } else if (isCompute(hidden)) {
                  show = new Compute(() => !hidden.compute());
                } else {
                  show = !hidden;
                }
              }
              if (isSignal(show) || isCompute(show)) {
                let ac = new AbortController();
                let childNodes = root.childNodes;
                let insertIndex = childNodes.length;
                let watch = scope[$watch];
                let update = () => {
                  let value: unknown;
                  if (isSignal(show)) {
                    value = scope[show.key];
                  } else {
                    value = scope[$runCompute](show);
                  }
                  if (value) {
                    const fragment = createDocumentFragment();
                    renderChildren(scope, children, fragment, ac.signal);
                    root.insertBefore(fragment, childNodes[insertIndex]);
                  } else {
                    ac.abort();
                    ac = new AbortController();
                  }
                };
                update();
                if (isSignal(show)) {
                  watch(show.key, update);
                } else {
                  show.deps?.forEach((key) => watch(key, update));
                }
                abortSignal?.addEventListener("abort", () => ac.abort());
              } else if (show) {
                renderChildren(scope, children, root, abortSignal);
              }
            }
            break;
          }

          // `<switch>` element
          case "switch": {
            // todo: support viewTransition
            const { value: valueProp, children } = props;
            if (children !== undefined) {
            }
            break;
          }

          // `<router>` element
          case "router": {
            // todo: SPA
            break;
          }

          case "component":
          case "cache":
          case "static":
          case "redirect":
          case "invalid":
          case "formslot":
            // ignored in CSR
            break;

          default: {
            // function component
            if (typeof tag === "function") {
              renderFC(tag as FC, props, root, abortSignal);
              break;
            }

            // regular html element
            if (isString(tag)) {
              if (customElements.has(tag)) {
                renderFC(customElements.get(tag)!, props, root, abortSignal);
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
              abortSignal?.addEventListener("abort", () => el.remove());
              if (children !== undefined) {
                renderChildren(scope, children, el, abortSignal);
              }
            }
          }
        }
      } else if (Array.isArray(node)) {
        for (const child of node) {
          render(scope, child, root, abortSignal);
        }
      }
      break;
  }
};

const renderToFragment = (scope: Scope, node: ChildType, aboutSignal?: AbortSignal) => {
  const fragment = createDocumentFragment();
  render(scope, node, fragment, aboutSignal);
  return [...fragment.childNodes];
};

const renderChildren = (
  scope: Scope,
  children: ChildType | ChildType[],
  root: HTMLElement | DocumentFragment,
  aboutSignal?: AbortSignal,
) => {
  if (Array.isArray(children) && !isVNode(children)) {
    for (const child of children) {
      render(scope, child, root, aboutSignal);
    }
  } else {
    render(scope, children as ChildType, root, aboutSignal);
  }
};

const renderFC = (fc: FC, props: Record<string, unknown>, root: HTMLElement | DocumentFragment, abortSignal?: AbortSignal) => {
  const thisProxy = createThisProxy(props.children as ChildType[] | undefined, abortSignal) as unknown as Scope;
  const v = fc.call(thisProxy, props);
  thisProxy[$afterCall]();
  if (isObject(v) && !isVNode(v)) {
    if (v instanceof Promise) {
      let placeholder: ChildNode[] | undefined;
      if (isVNode(props.placeholder)) {
        placeholder = renderToFragment(thisProxy, props.placeholder as ChildType, abortSignal);
      }
      if (!placeholder?.length) {
        placeholder = [document.createComment("pending...")];
      }
      root.append(...placeholder);
      v.then((node) => {
        placeholder[0].replaceWith(...renderToFragment(thisProxy, node as ChildType, abortSignal));
      }).catch((err) => {
        let msg: ChildNode[] = [];
        if (isFunction(props.catch)) {
          const v = props.catch(err);
          if (isVNode(v)) {
            msg = renderToFragment(thisProxy, v as ChildType, abortSignal);
          }
        } else {
          console.error(err);
        }
        placeholder[0].replaceWith(...msg);
      }).finally(() => {
        // remove extra placeholder elements
        for (let i = 1; i < placeholder.length; i++) {
          placeholder[i].remove();
        }
      });
    } else if (Symbol.asyncIterator in v) {
      // todo: render async generator components
    } else if (Symbol.iterator in v) {
      for (const node of v) {
        render(thisProxy, node as ChildType, root, abortSignal);
      }
    }
  } else {
    render(thisProxy, v as ChildType, root, abortSignal);
  }
};

const createThisProxy = (slots: ChildType[] | undefined, abortSignal?: AbortSignal) => {
  let watchHandlers = new Map<string, Set<() => void>>();
  let called = false;
  let depSet: Set<string> | undefined;
  let ac = new AbortController();
  return new Proxy(new NullProtoObject(), {
    get(target, key, reciver) {
      switch (key) {
        case $ac:
          return ac;
        case $slots:
          return slots;
        case $afterCall:
          return () => {
            called = true;
          };
        case $runCompute:
          return (c: Compute) => {
            if (!c.deps) {
              depSet = c.deps = new Set<string>();
            }
            const value = c.compute.call(reciver);
            depSet = undefined;
            return value;
          };
        case $watch:
          return (key: string, effect: () => void) => {
            let effects = watchHandlers.get(key);
            if (!effects) {
              effects = new Set();
              watchHandlers.set(key, effects);
            }
            effects.add(effect);
            abortSignal?.addEventListener("abort", () => {
              effects.delete(effect);
            });
          };
        case "init":
          return ((args: Record<string, unknown>) => Object.assign(target, args));
        case "$":
        case "compute":
          return (fn: () => unknown) => new Compute(fn);
        case "effect":
          return (fn: () => (() => void) | void) => {
          };
        default:
          if (called || depSet) {
            if (depSet && isString(key)) {
              depSet.add(key);
            }
            return Reflect.get(target, key);
          }
          if (isString(key)) {
            return new Signal(String(key));
          }
      }
    },
    set(target, key, value) {
      const ok = Reflect.set(target, key, value);
      if (ok && isString(key)) {
        watchHandlers.get(key)?.forEach((effect) => effect());
      }
      return ok;
    },
  });
};

export { isCompute, isSignal, render };
