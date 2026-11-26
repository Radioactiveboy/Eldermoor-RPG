import Phaser from 'phaser';
import { IsoModel, lipped, planks, Shader } from './IsoModel';
import { registerModel, WALL_HEIGHT } from './interior';
import { PALETTE as P } from './palette';
import { seededRandom } from './PixelCanvas';
import { mixColor, smoothNoise } from './scorch';
import { generatePawnFolk } from './pawnfolk3d';

/**
 * Lusk's, the pawnshop on the north-east corner of Gloomhaven's square (see
 * world/PawnshopMap.ts): three storeys of black boards, crammed to the rafters
 * with what the town has sold, pawned, lost and had stolen. Its walls (tarred
 * wainscot under flock wallpaper that was grand once and is now the colour of
 * liver, peeling, with goods hung on every inch: strangers' ancestors in gilt
 * frames, pans, a lute, coats on pegs, pigeonholes of pledge tickets, his
 * painted sign); the shop floor's grilled counter, the pledges behind it, a
 * rusty suit of armour, a moth-eaten bear, a heron under glass, a christening
 * font full of spoons, a wedding dress on a dummy, barrels of swords, chairs on
 * chairs; the counting room's desk and its two ledgers, the safe and the cat;
 * and under the roof, the Hooks' stash. Its people are drawn in pawnfolk3d.ts.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Tarred boards, almost black.
const TAR = 0x281e1c;
const TAR_DARK = 0x18110f;
const TAR_LIGHT = 0x3e2e28;
const TAR_WORN = 0x56402e;
// The wallpaper: oxblood flock with a gold trellis, faded to liver and dun, foxed with damp.
const PAPER = 0x5a2a26;
const PAPER_DARK = 0x3e1c1a;
const PAPER_LIGHT = 0x744036;
const FLOCK = 0x8a6a3a;
const FLOCK_DIM = 0x6a5030;
const FOX = 0x4a3a2a;
// Oak, for the counter and the desk.
const OAK = 0x4a3020;
const OAK_DARK = 0x30201a;
const OAK_LIGHT = 0x664530;
const OAK_TOP = 0x704a32;
// Metals.
const BRASS = 0xc8a048;
const BRASS_DARK = 0x8a6a2a;
const BRASS_LIGHT = 0xecd07a;
const PEWTER = 0x8a8a90;
const PEWTER_DARK = 0x5a5a62;
const PEWTER_LIGHT = 0xb4b4bc;
const RUST = 0x7a4a2e;
const IRON = 0x3e3e46;
const IRON_LIGHT = 0x6a6a74;
const IRON_DARK = 0x24242a;
// Glass, grimy.
const GLASS = 0x46564e;
const GLASS_DARK = 0x2a3634;
const GLASS_LIGHT = 0x8a9e92;
// Paper, bone, cloth.
const TICKET = 0xd8ccaa;
const TICKET_DARK = 0xa89a78;
const BONE = 0xe0d8c0;
const BONE_DARK = 0xb0a890;
const LINEN = 0xe8e0cc;
const LINEN_DARK = 0xb8ae98;
const SOOT = 0x1c1618;
const STONE = 0x7a7882;
const STONE_DARK = 0x54525c;
const STONE_LIGHT = 0x9a98a2;
const GOLD = P.gold;
const SILVER = 0xc8ccd4;

// ---------------------------------------------------------------- walls

export type PawnWallKind =
  | 'plain' | 'window' | 'door' | 'shelf' | 'hooks' | 'pictures' | 'tickets' | 'sign' | 'coats' | 'ledgers' | 'ious' | 'eaves' | 'eaves-window';

/** A tarred board running along its length (`along` in pixels, `across` 0..1). */
function board(along: number, across: number, seed: number): number {
  if (across < 0.12) return TAR_LIGHT;
  if (across > 0.88) return TAR_DARK;
  const g = Math.sin(along * 0.7 + Math.sin(along * 0.11 + seed) * 4 + across * 4);
  if (g > 0.88) return TAR_WORN;
  return hash(Math.floor(along / 4), seed) < 0.1 && g > 0.5 ? TAR_LIGHT : TAR;
}

/** The flock paper: a gold trellis with a fleuron in each lozenge, faded, foxed, peeling at the seams to the boards beneath. */
function paper(x: number, y: number, seed: number): number {
  // Lengths of paper 16 pixels wide; the seams lift and curl.
  const seam = x % 16;
  const peel = smoothNoise(x / 6 + seed, y / 9, seed + 3);
  if ((seam < 1.2 || seam > 14.8) && peel > 0.55) return seam < 1.2 ? TAR_DARK : PAPER_LIGHT;
  // Whole tongues of it fallen away, the boards showing.
  if (peel > 0.8 && smoothNoise(x / 3, y / 3, seed + 9) > 0.45) return board(y, (x % 8) / 8, seed + 1);
  const lu = ((x + y * 0.7) % 12) / 12;
  const lv = ((x - y * 0.7 + 240) % 12) / 12;
  let c = PAPER;
  if (lu < 0.1 || lv < 0.1) c = smoothNoise(x / 4, y / 4, seed) > 0.5 ? FLOCK : FLOCK_DIM;
  else if (Math.hypot(lu - 0.55, lv - 0.55) < 0.14) c = FLOCK_DIM;
  // Faded where the sun got it, darker low down; foxed in blotches; soot at the top.
  const n = smoothNoise(x / 10, y / 12, seed + 5);
  if (n > 0.66) c = mixColor(c, PAPER_LIGHT, 0.45);
  if (n < 0.28) c = mixColor(c, PAPER_DARK, 0.5);
  const fox = smoothNoise(x / 4 + 30, y / 4, seed + 7);
  if (fox > 0.76) c = mixColor(c, FOX, 0.55);
  const soot = Math.max(0, 1 - y / 26) * 0.6;
  if (soot > 0) c = mixColor(c, SOOT, soot);
  return c;
}

/** A little gilt frame with a stranger in it: `kind` picks who. */
function portrait(x: number, y: number, cx: number, cy: number, w: number, h: number, kind: number): number | null {
  const dx = x - cx;
  const dy = y - cy;
  if (Math.abs(dx) > w || Math.abs(dy) > h) return null;
  if (Math.abs(dx) > w - 1.4 || Math.abs(dy) > h - 1.4) return (Math.floor(x + y) % 3 === 0) ? BRASS_LIGHT : Math.abs(dx) > w - 0.7 ? BRASS_DARK : BRASS;
  // The sitter: a dark ground, a pale oval face, shoulders.
  const ground = kind === 1 ? 0x2a3a2e : kind === 2 ? 0x3a2a24 : 0x2a2632;
  const fy = cy - h * 0.25;
  const face = Math.hypot(dx / (w * 0.32), (y - fy) / (h * 0.3)) < 1;
  if (face) {
    // One of them has had the eyes cut out.
    if (kind === 2 && Math.abs(y - fy + 0.5) < 0.8 && Math.abs(Math.abs(dx) - w * 0.14) < 0.8) return 0x0e0a0a;
    return dx > 0 ? 0xc8a890 : 0xdcbca4;
  }
  const hair = Math.hypot(dx / (w * 0.4), (y - fy + h * 0.12) / (h * 0.36)) < 1 && y < fy;
  if (hair) return kind === 0 ? 0xb8b4b0 : 0x2a1c16;
  if (y > cy + h * 0.15 && Math.abs(dx) < w * (0.4 + (y - cy) / (h * 2.2))) return kind === 1 ? 0x2a2a3e : kind === 0 ? 0x4a2a2a : 0x1e1e1e;
  return ground;
}

