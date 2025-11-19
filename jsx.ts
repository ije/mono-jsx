import type { ComponentType } from "./types/jsx.d.ts";

export const customElements = new Map<string, ComponentType>();

export const JSX = {
  customElements: {
    define(tagName: string, fc: ComponentType) {
      customElements.set(tagName, fc);
    },
  },
};
