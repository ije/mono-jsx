import type { ChildType } from "./types/mono.d.ts";
import type { FC, VNode } from "./types/jsx.d.ts";
import type { MaybeModule, RenderOptions } from "./types/render.d.ts";
import { CX, EVENT, LAZY, ROUTER, SIGNALS, STYLE, SUSPENSE } from "./runtime/index.ts";
import { CX_JS, EVENT_JS, LAZY_JS, ROUTER_JS, SIGNALS_JS, STYLE_JS, SUSPENSE_JS } from "./runtime/index.ts";
import { RENDER_ATTR, RENDER_LIST, RENDER_SWITCH, RENDER_TOGGLE } from "./runtime/index.ts";
import { RENDER_ATTR_JS, RENDER_LIST_JS, RENDER_SWITCH_JS, RENDER_TOGGLE_JS } from "./runtime/index.ts";
import { cx, escapeHTML, isObject, isString, NullProtoObj, styleToCSS, toHyphenCase } from "./runtime/utils.ts";
import { $fragment, $html, $index, $item, $path, $signal, $vnode } from "./symbols.ts";
import { VERSION } from "./version.ts";

interface RenderContext {
  write: (chunk: string) => void;
  suspenses: Array<Promise<string>>;
  signals: SignalsContext;
  flags: Flags;
  mcs: IdGen<Signal>;
  mfs: IdGen<CallableFunction>;
  eager?: boolean;
  context?: Record<string, unknown>;
  request?: Request;
  routeFC?: MaybeModule<FC<any>>;
  fcCtx?: FCContext;
}

interface FCContext {
  scopeId: number;
  signals: Record<symbol | string, unknown>;
  slots: Array<ChildType> | undefined;
  forSignal: number;
}

interface Flags {
  scope: number;
  chunk: number;
  refs: number;
  runtime: number;
}

interface SignalsContext {
  app: Record<string, unknown>;
  store: Map<string, unknown>;
  effects: Array<string>;
}

interface IdGen<K> {
  readonly size: number;
  entries(): Iterable<[K, number]>;
  clear(): void;
  gen(key: K): number;
}

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

const cdn = "https://raw.esm.sh"; // the cdn for loading htmx and its extensions
const encoder = new TextEncoder();
const customElements = new Map<string, FC>();
const selfClosingTags = new Set("area,base,br,col,embed,hr,img,input,keygen,link,meta,param,source,track,wbr".split(","));
const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;
const isSignal = (v: unknown): v is Signal => isObject(v) && !!(v as any)[$signal];
const isObjectStub = (v: unknown): v is { [$path]: string[] } => isObject(v) && !!((v as any)[$path]);
const hashCode = (s: string) => [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);
const escapeCSSText = (str: string): string => str.replace(/[<>]/g, (m) => m.charCodeAt(0) === 60 ? "&lt;" : "&gt;");
const toAttrStringLit = (str: string) => '"' + escapeHTML(str) + '"';
const toStr = <T = string | number>(v: T | undefined, str: (v: T) => string) => v !== undefined ? str(v) : "";
const toStrLit = JSON.stringify;

// @internal
class Ref {
  constructor(
    public scope: number,
    public name: string,
  ) {}
}

// @internal
class IdGenImpl<T> extends Map<T, number> implements IdGen<T> {
  private _id = 0;
  gen(v: T) {
    return this.get(v) ?? this.set(v, this._id++).get(v)!;
  }
}

/** The JSX namespace. */
export const JSX = {
  customElements: {
    define(tagName: string, fc: FC) {
      customElements.set(tagName, fc);
    },
  },
};

