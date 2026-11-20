import { describe, expect, it } from 'vitest';
import { Battle, CombatantDef, FOES, WeaponEffect, weaponEffectText } from '../../src/systems/Combat';
import { ITEMS, itemDef, itemEffects, weaponOf } from '../../src/systems/Inventory';
import { SHOPS } from '../../src/systems/Shops';
import { face, scripted } from './helpers';

const hero = (weapon?: WeaponEffect): CombatantDef => ({
  id: 'hero', name: 'Arthus', side: 'party', hp: 30, maxHp: 30, ac: 12, toHit: 3,
  damage: { count: 1, sides: 6, bonus: 1 }, quickness: 2, verb: 'swing at', weapon,
});
const boar = (): CombatantDef => ({ id: 'boar', side: 'foes', hp: FOES.boar.maxHp, ...FOES.boar });

function fight(weapon: WeaponEffect | undefined, ...rolls: number[]) {
  const battle = new Battle([hero(weapon), boar()], scripted(...rolls));
  const [h, b] = battle.combatants;
  return { battle, h, b };
}

describe('the new weapons', () => {
  it('each has its own die, rule, icon, price and a stall that sells it', () => {
    const sold = new Set(Object.values(SHOPS).flatMap((s) => s.stock.map(([id]) => id)));
    for (const [id, die, kind] of [['spear', 8, 'set'], ['hatchet', 6, 'cleave'], ['sling', 4, 'opening'], ['cudgel', 6, 'daze']] as const) {
      const w = weaponOf(id);
      expect(w.die).toBe(die);
      expect(w.effect?.kind).toBe(kind);
      expect(ITEMS[id].icon).toBe(`item-${id}`);
      expect(ITEMS[id].value).toBeGreaterThan(0);
      expect(sold.has(id)).toBe(true);
      expect(itemEffects(itemDef(id))).toContain(weaponEffectText(w.effect!));
    }
  });

  it('fists roll a d4 and an unmarked weapon a d6', () => {
    expect(weaponOf(undefined).die).toBe(4);
    expect(weaponOf('short-sword').die).toBe(6);
  });
});

describe('weapon rules', () => {
  it("a spear gets +1 to hit a foe that hasn't attacked yet, and not after", () => {
    // Hero +3 vs boar AC 13: a 9 makes 12, a miss, but the set spear makes it 13.
    const { battle, h, b } = fight({ kind: 'set', toHit: 1 }, face(9), face(3, 6));
    const r = battle.attack(h, b);
    expect(r.hit).toBe(true);
    expect(r.set).toBe(1);
    b.attacksMade = 1;
    expect(battle.setBonus(h, b)).toBe(0);
  });

  it('a hatchet hit can leave the foe bleeding', () => {
    const { battle, h, b } = fight({ kind: 'cleave', chance: 0.35, damage: 2, turns: 2 }, face(15), face(3, 6), 0.1);
    const r = battle.attack(h, b);
    expect(r.cleaved).toBe(true);
    expect(battle.status(b, 'bleeding')).toMatchObject({ value: 2, turns: 2 });
  });

  it("a hatchet hit that doesn't bite deep leaves no wound", () => {
    const { battle, h, b } = fight({ kind: 'cleave', chance: 0.35, damage: 2, turns: 2 }, face(15), face(3, 6), 0.9);
    expect(battle.attack(h, b).cleaved).toBeUndefined();
    expect(battle.has(b, 'bleeding')).toBe(false);
  });

  it('a cudgel hit can daze, giving the foe disadvantage', () => {
    const { battle, h, b } = fight({ kind: 'daze', chance: 0.3, turns: 1 }, face(15), face(3, 6), 0.1);
    expect(battle.attack(h, b).dazed).toBe(true);
    expect(battle.rollMode(b, h)).toBe(-1);
  });

  it('a miss never bleeds or dazes', () => {
    const { battle, h, b } = fight({ kind: 'daze', chance: 1, turns: 1 }, face(2));
    expect(battle.attack(h, b).hit).toBe(false);
    expect(battle.has(b, 'dazed')).toBe(false);
  });
});
