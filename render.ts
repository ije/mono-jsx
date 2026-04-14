import type { ChildType, ComponentType, MaybeModule, Metadata, VNode } from "./types/jsx.d.ts";
import type { MonoRequest, Session } from "./types/mono.d.ts";
import type { RenderOptions, SessionOptions } from "./types/render.d.ts";
import { customElements } from "./jsx.ts";
import { $fragment, $html, $rpc, $vnode } from "./symbols.ts";
import { VERSION } from "./version.ts";
import {
  COMPONENT,
  COMPONENT_JS,
  CX,
  CX_JS,
  EVENT,
  EVENT_JS,
  FORM,
  FORM_JS,
  REDIRECT,
  REDIRECT_JS,
  RENDER_ATTR,
  RENDER_ATTR_JS,
  RENDER_SWITCH,
  RENDER_SWITCH_JS,
  RENDER_TOGGLE,
  RENDER_TOGGLE_JS,
  ROUTER,
  ROUTER_JS,
  RPC,
  RPC_JS,
  SIGNALS,
  SIGNALS_JS,
  STYLE,
  STYLE_JS,
  SUSPENSE,
  SUSPENSE_JS,
} from "./runtime/index.ts";
import {
  cx,
  escapeHTML,
  hashCode,
  isFunction,
  isObject,
  isPlainObject,
  isString,
  NullPrototypeObject,
  styleToCSS,
  toHyphenCase,
} from "./runtime/utils.ts";

interface RenderContext {
  write: (chunk: string) => void;
  suspenses: Array<Promise<string>>;
  fc?: FCScope;
  flags: Flags;
  signals: Signals;
  fidGenerator: FunctionIdGenerator;
  context?: Record<string, unknown>;
  request?: Request;
  session?: Session;
  routeFC?: MaybeModule<ComponentType<any>>;
  metadata?: Metadata;
  svg?: boolean;
}

interface FCScope {
  id: number;
  signals: Record<symbol | string, unknown>;
  slots?: Array<ChildType>;
  refs: number;
}

interface Flags {
  scope: number;
  chunk: number;
  runtime: number;
}

interface Signals {
  app: Record<string, unknown>;
  store: Map<string, unknown>;
  computes: Set<Compute>;
  effects: Array<[number, string]>;
}

class FunctionIdGenerator extends Map<string, number> {
  public seq = 0;
  #fnRef = new Map<CallableFunction, number>();

  genId(fn: CallableFunction | string): number {
    if (typeof fn === "string") {
      let id = this.get(fn);
      if (id === undefined) {
        id = this.seq++;
        this.set(fn, id);
      }
      return id;
    }
    const cached = this.#fnRef.get(fn);
    if (cached !== undefined) {
      return cached;
    }
    const fnStr = String(fn);
    let id = this.get(fnStr);
    if (id === undefined) {
      id = this.seq++;
      this.set(fnStr, id);
    }
    this.#fnRef.set(fn, id);
    return id;
  }

  override clear(): void {
    super.clear();
    this.#fnRef.clear();
  }
}

class Signal {
  constructor(
    public readonly scope: number,
    public readonly key: string,
    public readonly value: unknown,
  ) {}
}

class Compute {
  constructor(
    public readonly scope: number,
    public readonly compute: (() => unknown) | string,
    public readonly deps: Set<string>,
    public readonly value: unknown,
  ) {}
}

class Ref {
  constructor(
    public readonly scope: number,
    public readonly name: string,
  ) {}
}

class IdGen<T> extends Map<T, number> {
  #seq = 0;
  #byId = new Map<number, T>();
  gen(v: T) {
    const existing = this.get(v);
    if (existing !== undefined) {
      return existing;
    }
    const id = this.#seq++;
    this.set(v, id);
    this.#byId.set(id, v);
    return id;
  }
  getById(id: number): T | void {
    return this.#byId.get(id);
  }
}

const stringify = JSON.stringify;
const subtle = crypto.subtle;
const encoder = new TextEncoder();
const identifierRegex = /^[A-Za-z_$][0-9A-Za-z_$]*$/;
const cdn = "https://raw.esm.sh"; // the cdn for loading htmx and its extensions
const voidTags = new Set("area,base,br,col,embed,hr,img,input,keygen,link,meta,param,source,track,wbr".split(","));
const defaultMetadata = { viewport: "width=device-width, initial-scale=1.0" };
const componentsMap = new IdGen<ComponentType>();
const cache = new Map<string, { html: string; expiresAt?: number }>();
const urlPatternCache = new Map<string, URLPattern | null>();
const hmacKeyCache = new Map<string, Promise<CryptoKey>>();
const isVNode = (v: unknown): v is VNode => Array.isArray(v) && v.length === 3 && v[2] === $vnode;
const isReactive = (v: unknown): v is Signal | Compute => v instanceof Signal || v instanceof Compute;
const escapeCSSText = (str: string): string => str.replace(/[><]/g, (m) => m.charCodeAt(0) === 60 ? "&lt;" : "&gt;");
const toAttrStringLit = (str: string) => '"' + escapeHTML(str) + '"';
const errorStringify = (err: unknown) => err instanceof Error ? err.message : String(err);

