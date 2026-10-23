import Phaser from 'phaser';
import { TILE_HEIGHT, TILE_WIDTH } from '../config';
import { soilTile } from './farm';
import { floorTile } from './interior';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';

/** How many look-alike variants of each ground tile to generate (breaks up repetition). */
export const TILE_VARIANTS = 3;

/** Texture key for a terrain tile variant. Variant 0 keeps the original key. */
export function tileKey(base: string, variant: number): string {
  return variant === 0 ? base : `${base}-${variant}`;
}

type Painter = (c: PixelCanvas, x: number, y: number, u: number, v: number, rnd: () => number) => void;

/** Is pixel (x, y) inside the isometric diamond? Rows are sized so diamonds tile without gaps. */
function inDiamond(x: number, y: number): boolean {
  const hw = TILE_WIDTH / 2;
  const row = y < TILE_HEIGHT / 2 ? y : TILE_HEIGHT - 1 - y;
  const half = 2 * (row + 1);
  return x >= hw - half && x < hw + half;
}

/** Fill the diamond, handing each pixel its position in tile space (u, v in 0..1). */
function paintDiamond(seed: number, paint: Painter): PixelCanvas {
  const c = new PixelCanvas(TILE_WIDTH, TILE_HEIGHT);
  const rnd = seededRandom(seed);
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      if (!inDiamond(x, y)) continue;
      const sx = (x + 0.5 - TILE_WIDTH / 2) / (TILE_WIDTH / 2);
      const sy = (y + 0.5 - TILE_HEIGHT / 2) / (TILE_HEIGHT / 2);
      const u = (sx + sy) / 2 + 0.5;
      const v = (sy - sx) / 2 + 0.5;
      paint(c, x, y, u, v, rnd);
    }
  }
  return c;
}

/** Sprinkle little marks (blades, pebbles, ripples) that stay inside the diamond. */
function scatter(count: number, rnd: () => number, mark: (x: number, y: number) => void): void {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * TILE_WIDTH);
    const y = Math.floor(rnd() * TILE_HEIGHT);
    if (inDiamond(x, y) && inDiamond(x, y + 2) && inDiamond(x + 2, y)) mark(x, y);
  }
}

/** Soft patches that repeat exactly once per tile, so neighbouring tiles join seamlessly. */
function patch(u: number, v: number, phase: number): number {
  const t = Math.PI * 2;
  return Math.sin(t * u + phase) * Math.cos(t * v + phase * 1.7) + 0.5 * Math.sin(t * (u + v) * 2 + phase * 0.6);
}

function grass(seed: number): PixelCanvas {
  const c = paintDiamond(seed, (c, x, y, _u, _v, rnd) => {
    const r = rnd();
    let col: number = P.grass;
    if (r < 0.08) col = P.grassDark;
    else if (r < 0.14) col = P.grassLight;
    c.set(x, y, col);
  });
  const rnd = seededRandom(seed * 31 + 7);
  // A few darker clumps; random per variant so no pattern lines up across tiles.
  scatter(5, rnd, (x, y) => {
    for (let i = 0; i < 5; i++) c.set(x + (i % 3), y + Math.floor(i / 3), P.grassDark);
  });
  scatter(40, rnd, (x, y) => {
    c.set(x, y + 1, P.grassDark);
    c.set(x, y, rnd() < 0.5 ? P.grassTip : P.grassLight);
  });
  return c;
}

function dirt(seed: number): PixelCanvas {
  const c = paintDiamond(seed, (c, x, y, u, v, rnd) => {
    const p = patch(u, v, seed);
    const r = rnd();
    let col: number = p > 0.7 ? P.dirtLight : P.dirt;
    if (r < 0.1) col = P.dirtDark;
    else if (r < 0.15) col = P.dirtLight;
    c.set(x, y, col);
  });
  const rnd = seededRandom(seed * 17 + 3);
  scatter(6, rnd, (x, y) => {
    c.set(x, y, P.stoneLight);
    c.set(x + 1, y, P.stone);
    c.set(x, y + 1, P.dirtDark);
    c.set(x + 1, y + 1, P.dirtDark);
  });
  // Faint wheel ruts give roads a sense of direction.
  scatter(5, rnd, (x, y) => {
    c.set(x, y, P.dirtDark);
    c.set(x + 1, y, P.dirtDark);
  });
  return c;
}

