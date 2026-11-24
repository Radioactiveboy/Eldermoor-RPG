import { QuestLog } from './Quests';
import { SaveGame } from './SaveGame';

/**
 * What the world thinks of the hero: a standing with each of the folk who
 * keep count (the village of Adowvale, the brothers of Saint Elda's, and the
 * village militia), and a memory of how each chance meeting on Adowvale
 * Plains was handled (paid the footpads, fought them, found the goat...), so
 * later conversations can mention it.
 *
 * Standing is a score from -100 to 100, read as a level (Distrusted to
 * Honoured). Adowvale's traders price their goods by it (systems/Shops.ts);
 * the militia pay bounties that raise it (systems/Bounties.ts); quests done
 * for each raise it too (QUEST_STANDING below).
 */
export type Faction = 'adowvale' | 'monastery' | 'militia';
export const FACTIONS: Record<Faction, { name: string }> = {
  adowvale: { name: 'Adowvale' },
  monastery: { name: "Saint Elda's" },
  militia: { name: 'The militia' },
};
export const FACTION_IDS = Object.keys(FACTIONS) as Faction[];

export type StandingLevel = 'distrusted' | 'stranger' | 'known' | 'liked' | 'honoured';

/** The lowest score for each level, best first. */
const LEVELS: Array<[StandingLevel, number]> = [
  ['honoured', 60],
  ['liked', 30],
  ['known', 10],
  ['stranger', -15],
  ['distrusted', -Infinity],
];

export const LEVEL_NAMES: Record<StandingLevel, string> = {
  distrusted: 'Distrusted',
  stranger: 'A stranger',
  known: 'Known',
  liked: 'Liked',
  honoured: 'Honoured',
};

/** The level a score reads as. */
export function levelOf(score: number): StandingLevel {
  return LEVELS.find(([, min]) => score >= min)![0];
}

/** How far up the levels it is: distrusted 0 ... honoured 4. */
export function levelRank(level: StandingLevel): number {
  return LEVELS.length - 1 - LEVELS.findIndex(([l]) => l === level);
}

export const MIN_SCORE = -100;
export const MAX_SCORE = 100;

/** What finishing each quest does for the hero's name. */
export const QUEST_STANDING: Partial<Record<string, Partial<Record<Faction, number>>>> = {
  'chicken-feed': { adowvale: 6 },
  'lost-sheep': { adowvale: 6 },
  'cellar-rats': { adowvale: 8 },
  'wolf-mother': { monastery: 30, militia: 12, adowvale: 10 },
  'mother-medicine': { monastery: 8 },
  // Down the goblins' hole on the Greyfells, and Mother brought home.
  'the-raid': { adowvale: 15, militia: 10, monastery: 5 },
};

/** The chance meetings on the plains (world/PlainsEvents.ts), and how each can end. */
export type RoadMeeting = 'footpads' | 'goat' | 'courier' | 'wolves';
/**
 * Footpads: paid them, had nothing to pay, scared them off, fought and beat
 * them, fled the fight, were beaten, or outran them. The goat: found. The
 * courier: fed. The night wolves: slain.
 */
export type RoadOutcome =
  | 'paid' | 'empty' | 'scared' | 'fought' | 'fled' | 'beaten' | 'outran'
  | 'found' | 'fed' | 'slain';

/** One way a meeting has ended, and how often. */
export interface Deed {
  how: RoadOutcome;
  /** In-game day it last happened. */
  day: number;
  times: number;
}

export type ReputationEvent =
  | { type: 'changed'; faction: Faction; delta: number; score: number; reason?: string }
  | { type: 'level'; faction: Faction; level: StandingLevel; rose: boolean };
type Listener = (e: ReputationEvent) => void;

class ReputationStore {
  private scores = new Map<Faction, number>();
  /** Every way each meeting has ended, keyed "meeting:how". */
  private deeds = new Map<string, Deed>();
  /** How each meeting last ended. */
  private lastDeed = new Map<RoadMeeting, RoadOutcome>();
  private listeners = new Set<Listener>();

  reset(): void {
    this.scores.clear();
    this.deeds.clear();
    this.lastDeed.clear();
  }

  score(faction: Faction): number {
    return this.scores.get(faction) ?? 0;
  }

  level(faction: Faction): StandingLevel {
    return levelOf(this.score(faction));
  }

  /** Raises (or with a negative amount, lowers) a standing. */
  gain(faction: Faction, amount: number, reason?: string): void {
    if (!amount) return;
    const before = this.score(faction);
    const after = Math.max(MIN_SCORE, Math.min(MAX_SCORE, before + amount));
    if (after === before) return;
    this.scores.set(faction, after);
    this.emit({ type: 'changed', faction, delta: after - before, score: after, reason });
    const was = levelOf(before);
    const now = levelOf(after);
    if (was !== now) this.emit({ type: 'level', faction, level: now, rose: after > before });
  }

  /** Several at once (a quest's or a bounty's reward). */
  gainAll(amounts: Partial<Record<Faction, number>>, reason?: string): void {
    for (const f of FACTION_IDS) if (amounts[f]) this.gain(f, amounts[f]!, reason);
  }

  /** Notes how a meeting on the plains ended. */
  record(meeting: RoadMeeting, how: RoadOutcome, day = QuestLog.dayProvider()): void {
    const key = `${meeting}:${how}`;
    const deed = this.deeds.get(key);
    this.deeds.set(key, { how, day, times: (deed?.times ?? 0) + 1 });
    this.lastDeed.set(meeting, how);
  }

  /** How a meeting last ended, if it ever has. */
  last(meeting: RoadMeeting): RoadOutcome | undefined {
    return this.lastDeed.get(meeting);
  }

  /** How many times a meeting has ended this way. */
  times(meeting: RoadMeeting, how: RoadOutcome): number {
    return this.deeds.get(`${meeting}:${how}`)?.times ?? 0;
  }

  toSave(): { scores: Partial<Record<Faction, number>>; deeds: Record<string, Deed>; last: Partial<Record<RoadMeeting, RoadOutcome>> } {
    return {
      scores: Object.fromEntries(this.scores),
      deeds: Object.fromEntries([...this.deeds].map(([k, d]) => [k, { ...d }])),
      last: Object.fromEntries(this.lastDeed),
    };
  }

  fromSave(data: Partial<ReturnType<ReputationStore['toSave']>>): void {
    this.reset();
    for (const f of FACTION_IDS) {
      const s = data.scores?.[f];
      if (typeof s === 'number') this.scores.set(f, Math.max(MIN_SCORE, Math.min(MAX_SCORE, s)));
    }
    for (const [k, d] of Object.entries(data.deeds ?? {})) if (d && typeof d.times === 'number') this.deeds.set(k, { ...d });
    for (const [m, how] of Object.entries(data.last ?? {})) if (how) this.lastDeed.set(m as RoadMeeting, how);
  }

  /** Calls fn on every change. Returns an unsubscribe function. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: ReputationEvent): void {
    this.listeners.forEach((fn) => fn(e));
  }
}

export const Reputation = new ReputationStore();

// Quests done for folk raise the hero's name with them. (Loading a save is quiet, so nothing is counted twice.)
QuestLog.onChange((e) => {
  if (e.type !== 'completed') return;
  const reward = QUEST_STANDING[e.quest.def.id];
  if (reward) Reputation.gainAll(reward, e.quest.def.title);
});

SaveGame.register('reputation', {
  save: () => Reputation.toSave(),
  load(data) {
    Reputation.reset();
    if (data) Reputation.fromSave(data as Partial<ReturnType<typeof Reputation.toSave>>);
  },
});
