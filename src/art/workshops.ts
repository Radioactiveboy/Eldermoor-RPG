import Phaser from 'phaser';
import { generateWorkFrames } from './figure3d';
import { IsoModel, lipped, planks, Shader } from './IsoModel';
import { MODEL_ART, registerModel } from './interior';
import { bakerModel, smithModel } from './models3d';
import { PixelCanvas } from './PixelCanvas';
import { PALETTE as P } from './palette';
import { HAMMER_STROKE } from '../world/landmarks';

/**
 * Inside Adowvale's two workshops (see world/WorkshopMaps.ts): Osric's smithy
 * (the forge with its hood and bellows, the anvil on its stump, the quench
 * tub, racks of tools and finished iron, a heap of coal, a grindstone) and
 * Hilde's bakery (the domed bread oven, racks of loaves, the kneading trough,
 * a stack of firewood). The forge's coals and the oven's fire flicker, a few
 * frames each, like the cottage hearth. Also the two at their work: Osric's
 * hammer coming down and Hilde kneading, as their '-work-' frames.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** How many frames the forge's coals and the oven's fire flicker through. */
const FIRE_FRAMES = 4;

/** Red brick, soot-blackened towards the top (the oven's dome, the forge's hearth). */
const brick = (sooty = 0, dim = 1): Shader => (u, v) => {
  const row = Math.floor(v * 12);
  const fx = u * 8 + (row % 2) * 0.5;
  if ((v * 12) % 1 < 0.16 || fx % 1 < 0.08) return dim < 1 ? 0x5e544c : 0x7a6e62;
  const n = hash(Math.floor(fx), row + 3);
  if (n < sooty * (1 - v)) return dim < 1 ? 0x1c1416 : P.soot;
  const c = n < 0.2 ? 0x7a3a2a : n > 0.85 ? 0xb8684a : n > 0.6 ? 0xa0503a : 0x92462f;
  return dim < 1 ? darken(c, dim) : c;
};

