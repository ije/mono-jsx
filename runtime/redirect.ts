declare global {
  var $router: { navigate: (url: string, options?: { replace?: boolean }) => void } | undefined;
}

customElements.define(
  "m-redirect",
  class extends HTMLElement {
    connectedCallback() {
      const to = this.getAttribute("to");
      const replace = this.hasAttribute("replace");
      if (to) {
        if ($router) {
          $router.navigate(to, { replace });
        } else {
          location.href = to;
        }
      }
    }
  },
);
