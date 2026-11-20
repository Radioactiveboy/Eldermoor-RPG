import { beforeEach, describe, expect, it } from 'vitest';
import { BOUNTIES, Bounties, BOUNTY_IDS, postedOn, POSTED_EACH_DAY, questId } from '../../src/systems/Bounties';
import { Inventory } from '../../src/systems/Inventory';
import { QuestLog, QUESTS } from '../../src/systems/Quests';
import { Reputation } from '../../src/systems/Reputation';
import { SaveGame } from '../../src/systems/SaveGame';

let day = 1;
beforeEach(() => {
  day = 1;
  QuestLog.reset();
  QuestLog.dayProvider = () => day;
  Bounties.reset();
  Reputation.reset();
  Inventory.reset();
});

/** A day on which the given bounty is posted. */
function dayWith(id: (typeof BOUNTY_IDS)[number]): number {
  for (let d = 1; d < 20; d++) if (postedOn(d).includes(id)) return d;
  throw new Error(`never posted: ${id}`);
}

describe('the board', () => {
  it('posts three notices a day, changing from day to day', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 8; d++) {
      expect(postedOn(d)).toHaveLength(POSTED_EACH_DAY);
      seen.add(postedOn(d).join());
    }
    expect(seen.size).toBeGreaterThan(1);
    for (const id of BOUNTY_IDS) expect(dayWith(id)).toBeGreaterThan(0);
  });

  it('has a repeatable quest for every bounty', () => {
    for (const id of BOUNTY_IDS) {
      const q = QUESTS[questId(id)];
      expect(q.repeatable).toBe(true);
      expect(q.objectives.map((o) => o.id)).toEqual(['hunt', 'claim']);
    }
  });

  it("won't take a notice that isn't up", () => {
    const missing = BOUNTY_IDS.find((id) => !postedOn(day).includes(id))!;
    expect(Bounties.take(missing)).toBe(false);
    expect(QuestLog.has(questId(missing))).toBe(false);
  });
});

describe('a bounty, start to finish', () => {
  it('is taken, hunted, claimed, and can be taken again another day', () => {
    day = dayWith('boar');
    const coins = Inventory.coins;
    expect(Bounties.take('boar')).toBe(true);
    expect(Bounties.take('boar')).toBe(false);
    expect(QuestLog.has('bounty-boar')).toBe(true);
    expect(Bounties.wants('boar')).toBe(true);
    expect(Bounties.state('boar')).toBe('taken');

    expect(Bounties.slain(['boar', 'hare'])).toEqual(['Boar in the Crofts: 1 of 2.']);
    expect(Bounties.claim('boar')).toBe(false);
    Bounties.slain(['boar', 'boar']);
    expect(Bounties.state('boar')).toBe('ready');
    expect(Bounties.wants('boar')).toBe(false);
    expect(QuestLog.isDone('bounty-boar', 'hunt')).toBe(true);

    expect(Bounties.claim('boar')).toBe(true);
    expect(Inventory.coins).toBe(coins + BOUNTIES.boar.coins);
    expect(Reputation.score('militia')).toBe(BOUNTIES.boar.standing.militia);
    expect(QuestLog.get('bounty-boar')!.completed).toBe(true);
    expect(Bounties.state('boar')).toBe('claimed');
    // Still on the board today, marked paid, and not to be taken again today.
    expect(Bounties.notices().find((n) => n.def.id === 'boar')?.state).toBe('claimed');
    expect(Bounties.take('boar')).toBe(false);

    day = dayWith('boar') === day ? day + 4 : day;
    while (!postedOn(day).includes('boar')) day++;
    expect(Bounties.take('boar')).toBe(true);
    expect(QuestLog.all.filter((q) => q.def.id === 'bounty-boar')).toHaveLength(1);
    expect(QuestLog.get('bounty-boar')!.completed).toBe(false);
    expect(Bounties.timesClaimed('boar')).toBe(1);
  });

  it('keeps a taken notice up on later days until it is claimed', () => {
    day = dayWith('wolves');
    Bounties.take('wolves');
    while (postedOn(day).includes('wolves')) day++;
    expect(Bounties.notices().some((n) => n.def.id === 'wolves')).toBe(true);
  });

  it('counts both footpads towards their bounty', () => {
    day = dayWith('footpads');
    Bounties.take('footpads');
    Bounties.slain(['footpad', 'cutpurse']);
    expect(Bounties.state('footpads')).toBe('ready');
  });
});

describe('rats back in the cellar', () => {
  it('appear only while the rat bounty is out, fewer as they are killed', () => {
    expect(Bounties.spawns('cellar')).toEqual([]);
    day = dayWith('rats');
    Bounties.take('rats');
    expect(Bounties.spawns('market')).toEqual([]);
    const first = Bounties.spawns('cellar');
    expect(first).toHaveLength(BOUNTIES.rats.need);
    expect(first.every((s) => s.kind === 'rat')).toBe(true);
    Bounties.slain(['rat']);
    const then = Bounties.spawns('cellar');
    expect(then).toHaveLength(BOUNTIES.rats.need - 1);
    // New rats, not the ones already killed.
    expect(then.some((s) => first.some((f) => f.id === s.id))).toBe(false);
    Bounties.slain(['rat', 'rat', 'rat']);
    expect(Bounties.spawns('cellar')).toEqual([]);
  });
});

describe('saving the board', () => {
  it('round-trips taken notices and claims, and an old save starts it fresh', () => {
    day = dayWith('boar');
    Bounties.take('boar');
    Bounties.slain(['boar']);
    const saved = JSON.parse(JSON.stringify(SaveGame.collect()));
    Bounties.reset();
    SaveGame.restore({ sections: saved } as never);
    expect(Bounties.state('boar')).toBe('taken');
    Bounties.slain(['boar']);
    expect(Bounties.claim('boar')).toBe(true);
    SaveGame.restore({ sections: { ...saved, bounties: undefined } } as never);
    expect(Bounties.has('boar')).toBe(false);
  });
});
