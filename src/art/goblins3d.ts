import Phaser from 'phaser';
import { darker, type Tones } from './character';
import { BeastSheet, chain, generateBeast, onItsSide, speck, V3 } from './beasts3d';
import { Detail, FrameSpec, Hit, limb, Material, Model, Pose3D, Solid } from './figure3d';
import { PALETTE as P } from './palette';

/**
 * The goblins who raid the Hollow, modelled in 3D like everyone else (see
 * figure3d.ts) and drawn on a beast's sheet of frames (see beasts3d.ts), so
 * they can skulk, square up, swing, flinch and fall in a fight.
 *
 * A goblin is a hunched, pot-bellied little thing on bandy legs, with long
 * arms that hang to its knees, clawed hands and feet, and a head too big for
 * it: a heavy brow, a long hooked nose, a wide mouth with tusks jutting up
 * from the lower jaw, little yellow eyes, and great ears that sweep out and
 * back like a bat's. Three sorts of common goblin come raiding (a cutter with
 * a cleaver, a spearman, and a firebrand with a torch and a hatchet), led by a
 * Goblin Brute: half as big again, in scraps of plate and mail and a horned
 * helm, with a round shield and a spiked club.
 */

/** What a goblin's weapon arm (its right, screen-left facing us) is doing. */
type Act = 'rest' | 'ready' | 'strike' | 'hurt';

type Weapon = 'cleaver' | 'spear' | 'hatchet' | 'club';

interface GoblinLook {
  skin: Tones;
  /** The skin's warts and blotches. */
  mottle: Tones;
  /** What it wears round its middle: a ragged kilt of hide. */
  kilt: Tones;
  /** A vest, jerkin or coat over the chest, if any. */
  vest?: Tones;
  /** Paint it (straps, patches, mail showing). */
  vestPaint?: (h: Hit, base: Tones) => Tones;
  /** Hair on the crown: a topknot, or a few lank strands. */
  hair?: Tones;
  topknot?: boolean;
  /** Eye colour. */
  eye: number;
  weapon: Weapon;
  /** A burning torch in the off hand. */
  torch?: boolean;
  /** A round shield on the off arm. */
  shield?: boolean;
  /** Stripes of war paint across the face. */
  paint?: Tones;
  /** A cap of leather, or a horned iron helm. */
  cap?: 'leather' | 'helm';
  /** Iron on the shoulders, shins and forearms. */
  armoured?: boolean;
  /** A string of teeth and finger bones round the neck. */
  bones?: boolean;
  /** A ragged hood and cape. */
  hood?: Tones;
  /** How much bigger it is than a common goblin, and how much broader for its size. */
  size?: number;
  bulk?: number;
  /** How far forward it hunches (body-space units at the shoulders). */
  hunch?: number;
}

const WOOD: Tones = [P.bark, P.barkDark, P.barkLight];
const DARK_WOOD: Tones = [0x5a3e28, 0x3e2a1a, 0x74543a];
const RUST: Tones = [0x8a5a3a, 0x5e3c26, 0xb07a4e];
const IRON: Tones = [0x7a7c86, 0x4e505a, 0xa8acb6];
const BLACK_IRON: Tones = [0x4e4e58, 0x30303a, 0x6e6e7a];
const BONE: Tones = [0xe8dcc0, 0xb4a88a, 0xfff6e0];
const TOOTH: Tones = [0xf0e6c8, 0xc4b894, 0xfffbea];
const CLAW: Tones = [0x3a3028, 0x241c16, 0x564a3e];
const HIDE: Tones = [0x7a5a3a, 0x54402a, 0x94704a];
const FLAME: Tones = [P.fireOrange, P.fireRed, P.fireYellow];
const FLAME_CORE: Tones = [P.fireYellow, P.fireOrange, 0xfff4c0];

const knob = (p: V3, r: number, material: Material, soft = false): Solid => ({ cx: p[0], cy: p[1], cz: p[2], rx: r, ry: r, rz: r, material, soft });

/**
 * One goblin in one pose. Body space as everywhere: x across (to screen-right
 * facing us), y up, z the way it faces. `act` sets the weapon arm and how the
 * body leans for a fight.
 */
