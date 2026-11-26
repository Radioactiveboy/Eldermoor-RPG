import Phaser from 'phaser';
import { block, boardWall, HovelLook, hovel, hovelSized, line, post, rubbleStone } from './gloomhaven';
import { IsoModel, lipped, Shader, Vec3 } from './IsoModel';
import { MODEL_ART, registerModel, WALL_HEIGHT } from './interior';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';
import { mixColor, smoothNoise } from './scorch';
import { generateShamblesFolk } from './shamblesfolk3d';

/**
 * The Shambles, Gloomhaven's east quarter (world/ShamblesYard.ts, and inside,
 * world/ShamblesMap.ts): Saul Rendle's slaughterhouse, Morrow Vetch's tannery
 * and its yard of pits, the Red Aprons' barn with the dog pit in it, and Old
 * Scritch the rat-catcher's den. Out of doors, the buildings are the town's
 * own hovels (art/gloomhaven.ts) dressed for their trades; indoors, everything
 * is painted here: whitewash gone pink with splashing over a drain, tarred
 * boards hung with hides, slatted louvres, traps and skins, and the pit.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const mix = mixColor;
const darken = (c: number, f = 0.75) => mix(c, 0x000000, 1 - f);
const lighten = (c: number, f = 0.2) => mix(c, 0xffffff, f);

// Timber, black and tarred, grey where it's weathered.
const TAR = 0x2e2622;
const TAR_DARK = 0x1c1614;
const TAR_LIGHT = 0x463a32;
const GREYBOARD = 0x6a6258;
const GREYBOARD_DARK = 0x48423b;
const OAK = 0x6e5a44;
const OAK_DARK = 0x463828;
const OAK_LIGHT = 0x8e7658;
const DEAD = 0x5a5248;
const DEAD_DARK = 0x37312b;
const DEAD_LIGHT = 0x7e766a;
// Whitewash, gone pink and brown low down with splashing.
const WASH = 0xb8b0a0;
const WASH_LIGHT = 0xd0c8b6;
const WASH_DARK = 0x8a8274;
const STONE = 0x5e5b56;
const STONE_DARK = 0x3d3b38;
const STONE_LIGHT = 0x7c7870;
const IRON = 0x3a3a40;
const IRON_LIGHT = 0x6a6a74;
const STEEL = 0xb8bcc6;
const STEEL_DARK = 0x7a7e88;
const RUST = 0x6a3e26;
// Meat, fat, bone and blood.
const FLESH = 0xc06a5a;
const FLESH_DARK = 0x8a3a32;
const FLESH_LIGHT = 0xe0948a;
const FAT = 0xf0e2d0;
const FAT_DARK = 0xd0bca4;
const PORK = 0xe8c4b0;
const PORK_DARK = 0xc09484;
const BONE = 0xe8e0c8;
const BONE_DARK = 0xb8ae94;
const BLOOD = 0x5a1414;
const BLOOD_DARK = 0x3a0c0e;
const BLOOD_WET = 0x7a1a1a;
// Hides and leather.
const HIDE = 0xa8784a;
const HIDE_DARK = 0x7a5232;
const HIDE_LIGHT = 0xc89a66;
const RAWHIDE = 0xd8c0a0;
const LEATHER = 0x6a3e22;
const LEATHER_LIGHT = 0x8e5a32;
const LEATHER_DARK = 0x46281a;
// The pits: lime, and bark liquor from tea to tar.
const LIME = 0xe0dccc;
const LIME_DARK = 0xb8b4a4;
const LIQUOR = [0x8a5a2a, 0x6a3e1c, 0x4a2a14, 0x2a1a10];
const BARK = 0x6a4a32;
const BARK_DARK = 0x46301e;
const BARK_LIGHT = 0x8e6a4a;
const STRAW = 0xc8a85a;
const STRAW_DARK = 0x9a7e3e;
const MUD = 0x3a3024;
const MUD_DARK = 0x271f17;
const LIT = 0xf0b45a;
const LIT_DEEP = 0xc06a2a;
const LIT_HOT = 0xffe0a0;
const RAT = 0x5a5048;
const RAT_DARK = 0x3a3430;
const RAT_LIGHT = 0x7a7068;
const PINK = 0xc89a8a;
const CHALK = 0xe8e6dc;
const SLATE = 0x2a2c30;

/** A rough plank shader: boards along u, seams, knots, rot near the foot. */
function rough(boards: number, base: number, seed: number, along: 'u' | 'v' = 'v'): Shader {
  return (u, v) => {
    const a = along === 'v' ? u : v;
    const b = along === 'v' ? v : u;
    const i = Math.floor(a * boards);
    const f = (a * boards) % 1;
    if (f < 0.08) return darken(base, 0.55);
    let c = hash(i, seed) < 0.3 ? darken(base, 0.85) : hash(i, seed + 1) > 0.8 ? lighten(base, 0.08) : base;
    if (hash(i * 7 + Math.floor(b * 9), seed + 3) < 0.05) c = darken(c, 0.7);
    if (Math.sin(b * 40 + i * 3) > 0.94) c = lighten(c, 0.06);
    return c;
  };
}

/** A hide stretched flat: tan, with the shape of the beast it was, the edges pierced for the lacing. */
function hideFace(u: number, v: number, tone = HIDE, fur = false): number | null {
  const cu = u - 0.5;
  const cv = v - 0.5;
  const body = Math.abs(cu) < 0.36 - Math.abs(cv) * 0.18 && Math.abs(cv) < 0.42;
  const legs = (Math.abs(cv - 0.32) < 0.07 || Math.abs(cv + 0.3) < 0.07) && Math.abs(cu) < 0.46;
  const neck = Math.abs(cu) < 0.1 && cv < -0.36 && cv > -0.48;
  if (!body && !legs && !neck) return null;
  const n = smoothNoise(u * 6, v * 6, tone);
  if (fur && (Math.abs(cu) > 0.3 || Math.abs(cv) > 0.36)) return n > 0.5 ? 0x8a8478 : 0x6a645a;
  return n > 0.68 ? lighten(tone, 0.12) : n < 0.3 ? darken(tone, 0.82) : tone;
}

// ---------------------------------------------------------------- out of doors: the buildings

/** The tile-local y of the front wall of a w-wide hovel trimmed to d deep (see hovelSized). */
const frontY = (w: number, d: number) => (w === d ? 0.22 + w - 0.54 : 0.22 + (w - 0.54) * ((d - 0.44) / (w - 0.44)));

/** A pig split down the middle and hung by its heels from a hook: pale pork, the ribs showing, fat at the edge. */
function hangingPig(m: IsoModel, x: number, y: number, ztop: number, len = 22, seed = 1): void {
  line(m, { x, y, z: ztop + 3 }, { x, y, z: ztop }, IRON_LIGHT, 0.015);
  m.box(x - 0.09, y - 0.04, ztop - len, 0.18, 0.1, len, {
    top: FAT,
    left: (u, v) => {
      const w = 0.5 - Math.abs(u - 0.5);
      if (v > 0.88 && w < 0.32) return null; // the snout end tapers
      if (v < 0.08 && w < 0.36) return null; // the trotters
      if (w < 0.08) return FAT_DARK;
      // The cut face: ribs in rows, red meat, white fat.
      if (u > 0.3 && u < 0.7 && v > 0.25 && v < 0.65) return Math.floor(v * 14 + seed) % 2 ? FLESH : FAT;
      return hash(Math.floor(u * 6), Math.floor(v * 10) + seed) < 0.2 ? PORK_DARK : PORK;
    },
    right: (_u, v) => (v < 0.08 ? null : darken(PORK, 0.78)),
  });
}

/** A side of something bigger (not beef), hung from the rail: dark meat, a broad shoulder of fat. */
function hangingSide(m: IsoModel, x: number, y: number, ztop: number): void {
  line(m, { x, y, z: ztop + 3 }, { x, y, z: ztop }, IRON_LIGHT, 0.015);
  m.box(x - 0.13, y - 0.05, ztop - 28, 0.26, 0.12, 28, {
    top: FAT,
    left: (u, v) => {
      const w = 0.5 - Math.abs(u - 0.5);
      if (v > 0.9 && w < 0.3) return null;
      if (u < 0.2) return v < 0.4 ? FAT : FAT_DARK;
      return smoothNoise(u * 4, v * 9, 3) > 0.62 ? FLESH_LIGHT : v > 0.7 ? FLESH_DARK : FLESH;
    },
    right: darken(FLESH_DARK, 0.8),
  });
}

/**
 * Saul Rendle's slaughterhouse (5 x 4): rubble stone, two storeys under a
 * slumped slate roof; the killing floor's doors in the middle, a cleaver on
 * the sign over them, a hatch to the shop with its counter let down and the
 * day's joints on it, a hoist beam with its tackle out at the gable for the
 * hides going up to the loft, and old blood down the stone below the hatch.
 */
function slaughterhouse(): IsoModel {
  const look: HovelLook = {
    seed: 401, size: 5, H: 70, R: 46, walls: 'stone', roof: 'slate', lean: 0.06, sag: 5,
    front: [
      { u0: 0.06, u1: 0.3, y0: 30, y1: 52, pane: 'lit' },
      { u0: 0.08, u1: 0.24, y0: 8, y1: 24, pane: 'shuttered' },
      { u0: 0.74, u1: 0.9, y0: 8, y1: 24, pane: 'dark' },
      { u0: 0.74, u1: 0.92, y0: 34, y1: 52, pane: 'boarded' },
    ],
    side: [{ u0: 0.3, u1: 0.5, y0: 10, y1: 26, pane: 'shuttered' }, { u0: 0.62, u1: 0.8, y0: 36, y1: 50, pane: 'dark' }],
    door: [0.4, 0.62], chimney: { at: 0.86, lean: -0.12 }, sign: 'cleaver', lantern: true, crow: 0.3,
  };
  const m = hovelSized(look, 5, 4);
  const fy = frontY(5, 4);
  const W = 5 - 0.44;
  const at = (u: number) => 0.22 + W * u;
  // Old blood run down the stone from under the hatch, and splashed up either side of the door.
  m.quad({ x: at(0.05), y: fy + 0.012, z: 30 }, { x: at(0.32) - at(0.05), y: 0, z: 0 }, { x: 0, y: 0, z: -24 }, (u, v) => {
    const streak = smoothNoise(u * 18, v * 2, 7);
    if (streak > 0.6 - v * 0.2) return v > 0.8 ? BLOOD_DARK : BLOOD;
    return null;
  });
  m.quad({ x: at(0.36), y: fy + 0.012, z: 14 }, { x: at(0.66) - at(0.36), y: 0, z: 0 }, { x: 0, y: 0, z: -8 }, (u, v) => {
    if (u > 0.12 && u < 0.88) return null;
    return hash(Math.floor(u * 30), Math.floor(v * 8)) < 0.3 + v * 0.4 ? BLOOD_DARK : null;
  });
  // The shop's counter: a thick board let down on chains under the hatch, worn and scored, and the joints on it.
  const cx = at(0.06);
  const cw = at(0.3) - cx;
  m.box(cx - 0.04, fy, 30, cw + 0.08, 0.34, 3, {
    top: (u, v) => (hash(Math.floor(u * 40), Math.floor(v * 6)) < 0.12 ? BLOOD : Math.floor(u * 8) % 3 === 0 ? OAK_DARK : v > 0.8 ? OAK_LIGHT : OAK),
    left: OAK_DARK,
    right: darken(OAK_DARK, 0.8),
  });
  for (const dx of [0.02, cw - 0.02]) line(m, { x: cx + dx, y: fy + 0.3, z: 33 }, { x: cx + dx, y: fy, z: 52 }, IRON, 0.015);
  // A ham, a row of chops, a heap of sausages, a pig's head looking out at the lane.
  m.box(cx + 0.1, fy + 0.08, 33, 0.26, 0.18, 5, { top: (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.25 ? BONE : FLESH), left: (u) => (u < 0.2 ? FAT : PORK_DARK), right: darken(PORK_DARK, 0.8) });
  for (let i = 0; i < 4; i++) m.box(cx + 0.42 + i * 0.09, fy + 0.12, 33, 0.07, 0.14, 1.5, { top: i % 2 ? FLESH : FLESH_LIGHT, left: FAT, right: FAT_DARK });
  for (let i = 0; i < 5; i++) m.cylinder(cx + 0.82 + (i % 3) * 0.05, fy + 0.12 + Math.floor(i / 3) * 0.07, 33 + Math.floor(i / 3) * 1.5, 0.035, 1.5, () => 0x8a4a3a, 0xa45a48);
  m.box(cx + cw - 0.3, fy + 0.06, 33, 0.24, 0.22, 7, {
    top: PORK,
    left: (u, v) => {
      // The face: little shut eyes, the snout towards us, an ear flopped forward.
      if (v > 0.55 && Math.abs(u - 0.5) < 0.2) return v > 0.7 && Math.abs(u - 0.5) < 0.12 ? PINK : PORK;
      if (Math.abs(v - 0.35) < 0.06 && (Math.abs(u - 0.28) < 0.06 || Math.abs(u - 0.72) < 0.06)) return 0x3a2420;
      return v < 0.15 ? PORK_DARK : PORK;
    },
    right: PORK_DARK,
  });
  // The hoist: a beam out from under the gable, a pulley, and its rope down to a hook.
  const hx = at(0.97) + 0.1;
  m.box(hx - 0.1, fy - 0.9, 92, 0.12, 1.4, 4, { top: TAR_LIGHT, left: TAR, right: TAR_DARK });
  m.cylinder(hx - 0.04, fy + 0.42, 86, 0.07, 6, (u) => (u < 0.4 ? IRON_LIGHT : IRON), IRON_LIGHT);
  line(m, { x: hx - 0.04, y: fy + 0.46, z: 86 }, { x: hx - 0.04, y: fy + 0.46, z: 44 }, 0x9a865e, 0.012);
  m.box(hx - 0.07, fy + 0.43, 40, 0.06, 0.06, 4, { top: IRON_LIGHT, left: IRON, right: IRON });
  // The loft door under the hoist, half open on darkness.
  m.quad({ x: at(0.8), y: fy + 0.01, z: 74 }, { x: at(0.94) - at(0.8), y: 0, z: 0 }, { x: 0, y: 0, z: -16 }, (u, v) => (u < 0.08 || u > 0.92 || v < 0.06 ? TAR_DARK : u > 0.5 ? 0x0e0a08 : Math.floor(u * 6) % 2 ? GREYBOARD_DARK : GREYBOARD));
  return m;
}

