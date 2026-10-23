import Phaser from 'phaser';
import { TILE_HEIGHT, TILE_WIDTH } from '../config';
import type { CropKind } from '../systems/Farm';
import { MODEL_ART } from './interior';
import { IsoModel } from './IsoModel';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';

/**
 * The family's vegetable garden outside the cottage: tilled soil, rows of
 * crops (ripe, and freshly picked), and the split-rail fence around it.
 */

const SOIL_DARK = 0x3e2818;
const SOIL = 0x543621;
const SOIL_LIGHT = 0x6d4a2e;
const CARROT = 0xe0782a;
const CARROT_LIGHT = 0xf5a04a;
const CABBAGE_DARK = 0x3f6e3a;
const CABBAGE = 0x6c9e50;
const CABBAGE_LIGHT = 0xa6cc7c;
const TURNIP = 0xece2d6;
const TURNIP_TOP = 0x9a4a8c;

/** Crop sprites are a tile wide; the tile's centre sits at this pixel. */
export const CROP_W = TILE_WIDTH;
export const CROP_H = 64;
export const CROP_ORIGIN_Y = 48;

/** Tilled furrows running along the grid's x axis, to match the crop rows. */
export function soilTile(seed: number): PixelCanvas {
  const c = new PixelCanvas(TILE_WIDTH, TILE_HEIGHT);
  const rnd = seededRandom(seed * 23 + 1);
  const hw = TILE_WIDTH / 2;
  for (let y = 0; y < TILE_HEIGHT; y++) {
    const row = y < TILE_HEIGHT / 2 ? y : TILE_HEIGHT - 1 - y;
    const half = 2 * (row + 1);
    for (let x = hw - half; x < hw + half; x++) {
      const sx = (x + 0.5 - hw) / hw;
      const sy = (y + 0.5 - TILE_HEIGHT / 2) / (TILE_HEIGHT / 2);
      const v = (sy - sx) / 2 + 0.5;
      // Three ridges per tile: lit on top, shadowed in the furrow between.
      const f = (v * 3) % 1;
      let col = f < 0.25 ? SOIL_DARK : f < 0.5 ? SOIL : f < 0.75 ? SOIL_LIGHT : SOIL;
      if (rnd() < 0.06) col = rnd() < 0.5 ? SOIL_DARK : P.dirt;
      c.set(x, y, col);
    }
  }
  return c;
}

/** Where a point inside the tile (u, v in 0..1) lands on the crop canvas. */
function at(u: number, v: number): { x: number; y: number } {
  return { x: CROP_W / 2 + (u - v) * (TILE_WIDTH / 2), y: CROP_ORIGIN_Y + (u + v - 1) * (TILE_HEIGHT / 2) };
}

/** Plant spots inside a tile, back to front so nearer plants overlap further ones. */
function spots(n: 3 | 4): Array<{ x: number; y: number }> {
  const list = n === 4 ? [[0.28, 0.28], [0.72, 0.3], [0.3, 0.72], [0.72, 0.72]] : [[0.3, 0.3], [0.72, 0.45], [0.38, 0.75]];
  return list.map(([u, v]) => at(u, v)).sort((a, b) => a.y - b.y);
}

function mound(c: PixelCanvas, x: number, y: number, r = 5): void {
  c.ellipse(x, y + 1, r, r * 0.45, SOIL_LIGHT, SOIL_DARK);
}

function carrotPlant(c: PixelCanvas, x: number, y: number, rnd: () => number): void {
  mound(c, x, y);
  c.rect(x - 1, y - 1, 3, 2, CARROT);
  c.set(x - 1, y - 1, CARROT_LIGHT);
  // Feathery fronds fanning up and out.
  for (let s = -2; s <= 2; s++) {
    const h = 9 + Math.floor(rnd() * 4) - Math.abs(s);
    for (let i = 1; i <= h; i++) {
      const fx = Math.round(x + s * (i / h) * 2.5);
      const col = i > h - 2 ? P.leafGlow : s < 0 ? P.leafLight : P.leaf;
      c.set(fx, y - 1 - i, col);
      if (i > 3 && i % 3 === 0) c.set(fx + (s < 0 ? -1 : 1), y - 1 - i, P.leafLight);
    }
  }
}

