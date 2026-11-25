import Phaser from 'phaser';
import { block, chimney, line, rotSlate, rubbleStone, withOpenings } from './gloomhaven';
import { MODEL_ART, registerModel, WALL_HEIGHT } from './interior';
import { IsoModel, lipped, planks, Shader } from './IsoModel';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';
import { mixColor, smoothNoise } from './scorch';
import { generateGuildFolk } from './guildhall3d';

/**
 * The Guildhall of the Causeway Merchants, on Gloomhaven's Staithe (see
 * world/GloomhavenMap.ts and world/GuildHallMap.ts). Outside: a ground floor
 * of dressed stone with three round arches (warehouse doors, the great door,
 * a grille onto the undercroft), a close-studded timber hall over it with
 * tall lit windows, a slate roof with a bell-turret and a ship for a vane, a
 * hoist over the loading door in the gable, banners over the steps. Inside:
 * the meeting hall (oak wainscot, ochre limewash going green, the guild's
 * banners, a great painted map of the trade roads, the founder in oils, the
 * long table and its chairs, a fireplace carved with the guild's arms), the
 * counting room (the clerk's desk, ledgers to the ceiling, pigeonholes of
 * waybills, the route book on its chain) and the guildmaster's office. Once
 * the finest rooms in Gloomhaven, and kept up just enough to say so. The
 * people are drawn in guildhall3d.ts.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const darken = (c: number, f = 0.75) => mixColor(c, 0x000000, 1 - f);
const lighten = (c: number, f = 0.2) => mixColor(c, 0xffffff, f);

// Dressed stone, grey-brown and wet, the joints dark.
const ASHLAR = 0x6e6a62;
const ASHLAR_DARK = 0x4c4944;
const ASHLAR_LIGHT = 0x8a857a;
const JOINT = 0x3a3733;
const MOSS = 0x4e6430;
const SLIME = 0x3a4a2a;
// The hall's timbers: black oak; its limewash, ochre once, gone the colour of weak mustard and green at the foot.
const OAK = 0x2e241e;
const OAK_LIGHT = 0x4a3a2e;
const OAK_DARK = 0x1c1612;
const OCHRE = 0xa08a56;
const OCHRE_LIGHT = 0xb8a26a;
const OCHRE_DARK = 0x7a6840;
// Panelling and furniture: good brown oak, polished where hands go.
const WOOD = 0x5a3e28;
const WOOD_DARK = 0x3a2818;
const WOOD_LIGHT = 0x7a5838;
const WOOD_TOP = 0x6a4a30;
// The guild's colours: a deep blue gone grey, and gold.
/** The height of a seat's top, where a sitter's hips go (art/IsoModel.ts SEAT_TOP, from the seat-height fix). */
const SEAT = 9;

const BLUE = 0x2e3e5a;
const BLUE_DARK = 0x1e2a40;
const BLUE_LIGHT = 0x4a5e7e;
const GOLD = 0xc8a048;
const GOLD_DARK = 0x8a6a28;
const GOLD_LIGHT = 0xecca70;
const BRASS = 0xb08a3a;
const BRASS_DARK = 0x6e5422;
const BRASS_LIGHT = 0xe0c070;
const PARCHMENT = 0xd8c8a0;
const PARCHMENT_DARK = 0xb4a27a;
const INK = 0x2a2420;
const RED_INK = 0x9a1e1e;
const BAIZE = 0x2e4a34;
const BAIZE_DARK = 0x1e3424;
const IRON = 0x3a3a40;
const IRON_LIGHT = 0x5a5a64;
const LIT = 0xf0b45a;
const LIT_DEEP = 0xc06a2a;
const LIT_HOT = 0xffe0a0;
const GLASS = 0x5a6a70;
const GLASS_DARK = 0x3a464c;
const GLASS_LIGHT = 0x9aaab0;
const SLATE = 0x4a4c55;
const SOOT = 0x1c1618;
const WAX = 0xe8dcb8;

// ---------------------------------------------------------------- outside

/** Dressed stone in even courses, `rows` high and `cols` blocks across, weathered, mossy at the foot. */
function ashlar(rows: number, cols: number, seed: number): Shader {
  return (u, v) => {
    const row = Math.floor(v * rows);
    const lv = v * rows - row;
    const fu = u * cols + (row % 2) * 0.5;
    const col = Math.floor(fu);
    const lu = fu - col;
    if (lv < 0.08 || lu < 0.035) return smoothNoise(u * 12, v * 8, seed) < 0.3 && v > 0.6 ? MOSS : JOINT;
    const n = hash(col + seed, row);
    let c = n < 0.25 ? ASHLAR_DARK : n > 0.8 ? ASHLAR_LIGHT : ASHLAR;
    if (lv < 0.2) c = lighten(c, 0.07);
    if (lv > 0.85) c = darken(c, 0.85);
    // Weathering: pitting, and green streaks down from the joints.
    if (hash(Math.floor(u * 90), Math.floor(v * 60) + seed) < 0.05) c = darken(c, 0.8);
    if (hash(Math.floor(u * 40), seed + 3) < 0.12 && lv > 0.3) c = mixColor(c, SLIME, 0.35);
    if (v > 0.75) c = mixColor(c, SLIME, (v - 0.75) * 1.6);
    return c;
  };
}

/**
 * Close-studded timber over ochre limewash, `studs` posts across, a rail at
 * the middle and a brace at each end: what the hall's upper floor is built of,
 * the limewash flaking and green with damp under the eaves and the sills.
 */
function studding(studs: number, H: number, seed: number): Shader {
  return (u, v) => {
    const y = v * H;
    const su = (u * studs) % 1;
    if (y < 3 || y > H - 3) return y < 1.5 ? OAK_LIGHT : OAK;
    if (Math.abs(y - H * 0.55) < 1.6) return y < H * 0.55 - 0.6 ? OAK_LIGHT : OAK;
    if (su < 0.22) return su < 0.08 ? OAK_LIGHT : OAK;
    // Braces in the end bays.
    const bay = Math.floor(u * studs);
    if ((bay === 0 || bay === studs - 1) && y > H * 0.55) {
      const t = (y - H * 0.55) / (H * 0.45);
      const along = bay === 0 ? su : 1 - su;
      if (Math.abs(along - t) < 0.18) return OAK;
    }
    const n = smoothNoise(u * 18, v * 9, seed);
    let c = n > 0.64 ? OCHRE_LIGHT : n < 0.32 ? OCHRE_DARK : OCHRE;
    if (n > 0.8) return (Math.floor(u * 80) + Math.floor(y / 2)) % 2 ? 0x5a4632 : 0x463626; // flaked off to the wattle
    if (v < 0.3 && hash(Math.floor(u * 50), seed) < 0.25) c = mixColor(c, 0x2a241e, (0.3 - v) * 2);
    const damp = v - (0.78 - 0.08 * smoothNoise(u * 7, 3, seed));
    if (damp > 0) c = mixColor(c, SLIME, Math.min(0.7, damp * 3.5));
    return c;
  };
}

/** A round-headed arch opening, centred at `cu` across a wall `H` high and `w` (in u) wide, up to `top` px from the ground. */
interface Arch {
  cu: number;
  w: number;
  top: number;
  /** What's in it: the great door, shut planked warehouse doors, or an iron grille onto the dark undercroft. */
  fill: 'door' | 'planks' | 'grille';
}

/** Paints the arches over a wall: a ring of voussoirs round each, and what's in it. `span` is the wall's width in tiles. */
function withArches(wall: Shader, H: number, span: number, arches: Arch[]): Shader {
  return (u, v) => {
    const y = v * H;
    for (const a of arches) {
      const half = a.w / 2;
      const du = (u - a.cu) / half; // -1..1 across the opening
      const r = half * span * 32; // the arch's radius, in pixels
      const springY = H - a.top + r * 0.5; // where the curve starts (an arch of a little under a half circle)
      const inX = Math.abs(du) <= 1;
      const curveY = springY - Math.sqrt(Math.max(0, 1 - du * du)) * r * 0.5;
      const ring = 3.2;
      const ringOuter = Math.abs(du) <= 1 + ring / (half * span * 32);
      if (!ringOuter || y < curveY - ring - 0.5) continue;
      if (!inX || y < curveY) {
        // The voussoirs: wedges of paler stone round the head, and a keystone.
        if (y > springY + 1 && !inX) {
          if (y < H - 2 && Math.abs(Math.abs(du) - 1) * half * span * 32 < ring) return (Math.floor(y / 6) % 2 ? ASHLAR_LIGHT : ASHLAR);
          continue;
        }
        const ang = Math.atan2(y - springY, du * r);
        const wedge = Math.floor((ang + Math.PI) * 4.2);
        if (Math.abs(du) < 0.12 && y < curveY) return y < curveY - ring + 1 ? ASHLAR_LIGHT : lighten(ASHLAR_LIGHT, 0.08); // the keystone
        return wedge % 2 ? ASHLAR_LIGHT : mixColor(ASHLAR_LIGHT, ASHLAR, 0.5);
      }
      const dy = y - curveY;
      switch (a.fill) {
        case 'door': {
          // The great door: two leaves of oak, studded, iron rings, a lit fanlight in the arch head over them.
          if (y < springY + 2) {
            if (Math.abs(du) < 0.04 || Math.abs((Math.atan2(y - springY, du * r) + Math.PI) % 0.5) < 0.06) return OAK;
            return y < springY - r * 0.3 ? LIT_HOT : LIT;
          }
          if (Math.abs(du) < 0.03 || Math.abs(du) > 0.94 || y < springY + 4) return OAK_DARK;
          const leaf = du < 0 ? du + 0.5 : du - 0.5;
          if (Math.abs(leaf) < 0.06 && Math.abs(y - (springY + 18)) < 1.2) return BRASS_LIGHT;
          if (Math.abs(y - (springY + 10)) < 0.9 || Math.abs(y - (H - 6)) < 0.9) return IRON;
          if (Math.floor(y) % 7 === 0 && Math.floor((du + 1) * 12) % 3 === 0) return IRON_LIGHT; // studs
          const plank = Math.floor((du + 1) * 6);
          const c = plank % 2 ? WOOD_DARK : WOOD;
          return y > H - 6 ? mixColor(c, SLIME, 0.5) : c;
        }
        case 'planks': {
          // Warehouse doors: rough planks, barred across with a beam, a padlock on its hasp.
          if (y < springY + 1) return 0x16120e;
          if (Math.abs(y - (springY + 14)) < 2.2) return y < springY + 13 ? 0x6a5a44 : 0x4a3e2e;
          if (Math.abs(du) < 0.06 && Math.abs(y - (springY + 18)) < 2) return IRON_LIGHT;
          const plank = Math.floor((du + 1) * 5);
          let c = plank % 2 ? 0x4a3a2a : 0x5a4632;
          if (hash(plank, Math.floor(y / 3)) < 0.06) c = darken(c, 0.7);
          return y > H - 5 ? mixColor(c, SLIME, 0.6) : c;
        }
        default: {
          // An iron grille; through it, the undercroft's dark and the shapes of sacks and barrels.
          if (Math.floor((du + 1) * 7) % 2 === 0 && (du + 1) * 7 % 1 < 0.35) return IRON;
          if (Math.abs(dy % 9) < 0.8) return IRON;
          if (y > H - 14 && Math.hypot((du + 0.4) * 3, (y - (H - 6)) / 7) < 1) return 0x2a241c;
          if (y > H - 12 && Math.hypot((du - 0.35) * 3, (y - (H - 5)) / 6) < 1) return 0x241e18;
          return 0x0e0c0a;
        }
      }
    }
    return wall(u, v);
  };
}

/** A tall mullioned window of leaded panes in the hall's upper floor: lit, two lights and a transom, the frame black oak. */
function hallWindows(wall: Shader, H: number, at: number[], w: number, y0: number, y1: number, dim = 1): Shader {
  return (u, v) => {
    const y = v * H;
    for (const c of at) {
      if (Math.abs(u - c) > w / 2 + 0.01 || y < y0 - 1 || y > y1 + 2) continue;
      const iu = (u - (c - w / 2)) / w;
      const iv = (y - y0) / (y1 - y0);
      if (y > y1) return y < y1 + 1 ? OAK_LIGHT : 0x5a4e40; // the sill
      if (iu < 0 || iu > 1 || iv < 0) return OAK;
      if (iu < 0.1 || iu > 0.9 || iv < 0.06 || iv > 0.94 || Math.abs(iu - 0.5) < 0.06 || Math.abs(iv - 0.32) < 0.04) return OAK;
      // Leaded diamonds, warm with the candles inside, brighter at the top.
      const du = (iu * 9 + iv * 14) % 1;
      const dv = (iu * 9 - iv * 14 + 40) % 1;
      if (du < 0.1 || dv < 0.1) return darken(0x3a3430, dim);
      const glow = iv < 0.3 ? LIT_HOT : iv < 0.7 ? LIT : LIT_DEEP;
      return darken(hash(Math.floor(iu * 9), Math.floor(iv * 14)) < 0.1 ? LIT_DEEP : glow, dim);
    }
    return wall(u, v);
  };
}

