import { QuestLog } from './Quests';
import { SaveGame } from './SaveGame';

/**
 * Experience and levels. The hero earns XP for slaying beasts, for each step
 * of a quest and for finishing one, and for finding new places. Enough XP
 * raises their level, and each level makes them tougher: more health, and
 * every other level a better aim, every third level harder hits.
 *
 * Game code only says `Experience.gain(amount, why)`; the HUD listens for
 * gains and level-ups to show them.
 */
export const MAX_LEVEL = 20;
/** Extra maximum health for each level above 1. */
export const HEALTH_PER_LEVEL = 10;

/** XP for each step of a quest (beyond the first conversation), and for finding an area the first time. */
export const XP_REWARDS = {
  objective: 20,
  discovery: 25,
};

/**
 * Total XP needed to reach a level: 100 for level 2, 250 for 3, 450 for 4,
 * 700 for 5... each level asks a little more than the last.
 */
export function xpForLevel(level: number): number {
  return 25 * (level - 1) * (level + 2);
}

export type ExperienceEvent =
  | { type: 'gained'; amount: number; reason: string }
  | { type: 'levelled'; level: number; from: number };

type Listener = (e: ExperienceEvent) => void;

class ExperienceStore {
  private total = 0;
  private listeners = new Set<Listener>();

  /** Back to level 1, for a new game. */
  reset(): void {
    this.total = 0;
  }

  get xp(): number {
    return this.total;
  }

  get level(): number {
    let level = 1;
    while (level < MAX_LEVEL && this.total >= xpForLevel(level + 1)) level++;
    return level;
  }

  /** How far through the current level: XP into it, XP the level spans, and 0-1 for a bar. Full at the top level. */
  get progress(): { into: number; span: number; fraction: number } {
    const level = this.level;
    if (level >= MAX_LEVEL) return { into: 0, span: 0, fraction: 1 };
    const into = this.total - xpForLevel(level);
    const span = xpForLevel(level + 1) - xpForLevel(level);
    return { into, span, fraction: into / span };
  }

  /** XP still needed for the next level (0 at the top level). */
  get toNext(): number {
    const level = this.level;
    return level >= MAX_LEVEL ? 0 : xpForLevel(level + 1) - this.total;
  }

  /** Extra maximum health from levels. */
  get healthBonus(): number {
    return (this.level - 1) * HEALTH_PER_LEVEL;
  }

  /** Added to attack rolls: +1 at levels 3, 5, 7... */
  get toHitBonus(): number {
    return Math.floor((this.level - 1) / 2);
  }

  /** Added to damage: +1 at levels 4, 7, 10... */
  get damageBonus(): number {
    return Math.floor((this.level - 1) / 3);
  }

  /** Earn some XP. `reason` is a few words for the HUD ("Grey Wolf", "Quest complete"). */
  gain(amount: number, reason: string): void {
    if (amount <= 0) return;
    const before = this.level;
    this.total += Math.round(amount);
    this.emit({ type: 'gained', amount: Math.round(amount), reason });
    const after = this.level;
    if (after > before) this.emit({ type: 'levelled', level: after, from: before });
  }

  /** Calls fn on every gain and level-up. Returns an unsubscribe function. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: ExperienceEvent): void {
    this.listeners.forEach((fn) => fn(e));
  }

  /** Puts the XP back from a save, quietly. */
  load(xp: number): void {
    this.total = Math.max(0, Math.round(xp));
  }
}

export const Experience = new ExperienceStore();

// Quests pay out as they go: a little for each step, and the quest's own reward at the end.
// (Loading a save restores the log without these events, so nothing is paid twice.)
QuestLog.onChange((e) => {
  if (e.type === 'progress') Experience.gain(XP_REWARDS.objective, e.quest.def.title);
  else if (e.type === 'completed') Experience.gain(e.quest.def.xp, `${e.quest.def.title} complete`);
});

SaveGame.register('experience', {
  save: () => ({ xp: Experience.xp }),
  load(data) {
    Experience.reset();
    const d = data as { xp?: number } | undefined;
    if (typeof d?.xp === 'number') Experience.load(d.xp);
  },
});
