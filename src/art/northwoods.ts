import Phaser from 'phaser';
import { TILE_HEIGHT } from '../config';
import { MODEL_ART, registerModel } from './interior';
import { IsoModel, Shader } from './IsoModel';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';
import { smoothNoise } from './scorch';

/**
 * The north woods (see world/NorthWoodsMap.ts): the old watchtower on its
 * rise, gone to ruin and ivy; fallen trees lying across the forest floor;
 * bramble thickets where the wild cats lie up; bracken and leaf litter; the
 * stones of the ford; and what the goblins left on their way north with
 * Mother: ferns trodden flat, a burnt-out torch, and a scrap of her quilt
 * caught on the thorns.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const STONE_DEEP = 0x3e3c46;
const MOSS_DARK = 0x3e5a2a;
const IVY = 0x2f5a2a;
const IVY_LIGHT = 0x4e8040;
const LOG = 0x5a4632;
const LOG_DARK = 0x3a2c20;
const LOG_LIGHT = 0x7a6448;
const HEART = 0xb8946a;
const HEART_DARK = 0x8a6a48;
const BRAMBLE = 0x2c4a26;
const BRAMBLE_DARK = 0x1c3018;
const BRAMBLE_LIGHT = 0x48703a;
const CANE = 0x5a2a2a;
const BERRY = 0x2a1a30;
const FERN = 0x4e7a32;
const FERN_DARK = 0x34561e;
const FERN_LIGHT = 0x78a446;
const FERN_DEAD = 0x8a6a34;
const LEAF_RED = 0x9a4a26;
const LEAF_GOLD = 0xb88a36;
const LEAF_BROWN = 0x6a4a2a;
const MUD = 0x4a3826;
const MUD_DARK = 0x33261a;

// ---------------------------------------------------------------- the watchtower

/** Courses of rough-dressed stone, mossy near the ground, ivy climbing it. `h` is the wall's height in pixels. */
function towerStone(h: number, seed: number, inside = false): Shader {
  return (u, v) => {
    const y = v * h;
    const row = Math.floor(y / 7);
    const x = u * 96 + (row % 2) * 6;
    const ly = y - row * 7;
    const lx = x % 12;
    const n = smoothNoise(u * 14, v * 6, seed);
    if (inside) return ly < 1 || lx < 1 ? STONE_DEEP : n > 0.6 ? P.stoneDark : 0x4a4854;
    // Ivy up the left of the tower, and moss creeping up from the foot.
    const ivy = smoothNoise(u * 9, v * 4, seed + 7) + (u < 0.45 ? 0.25 : -0.2) + v * 0.2;
    if (ivy > 0.92) return hash(Math.floor(u * 80), Math.floor(y / 2)) < 0.35 ? IVY_LIGHT : IVY;
    if (v > 0.82 && n + (v - 0.82) * 2 > 0.75) return n > 0.85 ? P.moss : MOSS_DARK;
    if (ly < 1 || lx < 1) return STONE_DEEP;
    if (ly < 2) return P.stoneLight;
    return n > 0.68 ? P.stoneLight : n < 0.3 ? P.stoneDark : P.stone;
  };
}

/**
 * The old watchtower: a round tower of grey stone standing on a 3x3 footprint, its
 * top fallen in long ago so the broken wall stands ragged against the sky, an
 * empty doorway on the side facing the path, and stones that came down from it
 * lying in the grass.
 */
