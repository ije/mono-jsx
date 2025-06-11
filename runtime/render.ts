declare global {
  var $renderAttr: (el: Element, attrName: string, getter: () => unknown) => () => void;
  var $renderToggle: (el: Element, getter: () => unknown) => () => void;
  var $renderSwitch: (el: Element, getter: () => unknown) => () => void;
  var $renderList: (signals: Signals, el: Element, getter: () => unknown) => () => void;
}

const cloneAll = (nodes: ChildNode[]) => nodes.map(node => node.cloneNode(true) as ChildNode);
const removeAll = (nodes: ChildNode[]) => nodes.forEach(node => node.remove());
const setAttr = (el: Element, attrName: string, value: string) => el.setAttribute(attrName, value);

export const renderAttr = (el: Element, attrName: string, getter: () => unknown) => {
  let target: Element = el.parentElement!;
  if (target.tagName === "M-GROUP") {
    target = target.previousElementSibling!;
  }
  return () => {
    const value = getter();
    if (value === false || value === null || value === undefined) {
      target.removeAttribute(attrName);
    } else if (
      typeof value === "object" && value !== null && (attrName === "class" || attrName === "style" || attrName === "props")
    ) {
      if (attrName === "class") {
        setAttr(target, attrName, $cx(value));
      } else if (attrName === "style") {
        $applyStyle(target, value);
      } else {
        setAttr(target, attrName, JSON.stringify(value));
      }
    } else {
      setAttr(target, attrName, value === true ? "" : value as string);
    }
  };
};

export const renderToggle = (el: Element, getter: () => unknown) => {
  let slots: Array<ChildNode> | undefined;
  return () => {
    if (!slots) {
      const firstChild = el.firstElementChild;
      if (firstChild && firstChild.tagName === "TEMPLATE" && firstChild.hasAttribute("m-slot")) {
        slots = [...(firstChild as HTMLTemplateElement).content.childNodes];
      } else {
        slots = [...el.childNodes];
      }
    }
    el.replaceChildren(...(getter() ? slots : []));
  };
};

export const renderSwitch = (el: Element, getter: () => unknown) => {
  let value: string;
  let toMatch = el.getAttribute("value");
  let slotsMap: Map<string, Array<ChildNode>> | undefined;
  let unnamedSlots: Array<ChildNode> | undefined;
  let getNamedSlots = (slotName: string) => slotsMap!.get(slotName) ?? slotsMap!.set(slotName, []).get(slotName)!;
  return () => {
    if (!slotsMap) {
      slotsMap = new Map();
      unnamedSlots = [];
      for (const slot of el.childNodes) {
        if (slot.nodeType === 1 && (slot as HTMLElement).tagName === "TEMPLATE" && (slot as HTMLElement).hasAttribute("m-slot")) {
          for (const node of (slot as HTMLTemplateElement).content.childNodes) {
            if (node.nodeType === 1 && (node as HTMLElement).hasAttribute("slot")) {
              getNamedSlots((node as HTMLElement).getAttribute("slot")!).push(node);
            } else {
              unnamedSlots.push(node);
            }
          }
          slot.remove();
        } else {
          if (toMatch) {
            getNamedSlots(toMatch).push(slot);
          } else {
            unnamedSlots.push(slot);
          }
        }
      }
    }
    value = "" + getter();
    el.replaceChildren(...(slotsMap.has(value) ? slotsMap.get(value)! : unnamedSlots!));
  };
};

export const renderList = (signals: Signals, el: Element, getter: () => unknown) => {
  let cache: ChildNode[][] = [];
  let view: ChildNode[][] | null = null;
  let template: ChildNode[] | null = null;
  return () => {
    if (view === null) {
      view = [];
      let cur = el.nextSibling;
      if (cur && cur.nodeType === 8 && (cur as Comment).textContent === "[") {
        let nodes: ChildNode[] = [];
        let comments: Comment[] = [cur as Comment];
        while ((cur = cur.nextSibling)) {
          if (cur.nodeType === 8) {
            const { data } = cur as Comment;
            if (data === "," || data === "]") {
              comments.push(cur as Comment);
              view.push(nodes);
              nodes = [];
              if (data === "]") {
                break;
              }
            }
          } else {
            nodes.push(cur);
          }
        }
        removeAll(comments);
      }
      cache = [...view];
      const { firstElementChild } = el;
      if (firstElementChild && firstElementChild.tagName === "TEMPLATE" && firstElementChild.hasAttribute("m-slot")) {
        template = [...(firstElementChild as HTMLTemplateElement).content.childNodes];
        firstElementChild.remove();
      }
    }
    // flush
    view.forEach(removeAll);
    const items = getter();
    if (Array.isArray(items)) {
      view = new Array(items.length).fill(null);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let nodes = cache[i];
        if (!nodes) {
          nodes = cloneAll(template ?? cache[0] ?? []);
          cache[i] = nodes;
        }
        signals.$forIter(i, item);
        nodes.forEach(node => {
          if (node.nodeType === 1) {
            (node as Element).querySelectorAll("m-index").forEach(indexEl => {
              if (indexEl.textContent !== "" + i) {
                indexEl.textContent = "" + i;
              }
            });
            (node as Element).querySelectorAll("m-item").forEach(itemEl => {
              const at = itemEl.getAttribute(":");
              if (at?.startsWith(".")) {
                let value = item;
                for (const key of at.slice(1).split(".")) {
                  value = value[key];
                }
                if (itemEl.textContent !== "" + value) {
                  itemEl.textContent = "" + value;
                }
              }
            });
          }
        });
        view[i] = nodes;
        el.before(...nodes);
      }
      signals.$forIter();
    }
  };
};