/** Renders a `<html>` element to a `Response` object. */
export function renderHtml(node: VNode, options: RenderOptions): Response {
  const { routes, components } = options;
  const request: Request & { URL?: URL; params?: Record<string, string> } | undefined = options.request;
  const headers = new Headers();
  const reqHeaders = request?.headers;
  const componentHeader = reqHeaders?.get("x-component");

  let routeFC: MaybeModule<FC<any>> | undefined = request ? Reflect.get(request, "x-route") : undefined;
  let component = componentHeader ? components?.[componentHeader] : null;
  let status = options.status;

  if (request) {
    request.URL = new URL(request.url);
  }

  if (routes && !routeFC) {
    if (request) {
      const patterns = Object.keys(routes);
      const dynamicPatterns = [];
      for (const pattern of patterns) {
        if (pattern.includes(":") || pattern.includes("*")) {
          dynamicPatterns.push(pattern);
        } else if (request.URL!.pathname === pattern) {
          routeFC = routes[pattern];
          break;
        }
      }
      if (!routeFC) {
        for (const path of dynamicPatterns) {
          const match = new URLPattern({ pathname: path }).exec(request.url);
          if (match) {
            routeFC = routes[path];
            request.params = match.pathname.groups as Record<string, string>;
            break;
          }
        }
      }
    } else {
      console.error("The `request` prop in the `<html>` element is required for routing.");
    }
    if (!routeFC) {
      status = 404;
    }
  }

  if (components && !request) {
    console.warn("The `components` prop in the `<html>` element is ignored when `request` is not provided.");
  }

  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      if (value) {
        headers.set(toHyphenCase(key), value);
      }
    }
  }

  if (reqHeaders?.get("x-route") === "true") {
    if (!routeFC) {
      return Response.json({ error: { message: "Route not found" }, status }, { headers, status });
    }
    component = routeFC;
  }

  if (component) {
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            const propsHeader = reqHeaders?.get("x-props");
            const props = propsHeader ? JSON.parse(propsHeader) : {};
            let html = "";
            let js = "";
            await render(
              [component instanceof Promise ? (await component).default : component, props, $vnode],
              options,
              (chunk) => html += chunk,
              (chunk) => js += chunk,
              true,
            );
            let json = "[" + toStrLit(html);
            if (js) {
              json += "," + toStrLit(js);
            }
            controller.enqueue(encoder.encode(json + "]"));
          } finally {
            controller.close();
          }
        },
      }),
      { headers },
    );
  } else if (componentHeader) {
    return new Response("Component not found: " + component, { status: 404 });
  }

  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("transfer-encoding", "chunked");
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        const { htmx } = options;
        const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
        Reflect.set(options, "routeFC", routeFC);
        try {
          write("<!DOCTYPE html>");
          await render(node, options, write, (js) => write('<script data-mono-jsx="' + VERSION + '">' + js + "</script>"));
          if (htmx) {
            write(`<script src="${cdn}/htmx.org${htmx === true ? "" : escapeHTML("@" + htmx)}/dist/htmx.min.js"></script>`);
            for (const [name, version] of Object.entries(options)) {
              if (name.startsWith("htmx-ext-") && version) {
                write(`<script src="${cdn}/${name}${version === true ? "" : escapeHTML("@" + version)}"></script>`);
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    }),
    { headers, status },
  );
}

