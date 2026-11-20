import type { ItemId } from './Inventory';
import { SaveGame } from './SaveGame';

/**
 * Wild herbs growing about the world (yarrow, nettles and wolfsbane on the
 * plains, sage and comfrey in the cloister garden) for the brews at Old Maud's
 * bench. Each patch can be picked, and grows back after a day and a half. The
 * patches themselves are sights on the maps (`gather` with `regrow`, see
 * world/MapData.ts and world/HerbPatches.ts); this remembers when each was picked.
 */

export type HerbKind = 'yarrow' | 'comfrey' | 'nettle' | 'wolfsbane' | 'sage';

export const HERBS: Record<HerbKind, { item: ItemId; verb: string; count: number }> = {
  yarrow: { item: 'yarrow', verb: 'Pick yarrow', count: 2 },
  comfrey: { item: 'comfrey', verb: 'Cut comfrey', count: 2 },
  nettle: { item: 'nettle', verb: 'Pick nettles', count: 3 },
  wolfsbane: { item: 'wolfsbane', verb: 'Pick wolfsbane', count: 1 },
  sage: { item: 'sage', verb: 'Pick sage', count: 2 },
};

/** In-game hours before a picked patch has grown back. */
export const HERB_REGROW_HOURS = 36;

class HerbStore {
  /** Patch id -> clock hours when it was last picked. */
  private picked = new Map<string, number>();

  reset(): void {
    this.picked.clear();
  }

  isReady(id: string, nowHours: number, regrowHours = HERB_REGROW_HOURS): boolean {
    const at = this.picked.get(id);
    return at === undefined || nowHours - at >= regrowHours;
  }

  pick(id: string, nowHours: number): void {
    this.picked.set(id, nowHours);
  }

  toSave(): { picked: Array<[string, number]> } {
    return { picked: [...this.picked] };
  }

  fromSave(data: { picked?: Array<[string, number]> } | undefined): void {
    this.picked = new Map((data?.picked ?? []).filter(([id, at]) => typeof id === 'string' && typeof at === 'number'));
  }
}

export const Herbs = new HerbStore();

SaveGame.register('herbs', {
  save: () => Herbs.toSave(),
  load(data) {
    Herbs.reset();
    Herbs.fromSave(data as { picked?: Array<[string, number]> } | undefined);
  },
});
