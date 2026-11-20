import { describe, expect, it } from 'vitest';
import { Battle, chooseFoeAction, CombatantDef, diceText, FOES } from '../../src/systems/Combat';
import { face, scripted } from './helpers';

const hero = (over: Partial<CombatantDef> = {}): CombatantDef => ({
  id: 'hero', name: 'Arthus', side: 'party', hp: 30, maxHp: 30, ac: 12, toHit: 3,
  damage: { count: 1, sides: 6, bonus: 1 }, quickness: 2, verb: 'swing at', ...over,
});
const wolf = (over: Partial<CombatantDef> = {}): CombatantDef => ({
  id: 'wolf', side: 'foes', hp: FOES.wolf.maxHp, ...FOES.wolf, ...over,
});

function fight(defs: CombatantDef[], ...rolls: number[]) {
  const rng = scripted(...rolls);
  const battle = new Battle(defs, rng);
  const [a, b] = battle.combatants;
  return { battle, a, b, rng };
}

describe('dice', () => {
  it('writes dice the tabletop way', () => {
    expect(diceText({ count: 2, sides: 4, bonus: 2 })).toBe('2d4+2');
    expect(diceText({ count: 1, sides: 6, bonus: 0 })).toBe('1d6');
    expect(diceText({ count: 1, sides: 8, bonus: -1 })).toBe('1d8-1');
  });

  it('rolls every face of a die and never less than 1 in total', () => {
    const battle = new Battle([]);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(battle.d(6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    const penalty = new Battle([], scripted(face(1, 4)));
    expect(penalty.rollDice({ count: 1, sides: 4, bonus: -3 })).toBe(1);
  });
});

describe('attack rolls', () => {
  it('hits when d20 + bonus reaches armour, and rolls damage', () => {
    // Hero +3 vs wolf AC 12: a 9 makes 12 exactly. Damage 1d6+1 rolls a 4.
    const { battle, a, b } = fight([hero(), wolf({ traits: [] })], face(9), face(4, 6));
    const r = battle.attack(a, b);
    expect(r).toMatchObject({ roll: 9, total: 12, ac: 12, hit: true, crit: false, damage: 5 });
    expect(b.hp).toBe(FOES.wolf.maxHp - 5);
  });

  it('misses one short of the armour', () => {
    const { battle, a, b, rng } = fight([hero(), wolf()], face(8));
    expect(battle.attack(a, b)).toMatchObject({ total: 11, hit: false, damage: 0 });
    expect(rng.left()).toBe(0);
  });

  it('always misses on a natural 1, however big the bonus', () => {
    const { battle, a, b } = fight([hero({ toHit: 30 }), wolf()], face(1));
    expect(battle.attack(a, b)).toMatchObject({ roll: 1, hit: false });
  });

  it('always hits on a natural 20 and rolls the damage dice twice', () => {
    // Even against armour it could never reach: 20 + 0 vs AC 40.
    const { battle, a, b } = fight([hero({ toHit: 0 }), wolf({ ac: 40, traits: [] })], face(20), face(3, 6), face(5, 6));
    expect(battle.attack(a, b)).toMatchObject({ hit: true, crit: true, damage: 3 + 5 + 1 });
  });

  it('counts armour from a raised guard', () => {
    const { battle, a, b } = fight([hero(), wolf()], face(12));
    battle.defend(b);
    expect(battle.armourOf(b)).toBe(16);
    expect(battle.attack(a, b)).toMatchObject({ total: 15, ac: 16, hit: false });
  });

  it('rolls with advantage against a prone target and keeps the higher die', () => {
    const { battle, a, b } = fight([hero(), wolf({ traits: [] })], face(3), face(15), face(2, 6));
    battle.addStatus(b, 'prone', 1);
    const r = battle.attack(a, b);
    expect(r).toMatchObject({ mode: 1, rolls: [3, 15], roll: 15, hit: true });
  });

  it('rolls with disadvantage when dazed and keeps the lower die', () => {
    const { battle, a, b } = fight([hero(), wolf()], face(18), face(4));
    battle.addStatus(a, 'dazed', 2);
    expect(battle.attack(a, b)).toMatchObject({ mode: -1, roll: 4, hit: false });
  });

  it('cancels advantage and disadvantage out', () => {
    const { battle, a, b } = fight([hero(), wolf()]);
    battle.addStatus(b, 'prone', 1);
    battle.addStatus(a, 'dazed', 2);
    expect(battle.rollMode(a, b)).toBe(0);
  });

  it('gives a pack +2 to hit while more than one is standing', () => {
    const { battle, b } = fight([hero(), wolf(), wolf({ id: 'wolf2' })]);
    const target = battle.combatants[0];
    expect(battle.toHitAgainst(b, target)).toBe(FOES.wolf.toHit + 2);
    battle.combatants[2].hp = 0;
    expect(battle.toHitAgainst(b, target)).toBe(FOES.wolf.toHit);
  });

  it('works out the chance to hit, natural 1s and 20s included', () => {
    const chance = (toHit: number) => {
      const b = new Battle([hero({ toHit }), wolf()]);
      return b.hitChance(b.combatants[0], b.combatants[1]);
    };
    expect(chance(3)).toBeCloseTo(12 / 20); // needs a 9 or better
    expect(chance(50)).toBeCloseTo(19 / 20); // a 1 still misses
    expect(chance(-50)).toBeCloseTo(1 / 20); // a 20 still hits
    const { battle, a, b } = fight([hero(), wolf()]);
    battle.addStatus(b, 'prone', 1);
    expect(battle.hitChance(a, b)).toBeCloseTo(1 - (8 / 20) ** 2);
  });

  it("knocks the target down when a wolf's bite trips it", () => {
    // Wolf +4 (alone, so no pack bonus) rolls 15, 2d4+2 rolls 1+1; the hero's save 3+2 fails DC 9.
    const { battle, a, b } = fight([hero(), wolf()], face(15), face(1, 4), face(1, 4), face(3));
    const r = battle.attack(b, a);
    expect(r.damage).toBe(4);
    expect(r.trip).toMatchObject({ roll: 3, total: 5, dc: 9, fell: true });
    expect(battle.has(a, 'prone')).toBe(true);
  });

  it("adds a boar's charge only to its first attack", () => {
    const boar = { id: 'boar', side: 'foes' as const, hp: 30, ...FOES.boar };
    const { battle, a, b } = fight([hero({ ac: 5 }), boar], face(10), face(2, 8), face(6, 6), face(10), face(2, 8));
    expect(battle.attack(b, a)).toMatchObject({ charged: true, damage: 2 + 2 + 6 });
    expect(battle.attack(b, a).charged).toBeUndefined();
  });
});

describe('turns and statuses', () => {
  it('orders by initiative, then quickness, then the party first', () => {
    // Hero rolls 10 (+2 = 12), wolf 10 (+2 = 12): tie on both counts, the party goes first.
    const { battle, a } = fight([hero(), wolf()], face(10), face(10));
    battle.rollInitiative();
    expect(battle.current).toBe(a);
  });

  it('bleeds at the start of a turn and drops a guard', () => {
    const { battle, a } = fight([hero(), wolf()], face(20), face(1));
    battle.rollInitiative();
    battle.addStatus(a, 'bleeding', 2, { value: 3 });
    battle.defend(a);
    const start = battle.beginTurn();
    expect(start).toMatchObject({ bled: 3, expired: ['guarded'] });
    expect(a.hp).toBe(27);
    battle.endTurn();
    expect(battle.status(a, 'bleeding')?.turns).toBe(1);
  });

  it('declares victory, defeat or escape', () => {
    const { battle, a, b } = fight([hero(), wolf()]);
    expect(battle.outcome()).toBe('ongoing');
    b.hp = 0;
    expect(battle.outcome()).toBe('victory');
    b.hp = 5;
    a.fled = true;
    expect(battle.outcome()).toBe('escaped');
    a.fled = false;
    a.hp = 0;
    expect(battle.outcome()).toBe('defeat');
  });

  it('makes running away harder with each extra foe', () => {
    const { battle, a } = fight([hero(), wolf(), wolf({ id: 'w2' }), wolf({ id: 'w3' })]);
    expect(battle.fleeDc(a)).toBe(14);
  });

  it('sends a beast after the weakest of the party', () => {
    const { battle } = fight([hero({ hp: 20 }), hero({ id: 'ally', hp: 4 }), wolf()]);
    const action = chooseFoeAction(battle, battle.combatants[2], false, () => 0.99);
    expect(action).toEqual({ type: 'attack', target: battle.combatants[1] });
  });
});
