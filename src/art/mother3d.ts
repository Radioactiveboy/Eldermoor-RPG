import Phaser from 'phaser';
import type { Tones } from './character';
import { Detail, generateFigure3D, Hit, limb, Model, Pose3D, Solid } from './figure3d';
import { PALETTE as P } from './palette';

/**
 * Mother, modelled in 3D like everyone else (see figure3d.ts), so she can walk
 * about the cottage, sit at the table and turn to face whoever she's talking
 * to: a frail, stooped old woman in a plum dress to the ankles, a linen apron,
 * a rust-coloured shawl over her shoulders, her grey hair pinned up in a bun,
 * leaning on a walking stick. Her dialogue portrait is in portraits.ts.
 */
export function motherModel(pose: Pose3D): Model {
  const dress: Tones = [P.dress, P.dressDark, P.dressLight];
  const shawl: Tones = [P.shawl, P.shawlDark, P.shawlLight];
  const apron: Tones = [P.linen, P.linenDark, 0xfff4e0];
  const skin: Tones = [P.skinPale, P.skinPaleShade, 0xfff0e0];
  const hair: Tones = [P.hairGrey, P.hairGreyDark, P.hairGreyLight];
  const shoes: Tones = [P.leatherDark, P.barkDark, P.leather];
  const stick: Tones = [P.bark, P.barkDark, P.barkLight];
  const b = pose.bob;
  const s = pose.stride * 0.7;
  const sit = !!pose.sit;
  // Bent with age: the shoulders and head well forward of the hips.
  const lean = sit ? 1.2 : 1.8;
  const solids: Solid[] = [];
  const front = (h: Hit) => h.nz > 0.15 && Math.abs(h.nx) < 0.7;

  if (sit) {
    for (const side of [-1, 1]) {
      solids.push({ cx: side * 2, cy: 1.2, cz: 6.4, rx: 1.5, ry: 1.2, rz: 2.2, material: shoes });
      solids.push(...limb([side * 2, 3, 6], [side * 2, 9, 5.4], 1.6, 1.7, dress));
    }
    // The skirt over her knees, and falling to the floor in front.
    solids.push({ cx: 0, cy: 10.4, cz: 3, rx: 5, ry: 1.8, rz: 4.6, material: (h) => (front(h) ? apron : dress) });
    solids.push({ cx: 0, cy: 6, cz: 5.6, rx: 4.6, ry: 4.2, rz: 1.8, material: (h) => (h.nz > 0.3 && Math.abs(h.nx) < 0.6 ? apron : dress) });
  } else {
    for (const side of [-1, 1]) {
      const swing = s * side;
      solids.push({ cx: side * 1.9, cy: 1.1 + (swing < 0 ? 0.6 : 0), cz: 0.9 + swing * 1.8, rx: 1.5, ry: 1.2, rz: 2.2, material: shoes });
    }
    // A long skirt, widening to the hem, the apron over the front.
    for (let y = 2.4; y <= 15; y += 0.5) {
      const t = (15 - y) / 12.6;
      solids.push({
        cx: 0, cy: y - b * (1 - t), cz: s * 0.4 * t + 0.2, rx: 4.3 + t * 2, ry: 0.8, rz: 3.6 + t * 1.4,
        material: (h) => (front(h) && h.y > 4 && Math.abs(h.x) < 3.6 ? apron : dress),
      });
    }
  }

  // Bodice, belted with the apron strings.
  const bodice = (h: Hit): Tones => (Math.abs(h.y - (16.2 - b)) < 0.6 ? apron : dress);
  solids.push({ cx: 0, cy: 16.4 - b, cz: lean * 0.25, rx: 4.2, ry: 2.8, rz: 3.4, material: bodice });
  solids.push({ cx: 0, cy: 20.6 - b, cz: lean * 0.7, rx: 4.6, ry: 4.2, rz: 3.6, material: bodice });
  // The shawl: over her back and shoulders, its ends crossed and tucked in at the front, fringed at the hem.
  const shawlPaint = (h: Hit): Tones => (Math.floor(h.x * 1.4) % 2 === 0 && h.y < 17.8 - b ? [P.shawlDark, 0x5a2a1e, P.shawl] : shawl);
  solids.push({ cx: 0, cy: 20.4 - b, cz: lean * 0.6 - 1.4, rx: 5.6, ry: 4.6, rz: 3, material: shawlPaint });
  solids.push({ cx: 0, cy: 24 - b, cz: lean * 0.9, rx: 5.4, ry: 1.8, rz: 3.9, material: shawl });
  for (const side of [-1, 1]) solids.push(...limb([side * 3.6, 23.4 - b, lean + 2.2], [-side * 1.6, 18.6 - b, lean + 2.8], 1.1, 0.9, shawl, 0.4));

  // Arms: the right hand on her stick, the left at her chest (or both in her lap when she sits).
  let stickHand: [number, number, number] = [0, 0, 0];
  for (const side of [-1, 1]) {
    const right = side === -1;
    const shoulder: [number, number, number] = [side * 4.6, 23 - b, lean];
    solids.push({ cx: shoulder[0], cy: shoulder[1], cz: shoulder[2], rx: 2.1, ry: 2, rz: 2.1, material: shawl });
    let elbow: [number, number, number];
    let hand: [number, number, number];
    if (sit) {
      elbow = [side * 5.2, 18.6 - b, lean + 1.6];
      hand = [side * 2.4, 12.4, 4.6];
    } else if (right) {
      elbow = [side * 6, 19 - b, lean + 0.8];
      hand = [side * 6.8, 16 - b, lean + 2.6 + s];
      stickHand = hand;
    } else {
      elbow = [side * 5.4, 18.6 - b, lean + 1.6 - s * 0.5];
      hand = [side * 2.2, 19.6 - b, lean + 3.6];
    }
    solids.push(...limb(shoulder, elbow, 1.5, 1.3, dress));
    solids.push(...limb(elbow, hand, 1.3, 1.2, dress));
    solids.push({ cx: hand[0], cy: hand[1] - 0.4, cz: hand[2] + 0.3, rx: 1.3, ry: 1.3, rz: 1.4, material: skin });
  }
  if (!sit) {
    // The walking stick, planted a little ahead of her.
    const [x, y, z] = stickHand;
    solids.push(...limb([x, y + 1, z], [x - 0.4, 0.4, z + 1.6 + s * 1.2], 0.6, 0.55, stick, 0.4).map((p) => ({ ...p, soft: true })));
    solids.push({ cx: x, cy: y + 1.2, cz: z, rx: 1, ry: 0.7, rz: 1, material: stick });
  }

  // Head bowed forward, grey hair drawn back into a bun.
  const hy = 30.2 - b;
  const hz = 1.6 + lean * 1.1;
  solids.push({ cx: 0, cy: 25.8 - b, cz: hz * 0.7, rx: 1.8, ry: 1.8, rz: 1.8, material: skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (py > 1.8 || h.nz < -0.2) return hair;
    if (Math.abs(h.nx) > 0.72 && py > -1.6) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 4.9, ry: 5.4, rz: 4.8, material: head, soft: true });
  solids.push({ cx: 0, cy: hy + 2.6, cz: hz - 4.6, rx: 2.6, ry: 2.4, rz: 2.2, material: hair });
  solids.push({ cx: 0, cy: hy - 0.2, cz: hz + 4.8, rx: 0.8, ry: 1, rz: 0.8, material: skin });

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 1.9, y: hy + 0.8, z: hz + 4.6, color: P.eye });
  details.push({ x: 0, y: hy - 2.2, z: hz + 4.6, color: P.lip });
  return { solids, details };
}

export function generateMother(scene: Phaser.Scene): void {
  generateFigure3D(scene, 'folk-mother', motherModel);
}
