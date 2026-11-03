import Phaser from 'phaser';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';
import { BEAST_FRAME, boarSheet, boarSpec, generateBeast, GREY_WOLF, WHITE_WOLF, wolfSheet, wolfSpec } from './beasts3d';
import { drawDeadRat, drawRat, RAT_ART, RAT_FRAMES } from './rats';

/**
 * Wild animals. The wolves are modelled in 3D (see beasts3d.ts); the rest are
 * still drawn side-on, facing screen-right (mirrored to face left).
 */

/** Fills an ellipse, choosing each pixel's colour from where it falls (-1..1 on each axis). */
function blob(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, color: (nx: number, ny: number) => number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) c.set(x, y, color(nx, ny));
    }
  }
}

function line(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, width: number, color: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    c.rect(x, y, width, 1, color);
  }
}

/** A pointed ear: a small triangle with its tip at (x, y). */
function ear(c: PixelCanvas, x: number, y: number, h: number, lean: number, color: number, inner?: number): void {
  for (let i = 0; i < h; i++) {
    const w = 1 + Math.floor(i * 0.8);
    const left = Math.round(x + lean * (h - i) * 0.5 - w / 2);
    c.rect(left, y + i, w + 1, 1, color);
    if (inner !== undefined && i > 1 && w > 2) c.set(left + 1, y + i, inner);
  }
}

export const WOLF_FRAME = BEAST_FRAME;
/** Every beast's sheet has the wolf's frame order: 0-1 standing, 2-5 walking, 6-7 head down, then these. */
export const CREATURE_FRAME = WOLF_FRAME;

/** How much bigger than a grey wolf the Wolf Mother is. */
const WOLF_MOTHER_SIZE = 1.45;

/**
 * Each beast's frame size and the pixel row its feet stand on, by kind (see
 * systems/Combat.ts FOES), and how much bigger than its frame it's shown.
 */
export const CREATURE_ART: Record<
  'wolf' | 'wolfmother' | 'deer' | 'hare' | 'boar' | 'rat',
  {
    w: number;
    h: number;
    feetY: number;
    scale?: number;
    /** Drawn in 3D, in eight directions (see beasts3d.ts): 8 rows of 12 frames. */
    eight?: boolean;
    /** How tall it stands on screen, in pixels (for what's shown over its head). */
    tall?: number;
  }
> = {
  wolf: { ...wolfSpec(1), eight: true, tall: 26 },
  // The Wolf Mother: the grey wolf, half as big again, in a coat as white as frost.
  wolfmother: { ...wolfSpec(WOLF_MOTHER_SIZE), eight: true, tall: 26 * WOLF_MOTHER_SIZE },
  deer: { w: 48, h: 46, feetY: 43 },
  hare: { w: 26, h: 22, feetY: 19 },
  boar: { ...boarSpec(), eight: true, tall: 24 },
  // The rats in the Crooked Tankard's cellar (see rats.ts).
  rat: { ...RAT_ART, scale: 1.3 },
};

// --- Red deer ---------------------------------------------------------------

const DEER_DARK = 0x6a3a22;
const DEER = 0x9a5a32;
const DEER_LIGHT = 0xb87a4a;
const DEER_PALE = 0xe6d2ae;
const ANTLER = 0xd8c8a4;
const ANTLER_DARK = 0xa08a64;

type BeastHead = 'up' | 'down' | 'alert' | 'charge' | 'hurt';

interface BeastPose {
  /** Hoof offsets for far-back, near-back, far-front, near-front legs. */
  legs: [number, number, number, number];
  lift?: [number, number, number, number];
  bob: number;
  head: BeastHead;
  /** Rearing (front raised) or springing, in pixels. */
  rise?: number;
}

const deerCoat = (nx: number, ny: number) => (ny < -0.45 ? DEER_DARK : ny > 0.5 ? DEER_PALE : nx < -0.4 && ny < 0 ? DEER_LIGHT : DEER);

function deerLeg(c: PixelCanvas, hipX: number, hipY: number, dx: number, lift: number, feetY: number, color: number): void {
  const fx = hipX + dx;
  const fy = feetY - lift;
  const kx = hipX + dx * 0.5 + (hipX < 20 ? -1 : 1);
  const ky = hipY + (fy - hipY) * 0.45;
  line(c, hipX, hipY, kx, ky, 2, color);
  line(c, kx, ky, fx, fy - 1, 1, color);
  c.rect(fx - 1, fy, 2, 1, P.outline);
}

