import Phaser from 'phaser';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Wild animals. The grey wolf is drawn side-on, facing screen-right (it's
 * mirrored to face left), from a few simple parts: haunch, body and chest as
 * shaded blobs, legs as thick lines, a bushy tail and a head that can be held
 * up, lowered to sniff the ground, or thrown forward to bite.
 */

export const WOLF_W = 48;
export const WOLF_H = 32;
/** Pixel row its paws stand on, for the sprite origin. */
export const WOLF_FEET_Y = 29;

const FUR_DARK = 0x4b4652;
const FUR = 0x7a7480;
const FUR_LIGHT = 0xa29ca6;
const FUR_PALE = 0xcfc6bb;
const EYE = 0xf2b33a;
const MOUTH = 0x5a1a22;
const TOOTH = 0xf4efe2;

type Head = 'up' | 'sniff' | 'bite' | 'hurt';

interface WolfPose {
  /** Paw offsets in pixels for far-back, near-back, far-front, near-front legs. */
  legs: [number, number, number, number];
  /** How far each paw is lifted off the ground. */
  lift?: [number, number, number, number];
  /** Pixels the body sinks (breathing, the stride's contact frames). */
  bob: number;
  head: Head;
  /** 0 = tail hanging low, 1 = held straight out (alert). */
  tail: number;
  /** Fur standing up along the back. */
  hackles?: boolean;
  /** Head lowered a further pixel (the sniffing nod). */
  nod?: number;
}

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

/** Fur shading: a dark saddle along the back, a pale belly underneath. */
const fur = (nx: number, ny: number) => (ny < -0.35 ? FUR_DARK : ny > 0.55 ? FUR_PALE : nx < -0.5 && ny < 0.1 ? FUR_LIGHT : FUR);

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

function drawLeg(c: PixelCanvas, hipX: number, hipY: number, footDx: number, lift: number, color: number, paw: number): void {
  const fx = hipX + footDx;
  const fy = WOLF_FEET_Y - lift;
  // Upper leg, a joint a little back from straight, then the lower leg down to the paw.
  const kx = hipX + footDx * 0.4 + (hipX > 22 ? 0 : -1);
  const ky = hipY + (fy - hipY) * 0.55;
  line(c, hipX, hipY, kx, ky, 3, color);
  line(c, kx, ky, fx, fy - 1, 2, color);
  c.rect(fx - 1, fy, 3, 1, paw);
}

function drawWolf(c: PixelCanvas, pose: WolfPose): void {
  const b = pose.bob;
  const lift = pose.lift ?? [0, 0, 0, 0];
  const [farBack, nearBack, farFront, nearFront] = pose.legs;

  // Far-side legs first, darker, so the near ones overlap them.
  drawLeg(c, 13, 19 + b, farBack, lift[0], FUR_DARK, P.outline);
  drawLeg(c, 29, 19 + b, farFront, lift[2], FUR_DARK, P.outline);

  // Bushy tail: a chain of shrinking tufts, raised when alert, with a dark tip.
  for (let i = 0; i < 9; i++) {
    const droop = (1 - pose.tail) * i * 0.85;
    const x = 9 - i * 0.95;
    const y = 14 + b + droop - pose.tail * i * 0.15;
    const r = 2.6 - i * 0.12;
    blob(c, x, y, r, r, (_nx, ny) => (i > 6 ? FUR_DARK : ny < -0.2 ? FUR_DARK : ny > 0.4 ? FUR_LIGHT : FUR));
  }

  // Haunch, body and chest.
  blob(c, 13, 16 + b, 5, 5.2, fur);
  blob(c, 21, 16.5 + b, 10.5, 4.8, fur);
  blob(c, 29, 15 + b, 5.5, 5.5, (nx, ny) => (ny > 0.2 && nx > -0.2 ? FUR_PALE : fur(nx, ny)));
  if (pose.hackles) {
    for (let x = 17; x <= 28; x += 2) c.set(x, 11 + b - ((x / 2) % 2), FUR_DARK);
  }

  drawHead(c, pose);

  // Near-side legs.
  drawLeg(c, 16, 19 + b, nearBack, lift[1], FUR, FUR_DARK);
  drawLeg(c, 32, 19 + b, nearFront, lift[3], FUR, FUR_DARK);
}

