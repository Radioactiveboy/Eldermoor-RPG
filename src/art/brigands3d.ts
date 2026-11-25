import Phaser from 'phaser';
import { darker, type Tones } from './character';
import { BeastAnim, BeastSheet, chain, generateBeast, onItsSide, speck, V3 } from './beasts3d';
import { Detail, FrameSpec, generateFigure3D, Hit, limb, Material, Model, Pose3D, Solid } from './figure3d';
import { FINE_SPEC, shade } from './fine3d';
import { seatedLegs } from './models3d';
import { PALETTE as P } from './palette';

/**
 * The brigands holding out in the old beacon tower on Corbie Tor (see
 * world/BeaconMap.ts), drawn finely like the hero, the companions and the
 * goblins: their frames are BRIGAND_RES times bigger than they're shown, so
 * they carry stitching, rivets, mail, fur, tattoos, and faces with eye whites,
 * brows, beards and scars.
 *
 * Four of them: Corwin Haske, who kept this beacon for Lord Morten until the
 * lord stopped paying the watch, in his old faded watch tabard over mail, a
 * fur-collared cloak, a falchion and the warden's horn; Big Garth, a bald giant
 * in a fur-trimmed vest with tattooed arms and a great maul; Teg, hooded and
 * masked, with a hatchet in each hand and knives across his chest; and Linnet,
 * the band's lookout, a freckled red-haired archer with a longbow and a quiver.
 *
 * Each is drawn twice from the same model: standing about as folk do (the
 * '<folk-id>' sheets, see FINE_SPEC), and on a fighting sheet like the
 * goblins' (see {@link BRIGAND_FRAME}), with a wind-up, the blow and its
 * follow-through, a reel and a recovery, a stagger, a fall to the knees and a
 * slump, a jeer, and a blink and a breath while they wait.
 */

/** What a brigand is doing, in a fight: how the weapon arm goes and the body leans. */
type Act = 'rest' | 'ready' | 'windup' | 'strike' | 'follow' | 'hurt' | 'reel' | 'taunt' | 'slump';

/** What they fight with: also a Hook's gaff (a short haft with an iron hook) and a boathook (a long pole, hooked and spiked, used two-handed). */
type Weapon = 'falchion' | 'hatchets' | 'bow' | 'maul' | 'gaff' | 'boathook';

/** The little things that change from frame to frame of a loop. */
interface Flicker {
  blink?: boolean;
}

/** How a brigand is made up. */
export interface BrigandLook {
  skin: Tones;
  hair: Tones;
  /** Hair grey at the temples and in the beard. */
  grey?: Tones;
  /** Cut short and swept back and tied at the nape, cropped, or shaved bare. */
  hairStyle: 'tied' | 'crop' | 'bald';
  beard?: 'full' | 'stubble' | 'none' | 'moustache';
  /** The body garment: a tabard over mail, a fur-trimmed vest on bare arms, a strapped jerkin, or a jerkin under a short hooded cloak. */
  torso: 'tabard' | 'vest' | 'jerkin' | 'archer';
  cloth: Tones;
  trim: Tones;
  sleeve: Tones;
  trouser: Tones;
  boot: Tones;
  belt: Tones;
  weapon: Weapon;
  /** A long cloak down the back with a fur collar. */
  cloak?: Tones;
  /** A hood, up over the head. */
  hood?: Tones;
  /** A scarf tied over the nose and mouth. */
  mask?: Tones;
  /** A waterman's sou'wester, its brim wide and its back long (the Hooks', Gloomhaven's waterfront gang). */
  souwester?: Tones;
  /** A rag knotted at the throat (the Hooks wear rust-red). */
  rag?: Tones;
  /** Tattoo bands on bare arms. */
  tattoo?: number;
  freckles?: number;
  scar?: number;
  /** A gold ring in the left ear. */
  earring?: boolean;
  iris: number;
  brow: number;
  lip: number;
  /** Brows: positive is stern (outer ends up), negative worried. */
  browSlant: number;
  /** How much bigger than an ordinary man, and how much broader. */
  size?: number;
  bulk?: number;
}

const STEEL: Tones = [0xb8bcc6, 0x7a7e8a, 0xe4e8f0];
const IRON: Tones = [0x7a7c86, 0x4e505a, 0xa8acb6];
const DARK_IRON: Tones = [0x4e4e58, 0x30303a, 0x6e6e7a];
const MAIL: Tones = [P.ironLight, 0x6a6a76, 0xb8b8c4];
const RING: Tones = [0x6a6a76, 0x3a3a44, 0x8a8a96];
const GOLD: Tones = [P.gold, 0xa8802e, P.goldLight];
const WOOD: Tones = [P.bark, P.barkDark, P.barkLight];
const YEW: Tones = [0xa87a44, 0x7a5430, 0xc89a5e];
const FUR: Tones = [0x6a5a48, 0x463a2e, 0x8a7a64];
const FUR_LIGHT: Tones = [0x9a8a72, 0x6e604e, 0xb8a88e];
const HORN: Tones = [0xd8c8a0, 0xa8986e, 0xf0e4c4];
const FLETCH: Tones = [0xe8e0d0, 0xb8ae9c, 0xfffaf0];
const FLETCH_RED: Tones = [0xa83a2e, 0x7a261e, 0xc85a4a];
const RIVET = 0xc8ccd4;
const EYE_WHITE = 0xf0e6d8;
const PUPIL = 0x1e1418;

const knob = (p: V3, r: number, material: Material, soft = false): Solid => ({ cx: p[0], cy: p[1], cz: p[2], rx: r, ry: r, rz: r, material, soft });
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const along = (p: V3, d: V3, k: number): V3 => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
const lit = (t: Tones): Tones => [t[2], t[0], t[2]];

/**
 * How the body sits for each act: the lean forward at the shoulders, the
 * stance (stride, leading foot), how low it crouches, how far the head drops,
 * the mouth open (a shout), and eyes screwed shut.
 */
const BODY: Record<Act, { lean: number; stance: number | null; crouch: number; head: number; open: boolean; shut: boolean }> = {
  rest: { lean: 0, stance: null, crouch: 0, head: 0, open: false, shut: false },
  ready: { lean: 1.2, stance: 0.7, crouch: 1, head: 0, open: false, shut: false },
  windup: { lean: -0.9, stance: 0.9, crouch: 0.6, head: 0.2, open: true, shut: false },
  strike: { lean: 2.6, stance: 1, crouch: 1.5, head: -0.4, open: true, shut: false },
  follow: { lean: 3.4, stance: 1.1, crouch: 2, head: -0.8, open: false, shut: false },
  hurt: { lean: -2, stance: -0.5, crouch: 0.8, head: 0.3, open: true, shut: true },
  reel: { lean: -3.4, stance: -1, crouch: 1.2, head: 0.5, open: true, shut: true },
  taunt: { lean: -1, stance: 0.5, crouch: 0, head: 0.4, open: true, shut: false },
  slump: { lean: 4.4, stance: 0, crouch: 6.5, head: -1.4, open: false, shut: true },
};

/** Where the weapon arm's elbow and hand go for each act: x out from the body (times its side), y up, z forward of the shoulder. */
const WEAPON_ARM: Record<Act, { elbow: V3; hand: V3 }> = {
  rest: { elbow: [6, 20.2, 0.3], hand: [6.3, 16.6, 1] },
  ready: { elbow: [6.8, 19.8, 2], hand: [5.6, 21, 5.4] },
  windup: { elbow: [7.2, 25.6, -1.6], hand: [5.4, 30.4, -2.8] },
  strike: { elbow: [5.6, 22, 4.6], hand: [3.2, 19.6, 9.2] },
  follow: { elbow: [4.8, 17.6, 4.2], hand: [1.4, 13.4, 6.6] },
  hurt: { elbow: [7.2, 18.6, -1.2], hand: [8.8, 15.2, -2] },
  reel: { elbow: [7.8, 21.2, -2.4], hand: [9.8, 23.6, -3.8] },
  taunt: { elbow: [7.4, 26.8, 0.8], hand: [6.4, 32.2, 1.6] },
  slump: { elbow: [5.8, 14.6, 2], hand: [6, 9.4, 3.6] },
};

