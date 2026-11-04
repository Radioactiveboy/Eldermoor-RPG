import Phaser from 'phaser';
import { darker, type Tones } from './character';
import { BEAST_FRAME, BeastPose, BeastSheet, chain, generateBeast, onItsSide, speck, V3 } from './beasts3d';
import { Detail, FrameSpec, generateFigure3D, Hit, limb, Model, Pose3D, Solid } from './figure3d';
import { asChild } from './models3d';
import { PALETTE as P } from './palette';

/**
 * The folk met by chance out on Adowvale Plains (see world/PlainsEvents.ts),
 * modelled in 3D like everyone else (see figure3d.ts): two footpads, a
 * travelling tinker, a goatherd girl and a lamed messenger, and Clover, the
 * goatherd's runaway nanny goat. The footpads are drawn twice: once as folk
 * (to talk to) and once as foes, on a beast's sheet of frames (see
 * beasts3d.ts), so they can square up, swing, flinch and fall in a fight.
 */

/** What a wayfarer's right hand (screen-left, facing us) is doing. */
type Act = 'rest' | 'ready' | 'strike' | 'hurt';

interface WayfarerLook {
  coat: Tones;
  /** Paint the coat (a tabard, an apron, patches). */
  coatPaint?: (h: Hit, base: Tones) => Tones;
  sleeves?: Tones;
  legs: Tones;
  boots: Tones;
  skin: Tones;
  hair: Tones;
  beard?: Tones;
  stubble?: Tones;
  /** No hair on top: a bald crown. */
  bald?: boolean;
  /** The coat to the knee rather than the hip, or a skirt to the ankle. */
  hem?: 'hip' | 'knee' | 'ankle';
  /** Wider through the body. */
  stout?: boolean;
  /** A hood drawn up round the face. */
  hood?: Tones;
  /** A kerchief tied over the nose and mouth. */
  mask?: Tones;
  /** What's in the right hand. */
  weapon?: 'cudgel' | 'knife' | 'crook' | 'crutch';
  /** Leave what's in the hand to be added later (to a child, after shrinking). */
  bare?: boolean;
  /** Anything else: hats, packs, bandages. */
  extras?: (hy: number, hz: number, b: number, s: number) => Solid[];
}

const WOOD: Tones = [P.bark, P.barkDark, P.barkLight];
const STEEL: Tones = [0xb8bcc8, 0x7a7e8a, 0xe8ecf4];
const LINEN: Tones = [P.linen, P.linenDark, 0xfff4e0];

/**
 * A wayfarer: boots and breeches, a coat (or a skirt) belted at the waist, a
 * round head with the hair, beard or hood on it, and something in the right
 * hand. `act` sets the right arm (and how the body leans) for a fight.
 */
