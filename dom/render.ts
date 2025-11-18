import type { ChildType, FC, VNode } from "../types/jsx.d.ts";
import { customElements } from "../jsx.ts";
import { applyStyle, cx, isFunction, isObject, isString, NullProtoObject } from "../runtime/utils.ts";
import { $fragment, $html, $vnode } from "../symbols.ts";

interface IScope {
  [key: string]: unknown;
  readonly [$get]: (key: string) => unknown;
  readonly [$watch]: (key: string, effect: () => void) => void;
  readonly [$postbind]: () => void;
  readonly [$slots]: ChildType[] | undefined;
}

interface IReactive<T = unknown> {
  reactive(effect: (value: T) => void): void;
}

class Signal implements IReactive {
  constructor(
    public readonly scope: IScope,
    public readonly key: string,
  ) {}
  get value() {
    return this.scope[$get](this.key);
  }
  set value(value: unknown) {
    this.scope[this.key] = value;
  }
  reactive(effect: (value: unknown) => void) {
    const update = () => effect(this.value);
    update();
    this.watch(update);
  }
  map(callback: (value: unknown, index: number) => JSX.Element) {
    return new ReactiveList(this, callback);
  }
  watch(callback: () => void) {
    this.scope[$watch](this.key, callback);
  }
}

class Compute implements IReactive {
  constructor(
    public readonly scope: IScope,
    public readonly compute: () => unknown,
  ) {}
  reactive(effect: (value: unknown) => void) {
    const update = () => effect(this.compute.call(this.scope));
    // start collecting dependencies
    $depsMark = new Set<Signal>();
    update();
    $depsMark.forEach((dep) => dep.watch(update));
    // stop collecting dependencies
    $depsMark = undefined;
  }
  map(callback: (value: unknown, index: number) => JSX.Element) {
    return new ReactiveList(this, callback);
  }
}

class ReactiveList {
  constructor(
    public readonly reactive: IReactive,
    public readonly callback: (value: unknown, index: number) => JSX.Element,
  ) {}
}

class Ref {
  constructor(
    public readonly refs: Record<string, HTMLElement>,
    public readonly name: string,
  ) {}
}

class InsertMark {
  #root: HTMLElement | DocumentFragment;
  #index: number;
  constructor(root: HTMLElement | DocumentFragment) {
    this.#root = root;
    this.#index = root.childNodes.length;
  }
  insert(...nodes: Node[]) {
    let argsN = nodes.length;
    let tmp: Text | undefined;
    if (argsN) {
      if (argsN > 1) tmp = createTextNode();
      this.#root.insertBefore(tmp ?? nodes[0], this.#root.childNodes[this.#index]);
      tmp?.replaceWith(...nodes);
    }
  }
}

const $get = Symbol();
const $watch = Symbol();
const $postbind = Symbol();
const $slots = Symbol();
const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;
const isReactive = (v: unknown): v is Signal | Compute => v instanceof Signal || v instanceof Compute;
const createTextNode = (text = "") => document.createTextNode(text);
const onAbort = (signal: AbortSignal | undefined, callback: () => void) => signal?.addEventListener("abort", callback);
const setAttribute = (el: Element, name: string, value: unknown) => {
  const type = typeof value;
  if (type === "boolean") {
    el.toggleAttribute(name, value as boolean);
  } else if (type === "number" || type === "string") {
    el.setAttribute(name, String(value));
  }
};