function drawDeer(c: PixelCanvas, pose: BeastPose): void {
  const F = CREATURE_ART.deer.feetY;
  const b = pose.bob;
  const r = pose.rise ?? 0;
  const lift = pose.lift ?? [0, 0, 0, 0];
  const [fb, nb, ff, nf] = pose.legs;
  deerLeg(c, 15, 28 + b, fb, lift[0], F, DEER_DARK);
  deerLeg(c, 30, 27 + b - r, ff, lift[2] + r, F, DEER_DARK);
  // A pale rump and a short tail, flicked up when alarmed.
  blob(c, 11, 22 + b, 3.5, 4, (_nx, ny) => (ny < -0.3 ? DEER : DEER_PALE));
  const tailUp = pose.head === 'alert' || pose.head === 'charge';
  c.rect(8, tailUp ? 17 + b : 20 + b, 2, 3, tailUp ? DEER_PALE : DEER_DARK);
  blob(c, 15, 23 + b, 6, 6, deerCoat);
  blob(c, 22, 23 + b - r * 0.4, 11, 5.5, deerCoat);
  blob(c, 30, 22 + b - r, 5.5, 6, (nx, ny) => (ny > 0.3 && nx > -0.2 ? DEER_LIGHT : deerCoat(nx, ny)));
  drawDeerHead(c, pose);
  deerLeg(c, 18, 28 + b, nb, lift[1], F, DEER);
  deerLeg(c, 33, 27 + b - r, nf, lift[3] + r, F, DEER);
}

function antlers(c: PixelCanvas, x: number, y: number, lean: number): void {
  // Two beams curving back with a few tines.
  for (const [ox, dark] of [[-1, true], [1, false]] as const) {
    const col = dark ? ANTLER_DARK : ANTLER;
    line(c, x + ox, y, x + ox - 2 * lean, y - 5, 1, col);
    line(c, x + ox - 2 * lean, y - 5, x + ox - 4 * lean, y - 9, 1, col);
    c.set(x + ox - lean + 1, y - 3, col);
    c.set(x + ox - lean + 2, y - 4, col);
    c.set(x + ox - 3 * lean + 1, y - 7, col);
    c.set(x + ox - 3 * lean + 2, y - 8, col);
  }
}

function drawDeerHead(c: PixelCanvas, pose: BeastPose): void {
  const b = pose.bob;
  const r = pose.rise ?? 0;
  if (pose.head === 'down') {
    // Grazing: neck stretched down to the grass.
    line(c, 32, 21 + b, 38, 33, 4, DEER);
    line(c, 33, 19 + b, 39, 31, 2, DEER_DARK);
    blob(c, 40, 36, 3.5, 2.6, (_nx, ny) => (ny < -0.3 ? DEER_DARK : DEER));
    c.rect(43, 37, 2, 2, P.outline);
    c.set(39, 35, P.outline);
    ear(c, 37, 30, 4, -1, DEER_DARK, DEER_LIGHT);
    antlers(c, 36, 32, -1);
    return;
  }
  const charge = pose.head === 'charge';
  const hurt = pose.head === 'hurt';
  const hx = charge ? 40 : hurt ? 34 : 37;
  const hy = (charge ? 17 : pose.head === 'alert' ? 7 : 9) + b - r;
  // Long neck up from the chest, then a narrow head and muzzle.
  line(c, 31, 21 + b - r, hx - 2, hy + 3, 5, DEER);
  line(c, 32, 19 + b - r, hx - 1, hy + 1, 2, DEER_DARK);
  line(c, 31, 24 + b - r, hx - 3, hy + 6, 2, DEER_PALE);
  blob(c, hx, hy, 3.5, 3, (_nx, ny) => (ny < -0.4 ? DEER_DARK : DEER));
  c.rect(hx + 2, hy, 4, 2, DEER);
  c.rect(hx + 2, hy + 2, 3, 1, DEER_PALE);
  c.set(hx + 6, hy, P.outline);
  if (hurt) c.rect(hx, hy - 1, 2, 1, P.outline);
  else {
    c.set(hx + 1, hy - 1, P.outline);
    c.set(hx, hy - 1, 0x3a2418);
  }
  ear(c, hx - 2, hy - 6, 4, hurt ? -1.5 : -0.6, DEER_DARK, DEER_LIGHT);
  antlers(c, hx - (charge ? -1 : 0), hy - 2, charge ? -1.4 : 0.6);
}

