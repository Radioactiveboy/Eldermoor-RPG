import { SaveGame } from './SaveGame';
import type { ItemId } from './Inventory';

/**
 * The Black Rose, Gloomhaven's tavern: what the Widow Thorne pours, and the
 * room she lets upstairs. Like the Crooked Tankard's (systems/Tavern.ts), a
 * let is paid up front by the night and is the hero's until checkout on the
 * morning after the last night: somewhere to sleep, heal and save. There's
 * only the one room to let; the others are her lodgers', and they don't ask
 * questions either.
 */

/** The hour a let ends on its last morning. */
export const ROSE_CHECKOUT_HOUR = 10;

/** What the Widow asks for her room: cheaper than the Tankard, and you get what you pay for. */
export const ROSE_RENT: Array<{ nights: number; price: number; label: string }> = [
  { nights: 1, price: 4, label: 'One night' },
  { nights: 3, price: 10, label: 'Three nights' },
];

/** Coins Grubb wants to let a stranger through the curtain into the back room. */
export const BACK_ROOM_FEE = 5;
/** Coins Silas Crane plays his dice for. */
export const SILAS_STAKE = 3;
/** Coins for a drink for Hollis, who will talk for one. */
export const HOLLIS_DRINK = 2;

/** What's poured across the Rose's bar, what it's called here, and what the hero thinks of it. */
export const ROSE_MENU: Partial<Record<ItemId, { price: number; name: string; served: string; thought: string }>> = {
  ale: {
    price: 1,
    name: 'Black ale',
    served: 'Black ale. Brewed in the back. Don\'t ask what with.',
    thought: 'Thick and black and bitter as a funeral, with a taste of peat at the back. It stays down. Just.',
  },
  cider: {
    price: 2,
    name: 'Bog cider',
    served: 'Cider. From apples, mostly.',
    thought: 'Cloudy, sour and fizzing. There is something floating in it. I decide it is a pip.',
  },
  'spiced-wine': {
    price: 4,
    name: 'Mulled wine',
    served: 'Mulled. Keeps the marsh-chill out of your bones. Some of it.',
    thought: 'Hot, thin and heavy on the cloves, as if to hide what the wine was like before. It does warm me, though.',
  },
  stew: {
    price: 3,
    name: 'Eel stew',
    served: 'Eel stew. Out of the pot, onto the bread. Mind the bones.',
    thought: 'Grey and oily, eel and barley and pepper. I find a bone, then another. It is hot, and it is food.',
  },
};

/** Drinks across the bar, in the order the Widow lists them, and food. */
export const ROSE_DRINKS: ItemId[] = ['ale', 'cider', 'spiced-wine'];
export const ROSE_FOOD: ItemId[] = ['stew'];

/** Flags: through the curtain; Silas has taken the hero's coin with his loaded bones, and been caught; Hollis has told what was in his book. */
export const ROSE_FLAGS = {
  backOk: 'rose-back-friend',
  silasWon: 'rose-silas-won',
  silasCaught: 'rose-silas-caught',
  hollisBook: 'rose-hollis-book',
} as const;


class BlackRoseStore {
  /** In-game hours (see TimeOfDay.elapsedHours) when the let runs out; 0 if never let. */
  paidUntil = 0;

  reset(): void {
    this.paidUntil = 0;
  }

  /** Whether the room upstairs is the hero's right now. */
  renting(now: number): boolean {
    return now < this.paidUntil;
  }

  /** Nights of the let left to sleep (the night to come counts, until checkout). */
  nightsLeft(now: number): number {
    if (!this.renting(now)) return 0;
    return Math.max(1, Math.ceil((this.paidUntil - now) / 24));
  }

  /**
   * Let the room for some nights from now (a let already running is extended).
   * @param hoursToCheckout hours from now until the next ROSE_CHECKOUT_HOUR
   */
  rent(nights: number, now: number, hoursToCheckout: number): void {
    if (this.renting(now)) {
      this.paidUntil += nights * 24;
      return;
    }
    this.paidUntil = now + hoursToCheckout + (nights - 1) * 24;
    // Taken in the small hours: tonight is the night still going, until checkout this morning.
    if (hoursToCheckout < 8) this.paidUntil += 24;
  }
}

export const BlackRose = new BlackRoseStore();

SaveGame.register('blackrose', {
  save: () => ({ paidUntil: BlackRose.paidUntil }),
  load(data) {
    BlackRose.reset();
    const d = data as { paidUntil?: number } | undefined;
    if (d?.paidUntil) BlackRose.paidUntil = d.paidUntil;
  },
});
