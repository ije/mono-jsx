import type { ChildType } from "./types/mono.d.ts";
import type { FC, VNode } from "./types/jsx.d.ts";
import type { FCModule, RenderOptions } from "./types/render.d.ts";
import { CX_JS, EVENT_JS, LAZY_JS, ROUTER_JS, SIGNALS_JS, STYLE_TO_CSS_JS, SUSPENSE_JS, VERSION } from "./runtime/index.ts";
import { cx, escapeHTML, isObject, isString, NullProtoObj, styleToCSS, toHyphenCase } from "./runtime/utils.ts";
import { $fragment, $html, $signal, $vnode } from "./symbols.ts";

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
  routeFC?: FCModule;
  fcCtx?: FCContext;
}

interface FCContext {
  scopeId: number;
  signals: Record<symbol | string, unknown>;
  slots: Array<ChildType> | undefined;
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

// runtime JS flags
const RUNTIME_CX = 1;
const RUNTIME_STYLE_TO_CSS = 2;
const RUNTIME_EVENT = 4;
const RUNTIME_SIGNALS = 8;
const RUNTIME_SUSPENSE = 16;
const RUNTIME_LAZY = 32;
const RUNTIME_ROUTER = 64;

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

/** Renders a VNode to a `Response` object. */
export function renderHtml(node: VNode, options: RenderOptions): Response {
  const { request, routes, components, headers: headersInit } = options;
  const headers = new Headers();
  const reqHeaders = request?.headers;
  const componentHeader = reqHeaders?.get("x-component");

  let routeFC: FCModule | undefined = request ? Reflect.get(request, "x-route") : undefined;
  let component = componentHeader ? components?.[componentHeader] : null;
  let status = options.status;

  if (routes && !routeFC) {
    if (request) {
      const patterns = Object.keys(routes);
      const dynamicPatterns = [];
      for (const pattern of patterns) {
        if (pattern.includes(":") || pattern.includes("*")) {
          dynamicPatterns.push(pattern);
        } else if (new URL(request.url).pathname === pattern) {
          routeFC = routes[pattern];
          break;
        }
      }
      if (!routeFC) {
        for (const path of dynamicPatterns) {
          const match = new URLPattern({ pathname: path }).exec(request.url);
          if (match) {
            routeFC = routes[path];
            Object.assign(request, { params: match.pathname.groups });
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

  if (headersInit) {
    for (const [key, value] of Object.entries(headersInit)) {
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
    headers.delete("etag");
    headers.delete("last-modified");
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
          try {
            const propsHeader = reqHeaders?.get("x-props");
            const props = propsHeader ? JSON.parse(propsHeader) : {};
            let html = "";
            let js = "";
            await render(
              [component instanceof Promise ? (await component).default : component, props, $vnode],
              options,
              (chunk) => {
                html += chunk;
              },
              (chunk) => {
                js += chunk;
              },
              true,
            );
            write("[");
            write(JSON.stringify(html));
            if (js) {
              write(",");
              write(JSON.stringify(js));
            }
            write("]");
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

  const etag = headers.get("etag");
  if (etag && reqHeaders?.get("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }
  const lastModified = headers.get("last-modified");
  if (lastModified && reqHeaders?.get("if-modified-since") === lastModified) {
    return new Response(null, { status: 304 });
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
    let js = "";
    if ((rc.flags.runtime & RUNTIME_CX) && !(runtimeFlag & RUNTIME_CX)) {
      runtimeFlag |= RUNTIME_CX;
      js += CX_JS;
    }
    if ((rc.flags.runtime & RUNTIME_STYLE_TO_CSS) && !(runtimeFlag & RUNTIME_STYLE_TO_CSS)) {
      runtimeFlag |= RUNTIME_STYLE_TO_CSS;
      js += STYLE_TO_CSS_JS;
    }
    if (rc.mfs.size > 0 && !(runtimeFlag & RUNTIME_EVENT)) {
      runtimeFlag |= RUNTIME_EVENT;
      js += EVENT_JS;
    }
    if ((signals.store.size > 0 || signals.effects.length > 0) && !(runtimeFlag & RUNTIME_SIGNALS)) {
      runtimeFlag |= RUNTIME_SIGNALS;
      js += SIGNALS_JS;
    }
    if (suspenses.length > 0 && !(runtimeFlag & RUNTIME_SUSPENSE)) {
      runtimeFlag |= RUNTIME_SUSPENSE;
      js += SUSPENSE_JS;
    }
    if ((rc.flags.runtime & RUNTIME_LAZY) && !(runtimeFlag & RUNTIME_LAZY)) {
      runtimeFlag |= RUNTIME_LAZY;
      js += LAZY_JS;
    }
    if ((rc.flags.runtime & RUNTIME_ROUTER) && !(runtimeFlag & RUNTIME_ROUTER)) {
      runtimeFlag |= RUNTIME_ROUTER;
      js += ROUTER_JS;
    }
    if (js.length > 0) {
      js = "(()=>{" + js + "})();/* --- */";
      js += "window.$runtimeFlag=" + runtimeFlag + ";";
    }
    if (runtimeFlag & RUNTIME_LAZY || runtimeFlag & RUNTIME_ROUTER) {
      js += "window.$scopeSeq=" + rc.flags.scope + ";";
    }
    if (rc.mfs.size > 0) {
      for (const [fn, i] of rc.mfs.entries()) {
        js += "function $MF_" + i + "(){(" + fn.toString() + ").apply(this,arguments)};";
      }
      rc.mfs.clear();
    }
    if (signals.effects.length > 0) {
      js += signals.effects.splice(0, signals.effects.length).join("");
    }
    if (signals.store.size > 0) {
      for (const [key, value] of signals.store.entries()) {
        js += "$MS(" + JSON.stringify(key) + (value !== undefined ? "," + JSON.stringify(value) : "") + ");";
      }
      signals.store.clear();
    }
    if (rc.mcs.size > 0) {
      for (const [mc, i] of rc.mcs.entries()) {
        const { compute, deps } = mc[$signal].key as Compute;
        js += "$MC(" + i + ",function(){return(" + compute.toString() + ").call(this)},"
          + JSON.stringify([...deps.values()])
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
        const { scope, key, value } = node[$signal];
        if (isString(key)) {
          let buf = '<m-signal scope="' + scope + '" key=' + toAttrStringLit(key as string) + ">";
          if (value !== undefined && value !== null) {
            buf += escapeHTML(String(value));
          }
          buf += "</m-signal>";
          write(buf);
        } else {
          let buf = '<m-signal scope="' + scope + '" computed="' + rc.mcs.gen(node) + '">';
          if (value !== undefined) {
            buf += escapeHTML(String(value));
          }
          buf += "</m-signal>";
          write(buf);
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
            if (props.innerHTML) {
              write(props.innerHTML);
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
            const { show, children } = props;
            if (children !== undefined) {
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

          // `<lazy>` element
          case "lazy": {
            const { placeholder } = props;
            let attrs = "";
            let attrModifiers = "";
            for (const p of ["name", "props"]) {
              let propValue = props[p];
              const [attr, , attrSignal] = renderAttr(rc, p, propValue);
              if (attrSignal) {
                const { scope, key, value } = attrSignal[$signal];
                attrModifiers += '<m-signal mode="[' + p + ']" scope="' + scope + '" ';
                if (isString(key)) {
                  attrModifiers += "key=" + toAttrStringLit(key);
                } else {
                  attrModifiers += 'computed="' + rc.mcs.gen(attrSignal) + '"';
                }
                attrModifiers += "></m-signal>";
                propValue = value;
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
            rc.flags.runtime |= RUNTIME_LAZY;
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
            rc.flags.runtime |= RUNTIME_ROUTER;
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
                  const { scope, key } = signalValue[$signal];
                  attrModifiers += "<m-signal mode=" + toAttrStringLit("[" + propName + "]") + ' scope="' + scope + '" ';
                  if (isString(key)) {
                    attrModifiers += "key=" + toAttrStringLit(key);
                  } else {
                    attrModifiers += 'computed="' + rc.mcs.gen(signalValue) + '"';
                  }
                  attrModifiers += "></m-signal>";
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
      signal = computedProps(rc, attrValue);
    }
    if (signal) {
      if (attrName === "class") {
        rc.flags.runtime |= RUNTIME_CX;
      } else if (attrName === "style") {
        rc.flags.runtime |= RUNTIME_STYLE_TO_CSS;
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
          addonHtml += '<style id="css-' + id + '">'
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
        attr = ' props="base64,' + btoa(JSON.stringify(attrValue)) + '"';
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
      } else if (isString(attrValue) || typeof attrValue === "number" || typeof attrValue === "boolean") {
        attr = " " + escapeHTML(attrName);
        if (attrValue !== "" && attrValue !== true) {
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
  const fcCtx: FCContext = { scopeId, signals, slots };
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
        await renderNode(rc, props.catch(err));
      } else {
        console.error(err);
        write('<pre style="color:red;font-size:1rem"><code>' + escapeHTML(err.message) + "</code></pre>");
      }
    }
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
  request?: Request,
): Record<string, unknown> {
  const store = new NullProtoObj();
  const signals = new Map<string, Signal>();
  const effects = [] as string[];
  const computed = (compute: () => unknown): unknown => {
    const deps = new Set<string>();
    collectDeps = (scopeId, key) => deps.add(scopeId + ":" + key);
    const value = compute.call(thisProxy);
    collectDeps = undefined;
    return Signal(scopeId, { compute, deps }, value);
  };
  const refs = new Proxy(new NullProtoObj(), {
    get(_, key) {
      return new Ref(scopeId, key as string);
    },
  });
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
          return computed;
        case "effect":
          return (effect: CallableFunction) => {
            effects.push(effect.toString());
          };
        case Symbol.for("effects"):
          return effects;
        case Symbol.for("mark"):
          return mark;
        default:
          if (isString(key)) {
            const value = Reflect.get(target, key, receiver);
            if (value === undefined && !Reflect.has(target, key)) {
              Reflect.set(target, key, undefined, receiver);
            }
            if (isSignal(value)) {
              return value;
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
      signals.delete(key as string);
      return Reflect.set(target, key, value, receiver);
    },
  });
  return thisProxy;
}

// @internal
function computedProps({ fcCtx }: RenderContext, props: Record<string, unknown> | Array<unknown>): Signal | undefined {
  if (fcCtx) {
    const deps = new Set<string>();
    const patches = [] as string[];
    const staticProps = traverseProps(props, (path, value) => {
      const { scope, key } = value[$signal];
      if (isString(key)) {
        patches.push([(scope !== fcCtx.scopeId ? "$signals(" + scope + ")" : "this") + "[" + JSON.stringify(key) + "]", ...path].join(","));
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
      const compute = "()=>$merge(" + JSON.stringify(staticProps) + ",[" + patches.join("],[") + "])";
      return Signal(scopeId, { compute, deps }, staticProps);
    }
  }
  return undefined;
}

// @internal
export function traverseProps(
  obj: Record<string, unknown> | Array<unknown>,
  callback: (path: string[], signal: Signal) => void,
  path: string[] = [],
): typeof obj {
  if (Array.isArray(obj)) {
    const copy = new Array<unknown>(obj.length);
    for (let i = 0; i < obj.length; i++) {
      const newPath = path.concat(i.toString());
      const value = obj[i];
      if (isObject(value)) {
        if (isSignal(value)) {
          copy[i] = value[$signal].value; // use the value of the signal
          callback(newPath, value);
        } else {
          copy[i] = traverseProps(value, callback, newPath);
        }
      } else {
        copy[i] = value;
      }
    }
    return copy;
  }
  const copy = new NullProtoObj() as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    const newPath = path.concat(JSON.stringify(key));
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
function markSignals(rc: RenderContext, signals: Record<symbol, unknown>) {
  (signals[Symbol.for("mark")] as ((rc: RenderContext) => void))(rc);
}