function goblinModel(pose: Pose3D, look: GoblinLook, act: Act = 'rest'): Model {
  const { skin, mottle } = look;
  const b = pose.bob;
  const w = look.bulk ?? 1;
  // Squared up for a fight: feet planted wide, one ahead of the other.
  const s = act === 'ready' || act === 'strike' ? 0.8 : act === 'hurt' ? -0.6 : pose.stride;
  const hunch = (look.hunch ?? 2.2) + (act === 'strike' ? 2.2 : act === 'hurt' ? -2.4 : act === 'ready' ? 0.8 : 0);
  const solids: Solid[] = [];
  const details: Detail[] = [];

  // Green skin, blotched and warty, a little paler on the belly.
  const hide = (h: Hit): Tones => {
    const n = speck(h, 1.4);
    if (n < 0.14) return mottle;
    if (h.ny < -0.45 && h.nz > 0.2) return [skin[2], skin[0], skin[2]];
    return skin;
  };

  // --- Legs: bowed out at the knee, thin as sticks, ending in big clawed feet.
  for (const side of [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 && act === 'rest' ? 1 : 0;
    const hip: V3 = [side * 2.2 * w, 10 - b * 0.5, 0.2];
    const knee: V3 = [side * 3.8 * w, 5.8 + lift * 0.6, 1 + swing * 1.4];
    const ankle: V3 = [side * 2.8 * w, 1.9 + lift, swing * 2.4 - 0.2];
    const greave = look.armoured ? (h: Hit): Tones => (h.y < 6 && h.y > 2.6 ? BLACK_IRON : hide(h)) : hide;
    solids.push(...chain([hip, knee, ankle], [1.8 * w, 1.3 * w, 1.1 * w], greave, 0.45));
    // The foot: long, flat, three clawed toes splayed forward.
    const foot: V3 = [ankle[0], 1 + lift, ankle[2] + 1.6];
    solids.push({ cx: foot[0], cy: foot[1], cz: foot[2], rx: 1.6 * w, ry: 0.9, rz: 2.6 * w, material: hide });
    for (const toe of [-1, 0, 1]) {
      const tip: V3 = [foot[0] + toe * 1.1 * w, 0.6 + lift, foot[2] + 2.6 * w + (toe === 0 ? 0.5 : 0)];
      solids.push(knob(tip, 0.55, CLAW));
    }
  }

  // --- The kilt: strips of hide hanging from the belt to mid-thigh, ragged at the hem.
  const kilt = (h: Hit): Tones => {
    const strip = Math.floor((Math.atan2(h.x, h.z) + Math.PI) * 4);
    const base = strip % 3 === 0 ? [look.kilt[1], darker(look.kilt[1]), look.kilt[0]] as Tones : look.kilt;
    return speck(h, 0.9) < 0.1 ? [look.kilt[2], look.kilt[0], look.kilt[2]] : base;
  };
  for (let y = 7; y <= 11; y += 0.5) {
    const t = (11 - y) / 4;
    solids.push({ cx: 0, cy: y - b * 0.5, cz: 0.4 + s * 0.3 * t, rx: (4.4 + t * 0.8) * w, ry: 0.8, rz: (3.8 + t * 0.6) * w, material: kilt });
  }
  // Tatters hanging lower in places.
  for (const [x, z, len] of [[-2.6, 3.2, 2.2], [1.4, 3.8, 1.4], [3.6, 1.4, 2.6], [-3.8, -1.2, 1.8], [0.4, -3.4, 2.4]] as const) {
    solids.push({ cx: x * w, cy: 6.6 - len / 2 - b * 0.4, cz: z * w + s * 0.3, rx: 0.9, ry: len / 2 + 0.4, rz: 0.6, material: look.kilt });
  }
  // A belt, with a pouch and a bone hanging off it.
  const belt: Tones = [P.leatherDark, P.barkDark, P.leather];
  solids.push({ cx: 0, cy: 11.3 - b * 0.6, cz: 0.6, rx: 4.6 * w, ry: 0.8, rz: 4 * w, material: belt });
  solids.push({ cx: 3.8 * w, cy: 9.6 - b * 0.6, cz: 2.2 * w, rx: 1.3, ry: 1.6, rz: 1.1, material: HIDE });

  // --- Body: a round pot belly and a narrow chest, hunched forward over it.
  const vest = look.vest;
  const torso = (h: Hit): Tones => {
    if (vest && (h.y > 13.4 - b || h.nz < 0.35)) {
      const paint = look.vestPaint ? look.vestPaint(h, vest) : vest;
      // An open front: the belly shows between the edges.
      if (h.nz > 0.6 && Math.abs(h.nx) < 0.26 && h.y < 17.6 - b) return hide(h);
      return paint;
    }
    return hide(h);
  };
  solids.push({ cx: 0, cy: 13.2 - b * 0.8, cz: 1.4 + hunch * 0.2, rx: 4.4 * w, ry: 3.4, rz: 4 * w, material: torso });
  solids.push({ cx: 0, cy: 16.8 - b, cz: 1.2 + hunch * 0.55, rx: 4.6 * w, ry: 3.2, rz: 3.4 * w, material: torso });
  // A knobbly spine down the hunched back.
  for (let i = 0; i < 4; i++) solids.push(knob([0, 14.6 + i * 1.3 - b, -1.7 * w + hunch * (0.3 + i * 0.1)], 0.7, torso));
  // Hood and cape over the shoulders, ragged to the small of the back.
  if (look.hood) {
    const hood = look.hood;
    for (let y = 10; y <= 19; y += 0.5) {
      const t = (19 - y) / 9;
      const tatter = Math.sin(y * 5.3) > 0.5 ? 0.7 : 0;
      solids.push({ cx: 0, cy: y - b * (1 - t * 0.5), cz: -2 + hunch * 0.4 - t * 1.4 - Math.abs(s) * t, rx: (5.2 + t) * w - tatter, ry: 0.8, rz: 2.2, material: hood });
    }
  }

  // --- Arms: long and wiry, hanging to the knee, big clawed hands.
  const shoulderY = 18.8 - b;
  const sz = 1.4 + hunch;
  let weaponHand: V3 = [0, 0, 0];
  let offHand: V3 = [0, 0, 0];
  for (const side of [-1, 1]) {
    const weapon = side === -1;
    const swing = act === 'rest' && !pose.sit ? -s * side * 1.8 : 0;
    const shoulder: V3 = [side * 4.6 * w, shoulderY, sz];
    let elbow: V3;
    let hand: V3;
    if (weapon) {
      if (act === 'ready') {
        elbow = [side * 7 * w, 17.4 - b, sz + 0.6];
        hand = [side * 6.8 * w, 21.4 - b, sz + 2.8];
      } else if (act === 'strike') {
        elbow = [side * 5.8 * w, 18 - b, sz + 3.4];
        hand = [side * 3.2 * w, 15 - b, sz + 7.4];
      } else if (act === 'hurt') {
        elbow = [side * 7 * w, 15 - b, sz - 1];
        hand = [side * 8.4 * w, 11.6 - b, sz - 1.6];
      } else if (look.weapon === 'spear') {
        elbow = [side * 6.6 * w, 14.6 - b, sz + 0.6];
        hand = [side * 7 * w, 12.6 - b, sz + 2];
      } else {
        elbow = [side * 6.4 * w, 13.6 - b, sz + 0.4 + swing * 0.4];
        hand = [side * 6.8 * w, 8.8 - b, 2 + sz * 0.5 + swing];
      }
    } else if (look.shield) {
      // The shield arm held across the body.
      elbow = [side * 6.4 * w, 14.4 - b, sz + 1.6];
      hand = act === 'hurt' ? [side * 5.4 * w, 15.6 - b, sz + 2.4] : [side * 3.4 * w, 15.2 - b, sz + 4.6];
    } else if (look.torch) {
      // The torch held high, out to the side.
      elbow = [side * 7 * w, 17 - b, sz + 1];
      hand = act === 'hurt' ? [side * 8.6 * w, 15 - b, sz - 0.6] : [side * 7.6 * w, 20.4 - b, sz + 2.4];
    } else if (act === 'rest') {
      elbow = [side * 6.4 * w, 13.6 - b, sz + swing * 0.4];
      hand = [side * 6.8 * w, 8.8 - b, 2 + sz * 0.5 + swing];
    } else {
      // Claws out for balance, the other hand ready to rake.
      elbow = [side * 7 * w, 15.4 - b, sz + 1.6];
      hand = act === 'hurt' ? [side * 8.6 * w, 14 - b, sz - 1.4] : [side * 6.4 * w, 15.6 - b, sz + 5];
    }
    const sleeve = look.armoured ? (h: Hit): Tones => (h.y > shoulderY - 2.6 ? BLACK_IRON : hide(h)) : hide;
    solids.push(knob(shoulder, 2 * w, look.vest && !look.armoured ? torso : hide));
    solids.push(...limb(shoulder, elbow, 1.3 * w, 1.1 * w, sleeve, 0.45));
    const vambrace = look.armoured ? (_h: Hit): Tones => BLACK_IRON : hide;
    solids.push(...limb(elbow, hand, 1.1 * w, 1.2 * w, vambrace, 0.45));
    solids.push({ cx: hand[0], cy: hand[1] - 0.4, cz: hand[2] + 0.4, rx: 1.5 * w, ry: 1.4 * w, rz: 1.6 * w, material: hide });
    // Claws.
    for (const k of [-1, 0, 1]) solids.push(knob([hand[0] + k * 0.8 * w, hand[1] - 1.4 * w, hand[2] + 1.3 * w], 0.4, CLAW));
    if (look.armoured) {
      // Iron pauldrons, layered plates over each shoulder.
      for (let i = 0; i < 3; i++) {
        solids.push({ cx: side * (4.8 + i * 0.6) * w, cy: shoulderY + 1.2 - i * 1.4, cz: sz - 0.2, rx: (2.9 - i * 0.3) * w, ry: 1, rz: (2.9 - i * 0.2) * w, material: i === 0 ? IRON : BLACK_IRON });
      }
      solids.push(knob([side * 5.2 * w, shoulderY + 2.4, sz - 0.2], 0.6, IRON));
    }
    if (weapon) weaponHand = hand;
    else offHand = hand;
  }

  // --- Head: big, jutting forward on the neck.
  const hy = 23.4 - b - (act === 'strike' ? 0.8 : 0) + (act === 'hurt' ? 0.4 : 0);
  const hz = 2.6 + hunch * 1.05;
  solids.push(...limb([0, 19.6 - b, sz - 0.4], [0, hy - 1.6, hz - 0.8], 1.9 * w, 1.8 * w, hide, 0.5));
  const k = Math.sqrt(w);
  const face = (h: Hit): Tones => {
    const py = h.y - hy;
    if (look.paint && h.nz > 0.25 && Math.abs(py - 0.6) < 0.7 && Math.abs(h.nx) > 0.12) return look.paint;
    if (look.hair && !look.topknot && (py > 3 || (h.nz < -0.4 && py > 0))) return speck(h, 0.7) < 0.55 ? look.hair : hide(h);
    return hide(h);
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 4.8 * k, ry: 4.2 * k, rz: 4.4 * k, material: face, soft: true });
  // The skull bulges at the back.
  solids.push({ cx: 0, cy: hy + 1, cz: hz - 1.6, rx: 3.8 * k, ry: 3.6 * k, rz: 3.2 * k, material: face, soft: true });
  // A heavy brow over sunken eyes.
  const brow: Tones = [skin[1], darker(skin[1]), skin[0]];
  solids.push({ cx: 0, cy: hy + 1.5, cz: hz + 3.2 * k, rx: 3.5 * k, ry: 0.9, rz: 1.3, material: brow, soft: true });
  // A wide lower jaw, jutting under the upper lip, with tusks.
  solids.push({ cx: 0, cy: hy - 2.4 * k, cz: hz + 1.6 * k, rx: 3.6 * k, ry: 1.9, rz: 3 * k, material: hide, soft: true });
  for (const side of [-1, 1]) {
    solids.push({ cx: side * 1.7 * k, cy: hy - 1.3 * k, cz: hz + 4.1 * k, rx: 0.45, ry: 1 * k, rz: 0.45, material: TOOTH, soft: true });
  }
  // The long hooked nose.
  solids.push(...chain([[0, hy + 0.8, hz + 3.6 * k], [0, hy - 0.2, hz + 5.6 * k], [0, hy - 1.4, hz + 6.4 * k]], [1.1 * k, 0.9 * k, 0.6 * k], hide, 0.35).map((x) => ({ ...x, soft: true })));
  // Ears: great leathery sails sweeping out and back, pinker inside.
  const inner: Tones = [0xb0786a, 0x86564c, 0xc89486];
  for (const side of [-1, 1]) {
    const flick = act === 'hurt' ? -1.4 : act === 'strike' ? -0.6 : 0;
    const from: V3 = [side * 3.6 * k, hy + 0.6, hz - 0.6];
    const to: V3 = [side * 11.4 * k, hy + 4.2 + flick, hz - 3.8];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const r = 2.4 * (1 - t) ** 1.3 + 0.3;
      solids.push({
        cx: from[0] + (to[0] - from[0]) * t,
        cy: from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * 0.6,
        cz: from[2] + (to[2] - from[2]) * t,
        rx: r * 0.9,
        ry: r,
        rz: 0.55,
        material: (h: Hit) => (h.nz > 0.35 && t > 0.15 && t < 0.85 ? inner : hide(h)),
        soft: true,
      });
    }
    // A notch bitten out of one ear, and a brass ring through the other.
    if (side === 1) details.push({ x: side * 7.6 * k, y: hy + 1.2, z: hz - 2.6, color: P.gold });
  }
  // A topknot of black hair, tied with a cord.
  if (look.hair && look.topknot) {
    solids.push(knob([0, hy + 4.2 * k, hz - 1.4], 1.3, look.hair));
    solids.push(...chain([[0, hy + 5, hz - 1.6], [0, hy + 6, hz - 3.4], [0, hy + 4.6, hz - 5.4]], [1.2, 1, 0.6], look.hair, 0.4));
  }
  if (look.cap === 'leather') {
    const cap: Tones = [P.leatherDark, P.barkDark, P.leather];
    solids.push({ cx: 0, cy: hy + 2.2 * k, cz: hz - 0.8, rx: 4.4 * k, ry: 2.6 * k, rz: 4.2 * k, material: (h) => (Math.abs(h.x) < 0.6 ? belt : cap) });
  }
  if (look.cap === 'helm') {
    // A dented iron helm with a nose guard, cheek plates, and two curling horns.
    const helm = (h: Hit): Tones => (speck(h, 1.8) < 0.15 ? RUST : Math.abs(h.y - (hy + 1.2)) < 0.5 ? IRON : BLACK_IRON);
    solids.push({ cx: 0, cy: hy + 2.9 * k, cz: hz - 0.8, rx: 4.9 * k, ry: 3.2 * k, rz: 4.8 * k, material: helm });
    solids.push({ cx: 0, cy: hy + 2, cz: hz - 0.8, rx: 5.1 * k, ry: 0.7, rz: 5 * k, material: IRON });
    solids.push({ cx: 0, cy: hy + 0.4, cz: hz + 4.1 * k, rx: 0.7, ry: 1.8, rz: 0.6, material: IRON });
    for (const side of [-1, 1]) {
      solids.push({ cx: side * 3.6 * k, cy: hy - 1, cz: hz + 1.6, rx: 1.1, ry: 2.4, rz: 2.2, material: BLACK_IRON });
      const base: V3 = [side * 3.6 * k, hy + 3.6 * k, hz - 0.6];
      solids.push(...chain(
        [base, [base[0] + side * 2.6, base[1] + 2.2, base[2] - 0.6], [base[0] + side * 3.6, base[1] + 5, base[2] + 0.4], [base[0] + side * 3, base[1] + 7, base[2] + 1.6]],
        [1.3, 1, 0.7, 0.35],
        BONE,
        0.35,
      ));
    }
    for (const x of [-2.6, 0, 2.6]) details.push({ x: x * k, y: hy + 1.2, z: hz + 4.4 * k, color: IRON[2] });
  }
  // A necklace of teeth and finger bones.
  if (look.bones) {
    for (let i = 0; i <= 8; i++) {
      const a = -1.1 + (i / 8) * 2.2;
      solids.push(knob([Math.sin(a) * 3.4 * w, 19.4 - b - Math.cos(a) * 1.2, sz + Math.cos(a) * 2.6], i % 2 ? 0.5 : 0.7, BONE));
    }
  }

  // Eyes: little points of yellow under the brow, squeezed shut when hurt.
  const shut = act === 'hurt';
  for (const side of [-1, 1]) {
    // A dark, sunken socket round each eye, so the glint stands out against the green.
    details.push({ x: side * 2.7 * k, y: hy + 0.6, z: hz + 3.5 * k, color: darker(darker(skin[1])) });
    details.push({ x: side * 1.7 * k, y: hy + 1.6, z: hz + 3.8 * k, color: darker(darker(skin[1])) });
    details.push({ x: side * 1.7 * k, y: hy + 0.6, z: hz + 3.9 * k, color: shut ? darker(skin[1]) : look.eye });
    if (!shut) details.push({ x: side * 2.2 * k, y: hy + 0.6, z: hz + 3.8 * k, color: look.eye });
  }
  // A grim slash of a mouth between the tusks.
  details.push({ x: -0.8 * k, y: hy - 1.6 * k, z: hz + 3.9 * k, color: 0x2a1a14 });
  details.push({ x: 0.6 * k, y: hy - 1.6 * k, z: hz + 3.9 * k, color: 0x2a1a14 });

  // --- What it carries.
  solids.push(...weaponSolids(look.weapon, weaponHand, act, b, look));
  if (look.torch) solids.push(...torchSolids(offHand, act));
  if (look.shield) solids.push(...shieldSolids(offHand, act, w));
  return { solids, details };
}