/** Renders a `<html>` element to a `Response` object. */
function renderToWebStream(root: VNode, options: RenderOptions): Response | Promise<Response> {
  const { routes, components } = options;
  const request = options.request as MonoRequest | undefined;
  const headers = new Headers();
  const reqHeaders = request?.headers;
  const componentName = reqHeaders?.get("x-component");
  const routeForm = reqHeaders?.has("x-route-form");

  if (request) {
    if (!request.URL || !(request.URL instanceof URL)) {
      request.URL = new URL(request.url);
    }
  }

  if (reqHeaders?.has("x-rpc")) {
    if (!request || request.method !== "POST") {
      return new Response(null, { status: 405 });
    }
    const rpcIdHeader = reqHeaders?.get("x-rpc-id");
    if (!rpcIdHeader) {
      return Response.json({ error: "RPC ID is required" }, { status: 400 });
    }
    const rpcId = Number(rpcIdHeader);
    if (!Number.isInteger(rpcId)) {
      return Response.json({ error: "RPC ID is invalid" }, { status: 400 });
    }
    const { session, context, expose } = options;
    let rpcTarget: Record<string | symbol, unknown> | undefined;
    if (expose) {
      for (const value of Object.values(expose)) {
        if (isPlainObject(value) && value[$rpc] === rpcId) {
          rpcTarget = value;
          break;
        }
      }
    }
    if (!rpcTarget) {
      return Response.json({ error: "RPC target not found" }, { status: 404 });
    }
    return request.json().then(async (payload) => {
      const { fn, args } = isObject(payload) ? payload as { fn?: unknown; args?: unknown } : {};
      if (!isString(fn) || !Array.isArray(args)) {
        return Response.json({ error: "RPC payload is invalid" }, { status: 400 });
      }
      const rpcFunction = rpcTarget[fn];
      if (!isFunction(rpcFunction)) {
        return Response.json({ error: "RPC function not found: " + fn }, { status: 404 });
      }
      try {
        const rpcSession = session ? await createSession(request, session) : undefined;
        const result = await rpcFunction.apply(createInvokeScope(request, context, rpcSession), args);
        return Response.json({ result });
      } catch (err) {
        return Response.json({ error: errorStringify(err) }, { status: 500 });
      }
    }).catch((err) => {
      return Response.json({ error: "Failed to parse RPC payload: " + errorStringify(err) }, { status: 400 });
    });
  }

  let status = options.status;
  let routeFC: MaybeModule<ComponentType<any>> | undefined = request ? Reflect.get(request, "routeFC") : undefined;
  let component = componentName
    ? (componentName.startsWith("@comp_") ? componentsMap.getById(Number(componentName.slice(6))) : components?.[componentName])
    : null;

  if (routes && !routeFC) {
    if (request) {
      routeFC = routes[request.URL!.pathname];
      if (!routeFC) {
        for (const pattern of Object.keys(routes)) {
          let urlPattern = urlPatternCache.get(pattern);
          if (urlPattern === undefined) {
            let withParams = false;
            for (const char of pattern) {
              if (char === ":" || char === "*") {
                withParams = true;
                break;
              }
            }
            if (withParams) {
              urlPattern = new URLPattern({ pathname: pattern });
            } else {
              urlPattern = null;
            }
            urlPatternCache.set(pattern, urlPattern);
          }
          if (urlPattern) {
            const match = urlPattern.exec(request.URL!);
            if (match) {
              routeFC = routes[pattern];
              request.params = match.pathname.groups as Record<string, string>;
              break;
            }
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

  if (reqHeaders?.has("x-route") || routeForm) {
    if (!routeFC) {
      return Response.json({ error: "Route not found", status }, { headers, status });
    }
    component = routeFC;
  }

  if (component) {
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            if (component instanceof Promise) {
              const { default: defaultExport, ...rest } = await component;
              if (isFunction(defaultExport)) {
                component = defaultExport;
                Object.assign(component, rest);
              }
            }
            let propsHeader = reqHeaders?.get("x-props");
            let props = propsHeader ? JSON.parse(propsHeader) : {};
            const htmlChunks: string[] = [];
            const jsChunks: string[] = [];
            let buf = "";
            let vnode: VNode = [component as ComponentType<any>, props, $vnode];
            if (routeForm && request?.method === "POST") {
              const FormHandler = (component as any).FormHandler;
              if (!FormHandler || !isFunction(FormHandler)) {
                throw new Error((component as any).name + ".FormHandler is undefined or not a function");
              }
              vnode = [FormHandler, await request.formData(), $vnode];
            }
            await render(
              vnode,
              options,
              (chunk) => {
                htmlChunks.push(chunk);
              },
              (chunk) => {
                jsChunks.push(chunk);
              },
              true,
              routeForm,
            );
            const html = htmlChunks.join("");
            const js = jsChunks.join("");
            buf = "[" + stringify(html);
            if (js) {
              buf += "," + stringify(js);
            }
            if ((component as any).dynamic) {
              // no cache
              buf += ",true";
            }
            controller.enqueue(encoder.encode(buf + "]"));
          } catch (err) {
            console.error(err);
            controller.enqueue(encoder.encode(stringify({ error: errorStringify(err) })));
          } finally {
            controller.close();
          }
        },
      }),
      { headers },
    );
  } else if (componentName) {
    return new Response("Component not found: " + componentName, { status: 404 });
  }

  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("transfer-encoding", "chunked");
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = "";
        const flush = () => {
          if (buffer.length) {
            controller.enqueue(encoder.encode(buffer));
            buffer = "";
          }
        };
        const write = (chunk: string) => {
          buffer += chunk;
          // coalesce small `write` chunks before `TextEncoder.encode` to cut allocation churn on large SSR pages
          if (buffer.length >= 64 * 1024) {
            flush();
          }
        };
        Reflect.set(options, "routeFC", routeFC);
        try {
          write("<!DOCTYPE html>");
          await render(root, options, write, (js) => write('<script data-mono-jsx="' + VERSION + '">' + js + "</script>"));
          if (options.htmx) {
            write(`<script src="${cdn}/htmx.org${options.htmx === true ? "" : escapeHTML("@" + options.htmx)}/dist/htmx.min.js"></script>`);
            for (const [name, version] of Object.entries(options)) {
              if (name.startsWith("htmx-ext-") && version) {
                write(`<script src="${cdn}/${name}${version === true ? "" : escapeHTML("@" + version)}"></script>`);
              }
            }
          }
        } catch (err) {
          console.error(err);
          write("<script>console.error(" + stringify(errorStringify(err)) + ")</script>");
        } finally {
          flush();
          controller.close();
        }
      },
    }),
    { headers, status },
  );
}

