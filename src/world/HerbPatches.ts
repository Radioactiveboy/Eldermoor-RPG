import { HERBS, HerbKind } from '../systems/Herbs';
import { MapData, placeObject, Prop, Terrain } from './MapData';

/**
 * Patches of wild herbs on a map: each is a clump of plants (art/herbs.ts)
 * that can be walked through, and a sight to gather it that grows back (see
 * systems/Herbs.ts and `gather` in scenes/game/sights.ts).
 */

/** Whether anything stands on a tile already. */
function occupied(data: MapData, tx: number, ty: number): boolean {
  return (data.objects ?? []).some((o) => tx >= o.tx && tx < o.tx + o.w && ty >= o.ty && ty < o.ty + o.h);
}

/** The nearest free tile of open ground to (x, y), searching outwards, or undefined if there's none close by. */
export function freeGround(data: MapData, x: number, y: number, ground: Terrain[] = [Terrain.Grass], reach = 6): { tx: number; ty: number } | undefined {
  for (let r = 0; r <= reach; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = Math.round(x) + dx;
        const ty = Math.round(y) + dy;
        if (tx < 1 || ty < 1 || tx >= data.width - 1 || ty >= data.height - 1) continue;
        if (!ground.includes(data.terrain[ty][tx]) || data.props[ty][tx] !== Prop.None || occupied(data, tx, ty)) continue;
        return { tx, ty };
      }
    }
  }
  return undefined;
}

/**
 * Plants a patch of a herb on a tile. `needs` keeps it from being picked until
 * a flag is set (the brothers' beds, until Brother Anselm says so).
 */
export function plantHerb(
  data: MapData,
  id: string,
  kind: HerbKind,
  tx: number,
  ty: number,
  needs?: { flag: string; thought: string },
): void {
  const herb = HERBS[kind];
  // Low and soft, so it can be waded through.
  placeObject(data, { key: `herb-${kind}`, tx, ty, w: 1, h: 1, shapes: [], blocks: [] });
  (data.sights ??= []).push({
    id,
    gx: tx + 0.5,
    gy: ty + 0.5,
    label: herb.verb,
    z: 28,
    gather: { item: herb.item, picked: `herb-${kind}-picked`, regrow: { grown: `herb-${kind}`, count: herb.count, verb: herb.verb }, needs },
  });
}

/** Plants a herb on the nearest free ground to (x, y), if there's any. */
export function plantHerbNear(data: MapData, id: string, kind: HerbKind, x: number, y: number, ground?: Terrain[]): void {
  const at = freeGround(data, x, y, ground);
  if (at) plantHerb(data, id, kind, at.tx, at.ty);
}
