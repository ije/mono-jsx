declare global {
  var $FLAGS: string;
  var $signals: ((n: number) => { url: URL }) | undefined;
}

const doc = document;
const loc = location;
const stripHash = (href: string) => href.split("#", 1)[0];
const isLocationHref = (href: string) => stripHash(href) === stripHash(loc.href);

customElements.define(
  "m-router",
  class extends HTMLElement {
    #fallback?: ChildNode[];
    #onClick?: (e: MouseEvent) => void;
    #onPopstate?: (e: PopStateEvent) => void;
    #ac?: AbortController;
    #cache = new Map<string, string>();
    #isBlank = true;

    async #fetchPage(href: string) {
      // use cached page and refetch the page in the background
      if (this.#cache.has(href)) {
        this.#setContent(this.#cache.get(href)!);
      }
      const ac = new AbortController();
      const headers = {
        "x-route": "true",
        "x-flags": $FLAGS,
      };
      this.#ac?.abort();
      this.#ac = ac;
      const res = await fetch(href, { headers, signal: ac.signal });
      if (res.status === 404) {
        this.#setContent(this.#fallback ?? []);
        return 404;
      }
      if (!res.ok) {
        this.replaceChildren();
        throw new Error("Failed to fetch route: " + res.status + " " + res.statusText);
      }
      const [html, js] = await res.json();
      this.#cache.set(href, html);
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

    #updateNavLinks() {
      doc.querySelectorAll<HTMLAnchorElement>("nav a").forEach((link) => {
        const { href, classList } = link;
        const activeClass = link.closest("nav")?.getAttribute("data-active-class") ?? "active";
        if (isLocationHref(href)) {
          classList.add(activeClass);
        } else {
          classList.remove(activeClass);
        }
      });
    }

    async #navigate(href: string, options?: { replace?: boolean }) {
      const e404 = await this.#fetchPage(href) === 404;
      if (options?.replace) {
        history.replaceState({}, "", href);
      } else {
        history.pushState({}, "", href);
      }
      if (e404 && typeof $signals !== "undefined") {
        $signals(0).url = new URL(href);
      }
      this.#updateNavLinks();
      // scroll to the top of the page after navigation
      window.scrollTo(0, 0);
    }

    navigate(href: string, options?: { replace?: boolean }) {
      const url = new URL(href, loc.href);
      if (url.origin !== loc.origin) {
        loc.href = href;
        return;
      }
      if (!isLocationHref(url.href)) {
        this.#navigate(href, options);
      }
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

        // skip if the link is for downloading, external, or has a target of _blank
        if (
          download
          || rel === "external"
          || target === "_blank"
          || !href.startsWith(loc.origin)
        ) {
          return;
        }

        e.preventDefault();
        this.navigate(href);
      };

      this.#onPopstate = () => this.#navigate(loc.href);

      addEventListener("popstate", this.#onPopstate);
      doc.addEventListener("click", this.#onClick);
      setTimeout(() => this.#updateNavLinks());
    }

    disconnectedCallback() {
      removeEventListener("popstate", this.#onPopstate!);
      doc.removeEventListener("click", this.#onClick!);
      this.#ac?.abort();
      this.#ac = undefined;
      this.#cache.clear();
      this.#onClick = undefined;
      this.#onPopstate = undefined;
    }
  },
);
