import Phaser from 'phaser';
import { IsoModel, lipped, planks, Shader } from './IsoModel';
import { MODEL_ART } from './interior';
import { PALETTE as P } from './palette';

/**
 * The Crooked Tankard, Adowvale's inn: the bar counter and what's behind it
 * (kegs on a stand, a shelf of bottles and tankards), the stairs up to the
 * rooms, the trapdoor down to the cellar, the notice board, tables laid with
 * tankards, and odds and ends for the rooms upstairs and the cellar below.
 * The counter comes in one-tile pieces so people sort in front of and behind
 * each piece properly.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Dark polished wood for the bar, framed panels on its front. */
const BAR = 0x5a3420;
const BAR_DARK = 0x40241a;
const BAR_LIGHT = 0x7a4a2c;
const BAR_TOP = 0x8a5634;

const panelled = (dark = false): Shader => (u, v) => {
  const f = (c: number) => (dark ? (c === BAR_LIGHT ? BAR : c === BAR ? BAR_DARK : c) : c);
  if (v < 0.08 || v > 0.9) return f(BAR_DARK);
  // One sunk panel per half tile, with a lit top edge.
  const pu = (u * 2) % 1;
  if (pu < 0.12 || pu > 0.88) return f(BAR);
  if (v < 0.18 || v > 0.82) return f(BAR);
  if (v < 0.22) return f(BAR_DARK);
  return f(pu < 0.2 ? BAR_LIGHT : BAR);
};

/** A wooden tankard (with a head of froth) standing on a surface at (x, y, z). */
function tankard(m: IsoModel, x: number, y: number, z: number): void {
  m.cylinder(x, y, z, 0.09, 8, (u, v) => (v > 0.2 && v < 0.3 ? P.iron : u < 0.35 ? P.barkLight : u > 0.75 ? P.barkDark : P.bark), 0xf2e8d0);
  m.box(x + 0.09, y - 0.02, z + 2, 0.05, 0.04, 4, { top: P.barkDark, left: P.barkDark, right: P.barkDark });
}

/** A short candle with its flame, standing at (x, y, z). */
function candle(m: IsoModel, x: number, y: number, z: number): void {
  m.box(x, y, z, 0.07, 0.07, 7, { top: P.fireYellow, left: P.flowerWhite, right: P.linenDark });
  m.box(x + 0.02, y + 0.02, z + 7, 0.03, 0.03, 3, { top: P.fireYellow, left: P.fireOrange, right: P.fireYellow });
}

/** A length of the bar counter, running along x with its front to the room (+y). */
function barStraight(things: number): IsoModel {
  const m = new IsoModel();
  m.box(0, 0.22, 0, 1, 0.56, 26, { top: BAR_TOP, left: panelled(), right: panelled(true) });
  m.box(0, 0.14, 26, 1, 0.72, 3, { top: planks(2, BAR_TOP, BAR_LIGHT, 0xa06a42, 3), left: BAR_LIGHT, right: BAR });
  // A brass foot rail along the front.
  m.box(0, 0.86, 5, 1, 0.04, 2, { top: P.gold, left: 0x9a7430, right: 0x9a7430 });
  if (things === 1) {
    tankard(m, 0.3, 0.5, 29);
    tankard(m, 0.62, 0.42, 29);
  } else if (things === 2) {
    // A jug and a candle.
    m.cylinder(0.4, 0.45, 29, 0.12, 11, (u) => (u < 0.35 ? P.stoneLight : u > 0.75 ? P.stoneDark : P.stone), P.mortar);
    candle(m, 0.72, 0.4, 29);
  }
  return m;
}

/** The end of the bar, turning back towards the wall (it runs along y, with its front to +x). */
function barSide(): IsoModel {
  const m = new IsoModel();
  m.box(0.22, 0, 0, 0.56, 1, 26, { top: BAR_TOP, left: panelled(), right: panelled(true) });
  m.box(0.14, 0, 26, 0.72, 1, 3, { top: BAR_TOP, left: BAR_LIGHT, right: BAR });
  return m;
}

