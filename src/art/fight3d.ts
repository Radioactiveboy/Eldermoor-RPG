import Phaser from 'phaser';
import { DIRECTIONS_8, FrameSpec, Hit, Material, Model, Pose3D, renderFrame, Solid } from './figure3d';
import { PixelCanvas } from './PixelCanvas';

/**
 * How the hero and the companions fight (see hero3d.ts and companions3d.ts),
 * like the goblins do (see goblins3d.ts): squared up in a fighting stance,
 * bobbing on their toes, winding up, swinging and following through, reeling
 * when struck, raising a guard, and down on one knee when knocked off their feet.
 *
 * A figure's fight frames are drawn on a sheet of their own ('<key>@fight'),
 * bigger than their walking frames, so a sword swung back over the shoulder or
 * thrust out at arm's length stays in the frame. A model draws a fight frame
 * when its pose has `fight` set: its legs in the stance from {@link fightLegs},
 * its arms from {@link weaponArm} and {@link offArm}, and then everything above
 * the legs leant, turned and lowered as one by {@link bendUpper}.
 */

type V3 = [number, number, number];

/** One moment of a fight, as a figure stands for it. */
export type FightAct = 'ready' | 'ready2' | 'windup' | 'strike' | 'follow' | 'reel' | 'recover' | 'guard' | 'kneel';

/** The fight sheet's columns, in order. */
export const FIGHT_FRAME: Record<FightAct, number> = {
  ready: 0,
  ready2: 1,
  windup: 2,
  strike: 3,
  follow: 4,
  reel: 5,
  recover: 6,
  guard: 7,
  kneel: 8,
};

const ACTS = Object.keys(FIGHT_FRAME) as FightAct[];
export const FIGHT_COLS = ACTS.length;

/** The poses the fight sheet is drawn in, column by column. */
export const FIGHT_POSES: Pose3D[] = ACTS.map((fight) => ({ stride: 0, bob: 0, fight }));

/**
 * How the body above the legs is carried for each act, turned about the hips:
 * `lean` forward (radians; back if negative), `twist` (radians; positive brings
 * the right shoulder, screen-left facing us, forward), and `drop`, how far the
 * hips sink as the knees bend.
 */
export interface Stance {
  lean: number;
  twist: number;
  drop: number;
}

export const STANCES: Record<FightAct, Stance> = {
  // Side-on, left shoulder to the foe, knees bent.
  ready: { lean: 0.1, twist: -0.28, drop: 1 },
  ready2: { lean: 0.14, twist: -0.24, drop: 1.6 },
  // Turned right away, the weapon drawn back over the shoulder.
  windup: { lean: -0.08, twist: -0.62, drop: 0.7 },
  // Stepping into the blow, the right shoulder driving through.
  strike: { lean: 0.3, twist: 0.32, drop: 1.9 },
  follow: { lean: 0.36, twist: 0.45, drop: 2.3 },
  // Rocked back on the heels.
  reel: { lean: -0.32, twist: -0.12, drop: 0.4 },
  recover: { lean: 0.22, twist: -0.2, drop: 2.1 },
  guard: { lean: 0.04, twist: -0.38, drop: 1.7 },
  // Down on the right knee.
  kneel: { lean: 0.26, twist: -0.12, drop: 6 },
};

/** Where the hips turn: the top of the legs. */
export const HIP_Y = 12.5;

/** A fight frame as shown: wider and taller than the folk's 32 by 48, with the ground lower down it. */
const SHOWN = { w: 60, h: 60, feetY: 55 };

/** The fight frame drawn `scale` times as finely (the hero's and the companions' are drawn twice as finely). */
export function fightSpec(scale: number): FrameSpec {
  return { w: SHOWN.w * scale, h: SHOWN.h * scale, feetY: (SHOWN.feetY + 0.5) * scale - 0.5, scale, creases: true };
}

