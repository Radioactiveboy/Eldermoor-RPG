import Phaser from 'phaser';
import { TILE_HEIGHT, TILE_WIDTH } from '../config';
import { IsoModel, project, Shader } from './IsoModel';
import { MODEL_ART } from './interior';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';

/**
 * The wolves' cave in the hill north of the cottage: its mouth in the
 * hillside, and inside, the rock walls with stalactites hanging from them,
 * stalagmites and columns, boulders, a gravelly floor, old bones, and what is
 * left of Wil's two ewes.
 *
 * Everything is registered in MODEL_ART (anchored at its back grid corner,
 * like the furniture) so maps can place it as objects.
 */

/** Cave rock, from the darkest crevice to wet highlights. Cool purple-greys, a shade apart from the outdoor stone. */
const ROCK = {
  deep: 0x17141c,
  darker: 0x221e29,
  dark: 0x2e2936,
  base: 0x3f3947,
  mid: 0x534b5c,
  light: 0x6b6375,
  wet: 0x8d88a0,
  moss: 0x3c5236,
};
const WOOL = { dark: 0xa89c88, base: 0xd6ccb8, light: 0xeee6d6 };
/** A sheep's bare face and legs. */
const SHEEP_SKIN = 0x6a5e5a;
const SHEEP_SKIN_DARK = 0x463c3c;
const BLOOD = { dark: 0x3e1418, base: 0x5c1d20 };
const BONE = { dark: 0xa89c80, base: 0xd8ceb4 };

/** Height of the cave's back walls, in pixels. */
export const CAVE_WALL_HEIGHT = 120;

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Smooth value noise, for lumpy rock. */
function noise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0) + (hash(x0 + 1, y0) - hash(x0, y0)) * sx;
  const b = hash(x0, y0 + 1) + (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}

function register(scene: Phaser.Scene, key: string, c: PixelCanvas, anchorX: number, anchorY: number): void {
  c.toTexture(scene, key);
  MODEL_ART[key] = { key, originX: anchorX / c.width, originY: anchorY / c.height };
}

// ---------------------------------------------------------------- floor

/** Gravelly rock floor: dark, with pale pebbles and the odd crack. */
export function caveFloorTile(seed: number): PixelCanvas {
  const c = new PixelCanvas(TILE_WIDTH, TILE_HEIGHT);
  const rnd = seededRandom(seed * 41 + 3);
  const hw = TILE_WIDTH / 2;
  const inDiamond = (x: number, y: number) => {
    const row = y < TILE_HEIGHT / 2 ? y : TILE_HEIGHT - 1 - y;
    const half = 2 * (row + 1);
    return x >= hw - half && x < hw + half;
  };
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      if (!inDiamond(x, y)) continue;
      // Tile-space u, v so the mottling lines up with the grid.
      const sx = (x + 0.5 - hw) / hw;
      const sy = (y + 0.5 - TILE_HEIGHT / 2) / (TILE_HEIGHT / 2);
      const u = (sx + sy) / 2 + 0.5;
      const v = (sy - sx) / 2 + 0.5;
      const t = Math.PI * 2;
      const m = Math.sin(t * u + seed) * Math.cos(t * v + seed * 1.7);
      const r = rnd();
      let col = m > 0.45 ? ROCK.mid : m < -0.5 ? ROCK.dark : ROCK.base;
      if (r < 0.08) col = ROCK.dark;
      else if (r < 0.12) col = ROCK.mid;
      c.set(x, y, col);
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rnd() * TILE_WIDTH);
    const y = Math.floor(rnd() * TILE_HEIGHT);
    if (!inDiamond(x, y) || !inDiamond(x + 1, y + 1)) continue;
    c.set(x, y, rnd() < 0.5 ? ROCK.light : ROCK.wet);
    c.set(x + 1, y + 1, ROCK.darker);
  }
  // A hairline crack.
  let x = 14 + Math.floor(rnd() * 30);
  let y = 10 + Math.floor(rnd() * 10);
  for (let i = 0; i < 10; i++) {
    if (inDiamond(x, y)) c.set(x, y, ROCK.darker);
    x += 1;
    y += rnd() < 0.5 ? 0 : rnd() < 0.5 ? 1 : -1;
  }
  return c;
}

// ---------------------------------------------------------------- walls

/**
 * Rock face: ledges of rock in rough bands, each lit along its top edge and
 * cracked here and there, fading into blackness towards the top where the
 * roof is lost in the dark. The top edge is ragged.
 * @param along position along the whole wall, so neighbouring segments join up
 */
