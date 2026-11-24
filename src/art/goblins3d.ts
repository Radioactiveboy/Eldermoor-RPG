import Phaser from 'phaser';
import { darker, type Tones } from './character';
import { BeastAnim, BeastSheet, chain, generateBeast, onItsSide, speck, V3 } from './beasts3d';
import { Detail, FrameSpec, Hit, limb, Material, Model, Pose3D, Solid } from './figure3d';
import { PALETTE as P } from './palette';

/**
 * The goblins who raid the Hollow, modelled in 3D like everyone else (see
 * figure3d.ts) and drawn on a beast's sheet of frames (see beasts3d.ts), so
 * they can skulk, square up, swing, flinch and fall in a fight.
 *
 * They are drawn finely, like the hero and the companions (see fine3d.ts):
 * their frames are GOBLIN_RES times bigger in each direction than they're
 * shown, so the models carry detail a folk-sized pixel couldn't: slit-pupilled
 * eyes under a furrowed brow, nostrils, warts and pores, a row of crooked teeth,
 * knuckled fingers and toes with black claws, stitching on the hide, rivets on
 * the iron.
 *
 * A goblin is a hunched, pot-bellied little thing on bandy legs, with long
 * arms that hang to its knees, clawed hands and feet, and a head too big for
 * it: a heavy brow, a long hooked nose, a wide mouth with tusks jutting up
 * from the lower jaw, little yellow eyes, and great ears that sweep out and
 * back like a bat's. Three sorts of common goblin come raiding (a cutter with
 * a cleaver, a spearman, and a firebrand with a torch and a hatchet), led by a
 * Goblin Brute: half as big again, in scraps of plate and mail and a horned
 * helm, with a round shield and a spiked club.
 *
 * Their sheets have more frames than a beast's (see {@link GOBLIN_FRAME}), for
 * a fight drawn out in full: a wind-up, the blow and its follow-through; a
 * reel and a recovery when struck; a stagger and a slump to the knees before
 * they fall; a jeer; and a twitch of the ears and a blink while they stand.
 */

/** What a goblin is doing: its weapon arm (its right, screen-left facing us), how it stands and leans. */
type Act = 'rest' | 'ready' | 'windup' | 'strike' | 'follow' | 'hurt' | 'reel' | 'taunt' | 'slump';

type Weapon = 'cleaver' | 'spear' | 'hatchet' | 'club' | 'none';

/** The little things that change from frame to frame of a loop. */
interface Flicker {
  /** Which frame of the sheet: sets how the torch's flames lick. */
  phase?: number;
  /** Eyes shut for a blink. */
  blink?: boolean;
  /** Ears pricked up (positive) or laid back (negative), in body units at the tip. */
  ears?: number;
}

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
  cap?: 'leather' | 'helm';
  /** Iron on the shoulders, shins and forearms. */
  armoured?: boolean;
  /** Iron cuffs on the wrists, chained together (a prisoner). */
  manacles?: boolean;
  /** A string of teeth and finger bones round the neck. */
  bones?: boolean;
  /** A ragged hood and cape. */
  hood?: Tones;
  /** An old pale scar across the left side of the face. */
  scar?: boolean;
  /** Ribs showing through the skin of a scrawny chest. */
  ribs?: boolean;
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
const LEATHER: Tones = [P.leatherDark, P.barkDark, P.leather];
const MOUTH: Tones = [0x4a1a1c, 0x2a0e10, 0x6a2a2a];
const TONGUE: Tones = [0x9a4a52, 0x6e3038, 0xb86670];
const FLAME: Tones = [P.fireOrange, P.fireRed, P.fireYellow];
const FLAME_CORE: Tones = [P.fireYellow, P.fireOrange, 0xfff4c0];
const SCLERA = 0xd8cc86;
const PUPIL = 0x140c08;
const GLINT = 0xfffbe8;
const LIP = 0x2a1a14;
const STITCH = 0x2a1e14;
const RIVET = 0xc8ccd4;

const knob = (p: V3, r: number, material: Material, soft = false): Solid => ({ cx: p[0], cy: p[1], cz: p[2], rx: r, ry: r, rz: r, material, soft });
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const along = (p: V3, d: V3, k: number): V3 => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];

/**
 * How the body sits for each act: the lean forward (added to the look's hunch),
 * the stance (stride, the leading foot), how far the head drops, the jaw open,
 * and the ears laid back.
 */
const BODY: Record<Act, { hunch: number; stance: number | null; head: number; open: number; ears: number; shut: boolean }> = {
  rest: { hunch: 0, stance: null, head: 0, open: 0, ears: 0, shut: false },
  ready: { hunch: 0.8, stance: 0.8, head: 0, open: 0.2, ears: 0, shut: false },
  windup: { hunch: -0.8, stance: 0.9, head: 0.3, open: 0.7, ears: -0.8, shut: false },
  strike: { hunch: 2.2, stance: 0.9, head: -0.8, open: 1, ears: -0.6, shut: false },
  follow: { hunch: 3.4, stance: 1.1, head: -1.2, open: 0.5, ears: -0.4, shut: false },
  hurt: { hunch: -2.4, stance: -0.6, head: 0.4, open: 0.4, ears: -1.4, shut: true },
  reel: { hunch: -3.8, stance: -1.2, head: 0.6, open: 0.9, ears: -2.2, shut: true },
  taunt: { hunch: -1.2, stance: 0.5, head: 0.4, open: 1, ears: 1, shut: false },
  slump: { hunch: 4.4, stance: 0, head: -1.6, open: 0.5, ears: -2.6, shut: true },
};

/** Where the weapon arm's elbow and hand go for each act: x out from the body (times its side), y up, z forward of the shoulder. */
const WEAPON_ARM: Partial<Record<Act, { elbow: V3; hand: V3 }>> = {
  ready: { elbow: [7, 17.4, 0.6], hand: [6.8, 21.4, 2.8] },
  windup: { elbow: [6.8, 20.6, -1.4], hand: [5.4, 25.2, -2.6] },
  strike: { elbow: [5.8, 18, 3.4], hand: [3.2, 15, 7.4] },
  follow: { elbow: [4.8, 14.6, 3.4], hand: [1.4, 10.6, 5.4] },
  hurt: { elbow: [7, 15, -1], hand: [8.4, 11.6, -1.6] },
  reel: { elbow: [7.6, 17.4, -2.2], hand: [9.4, 19.8, -3.8] },
  taunt: { elbow: [7.2, 21.4, 0.8], hand: [6.6, 26.4, 1.8] },
  slump: { elbow: [5.6, 12.4, 1.6], hand: [5.8, 7, 3.2] },
};

/** Which way a hand weapon's head points from the hand, by act. */
const BLADE: Record<Act, V3> = {
  rest: [0.04, -0.88, 0.48],
  ready: [0.07, 0.99, 0.1],
  windup: [0.1, 0.6, -0.8],
  strike: [0.28, -0.3, 0.92],
  follow: [0.5, -0.8, 0.3],
  hurt: [-0.08, -0.99, 0.08],
  reel: [-0.3, 0.4, -0.85],
  taunt: [0.05, 0.95, 0.3],
  slump: [0.1, -0.95, 0.3],
};

/** How the spear lies, by act: its line through the hand (butt to point), and how far it runs behind and ahead of the grip. */
const SPEAR: Record<Exclude<Act, 'rest'>, { d: V3; back: number; front: number }> = {
  ready: { d: [-0.06, 0.9, 0.42], back: 9, front: 12 },
  windup: { d: [0, 0.25, 0.97], back: 13, front: 7 },
  strike: { d: [0.08, 0.12, 0.99], back: 6, front: 16 },
  follow: { d: [0.1, -0.1, 0.99], back: 5, front: 17 },
  hurt: { d: [-0.15, 0.95, -0.25], back: 8, front: 10 },
  reel: { d: [-0.2, 0.8, -0.55], back: 8, front: 10 },
  taunt: { d: [0, 0.97, 0.2], back: 6, front: 14 },
  slump: { d: [0.1, -0.45, 0.9], back: 4, front: 10 },
};