/**
 * Morrow Vetch's tannery (5 x 4): a long, low shed of tarred boards under
 * old thatch, with a drying loft above walled in louvres, slats tilted to let
 * the wind through and hides draped out over a pole to dry; a sign of a hide;
 * barrels by the door; and stains down the boards from everything that's ever
 * been carried in and out.
 */
function tannery(): IsoModel {
  const H = 58;
  const look: HovelLook = {
    seed: 421, size: 5, H, R: 40, walls: 'boards', roof: 'thatch', lean: -0.08, sag: 6,
    front: [{ u0: 0.64, u1: 0.82, y0: 30, y1: 46, pane: 'lit' }],
    side: [{ u0: 0.36, u1: 0.56, y0: 30, y1: 46, pane: 'dark' }],
    door: [0.18, 0.34], chimney: { at: 0.85, lean: 0.1 }, sign: 'hide', lantern: true, hole: [0.3, 0.5],
  };
  const m = hovelSized(look, 5, 4);
  const fy = frontY(5, 4);
  const W = 5 - 0.44;
  const x0 = 0.22;
  const top = 6 + H;
  const lean = -0.08;
  // The loft: a band of louvres right along the front, under the eaves, dark between the slats.
  const louvre: Shader = (u, v) => {
    const z = v * 20;
    const slat = z % 4;
    if (Math.floor(u * 28) % 7 === 0) return TAR_DARK; // the uprights
    if (slat < 1.2) return 0x0c0a08;
    return slat < 2 ? GREYBOARD : slat < 3.2 ? GREYBOARD_DARK : darken(GREYBOARD_DARK, 0.8);
  };
  m.quad({ x: x0 + lean, y: fy + 0.02, z: top - 2 }, { x: W, y: 0, z: 0 }, { x: -lean * 0.3, y: 0, z: -20 }, louvre);
  // A pole along the louvres with hides draped over it to dry, one stiff and pale, one still wet.
  m.box(x0, fy + 0.1, top - 6, W, 0.05, 1.5, { top: DEAD_LIGHT, left: DEAD, right: DEAD_DARK });
  const hides: Array<[number, number, number]> = [[0.08, 0.7, HIDE], [0.36, 0.55, RAWHIDE], [0.62, 0.8, HIDE_DARK], [0.84, 0.5, HIDE]];
  for (const [u, len, tone] of hides) {
    m.quad({ x: x0 + W * u, y: fy + 0.12, z: top - 5 }, { x: W * 0.16, y: 0, z: 0 }, { x: 0, y: 0.04, z: -24 * len }, (hu, hv) => {
      if (hv > 0.85 && Math.abs(hu - 0.5) < 0.3 - (hv - 0.85) * 2) return darken(tone, 0.8);
      if (hv > 0.85) return null;
      const n = smoothNoise(hu * 5, hv * 8, tone);
      return n > 0.7 ? lighten(tone, 0.1) : n < 0.28 ? darken(tone, 0.82) : tone;
    });
  }
  // Brown stains down the front boards, from the yard's slop.
  m.quad({ x: x0, y: fy + 0.012, z: 24 }, { x: W, y: 0, z: 0 }, { x: 0, y: 0, z: -18 }, (u, v) => (smoothNoise(u * 22, v * 3, 11) > 0.66 - v * 0.15 ? (v > 0.7 ? 0x2a1a10 : 0x3e2a18) : null));
  // A great copper's flue out through the side, smoking.
  m.cylinder(x0 + W + 0.12, 1.6, 30, 0.1, 54, (u) => (u < 0.4 ? 0x7a5a3a : u > 0.7 ? 0x3a2a1a : 0x5a4028), P.soot);
  return m;
}

/**
 * The Red Aprons' barn in the corner of the yard (3 x 3): tall and windowless,
 * its black boards gapped and patched, every window boarded from inside, the
 * big door hung on a rail and chained, a lantern over it, three notches cut
 * in the post, and the gaps glowing at night.
 */
function pitBarn(): IsoModel {
  const look: HovelLook = {
    seed: 433, size: 3, H: 56, R: 38, walls: 'boards', roof: 'shingle', lean: 0.05, sag: 3,
    front: [{ u0: 0.7, u1: 0.9, y0: 8, y1: 22, pane: 'boarded' }],
    side: [{ u0: 0.3, u1: 0.5, y0: 10, y1: 24, pane: 'boarded' }, { u0: 0.66, u1: 0.86, y0: 26, y1: 40, pane: 'boarded' }],
    door: [0.24, 0.62], tarp: 0.7,
  };
  const m = hovel(look);
  const fy = 0.22 + 3 - 0.54;
  const W = 3 - 0.44;
  const x0 = 0.22;
  // The door's rail, and the chain hanging across it with a padlock.
  m.box(x0 + W * 0.16, fy + 0.02, 6 + 34, W * 0.56, 0.05, 2, { top: IRON_LIGHT, left: IRON, right: IRON });
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const sagZ = 6 + 18 - Math.sin(t * Math.PI) * 5;
    m.box(x0 + W * (0.25 + t * 0.36), fy + 0.04, sagZ, 0.04, 0.03, 1.2, { top: IRON_LIGHT, left: i % 2 ? IRON_LIGHT : IRON, right: IRON });
  }
  block(m, x0 + W * 0.42, fy + 0.03, 6 + 11, 0.07, 0.05, 3, 0x8a7a3a);
  // A lantern on a bracket by the door.
  m.box(x0 + W * 0.66, fy, 6 + 36, 0.03, 0.14, 1, { top: IRON, left: IRON, right: IRON });
  m.box(x0 + W * 0.66 - 0.04, fy + 0.08, 6 + 28, 0.1, 0.1, 7, {
    top: IRON,
    left: (u, v) => (u < 0.2 || u > 0.8 || v < 0.15 || v > 0.85 ? IRON : LIT_HOT),
    right: (u, v) => (u < 0.2 || u > 0.8 || v < 0.15 || v > 0.85 ? IRON : LIT),
  });
  // Light through the gaps in the boards, low down, where something moves inside.
  m.quad({ x: x0 + W * 0.66, y: fy + 0.012, z: 20 }, { x: W * 0.3, y: 0, z: 0 }, { x: 0, y: 0, z: -12 }, (u, v) => (Math.floor(u * 9) % 3 === 0 && hash(Math.floor(u * 9), Math.floor(v * 3)) < 0.5 ? (v < 0.5 ? LIT_DEEP : 0x7a3a1a) : null));
  // The three notches in the doorpost.
  for (let i = 0; i < 3; i++) m.box(x0 + W * 0.22, fy + 0.02, 6 + 22 + i * 3, 0.05, 0.02, 1, { top: 0x0e0a08, left: 0x0e0a08, right: 0x0e0a08 });
  return m;
}

/**
 * Old Scritch's den (3 x 3, seen front-on from the road when mirrored): a
 * crooked shack of boards under rotten thatch, leaning on its own chimney;
 * its front nailed across with rat skins in rows; traps hung by the door; and
 * a board with a rat painted on it.
 */
function ratDen(): IsoModel {
  const H = 34;
  const look: HovelLook = {
    seed: 441, size: 3, H, R: 30, walls: 'boards', roof: 'thatch', lean: 0.16, sag: 6,
    front: [{ u0: 0.66, u1: 0.86, y0: 8, y1: 20, pane: 'lit' }],
    side: [{ u0: 0.4, u1: 0.6, y0: 8, y1: 20, pane: 'shuttered' }],
    door: [0.2, 0.42], chimney: { at: 0.1, lean: 0.2 }, sign: 'rat', hole: [0.7, 0.45],
  };
  const m = hovel(look);
  const fy = 0.22 + 3 - 0.54;
  const W = 3 - 0.44;
  const x0 = 0.22;
  // Rat skins, nailed in rows across the front: grey, brown, one or two the size of a cat.
  const rnd = seededRandom(443);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 7; i++) {
      const u = 0.46 + i * 0.03 + (row % 2) * 0.012;
      if (u > 0.64 && row < 2) continue;
      const big = rnd() < 0.15;
      const zt = 6 + H - 4 - row * 8;
      const len = big ? 7 : 5;
      const tone = rnd() < 0.5 ? RAT : rnd() < 0.5 ? RAT_LIGHT : 0x6a5a48;
      m.quad({ x: x0 + W * u + 0.16 * (zt / H) * 0.6, y: fy + 0.014, z: zt }, { x: big ? 0.08 : 0.06, y: 0, z: 0 }, { x: 0, y: 0, z: -len }, (su, sv) => (sv > 0.85 && Math.abs(su - 0.5) > 0.15 ? null : sv < 0.1 ? 0x2a2420 : tone));
      line(m, { x: x0 + W * u + 0.03 + 0.16 * (zt / H) * 0.6, y: fy + 0.016, z: zt - len }, { x: x0 + W * u + 0.035, y: fy + 0.016, z: zt - len - 4 }, PINK, 0.006);
    }
  }
  // Traps on nails by the door: a wire cage, a gin trap, a snare.
  m.box(x0 + W * 0.06, fy + 0.02, 6 + 22, 0.1, 0.06, 6, { top: IRON_LIGHT, left: (u, v) => (Math.floor(u * 6) % 2 && Math.floor(v * 4) % 2 ? null : IRON_LIGHT) as number, right: IRON });
  m.quad({ x: x0 + W * 0.06, y: fy + 0.016, z: 6 + 14 }, { x: 0.12, y: 0, z: 0 }, { x: 0, y: 0, z: -6 }, (u, v) => (Math.abs(Math.hypot(u - 0.5, v - 0.5) - 0.38) < 0.08 || (Math.abs(u - 0.5) < 0.05 && v > 0.5) ? RUST : null));
  return m;
}

// ---------------------------------------------------------------- out of doors: the yard and the lane

/** A rail on two posts under the slaughterhouse eaves, three pigs and a side of something hung from it. */
function carcassRail(): IsoModel {
  const m = new IsoModel();
  for (const x of [0.12, 1.88]) post(m, x, 0.5, 0.05, 40);
  m.box(0.08, 0.46, 38, 1.84, 0.08, 3, { top: DEAD_LIGHT, left: DEAD, right: DEAD_DARK });
  hangingPig(m, 0.42, 0.5, 38, 22, 1);
  hangingSide(m, 0.86, 0.5, 38);
  hangingPig(m, 1.26, 0.5, 38, 21, 3);
  hangingPig(m, 1.6, 0.5, 38, 23, 5);
  // Blood dripped into the mud beneath, and a bucket to catch it.
  m.quad({ x: 0.2, y: 0.3, z: 0.1 }, { x: 1.6, y: 0, z: 0 }, { x: 0, y: 0.5, z: 0 }, (u, v) => (Math.hypot((u * 4) % 1 - 0.5, v - 0.5) < 0.3 && hash(Math.floor(u * 4), 2) < 0.7 ? BLOOD_DARK : null));
  bucket(m, 1.0, 0.62, true);
  return m;
}

/** A wooden pail; `blood` fills it. */
function bucket(m: IsoModel, x: number, y: number, blood = false, z = 0): void {
  m.cylinder(x, y, z, 0.11, 7, (u, v) => (Math.abs(v - 0.25) < 0.08 || Math.abs(v - 0.75) < 0.08 ? IRON : u < 0.3 ? OAK_LIGHT : u > 0.7 ? OAK_DARK : OAK), blood ? (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.38 ? BLOOD_WET : OAK_DARK) : OAK_DARK);
}