function wayfarerModel(pose: Pose3D, look: WayfarerLook, act: Act = 'rest'): Model {
  const { coat, legs, boots, skin, hair } = look;
  const sleeves = look.sleeves ?? coat;
  const b = pose.bob;
  // Squared up for a fight: feet apart, one ahead of the other.
  const s = act === 'ready' || act === 'strike' ? 0.7 : act === 'hurt' ? -0.5 : pose.stride;
  const lean = act === 'strike' ? 1.8 : act === 'hurt' ? -1.6 : act === 'ready' ? 0.6 : 0.3;
  const wide = look.stout ? 0.6 : 0;
  const paint = (h: Hit): Tones => (look.coatPaint ? look.coatPaint(h, coat) : coat);
  const belt: Tones = [P.leatherDark, P.barkDark, P.leather];
  const solids: Solid[] = [];

  if (pose.sit) {
    for (const side of [-1, 1]) {
      const x = side * 2.3;
      solids.push(...limb([x, 10, -0.5], [x, 10.4, 5], 1.9, 1.8, legs));
      solids.push(...limb([x, 10, 5.4], [x, 3.4, 5.8], 1.7, 1.5, legs));
      solids.push({ cx: x, cy: 1.3, cz: 6.6, rx: 1.7, ry: 1.4, rz: 2.6, material: boots });
    }
  } else {
    for (const side of [-1, 1]) {
      const swing = s * side;
      const lift = swing < 0 && act === 'rest' ? 0.9 : 0;
      solids.push(...limb([side * 2.3, 12.5 - b * 0.5, 0], [side * 2.3, 3.6 + lift, swing * 2.4], 2, 1.7, legs));
      solids.push({ cx: side * 2.3, cy: 1.3 + lift, cz: 0.8 + swing * 2.4, rx: 1.8, ry: 1.4, rz: 2.7, material: boots });
    }
  }
  // The coat's skirt, or the dress to the ankle.
  const hemY = look.hem === 'ankle' ? 2.5 : look.hem === 'knee' ? 8 : 12;
  for (let y = pose.sit ? 99 : hemY; y <= 15; y += 0.5) {
    const t = (15 - y) / 12.5;
    const flare = look.hem === 'ankle' ? t * 1.6 : (15 - y) * 0.1;
    solids.push({ cx: 0, cy: y - b * (1 - t), cz: s * 0.35 * t + lean * 0.1, rx: 5 + wide + flare, ry: 0.8, rz: 3.9 + wide * 0.6 + flare * 0.6, material: paint });
  }
  if (pose.sit && look.hem !== 'hip') solids.push({ cx: 0, cy: 10.6, cz: 2.6, rx: 5, ry: 1.4, rz: 4.4, material: paint });

  // Body: belted at the waist.
  const body = (h: Hit): Tones => (Math.abs(h.y - (16 - b)) < 0.6 ? belt : paint(h));
  solids.push({ cx: 0, cy: 15 - b * 0.6, cz: lean * 0.2, rx: 4.9 + wide, ry: 2.8, rz: 3.8 + wide * 0.6, material: body });
  solids.push({ cx: 0, cy: 18.2 - b, cz: lean * 0.45, rx: 5 + wide, ry: 3.4, rz: 3.9 + wide * 0.7, material: body });
  solids.push({ cx: 0, cy: 22.2 - b, cz: lean * 0.8, rx: 5.4 + wide * 0.5, ry: 4.6, rz: 3.9 + wide * 0.4, material: body });

  // Arms: the left swings as they walk (or comes up for balance in a fight); the right holds what they carry.
  for (const side of [-1, 1]) {
    const right = side === -1;
    const swing = act === 'rest' && !pose.sit ? -s * side * 2 : 0;
    const sh: [number, number, number] = [side * 5.4, 24 - b, lean];
    solids.push({ cx: side * 4.9, cy: 24.6 - b, cz: lean, rx: 2.4, ry: 2.2, rz: 2.4, material: sleeves });
    let elbow: [number, number, number];
    let hand: [number, number, number];
    if (pose.sit) {
      elbow = [side * 5.6, 19.4 - b, 2];
      hand = [side * 3.6, 12, 4.8];
    } else if (!right) {
      elbow = act === 'rest' ? [side * 6, 20.2 - b, lean + swing * 0.5] : [side * 6.4, 20.4 - b, lean + 1.6];
      hand = act === 'rest' ? [side * 6.2, 16.6 - b, 1 + lean + swing] : act === 'hurt' ? [side * 7.6, 18.6 - b, lean - 1] : [side * 5.4, 18.6 - b, lean + 4.2];
    } else if (act === 'ready') {
      elbow = [side * 6.8, 22.4 - b, lean + 1.4];
      hand = [side * 6.6, 25.6 - b, lean + 3.6];
    } else if (act === 'strike') {
      elbow = [side * 5.6, 22.6 - b, lean + 3.4];
      hand = [side * 3.6, 21 - b, lean + 7.2];
    } else if (act === 'hurt') {
      elbow = [side * 6.8, 20.4 - b, lean - 0.6];
      hand = [side * 8, 17.4 - b, lean - 1.2];
    } else if (look.weapon === 'crook' || look.weapon === 'crutch') {
      elbow = [side * 6.6, 20.4 - b, lean + 0.8];
      hand = [side * 7.2, 19.2 - b, lean + 2];
    } else {
      elbow = [side * 6, 20.2 - b, lean + swing * 0.5];
      hand = [side * 6.2, 16.6 - b, 1 + lean + swing];
    }
    solids.push(...limb(sh, elbow, 1.8, 1.6, sleeves));
    solids.push(...limb(elbow, hand, 1.6, 1.5, sleeves));
    solids.push({ cx: hand[0], cy: hand[1] - 0.6, cz: hand[2] + 0.4, rx: 1.5, ry: 1.5, rz: 1.6, material: skin });
    if (right && look.weapon && !look.bare) solids.push(...held(look.weapon, hand, act, b, s));
  }

  // Head.
  const hy = 31.8 - b - (act === 'strike' ? 0.6 : 0);
  const hz = 0.4 + lean * 1.1;
  solids.push({ cx: 0, cy: 27 - b, cz: hz * 0.6, rx: 2.1, ry: 2, rz: 2.1, material: skin });
  const { beard, stubble } = look;
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    const jaw = h.nz > -0.35 && (py < -1.6 || (py < 0 && Math.abs(h.nx) > 0.6));
    if (beard && jaw) return beard;
    if (stubble && jaw) return speck(h, 1) < 0.5 ? stubble : skin;
    if (look.bald) return py < 1 && (h.nz < -0.2 || Math.abs(h.nx) > 0.75) ? hair : skin;
    if (h.nz < -0.2 || Math.abs(h.nx) > 0.7 || py > 2.4) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 5.4, ry: 5.8, rz: 5.2, material: head, soft: true });
  if (beard) solids.push({ cx: 0, cy: hy - 4.6, cz: hz + 2.6, rx: 3.2, ry: 2.4, rz: 2, material: beard });
  solids.push({ cx: 0, cy: hy + 0.2, cz: hz + 5.2, rx: 1.1, ry: 1.2, rz: 1, material: skin });
  if (look.mask) {
    // A kerchief over the nose and mouth, knotted at the back of the head.
    solids.push({ cx: 0, cy: hy - 2.2, cz: hz + 2, rx: 5.5, ry: 2.9, rz: 4, material: look.mask });
    solids.push({ cx: 0, cy: hy - 0.6, cz: hz - 5.2, rx: 1.4, ry: 1.2, rz: 1, material: look.mask });
  }
  if (look.hood) {
    const hood = look.hood;
    solids.push({ cx: 0, cy: hy + 0.8, cz: hz - 1.8, rx: 6.4, ry: 6.6, rz: 5.4, material: hood });
    solids.push({ cx: 0, cy: hy + 5.6, cz: hz - 4.2, rx: 2, ry: 2.2, rz: 2, material: hood });
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI * 0.62 + (i / 12) * Math.PI * 1.24;
      solids.push({ cx: Math.sin(a) * 4.8, cy: hy + 0.2 + Math.cos(a) * 5, cz: hz + 3, rx: 1.8, ry: 1.8, rz: 2, material: hood });
    }
    solids.push({ cx: 0, cy: hy + 2.4, cz: hz + 3.9, rx: 3.6, ry: 1.2, rz: 1, material: [hood[1], darker(hood[1]), hood[1]] });
    // The hood's cape over the shoulders.
    solids.push({ cx: 0, cy: 25.2 - b, cz: lean - 0.4, rx: 6.4, ry: 2.4, rz: 4.6, material: hood });
  }
  if (look.extras) solids.push(...look.extras(hy, hz, b, s));

  const details: Detail[] = [];
  const shut = act === 'hurt';
  for (const side of [-1, 1]) details.push({ x: side * 2, y: hy + (shut ? 0.6 : 0.9), z: hz + 5, color: P.eye });
  return { solids, details };
}

