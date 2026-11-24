import Phaser from 'phaser';
import { darker, FEET_Y, FRAME_H, FRAME_W, IDLE_FRAME_RATE, Tones } from './character';
import type { FightAct } from './fight3d';
import { PixelCanvas } from './PixelCanvas';

/**
 * Figures modelled in 3D and drawn as pixel art. A figure is a handful of
 * rounded solids (ellipsoids) in its own body space, which is turned to face
 * each of 8 directions, looked at from a little above, and lit by a light from
 * the upper left. Each pixel's light is snapped to its colour's few tones, so
 * the result is still crisp pixel art but shades like a solid body as it turns.
 * Unlike the flat-part figures in character.ts, the west-facing directions are
 * drawn rather than mirrored, so the light stays on the same side.
 *
 * Body space: x to screen-right when the figure faces us, y up from the
 * ground, z forward (the way the figure faces). One unit is one pixel.
 */

/** Where on a solid a pixel is: the point in body space, and the surface normal (in body space). */
export interface Hit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

/** A solid's colour at a point: three tones (base, shade, light) to be lit. */
export type Material = Tones | ((hit: Hit) => Tones);

export interface Solid {
  /** Centre and radii, in body space. */
  cx: number;
  cy: number;
  cz: number;
  rx: number;
  ry: number;
  rz: number;
  material: Material;
  /** Lit more evenly, so shadow doesn't muddy it (a face). */
  soft?: boolean;
  /**
   * Turned: the three directions (unit length, square to one another, in body
   * space) that rx, ry and rz run along, for something flat that doesn't lie
   * along the body's own axes (a sword's blade). Left out, they're x, y and z.
   */
  axes?: [[number, number, number], [number, number, number], [number, number, number]];
}

/** A small mark painted on top where it can be seen (eyes, buttons), in body space. */
export interface Detail {
  x: number;
  y: number;
  z: number;
  color: number;
  /** Across, in body units (1 if left out): a finely drawn figure can take marks smaller than a pixel of the folk's. */
  size?: number;
}

export interface Model {
  solids: Solid[];
  details: Detail[];
}

export interface Pose3D {
  /** -1..1 leg swing: positive puts the figure's right leg forward. */
  stride: number;
  /** Units the upper body sinks (breathing, the walk's contact frames, or sitting down). */
  bob: number;
  /** Seated on a stool or bench: thighs forward, shins down, the body lowered by `bob`. */
  sit?: boolean;
  /** 0..2: how far a cloak's hem streams back as the figure walks. */
  flutter?: number;
  /**
   * 0..1 through a working stroke, for the few who are drawn at their trade
   * (the smith's hammer coming down, the baker's hands pushing the dough):
   * 0 at the top of the stroke, 1 at the bottom.
   */
  work?: number;
  /** A moment of a fight, for the figures who fight (see fight3d.ts): drawn in a fighting stance rather than standing. */
  fight?: FightAct;
}

/** Drawn directions, in sheet-row order: angle in degrees, 0 facing the viewer, 90 facing screen-right. */
export const DIRECTIONS_8 = [
  { name: 's', angle: 0 },
  { name: 'se', angle: 45 },
  { name: 'e', angle: 90 },
  { name: 'ne', angle: 135 },
  { name: 'n', angle: 180 },
  { name: 'nw', angle: 225 },
  { name: 'w', angle: 270 },
  { name: 'sw', angle: 315 },
] as const;

const IDLE: Pose3D[] = [
  { stride: 0, bob: 0 },
  { stride: 0, bob: 0 },
  { stride: 0, bob: 0.7 },
  { stride: 0, bob: 0.7 },
];
const WALK: Pose3D[] = [
  { stride: 1, bob: 0.8, flutter: 1 },
  { stride: 0, bob: 0, flutter: 2 },
  { stride: -1, bob: 0.8, flutter: 1 },
  { stride: 0, bob: 0, flutter: 2 },
];
/** Same columns as character.ts's sheets (4 idle, 4 walk, 2 sit), so animations line up. */
const SIT: Pose3D[] = [
  { stride: 0, bob: 3.5, sit: true },
  { stride: 0, bob: 4.2, sit: true },
];
const POSES = [...IDLE, ...WALK, ...SIT];

