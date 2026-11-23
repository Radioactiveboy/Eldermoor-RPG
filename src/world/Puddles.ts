/**
 * Where the puddles lie (see world/Ambience.ts): a few tiles of each stretch
 * of path and bare earth, chosen the same way every visit, each with one of
 * the puddle drawings and a little nudge so they don't sit in a grid.
 *
 * Kept apart from Phaser so the tests can check every map's puddles.
 */

/** How many puddle drawings there are (`puddle-0` and so on, in art/weather.ts). */
export const PUDDLE_KINDS = 3;

export interface PuddleSpot {
  /** Where it lies, in tiles. */
  x: number;
  y: number;
  /** Which drawing: 0 to PUDDLE_KINDS - 1. */
  kind: number;
  flip: boolean;
}

/**
 * The puddle on tile (tx, ty), if that tile gets one. The hash is unsigned,
 * and is shifted with >>> to keep it so: a plain >> makes it negative for
 * half the tiles, which asked for drawings that don't exist ("puddle--1")
 * and put Phaser's green missing-texture box on the ground when it rained.
 */
export function puddleAt(tx: number, ty: number): PuddleSpot | undefined {
  const h = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
  if (h % 7 !== 0) return undefined;
  return {
    x: tx + 0.5 + ((h >>> 4) % 5) / 10 - 0.2,
    y: ty + 0.5 + ((h >>> 8) % 5) / 10 - 0.2,
    kind: (h >>> 12) % PUDDLE_KINDS,
    flip: ((h >>> 14) & 1) === 1,
  };
}
