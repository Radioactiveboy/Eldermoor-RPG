import Phaser from 'phaser';
import type { Tones } from './character';
import { chain, onItsSide, scaled, speck, V3 } from './beasts3d';
import { Detail, Hit, limb, Material, Model, renderFrame, Solid, FrameSpec } from './figure3d';
import { MODEL_ART } from './interior';
import { motherModel } from './mother3d';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * The brood hall at the bottom of the goblins' warren (see world/BroodHallMap.ts):
 * the brood-mother herself, sprawled on a bed of hides, swollen past all shape
 * with the young she is too sick to lay; her clutches of leathery eggs; the orb
 * on its plinth beside her, the thing someone far away speaks through; and the
 * heap of furs where Mother lies. Modelled as solids like the folk and beasts
 * (figure3d.ts) and drawn as single big frames.
 */

const HIDES: Tones = [0x6a5038, 0x46341f, 0x86684a];
const FUR: Tones = [0x7a6a58, 0x52463a, 0x988a76];
const BONE: Tones = [0xe8dcc0, 0xb4a88a, 0xfff6e0];
const TOOTH: Tones = [0xf0e6c8, 0xc4b894, 0xfffbea];
const CLAW: Tones = [0x3a3028, 0x241c16, 0x564a3e];
const STONE: Tones = [0x6e6a66, 0x484440, 0x8e8a84];
const SKIN: Tones = [0x6e8a50, 0x405430, 0x92ac70];
const MOTTLE: Tones = [0x566e3c, 0x3a4c28, 0x6e8a50];
const SAC: Tones = [0xb4b480, 0x7e7c52, 0xd6d4a4];
const SAC_RING: Tones = [0x8a8a5e, 0x5e5e3e, 0xa8a874];
const VEIN: Tones = [0x7a5a6a, 0x54404a, 0x94708a];
const EGG: Tones = [0xd8d0aa, 0xa49c7a, 0xf4eece];
const EGG_SPOT: Tones = [0xa4a078, 0x787452, 0xc4c094];

/** Registers a single drawn frame (or a strip of them) as an object's art, its anchor on the back corner of a w x h footprint. */
function register(scene: Phaser.Scene, key: string, frames: PixelCanvas[], spec: FrameSpec, w: number, h: number, anim?: { key: string; order: number[]; rate: number }): void {
  const sheet = new PixelCanvas(spec.w * frames.length, spec.h);
  frames.forEach((f, i) => sheet.blit(f, i * spec.w, 0));
  const tex = sheet.toTexture(scene, key);
  frames.forEach((_f, i) => tex.add(i, 0, i * spec.w, 0, spec.w, spec.h));
  // The model stands on the middle of its footprint, which lies (w - h) * 16 right of and (w + h) * 8 below its back corner.
  MODEL_ART[key] = { key, originX: (spec.w / 2 - (w - h) * 16) / spec.w, originY: (spec.feetY + 0.5 - (w + h) * 8) / spec.h };
  if (anim) scene.anims.create({ key: anim.key, frames: anim.order.map((frame) => ({ key, frame })), frameRate: anim.rate, repeat: -1 });
}

const draw = (m: Model, angle: number, spec: FrameSpec): PixelCanvas => {
  const f = renderFrame(m, angle, spec);
  f.outline();
  return f;
};

// ---------------------------------------------------------------- the brood-mother

/**
 * The brood-mother: a goblin's head and shoulders, grown huge and gone slack, on
 * a body that is nearly all egg-sac, a great pale ringed bladder veined with
 * purple, lying out behind her across the hides. A crown of bone spikes grows
 * out of her skull. Her arms are thin as sticks now. `breath` swells the sac.
 */