/** A faded banner of the guild on a pole, hanging down: deep blue gone grey, a gold ship on it, the hem ragged and moth-holed. */
function banner(m: IsoModel, x: number, y: number, z: number, len: number, seed: number): void {
  line(m, { x, y, z }, { x, y: y + 0.9, z: z + 6 }, IRON, 0.025);
  m.quad({ x, y: y + 0.55, z: z + 4 }, { x: 0, y: 0.32, z: 2 }, { x: 0, y: 0, z: -len }, (u, v) => {
    // The swallow-tail at the foot.
    if (v > 0.84 && Math.abs(u - 0.5) < (v - 0.84) * 2.2) return null;
    if (hash(Math.floor(u * 14), Math.floor(v * 20) + seed) < 0.03) return null;
    if (u < 0.08 || u > 0.92) return GOLD_DARK;
    // The ship: a hull, a mast, a square sail.
    const cu = u - 0.5;
    if (v > 0.44 && v < 0.5 && Math.abs(cu) < 0.3 - (v - 0.44) * 2) return GOLD;
    if (Math.abs(cu) < 0.025 && v > 0.18 && v < 0.45) return GOLD_DARK;
    if (v > 0.22 && v < 0.4 && Math.abs(cu) < 0.2 - (v - 0.22) * 0.3) return (v + u) % 0.12 < 0.02 ? GOLD_DARK : GOLD_LIGHT;
    const fade = smoothNoise(u * 4, v * 6, seed) * 0.5;
    const c = Math.sin(v * 30 + seed) > 0.85 ? BLUE_DARK : BLUE;
    return mixColor(c, 0x7a7a74, fade * 0.6);
  });
}

/**
 * The Guildhall (8 x 5): a stone ground floor with three arches across its
 * front and a loading door on the side, a jettied timber hall above with five
 * tall windows, a steep slate roof with a bell-turret on the ridge and a ship
 * for a vane, a gable over the east end with a hoist beam and its tackle, a
 * carved panel of the guild's arms over the great door, lanterns, banners and
 * steps. Its front faces +y.
 */
function guildHall(): IsoModel {
  const m = new IsoModel();
  const x0 = 0.2;
  const y0 = 0.25;
  const W = 7.6;
  const D = 4.4;
  const foot = 6;
  const H1 = 46;
  const H2 = 50;
  const jet = 0.22;
  const R = 66;
  const top = foot + H1 + H2;
  const ridgeY = y0 + D / 2;
  const o = 0.3;
  const roof = rotSlate(131);

  // ---- The back slope and the chimney through it.
  m.quad({ x: x0 - o - jet, y: ridgeY, z: top + R }, { x: W + o * 2 + jet * 2, y: 0, z: 0 }, { x: 0, y: -D / 2 - o - jet, z: -R - 8 }, roof);
  chimney(m, x0 + 6.2, y0 + 1.0, foot, H1 + H2 + R + 26, 0.04, 0.62);

  // ---- The plinth and the ground floor of dressed stone.
  m.box(x0 - 0.05, y0 - 0.05, 0, W + 0.1, D + 0.1, foot, { top: ASHLAR_LIGHT, left: rubbleStone(141, 6, 1, 0.5), right: (u, v) => darken(rubbleStone(143, 4, 1, 0.5)(u, v) ?? ASHLAR, 0.72) });
  const front = withArches(ashlar(7, 16, 151), H1, W, [
    { cu: 0.17, w: 0.17, top: 38, fill: 'planks' },
    { cu: 0.5, w: 0.19, top: 42, fill: 'door' },
    { cu: 0.83, w: 0.17, top: 38, fill: 'grille' },
  ]);
  // A carved panel over the great door: the ship, the mule and the scales, the gilt mostly gone.
  const arms: Shader = (u, v) => {
    const y = v * H1;
    if (Math.abs(u - 0.5) < 0.065 && y > 0.5 && y < 7.5) {
      const au = (u - 0.435) / 0.13;
      const av = (y - 0.5) / 7;
      if (au < 0.06 || au > 0.94 || av < 0.1 || av > 0.9) return ASHLAR_LIGHT;
      if (Math.abs(au - 0.5) < 0.04 && av < 0.8) return GOLD_DARK; // the scales' post
      if (Math.abs(av - 0.3) < 0.08 && Math.abs(au - 0.5) < 0.22) return GOLD;
      if (av > 0.45 && av < 0.75 && (Math.abs(au - 0.27) < 0.08 || Math.abs(au - 0.73) < 0.08)) return hash(Math.floor(au * 20), 3) < 0.5 ? GOLD : ASHLAR_DARK;
      return ASHLAR_DARK;
    }
    return front(u, v);
  };
  m.quad({ x: x0, y: y0 + D, z: foot + H1 }, { x: W, y: 0, z: 0 }, { x: 0, y: 0, z: -H1 }, arms);
  // The side (+x): stone, a barred window, and the loading door under the hoist.
  const side = withArches(ashlar(7, 9, 153), H1, D, [{ cu: 0.62, w: 0.26, top: 40, fill: 'planks' }]);
  const sideWin = withOpenings(side, H1, [{ u0: 0.14, u1: 0.3, y0: 12, y1: 26, pane: 'barred' }]);
  m.quad({ x: x0 + W, y: y0, z: foot + H1 }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: -H1 }, (u, v) => darken(sideWin(u, v) ?? ASHLAR, 0.72));
  // A string course along the top of the stone, under the jetty.
  m.box(x0 - 0.04, y0 + D - 0.02, foot + H1 - 3, W + 0.08, 0.08, 3, { top: ASHLAR_LIGHT, left: ASHLAR_LIGHT, right: ASHLAR });
  m.box(x0 + W - 0.02, y0 - 0.04, foot + H1 - 3, 0.08, D + 0.08, 3, { top: ASHLAR_LIGHT, left: ASHLAR, right: ASHLAR_DARK });
  // The steps up to the great door, worn hollow.
  for (let i = 0; i < 3; i++) {
    m.box(x0 + W / 2 - 0.85 + i * 0.1, y0 + D + 0.5 - i * 0.22, 0, 1.7 - i * 0.2, 0.26, 2 + i * 2.2, {
      top: (u, v) => (Math.abs(u - 0.5) < 0.25 && v > 0.3 ? ASHLAR : ASHLAR_LIGHT),
      left: ASHLAR,
      right: ASHLAR_DARK,
    });
  }
  // A mooring ring and a mounting block by the steps.
  m.box(x0 + W / 2 + 1.1, y0 + D + 0.05, 0, 0.4, 0.4, 6, { top: ASHLAR_LIGHT, left: ASHLAR, right: ASHLAR_DARK });

  // ---- The jettied hall, close-studded, five tall windows on the front and two on the side.
  const ux = x0 - jet;
  const uw = W + jet * 2;
  const uy = y0 - jet;
  const ud = D + jet * 2;
  const zf = foot + H1;
  for (let i = 0; i < 20; i++) block(m, ux + 0.2 + i * (uw - 0.4) / 19, y0 + D, zf - 3, 0.1, jet, 3, OAK_LIGHT, OAK);
  for (let i = 0; i < 12; i++) block(m, x0 + W, uy + 0.3 + i * (ud - 0.6) / 11, zf - 3, jet, 0.1, 3, OAK_LIGHT, OAK);
  const upperFront = hallWindows(studding(26, H2, 161), H2, [0.1, 0.3, 0.5, 0.7, 0.9], 0.1, 8, 40);
  const upperSide = hallWindows(studding(15, H2, 163), H2, [0.25, 0.75], 0.17, 8, 40, 0.8);
  m.quad({ x: ux + uw, y: uy, z: top }, { x: 0, y: ud, z: 0 }, { x: 0, y: 0, z: -H2 }, (u, v) => darken(upperSide(u, v) ?? OCHRE, 0.74));
  m.quad({ x: ux, y: uy + ud, z: top }, { x: uw, y: 0, z: 0 }, { x: 0, y: 0, z: -H2 }, upperFront);
  // The bressumer along the jetty's foot, carved with a running vine.
  m.box(ux, uy + ud - 0.08, zf, uw, 0.1, 4, {
    top: OAK_LIGHT,
    left: (u, v) => (Math.abs(v - 0.5 - Math.sin(u * 60) * 0.3) < 0.15 ? OAK_LIGHT : OAK),
    right: OAK,
  });
  m.box(ux + uw - 0.08, uy, zf, 0.1, ud, 4, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  // Lanterns either side of the door, on iron arms.
  for (const dx of [-1.2, 1.2]) {
    const lx = x0 + W / 2 + dx;
    m.box(lx, y0 + D, foot + 34, 0.04, 0.2, 1.5, { top: IRON, left: IRON, right: IRON });
    m.box(lx - 0.06, y0 + D + 0.12, foot + 24, 0.14, 0.14, 9, {
      top: IRON,
      left: (u, v) => (u < 0.2 || u > 0.8 || v < 0.12 || v > 0.88 ? IRON : v < 0.4 ? LIT_HOT : LIT),
      right: (u, v) => (u < 0.2 || u > 0.8 || v < 0.12 || v > 0.88 ? IRON : LIT_DEEP),
    });
  }
  // Two banners on poles out over the steps.
  banner(m, x0 + W / 2 - 0.9, y0 + D + jet, zf + 30, 30, 3);
  banner(m, x0 + W / 2 + 0.9, y0 + D + jet, zf + 30, 30, 7);

  // ---- The gable over the east end, and the hoist beam out of it with its block, rope and a bale on the hook.
  m.quad({ x: ux + uw, y: uy, z: top }, { x: 0, y: ud, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => {
    const half = Math.abs(u - 0.5) * 2;
    if (v > 1 - half) return null;
    // The loading door in the gable, its two leaves shut.
    if (Math.abs(u - 0.5) < 0.09 && v < 0.42 && v > 0.04) return Math.abs(u - 0.5) < 0.008 ? OAK_DARK : (Math.floor(u * 60) % 2 ? WOOD_DARK : WOOD);
    if (Math.abs(u - 0.5) < 0.1 && v < 0.45) return OAK;
    return darken(studding(9, R, 165)(u, 1 - v) ?? OCHRE, 0.7);
  });
  const hx = ux + uw;
  const hy = uy + ud / 2;
  const hz = top + R * 0.5;
  block(m, hx - 0.1, hy - 0.06, hz, 1.1, 0.12, 4, OAK_LIGHT, OAK);
  line(m, { x: hx + 0.3, y: hy, z: hz - 8 }, { x: hx, y: hy, z: hz - 1 }, OAK, 0.05);
  m.cylinder(hx + 0.88, hy, hz - 5, 0.07, 5, () => WOOD_DARK, WOOD);
  line(m, { x: hx + 0.86, y: hy, z: hz - 5 }, { x: hx + 0.86, y: hy, z: 20 }, 0x8a764e, 0.012);
  line(m, { x: hx + 0.95, y: hy, z: hz - 5 }, { x: hx + 0.95, y: hy + 0.2, z: 6 }, 0x7a6644, 0.012);
  m.box(hx + 0.72, hy - 0.16, 8, 0.32, 0.32, 12, {
    top: (u, v) => (Math.abs(u - 0.5) < 0.06 || Math.abs(v - 0.5) < 0.06 ? 0x5a4a32 : 0xc8bc9c),
    left: (_u, v) => (Math.abs(v - 0.5) < 0.08 ? 0x5a4a32 : 0xb8ac8c),
    right: (_u, v) => (Math.abs(v - 0.5) < 0.08 ? 0x4a3e2a : 0x968a6c),
  });

  // ---- The front slope, the ridge, and the bell-turret on it.
  m.quad({ x: ux - o, y: ridgeY, z: top + R }, { x: uw + o * 2, y: 0, z: 0 }, { x: 0, y: ud / 2 + o, z: -R - 8 }, roof);
  m.quad({ x: ux + uw + o, y: ridgeY, z: top + R + 1 }, { x: 0, y: ud / 2 + o, z: -R - 8 }, { x: 0.06, y: 0, z: -3 }, OAK);
  m.box(ux - o, ridgeY - 0.08, top + R - 2, uw + o * 2, 0.16, 4, { top: lighten(SLATE, 0.1), left: darken(SLATE, 0.7), right: darken(SLATE, 0.55) });
  // Two dormers through the front of the roof.
  for (const at of [0.22, 0.78]) {
    const dx = ux + uw * at - 0.4;
    const dy = ridgeY + 1.0;
    const dz = top + R * 0.36;
    m.box(dx, dy, dz - 6, 0.8, 1.1, 22, {
      top: SLATE,
      left: (u, v) => (u < 0.2 || u > 0.8 || v < 0.22 || v > 0.86 ? OAK : Math.abs(u - 0.5) < 0.05 || Math.abs(v - 0.5) < 0.05 ? OAK : v < 0.45 ? LIT : LIT_DEEP),
      right: darken(OCHRE, 0.7),
    });
    m.quad({ x: dx - 0.08, y: dy + 0.55, z: dz + 24 }, { x: 0.48, y: 0, z: 0 }, { x: 0, y: 0.7, z: -9 }, rotSlate(171));
    m.quad({ x: dx + 0.4, y: dy + 0.55, z: dz + 24 }, { x: 0.48, y: 0, z: -9 }, { x: 0, y: 0.7, z: 0 }, (u, v) => darken(rotSlate(173)(u, v) ?? SLATE, 0.75));
  }
  // The turret: a square timber lantern with louvres, the bell glinting inside, a lead cap, and the ship vane.
  const tx = x0 + W / 2 - 0.4;
  const ty = ridgeY - 0.4;
  const tz = top + R - 6;
  const louvre: Shader = (u, v) => {
    if (u < 0.12 || u > 0.88 || v < 0.1) return OAK;
    if (v > 0.35 && v < 0.75 && Math.abs(u - 0.5) < 0.22 && Math.hypot((u - 0.5) * 2, v - 0.6) < 0.4) return v < 0.5 ? BRASS_LIGHT : BRASS; // the bell
    return Math.floor(v * 8) % 2 ? OAK_DARK : 0x0e0c0a;
  };
  m.box(tx, ty, tz, 0.8, 0.8, 26, { top: OAK, left: louvre, right: (u, v) => darken(louvre(u, v) ?? OAK, 0.72) });
  m.box(tx - 0.08, ty - 0.08, tz + 26, 0.96, 0.96, 3, { top: 0x6a6e74, left: 0x5a5e64, right: 0x3e4246 });
  m.cylinder(tx + 0.4, ty + 0.4, tz + 29, 0.3, 4, (u) => (u < 0.4 ? 0x7a7e84 : 0x4a4e54), 0x6a6e74);
  m.cylinder(tx + 0.4, ty + 0.4, tz + 33, 0.18, 4, (u) => (u < 0.4 ? 0x7a7e84 : 0x4a4e54), 0x6a6e74);
  m.box(tx + 0.38, ty + 0.38, tz + 37, 0.04, 0.04, 16, { top: IRON, left: IRON, right: IRON });
  // The vane: a little ship, gilt gone green, pointing off down the river.
  m.quad({ x: tx + 0.2, y: ty + 0.4, z: tz + 50 }, { x: 0.5, y: 0, z: 0 }, { x: 0, y: 0, z: -7 }, (u, v) => {
    if (v > 0.6) return Math.abs(u - 0.5) < 0.45 - (v - 0.6) * 0.6 ? 0x6a8a5a : null;
    if (Math.abs(u - 0.4) < 0.03) return 0x4a6a3a;
    return v > 0.1 && Math.abs(u - 0.4) < 0.26 - v * 0.15 ? 0x8aa274 : null;
  });

  // ---- The sign: a board on an iron arm at the west corner, the scales on it.
  const sx = ux + 0.2;
  const sy = uy + ud;
  m.box(sx, sy, top - 6, 0.05, 1.1, 2, { top: IRON_LIGHT, left: IRON, right: IRON });
  m.quad({ x: sx, y: sy, z: top - 18 }, { x: 0, y: 0.5, z: 0 }, { x: 0, y: 0, z: 12 }, (u, v) => (Math.abs(v - u) < 0.12 ? IRON : null));
  for (const dy of [0.35, 0.95]) m.box(sx, sy + dy, top - 10, 0.02, 0.02, 4, { top: IRON, left: IRON, right: IRON });
  m.quad({ x: sx, y: sy + 0.25, z: top - 10 }, { x: 0, y: 0.8, z: 0 }, { x: 0, y: 0, z: -24 }, (u, v) => {
    if (u < 0.06 || u > 0.94 || v < 0.06 || v > 0.94) return OAK;
    if (u < 0.1 || u > 0.9 || v < 0.1 || v > 0.9) return GOLD_DARK;
    const cu = u - 0.5;
    if (Math.abs(cu) < 0.03 && v > 0.22 && v < 0.8) return GOLD;
    if (Math.abs(v - 0.28) < 0.03 && Math.abs(cu) < 0.3) return GOLD;
    for (const s of [-1, 1]) {
      const pu = cu - s * 0.28;
      if (Math.abs(pu) < 0.12 && v > 0.5 && v < 0.56 + (0.12 - Math.abs(pu)) * 0.6) return GOLD_LIGHT;
      if (Math.abs(pu + (v - 0.28) * 0.35 * -s) < 0.015 && v > 0.28 && v < 0.52) return GOLD_DARK;
    }
    return BLUE_DARK;
  });
  // A water butt by the loading door, and a stack of empty crates.
  m.cylinder(x0 + W + 0.3, y0 + 0.6, 0, 0.24, 16, (u, v) => (v < 0.08 || Math.abs(v - 0.55) < 0.05 || v > 0.92 ? IRON : Math.floor(u * 10) % 2 ? WOOD : WOOD_DARK), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.38 ? 0x1a2228 : WOOD));
  return m;
}