/** What's in a wayfarer's right hand, from the hand at `h`. */
function held(weapon: NonNullable<WayfarerLook['weapon']>, h: [number, number, number], act: Act, b: number, s: number): Solid[] {
  const [x, y, z] = h;
  const knob = (p: [number, number, number], r: number, m: Tones): Solid => ({ cx: p[0], cy: p[1], cz: p[2], rx: r, ry: r, rz: r, material: m });
  switch (weapon) {
    case 'cudgel': {
      // A knotty club, fattening to the end.
      const end: [number, number, number] =
        act === 'ready' ? [x - 0.6, y + 8, z - 2.4]
          : act === 'strike' ? [x + 1.6, y - 2.4, z + 7.4]
            : act === 'hurt' ? [x - 0.8, y - 7.6, z + 1]
              : [x - 0.2, y - 6.4, z + 2.8];
      const club = limb([x, y - 0.6, z + 0.4], end, 0.7, 1.4, WOOD, 0.4);
      return [...club, knob(end, 1.6, [P.barkLight, P.bark, 0x9a6a44])];
    }
    case 'knife': {
      const tip: [number, number, number] =
        act === 'ready' ? [x + 0.6, y + 3.4, z + 2.6]
          : act === 'strike' ? [x + 1.4, y + 0.2, z + 4.4]
            : act === 'hurt' ? [x - 0.4, y - 4, z + 0.6]
              : [x + 0.2, y - 1, z + 4.2];
      return limb([x, y - 0.4, z + 0.8], tip, 0.55, 0.3, STEEL, 0.3).map((p) => ({ ...p, soft: true }));
    }
    case 'crook': {
      // A shepherd's crook, planted on the ground, its hook curling at the top.
      const top = 34 - b;
      const pole = limb([x, 0.4, z - s * 0.6], [x, top, z], 0.5, 0.5, WOOD, 0.4).map((p) => ({ ...p, soft: true }));
      for (let i = 1; i <= 6; i++) {
        const a = (i / 6) * Math.PI;
        pole.push({ cx: x, cy: top + Math.sin(a) * 1.8, cz: z + 1.8 - Math.cos(a) * 1.8, rx: 0.55, ry: 0.55, rz: 0.55, material: WOOD, soft: true });
      }
      return pole;
    }
    case 'crutch':
      // A stout stick to lean on.
      return limb([x - 0.4, 0.4, z + 1.4], [x, y + 2, z], 0.7, 0.7, WOOD, 0.4).map((p) => ({ ...p, soft: true }));
  }
}

