import Phaser from 'phaser';
import { FRAME_H, FRAME_W } from './character';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Mother: a frail old woman in a plum dress and rust-coloured shawl, leaning
 * on a walking stick. Drawn facing the viewer, since she mostly stays put.
 * Also draws her dialogue portrait, with talking and blinking frames.
 */

interface MotherPose {
  bob: number;
  cough: boolean;
}

function drawMother(c: PixelCanvas, pose: MotherPose): void {
  const cx = 16;
  const b = pose.bob;
  const shade = (x: number, left: number, right: number, base: number, dark: number, light: number) => {
    const rel = (x - left) / Math.max(1, right - left);
    return rel > 0.68 ? dark : rel < 0.16 ? light : base;
  };

  // Long skirt, a little wider at the hem, with a linen apron.
  for (let y = 29; y <= 44; y++) {
    const half = 5.5 + (y - 29) * 0.18;
    const left = Math.round(cx - half);
    const right = Math.round(cx + half);
    for (let x = left; x <= right; x++) c.set(x, y, y === 44 ? P.dressDark : shade(x, left, right, P.dress, P.dressDark, P.dressLight));
  }
  c.rect(13, 31, 6, 12, P.linen);
  c.rect(17, 31, 2, 12, P.linenDark);
  c.rect(12, 45, 3, 1, P.leatherDark);
  c.rect(17, 45, 3, 1, P.leatherDark);

  // Bodice under the shawl.
  c.shadedRect(11, 22 + b, 10, 8, P.dress, P.dressDark, P.dressLight);
  // Shawl over the shoulders, coming to a point in front.
  for (let y = 21 + b; y <= 30 + b; y++) {
    const t = y - (21 + b);
    const half = t < 4 ? 7 : Math.max(1, 7 - (t - 3) * 1.6);
    const left = Math.round(cx - half);
    const right = Math.round(cx + half);
    for (let x = left; x <= right; x++) c.set(x, y, shade(x, left, right, P.shawl, P.shawlDark, P.shawlLight));
  }
  for (let x = 10; x <= 22; x += 2) c.set(x, 25 + b, P.shawlDark); // fringe

  // Walking stick in her right hand (screen-left), the other hand at her chest.
  c.rect(8, 28 + b, 1, 46 - 28 - b, P.bark);
  c.set(8, 28 + b, P.barkLight);
  c.rect(7, 28 + b, 3, 2, P.skinPale);
  if (pose.cough) {
    c.rect(15, 19 + b, 3, 2, P.skinPale); // hand to mouth
  } else {
    c.rect(16, 26 + b, 3, 2, P.skinPale);
  }

  // Head, bowed a little lower when she coughs.
  const hy = 15 + b + (pose.cough ? 1 : 0);
  c.ellipse(cx, hy - 3, 6, 4.5, P.hairGrey, P.hairGreyDark, P.hairGreyLight);
  c.ellipse(cx, hy - 8, 2.6, 2.2, P.hairGrey, P.hairGreyDark, P.hairGreyLight); // bun
  c.ellipse(cx, hy + 0.5, 4.6, 5, P.skinPale, P.skinPaleShade);
  // Hair framing the face.
  c.rect(11, hy - 3, 2, 5, P.hairGrey);
  c.rect(20, hy - 3, 2, 5, P.hairGreyDark);
  c.rect(12, hy - 4, 8, 2, P.hairGrey);
  if (pose.cough) {
    c.rect(13, hy, 2, 1, P.skinPaleDeep); // eyes squeezed shut
    c.rect(17, hy, 2, 1, P.skinPaleDeep);
  } else {
    c.set(14, hy, P.eye);
    c.set(18, hy, P.eye);
    c.set(14, hy + 1, P.skinPaleShade);
    c.set(18, hy + 1, P.skinPaleShade);
    c.rect(15, hy + 3, 3, 1, P.lip);
  }
}

const POSES: MotherPose[] = [
  { bob: 0, cough: false },
  { bob: 1, cough: false },
  { bob: 1, cough: true },
];