/** The corner where the bar turns. */
function barCorner(): IsoModel {
  const m = new IsoModel();
  m.box(0.22, 0, 0, 0.56, 0.22, 26, { top: BAR_TOP, left: panelled(), right: panelled(true) });
  m.box(0.22, 0.22, 0, 0.78, 0.56, 26, { top: BAR_TOP, left: panelled(), right: panelled(true) });
  m.box(0.14, 0, 26, 0.72, 0.14, 3, { top: BAR_TOP, left: BAR_LIGHT, right: BAR });
  m.box(0.14, 0.14, 26, 0.86, 0.72, 3, { top: BAR_TOP, left: BAR_LIGHT, right: BAR });
  m.box(0.22, 0.86, 5, 0.78, 0.04, 2, { top: P.gold, left: 0x9a7430, right: 0x9a7430 });
  tankard(m, 0.45, 0.45, 29);
  return m;
}

/** Three kegs with brass taps on a heavy stand, against the back wall. */
function kegs(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.plankLight, left: lipped(P.plank, P.plankLight), right: P.plankDark };
  m.box(0.05, 0.05, 0, 1.9, 0.7, 16, wood);
  const staves: Shader = (u, v) => {
    if (Math.abs(v - 0.15) < 0.06 || Math.abs(v - 0.85) < 0.06) return u < 0.4 ? P.ironLight : P.iron;
    if ((u * 9) % 1 < 0.1) return P.barkDark;
    return u < 0.3 ? P.barkLight : u > 0.75 ? P.barkDark : P.bark;
  };
  for (const x of [0.38, 1.0, 1.62]) {
    m.cylinder(x, 0.38, 16, 0.27, 24, staves, (u, v) => ((u + v) * 8 % 1 < 0.15 ? P.bark : P.barkLight));
    m.box(x - 0.03, 0.62, 22, 0.06, 0.12, 3, { top: P.gold, left: 0x9a7430, right: 0x9a7430 });
    m.box(x - 0.02, 0.72, 17, 0.04, 0.04, 6, { top: P.gold, left: P.gold, right: 0x9a7430 });
  }
  return m;
}

/** A tall shelf of bottles, jugs and tankards behind the bar. */
function bottleShelf(): IsoModel {
  const m = new IsoModel();
  const H = 66;
  const bottles = [0x3a6a3a, 0x6a3a22, 0xc8d8d0, 0x8a2a2a, 0x2a4a6a, P.stoneLight];
  const front: Shader = (u, v) => {
    const x = u * 64;
    const y = v * H;
    if (x < 2 || x > 62 || y < 3) return BAR_DARK;
    const shelf = Math.floor((y - 3) / 15);
    const ly = (y - 3) % 15;
    if (ly < 2) return BAR_LIGHT;
    // Bottles of different heights, a gap here and there, and tankards on the lowest shelf.
    const slot = Math.floor(x / 5);
    const n = hash(slot, shelf);
    if (shelf === 3) {
      if (x % 8 > 1 && x % 8 < 6 && ly > 8) return x % 8 < 3 ? P.barkLight : P.bark;
      return P.ink;
    }
    const tall = 5 + n * 7;
    if (n > 0.15 && x % 5 > 0.8 && x % 5 < 4 && ly > 15 - tall) {
      const neck = ly < 15 - tall + 3 && (x % 5 < 1.8 || x % 5 > 3);
      if (neck) return P.ink;
      const col = bottles[Math.floor(n * 97) % bottles.length];
      return x % 5 < 1.8 ? col + 0x181818 : col;
    }
    return P.ink;
  };
  m.box(0.05, 0, 0, 1.9, 0.42, H, { top: BAR_LIGHT, left: front, right: BAR_DARK });
  return m;
}

/**
 * Stairs climbing the back wall: two steps to each tile, numbered 0..2 from
 * the foot. The whole flight rises to just under the ceiling.
 */
