import Phaser from 'phaser';
import { MODEL_ART } from './interior';
import { IsoModel, lipped, planks, RenderedModel, Shader } from './IsoModel';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Farmer Iran's smallholding on the hill north of the cottage: his little
 * thatched hut, the hen coop and water trough in the pen, and the hens
 * themselves (see entities/Hen.ts).
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function register(scene: Phaser.Scene, key: string, m: RenderedModel): void {
  const tex = m.canvas.toTexture(scene, key);
  MODEL_ART[key] = { key, originX: m.anchorX / tex.width, originY: m.anchorY / tex.height };
}

/** Weathered boards, a touch greyer than the cottage's logs. */
const BOARD = 0x7a6448;
const BOARD_DARK = 0x58462f;
const BOARD_LIGHT = 0x957d5a;

/** Footprint of the hut in tiles: 2 along x, 3 along y. Its door is in the middle of the +x side. */
export const HUT_W = 2;
export const HUT_D = 3;
const HUT_H = 44;
const HUT_R = 34;
/** The top of the hut's chimney, relative to its back corner, for the smoke. */
export const HUT_CHIMNEY = { gx: 0.5, gy: 0.75, z: HUT_H + HUT_R + 16 };

/** A small board-walled hut with a thatched roof, a stone chimney, a door on the +x side and a window in front. */
function hut(): IsoModel {
  const m = new IsoModel();
  const W = HUT_W;
  const D = HUT_D;
  const H = HUT_H;
  const R = HUT_R;
  const o = 0.24;
  const boards = planks(8, BOARD, BOARD_DARK, BOARD_LIGHT, 9);
  const thatch: Shader = (u, v) => {
    const row = Math.floor(v * 7);
    const lv = (v * 7) % 1;
    const n = hash(Math.floor(u * 44), row);
    if (v > 0.93 || lv > 0.8 || n < 0.2) return P.thatchDark;
    if (n > 0.85 || lv < 0.15) return P.thatchLight;
    return P.thatch;
  };
  const shade = (c: number) => (c === BOARD_LIGHT ? BOARD : c === BOARD ? BOARD_DARK : c === BOARD_DARK ? P.barkDark : c);
  const wall = (span: number, window: [number, number] | null, door: [number, number] | null, dark: boolean): Shader => (u, v) => {
    const x = u * span * 32;
    const y = v * H;
    if (y > H - 6) return [P.stone, P.stoneDark, P.stoneLight][Math.floor(hash(Math.floor(x / 5), Math.floor(y / 3)) * 3)];
    if (u < 0.03 || u > 0.97) return dark ? P.barkDark : P.bark;
    if (door && u > door[0] && u < door[1] && y > 10) {
      const du = (u - door[0]) / (door[1] - door[0]);
      if (du < 0.1 || du > 0.9 || y < 12) return P.barkDark;
      if ((y > 18 && y < 21) || (y > 32 && y < 35)) return P.iron;
      if (Math.abs(du - 0.2) < 0.06 && Math.abs(y - 27) < 1.5) return P.gold; // latch
      if ((du * 4) % 1 < 0.12) return P.leatherDark;
      return dark ? P.leatherDark : P.leather;
    }
    if (window && u > window[0] && u < window[1] && y > 12 && y < 28) {
      const wu = (u - window[0]) / (window[1] - window[0]);
      if (wu < 0.12 || wu > 0.88 || y < 14 || y > 26) return P.barkDark;
      if (Math.abs(wu - 0.5) < 0.07) return P.bark;
      return y < 20 ? P.glassLit : P.fireOrange;
    }
    if (window && u > window[0] - 0.03 && u < window[1] + 0.03 && y >= 28 && y < 30) return P.plankLight;
    const c = boards(u, v * 0.9) ?? BOARD;
    return dark ? shade(c) : c;
  };
  // Back roof slope, then the chimney poking through it.
  m.quad({ x: -o, y: D / 2, z: H + R }, { x: W + o, y: 0, z: 0 }, { x: 0, y: -D / 2 - o, z: -R - 6 }, thatch);
  m.box(0.3, 0.55, H, 0.4, 0.4, R + 16, {
    top: P.soot,
    left: (u, v) => ((v * 6) % 1 < 0.15 || (u * 3 + Math.floor(v * 6) * 0.5) % 1 < 0.1 ? P.mortar : P.stone),
    right: (_u, v) => ((v * 6) % 1 < 0.15 ? P.mortar : P.stoneDark),
  });
  // The front (+y) wall with its window, and the door side (+x).
  m.quad({ x: 0, y: D, z: H }, { x: W, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, wall(W, [0.3, 0.7], null, false));
  m.quad({ x: W, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: -H }, wall(D, null, [0.37, 0.63], true));
  // The gable over the door, with a bundle of drying herbs hung under the eaves.
  m.quad({ x: W, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => {
    if (v > 1 - Math.abs(u * 2 - 1)) return null;
    if (v < 0.06) return BOARD_DARK;
    return shade(boards(u, v) ?? BOARD);
  });
  m.quad({ x: W, y: D / 2, z: H + R }, { x: o, y: 0, z: 0 }, { x: 0, y: -D / 2 - o, z: -R - 6 }, P.thatchDark);
  m.quad({ x: -o, y: D / 2, z: H + R }, { x: W + o * 2, y: 0, z: 0 }, { x: 0, y: D / 2 + o, z: -R - 6 }, thatch);
  m.box(-o, D / 2 - 0.06, H + R - 2, W + o * 2, 0.12, 4, { top: P.thatchLight, left: P.thatchDark, right: P.thatchDark });
  // A chopping block with an axe, and a stack of firewood against the front wall.
  m.cylinder(W + 0.3, 2.65, 0, 0.18, 9, (u) => (u < 0.35 ? P.barkLight : u > 0.7 ? P.barkDark : P.bark), P.ashLight);
  m.box(W + 0.27, 2.6, 9, 0.05, 0.05, 10, { top: P.barkLight, left: P.bark, right: P.barkDark });
  m.box(W + 0.22, 2.55, 17, 0.14, 0.03, 3, { top: P.ironLight, left: P.ironLight, right: P.iron });
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4 - row; i++) {
      m.cylinder(0.25 + i * 0.22 + row * 0.11, D + 0.14, row * 6, 0.11, 6, (u) => (u < 0.4 ? P.barkLight : P.bark), P.ashLight);
    }
  }
  return m;
}

