import Phaser from 'phaser';
import { darker, type Tones } from './character';
import { BeastAnim, BeastSheet, chain, generateBeast, onItsSide, speck, V3 } from './beasts3d';
import { Detail, FrameSpec, Hit, limb, Material, Model, Pose3D, Solid } from './figure3d';

/**
 * The Mere-kin: the lizard folk of the fen beyond Gloomhaven's Fen Gate (one
 * of them is first seen watching the hero from a pool on the Fen Road, see
 * art/fenroad.ts), modelled in 3D and drawn finely on a fighting sheet like the
 * goblins' and the brigands' (see {@link MERE_FRAME}), so they can stalk,
 * square up, wind up, strike, reel, go down and hiss in a fight.
 *
 * They're about as tall as a man, though they stand stooped: long bent legs
 * on three-toed clawed feet, a heavy tail down to the ground behind, a deep
 * chest, long arms with three clawed fingers, and a long flat head with a
 * snout full of teeth. Their hide is small scales in offset rows, each rimmed
 * darker along its lower edge, with chevron bands down the back; the belly is
 * plated, the plates grooved; the eyes are gold with a black ring and a slit
 * pupil; a crest of spines runs from the crown down the neck, and a frill of
 * skin at the jaw flares when they hiss. Mere-weed hangs off their shoulders
 * and water drips from them.
 *
 * They're a tribe, and dress like one: a skirt of hide or plaited reed on a
 * cord, necklaces of teeth and shells, clay and ochre paint, a bone or shell
 * on the shoulder, and weapons of bone, stone and old green bronze. Six sorts
 * come out of the water:
 *
 * - the spear-hunter (the watcher's own colours), with a bone-tipped spear;
 * - the harpooner, brown and banded, who throws barbed harpoons and carries
 *   more in a quiver of reed on its back;
 * - the shield-bearer, blue-green, with a leaf-bladed bronze sword and a shield
 *   made from a great turtle's shell;
 * - the axeman, near black with a pale belly and white clay paint, with a
 *   knapped flint axe;
 * - the hookhand, sandy and speckled like a heath lizard, with a bronze hook
 *   in each hand to drag its prey down;
 * - and the war-chief, half a head taller and twice as heavy, dark as bog
 *   water, a crimson crest, plates of turtle shell on its shoulders, a pike's
 *   skull on its head, and a great crescent axe of bronze.
 */

/** What one is doing, in a fight: how the weapon arm goes and the body leans. */
type Act = 'rest' | 'ready' | 'windup' | 'strike' | 'follow' | 'hurt' | 'reel' | 'taunt' | 'slump';

type Weapon = 'spear' | 'harpoon' | 'sword' | 'axe' | 'hooks' | 'greataxe';

/** The little things that change from frame to frame of a loop. */
interface Flicker {
  /** The eyes filmed over by the third lid, in a blink. */
  blink?: boolean;
  /** The forked tongue flicked out. */
  tongue?: boolean;
  /** The frill flared wide (0 to 1), beyond what the act already does. */
  frill?: number;
  /** Which way the tail tip is swinging (-1 to 1), beyond the act's own. */
  tail?: number;
  /** Water running off: drips under the chin, the hands and the tail. */
  drip?: number;
}

/** How one of the Mere-kin is made up. */
export interface MereLook {
  /** The scales of the back and flanks. */
  back: Tones;
  /** The darker scales among them, and the rims under each. */
  dark: Tones;
  /** The plated belly and the throat. */
  belly: Tones;
  /** The chevrons down the back and the tail. */
  band: Tones;
  /** The crest's spines and the jaw frill. */
  frill: Tones;
  eye: number;
  weapon: Weapon;
  /** A turtle-shell shield on the off arm. */
  shield?: boolean;
  /** A quiver of harpoons on the back. */
  quiver?: boolean;
  /** Clay or ochre paint, and how it's put on. */
  paint?: Tones;
  paintStyle?: 'stripes' | 'dots' | 'mask';
  /** The skirt: hide, or plaited reed. */
  skirt: Tones;
  reedSkirt?: boolean;
  necklace?: 'teeth' | 'shells' | 'bones';
  /** On the shoulders: a jawbone on the weapon side, or plates of turtle shell on both. */
  pauldron?: 'bone' | 'shell';
  /** On the head: a few heron feathers in the crest, or a pike's skull. */
  headdress?: 'feathers' | 'skull';
  /** Copper rings on the arms, green with age. */
  armbands?: boolean;
  /** How much bigger it is than the rest, and how much broader for its size. */
  size?: number;
  bulk?: number;
}

// --------------------------------------------------------------- colours

const BONE: Tones = [0xd8d0b8, 0xa8a08a, 0xf0e8d0];
const OLD_BONE: Tones = [0xbcae8c, 0x8a7e62, 0xd8cca8];
const TOOTH: Tones = [0xece4cc, 0xbcb498, 0xfffaea];
const CLAW: Tones = [0x2a241e, 0x1a1612, 0x463c30];
const SHAFT: Tones = [0x4a3a28, 0x30261a, 0x66523a];
const BLACK_SHAFT: Tones = [0x2e2620, 0x1c1814, 0x463a30];
const CORD: Tones = [0x9a8a5a, 0x6e6240, 0xb8a878];
const REED: Tones = [0xa89858, 0x7a6c3c, 0xc8b878];
const BRONZE: Tones = [0x86683a, 0x5a4424, 0xae8a4e];
const VERDIGRIS: Tones = [0x5a9a7e, 0x3a6a56, 0x7cc0a0];
const FLINT: Tones = [0x5a5a62, 0x3a3a42, 0x8a8a96];
const FLINT_EDGE: Tones = [0x9a9aa6, 0x6a6a76, 0xc8c8d4];
const SHELL: Tones = [0x6a5a36, 0x463a22, 0x8a7848];
const SHELL_LIGHT: Tones = [0x9a8450, 0x6a5a36, 0xbaa468];
const SHELL_SEAM: Tones = [0x2e2618, 0x1e1810, 0x463a26];
const WEED: Tones = [0x4a5a2a, 0x2e3a1a, 0x6a7a3a];
const WEED_BROWN: Tones = [0x5a4a24, 0x3a3018, 0x7a6634];
const MOUTH: Tones = [0x6a2a2a, 0x441818, 0x8a3a3a];
const TONGUE: Tones = [0x5a3a5e, 0x3a2440, 0x7a5280];
const FEATHER: Tones = [0xd8d8d0, 0xa0a098, 0xf4f4ec];
const FEATHER_TIP = 0x2a2a2e;
const PUPIL = 0x0c0a08;
const RING = 0x14120e;
const GLINT = 0xfffbe8;
const MEMBRANE = 0xb8c0a8;
const DRIP = 0xbcd8e0;
const SHELL_BEAD = 0xe8e0d0;

const lit = (t: Tones): Tones => [t[2], t[0], t[2]];
const dim = (t: Tones): Tones => [t[1], darker(t[1]), t[0]];
const knob = (p: V3, r: number, material: Material, soft = false): Solid => ({ cx: p[0], cy: p[1], cz: p[2], rx: r, ry: r, rz: r, material, soft });
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const along = (p: V3, d: V3, k: number): V3 => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const frac = (n: number) => n - Math.floor(n);

/** Two directions square to `d` and to each other, for laying something flat along it. */
function across(d: V3, up: V3 = [1, 0, 0]): [V3, V3] {
  let a = cross(d, up);
  if (Math.hypot(a[0], a[1], a[2]) < 0.1) a = cross(d, [0, 0, 1]);
  a = norm(a);
  return [a, norm(cross(d, a))];
}

// --------------------------------------------------------------- poses

/**
 * How the body sits for each act: the lean forward at the shoulders (on top of
 * its stoop), the stance (stride, the leading foot), how low it crouches, how
 * far the head drops, the jaws open (0 to 1), the frill flared (0 to 1), eyes
 * screwed shut, and which way the tail swings.
 */
const BODY: Record<Act, { lean: number; stance: number | null; crouch: number; head: number; open: number; frill: number; shut: boolean; tail: number }> = {
  rest: { lean: 0, stance: null, crouch: 0, head: 0, open: 0, frill: 0, shut: false, tail: 0 },
  ready: { lean: 1.4, stance: 0.8, crouch: 1.4, head: -0.2, open: 0.25, frill: 0.3, shut: false, tail: 0.3 },
  windup: { lean: -1.2, stance: 0.9, crouch: 1, head: 0.4, open: 0.8, frill: 0.9, shut: false, tail: -0.8 },
  strike: { lean: 3, stance: 1.1, crouch: 2, head: -0.6, open: 1, frill: 0.7, shut: false, tail: 1 },
  follow: { lean: 3.8, stance: 1.2, crouch: 2.4, head: -1, open: 0.4, frill: 0.3, shut: false, tail: 0.6 },
  hurt: { lean: -2.2, stance: -0.5, crouch: 1, head: 0.6, open: 0.7, frill: 0.5, shut: true, tail: -0.5 },
  reel: { lean: -3.6, stance: -1, crouch: 1.4, head: 0.9, open: 1, frill: 0.8, shut: true, tail: -1 },
  taunt: { lean: -0.6, stance: 0.5, crouch: 0.4, head: 0.8, open: 1, frill: 1, shut: false, tail: 0.8 },
  slump: { lean: 4.6, stance: 0, crouch: 7, head: -1.6, open: 0.3, frill: 0, shut: true, tail: 0 },
};

