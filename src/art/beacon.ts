import Phaser from 'phaser';
import { TILE_HEIGHT } from '../config';
import { MODEL_ART, registerModel } from './interior';
import { IsoModel, planks, SEAT_TOP, Shader, TABLE_TOP } from './IsoModel';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';
import { smoothNoise } from './scorch';

/**
 * The old beacon on Corbie Tor, in the far north of Adowvale Plains (see
 * world/PlainsMap.ts and world/BeaconMap.ts): a great round tower of grey
 * stone like a lighthouse, tapering as it climbs, banded with string courses,
 * pierced by arrow slits that wind up round it, with a corbelled gallery and
 * battlements at the top and, on the roof, the iron brazier the watch lit to
 * warn the country below. It has stood cold for twelve years.
 *
 * Also: the knoll round it (boulders, heather, the warden's woodpile and the
 * ruin of his hut, a waymark cairn), the tower's ground floor where the
 * brigands have made their camp, and the roof with the brazier, against a
 * painted sky (BEACON_SKY) that shows the plains spread out below.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A colour darkened (or lightened, over 1) by `f`. */
function dim(c: number, f: number): number {
  const ch = (shift: number) => Math.max(0, Math.min(255, Math.round(((c >> shift) & 0xff) * f))) << shift;
  return ch(16) | ch(8) | ch(0);
}

/** Two colours mixed, `t` of the way from a to b. */
function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 0xff) * (1 - t) + ((b >> s) & 0xff) * t) << s;
  return ch(16) | ch(8) | ch(0);
}

// The tower's stone: a warmer, sandier grey than the north woods' watchtower, weathered and lichened.
const ST = 0x8a8478;
const ST_LIGHT = 0xaaa496;
const ST_PALE = 0xc4beae;
const ST_DARK = 0x625e58;
const ST_DEEP = 0x48444a;
const MORTAR = 0x3e3a3e;
const LICHEN = 0xb4a84a;
const LICHEN_PALE = 0xc8c48a;
const MOSS = 0x5f7d3c;
const MOSS_DARK = 0x3e5a2a;
const SOOT = 0x2a2626;
const IRON = 0x3a3a44;
const IRON_LIGHT = 0x5e5e6a;
const RUST = 0x7a3e22;
const OAK = 0x5a4028;
const OAK_DARK = 0x3a2818;
const OAK_LIGHT = 0x7a5838;
const SLIT = 0x141218;
const GLOW = 0xe8a040;
const GLOW_DIM = 0x9a5a2a;
const BLUE = 0x3e5680;
const BLUE_DARK = 0x2a3c5e;
const GOLD = 0xe6b54a;
const CHAR = 0x241e1e;
const CHAR_LIGHT = 0x3e3434;
const ASH = 0x8a8680;
const STRAW = 0xb89a58;
const HEATHER = 0x8a4a7a;
const HEATHER_LIGHT = 0xb070a0;
const HEATHER_DARK = 0x5a3050;

/** How tall the tower's shaft stands (pixels), before the gallery and battlements. */
export const TOWER_H = 286;
/** The tower's middle on its 4x4 footprint, and its radius at the foot and at the top, in tiles. */
const TC = 2;
const R0 = 1.72;
const R1 = 1.38;

const radiusAt = (z: number) => {
  // A battered plinth flaring out at the foot, then a steady taper.
  const flare = z < 26 ? 0.16 * (1 - z / 26) ** 1.5 : 0;
  return R0 - (R0 - R1) * (z / TOWER_H) + flare;
};

/** The arrow slits, winding up round the tower: the angle round (radians, 0 = +x) and the height of their middle. */
const SLITS: Array<[number, number]> = [
  [0.15 * Math.PI, 78], [0.42 * Math.PI, 132], [0.7 * Math.PI, 186], [0.05 * Math.PI, 214], [0.3 * Math.PI, 240], [0.62 * Math.PI, 96],
];
/** The door faces +y, down the path. */
const DOOR_A = Math.PI / 2;
const DOOR_W = 0.3;
const DOOR_H = 58;

/**
 * The tower's face at angle `a` (radians) and height `z` (pixels): dressed
 * courses of stone, two string courses, lichen and moss, soot streaked under
 * the top from years of fires, the arrow slits (glowing warm when someone keeps
 * a fire inside), and the door.
 */
function towerFace(a: number, z: number, occupied: boolean): number | null {
  const r = radiusAt(z);
  const arc = a * r * 32;
  // The door: an arched oak door with iron straps, in a deep stone surround with a keystone.
  const da = (a - DOOR_A) * r * 32;
  const archTop = DOOR_H - 12 + Math.sqrt(Math.max(0, (DOOR_W * 32 * 0.5) ** 2 - da * da)) * 1.2;
  if (Math.abs(da) < DOOR_W * 32 * 0.5 + 4 && z < archTop + 5 && z > 4) {
    if (Math.abs(da) > DOOR_W * 32 * 0.5 || z > archTop) {
      // The surround: big pale voussoirs, a keystone at the top.
      if (Math.abs(da) < 2.5 && z > archTop) return ST_PALE;
      return Math.floor((Math.atan2(z - (DOOR_H - 12), da) * 6) + 20) % 2 ? ST_PALE : ST_LIGHT;
    }
    if (z < 7) return ST_DEEP;
    // Oak planks, iron strap hinges, studs, a ring handle.
    const plank = Math.floor((da + 20) / 3.4);
    if (Math.abs(z - 20) < 1.4 || Math.abs(z - 44) < 1.4) return da < 4 ? IRON_LIGHT : IRON;
    if (Math.abs(da - 4) < 1.6 && Math.abs(z - 31) < 1.6) return Math.hypot(da - 4, z - 31) > 1 ? GOLD : OAK_DARK;
    if ((Math.floor(da + 20) % 4 === 0 && Math.floor(z) % 7 === 3)) return IRON_LIGHT;
    if ((da + 20) % 3.4 < 0.6) return OAK_DARK;
    return plank % 2 ? OAK : OAK_LIGHT;
  }
  // Two worn steps up to it.
  // Arrow slits: splayed openings, glowing within if a fire burns inside.
  for (const [sa, sz] of SLITS) {
    const dx = (a - sa) * r * 32;
    const dz = z - sz;
    if (Math.abs(dx) < 4.5 && Math.abs(dz) < 14) {
      if (Math.abs(dx) < 1.3 && Math.abs(dz) < 11) return occupied ? (Math.abs(dz) < 6 ? GLOW : GLOW_DIM) : SLIT;
      if (Math.abs(dx) < 4.5 && Math.abs(dz) > 11.5) return ST_PALE;
      if (Math.abs(dx) < 2.6 && Math.abs(dz) < 12) return dx < 0 ? ST_LIGHT : ST_DARK;
    }
  }
  // The string courses: a projecting band of paler stone, shadowed beneath.
  for (const band of [112, 204]) {
    if (z > band && z < band + 6) return z > band + 4 ? ST_PALE : ST_LIGHT;
    if (z > band - 3 && z <= band) return ST_DEEP;
  }
  // The plinth's top edge.
  if (z > 24 && z < 27) return ST_PALE;
  // Dressed courses: rows 8 high, blocks 16 long, staggered.
  const row = Math.floor(z / 8);
  const bx = arc + (row % 2) * 8 + hash(row, 3) * 6;
  const lz = z - row * 8;
  const lx = ((bx % 16) + 16) % 16;
  const n = smoothNoise(arc / 22, z / 26, 211);
  const block = hash(Math.floor(bx / 16), row);
  // Soot streaked down from the gallery, in long runs.
  const soot = z > TOWER_H - 70 && smoothNoise(arc / 6, 1, 7) > 0.55 + (TOWER_H - z) / 140;
  if (soot && lz > 1 && lx > 1) return hash(Math.floor(arc), Math.floor(z / 3)) < 0.5 ? SOOT : dim(ST_DARK, 0.7);
  // Moss creeping up from the foot, lichen in blooms on the weather side.
  if (z < 34 && n + (34 - z) / 60 > 0.78) return n > 0.82 ? MOSS : MOSS_DARK;
  const lich = smoothNoise(arc / 9, z / 9, 223);
  if (lich > 0.74 && block > 0.3) return lich > 0.82 ? LICHEN_PALE : LICHEN;
  if (lz < 1 || lx < 1) return MORTAR;
  if (lz < 2) return ST_PALE;
  if (block < 0.08) return ST_DARK;
  if (block > 0.92) return ST_PALE;
  return n > 0.66 ? ST_LIGHT : n < 0.3 ? ST_DARK : ST;
}

