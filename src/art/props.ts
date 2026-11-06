import Phaser from 'phaser';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';
import { boulder, grassTuft, pebbleScatter, toadstools, treeShade, wildFlowers } from './ground';
import { oakTree, pineTree } from './trees';

/**
 * Standing props (trees, rocks) and flat ground decorations (flowers, tufts).
 * Each standing prop records where its base sits so IsoMap can plant it on a tile.
 */
export interface PropArt {
  key: string;
  /** Sprite origin (0..1) that puts the base of the trunk/rock on the tile centre. */
  originY: number;
}

export const TREE_ART: PropArt[] = [];
export const ROCK_ART: PropArt[] = [];
/** Apple trees, for orchards (see MapData.orchards). */
export const APPLE_ART: PropArt[] = [];
/** Small flat details baked into the ground layer (repeated by how common each is). */
export const DECOR_KEYS: string[] = [];

function register(list: PropArt[], scene: Phaser.Scene, key: string, c: PixelCanvas, baseRow: number): void {
  c.toTexture(scene, key);
  list.push({ key, originY: (baseRow + 0.5) / c.height });
}

/** How many steps of lean each tree has for swaying in the wind (see world/Ambience.ts). */
export const SWAY_STEPS = 2;

/** The texture for a tree leaning `step` pixels downwind (negative for a tree drawn mirrored). */
export function swayKey(key: string, step: number): string {
  return step === 0 ? key : `${key}~sway${step}`;
}

/**
 * A tree leant over in the wind: the crown moves sideways as one, a whole
 * pixel at a time so it stays crisp, and the trunk bends over a few rows
 * below it to follow, staying put where it leaves the ground.
 */
function leaning(c: PixelCanvas, by: number, still: number): PixelCanvas {
  const out = new PixelCanvas(c.width, c.height);
  const BEND = 7;
  for (let y = 0; y < c.height; y++) {
    const t = Math.max(0, Math.min(1, (still - y) / BEND));
    const dx = Math.round(by * t);
    for (let x = 0; x < c.width; x++) {
      const col = c.get(x, y);
      if (col !== null) out.set(x + dx, y, col);
    }
  }
  return out;
}

/** `still`: the row of the trunk below which the tree doesn't move. */
function registerTree(scene: Phaser.Scene, key: string, c: PixelCanvas, baseRow: number, still: number, list = TREE_ART): void {
  register(list, scene, key, c, baseRow);
  for (let step = 1; step <= SWAY_STEPS; step++) {
    leaning(c, step, still).toTexture(scene, swayKey(key, step));
    leaning(c, -step, still).toTexture(scene, swayKey(key, -step));
  }
}

/** Soft oval shadows for characters and trees. */
function shadow(w: number, h: number): PixelCanvas {
  const c = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2);
      const ny = (y + 0.5 - h / 2) / (h / 2);
      const d = nx * nx + ny * ny;
      // Darkest right under the feet, where the light can't reach, fading out at the rim.
      if (d <= 1) c.set(x, y, 0x0b0812, d < 0.25 ? 140 : d < 0.6 ? 105 : 60);
    }
  }
  return c;
}

export function generateProps(scene: Phaser.Scene): void {
  TREE_ART.length = 0;
  ROCK_ART.length = 0;
  APPLE_ART.length = 0;
  DECOR_KEYS.length = 0;

  // 'prop-tree' / 'prop-rock' stay as the first variants so old code still finds them.
  // Three broadleaves and three pines (and a birch), so the woods stay about half and half.
  registerTree(scene, 'prop-tree', oakTree(11, 0, 0), 86, 74);
  registerTree(scene, 'prop-tree-1', oakTree(23, 1, 1), 86, 74);
  registerTree(scene, 'prop-tree-2', oakTree(37, 2, 2), 86, 74);
  registerTree(scene, 'prop-pine', pineTree(5, 0), 91, 90);
  registerTree(scene, 'prop-pine-1', pineTree(9, 1), 91, 90);
  registerTree(scene, 'prop-pine-2', pineTree(14, 0), 91, 90);
  // Birches, here and there among the others.
  registerTree(scene, 'prop-birch', oakTree(41, 1, 0, 'birch'), 86, 76);
  registerTree(scene, 'prop-apple', oakTree(53, 0, 0, 'apple'), 86, 74, APPLE_ART);
  registerTree(scene, 'prop-apple-1', oakTree(61, 2, 0, 'apple'), 86, 74, APPLE_ART);
  register(ROCK_ART, scene, 'prop-rock', boulder(2), 30);
  register(ROCK_ART, scene, 'prop-rock-1', boulder(3), 30);

  // [key, art, weight]: higher weight shows up more often.
  const decor: Array<[string, PixelCanvas, number]> = [
    ['decor-tuft', grassTuft(4), 4],
    ['decor-tuft-1', grassTuft(12), 4],
    ['decor-flowers-red', wildFlowers(3, P.flowerRed, 0x9a2e36, P.flowerYellow), 2],
    ['decor-flowers-yellow', wildFlowers(5, P.flowerYellow, 0xc8a030, 0xa86a20), 2],
    ['decor-flowers-blue', wildFlowers(8, P.flowerBlue, 0x4c66b0, P.flowerWhite), 2],
    ['decor-pebbles', pebbleScatter(6), 2],
    ['decor-mushrooms', toadstools(), 1],
  ];
  for (const [key, art, weight] of decor) {
    art.toTexture(scene, key);
    for (let i = 0; i < weight; i++) DECOR_KEYS.push(key);
  }

  shadow(28, 10).toTexture(scene, 'shadow');
  // Trees throw a leafy, dappled pool of shade rather than a plain oval.
  treeShade(60, 22, 5).toTexture(scene, 'shadow-large');
}
