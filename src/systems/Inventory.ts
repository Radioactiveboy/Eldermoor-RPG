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

export interface ItemDef {
  name: string;
  /** A line or two of flavour, shown when the item is selected. */
  description: string;
  /** Icon texture (see art/items.ts). */
  icon: string;
  category: 'Food' | 'Material' | 'Clothing' | 'Tool';
  /** How many fit in one satchel slot. */
  stack: number;
  /** Gear: where it's worn and what it adds. */
  slot?: EquipSlot;
  defence?: number;
  attack?: number;
  /** Food: what eating it restores. */
  eat?: { health?: number; stamina?: number };
}

export const ITEMS = {
  carrot: {
    name: 'Carrot',
    description: 'Sweet and crunchy, pulled fresh from the garden.',
    icon: 'item-carrot',
    category: 'Food',
    stack: 20,
    eat: { stamina: 15 },
  },
  cabbage: {
    name: 'Cabbage',
    description: 'A firm green head. Mother makes a good soup from these.',
    icon: 'item-cabbage',
    category: 'Food',
    stack: 10,
    eat: { health: 4, stamina: 8 },
  },
  turnip: {
    name: 'Turnip',
    description: 'Peppery and tough. Better in a stew than raw.',
    icon: 'item-turnip',
    category: 'Food',
    stack: 20,
    eat: { stamina: 10 },
  },
  apple: {
    name: 'Apple',
    description: 'Shaken loose from an old tree. A little bruised, but sweet.',
    icon: 'item-apple',
    category: 'Food',
    stack: 20,
    eat: { health: 6, stamina: 6 },
  },
  bread: {
    name: 'Rye Bread',
    description: "Yesterday's loaf, wrapped in a cloth. Still good.",
    icon: 'item-bread',
    category: 'Food',
    stack: 10,
    eat: { health: 10, stamina: 25 },
  },
  pinecone: {
    name: 'Pinecone',
    description: 'Dry and resinous. It would make good kindling for the hearth.',
    icon: 'item-pinecone',
    category: 'Material',
    stack: 30,
  },
  stick: {
    name: 'Stout Stick',
    description: 'A fallen branch, straight enough to lean on.',
    icon: 'item-stick',
    category: 'Material',
    stack: 30,
  },
  'walking-staff': {
    name: 'Walking Staff',
    description: 'An old ash staff that has leaned by the door for years. Good for long walks.',
    icon: 'item-staff',
    category: 'Tool',
    stack: 1,
    slot: 'mainHand',
    attack: 2,
  },
  'straw-hat': {
    name: 'Straw Hat',
    description: 'Keeps the sun off while working in the garden.',
    icon: 'item-hat',
    category: 'Clothing',
    stack: 1,
    slot: 'head',
    defence: 1,
  },
  tunic: {
    name: 'Linen Tunic',
    description: 'Plain, patched at the elbows, and comfortable.',
    icon: 'item-tunic',
    category: 'Clothing',
    stack: 1,
    slot: 'body',
    defence: 1,
  },
  boots: {
    name: 'Leather Boots',
    description: 'Scuffed, but they keep the mud out.',
    icon: 'item-boots',
    category: 'Clothing',
    stack: 1,
    slot: 'feet',
    defence: 1,
  },
  'river-stone': {
    name: 'River Stone Charm',
    description: 'A smooth grey stone on a cord. Mother gave it to you when you were small.',
    icon: 'item-charm',
    category: 'Clothing',
    stack: 1,
    slot: 'trinket',
  },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

export function itemDef(id: ItemId): ItemDef {
  return ITEMS[id];
}

export interface Stack {
  id: ItemId;
  count: number;
}

export type InventoryEvent =
  | { type: 'added'; id: ItemId; count: number }
  | { type: 'changed' };

type Listener = (e: InventoryEvent) => void;

export const BAG_SIZE = 20;

class InventoryStore {
  /** Satchel slots; null is an empty slot. */
  bag: Array<Stack | null> = [];
  equipped: Partial<Record<EquipSlot, ItemId>> = {};
  private listeners: Listener[] = [];

  /** A new game: what the hero owns when they wake up. */
  reset(): void {
    this.bag = new Array(BAG_SIZE).fill(null);
    this.equipped = { body: 'tunic', feet: 'boots', trinket: 'river-stone' };
    this.bag[0] = { id: 'bread', count: 2 };
    this.bag[1] = { id: 'walking-staff', count: 1 };
    this.bag[2] = { id: 'straw-hat', count: 1 };
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
    const max = itemDef(id).stack;
    let room = 0;
    for (const s of this.bag) room += s === null ? max : s.id === id ? max - s.count : 0;
    return room >= count;
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
