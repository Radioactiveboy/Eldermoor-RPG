import { TILE_HEIGHT, TILE_WIDTH } from '../config';
import { PixelCanvas } from './PixelCanvas';

/**
 * A tiny 3D painter for isometric objects (furniture, buildings). Shapes are
 * described in grid space (x, y in tiles, z in pixels upwards), projected the
 * same way as the world, and painted back-to-front into a PixelCanvas.
 *
 * Each surface gets a shader: a function of its local (u, v) coordinates, both
 * 0..1, returning a colour (or null to leave a hole). That keeps planks, stones
 * and thatch lined up with the surface they sit on.
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Shader = (u: number, v: number) => number | null;
export type Paint = number | Shader;

interface Face {
  origin: Vec3;
  du: Vec3;
  dv: Vec3;
  shade: Shader;
}

export interface BoxPaint {
  top: Paint;
  /** Face towards the bottom-left of the screen (+y). */
  left: Paint;
  /** Face towards the bottom-right of the screen (+x). */
  right: Paint;
}

const HALF_W = TILE_WIDTH / 2;
const HALF_H = TILE_HEIGHT / 2;

export function project(p: Vec3): { x: number; y: number } {
  return { x: (p.x - p.y) * HALF_W, y: (p.x + p.y) * HALF_H - p.z };
}

const solid = (p: Paint): Shader => (typeof p === 'number' ? () => p : p);
const add = (a: Vec3, b: Vec3, s = 1): Vec3 => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });

export interface RenderedModel {
  canvas: PixelCanvas;
  /** Pixel in the canvas where grid point (0, 0, 0) of the model lands. */
  anchorX: number;
  anchorY: number;
  /**
   * For a turned model (drawn with a depth buffer): at each pixel, x + y of the point of the model drawn
   * there (-Infinity where nothing of the model is, or only its outline). Something standing at a point
   * whose x + y is less is behind that pixel; see {@link inFrontOf}.
   */
  keys?: Float32Array;
}

/**
 * The part of a turned model that's in front of someone standing at grid point (x, y) within it: every
 * pixel whose point is nearer the camera (further along x + y), with the outlines round them. Drawn over
 * them, it hides whatever of them the model should (a cabin, a gunwale, a sail), as a canvas the same
 * size as the model's and anchored the same.
 */
export function inFrontOf(r: RenderedModel, x: number, y: number): PixelCanvas {
  const { canvas, keys } = r;
  const out = new PixelCanvas(canvas.width, canvas.height);
  if (!keys) return out;
  const at = x + y + 0.04;
  const w = canvas.width;
  const front = (px: number, py: number) => px >= 0 && py >= 0 && px < w && py < canvas.height && keys[py * w + px] > at;
  for (let py = 0; py < canvas.height; py++) {
    for (let px = 0; px < w; px++) {
      const col = canvas.get(px, py);
      if (col === null) continue;
      const k = keys[py * w + px];
      // A pixel of the model in front, or an outline pixel beside one.
      const near = k > at || (k === -Infinity && (front(px - 1, py) || front(px + 1, py) || front(px, py - 1) || front(px, py + 1)));
      if (near) out.set(px, py, col);
    }
  }
  return out;
}

export class IsoModel {
  private readonly faces: Face[] = [];
  /**
   * Turned about the vertical (see {@link turned}): every shape is spun this many radians about `pivot`
   * as it goes in, and the model is drawn with a depth buffer instead of in call order, so it looks
   * right from any side.
   */
  private yaw?: { cos: number; sin: number; pivot: Vec3 };

  /**
   * A model that is spun `angle` radians about the vertical line through `pivot` (clockwise as seen from
   * above, so a bow pointing up the screen's -y swings round towards +x). Shapes are given as if
   * unturned; boxes and cylinders get all their sides (any may end up facing the camera), and it draws
   * with a depth buffer. For something that has to be seen heading any way (the Grey Heron, turning).
   */
  static turned(angle: number, pivot: { x: number; y: number }): IsoModel {
    const m = new IsoModel();
    m.yaw = { cos: Math.cos(angle), sin: Math.sin(angle), pivot: { x: pivot.x, y: pivot.y, z: 0 } };
    return m;
  }