function rockFace(along: number, H: number, salt: number, mouth = false): Shader {
  return (u, v) => {
    const x = (along + u) * 32;
    const y = v * H;
    const top = 6 + noise(x / 9, salt) * 16;
    if (y < top) return null;
    if (mouth) {
      // An opening onto daylight, shaped like a rough arch.
      const dx = u * 32 - 16;
      const w = 12 + noise(y / 6, salt + 4) * 2;
      const archTop = H - 64 + (dx / w) ** 2 * 26;
      if (Math.abs(dx) < w && y > archTop) {
        if (y < archTop + 2 || Math.abs(dx) > w - 2) return ROCK.deep;
        const g = (y - archTop) / (H - archTop);
        // Bright sky at the top of the opening, green hillside below.
        return g < 0.35 ? 0xd9e6e0 : g < 0.55 ? 0xb6cfc0 : g < 0.8 ? 0x7da86a : 0x5c8a4c;
      }
    }
    const warp = noise(x / 14, y / 30 + salt) * 10;
    const band = Math.floor((y + warp) / 15);
    const inBand = ((y + warp) % 15) / 15;
    const crack = hash(Math.floor((x + band * 7) / 11), band + salt) < 0.35 && Math.abs(((x + band * 7) % 11) - 5) < 0.6;
    let col = inBand < 0.12 ? ROCK.light : inBand > 0.85 ? ROCK.dark : ROCK.base;
    if (crack && inBand > 0.12) col = ROCK.darker;
    const n = hash(Math.floor(x), Math.floor(y));
    if (n < 0.05) col = ROCK.mid;
    else if (n > 0.97) col = ROCK.wet;
    // Moss low down where water seeps.
    if (y > H - 12 && noise(x / 5, salt + 9) > 0.6 && n < 0.45) col = ROCK.moss;
    // Into the dark near the roof.
    const fade = (y - top) / 34;
    if (fade < 0.4) return hash(x, y + 1) < 0.5 ? ROCK.deep : ROCK.darker;
    if (fade < 1 && hash(x + 3, y) > fade) return ROCK.darker;
    return col;
  };
}

/**
 * Stalactites hanging in front of a wall segment: tapering spikes of wet
 * rock. Returns null outside them, so they can be painted on a quad of their own.
 */
function stalactites(along: number, salt: number): Shader {
  const D = 54;
  return (u, v) => {
    const x = u * 32;
    const y = v * D;
    for (let i = 0; i < 3; i++) {
      if (hash(along * 3 + i, salt) < 0.35) continue;
      const cx = 4 + i * 11 + hash(along, i + salt) * 6;
      const len = 14 + hash(along + i, salt + 2) * 38;
      const w = 2.2 + hash(along + i, salt + 5) * 2.5;
      const half = w * (1 - y / len);
      if (y < len && Math.abs(x - cx) < half) {
        if (x - cx < -half + 1.2) return ROCK.wet;
        return x > cx + half * 0.3 ? ROCK.dark : y < 10 ? ROCK.darker : ROCK.mid;
      }
    }
    return null;
  };
}

function caveWall(scene: Phaser.Scene, key: string, side: 'back' | 'side', index: number, mouth = false): void {
  const m = new IsoModel();
  const H = CAVE_WALL_HEIGHT;
  const face = rockFace(index, H, side === 'back' ? 1 : 7, mouth);
  if (side === 'back') {
    m.quad({ x: 0, y: 0, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, face);
    m.quad({ x: 0, y: 0.18, z: H - 18 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -54 }, stalactites(index, 3));
  } else {
    // In shade: one step darker.
    const shade: Record<number, number> = { [ROCK.light]: ROCK.mid, [ROCK.mid]: ROCK.base, [ROCK.base]: ROCK.dark, [ROCK.wet]: ROCK.light };
    const darker: Shader = (u, v) => {
      const c = face(u, v);
      return c === null ? null : (shade[c] ?? c);
    };
    m.quad({ x: 0, y: 0, z: H }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -H }, darker);
    if (!mouth) m.quad({ x: 0.18, y: 0, z: H - 18 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -54 }, stalactites(index + 40, 11));
  }
  const r = m.render(false);
  register(scene, key, r.canvas, r.anchorX, r.anchorY);
}

