import Phaser from 'phaser';
import { MODEL_ART, registerModel } from './interior';
import { IsoModel, RenderedModel, SEAT_TOP, Shader, Vec3 } from './IsoModel';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';
import { FEN_ART } from './props';
import { smoothNoise } from './scorch';

/**
 * Gloomhaven (see world/GloomhavenMap.ts), the marsh town downriver: its
 * sagging black houses (on stone footings, or up on stilts over the pools,
 * one burnt out), the Black Rose, the three shops round the square, the wall
 * of black stakes on its stone footing and the gatehouse in it, the little
 * well, and everything a damp, poor, watchful town has lying about: duckboards
 * over the mud, puddles, scum on the water, rushes, dead trees, a gibbet, the
 * stocks, a broken cart, and a rotting barge.
 *
 * Everything here is built with IsoModel like the rest of the game's buildings.
 * Walls can lean (their tops pushed over along x) and roofs sag (the ridge dips
 * in the middle, drawn as strips), which is most of what makes the town look
 * as tired as it is.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 0xff) * (1 - t) + ((b >> s) & 0xff) * t) << s;
  return ch(16) | ch(8) | ch(0);
}
const darken = (c: number, f = 0.75) => mix(c, 0x000000, 1 - f);
const lighten = (c: number, f = 0.2) => mix(c, 0xffffff, f);

// ---------------------------------------------------------------- colours

/** Tarred weatherboard, black with age, and the grey of boards the tar has worn off. */
const TAR = 0x3a3431;
const TAR_DARK = 0x231e1c;
const TAR_LIGHT = 0x574e47;
const GREYBOARD = 0x6a6258;
const GREYBOARD_DARK = 0x48423b;
/** Newer boards nailed over the holes. */
const PATCH = 0x6e5a42;
const PATCH_DARK = 0x4a3c2c;
/** Plaster gone grey and brown with soot and damp, and the black oak framing it. */
const PLASTER = 0x7e7766;
const PLASTER_DARK = 0x5a5548;
const PLASTER_LIGHT = 0x9a927c;
const WATTLE = 0x5a4632;
const BLACK_OAK = 0x231c19;
const BLACK_OAK_LIGHT = 0x3a302a;
/** Wet stone, and the slime and moss on it. */
const STONE = 0x5e5b56;
const STONE_DARK = 0x3d3b38;
const STONE_LIGHT = 0x7c7870;
const MORTAR = 0x4a4640;
const MOSS = 0x4e6430;
const MOSS_LIGHT = 0x6a8240;
const SLIME = 0x3a4a2a;
/** Rotting thatch, warped shingles and old slate. */
const THATCH = 0x5e5238;
const THATCH_DARK = 0x3c3424;
const THATCH_LIGHT = 0x7a6a48;
const SHINGLE = 0x564e46;
const SLATE = 0x4a4c55;
/** A window lit from inside (amber, low), a dark pane, and the Black Rose's red-gold glass. */
const LIT = 0xf0b45a;
const LIT_DEEP = 0xc06a2a;
const LIT_HOT = 0xffe0a0;
const PANE = 0x1a1e24;
const PANE_SHINE = 0x3e4a58;
const ROSE_RED = 0xb8342a;
const ROSE_GLASS = 0xe8743a;
/** Iron, rusted. */
const IRON = 0x3a3a40;
const IRON_LIGHT = 0x5a5a64;
const RUST = 0x6a3e26;
/** Mud, and the water lying on it. */
const MUD = 0x3a3024;
const MUD_DARK = 0x271f17;
const MUD_WET = 0x4e463a;
const PUDDLE = 0x56636e;
const PUDDLE_LIGHT = 0x8e9caa;
const SCUM = 0x5a7032;
const SCUM_LIGHT = 0x7e9644;
/** Old silvered oak (duckboards, the pier), and a dead tree's bare wood. */
const OAK = 0x6e6454;
const OAK_DARK = 0x463e34;
const OAK_LIGHT = 0x8e8270;
const DEADWOOD = 0x5a5248;
const DEADWOOD_DARK = 0x37312b;
const DEADWOOD_LIGHT = 0x7e766a;
/** Rushes and sedge. */
const RUSH = 0x5a6e34;
const RUSH_DARK = 0x37451f;
const RUSH_LIGHT = 0x84944c;
const RUSH_DRY = 0x9a8a58;
/** Canvas: a tarpaulin over a hole in a roof. */
const TARP = 0x5a5e4a;
const TARP_DARK = 0x3c3f30;

// ---------------------------------------------------------------- surfaces

/**
 * Tarred weatherboard: rows of overlapping boards, each throwing a shadow on
 * the one below; boards gone grey where the tar's worn off, a few missing (a
 * black slot), newer boards nailed over others, and the bottom green with damp.
 */
export function boardWall(rows: number, seed: number, rot = 0.5): Shader {
  return (u, v) => {
    const fv = v * rows;
    const row = Math.floor(fv);
    const lv = fv - row;
    const col = Math.floor(u * 6 + hash(row, seed) * 6);
    const n = hash(col + seed * 3, row);
    // A missing board: the dark inside.
    if (n < 0.025 * rot * 2 && lv > 0.15) return lv < 0.35 ? 0x0e0c0b : 0x141110;
    let c = n < 0.18 * rot * 2 ? GREYBOARD : TAR;
    // A patch: a few newer boards nailed across.
    const patch = hash(Math.floor(u * 3), Math.floor(v * 3) + seed) < 0.12 * rot;
    if (patch) c = (Math.floor(u * 40) % 7 === 0) ? PATCH_DARK : PATCH;
    if (lv > 0.84) return darken(c === TAR ? TAR_DARK : c, 0.7);
    if (lv < 0.16) c = c === TAR ? TAR_LIGHT : lighten(c, 0.12);
    // Grain and the odd split.
    const grain = hash(Math.floor(u * 90), row + seed);
    if (grain < 0.07) c = darken(c, 0.8);
    // Damp rising from the ground: green and dark at the foot of the wall, in tongues.
    const damp = v - (0.82 - 0.08 * smoothNoise(u * 9, 1, seed));
    if (damp > 0) c = mix(c, SLIME, Math.min(0.7, damp * 4));
    // Streaks running down from the eaves.
    if (v < 0.5 && hash(Math.floor(u * 50), seed + 9) < 0.08) c = darken(c, 0.85);
    return c;
  };
}

/**
 * Soot-grey plaster between black oak posts, rails and braces, `bays` across:
 * cracked, stained with damp from the foot and from the eaves, and fallen away
 * in places to show the wattle underneath.
 */
function plasterWall(bays: number, H: number, seed: number, upperFrom = 0): Shader {
  return (u, v) => {
    const y = v * H;
    const bu = (u * bays) % 1;
    const bay = Math.floor(u * bays);
    const t = upperFrom > 0 && y > upperFrom ? (y - upperFrom) / (H - upperFrom) : y / (upperFrom || H);
    // Posts, the sill beam, the head beam, and a rail between floors.
    if (bu < 0.06 || bu > 0.94 || y < 3 || y > H - 3) return bu < 0.03 || y < 1.5 ? BLACK_OAK_LIGHT : BLACK_OAK;
    if (upperFrom > 0 && Math.abs(y - upperFrom) < 2.2) return y < upperFrom - 0.8 ? BLACK_OAK_LIGHT : BLACK_OAK;
    // A brace in every other bay.
    if ((bay + seed) % 2 === 0 && Math.abs(bu - (0.08 + t * 0.84)) < 0.045) return BLACK_OAK;
    const n = smoothNoise(u * 14, v * 10, seed);
    // Fallen plaster: wattle showing through, woven.
    if (n > 0.78) {
      const w = (Math.floor(u * 70) + Math.floor(y / 2)) % 2;
      return w ? WATTLE : darken(WATTLE, 0.7);
    }
    if (n > 0.74) return PLASTER_DARK;
    let c = hash(Math.floor(u * 60), Math.floor(y / 2) + seed) < 0.1 ? PLASTER_DARK : PLASTER;
    if (hash(Math.floor(u * 40), Math.floor(y / 3) + seed + 3) > 0.94) c = PLASTER_LIGHT;
    // Cracks.
    if (Math.abs(((u * 7 + y * 0.03 + seed * 0.37) % 1) - 0.5) < 0.006 && smoothNoise(u * 4, v * 4, seed + 2) > 0.55) return darken(c, 0.6);
    // Damp: green-brown up from the ground, soot streaks down from the eaves.
    const damp = v - (0.8 - 0.1 * smoothNoise(u * 7, 2, seed));
    if (damp > 0) c = mix(c, SLIME, Math.min(0.75, damp * 3.5));
    if (v < 0.35 && hash(Math.floor(u * 36), seed + 5) < 0.18) c = mix(c, 0x26221e, (0.35 - v) * 1.6);
    return c;
  };
}

/** Rough, wet rubble stone in uneven courses, mortared, with moss and slime. */
export function rubbleStone(seed: number, scaleU = 3, courses = 3, moss = 0.35): Shader {
  return (u, v) => {
    const row = Math.floor(v * courses);
    const lv = v * courses - row;
    const fu = u * scaleU + hash(row, seed) * 0.7 + (row % 2) * 0.4;
    const block = Math.floor(fu + 0.25 * Math.sin(lv * 3 + row));
    const lu = fu - Math.floor(fu);
    if (lv < 0.1 || lu < 0.06) return smoothNoise(u * 10, v * 6, seed) < moss ? MOSS : MORTAR;
    const n = hash(block + seed, row);
    let c = n < 0.3 ? STONE_DARK : n > 0.78 ? STONE_LIGHT : STONE;
    c = mix(c, 0x6a5e4a, hash(block, row + 9) * 0.3);
    if (lv < 0.22) c = lighten(c, 0.08);
    if (lv > 0.86) c = darken(c, 0.82);
    if (smoothNoise(u * 8, v * 5, seed + 4) < moss * 0.6) c = mix(c, MOSS_LIGHT, 0.5);
    if (v > 0.7) c = mix(c, SLIME, (v - 0.7) * 1.3);
    return c;
  };
}

/** Rotting thatch combed down the slope: dark and mossy, with holes, sags and a grassy crown. */
function rotThatch(seed: number): Shader {
  return (u, v) => {
    const streak = hash(Math.floor(u * 110), Math.floor(v * 7 + hash(Math.floor(u * 110), seed) * 3));
    let c = streak < 0.3 ? THATCH_DARK : streak > 0.86 ? THATCH_LIGHT : THATCH;
    if ((v * 5) % 1 > 0.86) c = darken(c, 0.8);
    const lump = smoothNoise(u * 6, v * 4, seed);
    if (lump > 0.62) c = mix(c, MOSS, 0.55 + (lump - 0.62) * 2);
    if (lump < 0.2) c = mix(c, 0x26201a, 0.5);
    if (v > 0.9) c = darken(THATCH, 0.55);
    return c;
  };
}

/** Warped split shingles, grey-black, some slipped or gone (showing the battens), moss towards the eaves. */
function rotShingle(seed: number, base = SHINGLE): Shader {
  return (u, v) => {
    const row = Math.floor(v * 11);
    const lv = v * 11 - row;
    const fu = u * 20 + hash(row, seed) * 3;
    const n = hash(Math.floor(fu), row + seed);
    if (n < 0.04) return (Math.floor(v * 33) % 3 === 0) ? BLACK_OAK_LIGHT : 0x120f0e; // a gap, the battens showing
    if (lv > 0.78 || fu % 1 < 0.08 || v > 0.96) return darken(base, 0.55);
    let c = n < 0.25 ? darken(base, 0.82) : n > 0.84 ? lighten(base, 0.12) : base;
    if (n > 0.95) c = mix(c, 0x6a5a44, 0.5); // a newer one
    if (smoothNoise(u * 8, v * 6, seed) > 0.6 - v * 0.15) c = mix(c, MOSS, 0.5);
    return c;
  };
}

/** Old slates, a few cracked or slipped, white with lichen in patches. */
function rotSlate(seed: number): Shader {
  return (u, v) => {
    const row = Math.floor(v * 12);
    const lv = v * 12 - row;
    const fu = u * 14 + (row % 2) * 0.5;
    const n = hash(Math.floor(fu), row + seed);
    if (lv > 0.82 || fu % 1 < 0.06 || v > 0.96) return darken(SLATE, 0.6);
    if (n < 0.03) return 0x121214;
    let c = n < 0.3 ? darken(SLATE, 0.85) : n > 0.85 ? lighten(SLATE, 0.14) : SLATE;
    if (smoothNoise(u * 10, v * 8, seed) > 0.72) c = mix(c, 0x9aa088, 0.45);
    return c;
  };
}

type RoofKind = 'thatch' | 'shingle' | 'slate';
const roofShader = (kind: RoofKind, seed: number): Shader => (kind === 'thatch' ? rotThatch(seed) : kind === 'slate' ? rotSlate(seed) : rotShingle(seed));
const roofEdge = (kind: RoofKind) => (kind === 'thatch' ? THATCH_DARK : kind === 'slate' ? darken(SLATE, 0.6) : darken(SHINGLE, 0.6));

// ---------------------------------------------------------------- windows and doors

/** What fills a window: lit, dark, boarded over, shuttered (one shutter hanging), or broken. */
type Pane = 'lit' | 'dark' | 'boarded' | 'shuttered' | 'broken' | 'red' | 'barred';

interface Opening {
  /** Across the face (0..1) and down it, in pixels from the top of the wall. */
  u0: number;
  u1: number;
  y0: number;
  y1: number;
  pane: Pane;
}

/** A window's pixel at (wu, wv) across it (0..1 each way), or null outside its frame. */
function windowPixel(o: Opening, wu: number, wv: number, frame = BLACK_OAK): number {
  if (wu < 0.12 || wu > 0.88 || wv < 0.1 || wv > 0.9) return frame;
  const iu = (wu - 0.12) / 0.76;
  const iv = (wv - 0.1) / 0.8;
  switch (o.pane) {
    case 'boarded': {
      // Two boards nailed across in an X over the dark.
      const a = Math.abs(iu - iv) < 0.16;
      const b = Math.abs(iu - (1 - iv)) < 0.16;
      if (a || b) return a ? GREYBOARD : PATCH;
      return 0x100e0d;
    }
    case 'shuttered':
      // Shut, the two leaves planked, one hanging askew at the bottom.
      if (Math.abs(iu - 0.5) < 0.04) return TAR_DARK;
      if (iu > 0.5 && iv > 0.85 - (iu - 0.5) * 0.3) return 0x100e0d;
      return Math.floor(iu * 6) % 2 ? GREYBOARD : GREYBOARD_DARK;
    case 'broken':
      if (Math.abs(iu - 0.5) < 0.05 || Math.abs(iv - 0.5) < 0.05) return BLACK_OAK;
      return (iu + iv * 0.7) % 0.5 < 0.08 ? PANE_SHINE : 0x0c0c0e;
    case 'barred':
      if (Math.floor(iu * 5) % 2 === 0 && iu > 0.08) return IRON;
      return iv < 0.5 ? LIT : LIT_DEEP;
    case 'red':
    case 'lit': {
      // Small leaded panes, warm, brighter towards the top.
      if (Math.abs(iu - 0.5) < 0.05 || Math.abs(iv - 0.5) < 0.05) return BLACK_OAK;
      if (o.pane === 'red') return iv < 0.45 ? ROSE_GLASS : (iu + iv) % 0.6 < 0.1 ? LIT : ROSE_RED;
      return iv < 0.25 ? LIT_HOT : iv < 0.6 ? LIT : LIT_DEEP;
    }
    default:
      if (Math.abs(iu - 0.5) < 0.05 || Math.abs(iv - 0.5) < 0.05) return BLACK_OAK;
      return iu + iv < 0.5 ? PANE_SHINE : PANE;
  }
}

