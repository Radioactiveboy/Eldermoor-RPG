import Phaser from 'phaser';
import { IsoModel, lipped, planks, Shader } from './IsoModel';
import { MODEL_ART, registerModel, WALL_HEIGHT } from './interior';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';
import { mixColor, smoothNoise } from './scorch';
import { generateBlackRoseFolk } from './blackrose3d';

/**
 * The Black Rose, Gloomhaven's big tavern on the town square (see
 * world/BlackRoseMap.ts): rotting, damp and smoky, built of tarred black
 * timber and plaster gone green with the marsh. Its walls (framed timber and
 * stained plaster, a black rose painted over the bar, nets and a mounted
 * pike, a moth-eaten curtain across the back room's door), the great sooty
 * hearth with its eel pot, the bar and what's behind it, rickety stairs,
 * booths, trestles, a dice table, timber posts holding up a sagging ceiling,
 * buckets under the leaks, and puddles, mud and sawdust on the floor; the back
 * room's card table and its crates; and the shabby room upstairs that the
 * Widow lets. Its people are drawn in blackrose3d.ts.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const pick = (h: number, ...cols: number[]) => cols[Math.floor(Math.abs(h) * cols.length) % cols.length];

// Tarred timber, almost black, with a brown grain where the tar's worn thin.
const TAR = 0x2a1f1c;
const TAR_DARK = 0x1a1314;
const TAR_LIGHT = 0x40302a;
const TAR_WORN = 0x5a4130;
// Plaster gone the colour of the marsh: grey-green, damp-blotched, sooty up top.
const PLASTER = 0x7a7862;
const PLASTER_LIGHT = 0x8e8a70;
const PLASTER_DAMP = 0x5c5c4a;
const MOULD = 0x3a4632;
const MOULD_DARK = 0x283224;
const LATH = 0x5a4430;
// Stained oak for the bar and tables.
const OAK = 0x4a3020;
const OAK_DARK = 0x32201a;
const OAK_LIGHT = 0x664530;
const OAK_TOP = 0x704a32;
// The marsh through the windows: murky green glass.
const GLASS = 0x46625a;
const GLASS_DARK = 0x2c3e3c;
const GLASS_LIGHT = 0x84a294;
// The Rose's colours: black and old blood.
const ROSE = 0x241018;
const ROSE_DARK = 0x12080c;
const ROSE_RED = 0x5a1424;
const ROSE_LIGHT = 0x8a2a36;
const VELVET = 0x5a1a22;
const VELVET_DARK = 0x3a0e16;
const VELVET_LIGHT = 0x7a2a30;
const PEWTER = 0x8a8a90;
const PEWTER_DARK = 0x5a5a62;
const PEWTER_LIGHT = 0xb4b4bc;
const STONE = 0x4e4c54;
const STONE_DARK = 0x34323a;
const STONE_LIGHT = 0x6a6872;
const SOOT = 0x1c1618;
const MUD = 0x3e2e22;
const MUD_DARK = 0x2a1e16;
const WATER = 0x2a3438;
const WATER_LIGHT = 0x5a6e74;
const GREEN_GLOW = 0x7ae0a0;
const GREEN_GLOW_DIM = 0x3a8a5a;

// ---------------------------------------------------------------- walls

export type RoseWallKind = 'plain' | 'window' | 'door' | 'curtain' | 'rose' | 'nets' | 'pike' | 'shelf' | 'brace';

/** Stained plaster between the timbers: damp blooms, mould, soot at the top, streaks where the roof leaks, cracks down to the lath. */
function plaster(x: number, y: number, seed: number): number {
  const n = smoothNoise(x / 9 + seed * 3.1, y / 11, seed);
  const streak = smoothNoise(x / 2.2 + seed, y / 40, seed + 4);
  let c = n > 0.62 ? PLASTER_LIGHT : n < 0.34 ? PLASTER_DAMP : PLASTER;
  // Water stains running down from the leaks.
  if (streak > 0.7 && y > 8) c = mixColor(c, PLASTER_DAMP, 0.6);
  // Mould where it's dampest: low down, and in blooms.
  const m = smoothNoise(x / 5 + 40, y / 5 + seed * 7, seed + 11);
  if (m > 0.72 && (y > WALL_HEIGHT * 0.55 || n < 0.3)) c = m > 0.8 ? MOULD_DARK : MOULD;
  // Soot from the fire and the lamps, thick at the top.
  const soot = Math.max(0, 1 - y / 34) * 0.75;
  if (soot > 0) c = mixColor(c, SOOT, soot * (0.6 + smoothNoise(x / 6, y / 4, seed + 2) * 0.5));
  // Cracks, here and there, the plaster fallen away to show the lath behind.
  const crack = smoothNoise(x / 4 + seed * 5, y / 4, seed + 21);
  if (crack > 0.86) return (Math.floor(y) % 4) < 2 ? LATH : TAR_DARK;
  if (hash(Math.floor(x), Math.floor(y) + seed * 97) < 0.03) return mixColor(c, TAR, 0.4);
  return c;
}

/** A tarred beam with its grain running along it (`along` the length, `across` 0..1). */
function timber(along: number, across: number, seed: number): number {
  if (across < 0.18) return TAR_LIGHT;
  if (across > 0.82) return TAR_DARK;
  const g = Math.sin(along * 0.9 + Math.sin(along * 0.13 + seed) * 4 + across * 3);
  if (g > 0.86) return TAR_WORN;
  return hash(Math.floor(along / 3), seed) < 0.12 && g > 0.5 ? TAR_LIGHT : TAR;
}

/** The black rose: five rounded petals in rings, black at the heart, old blood at the edges, a stem with thorns. */
function rosePaint(x: number, y: number, cx: number, cy: number, r: number): number | null {
  const dx = x - cx;
  const dy = (y - cy) * 1.1;
  const d = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx);
  if (d < r) {
    const petals = 0.78 + 0.22 * Math.cos(a * 5 + d * 0.5);
    if (d > r * petals) return null;
    const ring = (d / r) * 3 + Math.cos(a * 5 + 1) * 0.35;
    const edge = ring % 1;
    if (edge > 0.82) return ROSE_LIGHT;
    if (edge > 0.68) return ROSE_RED;
    return d < r * 0.25 ? ROSE_DARK : ROSE;
  }
  return null;
}