/** How a face catches the light from the upper left as it turns round: brightest towards -x+y. */
function shadeRound(c: number, a: number): number {
  const lit = Math.cos(a - Math.PI * 0.85) * 0.5 + 0.5;
  if (c === GLOW || c === GLOW_DIM || c === GOLD) return c;
  return dim(c, 0.62 + lit * 0.5);
}

/**
 * The beacon tower: a 4x4 footprint, the round shaft tapering up to a
 * corbelled gallery, battlements round the roof, and the iron brazier on its
 * stone column in the middle, piled with old charred wood, never lit since the
 * watch was turned off. A tattered blue pennon of the old watch on a pole.
 */
function beaconTower(occupied: boolean): IsoModel {
  const m = new IsoModel();
  const slices = 40;
  const from = -Math.PI / 4;
  const bands = 18;
  // The shaft: the near half, in bands up its height (each its own radius, so it tapers).
  for (let j = 0; j < bands; j++) {
    const z0 = (TOWER_H * j) / bands;
    const z1 = (TOWER_H * (j + 1)) / bands;
    const r0 = radiusAt(z0);
    const r1 = radiusAt(z1);
    for (let i = 0; i < slices; i++) {
      const a0 = from + (Math.PI * i) / slices;
      const a1 = from + (Math.PI * (i + 1)) / slices;
      const top = { x: TC + Math.cos(a0) * r1, y: TC + Math.sin(a0) * r1, z: z1 };
      const topB = { x: TC + Math.cos(a1) * r1, y: TC + Math.sin(a1) * r1, z: z1 };
      const bot = { x: TC + Math.cos(a0) * r0, y: TC + Math.sin(a0) * r0, z: z0 };
      m.quad(top, { x: topB.x - top.x, y: topB.y - top.y, z: 0 }, { x: bot.x - top.x, y: bot.y - top.y, z: z0 - z1 }, (u, v) => {
        const a = a0 + (a1 - a0) * u;
        const z = z1 - (z1 - z0) * v;
        const c = towerFace(a, z, occupied);
        return c === null ? null : shadeRound(c, a);
      });
    }
  }
  // Two worn steps up to the door.
  for (const [k, h] of [[0, 6], [1, 3]] as const) {
    const r = R0 + 0.2 + k * 0.16;
    const x = TC + Math.cos(DOOR_A) * r;
    const y = TC + Math.sin(DOOR_A) * r;
    m.box(x - 0.36, y - 0.12, 0, 0.72, 0.24, h, { top: (u) => (u < 0.1 ? ST : ST_PALE), left: (_u, v) => (v < 0.3 ? ST_LIGHT : ST), right: ST_DARK });
  }
  // The gallery: a corbel table under a wider ring, brackets with dark gaps between.
  const Rg = R1 + 0.2;
  const zg = TOWER_H;
  for (let i = 0; i < slices; i++) {
    const a0 = from + (Math.PI * i) / slices;
    const a1 = from + (Math.PI * (i + 1)) / slices;
    const p0 = { x: TC + Math.cos(a0) * Rg, y: TC + Math.sin(a0) * Rg, z: zg + 14 };
    const p1 = { x: TC + Math.cos(a1) * Rg, y: TC + Math.sin(a1) * Rg, z: zg + 14 };
    m.quad(p0, { x: p1.x - p0.x, y: p1.y - p0.y, z: 0 }, { x: 0, y: 0, z: -16 }, (u, v) => {
      const a = a0 + (a1 - a0) * u;
      const z = zg + 14 - v * 16;
      const arc = a * Rg * 32;
      if (z < zg + 6) {
        // The corbels: stepped brackets, gaps of shadow between them.
        const k = ((arc % 10) + 10) % 10;
        if (k > 6) return z < zg + 2 ? null : shadeRound(ST_DEEP, a);
        return shadeRound(z < zg + 2 ? ST_DARK : ST, a);
      }
      return shadeRound(z > zg + 12 ? ST_PALE : z > zg + 9 ? ST_LIGHT : ST, a);
    });
  }
  // The roof: the far battlements' inner face, the floor, the brazier, then the near battlements.
  const zf = zg + 14;
  const merlon = (arc: number) => ((arc % 18) + 18) % 18 < 10;
  const PH = 26;
  for (let i = 0; i < slices; i++) {
    const a0 = Math.PI * 0.75 + (Math.PI * i) / slices;
    const a1 = Math.PI * 0.75 + (Math.PI * (i + 1)) / slices;
    const rr = Rg - 0.1;
    const p0 = { x: TC + Math.cos(a0) * rr, y: TC + Math.sin(a0) * rr, z: zf + PH };
    const p1 = { x: TC + Math.cos(a1) * rr, y: TC + Math.sin(a1) * rr, z: zf + PH };
    m.quad(p0, { x: p1.x - p0.x, y: p1.y - p0.y, z: 0 }, { x: 0, y: 0, z: -PH }, (u, v) => {
      const a = a0 + (a1 - a0) * u;
      const z = zf + PH - v * PH;
      if (z > zf + 15 && !merlon(a * rr * 32)) return null;
      const row = Math.floor((z - zf) / 7);
      if ((z - zf) % 7 < 1) return MORTAR;
      return dim(hash(Math.floor(a * 20), row) < 0.2 ? ST_LIGHT : ST, 0.72);
    });
  }
  m.quad({ x: TC - Rg, y: TC - Rg, z: zf }, { x: Rg * 2, y: 0, z: 0 }, { x: 0, y: Rg * 2, z: 0 }, (u, v) => {
    const dx = u * 2 - 1;
    const dy = v * 2 - 1;
    if (dx * dx + dy * dy > 0.92) return null;
    // Flagstones, and a scatter of ash and old charcoal round the brazier's foot.
    const d = Math.hypot(dx, dy);
    if (d < 0.45 && hash(Math.floor(u * 40), Math.floor(v * 40)) < 0.4 * (1 - d / 0.45)) return hash(Math.floor(u * 33), Math.floor(v * 31)) < 0.5 ? ASH : CHAR_LIGHT;
    if (Math.floor(u * 8) % 2 === 0 && (u * 8) % 1 < 0.08) return MORTAR;
    if ((v * 8) % 1 < 0.08) return MORTAR;
    return hash(Math.floor(u * 8), Math.floor(v * 8)) < 0.3 ? ST_LIGHT : ST;
  });
  brazier(m, TC, TC, zf, 1);
  // The near battlements, with their crenels and a coping along the top.
  for (let i = 0; i < slices; i++) {
    const a0 = from + (Math.PI * i) / slices;
    const a1 = from + (Math.PI * (i + 1)) / slices;
    const p0 = { x: TC + Math.cos(a0) * Rg, y: TC + Math.sin(a0) * Rg, z: zf + PH };
    const p1 = { x: TC + Math.cos(a1) * Rg, y: TC + Math.sin(a1) * Rg, z: zf + PH };
    m.quad(p0, { x: p1.x - p0.x, y: p1.y - p0.y, z: 0 }, { x: 0, y: 0, z: -PH }, (u, v) => {
      const a = a0 + (a1 - a0) * u;
      const arc = a * Rg * 32;
      const z = zf + PH - v * PH;
      const inMerlon = merlon(arc);
      if (z > zf + 15 && !inMerlon) return null;
      const top = inMerlon ? zf + PH : zf + 15;
      if (top - z < 2) return shadeRound(ST_PALE, a);
      const row = Math.floor((z - zf) / 7);
      const bx = arc + (row % 2) * 6;
      if ((z - zf) % 7 < 1 || ((bx % 12) + 12) % 12 < 1) return shadeRound(MORTAR, a);
      const lich = smoothNoise(arc / 8, z / 8, 251);
      if (lich > 0.78) return shadeRound(LICHEN, a);
      return shadeRound(hash(Math.floor(bx / 12), row) < 0.25 ? ST_LIGHT : ST, a);
    });
  }
  // The old watch's pennon on its pole at the back of the roof, faded and tattered.
  const px = TC - 0.7;
  const py = TC - 0.75;
  m.box(px, py, zf, 0.06, 0.06, 74, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.quad({ x: px + 0.03, y: py, z: zf + 72 }, { x: 0.9, y: -0.25, z: -4 }, { x: 0, y: 0, z: -16 }, (u, v) => {
    // Tattered at the fly: ragged tails cut into it.
    const tail = u > 0.6 && Math.sin(v * 18) * 0.12 + 0.82 < u;
    if (tail || u > 0.97) return null;
    if (Math.abs(v - 0.5) < 0.09 && u > 0.08 && u < 0.7) return GOLD;
    return u < 0.08 ? BLUE_DARK : BLUE;
  });
  return m;
}

/**
 * The iron brazier on its stone column: a great flared basket of riveted bars
 * standing on four curled legs, packed with charred logs and old faggots and a
 * crust of ash. `k` scales it (1 on the tower in the plains, bigger on the roof map).
 */
function brazier(m: IsoModel, cx: number, cy: number, z0: number, k: number): void {
  // The column: a squat drum of dressed stone, with a moulded cap.
  const colH = 20 * k;
  m.cylinder(cx, cy, z0, 0.32 * k, colH, (u, v) => {
    const row = Math.floor(v * 3);
    if ((v * 3) % 1 < 0.08) return MORTAR;
    return dim(hash(Math.floor(u * 6), row) < 0.3 ? ST_LIGHT : ST, 0.7 + (1 - u) * 0.4);
  }, ST_PALE);
  m.cylinder(cx, cy, z0 + colH, 0.4 * k, 3 * k, (u) => dim(ST_PALE, 0.7 + (1 - u) * 0.35), ST_LIGHT);
  // The basket: flaring from its foot to its rim, bars and two bands, the wood inside showing between the bars.
  const zb = z0 + colH + 3 * k;
  const bh = 22 * k;
  const steps = 8;
  for (let j = 0; j < steps; j++) {
    const t0 = j / steps;
    const t1 = (j + 1) / steps;
    const rA = (0.32 + t0 * 0.36) * k;
    const rB = (0.32 + t1 * 0.36) * k;
    const slices = 28;
    // The far side first (seen through the bars), then the near.
    for (const far of [true, false]) {
      const start = far ? Math.PI * 0.75 : -Math.PI / 4;
      for (let i = 0; i < slices; i++) {
        const a0 = start + (Math.PI * i) / slices;
        const a1 = start + (Math.PI * (i + 1)) / slices;
        const top = { x: cx + Math.cos(a0) * rB, y: cy + Math.sin(a0) * rB, z: zb + bh * t1 };
        const topB = { x: cx + Math.cos(a1) * rB, y: cy + Math.sin(a1) * rB, z: zb + bh * t1 };
        const bot = { x: cx + Math.cos(a0) * rA, y: cy + Math.sin(a0) * rA, z: zb + bh * t0 };
        m.quad(top, { x: topB.x - top.x, y: topB.y - top.y, z: 0 }, { x: bot.x - top.x, y: bot.y - top.y, z: -(bh / steps) }, (u, v) => {
          const a = a0 + (a1 - a0) * u;
          const t = t1 - (t1 - t0) * v;
          const bar = ((a * 9 + 40) % 1) < 0.28;
          const band = Math.abs(t - 0.1) < 0.06 || Math.abs(t - 0.92) < 0.07;
          if (far) {
            // Inside: charred wood, ash.
            return hash(Math.floor(a * 30), Math.floor(t * 12)) < 0.5 ? CHAR : CHAR_LIGHT;
          }
          if (band) return t > 0.85 ? IRON_LIGHT : IRON;
          if (bar) return hash(Math.floor(a * 9), Math.floor(t * 5)) < 0.25 ? RUST : shadeRound(IRON_LIGHT, a);
          // Between the bars: the charred logs packed inside.
          return hash(Math.floor(a * 40), Math.floor(t * 16)) < 0.45 ? CHAR : hash(Math.floor(a * 13), Math.floor(t * 7)) < 0.3 ? OAK_DARK : CHAR_LIGHT;
        });
      }
    }
  }
  // The heap on top: black logs crossed, grey ash, a few old unburnt faggots.
  const rr = 0.66 * k;
  const zt = zb + bh;
  m.quad({ x: cx - rr, y: cy - rr, z: zt + 1 }, { x: rr * 2, y: 0, z: 0 }, { x: 0, y: rr * 2, z: 0 }, (u, v) => {
    const dx = u * 2 - 1;
    const dy = v * 2 - 1;
    const d = dx * dx + dy * dy;
    if (d > 1) return null;
    if (d > 0.84) return IRON_LIGHT;
    const log = Math.abs((u - v) * 4 % 1) < 0.35 || Math.abs((u + v) * 3 % 1) < 0.25;
    if (log) return hash(Math.floor(u * 20), Math.floor(v * 20)) < 0.3 ? OAK_DARK : CHAR;
    return hash(Math.floor(u * 24), Math.floor(v * 24)) < 0.5 ? ASH : 0x6a6660;
  });
  // A few logs poking up out of the heap.
  for (const [dx, dy, h] of [[-0.2, -0.1, 8], [0.15, 0.1, 6], [0, -0.25, 7]] as const) {
    m.box(cx + dx * k - 0.06 * k, cy + dy * k - 0.06 * k, zt, 0.12 * k, 0.12 * k, h * k, { top: OAK_LIGHT, left: CHAR, right: SOOT });
  }
  // Four curled iron legs from the basket's foot down to the column's cap, each with a rivet.
  for (const a of [Math.PI * 0.05, Math.PI * 0.55]) {
    const lx = cx + Math.cos(a) * 0.46 * k;
    const ly = cy + Math.sin(a) * 0.46 * k;
    m.box(lx - 0.03, ly - 0.03, z0 + colH, 0.06, 0.06, 8 * k, { top: IRON_LIGHT, left: IRON_LIGHT, right: IRON });
  }
}

// ---------------------------------------------------------------- the knoll round the tower

/** A clump of heather, purple in flower, painted on its tile. */
function heather(seed: number): PixelCanvas {
  const c = new PixelCanvas(40, 26);
  const rnd = seededRandom(seed);
  for (let i = 0; i < 70; i++) {
    const x = 6 + rnd() * 28;
    const base = 20 + rnd() * 4;
    const h = 4 + rnd() * 9 * (1 - Math.abs(x - 20) / 18);
    for (let y = 0; y < h; y++) {
      const px = Math.round(x + Math.sin(y * 0.6 + i) * 0.6);
      const py = Math.round(base - y);
      const tip = y > h - 3;
      c.set(px, py, tip ? (rnd() < 0.5 ? HEATHER_LIGHT : HEATHER) : y > h * 0.5 ? (rnd() < 0.3 ? HEATHER_DARK : 0x4a5a2e) : 0x3a4a26);
    }
  }
  c.outline();
  return c;
}

/** The warden's woodpile: split logs stacked between two posts, and a pile of faggots beside, greyed under a sagging canvas. */
function woodpile(): IsoModel {
  const m = new IsoModel();
  const wood = { top: OAK_LIGHT, left: OAK, right: OAK_DARK };
  m.box(0.1, 0.25, 0, 0.1, 0.1, 30, wood);
  m.box(1.75, 0.25, 0, 0.1, 0.1, 30, wood);
  // Log ends showing their rings along the front.
  m.box(0.2, 0.2, 0, 1.55, 0.6, 26, {
    top: (u) => (Math.floor(u * 9) % 2 ? 0x8a7a68 : 0x9a8a74),
    left: (u, v) => {
      const cx = (u * 1.55 * 32) % 7;
      const cy = (v * 26) % 6.5;
      const d = Math.hypot(cx - 3.5, cy - 3.2);
      if (d > 3.3) return OAK_DARK;
      return d < 1 ? 0xb8946a : Math.floor(d * 1.6) % 2 ? 0x9a7a52 : 0xc8a47a;
    },
    right: OAK_DARK,
  });
  // The sagging canvas thrown over the top.
  m.quad({ x: 0.05, y: 0.15, z: 30 }, { x: 1.85, y: 0, z: 0 }, { x: 0, y: 0.8, z: -6 }, (u, v) => (Math.sin(u * 14) * 0.08 + v > 0.95 ? null : smoothNoise(u * 4, v * 3, 41) > 0.6 ? 0x8a8470 : 0xa8a088));
  // Faggots of brushwood, bound with withies, leant against the end.
  for (let i = 0; i < 4; i++) {
    const x = 1.95 + (i % 2) * 0.18;
    const y = 0.3 + i * 0.14;
    m.quad({ x, y, z: 16 }, { x: 0.12, y: 0, z: -16 }, { x: 0, y: 0.16, z: 0 }, (u, v) => (Math.abs(u - 0.5) < 0.08 ? OAK_DARK : hash(Math.floor(v * 10), Math.floor(u * 6) + i) < 0.5 ? STRAW : 0x8a7240));
  }
  return m;
}

/** What's left of the warden's hut: two walls of dry stone, ragged and fallen to shoulder height, a roof beam down across the floor, rubble and nettles. */
function hutRuin(): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(451);
  const stone = (seed: number, shade: number): Shader => (u, v) => {
    const row = Math.floor(v * 6);
    const bx = u * 4 + (row % 2) * 0.5 + seed;
    if ((v * 6) % 1 < 0.14 || bx % 1 < 0.08) return dim(MORTAR, shade);
    if (v > 0.8 && hash(Math.floor(bx * 2), row + seed) < 0.5) return dim(MOSS_DARK, shade);
    return dim(hash(Math.floor(bx), row + seed) < 0.3 ? ST_LIGHT : hash(Math.floor(bx), row + seed) < 0.6 ? ST : ST_DARK, shade);
  };
  const top: Shader = (u, v) => (hash(Math.floor(u * 4), Math.floor(v * 3)) < 0.45 ? MOSS : ST_LIGHT);
  // The back wall along x, and the side wall along y: blocks of dry stone, ragged where the courses have fallen.
  const T = 0.3;
  for (let i = 0; i < 8; i++) {
    const h = Math.max(8, 40 - Math.abs(i - 2) * 6 - rnd() * 10);
    m.box(i * 0.32, 0, 0, 0.32, T, h, { top, left: stone(i, 1), right: stone(i + 3, 0.8) });
  }
  for (let i = 1; i < 6; i++) {
    const h = Math.max(6, 36 - i * 5 - rnd() * 8);
    m.box(0, i * 0.32, 0, T, 0.32, h, { top, left: stone(i + 7, 1), right: stone(i + 9, 0.8) });
  }
  // Fallen stones in front of them.
  for (let i = 0; i < 9; i++) {
    const x = 0.4 + rnd() * 2.0;
    const y = 0.4 + rnd() * 1.3;
    const s = 0.12 + rnd() * 0.12;
    m.box(x, y, 0, s, s * 0.8, 3 + rnd() * 4, { top: rnd() < 0.3 ? LICHEN : ST_LIGHT, left: ST, right: ST_DARK });
  }
  // The roof beam, fallen in across the floor and grey with weather.
  m.box(0.45, 0.7, 0, 1.9, 0.14, 5, { top: (u) => (hash(Math.floor(u * 20), 3) < 0.15 ? MOSS_DARK : 0x7a6e5e), left: 0x6a6050, right: 0x5a5244 });
  // Nettles where the hearth was.
  for (let i = 0; i < 14; i++) {
    const x = 0.5 + rnd() * 0.6;
    const y = 1.1 + rnd() * 0.5;
    m.box(x, y, 0, 0.04, 0.04, 6 + rnd() * 8, { top: 0x6a8a3a, left: 0x4a6a2a, right: 0x3a5a22 });
  }
  return m;
}

