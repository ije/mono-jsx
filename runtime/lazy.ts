customElements.define(
  "m-lazy",
  class extends HTMLElement {
    props?: string;
    placeholder?: ChildNode[];
    connectedCallback() {
      // set a timeout to wait for the element to be fully parsed
      setTimeout(() => {
        if (!this.placeholder) {
          this.placeholder = [...this.childNodes].filter((child) => {
            if (child.nodeType === 1 && (child as Element).tagName === "TEMPLATE" && (child as Element).hasAttribute("data-props")) {
              this.props = (child as HTMLTemplateElement).content.textContent!;
              return false;
            }
            return true;
          });
        }
        const nameAttr = this.getAttribute("name")!;
        const headers = {
          "x-component": nameAttr,
          "x-props": this.props ?? "{}",
          "x-runtimejs-flag": "" + (window as any).$runtimeJSFlag,
          "x-scope-flag": "" + (window as any).$scopeFlag,
        };
        fetch(location.href, { headers }).then((res) => {
          if (!res.ok) {
            throw new Error("Failed to fetch component '" + nameAttr + "'");
          }
          res.json().then(([html, js]) => {
            this.innerHTML = html;
            if (js) {
              document.body.appendChild(document.createElement("script")).textContent = js;
            }
          });
        });
      });
    }
    disconnectedCallback() {
      this.replaceChildren(...this.placeholder!);
    }
  },
);
