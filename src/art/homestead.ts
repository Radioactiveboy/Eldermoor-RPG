import Phaser from 'phaser';
import { FENCE } from './farm';
import { cottageArt, MODEL_ART } from './interior';
import { IsoModel, lipped, planks, RenderedModel, Shader } from './IsoModel';
import { PALETTE as P } from './palette';
import { stoneWallKey } from '../world/Homestead';

/**
 * Putting the Hollow right (see systems/Homestead.ts and world/Homestead.ts):
 * the cottage at each stage of being rebuilt, the heaps of burnt timber dragged
 * out of it, the builder's pile filling up, the timber, reed and stone to be
 * had about the Hollow and the north woods, the improvements made afterwards
 * (a well, herb beds, a workshop, a goat shed, a dry-stone wall), and Iran's
 * little barn.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function register(scene: Phaser.Scene, key: string, m: RenderedModel): void {
  const tex = m.canvas.toTexture(scene, key);
  MODEL_ART[key] = { key, originX: m.anchorX / tex.width, originY: m.anchorY / tex.height };
}

/** New-cut oak, pale and clean. */
const OAK = { top: 0xc29a62, left: 0xa57b4b, right: 0x87603d };
const OAK_END = 0xd8b47a;
/** Charred wood. */
const CHAR = { top: 0x3a2e2a, left: 0x2a2224, right: 0x1d1620 };
const STONE = { top: P.stoneLight, left: P.stone, right: P.stoneDark };

/** A squared timber lying along x (or y), with its pale cut end showing. */
function beam(m: IsoModel, x: number, y: number, z: number, len: number, along: 'x' | 'y', paint = OAK, t = 0.2, h = 6): void {
  if (along === 'x') m.box(x, y, z, len, t, h, { ...paint, right: paint === OAK ? OAK_END : paint.right });
  else m.box(x, y, z, t, len, h, { ...paint, left: paint === OAK ? OAK_END : paint.left });
}

/** A bundle of reed, tied in two places, lying along y. */
function reedBundle(m: IsoModel, x: number, y: number, z: number, len = 0.7): void {
  const side: Shader = (u, v) => {
    if (Math.abs(u - 0.25) < 0.04 || Math.abs(u - 0.75) < 0.04) return P.barkDark;
    return hash(Math.floor(u * 30), Math.floor(v * 6)) < 0.3 ? P.strawDark : v < 0.3 ? P.strawLight : P.straw;
  };
  m.box(x, y, z, 0.24, len, 6, { top: P.strawLight, left: (u, v) => side(v, u), right: P.strawDark });
  m.quad({ x, y: y + len, z: z + 6 }, { x: 0.24, y: 0, z: 0 }, { x: 0, y: 0, z: -6 }, (u, v) => (hash(Math.floor(u * 9), Math.floor(v * 4)) < 0.5 ? P.thatchDark : P.thatch));
}

/** A little keg of nails. */
function keg(m: IsoModel, x: number, y: number, z = 0): void {
  m.cylinder(x, y, z, 0.15, 11, (_u, v) => (Math.abs(v - 0.2) < 0.08 || Math.abs(v - 0.8) < 0.08 ? P.iron : v < 0.5 ? P.plankLight : P.plank), P.plankLight);
  m.box(x - 0.08, y - 0.08, z + 11, 0.16, 0.16, 1, { top: P.ironLight, left: P.iron, right: P.iron });
}

/** A squared block of stone. */
function block(m: IsoModel, x: number, y: number, z: number, s = 0.26, h = 7): void {
  m.box(x, y, z, s, s * 0.8, h, STONE);
}

// ---------------------------------------------------------------- clearing the ruin

