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

// ------------------------------------------------------------ the plot in Iran's yard

/** Half grown: smaller tops, nothing to pull yet. */
function youngPlant(c: PixelCanvas, kind: CropKind, x: number, y: number, rnd: () => number): void {
  mound(c, x, y, 4);
  if (kind === 'cabbage') {
    c.ellipse(x - 2.5, y - 2, 2.6, 2, CABBAGE_DARK, P.leafDeep, CABBAGE);
    c.ellipse(x + 2.5, y - 2, 2.6, 2, CABBAGE_DARK, P.leafDeep, CABBAGE);
    c.ellipse(x, y - 3, 2.8, 2.4, CABBAGE, CABBAGE_DARK, CABBAGE_LIGHT);
    return;
  }
  if (kind === 'turnip') {
    for (const s of [-1, 0, 1]) c.ellipse(x + s * 2, y - 3 - (s === 0 ? 1 : 0), 1.6, 2.6, P.leaf, P.leafDark, P.leafLight);
    return;
  }
  for (let s = -1; s <= 1; s++) {
    const h = 5 + Math.floor(rnd() * 2) - Math.abs(s);
    for (let i = 1; i <= h; i++) c.set(Math.round(x + s * (i / h) * 1.5), y - 1 - i, i > h - 2 ? P.leafGlow : P.leafLight);
  }
}

/** A row of little ridges where seed has just gone in: nothing showing yet. */
function seedDrill(c: PixelCanvas, x: number, y: number): void {
  c.ellipse(x, y + 1, 4, 1.8, SOIL_LIGHT, SOIL_DARK);
  c.set(x - 1, y, SOIL_DARK);
  c.set(x + 1, y + 1, SOIL_DARK);
}

/** A tile of the plot before it's dug: rough tussocks of long grass, docks and a few seed heads. */
function weeds(seed: number): PixelCanvas {
  const c = new PixelCanvas(CROP_W, CROP_H);
  const rnd = seededRandom(seed);
  const places = [[0.2, 0.22], [0.6, 0.18], [0.85, 0.45], [0.35, 0.5], [0.65, 0.68], [0.15, 0.8], [0.45, 0.88]]
    .map(([u, v]) => at(u + (rnd() - 0.5) * 0.1, v + (rnd() - 0.5) * 0.1))
    .sort((a, b) => a.y - b.y);
  places.forEach((p, i) => {
    if (i % 3 === 1) {
      // A dock: broad leaves splayed out, with a rusty seed spike.
      for (const s of [-1, 1]) c.ellipse(p.x + s * 3, p.y - 1.5, 3.2, 1.5, P.leaf, P.leafDark, P.leafLight);
      c.ellipse(p.x, p.y - 3, 1.5, 2.6, P.leafLight, P.leaf, P.leafGlow);
      for (let k = 4; k < 9; k++) c.set(p.x, p.y - k, k % 2 ? 0x9a5a32 : 0x7a4026);
      return;
    }
    // A tussock of long, pale grass, bending over at the tips.
    for (let s = -3; s <= 3; s++) {
      const h = 6 + Math.floor(rnd() * 5) - Math.abs(s);
      const lean = s * 0.35 + (rnd() - 0.5) * 0.6;
      for (let k = 0; k < h; k++) {
        const col = k > h - 2 ? P.sandLight : k > h - 4 ? P.grassTip : k > h / 3 ? P.grassLight : P.grassDark;
        c.set(Math.round(p.x + s * 0.6 + lean * (k / h) * (k / h) * 4), p.y - k, col);
      }
    }
  });
  return c;
}

/** The plot's textures: a crop half grown, freshly sown ground, and the weeds before it's dug. */
export function plotKey(what: 'weeds' | 'sown' | `young-${CropKind}`): string {
  return `plot-${what}`;
}

function generatePlot(scene: Phaser.Scene): void {
  (['carrot', 'cabbage', 'turnip'] as CropKind[]).forEach((kind, i) => {
    const c = new PixelCanvas(CROP_W, CROP_H);
    const rnd = seededRandom(17 + i);
    for (const p of spots(kind === 'cabbage' ? 3 : 4)) youngPlant(c, kind, p.x, p.y, rnd);
    c.outline();
    c.toTexture(scene, plotKey(`young-${kind}`));
  });
  const sown = new PixelCanvas(CROP_W, CROP_H);
  for (const p of spots(4)) seedDrill(sown, p.x, p.y);
  sown.toTexture(scene, plotKey('sown'));
  weeds(5).toTexture(scene, plotKey('weeds'));
}

/** Fence pieces connect to their neighbours: N = -y, S = +y, W = -x, E = +x. */
export const FENCE = { N: 1, S: 2, W: 4, E: 8 } as const;

/** Every shape of fence piece, by which sides it joins up on. */
export const FENCE_MASKS = Array.from({ length: 16 }, (_, i) => i);

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
  generatePlot(scene);
  for (let mask = 0; mask < 16; mask++) {
    const r = fence(mask).render();
    const key = fenceKey(mask);
    const tex = r.canvas.toTexture(scene, key);
    MODEL_ART[key] = { key, originX: r.anchorX / tex.width, originY: r.anchorY / tex.height };
  }
}