// ---------------------------------------------------------------- inside: the walls

export type GuildWallKind =
  | 'plain' | 'window' | 'door' | 'banner' | 'map0' | 'map1' | 'map2' | 'portrait' | 'shelf' | 'charter' | 'holes' | 'brace';
const WALL_KINDS: GuildWallKind[] = ['plain', 'window', 'door', 'banner', 'map0', 'map1', 'map2', 'portrait', 'shelf', 'charter', 'holes', 'brace'];

/** Where the wainscot's dado rail runs, in pixels down the wall. */
const DADO = 50;

/** Oak panelling below the dado: fielded panels, a rail and a skirting, scuffed by chair-backs and boots. */
function wainscot(x: number, y: number, seed: number): number {
  if (y > WALL_HEIGHT - 5) return y > WALL_HEIGHT - 2 ? WOOD_DARK : WOOD; // the skirting
  if (y < DADO + 3) return y < DADO + 1 ? WOOD_LIGHT : WOOD_DARK; // the dado rail
  const px = x % 16;
  const py = y - (DADO + 3);
  if (px < 2 || px > 14 || py < 2 || py > WALL_HEIGHT - DADO - 10) return px < 1 ? WOOD_LIGHT : WOOD_DARK; // the stiles and rails
  // The fielded panel: a bevel, then the flat.
  if (px < 3.5 || py < 3.5) return WOOD_LIGHT;
  if (px > 12.5 || py > WALL_HEIGHT - DADO - 11.5) return WOOD_DARK;
  let c = Math.sin(x * 0.7 + Math.sin(y * 0.2 + seed) * 2) > 0.8 ? WOOD_DARK : WOOD;
  if (py < 8 && hash(Math.floor(x / 3), seed) < 0.3) c = WOOD_LIGHT; // rubbed by chair-backs
  // Damp working up from the floor.
  if (y > WALL_HEIGHT - 12 && smoothNoise(x / 4, y / 3, seed) > 0.6) c = mixColor(c, SLIME, 0.4);
  return c;
}

/** The limewash above the dado: ochre gone pale, a stencilled border of diamonds near the top, soot and damp. */
function limewash(x: number, y: number, seed: number): number {
  const n = smoothNoise(x / 10 + seed * 2.3, y / 12, seed);
  let c = n > 0.62 ? OCHRE_LIGHT : n < 0.34 ? OCHRE_DARK : OCHRE;
  // The stencil: a running band of blue diamonds and gold dots, half gone.
  if (y > 10 && y < 16) {
    const dx = Math.abs(((x + 4) % 8) - 4);
    const dy = Math.abs(y - 13);
    if (dx + dy * 1.3 < 3 && smoothNoise(x / 5, 2, seed + 7) > 0.3) c = dx + dy < 1.4 ? GOLD_DARK : BLUE_LIGHT;
  }
  // Damp blooming down from a leak, and green mould low on the plaster.
  const bloom = smoothNoise(x / 7 + 30, y / 9, seed + 3);
  if (bloom > 0.72) c = mixColor(c, 0x6a6a4a, 0.5);
  if (y > DADO - 10 && smoothNoise(x / 4, y / 4, seed + 9) > 0.7) c = mixColor(c, SLIME, 0.45);
  // Soot from the candles under the cornice.
  const soot = Math.max(0, 1 - y / 22) * 0.55;
  if (soot > 0) c = mixColor(c, SOOT, soot * (0.5 + smoothNoise(x / 6, y / 4, seed + 2) * 0.5));
  if (hash(Math.floor(x), Math.floor(y) + seed * 91) < 0.02) c = darken(c, 0.85);
  return c;
}

/** A gilt frame's pixel round a picture at (x0..x1, y0..y1), or null inside it. */
function gilt(x: number, y: number, x0: number, x1: number, y0: number, y1: number): number | null {
  if (x < x0 || x > x1 || y < y0 || y > y1) return null;
  const e = Math.min(x - x0, x1 - x, y - y0, y1 - y);
  if (e < 1) return GOLD_DARK;
  if (e < 2) return (Math.floor(x + y) % 3 ? GOLD : GOLD_LIGHT);
  if (e < 3) return GOLD_DARK;
  return null;
}

/**
 * The great painted map of the trade roads, over three segments of the hall's
 * back wall (`part` 0..2, west to east): Gloomhaven on its mudbank at the
 * left, the river, the fen, the causeway north to the Saltway and on east to
 * Hallowmarket, the inns along the way, and three red crosses on the causeway
 * where the caravans were taken, someone's pins stuck in beside them.
 */
function mapPaint(part: number, x: number, y: number): number | null {
  const gx = part * 32 + x; // 0..96 across the whole map
  const top = 12;
  const bottom = 46;
  if (gx < 3 || gx > 93 || y < top || y > bottom) return null;
  const frame = gilt(gx, y, 3, 93, top, bottom);
  if (frame !== null) return frame;
  const u = (gx - 6) / 84;
  const v = (y - top - 3) / (bottom - top - 6);
  // Parchment, darkened at the edges and spotted with damp.
  let c = smoothNoise(u * 8, v * 6, 13) > 0.7 ? PARCHMENT_DARK : PARCHMENT;
  if (Math.min(u, 1 - u, v, 1 - v) < 0.05) c = mixColor(c, 0x8a7a54, 0.5);
  if (smoothNoise(u * 14, v * 10, 17) > 0.82) c = mixColor(c, 0x6a6a4a, 0.5);
  // The fen: green stipple over the lower middle.
  const fen = v > 0.25 && u > 0.1 && u < 0.7;
  if (fen && hash(Math.floor(gx), Math.floor(y)) < 0.18) c = 0x6a7a4a;
  // The river along the bottom, winding.
  const rv = 0.86 + Math.sin(u * 9) * 0.06;
  if (Math.abs(v - rv) < 0.05) return 0x4a6a7a;
  // The road: a dashed brown line up out of Gloomhaven over the causeway, then east.
  const roadV = u < 0.45 ? 0.8 - (u / 0.45) * 0.55 : 0.25 - Math.sin((u - 0.45) * 6) * 0.06;
  const onRoad = Math.abs(v - roadV) < 0.03 && Math.floor(gx / 2) % 2 === 0;
  if (onRoad) return 0x6a4a2a;
  // Gloomhaven: a little cluster of black squares on the bank.
  if (u < 0.1 && v > 0.72 && v < 0.84 && (Math.floor(gx) + Math.floor(y)) % 2 === 0) return INK;
  // Towns along the road: Saltway, and Hallowmarket at the far end.
  for (const [tu, tv] of [[0.47, 0.24], [0.94, 0.3]] as const) if (Math.abs(u - tu) < 0.025 && Math.abs(v - tv) < 0.07) return INK;
  // The three red crosses on the causeway, and the pins.
  for (const t of [0.17, 0.25, 0.33]) {
    const cu = t;
    const cv = 0.8 - (t / 0.45) * 0.55;
    const du = (u - cu) * 84;
    const dv = (v - cv) * 28;
    if (Math.abs(Math.abs(du) - Math.abs(dv)) < 0.7 && Math.abs(du) < 2.2) return RED_INK;
    if (Math.abs(du - 1.5) < 0.6 && dv < -1 && dv > -4) return dv < -3.2 ? 0xd83a2a : IRON_LIGHT;
  }
  // A compass rose in the top right corner.
  if (Math.hypot((u - 0.9) * 84, (v - 0.75) * 28) < 3 && (Math.floor(gx) + Math.floor(y)) % 2) return 0x8a6a3a;
  // A cartouche with the guild's ship, top left.
  if (u > 0.04 && u < 0.18 && v > 0.04 && v < 0.2) return Math.abs(v - 0.12) < 0.02 ? INK : mixColor(c, GOLD, 0.25);
  return c;
}

