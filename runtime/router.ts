declare global {
  var $FLAGS: string;
  var $signals: ((n: number) => { url: URL }) | undefined;
  var $router: { navigate: (url: string, options?: { replace?: boolean }) => void } | undefined;
}

const win = window;
const doc = document;
const loc = location;
const isActivated = (url: URL) => url.origin === loc.origin && getRouteKey(url) === getRouteKey(loc);
const getRouteKey = ({ pathname, search }: URL | Location) => pathname + search;

customElements.define(
  "m-router",
  class extends HTMLElement {
    #ac?: AbortController;
    #cache = new Map<string, string | Node[]>();
    #currentRoute = getRouteKey(loc);
    #fallback?: ChildNode[];
    #viewTransition = true;

    #onClick?: (e: MouseEvent) => void;
    #onPopstate?: (e: PopStateEvent) => void;

    async #fetchPage(url: URL) {
      this.#ac?.abort();
      this.#ac = new AbortController();
      const res = await fetch(url, {
        headers: { "x-route": "true", "x-flags": $FLAGS },
        signal: this.#ac.signal,
      });
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        this.replaceChildren();
        throw new Error("Failed to fetch route: " + res.status + " " + res.statusText);
      }
      const ret = await res.json();
      if (!Array.isArray(ret)) {
        throw new Error(ret?.error ? ret.error : "Invalid response from server");
      }
      return ret as [string, string | undefined, boolean | undefined];
    }

    #setContent(body: string | Node[]) {
      const update = () => typeof body === "string" ? this.innerHTML = body : this.replaceChildren(...body);
      if (this.hasAttribute("vt") && doc.startViewTransition && !this.#viewTransition) {
        doc.startViewTransition(update);
      } else {
        update();
      }
      this.#viewTransition = false;
    }

    #updateNavLinks() {
      doc.querySelectorAll<HTMLAnchorElement>("nav a").forEach((link) => {
        const { href, classList } = link;
        const activeClassname = link.closest("nav")?.getAttribute("data-active-class") ?? "active";
        if (isActivated(new URL(href))) {
          classList.add(activeClassname);
        } else {
          classList.remove(activeClassname);
        }
      });
    }

    async #load(url: URL, options?: { replace?: boolean; refresh?: boolean }) {
      this.#currentRoute = getRouteKey(url);
      let JS: string | undefined;
      let cachedContent = this.#cache.get(this.#currentRoute);
      if (cachedContent !== undefined && !options?.refresh && !this.hasAttribute("no-cache")) {
        this.#setContent(cachedContent);
      } else {
        const ret = await this.#fetchPage(url);
        if (typeof $signals !== "undefined") {
          // update app.url signal
          $signals(0).url = url;
        }
        let content: string | Node[];
        let noCache: boolean | undefined;
        if (ret) {
          [content, JS, noCache] = ret;
        } else {
          content = this.#fallback ?? [];
        }
        if (!noCache) {
          this.#cache.set(this.#currentRoute, content);
        }
        this.#setContent(content);
      }
      history[options?.replace ? "replaceState" : "pushState"]({}, "", url);
      this.#updateNavLinks();
      // scroll to the top of the page after navigation
      window.scrollTo(0, 0);
      if (JS) {
        doc.body.appendChild(doc.createElement("script")).textContent = JS;
      }
    }

    navigate(href: string, options?: { replace?: boolean; refresh?: boolean }) {
      const url = new URL(href, loc.href);
      if (url.origin !== loc.origin || href.startsWith("#")) {
        loc.href = href;
        return;
      }
      if (!isActivated(url)) {
        this.#load(url, options);
      }
    }

    connectedCallback() {
      if (win.$router) {
        throw new Error("Only one <m-router> element is allowed on the page");
      }
      win.$router = this;

      // set a timeout to wait for the element to be fully parsed
      setTimeout(() => {
        if (!this.#fallback) {
          if (this.hasAttribute("fallback")) {
            this.removeAttribute("fallback");
            this.#fallback = [...this.childNodes];
          } else {
            this.#fallback = [];
            for (const child of this.childNodes) {
              if (child.nodeType === 1 && (child as Element).tagName === "TEMPLATE" && (child as Element).hasAttribute("m-fallback")) {
                this.#fallback.push(...(child as HTMLTemplateElement).content.childNodes);
                child.remove();
                break;
              }
            }
          }
        }
        this.#cache.set(loc.href, [...this.childNodes]);
      });

      this.#onClick = (e: MouseEvent) => {
        // skip if the event is already prevented or if any modifier keys are pressed
        // or if the link is not a regular link
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !(e.target instanceof HTMLAnchorElement)) {
          return;
        }

        const hrefAttr = (e.target as HTMLAnchorElement).getAttribute("href");
        if (!hrefAttr || hrefAttr.startsWith("#")) {
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

      this.#onPopstate = () => {
        if (getRouteKey(loc) !== this.#currentRoute) {
          this.#load(new URL(loc.href));
        }
      };

      win.addEventListener("popstate", this.#onPopstate);
      doc.addEventListener("click", this.#onClick);
      setTimeout(() => this.#updateNavLinks());
    }

    disconnectedCallback() {
      win.removeEventListener("popstate", this.#onPopstate!);
      doc.removeEventListener("click", this.#onClick!);
      delete win.$router;
      this.#ac?.abort();
      this.#ac = undefined;
      this.#cache.clear();
      this.#onClick = undefined;
      this.#onPopstate = undefined;
    }
  },
);