function darken(c: number, f: number): number {
  const r = Math.floor(((c >> 16) & 0xff) * f);
  const g = Math.floor(((c >> 8) & 0xff) * f);
  const b = Math.floor((c & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

const stones: Shader = (u, v) => {
  const row = Math.floor(v * 4);
  const col = Math.floor(u * 5 + (row % 2) * 0.5);
  if ((u * 5 + (row % 2) * 0.5) % 1 < 0.08 || (v * 4) % 1 < 0.12) return P.mortar;
  const n = hash(col, row);
  return n < 0.3 ? P.stoneDark : n > 0.75 ? P.stoneLight : P.stone;
};
const stonesDark: Shader = (u, v) => {
  const c = stones(u, v);
  return c === P.stoneLight ? P.stone : c === P.stone ? P.stoneDark : c;
};

/** Coals in a bed, glowing; `frame` moves the hot spots about. */
const coals = (frame: number): Shader => (u, v) => {
  const n = hash(Math.floor(u * 14) + frame * 3, Math.floor(v * 7) + frame);
  const heat = Math.sin(u * 9 + frame * 1.7) * Math.cos(v * 7 - frame) * 0.5 + 0.5;
  if (n < 0.18) return P.soot;
  if (heat > 0.8) return P.fireYellow;
  if (heat > 0.5) return n > 0.6 ? P.fireOrange : P.ember;
  return n > 0.5 ? P.fireRed : 0x7a2a1a;
};

// ---------------------------------------------------------------- the smithy

/**
 * The forge against the back wall, two tiles wide: a waist-high hearth of
 * stone with a bed of glowing coals sunk in its top, a hood of sooty brick
 * over it narrowing up into the chimney, and the bellows' nozzle in its side.
 */
function forge(frame: number): IsoModel {
  const m = new IsoModel();
  // The chimney and the hood, back against the wall.
  m.box(0.55, 0, 66, 0.9, 0.4, 34, { top: P.soot, left: brick(0.7), right: brick(0.7, 0.8) });
  m.box(0.15, 0, 50, 1.7, 0.75, 16, { top: P.soot, left: brick(0.5), right: brick(0.5, 0.8) });
  // The hearth itself.
  m.box(0.05, 0.05, 0, 1.9, 0.9, 26, { top: P.stoneLight, left: stones, right: stonesDark });
  // The firepot, sunk into the top, full of coals; a lip of iron round it.
  m.box(0.4, 0.2, 26, 1.2, 0.6, 1, { top: P.iron, left: P.iron, right: P.iron });
  m.box(0.48, 0.26, 27, 1.04, 0.48, 1, { top: coals(frame), left: P.fireRed, right: P.ember });
  // Flames licking up from the coals now and then.
  const rnd = (i: number) => hash(i, frame + 11);
  for (let i = 0; i < 4; i++) {
    const x = 0.6 + rnd(i) * 0.8;
    const h = 3 + rnd(i + 7) * 7;
    m.box(x, 0.4 + rnd(i + 3) * 0.2, 28, 0.06, 0.06, h, { top: P.fireYellow, left: P.fireOrange, right: P.fireRed });
  }
  // Tongs and a poker lying on the hearth's edge.
  m.box(1.55, 0.7, 26, 0.35, 0.04, 1, { top: P.ironLight, left: P.iron, right: P.iron });
  m.box(0.1, 0.72, 26, 0.3, 0.03, 1, { top: P.ironLight, left: P.iron, right: P.iron });
  return m;
}

/** The great leather bellows beside the forge, on a wooden frame, its lever arm sticking up. */
function bellows(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.barkLight, left: lipped(P.bark, P.barkLight), right: P.barkDark };
  for (const [x, y] of [[0.15, 0.15], [0.75, 0.15], [0.15, 0.7], [0.75, 0.7]]) m.box(x, y, 0, 0.08, 0.08, 16, wood);
  m.box(0.1, 0.1, 16, 0.8, 0.7, 3, wood);
  // The leather pleats, swelling between the boards.
  const leather: Shader = (u, v) => ((v * 5) % 1 < 0.2 ? P.leatherDark : u < 0.3 ? P.leatherLight : P.leather);
  m.box(0.14, 0.18, 19, 0.72, 0.56, 9, { top: P.leather, left: leather, right: leather });
  m.box(0.1, 0.12, 28, 0.8, 0.66, 2, wood);
  // The nozzle, pointing at the forge, and the lever.
  m.box(-0.25, 0.4, 21, 0.35, 0.08, 3, { top: P.ironLight, left: P.iron, right: P.iron });
  m.box(0.8, 0.42, 30, 0.06, 0.06, 18, wood);
  m.box(0.8, 0.2, 46, 0.06, 0.5, 2, wood);
  return m;
}

/** The anvil on its elm stump, where the work is done (set towards the back of its tile, so the smith can stand close behind it). */
function anvil(): IsoModel {
  const m = new IsoModel();
  const stump: Shader = (u, v) => ((u * 11) % 1 < 0.15 || hash(Math.floor(u * 11), Math.floor(v * 6)) < 0.15 ? P.barkDark : u < 0.35 ? P.barkLight : P.bark);
  const rings: Shader = (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5);
    return (r * 14) % 1 < 0.2 ? P.bark : P.plankLight;
  };
  m.cylinder(0.5, 0.3, 0, 0.2, 10, stump, rings);
  const steel = { top: 0x8a8a96, left: lipped(0x4a4a54, 0x6a6a74, 0.2), right: 0x34343c };
  // The foot, the waist, the face; the horn sticking out at one end, and the heel at the other.
  m.box(0.38, 0.2, 10, 0.24, 0.2, 2, steel);
  m.box(0.43, 0.24, 12, 0.14, 0.12, 2.5, steel);
  m.box(0.34, 0.2, 14.5, 0.3, 0.2, 2.5, { ...steel, top: (u, v) => (u > 0.3 && u < 0.7 && v > 0.3 && v < 0.6 ? 0xa8a8b4 : 0x8a8a96) });
  m.box(0.64, 0.24, 15, 0.08, 0.12, 1.5, steel);
  m.box(0.72, 0.27, 15.3, 0.05, 0.06, 1, steel);
  return m;
}

/** A half-barrel of black water for quenching, with a steaming bar left in it. */
function quench(): IsoModel {
  const m = new IsoModel();
  const staves: Shader = (u, v) => {
    if (Math.abs(v - 0.25) < 0.08 || Math.abs(v - 0.8) < 0.08) return u < 0.4 ? P.ironLight : P.iron;
    if ((u * 9) % 1 < 0.1) return P.barkDark;
    return u < 0.3 ? P.barkLight : u > 0.75 ? P.barkDark : P.bark;
  };
  m.cylinder(0.5, 0.5, 0, 0.34, 15, staves, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5);
    if (r > 0.42) return P.bark;
    return (u * 6 + v * 3) % 1 < 0.12 ? 0x3a4a5a : 0x1e2a36;
  });
  m.box(0.45, 0.4, 15, 0.05, 0.05, 10, { top: P.ironLight, left: P.iron, right: P.iron });
  return m;
}

