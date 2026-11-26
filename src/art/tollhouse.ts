import Phaser from 'phaser';
import { IsoModel, lipped, planks, SEAT_TOP, Shader, TABLE_TOP } from './IsoModel';
import { registerModel, WALL_HEIGHT } from './interior';
import { PALETTE as P } from './palette';
import { mixColor, smoothNoise } from './scorch';
import {
  block, chimney, darken, lighten, line, mix, Opening, plasterWall, post, rotSlate, windowPixel, withDoor, withOpenings,
} from './gloomhaven';
import { generateTollFolk } from './tollhouse3d';

/**
 * The Reeve's toll house by the Fen Gate (world/GloomhavenMap.ts outside,
 * world/TollHouseMap.ts within). Outside: an old squat stone toll house with a
 * new upper storey of black oak and plaster jettied over it, glass in every
 * window and lit late, a slate roof, an iron-studded door, the toll window
 * with its grille and its little stone shelf for coin, a gilt sign of the
 * Reeve's scales, his yellow banner, and a toll bar across the road.
 *
 * Inside: the toll office, limewashed stone with an oak dado, the counter and
 * its iron grille, Nibb's ledgers and scales and tally sticks, the iron door to
 * the strongroom, the Reeve's table of tolls and his portrait on the walls, and
 * the seized goods in the corner; the strongroom of dressed stone, its chests,
 * coin sacks, lectern and the coffer; and up the stairs the Reeve's rooms, all
 * yellow damask and oak panelling, too fine for Gloomhaven by half. The people
 * are drawn in tollhouse3d.ts.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Stone: older, drier and better dressed than the rest of the town's.
const STONE = 0x6a6660;
const STONE_DARK = 0x4a4742;
const STONE_LIGHT = 0x86827a;
const MORTAR = 0x56524c;
// Limewash gone grey, and the damp coming through it.
const LIME = 0xb8b2a2;
const LIME_DARK = 0x969080;
const LIME_LIGHT = 0xcac4b2;
const LIME_DAMP = 0x8a8a74;
// Oak: the dado, the counter, the desks.
const OAK = 0x4e3624;
const OAK_DARK = 0x34241a;
const OAK_LIGHT = 0x6a4a32;
const OAK_TOP = 0x765236;
const BLACK_OAK = 0x231c19;
const BLACK_OAK_LIGHT = 0x3a302a;
// The Reeve's yellow: mustard, saffron and the gilt that's only paint.
const YELLOW = 0xb8902a;
const YELLOW_DARK = 0x8a6a1c;
const YELLOW_LIGHT = 0xd8b048;
const GILT = 0xc8a040;
const GILT_DARK = 0x8a6a28;
const GILT_LIGHT = 0xeccc70;
const DAMASK = 0x9a7a2a;
const DAMASK_DARK = 0x725a1e;
const DAMASK_LIGHT = 0xb89838;
// Iron, and rust.
const IRON = 0x3a3a40;
const IRON_DARK = 0x26262c;
const IRON_LIGHT = 0x5e5e68;
const RUST = 0x6a3e26;
const BRASS = 0xb8963a;
const BRASS_DARK = 0x7a5e22;
const BRASS_LIGHT = 0xe0c070;
// Paper and ink.
const PAPER = 0xd8ccaa;
const PAPER_DARK = 0xb4a684;
const INK = 0x1e1a22;
const WAX_RED = 0x8a1a1a;
const WAX_GREY = 0x7a7a82;
const SILVER = 0xb8bcc4;
const SILVER_DARK = 0x7e828c;
const SILVER_LIGHT = 0xe4e8f0;
// Glass: real panes, and the warm light behind them.
const GLASS = 0x46625a;
const GLASS_LIGHT = 0x84a294;
const LIT = 0xf0b45a;
const LIT_HOT = 0xffe0a0;
const SOOT = 0x1c1618;
const MUD = 0x3e2e22;
const MUD_DARK = 0x2a1e16;
const LEATHER = 0x5a3a24;
const LEATHER_DARK = 0x3a2416;
const CLOTH_BLUE = 0x3a4a7a;
const WICKER = 0x8a6a3a;
const WICKER_DARK = 0x5e4626;


// ======================================================================= outside

/** The Reeve's mark: a pair of scales over a wavy line for the river, in `ink` on whatever's under it. (u, v) across a square 0..1. */
function scalesMark(u: number, v: number, ink: number): number | null {
  const cu = u - 0.5;
  // The upright and its foot.
  if (Math.abs(cu) < 0.035 && v > 0.18 && v < 0.66) return ink;
  if (Math.abs(v - 0.66) < 0.03 && Math.abs(cu) < 0.14) return ink;
  // The beam, and the two pans hung from it.
  if (Math.abs(v - 0.2) < 0.03 && Math.abs(cu) < 0.32) return ink;
  for (const s of [-1, 1]) {
    const px = 0.5 + s * 0.3;
    if (Math.abs(u - px) < 0.015 && v > 0.2 && v < 0.42) return ink;
    if (v > 0.42 && v < 0.48 && Math.abs(u - px) < 0.12 - (v - 0.42) * 0.8) return ink;
  }
  // The river under it.
  if (Math.abs(v - (0.82 + Math.sin(u * 18) * 0.03)) < 0.025 && u > 0.12 && u < 0.88) return ink;
  return null;
}

/** Dressed stone for the old toll house's ground floor: squared blocks in courses, quoins at the corners, better than anything else in town. */
function dressedStone(seed: number, scaleU: number, courses: number): Shader {
  return (u, v) => {
    const row = Math.floor(v * courses);
    const lv = v * courses - row;
    const fu = u * scaleU + (row % 2) * 0.5;
    const lu = fu - Math.floor(fu);
    if (lv < 0.08 || lu < 0.04) return MORTAR;
    const n = hash(Math.floor(fu) + seed, row);
    let c = n < 0.25 ? STONE_DARK : n > 0.8 ? STONE_LIGHT : STONE;
    if (lv < 0.2) c = lighten(c, 0.06);
    if (lv > 0.88) c = darken(c, 0.85);
    // Quoins: bigger, paler blocks at each end.
    if ((u < 0.06 || u > 0.94) && row % 2 === 0) c = lighten(c, 0.12);
    // Green damp up from the mud, and the soot of the brazier by the door.
    if (v > 0.72) c = mix(c, 0x3a4a2a, (v - 0.72) * 1.4);
    if (smoothNoise(u * 9, v * 5, seed) > 0.78) c = mix(c, 0x4e6430, 0.4);
    return c;
  };
}

/** The toll house's sign: a gilt board, bordered, with the Reeve's black scales on yellow. */
function signBoard(u: number, v: number): number | null {
  if (u < 0.05 || u > 0.95 || v < 0.06 || v > 0.94) return BLACK_OAK;
  if (u < 0.1 || u > 0.9 || v < 0.12 || v > 0.88) return (u + v) % 0.1 < 0.05 ? GILT_LIGHT : GILT;
  const s = scalesMark((u - 0.1) / 0.8, (v - 0.12) / 0.76, INK);
  if (s !== null) return s;
  return smoothNoise(u * 8, v * 8, 4) > 0.65 ? YELLOW_LIGHT : YELLOW;
}

/** A banner of the Reeve's yellow hanging limp from a pole, the scales on it, the hem gone green with damp. */
function banner(u: number, v: number): number | null {
  // A swallowtail hem.
  if (v > 0.86 && Math.abs(u - 0.5) < (v - 0.86) * 2.2) return null;
  if (u < 0.06 || u > 0.94) return YELLOW_DARK;
  const s = scalesMark((u - 0.15) / 0.7, (v - 0.12) / 0.55, 0x2a2018);
  if (s !== null) return s;
  const fold = Math.sin(u * 22);
  let c = fold > 0.5 ? YELLOW_LIGHT : fold < -0.5 ? YELLOW_DARK : YELLOW;
  if (v > 0.7) c = mix(c, 0x5a6a3a, (v - 0.7) * 1.2);
  return c;
}

/** The painted list of tolls by the door: a board with rows of black writing too small to read from here, and a yellow head. */
function tollBoardFace(u: number, v: number): number | null {
  if (u < 0.05 || u > 0.95 || v < 0.04 || v > 0.96) return BLACK_OAK;
  if (v < 0.2) return Math.abs(u - 0.5) < 0.3 && Math.abs(v - 0.12) < 0.03 && Math.floor(u * 40) % 3 ? INK : YELLOW;
  const row = (v - 0.2) * 9;
  if (row % 1 < 0.38 && u > 0.12 && u < 0.88 - (Math.floor(row) % 3) * 0.12 && Math.floor(u * 60 + row) % 5) return INK;
  return smoothNoise(u * 6, v * 9, 7) > 0.7 ? PAPER_DARK : PAPER;
}

/**
 * The toll house itself, 5 x 4 with its front on +y (it stands turned in the
 * map so that front faces the road). A ground floor of old dressed stone with
 * the toll window and its grille, a jettied upper storey of black oak and
 * plaster, glazed and lit; a slate roof with a chimney at the back; the gilt
 * sign, the yellow banner, a lantern, and the board of tolls by the door.
 */
