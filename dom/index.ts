import { createStore } from "./jsx-runtime.mjs";

export const atom = (initValue: unknown) => createStore({ value: initValue });
export const store = createStore;
