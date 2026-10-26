import { SaveGame } from './SaveGame';

/**
 * What the hero carries and wears. Items are defined once in ITEMS; the
 * satchel is a fixed number of slots holding stacks of them, and each
 * equipment slot holds at most one item.
 */
export type EquipSlot = 'head' | 'body' | 'feet' | 'mainHand' | 'offHand' | 'trinket';

export const EQUIP_SLOTS: Array<{ id: EquipSlot; label: string }> = [
  { id: 'head', label: 'Head' },
  { id: 'body', label: 'Body' },
  { id: 'feet', label: 'Feet' },
  { id: 'mainHand', label: 'Main hand' },
  { id: 'offHand', label: 'Off hand' },
  { id: 'trinket', label: 'Trinket' },
];

export type ItemCategory = 'Food' | 'Material' | 'Clothing' | 'Tool' | 'Weapon' | 'Armour';

export interface ItemDef {
  name: string;
  /** A line or two of flavour, shown when the item is selected. */
  description: string;
  /** Icon texture (see art/items.ts). */
  icon: string;
  category: ItemCategory;
  /** How many fit in one satchel slot. */
  stack: number;
  /** Gear: where it's worn and what it adds. */
  slot?: EquipSlot;
  defence?: number;
  attack?: number;
  /** Food: what eating it restores. */
  eat?: { health?: number; stamina?: number };
  /** What it costs at a stall, in coins. Traders pay less to buy it (see systems/Shops.ts); no value means nobody will buy it. */
  value?: number;
}

