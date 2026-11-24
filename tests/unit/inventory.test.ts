import { beforeEach, describe, expect, it } from 'vitest';
import { BAG_SIZE, compareGear, EQUIP_SLOTS, groupCounts, Inventory, InventoryEvent, itemDef, itemEffects } from '../../src/systems/Inventory';

beforeEach(() => Inventory.reset());

describe('a new game', () => {
  it('starts with bread, a staff, a hat and a few coins', () => {
    expect(Inventory.bag).toHaveLength(BAG_SIZE);
    expect(Inventory.count('bread')).toBe(2);
    expect(Inventory.count('walking-staff')).toBe(1);
    expect(Inventory.equipped).toEqual({ body: 'tunic', feet: 'boots', trinket: 'river-stone' });
    expect(Inventory.coins).toBe(15);
  });
});

describe('adding and stacking', () => {
  it('tops up an existing stack before using an empty slot', () => {
    Inventory.add('bread', 3);
    expect(Inventory.bag[0]).toEqual({ id: 'bread', count: 5 });
    expect(Inventory.bag.filter((s) => s?.id === 'bread')).toHaveLength(1);
  });

  it('spills over into new slots when a stack is full', () => {
    const max = itemDef('bread').stack;
    Inventory.add('bread', max);
    expect(Inventory.bag[0]).toEqual({ id: 'bread', count: max });
    expect(Inventory.bag.find((s, i) => i > 0 && s?.id === 'bread')).toEqual({ id: 'bread', count: 2 });
    expect(Inventory.count('bread')).toBe(max + 2);
  });

  it('adds nothing when it would not all fit', () => {
    const free = Inventory.bag.filter((s) => s === null).length;
    const max = itemDef('carrot').stack;
    expect(Inventory.room('carrot')).toBe(free * max);
    expect(Inventory.add('carrot', free * max + 1)).toBe(false);
    expect(Inventory.count('carrot')).toBe(0);
    expect(Inventory.add('carrot', free * max)).toBe(true);
    expect(Inventory.canAdd('carrot')).toBe(false);
  });

  it('tells listeners what was added', () => {
    const events: InventoryEvent[] = [];
    const off = Inventory.onChange((e) => events.push(e));
    Inventory.add('apple', 2);
    off();
    expect(events).toContainEqual({ type: 'added', id: 'apple', count: 2 });
  });

  it('removes from the last stacks first, and refuses to take more than there is', () => {
    Inventory.add('bread', 10); // 10 in slot 0, 2 in a later slot
    expect(Inventory.remove('bread', 3)).toBe(true);
    expect(Inventory.bag[0]).toEqual({ id: 'bread', count: 9 });
    expect(Inventory.remove('bread', 100)).toBe(false);
    expect(Inventory.count('bread')).toBe(9);
  });

  it('merges stacks when one is dropped on another, and swaps otherwise', () => {
    Inventory.bag[5] = { id: 'bread', count: 9 };
    Inventory.move(0, 5); // 2 onto 9: the stack holds 10, so 1 stays behind
    expect(Inventory.bag[5]).toEqual({ id: 'bread', count: 10 });
    expect(Inventory.bag[0]).toEqual({ id: 'bread', count: 1 });
    Inventory.move(1, 0); // the staff swaps with the bread
    expect(Inventory.bag[0]?.id).toBe('walking-staff');
    expect(Inventory.bag[1]).toEqual({ id: 'bread', count: 1 });
  });

  it('sorts by kind (clothing, tools, food, materials) and merges like with like', () => {
    Inventory.bag[7] = { id: 'bread', count: 1 };
    Inventory.bag[9] = { id: 'pinecone', count: 4 };
    Inventory.sort();
    expect(Inventory.bag.slice(0, 4)).toEqual([
      { id: 'straw-hat', count: 1 },
      { id: 'walking-staff', count: 1 },
      { id: 'bread', count: 3 },
      { id: 'pinecone', count: 4 },
    ]);
    expect(Inventory.bag).toHaveLength(BAG_SIZE);
  });
});

