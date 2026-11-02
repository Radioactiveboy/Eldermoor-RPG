import Phaser from 'phaser';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Wild animals. The grey wolf is drawn side-on, facing screen-right (it's
 * mirrored to face left). Its body is a silhouette traced from two curves, a
 * back line that rises to the shoulders and a belly line with a deep chest and
 * a tucked-up waist, then shaded like a real grey wolf's coat: a dark saddle,
 * grizzled grey flanks with a buff wash, a cream belly, chest and cheeks.
 * Long jointed legs (a backward hock behind, a straight foreleg in front), a
 * ruff of fur at the neck, a long narrow muzzle and a low-slung brush of a tail
 * with a black tip finish it.
 */

export const WOLF_W = 48;
export const WOLF_H = 32;
/** Pixel row its paws stand on, for the sprite origin. */
export const WOLF_FEET_Y = 29;

const FUR_DEEP = 0x332e38;
const FUR_DARK = 0x4b4652;
const FUR = 0x7a7480;
const FUR_LIGHT = 0xa29ca6;
const FUR_BUFF = 0x9e8e7c;
const FUR_PALE = 0xcfc6bb;
const EYE = 0xf2b33a;
const NOSE = 0x241c26;
const MOUTH = 0x5a1a22;
const TONGUE = 0xb04a52;
const TOOTH = 0xf4efe2;

type Head = 'up' | 'sniff' | 'snarl' | 'bite' | 'hurt';

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

/** A curve through [x, y] points, read off at any x (flat past either end). */
function curve(points: Array<[number, number]>): (x: number) => number {
  return (x) => {
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i];
      if (x <= x1) {
        const [x0, y0] = points[i - 1];
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
    }
    return points[points.length - 1][1];
  };
}

/**
 * Fills the columns x0..x1 between a top and a bottom curve, colouring each
 * pixel by its column and how far down the column it is (t, 0 at the top).
 */
function span(c: PixelCanvas, x0: number, x1: number, top: (x: number) => number, bot: (x: number) => number, color: (x: number, t: number, y: number) => number): void {
  for (let x = x0; x <= x1; x++) {
    const t0 = Math.round(top(x + 0.5));
    const b0 = Math.round(bot(x + 0.5));
    for (let y = t0; y < b0; y++) c.set(x, y, color(x, (y + 0.5 - t0) / Math.max(1, b0 - t0), y));
  }
}

/** A fixed scatter of pixels, so the coat looks grizzled rather than flat. */
const speck = (x: number, y: number) => ((((x * 73856093) ^ (y * 19349663)) >>> 0) % 97) / 97;

/** The coat on the body: saddle, grizzled flank, buff lower flank, cream belly and chest. */
function coat(x: number, t: number, y: number, bob: number): number {
  const s = speck(x, y - bob);
  const saddle = x >= 11 && x <= 27 ? 0.3 : 0.18;
  if (t < saddle) return s < 0.14 ? FUR : x > 13 && x < 25 && t < 0.13 ? FUR_DEEP : FUR_DARK;
  if (x >= 27 && t > 0.42) return s < 0.15 ? FUR_LIGHT : FUR_PALE; // pale chest
  if (t > 0.8) return FUR_PALE;
  if (t > 0.6) return s < 0.25 ? FUR_LIGHT : FUR_BUFF;
  // Haunch and shoulder catch the light.
  if ((x <= 13 || (x >= 23 && x <= 26)) && t < 0.55) return s < 0.3 ? FUR : FUR_LIGHT;
  return s < 0.16 ? FUR_LIGHT : s > 0.94 ? FUR_DARK : FUR;
}

/**
 * A hind leg: thigh down to the stifle, shank back to the hock, then the
 * long hind foot straight down to the paw.
 */