/** How far the view looks down on the figure. */
const PITCH = (16 * Math.PI) / 180;
/** The light: from the upper left and a little in front (world space, z towards the viewer). */
const LIGHT = normalize(-0.7, 0.6, 0.38);

/** Ellipsoids along a line from a to b, radius r0 to r1: a limb. */
export function limb(
  a: [number, number, number], b: [number, number, number], r0: number, r1: number, material: Material, step = 0.5,
): Solid[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(1, Math.ceil(len / step));
  const out: Solid[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = r0 + (r1 - r0) * t;
    out.push({ cx: a[0] + (b[0] - a[0]) * t, cy: a[1] + (b[1] - a[1]) * t, cz: a[2] + (b[2] - a[2]) * t, rx: r, ry: r, rz: r, material });
  }
  return out;
}

/** A frame's size, and the pixel row the ground (body-space y = 0, z = 0) falls on. */
export interface FrameSpec {
  w: number;
  h: number;
  /** The ground falls on the middle of this pixel row (it may be a half row, for a scaled frame). */
  feetY: number;
  /** Body-space height under which the light falls off towards the ground. */
  groundShade?: number;
  /**
   * Draw a dark line inside the figure wherever one part stands well in front
   * of another (an arm across the body, the head over the shoulders), so the
   * parts read apart at small sizes.
   */
  creases?: boolean;
  /**
   * Pixels per body-space unit (1 if left out). At 2 the figure is drawn with
   * twice the detail in a frame twice as big, to be shown at half size (the
   * hero, see hero3d.ts): the model and its materials don't change.
   */
  scale?: number;
}

/** The folk's frame (see character.ts). */
const PERSON: FrameSpec = { w: FRAME_W, h: FRAME_H, feetY: FEET_Y };

/** The folk's frame drawn `scale` times as finely: the ground on the same spot once shown at 1 / scale. */
export function personSpec(scale: number, extra: Partial<FrameSpec> = {}): FrameSpec {
  return { w: FRAME_W * scale, h: FRAME_H * scale, feetY: (FEET_Y + 0.5) * scale - 0.5, scale, ...extra };
}
/** How far in front of the frame the rays start, in body units: further than any solid reaches. */
const NEAR = 120;

/**
 * Renders one frame: casts a ray through each pixel into the turned model,
 * finds the nearest solid, lights it and snaps the light to the colour's tones.
 *
 * Each solid only tests the pixels its outline can cover (a box round its
 * widest radius), keeping the nearest hit per pixel, and only the winning hit
 * is lit and painted: the cost goes with the solids' area rather than the
 * frame's, which matters for the finely drawn hero.
 */