/** The sprite's origin (down the frame) that puts the feet on the spot, for a fight frame. */
export const FIGHT_ORIGIN_Y = (SHOWN.feetY + 0.5) / SHOWN.h;

/** A frame `f` held for `ms` milliseconds. */
const held = (f: FightAct, ms: number) => ({ f: FIGHT_FRAME[f], ms });

/**
 * The fight animations, by name: '<key>-<name>-<dir>'. The loops repeat (-1);
 * the rest play once and hold their last frame.
 */
export const FIGHT_ANIMS: Record<string, { frames: Array<{ f: number; ms: number }>; repeat: number }> = {
  ready: { frames: [held('ready', 340), held('ready2', 300), held('ready', 320), held('ready2', 280)], repeat: -1 },
  attack: { frames: [held('windup', 170), held('strike', 110), held('follow', 320)], repeat: 0 },
  hit: { frames: [held('reel', 130), held('recover', 230)], repeat: 0 },
  guard: { frames: [held('recover', 90), held('guard', 1)], repeat: 0 },
  down: { frames: [held('reel', 120), held('recover', 120), held('kneel', 1)], repeat: 0 },
};

/** How long the attack animation takes to bring the weapon back before the blow, in ms. */
export const WINDUP_MS = FIGHT_ANIMS.attack.frames[0].ms;

// ---------------------------------------------------------------- vectors

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const lerp = (a: V3, b: V3, t: number): V3 => add(a, mul(sub(b, a), t));

/**
 * A two-part limb from `from` towards `to` (a shoulder to a hand, a hip to an
 * ankle), `l1` then `l2` long, its joint bending out towards `pole`. Returns the
 * joint and where the end actually reaches (short of `to` if it's out of reach).
 */
export function bend(from: V3, to: V3, l1: number, l2: number, pole: V3): { mid: V3; end: V3 } {
  const reach = l1 + l2 - 0.05;
  let d = sub(to, from);
  let dist = len(d);
  if (dist > reach) {
    d = mul(d, reach / dist);
    dist = reach;
  }
  const end = add(from, d);
  const u = norm(d);
  const along = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  let p = sub(pole, mul(u, dot(pole, u)));
  if (len(p) < 1e-6) p = [0, 0, 1];
  return { mid: add(add(from, mul(u, along)), mul(norm(p), h)), end };
}

// ---------------------------------------------------------------- legs

/** One leg in a fight: the top of the thigh, the knee, the ankle and the middle of the foot. */
export interface FightLeg {
  side: number;
  hip: V3;
  knee: V3;
  ankle: V3;
  foot: V3;
  /** The point on the leg at height `y` (on the shin below the knee, the thigh above it). */
  at: (y: number) => V3;
}

/**
 * Both legs in the stance for `act`, right first: feet apart, the left foot
 * forward, knees bent to the hips' drop; stepping into a blow, the front foot
 * goes further forward; kneeling, the right knee is on the ground and the shin
 * lies back along it. `width` is how far apart the hips are.
 */