function broodMother(breath: number): Model {
  const solids: Solid[] = [];
  const details: Detail[] = [];
  const b = breath;
  // The bed of hides under her.
  solids.push({ cx: -16, cy: 2, cz: 0, rx: 118, ry: 5, rz: 52, material: (h) => (speck(h, 4) < 0.2 ? FUR : HIDES) });
  // The sac: segment by segment, swelling to the middle and tapering to a blunt end, ringed and veined.
  const sac: Material = (h: Hit) => {
    const ring = Math.abs(((h.x + 400) % 17) - 8.5) < 1.1;
    if (ring) return SAC_RING;
    const vein = Math.abs(Math.sin(h.x * 0.21 + h.z * 0.33) * 6 - (h.y - 30)) < 0.9 || Math.abs(Math.sin(h.z * 0.27 - h.x * 0.12) * 9 + h.x * 0.1 - h.z * 0.25) < 0.7;
    return vein ? VEIN : speck(h, 3) < 0.06 ? EGG_SPOT : SAC;
  };
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const x = 18 - t * 128;
    const swell = Math.sin(Math.PI * Math.min(1, t * 1.25)) * (1 - t * 0.35);
    const r = 12 + 34 * swell;
    solids.push({ cx: x, cy: 6 + r * 0.8 + b * swell, cz: -6 + Math.sin(t * 2.4) * 4, rx: 14, ry: r * 0.82 + b * swell, rz: r * 1.04 + b * 0.6 * swell, material: sac, soft: true });
  }
  // The shoulders and chest, propped up on the hides.
  const skin: Material = (h: Hit) => (speck(h, 2.4) < 0.18 ? MOTTLE : SKIN);
  solids.push({ cx: 30, cy: 26, cz: 4, rx: 22, ry: 20, rz: 22, material: skin });
  solids.push({ cx: 44, cy: 40, cz: 8, rx: 19, ry: 16, rz: 18, material: skin });
  // Her arms, thin as sticks, one under her and one lying out in front with its claws curled.
  solids.push(...limb([40, 40, 24], [56, 16, 34], 5, 4, skin));
  solids.push(...limb([56, 16, 34], [76, 6, 30], 4, 3.4, skin));
  for (let k = 0; k < 4; k++) solids.push(...chain([[78, 6, 27 + k * 2.2], [84, 4, 26 + k * 2.6], [86, 2, 24 + k * 2.6]], [1.4, 1, 0.6], CLAW));
  solids.push(...limb([34, 38, -14], [52, 12, -22], 5, 4, skin));
  // The head, huge and heavy, drooping forward: a jutting brow, a long hooked nose, tusks, and ears like torn sails.
  const hx = 62;
  const hy = 58;
  const hz = 12;
  solids.push({ cx: hx, cy: hy, cz: hz, rx: 17, ry: 15, rz: 16, material: skin, soft: true });
  solids.push({ cx: hx + 9, cy: hy + 6, cz: hz + 10, rx: 10, ry: 4, rz: 6, material: MOTTLE });
  solids.push(...chain([[hx + 12, hy + 2, hz + 12], [hx + 20, hy - 3, hz + 16], [hx + 22, hy - 9, hz + 15]], [4, 3, 1.8], skin));
  solids.push({ cx: hx + 8, cy: hy - 10, cz: hz + 9, rx: 11, ry: 5, rz: 9, material: MOTTLE });
  for (const side of [-1, 1]) {
    solids.push(...chain([[hx + 10, hy - 12, hz + 9 + side * 6], [hx + 12, hy - 7, hz + 9 + side * 8]], [2, 1.2], TOOTH));
    // The ears, sweeping back.
    solids.push(...chain([[hx - 6, hy + 2, hz + side * 14], [hx - 20, hy + 8, hz + side * 26], [hx - 32, hy + 12, hz + side * 30]], [6, 4, 1.5], skin));
  }
  // The crown of bone spikes, grown out of her skull.
  for (let k = 0; k < 7; k++) {
    const a = (k / 6 - 0.5) * 2.2;
    const base: V3 = [hx - 4 + Math.cos(a) * 4, hy + 12, hz + Math.sin(a) * 12];
    const tip: V3 = [base[0] - 3 - Math.abs(a) * 3, base[1] + 14 - Math.abs(a) * 4, base[2] + Math.sin(a) * 6];
    solids.push(...chain([base, tip], [2.6, 0.8], BONE, 0.6));
  }
  // Half-shut eyes, dull yellow.
  for (const side of [-1, 1]) details.push({ x: hx + 13, y: hy + 1, z: hz + side * 6, color: 0xc8a030 }, { x: hx + 13, y: hy + 2, z: hz + side * 6, color: 0x3a3020 });
  return { solids, details };
}

// ---------------------------------------------------------------- eggs