function wallShader(kind: RoseWallKind, side: 'back' | 'side', index: number): Shader {
  const seed = index * 13 + (side === 'back' ? 3 : 7) + kind.length;
  return (u, v) => {
    const x = u * 32;
    const y = v * WALL_HEIGHT;
    // The frame: a top plate, a sole plate, a rail at the middle, and a post at every other segment.
    if (y < 6) return timber(x + index * 32, y / 6, seed);
    if (y > WALL_HEIGHT - 6) return y > WALL_HEIGHT - 2 ? TAR_DARK : timber(x + index * 32, (y - (WALL_HEIGHT - 6)) / 4, seed + 1);
    const post = index % 2 === 0 && x < 4;
    if (post) return timber(y, x / 4, seed + 2);

    if (kind === 'window' && x > 7 && x < 26 && y > 16 && y < 46) {
      if (x < 9.5 || x > 23.5 || y < 18.5 || y > 43.5) return x < 9 ? TAR_LIGHT : TAR_DARK;
      // Leaded diamonds of murky green glass, streaked with rain.
      const lu = (x - 9.5 + (y - 18.5)) % 5;
      const lv = (x - 9.5 - (y - 18.5) + 50) % 5;
      if (lu < 0.6 || lv < 0.6) return PEWTER_DARK;
      const rain = hash(Math.floor(x), Math.floor((y + x * 3) / 3)) < 0.12;
      if (rain) return GLASS_LIGHT;
      const n = smoothNoise(x / 3, y / 3, seed);
      return n > 0.7 ? mixColor(GLASS, GLASS_LIGHT, 0.4) : n < 0.35 ? GLASS_DARK : GLASS;
    }
    if (kind === 'window' && x > 6 && x < 27 && y >= 46 && y < 49) return y < 47 ? TAR_WORN : TAR; // sill
    if (kind === 'window' && y >= 49 && y < 60 && x > 10 && x < 23) {
      // Damp running down from the sill.
      if (hash(Math.floor(x), 3) < 0.4 && y < 49 + hash(Math.floor(x), 5) * 11) return PLASTER_DAMP;
    }

    if (kind === 'door' && x > 6 && x < 27 && y > 14) {
      // A heavy door of black planks, studded, with a little iron grille to look through.
      if (x < 8 || x > 25 || y < 16) return TAR_DARK;
      if ((Math.floor(x) - 8) % 6 === 0) return TAR_DARK;
      if ((y > 26 && y < 29) || (y > 64 && y < 67)) return x > 21 ? P.iron : P.ironLight;
      if (Math.abs(x - 16.5) < 4 && y > 32 && y < 40) {
        if (x < 13 || x > 20 || y < 33 || y > 39) return P.iron;
        return (Math.floor(x) - 13) % 2 === 0 ? P.ironLight : 0x141012;
      }
      if (Math.abs(x - 10) < 1 && Math.abs(y - 50) < 2) return P.ironLight;
      if ((Math.floor(x) - 10) % 6 === 0 && Math.floor(y) % 8 === 0) return PEWTER_LIGHT;
      return timber(y, ((x - 8) % 6) / 6, seed + 9);
    }

    if (kind === 'curtain' && x > 4 && x < 29 && y > 12) {
      // The back room's doorway: a lintel, and a heavy curtain of moth-eaten red velvet, tied back at one side.
      if (y < 15) return TAR_LIGHT;
      const tie = 46;
      const gather = y > tie - 6 && y < tie + 6 ? Math.max(0, 1 - Math.abs(y - tie) / 6) : 0;
      const left = 5 + gather * 6 + Math.max(0, y - tie) * 0.04;
      if (x < left + 9) {
        const fold = Math.sin((x - 5) * (1.3 - gather * 0.5)) ;
        if (hash(Math.floor(x * 2), Math.floor(y / 2)) < 0.025) return TAR_DARK; // moth holes
        if (y > WALL_HEIGHT - 9) return VELVET_DARK;
        return fold > 0.4 ? VELVET_LIGHT : fold < -0.4 ? VELVET_DARK : VELVET;
      }
      if (Math.abs(y - tie) < 1.2 && x < left + 11) return P.gold; // the tie-back
      // Through the gap: the dark of the back room, a slit of candlelight.
      if (Math.abs(x - 23) < 0.8 && y > 30 && y < 70) return mixColor(P.fireOrange, TAR_DARK, 0.6);
      return x > 27 ? VELVET_DARK : 0x120c0e;
    }

    if (kind === 'rose') {
      // The Rose itself, painted big on the plaster over the bar, flaking.
      const r = rosePaint(x, y, 16, 30, 11);
      if (r !== null && smoothNoise(x / 2, y / 2, 77) > 0.18) return r;
      // Its stem and thorns, and two leaves.
      if (y > 40 && y < 74 && Math.abs(x - (16 + Math.sin(y / 9) * 1.5)) < 1) return ROSE_DARK;
      for (const [ty, s] of [[50, -1], [62, 1]] as const) if (Math.abs(y - ty) < 1 && (x - 16) * s > 0 && Math.abs(x - 16) < 3) return ROSE_DARK;
      for (const [ly, s] of [[56, -1], [46, 1]] as const) {
        const lx = 16 + s * 5;
        if (Math.hypot((x - lx) / 4, (y - ly) / 1.8) < 1) return (x - lx) * s > 0 ? 0x1e2a1e : 0x2a3a26;
      }
    }

    if (kind === 'nets') {
      // A fishing net hung in swags from pegs, cork floats along its top, an eel trap leaning in front.
      const sag = 22 + Math.sin(((x + index * 7) / 32) * Math.PI) * 10;
      if (y > 10 && y < sag + 36) {
        const mx = (x + y * 0.6) % 3.2;
        const my = (x - y * 0.6 + 200) % 3.2;
        if (mx < 0.55 || my < 0.55) return y < sag ? 0x8a7a5a : 0x6a5c44;
      }
      if (Math.abs(y - (10 + Math.sin(x / 4) * 1.5)) < 2 && Math.floor(x) % 6 < 3) return 0xb08a52; // corks
      // The eel trap: a long wicker cone.
      const tx = x - 22;
      const ty = y - 50;
      if (ty > 0 && ty < 28 && Math.abs(tx) < 6 - ty * 0.15) return (Math.floor(ty / 2) + Math.floor(tx)) % 2 ? 0x8a6a3a : 0x6a4e2a;
    }

    if (kind === 'pike') {
      // A great pike, stuffed and mounted on an oak board, mouth agape.
      if (x > 3 && x < 30 && y > 20 && y < 38) {
        if (x < 4 || x > 29 || y < 21 || y > 37) return OAK_DARK;
        const fx = x - 16;
        const fy = y - 29;
        const body = Math.abs(fy) < 4.2 * Math.sqrt(Math.max(0, 1 - (fx / 13) ** 2)) + (fx > 9 ? 0 : 0);
        if (body) {
          if (fx > 10 && Math.abs(fy + 0.8) < 0.7) return 0x1a1414; // the jaw
          if (fx > 8 && fx < 9.5 && fy < -1 && fy > -2.5) return P.gold; // the glass eye
          if (fy > 2) return 0xc8c0a0;
          const spot = hash(Math.floor(x / 2), Math.floor(y / 2)) < 0.3;
          return spot ? 0x8a9a5a : fy < -2 ? 0x3a4a2a : 0x5a6a3a;
        }
        if (fx < -12 && fx > -15 && Math.abs(fy) < (-12 - fx) * 1.4) return 0x4a5a32; // the tail
        return OAK;
      }
    }

    if (kind === 'shelf') {
      // A shelf of jars: pickled eggs, a pickled something with eyes, dusty bottles.
      if (y > 36 && y < 40 && x > 3 && x < 30) return y < 37 ? OAK_LIGHT : OAK_DARK;
      if (y > 22 && y <= 36) {
        if (x > 5 && x < 12 && y > 25) return y < 27 ? TAR : x < 7 ? 0xd8d4b0 : (Math.hypot(x - 9, y - 31) < 1.6 ? 0xe8e0c0 : 0xa0a07a);
        if (x > 14 && x < 19 && y > 24) return y < 26 ? TAR : x < 15 ? GLASS_LIGHT : (Math.abs(x - 16.5) < 0.6 && y > 30 && y < 32 ? 0xf0e8a0 : 0x5a7a4a);
        if (x > 21 && x < 26 && y > 27) return y < 29 ? P.leatherDark : x < 22 ? 0x6a3a2a : 0x4a2418;
      }
      // Cobwebs in the corner under it.
      if (y > 40 && y < 52 && x > 26 && x - 26 > (y - 40) * 0.3 && hash(Math.floor(x), Math.floor(y)) < 0.25) return 0x9a9a90;
    }

    if (kind === 'brace') {
      // A diagonal brace across the panel below the rail.
      const t = (y - 43) / (WALL_HEIGHT - 49);
      if (t > 0 && t < 1 && Math.abs(x - (4 + t * 26)) < 2.4) return timber(y, (x - (4 + t * 26) + 2.4) / 4.8, seed + 5);
    }

    if (y > 40 && y < 44) return timber(x + index * 32, (y - 40) / 4, seed + 3);
    return plaster(x + index * 32, y, seed);
  };
}

/** One segment of the Rose's walls (32 pixels across, a tile long), keyed 'br-wall-<side>-<kind>-<index>'. */
function roseWall(scene: Phaser.Scene, side: 'back' | 'side', kind: RoseWallKind, index: number): void {
  const m = new IsoModel();
  const H = WALL_HEIGHT;
  const cap = 0.14;
  const shade = wallShader(kind, side, index);
  if (side === 'back') {
    m.quad({ x: 0, y: 0, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, shade);
    m.quad({ x: 0, y: -cap, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: cap, z: 0 }, lipped(TAR_LIGHT, TAR_WORN));
  } else {
    // In shade: a step darker all over.
    m.quad({ x: 0, y: 0, z: H }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -H }, (u, v) => {
      const c = shade(u, v);
      return c === null ? null : mixColor(c, 0x0e0a10, 0.22);
    });
    m.quad({ x: -cap, y: 0, z: H }, { x: cap, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, TAR_LIGHT);
  }
  registerModel(scene, `br-wall-${side}-${kind}-${index}`, m.render(false));
}

function cornerPost(): IsoModel {
  const m = new IsoModel();
  m.box(-0.16, -0.16, 0, 0.3, 0.3, WALL_HEIGHT + 3, {
    top: TAR_LIGHT,
    left: (u, v) => timber(v * 80, u, 4),
    right: (u, v) => mixColor(timber(v * 80, u, 5), 0x000000, 0.3),
  });
  return m;
}

// ---------------------------------------------------------------- floor decals

/** A puddle of rainwater under a leak, the boards dark round it. */
function puddle(seed: number): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const d = Math.hypot(u - 0.5, (v - 0.5) * 1.2);
    const edge = 0.3 + smoothNoise(u * 4, v * 4, seed) * 0.16;
    if (d > edge + 0.08) return null;
    if (d > edge) return hash(Math.floor(u * 30), Math.floor(v * 30) + seed) < 0.6 ? 0x2a1c16 : null;
    const glint = (u * 20 + v * 9 + seed) % 7 < 0.8;
    return glint ? WATER_LIGHT : d > edge - 0.04 ? 0x22282a : WATER;
  });
  return m;
}

