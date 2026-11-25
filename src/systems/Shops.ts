import { ItemCategory, itemDef, ItemId, ITEMS } from './Inventory';
import { QuestLog } from './Quests';
import { Faction, Reputation, StandingLevel } from './Reputation';
import { SaveGame } from './SaveGame';

/**
 * The market's traders: what each one sells, what they'll buy, and how much
 * they pay. Prices start from each item's `value`: traders sell at about that
 * price and buy at a fraction of it (their `buyRate`). What you sell joins
 * their stock.
 *
 * Prices move: an item that's running short costs more and one they're
 * overstocked with costs less (and they pay less for more of it); each day
 * every price drifts a little; and Adowvale's traders give better terms to
 * someone the village thinks well of (systems/Reputation.ts). Whatever the
 * day, buying something always costs more than any trader pays for it.
 *
 * Each morning the stalls restock: what they started with is topped back up
 * a few at a time, and what they bought from the hero is sold on.
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
  /** Goods they never run short of: topped back up to this many (so an errand can always be done, even from an old save). */
  keeps?: Partial<Record<ItemId, number>>;
  /** Whose good opinion moves their prices (see systems/Reputation.ts); a stranger on the road cares for nobody's. */
  faction?: Faction;
}

export const SHOPS = {
  baker: {
    name: "Hilde's Bakehouse",
    keeper: 'baker',
    greeting: 'Fresh this morning, all of it. Well, most of it.',
    refuse: "Bless you, but I only deal in food, love.",
    thanks: ['Lovely. Mind, that pie is hot.', 'There you are, love.', "A pleasure. Come back tomorrow, there'll be buns."],
    stock: [['bread', 8], ['meat-pie', 4], ['honey-cake', 5], ['cheese', 4], ['apple', 10], ['chicken-feed', 3], ['carrot-seed', 6], ['turnip-seed', 6], ['cabbage-seed', 4]],
    buys: ['Food'],
    faction: 'adowvale',
    buyRate: 0.5,
    // Farmer Iran sends the hero here for feed (the 'chicken-feed' quest), and for seed for the plot he lends.
    keeps: { 'chicken-feed': 1, 'carrot-seed': 2, 'turnip-seed': 2, 'cabbage-seed': 1 },
  },
  smith: {
    name: "Osric's Forge",
    keeper: 'smith',
    greeting: 'Blades, helms, shields. Honest steel at honest prices. Mind the edges.',
    refuse: "Hm. Not my trade. Try one of the others.",
    thanks: ['Hm. Good.', 'Done.', "Keep it oiled and it'll keep you."],
    stock: [
      ['hunting-knife', 2], ['short-sword', 1], ['spear', 1], ['hatchet', 1], ['cudgel', 1], ['buckler', 2], ['iron-cap', 1],
      // Building goods from the yard behind the forge, for putting the Hollow right (systems/Homestead.ts).
      ['iron-nails', 4], ['timber', 12], ['dressed-stone', 10], ['slate', 20],
    ],
    buys: ['Weapon', 'Armour', 'Tool'],
    faction: 'adowvale',
    buyRate: 0.5,
    // Osric forges more as they sell (and this puts them on his rack in a game saved before they were made).
    // The yard's carted full again from the sawpit and the quarry as it empties.
    keeps: { spear: 1, hatchet: 1, cudgel: 1, 'iron-nails': 3, timber: 8, 'dressed-stone': 6, slate: 12 },
  },
  tanner: {
    name: "Tamsin's Leathers",
    keeper: 'tanner',
    greeting: "Good hides make good leather. Got any? I'll pay fair for pelts.",
    refuse: 'No use to me, that. Bring me hides.',
    thanks: ["Pleasure doing business.", "That'll wear well, you'll see.", 'Lovely bit of work, that.'],
    stock: [['jerkin', 1], ['wool-hood', 2], ['riding-boots', 1], ['boots', 1], ['sling', 1]],
    buys: ['Material', 'Clothing'],
    faction: 'adowvale',
    buyRate: 0.4,
    // Plaited from her offcuts, so she always has one (and an old save's stall gets it too).
    keeps: { sling: 1 },
    wants: { 'wolf-pelt': 0.75, 'deer-hide': 0.75 },
  },
  // Godric, at the Crooked Tankard's bar: drink and food to take away.
  tavern: {
    name: 'The Crooked Tankard',
    keeper: 'landlord',
    greeting: "Ale, cider, mead by the horn, and a bite to go with it. Bring the tankard back.",
    refuse: "What would I want with that? I run a tavern, friend.",
    thanks: ['Good health to you.', "There's plenty more where that came from.", "Don't drink it all at once. Or do. I'm not your mother."],
    stock: [['ale', 12], ['cider', 10], ['mead', 4], ['spiced-wine', 3], ['bread', 4], ['cheese', 3], ['meat-pie', 2]],
    buys: ['Food'],
    faction: 'adowvale',
    buyRate: 0.4,
    keeps: { ale: 3 },
  },
  // Wren, at the smokehouse on Adowvale Jetty (world/JettyMap.ts): smoked eel and fish off the river, and she'll take your catch.
  smokehouse: {
    name: 'Ebb\'s Smokehouse',
    keeper: 'wren',
    greeting: "Smoked eel, smoked pike, and anything else Grandad's caught. Don't squeeze them, they're not apples.",
    refuse: "That's not a fish! I only do fish. And eels. Eels are fish. Grandad says.",
    thanks: ['Thank you! Eat it with bread, it\'s best with bread.', "Pleasure doing business! That's what Maren says.", "Come back tomorrow, there'll be more. There's always more."],
    // And bundles of thatching reed, cut along the riverbank by the jetty folk and dried on the smokehouse rails.
    stock: [['smoked-eel', 8], ['baked-pike', 2], ['eel', 4], ['roach', 6], ['perch', 4], ['bread', 3], ['thatching-reed', 16]],
    buys: ['Food'],
    faction: 'adowvale',
    buyRate: 0.5,
    // River fish to smoke: she pays well for them.
    wants: { eel: 0.8, barbel: 0.75, grayling: 0.75, pike: 0.7 },
    keeps: { 'smoked-eel': 3, 'thatching-reed': 10 },
  },
  // The Widow Thorne, at the Black Rose's bar in Gloomhaven (world/BlackRoseMap.ts): drink and food to take away, and, for
  // those who know to ask, she'll take most things off your hands and not ask where they came from. Cheaply.
  blackrose: {
    name: 'The Black Rose',
    keeper: 'thorne',
    greeting: "Black ale, bog cider, eel, bread. And if you've anything to sell, put it on the bar, and I won't ask, and you won't tell.",
    refuse: "I'm not a midden. Take that away.",
    thanks: ["Mm.", "Don't mention where you got it. Not that you would.", 'Pleasure, I\'m sure.', 'Grubb. See them to the door.'],
    stock: [['ale', 10], ['cider', 6], ['spiced-wine', 2], ['stew', 3], ['smoked-eel', 5], ['bread', 4], ['hunting-knife', 1], ['wool-hood', 1], ['silver-ring', 1]],
    buys: ['Food', 'Material', 'Clothing', 'Tool', 'Weapon', 'Armour'],
    buyRate: 0.35,
    keeps: { ale: 3 },
  },
  // Jory, a travelling tinker met now and then on the Lord's Road (see world/PlainsEvents.ts): odds and ends, and he'll buy most anything, cheaply.
  tinker: {
    name: "Jory's Pack",
    keeper: 'tinker',
    greeting: "Pots, pans, knives, needles, and a ring I'm fairly sure is silver. Have a rummage.",
    refuse: "Even I can't sell that, friend.",
    thanks: ['Clank clank, a pleasure.', "That'll see you right. Or I'll mend it free next time.", 'Done and dusted!'],
    stock: [['hunting-knife', 1], ['sling', 1], ['cudgel', 1], ['buckler', 1], ['wool-hood', 1], ['walking-staff', 1], ['silver-ring', 1], ['honey-cake', 3], ['cheese', 2], ['mead', 2]],
    buys: ['Food', 'Material', 'Clothing', 'Tool', 'Weapon', 'Armour'],
    buyRate: 0.3,
  },
  // Gloomhaven, round the square (world/GloomhavenMap.ts, dialogue/gloomhaven.ts). Nobody's good opinion moves their prices.
  // Mother Ossery's Remedies: draughts and tinctures, the herbs to make them, and she pays well for wolfsbane.
  apothecary: {
    name: "Ossery's Remedies",
    keeper: 'ossery',
    greeting: "Mind the jars, dear. That one bites. Everything here will cure you, if you take the right amount.",
    refuse: "What would I do with that, dear? Bring me herbs, or something that grew.",
    thanks: ['Two drops in water, dear, not the whole bottle.', "There. Don't come back sicker.", 'Mind it doesn\'t freeze. Or boil. Or get wet.'],
    stock: [['healing-draught', 4], ['stamina-tonic', 3], ['fever-tincture', 5], ['wolfsbane-oil', 1], ['stout-draught', 2], ['yarrow', 3], ['comfrey', 3], ['sage', 2]],
    buys: ['Potion', 'Material'],
    buyRate: 0.45,
    wants: { wolfsbane: 0.8, moonpetal: 0.75, nettle: 0.7 },
    keeps: { 'fever-tincture': 2 },
  },
  // Hobb Tallow's chandlery: what a fisher, a boatman or a traveller on the fen needs, and a bite to keep them going.
  chandler: {
    name: "Tallow's Chandlery",
    keeper: 'tallow',
    greeting: "Rope, line, hooks, boots, a hood for the fog and a hatchet for the reeds. Candles I'll give you, if you buy something else.",
    refuse: "Can't sell that on, friend. Folk here want what keeps them dry and fed.",
    thanks: ['Hah! Done.', 'That\'ll see you through the wet. Some of it.', 'Light your way, friend.'],
    stock: [['fishing-rod', 2], ['hatchet', 1], ['spade', 2], ['wool-hood', 2], ['boots', 2], ['walking-staff', 1], ['bread', 4], ['cheese', 3], ['ale', 6]],
    buys: ['Tool', 'Clothing', 'Food'],
    buyRate: 0.4,
    keeps: { 'fishing-rod': 1 },
  },
  // Abel Lusk's: anything at all, bought cheap with no questions, and sold dear the same way.
  pawnbroker: {
    name: "Lusk's",
    keeper: 'lusk',
    greeting: "Have a look. Touch nothing you don't intend to buy. Everything is exactly what it appears to be. Mostly.",
    refuse: "Even I have standards. Not many. That falls below them.",
    thanks: ['A pleasure, as ever.', 'Our secret.', "I'll remember you. Fondly, for now."],
    stock: [['silver-ring', 2], ['hunting-knife', 2], ['cudgel', 1], ['buckler', 1], ['iron-cap', 1], ['jerkin', 1], ['short-sword', 1], ['riding-boots', 1], ['old-boot', 3]],
    buys: ['Food', 'Potion', 'Material', 'Clothing', 'Tool', 'Weapon', 'Armour'],
    buyRate: 0.28,
    // Things that are small and keep their worth, he pays a little over the odds for.
    wants: { 'silver-ring': 0.5, 'white-hide': 0.45 },
  },
} satisfies Record<string, ShopDef>;

