declare global {
  var $renderAttr: (el: Element, attrName: string, getter: () => unknown) => () => void;
  var $renderToggle: (el: Element, getter: () => unknown) => () => void;
  var $renderSwitch: (el: Element, getter: () => unknown) => () => void;
}

export const renderAttr = (el: Element, attrName: string, getter: () => unknown) => {
  let target: Element = el.parentElement!;
  if (target.tagName === "M-GROUP") {
    target = target.previousElementSibling!;
  }
  return () => {
    const value = getter();
    if (attrName === "value") {
      (target as HTMLInputElement).value = String(value);
    } else if (attrName === "checked") {
      (target as HTMLInputElement).checked = Boolean(value);
    } else if (typeof value === "boolean") {
      target.toggleAttribute(attrName, value);
    } else if (value === null || value === undefined) {
      target.removeAttribute(attrName);
    } else if (typeof value === "object") {
      if (attrName === "class") {
        target.setAttribute(attrName, $cx(value));
      } else if (attrName === "style") {
        $applyStyle(target, value);
      } else {
        target.setAttribute(attrName, JSON.stringify(value));
      }
    } else {
      target.setAttribute(attrName, String(value));
    }
  };
};

export const renderToggle = (el: Element, getter: () => unknown) => {
  let slots: Array<ChildNode> | undefined;
  let update = () => el.replaceChildren(...(getter() ? slots! : []));
  return () => {
    if (!slots) {
      const firstChild = el.firstElementChild;
      if (firstChild && firstChild.tagName === "TEMPLATE" && firstChild.hasAttribute("m-slot")) {
        slots = [...(firstChild as HTMLTemplateElement).content.childNodes];
      } else {
        slots = [...el.childNodes];
      }
    }
    if (el.hasAttribute("vt") && document.startViewTransition) {
      document.startViewTransition(update);
    } else {
      update();
    }
  };
};

export const renderSwitch = (el: Element, getter: () => unknown) => {
  let value: string;
  let toMatch = el.getAttribute("value");
  let slotsMap: Map<string, Array<ChildNode>> | undefined;
  let unnamedSlots: Array<ChildNode> | undefined;
  let getNamedSlots = (slotName: string) => slotsMap!.get(slotName) ?? slotsMap!.set(slotName, []).get(slotName)!;
  let update = () => el.replaceChildren(...(slotsMap!.has(value) ? slotsMap!.get(value)! : unnamedSlots!));
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
    if (el.hasAttribute("vt") && document.startViewTransition) {
      document.startViewTransition(update);
    } else {
      update();
    }
  };
};