/** Muddy boot prints tramped in from the square, and a smear of marsh mud. */
function mud(seed: number): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(seed);
  const prints: Array<[number, number, number]> = [];
  for (let i = 0; i < 9; i++) prints.push([0.1 + rnd() * 1.8, 0.1 + rnd() * 0.8, rnd() * Math.PI]);
  m.quad({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const x = u * 2;
    const smear = smoothNoise(x * 3, v * 3, seed) > 0.66 && smoothNoise(x * 9, v * 9, seed + 1) > 0.4;
    if (smear) return smoothNoise(x * 12, v * 12, seed + 2) > 0.6 ? MUD_DARK : MUD;
    for (const [px, py, a] of prints) {
      const dx = x - px;
      const dy = v - py;
      const along = dx * Math.cos(a) + dy * Math.sin(a);
      const across = -dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(along) < 0.11 && Math.abs(across) < 0.045 && !(Math.abs(along) < 0.02)) return MUD_DARK;
    }
    return null;
  });
  return m;
}

/** Sawdust thrown down in front of the bar to soak up what's spilt. */
function sawdust(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const x = u * 3;
    const n = smoothNoise(x * 3, v * 3, 31);
    if (n < 0.45) return null;
    const h = hash(Math.floor(x * 40), Math.floor(v * 40));
    if (h < 0.35) return null;
    return h > 0.85 ? 0xd8b880 : h > 0.6 ? 0xb8985e : 0x9a7a48;
  });
  return m;
}

/** A threadbare rug before the hearth, black and red, a rose in the middle, rotted through at one corner. */
function rug(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.1, z: 0 }, { x: 2.8, y: 0, z: 0 }, { x: 0, y: 1.8, z: 0 }, (u, v) => {
    if (smoothNoise(u * 6, v * 5, 9) * (u + v) > 1.15) return null; // eaten away
    const bald = smoothNoise(u * 8, v * 7, 3) > 0.7;
    if (u < 0.04 || u > 0.96 || v < 0.06 || v > 0.94) return hash(Math.floor(u * 60), Math.floor(v * 40)) < 0.5 ? 0x6a5a40 : null; // fringe
    if (u < 0.1 || u > 0.9 || v < 0.16 || v > 0.84) return (Math.floor(u * 28) + Math.floor(v * 18)) % 2 ? ROSE_RED : ROSE;
    const r = rosePaint(u * 64, v * 40, 32, 20, 9);
    if (r !== null) return bald ? mixColor(r, 0x5a4a3a, 0.4) : r;
    return bald ? 0x4a3a32 : 0x2a1a1e;
  });
  return m;
}

/** A dark stain where something was spilt and never quite scrubbed out. */
function stain(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.22 + smoothNoise(u * 5, v * 5, 5) * 0.2) return null;
    return d < 0.15 ? 0x2a1214 : 0x3a2018;
  });
  return m;
}

// ---------------------------------------------------------------- the hearth

function fieldstone(seed: number, dark = false): Shader {
  return (u, v) => {
    const row = Math.floor(v * 7);
    const off = hash(row, seed) * 0.7;
    const col = Math.floor(u * 4 + off);
    const lu = (u * 4 + off) % 1;
    const lv = (v * 7) % 1;
    if (lu < 0.07 || lv < 0.1) return SOOT;
    const c = pick(hash(col, row + seed), STONE, STONE_LIGHT, STONE, STONE_DARK);
    const sooty = Math.min(1, (1 - v) * 0.9 + smoothNoise(u * 5, v * 5, seed) * 0.4);
    const out = mixColor(c, SOOT, sooty * 0.5);
    return dark ? mixColor(out, 0x000000, 0.25) : out;
  };
}

/** The great hearth: rough black fieldstone, a deep arched firebox, the eel pot hung over the flames on a chain, a spit, and the mantel crowded with skulls of things. */
function hearth(): IsoModel {
  const m = new IsoModel();
  m.box(0.25, 0, 46, 1.5, 0.5, WALL_HEIGHT - 46 + 6, { top: SOOT, left: fieldstone(2), right: fieldstone(3, true) });
  m.box(0, 0, 0, 2, 0.85, 46, {
    top: STONE_DARK,
    left: (u, v) => {
      const x = (u - 0.5) * 64;
      const y = v * 46;
      const top = 12 + (x * x) / 36;
      if (Math.abs(x) < 22 && y > top) return y > 42 ? 0x120c0e : SOOT;
      return fieldstone(1)(u, v);
    },
    right: fieldstone(4, true),
  });
  // A heavy beam for a mantel, and on it: a skull of a pike, candle stubs, a black bottle.
  m.box(-0.08, -0.02, 46, 2.16, 0.98, 5, { top: TAR_WORN, left: lipped(TAR, TAR_LIGHT), right: TAR_DARK });
  m.box(0.3, 0.5, 51, 0.24, 0.16, 5, { top: 0xd8d0b8, left: 0xc8c0a8, right: 0xa8a090 });
  m.box(0.34, 0.66, 51, 0.04, 0.04, 2, { top: 0x1a1414, left: 0x1a1414, right: 0x1a1414 });
  m.cylinder(1.0, 0.55, 51, 0.07, 12, (u) => (u < 0.35 ? 0x3a4a3a : 0x1a2418), 0x1a2418);
  for (const [x, h] of [[1.45, 6], [1.62, 4], [1.75, 8]] as const) {
    m.box(x, 0.5, 51, 0.06, 0.06, h, { top: P.fireYellow, left: 0xd8d0b8, right: 0xa8a090 });
  }
  // The iron crane and the pot on its chain.
  m.box(0.2, 0.1, 10, 0.06, 0.06, 32, { top: P.ironLight, left: P.iron, right: 0x2a2a30 });
  m.box(0.2, 0.1, 38, 0.9, 0.06, 3, { top: P.ironLight, left: P.iron, right: 0x2a2a30 });
  m.box(1.0, 0.12, 22, 0.04, 0.04, 16, { top: P.ironLight, left: P.iron, right: P.iron });
  m.cylinder(1.0, 0.4, 10, 0.24, 12, (u, v) => (v < 0.12 ? 0x3a3a42 : u < 0.3 ? 0x4a4a52 : u > 0.7 ? 0x18181c : 0x2a2a30), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.4 ? 0x6a5a3a : 0x2a2a30));
  // Logs stacked at the side.
  for (const [y, z] of [[0.62, 0], [0.74, 0], [0.68, 5]] as const) m.box(1.75, y, z, 0.3, 0.1, 5, { top: P.barkLight, left: P.bark, right: P.barkDark });
  return m;
}

/** Flames in the hearth's firebox, for one frame of the fire's animation. */
function paintFlames(c: PixelCanvas, ax: number, ay: number, frame: number): void {
  const bx = ax + (1 - 0.85) * 32;
  const by = ay + (1 + 0.85) * 16 - 3;
  const rnd = seededRandom(41 + frame * 29);
  const floor = (x: number) => by + Math.round(x / 2);
  for (let i = -11; i <= 11; i++) {
    c.set(bx + i, floor(i) - 1, P.barkDark);
    c.set(bx + i, floor(i) - 2, i % 3 === 0 ? P.ember : P.bark);
  }
  for (let i = 0; i < 30; i++) {
    const x = Math.round((rnd() - 0.5) * 26);
    const h = 4 + rnd() * (13 - Math.abs(x) * 0.5);
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const col = t < 0.3 ? P.fireYellow : t < 0.7 ? P.fireOrange : P.fireRed;
      const sway = Math.round(Math.sin(t * 3 + frame * 2 + i) * t * 1.5);
      c.set(bx + x + sway, floor(x) - 3 - y, col);
    }
  }
  for (let i = 0; i < 4; i++) c.set(bx + Math.round((rnd() - 0.5) * 18), by - 20 - rnd() * 8, P.ember);
}

const HEARTH_FRAMES = 4;

function putHearth(scene: Phaser.Scene): void {
  const base = hearth().render();
  const w = base.canvas.width;
  const sheet = new PixelCanvas(w * HEARTH_FRAMES, base.canvas.height);
  for (let f = 0; f < HEARTH_FRAMES; f++) {
    const frame = new PixelCanvas(w, base.canvas.height);
    frame.blit(base.canvas, 0, 0);
    paintFlames(frame, base.anchorX, base.anchorY, f);
    sheet.blit(frame, f * w, 0);
  }
  const tex = sheet.toTexture(scene, 'br-hearth');
  for (let f = 0; f < HEARTH_FRAMES; f++) tex.add(f, 0, f * w, 0, w, base.canvas.height);
  MODEL_ART['br-hearth'] = { key: 'br-hearth', originX: base.anchorX / w, originY: base.anchorY / base.canvas.height };
  if (!scene.anims.exists('br-hearth-fire')) {
    scene.anims.create({ key: 'br-hearth-fire', frames: [0, 1, 2, 3, 2, 1].map((frame) => ({ key: 'br-hearth', frame })), frameRate: 7, repeat: -1 });
  }
}