function hindLeg(c: PixelCanvas, hipX: number, hipY: number, dx: number, lift: number, near: boolean): void {
  const main = near ? FUR : FUR_DARK;
  const back = near ? FUR_DARK : FUR_DEEP;
  const fy = WOLF_FEET_Y - lift;
  const sx = hipX + 2 + dx * 0.35;
  const sy = hipY + 4;
  const hx = hipX - 1 + dx * 0.75 + lift * 0.5;
  const hy = fy - 5 + lift * 0.3;
  const px = hipX + dx;
  line(c, hipX - 1, hipY, sx - 1, sy, 4, main);
  line(c, sx - 1, sy, hx, hy, 2, main);
  line(c, hx, hy, px, fy - 1, 2, main);
  // The back of the hock in shadow; the paw a little forward of the foot.
  c.set(hx, hy, back);
  c.set(hx, hy + 1, back);
  c.rect(px, fy, 3, 1, back);
}

/** A foreleg: straight down from the elbow to the wrist, a short pastern, then the paw. */
function foreLeg(c: PixelCanvas, elbowX: number, elbowY: number, dx: number, lift: number, near: boolean): void {
  const main = near ? FUR_LIGHT : FUR_DARK;
  const shade = near ? FUR : FUR_DEEP;
  const fy = WOLF_FEET_Y - lift;
  // A raised foreleg folds at the wrist, the paw tucked back under it.
  const wx = elbowX + dx * 0.6;
  const wy = fy - 3 - (lift > 0 ? 1 : 0);
  const px = elbowX + dx - lift;
  line(c, elbowX, elbowY, wx, wy, 3, main);
  line(c, wx + 2, elbowY + 1, wx + 2, wy - 1, 1, shade);
  if (near) line(c, elbowX, elbowY + 1, wx, wy - 2, 1, FUR_DARK); // the dark stripe down the front of a wolf's foreleg
  line(c, wx, wy, px, fy - 1, 2, main);
  c.rect(px, fy, 3, 1, shade);
}

/** The brush: a chain of tufts, fullest in the middle, hanging low or held out, with a black tip. */
function drawTail(c: PixelCanvas, pose: WolfPose): void {
  const b = pose.bob;
  // From hanging almost straight down (0) to held out level behind (1).
  const a0 = Math.PI * (0.56 + 0.42 * pose.tail);
  const steps = 11;
  for (let i = 0; i < steps; i++) {
    const k = i / (steps - 1);
    const a = a0 - 0.2 * k * (1 - pose.tail); // hanging, the tip swinging in towards the hocks
    const d = 1 + i * 1.1;
    const x = 8.5 + Math.cos(a) * d;
    const y = 12 + b + Math.sin(a) * d;
    const r = 1.5 + Math.sin(Math.PI * Math.min(1, k * 1.2)) * 1.4;
    blob(c, x, y, r, r, (nx, ny) => {
      if (k > 0.78) return FUR_DEEP;
      // Lit along the upper edge, shadowed beneath and along the far side.
      const up = nx * Math.sin(a) - ny * Math.cos(a);
      return up < -0.35 ? FUR_DARK : up > 0.45 ? FUR_LIGHT : speck(Math.round(x * 3), i) < 0.3 ? FUR_DARK : FUR;
    });
  }
}

function drawWolf(c: PixelCanvas, pose: WolfPose): void {
  const b = pose.bob;
  const lift = pose.lift ?? [0, 0, 0, 0];
  const [farBack, nearBack, farFront, nearFront] = pose.legs;

  // Far-side legs first, darker, so the body and near legs overlap them.
  hindLeg(c, 15, 15 + b, farBack, lift[0], false);
  foreLeg(c, 28, 18 + b, farFront, lift[2], false);
  drawTail(c, pose);

  // The body: high at the shoulders, a dip behind them, a deep chest and a tucked-up waist.
  const top = curve([[8, 13.5 + b], [10, 11.5 + b], [13, 10.6 + b], [18, 11.2 + b], [22, 11 + b], [26, 9.8 + b], [30, 9 + b]]);
  const bot = curve([[8, 15 + b], [10, 17.5 + b], [13, 19.2 + b], [16, 18.6 + b], [19, 17.4 + b], [22, 17.6 + b], [25, 19.4 + b], [28, 20.4 + b], [30, 20 + b], [31, 18 + b]]);
  span(c, 8, 31, top, bot, (x, t, y) => coat(x, t, y, b));
  // A ragged fringe of belly fur.
  for (let x = 23; x <= 29; x += 2) c.set(x, Math.round(bot(x + 0.5)), FUR_PALE);
  if (pose.hackles) {
    for (let x = 18; x <= 28; x += 2) c.set(x, Math.round(top(x + 0.5)) - 1 - ((x / 2) % 2), FUR_DEEP);
  }

  drawHead(c, pose, top);

  // Near-side legs.
  hindLeg(c, 17, 15 + b, nearBack, lift[1], true);
  foreLeg(c, 30, 18 + b, nearFront, lift[3], true);
}

