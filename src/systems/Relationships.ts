import type { ItemId } from './Inventory';
import { QuestLog } from './Quests';
import { SaveGame } from './SaveGame';

/**
 * What one person thinks of the hero, as against what a whole folk thinks
 * (systems/Reputation.ts): a bond with each of the people who keep count of
 * it, starting with the companions, Sigrun and Wat.
 *
 * A bond is a score from -100 to 100, read as a level (Resentful to
 * Trusted). It's raised by getting to know someone (asking about their life,
 * once each), by gifts they like (one a day), by tending their wounds, by
 * winning fights beside them, and by kind words; it's lowered by rude ones,
 * by prying before they know you, and by gifts they can't stand.
 *
 * It changes what they offer (Sigrun's price, a keepsake once they're close),
 * what the hero can ask them (the personal questions open up as they trust
 * you), how they talk to the hero, and how they fight beside them
 * ({@link bondCombatBonus}). Someone who has come to resent the hero won't
 * travel with them until it's mended ({@link willTravel}).
 *
 * To give someone a bond: add them to {@link BONDS}. The talk that goes with
 * it is in dialogue/companionTalk.ts.
 */

export type BondLevel = 'resentful' | 'wary' | 'acquainted' | 'friendly' | 'close' | 'trusted';

/** The lowest score for each level, best first. */
const LEVELS: Array<[BondLevel, number]> = [
  ['trusted', 75],
  ['close', 45],
  ['friendly', 20],
  ['acquainted', 0],
  ['wary', -30],
  ['resentful', -Infinity],
];

export const BOND_NAMES: Record<BondLevel, string> = {
  resentful: 'Resentful',
  wary: 'Wary',
  acquainted: 'Acquainted',
  friendly: 'Friendly',
  close: 'Close',
  trusted: 'Trusted',
};

/** The colour each level is written in (under a portrait, in the party screen). */
export const BOND_COLOURS: Record<BondLevel, string> = {
  resentful: '#e0705a',
  wary: '#d8a868',
  acquainted: '#d8ccb0',
  friendly: '#a8d88a',
  close: '#7fd0c0',
  trusted: '#f0d070',
};

export const MIN_BOND = -100;
export const MAX_BOND = 100;

export function bondLevelOf(score: number): BondLevel {
  return LEVELS.find(([, min]) => score >= min)![0];
}

/** How far up the levels it is: resentful 0 ... trusted 5. */
export function bondRank(level: BondLevel): number {
  return LEVELS.length - 1 - LEVELS.findIndex(([l]) => l === level);
}

/** Whether a level is at least another. */
export const atLeast = (level: BondLevel, min: BondLevel) => bondRank(level) >= bondRank(min);

/** How much a gift does for a bond, by how much they like it. */
export const GIFT_BOND = { loved: 8, liked: 4, plain: 1, disliked: -4 } as const;
export type GiftTaste = keyof typeof GIFT_BOND;
/** Tending someone's wounds (once a day). */
export const TEND_BOND = 3;
/** Winning a fight side by side, at most {@link FIGHTS_PER_DAY} times a day. */
export const FIGHT_BOND = 1;
export const FIGHTS_PER_DAY = 3;
/** Asking about someone's life, the first time, when they're ready to tell it. */
export const TOPIC_BOND = 3;
/** Prying before they know you well enough. */
export const PRY_BOND = -3;
/** Saying sorry, once a day, when they've cooled on the hero. */
export const SORRY_BOND = 10;

export interface BondDef {
  /** Their name, for the toasts ("Sigrun"). */
  short: string;
  /** Where the bond starts. Wat likes everyone; Sigrun likes nobody yet. */
  start: number;
  /** What they think of things given them; anything not listed is 'plain'. */
  tastes: Partial<Record<ItemId, Exclude<GiftTaste, 'plain'>>>;
  /** Once they're this close, they give the hero something, once (see dialogue/companionTalk.ts). */
  keepsake?: { at: BondLevel; item: ItemId; count: number };
}

export type BondId = 'sigrun' | 'wat';

