import { beforeEach, describe, expect, it } from 'vitest';
import { applyBoon, Battle, boonText, CombatantDef, FOES } from '../../src/systems/Combat';
import { Crafting, RECIPES } from '../../src/systems/Crafting';
import { Herbs, HERB_REGROW_HOURS, HERBS } from '../../src/systems/Herbs';
import { Inventory, itemDef, itemEffects, ITEMS } from '../../src/systems/Inventory';
import { face, scripted } from './helpers';

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;
const hero = (over: Partial<CombatantDef> = {}): CombatantDef => ({
  id: 'hero', name: 'Arthus', side: 'party', hp: 30, maxHp: 30, ac: 12, toHit: 3,
  damage: { count: 1, sides: 6, bonus: 1 }, quickness: 2, verb: 'swing at', ...over,
});
const foe = (kind: 'wolf' | 'boar'): CombatantDef => ({ id: kind, side: 'foes', hp: FOES[kind].maxHp, ...FOES[kind], traits: [] });

beforeEach(() => {
  Inventory.reset();
  Crafting.reset();
  Herbs.reset();
});

describe("new brews at Maud's bench", () => {
  it('each can be made from herbs that can be gathered', () => {
    const herbItems = new Set(Object.values(HERBS).map((h) => h.item));
    for (const id of ['healing-draught', 'stamina-tonic', 'wolfsbane-oil', 'stout-draught']) {
      const r = recipe(id);
      expect(r.station).toBe('alchemy');
      expect(r.needs.some(([item]) => herbItems.has(item))).toBe(true);
      for (const [item, n] of r.needs) Inventory.add(item, n);
      expect(Crafting.make(r, 1)).toBe(true);
      expect(Inventory.count(r.makes)).toBe(r.yields);
    }
  });

  it('knows the healing draught from the start, and the rest are found by trying', () => {
    expect(Crafting.isKnown(recipe('healing-draught'))).toBe(true);
    expect(Crafting.isKnown(recipe('wolfsbane-oil'))).toBe(false);
    expect(Crafting.match('alchemy', ['pinecone', 'wolfsbane'])?.id).toBe('wolfsbane-oil');
  });

  it('drinks heal or refresh, and the fight brews say what they do', () => {
    expect(itemDef('healing-draught').eat?.health).toBeGreaterThan(itemDef('fever-tincture').eat!.health! );
    expect(itemDef('stamina-tonic').eat?.stamina).toBeGreaterThan(50);
    expect(itemEffects(itemDef('wolfsbane-oil'))).toContain('In a fight: +1d6 damage against wolves for the fight');
    expect(itemEffects(itemDef('stout-draught'))).toContain('In a fight: +2 armour for the fight');
    // An oil isn't eaten: it's only any use in a fight.
    expect(itemDef('wolfsbane-oil').eat).toBeUndefined();
  });

  it('every item a recipe uses or makes exists, with an icon', () => {
    for (const r of RECIPES) {
      for (const id of [r.makes, ...r.needs.map(([i]) => i)]) {
        expect(ITEMS[id], id).toBeDefined();
        expect(itemDef(id).icon).toMatch(/^item-/);
      }
    }
  });
});

describe('brews in a fight', () => {
  it('wolfsbane oil adds a d6 to every hit on a wolf, for the rest of the fight', () => {
    const battle = new Battle([hero(), foe('wolf')], scripted(face(15), face(4, 6), face(3, 6)));
    const [h, w] = battle.combatants;
    applyBoon(battle, h, itemDef('wolfsbane-oil').boon!);
    expect(battle.has(h, 'anointed')).toBe(true);
    const hit = battle.attack(h, w);
    expect(hit.damage).toBe(1 + 4 + 3);
    expect(hit.bane).toBe(3);
    // It lasts: ending turns doesn't wear it off.
    battle.rollInitiative = () => [];
    battle.order = [h, w];
    battle.endTurn();
    expect(battle.has(h, 'anointed')).toBe(true);
  });

  it('does nothing extra against a boar', () => {
    // Only the to-hit and damage dice are rolled: scripted() throws if a bane die is asked for.
    const battle = new Battle([hero(), foe('boar')], scripted(face(15), face(4, 6)));
    const [h, b] = battle.combatants;
    applyBoon(battle, h, itemDef('wolfsbane-oil').boon!);
    expect(battle.attack(h, b).damage).toBe(5);
  });

  it('a stout draught adds to armour', () => {
    const battle = new Battle([hero(), foe('wolf')]);
    const [h] = battle.combatants;
    const before = battle.armourOf(h);
    applyBoon(battle, h, itemDef('stout-draught').boon!);
    expect(battle.armourOf(h)).toBe(before + 2);
    expect(boonText({ kind: 'ward', armour: 2 })).toBe('+2 armour for the fight');
  });
});

describe('wild herbs', () => {
  it('grow back a day and a half after picking', () => {
    expect(Herbs.isReady('yarrow-gate', 10)).toBe(true);
    Herbs.pick('yarrow-gate', 10);
    expect(Herbs.isReady('yarrow-gate', 10 + HERB_REGROW_HOURS - 1)).toBe(false);
    expect(Herbs.isReady('yarrow-gate', 10 + HERB_REGROW_HOURS)).toBe(true);
    expect(Herbs.isReady('nettle-gate', 11)).toBe(true);
  });

  it('remember what was picked in a save, and load an old save without any', () => {
    Herbs.pick('cloister-sage-0', 50);
    const saved = JSON.parse(JSON.stringify(Herbs.toSave()));
    Herbs.reset();
    Herbs.fromSave(saved);
    expect(Herbs.isReady('cloister-sage-0', 60)).toBe(false);
    Herbs.fromSave(undefined);
    expect(Herbs.isReady('cloister-sage-0', 60)).toBe(true);
  });

  it('each gives a real item', () => {
    for (const h of Object.values(HERBS)) expect(ITEMS[h.item]).toBeDefined();
  });
});
