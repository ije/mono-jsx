declare global {
  var $runtimeFlag: number;
  var $scopeSeq: number;
}

const doc = document;
const attr = (el: Element, name: string): string | null => el.getAttribute(name);

customElements.define(
  "m-component",
  class extends HTMLElement {
    static observedAttributes = ["name", "props"];

    #name?: string;
    #props?: string | null;
    #placeholder?: ChildNode[];
    #renderDelay?: number;
    #renderAC?: AbortController;

    async #render() {
      const headers = {
        "x-component": this.#name!,
        "x-props": this.#props ?? "{}",
        "x-runtime-flag": "" + $runtimeFlag,
        "x-scope-seq": "" + $scopeSeq,
      };
      const ac = new AbortController();
      this.#renderAC?.abort();
      this.#renderAC = ac;
      const res = await fetch(location.href, { headers, signal: ac.signal });
      if (!res.ok) {
        throw new Error("Failed to fetch component '" + name + "'");
      }
      const [html, js] = await res.json();
      this.innerHTML = html;
      if (js) {
        doc.body.appendChild(doc.createElement("script")).textContent = js;
      }
    }

    connectedCallback() {
      // set a timeout to wait for the element to be fully parsed
      setTimeout(() => {
        if (!this.#name) {
          const nameAttr = attr(this, "name");
          const propsAttr = attr(this, "props");
          if (!nameAttr) {
            throw new Error("Component name is required");
          }
          this.#name = nameAttr;
          this.#props = propsAttr?.startsWith("base64,") ? atob(propsAttr.slice(7)) : null;
          this.#placeholder = [...this.childNodes];
        }
        this.#render();
      });
    }

    disconnectedCallback() {
      this.replaceChildren(...this.#placeholder!);
      this.#renderAC?.abort();
      this.#renderDelay && clearTimeout(this.#renderDelay);
      this.#renderAC = undefined;
      this.#renderDelay = undefined;
    }

    attributeChangedCallback(attrName: string, oldValue: string | null, newValue: string | null) {
      if (this.#name && newValue && oldValue !== newValue) {
        if (attrName === "name") {
          this.#name = newValue;
        } else if (attrName === "props") {
          this.#props = newValue;
        }
        if (this.#renderDelay) {
          clearTimeout(this.#renderDelay);
        }
        this.#renderDelay = setTimeout(() => {
          this.#renderDelay = undefined;
          this.#render();
        }, 20);
      }
    }
  },
);