/** Paints openings (windows) over a wall shader, `H` pixels high; a sill under each. */
function withOpenings(wall: Shader, H: number, openings: Opening[]): Shader {
  return (u, v) => {
    const y = v * H;
    for (const o of openings) {
      if (u >= o.u0 && u <= o.u1 && y >= o.y0 && y <= o.y1) return windowPixel(o, (u - o.u0) / (o.u1 - o.u0), (y - o.y0) / (o.y1 - o.y0));
      // The sill, a little wider, and the damp stain it drips down the wall.
      if (y > o.y1 && y < o.y1 + 1.6 && u > o.u0 - 0.015 && u < o.u1 + 0.015) return BLACK_OAK_LIGHT;
    }
    return wall(u, v);
  };
}

/** A plank door at (u0..u1) up to `top` pixels from the ground, on a wall `H` high: strap hinges, a ring, rot at the foot. */
function withDoor(wall: Shader, H: number, u0: number, u1: number, top: number, shut = true): Shader {
  return (u, v) => {
    const y = v * H;
    if (u < u0 || u > u1 || y < H - top) return wall(u, v);
    const du = (u - u0) / (u1 - u0);
    const dy = y - (H - top);
    if (du < 0.1 || du > 0.9 || dy < 2) return BLACK_OAK;
    if (!shut) return dy < 6 ? 0x2a1a10 : 0x120c08;
    if (Math.abs(dy - 5) < 0.9 || Math.abs(dy - (top - 6)) < 0.9) return du < 0.65 ? IRON : OAK_DARK;
    if (Math.abs(du - 0.78) < 0.05 && Math.abs(dy - top * 0.55) < 1.3) return IRON_LIGHT;
    const plank = Math.floor(du * 4);
    let c = plank % 2 ? OAK_DARK : mix(OAK_DARK, TAR, 0.5);
    if (dy > top - 5) c = mix(c, SLIME, 0.5);
    return c;
  };
}

// ---------------------------------------------------------------- building parts

/** A box from (x, y, z), w x d x h, its faces painted plainly in three tones. */
export function block(m: IsoModel, x: number, y: number, z: number, w: number, d: number, h: number, base: number, dark = darken(base, 0.72), light = lighten(base, 0.12)): void {
  m.box(x, y, z, w, d, h, { top: light, left: base, right: dark });
}

/** A rough post (a stilt, a pile, a stake): round, barked, darker on its shaded side and slimy at its foot. */
export function post(m: IsoModel, x: number, y: number, r: number, h: number, z = 0, wetTo = 0): void {
  m.cylinder(x, y, z, r, h, (u, v) => {
    const g = hash(Math.floor(v * h / 3), Math.floor(u * 4) + Math.floor(x * 13 + y * 7));
    let c = u < 0.3 ? DEADWOOD_LIGHT : u > 0.7 ? DEADWOOD_DARK : DEADWOOD;
    if (g < 0.15) c = darken(c, 0.8);
    if (wetTo > 0 && (1 - v) * h < wetTo) c = mix(c, SLIME, 0.6);
    return c;
  }, DEADWOOD_LIGHT);
}

/** A straight ribbon between two points: a rope, a strut, a chain. */
export function line(m: IsoModel, a: Vec3, b: Vec3, color: number, w = 0.03): void {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  m.quad(a, d, { x: w, y: -w, z: 0 }, color);
  m.quad(a, d, { x: 0, y: 0, z: -1 }, color);
}

/** A crooked stone chimney stack from z0 up `h`, leaning `lean` tiles over by its top, with a pot. */
function chimney(m: IsoModel, x: number, y: number, z0: number, h: number, lean = 0, w = 0.5): void {
  const parts = 5;
  const ph = h / parts;
  for (let i = 0; i < parts; i++) {
    const t = (i / parts) ** 2;
    m.box(x + lean * t, y - lean * t * 0.3, z0 + i * ph, w, w, ph + 0.5, {
      top: P.soot,
      left: (u, v) => ((v * 3) % 1 < 0.16 || (u * 2 + Math.floor(v * 3) * 0.5) % 1 < 0.1 ? MORTAR : hash(Math.floor(u * 2) + i, Math.floor(v * 3)) < 0.35 ? STONE_DARK : STONE),
      right: (u, v) => ((v * 3) % 1 < 0.16 ? darken(MORTAR, 0.8) : hash(Math.floor(u * 2) + i, Math.floor(v * 3) + 4) < 0.3 ? darken(STONE_DARK, 0.85) : STONE_DARK),
    });
  }
  // A clay pot, cracked, and soot round its lip.
  m.cylinder(x + lean + w / 2, y - lean * 0.3 + w / 2, z0 + h, w * 0.26, 6, (u) => (u < 0.4 ? 0x7a4a36 : 0x56342a), P.soot);
}

/** How a tired house is made up (see {@link hovel}). */
export interface HovelLook {
  seed: number;
  /** Footprint, tiles each way (the walls are inset from it). */
  size: number;
  /** Wall height in pixels: about 40 for one storey, 76 for two. */
  H: number;
  /** Rise of the roof over the walls, in pixels. */
  R: number;
  walls: 'boards' | 'plaster' | 'stone';
  roof: RoofKind;
  /** How far the walls' tops have gone over, along x (tiles). */
  lean?: number;
  /** How far the ridge dips in the middle, in pixels. */
  sag?: number;
  /** Up on stilts this many pixels, over water or mud, with a ladder up to the door. */
  stilts?: number;
  /** Windows on the front (+y) face, and on the side (+x). */
  front: Opening[];
  side: Opening[];
  /** Where the front door is, across the front face; none on a house seen from behind. */
  door?: [number, number];
  /** A tarpaulin weighted down over a hole in the roof: where along the ridge (0..1). */
  tarp?: number;
  /** A ragged hole in the thatch or shingle, at (u, v) on the front slope. */
  hole?: [number, number];
  /** Where the chimney stands along the ridge (0..1), and how it leans. */
  chimney?: { at: number; lean: number };
  /** A lean-to shed against the side wall. */
  leanTo?: boolean;
  /** A lantern on a bracket by the door. */
  lantern?: boolean;
  /** A crow sitting on the ridge. */
  crow?: number;
  /** A board sign over the door, painted with this (see {@link signFace}). */
  sign?: Emblem;
  /** Ivy, dead and brown, up the front wall at this point (0..1). */
  creeper?: number;
}

/**
 * A house of Gloomhaven: walls of tarred boards, sooty plaster and black oak, or
 * rubble stone, on a footing of wet rubble (or up on stilts), leaning over; a
 * roof of rotten thatch, warped shingles or slates sagging along its ridge; a
 * crooked chimney; windows lit, dark, boarded or shuttered; a door; and
 * whatever's been done to keep it standing. Its front faces +y.
 */
export function hovel(look: HovelLook): IsoModel {
  const m = new IsoModel();
  const S = look.size;
  const inset = 0.22;
  const x0 = inset;
  const y0 = inset;
  const W = S - inset * 2;
  const D = S - inset * 2 - 0.1;
  const lean = look.lean ?? 0;
  const sag = look.sag ?? 0;
  const lift = look.stilts ?? 0;
  const foot = lift > 0 ? 0 : 6;
  const zb = lift > 0 ? lift : foot;
  const H = look.H;
  const R = look.R;
  const top = zb + H;
  const o = look.roof === 'thatch' ? 0.34 : 0.26;
  const ridgeY = y0 + D / 2;
  const roof = roofShader(look.roof, look.seed);
  const seed = look.seed;

  // The roof's ridge along x: high at the gables, dipping in the middle.
  const ridgeZ = (t: number) => top + R - sag * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  const eaveZ = top - 6;
  const rx0 = x0 - o + lean;
  const rLen = W + o * 2;
  const STRIPS = 14;
  /** One slope of the roof, as strips so it can sag; `side` -1 for the back slope, 1 for the front. */
  const slope = (side: number, paint: Shader) => {
    for (let i = 0; i < STRIPS; i++) {
      const t0 = i / STRIPS;
      const t1 = (i + 1) / STRIPS;
      const z0 = ridgeZ(t0);
      const z1 = ridgeZ(t1);
      m.quad(
        { x: rx0 + rLen * t0, y: ridgeY, z: z0 },
        { x: rLen * (t1 - t0) + 0.01, y: 0, z: z1 - z0 },
        { x: 0, y: side * (D / 2 + o), z: -((z0 + z1) / 2 - eaveZ) },
        (u, v) => paint(t0 + u * (t1 - t0), v),
      );
    }
  };

  // ---- Behind everything: the back slope, and the chimney rising through it.
  slope(-1, roof);
  if (look.chimney) {
    const cx = x0 + W * look.chimney.at + lean * 0.6 - 0.25;
    chimney(m, cx, y0 + 0.25, zb, H + R + 16 - sag * Math.sin(Math.PI * look.chimney.at), look.chimney.lean);
  }

  // ---- What it stands on.
  if (lift > 0) {
    // Stilts at the corners and between, braced, down into the water or the mud.
    for (const [px, py] of [[x0 + 0.12, y0 + 0.12], [x0 + W - 0.12, y0 + 0.12], [x0 + 0.12, y0 + D - 0.12], [x0 + W - 0.12, y0 + D - 0.12], [x0 + W / 2, y0 + D - 0.12], [x0 + W - 0.12, y0 + D / 2]]) {
      post(m, px, py, 0.09, lift + 2, -4, 14);
    }
    line(m, { x: x0 + 0.12, y: y0 + D - 0.1, z: 4 }, { x: x0 + W / 2, y: y0 + D - 0.1, z: lift - 2 }, DEADWOOD_DARK, 0.05);
    line(m, { x: x0 + W - 0.1, y: y0 + 0.12, z: 4 }, { x: x0 + W - 0.1, y: y0 + D / 2, z: lift - 2 }, DEADWOOD_DARK, 0.05);
    // The platform the house sits on, sticking out in front as a little landing.
    m.box(x0 - 0.06, y0 - 0.06, lift - 4, W + 0.12, D + 0.5, 4, {
      top: (u, v) => (Math.floor(u * 12) % 3 === 0 ? OAK_DARK : v > 0.85 ? OAK_LIGHT : OAK),
      left: (u) => (Math.floor(u * 20) % 2 ? OAK_DARK : DEADWOOD_DARK),
      right: DEADWOOD_DARK,
    });
  } else {
    // A footing of wet rubble, sunk unevenly into the ground.
    m.box(x0 - 0.04, y0 - 0.04, 0, W + 0.08, D + 0.08, foot, { top: STONE, left: rubbleStone(seed, 5, 1, 0.5), right: (u, v) => darken(rubbleStone(seed + 1, 5, 1, 0.5)(u, v) ?? STONE, 0.78) });
  }

  // ---- The walls, leaning.
  const wallPaint = (bays: number, faceSeed: number): Shader =>
    look.walls === 'boards' ? boardWall(Math.round(H / 4.2), faceSeed) : look.walls === 'stone' ? rubbleStone(faceSeed, bays * 1.6, Math.round(H / 9), 0.4) : plasterWall(bays, H, faceSeed, H > 60 ? H * 0.48 : 0);
  let front = withOpenings(wallPaint(Math.max(2, Math.round(W * 1.4)), seed), H, look.front);
  if (look.door) front = withDoor(front, H, look.door[0], look.door[1], Math.min(30, H - 6));
  if (look.creeper !== undefined) {
    const at = look.creeper;
    const base = front;
    front = (u, v) => {
      const spread = Math.abs(u - at) / 0.16;
      const reach = 0.9 * (1 - spread * spread);
      if (spread < 1 && v > 1 - reach && hash(Math.floor(u * 140), Math.floor(v * H / 1.5)) < 0.45) {
        return hash(Math.floor(u * 70), Math.floor(v * 30)) < 0.5 ? 0x5a4a2e : 0x3e3624;
      }
      return base(u, v);
    };
  }
  const sidePaint = withOpenings(wallPaint(Math.max(2, Math.round(D * 1.4)), seed + 7), H, look.side);
  // The side wall (+x), shaded.
  m.quad({ x: x0 + W + lean, y: y0, z: top }, { x: 0, y: D, z: 0 }, { x: -lean, y: 0, z: -H }, (u, v) => darken(sidePaint(u, v) ?? TAR, 0.74));
  // The gable over the side wall, finished as the wall is, with a little vent.
  m.quad({ x: x0 + W + lean, y: y0, z: top }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: R - 1 }, (u, v) => {
    const half = Math.abs(u - 0.5) * 2;
    if (v > 1 - half) return null;
    if (v > 0.3 && v < 0.5 && Math.abs(u - 0.5) < 0.06) return 0x0e0c0b;
    const w = look.walls === 'plaster' ? plasterWall(2, R, seed + 11)(u, 1 - v) : wallPaint(2, seed + 13)(u, 1 - v * 0.5);
    return darken(w ?? TAR, 0.7);
  });
  // The front wall (+y), lit.
  m.quad({ x: x0 + lean, y: y0 + D, z: top }, { x: W, y: 0, z: 0 }, { x: -lean, y: 0, z: -H }, front);

  // ---- The front slope, its bargeboard, and the ridge.
  let frontRoof = roof;
  if (look.hole) {
    const [hu, hv] = look.hole;
    frontRoof = (u, v) => {
      const d = Math.hypot((u - hu) * 5, (v - hv) * 2.2) + 0.25 * smoothNoise(u * 20, v * 20, seed);
      if (d < 0.32) return 0x0c0a09; // the dark inside
      if (d < 0.4) return Math.floor(u * 80) % 2 ? BLACK_OAK_LIGHT : roofEdge(look.roof); // rafters and ragged edge
      return roof(u, v);
    };
  }
  if (look.tarp !== undefined) {
    const at = look.tarp;
    const under = frontRoof;
    frontRoof = (u, v) => {
      if (Math.abs(u - at) < 0.13 && v > 0.08 && v < 0.75) {
        const fold = Math.sin((u - at) * 60) * 0.5 + 0.5;
        // Weighted down with stones on ropes.
        if (Math.abs(v - 0.7) < 0.04 && Math.abs(((u - at) * 12) % 1) < 0.3) return STONE_LIGHT;
        return fold > 0.7 ? lighten(TARP, 0.1) : fold < 0.2 ? TARP_DARK : TARP;
      }
      return under(u, v);
    };
  }
  slope(1, frontRoof);
  // The bargeboard at the gable end, and a ridge capping that follows the sag.
  m.quad({ x: rx0 + rLen, y: ridgeY, z: ridgeZ(1) + 1 }, { x: 0, y: D / 2 + o, z: -(ridgeZ(1) - eaveZ) }, { x: 0.05, y: 0, z: -2.5 }, look.roof === 'thatch' ? THATCH_DARK : BLACK_OAK);
  for (let i = 0; i < STRIPS; i++) {
    const t0 = i / STRIPS;
    const t1 = (i + 1) / STRIPS;
    const cap = look.roof === 'thatch' ? THATCH_DARK : look.roof === 'slate' ? darken(SLATE, 0.7) : darken(SHINGLE, 0.7);
    m.box(rx0 + rLen * t0, ridgeY - 0.07, ridgeZ((t0 + t1) / 2) - 1.5, rLen * (t1 - t0) + 0.01, 0.14, 3, { top: lighten(cap, 0.1), left: cap, right: darken(cap, 0.8) });
  }
  if (look.crow !== undefined) {
    // A crow hunched on the ridge.
    const cx = rx0 + rLen * look.crow;
    const cz = ridgeZ(look.crow) + 1;
    m.box(cx, ridgeY - 0.05, cz, 0.16, 0.1, 5, { top: 0x2a2630, left: 0x16141a, right: 0x0e0c10 });
    m.box(cx + 0.12, ridgeY - 0.04, cz + 4, 0.08, 0.08, 3, { top: 0x2a2630, left: 0x16141a, right: 0x0e0c10 });
    m.box(cx + 0.19, ridgeY, cz + 5, 0.05, 0.03, 1, { top: 0x5a5048, left: 0x5a5048, right: 0x3a342e });
  }

  // ---- Things on the front.
  const fy = y0 + D;
  if (look.lantern && look.door) {
    const lx = x0 + W * look.door[1] + 0.14 + lean * 0.5;
    m.box(lx, fy, zb + 30, 0.03, 0.14, 1, { top: IRON, left: IRON, right: IRON });
    m.box(lx - 0.04, fy + 0.08, zb + 22, 0.1, 0.1, 7, {
      top: IRON,
      left: (u, v) => (u < 0.2 || u > 0.8 || v < 0.15 || v > 0.85 ? IRON : LIT_HOT),
      right: (u, v) => (u < 0.2 || u > 0.8 || v < 0.15 || v > 0.85 ? IRON : LIT),
    });
  }
  if (look.sign && look.door) {
    const sx = x0 + W * ((look.door[0] + look.door[1]) / 2) + lean * 0.3;
    // An iron arm out over the door, and the board hanging from it on two short chains.
    m.box(sx, fy, top - 10, 0.04, 0.7, 2, { top: IRON_LIGHT, left: IRON, right: IRON });
    m.quad({ x: sx, y: fy, z: top - 20 }, { x: 0, y: 0.32, z: 0 }, { x: 0, y: 0, z: 10 }, (u, v) => (Math.abs(v - u) < 0.14 ? IRON : null));
    for (const dy of [0.2, 0.6]) m.box(sx, fy + dy, top - 13, 0.02, 0.02, 3, { top: IRON, left: IRON, right: IRON });
    m.quad({ x: sx, y: fy + 0.12, z: top - 13 }, { x: 0, y: 0.56, z: 0 }, { x: 0, y: 0, z: -16 }, (u, v) => signFace(look.sign!, u, v));
  }
  if (look.leanTo) {
    // A lean-to of grey boards against the side wall, its roof of a few warped planks.
    const lx = x0 + W + lean * 0.4;
    m.box(lx, y0 + 0.3, zb, 0.7, D - 0.5, 20, {
      top: GREYBOARD,
      left: (u, v) => (Math.floor(u * 7) % 2 ? GREYBOARD_DARK : GREYBOARD) + (v > 0.85 ? 0 : 0),
      right: (u) => (Math.floor(u * 9) % 2 ? darken(GREYBOARD_DARK, 0.8) : darken(GREYBOARD, 0.75)),
    });
    m.quad({ x: lx - 0.05, y: y0 + 0.2, z: zb + 30 }, { x: 0, y: D - 0.3, z: 0 }, { x: 0.9, y: 0, z: -11 }, (u) => (Math.floor(u * 8) % 2 ? OAK_DARK : DEADWOOD));
  }
  if (lift > 0 && look.door) {
    // A ladder up to the landing from the ground in front of the door.
    const ax = x0 + W * ((look.door[0] + look.door[1]) / 2) - 0.12;
    for (const dx of [0, 0.26]) line(m, { x: ax + dx, y: fy + 0.9, z: 0 }, { x: ax + dx, y: fy + 0.42, z: lift }, OAK_DARK, 0.04);
    for (let r = 4; r < lift; r += 6) {
      const t = r / lift;
      m.box(ax, fy + 0.9 - t * 0.48, r, 0.3, 0.04, 1.5, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
    }
  }
  return m;
}

