import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * The cellar rats under the Crooked Tankard: small, greasy and bold, drawn
 * side-on facing screen-right like the other beasts (see creatures.ts), with
 * frames in the same order as theirs.
 */
export const RAT_ART = { w: 26, h: 16, feetY: 13 };

const RAT_DARK = 0x3a3230;
const RAT = 0x5a4e48;
const RAT_LIGHT = 0x7a6c62;
const RAT_PALE = 0x9c8e82;
const PINK = 0xd09a96;
const PINK_DARK = 0xa87470;
const TOOTH = 0xe8d48a;

export interface RatPose {
  /** Paw offsets for the back and front pairs, in pixels. */
  legs: [number, number];
  bob: number;
  /** 'up' nosing the air, 'sniff' at the floor, 'rear' up on its hind legs, 'bite' lunging, 'hurt' cringing. */
  head: 'up' | 'sniff' | 'rear' | 'bite' | 'hurt';
  /** Which way the tail's curl is swinging, -1..1. */
  tail: number;
}

function blob(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, color: (nx: number, ny: number) => number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) c.set(x, y, color(nx, ny));
    }
  }
}

const coat = (nx: number, ny: number) => (ny < -0.4 ? RAT_DARK : ny > 0.5 ? RAT_PALE : nx < -0.3 && ny < 0.1 ? RAT_LIGHT : RAT);

export function drawRat(c: PixelCanvas, pose: RatPose): void {
  const F = RAT_ART.feetY;
  const b = pose.bob;
  const rear = pose.head === 'rear';
  const lift = rear ? 3 : 0;
  // The long bare tail, curling away behind.
  for (let i = 0; i < 9; i++) {
    const x = 6 - i;
    const y = F - 2 + Math.round(Math.sin(i * 0.7 + pose.tail) * 1.2 + i * 0.1) + (i < 2 ? -1 : 0);
    if (x >= 0) c.set(x, y + b, i < 3 ? PINK_DARK : PINK);
  }
  // Hind legs, haunch, body, and the front paws.
  c.rect(8 + pose.legs[0], F + b, 2, 1, PINK_DARK);
  blob(c, 9, F - 3.5 + b, 4, 3.5, coat);
  blob(c, 13, F - 4 + b - lift * 0.6, 5.5, 3.2, coat);
  if (rear) {
    c.set(17, F - 6 + b, PINK);
    c.set(18, F - 7 + b, PINK);
  } else {
    c.rect(15 + pose.legs[1], F + b, 2, 1, PINK_DARK);
    c.set(15 + pose.legs[1], F - 1 + b, RAT);
  }
  // The head: a long wedge of a face, beady eye, round ear, pink nose and whiskers.
  const fwd = pose.head === 'bite' ? 2 : pose.head === 'sniff' ? 1 : pose.head === 'hurt' ? -1 : 0;
  const drop = pose.head === 'sniff' ? 2 : pose.head === 'hurt' ? 1 : rear ? -3 : 0;
  const hx = 18 + fwd;
  const hy = F - 6 + drop + b;
  blob(c, hx, hy, 3.2, 2.4, (_nx, ny) => (ny > 0.4 ? RAT_PALE : ny < -0.5 ? RAT_DARK : RAT));
  for (let i = 1; i <= 3; i++) c.rect(hx + 2 + i, hy - 1 + Math.ceil(i / 2), 1, 2 - Math.floor(i / 3), i === 3 ? RAT_PALE : RAT);
  c.set(hx + 6, hy + 1, PINK);
  blob(c, hx - 1.5, hy - 2.6, 1.6, 1.6, (nx) => (nx < 0 ? RAT_LIGHT : PINK));
  if (pose.head === 'hurt') c.rect(hx + 1, hy - 1, 2, 1, P.outline);
  else {
    c.set(hx + 1, hy - 1, 0x140c0c);
    c.set(hx + 1, hy - 2, pose.head === 'bite' || rear ? 0xd04a3a : 0x6a5a5a);
  }
  for (const dy of [-1, 1]) c.set(hx + 7, hy + 1 + dy, RAT_PALE);
  if (pose.head === 'bite' || rear) {
    // Teeth bared: a yellow pair of incisors under the snout.
    c.set(hx + 4, hy + 2, TOOTH);
    c.set(hx + 5, hy + 2, TOOTH);
    c.set(hx + 4, hy + 1, 0x3a1a1a);
  }
}

export function drawDeadRat(c: PixelCanvas): void {
  const F = RAT_ART.feetY;
  // On its back, feet in the air, tail limp.
  for (let i = 0; i < 8; i++) c.set(6 - i, F - 1 + (i > 4 ? 1 : 0), i < 3 ? PINK_DARK : PINK);
  blob(c, 12, F - 2, 6, 2.4, (_nx, ny) => (ny < -0.3 ? RAT_PALE : ny > 0.4 ? RAT_DARK : RAT));
  blob(c, 19, F - 2, 2.6, 1.8, () => RAT);
  c.set(22, F - 2, PINK);
  for (const x of [9, 11, 14, 16]) {
    c.set(x, F - 5, PINK_DARK);
    c.set(x, F - 6, PINK);
  }
  c.set(19, F - 3, P.outline);
}

/** Frames in the beasts' shared order: 0-1 idle, 2-5 walk, 6-7 sniffing, 8 snarl, 9 bite, 10 hurt, 11 dead. */
export const RAT_FRAMES: Array<RatPose | 'dead'> = [
  { legs: [0, 0], bob: 0, head: 'up', tail: 0 },
  { legs: [0, 0], bob: 0, head: 'up', tail: 1 },
  { legs: [-1, 1], bob: 0, head: 'up', tail: 0 },
  { legs: [0, 0], bob: -1, head: 'up', tail: 1.5 },
  { legs: [1, -1], bob: 0, head: 'up', tail: 3 },
  { legs: [0, 0], bob: -1, head: 'up', tail: 4.5 },
  { legs: [0, 0], bob: 0, head: 'sniff', tail: 0 },
  { legs: [0, 0], bob: 0, head: 'sniff', tail: 0.8 },
  { legs: [0, 0], bob: 0, head: 'rear', tail: 2 },
  { legs: [-1, 1], bob: 0, head: 'bite', tail: 1 },
  { legs: [0, 0], bob: 0, head: 'hurt', tail: 3 },
  'dead',
];