/** A waymark cairn of piled stones, with a slab on top carved with a flame: the beacon's mark. */
function cairn(): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(77);
  for (let layer = 0; layer < 5; layer++) {
    const r = 0.42 - layer * 0.06;
    for (let i = 0; i < 6 - layer; i++) {
      const a = (i / (6 - layer)) * Math.PI * 2 + layer;
      const x = 0.5 + Math.cos(a) * r * 0.6 - 0.12;
      const y = 0.5 + Math.sin(a) * r * 0.6 - 0.1;
      m.box(x, y, layer * 7, 0.24, 0.2, 7 + rnd() * 2, { top: rnd() < 0.3 ? LICHEN : ST_LIGHT, left: ST, right: ST_DARK });
    }
  }
  m.box(0.4, 0.42, 34, 0.16, 0.12, 22, {
    top: ST_PALE,
    left: (u, v) => {
      // The flame cut into its face.
      const dx = u - 0.5;
      const t = v;
      if (t > 0.2 && t < 0.75 && Math.abs(dx) < 0.3 * Math.sin((t - 0.2) / 0.55 * Math.PI) * (1 - t * 0.3)) return ST_DEEP;
      return v < 0.1 ? ST_PALE : ST_LIGHT;
    },
    right: ST_DARK,
  });
  return m;
}

