import type Phaser from 'phaser';
import { darker, type Tones } from './character';
import { chain, speck } from './beasts3d';
import { Detail, generateFigure3D, Hit, limb, Material, Model, Pose3D, Solid } from './figure3d';
import { FINE_SPEC, fineFace, shade } from './fine3d';
import { asChild, seatedLegs } from './models3d';
import { PALETTE as P } from './palette';

/**
 * The people of the Black Rose, Gloomhaven's tavern (world/BlackRoseMap.ts),
 * drawn finely like the hero and the companions (FINE_SPEC in fine3d.ts): the
 * Widow Thorne behind her bar in widow's black with a black rose at her
 * breast; Grubb, her doorman, a slab of a man with tattooed arms; Midge the
 * pot-girl; Silas Crane, one-eyed, at his dice; Hollis, the monk they threw
 * out, in what's left of his habit; Old Sedge the eel-wife with her pipe;
 * Dunn and Ferret off the wharf; and in the back room the gentleman in grey.
 *
 * One builder ({@link roseModel}) makes them all from a {@link RoseLook}.
 */

type V3 = [number, number, number];

export interface RoseLook {
  /** Broader and taller than an ordinary man (1 for both is the hero's size). */
  bulk?: number;
  tall?: number;
  /** A belly pushing out the front. */
  belly?: number;
  /** Stooped: the head and shoulders pushed forward (0..1). */
  stoop?: number;
  skin: Tones;
  ruddy?: number;
  hair: Tones;
  grey?: Tones;
  hairStyle: 'short' | 'crop' | 'bald' | 'bun' | 'long' | 'tonsure' | 'shaggy' | 'tied';
  beard: 'none' | 'stubble' | 'short' | 'full' | 'moustache';
  hat?: 'slouch' | 'cap' | 'kerchief' | 'hood';
  hatCloth?: Tones;
  /** A leather patch over the right eye (screen-left, facing us), its strap round the head. */
  eyepatch?: boolean;
  /** A ring in the left ear, in this colour. */
  earring?: number;
  /**
   * What's worn: a dress to the floor; a long coat to the knee open over a shirt and waistcoat; a
   * sleeveless leather jerkin over bare arms; a monk's habit to the ankle, roped; or a smock and
   * breeches with an apron.
   */
  garment: 'dress' | 'coat' | 'jerkin' | 'habit' | 'smock';
  outer: Tones;
  /** The shirt or shift: at the neck, the cuffs, the sleeves. */
  inner: Tones;
  /** The waistcoat (under a coat) or the bodice's lacing (on a dress). */
  waistcoat?: Tones;
  trouser: Tones;
  boot: Tones;
  belt: Tones;
  apron?: Tones;
  /** A shawl round the shoulders. */
  shawl?: Tones;
  /** A high lace collar and a black rose pinned at the breast. */
  rose?: boolean;
  /** Bare, brawny arms, tattooed in this ink. */
  tattoo?: number;
  /** A ring of keys at the belt. */
  keys?: boolean;
  /** What the right hand (screen-left) holds, and what the left does. */
  right?: 'tankard' | 'cudgel' | 'pipe' | 'rag' | 'knife' | 'dice' | 'none';
  left?: 'hip' | 'swing' | 'folded';
  /** Ragged and patched (Hollis's habit, Midge's dress). */
  ragged?: boolean;
  iris: number;
  brow: number;
  browSlant: number;
  lip: number;
  mouthWidth?: number;
  smile?: boolean;
  lashes?: number;
  freckles?: number;
  scar?: number;
  /** Dark under the eyes: a drinker, or someone who doesn't sleep. */
  hollow?: number;
}

const PEWTER: Tones = [0x8a8a90, 0x5a5a62, 0xb4b4bc];
const IRON: Tones = [0x5a5a64, 0x3a3a42, 0x8a8a94];
const OAK: Tones = [0x5e4230, 0x3e2a1e, 0x7a5840];
const CLAY: Tones = [0xe0d8c4, 0xb4ac98, 0xf4ecda];
const BONE: Tones = [0xe8e0c8, 0xb8b098, 0xfff8e0];
const ROSE: Tones = [0x2a1018, 0x140810, 0x5a1424];
const LACE: Tones = [0x3a3438, 0x241e22, 0x5a5258];
const RAG: Tones = [0xc8bca0, 0x9a8e76, 0xe0d6bc];

const knob = (p: V3, r: number, material: Material, soft = false): Solid => ({ cx: p[0], cy: p[1], cz: p[2], rx: r, ry: r, rz: r, material, soft });
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const along = (p: V3, d: V3, k: number): V3 => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const lit = (t: Tones): Tones => [t[2], t[0], t[2]];

