import Phaser from 'phaser';
import { TILE_HEIGHT } from '../config';
import { caveEntrance } from './cave';
import { MODEL_ART, registerModel } from './interior';
import { IsoModel, Shader } from './IsoModel';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';
import { smoothNoise } from './scorch';

/**
 * The edge of the Greyfells (see world/GreyfellsMap.ts): the goblins' camp on
 * the open moor above the north woods, where they rested on their way home
 * with Mother. Hide tents slung over crooked poles, a lookout of lashed
 * saplings, a cookfire with a spit, a pen of woven hurdles, sheep skulls on
 * stakes, the litter they carried her on, a stone they scratched pictures
 * into, heather over everything, and the hole in the hill they went down.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const HIDE = 0x8a6a4a;
const HIDE_DARK = 0x5e4630;
const HIDE_LIGHT = 0xa8865e;
const HIDE_GREY = 0x7a6e60;
const STITCH = 0x3a2a1c;
const POLE = 0x6a5236;
const POLE_DARK = 0x46361f;
const POLE_LIGHT = 0x8a7050;
const BONE = 0xe0d6bc;
const BONE_DARK = 0xa89c80;
const INSIDE = 0x1a1410;
const QUILT_RED = 0xa8323a;
const QUILT_DARK = 0x6e1e26;
const QUILT_CREAM = 0xe0cfa8;
const QUILT_BLUE = 0x3e5a86;
const BLOOD = 0x5a1418;
const HEATHER = 0x7a4a7e;
const HEATHER_LIGHT = 0xa06aa2;
const HEATHER_DARK = 0x4e3050;
const SCRATCH = 0xd8d4cc;
const ROCK = 0x6e6c74;
const ROCK_DARK = 0x4a4852;
const ROCK_LIGHT = 0x8e8c94;
const OCHRE = 0xa0522d;

/** Stitched-together hides: patches of brown and grey with dark seams. */
function hides(seed: number, dark = false): Shader {
  return (u, v) => {
    const pu = Math.floor(u * 4 + smoothNoise(v * 3, u, seed) * 0.8);
    const pv = Math.floor(v * 3 + smoothNoise(u * 3, v, seed + 5) * 0.8);
    const fu = u * 4 + smoothNoise(v * 3, u, seed) * 0.8 - pu;
    const fv = v * 3 + smoothNoise(u * 3, v, seed + 5) * 0.8 - pv;
    if (fu < 0.05 || fv < 0.06) return STITCH;
    const pick = hash(pu + seed, pv);
    const n = smoothNoise(u * 18, v * 12, seed + 9);
    let col = pick < 0.25 ? HIDE_GREY : pick < 0.6 ? HIDE : pick < 0.85 ? HIDE_DARK : HIDE_LIGHT;
    if (n > 0.72) col = col === HIDE_DARK ? HIDE : HIDE_LIGHT;
    else if (n < 0.25) col = HIDE_DARK;
    return dark ? (col === HIDE_LIGHT ? HIDE : HIDE_DARK) : col;
  };
}

/** Rough bark on a pole, darker on its shaded side. */
const poleBark = (shade: boolean): Shader => (u, v) => (hash(Math.floor(v * 30), Math.floor(u * 3)) < 0.15 ? POLE_DARK : shade ? POLE_DARK : u < 0.3 ? POLE_LIGHT : POLE);

/** A thin upright pole from (x, y) on the ground, `h` pixels tall, `t` tiles thick. */
function pole(m: IsoModel, x: number, y: number, h: number, t = 0.08, z = 0): void {
  m.box(x - t / 2, y - t / 2, z, t, t, h, { top: POLE_LIGHT, left: poleBark(false), right: poleBark(true) });
}