async function render(
  node: VNode,
  options: RenderOptions & { routeFC?: ComponentType<any> },
  write: (chunk: string) => void,
  writeJS: (chunk: string) => void,
  componentMode?: boolean,
  routeForm?: boolean,
) {
  const { app, context, request, routeFC, metadata } = options;
  const suspenses: Promise<string>[] = [];
  const signals: Signals = {
    app: {},
    store: new Map(),
    computes: new Set(),
    effects: [],
  };
  const rc: RenderContext = {
    write,
    suspenses,
    context,
    request,
    signals,
    routeFC,
    metadata,
    flags: { scope: 0, chunk: 0, runtime: 0 },
    fidGenerator: new FunctionIdGenerator(),
  };
  signals.app = Object.assign(createThisProxy(rc, 0), app);

  // a flag to decide which runtime JS should be sent to the client
  let runtimeFlag = 0;

  // finalize creates runtime JS for client
  // it may be called recursively when thare are unresolved suspenses
  const finalize = async () => {
    const { fidGenerator, session, flags } = rc;
    const computes = signals.computes;
    const hasEffect = signals.effects.length > 0;
    const treeshake = (flag: number, code: string, force?: boolean) => {
      if ((force || flags.runtime & flag) && !(runtimeFlag & flag)) {
        runtimeFlag |= flag;
        js += code;
      }
    };
    let js = "";
    treeshake(CX, CX_JS);
    treeshake(STYLE, STYLE_JS);
    treeshake(EVENT, EVENT_JS, fidGenerator.size > 0 || hasEffect || computes.size > 0);
    if (signals.store.size > 0 || computes.size > 0 || hasEffect) {
      treeshake(RENDER_ATTR, RENDER_ATTR_JS);
      treeshake(RENDER_TOGGLE, RENDER_TOGGLE_JS);
      treeshake(RENDER_SWITCH, RENDER_SWITCH_JS);
      treeshake(SIGNALS, SIGNALS_JS, true);
    }
    treeshake(SUSPENSE, SUSPENSE_JS, suspenses.length > 0);
    treeshake(COMPONENT, COMPONENT_JS);
    treeshake(ROUTER, ROUTER_JS);
    treeshake(REDIRECT, REDIRECT_JS);
    treeshake(FORM, FORM_JS);
    if ((runtimeFlag & ROUTER) && (runtimeFlag & SIGNALS) && request) {
      const { params } = request as Request & { params?: Record<string, string> };
      const url = "new URL(" + stringify(request.url) + ")";
      const urlWithParams = params ? "Object.assign(" + url + "," + stringify(params) + ")" : url;
      if (componentMode) {
        if (!routeForm && params) {
          js += "$signals(0).url=" + urlWithParams + ";";
        }
      } else {
        js += '$S("0:url",' + urlWithParams + ");";
      }
    }
    if (signals.store.size > 0) {
      for (const [key, value] of signals.store.entries()) {
        js += "$S(" + stringify(key) + (value !== undefined ? "," + stringify(value) : "") + ");";
      }
      signals.store.clear();
    }
    if (computes.size > 0) {
      for (const compute of computes) {
        const id = fidGenerator.genId(compute.compute);
        js += "$C(" + compute.scope + "," + id + "," + stringify([...compute.deps.values()]) + ");";
      }
      computes.clear();
    }
    if (hasEffect) {
      const effects = new Map<number, number[]>();
      for (const [scopeId, callback] of signals.effects) {
        const fid = fidGenerator.genId(callback);
        const arr = effects.get(scopeId) ?? effects.set(scopeId, []).get(scopeId)!;
        arr.push(fid);
      }
      signals.effects.length = 0;
      for (const [scopeId, fids] of effects.entries()) {
        js += "$E(" + scopeId + "," + fids.join(",") + ");";
      }
    }
    if (fidGenerator.size > 0) {
      for (const [fnStr, id] of fidGenerator.entries()) {
        js += "$F(" + id + ",function(...a){return(" + fnStr + ").apply(this,a)});";
      }
      fidGenerator.clear();
    }
    if (options.expose && !componentMode) {
      for (const [key, value] of Object.entries(options.expose)) {
        if (identifierRegex.test(key)) {
          if (isPlainObject(value)) {
            if ($rpc in value) {
              treeshake(RPC, RPC_JS, true);
              js += "window." + key + "=$RPC(" + value[$rpc] + "," + stringify(Object.keys(value)) + ");";
            }
          }
        } else {
          console.warn("[mono-jsx] The key of the `expose` prop is not a valid JavaScript identifier: " + key);
        }
      }
    }
    if ((runtimeFlag & COMPONENT) || (runtimeFlag & ROUTER) || (runtimeFlag & FORM)) {
      const { scope, chunk } = flags;
      js = 'window.$FLAGS="' + scope + "|" + chunk + "|" + runtimeFlag + "|" + fidGenerator.seq + '";' + js;
    }
    if (session && session.isDirty) {
      const sessionStore = session.all();
      const { name = "session", domain, path, expires, maxAge, secure, sameSite, secret } = options.session?.cookie ?? {};
      if (secret) {
        let cookie = name + "=";
        if ((Object.keys(sessionStore)).length > 0) {
          const data = JSON.stringify([
            sessionStore,
            Math.floor((expires ? expires.getTime() : Date.now() + (maxAge ?? 1800) * 1000) / 1000),
          ]);
          const signature = await subtle.sign(
            "HMAC",
            await importHmacKey(secret),
            encoder.encode(data),
          );
          cookie += btoa(data) + "." + btoa(String.fromCharCode(...new Uint8Array(signature)));
          if (expires) {
            cookie += "; Expires=" + expires.toUTCString();
          } else if (maxAge) {
            cookie += "; Max-Age=" + maxAge;
          }
        } else {
          cookie += "; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
        if (domain) {
          cookie += "; Domain=" + domain;
        }
        if (path) {
          cookie += "; Path=" + path;
        }
        if (secure) {
          cookie += "; Secure";
        }
        if (sameSite) {
          cookie += "; SameSite=" + sameSite;
        }
        // set cookie via client side runtime
        js = "document.cookie=" + toAttrStringLit(cookie) + ";" + js;
      }
    }
    if (js.length > 0) {
      writeJS(js);
    }
    if (suspenses.length > 0) {
      await Promise.all(suspenses.splice(0, suspenses.length).map((suspense) => suspense.then(write)));
      await finalize();
    }
  };

  if (componentMode && request) {
    const headers = request.headers;
    const flagsHeader = headers.get("x-flags")?.split("|");
    if (flagsHeader?.length === 4) {
      const [scope, chunk, runtime, fid] = flagsHeader.map(Number);
      Object.assign(rc.flags, { scope, chunk });
      rc.fidGenerator.seq = fid;
      runtimeFlag = runtime;
    }
  }
  if (options.session && request) {
    rc.session = await createSession(request, options.session);
  }
  if (componentMode) {
    const [tag, props] = node as VNode;
    if (isFunction(tag)) {
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
      } else if (isReactive(node)) {
        rc.write(renderSignal(rc, node));
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
              if (isReactive(innerHTML)) {
                rc.write(renderSignal(rc, innerHTML, "html"));
              } else {
                write(innerHTML);
              }
            }
            break;
          }

          // `<slot>` element
          case "slot": {
            const fcSlots = rc.fc?.slots;
            if (fcSlots) {
              const slots: ChildType[] = [];
              if (props.name) {
                for (let i = 0, n = fcSlots.length; i < n; i++) {
                  const v = fcSlots[i];
                  if (isVNode(v) && v[1].slot === props.name) {
                    slots.push(v);
                  }
                }
              } else {
                for (let i = 0, n = fcSlots.length; i < n; i++) {
                  const v = fcSlots[i];
                  if (!isVNode(v) || !v[1].slot) {
                    slots.push(v);
                  }
                }
              }
              // use the children of the slot as fallback if nothing is slotted
              await renderChildren(rc, slots.length === 0 ? props.children : slots, true);
            }
            break;
          }

          // `<show>` and `<hidden>` elements
          case "show":
          case "hidden": {
            let { children, when = true } = props;
            if (children !== undefined) {
              if (tag === "hidden") {
                if (isReactive(when)) {
                  let { scope, value } = when;
                  if (when instanceof Signal) {
                    when = new Compute(scope, "()=>!this[" + stringify(when.key) + "]", new Set([scope + ":" + when.key]), !value);
                  } else {
                    when = new Compute(scope, "()=>!(" + when.compute + ")()", when.deps, !value);
                  }
                } else {
                  when = !when;
                }
              }
              if (isReactive(when)) {
                const { value } = when;
                let buf = renderSignal(rc, when, "toggle", false).slice(0, -1)
                  + renderFormslotAttr(props)
                  + renderViewTransitionAttr(props)
                  + ">";
                if (!value) {
                  buf += "<template m-slot>";
                }
                rc.flags.runtime |= RENDER_TOGGLE;
                write(buf);
                await renderChildren(rc, children);
                write((!value ? "</template>" : "") + "</m-signal>");
              } else {
                console.warn("[mono-jsx] <" + tag + "> The `when` prop is not a signal/compute.");
                if (when) {
                  await renderChildren(rc, children);
                }
              }
            }
            break;
          }

          // `<switch>` element
          case "switch": {
            const { value: valueProp, children } = props;
            if (rc.svg && valueProp === undefined) {
              write("<switch>");
              await renderChildren(rc, children);
              write("</switch>");
            } else if (children !== undefined) {
              let slots = Array.isArray(children) ? (isVNode(children) ? [children] : children) : [children];
              let matchedSlot: [string, ChildType] | undefined;
              let namedSlots: ChildType[] = [];
              let unnamedSlots: ChildType[] = [];
              let signalHtml: string | undefined;
              let toSlotName: string;
              if (isReactive(valueProp)) {
                const { value } = valueProp;
                signalHtml = renderSignal(rc, valueProp, "switch", false).slice(0, -1)
                  + renderFormslotAttr(props)
                  + renderViewTransitionAttr(props)
                  + ">";
                rc.flags.runtime |= RENDER_SWITCH;
                toSlotName = String(value);
              } else {
                toSlotName = String(valueProp);
              }
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
              if (signalHtml) {
                write(matchedSlot ? signalHtml.slice(0, -1) + " match=" + toAttrStringLit(matchedSlot[0]) + ">" : signalHtml);
              }
              if (matchedSlot) {
                await renderNode(rc, matchedSlot[1], true);
              } else if (unnamedSlots.length > 0) {
                await renderChildren(rc, unnamedSlots);
              }
              if (signalHtml) {
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
            let { pending, is, as } = props;
            let attrs = "";
            let attrModifiers = "";
            let writeAttr = (propName: string, propValue = props[propName]) => {
              if (propValue !== undefined) {
                const [attr, , attrSignal] = renderAttr(rc, propName, propValue);
                if (attrSignal) {
                  attrModifiers += renderSignal(rc, attrSignal, [propName]);
                  rc.flags.runtime |= RENDER_ATTR;
                }
                attrs += attr;
              }
            };
            if (isVNode(as)) {
              const [fc, props] = as;
              if (isFunction(fc)) {
                attrs += ' name="@comp_' + componentsMap.gen(fc) + '"';
                writeAttr("props", props);
              }
            } else if (isFunction(is)) {
              attrs += ' name="@comp_' + componentsMap.gen(is) + '"';
              writeAttr("props");
            } else if (props.name) {
              writeAttr("name");
              writeAttr("props");
            }
            writeAttr("ref");
            attrs += renderViewTransitionAttr(props);
            let buf = "<m-component" + attrs + ">";
            if (pending) {
              const chunks: string[] = [];
              await renderChildren(
                forkRenderContext(rc, {
                  write: (chunk: string) => {
                    chunks.push(chunk);
                  },
                }),
                pending,
              );
              buf += chunks.join("");
            }
            buf += "</m-component>";
            if (attrModifiers) {
              buf += "<m-group hidden>" + attrModifiers + "</m-group>";
            }
            write(buf);
            rc.flags.runtime |= COMPONENT;
            break;
          }

          // `<router>` element
          case "router": {
            let { routeFC } = rc;
            let { children, ref } = props;
            let buf = "";
            let attrs = renderViewTransitionAttr(props);
            if (ref !== undefined) {
              attrs += renderAttr(rc, "ref", ref)[0];
            }
            if (!routeFC) {
              attrs += " fallback";
            }
            write("<m-router" + attrs + ">");
            if (routeFC) {
              if (routeFC instanceof Promise) {
                routeFC = (await routeFC).default;
                if (!routeFC || !isFunction(routeFC)) {
                  console.warn("[mono-jsx] <router> The `default` export is not a function component.");
                  break;
                }
              }
              await renderFC(rc, routeFC, {}, true);
            }
            // render fallback (404) elements
            if (children) {
              if (routeFC) {
                buf += "<template m-fallback>";
              }
              const chunks: string[] = [];
              await renderChildren(
                forkRenderContext(rc, {
                  write: (chunk: string) => {
                    chunks.push(chunk);
                  },
                }),
                children,
              );
              buf += chunks.join("");
              if (routeFC) {
                buf += "</template>";
              }
            }
            buf += "</m-router>";
            write(buf);
            rc.flags.runtime |= ROUTER;
            break;
          }

          case "metadata": {
            if (rc.svg) {
              write("<metadata>");
              await renderChildren(rc, props.children);
              write("</metadata>");
            } else if (rc.routeFC) {
              let { metadata, getMetadata } = await rc.routeFC;
              if (isFunction(getMetadata)) {
                const { request, context, session } = rc;
                if (!request) {
                  throw new TypeError("[mono-jsx] The `request` prop in the `<html>` element is required.");
                }
                metadata = await getMetadata.call(createInvokeScope(request, context, session));
              }
              let buf = '<meta charset="utf-8">';
              const mergedMeta = Object.assign({}, defaultMetadata, rc.metadata, metadata);
              for (const [key, value] of Object.entries(mergedMeta)) {
                if (value) {
                  if (key === "title") {
                    buf += "<title>" + escapeHTML(value) + "</title>";
                  } else {
                    buf += "<meta "
                      + (key.startsWith("og:") ? "property" : "name") + "=" + toAttrStringLit(key)
                      + " content=" + toAttrStringLit(value)
                      + ">";
                  }
                }
              }
              write(buf);
            }
            break;
          }

          case "cache":
          case "static": {
            const { $stack, key = $stack, maxAge, children } = props;
            if (children) {
              if (key) {
                const now = Date.now();
                const value = cache.get(key);
                if (value && (!value.expiresAt || value.expiresAt > now)) {
                  write("<!-- " + tag + "(" + (tag === "cache" ? "hit" : "cache-hit") + ") -->");
                  write(value.html);
                  write("<!-- /" + tag + " -->");
                } else {
                  const chunks: string[] = [];
                  await renderChildren(
                    forkRenderContext(rc, {
                      write: (chunk: string) => {
                        chunks.push(chunk);
                      },
                    }),
                    children,
                    true,
                  );
                  const buf = chunks.join("");
                  cache.set(key, { html: buf, expiresAt: typeof maxAge === "number" && maxAge > 0 ? now + (maxAge * 1000) : undefined });
                  rc.write(buf);
                }
              } else {
                console.warn("[mono-jsx] <" + tag + "> The `key` prop is required for caching.");
                await renderChildren(rc, children, true);
              }
            }
            break;
          }

          case "redirect": {
            const { to, replace } = props;
            if (isString(to) || to instanceof URL) {
              let buf = "<m-redirect";
              buf += " to=" + toAttrStringLit(String(to));
              if (replace) {
                buf += " replace";
              }
              buf += "></m-redirect>";
              write(buf);
              rc.flags.runtime |= REDIRECT;
            }
            break;
          }

          case "invalid":
          case "formslot": {
            const { children, name, mode, for: forProp, hidden, onUpdate } = props;
            let buf = "<m-" + tag;
            if (isString(name)) {
              buf += " name=" + toAttrStringLit(name);
            }
            if (isString(mode)) {
              buf += " mode=" + toAttrStringLit(mode);
            }
            if (hidden) {
              buf += " hidden";
            }
            if (isFunction(onUpdate)) {
              const { fc, fidGenerator } = rc;
              const fid = fidGenerator.genId(onUpdate);
              buf += " onupdate=" + fid;
              if (fc) {
                buf += " scope=" + fc.id;
              }
            }
            if (isString(forProp)) {
              buf += " for=" + toAttrStringLit(forProp) + " hidden";
            } else if (tag === "invalid") {
              // ignore `invalid` element without `for` attribute
              break;
            }
            buf += ">";
            if (children) {
              const chunks: string[] = [];
              await renderChildren(
                forkRenderContext(rc, {
                  write: (chunk: string) => {
                    chunks.push(chunk);
                  },
                }),
                children,
              );
              buf += chunks.join("");
            }
            write(buf + "</m-" + tag + ">");
            rc.flags.runtime |= FORM;
            break;
          }

          default: {
            // function component
            if (isFunction(tag)) {
              await renderFC(rc, tag as ComponentType, props);
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
              let noChildren = props.children === undefined;
              let isSvgSelfClosingElement = rc.svg && noChildren;
              for (let [propName, propValue] of Object.entries(props)) {
                switch (propName) {
                  case "children":
                  case "mount":
                    // ignore `children` and `mount` properties
                    break;
                  case "route":
                    if (tag === "form") {
                      buffer += ' onsubmit="$onRFS(event)"';
                      rc.flags.runtime |= FORM;
                      break;
                    }
                    // fallthrough
                  default: {
                    const [attr, addonHtml, signalValue, binding] = renderAttr(rc, propName, propValue, stripSlotProp);
                    if (addonHtml) {
                      write(addonHtml);
                    }
                    if (signalValue) {
                      attrModifiers += renderSignal(rc, signalValue, [binding ? propName.slice(1) : propName]);
                      rc.flags.runtime |= RENDER_ATTR;
                    }
                    buffer += attr;
                  }
                }
              }
              write(buffer + (isSvgSelfClosingElement ? " />" : ">"));
              if (!voidTags.has(tag)) {
                if (attrModifiers) {
                  write(attrModifiers);
                }
                if (!noChildren) {
                  if (tag === "svg") {
                    await renderChildren(forkRenderContext(rc, { svg: true }), props.children);
                  } else {
                    await renderChildren(rc, props.children);
                  }
                }
                if (!isSvgSelfClosingElement) {
                  write("</" + tag + ">");
                }
              } else if (attrModifiers) {
                write("<m-group hidden>" + attrModifiers + "</m-group>");
              }
            }
          }
        }
      } else if (Array.isArray(node)) {
        for (const child of node) {
          await renderNode(rc, child);
        }
      }
      break;
  }
}