function tollHouse(): IsoModel {
  const m = new IsoModel();
  const x0 = 0.2;
  const y0 = 0.25;
  const W = 4.6;
  const D = 3.4;
  const foot = 5;
  const H1 = 46;
  const H2 = 40;
  const jet = 0.24;
  const R = 54;
  const top = foot + H1 + H2;
  const ridgeY = y0 + D / 2;
  const o = 0.3;
  const roof = rotSlate(171);

  // The back slope, and the chimney through it.
  m.quad({ x: x0 - o, y: ridgeY, z: top + R }, { x: W + o * 2, y: 0, z: 0 }, { x: 0, y: -D / 2 - o - jet, z: -R - 6 }, roof);
  chimney(m, x0 + 0.5, y0 + 0.9, foot, H1 + H2 + R + 22, 0.05, 0.6);

  // The footing and a step up to the door.
  m.box(x0 - 0.04, y0 - 0.04, 0, W + 0.08, D + 0.08, foot, { top: STONE_LIGHT, left: dressedStone(3, 14, 1), right: (u, v) => darken(dressedStone(5, 10, 1)(u, v) ?? STONE, 0.75) });
  m.box(x0 + W * 0.42, y0 + D + 0.04, 0, W * 0.16, 0.3, 4, { top: STONE_LIGHT, left: STONE, right: STONE_DARK });

  // ---- Ground floor: dressed stone, the door, the toll window, a barred window at the side.
  const H1top = foot + H1;
  const windows1: Opening[] = [{ u0: 0.06, u1: 0.24, y0: 12, y1: 32, pane: 'barred' }];
  let ground: Shader = withOpenings(dressedStone(11, 9, 8), H1, windows1);
  ground = withDoor(ground, H1, 0.42, 0.58, 34);
  // The toll window: a wide opening barred with a grille, the clerk's lamp lit behind it.
  const grille = (base: Shader): Shader => (u, v) => {
    const y = v * H1;
    if (u > 0.64 && u < 0.92 && y > 10 && y < 32) {
      const gu = (u - 0.64) / 0.28;
      const gv = (y - 10) / 22;
      if (gu < 0.06 || gu > 0.94 || gv < 0.07 || gv > 0.93) return BLACK_OAK;
      if (Math.floor(gu * 9) % 2 === 0 || Math.floor(gv * 6) % 3 === 0) return (gu * 9) % 1 < 0.4 ? IRON_LIGHT : IRON;
      // Behind the bars: the lamp, a shape of a head bent over a ledger.
      if (Math.hypot(gu - 0.45, gv - 0.55) < 0.16) return 0x3a2a20;
      return gv < 0.45 ? LIT_HOT : LIT;
    }
    // The coin slot under it, worn bright.
    if (u > 0.74 && u < 0.82 && y > 32 && y < 34) return 0x100c0a;
    return base(u, v);
  };
  ground = grille(ground);
  // A painted line on the door: the Reeve's scales, small, in yellow.
  const doorMark = (base: Shader): Shader => (u, v) => {
    const y = v * H1;
    if (u > 0.46 && u < 0.54 && y > 18 && y < 26) {
      const s = scalesMark((u - 0.46) / 0.08, (y - 18) / 8, YELLOW_LIGHT);
      if (s !== null) return s;
    }
    return base(u, v);
  };
  ground = doorMark(ground);
  const groundSide = withOpenings(dressedStone(13, 7, 8), H1, [{ u0: 0.4, u1: 0.56, y0: 14, y1: 24, pane: 'barred' }]);
  m.quad({ x: x0 + W, y: y0, z: H1top }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: -H1 }, (u, v) => darken(groundSide(u, v) ?? STONE, 0.74));
  m.quad({ x: x0, y: y0 + D, z: H1top }, { x: W, y: 0, z: 0 }, { x: 0, y: 0, z: -H1 }, ground);
  // The stone shelf under the toll window, where coin is counted out, and the queue's elbows have worn it.
  m.box(x0 + W * 0.63, y0 + D, foot + H1 - 33, W * 0.3, 0.26, 3, { top: (u) => (u > 0.35 && u < 0.6 ? STONE_LIGHT : STONE), left: STONE, right: STONE_DARK });
  for (const k of [0.2, 0.5, 0.8]) m.cylinder(x0 + W * (0.63 + k * 0.3), y0 + D + 0.14, foot + H1 - 30, 0.025, 1, () => 0xa8802e, P.gold);

  // ---- The jettied upper floor: black oak and new plaster, glazed windows lit warm.
  const ux = x0 - 0.04;
  const uw = W + 0.08;
  const ud = D + jet;
  const upperFront = withOpenings(plasterWall(6, H2, 173), H2, [
    { u0: 0.08, u1: 0.24, y0: 10, y1: 30, pane: 'lit' },
    { u0: 0.42, u1: 0.58, y0: 10, y1: 30, pane: 'lit' },
    { u0: 0.76, u1: 0.92, y0: 10, y1: 30, pane: 'lit' },
  ]);
  const upperSide = withOpenings(plasterWall(4, H2, 175), H2, [{ u0: 0.36, u1: 0.6, y0: 10, y1: 30, pane: 'lit' }]);
  for (let i = 0; i < 14; i++) block(m, ux + 0.15 + i * (uw - 0.3) / 13, y0 + D, H1top - 3, 0.1, jet, 3, BLACK_OAK_LIGHT, BLACK_OAK);
  m.quad({ x: ux + uw, y: y0, z: top }, { x: 0, y: ud, z: 0 }, { x: 0, y: 0, z: -H2 }, (u, v) => darken(upperSide(u, v) ?? LIME, 0.72));
  m.quad({ x: ux, y: y0 + ud, z: top }, { x: uw, y: 0, z: 0 }, { x: 0, y: 0, z: -H2 }, upperFront);
  m.box(ux, y0 + ud - 0.08, H1top, uw, 0.1, 4, { top: BLACK_OAK_LIGHT, left: BLACK_OAK, right: BLACK_OAK });
  // Yellow curtains drawn back in the lit windows.
  for (const a of [0.08, 0.42, 0.76]) {
    for (const s of [0, 1]) m.quad({ x: ux + uw * (a + s * 0.13), y: y0 + ud + 0.005, z: top - 9 }, { x: uw * 0.03, y: 0, z: 0 }, { x: 0, y: 0, z: -19 }, YELLOW_DARK);
  }

  // ---- The gable over the side, and the front slope with its ridge.
  m.quad({ x: ux + uw, y: y0, z: top }, { x: 0, y: ud, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => {
    const half = Math.abs(u - 0.5) * 2;
    if (v > 1 - half) return null;
    if (v > 0.25 && v < 0.5 && Math.abs(u - 0.5) < 0.08) return windowPixel({ u0: 0, u1: 1, y0: 0, y1: 1, pane: 'lit' }, (u - 0.42) / 0.16, 1 - (v - 0.25) / 0.25, BLACK_OAK);
    return darken(plasterWall(2, R, 177)(u, 1 - v) ?? LIME, 0.7);
  });
  m.quad({ x: ux - o, y: ridgeY, z: top + R }, { x: uw + o * 2, y: 0, z: 0 }, { x: 0, y: ud / 2 + o + jet / 2, z: -R - 6 }, roof);
  m.quad({ x: ux + uw + o, y: ridgeY, z: top + R + 1 }, { x: 0, y: ud / 2 + o + jet / 2, z: -R - 6 }, { x: 0.05, y: 0, z: -3 }, BLACK_OAK);
  m.box(ux - o, ridgeY - 0.08, top + R - 2, uw + o * 2, 0.16, 4, { top: 0x5a5c64, left: 0x34363c, right: 0x2a2c30 });
  // A dormer with the Reeve's bedchamber window, lit late.
  const dx = ux + uw * 0.62;
  const dy = ridgeY + 0.75;
  const dz = top + R * 0.36;
  m.box(dx, dy, dz - 6, 0.8, 0.9, 22, {
    top: 0x4a4c55,
    left: (u, v) => windowPixel({ u0: 0, u1: 1, y0: 0, y1: 1, pane: 'lit' }, (u - 0.2) / 0.6, (v - 0.2) / 0.6, BLACK_OAK),
    right: darken(LIME, 0.7),
  });
  m.quad({ x: dx - 0.08, y: dy + 0.45, z: dz + 24 }, { x: 0.48, y: 0, z: 0 }, { x: 0, y: 0.6, z: -8 }, rotSlate(179));
  m.quad({ x: dx + 0.4, y: dy + 0.45, z: dz + 24 }, { x: 0.48, y: 0, z: -8 }, { x: 0, y: 0.6, z: 0 }, (u, v) => darken(rotSlate(181)(u, v) ?? 0x4a4c55, 0.75));

  // ---- The front: the sign on its arm over the door, the banner, the lantern, the board of tolls.
  const fy = y0 + D;
  const sx = x0 + W * 0.5;
  m.box(sx, fy, H1top - 2, 0.04, 0.75, 2, { top: IRON_LIGHT, left: IRON, right: IRON });
  m.quad({ x: sx, y: fy, z: H1top - 14 }, { x: 0, y: 0.34, z: 0 }, { x: 0, y: 0, z: 11 }, (u, v) => (Math.abs(v - u) < 0.13 ? IRON : null));
  for (const d of [0.22, 0.62]) m.box(sx, fy + d, H1top - 6, 0.02, 0.02, 4, { top: IRON, left: IRON, right: IRON });
  m.quad({ x: sx, y: fy + 0.14, z: H1top - 6 }, { x: 0, y: 0.58, z: 0 }, { x: 0, y: 0, z: -18 }, signBoard);
  // The banner, from a pole under the middle window of the upper floor.
  const bx = x0 + W * 0.18;
  m.box(bx - 0.02, fy + jet, top - 30, 0.04, 0.5, 2, { top: GILT, left: GILT_DARK, right: GILT_DARK });
  m.quad({ x: bx, y: fy + jet + 0.08, z: top - 30 }, { x: 0, y: 0.38, z: 0 }, { x: 0, y: 0, z: -30 }, banner);
  // The lantern by the door, the only one in Gloomhaven with all its panes.
  const lx = x0 + W * 0.38;
  m.box(lx, fy, foot + 32, 0.03, 0.14, 1, { top: IRON, left: IRON, right: IRON });
  m.box(lx - 0.05, fy + 0.08, foot + 22, 0.12, 0.12, 9, {
    top: IRON,
    left: (u, v) => (u < 0.18 || u > 0.82 || v < 0.12 || v > 0.88 ? IRON : LIT_HOT),
    right: (u, v) => (u < 0.18 || u > 0.82 || v < 0.12 || v > 0.88 ? IRON : LIT),
  });
  // The board of tolls nailed up between the barred window and the door.
  m.quad({ x: x0 + W * 0.27, y: fy + 0.02, z: foot + 36 }, { x: W * 0.12, y: 0, z: 0 }, { x: 0, y: 0, z: -24 }, tollBoardFace);
  // A bench under the toll window for the queue, and a crate someone's left waiting.
  m.box(x0 + W * 0.64, fy + 0.3, 0, W * 0.26, 0.22, 9, { top: (u) => (Math.floor(u * 6) % 2 ? OAK : OAK_DARK), left: OAK_DARK, right: BLACK_OAK });
  block(m, x0 + W * 0.04, fy + 0.15, 0, 0.42, 0.4, 14, 0x6a5236, 0x4a3a28, 0x7a6244);
  line(m, { x: x0 + W * 0.04, y: fy + 0.55, z: 7 }, { x: x0 + W * 0.04 + 0.42, y: fy + 0.55, z: 7 }, YELLOW, 0.02);
  return m;
}

/**
 * The toll bar across the gate road: a stout post, and a long pole painted in
 * the Reeve's yellow and black, pivoted on it with a stone for a counterweight;
 * up, for now. The first thing a cart sees inside the gate.
 */
function tollBar(): IsoModel {
  const m = new IsoModel();
  m.box(0.3, 0.3, 0, 0.4, 0.4, 4, { top: STONE_LIGHT, left: STONE, right: STONE_DARK });
  post(m, 0.5, 0.5, 0.11, 34, 2);
  m.box(0.4, 0.44, 34, 0.2, 0.12, 4, { top: IRON_LIGHT, left: IRON, right: IRON });
  // The pole, raised at a steep slant over the road (+x), banded yellow and black.
  const from = { x: 0.5, y: 0.5, z: 36 };
  const len = { x: 1.6, y: 0, z: 62 };
  m.quad(from, len, { x: 0.05, y: -0.05, z: 0 }, (u) => (Math.floor(u * 8) % 2 ? YELLOW : 0x1e1a18));
  m.quad(from, len, { x: 0, y: 0, z: -4 }, (u) => (Math.floor(u * 8) % 2 ? YELLOW_DARK : 0x141210));
  // The counterweight: a stone lashed to the short end.
  m.box(0.08, 0.4, 24, 0.26, 0.22, 10, { top: STONE_LIGHT, left: STONE, right: STONE_DARK });
  line(m, { x: 0.22, y: 0.5, z: 34 }, { x: 0.46, y: 0.5, z: 36 }, 0x6a5a3a, 0.03);
  return m;
}

/** A board on two posts by the road, painted with the tolls, so no carter can say he wasn't told. */
function roadBoard(): IsoModel {
  const m = new IsoModel();
  for (const x of [0.2, 0.8]) post(m, x, 0.5, 0.04, 40);
  m.quad({ x: 0.12, y: 0.52, z: 44 }, { x: 0.76, y: 0, z: 0 }, { x: 0, y: 0, z: -24 }, tollBoardFace);
  return m;
}

// ======================================================================= walls

export type TollWallKind =
  | 'plain' | 'window' | 'door' | 'irondoor' | 'shelf' | 'tolls' | 'portrait' | 'proclaim' | 'hanging' | 'notice'
  | 'stone' | 'slit' | 'rack' | 'panel' | 'bigportrait' | 'mirror' | 'keyhook';

/** The office's limewash over stone: grey-white, the damp blooming through it low down, soot high up, the stone showing where it's flaked. */
function limewash(x: number, y: number, seed: number): number {
  const n = smoothNoise(x / 8 + seed * 2.3, y / 10, seed);
  let c = n > 0.64 ? LIME_LIGHT : n < 0.34 ? LIME_DARK : LIME;
  const damp = smoothNoise(x / 6 + 30, y / 6, seed + 9);
  if (damp > 0.66 && y > WALL_HEIGHT * 0.5) c = mixColor(c, LIME_DAMP, 0.7);
  const soot = Math.max(0, 1 - y / 26) * 0.5;
  if (soot > 0) c = mixColor(c, SOOT, soot * (0.5 + smoothNoise(x / 5, y / 4, seed + 1) * 0.5));
  // Flaked: the stone underneath.
  const flake = smoothNoise(x / 4 + seed * 4, y / 4, seed + 17);
  if (flake > 0.84) return (Math.floor(y / 5) + Math.floor(x / 8)) % 2 ? STONE : STONE_DARK;
  return c;
}

/** The strongroom's walls: big dressed blocks, close-jointed, cold and dry. */
function strongStone(x: number, y: number, seed: number): number {
  const row = Math.floor(y / 14);
  const fu = (x + (row % 2) * 12) / 24;
  const lv = (y % 14) / 14;
  const lu = fu - Math.floor(fu);
  if (lv < 0.07 || lu < 0.03) return MORTAR;
  const n = hash(Math.floor(fu) + seed * 3, row);
  let c = n < 0.3 ? STONE_DARK : n > 0.78 ? STONE_LIGHT : STONE;
  if (lv < 0.16) c = lighten(c, 0.07);
  if (lv > 0.9) c = darken(c, 0.85);
  if (smoothNoise(x / 5, y / 5, seed) > 0.76) c = darken(c, 0.88);
  return c;
}

/** Oak panelling below, yellow damask above, a gilt rail between: the Reeve's rooms. */
function panelling(x: number, y: number, seed: number): number {
  if (y > WALL_HEIGHT - 34) {
    // Linenfold panels, two to a tile, each with a raised field and a shadowed edge.
    const px = x % 16;
    const py = y - (WALL_HEIGHT - 34);
    if (y > WALL_HEIGHT - 3) return OAK_DARK;
    if (px < 1.5 || px > 14.5 || py < 2 || py > 29) return OAK_DARK;
    if (px < 3 || py < 4) return OAK_LIGHT;
    const fold = Math.sin(px * 1.4);
    return fold > 0.4 ? OAK_LIGHT : fold < -0.5 ? OAK_DARK : OAK;
  }
  if (Math.abs(y - (WALL_HEIGHT - 36)) < 2) return y < WALL_HEIGHT - 36 ? GILT_LIGHT : GILT_DARK;
  if (y < 4) return y < 2 ? OAK_LIGHT : OAK_DARK;
  // Damask: a repeating pomegranate figure in a darker and lighter yellow.
  const fx = ((x + seed * 3) % 16) - 8;
  const fy = (y % 20) - 10;
  const figure = Math.hypot(fx * 1.1, fy * 0.8) < 4.4 + Math.sin(Math.atan2(fy, fx) * 4) * 0.8;
  const stem = Math.abs(fx) < 0.7 && fy > 3;
  let c = figure || stem ? DAMASK_LIGHT : (Math.floor(x) + Math.floor(y)) % 3 === 0 ? DAMASK_DARK : DAMASK;
  // It's already marking with the damp. Even here.
  if (smoothNoise(x / 9, y / 7, seed + 3) > 0.74) c = mixColor(c, 0x6a6a4a, 0.5);
  if (y < 12) c = mixColor(c, SOOT, (12 - y) / 24);
  return c;
}