/** Being struck or going down: the off arm flung wide, eyes screwed shut. */
const struck = (act: Act) => act === 'hurt' || act === 'reel' || act === 'slump';

/**
 * One goblin in one pose. Body space as everywhere: x across (to screen-right
 * facing us), y up, z the way it faces. `act` sets the weapon arm and how the
 * body leans for a fight.
 */
function goblinModel(pose: Pose3D, look: GoblinLook, act: Act = 'rest', fx: Flicker = {}): Model {
  const { skin, mottle } = look;
  const body = BODY[act];
  const b = pose.bob;
  const w = look.bulk ?? 1;
  // Squared up for a fight: feet planted wide, one ahead of the other.
  const s = body.stance ?? pose.stride;
  const hunch = (look.hunch ?? 2.2) + body.hunch;
  const solids: Solid[] = [];
  const details: Detail[] = [];
  /** A fine mark, one pixel on the finely drawn sheet. */
  const mark = (p: V3, color: number, size = 0.5) => details.push({ x: p[0], y: p[1], z: p[2], color, size });
  const pore = darker(mottle[1]);

  // Green skin, blotched and warty, pored, a little paler on the belly.
  const hide = (h: Hit): Tones => {
    const n = speck(h, 1.4);
    if (n < 0.14) return mottle;
    if (speck(h, 0.5) < 0.03) return [pore, darker(pore), mottle[1]];
    if (h.ny < -0.45 && h.nz > 0.2) return [skin[2], skin[0], skin[2]];
    return skin;
  };

  // --- Legs: bowed out at the knee, thin as sticks, knobbly-kneed, ending in big clawed feet.
  for (const side of [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 && act === 'rest' ? 1 : 0;
    const hip: V3 = [side * 2.2 * w, 10 - b * 0.5, 0.2];
    const knee: V3 = [side * 3.8 * w, 5.8 + lift * 0.6 - (act === 'slump' ? 2.4 : 0), 1 + swing * 1.4 + (act === 'slump' ? 2.6 : 0)];
    const ankle: V3 = [side * 2.8 * w, 1.9 + lift, swing * 2.4 - 0.2];
    const greave = look.armoured
      ? (h: Hit): Tones => (h.y < 6 && h.y > 2.6 ? (Math.abs(h.y - 5.6) < 0.3 || Math.abs(h.y - 3) < 0.3 ? IRON : BLACK_IRON) : hide(h))
      : hide;
    solids.push(...chain([hip, knee, ankle], [1.8 * w, 1.3 * w, 1.1 * w], greave, 0.45));
    // A bony knee, and a sinew down the back of the shin.
    solids.push(knob([knee[0], knee[1] + 0.2, knee[2] + 0.5], 1.35 * w, hide));
    if (look.armoured) {
      for (const y of [3.4, 5]) mark([ankle[0] + (knee[0] - ankle[0]) * ((y - ankle[1]) / (knee[1] - ankle[1])), y, ankle[2] + (knee[2] - ankle[2]) * ((y - ankle[1]) / (knee[1] - ankle[1])) + 1.3 * w], RIVET);
    }
    // The foot: long, flat, three knuckled toes splayed forward, each with a hooked black claw.
    const foot: V3 = [ankle[0], 1 + lift, ankle[2] + 1.6];
    solids.push({ cx: foot[0], cy: foot[1], cz: foot[2], rx: 1.6 * w, ry: 0.9, rz: 2.4 * w, material: hide });
    solids.push(knob([ankle[0], 1.4 + lift, ankle[2] - 0.8], 0.9 * w, hide));
    for (const toe of [-1, 0, 1]) {
      const root: V3 = [foot[0] + toe * 0.9 * w, 0.8 + lift, foot[2] + 1.6 * w];
      const tip: V3 = [foot[0] + toe * 1.25 * w, 0.6 + lift, foot[2] + 2.8 * w + (toe === 0 ? 0.4 : 0)];
      solids.push(...chain([root, tip], [0.6, 0.5], hide, 0.3));
      solids.push(knob([tip[0], tip[1] - 0.05, tip[2] + 0.55], 0.36, CLAW));
    }
  }

  // --- The kilt: strips of hide hanging from the belt to mid-thigh, ragged at the hem, sewn with gut.
  const kilt = (h: Hit): Tones => {
    const a = (Math.atan2(h.x, h.z) + Math.PI) * 4;
    const strip = Math.floor(a);
    const edge = a - strip;
    if ((edge < 0.07 || edge > 0.93) && Math.floor(h.y * 2.4) % 2 === 0) return [STITCH, darker(STITCH), look.kilt[1]];
    const base = strip % 3 === 0 ? [look.kilt[1], darker(look.kilt[1]), look.kilt[0]] as Tones : look.kilt;
    return speck(h, 0.9) < 0.1 ? [look.kilt[2], look.kilt[0], look.kilt[2]] : base;
  };
  for (let y = 7; y <= 11; y += 0.5) {
    const t = (11 - y) / 4;
    solids.push({ cx: 0, cy: y - b * 0.5, cz: 0.4 + s * 0.3 * t, rx: (4.4 + t * 0.8) * w, ry: 0.8, rz: (3.8 + t * 0.6) * w, material: kilt });
  }
  // Tatters hanging lower in places.
  for (const [x, z, len] of [[-2.6, 3.2, 2.2], [1.4, 3.8, 1.4], [3.6, 1.4, 2.6], [-3.8, -1.2, 1.8], [0.4, -3.4, 2.4], [-1, 3.9, 1.1]] as const) {
    solids.push({ cx: x * w, cy: 6.6 - len / 2 - b * 0.4, cz: z * w + s * 0.3, rx: 0.9, ry: len / 2 + 0.4, rz: 0.6, material: look.kilt });
  }
  // A belt with an iron buckle, a pouch with its flap tied down, and a knucklebone on a thong.
  const beltY = 11.3 - b * 0.6;
  const beltZ = 0.6 + 4 * w;
  solids.push({ cx: 0, cy: beltY, cz: 0.6, rx: 4.6 * w, ry: 0.8, rz: 4 * w, material: (h) => (Math.abs(h.y - beltY) > 0.55 ? [LEATHER[1], darker(LEATHER[1]), LEATHER[0]] : LEATHER) });
  for (const [x, y] of [[-0.6, 0.5], [0, 0.5], [0.6, 0.5], [-0.6, 0], [0.6, 0], [-0.6, -0.5], [0, -0.5], [0.6, -0.5]]) mark([x, beltY + y, beltZ + 0.35], IRON[x === -0.6 && y === 0.5 ? 2 : 0]);
  mark([0, beltY, beltZ + 0.35], IRON[1]);
  const pouch: V3 = [3.8 * w, 9.6 - b * 0.6, 2.2 * w];
  solids.push({ cx: pouch[0], cy: pouch[1], cz: pouch[2], rx: 1.3, ry: 1.6, rz: 1.1, material: (h) => (h.y > pouch[1] + 0.5 ? [HIDE[1], darker(HIDE[1]), HIDE[0]] : HIDE) });
  mark([pouch[0], pouch[1] + 0.4, pouch[2] + 1.15], BONE[0]);
  solids.push(knob([-3.6 * w, 8.6 - b * 0.6, 2.6 * w], 0.6, BONE));

  // --- Body: a round pot belly and a narrow chest, hunched forward over it.
  const vest = look.vest;
  const torso = (h: Hit): Tones => {
    if (vest && (h.y > 13.4 - b || h.nz < 0.35)) {
      const paint = look.vestPaint ? look.vestPaint(h, vest) : vest;
      // An open front: the belly shows between the edges, laced across with thongs.
      if (h.nz > 0.6 && Math.abs(h.nx) < 0.26 && h.y < 17.6 - b) {
        if (Math.abs(Math.abs(h.nx) - Math.abs((h.y * 0.9) % 1.6 - 0.8) * 0.3) < 0.035) return LEATHER;
        return hide(h);
      }
      // Stitching down the open edges and round the arm holes.
      if (h.nz > 0.5 && Math.abs(Math.abs(h.nx) - 0.31) < 0.04 && Math.floor(h.y * 2.4) % 2 === 0) return [STITCH, darker(STITCH), paint[1]];
      return paint;
    }
    if (look.ribs && h.nz > 0.35 && h.y > 14.6 - b && h.y < 18 - b && Math.abs(h.nx) > 0.2 && (h.y + Math.abs(h.nx) * 1.6) % 1.25 < 0.28) return [skin[1], darker(skin[1]), skin[0]];
    // A navel on the pot belly.
    return hide(h);
  };
  solids.push({ cx: 0, cy: 13.2 - b * 0.8, cz: 1.4 + hunch * 0.2, rx: 4.4 * w, ry: 3.4, rz: 4 * w, material: torso });
  solids.push({ cx: 0, cy: 16.8 - b, cz: 1.2 + hunch * 0.55, rx: 4.6 * w, ry: 3.2, rz: 3.4 * w, material: torso });
  if (!vest) mark([0, 12.6 - b * 0.8, 1.4 + hunch * 0.2 + 4 * w], darker(skin[1]));
  // A knobbly spine down the hunched back.
  for (let i = 0; i < 5; i++) solids.push(knob([0, 13.8 + i * 1.15 - b, -1.7 * w + hunch * (0.28 + i * 0.1)], 0.6 + (i % 2) * 0.15, torso));
  // Hood and cape over the shoulders, ragged to the small of the back.
  if (look.hood) {
    const hood = look.hood;
    const patched = (h: Hit): Tones => (speck(h, 1.6) < 0.08 ? [hood[1], darker(hood[1]), hood[0]] : hood);
    for (let y = 10; y <= 19; y += 0.5) {
      const t = (19 - y) / 9;
      const tatter = Math.sin(y * 5.3) > 0.5 ? 0.7 : 0;
      solids.push({ cx: 0, cy: y - b * (1 - t * 0.5), cz: -2 + hunch * 0.4 - t * 1.4 - Math.abs(s) * t, rx: (5.2 + t) * w - tatter, ry: 0.8, rz: 2.2, material: patched });
    }
  }

  // --- Arms: long and wiry, hanging to the knee, big knuckled hands with black claws.
  const shoulderY = 18.8 - b;
  const sz = 1.4 + hunch;
  let weaponHand: V3 = [0, 0, 0];
  let offHand: V3 = [0, 0, 0];
  for (const side of [-1, 1]) {
    const weapon = side === -1;
    const swing = act === 'rest' && !pose.sit ? -s * side * 1.8 : 0;
    const shoulder: V3 = [side * 4.6 * w, shoulderY, sz];
    const at = (p: V3): V3 => [side * p[0] * w, p[1] - b, sz + p[2]];
    let elbow: V3;
    let hand: V3;
    const pose3 = WEAPON_ARM[act];
    if (weapon && pose3) {
      elbow = at(pose3.elbow);
      hand = at(pose3.hand);
    } else if (weapon && look.weapon === 'spear') {
      elbow = [side * 6.6 * w, 14.6 - b, sz + 0.6];
      hand = [side * 7 * w, 12.6 - b, sz + 2];
    } else if (weapon) {
      elbow = [side * 6.4 * w, 13.6 - b, sz + 0.4 + swing * 0.4];
      hand = [side * 6.8 * w, 8.8 - b, 2 + sz * 0.5 + swing];
    } else if (look.shield) {
      // The shield arm held across the body.
      elbow = [side * 6.4 * w, 14.4 - b, sz + 1.6];
      hand = struck(act) ? [side * 5.4 * w, 15.6 - b, sz + 2.4] : act === 'windup' ? [side * 4.2 * w, 16.4 - b, sz + 4.2] : [side * 3.4 * w, 15.2 - b, sz + 4.6];
    } else if (look.torch) {
      // The torch held high, out to the side (and shaken at the foe when it jeers).
      elbow = [side * 7 * w, 17 - b, sz + 1];
      hand = struck(act) ? [side * 8.6 * w, 15 - b, sz - 0.6] : act === 'taunt' ? [side * 7 * w, 23.4 - b, sz + 2.8] : [side * 7.6 * w, 20.4 - b, sz + 2.4];
    } else if (act === 'rest' && !look.manacles) {
      elbow = [side * 6.4 * w, 13.6 - b, sz + swing * 0.4];
      hand = [side * 6.8 * w, 8.8 - b, 2 + sz * 0.5 + swing];
    } else if (act === 'rest') {
      // Cuffed: hands held together before the belly.
      elbow = [side * 6 * w, 13.8 - b, sz + 0.8];
      hand = [side * 4.4 * w, 10.6 - b, sz + 3.2];
    } else if (act === 'taunt') {
      // A fist shaken overhead.
      elbow = [side * 7.2 * w, 21 - b, sz + 0.6];
      hand = [side * 6.2 * w, 25.4 - b, sz + 1.4];
    } else if (act === 'slump') {
      elbow = [side * 5.6 * w, 12.4 - b, sz + 1.8];
      hand = [side * 5.6 * w, 7.2 - b, sz + 3];
    } else {
      // Claws out for balance, the other hand ready to rake.
      elbow = [side * 7 * w, 15.4 - b, sz + 1.6];
      hand = struck(act) ? [side * 8.6 * w, 14 - b, sz - 1.4] : act === 'strike' || act === 'follow' ? [side * 7.4 * w, 14.2 - b, sz + 2.2] : [side * 6.4 * w, 15.6 - b, sz + 5];
    }
    const sleeve = look.armoured ? (h: Hit): Tones => (h.y > shoulderY - 2.6 ? BLACK_IRON : hide(h)) : hide;
    solids.push(knob(shoulder, 2 * w, look.vest && !look.armoured ? torso : hide));
    solids.push(...limb(shoulder, elbow, 1.3 * w, 1.1 * w, sleeve, 0.45));
    solids.push(knob(elbow, 1.2 * w, sleeve));
    const vambrace = look.armoured ? (h: Hit): Tones => (speck(h, 0.9) < 0.12 ? RUST : BLACK_IRON) : hide;
    solids.push(...limb(elbow, hand, 1.1 * w, 1.2 * w, vambrace, 0.45));
    if (look.armoured) for (const t of [0.3, 0.7]) {
      const p = lerp3(elbow, hand, t);
      mark([p[0] + side * 1.1 * w, p[1], p[2]], RIVET);
    }
    // The hand: a bony palm, three knuckled fingers and a thumb, each tipped with a black claw.
    const toward = norm([hand[0] - elbow[0], hand[1] - elbow[1], hand[2] - elbow[2]]);
    solids.push({ cx: hand[0], cy: hand[1] - 0.3, cz: hand[2] + 0.3, rx: 1.3 * w, ry: 1.2 * w, rz: 1.4 * w, material: hide });
    const gripping = (weapon && look.weapon !== 'none') || (!weapon && (look.torch || look.shield));
    for (const k of [-1, 0, 1]) {
      const root: V3 = [hand[0] + k * 0.75 * w, hand[1] - 0.5, hand[2] + 0.9 * w];
      const reach = gripping ? 1.1 : 2;
      const tip = along(root, gripping ? [side * -0.2, -0.6, 0.4] : toward, reach * w);
      solids.push(...chain([root, tip], [0.5 * w, 0.42 * w], hide, 0.3));
      solids.push(knob(along(tip, gripping ? [side * -0.4, -0.4, -0.2] : toward, 0.45), 0.34, CLAW));
    }
    const thumb: V3 = [hand[0] - side * 1.1 * w, hand[1] + 0.2, hand[2] + 0.9 * w];
    solids.push(knob(thumb, 0.5 * w, hide));
    solids.push(knob(along(thumb, [-side * 0.4, 0, 0.6], 0.6), 0.3, CLAW));
    if (look.armoured) {
      // Iron pauldrons, layered plates over each shoulder, riveted along their edges.
      for (let i = 0; i < 3; i++) {
        const plate: V3 = [side * (4.8 + i * 0.6) * w, shoulderY + 1.2 - i * 1.4, sz - 0.2];
        const rx = (2.9 - i * 0.3) * w;
        solids.push({ cx: plate[0], cy: plate[1], cz: plate[2], rx, ry: 1, rz: (2.9 - i * 0.2) * w, material: i === 0 ? IRON : (h) => (speck(h, 1.1) < 0.1 ? RUST : BLACK_IRON) });
        for (const a of [-0.9, -0.3, 0.3, 0.9]) mark([plate[0] + Math.sin(a) * rx * 0.8, plate[1] - 0.6, plate[2] + Math.cos(a) * (2.9 - i * 0.2) * w * 0.85], RIVET);
      }
      solids.push(knob([side * 5.2 * w, shoulderY + 2.4, sz - 0.2], 0.6, IRON));
    }
    if (look.manacles) solids.push({ ...knob(lerp3(elbow, hand, 0.78), 1.6 * w, BLACK_IRON), ry: 1 });
    if (weapon) weaponHand = hand;
    else offHand = hand;
  }
  // The chain between the cuffs, sagging in front of the belly.
  if (look.manacles) {
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const sag = Math.sin(t * Math.PI) * 2.4;
      solids.push(knob([weaponHand[0] + (offHand[0] - weaponHand[0]) * t, weaponHand[1] + 1 + (offHand[1] - weaponHand[1]) * t - sag, weaponHand[2] + 1.2 + (offHand[2] - weaponHand[2]) * t + sag * 0.5], 0.45, i % 2 ? IRON : BLACK_IRON));
    }
  }

  // --- Head: big, jutting forward on a sinewy neck.
  const hy = 23.4 - b + body.head;
  const hz = 2.6 + hunch * 1.05;
  solids.push(...limb([0, 19.6 - b, sz - 0.4], [0, hy - 1.6, hz - 0.8], 1.9 * w, 1.8 * w, hide, 0.5));
  const k = Math.sqrt(w);
  const head = { rx: 4.8 * k, ry: 4.2 * k, rz: 4.4 * k };
  /** A point on the face's front, `dy` above the head's middle. */
  const onFace = (x: number, dy: number, lift = 0.15): V3 => [x, hy + dy, hz + head.rz * Math.sqrt(Math.max(0, 1 - (x / head.rx) ** 2 - (dy / head.ry) ** 2)) + lift];
  const face = (h: Hit): Tones => {
    const py = h.y - hy;
    if (look.paint && h.nz > 0.25 && Math.abs(py - 0.6) < 0.7 && Math.abs(h.nx) > 0.12) return look.paint;
    if (look.hair && !look.topknot && (py > 3 || (h.nz < -0.4 && py > 0))) return speck(h, 0.7) < 0.55 ? look.hair : hide(h);
    return hide(h);
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: head.rx, ry: head.ry, rz: head.rz, material: face, soft: true });
  // The skull bulges at the back.
  solids.push({ cx: 0, cy: hy + 1, cz: hz - 1.6, rx: 3.8 * k, ry: 3.6 * k, rz: 3.2 * k, material: face, soft: true });
  // Hollow cheeks under high cheekbones.
  for (const side of [-1, 1]) solids.push({ cx: side * 2.9 * k, cy: hy - 0.4, cz: hz + 2.4 * k, rx: 1.4, ry: 1.1, rz: 1.4, material: face, soft: true });
  // A heavy brow over sunken eyes, knitted into a scowl.
  const brow: Tones = [darker(skin[1]), darker(darker(skin[1])), skin[1]];
  const browDrop = act === 'taunt' ? -0.3 : struck(act) ? 0.3 : 0;
  for (const side of [-1, 1]) {
    solids.push({ cx: side * 1.7 * k, cy: hy + 1.6 - browDrop, cz: hz + 3.3 * k, rx: 1.9 * k, ry: 0.85, rz: 1.25, material: brow, soft: true });
  }
  // A wide lower jaw, jutting under the upper lip (dropped open to snarl), with tusks.
  const open = body.open;
  const jawY = hy - 2.4 * k - open * 0.9;
  solids.push({ cx: 0, cy: jawY, cz: hz + 1.6 * k, rx: 3.6 * k, ry: 1.9, rz: 3 * k, material: hide, soft: true });
  for (const side of [-1, 1]) {
    // The tusks, yellowed and chipped, rising from the jaw past the upper lip.
    solids.push({ cx: side * 1.7 * k, cy: jawY + 1.3 * k, cz: hz + 4.4 * k, rx: 0.5, ry: 1.1 * k, rz: 0.5, material: TOOTH, soft: true });
    solids.push(knob([side * 1.6 * k, jawY + 2.3 * k, hz + 4.3 * k], 0.32, TOOTH, true));
  }
  if (open > 0.3) {
    // The mouth agape: dark inside, a tongue, crooked teeth above and below.
    const my = hy - 1.9 * k - open * 0.35;
    solids.push({ cx: 0, cy: my, cz: hz + 3.6 * k, rx: 1.7 * k, ry: 0.4 + open * 0.55, rz: 0.8, material: MOUTH });
    solids.push({ cx: 0, cy: my - open * 0.3, cz: hz + 3.5 * k, rx: 1.1 * k, ry: 0.35, rz: 0.7, material: TONGUE });
    for (const x of [-1.1, -0.5, 0.1, 0.7, 1.2]) {
      mark([x * k, my + 0.25 + open * 0.3, hz + 4.3 * k], TOOTH[x === 0.1 ? 1 : 0]);
      if (x !== 0.1) mark([x * k + 0.2, my - 0.2 - open * 0.3, hz + 4.2 * k], TOOTH[0]);
    }
  } else {
    // A wide grim slash of a mouth, the upper fangs biting over the lip.
    // Laid along the top of the jutting jaw, where the upper lip overhangs it.
    const lipY = jawY + 1.15;
    const onJaw = (x: number): V3 => [x, lipY, hz + 1.6 * k + 3 * k * Math.sqrt(Math.max(0, 1 - (x / (3.6 * k)) ** 2 - (1.15 / 1.9) ** 2)) + 0.2];
    for (let x = -1.25; x <= 1.26; x += 0.5) mark(onJaw(x * k), LIP);
    for (const x of [-0.5, 0.5]) mark([x * k, lipY - 0.5, onJaw(x * k)[2] - 0.05], TOOTH[0]);
  }
  // The long hooked nose, with flared nostrils and a wart on the bridge.
  solids.push(...chain([[0, hy + 0.8, hz + 3.6 * k], [0, hy - 0.2, hz + 5.6 * k], [0, hy - 1.4, hz + 6.4 * k]], [1.1 * k, 0.9 * k, 0.6 * k], hide, 0.35).map((x) => ({ ...x, soft: true })));
  for (const side of [-1, 1]) solids.push(knob([side * 0.6 * k, hy - 1.1, hz + 5.3 * k], 0.55 * k, hide, true));
  for (const side of [-1, 1]) mark([side * 0.45 * k, hy - 1.55, hz + 5.75 * k], darker(darker(skin[1])));
  // Light catching the ridge of the nose.
  for (const p of [[0, hy + 1.6, hz + 3.9 * k], [0, hy + 0.65, hz + 5.7 * k], [0, hy - 1, hz + 6.9 * k]] as V3[]) mark(p, skin[2]);
  const wart: Tones = [mottle[1], darker(mottle[1]), mottle[0]];
  solids.push(knob([0.5 * k, hy + 0.2, hz + 4.9 * k], 0.36, wart, true));
  solids.push(knob([-3.1 * k, hy - 1, hz + 2.6 * k], 0.4, wart, true));
  solids.push(knob([2.3 * k, hy + 2.9, hz + 2.4 * k], 0.34, wart, true));
  // Furrows on the brow between the eyes, and creases fanning from the eyes' corners.
  for (const dy of [2.5, 3]) mark(onFace(0, dy), darker(skin[1]));
  mark(onFace(-0.5, 2.3), darker(skin[1]));
  mark(onFace(0.5, 2.3), darker(skin[1]));
  // An old scar across the left of the face.
  if (look.scar) for (const [x, dy] of [[2.2, 2.6], [2.5, 1.9], [2.9, 0.2], [3.1, -0.4], [3.3, -1]]) mark(onFace(x * k, dy), 0xc8c49a);

  // Ears: great leathery sails sweeping out and back, pinker inside, veined, one notched and one ringed.
  const inner: Tones = [0xb0786a, 0x86564c, 0xc89486];
  const vein: Tones = [0x8a5248, 0x643830, 0xa06456];
  for (const side of [-1, 1]) {
    const flick = body.ears + (fx.ears ?? 0) * (side === 1 ? 1 : 0.7);
    const from: V3 = [side * 3.6 * k, hy + 0.6, hz - 0.6];
    const to: V3 = [side * 11.4 * k, hy + 4.2 + flick, hz - 3.8 - Math.min(0, flick) * 0.6];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      // The right ear has a bite out of its trailing edge.
      const notch = side === -1 && t > 0.55 && t < 0.68 ? 0.55 : 1;
      const r = (2.4 * (1 - t) ** 1.3 + 0.3) * notch;
      solids.push({
        cx: from[0] + (to[0] - from[0]) * t,
        cy: from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * 0.6,
        cz: from[2] + (to[2] - from[2]) * t,
        rx: r * 0.9,
        ry: r,
        rz: 0.55,
        material: (h: Hit) => {
          if (!(h.nz > 0.35 && t > 0.15 && t < 0.85)) return hide(h);
          // Two veins running out along the inner ear.
          const dy = h.y - (from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * 0.6);
          return Math.abs(dy - r * 0.25) < 0.16 || Math.abs(dy + r * 0.3) < 0.14 ? vein : inner;
        },
        soft: true,
      });
    }
    // A brass ring through the left ear.
    if (side === 1) {
      const ring: V3 = [side * 7.2 * k, hy + 1.2 + flick * 0.4, hz - 2.5];
      for (const [dx, dy] of [[0, 0.5], [0.4, 0.3], [0.5, -0.1], [0.3, -0.5], [-0.1, -0.6], [-0.4, -0.3]]) mark([ring[0] + dx, ring[1] + dy - 0.6, ring[2] + 0.5], P.gold);
      mark([ring[0] + 0.3, ring[1] - 0.2, ring[2] + 0.5], P.goldLight, 0.5);
    }
  }
  // A topknot of black hair, tied with a cord.
  if (look.hair && look.topknot) {
    const lock = (h: Hit): Tones => (Math.floor((h.x + h.z) * 2.2) % 2 ? look.hair! : [look.hair![2], look.hair![0], look.hair![2]]);
    solids.push(knob([0, hy + 4.2 * k, hz - 1.4], 1.3, lock));
    solids.push({ cx: 0, cy: hy + 4.8 * k, cz: hz - 1.5, rx: 1, ry: 0.35, rz: 1, material: [0xa8402e, 0x7a2a1e, 0xc85a42] });
    solids.push(...chain([[0, hy + 5, hz - 1.6], [0, hy + 6, hz - 3.4], [0, hy + 4.6, hz - 5.4], [0, hy + 3.2, hz - 6]], [1.2, 1, 0.6, 0.35], lock, 0.35));
  }
  if (look.cap === 'leather') {
    const cap: Tones = LEATHER;
    const capY = hy + 2.2 * k;
    solids.push({
      cx: 0, cy: capY, cz: hz - 0.8, rx: 4.4 * k, ry: 2.6 * k, rz: 4.2 * k,
      material: (h) => (Math.abs(h.x) < 0.25 ? [STITCH, darker(STITCH), cap[1]] : Math.abs(h.x) < 0.6 ? [cap[1], darker(cap[1]), cap[0]] : h.y < capY - 0.9 * k ? [cap[2], cap[0], cap[2]] : cap),
    });
    for (const a of [-1.1, -0.5, 0.5, 1.1]) mark([Math.sin(a) * 4.5 * k, capY - 1.2 * k, hz - 0.8 + Math.cos(a) * 4.3 * k], IRON[2]);
  }
  if (look.cap === 'helm') {
    // A dented iron helm with a riveted band, a nose guard, cheek plates, and two curling horns.
    const helm = (h: Hit): Tones => (speck(h, 1.8) < 0.15 ? RUST : speck(h, 0.6) < 0.05 ? IRON : Math.abs(h.y - (hy + 1.2)) < 0.5 ? IRON : BLACK_IRON);
    solids.push({ cx: 0, cy: hy + 2.9 * k, cz: hz - 0.8, rx: 4.9 * k, ry: 3.2 * k, rz: 4.8 * k, material: helm });
    solids.push({ cx: 0, cy: hy + 2, cz: hz - 0.8, rx: 5.1 * k, ry: 0.7, rz: 5 * k, material: IRON });
    solids.push({ cx: 0, cy: hy + 5.6 * k, cz: hz - 0.8, rx: 0.7, ry: 1, rz: 4.6 * k, material: IRON });
    solids.push({ cx: 0, cy: hy + 0.4, cz: hz + 4.1 * k, rx: 0.7, ry: 1.8, rz: 0.6, material: IRON });
    for (let a = -2.6; a <= 2.6; a += 0.52) mark([Math.sin(a) * 5.2 * k, hy + 2, hz - 0.8 + Math.cos(a) * 5.1 * k], RIVET);
    for (const side of [-1, 1]) {
      solids.push({ cx: side * 3.6 * k, cy: hy - 1, cz: hz + 1.6, rx: 1.1, ry: 2.4, rz: 2.2, material: BLACK_IRON });
      mark([side * 4.75 * k, hy - 0.2, hz + 1.8], RIVET);
      mark([side * 4.75 * k, hy - 1.8, hz + 1.8], RIVET);
      const base: V3 = [side * 3.6 * k, hy + 3.6 * k, hz - 0.6];
      // Ridged horn: rings of darker bone along it.
      const horn = (h: Hit): Tones => (Math.floor((h.y - base[1]) * 1.6) % 2 ? BONE : [BONE[1], darker(BONE[1]), BONE[0]]);
      solids.push(...chain(
        [base, [base[0] + side * 2.6, base[1] + 2.2, base[2] - 0.6], [base[0] + side * 3.6, base[1] + 5, base[2] + 0.4], [base[0] + side * 3, base[1] + 7, base[2] + 1.6]],
        [1.3, 1, 0.7, 0.35],
        horn,
        0.3,
      ));
    }
    for (const x of [-2.6, 0, 2.6]) details.push({ x: x * k, y: hy + 1.2, z: hz + 4.4 * k, color: IRON[2] });
  }
  // A necklace of teeth and finger bones on a thong.
  if (look.bones) {
    for (let i = 0; i <= 12; i++) {
      const a = -1.15 + (i / 12) * 2.3;
      const p: V3 = [Math.sin(a) * 3.5 * w, 19.4 - b - Math.cos(a) * 1.3, sz + Math.cos(a) * 2.7];
      solids.push(i % 3 === 1 ? { ...knob(p, 0.45, BONE), ry: 0.9 } : knob(p, i % 3 ? 0.42 : 0.6, i % 3 ? TOOTH : BONE));
    }
  }

  // Eyes: slit-pupilled and yellow under the brow, deep in dark sockets; squeezed shut when hurt.
  const shut = body.shut || !!fx.blink;
  const socket = darker(darker(skin[1]));
  for (const side of [-1, 1]) {
    const ex = side * 1.95 * k;
    const out = side * 0.5;
    for (const [dx, dy] of [[-1, 1.4], [-0.5, 1.4], [0, 1.4], [0.5, 1.4], [1, 1.4], [1.3, 0.9], [-1.2, 0.6], [1.3, 0.4], [-0.5, 0], [0, 0], [0.5, 0]]) {
      mark(onFace(ex + dx * side, 0.6 + (dy - 0.7)), socket);
    }
    if (shut) {
      for (const dx of [-0.75, -0.25, 0.25, 0.75]) mark(onFace(ex + dx * side, 0.85), darker(skin[1]));
      continue;
    }
    // Upper row: white at the inner corner, the slit pupil, the iris, white at the outer corner.
    mark(onFace(ex - out * 1.5, 0.9), SCLERA);
    mark(onFace(ex - out * 0.5, 0.9), PUPIL);
    mark(onFace(ex + out * 0.5, 0.9), look.eye);
    mark(onFace(ex + out * 1.5, 0.9), SCLERA);
    // Lower row: the iris catching the light either side of the slit.
    mark(onFace(ex - out * 1.5, 0.4), look.eye);
    mark(onFace(ex - out * 0.5, 0.4), PUPIL);
    mark(onFace(ex + out * 0.5, 0.4), look.eye);
    mark(onFace(ex + out * 1.5, 0.4), darker(SCLERA));
    // A glint.
    if (side === -1) mark(onFace(ex + out * 0.5, 0.9, 0.25), GLINT);
  }

  // --- What it carries.
  solids.push(...weaponSolids(look.weapon, weaponHand, act, b, look, mark));
  if (look.torch) solids.push(...torchSolids(offHand, act, fx.phase ?? 0));
  if (look.shield) solids.push(...shieldSolids(offHand, act, w, mark));
  return { solids, details };
}