describe('equipment', () => {
  it('puts on gear and adds up what it gives', () => {
    const before = Inventory.totals;
    expect(Inventory.equip(1)).toBe(true); // the walking staff
    expect(Inventory.equipped.mainHand).toBe('walking-staff');
    expect(Inventory.bag[1]).toBeNull();
    expect(Inventory.totals.attack).toBe(before.attack + itemDef('walking-staff').attack!);
  });

  it('swaps what was worn back into the same slot', () => {
    Inventory.equip(1);
    Inventory.bag[1] = { id: 'short-sword', count: 1 };
    Inventory.equip(1);
    expect(Inventory.equipped.mainHand).toBe('short-sword');
    expect(Inventory.bag[1]).toEqual({ id: 'walking-staff', count: 1 });
  });

  it("won't wear food, and won't take gear off into a full satchel", () => {
    expect(Inventory.equip(0)).toBe(false);
    Inventory.add('pinecone', 30 * (BAG_SIZE - 3));
    expect(Inventory.unequip('body')).toBe(false);
    expect(Inventory.equipped.body).toBe('tunic');
  });

  it('has a place for every kind of gear, the ring on its own finger', () => {
    expect(EQUIP_SLOTS.map((s) => s.id)).toEqual(['head', 'neck', 'cloak', 'body', 'hands', 'ring', 'trinket', 'feet', 'mainHand', 'offHand']);
    Inventory.bag[3] = { id: 'silver-ring', count: 1 };
    expect(Inventory.equip(3)).toBe(true);
    expect(Inventory.equipped.ring).toBe('silver-ring');
    expect(Inventory.equipped.trinket).toBe('river-stone');
  });

  it('takes gear off into the satchel slot it was dropped on', () => {
    expect(Inventory.unequip('body', 7)).toBe(true);
    expect(Inventory.bag[7]).toEqual({ id: 'tunic', count: 1 });
    expect(Inventory.equipped.body).toBeUndefined();
  });

  it('dropped on something that fits, swaps the two', () => {
    Inventory.bag[5] = { id: 'riding-boots', count: 1 };
    expect(Inventory.unequip('feet', 5)).toBe(true);
    expect(Inventory.equipped.feet).toBe('riding-boots');
    expect(Inventory.bag[5]).toEqual({ id: 'boots', count: 1 });
  });

  it("dropped on something that doesn't fit, goes into the first empty slot", () => {
    expect(Inventory.unequip('body', 0)).toBe(true); // the bread's slot
    expect(Inventory.bag[0]).toEqual({ id: 'bread', count: 2 });
    expect(Inventory.bag[3]).toEqual({ id: 'tunic', count: 1 });
  });

  it('compares gear with what is worn in its place', () => {
    expect(compareGear(itemDef('short-sword'), itemDef('walking-staff'))).toEqual([{ label: 'Attack', from: '2', to: `${itemDef('short-sword').attack}`, better: 1 }]);
    expect(compareGear(itemDef('short-sword'), undefined)).toContainEqual({ label: 'Damage', from: 'd4', to: 'd6', better: 1 });
    expect(compareGear(itemDef('straw-hat'), itemDef('iron-cap'))).toEqual([{ label: 'Defence', from: `${itemDef('iron-cap').defence}`, to: '1', better: -1 }]);
    expect(compareGear(itemDef('bread'), undefined)).toEqual([]);
  });

  it("counts the satchel's slots by filter tab", () => {
    Inventory.add('dark-orb', 1);
    expect(groupCounts(Inventory.bag)).toEqual({ all: 4, food: 1, gear: 2, materials: 0, quest: 1 });
  });

  it('describes what an item does', () => {
    expect(itemEffects(itemDef('bread'))).toEqual(['Eat: +10 health', 'Eat: +25 stamina']);
    expect(itemEffects(itemDef('walking-staff'))).toContain('Worn: Main hand');
  });
});

describe('coins', () => {
  it("pays out, takes in, and won't go below nothing", () => {
    expect(Inventory.addCoins(-15)).toBe(true);
    expect(Inventory.coins).toBe(0);
    expect(Inventory.addCoins(-1)).toBe(false);
    expect(Inventory.coins).toBe(0);
  });

  it('announces a reward', () => {
    const events: InventoryEvent[] = [];
    const off = Inventory.onChange((e) => events.push(e));
    Inventory.reward(25);
    off();
    expect(Inventory.coins).toBe(40);
    expect(events).toContainEqual({ type: 'rewarded', coins: 25 });
  });
});

describe('saving', () => {
  it('round-trips and drops items that no longer exist', () => {
    Inventory.add('apple', 3);
    Inventory.equip(1);
    const data = Inventory.toSave();
    const copy = JSON.parse(JSON.stringify(data));
    copy.bag[10] = { id: 'removed-item', count: 2 };
    copy.equipped.offHand = 'removed-shield';
    Inventory.reset();
    Inventory.fromSave(copy);
    expect(Inventory.toSave()).toEqual(data);
  });

  it('moves a ring worn as a trinket in an older save onto the ring finger', () => {
    const data = Inventory.toSave();
    data.equipped = { body: 'tunic', trinket: 'silver-ring' };
    Inventory.fromSave(JSON.parse(JSON.stringify(data)));
    expect(Inventory.equipped).toEqual({ body: 'tunic', ring: 'silver-ring' });
  });
});