/** A gilt picture frame round (x0..x1, y0..y1), or null inside it / outside it. */
function frame(x: number, y: number, x0: number, x1: number, y0: number, y1: number): number | null {
  if (x < x0 || x > x1 || y < y0 || y > y1) return null;
  const e = Math.min(x - x0, x1 - x, y - y0, y1 - y);
  if (e < 1) return GILT_DARK;
  if (e < 2.4) return (Math.floor(x + y) % 3) ? GILT : GILT_LIGHT;
  if (e < 3) return GILT_DARK;
  return null;
}

/** The Reeve, painted: a long yellow face over a fur collar and a chain, a black hat; flattering, and not enough. (px, py) within the canvas, 0..1. */
function reevePainted(px: number, py: number): number {
  const bg = mixColor(0x2a2a22, 0x4a3a22, py);
  const cx = 0.5;
  // The black gown and the fur collar.
  if (py > 0.6) {
    if (Math.abs(px - cx) < 0.38 - (1 - py) * 0.3) {
      if (py < 0.72 && Math.abs(px - cx) > 0.08) return Math.floor(px * 40) % 2 ? 0x6a5a48 : 0x8a7a62;
      // The chain of office across the breast.
      if (Math.abs(py - (0.78 + Math.abs(px - cx) * 0.4)) < 0.02) return GILT_LIGHT;
      return 0x1e1a1e;
    }
    return bg;
  }
  // The face: long, yellow, a thin smile, black hair oiled flat, a black cap.
  const fx = (px - cx) / 0.17;
  const fy = (py - 0.38) / 0.24;
  if (fx * fx + fy * fy < 1) {
    if (fy < -0.55) return 0x141214;
    if (Math.abs(fy + 0.1) < 0.08 && Math.abs(Math.abs(fx) - 0.4) < 0.15) return 0x1e1a1a;
    if (Math.abs(fy - 0.5) < 0.05 && Math.abs(fx) < 0.35) return 0x7a3a2a;
    if (Math.abs(fx) > 0.82 && fy < 0.2) return 0x141214;
    return fx < -0.2 ? 0xc8b078 : 0xd8c088;
  }
  if (py < 0.2 && Math.abs(px - cx) < 0.22) return 0x141214;
  return bg;
}

function tollWallShader(kind: TollWallKind, side: 'back' | 'side', index: number): Shader {
  const seed = index * 17 + (side === 'back' ? 5 : 9) + kind.length * 3;
  const upstairs = kind === 'panel' || kind === 'bigportrait' || kind === 'mirror' || kind === 'keyhook';
  const strong = kind === 'stone' || kind === 'slit' || kind === 'rack';
  return (u, v) => {
    const x = u * 32;
    const y = v * WALL_HEIGHT;
    const base = (): number => {
      if (strong) return strongStone(x + index * 32, y, seed);
      if (upstairs) return panelling(x + index * 32, y, seed);
      // The office: a top plate, limewash, an oak dado along the bottom.
      if (y < 5) return y < 2 ? BLACK_OAK_LIGHT : BLACK_OAK;
      if (y > WALL_HEIGHT - 20) {
        const dy = y - (WALL_HEIGHT - 20);
        if (dy < 2) return OAK_LIGHT;
        if (y > WALL_HEIGHT - 2) return OAK_DARK;
        // Boots have kicked it, and the mud has splashed it.
        if (hash(Math.floor(x + index * 32), Math.floor(y / 2)) < 0.06) return MUD;
        return (Math.floor(x + index * 32) % 8) < 1 ? OAK_DARK : OAK;
      }
      return limewash(x + index * 32, y, seed);
    };

    if (kind === 'window') {
      // A real glazed window, small square panes, a stone (or oak) reveal, and grey daylight.
      if (x > 7 && x < 25 && y > 14 && y < 44) {
        if (x < 9 || x > 23 || y < 16 || y > 42) return upstairs || side === 'side' ? OAK_DARK : STONE_DARK;
        if ((x - 9) % 4.67 < 0.8 || (y - 16) % 6.5 < 0.8) return BLACK_OAK;
        const n = smoothNoise(x / 3, y / 3, seed);
        return n > 0.7 ? GLASS_LIGHT : n < 0.3 ? mixColor(GLASS, 0x1a2228, 0.4) : GLASS;
      }
      if (x > 6 && x < 26 && y >= 44 && y < 47) return STONE_LIGHT;
      // Yellow curtains either side, upstairs.
      if (upstairs && y > 10 && y < 52 && (x < 8 || x > 24)) return Math.sin(x * 2) > 0 ? YELLOW : YELLOW_DARK;
    }
    if (kind === 'door' && x > 6 && x < 26 && y > 12) {
      if (upstairs) {
        // The stairhead: an open doorway, the stairs going down into the dark.
        if (x < 8 || x > 24 || y < 14) return OAK_DARK;
        const step = Math.floor((y - 14) / 9);
        return step % 2 ? 0x1a1410 : mixColor(0x3a2a1e, 0x0e0a08, step / 8);
      }
      // A heavy oak door, iron-strapped, with the Reeve's scales burnt into the middle plank.
      if (x < 8 || x > 24 || y < 14) return BLACK_OAK;
      if ((Math.floor(x) - 8) % 5 === 0) return BLACK_OAK;
      if (Math.abs(y - 26) < 1.4 || Math.abs(y - 66) < 1.4) return x > 20 ? IRON : IRON_LIGHT;
      if (x > 13 && x < 19 && y > 36 && y < 44) {
        const s = scalesMark((x - 13) / 6, (y - 36) / 8, 0x1a1210);
        if (s !== null) return s;
      }
      if (Math.abs(x - 10) < 1 && Math.abs(y - 50) < 2) return BRASS;
      return (Math.floor(x) % 5) < 1 ? OAK_DARK : OAK;
    }
    if (kind === 'irondoor' && x > 6 && x < 26 && y > 12) {
      // The strongroom door: iron plate over oak, riveted in rows, a great lock and a hasp with a padlock.
      if (x < 8 || x > 24 || y < 14) return strong ? STONE_DARK : BLACK_OAK;
      const plate = (Math.floor((y - 14) / 14) + Math.floor((x - 8) / 8)) % 2;
      if ((y - 14) % 14 < 1 || (x - 8) % 8 < 0.8) return IRON_DARK;
      if (((y - 14) % 14 > 2 && (y - 14) % 14 < 3.2 && (x - 8) % 4 < 1.2) || ((x - 8) % 8 > 6.6 && (y - 14) % 4 < 1.2)) return IRON_LIGHT;
      if (Math.abs(x - 20) < 2.5 && Math.abs(y - 48) < 4) return Math.abs(x - 20) < 0.8 && Math.abs(y - 48) < 1.6 ? 0x0a0808 : BRASS;
      if (Math.abs(x - 20) < 1.5 && y > 52 && y < 58) return BRASS_DARK;
      const rust = smoothNoise(x / 3, y / 3, seed) > 0.72;
      return rust ? RUST : plate ? IRON : mixColor(IRON, IRON_LIGHT, 0.3);
    }
    if (kind === 'shelf') {
      // Pigeonholes of rolled and tied papers (downstairs), or books and bottles (upstairs).
      if (x > 3 && x < 29 && y > 14 && y < 50) {
        if (x < 4.5 || x > 27.5 || y < 15.5 || y > 48.5 || (x - 4.5) % 7.7 < 1 || (y - 15.5) % 11 < 1) return OAK_DARK;
        const cell = Math.floor((x - 4.5) / 7.7) + Math.floor((y - 15.5) / 11) * 3;
        if (upstairs || side === 'side') {
          const spine = Math.floor(x * 1.3 + cell) % 4;
          return [0x5a2a22, 0x2a3a4a, 0x4a3a22, GILT_DARK][spine];
        }
        const ry = ((y - 15.5) % 11) / 11;
        const rx = ((x - 4.5) % 7.7) / 7.7;
        if (Math.hypot(rx - 0.3, ry - 0.5) < 0.28 || Math.hypot(rx - 0.72, ry - 0.6) < 0.24) return Math.abs(rx - 0.5) < 0.05 ? WAX_RED : PAPER;
        return 0x1a1410;
      }
    }
    if (kind === 'tolls') {
      // The table of tolls, painted big on a board: a yellow head with the scales, and rows of black lettering.
      if (x > 2 && x < 30 && y > 10 && y < 60) {
        if (x < 3.5 || x > 28.5 || y < 11.5 || y > 58.5) return BLACK_OAK;
        if (y < 22) {
          const s = scalesMark((x - 12) / 8, (y - 12) / 9, INK);
          return s ?? YELLOW;
        }
        const row = (y - 24) / 4.2;
        if (row > 0 && row % 1 < 0.42 && x > 6 && x < 26 - (Math.floor(row) % 3) * 3 && Math.floor(x * 1.6 + row * 3) % 4) return INK;
        // A sum on each line, to the right, and a fresh line added at the bottom in red.
        if (row > 0 && row % 1 < 0.42 && x > 25 && x < 27.5) return Math.floor(row) === 7 ? WAX_RED : INK;
        return smoothNoise(x / 5, y / 7, seed) > 0.7 ? PAPER_DARK : PAPER;
      }
    }
    if (kind === 'portrait' || kind === 'bigportrait') {
      const big = kind === 'bigportrait';
      const [fx0, fx1, fy0, fy1] = big ? [3, 29, 8, 56] : [7, 25, 12, 44];
      const f = frame(x, y, fx0, fx1, fy0, fy1);
      if (f !== null) return f;
      if (x > fx0 + 3 && x < fx1 - 3 && y > fy0 + 3 && y < fy1 - 3) return reevePainted((x - fx0 - 3) / (fx1 - fx0 - 6), (y - fy0 - 3) / (fy1 - fy0 - 6));
      // The nail and cord it hangs from.
      if (Math.abs(x - 16) < 0.8 && y > fy0 - 6 && y < fy0) return 0x8a7a5a;
    }
    if (kind === 'proclaim' || kind === 'notice') {
      // A proclamation nailed up, its red seal and ribbon; or a scatter of notices, one over another.
      const sheets: Array<[number, number, number, number]> = kind === 'proclaim' ? [[8, 24, 14, 50]] : [[4, 14, 18, 34], [15, 27, 14, 30], [9, 21, 34, 48]];
      for (const [a, b, c, d] of sheets) {
        if (x > a && x < b && y > c && y < d) {
          if (kind === 'proclaim' && Math.hypot(x - 16, y - 45) < 2.6) return WAX_RED;
          if (kind === 'proclaim' && y > 45 && Math.abs(x - 16 - (y - 45) * 0.3) < 0.8) return YELLOW;
          if (Math.abs(x - (a + 1.5)) < 0.6 && Math.abs(y - (c + 1.5)) < 0.6) return IRON;
          const line = (y - c - 4) / 3;
          if (line > 0 && line % 1 < 0.4 && x > a + 2 && x < b - 2 && y < d - 4 && hash(Math.floor(x), Math.floor(line)) > 0.25) return INK;
          return (x + y) % 9 < 0.6 ? PAPER_DARK : PAPER;
        }
      }
    }
    if (kind === 'hanging') {
      // A long yellow hanging with the scales, gold-fringed; or, upstairs, a tapestry of a hunt nobody here has ridden in.
      if (x > 6 && x < 26 && y > 6 && y < 62) {
        if (y < 8) return GILT_DARK;
        if (y > 58) return Math.floor(x) % 2 ? GILT : null;
        if (upstairs || kind === 'hanging' && side === 'side' && index % 2 === 1) {
          const n = smoothNoise(x / 4, y / 4, seed);
          if (Math.hypot(x - 14, y - 34) < 5) return 0x8a5a3a; // a stag
          if (Math.abs(y - 40 - Math.sin(x / 3) * 2) < 1.4 && x > 18) return 0x5a3a22; // the hounds
          return n > 0.6 ? 0x4a5a32 : n < 0.3 ? 0x2a3a22 : 0x3a4a2a;
        }
        const s = scalesMark((x - 9) / 14, (y - 16) / 18, 0x2a2018);
        if (s !== null) return s;
        const fold = Math.sin(x * 1.1);
        return fold > 0.5 ? YELLOW_LIGHT : fold < -0.5 ? YELLOW_DARK : YELLOW;
      }
    }
    if (kind === 'mirror') {
      const f = frame(x, y, 8, 24, 10, 50);
      if (f !== null) return f;
      if (x > 11 && x < 21 && y > 13 && y < 47) {
        const n = (x * 0.6 + y * 0.3) % 6;
        return n < 0.8 ? SILVER_LIGHT : smoothNoise(x / 4, y / 6, seed) > 0.6 ? SILVER : mixColor(SILVER_DARK, 0x6a5a3a, 0.3);
      }
    }
    if (kind === 'keyhook') {
      // A brass hook screwed into the panelling, worn bright where something heavy hangs from it at night.
      if (Math.abs(x - 16) < 1.2 && y > 30 && y < 35) return BRASS_LIGHT;
      if (Math.abs(x - 17.5) < 0.8 && y > 34 && y < 37) return BRASS;
      if (Math.abs(x - 16) < 3 && y > 35 && y < 44 && hash(Math.floor(x), Math.floor(y)) < 0.4) return mixColor(DAMASK_DARK, 0x4a3a1a, 0.5); // a worn shadow
    }
    if (kind === 'slit') {
      // A narrow barred slit high up: the only daylight the strongroom gets.
      if (x > 12 && x < 20 && y > 10 && y < 26) {
        if (Math.floor(x) % 3 === 0) return IRON;
        return y < 18 ? 0x8a9aa0 : 0x5a6a70;
      }
    }
    if (kind === 'rack') {
      // Iron rings let into the stone, and a chain hung from them.
      for (const rx of [10, 22]) {
        const d = Math.hypot(x - rx, y - 30);
        if (d > 2 && d < 3.2) return IRON_LIGHT;
      }
      if (Math.abs(y - (32 + Math.sin(((x - 10) / 12) * Math.PI) * 8)) < 1.2 && x > 10 && x < 22) return Math.floor(x) % 2 ? IRON : IRON_LIGHT;
    }
    return base();
  };
}