/** Which way a blade points from the hand, by act. */
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

const struck = (act: Act) => act === 'hurt' || act === 'reel' || act === 'slump';

/** Mail: rows of rings, light and dark by turns. */
function rings(h: Hit): Tones {
  return (Math.floor(h.x * 1.1 + h.z * 1.1) + Math.floor(h.y * 1.4)) % 2 ? MAIL : RING;
}

/**
 * One brigand in one pose. Body space as everywhere: x across (to screen-right
 * facing us), y up, z the way they face. `act` sets the weapon arm and how the
 * body leans and crouches for a fight.
 */
function brigandModel(pose: Pose3D, look: BrigandLook, act: Act = 'rest', fx: Flicker = {}): Model {
  const C = look;
  const body = BODY[act];
  const sit = !!pose.sit;
  const w = look.bulk ?? 1;
  const b = pose.bob + (sit ? 0 : body.crouch * 0.55);
  const s = body.stance ?? pose.stride;
  const solids: Solid[] = [];
  const details: Detail[] = [];
  const mark = (p: V3, color: number, size = 0.5) => details.push({ x: p[0], y: p[1], z: p[2], color, size });
  /** How far forward the body leans at a height: nothing at the hips, `lean` at the shoulders. */
  const lean = (y: number) => (sit ? 0 : body.lean * Math.max(0, (y - 12) / 12));
  const waist = 15.4 - b;

  // --- Legs: trousers into boots (or wrapped to the knee), bent as they crouch, kneeling as they fall.
  const bootTone = (h: Hit, top: number): Tones => (h.y > top - 0.7 ? shade(C.boot) : C.boot);
  if (sit) {
    solids.push(...seatedLegs(2.3 * w, C.trouser, C.boot, 1.85 * w));
    for (const side of [-1, 1]) solids.push(...limb([side * 2.3 * w, 8.2, 5.7], [side * 2.3 * w, 3.4, 5.8], 1.85 * w, 1.75 * w, C.boot));
  } else {
    for (const side of [-1, 1]) {
      const swing = s * side;
      const kneel = act === 'slump';
      const lift = swing < 0 && act === 'rest' ? 0.9 : 0;
      const hip: V3 = [side * 2.3 * w, 12.5 - b * 0.6, 0];
      const ankle: V3 = kneel ? [side * 2.4 * w, 1.4, -4.6 + swing] : [side * 2.3 * w, 3.4 + lift, swing * 2.4];
      const knee: V3 = kneel ? [side * 2.6 * w, 1.6, 2.6] : [side * 2.4 * w, (hip[1] + ankle[1]) / 2 + 0.3, (hip[2] + ankle[2]) / 2 + body.crouch * 0.55 + Math.max(0, swing) * 0.4];
      const bootTop = kneel ? 4 : 8.6;
      solids.push(...chain([hip, knee, ankle], [1.9 * w, 1.7 * w, 1.55 * w], (h) => (h.y < bootTop && !kneel ? bootTone(h, bootTop) : kneel && h.z < knee[2] - 2 ? C.boot : C.trouser), 0.45));
      if (!kneel) {
        const cuff = lerp3(knee, ankle, 0.08);
        solids.push({ cx: cuff[0], cy: Math.min(cuff[1], bootTop), cz: cuff[2], rx: 2 * w, ry: 0.7, rz: 2 * w, material: shade(C.boot) });
      }
      const foot: V3 = kneel ? [ankle[0], 0.9, ankle[2] - 0.8] : [ankle[0], 1 + lift, ankle[2] + 0.9];
      solids.push({ cx: foot[0], cy: foot[1], cz: foot[2], rx: 1.55 * w, ry: 1, rz: 2.3 * w, material: C.boot });
      // A buckle at the boot's top, and nails in the sole.
      if (!kneel) mark([side * (2.3 * w + 1.6 * w), 7.6, swing * 2.4 * 0.4 + 0.8], IRON[2]);
    }
  }

  // --- The skirts: mail to mid-thigh under the tabard, or the jerkin's hem.
  if (!sit && C.torso === 'tabard') {
    for (let y = 9.5; y <= 14; y += 0.5) {
      solids.push({ cx: 0, cy: y - b * 0.5, cz: s * 0.25 + lean(y) * 0.2, rx: (4.8 + (14 - y) * 0.13) * w, ry: 0.8, rz: (3.7 + (14 - y) * 0.06) * w, material: y < 10 ? shade(RING) : rings });
    }
  }
  if (!sit && C.torso !== 'vest') {
    // A split hem front and back, swinging with the stride.
    const hemTop = C.torso === 'tabard' ? 12.8 : 11.5;
    for (let y = hemTop - 2.5; y <= hemTop; y += 0.5) {
      const t = (hemTop - y) / 2.5;
      solids.push({
        cx: 0, cy: y - b * 0.5, cz: s * 0.4 * t, rx: (4.7 + t * 0.4) * w, ry: 0.8, rz: (3.75 + t * 0.2) * w,
        material: (h) => {
          if (C.torso === 'tabard' && Math.abs(h.nx) > 0.82) return rings(h);
          if (y < hemTop - 2.1) return C.trim;
          return C.cloth;
        },
      });
    }
  }

  // --- The body: what each wears over the chest, belted at the waist.
  const torso = (h: Hit): Tones => {
    const dy = h.y - waist;
    // The belt, with its buckle at the front.
    if (Math.abs(dy) < 0.85) {
      if (h.nz > 0.82 && Math.abs(h.x) < 1.05) return Math.abs(h.x) < 0.4 && Math.abs(dy) < 0.35 ? C.belt : GOLD;
      return Math.abs(dy) > 0.55 ? shade(C.belt) : C.belt;
    }
    switch (C.torso) {
      case 'tabard': {
        // Mail at the sides and the collar; the faded watch tabard front and back, edged in gold, the beacon's flame on the chest.
        if (Math.abs(h.nx) > 0.84) return rings(h);
        if (h.y > 24.4 - b && h.nz > -0.3) return rings(h);
        if (Math.abs(Math.abs(h.nx) - 0.8) < 0.045) return C.trim;
        const fx = h.x;
        const fy = h.y - (20.6 - b);
        if (h.nz > 0.55 && fy > -2.6 && fy < 2.6 && Math.abs(fx) < 1.6 - Math.max(0, fy) * 0.45 + Math.sin(fy * 2.4) * 0.25) return fy > 1 ? GOLD : lit(GOLD);
        // Wear and patching: paler where it has faded, a darned square low on the right.
        if (h.nz > 0.4 && fx < -1.6 && fx > -3.4 && dy > 1.4 && dy < 3.2) return Math.floor((fx + dy) * 3) % 2 ? shade(C.cloth) : C.cloth;
        return speck(h, 1.4) < 0.18 ? lit(C.cloth) : C.cloth;
      }
      case 'vest': {
        // An open fur-trimmed vest over a bare, hairy chest.
        if (h.nz > 0.5 && Math.abs(h.nx) < 0.34 && h.y < 25 - b) {
          if (Math.abs(Math.abs(h.nx) - 0.3) < 0.05) return speck(h, 0.6) < 0.5 ? FUR : FUR_LIGHT;
          if (speck(h, 0.5) < 0.12) return [darker(C.skin[1]), darker(darker(C.skin[1])), C.skin[1]];
          return C.skin;
        }
        if (h.y > 25.2 - b) return speck(h, 0.6) < 0.5 ? FUR : FUR_LIGHT;
        if (Math.abs(Math.abs(h.nx) - 0.86) < 0.05 && Math.floor(h.y * 2.4) % 2 === 0) return [0x2a1e14, 0x1a120c, C.cloth[1]];
        return speck(h, 1.1) < 0.12 ? shade(C.cloth) : C.cloth;
      }
      case 'jerkin': {
        // Dark leather, buckled straps crossing the chest with knives in loops along them.
        const strap = (k: number) => Math.abs(h.x - k * (h.y - (19.5 - b)) * 0.75);
        if (h.nz > 0.2 && h.y > waist && (strap(1) < 0.6 || strap(-1) < 0.6)) return strap(1) < 0.25 || strap(-1) < 0.25 ? shade(C.belt) : C.belt;
        if (Math.abs(Math.abs(h.nx) - 0.84) < 0.06) return shade(C.cloth);
        if (h.y > 25 - b && h.nz > -0.2) return C.trim;
        return speck(h, 1.2) < 0.14 ? lit(C.cloth) : C.cloth;
      }
      case 'archer': {
        // A laced leather jerkin, a green short cloak over the shoulders, the quiver's strap across from the right shoulder.
        if (h.nz > 0.2 && Math.abs(h.x + (h.y - (19.5 - b)) * 0.78) < 0.65 && h.y > waist) return C.belt;
        if (h.nz > 0.6 && Math.abs(h.x) < 0.3 && h.y > waist) return (h.y * 1.4) % 1.4 < 0.45 ? C.trim : shade(C.cloth);
        if (h.y > 23 - b) return C.sleeve;
        return C.cloth;
      }
    }
  };
  const tz = (y: number) => 0.1 + lean(y);
  solids.push({ cx: 0, cy: 14.4 - b * 0.6, cz: tz(14.4), rx: 4.6 * w, ry: 2.6, rz: 3.5 * w, material: torso });
  solids.push({ cx: 0, cy: 18.2 - b, cz: tz(18.2), rx: 4.6 * w, ry: 3.4, rz: 3.5 * w, material: torso });
  solids.push({ cx: 0, cy: 22.2 - b, cz: tz(22.2), rx: 5.1 * w, ry: 4.4, rz: 3.7 * w, material: torso });
  if (C.torso === 'vest') {
    // A slab of a chest, and the belly over the belt.
    solids.push({ cx: 0, cy: 16.6 - b, cz: tz(16.6) + 1.4 * w, rx: 4 * w, ry: 2.8, rz: 2.4 * w, material: torso });
  }
  // A pouch on the right hip, and a dagger on the left.
  solids.push({ cx: -3.9 * w, cy: waist - 1.6, cz: 2.2 * w + lean(waist), rx: 1.3, ry: 1.4, rz: 0.8, material: (h) => (h.y > waist - 1 ? shade(C.belt) : C.belt) });
  if (!sit) {
    solids.push(...limb([4.1 * w, waist - 0.5, 2.2 * w], [4.6 * w, waist - 4, 1.8 * w], 0.55, 0.4, shade(C.belt), 0.5));
    solids.push(knob([4.1 * w, waist + 0.6, 2.3 * w], 0.5, IRON));
  }

  // --- The cloak down the back, a fur collar round the shoulders.
  if (C.cloak) {
    const cl = C.cloak;
    const flutter = pose.flutter ?? 0;
    for (let y = sit ? 9 : 4.5; y <= 24.5; y += 0.5) {
      const t = (24.5 - y) / 20;
      const back = -3.6 * w - t * (1.2 + flutter * 0.5 + Math.abs(s) * 0.5) + lean(y) * 0.6;
      solids.push({
        cx: 0, cy: y - b * (1 - t * 0.4), cz: back, rx: (5.4 + t * 1.2) * w, ry: 0.8, rz: 1.1,
        material: (h) => (Math.floor((h.x + 20) * 0.8) % 3 === 0 ? shade(cl) : y < 5.5 ? shade(cl) : cl),
      });
    }
    // The fur collar.
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * 0.15 + (i / 11) * Math.PI * 1.7;
      solids.push(knob([Math.cos(a) * 4.4 * w, 25.6 - b, Math.sin(a) * -3.4 * w + lean(25) - 0.4], 1.5, i % 2 ? FUR : FUR_LIGHT));
    }
  }
  // The quiver on the back, its arrows fletched in white and red.
  if (C.weapon === 'bow') {
    const qa: V3 = [-2.4, 26.6 - b, -3.8 + lean(26)];
    const qb: V3 = [2.8, 13.6 - b, -3.6 + lean(14)];
    solids.push(...limb(qb, qa, 1.4, 1.5, (h) => (Math.abs(h.y - (qb[1] + 3)) < 0.5 || Math.abs(h.y - (qa[1] - 2)) < 0.5 ? shade(C.belt) : C.belt), 0.4));
    for (let i = 0; i < 5; i++) {
      const p: V3 = [qa[0] - 0.6 + i * 0.4, qa[1] + 1.4 + (i % 2) * 0.6, qa[2] - 0.3 + (i % 3) * 0.3];
      solids.push(...limb(lerp3(qa, p, 0.2), [p[0] - 0.4, p[1] + 1.6, p[2]], 0.45, 0.3, i % 2 ? FLETCH : FLETCH_RED, 0.3));
    }
  }
  // Garth's maul slung across the back when he isn't fighting? No: he carries it. The horn on Corwin's baldric.
  if (C.weapon === 'falchion') {
    // The baldric from the right shoulder to the left hip, with the warden's horn hung on it.
    const top: V3 = [-4.2, 25 - b, 2.4 + lean(25)];
    const bot: V3 = [4.4, waist + 0.6, 3 + lean(waist)];
    solids.push(...limb(top, bot, 0.55, 0.55, C.belt, 0.4));
    const hornAt: V3 = [5.6 * w, waist + 1.4, 1 + lean(waist)];
    solids.push(...chain([hornAt, [hornAt[0] + 0.4, hornAt[1] - 1.6, hornAt[2] - 1.6], [hornAt[0] + 0.2, hornAt[1] - 2.2, hornAt[2] - 3.4]], [0.9, 0.7, 0.45], (h) => (Math.floor(h.z * 1.6) % 3 === 0 ? GOLD : HORN), 0.3));
    solids.push(knob(hornAt, 1.05, GOLD));
  }

  // --- Arms. The weapon arm is the right (screen-left, facing us).
  const shoulderY = 24 - b;
  let weaponHand: V3 = [0, 0, 0];
  let offHand: V3 = [0, 0, 0];
  const dir = norm(BLADE[act]);
  for (const side of [-1, 1]) {
    const weapon = side === -1;
    const sz = 0.2 + lean(shoulderY);
    const shoulder: V3 = [side * 5.2 * w, shoulderY, sz];
    const at = (p: V3): V3 => [side * p[0] * w, p[1] - b, sz + p[2]];
    let elbow: V3;
    let hand: V3;
    const swing = act === 'rest' && !sit ? -s * side * 2 : 0;
    if (sit) {
      elbow = [side * 5.6 * w, 19.6 - b, 2];
      hand = [side * 3.6 * w, 12.6, 4.6];
    } else if (weapon && C.weapon === 'bow') {
      // The draw hand: to the cheek drawing back, open at the release, at the quiver after, idle at the side.
      const drawn = act === 'ready' || act === 'windup';
      elbow = drawn ? at([7.6, 26.4, -2.6]) : act === 'strike' ? at([6.6, 26, -1]) : act === 'follow' ? at([6.4, 25.4, -2.4]) : at(WEAPON_ARM[act].elbow);
      hand = drawn ? at([2.6, 31 - (act === 'ready' ? 1.2 : 0), act === 'ready' ? 3.4 : 1.2]) : act === 'strike' ? at([4.6, 30.4, -1.8]) : act === 'follow' ? at([2.4, 29, -3.6]) : at(WEAPON_ARM[act].hand);
      if (act === 'rest') {
        elbow = [side * 6 * w, 20.2 - b, 0.3 + swing * 0.5];
        hand = [side * 6.2 * w, 16.8 - b, 0.8 + swing];
      }
    } else if (!weapon && C.weapon === 'bow') {
      // The bow hand: held out at arm's length towards the foe while shooting, or holding the bow at the side.
      if (act === 'ready' || act === 'windup' || act === 'strike' || act === 'follow') {
        elbow = at([5.2, 27.6, 4.6]);
        hand = at([2.4, 29.4, 10.4]);
      } else if (act === 'rest') {
        elbow = [side * 6 * w, 20.2 - b, 0.3 + swing * 0.5];
        hand = [side * 6.4 * w, 16.6 - b, 1.2 + swing];
      } else {
        elbow = at([7.4, 19, -1]);
        hand = at([8.8, 16.4, -1.6]);
      }
    } else if (weapon) {
      elbow = at(WEAPON_ARM[act].elbow);
      hand = at(WEAPON_ARM[act].hand);
      if (act === 'rest') {
        elbow = [elbow[0], elbow[1], elbow[2] + swing * 0.4];
        hand = [hand[0], hand[1], hand[2] + swing * 0.6];
      }
    } else if ((C.weapon === 'maul' || C.weapon === 'boathook') && !struck(act)) {
      // Both hands on the maul's haft, the left lower down.
      const wa = WEAPON_ARM[act];
      const right: V3 = [-wa.hand[0] * w, wa.hand[1] - b, sz + wa.hand[2]];
      const d = act === 'rest' ? norm([0.1, -0.8, 0.6]) : dir;
      hand = along(right, d, -3.6);
      hand[0] = Math.max(hand[0], 1.4 * w);
      elbow = lerp3(shoulder, hand, 0.5);
      elbow = [elbow[0] + 1.8 * w, elbow[1] - 1.6, elbow[2] - 0.4];
    } else if (C.weapon === 'hatchets') {
      // The second hatchet, mirroring the first a beat behind.
      const mirror: Record<Act, Act> = { rest: 'rest', ready: 'ready', windup: 'ready', strike: 'windup', follow: 'strike', hurt: 'hurt', reel: 'reel', taunt: 'ready', slump: 'slump' };
      const wa = WEAPON_ARM[mirror[act]];
      elbow = at(wa.elbow);
      hand = at(wa.hand);
      if (act === 'rest') {
        elbow = [elbow[0], elbow[1], elbow[2] + swing * 0.4];
        hand = [hand[0], hand[1], hand[2] + swing * 0.6];
      }
    } else if (struck(act) && act !== 'slump') {
      elbow = at([7.4, 19.4, -0.8]);
      hand = at([9, 16.6, -1.8]);
    } else if (act === 'slump') {
      elbow = at([5.6, 14.6, 2]);
      hand = at([5.8, 9.2, 3.4]);
    } else if (act === 'rest') {
      elbow = [side * 6 * w, 20.2 - b, 0.3 + swing * 0.5];
      hand = [side * 6.2 * w, 16.8 - b, 0.8 + swing];
    } else if (act === 'taunt') {
      // The off hand beckoning, palm up.
      elbow = at([6.6, 19.8, 2.4]);
      hand = at([5.6, 20.6, 6.6]);
    } else {
      // Guard up.
      elbow = at([6.6, 19.6, 2.2]);
      hand = at([4.4, 21.8, 5.4]);
    }
    // Sleeves: mail on Corwin, bare tattooed arms on Garth, leather on the others; a bracer on the archer's bow arm.
    const bare = C.torso === 'vest';
    const upper = (h: Hit): Tones => {
      if (C.torso === 'tabard') return rings(h);
      if (bare) {
        const band = C.tattoo !== undefined && Math.abs(h.y - (shoulderY - 2.6)) < 0.55 && Math.floor((h.x + h.z) * 2) % 3 !== 0;
        return band ? [C.tattoo!, darker(C.tattoo!), C.tattoo!] : C.skin;
      }
      return C.sleeve;
    };
    solids.push(knob(shoulder, 2.2 * w, bare ? FUR : C.torso === 'tabard' ? rings : C.torso === 'archer' ? C.sleeve : torso));
    solids.push(...limb(shoulder, elbow, 1.85 * w, 1.65 * w, upper, 0.45));
    const forearm = limb(elbow, hand, 1.65 * w, 1.5 * w, upper, 0.45);
    forearm.forEach((f, i) => {
      const t = i / Math.max(1, forearm.length - 1);
      // Leather bracers or wraps from mid-forearm to the wrist.
      if (t > 0.35) {
        const wrap: Tones = C.torso === 'vest' ? [0x9a8a6c, 0x6e6250, 0xb4a484] : C.torso === 'archer' && !weapon ? C.belt : shade(C.boot);
        solids.push({ ...f, rx: f.rx + 0.15, ry: f.ry + 0.15, rz: f.rz + 0.15, material: (h) => (Math.floor(h.y * 1.8 + h.x * 0.5) % 2 === 0 ? wrap : shade(wrap)) });
      } else solids.push(f);
    });
    // The hand: a fist (gloved for Corwin and Teg).
    const glove: Tones = C.torso === 'tabard' || C.torso === 'jerkin' ? [0x2e221c, 0x1e1612, 0x443428] : C.skin;
    solids.push({ cx: hand[0], cy: hand[1] - 0.6, cz: hand[2] + 0.4, rx: 1.45 * w, ry: 1.45 * w, rz: 1.55 * w, material: glove });
    for (const k of [-0.6, 0, 0.6]) mark([hand[0] + k * w, hand[1] - 0.4, hand[2] + 1.9 * w], darker(glove[1]));
    // Mail shoulder caps and rivets for Corwin.
    if (C.torso === 'tabard') {
      solids.push({ cx: side * 5 * w, cy: shoulderY + 0.9, cz: sz, rx: 2.8 * w, ry: 1.7, rz: 2.8 * w, material: (h) => (h.y < shoulderY + 0.1 ? shade(C.belt) : C.belt) });
      for (const dz of [-1.1, 1.1]) mark([side * 6.7 * w, shoulderY + 1, sz + dz], RIVET);
    }
    if (weapon) weaponHand = [hand[0], hand[1] - 0.6, hand[2] + 0.4];
    else offHand = [hand[0], hand[1] - 0.6, hand[2] + 0.4];
  }

  // --- Head.
  const hy = 32.4 - b + body.head;
  const hz = 0.4 + lean(32) * 1.05;
  const head = { rx: 5.1, ry: 5.6, rz: 5 };
  solids.push(...limb([0, 26.4 - b, 0.3 + lean(26)], [0, hy - 3.4, hz - 0.4], 2.1 * w, 2, C.skin, 0.5));
  const hair = (h: Hit): Tones => {
    const py = h.y - hy;
    const temple = Math.abs(h.nx) > 0.78 && py > -2 && py < 2.6;
    const g = C.grey && (temple || (py < -2 && speck(h, 0.6) < 0.22) || speck(h, 0.6) < 0.06) ? C.grey : C.hair;
    return (Math.floor(h.x * 1.6 + h.z * 0.4 + h.y * 0.3) & 1) === 0 ? g : shade(g);
  };
  const face = (h: Hit): Tones => {
    const py = h.y - hy;
    if (C.hairStyle !== 'bald') {
      const crown = C.hairStyle === 'crop' ? 2.6 : 2.2;
      if (py > crown - Math.max(0, h.x) * 0.15) return hair(h);
      if (h.nz < -0.15 || (Math.abs(h.nx) > 0.72 && py > -1.8)) return hair(h);
    } else if (h.nz < -0.4 && py < -1 && C.beard === 'full') {
      return hair(h);
    }
    // Stubble and beard over the jaw.
    if (C.beard && C.beard !== 'none' && py < -1.2 + (C.beard === 'full' ? 0.4 : 0) && h.nz > -0.3) {
      if (C.beard === 'full' && !(py > -2.6 && py < -1.7 && Math.abs(h.x) < 1.3)) return hair(h);
      if (C.beard === 'stubble' && speck(h, 0.5) < 0.55) return [darker(C.skin[1]), darker(darker(C.skin[1])), C.skin[1]];
    }
    // A bald pate catching the light.
    if (C.hairStyle === 'bald' && py > 3.2 && h.nz > -0.2 && h.nx < -0.1) return lit(C.skin);
    return C.skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: head.rx, ry: head.ry, rz: head.rz, material: face, soft: true });
  // The nose, broader and broken for Garth.
  solids.push({ cx: 0, cy: hy + 0.1, cz: hz + 5, rx: C.size && C.size > 1 ? 1.1 : 0.85, ry: 1.1, rz: 0.85, material: C.skin, soft: true });
  // Ears.
  for (const side of [-1, 1]) solids.push({ cx: side * 5, cy: hy + 0.1, cz: hz + 0.2, rx: 0.65, ry: 1.2, rz: 0.9, material: C.skin, soft: true });
  // Hair: a fuller crown, tied back in a short tail; cropped close; or none.
  if (C.hairStyle === 'tied') {
    solids.push({ cx: 0, cy: hy + 2.3, cz: hz - 0.9, rx: 5.4, ry: 3.8, rz: 5.2, material: hair });
    solids.push(...chain([[0, hy + 0.6, hz - 5], [0, hy - 2.4, hz - 6], [0, hy - 5, hz - 6.2]], [1.4, 1.1, 0.7], hair, 0.35));
    solids.push({ cx: 0, cy: hy - 0.6, cz: hz - 5.5, rx: 0.9, ry: 0.5, rz: 0.9, material: C.belt });
  } else if (C.hairStyle === 'crop') {
    solids.push({ cx: 0, cy: hy + 2.5, cz: hz - 0.6, rx: 5.3, ry: 3.5, rz: 5.1, material: hair });
    // A fringe over the brow.
    for (const x of [-2.4, -0.8, 0.8, 2.2]) solids.push({ cx: x, cy: hy + 3.8, cz: hz + 3.9, rx: 1.2, ry: 0.9, rz: 0.9, material: hair });
  }
  // A full beard: jutting out from the chin.
  if (C.beard === 'full') {
    solids.push({ cx: 0, cy: hy - 4.2, cz: hz + 2.6, rx: 3.8, ry: 2.8, rz: 2.6, material: hair, soft: true });
    solids.push({ cx: 0, cy: hy - 6, cz: hz + 2.4, rx: 2.4, ry: 2, rz: 1.8, material: hair, soft: true });
    // A moustache over the mouth.
    for (const side of [-1, 1]) solids.push({ cx: side * 1.2, cy: hy - 1.5, cz: hz + 4.9, rx: 1.3, ry: 0.55, rz: 0.6, material: hair, soft: true });
  }
  // A waxed moustache, curled at the ends.
  if (C.beard === 'moustache') {
    for (const side of [-1, 1]) {
      solids.push({ cx: side * 1.1, cy: hy - 1.4, cz: hz + 4.9, rx: 1.2, ry: 0.45, rz: 0.55, material: hair, soft: true });
      solids.push({ cx: side * 2.3, cy: hy - 1.0, cz: hz + 4.4, rx: 0.5, ry: 0.5, rz: 0.4, material: hair, soft: true });
    }
  }
  // A sou'wester: a round crown, and a wide brim that runs long down the back of the neck.
  if (C.souwester) {
    const sw = C.souwester;
    const wet = (h: Hit): Tones => (speck(h, 1.2) < 0.1 ? lit(sw) : h.ny < -0.2 ? shade(sw) : sw);
    solids.push({ cx: 0, cy: hy + 3, cz: hz - 0.5, rx: 5.6, ry: 3.6, rz: 5.4, material: wet });
    solids.push({ cx: 0, cy: hy + 2.2, cz: hz - 1.6, rx: 7.6, ry: 0.6, rz: 7.8, material: wet });
    solids.push({ cx: 0, cy: hy + 0.6, cz: hz - 5.4, rx: 5.8, ry: 1.8, rz: 2.4, material: wet });
  }
  // A rag knotted at the throat, its ends hanging.
  if (C.rag) {
    const rg = C.rag;
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * 0.1 + (i / 9) * Math.PI * 1.8;
      solids.push(knob([Math.cos(a) * 2.5, 26.9 - b, Math.sin(a) * 2.3 + lean(27) + 0.3], 1, i % 2 ? rg : shade(rg)));
    }
    solids.push(knob([0.4, 26.6 - b, 2.8 + lean(27)], 1.2, rg));
    solids.push(...limb([0.4, 26.2 - b, 3 + lean(26)], [1.2, 23.4 - b, 3.6 + lean(23)], 0.6, 0.4, shade(rg), 0.3));
  }
  // The hood, up over the head and falling round the shoulders.
  if (C.hood) {
    const hd = C.hood;
    const hoodTone = (h: Hit): Tones => (h.nz > 0.6 && h.y < hy + 4 ? shade(hd) : speck(h, 1.3) < 0.12 ? lit(hd) : hd);
    solids.push({ cx: 0, cy: hy + 1.2, cz: hz - 0.9, rx: 5.9, ry: 6.3, rz: 5.4, material: hoodTone });
    solids.push(...chain([[0, hy + 5.6, hz - 3], [0, hy + 4.6, hz - 6], [0, hy + 1.6, hz - 7]], [1.6, 1.2, 0.7], hd, 0.4));
    for (let y = shoulderY - 1; y <= shoulderY + 3.5; y += 0.5) solids.push({ cx: 0, cy: y, cz: lean(y) - 0.4, rx: 6 * w, ry: 0.8, rz: 4.4 * w, material: hd });
  }
  // The archer's hood, down on her shoulders.
  if (C.torso === 'archer') {
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * 0.2 + (i / 9) * Math.PI * 1.6;
      solids.push(knob([Math.cos(a) * 4.6, 26.2 - b, Math.sin(a) * -3.6 + lean(26)], 1.5, i % 2 ? C.sleeve : shade(C.sleeve)));
    }
    solids.push({ cx: 0, cy: 26 - b, cz: -4.8 + lean(26), rx: 3.4, ry: 2.4, rz: 1.6, material: C.sleeve });
  }

  // --- The face: eyes, brows, a mouth, and their own marks.
  const onFace = (x: number, dy: number, lift = 0.1): V3 => [x, hy + dy, hz + head.rz * Math.sqrt(Math.max(0, 1 - (x / head.rx) ** 2 - (dy / head.ry) ** 2)) + lift];
  const shut = body.shut || !!fx.blink;
  for (const side of [-1, 1]) {
    const ex = side * 1.9;
    if (shut) {
      for (const dx of [-0.5, 0, 0.5]) mark(onFace(ex + dx, 0.8), darker(C.skin[1]));
    } else {
      mark(onFace(ex, 1.1), PUPIL);
      mark(onFace(ex, 0.6), C.iris);
      mark(onFace(ex - side * 0.5, 1.1), EYE_WHITE);
      mark(onFace(ex + side * 0.5, 1.1), EYE_WHITE);
    }
    // Brows: knitted lower when fighting.
    const drop = act === 'rest' ? 0 : struck(act) ? 0.2 : -0.25;
    for (const dx of [-0.5, 0, 0.5]) mark(onFace(ex + dx * side, 2 + drop + dx * C.browSlant), C.brow);
    // Crow's feet for the older men.
    if (C.grey) mark(onFace(ex + side * 1.1, 0.5), darker(C.skin[1]));
  }
  if (!C.mask) {
    if (body.open) {
      for (const x of [-0.5, 0, 0.5]) mark(onFace(x, -2.1), 0x3a1a1c);
      for (const x of [-0.5, 0.5]) mark(onFace(x, -1.7), EYE_WHITE);
      mark(onFace(0, -2.6), 0x3a1a1c);
    } else {
      for (const x of [-0.5, 0, 0.5]) mark(onFace(x, -2.1), C.lip);
    }
    if (C.size && C.size > 1) {
      // Garth's broken nose: a bend, and a scar across the bridge.
      mark(onFace(0.5, 0.4, 0.95), darker(C.skin[1]));
      mark(onFace(-0.5, 0.3, 0.95), darker(C.skin[1]));
    }
  }
  if (C.freckles !== undefined) {
    for (const [x, dy] of [[-2.4, -0.4], [-1.6, -0.9], [-2.9, -1.1], [2.4, -0.4], [1.6, -0.9], [2.9, -1.1], [-0.5, 0.3], [0.5, 0.3], [-1.2, -0.2], [1.2, -0.2]]) mark(onFace(x, dy), C.freckles);
  }
  if (C.scar !== undefined) {
    for (const [x, dy] of [[-3.1, 2.4], [-3.0, 1.8], [-2.9, 0.1], [-2.8, -0.4], [-2.6, -0.9], [-2.4, -1.4], [-2.1, -1.9]]) mark(onFace(x, dy), C.scar);
  }
  if (C.mask) {
    // A dark scarf tied over the nose and mouth, its knot and tails at the back.
    const m = C.mask;
    solids.push({ cx: 0, cy: hy - 1.8, cz: hz + 0.3, rx: 5.35, ry: 3, rz: 5.3, material: (h) => (h.nz < -0.3 ? hd(h) : Math.floor((h.y - hy) * 2.2) % 3 === 0 ? shade(m) : m), soft: true });
    solids.push({ cx: 0, cy: hy - 0.6, cz: hz + 5.2, rx: 1.4, ry: 1.2, rz: 0.8, material: m, soft: true });
  }
  function hd(h: Hit): Tones {
    return C.hood ? (speck(h, 1) < 0.2 ? lit(C.hood) : C.hood) : C.mask!;
  }
  if (C.earring) {
    for (const [dx, dy] of [[0, 0.5], [0.3, 0.1], [0.2, -0.4], [-0.2, -0.4], [-0.3, 0.1]]) mark([5.25, hy - 1.3 + dy, hz + 0.6 + dx], P.gold);
  }

  // --- What they carry.
  solids.push(...weaponSolids(C.weapon, weaponHand, offHand, act, dir, mark, w));
  return { solids, details };
}