/** A heap of burnt timbers dragged out of the shell: charred beams criss-crossed over a mound of ash. */
function rubble(): IsoModel {
  const m = new IsoModel();
  m.box(0.15, 0.2, 0, 0.7, 0.6, 3, { top: P.ashDark, left: 0x4a3a2a, right: 0x3a2e24 });
  for (const [x, y, z, len, along] of [
    [0.1, 0.35, 3, 0.85, 'x'],
    [0.45, 0.05, 5, 0.85, 'y'],
    [0.05, 0.6, 8, 0.75, 'x'],
    [0.25, 0.15, 11, 0.7, 'y'],
  ] as const) beam(m, x, y, z, len, along, CHAR, 0.16, 5);
  // A few embers of old ash, and a scorched pot in the heap.
  m.cylinder(0.75, 0.7, 2, 0.12, 6, () => P.soot, P.ink);
  return m;
}

/** Where a heap lay: a smudge of ash and a few black splinters, low enough to walk over. */
function ashPatch(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.15, z: 0 }, { x: 0.8, y: 0, z: 0 }, { x: 0, y: 0.7, z: 0 }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) + (hash(Math.floor(u * 9), Math.floor(v * 9)) - 0.5) * 0.2;
    if (d > 0.48) return null;
    return d < 0.25 ? P.ashDark : 0x4a3a2a;
  });
  m.box(0.3, 0.4, 0, 0.4, 0.06, 1.5, CHAR);
  m.box(0.55, 0.3, 0, 0.06, 0.3, 1.5, CHAR);
  return m;
}

// ---------------------------------------------------------------- the builder's pile

/**
 * Where the building goods are brought, by the yard: a pegged-out patch with
 * Osric's plans nailed to a post, and the pile growing on it as things come
 * (`fill` 0 nothing yet, 1 a little, 2 well on, 3 all there).
 */
function pile(fill: 0 | 1 | 2 | 3): IsoModel {
  const m = new IsoModel();
  // Bearers on the ground to keep it out of the wet.
  beam(m, 0.15, 0.2, 0, 0.75, 'x', OAK, 0.1, 3);
  beam(m, 0.15, 0.7, 0, 0.75, 'x', OAK, 0.1, 3);
  if (fill >= 1) {
    for (let i = 0; i < 3; i++) beam(m, 0.2 + i * 0.22, 0.15, 3, 0.72, 'y', OAK, 0.2, 5);
  }
  if (fill >= 2) {
    for (let i = 0; i < 2; i++) beam(m, 0.3 + i * 0.22, 0.15, 8, 0.72, 'y', OAK, 0.2, 5);
    reedBundle(m, 0.82, 0.1, 0, 0.75);
  }
  if (fill >= 3) {
    beam(m, 0.4, 0.15, 13, 0.72, 'y', OAK, 0.2, 5);
    reedBundle(m, 0.82, 0.1, 6, 0.75);
    keg(m, 0.15, 0.95);
    block(m, 0.45, 0.9, 0);
  }
  // The post with Osric's plans on it: a sheet of parchment, scrawled in charcoal.
  m.box(0.0, 0.05, 0, 0.08, 0.08, 34, { top: P.barkLight, left: P.bark, right: P.barkDark });
  m.quad({ x: 0.09, y: 0.0, z: 32 }, { x: 0, y: 0.3, z: 0 }, { x: 0, y: 0, z: -16 }, (u, v) => {
    if (u < 0.06 || u > 0.94 || v < 0.05 || v > 0.95) return P.linenDark;
    if ((v * 7) % 1 < 0.18 && u > 0.15 && u < 0.85 - (Math.floor(v * 7) % 3) * 0.12) return 0x3a3036;
    return P.linen;
  });
  return m;
}

// ---------------------------------------------------------------- gathering