function stairs(tile: number): IsoModel {
  const m = new IsoModel();
  const rise = 13;
  for (let k = 0; k < 2; k++) {
    const step = tile * 2 + k;
    const h = (step + 1) * rise;
    const x = k * 0.5;
    m.box(x, 0, 0, 0.5, 0.86, h, {
      top: (u) => (u < 0.15 ? P.plankLight : P.plank),
      left: (_u, v) => (v * h < 3 ? P.plankLight : v * h > h - 2 ? P.plankDark : (Math.floor(v * h) % rise < 2 ? P.plankDark : P.plank)),
      right: P.plankDark,
    });
    // A banister post at each step, and the rail climbing with them.
    m.box(x + 0.4, 0.78, h, 0.06, 0.06, 20, { top: P.barkLight, left: P.bark, right: P.barkDark });
    m.box(x, 0.78, h + 18, 0.5, 0.06, 3, { top: P.barkLight, left: P.bark, right: P.barkDark });
  }
  return m;
}

/** The trapdoor down to the cellar: planks, iron straps and a ring to lift it by, flush with the floor. */
function trapdoor(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.1, z: 0 }, { x: 0.8, y: 0, z: 0 }, { x: 0, y: 0.8, z: 0 }, (u, v) => {
    if (u < 0.05 || u > 0.95 || v < 0.05 || v > 0.95) return P.barkDark;
    if (Math.abs(v - 0.25) < 0.05 || Math.abs(v - 0.75) < 0.05) return u < 0.5 ? P.ironLight : P.iron;
    const r = Math.hypot(u - 0.72, v - 0.5);
    if (r > 0.07 && r < 0.11) return P.ironLight;
    if ((u * 5) % 1 < 0.08) return P.barkDark;
    return v < 0.5 ? P.plank : P.plankDark;
  });
  return m;
}

/** The notice board on the side wall, pinned with bills (the Sight on it says what they are). */
function noticeBoard(): IsoModel {
  const m = new IsoModel();
  const papers = [
    [0.1, 0.12, 0.42, 0.55],
    [0.5, 0.1, 0.88, 0.45],
    [0.15, 0.62, 0.5, 0.9],
    [0.58, 0.55, 0.9, 0.88],
  ];
  m.quad({ x: 0.04, y: 0.12, z: 66 }, { x: 0, y: 0.76, z: 0 }, { x: 0, y: 0, z: -32 }, (u, v) => {
    if (u < 0.05 || u > 0.95 || v < 0.07 || v > 0.93) return P.barkDark;
    for (const [i, [u0, v0, u1, v1]] of papers.entries()) {
      if (u > u0 && u < u1 && v > v0 && v < v1) {
        if (Math.abs(u - (u0 + u1) / 2) < 0.03 && v < v0 + 0.08) return 0xc83a2a; // the pin
        const line = (v - v0) * 32 % 3 < 0.9 && u > u0 + 0.05 && u < u1 - 0.05 && v > v0 + 0.1;
        return line ? 0x6a5a4a : i === 1 ? 0xe8d8a8 : 0xd8ccb0;
      }
    }
    return hash(Math.floor(u * 20), Math.floor(v * 10)) < 0.2 ? 0x8a6a40 : 0x9a7a4c;
  });
  return m;
}

/** A tavern table: tankards, a plate of crusts, a candle stub. */
function tavernTable(seed: number): IsoModel {
  const m = new IsoModel();
  const leg = { top: P.bark, left: P.bark, right: P.barkDark };
  for (const [x, y] of [[0.12, 0.12], [1.78, 0.12], [0.12, 0.78], [1.78, 0.78]]) m.box(x, y, 0, 0.1, 0.1, 26, leg);
  m.box(0, 0, 26, 2, 1, 4, { top: planks(3, P.plank, P.plankDark, P.plankLight, 7 + seed), left: P.plank, right: P.plankDark });
  // Wet rings where tankards have stood, a plate, the tankards and a candle.
  m.cylinder(0.9, 0.5, 30, 0.2, 1, () => P.stoneLight, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.3 ? P.linen : P.stoneLight));
  m.box(0.82, 0.42, 31, 0.15, 0.1, 2, { top: P.dirtLight, left: P.dirt, right: P.dirtDark });
  tankard(m, 0.35, 0.35, 30);
  if (seed % 2 === 0) tankard(m, 1.55, 0.65, 30);
  else tankard(m, 1.35, 0.3, 30);
  candle(m, 1.7, 0.25, 30);
  return m;
}