type Mark = (p: V3, color: number, size?: number) => void;

/**
 * Which way a weapon `len` long points from a hand at height `y`: as wanted,
 * unless that would drive its head into the ground, when it swings up to rest there.
 */
function aim(y: number, len: number, want: V3, floor = 1): V3 {
  if (y + want[1] * len >= floor) return want;
  const dy = Math.max(-1, (floor - y) / len);
  const flat = Math.hypot(want[0], want[2]) || 1;
  const k = Math.sqrt(Math.max(0, 1 - dy * dy)) / flat;
  return [want[0] * k, dy, want[2] * k];
}

function weaponSolids(weapon: Weapon, h: V3, off: V3, act: Act, blade: V3, mark: Mark, w: number): Solid[] {
  const out: Solid[] = [];
  switch (weapon) {
    case 'falchion': {
      // A broad, single-edged blade swelling towards a clipped point, a brass crossguard and a wrapped grip.
      const d = aim(h[1], 12, blade);
      out.push(...limb(along(h, d, -1.4), along(h, d, 0.9), 0.5, 0.5, (hh) => (Math.floor((hh.x + hh.y + hh.z) * 2.6) % 2 ? [0x3a2a22, 0x241a14, 0x54402e] : [0x5a4232, 0x3e2c22, 0x74583e]), 0.25));
      out.push(knob(along(h, d, -1.7), 0.75, GOLD));
      const across = norm([d[2] || 0.0001, 0, -d[0]]);
      for (let i = -3; i <= 3; i++) out.push(knob(along(along(h, d, 1.1), across, i * 0.45), 0.42, GOLD));
      for (let i = 0; i <= 14; i++) {
        const t = 1.5 + i * 0.68;
        const swell = 0.9 + Math.sin((i / 14) * Math.PI * 0.85) * 0.75 - (i > 12 ? (i - 12) * 0.35 : 0);
        const c = along(h, d, t);
        out.push({
          cx: c[0], cy: c[1], cz: c[2], rx: 0.4, ry: swell, rz: swell,
          material: (hh) => {
            // The edge bright, a fuller down the flat, a few nicks.
            const fromSpine = (hh.y - c[1]) * (d[2] > 0 ? 1 : -1);
            if (speck(hh, 0.5) < 0.05) return DARK_IRON;
            return fromSpine < -swell * 0.5 ? [0xe8ecf4, STEEL[0], 0xffffff] : Math.abs(fromSpine) < 0.2 ? shade(STEEL) : STEEL;
          },
          soft: true,
        });
      }
      return out;
    }
    case 'hatchets': {
      // A hatchet in each hand: hickory handles, bearded iron heads with bright edges.
      for (const [hand, a] of [[h, act], [off, act === 'strike' ? 'windup' : act === 'follow' ? 'strike' : act]] as Array<[V3, Act]>) {
        const d = aim(hand[1], 6.4, norm(BLADE[a]));
        const tip = along(hand, d, 5.2);
        out.push(...limb(along(hand, d, -0.9), tip, 0.48, 0.48, (hh) => (speck(hh, 0.5) < 0.15 ? shade(WOOD) : WOOD), 0.3));
        out.push({ cx: tip[0], cy: tip[1] - 0.2, cz: tip[2] + 1.1, rx: 0.45, ry: 1.7, rz: 1.5, material: (hh) => (hh.z > tip[2] + 1.9 ? [0xe8ecf4, STEEL[0], 0xffffff] : DARK_IRON), soft: true });
        out.push(knob(along(hand, d, 4.2), 0.55, shade(WOOD)));
      }
      return out;
    }
    case 'gaff': {
      // A short ash haft, bound with tarred twine, ending in an iron hook with a bright point.
      const d = aim(h[1], 9, blade);
      const top = along(h, d, 6);
      out.push(...limb(along(h, d, -1.2), top, 0.5, 0.45, (hh) => (speck(hh, 0.6) < 0.25 ? [0x2a221e, 0x1a1412, 0x3e3430] : WOOD), 0.3));
      const up: V3 = norm([-d[0] * d[1], 1 - d[1] * d[1], -d[2] * d[1]]);
      const curve: V3[] = [top, along(top, d, 1.6), along(along(top, d, 2.4), up, 0.9), along(along(top, d, 2.2), up, 2.1), along(along(top, d, 1.2), up, 2.6), along(along(top, d, 0.4), up, 2.3)];
      out.push(...chain(curve, [0.55, 0.5, 0.45, 0.4, 0.32, 0.22], (hh) => (speck(hh, 0.5) < 0.2 ? [0x8a5a3a, 0x5e3c26, 0xb07a4e] : DARK_IRON), 0.3));
      out.push(knob(curve[5], 0.25, STEEL));
      return out;
    }
    case 'boathook': {
      // A boathook: a long ash pole, an iron spike at the end and a hook curling back from it.
      const d = act === 'rest' ? norm([0.06, -0.85, 0.5]) : aim(h[1], 16 * w, blade, 2.6);
      const head = act === 'rest' ? ([h[0] + 0.4, 1.2, h[2] + 6] as V3) : along(h, d, 12 * w);
      const pole = norm([head[0] - h[0], head[1] - h[1], head[2] - h[2]]);
      const butt = along(h, pole, -9);
      const tipEnd = act === 'rest' ? along(h, norm([0.02, 1, -0.1]), 14) : head;
      const from = act === 'rest' ? head : butt;
      out.push(...limb(from, tipEnd, 0.55, 0.55, (hh) => (Math.floor((hh.x + hh.y + hh.z) * 1.4) % 7 === 0 ? [0x2a221e, 0x1a1412, 0x3e3430] : WOOD), 0.4));
      const dd = norm([tipEnd[0] - from[0], tipEnd[1] - from[1], tipEnd[2] - from[2]]);
      const side: V3 = norm([dd[2] || 0.001, 0, -dd[0]]);
      const spike = along(tipEnd, dd, 2.2);
      out.push(...limb(tipEnd, spike, 0.55, 0.15, DARK_IRON, 0.3));
      const hook: V3[] = [along(tipEnd, dd, 0.4), along(along(tipEnd, dd, 0.2), side, 1.4), along(along(tipEnd, dd, -0.8), side, 2), along(along(tipEnd, dd, -1.8), side, 1.5)];
      out.push(...chain(hook, [0.55, 0.45, 0.35, 0.2], DARK_IRON, 0.3));
      out.push(knob(hook[3], 0.22, STEEL));
      return out;
    }
    case 'maul': {
      // A great two-handed maul: an ash haft bound in iron, a squared iron head, studded.
      const d = act === 'rest' ? norm([0.08, -0.8, 0.6]) : aim(h[1], 13 * w, blade, 2.6);
      const head = act === 'rest' ? ([h[0] + 0.6, 2.4, h[2] + 4.6] as V3) : along(h, d, 11 * w);
      const butt = along(h, norm([head[0] - h[0], head[1] - h[1], head[2] - h[2]]), -4.5);
      out.push(...limb(butt, head, 0.6, 0.65, (hh) => (Math.floor((hh.x + hh.y + hh.z) * 1.8) % 4 === 0 ? IRON : WOOD), 0.35));
      const dd = norm([head[0] - butt[0], head[1] - butt[1], head[2] - butt[2]]);
      for (let i = 0; i < 5; i++) {
        const c = along(head, dd, -1.6 + i * 0.8);
        out.push({ cx: c[0], cy: c[1], cz: c[2], rx: 2.2 * w, ry: 2.2 * w, rz: 2.2 * w, material: (hh) => (speck(hh, 0.8) < 0.12 ? [0x8a5a3a, 0x5e3c26, 0xb07a4e] : DARK_IRON) });
      }
      for (let a = 0; a < 6; a++) mark([head[0] + Math.cos(a) * 2.4 * w, head[1] + Math.sin(a) * 1.6, head[2] + Math.sin(a * 1.7) * 2.2 * w], RIVET);
      return out;
    }
    case 'bow': {
      // A yew longbow, as tall as she is: held upright, drawn, or loosed; an arrow nocked while she aims.
      const shooting = act === 'ready' || act === 'windup' || act === 'strike' || act === 'follow';
      const grip = off;
      const up: V3 = shooting ? norm([0.05, 1, 0.12]) : act === 'rest' ? norm([0.06, 1, 0.1]) : norm([0.4, 0.9, -0.3]);
      const drawn = act === 'windup' ? 4.6 : act === 'ready' ? 3 : 0;
      const half = 14;
      const tip = (k: number): V3 => {
        const t = k / half;
        const bend = (1 - t * t) * (1.4 + drawn * 0.25);
        return [grip[0] + up[0] * k, grip[1] + up[1] * k, grip[2] + up[2] * k - bend + 1.4];
      };
      for (let k = -half; k <= half; k += 0.5) {
        const p = tip(k);
        const r = 0.55 - Math.abs(k / half) * 0.25;
        out.push({ ...knob(p, r, Math.abs(k) < 1.2 ? [0x5a4232, 0x3e2c22, 0x74583e] : YEW), soft: true });
      }
      // The string: from tip to tip, pulled back to the draw hand.
      const top = tip(half);
      const bot = tip(-half);
      const nock: V3 = drawn > 0 ? [h[0], h[1], h[2]] : lerp3(top, bot, 0.5);
      for (const end of [top, bot]) out.push(...limb(end, nock, 0.12, 0.12, [0xe8e0c8, 0xb8ae94, 0xfff8e4], 0.4));
      if (drawn > 0) {
        // The arrow, nocked, its head past the bow.
        const head: V3 = [grip[0] + 0.2, grip[1] + 0.3, grip[2] + 3];
        out.push(...limb(nock, head, 0.18, 0.18, WOOD, 0.4));
        out.push({ cx: head[0], cy: head[1], cz: head[2] + 0.4, rx: 0.4, ry: 0.5, rz: 0.9, material: STEEL, soft: true });
        out.push(...limb(nock, along(nock, norm([head[0] - nock[0], head[1] - nock[1], head[2] - nock[2]]), 1.6), 0.45, 0.3, FLETCH_RED, 0.3));
      }
      return out;
    }
  }
}

