import { describe, expect, it } from 'vitest';
import { FoeKind, FOES } from '../../src/systems/Combat';
import { foeDefs, heroDef, KIT_BY_LEVEL, seeded, simulate, simulateFight } from '../../src/systems/CombatSim';
import { FightTally, lootLine } from '../../src/systems/FightTally';

describe('the fight simulator', () => {
  it('repeats a run exactly from the same seed', () => {
    const a = simulate(1, 'wolf', 2, { fights: 200, seed: 7 });
    const b = simulate(1, 'wolf', 2, { fights: 200, seed: 7 });
    expect(a).toEqual(b);
  });

  it("works out the hero's numbers the way the fight screen does", () => {
    // Walking staff (+2), straw hat, tunic and boots (+1 defence each), level 1.
    expect(heroDef(1, KIT_BY_LEVEL[1])).toMatchObject({ hp: 100, maxHp: 100, ac: 13, toHit: 5, damage: { count: 1, sides: 6, bonus: 2 } });
    // Level 4: +1 to hit, +1 damage, 30 more health. The spear rolls a d8 and is set against a charge.
    const l4 = heroDef(4, KIT_BY_LEVEL[4]);
    expect(l4).toMatchObject({ maxHp: 130, toHit: 3 + 3 + 1, damage: { sides: 8, bonus: 3 + 1 } });
    expect(l4.weapon?.kind).toBe('set');
    // Fists: a d4 and nothing added.
    expect(heroDef(1, { worn: [] }).damage).toEqual({ count: 1, sides: 4, bonus: 0 });
  });

  it('plays a fight to its end and adds up the damage', () => {
    const hero = heroDef(2, KIT_BY_LEVEL[2]);
    const r = simulateFight(hero, foeDefs('rat', 3), seeded(3), KIT_BY_LEVEL[2], 2);
    expect(['victory', 'defeat']).toContain(r.outcome);
    expect(r.slain + r.fled).toBeLessThanOrEqual(3);
    if (r.outcome === 'victory') expect(r.slain + r.fled).toBe(3);
    expect(r.dealt).toBeGreaterThan(0);
    expect(r.taken).toBe(hero.hp - r.heroHp);
  });

  it('brings the Wolf Mother with her wolf', () => {
    const defs = foeDefs('wolfmother', 1, { wolf: 1 });
    expect(defs.map((d) => d.name)).toEqual([FOES.wolfmother.name, FOES.wolf.name]);
    expect(new Set(defs.map((d) => d.id)).size).toBe(2);
  });
});

// The targets FOES is tuned to (see the PR and systems/Combat.ts). If a change to the numbers moves
// these, re-run `npm run sim` and retune, or change the targets on purpose.
describe('balance targets', () => {
  const win = (level: number, kind: Parameters<typeof simulate>[1], count = 1, escort?: Partial<Record<FoeKind, number>>) =>
    simulate(level, kind, count, { fights: 1000, seed: 11, escort }).winRate;

  it('a fresh hero nearly always beats a lone wolf, but it costs them', () => {
    const s = simulate(1, 'wolf', 1, { fights: 1000, seed: 11 });
    expect(s.winRate).toBeGreaterThan(0.95);
    expect(s.hurt).toBeGreaterThan(0.12);
  });

  it('two wolves at level 1 win about 3 times in 4', () => {
    expect(win(1, 'wolf', 2)).toBeGreaterThan(0.65);
    expect(win(1, 'wolf', 2)).toBeLessThan(0.88);
  });

  it('the Wolf Mother in her den is won about 60% of the time at levels 3-4', () => {
    const avg = (win(3, 'wolfmother', 1, { wolf: 1 }) + win(4, 'wolfmother', 1, { wolf: 1 })) / 2;
    expect(avg).toBeGreaterThan(0.5);
    expect(avg).toBeLessThan(0.72);
  });

  it('a wild boar is a harder fight than a lone wolf at level 1, but a fair one', () => {
    expect(win(1, 'boar')).toBeGreaterThan(0.85);
    expect(simulate(1, 'boar', 1, { fights: 1000, seed: 11 }).hurt).toBeGreaterThan(simulate(1, 'wolf', 1, { fights: 1000, seed: 11 }).hurt);
  });

  it('a wild cat in the north woods costs a fresh hero a little more than a lone wolf, but never the fight', () => {
    const cat = simulate(1, 'wildcat', 1, { fights: 1000, seed: 11 });
    const wolf = simulate(1, 'wolf', 1, { fights: 1000, seed: 11 });
    expect(cat.winRate).toBeGreaterThan(0.97);
    expect(cat.hurt).toBeGreaterThan(wolf.hurt);
    expect(cat.hurt).toBeLessThan(simulate(1, 'boar', 1, { fights: 1000, seed: 11 }).hurt);
  });

  it('Rook and Nab on the road are beatable at level 1, and easy by level 3', () => {
    expect(win(1, 'footpad', 1, { cutpurse: 1 })).toBeGreaterThan(0.75);
    expect(win(3, 'footpad', 1, { cutpurse: 1 })).toBeGreaterThan(0.97);
  });
});

describe('the end-of-fight tally', () => {
  const hero = { id: 'hero' };
  const wolf = { id: 'wolf-1' };

  it('counts blows each way, and bleeding', () => {
    const t = new FightTally();
    t.attack({ attacker: hero, target: wolf, hit: true, crit: true, damage: 12 });
    t.attack({ attacker: hero, target: wolf, hit: false, crit: false, damage: 0 });
    t.attack({ attacker: wolf, target: hero, hit: true, crit: false, damage: 7 });
    t.hurt(wolf, 2);
    t.hurt(hero, 1);
    expect(t).toMatchObject({ dealt: 14, taken: 8, hits: 1, misses: 1, crits: 1 });
    expect(t.accuracy).toBe(0.5);
  });

  it('adds up experience, levels and spoils', () => {
    const t = new FightTally();
    t.gained(40);
    t.gained(40);
    t.levelled(2);
    t.took('wolf-pelt', 1);
    t.took('wolf-meat', 1);
    t.took('wolf-pelt', 1);
    expect(t.xp).toBe(80);
    expect(t.levels).toEqual([2]);
    expect([...t.loot]).toEqual([['wolf-pelt', 2], ['wolf-meat', 1]]);
    expect(new FightTally().accuracy).toBe(0);
  });

  it('writes a count only when there is more than one', () => {
    expect(lootLine('Wolf Pelt', 1)).toBe('Wolf Pelt');
    expect(lootLine('Wolf Pelt', 3)).toBe('Wolf Pelt x3');
  });
});