  /** Whether it is turned (see {@link turned}), and so needs drawing from every side. */
  get isTurned(): boolean {
    return !!this.yaw;
  }

  /** Where a point given unturned ends up (itself, for a model that isn't turned). */
  place(p: Vec3): Vec3 {
    const t = this.yaw;
    if (!t) return p;
    const x = p.x - t.pivot.x;
    const y = p.y - t.pivot.y;
    return { x: t.pivot.x + x * t.cos - y * t.sin, y: t.pivot.y + x * t.sin + y * t.cos, z: p.z };
  }

  /** The same, for a direction rather than a point. */
  private turn(d: Vec3): Vec3 {
    const t = this.yaw;
    if (!t) return d;
    return { x: d.x * t.cos - d.y * t.sin, y: d.x * t.sin + d.y * t.cos, z: d.z };
  }

  /** A flat parallelogram from `origin` spanning `du` and `dv`. Drawn in call order. */
  quad(origin: Vec3, du: Vec3, dv: Vec3, paint: Paint): this {
    this.faces.push({ origin: this.place(origin), du: this.turn(du), dv: this.turn(dv), shade: solid(paint) });
    return this;
  }

  /**
   * Axis-aligned box with its back-top-left corner at (x, y, z) on the floor.
   * Only the three faces the camera can see are drawn. u runs along x (or y for
   * the right face); v runs from the top edge downwards on the side faces.
   */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, paint: BoxPaint): this {
    const top = z + sz;
    if (this.yaw) {
      // Turned, the back faces may come round to the front: they take the paint of the faces opposite.
      this.quad({ x, y, z: top }, { x: sx, y: 0, z: 0 }, { x: 0, y: 0, z: -sz }, paint.left);
      this.quad({ x, y, z: top }, { x: 0, y: sy, z: 0 }, { x: 0, y: 0, z: -sz }, paint.right);
    }
    this.quad({ x, y: y + sy, z: top }, { x: sx, y: 0, z: 0 }, { x: 0, y: 0, z: -sz }, paint.left);
    this.quad({ x: x + sx, y, z: top }, { x: 0, y: sy, z: 0 }, { x: 0, y: 0, z: -sz }, paint.right);
    this.quad({ x, y, z: top }, { x: sx, y: 0, z: 0 }, { x: 0, y: sy, z: 0 }, paint.top);
    return this;
  }

  /** Upright cylinder (barrels, pots). u goes round the visible side, v from the top down. */
  cylinder(cx: number, cy: number, z: number, r: number, h: number, side: Shader, top: Paint): this {
    // Split the visible half into thin quads so the shader sees a smooth u.
    // Turned, the way round it that faces the camera moves: draw it all the way round.
    const round = this.yaw ? 2 : 1;
    const slices = 24 * round;
    const from = -Math.PI / 4;
    for (let i = 0; i < slices; i++) {
      const a0 = from + (Math.PI * round * i) / slices;
      const a1 = from + (Math.PI * round * (i + 1)) / slices;
      const p0 = { x: cx + Math.cos(a0) * r, y: cy + Math.sin(a0) * r, z: z + h };
      const p1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r, z: z + h };
      const u = ((i + 0.5) / 24) % 1;
      this.quad(p0, { x: p1.x - p0.x, y: p1.y - p0.y, z: 0 }, { x: 0, y: 0, z: -h }, (_su, v) => side(u, v));
    }
    const topShade = solid(top);
    // Top as a disc: a square quad with the corners masked off.
    this.quad({ x: cx - r, y: cy - r, z: z + h }, { x: r * 2, y: 0, z: 0 }, { x: 0, y: r * 2, z: 0 }, (u, v) => {
      const dx = u * 2 - 1;
      const dy = v * 2 - 1;
      return dx * dx + dy * dy <= 1 ? topShade(u, v) : null;
    });
    return this;
  }

  /** Repaints every face drawn so far through `fn` (scorching a piece of furniture, say). */
  mapShaders(fn: (shade: Shader, index: number) => Shader): this {
    this.faces.forEach((f, i) => (f.shade = fn(f.shade, i)));
    return this;
  }

  render(outline = true): RenderedModel {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const f of this.faces) {
      for (const p of [f.origin, add(f.origin, f.du), add(f.origin, f.dv), add(add(f.origin, f.du), f.dv)]) {
        const s = project(p);
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x);
        maxY = Math.max(maxY, s.y);
      }
    }
    const pad = 2;
    const ox = Math.floor(minX) - pad;
    const oy = Math.floor(minY) - pad;
    const canvas = new PixelCanvas(Math.ceil(maxX) - ox + pad, Math.ceil(maxY) - oy + pad);
    // A turned model keeps the nearest thing at each pixel (nearer the camera is further along +x, +y and up).
    const depth = this.yaw ? new Float32Array(canvas.width * canvas.height).fill(-Infinity) : undefined;
    const keys = this.yaw ? new Float32Array(canvas.width * canvas.height).fill(-Infinity) : undefined;

    for (const f of this.faces) {
      // Sample densely enough that every pixel the face covers gets painted.
      const a = project(f.du);
      const b = project(f.dv);
      const nu = Math.max(2, Math.ceil(Math.hypot(a.x, a.y) * 2) + 1);
      const nv = Math.max(2, Math.ceil(Math.hypot(b.x, b.y) * 2) + 1);
      const o = project(f.origin);
      for (let i = 0; i < nu; i++) {
        const u = i / (nu - 1);
        for (let j = 0; j < nv; j++) {
          const v = j / (nv - 1);
          const col = f.shade(Math.min(u, 0.9999), Math.min(v, 0.9999));
          if (col === null) continue;
          const px = Math.floor(o.x + a.x * u + b.x * v - ox);
          const py = Math.floor(o.y + a.y * u + b.y * v - oy);
          if (depth) {
            if (!canvas.inside(px, py)) continue;
            const d =
              f.origin.x + f.du.x * u + f.dv.x * v + (f.origin.y + f.du.y * u + f.dv.y * v) + (f.origin.z + f.du.z * u + f.dv.z * v) / HALF_H;
            const k = py * canvas.width + px;
            if (d < depth[k] - 0.02) continue;
            depth[k] = Math.max(d, depth[k]);
            keys![k] = f.origin.x + f.du.x * u + f.dv.x * v + (f.origin.y + f.du.y * u + f.dv.y * v);
          }
          canvas.set(px, py, col);
        }
      }
    }
    if (outline) canvas.outline();
    return { canvas, anchorX: -ox, anchorY: -oy, keys };
  }
}

/** Horizontal boards along u, with darker seams and a few knots. */
export function planks(count: number, base: number, dark: number, light: number, seed = 1): Shader {
  return (u, v) => {
    const fv = v * count;
    const row = Math.floor(fv);
    const lv = fv - row;
    if (lv < 1 / 6) return dark;
    // Board ends staggered row by row.
    const joint = (u * 2.3 + row * 0.37 + seed * 0.11) % 1;
    if (joint < 0.025) return dark;
    if (lv < 2 / 6) return light;
    const n = Math.sin(u * 91 + row * 13 + seed * 7) * Math.sin(u * 37 + row * 5);
    return n > 0.82 ? dark : base;
  };
}

/** Plain face lit a little brighter at its top edge. */
export function lipped(base: number, light: number, lip = 0.12): Shader {
  return (_u, v) => (v < lip ? light : base);
}