// --- The four of them ----------------------------------------------------------

/** Corwin Haske, once warden of the beacon: grey-shot black hair tied back, a full beard, the watch's faded blue tabard over mail, a fur-collared cloak, and a falchion. */
export const CORWIN: BrigandLook = {
  skin: [0xd8a888, 0xae8064, 0xeac0a0],
  hair: [0x2a2226, 0x1a1418, 0x3e3438],
  grey: [0x8a8488, 0x5e5a5e, 0xaaa4a8],
  hairStyle: 'tied',
  beard: 'full',
  torso: 'tabard',
  cloth: [0x4a5e86, 0x34445e, 0x6278a0],
  trim: [0xb89a4a, 0x8a7034, 0xd8ba64],
  sleeve: MAIL,
  trouser: [0x3a3236, 0x282226, 0x4e4448],
  boot: [0x3e2c22, 0x281c16, 0x5a4232],
  belt: [0x4a3424, 0x30221a, 0x644a34],
  weapon: 'falchion',
  cloak: [0x5a2e2a, 0x3e1e1c, 0x744038],
  scar: 0xe0a890,
  earring: true,
  iris: 0x5a6a7a,
  brow: 0x2a2226,
  lip: 0x9a5a50,
  browSlant: 0.55,
};

/** Big Garth: a bald giant with a black beard, a fur-trimmed vest on bare tattooed arms, wrapped forearms, and a maul. */
export const GARTH: BrigandLook = {
  skin: [0xc89070, 0x9e6a50, 0xdeaa88],
  hair: [0x221a18, 0x140e0c, 0x3a2e2a],
  hairStyle: 'bald',
  beard: 'full',
  torso: 'vest',
  cloth: [0x5e4632, 0x402e20, 0x7a5c42],
  trim: FUR,
  sleeve: [0xc89070, 0x9e6a50, 0xdeaa88],
  trouser: [0x4a4034, 0x302820, 0x625646],
  boot: [0x4a3828, 0x30241a, 0x645038],
  belt: [0x3a2a1e, 0x241a12, 0x54402e],
  weapon: 'maul',
  tattoo: 0x2e4a6a,
  iris: 0x4a3a2a,
  brow: 0x221a18,
  lip: 0x8a5040,
  browSlant: 0.2,
  size: 1.14,
  bulk: 1.22,
};