/** A fallen oak bough in the grass, or (cut) what's left: a stump of it, chips and sawdust. */
function deadfall(cut: boolean): IsoModel {
  const m = new IsoModel();
  const bark: Shader = (u, v) => (hash(Math.floor(u * 22), Math.floor(v * 4)) < 0.25 ? P.barkDark : v < 0.3 ? P.barkLight : P.bark);
  if (cut) {
    // Chips scattered about, and the stub of the bough left lying.
    for (const [x, y] of [[0.2, 0.3], [0.6, 0.2], [0.7, 0.65], [0.3, 0.75], [0.5, 0.5]]) m.box(x, y, 0, 0.08, 0.06, 1, { top: OAK_END, left: OAK.left, right: OAK.right });
    m.cylinder(0.3, 0.4, 0, 0.16, 6, bark, OAK_END);
    return m;
  }
  // The trunk lying along x, its broken end towards the viewer, a branch sticking up.
  m.box(-0.2, 0.3, 0, 1.4, 0.36, 10, { top: bark, left: bark, right: (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.45 ? ((Math.hypot(u - 0.5, v - 0.5) * 9) % 1 < 0.3 ? 0xb08a58 : OAK_END) : P.barkDark) });
  m.box(0.35, 0.38, 10, 0.08, 0.08, 14, { top: P.barkLight, left: P.bark, right: P.barkDark });
  m.box(0.75, 0.42, 10, 0.06, 0.06, 9, { top: P.barkLight, left: P.bark, right: P.barkDark });
  // Moss along its top and a bracket fungus.
  m.box(0.0, 0.3, 10, 0.6, 0.18, 1, { top: P.moss, left: P.moss, right: P.moss });
  m.box(0.95, 0.66, 4, 0.14, 0.06, 2, { top: 0xd4b07a, left: 0xb08a58, right: 0x8a6239 });
  return m;
}

/** Tall water reed on the lakeshore, gone tawny at the top, or (cut) its short stubble. */
function reeds(cut: boolean): IsoModel {
  const m = new IsoModel();
  for (let i = 0; i < 26; i++) {
    const x = 0.1 + hash(i, 1) * 0.8;
    const y = 0.1 + hash(i, 2) * 0.8;
    const h = cut ? 3 + hash(i, 3) * 2 : 18 + hash(i, 3) * 14;
    const top = cut ? P.strawDark : hash(i, 4) < 0.5 ? P.strawLight : P.straw;
    m.box(x, y, 0, 0.03, 0.03, h, { top, left: (_u, v) => (v < 0.35 ? top : P.leaf), right: (_u, v) => (v < 0.35 ? P.strawDark : P.leafDark) });
    if (!cut && i % 4 === 0) m.box(x - 0.02, y - 0.02, h - 6, 0.07, 0.07, 6, { top: P.barkLight, left: P.bark, right: P.barkDark }); // a seed head
  }
  return m;
}

/** Fallen facing stones from the old watchtower, squared and half sunk in the grass, or (taken) the dents they left. */
function looseStones(taken: boolean): IsoModel {
  const m = new IsoModel();
  if (taken) {
    for (const [x, y] of [[0.2, 0.25], [0.55, 0.5], [0.3, 0.7]]) m.box(x, y, 0, 0.24, 0.2, 0.5, { top: P.dirtDark, left: P.dirtDark, right: P.dirtDark });
    m.box(0.65, 0.2, 0, 0.12, 0.1, 3, STONE);
    return m;
  }
  block(m, 0.15, 0.2, 0, 0.3, 8);
  block(m, 0.55, 0.35, 0, 0.28, 7);
  block(m, 0.3, 0.6, 0, 0.32, 6);
  block(m, 0.35, 0.3, 8, 0.24, 6);
  m.box(0.15, 0.2, 8, 0.3, 0.1, 1, { top: P.moss, left: P.moss, right: P.moss });
  return m;
}

// ---------------------------------------------------------------- improvements

