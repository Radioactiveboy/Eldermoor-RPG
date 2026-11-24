import { describe, expect, it } from 'vitest';
import { Battle, chooseFoeAction, chooseFoeTarget, CombatantDef, FOES, RAID_BRUTE } from '../../src/systems/Combat';
import { LATE_KIT, simulate } from '../../src/systems/CombatSim';
import { chooseCompanionAction, combatDefOf, fighterId } from '../../src/systems/Companions';
import { face, scripted } from './helpers';

const hero = (over: Partial<CombatantDef> = {}): CombatantDef => ({
  id: 'hero', name: 'Arthus', side: 'party', hp: 200, maxHp: 200, ac: 20, toHit: 13,
  damage: { count: 1, sides: 8, bonus: 8 }, quickness: 2, verb: 'swing at', ...over,
});
const brute = (over: Partial<CombatantDef> = {}): CombatantDef => ({
  id: 'brute', side: 'foes', hp: FOES.goblinbrute.maxHp, ...FOES.goblinbrute, ...over,
});
const goblin = (id: string): CombatantDef => ({ id, side: 'foes', hp: FOES.goblin.maxHp, ...FOES.goblin });

describe('who the foes go for', () => {
  it('finishes off whoever one blow will likely drop', () => {
    const battle = new Battle([hero(), combatDefOf('wat', 11, 4), goblin('g')]);
    expect(chooseFoeTarget(battle, battle.combatants[2], () => 0)).toBe(battle.combatants[1]);
  });

  it("doesn't hound a companion just for having less health than the hero", () => {
    // Full health all round: the hero has far more of it, but is still the likelier target.
    const battle = new Battle([hero(), combatDefOf('sigrun', 11, 999), combatDefOf('wat', 11, 999), goblin('g')]);
    const g = battle.combatants[3];
    const picks = new Map<string, number>();
    for (let i = 0; i < 400; i++) {
      const t = chooseFoeTarget(battle, g, () => i / 400);
      picks.set(t.id, (picks.get(t.id) ?? 0) + 1);
    }
    expect(picks.get('hero')).toBe(200);
    expect(picks.get(fighterId('sigrun'))).toBe(100);
    expect(picks.get(fighterId('wat'))).toBe(100);
  });

  it('the Brute has it in for the hero', () => {
    const battle = new Battle([hero(), combatDefOf('sigrun', 11, 999), combatDefOf('wat', 11, 999), brute()]);
    const b = battle.combatants[3];
    let heroPicks = 0;
    for (let i = 0; i < 400; i++) if (chooseFoeTarget(battle, b, () => i / 400).id === 'hero') heroPicks++;
    expect(heroPicks).toBe(300);
  });
});