function drawHead(c: PixelCanvas, pose: WolfPose): void {
  const b = pose.bob;
  if (pose.head === 'sniff') {
    // Neck stretched down, nose to the ground.
    const n = pose.nod ?? 0;
    blob(c, 33, 16 + b, 4, 4.5, fur);
    blob(c, 37, 20 + n, 4, 3.6, fur);
    line(c, 39, 21 + n, 42, 24 + n, 3, FUR);
    line(c, 39, 23 + n, 41, 25 + n, 2, FUR_PALE);
    c.rect(43, 25 + n, 2, 2, P.outline);
    ear(c, 34, 14 + n, 4, -1, FUR_DARK);
    c.set(38, 19 + n, EYE);
    return;
  }
  const hurt = pose.head === 'hurt';
  const bite = pose.head === 'bite';
  const hx = bite ? 38 : hurt ? 35 : 36;
  const hy = (bite ? 10 : hurt ? 12 : 10) + b;
  // Neck joining the chest.
  blob(c, hx - 3, hy + 3, 4, 4, fur);
  blob(c, hx, hy, 4.5, 3.8, (_nx, ny) => (ny < -0.4 ? FUR_DARK : ny > 0.45 ? FUR_PALE : FUR));
  // Muzzle.
  const mx = hx + 3;
  c.rect(mx, hy - 1, 5, 2, FUR);
  c.rect(mx, hy - 1, 5, 1, FUR_LIGHT);
  if (bite) {
    // Jaws wide open, teeth bared.
    c.rect(mx, hy + 1, 5, 2, MOUTH);
    c.set(mx + 1, hy + 1, TOOTH);
    c.set(mx + 3, hy + 1, TOOTH);
    c.rect(mx, hy + 3, 4, 1, FUR_PALE);
    c.set(mx + 2, hy + 2, TOOTH);
  } else {
    c.rect(mx, hy + 1, 4, 1, FUR_PALE);
  }
  c.rect(mx + 5, hy - 1, 1, 2, P.outline); // nose
  // Ears: pricked up, or flattened back when biting or hurt.
  if (bite || hurt) {
    line(c, hx - 2, hy - 3, hx - 5, hy - 4, 2, FUR_DARK);
    line(c, hx, hy - 3, hx - 3, hy - 5, 2, FUR_DARK);
  } else {
    ear(c, hx - 3, hy - 7, 4, -0.5, FUR_DARK);
    ear(c, hx, hy - 7, 4, 0.5, FUR_DARK, FUR_PALE);
  }
  // Eye under a dark brow; squeezed shut when hurt.
  if (hurt) {
    c.rect(hx + 1, hy - 1, 2, 1, P.outline);
  } else {
    c.set(hx + 1, hy - 1, EYE);
    c.set(hx + 2, hy - 1, P.outline);
    c.rect(hx, hy - 2, 3, 1, FUR_DARK);
  }
}

/** Lying still on its side. */
function drawDeadWolf(c: PixelCanvas): void {
  for (let i = 0; i < 8; i++) blob(c, 9 - i, 25 + i * 0.3, 2.4 - i * 0.12, 2, (_nx, ny) => (i > 5 || ny < 0 ? FUR_DARK : FUR));
  line(c, 14, 26, 17, 29, 2, FUR_DARK);
  line(c, 26, 26, 30, 29, 2, FUR_DARK);
  blob(c, 22, 24, 12, 4.5, (nx, ny) => (ny < -0.3 ? FUR_DARK : ny > 0.4 ? FUR_PALE : nx < -0.6 ? FUR_LIGHT : FUR));
  line(c, 16, 27, 21, 29, 2, FUR);
  line(c, 29, 27, 34, 29, 2, FUR);
  blob(c, 37, 25, 4.5, 3, (_nx, ny) => (ny < -0.3 ? FUR_DARK : FUR));
  c.rect(40, 25, 4, 2, FUR);
  c.rect(40, 27, 3, 1, FUR_PALE);
  c.rect(44, 25, 1, 2, P.outline);
  c.rect(37, 24, 2, 1, P.outline);
  line(c, 34, 22, 31, 21, 2, FUR_DARK);
}

const STILL: WolfPose['legs'] = [0, 0, 0, 0];