type Mark = (p: V3, color: number, size?: number) => void;

/** The weapon in the right hand. */
function weaponSolids(weapon: Weapon, h: V3, act: Act, b: number, look: GoblinLook, mark: Mark): Solid[] {
  const [x, y, z] = h;
  const w = look.bulk ?? 1;
  const blade = norm(BLADE[act]);
  /**
   * Which way a weapon `len` long points: as the act has it, unless that would
   * drive its head into the ground, when it swings up (keeping its heading) to
   * rest on the ground instead.
   */
  const aim = (len: number, floor = 1, want: V3 = blade): V3 => {
    if (y + want[1] * len >= floor) return want;
    const dy = Math.max(-1, (floor - y) / len);
    const flat = Math.hypot(want[0], want[2]) || 1;
    const k = Math.sqrt(Math.max(0, 1 - dy * dy)) / flat;
    return [want[0] * k, dy, want[2] * k];
  };
  let d = blade;
  switch (weapon) {
    case 'none':
      return [];
    case 'cleaver': {
      d = aim(6.4);
      // A notched, rusty butcher's cleaver on a bound wooden grip.
      const grip = (hh: Hit): Tones => (Math.floor((hh.x + hh.y + hh.z) * 2.6) % 2 ? DARK_WOOD : LEATHER);
      const out = limb(along(h, d, -0.8), along(h, d, 1.6), 0.5, 0.5, grip, 0.25);
      out.push(knob(along(h, d, -0.9), 0.55, IRON));
      // The blade: broad and flat, its edge bright, the spine notched and rusty.
      const rust = (hh: Hit): Tones => {
        const t = (hh.x - x) * d[0] + (hh.y - y) * d[1] + (hh.z - z) * d[2];
        if (speck(hh, 0.6) < 0.32) return RUST;
        return t > 5.6 ? [IRON[2], IRON[0], 0xe4e8f0] : IRON;
      };
      for (let i = 0; i <= 8; i++) {
        const t = 1.6 + (i / 8) * 4;
        const notch = i === 3 || i === 6 ? 0.7 : 1;
        out.push({ ...knob(along(h, d, t), 1, rust, true), rx: 0.45, ry: 1.7 * notch, rz: 1.7 * notch });
      }
      mark(along(h, d, 2.2), IRON[1]);
      return out;
    }
    case 'spear': {
      // A crude spear: a crooked shaft bound with thongs, a leaf-shaped iron head lashed on, a feather hanging under it.
      let butt: V3;
      let top: V3;
      if (act === 'rest') {
        butt = [x, 0.6, z - 0.4];
        top = [x, 33 - b, z + 1.4];
      } else {
        const sp = SPEAR[act];
        const dd = norm(sp.d);
        butt = along(h, dd, -sp.back);
        top = along(h, dd, sp.front);
      }
      const len = Math.hypot(top[0] - butt[0], top[1] - butt[1], top[2] - butt[2]);
      const dir: V3 = [(top[0] - butt[0]) / len, (top[1] - butt[1]) / len, (top[2] - butt[2]) / len];
      const at = (dd: number): V3 => along(top, dir, dd);
      const shaft = (hh: Hit): Tones => {
        const t = (hh.x - butt[0]) * dir[0] + (hh.y - butt[1]) * dir[1] + (hh.z - butt[2]) * dir[2];
        if (t > len - 3.4 && t < len - 1.2) return Math.floor(t * 3) % 2 ? LEATHER : [LEATHER[1], darker(LEATHER[1]), LEATHER[0]];
        return speck(hh, 0.7) < 0.1 ? [P.barkDark, darker(P.barkDark), P.bark] : WOOD;
      };
      const out: Solid[] = limb(butt, top, 0.5, 0.45, shaft, 0.35).map((p) => ({ ...p, soft: true }));
      const blade = (hh: Hit): Tones => (speck(hh, 0.6) < 0.2 ? RUST : IRON);
      out.push(...[0, 1, 2, 3, 4].map((i) => ({ ...knob(at(0.5 + i * 0.75), 1.1 - i * 0.2, blade), soft: true })));
      out.push(knob(at(4.3), 0.3, IRON));
      out.push({ ...knob(at(-0.6), 0.75, LEATHER), soft: true });
      const f = at(-1.6);
      out.push({ cx: f[0] + 0.8, cy: f[1] - 1.8, cz: f[2], rx: 0.4, ry: 1.6, rz: 0.7, material: (hh) => (hh.y < f[1] - 2.6 ? [0x2a201c, 0x1a1410, 0x3a2e28] : [0xb8402e, 0x822a1e, 0xd85a42]), soft: true });
      out.push({ cx: f[0] + 0.3, cy: f[1] - 1.4, cz: f[2] - 0.5, rx: 0.3, ry: 1.2, rz: 0.5, material: [0xe0d4b8, 0xb0a488, 0xf4ecd4], soft: true });
      return out;
    }
    case 'hatchet': {
      d = aim(6.2);
      const tip = along(h, d, 5);
      const out = limb(along(h, d, -0.6), tip, 0.5, 0.5, (hh) => (speck(hh, 0.5) < 0.12 ? DARK_WOOD : WOOD), 0.3);
      // The head: a wedge of black iron lashed on with gut, its edge bright.
      out.push({ cx: tip[0], cy: tip[1], cz: tip[2] + 1, rx: 0.5, ry: 1.4, rz: 1.6, material: (hh) => (hh.z > tip[2] + 1.8 ? [IRON[2], IRON[0], 0xe4e8f0] : speck(hh, 0.6) < 0.15 ? RUST : BLACK_IRON), soft: true });
      out.push(knob(along(h, d, 4.2), 0.6, LEATHER));
      return out;
    }
    case 'club': {
      // The Brute's club: a great knotted cudgel, bound at the grip, studded with nails.
      // Swung through, it comes down further forward than a goblin's blade: it's longer.
      if (act !== 'rest') d = aim(11 * w + 2.3, 2.4, act === 'follow' ? norm([0.5, -0.45, 0.75]) : blade);
      const end: V3 = act === 'rest' ? [x + 0.4, 1.4, z + 3.4] : along(h, d, 11 * w);
      const grain = (hh: Hit): Tones => (speck(hh, 0.6) < 0.12 ? [0x3e2a1a, 0x2a1c12, 0x5a3e28] : DARK_WOOD);
      const out = limb([x, y - 0.6, z + 0.4], end, 0.8, 2.1, grain, 0.35);
      out.push(...limb([x, y - 0.6, z + 0.4], lerp3([x, y - 0.6, z + 0.4], end, 0.2), 0.95, 1.1, (hh) => (Math.floor((hh.x + hh.y + hh.z) * 2.2) % 2 ? LEATHER : [LEATHER[1], darker(LEATHER[1]), LEATHER[0]]), 0.3));
      for (let i = 0; i < 14; i++) {
        const t = 0.45 + (i % 4) * 0.15 + 0.05;
        const a = i * 2.1;
        const c = lerp3([x, y, z], end, t);
        const r = 0.8 + t * 1.3;
        out.push(knob([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.4, c[2] + Math.sin(a) * r], 0.42, IRON));
      }
      out.push(knob(end, 2.3, grain));
      out.push(knob(lerp3([x, y, z], end, 0.62), 1.9, grain));
      return out;
    }
  }
}