// @internal
async function render(
  node: VNode,
  options: RenderOptions & { routeFC?: FC<any> },
  write: (chunk: string) => void,
  writeJS: (chunk: string) => void,
  componentMode?: boolean,
) {
  const { app, context, request, routeFC } = options;
  const suspenses: Promise<string>[] = [];
  const signals: SignalsContext = {
    app: Object.assign(createSignals(0, null, context, request), app),
    store: new Map(),
    effects: [],
  };
  const rc: RenderContext = {
    write,
    suspenses,
    context,
    request,
    signals,
    routeFC,
    eager: componentMode,
    flags: { scope: 0, chunk: 0, refs: 0, runtime: 0 },
    mcs: new IdGenImpl<Signal>(),
    mfs: new IdGenImpl<CallableFunction>(),
  };
  // finalize creates runtime JS for client
  // it may be called recursively when thare are unresolved suspenses
  const finalize = async () => {
    const hasEffect = signals.effects.length > 0;
    const treeshake = (flag: number, code: string, force?: boolean) => {
      if ((force || rc.flags.runtime & flag) && !(runtimeFlag & flag)) {
        runtimeFlag |= flag;
        js += code;
      }
    };
    let js = "";
    treeshake(CX, CX_JS);
    treeshake(STYLE, STYLE_JS);
    treeshake(EVENT, EVENT_JS, rc.mfs.size > 0);
    if ((signals.store.size > 0 || rc.mcs.size > 0 || hasEffect)) {
      treeshake(RENDER_ATTR, RENDER_ATTR_JS);
      treeshake(RENDER_TOGGLE, RENDER_TOGGLE_JS);
      treeshake(RENDER_SWITCH, RENDER_SWITCH_JS);
      treeshake(RENDER_LIST, RENDER_LIST_JS);
      treeshake(SIGNALS, SIGNALS_JS, true);
    }
    treeshake(SUSPENSE, SUSPENSE_JS, suspenses.length > 0);
    treeshake(LAZY, LAZY_JS);
    treeshake(ROUTER, ROUTER_JS);
    if (js.length > 0) {
      js = "(()=>{" + js + "})();/* --- */window.$runtimeFlag=" + runtimeFlag + ";";
    }
    if ((runtimeFlag & LAZY) || (runtimeFlag & ROUTER)) {
      js += "window.$scopeSeq=" + rc.flags.scope + ";";
    }
    if (rc.mfs.size > 0) {
      for (const [fn, i] of rc.mfs.entries()) {
        js += "function $MF_" + i + "(){(" + fn.toString() + ").apply(this,arguments)};";
      }
      rc.mfs.clear();
    }
    if (hasEffect) {
      js += signals.effects.splice(0, signals.effects.length).join("");
    }
    if ((runtimeFlag & ROUTER) && request && (rc.mcs.size > 0 || hasEffect)) {
      const { params } = request as Request & { params?: Record<string, string> };
      js += '$MS("0:url", Object.assign(new URL(' + toStrLit(request.url) + ")," + (params ? toStrLit(params) : "void 0")
        + "));";
    }
    if (signals.store.size > 0) {
      for (const [key, value] of signals.store.entries()) {
        if (key !== "0:url") {
          js += "$MS(" + toStrLit(key) + (value !== undefined ? "," + toStrLit(value) : "") + ");";
        }
      }
      signals.store.clear();
    }
    if (rc.mcs.size > 0) {
      for (const [mc, i] of rc.mcs.entries()) {
        const { compute, deps } = mc[$signal].key as Compute;
        js += "$MC(" + i + ",function(){return(" + compute.toString() + ").call(this)},"
          + toStrLit([...deps.values()])
          + ");";
      }
      rc.mcs.clear();
    }
    if (js.length > 0) {
      writeJS(js);
    }
    if (suspenses.length > 0) {
      await Promise.all(suspenses.splice(0, suspenses.length).map((suspense) => suspense.then(write)));
      await finalize();
    }
  };
  let runtimeFlag = 0;
  if (componentMode && request) {
    rc.flags.scope = Number(request.headers.get("x-scope-seq")) || 0;
    runtimeFlag = Number(request.headers.get("x-runtime-flag")) || 0;
  }
  await renderNode(rc, node as ChildType);
  if (rc.flags.scope > 0 && !componentMode) {
    markSignals(rc, signals.app);
  }
  await finalize();
}