/** Where the weapon arm's elbow and hand go for each act: x out from the body (times its side), y up, z forward of the shoulder. */
const WEAPON_ARM: Record<Act, { elbow: V3; hand: V3 }> = {
  rest: { elbow: [6.4, 21.6, 0.4], hand: [6.8, 17.4, 1.4] },
  ready: { elbow: [7.2, 21.4, 2.2], hand: [6, 22.8, 5.8] },
  windup: { elbow: [7.6, 27.6, -1.8], hand: [5.8, 32.6, -3.2] },
  strike: { elbow: [5.8, 24, 4.2], hand: [3.4, 21.4, 8.4] },
  follow: { elbow: [5, 19.4, 4.6], hand: [1.6, 15, 7.2] },
  hurt: { elbow: [7.6, 20.4, -1.4], hand: [9.2, 16.8, -2.2] },
  reel: { elbow: [8.2, 23, -2.6], hand: [10.2, 25.6, -4] },
  taunt: { elbow: [7.8, 28.8, 0.8], hand: [6.6, 34.6, 1.8] },
  slump: { elbow: [6.2, 15.6, 2.2], hand: [6.4, 10, 3.8] },
};

/** The harpooner's throwing arm: drawn back high, flung forward, and empty after the throw. */
const THROW_ARM: Partial<Record<Act, { elbow: V3; hand: V3 }>> = {
  ready: { elbow: [7.4, 24.6, -0.6], hand: [6.4, 29.2, 0.6] },
  windup: { elbow: [7.8, 27.8, -3.4], hand: [6.4, 31.6, -6.4] },
  strike: { elbow: [6, 27, 3.2], hand: [4, 29, 8] },
  follow: { elbow: [5.2, 22, 5.2], hand: [2.4, 18.6, 9.6] },
};

/** Which way a blade or an axe's head points from the hand, by act. */
const BLADE: Record<Act, V3> = {
  rest: [0.06, -0.9, 0.42],
  ready: [0.05, 0.96, 0.28],
  windup: [0.1, 0.55, -0.82],
  strike: [0.25, -0.25, 0.94],
  follow: [0.45, -0.82, 0.32],
  hurt: [-0.1, -0.98, 0.1],
  reel: [-0.3, 0.45, -0.84],
  taunt: [0.05, 0.96, 0.25],
  slump: [0.1, -0.95, 0.3],
};

/** How a spear or harpoon lies, by act: its line through the hand (butt to point), and how far it runs behind and ahead of the grip. */
const SPEAR: Record<Act, { d: V3; back: number; front: number }> = {
  rest: { d: [0, 1, 0.04], back: 17, front: 9 },
  ready: { d: [-0.04, 0.72, 0.69], back: 11, front: 14 },
  windup: { d: [0, 0.3, 0.95], back: 16, front: 9 },
  strike: { d: [0.06, -0.05, 0.99], back: 10, front: 12 },
  follow: { d: [0.1, -0.2, 0.97], back: 9, front: 12.5 },
  hurt: { d: [-0.15, 0.95, -0.25], back: 10, front: 12 },
  reel: { d: [-0.2, 0.8, -0.55], back: 10, front: 12 },
  taunt: { d: [0, 0.98, 0.15], back: 9, front: 16 },
  slump: { d: [0.1, -0.45, 0.9], back: 5, front: 13 },
};

/** The thrown harpoon, by act: its line through the hand, and how far it runs behind and ahead of the grip (behind < 0: it's left the hand). */
const HARPOON: Partial<Record<Act, { d: V3; back: number; front: number }>> = {
  ready: { d: [0, 0.2, 0.98], back: 8, front: 8 },
  windup: { d: [0, 0.32, 0.95], back: 10, front: 6 },
  strike: { d: [0, -0.02, 1], back: -1, front: 12.5 },
};

const struck = (act: Act) => act === 'hurt' || act === 'reel' || act === 'slump';

// --------------------------------------------------------------- the hide