function watchtower(): IsoModel {
  const m = new IsoModel();
  const cx = 1.5;
  const cy = 1.5;
  const r = 1.05;
  const H = 118;
  // How far down the wall has broken away at each point round it (0..1 of its height).
  const broken = (a: number) => {
    const n = smoothNoise(a * 2.2, 0.5, 71) * 0.4 + Math.max(0, Math.sin(a * 1.3 + 0.8)) * 0.35;
    return Math.min(0.62, n + (Math.floor(a * 9) % 3 === 0 ? 0.06 : 0));
  };
  // Inside: the far half of the wall, seen through the broken top (darker, in shadow).
  const inner = towerStone(H, 73, true);
  const slices = 28;
  for (let i = 0; i < slices; i++) {
    const a0 = (3 * Math.PI) / 4 + (Math.PI * i) / slices;
    const a1 = (3 * Math.PI) / 4 + (Math.PI * (i + 1)) / slices;
    const top = H * (1 - broken(a0));
    const p0 = { x: cx + Math.cos(a0) * (r - 0.12), y: cy + Math.sin(a0) * (r - 0.12), z: top };
    const p1 = { x: cx + Math.cos(a1) * (r - 0.12), y: cy + Math.sin(a1) * (r - 0.12), z: top };
    m.quad(p0, { x: p1.x - p0.x, y: p1.y - p0.y, z: 0 }, { x: 0, y: 0, z: -top }, (u, v) => inner((i + u) / slices, v));
  }
  // The rubble-choked floor inside.
  m.quad({ x: cx - r, y: cy - r, z: 26 }, { x: r * 2, y: 0, z: 0 }, { x: 0, y: r * 2, z: 0 }, (u, v) => {
    const dx = u * 2 - 1;
    const dy = v * 2 - 1;
    if (dx * dx + dy * dy > 0.8) return null;
    const n = smoothNoise(u * 9, v * 9, 77);
    return n > 0.62 ? P.stoneLight : n > 0.45 ? P.stone : n > 0.3 ? P.stoneDark : MOSS_DARK;
  });
  // The near half of the wall, with its broken top and the doorway.
  const outer = towerStone(H, 79);
  const from = -Math.PI / 4;
  for (let i = 0; i < slices; i++) {
    const a0 = from + (Math.PI * i) / slices;
    const a1 = from + (Math.PI * (i + 1)) / slices;
    const u = (i + 0.5) / slices;
    const top = H * (1 - broken(a0 + Math.PI));
    const p0 = { x: cx + Math.cos(a0) * r, y: cy + Math.sin(a0) * r, z: top };
    const p1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r, z: top };
    const lit = Math.cos(a0 - Math.PI * 0.9) * 0.5 + 0.5;
    m.quad(p0, { x: p1.x - p0.x, y: p1.y - p0.y, z: 0 }, { x: 0, y: 0, z: -top }, (_su, v) => {
      // The doorway: a dark arch low in the wall, towards the path (+y).
      const door = Math.abs(u - 0.72) < 0.07;
      const z = top * (1 - v);
      if (door && z < 34 + Math.sqrt(Math.max(0, 0.0049 - (u - 0.72) ** 2)) * 140) return z < 2 ? MUD_DARK : 0x1a161e;
      if (door && Math.abs(u - 0.72) > 0.055 && z < 50) return P.stoneLight;
      const c = outer(u, 1 - z / H);
      if (c === null) return null;
      // Shade round the tower, away from the light at the upper left.
      return lit < 0.3 && c === P.stone ? P.stoneDark : lit < 0.15 && c === P.stoneLight ? P.stone : c;
    });
  }
  // Fallen stones and a broken lintel lying round the foot.
  const stones: Array<[number, number, number, number, number]> = [
    [0.05, 2.35, 0.34, 0.28, 9], [0.45, 2.6, 0.26, 0.22, 7], [2.4, 0.1, 0.3, 0.32, 9], [2.55, 0.55, 0.22, 0.2, 6],
    [2.45, 2.2, 0.36, 0.26, 10], [2.1, 2.62, 0.24, 0.2, 7], [0.15, 0.3, 0.28, 0.26, 8],
  ];
  for (const [x, y, sx, sy, sz] of stones) {
    m.box(x, y, 0, sx, sy, sz, { top: (u, v) => (hash(Math.floor(u * 5 + x * 9), Math.floor(v * 5)) < 0.3 ? P.moss : P.stoneLight), left: P.stone, right: P.stoneDark });
  }
  return m;
}

// ---------------------------------------------------------------- deadfalls

/**
 * A fallen tree lying along x, `len` tiles long: its bark grey-brown and furred
 * with moss along the top, broken stubs of branches, the pale heartwood at the
 * snapped end (towards +x) and, at the other, the root plate torn up out of
 * the ground with the earth still clinging to it.
 */