// ---------------------------------------------------------------- signs

type Emblem = 'rose' | 'pestle' | 'candle' | 'balls' | 'blank' | 'cleaver' | 'hide' | 'rat';

/**
 * A painted board, bordered, with its trade on it: the Black Rose's black rose,
 * a mortar and pestle for the apothecary, a candle for the chandler, and three
 * brass balls for the pawnbroker.
 */
function signFace(e: Emblem, u: number, v: number): number | null {
  if (u < 0.05 || u > 0.95 || v < 0.06 || v > 0.94) return BLACK_OAK;
  if (u < 0.09 || u > 0.91 || v < 0.11 || v > 0.89) return e === 'rose' ? 0x8a7a3a : 0x5a4a32;
  const ground = e === 'rose' ? 0x2a2a2e : e === 'pestle' ? 0x3e4a38 : e === 'candle' ? 0x4a3a2a : 0x2e2a3a;
  const cu = u - 0.5;
  switch (e) {
    case 'rose': {
      // A black rose, petals ringed in dull red, on a stem with two leaves.
      const r = Math.hypot(cu * 1.2, (v - 0.4) * 1.1);
      const ang = Math.atan2(v - 0.4, cu);
      const petal = 0.17 + 0.03 * Math.sin(ang * 5);
      if (r < petal) {
        const ring = Math.sin(r * 60 + ang * 2);
        return ring > 0.6 ? 0x5a1a1e : 0x0e0a0c;
      }
      if (r < petal + 0.025) return 0x6a2026;
      if (v > 0.55 && v < 0.85 && Math.abs(cu + (v - 0.7) * 0.2) < 0.025) return 0x2a3a22;
      if (Math.hypot(cu + 0.1, (v - 0.68) * 1.8) < 0.07 || Math.hypot(cu - 0.1, (v - 0.74) * 1.8) < 0.07) return 0x3a4a2a;
      return ground;
    }
    case 'pestle': {
      // A mortar bowl, a pestle in it at a slant.
      if (v > 0.5 && v < 0.78 && Math.abs(cu) < 0.26 - (v - 0.5) * 0.35) return v < 0.56 ? 0xc8c0a8 : 0x9a9280;
      if (Math.abs(cu - (0.5 - v) * 0.45 - 0.04) < 0.05 && v > 0.2 && v < 0.6) return 0x8a6a44;
      return ground;
    }
    case 'candle': {
      if (Math.abs(cu) < 0.08 && v > 0.42 && v < 0.82) return cu < -0.03 ? 0xf0e6c8 : 0xd0c4a0;
      if (Math.hypot(cu * 2, (v - 0.32) * 1.2) < 0.1) return v < 0.3 ? 0xfff0b0 : 0xf0a040;
      if (Math.abs(cu) < 0.2 && v > 0.82 && v < 0.86) return 0xb08a3a;
      return ground;
    }
    case 'cleaver': {
      // The Shambles' butcher: a cleaver, blade down, over a pig's head (see art/shambles.ts).
      if (cu > -0.24 && cu < 0.14 && v > 0.22 && v < 0.5) return v < 0.26 || cu > 0.1 ? 0x8a8e98 : cu < -0.18 ? 0xe0e4ec : 0xb8bcc6;
      if (cu >= 0.14 && cu < 0.36 && Math.abs(v - 0.3) < 0.04) return 0x5a3a22;
      if (Math.hypot(cu * 1.3, (v - 0.7) * 1.6) < 0.18) return Math.hypot(cu * 1.3 - 0.06, (v - 0.68) * 1.6) < 0.03 ? 0x2a1a1a : 0xd8a090;
      return 0x4a2420;
    }
    case 'hide': {
      // The tanner's: a hide stretched out flat, legs and all.
      const hx = Math.abs(cu);
      const body = hx < 0.2 - Math.abs(v - 0.5) * 0.2 && v > 0.22 && v < 0.8;
      const legs = (Math.abs(v - 0.3) < 0.05 || Math.abs(v - 0.72) < 0.05) && hx < 0.32;
      if (body || legs) return (Math.floor(u * 30) + Math.floor(v * 30)) % 7 === 0 ? 0x8a5a32 : 0xb07a48;
      return 0x3a3426;
    }
    case 'rat': {
      // The rat-catcher's: a rat in profile, tail curled.
      const r = Math.hypot((cu + 0.04) * 1.1, (v - 0.55) * 2.2);
      if (r < 0.2) return Math.hypot(cu + 0.18, v - 0.5) < 0.03 ? 0xe04030 : 0x5a5048;
      if (Math.hypot(cu + 0.24, (v - 0.48) * 1.4) < 0.07) return 0x6a6058;
      if (Math.abs(Math.hypot(cu - 0.26, v - 0.45) - 0.12) < 0.02 && cu > 0.14) return 0xc89a8a;
      return 0x3a4030;
    }
    case 'balls': {
      for (const [bx, by] of [[0.35, 0.36], [0.65, 0.36], [0.5, 0.64]]) {
        const d = Math.hypot(u - bx, v - by);
        if (d < 0.12) return d < 0.05 && u < bx ? 0xf8e0a0 : u + v < bx + by ? 0xd8a848 : 0x9a7428;
      }
      return ground;
    }
    default:
      return ground;
  }
}

// ---------------------------------------------------------------- the houses

/** Every house in town is one of these, dressed differently (and some placed mirrored). */
const HOUSES: Record<string, HovelLook> = {
  // Two storeys of sooty plaster and black oak, the slate roof sagging badly; a lit window up, one boarded down.
  'gh-house-0': {
    seed: 3, size: 3, H: 74, R: 40, walls: 'plaster', roof: 'slate', lean: 0.12, sag: 7,
    front: [{ u0: 0.08, u1: 0.3, y0: 12, y1: 30, pane: 'lit' }, { u0: 0.68, u1: 0.9, y0: 12, y1: 30, pane: 'dark' }, { u0: 0.7, u1: 0.9, y0: 44, y1: 60, pane: 'boarded' }],
    side: [{ u0: 0.35, u1: 0.6, y0: 14, y1: 30, pane: 'shuttered' }],
    door: [0.38, 0.58], chimney: { at: 0.15, lean: 0.25 }, lantern: true, crow: 0.7,
  },
  // A low cottage of tarred boards under rotting thatch with a hole in it.
  'gh-house-1': {
    seed: 7, size: 3, H: 40, R: 42, walls: 'boards', roof: 'thatch', lean: -0.08, sag: 6,
    front: [{ u0: 0.7, u1: 0.88, y0: 10, y1: 24, pane: 'lit' }],
    side: [{ u0: 0.4, u1: 0.6, y0: 10, y1: 22, pane: 'boarded' }],
    door: [0.3, 0.5], chimney: { at: 0.85, lean: -0.2 }, hole: [0.25, 0.45], leanTo: true,
  },
  // Two storeys of black boards, shingled, a tarpaulin over the roof, every window shuttered but one.
  'gh-house-2': {
    seed: 11, size: 3, H: 70, R: 36, walls: 'boards', roof: 'shingle', lean: 0.18, sag: 5,
    front: [{ u0: 0.1, u1: 0.28, y0: 12, y1: 28, pane: 'shuttered' }, { u0: 0.62, u1: 0.8, y0: 12, y1: 28, pane: 'lit' }, { u0: 0.1, u1: 0.28, y0: 42, y1: 56, pane: 'broken' }],
    side: [{ u0: 0.2, u1: 0.4, y0: 14, y1: 28, pane: 'dark' }, { u0: 0.6, u1: 0.8, y0: 42, y1: 56, pane: 'shuttered' }],
    door: [0.42, 0.6], chimney: { at: 0.2, lean: 0.35 }, tarp: 0.62,
  },
  // Rubble stone below and above, the oldest house in town, slate roof, dead ivy up the front.
  'gh-house-3': {
    seed: 17, size: 3, H: 58, R: 38, walls: 'stone', roof: 'slate', lean: 0.05, sag: 4,
    front: [{ u0: 0.12, u1: 0.3, y0: 10, y1: 26, pane: 'dark' }, { u0: 0.68, u1: 0.86, y0: 10, y1: 26, pane: 'lit' }],
    side: [{ u0: 0.4, u1: 0.6, y0: 12, y1: 26, pane: 'barred' }],
    door: [0.4, 0.58], chimney: { at: 0.8, lean: 0.1 }, creeper: 0.2, crow: 0.3,
  },
  // A tall, narrow plaster house that has gone over badly, held up by its neighbours (and a lean-to).
  'gh-house-4': {
    seed: 23, size: 3, H: 78, R: 44, walls: 'plaster', roof: 'shingle', lean: 0.3, sag: 9,
    front: [{ u0: 0.12, u1: 0.32, y0: 12, y1: 30, pane: 'boarded' }, { u0: 0.66, u1: 0.86, y0: 12, y1: 30, pane: 'lit' }, { u0: 0.66, u1: 0.86, y0: 46, y1: 62, pane: 'shuttered' }],
    side: [{ u0: 0.3, u1: 0.5, y0: 14, y1: 30, pane: 'dark' }],
    door: [0.4, 0.58], chimney: { at: 0.5, lean: -0.3 }, leanTo: true, hole: [0.7, 0.35],
  },
  // A boarded cottage under shingles, a lantern at the door; the tidiest house in Gloomhaven, which isn't saying much.
  'gh-house-5': {
    seed: 29, size: 3, H: 44, R: 38, walls: 'boards', roof: 'shingle', lean: 0.06, sag: 3,
    front: [{ u0: 0.1, u1: 0.28, y0: 10, y1: 24, pane: 'lit' }, { u0: 0.72, u1: 0.9, y0: 10, y1: 24, pane: 'lit' }],
    side: [{ u0: 0.4, u1: 0.6, y0: 12, y1: 24, pane: 'shuttered' }],
    door: [0.42, 0.6], chimney: { at: 0.25, lean: 0.15 }, lantern: true,
  },
  // Up on stilts over a pool, of grey and black boards, thatched, a ladder up to its door.
  'gh-stilthouse': {
    seed: 31, size: 3, H: 36, R: 36, walls: 'boards', roof: 'thatch', lean: 0.1, sag: 6, stilts: 26,
    front: [{ u0: 0.12, u1: 0.3, y0: 8, y1: 22, pane: 'lit' }],
    side: [{ u0: 0.4, u1: 0.6, y0: 8, y1: 20, pane: 'shuttered' }],
    door: [0.5, 0.68], chimney: { at: 0.8, lean: 0.2 }, crow: 0.35,
  },
  // Hovels: one room of boards under a few shingles or a heap of thatch.
  'gh-shack-0': {
    seed: 37, size: 2, H: 30, R: 26, walls: 'boards', roof: 'shingle', lean: 0.12, sag: 4,
    front: [{ u0: 0.66, u1: 0.88, y0: 8, y1: 18, pane: 'boarded' }], side: [],
    door: [0.24, 0.5], tarp: 0.4,
  },
  'gh-shack-1': {
    seed: 41, size: 2, H: 28, R: 28, walls: 'boards', roof: 'thatch', lean: -0.1, sag: 5,
    front: [{ u0: 0.64, u1: 0.88, y0: 8, y1: 18, pane: 'lit' }], side: [{ u0: 0.4, u1: 0.62, y0: 8, y1: 18, pane: 'dark' }],
    door: [0.2, 0.46], chimney: { at: 0.15, lean: 0.1 },
  },
};

// ---------------------------------------------------------------- the shops

/**
 * A shopfront on the front face of a house: the window's lower half let down
 * as a counter on two chains, with the goods set out on it and hung in the
 * opening behind. `goods` paints what's on show.
 */