/** A hash of a cell, 0 to 1. */
function cell(u: number, v: number): number {
  const n = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * The scaled hide: small scales in offset rows, each with a dark rim along its
 * lower edge, some darker, a few with a wet sheen; chevron bands down the back;
 * and a paler underside.
 */
function hideOf(look: MereLook, w: number) {
  const rim: Tones = [darker(look.dark[1]), darker(darker(look.dark[1])), look.dark[1]];
  const scale = (h: Hit, bands = true): Tones => {
    // The underside of a limb or the tail: the belly's colour.
    if (h.ny < -0.55) return (Math.floor(h.y * 2 + h.z * 2) & 1) === 0 ? look.belly : dim(look.belly);
    // Chevrons down the back: the band runs in a V, its point down the spine.
    if (bands && h.nz < -0.15 && frac((h.y + Math.abs(h.x) * 0.9 - h.z * 0.4) / 4.6) < 0.24) {
      const v = Math.floor(h.y * 1.8);
      return frac(h.y * 1.8) < 0.2 ? rim : cell(Math.floor(h.x * 1.8 + (v & 1) * 0.5), v) > 0.8 ? lit(look.band) : look.band;
    }
    // Each scale's rounded lower edge, dark, and a lighter crown on its upper half where the wet catches it.
    const v = Math.floor(h.y * 1.9);
    const fu = h.x * 1.9 + h.z * 0.9 * (h.nx >= 0 ? 1 : -1) + (v & 1) * 0.5;
    const u = Math.floor(fu);
    const fv = h.y * 1.9 - v;
    const cu = fu - u - 0.5;
    if (fv < 0.1 + cu * cu * 0.7 || Math.abs(cu) > 0.46) return rim;
    const r = cell(u, v);
    if (fv > 0.72 && Math.abs(cu) < 0.22 && r > 0.35) return lit(look.back);
    if (r > 0.92) return [look.back[2], look.back[0], 0xc8d8c0];
    if (r < 0.24 || speck(h, 2.4) < 0.12) return look.dark;
    return look.back;
  };
  /** The belly's plates: broad bands across the front, a groove between each. */
  const plates = (h: Hit, top: number, bottom: number, half: number): Tones | null => {
    if (h.nz < 0.42 || Math.abs(h.x) > half * w || h.y > top || h.y < bottom) return null;
    const row = (h.y - bottom) / 1.35;
    if (frac(row) < 0.16 || Math.abs(Math.abs(h.x) - half * w) < 0.3) return [0x7a7650, 0x56523a, look.belly[1]];
    return (Math.floor(row) & 1) === 0 ? look.belly : [look.belly[0], look.belly[1], lit(look.belly)[0]];
  };
  return { scale, plates, rim };
}

// --------------------------------------------------------------- the model

/**
 * One of the Mere-kin in one pose. Body space as everywhere: x across (to
 * screen-right facing us), y up, z the way it faces. `act` sets the weapon arm
 * and how the body leans and crouches for a fight.
 */
export function mereModel(pose: Pose3D, look: MereLook, act: Act = 'rest', fx: Flicker = {}): Model {
  const body = BODY[act];
  const w = look.bulk ?? 1;
  const b = pose.bob + body.crouch * 0.55;
  const s = body.stance ?? pose.stride;
  const solids: Solid[] = [];
  const details: Detail[] = [];
  const mark = (p: V3, color: number, size = 0.5) => details.push({ x: p[0], y: p[1], z: p[2], color, size });
  const { scale, plates } = hideOf(look, w);
  /** The stoop, and the lean on top of it: nothing at the hips, all of it at the shoulders. */
  const lean = (y: number) => (2.6 + body.lean) * Math.max(0, (y - 14) / 13);
  const kneel = act === 'slump';
  const drip = fx.drip ?? 0;

  /** Paint on the hide where the look has it. */
  const painted = (h: Hit, base: Tones, where: 'arm' | 'chest' | 'face'): Tones => {
    const p = look.paint;
    if (!p) return base;
    if (look.paintStyle === 'dots') return speck(h, 1.1) < 0.1 && h.nz > -0.2 && where !== 'face' ? p : base;
    if (look.paintStyle === 'mask') return where === 'face' ? p : base;
    // Stripes: bands round the upper arm, slashes across the chest.
    if (where === 'arm') return frac(h.y / 2.2) < 0.32 ? p : base;
    if (where === 'chest') return h.nz > 0.3 && frac((h.y - Math.abs(h.x) * 0.7) / 3) < 0.22 ? p : base;
    return base;
  };

  // --- Legs: long and bent, the thigh forward and the shin back, up on three long clawed toes.
  for (const side of [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 && act === 'rest' ? 1.2 : 0;
    const hip: V3 = [side * 2.8 * w, 14.6 - b * 0.55, 0];
    let knee: V3;
    let ankle: V3;
    if (kneel) {
      knee = [side * 3 * w, 1.8, 3.4];
      ankle = [side * 3 * w, 1.6, -3.4 + swing];
    } else {
      knee = [side * 3.3 * w, 9.4 + lift - body.crouch * 0.35, 3 + swing * 2 + body.crouch * 0.5];
      ankle = [side * 3 * w, 3.8 + lift, -1.4 + swing * 2.4];
    }
    solids.push(...chain([hip, knee], [2.7 * w, 2 * w], (h) => scale(h, false), 0.45));
    solids.push(knob(knee, 1.9 * w, (h) => scale(h, false)));
    solids.push(...chain([knee, ankle], [1.8 * w, 1.25 * w], (h) => scale(h, false), 0.45));
    // A ridge of bigger scales down the front of the shin.
    for (let i = 1; i < 5; i++) {
      const p = lerp3(knee, ankle, i / 5);
      solids.push({ cx: p[0], cy: p[1], cz: p[2] + 1.4 * w - i * 0.05, rx: 0.7, ry: 0.8, rz: 0.5, material: look.dark });
    }
    // Three long toes splayed forward, a black claw on each, and a spur behind.
    const foot = kneel ? [ankle[0], 0.9, ankle[2] - 1] : [ankle[0], 1.3 + lift, ankle[2]];
    for (const t of [-1, 0, 1]) {
      const root: V3 = [foot[0] + t * 0.6 * w, foot[1] + 0.2, foot[2] + 0.6];
      const toe: V3 = kneel
        ? [foot[0] + t * 1.2 * w, 0.6, foot[2] - 2.6]
        : [foot[0] + t * 1.5 * w, 0.6 + lift, foot[2] + 3.8 * w - Math.abs(t) * 0.6];
      solids.push(...chain([[foot[0], foot[1] + 0.3, foot[2]], root, toe], [1.1 * w, 0.85 * w, 0.55 * w], (h) => scale(h, false), 0.35));
      const dir = norm([toe[0] - root[0], toe[1] - root[1], toe[2] - root[2]]);
      solids.push(...limb(toe, along(toe, [dir[0], dir[1] - 0.4, dir[2]], 1.2), 0.45, 0.12, CLAW, 0.2));
    }
    if (!kneel) solids.push(...limb([foot[0], foot[1] + 0.2, foot[2] - 0.8], [foot[0], 0.4 + lift, foot[2] - 2.2], 0.5, 0.15, CLAW, 0.2));
  }

  // --- The tail: thick at the hips, down to the ground behind and curling, swinging with the fight.
  const swingTail = body.tail + (fx.tail ?? 0) + pose.stride * 0.4;
  let prev: V3 = [0, 13.4 - b * 0.5, -2.4];
  const tailPts: V3[] = [prev];
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    const drop = kneel ? 13.4 - b * 0.5 - t * 12 : 13.4 - t * 12.6 - b * 0.5 * (1 - t);
    const next: V3 = [Math.sin(t * 2.2) * (2.2 + swingTail * 3.2 * t), Math.max(0.9, drop), -2.4 - t * 14 + Math.abs(swingTail) * t * t * 2];
    tailPts.push(next);
    solids.push(...limb(prev, next, (3 - (i - 1) * 0.17) * w, (3 - i * 0.17) * w, (h) => scale(h), 0.5));
    // A row of low spines along the top, smaller towards the tip.
    if (i % 2 === 0 && i < 14) solids.push({ cx: next[0], cy: next[1] + (2.6 - i * 0.16) * w, cz: next[2], rx: 0.35, ry: 0.9 - i * 0.04, rz: 0.9, material: i % 4 ? look.dark : look.frill });
    prev = next;
  }
  const tip = tailPts[tailPts.length - 1];
  if (drip > 0) mark([tip[0], tip[1] - 0.6, tip[2]], DRIP, 0.6);

  // --- The body: a narrow waist, a deep chest, hunched; the belly plated.
  const by = (y: number) => y - b;
  const torso = (h: Hit): Tones => plates(h, by(27), by(13.2), 2.8) ?? painted(h, scale(h), 'chest');
  solids.push({ cx: 0, cy: by(16), cz: 0.4, rx: 4.4 * w, ry: 3.2, rz: 3.6 * w, material: torso });
  solids.push({ cx: 0, cy: by(19.8), cz: lean(19.8) + 0.4, rx: 4.3 * w, ry: 3.4, rz: 3.4 * w, material: torso });
  solids.push({ cx: 0, cy: by(24), cz: lean(24) + 0.6, rx: 5.8 * w, ry: 4.4, rz: 4.5 * w, material: torso });
  // Ribs showing under the scales of the flanks, and a ridge of spines down the back.
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const y = by(30.2 - t * 15.6);
    solids.push({ cx: 0, cy: y, cz: lean(30.2 - t * 15.6) - (4.2 - t * 0.6) * w, rx: 0.4, ry: 1.3 - t * 0.5, rz: 1.5 - t * 0.5, material: i % 2 ? look.dark : look.frill });
  }

  // --- What it wears: a skirt on a cord, a pouch, and whatever it hangs round its neck.
  const cordY = by(16.8);
  solids.push({ cx: 0, cy: cordY, cz: 0.5, rx: 4.65 * w, ry: 0.55, rz: 3.85 * w, material: (h) => (Math.floor((h.x + h.z) * 3) & 1 ? CORD : dim(CORD)) });
  const skirt = (h: Hit): Tones => {
    if (look.reedSkirt) return frac((Math.atan2(h.x, h.z) + Math.PI) * 9) < 0.18 ? dim(look.skirt) : speck(h, 0.8) < 0.1 ? lit(look.skirt) : look.skirt;
    if (speck(h, 1.3) < 0.1) return dim(look.skirt);
    return h.y < cordY - 4.6 ? lit(look.skirt) : look.skirt;
  };
  // A flap before and behind, swinging with the stride, ragged at the hem; plaited reed hangs all round.
  if (look.reedSkirt) {
    for (let y = 11.2; y <= 16.4; y += 0.5) {
      const t = (16.4 - y) / 5.2;
      solids.push({ cx: 0, cy: y - b * 0.55, cz: 0.4 + s * 0.4 * t, rx: (4.7 + t * 0.9) * w, ry: 0.8, rz: (3.9 + t * 0.7) * w, material: skirt });
    }
  } else {
    for (const front of [1, -1]) {
      for (let y = 10.6; y <= 16.2; y += 0.5) {
        const t = (16.2 - y) / 5.6;
        const ragged = Math.sin(y * 7.1 + front) > 0.6 ? 0.6 : 0;
        solids.push({ cx: 0, cy: y - b * 0.55, cz: front * (3.6 * w + t * 0.6) + s * 0.6 * t, rx: 2.8 * w - ragged, ry: 0.8, rz: 0.7, material: skirt });
      }
    }
  }
  const pouch: V3 = [3.8 * w, by(14.6), 2.4 * w];
  solids.push({ cx: pouch[0], cy: pouch[1], cz: pouch[2], rx: 1.4, ry: 1.8, rz: 1.1, material: (h) => (h.y > pouch[1] + 0.8 ? dim(look.skirt) : look.skirt) });
  mark([pouch[0], pouch[1] + 0.6, pouch[2] + 1.1], BONE[0]);

  // Mere-weed hanging off the shoulders and down the back.
  for (const [x, z, len, brown] of [[-4.4, -1, 5.4, 0], [3.6, -2.4, 4.2, 1], [-1.6, -3.8, 6, 1], [5, 0.8, 3.2, 0]] as const) {
    const top: V3 = [x * w, by(27.4), lean(27.4) + z * w];
    const end: V3 = [x * w * 1.05 + Math.sin(x) * 0.6, by(27.4 - len), lean(27.4 - len) + z * w - 0.6 + s * 0.3];
    solids.push(...limb(top, end, 0.55, 0.3, brown ? WEED_BROWN : WEED, 0.4).map((p) => ({ ...p, soft: true })));
    if (drip > 0.5) mark([end[0], end[1] - 0.8, end[2]], DRIP, 0.55);
  }

  // --- Arms: long, scaled, three clawed fingers and a thumb on each hand.
  const shoulderY = by(26.8);
  const sz = lean(26.8) + 0.6;
  let weaponHand: V3 = [0, 0, 0];
  let offHand: V3 = [0, 0, 0];
  const two = look.weapon === 'greataxe';
  for (const side of [-1, 1]) {
    const weapon = side === -1;
    const shoulder: V3 = [side * 5.6 * w, shoulderY, sz];
    const at = (p: V3): V3 => [side * p[0] * w, p[1] - b, sz + p[2]];
    const swing = act === 'rest' ? -s * side * 2 : 0;
    let elbow: V3;
    let hand: V3;
    const thrower = look.weapon === 'harpoon' && THROW_ARM[act];
    if (weapon && thrower) {
      elbow = at(thrower.elbow);
      hand = at(thrower.hand);
    } else if (weapon) {
      elbow = at(WEAPON_ARM[act].elbow);
      hand = at(WEAPON_ARM[act].hand);
      if (act === 'rest') {
        elbow = [elbow[0], elbow[1], elbow[2] + swing * 0.4];
        hand = [hand[0], hand[1], hand[2] + swing * 0.6];
      }
    } else if (two && !struck(act)) {
      // Both hands on the haft, the off hand lower down.
      const wa = WEAPON_ARM[act];
      const right: V3 = [-wa.hand[0] * w, wa.hand[1] - b, sz + wa.hand[2]];
      const d = act === 'rest' ? norm([0.1, -0.8, 0.6]) : norm(BLADE[act]);
      hand = along(right, d, -4);
      hand[0] = Math.max(hand[0], 1.6 * w);
      elbow = lerp3(shoulder, hand, 0.5);
      elbow = [elbow[0] + 2 * w, elbow[1] - 1.6, elbow[2] - 0.4];
    } else if (look.weapon === 'hooks') {
      // The second hook, a beat behind the first.
      const mirror: Record<Act, Act> = { rest: 'rest', ready: 'ready', windup: 'ready', strike: 'windup', follow: 'strike', hurt: 'hurt', reel: 'reel', taunt: 'windup', slump: 'slump' };
      const wa = WEAPON_ARM[mirror[act]];
      elbow = at(wa.elbow);
      hand = at(wa.hand);
      if (act === 'rest') {
        elbow = [elbow[0], elbow[1], elbow[2] - swing * 0.4];
        hand = [hand[0], hand[1], hand[2] - swing * 0.6];
      }
    } else if (look.shield) {
      // The shield held before the body (flung wide when struck).
      elbow = at([6.8, 21.2, 2]);
      hand = struck(act) && act !== 'slump' ? at([8.6, 19, -0.6]) : act === 'slump' ? at([6, 11, 3.4]) : act === 'windup' ? at([4.6, 23.6, 6]) : act === 'rest' ? at([5.6, 19.2, 3.6]) : at([3.8, 22.4, 6.4]);
    } else if (look.weapon === 'harpoon' && (act === 'windup' || act === 'strike')) {
      // The off hand flung out at the foe, to aim the throw.
      elbow = at([6.2, 26, 4.4]);
      hand = at([3.6, 27, 9.6]);
    } else if (struck(act) && act !== 'slump') {
      elbow = at([7.8, 20.6, -1]);
      hand = at([9.6, 17.6, -2]);
    } else if (act === 'slump') {
      elbow = at([6, 15.6, 2.2]);
      hand = at([6.2, 9.8, 3.6]);
    } else if (act === 'rest') {
      elbow = [side * 6.4 * w, by(21.6), sz + 0.3 + swing * 0.5];
      hand = [side * 6.8 * w, by(17.4), sz + 1 + swing];
    } else if (act === 'taunt') {
      // Claws spread, reaching.
      elbow = at([7.4, 22.6, 3]);
      hand = at([6.8, 24.4, 7.6]);
    } else {
      // Claws out, ready to rake.
      elbow = at([7.2, 21.4, 2.6]);
      hand = at([5.4, 22, 6.6]);
    }
    const arm = (h: Hit): Tones => painted(h, scale(h, false), 'arm');
    solids.push(knob(shoulder, 2.6 * w, arm));
    solids.push(...limb(shoulder, elbow, 1.8 * w, 1.5 * w, arm, 0.45));
    solids.push(knob(elbow, 1.45 * w, arm));
    solids.push(...limb(elbow, hand, 1.5 * w, 1.15 * w, arm, 0.45));
    if (look.armbands) {
      for (const t of [0.55, 0.75]) {
        const p = lerp3(elbow, hand, t);
        solids.push({ ...knob(p, 1.55 * w, (h) => (speck(h, 0.6) < 0.4 ? VERDIGRIS : BRONZE)), ry: 0.4 });
      }
    }
    // The hand: three long fingers and a thumb, curled round a haft or spread with the claws out.
    const toward = norm([hand[0] - elbow[0], hand[1] - elbow[1], hand[2] - elbow[2]]);
    solids.push({ cx: hand[0], cy: hand[1] - 0.3, cz: hand[2] + 0.3, rx: 1.3 * w, ry: 1.2 * w, rz: 1.5 * w, material: (h) => scale(h, false) });
    const gripping = weapon || two || look.weapon === 'hooks' || look.shield;
    for (const k of [-1, 0, 1]) {
      const root: V3 = [hand[0] + k * 0.75 * w, hand[1] - 0.6, hand[2] + 1 * w];
      const tipF = along(root, gripping ? [side * -0.25, -0.7, 0.35] : toward, (gripping ? 1.2 : 2.4) * w);
      solids.push(...chain([root, tipF], [0.48 * w, 0.38 * w], (h) => scale(h, false), 0.3));
      solids.push(...limb(tipF, along(tipF, gripping ? [side * -0.4, -0.5, -0.3] : toward, 0.9), 0.34, 0.1, CLAW, 0.2));
    }
    const thumb: V3 = [hand[0] - side * 1.1 * w, hand[1] + 0.1, hand[2] + 0.9 * w];
    solids.push(knob(thumb, 0.5 * w, (h) => scale(h, false)));
    solids.push(...limb(thumb, along(thumb, [-side * 0.4, 0, 0.6], 0.9), 0.3, 0.1, CLAW, 0.2));
    if (drip > 0.3 && !gripping) mark([hand[0], hand[1] - 2.2, hand[2] + 1], DRIP, 0.5);
    // What sits on the shoulders.
    if (look.pauldron === 'shell') {
      solids.push({ cx: side * 5.6 * w, cy: shoulderY + 1.4, cz: sz - 0.2, rx: 3.2 * w, ry: 1.3, rz: 3.2 * w, material: shellPlates([side * 5.6 * w, shoulderY + 1.4, sz]) });
      solids.push({ cx: side * 6.6 * w, cy: shoulderY - 0.4, cz: sz - 0.2, rx: 2.4 * w, ry: 1, rz: 2.6 * w, material: SHELL });
    } else if (look.pauldron === 'bone' && weapon) {
      // A great jawbone, teeth and all, strapped over the shoulder.
      solids.push({ cx: side * 5.8 * w, cy: shoulderY + 1.4, cz: sz, rx: 2.1 * w, ry: 0.7, rz: 2.8 * w, material: (h) => (speck(h, 0.6) < 0.3 ? dim(OLD_BONE) : OLD_BONE) });
      for (let i = 0; i < 6; i++) {
        const a = -1.2 + i * 0.48;
        solids.push(...limb([side * (5.8 + Math.cos(a) * 0.4) * w, shoulderY + 1, sz + Math.sin(a) * 2.8 * w], [side * (6 + Math.cos(a) * 0.4) * w, shoulderY - 0.4, sz + Math.sin(a) * 3.2 * w], 0.4, 0.1, TOOTH, 0.2));
      }
      mark([side * 5.8 * w, shoulderY + 2.6, sz], CORD[1], 0.8);
    }
    if (weapon) weaponHand = [hand[0], hand[1] - 0.6, hand[2] + 0.4];
    else offHand = [hand[0], hand[1] - 0.6, hand[2] + 0.4];
  }

  // --- What hangs round the neck.
  if (look.necklace) {
    for (let i = 0; i < 13; i++) {
      const a = -1.3 + (i / 12) * 2.6;
      const p: V3 = [Math.sin(a) * 4.2 * w, by(27.4) - Math.cos(a) * 1.8 - Math.abs(a) * 0.2, lean(27) + Math.cos(a) * 4 * w + 0.6];
      if (look.necklace === 'teeth') {
        if (i % 2) solids.push(...limb(p, [p[0], p[1] - 1.5, p[2] + 0.3], 0.42, 0.1, TOOTH, 0.2));
        else mark(p, CORD[1], 0.6);
      } else if (look.necklace === 'shells') {
        solids.push({ ...knob(p, 0.65, i % 3 ? [0xe8e0d0, 0xb8b0a0, 0xfffcf4] : [0xd8a8a0, 0xa87870, 0xf0c8c0]), rz: 0.4 });
        mark([p[0], p[1], p[2] + 0.45], 0x8a7a6a, 0.3);
      } else {
        solids.push(...limb([p[0] - 0.4, p[1], p[2]], [p[0] + 0.4, p[1] - 1.2, p[2] + 0.2], 0.35, 0.35, BONE, 0.2));
      }
    }
  }

  // --- A quiver of plaited reed on the back, three harpoons standing out of it.
  if (look.quiver) {
    const q0: V3 = [-1.6 * w, by(15), lean(15) - 4.2 * w];
    const q1: V3 = [2.4 * w, by(28), lean(28) - 5.4 * w];
    solids.push(...limb(q0, q1, 1.5, 1.7, (h) => (frac(h.y * 1.6) < 0.2 ? dim(REED) : REED), 0.45));
    const qd = norm([q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]]);
    for (const k of [-0.8, 0, 0.8]) {
      const base: V3 = [q1[0] + k, q1[1] - 1, q1[2] + k * 0.3];
      const top = along(base, qd, 7 + Math.abs(k));
      solids.push(...limb(base, top, 0.35, 0.3, SHAFT, 0.4));
      const head = along(top, qd, 2.2);
      solids.push(...limb(top, head, 0.6, 0.1, BONE, 0.3));
      solids.push(...limb(along(top, qd, 0.4), along(along(top, qd, 1.4), [0, -1, 0], 0.9), 0.25, 0.08, BONE, 0.2));
    }
  }

  // --- The head: low and forward on a thick neck, flat on top, a long snout full of teeth.
  const hy = by(32) + body.head;
  const hz = lean(32) + 2.6;
  solids.push(...limb([0, by(27.6), sz - 0.6], [0, hy - 0.4, hz - 1.8], 2.8 * w, 2.4 * w, (h) => (h.nz > 0.35 && h.ny < 0.2 ? plates(h, 99, -99, 2) ?? scale(h) : scale(h)), 0.45));
  const k = Math.sqrt(w);
  const open = Math.min(1, body.open);
  const faceTone = (h: Hit): Tones => {
    if (h.y < hy - 0.9 && h.ny < -0.1) return (Math.floor(h.z * 1.6) & 1) === 0 ? look.belly : dim(look.belly);
    const t = scale(h, false);
    // A band of clay across the eyes, side to side.
    if (look.paint && look.paintStyle === 'mask' && Math.abs(h.y - (hy + 1.5)) < 0.9 && h.z > hz + 0.6 && h.z < hz + 4) return look.paint;
    if (look.paint && look.paintStyle === 'stripes' && Math.abs(h.nx) > 0.4 && frac((h.z - hz) / 1.8) < 0.3 && h.z > hz - 1 && h.z < hz + 5) return look.paint;
    return t;
  };
  // The skull, flat-topped and broad behind the eyes.
  solids.push({ cx: 0, cy: hy + 0.5, cz: hz, rx: 3.5 * k, ry: 2.8, rz: 3.8 * k, material: faceTone, soft: true });
  // The upper jaw and snout, tapering to the nostrils.
  solids.push({ cx: 0, cy: hy + 0.2, cz: hz + 4 * k, rx: 2.5 * k, ry: 1.7, rz: 3.4 * k, material: faceTone, soft: true });
  solids.push({ cx: 0, cy: hy + 0.05, cz: hz + 6.8 * k, rx: 1.8 * k, ry: 1.3, rz: 1.9 * k, material: faceTone, soft: true });
  // The lower jaw, hinged behind the eye, dropped open to hiss.
  const hinge: V3 = [0, hy - 0.9, hz - 0.8];
  const jawTip: V3 = [0, hy - 1.3 - open * 2.6, hz + 7.4 * k - open * 0.8];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const p = lerp3(hinge, jawTip, t);
    solids.push({ cx: p[0], cy: p[1], cz: p[2], rx: (2.8 - t * 1.3) * k, ry: 0.9, rz: 1.2, material: faceTone, soft: true });
  }
  if (open > 0.15) {
    // The mouth: dark red inside, the tongue lying in it.
    const mid = lerp3([0, hy - 0.6, hz + 3], lerp3(hinge, jawTip, 0.5), 0.5);
    solids.push({ cx: 0, cy: mid[1], cz: mid[2] + 0.6, rx: 1.8 * k, ry: 0.6 + open * 1, rz: 3 * k, material: MOUTH, soft: true });
    solids.push({ cx: 0, cy: mid[1] - open * 0.4, cz: mid[2] + 1, rx: 0.9, ry: 0.4, rz: 2.2, material: TONGUE, soft: true });
  }
  // Teeth: a long line of them along both jaws, the upper ones longer.
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const z = hz + 1.2 + t * 6.2 * k;
    const half = (2.45 - t * 0.85) * k;
    for (const side of [-1, 1]) {
      const top: V3 = [side * half, hy - 1 + t * 0.1, z];
      solids.push(...limb(top, [top[0], top[1] - 0.7 - (i % 3 === 1 ? 0.4 : 0), top[2] + 0.1], 0.22, 0.06, TOOTH, 0.15));
      const lo = lerp3(hinge, jawTip, 0.2 + t * 0.78);
      const lower: V3 = [side * (2.4 - (0.2 + t * 0.78) * 1.25) * k, lo[1] + 0.8, lo[2]];
      if (open > 0.15) solids.push(...limb(lower, [lower[0], lower[1] + 0.6, lower[2]], 0.2, 0.06, TOOTH, 0.15));
      else mark([lower[0] * 1.02, lower[1] + 0.1, lower[2]], i % 2 ? 0x1e1a14 : TOOTH[0], 0.4);
    }
  }
  // Nostrils, and the brow ridges over the eyes.
  for (const side of [-1, 1]) {
    mark([side * 0.8 * k, hy + 1.1, hz + 7.9 * k], 0x14120e, 0.5);
    solids.push({ cx: side * 2.3 * k, cy: hy + 2.6 - (act === 'taunt' ? 0.3 : 0), cz: hz + 2.2, rx: 1.4, ry: 0.7, rz: 1.8, material: look.dark, soft: true });
  }
  // The eyes: a black ring, a gold iris, a slit pupil with a glint (or the third lid drawn across).
  for (const side of [-1, 1]) {
    const e: V3 = [side * 2.75 * k, hy + 1.6, hz + 2.4];
    const out = side * 0.35;
    mark([e[0] + out * 0.6, e[1], e[2]], RING, 1.5);
    if (fx.blink || body.shut) {
      mark([e[0] + out, e[1] - 0.05, e[2]], MEMBRANE, 1.1);
      mark([e[0] + out * 1.1, e[1] - 0.3, e[2]], darker(MEMBRANE), 0.6);
    } else {
      mark([e[0] + out, e[1], e[2]], look.eye, 1.15);
      mark([e[0] + out * 1.15, e[1] + 0.3, e[2]], PUPIL, 0.35);
      mark([e[0] + out * 1.15, e[1], e[2]], PUPIL, 0.35);
      mark([e[0] + out * 1.15, e[1] - 0.3, e[2]], PUPIL, 0.35);
      mark([e[0] + out * 1.2, e[1] + 0.35, e[2] + 0.3], GLINT, 0.3);
    }
  }
  // Little horns of scale at the back of the jaw and on the crown.
  for (const side of [-1, 1]) {
    solids.push(...limb([side * 2.8 * k, hy - 0.6, hz - 1.8], [side * 3.6 * k, hy - 1.6, hz - 3.6], 0.6, 0.12, look.dark, 0.2));
    solids.push(...limb([side * 1.4 * k, hy + 2.6, hz - 1.4], [side * 1.8 * k, hy + 3.8, hz - 3.4], 0.55, 0.12, look.dark, 0.2));
  }
  // The frill at the jaw: a fan of skin on ribs, laid back, or spread wide to hiss.
  const flare = Math.min(1, body.frill + (fx.frill ?? 0));
  for (const side of [-1, 1]) {
    for (let r = 0; r < 5; r++) {
      const a = -0.9 + r * 0.45;
      const root: V3 = [side * 2.6 * k, hy - 0.6, hz - 1.6];
      const reach = (2 + flare * 2.6) * k;
      const end: V3 = [root[0] + side * (0.6 + flare * 2.4) * k, root[1] + Math.sin(a) * reach, root[2] - Math.cos(a) * reach * (1 - flare * 0.55)];
      solids.push(...limb(root, end, 0.32, 0.18, r % 2 ? look.frill : dim(look.frill), 0.25));
      const next = r < 4 ? -0.9 + (r + 1) * 0.45 : a;
      const mid: V3 = lerp3(root, [root[0] + side * (0.6 + flare * 2.4) * k, root[1] + Math.sin((a + next) / 2) * reach * 0.9, root[2] - Math.cos((a + next) / 2) * reach * 0.9 * (1 - flare * 0.55)], 0.62);
      solids.push({ cx: mid[0], cy: mid[1], cz: mid[2], rx: 0.3 + flare * 0.25, ry: reach * 0.3, rz: reach * 0.3, material: look.frill, soft: true });
    }
  }
  // The crest: spines from the crown down the back of the neck, webbed.
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const base = lerp3([0, hy + 2.4, hz - 0.8], [0, by(28.4), sz - 3.2 * w], t);
    const tall = (2.6 - t * 1.2 + flare * 0.8) * k;
    solids.push(...limb(base, [base[0], base[1] + tall, base[2] - 1.2], 0.3, 0.1, look.frill, 0.2));
    solids.push({ cx: base[0], cy: base[1] + tall * 0.4, cz: base[2] - 0.4, rx: 0.22, ry: tall * 0.42, rz: 0.9, material: dim(look.frill) });
  }
  // The forked tongue flicked out.
  if (fx.tongue) {
    const root: V3 = [0, hy - 0.8 - open * 1.2, hz + 7.2 * k];
    const fork: V3 = [0, root[1] - 0.2, root[2] + 2.6];
    solids.push(...limb(root, fork, 0.3, 0.2, TONGUE, 0.2));
    for (const side of [-1, 1]) solids.push(...limb(fork, [side * 0.5, fork[1] - 0.15, fork[2] + 1.1], 0.18, 0.08, TONGUE, 0.15));
  }
  if (drip > 0) mark([0, jawTip[1] - 1.2, jawTip[2] - 1.6], DRIP, 0.55);

  // --- On the head.
  if (look.headdress === 'feathers') {
    for (const [x, a, len] of [[-0.6, -0.3, 6], [0.4, 0.15, 7], [1.2, 0.5, 5.4]] as const) {
      const root: V3 = [x, hy + 2.8, hz - 2.2];
      const top: V3 = [x + Math.sin(a) * len * 0.5, root[1] + len * 0.85, root[2] - len * 0.55];
      solids.push(...limb(root, top, 0.2, 0.15, SHAFT, 0.3));
      const vane = norm([top[0] - root[0], top[1] - root[1], top[2] - root[2]]);
      const [ax, ay] = across(vane, [1, 0, 0]);
      const mid = lerp3(root, top, 0.62);
      solids.push({ cx: mid[0], cy: mid[1], cz: mid[2], rx: len * 0.34, ry: 0.85, rz: 0.12, axes: [vane, ax, ay], material: (h) => (Math.hypot(h.x - top[0], h.y - top[1], h.z - top[2]) < 1.6 ? [FEATHER_TIP, darker(FEATHER_TIP), 0x4a4a50] : FEATHER), soft: true });
    }
  } else if (look.headdress === 'skull') {
    // A pike's skull worn over the crown, its long jaw over the snout, teeth hanging.
    const top = hy + 2.6;
    solids.push({ cx: 0, cy: top, cz: hz + 0.2, rx: 2.5 * k, ry: 1.1, rz: 2.9 * k, material: (h) => (speck(h, 0.7) < 0.3 ? dim(OLD_BONE) : OLD_BONE), soft: true });
    solids.push({ cx: 0, cy: top - 0.5, cz: hz + 3.8 * k, rx: 1.5 * k, ry: 0.6, rz: 2.4 * k, material: OLD_BONE, soft: true });
    for (const side of [-1, 1]) {
      mark([side * 1.6 * k, top + 0.2, hz + 2.8], 0x1a1612, 1.2);
      for (let i = 0; i < 5; i++) solids.push(...limb([side * 1.6 * k, top - 1, hz + 2.6 + i * 1.2], [side * 1.6 * k, top - 1.9, hz + 2.8 + i * 1.2], 0.22, 0.06, TOOTH, 0.15));
    }
    // Black and red feathers standing up behind it.
    for (let i = 0; i < 5; i++) {
      const x = -1.6 + i * 0.8;
      const root: V3 = [x, top + 0.6, hz - 2.2];
      const end: V3 = [x * 1.6, root[1] + 5.6 - Math.abs(x) * 0.6, root[2] - 3.4];
      solids.push(...limb(root, end, 0.5, 0.2, i % 2 ? [0x8a1e1a, 0x5a1210, 0xb43028] : [0x24201e, 0x141210, 0x3a3430], 0.3));
    }
  }

  // --- What it fights with.
  solids.push(...weaponSolids(look, weaponHand, offHand, act, b, mark));
  if (look.shield) solids.push(...shieldSolids(offHand, act, w, mark));
  return { solids, details };
}

