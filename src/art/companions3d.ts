import { darker, type Tones } from './character';
import { bendUpper, FightArm, fightLegs, legFrom, offArm, squareTo, vec, weaponArm } from './fight3d';
import { Detail, Hit, limb, Model, Pose3D, Solid } from './figure3d';
import { fineFace, shade } from './fine3d';
import { JETTY_FOLK } from './jettyfolk3d';
import { captiveGoblinModel, shamanGoblinModel } from './goblins3d';
import { MILITIA_FOLK } from './militia3d';
import { seatedLegs } from './models3d';
import { PALETTE as P } from './palette';

/**
 * The companions who travel with the hero (see systems/Companions.ts), drawn
 * finely like him (FINE_SPEC in fine3d.ts): Sigrun the sellsword and Wat of
 * the militia. They're modelled for the finer frame, with more parts than the
 * folk in models3d.ts (seams, rivets, lacing, a braid, a quilted coat) and a
 * face with eye whites, brows and a mouth.
 */

type V3 = [number, number, number];

/** A point a share `t` of the way from a to b. */
function along(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Mail: rows of rings, light and dark by turns, fine enough to read as rings at the finer size. */
function rings(h: Hit, mail: Tones, ring: Tones): Tones {
  return (Math.floor(h.x * 1.1 + h.z * 1.1) + Math.floor(h.y * 1.4)) % 2 ? mail : ring;
}

/** A standing leg: the thigh and shin to the ankle, and where along it a given height falls. */
function standingLeg(side: number, x: number, b: number, s: number): { hip: V3; ankle: V3; foot: V3; at: (y: number) => V3 } {
  const swing = s * side;
  const lift = swing < 0 ? 0.9 : 0;
  const hip: V3 = [x, 12.5 - b * 0.5, 0];
  const ankle: V3 = [x, 3.4 + lift, swing * 2.3];
  const foot: V3 = [x, 1 + lift, 0.9 + swing * 2.3];
  return { hip, ankle, foot, at: (y) => along(hip, ankle, (hip[1] - y) / (hip[1] - ankle[1])) };
}

// ---------------------------------------------------------------------------
// Sigrun
// ---------------------------------------------------------------------------

const SIGRUN = {
  leather: [0x7a5640, 0x553a2a, 0x96704e] as Tones,
  seam: [0x4a3224, 0x30201a, 0x644632] as Tones,
  lace: [0xb09a72, 0x8a7656, 0xcab48a] as Tones,
  mail: [P.ironLight, P.iron, 0xa8a8b4] as Tones,
  ring: [P.iron, 0x34343c, P.ironLight] as Tones,
  belt: [0x34261c, 0x221810, 0x4a3828] as Tones,
  gold: [P.gold, 0xa8802e, P.goldLight] as Tones,
  steel: [0xb8bcc6, 0x7a7e8a, 0xe4e8f0] as Tones,
  trouser: [0x3a3236, 0x282226, 0x4e4448] as Tones,
  boot: [0x3e2c22, 0x281c16, 0x5a4232] as Tones,
  cuff: [0x5a4232, 0x3e2c22, 0x74583e] as Tones,
  glove: [0x2e221c, 0x1e1612, 0x443428] as Tones,
  skin: [0xeac4a4, 0xc69e80, 0xfad8bc] as Tones,
  hair: [0xdccca4, 0xb2a27e, 0xf4ead0] as Tones,
  hairDark: [0xb8a680, 0x8e7e5e, 0xd2c29c] as Tones,
  /** The shield's paint: oxblood and bone, quartered. */
  red: [0x8a2e26, 0x5e1c18, 0xa84038] as Tones,
  bone: [0xd8ccb0, 0xaca084, 0xf0e6cc] as Tones,
  wood: [0x7a5a3a, 0x56402a, 0x94704a] as Tones,
  rim: [0x5a5a64, 0x3a3a42, 0x84848e] as Tones,
};

/**
 * Sigrun, a sellsword: a laced leather jerkin over a mail shirt that shows at
 * the collar, the sleeves and the hem, leather pauldrons riveted at the
 * shoulders, tall boots, a sword at her left hip, and a round shield slung
 * across her back on a strap. Fair hair in a long braid; pale blue eyes, a
 * set mouth, and the old scar down her right cheek.
 */
export function sigrunModel(pose: Pose3D): Model {
  const C = SIGRUN;
  const b = pose.bob;
  const s = pose.stride;
  const sit = !!pose.sit;
  const solids: Solid[] = [];
  const details: Detail[] = [];
  const waist = 15.4 - b * (sit ? 1 : 0.5);
  const fight = sit ? undefined : pose.fight;

  // Legs: dark trousers into tall boots with a turned-down cuff.
  const boot = (h: Hit): Tones => (h.y > 7.4 ? C.cuff : C.boot);
  if (fight) {
    for (const leg of fightLegs(fight)) {
      solids.push(...limb(leg.hip, leg.knee, 1.8, 1.65, C.trouser), ...limb(leg.knee, leg.ankle, 1.65, 1.5, C.trouser));
      for (const [a, z] of legFrom(leg, 8.2)) solids.push(...limb(a, z, 1.75, 1.65, C.boot));
      const top = leg.at(8.4);
      solids.push({ cx: top[0], cy: top[1], cz: top[2], rx: 1.95, ry: 0.7, rz: 1.95, material: C.cuff });
      solids.push({ cx: leg.foot[0], cy: leg.foot[1], cz: leg.foot[2], rx: 1.5, ry: 1, rz: 2.25, material: C.boot });
    }
  } else if (sit) {
    solids.push(...seatedLegs(2.2, C.trouser, C.boot, 1.8));
    for (const side of [-1, 1]) {
      solids.push(...limb([side * 2.2, 8.2, 5.7], [side * 2.2, 3.4, 5.8], 1.85, 1.75, boot));
      solids.push({ cx: side * 2.2, cy: 8.4, cz: 5.7, rx: 2.05, ry: 0.7, rz: 2.05, material: C.cuff });
    }
  } else {
    for (const side of [-1, 1]) {
      const leg = standingLeg(side, side * 2.2, b, s);
      solids.push(...limb(leg.hip, leg.ankle, 1.8, 1.5, C.trouser));
      solids.push(...limb(leg.at(8.2), leg.ankle, 1.75, 1.65, boot));
      const top = leg.at(8.4);
      solids.push({ cx: top[0], cy: top[1], cz: top[2], rx: 1.95, ry: 0.7, rz: 1.95, material: C.cuff });
      solids.push({ cx: leg.foot[0], cy: leg.foot[1], cz: leg.foot[2], rx: 1.5, ry: 1, rz: 2.25, material: C.boot });
    }
  }

  // Everything from here up is the upper body, which a fighting stance leans and turns as one.
  const legsEnd = solids.length;

  // The mail shirt's skirt to mid-thigh, its hem a row of darker rings.
  const mail = (h: Hit) => rings(h, C.mail, C.ring);
  if (!sit) {
    for (let y = 9.5; y <= 14; y += 0.5) {
      solids.push({ cx: 0, cy: y - b * 0.5, cz: s * 0.25, rx: 4.7 + (14 - y) * 0.13, ry: 0.8, rz: 3.6 + (14 - y) * 0.06, material: y < 10 ? shade(C.ring) : mail });
    }
  } else {
    solids.push({ cx: 0, cy: 10.8, cz: 2, rx: 4.8, ry: 1.2, rz: 4.4, material: mail });
  }

  // The jerkin: laced up the front, seams down the sides, a wide belt with a
  // gold buckle, and the baldric of her shield running from right shoulder to left hip.
  const jerkin = (h: Hit): Tones => {
    if (Math.abs(h.y - waist) < 0.9) {
      if (h.nz > 0.8 && Math.abs(h.x) < 1) return Math.abs(h.x) < 0.45 && Math.abs(h.y - waist) < 0.45 ? C.belt : C.gold;
      return Math.abs(h.y - waist) > 0.6 ? shade(C.belt) : C.belt;
    }
    if (h.nz > 0.2 && Math.abs(h.x + (h.y - (19.5 - b)) * 0.78) < 0.75 && h.y > waist) return Math.abs(h.x + (h.y - (19.5 - b)) * 0.78) > 0.5 ? shade(C.belt) : C.belt;
    // Mail at the collar, where the jerkin opens.
    if (h.y > 24.2 - b) return mail(h);
    // The lacing: a dark slit, crossed by pale laces every so often.
    if (h.nz > 0.6 && Math.abs(h.x) < 0.35 && h.y > waist) return (h.y * 1.4) % 1.4 < 0.45 ? C.lace : C.seam;
    if (h.nz > 0.6 && Math.abs(h.x) < 0.9 && h.y > waist && (h.y * 1.4) % 1.4 < 0.3) return C.lace;
    // Seams down the sides, where front panel meets back.
    if (Math.abs(Math.abs(h.nx) - 0.84) < 0.07) return C.seam;
    return C.leather;
  };
  // Two leather tassets over the mail at the front of the hips.
  if (!sit) {
    for (const side of [-1, 1]) {
      solids.push({ cx: side * 2.3, cy: 12.6 - b * 0.5, cz: 2.4 + s * 0.2, rx: 2.1, ry: 2, rz: 1.1, material: (h) => (h.y < 11.2 - b * 0.5 ? C.seam : C.leather) });
    }
  }
  solids.push({ cx: 0, cy: 14.4 - b * (sit ? 1 : 0.5), cz: 0, rx: 4.5, ry: 2.6, rz: 3.4, material: jerkin });
  solids.push({ cx: 0, cy: 18.2 - b, cz: 0.1, rx: 4.5, ry: 3.4, rz: 3.4, material: jerkin });
  solids.push({ cx: 0, cy: 22.2 - b, cz: 0.2, rx: 5, ry: 4.3, rz: 3.6, material: jerkin });

  // The shield across her back: a round of planks, painted in quarters, with an iron rim and boss.
  const sy = 19.4 - b;
  const sz = -4.3;
  const shield = (h: Hit): Tones => {
    const dx = h.x;
    const dy = h.y - sy;
    const r = Math.hypot(dx, dy);
    if (r > 4.25) return C.rim;
    if (h.z > sz + 0.1) return C.wood;
    const quarter = (dx > 0) !== (dy > 0);
    const plank = Math.floor((dx + 10) / 1.5) % 2 === 0;
    const paint = quarter ? C.red : C.bone;
    return plank ? paint : [paint[0], paint[1], paint[0]];
  };
  // In a fight the shield comes off her back onto her left arm, and the sword out of its scabbard.
  if (!fight) {
    solids.push({ cx: 0, cy: sy, cz: sz, rx: 4.9, ry: 4.9, rz: 0.75, material: shield });
    solids.push({ cx: 0, cy: sy, cz: sz - 0.7, rx: 1.3, ry: 1.3, rz: 0.7, material: C.steel });
  }
  let arms: FightArm[] | undefined;
  if (fight) {
    const main = weaponArm(fight, 'blade');
    arms = [main, offArm(fight, 'blade', true, main)];
  }

  // Arms: mail sleeves to the elbow, leather bracers, dark gloves; leather pauldrons at the shoulders.
  for (const side of [-1, 1]) {
    const swing = sit ? 0 : -s * side * 2;
    const fa = arms?.[side === -1 ? 0 : 1];
    const shoulder: V3 = fa ? fa.shoulder : [side * 5.2, 24 - b, 0.2];
    const elbow: V3 = fa ? fa.elbow : sit ? [side * 5.6, 19.6 - b, 2] : [side * 6, 20.2 - b, 0.3 + swing * 0.5];
    const wrist: V3 = fa ? fa.wrist : sit ? [side * 3.6, 12.6, 4.6] : [side * 6.2, 16.8 - b, 0.8 + swing];
    const hand: V3 = fa ? fa.hand : [wrist[0], wrist[1] - 1.1, wrist[2] + 0.3];
    solids.push(...limb(shoulder, elbow, 1.8, 1.6, mail));
    const forearm = limb(elbow, wrist, 1.6, 1.5, mail);
    forearm.forEach((f, i) => solids.push(i > forearm.length * 0.3 ? { ...f, rx: 1.75, ry: 1.75, rz: 1.75, material: i > forearm.length * 0.85 ? C.seam : C.leather } : f));
    solids.push({ cx: hand[0], cy: hand[1], cz: hand[2], rx: 1.5, ry: 1.5, rz: 1.6, material: C.glove });
    if (fa && side === -1) solids.push(...swordSolids(fa.hand, fa.aim, C));
    if (fa && side === 1) solids.push(...armShield(elbow, wrist, shield, C));
    // The pauldron: a rounded leather cap with a darker edge and two rivets.
    solids.push({
      cx: side * 4.9, cy: 24.8 - b, cz: 0.2, rx: 2.9, ry: 1.9, rz: 2.9,
      material: (h) => (h.y < 24.8 - b - 0.9 ? C.seam : C.leather),
    });
    for (const [dz, dy] of [[1.1, 0.4], [-1.1, 0.4]]) details.push({ x: side * 6.6, y: 24.8 - b + dy, z: 0.2 + dz, color: P.goldLight, size: 0.5 });
  }

  // The sword at her left hip: a dark scabbard angled back, with a steel chape,
  // and the hilt forward: a wrapped grip, crossguard and gold pommel.
  if (!sit) {
    const mouth: V3 = [4.9, waist - 0.6, 1.2];
    // (Swung further back when she's crouched to fight, so it clears the ground.)
    const tip: V3 = fight ? [6.3, 6.4, -5.6] : [6.1, 3.6, -3.4];
    solids.push(...limb(mouth, tip, 0.75, 0.6, C.belt, 0.5));
    solids.push({ cx: tip[0], cy: tip[1] + 0.3, cz: tip[2] + 0.2, rx: 0.75, ry: 0.9, rz: 0.75, material: C.steel });
    solids.push({ cx: mouth[0], cy: mouth[1] + 0.3, cz: mouth[2] + 0.2, rx: 0.5, ry: 0.4, rz: 1.8, material: C.steel });
  }
  if (!sit && !fight) {
    const mouth: V3 = [4.9, waist - 0.6, 1.2];
    solids.push(...limb([mouth[0], mouth[1] + 0.6, mouth[2] + 0.4], [mouth[0] - 0.3, mouth[1] + 2.6, mouth[2] + 1.5], 0.5, 0.45, C.glove, 0.5));
    solids.push({ cx: mouth[0] - 0.35, cy: mouth[1] + 3, cz: mouth[2] + 1.7, rx: 0.7, ry: 0.7, rz: 0.7, material: C.gold });
  }

  // Head: fair hair parted and swept back over the ears into a long braid.
  const hy = 32.4 - b;
  const hz = 0.4;
  solids.push({ cx: 0, cy: 27 - b, cz: 0.3, rx: 2, ry: 2, rz: 2, material: C.skin });
  const strands = (h: Hit): Tones => ((Math.floor(h.x * 1.6 + h.z * 0.4 + h.y * 0.3) & 1) === 0 ? C.hair : C.hairDark);
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    // A side parting, the fringe swept to her left.
    if (py > 2.1 - Math.max(0, h.x) * 0.25) return strands(h);
    if (h.nz < -0.15 || (Math.abs(h.nx) > 0.7 && py > -2.6)) return strands(h);
    return C.skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 5.1, ry: 5.6, rz: 5, material: head, soft: true });
  solids.push({ cx: 0, cy: hy + 0.1, cz: hz + 5, rx: 0.85, ry: 1.1, rz: 0.85, material: C.skin });
  // A fuller crown of hair, so the head isn't a bare egg.
  solids.push({ cx: 0, cy: hy + 2.3, cz: hz - 0.9, rx: 5.4, ry: 3.8, rz: 5.2, material: strands });
  // The braid, from the back of the head down between her shoulders, over the shield, tied with leather.
  const knots = 7;
  for (let i = 0; i < knots; i++) {
    const t = i / (knots - 1);
    const r = 1.35 - t * 0.35;
    // Off the back of the head, then lying flat against the shield.
    // (In a fight, with the shield off her back, it lies on her shoulders.)
    const z = fight ? hz - 4.6 - t * 0.2 : Math.min(hz - 4.6 - t * 3, sz - 1.1);
    solids.push({ cx: i % 2 ? 0.25 : -0.25, cy: hy - 2 - t * 10.5, cz: z, rx: r, ry: r * 1.05, rz: r, material: i % 2 ? C.hair : C.hairDark });
  }
  const tie = fight ? hz - 4.8 : sz - 1.3;
  solids.push({ cx: 0, cy: hy - 13.3, cz: tie, rx: 0.8, ry: 0.5, rz: 0.8, material: C.seam });
  solids.push({ cx: 0, cy: hy - 14.3, cz: tie, rx: 0.75, ry: 0.9, rz: 0.7, material: C.hair });

  details.push(...fineFace(hy, hz, {
    eye: P.eye,
    iris: 0x5a8aaa,
    brow: darker(C.hair[1]),
    browSlant: 0.5,
    browLift: 1.9,
    mouth: 0xa86a5c,
    lashes: P.eye,
    scar: 0xd89a88,
  }, { rx: 5.1, ry: 5.6, rz: 5 }));
  if (fight) return bendUpper({ solids, details }, legsEnd, fight);
  return { solids, details };
}