function wallShader(kind: PawnWallKind, side: 'back' | 'side', index: number): Shader {
  const seed = index * 17 + (side === 'back' ? 5 : 11) + kind.length;
  const rnd = (a: number, b: number) => hash(a + seed * 3, b + index * 7);
  return (u, v) => {
    const x = u * 32;
    const y = v * WALL_HEIGHT;
    // Under the eaves (the top floor): raw boards, a rafter slanting across, cobwebs.
    if (kind === 'eaves' || kind === 'eaves-window') {
      if (y < 4) return TAR_DARK;
      if (kind === 'eaves-window' && Math.abs(x - 16) < 7 && y > 24 && y < 44) {
        if (Math.abs(x - 16) > 6 || y < 25 || y > 43) return TAR_DARK;
        if (Math.abs(x - 16) < 0.6 || Math.abs(y - 34) < 0.6) return TAR_DARK;
        return rnd(Math.floor(x), Math.floor(y / 2)) < 0.15 ? GLASS_LIGHT : smoothNoise(x / 3, y / 3, seed) > 0.6 ? GLASS : GLASS_DARK;
      }
      // Cobwebs in the corners of the boards.
      if (y < 20 && x > 22 && (x - 22) > y * 0.4 && rnd(Math.floor(x), Math.floor(y)) < 0.25) return 0x8a8a84;
      const c = board(x + index * 32, (y % 10) / 10, seed);
      return mixColor(c, 0x000000, 0.12 + Math.max(0, (20 - y) / 60));
    }
    // The frame: a cornice of black board at the top; a dado rail; tarred wainscot below.
    if (y < 5) return board(x + index * 32, y / 5, seed);
    if (y > WALL_HEIGHT - 3) return TAR_DARK;
    const dado = 52;
    if (y > dado && y < dado + 3) return y < dado + 1 ? TAR_WORN : TAR_LIGHT;
    const wainscot = y >= dado + 3;

    if (kind === 'window' && x > 6 && x < 27 && y > 14 && y < 46) {
      // A window of grimy little panes, and over it iron bars, rusted where they go into the frame.
      if (x < 8.5 || x > 24.5 || y < 16.5 || y > 43.5) return x < 8 ? TAR_LIGHT : TAR_DARK;
      const bar = (x - 9.5) % 5;
      if (bar < 1.2) return y > 40 || y < 19 ? RUST : bar < 0.6 ? IRON_LIGHT : IRON;
      if (Math.abs(y - 30) < 0.6) return IRON;
      if ((x - 8.5) % 8 < 0.6 || (y - 16.5) % 9 < 0.6) return TAR_DARK;
      const grime = smoothNoise(x / 3, y / 3, seed);
      if (rnd(Math.floor(x), Math.floor((y + x * 2) / 3)) < 0.08) return GLASS_LIGHT;
      return grime > 0.62 ? mixColor(GLASS, 0x6a5a3a, 0.5) : grime < 0.35 ? GLASS_DARK : GLASS;
    }
    if (kind === 'window' && x > 5 && x < 28 && y >= 46 && y < 49) return y < 47 ? TAR_WORN : TAR;

    if (kind === 'door' && x > 6 && x < 27 && y > 12) {
      // The street door: black planks, studded, three bolts and a chain on the inside, and a little bell on a spring.
      if (x < 8 || x > 25 || y < 14) return TAR_DARK;
      if ((Math.floor(x) - 8) % 6 === 0) return TAR_DARK;
      for (const by of [26, 44, 62]) if (Math.abs(y - by) < 1.4 && x > 18 && x < 24.5) return x > 23 ? IRON_LIGHT : IRON;
      if (Math.abs(x - 22) < 0.7 && y > 30 && y < 40) return (Math.floor(y) % 2) ? IRON_LIGHT : IRON; // the chain
      if (Math.abs(x - 10) < 1 && Math.abs(y - 50) < 2) return BRASS;
      if (Math.hypot(x - 22, y - 17) < 1.6) return BRASS_LIGHT; // the bell
      if ((Math.floor(x) - 10) % 6 === 0 && Math.floor(y) % 9 === 0) return PEWTER_LIGHT;
      return board(y, ((x - 8) % 6) / 6, seed + 9);
    }

    if (kind === 'shelf' && !wainscot) {
      // Two shelves of odds and ends: jugs, a clock, a candlestick, a skull, a stuffed owl, boots.
      for (const sy of [26, 46]) {
        if (y > sy && y < sy + 3) return y < sy + 1 ? OAK_LIGHT : OAK_DARK;
        if (y < sy && y > sy - 16) {
          const slot = Math.floor((x + index * 5) / 6.4);
          const lx = (x + index * 5) % 6.4;
          const k = Math.floor(rnd(slot, sy) * 7);
          const top = sy - 6 - rnd(slot, sy + 1) * 9;
          if (y < top || lx < 0.8 || lx > 5.8) continue;
          const lit = lx < 2.4;
          if (k === 0) return lit ? 0xc89a6a : 0x8a5a3a; // a jug
          if (k === 1) return Math.hypot(lx - 3.3, y - (top + 2.5)) < 2 ? (lit ? LINEN : BONE_DARK) : lit ? BRASS_LIGHT : BRASS; // a clock
          if (k === 2) return lx > 2.6 && lx < 4 ? (lit ? BRASS_LIGHT : BRASS) : paper(x + index * 32, y, seed); // a candlestick
          if (k === 3) return y < top + 4 ? (Math.abs(lx - 3.3) > 1 && Math.abs(y - top - 2) < 0.8 ? 0x1a1414 : BONE) : paper(x + index * 32, y, seed); // a skull
          if (k === 4) return lit ? 0x8a7a5a : 0x5a4a32; // an owl, stuffed
          if (k === 5) return lit ? 0x5a3a26 : 0x3a2418; // a boot
          return lit ? PEWTER_LIGHT : PEWTER; // a tankard
        }
      }
    }

    if (kind === 'hooks' && !wainscot) {
      // A rail of iron hooks, and on them: a copper pan, a lute with two strings, a bridle, a sword in its scabbard, a lantern.
      if (y > 10 && y < 12.5) return y < 11 ? IRON_LIGHT : IRON;
      const things: Array<[number, number, number, (dx: number, dy: number) => number | null]> = [
        [6, 13, 0, (dx, dy) => (Math.hypot(dx, dy - 9) < 5 ? (dx < -1 ? 0xd8885a : 0xa85a32) : Math.abs(dx) < 0.8 && dy < 5 ? 0x5a3a2a : null)],
        [16, 13, 1, (dx, dy) => {
          if (Math.abs(dx) < 0.7 && dy < 16) return dy < 3 ? 0x2a1a12 : 0x6a4428; // the neck
          if (Math.hypot(dx / 5, (dy - 22) / 6) < 1) return Math.hypot(dx, dy - 22) < 1.6 ? 0x1a1010 : dx < 0 ? 0xc0884a : 0x9a6a34; // the belly
          if (Math.abs(dx - 0.3) < 0.15 && dy > 2 && dy < 22) return LINEN; // a string
          return null;
        }],
        [25, 13, 2, (dx, dy) => (dy < 30 && Math.abs(dx - dy * 0.05) < 1.1 ? (dy < 6 ? BRASS : dx < 0 ? 0x4a3020 : 0x30201a) : null)],
      ];
      for (const [hx, hy, , paint] of things) {
        const col = paint(x - hx, y - hy);
        if (col !== null) return col;
      }
    }

    if (kind === 'pictures' && !wainscot) {
      // Somebody's ancestors, bought by the yard: gilt frames hung crooked, and one with the eyes cut out.
      const a = portrait(x, y, 9, 22, 6, 8, (index + 0) % 3);
      if (a !== null) return a;
      const b = portrait(x, y, 23, 18, 5, 6, (index + 1) % 3);
      if (b !== null) return b;
      const c = portrait(x, y, 22, 39, 4.5, 5.5, (index + 2) % 3);
      if (c !== null) return c;
      // Paler patches where pictures hung that have been sold.
      if (Math.abs(x - 10) < 4 && Math.abs(y - 42) < 5) return mixColor(paper(x + index * 32, y, seed), PAPER_LIGHT, 0.6);
    }

    if (kind === 'tickets' && !wainscot) {
      // Pigeonholes crammed with pledge tickets, each one somebody's ring or coat or wedding band.
      if (x > 3 && x < 29 && y > 10 && y < 50) {
        if (x < 4.5 || x > 27.5 || y < 11.5 || y > 48.5) return OAK_DARK;
        const cx = (x - 4.5) % 4.6;
        const cy = (y - 11.5) % 6.2;
        if (cx < 0.8 || cy < 0.8) return OAK;
        const cell = Math.floor((x - 4.5) / 4.6) * 13 + Math.floor((y - 11.5) / 6.2);
        const n = rnd(cell, 9);
        if (n < 0.15) return 0x120c0a;
        if (cy > 2.4 + n * 2) return cx < 1.6 ? 0x120c0a : 0x1e1612;
        // A ticket sticking out, its number scrawled.
        return Math.floor(cx * 2) % 3 === 0 && cy > 1.4 ? 0x5a4a3a : n > 0.6 ? TICKET : TICKET_DARK;
      }
    }

    if (kind === 'sign' && !wainscot) {
      // His painted board: A. LUSK, BOUGHT & SOLD, NO QUESTIONS, NO REFUNDS (the letters too small to read here; the hero reads it).
      if (x > 2 && x < 30 && y > 12 && y < 44) {
        if (x < 3.5 || x > 28.5 || y < 13.5 || y > 42.5) return BRASS_DARK;
        // Three brass balls at the top, like the one outside.
        for (const [bx, by] of [[11, 19], [16, 17], [21, 19]] as const) {
          const d = Math.hypot(x - bx, y - by);
          if (d < 2.4) return d < 1 && x < bx ? BRASS_LIGHT : x < bx ? BRASS : BRASS_DARK;
        }
        const line = (y - 24) % 5;
        if (y > 24 && y < 41 && line < 1.6 && x > 6 && x < 26 && rnd(Math.floor(x / 1.5), Math.floor((y - 24) / 5)) < 0.7) return y < 29 ? GOLD : 0xd8ccaa;
        return smoothNoise(x / 4, y / 4, seed) > 0.7 ? 0x24201c : 0x1a1614;
      }
    }

    if (kind === 'coats' && !wainscot) {
      // A rail of pegs, and coats and hats on them that nobody's come back for.
      if (y > 9 && y < 11.5) return OAK_LIGHT;
      for (const [cx, col, hat] of [[8, 0x3a4a5a, true], [17, 0x5a4a32, false], [26, 0x2a2a2a, true]] as const) {
        const dx = x - cx;
        const dy = y - 12;
        if (hat && dy < 0 && dy > -6 && Math.abs(dx) < (dy > -1.5 ? 5 : 2.6)) return dx < -1 ? 0x2a2a30 : 0x18181c;
        if (dy >= 0 && dy < 36 && Math.abs(dx) < 3 + dy * 0.12) {
          if (Math.abs(dx) < 0.6 && dy < 14) return mixColor(col, 0x000000, 0.4); // the opening
          if (dy > 6 && dy < 9 && Math.abs(dx) > 2) return mixColor(col, 0x000000, 0.25);
          const fold = Math.sin(dx * 1.6 + dy * 0.1);
          return fold > 0.5 ? mixColor(col, 0xffffff, 0.15) : fold < -0.5 ? mixColor(col, 0x000000, 0.3) : col;
        }
      }
    }

    if (kind === 'ledgers' && !wainscot) {
      // Shelves of ledgers, years of them, their spines lettered by year.
      for (const sy of [22, 37, 51]) {
        if (y > sy && y < sy + 2) return OAK_LIGHT;
        if (y <= sy && y > sy - 13) {
          const slot = Math.floor((x + index * 3) / 2.6);
          const lx = (x + index * 3) % 2.6;
          const n = rnd(slot, sy);
          if (y < sy - 9 - n * 3.5) return 0x120c0a;
          if (lx < 0.4) return 0x120c0a;
          const col = [0x5a2a1e, 0x2a3a2a, 0x3a2a1a, 0x1e2a3a, 0x4a3a1e][Math.floor(n * 5)];
          if (Math.abs(y - (sy - 5)) < 0.7) return GOLD;
          return lx < 1 ? mixColor(col, 0xffffff, 0.12) : col;
        }
      }
    }

    if (kind === 'ious' && !wainscot) {
      // Notes of hand pinned up by the dozen, overlapping, some with a hook drawn on in red.
      for (let i = 0; i < 9; i++) {
        const px = 3 + rnd(i, 1) * 22;
        const py = 10 + rnd(i, 2) * 30;
        const w = 5 + rnd(i, 3) * 3;
        const h = 6 + rnd(i, 4) * 3;
        if (x > px && x < px + w && y > py && y < py + h) {
          if (Math.abs(x - px - w / 2) < 0.6 && y < py + 1.2) return PEWTER_LIGHT;
          if (i % 3 === 0 && Math.abs(Math.hypot(x - px - w / 2, y - py - h / 2) - 1.4) < 0.4 && y > py + h / 2 - 0.5) return 0x9a1a1a;
          if ((y - py) % 1.6 < 0.5 && x > px + 0.8 && x < px + w - 0.8 && y > py + 1.6) return 0x5a4a3a;
          return i % 2 ? TICKET : LINEN;
        }
      }
    }

    if (wainscot) {
      // Tarred boards below the rail, kicked and scuffed.
      const plank = (x + index * 32) % 8;
      if (plank < 0.7) return TAR_DARK;
      if (rnd(Math.floor(x), Math.floor(y / 3)) < 0.05) return TAR_WORN;
      return board(y + Math.floor((x + index * 32) / 8) * 13, plank / 8, seed);
    }
    return paper(x + index * 32, y, seed);
  };
}

function pawnWall(scene: Phaser.Scene, side: 'back' | 'side', kind: PawnWallKind, index: number): void {
  const m = new IsoModel();
  const H = WALL_HEIGHT;
  const cap = 0.14;
  const shade = wallShader(kind, side, index);
  if (side === 'back') {
    m.quad({ x: 0, y: 0, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, shade);
    m.quad({ x: 0, y: -cap, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: cap, z: 0 }, lipped(TAR_LIGHT, TAR_WORN));
  } else {
    m.quad({ x: 0, y: 0, z: H }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -H }, (u, v) => {
      const c = shade(u, v);
      return c === null ? null : mixColor(c, 0x0e0a10, 0.22);
    });
    m.quad({ x: -cap, y: 0, z: H }, { x: cap, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, TAR_LIGHT);
  }
  registerModel(scene, `pw-wall-${side}-${kind}-${index}`, m.render(false));
}

function cornerPost(): IsoModel {
  const m = new IsoModel();
  m.box(-0.16, -0.16, 0, 0.3, 0.3, WALL_HEIGHT + 3, {
    top: TAR_LIGHT,
    left: (u, v) => board(v * 80, u, 4),
    right: (u, v) => mixColor(board(v * 80, u, 5), 0x000000, 0.3),
  });
  return m;
}

// ---------------------------------------------------------------- the floor

/** A Turkey rug, worn to the threads down a path from the door to the counter. */
function rug(w: number, h: number, seed: number): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.1, z: 0 }, { x: w - 0.2, y: 0, z: 0 }, { x: 0, y: h - 0.2, z: 0 }, (u, v) => {
    if (u < 0.03 || u > 0.97) return hash(Math.floor(u * 80), Math.floor(v * 60)) < 0.5 ? 0xb8a880 : null; // fringe
    const path = Math.abs(v - 0.5 - (u - 0.5) * 0.3) < 0.18 && smoothNoise(u * 10, v * 6, seed) > 0.35;
    const border = u < 0.1 || u > 0.9 || v < 0.12 || v > 0.88;
    let c: number;
    if (border) c = (Math.floor(u * w * 8) + Math.floor(v * h * 8)) % 3 === 0 ? 0x2a3a5a : 0x7a2a22;
    else {
      // Medallions of indigo and madder and gold on red.
      const mu = (u * w * 1.5) % 1;
      const mv = (v * h * 1.5) % 1;
      const d = Math.abs(mu - 0.5) + Math.abs(mv - 0.5);
      c = d < 0.18 ? 0xc8a050 : d < 0.28 ? 0x2a3a5a : d < 0.32 ? 0xd8c8a0 : 0x8a2a22;
    }
    if (path) c = mixColor(c, 0x5a4a3a, 0.55);
    return c;
  });
  return m;
}