/** A butcher's block: a section of elm trunk, the top hollowed with years of chopping, a cleaver bitten into it. */
function choppingBlock(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.3, 14, (u, v) => {
    if (v > 0.9) return MUD;
    const g = Math.sin(u * 40 + v * 3);
    return g > 0.8 ? OAK_LIGHT : u > 0.7 ? OAK_DARK : v < 0.12 ? 0x7a4a3a : OAK;
  }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.44) return OAK_DARK;
    if (hash(Math.floor(u * 20), Math.floor(v * 20)) < 0.2) return BLOOD;
    return (d * 30) % 1 < 0.25 ? 0x9a7a5a : 0xb0906a;
  });
  // The cleaver, blade down in the wood, its handle up and towards us.
  m.box(0.42, 0.44, 13, 0.3, 0.02, 6, { top: STEEL, left: (u, v) => (v > 0.7 ? STEEL_DARK : u < 0.15 ? 0xe0e4ec : STEEL), right: STEEL_DARK });
  m.box(0.7, 0.43, 17, 0.2, 0.04, 2, { top: 0x5a3a22, left: 0x4a2c18, right: 0x2e1a10 });
  return m;
}

/** A tub of blood and offal by the block, flies over it. */
function bloodTub(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.28, 10, (u, v) => (Math.abs(v - 0.3) < 0.06 || Math.abs(v - 0.75) < 0.06 ? IRON : u < 0.3 ? OAK : u > 0.7 ? darken(OAK_DARK, 0.8) : OAK_DARK), (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.42) return OAK_DARK;
    const n = smoothNoise(u * 8, v * 8, 5);
    return n > 0.7 ? FLESH_DARK : n > 0.6 ? 0x8a7a5a : BLOOD_WET;
  });
  return m;
}

/** A pen of hurdles against the slaughterhouse wall, three pigs in the muck, a trough. */
function pigPen(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.05, y: 0.05, z: 0.1 }, { x: 1.9, y: 0, z: 0 }, { x: 0, y: 1.9, z: 0 }, (u, v) => (smoothNoise(u * 6, v * 6, 9) > 0.55 ? MUD_DARK : 0x4a3a28));
  // Back and side hurdles first, then the pigs, then the near ones.
  const hurdle = (a: Vec3, b: Vec3) => {
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      post(m, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 0.03, 15);
    }
    for (const z of [5, 10, 14]) line(m, { x: a.x, y: a.y, z }, { x: b.x, y: b.y, z }, (z === 10 ? DEAD_LIGHT : DEAD) as number, 0.03);
  };
  hurdle({ x: 0.08, y: 0.08, z: 0 }, { x: 1.92, y: 0.08, z: 0 });
  hurdle({ x: 0.08, y: 0.08, z: 0 }, { x: 0.08, y: 1.92, z: 0 });
  // The trough.
  m.box(0.2, 0.2, 0, 0.7, 0.2, 4, { top: (u, v) => (u > 0.05 && u < 0.95 && v > 0.2 && v < 0.8 ? 0x5a4a2a : OAK_DARK), left: OAK_DARK, right: darken(OAK_DARK, 0.8) });
  const pig = (x: number, y: number, along: boolean, tone: number) => {
    const L = 0.62;
    const B = 0.28;
    const dx = along ? L : B;
    const dy = along ? B : L;
    m.box(x, y, 2, dx, dy, 8, {
      top: (u, v) => (hash(Math.floor(u * 6), Math.floor(v * 6)) < 0.15 ? darken(tone, 0.85) : lighten(tone, 0.08)),
      left: (u, v) => (v > 0.7 && hash(Math.floor(u * 8), 3) < 0.5 ? MUD : tone),
      right: (_u, v) => (v > 0.7 ? MUD : darken(tone, 0.8)),
    });
    // Legs, snout and ears.
    for (const [lx, ly] of along ? [[0.08, 0.04], [0.5, 0.04], [0.08, 0.22], [0.5, 0.22]] : [[0.04, 0.08], [0.22, 0.08], [0.04, 0.5], [0.22, 0.5]]) block(m, x + lx, y + ly, 0, 0.05, 0.05, 2.5, darken(tone, 0.7));
    const sx = along ? x + L : x + B / 2 - 0.06;
    const sy = along ? y + B / 2 - 0.06 : y + L;
    m.box(sx, sy, 4, 0.12, 0.12, 4, { top: PINK, left: (u, v) => (v > 0.4 && Math.abs(u - 0.5) < 0.3 ? (Math.abs(u - 0.3) < 0.08 || Math.abs(u - 0.7) < 0.08 ? 0x5a3030 : PINK) : tone), right: darken(PINK, 0.8) });
    m.box(sx + (along ? -0.06 : 0.02), sy + (along ? 0.02 : -0.06), 9, 0.06, 0.06, 3, { top: tone, left: PINK, right: darken(tone, 0.8) });
  };
  pig(0.3, 0.55, true, PORK);
  pig(1.25, 0.3, false, 0xd8b0a0);
  pig(0.9, 1.25, true, 0x8a7060);
  hurdle({ x: 1.92, y: 0.08, z: 0 }, { x: 1.92, y: 1.92, z: 0 });
  hurdle({ x: 0.08, y: 1.92, z: 0 }, { x: 1.92, y: 1.92, z: 0 });
  return m;
}

/** A heap of horns, skulls and bones by the slaughterhouse wall, waiting for the bone-boiler. */
function bones(): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(457);
  for (let i = 0; i < 22; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * 0.3;
    const x = 0.5 + Math.cos(a) * r;
    const y = 0.5 + Math.sin(a) * r;
    const z = (0.3 - r) * 22 * rnd();
    if (rnd() < 0.5) m.box(x - 0.12, y, z, 0.24, 0.04, 1.6, { top: BONE, left: BONE_DARK, right: darken(BONE_DARK, 0.8) });
    else m.box(x, y - 0.12, z, 0.04, 0.24, 1.6, { top: BONE, left: BONE_DARK, right: darken(BONE_DARK, 0.8) });
  }
  // A cow's skull on top, horns and all, and a ram's horn curled beside it.
  m.box(0.4, 0.42, 6, 0.2, 0.16, 6, { top: BONE, left: (u, v) => ((Math.abs(u - 0.3) < 0.08 || Math.abs(u - 0.7) < 0.08) && Math.abs(v - 0.35) < 0.12 ? 0x2a2420 : BONE), right: BONE_DARK });
  line(m, { x: 0.4, y: 0.5, z: 11 }, { x: 0.22, y: 0.48, z: 15 }, 0xd8c8a0, 0.03);
  line(m, { x: 0.6, y: 0.5, z: 11 }, { x: 0.78, y: 0.48, z: 15 }, 0xd8c8a0, 0.03);
  m.cylinder(0.7, 0.66, 1, 0.08, 3, () => 0x9a8a6a, 0x5a4a3a);
  return m;
}

/** A pit sunk in the yard and boarded round the rim: lime (white), or bark liquor (`depth` 0 the weakest, 3 the strongest). */
function pit(kind: 'lime' | number): IsoModel {
  const m = new IsoModel();
  const liquor = kind === 'lime' ? LIME : LIQUOR[kind];
  // The planked rim, a few inches proud of the mud.
  m.box(0.06, 0.06, 0, 0.88, 0.88, 3, {
    top: (u, v) => {
      const inner = u > 0.12 && u < 0.88 && v > 0.12 && v < 0.88;
      if (!inner) return Math.floor((u + v) * 12) % 3 === 0 ? OAK_DARK : DEAD;
      const n = smoothNoise(u * 7, v * 7, kind === 'lime' ? 3 : kind * 5 + 1);
      if (kind === 'lime') return n > 0.7 ? 0xf4f0e2 : n < 0.3 ? LIME_DARK : LIME;
      // A sheen, a hide's back breaking the surface, a scum at the edges.
      if (Math.abs(u - 0.5) < 0.2 && Math.abs(v - 0.55) < 0.08 && kind === 2) return HIDE_DARK;
      if (n > 0.78) return lighten(liquor, 0.2);
      if (u < 0.18 || u > 0.82 || v < 0.18 || v > 0.82) return n > 0.5 ? 0x5a4a2a : darken(liquor, 0.8);
      return liquor;
    },
    left: (u) => (Math.floor(u * 8) % 2 ? DEAD_DARK : DEAD),
    right: DEAD_DARK,
  });
  // A paddle left leaning in it.
  if (kind === 1 || kind === 'lime') line(m, { x: 0.3, y: 0.5, z: 3 }, { x: 0.12, y: 0.62, z: 18 }, OAK_LIGHT, 0.03);
  return m;
}

/** A frame of poles with two hides laced into it to dry. */
function hideRack(): IsoModel {
  const m = new IsoModel();
  for (const x of [0.12, 1.88]) post(m, x, 0.5, 0.05, 32);
  for (const z of [30, 4]) m.box(0.1, 0.47, z, 1.8, 0.06, 2, { top: DEAD_LIGHT, left: DEAD, right: DEAD_DARK });
  const frame = (x0: number, tone: number, fur: boolean) => {
    m.quad({ x: x0, y: 0.5, z: 28 }, { x: 0.82, y: 0, z: 0 }, { x: 0, y: 0, z: -22 }, (u, v) => {
      // The lacing from the hide's edge to the frame.
      if (Math.floor(u * 16) % 4 === 0 && (v < 0.08 || v > 0.92)) return 0x9a865e;
      if (Math.floor(v * 14) % 4 === 0 && (u < 0.06 || u > 0.94)) return 0x9a865e;
      return hideFace(u, v, tone, fur);
    });
  };
  frame(0.12, HIDE, false);
  frame(1.02, 0x8a7a68, true);
  return m;
}

/** Oak bark, stacked in slabs under a scrap of sacking, for the tan pits. */
function barkStack(): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(461);
  for (let row = 0; row < 6; row++) {
    for (let i = 0; i < 3; i++) {
      const x = 0.1 + i * 0.27 + (row % 2) * 0.04;
      const t = rnd();
      m.box(x, 0.18 + rnd() * 0.06, row * 3, 0.26, 0.62, 3, {
        top: (u, v) => (Math.sin(v * 30 + u * 4) > 0.6 ? BARK_LIGHT : BARK),
        left: (u) => (Math.floor(u * 6) % 2 ? 0xb08a5a : 0x9a7448),
        right: t < 0.5 ? BARK_DARK : darken(BARK_DARK, 0.8),
      });
    }
  }
  m.quad({ x: 0.08, y: 0.16, z: 18.2 }, { x: 0.84, y: 0, z: 0 }, { x: 0, y: 0.7, z: 0 }, (u, v) => (u > 0.55 ? null : hash(Math.floor(u * 9), Math.floor(v * 9)) < 0.5 ? 0x8a7a5a : 0x6a5a40));
  return m;
}

/** The fleshing beam: a log on legs sloping down from waist height, a hide over it, and the two-handled knife. */
function fleshBeam(): IsoModel {
  const m = new IsoModel();
  for (const x of [0.2, 0.3]) line(m, { x, y: 0.5, z: 0 }, { x: x + 0.05, y: 0.5, z: 20 }, DEAD_DARK, 0.04);
  line(m, { x: 0.78, y: 0.5, z: 0 }, { x: 0.82, y: 0.5, z: 2 }, DEAD_DARK, 0.04);
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    m.cylinder(0.18 + t * 0.66, 0.5, 18 - t * 16, 0.09, 3, (u) => (u < 0.4 ? DEAD_LIGHT : DEAD), DEAD_LIGHT);
  }
  // The hide over it, hanging down either side.
  m.quad({ x: 0.28, y: 0.3, z: 19 }, { x: 0.4, y: 0, z: -9 }, { x: 0, y: 0.4, z: 0 }, (u, v) => hideFace(0.2 + u * 0.6, v, RAWHIDE) ?? RAWHIDE);
  m.quad({ x: 0.28, y: 0.7, z: 19 }, { x: 0.4, y: 0, z: -9 }, { x: 0, y: 0, z: -9 }, (u, v) => (v > 0.9 && hash(Math.floor(u * 10), 1) < 0.5 ? null : smoothNoise(u * 5, v * 5, 2) > 0.6 ? 0xc8ac8a : RAWHIDE));
  // The knife, laid across.
  m.box(0.5, 0.42, 16, 0.04, 0.3, 1, { top: STEEL, left: STEEL_DARK, right: STEEL_DARK });
  return m;
}