/** Where the head sits and how it's held, for each head pose. */
const HEADS: Record<Head, { x: number; y: number; tilt: number; jaw: number; ears: 'up' | 'back' }> = {
  up: { x: 36, y: 8, tilt: 0.05, jaw: 0, ears: 'up' },
  sniff: { x: 38, y: 19, tilt: 0.45, jaw: 0, ears: 'up' },
  snarl: { x: 37, y: 11, tilt: 0.1, jaw: 1, ears: 'back' },
  bite: { x: 38, y: 10, tilt: 0, jaw: 3, ears: 'back' },
  hurt: { x: 35, y: 11, tilt: 0.3, jaw: 0, ears: 'back' },
};

function drawHead(c: PixelCanvas, pose: WolfPose, back: (x: number) => number): void {
  const b = pose.bob;
  const h = HEADS[pose.head];
  const hx = h.x;
  const hy = h.y + (pose.head === 'sniff' ? pose.nod ?? 0 : b);

  // The neck, thick with a ruff: from the withers and chest up (or down) to the back of the skull.
  const n0 = 27;
  const neckTop = (x: number) => back(n0) + ((hy - 2 - back(n0)) * (x - n0)) / (hx - n0);
  const neckBot = (x: number) => 20 + b + ((hy + 3 - 20 - b) * (x - n0)) / (hx - n0);
  span(c, n0, hx, neckTop, neckBot, (x, t, y) => {
    const s = speck(x, y);
    if (t < 0.3) return s < 0.3 ? FUR : FUR_DARK;
    if (t > 0.62) return s < 0.25 ? FUR_LIGHT : FUR_PALE;
    return s < 0.3 ? FUR_LIGHT : FUR;
  });
  // Ragged ruff tufts along the nape and the throat.
  for (let x = n0 + 1; x < hx - 1; x += 2) {
    c.set(x, Math.round(neckTop(x + 0.5)) - 1, pose.hackles ? FUR_DEEP : FUR_DARK);
    c.set(x, Math.round(neckBot(x + 0.5)), FUR_PALE);
  }

  // Skull: a dark crown, pale cheeks below.
  blob(c, hx, hy, 3.6, 3.1, (nx, ny) => (ny < -0.35 ? FUR_DARK : ny > 0.3 && nx < 0.6 ? FUR_PALE : nx < -0.5 ? FUR : FUR_LIGHT));

  // Ears: tall and pointed, or flattened back.
  if (h.ears === 'up') {
    ear(c, hx - 2, hy - 6, 4, -0.4, FUR_DARK);
    ear(c, hx, hy - 6, 4, 0.3, FUR_DARK, FUR_LIGHT);
  } else {
    line(c, hx - 1, hy - 3, hx - 5, hy - 4, 2, FUR_DARK);
    line(c, hx + 1, hy - 3, hx - 3, hy - 5, 2, FUR_DARK);
    c.set(hx - 2, hy - 4, FUR_PALE);
  }

  // A long, narrow muzzle tapering to a black nose.
  const len = 6;
  const mx = hx + 2;
  const mTop = (x: number) => hy - 1.5 + (x - mx) * (0.2 + h.tilt);
  const upperBot = (x: number) => hy + (h.jaw ? 1 : 2.3) + (x - mx) * (h.tilt - (h.jaw ? 0.02 : 0.12));
  span(c, mx, mx + len - 1, mTop, upperBot, (x, t) => (t < 0.4 ? FUR : x > mx + len - 3 ? FUR_LIGHT : t > 0.7 ? FUR_PALE : FUR_LIGHT));
  const tipX = mx + len;
  const tipY = Math.round(mTop(tipX));
  c.rect(tipX - 1, tipY, 2, 2, NOSE);
  if (h.jaw > 0) {
    // Lips drawn back off the fangs, the lower jaw dropped open.
    const gape = h.jaw;
    const jawTop = (x: number) => upperBot(x) + 0.2;
    const jawBot = (x: number) => upperBot(x) + 1 + gape * ((x - mx) / len) + 1.2;
    span(c, mx, mx + len - 2, jawTop, jawBot, (x, t) => (t > 0.55 || x < mx + 1 ? FUR_PALE : gape > 1 && t > 0.3 && x < mx + 3 ? TONGUE : MOUTH));
    const ut = Math.round(upperBot(mx + len - 2));
    c.set(mx + len - 2, ut, TOOTH); // upper fang
    c.set(mx + 2, Math.round(upperBot(mx + 2)), TOOTH);
    c.set(mx + len - 3, Math.round(jawBot(mx + len - 3)) - 2, TOOTH); // lower fang
    c.set(mx + 1, Math.round(mTop(mx + 1)) + 1, FUR_DARK); // the snarl's wrinkled nose
    c.set(mx + 3, Math.round(mTop(mx + 3)) + 1, FUR_DARK);
  } else {
    c.set(mx + 2, Math.round(upperBot(mx + 2)) - 1, FUR_DARK); // the line of the mouth
    c.set(mx + 3, Math.round(upperBot(mx + 3)) - 1, FUR_DARK);
  }

  // Almond eye under a dark brow, with the dark line running forward from it; squeezed shut when hurt.
  const ey = hy - 1;
  if (pose.head === 'hurt') {
    c.rect(hx + 1, ey, 2, 1, NOSE);
    c.set(hx + 2, ey - 1, FUR_DARK);
  } else {
    c.set(hx + 1, ey, EYE);
    c.set(hx + 2, ey, NOSE);
    c.rect(hx, ey - 1, 3, 1, FUR_DEEP);
    c.set(hx + 1, ey + 1, FUR_PALE);
  }
}

