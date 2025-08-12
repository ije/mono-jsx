declare global {
  var $FLAGS: string;
}

const doc = document;
const attr = (el: Element, name: string): string | null => el.getAttribute(name);
const replaceChildren = (el: Element, children: Node[] = []) => el.replaceChildren(...children);

customElements.define(
  "m-component",
  class extends HTMLElement {
    static observedAttributes = ["name", "props"];

    #name?: string | null;
    #props?: string;
    #placeholder?: ChildNode[];
    #ac?: AbortController;
    #timer?: number;

    async #render() {
      if (!this.#name) {
        const vtName = this.getAttribute("view-transition");
        const apply = () => replaceChildren(this);
        if (vtName && (document as any).startViewTransition) {
          this.style.viewTransitionName = vtName;
          (document as any).startViewTransition(apply);
        } else {
          apply();
        }
        return;
      }
      const headers = {
        "x-component": this.#name!,
        "x-props": this.#props || "{}",
        "x-flags": $FLAGS,
      };
      const ac = new AbortController();
      this.#ac?.abort();
      this.#ac = ac;
      {
        const vtName = this.getAttribute("view-transition");
        const apply = () => replaceChildren(this, this.#placeholder!);
        if (vtName && (document as any).startViewTransition) {
          this.style.viewTransitionName = vtName;
          (document as any).startViewTransition(apply);
        } else {
          apply();
        }
      }
      const res = await fetch(location.href, { headers, signal: ac.signal });
      if (!res.ok) {
        const vtName = this.getAttribute("view-transition");
        const apply = () => replaceChildren(this);
        if (vtName && (document as any).startViewTransition) {
          this.style.viewTransitionName = vtName;
          (document as any).startViewTransition(apply);
        } else {
          apply();
        }
        throw new Error("Failed to fetch component '" + this.#name + "'");
      }
      const [html, js] = await res.json();
      {
        const vtName = this.getAttribute("view-transition");
        const apply = () => { this.innerHTML = html; };
        if (vtName && (document as any).startViewTransition) {
          this.style.viewTransitionName = vtName;
          (document as any).startViewTransition(apply);
        } else {
          apply();
        }
      }
      if (js) {
        doc.body.appendChild(doc.createElement("script")).textContent = js;
      }
    }

    get name(): string | null {
      return this.#name ?? null;
    }

    set name(name: string) {
      if (name && name !== this.#name) {
        this.#name = name;
        this.refresh();
      }
    }

    get props(): Record<string, unknown> | undefined {
      return this.#props ? JSON.parse(this.#props) : undefined;
    }

    set props(props: Record<string, unknown> | string) {
      const propsJson = typeof props === "string" ? props : JSON.stringify(props);
      if (propsJson && propsJson !== this.#props) {
        this.#props = propsJson;
        this.refresh();
      }
    }

    connectedCallback() {
      // set a timeout to wait for the element to be fully parsed
      setTimeout(() => {
        if (!this.#placeholder) {
          const propsAttr = attr(this, "props");
          this.#name = attr(this, "name");
          this.#props = propsAttr?.startsWith("base64,") ? atob(propsAttr.slice(7)) : undefined;
          this.#placeholder = [...this.childNodes];
        }
        this.#render();
      });
    }

    disconnectedCallback() {
      replaceChildren(this, this.#placeholder!);
      this.#ac?.abort();
      this.#ac = undefined;
      this.#timer && clearTimeout(this.#timer);
      this.#timer = undefined;
    }

    attributeChangedCallback(attrName: string, _oldValue: string | null, newValue: string | null) {
      if (this.#name && newValue) {
        if (attrName === "name") {
          this.name = newValue;
        } else if (attrName === "props") {
          this.props = newValue;
        }
      }
    }

    refresh() {
      this.#timer && clearTimeout(this.#timer);
      this.#timer = setTimeout(() => {
        this.#timer = undefined;
        this.#render();
      }, 50);
    }
  },
);
