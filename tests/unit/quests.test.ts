import { beforeEach, describe, expect, it } from 'vitest';
import { diaryStamp, QuestEvent, QuestLog, QUESTS } from '../../src/systems/Quests';

let events: QuestEvent[] = [];
let off: () => void;

beforeEach(() => {
  QuestLog.reset('It begins.');
  QuestLog.dayProvider = () => 1;
  off?.();
  events = [];
  off = QuestLog.onChange((e) => events.push(e));
});

describe('quest definitions', () => {
  it('have unique step ids and an id that matches their key', () => {
    for (const [key, q] of Object.entries(QUESTS)) {
      expect(q.id).toBe(key);
      expect(new Set(q.objectives.map((o) => o.id)).size).toBe(q.objectives.length);
    }
  });
});

describe('starting', () => {
  it('starts a quest once, with any steps already done', () => {
    QuestLog.dayProvider = () => 3;
    QuestLog.start('lost-sheep', ['talk']);
    QuestLog.start('lost-sheep');
    expect(QuestLog.all).toHaveLength(1);
    const q = QuestLog.get('lost-sheep')!;
    expect(q.day).toBe(3);
    expect(QuestLog.isDone('lost-sheep', 'talk')).toBe(true);
    expect(QuestLog.current(q)?.id).toBe('cave');
    expect(events.map((e) => e.type)).toEqual(['started']);
  });

  it("refuses a quest that doesn't exist", () => {
    expect(() => QuestLog.start('no-such-quest')).toThrow(/Unknown quest/);
  });

  it('only shows the steps done so far and the next one', () => {
    QuestLog.start('mother-medicine', ['talk']);
    const shown = QuestLog.visibleObjectives(QuestLog.get('mother-medicine')!);
    expect(shown.map((o) => [o.id, o.done])).toEqual([['talk', true], ['leave', false]]);
  });
});

describe('completing', () => {
  it('completes when the last step is done, and not before', () => {
    QuestLog.start('chicken-feed', ['talk']);
    QuestLog.complete('chicken-feed', 'buy');
    expect(QuestLog.get('chicken-feed')!.completed).toBe(false);
    expect(QuestLog.active).toHaveLength(1);
    QuestLog.complete('chicken-feed', 'return');
    expect(QuestLog.get('chicken-feed')!.completed).toBe(true);
    expect(QuestLog.active).toHaveLength(0);
    expect(events.map((e) => e.type)).toEqual(['started', 'progress', 'progress', 'completed']);
  });

  it('ignores repeated, unknown and out-of-quest steps', () => {
    QuestLog.start('chicken-feed', ['talk']);
    QuestLog.complete('chicken-feed', 'talk');
    QuestLog.complete('chicken-feed', 'no-such-step');
    QuestLog.complete('lost-sheep', 'cave');
    expect(events.map((e) => e.type)).toEqual(['started']);
  });

  it('focuses the quest last moved on while it is still going', () => {
    QuestLog.start('chicken-feed', ['talk']);
    QuestLog.start('lost-sheep', ['talk']);
    expect(QuestLog.focused?.def.id).toBe('lost-sheep');
    QuestLog.complete('chicken-feed', 'buy');
    expect(QuestLog.focused?.def.id).toBe('chicken-feed');
    QuestLog.complete('chicken-feed', 'return');
    expect(QuestLog.focused?.def.id).toBe('lost-sheep');
  });
});

describe('flags and diary', () => {
  it('sets and clears flags', () => {
    QuestLog.setFlag('saw-bess');
    expect(QuestLog.hasFlag('saw-bess')).toBe(true);
    QuestLog.clearFlag('saw-bess');
    expect(QuestLog.hasFlag('saw-bess')).toBe(false);
  });

  it('dates diary entries with the day and the hour', () => {
    QuestLog.dayProvider = () => 4;
    QuestLog.hourProvider = () => 14.5;
    QuestLog.writeDiary('Found a wolf.');
    expect(QuestLog.diary).toEqual([{ day: 1, hour: 8, text: 'It begins.' }, { day: 4, hour: 14.5, text: 'Found a wolf.' }]);
  });

  it('stamps entries for the journal, and copes with old ones that have no hour', () => {
    expect(diaryStamp({ day: 4, hour: 14.5, text: '' })).toBe('Day 4, 14:30');
    expect(diaryStamp({ day: 2, hour: 6.05, text: '' })).toBe('Day 2, 06:03');
    expect(diaryStamp({ day: 9, hour: 23.999, text: '' })).toBe('Day 9, 23:59');
    expect(diaryStamp({ day: 3, text: '' })).toBe('Day 3');
  });
});

describe('saving', () => {
  it('round-trips the log, skipping quests that were taken out', () => {
    QuestLog.start('chicken-feed', ['talk']);
    QuestLog.complete('chicken-feed', 'buy');
    QuestLog.setFlag('paid-toll');
    const data = JSON.parse(JSON.stringify(QuestLog.toSave()));
    data.quests.push({ id: 'removed-quest', done: [], completed: false, day: 1 });
    QuestLog.reset();
    QuestLog.fromSave(data);
    expect(QuestLog.all.map((q) => q.def.id)).toEqual(['chicken-feed']);
    expect(QuestLog.isDone('chicken-feed', 'buy')).toBe(true);
    expect(QuestLog.hasFlag('paid-toll')).toBe(true);
    expect(QuestLog.focused?.def.id).toBe('chicken-feed');
  });

  it('reads a save from before flags were kept', () => {
    QuestLog.setFlag('stale');
    QuestLog.fromSave({ quests: [], diary: [] });
    expect(QuestLog.hasFlag('stale')).toBe(false);
  });
});