export function renderFrame(model: Model, angleDeg: number, spec: FrameSpec = PERSON): PixelCanvas {
  const { w: W, h: H, feetY } = spec;
  const k = spec.scale ?? 1;
  const ground = spec.groundShade ?? 4;
  const c = new PixelCanvas(W, H);
  const a = (angleDeg * Math.PI) / 180;
  const cosA = Math.cos(a);
  const sinA = Math.sin(a);
  const cosP = Math.cos(PITCH);
  const sinP = Math.sin(PITCH);
  // The view runs into the screen and down; screen-up is tilted back to match.
  const dir: Vec3 = [0, -sinP, -cosP];
  const up: Vec3 = [0, cosP, -sinP];
  const toBody = (v: Vec3): Vec3 => [v[0] * cosA - v[2] * sinA, v[1], v[0] * sinA + v[2] * cosA];
  const toWorld = (v: Vec3): Vec3 => [v[0] * cosA + v[2] * sinA, v[1], -v[0] * sinA + v[2] * cosA];
  const dirB = toBody(dir);
  const depth = new Float32Array(W * H).fill(Infinity);
  const winner = new Int32Array(W * H).fill(-1);

  // A pixel's ray starts at (u, v) on the view plane, in body units: the ray's
  // origin in body space is linear in u and v, so it's a start plus steps.
  const o0 = toBody([-dir[0] * NEAR, -dir[1] * NEAR, -dir[2] * NEAR]);
  const ou = toBody([1, 0, 0]);
  const ov = toBody(up);
  const uOf = (px: number) => (px + 0.5 - W / 2) / k;
  const vOf = (py: number) => (feetY + 0.5 - (py + 0.5)) / k;

  model.solids.forEach((s, index) => {
    // Where on screen the solid can fall: a box round its widest radius.
    const w = toWorld([s.cx, s.cy, s.cz]);
    const r = (Math.max(s.rx, s.ry, s.rz) + 1) * k;
    const sx = w[0] * k + W / 2;
    const sy = feetY - (w[0] * up[0] + w[1] * up[1] + w[2] * up[2]) * k;
    const x0 = Math.max(0, Math.ceil(sx - r));
    const x1 = Math.min(W - 1, Math.floor(sx + r));
    const y0 = Math.max(0, Math.ceil(sy - r));
    const y1 = Math.min(H - 1, Math.floor(sy + r));
    for (let py = y0; py <= y1; py++) {
      const v = vOf(py);
      for (let px = x0; px <= x1; px++) {
        const u = uOf(px);
        const t = rayEllipsoid(o0[0] + ou[0] * u + ov[0] * v, o0[1] + ou[1] * u + ov[1] * v, o0[2] + ou[2] * u + ov[2] * v, dirB, s);
        const i = py * W + px;
        if (t < depth[i]) {
          depth[i] = t;
          winner[i] = index;
        }
      }
    }
  });

  for (let py = 0; py < H; py++) {
    const v = vOf(py);
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      if (winner[i] < 0) continue;
      const s = model.solids[winner[i]];
      const u = uOf(px);
      const t = depth[i];
      const hx = o0[0] + ou[0] * u + ov[0] * v + dirB[0] * t;
      const hy = o0[1] + ou[1] * u + ov[1] * v + dirB[1] * t;
      const hz = o0[2] + ou[2] * u + ov[2] * v + dirB[2] * t;
      let n: Vec3;
      if (s.axes) {
        const [ax, ay, az] = s.axes;
        const px0 = hx - s.cx;
        const py0 = hy - s.cy;
        const pz0 = hz - s.cz;
        const lx = (px0 * ax[0] + py0 * ax[1] + pz0 * ax[2]) / (s.rx * s.rx);
        const ly = (px0 * ay[0] + py0 * ay[1] + pz0 * ay[2]) / (s.ry * s.ry);
        const lz = (px0 * az[0] + py0 * az[1] + pz0 * az[2]) / (s.rz * s.rz);
        n = normalize(lx * ax[0] + ly * ay[0] + lz * az[0], lx * ax[1] + ly * ay[1] + lz * az[1], lx * ax[2] + ly * ay[2] + lz * az[2]);
      } else {
        n = normalize((hx - s.cx) / (s.rx * s.rx), (hy - s.cy) / (s.ry * s.ry), (hz - s.cz) / (s.rz * s.rz));
      }
      const hit: Hit = { x: hx, y: hy, z: hz, nx: n[0], ny: n[1], nz: n[2] };
      const tones = typeof s.material === 'function' ? s.material(hit) : s.material;
      c.set(px, py, light(tones, toWorld(n), hy, dir, s.soft, ground));
    }
  }

  if (spec.creases) crease(c, depth, W, H);
  // Eyes and other marks, where nothing nearer hides them: a pixel square at the
  // folk's size, and as many pixels across as the frame is finer (or `size` units).
  for (const d of model.details) {
    const w = toWorld([d.x, d.y, d.z]);
    const along = -(w[0] * dir[0] + w[1] * dir[1] + w[2] * dir[2]);
    const vUp = w[0] * up[0] + w[1] * up[1] + w[2] * up[2];
    const n = Math.max(1, Math.round((d.size ?? 1) * k));
    // Screen x is world x; screen up is the point along `up`.
    const fx = Math.floor(w[0] * k + W / 2 - (n - 1) / 2);
    const fy = Math.floor(feetY + 0.5 - vUp * k - (n - 1) / 2);
    for (let py = fy; py < fy + n; py++) {
      for (let px = fx; px < fx + n; px++) {
        if (!c.inside(px, py)) continue;
        if (NEAR - along <= depth[py * W + px] + 0.9) c.set(px, py, d.color);
      }
    }
  }
  return c;
}