/** Teg: lean and quiet, hooded and masked in charcoal, a strapped jerkin with knives along the straps, a hatchet in each hand. */
export const TEG: BrigandLook = {
  skin: [0xe0b090, 0xb88a6c, 0xf0c8a8],
  hair: [0x4a3a2a, 0x30241a, 0x645040],
  hairStyle: 'crop',
  beard: 'stubble',
  torso: 'jerkin',
  cloth: [0x3a3436, 0x262224, 0x524a4c],
  trim: [0x2e2a2c, 0x1e1a1c, 0x423c3e],
  sleeve: [0x463e3a, 0x2e2826, 0x5e5450],
  trouser: [0x4a4a52, 0x32323a, 0x62626a],
  boot: [0x2e2420, 0x1e1814, 0x463830],
  belt: [0x5a3e2a, 0x3e2a1c, 0x765438],
  weapon: 'hatchets',
  hood: [0x34363e, 0x22242a, 0x4c4e58],
  mask: [0x2a2a30, 0x1a1a20, 0x40404a],
  iris: 0x6a7a5a,
  brow: 0x3a2e22,
  lip: 0xa06a5a,
  browSlant: 0.6,
  bulk: 0.94,
};

/** Linnet, the lookout: cropped red hair and freckles, a green hood down on her shoulders, a laced jerkin, a quiver, and a yew longbow. */
export const LINNET: BrigandLook = {
  skin: [0xf0c8a8, 0xc8a084, 0xffdcc0],
  hair: [0xb4502a, 0x84381e, 0xd4703e],
  hairStyle: 'crop',
  beard: 'none',
  torso: 'archer',
  cloth: [0x6e5038, 0x4a3626, 0x8a6a4a],
  trim: [0xc8b088, 0x9a8462, 0xe0caa2],
  sleeve: [0x3e6a3a, 0x2a4a28, 0x588a4e],
  trouser: [0x4e4234, 0x342a20, 0x665846],
  boot: [0x5a4232, 0x3e2c22, 0x74583e],
  belt: [0x4a3424, 0x30221a, 0x644a34],
  weapon: 'bow',
  freckles: 0xd0906a,
  iris: 0x5a7a4a,
  brow: 0x9a4024,
  lip: 0xc07a6a,
  browSlant: -0.2,
  bulk: 0.9,
};

