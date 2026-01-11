declare global {
  var $FLAGS: string;
}

const doc = document;
const attr = (el: Element, name: string): string | null => el.getAttribute(name);

customElements.define(
  "m-component",
  class extends HTMLElement {
    static observedAttributes = ["name", "props"];

    #name?: string | null;
    #props?: string;
    #pendingNodes?: ChildNode[];
    #ac?: AbortController;
    #timer?: number;
    #cache = new Map<string, string>();
    #isBlank = true;

    async #fetchCompnent() {
      if (!this.#name) {
        this.#setContent("");
        return;
      }
      const props = this.#props || "{}";
      const cacheKey = this.#name + props;
      const headers = {
        "x-component": this.#name,
        "x-props": props,
        "x-flags": $FLAGS,
      };
      const ac = new AbortController();
      this.#ac?.abort();
      this.#ac = ac;
      if (this.#cache.has(cacheKey)) {
        this.#setContent(this.#cache.get(cacheKey)!);
        return;
      }
      if (this.#pendingNodes?.length) {
        this.#setContent(this.#pendingNodes);
      }
      const res = await fetch(location.href, { headers, signal: ac.signal });
      if (!res.ok) {
        this.#setContent("");
        throw new Error("Failed to fetch component '" + this.#name + "'");
      }
      const [html, js] = await res.json();
      this.#cache.set(cacheKey, html);
      this.#setContent(html);
      if (js) {
        doc.body.appendChild(doc.createElement("script")).textContent = js;
      }
    }

    #setContent(body: string | Node[]) {
      const update = () => typeof body === "string" ? this.innerHTML = body : this.replaceChildren(...body);
      if (this.hasAttribute("vt") && doc.startViewTransition && !this.#isBlank) {
        doc.startViewTransition(update);
      } else {
        update();
      }
      this.#isBlank = false;
    }

    get name(): string | null {
      return this.#name ?? null;
    }

    set name(name: string) {
      if (name && name !== this.#name) {
        this.#name = name;
        this.#refresh();
      }
    }

    get props(): Record<string, unknown> | undefined {
      return this.#props ? JSON.parse(this.#props) : undefined;
    }

    set props(props: Record<string, unknown> | string) {
      const propsJson = typeof props === "string" ? props : JSON.stringify(props);
      if (propsJson && propsJson !== this.#props) {
        this.#props = propsJson;
        this.#refresh();
      }
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

    connectedCallback() {
      // set a timeout to wait for the element to be fully parsed
      setTimeout(() => {
        if (!this.#pendingNodes) {
          const propsAttr = attr(this, "props");
          this.#name = attr(this, "name");
          this.#props = propsAttr?.startsWith("base64,") ? atob(propsAttr.slice(7)) : undefined;
          this.#pendingNodes = [...this.childNodes];
        }
        this.#fetchCompnent();
      });
    }

    disconnectedCallback() {
      this.#cache.clear();
      this.#ac?.abort();
      this.#ac = undefined;
      this.#timer && clearTimeout(this.#timer);
      this.#timer = undefined;
    }

    #refresh() {
      this.#timer && clearTimeout(this.#timer);
      this.#timer = setTimeout(() => {
        this.#timer = undefined;
        this.#fetchCompnent();
      }, 50);
    }

    refresh() {
      if (this.#name) {
        this.#cache.delete(this.#name + (this.#props || "{}"));
      }
      this.#refresh();
    }
  },
);