/** A burning torch: a stick wrapped in pitch-soaked rag, flames licking up from it, different each frame. */
function torchSolids(h: V3, act: Act, phase: number): Solid[] {
  const [x, y, z] = h;
  const top: V3 = struck(act) ? [x - 1.4, y + 4, z - 1.6] : [x + 0.4, y + 5.6, z + 0.8];
  const out = limb([x, y - 2.4, z - 0.2], top, 0.5, 0.6, WOOD, 0.3);
  out.push(knob(top, 1.2, (hh) => (Math.floor(hh.y * 2.5) % 2 ? [0x3a2a22, 0x241a14, 0x54402e] : [0x5a3e2a, 0x3a2a1e, 0x74563a])));
  // Flames: a hot core, licks of orange, and tongues flaring off this way and that.
  const f = (n: number) => Math.sin(phase * 2.39996 + n);
  const lean = struck(act) ? 1.2 : act === 'strike' || act === 'follow' ? -0.8 : 0;
  out.push({ cx: top[0], cy: top[1] + 1.8, cz: top[2], rx: 1.3, ry: 2 + f(0) * 0.3, rz: 1.3, material: FLAME_CORE, soft: true });
  out.push({ cx: top[0] - 0.4 + f(1) * 0.5, cy: top[1] + 3.4 + f(2) * 0.4, cz: top[2] - 0.2 + lean * 0.5, rx: 1, ry: 2.2 + f(3) * 0.5, rz: 1, material: FLAME, soft: true });
  out.push({ cx: top[0] + 0.8 + f(4) * 0.4, cy: top[1] + 2.6, cz: top[2] + 0.4, rx: 0.7, ry: 1.6 + f(5) * 0.4, rz: 0.7, material: FLAME, soft: true });
  out.push({ cx: top[0] - 0.2 + f(6) * 0.8, cy: top[1] + 5.4 + f(7) * 0.8, cz: top[2] - 0.4 + lean, rx: 0.4, ry: 1, rz: 0.4, material: [P.fireRed, darker(P.fireRed), P.fireOrange], soft: true });
  if (f(8) > 0) out.push({ cx: top[0] + 0.6 + f(9), cy: top[1] + 6.6 + f(10), cz: top[2] + lean, rx: 0.3, ry: 0.5, rz: 0.3, material: FLAME, soft: true });
  return out;
}

