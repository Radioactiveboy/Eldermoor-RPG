import Phaser from 'phaser';
import type { Tones } from './character';
import { darker, HERO_SCALE } from './character';
import { bendUpper, FightArm, fightLegs, fightSpec, generateFightFrames, offArm, redrawFightFrames, weaponArm } from './fight3d';
import { Detail, generateFigure3D, Hit, limb, Model, personSpec, Pose3D, redrawFigure3D, Solid } from './figure3d';
import type { GearLook } from './gear';
import { seatedLegs } from './models3d';
import { PALETTE as P } from './palette';

/**
 * Arthus, the hero, modelled in 3D (see figure3d.ts) like the folk in
 * models3d.ts: a hooded wanderer in a forest-green cloak over a leather vest,
 * a linen shirt and dark trousers, barefoot until he puts his boots on. What
 * he wears and carries is layered on by gear.ts, which can change him first
 * (a hat pushes the hood back, a staff closes his right hand round it).
 */

/** The parts of the hero that gear can change. */
export interface HeroLook {
  /** The cloak's hood up over the head, or pushed back on the shoulders. */
  hoodUp: boolean;
  /** The right hand closed round something carried upright (a staff), rather than swinging. */
  holding: boolean;
  /** The hood's cloth, if it isn't the cloak's own green (a wool hood worn up instead). */
  hood?: Tones;
  /**
   * The right forearm brought forward at the waist, the fist closed round a
   * hilt held ready in front of him (a sword), rather than swinging.
   */
  wielding?: boolean;
  /** The left forearm raised a little across the body, carrying a shield, rather than swinging. */
  shield: boolean;
}

/** One arm or leg in a pose: where its joints are (body space). */
export interface HeroLimb {
  /** Arms: -1 the figure's right (screen-left facing us), 1 the left. Legs likewise. */
  side: number;
  /** Arms: shoulder, elbow, wrist, and the centre of the hand. */
  top: [number, number, number];
  mid: [number, number, number];
  end: [number, number, number];
}

export interface HeroLeg {
  side: number;
  /** The top of the thigh, the knee (seated) or ankle, and the centre of the foot. */
  hip: [number, number, number];
  knee: [number, number, number];
  ankle: [number, number, number];
  foot: [number, number, number];
}

/** Where the hero is in one pose, for gear to put itself in the right place (body space, as figure3d.ts). */
export interface HeroFrame {
  pose: Pose3D;
  look: HeroLook;
  /** Centre of the head. */
  hy: number;
  hz: number;
  /** Centre of the right hand (the figure's right: screen-left facing us). */
  hand: [number, number, number];
  /** Centre of the left hand. */
  offHand: [number, number, number];
  /** Both arms (shoulder, elbow, wrist), right first. */
  arms: HeroLimb[];
  /** Both legs, right first. */
  legs: HeroLeg[];
  /** Units the upper body sinks in this pose (pose.bob). */
  b: number;
  /** In a fight (see fight3d.ts), which way what's in the right hand points, as the swing has it. */
  aim?: [number, number, number];
}

/** The hero's own boots, for gear that puts them back on (see gear.ts). */
export const HERO_BOOTS: Tones = [P.leather, P.leatherDark, P.leatherLight];

const CLOAK: Tones = [P.cloak, P.cloakDark, P.cloakLight];
const VEST: Tones = [P.leather, P.leatherDark, P.leatherLight];
const BELT: Tones = [P.leatherDark, darker(P.leatherDark), P.leather];
const SHIRT: Tones = [P.linen, P.linenDark, 0xf0e4c4];
const TROUSER: Tones = [P.trouser, P.trouserDark, 0x56485a];
const SKIN: Tones = [P.skin, P.skinShade, 0xffdcb6];
const HAIR: Tones = [P.hair, darker(P.hair), 0x8a5030];
/** The vest's seams and turned hem: a shade darker than the leather. */
const SEAM: Tones = [P.leatherDark, darker(P.leatherDark), P.leather];
/** The cloak's edge: a turned hem a shade darker, so its outline reads against the body. */
const CLOAK_HEM: Tones = [P.cloakDark, darker(P.cloakDark), P.cloak];