/** Dust, fluff, a dropped ticket or two, and a trail of muddy boots from the door. */
function litter(seed: number): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(seed);
  const bits: Array<[number, number, number, number]> = [];
  for (let i = 0; i < 6; i++) bits.push([0.1 + rnd() * 1.7, 0.1 + rnd() * 0.8, rnd() * Math.PI, rnd()]);
  m.quad({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const x = u * 2;
    for (const [px, py, a, k] of bits) {
      const dx = x - px;
      const dy = v - py;
      const along = dx * Math.cos(a) + dy * Math.sin(a);
      const across = -dx * Math.sin(a) + dy * Math.cos(a);
      if (k < 0.5 && Math.abs(along) < 0.07 && Math.abs(across) < 0.04) return k < 0.25 ? TICKET : TICKET_DARK;
      if (k >= 0.5 && Math.abs(along) < 0.1 && Math.abs(across) < 0.04 && Math.abs(along) > 0.02) return 0x3a2a1e;
    }
    const dust = smoothNoise(x * 5, v * 5, seed);
    if (dust > 0.72 && hash(Math.floor(x * 50), Math.floor(v * 50)) < 0.4) return 0x6a5a4a;
    return null;
  });
  return m;
}

// ---------------------------------------------------------------- small things

function candle(m: IsoModel, x: number, y: number, z: number, h = 6): void {
  m.box(x - 0.025, y - 0.025, z, 0.05, 0.05, h, { top: P.fireYellow, left: LINEN, right: LINEN_DARK });
  m.box(x - 0.01, y - 0.01, z + h, 0.02, 0.02, 3, { top: P.fireYellow, left: P.fireOrange, right: P.fireYellow });
}

function candlestick(m: IsoModel, x: number, y: number, z: number, metal = BRASS): void {
  m.cylinder(x, y, z, 0.06, 1, () => metal, metal);
  m.cylinder(x, y, z + 1, 0.02, 9, (u) => (u < 0.35 ? BRASS_LIGHT : metal), metal);
  candle(m, x, y, z + 10, 5);
}

function coins(m: IsoModel, x: number, y: number, z: number, n = 3, silver = false): void {
  for (let i = 0; i < n; i++) m.cylinder(x + (i % 2) * 0.04, y + i * 0.025, z + i * 0.6, 0.04, 1, () => (silver ? PEWTER : 0xa8802e), silver ? SILVER : GOLD);
}

/** A pledge ticket tied on with string. */
function tag(m: IsoModel, x: number, y: number, z: number): void {
  m.box(x, y, z, 0.07, 0.01, 4, { top: TICKET, left: TICKET, right: TICKET_DARK });
}

function book(m: IsoModel, x: number, y: number, z: number, col: number, open = false): void {
  if (open) {
    m.box(x, y, z, 0.34, 0.24, 1.5, { top: (u, v) => (Math.abs(u - 0.5) < 0.03 ? 0x5a4a3a : (v * 12) % 1.6 < 0.5 && u > 0.06 && u < 0.94 && Math.abs(u - 0.5) > 0.06 ? 0x6a5a4a : LINEN), left: col, right: mixColor(col, 0x000000, 0.3) });
    return;
  }
  m.box(x, y, z, 0.22, 0.16, 3, { top: col, left: (_u, v) => (v > 0.3 && v < 0.7 ? LINEN : col), right: mixColor(col, 0x000000, 0.3) });
}

// ---------------------------------------------------------------- the counter

/** Oak panels gone black at the kick, and a brass rail. */
const counterFront: Shader = (u, v) => {
  if (v < 0.08 || v > 0.92) return OAK_DARK;
  const pu = (u * 2) % 1;
  if (pu < 0.08 || pu > 0.92 || v < 0.16 || v > 0.84) return OAK;
  if (v < 0.2) return OAK_DARK;
  if (v > 0.68 && hash(Math.floor(u * 40), Math.floor(v * 30)) < 0.18) return OAK_LIGHT;
  return pu < 0.16 ? OAK_LIGHT : OAK;
};
const counterFrontDark: Shader = (u, v) => {
  const c = counterFront(u, v);
  return c === null ? null : mixColor(c, 0x000000, 0.3);
};
const counterTop: Shader = (u, v) => {
  const base = planks(2, OAK_TOP, OAK_DARK, OAK_LIGHT, 7)(u, v) ?? OAK_TOP;
  if (Math.abs((u * 5 + v * 2) % 1.4 - 0.3) < 0.02) return OAK_DARK; // scratches where things are pushed across
  return base;
};

/** Iron bars up from the counter's front edge to a rail, with a gap at counter height to pass things through. */
function grille(m: IsoModel, along: 'x' | 'y', at: number, from: number, to: number, z: number): void {
  const H = 40;
  const bars: Shader = (u, v) => {
    const p = (u * (to - from) * 7) % 1;
    if (v < 0.06) return IRON_LIGHT;
    if (v > 0.74 && v < 0.78) return IRON;
    if (v > 0.78) return null; // the gap to pass things through
    return p < 0.22 ? (p < 0.1 ? IRON_LIGHT : IRON) : null;
  };
  if (along === 'x') m.quad({ x: from, y: at, z: z + H }, { x: to - from, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, bars);
  else m.quad({ x: at, y: from, z: z + H }, { x: 0, y: to - from, z: 0 }, { x: 0, y: 0, z: -H }, bars);
}

/** The counter along x, its grille over it, and something different on each length of it. */
function counterStraight(things: number): IsoModel {
  const m = new IsoModel();
  m.box(0, 0.22, 0, 1, 0.56, 26, { top: OAK_TOP, left: counterFront, right: counterFrontDark });
  m.box(0, 0.14, 26, 1, 0.72, 3, { top: counterTop, left: OAK_LIGHT, right: OAK });
  m.box(0, 0.82, 4, 1, 0.04, 2, { top: BRASS_LIGHT, left: BRASS, right: BRASS_DARK });
  if (things === 0) {
    // A brass bell to ring for service, and a dish of buttons.
    m.cylinder(0.3, 0.6, 29, 0.08, 1, () => OAK_DARK, OAK_DARK);
    m.cylinder(0.3, 0.6, 30, 0.07, 4, (u) => (u < 0.3 ? BRASS_LIGHT : BRASS), BRASS_LIGHT);
    m.cylinder(0.65, 0.55, 29, 0.12, 1, (u) => (u < 0.3 ? PEWTER_LIGHT : PEWTER), (u, v) => (hash(Math.floor(u * 9), Math.floor(v * 9)) < 0.5 ? 0x8a6a4a : BONE));
  } else if (things === 1) {
    // His scales, for rings and teeth and gold, and a jeweller's glass.
    m.box(0.35, 0.4, 29, 0.3, 0.15, 2, { top: OAK_DARK, left: OAK, right: OAK_DARK });
    m.box(0.48, 0.45, 31, 0.04, 0.04, 14, { top: BRASS_LIGHT, left: BRASS, right: BRASS_DARK });
    m.box(0.25, 0.45, 45, 0.5, 0.03, 1, { top: BRASS_LIGHT, left: BRASS, right: BRASS_DARK });
    for (const x of [0.28, 0.72]) m.cylinder(x, 0.47, 38, 0.08, 1, (u) => (u < 0.3 ? BRASS_LIGHT : BRASS), BRASS_LIGHT);
    coins(m, 0.28, 0.47, 39, 2);
    m.cylinder(0.78, 0.65, 29, 0.04, 2, () => IRON, GLASS_LIGHT);
  } else if (things === 2) {
    // The spike of paid tickets, a pen and inkhorn, and a ring on a cloth.
    m.box(0.25, 0.5, 29, 0.1, 0.1, 1, { top: OAK_DARK, left: OAK, right: OAK_DARK });
    m.box(0.29, 0.54, 30, 0.02, 0.02, 11, { top: IRON_LIGHT, left: IRON, right: IRON });
    for (let i = 0; i < 6; i++) m.box(0.24 - (i % 2) * 0.02, 0.5, 30 + i * 1.4, 0.12, 0.1, 0.6, { top: TICKET, left: TICKET_DARK, right: TICKET_DARK });
    m.cylinder(0.55, 0.62, 29, 0.04, 3, () => 0x2a2420, 0x0e0a0a);
    m.box(0.58, 0.6, 32, 0.02, 0.02, 6, { top: LINEN, left: LINEN, right: LINEN_DARK });
    m.box(0.68, 0.38, 29, 0.2, 0.16, 0.5, { top: 0x2a3a2a, left: 0x1e2a1e, right: 0x1e2a1e });
    m.cylinder(0.78, 0.46, 29.5, 0.03, 1, () => GOLD, GOLD);
  } else {
    // A cash drawer half open, and a cudgel laid along the top where he can reach it.
    m.box(0.2, 0.32, 29, 0.6, 0.06, 2, { top: 0x5a3a24, left: 0x4a2e1c, right: 0x3a2214 });
    m.box(0.15, 0.55, 29, 0.55, 0.08, 2.5, { top: (u) => (u > 0.75 ? 0x2a2a30 : 0x6a4428), left: 0x4a3018, right: 0x3a2412 });
  }
  grille(m, 'x', 0.22, 0, 1, 29);
  return m;
}

/** The counter running back along y to the wall. */
function counterSide(): IsoModel {
  const m = new IsoModel();
  m.box(0.22, 0, 0, 0.56, 1, 26, { top: OAK_TOP, left: counterFront, right: counterFrontDark });
  m.box(0.14, 0, 26, 0.72, 1, 3, { top: counterTop, left: OAK_LIGHT, right: OAK });
  grille(m, 'y', 0.22, 0, 1, 29);
  // A ledger of the week's pledges, open, held down with a horseshoe.
  book(m, 0.32, 0.3, 29, 0x3a2a1e, true);
  m.box(0.42, 0.62, 29, 0.14, 0.12, 1, { top: IRON_LIGHT, left: IRON, right: IRON_DARK });
  return m;
}

function counterCorner(): IsoModel {
  const m = new IsoModel();
  m.box(0.22, 0, 0, 0.56, 0.22, 26, { top: OAK_TOP, left: counterFront, right: counterFrontDark });
  m.box(0.22, 0.22, 0, 0.78, 0.56, 26, { top: OAK_TOP, left: counterFront, right: counterFrontDark });
  m.box(0.14, 0, 26, 0.72, 0.14, 3, { top: counterTop, left: OAK_LIGHT, right: OAK });
  m.box(0.14, 0.14, 26, 0.86, 0.72, 3, { top: counterTop, left: OAK_LIGHT, right: OAK });
  m.box(0.22, 0.82, 4, 0.78, 0.04, 2, { top: BRASS_LIGHT, left: BRASS, right: BRASS_DARK });
  grille(m, 'y', 0.22, 0, 0.22, 29);
  grille(m, 'x', 0.22, 0.22, 1, 29);
  // A glass case of rings and teeth on the corner.
  m.box(0.4, 0.4, 29, 0.42, 0.32, 5, {
    top: (u, v) => {
      if (u < 0.08 || u > 0.92 || v < 0.1 || v > 0.9) return BRASS;
      const ring = Math.abs(Math.hypot((u * 4) % 1 - 0.5, (v * 3) % 1 - 0.5) - 0.25) < 0.08;
      if (ring) return hash(Math.floor(u * 4), Math.floor(v * 3)) < 0.5 ? GOLD : SILVER;
      if ((u * 7) % 1 < 0.2 && v > 0.6) return BONE; // teeth
      return 0x2a1a24;
    },
    left: (u, v) => (v < 0.2 ? BRASS : u < 0.5 ? GLASS_LIGHT : GLASS),
    right: (_u, v) => (v < 0.2 ? BRASS_DARK : GLASS_DARK),
  });
  return m;
}

/** The end of the counter by the stairs: a hinged flap, folded up. */
function counterEnd(): IsoModel {
  const m = new IsoModel();
  m.box(0, 0.22, 0, 0.5, 0.56, 26, { top: OAK_TOP, left: counterFront, right: counterFrontDark });
  m.box(0, 0.14, 26, 0.5, 0.72, 3, { top: counterTop, left: OAK_LIGHT, right: OAK });
  m.box(0.5, 0.14, 26, 0.06, 0.72, 22, { top: OAK_LIGHT, left: (_u, v) => (v < 0.06 ? OAK_LIGHT : OAK), right: OAK_DARK });
  m.box(0.46, 0.4, 25, 0.12, 0.06, 2, { top: BRASS_LIGHT, left: BRASS, right: BRASS_DARK });
  grille(m, 'x', 0.22, 0, 0.5, 29);
  return m;
}

// ---------------------------------------------------------------- behind the counter

/** Pigeonholes and shelves of pledges: bundles in brown paper and string, a ticket on each, a fiddle case, a box of teeth. */
function pledges(): IsoModel {
  const m = new IsoModel();
  const H = 72;
  const front: Shader = (u, v) => {
    const x = u * 64;
    const y = v * H;
    if (x < 2 || x > 62 || y < 3) return OAK_DARK;
    const shelf = Math.floor((y - 3) / 17);
    const ly = (y - 3) % 17;
    if (ly < 2) return OAK_LIGHT;
    const slot = Math.floor(x / 9);
    const lx = x % 9;
    const n = hash(slot, shelf + 3);
    const top = 3 + n * 6;
    if (ly < top || lx < 0.8 || lx > 8.2) return 0x120c0a;
    // A ticket hanging off each.
    if (lx > 5.5 && lx < 7.5 && ly > top + 2 && ly < top + 6) return TICKET;
    if (Math.abs(lx - 4.5) < 0.4 || Math.abs(ly - (top + 8) % 15) < 0.4) return 0xc8b890; // string
    const col = n < 0.3 ? 0x8a6a44 : n < 0.55 ? 0x7a5a3a : n < 0.75 ? 0x5a3a2a : 0x3a3a4a;
    return lx < 2.5 ? mixColor(col, 0xffffff, 0.12) : col;
  };
  m.box(0.05, 0, 0, 1.9, 0.44, H, { top: OAK_LIGHT, left: front, right: OAK_DARK });
  // On top: a hatbox, a stuffed fox, a drum.
  m.cylinder(0.35, 0.22, H, 0.16, 10, (u) => (u < 0.3 ? 0xa86a6a : 0x7a4a4a), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0xc88a8a : 0x8a5a5a));
  m.box(0.8, 0.12, H, 0.45, 0.16, 9, { top: 0xc86a32, left: (u) => (u > 0.8 ? LINEN : 0xb85a28), right: 0x8a3a18 });
  m.box(1.18, 0.16, H + 7, 0.1, 0.08, 5, { top: 0xc86a32, left: 0xb85a28, right: 0x8a3a18 });
  m.cylinder(1.6, 0.22, H, 0.18, 8, (u, v) => (v < 0.12 || v > 0.88 ? 0xc8b890 : Math.abs(((u * 6) % 1) - v) < 0.06 ? 0xd8c8a0 : u < 0.3 ? 0xa8322a : 0x7a2018), LINEN);
  return m;
}