/** A hen house on stilts: board walls, a sloping roof, a pop-hole and a ramp down on the +x side. */
function coop(): IsoModel {
  const m = new IsoModel();
  const legs = { top: P.bark, left: P.bark, right: P.barkDark };
  for (const [x, y] of [[0.12, 0.12], [1.38, 0.12], [0.12, 0.78], [1.38, 0.78]]) m.box(x, y, 0, 0.08, 0.08, 10, legs);
  const boards: Shader = (u, v) => {
    if ((u * 7) % 1 < 0.1) return BOARD_DARK;
    return v < 0.08 ? BOARD_LIGHT : hash(Math.floor(u * 7), 3) < 0.3 ? BOARD_DARK : BOARD;
  };
  const side: Shader = (u, v) => {
    // The pop-hole, dark inside.
    if (u > 0.36 && u < 0.64 && v > 0.42) return v < 0.48 || u < 0.4 || u > 0.6 ? P.barkDark : P.ink;
    const c = boards(u, v);
    return c === BOARD ? BOARD_DARK : c === BOARD_LIGHT ? BOARD : P.barkDark;
  };
  // A nest box sticking out at the back, under its own lid.
  m.box(0.1, 0.1, 10, 1.4, 0.8, 28, {
    top: BOARD_LIGHT,
    left: (u, v) => (u > 0.08 && u < 0.3 && v > 0.25 && v < 0.55 ? (v < 0.32 ? P.barkDark : P.straw) : boards(u, v)),
    right: side,
  });
  // A single-pitch roof falling towards the front, and the board gable filling the side under it.
  m.quad({ x: 1.5, y: 0.1, z: 38 }, { x: 0, y: 0.8, z: 0 }, { x: 0, y: 0, z: 8 }, (u, v) => (v < 1 - u ? BOARD_DARK : null));
  const shingles: Shader = (u, v) => ((v * 5) % 1 < 0.2 ? P.barkDark : hash(Math.floor(u * 12), Math.floor(v * 5)) < 0.25 ? P.barkLight : P.bark);
  m.quad({ x: 0, y: 0, z: 47 }, { x: 1.6, y: 0, z: 0 }, { x: 0, y: 1.02, z: -10 }, shingles);
  // The ramp down from the pop-hole, with cleats for little feet.
  m.quad({ x: 1.5, y: 0.38, z: 12 }, { x: 0.46, y: 0, z: -12 }, { x: 0, y: 0.24, z: 0 }, (u) => ((u * 5) % 1 < 0.25 ? P.plankDark : P.plankLight));
  // Straw spilling out under the coop.
  for (let i = 0; i < 18; i++) {
    const x = 0.2 + hash(i, 1) * 1.2;
    const y = 0.2 + hash(i, 2) * 0.7;
    m.quad({ x, y, z: 0.5 }, { x: 0.08, y: 0, z: 0 }, { x: 0, y: 0.03, z: 0 }, i % 3 ? P.straw : P.strawLight);
  }
  return m;
}