/** A washstand: a little table with a basin and a jug of water. */
function washstand(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.2, 0.2], [0.72, 0.2], [0.2, 0.72], [0.72, 0.72]]) m.box(x, y, 0, 0.08, 0.08, 22, { top: P.bark, left: P.bark, right: P.barkDark });
  m.box(0.15, 0.15, 22, 0.7, 0.7, 3, { top: P.plankLight, left: P.plank, right: P.plankDark });
  m.cylinder(0.45, 0.5, 25, 0.24, 4, (u) => (u < 0.35 ? P.flowerWhite : P.linenDark), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.35 ? P.glass : P.flowerWhite));
  m.cylinder(0.72, 0.32, 25, 0.08, 12, (u) => (u < 0.4 ? P.flowerWhite : P.linenDark), P.linenDark);
  return m;
}

/** A small table by the wall with a candle on it. */
function sideTable(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.06, 22, (u) => (u < 0.4 ? P.barkLight : P.bark), P.bark);
  m.cylinder(0.5, 0.5, 22, 0.3, 3, (u) => (u < 0.35 ? P.plankLight : P.plankDark), P.plankLight);
  candle(m, 0.46, 0.46, 25);
  return m;
}

/** Grain sacks slumped against each other in the cellar. */
function sacks(): IsoModel {
  const m = new IsoModel();
  const sack: Shader = (u, v) => (v < 0.15 ? P.strawDark : hash(Math.floor(u * 12), Math.floor(v * 8)) < 0.2 ? P.linenDark : u < 0.35 ? P.linen : 0xc8b890);
  m.cylinder(0.32, 0.35, 0, 0.26, 18, sack, P.linenDark);
  m.cylinder(0.68, 0.62, 0, 0.27, 15, sack, P.linenDark);
  m.box(0.6, 0.55, 15, 0.12, 0.12, 4, { top: P.strawDark, left: P.strawDark, right: P.strawDark });
  return m;
}

/** A red runner down the middle of the passage upstairs, `len` tiles long. */
function runner(len: number): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.2, z: 0 }, { x: len - 0.2, y: 0, z: 0 }, { x: 0, y: 0.6, z: 0 }, (u, v) => {
    if (v < 0.08 || v > 0.92) return P.gold;
    if (v < 0.16 || v > 0.84) return P.quiltDark;
    return (Math.floor(u * len * 3) + Math.floor(v * 4)) % 2 ? P.quilt : P.quiltDark;
  });
  return m;
}

/**
 * Old Maud's brewing bench in the cellar, two tiles along the back wall: a
 * scrubbed workbench with a copper still over a little brazier, its pipe
 * running to a glass flask, a stone mortar and pestle, a rack of bottles,
 * bunches of herbs drying, and a candle. Where the hero brews (see
 * systems/Crafting.ts).
 */