function tollWall(scene: Phaser.Scene, side: 'back' | 'side', kind: TollWallKind, index: number): void {
  const m = new IsoModel();
  const H = WALL_HEIGHT;
  const cap = 0.14;
  const shade = tollWallShader(kind, side, index);
  const capTone = kind === 'stone' || kind === 'slit' || kind === 'rack' ? STONE_LIGHT : BLACK_OAK_LIGHT;
  if (side === 'back') {
    m.quad({ x: 0, y: 0, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, shade);
    m.quad({ x: 0, y: -cap, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: cap, z: 0 }, lipped(capTone, lighten(capTone, 0.15)));
  } else {
    m.quad({ x: 0, y: 0, z: H }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -H }, (u, v) => {
      const c = shade(u, v);
      return c === null ? null : mixColor(c, 0x0e0a10, 0.22);
    });
    m.quad({ x: -cap, y: 0, z: H }, { x: cap, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, capTone);
  }
  registerModel(scene, `th-wall-${side}-${kind}-${index}`, m.render(false));
}

function cornerPost(tone: 'oak' | 'stone' | 'panel'): IsoModel {
  const m = new IsoModel();
  const c = tone === 'stone' ? STONE : tone === 'panel' ? OAK : BLACK_OAK_LIGHT;
  m.box(-0.16, -0.16, 0, 0.3, 0.3, WALL_HEIGHT + 3, { top: lighten(c, 0.15), left: c, right: darken(c, 0.7) });
  return m;
}

// ======================================================================= floor decals

function decal(paint: Shader, w = 1, h = 1): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: w, y: 0, z: 0 }, { x: 0, y: h, z: 0 }, paint);
  return m;
}

/** Mud and boot prints tramped in off the gate road. */
const mudDecal = (seed: number): Shader => (u, v) => {
  const n = smoothNoise(u * 6, v * 3, seed);
  if (n > 0.6) return n > 0.74 ? MUD_DARK : MUD;
  const pu = (u * 2 + seed) % 1;
  if (Math.hypot(((u * 10) % 1) - 0.5, ((v * 3) % 1) - 0.5) < 0.18 && pu < 0.5 && hash(Math.floor(u * 10), Math.floor(v * 3) + seed) < 0.5) return MUD;
  return null;
};

/** A line chalked on the flags to wait behind, scuffed, with WAIT chalked on it twice. */
const waitLine: Shader = (u, v) => {
  if (Math.abs(v - 0.3) < 0.025 && smoothNoise(u * 40, v, 3) > 0.25) return 0xd8d4c8;
  if (v > 0.38 && v < 0.5) {
    for (const at of [0.2, 0.68]) {
      const lu = (u - at) * 6 * 4;
      if (lu > 0 && lu < 4 && Math.floor(lu * 3) % 3 !== 1 && hash(Math.floor(u * 200), Math.floor(v * 40)) < 0.6) return 0xc8c4b8;
    }
  }
  // Worn pale where the queue stands.
  if (v > 0.55 && smoothNoise(u * 12, v * 6, 4) > 0.55) return 0x7a7672;
  return null;
};

const strawDecal: Shader = (u, v) => {
  const s = Math.sin(u * 90 + Math.sin(v * 13) * 3) * Math.sin(v * 70 + u * 5);
  if (smoothNoise(u * 5, v * 5, 8) < 0.35) return null;
  return s > 0.6 ? 0xc8a85a : s > 0.2 ? 0xa8883e : null;
};

const stainDecal: Shader = (u, v) => {
  const d = Math.hypot(u - 0.5, (v - 0.5) * 1.3);
  if (d > 0.32 + smoothNoise(u * 5, v * 5, 2) * 0.1) return null;
  return d > 0.26 ? 0x3a3430 : 0x4a423c;
};

/** The Reeve's rug before his desk: red and gold, a border of knots, worn where petitioners stand. */
const reeveRug: Shader = (u, v) => {
  if (u < 0.04 || u > 0.96 || v < 0.05 || v > 0.95) return (Math.floor(u * 60) + Math.floor(v * 40)) % 2 ? GILT_DARK : null;
  if (u < 0.1 || u > 0.9 || v < 0.14 || v > 0.86) return (Math.floor(u * 30) + Math.floor(v * 20)) % 3 ? 0x6a1a1a : GILT;
  const d = Math.hypot((u - 0.5) * 1.4, v - 0.5);
  if (Math.abs(d - 0.22) < 0.03) return GILT;
  if (d < 0.1) return 0x2a3a5a;
  const worn = v > 0.65 && Math.abs(u - 0.4) < 0.15 && smoothNoise(u * 20, v * 20, 2) > 0.4;
  return worn ? 0x8a5a4a : (Math.floor(u * 16) + Math.floor(v * 10)) % 2 ? 0x8a2222 : 0x7a1a1e;
};

/** A white bear's fur before the bed, its head still on it, glaring at the bath. */
const furRug: Shader = (u, v) => {
  const d = Math.hypot((u - 0.5) * 1.1, (v - 0.5) * 1.6);
  if (d > 0.48 + Math.sin(Math.atan2(v - 0.5, u - 0.5) * 6) * 0.05) return null;
  if (Math.hypot(u - 0.88, v - 0.5) < 0.1) return Math.hypot(u - 0.92, v - 0.46) < 0.02 ? 0x1a1414 : 0xd8d0c0;
  const n = smoothNoise(u * 30, v * 20, 4);
  return n > 0.6 ? 0xf0ece0 : n < 0.3 ? 0xb8b0a0 : 0xd8d2c4;
};

// ======================================================================= the toll office

/** A counter, black oak front with the Reeve's scales let into every other panel, top worn smooth. `things` varies what's on it. */
function counter(things: number): IsoModel {
  const m = new IsoModel();
  const front: Shader = (u, v) => {
    if (v < 0.06 || v > 0.9) return OAK_DARK;
    const pu = (u * 2) % 1;
    if (pu < 0.08 || pu > 0.92 || v < 0.16 || v > 0.82) return OAK;
    if (Math.floor(u * 2) === things % 2) {
      const s = scalesMark((pu - 0.2) / 0.6, (v - 0.22) / 0.55, OAK_LIGHT);
      if (s !== null) return s;
    }
    if (v > 0.7 && hash(Math.floor(u * 40), Math.floor(v * 30)) < 0.18) return MUD; // kicked by a hundred boots
    return pu < 0.16 ? OAK_LIGHT : OAK;
  };
  const top: Shader = (u, v) => {
    const b = planks(2, OAK_TOP, OAK_DARK, OAK_LIGHT, 7)(u, v) ?? OAK_TOP;
    return v > 0.7 && smoothNoise(u * 6, v * 4, things) > 0.5 ? lighten(b, 0.12) : b;
  };
  m.box(0, 0.22, 0, 1, 0.56, 28, { top: OAK_TOP, left: front, right: (u, v) => darken(front(u, v) ?? OAK, 0.7) });
  m.box(0, 0.14, 28, 1, 0.72, 3, { top, left: OAK_LIGHT, right: OAK });
  if (things === 0) {
    // An inkwell and a quill, a sand-shaker, a pile of tallies.
    m.cylinder(0.3, 0.34, 31, 0.06, 4, (u) => (u < 0.3 ? 0x4a4a52 : 0x2a2a30), INK);
    line(m, { x: 0.32, y: 0.34, z: 34 }, { x: 0.45, y: 0.3, z: 42 }, 0xe8e0d0, 0.02);
    for (let i = 0; i < 4; i++) m.box(0.55 + i * 0.04, 0.5, 31 + i * 0.6, 0.3, 0.04, 0.6, { top: 0xb08a5a, left: 0x8a6a42, right: 0x6a4e30 });
  } else if (things === 1) {
    // A money tray of beaten brass, a few coppers in it, and a tin cup.
    m.box(0.2, 0.3, 31, 0.4, 0.36, 1.5, { top: (u, v) => (u > 0.1 && u < 0.9 && v > 0.1 && v < 0.9 ? BRASS_DARK : BRASS_LIGHT), left: BRASS, right: BRASS_DARK });
    for (let i = 0; i < 4; i++) m.cylinder(0.3 + (i % 2) * 0.12, 0.42 + i * 0.04, 32.5 + (i > 1 ? 0.6 : 0), 0.04, 0.6, () => 0x9a6a3a, 0xc08a4a);
    m.cylinder(0.75, 0.4, 31, 0.06, 6, (u) => (u < 0.3 ? 0xa8a8b0 : 0x6a6a72), 0x4a4a52);
  } else {
    // Ledgers stacked open, and a candle stub in a dish.
    m.box(0.15, 0.25, 31, 0.5, 0.45, 2.5, { top: (u) => (Math.abs(u - 0.5) < 0.03 ? OAK_DARK : PAPER), left: LEATHER, right: LEATHER_DARK });
    m.box(0.2, 0.3, 33.5, 0.42, 0.38, 2, { top: PAPER, left: 0x2a3a4a, right: 0x1a2a3a });
    m.cylinder(0.78, 0.5, 31, 0.07, 1, () => BRASS_DARK, BRASS);
    m.box(0.76, 0.48, 32, 0.04, 0.04, 5, { top: P.fireYellow, left: 0xe0d8c0, right: 0xb0a890 });
  }
  return m;
}

/** The counter's grille: iron bars from the top to a hood, a little arched window to pass coin, and (with `stamp`) the Reeve's seal and its ink pad. */
function grille(stamp: boolean): IsoModel {
  const m = counter(stamp ? 1 : 2);
  const z0 = 31;
  const zH = 46;
  // The frame of black oak, and the bars.
  m.box(0, 0.42, z0, 0.06, 0.08, zH, { top: BLACK_OAK_LIGHT, left: BLACK_OAK, right: BLACK_OAK });
  m.box(0.94, 0.42, z0, 0.06, 0.08, zH, { top: BLACK_OAK_LIGHT, left: BLACK_OAK, right: BLACK_OAK });
  m.box(0, 0.38, z0 + zH, 1, 0.16, 5, { top: BLACK_OAK_LIGHT, left: (u) => (Math.abs(u - 0.5) < 0.2 ? GILT : BLACK_OAK), right: BLACK_OAK });
  m.quad({ x: 0.06, y: 0.48, z: z0 + zH }, { x: 0.88, y: 0, z: 0 }, { x: 0, y: 0, z: -zH }, (u, v) => {
    const y = v * zH;
    // The pass-through at the bottom, arched.
    if (y > zH - 12 && Math.abs(u - 0.5) < 0.18 && y > zH - 12 + (1 - Math.sqrt(Math.max(0, 1 - ((u - 0.5) / 0.18) ** 2))) * 5) return null;
    if (Math.abs(y - zH * 0.45) < 1) return IRON;
    return Math.floor(u * 22) % 3 === 0 ? ((u * 22) % 1 < 0.4 ? IRON_LIGHT : IRON) : null;
  });
  if (stamp) {
    // The seal on its handle, and the ink pad.
    m.box(0.2, 0.62, 31, 0.16, 0.12, 1, { top: 0x2a1a2a, left: 0x1a101a, right: 0x100a10 });
    m.cylinder(0.65, 0.66, 31, 0.05, 3, () => BRASS, BRASS_LIGHT);
    m.cylinder(0.65, 0.66, 34, 0.025, 5, (u) => (u < 0.4 ? OAK_LIGHT : OAK), OAK_LIGHT);
  }
  return m;
}