function drawDeadDeer(c: PixelCanvas): void {
  const F = CREATURE_ART.deer.feetY;
  line(c, 14, F - 4, 20, F, 1, DEER_DARK);
  line(c, 28, F - 4, 34, F, 1, DEER_DARK);
  blob(c, 22, F - 5, 13, 4, (nx, ny) => (ny < -0.3 ? DEER_DARK : ny > 0.4 ? DEER_PALE : nx < -0.6 ? DEER_LIGHT : DEER));
  line(c, 18, F - 2, 24, F, 1, DEER);
  line(c, 32, F - 2, 38, F, 1, DEER);
  line(c, 34, F - 7, 40, F - 4, 3, DEER);
  blob(c, 42, F - 4, 3.2, 2.4, (_nx, ny) => (ny < -0.3 ? DEER_DARK : DEER));
  c.rect(44, F - 4, 2, 2, DEER);
  c.rect(40, F - 6, 2, 1, P.outline);
  antlers(c, 39, F - 6, 1.2);
}

const DEER_FRAMES: Array<BeastPose | 'dead'> = [
  { legs: [0, 0, 0, 0], bob: 0, head: 'up' },
  { legs: [0, 0, 0, 0], bob: 1, head: 'up' },
  { legs: [3, -3, -3, 3], bob: 1, head: 'up' },
  { legs: [0, 0, 0, 0], lift: [0, 3, 3, 0], bob: 0, head: 'up' },
  { legs: [-3, 3, 3, -3], bob: 1, head: 'up' },
  { legs: [0, 0, 0, 0], lift: [3, 0, 0, 3], bob: 0, head: 'up' },
  { legs: [0, 0, 1, 2], bob: 1, head: 'down' },
  { legs: [0, 0, 1, 2], bob: 2, head: 'down' },
  { legs: [-1, -1, 1, 1], bob: 0, head: 'alert' },
  { legs: [-3, -2, 2, 3], lift: [0, 0, 0, 0], bob: 0, head: 'charge', rise: 3 },
  { legs: [-1, 1, -2, -1], bob: 1, head: 'hurt' },
  'dead',
];

// --- Brown hare -------------------------------------------------------------

const HARE_DARK = 0x5e4630;
const HARE = 0x8e6c48;
const HARE_LIGHT = 0xb48e64;
const HARE_PALE = 0xe8dcc4;

interface HarePose {
  /** 'sit' upright, 'crouch' grazing, 'stretch' mid-leap, 'tuck' landing. */
  body: 'sit' | 'crouch' | 'stretch' | 'tuck' | 'alert' | 'hurt';
  bob: number;
  /** Off the ground, mid-hop. */
  air?: number;
}

const hareCoat = (nx: number, ny: number) => (ny < -0.45 ? HARE_DARK : ny > 0.45 ? HARE_PALE : nx < -0.3 && ny < 0.1 ? HARE_LIGHT : HARE);

function drawHare(c: PixelCanvas, pose: HarePose): void {
  const F = CREATURE_ART.hare.feetY;
  const up = pose.air ?? 0;
  const b = pose.bob - up;
  const stretch = pose.body === 'stretch';
  const sit = pose.body === 'sit' || pose.body === 'alert';
  const crouch = pose.body === 'crouch';
  // Big hind foot and haunch, then the body and a small forepaw.
  if (!stretch) c.rect(6, F + b, 6, 1, HARE_DARK);
  else line(c, 3, F - 3 + b, 7, F - 1 + b, 2, HARE_DARK);
  blob(c, 4, (sit ? 11 : 13) + b, 2, 2, () => HARE_PALE); // scut
  blob(c, 9, (sit ? 14 : 15) + b, 5, 4, hareCoat);
  const bx = stretch ? 14 : sit ? 12 : 13;
  const by = (sit ? 11 : crouch ? 15 : 13) + b;
  blob(c, bx, by, stretch ? 6 : 4.5, sit ? 4.5 : 3.5, hareCoat);
  if (stretch) line(c, 19, by + 1, 23, F - 2 + b, 1, HARE_DARK);
  else c.rect(bx + 2, F + b, 2, 1, HARE_DARK);
  if (!stretch) line(c, bx + 2, by + 2, bx + 3, F - 1 + b, 1, HARE);
  // Head, a long pair of black-tipped ears.
  const hx = crouch ? 19 : stretch ? 20 : 16;
  const hy = (crouch ? 16 : stretch ? 10 : sit ? 6 : 9) + b;
  blob(c, hx, hy, 3, 2.6, (_nx, ny) => (ny > 0.4 ? HARE_PALE : HARE));
  c.set(hx + 3, hy + (crouch ? 1 : 0), P.outline);
  if (pose.body === 'hurt') c.rect(hx, hy - 1, 2, 1, P.outline);
  else {
    c.set(hx + 1, hy - 1, 0xc08a2a);
    c.set(hx + 1, hy - 1 + 0, 0x2a1a10);
  }
  const earLean = stretch || crouch ? -2.5 : pose.body === 'alert' ? 0 : -1;
  const earLen = 7;
  for (const [ox, col] of [[-1, HARE_DARK], [0, HARE]] as const) {
    const x0 = hx - 1 + ox;
    const y0 = hy - 2;
    const x1 = x0 + earLean * 2;
    const y1 = y0 - (stretch || crouch ? earLen * 0.6 : earLen);
    line(c, x0, y0, x1, y1, 2, col);
    c.set(x1, y1, P.outline);
    c.set(x1 + 1, y1, P.outline);
  }
}

