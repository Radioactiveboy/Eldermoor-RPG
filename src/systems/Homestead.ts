import type { ItemId } from './Inventory';
import { SaveGame } from './SaveGame';

/**
 * Putting the Hollow right again, after the goblins burnt it: the hero's own
 * cottage, raised from its ashes a stage at a time with timber, thatching reed,
 * nails and stone (gathered, or bought in Adowvale), then made better than it
 * ever was; and Farmer Iran's stead, mended a piece at a time with the coins
 * the hero gives him. See scenes/game/homestead.ts for the doing of it, and
 * world/Homestead.ts for how the Hollow looks at each stage.
 *
 * Work isn't done the moment the last plank is brought: Osric's work party
 * comes up the next morning and works through the day, and it stands finished
 * at the following dawn ({@link workHours}). Iran's mending goes the same way.
 *
 * Everything here is plain state and rules, so it can be tested without the game.
 */

/** The building goods: brought to the builder's pile at the cottage, a few at a time. */
export type Material = 'timber' | 'thatching-reed' | 'iron-nails' | 'dressed-stone' | 'slate';

export const MATERIALS: readonly Material[] = ['timber', 'thatching-reed', 'iron-nails', 'dressed-stone', 'slate'];

/** One piece of work on the cottage, in the order they come. */
export type ProjectId = 'walls' | 'hearth' | 'well' | 'herb-garden' | 'workshop' | 'paddock' | 'yard-wall' | 'slate-roof';

/** The improvements, once the cottage is a home again, in the order the plans list them. */
export const IMPROVEMENTS: readonly ProjectId[] = ['well', 'herb-garden', 'workshop', 'paddock', 'yard-wall', 'slate-roof'];

export interface ProjectDef {
  name: string;
  /** What it says on Osric's plans. */
  blurb: string;
  /** What has to be brought to the builder's pile (materials, or anything else the satchel holds: herbs for the garden). */
  needs: Partial<Record<ItemId, number>>;
  /** Coins for the work party's hire or a joiner's work, paid at the pile with the rest. */
  coins?: number;
  /** Whole days of work, once it's all there (each starting at the next dawn). */
  days: number;
  /** What must be finished first. */
  after?: ProjectId[];
}

export const PROJECTS: Record<ProjectId, ProjectDef> = {
  walls: {
    name: 'Walls and roof',
    blurb: 'New oak where the old logs burnt through, new rafters, and a new thatch over all of it.',
    needs: { timber: 12, 'thatching-reed': 16, 'iron-nails': 2 },
    days: 3,
  },
  hearth: {
    name: 'Hearth and home',
    blurb: 'The hearth rebuilt in good stone, a floor relaid, and a bed, table and stools from the joiner in Adowvale.',
    needs: { 'dressed-stone': 6, timber: 4 },
    coins: 40,
    days: 2,
    after: ['walls'],
  },
  well: {
    name: 'A stone well',
    blurb: 'A well in the yard, with a stone curb, a little roof and a windlass. No more carrying water up from the lake.',
    needs: { 'dressed-stone': 10, timber: 2, 'iron-nails': 1 },
    days: 1,
    after: ['hearth'],
  },
  'herb-garden': {
    name: "Mother's herb garden",
    blurb: 'Raised beds by the cottage wall, with yarrow, comfrey and sage set in them, the way Mother always meant to have.',
    needs: { timber: 3, yarrow: 1, comfrey: 1, sage: 1 },
    days: 1,
    after: ['hearth'],
  },
  workshop: {
    name: 'A workshop lean-to',
    blurb: 'A thatched lean-to against the cottage, with a brewing bench of my own, so I need not borrow Old Maud\'s.',
    needs: { timber: 8, 'thatching-reed': 6, 'iron-nails': 1 },
    coins: 25,
    days: 2,
    after: ['hearth'],
  },
  paddock: {
    name: 'A paddock and goats',
    blurb: 'A split-rail paddock east of the garden, a lean-to for shelter, and two nanny goats from Mags on the plains.',
    needs: { timber: 10, 'iron-nails': 1 },
    coins: 35,
    days: 1,
    after: ['hearth'],
  },
  'yard-wall': {
    name: 'A stone wall and gate',
    blurb: 'A dry-stone wall round the yard, waist high, with an oak gate on iron hinges facing the road.',
    needs: { 'dressed-stone': 14, timber: 2, 'iron-nails': 1 },
    days: 2,
    after: ['hearth'],
  },
  'slate-roof': {
    name: 'A slate roof',
    blurb: 'Grey slate from the Greyfells in place of the thatch. It will not burn. Not ever again.',
    needs: { slate: 20, timber: 2, 'iron-nails': 2 },
    coins: 30,
    days: 2,
    after: ['hearth'],
  },
};

/** How the cottage stands, from the burnt shell to a home again. */
export type CottageStage = 'ruin' | 'cleared' | 'raising' | 'roofed' | 'furnishing' | 'home';