// --- The footpads ------------------------------------------------------------

/** Rook, the footpad who does the talking: lanky, a dark hood and a patched brown coat, stubble, and a cudgel on his shoulder. */
export const ROOK: WayfarerLook = {
  coat: [0x5a4a3a, 0x3e3226, 0x766450],
  coatPaint: (h, base) => (Math.abs(h.x + 2.4) < 1.2 && Math.abs(h.y - 19) < 1.2 && h.z > 2 ? [0x6a5a3a, 0x4a3e28, 0x86764e] : base),
  sleeves: [0x4a3e30, 0x322a20, 0x645440],
  legs: [0x3a3438, 0x26222a, 0x4e484e],
  boots: [P.barkDark, P.ink, P.bark],
  skin: [0xd8a888, 0xae8064, 0xeac0a0],
  hair: [0x2a2224, 0x1a1418, 0x3e3436],
  stubble: [0x4a3e3a, 0x342a28, 0x5e5250],
  hem: 'knee',
  hood: [0x3a3a44, 0x26262e, 0x52525e],
  weapon: 'cudgel',
};

/** Nab, his partner: short and thickset, bald, a red kerchief over his face, a knife held low. */
export const NAB: WayfarerLook = {
  coat: [0x6a5a3e, 0x4a3e2a, 0x847452],
  sleeves: [P.linen, P.linenDark, 0xfff4e0],
  legs: [0x4e4234, 0x342a20, 0x645440],
  boots: [P.leatherDark, P.barkDark, P.leather],
  skin: [0xe0a07c, 0xb4785a, 0xf2ba96],
  hair: [0x5a4232, 0x3e2e22, 0x725640],
  bald: true,
  stout: true,
  mask: [0xa83a32, 0x7a2622, 0xc85a4a],
  weapon: 'knife',
  // A jerkin over his shirt, laced at the front.
  coatPaint: (h, base) => (h.nz > 0.6 && Math.abs(h.nx) < 0.18 && h.y > 17 && h.y < 25 ? [P.leatherDark, P.barkDark, P.leather] : base),
};

export const rookModel = (pose: Pose3D): Model => wayfarerModel(pose, ROOK);
export const nabModel = (pose: Pose3D): Model => wayfarerModel(pose, NAB);

// --- Jory the tinker -----------------------------------------------------------

/**
 * Jory the tinker: a leather apron over a green smock, a battered felt hat,
 * a ginger beard, and a wooden frame on his back hung with pots, pans and a
 * kettle that clank as he walks.
 */