export function fightLegs(act: FightAct, width = 2.2): FightLeg[] {
  const { drop } = STANCES[act];
  const lunge = act === 'strike' || act === 'follow';
  const out: FightLeg[] = [];
  for (const side of [-1, 1]) {
    const x = side * width;
    const hip: V3 = [x, HIP_Y - drop, 0];
    let knee: V3;
    let ankle: V3;
    let foot: V3;
    if (act === 'kneel' && side === -1) {
      knee = [x - 0.2, 1.5, -0.4];
      ankle = [x - 0.2, 1.7, -4.3];
      foot = [x - 0.2, 1.1, -5.3];
    } else {
      const front = side === 1;
      const z = front ? (act === 'kneel' ? 4.4 : lunge ? 4.4 : act === 'reel' ? 1.4 : 2.8) : lunge ? -3.1 : -2.6;
      const ax = x + side * (act === 'kneel' ? 0.2 : 0.5);
      ankle = [ax, 3.5, z];
      foot = [ax, 1.2, z + 0.9];
      knee = bend(hip, ankle, 4.5, 4.45, [side * 0.25, 0.2, 1]).mid;
      // A leg straight out (rocked back) still reaches the ground.
      if (len(sub(ankle, hip)) > 8.9) ankle = bend(hip, ankle, 4.5, 4.45, [0, 0, 1]).end;
    }
    const at = (y: number): V3 => {
      const t = (v: number) => Math.min(1, Math.max(0, v));
      if (y >= knee[1]) return hip[1] > knee[1] + 0.01 ? lerp(knee, hip, t((y - knee[1]) / (hip[1] - knee[1]))) : knee;
      return knee[1] > ankle[1] + 0.01 ? lerp(ankle, knee, t((y - ankle[1]) / (knee[1] - ankle[1]))) : ankle;
    };
    out.push({ side, hip, knee, ankle, foot, at });
  }
  return out;
}

// ---------------------------------------------------------------- arms

/** How a weapon is held: a blade or club in one hand, or a spear or staff in both. */
export type Grip = 'blade' | 'pole';

/** An arm in a fight: shoulder, elbow, wrist, and the centre of the hand; and, for the weapon arm, which way the weapon points. */
export interface FightArm {
  side: number;
  shoulder: V3;
  elbow: V3;
  wrist: V3;
  hand: V3;
  aim: V3;
}

/** Where the weapon hand goes for each act, and which way the weapon points from it (body space, before the stance turns it). */
const BLADE: Record<FightAct, { hand: V3; aim: V3 }> = {
  ready: { hand: [-6, 19.4, 4.4], aim: norm([-0.12, 0.8, 0.58]) },
  ready2: { hand: [-6, 19, 4.6], aim: norm([-0.1, 0.78, 0.62]) },
  windup: { hand: [-6.3, 29, -1.6], aim: norm([0.3, 0.4, -0.86]) },
  strike: { hand: [-2.6, 23.2, 7.6], aim: norm([0.22, 0.08, 1]) },
  follow: { hand: [-2.4, 18.4, 5.6], aim: norm([0.62, -0.5, 0.6]) },
  reel: { hand: [-8.6, 22.4, -1.4], aim: norm([-0.45, 0.8, -0.3]) },
  recover: { hand: [-6, 18.6, 4.4], aim: norm([-0.1, 0.72, 0.68]) },
  guard: { hand: [-5, 23.6, 5], aim: norm([0.9, 0.38, 0.2]) },
  kneel: { hand: [-6.2, 18, 4.6], aim: norm([0.05, -0.3, 0.95]) },
};

/** A spear or staff: levelled at the foe, drawn back, thrust, raised, held across to block, and leant on. */
const POLE: Record<FightAct, { hand: V3; aim: V3 }> = {
  ready: { hand: [-4.6, 17.4, 1.2], aim: norm([0.28, 0.32, 1]) },
  ready2: { hand: [-4.6, 17, 1.2], aim: norm([0.28, 0.28, 1]) },
  windup: { hand: [-5, 18.6, -3.2], aim: norm([0.22, 0.24, 1]) },
  strike: { hand: [-3, 19.4, 5.4], aim: norm([0.14, 0.26, 1]) },
  follow: { hand: [-2.8, 17.6, 4.6], aim: norm([0.18, 0.2, 1]) },
  reel: { hand: [-6.6, 20.4, -0.8], aim: norm([0.12, 0.92, 0.36]) },
  recover: { hand: [-4.6, 17, 1.6], aim: norm([0.28, 0.26, 1]) },
  guard: { hand: [-4.6, 21.4, 2.4], aim: norm([1, 0.32, 0.14]) },
  kneel: { hand: [-5.2, 16.4, 2.6], aim: norm([0.04, 0.95, 0.3]) },
};