export const ITEMS = {
  carrot: {
    name: 'Carrot',
    description: 'Sweet and crunchy, pulled fresh from the garden.',
    icon: 'item-carrot',
    category: 'Food',
    stack: 20,
    eat: { stamina: 15 },
    value: 1,
  },
  cabbage: {
    name: 'Cabbage',
    description: 'A firm green head. Mother makes a good soup from these.',
    icon: 'item-cabbage',
    category: 'Food',
    stack: 10,
    eat: { health: 4, stamina: 8 },
    value: 2,
  },
  turnip: {
    name: 'Turnip',
    description: 'Peppery and tough. Better in a stew than raw.',
    icon: 'item-turnip',
    category: 'Food',
    stack: 20,
    eat: { stamina: 10 },
    value: 1,
  },
  apple: {
    name: 'Apple',
    description: 'Shaken loose from an old tree. A little bruised, but sweet.',
    icon: 'item-apple',
    category: 'Food',
    stack: 20,
    eat: { health: 6, stamina: 6 },
    value: 1,
  },
  bread: {
    name: 'Rye Bread',
    description: "Yesterday's loaf, wrapped in a cloth. Still good.",
    icon: 'item-bread',
    category: 'Food',
    stack: 10,
    eat: { health: 10, stamina: 25 },
    value: 3,
  },
  pinecone: {
    name: 'Pinecone',
    description: 'Dry and resinous. It would make good kindling for the hearth.',
    icon: 'item-pinecone',
    category: 'Material',
    stack: 30,
    value: 1,
  },
  stick: {
    name: 'Stout Stick',
    description: 'A fallen branch, straight enough to lean on.',
    icon: 'item-stick',
    category: 'Material',
    stack: 30,
    value: 1,
  },
  'wolf-pelt': {
    name: 'Wolf Pelt',
    description: 'Thick grey fur, still smelling of the forest. Someone in the village might pay for this.',
    icon: 'item-pelt',
    category: 'Material',
    stack: 10,
    value: 12,
  },
  venison: {
    name: 'Venison',
    description: 'A haunch of red deer, wrapped in dock leaves. Rich and dark; Hilde would make a pie of it.',
    icon: 'item-venison',
    category: 'Food',
    stack: 10,
    eat: { health: 18, stamina: 10 },
    value: 8,
  },
  'deer-hide': {
    name: 'Deer Hide',
    description: "A red deer's hide, soft and supple once it's cured. Tamsin pays well for these.",
    icon: 'item-deerhide',
    category: 'Material',
    stack: 10,
    value: 16,
  },
  'hare-pelt': {
    name: 'Hare Pelt',
    description: 'A small brown pelt, soft as anything. Good for lining a pair of mittens.',
    icon: 'item-harepelt',
    category: 'Material',
    stack: 20,
    value: 4,
  },
  'boar-tusk': {
    name: 'Boar Tusk',
    description: 'A curved yellow tusk as long as your hand. It would make a fine knife handle, or a fine story.',
    icon: 'item-tusk',
    category: 'Material',
    stack: 20,
    value: 10,
  },
  'walking-staff': {
    name: 'Walking Staff',
    description: 'An old ash staff that has leaned by the door for years. Good for long walks.',
    icon: 'item-staff',
    category: 'Tool',
    stack: 1,
    slot: 'mainHand',
    attack: 2,
    value: 5,
  },
  'straw-hat': {
    name: 'Straw Hat',
    description: 'Keeps the sun off while working in the garden.',
    icon: 'item-hat',
    category: 'Clothing',
    stack: 1,
    slot: 'head',
    defence: 1,
    value: 3,
  },
  tunic: {
    name: 'Linen Tunic',
    description: 'Plain, patched at the elbows, and comfortable.',
    icon: 'item-tunic',
    category: 'Clothing',
    stack: 1,
    slot: 'body',
    defence: 1,
    value: 4,
  },
  boots: {
    name: 'Leather Boots',
    description: 'Scuffed, but they keep the mud out.',
    icon: 'item-boots',
    category: 'Clothing',
    stack: 1,
    slot: 'feet',
    defence: 1,
    value: 6,
  },
  'river-stone': {
    name: 'River Stone Charm',
    description: 'A smooth grey stone on a cord. Mother gave it to you when you were small.',
    icon: 'item-charm',
    category: 'Clothing',
    stack: 1,
    slot: 'trinket',
  },
  cheese: {
    name: 'Wedge of Cheese',
    description: 'Hard, crumbly and sharp, wrapped in a cloth. It keeps for weeks.',
    icon: 'item-cheese',
    category: 'Food',
    stack: 10,
    eat: { health: 8, stamina: 12 },
    value: 4,
  },
  'meat-pie': {
    name: 'Mutton Pie',
    description: 'Still warm from the oven, with gravy leaking through the crust.',
    icon: 'item-pie',
    category: 'Food',
    stack: 10,
    eat: { health: 20, stamina: 30 },
    value: 6,
  },
  'honey-cake': {
    name: 'Honey Cake',
    description: 'Sticky and sweet. The baker swears the honey is from her own hives.',
    icon: 'item-honeycake',
    category: 'Food',
    stack: 10,
    eat: { health: 6, stamina: 40 },
    value: 5,
  },
  'hunting-knife': {
    name: 'Hunting Knife',
    description: 'A plain blade with an antler grip. Made for skinning, but it will do in a pinch.',
    icon: 'item-knife',
    category: 'Weapon',
    stack: 1,
    slot: 'mainHand',
    attack: 3,
    value: 14,
  },
  'short-sword': {
    name: 'Short Sword',
    description: 'Good village steel, oiled and sharp. The smith says it has never been used, and it looks it.',
    icon: 'item-sword',
    category: 'Weapon',
    stack: 1,
    slot: 'mainHand',
    attack: 5,
    value: 40,
  },
  buckler: {
    name: 'Oak Buckler',
    description: 'A small round shield, rimmed with iron. Strapped to the forearm.',
    icon: 'item-buckler',
    category: 'Armour',
    stack: 1,
    slot: 'offHand',
    defence: 2,
    value: 16,
  },
  'iron-cap': {
    name: 'Iron Cap',
    description: 'A dented kettle helm like the militia wear. It rings when you knock on it.',
    icon: 'item-ironcap',
    category: 'Armour',
    stack: 1,
    slot: 'head',
    defence: 2,
    value: 18,
  },
  jerkin: {
    name: 'Leather Jerkin',
    description: 'Boiled leather, stiff and heavy, over a padded lining. Turns a bite or a blade.',
    icon: 'item-jerkin',
    category: 'Armour',
    stack: 1,
    slot: 'body',
    defence: 3,
    value: 28,
  },
  'wool-hood': {
    name: 'Wool Hood',
    description: 'Thick undyed wool with a short cape. Warm on a cold night.',
    icon: 'item-hood',
    category: 'Clothing',
    stack: 1,
    slot: 'head',
    defence: 1,
    value: 6,
  },
  'riding-boots': {
    name: 'Riding Boots',
    description: 'Tall boots of good oiled leather, laced to the knee.',
    icon: 'item-ridingboots',
    category: 'Clothing',
    stack: 1,
    slot: 'feet',
    defence: 2,
    value: 15,
  },
  'chicken-feed': {
    name: 'Sack of Chicken Feed',
    description: "Cracked corn and barley, a good heavy sackful. Farmer Iran's hens are waiting for it.",
    icon: 'item-feed',
    category: 'Material',
    stack: 5,
    value: 10,
  },
  egg: {
    name: "Hen's Egg",
    description: 'Brown and still faintly warm. Better boiled, but it will do raw in a pinch.',
    icon: 'item-egg',
    category: 'Food',
    stack: 20,
    eat: { health: 5, stamina: 10 },
    value: 2,
  },
  'silver-ring': {
    name: 'Tarnished Ring',
    description: "A silver ring, black with age, found among old bones in the wolves' den. It feels lucky.",
    icon: 'item-ring',
    category: 'Clothing',
    stack: 1,
    slot: 'trinket',
    defence: 1,
    value: 22,
  },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

export function itemDef(id: ItemId): ItemDef {
  return ITEMS[id];
}

/** What an item does, one line each, for item details ("Eat: +15 stamina", "Defence +1"). */
export function itemEffects(def: ItemDef): string[] {
  const lines: string[] = [];
  if (def.eat?.health) lines.push(`Eat: +${def.eat.health} health`);
  if (def.eat?.stamina) lines.push(`Eat: +${def.eat.stamina} stamina`);
  if (def.slot) lines.push(`Worn: ${EQUIP_SLOTS.find((s) => s.id === def.slot)!.label}`);
  if (def.defence) lines.push(`Defence +${def.defence}`);
  if (def.attack) lines.push(`Attack +${def.attack}`);
  return lines;
}

export interface Stack {
  id: ItemId;
  count: number;
}

export type InventoryEvent =
  | { type: 'added'; id: ItemId; count: number }
  /** Coins given as a reward, which the HUD shows floating up like a found item. */
  | { type: 'rewarded'; coins: number }
  | { type: 'changed' };

type Listener = (e: InventoryEvent) => void;

export const BAG_SIZE = 20;
/** Coins the hero has saved up at the start. */
const START_COINS = 15;

class InventoryStore {
  /** Satchel slots; null is an empty slot. */
  bag: Array<Stack | null> = [];
  equipped: Partial<Record<EquipSlot, ItemId>> = {};
  /** Money, in copper coins. Kept outside the satchel's slots. */
  coins = START_COINS;
  private listeners: Listener[] = [];

  /** A new game: what the hero owns when they wake up. */
  reset(): void {
    this.bag = new Array(BAG_SIZE).fill(null);
    this.equipped = { body: 'tunic', feet: 'boots', trinket: 'river-stone' };
    this.bag[0] = { id: 'bread', count: 2 };
    this.bag[1] = { id: 'walking-staff', count: 1 };
    this.bag[2] = { id: 'straw-hat', count: 1 };
    this.coins = START_COINS;
    this.emit({ type: 'changed' });
  }

  onChange(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  count(id: ItemId): number {
    return this.bag.reduce((n, s) => n + (s?.id === id ? s.count : 0), 0);
  }

  /** Room for `count` more of an item, topping up stacks before using empty slots. */
  canAdd(id: ItemId, count = 1): boolean {
    return this.room(id) >= count;
  }

  /** How many more of an item would fit. */
  room(id: ItemId): number {
    const max = itemDef(id).stack;
    let room = 0;
    for (const s of this.bag) room += s === null ? max : s.id === id ? max - s.count : 0;
    return room;
  }

  /** Takes `count` of an item out of the satchel (from the last stacks first), if there are that many. */
  remove(id: ItemId, count: number): boolean {
    if (this.count(id) < count) return false;
    let left = count;
    for (let i = this.bag.length - 1; i >= 0 && left > 0; i--) {
      const s = this.bag[i];
      if (s?.id !== id) continue;
      const n = Math.min(left, s.count);
      s.count -= n;
      left -= n;
      if (s.count === 0) this.bag[i] = null;
    }
    this.emit({ type: 'changed' });
    return true;
  }

  /** Coins given for a job done, announced on the HUD. */
  reward(coins: number): void {
    this.coins += coins;
    this.emit({ type: 'changed' });
    this.emit({ type: 'rewarded', coins });
  }

  /** Pays out or takes in coins. Returns false (changing nothing) if there isn't enough to pay. */
  addCoins(n: number): boolean {
    if (this.coins + n < 0) return false;
    this.coins += n;
    this.emit({ type: 'changed' });
    return true;
  }

  /** Adds items if they all fit; returns false (adding nothing) if the satchel is too full. */
  add(id: ItemId, count = 1): boolean {
    if (!this.canAdd(id, count)) return false;
    const max = itemDef(id).stack;
    let left = count;
    for (const s of this.bag) {
      if (left === 0) break;
      if (s?.id !== id || s.count >= max) continue;
      const n = Math.min(left, max - s.count);
      s.count += n;
      left -= n;
    }
    for (let i = 0; i < this.bag.length && left > 0; i++) {
      if (this.bag[i] !== null) continue;
      const n = Math.min(left, max);
      this.bag[i] = { id, count: n };
      left -= n;
    }
    this.emit({ type: 'added', id, count });
    this.emit({ type: 'changed' });
    return true;
  }

  /** Takes one item out of a satchel slot. */
  takeOne(index: number): ItemId | undefined {
    const s = this.bag[index];
    if (!s) return undefined;
    s.count--;
    if (s.count <= 0) this.bag[index] = null;
    this.emit({ type: 'changed' });
    return s.id;
  }

  /** Puts on the gear in a satchel slot; whatever was worn there goes back into that slot. */
  equip(index: number): boolean {
    const s = this.bag[index];
    const slot = s && itemDef(s.id).slot;
    if (!s || !slot) return false;
    const previous = this.equipped[slot];
    this.equipped[slot] = s.id;
    this.bag[index] = previous ? { id: previous, count: 1 } : null;
    this.emit({ type: 'changed' });
    return true;
  }

  /** Takes off what's worn in a slot and puts it in the satchel, if there's room. */
  unequip(slot: EquipSlot): boolean {
    const id = this.equipped[slot];
    if (!id) return false;
    const free = this.bag.indexOf(null);
    if (free < 0) return false;
    this.bag[free] = { id, count: 1 };
    delete this.equipped[slot];
    this.emit({ type: 'changed' });
    return true;
  }

  toSave(): { bag: Array<Stack | null>; equipped: Partial<Record<EquipSlot, ItemId>>; coins: number } {
    return { bag: this.bag.map((s) => s && { ...s }), equipped: { ...this.equipped }, coins: this.coins };
  }

  fromSave(data: ReturnType<InventoryStore['toSave']>): void {
    // Items that have since been taken out of the game are quietly dropped.
    const isItem = (id: unknown): id is ItemId => typeof id === 'string' && id in ITEMS;
    this.bag = new Array(BAG_SIZE).fill(null).map((_, i) => {
      const s = data.bag?.[i];
      return s && isItem(s.id) && s.count > 0 ? { id: s.id, count: s.count } : null;
    });
    this.equipped = {};
    for (const { id: slot } of EQUIP_SLOTS) {
      const id = data.equipped?.[slot];
      if (isItem(id)) this.equipped[slot] = id;
    }
    this.coins = typeof data.coins === 'number' ? data.coins : START_COINS;
    this.emit({ type: 'changed' });
  }

  /** Totals from everything worn. */
  get totals(): { defence: number; attack: number } {
    let defence = 0;
    let attack = 0;
    for (const id of Object.values(this.equipped)) {
      const def: ItemDef = ITEMS[id];
      defence += def.defence ?? 0;
      attack += def.attack ?? 0;
    }
    return { defence, attack };
  }

  private emit(e: InventoryEvent): void {
    for (const l of this.listeners) l(e);
  }
}

export const Inventory = new InventoryStore();
Inventory.reset();

SaveGame.register('inventory', {
  save: () => Inventory.toSave(),
  load(data) {
    Inventory.reset();
    if (data) Inventory.fromSave(data as ReturnType<InventoryStore['toSave']>);
  },
});