function deadfall(len: number, seed: number, roots: boolean): IsoModel {
  const m = new IsoModel();
  const y0 = 0.5;
  const ry = 0.26;
  const rz = 10;
  const zc = 9;
  const x0 = roots ? 0.35 : 0.1;
  const x1 = len - 0.1;
  // The root plate: a ragged disc of roots and earth standing on end at the foot of the trunk.
  if (roots) {
    m.quad({ x: 0.3, y: -0.25, z: 40 }, { x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: -40 }, (u, v) => {
      const d = Math.hypot(u - 0.5, (v - 0.55) * 1.2);
      const edge = 0.46 + (smoothNoise(u * 7, v * 7, seed) - 0.5) * 0.22;
      if (d > edge) return hash(Math.floor(u * 40), Math.floor(v * 30)) < 0.05 && d < edge + 0.08 ? LOG_DARK : null;
      if (d < 0.14) return LOG_DARK;
      const n = smoothNoise(u * 12, v * 12, seed + 3);
      return n > 0.66 ? LOG_LIGHT : n > 0.5 ? MUD : n > 0.32 ? MUD_DARK : LOG;
    });
  }
  // The trunk: thin strips round the near half, back to front.
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const a0 = Math.PI - (Math.PI * 1.45 * i) / steps;
    const a1 = Math.PI - (Math.PI * 1.45 * (i + 1)) / steps;
    const p0 = { x: x0, y: y0 + Math.cos(a0) * ry, z: zc + Math.sin(a0) * rz };
    const p1 = { y: y0 + Math.cos(a1) * ry, z: zc + Math.sin(a1) * rz };
    const up = Math.sin((a0 + a1) / 2);
    m.quad(p0, { x: x1 - x0, y: 0, z: 0 }, { x: 0, y: p1.y - p0.y, z: p1.z - p0.z }, (u) => {
      const n = smoothNoise(u * len * 6, i * 0.7, seed + 11);
      // Moss along the top; furrowed bark below, darker towards the ground.
      if (up > 0.6 && n > 0.48) return n > 0.7 ? P.moss : MOSS_DARK;
      const furrow = Math.floor(u * len * 18 + i * 0.4) % 5 === 0;
      if (up < -0.2) return LOG_DARK;
      return furrow ? LOG_DARK : up > 0.5 ? LOG_LIGHT : n > 0.66 ? LOG_LIGHT : LOG;
    });
  }
  // Snapped-off branch stubs.
  for (let i = 0; i < 3; i++) {
    const x = x0 + (0.3 + i * 0.28 + hash(seed, i) * 0.1) * (x1 - x0);
    m.box(x, y0 - 0.05, zc + rz - 2, 0.1, 0.1, 3 + hash(i, seed) * 3, { top: LOG_LIGHT, left: LOG, right: LOG_DARK });
  }
  // The broken end: pale heartwood in rings, splintered.
  m.quad({ x: x1, y: y0 - ry, z: zc + rz }, { x: 0, y: ry * 2, z: 0 }, { x: 0, y: 0, z: -rz * 2 }, (u, v) => {
    const d = Math.hypot(u * 2 - 1, v * 2 - 1);
    if (d > 1) return null;
    if (d > 0.82) return LOG_DARK;
    return Math.floor(d * 6 + smoothNoise(u * 4, v * 4, seed) * 2) % 2 ? HEART : HEART_DARK;
  });
  return m;
}

// ---------------------------------------------------------------- brambles

/**
 * A bramble thicket on one tile: a tangled mound of dark leaves with arching
 * red-brown canes, thorns and blackberries. With `quilt`, a scrap of red
 * patchwork quilt hangs caught on the thorns at the front.
 */
