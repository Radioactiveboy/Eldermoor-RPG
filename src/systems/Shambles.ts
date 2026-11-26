/**
 * Where the Shambles' two stories stand (world/ShamblesMap.ts, dialogue/shambles.ts,
 * scenes/game/shambles.ts): "Answers to Nothing", Old Scritch's missing dog, and
 * "Pay or Swim", the Widow Thorne's three silver from Tam Rudd. All of it is kept
 * as quest flags, so it saves with the quests.
 */
import type { NothingHow, NothingStage, TamFate, WidowTam } from '../dialogue/shambles';
import { QuestLog } from './Quests';

export const NOTHING_QUEST = 'answers-to-nothing';
export const TAM_QUEST = 'pay-or-swim';

/** Flags set as the Shambles' two stories go (see scenes/game/shambles.ts). */
export const SHAMBLES_FLAGS = {
  /** Nothing is out of the barn and home with Scritch. */
  nothingFree: 'nothing-free',
  /** How: bought off Flay, fought for, or let out by Lugs. */
  nothingBought: 'nothing-bought',
  nothingFought: 'nothing-fought',
  nothingLugs: 'nothing-lugs',
  /** Lugs has left the Aprons to work for Scritch. */
  lugsApprentice: 'lugs-apprentice',
  /** Flay and Gristle were beaten in the pit barn. */
  pitFought: 'pit-fought',
  /** Tam Rudd is out of the loft: gone to work it off at the Rose, paid for, rowed away, or given up to Rendle. */
  tamGone: 'tam-gone',
  tamPotboy: 'tam-potboy',
  tamPaid: 'tam-paid',
  tamRowed: 'tam-rowed',
  tamSold: 'tam-sold',
} as const;

const F = SHAMBLES_FLAGS;
const has = (f: string) => QuestLog.hasFlag(f);

export const Shambles = {
  nothingStage(): NothingStage {
    if (QuestLog.get(NOTHING_QUEST)?.completed) return 'done';
    if (has(F.nothingFree)) return QuestLog.has(NOTHING_QUEST) ? 'free' : 'done';
    return QuestLog.has(NOTHING_QUEST) ? 'asked' : 'none';
  },
  nothingHow(): NothingHow {
    return has(F.nothingBought) ? 'bought' : has(F.nothingFought) ? 'fought' : has(F.nothingLugs) ? 'lugs' : undefined;
  },
  tamFate(): TamFate {
    if (has(F.tamPotboy)) return 'potboy';
    if (has(F.tamPaid)) return 'paid';
    if (has(F.tamRowed)) return 'rowed';
    if (has(F.tamSold)) return 'sold';
    return 'hiding';
  },
  /** The hero has seen Tam in the loft (so can tell Rendle where he is). */
  tamFound(): boolean {
    return has('tam-found');
  },
  widowTam(): WidowTam {
    const q = QuestLog.get(TAM_QUEST);
    if (!q) return 'none';
    if (q.completed) return 'done';
    return Shambles.tamFate() === 'hiding' ? 'asked' : 'report';
  },
};
