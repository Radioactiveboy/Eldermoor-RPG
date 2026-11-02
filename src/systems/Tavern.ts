import { SaveGame } from './SaveGame';
import type { ItemId } from './Inventory';

/**
 * The Crooked Tankard: what's on the menu, and the room the hero has rented
 * upstairs. A room is let by the night, paid up front, and is the hero's until
 * checkout time on the morning after the last night (so it's somewhere to
 * sleep, pass the time, heal and save, like the bed at home).
 */

/** Rooms off the passage upstairs, numbered from 1. */
export const ROOM_COUNT = 4;
/** The hour a let ends on its last morning. */
export const CHECKOUT_HOUR = 11;

/** How long a room can be had for, and what Godric asks: cheaper by the night the longer you stay. */
export const RENT_OPTIONS: Array<{ nights: number; price: number; label: string }> = [
  { nights: 1, price: 6, label: 'One night' },
  { nights: 3, price: 15, label: 'Three nights' },
  { nights: 7, price: 30, label: 'A week' },
];

/** What can be had at the bar or from the maids, and what the hero thinks over it. */
export const MENU: Partial<Record<ItemId, { price: number; served: string; thought: string }>> = {
  ale: {
    price: 2,
    served: "One ale. Mind the froth, it's lively tonight.",
    thought: 'Cold, brown and bitter, with a head like a cloud. I could get used to this.',
  },
  cider: {
    price: 2,
    served: "Cider, love. Go steady: it's stronger than it looks.",
    thought: 'Sharp and cloudy and sweet at the back. My knees feel it already.',
  },
  mead: {
    price: 4,
    served: "A horn of mead. Godric's best, that.",
    thought: 'Honey and fire. It warms all the way down and keeps going.',
  },
  'spiced-wine': {
    price: 5,
    served: 'Spiced wine, warm from the fire. Careful, the cup is hot.',
    thought: 'Cloves and honey and something red underneath. It tastes like a feast day.',
  },
  stew: {
    price: 4,
    served: "Mutton stew, and a spoon. There's bread to mop it with.",
    thought: 'Thick, hot and salty, with barley and leeks. The best thing I have eaten in days.',
  },
  bread: {
    price: 3,
    served: "Bread, fresh from Hilde's this morning. Well, this afternoon.",
    thought: 'Rye bread, still soft. I tear it in half and eat both halves at once.',
  },
  cheese: {
    price: 4,
    served: 'A wedge of cheese, and an apple for the side.',
    thought: 'Hard, sharp and crumbly. It wants another ale with it.',
  },
};

/** Drinks served across the bar, in the order Godric lists them. */
export const BAR_DRINKS: ItemId[] = ['ale', 'cider', 'mead', 'spiced-wine'];
/** What the maids bring to the tables, asked for as "something to drink" or "something to eat". */
export const TABLE_DRINKS: ItemId[] = ['ale', 'cider', 'mead'];
export const TABLE_FOOD: ItemId[] = ['stew', 'bread', 'cheese'];

class TavernStore {
  /** The room let to the hero (1..ROOM_COUNT), if any. */
  room?: number;
  /** In-game hours (see TimeOfDay.elapsedHours) when the let runs out. */
  paidUntil = 0;

  reset(): void {
    this.room = undefined;
    this.paidUntil = 0;
  }

  /** Whether the hero has a room upstairs right now. */
  renting(now: number): boolean {
    return this.room !== undefined && now < this.paidUntil;
  }

  /** Nights of the let left to sleep (the night to come counts, until checkout). */
  nightsLeft(now: number): number {
    if (!this.renting(now)) return 0;
    return Math.max(1, Math.ceil((this.paidUntil - now) / 24));
  }

  /**
   * Let a room for some nights from now. A let already running is extended
   * (keeping the same room); otherwise a room is picked, and it's the hero's
   * until checkout on the morning after the last night.
   * @param hoursToCheckout hours from now until the next CHECKOUT_HOUR
   */
  rent(nights: number, now: number, hoursToCheckout: number): number {
    if (this.renting(now)) {
      this.paidUntil += nights * 24;
    } else {
      // (Godric picks the room when he offers it; see entities/Npc.ts.)
      this.room ??= 1 + Math.floor(Math.random() * ROOM_COUNT);
      // Taking a room in the small hours: tonight is the night still going, until checkout this morning.
      this.paidUntil = now + hoursToCheckout + (nights - 1) * 24;
      if (hoursToCheckout < 8) this.paidUntil += 24;
    }
    return this.room!;
  }
}

export const Tavern = new TavernStore();

SaveGame.register('tavern', {
  save: () => ({ room: Tavern.room, paidUntil: Tavern.paidUntil }),
  load(data) {
    Tavern.reset();
    const d = data as { room?: number; paidUntil?: number } | undefined;
    if (d?.room) {
      Tavern.room = d.room;
      Tavern.paidUntil = d.paidUntil ?? 0;
    }
  },
});
