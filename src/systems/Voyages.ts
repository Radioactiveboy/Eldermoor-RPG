import type { AreaId } from '../world/MapData';
import type { HeronTalk } from '../dialogue/jetty';
import { Inventory, ItemId } from './Inventory';
import { QuestLog } from './Quests';

/**
 * Travel by boat: Maren Tull's Grey Heron, which lies at Adowvale Jetty (see
 * world/JettyMap.ts), carrying the hero up and down the river Wend to places
 * too far to walk. She's laid up with a sprung plank until the hero helps
 * mend her (the 'fit-to-sail' quest, which Maren gives once the hero needs to
 * get to Gloomhaven); then she'll sail them there, and bring them home.
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

/** Set once the Heron is mended: she'll sail to Gloomhaven. */
export const GLOOMHAVEN_PASSAGE = 'passage-gloomhaven';
/** Set while the Heron lies at Gloomhaven's pier, having brought the hero down; cleared when they're back at the jetty. */
export const HERON_AWAY = 'heron-at-gloomhaven';
/** Hours home from Gloomhaven, against the stream. */
export const HOME_HOURS = 9;

/**
 * Every passage the Grey Heron makes from Adowvale Jetty. Gloomhaven is the first, open once she's
 * mended; Maren asks nothing for it, having been helped to mend her.
 */
export const VOYAGES: Voyage[] = [
  { to: 'gloomhaven', entry: 'heron', name: 'Gloomhaven', fare: 0, hours: 7, opens: GLOOMHAVEN_PASSAGE },
];

/** The three things that mend her, and how Maren names them while they're wanting. */
export const HERON_MENDING: ReadonlyArray<{ item: ItemId; wanting: string }> = [
  { item: 'oak-plank', wanting: 'a plank' },
  { item: 'oakum', wanting: 'the oakum' },
  { item: 'pitch-pail', wanting: 'the pitch' },
];

/** How the Heron stands, for Maren's talk. */
export function heronTalk(): HeronTalk {
  const quest = QuestLog.get('fit-to-sail');
  return {
    needsPassage: QuestLog.has('the-marsh-road'),
    stage: quest?.done.has('mend') ? 'mended' : quest ? 'mending' : 'laid-up',
    wanting: quest && !quest.done.has('mend') ? HERON_MENDING.filter((m) => Inventory.count(m.item) === 0).map((m) => m.wanting) : [],
  };
}

/** The passages open now, given the story so far. */
export function openVoyages(voyages: Voyage[] = VOYAGES, has: (flag: string) => boolean = (f) => QuestLog.hasFlag(f)): Voyage[] {
  return voyages.filter((v) => has(v.opens));
}