/** A barrow of dog's muck, "pure", for the tanners. */
function pureBarrow(): IsoModel {
  const m = new IsoModel();
  m.box(0.15, 0.25, 6, 0.6, 0.5, 8, {
    top: (u, v) => (u > 0.08 && u < 0.92 && v > 0.1 && v < 0.9 ? (hash(Math.floor(u * 10), Math.floor(v * 10)) < 0.4 ? 0x4a3a22 : 0x5e4a2c) : OAK_DARK),
    left: (u) => (Math.floor(u * 5) % 2 ? OAK : OAK_DARK),
    right: OAK_DARK,
  });
  m.quad({ x: 0.75, y: 0.36, z: 6 }, { x: 0, y: 0.28, z: 0 }, { x: 0, y: 0, z: -6 }, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.5 ? (Math.hypot(u - 0.5, v - 0.5) < 0.12 ? IRON : DEAD_DARK) : null));
  for (const y of [0.3, 0.7]) line(m, { x: 0.15, y, z: 10 }, { x: -0.15, y, z: 6 }, DEAD, 0.03);
  return m;
}

/** Hides folded and salted in a heap, a sack of salt split open beside them. */
function hideHeap(): IsoModel {
  const m = new IsoModel();
  for (let i = 0; i < 5; i++) {
    const tone = [HIDE, HIDE_DARK, 0x8a7060, HIDE_LIGHT, RAWHIDE][i];
    m.box(0.12 + (i % 2) * 0.04, 0.14 + (i % 3) * 0.03, i * 3, 0.7, 0.66, 3, {
      top: (u, v) => (hash(Math.floor(u * 12), Math.floor(v * 12) + i) < 0.15 ? 0xf0ece0 : tone),
      left: (u) => (Math.sin(u * 30) > 0.5 ? darken(tone, 0.8) : tone),
      right: darken(tone, 0.72),
    });
  }
  m.cylinder(0.8, 0.8, 0, 0.13, 8, (u) => (u < 0.3 ? 0xb8ac90 : 0x8a7e66), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.35 ? 0xf4f0e6 : 0x9a8e76));
  return m;
}

/** A board on a stake, chalked with the night's fights. */
function chalkBoard(): IsoModel {
  const m = new IsoModel();
  post(m, 0.2, 0.5, 0.04, 34);
  m.quad({ x: 0.22, y: 0.32, z: 34 }, { x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: -20 }, (u, v) => {
    if (u < 0.06 || u > 0.94 || v < 0.06 || v > 0.94) return OAK_DARK;
    // Lines of chalk scrawl.
    const row = Math.floor(v * 7);
    const inRow = (v * 7) % 1;
    if (row > 0 && row < 6 && inRow > 0.35 && inRow < 0.6 && u > 0.12 && u < 0.88 - (row % 3) * 0.12 && hash(Math.floor(u * 40), row) < 0.7) return CHALK;
    return SLATE;
  });
  return m;
}

/** A kennel of boards by the barn door, a chain running out of it to a stake, and a bowl. */
function kennel(): IsoModel {
  const m = new IsoModel();
  m.box(0.2, 0.2, 0, 0.6, 0.6, 12, {
    top: TAR,
    left: (u, v) => (Math.hypot(u - 0.5, (v - 0.75) * 1.4) < 0.25 && v > 0.35 ? 0x0c0a08 : rough(5, GREYBOARD_DARK, 3)(u, v)),
    right: rough(5, darken(GREYBOARD_DARK, 0.8), 4),
  });
  m.quad({ x: 0.16, y: 0.5, z: 20 }, { x: 0.68, y: 0, z: 0 }, { x: 0, y: 0.36, z: -8 }, (u) => (Math.floor(u * 8) % 2 ? TAR : TAR_LIGHT));
  m.quad({ x: 0.16, y: 0.5, z: 20 }, { x: 0.68, y: 0, z: 0 }, { x: 0, y: -0.36, z: -8 }, TAR_DARK);
  for (let i = 0; i < 6; i++) m.box(0.45 + i * 0.07, 0.86, 0.5, 0.04, 0.03, 1, { top: IRON_LIGHT, left: IRON, right: IRON });
  m.cylinder(0.85, 0.85, 0, 0.08, 2, () => 0x6a6a72, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0x3a4a4a : 0x6a6a72));
  return m;
}

/** A ferret hutch on legs, its front of wire. */
function hutch(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.12, 0.2], [0.55, 0.2], [0.12, 0.8], [0.55, 0.8]]) block(m, x, y, 0, 0.05, 0.05, 8, DEAD_DARK);
  m.box(0.1, 0.15, 8, 0.5, 0.7, 12, {
    top: TAR_LIGHT,
    left: (u, v) => (u < 0.06 || u > 0.94 || v < 0.1 || v > 0.9 ? OAK_DARK : Math.floor(u * 14) % 2 && Math.floor(v * 10) % 2 ? IRON_LIGHT : (u > 0.3 && u < 0.7 && v > 0.55 ? (u < 0.45 ? 0xe8e0c8 : 0xc8bca0) : 0x1a1410)),
    right: (u, v) => (Math.floor(u * 12) % 2 && Math.floor(v * 10) % 2 ? IRON_LIGHT : 0x1a1410),
  });
  return m;
}

/** Traps hung on a post by the den door: cages, a gin trap, snares on a string. */
function trapPost(): IsoModel {
  const m = new IsoModel();
  post(m, 0.3, 0.5, 0.05, 36);
  m.box(0.34, 0.4, 24, 0.16, 0.14, 8, { top: IRON_LIGHT, left: (u, v) => (Math.floor(u * 8) % 2 && Math.floor(v * 6) % 2 ? null : IRON_LIGHT) as number, right: (u, v) => (Math.floor(u * 6) % 2 && Math.floor(v * 6) % 2 ? null : IRON) as number });
  m.quad({ x: 0.36, y: 0.6, z: 16 }, { x: 0.14, y: 0, z: 0 }, { x: 0, y: 0, z: -8 }, (u, v) => (Math.abs(Math.hypot(u - 0.5, v - 0.5) - 0.36) < 0.08 || (v > 0.5 && Math.abs(u - 0.5) < 0.06) ? RUST : null));
  for (let i = 0; i < 4; i++) line(m, { x: 0.34, y: 0.5, z: 34 - i }, { x: 0.38 + i * 0.03, y: 0.5, z: 26 - i * 2 }, 0x9a865e, 0.006);
  return m;
}

/** A knacker's cart, a tarpaulin roped over its load, a hoof sticking out from under. */
function offalCart(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.25, 10, 1.6, 0.6, 6, { top: OAK, left: (u) => (Math.floor(u * 10) % 2 ? OAK_DARK : OAK), right: OAK_DARK });
  // The load under its tarpaulin, lumpy.
  m.box(0.18, 0.28, 16, 1.4, 0.54, 8, {
    top: (u, v) => (smoothNoise(u * 6, v * 4, 2) > 0.6 ? 0x4a4e3e : 0x3c4032),
    left: (u, v) => (v > 0.8 && Math.abs(u - 0.7) < 0.05 ? 0x2a2420 : smoothNoise(u * 6, v * 3, 4) > 0.6 ? 0x4a4e3e : 0x3c4032),
    right: 0x2a2e22,
  });
  // A hoof and a bit of leg poking out at the back.
  m.box(1.56, 0.5, 16, 0.24, 0.07, 2, { top: 0x6a4a3a, left: 0x5a3a2a, right: 0x3a2418 });
  m.box(1.78, 0.49, 15, 0.06, 0.09, 3, { top: 0x2a2420, left: 0x1a1414, right: 0x1a1414 });
  // Wheels and shafts.
  for (const x of [0.5, 1.3]) {
    m.quad({ x: x - 0.25, y: 0.86, z: 20 }, { x: 0.5, y: 0, z: 0 }, { x: 0, y: 0, z: -20 }, (u, v) => {
      const d = Math.hypot((u - 0.5) * 2, (v - 0.5) * 2);
      if (d > 1) return null;
      if (d > 0.8) return DEAD_DARK;
      if (d < 0.2) return IRON;
      return Math.abs(((Math.atan2(v - 0.5, u - 0.5) / Math.PI) * 3 + 6) % 1 - 0.5) < 0.12 ? DEAD : null;
    });
  }
  for (const y of [0.3, 0.8]) line(m, { x: 0.1, y, z: 12 }, { x: -0.4, y, z: 4 }, DEAD, 0.03);
  return m;
}

/** A stretch of gutter down the lane: a channel in the mud, running red-brown, a skin of fat on it. */
function gutter(seed: number): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const c = 0.5 + Math.sin(u * 5 + seed) * 0.1;
    const d = Math.abs(v - c - (u - 0.5) * 0.3);
    if (d > 0.16) return d < 0.2 ? MUD_DARK : null;
    const n = smoothNoise(u * 9, v * 9, seed);
    return n > 0.75 ? 0x8a6a4a : d > 0.11 ? 0x3a1a14 : n > 0.55 ? BLOOD_WET : BLOOD;
  });
  return m;
}

// ---------------------------------------------------------------- indoors: the walls

export type ShamblesWallKind =
  | 'plain' | 'window' | 'door' | 'brace'
  | 'hooks' | 'tools' | 'sausages' | 'notches' | 'hoist'
  | 'hides' | 'shelf' | 'louvre' | 'hatch'
  | 'traps' | 'skins' | 'cages'
  | 'chalk' | 'chains' | 'boarded' | 'lantern';

/** How each room's walls are made: limewashed stone, tarred boards, open louvres, rough barn boards. */
export type ShamblesWallStyle = 'wash' | 'boards' | 'slats' | 'barn';

const H = WALL_HEIGHT;

/** The bare wall: whitewash over stone, splashed and pink low down; tarred boards; slats with daylight between; barn boards gapped. */
function wallBase(style: ShamblesWallStyle, x: number, y: number, seed: number): number {
  if (style === 'wash') {
    // A sole and top plate of black oak; whitewash between, with the stones showing through where it's flaked.
    if (y < 5) return y < 2 ? TAR_LIGHT : TAR;
    if (y > H - 5) return y > H - 2 ? TAR_DARK : STONE_DARK;
    const course = Math.floor(y / 9);
    const off = (course % 2) * 7;
    const joint = y % 9 < 0.9 || (x + off) % 14 < 0.9;
    const n = smoothNoise(x / 7 + seed, y / 9, seed);
    let c = n > 0.66 ? WASH_LIGHT : n < 0.3 ? WASH_DARK : WASH;
    if (joint) c = darken(c, 0.88);
    if (smoothNoise(x / 4 + 30, y / 5, seed + 3) > 0.8) c = hash(Math.floor(x / 3), Math.floor(y / 3)) < 0.5 ? STONE : STONE_LIGHT;
    // Splashes of blood, thick near the floor and flung higher in places.
    const reach = H - 16 - smoothNoise(x / 5, 1, seed + 5) * 34;
    if (y > reach && hash(Math.floor(x * 1.5), Math.floor(y * 1.2) + seed) < (y - reach) / 60) return hash(Math.floor(x), Math.floor(y)) < 0.5 ? BLOOD : BLOOD_DARK;
    // A brown tidemark along the bottom where the floor is sluiced.
    if (y > H - 12) return mix(c, 0x6a3a2a, (y - (H - 12)) / 14);
    return c;
  }
  if (style === 'slats') {
    if (y < 4) return TAR;
    if (Math.floor(x) % 16 < 2) return TAR_DARK; // the uprights
    const s = (y + Math.floor(x / 16) * 2) % 7;
    if (s < 1.6 && y < H - 8) return mix(0x9aa6a0, 0x5a6460, y / H); // daylight between the slats
    return s < 2.4 ? GREYBOARD : s < 5 ? GREYBOARD_DARK : darken(GREYBOARD_DARK, 0.8);
  }
  // Boards (the tannery, the den) or barn boards (gapped, with light through them low down).
  const barn = style === 'barn';
  if (y < 5) return y < 2 ? TAR_LIGHT : TAR;
  if (y > H - 4) return TAR_DARK;
  const bw = barn ? 5 : 4;
  const i = Math.floor((x + seed * 3) / bw);
  const f = ((x + seed * 3) % bw) / bw;
  if (f < 0.14) return barn && hash(i, 7) < 0.3 && y > 40 ? 0x2a1c10 : TAR_DARK;
  const base = barn ? 0x4a3e32 : TAR_LIGHT;
  let c = hash(i, seed) < 0.3 ? darken(base, 0.85) : hash(i, seed + 2) > 0.8 ? lighten(base, 0.08) : base;
  if (Math.sin(y * 0.6 + i * 5) > 0.93) c = darken(c, 0.82);
  if (hash(i, Math.floor(y / 7) + seed) < 0.04) c = darken(c, 0.6); // a knot, a nail-hole
  // Damp creeping up from the floor.
  if (y > H - 18 && smoothNoise(x / 4, y / 3, seed + 9) > 0.5) c = mix(c, 0x2a3424, 0.45);
  return c;
}

