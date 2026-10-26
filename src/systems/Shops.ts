import { ItemCategory, itemDef, ItemId } from './Inventory';

/**
 * The market's traders: what each one sells, what they'll buy, and how much
 * they pay. Prices come from each item's `value`: traders sell at that price
 * and buy at a fraction of it (their `buyRate`), so selling something and
 * buying it back always costs a little. What you sell joins their stock.
 */
export interface ShopDef {
  /** Shown at the top of the trading window. */
  name: string;
  /** The NPC who keeps the stall (see entities/Npc.ts), for the portrait. */
  keeper: string;
  greeting: string;
  /** What they say to something they won't buy. */
  refuse: string;
  /** What they say after a sale, one picked at random. */
  thanks: string[];
  /** What's on the stall at the start of the game. */
  stock: Array<[ItemId, number]>;
  /** Kinds of thing they'll buy from you. */
  buys: ItemCategory[];
  /** Fraction of an item's value they pay for it. */
  buyRate: number;
  /** Things they pay over the odds for, as a fraction of value. */
  wants?: Partial<Record<ItemId, number>>;
}

export const SHOPS = {
  baker: {
    name: "Hilde's Bakehouse",
    keeper: 'baker',
    greeting: 'Fresh this morning, all of it. Well, most of it.',
    refuse: "Bless you, but I only deal in food, love.",
    thanks: ['Lovely. Mind, that pie is hot.', 'There you are, love.', "A pleasure. Come back tomorrow, there'll be buns."],
    stock: [['bread', 8], ['meat-pie', 4], ['honey-cake', 5], ['cheese', 4], ['apple', 10]],
    buys: ['Food'],
    buyRate: 0.5,
  },
  smith: {
    name: "Osric's Forge",
    keeper: 'smith',
    greeting: 'Blades, helms, shields. Honest steel at honest prices. Mind the edges.',
    refuse: "Hm. Not my trade. Try one of the others.",
    thanks: ['Hm. Good.', 'Done.', "Keep it oiled and it'll keep you."],
    stock: [['hunting-knife', 2], ['short-sword', 1], ['buckler', 2], ['iron-cap', 1]],
    buys: ['Weapon', 'Armour', 'Tool'],
    buyRate: 0.5,
  },
  tanner: {
    name: "Tamsin's Leathers",
    keeper: 'tanner',
    greeting: "Good hides make good leather. Got any? I'll pay fair for pelts.",
    refuse: 'No use to me, that. Bring me hides.',
    thanks: ["Pleasure doing business.", "That'll wear well, you'll see.", 'Lovely bit of work, that.'],
    stock: [['jerkin', 1], ['wool-hood', 2], ['riding-boots', 1], ['boots', 1]],
    buys: ['Material', 'Clothing'],
    buyRate: 0.4,
    wants: { 'wolf-pelt': 0.75 },
  },
} satisfies Record<string, ShopDef>;

export type ShopId = keyof typeof SHOPS;

export interface ShopStack {
  id: ItemId;
  count: number;
}

/** Each stall's goods as they are now, as stock is bought and sold. */
class ShopStore {
  private stock = new Map<ShopId, ShopStack[]>();

  /** A new game: every stall back to its starting stock. */
  reset(): void {
    this.stock.clear();
  }

  def(shop: ShopId): ShopDef {
    return SHOPS[shop];
  }

  goods(shop: ShopId): ShopStack[] {
    let list = this.stock.get(shop);
    if (!list) {
      list = SHOPS[shop].stock.map(([id, count]) => ({ id: id as ItemId, count }));
      this.stock.set(shop, list);
    }
    return list;
  }

  /** What the trader charges for one. */
  price(id: ItemId): number {
    return itemDef(id).value ?? 0;
  }

  /** What the trader pays for one, or 0 if they don't want it. */
  offer(shop: ShopId, id: ItemId): number {
    const def: ShopDef = SHOPS[shop];
    const value = itemDef(id).value;
    if (!value || !def.buys.includes(itemDef(id).category)) return 0;
    const rate = def.wants?.[id] ?? def.buyRate;
    return Math.max(1, Math.floor(value * rate));
  }

  take(shop: ShopId, id: ItemId, count: number): void {
    const list = this.goods(shop);
    const s = list.find((g) => g.id === id);
    if (!s) return;
    s.count -= count;
    if (s.count <= 0) list.splice(list.indexOf(s), 1);
  }

  put(shop: ShopId, id: ItemId, count: number): void {
    const list = this.goods(shop);
    const s = list.find((g) => g.id === id);
    if (s) s.count += count;
    else list.push({ id, count });
  }
}

export const Shops = new ShopStore();
