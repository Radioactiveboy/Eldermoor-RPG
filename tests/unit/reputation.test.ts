import { beforeEach, describe, expect, it } from 'vitest';
import { levelOf, levelRank, Reputation, ReputationEvent } from '../../src/systems/Reputation';
import { QuestLog } from '../../src/systems/Quests';
import { SaveGame } from '../../src/systems/SaveGame';

let events: ReputationEvent[] = [];
let off: () => void;

beforeEach(() => {
  QuestLog.reset();
  QuestLog.dayProvider = () => 1;
  Reputation.reset();
  off?.();
  events = [];
  off = Reputation.onChange((e) => events.push(e));
});

describe('standing levels', () => {
  it('reads scores as levels, in order', () => {
    expect(levelOf(-40)).toBe('distrusted');
    expect(levelOf(-15)).toBe('stranger');
    expect(levelOf(0)).toBe('stranger');
    expect(levelOf(10)).toBe('known');
    expect(levelOf(30)).toBe('liked');
    expect(levelOf(100)).toBe('honoured');
    expect(levelRank('distrusted')).toBeLessThan(levelRank('stranger'));
    expect(levelRank('liked')).toBeLessThan(levelRank('honoured'));
  });

  it('starts every faction as a stranger', () => {
    expect(Reputation.score('adowvale')).toBe(0);
    expect(Reputation.level('militia')).toBe('stranger');
  });
});

describe('gaining standing', () => {
  it('adds up, announces each change, and a new level once', () => {
    Reputation.gain('adowvale', 6);
    Reputation.gain('adowvale', 6);
    expect(Reputation.score('adowvale')).toBe(12);
    expect(events.filter((e) => e.type === 'changed')).toHaveLength(2);
    expect(events.filter((e) => e.type === 'level')).toEqual([{ type: 'level', faction: 'adowvale', level: 'known', rose: true }]);
  });

  it('can fall, and stays within -100 and 100', () => {
    Reputation.gain('militia', -500);
    expect(Reputation.score('militia')).toBe(-100);
    Reputation.gain('militia', 1000);
    expect(Reputation.score('militia')).toBe(100);
    Reputation.gain('militia', 5);
    expect(events.at(-1)).toMatchObject({ type: 'level', level: 'honoured' });
  });

  it('rises when a quest done for folk is finished', () => {
    QuestLog.start('chicken-feed', ['talk', 'buy']);
    QuestLog.complete('chicken-feed', 'return');
    expect(Reputation.score('adowvale')).toBe(6);
    QuestLog.start('wolf-mother', ['talk', 'den', 'slay']);
    QuestLog.complete('wolf-mother', 'return');
    expect(Reputation.level('monastery')).toBe('liked');
    expect(Reputation.score('militia')).toBeGreaterThan(0);
  });
});

describe('the road remembers', () => {
  it('keeps how each meeting last ended, and how often each way', () => {
    expect(Reputation.last('footpads')).toBeUndefined();
    Reputation.record('footpads', 'paid');
    Reputation.record('footpads', 'paid');
    Reputation.record('footpads', 'fought');
    Reputation.record('goat', 'found');
    expect(Reputation.last('footpads')).toBe('fought');
    expect(Reputation.times('footpads', 'paid')).toBe(2);
    expect(Reputation.times('footpads', 'scared')).toBe(0);
    expect(Reputation.last('goat')).toBe('found');
  });

  it('survives a save and load, and an old save starts it fresh', () => {
    Reputation.gain('monastery', 33);
    Reputation.record('courier', 'fed');
    const saved = JSON.parse(JSON.stringify(SaveGame.collect()));
    Reputation.reset();
    SaveGame.restore({ sections: saved } as never);
    expect(Reputation.score('monastery')).toBe(33);
    expect(Reputation.last('courier')).toBe('fed');
    expect(Reputation.times('courier', 'fed')).toBe(1);
    // A save from before standing was kept.
    SaveGame.restore({ sections: { ...saved, reputation: undefined } } as never);
    expect(Reputation.score('monastery')).toBe(0);
    expect(Reputation.last('courier')).toBeUndefined();
  });
});