/** The weapon in the right hand. */
function weaponSolids(weapon: Weapon, h: V3, act: Act, b: number, look: GoblinLook): Solid[] {
  const [x, y, z] = h;
  const w = look.bulk ?? 1;
  switch (weapon) {
    case 'cleaver': {
      // A notched, rusty butcher's cleaver.
      const tip: V3 =
        act === 'ready' ? [x + 0.4, y + 5.4, z + 0.6]
          : act === 'strike' ? [x + 1.6, y - 1.6, z + 5.2]
            : act === 'hurt' ? [x - 0.4, y - 5, z + 0.4]
              : [x + 0.2, y - 4.4, z + 2.4];
      const out = limb([x, y - 0.3, z + 0.3], [x + (tip[0] - x) * 0.3, y + (tip[1] - y) * 0.3, z + (tip[2] - z) * 0.3], 0.55, 0.55, DARK_WOOD, 0.3);
      const rust = (hh: Hit): Tones => (speck(hh, 0.8) < 0.35 ? RUST : IRON);
      for (let i = 0; i <= 6; i++) {
        const t = 0.3 + (i / 6) * 0.7;
        out.push({ cx: x + (tip[0] - x) * t, cy: y + (tip[1] - y) * t, cz: z + (tip[2] - z) * t, rx: 0.5, ry: 1.7, rz: 1.7, material: rust, soft: true });
      }
      return out;
    }
    case 'spear': {
      // A crude spear: a crooked shaft, a leaf-shaped iron head lashed on, a feather hanging under it.
      const butt: V3 = act === 'strike' ? [x - 0.4, y - 4, z - 6] : act === 'ready' ? [x, y - 7, z - 4] : act === 'hurt' ? [x + 1, 0.6, z + 3] : [x, 0.6, z - 0.4];
      const top: V3 = act === 'strike' ? [x + 1.4, y + 2, z + 16] : act === 'ready' ? [x - 0.4, y + 9, z + 10] : act === 'hurt' ? [x - 2, y + 14, z - 4] : [x, 33 - b, z + 1.4];
      const len = Math.hypot(top[0] - butt[0], top[1] - butt[1], top[2] - butt[2]);
      const dir: V3 = [(top[0] - butt[0]) / len, (top[1] - butt[1]) / len, (top[2] - butt[2]) / len];
      const at = (d: number): V3 => [top[0] + dir[0] * d, top[1] + dir[1] * d, top[2] + dir[2] * d];
      const out: Solid[] = limb(butt, top, 0.5, 0.45, WOOD, 0.4).map((p) => ({ ...p, soft: true }));
      out.push(...[0, 1, 2, 3].map((i) => ({ ...knob(at(0.6 + i * 0.9), 1.1 - i * 0.25, IRON), soft: true })));
      out.push(knob(at(4.4), 0.35, IRON));
      out.push({ ...knob(at(-0.6), 0.75, [P.leatherDark, P.barkDark, P.leather]), soft: true });
      const f = at(-1.6);
      out.push({ cx: f[0] + 0.8, cy: f[1] - 1.8, cz: f[2], rx: 0.4, ry: 1.6, rz: 0.7, material: [0xb8402e, 0x822a1e, 0xd85a42], soft: true });
      return out;
    }
    case 'hatchet': {
      const tip: V3 =
        act === 'ready' ? [x + 0.2, y + 5, z + 0.4]
          : act === 'strike' ? [x + 1.4, y - 1.4, z + 4.8]
            : act === 'hurt' ? [x - 0.4, y - 4.6, z + 0.4]
              : [x + 0.2, y - 4.2, z + 2];
      const out = limb([x, y - 0.3, z + 0.3], tip, 0.5, 0.5, WOOD, 0.3);
      // The head: a wedge of black iron, its edge bright.
      out.push({ cx: tip[0], cy: tip[1], cz: tip[2] + 1, rx: 0.5, ry: 1.4, rz: 1.6, material: (hh) => (hh.z > tip[2] + 1.8 ? IRON : BLACK_IRON), soft: true });
      return out;
    }
    case 'club': {
      // The Brute's club: a great knotted cudgel, studded with nails.
      const end: V3 =
        act === 'ready' ? [x - 0.4, y + 11 * w, z - 3]
          : act === 'strike' ? [x + 2, y - 3, z + 11 * w]
            : act === 'hurt' ? [x - 1, y - 10 * w, z + 1]
              : [x + 0.4, 1.4, z + 3.4];
      const out = limb([x, y - 0.6, z + 0.4], end, 0.8, 2.1, DARK_WOOD, 0.4);
      for (let i = 0; i < 9; i++) {
        const t = 0.5 + (i % 3) * 0.2 + 0.05;
        const a = i * 2.1;
        const c: V3 = [x + (end[0] - x) * t, y + (end[1] - y) * t, z + (end[2] - z) * t];
        const r = 0.8 + t * 1.3;
        out.push(knob([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.4, c[2] + Math.sin(a) * r], 0.45, IRON));
      }
      out.push(knob(end, 2.3, DARK_WOOD));
      return out;
    }
  }
}

