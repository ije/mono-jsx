import type { ChildType } from "./types/mono.d.ts";
import type { FC, VNode } from "./types/jsx.d.ts";
import type { MaybeModule, RenderOptions } from "./types/render.d.ts";
import { CX, EVENT, LAZY, ROUTER, SIGNALS, STYLE, SUSPENSE } from "./runtime/index.ts";
import { CX_JS, EVENT_JS, LAZY_JS, ROUTER_JS, SIGNALS_JS, STYLE_JS, SUSPENSE_JS } from "./runtime/index.ts";
import { RENDER_ATTR, RENDER_SWITCH, RENDER_TOGGLE } from "./runtime/index.ts";
import { RENDER_ATTR_JS, RENDER_SWITCH_JS, RENDER_TOGGLE_JS } from "./runtime/index.ts";
import { cx, escapeHTML, isObject, isString, NullProtoObj, styleToCSS, toHyphenCase } from "./runtime/utils.ts";
import { $fragment, $html, $signal, $vnode } from "./symbols.ts";
import { VERSION } from "./version.ts";

interface RenderContext {
  write: (chunk: string) => void;
  suspenses: Array<Promise<string>>;
  signals: SignalsContext;
  flags: Flags;
  mcs: IdGenManager<Signal>;
  mfs: IdGenManager<CallableFunction & { str?: string }>;
  context?: Record<string, unknown>;
  request?: Request;
  routeFC?: MaybeModule<FC<any>>;
  fcCtx?: FCContext;
}

interface FCContext {
  scopeId: number;
  signals: Record<symbol | string, unknown>;
  slots: Array<ChildType> | undefined;
  refs: number;
}

interface Flags {
  scope: number;
  chunk: number;
  runtime: number;
}

interface SignalsContext {
  app: Record<string, unknown>;
  store: Map<string, unknown>;
  effects: Array<string>;
}

interface IdGenManager<K> {
  size: number;
  clear(): void;
  gen(key: K, scope: number | undefined): number;
  toJS(callback: (scope: number, id: number, v: K) => string): string;
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
const hashCode = (s: string) => [...s].reduce((hash, c) => (Math.imul(31, hash) + c.charCodeAt(0)) | 0, 0);
const escapeCSSText = (str: string): string => str.replace(/[<>]/g, (m) => m.charCodeAt(0) === 60 ? "&lt;" : "&gt;");
const toAttrStringLit = (str: string) => '"' + escapeHTML(str) + '"';
const toStr = <T = string | number>(v: T | undefined, str: (v: T) => string) => v !== undefined ? str(v) : "";
const stringify = JSON.stringify;

// @internal
class Ref {
  constructor(
    public scope: number,
    public name: string,
  ) {}
}

// @internal
class IdGen<T> extends Map<T, number> implements IdGen<T> {
  #seq = 0;
  gen(v: T) {
    return this.get(v) ?? this.set(v, this.#seq++).get(v)!;
  }
}

// @internal
class IdGenManagerImpl<T> implements IdGenManager<T> {
  #scopes = new Map<number, IdGen<T>>();

  size = 0;

  gen(key: T, scope = 0): number {
    let idGen = this.#scopes.get(scope);
    if (!idGen) {
      idGen = new IdGen<T>();
      this.#scopes.set(scope, idGen);
    }
    this.size++;
    return idGen.gen(key);
  }

  toJS(callback: (scope: number, id: number, v: T) => string): string {
    let js = "";
    for (const [scope, gens] of this.#scopes) {
      for (const [v, id] of gens.entries()) {
        js += callback(scope, id, v);
      }
    }
    return js;
  }

  clear() {
    this.#scopes.clear();
    this.size = 0;
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
      console.error("[mono-jsx] The `request` prop in the `<html>` element is required for routing.");
    }
    if (!routeFC) {
      status = 404;
    }
  }