/** The hero in one pose, wearing (and carrying) `gear`. */
export function heroModel(pose: Pose3D, gear: GearLook[] = []): Model {
  const look = gear.reduce<HeroLook>((l, g) => (g.adjust ? g.adjust(l) : l), { hoodUp: true, holding: false, shield: false });
  const b = pose.bob;
  const s = pose.stride;
  const sit = !!pose.sit;
  const flutter = pose.flutter ?? 0;
  const fight = sit ? undefined : pose.fight;
  const solids: Solid[] = [];

  // Legs: dark trousers to the ankle, and bare feet (gear.ts puts boots on them).
  const legs: HeroLeg[] = [];
  if (fight) {
    // Squared up to fight, knees bent (see fight3d.ts).
    for (const l of fightLegs(fight)) {
      solids.push(...limb(l.hip, l.knee, 1.9, 1.75, TROUSER));
      solids.push(...limb(l.knee, [l.ankle[0], l.ankle[1] - 0.2, l.ankle[2]], 1.75, 1.6, TROUSER));
      solids.push({ cx: l.foot[0], cy: l.foot[1] - 0.2, cz: l.foot[2], rx: 1.45, ry: 1, rz: 2.2, material: SKIN });
      legs.push({ side: l.side, hip: l.hip, knee: l.knee, ankle: l.ankle, foot: l.foot });
    }
  } else if (sit) {
    solids.push(...seatedLegs(2.2, TROUSER, SKIN, 1.9).map((p) => (p.material === SKIN ? { ...p, rx: 1.45, ry: 1, rz: 2.2, cy: 1 } : p)));
    for (const side of [-1, 1]) {
      const x = side * 2.2;
      legs.push({ side, hip: [x, 10, -0.5], knee: [x, 10.2, 5.4], ankle: [x, 3.4, 5.8], foot: [x, 1.3, 6.6] });
    }
  } else {
    for (const side of [-1, 1]) {
      const swing = s * side;
      const lift = swing < 0 ? 0.9 : 0;
      const x = side * 2.2;
      const hip: [number, number, number] = [x, 12.5 - b * 0.5, 0];
      const ankle: [number, number, number] = [x, 3.6 + lift, swing * 2.3];
      const foot: [number, number, number] = [x, 1.3 + lift, 0.8 + swing * 2.3];
      solids.push(...limb(hip, [x, 3.4 + lift, swing * 2.3], 1.9, 1.6, TROUSER));
      solids.push({ cx: x, cy: 1 + lift, cz: 0.9 + swing * 2.3, rx: 1.45, ry: 1, rz: 2.2, material: SKIN });
      legs.push({ side, hip, knee: [x, 8 + lift * 0.5, swing * 1.2], ankle, foot });
    }
  }

  // Everything from here up is the upper body, which a fighting stance leans and turns as one.
  const legsEnd = solids.length;

  // The vest's skirt to the hip, over the trousers, and the belt with its gold buckle.
  const vest = (h: Hit): Tones => {
    if (Math.abs(h.y - (15.4 - b)) < 0.6) return BELT;
    // A stitched seam down each side, where the front panel meets the back.
    if (Math.abs(Math.abs(h.nx) - 0.82) < 0.07 && h.y > 15.4 - b) return SEAM;
    // The linen shirt showing in a V at the collar.
    if (h.nz > 0.5 && Math.abs(h.x) < (h.y - (22 - b)) * 0.5) return SHIRT;
    return VEST;
  };
  // The skirt's hem is turned and stitched, a darker band along its foot.
  if (!sit) for (let y = 11.5; y <= 14.5; y += 0.5) solids.push({ cx: 0, cy: y - b * 0.5, cz: s * 0.2, rx: 4.6 + (14.5 - y) * 0.12, ry: 0.8, rz: 3.5, material: y < 12 ? SEAM : VEST });
  else solids.push({ cx: 0, cy: 11.2, cz: 1.6, rx: 4.6, ry: 1.3, rz: 4, material: VEST });
  solids.push({ cx: 0, cy: 14.4 - b * (sit ? 1 : 0.5), cz: 0, rx: 4.5, ry: 2.6, rz: 3.4, material: vest });
  solids.push({ cx: 0, cy: 18.2 - b, cz: 0.1, rx: 4.6, ry: 3.4, rz: 3.5, material: vest });
  solids.push({ cx: 0, cy: 22.2 - b, cz: 0.2, rx: 5, ry: 4.3, rz: 3.6, material: vest });

  // Linen sleeves with a leather bracer at the wrist. The right hand holds whatever's carried.
  let hand: [number, number, number] = [-6.2, 16.6 - b, 1];
  let offHand: [number, number, number] = [6.2, 16.6 - b, 1];
  const arms: HeroLimb[] = [];
  // In a fight, the arms go where the swing puts them (see fight3d.ts).
  let fightArms: FightArm[] | undefined;
  if (fight) {
    const grip = look.holding ? 'pole' : 'blade';
    const main = weaponArm(fight, grip);
    fightArms = [main, offArm(fight, grip, look.shield, main)];
  }
  for (const side of [-1, 1]) {
    const fa = fightArms?.[side === -1 ? 0 : 1];
    if (fa) {
      solids.push({ cx: side * 4.7, cy: 24.4, cz: 0.2, rx: 2.3, ry: 2.2, rz: 2.3, material: SHIRT });
      solids.push(...limb(fa.shoulder, fa.elbow, 1.8, 1.6, SHIRT));
      const forearm = limb(fa.elbow, fa.wrist, 1.6, 1.5, SHIRT);
      forearm.forEach((f, i) => solids.push(i > forearm.length * 0.6 ? { ...f, rx: 1.7, ry: 1.7, rz: 1.7, material: VEST } : f));
      solids.push({ cx: fa.hand[0], cy: fa.hand[1], cz: fa.hand[2], rx: 1.5, ry: 1.5, rz: 1.6, material: SKIN });
      if (side === -1) hand = fa.hand;
      else offHand = fa.hand;
      arms.push({ side, top: fa.shoulder, mid: fa.elbow, end: fa.wrist });
      continue;
    }
    const holding = look.holding && side === -1;
    const shield = look.shield && side === 1;
    const wielding = !!look.wielding && side === -1;
    const swing = sit || holding || shield || wielding ? 0 : -s * side * 2;
    // The sword arm gives a little with each step rather than swinging.
    const give = wielding ? s * 0.3 : 0;
    solids.push({ cx: side * 4.7, cy: 24.4 - b, cz: 0.2, rx: 2.3, ry: 2.2, rz: 2.3, material: SHIRT });
    const elbow: [number, number, number] = sit
      ? [side * 5.6, 19.6 - b, 2]
      : wielding ? [side * 6.7, 19.9 - b, -0.2]
        : holding ? [side * 5.9, 20.4 - b, 1] : shield ? [side * 6.3, 20.2 - b, 0.6] : [side * 6, 20.2 - b, 0.3 + swing * 0.5];
    const wrist: [number, number, number] = sit
      ? wielding ? [side * 6.4, 15.4, 4.4] : holding ? [side * 5.4, 14.4, 4] : [side * 3.6, 12.4, 4.6]
      : wielding ? [side * 7.6, 18.9 - b, 2.7 + give]
        : holding ? [side * 6.6, 18.4 - b, 2.6] : shield ? [side * 5.2, 17.6 - b, 3.6] : [side * 6.2, 17.2 - b, 0.8 + swing];
    solids.push(...limb([side * 5.2, 24 - b, 0.2], elbow, 1.8, 1.6, SHIRT));
    const forearm = limb(elbow, wrist, 1.6, 1.5, SHIRT);
    // The bracer: the last third of the forearm in leather.
    forearm.forEach((f, i) => solids.push(i > forearm.length * 0.6 ? { ...f, rx: 1.7, ry: 1.7, rz: 1.7, material: VEST } : f));
    // The hand hangs below the wrist, or carries on forward from a forearm held out.
    const h: [number, number, number] = wielding && !sit ? [wrist[0], wrist[1] - 0.1, wrist[2] + 1.2] : [wrist[0], wrist[1] - 1.1, wrist[2] + 0.3];
    solids.push({ cx: h[0], cy: h[1], cz: h[2], rx: 1.5, ry: 1.5, rz: 1.6, material: SKIN });
    if (side === -1) hand = h;
    else offHand = h;
    arms.push({ side, top: [side * 5.2, 24 - b, 0.2], mid: elbow, end: wrist });
  }

  // The cloak: over the shoulders and down the back, its hem streaming back as he walks.
  const cloakPaint = (h: Hit): Tones => {
    // Folds running down the back.
    if (h.nz < -0.4 && Math.floor((h.x + 40) / 2.2 + h.y * 0.06) % 2 === 0) return [CLOAK[0], CLOAK[1], CLOAK[0]];
    return CLOAK;
  };
  const neck = 25.2 - b;
  const hem = sit ? 10.5 : 7.5;
  for (let y = hem; y <= neck; y += 0.5) {
    const t = (neck - y) / (neck - 7.5);
    const back = sit ? 0 : t * t * flutter * 1.3;
    solids.push({
      cx: 0, cy: y - (sit ? 0 : b * (1 - t)), cz: -2.7 - t * 0.9 - back,
      rx: 5.5 + t * 1.9, ry: 0.8, rz: 1.5 + t * 0.5, material: y < hem + 0.6 ? CLOAK_HEM : cloakPaint,
    });
  }
  // Seated, the cloak's hem pools on the seat behind.
  if (sit) solids.push({ cx: 0, cy: 10, cz: -2.6, rx: 6.6, ry: 1.2, rz: 2.8, material: cloakPaint });
  // Across the shoulders, just over the tops of the sleeves.
  for (const side of [-1, 1]) solids.push({ cx: side * 3.4, cy: 25 - b, cz: -0.8, rx: 3.6, ry: 2, rz: 3.2, material: CLOAK });

  // Head: brown hair, the fringe showing under the hood.
  const hy = 32 - b;
  const hz = 0.4;
  solids.push({ cx: 0, cy: 27 - b, cz: 0.3, rx: 2.1, ry: 2, rz: 2.1, material: SKIN });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (py > 1.8) return HAIR;
    if (h.nz < -0.2 || (Math.abs(h.nx) > 0.72 && py > -1.8)) return HAIR;
    return SKIN;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 5.3, ry: 5.7, rz: 5.1, material: head, soft: true });
  solids.push({ cx: 0, cy: hy + 0.1, cz: hz + 5.1, rx: 0.9, ry: 1.1, rz: 0.9, material: SKIN });

  if (look.hoodUp) {
    // A deep hood round the face, its point falling at the back of the head.
    const hood = look.hood ?? CLOAK;
    // The rim catches the light a little more than the hood behind it.
    const rim: Tones = [hood[0], hood[0], hood[2]];
    solids.push({ cx: 0, cy: hy + 0.9, cz: hz - 2.2, rx: 6.3, ry: 6.6, rz: 6, material: hood });
    solids.push({ cx: 0, cy: hy + 5, cz: hz - 4.6, rx: 2.4, ry: 2.4, rz: 2.2, material: hood });
    solids.push(...limb([0, hy + 4.8, hz - 5.6], [0, hy + 5.4, hz - 7.2], 1.3, 0.6, hood, 0.4));
    // Its rim framing the face, kept inside the hood's outline so it stays smooth.
    for (let i = 0; i <= 20; i++) {
      const a = -Math.PI * 0.62 + (i / 20) * Math.PI * 1.24;
      solids.push({ cx: Math.sin(a) * 4.6, cy: hy + 0.4 + Math.cos(a) * 4.7, cz: hz + 2.4 - (1 - Math.cos(a)) * 1.2, rx: 1.6, ry: 1.6, rz: 1.8, material: rim });
    }
    // The hood's shadow across the brow.
    solids.push({ cx: 0, cy: hy + 2.6, cz: hz + 3.9, rx: 3.4, ry: 1.1, rz: 1, material: [hood[1], darker(hood[1]), hood[1]] });
  } else {
    // The hood pushed back, bunched in folds behind the neck.
    solids.push({ cx: 0, cy: 26.8 - b, cz: -2.8, rx: 4.8, ry: 2.4, rz: 2.6, material: CLOAK });
    solids.push({ cx: 0, cy: 25 - b, cz: -4, rx: 3.2, ry: 2.6, rz: 1.6, material: cloakPaint });
  }

  const details: Detail[] = [];
  // The face, drawn finely (see HERO_SCALE): eyes a pixel wide and two tall at
  // the folk's size, brows over them, and a mouth.
  const onFace = (x: number, dy: number) => hz + 5.1 * Math.sqrt(Math.max(0, 1 - (x / 5.3) ** 2 - (dy / 5.7) ** 2)) + 0.1;
  const mark = (x: number, dy: number, color: number) => details.push({ x, y: hy + dy, z: onFace(x, dy), color, size: 0.5 });
  for (const side of [-1, 1]) {
    const ex = side * 1.9;
    mark(ex, 1.1, P.eye);
    mark(ex, 0.6, P.eye);
    mark(ex - side * 0.5, 1.1, 0xf4ead8);
    for (const dx of [-0.5, 0, 0.5]) mark(ex + dx * side, 2 + dx * side * 0.3, darker(P.hair));
  }
  mark(-0.25, -2.1, P.skinShade);
  mark(0.25, -2.1, P.skinShade);
  // The gold clasp at the throat, and the belt buckle.
  details.push({ x: 0, y: 25.6 - b, z: 3.4, color: P.gold });
  details.push({ x: 0.6, y: 15.4 - b * (sit ? 1 : 0.5), z: 3.5, color: P.gold });
  details.push({ x: 1.4, y: 15.4 - b * (sit ? 1 : 0.5), z: 3.4, color: P.goldLight });

  const frame: HeroFrame = { pose, look, hy, hz, hand, offHand, arms, legs, b, aim: fightArms?.[0].aim };
  // Footwear stays on the legs when the stance turns the upper body.
  const onLegs = new Set<number>();
  for (const g of gear) {
    const extra = g.model(frame);
    if (fight && extra.solids.length > 0 && Math.max(...extra.solids.map((x) => x.cy)) < 11) extra.solids.forEach((_, i) => onLegs.add(solids.length + i));
    solids.push(...extra.solids);
    details.push(...(extra.details ?? []));
  }
  if (fight) return bendUpper({ solids, details }, legsEnd, fight, (_, i) => onLegs.has(i));
  return { solids, details };
}