/** A burning torch: a stick wrapped in pitch-soaked rag, flames licking up from it. */
function torchSolids(h: V3, act: Act): Solid[] {
  const [x, y, z] = h;
  const top: V3 = act === 'hurt' ? [x - 1.4, y + 4, z - 1.6] : [x + 0.4, y + 5.6, z + 0.8];
  const out = limb([x, y - 2.4, z - 0.2], top, 0.5, 0.6, WOOD, 0.35);
  out.push({ ...knob(top, 1.2, [0x3a2a22, 0x241a14, 0x54402e]) });
  // Flames: a hot core, licks of orange, and a tongue flaring off to one side.
  out.push({ cx: top[0], cy: top[1] + 1.8, cz: top[2], rx: 1.3, ry: 2, rz: 1.3, material: FLAME_CORE, soft: true });
  out.push({ cx: top[0] - 0.4, cy: top[1] + 3.4, cz: top[2] - 0.2, rx: 1, ry: 2.2, rz: 1, material: FLAME, soft: true });
  out.push({ cx: top[0] + 0.8, cy: top[1] + 2.6, cz: top[2] + 0.4, rx: 0.7, ry: 1.6, rz: 0.7, material: FLAME, soft: true });
  out.push({ cx: top[0] - 0.2, cy: top[1] + 5.4, cz: top[2] - 0.4, rx: 0.4, ry: 1, rz: 0.4, material: [P.fireRed, darker(P.fireRed), P.fireOrange], soft: true });
  return out;
}

