import type { ItemId } from './Inventory';

/** What a search turned up: some coins, an item, or nothing, and what the hero thinks of it. */
export interface Find {
  coins?: number;
  item?: ItemId;
  text: string;
}

interface Drop {
  weight: number;
  roll: () => Find;
}

const between = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

/**
 * What can turn up under the bones in the wolves' den: the leavings of
 * travellers and drovers who didn't make it out. Mostly nothing or a few
 * coppers; now and then something worth having.
 */
const BONES: Drop[] = [
  { weight: 32, roll: () => ({ text: 'Just bones, gnawed clean. Nothing worth taking.' }) },
  { weight: 30, roll: () => ({ coins: between(2, 8), text: 'Under the bones, a rotted purse with a few coppers still in it.' }) },
  { weight: 12, roll: () => ({ item: 'stick', text: 'Half a walking stick, chewed at one end. Still sound.' }) },
  { weight: 8, roll: () => ({ item: 'hunting-knife', text: "A hunting knife, dropped by someone who didn't make it out." }) },
  { weight: 6, roll: () => ({ item: 'iron-cap', text: "A dented iron cap. Its owner won't be needing it now." }) },
  { weight: 6, roll: () => ({ item: 'silver-ring', text: 'Something glints between the ribs: a tarnished silver ring.' }) },
  { weight: 4, roll: () => ({ coins: between(15, 25), text: "A leather pouch, heavy with coin! Someone's savings, lost to the wolves." }) },
  { weight: 2, roll: () => ({ item: 'short-sword', text: 'A short sword, half buried in the bones. The blade is still keen.' }) },
];

/**
 * What the last watch left in their chest in the old watchtower, when they were
 * called down: nothing much, but always something.
 */
const CACHE: Drop[] = [
  { weight: 30, roll: () => ({ item: 'spear', text: 'Wrapped in oiled sacking at the bottom, a spear the rust never got to. Someone looked after this one.' }) },
  { weight: 25, roll: () => ({ item: 'iron-cap', text: 'An iron cap, a watchman\'s, wrapped in a mouldy cloak. A rub of the sleeve and it will serve.' }) },
  { weight: 20, roll: () => ({ item: 'buckler', text: 'A little round buckler under a rotted cloak. The leather is gone, but the iron is sound.' }) },
  { weight: 25, roll: () => ({ coins: between(12, 30), text: 'A purse of the watch\'s pay, never spent: old pennies, with a king\'s head nobody remembers.' }) },
];

const TABLES = { bones: BONES, cache: CACHE };

/** What the hero thinks when there's something to find but no room for it. */
export const NO_ROOM: Record<keyof typeof TABLES, string> = {
  bones: 'There is something under the bones, but my satchel is full.',
  cache: 'There is something in the chest, but my satchel is full.',
};

/** Rolls once on a loot table. */
export function rollLoot(table: keyof typeof TABLES): Find {
  const drops = TABLES[table];
  let r = Math.random() * drops.reduce((sum, d) => sum + d.weight, 0);
  for (const d of drops) {
    r -= d.weight;
    if (r < 0) return d.roll();
  }
  return drops[0].roll();
}