/** A round shield of rough planks, nailed, rimmed and bossed with iron, a red eye daubed on its face. */
function shieldSolids(h: V3, act: Act, w: number, mark: Mark): Solid[] {
  const [x, y, z] = h;
  // Held in front of the off side, face forward (or flung wide when hurt).
  const c: V3 = struck(act) ? [x + 2, y - 0.6, z - 0.4] : [x + 1.4 * w, y - 0.8, z + 1.2];
  const r = 6.2 * w;
  const face = (hh: Hit): Tones => {
    const dx = hh.x - c[0];
    const dy = hh.y - c[1];
    const d = Math.hypot(dx, dy);
    if (d > r - 0.9) return speck(hh, 0.8) < 0.15 ? RUST : IRON;
    // The daubed eye: a red almond with a black slit, the paint flaking.
    const ex = dx / (r * 0.62);
    const ey = dy / (r * 0.3);
    if (ex * ex + ey * ey < 1 && speck(hh, 0.5) > 0.08) return Math.abs(dx) < 0.7 && Math.abs(dy) < r * 0.24 ? [0x241a14, 0x140e0a, 0x3a2a22] : [0xa82a1e, 0x781c14, 0xc84434];
    const plank = (dx + r) / 1.8;
    if (plank % 1 < 0.1) return [P.barkDark, darker(P.barkDark), P.bark];
    if (Math.floor(plank) % 2) return WOOD;
    return [P.barkLight, P.bark, 0xb08458];
  };
  const tilt = struck(act) ? 1.2 : 0.4;
  const out: Solid[] = [{ cx: c[0], cy: c[1], cz: c[2] + tilt, rx: r, ry: r, rz: 0.9, material: face }];
  out.push(knob([c[0], c[1], c[2] + 1.4 + tilt], 1.5 * w, IRON));
  // Rivets round the rim, and nails down the planks.
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) mark([c[0] + Math.cos(a) * (r - 0.45), c[1] + Math.sin(a) * (r - 0.45), c[2] + tilt + 0.9], RIVET);
  for (const dx of [-3.6, 3.6]) for (const dy of [-3.4, 3.4]) mark([c[0] + dx * w, c[1] + dy * w, c[2] + tilt + 0.9], BLACK_IRON[2]);
  return out;
}