type Mark = (p: V3, color: number, size?: number) => void;

/** The plates of a turtle's shell: hexagons with dark seams, paler at their middles. */
function shellPlates(c: V3, size = 1.6): (h: Hit) => Tones {
  return (h: Hit): Tones => {
    const u = (h.x - c[0]) / size;
    const v = (h.y - c[1] + h.z - c[2]) / size;
    const row = Math.floor(v);
    const col = Math.floor(u + (row & 1) * 0.5);
    const fu = frac(u + (row & 1) * 0.5) - 0.5;
    const fv = frac(v) - 0.5;
    const edge = Math.max(Math.abs(fu), Math.abs(fv) * 1.1 + Math.abs(fu) * 0.35);
    if (edge > 0.44) return SHELL_SEAM;
    if (edge < 0.18) return cell(col, row) > 0.6 ? SHELL_LIGHT : lit(SHELL);
    return (col + row) & 1 ? SHELL : dim(SHELL_LIGHT);
  };
}

/** A shaft from butt to point, wound with cord near the head. */
function shaft(butt: V3, top: V3, r: number, tones: Tones): Solid[] {
  const len = Math.hypot(top[0] - butt[0], top[1] - butt[1], top[2] - butt[2]);
  const dir: V3 = [(top[0] - butt[0]) / len, (top[1] - butt[1]) / len, (top[2] - butt[2]) / len];
  const grain = (h: Hit): Tones => {
    const t = (h.x - butt[0]) * dir[0] + (h.y - butt[1]) * dir[1] + (h.z - butt[2]) * dir[2];
    if (t > len - 2.6) return Math.floor(t * 3) % 2 ? CORD : dim(CORD);
    return speck(h, 0.7) < 0.1 ? dim(tones) : tones;
  };
  return limb(butt, top, r, r * 0.9, grain, 0.35).map((p) => ({ ...p, soft: true }));
}

