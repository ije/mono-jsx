import type { ChildType, ComponentType, VNode } from "../types/jsx.d.ts";
import { customElements } from "../jsx.ts";
import { NullPrototypeObject, regexpIsNonDimensional } from "../runtime/utils.ts";
import { hashCode, isFunction, isPlainObject, isString, toHyphenCase } from "../runtime/utils.ts";
import { $fragment, $html, $vnode } from "../symbols.ts";

interface IScope {
  [key: string]: unknown;
  readonly [$slots]: ChildType[] | undefined;
  readonly [$get]: (key: string) => unknown;
  readonly [$watch]: (key: string, effect: () => void) => () => void;
  readonly [$expr]: (ok: boolean) => void;
  readonly extend: <T = Record<string, unknown>>(props: T) => IScope & T;
}

abstract class Reactive {
  abstract get(): unknown;
  abstract watch(callback: () => void, abortSignal: AbortSignal | undefined): void;
  reactive(effect: (value: unknown) => void, abortSignal: AbortSignal | undefined) {
    const update = () => effect(this.get());
    update();
    this.watch(update, abortSignal);
  }
  map(callback: (value: unknown, index: number) => JSX.Element) {
    return new ReactiveList(this, callback);
  }
  toString() {
    return "" + this.get();
  }
}