/** The founder (index 0) or his lady (index 1), in oils, in a heavy gilt frame, dark with candle smoke. */
function portraitPaint(index: number, x: number, y: number): number | null {
  const frame = gilt(x, y, 6, 26, 10, 44);
  if (frame !== null) return frame;
  if (x < 6 || x > 26 || y < 10 || y > 44) return null;
  const cx = 16;
  const lady = index % 2 === 1;
  // A dark ground, varnish gone brown.
  let c = mixColor(0x2a2018, 0x4a3828, Math.max(0, 1 - Math.hypot(x - cx, y - 22) / 14));
  // Shoulders in black (his) or a deep red gown (hers), a white ruff at the throat.
  if (y > 32 && Math.abs(x - cx) < 9 - (44 - y) * 0.25) c = lady ? 0x5a1a1e : 0x1e1a1a;
  if (y > 29 && y < 33 && Math.abs(x - cx) < 5) c = (Math.floor(x) % 2 ? 0xe8e0d0 : 0xc8c0b0);
  // The face.
  if (Math.hypot((x - cx) / 3.6, (y - 24) / 4.6) < 1) {
    c = 0xc89a78;
    if (Math.abs(y - 23) < 0.6 && Math.abs(Math.abs(x - cx) - 1.6) < 0.6) c = 0x2a1a14;
    if (!lady && y > 25.5) c = 0x5a4a3a; // his beard
  }
  // His fur hat; her coif.
  if (Math.hypot((x - cx) / 5, (y - 18.5) / 2.8) < 1 && y < 21) c = lady ? 0xd8d0c0 : 0x4a3a2a;
  // A ledger in his hands; a rose in hers.
  if (!lady && y > 38 && y < 42 && Math.abs(x - cx + 3) < 3) c = 0x6a2a1a;
  if (lady && Math.hypot(x - cx - 3, y - 39) < 1.5) c = 0x8a2a2a;
  // A brass plate on the frame's foot.
  if (y > 41 && y < 44 && Math.abs(x - cx) < 4) c = BRASS;
  return c;
}

function guildWallShader(kind: GuildWallKind, side: 'back' | 'side', index: number): Shader {
  const seed = index * 17 + (side === 'back' ? 5 : 9) + kind.length * 3;
  return (u, v) => {
    const x = u * 32;
    const y = v * WALL_HEIGHT;
    // The cornice at the top, a moulded beam.
    if (y < 6) return y < 2 ? OAK_LIGHT : y < 4 ? OAK : OAK_DARK;
    // A post at every other segment.
    if (index % 2 === 0 && x < 3.5 && !kind.startsWith('map')) return x < 1.2 ? OAK_LIGHT : OAK;

    switch (kind) {
      case 'window':
        // A tall round-headed window, its leaded panes grey with the day outside and rain on the glass.
        if (x > 7 && x < 26 && y > 10 && y < 52) {
          const headY = 18 - Math.sqrt(Math.max(0, 1 - ((x - 16.5) / 9.5) ** 2)) * 8;
          if (y < headY) break;
          if (x < 9 || x > 24 || y < headY + 2 || y > 49) return y > 49 ? (y < 50 ? WOOD_LIGHT : WOOD_DARK) : 0x5a564e; // the stone reveal and the sill
          if (Math.abs(x - 16.5) < 0.7 || Math.abs(y - 32) < 0.7) return OAK;
          const lu = (x - 9 + (y - 18)) % 4.5;
          const lv = (x - 9 - (y - 18) + 90) % 4.5;
          if (lu < 0.5 || lv < 0.5) return 0x3a3a3e;
          if (hash(Math.floor(x), Math.floor((y + x * 3) / 3)) < 0.1) return GLASS_LIGHT;
          const n = smoothNoise(x / 3, y / 3, seed);
          return n > 0.7 ? mixColor(GLASS, GLASS_LIGHT, 0.4) : n < 0.35 ? GLASS_DARK : GLASS;
        }
        break;
      case 'door':
        // A panelled oak door under a moulded lintel, a brass handle and a keyhole.
        if (x > 6 && x < 27 && y > 14) {
          if (y < 18) return y < 16 ? WOOD_LIGHT : OAK;
          if (x < 8 || x > 25) return OAK;
          const pu = x - 8;
          const pv = y - 18;
          const inPanel = (pu > 2 && pu < 7.5) || (pu > 9.5 && pu < 15);
          const panelRow = (pv > 3 && pv < 28) || (pv > 32 && pv < WALL_HEIGHT - 22);
          if (Math.abs(x - 22) < 1 && Math.abs(y - 52) < 1.4) return BRASS_LIGHT;
          if (Math.abs(x - 22) < 0.5 && Math.abs(y - 56) < 1) return 0x0e0a08;
          if (inPanel && panelRow) return pu % 7.5 < 3 || pv % 30 < 4.5 ? WOOD_LIGHT : WOOD;
          return WOOD_DARK;
        }
        break;
      case 'banner': {
        // A long banner of the guild hung from a gilt rod: blue, a gold ship, a swallow-tailed hem.
        if (y > 8 && y < 9.5 && x > 4 && x < 29) return GOLD;
        if (x > 7 && x < 26 && y > 9 && y < 72) {
          const bu = (x - 7) / 19;
          const bv = (y - 9) / 63;
          if (bv > 0.88 && Math.abs(bu - 0.5) < (bv - 0.88) * 4.2) break;
          if (hash(Math.floor(x), Math.floor(y / 2) + seed) < 0.02) break; // moth
          if (bu < 0.06 || bu > 0.94) return GOLD_DARK;
          const cu = bu - 0.5;
          if (bv > 0.42 && bv < 0.47 && Math.abs(cu) < 0.32 - (bv - 0.42) * 2) return GOLD;
          if (Math.abs(cu) < 0.03 && bv > 0.14 && bv < 0.43) return GOLD_DARK;
          if (bv > 0.17 && bv < 0.38 && Math.abs(cu) < 0.22 - (bv - 0.17) * 0.3) return (Math.floor(y) % 3 ? GOLD : GOLD_LIGHT);
          // The scales under the ship.
          if (bv > 0.55 && bv < 0.7 && (Math.abs(cu) < 0.02 || (Math.abs(bv - 0.57) < 0.01 && Math.abs(cu) < 0.25))) return GOLD;
          for (const s of [-1, 1]) if (Math.abs(cu - s * 0.22) < 0.08 && bv > 0.64 && bv < 0.67) return GOLD_LIGHT;
          const fold = Math.sin(x * 0.9 + index) > 0.6 ? BLUE_LIGHT : Math.sin(x * 0.9 + index) < -0.6 ? BLUE_DARK : BLUE;
          return mixColor(fold, 0x6a6a66, smoothNoise(bu * 3, bv * 5, seed) * 0.35);
        }
        break;
      }
      case 'map0':
      case 'map1':
      case 'map2': {
        const c = mapPaint(Number(kind[3]), x, y);
        if (c !== null) return c;
        break;
      }
      case 'portrait': {
        const c = portraitPaint(index, x, y);
        if (c !== null) return c;
        break;
      }
      case 'charter':
        // The guild's charter, framed, three seals hanging off it on ribbons.
        if (x > 6 && x < 27 && y > 12 && y < 40) {
          const f = gilt(x, y, 6, 27, 12, 40);
          if (f !== null) return f;
          if (y > 16 && y < 34 && (Math.floor(y) % 2 === 0) && x > 9 && x < 24 && hash(Math.floor(x / 2), Math.floor(y)) > 0.25) return INK;
          if (y < 16 && x > 11 && x < 22) return Math.floor(x) % 2 ? RED_INK : INK; // the big initial line
          return PARCHMENT;
        }
        for (const [sx, col] of [[11, 0x8a1a1a], [16.5, 0x1a4a2a], [22, 0x8a1a1a]] as const) {
          if (Math.abs(x - sx) < 0.6 && y >= 40 && y < 46) return col === 0x1a4a2a ? BLUE : GOLD;
          if (Math.hypot(x - sx, y - 48) < 2.4) return Math.hypot(x - sx - 0.6, y - 47.4) < 0.9 ? lighten(col, 0.3) : col;
        }
        break;
      case 'shelf':
        // Shelves of ledgers up to the cornice: spines in calf and vellum, dated in gilt; a few lying flat; dust.
        if (y > 8 && y < DADO && x > 3 && x < 30) {
          const sy = (y - 8) % 14;
          if (sy < 2) return sy < 1 ? WOOD_LIGHT : WOOD_DARK;
          const slot = Math.floor(x / 2.6);
          const shelf = Math.floor((y - 8) / 14);
          const n = hash(slot + seed, shelf);
          if (n < 0.08) return 0x120e0c;
          const tall = 8 + n * 4;
          if (sy < 14 - tall) return 0x120e0c;
          const spine = [0x5a2a1a, 0x3a2a1a, 0x6a4a2a, 0xc8b890, 0x2a3a2a, 0x4a1a1a][Math.floor(n * 60) % 6];
          if (Math.abs(sy - (14 - tall + 2.5)) < 0.6 || Math.abs(sy - 11.5) < 0.5) return GOLD_DARK;
          if (sy < 14 - tall + 1) return mixColor(spine, 0x8a8a80, 0.4); // dust
          return x % 2.6 < 0.4 ? darken(spine, 0.7) : spine;
        }
        break;
      case 'holes':
        // Pigeonholes of waybills, rolled and tied, a label under each in the clerk's hand.
        if (y > 8 && y < DADO && x > 2 && x < 30) {
          const cx = (x - 2) % 7;
          const cy = (y - 8) % 7;
          if (cx < 1 || cy < 1) return WOOD_LIGHT;
          if (cy > 5.5) return cx > 2 && cx < 5 ? PARCHMENT : WOOD_DARK;
          const n = hash(Math.floor((x - 2) / 7), Math.floor((y - 8) / 7) + seed);
          if (n < 0.2) return 0x0e0a08;
          if (Math.hypot(cx - 3.8, cy - 3) < 2.2) return Math.hypot(cx - 3.8, cy - 3) < 0.7 ? PARCHMENT_DARK : n > 0.8 ? 0xe0d4b0 : PARCHMENT;
          if (Math.abs(cx - 3.8) < 0.4) return RED_INK; // the tape
          return 0x1a1410;
        }
        break;
      case 'brace':
        if (y > DADO) break;
        if (Math.abs(x - (4 + ((y - 6) / (DADO - 6)) * 26)) < 2.2) return OAK;
        break;
      default:
        break;
    }
    if (y >= DADO) return wainscot(x + index * 32, y, seed);
    return limewash(x + index * 32, y, seed);
  };
}