/** What hangs on (or is cut into) a wall segment, over its base; null to show the wall. */
function wallDecor(kind: ShamblesWallKind, _style: ShamblesWallStyle, x: number, y: number, index: number): number | null {
  switch (kind) {
    case 'window': {
      if (x > 8 && x < 25 && y > 18 && y < 42) {
        if (x < 10 || x > 23 || y < 20 || y > 40) return TAR_DARK;
        if (Math.abs(x - 16.5) < 0.8) return TAR;
        // Horn panes, cloudy and yellow, daylight through them.
        const n = smoothNoise(x / 3, y / 3, index);
        return n > 0.6 ? 0xd8c890 : n < 0.3 ? 0x9a8a5a : 0xb8a870;
      }
      if (x > 7 && x < 26 && y >= 42 && y < 45) return OAK_DARK;
      return null;
    }
    case 'door': {
      if (x < 6 || x > 26 || y < 14) return null;
      if (x < 8 || x > 24 || y < 16) return TAR_DARK;
      if ((Math.floor(x) - 8) % 5 === 0) return TAR_DARK;
      if (Math.abs(y - 26) < 1.2 || Math.abs(y - 66) < 1.2) return x > 20 ? IRON : IRON_LIGHT;
      if (Math.abs(x - 10) < 1 && Math.abs(y - 48) < 2) return IRON_LIGHT;
      return (Math.floor(x) % 5) / 5 < 0.5 ? OAK_DARK : mix(OAK_DARK, TAR, 0.4);
    }
    case 'brace': {
      const t = (y - 8) / (H - 16);
      if (t > 0 && t < 1 && Math.abs(x - (3 + t * 26)) < 2.2) return Math.abs(x - (3 + t * 26)) > 1.6 ? TAR_DARK : TAR_LIGHT;
      return null;
    }
    case 'hooks': {
      // A rail along the wall with S-hooks, and joints hung from them: a ham, a pig's head, a string of tripe.
      if (y > 10 && y < 13) return y < 11 ? IRON_LIGHT : IRON;
      const hooks = [6, 16, 26];
      for (const [j, hx] of hooks.entries()) {
        if (Math.abs(x - hx) < 0.6 && y >= 13 && y < 18) return STEEL_DARK;
        const kind2 = (j + index) % 3;
        const dx = x - hx;
        const dy = y - 18;
        if (kind2 === 0 && dy > 0 && dy < 22 && Math.abs(dx) < 4 - dy * 0.05) return Math.abs(dx) > 3 ? FAT_DARK : dy > 18 ? BONE : hash(Math.floor(x), Math.floor(y / 2)) < 0.2 ? FAT : FLESH; // a ham
        if (kind2 === 1 && Math.hypot(dx / 3.6, (dy - 7) / 6) < 1) return Math.abs(dx) < 1.6 && dy > 9 ? PINK : Math.abs(dy - 4) < 0.8 && Math.abs(Math.abs(dx) - 1.6) < 0.6 ? 0x2a1a1a : PORK; // a head
        if (kind2 === 2 && dy > 0 && dy < 30 && Math.abs(dx - Math.sin(dy * 0.5) * 2) < 1.5) return (dy % 3) < 1 ? 0xc8b8a0 : 0xe0d4c0; // tripe
      }
      return null;
    }
    case 'tools': {
      // A rack of knives, saws and steels on pegs, and a bone-saw.
      if (y > 20 && y < 23 && x > 3 && x < 29) return OAK_DARK;
      for (const [k, tx] of [[0, 6], [1, 10], [2, 14], [0, 18], [3, 23]] as const) {
        const dx = x - tx;
        if (k === 0 && dx > -0.8 && dx < 0.8 && y > 23 && y < 27) return 0x4a2c18; // handle
        if (k === 0 && dx > -1 && dx < 1 + (y - 27) * 0.05 && y >= 27 && y < 38) return dx < 0 ? 0xe0e4ec : STEEL; // blade
        if (k === 1 && Math.abs(dx) < 0.7 && y > 23 && y < 44) return y < 27 ? 0x4a2c18 : IRON_LIGHT; // a steel
        if (k === 2 && dx > -1 && dx < 4 && y > 23 && y < 33) return y < 25 && dx > 2 ? 0x5a3a22 : (Math.floor(x) % 2 === 0 && y > 31 ? STEEL_DARK : STEEL); // a cleaver
        if (k === 3 && dx > -3 && dx < 3 && y > 23 && y < 34) return Math.abs(dx) > 2.4 || y < 25 ? IRON : (y > 32 && Math.floor(x) % 2 ? STEEL_DARK : null); // a bone-saw's frame
      }
      return null;
    }
    case 'sausages': {
      // Strings of sausages in loops from pegs, and a bunch of black puddings.
      if (y > 12 && y < 15 && x > 2 && x < 30) return OAK_DARK;
      for (const px of [5, 16, 27]) {
        const dx = x - px;
        const loop = 14 + Math.cos((dx / 6) * Math.PI) * -12 + 12;
        if (Math.abs(dx) < 6 && Math.abs(y - loop) < 1.6) return Math.floor((x + y) / 2) % 2 ? 0x9a5040 : 0x7a3a2e;
      }
      if (x > 12 && x < 20 && y > 30 && y < 46 && (Math.floor(x) % 2 === 0)) return y < 32 ? 0x9a865e : 0x2a1418;
      return null;
    }
    case 'notches': {
      // Three notches cut in a post, a fourth across them, and a slate of chalked marks under.
      if (x > 13 && x < 19) {
        if (y > 14 && y < 34 && Math.abs(x - 16) < 2.6) {
          for (const ny of [18, 23, 28]) if (Math.abs(y - ny) < 0.9 && Math.abs(x - 16) < 2.2) return 0x0e0a08;
          if (Math.abs((y - 16) - (x - 13) * 2.4) < 1 && index % 2) return 0x0e0a08;
          return TAR_LIGHT;
        }
      }
      if (x > 8 && x < 24 && y > 38 && y < 54) {
        if (x < 9 || x > 23 || y < 39 || y > 53) return OAK_DARK;
        const row = Math.floor((y - 40) / 3);
        if ((y - 40) % 3 < 1 && hash(Math.floor((x - 10) / 1.2), row + index) < 0.55 && x > 10 && x < 22) return CHALK;
        return SLATE;
      }
      return null;
    }
    case 'hoist': {
      // A beam across, a block and tackle, and the rope down to a gambrel.
      if (y > 8 && y < 12) return y < 9 ? TAR_LIGHT : TAR;
      if (Math.hypot(x - 16, y - 16) < 3.4) return Math.hypot(x - 16, y - 16) < 1.2 ? IRON_LIGHT : IRON;
      if ((Math.abs(x - 13.4) < 0.5 || Math.abs(x - 18.6) < 0.5) && y > 16 && y < 50) return 0x9a865e;
      if (Math.abs(y - 50) < 0.9 && x > 9 && x < 23) return IRON_LIGHT;
      if ((Math.abs(x - 9.5) < 0.6 || Math.abs(x - 22.5) < 0.6) && y > 50 && y < 55) return IRON_LIGHT;
      return null;
    }
    case 'hides': {
      // A hide nailed up flat to dry, and a second half over it.
      if (x > 3 && x < 29 && y > 10 && y < 56) {
        const c = hideFace((x - 3) / 26, (y - 10) / 46, index % 2 ? HIDE : HIDE_DARK, index % 3 === 0);
        if (c !== null) return c;
      }
      if (Math.abs(y - 10) < 0.8 && x > 4 && x < 28 && Math.floor(x) % 4 === 0) return IRON_LIGHT;
      return null;
    }
    case 'shelf': {
      // A shelf of crocks, jars of oil and a bottle of something brown, a tally of hides chalked under.
      if (y > 34 && y < 37 && x > 3 && x < 29) return y < 35 ? OAK_LIGHT : OAK_DARK;
      if (y > 22 && y <= 34) {
        if (x > 5 && x < 11 && y > 24) return y < 26 ? 0x6a4a2a : x < 7 ? 0xb88a5a : 0x8a5a32;
        if (x > 13 && x < 18 && y > 26) return y < 28 ? TAR : x < 14 ? 0x8a9a5a : 0x4a5a2a;
        if (x > 20 && x < 27 && y > 23) return y < 25 ? BARK_DARK : Math.abs(x - 23.5) < 1 && y > 28 && y < 31 ? CHALK : 0x8a6a4a;
      }
      if (y > 42 && y < 50 && x > 6 && x < 26 && (y - 42) % 2.6 < 0.9 && hash(Math.floor(x / 2), Math.floor(y)) < 0.7) return CHALK;
      return null;
    }
    case 'louvre':
      return null; // the slats are the wall itself
    case 'hatch': {
      // The hatch down the ladder, in the floor's corner, as seen against the wall: a trap and its ladder's top rungs.
      if (x > 8 && x < 24 && y > H - 20) {
        if (x < 9.5 || x > 22.5) return OAK_DARK;
        return (y - (H - 20)) % 5 < 1.2 ? OAK : 0x0c0a08;
      }
      return null;
    }
    case 'traps': {
      // Traps on nails: a gin trap, two cage traps, a coil of snare wire, and a ratting stick.
      if (Math.abs(Math.hypot(x - 9, y - 22) - 5) < 0.9) return RUST;
      if (Math.abs(x - 9) < 0.6 && y > 22 && y < 30) return RUST;
      for (const [cx, cy] of [[20, 18], [22, 38]] as const) {
        if (x > cx - 5 && x < cx + 5 && y > cy - 4 && y < cy + 5) return Math.floor(x) % 2 === 0 || Math.floor(y) % 3 === 0 ? IRON_LIGHT : null;
      }
      if (Math.abs(Math.hypot(x - 8, y - 44) - 3) < 0.6 || Math.abs(Math.hypot(x - 8, y - 44) - 1.5) < 0.5) return 0xa89a7a;
      if (Math.abs(x - 28 + (y - 10) * 0.05) < 0.8 && y > 10 && y < 70) return DEAD_LIGHT;
      return null;
    }
    case 'skins': {
      // Rat skins, nailed in rows, tails hanging.
      for (let row = 0; row < 4; row++) {
        const ry = 10 + row * 15;
        for (let i = 0; i < 4; i++) {
          const rx = 4 + i * 7 + (row % 2) * 3;
          if (x > rx && x < rx + 4 && y > ry && y < ry + 8) return hash(i + row * 5, index) < 0.5 ? RAT : RAT_LIGHT;
          if (Math.abs(x - rx - 2) < 0.4 && y >= ry + 8 && y < ry + 13) return PINK;
        }
      }
      return null;
    }
    case 'cages': {
      // Shelves of wire cages, and rats in them: grey bodies, pink tails, eyes catching the light.
      for (const sy of [14, 34, 54]) {
        if (y > sy + 13 && y < sy + 15 && x > 2 && x < 30) return OAK_DARK;
        if (y > sy && y < sy + 13 && x > 3 && x < 29) {
          if (Math.floor(x) % 3 === 0 || Math.floor(y - sy) % 4 === 0) return IRON_LIGHT;
          const rx = 8 + ((sy * 7 + index * 5) % 14);
          if (Math.hypot((x - rx) / 3, (y - sy - 9) / 2) < 1) return Math.abs(x - rx + 2) < 0.6 && Math.abs(y - sy - 8) < 0.6 ? 0xe04030 : RAT;
          return 0x140e0c;
        }
      }
      return null;
    }
    case 'chalk': {
      // The betting slate: names, odds, tallies, a drawing of a dog.
      if (x > 3 && x < 29 && y > 14 && y < 50) {
        if (x < 4.5 || x > 27.5 || y < 15.5 || y > 48.5) return OAK_DARK;
        const row = Math.floor((y - 17) / 5);
        if ((y - 17) % 5 < 1.2 && x > 6 && x < 26 - (row % 3) * 3 && hash(Math.floor(x / 1.4), row) < 0.7 && row < 6) return CHALK;
        return SLATE;
      }
      return null;
    }
    case 'chains': {
      // A ring bolted to the wall and chains from it, a collar, a muzzle of straps.
      if (Math.abs(Math.hypot(x - 16, y - 20) - 2.4) < 0.7) return IRON_LIGHT;
      for (const [dx, len] of [[-3, 30], [0, 40], [3, 26]] as const) {
        const cx = 16 + dx + Math.sin(y * 0.2) * 0.5;
        if (y > 22 && y < 22 + len && Math.abs(x - cx) < 0.8 && Math.floor(y) % 3 !== 0) return IRON_LIGHT;
      }
      if (Math.abs(Math.hypot(x - 8, y - 40) - 3) < 0.9) return LEATHER;
      return null;
    }
    case 'boarded': {
      if (x > 6 && x < 26 && y > 16 && y < 44) {
        const a = Math.abs((x - 6) / 20 - (y - 16) / 28) < 0.12;
        const b = Math.abs((x - 6) / 20 - (1 - (y - 16) / 28)) < 0.12;
        if (a || b) return a ? GREYBOARD : OAK_DARK;
        if (x < 8 || x > 24 || y < 18 || y > 42) return TAR_DARK;
        return 0x0e0c0a;
      }
      return null;
    }
    case 'lantern': {
      // An iron bracket and a lantern on it.
      if (Math.abs(y - 26) < 0.8 && x > 12 && x < 20) return IRON;
      if (x > 14 && x < 19 && y > 27 && y < 36) return x < 15 || x > 18 || y < 28 || y > 35 ? IRON : y < 31 ? LIT_HOT : LIT;
      return null;
    }
    default:
      return null;
  }
}