/** A low water trough hollowed from a log. */
function trough(): IsoModel {
  const m = new IsoModel();
  m.box(0.2, 0.3, 0, 0.6, 0.4, 8, { top: P.barkDark, left: lipped(P.bark, P.barkLight), right: P.barkDark });
  m.box(0.26, 0.36, 8, 0.48, 0.28, 0.5, { top: (u, v) => ((u + v) * 6 % 1 < 0.2 ? P.waterLight : P.water), left: P.water, right: P.water });
  return m;
}

// ---------------------------------------------------------------- hens

export type HenKind = 'white' | 'brown' | 'speckled' | 'rooster';
export const HEN_KINDS: HenKind[] = ['white', 'brown', 'speckled', 'rooster'];

export const HEN_FRAME = 18;
/** Pixel row the feet stand on, for the sprite origin. */
export const HEN_FEET_Y = 15;

interface HenColors {
  body: number;
  shade: number;
  light: number;
  tail: number;
  tailLight: number;
  neck?: number;
  speckle?: number;
}

const HENS: Record<HenKind, HenColors> = {
  white: { body: 0xece6d6, shade: 0xc0b6a2, light: 0xfffcf2, tail: 0xd6ccb8, tailLight: 0xfffcf2 },
  brown: { body: 0xa2622e, shade: 0x7a4420, light: 0xc48448, tail: 0x6a3a1c, tailLight: 0x9a5a2c },
  speckled: { body: 0x6e6a70, shade: 0x4a4650, light: 0x8f8a8c, tail: 0x3a3640, tailLight: 0x6e6a70, speckle: 0xe6e0d6 },
  rooster: { body: 0xb0482a, shade: 0x7e2e1c, light: 0xd8743a, tail: 0x1f3a32, tailLight: 0x3a6a54, neck: 0xe0a040 },
};

/** One pose: where the head is (relative to standing), and which leg is forward. */
interface HenPose {
  headX: number;
  headY: number;
  step: -1 | 0 | 1;
  /** Tail flicked up a pixel. */
  flick?: boolean;
}

const COMB = 0xd02a2a;
const BEAK = 0xe8b040;
const LEGS = 0xe0a030;

