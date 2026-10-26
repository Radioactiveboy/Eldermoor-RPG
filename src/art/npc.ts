import Phaser from 'phaser';
import { FRAME_H, FRAME_W } from './character';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Mother: a frail old woman in a plum dress and rust-coloured shawl, leaning
 * on a walking stick. Drawn facing the viewer, since she mostly stays put.
 * Her dialogue portrait is in portraits.ts.
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
}