/**
 * Sigrun's sword out of its scabbard, from the hand along `aim`: a gold
 * pommel, a dark wrapped grip through the fist, a steel crossguard, and a
 * long, bright blade with a fuller, tapering to the point. The blade is turned
 * half to the front, so it shows its width from every side.
 */
function swordSolids(hand: V3, aim: V3, C: typeof SIGRUN): Solid[] {
  const [side, fore] = squareTo(aim);
  const w = vec.norm(vec.add(side, fore));
  const flat = vec.norm([w[1] * aim[2] - w[2] * aim[1], w[2] * aim[0] - w[0] * aim[2], w[0] * aim[1] - w[1] * aim[0]]);
  const guard = vec.add(hand, vec.mul(aim, 2));
  const at = (p: V3) => ({ cx: p[0], cy: p[1], cz: p[2] });
  const LENGTH = 14;
  const bright: Tones = [0xd4dae2, 0x8e96a2, 0xffffff];
  const blade = (h: Hit): Tones => {
    const p: V3 = [h.x - guard[0], h.y - guard[1], h.z - guard[2]];
    return Math.abs(vec.dot(p, w)) < 0.35 && vec.dot(p, aim) < LENGTH * 0.72 ? C.steel : bright;
  };
  const out: Solid[] = [
    { ...at(vec.add(hand, vec.mul(aim, -3))), rx: 1, ry: 1, rz: 1, material: C.gold },
    ...limb(vec.add(hand, vec.mul(aim, -2.4)), guard, 0.65, 0.65, C.glove, 0.3),
    ...limb(vec.add(guard, vec.mul(w, -3)), vec.add(guard, vec.mul(w, 3)), 0.6, 0.6, C.steel, 0.3),
  ];
  for (let t = 0.6; t <= LENGTH - 1; t += 0.5) {
    const u = t / LENGTH;
    const half = u < 0.72 ? 1.35 - u * 0.25 : 1.17 * (1 - (u - 0.72) / 0.3);
    out.push({ ...at(vec.add(guard, vec.mul(aim, t))), rx: Math.max(0.3, half), ry: 1.1, rz: 0.55, axes: [w, aim, flat], material: blade, soft: true });
  }
  // The fist closed round the grip, over it.
  out.push({ ...at(hand), rx: 1.55, ry: 1.5, rz: 1.65, material: C.glove });
  return out;
}

