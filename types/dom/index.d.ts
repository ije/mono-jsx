/// <reference types="../jsx.d.ts" />

export const Store: <T extends Record<string, unknown>>(initValue: T) => FC & T;
