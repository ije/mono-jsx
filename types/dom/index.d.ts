import { ChildPrimitiveType } from "../jsx.d.ts";

export interface Atom<T> {
  get(): T;
  set(value: T | ((prev: T) => T)): void;
  map(callback: (value: T extends (infer V)[] ? V : T, index: number) => ChildPrimitiveType): ChildPrimitiveType[];
  ref(): T;
  ref<V>(callback: (value: T) => V): V;
}

export const atom: <T>(initValue: T) => Atom<T>;
export const store: <T extends Record<string, unknown>>(initValue: T) => T;