function shopfront(m: IsoModel, x: number, y: number, w: number, z: number, goods: (m: IsoModel, x: number, y: number, z: number, w: number) => void): void {
  // The counter: a board let down level on chains, and its brackets.
  m.box(x, y, z, w, 0.32, 2.5, {
    top: (u, v) => (Math.floor(u * 10) % 4 === 0 ? OAK_DARK : v > 0.8 ? OAK_LIGHT : OAK),
    left: OAK_DARK,
    right: darken(OAK_DARK, 0.8),
  });
  for (const dx of [0.04, w - 0.06]) line(m, { x: x + dx, y: y + 0.3, z: z + 2.5 }, { x: x + dx, y: y, z: z + 20 }, IRON, 0.02);
  goods(m, x, y, z + 2.5, w);
  // An awning of patched canvas over it, sagging.
  m.quad({ x: x - 0.08, y: y, z: z + 26 }, { x: w + 0.16, y: 0, z: 0 }, { x: 0, y: 0.5, z: -7 }, (u, v) => {
    if (v > 0.88 && Math.floor(u * 18) % 2 === 0) return null; // a ragged hem
    const stripe = Math.floor(u * 6) % 2;
    const c = stripe ? 0x4a3e2e : 0x3a4436;
    return hash(Math.floor(u * 10), Math.floor(v * 4)) < 0.1 ? PATCH : v > 0.8 ? darken(c, 0.8) : c;
  });
}

/** Where a shop's front wall stands (a 4-wide house squashed to 3 deep: see hovelSized). */
const SHOP_FRONT_Y = 0.22 + (4 - 0.54) * ((3 - 0.44) / (4 - 0.44));
/** The hatch behind a shop's counter, on the ground floor of a house `H` high. */
const hatch = (H: number): Opening => ({ u0: 0.44, u1: 0.74, y0: H - 36, y1: H - 13, pane: 'lit' });

/** Ossery's Remedies: a narrow leaning house of plaster and black oak, herbs drying in bunches under the eaves, jars on the counter. */
function apothecary(): IsoModel {
  const look: HovelLook = {
    seed: 53, size: 4, H: 80, R: 46, walls: 'plaster', roof: 'shingle', lean: 0.14, sag: 6,
    front: [{ u0: 0.06, u1: 0.2, y0: 14, y1: 32, pane: 'lit' }, { u0: 0.78, u1: 0.94, y0: 14, y1: 32, pane: 'lit' }, { u0: 0.46, u1: 0.7, y0: 22, y1: 38, pane: 'lit' }, hatch(80)],
    side: [{ u0: 0.3, u1: 0.52, y0: 16, y1: 34, pane: 'shuttered' }],
    door: [0.24, 0.38], chimney: { at: 0.15, lean: 0.2 }, sign: 'pestle', creeper: 0.95,
  };
  // The hovel's width is fixed by its size, so a four-wide, three-deep shop is built on a 4 and trimmed: see below.
  const m = hovelSized(look, 4, 3);
  const fy = SHOP_FRONT_Y;
  shopfront(m, 4 * 0.44 + 0.08, fy, 1.05, 12, (mm, x, y, z, w) => {
    // Jars: green glass, brown glass, one of leeches, one of something pale floating.
    const jars = [0x3e6a4a, 0x6a4a2a, 0x2a2a30, 0xa8b098, 0x5a7a6a];
    jars.forEach((c, i) => {
      const jx = x + 0.12 + (i / jars.length) * (w - 0.2);
      mm.cylinder(jx, y + 0.16, z, 0.06, 6 + (i % 2) * 2, (u, v) => (v < 0.15 ? 0x8a6a4a : u < 0.3 ? lighten(c, 0.3) : c), 0x8a6a4a);
    });
    // Bunches of herbs hung upside down in the opening above.
    for (let i = 0; i < 5; i++) {
      const hx = x + 0.1 + i * (w - 0.2) / 4;
      line(mm, { x: hx, y: y + 0.02, z: z + 22 }, { x: hx, y: y + 0.02, z: z + 17 }, 0x8a7a5a, 0.01);
      mm.box(hx - 0.04, y, z + 10, 0.08, 0.05, 7, { top: 0x6a7a3a, left: i % 2 ? 0x5a6e30 : 0x7a6a3a, right: 0x3e4a22 });
    }
  });
  return m;
}

/** Tallow's Chandlery: squat and tarred, candles in every window, lanterns and coils of rope hung out front. */
function chandler(): IsoModel {
  const look: HovelLook = {
    seed: 59, size: 4, H: 52, R: 40, walls: 'boards', roof: 'thatch', lean: -0.06, sag: 5,
    front: [{ u0: 0.06, u1: 0.22, y0: 10, y1: 26, pane: 'lit' }, { u0: 0.8, u1: 0.95, y0: 10, y1: 26, pane: 'lit' }, hatch(52)],
    side: [{ u0: 0.3, u1: 0.5, y0: 12, y1: 26, pane: 'lit' }],
    door: [0.24, 0.38], chimney: { at: 0.85, lean: -0.15 }, sign: 'candle', lantern: true,
  };
  const m = hovelSized(look, 4, 3);
  const fy = SHOP_FRONT_Y;
  shopfront(m, 4 * 0.44 + 0.08, fy, 1.05, 12, (mm, x, y, z, w) => {
    // Candles in bundles, tallow-yellow; a lantern; a tin of oil.
    for (let i = 0; i < 6; i++) {
      const cx = x + 0.1 + i * 0.1;
      mm.box(cx, y + 0.12, z, 0.04, 0.04, 6 + (i % 3), { top: 0xf0e0a8, left: 0xe0cc90, right: 0xb8a070 });
    }
    mm.box(x + w - 0.36, y + 0.08, z, 0.14, 0.14, 9, {
      top: IRON,
      left: (u, v) => (u < 0.2 || u > 0.8 || v < 0.15 || v > 0.85 ? IRON : LIT),
      right: (u, v) => (u < 0.2 || u > 0.8 || v < 0.15 || v > 0.85 ? IRON : LIT_DEEP),
    });
    mm.cylinder(x + w - 0.12, y + 0.16, z, 0.07, 7, (u) => (u < 0.3 ? 0x9a9aa4 : 0x6a6a74), 0x5a5a64);
    // Lanterns and rope hung in the opening.
    for (const [dx, h] of [[0.15, 7], [0.5, 9], [0.85, 7]] as const) {
      line(mm, { x: x + dx * w, y: y + 0.02, z: z + 22 }, { x: x + dx * w, y: y + 0.02, z: z + 16 }, IRON, 0.01);
      if (dx === 0.5) mm.cylinder(x + dx * w, y + 0.06, z + 9, 0.12, h, (u, v) => ((v * 6) % 1 < 0.3 ? 0x8a764e : u < 0.4 ? 0xc0a878 : 0xa08a5a), 0xc0a878);
      else mm.box(x + dx * w - 0.05, y, z + 10, 0.1, 0.08, 6, { top: IRON, left: (u, v) => (u > 0.2 && u < 0.8 && v > 0.2 && v < 0.8 ? 0x5a4a2a : IRON), right: IRON });
    }
  });
  return m;
}

/** Lusk's: tall and thin, three storeys of black boards, iron bars on its windows, three brass balls over the door. */
function pawnshop(): IsoModel {
  const look: HovelLook = {
    seed: 61, size: 4, H: 104, R: 42, walls: 'boards', roof: 'slate', lean: 0.1, sag: 4,
    front: [
      { u0: 0.06, u1: 0.22, y0: 12, y1: 30, pane: 'barred' }, { u0: 0.78, u1: 0.94, y0: 12, y1: 30, pane: 'dark' },
      { u0: 0.06, u1: 0.22, y0: 44, y1: 62, pane: 'shuttered' }, { u0: 0.78, u1: 0.94, y0: 44, y1: 62, pane: 'barred' }, hatch(104),
    ],
    side: [{ u0: 0.3, u1: 0.5, y0: 14, y1: 30, pane: 'barred' }, { u0: 0.3, u1: 0.5, y0: 46, y1: 62, pane: 'dark' }],
    door: [0.26, 0.4], chimney: { at: 0.2, lean: 0.1 }, sign: 'balls', crow: 0.8,
  };
  const m = hovelSized(look, 4, 3);
  const fy = SHOP_FRONT_Y;
  shopfront(m, 4 * 0.44 + 0.08, fy, 1.05, 12, (mm, x, y, z, w) => {
    // Odds and ends: a candlestick, a little box, a helmet, a jug, a fiddle.
    mm.cylinder(x + 0.12, y + 0.14, z, 0.03, 9, () => 0xc8a048, 0xecca70);
    block(mm, x + 0.22, y + 0.06, z, 0.18, 0.14, 4, 0x6a3a2a);
    mm.cylinder(x + 0.52, y + 0.16, z, 0.1, 4, (u) => (u < 0.3 ? 0x8a8a92 : 0x5e5e66), 0x8a8a92);
    mm.cylinder(x + 0.52, y + 0.16, z + 4, 0.07, 2, () => 0x8a8a92, 0xb0b0ba);
    mm.cylinder(x + 0.74, y + 0.16, z, 0.07, 7, (u) => (u < 0.3 ? 0xb88a5a : 0x8a5a3a), 0x6a4428);
    mm.box(x + 0.86, y + 0.04, z, 0.12, 0.05, 12, { top: 0x7a4428, left: 0x9a5a32, right: 0x5a3018 });
    // A birdcage and a pair of boots hung up in the opening.
    line(mm, { x: x + 0.3 * w, y: y + 0.02, z: z + 22 }, { x: x + 0.3 * w, y: y + 0.02, z: z + 18 }, IRON, 0.01);
    mm.cylinder(x + 0.3 * w, y + 0.06, z + 11, 0.09, 7, (u) => (Math.floor(u * 8) % 2 ? IRON_LIGHT : null) as number, IRON);
  });
  return m;
}

/**
 * A hovel on a footprint that isn't square: built as a square house of the
 * larger size, then its back trimmed off (the walls' depth is cut to fit).
 */
export function hovelSized(look: HovelLook, w: number, d: number): IsoModel {
  // The square builder lays the house out to its size each way; for a w x d shop, build it at w and squash y.
  const sq = hovel({ ...look, size: w });
  if (w === d) return sq;
  const k = (d - 0.44) / (w - 0.44);
  return squashY(sq, k, 0.22);
}

/** Scales a model's y about y0 (so a square house fits a shallower plot). */
function squashY(m: IsoModel, k: number, y0: number): IsoModel {
  type Face = { origin: Vec3; du: Vec3; dv: Vec3 };
  const faces = (m as unknown as { faces: Face[] }).faces;
  for (const f of faces) {
    f.origin = { ...f.origin, y: y0 + (f.origin.y - y0) * k };
    f.du = { ...f.du, y: f.du.y * k };
    f.dv = { ...f.dv, y: f.dv.y * k };
  }
  return m;
}

// ---------------------------------------------------------------- the Black Rose

/**
 * The Black Rose (10 x 7): two storeys and a garret of black oak over plaster
 * gone the grey of old ash, the upper floor jettied out over the lower; a steep
 * slate roof with three dormers and three tall chimneys; leaded windows lit red
 * and gold; a gallery on carved posts over the great door, with lanterns at
 * either side of it; a boarded side door to the yard; and its sign, a black rose,
 * hanging from an iron arm at the corner. The best-kept building in Gloomhaven,
 * and it still looks like it's watching you.
 */