/** Tools hung on pegs on a board against the wall: hammers, tongs, a file, a pair of pincers. */
function toolRack(): IsoModel {
  const m = new IsoModel();
  const H = 60;
  const face: Shader = (u, v) => {
    const x = u * 32;
    const y = v * H;
    if (x < 1.5 || x > 30.5 || y < 2 || y > H - 2) return P.barkDark;
    // Three rows of tools.
    const row = Math.floor((y - 4) / 18);
    const ly = (y - 4) % 18;
    const slot = Math.floor(x / 7);
    const lx = x % 7;
    if (ly < 1.2) return P.barkLight;
    const n = hash(slot, row);
    if (n < 0.2) return y % 9 < 0.6 ? P.barkDark : P.plank;
    if (n < 0.6) {
      // A hammer: a haft, and the head at the top.
      if (ly < 5 && lx > 1 && lx < 6) return lx < 2.5 ? P.ironLight : P.iron;
      if (lx > 3 && lx < 4.4) return P.barkLight;
    } else {
      // Tongs: two long arms and a jaw.
      if ((Math.abs(lx - 2.5) < 0.7 || Math.abs(lx - 4.5) < 0.7) && ly < 15) return ly < 4 ? P.ironLight : P.iron;
    }
    return y % 9 < 0.6 ? P.barkDark : P.plank;
  };
  m.box(0.05, 0, 6, 0.9, 0.08, H, { top: P.plankLight, left: face, right: P.plankDark });
  return m;
}

/** A rack of finished iron for sale: a sword and spears standing, horseshoes and a pot hook on pegs, hinges laid on the shelf. */
function ironRack(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.plankLight, left: lipped(P.plank, P.plankLight), right: P.plankDark };
  m.box(0.08, 0.1, 0, 0.84, 0.4, 3, wood);
  m.box(0.08, 0.1, 22, 0.84, 0.4, 3, wood);
  m.box(0.08, 0.1, 0, 0.06, 0.06, 50, wood);
  m.box(0.86, 0.1, 0, 0.06, 0.06, 50, wood);
  m.box(0.08, 0.1, 46, 0.84, 0.06, 4, wood);
  const steel = { top: 0xd0d4dc, left: 0xa8acb8, right: 0x7a7e8a };
  // Spears and a sword, leant against the top rail.
  for (const [x, h] of [[0.25, 52], [0.45, 48]]) {
    m.box(x, 0.3, 3, 0.04, 0.04, h - 8, { top: P.barkLight, left: P.bark, right: P.barkDark });
    m.box(x - 0.02, 0.29, h - 5, 0.08, 0.06, 8, steel);
  }
  m.box(0.66, 0.3, 3, 0.05, 0.04, 6, { top: P.leather, left: P.leather, right: P.leatherDark });
  m.box(0.62, 0.3, 9, 0.13, 0.05, 2, { top: P.gold, left: 0x9a7430, right: 0x9a7430 });
  m.box(0.665, 0.31, 11, 0.04, 0.03, 30, steel);
  // Horseshoes and hinges on the shelf.
  for (const x of [0.2, 0.45, 0.7]) m.box(x, 0.2, 25, 0.14, 0.12, 2, { top: 0x5a5a64, left: 0x3a3a44, right: 0x3a3a44 });
  return m;
}