/** Lying still on its side, legs out, tail trailing. */
function drawDeadWolf(c: PixelCanvas): void {
  const F = WOLF_FEET_Y;
  for (let i = 0; i < 9; i++) {
    const r = 1.4 + Math.sin(Math.PI * Math.min(1, (i / 8) * 1.25)) * 1.1;
    blob(c, 10 - i * 1.05, F - 3 + i * 0.25, r, r, (_nx, ny) => (i > 6 ? FUR_DEEP : ny < -0.2 ? FUR_DARK : FUR));
  }
  // Far legs behind, stiff.
  line(c, 14, F - 4, 18, F, 2, FUR_DARK);
  line(c, 27, F - 4, 31, F, 2, FUR_DARK);
  const top = curve([[9, F - 6], [12, F - 10], [20, F - 10.5], [28, F - 11], [33, F - 9]]);
  const bot = curve([[9, F - 3], [12, F - 2], [33, F - 2]]);
  span(c, 9, 33, top, bot, (x, t, y) => (t < 0.3 ? (speck(x, y) < 0.2 ? FUR : FUR_DARK) : t > 0.75 ? FUR_PALE : speck(x, y) < 0.25 ? FUR_LIGHT : FUR));
  // Near legs, out towards the viewer.
  line(c, 14, F - 3, 19, F + 1, 2, FUR);
  c.rect(20, F + 1, 2, 1, FUR_DARK);
  line(c, 28, F - 3, 32, F + 1, 2, FUR_LIGHT);
  c.rect(33, F + 1, 2, 1, FUR);
  // Head flat on the ground, muzzle out, eye shut.
  blob(c, 37, F - 4, 3.6, 2.8, (_nx, ny) => (ny < -0.3 ? FUR_DARK : ny > 0.3 ? FUR_PALE : FUR_LIGHT));
  span(c, 39, 45, curve([[39, F - 5], [45, F - 3]]), curve([[39, F - 1], [45, F - 1]]), (_x, t) => (t < 0.4 ? FUR : FUR_PALE));
  c.rect(45, F - 3, 1, 2, NOSE);
  c.rect(37, F - 5, 2, 1, NOSE);
  line(c, 34, F - 7, 31, F - 9, 2, FUR_DARK); // ear, limp
  c.set(42, F - 1, TONGUE);
}