export const BONDS: Record<BondId, BondDef> = {
  // An old sellsword: strong drink, red meat, and things that keep a blade sharp. Nothing sweet.
  sigrun: {
    short: 'Sigrun',
    start: 0,
    tastes: {
      mead: 'loved', 'spiced-wine': 'loved', 'roast-boar': 'loved', 'wolf-steak': 'loved', 'wolfsbane-oil': 'loved',
      ale: 'liked', 'meat-pie': 'liked', 'venison-steak': 'liked', 'smoked-eel': 'liked', 'hunters-pottage': 'liked', 'stout-draught': 'liked', 'healing-draught': 'liked',
      'honey-cake': 'disliked', carrot: 'disliked', 'old-boot': 'disliked', 'rat-tail': 'disliked',
    },
    keepsake: { at: 'close', item: 'wolfsbane-oil', count: 2 },
  },
  // A militia lad who's always hungry: sweet things, pies, anything his mother would make. Ale gets him in trouble.
  wat: {
    short: 'Wat',
    start: 12,
    tastes: {
      'honey-cake': 'loved', 'meat-pie': 'loved', 'roast-hare': 'loved', stew: 'loved',
      bread: 'liked', cheese: 'liked', apple: 'liked', cider: 'liked', 'boiled-egg': 'liked', 'hare-stew': 'liked', 'grilled-trout': 'liked', 'healing-draught': 'liked',
      ale: 'disliked', 'spiced-wine': 'disliked', 'rat-tail': 'disliked', 'old-boot': 'disliked', 'wolfsbane-oil': 'disliked',
    },
    keepsake: { at: 'friendly', item: 'meat-pie', count: 2 },
  },
};

export const BOND_IDS = Object.keys(BONDS) as BondId[];

export function hasBond(id: string): id is BondId {
  return Object.hasOwn(BONDS, id);
}

/** What someone thinks of a gift. */
export function tasteOf(id: BondId, item: ItemId): GiftTaste {
  return BONDS[id].tastes[item] ?? 'plain';
}

/**
 * How much better someone fights beside a friend: a little steadier aim once
 * friendly, and steadier still (and quicker to cover) once they trust you.
 */
export function bondCombatBonus(level: BondLevel): { toHit: number; ac: number } {
  if (level === 'trusted') return { toHit: 2, ac: 1 };
  if (level === 'friendly' || level === 'close') return { toHit: 1, ac: 0 };
  return { toHit: 0, ac: 0 };
}

/** What someone asks to come, by how they feel about the hero (Sigrun's fee). */
export function bondPrice(coins: number, level: BondLevel): number {
  if (coins <= 0) return 0;
  const share: Record<BondLevel, number> = { resentful: 2, wary: 1.5, acquainted: 1, friendly: 0.75, close: 0.5, trusted: 0 };
  return Math.round(coins * share[level]);
}

/** Someone who resents the hero won't come along until it's mended. */
export const willTravel = (level: BondLevel) => level !== 'resentful';

export type BondEvent =
  | { type: 'changed'; id: BondId; delta: number; score: number; reason?: string }
  | { type: 'level'; id: BondId; level: BondLevel; rose: boolean };
type Listener = (e: BondEvent) => void;

class RelationshipStore {
  private scores = new Map<BondId, number>();
  /** Things said, given or done once ever, keyed "<id>:<what>" (topics asked, keepsakes given). */
  private once = new Set<string>();
  /** The in-game day of the last gift, tending and fights, keyed "<id>:<what>". */
  private days = new Map<string, { day: number; times: number }>();
  private listeners = new Set<Listener>();

  reset(): void {
    this.scores.clear();
    this.once.clear();
    this.days.clear();
  }

  score(id: BondId): number {
    return this.scores.get(id) ?? BONDS[id].start;
  }

  level(id: BondId): BondLevel {
    return bondLevelOf(this.score(id));
  }