/** One segment of the guild's walls, keyed 'gd-wall-<side>-<kind>-<index>'. */
function guildWall(scene: Phaser.Scene, side: 'back' | 'side', kind: GuildWallKind, index: number): void {
  const m = new IsoModel();
  const H = WALL_HEIGHT;
  const cap = 0.14;
  const shade = guildWallShader(kind, side, index);
  if (side === 'back') {
    m.quad({ x: 0, y: 0, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, shade);
    m.quad({ x: 0, y: -cap, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: cap, z: 0 }, lipped(OAK_LIGHT, WOOD_LIGHT));
  } else {
    m.quad({ x: 0, y: 0, z: H }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -H }, (u, v) => {
      const c = shade(u, v);
      return c === null ? null : mixColor(c, 0x0e0a10, 0.22);
    });
    m.quad({ x: -cap, y: 0, z: H }, { x: cap, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, OAK_LIGHT);
  }
  registerModel(scene, `gd-wall-${side}-${kind}-${index}`, m.render(false));
}

function cornerPost(): IsoModel {
  const m = new IsoModel();
  m.box(-0.16, -0.16, 0, 0.3, 0.3, WALL_HEIGHT + 3, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  return m;
}

// ---------------------------------------------------------------- small things on tables

function candle(m: IsoModel, x: number, y: number, z: number, h = 6): void {
  m.cylinder(x, y, z, 0.05, 1.5, (u) => (u < 0.4 ? BRASS_LIGHT : BRASS_DARK), BRASS);
  m.box(x - 0.025, y - 0.025, z + 1.5, 0.05, 0.05, h, { top: WAX, left: WAX, right: 0xc8bc98 });
  m.box(x - 0.01, y - 0.01, z + 1.5 + h, 0.02, 0.02, 2.5, { top: P.fireYellow, left: P.fireOrange, right: P.fireYellow });
}

function inkwell(m: IsoModel, x: number, y: number, z: number): void {
  m.cylinder(x, y, z, 0.05, 2.5, (u) => (u < 0.35 ? 0x3a3a44 : 0x1a1a20), 0x0e0e12);
  // A quill in it, leaning.
  m.quad({ x: x + 0.01, y: y + 0.01, z: z + 2 }, { x: 0.12, y: -0.06, z: 9 }, { x: 0.03, y: 0.03, z: 0 }, (u) => (u > 0.4 ? 0xf0ece0 : 0xd8d0c0));
}

/** A loose sheaf of papers: reports, letters, a waybill, at a slant. */
function papers(m: IsoModel, x: number, y: number, z: number, n = 3, seed = 1): void {
  const rnd = seededRandom(seed);
  for (let i = 0; i < n; i++) {
    const ox = x + (rnd() - 0.5) * 0.08;
    const oy = y + (rnd() - 0.5) * 0.08;
    const tilt = (rnd() - 0.5) * 0.08;
    m.quad({ x: ox, y: oy, z: z + i * 0.3 }, { x: 0.24, y: tilt, z: 0 }, { x: -tilt, y: 0.3, z: 0 }, (u, v) =>
      u < 0.05 || u > 0.95 || v < 0.04 || v > 0.96 ? PARCHMENT_DARK : (v * 16) % 2 < 0.7 && u > 0.12 && u < 0.88 && v > 0.12 ? 0x6a5a48 : i % 2 ? PARCHMENT : 0xe4d8b8,
    );
  }
}

function goblet(m: IsoModel, x: number, y: number, z: number, wine = true): void {
  m.cylinder(x, y, z, 0.04, 0.8, () => PEWTER_DARK, PEWTER);
  m.cylinder(x, y, z + 0.8, 0.012, 3, () => PEWTER, PEWTER);
  m.cylinder(x, y, z + 3.8, 0.05, 3, (u) => (u < 0.35 ? PEWTER_LIGHT : PEWTER), wine ? 0x4a0e18 : PEWTER_DARK);
}
const PEWTER = 0x8a8a90;
const PEWTER_DARK = 0x5a5a62;
const PEWTER_LIGHT = 0xb4b4bc;

function coins(m: IsoModel, x: number, y: number, z: number, n = 3, silver = false): void {
  for (let i = 0; i < n; i++) m.cylinder(x + (i % 2) * 0.03, y + (i % 3) * 0.02, z + i * 0.6, 0.04, 0.6, () => (silver ? 0x9a9aa4 : 0xa8802e), silver ? 0xd8d8e4 : GOLD);
}

/** The guildmaster's gavel and its block. */
function gavel(m: IsoModel, x: number, y: number, z: number): void {
  m.cylinder(x, y, z, 0.07, 1.2, (u) => (u < 0.4 ? WOOD_LIGHT : WOOD_DARK), WOOD_TOP);
  m.box(x + 0.02, y - 0.12, z + 1.2, 0.14, 0.07, 1.8, { top: WOOD_LIGHT, left: WOOD, right: WOOD_DARK });
  m.box(x + 0.06, y - 0.06, z + 1.8, 0.03, 0.22, 0.8, { top: WOOD_LIGHT, left: WOOD, right: WOOD_DARK });
}

// ---------------------------------------------------------------- the meeting hall

/**
 * One tile of the long table: a heavy oak top on turned legs at the ends
 * only, what's on it according to `part` (the reports of the raids spread
 * out, a candelabrum, the guildmaster's gavel, ink, goblets, a fist-dent).
 * `end`: which ends of the table this piece is at (legs there).
 */
function tablePiece(part: number, end: 'w' | 'e' | 'none', row: 'n' | 's'): IsoModel {
  const m = new IsoModel();
  const legs = { top: WOOD_DARK, left: (_u: number, v: number) => (Math.sin(v * 18) > 0.6 ? WOOD_LIGHT : WOOD), right: WOOD_DARK };
  const ly = row === 'n' ? 0.12 : 0.76;
  if (end === 'w') m.box(0.1, ly, 0, 0.12, 0.12, 26, legs);
  if (end === 'e') m.box(0.78, ly, 0, 0.12, 0.12, 26, legs);
  // A stretcher low down, end to end.
  m.box(0, 0.47, 6, 1, 0.06, 2.5, { top: WOOD, left: WOOD_DARK, right: WOOD_DARK });
  const x0 = end === 'w' ? 0.04 : 0;
  const x1 = end === 'e' ? 0.96 : 1;
  const y0 = row === 'n' ? 0.06 : 0;
  const y1 = row === 's' ? 0.94 : 1;
  m.box(x0, y0, 26, x1 - x0, y1 - y0, 4, {
    top: (u, v) => {
      const c = planks(2, WOOD_TOP, WOOD_DARK, WOOD_LIGHT, 7 + part)(v, u) ?? WOOD_TOP;
      // Wax rings, ink blots, polish.
      if (Math.abs(Math.hypot(u - 0.3, v - 0.6) - 0.1) < 0.015) return WOOD_DARK;
      if (hash(Math.floor(u * 20), Math.floor(v * 20) + part) < 0.02) return INK;
      return u + v < 0.4 ? lighten(c, 0.08) : c;
    },
    left: (_u, v) => (v < 0.3 ? WOOD_LIGHT : row === 's' ? WOOD : WOOD_DARK),
    right: (_u, v) => (v < 0.3 ? WOOD : WOOD_DARK),
  });
  const z = 30;
  switch (part) {
    case 0:
      // The head of the table: the gavel on its block, the minute book, a candle.
      gavel(m, 0.4, 0.5, z);
      m.box(0.55, 0.2, z, 0.3, 0.38, 1.6, { top: (u) => (Math.abs(u - 0.5) < 0.04 ? 0x5a4a3a : (u * 20) % 2 < 0.6 ? 0x8a7a64 : PARCHMENT), left: 0x5a2a1a, right: 0x3a1a10 });
      candle(m, 0.2, 0.25, z, 7);
      break;
    case 1:
      // Reports of the raids, spread out and pushed about, one with a boot-print on it.
      papers(m, 0.2, 0.25, z, 4, 3);
      papers(m, 0.55, 0.45, z, 2, 5);
      inkwell(m, 0.8, 0.3, z);
      break;
    case 2:
      // The candelabrum, three candles burnt halfway, wax run down over the papers under it.
      m.cylinder(0.5, 0.5, z, 0.12, 1.5, (u) => (u < 0.4 ? BRASS_LIGHT : BRASS_DARK), BRASS);
      m.cylinder(0.5, 0.5, z + 1.5, 0.03, 9, (u) => (u < 0.4 ? BRASS_LIGHT : BRASS_DARK), BRASS);
      m.box(0.3, 0.48, z + 10, 0.4, 0.04, 1.2, { top: BRASS_LIGHT, left: BRASS, right: BRASS_DARK });
      for (const x of [0.3, 0.5, 0.7]) candle(m, x, 0.5, z + 10.5, x === 0.5 ? 7 : 5);
      papers(m, 0.08, 0.1, z, 1, 9);
      break;
    case 3:
      // Goblets, one knocked over, its wine run across the wood; a dish of figs gone hard.
      goblet(m, 0.25, 0.35, z);
      m.cylinder(0.6, 0.6, z, 0.04, 0.8, () => PEWTER_DARK, PEWTER);
      m.box(0.55, 0.62, z + 0.8, 0.2, 0.08, 0.8, { top: PEWTER, left: PEWTER_DARK, right: PEWTER_DARK });
      m.quad({ x: 0.5, y: 0.7, z: z + 0.1 }, { x: 0.35, y: 0.05, z: 0 }, { x: 0, y: 0.2, z: 0 }, (u, v) => (Math.hypot(u - 0.4, v - 0.5) < 0.4 ? 0x3a0a12 : null));
      m.cylinder(0.75, 0.25, z, 0.12, 1, () => PEWTER_DARK, (u, v) => (hash(Math.floor(u * 6), Math.floor(v * 6)) < 0.4 ? 0x5a3a2a : PEWTER));
      break;
    case 4:
      // A waybill pinned to the wood with a dagger, a merchant's ring-box, ink.
      papers(m, 0.3, 0.3, z, 1, 11);
      m.box(0.42, 0.42, z + 0.6, 0.02, 0.06, 5, { top: PEWTER_LIGHT, left: PEWTER_LIGHT, right: PEWTER });
      m.box(0.4, 0.4, z + 5, 0.06, 0.1, 3, { top: 0x3a2a20, left: 0x4a3426, right: 0x2a1e16 });
      inkwell(m, 0.75, 0.7, z);
      coins(m, 0.15, 0.7, z, 3);
      break;
    default:
      // Somebody's hat left on the table, and a cup.
      goblet(m, 0.7, 0.3, z, false);
      m.cylinder(0.35, 0.55, z, 0.2, 1, (u) => (u < 0.4 ? 0x3a3a42 : 0x1e1e24), 0x2a2a30);
      m.cylinder(0.35, 0.55, z + 1, 0.12, 4, (u) => (u < 0.4 ? 0x3a3a42 : 0x1e1e24), 0x2a2a30);
      break;
  }
  return m;
}

/** A guild chair: oak, a padded seat of faded blue, a carved back. `facing`: which way someone sitting in it faces (+y 's', -y 'n'). */
function chair(facing: 'n' | 's', pushed = 0): IsoModel {
  const m = new IsoModel();
  const wood = { top: WOOD_LIGHT, left: WOOD, right: WOOD_DARK };
  const oy = pushed * (facing === 's' ? -1 : 1);
  for (const [x, y] of [[0.25, 0.25], [0.7, 0.25], [0.25, 0.7], [0.7, 0.7]]) m.box(x, y + oy, 0, 0.06, 0.06, SEAT - 3, wood);
  m.box(0.22, 0.22 + oy, SEAT - 3, 0.56, 0.56, 3, { top: (u, v) => (u < 0.08 || u > 0.92 || v < 0.08 || v > 0.92 ? WOOD_LIGHT : BLUE), left: WOOD, right: WOOD_DARK });
  const by = facing === 's' ? 0.2 : 0.74;
  m.box(0.22, by + oy, SEAT, 0.56, 0.06, 34, {
    top: WOOD_LIGHT,
    left: (u, v) => (v < 0.15 ? WOOD_LIGHT : u > 0.2 && u < 0.8 && v > 0.25 && v < 0.75 ? (Math.floor(v * 10) % 2 ? WOOD : BLUE_DARK) : WOOD),
    right: WOOD_DARK,
  });
  return m;
}

/** A chair knocked over in the argument, lying on its back. */
function fallenChair(): IsoModel {
  const m = new IsoModel();
  const wood = { top: WOOD_LIGHT, left: WOOD, right: WOOD_DARK };
  // The back flat on the floor, the seat standing up from it, the legs in the air.
  m.box(0.15, 0.2, 0, 0.6, 0.56, 2, { top: (u, v) => (u > 0.2 && u < 0.8 && v > 0.2 && v < 0.8 ? BLUE_DARK : WOOD), left: WOOD, right: WOOD_DARK });
  m.box(0.7, 0.22, 0, 0.06, 0.56, 16, { top: WOOD_LIGHT, left: (u) => (u > 0.1 && u < 0.9 ? BLUE : WOOD), right: WOOD_DARK });
  for (const y of [0.25, 0.7]) m.box(0.76, y, 12, 0.2, 0.06, 3, wood);
  return m;
}

/**
 * The guildmaster's great chair, at the head of the table (in a 1 x 2 spot,
 * centred on it, facing +x down the table): a high, square oak back framed by
 * two posts with gilt finials, a carved cresting with the guild's scales, and a
 * buttoned crimson back and cushion; open arms on turned front posts.
 */
function greatChair(): IsoModel {
  const m = new IsoModel();
  const CRIMSON = 0x7a1e2a;
  const CRIMSON_DARK = 0x4a1018;
  const CRIMSON_LIGHT = 0x9e3444;
  const wood = { top: WOOD_LIGHT, left: WOOD, right: WOOD_DARK };
  const y0 = 0.62;
  const y1 = 1.38;
  // Four short legs and the seat frame, with its crimson cushion.
  for (const x of [0.16, 0.7]) for (const y of [y0, y1 - 0.07]) m.box(x, y, 0, 0.07, 0.07, SEAT - 3, wood);
  m.box(0.14, y0, SEAT - 3, 0.66, y1 - y0, 2, { top: WOOD, left: WOOD, right: (u) => (u < 0.04 || u > 0.96 ? WOOD_DARK : GOLD_DARK) });
  m.box(0.2, y0 + 0.06, SEAT - 1, 0.56, y1 - y0 - 0.12, 1.5, {
    top: (u, v) => ((Math.abs(u - 0.5) < 0.04 && Math.abs(v - 0.5) < 0.04) ? CRIMSON_DARK : u > 0.85 ? CRIMSON_LIGHT : CRIMSON),
    left: CRIMSON_DARK,
    right: CRIMSON_DARK,
  });
  // The back: two posts with gilt finials, and the panel between them.
  for (const y of [y0, y1 - 0.08]) {
    m.box(0.1, y, 0, 0.1, 0.08, 52, wood);
    m.cylinder(0.15, y + 0.04, 52, 0.045, 3, (u) => (u < 0.4 ? GOLD_LIGHT : GOLD_DARK), GOLD);
    m.cylinder(0.15, y + 0.04, 55, 0.03, 2, (u) => (u < 0.4 ? GOLD_LIGHT : GOLD), GOLD_LIGHT);
  }
  m.box(0.11, y0 + 0.08, SEAT, 0.07, y1 - y0 - 0.16, 40, {
    top: WOOD_LIGHT,
    left: WOOD,
    right: (u, v) => {
      // A crimson panel, buttoned, in an oak frame with a gilt bead round it.
      if (v < 0.08 || v > 0.94 || u < 0.06 || u > 0.94) return WOOD;
      if (v < 0.11 || v > 0.91 || u < 0.09 || u > 0.91) return GOLD;
      const bu = (u - 0.09) * 5;
      const bv = (v - 0.11) * 6;
      if (Math.abs(bu - Math.round(bu)) < 0.08 && Math.abs(bv - Math.round(bv)) < 0.08) return CRIMSON_DARK;
      return u < 0.2 ? CRIMSON_LIGHT : CRIMSON;
    },
  });
  // The cresting over the back: a carved arch with the guild's scales in gilt.
  m.quad({ x: 0.17, y: y0 + 0.08, z: SEAT + 40 + 9 }, { x: 0, y: y1 - y0 - 0.16, z: 0 }, { x: 0, y: 0, z: -9 }, (u, v) => {
    const arch = 1 - Math.pow(Math.abs(u - 0.5) * 2, 2) * 0.75;
    if (1 - v > arch) return null;
    const cu = u - 0.5;
    if (v > 0.55 && v < 0.65 && Math.abs(cu) < 0.2) return GOLD_LIGHT; // the beam
    if (Math.abs(cu) < 0.025 && v > 0.3 && v < 0.95) return GOLD; // the post
    if (v > 0.65 && v < 0.85 && Math.abs(Math.abs(cu) - 0.17) < 0.06) return GOLD; // the pans
    return 1 - v > arch - 0.08 ? WOOD_LIGHT : WOOD;
  });
  // The arms: turned front posts, and broad flat rests with gilt knobs.
  for (const y of [y0 - 0.01, y1 - 0.08]) {
    m.cylinder(0.72, y + 0.045, SEAT, 0.035, 9, (u) => (u < 0.4 ? WOOD_LIGHT : WOOD_DARK), WOOD);
    m.box(0.18, y, SEAT + 9, 0.6, 0.09, 2, wood);
    m.cylinder(0.76, y + 0.045, SEAT + 11, 0.035, 1.5, (u) => (u < 0.4 ? GOLD_LIGHT : GOLD_DARK), GOLD);
  }
  return m;
}

/**
 * The great fireplace (2 x 1): a stone surround with a carved overmantel of
 * the guild's arms, the chimney breast up to the cornice, a fire of sea-coal
 * in an iron basket, fire-irons, a brass fender, and, on the mantel, a ship
 * in a bottle, candlesticks and a clock that has stopped.
 */
function hearth(): IsoModel {
  const m = new IsoModel();
  const stone: Shader = (u, v) => ashlar(8, 4, 181)(u, v) ?? ASHLAR;
  m.box(0.15, 0, 50, 1.7, 0.5, WALL_HEIGHT - 50 + 4, {
    top: SOOT,
    left: (u, v) => {
      // The overmantel: a carved panel with the ship and scales, gilt and blue.
      const y = v * (WALL_HEIGHT - 46);
      if (u > 0.2 && u < 0.8 && y > 4 && y < 26) {
        if (u < 0.23 || u > 0.77 || y < 6 || y > 24) return GOLD_DARK;
        const cu = (u - 0.5) / 0.27;
        const cv = (y - 6) / 18;
        if (cv > 0.5 && cv < 0.62 && Math.abs(cu) < 0.6 - (cv - 0.5) * 2) return GOLD;
        if (Math.abs(cu) < 0.05 && cv > 0.12 && cv < 0.52) return GOLD_DARK;
        if (cv > 0.16 && cv < 0.46 && Math.abs(cu) < 0.42 - (cv - 0.16) * 0.6) return GOLD_LIGHT;
        if (cv > 0.72 && cv < 0.78 && Math.abs(cu) < 0.7) return GOLD;
        return BLUE_DARK;
      }
      return stone(u, v);
    },
    right: (u, v) => darken(stone(u, v) ?? ASHLAR, 0.72),
  });
  m.box(0, 0, 0, 2, 0.8, 50, {
    top: ASHLAR_DARK,
    left: (u, v) => {
      const x = (u - 0.5) * 64;
      const y = v * 50;
      // The firebox: a wide opening under a flat lintel, the back black with soot.
      if (Math.abs(x) < 20 && y > 14) return y > 46 ? 0x120c0a : mixColor(SOOT, 0x2a1e18, smoothNoise(x / 4, y / 4, 3) * 0.5);
      if (Math.abs(x) < 22 && y > 12) return ASHLAR_LIGHT;
      return stone(u, v);
    },
    right: (u, v) => darken(stone(u, v) ?? ASHLAR, 0.72),
  });
  // The mantel shelf.
  m.box(-0.08, -0.02, 50, 2.16, 0.95, 4, { top: ASHLAR_LIGHT, left: lipped(ASHLAR, ASHLAR_LIGHT), right: ASHLAR_DARK });
  // On it: two candlesticks, a ship in a bottle, a clock stopped at a quarter to three.
  candle(m, 0.25, 0.45, 54, 8);
  candle(m, 1.75, 0.45, 54, 8);
  m.cylinder(0.75, 0.45, 54, 0.08, 1, () => WOOD_DARK, WOOD);
  m.quad({ x: 0.55, y: 0.5, z: 59 }, { x: 0.4, y: 0, z: 0 }, { x: 0, y: 0, z: -4.5 }, (u, v) => {
    if (Math.hypot((u - 0.5) * 2, (v - 0.5) * 2.2) > 1) return null;
    if (v > 0.6 && Math.abs(u - 0.5) < 0.3) return 0x5a3a22;
    if (Math.abs(u - 0.5) < 0.03 && v < 0.6) return 0x3a2a1a;
    if (v > 0.2 && v < 0.55 && Math.abs(u - 0.5) < 0.18) return 0xe8e0c8;
    return 0x6a8a8a;
  });
  m.box(1.2, 0.3, 54, 0.3, 0.22, 10, {
    top: WOOD_LIGHT,
    left: (u, v) => (Math.hypot(u - 0.5, (v - 0.4) * 1.3) < 0.32 ? (Math.abs(u - 0.5) < 0.04 && v < 0.4 && v > 0.2 ? INK : Math.abs(v - 0.4) < 0.04 && u < 0.5 && u > 0.25 ? INK : 0xe8e0c8) : WOOD),
    right: WOOD_DARK,
  });
  // The fire basket and its coals, the fender, the irons.
  m.box(0.55, 0.3, 2, 0.9, 0.4, 6, { top: (u, v) => (hash(Math.floor(u * 10), Math.floor(v * 6)) < 0.5 ? 0x2a2420 : 0x3a302a), left: IRON, right: 0x2a2a30 });
  m.box(0.2, 0.86, 0, 1.6, 0.04, 3, { top: BRASS_LIGHT, left: BRASS, right: BRASS_DARK });
  for (const [x, h] of [[1.85, 18], [1.92, 16]] as const) m.box(x, 0.7, 0, 0.03, 0.03, h, { top: BRASS_LIGHT, left: IRON_LIGHT, right: IRON });
  return m;
}

/** Flames over the sea-coal, for one frame of the fire. */
function paintFlames(c: PixelCanvas, ax: number, ay: number, frame: number): void {
  const bx = ax + (1 - 0.7) * 32;
  const by = ay + (1 + 0.7) * 16 - 8;
  const rnd = seededRandom(71 + frame * 31);
  const floor = (x: number) => by + Math.round(x / 2);
  for (let i = -9; i <= 9; i++) c.set(bx + i, floor(i) - 1, i % 3 === 0 ? P.ember : 0x3a2a20);
  for (let i = 0; i < 26; i++) {
    const x = Math.round((rnd() - 0.5) * 20);
    const h = 3 + rnd() * (11 - Math.abs(x) * 0.5);
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const col = t < 0.3 ? P.fireYellow : t < 0.7 ? P.fireOrange : P.fireRed;
      const sway = Math.round(Math.sin(t * 3 + frame * 2 + i) * t * 1.5);
      c.set(bx + x + sway, floor(x) - 2 - y, col);
    }
  }
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
  const tex = sheet.toTexture(scene, 'gd-hearth');
  for (let f = 0; f < HEARTH_FRAMES; f++) tex.add(f, 0, f * w, 0, w, base.canvas.height);
  MODEL_ART['gd-hearth'] = { key: 'gd-hearth', originX: base.anchorX / w, originY: base.anchorY / base.canvas.height };
  if (!scene.anims.exists('gd-hearth-fire')) {
    scene.anims.create({ key: 'gd-hearth-fire', frames: [0, 1, 2, 3, 2, 1].map((frame) => ({ key: 'gd-hearth', frame })), frameRate: 7, repeat: -1 });
  }
}

/** The guild's great scales: brass pans on chains from a beam, on an oak stand, a set of weights in a box beside. */
function scales(): IsoModel {
  const m = new IsoModel();
  m.box(0.25, 0.25, 0, 0.5, 0.5, 4, { top: WOOD_LIGHT, left: WOOD, right: WOOD_DARK });
  m.cylinder(0.5, 0.5, 4, 0.05, 50, (u) => (u < 0.4 ? BRASS_LIGHT : BRASS_DARK), BRASS);
  // The beam, tipped a little: the left pan heavier.
  m.quad({ x: 0.12, y: 0.5, z: 56 }, { x: 0.76, y: 0, z: -3 }, { x: 0, y: 0, z: -2 }, BRASS);
  m.quad({ x: 0.12, y: 0.5, z: 56 }, { x: 0.76, y: 0, z: -3 }, { x: 0, y: 0.06, z: 0 }, BRASS_LIGHT);
  for (const [x, z] of [[0.14, 30], [0.86, 34]] as const) {
    for (const dy of [-0.08, 0.08]) line(m, { x, y: 0.5 + dy, z: z + 2 }, { x, y: 0.5, z: x < 0.5 ? 55 : 52 }, BRASS_DARK, 0.008);
    m.cylinder(x, 0.5, z, 0.12, 2, (u) => (u < 0.4 ? BRASS_LIGHT : BRASS_DARK), BRASS);
  }
  // A pinch of salt in the heavy pan.
  m.cylinder(0.14, 0.5, 32, 0.06, 0.6, () => 0xe8e8e0, 0xf4f4ec);
  m.box(0.6, 0.1, 4, 0.3, 0.2, 2, { top: (u) => (Math.floor(u * 5) % 2 ? BRASS : WOOD_DARK), left: WOOD, right: WOOD_DARK });
  return m;
}

/** The charter chest: iron-bound oak, three locks, the guild's ship burnt into the lid. */
function chest(): IsoModel {
  const m = new IsoModel();
  const band = (u: number) => Math.abs(u - 0.15) < 0.04 || Math.abs(u - 0.5) < 0.04 || Math.abs(u - 0.85) < 0.04;
  m.box(0.08, 0.15, 0, 0.84, 0.7, 18, {
    top: (u, v) => (band(u) ? IRON : Math.hypot((u - 0.5) * 2, v - 0.5) < 0.25 && Math.abs(v - 0.5) < 0.1 ? WOOD_DARK : WOOD_TOP),
    left: (u, v) => (band(u) || v < 0.1 ? IRON : Math.abs(v - 0.35) < 0.08 && [0.3, 0.5, 0.7].some((k) => Math.abs(u - k) < 0.035) ? BRASS_LIGHT : WOOD),
    right: (u, v) => (band(u) || v < 0.1 ? IRON : WOOD_DARK),
  });
  return m;
}

/** A sideboard (2 x 1) against the wall: a decanter, goblets, a dish of salt, a silver ewer, the guild's plate under a cloth. */
function sideboard(): IsoModel {
  const m = new IsoModel();
  m.box(0.05, 0.08, 0, 1.9, 0.55, 26, {
    top: WOOD_TOP,
    left: (u, v) => ((u * 4) % 1 < 0.04 || v < 0.08 || v > 0.92 ? WOOD_DARK : Math.abs(v - 0.5) < 0.06 && (u * 4) % 1 > 0.45 && (u * 4) % 1 < 0.55 ? BRASS_LIGHT : WOOD),
    right: WOOD_DARK,
  });
  m.box(0.02, 0.05, 26, 1.96, 0.62, 2, { top: WOOD_LIGHT, left: WOOD_LIGHT, right: WOOD });
  // The decanter.
  m.cylinder(0.35, 0.35, 28, 0.08, 7, (u) => (u < 0.3 ? 0xa86a6a : 0x5a1a22), 0x4a1018);
  m.cylinder(0.35, 0.35, 35, 0.03, 4, () => 0x8a5a5a, GLASS_LIGHT);
  goblet(m, 0.6, 0.3, 28);
  goblet(m, 0.75, 0.42, 28, false);
  // The ewer, tall and silver, and the cloth over the plate.
  m.cylinder(1.15, 0.35, 28, 0.08, 10, (u) => (u < 0.35 ? PEWTER_LIGHT : PEWTER_DARK), PEWTER);
  m.box(1.4, 0.15, 28, 0.45, 0.4, 4, { top: 0xd8d0c0, left: 0xc0b8a8, right: 0xa8a090 });
  return m;
}

/** A tall iron candlestand on three feet, a ring of five candles at the top. */
function candlestand(): IsoModel {
  const m = new IsoModel();
  for (const a of [0, 2.1, 4.2]) m.box(0.48 + Math.cos(a) * 0.15, 0.48 + Math.sin(a) * 0.15, 0, 0.05, 0.05, 3, { top: IRON_LIGHT, left: IRON, right: IRON });
  m.cylinder(0.5, 0.5, 2, 0.03, 52, (u) => (u < 0.4 ? IRON_LIGHT : IRON), IRON);
  m.cylinder(0.5, 0.5, 54, 0.2, 1.5, () => IRON, IRON_LIGHT);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    candle(m, 0.5 + Math.cos(a) * 0.15, 0.5 + Math.sin(a) * 0.15, 55, 5 + (i % 2) * 2);
  }
  return m;
}