/** The weapon in the right hand (and, for the hookhand, the left). */
function weaponSolids(look: MereLook, h: V3, off: V3, act: Act, b: number, mark: Mark): Solid[] {
  const w = look.bulk ?? 1;
  const [x, y, z] = h;
  const blade = norm(BLADE[act]);
  /** Which way something `len` long points: as the act has it, unless that would drive it into the ground. */
  const aim = (len: number, floor = 1, want: V3 = blade): V3 => {
    if (y + want[1] * len >= floor) return want;
    const dy = Math.max(-1, (floor - y) / len);
    const flat = Math.hypot(want[0], want[2]) || 1;
    const k = Math.sqrt(Math.max(0, 1 - dy * dy)) / flat;
    return [want[0] * k, dy, want[2] * k];
  };
  const out: Solid[] = [];
  switch (look.weapon) {
    case 'spear': {
      // A long black spear, bound with cord, a long point of sharpened bone lashed on.
      const sp = SPEAR[act];
      const d = norm(sp.d);
      const butt = act === 'rest' ? [x, 0.6, z + 0.4] as V3 : along(h, d, -sp.back);
      const top = act === 'rest' ? [x, 42 - b, z + 1] as V3 : along(h, d, sp.front);
      const dir = norm([top[0] - butt[0], top[1] - butt[1], top[2] - butt[2]]);
      out.push(...shaft(butt, top, 0.55, BLACK_SHAFT));
      for (let i = 0; i < 6; i++) out.push({ ...knob(along(top, dir, 0.4 + i * 0.85), 0.95 - i * 0.14, BONE), soft: true });
      // A tuft of heron down tied under the point.
      const f = along(top, dir, -1.2);
      out.push({ cx: f[0] + 0.6, cy: f[1] - 1.6, cz: f[2], rx: 0.45, ry: 1.5, rz: 0.6, material: FEATHER, soft: true });
      return out;
    }
    case 'harpoon': {
      // A barbed harpoon of bone on a pale shaft, a cord coiled back to the wrist. After the throw, the hand is empty.
      const hp = HARPOON[act];
      if (act === 'follow') {
        mark([x, y - 0.4, z + 1.4], CORD[0], 0.8);
        return out;
      }
      let butt: V3;
      let top: V3;
      if (!hp) {
        // Carried point up at the side, the butt by the foot.
        const sp = SPEAR[act];
        const d = norm(sp.d);
        butt = act === 'rest' ? [x, 4, z + 0.4] : along(h, d, -sp.back * 0.75);
        top = act === 'rest' ? [x, 34 - b, z + 1] : along(h, d, sp.front * 0.85);
      } else {
        const d = norm(hp.d);
        butt = along(h, d, -hp.back);
        top = along(h, d, hp.front);
      }
      const dir = norm([top[0] - butt[0], top[1] - butt[1], top[2] - butt[2]]);
      out.push(...shaft(butt, top, 0.5, SHAFT));
      // The head: a long bone point with three barbs swept back.
      const point = along(top, dir, 3.4);
      out.push(...limb(top, point, 0.75, 0.1, BONE, 0.25));
      const [ax] = across(dir, [0, 1, 0]);
      for (const k2 of [0.8, 1.8, 2.6]) {
        const root = along(top, dir, k2);
        for (const sgn of [-1, 1]) out.push(...limb(root, along(along(root, dir, -1.1), ax, sgn * 0.9), 0.28, 0.08, BONE, 0.15));
      }
      // The line: from the shaft's end looping back to the hand.
      if (act === 'strike') {
        for (let i = 0; i < 8; i++) {
          const t = i / 7;
          const p = lerp3(butt, h, t);
          out.push(knob([p[0], p[1] - Math.sin(t * Math.PI) * 1.4, p[2]], 0.22, CORD));
        }
      }
      return out;
    }
    case 'sword': {
      // A leaf-bladed sword of old bronze, green where it isn't bright, on a cord-bound grip.
      const d = aim(10);
      out.push(...limb(along(h, d, -1.6), along(h, d, 1.2), 0.55, 0.55, (hh) => (Math.floor((hh.x + hh.y + hh.z) * 3) % 2 ? CORD : dim(CORD)), 0.25));
      out.push(knob(along(h, d, -1.9), 0.75, BRONZE));
      const [flat] = across(d, [0, 0, 1]);
      out.push({ ...knob(along(h, d, 1.3), 0.6, BRONZE), rx: 2.2, ry: 0.5, rz: 0.6, axes: [flat, d, norm(cross(flat, d))] });
      const edge = (hh: Hit): Tones => {
        const t = (hh.x - x) * d[0] + (hh.y - y) * d[1] + (hh.z - z) * d[2];
        const off2 = Math.abs((hh.x - x) * flat[0] + (hh.y - y) * flat[1] + (hh.z - z) * flat[2] - 0);
        if (speck(hh, 0.6) < 0.25 && off2 < 0.7) return VERDIGRIS;
        return t > 8.8 || off2 > 0.85 ? [0xc0a066, BRONZE[0], 0xe8d4a0] : BRONZE;
      };
      for (let i = 0; i <= 10; i++) {
        const t = 1.8 + i * 0.8;
        // Leaf-shaped: narrow at the hilt, swelling, then drawn to a point.
        const wd = i < 7 ? 0.7 + i * 0.12 : 1.5 - (i - 7) * 0.32;
        out.push({ ...knob(along(h, d, t), 1, edge, true), rx: wd, ry: 0.55, rz: 0.22, axes: [flat, d, norm(cross(flat, d))] });
      }
      return out;
    }
    case 'axe': {
      // A knapped flint head, lashed into a split haft with gut, a tuft of feathers at the butt.
      const d = aim(9);
      const tip = along(h, d, 6.4);
      out.push(...limb(along(h, d, -1.4), along(tip, d, 0.8), 0.55, 0.5, (hh) => (speck(hh, 0.5) < 0.12 ? dim(SHAFT) : SHAFT), 0.3));
      const [side, up] = across(d, [0, 0, 1]);
      // The head sticks out forward of the haft (its edge leading the swing).
      const fwd: V3 = norm(cross(d, side));
      const headC = along(tip, fwd, 2);
      const knap = (hh: Hit): Tones => {
        const e = (hh.x - headC[0]) * fwd[0] + (hh.y - headC[1]) * fwd[1] + (hh.z - headC[2]) * fwd[2];
        if (e > 1.4) return FLINT_EDGE;
        return speck(hh, 0.45) < 0.35 ? dim(FLINT) : speck(hh, 0.45) > 0.85 ? lit(FLINT) : FLINT;
      };
      out.push({ cx: headC[0], cy: headC[1], cz: headC[2], rx: 3.2, ry: 2.2, rz: 0.6, axes: [fwd, d, side], material: knap, soft: true });
      out.push(...limb(along(tip, d, -0.9), along(tip, d, 0.9), 0.85, 0.85, (hh) => (Math.floor((hh.x + hh.y + hh.z) * 3.4) % 2 ? CORD : dim(CORD)), 0.2));
      const butt = along(h, d, -1.6);
      out.push({ cx: butt[0] + 0.3, cy: butt[1] - 1.2, cz: butt[2], rx: 0.4, ry: 1.3, rz: 0.6, material: [0x8a3a2a, 0x5a2418, 0xb05038], soft: true });
      void up;
      return out;
    }
    case 'hooks': {
      // A bronze hook in each hand: a short haft, the hook curling forward and in, its point wicked.
      for (const [hand, sgn] of [[h, 1], [off, -1]] as const) {
        const hd = sgn === 1 ? blade : norm(BLADE[mirrorOf(act)]);
        const d = aim(7, 1, [hd[0] * sgn, hd[1], hd[2]]);
        out.push(...limb(along(hand, d, -1.2), along(hand, d, 3.4), 0.5, 0.45, (hh) => (Math.floor((hh.x + hh.y + hh.z) * 3) % 2 ? CORD : SHAFT), 0.25));
        const [side] = across(d, [0, 0, 1]);
        const fwd = norm(cross(d, side));
        let p = along(hand, d, 3.4);
        for (let i = 0; i < 10; i++) {
          const a = (i / 9) * Math.PI * 1.15;
          const next: V3 = along(along(along(hand, d, 3.4), d, Math.sin(a) * 2.6), fwd, (1 - Math.cos(a)) * 1.6);
          out.push(...limb(p, next, 0.55 - i * 0.04, 0.5 - i * 0.04, i > 6 ? [0xc0a066, BRONZE[0], 0xe8d4a0] : (hh) => (speck(hh, 0.5) < 0.3 ? VERDIGRIS : BRONZE), 0.2));
          p = next;
        }
        mark(p, 0xfff0c0, 0.4);
      }
      return out;
    }
    case 'greataxe': {
      // A great crescent axe of bronze on a long haft, a pike's jaw bound to the butt.
      const len = 12 * w;
      const d = act === 'rest' ? norm([0.06, -0.8, 0.6]) : aim(len * 0.75 + 2, 2.2, act === 'follow' ? norm([0.5, -0.45, 0.75]) : blade);
      const butt = along(h, d, -6 * w);
      const head = act === 'rest' ? ([x + 0.2, 33 - b, z + 2] as V3) : along(h, d, len * 0.75);
      const hd = act === 'rest' ? norm([head[0] - x, head[1] - y, head[2] - z]) : d;
      const buttR = act === 'rest' ? along(h, hd, -6 * w) : butt;
      out.push(...shaft(buttR, head, 0.7, BLACK_SHAFT));
      const [side] = across(hd, [0, 0, 1]);
      const fwd = norm(cross(hd, side));
      // The crescent: a broad curved blade with its edge forward, a back spike behind.
      for (let i = 0; i <= 12; i++) {
        const a = -1.1 + (i / 12) * 2.2;
        const c = along(along(head, hd, Math.sin(a) * 4.2 * w - 0.8), fwd, 1.4 + Math.cos(a) * 2.6 * w);
        out.push({ ...knob(c, 1, (hh) => (speck(hh, 0.6) < 0.35 ? VERDIGRIS : BRONZE), true), rx: 1.4 * w, ry: 1.1 * w, rz: 0.4, axes: [fwd, hd, side] });
        // The edge, honed bright.
        const e = along(along(head, hd, Math.sin(a) * 4.4 * w - 0.8), fwd, 1.4 + Math.cos(a) * 3.6 * w);
        out.push({ ...knob(e, 1, [0xc0a066, BRONZE[0], 0xe8d4a0], true), rx: 0.5, ry: 0.9 * w, rz: 0.3, axes: [fwd, hd, side] });
      }
      for (let i = 0; i < 5; i++) out.push({ ...knob(along(along(head, hd, -0.8 + i * 0.5 - 1), fwd, 0.6), 0.9, (hh) => (speck(hh, 0.5) < 0.4 ? VERDIGRIS : BRONZE), true), rz: 0.5, axes: [fwd, hd, side] });
      out.push(...limb(along(head, hd, -0.8), along(along(head, hd, -0.6), fwd, -3.2), 0.6, 0.12, BRONZE, 0.2));
      out.push(...limb(along(head, hd, -2.4), along(head, hd, 0.4), 0.95, 0.95, (hh) => (Math.floor((hh.x + hh.y + hh.z) * 3) % 2 ? CORD : dim(CORD)), 0.25));
      // The pike's jaw at the butt.
      out.push(...limb(buttR, along(along(buttR, hd, -2.2), fwd, 0.8), 0.6, 0.2, BONE, 0.2));
      for (let i = 0; i < 4; i++) mark(along(along(buttR, hd, -0.5 - i * 0.5), fwd, 0.7), TOOTH[2], 0.35);
      return out;
    }
  }
}

