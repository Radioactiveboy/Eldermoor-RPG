import Phaser from 'phaser';
import type { Tones } from './character';
import { darker } from './character';
import { Detail, DIRECTIONS_8, FrameSpec, Hit, limb, Material, Model, renderFrame, Solid } from './figure3d';
import { PixelCanvas } from './PixelCanvas';

/**
 * The wild beasts modelled in 3D, like the folk (see figure3d.ts): each is a
 * handful of rounded solids in body space (x across, y up, z the way it faces;
 * one unit is one pixel), turned to all eight directions and lit from the
 * upper left. Every beast's sheet has 8 rows (DIRECTIONS_8's order) of the
 * same 12 frames: 0-1 standing, 2-5 walking, 6-7 head down (sniffing or
 * grazing), 8 snarling, 9 biting, 10 hurt, 11 dead.
 */

export type V3 = [number, number, number];

/** One of a beast's frames. */
export interface BeastPose {
  /** How far each foot is forward, in pixels: right hind, left hind, right fore, left fore. */
  legs: [number, number, number, number];
  /** How far each foot is lifted off the ground, in the same order. */
  lift?: [number, number, number, number];
  /** Pixels the body sinks (breathing, the stride's contact frames). */
  bob: number;
  head: 'up' | 'sniff' | 'snarl' | 'bite' | 'hurt';
  /** 0 = tail hanging low, 1 = held straight out (alert). */
  tail: number;
  /** Fur standing up along the back. */
  hackles?: boolean;
  /** Head lowered a further pixel (the sniffing nod). */
  nod?: number;
  /** The front of the body raised, in pixels: rearing, or springing into a leap. */
  rise?: number;
}

/** A beast's frame order (see the file comment). */
export const BEAST_FRAME = { snarl: 8, bite: 9, hurt: 10, dead: 11 } as const;
export const BEAST_COLS = 12;

