export interface GridPoint {
  x: number;
  y: number;
}

type WalkableFn = (x: number, y: number) => boolean;
/** May a diagonal step from (x, y) by (dx, dy) squeeze past whatever is beside it? */
type CornerFn = (x: number, y: number, dx: number, dy: number) => boolean;

const DIRS: Array<[number, number, number]> = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/**
 * 8-directional A* on a tile grid. Diagonal moves are not allowed to cut
 * past blocked corners, unless `canCut` says there's room to squeeze through
 * (say, between two tree trunks). Returns the tile path excluding the start, or null.
 */
export function findPath(
  start: GridPoint,
  goal: GridPoint,
  width: number,
  height: number,
  walkable: WalkableFn,
  maxNodes = 5000,
  canCut?: CornerFn,
): GridPoint[] | null {
  if (!walkable(goal.x, goal.y)) return null;
  const key = (x: number, y: number) => y * width + x;
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - goal.x);
    const dy = Math.abs(y - goal.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };

  const open: Array<{ x: number; y: number; f: number }> = [{ ...start, f: h(start.x, start.y) }];
  const g = new Map<number, number>([[key(start.x, start.y), 0]]);
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();

  while (open.length > 0 && closed.size < maxNodes) {
    // Small grids: a linear scan is fine. Swap for a binary heap if maps grow large.
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const cur = open.splice(best, 1)[0];
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    if (cur.x === goal.x && cur.y === goal.y) return reconstruct(cameFrom, ck, width, key(start.x, start.y));
    closed.add(ck);

    for (const [dx, dy, cost] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!walkable(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!walkable(cur.x + dx, cur.y) || !walkable(cur.x, cur.y + dy))) {
        if (!canCut?.(cur.x, cur.y, dx, dy)) continue;
      }
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const ng = (g.get(ck) ?? 0) + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        cameFrom.set(nk, ck);
        open.push({ x: nx, y: ny, f: ng + h(nx, ny) });
      }
    }
  }
  return null;
}

function reconstruct(cameFrom: Map<number, number>, end: number, width: number, start: number): GridPoint[] {
  const path: GridPoint[] = [];
  let k: number | undefined = end;
  while (k !== undefined && k !== start) {
    path.push({ x: k % width, y: Math.floor(k / width) });
    k = cameFrom.get(k);
  }
  return path.reverse();
}