/** The hookhand's second hook follows a beat behind the first. */
function mirrorOf(act: Act): Act {
  const m: Record<Act, Act> = { rest: 'rest', ready: 'ready', windup: 'ready', strike: 'windup', follow: 'strike', hurt: 'hurt', reel: 'reel', taunt: 'windup', slump: 'slump' };
  return m[act];
}

/** The shield: a great turtle's shell, its plates seamed and worn, a rim of lashed reed, a fish's skull bound to its face. */
function shieldSolids(h: V3, act: Act, w: number, mark: Mark): Solid[] {
  const [x, y, z] = h;
  const c: V3 = struck(act) ? [x + 1.4, y - 0.4, z - 0.4] : [x + 0.8 * w, y - 0.6, z + 1.4];
  const rx = 5.2 * w;
  const ry = 6.4 * w;
  const tilt = struck(act) ? 1 : 0.5;
  const plates = shellPlates(c, 2.1);
  const out: Solid[] = [
    {
      cx: c[0], cy: c[1], cz: c[2] + tilt, rx, ry, rz: 1.6,
      material: (hh) => {
        const e = ((hh.x - c[0]) / rx) ** 2 + ((hh.y - c[1]) / ry) ** 2;
        if (e > 0.82) return Math.floor(Math.atan2(hh.y - c[1], hh.x - c[0]) * 9) % 2 ? REED : dim(REED);
        return plates(hh);
      },
    },
  ];
  // The fish's skull bound to its face with cord, and shells hung round the rim.
  out.push({ cx: c[0], cy: c[1] + 0.6, cz: c[2] + tilt + 1.6, rx: 1.4, ry: 1.8, rz: 0.7, material: BONE, soft: true });
  mark([c[0] - 0.5, c[1] + 1.1, c[2] + tilt + 2.2], 0x1a1612, 0.6);
  mark([c[0] + 0.5, c[1] + 1.1, c[2] + tilt + 2.2], 0x1a1612, 0.6);
  for (let i = 0; i < 4; i++) mark([c[0] - 0.6 + i * 0.4, c[1] - 0.6, c[2] + tilt + 2.2], TOOTH[0], 0.3);
  for (const a of [-2.4, -1.6, -0.8]) mark([c[0] + Math.cos(a) * rx * 0.96, c[1] + Math.sin(a) * ry * 0.96, c[2] + tilt + 0.9], SHELL_BEAD, 0.8);
  return out;
}

