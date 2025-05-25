customElements.define(
  "m-lazy",
  class extends HTMLElement {
    props?: string;
    placeholder?: ChildNode[];
    connectedCallback() {
      // set a timeout to wait for the element to be fully parsed
      setTimeout(() => {
        if (!this.placeholder) {
          this.placeholder = [...this.childNodes].filter(
            (child) => {
              if (child.nodeType === 1 && (child as Element).tagName === "TEMPLATE") {
                if ((child as HTMLTemplateElement).hasAttribute("data-props")) {
                  this.props = (child as HTMLTemplateElement).content.textContent!;
                }
                return false;
              }
              return true;
            },
          );
        }
        fetch(location.href, {
          headers: {
            "x-component": this.getAttribute("name")!,
            "x-props": this.props ?? "{}",
            "x-runtimejs-flag": "" + Reflect.get(window, "$runtimeJSFlag"),
            "x-scope-flag": "" + Reflect.get(window, "$runtimeJSFlag"),
          },
        }).then((res) => {
          if (!res.ok) {
            console.error("Failed to fetch component:", res.status, res.statusText);
            return;
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