/** Darkens the far side of every sharp step in depth between neighbouring pixels (see FrameSpec.creases). */
function crease(c: PixelCanvas, depth: Float32Array, w: number, h: number): void {
  const STEP = 3.2;
  const marks: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = depth[y * w + x];
      if (d === Infinity) continue;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const e = depth[ny * w + nx];
        if (e !== Infinity && d - e > STEP) {
          marks.push(y * w + x);
          break;
        }
      }
    }
  }
  for (const i of marks) {
    const col = c.get(i % w, Math.floor(i / w));
    if (col === null) continue;
    const r = ((col >> 16) & 0xff) * 0.55;
    const g = ((col >> 8) & 0xff) * 0.55;
    const b = (col & 0xff) * 0.6;
    c.set(i % w, Math.floor(i / w), (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b));
  }
}

/** The colour a surface shows, lit: the light and normal pick one of its tones. */
function light(tones: Tones, n: Vec3, y: number, view: Vec3, soft = false, ground = 4): number {
  const [base, shade, lit] = tones;
  const diffuse = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  // Edges turned side-on to the viewer and towards the light catch a rim of it.
  const facing = -(n[0] * view[0] + n[1] * view[1] + n[2] * view[2]);
  let k = soft ? 0.42 + diffuse * 0.6 : 0.12 + diffuse;
  if (facing < 0.3 && n[0] < -0.2) k += 0.25;
  // Darker towards the ground, where less light reaches.
  if (y < ground) k -= ((ground - y) / ground) * 0.24;
  if (k > 0.9) return lit;
  if (k > 0.52) return base;
  if (k > 0.3) return shade;
  return darker(shade);
}

type Vec3 = [number, number, number];