const STILL: WolfPose['legs'] = [0, 0, 0, 0];

/** Frame order in the sheet. */
const FRAMES: Array<WolfPose | 'dead'> = [
  // 0-1 standing, breathing
  { legs: STILL, bob: 0, head: 'up', tail: 0.15 },
  { legs: STILL, bob: 1, head: 'up', tail: 0.2 },
  // 2-5 trotting
  { legs: [2, -2, -2, 2], bob: 1, head: 'up', tail: 0.35 },
  { legs: [0, 0, 0, 0], lift: [0, 2, 2, 0], bob: 0, head: 'up', tail: 0.4 },
  { legs: [-2, 2, 2, -2], bob: 1, head: 'up', tail: 0.35 },
  { legs: [0, 0, 0, 0], lift: [2, 0, 0, 2], bob: 0, head: 'up', tail: 0.4 },
  // 6-7 nose to the ground, sniffing
  { legs: [0, 0, 1, 1], bob: 1, head: 'sniff', tail: 0.1 },
  { legs: [0, 0, 1, 1], bob: 1, head: 'sniff', tail: 0.15, nod: 1 },
  // 8 snarling: head low, lips back, hackles up
  { legs: [-1, -1, 1, 1], bob: 1, head: 'snarl', tail: 0.75, hackles: true },
  // 9 biting, stretched forward
  { legs: [-2, -2, 3, 3], lift: [0, 0, 1, 1], bob: 0, head: 'bite', tail: 0.8 },
  // 10 flinching
  { legs: [-1, 1, -2, -1], bob: 1, head: 'hurt', tail: 0 },
  // 11 dead
  'dead',
];

export const WOLF_FRAME = { snarl: 8, bite: 9, hurt: 10, dead: 11 } as const;
/** Every beast's sheet has the wolf's frame order: 0-1 standing, 2-5 walking, 6-7 head down, then these. */
export const CREATURE_FRAME = WOLF_FRAME;

/**
 * Each beast's frame size and the pixel row its feet stand on, by kind (see
 * systems/Combat.ts FOES), and how much bigger than its frame it's shown.
 */
export const CREATURE_ART: Record<'wolf' | 'wolfmother' | 'deer' | 'hare' | 'boar', { w: number; h: number; feetY: number; scale?: number }> = {
  wolf: { w: WOLF_W, h: WOLF_H, feetY: WOLF_FEET_Y },
  // The Wolf Mother: the grey wolf's frames, half as big again, in a coat as white as frost.
  wolfmother: { w: WOLF_W, h: WOLF_H, feetY: WOLF_FEET_Y, scale: 1.5 },
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

/** The Wolf Mother's coat: the grey wolf's colours swapped for white fur with blue-grey shadows, and ice-blue eyes. */
const WHITE_COAT: Record<number, number> = {
  [FUR_DEEP]: 0x6e7a90,
  [FUR_DARK]: 0x9aa4b8,
  [FUR_BUFF]: 0xd2d8e4,
  [FUR]: 0xdfe4ec,
  [FUR_LIGHT]: 0xf4f6fa,
  [FUR_PALE]: 0xffffff,
  [EYE]: 0x7ad8ff,
};

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
  sheet(scene, 'wolf', FRAMES, drawWolf, drawDeadWolf, { walk: 9 });
  sheet(scene, 'wolfmother', FRAMES, drawWolf, drawDeadWolf, { walk: 8 }, WHITE_COAT);
  sheet(scene, 'deer', DEER_FRAMES, drawDeer, drawDeadDeer, { walk: 8 });
  sheet(scene, 'hare', HARE_FRAMES, drawHare, drawDeadHare, { walk: 10 });
  sheet(scene, 'boar', BOAR_FRAMES, drawBoar, drawDeadBoar, { walk: 9 });
}
