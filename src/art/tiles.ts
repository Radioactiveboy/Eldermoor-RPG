import Phaser from 'phaser';
import { TILE_HEIGHT, TILE_WIDTH } from '../config';
import { caveFloorTile } from './cave';
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

/** The ground variants that blend into each other, kept so their edges can be painted from them (see blendTileKey). */
const groundArt: Record<BlendGround, PixelCanvas[]> = { grass: [], dirt: [], sand: [], water: [] };

/** Ground that blends softly into its neighbours: dirt or sand over grass, and water over sand. */
export type BlendGround = 'grass' | 'dirt' | 'sand' | 'water';

/** How many wobbly shapes an edge can take along one side of a tile. */
export const EDGE_VARIANTS = 4;

/** Edge wobbles, each a few soft waves that come back to nothing at both ends of the side. */
const EDGE_WAVES: number[][] = (() => {
  const rnd = seededRandom(4242);
  return Array.from({ length: EDGE_VARIANTS }, () => [1, 2, 3].map((k) => (rnd() - 0.5) * (0.34 / k)));
})();

function edgeWave(variant: number, t: number): number {
  if (variant === 0) return 0;
  return EDGE_WAVES[variant - 1].reduce((sum, amp, i) => sum + amp * Math.sin((i + 1) * Math.PI * t), 0);
}

/**
 * One boundary across a tile: which of the 3x3 tiles around it lie on the
 * upper side (`mask`, bit (dy + 1) * 3 + dx + 1) and how the line wobbles
 * along each side (`edges`: left, right, top, bottom, each 0 for none or
 * 1..EDGE_VARIANTS).
 */
export interface BlendLayer {
  mask: number;
  edges: number[];
}

/**
 * How far a point (u, v) of the tile lies on the upper side of a boundary:
 * positive above it, negative below. The mask sets a smooth field that rounds
 * off corners; the wobbles bend the line along each side. A side's wobble is
 * picked for that side of the map, so both tiles that share it bend the same
 * way and the edge carries on unbroken.
 */
function blendField(layer: BlendLayer, u: number, v: number): number {
  const at = (dx: number, dy: number) => (layer.mask >> ((dy + 1) * 3 + dx + 1)) & 1;
  const [left, right, top, bottom] = layer.edges;
  // Bilinear between the centres of this tile and the three nearest neighbours.
  const sx = u < 0.5 ? -1 : 1;
  const sy = v < 0.5 ? -1 : 1;
  const a = Math.abs(u - 0.5);
  const b = Math.abs(v - 0.5);
  const field = (1 - a) * (1 - b) * at(0, 0) + a * (1 - b) * at(sx, 0) + (1 - a) * b * at(0, sy) + a * b * at(sx, sy);
  // Each side's wobble fades out towards the middle of the tile, smoothly so corners don't kink.
  const fade = (t: number) => Math.max(0, 1 - 2 * t) ** 2;
  const wobble =
    fade(u) * edgeWave(left, v) + fade(1 - u) * edgeWave(right, v) + fade(v) * edgeWave(top, u) + fade(1 - v) * edgeWave(bottom, u);
  return field + wobble - 0.5;
}

/**
 * A ground tile where grass, a road (or a sandy shore) and water meet, so their
 * edges are soft and wandering instead of the tiles' straight sides and square
 * corners. `ground` is the bare earth or sand lying over the grass along the
 * `shore` boundary; water lies over that along `wet`, if given, and then the
 * foam along the water's edge is made as its own texture (the key plus
 * '-foam') so it can lap back and forth. Made the first time it's needed and kept.
 */
export function blendTileKey(scene: Phaser.Scene, ground: 'dirt' | 'sand', shore: BlendLayer, wet: BlendLayer | undefined, variant: number): string {
  const layerKey = (l?: BlendLayer) => (l ? `${l.mask}-${l.edges.join('')}` : 'x');
  const key = `tile-blend-${ground}-${layerKey(shore)}-${layerKey(wet)}-${variant}`;
  if (scene.textures.exists(key)) return key;
  const rnd = seededRandom(shore.mask * 97 + (wet?.mask ?? 0) * 31 + variant * 13 + 1);
  const grassSrc = groundArt.grass[variant];
  const groundSrc = groundArt[ground][variant];
  const waterSrc = groundArt.water[variant];
  const rim = ground === 'dirt' ? P.dirtDark : P.sandDark;
  const foam = wet ? new PixelCanvas(TILE_WIDTH, TILE_HEIGHT) : undefined;
  const c = paintDiamond(variant + 1, (c, x, y, u, v) => {
    const r = rnd();
    const w = wet ? blendField(wet, u, v) : -1;
    if (w > 0) {
      // Water, a little lighter in the shallows (the foam lapping there is its own texture, below).
      c.set(x, y, w < 0.05 && r < 0.25 ? P.waterLight : waterSrc.get(x, y) ?? P.water);
      if (foam && w < 0.08) foam.set(x, y, r < 0.2 ? P.waterLight : P.foam, 220);
      else if (foam && w < 0.16 && r < 0.35) foam.set(x, y, P.foam, 140);
      return;
    }
    const d = blendField(shore, u, v);
    if (d > 0) {
      // Bare earth or sand, darker where it's trodden down or wet along the edge.
      const edge = (d < 0.06 && r < 0.45) || (w > -0.07 && r < 0.6);
      c.set(x, y, edge ? rim : groundSrc.get(x, y) ?? P.dirt);
    } else {
      // Grass, in ragged tufts where it overhangs the edge.
      c.set(x, y, d > -0.05 && r < 0.35 ? (r < 0.15 ? P.grassTip : P.grassDark) : grassSrc.get(x, y) ?? P.grass);
    }
  });
  c.toTexture(scene, key);
  foam?.toTexture(scene, `${key}-foam`);
  return key;
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
    ['tile-cave', caveFloorTile],
  ];
  for (const [key, make] of kinds) {
    for (let v = 0; v < TILE_VARIANTS; v++) {
      const art = make(v + 1);
      art.toTexture(scene, tileKey(key, v));
      const blend = key.slice('tile-'.length);
      if (blend in groundArt) groundArt[blend as BlendGround][v] = art;
    }
  }
  highlight().toTexture(scene, 'tile-highlight');
}
