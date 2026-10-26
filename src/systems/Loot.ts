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

const TABLES = { bones: BONES };

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