/** A pole leaning from one point to another (both in grid space, z in pixels), as a thin ribbon. */
function strut(m: IsoModel, a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, w = 0.07): void {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  m.quad({ x: a.x - w / 2, y: a.y + w / 2, z: a.z }, d, { x: w, y: -w, z: 0 }, (u) => (hash(Math.floor(u * 40), 1) < 0.12 ? POLE_DARK : POLE));
  m.quad({ x: a.x, y: a.y, z: a.z + 2 }, d, { x: 0, y: 0, z: -2 }, POLE_DARK);
}

// ---------------------------------------------------------------- the tents

/**
 * A goblin tent: hides slung over a ridge pole along x on two crossed pairs of
 * sticks, pegged out to the ground on both sides, with the end facing the
 * viewer (+x) left open on a dark inside. 2x2 tiles.
 */
function tent(seed: number): IsoModel {
  const m = new IsoModel();
  const H = 34;
  const x0 = 0.25;
  const x1 = 1.75;
  // The back slope (towards -y), mostly hidden: drawn first so the front covers it.
  m.quad({ x: x0, y: 1, z: H }, { x: x1 - x0, y: 0, z: 0 }, { x: 0, y: -0.82, z: -H }, hides(seed, true));
  // The open end: a dark triangle under the ridge, with a hide flap pulled half across.
  m.quad({ x: x1, y: 0.18, z: H }, { x: 0, y: 1.64, z: 0 }, { x: 0, y: 0, z: -H }, (u, v) => {
    const half = Math.abs(u - 0.5) * 2;
    if (half > v) return null;
    if (u < 0.32 && half < v) return hides(seed + 3)(u * 2, v);
    return v > 0.92 ? HIDE_DARK : INSIDE;
  });
  // The front slope (towards +y), lit.
  m.quad({ x: x0, y: 1, z: H }, { x: x1 - x0, y: 0, z: 0 }, { x: 0, y: 0.82, z: -H }, hides(seed));
  // Pegs and guy-lines along the foot of the front.
  for (let i = 0; i < 3; i++) {
    const x = x0 + 0.2 + i * 0.55;
    pole(m, x, 1.95, 5, 0.05);
  }
  // The crossed sticks at each end, poking up past the ridge, and the ridge pole's ends.
  for (const x of [x0 - 0.02, x1 + 0.02]) {
    strut(m, { x, y: 0.55, z: 0 }, { x, y: 1.18, z: H + 10 });
    strut(m, { x, y: 1.45, z: 0 }, { x, y: 0.82, z: H + 10 });
  }
  m.box(x0 - 0.12, 0.96, H - 1, x1 - x0 + 0.24, 0.07, 3, { top: POLE_LIGHT, left: POLE, right: POLE_DARK });
  // A string of teeth or bones tied off the front sticks.
  for (let k = 0; k < 4; k++) m.box(x1 + 0.03, 1.12 + k * 0.04, H - 8 - k * 3, 0.03, 0.03, 2, { top: BONE, left: BONE, right: BONE_DARK });
  return m;
}

// ---------------------------------------------------------------- the lookout

