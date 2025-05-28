/// <reference lib="dom.iterable" />

const portals = new Map<string, HTMLElement>();
const getChunkId = (el: HTMLElement) => el.getAttribute("chunk-id");
const defineCustomElement = (tagName: string, connectedCallback: (el: HTMLElement) => void) =>
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback() {
        connectedCallback(this);
      }
    },
  );

defineCustomElement("m-portal", (el) => {
  portals.set(getChunkId(el)!, el);
});

defineCustomElement("m-chunk", (el) => {
  // set a timeout to wait for the element to be fully parsed
  setTimeout(() => {
    const chunkNodes = (el.firstChild as HTMLTemplateElement | null)?.content.childNodes;
    const id = getChunkId(el)!;
    const portal = portals.get(id);
    if (portal) {
      if (el.hasAttribute("next")) {
        portal.before(...chunkNodes!);
      } else {
        portals.delete(id);
        if (el.hasAttribute("done")) {
          portal.remove();
        } else {
          portal.replaceWith(...chunkNodes!);
        }
      }
      el.remove();
    }
  });
});