/** The heaps of burnt timber to drag out of the shell before anything can be built. */
export const RUBBLE = ['rubble-0', 'rubble-1', 'rubble-2', 'rubble-3', 'rubble-4'] as const;

/** Iran's stead, a piece at a time: what the coins he's given have paid for, once each is built. */
export interface SteadStage {
  id: 'coop' | 'hut' | 'pen' | 'barn';
  /** Coins given in all before it can be started. */
  at: number;
  name: string;
}

export const STEAD_STAGES: readonly SteadStage[] = [
  { id: 'coop', at: 40, name: 'a new hen coop' },
  { id: 'hut', at: 90, name: 'the hut mended and new-thatched' },
  { id: 'pen', at: 150, name: 'new fences round the pen, and hens to fill it' },
  { id: 'barn', at: 220, name: 'a little barn' },
];

/** Days of work on each piece of Iran's stead. */
export const STEAD_DAYS = 2;

/** What a handful of coins given to Iran is: he's offered this much at a time, or whatever's left. */
export const STEAD_GIFT = 10;

/** The dawn hour work starts and finishes at. */
export const DAWN = 6;

/** Clock hours of the dawn `n` mornings after `now` (n = 1: the next dawn, even if it's not long off). */
export function dawnAfter(now: number, n: number): number {
  const today = Math.floor(now / 24) * 24 + DAWN;
  const first = now < today ? today : today + 24;
  return first + (n - 1) * 24;
}

/** When work brought together at `now` starts and is finished: from the next dawn, for `days` days. */
export function workHours(now: number, days: number): { from: number; until: number } {
  return { from: dawnAfter(now, 1), until: dawnAfter(now, 1 + days) };
}

/** Work under way: what, and from and until when (clock hours). */
export interface Work {
  project: ProjectId;
  from: number;
  until: number;
}

/** Something just finished, for the diary and the HUD. */
export type Finished = { kind: 'project'; project: ProjectId } | { kind: 'stead'; stage: SteadStage['id'] };

class HomesteadStore {
  /** The game's clock, in hours since the start of day 1 (GameScene sets it): for laying out the work as it stands. */
  clock: () => number = () => 0;
  /** Rubble heaps dragged out of the shell. */
  cleared = new Set<string>();
  /** What's been brought to the pile for each piece of work (coins under 'coins'). */
  private delivered: Partial<Record<ProjectId, Record<string, number>>> = {};
  /** Finished, for good. */
  built = new Set<ProjectId>();
  /** Under way, if anything is (Osric's lads only do one thing at a time). */
  work?: Work;
  /** Coins given to Iran for his stead, in all. */
  iranGiven = 0;
  /** How many of {@link STEAD_STAGES} are built. */
  steadBuilt = 0;
  /** The stead stage being built, and until when. */
  steadWork?: { from: number; until: number };

  reset(): void {
    this.cleared.clear();
    this.delivered = {};
    this.built.clear();
    this.work = undefined;
    this.iranGiven = 0;
    this.steadBuilt = 0;
    this.steadWork = undefined;
  }

  // ------------------------------------------------------------ the cottage

  get allCleared(): boolean {
    return RUBBLE.every((id) => this.cleared.has(id));
  }

  /** How the cottage stands now. */
  get stage(): CottageStage {
    if (this.built.has('hearth')) return 'home';
    if (this.work?.project === 'hearth') return 'furnishing';
    if (this.built.has('walls')) return 'roofed';
    if (this.work?.project === 'walls') return 'raising';
    return this.allCleared ? 'cleared' : 'ruin';
  }

  /** How far along the work is, 0 (not started: due at dawn) to 1 (all but done). */
  progress(now: number): number {
    const w = this.work;
    if (!w || now < w.from) return 0;
    return Math.min(1, (now - w.from) / (w.until - w.from));
  }

  /** Whether the work party is on the job right now (after dawn on its first day), as opposed to due tomorrow. */
  working(now: number): boolean {
    return !!this.work && now >= this.work.from && now < this.work.until;
  }

  /** What can be worked towards at the pile now: the next piece of the rebuilding, or any improvement not yet built. */
  open(): ProjectId[] {
    if (!this.allCleared) return [];
    if (!this.built.has('walls')) return ['walls'];
    if (!this.built.has('hearth')) return ['hearth'];
    return IMPROVEMENTS.filter((p) => !this.built.has(p));
  }

  /** How many of an item (or 'coins') have been brought for a piece of work. */
  brought(project: ProjectId, what: string): number {
    return this.delivered[project]?.[what] ?? 0;
  }

  /** What's still wanted for a piece of work, by item (and 'coins'), leaving out what's all there. */
  missing(project: ProjectId): Record<string, number> {
    const def = PROJECTS[project];
    const out: Record<string, number> = {};
    const want: Record<string, number> = { ...def.needs, ...(def.coins ? { coins: def.coins } : {}) };
    for (const [what, n] of Object.entries(want)) {
      const left = (n ?? 0) - this.brought(project, what);
      if (left > 0) out[what] = left;
    }
    return out;
  }