export function tinkerModel(pose: Pose3D): Model {
  const apron: Tones = [P.leather, P.leatherDark, P.leatherLight];
  const felt: Tones = [0x4a4038, 0x342c26, 0x625448];
  const copper: Tones = [0xc07a42, 0x8a5430, 0xe0a060];
  const tin: Tones = [0x9a9aa4, 0x6a6a74, 0xc8c8d2];
  const sooty: Tones = [0x3a3a42, 0x26262c, 0x52525a];
  return wayfarerModel(pose, {
    coat: [0x5a6a3a, 0x42502a, 0x748650],
    coatPaint: (h, base) => (h.nz > 0.2 && Math.abs(h.nx) < 0.7 && h.y < 23 ? apron : base),
    legs: [0x5a4634, 0x3a2c22, 0x70583f],
    boots: [P.leatherDark, P.barkDark, P.leather],
    skin: [0xecb894, 0xc48e70, 0xfcd2b0],
    hair: [0xb4582a, 0x84401e, 0xd0743c],
    beard: [0xb4582a, 0x84401e, 0xd0743c],
    hem: 'hip',
    stout: true,
    extras: (hy, hz, b, s) => {
      const out: Solid[] = [];
      // The frame on his back: two uprights and two cross bars.
      for (const side of [-1, 1]) out.push(...limb([side * 3.6, 8 - b, -5.6], [side * 3.6, 33 - b, -5.6], 0.6, 0.6, WOOD, 0.4));
      for (const y of [16, 30]) out.push(...limb([-4.2, y - b, -5.6], [4.2, y - b, -5.6], 0.55, 0.55, WOOD, 0.4));
      // A bundle of sacking lashed to it.
      out.push({ cx: 0, cy: 23 - b, cz: -6.6, rx: 3.8, ry: 5.4, rz: 2, material: [0xa08a62, 0x786642, 0xbca67c] });
      // Pots and pans hanging off it, swinging a little as he walks.
      const sway = s * 0.6;
      out.push({ cx: -4.8, cy: 18 - b, cz: -6.6 + sway, rx: 0.6, ry: 2.6, rz: 2.6, material: sooty });
      out.push({ cx: 5, cy: 21 - b, cz: -6.4 - sway, rx: 2, ry: 2, rz: 2, material: copper });
      out.push({ cx: 5, cy: 23.2 - b, cz: -6.4 - sway, rx: 1.2, ry: 0.5, rz: 1.2, material: copper });
      out.push({ cx: 0, cy: 34.2 - b, cz: -6.2, rx: 2.4, ry: 1.8, rz: 2.2, material: tin });
      out.push(...limb([2.2, 34.4 - b, -6.2], [3.6, 35.4 - b, -6.2], 0.5, 0.35, tin, 0.3));
      out.push({ cx: -3, cy: 11 - b, cz: -6.2 - sway, rx: 1.6, ry: 1.8, rz: 1.6, material: tin });
      // Straps over the shoulders.
      for (const side of [-1, 1]) out.push(...limb([side * 3, 26 - b, -2.4], [side * 3.4, 25.4 - b, 3], 0.7, 0.7, apron));
      // A battered felt hat with a floppy brim.
      out.push({ cx: 0, cy: hy + 4, cz: hz - 0.2, rx: 7.6, ry: 0.9, rz: 7.2, material: felt });
      out.push({ cx: 0, cy: hy + 5.4, cz: hz - 0.4, rx: 5.2, ry: 3.4, rz: 5, material: felt });
      // A hammer through his belt.
      out.push(...limb([4.6, 17.6 - b, 2], [4.8, 12 - b, 3.4], 0.5, 0.5, WOOD, 0.4));
      out.push({ cx: 4.8, cy: 18 - b, cz: 2, rx: 1.4, ry: 0.8, rz: 0.8, material: tin });
      return out;
    },
  });
}

// --- Mags the goatherd --------------------------------------------------------

/** Mags, a goatherd girl: a russet dress, a straw hat over her plaits, and a crook taller than she is. */
export function goatherdModel(pose: Pose3D): Model {
  const straw: Tones = [0xd8b868, 0xa88a44, 0xf0d488];
  const hair: Tones = [0x6a4428, 0x4a2e1a, 0x86583a];
  const dress: Tones = [0x9a4a32, 0x6e3222, 0xb6664a];
  const child = asChild(wayfarerModel(pose, {
    coat: dress,
    sleeves: LINEN,
    legs: dress,
    boots: [P.leather, P.leatherDark, P.leatherLight],
    skin: [0xecc0a0, 0xc49a7c, 0xfcd8ba],
    hair,
    hem: 'ankle',
    weapon: 'crook',
    bare: true,
    extras: (hy, hz) => [
      // Two plaits down her back, and a wide straw hat.
      ...[-1, 1].flatMap((side) => limb([side * 3.6, hy - 1, hz - 4], [side * 3.4, hy - 9, hz - 4.6], 1.3, 0.9, hair, 0.4)),
      { cx: 0, cy: hy + 4.2, cz: hz - 0.2, rx: 8.4, ry: 0.8, rz: 8, material: straw },
      { cx: 0, cy: hy + 5.6, cz: hz - 0.4, rx: 4.8, ry: 2.8, rz: 4.6, material: (h: Hit) => (Math.abs(h.y - (hy + 5)) < 0.5 ? [0x5a7a9a, 0x42607e, 0x7a9ab6] : straw) },
    ],
  }));
  // Her crook, in her right hand (where asChild put it), taller than she is.
  const hand: [number, number, number] = [-7.2 * 0.84, (19.2 - pose.bob) * 0.68 - 0.6, 2.3 * 0.84 + 0.4];
  if (!pose.sit) child.solids.push(...held('crook', hand, 'rest', pose.bob, pose.stride * 0.84));
  return child;
}