// --------------------------------------------------------------- the six of them

/** The spear-hunter: the watcher's colours (grey-green, a yellow belly, a red-brown crest), a bone-tipped spear, a necklace of teeth. */
export const MERE_SPEAR: MereLook = {
  back: [0x4e5a44, 0x343e2e, 0x6a7a5a],
  dark: [0x3a4434, 0x262e22, 0x505c46],
  belly: [0x9a9668, 0x6e6c4a, 0xb8b484],
  band: [0x2e3626, 0x1e241a, 0x424c38],
  frill: [0x8a4a3a, 0x5e3228, 0xa8604e],
  eye: 0xd8a82a,
  weapon: 'spear',
  skirt: [0x6a5a3e, 0x4a3e2a, 0x86745a],
  necklace: 'teeth',
};

/** The harpooner: mud-brown with dark bands, a mustard frill, red ochre dots, a reed skirt and a quiver of harpoons. */
export const MERE_HARPOON: MereLook = {
  back: [0x6a5a3a, 0x4a3e28, 0x8a7a52],
  dark: [0x4e4028, 0x34281a, 0x66543a],
  belly: [0xb0a070, 0x807250, 0xccbc8c],
  band: [0x32281a, 0x201810, 0x4a3c28],
  frill: [0xb08a2a, 0x7a5e1a, 0xd0aa44],
  eye: 0xe0b83a,
  weapon: 'harpoon',
  quiver: true,
  paint: [0x9a3a22, 0x6a2616, 0xb8523a],
  paintStyle: 'dots',
  skirt: REED,
  reedSkirt: true,
  necklace: 'shells',
};

/** The shield-bearer: blue-green, an orange frill, white stripes, a bronze sword and a turtle-shell shield. */
export const MERE_BLADE: MereLook = {
  back: [0x3a6060, 0x264444, 0x548080],
  dark: [0x2a4848, 0x1a3030, 0x3e6060],
  belly: [0xa8b08a, 0x7a8264, 0xc4caa4],
  band: [0x1e3434, 0x122222, 0x2e4a4a],
  frill: [0xc0642a, 0x86421a, 0xe08440],
  eye: 0xf0c040,
  weapon: 'sword',
  shield: true,
  paint: [0xb8b4a2, 0x8a8678, 0xd0ccb8],
  paintStyle: 'stripes',
  skirt: [0x4a4038, 0x302a24, 0x645850],
  armbands: true,
  headdress: 'feathers',
};

/** The axeman: near black, a pale bone-coloured belly, a white clay mask, a flint axe and a jawbone on the shoulder. */
export const MERE_AXE: MereLook = {
  back: [0x2e342a, 0x1e221c, 0x444c3e],
  dark: [0x22261e, 0x141612, 0x343a30],
  belly: [0xb4ae94, 0x86806a, 0xd0caae],
  band: [0x161a14, 0x0c0e0a, 0x262a22],
  frill: [0x6a6a3a, 0x464626, 0x8a8a4e],
  eye: 0xe8d040,
  weapon: 'axe',
  paint: [0xc8c4b4, 0x9a9688, 0xe0dccc],
  paintStyle: 'mask',
  skirt: [0x3e3226, 0x2a2018, 0x584838],
  pauldron: 'bone',
  necklace: 'bones',
  bulk: 1.08,
};

/** The hookhand: sandy and speckled like a heath lizard, a violet frill, a bronze hook in each hand. */
export const MERE_HOOK: MereLook = {
  back: [0x8a7a54, 0x62563a, 0xa89870],
  dark: [0x5a4e34, 0x3e3624, 0x74684a],
  belly: [0xc8bc94, 0x9a8e6c, 0xe0d4ac],
  band: [0x4a3e28, 0x302818, 0x62543a],
  frill: [0x6a4a8a, 0x48305e, 0x8a66aa],
  eye: 0xe8a030,
  weapon: 'hooks',
  skirt: [0x5a4632, 0x3e3022, 0x766048],
  paint: [0x2e2a3a, 0x1e1a26, 0x464058],
  paintStyle: 'stripes',
  necklace: 'teeth',
  bulk: 0.94,
};