export type ShopId = keyof typeof SHOPS;

export interface ShopStack {
  id: ItemId;
  count: number;
}

// ------------------------------------------------------------ prices

/** How a trader's opinion of the hero (their standing with the trader's folk) moves what they charge and pay. */
export const STANDING_TERMS: Record<StandingLevel, { sell: number; buy: number }> = {
  distrusted: { sell: 1.15, buy: 0.85 },
  stranger: { sell: 1, buy: 1 },
  known: { sell: 0.95, buy: 1.04 },
  liked: { sell: 0.9, buy: 1.08 },
  honoured: { sell: 0.85, buy: 1.12 },
};

/** How far a price may drift in a day, either way (as a fraction). */
export const DAILY_DRIFT = 0.08;
/** However the market moves, a trader charges at least this much of an item's value... */
export const MIN_PRICE = 0.8;
export const MAX_PRICE = 1.45;
/** ...and never pays more than this much of it (or this, for the things they really want). */
export const MAX_OFFER = 0.62;
export const MAX_WANTED_OFFER = 0.9;

/** A steady number in [-1, 1) for a stall, an item and a day: the day's drift. */
export function drift(shop: string, id: string, day: number): number {
  let h = 2166136261;
  for (const ch of `${shop}|${id}|${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

/**
 * How short or overstocked a stall is of something, as a price factor: more
 * than 1 when they have fewer than they usually keep, less when they've more.
 * @param usual how many they keep when fully stocked (0: not one of their own goods)
 */
export function supplyFactor(have: number, usual: number): number {
  if (usual <= 0) return clamp(1.1 - 0.05 * have, 0.85, 1.1);
  return clamp(1.25 - 0.25 * (have / usual), 0.85, 1.25);
}

/** What a stall charges for one, given its stock, the day's drift, and how it regards the hero. */
export function sellPrice(value: number, have: number, usual: number, drifted: number, level: StandingLevel = 'stranger'): number {
  if (value <= 0) return 0;
  const f = supplyFactor(have, usual) * STANDING_TERMS[level].sell * (1 + DAILY_DRIFT * drifted);
  return Math.max(1, Math.round(value * clamp(f, MIN_PRICE, MAX_PRICE)));
}

/** What a stall pays for one: less once it already has plenty, more from a friend. */
export function buyPrice(value: number, rate: number, have: number, usual: number, drifted: number, level: StandingLevel = 'stranger', wanted = false): number {
  if (value <= 0) return 0;
  const glut = clamp(1.1 - 0.1 * (have / Math.max(1, usual)), 0.7, 1.1);
  const f = glut * STANDING_TERMS[level].buy * (1 + (DAILY_DRIFT / 2) * drifted);
  const cap = wanted ? MAX_WANTED_OFFER : MAX_OFFER;
  return Math.max(1, Math.floor(value * Math.min(rate * f, cap)));
}

// ------------------------------------------------------------ restocking

/** How many the stall keeps of each of its own goods, when fully stocked. */
export function usualStock(shop: ShopId): Map<ItemId, number> {
  return new Map(SHOPS[shop].stock.map(([id, n]) => [id as ItemId, n]));
}

/**
 * A stall after `days` mornings: its own goods topped back up a third of the
 * way each morning (and any surplus sold off), and things bought from the
 * hero sold on, half each morning.
 */
export function restock(list: ShopStack[], usual: Map<ItemId, number>, days: number): ShopStack[] {
  const out = list.map((g) => ({ ...g }));
  for (const [id] of usual) if (!out.some((g) => g.id === id)) out.push({ id, count: 0 });
  for (let d = 0; d < Math.min(days, 7); d++) {
    for (const g of out) {
      const keep = usual.get(g.id) ?? 0;
      if (keep === 0) g.count = Math.floor(g.count / 2);
      else if (g.count < keep) g.count = Math.min(keep, g.count + Math.max(1, Math.ceil(keep / 3)));
      else if (g.count > keep) g.count -= Math.ceil((g.count - keep) / 2);
    }
  }
  return out.filter((g) => g.count > 0);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Each stall's goods as they are now, as stock is bought and sold. */
class ShopStore {
  private stock = new Map<ShopId, ShopStack[]>();
  /** The day each stall last restocked. */
  private stocked = new Map<ShopId, number>();
  /** The in-game day (the quest log's clock). */
  day: () => number = () => QuestLog.dayProvider();

  /** A new game: every stall back to its starting stock. */
  reset(): void {
    this.stock.clear();
    this.stocked.clear();
  }

  /** Only stalls that have been traded with; the rest still have their starting stock. */
  toSave(): { stock: Partial<Record<ShopId, ShopStack[]>>; stocked: Partial<Record<ShopId, number>> } {
    return {
      stock: Object.fromEntries([...this.stock].map(([shop, list]) => [shop, list.map((g) => ({ ...g }))])),
      stocked: Object.fromEntries(this.stocked),
    };
  }

  /** Reads a save back: this shape, or a save from before stalls restocked (just the stock, by stall). */
  fromSave(data: Partial<Record<string, unknown>>): void {
    this.reset();
    const stock = (data.stock && typeof data.stock === 'object' ? data.stock : data) as Partial<Record<string, ShopStack[]>>;
    const stocked = (data.stock ? data.stocked : undefined) as Partial<Record<string, number>> | undefined;
    for (const [shop, list] of Object.entries(stock)) {
      if (!(shop in SHOPS) || !Array.isArray(list)) continue;
      this.stock.set(shop as ShopId, list.filter((g) => g.id in ITEMS && g.count > 0).map((g) => ({ ...g })));
      // An old save's stalls count as stocked today.
      const day = stocked?.[shop];
      this.stocked.set(shop as ShopId, typeof day === 'number' ? day : this.day());
    }
  }

  def(shop: ShopId): ShopDef {
    return SHOPS[shop];
  }

  goods(shop: ShopId): ShopStack[] {
    const today = this.day();
    let list = this.stock.get(shop);
    if (!list) {
      list = SHOPS[shop].stock.map(([id, count]) => ({ id: id as ItemId, count }));
      this.stock.set(shop, list);
      this.stocked.set(shop, today);
    }
    const last = this.stocked.get(shop) ?? today;
    if (today > last) {
      list = restock(list, usualStock(shop), today - last);
      this.stock.set(shop, list);
    }
    this.stocked.set(shop, Math.max(last, today));
    const { keeps }: ShopDef = SHOPS[shop];
    for (const [id, min] of Object.entries(keeps ?? {}) as Array<[ItemId, number]>) {
      const have = list.find((g) => g.id === id)?.count ?? 0;
      if (have < min) this.put(shop, id, min - have, list);
    }
    return list;
  }

  /** How many of something are on the stall now. */
  count(shop: ShopId, id: ItemId): number {
    return this.goods(shop).find((g) => g.id === id)?.count ?? 0;
  }

  /** How the stall's keeper regards the hero. */
  standing(shop: ShopId): StandingLevel {
    const { faction }: ShopDef = SHOPS[shop];
    return faction ? Reputation.level(faction) : 'stranger';
  }

  /** What the trader charges for one. */
  price(shop: ShopId, id: ItemId): number {
    const usual = usualStock(shop).get(id) ?? 0;
    return sellPrice(itemDef(id).value ?? 0, this.count(shop, id), usual, drift(shop, id, this.day()), this.standing(shop));
  }

  /** What the trader pays for one, or 0 if they don't want it. Always less than they'd sell it back for. */
  offer(shop: ShopId, id: ItemId): number {
    const def: ShopDef = SHOPS[shop];
    const value = itemDef(id).value;
    if (!value || !def.buys.includes(itemDef(id).category)) return 0;
    const wanted = def.wants?.[id] !== undefined;
    const rate = def.wants?.[id] ?? def.buyRate;
    const usual = usualStock(shop).get(id) ?? 0;
    const pay = buyPrice(value, rate, this.count(shop, id), usual, drift(shop, id, this.day()), this.standing(shop), wanted);
    // Bought and sold straight back: never at a profit (their price for one more on the stall).
    const back = sellPrice(value, this.count(shop, id) + 1, usual, drift(shop, id, this.day()), this.standing(shop));
    return Math.max(1, Math.min(pay, back - 1));
  }

  /** How a price today compares with the item's value: 'dear', 'cheap' or 'fair', for the trading window. */
  trend(shop: ShopId, id: ItemId): 'dear' | 'cheap' | 'fair' {
    const value = itemDef(id).value ?? 0;
    if (!value) return 'fair';
    const ratio = this.price(shop, id) / value;
    return ratio >= 1.1 ? 'dear' : ratio <= 0.9 ? 'cheap' : 'fair';
  }

  take(shop: ShopId, id: ItemId, count: number): void {
    const list = this.goods(shop);
    const s = list.find((g) => g.id === id);
    if (!s) return;
    s.count -= count;
    if (s.count <= 0) list.splice(list.indexOf(s), 1);
  }

  put(shop: ShopId, id: ItemId, count: number, list = this.goods(shop)): void {
    const s = list.find((g) => g.id === id);
    if (s) s.count += count;
    else list.push({ id, count });
  }
}

export const Shops = new ShopStore();

SaveGame.register('shops', {
  save: () => Shops.toSave(),
  load(data) {
    Shops.reset();
    if (data) Shops.fromSave(data as Partial<Record<string, unknown>>);
  },
});