/** An iron safe, black and gold, the maker's name in flaking gilt, a dial, and a dent where somebody tried. */
function safe(big: boolean): IsoModel {
  const m = new IsoModel();
  const h = big ? 40 : 30;
  const door: Shader = (u, v) => {
    if (u < 0.08 || u > 0.92 || v < 0.06 || v > 0.94) return IRON_DARK;
    if (Math.abs(u - 0.12) < 0.03 || Math.abs(u - 0.88) < 0.03 || Math.abs(v - 0.12) < 0.02 || Math.abs(v - 0.88) < 0.02) return GOLD;
    if (Math.hypot(u - 0.5, (v - 0.42) * 1.4) < 0.12) return Math.hypot(u - 0.5, (v - 0.42) * 1.4) < 0.05 ? BRASS_LIGHT : BRASS;
    if (Math.abs(v - 0.7) < 0.04 && Math.abs(u - 0.5) < 0.2) return BRASS_DARK;
    if (Math.hypot(u - 0.72, v - 0.62) < 0.07) return IRON_LIGHT; // the dent
    return smoothNoise(u * 6, v * 6, 3) > 0.7 ? IRON_LIGHT : IRON;
  };
  m.box(0.12, 0.14, 0, 0.76, 0.72, 4, { top: IRON_DARK, left: IRON_DARK, right: IRON_DARK });
  m.box(0.15, 0.18, 4, 0.7, 0.64, h, { top: (u, v) => (u < 0.06 || u > 0.94 || v < 0.06 || v > 0.94 ? GOLD : IRON), left: door, right: (u, v) => (u < 0.05 || u > 0.95 || v < 0.05 || v > 0.95 ? GOLD : IRON_DARK) });
  if (big) {
    // A cash box and a candle on top.
    m.box(0.3, 0.3, h + 4, 0.3, 0.22, 5, { top: 0x2a3a2a, left: 0x1e2a1e, right: 0x141e14 });
    candle(m, 0.72, 0.4, h + 4, 8);
  }
  return m;
}

// ---------------------------------------------------------------- the shop's clutter

/** A suit of armour on a stand, rusted, the visor up and something nesting inside it. */
function armour(): IsoModel {
  const m = new IsoModel();
  const steel = (u: number, v: number) => (hash(Math.floor(u * 9), Math.floor(v * 14) + 7) < 0.3 ? RUST : u < 0.3 ? PEWTER_LIGHT : u > 0.7 ? PEWTER_DARK : PEWTER);
  m.box(0.25, 0.25, 0, 0.5, 0.5, 3, { top: OAK, left: OAK, right: OAK_DARK });
  for (const x of [0.38, 0.54]) m.box(x, 0.44, 3, 0.1, 0.12, 24, { top: PEWTER, left: steel, right: PEWTER_DARK });
  m.box(0.34, 0.4, 27, 0.32, 0.2, 6, { top: PEWTER, left: (u, v) => ((v * 6) % 1 < 0.2 ? PEWTER_DARK : steel(u, v)), right: PEWTER_DARK });
  m.box(0.3, 0.38, 33, 0.4, 0.24, 18, { top: PEWTER_LIGHT, left: (u, v) => (Math.abs(u - 0.5) < 0.04 ? PEWTER_LIGHT : steel(u, v)), right: (u, v) => mixColor(steel(u, v), 0x000000, 0.3) });
  for (const x of [0.2, 0.72]) {
    m.box(x, 0.42, 45, 0.12, 0.14, 7, { top: PEWTER_LIGHT, left: steel, right: PEWTER_DARK });
    m.box(x + 0.01, 0.43, 30, 0.08, 0.1, 15, { top: PEWTER, left: steel, right: PEWTER_DARK });
  }
  // The helm: a pot of steel with its visor up, a bird's nest of straw poking out.
  m.cylinder(0.5, 0.5, 51, 0.13, 12, (u, v) => (v > 0.35 && v < 0.55 && u > 0.3 && u < 0.7 ? 0x1a1414 : steel(u, v)), PEWTER_LIGHT);
  m.box(0.4, 0.55, 59, 0.2, 0.06, 3, { top: PEWTER_LIGHT, left: PEWTER, right: PEWTER_DARK });
  m.box(0.46, 0.62, 56, 0.08, 0.02, 2, { top: 0xc8a868, left: 0xb8985a, right: 0xa8884a });
  // A halberd leaning on it, its blade notched, a ticket on it.
  m.box(0.82, 0.3, 0, 0.04, 0.04, 70, { top: OAK_LIGHT, left: OAK_LIGHT, right: OAK });
  m.box(0.78, 0.26, 60, 0.04, 0.16, 12, { top: PEWTER_LIGHT, left: PEWTER, right: PEWTER_DARK });
  tag(m, 0.84, 0.36, 46);
  return m;
}

/** A bear, stuffed, rearing up with its paws out, moth-eaten, one glass eye gone, wearing somebody's hat. */
function bear(): IsoModel {
  const m = new IsoModel();
  const fur = (dark: boolean) => (u: number, v: number) => {
    const bald = smoothNoise(u * 5, v * 8, dark ? 3 : 4) > 0.74;
    if (bald) return dark ? 0x5a4a3a : 0x7a6a52;
    const tuft = hash(Math.floor(u * 14), Math.floor(v * 20)) < 0.25;
    return dark ? (tuft ? 0x2a1a12 : 0x3a281c) : tuft ? 0x6a4a30 : 0x50382a;
  };
  m.box(0.1, 0.1, 0, 0.8, 0.8, 4, { top: OAK_TOP, left: OAK, right: OAK_DARK });
  for (const x of [0.3, 0.56]) m.box(x, 0.4, 4, 0.16, 0.2, 16, { top: fur(false), left: fur(false), right: fur(true) });
  m.box(0.24, 0.32, 20, 0.52, 0.4, 30, { top: fur(false), left: fur(false), right: fur(true) });
  m.box(0.3, 0.4, 50, 0.4, 0.3, 10, { top: fur(false), left: fur(false), right: fur(true) });
  // Its arms, up, claws out.
  for (const [x, dx] of [[0.12, -0.04], [0.76, 0.04]] as const) {
    m.box(x, 0.5, 40, 0.14, 0.14, 18, { top: fur(false), left: fur(false), right: fur(true) });
    for (let i = 0; i < 3; i++) m.box(x + dx + i * 0.04, 0.6, 58, 0.02, 0.02, 3, { top: BONE, left: BONE, right: BONE_DARK });
  }
  // Its head, snarling, one eye gone.
  m.box(0.32, 0.42, 60, 0.36, 0.3, 14, { top: fur(false), left: (u, v) => {
    if (v > 0.25 && v < 0.4 && Math.abs(u - 0.3) < 0.07) return 0x0e0a08;
    if (v > 0.25 && v < 0.4 && Math.abs(u - 0.7) < 0.07) return 0x3a281c; // the eye that's gone
    return fur(false)(u, v);
  }, right: fur(true) });
  m.box(0.4, 0.68, 60, 0.2, 0.12, 7, { top: fur(false), left: (u, v) => (v > 0.6 ? (Math.floor(u * 6) % 2 ? BONE : 0x5a2a22) : v < 0.3 && Math.abs(u - 0.5) < 0.2 ? 0x1a1010 : fur(false)(u, v)), right: fur(true) });
  for (const x of [0.32, 0.6]) m.box(x, 0.46, 74, 0.08, 0.08, 4, { top: fur(false), left: fur(false), right: fur(true) });
  // A battered top hat, at an angle.
  m.cylinder(0.48, 0.55, 74, 0.2, 1, () => 0x1a1a1e, 0x24242a);
  m.cylinder(0.48, 0.55, 75, 0.12, 9, (u) => (u < 0.3 ? 0x34343a : 0x1a1a1e), 0x24242a);
  tag(m, 0.7, 0.7, 30);
  return m;
}

/** A grey heron under a glass dome on a little table, stuffed mid-step, a fish in its bill. */
function heron(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.05, 22, (u) => (u < 0.4 ? OAK_LIGHT : OAK), OAK);
  m.cylinder(0.5, 0.5, 22, 0.3, 3, (u) => (u < 0.3 ? OAK_LIGHT : OAK_DARK), OAK_TOP);
  // The bird: legs, body, neck kinked, the bill and its fish.
  m.box(0.46, 0.5, 25, 0.02, 0.02, 12, { top: 0x8a7a4a, left: 0x8a7a4a, right: 0x6a5a3a });
  m.box(0.54, 0.46, 25, 0.02, 0.02, 12, { top: 0x8a7a4a, left: 0x8a7a4a, right: 0x6a5a3a });
  m.box(0.4, 0.42, 37, 0.24, 0.14, 9, { top: 0xb8bcc4, left: (u, v) => (v > 0.6 ? 0x6a6e78 : u < 0.4 ? 0xc8ccd4 : 0x9a9ea8), right: 0x7a7e88 });
  m.box(0.58, 0.48, 44, 0.04, 0.04, 12, { top: 0xd8dce4, left: 0xc8ccd4, right: 0xa8acb4 });
  m.box(0.54, 0.46, 56, 0.1, 0.08, 4, { top: 0xd8dce4, left: (u, v) => (Math.abs(u - 0.4) < 0.15 && v < 0.5 ? 0x1a1a1a : 0xc8ccd4), right: 0xa8acb4 });
  m.box(0.64, 0.48, 57, 0.14, 0.02, 1.5, { top: 0xd8a848, left: 0xc89838, right: 0xa87828 });
  m.box(0.76, 0.47, 55, 0.06, 0.03, 3, { top: 0x9aa8a0, left: 0x8a9890, right: 0x6a7870 });
  // The dome, its glass catching the light, with a crack across it.
  m.cylinder(0.5, 0.5, 25, 0.26, 38, (u, v) => (Math.abs(u - 0.62 + v * 0.3) < 0.02 && v > 0.2 && v < 0.6 ? 0xffffff : u < 0.12 || (u > 0.18 && u < 0.22) ? 0xc8d8d0 : null), (u, v) => (Math.hypot(u - 0.4, v - 0.4) < 0.1 ? 0xe0f0e8 : null));
  return m;
}