  /** Everything for it is at the pile. */
  ready(project: ProjectId): boolean {
    return Object.keys(this.missing(project)).length === 0;
  }

  /**
   * Brings up to `n` of something for a piece of work: returns how many were
   * wanted and taken (the rest stays in the satchel). Nothing is taken for work
   * that isn't open, or already under way.
   */
  deliver(project: ProjectId, what: string, n: number): number {
    if (!this.open().includes(project) || this.work?.project === project) return 0;
    const take = Math.max(0, Math.min(n, this.missing(project)[what] ?? 0));
    if (take === 0) return 0;
    const got = (this.delivered[project] ??= {});
    got[what] = (got[what] ?? 0) + take;
    return take;
  }

  /** Sets the work party to it, if everything's there and they're free: from the next dawn. */
  startWork(project: ProjectId, now: number): Work | undefined {
    if (this.work || !this.ready(project) || this.built.has(project)) return undefined;
    this.work = { project, ...workHours(now, PROJECTS[project].days) };
    return this.work;
  }

  // ------------------------------------------------------------ Iran's stead

  /** The next piece of Iran's stead not yet built, if any. */
  get nextStead(): SteadStage | undefined {
    return STEAD_STAGES[this.steadBuilt];
  }

  /** How far along Iran's stead is: built pieces, by id. */
  steadHas(id: SteadStage['id']): boolean {
    return STEAD_STAGES.findIndex((s) => s.id === id) < this.steadBuilt;
  }

  /** Coins still wanted before everything on Iran's list is paid for. */
  get steadWanted(): number {
    return Math.max(0, STEAD_STAGES[STEAD_STAGES.length - 1].at - this.iranGiven);
  }

  /** Coins given to Iran: work starts on whatever they now pay for, if it isn't already. */
  giveIran(coins: number, now: number): void {
    this.iranGiven += Math.max(0, Math.floor(coins));
    this.startStead(now);
  }

  private startStead(now: number): void {
    const next = this.nextStead;
    if (this.steadWork || !next || this.iranGiven < next.at) return;
    this.steadWork = workHours(now, STEAD_DAYS);
  }

  // ------------------------------------------------------------ the passing of time

  /**
   * Brings the work up to `now`: anything whose last day is over is built (and,
   * on Iran's stead, the next piece is started if it's paid for). Returns what
   * finished, in order.
   */
  advance(now: number): Finished[] {
    const done: Finished[] = [];
    if (this.work && now >= this.work.until) {
      this.built.add(this.work.project);
      done.push({ kind: 'project', project: this.work.project });
      this.work = undefined;
    }
    // Iran's pieces follow one another, a day each, for as long as the coins go.
    while (this.steadWork && now >= this.steadWork.until) {
      const stage = this.nextStead!;
      const finishedAt = this.steadWork.until;
      this.steadBuilt++;
      this.steadWork = undefined;
      done.push({ kind: 'stead', stage: stage.id });
      this.startStead(finishedAt - 1);
    }
    return done;
  }

  // ------------------------------------------------------------ saving

  toSave() {
    return {
      cleared: [...this.cleared],
      delivered: this.delivered,
      built: [...this.built],
      work: this.work,
      iranGiven: this.iranGiven,
      steadBuilt: this.steadBuilt,
      steadWork: this.steadWork,
    };
  }

  fromSave(data: Partial<ReturnType<HomesteadStore['toSave']>> | undefined): void {
    this.reset();
    if (!data) return;
    const projects = new Set(Object.keys(PROJECTS));
    this.cleared = new Set((data.cleared ?? []).filter((id) => typeof id === 'string'));
    for (const [p, got] of Object.entries(data.delivered ?? {})) {
      if (!projects.has(p) || !got || typeof got !== 'object') continue;
      this.delivered[p as ProjectId] = Object.fromEntries(Object.entries(got).filter(([, n]) => typeof n === 'number' && n > 0));
    }
    this.built = new Set((data.built ?? []).filter((p): p is ProjectId => projects.has(p)));
    const w = data.work;
    if (w && projects.has(w.project) && typeof w.from === 'number' && typeof w.until === 'number') this.work = { ...w };
    this.iranGiven = typeof data.iranGiven === 'number' ? Math.max(0, data.iranGiven) : 0;
    this.steadBuilt = Math.max(0, Math.min(STEAD_STAGES.length, Math.floor(data.steadBuilt ?? 0)));
    const s = data.steadWork;
    if (s && typeof s.from === 'number' && typeof s.until === 'number') this.steadWork = { from: s.from, until: s.until };
  }
}

export const Homestead = new HomesteadStore();

SaveGame.register('homestead', {
  save: () => Homestead.toSave(),
  load(data) {
    Homestead.fromSave(data as Partial<ReturnType<HomesteadStore['toSave']>> | undefined);
  },
});