/** A heap of coal in the corner, and a shovel stuck in it. */
function coalHeap(): IsoModel {
  const m = new IsoModel();
  const coal: Shader = (u, v) => (hash(Math.floor(u * 18), Math.floor(v * 12)) > 0.7 ? 0x4a4a54 : hash(Math.floor(u * 9), Math.floor(v * 7)) > 0.5 ? 0x1a1a20 : 0x2a2a32);
  for (let i = 0; i < 5; i++) {
    const r = 0.42 - i * 0.07;
    m.cylinder(0.5, 0.5, i * 3, r, 3, coal, coal);
  }
  m.box(0.5, 0.48, 10, 0.04, 0.04, 20, { top: P.barkLight, left: P.bark, right: P.barkDark });
  m.box(0.4, 0.46, 8, 0.2, 0.04, 6, { top: P.ironLight, left: P.iron, right: P.iron });
  return m;
}

/** A grindstone on a trestle, with its crank. */
function grindstone(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.barkLight, left: lipped(P.bark, P.barkLight), right: P.barkDark };
  for (const [x, y] of [[0.15, 0.25], [0.78, 0.25], [0.15, 0.65], [0.78, 0.65]]) m.box(x, y, 0, 0.07, 0.07, 18, wood);
  m.box(0.12, 0.25, 18, 0.75, 0.08, 3, wood);
  m.box(0.12, 0.65, 18, 0.75, 0.08, 3, wood);
  // The stone wheel, standing on edge across the trestle.
  m.quad({ x: 0.5, y: 0.2, z: 38 }, { x: 0, y: 0.6, z: 0 }, { x: 0, y: 0, z: -24 }, (u, v) => {
    const r = Math.hypot((u - 0.5) * 1.2, v - 0.5);
    if (r > 0.5) return null;
    if (r < 0.08) return P.iron;
    return r > 0.44 ? P.stoneDark : (u + v) % 0.2 < 0.03 ? P.stone : P.stoneLight;
  });
  m.box(0.5, 0.82, 26, 0.04, 0.12, 2, { top: P.iron, left: P.iron, right: P.iron });
  m.box(0.5, 0.92, 22, 0.04, 0.04, 6, { top: P.barkLight, left: P.bark, right: P.barkDark });
  return m;
}

// ---------------------------------------------------------------- the bakery

/**
 * Hilde's bread oven, two tiles wide against the back wall: a brick dome on a
 * stone plinth, an arched mouth with the fire burning inside, an iron door
 * leant beside it, and the flue going up the wall.
 */
function oven(frame: number): IsoModel {
  const m = new IsoModel();
  m.box(0.75, 0, 60, 0.5, 0.35, 40, { top: P.soot, left: brick(0.6), right: brick(0.6, 0.8) });
  m.box(0, 0, 0, 2, 0.95, 20, { top: P.stoneLight, left: stones, right: stonesDark });
  // The dome, as stacked rings narrowing to its crown.
  const rings = 8;
  for (let i = 0; i < rings; i++) {
    const t = i / rings;
    const r = 0.92 * Math.sqrt(1 - t * t);
    const h = 40 / rings;
    m.cylinder(1, 0.5, 20 + i * h, Math.max(0.12, r * 0.95), h + 0.5, brick(0.35 * t), brick(0.4));
  }
  // The mouth: an arch in a brick face standing proud of the dome at the front, with the fire inside.
  const fire = (u: number, v: number): number => {
    const n = hash(Math.floor(u * 20) + frame * 5, Math.floor(v * 10) + frame);
    const flick = Math.sin(u * 13 + frame * 2.1) * 0.15;
    if (v > 0.82) return n > 0.5 ? P.ember : P.fireRed;
    if (v > 0.55 + flick) return n > 0.4 ? P.fireYellow : P.fireOrange;
    if (v > 0.3 + flick) return n > 0.6 ? P.fireOrange : P.fireRed;
    return n > 0.8 ? P.fireRed : 0x3a1a14;
  };
  m.box(0.55, 0.9, 20, 0.9, 0.12, 24, {
    top: brick(0.5),
    left: (u, v) => {
      const x = (u - 0.5) * 2;
      const y = v * 24;
      const top = 6 + x * x * 7;
      if (Math.abs(x) < 0.62 && y > top && y < 22) return fire(u, (y - top) / (22 - top));
      return brick(0.55)(u, v);
    },
    right: brick(0.5, 0.8),
  });
  // A peel (the long wooden paddle) leant against the plinth, and the oven door beside it.
  m.box(1.75, 1, 0, 0.04, 0.04, 46, { top: P.plankLight, left: P.plank, right: P.plankDark });
  m.box(1.68, 1, 40, 0.2, 0.03, 12, { top: P.plankLight, left: P.plankLight, right: P.plank });
  m.box(0.08, 0.98, 0, 0.36, 0.04, 22, { top: P.iron, left: lipped(P.iron, P.ironLight), right: P.iron });
  return m;
}

