import { beforeEach, describe, expect, it } from 'vitest';
import { compareItems, Inventory, itemDef, ITEMS, ItemId, satchelGroup } from '../../src/systems/Inventory';

beforeEach(() => Inventory.reset());

const ids = () => Inventory.bag.filter((s) => s !== null).map((s) => s!.id);

describe('satchel filter tabs', () => {
  it('puts every item under exactly one tab', () => {
    for (const id of Object.keys(ITEMS) as ItemId[]) expect(['food', 'gear', 'materials', 'quest']).toContain(satchelGroup(itemDef(id)));
  });

  it('sorts things by what they are for', () => {
    expect(satchelGroup(itemDef('bread'))).toBe('food');
    expect(satchelGroup(itemDef('healing-draught'))).toBe('food');
    expect(satchelGroup(itemDef('grilled-trout'))).toBe('food');
    expect(satchelGroup(itemDef('short-sword'))).toBe('gear');
    expect(satchelGroup(itemDef('fishing-rod'))).toBe('gear');
    expect(satchelGroup(itemDef('straw-hat'))).toBe('gear');
    expect(satchelGroup(itemDef('wolf-pelt'))).toBe('materials');
    expect(satchelGroup(itemDef('yarrow'))).toBe('materials');
  });

  it("files Mother's medicine and Iran's feed under Quest", () => {
    for (const id of ['moonpetal', 'willow-bark', 'fever-tincture', 'chicken-feed'] as ItemId[]) expect(satchelGroup(itemDef(id))).toBe('quest');
  });
});

describe('sorting the satchel', () => {
  beforeEach(() => {
    Inventory.add('wolf-pelt', 1);
    Inventory.add('moonpetal', 1);
    Inventory.add('short-sword', 1);
    Inventory.add('apple', 3);
  });

  it('by type: gear, then food, then materials, then quest things', () => {
    Inventory.sort('type');
    expect(ids()).toEqual(['short-sword', 'straw-hat', 'walking-staff', 'apple', 'bread', 'wolf-pelt', 'moonpetal']);
  });

  it('by value: dearest first, things nobody buys last', () => {
    Inventory.sort('value');
    const values = ids().map((id) => itemDef(id).value ?? -1);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
    expect(ids().at(-1)).toBe('moonpetal');
  });

  it('by name: A to Z', () => {
    Inventory.sort('name');
    const names = ids().map((id) => itemDef(id).name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('keeps every item and merges stacks whichever way it sorts', () => {
    Inventory.bag[15] = { id: 'apple', count: 2 };
    for (const by of ['type', 'value', 'name'] as const) {
      Inventory.sort(by);
      expect(Inventory.count('apple')).toBe(5);
      expect(Inventory.bag.filter((s) => s?.id === 'apple')).toHaveLength(1);
      expect(Inventory.count('moonpetal')).toBe(1);
    }
  });

  it('breaks ties by name', () => {
    expect(compareItems(itemDef('apple'), itemDef('bread'), 'type')).toBeLessThan(0);
  });
});