/** A round shield of rough planks, rimmed and bossed with iron, a red eye daubed on its face. */
function shieldSolids(h: V3, act: Act, w: number): Solid[] {
  const [x, y, z] = h;
  // Held in front of the off side, face forward (or flung wide when hurt).
  const c: V3 = act === 'hurt' ? [x + 2, y - 0.6, z - 0.4] : [x + 1.4 * w, y - 0.8, z + 1.2];
  const r = 6.2 * w;
  const face = (hh: Hit): Tones => {
    const dx = hh.x - c[0];
    const dy = hh.y - c[1];
    const d = Math.hypot(dx, dy);
    if (d > r - 0.9) return IRON;
    // The daubed eye: a red almond with a black slit.
    const ex = dx / (r * 0.62);
    const ey = dy / (r * 0.3);
    if (ex * ex + ey * ey < 1) return Math.abs(dx) < 0.7 && Math.abs(dy) < r * 0.24 ? [0x241a14, 0x140e0a, 0x3a2a22] : [0xa82a1e, 0x781c14, 0xc84434];
    if (Math.floor((dx + r) / 2.2) % 2) return WOOD;
    return [P.barkLight, P.bark, 0xb08458];
  };
  const tilt = act === 'hurt' ? 1.2 : 0.4;
  const out: Solid[] = [{ cx: c[0], cy: c[1], cz: c[2] + tilt, rx: r, ry: r, rz: 0.9, material: face }];
  out.push(knob([c[0], c[1], c[2] + 1.4 + tilt], 1.5 * w, IRON));
  return out;
}