/** Portrait frames: 0 = mouth closed, 1 = mouth open, 2 = blinking. */
function drawPortrait(c: PixelCanvas, mouthOpen: boolean, blink: boolean): void {
  // Bun and back hair, then shawl and shoulders.
  c.ellipse(32, 9, 7, 5, P.hairGrey, P.hairGreyDark, P.hairGreyLight);
  c.ellipse(32, 23, 16.5, 13, P.hairGrey, P.hairGreyDark, P.hairGreyLight);
  c.rect(16, 24, 5, 16, P.hairGrey);
  c.rect(43, 24, 5, 16, P.hairGreyDark);
  c.ellipse(32, 68, 30, 18, P.dress, P.dressDark, P.dressLight);
  c.shadedRect(27, 42, 11, 12, P.skinPaleShade, P.skinPaleDeep);
  // Linen collar, then the shawl crossing over it.
  for (let y = 52; y < 64; y++) {
    const half = (y - 50) * 0.8;
    c.rect(32 - half, y, half * 2, 1, y > 60 ? P.linenDark : P.linen);
  }
  for (let y = 50; y < 64; y++) {
    const inner = 6 + (y - 50) * 0.9;
    for (let x = 0; x < 64; x++) {
      const d = Math.abs(x - 32);
      if (d < inner || d > inner + 14 + (y - 50)) continue;
      c.set(x, y, x > 40 ? P.shawlDark : d > inner + 10 ? P.shawlLight : P.shawl);
    }
  }
  c.ellipse(32, 59, 3, 2.5, P.shawlDark, P.shawlDark);

  // Face.
  c.ellipse(32, 33, 12.5, 15, P.skinPale, P.skinPaleShade);
  // Front hair: a soft hairline swept back from a middle parting.
  for (let y = 10; y < 30; y++) {
    for (let x = 16; x < 49; x++) {
      const nx = (x + 0.5 - 32) / 16.5;
      const ny = (y + 0.5 - 23) / 13;
      if (nx * nx + ny * ny > 1) continue;
      const line = 21 + Math.pow((x - 32) / 12, 2) * 7;
      if (y > line) continue;
      const strand = (x + Math.floor(y / 2)) % 4 === 0;
      c.set(x, y, x > 40 ? P.hairGreyDark : strand ? P.hairGreyLight : P.hairGrey);
    }
  }
  c.set(32, 15, P.hairGreyDark);
  c.set(32, 16, P.hairGreyDark);

  // Brows raised in the middle: worried.
  for (let i = 0; i < 5; i++) {
    c.set(24 + i, 27 - (i > 2 ? 1 : 0), P.hairGreyDark);
    c.set(40 - i, 27 - (i > 2 ? 1 : 0), P.hairGreyDark);
  }
  // Eyes, with tired shadows beneath.
  for (const ex of [27, 37]) {
    if (blink) {
      c.rect(ex - 2, 32, 5, 1, P.skinPaleDeep);
    } else {
      c.rect(ex - 2, 30, 5, 1, P.skinPaleDeep);
      c.rect(ex - 2, 31, 5, 2, P.flowerWhite);
      c.rect(ex - 1, 31, 2, 2, P.eye);
      c.set(ex - 1, 31, P.stoneLight);
    }
    c.rect(ex - 2, 34, 5, 1, P.skinPaleShade);
    c.set(ex + 3, 33, P.skinPaleShade);
  }
  // Nose, cheek lines and forehead creases.
  for (let y = 32; y < 39; y++) c.set(34, y, P.skinPaleShade);
  c.set(31, 39, P.skinPaleDeep);
  c.set(34, 39, P.skinPaleDeep);
  c.rect(32, 40, 2, 1, P.skinPaleShade);
  for (let i = 0; i < 4; i++) {
    c.set(25 + Math.floor(i / 2), 39 + i, P.skinPaleShade);
    c.set(39 - Math.floor(i / 2), 39 + i, P.skinPaleShade);
  }
  c.rect(28, 22, 8, 1, P.skinPaleShade);
  // Mouth.
  if (mouthOpen) {
    c.rect(29, 43, 7, 1, P.lip);
    c.rect(30, 44, 5, 2, P.ink);
    c.rect(31, 46, 3, 1, P.lip);
  } else {
    c.rect(29, 44, 7, 1, P.lip);
    c.set(28, 45, P.skinPaleShade);
    c.set(36, 45, P.skinPaleShade);
  }
  c.outline();
}

export const PORTRAIT_SIZE = 64;

export function generateNpcs(scene: Phaser.Scene): void {
  const sheet = new PixelCanvas(FRAME_W * POSES.length, FRAME_H);
  POSES.forEach((pose, i) => {
    const frame = new PixelCanvas(FRAME_W, FRAME_H);
    drawMother(frame, pose);
    frame.outline();
    sheet.blit(frame, i * FRAME_W, 0);
  });
  const tex = sheet.toTexture(scene, 'npc-mother');
  POSES.forEach((_p, i) => tex.add(i, 0, i * FRAME_W, 0, FRAME_W, FRAME_H));
  scene.anims.create({
    key: 'mother-idle',
    frames: [0, 1, 0, 1, 0, 1, 2, 2, 1].map((frame) => ({ key: 'npc-mother', frame })),
    frameRate: 1.6,
    repeat: -1,
  });

  const portraits = new PixelCanvas(PORTRAIT_SIZE * 3, PORTRAIT_SIZE);
  [
    [false, false],
    [true, false],
    [false, true],
  ].forEach(([mouth, blink], i) => {
    const frame = new PixelCanvas(PORTRAIT_SIZE, PORTRAIT_SIZE);
    drawPortrait(frame, mouth, blink);
    portraits.blit(frame, i * PORTRAIT_SIZE, 0);
  });
  const ptex = portraits.toTexture(scene, 'portrait-mother');
  for (let i = 0; i < 3; i++) ptex.add(i, 0, i * PORTRAIT_SIZE, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
}
