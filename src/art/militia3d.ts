import { darker, type Tones } from './character';
import { chain, speck } from './beasts3d';
import { Detail, Hit, limb, Material, Model, Pose3D, Solid } from './figure3d';
import { fineFace, shade } from './fine3d';
import { seatedLegs } from './models3d';
import { PALETTE as P } from './palette';

/**
 * Adowvale's militia, drawn finely like the hero and the companions (FINE_SPEC
 * in fine3d.ts), and no two alike. They all wear the village's blue and gold,
 * but each is kitted out from what the garrison had to hand, and each is
 * their own man: a spearman with a targe slung on his back, a hooded archer
 * with a longbow and a quiver, a gangly new recruit in a skullcap and a
 * tabard he hasn't grown into, a swordsman in a riveted brigandine behind a
 * kite shield, and the old veteran on the garrison door in a long hauberk and
 * a mail aventail, leaning on a bill. Sergeant Brannock in his cloak, and
 * Hamm the jailer with his keys and his cudgel, are drawn the same way.
 *
 * One builder ({@link militiaModel}) makes them all from a {@link MilitiaLook}:
 * build, face, hair and beard, helm, what's worn under and over, and what's
 * carried.
 */

type V3 = [number, number, number];

/** What a militiaman carries: a spear, a longbow, a bill, a sword (with a kite shield), a sword in its scabbard, or a cudgel. */
export type MilitiaWeapon = 'spear' | 'bow' | 'bill' | 'sword' | 'scabbard' | 'cudgel';

export interface MilitiaLook {
  /** How much broader than an ordinary man, and how much taller (1 for both is Wat's size). */
  bulk?: number;
  tall?: number;
  /** A belly pushing out the tabard: 0 for none, 1 for Hamm's. */
  belly?: number;
  skin: Tones;
  /** Ruddy cheeks, in this colour. */
  ruddy?: number;
  hair: Tones;
  /** Grey through the hair and beard. */
  grey?: Tones;
  hairStyle: 'short' | 'crop' | 'bald' | 'curly' | 'shaggy';
  beard: 'none' | 'stubble' | 'short' | 'full' | 'moustache' | 'wisp';
  /** What's on the head: a broad-brimmed kettle helm, a conical nasal helm, an iron skullcap, a cloth hood, or nothing. */
  helm: 'kettle' | 'nasal' | 'skullcap' | 'hood' | 'none';
  /** Mail hanging from the helm round the neck and jaw. */
  aventail?: boolean;
  /** What's worn under: a mail shirt, a quilted gambeson, a leather jerkin, or a brigandine of riveted plates under blue cloth. */
  body: 'mail' | 'gambeson' | 'leather' | 'brigandine';
  /** The under-layer's skirt to the knee (a hauberk) rather than mid-thigh. */
  long?: boolean;
  /** The tabard over it (none over a brigandine, which is blue already). */
  tabard?: Tones;
  /** The tabard's hem and edging. */
  trim: Tones;
  /** The gambeson's or jerkin's cloth, or the brigandine's covering. */
  under: Tones;
  hose: Tones;
  boot: Tones;
  belt: Tones;
  /** Puttees wound from ankle to knee, over short boots; otherwise tall boots. */
  wraps?: Tones;
  weapon: MilitiaWeapon;
  /** A round targe slung on the back. */
  targe?: boolean;
  cloak?: Tones;
  /** The hood's cloth, if the helm is a hood. */
  hood?: Tones;
  /** The badge on the chest: the militia's gold boss, a sergeant's chevrons, or nothing. */
  badge: 'boss' | 'chevrons' | 'none';
  /** A ring of iron keys at the belt. */
  keys?: boolean;
  /** Worn, faded cloth (the veteran's tabard). */
  faded?: boolean;
  iris: number;
  brow: number;
  browSlant: number;
  lip: number;
  mouthWidth?: number;
  smile?: boolean;
  freckles?: number;
  scar?: number;
}

const BLUE: Tones = [0x2e4a7a, 0x1e3256, 0x40629a];
const GOLD: Tones = [P.gold, 0xa8802e, P.goldLight];
const MAIL: Tones = [P.ironLight, P.iron, 0xa8a8b4];
const RING: Tones = [P.iron, 0x34343c, P.ironLight];
const HELM: Tones = [P.ironLight, P.iron, P.stoneLight];
const DARK_HELM: Tones = [0x6a6c76, 0x46484f, 0x9a9ca6];
const STEEL: Tones = [0xb8bcc6, 0x7a7e8a, 0xe4e8f0];
const BRIGHT: Tones = [0xcfd6de, 0x8a94a0, 0xffffff];
const IRON: Tones = [0x7a7c86, 0x4e505a, 0xa8acb6];
const ASH: Tones = [P.bark, P.barkDark, P.barkLight];
const YEW: Tones = [0xa87a44, 0x7a5430, 0xc89a5e];
const STRING: Tones = [0xe0d8c0, 0xb0a890, 0xf8f0dc];
const BONE: Tones = [0xd8c8a4, 0xb0a07e, 0xf0e4c4];
const FLETCH: Tones = [0xe8e0d0, 0xb8ae9c, 0xfffaf0];
const FLETCH_BLUE: Tones = [0x3e5e9a, 0x2a4270, 0x5a7ab4];
const GRIP: Tones = [P.leather, P.leatherDark, P.leatherLight];
const OAK: Tones = [0x6e4e30, 0x4a3420, 0x8a6640];
const RIVET = 0xc8ccd4;

const knob = (p: V3, r: number, material: Material, soft = false): Solid => ({ cx: p[0], cy: p[1], cz: p[2], rx: r, ry: r, rz: r, material, soft });
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const along = (p: V3, d: V3, k: number): V3 => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lit = (t: Tones): Tones => [t[2], t[0], t[2]];

/** Mail: rows of rings, light and dark by turns. */
function rings(h: Hit): Tones {
  return (Math.floor(h.x * 1.1 + h.z * 1.1) + Math.floor(h.y * 1.4)) % 2 ? MAIL : RING;
}

