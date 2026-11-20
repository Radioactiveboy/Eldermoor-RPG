import { beforeEach, describe, expect, it } from 'vitest';
import { Crafting, RECIPES } from '../../src/systems/Crafting';
import { BAG_SIZE, Inventory } from '../../src/systems/Inventory';

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;

beforeEach(() => {
  Inventory.reset();
  Crafting.reset();
});

describe('recipes', () => {
  it('only uses ingredients and stations that exist', () => {
    for (const r of RECIPES) {
      expect(['alchemy', 'cooking']).toContain(r.station);
      expect(r.needs.length).toBeGreaterThan(0);
      expect(r.stages.length).toBeGreaterThan(0);
    }
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  it('matches exactly what a recipe needs, in any order', () => {
    expect(Crafting.match('alchemy', ['willow-bark', undefined, 'moonpetal'])?.id).toBe('fever-tincture');
    expect(Crafting.match('cooking', ['turnip', 'raw-hare', 'carrot'])?.id).toBe('hare-stew');
  });

  it('matches nothing with something missing, something extra, or at the wrong station', () => {
    expect(Crafting.match('alchemy', ['moonpetal'])).toBeUndefined();
    expect(Crafting.match('alchemy', ['moonpetal', 'willow-bark', 'carrot'])).toBeUndefined();
    expect(Crafting.match('cooking', ['moonpetal', 'willow-bark'])).toBeUndefined();
    expect(Crafting.match('cooking', [undefined, undefined])).toBeUndefined();
    // Two hares are two hares, not the one a roast needs.
    expect(Crafting.match('cooking', ['raw-hare', 'raw-hare'])).toBeUndefined();
  });

  it('lists what each station will take', () => {
    expect(Crafting.ingredientsFor('alchemy')).toEqual(new Set(['moonpetal', 'willow-bark']));
  });
});

describe('making things', () => {
  it('uses up the ingredients and gives the result', () => {
    Inventory.add('raw-hare', 3);
    const roast = recipe('roast-hare');
    expect(Crafting.maxBatches(roast)).toBe(3);
    expect(Crafting.make(roast, 2)).toBe(true);
    expect(Inventory.count('raw-hare')).toBe(1);
    expect(Inventory.count('roast-hare')).toBe(2);
  });

  it("refuses when there isn't enough", () => {
    Inventory.add('moonpetal', 1);
    const tincture = recipe('fever-tincture');
    expect(Crafting.maxBatches(tincture)).toBe(0);
    expect(Crafting.make(tincture, 1)).toBe(false);
    expect(Inventory.count('moonpetal')).toBe(1);
  });

  it('counts a slot freed by the ingredients as room for the result', () => {
    Inventory.reset();
    Inventory.bag = new Array(BAG_SIZE).fill({ id: 'stick', count: 30 }).map((s) => ({ ...s }));
    Inventory.bag[0] = { id: 'raw-hare', count: 1 };
    expect(Crafting.maxBatches(recipe('roast-hare'))).toBe(1);
  });

  it('discovers an unknown recipe the first time it is made, and says so once', () => {
    const stew = recipe('hare-stew');
    expect(Crafting.isKnown(stew)).toBe(false);
    expect(Crafting.isKnown(recipe('roast-hare'))).toBe(true);
    const firsts: boolean[] = [];
    const off = Crafting.onMade((_r, _n, first) => firsts.push(first));
    Inventory.add('raw-hare', 2);
    Inventory.add('carrot', 2);
    Inventory.add('turnip', 2);
    Crafting.make(stew, 1);
    Crafting.make(stew, 1);
    off();
    expect(firsts).toEqual([true, false]);
    expect(Crafting.isKnown(stew)).toBe(true);
  });

  it('remembers discoveries in a save, forgetting recipes that no longer exist', () => {
    Crafting.fromSave({ made: ['hare-stew', 'removed-recipe'] });
    expect(Crafting.toSave()).toEqual({ made: ['hare-stew'] });
    Crafting.fromSave(undefined);
    expect(Crafting.toSave()).toEqual({ made: [] });
  });
});