/** One wall segment ('<prefix>-wall-<side>-<kind>-<index>'), 32 pixels across, in a room's style. */
function shamblesWall(scene: Phaser.Scene, prefix: string, style: ShamblesWallStyle, side: 'back' | 'side', kind: ShamblesWallKind, index: number): void {
  const m = new IsoModel();
  const seed = index * 13 + (side === 'back' ? 3 : 7) + kind.length;
  const shade: Shader = (u, v) => {
    const x = u * 32;
    const y = v * H;
    return wallDecor(kind, style, x, y, index + (side === 'side' ? 5 : 0)) ?? wallBase(style, x + index * 32, y, seed);
  };
  const cap = 0.14;
  const capTone = style === 'wash' ? STONE_LIGHT : TAR_LIGHT;
  if (side === 'back') {
    m.quad({ x: 0, y: 0, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, shade);
    m.quad({ x: 0, y: -cap, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: cap, z: 0 }, lipped(capTone, lighten(capTone, 0.1)));
  } else {
    m.quad({ x: 0, y: 0, z: H }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -H }, (u, v) => {
      const c = shade(u, v);
      return c === null ? null : mix(c, 0x0e0a10, 0.22);
    });
    m.quad({ x: -cap, y: 0, z: H }, { x: cap, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, capTone);
  }
  registerModel(scene, `${prefix}-wall-${side}-${kind}-${index}`, m.render(false));
}

/** The kinds of wall each room has (see world/ShamblesMap.ts), and their style. */
export const SHAMBLES_WALLS: Record<string, { style: ShamblesWallStyle; kinds: ShamblesWallKind[] }> = {
  shk: { style: 'wash', kinds: ['plain', 'window', 'door', 'brace', 'hooks', 'tools', 'sausages', 'notches', 'hoist'] },
  shn: { style: 'boards', kinds: ['plain', 'window', 'door', 'brace', 'hides', 'tools', 'shelf', 'hatch'] },
  shl: { style: 'slats', kinds: ['plain', 'louvre', 'hides', 'hatch', 'brace'] },
  shr: { style: 'boards', kinds: ['plain', 'window', 'door', 'traps', 'skins', 'cages', 'shelf'] },
  shp: { style: 'barn', kinds: ['plain', 'door', 'chalk', 'chains', 'boarded', 'lantern', 'brace'] },
};

/** A corner post for a room in this style. */
function cornerPost(style: ShamblesWallStyle): IsoModel {
  const m = new IsoModel();
  const tone = style === 'wash' ? STONE : TAR;
  m.box(-0.16, -0.16, 0, 0.3, 0.3, H + 3, { top: lighten(tone, 0.1), left: tone, right: darken(tone, 0.7) });
  return m;
}

// ---------------------------------------------------------------- indoors: the slaughterhouse

/** A stone channel in the floor, sluiced towards the drain, dark and wet. */
function drain(alongX: boolean): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const a = alongX ? v : u;
    const b = alongX ? u : v;
    const d = Math.abs(a - 0.5);
    if (d > 0.2) return null;
    if (d > 0.14) return STONE_DARK;
    return smoothNoise(b * 8, a * 4, 3) > 0.6 ? BLOOD_WET : 0x2a1410;
  });
  return m;
}

/** An iron grating over the drain, in the middle of the killing floor. */
function grate(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.2, y: 0.2, z: 0.1 }, { x: 0.6, y: 0, z: 0 }, { x: 0, y: 0.6, z: 0 }, (u, v) => (u < 0.08 || u > 0.92 || v < 0.08 || v > 0.92 || Math.floor(u * 7) % 2 === 0 ? IRON_LIGHT : 0x0c0808));
  return m;
}

/** A stain on the stone or the boards: blood, old and new, in a splash. */
function bloodstain(seed: number): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const d = Math.hypot(u - 0.5, (v - 0.5) * 1.3);
    const n = smoothNoise(u * 5, v * 5, seed);
    if (d > 0.18 + n * 0.22) return hash(Math.floor(u * 24), Math.floor(v * 24) + seed) < 0.04 ? BLOOD_DARK : null;
    return n > 0.6 ? BLOOD_DARK : BLOOD;
  });
  return m;
}

/** Sawdust thrown down by the block, clotted pink in places. */
function sawdust(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const d = Math.hypot(u - 0.5, (v - 0.5) * 2);
    if (d > 0.48 + smoothNoise(u * 6, v * 3, 4) * 0.1) return null;
    const h = hash(Math.floor(u * 60), Math.floor(v * 30));
    return h < 0.2 ? 0xa08860 : h < 0.3 ? 0x9a6a5a : h > 0.9 ? 0xd8c090 : 0xc0a878;
  });
  return m;
}

/** A frame of oak in the middle of the floor, hooks along its beam, two carcasses hanging, a gambrel waiting. */
function hookFrame(): IsoModel {
  const m = new IsoModel();
  for (const x of [0.1, 1.9]) m.box(x - 0.06, 0.44, 0, 0.12, 0.12, 62, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.box(0.04, 0.42, 58, 1.92, 0.16, 5, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  hangingPig(m, 0.5, 0.5, 58, 30, 2);
  hangingSide(m, 1.05, 0.5, 58);
  line(m, { x: 1.55, y: 0.5, z: 58 }, { x: 1.55, y: 0.5, z: 40 }, 0x9a865e, 0.012);
  m.box(1.45, 0.48, 38, 0.2, 0.04, 2, { top: IRON_LIGHT, left: IRON, right: IRON });
  bucket(m, 0.6, 0.7, true);
  return m;
}

/** The scalding vat: a great copper on a brick firebox, steaming, a pig's ladder over it. */
function scaldVat(): IsoModel {
  const m = new IsoModel();
  m.box(0.08, 0.1, 0, 1.84, 0.8, 16, {
    top: STONE_DARK,
    left: (u, v) => {
      // The firebox's mouth, glowing.
      if (Math.abs(u - 0.5) < 0.12 && v > 0.4) return v > 0.75 ? P.fireYellow : v > 0.55 ? P.fireOrange : P.fireRed;
      const course = Math.floor(v * 5);
      return (v * 5) % 1 < 0.15 || ((u * 12 + course * 0.5) % 1) < 0.08 ? 0x4a3a32 : hash(Math.floor(u * 12), course) < 0.3 ? 0x7a3a2a : 0x8a4a32;
    },
    right: (_u, v) => ((v * 5) % 1 < 0.15 ? 0x3a2a22 : 0x6a3424),
  });
  m.cylinder(1, 0.5, 16, 0.42, 12, (u, v) => (v < 0.12 ? 0xd89a5a : u < 0.3 ? 0xc0784a : u > 0.7 ? 0x6a3a1e : 0x9a5a32), (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    return d > 0.44 ? 0xb06a3a : smoothNoise(u * 6, v * 6, 2) > 0.6 ? 0x8a7a6a : 0x6a5a4a;
  });
  // A plank across it.
  m.box(0.55, 0.42, 28, 0.9, 0.16, 2, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  return m;
}

/** A butcher's bench: a thick top scored with cuts, joints on it, a cleaver, a saw. */
function butcherBench(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.12, 0.2], [1.82, 0.2], [0.12, 0.76], [1.82, 0.76]]) block(m, x, y, 0, 0.08, 0.08, 20, OAK_DARK);
  m.box(0.06, 0.14, 20, 1.88, 0.72, 5, {
    top: (u, v) => (hash(Math.floor(u * 50), Math.floor(v * 12)) < 0.1 ? BLOOD : Math.sin(u * 60 + v * 5) > 0.92 ? 0x9a7a5a : 0xb8986e),
    left: (u) => (Math.floor(u * 9) % 2 ? OAK : OAK_DARK),
    right: OAK_DARK,
  });
  m.box(0.3, 0.3, 25, 0.4, 0.3, 4, { top: (u, v) => (Math.hypot(u - 0.3, v - 0.5) < 0.15 ? BONE : FLESH), left: (u) => (u < 0.2 ? FAT : FLESH_DARK), right: FLESH_DARK });
  for (let i = 0; i < 5; i++) m.box(0.9 + i * 0.1, 0.36, 25, 0.08, 0.2, 1.5, { top: i % 2 ? FLESH_LIGHT : FLESH, left: FAT, right: FAT_DARK });
  m.box(1.5, 0.5, 25, 0.22, 0.12, 0.8, { top: STEEL, left: STEEL_DARK, right: STEEL_DARK });
  m.box(1.72, 0.52, 25, 0.12, 0.05, 1.2, { top: 0x5a3a22, left: 0x4a2c18, right: 0x2e1a10 });
  bucket(m, 1.0, 0.9, true);
  return m;
}

/**
 * The shop counter at the front of the slaughterhouse (one tile of it, `part`
 * 0..2): scored oak on a stone base, joints, a pig's head, the brass scales.
 */
function shopCounter(part: number): IsoModel {
  const m = new IsoModel();
  m.box(0.06, 0.2, 0, 0.94, 0.6, 22, {
    top: (u, v) => (hash(Math.floor(u * 30), Math.floor(v * 10) + part) < 0.08 ? BLOOD : Math.floor(u * 6) % 3 === 0 ? OAK_DARK : v > 0.8 ? OAK_LIGHT : OAK),
    left: (u, v) => (v > 0.8 ? STONE_DARK : Math.floor(u * 5 + part) % 2 ? OAK_DARK : mix(OAK_DARK, TAR, 0.4)),
    right: OAK_DARK,
  });
  if (part === 0) {
    // The scales: a brass beam, two pans, weights beside.
    m.box(0.45, 0.48, 22, 0.04, 0.04, 14, { top: 0xd8a848, left: 0xb08a3a, right: 0x8a6a2a });
    m.box(0.2, 0.48, 35, 0.54, 0.04, 1, { top: 0xd8a848, left: 0xb08a3a, right: 0x8a6a2a });
    for (const x of [0.22, 0.72]) {
      line(m, { x, y: 0.5, z: 35 }, { x, y: 0.5, z: 27 }, 0x8a6a2a, 0.006);
      m.cylinder(x, 0.5, 26, 0.1, 1, () => 0xb08a3a, 0xd8a848);
    }
    for (const [x, h] of [[0.75, 3], [0.85, 2], [0.92, 1.5]] as const) m.cylinder(x, 0.32, 22, 0.035, h, () => IRON_LIGHT, IRON_LIGHT);
  } else if (part === 1) {
    m.box(0.2, 0.3, 22, 0.3, 0.3, 6, { top: PORK, left: (u, v) => (v > 0.55 && Math.abs(u - 0.5) < 0.18 ? PINK : Math.abs(v - 0.3) < 0.06 && Math.abs(Math.abs(u - 0.5) - 0.22) < 0.06 ? 0x3a2420 : PORK), right: PORK_DARK });
    for (let i = 0; i < 6; i++) m.cylinder(0.6 + (i % 3) * 0.08, 0.35 + Math.floor(i / 3) * 0.1, 22 + Math.floor(i / 3), 0.04, 1.5, () => 0x8a4a3a, 0xa45a48);
  } else {
    m.box(0.2, 0.3, 22, 0.5, 0.36, 4, { top: (u, v) => (Math.hypot(u - 0.3, v - 0.5) < 0.15 ? BONE : FLESH), left: (u) => (u < 0.15 ? FAT : FLESH_DARK), right: FLESH_DARK });
    m.box(0.72, 0.3, 22, 0.06, 0.4, 0.6, { top: STEEL, left: STEEL_DARK, right: STEEL_DARK });
  }
  return m;
}

/** The killing pen: hurdles in the corner, a pig in it, and the knacker's poleaxe leaning on the rail. */
function killPen(): IsoModel {
  const m = pigPen();
  line(m, { x: 1.95, y: 1.6, z: 0 }, { x: 2.1, y: 1.4, z: 30 }, OAK_LIGHT, 0.03);
  m.box(2.02, 1.36, 28, 0.08, 0.14, 4, { top: STEEL, left: STEEL_DARK, right: IRON });
  return m;
}

// ---------------------------------------------------------------- indoors: the tannery

/** A round vat sunk to its rim: lime, or bark liquor, a hide's back showing; a paddle in it. */
function vat(kind: 'lime' | number): IsoModel {
  const m = new IsoModel();
  const liquor = kind === 'lime' ? LIME : LIQUOR[kind];
  m.cylinder(0.5, 0.5, 0, 0.42, 10, (u, v) => (Math.abs(v - 0.3) < 0.07 || Math.abs(v - 0.78) < 0.07 ? IRON : u < 0.3 ? OAK : u > 0.7 ? OAK_DARK : mix(OAK, OAK_DARK, 0.5)), (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.44) return OAK_DARK;
    const n = smoothNoise(u * 7, v * 7, typeof kind === 'number' ? kind : 9);
    if (kind === 'lime') return n > 0.65 ? 0xf4f0e2 : n < 0.3 ? LIME_DARK : LIME;
    if (Math.abs(u - 0.45) < 0.15 && Math.abs(v - 0.55) < 0.08) return HIDE_DARK;
    return n > 0.78 ? lighten(liquor, 0.2) : liquor;
  });
  line(m, { x: 0.36, y: 0.5, z: 10 }, { x: 0.12, y: 0.62, z: 30 }, OAK_LIGHT, 0.03);
  return m;
}