// ---------------------------------------------------------------- small things on tables and the bar

/** A battered pewter tankard. */
function tankard(m: IsoModel, x: number, y: number, z: number): void {
  m.cylinder(x, y, z, 0.085, 8, (u, v) => (v > 0.15 && v < 0.25 ? PEWTER_DARK : u < 0.3 ? PEWTER_LIGHT : u > 0.72 ? PEWTER_DARK : PEWTER), 0x4a3424);
  m.box(x + 0.085, y - 0.02, z + 2, 0.05, 0.04, 4, { top: PEWTER, left: PEWTER_DARK, right: PEWTER_DARK });
}

/** A candle stub stuck in the neck of a black bottle, wax down its sides. */
function bottleCandle(m: IsoModel, x: number, y: number, z: number): void {
  m.cylinder(x, y, z, 0.07, 9, (u, v) => (v < 0.4 && Math.floor(u * 8) % 3 === 0 ? 0xd8d0b8 : u < 0.3 ? 0x2a3a2a : 0x141c14), 0x141c14);
  m.box(x - 0.025, y - 0.025, z + 9, 0.05, 0.05, 4, { top: P.fireYellow, left: 0xd8d0b8, right: 0xa8a090 });
  m.box(x - 0.01, y - 0.01, z + 13, 0.02, 0.02, 3, { top: P.fireYellow, left: P.fireOrange, right: P.fireYellow });
}

/** A pair of bone dice. */
function dice(m: IsoModel, x: number, y: number, z: number): void {
  for (const [dx, dy] of [[0, 0], [0.1, 0.06]]) m.box(x + dx, y + dy, z, 0.05, 0.05, 2, { top: (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.2 ? 0x1a1414 : 0xe8e0c8), left: 0xd0c8b0, right: 0xb0a890 });
}

/** A few coins in a little heap. */
function coins(m: IsoModel, x: number, y: number, z: number, n = 3): void {
  for (let i = 0; i < n; i++) m.cylinder(x + (i % 2) * 0.05, y + i * 0.03, z + i * 0.6, 0.04, 1, () => 0xa8802e, P.gold);
}

/** A knife stuck point-down in the wood. */
function stuckKnife(m: IsoModel, x: number, y: number, z: number): void {
  m.box(x, y, z, 0.02, 0.08, 5, { top: PEWTER_LIGHT, left: PEWTER_LIGHT, right: PEWTER });
  m.box(x - 0.02, y - 0.02, z + 5, 0.06, 0.12, 1, { top: P.iron, left: P.iron, right: P.iron });
  m.box(x - 0.01, y + 0.02, z + 6, 0.04, 0.04, 5, { top: P.leather, left: P.leatherDark, right: P.leatherDark });
}

// ---------------------------------------------------------------- the bar

/** Black-stained oak panels, a carved rose in every other one. */
function barFront(carve: boolean): Shader {
  return (u, v) => {
    if (v < 0.08 || v > 0.9) return OAK_DARK;
    const pu = (u * 2) % 1;
    if (pu < 0.1 || pu > 0.9 || v < 0.18 || v > 0.82) return OAK;
    if (v < 0.22) return OAK_DARK;
    if (carve && Math.floor(u * 2) === 0) {
      const r = rosePaint(pu * 30, v * 26, 15, 12, 5);
      if (r !== null) return r === ROSE_LIGHT ? OAK_LIGHT : OAK_DARK;
    }
    // Kicked and scuffed low down.
    if (v > 0.7 && hash(Math.floor(u * 40), Math.floor(v * 30)) < 0.15) return OAK_LIGHT;
    return pu < 0.18 ? OAK_LIGHT : OAK;
  };
}
const barFrontDark = (carve: boolean): Shader => (u, v) => {
  const c = barFront(carve)(u, v);
  return c === null ? null : mixColor(c, 0x000000, 0.3);
};

/** The bar's top: dark, sticky, cut about with knife-marks and wet rings. */
const barTop: Shader = (u, v) => {
  const base = planks(2, OAK_TOP, OAK_DARK, OAK_LIGHT, 5)(u, v) ?? OAK_TOP;
  if (Math.abs((u * 7 + v * 3) % 1.3 - 0.2) < 0.02) return OAK_DARK; // knife marks
  const ring = Math.abs(Math.hypot((u % 0.5) - 0.25, v - 0.5) - 0.12) < 0.02;
  return ring ? OAK_DARK : base;
};

function barStraight(things: number): IsoModel {
  const m = new IsoModel();
  m.box(0, 0.22, 0, 1, 0.56, 26, { top: OAK_TOP, left: barFront(things % 2 === 0), right: barFrontDark(things % 2 === 0) });
  m.box(0, 0.12, 26, 1, 0.76, 3, { top: barTop, left: OAK_LIGHT, right: OAK });
  // An iron foot rail, rusty.
  m.box(0, 0.86, 5, 1, 0.04, 2, { top: 0x7a5a4a, left: P.iron, right: 0x3a3036 });
  if (things === 0) {
    tankard(m, 0.25, 0.45, 29);
    tankard(m, 0.55, 0.62, 29);
    dice(m, 0.75, 0.4, 29);
  } else if (things === 1) {
    // A jar of pickled eggs and a skull candle.
    m.cylinder(0.35, 0.42, 29, 0.13, 13, (u, v) => (v < 0.1 ? P.iron : (u * 6 + v * 3) % 1 < 0.35 && v > 0.3 ? 0xe8e0b0 : u < 0.3 ? GLASS_LIGHT : 0x8a9a6a), P.iron);
    m.box(0.62, 0.4, 29, 0.16, 0.13, 6, { top: 0xd8d0b8, left: (u, v) => (v > 0.3 && v < 0.6 && (u < 0.4 || u > 0.6) ? 0x1a1414 : 0xd0c8b0), right: 0xa8a090 });
    m.box(0.68, 0.44, 35, 0.04, 0.04, 4, { top: P.fireYellow, left: 0xd8d0b8, right: 0xa8a090 });
  } else if (things === 2) {
    bottleCandle(m, 0.3, 0.45, 29);
    coins(m, 0.62, 0.55, 29, 4);
    // A cleaver left lying.
    m.box(0.7, 0.3, 29, 0.22, 0.1, 1, { top: PEWTER_LIGHT, left: PEWTER, right: PEWTER_DARK });
    m.box(0.55, 0.33, 29, 0.15, 0.04, 1.5, { top: P.leather, left: P.leatherDark, right: P.leatherDark });
  } else {
    tankard(m, 0.4, 0.5, 29);
    m.box(0.62, 0.3, 29, 0.25, 0.3, 1, { top: 0xd8ccb0, left: 0xb0a488, right: 0xa09478 }); // a rag
  }
  return m;
}

function barSide(): IsoModel {
  const m = new IsoModel();
  m.box(0.22, 0, 0, 0.56, 1, 26, { top: OAK_TOP, left: barFront(false), right: barFrontDark(true) });
  m.box(0.12, 0, 26, 0.76, 1, 3, { top: barTop, left: OAK_LIGHT, right: OAK });
  return m;
}

function barCorner(): IsoModel {
  const m = new IsoModel();
  m.box(0.22, 0, 0, 0.56, 0.22, 26, { top: OAK_TOP, left: barFront(false), right: barFrontDark(false) });
  m.box(0.22, 0.22, 0, 0.78, 0.56, 26, { top: OAK_TOP, left: barFront(true), right: barFrontDark(false) });
  m.box(0.12, 0, 26, 0.76, 0.12, 3, { top: barTop, left: OAK_LIGHT, right: OAK });
  m.box(0.12, 0.12, 26, 0.88, 0.76, 3, { top: barTop, left: OAK_LIGHT, right: OAK });
  m.box(0.22, 0.86, 5, 0.78, 0.04, 2, { top: 0x7a5a4a, left: P.iron, right: 0x3a3036 });
  // A birdcage on the corner, a raven in it, glaring.
  m.box(0.4, 0.35, 29, 0.36, 0.36, 2, { top: P.iron, left: P.iron, right: 0x2a2a30 });
  m.box(0.48, 0.48, 31, 0.14, 0.2, 6, { top: 0x1a1620, left: 0x24202c, right: 0x141018 });
  m.box(0.56, 0.62, 35, 0.08, 0.08, 3, { top: 0x1a1620, left: 0x24202c, right: 0x141018 });
  m.box(0.6, 0.7, 36, 0.02, 0.02, 1, { top: P.gold, left: P.gold, right: P.gold });
  const bars: Shader = (u) => ((u * 10) % 1 < 0.22 ? P.ironLight : null);
  m.quad({ x: 0.4, y: 0.71, z: 47 }, { x: 0.36, y: 0, z: 0 }, { x: 0, y: 0, z: -16 }, bars);
  m.quad({ x: 0.76, y: 0.35, z: 47 }, { x: 0, y: 0.36, z: 0 }, { x: 0, y: 0, z: -16 }, bars);
  m.cylinder(0.58, 0.53, 47, 0.2, 2, () => P.iron, P.ironLight);
  return m;
}

