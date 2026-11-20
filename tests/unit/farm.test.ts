import { beforeEach, describe, expect, it } from 'vitest';
import { advancePlot, Farm, GROW_HOURS, hoursToRipe, PLOT_YIELD, PlotTile, plotStage, WET_HOURS } from '../../src/systems/Farm';
import { SaveData, SaveGame } from '../../src/systems/SaveGame';

const dry = () => 0;
/** Raining (hard enough) from hour `from` to hour `to`, dry otherwise. */
const rainBetween = (from: number, to: number) => (h: number) => (h >= from && h < to ? 0.7 : 0);

describe('the plot in Iran\'s yard', () => {
  beforeEach(() => Farm.reset());

  it('starts under weeds, and digging leaves bare, dry soil', () => {
    expect(Farm.plotTile(3, 4, 10, dry).dug).toBe(false);
    Farm.dig(3, 4, 10);
    const tile = Farm.plotTile(3, 4, 12, dry);
    expect(tile.dug).toBe(true);
    expect(tile.crop).toBeUndefined();
    expect(tile.wetUntil).toBeLessThan(12);
  });

  it('can only sow dug ground, and only one crop at a time', () => {
    Farm.sow(1, 1, 'carrot', 0, dry);
    expect(Farm.plotTile(1, 1, 0, dry).crop).toBeUndefined();
    Farm.dig(1, 1, 0);
    Farm.sow(1, 1, 'carrot', 0, dry);
    Farm.sow(1, 1, 'cabbage', 0, dry);
    expect(Farm.plotTile(1, 1, 0, dry).crop).toBe('carrot');
  });

  it("doesn't grow in dry soil", () => {
    Farm.dig(0, 0, 0);
    Farm.sow(0, 0, 'carrot', 0, dry);
    const tile = Farm.plotTile(0, 0, 24 * 5, dry);
    expect(tile.grown).toBe(0);
    expect(plotStage(tile)).toBe('sown');
  });

  it('grows for a day after each watering, and ripens once it has had enough', () => {
    Farm.dig(0, 0, 0);
    Farm.sow(0, 0, 'carrot', 0, dry);
    Farm.water(0, 0, 0, dry);
    // A whole day of growing, then it dries out and waits.
    expect(Farm.plotTile(0, 0, 40, dry).grown).toBeCloseTo(WET_HOURS);
    expect(plotStage(Farm.plotTile(0, 0, 40, dry))).toBe('young');
    Farm.water(0, 0, 40, dry);
    expect(Farm.plotTile(0, 0, 40 + GROW_HOURS.carrot - WET_HOURS - 1, dry).crop).toBe('carrot');
    expect(plotStage(Farm.plotTile(0, 0, 40 + GROW_HOURS.carrot - WET_HOURS - 1, dry))).toBe('young');
    expect(plotStage(Farm.plotTile(0, 0, 40 + GROW_HOURS.carrot - WET_HOURS, dry))).toBe('ripe');
  });

  it('cabbages take longer than roots', () => {
    expect(GROW_HOURS.cabbage).toBeGreaterThan(GROW_HOURS.carrot);
    Farm.dig(0, 0, 0);
    Farm.sow(0, 0, 'cabbage', 0, dry);
    Farm.water(0, 0, 0, dry);
    Farm.water(0, 0, 24, dry);
    expect(plotStage(Farm.plotTile(0, 0, 48, dry))).toBe('young');
    expect(hoursToRipe(Farm.plotTile(0, 0, 48, dry))).toBeCloseTo(GROW_HOURS.cabbage - 48);
  });

  it('is watered by the rain, even while nobody is there', () => {
    Farm.dig(0, 0, 0);
    Farm.sow(0, 0, 'turnip', 0, dry);
    // Rain from 10:00 to 12:00 on the first day keeps the soil damp until noon the next.
    const rain = rainBetween(10, 12);
    const tile = Farm.plotTile(0, 0, 60, rain);
    expect(tile.wetUntil).toBeCloseTo(12 + WET_HOURS - 0.5);
    expect(tile.grown).toBeCloseTo(tile.wetUntil - 10);
  });

  it('drizzle counts, but cloud does not', () => {
    const tile: PlotTile = { dug: true, crop: 'carrot', grown: 0, wetUntil: -Infinity, checked: 0 };
    advancePlot(tile, 5, () => 0.1);
    expect(tile.grown).toBe(0);
    advancePlot(tile, 6, () => 0.3);
    expect(tile.grown).toBeGreaterThan(0);
  });

  it('picking a ripe crop gives its yield and leaves the ground dug and empty', () => {
    Farm.dig(2, 2, 0);
    Farm.sow(2, 2, 'turnip', 0, dry);
    expect(Farm.harvest(2, 2, 1, dry)).toBeUndefined();
    const wet = () => 1;
    expect(Farm.harvest(2, 2, GROW_HOURS.turnip + 1, wet)).toEqual({ item: 'turnip', count: PLOT_YIELD.turnip });
    const tile = Farm.plotTile(2, 2, GROW_HOURS.turnip + 1, wet);
    expect(tile.dug).toBe(true);
    expect(tile.crop).toBeUndefined();
    expect(Farm.harvest(2, 2, GROW_HOURS.turnip + 2, wet)).toBeUndefined();
  });

  it('is saved with the game, and old saves without a plot still load', () => {
    Farm.dig(5, 6, 0);
    Farm.sow(5, 6, 'cabbage', 0, dry);
    Farm.water(5, 6, 0, dry);
    const sections = SaveGame.collect();
    Farm.reset();
    SaveGame.restore({ sections } as unknown as SaveData);
    const tile = Farm.plotTile(5, 6, 10, dry);
    expect(tile.crop).toBe('cabbage');
    expect(tile.grown).toBeCloseTo(10);
    SaveGame.restore({ sections: { ...sections, farm: { picked: [], shaken: [] } } } as unknown as SaveData);
    expect(Farm.plotTile(5, 6, 10, dry).dug).toBe(false);
  });
});