/**
 * Her round shield on her left forearm, carried forward and turned a little
 * out: the same planks, paint, rim and boss as when it's slung on her back.
 */
function armShield(elbow: V3, wrist: V3, paint: (h: Hit) => Tones, C: typeof SIGRUN): Solid[] {
  const out = vec.norm([0.55, 0, 1]);
  const mid = vec.lerp(elbow, wrist, 0.55);
  const c = vec.add(mid, vec.mul(out, 1.7));
  let up: V3 = [0, 1, 0];
  up = vec.norm(vec.sub(up, vec.mul(out, vec.dot(up, out))));
  const across: V3 = [up[1] * out[2] - up[2] * out[1], up[2] * out[0] - up[0] * out[2], up[0] * out[1] - up[1] * out[0]];
  // Paint it as though it were on her back: the face's own coordinates, as x and y about the middle.
  const face = (h: Hit): Tones => {
    const p: V3 = [h.x - c[0], h.y - c[1], h.z - c[2]];
    const n: V3 = [h.nx, h.ny, h.nz];
    return paint({ x: vec.dot(p, across), y: 19.4 + vec.dot(p, up), z: vec.dot(n, out) > 0 ? -4.3 : -4, nx: 0, ny: 0, nz: -1 });
  };
  const boss = vec.add(c, vec.mul(out, 0.7));
  return [
    { cx: c[0], cy: c[1], cz: c[2], rx: 4.7, ry: 4.7, rz: 0.75, axes: [across, up, out], material: face },
    { cx: boss[0], cy: boss[1], cz: boss[2], rx: 1.3, ry: 1.3, rz: 0.7, axes: [across, up, out], material: C.steel },
  ];
}