// --- Hal the messenger ---------------------------------------------------------

/**
 * Hal, a messenger in Lord Morten's colours: a blue tabard with a gold stripe
 * over a white shirt, a dispatch satchel at his hip, his right shin bound in
 * linen, leaning on a stick.
 */
export function courierModel(pose: Pose3D): Model {
  const blue: Tones = [0x2e4a7a, 0x20345a, 0x42629a];
  const gold: Tones = [P.gold, 0xb08830, P.goldLight];
  return wayfarerModel(pose, {
    coat: blue,
    coatPaint: (h, base) => (Math.abs(h.x) < 0.9 && h.nz > 0.3 ? gold : base),
    sleeves: LINEN,
    legs: [0x3a3440, 0x28222e, 0x504856],
    boots: [P.leather, P.leatherDark, P.leatherLight],
    skin: [0xe6b896, 0xc29474, 0xf6d0b0],
    hair: [0x8a6a3a, 0x644a28, 0xa8844c],
    hem: 'knee',
    weapon: 'crutch',
    extras: (hy, hz, b, s) => [
      // The bandage round his right shin.
      ...limb([-2.3, 9 - b * 0.5, s * -0.8], [-2.3, 4.6, s * -1.8], 2.3, 2.1, LINEN, 0.5),
      // The satchel on its strap across his chest, sealed letters inside.
      { cx: 5.6, cy: 14 - b, cz: 0.4, rx: 1.6, ry: 2.8, rz: 2.8, material: [P.leather, P.leatherDark, P.leatherLight] },
      ...limb([-4.2, 25 - b, 3.6], [4.8, 16 - b, 3.4], 0.6, 0.6, [P.leatherDark, P.barkDark, P.leather], 0.5),
      // A round cap with a short feather.
      { cx: 0, cy: hy + 4.4, cz: hz - 0.4, rx: 5.8, ry: 2.6, rz: 5.6, material: blue },
      ...limb([3.8, hy + 5, hz - 2.4], [5.4, hy + 8.6, hz - 4.4], 0.6, 0.3, [0xf0ece0, 0xc8c2b4, 0xffffff], 0.3),
    ],
  });
}

// --- The footpads as foes -------------------------------------------------------

/** A footpad's fighting frame: wider than a standing figure's, to fit him lying down. */
export function footpadSpec(): FrameSpec {
  return { w: 52, h: 52, feetY: 47, groundShade: 4 };
}

/** Beast frame order (see beasts3d.ts): 0-1 stand, 2-5 walk, 6-7 look about, 8 square up, 9 swing, 10 flinch, 11 down. */
export function footpadSheet(look: WayfarerLook): BeastSheet {
  const walk: Pose3D[] = [
    { stride: 1, bob: 0.8 },
    { stride: 0, bob: 0 },
    { stride: -1, bob: 0.8 },
    { stride: 0, bob: 0 },
  ];
  const models: Model[] = [
    wayfarerModel({ stride: 0, bob: 0 }, look),
    wayfarerModel({ stride: 0, bob: 0.7 }, look),
    ...walk.map((p) => wayfarerModel(p, look)),
    wayfarerModel({ stride: 0, bob: 0 }, look, 'ready'),
    wayfarerModel({ stride: 0, bob: 0.7 }, look, 'ready'),
    wayfarerModel({ stride: 0, bob: 0 }, look, 'ready'),
    wayfarerModel({ stride: 0, bob: 0.6 }, look, 'strike'),
    wayfarerModel({ stride: 0, bob: 0.8 }, look, 'hurt'),
    // Flat on his back in the grass.
    onItsSide(wayfarerModel({ stride: 0, bob: 0 }, look, 'hurt'), 19, 4.6),
  ];
  return { spec: footpadSpec(), models };
}