/** A plain oak bench for those who wait on the guild, `len` tiles along x. */
function bench(len: number): IsoModel {
  const m = new IsoModel();
  const wood = { top: WOOD_TOP, left: lipped(WOOD, WOOD_LIGHT), right: WOOD_DARK };
  for (const x of [0.15, len - 0.25]) m.box(x, 0.3, 0, 0.1, 0.4, SEAT - 3, wood);
  m.box(0.05, 0.25, SEAT - 3, len - 0.1, 0.5, 3, wood);
  return m;
}

/** Bales of wool and sacks of salt, samples of what the guild carries. `low`: just a sack or two. */
function bales(low: boolean): IsoModel {
  const m = new IsoModel();
  const wool = (dark: boolean): Shader => (u, v) => {
    if (Math.abs(u - 0.33) < 0.03 || Math.abs(u - 0.66) < 0.03) return dark ? 0x4a3e2a : 0x6a5a3e; // the ropes
    const n = smoothNoise(u * 12, v * 8, 5);
    const c = n > 0.6 ? 0xd8ccac : n < 0.3 ? 0xa89c7c : 0xc0b494;
    return dark ? darken(c, 0.75) : c;
  };
  if (!low) {
    m.box(0.08, 0.1, 0, 0.84, 0.5, 14, { top: wool(false), left: wool(false), right: wool(true) });
    m.box(0.15, 0.15, 14, 0.7, 0.45, 12, { top: wool(false), left: wool(false), right: wool(true) });
    // The guild's stamp, a ship, in black on the top bale.
    m.quad({ x: 0.3, y: 0.6, z: 22 }, { x: 0.3, y: 0, z: 0 }, { x: 0, y: 0, z: -6 }, (u, v) => (v > 0.6 && Math.abs(u - 0.5) < 0.4 - (v - 0.6) ? INK : Math.abs(u - 0.5) < 0.04 ? INK : null));
  }
  // Salt sacks, slumped.
  const sack = (dark: boolean): Shader => (u, v) => {
    const c = Math.sin(u * 30 + v * 3) > 0.7 ? 0xb8ac90 : 0xd0c4a8;
    return v < 0.12 ? 0x8a7a5a : dark ? darken(c, 0.75) : c;
  };
  m.cylinder(0.3, low ? 0.45 : 0.82, 0, 0.18, 11, (u, v) => (u < 0.3 ? sack(false)(u, v) : sack(true)(u, v)) ?? 0xd0c4a8, 0xc0b494);
  if (low) m.cylinder(0.66, 0.52, 0, 0.16, 9, (u, v) => (u < 0.3 ? sack(false)(u, v) : sack(true)(u, v)) ?? 0xd0c4a8, 0xc0b494);
  return m;
}

