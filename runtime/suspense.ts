/// <reference lib="dom.iterable" />

const portals = new Map<string, HTMLElement>();
const getChunkId = (el: HTMLElement) => el.getAttribute("chunk-id");
const defineElement = (tagName: string, connectedCallback: (el: HTMLElement) => void) =>
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback() {
        connectedCallback(this);
      }
    },
  );

defineElement("m-portal", (el) => {
  portals.set(getChunkId(el)!, el);
});

defineElement("m-chunk", (el) => {
  // set a timeout to wait for the element to be fully parsed
  setTimeout(() => {
    const id = getChunkId(el)!;
    const portal = portals.get(id);
    const chunkNodes = (el.firstChild as HTMLTemplateElement | null)?.content.childNodes;
    if (portal) {
      if (el.hasAttribute("next")) {
        if (chunkNodes) {
          portal.before(...chunkNodes);
        }
      } else {
        if (el.hasAttribute("done")) {
          portal.remove();
        } else if (chunkNodes) {
          portal.replaceWith(...chunkNodes);
        }
        portals.delete(id);
      }
      el.remove();
    }
  });
});