/** A hen side on, facing screen-right (mirrored for left). */
function drawHen(c: PixelCanvas, ox: number, kind: HenKind, pose: HenPose): void {
  const col = HENS[kind];
  const rooster = kind === 'rooster';
  const f = HEN_FEET_Y;
  // Legs and feet.
  for (const [lx, d] of [[7, pose.step], [9, -pose.step]] as Array<[number, number]>) {
    c.rect(ox + lx + d, f - 3, 1, 3, LEGS);
    c.rect(ox + lx + d - 1, f, 3, 1, LEGS);
  }
  // Tail feathers, up behind the body; the rooster's are long and curled.
  const t = pose.flick ? -1 : 0;
  if (rooster) {
    for (let i = 0; i < 6; i++) c.set(ox + 3 - Math.round(i * 0.3), f - 7 - i + t, i % 2 ? col.tail : col.tailLight);
    for (let i = 0; i < 5; i++) c.set(ox + 2 + Math.round(Math.sin(i * 0.7) * 1.5), f - 8 - i + t, col.tail);
    c.rect(ox + 1, f - 13 + t, 2, 1, col.tailLight);
    c.rect(ox + 4, f - 10 + t, 1, 4, col.tail);
  } else {
    c.rect(ox + 2, f - 10 + t, 3, 4, col.tail);
    c.rect(ox + 2, f - 11 + t, 2, 1, col.tailLight);
    c.set(ox + 4, f - 9 + t, col.shade);
  }
  // Round body, darker underneath, a wing laid along the side.
  c.ellipse(ox + 7.5, f - 6, 5, 3.6, col.body, col.shade, col.light);
  for (let x = 5; x <= 9; x++) c.set(ox + x, f - 6 + (x > 7 ? 1 : 0), col.shade);
  if (col.speckle) for (const [x, y] of [[6, -7], [8, -5], [5, -4], [9, -7], [7, -3], [10, -5]]) c.set(ox + x, f + y, col.speckle);
  // Neck up to the head (or down, when pecking).
  const hx = ox + 11 + pose.headX;
  const hy = f - 10 + pose.headY;
  const neck = col.neck ?? col.body;
  const steps = Math.max(Math.abs(hx - (ox + 10)), Math.abs(hy - (f - 7)), 1);
  for (let i = 0; i <= steps; i++) {
    const x = ox + 10 + ((hx - (ox + 10)) * i) / steps;
    const y = f - 7 + ((hy - (f - 7)) * i) / steps;
    c.rect(Math.round(x) - 1, Math.round(y), 2, 2, neck);
  }
  c.ellipse(hx, hy, 1.8, 1.8, neck, rooster ? col.body : col.shade, col.light);
  // Comb on top (a tall one for the rooster), beak, wattle, eye.
  c.rect(hx - 1, hy - 2, 2, 1, COMB);
  if (rooster) {
    c.rect(hx - 1, hy - 3, 1, 1, COMB);
    c.rect(hx + 1, hy - 3, 1, 1, COMB);
    c.set(hx, hy - 2, COMB);
  }
  c.set(hx + 2, hy, BEAK);
  c.set(hx + 3, hy + (pose.headY > 2 ? 1 : 0), BEAK);
  c.set(hx + 1, hy + 2, COMB);
  if (rooster) c.set(hx + 1, hy + 3, COMB);
  c.set(hx + 1, hy - 1, P.eye);
}

/** Frames in order: 0-1 idle, 2-3 pecking, 4-5 walking. */
const HEN_POSES: HenPose[] = [
  { headX: 0, headY: 0, step: 0 },
  { headX: 1, headY: 0, step: 0, flick: true },
  { headX: 1, headY: 4, step: 0 },
  { headX: 2, headY: 7, step: 0, flick: true },
  { headX: 0, headY: 1, step: 1 },
  { headX: 1, headY: 0, step: -1 },
];

function generateHens(scene: Phaser.Scene): void {
  for (const kind of HEN_KINDS) {
    const key = `hen-${kind}`;
    const sheet = new PixelCanvas(HEN_FRAME * HEN_POSES.length, HEN_FRAME);
    HEN_POSES.forEach((pose, i) => {
      const frame = new PixelCanvas(HEN_FRAME, HEN_FRAME);
      drawHen(frame, 1, kind, pose);
      frame.outline();
      sheet.blit(frame, i * HEN_FRAME, 0);
    });
    const tex = sheet.toTexture(scene, key);
    HEN_POSES.forEach((_p, i) => tex.add(i, 0, i * HEN_FRAME, 0, HEN_FRAME, HEN_FRAME));
    const anim = (name: string, frames: number[], frameRate: number) =>
      scene.anims.create({ key: `${key}-${name}`, frames: frames.map((frame) => ({ key, frame })), frameRate, repeat: -1 });
    anim('idle', [0, 0, 0, 1, 0, 0], 3);
    anim('peck', [0, 2, 3, 2, 3, 2, 0, 0], 8);
    anim('walk', [4, 5], 8);
  }
}

export function generateHenFarm(scene: Phaser.Scene): void {
  register(scene, 'bld-hut', hut().render());
  register(scene, 'farm-coop', coop().render());
  register(scene, 'farm-trough', trough().render());
  generateHens(scene);
}
