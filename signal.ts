export interface Compute {
  readonly compute: (() => unknown) | string;
  readonly deps: Set<string>;
}

export class Signal {
  constructor(
    public readonly scope: number,
    public readonly key: string | Compute,
    public readonly value: unknown,
  ) {}
}

export const isSignal = (v: unknown): v is Signal => v instanceof Signal;