/** The war-chief: dark as bog water, a crimson crest, turtle-shell shoulders, a pike's skull, and a great crescent axe of bronze. */
export const MERE_CHIEF: MereLook = {
  back: [0x283830, 0x18241e, 0x3a5044],
  dark: [0x1c2a22, 0x101a14, 0x2c3c32],
  belly: [0x8a8a62, 0x626244, 0xa8a87c],
  band: [0x101a14, 0x080e0a, 0x1c2a22],
  frill: [0xa42a22, 0x6e1a14, 0xcc4436],
  eye: 0xff8a2a,
  weapon: 'greataxe',
  paint: [0xa42a22, 0x6e1a14, 0xcc4436],
  paintStyle: 'stripes',
  skirt: [0x3a2e22, 0x261e16, 0x544434],
  pauldron: 'shell',
  headdress: 'skull',
  necklace: 'teeth',
  armbands: true,
  bulk: 1.25,
  size: 1.18,
};

export type MereKind = 'merespear' | 'mereharpoon' | 'mereblade' | 'mereaxe' | 'merehook' | 'merechief';

export const MERE_LOOKS: Record<MereKind, MereLook> = {
  merespear: MERE_SPEAR,
  mereharpoon: MERE_HARPOON,
  mereblade: MERE_BLADE,
  mereaxe: MERE_AXE,
  merehook: MERE_HOOK,
  merechief: MERE_CHIEF,
};

// --------------------------------------------------------------- the sheets

/** How many times finer than they're shown the sheets are drawn (like the brigands', see brigands3d.ts). */
export const MERE_RES = 2;

/**
 * A fighting frame as shown: wide enough for the snout and the tail side on, or
 * lying down, and tall enough for a spear overhead. The war-chief needs more
 * room. (Twice this, by MERE_COLS frames, stays inside a 4096-pixel texture.)
 */
export function mereShownSpec(kind: MereKind): FrameSpec {
  return kind === 'merechief' ? { w: 72, h: 80, feetY: 73, groundShade: 5, creases: true } : { w: 64, h: 68, feetY: 61, groundShade: 4, creases: true };
}

export function mereSpec(kind: MereKind): FrameSpec {
  const shown = mereShownSpec(kind);
  const k = MERE_RES;
  return { ...shown, w: shown.w * k, h: shown.h * k, feetY: (shown.feetY + 0.5) * k - 0.5, scale: k };
}

/**
 * The frames: the goblins' and brigands' 24 (see GOBLIN_FRAME in goblins3d.ts:
 * 0-1 stand, 2-5 walk, 6-7 look about, 8 square up, 9 strike, 10 flinch, 11
 * down, 12 wind-up, 13 follow-through, 14-15 the fighting crouch, 16 reel, 17
 * recover, 18-20 stagger, knees and slump, 21 jeer, 22 blink, 23 breathe), and
 * four of their own.
 */
export const MERE_FRAME = {
  ready: 8,
  strike: 9,
  hurt: 10,
  dead: 11,
  windup: 12,
  follow: 13,
  reel: 16,
  taunt: 21,
  /** The tongue flicked out, tasting the air. */
  tongue: 24,
  /** Crouched low and coiled before the wind-up. */
  coil: 25,
  /** The hiss: jaws wide, frill spread, tongue out. */
  hiss: 26,
  /** Lying dead, the tail curled the other way: the last twitch. */
  twitch: 27,
} as const;

export const MERE_COLS = 28;

/** Every solid and detail scaled up about the feet. */
function grown(m: Model, k: number): Model {
  if (k === 1) return m;
  const mat = (mm: Material): Material => (typeof mm === 'function' ? (h: Hit) => mm({ ...h, x: h.x / k, y: h.y / k, z: h.z / k }) : mm);
  return {
    solids: m.solids.map((s) => ({ ...s, cx: s.cx * k, cy: s.cy * k, cz: s.cz * k, rx: s.rx * k, ry: s.ry * k, rz: s.rz * k, material: mat(s.material) })),
    details: m.details.map((d) => ({ ...d, x: d.x * k, y: d.y * k, z: d.z * k })),
  };
}

/** The sheet's frames in order (see {@link MERE_FRAME}). */
export function mereSheet(kind: MereKind): BeastSheet {
  const look = MERE_LOOKS[kind];
  const k = look.size ?? 1;
  const at = (p: Pose3D, act?: Act, fx: Flicker = {}) => grown(mereModel(p, look, act, fx), k);
  const dead = (tail: number) => grown(onItsSide(mereModel({ stride: 0, bob: 0 }, look, 'hurt', { tail, blink: true }), 18, 4.6), k);
  const walk: Pose3D[] = [
    { stride: 1, bob: 0.8 },
    { stride: 0, bob: 0 },
    { stride: -1, bob: 0.8 },
    { stride: 0, bob: 0 },
  ];
  const models: Model[] = [
    at({ stride: 0, bob: 0 }, 'rest', { drip: 1 }),
    at({ stride: 0, bob: 0.6 }, 'rest', { tail: 0.3 }),
    ...walk.map((p, i) => at(p, 'rest', { tail: i % 2 ? 0 : -p.stride * 0.6, drip: i === 1 ? 1 : 0 })),
    // Looking about: crouched, weapon ready, tasting the air.
    at({ stride: 0.3, bob: 0.2 }, 'ready', { tongue: true }),
    at({ stride: 0.3, bob: 0.6 }, 'ready', { tail: -0.4 }),
    at({ stride: 0, bob: 0 }, 'ready'),
    at({ stride: 0, bob: 0.4 }, 'strike'),
    at({ stride: 0, bob: 0.6 }, 'hurt'),
    // 11: dead on its side.
    dead(0.6),
    // 12-13: the wind-up and the follow-through.
    at({ stride: 0, bob: 0.2 }, 'windup'),
    at({ stride: 0, bob: 0.8 }, 'follow'),
    // 14-15: the fighting crouch, swaying.
    at({ stride: 0, bob: 0.8 }, 'ready', { tail: 0.6 }),
    at({ stride: 0, bob: 0.3 }, 'ready', { tail: -0.2, frill: 0.2 }),
    // 16-17: knocked back, and recovering.
    at({ stride: 0, bob: 0.3 }, 'reel'),
    at({ stride: 0, bob: 1 }, 'ready', { blink: true }),
    // 18-20: dying: a stagger, the knees, slumped forward.
    at({ stride: 0, bob: 0.8 }, 'reel', { tail: 0.6 }),
    at({ stride: 0, bob: 2.8 }, 'hurt'),
    at({ stride: 0, bob: 0 }, 'slump'),
    // 21: the jeer: weapon high, jaws wide, frill spread.
    at({ stride: 0, bob: -0.2 }, 'taunt'),
    // 22-23: standing about: the third lid across the eye, and a deep breath.
    at({ stride: 0, bob: 0.3 }, 'rest', { blink: true }),
    at({ stride: 0, bob: -0.3 }, 'rest', { tail: -0.3, drip: 1 }),
    // 24: the tongue flicked out, standing.
    at({ stride: 0, bob: 0.1 }, 'rest', { tongue: true }),
    // 25: coiled low before the wind-up.
    at({ stride: 0, bob: 1.8 }, 'ready', { frill: 0.5, tail: -0.6 }),
    // 26: the hiss.
    at({ stride: 0, bob: 0.4 }, 'ready', { frill: 1, tongue: true, tail: 0.8 }),
    // 27: the last twitch of the tail.
    dead(-0.8),
  ];
  return { spec: mereSpec(kind), models };
}

const held = (f: number, ms: number) => ({ f, ms });

/**
 * Their animations beyond walking: idle (breathing, the third lid, the tongue
 * tasting the air), sniff (looking about), ready (the fighting crouch, a hiss
 * now and then), attack (coil, wind-up, blow, follow-through), hit (reel and
 * recover), die (stagger, knees, slump, down, a last twitch of the tail), and
 * taunt (the jeer and the hiss).
 */
export const MERE_ANIMS: Record<string, BeastAnim> = {
  idle: { frames: [held(0, 800), held(1, 700), held(24, 160), held(0, 140), held(24, 140), held(0, 600), held(22, 160), held(1, 700), held(23, 800), held(1, 600)], repeat: -1 },
  sniff: { frames: [held(6, 500), held(7, 600), held(8, 300), held(6, 160), held(24, 140), held(6, 400), held(22, 140), held(7, 500)], repeat: -1 },
  ready: { frames: [held(8, 300), held(14, 280), held(15, 260), held(14, 280), held(8, 260), held(26, 360), held(15, 260)], repeat: -1 },
  attack: { frames: [held(25, 110), held(12, 150), held(9, 120), held(13, 240)], repeat: 0 },
  hit: { frames: [held(16, 110), held(10, 140), held(17, 180)], repeat: 0 },
  die: { frames: [held(18, 170), held(19, 230), held(20, 280), held(11, 260), held(27, 160), held(11, 1)], repeat: 0 },
  taunt: { frames: [held(26, 260), held(21, 260), held(26, 200), held(14, 200)], repeat: 0 },
};

/** The Mere-kin's fighting sheets ('creature-<kind>'). */
export function generateMereKin(scene: Phaser.Scene): void {
  for (const kind of Object.keys(MERE_LOOKS) as MereKind[]) generateBeast(scene, kind, mereSheet(kind), kind === 'merechief' ? 7 : 9, MERE_ANIMS);
}