const render = (scope: IScope, child: ChildType, root: HTMLElement | DocumentFragment, abortSignal?: AbortSignal) => {
  switch (typeof child) {
    case "boolean":
    case "undefined":
      return;
    case "object":
      if (child !== null) {
        if (child instanceof ReactiveList) {
          let { reactive, callback } = child;
          let insertMark = new InsertMark(root);
          let list = new Map<unknown, Array<[AbortController, Array<ChildNode>, number]>>();
          let cleanup = () => {
            list.forEach((items) => items.forEach(([ac]) => ac.abort()));
            list.clear();
          };
          reactive.reactive(arr => {
            if (!Array.isArray(arr)) {
              throw new TypeError("map is not a function");
            }
            let nodes: ChildNode[] = [];
            let newList: typeof list = new Map();
            arr.forEach((item, index) => {
              let render = list.get(item)?.shift();
              if (callback.length >= 2 && render && render[2] !== index) {
                render[0].abort();
                render = undefined;
              }
              if (!render) {
                const ac = new AbortController();
                render = [ac, [...renderToFragment(scope, callback(item, index), ac.signal).childNodes], index];
              }
              nodes.push(...render[1]);
              if (newList.has(item)) {
                newList.get(item)!.push(render);
              } else {
                newList.set(item, [render]);
              }
            });
            cleanup();
            insertMark.insert(...nodes);
            list = newList;
          });
          onAbort(abortSignal, cleanup);
          return;
        }
        if (isReactive(child)) {
          const textNode = createTextNode();
          child.reactive(value => {
            textNode.textContent = String(value);
          });
          root.appendChild(textNode);
          onAbort(abortSignal, () => textNode.remove());
          return;
        }
        if (isVNode(child)) {
          const [tag, props] = child;
          switch (tag) {
            // fragment element
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

            // `<if>` element
            case "if": {
              // todo: support viewTransition
              let { value: valueProp, children } = props;
              if (children !== undefined) {
                if (isReactive(valueProp)) {
                  let mark = new InsertMark(root);
                  let ac: AbortController | undefined;
                  valueProp.reactive(value => {
                    ac?.abort();
                    if (value) {
                      ac = new AbortController();
                      mark.insert(renderToFragment(scope, children, ac.signal));
                    }
                  });
                  onAbort(abortSignal, () => ac?.abort());
                } else if (valueProp) {
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
                  let mark = new InsertMark(root);
                  let ac: AbortController | undefined;
                  valueProp.reactive(value => {
                    const slots = children.filter((v: unknown) => isVNode(v) && v[1].slot === String(value));
                    ac?.abort();
                    if (slots.length > 0) {
                      ac = new AbortController();
                      mark.insert(renderToFragment(scope, slots, ac.signal));
                    }
                  });
                  onAbort(abortSignal, () => ac?.abort());
                } else {
                  renderChildren(
                    scope,
                    children.filter((v: unknown) => isVNode(v) && v[1].slot === String(valueProp)),
                    root,
                    abortSignal,
                  );
                }
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
                // custom element
                if (customElements.has(tag)) {
                  renderFC(customElements.get(tag)!, props, root, abortSignal);
                  break;
                }

                const { portal, children, ...attrs } = props;
                const el = document.createElement(tag);
                for (const [attrName, attrValue] of Object.entries(attrs)) {
                  switch (attrName) {
                    case "class": {
                      const updateClassName = (value: unknown) => {
                        el.className = cx(value);
                      };
                      if (isReactive(attrValue)) {
                        attrValue.reactive(updateClassName);
                      } else {
                        updateClassName(attrValue);
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
                      if (isReactive(attrValue)) {
                        attrValue.reactive(updateStyle);
                      } else {
                        updateStyle(attrValue);
                      }
                      break;
                    }

                    case "ref":
                      if (isFunction(attrValue)) {
                        const ret = attrValue(el);
                        if (isFunction(ret)) {
                          onAbort(abortSignal, ret);
                        }
                      } else if (attrValue instanceof Ref) {
                        attrValue.refs[attrValue.name] = el;
                      }
                      break;

                    case "slot":
                      // todo: render slot attribute if necessary
                      break;

                    case "$checked":
                    case "$value":
                      if (attrValue instanceof Signal) {
                        const name = attrName.slice(1);
                        const isValue = name.charAt(0) === "v";
                        attrValue.reactive(value => {
                          (el as any)[name] = isValue ? String(value) : !!value;
                        });
                        el.addEventListener("input", () => attrValue.value = (el as any)[name]);
                        // queueMicrotask(() =>
                        //   (el as HTMLInputElement).form?.addEventListener(
                        //     "reset",
                        //     () => attrValue.set(isValue ? "" : false),
                        //   )
                        // );
                      } else {
                        throw new TypeError("not a signal");
                      }
                      break;

                    case "viewTransition":
                      // const updateViewTransitionName = (value: unknown) => {
                      //   el.style.viewTransitionName = String(value);
                      // };
                      // if (isReactive(value)) {
                      //   value.reactive(updateViewTransitionName);
                      // } else {
                      //   updateViewTransitionName(value);
                      // }
                      break;

                    case "action":
                      if (isFunction(attrValue) && tag === "form") {
                        el.addEventListener("submit", (evt) => {
                          evt.preventDefault();
                          attrValue(new FormData(evt.target as HTMLFormElement), evt);
                        });
                      } else {
                        setAttribute(el, attrName, attrValue);
                      }
                      break;

                    default:
                      if (attrName.startsWith("on") && isFunction(attrValue)) {
                        el.addEventListener(attrName.slice(2).toLowerCase(), attrValue);
                      } else if (isReactive(attrValue)) {
                        attrValue.reactive(value => setAttribute(el, attrName, value));
                      } else {
                        setAttribute(el, attrName, attrValue);
                      }
                      break;
                  }
                }
                onAbort(abortSignal, () => el.remove());
                (portal instanceof HTMLElement ? portal : root).appendChild(el);
                if (children !== undefined) {
                  renderChildren(scope, children, el, abortSignal);
                }
              }
            }
          }
          return;
        }
      }
  }

  // render to text node
  const textNode = createTextNode(String(child));
  root.appendChild(textNode);
  onAbort(abortSignal, () => textNode.remove());
};

const renderChildren = (
  scope: IScope,
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
  const scope = createScope(props.children as ChildType[] | undefined, abortSignal) as unknown as IScope;
  const v = fc.call(scope, props);
  if (v instanceof Promise) {
    let placeholder: ChildNode[] | undefined;
    if (isVNode(props.placeholder)) {
      placeholder = [...renderToFragment(scope, props.placeholder as ChildType, abortSignal).childNodes];
    }
    if (!placeholder?.length) {
      placeholder = [createTextNode()];
    }
    root.append(...placeholder);
    v.then((nodes) => {
      scope[$postbind]();
      placeholder[0].replaceWith(...renderToFragment(scope, nodes as ChildType, abortSignal).childNodes);
    }).catch((err) => {
      if (isFunction(props.catch)) {
        const v = props.catch(err);
        if (isVNode(v)) {
          placeholder[0].replaceWith(...renderToFragment(scope, v as ChildType, abortSignal).childNodes);
        }
      } else {
        console.error(err);
      }
    }).finally(() => {
      // remove placeholder elements
      placeholder.forEach(node => node.remove());
    });
  } else {
    scope[$postbind]();
    if (isObject(v) && !isVNode(v) && Symbol.iterator in v) {
      for (const node of v) {
        render(scope, node as ChildType, root, abortSignal);
      }
    } else {
      render(scope, v as ChildType, root, abortSignal);
    }
  }
};

const renderToFragment = (scope: IScope, node: ChildType | ChildType[], aboutSignal?: AbortSignal) => {
  const fragment = document.createDocumentFragment();
  renderChildren(scope, node, fragment, aboutSignal);
  return fragment;
};

// for reactive dependencies tracking
let $depsMark: Set<Signal> | undefined;

const createScope = (slots: ChildType[] | undefined, abortSignal?: AbortSignal): IScope => {
  let isBound = false;
  let watchHandlers = new Map<string, Set<() => void>>();
  let signals = new Map<string, Signal>();
  let refs = new Proxy(new NullProtoObject(), {
    get(target, key: string) {
      if (isBound || $depsMark) {
        return target[key];
      }
      return new Ref(target, key);
    },
  });
  let scope = new Proxy(new NullProtoObject() as IScope, {
    get(target, key, receiver) {
      switch (key) {
        case $get:
          return (key: string) => target[key];
        case $watch:
          return (key: string, effect: () => void) => {
            let handlers = watchHandlers.get(key);
            if (!handlers) {
              handlers = new Set();
              watchHandlers.set(key, handlers);
            }
            handlers.add(effect);
          };
        case $postbind:
          return () => isBound = true;
        case $slots:
          return slots;
        case "init":
          return ((args: Record<string, unknown>) => Object.assign(target, args));
        case "$":
        case "compute":
          return (fn: () => unknown) => new Compute(receiver, fn);
        case "effect":
          return (callback: () => (() => void) | void) => {
            queueMicrotask(() => {
              // start collecting dependencies
              $depsMark = new Set<Signal>();
              let cleanup = callback.call(receiver);
              $depsMark.forEach((dep) =>
                dep.watch(() => {
                  cleanup?.();
                  cleanup = callback.call(receiver);
                })
              );
              onAbort(abortSignal, () => cleanup?.());
              // stop collecting dependencies
              $depsMark = undefined;
            });
          };
        case "refs":
          return refs;
        default:
          if (isBound || $depsMark) {
            if ($depsMark && isString(key)) {
              $depsMark.add(getSignal(key));
            }
            return target[key as string];
          }
          if (isString(key)) {
            return getSignal(key);
          }
      }
    },
    set(target, key, value) {
      if (isString(key)) {
        const prev = target[key];
        if (prev !== value) {
          target[key] = value;
          watchHandlers.get(key)?.forEach((effect) => effect());
        }
      }
      return true;
    },
  });
  let getSignal = (key: string) => signals.get(key) ?? signals.set(key, new Signal(scope, key)).get(key)!;
  onAbort(abortSignal, () => {
    watchHandlers.clear();
    signals.clear();
  });
  return scope;
};

export { createScope, isReactive, render };