/** Kegs racked on their sides on a stand, spigots dripping into a tin pan. */
function kegs(): IsoModel {
  const m = new IsoModel();
  m.box(0.05, 0.05, 0, 1.9, 0.7, 14, { top: OAK_DARK, left: lipped(OAK, OAK_LIGHT), right: OAK_DARK });
  const staves: Shader = (u, v) => {
    if (Math.abs(v - 0.15) < 0.06 || Math.abs(v - 0.85) < 0.06) return u < 0.4 ? 0x5a4a4a : 0x3a3036;
    if ((u * 9) % 1 < 0.1) return OAK_DARK;
    return u < 0.3 ? 0x6a4a30 : u > 0.75 ? OAK_DARK : OAK;
  };
  for (const x of [0.38, 1.0, 1.62]) {
    m.cylinder(x, 0.38, 14, 0.27, 24, staves, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.1 ? OAK_DARK : (u + v) * 8 % 1 < 0.15 ? OAK : 0x6a4a30));
    m.box(x - 0.03, 0.62, 20, 0.06, 0.12, 3, { top: P.ironLight, left: P.iron, right: P.iron });
  }
  m.box(0.6, 0.78, 0, 0.8, 0.14, 2, { top: (u) => (u > 0.2 && u < 0.8 ? 0x5a3a22 : PEWTER), left: PEWTER, right: PEWTER_DARK });
  // A rank of black bottles on top.
  for (const [x, c] of [[0.25, 0x141c14], [0.45, 0x2a1414], [0.7, 0x141c14], [1.3, 0x1c1c24], [1.55, 0x141c14], [1.8, 0x2a1414]] as const) {
    m.cylinder(x, 0.2, 46, 0.06, 9, (u) => (u < 0.3 ? mixColor(c, 0xffffff, 0.2) : c), c);
    m.box(x - 0.02, 0.18, 55, 0.04, 0.04, 3, { top: c, left: c, right: c });
  }
  return m;
}

/** A tall dark dresser of bottles and cups behind the bar, cobwebbed, with a skull on top. */
function bottleShelf(): IsoModel {
  const m = new IsoModel();
  const H = 70;
  const bottles = [0x1c2a1c, 0x3a1a14, 0x2a2a34, 0x4a1a22, 0x1a2a3a, 0x5a4a2a, 0x8a8a7a];
  const front: Shader = (u, v) => {
    const x = u * 64;
    const y = v * H;
    if (x < 2 || x > 62 || y < 3) return OAK_DARK;
    const shelf = Math.floor((y - 3) / 16);
    const ly = (y - 3) % 16;
    if (ly < 2) return OAK_LIGHT;
    const slot = Math.floor(x / 5);
    const n = hash(slot, shelf + 7);
    if (shelf === 3) {
      if (x % 9 > 1 && x % 9 < 7 && ly > 8) return x % 9 < 3 ? PEWTER_LIGHT : PEWTER;
      return 0x120c0e;
    }
    // Cobwebs in the corners.
    if ((x < 9 && ly < 9 - x) || (x > 55 && ly < x - 55)) if (hash(Math.floor(x), Math.floor(y)) < 0.4) return 0x9a9a90;
    const tall = 5 + n * 8;
    if (n > 0.12 && x % 5 > 0.8 && x % 5 < 4 && ly > 16 - tall) {
      const neck = ly < 16 - tall + 3 && (x % 5 < 1.8 || x % 5 > 3);
      if (neck) return 0x120c0e;
      const col = bottles[Math.floor(n * 97) % bottles.length];
      // Dust on them.
      if (ly < 16 - tall + 4) return mixColor(col, 0x8a8a80, 0.35);
      return x % 5 < 1.8 ? mixColor(col, 0xffffff, 0.15) : col;
    }
    return 0x120c0e;
  };
  m.box(0.05, 0, 0, 1.9, 0.42, H, { top: OAK_LIGHT, left: front, right: OAK_DARK });
  // A horned skull on top, and a tallow candle.
  m.box(0.7, 0.12, H, 0.22, 0.18, 7, { top: 0xd8d0b8, left: (u, v) => (v > 0.3 && v < 0.6 && (u < 0.35 || u > 0.65) ? 0x1a1414 : 0xd0c8b0), right: 0xa8a090 });
  m.box(0.6, 0.18, H + 6, 0.1, 0.04, 6, { top: 0xc8c0a0, left: 0xb0a888, right: 0x908870 });
  m.box(0.92, 0.18, H + 6, 0.1, 0.04, 6, { top: 0xc8c0a0, left: 0xb0a888, right: 0x908870 });
  m.box(1.4, 0.2, H, 0.07, 0.07, 6, { top: P.fireYellow, left: 0xd8d0b8, right: 0xa8a090 });
  return m;
}

/** A heavy iron-bound strongbox on a low cupboard, where the Widow keeps the takings. */
function strongbox(): IsoModel {
  const m = new IsoModel();
  m.box(0.08, 0.1, 0, 0.84, 0.7, 24, { top: OAK, left: (u, v) => (v < 0.08 ? OAK_LIGHT : (u * 2) % 1 < 0.05 ? OAK_DARK : OAK), right: OAK_DARK });
  m.box(0.16, 0.18, 24, 0.68, 0.5, 12, {
    top: (u) => (Math.abs(u - 0.25) < 0.05 || Math.abs(u - 0.75) < 0.05 ? P.ironLight : OAK_DARK),
    left: (u, v) => (Math.abs(u - 0.25) < 0.05 || Math.abs(u - 0.75) < 0.05 || v < 0.12 ? P.iron : Math.hypot(u - 0.5, v - 0.5) < 0.1 ? P.gold : OAK),
    right: (_u, v) => (v < 0.12 ? P.iron : OAK_DARK),
  });
  return m;
}

// ---------------------------------------------------------------- stairs, posts, booths, tables

/** Rickety stairs up the back wall, a baluster or two missing, each tread worn hollow. */
function stairs(tile: number): IsoModel {
  const m = new IsoModel();
  const rise = 13;
  for (let k = 0; k < 2; k++) {
    const step = tile * 2 + k;
    const h = (step + 1) * rise;
    const x = k * 0.5;
    m.box(x, 0, 0, 0.5, 0.86, h, {
      top: (u, v) => (u < 0.12 ? TAR_WORN : Math.abs(v - 0.5) < 0.25 && u > 0.2 ? OAK_LIGHT : OAK),
      left: (_u, v) => (v * h < 3 ? OAK_LIGHT : Math.floor(v * h) % rise < 2 ? TAR_DARK : TAR),
      right: TAR_DARK,
    });
    if (step !== 2 && step !== 3) m.box(x + 0.4, 0.78, h, 0.05, 0.05, 20, { top: TAR_LIGHT, left: TAR, right: TAR_DARK });
    m.box(x, 0.78, h + 18, 0.5, 0.06, 3, { top: TAR_WORN, left: TAR, right: TAR_DARK });
  }
  return m;
}

/** A thick timber post holding up the sagging ceiling beam, notched with knife-marks, a lantern hanging from a hook. */
function post(lantern: boolean): IsoModel {
  const m = new IsoModel();
  const H = 120;
  const side: Shader = (u, v) => {
    const y = v * H;
    if (Math.abs(y - 70) < 10 && (Math.floor(y) % 3 === 0) && u > 0.3 && u < 0.8) return TAR_WORN; // tally marks
    return timber(y, u, 7);
  };
  m.box(0.36, 0.36, 0, 0.28, 0.28, H, { top: TAR_LIGHT, left: side, right: (u, v) => mixColor(timber(v * H, u, 8), 0x000000, 0.3) });
  // An iron collar at the foot, where it's rotted and been patched.
  const rust = (u: number, v: number) => (hash(Math.floor(u * 9), Math.floor(v * 5) + 3) < 0.35 ? 0x5a3424 : 0x2e2c30);
  m.box(0.34, 0.34, 0, 0.32, 0.32, 6, { top: 0x3a383c, left: rust, right: (u, v) => mixColor(rust(u, v), 0x000000, 0.35) });
  if (lantern) {
    m.box(0.6, 0.48, 72, 0.18, 0.04, 2, { top: P.iron, left: P.iron, right: P.iron });
    m.box(0.72, 0.43, 52, 0.14, 0.14, 16, {
      top: P.iron,
      left: (u, v) => (u < 0.15 || u > 0.85 || v < 0.1 || v > 0.9 ? P.iron : v > 0.5 ? P.fireOrange : P.fireYellow),
      right: (u, v) => (u < 0.15 || u > 0.85 || v < 0.1 || v > 0.9 ? 0x2a2a30 : P.fireOrange),
    });
    m.box(0.74, 0.45, 68, 0.1, 0.1, 3, { top: P.iron, left: P.iron, right: 0x2a2a30 });
  }
  return m;
}

