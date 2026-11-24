import type { Vec2 } from '../iso/IsoMath';

/**
 * Keeping out of the hero's way. The hero isn't one of the map's bodies (wolves
 * and boar mustn't stop short of them), so the people walking about look out
 * for the hero themselves: they give them a little room, step round them as
 * the hero would step round someone, and never walk into them.
 */

/** Room left between someone walking past and the hero, in tiles, beyond the two of them touching. */
export const HERO_ROOM = 0.06;

/** Someone (or something) standing about: where, and how wide. */
export interface Round {
  gx: number;
  gy: number;
  radius: number;
}

/**
 * Would moving a circle of radius r from `from` to `to` push it into `other`?
 * Only if it would overlap there and isn't moving away: something already
 * overlapping may always back out, so nobody is ever left wedged in place.
 */
export function closingIn(from: Vec2, to: Vec2, r: number, other: Round, room = 0): boolean {
  const reach = r + other.radius + room;
  const after = (to.x - other.gx) ** 2 + (to.y - other.gy) ** 2;
  if (after >= reach * reach) return false;
  const before = (from.x - other.gx) ** 2 + (from.y - other.gy) ** 2;
  return after <= before;
}

/** Is a point close enough to the hero that nobody of radius r could stand there? */
export function underfoot(p: Vec2, r: number, hero: Round, room = HERO_ROOM): boolean {
  const reach = r + hero.radius + room;
  return (p.x - hero.gx) ** 2 + (p.y - hero.gy) ** 2 < reach * reach;
}

/**
 * One step from `at` towards `towards` of `step` tiles, going round the hero if
 * they're in the way: along the edge of the room they need, on whichever side
 * is nearer the way they were going, leaning a little outwards so as never to
 * brush them. `free` says whether a spot is clear of everything else (walls,
 * stalls, other people). Undefined if there's no way past this step: wait.
 */
export function stepAround(
  at: Vec2,
  towards: Vec2,
  step: number,
  r: number,
  hero: Round | undefined,
  free: (p: Vec2) => boolean = () => true,
): Vec2 | undefined {
  const dx = towards.x - at.x;
  const dy = towards.y - at.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { ...at };
  const s = Math.min(step, dist);
  const straight = { x: at.x + (dx / dist) * s, y: at.y + (dy / dist) * s };
  if (!hero || !closingIn(at, straight, r, hero, HERO_ROOM)) return straight;

  // Round the edge of the hero, the nearer way first.
  const ox = at.x - hero.gx;
  const oy = at.y - hero.gy;
  const len = Math.hypot(ox, oy) || 1;
  const nx = ox / len;
  const ny = oy / len;
  const tx = -ny;
  const ty = nx;
  const first = tx * dx + ty * dy >= 0 ? 1 : -1;
  for (const side of [first, -first]) {
    const p = { x: at.x + (tx * side + nx * 0.2) * s, y: at.y + (ty * side + ny * 0.2) * s };
    if (!closingIn(at, p, r, hero, HERO_ROOM) && free(p)) return p;
  }
  return undefined;
}