describe("the Brute's tricks", () => {
  it('opens by shaking the ground under the whole party', () => {
    const battle = new Battle([hero(), combatDefOf('sigrun', 11, 999), brute()]);
    expect(chooseFoeAction(battle, battle.combatants[2], false, () => 0.5)).toEqual({ type: 'quake' });
  });

  it('a quake ignores armour: miss the save and you take it all and fall; make it and you take half', () => {
    // Quake: DC 13, 2d8+3. The hero (+2) rolls a 5 and falls; Sigrun (+2) rolls 15 and keeps her feet.
    const rng = scripted(face(5), face(4, 8), face(4, 8), face(15), face(6, 8), face(6, 8));
    const battle = new Battle([hero(), combatDefOf('sigrun', 11, 999), brute()], rng);
    const [h, s, b] = battle.combatants;
    const results = battle.quake(b);
    expect(results.map((r) => [r.target.id, r.kept, r.damage])).toEqual([
      ['hero', false, 11],
      [s.id, true, 7],
    ]);
    expect(h.hp).toBe(189);
    expect(battle.has(h, 'prone')).toBe(true);
    expect(battle.has(s, 'prone')).toBe(false);
    expect(battle.ready(b, 'quake')).toBe(false);
  });

  it('winds up a crushing blow, then brings it down on the one it was meant for', () => {
    const battle = new Battle([hero(), brute()], scripted());
    const [h, b] = battle.combatants;
    b.cooldowns.quake = 3;
    expect(chooseFoeAction(battle, b, false)).toEqual({ type: 'windup', target: h });
    battle.windUp(b, h);
    expect(battle.status(b, 'windup')?.target).toBe('hero');
    expect(chooseFoeAction(battle, b, false)).toEqual({ type: 'smash', target: h });
  });

  it('the crushing blow rolls its damage twice and knocks the target flat', () => {
    // 15 + 11 against armour 20 hits; 4d10+7 makes 27; the hero rolls a 3 to keep their feet (DC 14) and falls.
    const rng = scripted(face(15), face(5, 10), face(5, 10), face(5, 10), face(5, 10), face(3));
    const battle = new Battle([hero(), brute()], rng);
    const [h, b] = battle.combatants;
    battle.windUp(b, h);
    const r = battle.smash(b, h);
    expect(r.hit).toBe(true);
    expect(r.damage).toBe(27);
    expect(r.trip?.fell).toBe(true);
    expect(battle.has(h, 'prone')).toBe(true);
    expect(battle.has(b, 'windup')).toBe(false);
  });

  it('knocked down while winding up, the Brute loses the blow', () => {
    const battle = new Battle([hero(), brute()]);
    const [h, b] = battle.combatants;
    battle.windUp(b, h);
    battle.addStatus(b, 'prone', 1);
    expect(battle.has(b, 'windup')).toBe(false);
  });

  it('Sigrun shield-bashes a Brute winding up a blow', () => {
    const battle = new Battle([hero(), combatDefOf('sigrun', 11, 999), brute()]);
    const [h, s, b] = battle.combatants;
    battle.windUp(b, h);
    expect(chooseCompanionAction(battle, s, 'veteran', { stood: false })).toEqual({ type: 'bash', target: b });
  });

  it('goes berserk once, at half health: up off the floor, clear-headed, and hitting harder', () => {
    const battle = new Battle([hero(), brute()]);
    const b = battle.combatants[1];
    expect(battle.shouldEnrage(b)).toBe(false);
    b.hp = Math.floor(b.maxHp / 2);
    battle.addStatus(b, 'prone', 1);
    battle.addStatus(b, 'dazed', 2);
    expect(battle.shouldEnrage(b)).toBe(true);
    const before = battle.toHitAgainst(b, battle.combatants[0]);
    battle.enrage(b);
    expect(battle.has(b, 'prone')).toBe(false);
    expect(battle.has(b, 'dazed')).toBe(false);
    expect(battle.toHitAgainst(b, battle.combatants[0])).toBe(before + 2);
    battle.addStatus(b, 'dazed', 2);
    expect(battle.has(b, 'dazed')).toBe(false);
    expect(battle.shouldEnrage(b)).toBe(false);
  });

  it('keeps his tricks for the brood hall: in the raid he only howls', () => {
    const raid = { ...FOES.goblinbrute, ...RAID_BRUTE };
    expect(raid.traits!.map((t) => t.kind)).toEqual(['grudge', 'howl', 'steady']);
    expect(raid.maxHp).toBeLessThan(FOES.goblinbrute.maxHp);
  });
});

describe('the Brute in the brood hall', () => {
  it('at level 11 with Sigrun and Wat, the hero wins but takes real punishment', () => {
    const s = simulate(11, 'goblinbrute', 1, { fights: 500, seed: 11, kit: LATE_KIT, escort: { goblin: 1, goblinspear: 1 }, allies: ['sigrun', 'wat'] });
    expect(s.winRate).toBeGreaterThan(0.95);
    expect(s.hurt).toBeGreaterThan(0.25);
    expect(s.hurt).toBeLessThan(0.55);
  });

  it('is a hard fight alone', () => {
    const s = simulate(11, 'goblinbrute', 1, { fights: 500, seed: 11, kit: LATE_KIT, escort: { goblin: 1, goblinspear: 1 } });
    expect(s.winRate).toBeGreaterThan(0.5);
    expect(s.winRate).toBeLessThan(0.9);
  });
});