/** A barrel stuffed with swords, umbrellas, a crutch, a fishing rod and a bishop's crook. */
function swordBarrel(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.3, 20, (u, v) => (Math.abs(v - 0.15) < 0.06 || Math.abs(v - 0.85) < 0.06 ? IRON : (u * 9) % 1 < 0.1 ? OAK_DARK : u < 0.3 ? OAK_LIGHT : OAK), OAK_DARK);
  const sticks: Array<[number, number, number, number, number, number]> = [
    // x, y, height, lean, colour, kind (0 a sword, 1 an umbrella, 2 a crutch, 3 a rod, 4 a crook)
    [0.38, 0.4, 30, -0.1, PEWTER, 0],
    [0.55, 0.38, 26, 0.05, 0x2a2a3a, 1],
    [0.64, 0.5, 34, 0.12, OAK_LIGHT, 2],
    [0.42, 0.58, 44, -0.04, 0x8a6a3a, 3],
    [0.58, 0.62, 38, 0.02, BRASS, 4],
    [0.48, 0.48, 28, 0, PEWTER_LIGHT, 0],
  ];
  for (const [x, y, h, lean, col, kind] of sticks) {
    const tx = x + lean;
    m.box(tx, y, 20, 0.03, 0.03, h, { top: col, left: col, right: mixColor(col, 0x000000, 0.3) });
    if (kind === 0) m.box(tx - 0.05, y - 0.01, 20 + h - 8, 0.13, 0.05, 1.5, { top: BRASS, left: BRASS, right: BRASS_DARK }); // a crossguard
    if (kind === 1) m.box(tx - 0.03, y - 0.03, 20 + h - 16, 0.09, 0.09, 12, { top: 0x2a2a3a, left: 0x34344a, right: 0x1e1e2a });
    if (kind === 2) m.box(tx - 0.07, y, 20 + h, 0.17, 0.04, 2, { top: OAK_LIGHT, left: OAK_LIGHT, right: OAK });
    if (kind === 4) m.box(tx, y, 20 + h, 0.1, 0.03, 5, { top: BRASS_LIGHT, left: BRASS, right: BRASS_DARK });
  }
  return m;
}

/** A long table piled with everything: candlesticks, a clock, plates, a stuffed squirrel, a skull, a box of spectacles, a crown that isn't. */
function junkTable(seed: number): IsoModel {
  const m = new IsoModel();
  const leg = { top: TAR, left: TAR_LIGHT, right: TAR_DARK };
  for (const [x, y] of [[0.12, 0.15], [1.82, 0.15], [0.12, 0.78], [1.82, 0.78]]) m.box(x, y, 0, 0.07, 0.07, 22, leg);
  m.box(0.05, 0.08, 22, 1.9, 0.84, 3, { top: planks(3, OAK_TOP, OAK_DARK, OAK_LIGHT, 3 + seed), left: OAK, right: OAK_DARK });
  // A fringed cloth thrown half over it.
  m.box(0.02, 0.05, 25, 0.9, 0.9, 0.5, { top: (u, v) => ((Math.floor(u * 8) + Math.floor(v * 8)) % 2 ? 0x4a2a3a : 0x5a3448), left: (u) => ((u * 20) % 1 < 0.5 ? 0x4a2a3a : null), right: 0x3a1e2a });
  if (seed === 0) {
    candlestick(m, 0.25, 0.3, 25.5);
    candlestick(m, 0.4, 0.25, 25.5, PEWTER);
    // A carriage clock, a stack of plates, a skull wearing spectacles.
    m.box(0.62, 0.5, 25.5, 0.2, 0.14, 12, { top: BRASS_LIGHT, left: (u, v) => (Math.hypot(u - 0.5, v - 0.45) < 0.28 ? (Math.hypot(u - 0.5, v - 0.45) < 0.04 ? 0x1a1414 : LINEN) : BRASS), right: BRASS_DARK });
    for (let i = 0; i < 5; i++) m.cylinder(1.12, 0.45, 25 + i * 1.2, 0.17, 1, () => (i % 2 ? 0xd8d0c0 : 0x5a7aa8), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0x5a7aa8 : 0xe8e0d0));
    m.box(1.4, 0.3, 25, 0.2, 0.17, 9, { top: BONE, left: (u, v) => (v > 0.3 && v < 0.55 && (u < 0.38 || u > 0.62) ? 0x1a1414 : v > 0.8 ? (Math.floor(u * 8) % 2 ? BONE : 0x1a1414) : BONE), right: BONE_DARK });
    m.box(1.38, 0.47, 30, 0.24, 0.02, 1, { top: BRASS, left: BRASS, right: BRASS_DARK });
    m.box(1.68, 0.6, 25, 0.18, 0.18, 4, { top: (u, v) => (Math.abs(((u * 4) % 1) - 0.5) < 0.3 && Math.abs(((v * 3) % 1) - 0.5) < 0.2 ? GLASS_LIGHT : 0x4a2a1e), left: 0x5a3424, right: 0x3a2014 });
    tag(m, 1.7, 0.6, 29);
  } else {
    // A squirrel in a waistcoat, a tin crown with glass jewels, a box of false teeth, a music box, an inkstand.
    m.box(0.3, 0.4, 25.5, 0.12, 0.1, 8, { top: 0x8a5a32, left: (_u, v) => (v > 0.4 && v < 0.75 ? 0x2a4a2a : 0x8a5a32), right: 0x6a4224 });
    m.box(0.24, 0.42, 25.5, 0.06, 0.14, 12, { top: 0xa86a3a, left: 0x9a5a2e, right: 0x7a4422 });
    m.cylinder(0.75, 0.5, 25.5, 0.13, 5, (u, v) => (v < 0.4 && (u * 6) % 1 < 0.5 ? null : Math.floor(u * 6) % 3 === 0 && v < 0.6 ? 0xc81a2a : u < 0.3 ? BRASS_LIGHT : BRASS), () => null);
    m.box(1.05, 0.35, 25.5, 0.24, 0.18, 3, { top: (u, v) => (v > 0.3 && v < 0.7 && (u * 10) % 1 < 0.6 ? BONE : 0xc8586a), left: OAK, right: OAK_DARK });
    m.box(1.4, 0.55, 25.5, 0.26, 0.2, 6, { top: (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.2 ? BRASS : 0x6a3a5a), left: (u) => (u < 0.1 || u > 0.9 ? BRASS : 0x5a2a4a), right: 0x3a1a2a });
    m.box(1.43, 0.45, 31.5, 0.2, 0.04, 6, { top: 0x6a3a5a, left: (u, v) => (Math.abs(u - 0.5) < 0.2 && Math.abs(v - 0.5) < 0.25 ? 0xe0c0d0 : 0x6a3a5a), right: 0x3a1a2a });
    candlestick(m, 1.8, 0.25, 25.5);
    tag(m, 0.7, 0.68, 28);
  }
  return m;
}

/** A stone christening font, the parish's name filed off its rim, full of spoons. */
function font(): IsoModel {
  const m = new IsoModel();
  const stone = (dark: boolean): Shader => (u, v) => {
    const n = smoothNoise(u * 8, v * 8, dark ? 2 : 1);
    const c = n > 0.7 ? STONE_LIGHT : n < 0.3 ? STONE_DARK : STONE;
    return dark ? mixColor(c, 0x000000, 0.3) : c;
  };
  m.box(0.28, 0.28, 0, 0.44, 0.44, 4, { top: STONE, left: stone(false), right: stone(true) });
  m.box(0.38, 0.38, 4, 0.24, 0.24, 14, { top: STONE, left: stone(false), right: stone(true) });
  m.box(0.2, 0.2, 18, 0.6, 0.6, 12, {
    top: (u, v) => {
      if (u > 0.12 && u < 0.88 && v > 0.12 && v < 0.88) {
        // Spoons, every way up.
        const s = (u * 9 + v * 4) % 1;
        if (hash(Math.floor(u * 9), Math.floor(v * 7)) < 0.65) return s < 0.4 ? SILVER : s < 0.6 ? PEWTER_LIGHT : PEWTER;
        return 0x2a2a30;
      }
      return STONE_LIGHT;
    },
    left: (u, v) => (v < 0.3 && u > 0.2 && u < 0.8 && hash(Math.floor(u * 30), 4) < 0.5 ? STONE_DARK : stone(false)(u, v)), // the filed-off name
    right: stone(true),
  });
  return m;
}

/** A dressmaker's dummy in a wedding dress, yellowed, its veil over the head that isn't there. */
function dummy(): IsoModel {
  const m = new IsoModel();
  m.box(0.4, 0.4, 0, 0.2, 0.2, 3, { top: OAK, left: OAK, right: OAK_DARK });
  m.box(0.48, 0.48, 3, 0.04, 0.04, 16, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  const silk = (dark: boolean): Shader => (u, v) => {
    const fold = Math.sin(u * 22 + v * 3);
    const yellowed = smoothNoise(u * 5, v * 6, 9) > 0.6;
    let c = fold > 0.5 ? 0xf0e8d0 : fold < -0.5 ? 0xc8bca0 : 0xe0d6bc;
    if (yellowed) c = mixColor(c, 0xb8a060, 0.3);
    if (v > 0.9) c = mixColor(c, 0x6a5a3a, 0.4); // the hem gone grey
    return dark ? mixColor(c, 0x000000, 0.25) : c;
  };
  // The skirt, flaring, and the bodice.
  m.cylinder(0.5, 0.5, 10, 0.3, 22, silk(false), 0xe0d6bc);
  m.cylinder(0.5, 0.5, 32, 0.16, 14, (u, v) => (v < 0.2 ? 0xd8c8a0 : silk(false)(u, v)), 0xe0d6bc);
  m.cylinder(0.5, 0.5, 46, 0.07, 4, () => 0x6a5a4a, 0x8a7a6a);
  // The veil, falling from nothing.
  m.cylinder(0.5, 0.5, 30, 0.2, 22, (u, v) => ((u * 30 + v * 9) % 1 < 0.35 ? 0xf8f4ec : null), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.2 ? 0xf8f4ec : null));
  tag(m, 0.78, 0.6, 22);
  return m;
}