/** One militiaman in one pose. Body space as everywhere: x across (screen-right facing us), y up, z the way he faces. */
export function militiaModel(pose: Pose3D, look: MilitiaLook): Model {
  const C = look;
  const w = C.bulk ?? 1;
  const up = ((C.tall ?? 1) - 1) * 12;
  const belly = C.belly ?? 0;
  const b = pose.bob;
  const s = pose.stride;
  const sit = !!pose.sit;
  const solids: Solid[] = [];
  const details: Detail[] = [];
  const mark = (p: V3, color: number, size = 0.5) => details.push({ x: p[0], y: p[1], z: p[2], color, size });
  /** A height on the upper body: lifted for a taller man, sinking as he breathes and steps (and sits). */
  const Y = (y: number) => y + (sit ? 0 : up) - b;
  const waist = Y(15.6) + b * (sit ? 0 : 0.5);
  const fade = (t: Tones) => (h: Hit): Tones => (C.faded && speck(h, 1.4) < 0.2 ? lit(t) : t);

  // --- Legs: hose into tall boots, or wound with puttees over short ones.
  const wrap = (h: Hit): Tones => (Math.floor(h.y * 1.5 + h.x * 0.35 + h.z * 0.35) % 2 === 0 ? C.wraps! : shade(C.wraps!));
  if (sit) {
    solids.push(...seatedLegs(2.2 * w, C.hose, C.boot, 1.8 * w));
    for (const side of [-1, 1]) solids.push(...limb([side * 2.2 * w, 8.2, 5.7], [side * 2.2 * w, 3.4, 5.8], 1.8 * w, 1.7 * w, C.wraps ? wrap : C.boot));
  } else {
    for (const side of [-1, 1]) {
      const swing = s * side;
      const lift = swing < 0 ? 0.9 : 0;
      const x = side * 2.25 * w;
      const hip: V3 = [x, 12.5 + up - b * 0.5, 0];
      const ankle: V3 = [x, 3.4 + lift, swing * 2.3];
      const foot: V3 = [x, 1 + lift, 0.9 + swing * 2.3];
      const at = (y: number) => lerp3(hip, ankle, (hip[1] - y) / (hip[1] - ankle[1]));
      solids.push(...limb(hip, ankle, 1.8 * w, 1.5 * w, C.hose));
      if (C.wraps) {
        solids.push(...limb(at(8.4 + up * 0.4), at(4.4), 1.72 * w, 1.62 * w, wrap));
        const cuff = at(3.6);
        solids.push({ cx: cuff[0], cy: cuff[1], cz: cuff[2], rx: 1.75 * w, ry: 0.9, rz: 1.75 * w, material: C.boot });
      } else {
        const top = 8.4 + up * 0.4;
        solids.push(...limb(at(top - 0.2), ankle, 1.78 * w, 1.66 * w, C.boot));
        const cuff = at(top);
        solids.push({ cx: cuff[0], cy: cuff[1], cz: cuff[2], rx: 1.98 * w, ry: 0.7, rz: 1.98 * w, material: shade(C.boot) });
      }
      solids.push({ cx: foot[0], cy: foot[1], cz: foot[2], rx: 1.5 * w, ry: 1, rz: 2.3 * w, material: C.boot });
    }
  }

  // --- What's worn under: its skirt below the tabard, mail or quilting or leather.
  const quilted = (h: Hit): Tones => ((h.y * 1.25) % 1.25 < 0.28 || (Math.abs(h.nx) < 0.5 && (h.x * 0.9 + 20) % 1.8 < 0.3) ? shade(C.under) : C.under);
  const studded = (h: Hit): Tones => {
    // Rows of brass rivets holding the plates under the cloth.
    const ry = ((h.y + 40) * 0.6) % 1;
    const rx = ((h.x + h.z + 40) * 0.62 + Math.floor((h.y + 40) * 0.6) * 0.5) % 1;
    if (ry < 0.3 && rx < 0.3) return GOLD;
    return speck(h, 1.3) < 0.1 ? lit(C.under) : C.under;
  };
  const leather = (h: Hit): Tones => (speck(h, 1.1) < 0.12 ? shade(C.under) : C.under);
  const under = (h: Hit): Tones => {
    switch (C.body) {
      case 'mail': return rings(h);
      case 'gambeson': return quilted(h);
      case 'brigandine': return studded(h);
      case 'leather': return leather(h);
    }
  };
  if (!sit) {
    const from = C.long ? 6.6 : 9.4;
    for (let y = from; y <= 14; y += 0.5) {
      const t = (14 - y) / (14 - from);
      solids.push({
        cx: 0, cy: y + up - b * 0.5, cz: s * 0.25 * t + belly * 0.4, rx: (4.7 + t * (C.long ? 0.9 : 0.5)) * w, ry: 0.8, rz: (3.6 + t * 0.4 + belly * 0.6) * w,
        material: y < from + 0.5 ? (C.body === 'mail' ? shade(RING) : shade(C.under)) : under,
      });
    }
  } else {
    solids.push({ cx: 0, cy: 10.8, cz: 2, rx: 4.8 * w, ry: 1.2, rz: 4.4 * w, material: under });
  }

  // --- The tabard: front and back panels to mid-thigh, open at the sides, a gold hem and edging.
  const tabard = C.tabard;
  if (tabard && !sit) {
    for (let y = 10.5; y <= 14; y += 0.5) {
      solids.push({
        cx: 0, cy: y + up - b * 0.5, cz: s * 0.3 * (14 - y) / 3.5 + belly * 0.5, rx: 4.6 * w, ry: 0.8, rz: (3.85 + belly * 0.7) * w,
        material: (h) => (Math.abs(h.nx) > 0.84 ? under(h) : y < 11.2 ? C.trim : fade(tabard)(h)),
      });
    }
  }

  // --- The body, belted at the waist.
  const body = (h: Hit): Tones => {
    const dy = h.y - waist;
    if (Math.abs(dy) < 0.65) {
      if (h.nz > 0.85 && Math.abs(h.x) < 0.8) return Math.abs(h.x) < 0.35 && Math.abs(dy) < 0.3 ? C.belt : GOLD;
      return Math.abs(dy) > 0.4 ? shade(C.belt) : C.belt;
    }
    if (!tabard) {
      // The brigandine (or a bare jerkin) all over, a dark seam down each side.
      if (Math.abs(Math.abs(h.nx) - 0.86) < 0.05) return shade(C.under);
      if (h.y > Y(24.6) && h.nz > -0.2) return shade(C.under);
      return under(h);
    }
    if (Math.abs(h.nx) > 0.88) return under(h);
    if (Math.abs(Math.abs(h.nx) - 0.85) < 0.035) return C.trim;
    if (h.y > Y(24.4) && h.nz > -0.2) return under(h);
    // The veteran's tabard, darned where it was torn.
    if (C.faded && h.nz > 0.4 && h.x > 1.4 && h.x < 3 && dy > 1.2 && dy < 2.8) return Math.floor((h.x + dy) * 3) % 2 ? shade(tabard) : tabard;
    return fade(tabard)(h);
  };
  const front = belly * 1.6;
  solids.push({ cx: 0, cy: sit ? 14.6 - b : 14.6 + up - b * 0.5, cz: belly * 0.6, rx: 4.6 * w, ry: 2.6, rz: (3.5 + belly * 0.8) * w, material: body });
  solids.push({ cx: 0, cy: Y(18), cz: belly * 0.8, rx: 4.6 * w, ry: 3.4, rz: (3.5 + belly * 0.9) * w, material: body });
  solids.push({ cx: 0, cy: Y(22.2), cz: 0.1, rx: 5.1 * w, ry: 4.4, rz: 3.7 * w, material: body });
  if (belly > 0) solids.push({ cx: 0, cy: Y(17.2), cz: front, rx: 4.2 * w, ry: 3.2, rz: 3 * w, material: body });
  // The collar: quilted, leather, or mail, standing up round the neck.
  solids.push({ cx: 0, cy: Y(25.8), cz: 0.2, rx: 3 * w, ry: 1.1, rz: 2.9 * w, material: under });
  // A pouch on the right hip, and a knife on the left (unless the sword or keys hang there).
  solids.push({ cx: -3.7 * w, cy: waist - 1.5, cz: 2.4 * w + front * 0.4, rx: 1.3, ry: 1.3, rz: 0.8, material: (h) => (h.y > waist - 1 ? shade(C.belt) : C.belt) });
  if (!sit && C.weapon !== 'scabbard' && !C.keys) {
    solids.push(...limb([3.9 * w, waist - 0.4, 2.3 * w + front * 0.3], [4.3 * w, waist - 3.6, 2.1 * w + front * 0.3], 0.55, 0.4, C.belt, 0.5));
    solids.push(knob([3.9 * w, waist + 0.6, 2.4 * w + front * 0.3], 0.45, ASH));
  }
  // Hamm's keys: a big iron ring at his left hip with keys hanging from it.
  if (C.keys) {
    const ring: V3 = [4.4 * w, waist - 1.6, 2.4 * w + front * 0.3];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      solids.push(knob([ring[0] + Math.cos(a) * 1.3, ring[1] + Math.sin(a) * 1.3, ring[2]], 0.32, IRON));
    }
    for (const [dx, len] of [[-0.8, 2.6], [0, 3.2], [0.8, 2.2]]) {
      const top: V3 = [ring[0] + dx, ring[1] - 1.1, ring[2] + 0.3];
      solids.push(...limb(top, [top[0] + dx * 0.3, top[1] - len, top[2]], 0.3, 0.3, IRON, 0.3));
      solids.push(knob([top[0] + dx * 0.3 + 0.35, top[1] - len + 0.2, top[2]], 0.45, IRON));
    }
  }

  // --- The cloak, from the shoulders to the backs of the knees, a gold brooch at the throat.
  if (C.cloak) {
    const cl = C.cloak;
    const flutter = pose.flutter ?? 0;
    for (let y = sit ? 9 : 7 + up; y <= Y(25); y += 0.5) {
      const t = (Y(25) - y) / (Y(25) - (sit ? 9 : 7 + up));
      solids.push({
        cx: 0, cy: y, cz: -3.4 * w - t * (1.2 + flutter * 0.6 + Math.abs(s) * 0.5), rx: (5.6 + t * 1.2) * w, ry: 0.8, rz: 1.2,
        material: (h) => (Math.floor((h.x + 20) * 0.8) % 3 === 0 ? shade(cl) : t > 0.96 ? shade(cl) : cl),
      });
    }
    for (const side of [-1, 1]) solids.push({ cx: side * 4.4 * w, cy: Y(25.4), cz: -0.6, rx: 2.4 * w, ry: 1.4, rz: 3.2, material: cl });
    solids.push(knob([-3 * w, Y(25), 2.8 * w], 0.8, GOLD));
  }
  // The targe on his back: blue and bone, quartered, with a gold boss and an iron rim.
  if (C.targe) {
    const c: V3 = [0.4, Y(19.6), -4.6 * w];
    solids.push({
      cx: c[0], cy: c[1], cz: c[2], rx: 4.6, ry: 4.6, rz: 0.7,
      material: (h) => {
        const dx = h.x - c[0];
        const dy = h.y - c[1];
        if (Math.hypot(dx, dy) > 4.1) return IRON;
        return (dx > 0) === (dy > 0) ? BLUE : BONE;
      },
    });
    solids.push(knob([c[0], c[1], c[2] - 0.7], 1.3, GOLD));
    // Its strap, from the right shoulder down to the left hip.
    solids.push(...limb([-4.4 * w, Y(25), 2.2 * w], [4.4 * w, waist + 1, 2.6 * w + front * 0.3], 0.5, 0.5, C.belt, 0.4));
  }
  // The archer's quiver on his back, its arrows fletched in white and blue.
  if (C.weapon === 'bow') {
    const qa: V3 = [-2.4, Y(26.6), -3.8 * w];
    const qb: V3 = [2.8, Y(13.6), -3.6 * w];
    solids.push(...limb(qb, qa, 1.4, 1.5, (h) => (Math.abs(h.y - (qb[1] + 3)) < 0.5 || Math.abs(h.y - (qa[1] - 2)) < 0.5 ? shade(C.belt) : C.belt), 0.4));
    for (let i = 0; i < 5; i++) {
      const p: V3 = [qa[0] - 0.6 + i * 0.4, qa[1] + 1.4 + (i % 2) * 0.6, qa[2] - 0.3 + (i % 3) * 0.3];
      solids.push(...limb(lerp3(qa, p, 0.2), [p[0] - 0.4, p[1] + 1.6, p[2]], 0.45, 0.3, i % 2 ? FLETCH : FLETCH_BLUE, 0.3));
    }
    solids.push(...limb([-4.4 * w, Y(25), 2.2 * w], [4.4 * w, waist + 1, 2.6 * w], 0.5, 0.5, C.belt, 0.4));
  }
  // The sergeant's sword in its scabbard on his left hip.
  if (C.weapon === 'scabbard') {
    const hilt: V3 = [4.6 * w, waist + 1.4, 2.2 * w];
    const tip: V3 = [5.4 * w, sit ? waist - 6 : 4.6 + up * 0.4, sit ? 6 : -2.8];
    solids.push(...limb(lerp3(hilt, tip, 0.12), tip, 0.75, 0.55, (h) => (Math.abs(h.y - (hilt[1] - 3)) < 0.4 ? GOLD : shade(GRIP)), 0.4));
    solids.push(...limb([hilt[0] - 1.4, hilt[1] - 0.4, hilt[2] + 0.4], [hilt[0] + 1.4, hilt[1] + 0.4, hilt[2] - 0.4], 0.5, 0.5, IRON, 0.3));
    solids.push(...limb(hilt, along(hilt, norm([-0.2, 1, 0.6]), 2.4), 0.55, 0.55, GRIP, 0.3));
    solids.push(knob(along(hilt, norm([-0.2, 1, 0.6]), 3), 0.85, GOLD));
  }

  // --- Arms. His right (screen-left, facing us) carries the weapon; the left swings, or holds the bow or the shield, or rests on the sword.
  const sleeve = (h: Hit): Tones => (C.body === 'brigandine' ? rings(h) : under(h));
  let weaponHand: V3 = [0, 0, 0];
  let offHand: V3 = [0, 0, 0];
  for (const side of [-1, 1]) {
    const right = side === -1;
    const swing = sit ? 0 : -s * side * 2;
    const shoulder: V3 = [side * 5.2 * w, Y(24), 0.1];
    let elbow: V3;
    let hand: V3;
    if (sit) {
      elbow = [side * 5.6 * w, Y(19.6), 2];
      hand = right ? [side * 5.6 * w, 15, 3.6] : [side * 3.6 * w, 12.4, 4.6];
    } else if (right && (C.weapon === 'spear' || C.weapon === 'bill')) {
      elbow = [side * 6.4 * w, Y(20.4), 0.8];
      hand = [side * 7.2 * w, Y(19.2), 1.8];
    } else if (right && (C.weapon === 'sword' || C.weapon === 'cudgel')) {
      // Held low and ready at the side, point down and forward.
      elbow = [side * 6.4 * w, Y(20.2), 0.8];
      hand = [side * 6.6 * w, Y(17.2), 2.6];
    } else if (!right && C.weapon === 'bow') {
      elbow = [side * 6 * w, Y(20.2), 0.6];
      hand = [side * 6.5 * w, Y(16.8), 1.6];
    } else if (!right && C.weapon === 'sword') {
      // The shield arm, forearm across the front behind the kite shield.
      elbow = [side * 6.4 * w, Y(19.6), 1.8];
      hand = [side * 4 * w, Y(19), 4.4];
    } else if (!right && C.weapon === 'scabbard') {
      // Hand resting on the pommel.
      elbow = [side * 7 * w, Y(19.8), 0.2];
      hand = [side * 5 * w, waist + 3.6, 3.6];
    } else {
      elbow = [side * 6 * w, Y(20.2), 0.3 + swing * 0.5];
      hand = [side * 6.2 * w, Y(16.8), 0.8 + swing];
    }
    // Shoulders: mail caps over a brigandine, leather pauldrons for the veteran and the sergeant.
    solids.push(knob(shoulder, 2.4 * w, sleeve));
    if (C.long || C.badge === 'chevrons') {
      solids.push({ cx: side * 5 * w, cy: Y(24.9), cz: 0.1, rx: 2.8 * w, ry: 1.7, rz: 2.8 * w, material: (h) => (h.y < Y(24.1) ? shade(GRIP) : GRIP) });
      for (const dz of [-1.1, 1.1]) mark([side * 6.8 * w, Y(25), 0.1 + dz], RIVET);
    }
    solids.push(...limb(shoulder, elbow, 1.85 * w, 1.65 * w, sleeve, 0.45));
    const forearm = limb(elbow, hand, 1.65 * w, 1.5 * w, sleeve, 0.45);
    forearm.forEach((f, i) => {
      // A leather bracer on the archer's bow arm; turned-back cuffs otherwise.
      const t = i / Math.max(1, forearm.length - 1);
      if (C.weapon === 'bow' && !right && t > 0.3) solids.push({ ...f, rx: f.rx + 0.2, ry: f.ry + 0.2, rz: f.rz + 0.2, material: (h) => (Math.floor(h.y * 1.6) % 2 ? C.belt : shade(C.belt)) });
      else if (i === forearm.length - 1) solids.push({ ...f, rx: f.rx + 0.1, ry: f.ry + 0.1, rz: f.rz + 0.1, material: C.body === 'mail' ? shade(RING) : shade(C.under) });
      else solids.push(f);
    });
    const glove: Tones = C.long || C.body === 'brigandine' ? [0x3e2c22, 0x281c16, 0x5a4232] : C.skin;
    solids.push({ cx: hand[0], cy: hand[1] - 0.9, cz: hand[2] + 0.2, rx: 1.45 * w, ry: 1.5 * w, rz: 1.5 * w, material: glove });
    if (right) weaponHand = [hand[0], hand[1] - 0.9, hand[2] + 0.2];
    else offHand = [hand[0], hand[1] - 0.9, hand[2] + 0.2];
  }

  // --- What he carries.
  const grain = (h: Hit): Tones => ((h.y * 2.2) % 3 < 0.3 ? shade(ASH) : ASH);
  const pole = (parts: Solid[]) => solids.push(...parts.map((p) => ({ ...p, soft: true })));
  const [px, , pz] = weaponHand;
  if (C.weapon === 'spear') {
    const top = (sit ? 40 : 43.6 + up * 0.6) - b;
    const butt: V3 = sit ? [px, 0.6, pz + 1.4] : [px, 0.6, pz - s * 0.6];
    pole([
      ...limb(butt, [px, top - 3.6, pz], 0.6, 0.55, grain, 0.4),
      ...limb([px, top - 4.6, pz], [px, top - 3.6, pz], 0.75, 0.75, C.belt, 0.4),
      ...limb([px, top - 3.8, pz], [px, top - 2.6, pz], 0.6, 0.6, STEEL, 0.4),
      { cx: px, cy: top - 1.3, cz: pz, rx: 0.95, ry: 1.6, rz: 0.4, material: STEEL },
      ...limb([px, top - 0.6, pz], [px, top + 0.6, pz], 0.6, 0.2, STEEL, 0.3),
    ]);
  } else if (C.weapon === 'bill') {
    // A billhook on a long ash haft: a broad curved blade, a spike at the top, and a hook at the back.
    const top = (sit ? 40 : 44.4 + up * 0.6) - b;
    const butt: V3 = sit ? [px, 0.6, pz + 1.4] : [px, 0.6, pz - s * 0.6];
    pole([
      ...limb(butt, [px, top - 6, pz], 0.62, 0.58, grain, 0.4),
      ...limb([px, top - 6.4, pz], [px, top - 5.4, pz], 0.8, 0.8, IRON, 0.4),
      // The blade: a deep, forward-curving chopper.
      ...chain([[px, top - 5.6, pz + 0.6], [px, top - 3.4, pz + 1.7], [px, top - 1.2, pz + 1.9], [px, top, pz + 1.2]], [0.5, 1.2, 1.1, 0.4], (h) => (h.z - pz > 2.3 ? BRIGHT : STEEL), 0.3)
        .map((p) => ({ ...p, rx: 0.35 })),
      // The spike, straight up.
      ...limb([px, top - 1, pz + 0.2], [px, top + 2.6, pz + 0.2], 0.5, 0.15, STEEL, 0.3),
      // The hook, out the back and curling up.
      ...chain([[px, top - 3.2, pz - 0.2], [px, top - 3, pz - 1.8], [px, top - 1.8, pz - 2.6]], [0.45, 0.35, 0.2], STEEL, 0.3),
    ]);
  } else if (C.weapon === 'bow') {
    // The longbow upright at his side, its belly forward, strung.
    const [bx, by, bz] = offHand;
    const span = 15;
    const tipT: V3 = [bx, Math.min(by + span, Y(37)), bz - 0.6];
    const tipB: V3 = [bx, Math.max(by - span, sit ? 1 : 1.4), bz - 0.6];
    const mid: V3 = [bx, by, bz + 0.9];
    pole([
      ...chain([tipB, lerp3(tipB, mid, 0.5), mid, lerp3(mid, tipT, 0.5), tipT], [0.32, 0.5, 0.62, 0.5, 0.32], (h) => (Math.abs(h.y - by) < 1.1 ? GRIP : YEW), 0.35),
      ...limb([bx, tipB[1] + 0.3, bz - 0.75], [bx, tipT[1] - 0.3, bz - 0.75], 0.2, 0.2, STRING, 0.4),
    ]);
  } else if (C.weapon === 'sword') {
    // An arming sword, point down and forward, and a kite shield on the other arm.
    const d = norm([-0.12, -0.86, 0.5]);
    const flat = norm(cross(d, [1, 0, 0]));
    const wv = norm(cross(flat, d));
    const guard = along(weaponHand, d, 1.8);
    solids.push(knob(along(weaponHand, d, -2.2), 0.9, GOLD));
    solids.push(...limb(along(weaponHand, d, -1.6), guard, 0.6, 0.6, GRIP, 0.3));
    solids.push(...limb(along(guard, wv, -2.6), along(guard, wv, 2.6), 0.55, 0.55, IRON, 0.3));
    for (let t = 0.6; t <= 12; t += 0.5) {
      const u = t / 12.5;
      const half = u < 0.75 ? 1.2 - u * 0.25 : 1.01 * (1 - (u - 0.75) / 0.27);
      const p = along(guard, d, t);
      solids.push({ cx: p[0], cy: p[1], cz: p[2], rx: Math.max(0.25, half), ry: 1.1, rz: 0.4, axes: [wv, d, flat], material: (h) => (Math.abs((h.x - guard[0]) * wv[0] + (h.y - guard[1]) * wv[1] + (h.z - guard[2]) * wv[2]) < 0.35 ? STEEL : BRIGHT), soft: true });
    }
    // The kite shield: rounded at the top, drawn down to a point, blue with a gold spear down its middle.
    const [sx, sy, sz] = offHand;
    const cx = sx + 0.6;
    const cz = sz + 1.4;
    const topY = sy + 6.4;
    for (let y = sy - 9.4; y <= topY; y += 0.5) {
      const t = (topY - y) / (topY - (sy - 9.4));
      const half = t < 0.12 ? 4.4 * Math.sqrt(Math.max(0.05, t / 0.12)) : 4.4 * (1 - Math.pow((t - 0.12) / 0.88, 1.4));
      if (half < 0.3) continue;
      solids.push({
        cx, cy: y, cz: cz - Math.abs(t - 0.4) * 0.6, rx: half, ry: 0.8, rz: 0.55,
        material: (h) => {
          const dx = h.x - cx;
          if (h.nz < -0.3) return OAK;
          if (Math.abs(dx) > half - 0.55 || y > topY - 0.6) return IRON;
          // The militia's gold spear, point up, down the shield's middle.
          if (Math.abs(dx) < 0.45 && y < topY - 1.6) return GOLD;
          if (Math.abs(dx) < 1.2 - Math.max(0, (y - (topY - 4.2))) * 0.6 && y > topY - 4.2 && y < topY - 1.2) return GOLD;
          return speck(h, 1.5) < 0.1 ? lit(BLUE) : BLUE;
        },
      });
    }
    for (const [dx, dy] of [[-3.2, 5.2], [3.2, 5.2], [0, -7.6], [-2.4, -1.6], [2.4, -1.6]]) mark([cx + dx, sy + dy, cz + 0.65], RIVET);
  } else if (C.weapon === 'cudgel') {
    // A knobbled oak cudgel, hanging from the fist.
    const d = norm([-0.1, -0.9, 0.42]);
    solids.push(...limb(along(weaponHand, d, -1.4), along(weaponHand, d, 6), 0.6, 1.1, OAK, 0.35));
    solids.push(knob(along(weaponHand, d, 6.6), 1.35, OAK));
    for (const k of [3.4, 5.2]) solids.push(knob(along(along(weaponHand, d, k), [1, 0, 0], 0.8), 0.6, shade(OAK)));
    solids.push(...limb(along(weaponHand, d, -1.6), along(weaponHand, d, -0.8), 0.75, 0.75, IRON, 0.3));
  }

  // --- Head.
  const hy = Y(32.2);
  const hz = 0.4;
  const HEAD = { rx: 5.2, ry: 5.6, rz: 5 };
  solids.push({ cx: 0, cy: Y(27), cz: 0.3, rx: 2.1 * w, ry: 2, rz: 2.1 * w, material: C.skin });
  const hairTone = (h: Hit): Tones => {
    const py = h.y - hy;
    const g = C.grey && ((Math.abs(h.nx) > 0.75 && py > -2) || speck(h, 0.6) < 0.14) ? C.grey : C.hair;
    return (Math.floor(h.x * 1.6 + h.z * 0.4 + h.y * 0.3) & 1) === 0 ? g : shade(g);
  };
  const stubble: Tones = [darker(C.skin[1]), darker(darker(C.skin[1])), C.skin[1]];
  const face = (h: Hit): Tones => {
    const py = h.y - hy;
    if (C.hairStyle !== 'bald') {
      if (py > 2.3) return hairTone(h);
      if (h.nz < -0.2 || (Math.abs(h.nx) > 0.76 && py > -1.6)) return hairTone(h);
    } else if (h.nz < -0.4 && py < 0 && py > -3) {
      return hairTone(h);
    }
    if (h.nz > -0.3) {
      if ((C.beard === 'full' || C.beard === 'short') && (py < -1.6 + (C.beard === 'full' ? 0.4 : 0)) && !(py > -2.6 && py < -1.7 && Math.abs(h.x) < 1.2)) return hairTone(h);
      if (C.beard === 'short' && Math.abs(h.nx) > 0.6 && py < 0) return hairTone(h);
      if (C.beard === 'stubble' && py < -1.2 && speck(h, 0.5) < 0.55) return stubble;
    }
    return C.skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: HEAD.rx, ry: HEAD.ry, rz: HEAD.rz, material: face, soft: true });
  solids.push({ cx: 0, cy: hy + 0.1, cz: hz + 5, rx: C.bulk && C.bulk > 1.05 ? 1.05 : 0.85, ry: 1.05, rz: 0.85, material: C.skin, soft: true });
  // Ears: big ones on the recruit, sticking out under the skullcap.
  const ear = C.helm === 'skullcap' ? 1.3 : 1;
  for (const side of [-1, 1]) solids.push({ cx: side * (5 + (ear - 1) * 0.8), cy: hy + 0.1, cz: hz + 0.2, rx: 0.7 * ear, ry: 1.2 * ear, rz: 0.9, material: C.skin, soft: true });
  // The hair that shows: a crop, curls, or shaggy locks out from under the helm.
  if (C.hairStyle === 'crop' || C.hairStyle === 'short') {
    solids.push({ cx: 0, cy: hy + 2.8, cz: hz - 0.9, rx: 5.3, ry: 3.2, rz: 5.1, material: hairTone });
  } else if (C.hairStyle === 'curly') {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      solids.push(knob([Math.sin(a) * 4.5, hy + 2.6 + (i % 3) * 0.3, hz - 0.6 + Math.cos(a) * 4.3], 1.4, hairTone));
    }
    solids.push({ cx: 0, cy: hy + 3, cz: hz - 0.6, rx: 4.8, ry: 3.4, rz: 4.6, material: hairTone });
  } else if (C.hairStyle === 'shaggy') {
    for (const [x, z] of [[-3, -3.8], [0, -4.6], [3, -3.8], [-4.5, -1.4], [4.5, -1.4], [-1.6, -4.4], [1.6, -4.4]]) solids.push({ cx: x, cy: hy + 1.2, cz: hz + z, rx: 1.3, ry: 1.8, rz: 1.1, material: hairTone });
    solids.push({ cx: 0, cy: hy + 2.4, cz: hz - 0.6, rx: 5.4, ry: 3.4, rz: 5.2, material: hairTone });
  }
  if (C.helm === 'none' && (C.hairStyle === 'crop' || C.hairStyle === 'short')) {
    // Combed forward over the brow.
    for (const x of [-2.4, -0.8, 0.8, 2.4]) solids.push({ cx: x, cy: hy + 3.6, cz: hz + 3.9, rx: 1.2, ry: 0.8, rz: 0.9, material: hairTone });
  }
  // Beards: a full one jutting from the chin, a short one close round the jaw, or a moustache alone.
  if (C.beard === 'full') {
    solids.push({ cx: 0, cy: hy - 4.2, cz: hz + 2.6, rx: 3.8, ry: 2.8, rz: 2.6, material: hairTone, soft: true });
    solids.push({ cx: 0, cy: hy - 6, cz: hz + 2.4, rx: 2.6, ry: 2.2, rz: 1.8, material: hairTone, soft: true });
  } else if (C.beard === 'short') {
    solids.push({ cx: 0, cy: hy - 4, cz: hz + 2.8, rx: 3.4, ry: 2, rz: 2.2, material: hairTone, soft: true });
  }
  if (C.beard === 'full' || C.beard === 'short' || C.beard === 'moustache') {
    const droop = C.beard === 'moustache' ? 0.6 : 0;
    for (const side of [-1, 1]) {
      solids.push({ cx: side * 1.2, cy: hy - 1.5, cz: hz + 4.9, rx: 1.3, ry: 0.55, rz: 0.6, material: hairTone, soft: true });
      if (droop) solids.push({ cx: side * 2.1, cy: hy - 2.4, cz: hz + 4.4, rx: 0.5, ry: 1, rz: 0.5, material: hairTone, soft: true });
    }
  }

  // --- The helm.
  if (C.helm === 'kettle') {
    const brim = (h: Hit): Tones => (Math.hypot(h.x, (h.z - hz) * (8.2 / 7.8)) > 7.4 ? shade(HELM) : HELM);
    solids.push({ cx: 0, cy: hy + 4, cz: hz - 0.2, rx: 8.2, ry: 0.85, rz: 7.8, material: brim });
    solids.push({ cx: 0, cy: hy + 4.8, cz: hz - 0.3, rx: 5.6, ry: 4, rz: 5.5, material: (h) => (Math.abs(h.x) < 0.45 ? lit(HELM) : HELM) });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      mark([Math.sin(a) * 5.5, hy + 5, hz - 0.3 + Math.cos(a) * 5.4], P.stoneLight);
    }
  } else if (C.helm === 'nasal') {
    // A tall cone of darkened iron, a riveted brow band, and a bar down over the nose.
    for (let y = hy + 2.4; y <= hy + 8.6; y += 0.4) {
      const t = (y - (hy + 2.4)) / 6.2;
      const r = 5.6 * Math.sqrt(Math.max(0, 1 - t * t * 0.9)) * (1 - t * 0.35);
      if (r < 0.4) continue;
      solids.push({ cx: 0, cy: y, cz: hz - 0.4 - t * 0.6, rx: r, ry: 0.6, rz: r * 0.97, material: (h) => (Math.abs(h.x) < 0.4 ? lit(DARK_HELM) : DARK_HELM) });
    }
    solids.push({ cx: 0, cy: hy + 2.8, cz: hz - 0.4, rx: 5.75, ry: 0.85, rz: 5.55, material: IRON });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mark([Math.sin(a) * 5.8, hy + 2.8, hz - 0.4 + Math.cos(a) * 5.6], P.stoneLight);
    }
    solids.push(...limb([0, hy + 2.8, hz + 5.3], [0, hy - 0.6, hz + 5.9], 0.6, 0.5, IRON, 0.3));
  } else if (C.helm === 'skullcap') {
    // A plain iron cap sat high on the head, its chin strap dangling loose.
    solids.push({ cx: 0, cy: hy + 2.9, cz: hz - 0.2, rx: 5.5, ry: 3.9, rz: 5.3, material: (h) => (h.y < hy + 1 ? shade(HELM) : HELM) });
    for (const side of [-1, 1]) solids.push(...limb([side * 5.2, hy + 1.4, hz + 0.6], [side * 4.4, hy - 3.8, hz + 1.4], 0.3, 0.3, C.belt, 0.3));
  } else if (C.helm === 'hood') {
    // A hood up over the head, its point hanging down behind, and its cape round the shoulders.
    const hd = C.hood ?? C.hose;
    const hood = (h: Hit): Tones => (h.nz > 0.6 && h.y < hy + 4 ? shade(hd) : speck(h, 1.3) < 0.12 ? lit(hd) : hd);
    solids.push({ cx: 0, cy: hy + 1.2, cz: hz - 0.9, rx: 5.9, ry: 6.3, rz: 5.4, material: hood });
    solids.push(...chain([[0, hy + 5.6, hz - 3], [0, hy + 4.6, hz - 6], [0, hy + 1.6, hz - 7.2], [0, hy - 2.6, hz - 7]], [1.6, 1.2, 0.8, 0.5], hd, 0.4));
    for (let y = Y(23); y <= Y(27); y += 0.5) solids.push({ cx: 0, cy: y, cz: -0.2, rx: 6.1 * w, ry: 0.8, rz: 4.6 * w, material: (h) => (y < Y(23.4) ? shade(hd) : hood(h)) });
  }
  if (C.aventail) {
    // Mail hanging from the helm's rim round the back and sides of the head, to the shoulders.
    for (let y = hy - 5.6; y <= hy + 2.4; y += 0.7) {
      const t = (hy + 2.4 - y) / 8;
      for (let i = 0; i <= 14; i++) {
        // Round from beside one cheek, behind the head, to beside the other, leaving the face open.
        const a = Math.PI * 0.36 + (i / 14) * Math.PI * 1.28;
        const r = 5.5 + t * 0.9;
        solids.push(knob([Math.sin(a) * r, y, hz - 0.4 + Math.cos(a) * r * 0.97], 0.9, rings));
      }
    }
  }

  // --- The badge on the chest: the militia's gold boss in a ring, or three chevrons for the sergeant.
  const chestZ = 3.7 * w + 0.25;
  if (C.badge === 'boss' && tabard) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      mark([Math.sin(a) * 1.1, Y(22.4) + Math.cos(a) * 1.1, chestZ], P.gold);
    }
    mark([0, Y(22.4), chestZ + 0.05], P.goldLight);
  } else if (C.badge === 'chevrons') {
    for (const dy of [0, 1, 2]) {
      for (const dx of [-1.5, -1, -0.5, 0, 0.5, 1, 1.5]) mark([dx, Y(21) + dy - Math.abs(dx) * 0.6 + 0.9, chestZ], P.gold);
    }
  }

  // --- The face.
  details.push(...fineFace(hy, hz, {
    eye: P.eye,
    iris: C.iris,
    brow: C.brow,
    browSlant: C.browSlant,
    browLift: 2.1,
    mouth: C.lip,
    mouthWidth: C.mouthWidth,
    smile: C.smile,
    freckles: C.freckles,
    scar: C.scar,
  }, HEAD));
  if (C.ruddy !== undefined) {
    const onFace = (x: number, dy: number): V3 => [x, hy + dy, hz + HEAD.rz * Math.sqrt(Math.max(0, 1 - (x / HEAD.rx) ** 2 - (dy / HEAD.ry) ** 2)) + 0.1];
    for (const side of [-1, 1]) for (const [x, dy] of [[2.6, -0.6], [3.1, -0.9], [2.4, -1.1]]) mark(onFace(side * x, dy), C.ruddy);
  }
  if (C.grey) {
    // Crow's feet.
    const onFace = (x: number, dy: number): V3 => [x, hy + dy, hz + HEAD.rz * Math.sqrt(Math.max(0, 1 - (x / HEAD.rx) ** 2 - (dy / HEAD.ry) ** 2)) + 0.1];
    for (const side of [-1, 1]) mark(onFace(side * 3.1, 0.6), darker(C.skin[1]));
  }
  return { solids, details };
}