// ---------------------------------------------------------------------------
// Wat
// ---------------------------------------------------------------------------

const WAT = {
  tabard: [0x2e4a7a, 0x1e3256, 0x40629a] as Tones,
  trim: [P.gold, 0xb08830, P.goldLight] as Tones,
  gambeson: [0xaaa48e, 0x7e7a68, 0xc6c0a8] as Tones,
  quilt: [0x8a8470, 0x625e50, 0xa6a08a] as Tones,
  helm: [P.ironLight, P.iron, P.stoneLight] as Tones,
  hose: [0x4a3c34, 0x30261f, 0x62524a] as Tones,
  wrap: [0x9a8a6c, 0x6e6250, 0xb4a484] as Tones,
  boot: [P.leatherDark, P.barkDark, P.leather] as Tones,
  belt: [0x4a3424, 0x30221a, 0x644a34] as Tones,
  skin: [0xf2c8a0, 0xcf9e7a, 0xffdcba] as Tones,
  hair: [0x7a5a3a, 0x54402a, 0x96744e] as Tones,
  shaft: [P.bark, P.barkDark, P.barkLight] as Tones,
  steel: [0xb8bcc6, 0x7a7e8a, 0xe4e8f0] as Tones,
  pennon: [0x2e4a7a, 0x1e3256, 0x5a7ab4] as Tones,
};

