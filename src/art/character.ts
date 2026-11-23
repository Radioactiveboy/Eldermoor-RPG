/**
 * What every person's sprite sheet shares: the frame size, where the feet
 * stand, and the colour helpers the 3D figures are painted with. Everyone,
 * the hero included, is modelled in 3D (see figure3d.ts) and drawn in all
 * eight directions.
 */

export const FRAME_W = 32;
export const FRAME_H = 48;
/** Pixel row the feet stand on, for the sprite origin. */
export const FEET_Y = 45;

/**
 * The hero is drawn this many times more finely than the folk (frames
 * FRAME_W * HERO_SCALE by FRAME_H * HERO_SCALE), and shown scaled down by as
 * much, so he stands the same size with the detail of the trees and buildings.
 */
export const HERO_SCALE = 2;

/** Frames a second of the idle (breathing) animation: a breath every couple of seconds. */
export const IDLE_FRAME_RATE = 1.8;

/** A colour about a third darker, for shading hair. */
export function darker(color: number): number {
  const ch = (shift: number) => Math.round(((color >> shift) & 0xff) * 0.65) << shift;
  return ch(16) | ch(8) | ch(0);
}

/** Three tones of one colour: base, shade, light. */
export type Tones = [number, number, number];
