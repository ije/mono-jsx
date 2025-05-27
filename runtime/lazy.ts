declare global {
  var $runtimeJSFlag: number;
  var $scopeFlag: number;
}

customElements.define(
  "m-component",
  class extends HTMLElement {
    static observedAttributes = ["name", "props"];

    #name?: string;
    #props?: string;
    #placeholder?: ChildNode[];
    #renderDelay?: number;
    #renderAC?: AbortController;

    async render() {
      const headers = {
        "x-component": this.#name!,
        "x-props": this.#props ?? "{}",
        "x-runtimejs-flag": "" + $runtimeJSFlag,
        "x-scope-flag": "" + $scopeFlag,
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
        document.body.appendChild(document.createElement("script")).textContent = js;
      }
    }

    connectedCallback() {
      // set a timeout to wait for the element to be fully parsed
      setTimeout(() => {
        if (!this.#name) {
          const nameAttr = this.getAttribute("name");
          if (!nameAttr) {
            throw new Error("Component name is required");
          }
          this.#name = nameAttr;
          this.#placeholder = [...this.childNodes].filter((child) => {
            if (child.nodeType === 1 && (child as Element).tagName === "TEMPLATE" && (child as Element).hasAttribute("data-props")) {
              this.#props = (child as HTMLTemplateElement).content.textContent!;
              return false;
            }
            return true;
          });
        }
        this.render();
      });
    }

    disconnectedCallback() {
      this.replaceChildren(...this.#placeholder!);
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
          this.render();
        }, 20);
      }
    }
  },
);