function normalize(x: number, y: number, z: number): Vec3 {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** Distance along the ray to where it first meets the ellipsoid, or Infinity. */
function rayEllipsoid(x: number, y: number, z: number, d: Vec3, s: Solid): number {
  let ox = x - s.cx;
  let oy = y - s.cy;
  let oz = z - s.cz;
  let dx = d[0];
  let dy = d[1];
  let dz = d[2];
  if (s.axes) {
    // Into the solid's own frame, where it lies along the axes again.
    const [ax, ay, az] = s.axes;
    [ox, oy, oz] = [ox * ax[0] + oy * ax[1] + oz * ax[2], ox * ay[0] + oy * ay[1] + oz * ay[2], ox * az[0] + oy * az[1] + oz * az[2]];
    [dx, dy, dz] = [dx * ax[0] + dy * ax[1] + dz * ax[2], dx * ay[0] + dy * ay[1] + dz * ay[2], dx * az[0] + dy * az[1] + dz * az[2]];
  }
  ox /= s.rx;
  oy /= s.ry;
  oz /= s.rz;
  dx /= s.rx;
  dy /= s.ry;
  dz /= s.rz;
  const A = dx * dx + dy * dy + dz * dz;
  const B = 2 * (ox * dx + oy * dy + oz * dz);
  const C = ox * ox + oy * oy + oz * oz - 1;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return Infinity;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t > 0 ? t : Infinity;
}

/** Every frame of a 3D figure: rows = 8 directions, cols as character.ts (4 idle, 4 walk, 2 sit). */
export function drawFigureSheet(build: (pose: Pose3D) => Model, spec: FrameSpec = PERSON): PixelCanvas {
  const sheet = new PixelCanvas(spec.w * POSES.length, spec.h * DIRECTIONS_8.length);
  DIRECTIONS_8.forEach((d, row) => {
    POSES.forEach((pose, col) => {
      const frame = renderFrame(build(pose), d.angle, spec);
      frame.outline();
      sheet.blit(frame, col * spec.w, row * spec.h);
    });
  });
  return sheet;
}

/**
 * Builds a 3D figure's sprite sheet (see {@link drawFigureSheet}) and registers
 * '<key>-idle-<dir>', '-walk-', '-sit-' and '-work-' (the seated frames, bobbing
 * quickly: crouched at a task) for all eight directions (see Npc.sync, which
 * then doesn't mirror). A finer `spec` (see FrameSpec.scale) makes bigger
 * frames, to be shown scaled down by the sprite.
 */
export function generateFigure3D(scene: Phaser.Scene, key: string, build: (pose: Pose3D) => Model, spec: FrameSpec = PERSON): void {
  const cols = POSES.length;
  const { w, h } = spec;
  const tex = drawFigureSheet(build, spec).toTexture(scene, key);
  let i = 0;
  for (let row = 0; row < DIRECTIONS_8.length; row++) {
    for (let col = 0; col < cols; col++) tex.add(i++, 0, col * w, row * h, w, h);
  }
  DIRECTIONS_8.forEach((d, row) => {
    const frames = (from: number, n: number) => Array.from({ length: n }, (_, k) => ({ key, frame: row * cols + from + k }));
    scene.anims.create({ key: `${key}-idle-${d.name}`, frames: frames(0, 4), frameRate: IDLE_FRAME_RATE, repeat: -1 });
    scene.anims.create({ key: `${key}-walk-${d.name}`, frames: frames(4, 4), frameRate: 9, repeat: -1 });
    scene.anims.create({ key: `${key}-sit-${d.name}`, frames: frames(8, 2), frameRate: 1.5, repeat: -1 });
    scene.anims.create({ key: `${key}-work-${d.name}`, frames: frames(8, 2), frameRate: 6, repeat: -1 });
  });
}

/**
 * Repaints a figure made by {@link generateFigure3D} from a new model, in
 * place: every sprite and image already showing it changes with it, and its
 * frames and animations stay as they were (the hero changing clothes).
 */
export function redrawFigure3D(scene: Phaser.Scene, key: string, build: (pose: Pose3D) => Model, spec: FrameSpec = PERSON): void {
  const tex = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
  tex.context.putImageData(drawFigureSheet(build, spec).toImageData(), 0, 0);
  tex.refresh();
}

/**
 * Draws a figure at their trade, for the few who have a working stroke (see
 * Pose3D.work), and makes it their '<key>-work-<dir>' animation in place of the
 * crouched one from {@link generateFigure3D}: `strokes` frames from the top of
 * the stroke to the bottom, played there and back.
 */
export function generateWorkFrames(scene: Phaser.Scene, key: string, build: (pose: Pose3D) => Model, strokes: number[], frameRate: number): void {
  const sheetKey = `${key}@work`;
  const sheet = new PixelCanvas(FRAME_W * strokes.length, FRAME_H * DIRECTIONS_8.length);
  DIRECTIONS_8.forEach((d, row) => {
    strokes.forEach((work, col) => {
      const frame = renderFrame(build({ stride: 0, bob: work * 0.6, work }), d.angle);
      frame.outline();
      sheet.blit(frame, col * FRAME_W, row * FRAME_H);
    });
  });
  const tex = sheet.toTexture(scene, sheetKey);
  let i = 0;
  for (let row = 0; row < DIRECTIONS_8.length; row++) {
    for (let col = 0; col < strokes.length; col++) tex.add(i++, 0, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H);
  }
  DIRECTIONS_8.forEach((d, row) => {
    const anim = `${key}-work-${d.name}`;
    if (scene.anims.exists(anim)) scene.anims.remove(anim);
    const frames = strokes.map((_, col) => ({ key: sheetKey, frame: row * strokes.length + col }));
    scene.anims.create({ key: anim, frames, frameRate, repeat: -1 });
  });
}