/** Where the two back walls meet: a bulge of rock. */
function caveCorner(scene: Phaser.Scene): void {
  const m = new IsoModel();
  const H = CAVE_WALL_HEIGHT;
  const face = rockFace(0.5, H, 13);
  m.quad({ x: -0.1, y: 0.35, z: H }, { x: 0.45, y: -0.35, z: 0 }, { x: 0, y: 0, z: -H }, face);
  const r = m.render(false);
  register(scene, 'cave-corner', r.canvas, r.anchorX, r.anchorY);
}

// ---------------------------------------------------------------- formations

/** A stalagmite: a tapering cone of banded rock, wet on its lit side. Its base sits at the bottom middle. */
function stalagmite(c: PixelCanvas, cx: number, base: number, h: number, w: number, seed: number): void {
  const rnd = seededRandom(seed);
  for (let y = 0; y < h; y++) {
    const t = y / h; // 0 at the tip, 1 at the base
    const half = Math.max(0.6, w * Math.pow(t, 0.8) + Math.sin(y * 0.7 + seed) * 0.4);
    const py = base - h + y;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const rel = (x + 0.5 - cx) / half;
      if (Math.abs(rel) > 1) continue;
      let col = rel < -0.55 ? ROCK.light : rel > 0.4 ? ROCK.dark : ROCK.base;
      if (rel < -0.75 && t < 0.8) col = ROCK.wet;
      // Rings where it grew in fits and starts.
      if ((y + seed) % 9 === 0 && rel > -0.6) col = ROCK.darker;
      if (rnd() < 0.04) col = ROCK.mid;
      c.set(x, py, col);
    }
  }
}

function stalagmites(seed: number): { canvas: PixelCanvas; anchorX: number; anchorY: number } {
  const c = new PixelCanvas(40, 60);
  const rnd = seededRandom(seed);
  // Back ones first, so the front ones overlap them.
  const spikes: Array<[number, number, number, number]> =
    seed % 2 === 0
      ? [[24, 52, 30 + rnd() * 8, 4.5], [14, 56, 46 + rnd() * 8, 6.5], [27, 58, 16, 3.5]]
      : [[20, 55, 50 + rnd() * 6, 7], [10, 57, 20, 4], [30, 58, 26, 4.5]];
  // A wet stain on the floor round the base.
  c.ellipse(20, 56, 15, 3.5, ROCK.darker);
  for (const [x, b, h, w] of spikes) stalagmite(c, x, b, h, w, seed + x);
  c.outline(ROCK.deep);
  // Anchor: the back corner of its tile, half a tile up from the base's middle.
  return { canvas: c, anchorX: 20, anchorY: 56 - TILE_HEIGHT / 2 };
}

/** A column where a stalactite met a stalagmite, rising out of sight into the dark. */
function column(seed: number): { canvas: PixelCanvas; anchorX: number; anchorY: number } {
  const H = 190;
  const c = new PixelCanvas(44, H);
  const rnd = seededRandom(seed);
  for (let y = 0; y < H - 4; y++) {
    const t = y / (H - 4);
    // Wide at the floor and at the roof, waisted in the middle.
    const half = 5 + 10 * Math.pow(Math.abs(t - 0.55) * 1.9, 2.2) + Math.sin(y * 0.3 + seed) * 0.8;
    for (let x = Math.floor(22 - half); x <= Math.ceil(22 + half); x++) {
      const rel = (x + 0.5 - 22) / half;
      if (Math.abs(rel) > 1) continue;
      let col = rel < -0.5 ? ROCK.light : rel > 0.35 ? ROCK.dark : ROCK.base;
      if (rel < -0.75) col = ROCK.wet;
      if ((y + seed) % 11 === 0) col = ROCK.darker;
      if (rnd() < 0.03) col = ROCK.mid;
      c.set(x, y, col);
    }
  }
  c.outline(ROCK.deep);
  // The top is lost in the dark.
  fadeTop(c, 70);
  return { canvas: c, anchorX: 22, anchorY: H - 4 - TILE_HEIGHT / 2 };
}

/**
 * Stalactites hanging from the unseen roof, high over the floor: drawn so the
 * tips hang `lift` pixels above the tile, with the rock they hang from fading out above.
 */