  if (components && !request) {
    console.warn("[mono-jsx] The `components` prop in the `<html>` element is ignored when `request` is not provided.");
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
            let json = "[" + stringify(html);
            if (js) {
              json += "," + stringify(js);
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
    flags: { scope: 0, chunk: 0, runtime: 0 },
    mcs: new IdGenManagerImpl<Signal>(),
    mfs: new IdGenManagerImpl<CallableFunction>(),
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
    if (signals.store.size > 0 || rc.mcs.size > 0 || hasEffect) {
      treeshake(RENDER_ATTR, RENDER_ATTR_JS);
      treeshake(RENDER_TOGGLE, RENDER_TOGGLE_JS);
      treeshake(RENDER_SWITCH, RENDER_SWITCH_JS);
      treeshake(SIGNALS, SIGNALS_JS, true);
    }
    treeshake(SUSPENSE, SUSPENSE_JS, suspenses.length > 0);
    treeshake(LAZY, LAZY_JS);
    treeshake(ROUTER, ROUTER_JS);
    if (js.length > 0) {
      js = "(()=>{" + js + "})();/* --- */";
    }
    if ((runtimeFlag & LAZY) || (runtimeFlag & ROUTER)) {
      const { scope, chunk } = rc.flags;
      js += 'window.$FLAGS="' + scope + "|" + chunk + "|" + runtimeFlag + '";';
    }
    if (rc.mfs.size > 0) {
      js += rc.mfs.toJS((scope, seq, fn) =>
        "function $MF_" + scope + "_" + seq + "(){(" + (fn.str ?? String(fn)) + ").apply(this,arguments)};"
      );
      rc.mfs.clear();
    }
    if (hasEffect) {
      js += signals.effects.splice(0, signals.effects.length).join("");
    }
    if ((runtimeFlag & ROUTER) && (runtimeFlag & SIGNALS) && request) {
      const { params } = request as Request & { params?: Record<string, string> };
      const url = "new URL(" + stringify(request.url) + ")";
      const urlWithParams = params ? "Object.assign(" + url + "," + stringify(params) + ")" : url;
      if (componentMode) {
        js += "$signals(0).url=" + urlWithParams + ";";
      } else {
        js += '$MS("0:url",' + urlWithParams + ");";
      }
    }
    if (signals.store.size > 0) {
      for (const [key, value] of signals.store.entries()) {
        js += "$MS(" + stringify(key) + (value !== undefined ? "," + stringify(value) : "") + ");";
      }
      signals.store.clear();
    }
    if (rc.mcs.size > 0) {
      js += rc.mcs.toJS((scope, seq, signal) => {
        const { compute, deps } = signal[$signal].key as Compute;
        return "$MC(" + scope + "," + seq + ",function(){return(" + String(compute) + ").call(this)},"
          + stringify([...deps.values()])
          + ");";
      });
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
    const headers = request.headers;
    const flagsHeader = headers.get("x-flags")?.split("|");
    if (flagsHeader?.length === 3) {
      const [scope, chunk, runtime] = flagsHeader.map(Number);
      Object.assign(rc.flags, { scope, chunk });
      runtimeFlag = runtime;
    }
  }
  if (componentMode) {
    const [tag, props] = node as VNode;
    if (typeof tag === "function") {
      await renderFC(rc, tag, props, true);
      await finalize();
      return;
    }
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
                      compute: "()=>!this[" + stringify(key) + "]",
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
                  buf += 'computed="' + rc.mcs.gen(show, rc.fcCtx?.scopeId) + '">';
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
                  stateful += 'computed="' + rc.mcs.gen(valueProp, rc.fcCtx?.scopeId) + '">';
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

          // `<component>` element
          case "component": {
            let { placeholder } = props;
            let attrs = "";
            let attrModifiers = "";
            for (const p of ["name", "props", "ref"]) {
              let propValue = props[p];
              let [attr, , attrSignal] = renderAttr(rc, p, propValue);
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
                const [attr, addonHtml, signalValue, binding] = renderAttr(rc, propName, propValue, stripSlotProp);
                if (addonHtml) {
                  write(addonHtml);
                }
                if (signalValue) {
                  const write = (chunk: string) => {
                    attrModifiers += chunk;
                  };
                  renderSignal({ ...rc, write }, signalValue, [binding ? propName.slice(1) : propName]);
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
): [attr: string, addonHtml: string, signalValue: Signal | undefined, binding: boolean] {
  let attr = "";
  let addonHtml = "";
  let signalValue: Signal | undefined;
  let binding = false;
  let scopeId = rc.fcCtx?.scopeId;
  if (isObject(attrValue)) {
    let signal: Signal | undefined;
    if (isSignal(attrValue)) {
      signal = attrValue;
    } else {
      if (scopeId) {
        const deps = new Set<string>();
        const patches = [] as string[];
        const staticProps = traverseProps(attrValue, (path, value) => {
          const { scope, key } = value[$signal];
          if (isString(key)) {
            patches.push([
              (scope !== scopeId ? "$signals(" + scope + ")" : "this") + "[" + stringify(key) + "]",
              ...path,
            ].join(","));
            deps.add(scope + ":" + key);
          } else {
            patches.push(["(" + String(key.compute) + ")(),", ...path].join(","));
            for (const dep of key.deps) {
              deps.add(dep);
            }
          }
        });
        if (patches.length > 0) {
          const compute = "()=>$patch(" + stringify(staticProps) + ",[" + patches.join("],[") + "])";
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
        attr = ' props="base64,' + btoa(stringify(attrValue)) + '"';
      }
      break;
    case "ref":
      if (typeof attrValue === "function") {
        const signals = rc.fcCtx?.signals;
        if (!signals) {
          console.error("[mono-jsx] Use `ref` outside of a component function");
        } else {
          const refId = rc.fcCtx!.refs++;
          const effects = signals[Symbol.for("effects")] as string[];
          effects.push("()=>(" + String(attrValue) + ')(this.refs["' + refId + '"])');
          attr = " data-ref=" + toAttrStringLit(rc.fcCtx!.scopeId + ":" + refId);
        }
      } else if (attrValue instanceof Ref) {
        attr = " data-ref=" + toAttrStringLit(attrValue.scope + ":" + attrValue.name);
      }
      break;
    case "action":
      if (typeof attrValue === "function") {
        const scopeId = rc.fcCtx?.scopeId;
        attr = ' onsubmit="$onsubmit(event,$MF_'
          + (scopeId ?? 0) + "_"
          + rc.mfs.gen(attrValue, scopeId) + toStr(scopeId, (i) => "," + i)
          + ')"';
      } else if (isString(attrValue)) {
        attr = " action=" + toAttrStringLit(attrValue);
      }
      break;
    case "slot":
      if (!stripSlotProp && isString(attrValue)) {
        attr = " slot=" + toAttrStringLit(attrValue);
      }
      break;
    case "$checked":
    case "$value":
      if (!(attrValue === false || attrValue === null || attrValue === undefined)) {
        attr = " " + attrName.slice(1);
        if (attrValue !== true) {
          attr += "=" + toAttrStringLit(String(attrValue));
        }
      }
      if (signalValue) {
        const { key } = signalValue[$signal];
        if (isString(key)) {
          const fn = () => {}; // todo: use cached fn by the key to reduce the code size
          fn.str = "e=>this[" + toAttrStringLit(key) + "]=e.target." + attrName.slice(1);
          attr += ' oninput="$emit(event,$MF_'
            + (scopeId ?? 0) + "_"
            + rc.mfs.gen(fn, scopeId)
            + toStr(scopeId, (i) => "," + i)
            + ')"';
        }
        binding = true;
      }
      break;
    default:
      if (attrName.startsWith("on") && typeof attrValue === "function") {
        attr = " " + escapeHTML(attrName.toLowerCase()) + '="$emit(event,$MF_'
          + (scopeId ?? 0) + "_"
          + rc.mfs.gen(attrValue, scopeId)
          + toStr(scopeId, (i) => "," + i)
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
  return [attr, addonHtml, signalValue, binding];
}

// @internal
async function renderFC(rc: RenderContext, fc: FC, props: JSX.IntrinsicAttributes, eager?: boolean) {
  const { write } = rc;
  const { children } = props;
  const scopeId = ++rc.flags.scope;
  const signals = createSignals(scopeId, rc.signals.app, rc.context, rc.request);
  const slots: ChildType[] | undefined = children !== undefined
    ? (Array.isArray(children) ? (isVNode(children) ? [children as ChildType] : children) : [children])
    : undefined;
  const fcCtx: FCContext = { scopeId, signals, slots, refs: 0 };
  try {
    const v = fc.call(signals, props);
    if (isObject(v) && !isVNode(v)) {
      if (v instanceof Promise) {
        if (eager || (props.rendering ?? fc.rendering) === "eager") {
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
        if (eager || (props.rendering ?? fc.rendering) === "eager") {
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
        write("<script>console.error(" + stringify(err.stack ?? err.message) + ")</script>");
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
    buffer += ' computed="' + rc.mcs.gen(signal, rc.fcCtx?.scopeId) + '"';
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
    set() {
      throw new Error("[mono-jsx] The `refs` object is read-only at SSR time.");
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
    effects.push(String(effect));
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
        case "effect":
          return markEffect;
        case Symbol.for("effects"):
          return effects;
        case Symbol.for("mark"):
          return mark;
        case "url":
          if (scopeId === 0) {
            collectDeps?.(0, key);
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
    const newPath = path.concat(isArray ? k : stringify(k));
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

export { isSignal };
