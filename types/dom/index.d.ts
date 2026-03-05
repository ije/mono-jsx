/// <reference types="../jsx.d.ts" />

export interface IAtom<T> {
  value: T;
}

export const atom: <T>(initValue: T) => IAtom<T>;
export const store: <T extends Record<string, unknown>>(initValue: T) => T;