// @internal
async function renderNode(rc: RenderContext, node: ChildType, stripSlotProp?: boolean): Promise<void> {
  const { write } = rc;
  switch (typeof node) {
    case "string":
      write(escapeHTML(node));
      break;
    case "number":
    case "bigint":
      write(String(node));
      break;
    case "object":
      if (node === null) {
        // skip null
      } else if (isSignal(node)) {
        renderSignal(rc, node, undefined, node[$signal].value);
      } else if (isObjectStub(node)) {
        const { fcCtx } = rc;
        const path = node[$path];
        if (fcCtx) {
          let buffer = "";
          if (fcCtx.forSignal) {
            const item = fcCtx.signals[$item];
            let value: any = item;
            for (const key of path) {
              value = value[key];
            }
            buffer = escapeHTML(String(value));
          }
          if (~fcCtx.forSignal) {
            write("<m-item :=" + toAttrStringLit("." + path.join(".")) + ">" + buffer + "</m-item>");
          } else {
            write(buffer);
          }
        }
      } else if (isVNode(node)) {
        const [tag, props] = node;
        switch (tag) {
          // fragment element
          case $fragment: {
            if (props.children !== undefined) {
              await renderChildren(rc, props.children);
            }
            break;
          }

          // XSS!
          case $html: {
            const { innerHTML } = props;
            if (innerHTML) {
              if (isSignal(innerHTML)) {
                renderSignal(rc, innerHTML, "html", String(innerHTML[$signal].value), true);
              } else {
                write(innerHTML);
              }
            }
            break;
          }

          // for iter index
          case $index: {
            const { fcCtx } = rc;
            if (fcCtx) {
              let buffer = "";
              if (fcCtx.forSignal) {
                buffer = String(fcCtx.signals[$index]);
              }
              if (~fcCtx.forSignal) {
                write("<m-index>" + buffer + "</m-index>");
              } else {
                write(buffer);
              }
            }

            break;
          }

          // `<slot>` element
          case "slot": {
            const fcSlots = rc.fcCtx?.slots;
            if (fcSlots) {
              let slots: ChildType[];
              if (props.name) {
                slots = fcSlots.filter((v) => isVNode(v) && v[1].slot === props.name);
              } else {
                slots = fcSlots.filter((v) => !isVNode(v) || !v[1].slot);
              }
              // use the children of the slot as fallback if nothing is slotted
              if (slots.length === 0) {
                slots = props.children;
              }
              await renderChildren(rc, slots, true);
            }
            break;
          }

          // `<toggle>` element
          case "toggle": {
            let { show, hidden, children } = props;
            if (children !== undefined) {
              if (show === undefined && hidden !== undefined) {
                if (isSignal(hidden)) {
                  let { scope, key, value } = hidden[$signal];
                  if (typeof key === "string") {
                    key = {
                      compute: "()=>!this[" + toStrLit(key) + "]",
                      deps: new Set([scope + ":" + key]),
                    };
                  } else {
                    key = {
                      compute: "()=>!(" + key.compute + ")()",
                      deps: key.deps,
                    };
                  }
                  show = Signal(scope, key, !value);
                } else {
                  show = !hidden;
                }
              }
              if (isSignal(show)) {
                const { scope, key, value } = show[$signal];
                let buf = '<m-signal mode="toggle" scope="' + scope + '" ';
                if (isString(key)) {
                  buf += "key=" + toAttrStringLit(key) + ">";
                } else {
                  buf += 'computed="' + rc.mcs.gen(show) + '">';
                }
                if (!value) {
                  buf += "<template m-slot>";
                }
                rc.flags.runtime |= RENDER_TOGGLE;
                write(buf);
                await renderChildren(rc, children);
                write((!value ? "</template>" : "") + "</m-signal>");
              } else if (show) {
                await renderChildren(rc, children);
              }
            }
            break;
          }

          // `<switch>` element
          case "switch": {
            const { value: valueProp, children } = props;
            if (children !== undefined) {
              let slots = Array.isArray(children) ? (isVNode(children) ? [children] : children) : [children];
              let stateful: string | undefined;
              let toSlotName: string;
              if (isSignal(valueProp)) {
                const { scope, key, value } = valueProp[$signal];
                stateful = '<m-signal mode="switch" scope="' + scope + '" ';
                if (isString(key)) {
                  stateful += "key=" + toAttrStringLit(key) + ">";
                } else {
                  stateful += 'computed="' + rc.mcs.gen(valueProp) + '">';
                }
                rc.flags.runtime |= RENDER_SWITCH;
                toSlotName = String(value);
              } else {
                toSlotName = String(valueProp);
              }
              let matchedSlot: [string, ChildType] | undefined;
              let namedSlots: ChildType[] = new Array(slots.length);
              let unnamedSlots: ChildType[] = new Array(slots.length);
              for (const slot of slots) {
                if (!isVNode(slot) || !slot[1].slot) {
                  unnamedSlots.push(slot);
                  continue;
                }
                const slotName = slot[1].slot;
                if (slotName === toSlotName) {
                  matchedSlot = [slotName, slot as ChildType];
                } else {
                  namedSlots.push(slot as ChildType);
                }
              }
              if (stateful) {
                write(matchedSlot ? stateful.slice(0, -1) + " match=" + toAttrStringLit(matchedSlot[0]) + ">" : stateful);
              }
              if (matchedSlot) {
                await renderNode(rc, matchedSlot[1], true);
              } else if (unnamedSlots.length > 0) {
                await renderChildren(rc, unnamedSlots);
              }
              if (stateful) {
                if (namedSlots.length > 0 || (matchedSlot && unnamedSlots.length > 0)) {
                  write("<template m-slot>");
                  await renderChildren(rc, namedSlots);
                  if (matchedSlot && unnamedSlots.length > 0) {
                    await renderChildren(rc, unnamedSlots);
                  }
                  write("</template>");
                }
                write("</m-signal>");
              }
            }
            break;
          }

          // `<for>` element
          case "for": {
            let { fcCtx } = rc;
            let { items, children } = props;
            let signal: Signal | undefined;
            if (!children || !fcCtx) {
              // nothing to render
              break;
            }
            if (isSignal(items)) {
              signal = items;
              items = signal[$signal].value;
              rc.flags.runtime |= RENDER_LIST;
            }
            if (Array.isArray(items)) {
              if (signal) {
                let template = "";
                const len = items.length;
                fcCtx.forSignal = len;
                if (len === 0) {
                  const write = (chunk: string) => {
                    template += chunk;
                  };
                  write("<template m-slot>");
                  await renderChildren({ ...rc, write }, children);
                  write("</template>");
                }
                renderSignal(rc, signal, "list", template, true);
                if (len > 0) {
                  write("<!--[-->");
                }
              }
              for (let i = 0; i < items.length; i++) {
                fcCtx.signals[$index] = i;
                fcCtx.signals[$item] = items[i];
                if (signal && i > 0) {
                  write("<!--,-->");
                }
                await renderChildren(rc, children);
              }
              if (signal && items.length > 0) {
                write("<!--]-->");
              }
              // gc
              fcCtx.signals[$index] = undefined;
              fcCtx.signals[$item] = undefined;
              fcCtx.forSignal = -1;
            }
            break;
          }

          // `<component>` element
          case "component": {
            const { placeholder } = props;
            let attrs = "";
            let attrModifiers = "";
            for (const p of ["name", "props"]) {
              let propValue = props[p];
              const [attr, , attrSignal] = renderAttr(rc, p, propValue);
              if (attrSignal) {
                const write = (chunk: string) => {
                  attrModifiers += chunk;
                };
                renderSignal({ ...rc, write }, attrSignal, [p]);
                rc.flags.runtime |= RENDER_ATTR;
                propValue = attrSignal[$signal].value;
              }
              attrs += attr;
            }
            let buf = "<m-component" + attrs + ">";
            if (placeholder) {
              const write = (chunk: string) => {
                buf += chunk;
              };
              await renderChildren({ ...rc, write }, placeholder);
            }
            buf += "</m-component>";
            if (attrModifiers) {
              buf += "<m-group>" + attrModifiers + "</m-group>";
            }
            write(buf);
            rc.flags.runtime |= LAZY;
            break;
          }

          // `<router>` element
          case "router": {
            const { routeFC } = rc;
            const { children } = props;
            const status = routeFC ? 200 : 404;
            write('<m-router status="' + status + '">');
            if (routeFC) {
              await renderFC(rc, routeFC instanceof Promise ? (await routeFC).default : routeFC, {});
            }
            let buf = "";
            if (children) {
              if (routeFC) {
                buf += "<template m-slot>";
              }
              const write = (chunk: string) => {
                buf += chunk;
              };
              await renderChildren({ ...rc, write }, children);
              if (routeFC) {
                buf += "</template>";
              }
            }
            buf += "</m-router>";
            write(buf);
            rc.flags.runtime |= ROUTER;
            break;
          }

          default: {
            // function component
            if (typeof tag === "function") {
              await renderFC(rc, tag as FC, props);
              break;
            }

            // regular html element
            if (isString(tag)) {
              // check if the tag is a custom element
              if (customElements.has(tag)) {
                await renderFC(rc, customElements.get(tag)!, props);
                break;
              }
              let buffer = "<" + tag;
              let attrModifiers = "";
              for (let [propName, propValue] of Object.entries(props)) {
                if (propName === "children") {
                  continue;
                }
                const [attr, addonHtml, signalValue] = renderAttr(rc, propName, propValue, stripSlotProp);
                if (addonHtml) {
                  write(addonHtml);
                }
                if (signalValue) {
                  const write = (chunk: string) => {
                    attrModifiers += chunk;
                  };
                  renderSignal({ ...rc, write }, signalValue, [propName]);
                  rc.flags.runtime |= RENDER_ATTR;
                }
                buffer += attr;
              }
              write(buffer + ">");
              if (!selfClosingTags.has(tag)) {
                if (attrModifiers) {
                  write(attrModifiers);
                }
                if (props.innerHTML) {
                  write(props.innerHTML);
                } else if (props.children !== undefined) {
                  await renderChildren(rc, props.children);
                }
                write("</" + tag + ">");
              } else if (attrModifiers) {
                write("<m-group>" + attrModifiers + "</m-group>");
              }
            }
          }
        }
      } else if (Array.isArray(node)) {
        if (node.length > 0) {
          await renderChildren(rc, node);
        }
      }
      break;
  }
}

