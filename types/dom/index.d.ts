/// <reference types="../jsx.d.ts" />

export interface IAtom<T> {
  get: () => T;
  set: (value: T | ((prev: T) => T)) => void;
  map: (callback: (value: T extends (infer V)[] ? V : T, index: number) => JSX.Element) => JSX.Element[];
}

export const atom: <T>(initValue: T) => IAtom<T>;
export const store: <T extends Record<string, unknown>>(initValue: T) => T;
