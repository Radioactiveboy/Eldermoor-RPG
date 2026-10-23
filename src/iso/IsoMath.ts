import { TILE_HEIGHT, TILE_WIDTH } from '../config';

/**
 * The world is simulated in flat "grid space" (x, y measured in tiles) and only
 * projected to isometric screen space for rendering. Keep gameplay logic in
 * grid space; only rendering and input should call these helpers.
 */
export interface Vec2 {
  x: number;
  y: number;
}

const HALF_W = TILE_WIDTH / 2;
const HALF_H = TILE_HEIGHT / 2;

/** Grid (tile units) -> world pixels (isometric). */
export function gridToScreen(gx: number, gy: number): Vec2 {
  return { x: (gx - gy) * HALF_W, y: (gx + gy) * HALF_H };
}

/** World pixels (isometric) -> grid (tile units, fractional). */
export function screenToGrid(sx: number, sy: number): Vec2 {
  return {
    x: (sx / HALF_W + sy / HALF_H) / 2,
    y: (sy / HALF_H - sx / HALF_W) / 2,
  };
}

/** Render depth for something standing at a grid position: further "down" the screen draws on top. */
export function depthAt(gx: number, gy: number): number {
  return 1000 + (gx + gy) * HALF_H;
}