/** One of the Rose's people in one pose. Body space: x across (screen-right facing us), y up, z the way they face. */
export function roseModel(pose: Pose3D, look: RoseLook): Model {
  const C = look;
  const w = C.bulk ?? 1;
  const up = ((C.tall ?? 1) - 1) * 12;
  const belly = C.belly ?? 0;
  const stoop = C.stoop ?? 0;
  const b = pose.bob;
  const s = pose.stride;
  const sit = !!pose.sit;
  const solids: Solid[] = [];
  const details: Detail[] = [];
  const mark = (p: V3, color: number, size = 0.5) => details.push({ x: p[0], y: p[1], z: p[2], color, size });
  const Y = (y: number) => y + (sit ? 0 : up) - b;
  /** How far forward a stoop pushes a point at this height. */
  const lean = (y: number) => Math.max(0, y - Y(18)) * stoop * 0.32;
  const waist = Y(15.6) + b * (sit ? 0 : 0.5);
  const long = C.garment === 'dress' || C.garment === 'habit';
  const worn = (t: Tones) => (h: Hit): Tones => (C.ragged && speck(h, 1.6) < 0.12 ? shade(t) : C.ragged && speck(h, 2.2) > 0.94 ? lit(t) : t);

  // --- Legs (hidden under a long skirt or habit, but there to walk on).
  if (sit) {
    solids.push(...seatedLegs(2.2 * w, long ? C.outer : C.trouser, C.boot, 1.8 * w));
  } else {
    for (const side of [-1, 1]) {
      const swing = s * side;
      const lift = swing < 0 ? 0.9 : 0;
      const x = side * 2.2 * w;
      const hip: V3 = [x, 12.5 + up - b * 0.5, 0];
      const ankle: V3 = [x, 3.4 + lift, swing * 2.3];
      const foot: V3 = [x, 1 + lift, 0.9 + swing * 2.3];
      const at = (y: number) => lerp3(hip, ankle, (hip[1] - y) / (hip[1] - ankle[1]));
      solids.push(...limb(hip, ankle, 1.8 * w, 1.5 * w, C.trouser));
      if (!long) {
        // Boots to the calf, turned down, scuffed and caked with marsh mud at the foot.
        solids.push(...limb(at(7.6), ankle, 1.78 * w, 1.66 * w, C.boot));
        const cuff = at(7.8);
        solids.push({ cx: cuff[0], cy: cuff[1], cz: cuff[2], rx: 1.95 * w, ry: 0.7, rz: 1.95 * w, material: shade(C.boot) });
      }
      const mud: Tones = [0x3e2e22, 0x2a1e16, 0x54402e];
      solids.push({ cx: foot[0], cy: foot[1], cz: foot[2], rx: 1.5 * w, ry: 1, rz: 2.3 * w, material: (h) => (h.y < foot[1] - 0.2 ? mud : C.boot) });
    }
  }

  // --- The skirt: a dress or habit to the floor, a coat's skirts to the knee, a smock to mid-thigh.
  const apronFront = (h: Hit, y: number) => C.apron && h.nz > 0.4 && Math.abs(h.x) < 3.4 * w + (15 - y) * 0.06 && y > (C.garment === 'dress' ? 4 : 8);
  if (!sit) {
    const from = long ? 1.6 : C.garment === 'coat' ? 6.6 : 9.6;
    for (let y = from; y <= 14.5; y += 0.5) {
      const t = (14.5 - y) / (14.5 - from);
      const flare = long ? t * 1.6 : t * 0.7;
      solids.push({
        cx: 0, cy: y + up - b * 0.5, cz: s * 0.28 * t * 3 + belly * 0.5, rx: (4.6 + flare) * w, ry: 0.8, rz: (3.6 + flare * 0.8 + belly * 0.6) * w,
        material: (h) => {
          if (apronFront(h, y)) return y < from + 1 ? shade(C.apron!) : speck(h, 1.4) < 0.12 ? shade(C.apron!) : C.apron!;
          // A coat open down the front, the shirt-tails and breeches showing between.
          if (C.garment === 'coat' && h.nz > 0.7 && Math.abs(h.x) < 0.9 + t * 1.8) return C.trouser;
          if (y < from + 0.6) return shade(C.outer);
          // Folds running down the skirt.
          if (long && Math.floor((Math.atan2(h.x, h.z) + 4) * 4) % 3 === 0) return shade(C.outer);
          // A torn, uneven hem.
          return worn(C.outer)(h);
        },
      });
    }
    // The habit's hem dragging, frayed.
    if (C.garment === 'habit' && C.ragged) for (const x of [-3.6, -1, 2.2, 4.4]) solids.push({ cx: x * w, cy: 1.4, cz: 2.4 + (x > 0 ? 0.4 : 0), rx: 0.9, ry: 0.8, rz: 0.6, material: shade(C.outer) });
  } else {
    solids.push({ cx: 0, cy: 10.8, cz: 2, rx: 4.8 * w, ry: 1.3, rz: 4.6 * w, material: (h) => (C.apron && h.nz > 0.4 && h.y > 10.4 ? C.apron : C.outer) });
    if (long) for (const side of [-1, 1]) solids.push(...limb([side * 2.4 * w, 10, 5.6], [side * 2.6 * w, 2.4, 6.4], 2.2 * w, 2.4 * w, C.outer));
  }

  // --- The body.
  const body = (h: Hit): Tones => {
    const dy = h.y - waist;
    if (Math.abs(dy) < 0.65 && C.garment !== 'dress') {
      if (C.garment === 'habit') return (Math.floor(h.x * 2 + h.z * 2) % 2 ? RAG : shade(RAG)); // the rope
      if (h.nz > 0.85 && Math.abs(h.x) < 0.8) return Math.abs(h.x) < 0.35 && Math.abs(dy) < 0.3 ? C.belt : PEWTER;
      return Math.abs(dy) > 0.4 ? shade(C.belt) : C.belt;
    }
    if (C.apron && h.nz > 0.5 && Math.abs(h.x) < 3 * w && h.y < Y(22) && h.y > waist) return C.apron;
    const open = 0.7 + Math.max(0, h.y - waist) * 0.12;
    switch (C.garment) {
      case 'coat':
        if (h.nz > 0.5 && Math.abs(h.x) < open) return h.y > Y(23.5) ? C.inner : C.waistcoat ?? C.inner;
        if (h.nz > 0.5 && Math.abs(h.x) < open + 0.5 && h.y > Y(21)) return shade(C.outer); // the lapel
        if (Math.abs(Math.abs(h.nx) - 0.84) < 0.04) return shade(C.outer);
        return worn(C.outer)(h);
      case 'jerkin':
        if (h.nz > 0.6 && Math.abs(h.x) < 0.5 && h.y > waist + 1) return Math.floor(h.y * 1.4) % 2 ? shade(C.outer) : C.inner; // the lacing
        if (h.y > Y(24.4) && h.nz > -0.2) return C.inner;
        return speck(h, 1.1) < 0.14 ? shade(C.outer) : C.outer;
      case 'habit':
        if (h.y > Y(24.6) && h.nz > 0.2) return shade(C.outer); // the cowl's fold
        return worn(C.outer)(h);
      case 'smock':
        if (h.y > Y(24.2) && h.nz > -0.2) return C.inner;
        return worn(C.outer)(h);
      case 'dress':
      default:
        // A bodice laced up the front, or buttoned high to the throat.
        if (C.waistcoat && h.nz > 0.65 && Math.abs(h.x) < 0.7 && h.y > waist && h.y < Y(23.5)) return Math.floor(h.y * 1.6) % 2 ? C.waistcoat : shade(C.outer);
        if (C.rose && h.nz > 0.6 && Math.abs(h.x) < 0.25) return Math.floor(h.y * 1.5) % 2 ? lit(C.outer) : C.outer; // jet buttons
        if (h.y > Y(24.2) && h.nz > -0.2 && !C.rose) return C.inner;
        return worn(C.outer)(h);
    }
  };
  const front = belly * 1.6;
  solids.push({ cx: 0, cy: sit ? 14.6 - b : 14.6 + up - b * 0.5, cz: belly * 0.6, rx: 4.5 * w, ry: 2.6, rz: (3.4 + belly * 0.8) * w, material: body });
  solids.push({ cx: 0, cy: Y(18), cz: belly * 0.8 + lean(18) * 0.5, rx: 4.4 * w, ry: 3.4, rz: (3.4 + belly * 0.9) * w, material: body });
  solids.push({ cx: 0, cy: Y(22.2), cz: 0.1 + lean(22.2), rx: 4.9 * w, ry: 4.4, rz: 3.6 * w, material: body });
  if (belly > 0) solids.push({ cx: 0, cy: Y(17), cz: front, rx: 4.1 * w, ry: 3.2, rz: 3 * w, material: body });
  // A dress's laced bodice is tied at the waist with a sash.
  if (C.garment === 'dress') solids.push({ cx: 0, cy: waist, cz: belly * 0.6, rx: 4.6 * w, ry: 0.6, rz: (3.5 + belly * 0.8) * w, material: shade(C.outer) });
  // The apron's bow at the back.
  if (C.apron) for (const side of [-1, 1]) solids.push({ cx: side * 1, cy: waist + 0.2, cz: -3.5 * w, rx: 1, ry: 0.7, rz: 0.4, material: C.apron });
  // The coat's collar standing up, or the habit's cowl lying back on the shoulders.
  if (C.garment === 'coat') for (const side of [-1, 1]) solids.push({ cx: side * 2.4 * w, cy: Y(25.6), cz: -0.4 + lean(25.6), rx: 1.6 * w, ry: 1.8, rz: 2.8 * w, material: shade(C.outer) });
  if (C.garment === 'habit') solids.push({ cx: 0, cy: Y(25.2), cz: -1.6 + lean(25.2), rx: 4.8 * w, ry: 2, rz: 3.6 * w, material: (h) => (h.nz > 0.5 ? shade(C.outer) : worn(C.outer)(h)) });
  // The shawl, round the shoulders and crossed over the breast.
  if (C.shawl) {
    const sh = C.shawl;
    const weave = (h: Hit): Tones => ((Math.floor(h.x * 0.8 + 20) + Math.floor(h.y * 0.8)) % 2 ? sh : shade(sh));
    solids.push({ cx: 0, cy: Y(23.6), cz: 0.3 + lean(23.6), rx: 5.6 * w, ry: 2.6, rz: 4.2 * w, material: weave });
    solids.push({ cx: 0, cy: Y(21), cz: -1.2 + lean(21), rx: 4.4 * w, ry: 3, rz: 3.4 * w, material: weave });
    for (const side of [-1, 1]) solids.push(...limb([side * 2.6 * w, Y(22.4), 3.4 * w + lean(22)], [-side * 1.2 * w, Y(19.4), 3.6 * w + belly], 0.9, 0.7, weave, 0.4));
  }
  // The Widow's high collar of black lace, and the black rose pinned at her breast.
  if (C.rose) {
    solids.push({ cx: 0, cy: Y(26.4), cz: 0.3, rx: 2.6 * w, ry: 1.8, rz: 2.6 * w, material: (h) => (Math.floor(h.y * 3 + Math.atan2(h.x, h.z) * 4) % 2 ? LACE : shade(LACE)) });
    const at: V3 = [-2.3 * w, Y(22.6), 3.6 * w];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      solids.push(knob([at[0] + Math.cos(a) * 0.8, at[1] + Math.sin(a) * 0.8, at[2] + 0.1], 0.65, ROSE));
    }
    solids.push(knob([at[0], at[1], at[2] + 0.4], 0.55, [0x5a1424, 0x2a0a12, 0x8a2a36]));
    solids.push(...limb([at[0] + 0.4, at[1] - 0.8, at[2]], [at[0] + 1.2, at[1] - 3, at[2] - 0.2], 0.25, 0.2, [0x1e2a1e, 0x121a12, 0x2e3e2a], 0.3));
  }
  // A pouch on the right hip.
  if (C.garment !== 'dress' && C.garment !== 'habit') solids.push({ cx: -3.6 * w, cy: waist - 1.5, cz: 2.4 * w + front * 0.4, rx: 1.3, ry: 1.3, rz: 0.8, material: (h) => (h.y > waist - 1 ? shade(C.belt) : C.belt) });
  // The keys at the Widow's (or anyone's) belt.
  if (C.keys) {
    const ring: V3 = [4.2 * w, waist - 1.2, 2.4 * w + front * 0.3];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      solids.push(knob([ring[0] + Math.cos(a) * 1, ring[1] + Math.sin(a) * 1, ring[2]], 0.26, IRON));
    }
    for (const [dx, len] of [[-0.6, 2.4], [0.1, 3], [0.7, 2]]) {
      const top: V3 = [ring[0] + dx, ring[1] - 0.9, ring[2] + 0.3];
      solids.push(...limb(top, [top[0] + dx * 0.3, top[1] - len, top[2]], 0.24, 0.24, IRON, 0.3));
      solids.push(knob([top[0] + dx * 0.3 + 0.3, top[1] - len + 0.2, top[2]], 0.38, IRON));
    }
  }

  // --- Arms.
  const bare = !!C.tattoo;
  const sleeve = (h: Hit): Tones => {
    if (bare) return C.skin;
    if (C.garment === 'jerkin' || C.garment === 'smock') return C.inner;
    return worn(C.outer)(h);
  };
  /** Tattoos on bare arms: bands and a crude anchor of knotwork. */
  const inked = (h: Hit): Tones => {
    if (!C.tattoo) return C.skin;
    const band = Math.abs(((h.y + 40) % 4) - 2) < 0.35 && h.y > Y(17) && h.y < Y(23);
    const knot = speck(h, 0.7) < 0.18 && h.y > Y(19) && h.y < Y(22.5);
    return band || knot ? [C.tattoo, darker(C.tattoo), C.tattoo] : C.skin;
  };
  let rightHand: V3 = [0, 0, 0];
  for (const side of [-1, 1]) {
    const right = side === -1;
    const swing = sit ? 0 : -s * side * 2;
    const shoulder: V3 = [side * 5 * w, Y(24), 0.1 + lean(24)];
    let elbow: V3;
    let hand: V3;
    const holds = right ? C.right ?? 'none' : 'none';
    if (sit) {
      elbow = [side * 5.6 * w, Y(19.6), 2 + lean(19)];
      hand = right && holds !== 'none' ? [side * 4.6 * w, Y(17.6), 5.2] : [side * 3.4 * w, 12.6, 4.6];
    } else if (right && (holds === 'tankard' || holds === 'pipe' || holds === 'dice')) {
      // Raised a little in front: about to drink, to puff, to throw.
      elbow = [side * 6 * w, Y(19.8), 1.2 + lean(20)];
      hand = holds === 'pipe' ? [side * 3.4 * w, Y(24.6), 4.4 + lean(24)] : [side * 4.6 * w, Y(19.6), 4.8 + lean(20)];
    } else if (right && (holds === 'cudgel' || holds === 'knife')) {
      elbow = [side * 6.4 * w, Y(20.2), 0.8];
      hand = [side * 6.6 * w, Y(17.2), 2.6];
    } else if (right && holds === 'rag') {
      elbow = [side * 5.8 * w, Y(19.8), 2.2];
      hand = [side * 3.2 * w, Y(17.8), 4.8 + belly];
    } else if (!right && C.left === 'hip') {
      elbow = [side * 7.4 * w, Y(19.6), -0.6];
      hand = [side * 4.8 * w, waist + 0.6, 2];
    } else if (C.left === 'folded' && !right) {
      elbow = [side * 5.8 * w, Y(19.4), 2];
      hand = [-side * 2.4 * w, Y(20.4), 4.4 * w + belly];
    } else {
      elbow = [side * 5.8 * w, Y(20.2), 0.3 + swing * 0.5 + lean(20)];
      hand = [side * 6 * w, Y(16.8), 0.8 + swing + lean(17)];
    }
    solids.push(knob(shoulder, 2.3 * w, bare ? C.outer : sleeve));
    solids.push(...limb(shoulder, elbow, (bare ? 2 : 1.8) * w, (bare ? 1.8 : 1.6) * w, bare ? inked : sleeve, 0.45));
    const forearm = limb(elbow, hand, (bare ? 1.8 : 1.6) * w, (bare ? 1.6 : 1.45) * w, bare ? inked : sleeve, 0.45);
    forearm.forEach((f, i) => {
      if (i === forearm.length - 1 && !bare) solids.push({ ...f, rx: f.rx + 0.15, ry: f.ry + 0.15, rz: f.rz + 0.15, material: C.garment === 'coat' ? shade(C.outer) : C.inner });
      else solids.push(f);
    });
    const glove = C.skin;
    const h: V3 = [hand[0], hand[1] - 0.9, hand[2] + 0.2];
    solids.push({ cx: h[0], cy: h[1], cz: h[2], rx: 1.4 * w, ry: 1.45 * w, rz: 1.45 * w, material: glove, soft: true });
    if (right) rightHand = h;
  }

  // --- What's in the right hand.
  const [px, py, pz] = rightHand;
  switch (C.right) {
    case 'tankard':
      solids.push({ cx: px + 0.4, cy: py + 1.2, cz: pz + 1.2, rx: 1.4, ry: 2.2, rz: 1.4, material: (h) => (Math.abs(h.y - py - 0.4) < 0.3 ? shade(PEWTER) : PEWTER) });
      solids.push({ cx: px + 0.4, cy: py + 3.4, cz: pz + 1.2, rx: 1.25, ry: 0.3, rz: 1.25, material: [0x5a3a22, 0x3a2414, 0x7a5232] });
      break;
    case 'cudgel': {
      const d = norm([-0.1, -0.9, 0.42]);
      solids.push(...limb(along(rightHand, d, -1.4), along(rightHand, d, 6), 0.6, 1.15, OAK, 0.35));
      solids.push(knob(along(rightHand, d, 6.6), 1.4, OAK));
      for (const k of [3.4, 5.2]) solids.push(knob(along(along(rightHand, d, k), [1, 0, 0], 0.8), 0.6, shade(OAK)));
      // Iron nails driven through the head.
      for (const a of [0, 2, 4]) mark(along(along(rightHand, d, 6.6), [Math.cos(a), 0, Math.sin(a)], 1.4), 0xb4b4bc);
      break;
    }
    case 'knife': {
      const d = norm([-0.05, 0.9, 0.4]);
      solids.push(...limb(rightHand, along(rightHand, d, 1.6), 0.5, 0.5, [0x4a2c1b, 0x2e1a10, 0x6e4228], 0.3));
      solids.push(...limb(along(rightHand, d, 1.8), along(rightHand, d, 5.4), 0.55, 0.15, [0xc8ccd4, 0x8a8e98, 0xf0f4fc], 0.3));
      break;
    }
    case 'pipe':
      // A long clay pipe from the hand to the mouth, a curl of smoke coming off the bowl.
      solids.push(...limb([px + 0.6, py + 1, pz + 1.4], [px + 2.8, py + 1.6, pz + 2.8], 0.3, 0.3, CLAY, 0.3));
      solids.push({ cx: px + 0.2, cy: py + 1.6, cz: pz + 1.2, rx: 0.7, ry: 0.9, rz: 0.7, material: CLAY });
      mark([px + 0.2, py + 2.6, pz + 1.2], 0xe87a32);
      break;
    case 'rag':
      solids.push({ cx: px, cy: py - 0.6, cz: pz + 0.4, rx: 1.5, ry: 1.2, rz: 1.1, material: RAG });
      break;
    case 'dice':
      solids.push({ cx: px + 0.4, cy: py + 1.4, cz: pz + 0.8, rx: 1.1, ry: 1.6, rz: 1.1, material: [0x6e4228, 0x4a2c1b, 0x8f5c38] });
      mark([px + 1.4, py + 0.2, pz + 1.6], BONE[0]);
      break;
    default:
      break;
  }

  // --- Head.
  const hy = Y(32.2) - stoop * 1.6;
  const hz = 0.4 + lean(32) + stoop * 0.8;
  const HEAD = { rx: 5.2, ry: 5.6, rz: 5 };
  solids.push({ cx: 0, cy: Y(27), cz: 0.3 + lean(27), rx: 2.1 * w, ry: 2, rz: 2.1 * w, material: C.skin });
  const hairTone = (h: Hit): Tones => {
    const py2 = h.y - hy;
    const g = C.grey && ((Math.abs(h.nx) > 0.72 && py2 > -2) || speck(h, 0.6) < 0.18) ? C.grey : C.hair;
    return (Math.floor(h.x * 1.6 + h.z * 0.4 + h.y * 0.3) & 1) === 0 ? g : shade(g);
  };
  const stubble: Tones = [darker(C.skin[1]), darker(darker(C.skin[1])), C.skin[1]];
  const covered = C.hat === 'hood' || C.hat === 'kerchief';
  const face = (h: Hit): Tones => {
    const py2 = h.y - hy;
    if (C.hairStyle === 'tonsure') {
      // A ring of hair round a bald crown.
      if (py2 > 1.2 && py2 < 3.6 && h.nz < 0.7) return hairTone(h);
      if (h.nz < -0.3 && py2 < 3.6) return hairTone(h);
    } else if (C.hairStyle !== 'bald') {
      if (py2 > 2.3) return hairTone(h);
      if (h.nz < -0.2 || (Math.abs(h.nx) > 0.76 && py2 > -1.6)) return hairTone(h);
    } else if (h.nz < -0.4 && py2 < 0 && py2 > -3) {
      return hairTone(h);
    }
    if (h.nz > -0.3) {
      if ((C.beard === 'full' || C.beard === 'short') && py2 < -1.6 + (C.beard === 'full' ? 0.4 : 0) && !(py2 > -2.6 && py2 < -1.7 && Math.abs(h.x) < 1.2)) return hairTone(h);
      if (C.beard === 'short' && Math.abs(h.nx) > 0.6 && py2 < 0) return hairTone(h);
      if (C.beard === 'stubble' && py2 < -1.2 && speck(h, 0.5) < 0.55) return stubble;
    }
    return C.skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: HEAD.rx, ry: HEAD.ry, rz: HEAD.rz, material: face, soft: true });
  // The nose: a beak on some.
  solids.push({ cx: 0, cy: hy + 0.1, cz: hz + 5, rx: 0.85, ry: 1.05, rz: 0.9, material: C.skin, soft: true });
  if (!covered) for (const side of [-1, 1]) solids.push({ cx: side * 5, cy: hy + 0.1, cz: hz + 0.2, rx: 0.7, ry: 1.2, rz: 0.9, material: C.skin, soft: true });

  // The hair that shows.
  if (!covered) {
    if (C.hairStyle === 'crop' || C.hairStyle === 'short') {
      solids.push({ cx: 0, cy: hy + 2.8, cz: hz - 0.9, rx: 5.3, ry: 3.2, rz: 5.1, material: hairTone });
      if (!C.hat) for (const x of [-2.4, -0.8, 0.8, 2.4]) solids.push({ cx: x, cy: hy + 3.6, cz: hz + 3.9, rx: 1.2, ry: 0.8, rz: 0.9, material: hairTone });
    } else if (C.hairStyle === 'shaggy') {
      for (const [x, z] of [[-3, -3.8], [0, -4.6], [3, -3.8], [-4.5, -1.4], [4.5, -1.4], [-1.6, -4.4], [1.6, -4.4]]) solids.push({ cx: x, cy: hy + 1.2, cz: hz + z, rx: 1.3, ry: 1.8, rz: 1.1, material: hairTone });
      solids.push({ cx: 0, cy: hy + 2.4, cz: hz - 0.6, rx: 5.4, ry: 3.4, rz: 5.2, material: hairTone });
      for (const x of [-2.8, -0.6, 1.8]) solids.push({ cx: x, cy: hy + 3.4, cz: hz + 3.9, rx: 1.3, ry: 1.2, rz: 1, material: hairTone });
    } else if (C.hairStyle === 'bun') {
      // Scraped back severely from a middle parting into a tight bun.
      solids.push({ cx: 0, cy: hy + 2.2, cz: hz - 0.6, rx: 5.4, ry: 3.8, rz: 5.2, material: (h) => (Math.abs(h.x) < 0.25 && h.nz > 0.3 ? C.skin : hairTone(h)) });
      solids.push({ cx: 0, cy: hy + 3.4, cz: hz - 5.6, rx: 2.4, ry: 2.2, rz: 1.8, material: hairTone });
      solids.push(...limb([-1.6, hy + 4.8, hz - 5.4], [1.8, hy + 2.2, hz - 6], 0.22, 0.22, IRON, 0.3)); // a hairpin
    } else if (C.hairStyle === 'long' || C.hairStyle === 'tied') {
      solids.push({ cx: 0, cy: hy + 2.4, cz: hz - 0.6, rx: 5.5, ry: 3.6, rz: 5.3, material: hairTone });
      if (C.hairStyle === 'long') {
        // Lank and loose, down past the shoulders.
        for (let y = hy - 8; y <= hy + 1; y += 0.7) solids.push({ cx: 0, cy: y, cz: hz - 2.8, rx: 5.4 - (hy - y) * 0.05, ry: 0.9, rz: 2.4, material: hairTone });
        for (const side of [-1, 1]) solids.push(...limb([side * 4.6, hy + 1, hz + 1], [side * 4.4, hy - 6, hz + 0.6], 1.1, 0.8, hairTone, 0.4));
      } else {
        // Tied back in a tail at the nape.
        solids.push(...chain([[0, hy + 0.6, hz - 5], [0, hy - 2.4, hz - 5.8], [0, hy - 6, hz - 5.4]], [1.2, 0.9, 0.6], hairTone, 0.4));
      }
    }
  }
  // Beards.
  if (C.beard === 'full') {
    solids.push({ cx: 0, cy: hy - 4.2, cz: hz + 2.6, rx: 3.8, ry: 2.8, rz: 2.6, material: hairTone, soft: true });
    solids.push({ cx: 0, cy: hy - 6.2, cz: hz + 2.4, rx: 2.6, ry: 2.4, rz: 1.8, material: hairTone, soft: true });
  } else if (C.beard === 'short') {
    solids.push({ cx: 0, cy: hy - 4, cz: hz + 2.8, rx: 3.4, ry: 2, rz: 2.2, material: hairTone, soft: true });
  }
  if (C.beard === 'full' || C.beard === 'short' || C.beard === 'moustache') {
    for (const side of [-1, 1]) {
      solids.push({ cx: side * 1.2, cy: hy - 1.5, cz: hz + 4.9, rx: 1.3, ry: 0.55, rz: 0.6, material: hairTone, soft: true });
      if (C.beard === 'moustache') solids.push({ cx: side * 2.2, cy: hy - 2.6, cz: hz + 4.3, rx: 0.5, ry: 1.2, rz: 0.5, material: hairTone, soft: true });
    }
  }

  // Hats.
  const hc = C.hatCloth ?? C.outer;
  if (C.hat === 'slouch') {
    // A wide, soft-brimmed hat, its brim drooping at the front and back, a cord round the crown.
    solids.push({
      cx: 0, cy: hy + 4, cz: hz - 0.2, rx: 8.6, ry: 0.8, rz: 8.2,
      material: (h) => (Math.hypot(h.x, h.z - hz) > 7.6 ? shade(hc) : speck(h, 1.4) < 0.1 ? lit(hc) : hc),
    });
    for (const dz of [-1, 1]) solids.push({ cx: 0, cy: hy + 3.4, cz: hz + dz * 6.8, rx: 5.6, ry: 0.7, rz: 1.6, material: shade(hc) });
    solids.push({ cx: 0, cy: hy + 6.2, cz: hz - 0.4, rx: 5.2, ry: 3.2, rz: 5, material: (h) => (h.y < hy + 4.9 ? [0x3a2a1e, 0x241a12, 0x523c2a] : hc) });
  } else if (C.hat === 'cap') {
    // A knitted cap, rolled at the brim, slouched to one side.
    const knit = (h: Hit): Tones => ((Math.floor(h.y * 1.6) + Math.floor(Math.atan2(h.x, h.z) * 6)) % 2 ? hc : shade(hc));
    solids.push({ cx: 0, cy: hy + 2.8, cz: hz - 0.4, rx: 5.6, ry: 1.2, rz: 5.4, material: shade(hc) });
    solids.push({ cx: 0.8, cy: hy + 4.6, cz: hz - 0.8, rx: 5.2, ry: 3.2, rz: 5, material: knit });
    solids.push({ cx: 2.6, cy: hy + 6.2, cz: hz - 2, rx: 2.4, ry: 1.8, rz: 2.4, material: knit });
  } else if (C.hat === 'kerchief') {
    solids.push({ cx: 0, cy: hy + 1.6, cz: hz - 0.6, rx: 5.6, ry: 4.6, rz: 5.4, material: (h) => (h.nz > 0.5 && h.y < hy + 2.8 ? C.skin : speck(h, 1.2) < 0.15 ? shade(hc) : hc) });
    solids.push({ cx: 0, cy: hy + 0.2, cz: hz - 5.6, rx: 1.4, ry: 1.1, rz: 0.9, material: shade(hc) });
    for (const side of [-1, 1]) solids.push({ cx: side * 0.8, cy: hy - 1.6, cz: hz - 5.6, rx: 0.6, ry: 1.6, rz: 0.4, material: hc });
    // Wisps of hair escaping at the brow.
    for (const x of [-2.2, 1.4]) solids.push({ cx: x, cy: hy + 2.8, cz: hz + 4.4, rx: 1.1, ry: 0.9, rz: 0.8, material: hairTone });
  } else if (C.hat === 'hood') {
    const hood = (h: Hit): Tones => (h.nz > 0.6 && h.y < hy + 4 ? shade(hc) : speck(h, 1.3) < 0.12 ? lit(hc) : hc);
    solids.push({ cx: 0, cy: hy + 1.2, cz: hz - 0.9, rx: 5.9, ry: 6.3, rz: 5.4, material: hood });
    // Deep: the face in its shadow.
    solids.push({ cx: 0, cy: hy + 5.2, cz: hz + 3.4, rx: 5, ry: 1.4, rz: 2.4, material: shade(hc) });
    for (let y = Y(23); y <= Y(27); y += 0.5) solids.push({ cx: 0, cy: y, cz: -0.2 + lean(y), rx: 6 * w, ry: 0.8, rz: 4.5 * w, material: (h) => (y < Y(23.4) ? shade(hc) : hood(h)) });
  }

  // The eyepatch and its strap.
  if (C.eyepatch) {
    solids.push({ cx: -1.9, cy: hy + 1, cz: hz + 4.7, rx: 1.4, ry: 1.3, rz: 0.6, material: [0x241a16, 0x140e0c, 0x3a2a22], soft: true });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const a = -0.6 + t * 2.6;
      mark([Math.sin(a) * 5.4, hy + 2 - t * 0.6 + (t > 0.5 ? 0 : 0), hz + Math.cos(a) * 5.2 + 0.1], 0x241a16);
    }
  }
  if (C.earring !== undefined) solids.push(knob([5.3, hy - 1.4, hz + 0.4], 0.45, [C.earring, darker(C.earring), C.earring]));

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
    lashes: C.lashes,
    freckles: C.freckles,
    scar: C.scar,
  }, HEAD));
  const onFace = (x: number, dy: number): V3 => [x, hy + dy, hz + HEAD.rz * Math.sqrt(Math.max(0, 1 - (x / HEAD.rx) ** 2 - (dy / HEAD.ry) ** 2)) + 0.12];
  if (C.eyepatch) {
    // Cover the right eye's marks with the patch.
    for (const [x, dy] of [[-1.9, 1.1], [-1.9, 0.6], [-1.4, 1.1], [-2.4, 1.1], [-1.4, 0.6], [-2.4, 0.6]]) mark(onFace(x, dy), 0x241a16);
  }
  if (C.ruddy !== undefined) for (const side of [-1, 1]) for (const [x, dy] of [[2.6, -0.6], [3.1, -0.9], [2.4, -1.1]]) mark(onFace(side * x, dy), C.ruddy);
  if (C.hollow !== undefined) for (const side of [-1, 1]) for (const x of [1.5, 2.0, 2.5]) mark(onFace(side * x, 0.1), C.hollow);
  if (C.grey) for (const side of [-1, 1]) mark(onFace(side * 3.1, 0.6), darker(C.skin[1]));
  return { solids, details };
}

