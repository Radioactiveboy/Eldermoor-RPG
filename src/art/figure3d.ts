import Phaser from 'phaser';
import { darker, FEET_Y, FRAME_H, FRAME_W, IDLE_FRAME_RATE, Tones } from './character';
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
}

/** A small mark painted on top where it can be seen (eyes, buttons), in body space. */
export interface Detail {
  x: number;
  y: number;
  z: number;
  color: number;
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
  feetY: number;
  /** Body-space height under which the light falls off towards the ground. */
  groundShade?: number;
  /**
   * Draw a dark line inside the figure wherever one part stands well in front
   * of another (an arm across the body, the head over the shoulders), so the
   * parts read apart at small sizes.
   */
  creases?: boolean;
}

/** The folk's frame (see character.ts). */
const PERSON: FrameSpec = { w: FRAME_W, h: FRAME_H, feetY: FEET_Y };
/** How far in front of the frame the rays start, in pixels: further than any solid reaches. */
const NEAR = 120;

/**
 * Renders one frame: casts a ray through each pixel into the turned model,
 * finds the nearest solid, lights it and snaps the light to the colour's tones.
 */
export function renderFrame(model: Model, angleDeg: number, spec: FrameSpec = PERSON): PixelCanvas {
  const { w: FRAME_W, h: FRAME_H, feetY: FEET_Y } = spec;
  const ground = spec.groundShade ?? 4;
  const c = new PixelCanvas(FRAME_W, FRAME_H);
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
  const depth = new Float32Array(FRAME_W * FRAME_H).fill(Infinity);

  // Where on screen each solid can fall (a box round its widest radius), so
  // each pixel only tests the few solids that might cover it.
  const bounds = model.solids.map((s) => {
    const w = toWorld([s.cx, s.cy, s.cz]);
    const r = Math.max(s.rx, s.ry, s.rz) + 1;
    const sx = w[0] + FRAME_W / 2;
    const sy = FEET_Y - (w[0] * up[0] + w[1] * up[1] + w[2] * up[2]);
    return { s, x0: sx - r, x1: sx + r, y0: sy - r, y1: sy + r };
  });

  for (let py = 0; py < FRAME_H; py++) {
    const row = bounds.filter((bb) => py >= bb.y0 && py <= bb.y1);
    if (row.length === 0) continue;
    for (let px = 0; px < FRAME_W; px++) {
      const u = px + 0.5 - FRAME_W / 2;
      const v = FEET_Y + 0.5 - (py + 0.5);
      const origin: Vec3 = [u - dir[0] * NEAR + up[0] * v, up[1] * v - dir[1] * NEAR, up[2] * v - dir[2] * NEAR];
      const o = toBody(origin);
      let best = Infinity;
      let hitSolid: Solid | undefined;
      for (const bb of row) {
        if (px < bb.x0 || px > bb.x1) continue;
        const s = bb.s;
        const t = rayEllipsoid(o, dirB, s);
        if (t < best) {
          best = t;
          hitSolid = s;
        }
      }
      if (!hitSolid) continue;
      depth[py * FRAME_W + px] = best;
      const hx = o[0] + dirB[0] * best;
      const hy = o[1] + dirB[1] * best;
      const hz = o[2] + dirB[2] * best;
      const s = hitSolid;
      const n = normalize((hx - s.cx) / (s.rx * s.rx), (hy - s.cy) / (s.ry * s.ry), (hz - s.cz) / (s.rz * s.rz));
      const hit: Hit = { x: hx, y: hy, z: hz, nx: n[0], ny: n[1], nz: n[2] };
      const tones = typeof s.material === 'function' ? s.material(hit) : s.material;
      const nw = toWorld(n);
      c.set(px, py, light(tones, nw, hy, dir, s.soft, ground));
    }
  }

  if (spec.creases) crease(c, depth, FRAME_W, FRAME_H);
  // Eyes and other marks, where nothing nearer hides them.
  for (const d of model.details) {
    const w = toWorld([d.x, d.y, d.z]);
    // Project: screen x is world x; screen up is the point along `up`.
    const px = Math.floor(w[0] + FRAME_W / 2);
    const vUp = w[0] * up[0] + w[1] * up[1] + w[2] * up[2];
    const py = Math.floor(FEET_Y + 0.5 - vUp);
    if (!c.inside(px, py)) continue;
    const along = -(w[0] * dir[0] + w[1] * dir[1] + w[2] * dir[2]);
    if (NEAR - along <= depth[py * FRAME_W + px] + 0.9) c.set(px, py, d.color);
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
function rayEllipsoid(o: Vec3, d: Vec3, s: Solid): number {
  const ox = (o[0] - s.cx) / s.rx;
  const oy = (o[1] - s.cy) / s.ry;
  const oz = (o[2] - s.cz) / s.rz;
  const dx = d[0] / s.rx;
  const dy = d[1] / s.ry;
  const dz = d[2] / s.rz;
  const A = dx * dx + dy * dy + dz * dz;
  const B = 2 * (ox * dx + oy * dy + oz * dz);
  const C = ox * ox + oy * oy + oz * oz - 1;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return Infinity;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t > 0 ? t : Infinity;
}

/** Every frame of a 3D figure: rows = 8 directions, cols as character.ts (4 idle, 4 walk, 2 sit). */
export function drawFigureSheet(build: (pose: Pose3D) => Model): PixelCanvas {
  const sheet = new PixelCanvas(FRAME_W * POSES.length, FRAME_H * DIRECTIONS_8.length);
  DIRECTIONS_8.forEach((d, row) => {
    POSES.forEach((pose, col) => {
      const frame = renderFrame(build(pose), d.angle);
      frame.outline();
      sheet.blit(frame, col * FRAME_W, row * FRAME_H);
    });
  });
  return sheet;
}

/**
 * Builds a 3D figure's sprite sheet (see {@link drawFigureSheet}) and registers
 * '<key>-idle-<dir>', '-walk-', '-sit-' and '-work-' (the seated frames, bobbing
 * quickly: crouched at a task) for all eight directions (see Npc.sync, which
 * then doesn't mirror).
 */
export function generateFigure3D(scene: Phaser.Scene, key: string, build: (pose: Pose3D) => Model): void {
  const cols = POSES.length;
  const tex = drawFigureSheet(build).toTexture(scene, key);
  let i = 0;
  for (let row = 0; row < DIRECTIONS_8.length; row++) {
    for (let col = 0; col < cols; col++) tex.add(i++, 0, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H);
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
export function redrawFigure3D(scene: Phaser.Scene, key: string, build: (pose: Pose3D) => Model): void {
  const tex = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
  tex.context.putImageData(drawFigureSheet(build).toImageData(), 0, 0);
  tex.refresh();
}