// ---------------------------------------------------------------------------
// The men themselves
// ---------------------------------------------------------------------------

const BOOT: Tones = [P.leatherDark, P.barkDark, P.leather];
const BELT: Tones = [0x3a2a1e, 0x241a12, 0x523c2a];

/** The militia's men, by folk id: drawn finely as 'folk-<id>'. */
export const MILITIA_LOOKS: Record<string, MilitiaLook> = {
  /**
   * Aldous, the spearman on the square: the militia as everyone pictures them.
   * A kettle helm, a shirt of mail under the blue tabard with its gold boss, a
   * round targe slung on his back, his spear; brown hair, a short brown beard.
   */
  'militia-spear': {
    skin: [P.skin, P.skinShade, 0xf8d4b0],
    hair: [0x5a3a24, 0x3a2416, 0x74503a],
    hairStyle: 'short',
    beard: 'short',
    helm: 'kettle',
    body: 'mail',
    tabard: BLUE,
    trim: GOLD,
    under: MAIL,
    hose: [0x4a3a30, 0x30261e, 0x605044],
    boot: BOOT,
    belt: BELT,
    weapon: 'spear',
    targe: true,
    badge: 'boss',
    iris: 0x5a4030,
    brow: 0x3a2416,
    browSlant: 0.25,
    lip: 0xa86a58,
  },
  /**
   * Linus, the archer: lean and clean-shaven, freckled and sandy-haired, a
   * militia-blue hood up over a buff gambeson, a short tabard, a bracer on his
   * bow arm, a longbow at his side and a quiver on his back.
   */
  'militia-archer': {
    bulk: 0.92,
    tall: 1.03,
    skin: [0xf2cca8, 0xcca080, 0xffe0c4],
    hair: [0xc89a5a, 0x9a7440, 0xe0b878],
    hairStyle: 'short',
    beard: 'none',
    helm: 'hood',
    body: 'gambeson',
    tabard: [0x34548a, 0x223a64, 0x4a6ca8],
    trim: GOLD,
    under: [0xb8a07a, 0x8e7a5a, 0xd2bc94],
    hose: [0x3e5070, 0x2a3850, 0x56688a],
    boot: [0x5a4232, 0x3e2c22, 0x74583e],
    belt: [0x6a4a30, 0x4a3220, 0x86603e],
    wraps: [0x9a8a6e, 0x6e624e, 0xb4a486],
    hood: [0x3a5480, 0x283c5e, 0x52709e],
    weapon: 'bow',
    badge: 'boss',
    iris: 0x4a7a5a,
    brow: 0x9a7440,
    browSlant: 0.1,
    lip: 0xb87a64,
    freckles: 0xd89c78,
  },
  /**
   * Piers, the newest recruit: tall and gangly, a tabard a size too big over a
   * plain leather jerkin, an iron skullcap sat high on his head with its strap
   * dangling, big ears, a wispy try at a moustache, puttees, and a spear he
   * holds like he's afraid of it.
   */
  'militia-recruit': {
    bulk: 0.86,
    tall: 1.1,
    skin: [0xecc4a4, 0xc69e80, 0xfcdcc0],
    ruddy: 0xe09a88,
    hair: [0x2a2224, 0x1a1416, 0x403436],
    hairStyle: 'shaggy',
    beard: 'none',
    helm: 'skullcap',
    body: 'leather',
    tabard: [0x3a5aa0, 0x28427a, 0x5276bc],
    trim: GOLD,
    under: [0x7a5a3e, 0x56402a, 0x94704e],
    hose: [0x6a5a48, 0x4a3e30, 0x84725c],
    boot: BOOT,
    belt: BELT,
    wraps: [0xa89a80, 0x7c705a, 0xc4b69a],
    weapon: 'spear',
    badge: 'boss',
    iris: 0x6a5040,
    brow: 0x1a1416,
    browSlant: -0.45,
    lip: 0xc0806c,
    mouthWidth: 2,
  },
  /**
   * Oswin, the swordsman: dark-skinned and broad, a close black beard and
   * tight curls under a nasal helm, a brigandine of brass-riveted plates
   * covered in militia blue over mail sleeves, an arming sword held low, and a
   * kite shield painted with the militia's gold spear.
   */
  'militia-sword': {
    bulk: 1.06,
    skin: [0x9a6a4a, 0x724a32, 0xb4845e],
    hair: [0x1e1614, 0x120c0a, 0x342824],
    hairStyle: 'curly',
    beard: 'short',
    helm: 'nasal',
    body: 'brigandine',
    trim: GOLD,
    under: [0x2a4472, 0x1c2e50, 0x3c5c94],
    hose: [0x3a3034, 0x262024, 0x504448],
    boot: [0x3e2c22, 0x281c16, 0x5a4232],
    belt: BELT,
    weapon: 'sword',
    badge: 'none',
    iris: 0x3a2418,
    brow: 0x120c0a,
    browSlant: 0.45,
    lip: 0x7a4a3c,
  },
  /**
   * Old Godwin, the veteran who keeps the garrison door: big, broad and grey,
   * a grizzled full beard and an old scar, a nasal helm with a mail aventail, a
   * hauberk to the knee under a faded, darned tabard, leather pauldrons, and a
   * bill to lean on.
   */
  'militia-veteran': {
    bulk: 1.14,
    belly: 0.35,
    skin: [0xd8a07c, 0xb07a5a, 0xecb894],
    ruddy: 0xc87a66,
    hair: [0x6a625c, 0x4a4440, 0x8a827c],
    grey: [0xb4aca4, 0x8a827c, 0xd4ccc4],
    hairStyle: 'short',
    beard: 'full',
    helm: 'nasal',
    aventail: true,
    body: 'mail',
    long: true,
    tabard: [0x4a6286, 0x34486a, 0x627aa0],
    trim: [0xc8a050, 0x9a7a38, 0xe0bc6c],
    under: MAIL,
    hose: [0x4a4038, 0x342c26, 0x605448],
    boot: [0x3e2c22, 0x281c16, 0x5a4232],
    belt: BELT,
    weapon: 'bill',
    badge: 'boss',
    faded: true,
    iris: 0x5a6a7a,
    brow: 0xb4aca4,
    browSlant: 0.55,
    lip: 0x9a5e50,
    scar: 0xc08068,
  },
  /**
   * Sergeant Brannock: square-jawed and grey, bare-headed with a grey crop and
   * a clipped grey beard, an old scar, mail under the militia's blue with his
   * three gold chevrons, leather pauldrons, a dark blue cloak with a gold
   * brooch, and his sword at his hip with his hand resting on it.
   */
  sergeant: {
    bulk: 1.06,
    skin: [0xe0aa86, 0xb88262, 0xf0c4a0],
    hair: [0x8a827c, 0x6a625c, 0xa8a09a],
    grey: [0xa8a09a, 0x8a827c, 0xc8c0ba],
    hairStyle: 'crop',
    beard: 'short',
    helm: 'none',
    body: 'mail',
    tabard: BLUE,
    trim: GOLD,
    under: MAIL,
    hose: [0x3a3032, 0x241c1e, 0x50444a],
    boot: [0x3e2c22, 0x281c16, 0x5a4232],
    belt: BELT,
    weapon: 'scabbard',
    cloak: [0x1e3256, 0x14223e, 0x2e4a7a],
    badge: 'chevrons',
    iris: 0x4a5a6a,
    brow: 0x6a625c,
    browSlant: 0.5,
    lip: 0x9a5e50,
    scar: 0xc08068,
  },
  /**
   * Hamm, who keeps the cells: stout and round-faced and ruddy, stubbled, a
   * kettle helm, a leather jerkin straining under his tabard, a big ring of
   * keys at his hip, and a cudgel.
   */
  jailer: {
    bulk: 1.12,
    belly: 1,
    skin: [0xeab494, 0xc48c6e, 0xfac8aa],
    ruddy: 0xd88070,
    hair: [0x7a4a2a, 0x54321c, 0x96603a],
    hairStyle: 'short',
    beard: 'stubble',
    helm: 'kettle',
    body: 'leather',
    tabard: BLUE,
    trim: GOLD,
    under: [0x6a4a30, 0x4a3220, 0x86603e],
    hose: [0x4e4234, 0x342a20, 0x645440],
    boot: BOOT,
    belt: BELT,
    weapon: 'cudgel',
    keys: true,
    badge: 'boss',
    iris: 0x5a4030,
    brow: 0x54321c,
    browSlant: -0.15,
    lip: 0xb06a5a,
    mouthWidth: 3,
    smile: true,
  },
};

/** The militia drawn finely, by folk id. */
export const MILITIA_FOLK: Record<string, (pose: Pose3D) => Model> = Object.fromEntries(
  Object.entries(MILITIA_LOOKS).map(([id, look]) => [id, (pose: Pose3D) => militiaModel(pose, look)]),
);
