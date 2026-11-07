import type { Shader } from './IsoModel';
import { PALETTE as P } from './palette';

/**
 * Fire damage, for anything the goblins burned: wraps a surface's shader (or a
 * finished texture's pixels) so it comes out charred in patches, sooty all
 * over, glowing with the odd ember, and burnt right through where the fire was
 * fiercest. The patches come from smooth value noise, so they read as
 * scorch marks rather than speckle, and the same seed always burns the same way.
 */

export interface ScorchOptions {
  /** 0..1: how badly burnt overall. */
  amount: number;
  /** 0..1: how readily it's burnt through to nothing (null), where it's worst. 0 never. */
  holes?: number;
  /** How much worse it gets towards the top (v = 0): flames climb. */
  climb?: number;
  /** Size of the scorch patches: higher is finer. */
  grain?: number;
  /** Embers still glowing in the char. */
  embers?: boolean;
}

const CHAR = 0x161214;
const SOOT = P.soot;

/** `a` blended towards `b` by `t` (0..1). */
export function mixColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t) << shift;
  return ch(16) | ch(8) | ch(0);
}

function hash2(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth noise, 0..1, two octaves. */
export function smoothNoise(x: number, y: number, seed: number): number {
  const octave = (fx: number, fy: number, sd: number) => {
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = hash2(x0, y0, sd);
    const b = hash2(x0 + 1, y0, sd);
    const c = hash2(x0, y0 + 1, sd);
    const d = hash2(x0 + 1, y0 + 1, sd);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  return octave(x, y, seed) * 0.68 + octave(x * 2.7, y * 2.7, seed + 9) * 0.32;
}

/**
 * The colour of a point at (x, y) (in any units) that was `c`, after burning;
 * null where it's burnt through. `rise` 0..1 is how high up it is.
 */
export function burnt(c: number, x: number, y: number, seed: number, o: ScorchOptions, rise = 0): number | null {
  const grain = o.grain ?? 1;
  const n = smoothNoise(x * grain, y * grain, seed);
  const heat = Math.min(1.2, o.amount + rise * (o.climb ?? 0));
  if (o.holes && n < heat * o.holes * 0.6 - 0.05) return null;
  if (n < heat * 0.42) return hash2(Math.floor(x * 3), Math.floor(y * 3), seed) < 0.3 ? SOOT : CHAR;
  if (n < heat * 0.62) {
    if (o.embers && hash2(Math.floor(x * 4), Math.floor(y * 4), seed + 3) < 0.05 * heat) return P.ember;
    return mixColor(c, SOOT, 0.72);
  }
  return mixColor(c, 0x2a2224, Math.min(0.55, heat * 0.4));
}

/** A shader, burnt. Its surface is treated as `size` units across (u) and down (v), for the size of the patches. */
export function scorch(shade: Shader, seed: number, o: ScorchOptions, size: [number, number] = [6, 6]): Shader {
  return (u, v) => {
    const c = shade(u, v);
    if (c === null) return null;
    return burnt(c, u * size[0], v * size[1], seed, o, 1 - v);
  };
}

/**
 * Burns a finished picture in place: the pixels of an RGBA image, scorched in
 * patches (the top of the picture worse, if it `climb`s). `scale` is how many
 * pixels make one unit of noise.
 */
export function scorchPixels(img: ImageData, seed: number, o: ScorchOptions, scale = 10): void {
  const { width, height, data } = img;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] === 0) continue;
      const c = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      const out = burnt(c, x / scale, y / scale, seed, o, 1 - y / height);
      if (out === null) {
        data[i + 3] = 0;
        continue;
      }
      data[i] = (out >> 16) & 0xff;
      data[i + 1] = (out >> 8) & 0xff;
      data[i + 2] = out & 0xff;
    }
  }
}
