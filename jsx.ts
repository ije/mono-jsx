import type { FC } from "./types/jsx.d.ts";

export const customElements = new Map<string, FC>();

export const JSX = {
  customElements: {
    define(tagName: string, fc: FC) {
      customElements.set(tagName, fc);
    },
  },
};