/** A lectern with the guild's roll of members, open, a ribbon down the page, one name struck through. */
function lectern(): IsoModel {
  const m = new IsoModel();
  m.box(0.38, 0.38, 0, 0.24, 0.24, 3, { top: WOOD_LIGHT, left: WOOD, right: WOOD_DARK });
  m.box(0.45, 0.45, 3, 0.1, 0.1, 34, { top: WOOD_LIGHT, left: (_u, v) => (Math.sin(v * 30) > 0.5 ? WOOD_LIGHT : WOOD), right: WOOD_DARK });
  m.quad({ x: 0.2, y: 0.3, z: 42 }, { x: 0.6, y: 0, z: 0 }, { x: 0, y: 0.4, z: -6 }, (u, v) => {
    if (u < 0.04 || u > 0.96 || v < 0.05 || v > 0.95) return 0x4a1a14;
    if (Math.abs(u - 0.5) < 0.02) return 0x6a5a48;
    if (Math.abs(u - 0.55) < 0.015 && v > 0.1) return RED_INK; // the ribbon
    if ((v * 12) % 1 < 0.35 && v > 0.12) {
      if (u > 0.58 && u < 0.86 && Math.abs(v - 0.62) < 0.04) return RED_INK; // struck through
      return u > 0.1 && u < 0.9 && Math.abs(u - 0.5) > 0.05 ? INK : PARCHMENT;
    }
    return PARCHMENT;
  });
  m.box(0.2, 0.68, 36, 0.6, 0.04, 2, { top: WOOD_LIGHT, left: WOOD, right: WOOD_DARK });
  return m;
}

/** The faded carpet under the long table, red and blue, worn to the threads down the middle where the members' boots go. */
function carpet(w: number, h: number): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.1, z: 0 }, { x: w - 0.2, y: 0, z: 0 }, { x: 0, y: h - 0.2, z: 0 }, (u, v) => {
    const x = u * (w - 0.2);
    const y = v * (h - 0.2);
    if (u < 0.01 || u > 0.99 || v < 0.025 || v > 0.975) return hash(Math.floor(x * 30), Math.floor(y * 30)) < 0.5 ? 0xc8b890 : null; // fringe
    const e = Math.min(x, w - 0.2 - x, y, h - 0.2 - y);
    let c: number;
    if (e < 0.25) c = Math.floor((x + y) * 6) % 2 ? 0x2a3a5a : 0x6a2a24;
    else if (e < 0.32) c = 0xa88a4a;
    else {
      // A field of lozenges in madder red and indigo.
      const lx = Math.abs(((x * 2) % 1) - 0.5);
      const ly = Math.abs(((y * 2) % 1) - 0.5);
      c = lx + ly < 0.28 ? 0x2a3a5a : lx + ly < 0.34 ? 0xa88a4a : 0x6a2a24;
    }
    // Worn through where the feet go, faded where the window light falls.
    const worn = smoothNoise(x * 3, y * 4, 5) * (1 - Math.abs(v - 0.5) * 2);
    if (worn > 0.45) c = mixColor(c, 0x6a5a48, 0.6);
    return mixColor(c, 0x8a7a6a, 0.2);
  });
  return m;
}

// ---------------------------------------------------------------- the counting room

/** The clerk's high desk: a sloped top, the day-book open on it, ink, quills, a candle, a spike of receipts, sleeve-guards left lying. */
function clerkDesk(): IsoModel {
  const m = new IsoModel();
  const wood = { top: WOOD_TOP, left: WOOD, right: WOOD_DARK };
  for (const [x, y] of [[0.12, 0.15], [0.82, 0.15], [0.12, 0.8], [0.82, 0.8]]) m.box(x, y, 0, 0.07, 0.07, 36, wood);
  m.box(0.1, 0.12, 30, 0.82, 0.76, 6, { top: WOOD_TOP, left: (u, v) => (Math.abs(u - 0.5) < 0.1 && v > 0.3 && v < 0.6 ? BRASS : WOOD), right: WOOD_DARK });
  // The sloped writing top, rising towards the back.
  m.quad({ x: 0.06, y: 0.9, z: 37 }, { x: 0.9, y: 0, z: 0 }, { x: 0, y: -0.8, z: 8 }, (u, v) => {
    if (u < 0.03 || u > 0.97 || v < 0.04 || v > 0.96) return WOOD_DARK;
    // The day-book open across it.
    if (u > 0.12 && u < 0.88 && v > 0.15 && v < 0.85) {
      if (Math.abs(u - 0.5) < 0.015) return 0x6a5a48;
      if ((v * 18) % 1 < 0.3 && Math.abs(u - 0.5) > 0.04) return (u * 30) % 3 < 0.4 ? RED_INK : INK;
      return PARCHMENT;
    }
    return WOOD_TOP;
  });
  m.box(0.06, 0.08, 45, 0.9, 0.12, 2, { top: WOOD_LIGHT, left: WOOD, right: WOOD_DARK });
  inkwell(m, 0.2, 0.15, 47);
  candle(m, 0.8, 0.15, 47, 4);
  // The spike, stacked with receipts.
  m.box(0.55, 0.12, 47, 0.02, 0.02, 7, { top: IRON_LIGHT, left: IRON_LIGHT, right: IRON });
  for (let i = 0; i < 5; i++) m.box(0.5 + (i % 2) * 0.02, 0.08, 47 + i * 1.1, 0.12, 0.1, 0.5, { top: i % 2 ? PARCHMENT : 0xe8dcc0, left: PARCHMENT_DARK, right: PARCHMENT_DARK });
  return m;
}

/** A tall stool for the clerk's desk, its rail worn by heels. */
function highStool(): IsoModel {
  const m = new IsoModel();
  const leg = { top: WOOD, left: WOOD_LIGHT, right: WOOD_DARK };
  for (const [x, y] of [[0.3, 0.3], [0.62, 0.3], [0.3, 0.62], [0.62, 0.62]]) m.box(x, y, 0, 0.06, 0.06, 24, leg);
  m.box(0.28, 0.3, 8, 0.4, 0.04, 2, { top: WOOD_LIGHT, left: WOOD_LIGHT, right: WOOD });
  m.cylinder(0.5, 0.5, 24, 0.2, 3, (u) => (u < 0.3 ? WOOD_LIGHT : WOOD_DARK), WOOD_TOP);
  return m;
}

/**
 * The route book on its lectern, chained: where every caravan's road, wagons,
 * cargo and day of leaving is written down before it goes, and signed for by
 * every master who reads it.
 */
function routeBook(): IsoModel {
  const m = new IsoModel();
  m.box(0.2, 0.25, 0, 0.6, 0.5, 30, {
    top: WOOD_TOP,
    left: (u, v) => (v < 0.1 || u < 0.06 || u > 0.94 ? WOOD_DARK : Math.abs(u - 0.5) < 0.08 && Math.abs(v - 0.4) < 0.08 ? BRASS_LIGHT : WOOD),
    right: WOOD_DARK,
  });
  m.quad({ x: 0.12, y: 0.75, z: 31 }, { x: 0.76, y: 0, z: 0 }, { x: 0, y: -0.5, z: 7 }, (u, v) => {
    if (u < 0.04 || u > 0.96 || v < 0.05 || v > 0.95) return 0x2a1a24;
    if (Math.abs(u - 0.5) < 0.02) return 0x5a4a3a;
    // Columns of routes and dates, ruled in red.
    if (Math.abs(((u * 4) % 1) - 0.02) < 0.02) return RED_INK;
    if ((v * 14) % 1 < 0.3 && v > 0.1) return INK;
    // The offset ink: someone pressed a sheet over the last page.
    if (u > 0.55 && v > 0.55 && hash(Math.floor(u * 40), Math.floor(v * 40)) < 0.2) return 0x8a7a6a;
    return PARCHMENT;
  });
  // The chain, from the book's board to a staple in the lectern.
  for (let i = 0; i < 6; i++) m.box(0.86 - i * 0.02, 0.5 + i * 0.04, 30 - i * 3, 0.04, 0.04, 2, { top: IRON_LIGHT, left: IRON, right: IRON });
  return m;
}

