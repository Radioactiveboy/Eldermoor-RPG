import { QuestLog } from './Quests';

/**
 * Lusk's pawnshop on Gloomhaven's square, and "Protection", the quest that
 * starts there: Abel Lusk fences what the Hooks (the waterfront gang) steal,
 * because they make him, at their price, and pays them for the privilege.
 * The hero spots Saint Elda's stolen bell in his shop, walks in on the Hooks
 * collecting of an evening, reads the black ledger Lusk keeps of everything
 * they've made him take, and then either helps him slip the leash (facing
 * Nim Dace down when he comes for the stash, with a fight or with what the
 * ledger says about Dace) or squeezes Lusk for a cut themselves.
 *
 * The quest's steps and the flags below are the whole of its state; the
 * scene side is in scenes/game/pawnshop.ts and the talk in dialogue/pawnshop.ts.
 */

export const PROTECTION_QUEST = 'protection';

export const PAWN_FLAGS = {
  /** Looked at Saint Elda's bell on the shop floor. */
  sawBell: 'pawn-saw-bell',
  /** Walked in on the Hooks collecting, and seen them off the premises. */
  sawCollection: 'pawn-saw-collection',
  /** Lusk has asked the hero upstairs, to see the black ledger. */
  upstairs: 'pawn-upstairs',
  /** Read the black ledger (and so know that Nim Dace skims from his own gang). */
  readLedger: 'pawn-read-ledger',
  /** Said they'd help Lusk: Dace comes for the stash tonight, after dark. */
  helping: 'pawn-helping',
  /** Squeezed Lusk for a cut, with what's in the ledger. */
  squeezed: 'pawn-squeezed',
  /** How the Hooks were seen off: in a fight, or faced down with Dace's own skimming. */
  fought: 'pawn-fought-hooks',
  bluffed: 'pawn-bluffed-dace',
  /** Lusk is free of the Hooks (for now), and has paid the hero for it. */
  freed: 'pawn-lusk-freed',
  /** Looked at the crate with the silver eye, under the roof. */
  sawEye: 'pawn-saw-eye',
  /** Lusk has said who the sealed crate is for. */
  toldOfEye: 'pawn-told-eye',
  /**
   * The Hooks owe the hero one: set when Dace and Orm were beaten in Lusk's shop,
   * for other parts of Gloomhaven to remember (see /gloomhaven-expansion/shared-cast.md).
   */
  hooksGrudge: 'hooks-grudge',
} as const;

/** What Lusk pays the hero: for seeing the Hooks off, and (with a smile) to keep his secrets. */
export const LUSK_REWARD = { fought: 30, bluffed: 40 };
export const LUSK_HUSH = 50;
/** The coins in the Hooks' purses, beaten: at least the first, up to the second. */
export const HOOKS_PURSE: [number, number] = [14, 26];

/** Lusk's hours behind his counter (he sleeps there, but he doesn't open the door to anyone after two). */
export const LUSK_HOURS: [number, number] = [9, 26];
/** When the Hooks come collecting, of an evening. */
export const COLLECTING_HOURS: [number, number] = [18, 23];
/** When Dace comes for the stash, the night the hero says they'll help. */
export const STASH_HOURS: [number, number] = [20, 26];

/** Where "Protection" stands, for the talk and for who's in the shop. */
export type ProtectionStage =
  /** Not yet begun (or begun and the bell not asked about). */
  | 'none'
  /** Asked about the bell: come back of an evening. */
  | 'evening'
  /** Seen the Hooks collect: talk to Lusk. */
  | 'talk'
  /** Lusk has asked the hero up to read the black ledger. */
  | 'ledger'
  /** Read it: help Lusk, or squeeze him. */
  | 'choose'
  /** Said they'd help: be there when Dace comes for the stash. */
  | 'stash'
  /** The Hooks seen off: back to Lusk to be paid. */
  | 'reward'
  /** Over, one way or another. */
  | 'done';

export function protectionStage(): ProtectionStage {
  const q = QuestLog.get(PROTECTION_QUEST);
  if (!q) return 'none';
  if (q.completed) return 'done';
  const done = (id: string) => q.done.has(id);
  if (!done('evening')) return 'evening';
  if (!done('talk')) return 'talk';
  if (!done('ledger')) return 'ledger';
  if (!done('choose')) return 'choose';
  if (!done('dace')) return 'stash';
  return 'reward';
}

/** How it ended, once it has: the Hooks fought, the Hooks faced down, or Lusk squeezed. */
export function protectionOutcome(): 'fought' | 'bluffed' | 'squeezed' | undefined {
  if (QuestLog.hasFlag(PAWN_FLAGS.squeezed)) return 'squeezed';
  if (QuestLog.hasFlag(PAWN_FLAGS.bluffed)) return 'bluffed';
  if (QuestLog.hasFlag(PAWN_FLAGS.fought)) return 'fought';
  return undefined;
}

/** Who's in the shop as things stand: the Hooks collecting of an evening, or come for the stash. */
export function pawnshopState(): { collecting: boolean; forTheStash: boolean } {
  const stage = protectionStage();
  return { collecting: stage === 'evening', forTheStash: stage === 'stash' };
}