/**
 * A rough trestle table two tiles long: crusts and fish-bones, tankards, a
 * knife stuck in the wood, a candle in a bottle. `seed` varies the clutter.
 */
function trestle(seed: number): IsoModel {
  const m = new IsoModel();
  const leg = { top: TAR, left: TAR, right: TAR_DARK };
  for (const x of [0.15, 1.75]) {
    m.box(x, 0.15, 0, 0.1, 0.7, 4, leg);
    m.box(x, 0.45, 0, 0.1, 0.1, 26, leg);
  }
  m.box(0.2, 0.47, 8, 1.6, 0.06, 3, leg);
  m.box(0, 0, 26, 2, 1, 4, { top: planks(3, OAK_TOP, OAK_DARK, OAK_LIGHT, 11 + seed), left: OAK, right: OAK_DARK });
  if (seed === 0) {
    tankard(m, 0.3, 0.3, 30);
    tankard(m, 0.55, 0.7, 30);
    stuckKnife(m, 1.2, 0.45, 30);
    bottleCandle(m, 1.75, 0.2, 30);
    m.box(0.9, 0.3, 30, 0.2, 0.12, 2, { top: 0xc8a868, left: 0xa8884e, right: 0x88683a }); // a crust
  } else if (seed === 1) {
    // Fish bones on a board, and a spilt cup.
    m.box(0.8, 0.35, 30, 0.45, 0.3, 1, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
    for (let i = 0; i < 5; i++) m.box(0.9 + i * 0.06, 0.42, 31, 0.015, 0.16, 1, { top: 0xe8e0c8, left: 0xd0c8b0, right: 0xd0c8b0 });
    m.box(0.85, 0.48, 31, 0.33, 0.02, 1, { top: 0xe8e0c8, left: 0xd0c8b0, right: 0xd0c8b0 });
    tankard(m, 1.6, 0.6, 30);
    bottleCandle(m, 0.25, 0.25, 30);
    m.quad({ x: 0.2, y: 0.6, z: 30.2 }, { x: 0.4, y: 0, z: 0 }, { x: 0, y: 0.3, z: 0 }, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.35 ? 0x3a2414 : null));
  } else {
    // Arm-wrestling's left the cups pushed to the ends; a pipe and a pouch.
    tankard(m, 0.2, 0.6, 30);
    tankard(m, 1.8, 0.35, 30);
    m.box(0.9, 0.5, 30, 0.25, 0.05, 1.5, { top: 0xe8e0cc, left: 0xc8c0aa, right: 0xa8a08a });
    m.box(1.12, 0.47, 30, 0.08, 0.1, 3, { top: 0x3a2a20, left: 0xe8e0cc, right: 0xc8c0aa });
    m.box(1.3, 0.25, 30, 0.18, 0.16, 3, { top: P.leatherLight, left: P.leather, right: P.leatherDark });
    bottleCandle(m, 0.6, 0.25, 30);
    coins(m, 1.5, 0.7, 30, 2);
  }
  return m;
}

/** A small round table for dice: the cups, the bones, a heap of coins, a candle in a bottle. */
function diceTable(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.08, 24, (u) => (u < 0.4 ? TAR_LIGHT : TAR), TAR);
  m.box(0.3, 0.3, 0, 0.4, 0.4, 2, { top: TAR, left: TAR, right: TAR_DARK });
  m.cylinder(0.5, 0.5, 24, 0.44, 4, (u) => (u < 0.3 ? OAK_LIGHT : u > 0.7 ? OAK_DARK : OAK), (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.44) return OAK_DARK;
    // A chalked circle to roll into.
    if (Math.abs(d - 0.22) < 0.015) return 0xb8b0a0;
    return Math.sin(u * 40 + v * 7) > 0.85 ? OAK_DARK : OAK_TOP;
  });
  dice(m, 0.45, 0.48, 28);
  coins(m, 0.25, 0.6, 28, 5);
  coins(m, 0.72, 0.3, 28, 3);
  // A leather dice cup lying on its side.
  m.box(0.62, 0.62, 28, 0.16, 0.1, 3, { top: P.leatherLight, left: P.leather, right: P.leatherDark });
  bottleCandle(m, 0.3, 0.28, 28);
  return m;
}

/** A high-backed settle against the side wall, its seat along y, two tiles long: a booth's bench. */
function settle(): IsoModel {
  const m = new IsoModel();
  const wood = { top: OAK_TOP, left: lipped(OAK, OAK_LIGHT), right: OAK_DARK };
  m.box(0.08, 0.05, 0, 0.14, 1.9, 52, { top: TAR_WORN, left: (u, v) => ((u * 6) % 1 < 0.08 ? TAR_DARK : timber(v * 52, u, 3)), right: TAR_DARK });
  m.box(0.22, 0.05, 0, 0.5, 1.9, 16, wood);
  m.box(0.22, 0.05, 16, 0.52, 1.9, 3, { top: (_u, v) => ((v * 4) % 1 < 0.06 ? OAK_DARK : OAK_TOP), left: OAK_LIGHT, right: OAK });
  // Ends.
  for (const y of [0.02, 1.86]) m.box(0.08, y, 0, 0.66, 0.12, 30, wood);
  return m;
}

/** A narrow booth table, its top along y, two tiles long. */
function boothTable(): IsoModel {
  const m = new IsoModel();
  const leg = { top: TAR, left: TAR, right: TAR_DARK };
  for (const y of [0.2, 1.7]) m.box(0.42, y, 0, 0.12, 0.12, 25, leg);
  m.box(0.1, 0.05, 25, 0.8, 1.9, 4, { top: (u, v) => (planks(3, OAK_TOP, OAK_DARK, OAK_LIGHT, 3)(v, u)), left: OAK, right: OAK_DARK });
  tankard(m, 0.35, 0.45, 29);
  tankard(m, 0.5, 1.25, 29);
  bottleCandle(m, 0.7, 0.9, 29);
  // A prayer-book, open, upside down: Hollis's.
  m.box(0.25, 1.5, 29, 0.35, 0.25, 1, { top: (u) => (Math.abs(u - 0.5) < 0.04 ? 0x4a3a2a : u < 0.5 ? 0xe0d4b4 : 0xd0c4a4), left: 0x5a2020, right: 0x3a1414 });
  return m;
}

/** A wobbly stool, one leg shorter than the others, its seat split. */
function stool(): IsoModel {
  const m = new IsoModel();
  const leg = { top: TAR, left: TAR_LIGHT, right: TAR_DARK };
  for (const [x, y] of [[0.32, 0.32], [0.6, 0.32], [0.32, 0.6], [0.6, 0.6]]) m.box(x, y, 0, 0.07, 0.07, 15, leg);
  m.cylinder(0.5, 0.5, 15, 0.22, 3, (u) => (u < 0.3 ? OAK_LIGHT : u > 0.7 ? OAK_DARK : OAK), (u, v) => (Math.abs(u - v) < 0.03 ? TAR_DARK : OAK_TOP));
  return m;
}

/** A rocking chair by the fire, Old Sedge's, with a shawl over the back. */
function rocker(): IsoModel {
  const m = new IsoModel();
  const wood = { top: OAK_LIGHT, left: OAK, right: OAK_DARK };
  for (const x of [0.2, 0.74]) m.box(x, 0.12, 0, 0.06, 0.8, 3, { top: OAK_LIGHT, left: (u) => (u < 0.5 ? OAK : OAK_DARK), right: OAK_DARK });
  for (const [x, y] of [[0.22, 0.3], [0.72, 0.3], [0.22, 0.7], [0.72, 0.7]]) m.box(x, y, 3, 0.06, 0.06, 13, wood);
  m.box(0.2, 0.25, 16, 0.6, 0.55, 3, { top: OAK_TOP, left: OAK_LIGHT, right: OAK });
  // The back, on the far side, so whoever sits in it faces the room.
  m.box(0.2, 0.2, 16, 0.6, 0.06, 30, { top: OAK_LIGHT, left: (u) => ((u * 5) % 1 < 0.4 ? OAK : OAK_DARK), right: OAK_DARK });
  m.box(0.2, 0.18, 46, 0.6, 0.1, 3, wood);
  // The shawl thrown over it.
  m.box(0.28, 0.24, 30, 0.44, 0.08, 14, { top: 0x5a4a3a, left: (u, v) => ((Math.floor(u * 8) + Math.floor(v * 6)) % 2 ? 0x6a5a3e : 0x4a3a2a), right: 0x3a2e22 });
  return m;
}

