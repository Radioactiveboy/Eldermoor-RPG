import { QuestLog } from './Quests';

/**
 * The Reeve's toll house at Gloomhaven's Fen Gate (world/TollHouseMap.ts): what
 * the Flood Toll costs, the fee for a hearing upstairs, and how far the hero has
 * got with the two quests that run through it. Hobb Tallow's "The Flood Toll"
 * (the small traders squeezed out of business) and Captain Vosk's "The Reeve's
 * Silver" (where the Reeve's new money comes from). The second is the way to
 * finish the first: with the Reeve's true book in Vosk's hands, the Reeve backs down.
 */

export const FLOOD_TOLL_QUEST = 'flood-toll';
export const REEVE_SILVER_QUEST = 'reeve-silver';

/** Coins Nibb takes at the grille to put a name down for a hearing with the Reeve. */
export const HEARING_FEE = 2;

/** What Annet Marl gives for her creels back, and what Hobb Tallow gives when the toll comes off. */
export const ANNET_EELS = 3;
export const TALLOW_REWARD = 25;

/** The hours Gaff Tully keeps the stairs, and the Reeve is up (he sleeps from midnight till eight, wine-heavy). */
export const GAFF_HOURS: [number, number] = [7, 20];
export const REEVE_ASLEEP_UNTIL = 8;

export const TOLL_FLAGS = {
  /** Paid Nibb for a hearing: Gaff lets the hero up the stairs. */
  hearing: 'toll-hearing',
  /** The strongroom door is open to the hero (Lardy fed, or the key off its hook). */
  strongOpen: 'toll-strong-open',
  /** Took the strongroom key off the hook by the Reeve's bed. */
  hasKey: 'toll-key',
  /** Fed Lardy Mott at the strongroom door. */
  fedLardy: 'toll-fed-lardy',
  /** Read the Reeve's true book, and the letter signed V. */
  ledger: 'toll-ledger-read',
  letter: 'toll-letter-read',
  /** Looked in the coffer of foreign silver. */
  coffer: 'toll-coffer-seen',
  /** Took Annet's creels out of the strongroom, and gave them back. */
  creels: 'toll-creels',
  creelsBack: 'toll-creels-back',
  /** Nibb owned up to the second set of books. */
  nibbTold: 'toll-nibb-told',
  /** Heard the Reeve out, and his offer of work. */
  reeveHeard: 'toll-reeve-heard',
  /** Vosk has the Reeve's book, and the Reeve has backed down: the Flood Toll is off for the small folk. */
  lifted: 'toll-lifted',
} as const;

/** How Tallow's quest stands, for his talk. */
export type FloodTollStage = 'none' | 'active' | 'lifted' | 'done';

export function floodTollStage(): FloodTollStage {
  const q = QuestLog.get(FLOOD_TOLL_QUEST);
  if (!q) return 'none';
  if (q.completed) return 'done';
  return QuestLog.hasFlag(TOLL_FLAGS.lifted) ? 'lifted' : 'active';
}

/** How Vosk's quest stands, for his talk: not begun, looking, holding the proof, or done. */
export type ReeveSilverStage = 'none' | 'active' | 'proof' | 'done';

export function reeveSilverStage(): ReeveSilverStage {
  const q = QuestLog.get(REEVE_SILVER_QUEST);
  if (!q) return 'none';
  if (q.completed) return 'done';
  return QuestLog.hasFlag(TOLL_FLAGS.ledger) && QuestLog.hasFlag(TOLL_FLAGS.letter) ? 'proof' : 'active';
}

/** Marks a step done on a toll house quest, if it's under way (steps found before the quest are caught up when it starts). */
export function tollStep(quest: string, objective: string): void {
  if (QuestLog.has(quest)) QuestLog.complete(quest, objective);
}

/** The steps of each quest the hero has already done by the time it's given, from the flags. */
export function tollDoneAlready(quest: string): string[] {
  const f = (flag: string) => QuestLog.hasFlag(flag);
  if (quest === FLOOD_TOLL_QUEST) {
    return [
      'talk',
      ...(f(TOLL_FLAGS.reeveHeard) ? ['reeve'] : []),
      ...(f(TOLL_FLAGS.creelsBack) ? ['creels'] : []),
      ...(f(TOLL_FLAGS.lifted) ? ['lifted'] : []),
    ];
  }
  return [
    'talk',
    ...(f(TOLL_FLAGS.strongOpen) ? ['strong'] : []),
    ...(f(TOLL_FLAGS.ledger) ? ['ledger'] : []),
    ...(f(TOLL_FLAGS.letter) ? ['letter'] : []),
  ];
}