async function renderChildren(rc: RenderContext, children: ChildType | ChildType[], stripSlotProp?: boolean) {
  if (Array.isArray(children) && !isVNode(children)) {
    for (const child of children) {
      await renderNode(rc, child, stripSlotProp);
    }
  } else {
    await renderNode(rc, children as ChildType, stripSlotProp);
  }
}

function forkRenderContext(rc: RenderContext, overrides: Partial<RenderContext>): RenderContext {
  return Object.assign(Object.create(rc), overrides);
}

async function renderFC(rc: RenderContext, fcFn: ComponentType, props: JSX.IntrinsicAttributes, eager?: boolean) {
  const { write } = rc;
  const { children } = props;
  const scopeId = ++rc.flags.scope;
  const signals = createThisProxy(rc, scopeId);
  const slots: ChildType[] | undefined = children !== undefined
    ? (Array.isArray(children) ? (isVNode(children) ? [children as ChildType] : children) : [children])
    : undefined;
  const fc: FCScope = { id: scopeId, signals, slots, refs: 0 };
  const catchFn = props.catch as ((err: unknown) => JSX.Element) | undefined;
  try {
    const v = fcFn.call(signals, props);
    if (isObject(v) && !isVNode(v)) {
      if (v instanceof Promise) {
        let promise = v;
        if (catchFn) {
          promise = promise.catch(catchFn);
        }
        if (eager || (props.rendering ?? fcFn.rendering) === "eager") {
          const fcRc = forkRenderContext(rc, { fc });
          await renderNode(fcRc, (await promise) as ChildType);
          markSignals(fcRc, signals);
        } else {
          const chunkIdAttr = 'chunk-id="' + (rc.flags.chunk++).toString(36) + '"';
          write("<m-portal " + chunkIdAttr + ">");
          if (props.pending) {
            await renderNode(rc, props.pending);
          }
          write("</m-portal>");
          rc.suspenses.push(promise.then(async (node) => {
            const chunks: string[] = [];
            const chunkRc = forkRenderContext(rc, {
              fc,
              write: (chunk: string) => {
                chunks.push(chunk);
              },
            });
            chunks.push("<m-chunk " + chunkIdAttr + "><template>");
            await renderNode(chunkRc, node as ChildType);
            markSignals(chunkRc, signals);
            return chunks.join("") + "</template></m-chunk>";
          }));
        }
      } else if (Symbol.asyncIterator in v) {
        if (eager || (props.rendering ?? fcFn.rendering) === "eager") {
          const fcRc = forkRenderContext(rc, { fc });
          for await (const c of v) {
            await renderNode(fcRc, c as ChildType);
          }
          markSignals(fcRc, signals);
        } else {
          const chunkIdAttr = 'chunk-id="' + (rc.flags.chunk++).toString(36) + '"';
          write("<m-portal " + chunkIdAttr + ">");
          if (props.pending) {
            await renderNode(rc, props.pending);
          }
          write("</m-portal>");
          const iter = () =>
            rc.suspenses.push(
              v.next().then(async ({ done, value }) => {
                const chunks: string[] = [];
                const chunkRc = forkRenderContext(rc, {
                  fc,
                  write: (chunk: string) => {
                    chunks.push(chunk);
                  },
                });
                if (done) {
                  chunks.push("<m-chunk " + chunkIdAttr + " done>");
                  markSignals(chunkRc, signals);
                  return chunks.join("") + "</m-chunk>";
                }
                chunks.push("<m-chunk " + chunkIdAttr + " next><template>");
                await renderNode(chunkRc, value as ChildType);
                iter();
                return chunks.join("") + "</template></m-chunk>";
              }),
            );
          iter();
        }
      } else if (Symbol.iterator in v) {
        const fcRc = forkRenderContext(rc, { fc });
        for (const node of v) {
          await renderNode(fcRc, node as ChildType);
        }
        markSignals(fcRc, signals);
      }
    } else if (v) {
      const fcRc = forkRenderContext(rc, { fc });
      await renderNode(fcRc, v as ChildType);
      markSignals(fcRc, signals);
    }
  } catch (err) {
    if (catchFn) {
      await renderNode(rc, catchFn(err)).catch(() => {});
    } else {
      console.error(err);
      write("<script>console.error(" + stringify(errorStringify(err)) + ")</script>");
    }
  }
}