function drawDeadHare(c: PixelCanvas): void {
  const F = CREATURE_ART.hare.feetY;
  blob(c, 12, F - 2, 7, 2.6, (nx, ny) => (ny < -0.2 ? HARE_DARK : ny > 0.3 ? HARE_PALE : nx < -0.5 ? HARE_LIGHT : HARE));
  blob(c, 20, F - 2, 2.6, 2, () => HARE);
  line(c, 21, F - 3, 25, F - 5, 1, HARE_DARK);
  line(c, 4, F - 1, 7, F, 1, HARE_DARK);
  c.set(21, F - 3, P.outline);
}

const HARE_FRAMES: Array<HarePose | 'dead'> = [
  { body: 'sit', bob: 0 },
  { body: 'sit', bob: 0, air: 0 },
  { body: 'tuck', bob: 0 },
  { body: 'stretch', bob: 0, air: 3 },
  { body: 'stretch', bob: 0, air: 2 },
  { body: 'tuck', bob: 1 },
  { body: 'crouch', bob: 0 },
  { body: 'crouch', bob: 1 },
  { body: 'alert', bob: 0 },
  { body: 'stretch', bob: 0, air: 1 },
  { body: 'hurt', bob: 1 },
  'dead',
];

/**
 * Paints a beast's frames side by side into 'creature-<kind>', with its idle, walk and graze animations.
 * @param recolor colours to swap after drawing (the Wolf Mother's white coat)
 */
function sheet<T>(
  scene: Phaser.Scene,
  kind: keyof typeof CREATURE_ART,
  frames: Array<T | 'dead'>,
  draw: (c: PixelCanvas, pose: T) => void,
  dead: (c: PixelCanvas) => void,
  rates: { walk: number },
  recolor?: Record<number, number>,
): void {
  const { w, h } = CREATURE_ART[kind];
  const key = `creature-${kind}`;
  const canvas = new PixelCanvas(w * frames.length, h);
  frames.forEach((pose, i) => {
    const frame = new PixelCanvas(w, h);
    if (pose === 'dead') dead(frame);
    else draw(frame, pose);
    if (recolor) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const col = frame.get(x, y);
          if (col !== null && recolor[col] !== undefined) frame.set(x, y, recolor[col]);
        }
      }
    }
    frame.outline();
    canvas.blit(frame, i * w, 0);
  });
  const tex = canvas.toTexture(scene, key);
  frames.forEach((_p, i) => tex.add(i, 0, i * w, 0, w, h));
  const list = (ids: number[]) => ids.map((frame) => ({ key, frame }));
  scene.anims.create({ key: `${kind}-idle`, frames: list([0, 1]), frameRate: 1.5, repeat: -1 });
  scene.anims.create({ key: `${kind}-walk`, frames: list([2, 3, 4, 5]), frameRate: rates.walk, repeat: -1 });
  scene.anims.create({ key: `${kind}-sniff`, frames: list([6, 7, 6, 6, 7, 7, 6]), frameRate: 5, repeat: -1 });
}

export function generateCreatures(scene: Phaser.Scene): void {
  generateBeast(scene, 'wolf', wolfSheet(GREY_WOLF), 9);
  generateBeast(scene, 'wolfmother', wolfSheet(WHITE_WOLF, WOLF_MOTHER_SIZE), 8);
  sheet(scene, 'deer', DEER_FRAMES, drawDeer, drawDeadDeer, { walk: 8 });
  sheet(scene, 'hare', HARE_FRAMES, drawHare, drawDeadHare, { walk: 10 });
  generateBeast(scene, 'boar', boarSheet(), 9);
  sheet(scene, 'rat', RAT_FRAMES, drawRat, drawDeadRat, { walk: 12 });
}