// --- The goblins --------------------------------------------------------------

/** The cutter: olive green, a hide vest and a topknot, and a rusty cleaver. */
export const GOBLIN_CUTTER: GoblinLook = {
  skin: [0x7e9a42, 0x48601f, 0xa8c46a],
  mottle: [0x5e7430, 0x40521e, 0x7a9440],
  kilt: [0x6a5236, 0x4a3824, 0x86684a],
  vest: [0x5a4430, 0x3e2e20, 0x765a40],
  vestPaint: (h, base) => (Math.abs(h.x - h.y * 0.4 + 4) < 0.7 && h.nz > 0 ? [P.leatherDark, P.barkDark, P.leather] : base),
  hair: [0x1e1a1c, 0x100e10, 0x343034],
  topknot: true,
  eye: 0xffd23a,
  weapon: 'cleaver',
};

/** The spearman: mossy grey-green, red war paint, a leather cap, a necklace of bones, and a spear taller than it is. */
export const GOBLIN_SPEAR: GoblinLook = {
  skin: [0x6c8862, 0x3f5238, 0x94b088],
  mottle: [0x52684a, 0x3a4a34, 0x6a8460],
  kilt: [0x5a5a46, 0x3e3e30, 0x76765e],
  paint: [0xb02c22, 0x7e1e18, 0xd04a3c],
  cap: 'leather',
  bones: true,
  eye: 0xf0a020,
  weapon: 'spear',
};