class Signal extends Reactive {
  #scope: IScope;
  #key: string;
  constructor(scope: IScope, key: string) {
    super();
    this.#scope = scope;
    this.#key = key;
  }
  get() {
    return this.#scope[$get](this.#key);
  }
  set(value: unknown) {
    this.#scope[this.#key] = value;
  }
  watch(callback: () => void, abortSignal: AbortSignal | undefined) {
    onAbort(abortSignal, this.#scope[$watch](this.#key, callback));
  }
}

class Computed extends Reactive {
  #scope: IScope;
  #compute: () => unknown;
  #deps?: Set<Signal>;
  constructor(
    scope: IScope,
    compute: () => unknown,
  ) {
    super();
    this.#scope = scope;
    this.#compute = compute;
  }
  get() {
    const shouldMark = !this.#deps && !$depsMark;
    if (shouldMark) {
      // start collecting dependencies
      $depsMark = new Set<Signal>();
    }
    const value = this.#compute.call(this.#scope);
    if (shouldMark) {
      this.#deps = $depsMark;
      // stop collecting dependencies
      $depsMark = undefined;
    }
    return value;
  }
  watch(callback: () => void, abortSignal: AbortSignal | undefined) {
    this.#deps?.forEach(dep => dep.watch(callback, abortSignal));
  }
}

class ReactiveList {
  constructor(
    public readonly reactive: Reactive,
    public readonly callback: (value: unknown, index: number) => JSX.Element,
  ) {}
}

class Ref {
  constructor(
    public readonly refs: Map<string, HTMLElement>,
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
  insertHTML(html: string) {
    let temp = createElement("template") as HTMLTemplateElement;
    let childNodes: ChildNode[];
    temp.innerHTML = html;
    childNodes = [...temp.content.childNodes];
    this.insert(...childNodes);
    return () => childNodes.forEach(node => node.remove());
  }
}

const document = globalThis.document;
const $get = Symbol();
const $watch = Symbol();
const $expr = Symbol();
const $slots = Symbol();
const stores = new Set<IScope>();
const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;
const createTextNode = (text = "") => document.createTextNode(text);
const createElement = (tag: string) => document.createElement(tag);
const onAbort = (signal: AbortSignal | undefined, callback: () => void) => signal?.addEventListener("abort", callback);
const setAttribute = (el: Element, name: string, value: unknown) => {
  switch (typeof value) {
    case "boolean":
      el.toggleAttribute(name, value);
      break;
    case "number":
    case "string":
      el.setAttribute(name, String(value));
      break;
  }
};
const call$expr = (scope: IScope, ok: boolean) => {
  scope[$expr](ok);
  stores.forEach(s => s[$expr](ok));
};

// for reactive dependencies tracking
let $depsMark: Set<Signal> | undefined;

const createScope = (slots?: ChildType[], abortSignal?: AbortSignal): IScope => {
  let exprMode = false;
  let watchHandlers = new Map<string, Set<() => void>>();
  let refElements = new Map<string, HTMLElement>();
  let signals = new Map<string, Signal>();
  let refs = new Proxy(new NullPrototypeObject(), {
    get(_, key: string) {
      if (!exprMode || $depsMark) {
        return refElements.get(key);
      }
      return new Ref(refElements, key);
    },
  });
  let scope = new Proxy(new NullPrototypeObject() as IScope, {
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
            return () => handlers.delete(effect);
          };
        case $expr:
          return (ok: boolean) => exprMode = ok;
        case $slots:
          return slots;
        case "init":
          return (init: Record<string, unknown>) => {
            Object.assign(target, init);
          };
        case "extend":
          return (init: Record<string, unknown>) => {
            for (const [key, { set, get, value }] of Object.entries(Object.getOwnPropertyDescriptors(init))) {
              if (set) {
                throw new TypeError("setter is not allowed");
              }
              if (get) {
                target[key] = new Computed(receiver, get);
              } else {
                if (key === "effect") {
                  if (isFunction(value)) {
                    receiver.effect(value);
                  }
                } else {
                  target[key] = value;
                }
              }
            }
            return receiver;
          };
        case "$":
        case "computed":
          return (fn: () => unknown) => new Computed(receiver, fn);
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
                }, abortSignal)
              );
              onAbort(abortSignal, () => cleanup?.());
              // stop collecting dependencies
              $depsMark = undefined;
            });
          };
        case "refs":
          return refs;
        default: {
          const value = Reflect.get(target, key as string, receiver);
          if (value instanceof Reactive) {
            return !exprMode || $depsMark ? value.get() : value;
          }
          if (!exprMode || $depsMark) {
            if ($depsMark && isString(key) && !isFunction(value)) {
              $depsMark.add(getSignal(key));
            }
            return value;
          }
          if (isString(key)) {
            return getSignal(key);
          }
          return value;
        }
      }
    },
    set(target, key, value) {
      if (isString(key)) {
        const prev = target[key];
        if (prev !== value) {
          target[key] = value;
          // todo: batch update
          watchHandlers.get(key)?.forEach((effect) => effect());
        }
      }
      return true;
    },
  });
  let getSignal = (key: string) => signals.get(key) ?? signals.set(key, new Signal(scope, key)).get(key)!;
  onAbort(abortSignal, () => {
    watchHandlers.clear();
    refElements.clear();
    signals.clear();
  });
  return scope;
};