/** The counting table (2 x 1): a chequered cloth, a counting board with its counters, stacks of coin, a little coin-balance and a candle. */
function countingTable(): IsoModel {
  const m = new IsoModel();
  const legs = { top: WOOD, left: WOOD, right: WOOD_DARK };
  for (const [x, y] of [[0.1, 0.12], [1.82, 0.12], [0.1, 0.8], [1.82, 0.8]]) m.box(x, y, 0, 0.08, 0.08, 26, legs);
  m.box(0, 0.05, 26, 2, 0.9, 3, {
    top: (u, v) => (Math.floor(u * 16) + Math.floor(v * 7)) % 2 ? BAIZE : BAIZE_DARK,
    left: (_u, v) => (v > 0.4 ? (Math.floor(_u * 32) % 2 ? BAIZE : BAIZE_DARK) : WOOD),
    right: BAIZE_DARK,
  });
  // The counting board: rods and beads.
  m.box(0.2, 0.2, 29, 0.7, 0.5, 1, { top: WOOD_LIGHT, left: WOOD, right: WOOD_DARK });
  for (let r = 0; r < 5; r++) {
    m.box(0.22, 0.26 + r * 0.09, 30, 0.66, 0.012, 0.6, { top: BRASS, left: BRASS_DARK, right: BRASS_DARK });
    for (let b = 0; b < 4; b++) m.cylinder(0.3 + ((b + r * 2) % 7) * 0.08, 0.265 + r * 0.09, 30, 0.025, 1.4, () => (b % 2 ? 0x8a2a1a : 0x1e1a16), b % 2 ? 0xa83a2a : 0x3a3430);
  }
  coins(m, 1.1, 0.3, 29, 6);
  coins(m, 1.22, 0.36, 29, 4);
  coins(m, 1.15, 0.58, 29, 3, true);
  // The little balance.
  m.box(1.5, 0.4, 29, 0.24, 0.18, 1, { top: WOOD_LIGHT, left: WOOD, right: WOOD_DARK });
  m.box(1.61, 0.48, 30, 0.02, 0.02, 8, { top: BRASS, left: BRASS, right: BRASS_DARK });
  m.box(1.48, 0.48, 37, 0.28, 0.02, 0.8, { top: BRASS_LIGHT, left: BRASS, right: BRASS_DARK });
  for (const x of [1.5, 1.73]) m.cylinder(x, 0.49, 33, 0.06, 0.6, () => BRASS, BRASS_LIGHT);
  candle(m, 1.8, 0.75, 29, 5);
  return m;
}

/** A charcoal brazier on legs, for the clerk's cold hands. */
function brazier(): IsoModel {
  const m = new IsoModel();
  for (const a of [0, 2.1, 4.2]) m.box(0.48 + Math.cos(a) * 0.14, 0.48 + Math.sin(a) * 0.14, 0, 0.04, 0.04, 12, { top: IRON_LIGHT, left: IRON, right: IRON });
  m.cylinder(0.5, 0.5, 12, 0.22, 5, (u) => (u < 0.35 ? IRON_LIGHT : IRON), (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.42) return IRON;
    return hash(Math.floor(u * 9), Math.floor(v * 9)) < 0.3 ? P.ember : hash(Math.floor(u * 7), Math.floor(v * 7) + 3) < 0.4 ? P.fireOrange : 0x3a2a24;
  });
  return m;
}

// ---------------------------------------------------------------- the office

/** The guildmaster's desk (2 x 1): letters in heaps, a seal and its wax, a decanter, spectacles, a candle, a locked letter-box. */
function bigDesk(): IsoModel {
  const m = new IsoModel();
  const pedestal: Shader = (u, v) => (v < 0.08 || u < 0.05 || u > 0.95 ? WOOD_DARK : (v * 3) % 1 < 0.06 ? WOOD_DARK : Math.abs(u - 0.5) < 0.08 && (v * 3) % 1 > 0.4 && (v * 3) % 1 < 0.55 ? BRASS_LIGHT : WOOD);
  m.box(0.08, 0.12, 0, 0.5, 0.76, 26, { top: WOOD_TOP, left: pedestal, right: WOOD_DARK });
  m.box(1.42, 0.12, 0, 0.5, 0.76, 26, { top: WOOD_TOP, left: pedestal, right: WOOD_DARK });
  m.box(0.02, 0.05, 26, 1.96, 0.9, 3, { top: (u, v) => (u > 0.3 && u < 0.7 && v > 0.2 && v < 0.8 ? 0x2a3a2a : WOOD_TOP), left: WOOD_LIGHT, right: WOOD });
  const z = 29;
  papers(m, 0.2, 0.2, z, 5, 21);
  papers(m, 0.65, 0.45, z, 2, 23);
  papers(m, 1.55, 0.25, z, 3, 25);
  // The seal, a stick of red wax, a candle to melt it.
  m.cylinder(1.05, 0.25, z, 0.04, 4, () => WOOD_DARK, BRASS);
  m.box(1.15, 0.2, z, 0.14, 0.03, 0.8, { top: RED_INK, left: 0x6a1414, right: 0x4a0e0e });
  candle(m, 1.3, 0.65, z, 5);
  // The decanter and a glass with a finger left in it.
  m.cylinder(1.75, 0.65, z, 0.07, 6, (u) => (u < 0.3 ? 0xc8a86a : 0x8a5a2a), 0x6a3a1a);
  m.cylinder(1.6, 0.75, z, 0.035, 2.4, (u) => (u < 0.3 ? GLASS_LIGHT : GLASS), 0x8a5a2a);
  // The letter-box, brass-bound, locked.
  m.box(0.25, 0.6, z, 0.3, 0.22, 4, { top: (u) => (Math.abs(u - 0.5) < 0.06 ? BRASS : 0x3a1a14), left: (u, v) => (Math.abs(u - 0.5) < 0.06 || v < 0.15 ? BRASS : 0x4a2018), right: 0x2a100c });
  // His spectacles, folded.
  for (const dx of [0, 0.07]) m.cylinder(0.95 + dx, 0.6, z, 0.03, 0.4, () => GOLD_DARK, GLASS_LIGHT);
  return m;
}

/** A leather armchair, buttoned, cracked at the arms. */
function armchair(): IsoModel {
  const m = new IsoModel();
  const leather = 0x5a2a1a;
  const leatherDark = 0x3a1a10;
  const leatherLight = 0x7a4228;
  const hide: Shader = (u, v) => (hash(Math.floor(u * 8), Math.floor(v * 6)) < 0.08 ? leatherLight : leather);
  for (const [x, y] of [[0.22, 0.22], [0.74, 0.22], [0.22, 0.74], [0.74, 0.74]]) m.box(x, y, 0, 0.05, 0.05, 6, { top: WOOD_DARK, left: WOOD, right: WOOD_DARK });
  m.box(0.15, 0.15, 6, 0.7, 0.7, 12, { top: hide, left: hide, right: leatherDark });
  for (const x of [0.12, 0.76]) m.box(x, 0.18, 18, 0.12, 0.66, 8, { top: leatherLight, left: hide, right: leatherDark });
  m.box(0.15, 0.12, 18, 0.7, 0.14, 26, { top: leatherLight, left: (u, v) => (Math.floor(u * 4) % 2 === 0 && Math.floor(v * 4) % 2 === 0 && (u * 4) % 1 < 0.2 ? BRASS : hide(u, v) ?? leather), right: leatherDark });
  return m;
}

/** A cabinet of shallow drawers for maps, brass-handled, a roll of charts lying on top and one sticking out. */
function mapCabinet(): IsoModel {
  const m = new IsoModel();
  m.box(0.08, 0.12, 0, 0.84, 0.7, 34, {
    top: WOOD_TOP,
    left: (u, v) => ((v * 6) % 1 < 0.08 || u < 0.04 || u > 0.96 ? WOOD_DARK : Math.abs(u - 0.5) < 0.07 && (v * 6) % 1 > 0.4 && (v * 6) % 1 < 0.6 ? BRASS_LIGHT : WOOD),
    right: WOOD_DARK,
  });
  m.cylinder(0.3, 0.45, 34, 0.06, 0.8, () => PARCHMENT_DARK, PARCHMENT);
  m.box(0.2, 0.2, 34, 0.6, 0.12, 1.2, { top: PARCHMENT, left: PARCHMENT_DARK, right: PARCHMENT_DARK });
  m.box(0.3, 0.82, 18, 0.4, 0.2, 1, { top: PARCHMENT, left: PARCHMENT_DARK, right: PARCHMENT_DARK });
  return m;
}

/** A small iron grate in the office, banked with coals. */
function grate(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0, 0, 0.8, 0.5, 36, {
    top: ASHLAR_DARK,
    left: (u, v) => (Math.abs(u - 0.5) < 0.3 && v > 0.4 ? (v > 0.9 ? 0x120c0a : SOOT) : ashlar(5, 3, 191)(u, v) ?? ASHLAR),
    right: (u, v) => darken(ashlar(5, 2, 193)(u, v) ?? ASHLAR, 0.72),
  });
  m.box(0.05, -0.02, 36, 0.9, 0.6, 3, { top: ASHLAR_LIGHT, left: ASHLAR, right: ASHLAR_DARK });
  m.box(0.3, 0.3, 2, 0.4, 0.25, 5, { top: (u, v) => (hash(Math.floor(u * 8), Math.floor(v * 4)) < 0.35 ? P.ember : 0x3a2a24), left: IRON, right: 0x2a2a30 });
  return m;
}

/** A small rug, deep blue with a gold border. */
function smallRug(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.1, z: 0 }, { x: 1.8, y: 0, z: 0 }, { x: 0, y: 1.8, z: 0 }, (u, v) => {
    const e = Math.min(u, 1 - u, v, 1 - v);
    if (e < 0.03) return 0x8a7a54;
    if (e < 0.1) return Math.floor((u + v) * 20) % 2 ? GOLD_DARK : BLUE_DARK;
    const c = Math.hypot(u - 0.5, v - 0.5) < 0.18 ? GOLD_DARK : BLUE;
    return mixColor(c, 0x5a5a5a, smoothNoise(u * 5, v * 5, 3) * 0.3);
  });
  return m;
}

/** Wet boot prints in from the Staithe. */
function bootPrints(seed: number): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(seed);
  const prints: Array<[number, number, number]> = [];
  for (let i = 0; i < 8; i++) prints.push([0.15 + i * 0.22 + rnd() * 0.05, 0.3 + (i % 2) * 0.35 + rnd() * 0.06, 0.2 + rnd() * 0.3]);
  m.quad({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const x = u * 2;
    for (const [px, py, a] of prints) {
      const dx = x - px;
      const dy = v - py;
      const along = dx * Math.cos(a) + dy * Math.sin(a);
      const across = -dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(along) < 0.1 && Math.abs(across) < 0.04 && !(Math.abs(along) < 0.015)) return 0x2e241a;
    }
    return null;
  });
  return m;
}

// ---------------------------------------------------------------- registry

function put(scene: Phaser.Scene, key: string, model: IsoModel, outline = true): void {
  registerModel(scene, key, model.render(outline));
}

export function generateGuildHall(scene: Phaser.Scene): void {
  // Outside, on the Staithe.
  put(scene, 'gh-guildhall', guildHall());
  put(scene, 'gd-bales', bales(false));
  put(scene, 'gd-bales-low', bales(true));
  // The walls.
  for (const kind of WALL_KINDS) {
    for (let i = 0; i < 2; i++) {
      guildWall(scene, 'back', kind, i);
      guildWall(scene, 'side', kind, i);
    }
  }
  put(scene, 'gd-wall-corner', cornerPost());
  // The meeting hall.
  const parts: Array<'w' | 'none' | 'e'> = ['w', 'none', 'none', 'none', 'none', 'e'];
  parts.forEach((end, i) => {
    put(scene, `gd-table-n-${i}`, tablePiece(i, end, 'n'));
    put(scene, `gd-table-s-${i}`, tablePiece((i + 3) % 6, end, 's'));
  });
  put(scene, 'gd-chair-n', chair('n'));
  put(scene, 'gd-chair-s', chair('s'));
  put(scene, 'gd-chair-s-pushed', chair('s', 0.12));
  put(scene, 'gd-chair-fallen', fallenChair());
  put(scene, 'gd-greatchair', greatChair());
  putHearth(scene);
  put(scene, 'gd-scales', scales());
  put(scene, 'gd-chest', chest());
  put(scene, 'gd-sideboard', sideboard());
  put(scene, 'gd-candlestand', candlestand());
  put(scene, 'gd-bench', bench(2));
  put(scene, 'gd-lectern', lectern());
  put(scene, 'gd-carpet', carpet(8, 4), false);
  put(scene, 'gd-prints', bootPrints(5), false);
  // The counting room.
  put(scene, 'gd-desk', clerkDesk());
  put(scene, 'gd-highstool', highStool());
  put(scene, 'gd-routebook', routeBook());
  put(scene, 'gd-countingtable', countingTable());
  put(scene, 'gd-brazier', brazier());
  // The office.
  put(scene, 'gd-bigdesk', bigDesk());
  put(scene, 'gd-armchair', armchair());
  put(scene, 'gd-cabinet', mapCabinet());
  put(scene, 'gd-grate', grate());
  put(scene, 'gd-rug', smallRug(), false);
  generateGuildFolk(scene);
}