/** A stone well: a round curb of dressed stone, two posts, a little shingled roof and a windlass with a bucket. */
function well(): IsoModel {
  const m = new IsoModel();
  const courses: Shader = (u, v) => {
    const row = Math.floor(v * 4);
    if ((v * 4) % 1 < 0.14) return P.mortar;
    if (((u * 9 + row * 0.5) % 1) < 0.07) return P.mortar;
    const n = hash(Math.floor(u * 9 + row * 0.5), row);
    return n < 0.3 ? P.stoneDark : n > 0.8 ? P.stoneLight : P.stone;
  };
  // The back posts, then the curb, then the front.
  m.box(0.46, 0.12, 0, 0.08, 0.08, 40, { top: P.barkLight, left: P.bark, right: P.barkDark });
  m.cylinder(0.5, 0.5, 0, 0.38, 14, courses, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.36 ? (Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0x0e1a26 : P.stoneDark) : P.stoneLight));
  m.box(0.46, 0.82, 0, 0.08, 0.08, 40, { top: P.barkLight, left: P.bark, right: P.barkDark });
  // The windlass across the top, rope wound on it, the bucket hanging.
  m.box(0.48, 0.12, 30, 0.05, 0.78, 4, { top: P.plankLight, left: P.plank, right: P.plankDark });
  m.box(0.47, 0.42, 28, 0.07, 0.16, 7, { top: P.linen, left: P.linenDark, right: P.linenDark });
  m.box(0.49, 0.5, 18, 0.02, 0.02, 10, { top: P.linenDark, left: P.linenDark, right: P.linenDark });
  m.cylinder(0.5, 0.51, 12, 0.08, 6, (_u, v) => (v < 0.2 ? P.iron : P.plank), 0x0e1a26);
  m.box(0.53, 0.82, 30, 0.22, 0.05, 2, { top: P.ironLight, left: P.iron, right: P.iron }); // the crank
  // A little gable roof of oak shingles.
  const shingles: Shader = (u, v) => ((v * 5) % 1 < 0.2 ? P.plankDark : hash(Math.floor(u * 8 + Math.floor(v * 5) * 0.5), Math.floor(v * 5)) < 0.4 ? P.plank : P.plankLight);
  m.quad({ x: 0.05, y: 0.5, z: 52 }, { x: 0.9, y: 0, z: 0 }, { x: 0, y: -0.5, z: -12 }, shingles);
  m.quad({ x: 0.05, y: 0.5, z: 52 }, { x: 0.9, y: 0, z: 0 }, { x: 0, y: 0.5, z: -12 }, shingles);
  return m;
}

/** What grows in each of the herb beds, and how it looks in flower. */
export const BED_HERBS = ['yarrow', 'comfrey', 'sage'] as const;
export type BedHerb = (typeof BED_HERBS)[number];

const BED_LOOK: Record<BedHerb, { leaf: number; leafDark: number; flower: number; tall: number }> = {
  yarrow: { leaf: P.leafLight, leafDark: P.leaf, flower: P.flowerWhite, tall: 12 },
  comfrey: { leaf: P.leaf, leafDark: P.leafDark, flower: 0x8a5aa8, tall: 10 },
  sage: { leaf: 0x8ea888, leafDark: 0x6a8466, flower: 0x9a8ad0, tall: 8 },
};

/** A raised bed of new oak boards, full of dark soil, with a herb growing in it (or cut back). */
function herbBed(kind: BedHerb, picked: boolean): IsoModel {
  const m = new IsoModel();
  const look = BED_LOOK[kind];
  m.box(0.08, 0.08, 0, 0.84, 0.84, 6, { top: 0x3e2818, left: planks(2, 0xa57b4b, 0x87603d, 0xc29a62, 4), right: planks(2, 0x87603d, 0x6b4a30, 0xa57b4b, 5) });
  const n = picked ? 5 : 11;
  for (let i = 0; i < n; i++) {
    const x = 0.2 + hash(i, 7) * 0.55;
    const y = 0.2 + hash(i, 8) * 0.55;
    const h = picked ? 2 + hash(i, 9) * 2 : look.tall * (0.6 + hash(i, 9) * 0.5);
    m.box(x, y, 6, 0.1, 0.1, h, { top: look.leaf, left: look.leafDark, right: look.leafDark });
    if (!picked && i % 2 === 0) m.box(x - 0.02, y - 0.02, 6 + h, 0.12, 0.12, 2, { top: look.flower, left: look.flower, right: look.leafDark });
  }
  return m;
}