function counterEnd(): IsoModel {
  const m = new IsoModel();
  m.box(0.22, 0.22, 0, 0.78, 0.56, 28, { top: OAK_TOP, left: OAK, right: OAK_DARK });
  m.box(0.14, 0.14, 28, 0.86, 0.72, 3, { top: OAK_TOP, left: OAK_LIGHT, right: OAK });
  // A turned newel post at the end, gilt-capped.
  m.cylinder(0.3, 0.5, 31, 0.07, 18, (u) => (u < 0.4 ? OAK_LIGHT : OAK_DARK), OAK_TOP);
  m.cylinder(0.3, 0.5, 49, 0.09, 4, () => GILT, GILT_LIGHT);
  return m;
}

/** The counter's hinged flap, propped up: the way through to Nibb's side, if Gaff lets you. */
function flap(): IsoModel {
  const m = new IsoModel();
  m.box(0, 0.22, 0, 0.18, 0.56, 28, { top: OAK_TOP, left: OAK, right: OAK_DARK });
  // A half-door below, swung open, and the flap of the counter top raised against the post.
  m.box(0.2, 0.22, 2, 0.06, 0.56, 22, { top: OAK_LIGHT, left: OAK, right: (u) => (Math.floor(u * 4) % 2 ? OAK_DARK : OAK) });
  m.box(0.14, 0.14, 28, 0.08, 0.72, 34, { top: OAK_TOP, left: OAK_LIGHT, right: (_u, v) => (Math.abs(v - 0.5) < 0.04 ? IRON : OAK) });
  return m;
}

/** A rail of turned balusters, keeping the public to its side. */
function rail(): IsoModel {
  const m = new IsoModel();
  m.box(0.44, 0, 0, 0.12, 1, 3, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.box(0.42, 0, 28, 0.16, 1, 3, { top: OAK_TOP, left: OAK_LIGHT, right: OAK });
  for (let i = 0; i < 5; i++) m.cylinder(0.5, 0.1 + i * 0.2, 3, 0.03, 25, (u) => (u < 0.4 ? OAK_LIGHT : OAK_DARK), OAK);
  return m;
}

/** The ledger press: a tall cupboard of pigeonholes, ledgers on its shelves with their spines labelled, a ladder-back of tallies. */
function ledgers(): IsoModel {
  const m = new IsoModel();
  m.box(0.05, 0.1, 0, 0.9, 0.6, 70, {
    top: OAK_TOP,
    left: (u, v) => {
      if (u < 0.05 || u > 0.95 || v < 0.03) return OAK_DARK;
      const shelf = Math.floor(v * 5);
      if ((v * 5) % 1 < 0.08) return OAK_DARK;
      // Spines in leather, each with a little paper label.
      const sp = Math.floor(u * 9 + shelf * 3);
      const c = [LEATHER, 0x4a2a22, 0x3a3a2a, 0x5a4a2a, 0x2a2a3a][sp % 5];
      if (Math.abs(((v * 5) % 1) - 0.4) < 0.08 && (u * 9) % 1 > 0.2 && (u * 9) % 1 < 0.8) return PAPER;
      return (u * 9) % 1 < 0.1 ? darken(c, 0.6) : c;
    },
    right: OAK_DARK,
  });
  m.box(0, 0.05, 70, 1, 0.7, 4, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  return m;
}

/** Brass scales on a stand, a pile of weights beside them, and a pan already a hair too low. */
function scales(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.1, 0, 0.8, 0.7, 26, { top: OAK_TOP, left: (u, v) => (v < 0.1 ? OAK_LIGHT : (u * 3) % 1 < 0.05 ? OAK_DARK : OAK), right: OAK_DARK });
  m.cylinder(0.5, 0.45, 26, 0.05, 26, (u) => (u < 0.4 ? BRASS_LIGHT : BRASS_DARK), BRASS);
  m.box(0.16, 0.42, 52, 0.68, 0.05, 2, { top: BRASS_LIGHT, left: BRASS, right: BRASS_DARK });
  for (const [x, z] of [[0.2, 38], [0.8, 37]] as const) {
    line(m, { x: x, y: 0.44, z: 52 }, { x: x, y: 0.44, z: z + 1 }, BRASS_DARK, 0.01);
    m.cylinder(x, 0.44, z, 0.12, 1.5, () => BRASS, BRASS_LIGHT);
  }
  // The weights, stacked in a row.
  for (let i = 0; i < 4; i++) m.cylinder(0.25 + i * 0.12, 0.7, 26, 0.03 + i * 0.008, 2 + i, () => BRASS_DARK, BRASS);
  return m;
}

/** Nibb's high desk: a sloped top with a ledger open on it, a candle, ink, and a pair of spectacles left on the page. */
function desk(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.15, 0.2], [0.8, 0.2], [0.15, 0.75], [0.8, 0.75]]) m.box(x, y, 0, 0.06, 0.06, 36, { top: OAK, left: OAK, right: OAK_DARK });
  m.box(0.12, 0.2, 10, 0.76, 0.6, 2, { top: OAK, left: OAK_DARK, right: OAK_DARK }); // a foot shelf with old ledgers
  m.box(0.18, 0.25, 12, 0.6, 0.45, 5, { top: PAPER_DARK, left: LEATHER, right: LEATHER_DARK });
  m.quad({ x: 0.1, y: 0.15, z: 42 }, { x: 0.8, y: 0, z: 0 }, { x: 0, y: 0.7, z: -6 }, (u, v) => {
    // The open ledger, columns ruled red, the sums in a small hand.
    if (u > 0.12 && u < 0.88 && v > 0.15 && v < 0.85) {
      if (Math.abs(u - 0.5) < 0.015) return OAK_DARK;
      if ((u * 8) % 1 < 0.04) return 0xa04040;
      if ((v * 12) % 1 < 0.3 && hash(Math.floor(u * 40), Math.floor(v * 12)) > 0.35) return INK;
      return PAPER;
    }
    return u < 0.04 || u > 0.96 ? OAK_DARK : OAK_TOP;
  });
  // Spectacles on the page, wire-rimmed.
  m.cylinder(0.38, 0.52, 40, 0.04, 0.5, () => IRON_LIGHT, GLASS_LIGHT);
  m.cylinder(0.48, 0.52, 40, 0.04, 0.5, () => IRON_LIGHT, GLASS_LIGHT);
  m.cylinder(0.78, 0.3, 36, 0.05, 1, () => BRASS_DARK, BRASS);
  m.box(0.76, 0.28, 37, 0.04, 0.04, 6, { top: P.fireYellow, left: 0xe0d8c0, right: 0xb0a890 });
  return m;
}

/** Nibb's stool behind the grille: a clerk's stool, three-legged, worn smooth. */
function highStool(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.4, 0.42], [0.58, 0.42], [0.48, 0.58]]) m.box(x, y, 0, 0.03, 0.03, SEAT_TOP - 2.5, { top: OAK, left: OAK, right: OAK_DARK });
  m.cylinder(0.5, 0.5, SEAT_TOP - 2.5, 0.125, 2.5, (u) => (u < 0.4 ? OAK_LIGHT : OAK_DARK), OAK_TOP);
  return m;
}

function stool(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.41, 0.41], [0.56, 0.41], [0.41, 0.56], [0.56, 0.56]]) m.box(x, y, 0, 0.03, 0.03, SEAT_TOP - 2.5, { top: OAK, left: OAK, right: OAK_DARK });
  m.cylinder(0.5, 0.5, SEAT_TOP - 2.5, 0.125, 2.5, (u) => (u < 0.4 ? OAK_LIGHT : OAK_DARK), OAK_TOP);
  return m;
}

/** Bundles of hazel tally sticks on a shelf, both halves of each kept, tied with string. */
function tallySticks(): IsoModel {
  const m = new IsoModel();
  m.box(0.15, 0.08, 0, 0.7, 0.45, 18, { top: OAK_TOP, left: OAK, right: OAK_DARK });
  for (let b = 0; b < 3; b++) {
    for (let i = 0; i < 6; i++) {
      const x = 0.22 + b * 0.2 + (i % 3) * 0.03;
      const z = 18 + Math.floor(i / 3) * 1.5;
      m.box(x, 0.15, z, 0.025, 0.32, 1.4, { top: (u) => ((u * 8) % 1 < 0.2 ? 0x5a4428 : 0xc8a870), left: 0xa88a5a, right: 0x7a6440 });
    }
    m.box(0.21 + b * 0.2, 0.28, 18, 0.1, 0.02, 3.2, { top: 0xd8ccaa, left: 0xd8ccaa, right: 0xb0a488 });
  }
  return m;
}

/** The takings chest: iron-bound, padlocked twice, a slot in its lid. */
function takings(): IsoModel {
  const m = new IsoModel();
  const band = (u: number) => Math.abs(u - 0.2) < 0.04 || Math.abs(u - 0.8) < 0.04;
  m.box(0.1, 0.18, 0, 0.8, 0.64, 18, {
    top: (u, v) => (band(u) ? IRON_LIGHT : Math.abs(v - 0.5) < 0.05 && Math.abs(u - 0.5) < 0.12 ? 0x0a0808 : OAK),
    left: (u, v) => (band(u) || v < 0.12 ? IRON : Math.hypot(u - 0.5, v - 0.4) < 0.08 ? BRASS : OAK),
    right: (u) => (band(u) ? IRON_DARK : OAK_DARK),
  });
  for (const x of [0.38, 0.62]) m.box(x, 0.82, 8, 0.06, 0.03, 5, { top: BRASS, left: BRASS, right: BRASS_DARK });
  return m;
}

/** Nibb's cot behind the takings chest: a plank bed, a thin grey blanket, a pillow of ledgers. */
function cot(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.05, 0, 0.8, 1.9, 8, { top: OAK, left: OAK_DARK, right: OAK_DARK });
  m.box(0.12, 0.3, 8, 0.76, 1.6, 2, { top: (u, v) => (smoothNoise(u * 4, v * 6, 5) > 0.6 ? 0x6a6662 : 0x5a5654), left: 0x4a4644, right: 0x3a3634 });
  m.box(0.2, 0.08, 8, 0.6, 0.22, 4, { top: PAPER_DARK, left: LEATHER, right: LEATHER_DARK });
  return m;
}

/** A lantern on a post by the strongroom door. */
function lanternPost(): IsoModel {
  const m = new IsoModel();
  m.box(0.4, 0.4, 0, 0.2, 0.2, 70, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.box(0.6, 0.46, 60, 0.16, 0.04, 2, { top: IRON, left: IRON, right: IRON });
  m.box(0.68, 0.42, 44, 0.13, 0.13, 14, {
    top: IRON,
    left: (u, v) => (u < 0.15 || u > 0.85 || v < 0.1 || v > 0.9 ? IRON : v > 0.5 ? P.fireOrange : P.fireYellow),
    right: (u, v) => (u < 0.15 || u > 0.85 || v < 0.1 || v > 0.9 ? IRON_DARK : P.fireOrange),
  });
  return m;
}

/** The bench along the wall for those waiting: hard, narrow, polished by everybody who has waited on it. */
function bench(): IsoModel {
  const m = new IsoModel();
  for (const y of [0.15, 1.0, 1.85]) m.box(0.15, y - 0.05, 0, 0.4, 0.1, SEAT_TOP - 2.5, { top: OAK, left: OAK_DARK, right: OAK_DARK });
  m.box(0.1, 0.05, SEAT_TOP - 2.5, 0.5, 1.9, 2.5, { top: (u, v) => (smoothNoise(u * 3, v * 9, 3) > 0.55 ? OAK_LIGHT : OAK_TOP), left: OAK, right: OAK_DARK });
  // A shawl someone left, and a basket with nothing in it.
  m.box(0.14, 0.2, SEAT_TOP, 0.4, 0.3, 1, { top: 0x5a4a6a, left: 0x4a3a5a, right: 0x3a2a4a });
  m.cylinder(0.35, 1.75, SEAT_TOP, 0.14, 6, (u, v) => (Math.floor(v * 4 + u * 8) % 2 ? WICKER : WICKER_DARK), WICKER_DARK);
  return m;
}

/** A charcoal brazier on iron legs, sea coal glowing in it. */
function brazier(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.3, 0.3], [0.7, 0.3], [0.5, 0.75]]) line(m, { x, y, z: 0 }, { x: (x + 0.5) / 2, y: (y + 0.5) / 2, z: 14 }, IRON, 0.03);
  m.cylinder(0.5, 0.5, 14, 0.22, 7, (u, v) => (v < 0.2 ? IRON_LIGHT : u < 0.3 ? IRON_LIGHT : IRON), (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.42) return IRON;
    const n = hash(Math.floor(u * 12), Math.floor(v * 12));
    return n < 0.35 ? P.fireYellow : n < 0.7 ? P.fireOrange : 0x2a1a14;
  });
  return m;
}