// --- The goblins --------------------------------------------------------------

/** The cutter: olive green, a hide vest and a topknot, a scarred face, and a rusty cleaver. */
export const GOBLIN_CUTTER: GoblinLook = {
  skin: [0x7e9a42, 0x48601f, 0xa8c46a],
  mottle: [0x5e7430, 0x40521e, 0x7a9440],
  kilt: [0x6a5236, 0x4a3824, 0x86684a],
  vest: [0x5a4430, 0x3e2e20, 0x765a40],
  vestPaint: (h, base) => (Math.abs(h.x - h.y * 0.4 + 4) < 0.7 && h.nz > 0 ? LEATHER : speck(h, 1.2) < 0.08 ? [base[2], base[0], base[2]] : base),
  hair: [0x1e1a1c, 0x100e10, 0x343034],
  topknot: true,
  scar: true,
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
  ribs: true,
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
  // Studs on the coat, and mail showing at its edges: rows of rings, fine enough to read as rings.
  vestPaint: (h, base) => {
    if (speck(h, 1.6) < 0.12) return speck(h, 0.5) < 0.5 ? IRON : [RIVET, IRON[0], 0xffffff];
    if (h.y < 14.6 || Math.abs(h.nx) > 0.82) return (Math.floor(h.x * 2.2) + Math.floor(h.y * 2.6)) % 2 ? IRON : BLACK_IRON;
    return base;
  },
  cap: 'helm',
  armoured: true,
  bones: true,
  scar: true,
  eye: 0xff3a1e,
  weapon: 'club',
  shield: true,
  bulk: 1.35,
  hunch: 1.6,
};

