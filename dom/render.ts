import type { ChildType, FC, VNode } from "../types/jsx.d.ts";
import { customElements } from "../jsx.ts";
import { applyStyle, cx, isFunction, isObject, isString, NullProtoObject } from "../runtime/utils.ts";
import { $fragment, $html, $vnode } from "../symbols.ts";

interface Scope {
  [key: string]: unknown;
  readonly [$slots]: ChildType[] | undefined;
  readonly [$postcall]: () => void;
  readonly [$docompute]: (compute: Compute) => unknown;
  readonly [$watch]: (key: string, effect: () => void) => void;
}

class Signal {
  constructor(
    public readonly scope: Scope,
    public readonly key: string,
  ) {}
  reactive(effect: (value: unknown) => void) {
    const watch = this.scope[$watch];
    const update = () => effect(this.scope[this.key]);
    update();
    watch(this.key, update);
  }
}

class Compute {
  deps?: Set<string>;
  constructor(
    public readonly scope: Scope,
    public readonly compute: () => unknown,
  ) {}
  reactive(effect: (value: unknown) => void) {
    const watch = this.scope[$watch];
    const update = () => effect(this.scope[$docompute](this));
    update();
    this.deps?.forEach((key) => watch(key, update));
  }
}

class InsertAt {
  #root: HTMLElement | DocumentFragment;
  at: number;
  constructor(
    root: HTMLElement | DocumentFragment,
    at?: number,
  ) {
    this.#root = root;
    this.at = at ?? root.childNodes.length;
  }
  insert(node: Node) {
    this.#root.insertBefore(node, this.#root.childNodes[this.at]);
  }
}

const $slots = Symbol();
const $postcall = Symbol();
const $docompute = Symbol();
const $watch = Symbol();
const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;
const isReactive = (v: unknown): v is Signal | Compute => v instanceof Signal || v instanceof Compute;
const createTextNode = (text: string) => document.createTextNode(text);
const createDocumentFragment = () => document.createDocumentFragment();
const onAbort = (signal: AbortSignal | undefined, callback: () => void) => signal?.addEventListener("abort", callback);