/** The Watch's upturned barrel, dice on it, a boathook chalked on one side and three cleaver notches cut in the other. */
function diceBarrel(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.28, 24, (u, v) => {
    if (Math.abs(v - 0.15) < 0.04 || Math.abs(v - 0.85) < 0.04) return IRON;
    // The Hooks' hook, chalked on the lit side; the Red Aprons' notches on the dark side.
    if (u > 0.08 && u < 0.24 && v > 0.3 && v < 0.62) {
      const lu = (u - 0.08) / 0.16;
      const lv = (v - 0.3) / 0.32;
      if ((Math.abs(lu - 0.55) < 0.12 && lv < 0.7) || (lv > 0.6 && Math.abs(Math.hypot(lu - 0.35, lv - 0.7) - 0.22) < 0.1 && lu < 0.55)) return 0xd8d4c8;
    }
    if (u > 0.55 && u < 0.7 && v > 0.35 && v < 0.6 && (u * 60) % 4 < 1) return 0x2a1a10;
    return Math.floor(u * 16) % 2 ? 0x5a4028 : 0x4a3420;
  }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    return d > 0.44 ? IRON : (Math.floor(u * 6) % 2 ? 0x6a4a2e : 0x5a3e26);
  });
  for (const [dx, dy] of [[0.4, 0.42], [0.52, 0.5], [0.46, 0.6]]) m.box(dx, dy, 24, 0.05, 0.05, 2, { top: (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.2 ? 0x1a1414 : 0xe8e0c8), left: 0xd0c8b0, right: 0xb0a890 });
  for (let i = 0; i < 3; i++) m.cylinder(0.62 + i * 0.03, 0.4, 24 + i * 0.6, 0.035, 0.6, () => 0x9a6a3a, 0xc08a4a);
  return m;
}

/** A handcart with crates of hens on it, distrained, chalked, the hens in them looking at me. */
function handcart(): IsoModel {
  const m = new IsoModel();
  // Two wheels, the bed, the shafts on the floor.
  for (const y of [0.18, 0.82]) m.quad({ x: 0.55, y, z: 18 }, { x: 0.5, y: 0, z: 0 }, { x: 0, y: 0, z: -18 }, (u, v) => {
    const d = Math.hypot(u - 0.5, (v - 0.5) * 1.02);
    if (d > 0.5) return null;
    if (d > 0.42) return OAK_DARK;
    if (d < 0.08) return IRON;
    return Math.abs(Math.sin(Math.atan2(v - 0.5, u - 0.5) * 3)) < 0.12 ? OAK : null;
  });
  m.box(0.1, 0.2, 10, 1.6, 0.6, 3, { top: planks(5, OAK, OAK_DARK, OAK_LIGHT, 4), left: OAK, right: OAK_DARK });
  line(m, { x: 1.7, y: 0.3, z: 12 }, { x: 1.95, y: 0.3, z: 1 }, OAK_DARK, 0.04);
  line(m, { x: 1.7, y: 0.7, z: 12 }, { x: 1.95, y: 0.7, z: 1 }, OAK_DARK, 0.04);
  for (const x of [0.15, 0.85]) hencrate(m, x, 0.22, 13);
  // DISTRAINED, chalked on the side of the bed.
  m.quad({ x: 0.3, y: 0.805, z: 13 }, { x: 1.2, y: 0, z: 0 }, { x: 0, y: 0, z: -3 }, (u) => (Math.floor(u * 40) % 4 < 3 ? 0xd8d4c8 : null));
  return m;
}

function hencrate(m: IsoModel, x: number, y: number, z: number): void {
  m.box(x, y, z, 0.66, 0.56, 14, {
    top: (u, v) => ((u * 6) % 1 < 0.3 ? WICKER : (v * 5) % 1 < 0.3 ? WICKER_DARK : null) as number,
    left: (u, v) => {
      if ((u * 7) % 1 < 0.25 || (v * 4) % 1 < 0.2) return WICKER;
      // A hen inside, red-brown, an eye.
      if (Math.hypot(u - 0.45, v - 0.55) < 0.25) return Math.hypot(u - 0.35, v - 0.4) < 0.04 ? 0x0e0a08 : 0x8a4a2a;
      return 0x1a1410;
    },
    right: (u, v) => ((u * 6) % 1 < 0.25 || (v * 4) % 1 < 0.2 ? WICKER_DARK : 0x100c08),
  });
}

function henCrate(): IsoModel {
  const m = new IsoModel();
  hencrate(m, 0.15, 0.2, 0);
  hencrate(m, 0.2, 0.25, 14);
  return m;
}

/** A cask of lamp oil, branded TALLOW, with a tag tied to its tap and DISTRAINED chalked on it. */
function oilCask(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.3, 26, (u, v) => {
    if (Math.abs(v - 0.12) < 0.04 || Math.abs(v - 0.88) < 0.04 || Math.abs(v - 0.5) < 0.03) return IRON;
    // TALLOW, burnt in.
    if (u > 0.1 && u < 0.35 && Math.abs(v - 0.32) < 0.06 && Math.floor(u * 80) % 3 < 2) return 0x1a1008;
    // DISTRAINED, in chalk.
    if (u > 0.08 && u < 0.4 && Math.abs(v - 0.66) < 0.04 && Math.floor(u * 90) % 4 < 3) return 0xd8d4c8;
    return Math.floor(u * 14) % 2 ? 0x6a4a2a : 0x5a3e22;
  }, (u, v) => (Math.hypot(u - 0.5, v - 0.5) > 0.44 ? IRON : 0x5a3e22));
  m.box(0.46, 0.8, 8, 0.08, 0.1, 3, { top: BRASS, left: BRASS, right: BRASS_DARK });
  m.box(0.47, 0.88, 4, 0.06, 0.02, 4, { top: PAPER, left: PAPER, right: PAPER_DARK });
  return m;
}

/** A crate of seized odds and ends: a pewter jug, a pair of boots, a fiddle neck sticking out. */
function seized(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.1, 0, 0.8, 0.8, 18, {
    top: (u, v) => (u < 0.06 || u > 0.94 || v < 0.06 || v > 0.94 ? 0x4a3a28 : 0x1a1410),
    left: (u, v) => ((v * 3) % 1 < 0.1 ? 0x3a2e20 : Math.abs(v - 0.5) < 0.06 && u > 0.2 && u < 0.8 && Math.floor(u * 40) % 4 < 3 ? 0xd8d4c8 : 0x6a5236),
    right: (_u, v) => ((v * 3) % 1 < 0.1 ? 0x2a2018 : 0x4a3a28),
  });
  m.cylinder(0.35, 0.4, 18, 0.1, 8, (u) => (u < 0.3 ? 0xb4b4bc : 0x6a6a72), 0x8a8a90);
  m.box(0.55, 0.3, 18, 0.12, 0.25, 7, { top: LEATHER, left: LEATHER, right: LEATHER_DARK });
  line(m, { x: 0.7, y: 0.6, z: 16 }, { x: 0.82, y: 0.7, z: 32 }, 0x7a4428, 0.04);
  m.box(0.78, 0.66, 31, 0.08, 0.08, 4, { top: 0x5a3018, left: 0x7a4428, right: 0x5a3018 });
  return m;
}

/** Eel creels, stacked: long wicker traps with their funnels, a fisher's mark burnt in the rim. */
function creels(): IsoModel {
  const m = new IsoModel();
  for (let i = 0; i < 3; i++) {
    const z = i * 9;
    const y = 0.2 + (i % 2) * 0.12;
    m.cylinder(0.5, y + 0.25, z, 0.22, 9, (u, v) => ((Math.floor(u * 14) + Math.floor(v * 3)) % 2 ? WICKER : WICKER_DARK), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.2 ? 0x1a1410 : WICKER_DARK));
  }
  // A tag: MARL, and the sum owed.
  m.box(0.65, 0.68, 14, 0.12, 0.02, 6, { top: PAPER, left: (u, v) => (v > 0.3 && v < 0.5 && u > 0.2 && u < 0.8 ? INK : PAPER), right: PAPER_DARK });
  return m;
}

/** A bolt of good blue cloth, unrolled a little, and DISTRAINED on it in chalk. */
function boltCloth(): IsoModel {
  const m = new IsoModel();
  m.box(0.15, 0.25, 0, 0.7, 0.5, 4, { top: OAK, left: OAK_DARK, right: OAK_DARK });
  m.cylinder(0.5, 0.5, 4, 0.2, 14, (u, v) => (Math.abs(v - 0.5) < 0.05 && u < 0.4 ? 0xd8d4c8 : u < 0.3 ? lighten(CLOTH_BLUE, 0.15) : (Math.floor(v * 20) % 2 ? CLOTH_BLUE : darken(CLOTH_BLUE, 0.85))), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.08 ? OAK : (Math.floor(Math.hypot(u - 0.5, v - 0.5) * 40) % 2 ? CLOTH_BLUE : darken(CLOTH_BLUE, 0.8))));
  m.quad({ x: 0.3, y: 0.7, z: 4 }, { x: 0.4, y: 0, z: 0 }, { x: 0, y: 0.25, z: -4 }, CLOTH_BLUE);
  return m;
}

/** The notice board by the door. */
function board(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.04, y: 0.15, z: 66 }, { x: 0, y: 0.7, z: 0 }, { x: 0, y: 0, z: -30 }, (u, v) => {
    if (u < 0.04 || u > 0.96 || v < 0.05 || v > 0.95) return OAK_DARK;
    for (const [a, b, c, d] of [[0.08, 0.5, 0.1, 0.55], [0.45, 0.92, 0.2, 0.7], [0.15, 0.6, 0.55, 0.9]] as const) {
      if (u > a && u < b && v > c && v < d) return (v * 14) % 1 < 0.3 && u > a + 0.04 && u < b - 0.06 ? INK : PAPER;
    }
    return OAK;
  });
  return m;
}

// ======================================================================= the strongroom

/** A money chest: iron-bound oak on feet, a hasp and a padlock, and a coin or two on the floor where it was filled in a hurry. */
function moneyChest(): IsoModel {
  const m = new IsoModel();
  const band = (u: number) => Math.abs(u - 0.15) < 0.04 || Math.abs(u - 0.5) < 0.04 || Math.abs(u - 0.85) < 0.04;
  m.box(0.1, 0.18, 0, 0.8, 0.64, 22, {
    top: (u) => (band(u) ? IRON_LIGHT : OAK),
    left: (u, v) => (band(u) || v < 0.12 ? IRON : Math.abs(u - 0.5) < 0.08 && v > 0.25 && v < 0.5 ? BRASS : OAK),
    right: (u) => (band(u) ? IRON_DARK : OAK_DARK),
  });
  m.cylinder(0.3, 0.92, 0, 0.04, 0.6, () => 0x9a6a3a, 0xc08a4a);
  return m;
}

/**
 * The coffer: small, black-lacquered and finer than anything else in the town,
 * on a stand, its lid ajar: inside, packed in grey wool, silver coins with a
 * square hole through each and writing round it that nobody here can read.
 */
function coffer(): IsoModel {
  const m = new IsoModel();
  m.box(0.22, 0.22, 0, 0.56, 0.56, 16, { top: STONE_LIGHT, left: STONE, right: STONE_DARK });
  const lacquer = 0x1a1216;
  m.box(0.25, 0.28, 16, 0.5, 0.42, 10, {
    top: (u, v) => {
      // The lid pushed back a little: the grey wool, and the silver in it.
      if (u > 0.08 && u < 0.92 && v > 0.12 && v < 0.6) {
        const cu = (u * 5) % 1;
        const cv = (v * 4) % 1;
        const r = Math.hypot(cu - 0.5, cv - 0.5);
        if (r < 0.36) return Math.abs(cu - 0.5) < 0.08 && Math.abs(cv - 0.5) < 0.08 ? 0x2a2a30 : r < 0.2 ? SILVER_LIGHT : SILVER;
        return 0x8a8a8e;
      }
      return lacquer;
    },
    // A border of silver wire round each face, and a little crane inlaid in mother-of-pearl.
    left: (u, v) => (u < 0.05 || u > 0.95 || v < 0.08 || v > 0.92 ? SILVER_DARK : Math.hypot((u - 0.5) * 1.6, v - 0.5) < 0.18 && hash(Math.floor(u * 30), Math.floor(v * 20)) < 0.6 ? 0xe0e8e8 : lacquer),
    right: (u, v) => (u < 0.05 || u > 0.95 || v < 0.08 || v > 0.92 ? darken(SILVER_DARK, 0.7) : 0x100a0e),
  });
  m.quad({ x: 0.25, y: 0.68, z: 26 }, { x: 0.5, y: 0, z: 0 }, { x: 0, y: 0.14, z: 9 }, (u, v) => (u < 0.05 || u > 0.95 || v > 0.9 ? SILVER_DARK : lacquer));
  return m;
}

