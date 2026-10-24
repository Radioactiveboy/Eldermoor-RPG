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

export function generateCreatures(scene: Phaser.Scene): void {
  const sheet = new PixelCanvas(WOLF_W * FRAMES.length, WOLF_H);
  FRAMES.forEach((pose, i) => {
    const frame = new PixelCanvas(WOLF_W, WOLF_H);
    if (pose === 'dead') drawDeadWolf(frame);
    else drawWolf(frame, pose);
    frame.outline();
    sheet.blit(frame, i * WOLF_W, 0);
  });
  const tex = sheet.toTexture(scene, 'creature-wolf');
  FRAMES.forEach((_p, i) => tex.add(i, 0, i * WOLF_W, 0, WOLF_W, WOLF_H));
  const frames = (list: number[]) => list.map((frame) => ({ key: 'creature-wolf', frame }));
  scene.anims.create({ key: 'wolf-idle', frames: frames([0, 1]), frameRate: 1.5, repeat: -1 });
  scene.anims.create({ key: 'wolf-walk', frames: frames([2, 3, 4, 5]), frameRate: 9, repeat: -1 });
  scene.anims.create({ key: 'wolf-sniff', frames: frames([6, 7, 6, 6, 7, 7, 6]), frameRate: 5, repeat: -1 });
}
