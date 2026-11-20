import { beforeEach, describe, expect, it } from 'vitest';
import { Experience, ExperienceEvent, HEALTH_PER_LEVEL, MAX_LEVEL, XP_REWARDS, xpForLevel } from '../../src/systems/Experience';
import { QuestLog, QUESTS } from '../../src/systems/Quests';

beforeEach(() => {
  Experience.reset();
  QuestLog.reset();
});

describe('xpForLevel', () => {
  it('matches the table in the comments', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 250, 450, 700]);
  });

  it('asks a little more for every level', () => {
    for (let l = 2; l < MAX_LEVEL; l++) {
      expect(xpForLevel(l + 1) - xpForLevel(l)).toBeGreaterThan(xpForLevel(l) - xpForLevel(l - 1));
    }
  });
});

describe('levelling up', () => {
  it('levels up exactly at the threshold and says so once', () => {
    const events: ExperienceEvent[] = [];
    const off = Experience.onChange((e) => events.push(e));
    Experience.gain(99, 'Grey Wolf');
    expect(Experience.level).toBe(1);
    Experience.gain(1, 'Grey Wolf');
    expect(Experience.level).toBe(2);
    expect(events.filter((e) => e.type === 'levelled')).toEqual([{ type: 'levelled', level: 2, from: 1 }]);
    off();
  });

  it('can jump several levels in one gain', () => {
    const levelled: ExperienceEvent[] = [];
    const off = Experience.onChange((e) => e.type === 'levelled' && levelled.push(e));
    Experience.gain(xpForLevel(4), 'A lot');
    expect(levelled).toEqual([{ type: 'levelled', level: 4, from: 1 }]);
    off();
  });

  it('ignores nothing-gains and stops at the top level', () => {
    Experience.gain(0, 'nothing');
    Experience.gain(-50, 'nothing');
    expect(Experience.xp).toBe(0);
    Experience.gain(xpForLevel(MAX_LEVEL) * 2, 'everything');
    expect(Experience.level).toBe(MAX_LEVEL);
    expect(Experience.toNext).toBe(0);
    expect(Experience.progress.fraction).toBe(1);
  });

  it('reports progress through the current level', () => {
    Experience.gain(175, 'halfway');
    expect(Experience.progress).toEqual({ into: 75, span: 150, fraction: 0.5 });
    expect(Experience.toNext).toBe(75);
  });

  it('makes the hero tougher with each level', () => {
    Experience.load(xpForLevel(7));
    expect(Experience.level).toBe(7);
    expect(Experience.healthBonus).toBe(6 * HEALTH_PER_LEVEL);
    expect(Experience.toHitBonus).toBe(3);
    expect(Experience.damageBonus).toBe(2);
  });
});

describe('quest rewards', () => {
  it('pays for each step and for finishing', () => {
    QuestLog.start('chicken-feed', ['talk']);
    QuestLog.complete('chicken-feed', 'buy');
    expect(Experience.xp).toBe(XP_REWARDS.objective);
    QuestLog.complete('chicken-feed', 'return');
    expect(Experience.xp).toBe(2 * XP_REWARDS.objective + QUESTS['chicken-feed'].xp);
  });
});