function hangingStalactites(seed: number, lift: number): { canvas: PixelCanvas; anchorX: number; anchorY: number } {
  const c = new PixelCanvas(56, 70);
  const rnd = seededRandom(seed);
  for (let i = 0; i < 5; i++) {
    const cx = 8 + i * 10 + rnd() * 4;
    const len = 30 + rnd() * 38;
    const w = 2 + rnd() * 3;
    for (let y = 0; y < len; y++) {
      const half = w * (1 - y / len) + 1;
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const rel = (x + 0.5 - cx) / Math.max(half, 0.5);
        if (Math.abs(rel) > 1) continue;
        c.set(x, y, Math.abs(rel) > 0.8 ? ROCK.deep : rel < -0.4 ? ROCK.wet : rel > 0.3 ? ROCK.dark : ROCK.mid);
      }
    }
  }
  // Their roots fade up into the dark of the roof.
  fadeTop(c, 26);
  return { canvas: c, anchorX: 28, anchorY: 69 + lift - TILE_HEIGHT / 2 };
}

/** Fades the top `rows` of a canvas out to nothing, so it seems to rise into darkness. */
function fadeTop(c: PixelCanvas, rows: number): void {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < c.width; x++) {
      const col = c.get(x, y);
      if (col !== null) c.set(x, y, col, Math.round(255 * (y / rows) ** 1.5));
    }
  }
}

/** A tumbled boulder of cave rock (no moss down here). Big ones fill most of a tile. */
function boulder(seed: number, big: boolean): { canvas: PixelCanvas; anchorX: number; anchorY: number } {
  const c = new PixelCanvas(64, 50);
  const rnd = seededRandom(seed);
  const s = big ? 1 : 0.7;
  const lumps: Array<[number, number, number, number]> = [
    [30, 34, 20 * s, 14 * s],
    [22 + rnd() * 4, 36, 12 * s, 9 * s],
    [42, 38, 11 * s, 8 * s],
    [34, 26 + (big ? -6 : 2), 13 * s, 10 * s],
  ];
  for (const [x, y, rx, ry] of lumps) c.ellipse(x, y, rx, ry, ROCK.base, ROCK.dark, ROCK.light);
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 64; x++) {
      const col = c.get(x, y);
      if (col === null) continue;
      const r = rnd();
      if (r < 0.06) c.set(x, y, col === ROCK.dark ? ROCK.darker : ROCK.mid);
      else if (r > 0.985 && col === ROCK.light) c.set(x, y, ROCK.wet);
    }
  }
  // A crack across the top.
  for (let i = 0; i < 7; i++) c.set(28 + i, 28 + Math.floor(i / 2), ROCK.darker);
  c.outline(ROCK.deep);
  return { canvas: c, anchorX: 32, anchorY: 42 - TILE_HEIGHT / 2 };
}

// ---------------------------------------------------------------- remains

/**
 * A dead ewe lying on her side: a heap of wool with her dark face and stiff
 * legs, a dark stain beneath, and tufts of torn wool about.
 */
function deadSheep(seed: number): { canvas: PixelCanvas; anchorX: number; anchorY: number } {
  const c = new PixelCanvas(52, 34);
  const rnd = seededRandom(seed);
  // The stain on the rock under her.
  c.ellipse(26, 26, 22, 6, BLOOD.dark);
  c.ellipse(22, 25, 12, 3.5, BLOOD.base);
  // Legs stuck out stiff (behind the body).
  const leg = (x0: number, y0: number, x1: number, y1: number) => {
    for (let t = 0; t <= 1; t += 0.08) {
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      c.set(x, y, SHEEP_SKIN);
      c.set(x + 1, y, SHEEP_SKIN_DARK);
    }
  };
  leg(18, 20, 12, 12);
  leg(22, 20, 19, 11);
  leg(32, 20, 33, 11);
  leg(36, 20, 40, 12);
  // The fleece: a lumpy heap.
  for (const [x, y, rx, ry] of [[27, 21, 13, 7], [19, 22, 7, 5.5], [34, 22, 7, 5.5], [26, 17, 10, 5]] as const) {
    c.ellipse(x, y, rx, ry, WOOL.base, WOOL.dark, WOOL.light);
  }
  for (let y = 0; y < 34; y++) {
    for (let x = 0; x < 52; x++) {
      const col = c.get(x, y);
      if ((col === WOOL.base || col === WOOL.light) && rnd() < 0.18) c.set(x, y, rnd() < 0.5 ? WOOL.light : WOOL.dark);
    }
  }
  // Torn fleece, dark with blood, along her flank.
  for (let i = 0; i < 8; i++) c.set(24 + i, 24 + (i % 2), BLOOD.base);
  // Her head, lolling: a dark sheep's face with a pale ear.
  c.ellipse(42, 24, 4.5, 3.2, SHEEP_SKIN, SHEEP_SKIN_DARK);
  c.rect(44, 25, 3, 1, SHEEP_SKIN_DARK);
  c.set(40, 21, WOOL.dark);
  c.set(41, 21, SHEEP_SKIN);
  c.set(42, 23, 0x0e0c0d);
  c.outline();
  // Scattered tufts of wool, unoutlined so they lie flat.
  for (let i = 0; i < 6; i++) {
    const x = 4 + rnd() * 44;
    const y = 28 + rnd() * 5;
    c.set(x, y, WOOL.light);
    c.set(x + 1, y, WOOL.dark);
  }
  return { canvas: c, anchorX: 26, anchorY: 24 - TILE_HEIGHT / 2 };
}