// --- Clover the goat ------------------------------------------------------------

/**
 * Clover, a nanny goat: a deep, barrel body on short legs, a brown coat with a
 * white face and socks, a little beard, horns curving back over her neck, a
 * short tail flicked up, and a bell on a red collar.
 */
function goatModel(pose: BeastPose, dead = false): Model {
  const BROWN: Tones = [0x8a5a34, 0x5e3c22, 0xa8744a];
  const DARK: Tones = [0x5e3c22, 0x42281a, 0x7a5030];
  const WHITE: Tones = [0xece4d8, 0xbcb2a4, 0xffffff];
  const HORN: Tones = [0x9a8a72, 0x6a5e4c, 0xbcae94];
  const HOOF: Tones = [0x2a2220, 0x1a1414, 0x4a3e38];
  const b = pose.bob;
  const lift = pose.lift ?? [0, 0, 0, 0];
  const solids: Solid[] = [];
  const details: Detail[] = [];

  const coat = (h: Hit): Tones => (h.ny > 0.55 && speck(h, 1.2) < 0.3 ? DARK : h.ny < -0.5 ? WHITE : BROWN);
  // The barrel of a body.
  for (let z = -6; z <= 5; z += 0.5) {
    const t = (z + 6) / 11;
    const r = 3.6 + Math.sin(t * Math.PI) * 0.9;
    solids.push({ cx: 0, cy: 12.6 - b + Math.sin(t * Math.PI) * 0.2, cz: z, rx: r * 0.92, ry: r, rz: 1.8, material: coat });
  }
  // Short legs with white socks.
  const sock = (h: Hit): Tones => (h.y < 5 ? WHITE : BROWN);
  const legsAt: Array<[number, number, number]> = [[1, -5, 0], [-1, -5, 1], [1, 4, 2], [-1, 4, 3]];
  for (const [side, z, i] of legsAt) {
    const off = pose.legs[i];
    const l = lift[i];
    const top: V3 = [side * 2, 11 - b, z];
    const knee: V3 = [side * 2, 5.6 + l * 0.6, z + off * 0.5];
    const foot: V3 = [side * 2, 1 + l, z + off];
    solids.push(...chain([top, knee, foot], [2, 1.2, 0.95], sock, 0.4));
    solids.push({ cx: foot[0], cy: foot[1] - 0.2, cz: foot[2] + 0.2, rx: 0.9, ry: 0.8, rz: 1, material: HOOF });
  }
  // A short tail, cocked up.
  solids.push(...chain([[0, 14.6 - b, -6.4], [0, 17 - b, -7.2]], [0.9, 0.6], DARK, 0.4));

  // Head: up, grazing, or turned up startled.
  const heads = {
    up: { h: [0, 18.6 - b, 8.6] as V3, pitch: 40 },
    sniff: { h: [0, 4.4 - (pose.nod ?? 0), 9] as V3, pitch: 80 },
    snarl: { h: [0, 19.6 - b, 8] as V3, pitch: 26 },
    bite: { h: [0, 16 - b, 10] as V3, pitch: 60 },
    hurt: { h: [0, 18 - b, 7.6] as V3, pitch: 30 },
  };
  const hd = dead ? { h: [0, 12, 9] as V3, pitch: 50 } : heads[pose.head];
  const H = hd.h;
  const p = (hd.pitch * Math.PI) / 180;
  const dir: V3 = [0, -Math.sin(p), Math.cos(p)];
  const at = (k: number, off: V3 = [0, 0, 0]): V3 => [H[0] + dir[0] * k + off[0], H[1] + dir[1] * k + off[1], H[2] + dir[2] * k + off[2]];
  // The neck, with a red collar and a brass bell.
  const neckBase: V3 = [0, 14.6 - b, 4.6];
  solids.push(...chain([neckBase, [0, (H[1] + neckBase[1]) / 2, (H[2] + neckBase[2]) / 2], at(-1.2)], [3.2, 2.7, 2.2], coat));
  const collar: V3 = [0, (H[1] + neckBase[1]) / 2 - 0.4, (H[2] + neckBase[2]) / 2];
  solids.push({ cx: collar[0], cy: collar[1], cz: collar[2], rx: 2.5, ry: 0.7, rz: 2.5, material: [0xb83a32, 0x862622, 0xd85a4a] });
  solids.push({ cx: 0, cy: collar[1] - 1.8, cz: collar[2] + 1.8, rx: 1.1, ry: 1.2, rz: 1.1, material: [P.gold, 0xb08830, P.goldLight] });
  // A white face, a dark muzzle and a wisp of beard.
  const face = (h: Hit): Tones => (h.nz > -0.2 ? WHITE : BROWN);
  solids.push({ cx: H[0], cy: H[1], cz: H[2], rx: 2.1, ry: 2.3, rz: 2.3, material: face });
  const tip = at(3.8);
  solids.push(...limb(at(1), tip, 1.7, 1.2, WHITE));
  solids.push({ cx: tip[0], cy: tip[1], cz: tip[2] + 0.2, rx: 1, ry: 0.9, rz: 0.8, material: [0x8a6a5a, 0x6a4e42, 0xa88878] });
  solids.push(...limb(at(3, [0, -1.4, 0]), at(2.6, [0, -3.6, -0.4]), 0.8, 0.4, [0xd8d0c4, 0xaaa294, 0xf0e8dc], 0.3));
  // Ears out to the sides, and horns sweeping back.
  for (const side of [-1, 1]) {
    solids.push(...limb(at(0.2, [side * 1.6, 0.8, -0.6]), at(-0.2, [side * 4, 0.2, -1.6]), 0.9, 0.6, BROWN, 0.35));
    const base = at(0.4, [side * 0.9, 2, -0.6]);
    solids.push(...chain([base, [base[0] + side * 0.4, base[1] + 2.4, base[2] - 1.4], [base[0] + side * 0.9, base[1] + 3, base[2] - 3.6], [base[0] + side * 1.2, base[1] + 2, base[2] - 5]], [0.7, 0.6, 0.45, 0.3], HORN, 0.3));
  }
  const shut = dead || pose.head === 'hurt';
  for (const side of [-1, 1]) {
    const e = at(0.9, [side * 1.8, 0.7, 0]);
    details.push({ x: e[0], y: e[1], z: e[2], color: shut ? 0x5e3c22 : 0x241a10 });
  }
  return { solids, details };
}