/**
 * Snikkit, the goblin the militia caught after the raid (in the cells under the
 * garrison): a scrawny, sorry little cutter with nothing in its hands but iron
 * cuffs, its vest gone and its topknot coming apart, hunched over its belly.
 */
export const GOBLIN_CAPTIVE: GoblinLook = {
  skin: [0x86a04a, 0x4e6624, 0xaccc70],
  mottle: [0x647a34, 0x445620, 0x7e9846],
  kilt: [0x5e4a36, 0x40301f, 0x7a6248],
  hair: [0x1e1a1c, 0x100e10, 0x343034],
  ribs: true,
  eye: 0xffd23a,
  weapon: 'none',
  manacles: true,
  bulk: 0.9,
  hunch: 3.2,
};

/** Snikkit as townsfolk are drawn (see folk.ts), standing in the cell, for the 'folk-snikkit' figure. */
export function captiveGoblinModel(pose: Pose3D): Model {
  return goblinModel(pose, GOBLIN_CAPTIVE);
}

/**
 * The shaman who keeps the brood hall (see world/BroodHallMap.ts): old, bony and
 * hunched almost double, grey-green gone pale as a toad's belly, in a hood and
 * cape of black-dyed hide, white clay daubed across its face, and strings of
 * bones and teeth round its neck. It carries nothing: what it has is the orb.
 */
export const GOBLIN_SHAMAN: GoblinLook = {
  skin: [0x8a9a7a, 0x56624a, 0xb0bea0],
  mottle: [0x6e7c60, 0x4c5642, 0x8a9878],
  kilt: [0x3a3236, 0x262024, 0x524a4e],
  hood: [0x2e2a32, 0x1c1a20, 0x46404a],
  paint: [0xe8e4d8, 0xb8b4a8, 0xfffcf0],
  bones: true,
  ribs: true,
  eye: 0xc8a0ff,
  weapon: 'none',
  bulk: 0.85,
  hunch: 3.6,
};

/** The brood hall's shaman as townsfolk are drawn (see folk.ts), for the 'folk-shaman' figure. */
export function shamanGoblinModel(pose: Pose3D): Model {
  return goblinModel(pose, GOBLIN_SHAMAN);
}

