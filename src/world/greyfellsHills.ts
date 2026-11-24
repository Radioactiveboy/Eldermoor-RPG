/**
 * The lie of the land on the Greyfells: one height for every point on and
 * around the map, so the hills can be painted as a single range rising out of
 * the heather instead of rocks set down on it. Greyfells Clearing is the bowl
 * in the middle, flat enough to walk, where the goblins' trail runs, with the
 * camp and the tarn. Round it the ground climbs on every side but the south,
 * gently at first and then in crags and ridges, highest to the north where
 * the fells go on into the hills. Kept free of Phaser so the map and the
 * painter can share it.
 */

export const GREYFELLS_W = 48;
export const GREYFELLS_H = 56;
/** The column where the goblins' trail comes up out of the north woods, at the bottom edge. */
export const GREYFELLS_SOUTH_X = 21;
/** The middle of the goblins' camp: their cookfire. */
export const GOBLIN_CAMP = { x: 23.5, y: 21.5 };
/** The back corner of the hole in the hill's old 4x4 footprint; its mouth is the tile at (3, 3) from here, cut into the foot of the crags. */
export const WARREN = { tx: 21, ty: 3 };
/** The tarn, a cold little lake east of the camp. */
export const TARN = { x: 37, y: 31, rx: 5.5, ry: 3.8 };
/** Where the trail ends: the open tile in front of the hole in the hill. */
export const WARREN_MOUTH = { x: WARREN.tx + 3.5, y: WARREN.ty + 4.4 };

/** The goblins' trail, from the woods up to the hole in the hill. */
export const GREYFELLS_TRAIL = [
  { x: GREYFELLS_SOUTH_X + 0.5, y: GREYFELLS_H + 2 },
  { x: 20, y: GREYFELLS_H - 9 },
  { x: 23, y: 40 },
  { x: 21.5, y: 31 },
  { x: GOBLIN_CAMP.x, y: GOBLIN_CAMP.y + 3.5 },
  { x: GOBLIN_CAMP.x + 1.5, y: GOBLIN_CAMP.y - 4 },
  { x: 25.5, y: 12 },
  { x: WARREN_MOUTH.x, y: WARREN_MOUTH.y - 0.8 },
];

/** Hill heights in pixels; anything at or above this blocks the way. */
export const HILL_BLOCKS = 6;
/** How far past the map's edges the heights go, in tiles. */
const PAD = 18;
/** Height samples per tile. */
const RES = 6;

const hash = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/** Smooth value noise, 0..1. */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x, y, seed + o * 17) * amp;
    total += amp;
    amp *= 0.5;
    x *= 2.03;
    y *= 2.03;
  }
  return sum / total;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

/** The flat ground of the clearing, as places along the trail and round the camp with how far the flat runs from each. */
const OPEN: Array<{ x: number; y: number; r: number }> = (() => {
  const radii = [8, 8.5, 9, 9, 10, 9, 5.5, 3.2];
  const out: Array<{ x: number; y: number; r: number }> = [];
  for (let i = 0; i + 1 < GREYFELLS_TRAIL.length; i++) {
    const a = GREYFELLS_TRAIL[i];
    const b = GREYFELLS_TRAIL[i + 1];
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.75);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, r: radii[i] + (radii[i + 1] - radii[i]) * t });
    }
  }
  // The camp, and a wide stretch of open fell west of the trail.
  out.push({ x: GOBLIN_CAMP.x, y: GOBLIN_CAMP.y, r: 11 });
  out.push({ x: 13, y: 38, r: 6.5 });
  out.push({ x: 15, y: 28, r: 5 });
  out.push({ x: 31, y: 41, r: 6 });
  return out;
})();

/** How far (tiles) a point is out of the flat ground; negative inside it. */
function outOfOpen(x: number, y: number): number {
  let d = Infinity;
  for (const o of OPEN) d = Math.min(d, Math.hypot(x - o.x, y - o.y) - o.r);
  // The tarn and its shore.
  const tx = (x - TARN.x) / (TARN.rx + 4);
  const ty = (y - TARN.y) / (TARN.ry + 4);
  return Math.min(d, (Math.hypot(tx, ty) - 1) * (TARN.ry + 4));
}

/** The tile the hole in the hill opens onto, and the cleft the trail climbs up through to reach it. */
const MOUTH_TILE = { x: WARREN.tx + 3, y: WARREN.ty + 3 };
const CLEFT = { ax: MOUTH_TILE.x + 0.5, ay: MOUTH_TILE.y + 0.75, bx: 25.6, by: 12, r0: 0.62, r1: 2.9 };

/** How far (tiles) a point is out of the mouth's tile and the cleft in front of it; negative inside. */
function outOfCleft(x: number, y: number): number {
  // The mouth's own tile, square, so the rock rises straight from its back edges.
  const qx = Math.max(MOUTH_TILE.x - x, 0, x - (MOUTH_TILE.x + 1));
  const qy = Math.max(MOUTH_TILE.y - y, 0, y - (MOUTH_TILE.y + 1));
  const tile = qx === 0 && qy === 0 ? -Math.min(x - MOUTH_TILE.x, MOUTH_TILE.x + 1 - x, y - MOUTH_TILE.y, MOUTH_TILE.y + 1 - y) : Math.hypot(qx, qy);
  // A wedge opening out down the trail.
  const { ax, ay, bx, by, r0, r1 } = CLEFT;
  const vx = bx - ax;
  const vy = by - ay;
  const t = clamp01(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy));
  const wedge = Math.hypot(x - ax - vx * t, y - ay - vy * t) - (r0 + (r1 - r0) * t);
  return Math.min(tile, wedge);
}