function bramble(seed: number, quilt = false): PixelCanvas {
  const W = 60;
  const H = 46;
  const base = { x: 30, y: 38 };
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  // The mound, built up from overlapping clumps of leaves.
  const clumps: Array<[number, number, number, number]> = [];
  for (let i = 0; i < 11; i++) {
    const a = rnd() * Math.PI;
    const d = rnd();
    clumps.push([base.x + Math.cos(a) * 18 * d, base.y - 9 - Math.sin(a) * 13 * d, 9 + rnd() * 5, 6 + rnd() * 4]);
  }
  clumps.sort((a, b) => a[1] - b[1]);
  for (const [x, y, rx, ry] of clumps) c.ellipse(x, y, rx, ry, BRAMBLE, BRAMBLE_DARK, BRAMBLE_LIGHT);
  // Leaf texture: serrated edges and a glint here and there.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const col = c.get(x, y);
      if (col === null) continue;
      const r = rnd();
      if (r < 0.12) c.set(x, y, BRAMBLE_DARK);
      else if (r < 0.2 && col !== BRAMBLE_DARK) c.set(x, y, BRAMBLE_LIGHT);
    }
  }
  // Canes arching out of the mound, with thorns.
  for (let i = 0; i < 4; i++) {
    const sx = base.x + (rnd() - 0.5) * 30;
    const sy = base.y - 4 - rnd() * 10;
    const dir = rnd() < 0.5 ? -1 : 1;
    const reach = 10 + rnd() * 10;
    const lift = 8 + rnd() * 10;
    for (let t = 0; t <= 1; t += 0.03) {
      const x = sx + dir * reach * t;
      const y = sy - Math.sin(t * Math.PI) * lift + t * 6;
      c.set(x, y, CANE);
      if (Math.floor(t * 33) % 6 === 0) c.set(x, y - 1, 0xc8a080);
    }
  }
  // Blackberries, some still red.
  for (let i = 0; i < 9; i++) {
    const x = Math.round(base.x + (rnd() - 0.5) * 36);
    const y = Math.round(base.y - 6 - rnd() * 16);
    if (c.get(x, y) === null) continue;
    c.set(x, y, rnd() < 0.3 ? 0x9a2a2a : BERRY);
    c.set(x + 1, y, BERRY);
  }
  if (quilt) {
    // A torn scrap of patchwork, red and cream, hanging off a cane by one corner and trailing to the ground.
    const qx = base.x + 2;
    const qy = base.y - 19;
    for (let y = 0; y < 14; y++) {
      const width = 11 - Math.floor(y / 3) - (hash(y, 9) < 0.4 ? 1 : 0);
      for (let x = 0; x < width; x++) {
        const px = qx + x + Math.floor(y * 0.6);
        const check = (Math.floor(x / 4) + Math.floor(y / 4)) % 2;
        if (y === 13 && hash(x, 3) < 0.5) continue;
        const seam = x % 4 === 3 || y % 4 === 3;
        c.set(px, qy + y, seam ? P.quiltDark : check ? P.quilt : 0xe0cfa8);
      }
    }
    // The cane it's caught on, across the top.
    for (let x = -4; x < 8; x++) c.set(qx + x, qy - 1 + Math.floor(Math.abs(x) / 4), CANE);
  }
  c.outline();
  return c;
}

// ---------------------------------------------------------------- ground cover

/** A spray of bracken, standing knee-high: arching fronds from one root, green or (with `dead`) gone brown. */
function bracken(seed: number, dead = false): PixelCanvas {
  const W = 34;
  const H = 22;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  const root = { x: 17, y: 19 };
  const [base, dark, light] = dead ? [FERN_DEAD, 0x6a4e24, 0xb08a48] : [FERN, FERN_DARK, FERN_LIGHT];
  const fronds = 5 + Math.floor(rnd() * 3);
  for (let f = 0; f < fronds; f++) {
    const a = -Math.PI * (0.12 + (0.76 * f) / (fronds - 1)) + (rnd() - 0.5) * 0.2;
    const len = 9 + rnd() * 6;
    for (let t = 0; t <= 1; t += 0.06) {
      // Each frond arches up and droops at the tip, with leaflets either side.
      const x = root.x + Math.cos(a) * len * t;
      const y = root.y + Math.sin(a) * len * t * 0.9 + t * t * 6;
      c.set(x, y, dark);
      if (t > 0.1 && t < 0.95) {
        const leaf = Math.round((1 - t) * 3);
        for (let k = 1; k <= leaf; k++) {
          c.set(x - Math.sin(a) * k * 0.6, y + k * 0.5, k === leaf ? light : base);
          c.set(x + Math.sin(a) * k * 0.6, y - k * 0.4 + 0.5, base);
        }
      }
    }
  }
  return c;
}

/** A flat patch on the ground, painted by `paint(u, v)` over one tile from its corner. */
function decal(paint: Shader, w = 1, h = 1): IsoModel {
  return new IsoModel().quad({ x: 0, y: 0, z: 0 }, { x: w, y: 0, z: 0 }, { x: 0, y: h, z: 0 }, paint);
}

/** Fallen leaves and twigs scattered over the ground, thinning out towards the edge of the patch. */
const leafLitter = (seed: number) =>
  decal((u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const n = smoothNoise(u * 4, v * 4, seed);
    // Leaves come in clusters of two or three pixels, so they read as leaves rather than noise.
    const h = hash(Math.floor(u * 22), Math.floor(v * 22) + seed);
    if (h > (1 - d) * n * 0.55) return null;
    const k = hash(Math.floor(u * 22) + 3, Math.floor(v * 22) + seed * 2);
    if (k < 0.06) return LOG_DARK;
    return k < 0.35 ? LEAF_RED : k < 0.6 ? LEAF_GOLD : k < 0.85 ? LEAF_BROWN : FERN_DEAD;
  });

/**
 * Bracken trodden flat by many feet all going the same way: broken fronds
 * pressed into the mud, and the prints of small clawed feet.
 */