/**
 * Wat, the youngest of the militia: no mail yet, but a quilted gambeson under
 * the militia's blue tabard (edged in gold, the badge on his chest), a kettle
 * helm a size too big with its chin strap, hose with puttees wound to the
 * knee, a belt with a pouch and knife, and his spear with a little blue
 * pennon under the blade. A freckled, eager face.
 */
export function watModel(pose: Pose3D): Model {
  const C = WAT;
  const b = pose.bob;
  const s = pose.stride;
  const sit = !!pose.sit;
  const solids: Solid[] = [];
  const details: Detail[] = [];
  const waist = 15.6 - b * (sit ? 1 : 0.5);
  const fight = sit ? undefined : pose.fight;

  // Legs: hose, with puttees wound from ankle to knee, and short boots.
  const wrap = (h: Hit): Tones => (Math.floor(h.y * 1.5 + h.x * 0.35 + h.z * 0.35) % 2 === 0 ? C.wrap : shade(C.wrap));
  if (fight) {
    for (const leg of fightLegs(fight)) {
      solids.push(...limb(leg.hip, leg.knee, 1.75, 1.62, C.hose), ...limb(leg.knee, leg.ankle, 1.62, 1.5, C.hose));
      for (const [a, z] of legFrom(leg, 8.2)) solids.push(...limb(a, z, 1.7, 1.62, wrap));
      solids.push({ cx: leg.ankle[0], cy: leg.ankle[1] + 0.1, cz: leg.ankle[2], rx: 1.75, ry: 0.9, rz: 1.75, material: C.boot });
      solids.push({ cx: leg.foot[0], cy: leg.foot[1], cz: leg.foot[2], rx: 1.5, ry: 1, rz: 2.25, material: C.boot });
    }
  } else if (sit) {
    solids.push(...seatedLegs(2.2, C.hose, C.boot, 1.75));
    for (const side of [-1, 1]) solids.push(...limb([side * 2.2, 8.4, 5.7], [side * 2.2, 3.6, 5.8], 1.75, 1.65, wrap));
  } else {
    for (const side of [-1, 1]) {
      const leg = standingLeg(side, side * 2.2, b, s);
      solids.push(...limb(leg.hip, leg.ankle, 1.75, 1.5, C.hose));
      solids.push(...limb(leg.at(8.2), leg.at(4.4), 1.7, 1.62, wrap));
      const cuff = leg.at(3.6);
      solids.push({ cx: cuff[0], cy: cuff[1], cz: cuff[2], rx: 1.75, ry: 0.9, rz: 1.75, material: C.boot });
      solids.push({ cx: leg.foot[0], cy: leg.foot[1], cz: leg.foot[2], rx: 1.5, ry: 1, rz: 2.25, material: C.boot });
    }
  }

  // Everything from here up is the upper body, which a fighting stance leans and turns as one.
  const legsEnd = solids.length;

  // The gambeson's skirt below the tabard, quilted in rows.
  const quilted = (h: Hit): Tones => ((h.y * 1.25) % 1.25 < 0.28 || (Math.abs(h.nx) < 0.5 && (h.x * 0.9 + 20) % 1.8 < 0.3) ? C.quilt : C.gambeson);
  if (!sit) {
    for (let y = 9.5; y <= 13.5; y += 0.5) solids.push({ cx: 0, cy: y - b * 0.5, cz: s * 0.2, rx: 4.7 + (13.5 - y) * 0.12, ry: 0.8, rz: 3.6, material: y < 10 ? shade(C.gambeson) : quilted });
  } else {
    solids.push({ cx: 0, cy: 10.8, cz: 2, rx: 4.8, ry: 1.2, rz: 4.4, material: quilted });
  }

  // The tabard: front and back panels to mid-thigh, open at the sides to show the
  // gambeson; a gold hem, the belt over it with a pouch and a knife.
  const body = (h: Hit): Tones => {
    if (Math.abs(h.y - waist) < 0.6) {
      if (h.nz > 0.85 && Math.abs(h.x) < 0.7) return C.trim;
      return Math.abs(h.y - waist) > 0.35 ? shade(C.belt) : C.belt;
    }
    if (Math.abs(h.nx) > 0.88) return quilted(h);
    if (Math.abs(Math.abs(h.nx) - 0.85) < 0.035) return C.trim;
    if (h.y > 24.4 - b && h.nz > -0.2) return quilted(h);
    return C.tabard;
  };
  if (!sit) {
    for (let y = 10.5; y <= 14; y += 0.5) {
      solids.push({
        cx: 0, cy: y - b * 0.5, cz: s * 0.3 * (14 - y) / 3.5, rx: 4.6, ry: 0.8, rz: 3.85,
        material: (h) => (Math.abs(h.nx) > 0.84 ? quilted(h) : y < 11.2 ? C.trim : C.tabard),
      });
    }
  }
  solids.push({ cx: 0, cy: 14.6 - b * (sit ? 1 : 0.5), cz: 0, rx: 4.6, ry: 2.6, rz: 3.5, material: body });
  solids.push({ cx: 0, cy: 18 - b, cz: 0, rx: 4.6, ry: 3.4, rz: 3.5, material: body });
  solids.push({ cx: 0, cy: 22.2 - b, cz: 0.1, rx: 5.1, ry: 4.4, rz: 3.7, material: body });
  // A quilted collar standing up round the neck.
  solids.push({ cx: 0, cy: 25.8 - b, cz: 0.2, rx: 3, ry: 1.1, rz: 2.9, material: quilted });
  // The pouch on his right hip, and the knife on his left.
  solids.push({ cx: -3.6, cy: waist - 1.5, cz: 2.4, rx: 1.3, ry: 1.3, rz: 0.8, material: (h) => (h.y > waist - 1 ? shade(C.belt) : C.belt) });
  if (!sit) solids.push(...limb([3.9, waist - 0.4, 2.3], [4.3, waist - 3.6, 2.1], 0.55, 0.4, C.belt, 0.5));
  solids.push({ cx: 3.9, cy: waist + 0.6, cz: 2.4, rx: 0.45, ry: 0.9, rz: 0.45, material: C.shaft });

  // Arms in quilted sleeves; his right hand (screen-left, facing us) holds the spear.
  // In a fight he holds it in both hands, levelled (see fight3d.ts).
  let spearHand: V3 = [0, 0, 0];
  let arms: FightArm[] | undefined;
  if (fight) {
    const main = weaponArm(fight, 'pole');
    arms = [main, offArm(fight, 'pole', false, main)];
  }
  for (const side of [-1, 1]) {
    const holding = side === -1;
    const swing = sit || holding ? 0 : -s * side * 2;
    const fa = arms?.[side === -1 ? 0 : 1];
    const shoulder: V3 = fa ? fa.shoulder : [side * 5.2, 24 - b, 0.1];
    const elbow: V3 = fa ? fa.elbow : sit ? [side * 5.6, 19.6 - b, 2] : holding ? [side * 6.4, 20.4 - b, 0.8] : [side * 6, 20.2 - b, 0.3 + swing * 0.5];
    // (His hand hangs 0.9 below where the forearm ends.)
    const hand: V3 = fa ? [fa.hand[0], fa.hand[1] + 0.9, fa.hand[2] - 0.2] : sit ? (holding ? [side * 5.6, 15, 3.6] : [side * 3.6, 12.4, 4.6]) : holding ? [side * 7.2, 19.2 - b, 1.8] : [side * 6.2, 16.8 - b, 0.8 + swing];
    solids.push({ cx: side * 4.9, cy: 24.6 - b, cz: 0.1, rx: 2.5, ry: 2.3, rz: 2.5, material: quilted });
    solids.push(...limb(shoulder, elbow, 1.85, 1.65, quilted));
    const forearm = limb(elbow, hand, 1.65, 1.5, quilted);
    // A turned-back cuff at the wrist.
    forearm.forEach((f, i) => solids.push(i === forearm.length - 1 ? { ...f, rx: 1.7, ry: 1.7, rz: 1.7, material: C.quilt } : f));
    solids.push({ cx: hand[0], cy: hand[1] - 0.9, cz: hand[2] + 0.2, rx: 1.45, ry: 1.5, rz: 1.5, material: C.skin });
    if (holding) spearHand = [hand[0], hand[1] - 0.9, hand[2] + 0.2];
  }

  // The spear: an ash shaft, butt on the ground (or leant on his knee, seated), a socketed
  // leaf blade lashed on, and a blue pennon fluttering under it.
  const [px, , pz] = spearHand;
  const top = (sit ? 40 : 43.6) - b;
  const butt: V3 = sit ? [px, 0.6, pz + 1.4] : [px, 0.6, pz - s * 0.6];
  const grain = (h: Hit): Tones => ((h.y * 2.2) % 3 < 0.3 ? shade(C.shaft) : C.shaft);
  if (arms) {
    // Levelled: the same spear, laid along the line his hands give it.
    const d = arms[0].aim;
    const at = (t: number): V3 => vec.add(spearHand, vec.mul(d, t));
    const [across, flat] = squareTo(d);
    const head = at(20.4);
    solids.push(
      ...[
        ...limb(at(-11), at(17.4), 0.6, 0.55, C.shaft, 0.4),
        ...limb(at(16.2), at(17.4), 0.75, 0.75, C.belt, 0.4),
        ...limb(at(17.2), at(18.4), 0.6, 0.6, C.steel, 0.4),
        { cx: head[0], cy: head[1], cz: head[2], rx: 0.95, ry: 1.6, rz: 0.4, axes: [across, d, flat], material: C.steel } as Solid,
        ...limb(at(21.4), at(22.6), 0.6, 0.2, C.steel, 0.3),
      ].map((p) => ({ ...p, soft: true })),
    );
    // The pennon trailing back from under the blade.
    const pen = vec.add(at(15.2), vec.mul(flat, 1.1));
    const pen2 = vec.add(at(13.6), vec.mul(flat, 1.5));
    solids.push({ cx: pen[0], cy: pen[1], cz: pen[2], rx: 0.22, ry: 1.4, rz: 0.85, axes: [across, d, flat], material: C.pennon });
    solids.push({ cx: pen2[0], cy: pen2[1], cz: pen2[2], rx: 0.2, ry: 0.8, rz: 0.5, axes: [across, d, flat], material: C.pennon });
  }
  const spear: Solid[] = arms ? [] : [
    ...limb(butt, [px, top - 3.6, pz], 0.6, 0.55, grain, 0.4),
    // The lashing where the socket meets the shaft.
    ...limb([px, top - 4.8, pz], [px, top - 3.6, pz], 0.75, 0.75, C.belt, 0.4),
    // The socket and the leaf blade, widest a third of the way up.
    ...limb([px, top - 3.8, pz], [px, top - 2.6, pz], 0.6, 0.6, C.steel, 0.4),
    { cx: px, cy: top - 1.3, cz: pz, rx: 0.95, ry: 1.6, rz: 0.4, material: C.steel },
    ...limb([px, top - 0.6, pz], [px, top + 0.6, pz], 0.6, 0.2, C.steel, 0.3),
  ];
  solids.push(...spear.map((p) => ({ ...p, soft: true })));
  const wave = pose.flutter ?? 0;
  if (!arms) solids.push({ cx: px + 1.4 + wave * 0.15, cy: top - 5.6, cz: pz - wave * 0.4, rx: 1.4, ry: 0.85, rz: 0.22, material: C.pennon });
  if (!arms) solids.push({ cx: px + 2.8 + wave * 0.3, cy: top - 5.9 + wave * 0.15, cz: pz - wave * 0.8, rx: 0.8, ry: 0.5, rz: 0.2, material: C.pennon });

  // Head: mousy hair sticking out under a kettle helm a size too big, with a chin strap.
  const hy = 32.2 - b;
  const hz = 0.4;
  solids.push({ cx: 0, cy: 27 - b, cz: 0.3, rx: 2, ry: 2, rz: 2, material: C.skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    // The chin strap, down in front of each ear and under the jaw.
    if (Math.abs(Math.abs(h.nx) - 0.8) < 0.08 && py < 1.6 && h.nz > -0.2) return C.belt;
    if (h.nz < -0.25 || (Math.abs(h.nx) > 0.86 && py > -1.2)) return (Math.floor(h.y * 1.8 + h.x) & 1) === 0 ? C.hair : shade(C.hair);
    return C.skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 5.2, ry: 5.6, rz: 5, material: head, soft: true });
  solids.push({ cx: 0, cy: hy + 0.1, cz: hz + 5, rx: 0.85, ry: 1, rz: 0.85, material: C.skin });
  for (const side of [-1, 1]) solids.push({ cx: side * 5.1, cy: hy + 0.2, cz: hz + 0.3, rx: 0.7, ry: 1.2, rz: 0.9, material: C.skin });
  // Tufts of hair poking out under the brim at the back and over the brow.
  for (const [x, z] of [[-2.8, -3.6], [0, -4.4], [2.8, -3.6], [-4.3, -1.2], [4.3, -1.2]]) solids.push({ cx: x, cy: hy + 2.6, cz: hz + z, rx: 1.1, ry: 0.9, rz: 1, material: C.hair });
  solids.push({ cx: 1, cy: hy + 2.9, cz: hz + 3.9, rx: 2.2, ry: 0.8, rz: 1, material: C.hair });
  // The helm: a wide brim (a darker band at its edge) round a crown with a ridge along it.
  const brim = (h: Hit): Tones => (Math.hypot(h.x, (h.z - hz) * (8.2 / 7.8)) > 7.4 ? shade(C.helm) : C.helm);
  solids.push({ cx: 0, cy: hy + 4, cz: hz - 0.2, rx: 8.2, ry: 0.85, rz: 7.8, material: brim });
  solids.push({ cx: 0, cy: hy + 4.8, cz: hz - 0.3, rx: 5.6, ry: 4, rz: 5.5, material: (h) => (Math.abs(h.x) < 0.45 ? [C.helm[2], C.helm[0], C.helm[2]] : C.helm) });
  // Rivets round the crown's foot.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    details.push({ x: Math.sin(a) * 5.5, y: hy + 5, z: hz - 0.3 + Math.cos(a) * 5.4, color: P.stoneLight, size: 0.5 });
  }

  // The militia's gold badge on his chest, finely: a ring round a boss.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    details.push({ x: Math.sin(a) * 1.1, y: 22.4 - b + Math.cos(a) * 1.1, z: 3.95, color: P.gold, size: 0.5 });
  }
  details.push({ x: 0, y: 22.4 - b, z: 4, color: P.goldLight, size: 0.5 });

  details.push(...fineFace(hy, hz, {
    eye: P.eye,
    iris: 0x6a7a4a,
    brow: darker(C.hair[0]),
    browSlant: -0.35,
    browLift: 2.2,
    mouth: 0xb0705c,
    mouthWidth: 3,
    smile: true,
    freckles: 0xd8a080,
  }, { rx: 5.2, ry: 5.6, rz: 5 }));
  if (fight) return bendUpper({ solids, details }, legsEnd, fight);
  return { solids, details };
}

/** Folk drawn finely (see FINE_SPEC), by id: their sheets are 'folk-<id>' like everyone else's. */
export const FINE_FOLK: Record<string, (pose: Pose3D) => Model> = {
  sigrun: sigrunModel,
  wat: watModel,
  // The goblins who stand about as folk rather than fight (see goblins3d.ts).
  snikkit: captiveGoblinModel,
  shaman: shamanGoblinModel,
  // The jetty's folk: Maren the skipper, Old Hob and Wren.
  ...JETTY_FOLK,
  // Adowvale's militia, each his own man, with Sergeant Brannock and Hamm the jailer (see militia3d.ts).
  ...MILITIA_FOLK,
};