function renderAttr(
  rc: RenderContext,
  attrName: string,
  attrValue: unknown,
  stripSlotProp?: boolean,
): [attr: string, addonHtml: string, signalValue: Signal | Compute | undefined, binding: boolean] {
  let attr = "";
  let addonHtml = "";
  let signalValue: Signal | Compute | undefined;
  let binding = false;
  let scopeId = rc.fc?.id;
  if (isObject(attrValue)) {
    let signal: Signal | Compute | undefined;
    if (isReactive(attrValue)) {
      signal = attrValue;
    } else {
      if (scopeId) {
        const deps = new Set<string>();
        const patches = [] as string[];
        const staticProps = traverseProps(attrValue, (path, value) => {
          const { scope } = value;
          if (value instanceof Signal) {
            const { key } = value;
            patches.push([
              (scope !== scopeId ? "$signals(" + scope + ")" : "this") + "[" + stringify(key) + "]",
              ...path,
            ].join(","));
            deps.add(scope + ":" + key);
          } else {
            const { compute, deps } = value;
            patches.push(["(" + String(compute) + ")(),", ...path].join(","));
            for (const dep of deps) {
              deps.add(dep);
            }
          }
        });
        if (patches.length > 0) {
          const compute = "()=>$patch(" + stringify(staticProps) + ",[" + patches.join("],[") + "])";
          signal = new Compute(scopeId, compute, deps, staticProps);
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
      attrValue = signal.value;
    }
  }
  switch (attrName) {
    case "class":
      attr = " class=" + toAttrStringLit(cx(attrValue));
      break;
    case "style":
      if (isString(attrValue)) {
        attr = ' style="' + escapeCSSText(attrValue) + '"';
      } else if (isPlainObject(attrValue)) {
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
      if (isPlainObject(attrValue)) {
        attr = ' props="base64,' + btoa(stringify(attrValue)) + '"';
      }
      break;
    case "ref":
      if (isFunction(attrValue)) {
        const signals = rc.fc?.signals;
        if (!signals) {
          console.error("[mono-jsx] Use `ref` outside of a component function");
        } else {
          const refId = rc.fc!.refs++;
          const effects = signals[Symbol.for("effects")] as string[];
          effects.push("()=>(" + String(attrValue) + ')(this.refs["' + refId + '"])');
          attr = " data-ref=" + toAttrStringLit(rc.fc!.id + ":" + refId);
        }
      } else if (attrValue instanceof Ref) {
        attr = " data-ref=" + toAttrStringLit(attrValue.scope + ":" + attrValue.name);
      }
      break;
    case "action":
      if (isFunction(attrValue)) {
        const scopeId = rc.fc?.id;
        attr = ' onsubmit="$onsubmit(event,'
          + rc.fidGenerator.genId(attrValue)
          + (scopeId !== undefined ? "," + scopeId : "")
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
      if (signalValue instanceof Signal) {
        const { key } = signalValue;
        const fn = "e=>this[" + toAttrStringLit(key) + "]=e.target." + attrName.slice(1);
        attr += ' oninput="$emit(event,'
          + rc.fidGenerator.genId(fn)
          + (scopeId !== undefined ? "," + scopeId : "")
          + ')"';
        binding = true;
      }
      break;
    case "viewTransition":
      if (attrValue === true || attrValue === "") {
        attr = " data-vt";
      } else if (isString(attrValue)) {
        attr = " data-vt=" + toAttrStringLit(attrValue);
      }
      break;
    default:
      if (attrName.startsWith("on") && isFunction(attrValue)) {
        attr = " " + escapeHTML(attrName.toLowerCase()) + '="$emit(event,'
          + rc.fidGenerator.genId(attrValue)
          + (scopeId !== undefined ? "," + scopeId : "")
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

function renderFormslotAttr({ formslot }: { formslot?: string }): string {
  if (formslot) {
    return " formslot=" + toAttrStringLit(formslot);
  }
  return "";
}

function renderViewTransitionAttr({ viewTransition }: { viewTransition?: string | boolean }): string {
  if (viewTransition === true || viewTransition === "") {
    return " vt";
  }
  return isString(viewTransition) ? " style=" + toAttrStringLit("view-transition-name:" + viewTransition) + " vt" : "";
}

function renderSignal(
  rc: RenderContext,
  signal: Signal | Compute,
  mode?: "toggle" | "switch" | "list" | "html" | [string],
  close = true,
) {
  const { scope, value } = signal;
  let buffer = "<m-signal";
  if (mode) {
    if (Array.isArray(mode)) {
      mode = "[" + mode[0] + "]";
    }
    buffer += ' mode="' + mode + '"';
  }
  buffer += ' scope="' + scope + '"';
  if (signal instanceof Signal) {
    buffer += " key=" + toAttrStringLit(signal.key);
  } else {
    rc.signals.computes.add(signal);
    buffer += ' computed="' + rc.fidGenerator.genId(signal.compute) + '"';
  }
  if (mode && mode !== "html" && close) {
    buffer += " hidden";
  }
  buffer += ">";
  if (!mode || mode === "html") {
    let text: string | undefined;
    switch (typeof value) {
      case "string":
        text = value;
        break;
      case "number":
      case "bigint": {
        text = String(value);
        break;
      }
    }
    if (text) {
      buffer += !mode ? escapeHTML(text) : text;
    }
  }
  return buffer + (close ? "</m-signal>" : "");
}

let collectDep: ((scopeId: number, key: string) => void) | undefined;

function createThisProxy(rc: RenderContext, scopeId: number): Record<string, unknown> {
  const { context = {}, request, session } = rc;
  const store = new NullPrototypeObject() as Record<string | symbol, unknown>;
  const signals = new Map<string, Signal>();
  const effects = [] as string[];
  const refs = new Proxy(new NullPrototypeObject(), {
    get(_, key) {
      return new Ref(scopeId, key as string);
    },
  });
  const computed = (compute: () => unknown): unknown => {
    const deps = new Set<string>();
    collectDep = (scopeId, key) => deps.add(scopeId + ":" + key);
    const value = compute.call(thisProxy);
    collectDep = undefined;
    return new Compute(scopeId, compute, deps, value);
  };
  const mark = ({ signals, write }: RenderContext) => {
    if (effects.length > 0) {
      const n = effects.length;
      if (n > 0) {
        for (let i = 0; i < n; i++) {
          signals.effects.push([scopeId, effects[i]]);
        }
        write('<m-effect scope="' + scopeId + '" hidden></m-effect>');
      }
    }
    for (const [key, value] of Object.entries(store)) {
      signals.store.set(scopeId + ":" + key, value);
    }
  };

  const thisProxy = new Proxy(store, {
    get(target, key, receiver) {
      switch (key) {
        case "init":
          return (init: Record<string, unknown>) => {
            Object.assign(target, init);
          };
        case "app":
          if (scopeId === 0) {
            return null;
          }
          return rc.signals.app;
        case "context":
          return context;
        case "request":
          if (!request) {
            throw new TypeError("[mono-jsx] The `request` prop in the `<html>` element is required.");
          }
          return request;
        case "session":
          if (!session) {
            throw new TypeError("[mono-jsx] The `session` and `request` props in the `<html>` element are required.");
          }
          return session;
        case "refs":
          return refs;
        case "computed":
        case "$":
          return computed;
        case "effect":
          return (effect: CallableFunction) => {
            effects.push(String(effect));
          };
        case Symbol.for("effects"):
          return effects;
        case Symbol.for("mark"):
          return mark;
        case "url":
          if (scopeId === 0) {
            collectDep?.(0, key);
            if (request) {
              const req: Request & { URL?: URL } = request;
              return req.URL ?? (req.URL = new URL(req.url));
            }
            return undefined;
          }
          // fallthrough
        default: {
          if (!Reflect.has(target, key)) {
            Reflect.set(target, key, undefined, receiver);
          }
          const value = Reflect.get(target, key, receiver);
          if (typeof key === "symbol" || isReactive(value)) {
            return value;
          }
          if (collectDep) {
            collectDep(scopeId, key);
            return value;
          }
          let signal = signals.get(key);
          if (!signal) {
            signal = new Signal(scopeId, key, value);
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

function createInvokeScope(
  request: Request,
  context: Record<string, unknown> | undefined,
  session: Session | undefined,
): Record<string, unknown> {
  const scope = new NullPrototypeObject();
  Object.assign(scope, { request, context: context ?? {} });
  Object.defineProperty(scope, "session", {
    get() {
      if (!session) {
        throw new TypeError("[mono-jsx] The `session` prop in the `<html>` element is required.");
      }
      return session;
    },
  });
  return scope;
}

async function createSession(request: Request, options: SessionOptions): Promise<Session> {
  let sessionId: string | undefined;
  let sessionStore = new Map<string, any>();
  let isDirty = false;
  let isExpired = false;
  let session: Session = {
    get sessionId() {
      return sessionId ?? "";
    },
    get isDirty() {
      return isDirty;
    },
    get isExpired() {
      return isExpired;
    },
    get: (key) => sessionStore.get(key),
    all: () => Object.fromEntries(sessionStore.entries()),
    set: (key, value) => {
      sessionStore.set(key, value);
      isDirty = true;
    },
    delete: (key) => {
      sessionStore.delete(key);
      isDirty = true;
    },
    destroy: () => {
      sessionStore.clear();
      isDirty = true;
    },
  };

  const { name = "session", secret } = options.cookie ?? {};
  if (!secret) {
    throw new TypeError("[mono-jsx] The `cookie.secret` option is required for the session.");
  }

  const sid = request.headers.get("cookie")?.split("; ").find((cookie) => cookie.startsWith(name + "="))?.slice(name.length + 1);
  if (sid) {
    let [data, signature] = sid.split(".", 2);
    if (signature) {
      try {
        data = atob(data);
        signature = atob(signature);
        const verified = await subtle.verify(
          "HMAC",
          await importHmacKey(secret),
          Uint8Array.from(signature, char => char.charCodeAt(0)),
          encoder.encode(data),
        );
        if (verified) {
          const [map, exp] = JSON.parse(data);
          if (typeof exp === "number") {
            if (exp * 1000 > Date.now()) {
              sessionStore = new Map(Object.entries(map));
            } else {
              isExpired = true;
            }
            sessionId = sid;
          }
        }
      } catch (_) {
        // ignore invalid session data
      }
    }
  }
  return session;
}

function markSignals(rc: RenderContext, signals: Record<symbol, unknown>) {
  (signals[Symbol.for("mark")] as ((rc: RenderContext) => void))(rc);
}

function traverseProps(
  obj: object,
  callback: (path: string[], signal: Signal | Compute) => void,
  path: string[] = [],
): typeof obj {
  const isArray = Array.isArray(obj);
  const copy: any = isArray ? new Array(obj.length) : new NullPrototypeObject();
  for (const [k, value] of Object.entries(obj)) {
    const newPath = path.concat(isArray ? k : stringify(k));
    const key = isArray ? Number(k) : k;
    if (isObject(value)) {
      if (isReactive(value)) {
        copy[key] = value.value; // use the value of the signal
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

function importHmacKey(secret: string): Promise<CryptoKey> {
  let key = hmacKeyCache.get(secret);
  if (!key) {
    key = subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    hmacKeyCache.set(secret, key);
  }
  return key;
}

export { cache, isReactive, renderToWebStream };