function cabbagePlant(c: PixelCanvas, x: number, y: number): void {
  mound(c, x, y, 7);
  // Loose outer leaves, then the tight pale head.
  c.ellipse(x - 4, y - 3, 4, 3, CABBAGE_DARK, P.leafDeep, CABBAGE);
  c.ellipse(x + 4, y - 3, 4, 3, CABBAGE_DARK, P.leafDeep, CABBAGE);
  c.ellipse(x, y - 5, 5.5, 4.8, CABBAGE, CABBAGE_DARK, CABBAGE_LIGHT);
  c.ellipse(x - 0.5, y - 6, 3, 2.6, CABBAGE_LIGHT, CABBAGE);
  for (let i = 0; i < 4; i++) c.set(x + 1 + Math.round(i * 0.4), y - 8 + i * 2, CABBAGE_DARK);
}

function turnipPlant(c: PixelCanvas, x: number, y: number, rnd: () => number): void {
  mound(c, x, y);
  c.ellipse(x, y - 1, 3.5, 2.6, TURNIP, P.linenDark);
  c.ellipse(x, y - 2.5, 3, 1.2, TURNIP_TOP);
  // Broad leaves on short stems.
  for (const s of [-1, 0, 1]) {
    const h = 6 + Math.floor(rnd() * 3);
    const lx = x + s * 3;
    for (let i = 0; i < 3; i++) c.set(x + Math.round((s * 3 * i) / 3), y - 3 - i, P.leafDark);
    c.ellipse(lx, y - 3 - h / 2, 2.2, h / 2, P.leaf, P.leafDark, P.leafLight);
  }
}

function sprout(c: PixelCanvas, x: number, y: number): void {
  mound(c, x, y, 4);
  c.set(x, y - 1, P.leafDark);
  c.set(x - 1, y - 2, P.leafLight);
  c.set(x + 1, y - 2, P.leaf);
}

function crop(kind: CropKind, ripe: boolean, seed: number): PixelCanvas {
  const c = new PixelCanvas(CROP_W, CROP_H);
  const rnd = seededRandom(seed);
  const places = spots(kind === 'cabbage' ? 3 : 4);
  for (const p of places) {
    if (!ripe) sprout(c, p.x, p.y);
    else if (kind === 'carrot') carrotPlant(c, p.x, p.y, rnd);
    else if (kind === 'cabbage') cabbagePlant(c, p.x, p.y);
    else turnipPlant(c, p.x, p.y, rnd);
  }
  c.outline();
  return c;
}

export function cropKey(kind: CropKind, ripe: boolean): string {
  return `crop-${kind}-${ripe ? 'ripe' : 'picked'}`;
}

/** Fence pieces connect to their neighbours: N = -y, S = +y, W = -x, E = +x. */
export const FENCE = { N: 1, S: 2, W: 4, E: 8 } as const;

export function fenceKey(mask: number): string {
  return `fence-${mask}`;
}

function fence(mask: number): IsoModel {
  const m = new IsoModel();
  const rail = { top: P.plankLight, left: P.plank, right: P.plankDark };
  const post = { top: P.barkLight, left: P.bark, right: P.barkDark };
  const rails = (x: number, y: number, sx: number, sy: number) => {
    for (const z of [6, 13]) m.box(x, y, z, sx, sy, 3, rail);
  };
  // Back rails first, then the post, then the front ones, so they overlap properly.
  if (mask & FENCE.N) rails(0.46, 0, 0.08, 0.5);
  if (mask & FENCE.W) rails(0, 0.46, 0.5, 0.08);
  m.box(0.42, 0.42, 0, 0.16, 0.16, 20, post);
  if (mask & FENCE.S) rails(0.46, 0.5, 0.08, 0.5);
  if (mask & FENCE.E) rails(0.5, 0.46, 0.5, 0.08);
  return m;
}

export function generateFarm(scene: Phaser.Scene): void {
  (['carrot', 'cabbage', 'turnip'] as CropKind[]).forEach((kind, i) => {
    crop(kind, true, 7 + i).toTexture(scene, cropKey(kind, true));
    crop(kind, false, 7 + i).toTexture(scene, cropKey(kind, false));
  });
  for (let mask = 0; mask < 16; mask++) {
    const r = fence(mask).render();
    const key = fenceKey(mask);
    const tex = r.canvas.toTexture(scene, key);
    MODEL_ART[key] = { key, originX: r.anchorX / tex.width, originY: r.anchorY / tex.height };
  }
}