  /** Raises (or with a negative amount, lowers) a bond. */
  gain(id: BondId, amount: number, reason?: string): void {
    if (!amount) return;
    const before = this.score(id);
    const after = Math.max(MIN_BOND, Math.min(MAX_BOND, before + amount));
    if (after === before) return;
    this.scores.set(id, after);
    this.emit({ type: 'changed', id, delta: after - before, score: after, reason });
    const was = bondLevelOf(before);
    const now = bondLevelOf(after);
    if (was !== now) this.emit({ type: 'level', id, level: now, rose: after > before });
  }

  /** Whether something once-only has happened. */
  has(id: BondId, what: string): boolean {
    return this.once.has(`${id}:${what}`);
  }

  /** Marks something once-only; true the first time. */
  mark(id: BondId, what: string): boolean {
    const key = `${id}:${what}`;
    if (this.once.has(key)) return false;
    this.once.add(key);
    return true;
  }

  /** How many times something daily has happened today. */
  today(id: BondId, what: string, day = QuestLog.dayProvider()): number {
    const d = this.days.get(`${id}:${what}`);
    return d && d.day === day ? d.times : 0;
  }

  /** Notes something daily has happened (a kind word, an apology). */
  noteToday(id: BondId, what: string, day = QuestLog.dayProvider()): void {
    this.count(id, what, day);
  }

  private count(id: BondId, what: string, day = QuestLog.dayProvider()): void {
    this.days.set(`${id}:${what}`, { day, times: this.today(id, what, day) + 1 });
  }

  /** Whether they'll take a gift today (one a day). */
  canGift(id: BondId, day = QuestLog.dayProvider()): boolean {
    return this.today(id, 'gift', day) === 0;
  }

  /** A gift is given. Returns how they took it. */
  gift(id: BondId, item: ItemId, name?: string, day = QuestLog.dayProvider()): GiftTaste {
    const taste = tasteOf(id, item);
    if (!this.canGift(id, day)) return taste;
    this.count(id, 'gift', day);
    this.gain(id, GIFT_BOND[taste], name ? `A gift: ${name}` : 'A gift');
    return taste;
  }

  /** Whether tending their wounds today would still mean something to them. */
  canTend(id: BondId, day = QuestLog.dayProvider()): boolean {
    return this.today(id, 'tend', day) === 0;
  }

  /** The hero patches them up (the healing itself is the caller's). */
  tended(id: BondId, day = QuestLog.dayProvider()): void {
    if (this.canTend(id, day)) this.gain(id, TEND_BOND, 'Tended their wounds');
    this.count(id, 'tend', day);
  }

  /** A fight won side by side. */
  foughtBeside(id: BondId, day = QuestLog.dayProvider()): void {
    if (this.today(id, 'fight', day) < FIGHTS_PER_DAY) this.gain(id, FIGHT_BOND, 'Fought side by side');
    this.count(id, 'fight', day);
  }

  toSave(): { scores: Partial<Record<BondId, number>>; once: string[]; days: Record<string, { day: number; times: number }> } {
    return {
      scores: Object.fromEntries(this.scores),
      once: [...this.once],
      days: Object.fromEntries([...this.days].map(([k, d]) => [k, { ...d }])),
    };
  }

  fromSave(data: Partial<ReturnType<RelationshipStore['toSave']>> | undefined): void {
    this.reset();
    for (const id of BOND_IDS) {
      const s = data?.scores?.[id];
      if (typeof s === 'number') this.scores.set(id, Math.max(MIN_BOND, Math.min(MAX_BOND, s)));
    }
    for (const k of data?.once ?? []) if (typeof k === 'string') this.once.add(k);
    for (const [k, d] of Object.entries(data?.days ?? {})) if (d && typeof d.day === 'number' && typeof d.times === 'number') this.days.set(k, { ...d });
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: BondEvent): void {
    this.listeners.forEach((fn) => fn(e));
  }
}

export const Relationships = new RelationshipStore();

SaveGame.register('relationships', {
  save: () => Relationships.toSave(),
  load: (data) => Relationships.fromSave(data as Parameters<typeof Relationships.fromSave>[0]),
});