/**
 * A lean-to workshop against the cottage's west wall: two oak posts, a
 * thatched roof sloping down from the wall, a brewing bench with a copper pot
 * and a rack of flasks, and a chopping block.
 */
function workshop(): IsoModel {
  const m = new IsoModel();
  const W = 2;
  const D = 2;
  const H = 34;
  const post = { top: P.barkLight, left: P.bark, right: P.barkDark };
  // The back (wall side) boards: the cottage wall is just behind, so a board back to it.
  m.quad({ x: 0, y: 0, z: H + 14 }, { x: W, y: 0, z: 0 }, { x: 0, y: 0, z: -(H + 14) }, planks(7, 0x87603d, 0x6b4a30, 0xa57b4b, 11));
  m.quad({ x: 0, y: 0, z: H + 14 }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: -(H + 14) }, planks(7, 0x6b4a30, 0x4a3020, 0x87603d, 12));
  // Floor of beaten earth and straw.
  m.quad({ x: 0, y: 0, z: 0 }, { x: W, y: 0, z: 0 }, { x: 0, y: D, z: 0 }, (u, v) => (hash(Math.floor(u * 20), Math.floor(v * 20)) < 0.15 ? P.strawDark : P.dirtDark));
  // The bench along the back, with the copper pot and the flasks.
  m.box(0.15, 0.1, 0, 1.6, 0.45, 16, { top: P.plankLight, left: lipped(P.plank, P.plankLight), right: P.plankDark });
  m.cylinder(0.5, 0.32, 16, 0.16, 10, (u) => (u < 0.3 ? 0xe8a06a : u > 0.7 ? 0x8a4a2a : 0xc87a4a), 0x5a3020);
  for (let i = 0; i < 4; i++) m.cylinder(1.0 + i * 0.16, 0.3, 16, 0.05, 8, () => [P.glassLight, P.glass, 0x8ac06a, 0xd8b060][i], P.barkDark);
  m.box(0.2, 0.05, 30, 1.5, 0.12, 2, { top: P.plankLight, left: P.plank, right: P.plankDark }); // a shelf
  for (let i = 0; i < 5; i++) m.box(0.3 + i * 0.28, 0.05, 32, 0.08, 0.08, 6, { top: P.leafLight, left: P.leaf, right: P.leafDark }); // drying herbs
  // A chopping block by the open side.
  m.cylinder(1.6, 1.4, 0, 0.18, 9, (u) => (u < 0.35 ? P.barkLight : u > 0.7 ? P.barkDark : P.bark), P.ashLight);
  // The front posts and the thatched roof, sloping down from the wall to them.
  m.box(W - 0.12, D - 0.12, 0, 0.1, 0.1, H, post);
  m.box(-0.02, D - 0.12, 0, 0.1, 0.1, H, post);
  m.box(W - 0.12, -0.02, 0, 0.1, 0.1, H + 12, post);
  const thatch: Shader = (u, v) => {
    const row = Math.floor(v * 6);
    const n = hash(Math.floor(u * 40), row);
    if (v > 0.92 || (v * 6) % 1 > 0.82 || n < 0.18) return P.strawDark;
    return n > 0.85 ? P.strawLight : P.straw;
  };
  m.quad({ x: -0.15, y: -0.1, z: H + 16 }, { x: W + 0.3, y: 0, z: 0 }, { x: 0, y: D + 0.25, z: -18 }, thatch);
  m.quad({ x: W + 0.15, y: -0.1, z: H + 16 }, { x: 0, y: D + 0.25, z: -18 }, { x: 0, y: 0, z: -3 }, P.strawDark);
  return m;
}