/** A lookout: four crooked saplings lashed into a platform high above the camp, with a ladder up the front. 2x2 tiles. */
function lookout(): IsoModel {
  const m = new IsoModel();
  const H = 64;
  const legs = [[0.35, 0.35], [1.65, 0.35], [0.35, 1.65], [1.65, 1.65]] as const;
  // Back legs first.
  for (const [x, y] of legs.slice(0, 2)) pole(m, x, y, H + 14, 0.1);
  // Cross braces on the two visible sides.
  strut(m, { x: 0.35, y: 1.65, z: 4 }, { x: 1.65, y: 1.65, z: H - 6 });
  strut(m, { x: 1.65, y: 0.35, z: 4 }, { x: 1.65, y: 1.65, z: H - 6 });
  // The platform of lashed poles.
  m.box(0.22, 0.22, H, 1.56, 1.56, 4, {
    top: (u, v) => (Math.floor(u * 10) % 2 === 0 ? POLE_LIGHT : POLE) + 0 * v,
    left: (u) => (Math.floor(u * 10) % 2 === 0 ? POLE : POLE_DARK),
    right: POLE_DARK,
  });
  // A low rail of hide stretched round the back and sides.
  m.quad({ x: 0.22, y: 0.22, z: H + 14 }, { x: 1.56, y: 0, z: 0 }, { x: 0, y: 0, z: -10 }, hides(41, true));
  m.quad({ x: 0.22, y: 0.22, z: H + 14 }, { x: 0, y: 1.56, z: 0 }, { x: 0, y: 0, z: -10 }, hides(43, true));
  for (const [x, y] of legs.slice(2)) pole(m, x, y, H + 14, 0.1);
  // A sheep's skull on the front corner, and a horn hung under it.
  m.box(1.58, 1.58, H + 14, 0.14, 0.14, 6, { top: BONE, left: BONE, right: BONE_DARK });
  m.box(1.6, 1.7, H - 2, 0.05, 0.2, 5, { top: BONE, left: BONE_DARK, right: BONE_DARK });
  // The ladder: two rails and rungs, leaning against the front.
  strut(m, { x: 0.7, y: 2.05, z: 0 }, { x: 0.7, y: 1.7, z: H });
  strut(m, { x: 1.1, y: 2.05, z: 0 }, { x: 1.1, y: 1.7, z: H });
  for (let r = 1; r < 8; r++) {
    const t = r / 8;
    m.box(0.7, 2.05 - t * 0.35, t * H, 0.4, 0.04, 2, { top: POLE_LIGHT, left: POLE, right: POLE_DARK });
  }
  return m;
}

// ---------------------------------------------------------------- the litter

/** The litter they carried Mother on: two poles along x and crosspieces, with her red quilt dragged half off it and a dark stain. 2x1 tiles. */
function litter(): IsoModel {
  const m = new IsoModel();
  for (const y of [0.22, 0.78]) m.box(0.02, y - 0.04, 0, 1.96, 0.08, 4, { top: POLE_LIGHT, left: POLE, right: POLE_DARK });
  for (let i = 0; i < 5; i++) m.box(0.35 + i * 0.32, 0.18, 4, 0.06, 0.64, 2, { top: POLE_LIGHT, left: POLE, right: POLE_DARK });
  // The quilt: patchwork, rumpled, one corner hanging down off the near pole to the grass.
  const quilt: Shader = (u, v) => {
    const pu = Math.floor(u * 6);
    const pv = Math.floor(v * 3);
    const fu = u * 6 - pu;
    const fv = v * 3 - pv;
    if (fu < 0.08 || fv < 0.1) return QUILT_CREAM;
    const fold = smoothNoise(u * 8, v * 5, 77);
    const blood = Math.hypot(u - 0.3, (v - 0.5) * 0.7) < 0.12 + smoothNoise(u * 20, v * 20, 3) * 0.05;
    if (blood) return BLOOD;
    const base = (pu + pv) % 3 === 0 ? QUILT_BLUE : (pu + pv) % 3 === 1 ? QUILT_RED : QUILT_CREAM;
    return fold < 0.35 ? (base === QUILT_CREAM ? 0xb8a682 : base === QUILT_RED ? QUILT_DARK : 0x2c4266) : base;
  };
  m.quad({ x: 0.2, y: 0.15, z: 7 }, { x: 1.4, y: 0, z: 0 }, { x: 0, y: 0.7, z: 0 }, quilt);
  m.quad({ x: 0.9, y: 0.85, z: 7 }, { x: 0.7, y: 0, z: 0 }, { x: 0.05, y: 0.15, z: -7 }, (u, v) => quilt(0.5 + u * 0.5, 0.8 + v * 0.2));
  return m;
}

// ---------------------------------------------------------------- the cookfire's spit