/** The upper arm's and forearm's length (shoulder to elbow, elbow to wrist), and the wrist to the middle of the hand. */
const UPPER = 4;
const FORE = 3.3;
const HAND = 1.1;

/** An arm from its shoulder to a hand at `hand`, the elbow bending out towards `pole`. */
function armTo(side: number, shoulder: V3, hand: V3, pole: V3, aim: V3): FightArm {
  // The wrist sits a little back from the hand's middle, along the line from the shoulder.
  const back = norm(sub(hand, shoulder));
  const { mid: elbow, end: wrist } = bend(shoulder, sub(hand, mul(back, HAND)), UPPER, FORE, pole);
  return { side, shoulder, elbow, wrist, hand: add(wrist, mul(back, HAND)), aim };
}

/** The weapon arm (the right, screen-left facing us) for `act`, from a shoulder at `shoulder`. */
export function weaponArm(act: FightAct, grip: Grip, shoulder: V3 = [-5.2, 24, 0.2]): FightArm {
  const { hand, aim } = (grip === 'pole' ? POLE : BLADE)[act];
  // The elbow out and down, or up and out when the weapon's drawn back high.
  const pole: V3 = act === 'windup' && grip === 'blade' ? [-1, 0.6, -0.4] : [-1, -0.7, -0.2];
  return armTo(-1, shoulder, hand, pole, aim);
}

/**
 * The other arm (the left): a shield carried forward (raised high on guard), a
 * fist up, or a hand further up a spear's shaft; flung back for balance in a
 * swing and out when struck; resting on the knee when kneeling.
 */
export function offArm(act: FightAct, grip: Grip, shield: boolean, main: FightArm, shoulder: V3 = [5.2, 24, 0.2]): FightArm {
  const pole: V3 = [1, -0.7, -0.2];
  if (grip === 'pole' && !shield && act !== 'reel') {
    // Both hands on the shaft, the left further up it.
    return armTo(1, shoulder, add(main.hand, mul(main.aim, act === 'guard' ? 7.5 : 5.6)), pole, main.aim);
  }
  const at: Record<FightAct, V3> = shield
    ? {
        ready: [4.2, 19.6, 5.4], ready2: [4.2, 19.2, 5.4], windup: [3.8, 20.6, 6], strike: [6.4, 18.6, 2.4], follow: [6.8, 18.2, 1.2],
        reel: [8.2, 21.6, -0.4], recover: [4.2, 19, 5.2], guard: [3, 22.4, 6.2], kneel: [4.6, 17.6, 5.2],
      }
    : {
        ready: [3.6, 20.4, 5], ready2: [3.6, 20, 5], windup: [3.6, 21.4, 6.2], strike: [7, 17.6, -3], follow: [7.2, 18.6, -3.4],
        reel: [9, 22.6, -1.4], recover: [3.8, 19.8, 4.8], guard: [3.2, 22.2, 5.4], kneel: [4.4, 14.2, 4.8],
      };
  return armTo(1, shoulder, at[act], pole, [0, 0, 1]);
}

// ---------------------------------------------------------------- the stance

/** Turns `v` by the stance: twisted about the up axis, then leant about the side-to-side one. */
function turn(v: V3, s: Stance): V3 {
  const ct = Math.cos(s.twist);
  const st = Math.sin(s.twist);
  // Positive twist brings the figure's right (x < 0) forward.
  const x1 = v[0] * ct + v[2] * st;
  const z1 = -v[0] * st + v[2] * ct;
  const cl = Math.cos(s.lean);
  const sl = Math.sin(s.lean);
  // Positive lean brings what's above the hips forward.
  return [x1, v[1] * cl - z1 * sl, v[1] * sl + z1 * cl];
}

