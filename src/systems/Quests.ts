import { SaveGame } from './SaveGame';

/**
 * The quest log: which quests the player has taken on, how far along each one
 * is, and the diary entries the journal shows. Quests are defined as data in
 * QUESTS below; game code only says "start this" or "this step is done".
 *
 * Objectives are revealed one at a time: the journal and HUD show the ones
 * already done plus the current one, so the next step stays a surprise.
 */
export interface ObjectiveDef {
  id: string;
  text: string;
}

export interface QuestDef {
  id: string;
  title: string;
  giver: string;
  /** A short paragraph for the journal, in the hero's own words. */
  summary: string;
  objectives: ObjectiveDef[];
}

export const QUESTS: Record<string, QuestDef> = {
  'mother-medicine': {
    id: 'mother-medicine',
    title: 'Medicine for Mother',
    giver: 'Mother',
    summary:
      "Mother's cough has turned to fever, and it worsens with every night. She says a tincture of moonpetal and willow bark " +
      'could ease it, but we have none left. Someone in Eldermoor must sell it.',
    objectives: [
      { id: 'talk', text: 'Speak with Mother' },
      { id: 'leave', text: 'Head out into the village' },
      { id: 'find', text: 'Find a healer or herbalist with moonpetal tincture' },
      { id: 'return', text: 'Bring the medicine home to Mother' },
    ],
  },
  'lost-sheep': {
    id: 'lost-sheep',
    title: 'The Lost Ewes',
    giver: 'Wil the Drover',
    summary:
      "Wil, a drover on the old road, has lost two of Master Coombe's ewes, Bess and Bramble. Something big spooked them " +
      'by the lake, and its tracks lead north past our cottage, to the cave in the hill. He is too frightened to look himself.',
    objectives: [
      { id: 'talk', text: 'Speak with Wil the Drover' },
      { id: 'cave', text: 'Follow the tracks north to the cave in the hill' },
      { id: 'find', text: 'Find Bess and Bramble' },
      { id: 'tell', text: 'Tell Wil what became of his ewes' },
    ],
  },
};

export interface QuestState {
  def: QuestDef;
  done: Set<string>;
  completed: boolean;
  /** In-game day the quest began, for the journal. */
  day: number;
}

export interface DiaryEntry {
  day: number;
  text: string;
}

export type QuestEvent =
  | { type: 'started'; quest: QuestState }
  | { type: 'progress'; quest: QuestState; objective: ObjectiveDef }
  | { type: 'completed'; quest: QuestState }
  | { type: 'diary'; entry: DiaryEntry };

type Listener = (e: QuestEvent) => void;

class QuestLogStore {
  private quests: QuestState[] = [];
  private diaryEntries: DiaryEntry[] = [];
  /** Things that have happened which quests may care about later (e.g. 'saw-bess'). */
  private flags = new Set<string>();
  private listeners = new Set<Listener>();
  /** Id of the quest last started or moved on (see `focused`). */
  private focusId?: string;
  /** Supplies the current in-game day for new entries. */
  dayProvider: () => number = () => 1;

  /** Forget everything, for a new game. The opening diary entry is written quietly. */
  reset(openingEntry?: string): void {
    this.quests = [];
    this.diaryEntries = openingEntry ? [{ day: 1, text: openingEntry }] : [];
    this.flags.clear();
    this.focusId = undefined;
  }

  setFlag(flag: string): void {
    this.flags.add(flag);
  }

  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  /** The quest the player is most likely busy with: the last one started or moved on, if it's still going. */
  get focused(): QuestState | undefined {
    const quest = this.focusId ? this.get(this.focusId) : undefined;
    return quest && !quest.completed ? quest : this.active[0];
  }

  get all(): readonly QuestState[] {
    return this.quests;
  }

  get active(): QuestState[] {
    return this.quests.filter((q) => !q.completed);
  }

  get diary(): readonly DiaryEntry[] {
    return this.diaryEntries;
  }

  get(id: string): QuestState | undefined {
    return this.quests.find((q) => q.def.id === id);
  }

  has(id: string): boolean {
    return !!this.get(id);
  }

  isDone(id: string, objective: string): boolean {
    return !!this.get(id)?.done.has(objective);
  }

  /** Begins a quest, optionally with some steps already done (e.g. "speak with her" when she gave it). */
  start(id: string, alreadyDone: string[] = []): void {
    if (this.has(id)) return;
    const def = QUESTS[id];
    if (!def) throw new Error(`Unknown quest: ${id}`);
    const quest: QuestState = { def, done: new Set(alreadyDone), completed: false, day: this.dayProvider() };
    this.quests.push(quest);
    this.focusId = id;
    this.emit({ type: 'started', quest });
  }

  /** Marks a step done. The quest completes when its last step is done. */
  complete(id: string, objective: string): void {
    const quest = this.get(id);
    if (!quest || quest.completed || quest.done.has(objective)) return;
    const def = quest.def.objectives.find((o) => o.id === objective);
    if (!def) return;
    quest.done.add(objective);
    this.focusId = id;
    this.emit({ type: 'progress', quest, objective: def });
    if (quest.def.objectives.every((o) => quest.done.has(o.id))) {
      quest.completed = true;
      this.emit({ type: 'completed', quest });
    }
  }

  /** The step the player should be working on, or undefined once all are done. */
  current(quest: QuestState): ObjectiveDef | undefined {
    return quest.def.objectives.find((o) => !quest.done.has(o.id));
  }

  /** Steps to show: everything done so far plus the current one. */
  visibleObjectives(quest: QuestState): Array<ObjectiveDef & { done: boolean }> {
    const out: Array<ObjectiveDef & { done: boolean }> = [];
    for (const o of quest.def.objectives) {
      const done = quest.done.has(o.id);
      out.push({ ...o, done });
      if (!done) break;
    }
    return out;
  }

  /** The log as plain data, for a save. */
  toSave(): {
    quests: Array<{ id: string; done: string[]; completed: boolean; day: number }>;
    diary: DiaryEntry[];
    flags?: string[];
    focus?: string;
  } {
    return {
      quests: this.quests.map((q) => ({ id: q.def.id, done: [...q.done], completed: q.completed, day: q.day })),
      diary: this.diaryEntries.map((e) => ({ ...e })),
      flags: [...this.flags],
      focus: this.focusId,
    };
  }

  /** Puts the log back from a save, quietly (no "new quest" announcements). */
  fromSave(data: ReturnType<QuestLogStore['toSave']>): void {
    // Quests that have since been taken out of the game are skipped.
    this.quests = data.quests
      .filter((q) => QUESTS[q.id])
      .map((q) => ({ def: QUESTS[q.id], done: new Set(q.done), completed: q.completed, day: q.day }));
    this.diaryEntries = data.diary.map((e) => ({ ...e }));
    this.flags = new Set(data.flags ?? []);
    this.focusId = data.focus;
  }

  writeDiary(text: string): void {
    const entry = { day: this.dayProvider(), text };
    this.diaryEntries.push(entry);
    this.emit({ type: 'diary', entry });
  }

  /** Calls fn on every change. Returns an unsubscribe function. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: QuestEvent): void {
    this.listeners.forEach((fn) => fn(e));
  }
}

export const QuestLog = new QuestLogStore();

SaveGame.register('quests', {
  save: () => QuestLog.toSave(),
  load(data) {
    QuestLog.reset();
    if (data) QuestLog.fromSave(data as ReturnType<QuestLogStore['toSave']>);
  },
});