// ---------------------------------------------------------------------------
// The people themselves
// ---------------------------------------------------------------------------

const BOOT: Tones = [0x3a2a20, 0x241a14, 0x54402e];
const BELT: Tones = [0x3a2a1e, 0x241a12, 0x523c2a];
const BLACK: Tones = [0x241e24, 0x141014, 0x3a323a];

/** The Rose's people, by folk id. */
export const ROSE_LOOKS: Record<string, RoseLook> = {
  /**
   * The Widow Morwen Thorne, who keeps the Black Rose: tall and spare, sixty
   * and straight as a poker, in widow's black buttoned with jet to a high
   * collar of black lace, a black rose pinned at her breast, iron-grey hair
   * scraped into a bun with a pin through it, pale as tallow, a ring of keys at
   * her waist, and a rag in her hand she never stops polishing with.
   */
  thorne: {
    tall: 1.05,
    bulk: 0.92,
    skin: [0xe4cfc0, 0xb8a090, 0xf4e2d4],
    hair: [0x4a4248, 0x2e282e, 0x6a6268],
    grey: [0x9a949a, 0x726c72, 0xbab4ba],
    hairStyle: 'bun',
    beard: 'none',
    garment: 'dress',
    outer: BLACK,
    inner: [0x3a3438, 0x241e22, 0x5a5258],
    trouser: BLACK,
    boot: [0x1e1a1e, 0x121012, 0x342e34],
    belt: BLACK,
    rose: true,
    keys: true,
    right: 'rag',
    left: 'swing',
    iris: 0x5a6a62,
    brow: 0x3a3438,
    browSlant: 0.55,
    lip: 0x6a2a34,
    lashes: 0x241e22,
    hollow: 0xb09088,
  },
  /**
   * Grubb, the Widow's doorman: huge, bald and brutish, a neck like a tree
   * stump, a broken nose, small eyes, a sleeveless leather jerkin laced over a
   * barrel chest, arms like hams covered in blue tattoos, and a nail-studded
   * cudgel.
   */
  grubb: {
    bulk: 1.3,
    tall: 1.08,
    belly: 0.5,
    skin: [0xd8a888, 0xb0806a, 0xecbca0],
    ruddy: 0xc87a6a,
    hair: [0x4a3a30, 0x30241e, 0x645040],
    hairStyle: 'bald',
    beard: 'stubble',
    garment: 'jerkin',
    outer: [0x4a3626, 0x30221a, 0x664a34],
    inner: [0x6a5a48, 0x4a3e32, 0x847260],
    trouser: [0x3a3430, 0x262220, 0x504844],
    boot: BOOT,
    belt: BELT,
    tattoo: 0x3a4a7a,
    right: 'cudgel',
    left: 'swing',
    iris: 0x3a2a20,
    brow: 0x30241e,
    browSlant: 0.6,
    lip: 0x9a5e50,
    mouthWidth: 2,
    scar: 0xb88068,
  },
  /**
   * Midge, the pot-girl, thirteen or so and sharp as a tack: a too-big brown
   * dress hitched and patched, a stained apron, a grey kerchief over a mop of
   * mousy hair, freckles, and a rag over her shoulder for the tables.
   */
  midge: {
    skin: [0xecc4a4, 0xc69e80, 0xfcdcc0],
    hair: [0x8a6a4a, 0x644a32, 0xa8865e],
    hairStyle: 'shaggy',
    beard: 'none',
    hat: 'kerchief',
    hatCloth: [0x7a7470, 0x5a5450, 0x9a9490],
    garment: 'dress',
    outer: [0x6a4a32, 0x4a3222, 0x86603e],
    inner: [0xd8ccb4, 0xaea28a, 0xece2cc],
    waistcoat: [0x8a7a5a, 0x6a5c42, 0xa8987a],
    trouser: [0x4a3a30, 0x30261e, 0x605044],
    boot: BOOT,
    belt: BELT,
    apron: [0xb8ac90, 0x8a7e66, 0xd0c6aa],
    ragged: true,
    right: 'rag',
    left: 'swing',
    iris: 0x5a7a4a,
    brow: 0x644a32,
    browSlant: -0.2,
    lip: 0xc0806c,
    mouthWidth: 3,
    smile: true,
    freckles: 0xc8906c,
    lashes: 0x4a3a2a,
  },
  /**
   * Silas Crane, smuggler and dicer: lean, foxy and handsome gone to seed, a
   * black patch over his right eye, a long coat of bottle-green gone black at
   * the cuffs over a mustard waistcoat, a wide slouch hat, a gold ring in his
   * ear, a thin moustache and a smile that never reaches his eye, and his dice
   * cup always in his hand.
   */
  silas: {
    bulk: 0.94,
    tall: 1.04,
    skin: [0xd8a886, 0xb08262, 0xecbe9c],
    hair: [0x2a2020, 0x1a1414, 0x403434],
    hairStyle: 'tied',
    beard: 'moustache',
    hat: 'slouch',
    hatCloth: [0x2e2a26, 0x1c1a18, 0x443e38],
    eyepatch: true,
    earring: P.gold,
    garment: 'coat',
    outer: [0x2a3a30, 0x1a261e, 0x3e5244],
    inner: [0xd0c4aa, 0xa49a82, 0xe6dcc4],
    waistcoat: [0x9a7a2a, 0x6e561c, 0xb89640],
    trouser: [0x3a302a, 0x26201c, 0x50443c],
    boot: [0x2a201a, 0x1a1410, 0x3e3026],
    belt: BELT,
    right: 'dice',
    left: 'hip',
    iris: 0x6a5a2a,
    brow: 0x1a1414,
    browSlant: 0.35,
    lip: 0x9a5e50,
    mouthWidth: 3,
    smile: true,
    scar: 0xb88068,
  },
  /**
   * Hollis, once Brother Hollis of Saint Elda's, cast out: a ruin of a man in
   * the rags of a brown habit, a rope for a belt, the tonsure grown out into a
   * grey fringe round a bald crown, a week's grey stubble, red-rimmed eyes,
   * a drinker's nose, and a tankard he won't put down.
   */
  hollis: {
    bulk: 0.96,
    belly: 0.3,
    stoop: 0.5,
    skin: [0xe0b090, 0xb88a6c, 0xf2c8aa],
    ruddy: 0xd86a5a,
    hair: [0x8a8078, 0x6a625a, 0xa89e96],
    grey: [0xb4aca4, 0x8a827c, 0xd4ccc4],
    hairStyle: 'tonsure',
    beard: 'stubble',
    garment: 'habit',
    outer: [0x5a4632, 0x3e3022, 0x766048],
    inner: [0x5a4632, 0x3e3022, 0x766048],
    trouser: [0x5a4632, 0x3e3022, 0x766048],
    boot: [0x4a3626, 0x30221a, 0x664a34],
    belt: BELT,
    ragged: true,
    right: 'tankard',
    left: 'swing',
    iris: 0x5a7a8a,
    brow: 0x8a827c,
    browSlant: -0.4,
    lip: 0xa86a5e,
    hollow: 0xa8786a,
  },
  /**
   * Old Sedge, the eel-wife: tiny, bent nearly double, brown and wrinkled as a
   * walnut, a man's knitted cap over wisps of white hair, a shawl of brown and
   * green check, a sack-cloth skirt and an oilskin apron that smells of eel, and
   * a clay pipe forever in her gums.
   */
  sedge: {
    bulk: 0.86,
    tall: 0.92,
    stoop: 1,
    skin: [0xc89a78, 0xa0765a, 0xdcb090],
    hair: [0xd8d4cc, 0xb0aca4, 0xf0ece4],
    grey: [0xd8d4cc, 0xb0aca4, 0xf0ece4],
    hairStyle: 'long',
    beard: 'none',
    hat: 'cap',
    hatCloth: [0x4a5a3e, 0x32402a, 0x627454],
    garment: 'dress',
    outer: [0x6a5e48, 0x4a4232, 0x847a62],
    inner: [0x9a8e76, 0x726852, 0xb4a88e],
    trouser: [0x4a3a30, 0x30261e, 0x605044],
    boot: BOOT,
    belt: BELT,
    apron: [0x3a3e34, 0x262a22, 0x50564a],
    shawl: [0x5a4a32, 0x3e3222, 0x746044],
    ragged: true,
    right: 'pipe',
    left: 'swing',
    iris: 0x8a8a6a,
    brow: 0xd8d4cc,
    browSlant: -0.2,
    lip: 0x8a5a4a,
    mouthWidth: 2,
    smile: true,
  },
  /**
   * Dunn, off the wharf: a big, slab-faced lump with a flattened nose, a short
   * red-brown beard, a sailor's knitted cap, a stained smock with the sleeves
   * rolled to the elbow, tarry breeches, and a tankard.
   */
  dunn: {
    bulk: 1.18,
    belly: 0.6,
    skin: [0xe0a888, 0xb8806a, 0xf0bea0],
    ruddy: 0xd0786a,
    hair: [0x8a4a2a, 0x64321c, 0xa8603a],
    hairStyle: 'short',
    beard: 'short',
    hat: 'cap',
    hatCloth: [0x3a3a4a, 0x262632, 0x52526a],
    garment: 'smock',
    outer: [0x7a7462, 0x5a5446, 0x948e7a],
    inner: [0x9a9480, 0x726c5a, 0xb4ae98],
    trouser: [0x3a342e, 0x26221e, 0x504840],
    boot: BOOT,
    belt: BELT,
    right: 'tankard',
    left: 'swing',
    iris: 0x4a5a6a,
    brow: 0x64321c,
    browSlant: 0.4,
    lip: 0xa8645a,
  },
  /**
   * Ferret: thin, quick and twitchy, sallow, pock-marked, lank black hair to
   * his collar, a scrubby chin, a patched leather jerkin over a filthy shirt,
   * and a knife he cleans his nails with.
   */
  ferret: {
    bulk: 0.86,
    tall: 0.98,
    skin: [0xd8c0a0, 0xb09a7c, 0xecd4b6],
    hair: [0x1e1a1c, 0x121012, 0x342e30],
    hairStyle: 'long',
    beard: 'stubble',
    garment: 'jerkin',
    outer: [0x5a4a36, 0x3e3224, 0x766248],
    inner: [0xa8a088, 0x807862, 0xc0b8a0],
    trouser: [0x3e3a34, 0x2a2622, 0x56504a],
    boot: BOOT,
    belt: BELT,
    ragged: true,
    right: 'knife',
    left: 'swing',
    iris: 0x6a5a3a,
    brow: 0x121012,
    browSlant: 0.5,
    lip: 0x9a6a5a,
    mouthWidth: 3,
    smile: true,
    hollow: 0xa89078,
  },
  /**
   * The gentleman in grey, who sits in the back room and calls himself Vane:
   * slim and still, a deep hood of fine dove-grey wool over a long grey coat
   * with silver buttons, a pale, clean-shaven, ageless face in the hood's
   * shadow, very light eyes, and gloved hands folded on the table.
   */
  vane: {
    tall: 1.06,
    bulk: 0.92,
    skin: [0xe8dcd4, 0xbcb0a8, 0xf8eee6],
    hair: [0xb8b4b0, 0x908c88, 0xd8d4d0],
    hairStyle: 'short',
    beard: 'none',
    hat: 'hood',
    hatCloth: [0x6a6a70, 0x4a4a52, 0x8a8a92],
    garment: 'coat',
    outer: [0x5a5a62, 0x3e3e46, 0x76767e],
    inner: [0xd8d8dc, 0xaeaeb4, 0xf0f0f4],
    waistcoat: [0x3a3a42, 0x26262c, 0x52525a],
    trouser: [0x3a3a42, 0x26262c, 0x52525a],
    boot: [0x1e1e22, 0x121214, 0x34343a],
    belt: [0x2a2a30, 0x1a1a1e, 0x40404a],
    right: 'none',
    left: 'folded',
    iris: 0x9ac8c0,
    brow: 0x908c88,
    browSlant: 0.15,
    lip: 0x9a7a7a,
  },
};

/** The Rose's people drawn finely, by folk id (Midge at a child's size). */
export const ROSE_FOLK: Record<string, (pose: Pose3D) => Model> = Object.fromEntries(
  Object.entries(ROSE_LOOKS).map(([id, look]) => [id, id === 'midge' ? (pose: Pose3D) => asChild(roseModel(pose, look), 26, 0.8, 0.9) : (pose: Pose3D) => roseModel(pose, look)]),
);

/** Draws them all, as 'folk-<id>', eight directions each. */
export function generateBlackRoseFolk(scene: Phaser.Scene): void {
  for (const [id, build] of Object.entries(ROSE_FOLK)) generateFigure3D(scene, `folk-${id}`, build, FINE_SPEC);
}