/** The firebrand: sallow yellow-green, a ragged brown hood and cape, a hatchet, and a burning torch. */
export const GOBLIN_TORCH: GoblinLook = {
  skin: [0x9aa44a, 0x5e6626, 0xc2ca74],
  mottle: [0x747c34, 0x525822, 0x96a048],
  kilt: [0x5e4632, 0x423020, 0x7a5c44],
  hood: [0x5a4232, 0x3e2c20, 0x745640],
  hair: [0x3a3028, 0x241c16, 0x52463a],
  eye: 0xff6a2a,
  weapon: 'hatchet',
  torch: true,
  hunch: 2.8,
};

/**
 * The Goblin Brute who leads them: dark, half as big again and twice as broad,
 * in a studded leather coat with scraps of plate on the shoulders, shins and
 * forearms, a horned helm, a round shield with a daubed red eye, and a great
 * nail-studded club.
 */
export const GOBLIN_BRUTE: GoblinLook = {
  skin: [0x56703c, 0x2e3e1e, 0x7a9658],
  mottle: [0x40522c, 0x2c3a1c, 0x52683a],
  kilt: [0x3e3430, 0x2a2220, 0x564a44],
  vest: [0x4a3a2e, 0x32261e, 0x645040],
  // Studs on the coat, and mail showing at its edges.
  vestPaint: (h, base) => {
    if (speck(h, 1.6) < 0.12) return IRON;
    if (h.y < 14.6 || Math.abs(h.nx) > 0.82) return (Math.floor(h.x * 1.6) + Math.floor(h.y * 1.6)) % 2 ? IRON : BLACK_IRON;
    return base;
  },
  cap: 'helm',
  armoured: true,
  bones: true,
  eye: 0xff3a1e,
  weapon: 'club',
  shield: true,
  bulk: 1.35,
  hunch: 1.6,
};

