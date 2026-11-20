/**
 * The days of Adowvale's three stallholders, by the clock: where Hilde the
 * baker, Osric the smith and Tamsin the tanner are at any hour. Their stalls
 * keep market hours (systems/MarketHours.ts), each with its own start; Hilde
 * and Osric slip back to the bakery and the smithy for a spell in the middle
 * of the day (the noon loaves, a job on the anvil), work there before the
 * market opens and after it shuts, and all three spend the evening in the
 * Crooked Tankard before bed. The world (entities/Npc.ts, and the maps) reads
 * this to put them in the right place; it has no Phaser in it, so it's tested
 * on its own.
 */
import { marketOpen } from './MarketHours';

/** The market's traders who keep a daily round. */
export type Villager = 'baker' | 'smith' | 'tanner';

/**
 * Where a villager is: behind their stall in the square, at work in their own
 * workshop (the bakery, the smithy), at the Crooked Tankard, or indoors at home
 * (asleep, or at their supper: either way out of sight).
 */
export type Whereabouts = 'stall' | 'workshop' | 'tavern' | 'home';

/** A stretch of the day, [from, to) in hours, where `to` may run past 24 into the small hours. */
type Stint = { from: number; to: number; at: Exclude<Whereabouts, 'stall'> };

interface VillagerDay {
  /** Hours after the others their stall opens and shuts (negative for earlier). */
  late: number;
  /** Spells away from the stall while the market is open, back at the workshop. */
  breaks: Stint[];
  /** Where they are while their stall is shut (anything not listed is home). */
  offHours: Stint[];
}

export const VILLAGER_DAYS: Record<Villager, VillagerDay> = {
  // Hilde is up before anyone: the first bake from half past three, the stall from half past six,
  // back to the ovens for the noon loaves, and the morning's dough set before a quiet drink and an early night.
  baker: {
    late: -0.5,
    breaks: [{ from: 11.5, to: 13, at: 'workshop' }],
    offHours: [
      { from: 3.5, to: 6.5, at: 'workshop' },
      { from: 17.5, to: 18.5, at: 'workshop' },
      { from: 18.5, to: 20.5, at: 'tavern' },
    ],
  },
  // Osric lights the forge at half past five, keeps the stall with a long spell at the anvil in the middle
  // of the day, works on for an hour and a half after the market shuts, then drinks till half past ten.
  smith: {
    late: 0,
    breaks: [{ from: 11, to: 14, at: 'workshop' }],
    offHours: [
      { from: 5.5, to: 7, at: 'workshop' },
      { from: 18, to: 19.5, at: 'workshop' },
      { from: 19.5, to: 22.5, at: 'tavern' },
    ],
  },
  // Tamsin has no workshop in the square (her tan-pits are out of town): the stall all day, the
  // Tankard straight after, and home at ten.
  tanner: {
    late: 0.25,
    breaks: [],
    offHours: [{ from: 18.25, to: 22, at: 'tavern' }],
  },
};

export const VILLAGERS = Object.keys(VILLAGER_DAYS) as Villager[];

export function isVillager(id: string): id is Villager {
  return Object.hasOwn(VILLAGER_DAYS, id);
}

/** Whether an hour falls in [from, to), where `to` may run past midnight (e.g. [18, 26] is 6pm to 2am). */
export function inHours(from: number, to: number, hour: number): boolean {
  const h = ((hour % 24) + 24) % 24;
  return (h >= from && h < to) || (h + 24 >= from && h + 24 < to);
}

/** Where a villager is at an hour of the day. */
export function whereabouts(id: Villager, hour: number): Whereabouts {
  const day = VILLAGER_DAYS[id];
  const h = ((hour % 24) + 24) % 24;
  if (marketOpen(h, day.late)) return day.breaks.find((s) => inHours(s.from, s.to, h))?.at ?? 'stall';
  return day.offHours.find((s) => inHours(s.from, s.to, h))?.at ?? 'home';
}

/** Which villagers are at a place at an hour (the smithy's or the bakery's keeper, the Tankard's evening crowd). */
export function villagersAt(at: Whereabouts, hour: number): Villager[] {
  return VILLAGERS.filter((id) => whereabouts(id, hour) === at);
}
