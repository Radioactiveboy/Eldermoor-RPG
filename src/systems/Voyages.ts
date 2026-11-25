import type { AreaId } from '../world/MapData';
import { QuestLog } from './Quests';

/**
 * Travel by boat: Maren Tull's Grey Heron, which lies at Adowvale Jetty (see
 * world/JettyMap.ts), carrying the hero up and down the river Wend to places
 * too far to walk. This is the hook for fast travel by river: nothing is open
 * yet, so the list below is empty, and Maren says so (dialogue/jetty.ts).
 *
 * To open a passage: add it here with the flag that opens it (set by a quest,
 * say), give its destination a landing (an area with an entry named 'heron'),
 * and Maren will offer it, at its fare and taking its hours, once the flag is set
 * (the `voyage:<area>` dialogue action; see scenes/game/voyages.ts).
 */
export interface Voyage {
  /** Where she sails to. */
  to: AreaId;
  /** The entry in the destination's map where the hero steps ashore. */
  entry: string;
  /** What Maren calls the place. */
  name: string;
  /** Coins for the passage. */
  fare: number;
  /** In-game hours the passage takes. */
  hours: number;
  /** The story flag that opens it, until which she won't sail there. */
  opens: string;
}

/**
 * Every passage the Grey Heron will ever make from Adowvale Jetty. Gloomhaven is the first, but nothing sets its
 * flag yet: the river isn't safe (see Maren's talk), and the story hasn't got there.
 */
export const VOYAGES: Voyage[] = [
  { to: 'gloomhaven', entry: 'heron', name: 'Gloomhaven', fare: 12, hours: 7, opens: 'passage-gloomhaven' },
];

/** The passages open now, given the story so far. */
export function openVoyages(voyages: Voyage[] = VOYAGES, has: (flag: string) => boolean = (f) => QuestLog.hasFlag(f)): Voyage[] {
  return voyages.filter((v) => has(v.opens));
}