/** The lectern with the true book open on it, the letter beside it, a candle, and a fresh drip of grey wax. */
function lectern(): IsoModel {
  const m = new IsoModel();
  m.box(0.4, 0.4, 0, 0.2, 0.2, 30, { top: OAK, left: OAK, right: OAK_DARK });
  m.box(0.25, 0.25, 0, 0.5, 0.5, 3, { top: OAK, left: OAK_DARK, right: OAK_DARK });
  m.quad({ x: 0.15, y: 0.2, z: 38 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0.6, z: -8 }, (u, v) => {
    if (u > 0.08 && u < 0.92 && v > 0.1 && v < 0.9) {
      if (Math.abs(u - 0.5) < 0.02) return LEATHER_DARK;
      // Two columns: what came in, ruled red, and what came from "V.", ruled in grey.
      if ((u * 6) % 1 < 0.05) return u > 0.5 ? 0x6a6a72 : 0xa04040;
      if ((v * 10) % 1 < 0.35 && hash(Math.floor(u * 30), Math.floor(v * 10)) > 0.3) return INK;
      return 0xe4dcc0;
    }
    return u < 0.05 || u > 0.95 ? LEATHER_DARK : LEATHER;
  });
  // A folded letter with a grey seal, an eye pressed in it.
  m.box(0.05, 0.6, 31, 0.22, 0.16, 0.8, { top: (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.2 ? WAX_GREY : PAPER), left: PAPER_DARK, right: PAPER_DARK });
  return m;
}

/** Sacks of coin, tied at the neck, slumped together. */
function coinSacks(): IsoModel {
  const m = new IsoModel();
  for (const [x, y, r, h] of [[0.38, 0.4, 0.18, 14], [0.62, 0.45, 0.16, 12], [0.48, 0.66, 0.15, 11]] as const) {
    m.cylinder(x, y, 0, r, h, (u, v) => (v < 0.2 ? 0x8a7a5a : u < 0.3 ? 0xb8a880 : (Math.floor(v * 10 + u * 3) % 4 === 0 ? 0x8a7a5a : 0x9a8a68)), 0x8a7a5a);
    m.cylinder(x, y, h, r * 0.3, 3, () => 0x6a5a3a, 0x8a7a5a);
  }
  m.cylinder(0.25, 0.75, 0, 0.04, 0.6, () => 0x9a6a3a, 0xc08a4a);
  return m;
}

/** A rack of seized weapons: spears, a fowling piece, a boarding axe, a child's bow. */
function weapons(): IsoModel {
  const m = new IsoModel();
  m.box(0.2, 0.1, 0, 0.6, 0.8, 4, { top: OAK, left: OAK_DARK, right: OAK_DARK });
  m.box(0.2, 0.1, 40, 0.6, 0.8, 2, { top: OAK, left: OAK_DARK, right: OAK_DARK });
  for (let i = 0; i < 4; i++) {
    const y = 0.2 + i * 0.18;
    line(m, { x: 0.5, y, z: 3 }, { x: 0.46, y, z: 62 - (i % 2) * 12 }, i === 3 ? 0x8a6a42 : OAK_LIGHT, 0.03);
    if (i < 2) m.box(0.43, y - 0.02, 62 - (i % 2) * 12, 0.05, 0.05, 7, { top: IRON_LIGHT, left: IRON_LIGHT, right: IRON });
  }
  // The child's bow, little, hung on a peg.
  m.quad({ x: 0.82, y: 0.3, z: 30 }, { x: 0, y: 0.4, z: 0 }, { x: 0, y: 0, z: -14 }, (u, v) => (Math.abs(v - (1 - Math.sin(u * Math.PI)) * 0.7) < 0.12 ? 0x8a5a32 : Math.abs(v - 0.7) < 0.03 ? 0xd8d0b8 : null));
  return m;
}

/** A candle stood on the flags in its own wax. */
function floorCandle(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.1, 1, () => 0xe0d8c0, 0xe0d8c0);
  m.cylinder(0.5, 0.5, 1, 0.04, 9, (u) => (u < 0.4 ? 0xf0e8d0 : 0xc0b8a0), 0xf0e8d0);
  m.box(0.49, 0.49, 10, 0.02, 0.02, 3, { top: P.fireYellow, left: P.fireOrange, right: P.fireYellow });
  return m;
}

// ======================================================================= the Reeve's rooms

/** The Reeve's great desk, two tiles long: carved front, gilt handles, papers and letters, a seal, a silver inkstand, sand, a candelabrum. */
function bigDesk(): IsoModel {
  const m = new IsoModel();
  const front: Shader = (u, v) => {
    if (v < 0.08 || v > 0.92) return OAK_DARK;
    const pu = (u * 4) % 1;
    if (pu < 0.06 || pu > 0.94) return OAK_DARK;
    if (Math.abs(v - 0.3) < 0.08 && Math.abs(pu - 0.5) < 0.1) return GILT;
    if (pu < 0.14 || v < 0.16) return OAK_LIGHT;
    return OAK;
  };
  m.box(0.1, 0.15, 0, 1.8, 0.7, TABLE_TOP - 3, { top: OAK_TOP, left: front, right: OAK_DARK });
  m.box(0.05, 0.1, TABLE_TOP - 3, 1.9, 0.8, 3, { top: (u, v) => (u > 0.3 && u < 0.7 && v > 0.15 && v < 0.85 ? 0x2a4a2a : planks(3, OAK_TOP, OAK_DARK, OAK_LIGHT, 5)(u, v) ?? OAK_TOP), left: OAK_LIGHT, right: OAK });
  // Papers fanned out, letters tied with ribbon.
  for (let i = 0; i < 4; i++) m.box(0.4 + i * 0.14, 0.25 + (i % 2) * 0.12, 17 + i * 0.4, 0.28, 0.36, 0.4, { top: (u, v) => ((v * 8) % 1 < 0.3 && u > 0.1 && u < 0.85 ? INK : PAPER), left: PAPER_DARK, right: PAPER_DARK });
  m.box(1.05, 0.55, 17, 0.24, 0.18, 2, { top: (u) => (Math.abs(u - 0.5) < 0.08 ? YELLOW : PAPER), left: PAPER_DARK, right: PAPER_DARK });
  // A silver inkstand with two quills, the seal, a stick of yellow wax.
  m.box(1.4, 0.3, 17, 0.3, 0.2, 3, { top: SILVER_LIGHT, left: SILVER, right: SILVER_DARK });
  line(m, { x: 1.48, y: 0.38, z: 20 }, { x: 1.6, y: 0.32, z: 30 }, 0xf0e8d8, 0.02);
  line(m, { x: 1.58, y: 0.4, z: 20 }, { x: 1.72, y: 0.36, z: 29 }, 0xe0d8c8, 0.02);
  m.cylinder(1.3, 0.65, 17, 0.04, 6, (u) => (u < 0.4 ? GILT_LIGHT : GILT_DARK), GILT);
  m.box(1.5, 0.66, 17, 0.14, 0.03, 1.2, { top: YELLOW_LIGHT, left: YELLOW, right: YELLOW_DARK });
  // The candelabrum of three.
  m.cylinder(0.25, 0.4, 17, 0.06, 2, () => SILVER, SILVER_LIGHT);
  m.cylinder(0.25, 0.4, 19, 0.02, 12, () => SILVER, SILVER_LIGHT);
  m.box(0.13, 0.38, 30, 0.24, 0.04, 1.5, { top: SILVER_LIGHT, left: SILVER, right: SILVER_DARK });
  for (const dx of [0.14, 0.24, 0.34]) {
    m.box(dx - 0.015, 0.385, 31.5, 0.03, 0.03, 6, { top: 0xf0e8d0, left: 0xf0e8d0, right: 0xc8c0a8 });
    m.box(dx - 0.008, 0.392, 37.5, 0.016, 0.016, 2.5, { top: P.fireYellow, left: P.fireOrange, right: P.fireYellow });
  }
  return m;
}

/**
 * The Reeve's chair: a little higher-backed than a man needs, carved, cushioned in yellow, gilt finials.
 * Drawn in the middle of a two-tile footprint, so it sits square behind the middle of the great desk.
 */
function reeveChair(): IsoModel {
  const m = new IsoModel();
  const wood = { top: OAK_LIGHT, left: OAK, right: OAK_DARK };
  // Seat at SEAT_TOP, about a third of a tile square, centred; no arms: the sitter is drawn in front of the whole chair.
  const x0 = 0.83;
  const y0 = 0.33;
  const w = 0.34;
  for (const [x, y] of [[0, 0], [w - 0.05, 0], [0, w - 0.05], [w - 0.05, w - 0.05]]) m.box(x0 + x, y0 + y, 0, 0.05, 0.05, SEAT_TOP - 2.5, wood);
  m.box(x0, y0, SEAT_TOP - 2.5, w, w, 2.5, { top: YELLOW, left: OAK_LIGHT, right: OAK });
  // A back a little higher than most chairs', as befits a Reeve, gilt-knobbed.
  m.box(x0, y0 - 0.05, SEAT_TOP, w, 0.05, 16, { top: OAK_LIGHT, left: (u, v) => (v > 0.14 && v < 0.8 && u > 0.14 && u < 0.86 ? (Math.floor(u * 6 + v * 6) % 2 ? YELLOW : YELLOW_DARK) : OAK), right: OAK_DARK });
  for (const x of [0.02, w - 0.02]) m.cylinder(x0 + x, y0 - 0.025, SEAT_TOP + 16, 0.03, 2.5, () => GILT, GILT_LIGHT);
  return m;
}

/** A cabinet of curiosities: glass-fronted, a narwhal's horn that is a cow's, a mermaid's comb, a stone with a hole in it. */
function cabinet(): IsoModel {
  const m = new IsoModel();
  // Against the side wall: its glass front faces into the room (+x).
  const glassFront: Shader = (u, v) => {
      if (u < 0.06 || u > 0.94 || v < 0.04 || v > 0.96 || Math.abs(v - 0.5) < 0.02) return OAK_DARK;
      if (v < 0.5 && Math.abs(u - 0.5) < 0.04 && v > 0.08) return 0xe8e0c8; // the horn
      if (v > 0.55 && v < 0.62 && u > 0.2 && u < 0.7 && Math.floor(u * 30) % 2) return 0xd8d0c0; // the comb
      if (Math.hypot(u - 0.7, v - 0.8) < 0.08) return Math.hypot(u - 0.7, v - 0.8) < 0.03 ? 0x1a1414 : 0x7a7670; // the stone
      return (u + v * 0.4) % 0.4 < 0.04 ? GLASS_LIGHT : mixColor(GLASS, 0x2a2420, 0.6);
  };
  m.box(0.05, 0.1, 0, 0.55, 0.8, 58, { top: OAK_TOP, left: OAK, right: (u, v) => darken(glassFront(u, v) ?? OAK, 0.82) });
  m.box(0, 0.05, 58, 0.65, 0.9, 3, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  return m;
}

/** A little round table: a decanter of red wine, a glass, a dish of sugared almonds. */
function wineTable(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.05, 22, (u) => (u < 0.4 ? OAK_LIGHT : OAK_DARK), OAK);
  m.cylinder(0.5, 0.5, 0, 0.16, 2, () => OAK_DARK, OAK);
  m.cylinder(0.5, 0.5, 22, 0.3, 2.5, (u) => (u < 0.4 ? OAK_LIGHT : OAK_DARK), OAK_TOP);
  m.cylinder(0.42, 0.42, 24.5, 0.07, 9, (u, v) => (v < 0.3 ? GLASS_LIGHT : u < 0.3 ? 0xa83040 : 0x6a1020), GLASS_LIGHT);
  m.cylinder(0.42, 0.42, 33.5, 0.025, 4, () => GLASS_LIGHT, GLASS_LIGHT);
  m.cylinder(0.62, 0.45, 24.5, 0.035, 6, (u, v) => (v > 0.5 ? (u < 0.3 ? 0xa83040 : 0x6a1020) : GLASS_LIGHT), 0x8a1a2a);
  m.cylinder(0.55, 0.65, 24.5, 0.11, 1.5, () => SILVER, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.35 && hash(Math.floor(u * 9), Math.floor(v * 9)) < 0.6 ? 0xf0e8e0 : SILVER_LIGHT));
  return m;
}

/** A gilt birdcage on a stand, a goldfinch in it. */
function birdcage(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.03, 30, () => GILT_DARK, GILT);
  m.cylinder(0.5, 0.5, 0, 0.12, 1.5, () => GILT_DARK, GILT);
  m.cylinder(0.5, 0.5, 30, 0.15, 16, (u, v) => ((Math.floor(u * 14) % 2 === 0 || v > 0.92) ? (u < 0.4 ? GILT_LIGHT : GILT_DARK) : null) as number, GILT);
  // The goldfinch: red face, yellow bar on the wing.
  m.box(0.46, 0.48, 36, 0.08, 0.05, 4, { top: 0x8a6a42, left: (_u, v) => (v < 0.3 ? 0xc83a2a : v < 0.6 ? 0xe8c040 : 0x2a2420), right: 0x6a4a2a });
  return m;
}