/** The brigands as foes (see systems/Combat.ts FOES), and their looks. */
export type BrigandKind = 'brigandcaptain' | 'brigandbrute' | 'brigandcutter' | 'brigandarcher';

export const BRIGAND_LOOKS: Record<BrigandKind, BrigandLook> = {
  brigandcaptain: CORWIN,
  brigandbrute: GARTH,
  brigandcutter: TEG,
  brigandarcher: LINNET,
};

/** Every solid and detail scaled up about the feet. */
function grown(m: Model, k: number): Model {
  if (k === 1) return m;
  const mat = (mm: Material): Material => (typeof mm === 'function' ? (h: Hit) => mm({ ...h, x: h.x / k, y: h.y / k, z: h.z / k }) : mm);
  return {
    solids: m.solids.map((s) => ({ ...s, cx: s.cx * k, cy: s.cy * k, cz: s.cz * k, rx: s.rx * k, ry: s.ry * k, rz: s.rz * k, material: mat(s.material) })),
    details: m.details.map((d) => ({ ...d, x: d.x * k, y: d.y * k, z: d.z * k })),
  };
}

/** One brigand standing about, as folk are drawn (for their 'folk-<id>' figures). */
export function brigandFolkModel(look: BrigandLook): (pose: Pose3D) => Model {
  return (pose) => grown(brigandModel(pose, look), look.size ?? 1);
}