/** Chairs stacked on chairs, legs in the air, one a child's high chair. */
function chairPile(): IsoModel {
  const m = new IsoModel();
  const chairAt = (x: number, y: number, z: number, upside: boolean, wood: number) => {
    const dk = mixColor(wood, 0x000000, 0.35);
    const lt = mixColor(wood, 0xffffff, 0.15);
    const legs: Array<[number, number]> = [[0, 0], [0.34, 0], [0, 0.34], [0.34, 0.34]];
    if (!upside) {
      for (const [dx, dy] of legs) m.box(x + dx, y + dy, z, 0.05, 0.05, 15, { top: lt, left: wood, right: dk });
      m.box(x - 0.02, y - 0.02, z + 15, 0.43, 0.43, 2, { top: lt, left: wood, right: dk });
      m.box(x - 0.02, y - 0.02, z + 17, 0.05, 0.43, 18, { top: lt, left: (u) => ((u * 4) % 1 < 0.5 ? wood : null), right: dk });
    } else {
      m.box(x - 0.02, y - 0.02, z, 0.43, 0.43, 2, { top: lt, left: wood, right: dk });
      for (const [dx, dy] of legs) m.box(x + dx, y + dy, z + 2, 0.05, 0.05, 15, { top: lt, left: wood, right: dk });
    }
  };
  chairAt(0.12, 0.12, 0, false, 0x5a3a24);
  chairAt(0.5, 0.45, 0, false, 0x3a2a1e);
  chairAt(0.18, 0.2, 17, true, 0x6a4a2e);
  chairAt(0.48, 0.48, 17, true, 0x7a5232);
  // The high chair, on top of it all, tray and all.
  m.box(0.3, 0.34, 36, 0.3, 0.3, 2, { top: 0x8a6a42, left: 0x7a5a36, right: 0x5a4024 });
  for (const [dx, dy] of [[0, 0], [0.24, 0], [0, 0.24], [0.24, 0.24]]) m.box(0.33 + dx, 0.37 + dy, 38, 0.04, 0.04, 12, { top: 0x8a6a42, left: 0x7a5a36, right: 0x5a4024 });
  m.box(0.3, 0.34, 50, 0.32, 0.32, 2, { top: 0x8a6a42, left: 0x7a5a36, right: 0x5a4024 });
  return m;
}

/** A tall glass in a gilt frame, cracked right across; whoever looks in it sees two of themselves. */
function mirror(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.4, 0, 0.8, 0.14, 3, { top: OAK_DARK, left: OAK, right: OAK_DARK });
  m.quad({ x: 0.12, y: 0.47, z: 66 }, { x: 0.76, y: -0.1, z: 0 }, { x: 0.02, y: 0.02, z: -62 }, (u, v) => {
    if (u < 0.06 || u > 0.94 || v < 0.04 || v > 0.97) return (Math.floor(u * 40 + v * 60) % 3 === 0) ? BRASS_LIGHT : BRASS;
    if (Math.abs(v - (0.3 + u * 0.5)) < 0.012) return 0xf0f4f0; // the crack
    if (Math.abs(v - (0.62 - u * 0.2)) < 0.008 && u > 0.5) return 0xe0e8e0;
    const sheen = (u * 2 + v) % 1;
    if (sheen < 0.06) return 0xc8d4cc;
    return smoothNoise(u * 4, v * 6, 5) > 0.65 ? 0x7a8a84 : 0x5a6a66;
  });
  return m;
}