// @internal
async function renderChildren(rc: RenderContext, children: ChildType | ChildType[], stripSlotProp?: boolean) {
  if (Array.isArray(children) && !isVNode(children)) {
    for (const child of children) {
      await renderNode(rc, child, stripSlotProp);
    }
  } else {
    await renderNode(rc, children as ChildType, stripSlotProp);
  }
}

function renderAttr(
  rc: RenderContext,
  attrName: string,
  attrValue: unknown,
  stripSlotProp?: boolean,
): [attr: string, addonHtml: string, signalValue: Signal | undefined] {
  let attr = "";
  let addonHtml = "";
  let signalValue: Signal | undefined;
  if (isObject(attrValue)) {
    let signal: Signal | undefined;
    if (isSignal(attrValue)) {
      signal = attrValue;
    } else {
      const { fcCtx } = rc;
      if (fcCtx) {
        const deps = new Set<string>();
        const patches = [] as string[];
        const staticProps = traverseProps(attrValue, (path, value) => {
          const { scope, key } = value[$signal];
          if (isString(key)) {
            patches.push([
              (scope !== fcCtx.scopeId ? "$signals(" + scope + ")" : "this") + "[" + toStrLit(key) + "]",
              ...path,
            ].join(","));
            deps.add(scope + ":" + key);
          } else {
            patches.push(["(" + key.compute.toString() + ")(),", ...path].join(","));
            for (const dep of key.deps) {
              deps.add(dep);
            }
          }
        });
        if (patches.length > 0) {
          const { scopeId } = fcCtx!;
          const compute = "()=>$patch(" + toStrLit(staticProps) + ",[" + patches.join("],[") + "])";
          signal = Signal(scopeId, { compute, deps }, staticProps);
        }
      }
    }
    if (signal) {
      if (attrName === "class") {
        rc.flags.runtime |= CX;
      } else if (attrName === "style") {
        rc.flags.runtime |= STYLE;
      }
      signalValue = signal;
      attrValue = signal[$signal].value;
    }
  }
  switch (attrName) {
    case "class":
      attr = " class=" + toAttrStringLit(cx(attrValue));
      break;
    case "style":
      if (isString(attrValue)) {
        attr = ' style="' + escapeCSSText(attrValue) + '"';
      } else if (isObject(attrValue) && !Array.isArray(attrValue)) {
        const { inline, css } = styleToCSS(attrValue);
        if (css) {
          const id = hashCode((inline ?? "") + css.join("")).toString(36);
          addonHtml += '<style data-mono-jsx-css="' + id + '">'
            + (inline ? "[data-css-" + id + "]{" + escapeCSSText(inline) + "}" : "")
            + escapeCSSText(css.map(v => v === null ? "[data-css-" + id + "]" : v).join(""))
            + "</style>";
          attr = " data-css-" + id;
        } else if (inline) {
          attr = " style=" + toAttrStringLit(inline);
        }
      }
      break;
    case "props":
      if (isObject(attrValue) && !Array.isArray(attrValue)) {
        attr = ' props="base64,' + btoa(toStrLit(attrValue)) + '"';
      }
      break;
    case "ref":
      if (typeof attrValue === "function") {
        const signals = rc.fcCtx?.signals;
        if (!signals) {
          console.error("Use `ref` outside of a component function");
        } else {
          const refId = rc.flags.refs++;
          const effects = signals[Symbol.for("effects")] as string[];
          effects.push("()=>(" + attrValue.toString() + ')(this.refs["' + refId + '"])');
          attr = " data-ref=" + toAttrStringLit(rc.fcCtx!.scopeId + ":" + refId);
        }
      } else if (attrValue instanceof Ref) {
        attr = " data-ref=" + toAttrStringLit(attrValue.scope + ":" + attrValue.name);
      }
      break;
    case "action":
      if (typeof attrValue === "function") {
        attr = ' onsubmit="$onsubmit(event,$MF_' + rc.mfs.gen(attrValue) + toStr(rc.fcCtx?.scopeId, (i) => "," + i) + ')"';
      } else if (isString(attrValue)) {
        attr = " action=" + toAttrStringLit(attrValue);
      }
      break;
    case "slot":
      if (!stripSlotProp && isString(attrValue)) {
        attr = " slot=" + toAttrStringLit(attrValue);
      }
      break;
    default:
      if (attrName.startsWith("on") && typeof attrValue === "function") {
        attr = " " + escapeHTML(attrName.toLowerCase()) + '="$emit(event,$MF_'
          + rc.mfs.gen(attrValue)
          + toStr(rc.fcCtx?.scopeId, (i) => "," + i)
          + ')"';
      } else if (attrValue === false || attrValue === null || attrValue === undefined) {
        // skip false, null or undefined attributes
      } else {
        attr = " " + escapeHTML(attrName);
        if (attrValue !== true) {
          attr += "=" + toAttrStringLit(String(attrValue));
        }
      }
  }
  return [attr, addonHtml, signalValue];
}