/** The copper for boiling bark liquor: a squat brick stove and a great pot, a fire under it. */
function barkCopper(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.1, 0, 0.8, 0.8, 14, {
    top: 0x3a2a22,
    left: (u, v) => (Math.abs(u - 0.5) < 0.16 && v > 0.45 ? (v > 0.75 ? P.fireYellow : P.fireOrange) : (v * 4) % 1 < 0.15 ? 0x4a3a32 : 0x8a4a32),
    right: 0x6a3424,
  });
  m.cylinder(0.5, 0.5, 14, 0.36, 12, (u, v) => (v < 0.12 ? 0xd89a5a : u < 0.3 ? 0xc0784a : u > 0.7 ? 0x6a3a1e : 0x9a5a32), (u, v) => (Math.hypot(u - 0.5, v - 0.5) > 0.4 ? 0xb06a3a : smoothNoise(u * 6, v * 6, 8) > 0.6 ? 0x6a3e1c : 0x4a2a14));
  m.cylinder(0.75, 0.25, 26, 0.08, 40, (u) => (u < 0.4 ? 0x7a5a3a : 0x3a2a1a), P.soot);
  return m;
}

/** A ladder against the wall up to the loft hatch. */
function ladder(): IsoModel {
  const m = new IsoModel();
  for (const x of [0.25, 0.75]) line(m, { x, y: 0.75, z: 0 }, { x, y: 0.1, z: H }, OAK, 0.05);
  for (let z = 8; z < H; z += 9) {
    const t = z / H;
    m.box(0.25, 0.75 - t * 0.65, z, 0.5, 0.04, 1.6, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  }
  return m;
}

/** A stack of finished leather, curried and rolled, and a roll tied with string. */
function leatherStack(): IsoModel {
  const m = new IsoModel();
  for (let i = 0; i < 4; i++) {
    const tone = [LEATHER, LEATHER_LIGHT, LEATHER_DARK, 0x7a4a2a][i];
    m.box(0.12 + (i % 2) * 0.05, 0.14, i * 4, 0.7, 0.7, 4, { top: (u, v) => (Math.sin(u * 20 + v * 8) > 0.8 ? lighten(tone, 0.1) : tone), left: darken(tone, 0.85), right: darken(tone, 0.7) });
  }
  for (const [x, y] of [[0.3, 0.3], [0.62, 0.48]] as const) {
    m.box(x - 0.1, y, 16, 0.2, 0.32, 0, { top: LEATHER, left: LEATHER, right: LEATHER });
    m.cylinder(x, y + 0.16, 16, 0.1, 5, (u, v) => (Math.abs(v - 0.5) < 0.1 ? 0x9a865e : u < 0.3 ? LEATHER_LIGHT : LEATHER), (u, v) => (Math.abs(Math.hypot(u - 0.5, v - 0.5) * 8 % 1) < 0.3 ? LEATHER_DARK : LEATHER));
  }
  return m;
}

/** A rack in the loft: two posts and poles, hides hung over them to dry (`n` of them, wet or stiff). */
function dryRack(variant: number): IsoModel {
  const m = new IsoModel();
  for (const x of [0.1, 1.9]) m.box(x - 0.04, 0.46, 0, 0.08, 0.08, 52, { top: DEAD_LIGHT, left: DEAD, right: DEAD_DARK });
  m.box(0.06, 0.46, 50, 1.88, 0.08, 2, { top: DEAD_LIGHT, left: DEAD, right: DEAD_DARK });
  const tones = variant ? [HIDE_LIGHT, RAWHIDE, HIDE] : [HIDE, HIDE_DARK, 0x8a7a68];
  tones.forEach((tone, i) => {
    const x0 = 0.18 + i * 0.58;
    for (const side of [-1, 1]) {
      m.quad({ x: x0, y: 0.5, z: 51 }, { x: 0.5, y: 0, z: 0 }, { x: 0, y: side * 0.12, z: -30 - (i % 2) * 8 }, (u, v) => {
        if (v > 0.9 && Math.abs(u - 0.5) > 0.3) return null;
        const n = smoothNoise(u * 5 + i, v * 7, tone);
        const c = n > 0.7 ? lighten(tone, 0.1) : n < 0.28 ? darken(tone, 0.82) : tone;
        return side < 0 ? darken(c, 0.8) : c;
      });
    }
  });
  return m;
}

/**
 * Tam Rudd's hiding-place in the loft: a nest of straw and stolen sacking in
 * the corner behind the hides, a candle-end stuck to a board, dice, a
 * half-eaten pie, a bottle, and his boots set neatly side by side.
 */
function tamNest(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.05, y: 0.05, z: 0.5 }, { x: 1.9, y: 0, z: 0 }, { x: 0, y: 0.9, z: 0 }, (u, v) => {
    const d = Math.hypot((u - 0.5) * 1.2, v - 0.5);
    if (d > 0.5 + smoothNoise(u * 6, v * 6, 5) * 0.12) return null;
    const h = hash(Math.floor(u * 60), Math.floor(v * 30));
    return h < 0.3 ? STRAW_DARK : h > 0.85 ? 0xe0c878 : STRAW;
  });
  // A sack for a blanket, rumpled.
  m.box(0.3, 0.2, 1, 0.9, 0.55, 3, { top: (u, v) => (Math.sin(u * 20 + v * 6) > 0.5 ? 0x8a7a5a : 0x9a8a6a), left: 0x7a6a4a, right: 0x5a4e36 });
  // The candle-end on a board, the dice, the pie, the bottle, the boots.
  m.box(1.35, 0.25, 0.5, 0.22, 0.22, 1, { top: OAK, left: OAK_DARK, right: OAK_DARK });
  m.cylinder(1.46, 0.36, 1.5, 0.03, 3, () => 0xe8dcb0, P.fireYellow);
  for (const [x, y] of [[1.4, 0.65], [1.48, 0.7]] as const) m.box(x, y, 0.5, 0.05, 0.05, 1.5, { top: BONE, left: BONE_DARK, right: darken(BONE_DARK, 0.8) });
  m.cylinder(1.68, 0.58, 0.5, 0.1, 2, (u) => (u < 0.4 ? 0xc89a5a : 0x9a6a3a), (u, v) => (u > 0.5 && v < 0.5 ? 0x6a3a22 : 0xd8a864));
  m.cylinder(1.78, 0.3, 0.5, 0.045, 8, (u) => (u < 0.35 ? 0x4a6a4a : 0x2a3a2a), 0x2a3a2a);
  for (const y of [0.78, 0.88]) m.box(0.12, y, 0.5, 0.18, 0.08, 5, { top: 0x4a3426, left: 0x3a2a1e, right: 0x261a12 });
  return m;
}

// ---------------------------------------------------------------- indoors: the rat-catcher's den

/** A stack of cage traps on the floor, rats in them. */
function ratCages(): IsoModel {
  const m = new IsoModel();
  const cage = (x: number, y: number, z: number, rats: number) => {
    m.box(x, y, z, 0.38, 0.3, 8, {
      top: (u, v) => (Math.floor(u * 10) % 2 && Math.floor(v * 8) % 2 ? 0x140e0c : IRON_LIGHT),
      left: (u, v) => {
        if (Math.floor(u * 12) % 2 === 0 || v < 0.08 || v > 0.92) return IRON_LIGHT;
        for (let i = 0; i < rats; i++) {
          const rx = 0.25 + i * 0.4;
          if (Math.hypot((u - rx) * 3, (v - 0.68) * 2.2) < 0.4) return Math.abs(u - rx + 0.08) < 0.03 && Math.abs(v - 0.6) < 0.05 ? 0xe04030 : RAT;
        }
        return 0x1a1210;
      },
      right: (u, v) => (Math.floor(u * 9) % 2 === 0 || v < 0.08 ? IRON : 0x140e0c),
    });
  };
  cage(0.1, 0.15, 0, 2);
  cage(0.5, 0.2, 0, 1);
  cage(0.2, 0.2, 8, 2);
  cage(0.5, 0.55, 0, 0);
  return m;
}

/** Scritch's cot: a low frame, a straw tick, a blanket the colour of a rat. */
function cot(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.1, 0, 0.8, 1.8, 8, { top: OAK, left: OAK_DARK, right: darken(OAK_DARK, 0.8) });
  m.box(0.14, 0.14, 8, 0.72, 1.72, 4, { top: (u, v) => (v < 0.25 ? 0xc0b090 : Math.sin(v * 30 + u * 4) > 0.6 ? 0x6a6050 : 0x5a5244), left: 0x4a4236, right: 0x3a3428 });
  return m;
}

/** The dog's bed by the stove: a fish-crate of old sacking, a chewed bone, a bowl. Empty, while she's gone. */
function dogBed(occupied: boolean): IsoModel {
  const m = new IsoModel();
  m.box(0.12, 0.18, 0, 0.72, 0.62, 6, {
    top: (u, v) => (u > 0.08 && u < 0.92 && v > 0.1 && v < 0.9 ? (occupied ? 0x7a7068 : Math.sin(u * 16 + v * 12) > 0.4 ? 0x8a7a5a : 0x6a5c44) : OAK),
    left: (u) => (Math.floor(u * 6) % 2 ? OAK : OAK_DARK),
    right: OAK_DARK,
  });
  m.box(0.3, 0.86, 0, 0.3, 0.05, 1.2, { top: BONE, left: BONE_DARK, right: BONE_DARK });
  m.cylinder(0.85, 0.85, 0, 0.09, 2, () => 0x7a5a3a, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0x3a4a4a : 0x7a5a3a));
  return m;
}

/** A table of the trade: bottles of poison with skulls scratched on them, a ferreting bag, a lamp, a jar. */
function poisonTable(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.12, 0.2], [0.84, 0.2], [0.12, 0.76], [0.84, 0.76]]) block(m, x, y, 0, 0.05, 0.05, 18, OAK_DARK);
  m.box(0.08, 0.14, 18, 0.86, 0.72, 3, { top: (u, v) => (hash(Math.floor(u * 12), Math.floor(v * 10)) < 0.1 ? 0x2a2420 : OAK), left: OAK_DARK, right: darken(OAK_DARK, 0.8) });
  for (const [x, y, c] of [[0.2, 0.3, 0x2a4a3a], [0.32, 0.28, 0x4a2a2a], [0.26, 0.44, 0x3a3a5a]] as const) {
    m.cylinder(x, y, 21, 0.05, 7, (u, v) => (v > 0.35 && v < 0.6 && u > 0.3 && u < 0.6 ? CHALK : u < 0.3 ? lighten(c, 0.3) : c), 0x2a2420);
  }
  // The rat king: a knot of rats by their tails, in a great jar of spirit.
  m.cylinder(0.62, 0.5, 21, 0.17, 14, (u, v) => {
    if (v < 0.08) return 0x5a4a3a;
    const r = Math.hypot((u - 0.5) * 2, (v - 0.55) * 2.4);
    if (r < 0.55) return (Math.floor(u * 10 + v * 6) % 3 === 0 ? PINK : RAT);
    return u < 0.25 ? 0xb8c0a0 : 0x8a9478;
  }, 0x5a4a3a);
  // A lamp.
  m.cylinder(0.78, 0.26, 21, 0.05, 6, (u, v) => (v < 0.3 ? LIT_HOT : u < 0.4 ? 0x8a8a92 : 0x5a5a62), LIT);
  return m;
}

/** A pot-bellied stove of black iron, a kettle on it. */
function stove(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.26, 18, (u, v) => (v > 0.45 && v < 0.7 && Math.abs(u - 0.4) < 0.12 ? (v > 0.6 ? P.fireYellow : P.fireOrange) : u < 0.3 ? IRON_LIGHT : IRON), IRON_LIGHT);
  m.cylinder(0.62, 0.38, 60, 0.06, 24, (u) => (u < 0.4 ? IRON_LIGHT : IRON), IRON);
  m.box(0.6, 0.35, 18, 0.06, 0.06, 42, { top: IRON, left: IRON_LIGHT, right: IRON });
  m.cylinder(0.42, 0.48, 18, 0.1, 5, (u) => (u < 0.3 ? 0x8a8a92 : 0x4a4a52), 0x5a5a62);
  return m;
}

// ---------------------------------------------------------------- indoors: the pit barn

/**
 * The pit (4 x 4): a ring of boards waist-high round a hollow scraped in the
 * floor, the sand inside churned and dark, the boards gnawed and stained, a
 * gate in the near side, and a scale-beam hanging over it for weighing the dogs.
 */
