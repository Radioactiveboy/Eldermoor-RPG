import type { ItemId } from './Inventory';
import { SaveGame } from './SaveGame';

export type CropKind = 'carrot' | 'cabbage' | 'turnip';

export const CROPS: Record<CropKind, { item: ItemId; verb: string }> = {
  carrot: { item: 'carrot', verb: 'Pull carrots' },
  cabbage: { item: 'cabbage', verb: 'Cut cabbage' },
  turnip: { item: 'turnip', verb: 'Pull turnip' },
};

/** In-game hours before a picked crop has grown back (a whole day is 10 real minutes). */
export const REGROW_HOURS = 16;
/** How long picking takes, in real seconds. */
export const PICK_SECONDS = 2.5;

/**
 * Things in the world that remember being used, so they stay that way when
 * the player walks indoors and back out: picked crops regrow after a while,
 * and each tree only drops something once a day.
 */
class FarmState {
  /** Tile key -> clock hours when it was picked. */
  private picked = new Map<string, number>();
  /** Tile key -> day the tree was last shaken. */
  private shaken = new Map<string, number>();

  reset(): void {
    this.picked.clear();
    this.shaken.clear();
  }

  toSave(): { picked: Array<[string, number]>; shaken: Array<[string, number]> } {
    return { picked: [...this.picked], shaken: [...this.shaken] };
  }

  fromSave(data: ReturnType<FarmState['toSave']>): void {
    this.picked = new Map(data.picked);
    this.shaken = new Map(data.shaken);
  }

  isRipe(tx: number, ty: number, nowHours: number): boolean {
    const at = this.picked.get(`${tx},${ty}`);
    return at === undefined || nowHours - at >= REGROW_HOURS;
  }

  pick(tx: number, ty: number, nowHours: number): void {
    this.picked.set(`${tx},${ty}`, nowHours);
  }

  wasShakenToday(tx: number, ty: number, day: number): boolean {
    return this.shaken.get(`${tx},${ty}`) === day;
  }

  shake(tx: number, ty: number, day: number): void {
    this.shaken.set(`${tx},${ty}`, day);
  }
}

export const Farm = new FarmState();

SaveGame.register('farm', {
  save: () => Farm.toSave(),
  load(data) {
    Farm.reset();
    if (data) Farm.fromSave(data as ReturnType<FarmState['toSave']>);
  },
});