// @internal
async function renderFC(rc: RenderContext, fc: FC, props: JSX.IntrinsicAttributes) {
  const { write } = rc;
  const { children } = props;
  const scopeId = ++rc.flags.scope;
  const signals = createSignals(scopeId, rc.signals.app, rc.context, rc.request);
  const slots: ChildType[] | undefined = children !== undefined
    ? (Array.isArray(children) ? (isVNode(children) ? [children as ChildType] : children) : [children])
    : undefined;
  const fcCtx: FCContext = { scopeId, signals, slots, forSignal: -1 };
  try {
    const v = fc.call(signals, props);
    if (isObject(v) && !isVNode(v)) {
      if (v instanceof Promise) {
        if (rc.eager || (props.rendering ?? fc.rendering) === "eager") {
          await renderNode({ ...rc, fcCtx }, (await v) as ChildType);
          markSignals(rc, signals);
        } else {
          const chunkIdAttr = 'chunk-id="' + (rc.flags.chunk++).toString(36) + '"';
          write("<m-portal " + chunkIdAttr + ">");
          if (props.placeholder) {
            await renderNode(rc, props.placeholder);
          }
          write("</m-portal>");
          rc.suspenses.push(v.then(async (node) => {
            let buf = "";
            let write = (chunk: string) => {
              buf += chunk;
            };
            buf += "<m-chunk " + chunkIdAttr + "><template>";
            await renderNode({ ...rc, fcCtx, write }, node as ChildType);
            markSignals({ ...rc, write }, signals);
            return buf + "</template></m-chunk>";
          }));
        }
      } else if (Symbol.asyncIterator in v) {
        if (rc.eager || (props.rendering ?? fc.rendering) === "eager") {
          for await (const c of v) {
            await renderNode({ ...rc, fcCtx }, c as ChildType);
          }
          markSignals(rc, signals);
        } else {
          const chunkIdAttr = 'chunk-id="' + (rc.flags.chunk++).toString(36) + '"';
          write("<m-portal " + chunkIdAttr + ">");
          if (props.placeholder) {
            await renderNode(rc, props.placeholder);
          }
          write("</m-portal>");
          const iter = () =>
            rc.suspenses.push(
              v.next().then(async ({ done, value }) => {
                let buf = "<m-chunk " + chunkIdAttr;
                let write = (chunk: string) => {
                  buf += chunk;
                };
                if (done) {
                  buf += " done>";
                  markSignals({ ...rc, write }, signals);
                  return buf + "</m-chunk>";
                }
                buf += " next><template>";
                await renderNode({ ...rc, fcCtx, write }, value as ChildType);
                iter();
                return buf + "</template></m-chunk>";
              }),
            );
          iter();
        }
      } else if (Symbol.iterator in v) {
        for (const node of v) {
          await renderNode({ ...rc, fcCtx }, node as ChildType);
        }
        markSignals(rc, signals);
      }
    } else if (v) {
      await renderNode({ ...rc, fcCtx }, v as ChildType);
      markSignals(rc, signals);
    }
  } catch (err) {
    if (err instanceof Error) {
      if (props.catch) {
        await renderNode(rc, props.catch(err)).catch(() => {});
      } else {
        console.error(err);
        write('<pre style="color:red;font-size:1rem"><code>' + escapeHTML(err.message) + "</code></pre>");
      }
    }
  }
}

