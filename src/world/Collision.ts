import type { Vec2 } from '../iso/IsoMath';

/**
 * Collision shapes, in grid space (tiles). Instead of every blocked tile being
 * a solid square, each thing gets an outline close to what's drawn: a round
 * trunk, a thin fence rail, a boulder. Characters are circles, so they can walk
 * right up to (and around) them.
 */
export type Shape =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'box'; x0: number; y0: number; x1: number; y1: number };

export const circle = (x: number, y: number, r: number): Shape => ({ kind: 'circle', x, y, r });
export const box = (x0: number, y0: number, x1: number, y1: number): Shape => ({ kind: 'box', x0, y0, x1, y1 });

/** A whole tile, for buildings, water and crop rows. */
export const FULL_TILE: Shape[] = [box(0, 0, 1, 1)];

/** Moves a shape given relative to a tile's back corner to (tx, ty). */
export function offsetShape(s: Shape, tx: number, ty: number): Shape {
  return s.kind === 'circle' ? circle(s.x + tx, s.y + ty, s.r) : box(s.x0 + tx, s.y0 + ty, s.x1 + tx, s.y1 + ty);
}

/** Does a circle at (x, y) with radius r overlap the shape? */
export function circleHits(s: Shape, x: number, y: number, r: number): boolean {
  if (s.kind === 'circle') {
    const reach = s.r + r;
    return (x - s.x) ** 2 + (y - s.y) ** 2 < reach * reach;
  }
  const cx = Math.max(s.x0, Math.min(x, s.x1));
  const cy = Math.max(s.y0, Math.min(y, s.y1));
  return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}

/**
 * Is a point drawn behind this shape? Used to sort characters against long,
 * thin things like fence rails, where one depth value for the whole sprite
 * isn't enough. Mirrors the usual isometric rule: further along +x or +y is in front.
 */
export function isBehind(s: Shape, p: Vec2): boolean {
  if (s.kind === 'circle') return p.x + p.y < s.x + s.y;
  return p.x < s.x1 && p.y < s.y1;
}

/** Fence pieces join their neighbours: N = -y, S = +y, W = -x, E = +x (same bits as art/farm.ts FENCE). */
export function fenceShapes(mask: number): Shape[] {
  const shapes: Shape[] = [box(0.4, 0.4, 0.6, 0.6)];
  if (mask & 1) shapes.push(box(0.44, 0, 0.56, 0.5));
  if (mask & 2) shapes.push(box(0.44, 0.5, 0.56, 1));
  if (mask & 4) shapes.push(box(0, 0.44, 0.5, 0.56));
  if (mask & 8) shapes.push(box(0.5, 0.44, 1, 0.56));
  return shapes;
}
