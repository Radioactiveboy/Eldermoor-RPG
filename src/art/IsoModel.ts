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
}

export class IsoModel {
  private readonly faces: Face[] = [];

  /** A flat parallelogram from `origin` spanning `du` and `dv`. Drawn in call order. */
  quad(origin: Vec3, du: Vec3, dv: Vec3, paint: Paint): this {
    this.faces.push({ origin, du, dv, shade: solid(paint) });
    return this;
  }

  /**
   * Axis-aligned box with its back-top-left corner at (x, y, z) on the floor.
   * Only the three faces the camera can see are drawn. u runs along x (or y for
   * the right face); v runs from the top edge downwards on the side faces.
   */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, paint: BoxPaint): this {
    const top = z + sz;
    this.quad({ x, y: y + sy, z: top }, { x: sx, y: 0, z: 0 }, { x: 0, y: 0, z: -sz }, paint.left);
    this.quad({ x: x + sx, y, z: top }, { x: 0, y: sy, z: 0 }, { x: 0, y: 0, z: -sz }, paint.right);
    this.quad({ x, y, z: top }, { x: sx, y: 0, z: 0 }, { x: 0, y: sy, z: 0 }, paint.top);
    return this;
  }

  /** Upright cylinder (barrels, pots). u goes round the visible side, v from the top down. */
  cylinder(cx: number, cy: number, z: number, r: number, h: number, side: Shader, top: Paint): this {
    // Split the visible half into thin quads so the shader sees a smooth u.
    const slices = 24;
    const from = -Math.PI / 4;
    for (let i = 0; i < slices; i++) {
      const a0 = from + (Math.PI * i) / slices;
      const a1 = from + (Math.PI * (i + 1)) / slices;
      const p0 = { x: cx + Math.cos(a0) * r, y: cy + Math.sin(a0) * r, z: z + h };
      const p1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r, z: z + h };
      const u = (i + 0.5) / slices;
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
          canvas.set(px, py, col);
        }
      }
    }
    if (outline) canvas.outline();
    return { canvas, anchorX: -ox, anchorY: -oy };
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