// @internal
function renderSignal(
  rc: RenderContext,
  signal: Signal,
  mode?: "toggle" | "switch" | "list" | "html" | [string],
  content?: unknown,
  html?: boolean,
) {
  const { scope, key } = signal[$signal];
  let buffer = "<m-signal";
  if (mode) {
    buffer += ' mode="';
    if (isString(mode)) {
      buffer += mode;
    } else {
      buffer += "[" + mode[0] + "]";
    }
    buffer += '"';
  }
  buffer += ' scope="' + scope + '"';
  if (isString(key)) {
    buffer += " key=" + toAttrStringLit(key);
  } else {
    buffer += ' computed="' + rc.mcs.gen(signal) + '"';
  }
  rc.write(buffer + ">" + (html ? content : escapeHTML(String(content ?? ""))) + "</m-signal>");
}

let collectDeps: ((scopeId: number, key: string) => void) | undefined;

// @internal
function Signal(
  scope: number,
  key: string | Compute,
  value: unknown,
): Signal {
  const signal = { scope, key, value };
  return new Proxy(new NullProtoObj(), {
    get(_target, prop) {
      if (prop === $signal) {
        return signal;
      }
      if (isObject(value)) {
        return Reflect.get(value, prop, value);
      }
      const v = (value as any)[prop];
      if (typeof v === "function") {
        return v.bind(value);
      }
      return v;
    },
    set(_target, prop, newValue) {
      if (isObject(value)) {
        return Reflect.set(value, prop, newValue, value);
      }
      return false;
    },
  }) as Signal;
}