/** Old gnawed bones, lying flat on the floor. */
function bones(seed: number): { canvas: PixelCanvas; anchorX: number; anchorY: number } {
  const c = new PixelCanvas(40, 24);
  const rnd = seededRandom(seed);
  for (let i = 0; i < 4; i++) {
    const x = 6 + rnd() * 26;
    const y = 5 + rnd() * 14;
    const len = 5 + rnd() * 6;
    const dir = rnd() < 0.5 ? 1 : -1;
    for (let t = 0; t <= len; t++) c.set(x + t, y + (t * dir) / 3, BONE.base);
    // Knobbly ends.
    c.set(x - 1, y - 1, BONE.base);
    c.set(x - 1, y + 1, BONE.dark);
    c.set(x + len + 1, y + (len * dir) / 3 - 1, BONE.base);
    c.set(x + len + 1, y + (len * dir) / 3 + 1, BONE.dark);
  }
  // A small skull.
  if (seed % 2 === 0) {
    c.ellipse(30, 16, 3.5, 2.8, BONE.base, BONE.dark);
    c.set(29, 16, ROCK.deep);
    c.set(31, 16, ROCK.deep);
  }
  return { canvas: c, anchorX: 20, anchorY: 12 - TILE_HEIGHT / 2 };
}

// ---------------------------------------------------------------- outside

/**
 * The cave mouth in the hillside: a 3x3-tile mound of rock with grass and
 * heather on top, and a dark arched opening at its front corner, over the
 * one tile of the footprint that's open (2, 2) so the player can walk into it.
 */