/** A clutch of leathery eggs in a nest of straw and hide scraps. */
function clutch(seed: number, count: number): Model {
  const solids: Solid[] = [{ cx: 0, cy: 1.5, cz: 0, rx: 16, ry: 2.5, rz: 13, material: (h) => (speck(h, 1.6) < 0.4 ? [P.straw, P.strawDark, P.strawLight] : HIDES) }];
  for (let i = 0; i < count; i++) {
    const a = seed * 1.7 + i * 2.39;
    const r = i === 0 ? 0 : 6 + (i % 2) * 3;
    const tall = 7 + ((seed + i) % 3);
    const egg: Material = (h) => (speck(h, 1.4) < 0.12 ? EGG_SPOT : EGG);
    solids.push({ cx: Math.cos(a) * r, cy: 2 + tall, cz: Math.sin(a) * r * 0.8, rx: 5.2, ry: tall, rz: 5.2, material: egg, soft: true });
  }
  return { solids, details: [] };
}

// ---------------------------------------------------------------- the orb

/**
 * A rough stone plinth with bone claws holding up a glass orb, smoke and light
 * turning inside it; `turn` is how far round the smoke has turned. Dark once
 * the voice has gone out of it, and `empty` once the hero has taken it.
 */
function orb(turn: number, dark = false, empty = false): Model {
  const solids: Solid[] = [];
  for (let y = 0; y <= 22; y += 3) {
    const w = 7.4 - y * 0.08 + (y === 0 ? 2 : 0);
    solids.push({ cx: Math.sin(y) * 0.4, cy: y + 2, cz: 0, rx: w, ry: 2.4, rz: w * 0.9, material: (h) => (speck(h, 1.8) < 0.15 ? [STONE[1], 0x302c28, STONE[0]] : STONE) });
  }
  // Bone claws gripping the orb.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    solids.push(...chain([[Math.cos(a) * 4, 26, Math.sin(a) * 4], [Math.cos(a) * 7.6, 31, Math.sin(a) * 7.6], [Math.cos(a) * 6, 37, Math.sin(a) * 6]], [1.4, 1.1, 0.6], BONE));
  }
  const glass: Material = (h: Hit) => {
    if (dark) return h.ny > 0.5 && h.nx < -0.2 ? [0x5a5468, 0x3a3648, 0x7a7488] : [0x2a2634, 0x1a1822, 0x3e3a4a];
    const swirl = Math.sin(Math.atan2(h.z, h.x) * 2 + h.y * 0.5 + turn * Math.PI * 2);
    if (swirl > 0.55) return [0xe8d4ff, 0xb48ae0, 0xffffff];
    if (swirl > 0) return [0xa070e0, 0x6a40a8, 0xc8a4ff];
    return [0x5a3290, 0x3a1e64, 0x7a4ab8];
  };
  if (!empty) solids.push({ cx: 0, cy: 34, cz: 0, rx: 8, ry: 8, rz: 8, material: glass, soft: true });
  return { solids, details: [] };
}

// ---------------------------------------------------------------- Mother on her furs

/** The heap of furs they laid her on, and, unless she has been carried away, Mother lying on her side under her shawl, facing the hall. */
function pallet(withMother: boolean): Model {
  const solids: Solid[] = [];
  const fur: Material = (h) => (speck(h, 2.2) < 0.3 ? HIDES : FUR);
  solids.push({ cx: 0, cy: 3, cz: 0, rx: 26, ry: 4, rz: 13, material: fur });
  solids.push({ cx: -16, cy: 6, cz: -2, rx: 9, ry: 4, rz: 9, material: fur });
  if (!withMother) {
    // A cup on its side, where somebody gave her water.
    solids.push({ cx: 18, cy: 8, cz: 7, rx: 2.2, ry: 1.6, rz: 2.6, material: [P.stone, P.mortar, P.stoneLight] });
    return { solids, details: [] };
  }
  // Mother, rolled onto her side: her head at the bundled furs, her feet towards +x.
  const lying = onItsSide(motherModel({ stride: 0, bob: 0 }), 33, 4.6);
  for (const s of lying.solids) solids.push({ ...s, cx: s.cx - 18, cy: s.cy + 5 });
  // A hide pulled up over her to the shoulder.
  solids.push({ cx: 4, cy: 9, cz: 1, rx: 14, ry: 4.4, rz: 6.8, material: (h) => (speck(h, 2) < 0.2 ? HIDES : [0x8a6a4a, 0x5e4630, 0xa8865e]) });
  return { solids, details: lying.details.map((d) => ({ ...d, x: d.x - 18, y: d.y + 5 })) };
}