/** How many times finer than they're shown the brigands' fighting sheets are drawn (like the hero's, see fine3d.ts). */
export const BRIGAND_RES = 2;

/** A brigand's fighting frame as shown: wide enough to fit them lying down, tall enough for a maul overhead. */
export function brigandShownSpec(kind: BrigandKind): FrameSpec {
  return shownSpec(kind === 'brigandbrute');
}

/** A fighting frame as shown, for anyone on the brigands' frame: a big one (a brute) needs more room. */
export function shownSpec(big: boolean): FrameSpec {
  return big ? { w: 72, h: 72, feetY: 66, groundShade: 5, creases: true } : { w: 64, h: 64, feetY: 58, groundShade: 4, creases: true };
}

export function brigandSpec(kind: BrigandKind): FrameSpec {
  return fineSpec(brigandShownSpec(kind));
}

/** A frame as shown, drawn BRIGAND_RES times finer. */
export function fineSpec(shown: FrameSpec): FrameSpec {
  const k = BRIGAND_RES;
  return { ...shown, w: shown.w * k, h: shown.h * k, feetY: (shown.feetY + 0.5) * k - 0.5, scale: k };
}

/** The same frame order as the goblins' (see GOBLIN_FRAME in goblins3d.ts), so the same animations play them. */
export const BRIGAND_COLS = 24;

