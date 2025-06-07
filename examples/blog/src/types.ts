export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const Ok = <T,>(value: T): Result<T> => ({ ok: true, value });
export const Err = <E,>(error: E): Result<never, E> => ({ ok: false, error });

export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface Post {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly authorId: string;
  readonly createdAt: Date;
}

export interface AppState {
  readonly currentUser: User | null;
  readonly theme: "light" | "dark";
}

export interface MonoJSXContext {
  app: AppState;
  effect: (fn: () => void) => void;
  computed: <T>(fn: () => T) => T;
  [key: string]: unknown;
}