/** A loaf on a surface: a rounded cob, a long loaf, or a plaited one. */
function loafOn(m: IsoModel, x: number, y: number, z: number, kind: number): void {
  const crust = [0xc8843a, 0xb8702e, 0xd89a4a][kind % 3];
  const top: Shader = (u, v) => ((u * 3 + v) % 1 < 0.15 ? 0xf2d8a0 : crust);
  if (kind % 3 === 1) m.box(x, y, z, 0.26, 0.1, 4, { top, left: darken(crust, 0.85), right: darken(crust, 0.7) });
  else m.cylinder(x + 0.07, y + 0.06, z, 0.07, 4, (u) => (u < 0.3 ? crust : darken(crust, 0.8)), top);
}

/** A tall rack of shelves stacked with the day's bread, against the back wall. */
function breadRack(seed: number): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.plankLight, left: lipped(P.plank, P.plankLight), right: P.plankDark };
  for (const x of [0.06, 0.88]) for (const y of [0.04, 0.4]) m.box(x, y, 0, 0.06, 0.06, 64, wood);
  for (let i = 0; i < 4; i++) {
    const z = 6 + i * 15;
    m.box(0.06, 0.04, z, 0.88, 0.42, 2, wood);
    for (let j = 0; j < 3; j++) if (hash(i + seed, j) > 0.15) loafOn(m, 0.12 + j * 0.27, 0.14 + hash(j, i + seed) * 0.12, z + 2, i + j + seed);
  }
  return m;
}

/** The kneading trough, two tiles long: a deep wooden box on legs, dough heaped in it, flour everywhere. */
function kneadingTrough(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.plankLight, left: planks(2, P.plank, P.plankDark, P.plankLight, 5), right: P.plankDark };
  for (const [x, y] of [[0.1, 0.12], [1.82, 0.12], [0.1, 0.8], [1.82, 0.8]]) m.box(x, y, 0, 0.08, 0.08, 16, { top: P.bark, left: P.bark, right: P.barkDark });
  // The trough's sides, and its lid laid as a board for working the dough on.
  const floured: Shader = (u, v) => (hash(Math.floor(u * 40), Math.floor(v * 16)) > 0.55 ? 0xfaf2e2 : 0xd8c8a8);
  m.box(0.04, 0.06, 16, 1.92, 0.88, 12, { top: floured, left: wood.left, right: wood.right });
  // Two great mounds of dough, and a rolling pin.
  const dough: Shader = (u, v) => (hash(Math.floor(u * 9), Math.floor(v * 5)) > 0.8 ? 0xf4e4c4 : 0xe8d2a6);
  m.cylinder(0.55, 0.5, 28, 0.28, 5, (u) => (u < 0.3 ? 0xf4e4c4 : 0xd8c094), dough);
  m.cylinder(0.55, 0.5, 33, 0.16, 2, (u) => (u < 0.3 ? 0xf4e4c4 : 0xd8c094), dough);
  m.cylinder(1.25, 0.5, 28, 0.2, 4, (u) => (u < 0.3 ? 0xf4e4c4 : 0xd8c094), dough);
  m.box(1.5, 0.3, 28, 0.08, 0.45, 2, { top: P.plankLight, left: P.plank, right: P.plankDark });
  // A crock of salt and a scoop.
  m.cylinder(1.75, 0.25, 28, 0.08, 6, (u) => (u < 0.4 ? P.stoneLight : P.stone), 0xf2f2f2);
  return m;
}