function dogPit(): IsoModel {
  const m = new IsoModel();
  const cx = 2;
  const cy = 2;
  const R = 1.7;
  // The floor of the pit: sand, dark with what's soaked into it.
  m.quad({ x: cx - R, y: cy - R, z: 0.1 }, { x: R * 2, y: 0, z: 0 }, { x: 0, y: R * 2, z: 0 }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    if (d > 1) return null;
    const n = smoothNoise(u * 9, v * 9, 13);
    if (n > 0.72) return BLOOD_DARK;
    if (n < 0.25) return 0x6a5a3a;
    return hash(Math.floor(u * 40), Math.floor(v * 40)) < 0.15 ? 0x5a4a30 : 0x8a7650;
  });
  // The wall of boards, round, as staves: the back half first, then the front (cut away low for the gate).
  const staves = 32;
  const wall = (from: number, to: number) => {
    for (let i = from; i < to; i++) {
      const a0 = (i / staves) * Math.PI * 2;
      const a1 = ((i + 1) / staves) * Math.PI * 2;
      const p0 = { x: cx + Math.cos(a0) * R, y: cy + Math.sin(a0) * R };
      const p1 = { x: cx + Math.cos(a1) * R, y: cy + Math.sin(a1) * R };
      const gate = i === 8 || i === 9;
      const hgt = gate ? 16 : 22 + (hash(i, 3) < 0.3 ? 1 : 0);
      const tone = hash(i, 5) < 0.3 ? darken(GREYBOARD_DARK, 0.85) : i % 2 ? GREYBOARD_DARK : GREYBOARD;
      m.quad({ x: p0.x, y: p0.y, z: hgt }, { x: p1.x - p0.x, y: p1.y - p0.y, z: 0 }, { x: 0, y: 0, z: -hgt }, (u, v) => {
        if (u < 0.08) return TAR_DARK;
        if (v > 0.65 && hash(Math.floor(u * 6) + i * 7, Math.floor(v * 10)) < 0.25) return BLOOD_DARK;
        if (v < 0.1 && hash(i, Math.floor(u * 4)) < 0.4) return lighten(tone, 0.1); // gnawed
        if (gate && Math.abs(v - 0.5) < 0.08) return IRON;
        return tone;
      });
    }
  };
  // The far half of the ring (round the back, from the +x side to the +y side): angles from about -135° to 45°.
  wall(20, 32);
  wall(0, 4);
  // A post with the weighing beam out over the pit, and a lantern hung from it.
  m.box(cx + R + 0.04, cy - R - 0.1, 0, 0.12, 0.12, 70, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.box(cx - 0.2, cy - R - 0.08, 66, R + 0.4, 0.08, 3, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  line(m, { x: cx, y: cy - R - 0.04, z: 66 }, { x: cx, y: cy - R - 0.04, z: 50 }, IRON, 0.012);
  m.box(cx - 0.06, cy - R - 0.1, 42, 0.12, 0.12, 8, {
    top: IRON,
    left: (u, v) => (u < 0.2 || u > 0.8 || v < 0.15 || v > 0.85 ? IRON : LIT_HOT),
    right: (u, v) => (u < 0.2 || u > 0.8 || v < 0.15 || v > 0.85 ? IRON : LIT),
  });
  // The near half of the ring.
  wall(4, 20);
  // A dead rat on the rim, and a drag of sawdust.
  m.box(cx + 0.6, cy + R - 0.05, 22, 0.14, 0.06, 1.6, { top: RAT, left: RAT_DARK, right: RAT_DARK });
  return m;
}

/** Plank benches in tiers, for the crowd to stand on. */
function tierBench(): IsoModel {
  const m = new IsoModel();
  for (const [y, z] of [[0.62, 10], [0.25, 20]] as const) {
    for (const x of [0.15, 1.85]) block(m, x, y, 0, 0.08, 0.08, z, DEAD_DARK);
    m.box(0.06, y - 0.1, z, 1.88, 0.26, 2.5, {
      top: (u) => (hash(Math.floor(u * 22), Math.floor(y * 10)) < 0.12 ? BLOOD_DARK : hash(Math.floor(u * 12), 3) < 0.2 ? OAK_DARK : OAK),
      left: OAK_DARK,
      right: darken(OAK_DARK, 0.8),
    });
  }
  return m;
}

/** A kennel bay against the barn wall, open at the front, with straw down, a bowl, and a short chain from a ring in the wall; the dog is its own sprite (see entities/Hound.ts), chained at its mouth. */
function dogPen(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.05, y: 0.05, z: 0.3 }, { x: 0.9, y: 0, z: 0 }, { x: 0, y: 0.9, z: 0 }, (u, v) => (hash(Math.floor(u * 30), Math.floor(v * 30)) < 0.4 ? STRAW_DARK : STRAW));
  m.cylinder(0.75, 0.25, 0, 0.08, 2, () => 0x7a5a3a, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0x3a4a4a : 0x7a5a3a));
  // A ring in the wall and the chain from it, down and along the straw to the bay's mouth.
  for (let i = 0; i < 6; i++) m.box(0.46, 0.06 + i * 0.04, 14 - i * 2.6, 0.04, 0.04, 1.5, { top: IRON_LIGHT, left: IRON, right: IRON });
  for (let i = 0; i < 8; i++) m.box(0.47 + (i % 2) * 0.02, 0.28 + i * 0.09, 0.4, 0.05, 0.05, 0.8, { top: IRON_LIGHT, left: IRON, right: IRON });
  // Hurdles down the sides, between one bay and the next.
  for (const x of [0.03, 0.97]) {
    for (let i = 0; i <= 3; i++) post(m, x, 0.08 + i * 0.28, 0.025, 18);
    for (const z of [6, 12, 17]) line(m, { x, y: 0.06, z }, { x, y: 0.94, z }, DEAD, 0.025);
  }
  return m;
}

/** Ned Flay's table by the door: the cash box, a tally book, coins, a bottle, a muzzle. */
function cashTable(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.12, 0.2], [0.84, 0.2], [0.12, 0.76], [0.84, 0.76]]) block(m, x, y, 0, 0.05, 0.05, 18, OAK_DARK);
  m.box(0.08, 0.14, 18, 0.86, 0.72, 3, { top: OAK, left: OAK_DARK, right: darken(OAK_DARK, 0.8) });
  m.box(0.2, 0.3, 21, 0.3, 0.22, 6, { top: (u, v) => (Math.abs(u - 0.5) < 0.1 && Math.abs(v - 0.5) < 0.15 ? 0xd8a848 : IRON), left: (u) => (u < 0.1 || u > 0.9 ? IRON_LIGHT : 0x4a3a2a), right: 0x3a2a1e });
  for (const [x, y] of [[0.6, 0.3], [0.65, 0.36], [0.58, 0.4], [0.7, 0.32]] as const) m.cylinder(x, y, 21, 0.03, 0.8, () => 0xb8bcc6, 0xe0e4ec);
  m.box(0.55, 0.55, 21, 0.25, 0.18, 1.2, { top: 0xc8b890, left: 0x8a7a5a, right: 0x6a5a40 });
  m.cylinder(0.85, 0.65, 21, 0.045, 8, (u) => (u < 0.35 ? 0x5a4a2a : 0x3a2a1a), 0x3a2a1a);
  return m;
}

/** A barrel of live rats for the ratting bouts, a board over it weighted with a stone. */
function ratBarrel(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.3, 18, (u, v) => (Math.abs(v - 0.2) < 0.06 || Math.abs(v - 0.8) < 0.06 ? IRON : u < 0.3 ? OAK : u > 0.7 ? OAK_DARK : mix(OAK, OAK_DARK, 0.4)), (u, v) => (Math.hypot(u - 0.5, v - 0.5) > 0.42 ? OAK_DARK : Math.abs(u - 0.5) < 0.3 ? OAK_LIGHT : 0x0c0806));
  m.cylinder(0.45, 0.48, 18, 0.1, 4, (u) => (u < 0.3 ? STONE_LIGHT : STONE), STONE_LIGHT);
  // A tail hanging out between board and rim.
  line(m, { x: 0.75, y: 0.62, z: 18 }, { x: 0.8, y: 0.8, z: 13 }, PINK, 0.008);
  return m;
}

/** Straw, trodden and filthy, thrown down on the barn floor. */
function strawFloor(seed: number): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.4 + smoothNoise(u * 5, v * 5, seed) * 0.15) return null;
    const h = hash(Math.floor(u * 40), Math.floor(v * 40) + seed);
    return h < 0.25 ? STRAW_DARK : h > 0.9 ? 0x5a4a2a : h > 0.85 ? BLOOD_DARK : STRAW;
  });
  return m;
}

// ---------------------------------------------------------------- the dogs

// (Nothing, the grey lurcher, and the pit dogs are drawn with the beasts' frames in shamblesfolk3d.ts.)

// ---------------------------------------------------------------- registering

function put(scene: Phaser.Scene, key: string, model: IsoModel, outline = true): void {
  registerModel(scene, key, model.render(outline));
}

export function generateShambles(scene: Phaser.Scene): void {
  // Out of doors: the buildings.
  put(scene, 'gh-slaughterhouse', slaughterhouse());
  put(scene, 'gh-tannery', tannery());
  put(scene, 'gh-pitbarn', pitBarn());
  put(scene, 'gh-ratden', ratDen());
  // The lane and the yard.
  put(scene, 'sh-carcassrail', carcassRail());
  put(scene, 'sh-block', choppingBlock());
  put(scene, 'sh-bloodtub', bloodTub());
  put(scene, 'sh-pigpen', pigPen());
  put(scene, 'sh-bones', bones());
  put(scene, 'sh-limepit', pit('lime'));
  for (let i = 0; i < 4; i++) put(scene, `sh-tanpit-${i}`, pit(i));
  put(scene, 'sh-hiderack', hideRack());
  put(scene, 'sh-barkstack', barkStack());
  put(scene, 'sh-fleshbeam', fleshBeam());
  put(scene, 'sh-purebarrow', pureBarrow());
  put(scene, 'sh-hides', hideHeap());
  put(scene, 'sh-chalkboard', chalkBoard());
  put(scene, 'sh-kennel', kennel());
  put(scene, 'sh-hutch', hutch());
  put(scene, 'sh-traps', trapPost());
  put(scene, 'sh-offalcart', offalCart());
  for (let i = 0; i < 2; i++) put(scene, `sh-gutter-${i}`, gutter(i * 7 + 3), false);
  // Indoors: the walls of each room.
  for (const [prefix, { style, kinds }] of Object.entries(SHAMBLES_WALLS)) {
    for (const kind of kinds) {
      for (let i = 0; i < 2; i++) {
        shamblesWall(scene, prefix, style, 'back', kind, i);
        shamblesWall(scene, prefix, style, 'side', kind, i);
      }
    }
    put(scene, `${prefix}-wall-corner`, cornerPost(style));
  }
  // The slaughterhouse.
  put(scene, 'sh-drain-x', drain(true), false);
  put(scene, 'sh-drain-y', drain(false), false);
  put(scene, 'sh-grate', grate(), false);
  for (let i = 0; i < 3; i++) put(scene, `sh-stain-${i}`, bloodstain(i * 5 + 2), false);
  put(scene, 'sh-sawdust', sawdust(), false);
  put(scene, 'sh-hookframe', hookFrame());
  put(scene, 'sh-scaldvat', scaldVat());
  put(scene, 'sh-bench', butcherBench());
  for (let i = 0; i < 3; i++) put(scene, `sh-counter-${i}`, shopCounter(i));
  put(scene, 'sh-killpen', killPen());
  // The tannery and its loft.
  put(scene, 'sh-vat-lime', vat('lime'));
  for (let i = 0; i < 3; i++) put(scene, `sh-vat-${i}`, vat(i + 1));
  put(scene, 'sh-copper', barkCopper());
  put(scene, 'sh-ladder', ladder());
  put(scene, 'sh-leather', leatherStack());
  for (let i = 0; i < 2; i++) put(scene, `sh-dryrack-${i}`, dryRack(i));
  put(scene, 'sh-tamnest', tamNest());
  // The rat-catcher's den.
  put(scene, 'sh-ratcages', ratCages());
  put(scene, 'sh-cot', cot());
  put(scene, 'sh-dogbed', dogBed(false));
  put(scene, 'sh-poisontable', poisonTable());
  put(scene, 'sh-stove', stove());
  // The pit barn.
  put(scene, 'sh-pit', dogPit());
  put(scene, 'sh-tiers', tierBench());
  put(scene, 'sh-dogpen', dogPen());
  put(scene, 'sh-cashtable', cashTable());
  put(scene, 'sh-ratbarrel', ratBarrel());
  for (let i = 0; i < 3; i++) put(scene, `sh-straw-${i}`, strawFloor(i * 11 + 4), false);
  generateShamblesFolk(scene);
}

// Unused helpers kept for the art's own consistency checks.
void PixelCanvas;
void MODEL_ART;
void rubbleStone;
void boardWall;
void rough;