function blackRose(): IsoModel {
  const m = new IsoModel();
  const x0 = 0.2;
  const y0 = 0.25;
  const W = 9.6;
  const D = 6.4;
  const foot = 8;
  const H1 = 46; // the ground floor
  const H2 = 44; // the jettied upper floor
  const jet = 0.28; // how far it sticks out over the ground floor
  const R = 74;
  const top = foot + H1 + H2;
  const ridgeY = y0 + D / 2;
  const o = 0.32;
  const roof = rotSlate(77);

  // Back slope of the roof, and the chimneys through it (west, middle, east).
  m.quad({ x: x0 - o - jet, y: ridgeY, z: top + R }, { x: W + o * 2 + jet * 2, y: 0, z: 0 }, { x: 0, y: -D / 2 - o - jet, z: -R - 8 }, roof);
  chimney(m, x0 + 1.1, y0 + 1.6, foot, H1 + H2 + R + 30, 0.08, 0.7);
  chimney(m, x0 + 4.7, y0 + 1.6, foot, H1 + H2 + R + 40, -0.05, 0.6);
  chimney(m, x0 + 8.1, y0 + 1.8, foot, H1 + H2 + R + 22, 0.18, 0.6);

  // The footing: dressed stone, the only dressed stone in town.
  m.box(x0, y0, 0, W, D, foot, {
    top: STONE_LIGHT,
    left: (u, v) => ((u * 24) % 1 < 0.05 || v < 0.15 ? MORTAR : hash(Math.floor(u * 24), 1) < 0.3 ? STONE_DARK : STONE),
    right: (u, v) => ((u * 16) % 1 < 0.05 || v < 0.15 ? darken(MORTAR, 0.8) : STONE_DARK),
  });
  // Steps up to the door.
  for (let i = 0; i < 2; i++) m.box(x0 + 4.4 + i * 0.05, y0 + D + 0.3 - i * 0.3, 0, 1.2 - i * 0.1, 0.32, 3 + i * 3, { top: STONE_LIGHT, left: STONE, right: STONE_DARK });

  // ---- Ground floor: plaster and black oak, the bow windows and the great door.
  const groundFront = withDoor(
    withOpenings(plasterWall(9, H1, 81), H1, [
      { u0: 0.06, u1: 0.2, y0: 12, y1: 34, pane: 'red' }, { u0: 0.26, u1: 0.4, y0: 12, y1: 34, pane: 'red' },
      { u0: 0.62, u1: 0.76, y0: 12, y1: 34, pane: 'red' }, { u0: 0.82, u1: 0.95, y0: 12, y1: 34, pane: 'lit' },
    ]),
    H1, 0.445, 0.555, 34,
  );
  const groundSide = withDoor(withOpenings(plasterWall(6, H1, 83), H1, [{ u0: 0.12, u1: 0.3, y0: 12, y1: 32, pane: 'red' }, { u0: 0.62, u1: 0.8, y0: 14, y1: 32, pane: 'shuttered' }]), H1, 0.4, 0.52, 30);
  // The side door to the yard, boarded: planks nailed across the frame.
  const sideDoorBoarded: Shader = (u, v) => {
    const y = v * H1;
    if (u > 0.4 && u < 0.52 && y > H1 - 30 && y < H1 - 2) {
      if (Math.abs(((y - (H1 - 30)) / 7) % 1 - 0.5) < 0.18) return GREYBOARD;
    }
    return groundSide(u, v);
  };
  m.quad({ x: x0 + W, y: y0, z: foot + H1 }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: -H1 }, (u, v) => darken(sideDoorBoarded(u, v) ?? PLASTER, 0.72));
  m.quad({ x: x0, y: y0 + D, z: foot + H1 }, { x: W, y: 0, z: 0 }, { x: 0, y: 0, z: -H1 }, groundFront);
  // Bow windows bulging out under the two pairs of windows on the front.
  for (const [a, b] of [[0.05, 0.41], [0.61, 0.96]]) {
    const bx = x0 + W * a;
    const bw = W * (b - a);
    m.box(bx, y0 + D, foot, bw, 0.3, 8, { top: STONE_LIGHT, left: rubbleStone(91, 4, 1), right: STONE_DARK });
    const panes = (dim: number): Shader => (u, v) => {
      if (v < 0.08 || v > 0.92 || u < 0.03 || u > 0.97 || (u * 7) % 1 < 0.08) return darken(BLACK_OAK, dim);
      const cu = ((u * 14) % 1) - 0.5;
      const cv = ((v * 4) % 1) - 0.5;
      const r = cu * cu + cv * cv;
      if (r < 0.03) return 0xffe8b0;
      return darken(r < 0.1 ? LIT : r < 0.18 ? ROSE_GLASS : LIT_DEEP, dim);
    };
    m.box(bx, y0 + D, foot + 8, bw, 0.3, 18, { top: OAK_DARK, left: panes(1), right: panes(0.75) });
    m.quad({ x: bx - 0.05, y: y0 + D, z: foot + 30 }, { x: bw + 0.1, y: 0, z: 0 }, { x: 0, y: 0.42, z: -5 }, rotSlate(93));
  }

  // ---- The jettied upper floor: out over the ground floor on the front and side, on the ends of the joists.
  const ux = x0 - jet;
  const uw = W + jet * 2;
  const uy = y0 - jet;
  const ud = D + jet * 2;
  const upperFront = withOpenings(plasterWall(10, H2, 85), H2, [
    { u0: 0.05, u1: 0.15, y0: 10, y1: 30, pane: 'lit' }, { u0: 0.22, u1: 0.32, y0: 10, y1: 30, pane: 'red' },
    { u0: 0.68, u1: 0.78, y0: 10, y1: 30, pane: 'shuttered' }, { u0: 0.85, u1: 0.95, y0: 10, y1: 30, pane: 'red' },
  ]);
  const upperSide = withOpenings(plasterWall(7, H2, 87), H2, [{ u0: 0.15, u1: 0.3, y0: 10, y1: 30, pane: 'lit' }, { u0: 0.62, u1: 0.77, y0: 10, y1: 30, pane: 'dark' }]);
  // The joist ends under the overhang.
  for (let i = 0; i < 24; i++) block(m, ux + 0.2 + i * (uw - 0.4) / 23, y0 + D, foot + H1 - 3, 0.1, jet, 3, BLACK_OAK_LIGHT, BLACK_OAK);
  for (let i = 0; i < 16; i++) block(m, x0 + W, uy + 0.3 + i * (ud - 0.6) / 15, foot + H1 - 3, jet, 0.1, 3, BLACK_OAK_LIGHT, BLACK_OAK);
  m.quad({ x: ux + uw, y: uy, z: top }, { x: 0, y: ud, z: 0 }, { x: 0, y: 0, z: -H2 }, (u, v) => darken(upperSide(u, v) ?? PLASTER, 0.72));
  m.quad({ x: ux, y: uy + ud, z: top }, { x: uw, y: 0, z: 0 }, { x: 0, y: 0, z: -H2 }, upperFront);
  // The bressumer beam along the foot of the jetty, carved with a running pattern of roses.
  m.box(ux, uy + ud - 0.08, foot + H1, uw, 0.1, 4, {
    top: BLACK_OAK_LIGHT,
    left: (u, v) => (Math.hypot(((u * 40) % 1) - 0.5, (v - 0.5) * 0.6) < 0.22 ? 0x4a1a1e : v < 0.3 ? BLACK_OAK_LIGHT : BLACK_OAK),
    right: BLACK_OAK,
  });
  m.box(ux + uw - 0.08, uy, foot + H1, 0.1, ud, 4, { top: BLACK_OAK_LIGHT, left: BLACK_OAK, right: darken(BLACK_OAK, 0.8) });

  // ---- The gallery over the door: a little balcony on two carved posts, railed, roofed.
  const gx = x0 + W * 0.4;
  const gw = W * 0.2;
  const gy = y0 + D + jet;
  for (const px of [gx + 0.1, gx + gw - 0.1]) post(m, px, gy + 0.55, 0.07, foot + H1 + 10);
  m.box(gx, gy, foot + H1 + 8, gw, 0.62, 3, { top: (u) => (Math.floor(u * 16) % 2 ? OAK_DARK : OAK), left: BLACK_OAK, right: BLACK_OAK });
  // The rail and its balusters.
  m.box(gx, gy + 0.58, foot + H1 + 20, gw, 0.05, 2, { top: BLACK_OAK_LIGHT, left: BLACK_OAK, right: BLACK_OAK });
  m.quad({ x: gx, y: gy + 0.6, z: foot + H1 + 20 }, { x: gw, y: 0, z: 0 }, { x: 0, y: 0, z: -9 }, (u) => ((u * 22) % 1 < 0.3 ? BLACK_OAK_LIGHT : null));
  m.quad({ x: gx - 0.1, y: gy - 0.1, z: top + 6 }, { x: gw + 0.2, y: 0, z: 0 }, { x: 0, y: 0.85, z: -12 }, rotSlate(95));
  // Lanterns either side of the door, on iron arms.
  for (const dx of [-0.95, 0.95]) {
    const lx = x0 + W / 2 + dx;
    m.box(lx, y0 + D, foot + 34, 0.04, 0.2, 1.5, { top: IRON, left: IRON, right: IRON });
    m.box(lx - 0.06, y0 + D + 0.12, foot + 24, 0.14, 0.14, 9, {
      top: IRON,
      left: (u, v) => (u < 0.2 || u > 0.8 || v < 0.12 || v > 0.88 ? IRON : v < 0.4 ? LIT_HOT : ROSE_GLASS),
      right: (u, v) => (u < 0.2 || u > 0.8 || v < 0.12 || v > 0.88 ? IRON : ROSE_RED),
    });
  }

  // ---- The gable end over the east side, and three dormers through the front of the roof.
  m.quad({ x: ux + uw, y: uy, z: top }, { x: 0, y: ud, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => {
    const half = Math.abs(u - 0.5) * 2;
    if (v > 1 - half) return null;
    if (v > 0.22 && v < 0.5 && Math.abs(u - 0.5) < 0.07) return windowPixel({ u0: 0, u1: 1, y0: 0, y1: 1, pane: 'lit' }, (u - 0.43) / 0.14, 1 - (v - 0.22) / 0.28, BLACK_OAK);
    if (Math.abs(u - 0.5) < 0.015 || (v < 0.05)) return darken(BLACK_OAK, 0.8);
    return darken(plasterWall(3, R, 89)(u, 1 - v) ?? PLASTER, 0.7);
  });
  m.quad({ x: ux - o, y: ridgeY, z: top + R }, { x: uw + o * 2, y: 0, z: 0 }, { x: 0, y: ud / 2 + o, z: -R - 8 }, roof);
  m.quad({ x: ux + uw + o, y: ridgeY, z: top + R + 1 }, { x: 0, y: ud / 2 + o, z: -R - 8 }, { x: 0.06, y: 0, z: -3 }, BLACK_OAK);
  m.box(ux - o, ridgeY - 0.08, top + R - 2, uw + o * 2, 0.16, 4, { top: lighten(SLATE, 0.1), left: darken(SLATE, 0.7), right: darken(SLATE, 0.55) });
  for (const at of [0.2, 0.5, 0.8]) {
    // A dormer: a little gabled window standing out of the slope.
    const dx = ux + uw * at - 0.45;
    const dy = ridgeY + 1.2;
    const dz = top + R * 0.42;
    m.box(dx, dy, dz - 6, 0.9, 1.2, 24, {
      top: SLATE,
      left: (u, v) => windowPixel({ u0: 0, u1: 1, y0: 0, y1: 1, pane: at === 0.5 ? 'red' : 'lit' }, (u - 0.18) / 0.64, (v - 0.2) / 0.62, BLACK_OAK) ?? PLASTER,
      right: darken(PLASTER, 0.7),
    });
    m.quad({ x: dx - 0.08, y: dy + 0.6, z: dz + 26 }, { x: 0.53, y: 0, z: 0 }, { x: 0, y: 0.75, z: -9 }, rotSlate(97));
    m.quad({ x: dx + 0.45, y: dy + 0.6, z: dz + 26 }, { x: 0.53, y: 0, z: -9 }, { x: 0, y: 0.75, z: 0 }, (u, v) => darken(rotSlate(99)(u, v) ?? SLATE, 0.75));
  }

  // ---- The sign: a big board on a long scrolled iron arm at the west corner, the black rose on it.
  const sx = ux + 0.25;
  const sy = uy + ud;
  m.box(sx, sy, top - 4, 0.05, 1.3, 2, { top: IRON_LIGHT, left: IRON, right: IRON });
  m.quad({ x: sx, y: sy, z: top - 18 }, { x: 0, y: 0.55, z: 0 }, { x: 0, y: 0, z: 14 }, (u, v) => (Math.abs(v - u) < 0.12 || Math.hypot(u - 0.3, v - 0.75) < 0.12 ? IRON : null));
  for (const dy of [0.45, 1.15]) m.box(sx, sy + dy, top - 8, 0.02, 0.02, 4, { top: IRON, left: IRON, right: IRON });
  m.quad({ x: sx, y: sy + 0.32, z: top - 8 }, { x: 0, y: 0.96, z: 0 }, { x: 0, y: 0, z: -30 }, (u, v) => signFace('rose', u, v));

  // ---- Dressing: a water butt by the side door, a crate, a bench along the front.
  m.cylinder(x0 + W + 0.32, y0 + D * 0.72, 0, 0.26, 18, (u, v) => (v < 0.08 || Math.abs(v - 0.55) < 0.05 || v > 0.92 ? IRON : Math.floor(u * 10) % 2 ? OAK : OAK_DARK), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.38 ? 0x1a2228 : OAK));
  m.box(x0 + 1.6, y0 + D + 0.32, 0, 1.2, 0.3, 9, { top: (u) => (Math.floor(u * 6) % 2 ? OAK : OAK_DARK), left: OAK_DARK, right: BLACK_OAK });
  return m;
}

// ---------------------------------------------------------------- the wall and the gate

/** A tile of the town wall, along x: a rubble footing, black stakes over it, two rails behind; `cut` varies it. */
function wallPiece(cut: number): IsoModel {
  const m = new IsoModel();
  // The stone footing first: knee high, mossy, slimy at the foot.
  m.box(0, 0.3, 0, 1, 0.4, 14, { top: (u) => (hash(Math.floor(u * 8), cut) < 0.5 ? MOSS : STONE), left: rubbleStone(cut * 7 + 1, 2.5, 2, 0.45), right: (u, v) => darken(rubbleStone(cut * 7 + 2, 2.5, 2)(u, v) ?? STONE, 0.75) });
  // Rails behind the stakes.
  for (const z of [26 + (cut % 2) * 2, 42]) m.box(0, 0.36, z, 1, 0.06, 3, { top: DEADWOOD_LIGHT, left: DEADWOOD, right: DEADWOOD_DARK });
  const n = 6 + (cut % 2);
  for (let i = 0; i < n; i++) {
    const k = cut * 17 + i;
    const r = 0.065 + hash(k, 1) * 0.02;
    const cx = (i + 0.5) / n + (hash(k, 2) - 0.5) * 0.03;
    const cy = 0.5;
    const h = 40 + Math.floor(hash(k, 3) * 10) - (hash(k, 4) < 0.15 ? 9 : 0);
    // Tarred black stakes, one here and there grey and newer.
    const grey = hash(k, 5) < 0.18;
    m.cylinder(cx, cy, 12, r, h, (u, v) => {
      const g = hash(Math.floor(v * 20), Math.floor(u * 3) + k);
      let c = grey ? (u < 0.3 ? DEADWOOD_LIGHT : u > 0.7 ? DEADWOOD_DARK : DEADWOOD) : u < 0.3 ? TAR_LIGHT : u > 0.7 ? TAR_DARK : TAR;
      if (g < 0.12) c = darken(c, 0.8);
      if (v > 0.8) c = mix(c, MOSS, 0.4);
      return c;
    }, TAR_LIGHT);
    // Sharpened tops, pale where they were cut.
    m.cylinder(cx, cy, 12 + h, r * 0.7, 3, () => (grey ? DEADWOOD_LIGHT : GREYBOARD), GREYBOARD);
    m.cylinder(cx, cy, 15 + h, r * 0.35, 3, () => GREYBOARD, OAK_LIGHT);
  }
  return m;
}

/** A stouter post in the wall, squared, capped with an iron spike. */
function wallPost(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.2, 0, 0.8, 0.6, 16, { top: MOSS, left: rubbleStone(5, 2, 2), right: (u, v) => darken(rubbleStone(6, 2, 2)(u, v) ?? STONE, 0.75) });
  m.box(0.32, 0.32, 16, 0.36, 0.36, 46, { top: TAR_LIGHT, left: (u, v) => (hash(Math.floor(v * 20), 3) < 0.1 ? TAR_DARK : u < 0.2 ? TAR_LIGHT : TAR), right: TAR_DARK });
  m.box(0.46, 0.46, 62, 0.08, 0.08, 9, { top: IRON_LIGHT, left: IRON, right: darken(IRON, 0.7) });
  return m;
}

/**
 * A corner tower of the wall (3 x 3): round, of rubble stone, with arrow slits,
 * a timber fighting platform on top under a cone of shingles, and a brazier's
 * glow up there at night.
 */
function wallTower(): IsoModel {
  const m = new IsoModel();
  const cx = 1.5;
  const cy = 1.5;
  const H = 96;
  const stone = rubbleStone(123, 9, 9, 0.4);
  m.cylinder(cx, cy, 0, 1.25, 8, (u, v) => darken(stone(u, v) ?? STONE, 0.9), STONE);
  m.cylinder(cx, cy, 8, 1.12, H - 8, (u, v) => {
    // Arrow slits, two up the lit side.
    if (Math.abs(u - 0.3) < 0.015 && ((v > 0.2 && v < 0.32) || (v > 0.55 && v < 0.67))) return 0x0c0a0a;
    const c = stone(u, v) ?? STONE;
    return u > 0.6 ? darken(c, 0.75 - (u - 0.6) * 0.3) : c;
  }, STONE_LIGHT);
  // The timber hoarding: a ring of boards jutting out at the top.
  m.cylinder(cx, cy, H, 1.3, 16, (u, v) => {
    if (v < 0.12) return OAK_DARK;
    if (Math.floor(u * 30) % 4 === 0 && v > 0.3 && v < 0.6) return 0x0c0a0a;
    const c = Math.floor(u * 40) % 2 ? TAR : TAR_LIGHT;
    return u > 0.6 ? darken(c, 0.75) : c;
  }, OAK_DARK);
  // The cone roof: stacked rings, each smaller.
  for (let i = 0; i < 10; i++) {
    const r = 1.42 * (1 - i / 10);
    m.cylinder(cx, cy, H + 16 + i * 4.2, Math.max(0.05, r), 4.6, (u, v) => {
      const c = rotShingle(131)(u, (i + v) / 10) ?? SHINGLE;
      return u > 0.6 ? darken(c, 0.72) : c;
    }, SHINGLE);
  }
  // A pole and a rag of a pennant at the top.
  m.box(cx - 0.03, cy - 0.03, H + 58, 0.06, 0.06, 14, { top: DEADWOOD, left: DEADWOOD, right: DEADWOOD_DARK });
  m.quad({ x: cx, y: cy, z: H + 72 }, { x: 0.5, y: -0.1, z: -2 }, { x: 0, y: 0, z: -5 }, (u, v) => (v > 1 - u * 0.5 ? null : 0x3a1418));
  return m;
}

/**
 * The gatehouse (6 x 2): two square stone towers either side of the way in,
 * crenellated, with a covered timber walk between them over a pair of great
 * oak gates, black and iron-studded, barred shut; torches in cressets on the
 * towers and a skull nailed over the gate.
 */