const trampledFerns = (seed: number) =>
  decal((u, v) => {
    const n = smoothNoise(u * 6, v * 6, seed);
    // A goblin's foot: a narrow print with three toes, here and there in the mud.
    const rnd = seededRandom(seed);
    for (let i = 0; i < 4; i++) {
      const fx = 0.15 + rnd() * 0.7;
      const fy = 0.15 + rnd() * 0.7;
      const du = u - fx;
      const dv = v - fy;
      if (Math.abs(du) < 0.035 && Math.abs(dv) < 0.07) return MUD_DARK;
      if (dv < -0.06 && dv > -0.11 && [-0.04, 0, 0.04].some((t) => Math.abs(du - t) < 0.012)) return MUD_DARK;
    }
    // Thinning out towards the patch's edge, so neighbouring patches run together without a seam.
    const edge = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2;
    if (n < 0.3 + edge * edge * 0.35) return null;
    if (n < 0.42 + edge * 0.1) return MUD;
    // Flattened fronds, all lying the same way (towards -y: north).
    const streak = Math.floor(u * 22 + v * 3 + smoothNoise(u * 3, v * 3, seed + 1) * 3) % 3;
    if (streak === 0) return n > 0.7 ? FERN_DEAD : FERN_DARK;
    return n > 0.62 ? FERN : n > 0.52 ? FERN_DARK : MUD;
  });

/** The ford's stepping stones: flat grey stones in the shallows, wet round their edges. */
const fordStones = () =>
  decal((u, v) => {
    const stones: Array<[number, number, number]> = [[0.22, 0.3, 0.13], [0.55, 0.42, 0.15], [0.35, 0.72, 0.12], [0.8, 0.75, 0.11]];
    for (const [x, y, r] of stones) {
      const d = Math.hypot(u - x, v - y) / r;
      if (d < 0.7) return v - y < -r * 0.2 ? P.stoneLight : P.stone;
      if (d < 1) return P.stoneDark;
    }
    return null;
  });

/** A goblin torch, dropped and burnt out: a crooked stick bound with pitch-black rags, lying in the ferns. */
function droppedTorch(): PixelCanvas {
  const c = new PixelCanvas(36, 18);
  for (let t = 0; t <= 1; t += 0.02) {
    const x = 4 + t * 24;
    const y = 12 - t * 5 + Math.sin(t * 9) * 0.6;
    c.set(x, y, LOG);
    c.set(x, y + 1, LOG_DARK);
  }
  // The burnt head: charred rags, and a little grey ash spilled beside it.
  c.ellipse(29, 6.5, 4, 3, 0x2a2224, 0x1a1418, 0x3a2e2a);
  c.set(30, 5, 0x6a5a50);
  c.set(28, 7, 0x6a5a50);
  for (const [x, y] of [[33, 9], [34, 10], [32, 10], [26, 10]]) c.set(x, y, P.ash);
  c.outline();
  return c;
}

/** Registers a picture standing on one tile, its foot `footY` pixels down at its middle column. */
function registerOnTile(scene: Phaser.Scene, key: string, c: PixelCanvas, footY: number): void {
  c.toTexture(scene, key);
  // The tile's back corner is half a tile above its middle.
  MODEL_ART[key] = { key, originX: 0.5, originY: (footY - TILE_HEIGHT / 2) / c.height };
}

export function generateNorthWoods(scene: Phaser.Scene): void {
  registerModel(scene, 'nw-watchtower', watchtower().render());
  registerModel(scene, 'nw-deadfall', deadfall(3, 501, true).render());
  registerModel(scene, 'nw-log', deadfall(2, 503, false).render());
  registerModel(scene, 'nw-log-long', deadfall(4, 507, true).render());
  for (let i = 0; i < 3; i++) registerOnTile(scene, `nw-bramble-${i}`, bramble(511 + i * 7), 38);
  registerOnTile(scene, 'nw-bramble-quilt', bramble(533, true), 38);
  for (let i = 0; i < 4; i++) registerOnTile(scene, `nw-fern-${i}`, bracken(541 + i * 5, i === 3), 19);
  for (let i = 0; i < 3; i++) registerModel(scene, `nw-leaves-${i}`, leafLitter(561 + i).render(false));
  for (let i = 0; i < 4; i++) registerModel(scene, `nw-trampled-${i}`, trampledFerns(571 + i * 3).render(false));
  registerModel(scene, 'nw-ford-stones', fordStones().render(false));
  registerOnTile(scene, 'nw-torch', droppedTorch(), 13);
}