function sand(seed: number): PixelCanvas {
  const c = paintDiamond(seed, (c, x, y, _u, _v, rnd) => {
    const r = rnd();
    let col: number = P.sand;
    if (r < 0.07) col = P.sandDark;
    else if (r < 0.15) col = P.sandLight;
    c.set(x, y, col);
  });
  const rnd = seededRandom(seed * 13 + 5);
  scatter(5, rnd, (x, y) => {
    for (let i = 0; i < 4; i++) c.set(x + i, y, P.sandLight);
    for (let i = 1; i < 5; i++) c.set(x + i, y + 1, P.sandDark);
  });
  return c;
}

/** Cobblestones laid along the isometric grid. Bricks line up across tile borders. */
function stone(seed: number): PixelCanvas {
  const rows = 3;
  const cols = 3;
  const shades = [P.stone, P.stoneLight, P.stoneDark, P.stone];
  return paintDiamond(seed, (c, x, y, u, v, rnd) => {
    const fv = v * rows;
    const row = Math.floor(fv);
    const fu = u * cols + (row % 2) * 0.5;
    const col = Math.floor(fu);
    const lu = fu - col;
    const lv = fv - row;
    if (lu < 0.1 || lv < 0.12) {
      c.set(x, y, rnd() < 0.03 + seed * 0.02 ? P.moss : P.mortar);
      return;
    }
    const id = ((((col % cols) + cols) % cols) * 7 + ((row % rows) * 3)) % shades.length;
    let colr: number = shades[id];
    if (lu > 0.85 || lv > 0.85) colr = P.stoneDark;
    else if ((lu < 0.22 || lv < 0.26) && colr !== P.stoneDark) colr = P.stoneLight;
    if (rnd() < 0.05) colr = P.stoneDark;
    c.set(x, y, colr);
  });
}

function water(seed: number): PixelCanvas {
  const c = paintDiamond(seed, (c, x, y, u, v, rnd) => {
    const p = patch(u, v, seed);
    let col: number = p < -0.4 ? P.waterDeep : P.water;
    if (rnd() < 0.05) col = P.waterDeep;
    c.set(x, y, col);
  });
  const rnd = seededRandom(seed * 19 + 11);
  scatter(9, rnd, (x, y) => {
    const len = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < len; i++) c.set(x + i, y, i === 1 ? P.foam : P.waterLight);
  });
  return c;
}

/** Gold diamond outline used for the hover cursor and click marker. */
function highlight(): PixelCanvas {
  const c = new PixelCanvas(TILE_WIDTH, TILE_HEIGHT);
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      if (!inDiamond(x, y)) continue;
      const edge = !inDiamond(x - 1, y) || !inDiamond(x + 1, y) || !inDiamond(x, y - 1) || !inDiamond(x, y + 1);
      const edge2 = !inDiamond(x - 2, y) || !inDiamond(x + 2, y);
      if (edge) c.set(x, y, P.goldLight);
      else if (edge2) c.set(x, y, P.gold, 200);
    }
  }
  return c;
}

export function generateTiles(scene: Phaser.Scene): void {
  const kinds: Array<[string, (seed: number) => PixelCanvas]> = [
    ['tile-grass', grass],
    ['tile-dirt', dirt],
    ['tile-stone', stone],
    ['tile-water', water],
    ['tile-sand', sand],
    ['tile-floor', (seed) => floorTile(seed, TILE_WIDTH, TILE_HEIGHT)],
    ['tile-soil', soilTile],
  ];
  for (const [key, make] of kinds) {
    for (let v = 0; v < TILE_VARIANTS; v++) make(v + 1).toTexture(scene, tileKey(key, v));
  }
  highlight().toTexture(scene, 'tile-highlight');
}