/** The hero's frame: HERO_SCALE times finer than the folk's (see character.ts). */
export const HERO_SPEC = personSpec(HERO_SCALE, { creases: true });

/** The hero's fight frames: bigger, for the swing to fit (see fight3d.ts). */
export const HERO_FIGHT_SPEC = fightSpec(HERO_SCALE);

/** Draws the hero's sheet as 'player' (8 directions; idle, walk, sit and work animations). */
export function generateHero(scene: Phaser.Scene): void {
  generateFigure3D(scene, 'player', (pose) => heroModel(pose), HERO_SPEC);
}

/** Draws the hero's fight frames as 'player@fight', and the 'player-ready-<dir>', '-attack-', '-hit-', '-guard-' and '-down-' animations. */
export function generateHeroFight(scene: Phaser.Scene, gear: GearLook[] = []): void {
  generateFightFrames(scene, 'player', (pose) => heroModel(pose, gear), HERO_FIGHT_SPEC);
}

/** Repaints the hero in new gear, in place, wherever they're showing (the fight frames a little after). */
export function redrawHero(scene: Phaser.Scene, gear: GearLook[]): void {
  redrawFigure3D(scene, 'player', (pose) => heroModel(pose, gear), HERO_SPEC);
  redrawFightFrames(scene, 'player', (pose) => heroModel(pose, gear), HERO_FIGHT_SPEC);
}