/** Frame order in the sheet. */
const FRAMES: Array<WolfPose | 'dead'> = [
  // 0-1 standing, breathing
  { legs: STILL, bob: 0, head: 'up', tail: 0.25 },
  { legs: STILL, bob: 1, head: 'up', tail: 0.3 },
  // 2-5 trotting
  { legs: [2, -2, -2, 2], bob: 1, head: 'up', tail: 0.45 },
  { legs: [0, 0, 0, 0], lift: [0, 2, 2, 0], bob: 0, head: 'up', tail: 0.5 },
  { legs: [-2, 2, 2, -2], bob: 1, head: 'up', tail: 0.45 },
  { legs: [0, 0, 0, 0], lift: [2, 0, 0, 2], bob: 0, head: 'up', tail: 0.5 },
  // 6-7 nose to the ground, sniffing
  { legs: [0, 0, 1, 1], bob: 1, head: 'sniff', tail: 0.2 },
  { legs: [0, 0, 1, 1], bob: 1, head: 'sniff', tail: 0.3, nod: 1 },
  // 8 snarling, hackles up
  { legs: [-1, -1, 1, 1], bob: 1, head: 'bite', tail: 1, hackles: true },
  // 9 biting, stretched forward
  { legs: [-2, -2, 3, 3], lift: [0, 0, 1, 1], bob: 0, head: 'bite', tail: 0.9 },
  // 10 flinching
  { legs: [-1, 1, -2, -1], bob: 1, head: 'hurt', tail: 0 },
  // 11 dead
  'dead',
];

export const WOLF_FRAME = { snarl: 8, bite: 9, hurt: 10, dead: 11 } as const;
/** Every beast's sheet has the wolf's frame order: 0-1 standing, 2-5 walking, 6-7 head down, then these. */
export const CREATURE_FRAME = WOLF_FRAME;