// ---------------------------------------------------------------- inside: the ground floor

/** How tall the tower's walls stand inside (pixels; world/BeaconMap.ts gives the same). */
export const HALL_WALL_HEIGHT = 150;

type HallWallKind = 'plain' | 'slit' | 'sconce' | 'banner' | 'chart' | 'shelf' | 'hatch' | 'door' | 'hooks';
/** Along the back wall (x) and the side wall (y), from the corner. The side wall's doorway is at row 7. */
const HALL_BACK: HallWallKind[] = ['plain', 'shelf', 'chart', 'hooks', 'sconce', 'slit', 'plain', 'hatch', 'plain'];
const HALL_SIDE: HallWallKind[] = ['plain', 'banner', 'slit', 'plain', 'sconce', 'plain', 'slit', 'door', 'plain'];

/**
 * One segment of the hall's wall: dressed stone, warm in the firelight low
 * down and dark up under the floor above, with what hangs on it: the old watch
 * banner, a chart of the beacon chain scratched on the stone, torches burning
 * in their brackets, the brigands' hooks hung with cloaks and a crossbow.
 */
function hallWall(kind: HallWallKind, t0: number): Shader {
  const H = HALL_WALL_HEIGHT;
  return (u, v) => {
    const x = u * 32;
    const z = (1 - v) * H;
    const t = t0 + u;
    const dx = x - 16;
    // The beams of the floor above, across the top.
    if (z > H - 12) return z > H - 3 ? OAK_DARK : (Math.floor(t * 2) % 2 ? OAK : dim(OAK, 0.8));
    if (kind === 'slit' && z > 60 && z < 104) {
      const half = 1.4 + Math.min(z - 60, 104 - z, 8) * 0.5;
      if (Math.abs(dx) < 1.4) return z > 80 ? 0xb8ccd6 : 0x8aa0ae;
      if (Math.abs(dx) < half) return dx < 0 ? ST_LIGHT : ST_DARK;
    }
    if (kind === 'door') {
      const arch = 64 + Math.sqrt(Math.max(0, 121 - dx * dx)) * 1.3;
      if (Math.abs(dx) < 13 && z < arch + 5) {
        if (Math.abs(dx) > 11 || z > arch) return ST_PALE;
        // The door, standing open on the grass outside.
        if (dx > 4) return Math.floor(dx) % 3 ? OAK : OAK_DARK;
        if (z < 22) return hash(Math.floor(x), Math.floor(z)) < 0.5 ? P.grass : P.grassLight;
        if (z < 30) return P.grassDark;
        return z > 56 ? 0xd8e6ee : 0xb8ccd8;
      }
    }
    if (kind === 'hatch') {
      // The stair goes up through a square hole in the floor above: daylight from the roof.
      if (z > H - 40 && Math.abs(dx) < 12) return Math.abs(dx) > 10 || z < H - 38 ? OAK_DARK : z > H - 18 ? 0xe8eef0 : 0xc8d8e0;
    }
    if (kind === 'sconce') {
      // An iron bracket with a burning torch, soot blackening the stone above.
      if (Math.abs(dx) < 1.2 && z > 70 && z < 84) return IRON;
      if (Math.abs(dx) < 2.6 && z >= 84 && z < 92) return Math.abs(dx) > 1.6 ? IRON_LIGHT : OAK_DARK;
      if (z >= 92 && z < 104 && Math.abs(dx) < 3.6 - (z - 92) * 0.28) return z < 96 ? 0xfff4c0 : z < 100 ? P.gold : 0xe8783a;
      if (z >= 104 && z < 130 && Math.abs(dx) < 5 - (z - 104) * 0.12 && hash(Math.floor(x), Math.floor(z / 2)) < 0.65) return SOOT;
    }
    if (kind === 'banner') {
      // The old watch's banner: blue, a gold flame, its hem frayed; a pole across the top.
      if (z > 116 && z < 120 && Math.abs(dx) < 13) return OAK_LIGHT;
      if (z > 54 && z <= 116 && Math.abs(dx) < 11) {
        const fray = z < 60 && hash(Math.floor(x), 4) < 0.4;
        if (fray) return null;
        const fy = z - 88;
        const flame = Math.abs(dx) < (11 - Math.abs(fy) * 0.4) * Math.sin(Math.max(0, Math.min(1, (fy + 18) / 36)) * Math.PI) * 0.7;
        if (flame && fy > -18 && fy < 18) return fy > 4 ? 0xf7dc84 : GOLD;
        if (Math.abs(dx) > 9.5 || z > 112) return GOLD;
        return hash(Math.floor(x / 3), Math.floor(z / 5)) < 0.15 ? BLUE_DARK : BLUE;
      }
    }
    if (kind === 'chart') {
      // A chart of the beacon chain scratched into the stone: the fells along the top, five beacons joined by lines down to Adowvale.
      if (z > 50 && z < 120 && Math.abs(dx) < 15) {
        const pts: Array<[number, number]> = [[-10, 112], [-4, 98], [6, 92], [2, 74], [10, 58]];
        for (let i = 0; i < pts.length; i++) {
          const [px, pz] = pts[i];
          if (Math.hypot(dx - px, z - pz) < 2.2) return i === 1 ? 0xe8a040 : 0xd4cec0;
          const nx = pts[i + 1];
          if (nx) {
            const tt = Math.max(0, Math.min(1, ((dx - px) * (nx[0] - px) + (z - pz) * (nx[1] - pz)) / ((nx[0] - px) ** 2 + (nx[1] - pz) ** 2)));
            if (Math.hypot(dx - (px + (nx[0] - px) * tt), z - (pz + (nx[1] - pz) * tt)) < 0.6) return 0xb8b2a4;
          }
        }
        if (z > 116 && Math.abs(Math.sin(dx * 0.7) * 3 + 116 - z) < 0.7) return 0xb8b2a4;
      }
    }
    if (kind === 'shelf') {
      if (z > 70 && z < 74 && Math.abs(dx) < 14) return OAK_LIGHT;
      if (z >= 74 && z < 86) {
        // Jars, a bottle, a coil of rope.
        if (Math.abs(dx + 8) < 3) return z > 83 ? 0x8a6a4a : 0x6a8a5a;
        if (Math.abs(dx + 1) < 2 && z < 84) return 0x3a5a3a;
        if (Math.abs(dx - 8) < 4.5 && z < 82) return Math.floor((dx + z) * 0.8) % 2 ? STRAW : 0x8a7240;
      }
    }
    if (kind === 'hooks') {
      // Pegs hung with a cloak and a crossbow.
      if (z > 96 && z < 99 && Math.abs(dx) < 13) return OAK;
      if (dx < -2 && dx > -12 && z < 96 && z > 50 - Math.abs(dx + 7) * 1.5) return (Math.floor((dx + 20) * 0.7) % 2 ? 0x5a3a3a : 0x6a4646);
      if (dx > 2 && dx < 12 && z > 78 && z < 96) {
        if (Math.abs(z - 88) < 1) return OAK_DARK;
        if (Math.abs(dx - 7) < 1 && z > 80) return OAK;
        if (Math.abs(z - 86 - (dx - 7) * 0.2) < 0.8) return IRON_LIGHT;
      }
    }
    // Dressed courses of stone.
    const row = Math.floor(z / 9);
    const bx = t * 32 + (row % 2) * 8;
    const lz = z - row * 9;
    const lx = bx % 16;
    if (lz < 1 || lx < 1) return MORTAR;
    const n = smoothNoise(t * 3, z / 20, 301);
    // The firelight warms the stone low down; up under the beams it is dark.
    const warm = Math.max(0, 1 - z / H) * 0.25;
    const base = hash(Math.floor(bx / 16), row) < 0.12 ? ST_DARK : n > 0.62 ? ST_LIGHT : n < 0.3 ? ST_DARK : ST;
    const c = mix(base, 0xd88a4a, warm);
    if (lz < 2) return dim(c, 1.08);
    return dim(c, 0.78 + (1 - z / H) * 0.2);
  };
}