function gatehouse(open = false): IsoModel {
  const m = new IsoModel();
  const H = 92;
  const tower = (x: number) => {
    const stone = rubbleStone(141 + Math.floor(x * 10), 4, 10, 0.35);
    m.box(x, 0.05, 0, 1.6, 1.9, H, {
      top: STONE_DARK,
      left: (u, v) => (Math.abs(u - 0.5) < 0.04 && v > 0.25 && v < 0.4 ? 0x0c0a0a : stone(u, v)),
      right: (u, v) => darken(stone(u * 0.9, v) ?? STONE, 0.72),
    });
    // Crenellations.
    for (let i = 0; i < 3; i++) block(m, x + 0.05 + i * 0.55, 1.6, H, 0.4, 0.35, 9, STONE, STONE_DARK, STONE_LIGHT);
    for (let i = 0; i < 3; i++) block(m, x + 1.25, 0.1 + i * 0.6, H, 0.35, 0.4, 9, STONE, STONE_DARK, STONE_LIGHT);
    // A torch in an iron cresset on the front.
    m.box(x + 0.75, 1.95, 52, 0.1, 0.12, 6, { top: IRON, left: IRON, right: IRON });
    m.box(x + 0.76, 2.0, 58, 0.08, 0.08, 4, { top: LIT_HOT, left: LIT, right: LIT_DEEP });
  };
  tower(0);
  // The gates, between the towers: two great leaves of black oak, studded, and the bar across them.
  // Open (by Captain Vosk's leave), only the arch is left over the way through, and the road shows clear under it.
  if (open) {
    m.quad({ x: 1.6, y: 0.95, z: 64 }, { x: 2.8, y: 0, z: 0 }, { x: 0, y: 0, z: -12 }, (u, v) => {
      const y = v * 12;
      // The arch's stones, coming down a little at either side.
      if (y < 9) return Math.floor(u * 9) % 2 ? STONE : STONE_DARK;
      if (Math.min(u, 1 - u) < 0.06) return STONE_DARK;
      return null;
    });
    // The two leaves, swung right back inwards against the towers' inner faces, out of the way.
    for (const x of [1.6, 4.32]) {
      m.box(x, 1.0, 0, 0.08, 0.9, 58, {
        top: OAK_DARK,
        left: TAR,
        right: (u, v) => {
          const y = (1 - v) * 58;
          if (Math.abs(y - 14) < 1.2 || Math.abs(y - 48) < 1.2) return IRON;
          if (Math.floor(y) % 6 === 0 && Math.floor(u * 20) % 4 === 0) return IRON_LIGHT;
          const c = Math.floor(u * 6) % 2 ? TAR : mix(TAR, OAK_DARK, 0.4);
          return y < 5 ? mix(c, SLIME, 0.5) : c;
        },
      });
    }
  } else m.quad({ x: 1.6, y: 0.95, z: 64 }, { x: 2.8, y: 0, z: 0 }, { x: 0, y: 0, z: -64 }, (u, v) => {
    const y = v * 64;
    // An arch of dressed stone over them.
    if (y < 10) return Math.abs(u - 0.5) * 2 < 1 - (y / 10) ** 0.5 * 0 && y < 2 ? STONE_LIGHT : (Math.floor(u * 9) % 2 ? STONE : STONE_DARK);
    if (Math.abs(u - 0.5) < 0.008) return 0x0a0808;
    if (Math.abs(y - 38) < 3) return y < 36 ? OAK_LIGHT : OAK_DARK; // the bar
    if (Math.abs(y - 38) < 4 && (Math.abs(u - 0.1) < 0.02 || Math.abs(u - 0.9) < 0.02)) return IRON;
    if ((Math.floor(u * 14) + Math.floor(y / 6)) % 3 === 0 && Math.floor(y) % 6 === 0 && Math.floor(u * 56) % 4 === 0) return IRON_LIGHT;
    if (Math.abs(y - 18) < 1.2 || Math.abs(y - 56) < 1.2) return IRON;
    const plank = Math.floor(u * 16);
    let c = plank % 2 ? TAR : mix(TAR, OAK_DARK, 0.4);
    if (y > 58) c = mix(c, SLIME, 0.5);
    return c;
  });
  // A skull nailed up over the gate.
  m.box(2.9, 0.96, 54, 0.2, 0.04, 6, { top: 0xd8d0b8, left: (u, v) => ((Math.abs(u - 0.3) < 0.1 || Math.abs(u - 0.7) < 0.1) && v > 0.3 && v < 0.6 ? 0x1a1414 : 0xd8d0b8), right: 0xaaa290 });
  // The covered walk over the gate, its boards and its roof.
  m.box(1.5, 0.4, 64, 3, 1.4, 4, { top: OAK, left: (u) => (Math.floor(u * 30) % 2 ? OAK_DARK : DEADWOOD_DARK), right: DEADWOOD_DARK });
  m.quad({ x: 1.5, y: 1.8, z: 86 }, { x: 3, y: 0, z: 0 }, { x: 0, y: 0, z: -18 }, (u, v) => {
    if (v > 0.25 && v < 0.65 && Math.floor(u * 10) % 3 === 1) return 0x0c0a0a; // loopholes
    return Math.floor(u * 36) % 2 ? TAR : TAR_LIGHT;
  });
  m.quad({ x: 1.5, y: 0.2, z: 96 }, { x: 3, y: 0, z: 0 }, { x: 0, y: 1.9, z: -10 }, rotShingle(151));
  tower(4.4);
  return m;
}

/** The guards' hut by the gate (3 x 2): a lean-to of black boards against the wall, a door, a stovepipe. */
function guardHut(): IsoModel {
  const m = hovelSized({
    seed: 163, size: 3, H: 38, R: 22, walls: 'boards', roof: 'shingle', lean: 0, sag: 2,
    front: [{ u0: 0.66, u1: 0.84, y0: 10, y1: 22, pane: 'lit' }], side: [],
    door: [0.24, 0.42], chimney: { at: 0.2, lean: 0 },
  }, 3, 2);
  return m;
}

// ---------------------------------------------------------------- the square

/** The little well: a ring of mossy stones, a crooked frame and a rotten roof, a bucket on a rope, a chain. */
function smallWell(): IsoModel {
  const m = new IsoModel();
  const cx = 0.5;
  const cy = 0.5;
  m.cylinder(cx, cy, 0, 0.42, 16, (u, v) => {
    const row = Math.floor(v * 3);
    const blk = Math.floor(u * 8 + row * 0.5);
    if ((v * 3) % 1 < 0.12 || (u * 8 + row * 0.5) % 1 < 0.08) return MORTAR;
    let c = hash(blk, row) < 0.35 ? STONE_DARK : hash(blk, row + 3) > 0.8 ? STONE_LIGHT : STONE;
    if (hash(blk + 7, row) < 0.3) c = mix(c, MOSS, 0.55);
    return u > 0.6 ? darken(c, 0.75) : c;
  }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d < 0.3) return d < 0.2 ? 0x080a0c : 0x141a1e;
    return MOSS;
  });
  // The frame: two posts and a crossbar with a winch; one post leans.
  post(m, 0.14, 0.5, 0.04, 40, 10);
  post(m, 0.86, 0.5, 0.04, 40, 10);
  m.box(0.1, 0.46, 48, 0.82, 0.08, 3, { top: DEADWOOD_LIGHT, left: DEADWOOD, right: DEADWOOD_DARK });
  m.cylinder(0.5, 0.5, 44, 0.05, 4, () => DEADWOOD_DARK, DEADWOOD);
  line(m, { x: 0.5, y: 0.5, z: 44 }, { x: 0.5, y: 0.52, z: 22 }, 0x8a7a5a, 0.015);
  // The bucket, hung just over the rim.
  m.cylinder(0.5, 0.56, 16, 0.08, 6, (u, v) => (v < 0.15 || v > 0.85 ? IRON : Math.floor(u * 6) % 2 ? OAK : OAK_DARK), 0x1a2228);
  // A little roof of rotten shingles, gone over at one end.
  m.quad({ x: 0.0, y: 0.5, z: 62 }, { x: 1.0, y: 0, z: -3 }, { x: 0, y: -0.5, z: -9 }, rotShingle(171));
  m.quad({ x: 0.0, y: 0.5, z: 62 }, { x: 1.0, y: 0, z: -3 }, { x: 0, y: 0.55, z: -10 }, rotShingle(173));
  return m;
}

/** A lamp on a crooked post: an iron cage on an arm, its glass sooted, a little roof on it. */
function lamp(): IsoModel {
  const m = new IsoModel();
  post(m, 0.5, 0.5, 0.06, 56);
  m.box(0.5, 0.48, 54, 0.32, 0.04, 2, { top: IRON_LIGHT, left: IRON, right: IRON });
  line(m, { x: 0.5, y: 0.5, z: 46 }, { x: 0.74, y: 0.5, z: 54 }, IRON, 0.02);
  m.box(0.72, 0.44, 42, 0.13, 0.13, 10, {
    top: IRON,
    left: (u, v) => (u < 0.18 || u > 0.82 || v < 0.12 || v > 0.88 ? IRON : v < 0.4 ? LIT_HOT : LIT),
    right: (u, v) => (u < 0.18 || u > 0.82 || v < 0.12 || v > 0.88 ? IRON : LIT_DEEP),
  });
  m.quad({ x: 0.7, y: 0.5, z: 55 }, { x: 0.17, y: 0, z: 0 }, { x: 0, y: 0.12, z: -3 }, IRON_LIGHT);
  return m;
}

/** A brazier: an iron basket of coals on three legs, burning. */
function brazier(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.3, 0.35], [0.7, 0.35], [0.5, 0.75]]) line(m, { x, y, z: 0 }, { x: 0.5 + (x - 0.5) * 0.5, y: 0.5 + (y - 0.5) * 0.5, z: 14 }, IRON, 0.03);
  m.cylinder(0.5, 0.5, 12, 0.24, 8, (u, v) => (Math.floor(u * 10) % 2 && v > 0.2 && v < 0.8 ? 0xe06a2a : u > 0.6 ? darken(IRON, 0.7) : IRON), (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    const n = hash(Math.floor(u * 9), Math.floor(v * 9));
    return n > 0.6 ? LIT_HOT : n > 0.3 ? 0xf08a2a : d < 0.3 ? 0xc04a1a : 0x6a2a14;
  });
  // Flames licking up.
  for (let i = 0; i < 5; i++) {
    const fx = 0.38 + i * 0.06;
    const h = 5 + hash(i, 3) * 7;
    m.box(fx, 0.48, 20, 0.05, 0.05, h, { top: LIT_HOT, left: i % 2 ? 0xf8c040 : 0xf08a2a, right: 0xe06a2a });
  }
  return m;
}

/** A table with a game of dice left on it. */
function diceTable(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.2, 0.25], [0.8, 0.25], [0.2, 0.75], [0.8, 0.75]]) m.box(x - 0.03, y - 0.03, 0, 0.06, 0.06, 14, { top: OAK, left: OAK_DARK, right: BLACK_OAK });
  m.box(0.12, 0.18, 14, 0.76, 0.64, 2.5, { top: (u) => (Math.floor(u * 6) % 2 ? OAK : mix(OAK, OAK_DARK, 0.4)), left: OAK_DARK, right: BLACK_OAK });
  for (const [x, y] of [[0.35, 0.4], [0.45, 0.55]]) m.box(x, y, 16.5, 0.06, 0.06, 2, { top: 0xe8e0c8, left: 0xd0c8b0, right: 0xa8a090 });
  m.cylinder(0.65, 0.4, 16.5, 0.07, 1, () => 0xa86a3a, 0xc88a4a);
  m.cylinder(0.6, 0.62, 16.5, 0.08, 6, (u) => (u < 0.3 ? 0x8a8a92 : 0x5e5e66), 0x3a2a1a);
  return m;
}

/** A rack of spears and a pole-axe leaning against the wall by the gate. */
function spearRack(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.4, 0, 0.8, 0.2, 4, { top: OAK, left: OAK_DARK, right: BLACK_OAK });
  m.box(0.1, 0.4, 28, 0.8, 0.12, 2.5, { top: OAK, left: OAK_DARK, right: BLACK_OAK });
  for (let i = 0; i < 4; i++) {
    const x = 0.2 + i * 0.2;
    line(m, { x, y: 0.5, z: 2 }, { x: x - 0.04, y: 0.45, z: 52 }, i === 2 ? DEADWOOD_LIGHT : DEADWOOD, 0.03);
    m.box(x - 0.06, 0.45, 52, 0.04, 0.04, 7, { top: IRON_LIGHT, left: i === 1 ? RUST : IRON_LIGHT, right: IRON });
  }
  return m;
}

/** A gibbet: a tall post, its arm, and an iron cage hanging empty on a chain. */
function gibbet(): IsoModel {
  const m = new IsoModel();
  m.box(0.15, 0.4, 0, 0.3, 0.3, 4, { top: STONE, left: STONE, right: STONE_DARK });
  m.box(0.22, 0.47, 4, 0.16, 0.16, 92, { top: DEADWOOD_LIGHT, left: (_u, v) => (hash(Math.floor(v * 30), 1) < 0.15 ? DEADWOOD_DARK : DEADWOOD), right: DEADWOOD_DARK });
  m.box(0.22, 0.47, 92, 0.9, 0.12, 5, { top: DEADWOOD_LIGHT, left: DEADWOOD, right: DEADWOOD_DARK });
  line(m, { x: 0.3, y: 0.5, z: 70 }, { x: 0.7, y: 0.5, z: 92 }, DEADWOOD_DARK, 0.05);
  line(m, { x: 0.95, y: 0.52, z: 92 }, { x: 0.95, y: 0.54, z: 78 }, IRON, 0.02);
  // The cage: a body-shaped basket of iron straps.
  m.cylinder(0.95, 0.56, 42, 0.17, 36, (u, v) => (Math.floor(u * 8) % 2 === 0 || Math.floor(v * 7) % 3 === 0 ? (u > 0.6 ? darken(RUST, 0.7) : RUST) : null) as number, (u, v) => (Math.hypot(u - 0.5, v - 0.5) > 0.4 ? IRON : null) as number);
  return m;
}

/** The stocks: two posts and a hinged board with three holes, on a little platform. */
function stocks(): IsoModel {
  const m = new IsoModel();
  m.box(0.05, 0.2, 0, 1.9, 0.6, 4, { top: (u) => (Math.floor(u * 10) % 2 ? OAK : OAK_DARK), left: OAK_DARK, right: BLACK_OAK });
  for (const x of [0.2, 1.7]) m.box(x, 0.44, 4, 0.1, 0.1, 22, { top: DEADWOOD_LIGHT, left: DEADWOOD, right: DEADWOOD_DARK });
  m.box(0.2, 0.42, 14, 1.6, 0.12, 9, {
    top: DEADWOOD_LIGHT,
    left: (u, v) => {
      for (const c of [0.22, 0.5, 0.78]) if (Math.hypot((u - c) * 5, (v - 0.5) * 1.2) < 0.4) return 0x120e0c;
      if (Math.abs(v - 0.5) < 0.05) return DEADWOOD_DARK;
      return DEADWOOD;
    },
    right: DEADWOOD_DARK,
  });
  // A rotten cabbage, thrown.
  m.box(1.0, 0.9, 0, 0.12, 0.1, 3, { top: 0x6a7a3a, left: 0x5a6a2e, right: 0x3e4a22 });
  return m;
}