/** A little goat shed: three board walls and a pent roof, open to the front, with hay inside. */
function goatShed(): IsoModel {
  // A little thatched goat house, two tiles long, its open front to the paddock (south) and hay in the doorway.
  const m = new IsoModel();
  const W = 2;
  const D = 1;
  const H = 20;
  const R = 14;
  const o = 0.16;
  const boards = planks(6, 0xa57b4b, 0x87603d, 0xc29a62, 21);
  const darker = (c: number) => (c === 0xc29a62 ? 0xa57b4b : c === 0xa57b4b ? 0x87603d : 0x6b4a30);
  const thatch: Shader = (u, v) => {
    const row = Math.floor(v * 5);
    const n = hash(Math.floor(u * 34), row);
    if (v > 0.92 || (v * 5) % 1 > 0.8 || n < 0.18) return P.strawDark;
    return n > 0.85 ? P.strawLight : P.straw;
  };
  // The front: boards, with a wide dark opening and a lintel over it.
  m.quad({ x: 0, y: D, z: H }, { x: W, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, (u, v) => {
    const y = (1 - v) * H;
    if (u > 0.2 && u < 0.62 && y < H - 5) return y < 3 && u > 0.24 && u < 0.58 ? P.strawDark : P.ink;
    if (u > 0.18 && u < 0.64 && y < H - 3) return P.plankDark;
    return boards(u, v) ?? 0xa57b4b;
  });
  // The east end, in shade, with its gable.
  m.quad({ x: W, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: -H }, (u, v) => darker(boards(u, v) ?? 0xa57b4b));
  m.quad({ x: W, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => (v > 1 - Math.abs(u * 2 - 1) ? null : darker(boards(u, v * 0.7) ?? 0xa57b4b)));
  // The thatch, both slopes, with a ridge.
  m.quad({ x: -o, y: D / 2, z: H + R }, { x: W + o * 2, y: 0, z: 0 }, { x: 0, y: -D / 2 - o, z: -R - 4 }, thatch);
  m.quad({ x: W + o, y: D / 2, z: H + R }, { x: 0, y: -D / 2 - o, z: -R - 4 }, { x: 0, y: D / 2 + o, z: -R - 4 }, () => P.strawDark);
  m.quad({ x: -o, y: D / 2, z: H + R }, { x: W + o * 2, y: 0, z: 0 }, { x: 0, y: D / 2 + o, z: -R - 4 }, thatch);
  m.box(-o, D / 2 - 0.05, H + R - 2, W + o * 2, 0.1, 3, { top: P.strawLight, left: P.strawDark, right: P.strawDark });
  // Hay spilling out of the door, and a hay rack on the end wall.
  m.box(0.45, D + 0.02, 0, 0.75, 0.3, 3, { top: P.strawLight, left: P.straw, right: P.strawDark });
  m.box(W + 0.02, 0.25, 6, 0.12, 0.5, 6, { top: P.strawLight, left: P.straw, right: P.plankDark });
  return m;
}

/** A piece of dry-stone wall, joined on the sides `mask` says (as the fences are: see farm.ts FENCE). */
function stoneWall(mask: number): IsoModel {
  const m = new IsoModel();
  const H = 15;
  const courses: Shader = (u, v) => {
    const row = Math.floor(v * 4);
    if ((v * 4) % 1 < 0.16) return P.mortar;
    const k = Math.floor(u * 5 + row * 0.5);
    if ((u * 5 + row * 0.5) % 1 < 0.1) return P.mortar;
    const n = hash(k, row);
    return n < 0.3 ? P.stoneDark : n > 0.82 ? P.stoneLight : P.stone;
  };
  const top: Shader = (u, v) => (hash(Math.floor(u * 6), Math.floor(v * 6)) < 0.3 ? P.moss : P.stoneLight);
  const seg = (x: number, y: number, sx: number, sy: number) => m.box(x, y, 0, sx, sy, H, { top, left: courses, right: courses });
  if (mask & FENCE.N) seg(0.32, 0, 0.36, 0.5);
  if (mask & FENCE.W) seg(0, 0.32, 0.5, 0.36);
  seg(0.3, 0.3, 0.4, 0.4);
  if (mask & FENCE.S) seg(0.32, 0.5, 0.36, 0.5);
  if (mask & FENCE.E) seg(0.5, 0.32, 0.5, 0.36);
  return m;
}


/** The yard gate: two stone piers with an oak gate hung between them, along x or y. */
function yardGate(along: 'x' | 'y'): IsoModel {
  const m = new IsoModel();
  const pier = (x: number, y: number) => m.box(x, y, 0, 0.26, 0.26, 22, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  const gate: Shader = (u, v) => {
    if (Math.abs(v - 0.2) < 0.08 || Math.abs(v - 0.75) < 0.08) return P.plankDark;
    if (Math.abs(u - v) < 0.06) return P.plankDark; // the brace
    return (u * 6) % 1 < 0.12 ? P.plankDark : P.plankLight;
  };
  if (along === 'x') {
    pier(-0.13, 0.37);
    m.quad({ x: 0.13, y: 0.5, z: 16 }, { x: 0.74, y: 0, z: 0 }, { x: 0, y: 0, z: -14 }, gate);
    pier(0.87, 0.37);
  } else {
    pier(0.37, -0.13);
    m.quad({ x: 0.5, y: 0.13, z: 16 }, { x: 0, y: 0.74, z: 0 }, { x: 0, y: 0, z: -14 }, gate);
    pier(0.37, 0.87);
  }
  return m;
}

// ---------------------------------------------------------------- Iran's stead

/** Iran's little barn, the last thing on his list: board walls on a stone footing, a steep thatched roof, big doors. */
function barn(): IsoModel {
  const m = new IsoModel();
  const W = 3;
  const D = 2;
  const H = 40;
  const R = 34;
  const o = 0.22;
  const boards = planks(9, 0xa57b4b, 0x87603d, 0xc29a62, 31);
  const thatch: Shader = (u, v) => {
    const row = Math.floor(v * 8);
    const n = hash(Math.floor(u * 50), row);
    if (v > 0.93 || (v * 8) % 1 > 0.82 || n < 0.18) return P.strawDark;
    return n > 0.85 ? P.strawLight : P.straw;
  };
  const wall = (span: number, doors: boolean, dark: boolean): Shader => (u, v) => {
    const y = v * H;
    if (y > H - 6) return [P.stone, P.stoneDark, P.stoneLight][Math.floor(hash(Math.floor(u * span * 6), Math.floor(y / 3)) * 3)];
    if (doors && u > 0.25 && u < 0.75 && y > 6) {
      const du = (u - 0.25) / 0.5;
      if (du < 0.04 || du > 0.96 || y < 8 || Math.abs(du - 0.5) < 0.02) return P.barkDark;
      if (Math.abs(y - 8 - (du % 0.5) * 2 * (H - 14)) < 1.6) return P.plankDark; // the Z braces
      return dark ? 0x87603d : 0xa57b4b;
    }
    const c = boards(u, v) ?? 0xa57b4b;
    return dark ? (c === 0xc29a62 ? 0xa57b4b : c === 0xa57b4b ? 0x87603d : 0x6b4a30) : c;
  };
  m.quad({ x: -o, y: D / 2, z: H + R }, { x: W + o, y: 0, z: 0 }, { x: 0, y: -D / 2 - o, z: -R - 6 }, thatch);
  m.quad({ x: 0, y: D, z: H }, { x: W, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, wall(W, true, false));
  m.quad({ x: W, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: -H }, wall(D, false, true));
  m.quad({ x: W, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => {
    if (v > 1 - Math.abs(u * 2 - 1)) return null;
    if (Math.abs(u - 0.5) < 0.08 && v > 0.3 && v < 0.55) return P.ink; // the loft hatch
    return wall(D, false, true)(u, v * 0.8);
  });
  m.quad({ x: W, y: D / 2, z: H + R }, { x: o, y: 0, z: 0 }, { x: 0, y: -D / 2 - o, z: -R - 6 }, P.strawDark);
  m.quad({ x: -o, y: D / 2, z: H + R }, { x: W + o * 2, y: 0, z: 0 }, { x: 0, y: D / 2 + o, z: -R - 6 }, thatch);
  m.box(-o, D / 2 - 0.06, H + R - 2, W + o * 2, 0.12, 4, { top: P.strawLight, left: P.strawDark, right: P.strawDark });
  // Hay spilling out of the doors, and a cart wheel leant on the wall.
  m.box(1.0, D + 0.02, 0, 1.0, 0.25, 3, { top: P.strawLight, left: P.straw, right: P.strawDark });
  m.cylinder(W + 0.1, 1.5, 0, 0.06, 1, () => P.bark, P.bark);
  m.quad({ x: W + 0.08, y: 1.15, z: 22 }, { x: 0, y: 0.7, z: 0 }, { x: 0, y: 0, z: -22 }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.5) return null;
    if (d > 0.42 || d < 0.08) return P.barkDark;
    return Math.abs(Math.sin(Math.atan2(v - 0.5, u - 0.5) * 3)) < 0.15 ? P.bark : null;
  });
  return m;
}

// ---------------------------------------------------------------- work in progress

/** A sawhorse with a half-sawn length of oak on it, and sawdust under it: the work party's. */
function sawhorse(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.2, z: 0 }, { x: 0.8, y: 0, z: 0 }, { x: 0, y: 0.6, z: 0 }, (u, v) => (hash(Math.floor(u * 14), Math.floor(v * 10)) < 0.5 ? OAK_END : null));
  for (const x of [0.2, 0.75]) {
    m.quad({ x, y: 0.25, z: 0 }, { x: 0, y: 0.25, z: 14 }, { x: 0.05, y: 0, z: 0 }, P.plank);
    m.quad({ x, y: 0.75, z: 0 }, { x: 0, y: -0.25, z: 14 }, { x: 0.05, y: 0, z: 0 }, P.plankDark);
  }
  m.box(0.1, 0.45, 14, 0.85, 0.1, 3, { top: P.plankLight, left: P.plank, right: P.plankDark });
  beam(m, 0.0, 0.4, 17, 1.0, 'x', OAK, 0.2, 5);
  m.box(0.55, 0.38, 22, 0.02, 0.24, 6, { top: P.ironLight, left: P.ironLight, right: P.iron }); // the saw, stuck in the cut
  return m;
}

// ---------------------------------------------------------------- registry

export function generateHomestead(scene: Phaser.Scene): void {
  register(scene, 'bld-cottage-cleared', cottageArt({ cleared: true }));
  for (const day of [0, 1, 2] as const) register(scene, `bld-cottage-raising-${day}`, cottageArt({ raising: day }));
  register(scene, 'bld-cottage-new', cottageArt({ fresh: true }));
  register(scene, 'bld-cottage-slate', cottageArt({ slate: true }));

  register(scene, 'hs-rubble', rubble().render());
  register(scene, 'hs-ash-patch', ashPatch().render());
  for (const fill of [0, 1, 2, 3] as const) register(scene, `hs-pile-${fill}`, pile(fill).render());
  register(scene, 'hs-deadfall', deadfall(false).render());
  register(scene, 'hs-deadfall-cut', deadfall(true).render());
  register(scene, 'hs-reeds', reeds(false).render());
  register(scene, 'hs-reeds-cut', reeds(true).render());
  register(scene, 'hs-stones', looseStones(false).render());
  register(scene, 'hs-stones-taken', looseStones(true).render());
  register(scene, 'hs-sawhorse', sawhorse().render());

  register(scene, 'hs-well', well().render());
  for (const kind of BED_HERBS) {
    register(scene, `hs-bed-${kind}`, herbBed(kind, false).render());
    register(scene, `hs-bed-${kind}-picked`, herbBed(kind, true).render());
  }
  register(scene, 'hs-workshop', workshop().render());
  register(scene, 'hs-goatshed', goatShed().render());
  for (let mask = 0; mask < 16; mask++) register(scene, stoneWallKey(mask), stoneWall(mask).render());
  register(scene, 'hs-gate-x', yardGate('x').render());
  register(scene, 'hs-gate-y', yardGate('y').render());
  register(scene, 'hs-barn', barn().render());
}