function makeHallWall(scene: Phaser.Scene, key: string, side: 'back' | 'side', kind: HallWallKind, index: number): void {
  const m = new IsoModel();
  const H = HALL_WALL_HEIGHT;
  const face = hallWall(kind, index);
  if (side === 'back') m.quad({ x: 0, y: 0, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, face);
  else m.quad({ x: 0, y: 0, z: H }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -H }, (u, v) => {
    const c = face(u, v);
    return c === null ? null : dim(c, 0.86);
  });
  registerModel(scene, key, m.render(false));
}

/** A flat thing lying on the floor, from a shader over its tile. */
function decal(shader: Shader, w = 1, h = 1): IsoModel {
  return new IsoModel().quad({ x: 0, y: 0, z: 0 }, { x: w, y: 0, z: 0 }, { x: 0, y: h, z: 0 }, shader);
}

/** A bedroll: a straw-stuffed tick under a rumpled blanket, `col` coloured, with a pack for a pillow. */
function bedroll(col: number, seed: number): IsoModel {
  const m = new IsoModel();
  m.box(0.15, 0.12, 0, 0.7, 1.7, 3, { top: STRAW, left: 0x8a7240, right: 0x7a6236 });
  m.quad({ x: 0.12, y: 0.55, z: 5 }, { x: 0.76, y: 0, z: 0 }, { x: 0, y: 1.3, z: -1 }, (u, v) => {
    const fold = Math.sin(u * 9 + v * 4 + seed) * 0.5 + 0.5;
    if (v < 0.08) return dim(col, 1.2);
    if (Math.abs((u * 4) % 1 - 0.5) < 0.05) return dim(col, 0.7);
    return fold > 0.75 ? dim(col, 1.15) : fold < 0.2 ? dim(col, 0.8) : col;
  });
  m.box(0.22, 0.12, 3, 0.56, 0.36, 7, { top: 0x7a6a4a, left: 0x6a5a3e, right: 0x5a4a32 });
  return m;
}

/** The brigands' table: a door laid on two barrels, dice and cups on it, a candle stuck in its own wax. */
function brigandTable(): IsoModel {
  const m = new IsoModel();
  for (const x of [0.15, 1.35]) m.cylinder(x + 0.25, 0.5, 0, 0.24, 22, (u, v) => (Math.abs(v - 0.2) < 0.05 || Math.abs(v - 0.8) < 0.05 ? IRON : dim(OAK_LIGHT, 0.8 + (1 - u) * 0.3)), OAK);
  const boards = planks(4, OAK_LIGHT, OAK_DARK, 0x9a7650, 11);
  m.box(0, 0.08, 22, 1.9, 0.84, 3, { top: (u, v) => (Math.abs(u - 0.5) < 0.02 ? IRON : boards(v, u)), left: OAK_DARK, right: OAK_DARK });
  // Dice, cups, a candle.
  m.box(0.5, 0.4, 25, 0.06, 0.06, 2.4, { top: 0xf0e8d8, left: 0xd8d0c0, right: 0xb8b0a0 });
  m.box(0.64, 0.52, 25, 0.06, 0.06, 2.4, { top: 0xf0e8d8, left: 0xd8d0c0, right: 0xb8b0a0 });
  m.cylinder(1.1, 0.35, 25, 0.08, 6, (u) => (u < 0.5 ? 0x9a9aa6 : 0x6a6a76), 0x3a2a22);
  m.cylinder(1.3, 0.62, 25, 0.08, 6, (u) => (u < 0.5 ? OAK_LIGHT : OAK), 0x5a3a22);
  m.cylinder(1.6, 0.35, 25, 0.06, 9, (u) => (u < 0.5 ? 0xf0e8d0 : 0xd0c8b0), 0xf0e8d0);
  m.quad({ x: 1.6, y: 0.35, z: 37 }, { x: 0.04, y: 0, z: 0 }, { x: 0, y: 0, z: -3 }, 0xfff4c0);
  // A coin or two.
  m.cylinder(0.9, 0.7, 25, 0.04, 0.6, () => GOLD, 0xf7dc84);
  return m.lower(22, 25 - TABLE_TOP);
}