/** Two forked stakes and a green stick across them over the fire, with what's left of one of Iran's hens on it. 1x1 tile. */
function spit(): IsoModel {
  const m = new IsoModel();
  for (const y of [0.08, 0.92]) {
    pole(m, 0.5, y, 26, 0.07);
    strut(m, { x: 0.5, y, z: 22 }, { x: 0.42, y, z: 30 }, 0.05);
    strut(m, { x: 0.5, y, z: 22 }, { x: 0.58, y, z: 30 }, 0.05);
  }
  m.box(0.47, 0.02, 25, 0.06, 0.96, 2, { top: POLE_LIGHT, left: POLE, right: POLE_DARK });
  // The bird: a scorched lump on the stick.
  m.box(0.4, 0.38, 19, 0.2, 0.24, 8, { top: 0xa86a3a, left: 0x8a4a26, right: 0x5a3018 });
  return m;
}

// ---------------------------------------------------------------- hurdles and stakes

/** A hurdle of hazel rods woven between stakes, two tiles long along x: the side of their pen. */
function hurdle(): IsoModel {
  const m = new IsoModel();
  for (let i = 0; i <= 4; i++) pole(m, 0.05 + i * 0.475, 0.5, 20, 0.06);
  m.quad({ x: 0.05, y: 0.5, z: 18 }, { x: 1.9, y: 0, z: 0 }, { x: 0, y: 0, z: -16 }, (u, v) => {
    const row = Math.floor(v * 7);
    const weave = (Math.floor(u * 20) + row) % 2 === 0;
    if (hash(Math.floor(u * 60), row) < 0.04) return null;
    return weave ? POLE : row % 2 ? POLE_DARK : POLE_LIGHT;
  });
  return m;
}

/** A stake with a sheep's skull jammed on top, and rags tied round it: the goblins marking what's theirs. 1x1 tile. */
function skullPole(seed: number): IsoModel {
  const m = new IsoModel();
  pole(m, 0.5, 0.5, 46, 0.08);
  // Rags.
  m.quad({ x: 0.54, y: 0.5, z: 38 }, { x: 0.18, y: 0.06, z: -6 }, { x: 0.02, y: 0, z: -14 }, (u, v) => (hash(seed, Math.floor(v * 6)) < 0.5 ? OCHRE : HIDE_DARK) + 0 * u);
  // The skull: a long pale box for the snout, a rounder one for the crown, dark sockets, and curled horns.
  m.box(0.4, 0.42, 46, 0.2, 0.16, 9, { top: BONE, left: BONE, right: BONE_DARK });
  m.box(0.43, 0.56, 47, 0.14, 0.14, 6, {
    top: BONE,
    left: (u, v) => (v > 0.2 && v < 0.55 && (u < 0.35 || u > 0.65) ? INSIDE : BONE),
    right: BONE_DARK,
  });
  for (const [x, y] of [[0.36, 0.45], [0.6, 0.45]] as const) m.box(x, y, 53, 0.06, 0.08, 5, { top: BONE_DARK, left: 0x8a7a5a, right: 0x6a5a40 });
  return m;
}

// ---------------------------------------------------------------- the scratched stone

/**
 * A grey boulder with a flat face towards the camp, and pictures scratched on it
 * in white and smeared with ochre: a great swollen figure lying down, little
 * figures all round her, and a tall thin one standing apart, holding a cup.
 */