// @internal
function createSignals(
  scopeId: number,
  appSignals: Record<string, unknown> | null,
  context: Record<string, unknown> = new NullProtoObj(),
  request?: Request & { URL?: URL },
): Record<string, unknown> {
  const store = new NullProtoObj() as Record<string | symbol, unknown>;
  const signals = new Map<string, Signal>();
  const effects = [] as string[];
  const refs = new Proxy(Object.create(null), {
    get(_, key) {
      return new Ref(scopeId, key as string);
    },
  });
  const computed = (compute: () => unknown): unknown => {
    const deps = new Set<string>();
    collectDeps = (scopeId, key) => deps.add(scopeId + ":" + key);
    const value = compute.call(thisProxy);
    collectDeps = undefined;
    return Signal(scopeId, { compute, deps }, value);
  };
  const markEffect = (effect: CallableFunction) => {
    effects.push(effect.toString());
  };
  const mark = ({ signals, write }: RenderContext) => {
    if (effects.length > 0) {
      const n = effects.length;
      if (n > 0) {
        const js = new Array<string>(n);
        for (let i = 0; i < n; i++) {
          js[i] = "function $ME_" + scopeId + "_" + i + "(){return(" + effects[i] + ").call(this)};";
        }
        write('<m-effect scope="' + scopeId + '" n="' + n + '"></m-effect>');
        signals.effects.push(js.join(""));
      }
    }
    for (const [key, value] of Object.entries(store)) {
      signals.store.set(scopeId + ":" + key, value);
    }
  };
  const thisProxy = new Proxy(store, {
    get(target, key, receiver) {
      switch (key) {
        case "app":
          return appSignals;
        case "context":
          return context;
        case "request":
          return request;
        case "refs":
          return refs;
        case "computed":
        case "$":
          return computed;
        case "index":
        case "item":
          if (collectDeps) {
            return Reflect.get(target, key === "item" ? $item : $index, receiver);
          }
          return key === "item" ? createObjectStub() : [$index, null, $vnode];
        case "itemOf":
          return () => thisProxy.item;
        case "effect":
          return markEffect;
        case Symbol.for("effects"):
          return effects;
        case Symbol.for("mark"):
          return mark;
        case "url":
          if (scopeId === 0) {
            return request ? request.URL ?? (request.URL = new URL(request.url)) : undefined;
          }
          // fallthrough
        default: {
          const value = Reflect.get(target, key, receiver);
          if (typeof key === "symbol" || isSignal(value)) {
            return value;
          }
          if (value === undefined && !Reflect.has(target, key)) {
            Reflect.set(target, key, undefined, receiver);
          }
          if (collectDeps) {
            collectDeps(scopeId, key);
            return value;
          }
          let signal = signals.get(key);
          if (!signal) {
            signal = Signal(scopeId, key, value);
            signals.set(key, signal);
          }
          return signal;
        }
      }
    },
    set(target, key, value, receiver) {
      if (isString(key)) {
        signals.delete(key);
      }
      return Reflect.set(target, key, value, receiver);
    },
  });
  return thisProxy;
}

// @internal
function markSignals(rc: RenderContext, signals: Record<symbol, unknown>) {
  (signals[Symbol.for("mark")] as ((rc: RenderContext) => void))(rc);
}

// @internal
function traverseProps(
  obj: Record<string, unknown> | Array<unknown>,
  callback: (path: string[], signal: Signal) => void,
  path: string[] = [],
): typeof obj {
  const isArray = Array.isArray(obj);
  const copy: any = isArray ? new Array(obj.length) : new NullProtoObj();
  for (const [k, value] of Object.entries(obj)) {
    const newPath = path.concat(isArray ? k : toStrLit(k));
    const key = isArray ? Number(k) : k;
    if (isObject(value)) {
      if (isSignal(value)) {
        copy[key] = value[$signal].value; // use the value of the signal
        callback(newPath, value);
      } else {
        copy[key] = traverseProps(value, callback, newPath);
      }
    } else {
      copy[key] = value;
    }
  }
  return copy;
}

// @internal
// e.g. createObjectStub().foo.bar[$path] === ["foo", "bar"]
function createObjectStub(path: string[] = []) {
  return new Proxy(Object.create(null), {
    get(_target, prop) {
      return typeof prop === "symbol" ? (prop === $path ? path : undefined) : createObjectStub(path.concat(prop));
    },
  });
}

export { isSignal };