function brewingBench(): IsoModel {
  const m = new IsoModel();
  const H = 24;
  const wood = { top: planks(3, P.plankLight, P.plank, P.logLight, 2), left: lipped(P.plank, P.plankLight), right: P.plankDark };
  // Legs and the top, with a shelf underneath full of jars.
  for (const x of [0.08, 1.84]) m.box(x, 0.18, 0, 0.08, 0.64, H - 3, { top: P.plank, left: P.plankDark, right: P.plankDark });
  m.box(0.1, 0.22, 6, 1.8, 0.56, 3, { top: P.plankDark, left: P.plankDark, right: P.plankDark });
  for (const [x, col] of [[0.3, 0x3a6a3a], [0.5, 0x6a3a22], [0.7, P.glassLight], [1.3, 0x8a2a2a], [1.55, 0x2a4a6a]] as Array<[number, number]>) {
    m.cylinder(x, 0.55, 9, 0.07, 7, (u) => (u < 0.35 ? col + 0x202020 : col), P.barkLight);
  }
  m.box(0.04, 0.12, H - 3, 1.92, 0.76, 3, wood);
  // The brazier, glowing, and the copper pot of the still over it.
  m.box(0.22, 0.32, H, 0.36, 0.36, 5, { top: P.ember, left: P.iron, right: P.ironLight });
  const copper: Shader = (u, v) => (v < 0.12 ? 0xe8a060 : u < 0.3 ? 0xd88a4a : u > 0.72 ? 0x8a4a22 : 0xb86a32);
  m.cylinder(0.4, 0.5, H + 5, 0.2, 13, copper, 0xc87a3a);
  // Its domed head, and the copper pipe running across to the flask.
  m.cylinder(0.4, 0.5, H + 18, 0.11, 6, copper, 0xe8a060);
  m.box(0.45, 0.47, H + 21, 0.62, 0.05, 2, { top: 0xe8a060, left: 0xb86a32, right: 0x8a4a22 });
  m.box(1.04, 0.47, H + 6, 0.05, 0.05, 17, { top: 0xe8a060, left: 0xb86a32, right: 0x8a4a22 });
  // The round glass flask catching the drips, a pale blue-green glow inside.
  const glass: Shader = (u, v) => (v < 0.25 ? (u < 0.4 ? P.glassLight : P.glass) : u < 0.3 ? 0xd8fff4 : u > 0.75 ? 0x4a9aa8 : 0x8ad8cc);
  m.cylinder(1.08, 0.52, H, 0.15, 10, glass, 0xc8f4ec);
  m.cylinder(1.08, 0.52, H + 10, 0.05, 5, (u) => (u < 0.4 ? P.glassLight : P.glass), P.glassLight);
  // The stone mortar with its pestle.
  m.cylinder(1.5, 0.42, H, 0.14, 7, (u) => (u < 0.35 ? P.stoneLight : u > 0.75 ? P.stoneDark : P.stone), P.mortar);
  m.box(1.53, 0.38, H + 5, 0.05, 0.05, 10, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  // A couple of stoppered bottles at the back and a candle.
  m.cylinder(1.78, 0.28, H, 0.06, 12, (u) => (u < 0.35 ? 0x5a8a5a : 0x3a6a3a), P.barkLight);
  m.cylinder(1.66, 0.22, H, 0.05, 9, (u) => (u < 0.35 ? 0xaa4a4a : 0x8a2a2a), P.barkLight);
  m.box(1.78, 0.62, H, 0.07, 0.07, 7, { top: P.fireYellow, left: P.flowerWhite, right: P.linenDark });
  m.box(1.8, 0.64, H + 7, 0.03, 0.03, 3, { top: P.fireYellow, left: P.fireOrange, right: P.fireYellow });
  // Bunches of herbs hanging from a rail along the wall behind.
  m.box(0.1, 0.06, H + 40, 1.8, 0.04, 2, { top: P.bark, left: P.barkDark, right: P.barkDark });
  for (const [x, col] of [[0.3, P.leafDark], [0.75, 0x8a9a5a], [1.2, P.leaf], [1.62, 0x9a8a5a]] as Array<[number, number]>) {
    m.box(x, 0.06, H + 26, 0.12, 0.06, 14, { top: col, left: (_u, v) => (v < 0.2 ? P.strawDark : col), right: P.leafDeep });
  }
  return m;
}

function put(scene: Phaser.Scene, key: string, model: IsoModel, outline = true): void {
  const r = model.render(outline);
  const tex = r.canvas.toTexture(scene, key);
  MODEL_ART[key] = { key, originX: r.anchorX / tex.width, originY: r.anchorY / tex.height };
}

export function generateTavern(scene: Phaser.Scene): void {
  for (let i = 0; i < 3; i++) put(scene, `tav-bar-${i}`, barStraight(i));
  put(scene, 'tav-bar-side', barSide());
  put(scene, 'tav-bar-corner', barCorner());
  put(scene, 'tav-kegs', kegs());
  put(scene, 'tav-shelf', bottleShelf());
  for (let i = 0; i < 3; i++) put(scene, `tav-stairs-${i}`, stairs(i));
  put(scene, 'tav-trapdoor', trapdoor(), false);
  put(scene, 'tav-board', noticeBoard(), false);
  for (let i = 0; i < 4; i++) put(scene, `tav-table-${i}`, tavernTable(i));
  put(scene, 'tav-washstand', washstand());
  put(scene, 'tav-sidetable', sideTable());
  put(scene, 'tav-sacks', sacks());
  put(scene, 'tav-runner', runner(8), false);
  put(scene, 'tav-brewbench', brewingBench());
}