/** A notice board under a little roof, pasted thick with notices and a knife stuck in it. */
function noticeBoard(): IsoModel {
  const m = new IsoModel();
  for (const x of [0.2, 0.8]) post(m, x, 0.5, 0.05, 48);
  m.quad({ x: 0.15, y: 0.55, z: 46 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0, z: -26 }, (u, v) => {
    if (u < 0.04 || u > 0.96 || v < 0.05 || v > 0.95) return BLACK_OAK;
    const pu = Math.floor(u * 4 + Math.floor(v * 3) * 0.4);
    const pv = Math.floor(v * 3);
    const paper = hash(pu, pv) < 0.75;
    if (!paper) return OAK_DARK;
    const lu = (u * 4 + Math.floor(v * 3) * 0.4) % 1;
    const lv = (v * 3) % 1;
    if (lu < 0.08 || lv < 0.08) return OAK_DARK;
    if (lv > 0.25 && lv < 0.85 && Math.floor(lv * 10) % 2 === 0 && lu > 0.15 && lu < 0.85) return 0x5a5048;
    return hash(pu + 3, pv) < 0.3 ? 0xb8a888 : 0xd0c4a4;
  });
  m.box(0.6, 0.56, 34, 0.02, 0.18, 1, { top: IRON_LIGHT, left: IRON_LIGHT, right: IRON });
  m.quad({ x: 0.08, y: 0.4, z: 52 }, { x: 0.84, y: 0, z: 0 }, { x: 0, y: 0.35, z: -6 }, rotShingle(181));
  return m;
}

/** A stone horse trough, green water in it. */
function trough(): IsoModel {
  const m = new IsoModel();
  m.box(0.08, 0.25, 0, 0.84, 0.5, 12, {
    top: (u, v) => (u > 0.08 && u < 0.92 && v > 0.15 && v < 0.85 ? (hash(Math.floor(u * 12), Math.floor(v * 4)) < 0.3 ? SCUM : 0x2a3a2e) : STONE_LIGHT),
    left: rubbleStone(191, 2, 2, 0.5),
    right: (u, v) => darken(rubbleStone(193, 2, 2)(u, v) ?? STONE, 0.75),
  });
  return m;
}

/** A cart with one wheel off, tipped onto its axle, a few sacks spilled out of it. */
function brokenCart(): IsoModel {
  const m = new IsoModel();
  // The bed, tilted down at the broken corner.
  m.quad({ x: 0.2, y: 0.3, z: 16 }, { x: 1.5, y: 0, z: -6 }, { x: 0, y: 1.1, z: 0 }, (u, v) => (Math.floor(v * 7) % 2 ? OAK : OAK_DARK) + (u > 0.95 ? 0 : 0));
  m.quad({ x: 0.2, y: 1.4, z: 22 }, { x: 1.5, y: 0, z: -6 }, { x: 0, y: 0, z: -6 }, (u) => (Math.floor(u * 10) % 3 === 0 ? BLACK_OAK : OAK_DARK));
  m.quad({ x: 1.7, y: 0.3, z: 16 }, { x: 0, y: 1.1, z: 0 }, { x: 0, y: 0, z: -6 }, darken(OAK_DARK, 0.8));
  // The good wheel, upright at the back; the broken one flat on the ground.
  m.quad({ x: 0.45, y: 1.42, z: 26 }, { x: 0.6, y: 0, z: 0 }, { x: 0, y: 0, z: -26 }, (u, v) => {
    const d = Math.hypot((u - 0.5) * 2, (v - 0.5) * 2);
    if (d > 1) return null;
    if (d > 0.82) return DEADWOOD_DARK;
    if (d < 0.18) return IRON;
    const a = Math.atan2(v - 0.5, u - 0.5);
    return Math.abs(((a / Math.PI) * 4 + 8) % 1 - 0.5) < 0.1 ? DEADWOOD : null;
  });
  m.quad({ x: 1.3, y: 1.4, z: 1 }, { x: 0.55, y: 0, z: 0 }, { x: 0, y: 0.55, z: 0 }, (u, v) => {
    const d = Math.hypot((u - 0.5) * 2, (v - 0.5) * 2);
    if (d > 1) return null;
    return d > 0.82 ? DEADWOOD_DARK : Math.abs(((Math.atan2(v - 0.5, u - 0.5) / Math.PI) * 4 + 8) % 1 - 0.5) < 0.12 ? DEADWOOD : null;
  });
  // Spilled sacks.
  for (const [x, y] of [[1.55, 1.1], [1.7, 0.7]]) m.cylinder(x, y, 0, 0.16, 7, (u) => (u < 0.3 ? 0xa89a78 : u > 0.7 ? 0x6e6248 : 0x8a7c5e), 0x9a8a6a);
  return m;
}

/** A rough bench of a plank on two stumps. */
function bench(): IsoModel {
  const m = new IsoModel();
  for (const x of [0.2, 0.8]) m.cylinder(x, 0.68, 0, 0.09, SEAT_TOP - 2.5, (u) => (u < 0.3 ? DEADWOOD_LIGHT : u > 0.7 ? DEADWOOD_DARK : DEADWOOD), DEADWOOD_LIGHT);
  m.box(0.06, 0.56, SEAT_TOP - 2.5, 0.88, 0.24, 2.5, { top: (u) => (hash(Math.floor(u * 20), 3) < 0.1 ? OAK_DARK : OAK), left: OAK_DARK, right: BLACK_OAK });
  return m;
}

/** A hitching rail: two posts and a bar, worn pale where the reins rub. */
function hitchRail(): IsoModel {
  const m = new IsoModel();
  for (const x of [0.12, 0.88]) post(m, x, 0.5, 0.05, 20);
  m.box(0.08, 0.46, 18, 0.84, 0.08, 2.5, { top: (u) => (u > 0.4 && u < 0.6 ? OAK_LIGHT : DEADWOOD_LIGHT), left: DEADWOOD, right: DEADWOOD_DARK });
  return m;
}

/** A rain butt, overflowing, green round the bottom. */
function waterButt(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.3, 20, (u, v) => {
    if (v < 0.07 || Math.abs(v - 0.5) < 0.04 || v > 0.92) return u > 0.6 ? darken(IRON, 0.7) : IRON;
    let c = Math.floor(u * 12) % 2 ? OAK_DARK : DEADWOOD_DARK;
    if (v > 0.7) c = mix(c, SLIME, 0.6);
    return u > 0.65 ? darken(c, 0.75) : c;
  }, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.4 ? 0x1a2420 : OAK_DARK));
  return m;
}

/** A midden: a heap of rubbish, bones and ash behind the Rose, a rat on top. */
function midden(seed: number, w = 2): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(seed);
  for (let i = 0; i < 14 * w; i++) {
    const x = 0.2 + rnd() * (w - 0.4);
    const y = 0.2 + rnd() * 0.6;
    const r = 0.08 + rnd() * 0.12;
    const c = [MUD, 0x4a4234, 0x6a5e48, 0x3a3a30, 0x8a8270][Math.floor(rnd() * 5)];
    m.cylinder(x, y, 0, r, 2 + rnd() * 6 * (1 - Math.abs(x - w / 2) / w), (u) => (u > 0.6 ? darken(c, 0.7) : c), lighten(c, 0.1));
  }
  // A bone or two, and the rat.
  m.box(w * 0.4, 0.45, 7, 0.3, 0.04, 1.5, { top: 0xe0d8c0, left: 0xc8c0a8, right: 0xa8a090 });
  m.box(w * 0.55, 0.5, 8, 0.14, 0.07, 3, { top: 0x5a5048, left: 0x4a4038, right: 0x302820 });
  line(m, { x: w * 0.55, y: 0.54, z: 8.5 }, { x: w * 0.42, y: 0.6, z: 7 }, 0x8a6a5a, 0.01);
  return m;
}

/** A stack of split firewood under a scrap of canvas. */
function woodpile(): IsoModel {
  const m = new IsoModel();
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 5 - row; i++) {
      m.cylinder(0.2 + i * 0.15 + row * 0.075, 0.5, row * 4.5, 0.075, 0.3 as number, () => DEADWOOD, 0xb09a78);
    }
  }
  m.box(0.12, 0.25, 0, 0.78, 0.5, 18, {
    top: (u, v) => (hash(Math.floor(u * 8), Math.floor(v * 4)) < 0.5 ? TARP : TARP_DARK),
    left: (u, v) => {
      const end = Math.hypot(((u * 5) % 1) - 0.5, ((v * 4) % 1) - 0.5);
      return end < 0.35 ? (end < 0.15 ? 0xc0a878 : 0x9a8058) : DEADWOOD_DARK;
    },
    right: DEADWOOD_DARK,
  });
  return m;
}

/** Herbs on a little trestle outside Ossery's, drying in flat baskets. */
function herbTable(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.25, 0.2], [0.75, 0.2], [0.25, 0.8], [0.75, 0.8]]) line(m, { x, y, z: 0 }, { x: 0.5 + (x - 0.5) * 0.9, y: 0.5 + (y - 0.5) * 0.9, z: 16 }, DEADWOOD_DARK, 0.03);
  m.box(0.15, 0.1, 16, 0.7, 0.8, 2, { top: OAK, left: OAK_DARK, right: BLACK_OAK });
  for (const [x, y, c] of [[0.3, 0.3, 0x6a7a3a], [0.62, 0.32, 0x8a6a3a], [0.4, 0.66, 0x5a7a5a], [0.68, 0.7, 0x9a8a3a]] as const) {
    m.cylinder(x, y, 18, 0.13, 2, (u) => (Math.floor(u * 10) % 2 ? 0xb89058 : 0x7e5e32), (u, v) => (hash(Math.floor(u * 8), Math.floor(v * 8)) < 0.6 ? c : darken(c, 0.7)));
  }
  return m;
}

/** Coils of rope and a lantern on a hook outside Tallow's. */
function ropeCoils(): IsoModel {
  const m = new IsoModel();
  for (const [x, y, z, r] of [[0.4, 0.5, 0, 0.3], [0.6, 0.4, 5, 0.22], [0.45, 0.45, 9, 0.16]] as const) {
    m.cylinder(x, y, z, r, 5, (u, v) => ((v * 3 + u * 6) % 1 < 0.35 ? 0x8a764e : u > 0.6 ? 0x9a865e : 0xc0a878), (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5);
      return d < 0.2 ? 0x3a3024 : (d * 18) % 1 < 0.4 ? 0x8a764e : 0xc0a878;
    });
  }
  return m;
}

/** Junk outside Lusk's: a birdcage, a pile of boots, a broken chair. */
function pawnJunk(): IsoModel {
  const m = new IsoModel();
  // The chair, on its side.
  m.box(0.1, 0.3, 0, 0.36, 0.4, 3, { top: OAK, left: OAK_DARK, right: BLACK_OAK });
  for (const y of [0.32, 0.66]) line(m, { x: 0.1, y, z: 3 }, { x: -0.1, y, z: 16 }, OAK_DARK, 0.04);
  // Boots in a heap.
  for (const [x, y, z] of [[0.55, 0.4, 0], [0.7, 0.55, 0], [0.62, 0.48, 4]] as const) m.box(x, y, z, 0.18, 0.1, 6, { top: 0x4a3426, left: 0x3a2a1e, right: 0x261a12 });
  // The cage.
  m.cylinder(0.7, 0.2, 0, 0.12, 12, (u) => (Math.floor(u * 10) % 2 ? (u > 0.6 ? darken(0xb08a3a, 0.7) : 0xb08a3a) : null) as number, 0xb08a3a);
  return m;
}

/** Rubbish heaped against a wall: broken crates, a cracked pot, rags, bones. */
function rubbish(seed: number): IsoModel {
  const m = midden(seed, 1);
  m.box(0.15, 0.2, 0, 0.35, 0.3, 8, { top: OAK, left: (u) => (Math.floor(u * 4) % 2 ? OAK_DARK : null) as number, right: BLACK_OAK });
  m.cylinder(0.7, 0.65, 0, 0.12, 6, (u) => (u > 0.5 ? 0x6a3a26 : 0x8a4a32), 0x2a1a12);
  return m;
}

// ---------------------------------------------------------------- the waterfront

/**
 * The barge (6 x 2, along x): broad and flat, low in the water, her hold
 * open and full of rainwater, a tarred deckhouse aft, a stubby mast with no
 * sail, and weed growing along her waterline.
 */
function barge(): IsoModel {
  const m = new IsoModel();
  const x0 = 0.25;
  const L = 5.5;
  const y0 = 0.3;
  const B = 1.4;
  const fb = 10;
  // The hull: a long box, tapering at the bow (east end), its planks tarred.
  const hullSide: Shader = (_u, v) => {
    if (v > 0.7) return mix(TAR_DARK, SLIME, 0.7);
    if (v < 0.14) return OAK_DARK;
    return Math.floor(v * 6) % 2 ? TAR : TAR_LIGHT;
  };
  m.box(x0, y0, -2, L - 0.5, B, fb + 2, { top: OAK, left: hullSide, right: (u, v) => darken(hullSide(u, v) ?? TAR, 0.75) });
  // The bow, a blunt wedge.
  m.quad({ x: x0 + L - 0.5, y: y0 + B, z: fb }, { x: 0.5, y: -B / 2, z: 2 }, { x: 0, y: 0, z: -fb - 2 }, hullSide);
  m.quad({ x: x0 + L - 0.5, y: y0, z: fb }, { x: 0.5, y: B / 2, z: 2 }, { x: 0, y: 0, z: -fb - 2 }, (u, v) => darken(hullSide(u, v) ?? TAR, 0.7));
  m.quad({ x: x0 + L - 0.5, y: y0, z: fb }, { x: 0.5, y: B / 2, z: 2 }, { x: 0, y: B, z: 0 }, (u, v) => (v > 1 - u * 0.5 || v < u * 0.5 ? null : OAK));
  // The open hold, dark water standing in it, with planks floating.
  m.quad({ x: x0 + 1.6, y: y0 + 0.15, z: fb + 0.2 }, { x: 2.8, y: 0, z: 0 }, { x: 0, y: B - 0.3, z: 0 }, (u, v) => {
    if (u < 0.03 || u > 0.97 || v < 0.06 || v > 0.94) return BLACK_OAK;
    if (Math.abs(v - 0.4 - u * 0.1) < 0.05 && u > 0.3 && u < 0.6) return OAK_DARK;
    return hash(Math.floor(u * 20), Math.floor(v * 6)) < 0.12 ? SCUM : 0x1a2228;
  });
  // The deckhouse aft, tarred boards, a little door and a stovepipe.
  m.box(x0 + 0.15, y0 + 0.2, fb, 1.2, B - 0.4, 18, {
    top: rotShingle(211),
    left: withDoor(boardWall(5, 213, 0.8), 18, 0.55, 0.8, 14),
    right: (u, v) => darken(boardWall(5, 215, 0.8)(u, v) ?? TAR, 0.75),
  });
  m.cylinder(x0 + 0.4, y0 + 0.5, fb + 18, 0.05, 8, () => IRON, P.soot);
  // The stubby mast, and a rope off it to the bank.
  post(m, x0 + 1.5, y0 + B / 2, 0.06, 46, fb);
  m.box(x0 + 1.2, y0 + B / 2 - 0.03, fb + 40, 0.6, 0.06, 2, { top: DEADWOOD_LIGHT, left: DEADWOOD, right: DEADWOOD_DARK });
  line(m, { x: x0 + 1.5, y: y0 + B / 2, z: fb + 40 }, { x: x0 + 2.4, y: y0 - 0.3, z: 0 }, 0x8a764e, 0.015);
  line(m, { x: x0 + L - 0.3, y: y0 + B / 2, z: fb + 2 }, { x: x0 + L + 0.3, y: y0 - 0.6, z: 0 }, 0x8a764e, 0.015);
  // Her name on the bow, flaking.
  m.quad({ x: x0 + L - 1.4, y: y0 + B + 0.01, z: fb - 3 }, { x: 0.8, y: 0, z: 0 }, { x: 0, y: 0, z: -3 }, (u) => (Math.floor(u * 14) % 2 ? 0xc8c0a8 : null) as number);
  return m;
}