/** Firewood stacked against the wall by the hearth, an axe leaning on it. */
function woodpile(): IsoModel {
  const m = new IsoModel();
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 4 - (row > 2 ? 1 : 0); i++) {
      const y = 0.12 + i * 0.18 + (row % 2) * 0.09;
      m.cylinder(0.45, y, row * 7, 0.09, 7, (u) => (u < 0.4 ? P.barkLight : P.bark), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.2 ? 0xc8a878 : 0xa8885a));
    }
  }
  m.box(0.8, 0.5, 0, 0.05, 0.05, 26, { top: OAK_LIGHT, left: OAK_LIGHT, right: OAK });
  m.box(0.76, 0.42, 22, 0.08, 0.2, 7, { top: PEWTER_LIGHT, left: PEWTER, right: PEWTER_DARK });
  return m;
}

/** A wooden bucket under a leak, a third full of rainwater. */
function bucket(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.18, 12, (u, v) => (Math.abs(v - 0.2) < 0.06 || Math.abs(v - 0.75) < 0.06 ? P.iron : (u * 8) % 1 < 0.1 ? OAK_DARK : u < 0.3 ? OAK_LIGHT : OAK), (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.42) return OAK;
    return d < 0.12 ? WATER_LIGHT : WATER;
  });
  return m;
}

/** The notice board by the door: wanted bills, a reward for an eel-catcher's boat, and a black card pinned in the middle. */
function board(): IsoModel {
  const m = new IsoModel();
  const papers: Array<[number, number, number, number, number]> = [
    [0.08, 0.1, 0.4, 0.55, 0xd8ccb0],
    [0.46, 0.08, 0.92, 0.42, 0xc8b890],
    [0.12, 0.6, 0.46, 0.92, 0xe0d4b8],
    [0.56, 0.5, 0.88, 0.9, 0xb8a880],
  ];
  m.quad({ x: 0.04, y: 0.1, z: 68 }, { x: 0, y: 0.8, z: 0 }, { x: 0, y: 0, z: -34 }, (u, v) => {
    if (u < 0.05 || u > 0.95 || v < 0.07 || v > 0.93) return TAR_DARK;
    // The black card with a silver eye, dead centre.
    if (Math.abs(u - 0.5) < 0.07 && Math.abs(v - 0.48) < 0.1) return Math.hypot((u - 0.5) * 2, v - 0.48) < 0.04 ? PEWTER_LIGHT : 0x0e0a0c;
    for (const [u0, v0, u1, v1, col] of papers) {
      if (u > u0 && u < u1 && v > v0 && v < v1) {
        if (Math.abs(u - (u0 + u1) / 2) < 0.03 && v < v0 + 0.08) return PEWTER;
        // A crude face on the first bill: WANTED.
        if (col === 0xd8ccb0 && Math.hypot((u - 0.24) * 3, v - 0.3) < 0.09) return 0x3a2e24;
        const line = (v - v0) * 32 % 3 < 0.9 && u > u0 + 0.05 && u < u1 - 0.05 && v > v0 + 0.1;
        return line ? 0x4a3a2e : smoothNoise(u * 20, v * 20, 4) > 0.75 ? mixColor(col, PLASTER_DAMP, 0.5) : col;
      }
    }
    return hash(Math.floor(u * 20), Math.floor(v * 10)) < 0.2 ? TAR_LIGHT : 0x3a2a22;
  });
  return m;
}

// ---------------------------------------------------------------- the back room

/** The card table in the back room: round, two tiles across, green baize gone grey, a ledger, a candle, cards laid out. */
function cardTable(): IsoModel {
  const m = new IsoModel();
  m.cylinder(1, 1, 0, 0.14, 25, (u) => (u < 0.4 ? TAR_LIGHT : TAR), TAR);
  m.box(0.6, 0.6, 0, 0.8, 0.8, 3, { top: TAR, left: TAR, right: TAR_DARK });
  m.cylinder(1, 1, 25, 0.86, 4, (u) => (u < 0.3 ? OAK_LIGHT : u > 0.7 ? OAK_DARK : OAK), (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.44) return OAK_TOP;
    if (d > 0.42) return P.gold;
    return smoothNoise(u * 9, v * 9, 6) > 0.7 ? 0x3a4a3e : 0x2e3e34;
  });
  // A fan of cards, a ledger open, a quill, a candle, a heap of silver.
  for (let i = 0; i < 5; i++) m.box(0.62 + i * 0.07, 0.9 + Math.abs(i - 2) * 0.03, 29, 0.09, 0.14, 1, { top: i === 2 ? 0x1a1014 : 0xe8e0cc, left: 0xc8c0aa, right: 0xa8a08a });
  m.box(1.05, 0.7, 29, 0.45, 0.32, 2, { top: (u) => (Math.abs(u - 0.5) < 0.03 ? 0x5a4a3a : (u * 30) % 3 < 0.6 ? 0x6a5a4a : 0xe0d4b4), left: 0x2a1a24, right: 0x1a1018 });
  m.box(1.42, 0.82, 31, 0.03, 0.2, 1, { top: 0xe8e8e0, left: 0xd0d0c8, right: 0xb8b8b0 });
  bottleCandle(m, 1.35, 1.35, 29);
  coins(m, 0.75, 1.3, 29, 4);
  m.cylinder(0.95, 1.4, 29, 0.05, 1, () => PEWTER, PEWTER_LIGHT);
  return m;
}

/** A high-backed chair, carved, for the gentleman in grey. */
function chair(): IsoModel {
  const m = new IsoModel();
  const wood = { top: OAK_LIGHT, left: OAK, right: OAK_DARK };
  for (const [x, y] of [[0.25, 0.25], [0.7, 0.25], [0.25, 0.7], [0.7, 0.7]]) m.box(x, y, 0, 0.06, 0.06, 17, wood);
  m.box(0.22, 0.22, 17, 0.56, 0.56, 3, { top: VELVET, left: OAK_LIGHT, right: OAK });
  m.box(0.22, 0.2, 17, 0.56, 0.06, 38, { top: OAK_LIGHT, left: (u, v) => (v < 0.4 && rosePaint(u * 24, v * 40, 12, 8, 5) !== null ? OAK_DARK : OAK), right: OAK_DARK });
  return m;
}

/** A smugglers' crate, stencilled; `glow`: one with something inside that gives off a cold green light between the slats. */
function crate(glow: boolean): IsoModel {
  const m = new IsoModel();
  const slats = (dark: boolean): Shader => (u, v) => {
    const base = dark ? 0x4a3a28 : 0x6a5236;
    if (u < 0.06 || u > 0.94 || v < 0.08 || v > 0.92) return dark ? 0x2e2418 : 0x4a3a28;
    const gap = (v * 4) % 1 < 0.08;
    if (gap) return glow ? (dark ? GREEN_GLOW_DIM : GREEN_GLOW) : 0x1a1410;
    if (!dark && !glow && Math.abs(u - 0.5) < 0.2 && Math.abs(v - 0.5) < 0.1 && (Math.floor(u * 30) % 3) < 2) return 0x2a2018; // stencilled mark
    return hash(Math.floor(u * 12), Math.floor(v * 4)) < 0.15 ? (dark ? 0x3a2e20 : 0x5a4630) : base;
  };
  m.box(0.1, 0.1, 0, 0.8, 0.8, 26, { top: slats(false), left: slats(false), right: slats(true) });
  if (glow) {
    // Nailed down tight, with a wax seal, and a black rose stamped on top.
    m.box(0.45, 0.45, 26, 0.1, 0.1, 1, { top: 0x8a1a1a, left: 0x6a1414, right: 0x4a0e0e });
  }
  return m;
}

/** A chart of the river and the fens nailed to the back room's wall, marked in red. */
function chart(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.15, y: 0.04, z: 70 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0, z: -34 }, (u, v) => {
    if (u < 0.03 || u > 0.97 || v < 0.04 || v > 0.96) return 0x8a7a5a;
    // The river's winding line, the fens dotted, red marks and a ring.
    const river = Math.abs(v - (0.5 + Math.sin(u * 9) * 0.18)) < 0.03;
    if (river) return 0x3a5a6a;
    if (Math.hypot(u - 0.72, v - 0.3) < 0.05 && Math.hypot(u - 0.72, v - 0.3) > 0.03) return 0x9a1a1a;
    if (Math.abs(u - 0.3) < 0.02 && Math.abs(v - 0.7) < 0.02) return 0x9a1a1a;
    if (Math.abs(u - 0.5) < 0.02 && Math.abs(v - 0.25) < 0.02) return 0x9a1a1a;
    if (v > 0.6 && hash(Math.floor(u * 40), Math.floor(v * 30)) < 0.08) return 0x5a6a4a;
    return smoothNoise(u * 6, v * 6, 8) > 0.7 ? 0xc8b890 : 0xd8ccaa;
  });
  return m;
}

