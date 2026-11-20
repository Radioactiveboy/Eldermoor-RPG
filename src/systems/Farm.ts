import type { ItemId } from './Inventory';
import { SaveGame } from './SaveGame';

export type CropKind = 'carrot' | 'cabbage' | 'turnip';

export const CROPS: Record<CropKind, { item: ItemId; verb: string }> = {
  carrot: { item: 'carrot', verb: 'Pull carrots' },
  cabbage: { item: 'cabbage', verb: 'Cut cabbage' },
  turnip: { item: 'turnip', verb: 'Pull turnip' },
};

/** In-game hours before a picked crop has grown back (a whole day is 24 real minutes). */
export const REGROW_HOURS = 16;
/** How long picking takes, in real seconds. */
export const PICK_SECONDS = 2.5;

// ------------------------------------------------------------ the plot in Iran's yard

/**
 * What's going on in one tile of the plot Farmer Iran lends the hero: dug or
 * still under weeds, what's sown in it, how far it has grown, and until when
 * the soil stays damp from the last watering (or the last rain).
 */
export interface PlotTile {
  dug: boolean;
  crop?: CropKind;
  /** Hours of growing done so far: it only grows while the soil is damp. */
  grown: number;
  /** Clock hours until which the soil stays damp. */
  wetUntil: number;
  /** Clock hours it was last brought up to date to. */
  checked: number;
}

/** How a sown tile looks: seed just in, little shoots, coming on, or ready to pick. */
export type PlotStage = 'sown' | 'sprout' | 'young' | 'ripe';

/** Hours of damp soil each crop needs from seed to harvest: two days for roots, three for a cabbage. */
export const GROW_HOURS: Record<CropKind, number> = { carrot: 48, turnip: 48, cabbage: 72 };
/** How long a watering can keeps the soil damp: about a day, so it wants watering daily. */
export const WET_HOURS = 24;
/** Rain at least this hard (drizzle is 0.3) waters the plot. */
export const RAIN_WATERS = 0.25;
/** The plot is brought up to date in steps this long (in hours), looking for rain in each. */
const STEP_HOURS = 0.5;
/** What a ripe tile gives. */
export const PLOT_YIELD: Record<CropKind, number> = { carrot: 3, cabbage: 2, turnip: 3 };
/** Seeds for each crop, as sold at Hilde's stall. */
export const SEEDS: Record<CropKind, ItemId> = { carrot: 'carrot-seed', cabbage: 'cabbage-seed', turnip: 'turnip-seed' };
/** How long each job takes, in real seconds. */
export const PLOT_SECONDS = { dig: 2.5, sow: 1.5, water: 1.5 };

/** How much rain is falling at an hour (0..1): `Weather.at(h).rain` in the game, anything in a test. */
export type RainAt = (hours: number) => number;

/**
 * Brings a tile up to `now`: any rain since it was last looked at dampens the
 * soil for a day, and a sown crop grows for every hour the soil was damp.
 * Pure (apart from the tile it's given), so it can be tested.
 */
export function advancePlot(tile: PlotTile, now: number, rainAt: RainAt): void {
  // Only the last few days matter: a long absence can't do more than ripen everything.
  let t = Math.max(tile.checked, now - 24 * 7);
  while (t < now) {
    const end = Math.min(now, t + STEP_HOURS);
    if (rainAt(t) >= RAIN_WATERS) tile.wetUntil = Math.max(tile.wetUntil, t + WET_HOURS);
    if (tile.crop) tile.grown += Math.max(0, Math.min(end, tile.wetUntil) - t);
    t = end;
  }
  tile.checked = Math.max(tile.checked, now);
}

/** How far along a tile's crop is (only for a sown tile). */
export function plotStage(tile: PlotTile): PlotStage {
  const f = tile.crop ? tile.grown / GROW_HOURS[tile.crop] : 0;
  return f >= 1 ? 'ripe' : f >= 0.45 ? 'young' : f > 0.1 ? 'sprout' : 'sown';
}

/** Roughly how many hours of damp soil a sown tile still needs. */
export function hoursToRipe(tile: PlotTile): number {
  return tile.crop ? Math.max(0, GROW_HOURS[tile.crop] - tile.grown) : 0;
}

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
  /** Tile key -> the tiles of the plot in Iran's yard that have been worked. */
  private plot = new Map<string, PlotTile>();

  reset(): void {
    this.picked.clear();
    this.shaken.clear();
    this.plot.clear();
  }

  toSave(): { picked: Array<[string, number]>; shaken: Array<[string, number]>; plot: Array<[string, PlotTile]> } {
    return { picked: [...this.picked], shaken: [...this.shaken], plot: [...this.plot].map(([k, t]) => [k, { ...t }]) };
  }

  fromSave(data: Partial<ReturnType<FarmState['toSave']>>): void {
    this.picked = new Map(data.picked ?? []);
    this.shaken = new Map(data.shaken ?? []);
    // Saves from before the plot have none.
    this.plot = new Map((data.plot ?? []).filter(([k, t]) => typeof k === 'string' && t && typeof t.grown === 'number').map(([k, t]) => [k, { ...t }]));
  }

  /** A plot tile, brought up to date (untouched ground is still under weeds). */
  plotTile(tx: number, ty: number, now: number, rainAt: RainAt): PlotTile {
    const tile = this.plot.get(`${tx},${ty}`);
    if (!tile) return { dug: false, grown: 0, wetUntil: -Infinity, checked: now };
    advancePlot(tile, now, rainAt);
    return tile;
  }

  /** Turn the weeds under: the tile is bare soil, ready to sow. */
  dig(tx: number, ty: number, now: number): void {
    this.plot.set(`${tx},${ty}`, { dug: true, grown: 0, wetUntil: -Infinity, checked: now });
  }

  sow(tx: number, ty: number, crop: CropKind, now: number, rainAt: RainAt): void {
    const tile = this.plotTile(tx, ty, now, rainAt);
    if (!tile.dug || tile.crop) return;
    Object.assign(tile, { crop, grown: 0 });
    this.plot.set(`${tx},${ty}`, tile);
  }

  water(tx: number, ty: number, now: number, rainAt: RainAt): void {
    const tile = this.plotTile(tx, ty, now, rainAt);
    if (!tile.dug) return;
    tile.wetUntil = now + WET_HOURS;
    this.plot.set(`${tx},${ty}`, tile);
  }

  /** Pick a ripe crop: what it gives, and the tile is left dug and empty for the next sowing. */
  harvest(tx: number, ty: number, now: number, rainAt: RainAt): { item: ItemId; count: number } | undefined {
    const tile = this.plotTile(tx, ty, now, rainAt);
    if (!tile.crop || plotStage(tile) !== 'ripe') return undefined;
    const kind = tile.crop;
    tile.crop = undefined;
    tile.grown = 0;
    return { item: CROPS[kind].item, count: PLOT_YIELD[kind] };
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
    if (data) Farm.fromSave(data as Partial<ReturnType<FarmState['toSave']>>);
  },
});