export function generateBroodHall(scene: Phaser.Scene): void {
  // She lies along the hall, her head towards the way in.
  const big: FrameSpec = { w: 300, h: 150, feetY: 128, groundShade: 8, creases: true };
  register(scene, 'bh-broodmother', [draw(broodMother(0), 0, big), draw(broodMother(2.4), 0, big)], big, 5, 4, {
    key: 'bh-broodmother-breathe', order: [0, 0, 1, 1, 1, 0], rate: 1.6,
  });
  const small: FrameSpec = { w: 48, h: 40, feetY: 32, groundShade: 3 };
  for (let i = 0; i < 3; i++) register(scene, `bh-eggs-${i}`, [draw(clutch(i + 1, 3 + i), i * 70, small)], small, 1, 1);
  const tall: FrameSpec = { w: 32, h: 64, feetY: 58, groundShade: 4 };
  register(scene, 'bh-orb', [0, 0.25, 0.5, 0.75].map((t) => draw(orb(t), 30, tall)), tall, 1, 1, { key: 'bh-orb-swirl', order: [0, 1, 2, 3], rate: 5 });
  register(scene, 'bh-orb-dark', [draw(orb(0, true), 30, tall)], tall, 1, 1);
  register(scene, 'bh-plinth', [draw(orb(0, true, true), 30, tall)], tall, 1, 1);
  const bed: FrameSpec = { w: 72, h: 44, feetY: 34, groundShade: 3, creases: true };
  register(scene, 'bh-pallet-mother', [draw(pallet(true), 0, bed)], bed, 2, 1);
  register(scene, 'bh-pallet', [draw(pallet(false), 0, bed)], bed, 2, 1);
  generateGrave(scene);
}

// ---------------------------------------------------------------- Mother's grave

/** Mother's grave in the Hollow: a long mound of fresh earth, a cairn of field stones at its head, and a wooden marker with two names cut in it. */
export function grave(): Model {
  const earth: Tones = [0x6a4a32, 0x46301f, 0x86624a];
  const wood: Tones = [P.bark, P.barkDark, P.barkLight];
  const solids: Solid[] = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    solids.push({ cx: -14 + t * 28, cy: 2.5, cz: 0, rx: 7, ry: 3.6 - Math.abs(t - 0.5) * 2, rz: 7.5, material: (h) => (speck(h, 1.4) < 0.1 ? [0x8a7a5a, 0x5e5240, 0xa8987a] : earth) });
  }
  const stones: Array<[number, number, number, number]> = [[-18, 3, -3, 3.4], [-18, 3, 3, 3], [-21, 3, 0, 3.2], [-19, 7.5, 0, 2.8], [-15, 3, 0, 2.6], [-19.5, 11, -0.5, 2]];
  for (const [x, y, z, r] of stones) solids.push({ cx: x, cy: y, cz: z, rx: r * 1.1, ry: r * 0.85, rz: r, material: (h) => (speck(h, 1.2) < 0.2 ? [STONE[2], STONE[0], 0xb0aca6] : STONE) });
  // The marker: a post with a ring of wood on top, the old sign of the Saints, its middle hung with a sprig of heather.
  solids.push(...limb([-24, 0, 0], [-24, 20, 0], 1.1, 1, wood));
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    solids.push({ cx: -24 + Math.cos(a) * 5, cy: 25 + Math.sin(a) * 5, cz: 0, rx: 1.2, ry: 1.2, rz: 1.2, material: wood });
  }
  solids.push({ cx: -24, cy: 24, cz: 0.6, rx: 1, ry: 1.8, rz: 0.8, material: [0x7a4a7e, 0x4e3050, 0xa06aa2] });
  // A few early flowers someone put on it.
  const details: Detail[] = [[-4, 6, 3], [2, 6, -2], [8, 5.6, 2]].map(([x, y, z]) => ({ x, y, z, color: 0x8a9ae0 }));
  return { solids, details };
}

/** Which way the grave lies: its head (the cairn and marker) up to the right, the mound running down to the left. */
export const GRAVE_ANGLE = 210;

export function generateGrave(scene: Phaser.Scene): void {
  const spec: FrameSpec = { w: 96, h: 76, feetY: 60, groundShade: 3 };
  register(scene, 'grave-mother', [draw(scaled(grave(), 1.5), GRAVE_ANGLE, spec)], spec, 1, 1);
}
