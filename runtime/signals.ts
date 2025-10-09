declare global {
  interface Signals {
    readonly $init: (key: string, value: unknown) => void;
    readonly $watch: (key: string, effect: () => void) => () => void;
    readonly refs: Record<string, unknown>;
  }
}

let collectDep: ((scopeId: number, key: string) => void) | undefined;

const win = window as any;
const doc = document;
const mcs = new Map<number, [Function, string[]]>();
const scopes = new Map<number, Signals>();
const Signals = (scopeId: number) => scopes.get(scopeId) ?? scopes.set(scopeId, createSignals(scopeId)).get(scopeId)!;

const createNullObject = () => Object.create(null);
const getAttr = (el: Element, name: string) => el.getAttribute(name);

const createSignals = (scopeId: number): Signals => {
  const store = createNullObject();
  const init = (key: string, value: unknown) => {
    store[key] = value;
  };

  const watchers = new Map<string, Set<(() => void)>>();
  const watch = (key: string, effect: () => void) => {
    let effects = watchers.get(key);
    if (!effects) {
      effects = new Set();
      watchers.set(key, effects);
    }
    effects.add(effect);
    return () => {
      effects.delete(effect);
      if (effects.size === 0) {
        watchers.delete(key);
      }
    };
  };

  const refs = new Proxy(createNullObject(), {
    get: (_target, prop: string) => doc.querySelector("[data-ref='" + scopeId + ":" + prop + "']"),
  });

  return new Proxy(store, {
    get: (target, prop: string, receiver) => {
      switch (prop) {
        case "$init":
          return init;
        case "$watch":
          return watch;
        case "app":
          return Signals(0);
        case "refs":
          return refs;
        default:
          collectDep?.(scopeId, prop);
          return Reflect.get(target, prop, receiver);
      }
    },
    set: (target, prop: string, value, receiver) => {
      if (value !== Reflect.get(target, prop, receiver)) {
        const effects = watchers.get(prop);
        if (effects) {
          queueMicrotask(() => effects.forEach((fn) => fn()));
        }
        return Reflect.set(target, prop, value, receiver);
      }
      return false;
    },
  }) as Signals;
};

const createDomEffect = (el: Element, mode: string | null, getter: () => unknown) => {
  switch (mode) {
    case "toggle":
      return $renderToggle(el, getter);
    case "switch":
      return $renderSwitch(el, getter);
    case "html":
      return () => el.innerHTML = "" + getter();
  }
  if (mode && mode.length > 2 && mode.startsWith("[") && mode.endsWith("]")) {
    return $renderAttr(el, mode.slice(1, -1), getter);
  }
  const parent = el.parentElement!;
  const update = () => el.textContent = "" + getter();
  if (doc.startViewTransition && parent.hasAttribute("data-vt")) {
    const viewTransitionName = parent.getAttribute("data-vt");
    if (viewTransitionName) {
      parent.style.viewTransitionName = viewTransitionName;
    }
    return () => doc.startViewTransition(update);
  }
  return update;
};

const resolveSignalID = (id: string): [scope: number, key: string] | null => {
  const i = id.indexOf(":");
  return i > 0 ? [Number(id.slice(0, i)), id.slice(i + 1)] : null;
};

const defer = async <T>(getter: () => T | undefined) => {
  const v = getter();
  if (v !== undefined) {
    return v;
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  return defer(getter);
};

const callFn = (v: unknown) => {
  if (typeof v === "function") {
    v();
  }
};

const defineElement = (tag: string, callback: (el: Element & { disposes: (() => void)[] }) => void) =>
  customElements.define(
    tag,
    class extends HTMLElement {
      disposes: (() => void)[] = [];
      connectedCallback() {
        callback(this);
      }
      disconnectedCallback() {
        this.disposes.forEach((dispose) => dispose());
        this.disposes.length = 0;
      }
    },
  );

defineElement("m-signal", (el) => {
  const scope = Number(getAttr(el, "scope"));
  const signals = Signals(scope);
  const key = getAttr(el, "key");
  if (key) {
    el.disposes.push(signals.$watch(key, createDomEffect(el, getAttr(el, "mode"), () => (signals as any)[key])));
  } else {
    const id = Number(getAttr(el, "computed"));
    defer(() => mcs.get(scope * 1e9 + id)).then(([compute, deps]) => {
      const effect = createDomEffect(el, getAttr(el, "mode"), compute.bind(signals));
      deps.forEach((dep) => {
        const [scope, key] = resolveSignalID(dep)!;
        el.disposes.push(Signals(scope).$watch(key, effect));
      });
    });
  }
});

defineElement("m-effect", (el) => {
  const { disposes } = el;
  const scope = Number(getAttr(el, "scope"));
  const n = Number(getAttr(el, "n"));
  const cleanups = new Array<unknown>(n);
  disposes.push(() => {
    cleanups.forEach(callFn);
    cleanups.length = 0;
  });
  for (let i = 0; i < n; i++) {
    const fname = "$ME_" + scope + "_" + i;
    defer<Function>(() => win[fname]).then((fn) => {
      const deps: [number, string][] = [];
      const signals = Signals(scope);
      const effect = () => {
        callFn(cleanups[i]);
        cleanups[i] = fn.call(signals);
      };
      collectDep = (scope, key) => deps.push([scope, key]);
      effect();
      collectDep = undefined;
      for (const [scope, key] of deps) {
        disposes.push(Signals(scope).$watch(key, effect));
      }
    }, () => {});
  }
});

// initialize a signal with the given value
win.$MS = (id: string, value: unknown) => {
  const [scope, key] = resolveSignalID(id)!;
  Signals(scope).$init(key, value);
};

// define a computed signal
win.$MC = (scope: number, id: number, compute: Function, deps: string[]) => {
  mcs.set(scope * 1e9 + id, [compute, deps]);
};

// update an object with patches
win.$patch = (obj: Record<string, unknown>, ...patches: unknown[][]) => {
  for (const [value, ...path] of patches) {
    const key = path.pop()!;
    let target = obj;
    for (const p of path) {
      target = (target as any)[p as string];
    }
    target[key as string] = value;
  }
  return obj;
};

// get the signals
win.$signals = (scope?: number) => scope !== undefined ? Signals(scope) : undefined;