const STILL: BeastPose['legs'] = [0, 0, 0, 0];
const GOAT_POSES: BeastPose[] = [
  { legs: STILL, bob: 0, head: 'up', tail: 0 },
  { legs: STILL, bob: 0.5, head: 'up', tail: 0 },
  { legs: [2, -2, -2, 2], bob: 0.5, head: 'up', tail: 0 },
  { legs: STILL, lift: [0, 1.4, 1.4, 0], bob: 0, head: 'up', tail: 0 },
  { legs: [-2, 2, 2, -2], bob: 0.5, head: 'up', tail: 0 },
  { legs: STILL, lift: [1.4, 0, 0, 1.4], bob: 0, head: 'up', tail: 0 },
  { legs: [0, 0, 0.6, 1], bob: 0.5, head: 'sniff', tail: 0 },
  { legs: [0, 0, 0.6, 1], bob: 0.8, head: 'sniff', tail: 0, nod: 1 },
  { legs: STILL, bob: 0, head: 'snarl', tail: 0 },
  { legs: STILL, bob: 0, head: 'bite', tail: 0 },
  { legs: STILL, bob: 0.6, head: 'hurt', tail: 0 },
  { legs: STILL, bob: 0, head: 'up', tail: 0 },
];

export function goatSpec(): FrameSpec {
  return { w: 40, h: 40, feetY: 34, groundShade: 3 };
}

export function goatSheet(): BeastSheet {
  return { spec: goatSpec(), models: GOAT_POSES.map((pose, i) => goatModel(pose, i === BEAST_FRAME.dead)) };
}

/** The wayfarers' figures ('folk-<id>'), the footpads' fighting sheets and the goat's ('creature-<kind>'). */
export function generateWayfarers(scene: Phaser.Scene): void {
  const folk: Record<string, (pose: Pose3D) => Model> = {
    footpad: rookModel,
    cutpurse: nabModel,
    tinker: tinkerModel,
    goatherd: goatherdModel,
    courier: courierModel,
  };
  for (const [id, build] of Object.entries(folk)) generateFigure3D(scene, `folk-${id}`, build);
  generateBeast(scene, 'footpad', footpadSheet(ROOK), 9);
  generateBeast(scene, 'cutpurse', footpadSheet(NAB), 9);
  generateBeast(scene, 'goat', goatSheet(), 8);
}