/** A stool, a rough round of log on three legs. */
function stool(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.13, SEAT_TOP, (u) => dim(OAK, 0.8 + (1 - u) * 0.3), (u, v) => (Math.floor(Math.hypot(u - 0.5, v - 0.5) * 12) % 2 ? 0xb8946a : 0x9a7a52));
  return m;
}

/** What they've taken off the road: crates (one stencilled with Lord Morten's mark), sacks, a cask, a bolt of red cloth. */
function loot(): IsoModel {
  const m = new IsoModel();
  const crate = (x: number, y: number, z: number, s: number, mark: boolean) =>
    m.box(x, y, z, s, s, s * 30, {
      top: (u, v) => (u < 0.08 || u > 0.92 || v < 0.08 || v > 0.92 ? OAK_DARK : planks(3, OAK_LIGHT, OAK, 0x9a7650, x * 10)(u, v)),
      left: (u, v) => {
        if (u < 0.08 || u > 0.92 || v < 0.06 || v > 0.94 || Math.abs(u - v) < 0.06) return OAK_DARK;
        // Lord Morten's mark: a black tower in a ring, stencilled.
        if (mark && Math.hypot(u - 0.5, v - 0.5) < 0.22 && Math.hypot(u - 0.5, v - 0.5) > 0.17) return 0x2a2022;
        if (mark && Math.abs(u - 0.5) < 0.06 && v > 0.36 && v < 0.62) return 0x2a2022;
        return OAK_LIGHT;
      },
      right: (u, v) => (u < 0.08 || u > 0.92 || v < 0.06 || v > 0.94 ? OAK_DARK : OAK),
    });
  crate(0.05, 0.1, 0, 0.8, true);
  crate(0.95, 0.15, 0, 0.7, false);
  crate(0.2, 0.2, 24, 0.55, false);
  // Sacks slumped against them.
  for (const [x, y, s] of [[0.2, 1.1, 0.5], [0.75, 1.15, 0.45], [1.3, 1.0, 0.5]] as const) {
    m.cylinder(x + s / 2, y + s / 2, 0, s / 2, 16, (u, v) => (v < 0.15 ? 0x8a7a5a : Math.floor(u * 6 + v * 2) % 3 === 0 ? 0x9a8a68 : 0xb4a47e), 0x9a8a68);
  }
  // A bolt of red cloth on top.
  m.cylinder(1.3, 0.5, 21, 0.12, 4, () => 0xa8402e, 0x8a2e22);
  return m;
}

/** A cask on its side in a cradle, a spigot dripping. */
function cask(): IsoModel {
  const m = new IsoModel();
  m.box(0.15, 0.2, 0, 0.7, 0.1, 6, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.box(0.15, 0.7, 0, 0.7, 0.1, 6, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.quad({ x: 0.1, y: 0.2, z: 26 }, { x: 0.8, y: 0, z: 0 }, { x: 0, y: 0.6, z: -18 }, (u, v) => (Math.abs(u - 0.15) < 0.05 || Math.abs(u - 0.85) < 0.05 ? IRON : Math.floor(v * 8) % 2 ? OAK : OAK_LIGHT));
  m.quad({ x: 0.9, y: 0.2, z: 26 }, { x: 0, y: 0.6, z: 0 }, { x: 0, y: 0, z: -20 }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    if (d > 1) return null;
    if (d > 0.82) return IRON;
    return d < 0.2 ? OAK_DARK : Math.floor(u * 6) % 2 ? OAK : OAK_LIGHT;
  });
  return m;
}

/** A rack of weapons: spears, a bill and a sword, and the watch's old shields with the flame painted on them. */
function weaponRack(): IsoModel {
  const m = new IsoModel();
  const wood = { top: OAK_LIGHT, left: OAK, right: OAK_DARK };
  m.box(0.15, 0.08, 0, 0.1, 0.1, 54, wood);
  m.box(0.15, 1.8, 0, 0.1, 0.1, 54, wood);
  m.box(0.15, 0.08, 44, 0.1, 1.82, 4, wood);
  m.box(0.15, 0.08, 8, 0.1, 1.82, 4, wood);
  for (let i = 0; i < 5; i++) {
    const y = 0.3 + i * 0.32;
    const h = 66 + (i % 2) * 6;
    m.box(0.3, y, 0, 0.05, 0.05, h, { top: OAK_LIGHT, left: OAK_LIGHT, right: OAK });
    m.quad({ x: 0.3, y: y - 0.05, z: h + 12 }, { x: 0, y: 0.15, z: 0 }, { x: 0, y: 0, z: -12 }, (u, v) => {
      const w = Math.sin(Math.min(1, (1 - v) * 1.3) * Math.PI) * 0.5;
      if (Math.abs(u - 0.5) > w * 0.9 + (v > 0.85 ? 0.12 : 0)) return null;
      return u < 0.5 ? 0xd4d8e0 : 0x9a9ea8;
    });
  }
  // Two round shields leant at its foot, painted with the watch's flame.
  for (const [y, k] of [[0.35, 0], [1.2, 1]] as const) {
    m.quad({ x: 0.5, y, z: 22 }, { x: 0.05, y: 0.55, z: 0 }, { x: 0.12, y: 0, z: -22 }, (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5) * 2;
      if (d > 1) return null;
      if (d > 0.84) return IRON_LIGHT;
      if (d < 0.18) return IRON;
      const flame = Math.abs(u - 0.5) < 0.25 * Math.sin(Math.max(0, Math.min(1, 1.1 - v)) * Math.PI) && v > 0.15 && v < 0.85;
      return flame ? (k ? GOLD : 0xf7dc84) : k ? BLUE_DARK : BLUE;
    });
  }
  return m;
}

/** The hoist: a winch drum on a frame against the wall, its rope running up to the roof, a basket of faggots at its foot. */
function hoist(): IsoModel {
  const m = new IsoModel();
  const wood = { top: OAK_LIGHT, left: OAK, right: OAK_DARK };
  m.box(0.1, 0.1, 0, 0.1, 0.1, 40, wood);
  m.box(0.8, 0.1, 0, 0.1, 0.1, 40, wood);
  m.quad({ x: 0.2, y: 0.25, z: 40 }, { x: 0.6, y: 0, z: 0 }, { x: 0, y: 0.25, z: -10 }, (u) => (Math.floor(u * 12) % 2 ? STRAW : 0x9a7a3e));
  m.box(0.85, 0.3, 30, 0.2, 0.05, 2, { top: IRON_LIGHT, left: IRON, right: IRON });
  // The rope: up into the dark.
  m.box(0.48, 0.2, 40, 0.03, 0.03, 106, { top: STRAW, left: STRAW, right: 0x8a7240 });
  // A wicker basket of brushwood.
  m.cylinder(0.5, 0.65, 0, 0.3, 14, (u, v) => (Math.floor(u * 14 + v * 4) % 2 ? 0x9a7a3e : 0x7a5a2e), 0x5a4a2a);
  for (let i = 0; i < 6; i++) m.box(0.35 + i * 0.05, 0.55, 12, 0.03, 0.03, 10 + hash(i, 2) * 6, { top: STRAW, left: STRAW, right: 0x8a7240 });
  return m;
}