function caveEntrance(): { canvas: PixelCanvas; anchorX: number; anchorY: number } {
  const S = 3;
  const MAXH = 92;
  // Height of the mound at grid point (x, y) of the footprint, in pixels.
  const height = (x: number, y: number): number => {
    const edge = Math.min(x, y, S - x, S - y);
    if (edge <= 0) return 0;
    const dx = x - 1.25;
    const dy = y - 1.25;
    const r = Math.hypot(dx, dy) / 1.85;
    let h = MAXH * Math.max(0, 1 - r * r) + (noise(x * 4, y * 4) - 0.5) * 14;
    h *= Math.min(1, edge / 0.35);
    // The open tile in front of the mouth, with a steep rock face round it.
    const open = Math.min(x - 2, y - 2);
    if (open > 0) return 0;
    h *= Math.min(1, -open / 0.08);
    return Math.max(0, h);
  };
  const base = project({ x: 0, y: 0, z: 0 });
  const top = project({ x: 0, y: 0, z: MAXH + 16 });
  const W = S * TILE_WIDTH + 8;
  const ax = W / 2;
  const ay = base.y - top.y + 6;
  const c = new PixelCanvas(W, ay + S * TILE_HEIGHT + 6);
  const at = (x: number, y: number, z: number) => {
    const p = project({ x, y, z });
    return { x: Math.round(ax + p.x), y: Math.round(ay + p.y) };
  };

  // Paint the heightfield back to front as thin columns: each one's top is
  // coloured by how the slope there faces the light (from the upper left).
  const step = 1 / 40;
  const samples: Array<[number, number]> = [];
  for (let y = 0; y < S; y += step) for (let x = 0; x < S; x += step) samples.push([x, y]);
  samples.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const grass = [P.leafDark, P.grassDark, P.grass, P.grassLight];
  const rock = [P.mortar, P.stoneDark, P.stone, P.stoneLight];
  for (const [x, y] of samples) {
    const h = height(x, y);
    if (h <= 0) continue;
    const hx = (height(x + step, y) - height(x - step, y)) / (2 * step * 32);
    const hy = (height(x, y + step) - height(x, y - step)) / (2 * step * 32);
    const len = Math.hypot(hx, hy, 1);
    const nz = 1 / len;
    // Lit from the upper left, like everything else: the +y side bright, the +x side in shade.
    const light = (hx * 0.6 - hy * 0.6 + 0.7) / len;
    const n = hash(Math.floor(x * 40), Math.floor(y * 40));
    const steep = nz < 0.42 + (noise(x * 3, y * 3) - 0.5) * 0.35;
    const ramp = steep ? rock : grass;
    const i = Math.max(0, Math.min(3, Math.floor(light * 3.2 + (n - 0.5) * 0.8)));
    let col: number = ramp[i];
    // Heather and the odd flower on top; strata lines on the rock.
    if (!steep && n > 0.985) col = n > 0.993 ? P.flowerYellow : 0x8a5c8e;
    if (steep && Math.floor(h / 9) % 2 === 0 && n < 0.2) col = P.stoneDark;
    if (steep && n > 0.95) col = P.moss;
    const t = at(x, y, h);
    const g = at(x, y, 0);
    // Below its top pixel a column is the side of the mound: a step darker, turf over rock.
    const side = Math.max(0, i - 1);
    c.set(t.x, t.y, col);
    for (let py = t.y + 1; py <= g.y; py++) c.set(t.x, py, ramp === grass && py < t.y + 3 ? grass[side] : rock[side]);
  }

  // The mouth: a dark arch in the rock face behind the open tile.
  const m = at(2, 2, 0);
  const mw = 25;
  const mh = 46;
  for (let y = m.y - mh - 3; y <= m.y + 2; y++) {
    for (let x = m.x - mw - 3; x <= m.x + mw + 3; x++) {
      const nx = (x - m.x) / mw;
      const archY = m.y - mh * Math.sqrt(Math.max(0, 1 - nx * nx)) * (0.92 + noise(x / 4, 3) * 0.16);
      // Lower edge: follows the ground line of the open tile's two back sides.
      const floor = m.y + Math.abs(x - m.x) * 0.5 + 2;
      if (Math.abs(nx) > 1 || y < archY || y > floor) continue;
      const depth = (y - archY) / (floor - archY + 1);
      const rim = y < archY + 2.5 || Math.abs(nx) > 0.9;
      c.set(x, y, rim ? ROCK.darker : depth > 0.85 ? 0x231e26 : 0x0b090d);
    }
  }
  // Roots and ivy trailing over the lip of the arch.
  const rnd = seededRandom(17);
  for (let i = 0; i < 9; i++) {
    const x = m.x - mw + 6 + rnd() * (mw * 2 - 12);
    const nx = (x - m.x) / mw;
    const y0 = m.y - mh * Math.sqrt(Math.max(0, 1 - nx * nx)) - 1;
    const len = 4 + rnd() * 12;
    for (let k = 0; k < len; k++) c.set(x + Math.sin(k * 0.6 + i) * 0.8, y0 + k, k > len - 3 ? P.leaf : i % 3 === 0 ? P.barkDark : P.leafDark);
  }
  // A few loose stones at its foot.
  for (const [gx, gy] of [[2.15, 2.9], [2.85, 2.15], [1.9, 2.95]] as const) {
    const p = at(gx, gy, 0);
    c.ellipse(p.x, p.y - 1, 3.5, 2.2, ROCK.mid, ROCK.dark, ROCK.light);
  }
  c.outline();
  return { canvas: c, anchorX: ax, anchorY: ay };
}

export function generateCave(scene: Phaser.Scene): void {
  for (let i = 0; i < 4; i++) {
    caveWall(scene, `cave-wall-back-${i}`, 'back', i);
    caveWall(scene, `cave-wall-side-${i}`, 'side', i);
  }
  caveWall(scene, 'cave-wall-side-mouth', 'side', 1, true);
  caveCorner(scene);
  const put = (key: string, art: { canvas: PixelCanvas; anchorX: number; anchorY: number }) =>
    register(scene, key, art.canvas, art.anchorX, art.anchorY);
  put('cave-stalagmites-0', stalagmites(2));
  put('cave-stalagmites-1', stalagmites(5));
  put('cave-column', column(3));
  put('cave-stalactites-0', hangingStalactites(4, 120));
  put('cave-stalactites-1', hangingStalactites(9, 110));
  put('cave-boulder-0', boulder(2, true));
  put('cave-boulder-1', boulder(7, false));
  put('cave-boulder-2', boulder(11, true));
  put('cave-ewe-0', deadSheep(3));
  put('cave-ewe-1', deadSheep(8));
  put('cave-bones-0', bones(2));
  put('cave-bones-1', bones(5));
  put('cave-entrance', caveEntrance());
}
