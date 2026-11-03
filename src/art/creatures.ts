import Phaser from 'phaser';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';
import { BEAST_FRAME, boarSheet, boarSpec, deerSheet, deerSpec, generateBeast, GREY_WOLF, WHITE_WOLF, wolfSheet, wolfSpec } from './beasts3d';
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
  deer: { ...deerSpec(), eight: true, tall: 42 },
  hare: { w: 26, h: 22, feetY: 19 },
  boar: { ...boarSpec(), eight: true, tall: 24 },
  // The rats in the Crooked Tankard's cellar (see rats.ts).
  rat: { ...RAT_ART, scale: 1.3 },
};

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
  generateBeast(scene, 'deer', deerSheet(), 8);
  sheet(scene, 'hare', HARE_FRAMES, drawHare, drawDeadHare, { walk: 10 });
  generateBeast(scene, 'boar', boarSheet(), 9);
  sheet(scene, 'rat', RAT_FRAMES, drawRat, drawDeadRat, { walk: 12 });
}
