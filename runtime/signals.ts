interface Signals {
  readonly store: Record<string, unknown>;
  readonly define: (key: string, initialValue: unknown) => void;
  readonly watch: (key: string, effect: () => void) => () => void;
}

// deno-lint-ignore no-explicit-any
const global = globalThis as any;
const mcs = new Map<number, [Function, string[]]>();
const scopes = new Map<number, Signals>();
const Signals = (scope: number) => scopes.get(scope) ?? scopes.set(scope, createSignals(scope)).get(scope)!;

const getAttr = (el: Element, name: string) => el.getAttribute(name);
const hasAttr = (el: Element, name: string) => el.hasAttribute(name);
const setAttr = (el: Element, name: string, value: string) => el.setAttribute(name, value);
const replaceChildren = (el: Element, children: Node[]) => el.replaceChildren(...children);

const createSignals = (scope: number): Signals => {
  const store = Object.create(null);
  const effectMap = new Map<string, Set<(() => void)>>();

  const define = (key: string, initialValue: unknown) => {
    let value: unknown = initialValue;
    Object.defineProperty(store, key, {
      get: () => {
        collectDeps?.(scope, key);
        return value;
      },
      set: (newValue: unknown) => {
        if (newValue !== value) {
          const effects = effectMap.get(key);
          if (effects) {
            queueMicrotask(() => effects.forEach((fn) => fn()));
          }
          value = newValue;
        }
      },
    });
  };

  const watch = (key: string, effect: () => void) => {
    let effects = effectMap.get(key);
    if (!effects) {
      effects = new Set();
      effectMap.set(key, effects);
    }
    effects.add(effect);
    return () => {
      effects.delete(effect);
      if (effects.size === 0) {
        effectMap.delete(key);
      }
    };
  };

  if (scope > 0) {
    Object.defineProperty(store, "app", { get: () => Signals(0).store, enumerable: false, configurable: false });
  }

  return { store, define, watch };
};

const createDomEffect = (el: Element, mode: string | null, getter: () => unknown) => {
  if (mode === "toggle") {
    let slots: Array<ChildNode> | undefined;
    return () => {
      if (!slots) {
        const firstChild = el.firstElementChild;
        if (firstChild && firstChild.tagName === "TEMPLATE" && hasAttr(firstChild, "m-slot")) {
          slots = [...(firstChild as HTMLTemplateElement).content.childNodes];
        } else {
          slots = [...el.childNodes];
        }
      }
      replaceChildren(el, getter() ? slots : []);
    };
  }
  if (mode === "switch") {
    let value: string;
    let toMatch = getAttr(el, "match");
    let slotsMap: Map<string, Array<ChildNode>> | undefined;
    let unnamedSlots: Array<ChildNode> | undefined;
    let getNamedSlots = (slotName: string) => slotsMap!.get(slotName) ?? slotsMap!.set(slotName, []).get(slotName)!;
    return () => {
      if (!slotsMap) {
        slotsMap = new Map();
        unnamedSlots = [];
        for (const slot of el.childNodes) {
          if (slot.nodeType === 1 && (slot as HTMLElement).tagName === "TEMPLATE" && hasAttr(slot as HTMLElement, "m-slot")) {
            for (const node of (slot as HTMLTemplateElement).content.childNodes) {
              if (node.nodeType === 1 && hasAttr(node as HTMLElement, "slot")) {
                getNamedSlots(getAttr(node as HTMLElement, "slot")!).push(node);
              } else {
                unnamedSlots.push(node);
              }
            }
            slot.remove();
          } else {
            if (toMatch) {
              getNamedSlots(toMatch).push(slot);
            } else {
              unnamedSlots.push(slot);
            }
          }
        }
      }
      value = "" + getter();
      replaceChildren(el, slotsMap.has(value) ? slotsMap.get(value)! : unnamedSlots!);
    };
  }
  if (mode && mode.length > 2 && mode.startsWith("[") && mode.endsWith("]")) {
    let attrName = mode.slice(1, -1);
    let target: Element = el.parentElement!;
    if (target.tagName === "M-GROUP") {
      target = target.previousElementSibling!;
    }
    return () => {
      const value = getter();
      if (value === false) {
        target.removeAttribute(attrName);
      } else if ((attrName === "class" || attrName === "style") && typeof value === "object" && value !== null) {
        if (attrName === "class") {
          // @ts-ignore - `$cx` is injected by the renderer
          setAttr(target, attrName, $cx(value));
        } else {
          // @ts-ignore - `$styleToCSS` is injected by the renderer
          const { inline } = $styleToCSS(value);
          if (inline) {
            setAttr(target, attrName, inline);
          }
        }
      } else {
        setAttr(target, attrName, value === true ? "" : "" + value);
      }
    };
  }
  return () => el.textContent = "" + getter();
};