/** The Reeve's bed: a four-poster hung with yellow damask, curtains drawn back at the foot, a heap of pillows and a fur coverlet. */
function bed(): IsoModel {
  const m = new IsoModel();
  const wood = { top: OAK_LIGHT, left: OAK, right: OAK_DARK };
  m.box(0.05, 0.05, 0, 1.9, 1.9, 12, { top: OAK, left: (u) => ((u * 6) % 1 < 0.06 ? OAK_DARK : OAK), right: OAK_DARK });
  m.box(0.1, 0.1, 12, 1.8, 1.8, 6, { top: (u, v) => (smoothNoise(u * 4, v * 4, 9) > 0.6 ? 0xe8e0d0 : 0xd8d0c0), left: 0xc8c0b0, right: 0xa8a090 });
  // The coverlet of fur, and the pillows.
  m.box(0.08, 0.7, 18, 1.84, 1.2, 4, { top: (u, v) => (smoothNoise(u * 30, v * 20, 3) > 0.5 ? 0x6a5a48 : 0x5a4a3a), left: 0x4a3a2e, right: 0x3a2e24 });
  for (const x of [0.3, 1.1]) m.box(x, 0.18, 18, 0.6, 0.4, 7, { top: 0xf0ece0, left: 0xd8d0c0, right: 0xb8b0a0 });
  m.box(0.6, 0.4, 25, 0.5, 0.3, 4, { top: YELLOW_LIGHT, left: YELLOW, right: YELLOW_DARK });
  // The posts, the tester and its curtains.
  for (const [x, y] of [[0.05, 0.05], [1.85, 0.05], [0.05, 1.85], [1.85, 1.85]]) m.box(x, y, 0, 0.1, 0.1, 96, wood);
  m.box(0, 0, 96, 2, 2, 6, { top: DAMASK, left: (u) => (Math.floor(u * 20) % 2 ? GILT : DAMASK_DARK), right: (u) => (Math.floor(u * 20) % 2 ? GILT_DARK : DAMASK_DARK) });
  const curtain = (dark: boolean): Shader => (u) => {
    const fold = Math.sin(u * 40);
    const c = fold > 0.4 ? DAMASK_LIGHT : fold < -0.4 ? DAMASK_DARK : DAMASK;
    return dark ? darken(c, 0.75) : c;
  };
  // Hangings at the head, and the curtains gathered at each post.
  m.quad({ x: 0.05, y: 0.06, z: 96 }, { x: 1.9, y: 0, z: 0 }, { x: 0, y: 0, z: -78 }, curtain(true));
  for (const [x, y] of [[0.15, 1.9], [1.7, 1.9]]) m.box(x, y - 0.05, 20, 0.18, 0.1, 76, { top: DAMASK, left: curtain(false), right: curtain(true) });
  m.quad({ x: 1.95, y: 0.15, z: 96 }, { x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: -76 }, curtain(true));
  return m;
}

/** The dressing table: a looking-glass on a stand, pomanders, powder, rouge, a comb, a stoppered scent bottle. */
function dresser(): IsoModel {
  const m = new IsoModel();
  m.box(0.05, 0.1, 0, 0.9, 0.6, 24, { top: OAK_TOP, left: (u, v) => (Math.abs(v - 0.3) < 0.05 && Math.abs(((u * 2) % 1) - 0.5) < 0.08 ? GILT : (u * 2) % 1 < 0.04 ? OAK_DARK : OAK), right: OAK_DARK });
  m.box(0.3, 0.15, 24, 0.4, 0.06, 26, { top: GILT, left: (u, v) => (u < 0.1 || u > 0.9 || v < 0.06 || v > 0.94 ? GILT : (u + v) % 0.4 < 0.05 ? SILVER_LIGHT : SILVER), right: GILT_DARK });
  for (const [x, y, c] of [[0.15, 0.4, 0x8a5a2a], [0.75, 0.45, 0xe8e0d8], [0.85, 0.35, 0xc83a4a]] as const) m.cylinder(x, y, 24, 0.05, 3, () => c, lighten(c, 0.2));
  m.cylinder(0.6, 0.5, 24, 0.035, 5, (u) => (u < 0.3 ? 0x8ae0a0 : 0x3a8a5a), 0x2a6a4a);
  m.box(0.25, 0.55, 24, 0.2, 0.05, 0.8, { top: 0x2a2024, left: 0x2a2024, right: 0x1a1418 });
  return m;
}

/** A tall clothes press, its doors carved with the scales. */
function press(): IsoModel {
  const m = new IsoModel();
  // Against the side wall: its doors face into the room (+x).
  const doors: Shader = (u, v) => {
      if (u < 0.05 || u > 0.95 || v < 0.03 || v > 0.97 || Math.abs(u - 0.5) < 0.02) return OAK_DARK;
      const s = scalesMark(((u * 2) % 1 - 0.2) / 0.6, (v - 0.2) / 0.3, OAK_LIGHT);
      if (s !== null) return s;
      return Math.abs(u - 0.45) < 0.02 && Math.abs(v - 0.5) < 0.03 ? GILT : OAK;
  };
  m.box(0.05, 0.1, 0, 0.6, 0.8, 76, { top: OAK_TOP, left: OAK_DARK, right: (u, v) => darken(doors(u, v) ?? OAK, 0.85) });
  m.box(0, 0.05, 76, 0.7, 0.9, 4, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  return m;
}

/** A copper bath on claw feet, a towel over its rim, a jug beside it. */
function bath(): IsoModel {
  const m = new IsoModel();
  const COPPER = 0xb86a3a;
  for (const [x, y] of [[0.25, 0.25], [1.75, 0.25], [0.25, 0.75], [1.75, 0.75]]) m.box(x - 0.04, y - 0.04, 0, 0.08, 0.08, 4, { top: BRASS, left: BRASS, right: BRASS_DARK });
  m.box(0.15, 0.15, 4, 1.7, 0.7, 16, {
    top: (u, v) => {
      if (u < 0.03 || u > 0.97 || v < 0.08 || v > 0.92) return lighten(COPPER, 0.35); // the rolled rim
      if (v < 0.36 || u < 0.08) return darken(COPPER, 0.55); // the inside of the far walls, in shadow
      if (u > 0.94 || v > 0.86) return darken(COPPER, 0.75);
      // Grey bathwater, gone cold, a scum of soap on it.
      return smoothNoise(u * 9, v * 5, 4) > 0.6 ? 0xb8b4a0 : 0x7a7a66;
    },
    left: (u, v) => (v < 0.1 ? lighten(COPPER, 0.25) : (u * 3 + v) % 1 < 0.08 ? lighten(COPPER, 0.3) : COPPER),
    right: darken(COPPER, 0.7),
  });
  // A slipper bath: its back end rises in a high roll, for the Reeve to lie back against.
  m.box(0.15, 0.15, 20, 0.26, 0.7, 8, {
    top: lighten(COPPER, 0.35),
    left: (u, v) => (v < 0.2 ? lighten(COPPER, 0.3) : (u * 3 + v) % 1 < 0.08 ? lighten(COPPER, 0.3) : COPPER),
    right: darken(COPPER, 0.7),
  });
  m.quad({ x: 1.2, y: 0.85, z: 20 }, { x: 0.3, y: 0, z: 0 }, { x: 0, y: 0.02, z: -12 }, (u, v) => ((u + v) % 0.2 < 0.05 ? 0xd8d0c0 : 0xf0ece0));
  // A jug of hot water by it, steaming once, cold now.
  m.cylinder(1.95, 0.6, 0, 0.07, 9, (u) => (u < 0.35 ? 0xe0d8c8 : 0xa8a090), 0x4a5248);
  return m;
}

/** A chamber pot. Gilt. */
function giltPot(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.14, 7, (u) => (u < 0.35 ? GILT_LIGHT : u > 0.7 ? GILT_DARK : GILT), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.35 ? 0x5a4a2a : GILT));
  return m;
}

/** A tall iron candlestand, a fat church candle on it (from the drowned church, perhaps). */
function candleStand(): IsoModel {
  const m = new IsoModel();
  for (const a of [0, 2.1, 4.2]) line(m, { x: 0.5, y: 0.5, z: 6 }, { x: 0.5 + Math.cos(a) * 0.15, y: 0.5 + Math.sin(a) * 0.15, z: 0 }, IRON, 0.02);
  m.cylinder(0.5, 0.5, 6, 0.025, 44, () => IRON, IRON_LIGHT);
  m.cylinder(0.5, 0.5, 50, 0.08, 1.5, () => IRON_LIGHT, IRON);
  m.cylinder(0.5, 0.5, 51.5, 0.06, 12, (u) => (u < 0.4 ? 0xf4ecd8 : 0xc8c0a8), 0xf4ecd8);
  m.box(0.49, 0.49, 63.5, 0.02, 0.02, 4, { top: P.fireYellow, left: P.fireOrange, right: P.fireYellow });
  return m;
}

// ======================================================================= registry

function put(scene: Phaser.Scene, key: string, model: IsoModel, outline = true): void {
  registerModel(scene, key, model.render(outline));
}

export function generateTollHouse(scene: Phaser.Scene): void {
  // Outside.
  put(scene, 'gh-tollhouse', tollHouse());
  put(scene, 'gh-tollbar', tollBar());
  put(scene, 'gh-tollboard', roadBoard());
  // The walls of the three rooms.
  const kinds: TollWallKind[] = [
    'plain', 'window', 'door', 'irondoor', 'shelf', 'tolls', 'portrait', 'proclaim', 'hanging', 'notice',
    'stone', 'slit', 'rack', 'panel', 'bigportrait', 'mirror', 'keyhook',
  ];
  for (const kind of kinds) {
    for (let i = 0; i < 2; i++) {
      tollWall(scene, 'back', kind, i);
      tollWall(scene, 'side', kind, i);
    }
  }
  put(scene, 'th-wall-corner', cornerPost('oak'));
  put(scene, 'th-wall-corner-stone', cornerPost('stone'));
  put(scene, 'th-wall-corner-panel', cornerPost('panel'));
  // The floors.
  for (let i = 0; i < 2; i++) put(scene, `th-mud-${i}`, decal(mudDecal(i * 5 + 2), 2), false);
  put(scene, 'th-waitline', decal(waitLine, 6), false);
  put(scene, 'th-straw', decal(strawDecal, 2), false);
  put(scene, 'th-stain', decal(stainDecal), false);
  put(scene, 'th-rug', decal(reeveRug, 3, 2), false);
  put(scene, 'th-furrug', decal(furRug, 2), false);
  // The toll office.
  for (let i = 0; i < 3; i++) put(scene, `th-counter-${i}`, counter(i));
  put(scene, 'th-counter-end', counterEnd());
  put(scene, 'th-grille', grille(false));
  put(scene, 'th-grille-stamp', grille(true));
  put(scene, 'th-flap', flap());
  put(scene, 'th-rail', rail());
  put(scene, 'th-ledgers', ledgers());
  put(scene, 'th-scales', scales());
  put(scene, 'th-desk', desk());
  put(scene, 'th-clerk-stool', highStool());
  put(scene, 'th-stool', stool());
  put(scene, 'th-tallysticks', tallySticks());
  put(scene, 'th-takings', takings());
  put(scene, 'th-cot', cot());
  put(scene, 'th-lantern-post', lanternPost());
  put(scene, 'th-bench', bench());
  put(scene, 'th-brazier', brazier());
  put(scene, 'th-dicebarrel', diceBarrel());
  put(scene, 'th-handcart', handcart());
  put(scene, 'th-hencrate', henCrate());
  put(scene, 'th-oilcask', oilCask());
  put(scene, 'th-seized', seized());
  put(scene, 'th-creels', creels());
  put(scene, 'th-boltcloth', boltCloth());
  put(scene, 'th-board', board(), false);
  // The strongroom.
  put(scene, 'th-moneychest', moneyChest());
  put(scene, 'th-coffer', coffer());
  put(scene, 'th-lectern', lectern());
  put(scene, 'th-coinsacks', coinSacks());
  put(scene, 'th-weapons', weapons());
  put(scene, 'th-candle-floor', floorCandle());
  // The Reeve's rooms.
  put(scene, 'th-bigdesk', bigDesk());
  put(scene, 'th-reeve-chair', reeveChair());
  put(scene, 'th-cabinet', cabinet());
  put(scene, 'th-winetable', wineTable());
  put(scene, 'th-birdcage', birdcage());
  put(scene, 'th-bed', bed());
  put(scene, 'th-dresser', dresser());
  put(scene, 'th-press', press());
  put(scene, 'th-bath', bath());
  put(scene, 'th-pot-gilt', giltPot());
  put(scene, 'th-candlestand', candleStand());
  generateTollFolk(scene);
}

