/**
 * Adowvale the morning after the goblins got in (see scenes/game/gate.ts): Hilde's
 * bakery burnt out, Hilde gone. Kept apart from the scene code so the area registry
 * can use it without pulling that in.
 */
import { QuestLog } from '../systems/Quests';
import { MapData, placeObject } from './MapData';

/** People who aren't about any more: Hilde, once the goblins have carried her off. */
export function absent(id: string): boolean {
  return id === 'baker' && QuestLog.hasFlag('hilde-taken');
}

/** The village the morning after it fell: Hilde's bakery burnt out, her stall empty, ash in the street. */
export function gateAftermath(data: MapData): MapData {
  if (!QuestLog.hasFlag('bakery-burnt')) return data;
  const bakery = data.objects?.find((o) => o.key === 'bld-bakery');
  if (bakery) {
    bakery.key = 'bld-bakery-burnt';
    // No smoke from its chimney, only from the ruin.
    data.chimneys = (data.chimneys ?? []).filter((c) => !(c.gx >= bakery.tx && c.gx < bakery.tx + 3 && c.gy >= bakery.ty && c.gy < bakery.ty + 3));
    for (const [dx, dy, key] of [[0, 3, 'decal-ash-0'], [2, 3, 'decal-scorch-1'], [1, 4, 'decal-ash-2']] as const) {
      placeObject(data, { key, tx: bakery.tx + dx, ty: bakery.ty + dy, w: 1, h: 1, flat: true });
    }
  }
  if (QuestLog.hasFlag('hilde-taken')) {
    // Nobody to open her stall: it stays sheeted over, day and night.
    const stall = data.objects?.find((o) => o.key === 'mkt-stall-baker');
    if (stall) stall.key = 'mkt-stall-baker-closed';
  }
  data.npcs = (data.npcs ?? []).filter((n) => !absent(n.id));
  return data;
}