/** The stair: stone treads climbing the back wall from the left, up to the square hole in the floor above (over its right-hand end). */
function hallStair(): IsoModel {
  const m = new IsoModel();
  const steps = 9;
  for (let i = 0; i < steps; i++) {
    const x = 0.04 + i * 0.28;
    const z = i * 13;
    m.box(x, 0.02, 0, 0.3, 0.8, z + 11, {
      top: (u, v) => (v < 0.12 ? ST : hash(i, Math.floor(u * 4)) < 0.2 ? ST_LIGHT : ST_PALE),
      left: (_u, v) => (v * (z + 11) < 2 ? ST_PALE : Math.floor(v * (z + 11)) % 9 === 0 ? MORTAR : ST),
      right: (_u, v) => (Math.floor(v * (z + 11)) % 9 === 0 ? MORTAR : dim(ST_DARK, 0.9)),
    });
  }
  return m;
}

/** The warden's desk, and his chest beside it. */
function wardenDesk(): IsoModel {
  const m = new IsoModel();
  const wood = { top: OAK_LIGHT, left: OAK, right: OAK_DARK };
  m.box(0.1, 0.15, 0, 0.12, 0.6, 26, wood);
  m.box(1.7, 0.15, 0, 0.12, 0.6, 26, wood);
  m.box(0.05, 0.1, 26, 1.85, 0.72, 3, { top: planks(3, OAK_LIGHT, OAK_DARK, 0x9a7650, 3), left: OAK_DARK, right: OAK_DARK });
  // The warden's book open on it, an inkhorn, a guttered candle.
  const page = (u: number, v: number) => (Math.abs(u - 0.5) < 0.04 ? 0xb09e7c : Math.floor(v * 9) % 2 === 0 && u > 0.1 && u < 0.9 && Math.abs(u - 0.5) > 0.1 ? 0x6a5a4a : 0xe8dcc0);
  m.quad({ x: 0.5, y: 0.3, z: 29.5 }, { x: 0.6, y: 0, z: 0 }, { x: 0, y: 0.4, z: 0 }, page);
  m.cylinder(1.4, 0.4, 29, 0.06, 6, () => HORN_TONE, 0x2a2020);
  m.cylinder(1.65, 0.55, 29, 0.07, 4, () => 0xe8dcc0, 0xe8dcc0);
  return m.lower(26, 29 - TABLE_TOP);
}
const HORN_TONE = 0xd8c8a0;

/** A strongbox bound in iron, padlocked. */
function strongbox(): IsoModel {
  const m = new IsoModel();
  const bands = (u: number) => Math.abs(u - 0.2) < 0.06 || Math.abs(u - 0.8) < 0.06;
  m.box(0.18, 0.22, 0, 0.66, 0.5, 18, {
    top: (u) => (bands(u) ? IRON_LIGHT : OAK_LIGHT),
    left: (u, v) => (Math.abs(u - 0.5) < 0.06 && v > 0.15 && v < 0.45 ? GOLD : bands(u) ? IRON : v < 0.12 ? OAK_LIGHT : OAK),
    right: (u) => (bands(u) ? IRON : OAK_DARK),
  });
  return m;
}

/** The ring of stones round the brigands' fire, with a spit over it and a pot to one side. */
function firestones(): IsoModel {
  const m = decal((u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    if (d > 0.95) return null;
    const h = hash(Math.floor(u * 16), Math.floor(v * 16));
    return d > 0.72 ? (h < 0.5 ? ST_LIGHT : ST) : h < 0.3 ? SOOT : h < 0.6 ? ASH : CHAR_LIGHT;
  });
  return m;
}

// ---------------------------------------------------------------- the roof

/** How tall the battlements stand round the roof, inside (pixels). */
export const ROOF_WALL_HEIGHT = 46;

/** One segment of the roof's battlements, seen from inside: merlons with the sky in the crenels between. */
function roofWall(t0: number, side: boolean): Shader {
  const H = ROOF_WALL_HEIGHT;
  return (u, v) => {
    const t = t0 + u;
    const z = (1 - v) * H;
    const k = (t * 32) % 24;
    const merlon = k < 14;
    if (!merlon && z > 26) return null;
    const top = merlon ? H : 26;
    if (top - z < 3) return ST_PALE;
    const row = Math.floor(z / 8);
    const bx = t * 32 + (row % 2) * 7;
    if (z % 8 < 1 || bx % 14 < 1) return MORTAR;
    const lich = smoothNoise(t * 3, z / 10, 401);
    const c = lich > 0.76 ? LICHEN : z < 6 ? (hash(Math.floor(bx), 9) < 0.5 ? MOSS_DARK : ST_DARK) : hash(Math.floor(bx / 14), row) < 0.3 ? ST_LIGHT : ST;
    return side ? dim(c, 0.86) : c;
  };
}

function makeRoofWall(scene: Phaser.Scene, key: string, side: 'back' | 'side', index: number): void {
  const m = new IsoModel();
  const H = ROOF_WALL_HEIGHT;
  if (side === 'back') m.quad({ x: 0, y: 0, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, roofWall(index, false));
  else m.quad({ x: 0, y: 0, z: H }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -H }, roofWall(index, true));
  registerModel(scene, key, m.render(false));
}

/** A run of battlement at the roof's near edge, one tile long, along x (`alongX`) or y: its outer face and coping. */
function roofParapet(alongX: boolean, index: number): IsoModel {
  const m = new IsoModel();
  const H = 30;
  const shade = roofWall(index, !alongX);
  const T = 0.22;
  if (alongX) {
    m.box(0, 1 - T, 0, 1, T, H, {
      top: (u) => (((index + u) * 32) % 24 < 14 ? ST_PALE : ST_LIGHT),
      left: (u, v) => shade(u, 0.35 + v * 0.65) ?? ST,
      right: ST_DARK,
    });
  } else {
    m.box(1 - T, 0, 0, T, 1, H, {
      top: (_u, v) => (((index + v) * 32) % 24 < 14 ? ST_PALE : ST_LIGHT),
      left: ST,
      right: (u, v) => dim(shade(u, 0.35 + v * 0.65) ?? ST, 0.85),
    });
  }
  return m;
}

/** The roof's own brazier, close up: a 3x3 footprint, its column and basket bigger. */
function roofBrazier(): IsoModel {
  const m = new IsoModel();
  // A round stone dais under it, two steps.
  m.cylinder(1.5, 1.5, 0, 1.2, 4, (u) => dim(ST_LIGHT, 0.7 + (1 - u) * 0.35), (u, v) => (hash(Math.floor(u * 6), Math.floor(v * 6)) < 0.3 ? ASH : ST_PALE));
  m.cylinder(1.5, 1.5, 4, 0.85, 4, (u) => dim(ST_LIGHT, 0.7 + (1 - u) * 0.35), (u, v) => (hash(Math.floor(u * 9), Math.floor(v * 9)) < 0.35 ? ASH : ST_PALE));
  brazier(m, 1.5, 1.5, 8, 1.8);
  return m;
}

/** Faggots of brushwood stacked under an oiled cloth, ready for the brazier, and a cask of pitch. */
function roofFuel(): IsoModel {
  const m = new IsoModel();
  for (let i = 0; i < 6; i++) {
    const y = 0.1 + (i % 3) * 0.28;
    const z = Math.floor(i / 3) * 8;
    m.quad({ x: 0.1, y, z: z + 8 }, { x: 0.8, y: 0, z: 0 }, { x: 0, y: 0.26, z: -8 }, (u, v) => (Math.abs(u - 0.3) < 0.04 || Math.abs(u - 0.7) < 0.04 ? OAK_DARK : hash(Math.floor(u * 30), Math.floor(v * 4) + i) < 0.45 ? STRAW : 0x8a7240));
    m.quad({ x: 0.9, y, z: z + 8 }, { x: 0, y: 0.26, z: 0 }, { x: 0, y: 0, z: -8 }, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.45 ? (hash(Math.floor(u * 8), Math.floor(v * 8)) < 0.5 ? 0x7a6236 : STRAW) : null));
  }
  return m;
}