const createStore = (props: Record<string, unknown>) => {
  const scope = createScope().extend(props);
  stores.add(scope);
  return scope;
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
          }, abortSignal);
          onAbort(abortSignal, cleanup);
          return;
        }
        if (child instanceof Reactive) {
          const textNode = createTextNode();
          child.reactive(value => {
            textNode.textContent = String(value);
          }, abortSignal);
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
              const mark = new InsertMark(root);
              if (innerHTML instanceof Reactive) {
                let cleanup: (() => void) | undefined;
                innerHTML.reactive(html => {
                  cleanup?.();
                  cleanup = mark.insertHTML(html as string);
                }, abortSignal);
                onAbort(abortSignal, () => cleanup?.());
              } else {
                onAbort(abortSignal, mark.insertHTML(innerHTML));
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

            // `<show>` and `<hidden>` elements
            case "show":
            case "hidden": {
              // todo: support viewTransition
              let { when = true, children } = props;
              if (children !== undefined) {
                if (when instanceof Reactive) {
                  let mark = new InsertMark(root);
                  let ac: AbortController | undefined;
                  when.reactive(value => {
                    ac?.abort();
                    if (tag === "show" ? value : !value) {
                      ac = new AbortController();
                      mark.insert(renderToFragment(scope, children, ac.signal));
                    }
                  }, abortSignal);
                  onAbort(abortSignal, () => ac?.abort());
                } else {
                  console.warn("[mono-jsx] <" + tag + "> The `when` prop is not a signal/computed.");
                  if (when) {
                    renderChildren(scope, children, root, abortSignal);
                  }
                }
              }
              break;
            }

            // `<switch>` element
            case "switch": {
              // todo: support viewTransition
              const { value: valueProp, children } = props;
              if (children !== undefined) {
                if (valueProp instanceof Reactive) {
                  let mark = new InsertMark(root);
                  let ac: AbortController | undefined;
                  valueProp.reactive(value => {
                    const slots = children.filter((v: unknown) => isVNode(v) && v[1].slot === String(value));
                    ac?.abort();
                    if (slots.length > 0) {
                      ac = new AbortController();
                      mark.insert(renderToFragment(scope, slots, ac.signal));
                    }
                  }, abortSignal);
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
                renderFC(tag as ComponentType, props, root, abortSignal);
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
                const el = createElement(tag);
                for (const [attrName, attrValue] of Object.entries(attrs)) {
                  switch (attrName) {
                    case "class": {
                      const updateClassName = (className: string) => {
                        el.className = [className, ...el.classList.values().filter(name => name.startsWith("css-"))].join(" ");
                      };
                      if (isString(attrValue)) {
                        updateClassName(attrValue);
                      } else {
                        let mark: Set<Reactive> | undefined = new Set();
                        let update = () => updateClassName(cx(attrValue, mark));
                        update();
                        for (const reactive of mark) {
                          reactive.watch(update, abortSignal);
                        }
                        mark = undefined;
                      }
                      break;
                    }

                    case "style": {
                      if (isString(attrValue)) {
                        el.style.cssText = attrValue;
                      } else {
                        let mark: Set<Reactive> | undefined = new Set();
                        let update = () => applyStyle(el, attrValue, mark);
                        update();
                        for (const reactive of mark) {
                          reactive.watch(update, abortSignal);
                        }
                        mark = undefined;
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
                        attrValue.refs.set(attrValue.name, el);
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
                        }, abortSignal);
                        el.addEventListener("input", () => attrValue.set((el as any)[name]));
                        // queueMicrotask(() =>
                        //   (el as HTMLInputElement).form?.addEventListener(
                        //     "reset",
                        //     () => attrValue.set(isValue ? "" : false),
                        //   )
                        // );
                      } else {
                        setAttribute(el, attrName.slice(1), attrValue);
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
                      } else if (attrValue instanceof Reactive) {
                        attrValue.reactive(value => setAttribute(el, attrName, value), abortSignal);
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

const renderFC = (fc: ComponentType, props: Record<string, unknown>, root: HTMLElement | DocumentFragment, abortSignal?: AbortSignal) => {
  let scope = createScope(props.children as ChildType[] | undefined, abortSignal) as unknown as IScope;
  let v: ReturnType<typeof fc>;
  call$expr(scope, true);
  v = fc.call(scope, props);
  if (v instanceof Promise) {
    let pendingNodes: ChildNode[] | undefined;
    if (isVNode(props.pending)) {
      pendingNodes = [...renderToFragment(scope, props.pending as ChildType, abortSignal).childNodes];
    }
    if (!pendingNodes?.length) {
      pendingNodes = [createTextNode()];
    }
    root.append(...pendingNodes);
    v.then((nodes) => {
      call$expr(scope, false);
      pendingNodes[0].replaceWith(...renderToFragment(scope, nodes as ChildType, abortSignal).childNodes);
    }).catch((err) => {
      if (isFunction(props.catch)) {
        const v = props.catch(err);
        if (isVNode(v)) {
          pendingNodes[0].replaceWith(...renderToFragment(scope, v as ChildType, abortSignal).childNodes);
        }
      } else {
        console.error(err);
      }
    }).finally(() => {
      // remove pendingNodes elements
      pendingNodes.forEach(node => node.remove());
    });
  } else {
    call$expr(scope, false);
    if (isPlainObject(v) && !isVNode(v)) {
      if (Symbol.asyncIterator in v) {
        //  todo: async generator
      } else if (Symbol.iterator in v) {
        for (const node of v) {
          render(scope, node as ChildType, root, abortSignal);
        }
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

const $ = <T>(value: T, mark?: Set<Reactive>): T => {
  if (value instanceof Reactive) {
    mark?.add(value);
    value = value.get() as T;
  }
  return value;
};

const cx = (className: unknown, mark?: Set<Reactive>): string => {
  className = $(className, mark);
  if (isString(className)) {
    return className;
  }
  if (typeof className === "object" && className !== null) {
    return (
      Array.isArray(className)
        ? className.map(cn => cx(cn, mark)).filter(Boolean)
        : Object.entries(className).filter(([, v]) => !!$(v, mark)).map(([k]) => k)
    ).join(" ");
  }
  return "";
};

const applyStyle = (el: HTMLElement, style: unknown, mark?: Set<Reactive>): void => {
  style = $(style, mark);
  if (isPlainObject(style)) {
    let { classList } = el;
    let inline: Record<string, unknown> | undefined;
    classList.remove(...classList.values().filter(key => key.startsWith("css-")));
    for (let [k, v] of Object.entries(style)) {
      v = $(v, mark);
      let css: (string | null)[] = [];
      switch (k.charCodeAt(0)) {
        case /* ':' */ 58:
          if (isPlainObject(v)) {
            css.push(k.startsWith("::view-") ? "" : null, k + renderStyle(v, mark));
          }
          break;
        case /* '@' */ 64:
          if (isPlainObject(v)) {
            if (k.startsWith("@keyframes ")) {
              css.push(k + "{" + Object.entries(v).map(([k, v]) => isPlainObject(v) ? k + renderStyle(v, mark) : "").join("") + "}");
            } else if (k.startsWith("@view-")) {
              css.push(k + renderStyle(v, mark));
            } else {
              css.push(k + "{", null, renderStyle(v, mark) + "}");
            }
          }
          break;
        case /* '&' */ 38:
          if (isPlainObject(v)) {
            css.push(null, k.slice(1) + renderStyle(v, mark));
          }
          break;
        default:
          inline ??= {};
          inline[k] = v;
      }
      if (css.length) {
        classList.add(computeStyleClassName(css));
      }
    }
    if (inline) {
      classList.add(computeStyleClassName([null, renderStyle(inline)]));
    }
  } else if (isString(style)) {
    el.style.cssText = style;
  }
};

const renderStyle = (style: Record<string, unknown>, mark?: Set<Reactive>): string => {
  let css = "";
  let vt: string;
  let cssKey: string;
  let cssValue: string;
  for (let [k, v] of Object.entries(style)) {
    v = $(v, mark);
    vt = typeof v;
    if (vt === "string" || vt === "number") {
      cssKey = toHyphenCase(k);
      cssValue = vt === "number" ? (regexpIsNonDimensional.test(k) ? "" + v : v + "px") : "" + v;
      css += (css ? ";" : "") + cssKey + ":" + (cssKey === "content" ? JSON.stringify(cssValue) : cssValue) + ";";
    }
  }
  return "{" + css + "}";
};

const computeStyleClassName = (css: (string | null)[]) => {
  const hash = hashCode(css.join("")).toString(36);
  const className = "css-" + hash;
  if (!document.getElementById(className)) {
    const styleEl = document.head.appendChild(createElement("style"));
    styleEl.id = className;
    styleEl.textContent = css.map(v => v === null ? "." + className : v).join("");
  }
  return className;
};

export { createStore, Reactive, render };
