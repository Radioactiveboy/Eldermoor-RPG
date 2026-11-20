import type { Rng } from '../../src/systems/Combat';

/** The rng value that makes Battle.d(sides) come up `face`. */
export function face(value: number, sides = 20): number {
  return (value - 0.5) / sides;
}

/**
 * A scripted Math.random: hands out the given values in order and fails the
 * test if the code asks for more dice than it scripted, so a test can't pass
 * by accident on leftover randomness.
 */
export function scripted(...values: number[]): Rng & { left: () => number } {
  let i = 0;
  const rng = (() => {
    if (i >= values.length) throw new Error(`scripted rng ran out after ${values.length} values`);
    return values[i++];
  }) as Rng & { left: () => number };
  rng.left = () => values.length - i;
  return rng;
}

/** A tiny in-memory localStorage, optionally one that refuses to store anything. */
export function fakeStorage(opts: { blocked?: boolean } = {}): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => (opts.blocked ? null : data.get(k) ?? null),
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => {
      if (opts.blocked) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      data.set(k, String(v));
    },
  };
}