/** The reverse of {@link turn}. */
function unturn(v: V3, s: Stance): V3 {
  const cl = Math.cos(s.lean);
  const sl = Math.sin(s.lean);
  const y1 = v[1] * cl + v[2] * sl;
  const z1 = -v[1] * sl + v[2] * cl;
  const ct = Math.cos(s.twist);
  const st = Math.sin(s.twist);
  return [v[0] * ct - z1 * st, y1, v[0] * st + z1 * ct];
}

/** A point of the upper body (as modelled, standing straight) where the stance puts it. */
export function placeUpper(p: V3, act: FightAct): V3 {
  const s = STANCES[act];
  const q = turn([p[0], p[1] - HIP_Y, p[2]], s);
  return [q[0], q[1] + HIP_Y - s.drop, q[2]];
}

/**
 * Leans, turns and lowers everything in `model` but its first `keep` solids
 * (the legs) as one, about the hips, for the stance of `act`. Each solid keeps
 * its shape and its paint (a material is looked up where the point was before
 * it moved). Marks above the knees move with it.
 */
export function bendUpper(model: Model, keep: number, act: FightAct, legwear: (s: Solid, i: number) => boolean = () => false): Model {
  const s = STANCES[act];
  const back = (h: Hit): Hit => {
    const p = unturn([h.x, h.y - HIP_Y + s.drop, h.z], s);
    const n = unturn([h.nx, h.ny, h.nz], s);
    return { x: p[0], y: p[1] + HIP_Y, z: p[2], nx: n[0], ny: n[1], nz: n[2] };
  };
  const axesOf = (sol: Solid): Solid['axes'] => {
    const [ax, ay, az] = sol.axes ?? [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    return [turn(ax, s), turn(ay, s), turn(az, s)];
  };
  const moved = (sol: Solid): Solid => {
    const c = placeUpper([sol.cx, sol.cy, sol.cz], act);
    const m = sol.material;
    const material: Material = typeof m === 'function' ? (h: Hit) => m(back(h)) : m;
    return { ...sol, cx: c[0], cy: c[1], cz: c[2], axes: axesOf(sol), material };
  };
  return {
    solids: model.solids.map((sol, i) => (i < keep || legwear(sol, i) ? sol : moved(sol))),
    details: model.details.map((d) => {
      if (d.y < 9) return d;
      const p = placeUpper([d.x, d.y, d.z], act);
      return { ...d, x: p[0], y: p[1], z: p[2] };
    }),
  };
}

// ---------------------------------------------------------------- the sheets

/** Draws the given rows (directions) of a figure's fight frames into `sheet` (columns = {@link FIGHT_FRAME}). */
function paintRows(sheet: PixelCanvas, build: (pose: Pose3D) => Model, spec: FrameSpec, rows: number[]): void {
  for (const row of rows) {
    const d = DIRECTIONS_8[row];
    FIGHT_POSES.forEach((pose, col) => {
      const frame = renderFrame(build(pose), d.angle, spec);
      frame.outline();
      sheet.blit(frame, col * spec.w, row * spec.h);
    });
  }
}

/** The whole fight sheet, for tests and previews. */
export function drawFightSheet(build: (pose: Pose3D) => Model, spec: FrameSpec): PixelCanvas {
  const sheet = new PixelCanvas(spec.w * FIGHT_COLS, spec.h * DIRECTIONS_8.length);
  paintRows(sheet, build, spec, DIRECTIONS_8.map((_, i) => i));
  return sheet;
}

/** The texture a figure's fight frames are on. */
export const fightKey = (key: string) => `${key}@fight`;

/**
 * Draws a figure's fight frames as '<key>@fight' and makes its animations,
 * '<key>-<name>-<dir>' for each of {@link FIGHT_ANIMS} in all eight directions.
 */
export function generateFightFrames(scene: Phaser.Scene, key: string, build: (pose: Pose3D) => Model, spec: FrameSpec): void {
  const tex = drawFightSheet(build, spec).toTexture(scene, fightKey(key));
  let i = 0;
  for (let row = 0; row < DIRECTIONS_8.length; row++) {
    for (let col = 0; col < FIGHT_COLS; col++) tex.add(i++, 0, col * spec.w, row * spec.h, spec.w, spec.h);
  }
  DIRECTIONS_8.forEach((d, row) => {
    for (const [name, anim] of Object.entries(FIGHT_ANIMS)) {
      const k = `${key}-${name}-${d.name}`;
      if (scene.anims.exists(k)) scene.anims.remove(k);
      scene.anims.create({
        key: k,
        frames: anim.frames.map(({ f, ms }) => ({ key: fightKey(key), frame: row * FIGHT_COLS + f, duration: ms })),
        frameRate: 1000,
        repeat: anim.repeat,
      });
    }
  });
}

/**
 * Fight frames to be repainted (the hero changed clothes): a row at a time
 * between the game's frames, so changing gear doesn't stall, or all at once
 * when a fight is about to start (see {@link finishFightFrames}).
 */
const repaints = new Map<string, { build: (pose: Pose3D) => Model; spec: FrameSpec; rows: number[]; scene: Phaser.Scene }>();

/** Repaints a figure's fight frames from a new model, in place, a row at a time. */
export function redrawFightFrames(scene: Phaser.Scene, key: string, build: (pose: Pose3D) => Model, spec: FrameSpec): void {
  if (!scene.textures.exists(fightKey(key))) return;
  const fresh = !repaints.size;
  repaints.set(key, { build, spec, rows: DIRECTIONS_8.map((_, i) => i), scene });
  if (!fresh) return;
  const step = () => {
    const next = repaints.entries().next();
    if (next.done) {
      scene.game.events.off(Phaser.Core.Events.STEP, step);
      return;
    }
    const [k, job] = next.value;
    repaintRows(k, job, [job.rows.shift()!]);
    if (job.rows.length === 0) repaints.delete(k);
  };
  scene.game.events.on(Phaser.Core.Events.STEP, step);
}

function repaintRows(key: string, job: { build: (pose: Pose3D) => Model; spec: FrameSpec; scene: Phaser.Scene }, rows: number[]): void {
  const tex = job.scene.textures.get(fightKey(key)) as Phaser.Textures.CanvasTexture;
  const { spec } = job;
  for (const row of rows) {
    const strip = new PixelCanvas(spec.w * FIGHT_COLS, spec.h);
    const d = DIRECTIONS_8[row];
    FIGHT_POSES.forEach((pose, col) => {
      const frame = renderFrame(job.build(pose), d.angle, spec);
      frame.outline();
      strip.blit(frame, col * spec.w, 0);
    });
    tex.context.putImageData(strip.toImageData(), 0, row * spec.h);
  }
  tex.refresh();
}

/** Finishes any repaint still under way, at once (a fight is starting). */
export function finishFightFrames(): void {
  for (const [key, job] of repaints) {
    repaintRows(key, job, job.rows);
    job.rows = [];
  }
  repaints.clear();
}

/** The stretches of a leg from height `y` down to the ankle (over the knee, if it's below `y`), for boots and puttees. */
export function legFrom(l: FightLeg, y: number): Array<[V3, V3]> {
  const top = l.at(y);
  return y > l.knee[1] && l.hip[1] > l.knee[1] ? [[top, l.knee], [l.knee, l.ankle]] : [[top, l.ankle]];
}

/** Two directions square to `d` and to each other, the first as near the body's left-right as it can be. */
export function squareTo(d: V3): [V3, V3] {
  const k = d[0];
  let side = [1 - k * d[0], -k * d[1], -k * d[2]] as V3;
  if (len(side) < 1e-3) side = [0, 0, 1];
  side = norm(side);
  const other: V3 = [side[1] * d[2] - side[2] * d[1], side[2] * d[0] - side[0] * d[2], side[0] * d[1] - side[1] * d[0]];
  return [side, norm(other)];
}

export const vec = { add, sub, mul, dot, norm, lerp, len };