const render = (scope: Scope, node: ChildType, root: HTMLElement | DocumentFragment, abortSignal?: AbortSignal) => {
  switch (typeof node) {
    case "number":
    case "bigint":
    case "string": {
      const textNode = createTextNode(String(node));
      root.appendChild(textNode);
      onAbort(abortSignal, () => textNode.remove());
      break;
    }
    case "object":
      if (node === null) {
        // skip null
      } else if (isReactive(node)) {
        const textNode = createTextNode("");
        node.reactive(value => {
          textNode.textContent = String(value);
        });
        root.appendChild(textNode);
        onAbort(abortSignal, () => textNode.remove());
      } else if (isVNode(node)) {
        const [tag, props] = node;
        switch (tag) {
          // fragment element
          case "mount":
          case $fragment: {
            const { children, root: rootProp } = props;
            const rootEl = rootProp instanceof HTMLElement ? rootProp : root;
            if (children !== undefined) {
              renderChildren(scope, children, rootEl, abortSignal);
            }
            break;
          }

          // XSS!
          case $html: {
            const { innerHTML } = props;
            if (isReactive(innerHTML)) {
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
                if (hidden instanceof Signal) {
                  show = new Compute(scope, () => !scope[hidden.key]);
                } else if (hidden instanceof Compute) {
                  show = new Compute(scope, () => !hidden.compute());
                } else {
                  show = !hidden;
                }
              }
              if (isReactive(show)) {
                let insertAt = new InsertAt(root);
                let ac: AbortController | undefined;
                show.reactive(value => {
                  if (value) {
                    ac = new AbortController();
                    insertAt.insert(renderToFragment(scope, children, ac.signal));
                  } else {
                    ac?.abort();
                  }
                });
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
              if (isReactive(valueProp)) {
                let insertAt = new InsertAt(root);
                let ac: AbortController | undefined;
                valueProp.reactive(value => {
                  const slots = filterSlots(children, value as any);
                  ac?.abort();
                  if (slots.length > 0) {
                    ac = new AbortController();
                    insertAt.insert(renderToFragment(scope, slots, ac.signal));
                  }
                });
              } else {
                renderChildren(scope, filterSlots(children, valueProp), root, abortSignal);
              }
            }
            break;
          }

          // `<list>` element
          case "list": {
            const { children } = props;
            if (isFunction(children)) {
              // todo: render list
            }
            break;
          }

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

              const { root: rootProp, children, ...attrs } = props;
              const el = document.createElement(tag);
              for (const [key, value] of Object.entries(attrs)) {
                switch (key) {
                  case "class": {
                    const updateClassName = (value: unknown) => {
                      el.className = cx(value);
                    };
                    if (isReactive(value)) {
                      value.reactive(updateClassName);
                    } else {
                      updateClassName(value);
                    }
                    break;
                  }
                  case "style": {
                    const updateStyle = (value: unknown) => {
                      if (isObject(value)) {
                        applyStyle(el, value);
                      } else if (isString(value)) {
                        el.style.cssText = value;
                      }
                    };
                    if (isReactive(value)) {
                      value.reactive(updateStyle);
                    } else {
                      updateStyle(value);
                    }
                    break;
                  }
                  case "ref":
                    if (isFunction(value)) {
                      const ret = value(el);
                      if (isFunction(ret)) {
                        onAbort(abortSignal, ret);
                      }
                    } else {
                      // todo: this.refs
                    }
                    break;
                  case "slot":
                    // todo: render slot attribute if necessary
                    break;
                  case "$checked":
                  case "$value":
                    break;
                  case "viewTransition": {
                    // const updateViewTransitionName = (value: unknown) => {
                    //   el.style.viewTransitionName = String(value);
                    // };
                    // if (isReactive(value)) {
                    //   value.reactive(updateViewTransitionName);
                    // } else {
                    //   updateViewTransitionName(value);
                    // }
                    break;
                  }
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
                      el.addEventListener(key.slice(2).toLowerCase(), value);
                    } else if (isReactive(value)) {
                      value.reactive(value => el.setAttribute(key, String(value)));
                    } else {
                      el.setAttribute(key, String(value));
                    }
                    break;
                }
              }
              (rootProp instanceof HTMLElement ? rootProp : root).appendChild(el);
              onAbort(abortSignal, () => el.remove());
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
  thisProxy[$postcall]();
  if (isObject(v) && !isVNode(v)) {
    if (v instanceof Promise) {
      let insertAt = new InsertAt(root);
      let placeholder: ChildNode[] | undefined;
      if (isVNode(props.placeholder)) {
        placeholder = [...renderToFragment(thisProxy, props.placeholder as ChildType, abortSignal).childNodes];
        root.append(...placeholder);
      }
      v.then((node) => insertAt.insert(renderToFragment(thisProxy, node as ChildType, abortSignal))).catch((err) => {
        if (isFunction(props.catch)) {
          const v = props.catch(err);
          if (isVNode(v)) {
            insertAt.insert(renderToFragment(thisProxy, v as ChildType, abortSignal));
          }
        } else {
          console.error(err);
        }
      }).finally(() => {
        // remove placeholder elements
        placeholder?.forEach(node => node.remove());
      });
    } else if (Symbol.asyncIterator in v) {
      // todo: render async generator components
      // (async () => {
      //   for await (const node of v) {
      //     render(thisProxy, node as ChildType, root, abortSignal);
      //   }
      // })();
    } else if (Symbol.iterator in v) {
      for (const node of v) {
        render(thisProxy, node as ChildType, root, abortSignal);
      }
    }
  } else {
    render(thisProxy, v as ChildType, root, abortSignal);
  }
};

const renderToFragment = (scope: Scope, node: ChildType | ChildType[], aboutSignal?: AbortSignal) => {
  const fragment = createDocumentFragment();
  renderChildren(scope, node, fragment, aboutSignal);
  return fragment;
};

const filterSlots = (slots: ChildType[], name: any) => {
  switch (typeof name) {
    case "string":
    case "number":
    case "boolean":
      return slots.filter((v) => isVNode(v) && v[1].slot === name);
    default:
      return [];
  }
};

const createThisProxy = (slots: ChildType[] | undefined, abortSignal?: AbortSignal) => {
  let watchHandlers = new Map<string, Set<() => void>>();
  let called = false;
  let depSet: Set<string> | undefined;
  onAbort(abortSignal, () => watchHandlers.clear());
  return new Proxy(new NullProtoObject(), {
    get(target, key, reciver) {
      switch (key) {
        case $slots:
          return slots;
        case $postcall:
          return () => {
            called = true;
          };
        case $docompute:
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
          };
        case "init":
          return ((args: Record<string, unknown>) => Object.assign(target, args));
        case "$":
        case "compute":
          return (fn: () => unknown) => new Compute(reciver, fn);
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
            return new Signal(reciver, String(key));
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

export { isReactive, render };