export function brigandSheet(kind: BrigandKind): BeastSheet {
  return lookSheet(BRIGAND_LOOKS[kind], brigandSpec(kind));
}

/** A fighting sheet for anyone drawn on the brigands' frame (Gloomhaven's Hooks too: see pawnfolk3d.ts). */
export function lookSheet(look: BrigandLook, spec: FrameSpec): BeastSheet {
  const k = look.size ?? 1;
  const at = (p: Pose3D, act?: Act, fx: Flicker = {}) => grown(brigandModel(p, look, act, fx), k);
  const walk: Pose3D[] = [
    { stride: 1, bob: 0.8, flutter: 1 },
    { stride: 0, bob: 0, flutter: 2 },
    { stride: -1, bob: 0.8, flutter: 1 },
    { stride: 0, bob: 0, flutter: 2 },
  ];
  const models: Model[] = [
    at({ stride: 0, bob: 0 }),
    at({ stride: 0, bob: 0.6 }),
    ...walk.map((p) => at(p)),
    // Looking about, weapon ready.
    at({ stride: 0.3, bob: 0.2 }, 'ready'),
    at({ stride: 0.3, bob: 0.6 }, 'ready'),
    at({ stride: 0, bob: 0 }, 'ready'),
    at({ stride: 0, bob: 0.4 }, 'strike'),
    at({ stride: 0, bob: 0.6 }, 'hurt'),
    // Flat on their back.
    grown(onItsSide(brigandModel({ stride: 0, bob: 0 }, look, 'hurt'), 19, 5), k),
    // 12-13: the wind-up and the follow-through.
    at({ stride: 0, bob: 0.2 }, 'windup'),
    at({ stride: 0, bob: 0.8 }, 'follow'),
    // 14-15: the fighting stance, shifting.
    at({ stride: 0, bob: 0.7 }, 'ready'),
    at({ stride: 0, bob: 0.3 }, 'ready'),
    // 16-17: knocked back, and recovering.
    at({ stride: 0, bob: 0.3 }, 'reel'),
    at({ stride: 0, bob: 0.9 }, 'ready', { blink: true }),
    // 18-20: dying: a stagger, the knees, slumped.
    at({ stride: 0, bob: 0.8 }, 'reel'),
    at({ stride: 0, bob: 2.6 }, 'hurt'),
    at({ stride: 0, bob: 0 }, 'slump'),
    // 21: the jeer.
    at({ stride: 0, bob: -0.2 }, 'taunt'),
    // 22-23: standing about: a blink, and a breath.
    at({ stride: 0, bob: 0.3 }, 'rest', { blink: true }),
    at({ stride: 0, bob: -0.3 }, 'rest'),
  ];
  return { spec, models };
}

const held = (f: number, ms: number) => ({ f, ms });

/** Their animations beyond walking, as the goblins' (see GOBLIN_ANIMS). */
export const BRIGAND_ANIMS: Record<string, BeastAnim> = {
  idle: { frames: [held(0, 800), held(1, 700), held(0, 700), held(22, 140), held(0, 600), held(1, 700), held(23, 800), held(1, 600)], repeat: -1 },
  sniff: { frames: [held(6, 600), held(7, 600), held(6, 500), held(22, 140), held(6, 500), held(7, 600)], repeat: -1 },
  ready: { frames: [held(8, 300), held(14, 280), held(15, 260), held(14, 280)], repeat: -1 },
  attack: { frames: [held(12, 170), held(9, 120), held(13, 240)], repeat: 0 },
  hit: { frames: [held(16, 110), held(10, 140), held(17, 170)], repeat: 0 },
  die: { frames: [held(18, 170), held(19, 240), held(20, 300), held(11, 1)], repeat: 0 },
  taunt: { frames: [held(21, 240), held(8, 150), held(21, 280), held(14, 200)], repeat: 0 },
};

/** The brigands met in the beacon tower, by their folk ids. */
export const BRIGAND_FOLK: Record<string, BrigandLook> = {
  corwin: CORWIN,
  garth: GARTH,
  teg: TEG,
  linnet: LINNET,
};

/** The brigands' figures ('folk-<id>', drawn finely) and their fighting sheets ('creature-<kind>'). */
export function generateBrigands(scene: Phaser.Scene): void {
  for (const [id, look] of Object.entries(BRIGAND_FOLK)) generateFigure3D(scene, `folk-${id}`, brigandFolkModel(look), FINE_SPEC);
  generateBeast(scene, 'brigandcaptain', brigandSheet('brigandcaptain'), 9, BRIGAND_ANIMS);
  generateBeast(scene, 'brigandbrute', brigandSheet('brigandbrute'), 8, BRIGAND_ANIMS);
  generateBeast(scene, 'brigandcutter', brigandSheet('brigandcutter'), 10, BRIGAND_ANIMS);
  generateBeast(scene, 'brigandarcher', brigandSheet('brigandarcher'), 10, BRIGAND_ANIMS);
}