/**
 * The crags the hole is cut into: a face of rock standing straight up behind
 * the mouth and along both sides of the cleft, dying back into the fell's own
 * slopes a few tiles off, so the way in is a notch in the hillside rather
 * than a mound set down in front of it.
 */
function cragAroundMouth(x: number, y: number): number {
  const s = outOfCleft(x, y) - 0.04;
  if (s <= 0) return 0;
  const far = Math.hypot(x - (MOUTH_TILE.x + 0.5), y - (MOUTH_TILE.y + 0.5));
  // Full height round the mouth, dying away down the cleft and off to the sides.
  const near = 1 - smooth(clamp01((far - 2.6) / 3.6));
  if (near <= 0) return 0;
  // Behind the mouth it climbs highest, into the fell's shoulder.
  const behind = clamp01((MOUTH_TILE.x + MOUTH_TILE.y + 1 - x - y) / 3);
  const top = 92 + 46 * behind + (fbm(x * 0.7, y * 0.7, 91, 3) - 0.5) * 40;
  // A sheer face for the first stretch, ledges and fissures in it, then easing into the slope.
  const face = 1 - Math.exp(-s / 0.45);
  const ledge = (valueNoise(x * 1.8, y * 1.8, 93) - 0.5) * 18 * clamp01(s / 0.5);
  return Math.max(0, (top * face + ledge) * near);
}

/** Where the bedrock breaks through: above about 0.66 there's an outcrop. */
export function outcrop(x: number, y: number): number {
  return valueNoise(x * 0.5 + 3, y * 0.5, 57);
}

function rawHeight(x: number, y: number, open: number): number {
  // Nothing rises inside the cleft: it's the way in.
  if (outOfCleft(x, y) <= 0) return 0;
  return Math.max(fellHeight(x, y, open), cragAroundMouth(x, y));
}

function fellHeight(x: number, y: number, open: number): number {
  const d = open + (fbm(x * 0.11, y * 0.11, 1, 3) - 0.5) * 6;
  if (d <= 0) return 0;
  const north = clamp01((16 - y) / 24);
  const top = 95 + 135 * north;
  let h = top * (1 - Math.exp(-d / 5.5));
  // Ridges running across the slopes, and crags breaking out of them.
  const ridge = 1 - Math.abs(fbm(x * 0.16 + 7.3, y * 0.16 - 2.1, 2, 3) * 2 - 1);
  h += ridge * ridge * ridge * 85 * clamp01(d / 5);
  h += (fbm(x * 0.55, y * 0.55, 3, 3) - 0.5) * 26 * clamp01(d / 3);
  // Outcrops: shelves of bare rock standing up out of the turf (painted as rock, see outcrop()).
  const rocky = smooth(clamp01((outcrop(x, y) - 0.62) / 0.08)) * clamp01((d - 1.5) / 3);
  if (rocky > 0) {
    // Blocky, fissured rock: stepped shelves and cracks.
    const crack = 1 - Math.abs(valueNoise(x * 1.3, y * 1.3, 63) * 2 - 1);
    const shelf = 18 + 26 * valueNoise(x * 0.8, y * 0.8, 61);
    h += rocky * (shelf + (crack - 0.6) * 22 + (valueNoise(x * 2.6, y * 2.6, 67) - 0.5) * 10);
  }
  // A gentle foot, and the fell running down into the woods to the south.
  h *= smooth(clamp01(d / 2.2));
  h *= smooth(clamp01((GREYFELLS_H - 5 - y) / 14));
  return Math.max(0, h);
}

export interface HillField {
  /** The height of the ground at (x, y), in pixels. */
  at(x: number, y: number): number;
  /** The tallest point on tile (tx, ty). */
  tileMax(tx: number, ty: number): number;
}

let cached: HillField | undefined;

/** The Greyfells' heights, worked out once. */
export function greyfellsHills(): HillField {
  if (cached) return cached;
  const x0 = -PAD;
  const y0 = -PAD;
  const cols = (GREYFELLS_W + PAD * 2) * RES + 1;
  const rows = (GREYFELLS_H + PAD * 2) * RES + 1;
  // How far out of the flat ground, worked out coarsely (it changes slowly) and filled in between.
  const dcols = GREYFELLS_W + PAD * 2 + 2;
  const drows = GREYFELLS_H + PAD * 2 + 2;
  const dist = new Float32Array(dcols * drows);
  for (let j = 0; j < drows; j++) for (let i = 0; i < dcols; i++) dist[j * dcols + i] = outOfOpen(x0 + i, y0 + j);
  const grid = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const gx = i / RES;
      const gy = j / RES;
      const di = Math.floor(gx);
      const dj = Math.floor(gy);
      const fx = gx - di;
      const fy = gy - dj;
      const k = dj * dcols + di;
      const open = dist[k] * (1 - fx) * (1 - fy) + dist[k + 1] * fx * (1 - fy) + dist[k + dcols] * (1 - fx) * fy + dist[k + dcols + 1] * fx * fy;
      grid[j * cols + i] = rawHeight(x0 + gx, y0 + gy, open);
    }
  }
  const at = (x: number, y: number): number => {
    const gx = Math.max(0, Math.min(cols - 1.001, (x - x0) * RES));
    const gy = Math.max(0, Math.min(rows - 1.001, (y - y0) * RES));
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    const fx = gx - i;
    const fy = gy - j;
    const k = j * cols + i;
    const a = grid[k];
    const b = grid[k + 1];
    const c = grid[k + cols];
    const d = grid[k + cols + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const tileMax = (tx: number, ty: number): number => {
    let m = 0;
    for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) m = Math.max(m, at(tx + i / 4, ty + j / 4));
    return m;
  };
  cached = { at, tileMax };
  return cached;
}