/** Each beast's frame size and the pixel row its feet stand on, by kind (see systems/Combat.ts FOES). */
export const CREATURE_ART: Record<'wolf' | 'deer' | 'hare' | 'boar', { w: number; h: number; feetY: number }> = {
  wolf: { w: WOLF_W, h: WOLF_H, feetY: WOLF_FEET_Y },
  deer: { w: 48, h: 46, feetY: 43 },
  hare: { w: 26, h: 22, feetY: 19 },
  boar: { w: 48, h: 32, feetY: 29 },
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

// --- Wild boar --------------------------------------------------------------

const BOAR_DARK = 0x2e2420;
const BOAR = 0x4e3e34;
const BOAR_LIGHT = 0x6e5a4a;
const SNOUT = 0x9a7468;
const TUSK = 0xf0e6d0;

const boarCoat = (nx: number, ny: number) => (ny < -0.4 ? BOAR_DARK : ny > 0.55 ? BOAR_LIGHT : nx < -0.5 && ny < 0.1 ? BOAR_LIGHT : BOAR);

function drawBoar(c: PixelCanvas, pose: BeastPose): void {
  const F = CREATURE_ART.boar.feetY;
  const b = pose.bob;
  const lift = pose.lift ?? [0, 0, 0, 0];
  const leg = (hx: number, dx: number, l: number, col: number) => {
    line(c, hx, 21 + b, hx + dx, F - 1 - l, 3, col);
    c.rect(hx + dx - 1, F - l, 3, 1, P.outline);
  };
  leg(13, pose.legs[0], lift[0], BOAR_DARK);
  leg(29, pose.legs[2], lift[2], BOAR_DARK);
  // A thin twist of tail.
  line(c, 6, 13 + b, 4, 17 + b, 1, BOAR_DARK);
  blob(c, 20, 16 + b, 14, 7.5, boarCoat);
  // Bristles standing up along the spine, higher at the shoulders.
  const bristle = pose.head === 'alert' || pose.head === 'charge' ? 2 : 1;
  for (let x = 10; x <= 30; x += 2) c.rect(x, 9 + b - (x > 22 ? bristle : 0) - (x % 4 === 0 ? 1 : 0), 1, 2, BOAR_DARK);
  drawBoarHead(c, pose);
  leg(16, pose.legs[1], lift[1], BOAR);
  leg(32, pose.legs[3], lift[3], BOAR);
}

function drawBoarHead(c: PixelCanvas, pose: BeastPose): void {
  const b = pose.bob;
  const down = pose.head === 'down';
  const charge = pose.head === 'charge';
  const hurt = pose.head === 'hurt';
  const hx = charge ? 37 : down ? 36 : 35;
  const hy = (down ? 22 : charge ? 18 : hurt ? 15 : 16) + b;
  blob(c, hx - 2, hy - 1, 6, 5.5, boarCoat);
  // A long wedge of a head down to the snout.
  for (let i = 0; i < 8; i++) blob(c, hx + i * 0.9, hy + i * (down ? 0.55 : 0.25), 4 - i * 0.3, 3.2 - i * 0.18, (_nx, ny) => (ny < -0.3 ? BOAR_DARK : BOAR));
  const sx = hx + 8;
  const sy = hy + (down ? 4 : 2);
  c.rect(sx, sy - 1, 2, 3, SNOUT);
  c.set(sx + 1, sy, P.outline);
  // Tusks curling up from the jaw.
  c.set(sx - 2, sy + 1, TUSK);
  c.set(sx - 1, sy, TUSK);
  c.set(sx - 1, sy - 1, charge ? TUSK : BOAR);
  // Small eye, and a pointed ear laid back.
  if (hurt) c.rect(hx + 1, hy - 2, 2, 1, P.outline);
  else {
    c.set(hx + 2, hy - 2, 0xc04a2a);
    c.set(hx + 1, hy - 2, P.outline);
  }
  ear(c, hx - 3, hy - 7, 4, charge || hurt ? -1.5 : -0.5, BOAR_DARK, BOAR_LIGHT);
}

function drawDeadBoar(c: PixelCanvas): void {
  const F = CREATURE_ART.boar.feetY;
  line(c, 14, F - 4, 18, F, 2, BOAR_DARK);
  line(c, 28, F - 4, 32, F, 2, BOAR_DARK);
  blob(c, 21, F - 6, 14, 5.5, boarCoat);
  for (let x = 10; x <= 30; x += 2) c.rect(x, F - 12, 1, 2, BOAR_DARK);
  for (let i = 0; i < 7; i++) blob(c, 35 + i, F - 5 + i * 0.3, 4 - i * 0.35, 3 - i * 0.2, (_nx, ny) => (ny < -0.3 ? BOAR_DARK : BOAR));
  c.rect(42, F - 4, 2, 2, SNOUT);
  c.set(40, F - 3, TUSK);
  c.rect(36, F - 7, 2, 1, P.outline);
}

const BOAR_FRAMES: Array<BeastPose | 'dead'> = [
  { legs: [0, 0, 0, 0], bob: 0, head: 'up' },
  { legs: [0, 0, 0, 0], bob: 1, head: 'up' },
  { legs: [2, -2, -2, 2], bob: 1, head: 'up' },
  { legs: [0, 0, 0, 0], lift: [0, 2, 2, 0], bob: 0, head: 'up' },
  { legs: [-2, 2, 2, -2], bob: 1, head: 'up' },
  { legs: [0, 0, 0, 0], lift: [2, 0, 0, 2], bob: 0, head: 'up' },
  { legs: [0, 0, 1, 1], bob: 1, head: 'down' },
  { legs: [0, 0, 1, 1], bob: 2, head: 'down' },
  { legs: [-1, -1, 1, 1], bob: 0, head: 'alert' },
  { legs: [-3, -3, 3, 3], lift: [0, 0, 1, 1], bob: 0, head: 'charge' },
  { legs: [-1, 1, -2, -1], bob: 1, head: 'hurt' },
  'dead',
];

/** Paints a beast's frames side by side into 'creature-<kind>', with its idle, walk and graze animations. */
function sheet<T>(scene: Phaser.Scene, kind: keyof typeof CREATURE_ART, frames: Array<T | 'dead'>, draw: (c: PixelCanvas, pose: T) => void, dead: (c: PixelCanvas) => void, rates: { walk: number }): void {
  const { w, h } = CREATURE_ART[kind];
  const key = `creature-${kind}`;
  const canvas = new PixelCanvas(w * frames.length, h);
  frames.forEach((pose, i) => {
    const frame = new PixelCanvas(w, h);
    if (pose === 'dead') dead(frame);
    else draw(frame, pose);
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
  sheet(scene, 'wolf', FRAMES, drawWolf, drawDeadWolf, { walk: 9 });
  sheet(scene, 'deer', DEER_FRAMES, drawDeer, drawDeadDeer, { walk: 8 });
  sheet(scene, 'hare', HARE_FRAMES, drawHare, drawDeadHare, { walk: 10 });
  sheet(scene, 'boar', BOAR_FRAMES, drawBoar, drawDeadBoar, { walk: 9 });
}