function scratchedStone(): PixelCanvas {
  const c = new PixelCanvas(44, 40);
  c.ellipse(22, 25, 19, 13, ROCK, ROCK_DARK, ROCK_LIGHT);
  c.ellipse(21, 17, 15, 10, ROCK, ROCK_DARK, ROCK_LIGHT);
  // Lichen.
  const rnd = seededRandom(91);
  for (let i = 0; i < 18; i++) {
    const x = 8 + rnd() * 28;
    const y = 10 + rnd() * 24;
    if (c.isSolid(x, y)) c.set(x, y, rnd() < 0.5 ? 0x9aa070 : 0x7a8a5a);
  }
  const s = (x: number, y: number, col = SCRATCH) => c.set(x, y, col);
  // The big one, lying along the bottom: a swollen oval body, a head, a crown of spikes.
  for (let a = 0; a < Math.PI * 2; a += 0.12) s(Math.round(19 + Math.cos(a) * 7), Math.round(25 + Math.sin(a) * 3.2));
  for (let x = 13; x <= 25; x += 2) s(x, 25, OCHRE);
  for (let a = 0; a < Math.PI * 2; a += 0.5) s(Math.round(29 + Math.cos(a) * 2), Math.round(24 + Math.sin(a) * 2));
  s(28, 21);
  s(30, 21);
  s(29, 20);
  // The little ones, round her: stick figures.
  for (const [x, y] of [[11, 19], [15, 18], [20, 18], [25, 18], [11, 29], [27, 29]] as const) {
    s(x, y - 2);
    s(x, y - 1);
    s(x, y);
    s(x - 1, y + 1);
    s(x + 1, y + 1);
  }
  // The tall thin one, apart on the right, holding out a cup.
  for (let y = 12; y <= 22; y++) s(35, y);
  s(34, 23);
  s(36, 23);
  s(35, 11, OCHRE);
  s(34, 11, OCHRE);
  s(36, 11, OCHRE);
  s(34, 15);
  s(33, 16);
  s(32, 16);
  s(31, 15);
  s(31, 16);
  c.outline();
  return c;
}

// ---------------------------------------------------------------- heather

/** A clump of heather on the open fell: a low dome of purple-flecked green. */
function heather(seed: number): PixelCanvas {
  const c = new PixelCanvas(34, 20);
  const rnd = seededRandom(seed);
  for (let i = 0; i < 150; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    const x = 17 + Math.cos(a) * r * 13;
    const y = 13 + Math.sin(a) * r * 5 - (1 - r) * 5;
    const roll = rnd();
    c.set(x, y, roll < 0.35 ? HEATHER : roll < 0.5 ? HEATHER_LIGHT : roll < 0.75 ? P.leafDark : roll < 0.9 ? HEATHER_DARK : P.grassDark);
  }
  return c;
}

/** Registers a canvas drawn around one tile's middle, `footY` pixels down from its top. */
function registerOnTile(scene: Phaser.Scene, key: string, c: PixelCanvas, footY: number): void {
  c.toTexture(scene, key);
  // The tile's back corner is half a tile above its middle.
  MODEL_ART[key] = { key, originX: 0.5, originY: (footY - TILE_HEIGHT / 2) / c.height };
}

export function generateGreyfells(scene: Phaser.Scene): void {
  registerModel(scene, 'gf-tent-0', tent(301).render());
  registerModel(scene, 'gf-tent-1', tent(317).render());
  registerModel(scene, 'gf-lookout', lookout().render());
  registerModel(scene, 'gf-litter', litter().render());
  registerModel(scene, 'gf-spit', spit().render());
  registerModel(scene, 'gf-hurdle', hurdle().render());
  registerModel(scene, 'gf-skullpole-0', skullPole(5).render());
  registerModel(scene, 'gf-skullpole-1', skullPole(9).render());
  registerOnTile(scene, 'gf-stone', scratchedStone(), 30);
  for (let i = 0; i < 3; i++) registerOnTile(scene, `gf-heather-${i}`, heather(331 + i * 13), 15);
  // The hole in the hill: a bigger, rougher mound than the wolves' cave, its mouth at the front corner.
  const warren = caveEntrance(4, 104, 37);
  warren.canvas.toTexture(scene, 'gf-warren');
  MODEL_ART['gf-warren'] = { key: 'gf-warren', originX: warren.anchorX / warren.canvas.width, originY: warren.anchorY / warren.canvas.height };
}