const resolveSignalID = (id: string): [scope: number, key: string] => {
  const i = id.indexOf(":");
  if (i > 0) {
    return [Number(id.slice(0, i)), id.slice(i + 1)];
  }
  throw new Error("Invalid  Singal ID");
};

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

customElements.define(
  "m-signal",
  class extends HTMLElement {
    disposes: (() => void)[] = [];
    connectedCallback() {
      const signals = Signals(Number(getAttr(this, "scope")));
      const key = getAttr(this, "key");
      if (key) {
        this.disposes.push(signals.watch(key, createDomEffect(this, getAttr(this, "mode"), () => signals.store[key])));
      } else {
        const id = Number(getAttr(this, "computed"));
        const getCompute = async () => {
          const compute = mcs.get(id);
          if (compute) {
            return compute;
          }
          // next tick
          await nextTick();
          return getCompute();
        };
        getCompute().then(([compute, deps]) => {
          const effect = createDomEffect(this, getAttr(this, "mode"), compute.bind(signals.store));
          deps.forEach((dep) => {
            const [scope, key] = resolveSignalID(dep);
            this.disposes.push(Signals(scope).watch(key, effect));
          });
        });
      }
    }
    disconnectedCallback() {
      const { disposes } = this;
      disposes.forEach((dispose) => dispose());
      disposes.length = 0;
    }
  },
);

let collectDeps: ((scope: number, key: string) => void) | undefined;

customElements.define(
  "m-effect",
  class extends HTMLElement {
    disposes: (() => void)[] = [];
    connectedCallback() {
      const scope = Number(getAttr(this, "scope"));
      const n = Number(getAttr(this, "n"));
      const cleanups: ((() => void) | undefined)[] = new Array(n);
      const { disposes } = this;
      disposes.push(() => {
        cleanups.forEach((cleanup) => typeof cleanup === "function" && cleanup());
        cleanups.length = 0;
      });
      for (let i = 0; i < n; i++) {
        const fname = "$ME_" + scope + "_" + i;
        const getFn = async () => {
          const f = global[fname];
          if (f) {
            return f;
          }
          // next tick
          await nextTick();
          return getFn();
        };
        getFn().then((fn) => {
          const deps: [number, string][] = [];
          const signals = Signals(scope);
          const effect = () => {
            cleanups[i] = fn.call(signals.store);
          };
          collectDeps = (scope, key) => deps.push([scope, key]);
          effect();
          collectDeps = undefined;
          for (const [scope, key] of deps) {
            disposes.push(Signals(scope).watch(key, effect));
          }
        });
      }
    }
    disconnectedCallback() {
      const { disposes } = this;
      disposes.forEach((dispose) => dispose());
      disposes.length = 0;
    }
  },
);

// get the signals store
global.$signals = (scope?: number) => scope !== undefined ? Signals(scope).store : undefined;

// define a signal
global.$MS = (id: string, value: unknown) => {
  const [scope, key] = resolveSignalID(id);
  Signals(scope).define(key, value);
};

// define a computed signal
global.$MC = (id: number, compute: Function, deps: string[]) => {
  mcs.set(id, [compute, deps]);
};