function pitchCask(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.3, 22, (u, v) => (Math.abs(v - 0.15) < 0.05 || Math.abs(v - 0.85) < 0.05 ? IRON : dim(OAK, 0.75 + (1 - u) * 0.3)), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.38 ? 0x141012 : OAK_DARK));
  // Pitch run down its side.
  m.quad({ x: 0.75, y: 0.6, z: 22 }, { x: 0, y: 0.08, z: 0 }, { x: 0, y: 0, z: -12 }, 0x141012);
  return m;
}

/** The warden's horn, hung on a post by the hatch. */
function hornPost(): IsoModel {
  const m = new IsoModel();
  m.box(0.45, 0.45, 0, 0.1, 0.1, 40, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.box(0.45, 0.35, 34, 0.1, 0.3, 2, { top: IRON_LIGHT, left: IRON, right: IRON });
  m.quad({ x: 0.5, y: 0.4, z: 34 }, { x: 0, y: 0.35, z: -8 }, { x: 0, y: 0, z: -4 }, (u) => (u > 0.85 ? GOLD : u < 0.2 ? 0x8a7a5a : HORN_TONE));
  return m;
}

/** The hatch down: a square hole in the roof, its trapdoor thrown back, the top of the stair below. */
const roofHatch = () =>
  decal((u, v) => {
    if (u < 0.12 || u > 0.88 || v < 0.12 || v > 0.88) return u < 0.12 || v < 0.12 ? OAK_DARK : ST_LIGHT;
    const step = Math.floor(v * 4);
    return step % 2 ? 0x1a161c : dim(ST_DARK, 0.6 + v * 0.3);
  });

// ---------------------------------------------------------------- the sky behind the roof

/** The view from the roof, painted: sky, clouds, the Greyfells to the north and the plains below. 1024 x 576. */
export const BEACON_SKY = 'bct-sky';

function paintSky(): PixelCanvas {
  const W = 1024;
  const H = 576;
  const c = new PixelCanvas(W, H);
  const horizon = 330;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (y < horizon) {
        // Sky: deep at the top, pale and a little warm towards the horizon, with soft clouds.
        const t = y / horizon;
        let col = mix(0x5a86b8, 0xd8e2e4, t * t);
        const cloud = smoothNoise(x / 90, y / 34, 501) * 0.7 + smoothNoise(x / 30, y / 14, 503) * 0.3;
        if (cloud > 0.6 - t * 0.1) col = mix(col, cloud > 0.72 ? 0xffffff : 0xe8eef2, Math.min(1, (cloud - 0.58) * 4) * 0.85);
        c.set(x, y, col);
      } else {
        // The plains far below: bands of green fading into haze, copses, a glint of the mere, the road.
        const t = (y - horizon) / (H - horizon);
        const n = smoothNoise(x / 40, y / 12, 511);
        let col = mix(0xb8c8b4, n > 0.6 ? 0x5e8a46 : 0x6e9a52, Math.min(1, t * 1.6));
        if (smoothNoise(x / 18, y / 8, 517) > 0.72) col = mix(col, 0x2e5a34, Math.min(1, t * 1.4));
        if (Math.abs(x - (512 + (y - horizon) * 0.9 + Math.sin(y / 30) * 20)) < 1 + t * 3) col = mix(col, 0xc8a878, Math.min(1, t * 2));
        const mere = Math.hypot((x - 760) / 70, (y - horizon - 90) / 14);
        if (mere < 1) col = mix(col, mere < 0.7 ? 0x8ab4d0 : 0x6a94b0, Math.min(1, t * 2 + 0.3));
        c.set(x, y, col);
      }
    }
  }
  // The Greyfells along the horizon: blue-grey ridges, nearer ones darker.
  for (const [base, amp, col, seed] of [[horizon - 30, 46, 0x8a96aa, 521], [horizon - 8, 30, 0x6e7c8e, 523], [horizon + 6, 18, 0x5a6e66, 527]] as const) {
    for (let x = 0; x < W; x++) {
      const top = base - smoothNoise(x / 120, 1, seed) * amp - smoothNoise(x / 30, 2, seed) * amp * 0.3;
      for (let y = Math.floor(top); y < base + 24; y++) {
        if (y < 0 || y >= H) continue;
        const shade = (y - top) / 40;
        c.set(x, y, mix(col, 0x3a4652, Math.min(0.5, shade * 0.4)));
      }
    }
  }
  return c;
}

/** Everything for the beacon: the tower, the knoll, the hall inside, the roof, and the sky behind it. */
export function generateBeacon(scene: Phaser.Scene): void {
  registerModel(scene, 'bcn-tower', beaconTower(true).render());
  registerModel(scene, 'bcn-tower-cold', beaconTower(false).render());
  for (let i = 0; i < 3; i++) {
    const c = heather(641 + i * 3);
    c.toTexture(scene, `bcn-heather-${i}`);
    // Stands on its tile: the tile's back corner is half a tile above its middle.
    MODEL_ART[`bcn-heather-${i}`] = { key: `bcn-heather-${i}`, originX: 0.5, originY: (22 - TILE_HEIGHT / 2) / c.height };
  }
  registerModel(scene, 'bcn-woodpile', woodpile().render());
  registerModel(scene, 'bcn-ruin', hutRuin().render());
  registerModel(scene, 'bcn-cairn', cairn().render());
  // Inside.
  HALL_BACK.forEach((k, i) => makeHallWall(scene, `bcn-wall-back-${i}`, 'back', k, i));
  HALL_SIDE.forEach((k, i) => makeHallWall(scene, `bcn-wall-side-${i}`, 'side', k, i));
  const corner = new IsoModel();
  corner.box(-0.12, -0.12, 0, 0.22, 0.22, HALL_WALL_HEIGHT, { top: OAK_DARK, left: ST, right: ST_DARK });
  registerModel(scene, 'bcn-corner', corner.render());
  registerModel(scene, 'bcn-bedroll-0', bedroll(0x6a3a3a, 1).render());
  registerModel(scene, 'bcn-bedroll-1', bedroll(0x3e5a4a, 2).render());
  registerModel(scene, 'bcn-bedroll-2', bedroll(0x5a5466, 3).render());
  registerModel(scene, 'bcn-bedroll-3', bedroll(0x7a6440, 4).render());
  registerModel(scene, 'bcn-table', brigandTable().render());
  registerModel(scene, 'bcn-stool', stool().render());
  registerModel(scene, 'bcn-loot', loot().render());
  registerModel(scene, 'bcn-cask', cask().render());
  registerModel(scene, 'bcn-rack', weaponRack().render());
  registerModel(scene, 'bcn-hoist', hoist().render());
  registerModel(scene, 'bcn-stair', hallStair().render());
  registerModel(scene, 'bcn-desk', wardenDesk().render());
  registerModel(scene, 'bcn-strongbox', strongbox().render());
  registerModel(scene, 'bcn-firestones', firestones().render(false));
  // The roof.
  for (let i = 0; i < 7; i++) {
    makeRoofWall(scene, `bct-wall-back-${i}`, 'back', i);
    makeRoofWall(scene, `bct-wall-side-${i}`, 'side', i);
    registerModel(scene, `bct-parapet-x-${i}`, roofParapet(true, i).render());
    registerModel(scene, `bct-parapet-y-${i}`, roofParapet(false, i).render());
  }
  const rc = new IsoModel();
  rc.box(-0.12, -0.12, 0, 0.24, 0.24, ROOF_WALL_HEIGHT, { top: ST_PALE, left: ST, right: ST_DARK });
  registerModel(scene, 'bct-corner', rc.render());
  const fc = new IsoModel();
  fc.box(0.78, 0.78, 0, 0.22, 0.22, 30, { top: ST_PALE, left: ST, right: ST_DARK });
  registerModel(scene, 'bct-parapet-corner', fc.render());
  registerModel(scene, 'bct-brazier', roofBrazier().render());
  registerModel(scene, 'bct-fuel', roofFuel().render());
  registerModel(scene, 'bct-pitch', pitchCask().render());
  registerModel(scene, 'bct-horn', hornPost().render());
  registerModel(scene, 'bct-hatch', roofHatch().render(false));
  paintSky().toTexture(scene, BEACON_SKY);
}