/** A fixed scatter over a surface, so a coat looks grizzled rather than flat; the same every time it's drawn. */
export function speck(h: Hit, size = 1.2): number {
  const n = Math.sin(Math.floor(h.x / size) * 12.9898 + Math.floor(h.y / size) * 78.233 + Math.floor(h.z / size) * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

/** Ellipsoids along a path of points, its radius eased from one to the next: a bent limb or a tail. */
export function chain(points: V3[], radii: number[], material: Material, step = 0.5): Solid[] {
  const out: Solid[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const seg = limb(points[i], points[i + 1], radii[i], radii[i + 1], material, step);
    out.push(...(i > 0 ? seg.slice(1) : seg));
  }
  return out;
}


/** A body's profile along its length: [z, centre y, half-height, half-width] at points from back to front. */
export type Spine = Array<[number, number, number, number]>;

/** The profile's centre y, half-height and half-width at any z, eased between its points. */
export function profile(spine: Spine): (z: number) => [number, number, number] {
  return (z) => {
    for (let i = 1; i < spine.length; i++) {
      if (z <= spine[i][0]) {
        const [z0, y0, h0, w0] = spine[i - 1];
        const [z1, y1, h1, w1] = spine[i];
        const t = Math.max(0, (z - z0) / (z1 - z0));
        return [y0 + (y1 - y0) * t, h0 + (h1 - h0) * t, w0 + (w1 - w0) * t];
      }
    }
    const l = spine[spine.length - 1];
    return [l[1], l[2], l[3]];
  };
}

/**
 * A torso: thin slices along the spine read off its profile (sunk by `bob`),
 * so its surface runs smooth from the haunch to the chest.
 */
export function torso(spine: Spine, bob: number, material: Material, depth = 2.6): Solid[] {
  const at = profile(spine);
  const out: Solid[] = [];
  for (let z = spine[0][0]; z <= spine[spine.length - 1][0]; z += 0.5) {
    const [y, ry, rx] = at(z);
    out.push({ cx: 0, cy: y - bob, cz: z, rx, ry, rz: depth, material });
  }
  return out;
}

const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** Every solid and detail made `k` times bigger (the Wolf Mother). */
export function scaled(model: Model, k: number): Model {
  const mat = (m: Material): Material =>
    typeof m === 'function' ? (h: Hit) => m({ ...h, x: h.x / k, y: h.y / k, z: h.z / k }) : m;
  return {
    solids: model.solids.map((s) => ({ ...s, cx: s.cx * k, cy: s.cy * k, cz: s.cz * k, rx: s.rx * k, ry: s.ry * k, rz: s.rz * k, material: mat(s.material) })),
    details: model.details.map((d) => ({ ...d, x: d.x * k, y: d.y * k, z: d.z * k })),
  };
}

/**
 * Rolls a model a quarter turn onto its side, lying on the ground: its back
 * towards body -x, its feet sticking out towards +x. `height` is the body-space
 * y its spine ran along, `half` its half-width (how high it lies).
 */
export function onItsSide(model: Model, height: number, half: number): Model {
  // Standing (x, y) goes to (height - y, x + half): the body's left side down.
  const to = (x: number, y: number): [number, number] => [height - y, x + half];
  const mat = (m: Material): Material =>
    typeof m === 'function'
      ? (h: Hit) => m({ x: h.y - half, y: height - h.x, z: h.z, nx: h.ny, ny: -h.nx, nz: h.nz })
      : m;
  return {
    solids: model.solids.map((s) => {
      const [x, y] = to(s.cx, s.cy);
      return { ...s, cx: x, cy: y, rx: s.ry, ry: s.rx, material: mat(s.material) };
    }),
    details: model.details.map((d) => {
      const [x, y] = to(d.x, d.y);
      return { ...d, x, y };
    }),
  };
}

/** Moves a model along its length, so it sits in the middle of its frame. */
export function shifted(model: Model, dz: number): Model {
  const mat = (m: Material): Material => (typeof m === 'function' ? (h: Hit) => m({ ...h, z: h.z - dz }) : m);
  return {
    solids: model.solids.map((s) => ({ ...s, cz: s.cz + dz, material: mat(s.material) })),
    details: model.details.map((d) => ({ ...d, z: d.z + dz })),
  };
}

// --- Grey wolf --------------------------------------------------------------

/** A wolf's colours: the grey wolf's, or the Wolf Mother's frost-white. */
export interface WolfCoat {
  deep: number;
  dark: number;
  fur: number;
  light: number;
  buff: number;
  pale: number;
  eye: number;
}

export const GREY_WOLF: WolfCoat = {
  deep: 0x332e38,
  dark: 0x4b4652,
  fur: 0x7a7480,
  light: 0xa29ca6,
  buff: 0x9e8e7c,
  pale: 0xcfc6bb,
  eye: 0xf2b33a,
};

export const WHITE_WOLF: WolfCoat = {
  deep: 0x6e7a90,
  dark: 0x9aa4b8,
  fur: 0xdfe4ec,
  light: 0xf4f6fa,
  buff: 0xd2d8e4,
  pale: 0xffffff,
  eye: 0x7ad8ff,
};

const NOSE = 0x241c26;
const MOUTH = 0x5a1a22;
const TOOTH = 0xf4efe2;

/**
 * A grey wolf: a deep chest and a tucked-up waist, long legs (the hind ones
 * bending back at the hock), a ruff at the neck, a long narrow muzzle and a
 * low brush of a tail. The coat is shaded like a real grey wolf's: a dark
 * saddle, grizzled grey flanks with a buff wash below, a cream belly, chest,
 * throat and cheeks.
 */
export function wolfModel(pose: BeastPose, coat: WolfCoat = GREY_WOLF, dead = false): Model {
  const T = (base: number, shade: number, light: number): Tones => [base, shade, light];
  const DEEP = T(coat.deep, darker(coat.deep), coat.dark);
  const DARK = T(coat.dark, coat.deep, coat.fur);
  const FUR = T(coat.fur, coat.dark, coat.light);
  const LIGHT = T(coat.light, coat.fur, coat.pale);
  const BUFF = T(coat.buff, coat.dark, coat.light);
  const PALE = T(coat.pale, coat.buff, coat.pale);
  const b = pose.bob;
  const lift = pose.lift ?? [0, 0, 0, 0];
  const solids: Solid[] = [];
  const details: Detail[] = [];

  // The body's coat, read off the surface's slope: saddle on top, buff and cream below.
  const body = (h: Hit): Tones => {
    const s = speck(h);
    if ((h.z > 4.5 && h.ny < 0.15) || h.z > 7.4) return s < 0.15 ? LIGHT : PALE; // chest and throat
    if (h.ny > 0.62) return s < 0.14 ? FUR : h.z > -5 && h.z < 4 && h.ny > 0.85 ? DEEP : DARK;
    if (h.ny > 0.3) return s < 0.35 ? FUR : DARK;
    if (h.ny < -0.45) return PALE;
    if (h.ny < -0.1) return s < 0.25 ? LIGHT : BUFF;
    return s < 0.16 ? LIGHT : s > 0.94 ? DARK : FUR;
  };
  const legCoat = (h: Hit): Tones => (h.nz > 0.3 || h.y < 3 ? (speck(h) < 0.3 ? LIGHT : BUFF) : FUR);

  // The torso, hips to chest: the chest deep, the waist tucked up. Thin slices
  // along the spine, read off a profile, so its surface runs smooth.
  const spine: Spine = [
    [-9, 13.8, 3, 3.3],
    [-7.5, 13.7, 3.7, 4.3],
    [-4.5, 14.1, 3.3, 3.9],
    [-1.5, 13.9, 3.6, 4.2],
    [2, 13.4, 4.5, 4.8],
    [4.5, 13.4, 4.8, 5],
    [6, 14.2, 3.8, 4.2],
  ];
  const at = profile(spine);
  solids.push(...torso(spine, b, body));

  // Legs. Fore: shoulder, elbow, a straight foreleg to the paw. Hind: thigh, stifle, back to the hock, the long foot.
  for (const [i, side] of [[0, 1], [1, -1]] as const) {
    const off = pose.legs[i];
    const l = lift[i];
    const x = side * 2.7;
    const hip: V3 = [x, 13.2 - b, -8];
    const stifle: V3 = [x, 9 - b * 0.5, -5.6 + off * 0.4];
    const hock: V3 = [x, 4.2 + l * 0.6, -9.2 + off * 0.8 - l * 0.4];
    const paw: V3 = [x, 1 + l, -8 + off];
    solids.push(...chain([hip, stifle], [2.6, 1.7], body));
    solids.push(...chain([stifle, hock, add(paw, [0, 0.6, -0.4])], [1.6, 1.05, 0.95], legCoat));
    solids.push({ cx: paw[0], cy: paw[1], cz: paw[2] + 0.5, rx: 1.15, ry: 0.85, rz: 1.5, material: legCoat });
  }
  for (const [i, side] of [[2, 1], [3, -1]] as const) {
    const off = pose.legs[i];
    const l = lift[i];
    const x = side * 2.6;
    const shoulder: V3 = [x, 13 - b, 5.6];
    const elbow: V3 = [x, 8 - b * 0.5, 5.4 + off * 0.35];
    const wrist: V3 = [x, 2.6 + l, 6 + off - l * 0.5];
    const paw: V3 = [x, 1 + l, 6.6 + off];
    solids.push(...chain([shoulder, elbow], [2.3, 1.5], body));
    solids.push(...chain([elbow, wrist, paw], [1.25, 1, 0.95], legCoat));
    solids.push({ cx: paw[0], cy: paw[1], cz: paw[2] + 0.4, rx: 1.15, ry: 0.85, rz: 1.5, material: legCoat });
  }

  // The tail: a bushy brush from the rump, low when easy, out straight when roused, black at the tip.
  {
    const droop = ((70 - pose.tail * 58) * Math.PI) / 180;
    const root: V3 = [0, 14.2 - b, -10.6];
    const d: V3 = [0, -Math.sin(droop), -Math.cos(droop)];
    const mid = add(root, d, 4.5);
    const tip = add(add(root, d, 9.5), [0, pose.tail > 0.5 ? 0.6 : -0.8, -0.6]);
    const tail = (h: Hit): Tones => {
      const along = Math.hypot(h.y - root[1], h.z - root[2]);
      if (along > 7.6) return DEEP;
      return h.ny > 0.3 ? (speck(h) < 0.3 ? FUR : DARK) : h.ny < -0.4 ? BUFF : FUR;
    };
    solids.push(...chain([root, mid, tip], [1.5, 2.1, 1.2], tail));
  }

  // Hackles: a crest of fur standing along the back.
  if (pose.hackles) {
    for (let z = -4; z <= 7; z += 1.5) {
      const [cy, ry] = at(z);
      const y = cy - b + ry + 0.3;
      solids.push({ cx: 0, cy: y, cz: z, rx: 0.9, ry: 1.6, rz: 0.8, material: DEEP });
    }
  }

  // Head, by pose: where the skull sits, how the muzzle points (degrees down), the jaw open, the ears.
  const heads = {
    up: { h: [0, 20.2 - b, 12] as V3, pitch: 12, open: 0, earsBack: false },
    sniff: { h: [0, 8.2 - (pose.nod ?? 0), 14.4] as V3, pitch: 62, open: 0, earsBack: false },
    snarl: { h: [0, 15.5 - b, 13.6] as V3, pitch: 4, open: 0.35, earsBack: true },
    bite: { h: [0, 16.5 - b, 16] as V3, pitch: -4, open: 1, earsBack: true },
    hurt: { h: [0, 17.4 - b, 10.6] as V3, pitch: 30, open: 0.15, earsBack: true },
  };
  const hd = dead ? { h: [0, 14, 13.2] as V3, pitch: 0, open: 0.25, earsBack: true } : heads[pose.head];
  const H = hd.h;
  const p = (hd.pitch * Math.PI) / 180;
  const dir: V3 = [0, -Math.sin(p), Math.cos(p)];

  // The neck and its ruff, from between the shoulders up to the skull.
  const neckBase: V3 = [0, 15 - b, 6.2];
  const ruff = (h: Hit): Tones => (h.ny < -0.2 || h.nz > 0.6 ? (speck(h) < 0.2 ? LIGHT : PALE) : h.ny > 0.5 ? DARK : speck(h) < 0.3 ? LIGHT : FUR);
  solids.push(...chain([neckBase, add(H, dir, -1.2)], [3.9, 2.8], ruff));
  for (const side of [-1, 1]) solids.push({ cx: H[0] + side * 2, cy: H[1] - 1.1, cz: H[2] - 0.6, rx: 1.8, ry: 1.9, rz: 1.8, material: PALE });

  // Skull: dark above, pale at the cheeks.
  const skull = (h: Hit): Tones => (h.ny > 0.45 ? DARK : h.ny < -0.3 ? PALE : speck(h) < 0.3 ? LIGHT : FUR);
  solids.push({ cx: H[0], cy: H[1], cz: H[2], rx: 3, ry: 2.8, rz: 3.2, material: skull });

  // Muzzle, long and narrow, grey above and cream below; with the jaw open, a red mouth and white teeth.
  const snout0 = add(add(H, dir, 1.8), [0, 0.2, 0]);
  const snoutTip = add(H, dir, 7.4);
  const muzzle = (h: Hit): Tones => (h.ny > 0.35 ? FUR : PALE);
  solids.push(...limb(snout0, snoutTip, 1.75, 1.1, muzzle));
  solids.push({ cx: snoutTip[0], cy: snoutTip[1] + 0.25, cz: snoutTip[2] + 0.3, rx: 0.9, ry: 0.75, rz: 0.75, material: T(NOSE, NOSE, 0x4a3e4a) });
  if (hd.open > 0) {
    const pj = p + hd.open * 0.6;
    const jd: V3 = [0, -Math.sin(pj), Math.cos(pj)];
    const jawRoot = add(H, [0, -1.4, 0.6]);
    solids.push(...limb(add(jawRoot, jd, 1.5), add(jawRoot, jd, 6.2), 1.05, 0.75, PALE));
    solids.push(...limb(add(jawRoot, dir, 1.6), add(jawRoot, jd, 5), 0.9, 0.7, T(MOUTH, darker(MOUTH), 0xb04a52)));
    for (const side of [-1, 1]) {
      details.push({ ...vec(add(snoutTip, [side * 0.75, -1, -1])), color: TOOTH });
      details.push({ ...vec(add(add(jawRoot, jd, 5.6), [side * 0.6, 0.7, 0])), color: TOOTH });
    }
  }

  // Ears: pointed and upright, or laid flat back when snarling or hurt.
  for (const side of [-1, 1]) {
    const root: V3 = add(H, [side * 1.6, 1.9, -0.9]);
    const tip: V3 = hd.earsBack ? add(H, [side * 2.6, 3, -4.4]) : add(H, [side * 2.1, 5.4, -1.2]);
    solids.push(...limb(root, tip, 1.25, 0.35, DARK, 0.35));
  }

  // Eyes: amber, narrowed shut when hurt or dead.
  const shut = dead || pose.head === 'hurt';
  for (const side of [-1, 1]) {
    const e = add(add(H, dir, 2.2), [side * 1.55, 1.1, 0]);
    details.push({ ...vec(e), color: shut ? NOSE : coat.eye });
  }
  return { solids, details };
}

const vec = (v: V3) => ({ x: v[0], y: v[1], z: v[2] });

const STILL: BeastPose['legs'] = [0, 0, 0, 0];

/** The wolf's frames, in the order of {@link BEAST_FRAME}; the last is laid out stiff for the dead body. */
export const WOLF_POSES: BeastPose[] = [
  { legs: STILL, bob: 0, head: 'up', tail: 0.15 },
  { legs: STILL, bob: 0.6, head: 'up', tail: 0.2 },
  // A trot: diagonal pairs together.
  { legs: [2.5, -2.5, -2.5, 2.5], bob: 0.6, head: 'up', tail: 0.35 },
  { legs: [0, 0, 0, 0], lift: [0, 1.6, 1.6, 0], bob: 0, head: 'up', tail: 0.4 },
  { legs: [-2.5, 2.5, 2.5, -2.5], bob: 0.6, head: 'up', tail: 0.35 },
  { legs: [0, 0, 0, 0], lift: [1.6, 0, 0, 1.6], bob: 0, head: 'up', tail: 0.4 },
  { legs: [0, 0, 1, 1], bob: 0.6, head: 'sniff', tail: 0.1 },
  { legs: [0, 0, 1, 1], bob: 0.6, head: 'sniff', tail: 0.15, nod: 1 },
  { legs: [-1, -1, 1, 1], bob: 1, head: 'snarl', tail: 0.75, hackles: true },
  { legs: [-2, -2, 3, 3], lift: [0, 0, 1, 1], bob: 0, head: 'bite', tail: 0.8 },
  { legs: [-1, 1, -2, -1], bob: 1, head: 'hurt', tail: 0 },
  { legs: [-2, -1, 2, 3], bob: 0, head: 'up', tail: 0.4 },
];

/** The wolf's models are drawn this much bigger than their body-space units. */
const WOLF_SIZE = 1.2;

// --- Wild boar --------------------------------------------------------------

const BOAR_DEEP = 0x1e1814;
const BOAR_DARK = 0x3a2e26;
const BOAR = 0x5c4a3c;
const BOAR_LIGHT = 0x7e6852;
const BOAR_GRIZZLE = 0x9c8670;
const SNOUT = 0xb08478;
const TUSK = 0xf0e6d0;

/**
 * A wild boar: a heavy, wedge-shaped body high at the shoulders and falling
 * away to the rump, on short thick legs with dark hooves; a long head running
 * down to a pink-brown disc of a snout, curling tusks, small pointed ears, a
 * bristling black mane along the spine and a thin twist of a tail. Head poses
 * map to the shared frames: 'sniff' roots at the ground, 'snarl' squares up
 * with the mane raised, 'bite' is the charge, tusks first.
 */
export function boarModel(pose: BeastPose, dead = false): Model {
  const DEEP: Tones = [BOAR_DEEP, BOAR_DEEP, BOAR_DARK];
  const DARK: Tones = [BOAR_DARK, BOAR_DEEP, BOAR];
  const COAT: Tones = [BOAR, BOAR_DARK, BOAR_LIGHT];
  const LIGHT: Tones = [BOAR_LIGHT, BOAR, BOAR_GRIZZLE];
  const b = pose.bob;
  const lift = pose.lift ?? [0, 0, 0, 0];
  const solids: Solid[] = [];
  const details: Detail[] = [];

  // Bristly brown-black coat, darkest along the back, grizzled on the flanks.
  const coat = (h: Hit): Tones => {
    const s = speck(h, 1.4);
    if (h.ny > 0.7) return s < 0.3 ? COAT : DARK;
    if (h.ny < -0.55) return DARK;
    return s < 0.1 ? LIGHT : s > 0.94 ? DARK : COAT;
  };

  // The body: deep and high at the shoulder, sloping down to a rounded rump.
  const spine: Spine = [
    [-10.5, 11.6, 3.6, 4],
    [-9, 11.8, 5, 5.6],
    [-5, 12.3, 5.6, 6.2],
    [0, 13, 6.2, 6.8],
    [4, 13.6, 6.6, 6.8],
    [7, 13.3, 6, 6],
    [8.5, 13, 4.6, 4.8],
  ];
  const at = profile(spine);
  solids.push(...torso(spine, b, coat, 3));

  // Short thick legs, a dark hoof on each.
  const legs: Array<[number, number, number]> = [
    [0, 1, -7.5],
    [1, -1, -7.5],
    [2, 1, 5.5],
    [3, -1, 5.5],
  ];
  for (const [i, side, z] of legs) {
    const off = pose.legs[i];
    const l = lift[i];
    const x = side * 3.6;
    const top: V3 = [x, 10 - b, z];
    const knee: V3 = [x, 4.6 + l * 0.6, z + off * 0.5 + (z < 0 ? -0.6 : 0.3)];
    const foot: V3 = [x, 1.3 + l, z + off];
    solids.push(...chain([top, knee], [3, 1.9], coat));
    solids.push(...chain([knee, foot], [1.8, 1.5], DARK));
    solids.push({ cx: foot[0], cy: foot[1] - 0.3 + 0, cz: foot[2] + 0.4, rx: 1.5, ry: 1, rz: 1.6, material: DEEP });
  }

  // The tail: a thin twist hanging from the rump, a tuft at its end.
  {
    const root: V3 = [0, 13.4 - b, -11];
    const up = pose.head === 'snarl' || pose.head === 'bite' ? 2.5 : 0;
    solids.push(...chain([root, [0, 11 - b + up, -12.6], [0.4, 8.4 - b + up * 1.6, -12.4]], [0.8, 0.6, 0.55], DARK, 0.35));
    solids.push({ cx: 0.4, cy: 7.8 - b + up * 1.6, cz: -12.3, rx: 0.9, ry: 1.2, rz: 0.9, material: DEEP });
  }

  // The mane: stiff black bristles along the spine, standing tall when it's roused.
  const roused = !!pose.hackles || pose.head === 'snarl' || pose.head === 'bite';
  for (let z = -6; z <= 9; z += 1.2) {
    const [cy, ry] = at(Math.min(z, 8.5));
    const t = (z + 6) / 15;
    const tall = (roused ? 2.2 : 1.3) * (0.5 + t * 0.6);
    solids.push({ cx: 0, cy: cy - b + ry + tall * 0.4, cz: z, rx: 1.2, ry: tall, rz: 0.8, material: DEEP });
  }

  // The head, by pose: where the skull sits and how far the snout points down (degrees).
  const heads = {
    up: { h: [0, 12.6 - b, 10.6] as V3, pitch: 24, earsBack: false },
    sniff: { h: [0, 8.4 - b - (pose.nod ?? 0), 11] as V3, pitch: 52, earsBack: false },
    snarl: { h: [0, 11.2 - b, 11] as V3, pitch: 30, earsBack: true },
    bite: { h: [0, 9.6 - b, 12.6] as V3, pitch: 36, earsBack: true },
    hurt: { h: [0, 13.6 - b, 9.6] as V3, pitch: 12, earsBack: true },
  };
  const hd = dead ? { h: [0, 11.6, 10.8] as V3, pitch: 16, earsBack: true } : heads[pose.head];
  const H = hd.h;
  const p = (hd.pitch * Math.PI) / 180;
  const dir: V3 = [0, -Math.sin(p), Math.cos(p)];
  const head = (h: Hit): Tones => (h.ny > 0.5 ? DARK : h.ny < -0.4 ? DARK : speck(h, 1) < 0.15 ? LIGHT : COAT);
  // Neck into a big, long wedge of a head.
  solids.push(...chain([[0, 12.6 - b, 7.5], H], [5, 4.2], coat));
  solids.push({ cx: H[0], cy: H[1], cz: H[2], rx: 3.9, ry: 4.1, rz: 3.8, material: head });
  const tip = add(H, dir, 8.2);
  solids.push(...limb(add(H, dir, 2), tip, 3.2, 1.75, head));
  // The snout's flat disc, with two nostrils.
  const disc = add(tip, dir, 1.1);
  solids.push({ cx: disc[0], cy: disc[1], cz: disc[2], rx: 2.1, ry: 1.8, rz: 0.8, material: [SNOUT, 0x8a6458, 0xcca094] });
  for (const side of [-1, 1]) details.push({ ...vec(add(add(disc, dir, 0.8), [side * 0.8, 0, 0])), color: BOAR_DEEP });
  // Tusks curling up and out of the lower jaw.
  for (const side of [-1, 1]) {
    const root = add(add(H, dir, 5.6), [side * 1.6, -1.6, 0]);
    const curl = add(root, [side * 0.9, 2.1, 0.9]);
    const end = add(curl, [side * 0.1, 1.2, -0.7]);
    solids.push(...chain([root, curl, end], [0.65, 0.5, 0.3], [TUSK, 0xc8bca4, 0xffffff], 0.3));
  }
  // Small pointed ears, laid back when it's angry or hurt.
  for (const side of [-1, 1]) {
    const root = add(H, [side * 2.4, 3, -1.4]);
    const end = hd.earsBack ? add(H, [side * 3.6, 4.4, -4.6]) : add(H, [side * 3.3, 6.2, -1.6]);
    solids.push(...limb(root, end, 1.3, 0.35, DARK, 0.35));
  }
  // Small eyes, red-rimmed when roused; shut when hurt or dead.
  const shut = dead || pose.head === 'hurt';
  for (const side of [-1, 1]) {
    const e = add(add(H, dir, 2.6), [side * 2.55, 1.4, 0]);
    details.push({ ...vec(e), color: shut ? BOAR_DEEP : roused ? 0xc04a2a : 0x140c0c });
  }
  return { solids, details };
}

/** The boar's frames, in the order of {@link BEAST_FRAME}. */
export const BOAR_POSES: BeastPose[] = [
  { legs: STILL, bob: 0, head: 'up', tail: 0 },
  { legs: STILL, bob: 0.6, head: 'up', tail: 0 },
  { legs: [2, -2, -2, 2], bob: 0.6, head: 'up', tail: 0 },
  { legs: [0, 0, 0, 0], lift: [0, 1.5, 1.5, 0], bob: 0, head: 'up', tail: 0 },
  { legs: [-2, 2, 2, -2], bob: 0.6, head: 'up', tail: 0 },
  { legs: [0, 0, 0, 0], lift: [1.5, 0, 0, 1.5], bob: 0, head: 'up', tail: 0 },
  { legs: [0, 0, 1, 1], bob: 0.6, head: 'sniff', tail: 0 },
  { legs: [0, 0, 1, 1], bob: 1, head: 'sniff', tail: 0, nod: 1 },
  { legs: [-1, -1, 1, 1], bob: 0.4, head: 'snarl', tail: 0, hackles: true },
  { legs: [-3, -3, 3, 3], lift: [0, 0, 1, 1], bob: 0, head: 'bite', tail: 0 },
  { legs: [-1, 1, -2, -1], bob: 0.6, head: 'hurt', tail: 0 },
  { legs: [-2, -1, 2, 3], bob: 0, head: 'up', tail: 0 },
];

export function boarSpec(): FrameSpec {
  return { w: 56, h: 46, feetY: 36, groundShade: 3 };
}

export function boarSheet(): BeastSheet {
  const models = BOAR_POSES.map((pose, i) => {
    const dead = i === BEAST_FRAME.dead;
    let m = shifted(boarModel(pose, dead), -1);
    if (dead) m = onItsSide(m, 12.4, 5.4);
    return scaled(m, BOAR_SIZE);
  });
  return { spec: boarSpec(), models };
}

/** The boar's models are drawn this much bigger than their body-space units. */
const BOAR_SIZE = 1.15;

// --- Red deer ---------------------------------------------------------------

const DEER_DEEP = 0x4a2616;
const DEER_DARK = 0x6a3a22;
const DEER = 0x9a5a32;
const DEER_LIGHT = 0xb87a4a;
const DEER_PALE = 0xe6d2ae;
const ANTLER = 0xd8c8a4;
const ANTLER_DARK = 0xa08a64;
const HOOF = 0x2a1e18;

/**
 * A red deer stag: a long slim body on tall thin legs, a deep chest, a long
 * neck with a shaggy mane, a narrow head with big ears and a dark muzzle, a
 * pale rump with a short tail, and a pair of branching antlers. Head poses:
 * 'sniff' grazes, 'snarl' stands alert with its head high and tail flicked up,
 * 'bite' rears and strikes with its forehooves.
 */
export function deerModel(pose: BeastPose, dead = false): Model {
  const DEEP: Tones = [DEER_DEEP, DEER_DEEP, DEER_DARK];
  const DARK: Tones = [DEER_DARK, DEER_DEEP, DEER];
  const COAT: Tones = [DEER, DEER_DARK, DEER_LIGHT];
  const PALE: Tones = [DEER_PALE, 0xbda889, 0xfaf0d8];
  const BONE: Tones = [ANTLER, ANTLER_DARK, 0xf4eada];
  const b = pose.bob;
  const r = pose.rise ?? 0;
  const lift = pose.lift ?? [0, 0, 0, 0];
  const solids: Solid[] = [];
  const details: Detail[] = [];

  // Russet coat, pale under the belly, a cream patch round the rump.
  const coat = (h: Hit): Tones => {
    if (h.z < -7.5 && h.ny > -0.2) return PALE;
    if (h.ny < -0.35) return PALE;
    if (h.ny > 0.6) return speck(h, 1.4) < 0.25 ? DARK : COAT;
    return COAT;
  };

  // A long, slim body: the chest deep, the belly shallow, the rump rounded.
  const spine: Spine = [
    [-9.5, 20, 2.8, 2.8],
    [-8, 20.2, 4.1, 4],
    [-4, 20.4, 3.9, 3.8],
    [0, 20.3, 4.1, 3.9],
    [4, 20.4, 4.6, 4],
    [6.5, 20.6, 4.2, 3.6],
  ];
  const tilt = (z: number) => r * ((z + 9.5) / 16) * 1.2;
  const at = profile(spine);
  for (let z = spine[0][0]; z <= spine[spine.length - 1][0]; z += 0.5) {
    const [y, ry, rx] = at(z);
    solids.push({ cx: 0, cy: y - b + tilt(z), cz: z, rx, ry, rz: 2.4, material: coat });
  }

  // Tall thin legs: the hind ones angled back at the hock, the forelegs straight.
  for (const [i, side] of [[0, 1], [1, -1]] as const) {
    const off = pose.legs[i];
    const l = lift[i];
    const x = side * 2.4;
    const hip: V3 = [x, 19 - b, -7.5];
    const stifle: V3 = [x, 12 - b, -5.6 + off * 0.3];
    const hock: V3 = [x, 7.4 + l * 0.5, -8.6 + off * 0.7 - l * 0.3];
    const hoof: V3 = [x, 1 + l, -7.6 + off];
    solids.push(...chain([hip, stifle], [2.5, 1.3], coat));
    solids.push(...chain([stifle, hock, [hoof[0], hoof[1] + 1, hoof[2]]], [1.2, 0.8, 0.6], DARK, 0.4));
    solids.push({ cx: hoof[0], cy: hoof[1], cz: hoof[2], rx: 0.8, ry: 0.9, rz: 1, material: [HOOF, HOOF, 0x4a3a30] });
  }
  for (const [i, side] of [[2, 1], [3, -1]] as const) {
    const off = pose.legs[i];
    const l = lift[i] + r * 2.4;
    const x = side * 2.4;
    const shoulder: V3 = [x, 19 - b + r * 1.2, 5];
    const elbow: V3 = [x, 12.5 - b + l * 0.5, 5 + off * 0.3 + r * 0.9];
    const knee: V3 = [x, 6.5 + l * 0.8, 5.6 + off * 0.6 + r * 1.3];
    const hoof: V3 = [x, 1 + l, 5.8 + off + r * 1.4];
    solids.push(...chain([shoulder, elbow], [2.3, 1.2], coat));
    solids.push(...chain([elbow, knee, [hoof[0], hoof[1] + 1, hoof[2]]], [1.1, 0.75, 0.6], DARK, 0.4));
    solids.push({ cx: hoof[0], cy: hoof[1], cz: hoof[2], rx: 0.8, ry: 0.9, rz: 1, material: [HOOF, HOOF, 0x4a3a30] });
  }

  // Pale rump and a short tail, flicked up when it's alarmed.
  const roused = pose.head === 'snarl' || pose.head === 'bite';
  solids.push({ cx: 0, cy: 20.6 - b, cz: -9.6, rx: 2.6, ry: 2.8, rz: 1.4, material: PALE });
  solids.push(...chain([[0, 20.4 - b, -10.4], [0, roused ? 23.4 - b : 17.6 - b, roused ? -11.6 : -10.8]], [0.9, 0.7], roused ? PALE : DARK, 0.4));

  // The head: up, grazing, alert (held high), rearing, or flinching.
  const heads = {
    up: { h: [0, 32 - b, 8.4] as V3, pitch: 34, neck: 0 },
    sniff: { h: [0, 4.6 - (pose.nod ?? 0), 11] as V3, pitch: 76, neck: 0 },
    snarl: { h: [0, 35.5 - b, 7] as V3, pitch: 16, neck: 0 },
    bite: { h: [0, 38 - b, 11.5] as V3, pitch: 30, neck: 0 },
    hurt: { h: [0, 28 - b, 9.6] as V3, pitch: 50, neck: 0 },
  };
  const hd = dead ? { h: [0, 22, 11] as V3, pitch: 50 } : heads[pose.head];
  const H = hd.h;
  const p = (hd.pitch * Math.PI) / 180;
  const dir: V3 = [0, -Math.sin(p), Math.cos(p)];

  // A long neck with a shaggy mane down its front.
  const mane = (h: Hit): Tones => (h.nz > 0.3 ? (speck(h, 1.2) < 0.3 ? DARK : DEEP) : h.ny > 0.4 ? DARK : COAT);
  solids.push(...chain([[0, 21.5 - b + r * 1.2, 5.4], [(H[0] + 0) / 2, (H[1] + 21.5 - b) / 2, (H[2] + 5.4) / 2], add(H, dir, -1.5)], [4, 2.8, 2.2], mane));

  // A narrow head down to a dark muzzle.
  const head = (h: Hit): Tones => (h.ny < -0.4 ? PALE : h.ny > 0.5 ? DARK : COAT);
  solids.push({ cx: H[0], cy: H[1], cz: H[2], rx: 2.3, ry: 2.5, rz: 2.4, material: head });
  const tip = add(H, dir, 5.4);
  solids.push(...limb(add(H, dir, 1.4), tip, 1.9, 1.3, head));
  solids.push({ cx: tip[0], cy: tip[1], cz: tip[2] + 0.2, rx: 1.2, ry: 1, rz: 0.9, material: [DEER_DEEP, 0x2e1810, DEER_DARK] });

  // Big ears, turned out to the sides.
  for (const side of [-1, 1]) {
    const root = add(H, [side * 1.8, 1.6, -1]);
    const end = pose.head === 'hurt' || dead ? add(H, [side * 3.4, 2, -4.2]) : add(H, [side * 4.4, 4.4, -2]);
    solids.push(...limb(root, end, 1.2, 0.9, DARK, 0.35));
  }

  // Antlers: a beam from each pedicle curving up and back, with three tines.
  if (!dead || true) {
    for (const side of [-1, 1]) {
      const base = add(H, [side * 1.3, 2.4, 0.2]);
      const beam: V3[] = [base, add(base, [side * 1.4, 4, -1.6]), add(base, [side * 2.4, 7.6, -3.6]), add(base, [side * 2.6, 10.6, -6.6])];
      solids.push(...chain(beam, [0.75, 0.6, 0.5, 0.4], BONE, 0.35));
      // Brow, bay and top tines, forwards off the beam.
      solids.push(...limb(add(base, [side * 0.9, 2.4, -0.8]), add(base, [side * 1.4, 4, 2.6]), 0.5, 0.3, BONE, 0.3));
      solids.push(...limb(add(base, [side * 2, 6.2, -2.8]), add(base, [side * 2.8, 8.2, 0.4]), 0.45, 0.3, BONE, 0.3));
      solids.push(...limb(add(base, [side * 2.5, 9.4, -5.4]), add(base, [side * 3.6, 12, -4.4]), 0.4, 0.28, BONE, 0.3));
    }
  }

  // Dark eyes, shut when hurt or dead.
  const shut = dead || pose.head === 'hurt';
  for (const side of [-1, 1]) details.push({ ...vec(add(add(H, dir, 1.6), [side * 1.95, 0.9, 0])), color: shut ? DEER_DEEP : 0x140c0c });
  return { solids, details };
}

/** The deer's frames, in the order of {@link BEAST_FRAME}. */
export const DEER_POSES: BeastPose[] = [
  { legs: STILL, bob: 0, head: 'up', tail: 0 },
  { legs: STILL, bob: 0.6, head: 'up', tail: 0 },
  { legs: [3, -3, -3, 3], bob: 0.6, head: 'up', tail: 0 },
  { legs: [0, 0, 0, 0], lift: [0, 2.2, 2.2, 0], bob: 0, head: 'up', tail: 0 },
  { legs: [-3, 3, 3, -3], bob: 0.6, head: 'up', tail: 0 },
  { legs: [0, 0, 0, 0], lift: [2.2, 0, 0, 2.2], bob: 0, head: 'up', tail: 0 },
  { legs: [0, 0, 1, 1.6], bob: 0.6, head: 'sniff', tail: 0 },
  { legs: [0, 0, 1, 1.6], bob: 1, head: 'sniff', tail: 0, nod: 1 },
  { legs: [-1, -1, 1, 1], bob: 0, head: 'snarl', tail: 0 },
  { legs: [-2, -1.5, 1, 1.5], bob: 0, head: 'bite', tail: 0, rise: 4 },
  { legs: [-1, 1, -2, -1], bob: 1, head: 'hurt', tail: 0 },
  { legs: [-3, -1.5, 2.5, 4], bob: 0, head: 'up', tail: 0 },
];

export function deerSpec(): FrameSpec {
  return { w: 58, h: 62, feetY: 52, groundShade: 4 };
}

export function deerSheet(): BeastSheet {
  const models = DEER_POSES.map((pose, i) => {
    const dead = i === BEAST_FRAME.dead;
    let m = shifted(deerModel(pose, dead), -1);
    if (dead) m = onItsSide(m, 20.4, 3.8);
    return m;
  });
  return { spec: deerSpec(), models };
}

// --- Sheets -----------------------------------------------------------------

/** How a beast's frames are cut, and its 12 models (the last one dead). */
export interface BeastSheet {
  spec: FrameSpec;
  models: Model[];
}

/** Every frame of a beast: rows = 8 directions, cols = the 12 frames. */
export function drawBeastSheet(sheet: BeastSheet): PixelCanvas {
  const { w, h } = sheet.spec;
  const out = new PixelCanvas(w * sheet.models.length, h * DIRECTIONS_8.length);
  DIRECTIONS_8.forEach((d, row) => {
    sheet.models.forEach((m, col) => {
      const frame = renderFrame(m, d.angle, sheet.spec);
      frame.outline();
      out.blit(frame, col * w, row * h);
    });
  });
  return out;
}

/**
 * Registers 'creature-<kind>' (frame row * 12 + col) and '<kind>-idle-<dir>',
 * '-walk-' and '-sniff-' for all eight directions.
 */
export function generateBeast(scene: Phaser.Scene, kind: string, sheet: BeastSheet, walkRate: number): void {
  const key = `creature-${kind}`;
  const { w, h } = sheet.spec;
  const cols = sheet.models.length;
  const tex = drawBeastSheet(sheet).toTexture(scene, key);
  for (let row = 0; row < DIRECTIONS_8.length; row++) {
    for (let col = 0; col < cols; col++) tex.add(row * cols + col, 0, col * w, row * h, w, h);
  }
  DIRECTIONS_8.forEach((d, row) => {
    const list = (ids: number[]) => ids.map((i) => ({ key, frame: row * cols + i }));
    scene.anims.create({ key: `${kind}-idle-${d.name}`, frames: list([0, 1]), frameRate: 1.5, repeat: -1 });
    scene.anims.create({ key: `${kind}-walk-${d.name}`, frames: list([2, 3, 4, 5]), frameRate: walkRate, repeat: -1 });
    scene.anims.create({ key: `${kind}-sniff-${d.name}`, frames: list([6, 7, 6, 6, 7, 7, 6]), frameRate: 5, repeat: -1 });
  });
}

/** The wolf's frame, `size` times as big (the Wolf Mother). */
export function wolfSpec(size = 1): FrameSpec {
  const k = size * WOLF_SIZE;
  return { w: Math.ceil(50 * k), h: Math.ceil(40 * k), feetY: Math.round(32 * k), groundShade: 3 * k };
}

/** The wolf's sheet, in a coat; `size` scales it up (the Wolf Mother). */
export function wolfSheet(coat: WolfCoat, size = 1): BeastSheet {
  const spec = wolfSpec(size);
  size *= WOLF_SIZE;
  const models = WOLF_POSES.map((pose, i) => {
    const dead = i === BEAST_FRAME.dead;
    let m = shifted(wolfModel(pose, coat, dead), -2);
    if (dead) m = onItsSide(m, 13.4, 3.4);
    return scaled(m, size);
  });
  return { spec, models };
}
