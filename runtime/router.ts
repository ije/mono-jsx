declare global {
  var $runtimeFlag: number;
  var $scopeSeq: number;
}

const doc = document;
const stripHash = (href: string) => href.split("#", 1)[0];

customElements.define(
  "m-router",
  class extends HTMLElement {
    #fallback?: ChildNode[];
    #onClick?: (e: MouseEvent) => void;
    #ac?: AbortController;

    async #fetchPage(href: string) {
      const headers = {
        "x-route": "true",
        "x-runtime-flag": "" + $runtimeFlag,
        "x-scope-seq": "" + $scopeSeq,
      };
      const ac = new AbortController();
      this.#ac?.abort();
      this.#ac = ac;
      const res = await fetch(href, { headers, signal: ac.signal });
      if (res.status === 404) {
        this.replaceChildren(...(this.#fallback!));
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to fetch route: " + res.status + " " + res.statusText);
      }
      const [html, js] = await res.json();
      this.innerHTML = html;
      if (js) {
        doc.body.appendChild(doc.createElement("script")).textContent = js;
      }
    }

    #updateNavLinks() {
      doc.querySelectorAll("nav").forEach((nav) => {
        const activeClass = nav.getAttribute("data-active-class") ?? "active";
        nav.querySelectorAll("a").forEach(({ href, classList }) => {
          if (stripHash(href) === stripHash(location.href)) {
            classList.add(activeClass);
          } else {
            classList.remove(activeClass);
          }
        });
      });
    }

    connectedCallback() {
      // set a timeout to wait for the element to be fully parsed
      setTimeout(() => {
        if (!this.#fallback) {
          if (this.getAttribute("status") === "404") {
            this.#fallback = [...this.childNodes];
          } else {
            this.#fallback = [];
            for (const child of this.childNodes) {
              if (child.nodeType === 1 && (child as Element).tagName === "TEMPLATE" && (child as Element).hasAttribute("m-slot")) {
                this.#fallback.push(...(child as HTMLTemplateElement).content.childNodes);
                child.remove();
                break;
              }
            }
          }
        }
      });

      this.#onClick = (e: MouseEvent) => {
        // skip if the event is already prevented or if any modifier keys are pressed
        // or if the link is not a regular link
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !(e.target instanceof HTMLAnchorElement)) {
          return;
        }

        const { download, href, rel, target } = e.target as HTMLAnchorElement;
        if (
          download
          || rel === "external"
          || target === "_blank"
          || !href
          || !href.startsWith(location.origin)
          || stripHash(href) === stripHash(location.href)
        ) {
          return;
        }

        // prevent the default action of the link
        e.preventDefault();

        // update the url in the browser's address bar
        history.pushState({}, "", href);

        // fetch the new page
        this.#fetchPage(href);

        // update the navigation links
        this.#updateNavLinks();
      };

      doc.addEventListener("click", this.#onClick);
      this.#updateNavLinks();
    }

    disconnectedCallback() {
      doc.removeEventListener("click", this.#onClick!);
      this.#ac?.abort();
      this.#onClick = undefined;
      this.#ac = undefined;
    }
  },
);