/** A harp with half its strings gone, leaning in the corner. */
function harp(): IsoModel {
  const m = new IsoModel();
  m.box(0.3, 0.3, 0, 0.4, 0.3, 4, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.box(0.32, 0.42, 4, 0.08, 0.08, 56, { top: GOLD, left: BRASS, right: BRASS_DARK }); // the pillar
  m.box(0.6, 0.36, 4, 0.1, 0.16, 40, { top: OAK_LIGHT, left: (u, v) => (v > 0.1 && Math.abs(u - 0.5) < 0.15 && (v * 10) % 1 < 0.2 ? 0x1a1010 : 0x8a5a32), right: 0x6a4224 }); // the soundbox
  m.box(0.34, 0.44, 56, 0.36, 0.06, 6, { top: GOLD, left: BRASS, right: BRASS_DARK }); // the neck
  m.quad({ x: 0.4, y: 0.46, z: 56 }, { x: 0.24, y: 0, z: -14 }, { x: 0, y: 0, z: -36 }, (u, v) => ((u * 14) % 1 < 0.14 && hash(Math.floor(u * 14), 2) < 0.5 && v < 0.98 ? 0xe8e0c0 : null));
  return m;
}

/** A long-case clock, stopped at a quarter past three, its pendulum still. */
function clock(): IsoModel {
  const m = new IsoModel();
  const wood = (dark: boolean): Shader => (u, v) => {
    const g = Math.sin(v * 60 + Math.sin(u * 9) * 3);
    const c = g > 0.8 ? OAK_LIGHT : g < -0.85 ? OAK_DARK : 0x5a3424;
    return dark ? mixColor(c, 0x000000, 0.3) : c;
  };
  m.box(0.2, 0.18, 0, 0.6, 0.5, 8, { top: OAK, left: wood(false), right: wood(true) });
  m.box(0.26, 0.24, 8, 0.48, 0.4, 44, {
    top: OAK,
    left: (u, v) => {
      if (u > 0.2 && u < 0.8 && v > 0.15 && v < 0.85) {
        if (u < 0.25 || u > 0.75 || v < 0.2 || v > 0.8) return BRASS_DARK;
        if (Math.abs(u - 0.5) < 0.03 && v < 0.65) return BRASS; // the pendulum rod
        if (Math.hypot(u - 0.5, (v - 0.68) * 2) < 0.1) return BRASS_LIGHT;
        return GLASS_DARK;
      }
      return wood(false)(u, v);
    },
    right: wood(true),
  });
  m.box(0.2, 0.18, 52, 0.6, 0.5, 20, {
    top: OAK,
    left: (u, v) => {
      const d = Math.hypot(u - 0.5, (v - 0.5) * 1.1);
      if (d < 0.36) {
        if (d > 0.33) return BRASS;
        // A quarter past three.
        const a = Math.atan2(v - 0.5, u - 0.5);
        if (d < 0.22 && Math.abs(a - 0) < 0.12) return 0x1a1414;
        if (d < 0.28 && Math.abs(a + Math.PI / 2 - 0.05) < 0.1) return 0x1a1414;
        if (d > 0.26 && Math.floor(((a + Math.PI) / (Math.PI * 2)) * 12 * 4) % 4 === 0) return 0x1a1414;
        return LINEN;
      }
      return wood(false)(u, v);
    },
    right: wood(true),
  });
  m.box(0.16, 0.14, 72, 0.68, 0.58, 4, { top: OAK_LIGHT, left: lipped(OAK, OAK_LIGHT), right: OAK_DARK });
  for (const x of [0.22, 0.5, 0.74]) m.cylinder(x, 0.42, 76, 0.04, 4, () => BRASS, BRASS_LIGHT);
  return m;
}

/** Rolled carpets and a tapestry leaning in the corner, tied with string. */
function carpets(): IsoModel {
  const m = new IsoModel();
  const rolls: Array<[number, number, number, number, number]> = [
    [0.25, 0.3, 0.13, 58, 0x7a2a22],
    [0.48, 0.25, 0.11, 50, 0x2a3a5a],
    [0.36, 0.55, 0.12, 64, 0x6a5a32],
    [0.62, 0.5, 0.1, 44, 0x4a2a3a],
  ];
  for (const [x, y, r, h, col] of rolls) {
    m.cylinder(x, y, 0, r, h, (u, v) => {
      if (Math.abs(v - 0.25) < 0.02 || Math.abs(v - 0.75) < 0.02) return 0xc8b890;
      const p = (Math.floor(u * 6) + Math.floor(v * 14)) % 3;
      const c = p === 0 ? mixColor(col, 0xc8a050, 0.4) : p === 1 ? col : mixColor(col, 0x000000, 0.3);
      return u > 0.7 ? mixColor(c, 0x000000, 0.25) : c;
    }, (u, v) => (Math.abs(Math.hypot(u - 0.5, v - 0.5) * 8 % 1 - 0.5) < 0.2 ? mixColor(col, 0xffffff, 0.2) : col));
  }
  tag(m, 0.5, 0.67, 30);
  return m;
}

/** A hat stand with a birdcage hung on it, its door open and the bird long gone, and a shawl. */
function cageStand(): IsoModel {
  const m = new IsoModel();
  for (const [dx, dy] of [[-0.18, 0], [0.12, -0.14], [0.08, 0.16]]) m.box(0.5 + dx, 0.5 + dy, 0, 0.12, 0.03, 2, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.box(0.47, 0.47, 0, 0.06, 0.06, 66, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  for (const [dx, dy] of [[-0.12, 0], [0.12, 0], [0, -0.12], [0, 0.12]]) m.box(0.49 + dx, 0.49 + dy, 60, 0.03, 0.03, 4, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  // The shawl, hanging off one peg.
  m.box(0.56, 0.44, 32, 0.08, 0.14, 28, { top: 0x5a6a3a, left: (u, v) => ((Math.floor(u * 4) + Math.floor(v * 8)) % 2 ? 0x5a6a3a : 0x4a5a2e), right: 0x3a4a22 });
  // The cage.
  m.box(0.3, 0.6, 58, 0.01, 0.01, 6, { top: IRON, left: IRON, right: IRON });
  const bars: Shader = (u) => ((u * 9) % 1 < 0.2 ? BRASS : null);
  m.cylinder(0.28, 0.68, 36, 0.14, 20, (u, v) => (u > 0.45 && u < 0.7 && v > 0.4 ? null : bars(u, v)), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.45 ? BRASS_DARK : null));
  m.cylinder(0.28, 0.68, 36, 0.15, 1, () => BRASS_DARK, BRASS);
  m.box(0.2, 0.67, 45, 0.16, 0.01, 0.6, { top: OAK_LIGHT, left: OAK_LIGHT, right: OAK });
  return m;
}

/** A heap of boots, none of them pairs. */
function boots(): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(17);
  for (let i = 0; i < 9; i++) {
    const x = 0.15 + rnd() * 0.55;
    const y = 0.15 + rnd() * 0.55;
    const z = i < 5 ? 0 : 4 + rnd() * 4;
    const col = [0x4a2e1c, 0x2a1e18, 0x5a4030, 0x6a4a2a][Math.floor(rnd() * 4)];
    const along = rnd() < 0.5;
    m.box(x, y, z, along ? 0.24 : 0.09, along ? 0.09 : 0.24, 4, { top: mixColor(col, 0xffffff, 0.12), left: col, right: mixColor(col, 0x000000, 0.3) });
    m.box(x, y, z + 4, 0.09, 0.09, 8, { top: 0x120c0a, left: col, right: mixColor(col, 0x000000, 0.3) });
  }
  return m;
}

/** Nettle's table under the window, where the pledges are ticketed: string, tickets, a box of rings to sort, and a little knife. */
function tagTable(): IsoModel {
  const m = new IsoModel();
  const leg = { top: TAR, left: TAR_LIGHT, right: TAR_DARK };
  for (const [x, y] of [[0.12, 0.12], [0.8, 0.12], [0.12, 1.8], [0.8, 1.8]]) m.box(x, y, 0, 0.07, 0.07, 22, leg);
  m.box(0.06, 0.06, 22, 0.88, 1.88, 3, { top: (u, v) => planks(3, OAK_TOP, OAK_DARK, OAK_LIGHT, 9)(v, u), left: OAK, right: OAK_DARK });
  // A ball of string, a spill of tickets, a tray of rings, a pot of glue, a half-wrapped parcel, a knife.
  m.cylinder(0.3, 0.3, 25, 0.08, 5, (u) => (u * 8 % 1 < 0.4 ? 0xd8c8a0 : 0xb8a880), 0xd8c8a0);
  for (let i = 0; i < 7; i++) m.box(0.4 + (i % 3) * 0.1, 0.5 + i * 0.06, 25, 0.08, 0.12, 0.4, { top: i % 2 ? TICKET : LINEN, left: TICKET_DARK, right: TICKET_DARK });
  m.box(0.25, 1.0, 25, 0.4, 0.3, 2, {
    top: (u, v) => (u < 0.08 || u > 0.92 || v < 0.1 || v > 0.9 ? OAK_LIGHT : Math.abs(Math.hypot((u * 5) % 1 - 0.5, (v * 3) % 1 - 0.5) - 0.25) < 0.1 ? (hash(Math.floor(u * 5), Math.floor(v * 3)) < 0.6 ? GOLD : SILVER) : 0x3a1a24),
    left: OAK, right: OAK_DARK,
  });
  m.cylinder(0.7, 1.15, 25, 0.06, 4, () => 0x8a7a5a, 0xd8d0b0);
  m.box(0.4, 1.45, 25, 0.35, 0.3, 6, { top: (u) => (Math.abs(u - 0.5) < 0.05 ? 0xd8c8a0 : 0x9a7a52), left: (u) => (Math.abs(u - 0.5) < 0.05 ? 0xd8c8a0 : 0x8a6a44), right: 0x6a4e30 });
  m.box(0.2, 1.7, 25, 0.03, 0.18, 1, { top: PEWTER_LIGHT, left: PEWTER, right: PEWTER_DARK });
  return m;
}

/** Saint Elda's bell, brought down off its frame: bronze, green at the lip, the saint's lily cast on its shoulder. */
function bell(): IsoModel {
  const m = new IsoModel();
  m.box(0.18, 0.2, 0, 0.64, 0.6, 3, { top: OAK_LIGHT, left: OAK, right: OAK_DARK }); // a pallet
  const bronze = (u: number, v: number) => {
    if (v > 0.86) return 0x5a8a6a; // verdigris at the lip
    if (v > 0.25 && v < 0.42 && Math.abs(u - 0.4) < 0.08) return 0xe8c878; // the lily
    if (Math.abs(v - 0.2) < 0.03 || Math.abs(v - 0.78) < 0.03) return 0x8a5a2a;
    return u < 0.25 ? 0xd8a058 : u > 0.7 ? 0x7a4a22 : 0xb07a3a;
  };
  m.cylinder(0.5, 0.5, 3, 0.3, 6, bronze, 0x8a5a2a);
  m.cylinder(0.5, 0.5, 9, 0.24, 8, bronze, 0x9a6a32);
  m.cylinder(0.5, 0.5, 17, 0.17, 8, bronze, 0xa87a3a);
  m.cylinder(0.5, 0.5, 25, 0.08, 3, bronze, 0xb88a48);
  // A ticket tied to the crown, and a chalked hook on the pallet.
  tag(m, 0.56, 0.58, 22);
  m.quad({ x: 0.3, y: 0.8, z: 2.6 }, { x: 0.2, y: 0, z: 0 }, { x: 0, y: 0, z: -2.2 }, (u, v) => (Math.abs(u - 0.6) < 0.12 && v < 0.7 ? 0xe8e0d0 : u < 0.6 && Math.abs(v - 0.75) < 0.2 ? 0xe8e0d0 : null));
  return m;
}

/** A low stool. */
function stool(): IsoModel {
  const m = new IsoModel();
  const leg = { top: TAR, left: TAR_LIGHT, right: TAR_DARK };
  for (const [x, y] of [[0.34, 0.34], [0.58, 0.34], [0.34, 0.58], [0.58, 0.58]]) m.box(x, y, 0, 0.06, 0.06, 14, leg);
  m.cylinder(0.5, 0.5, 14, 0.2, 3, (u) => (u < 0.3 ? OAK_LIGHT : OAK_DARK), OAK_TOP);
  return m;
}

/** The stairs, steep and narrow, climbing the back wall, with a rope for a rail. */
function stairs(tile: number): IsoModel {
  const m = new IsoModel();
  const rise = 13;
  for (let k = 0; k < 2; k++) {
    const step = tile * 2 + k;
    const h = (step + 1) * rise;
    const x = k * 0.5;
    m.box(x, 0, 0, 0.5, 0.8, h, {
      top: (u, v) => (u < 0.12 ? TAR_WORN : Math.abs(v - 0.5) < 0.22 && u > 0.2 ? OAK_LIGHT : OAK),
      left: (_u, v) => (v * h < 3 ? OAK_LIGHT : Math.floor(v * h) % rise < 2 ? TAR_DARK : TAR),
      right: TAR_DARK,
    });
    // Things kept on the stairs because there's nowhere else: a jug, a boot, a stack of books.
    if (step === 1) m.cylinder(0.75, 0.2, h, 0.07, 8, (u) => (u < 0.3 ? 0xc89a6a : 0x8a5a3a), 0x6a4428);
    if (step === 4) book(m, 0.05, 0.12, h, 0x3a2a1e);
    // A rope rail on iron eyes.
    if (step % 2 === 0) m.box(x + 0.22, 0.74, h, 0.03, 0.03, 22, { top: IRON_LIGHT, left: IRON, right: IRON_DARK });
    m.box(x, 0.74, h + 20, 0.5, 0.03, 1.5, { top: 0xc8b890, left: 0xa89870, right: 0x8a7a58 });
  }
  return m;
}

// ---------------------------------------------------------------- the counting room

/** Lusk's desk: green leather gone bald, the day book open, a quill, a candle, the scales, coin stacked in tens, and the black ledger. */
function desk(): IsoModel {
  const m = new IsoModel();
  // Its drawers open on Lusk's side (-y, the chair's); the room sees the back of it, panelled, with a modesty board between the pedestals.
  const panel: Shader = (u, v) => (u < 0.08 || u > 0.92 || v < 0.1 || v > 0.9 ? OAK_DARK : Math.abs(u - 0.5) < 0.03 ? OAK_DARK : v < 0.16 ? OAK_LIGHT : OAK);
  const wood = { top: OAK_TOP, left: panel, right: OAK_DARK };
  m.box(0.05, 0.15, 0, 0.5, 0.75, 24, wood);
  m.box(1.45, 0.15, 0, 0.5, 0.75, 24, wood);
  m.box(0.55, 0.8, 6, 0.9, 0.06, 18, { top: OAK, left: (u, v) => (v < 0.1 || (u * 3) % 1 < 0.04 ? OAK_DARK : OAK), right: OAK_DARK });
  m.box(0, 0.1, 24, 2, 0.85, 3, {
    top: (u, v) => (u > 0.06 && u < 0.94 && v > 0.1 && v < 0.9 ? (smoothNoise(u * 9, v * 5, 4) > 0.7 ? 0x3a4a32 : 0x2a3a26) : OAK_TOP),
    left: OAK_LIGHT,
    right: OAK,
  });
  // The day book, open, and the quill in the inkhorn.
  book(m, 0.5, 0.35, 27, 0x5a2a1e, true);
  m.cylinder(0.95, 0.3, 27, 0.04, 3, () => 0x2a2420, 0x0e0a0a);
  m.box(0.98, 0.28, 30, 0.02, 0.02, 9, { top: LINEN, left: LINEN, right: LINEN_DARK });
  // Coin in stacks of ten, silver and copper.
  for (let i = 0; i < 4; i++) coins(m, 1.15 + i * 0.1, 0.65, 27, 4 + (i % 3) * 2, i % 2 === 0);
  // The black ledger, shut, a ribbon hanging out of it.
  m.box(1.45, 0.3, 27, 0.32, 0.24, 4, { top: (u) => (u < 0.1 ? 0x2a2a2e : 0x141216), left: (_u, v) => (v > 0.2 && v < 0.8 ? 0xd8ccaa : 0x141216), right: 0x0e0c10 });
  m.box(1.62, 0.54, 25, 0.02, 0.06, 2, { top: 0x9a1a1a, left: 0x7a1414, right: 0x5a0e0e });
  candle(m, 0.25, 0.3, 27, 9);
  m.box(0.17, 0.22, 27, 0.16, 0.16, 1, { top: BRASS, left: BRASS, right: BRASS_DARK });
  return m;
}

/** His chair: a carved thing with a velvet seat, sold to him by a bishop's nephew. */
function deskChair(): IsoModel {
  const m = new IsoModel();
  const wood = { top: OAK_LIGHT, left: OAK, right: OAK_DARK };
  for (const [x, y] of [[0.25, 0.25], [0.7, 0.25], [0.25, 0.7], [0.7, 0.7]]) m.box(x, y, 0, 0.06, 0.06, 17, wood);
  m.box(0.22, 0.22, 17, 0.56, 0.56, 3, { top: 0x5a1a2a, left: OAK_LIGHT, right: OAK });
  m.box(0.22, 0.2, 17, 0.56, 0.06, 34, { top: OAK_LIGHT, left: (u, v) => (v < 0.3 && Math.hypot(u - 0.5, v - 0.15) < 0.12 ? GOLD : v > 0.2 && v < 0.9 && u > 0.15 && u < 0.85 ? 0x5a1a2a : OAK), right: OAK_DARK });
  return m;
}

/** A bookcase of ledgers, years of pledges, and a skull with a candle on it. */
function ledgerCase(): IsoModel {
  const m = new IsoModel();
  const H = 74;
  m.box(0.05, 0, 0, 1.9, 0.4, H, {
    top: OAK_LIGHT,
    left: (u, v) => {
      const x = u * 64;
      const y = v * H;
      if (x < 2 || x > 62 || y < 3) return OAK_DARK;
      const shelf = Math.floor((y - 3) / 14);
      const ly = (y - 3) % 14;
      if (ly < 1.6) return OAK_LIGHT;
      const slot = Math.floor(x / 3);
      const n = hash(slot, shelf);
      if (ly < 2 + n * 3 || x % 3 < 0.4) return 0x120c0a;
      const col = [0x5a2a1e, 0x2a3a2a, 0x3a2a1a, 0x1e2a3a, 0x4a3a1e, 0x141216][Math.floor(n * 6)];
      if (Math.abs(ly - 8) < 0.6) return GOLD;
      return x % 3 < 1.2 ? mixColor(col, 0xffffff, 0.12) : col;
    },
    right: OAK_DARK,
  });
  m.box(1.4, 0.12, H, 0.2, 0.16, 7, { top: BONE, left: (u, v) => (v > 0.3 && v < 0.6 && (u < 0.35 || u > 0.65) ? 0x1a1414 : BONE), right: BONE_DARK });
  candle(m, 1.5, 0.2, H + 7, 5);
  return m;
}

/** A fat black cat asleep on a cushion, one eye open: Mister Pledge. */
function cat(): IsoModel {
  const m = new IsoModel();
  m.box(0.25, 0.25, 0, 0.5, 0.5, 4, { top: (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.1 ? GOLD : 0x6a1a2a), left: 0x5a1424, right: 0x3a0e18 });
  m.cylinder(0.5, 0.5, 4, 0.2, 6, (u) => (u < 0.3 ? 0x2a2630 : 0x141218), 0x1e1a22);
  m.cylinder(0.62, 0.62, 6, 0.1, 6, (u, v) => (v > 0.35 && v < 0.55 && Math.abs(u - 0.35) < 0.07 ? 0xe8c848 : u < 0.3 ? 0x2a2630 : 0x141218), 0x1e1a22);
  for (const dx of [-0.06, 0.06]) m.box(0.62 + dx - 0.02, 0.6, 12, 0.04, 0.04, 2, { top: 0x1e1a22, left: 0x2a2630, right: 0x141218 });
  m.box(0.3, 0.66, 4, 0.3, 0.06, 2, { top: 0x1e1a22, left: 0x2a2630, right: 0x141218 }); // the tail
  return m;
}

/** A narrow cot under the window, for nights he doesn't trust the counter: a grey blanket and a cudgel under the pillow. */
function cot(): IsoModel {
  const m = new IsoModel();
  const wood = { top: TAR_LIGHT, left: lipped(TAR, TAR_LIGHT), right: TAR_DARK };
  m.box(0.1, 0.05, 0, 0.8, 1.9, 10, wood);
  m.box(0.14, 0.1, 10, 0.72, 1.8, 4, { top: (u, v) => (smoothNoise(u * 4, v * 6, 3) > 0.6 ? 0xa89868 : 0xc8b480), left: 0xb0a070, right: 0x8a7a54 });
  m.box(0.12, 0.6, 14, 0.76, 1.3, 2, { top: (u, v) => ((Math.floor(u * 8) + Math.floor(v * 10)) % 5 === 0 ? 0x6a6460 : 0x56524e), left: 0x4a4644, right: 0x3a3634 });
  m.box(0.2, 0.15, 14, 0.6, 0.35, 4, { top: LINEN, left: LINEN_DARK, right: 0x9a907a });
  m.box(0.7, 0.2, 18, 0.06, 0.3, 2, { top: OAK_LIGHT, left: OAK, right: OAK_DARK }); // the cudgel's end, peeking out
  return m;
}

// ---------------------------------------------------------------- the top floor

/** A crate of the Hooks' takings, stencilled with somebody else's mark: a merchant's, a guild's, a monastery's. */
function stashCrate(mark: number, eye = false): IsoModel {
  const m = new IsoModel();
  const slats = (dark: boolean): Shader => (u, v) => {
    const base = dark ? 0x4a3a28 : 0x6a5236;
    if (u < 0.06 || u > 0.94 || v < 0.08 || v > 0.92) return dark ? 0x2e2418 : 0x4a3a28;
    if ((v * 4) % 1 < 0.08) return 0x1a1410;
    if (!dark && Math.abs(u - 0.5) < 0.22 && Math.abs(v - 0.5) < 0.14) {
      // The stencil: a wheel, a key, a lily, a fish.
      const du = (u - 0.5) * 6;
      const dv = (v - 0.5) * 6;
      const r = Math.hypot(du, dv);
      if (mark === 0 && (Math.abs(r - 0.6) < 0.12 || (r < 0.6 && (Math.abs(du) < 0.08 || Math.abs(dv) < 0.08)))) return 0x2a2018;
      if (mark === 1 && ((Math.abs(dv) < 0.12 && du > -0.4) || Math.hypot(du + 0.6, dv) < 0.3)) return 0x7a1a14;
      if (mark === 2 && Math.abs(du) < 0.12 + Math.max(0, 0.4 - Math.abs(dv + 0.3)) * 0.8) return 0x2a3a5a;
      if (mark === 3 && Math.hypot(du / 1.4, dv / 0.6) < 0.6) return 0x2a2018;
    }
    return hash(Math.floor(u * 12), Math.floor(v * 4)) < 0.15 ? (dark ? 0x3a2e20 : 0x5a4630) : base;
  };
  m.box(0.1, 0.1, 0, 0.8, 0.8, 26, { top: slats(false), left: slats(false), right: slats(true) });
  if (eye) {
    // Sealed in grey wax, and in the wax, an eye in silver leaf.
    m.box(0.36, 0.36, 26, 0.28, 0.28, 1, {
      top: (u, v) => {
        const d = Math.hypot((u - 0.5) * 1.6, v - 0.5);
        if (Math.abs(v - 0.5) < 0.28 - Math.abs(u - 0.5) * 0.7 && d < 0.4) return d < 0.1 ? 0x141418 : d < 0.18 ? SILVER : 0xdcdce4;
        return Math.hypot(u - 0.5, v - 0.5) < 0.48 ? 0x7a7a82 : null;
      },
      left: 0x5a5a62, right: 0x4a4a52,
    });
    // Iron straps, and a chain.
    // (Thin bands on the faces it shows: over the lid and down the front.)
    for (const u of [0.25, 0.75]) {
      const x = 0.1 + u * 0.8 - 0.03;
      m.box(x, 0.1, 26, 0.06, 0.8, 0.6, { top: IRON, left: IRON, right: IRON_DARK });
      m.box(x, 0.9, 0, 0.06, 0.02, 26.6, { top: IRON, left: (_u, v) => ((v * 6) % 1 < 0.12 ? IRON_LIGHT : IRON), right: IRON_DARK });
    }
  }
  return m;
}

/** Bolts of good cloth, stacked: wool, linen, a bolt of red silk off a merchant's barge. */
function cloth(): IsoModel {
  const m = new IsoModel();
  const bolts: Array<[number, number, number]> = [[0, 0x5a5a6a, 0], [0, 0x6a4a2a, 1], [8, 0xe8e0cc, 0], [8, 0x9a1a2a, 1], [16, 0x2a4a3a, 0.5]];
  for (const [z, col, i] of bolts) {
    m.box(0.1 + i * 0.4, 0.15, z, 0.38, 0.7, 8, {
      top: (u) => ((u * 14) % 1 < 0.15 ? mixColor(col, 0x000000, 0.3) : col),
      left: (u, v) => (Math.abs(Math.hypot(u - 0.5, v - 0.5) * 6 % 1 - 0.5) < 0.15 ? mixColor(col, 0x000000, 0.3) : mixColor(col, 0xffffff, 0.1)),
      right: mixColor(col, 0x000000, 0.35),
    });
  }
  tag(m, 0.5, 0.86, 18);
  return m;
}

/** A ship's figurehead lying on its side: a woman with a gilded crown, her nose broken off, salt-white. */
function figurehead(): IsoModel {
  const m = new IsoModel();
  const wood = (u: number, v: number) => (smoothNoise(u * 6, v * 6, 8) > 0.7 ? 0xd8d0c0 : u < 0.3 ? 0xc8b8a0 : 0xa8987e);
  m.box(0.1, 0.25, 0, 1.6, 0.5, 10, { top: wood, left: (u, v) => (u < 0.25 ? (v < 0.5 ? 0x3a5a7a : wood(u, v)) : u > 0.8 ? 0x6a4a2a : u > 0.55 ? 0x3a5a7a : wood(u, v)), right: 0x8a7a64 });
  // Her face, upturned, nose gone.
  m.box(0.1, 0.32, 10, 0.4, 0.36, 6, { top: (u, v) => {
    if (Math.abs(v - 0.35) < 0.06 && (Math.abs(u - 0.35) < 0.06 || Math.abs(u - 0.65) < 0.06)) return 0x3a3a4a;
    if (Math.abs(u - 0.5) < 0.06 && Math.abs(v - 0.55) < 0.06) return 0x8a6a4a; // the broken nose
    if (Math.abs(v - 0.75) < 0.04 && Math.abs(u - 0.5) < 0.12) return 0x8a3a3a;
    return wood(u, v);
  }, left: wood, right: 0x8a7a64 });
  m.box(0.05, 0.3, 6, 0.12, 0.4, 10, { top: GOLD, left: (u) => ((u * 6) % 1 < 0.5 ? GOLD : BRASS), right: BRASS_DARK });
  m.box(1.5, 0.3, 10, 0.3, 0.4, 3, { top: 0x6a4a2a, left: 0x5a3a22, right: 0x3a2414 }); // her scroll
  return m;
}

/** A chest with a chain round it and a padlock the size of a fist. */
function chainedChest(): IsoModel {
  const m = new IsoModel();
  m.box(0.12, 0.2, 0, 0.76, 0.6, 18, {
    top: (u) => (Math.abs(u - 0.5) < 0.05 ? IRON_LIGHT : 0x5a3a22),
    left: (u, v) => (Math.abs(u - 0.5) < 0.05 || v < 0.1 ? IRON : Math.abs(v - 0.4) < 0.05 ? IRON_LIGHT : 0x5a3a22),
    right: (_u, v) => (Math.abs(v - 0.4) < 0.05 ? IRON : 0x3a2414),
  });
  m.box(0.44, 0.78, 8, 0.12, 0.06, 8, { top: BRASS_LIGHT, left: (u, v) => (Math.hypot(u - 0.5, v - 0.6) < 0.15 ? 0x1a1414 : BRASS), right: BRASS_DARK });
  return m;
}

/** Sacks, bulging, one split and spilling tea. */
function sacks(): IsoModel {
  const m = new IsoModel();
  const sack = (x: number, y: number, z: number, h: number) =>
    m.cylinder(x, y, z, 0.2, h, (u, v) => (v < 0.12 ? 0x8a7a5a : (u * 10 + v * 3) % 1 < 0.1 ? 0x7a6a4a : u < 0.3 ? 0xb8a880 : 0x9a8a62), 0x8a7a5a);
  sack(0.3, 0.3, 0, 16);
  sack(0.65, 0.4, 0, 14);
  sack(0.45, 0.7, 0, 12);
  sack(0.45, 0.4, 14, 10);
  m.quad({ x: 0.55, y: 0.75, z: 0.5 }, { x: 0.35, y: 0, z: 0 }, { x: 0, y: 0.2, z: 0 }, (u, v) => (Math.hypot(u - 0.3, v - 0.4) < 0.4 ? (hash(Math.floor(u * 30), Math.floor(v * 20)) < 0.5 ? 0x2a1e14 : 0x3a2a1a) : null));
  return m;
}

/** A crate opened, straw spilling out, and in it a gentleman's silver: candlesticks, a teapot, salvers. */
function openCrate(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.1, 0, 0.8, 0.8, 18, { top: (u, v) => (u > 0.06 && u < 0.94 && v > 0.06 && v < 0.94 ? (hash(Math.floor(u * 20), Math.floor(v * 20)) < 0.4 ? 0xc8a868 : 0xa8884a) : 0x4a3a28), left: (_u, v) => ((v * 3) % 1 < 0.1 ? 0x2e2418 : 0x6a5236), right: 0x4a3a28 });
  m.cylinder(0.4, 0.45, 18, 0.1, 6, (u) => (u < 0.3 ? 0xe8ecf0 : SILVER), SILVER);
  m.box(0.4, 0.55, 22, 0.14, 0.03, 2, { top: SILVER, left: SILVER, right: PEWTER });
  candlestick(m, 0.68, 0.3, 18, SILVER);
  m.box(0.08, 0.55, 18, 0.03, 0.4, 8, { top: 0x6a5236, left: 0x6a5236, right: 0x4a3a28 }); // the lid, leaning
  return m;
}

// ---------------------------------------------------------------- registry

function put(scene: Phaser.Scene, key: string, model: IsoModel, outline = true): void {
  registerModel(scene, key, model.render(outline));
}

export const PAWN_WALL_KINDS: PawnWallKind[] = ['plain', 'window', 'door', 'shelf', 'hooks', 'pictures', 'tickets', 'sign', 'coats', 'ledgers', 'ious', 'eaves', 'eaves-window'];

export function generatePawnshop(scene: Phaser.Scene): void {
  for (const kind of PAWN_WALL_KINDS) {
    for (let i = 0; i < 2; i++) {
      pawnWall(scene, 'back', kind, i);
      pawnWall(scene, 'side', kind, i);
    }
  }
  put(scene, 'pw-wall-corner', cornerPost());
  put(scene, 'pw-rug', rug(4, 3, 3), false);
  put(scene, 'pw-rug-small', rug(2, 2, 7), false);
  for (let i = 0; i < 2; i++) put(scene, `pw-litter-${i}`, litter(i * 11 + 5), false);
  for (let i = 0; i < 4; i++) put(scene, `pw-counter-${i}`, counterStraight(i));
  put(scene, 'pw-counter-side', counterSide());
  put(scene, 'pw-counter-corner', counterCorner());
  put(scene, 'pw-counter-end', counterEnd());
  put(scene, 'pw-pledges', pledges());
  put(scene, 'pw-safe', safe(false));
  put(scene, 'pw-safe-big', safe(true));
  put(scene, 'pw-armour', armour());
  put(scene, 'pw-bear', bear());
  put(scene, 'pw-heron', heron());
  put(scene, 'pw-swords', swordBarrel());
  for (let i = 0; i < 2; i++) put(scene, `pw-junk-${i}`, junkTable(i));
  put(scene, 'pw-font', font());
  put(scene, 'pw-dummy', dummy());
  put(scene, 'pw-chairs', chairPile());
  put(scene, 'pw-mirror', mirror());
  put(scene, 'pw-harp', harp());
  put(scene, 'pw-clock', clock());
  put(scene, 'pw-carpets', carpets());
  put(scene, 'pw-cage', cageStand());
  put(scene, 'pw-boots', boots());
  put(scene, 'pw-tagtable', tagTable());
  put(scene, 'pw-bell', bell());
  put(scene, 'pw-stool', stool());
  for (let i = 0; i < 3; i++) put(scene, `pw-stairs-${i}`, stairs(i));
  put(scene, 'pw-desk', desk());
  put(scene, 'pw-deskchair', deskChair());
  put(scene, 'pw-ledgercase', ledgerCase());
  put(scene, 'pw-cat', cat());
  put(scene, 'pw-cot', cot());
  for (let i = 0; i < 4; i++) put(scene, `pw-crate-${i}`, stashCrate(i));
  put(scene, 'pw-crate-eye', stashCrate(0, true));
  put(scene, 'pw-cloth', cloth());
  put(scene, 'pw-figurehead', figurehead());
  put(scene, 'pw-chest', chainedChest());
  put(scene, 'pw-sacks', sacks());
  put(scene, 'pw-silver', openCrate());
  generatePawnFolk(scene);
}
