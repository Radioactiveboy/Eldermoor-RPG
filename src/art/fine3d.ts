import type Phaser from 'phaser';
import { darker, FRAME_W, HERO_SCALE } from './character';
import { Detail, personSpec } from './figure3d';

/**
 * Figures drawn finely, like the hero: their frames are HERO_SCALE times the
 * folk's in each direction and shown scaled down by as much, so they stand the
 * same size with twice the detail (a face with eye whites and brows, seams,
 * rivets, stitching). Any 3D figure can be drawn this way by generating it with
 * FINE_SPEC; the sprites that show it work out the scale from the texture (see
 * {@link sheetScale}), so nothing else needs to know.
 */
export const FINE_SPEC = personSpec(HERO_SCALE, { creases: true });

/**
 * How many times finer than the folk's a figure's sheet is drawn: 1 for most,
 * HERO_SCALE for the hero and anyone else drawn with FINE_SPEC. A sprite showing
 * the sheet is scaled by 1 / this to stand the right size.
 */
export function sheetScale(scene: Phaser.Scene, key: string): number {
  const frame = scene.textures.getFrame(key, 0);
  return frame ? Math.max(1, Math.round(frame.width / FRAME_W)) : 1;
}

/** How a finely drawn face is made up (see {@link fineFace}). */
export interface FaceLook {
  /** The pupils. */
  eye: number;
  /** The lower half of each eye, if not the pupil's colour: the iris catching the light. */
  iris?: number;
  /** The white at the inner corner of each eye. */
  white?: number;
  brow: number;
  /** How the brows slope: positive raises their outer ends (stern), negative their inner ends (eager, worried). */
  browSlant?: number;
  /** The brows' height over the eyes. */
  browLift?: number;
  mouth: number;
  /** Mouth width in marks (2 by default); 3 or more for a grin. */
  mouthWidth?: number;
  /** Turn the mouth's corners up a little. */
  smile?: boolean;
  /** A lash flicked out at the outer corner of each eye. */
  lashes?: number;
  /** A scatter of freckles over the nose and cheeks, in this colour. */
  freckles?: number;
  /** An old scar down the right cheek (screen-left, facing us), in this colour. */
  scar?: number;
  /** Eyes this far either side of the middle. */
  eyeX?: number;
}

/** The head's radii, for laying marks on its surface. */
export interface HeadShape {
  rx: number;
  ry: number;
  rz: number;
}

/**
 * Eyes, brows, a mouth and whatever else a face has, laid on the front of a
 * head centred at (0, hy, hz) as marks half a folk pixel across: one pixel each
 * on a finely drawn figure. This is the hero's face (see hero3d.ts) made
 * general, for anyone drawn with FINE_SPEC.
 */
export function fineFace(hy: number, hz: number, look: FaceLook, head: HeadShape = { rx: 5.3, ry: 5.7, rz: 5.1 }): Detail[] {
  const details: Detail[] = [];
  const onFace = (x: number, dy: number) => hz + head.rz * Math.sqrt(Math.max(0, 1 - (x / head.rx) ** 2 - (dy / head.ry) ** 2)) + 0.1;
  const mark = (x: number, dy: number, color: number) => details.push({ x, y: hy + dy, z: onFace(x, dy), color, size: 0.5 });
  const eyeX = look.eyeX ?? 1.9;
  const slant = look.browSlant ?? 0.3;
  const lift = look.browLift ?? 2;
  for (const side of [-1, 1]) {
    const ex = side * eyeX;
    mark(ex, 1.1, look.eye);
    mark(ex, 0.6, look.iris ?? look.eye);
    mark(ex - side * 0.5, 1.1, look.white ?? 0xf4ead8);
    if (look.lashes !== undefined) mark(ex + side * 0.5, 1.4, look.lashes);
    for (const dx of [-0.5, 0, 0.5]) mark(ex + dx * side, lift + dx * slant, look.brow);
  }
  const w = look.mouthWidth ?? 2;
  for (let i = 0; i < w; i++) {
    const x = (i - (w - 1) / 2) * 0.5;
    const corner = look.smile && (i === 0 || i === w - 1) ? 0.4 : 0;
    mark(x, -2.1 + corner, look.mouth);
  }
  if (look.freckles !== undefined) {
    for (const [x, dy] of [[-2.4, -0.4], [-1.6, -0.9], [-2.9, -1.1], [2.4, -0.4], [1.6, -0.9], [2.9, -1.1], [-0.5, 0.3], [0.5, 0.3]]) mark(x, dy, look.freckles);
  }
  if (look.scar !== undefined) {
    // From the brow, past the eye's outer corner, to the cheekbone.
    for (const [x, dy] of [[-3.1, 2.1], [-3.0, 1.6], [-2.9, 0.1], [-2.8, -0.4], [-2.6, -0.9], [-2.4, -1.4]]) mark(x, dy, look.scar);
  }
  return details;
}

/** A material's three tones a step darker: seams, hems and shadows in a fold. */
export function shade([base, dark]: [number, number, number]): [number, number, number] {
  return [dark, darker(dark), base];
}