export type GoblinKind = 'goblin' | 'goblinspear' | 'goblintorch' | 'goblinbrute';

export const GOBLIN_LOOKS: Record<GoblinKind, GoblinLook> = {
  goblin: GOBLIN_CUTTER,
  goblinspear: GOBLIN_SPEAR,
  goblintorch: GOBLIN_TORCH,
  goblinbrute: GOBLIN_BRUTE,
};

/** How much bigger than a common goblin the Brute is drawn. */
export const BRUTE_SIZE = 1.3;

/** A goblin's frame: wide enough to fit it lying down. */
export function goblinSpec(kind: GoblinKind): FrameSpec {
  return kind === 'goblinbrute' ? { w: 64, h: 64, feetY: 58, groundShade: 5, creases: true } : { w: 48, h: 48, feetY: 43, groundShade: 4, creases: true };
}

/** Every solid and detail scaled up about the feet. */
function grown(m: Model, k: number): Model {
  if (k === 1) return m;
  const mat = (mm: Material): Material => (typeof mm === 'function' ? (h: Hit) => mm({ ...h, x: h.x / k, y: h.y / k, z: h.z / k }) : mm);
  return {
    solids: m.solids.map((s) => ({ ...s, cx: s.cx * k, cy: s.cy * k, cz: s.cz * k, rx: s.rx * k, ry: s.ry * k, rz: s.rz * k, material: mat(s.material) })),
    details: m.details.map((d) => ({ ...d, x: d.x * k, y: d.y * k, z: d.z * k })),
  };
}

/** Beast frame order (see beasts3d.ts): 0-1 stand, 2-5 walk, 6-7 look about, 8 square up, 9 swing, 10 flinch, 11 down. */
export function goblinSheet(kind: GoblinKind): BeastSheet {
  const look = GOBLIN_LOOKS[kind];
  const k = kind === 'goblinbrute' ? BRUTE_SIZE : 1;
  const walk: Pose3D[] = [
    { stride: 1, bob: 0.7 },
    { stride: 0, bob: 0 },
    { stride: -1, bob: 0.7 },
    { stride: 0, bob: 0 },
  ];
  const at = (p: Pose3D, act?: Act) => grown(goblinModel(p, look, act), k);
  const models: Model[] = [
    at({ stride: 0, bob: 0 }),
    at({ stride: 0, bob: 0.6 }),
    ...walk.map((p) => at(p)),
    // Looking about: crouched lower, weapon ready, sniffing the air.
    at({ stride: 0.3, bob: 1.2 }, 'ready'),
    at({ stride: 0.3, bob: 1.6 }, 'ready'),
    at({ stride: 0, bob: 0.4 }, 'ready'),
    at({ stride: 0, bob: 0.6 }, 'strike'),
    at({ stride: 0, bob: 0.8 }, 'hurt'),
    // Sprawled on its back.
    grown(onItsSide(goblinModel({ stride: 0, bob: 0 }, look, 'hurt'), 14, 4.4), k),
  ];
  return { spec: goblinSpec(kind), models };
}

/** The goblins' fighting sheets ('creature-<kind>'). */
export function generateGoblins(scene: Phaser.Scene): void {
  generateBeast(scene, 'goblin', goblinSheet('goblin'), 10);
  generateBeast(scene, 'goblinspear', goblinSheet('goblinspear'), 9);
  generateBeast(scene, 'goblintorch', goblinSheet('goblintorch'), 10);
  generateBeast(scene, 'goblinbrute', goblinSheet('goblinbrute'), 7);
}