// ---------------------------------------------------------------- upstairs

/** A sagging bed with a lumpy straw mattress and a stained grey blanket, its frame black with age. */
function bed(): IsoModel {
  const m = new IsoModel();
  const wood = { top: TAR_LIGHT, left: lipped(TAR, TAR_LIGHT), right: TAR_DARK };
  m.box(0, 0, 0, 1, 0.12, 36, wood);
  m.box(0, 0.12, 0, 1, 1.78, 10, wood);
  m.box(0.05, 0.15, 10, 0.9, 1.7, 5, { top: (u, v) => (smoothNoise(u * 4, v * 6, 3) > 0.6 ? 0xa89868 : 0xc8b480), left: 0xb0a070, right: 0x8a7a54 });
  // The blanket, with a stain and a darn.
  m.box(0.03, 0.6, 15, 0.94, 1.25, 3, {
    top: (u, v) => (Math.hypot(u - 0.6, v - 0.4) < 0.12 ? 0x4a4440 : (Math.floor(u * 12) + Math.floor(v * 14)) % 7 === 0 ? 0x6a6460 : 0x5a5654),
    left: 0x4a4644,
    right: 0x3a3634,
  });
  m.box(0.2, 0.18, 15, 0.6, 0.35, 5, { top: 0xb0a890, left: 0x908870, right: 0x787058 });
  m.box(0, 1.84, 0, 1, 0.1, 22, wood);
  return m;
}

/** A washstand with a cracked basin and a jug, and a scrap of mirror. */
function washstand(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.2, 0.2], [0.72, 0.2], [0.2, 0.72], [0.72, 0.72]]) m.box(x, y, 0, 0.08, 0.08, 22, { top: TAR, left: TAR, right: TAR_DARK });
  m.box(0.15, 0.15, 22, 0.7, 0.7, 3, { top: OAK_TOP, left: OAK, right: OAK_DARK });
  m.cylinder(0.45, 0.5, 25, 0.24, 4, (u) => (u < 0.35 ? 0xc8c0b0 : 0x8a8478), (u, v) => (Math.abs(u - v) < 0.03 ? 0x3a3430 : Math.hypot(u - 0.5, v - 0.5) < 0.35 ? WATER : 0xc8c0b0));
  m.cylinder(0.72, 0.32, 25, 0.08, 12, (u) => (u < 0.4 ? 0xc8c0b0 : 0x8a8478), 0x8a8478);
  m.quad({ x: 0.3, y: 0.06, z: 62 }, { x: 0.4, y: 0, z: 0 }, { x: 0, y: 0, z: -22 }, (u, v) => (u < 0.06 || u > 0.94 || v < 0.06 || v > 0.94 ? TAR : u + v > 1.2 ? null : (u * 3 + v) % 1 < 0.1 ? GLASS_LIGHT : 0x6a7a7c));
  return m;
}

/** A chamber pot. Best not to look in it. */
function chamberPot(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.14, 7, (u) => (u < 0.35 ? 0xd8d0c0 : u > 0.7 ? 0x8a8478 : 0xb8b0a0), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.35 ? 0x5a4a2a : 0xb8b0a0));
  return m;
}

/** A plain chair, wedged under a door handle for want of a lock that works. */
function plainChair(): IsoModel {
  const m = new IsoModel();
  const wood = { top: OAK_LIGHT, left: OAK, right: OAK_DARK };
  for (const [x, y] of [[0.3, 0.3], [0.66, 0.3], [0.3, 0.66], [0.66, 0.66]]) m.box(x, y, 0, 0.05, 0.05, 16, wood);
  m.box(0.28, 0.28, 16, 0.44, 0.44, 2, wood);
  m.box(0.24, 0.28, 18, 0.06, 0.44, 22, { top: OAK_LIGHT, left: (u) => ((u * 4) % 1 < 0.5 ? OAK : null), right: OAK_DARK });
  return m;
}

/** A rotting runner down the upstairs passage, `len` tiles long. */
function runner(len: number): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.2, z: 0 }, { x: len - 0.2, y: 0, z: 0 }, { x: 0, y: 0.6, z: 0 }, (u, v) => {
    if (smoothNoise(u * len * 2, v * 3, 2) > 0.78) return null;
    if (v < 0.08 || v > 0.92) return 0x5a4a2a;
    if (v < 0.16 || v > 0.84) return ROSE;
    return (Math.floor(u * len * 3) + Math.floor(v * 4)) % 2 ? ROSE_RED : 0x3a1a1e;
  });
  return m;
}

/** A little table at the passage's end, a candle guttering on it. */
function sideTable(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.06, 22, (u) => (u < 0.4 ? TAR_LIGHT : TAR), TAR);
  m.cylinder(0.5, 0.5, 22, 0.3, 3, (u) => (u < 0.35 ? OAK_LIGHT : OAK_DARK), OAK_TOP);
  bottleCandle(m, 0.46, 0.46, 25);
  return m;
}

/** A battered sea-chest at the foot of the bed. */
function chest(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.2, 0, 0.8, 0.6, 16, { top: (u) => (Math.abs(u - 0.2) < 0.04 || Math.abs(u - 0.8) < 0.04 ? P.iron : OAK), left: (u, v) => (Math.abs(u - 0.2) < 0.04 || Math.abs(u - 0.8) < 0.04 || v < 0.1 ? P.iron : Math.hypot(u - 0.5, v - 0.35) < 0.07 ? PEWTER_LIGHT : OAK), right: OAK_DARK });
  return m;
}

// ---------------------------------------------------------------- registry

function put(scene: Phaser.Scene, key: string, model: IsoModel, outline = true): void {
  registerModel(scene, key, model.render(outline));
}

export function generateBlackRose(scene: Phaser.Scene): void {
  const kinds: RoseWallKind[] = ['plain', 'window', 'door', 'curtain', 'rose', 'nets', 'pike', 'shelf', 'brace'];
  for (const kind of kinds) {
    for (let i = 0; i < 2; i++) {
      roseWall(scene, 'back', kind, i);
      roseWall(scene, 'side', kind, i);
    }
  }
  put(scene, 'br-wall-corner', cornerPost());
  for (let i = 0; i < 3; i++) put(scene, `br-puddle-${i}`, puddle(i * 7 + 1), false);
  for (let i = 0; i < 2; i++) put(scene, `br-mud-${i}`, mud(i * 5 + 3), false);
  put(scene, 'br-sawdust', sawdust(), false);
  put(scene, 'br-rug', rug(), false);
  put(scene, 'br-stain', stain(), false);
  putHearth(scene);
  for (let i = 0; i < 4; i++) put(scene, `br-bar-${i}`, barStraight(i));
  put(scene, 'br-bar-side', barSide());
  put(scene, 'br-bar-corner', barCorner());
  put(scene, 'br-kegs', kegs());
  put(scene, 'br-shelf', bottleShelf());
  put(scene, 'br-strongbox', strongbox());
  for (let i = 0; i < 3; i++) put(scene, `br-stairs-${i}`, stairs(i));
  put(scene, 'br-post', post(false));
  put(scene, 'br-post-lantern', post(true));
  for (let i = 0; i < 3; i++) put(scene, `br-trestle-${i}`, trestle(i));
  put(scene, 'br-dicetable', diceTable());
  put(scene, 'br-settle', settle());
  put(scene, 'br-boothtable', boothTable());
  put(scene, 'br-stool', stool());
  put(scene, 'br-rocker', rocker());
  put(scene, 'br-woodpile', woodpile());
  put(scene, 'br-bucket', bucket());
  put(scene, 'br-board', board(), false);
  put(scene, 'br-cardtable', cardTable());
  put(scene, 'br-chair', chair());
  put(scene, 'br-crate', crate(false));
  put(scene, 'br-crate-glow', crate(true));
  put(scene, 'br-chart', chart(), false);
  put(scene, 'br-bed', bed());
  put(scene, 'br-washstand', washstand());
  put(scene, 'br-pot', chamberPot());
  put(scene, 'br-plainchair', plainChair());
  put(scene, 'br-runner', runner(8), false);
  put(scene, 'br-sidetable', sideTable());
  put(scene, 'br-chest', chest());
  generateBlackRoseFolk(scene);
}