export type GoblinKind = 'goblin' | 'goblinspear' | 'goblintorch' | 'goblinbrute';

export const GOBLIN_LOOKS: Record<GoblinKind, GoblinLook> = {
  goblin: GOBLIN_CUTTER,
  goblinspear: GOBLIN_SPEAR,
  goblintorch: GOBLIN_TORCH,
  goblinbrute: GOBLIN_BRUTE,
};

/** How much bigger than a common goblin the Brute is drawn. */
export const BRUTE_SIZE = 1.3;

/** How many times finer than they're shown the goblins' sheets are drawn (like the hero's, see fine3d.ts). */
export const GOBLIN_RES = 2;

/**
 * A goblin's frame as it's shown on screen: wide enough to fit it lying down.
 * The sheet itself is drawn {@link GOBLIN_RES} times as finely (see {@link goblinSpec}).
 */
export function goblinShownSpec(kind: GoblinKind): FrameSpec {
  return kind === 'goblinbrute' ? { w: 64, h: 64, feetY: 58, groundShade: 5, creases: true } : { w: 48, h: 48, feetY: 43, groundShade: 4, creases: true };
}

/** A goblin's frame as drawn: {@link goblinShownSpec}, GOBLIN_RES times finer, the feet on the same spot. */
export function goblinSpec(kind: GoblinKind): FrameSpec {
  const shown = goblinShownSpec(kind);
  const k = GOBLIN_RES;
  return { ...shown, w: shown.w * k, h: shown.h * k, feetY: (shown.feetY + 0.5) * k - 0.5, scale: k };
}

/**
 * The goblins' frames: the beasts' twelve (see BEAST_FRAME in beasts3d.ts:
 * 0-1 stand, 2-5 walk, 6-7 look about, 8 square up, 9 swing, 10 flinch, 11
 * down), then a fight's worth more.
 */
export const GOBLIN_FRAME = {
  ready: 8,
  strike: 9,
  hurt: 10,
  dead: 11,
  /** The weapon drawn back over the shoulder. */
  windup: 12,
  /** The blow carried through, low across the body. */
  follow: 13,
  /** Two more of the fighting crouch, bobbing on its toes. */
  ready2: 14,
  ready3: 15,
  /** Knocked back, arms flung wide. */
  reel: 16,
  /** Getting its feet back under it. */
  recover: 17,
  /** Dying: a stagger, then down on its knees, then slumped forward. */
  stagger: 18,
  kneel: 19,
  slump: 20,
  /** A jeer: weapon brandished overhead, mouth wide. */
  taunt: 21,
  /** Standing about: a blink with an ear twitch, and a deep breath. */
  blink: 22,
  breathe: 23,
} as const;

export const GOBLIN_COLS = 24;

/** Every solid and detail scaled up about the feet. */
function grown(m: Model, k: number): Model {
  if (k === 1) return m;
  const mat = (mm: Material): Material => (typeof mm === 'function' ? (h: Hit) => mm({ ...h, x: h.x / k, y: h.y / k, z: h.z / k }) : mm);
  return {
    solids: m.solids.map((s) => ({ ...s, cx: s.cx * k, cy: s.cy * k, cz: s.cz * k, rx: s.rx * k, ry: s.ry * k, rz: s.rz * k, material: mat(s.material) })),
    details: m.details.map((d) => ({ ...d, x: d.x * k, y: d.y * k, z: d.z * k })),
  };
}

/** The sheet's frames in order (see {@link GOBLIN_FRAME}). */
export function goblinSheet(kind: GoblinKind): BeastSheet {
  const look = GOBLIN_LOOKS[kind];
  const k = kind === 'goblinbrute' ? BRUTE_SIZE : 1;
  let phase = 0;
  const at = (p: Pose3D, act?: Act, fx: Flicker = {}) => grown(goblinModel(p, look, act, { phase: phase++, ...fx }), k);
  const walk: Pose3D[] = [
    { stride: 1, bob: 0.7 },
    { stride: 0, bob: 0 },
    { stride: -1, bob: 0.7 },
    { stride: 0, bob: 0 },
  ];
  const models: Model[] = [
    at({ stride: 0, bob: 0 }),
    at({ stride: 0, bob: 0.6 }),
    ...walk.map((p) => at(p)),
    // Looking about: crouched lower, weapon ready, sniffing the air.
    at({ stride: 0.3, bob: 1.2 }, 'ready', { ears: 0.6 }),
    at({ stride: 0.3, bob: 1.6 }, 'ready', { ears: -0.4 }),
    at({ stride: 0, bob: 0.4 }, 'ready'),
    at({ stride: 0, bob: 0.6 }, 'strike'),
    at({ stride: 0, bob: 0.8 }, 'hurt'),
    // Sprawled on its back.
    grown(onItsSide(goblinModel({ stride: 0, bob: 0 }, look, 'hurt'), 14, 4.4), k),
    // 12-13: the wind-up and the follow-through, either side of the swing.
    at({ stride: 0, bob: 0.2 }, 'windup'),
    at({ stride: 0, bob: 1.2 }, 'follow'),
    // 14-15: the fighting crouch, bobbing.
    at({ stride: 0, bob: 1 }, 'ready', { ears: -0.5 }),
    at({ stride: 0, bob: 0.7 }, 'ready', { ears: 0.4 }),
    // 16-17: knocked back, and recovering.
    at({ stride: 0, bob: 0.4 }, 'reel'),
    at({ stride: 0, bob: 1.4 }, 'ready', { blink: true, ears: -0.8 }),
    // 18-20: dying.
    at({ stride: 0, bob: 1.2 }, 'reel'),
    at({ stride: 0, bob: 3.4 }, 'hurt'),
    at({ stride: 0, bob: 4.6 }, 'slump'),
    // 21: the jeer.
    at({ stride: 0, bob: -0.2 }, 'taunt'),
    // 22-23: standing about.
    at({ stride: 0, bob: 0.3 }, 'rest', { blink: true, ears: 1.2 }),
    at({ stride: 0, bob: -0.3 }, 'rest', { ears: -0.3 }),
  ];
  return { spec: goblinSpec(kind), models };
}

/** A frame `f` held for `ms` milliseconds. */
const held = (f: number, ms: number) => ({ f, ms });

/**
 * The goblins' animations beyond walking: idle (shuffling, blinking, breathing),
 * ready (the fighting crouch), attack (wind-up, blow, follow-through), hit (reel
 * and recover), die (stagger, knees, slump, down), and taunt.
 */
export const GOBLIN_ANIMS: Record<string, BeastAnim> = {
  idle: { frames: [held(0, 700), held(1, 650), held(0, 600), held(22, 140), held(0, 500), held(1, 650), held(23, 700), held(1, 500)], repeat: -1 },
  sniff: { frames: [held(6, 380), held(7, 420), held(6, 300), held(22, 140), held(6, 360), held(7, 380)], repeat: -1 },
  ready: { frames: [held(8, 260), held(14, 240), held(15, 220), held(14, 240)], repeat: -1 },
  attack: { frames: [held(12, 150), held(9, 120), held(13, 230)], repeat: 0 },
  hit: { frames: [held(16, 110), held(10, 140), held(17, 160)], repeat: 0 },
  die: { frames: [held(18, 160), held(19, 220), held(20, 260), held(11, 1)], repeat: 0 },
  taunt: { frames: [held(21, 220), held(8, 140), held(21, 260), held(14, 200)], repeat: 0 },
};

/** The goblins' fighting sheets ('creature-<kind>'). */
export function generateGoblins(scene: Phaser.Scene): void {
  generateBeast(scene, 'goblin', goblinSheet('goblin'), 10, GOBLIN_ANIMS);
  generateBeast(scene, 'goblinspear', goblinSheet('goblinspear'), 9, GOBLIN_ANIMS);
  generateBeast(scene, 'goblintorch', goblinSheet('goblintorch'), 10, GOBLIN_ANIMS);
  generateBeast(scene, 'goblinbrute', goblinSheet('goblinbrute'), 7, GOBLIN_ANIMS);
}