/** The fishing shed on stilts at the water's edge: a tarred box on posts, nets over the rail, a hatch to the water. */
function fishShed(): IsoModel {
  return hovel({
    seed: 221, size: 3, H: 32, R: 24, walls: 'boards', roof: 'shingle', lean: 0.08, sag: 3, stilts: 22,
    front: [{ u0: 0.66, u1: 0.86, y0: 8, y1: 18, pane: 'dark' }], side: [{ u0: 0.3, u1: 0.5, y0: 8, y1: 18, pane: 'lit' }],
    door: [0.3, 0.5], chimney: { at: 0.85, lean: 0.05 }, tarp: 0.2, crow: 0.6,
  });
}

/** A small crane for landing cargo: a post, a jib, a block and a hook, with a net of barrels. */
function crane(): IsoModel {
  const m = new IsoModel();
  m.box(0.25, 0.25, 0, 0.5, 0.5, 6, { top: STONE, left: STONE, right: STONE_DARK });
  post(m, 0.5, 0.5, 0.08, 66, 6);
  line(m, { x: 0.5, y: 0.5, z: 58 }, { x: 0.5, y: 1.6, z: 70 }, DEADWOOD, 0.06);
  line(m, { x: 0.5, y: 0.5, z: 30 }, { x: 0.5, y: 1.0, z: 60 }, DEADWOOD_DARK, 0.04);
  line(m, { x: 0.5, y: 1.6, z: 70 }, { x: 0.5, y: 1.6, z: 30 }, 0x8a764e, 0.015);
  m.box(0.46, 1.56, 26, 0.08, 0.06, 4, { top: IRON, left: IRON, right: IRON });
  return m;
}

/** An old pile standing in the water, slimy at the waterline, where a pier once was. */
function piling(seed: number): IsoModel {
  const m = new IsoModel();
  const h = 14 + seed * 5;
  post(m, 0.5, 0.5, 0.09, h, -6, 10);
  if (seed % 2 === 0) m.box(0.42, 0.42, h - 6, 0.2, 0.2, 2, { top: 0xe8e0d0, left: 0xc8c0b0, right: 0xa8a090 }); // a gull's mess
  return m;
}

// ---------------------------------------------------------------- the ground

/** A duckboard tile: three or four planks laid along x (or y), with cross-battens; `broken` has a board gone. */
function boards(alongX: boolean, broken: boolean, overWater: boolean): RenderedModel {
  const m = new IsoModel();
  const z = overWater ? 2 : 0.6;
  const n = 4;
  for (let i = 0; i < n; i++) {
    if (broken && i === 2) continue;
    const a = 0.06 + i * (0.88 / n);
    const w = 0.88 / n - 0.04;
    const seed = i * 7 + (alongX ? 1 : 3) + (broken ? 5 : 0);
    const plank: Shader = (u, v) => {
      const g = hash(Math.floor(u * 30), seed);
      if (g < 0.08) return OAK_DARK;
      if (u < 0.04 || u > 0.96) return OAK_DARK;
      let c = hash(seed, 2) < 0.3 ? DEADWOOD : OAK;
      if (v < 0.3) c = lighten(c, 0.08);
      if (smoothNoise(u * 4, v * 2, seed) > 0.68) c = mix(c, SLIME, 0.45);
      return c;
    };
    if (alongX) m.box(0.02, a, z - 1, 0.96, w, 1.4, { top: plank, left: OAK_DARK, right: DEADWOOD_DARK });
    else m.box(a, 0.02, z - 1, w, 0.96, 1.4, { top: (u, v) => plank(v, u), left: DEADWOOD_DARK, right: OAK_DARK });
  }
  return m.render(false);
}

/** A flat patch on a tile: drawn into the ground (mud, a puddle, scum on the water). */
function patch(seed: number, paint: (d: number, n: number, u: number, v: number) => number | null): RenderedModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2 + (smoothNoise(u * 4, v * 4, seed) - 0.5) * 0.6;
    return paint(d, hash(Math.floor(u * 40), Math.floor(v * 40) + seed), u, v);
  });
  return m.render(false);
}

const mudPatch = (seed: number) =>
  patch(seed, (d, n) => {
    if (d > 0.85) return null;
    if (d > 0.75) return n < 0.5 ? MUD_DARK : null;
    // Hoof and boot prints, and a sheen of wet.
    if (n < 0.06) return MUD_DARK;
    if (n > 0.93) return MUD_WET;
    return d < 0.3 && n > 0.7 ? MUD_WET : MUD;
  });

const puddle = (seed: number) =>
  patch(seed, (d, n, u, v) => {
    if (d > 0.7) return null;
    if (d > 0.64) return MUD_WET;
    // Sky caught in it, brighter at one edge.
    if (u + v < 0.75 && d > 0.35 && n < 0.6) return PUDDLE_LIGHT;
    return n < 0.1 ? 0x2e3a44 : PUDDLE;
  });

const scum = (seed: number) =>
  patch(seed, (d, n) => {
    if (d > 0.8) return null;
    if (d > 0.6 && n < 0.6) return null;
    return n < 0.3 ? SCUM_LIGHT : n < 0.4 ? 0x3e5228 : SCUM;
  });

/** Rushes and sedge on wet ground: a clump of stiff blades, some dry, a few seed heads. */
function rushes(seed: number): PixelCanvas {
  const W = 48;
  const H = 52;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  const foot = { x: W / 2, y: H - 8 };
  const blades = 26 + Math.floor(rnd() * 12);
  for (let i = 0; i < blades; i++) {
    const bx = foot.x + (rnd() - 0.5) * 22;
    const by = foot.y + (rnd() - 0.5) * 7;
    const len = 10 + rnd() * 22;
    const lean = (rnd() - 0.5) * 1.1;
    const dry = rnd() < 0.3;
    const col = dry ? RUSH_DRY : rnd() < 0.5 ? RUSH : RUSH_LIGHT;
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const x = bx + lean * k * (0.6 + t * 0.6);
      const y = by - k;
      c.set(x, y, t < 0.25 ? RUSH_DARK : col);
      if (t < 0.3) c.set(x + 1, y, RUSH_DARK);
    }
    if (len > 22 && rnd() < 0.35) {
      const tx = bx + lean * len * 1.1;
      for (let k = 0; k < 4; k++) c.set(tx, by - len + k, 0x5a3e24);
    }
  }
  c.outline();
  return c;
}

/**
 * A dead tree: a bare, grey trunk, split or snapped, with a few crooked limbs
 * and twigs, ivy dead on it, perhaps a bracket fungus; `kind` picks one of four.
 */
function deadTree(kind: number): PixelCanvas {
  const W = 96;
  const H = 132;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(301 + kind * 37);
  const foot = { x: W / 2, y: H - 6 };
  const trunkH = [86, 64, 104, 40][kind];
  const w0 = [6, 7, 5, 8][kind];
  // Roots spreading at the foot.
  for (let i = 0; i < 5; i++) {
    const dir = (i - 2) * 0.55 + (rnd() - 0.5) * 0.3;
    for (let k = 0; k < 10; k++) {
      const x = foot.x + Math.sin(dir) * k * 1.4;
      const y = foot.y - 2 + k * 0.4;
      c.set(x, y, DEADWOOD_DARK);
      c.set(x, y - 1, k < 6 ? DEADWOOD : DEADWOOD_DARK);
    }
  }
  /** A limb from (x, y), heading at `a` (0 straight up), `len` long and `w` wide, splitting as it goes. */
  const limb = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    let px = x;
    let py = y;
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const ww = Math.max(0.6, w * (1 - t * 0.7));
      a += (rnd() - 0.5) * 0.18;
      px += Math.sin(a);
      py -= Math.cos(a);
      for (let d = -ww; d <= ww; d += 0.5) {
        const lit = d < -ww * 0.3;
        const dark = d > ww * 0.4;
        c.set(px + d * Math.cos(a), py + d * Math.sin(a), dark ? DEADWOOD_DARK : lit ? DEADWOOD_LIGHT : DEADWOOD);
      }
      if (depth > 0 && k > len * 0.35 && rnd() < 0.06) limb(px, py, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), len * 0.5, ww * 0.6, depth - 1);
    }
    // A twig or two at the end.
    if (depth === 0) for (let i = 0; i < 2; i++) limb(px, py, a + (rnd() - 0.5) * 1.6, 3 + rnd() * 4, 0.5, -1);
  };
  // The trunk itself, then the main limbs off it.
  limb(foot.x, foot.y, (rnd() - 0.5) * 0.2, trunkH, w0, kind === 3 ? 0 : 2);
  if (kind !== 3) {
    for (let i = 0; i < 3; i++) limb(foot.x + (rnd() - 0.5) * 3, foot.y - trunkH * (0.45 + i * 0.15), (i % 2 ? 1 : -1) * (0.6 + rnd() * 0.5), 18 + rnd() * 18, 2.4, 2);
  } else {
    // A snapped stump of a tree: the jagged top, pale where it broke.
    for (let x = -w0; x <= w0; x++) {
      const jag = Math.floor(rnd() * 5);
      for (let k = 0; k < jag; k++) c.set(foot.x + x, foot.y - trunkH - k, k === jag - 1 ? 0xb0a48a : DEADWOOD_LIGHT);
    }
  }
  // Dead ivy up the trunk, and a bracket fungus.
  for (let k = 0; k < trunkH * 0.6; k++) {
    if (rnd() < 0.45) c.set(foot.x - w0 + 1 + Math.sin(k * 0.4) * 2, foot.y - k, rnd() < 0.5 ? 0x5a4a2e : 0x3e3624);
  }
  if (kind !== 1) {
    const fy = foot.y - trunkH * 0.3;
    for (let dx = 0; dx < 6; dx++) {
      c.set(foot.x + w0 + dx * 0.8, fy + dx * 0.2, 0xc8a870);
      c.set(foot.x + w0 + dx * 0.8, fy + 1 + dx * 0.2, 0x8a6a3e);
    }
  }
  c.outline();
  return c;
}

/** A rotten stump, mossy, with a ring of toadstools. */
function stump(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.2, 9, (u, v) => (v < 0.2 && u < 0.5 ? MOSS : u < 0.3 ? DEADWOOD_LIGHT : u > 0.7 ? DEADWOOD_DARK : DEADWOOD), (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    return (d * 14) % 1 < 0.3 ? 0x6a5a42 : 0x8a7a5e;
  });
  for (const [x, y] of [[0.24, 0.62], [0.32, 0.74], [0.7, 0.72]]) {
    m.box(x, y, 0, 0.03, 0.03, 3, { top: 0xe0d8c0, left: 0xe0d8c0, right: 0xb0a890 });
    m.cylinder(x + 0.015, y + 0.015, 3, 0.05, 1.5, () => 0xa86a3a, 0xc88a4a);
  }
  return m;
}

// ---------------------------------------------------------------- registering

/** Registers a standing canvas whose foot (the middle of the tile) is at (W/2, footY). */
function onTile(scene: Phaser.Scene, key: string, c: PixelCanvas, footY: number): void {
  c.toTexture(scene, key);
  MODEL_ART[key] = { key, originX: 0.5, originY: (footY - 16) / c.height };
}

export function generateGloomhaven(scene: Phaser.Scene): void {
  const put = (key: string, m: IsoModel, outline = true) => registerModel(scene, key, m.render(outline));
  // Buildings.
  for (const [key, look] of Object.entries(HOUSES)) put(key, hovel(look));
  // The burnt house: the tall plaster one, its roof gone and its walls blackened.
  const ruin = hovel({ ...HOUSES['gh-house-0'], seed: 251, hole: [0.5, 0.4], tarp: undefined, crow: 0.4, lantern: false, chimney: { at: 0.15, lean: 0.25 } });
  ruin.mapShaders((shade) => (u, v) => {
    const c = shade(u, v);
    if (c === null) return null;
    const burnt = smoothNoise(u * 5, v * 5, 7) > 0.35;
    return burnt ? (hash(Math.floor(u * 50), Math.floor(v * 50)) < 0.15 ? 0x3a1e14 : mix(c, 0x0e0c0c, 0.82)) : mix(c, 0x1a1614, 0.45);
  });
  put('gh-ruin', ruin);
  put('gh-blackrose', blackRose());
  put('gh-apothecary', apothecary());
  put('gh-chandler', chandler());
  put('gh-pawn', pawnshop());
  put('gh-guardhut', guardHut());
  put('gh-fishshed', fishShed());
  // The wall and the gate.
  for (let i = 0; i < 4; i++) put(`gh-wall-${i}`, wallPiece(i));
  put('gh-wallpost', wallPost());
  put('gh-walltower', wallTower());
  put('gh-gatehouse', gatehouse());
  put('gh-gatehouse-open', gatehouse(true));
  // The square and the streets.
  put('gh-well', smallWell());
  put('gh-lamp', lamp());
  put('gh-brazier', brazier());
  put('gh-dicetable', diceTable());
  put('gh-spearrack', spearRack());
  put('gh-gibbet', gibbet());
  put('gh-stocks', stocks());
  put('gh-noticeboard', noticeBoard());
  put('gh-trough', trough());
  put('gh-brokencart', brokenCart());
  put('gh-bench', bench());
  put('gh-hitchrail', hitchRail());
  put('gh-waterbutt', waterButt());
  put('gh-midden', midden(261));
  put('gh-woodpile', woodpile());
  put('gh-herbtable', herbTable());
  put('gh-ropecoils', ropeCoils());
  put('gh-pawnjunk', pawnJunk());
  put('gh-rubbish', rubbish(271));
  // The waterfront.
  put('gh-barge', barge());
  put('gh-crane', crane());
  put('gh-piling', piling(1));
  put('gh-stump', stump());
  // The ground: duckboards, mud, puddles, scum.
  registerModel(scene, 'gh-boards-x', boards(true, false, false));
  registerModel(scene, 'gh-boards-x-broken', boards(true, true, false));
  registerModel(scene, 'gh-boards-y', boards(false, false, false));
  registerModel(scene, 'gh-boards-x-deck', boards(true, false, true));
  registerModel(scene, 'gh-boards-y-deck', boards(false, false, true));
  for (let i = 0; i < 3; i++) {
    registerModel(scene, `gh-mud-${i}`, mudPatch(281 + i * 7));
    registerModel(scene, `gh-puddle-${i}`, puddle(291 + i * 7));
    registerModel(scene, `gh-scum-${i}`, scum(301 + i * 7));
    onTile(scene, `gh-rushes-${i}`, rushes(311 + i * 13), 52 - 8);
  }
  for (let i = 0; i < 4; i++) {
    const tree = deadTree(i);
    onTile(scene, `gh-deadtree-${i}`, tree, 132 - 6);
    // And the same trees for the fen past the edge of the map, with reed beds between them.
    FEN_ART.push({ key: `gh-deadtree-${i}`, originY: (132 - 6 + 0.5) / 132 });
  }
  for (let i = 0; i < 3; i++) FEN_ART.push({ key: `gh-rushes-${i}`, originY: (52 - 8 + 0.5) / 52 });
}

// The parts the Reeve's toll house by the Fen Gate (art/tollhouse.ts) and the Guildhall (art/guildhall.ts) are built from, so they match the town.
export type { Opening };
export { chimney, darken, lighten, mix, plasterWall, rotSlate, windowPixel, withDoor, withOpenings };