/** A stack of split logs for the oven. */
function woodpile(): IsoModel {
  const m = new IsoModel();
  const end: Shader = (u, v) => {
    const r = Math.hypot((u % 0.25) - 0.125, (v % 0.33) - 0.165);
    if (r > 0.12) return P.barkDark;
    return (r * 50) % 1 < 0.3 ? P.plank : P.plankLight;
  };
  m.box(0.1, 0.1, 0, 0.8, 0.7, 30, { top: (u, v) => ((u * 4 + v) % 1 < 0.2 ? P.barkDark : P.bark), left: end, right: (u) => ((u * 6) % 1 < 0.2 ? P.barkDark : P.bark) });
  return m;
}

/** A counter by the door with the morning's loaves laid out on a cloth, and a basket of buns. */
function counter(): IsoModel {
  const m = new IsoModel();
  m.box(0.08, 0.05, 0, 0.84, 0.9, 26, { top: P.plankLight, left: planks(3, P.plank, P.plankDark, P.plankLight, 2), right: P.plankDark });
  m.box(0.12, 0.1, 26, 0.76, 0.8, 1, { top: (u, v) => ((Math.floor(u * 6) + Math.floor(v * 6)) % 2 ? 0xe8e0d0 : 0xb04a3a), left: 0xb04a3a, right: 0x8a3a2a });
  loafOn(m, 0.2, 0.2, 27, 1);
  loafOn(m, 0.5, 0.55, 27, 0);
  loafOn(m, 0.2, 0.6, 27, 2);
  m.cylinder(0.65, 0.3, 27, 0.13, 6, (u, v) => ((u * 10 + v * 3) % 1 < 0.3 ? P.strawDark : P.straw), 0xd89a4a);
  return m;
}

// ---------------------------------------------------------------- registry

/** Draws an animated piece (the forge's coals, the oven's fire) as a strip of frames and its looping animation. */
function animated(scene: Phaser.Scene, key: string, build: (frame: number) => IsoModel, rate: number): void {
  const frames = Array.from({ length: FIRE_FRAMES }, (_, f) => build(f).render());
  const w = Math.max(...frames.map((f) => f.canvas.width));
  const h = Math.max(...frames.map((f) => f.canvas.height));
  const ax = Math.max(...frames.map((f) => f.anchorX));
  const ay = Math.max(...frames.map((f) => f.anchorY));
  const sheet = new PixelCanvas(w * FIRE_FRAMES, h);
  frames.forEach((f, i) => sheet.blit(f.canvas, i * w + ax - f.anchorX, ay - f.anchorY));
  const tex = sheet.toTexture(scene, key);
  for (let f = 0; f < FIRE_FRAMES; f++) tex.add(f, 0, f * w, 0, w, h);
  MODEL_ART[key] = { key, originX: ax / w, originY: ay / h };
  scene.anims.create({ key: `${key}-fire`, frames: [0, 1, 2, 3, 1, 2].map((frame) => ({ key, frame })), frameRate: rate, repeat: -1 });
}

/** The two traders' working strokes, top to bottom and back (see generateWorkFrames). */
const KNEAD_STROKE = [0, 0.35, 0.75, 1, 0.7, 0.3];

export function generateWorkshops(scene: Phaser.Scene): void {
  animated(scene, 'wsh-forge', forge, 6);
  animated(scene, 'wsh-oven', oven, 6);
  registerModel(scene, 'wsh-bellows', bellows().render());
  registerModel(scene, 'wsh-anvil', anvil().render());
  registerModel(scene, 'wsh-quench', quench().render());
  registerModel(scene, 'wsh-toolrack', toolRack().render());
  registerModel(scene, 'wsh-ironrack', ironRack().render());
  registerModel(scene, 'wsh-coal', coalHeap().render());
  registerModel(scene, 'wsh-grindstone', grindstone().render());
  registerModel(scene, 'wsh-breadrack-0', breadRack(0).render());
  registerModel(scene, 'wsh-breadrack-1', breadRack(5).render());
  registerModel(scene, 'wsh-trough', kneadingTrough().render());
  registerModel(scene, 'wsh-woodpile', woodpile().render());
  registerModel(scene, 'wsh-counter', counter().render());
  generateWorkFrames(scene, 'folk-smith', smithModel, HAMMER_STROKE, 8);
  generateWorkFrames(scene, 'folk-baker', bakerModel, KNEAD_STROKE, 6);
}
