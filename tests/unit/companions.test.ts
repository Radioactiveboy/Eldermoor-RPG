import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('phaser', async () => (await import('./maps')).phaserMock());
import { Battle, chooseFoeAction, CombatantDef, FOES } from '../../src/systems/Combat';
import {
  BASH_COOLDOWN,
  chooseCompanionAction,
  combatDefOf,
  COMPANION_IDS,
  companionOf,
  COMPANIONS,
  Companions,
  fighterId,
  MAX_PARTY,
  maxHpOf,
  REGEN_PER_HOUR,
} from '../../src/systems/Companions';
import { SaveGame } from '../../src/systems/SaveGame';
import { allMaps } from './maps';

const hero = (over: Partial<CombatantDef> = {}): CombatantDef => ({
  id: 'hero', name: 'Arthus', side: 'party', hp: 30, maxHp: 30, ac: 12, toHit: 3,
  damage: { count: 1, sides: 6, bonus: 1 }, quickness: 2, verb: 'swing at', ...over,
});
const wolf = (id: string, over: Partial<CombatantDef> = {}): CombatantDef => ({ id, side: 'foes', hp: FOES.wolf.maxHp, ...FOES.wolf, ...over });

beforeEach(() => Companions.reset());

describe('the party', () => {
  it('takes on someone who agrees to come, up to the most it can hold', () => {
    expect(Companions.recruit('sigrun')).toBe(true);
    expect(Companions.isWith('sigrun')).toBe(true);
    expect(Companions.recruit('wat')).toBe(true);
    expect(Companions.party).toEqual(['sigrun', 'wat']);
    expect(Companions.party.length).toBe(MAX_PARTY);
    expect(Companions.full).toBe(true);
  });

  it("won't let anyone join who hasn't agreed to come", () => {
    expect(Companions.join('wat')).toBe(false);
    expect(Companions.party).toEqual([]);
  });

  it('sends someone home, and lets them come again', () => {
    Companions.recruit('sigrun');
    Companions.leave('sigrun');
    expect(Companions.isWith('sigrun')).toBe(false);
    expect(Companions.isRecruited('sigrun')).toBe(true);
    expect(Companions.join('sigrun')).toBe(true);
  });

  it('keeps out of fights anyone who only guides', () => {
    Companions.recruit('sigrun');
    expect(Companions.fighters).toEqual(['sigrun']);
  });
});

describe('health', () => {
  it('starts full and grows with the hero', () => {
    expect(Companions.hp('sigrun', 1)).toBe(COMPANIONS.sigrun.combat.hp);
    expect(maxHpOf('sigrun', 3)).toBe(COMPANIONS.sigrun.combat.hp + 2 * COMPANIONS.sigrun.combat.hpPerLevel);
  });

  it('comes back over time, and all at once after a sleep', () => {
    Companions.setHp('wat', 10, 1);
    Companions.tick(100, 1);
    Companions.tick(102, 1);
    expect(Companions.hp('wat', 1)).toBe(10 + 2 * REGEN_PER_HOUR);
    Companions.rested();
    expect(Companions.hp('wat', 1)).toBe(maxHpOf('wat', 1));
  });

  it('goes into a fight with the health they have', () => {
    const def = combatDefOf('sigrun', 1, 12);
    expect(def).toMatchObject({ id: fighterId('sigrun'), side: 'party', hp: 12, maxHp: 38, name: 'Sigrun' });
    expect(companionOf(def)).toBe('sigrun');
    expect(companionOf({ id: 'hero' })).toBeUndefined();
  });
});

describe('saving', () => {
  it('remembers who agreed to come, who is along, and how hurt they are', () => {
    Companions.recruit('sigrun');
    Companions.recruit('wat');
    Companions.leave('sigrun');
    Companions.setHp('wat', 9, 1);
    const saved = JSON.parse(JSON.stringify(SaveGame.collect()));
    Companions.reset();
    Companions.fromSave(saved.companions);
    expect([...Companions.recruited].sort()).toEqual(['sigrun', 'wat']);
    expect(Companions.party).toEqual(['wat']);
    expect(Companions.hp('wat', 1)).toBe(9);
  });

  it('starts with nobody from a save made before companions', () => {
    Companions.recruit('sigrun');
    Companions.fromSave(undefined);
    expect(Companions.party).toEqual([]);
  });

  it('drops anyone in the party who never agreed, or names nobody it knows', () => {
    Companions.fromSave({ recruited: ['wat'], party: ['wat', 'sigrun', 'nobody' as never], health: {} });
    expect(Companions.party).toEqual(['wat']);
  });
});

describe('fighting alongside', () => {
  it('a veteran finishes off a foe she can kill in one blow', () => {
    const battle = new Battle([hero(), combatDefOf('sigrun', 1, 38), wolf('w1', { hp: 5 }), wolf('w2')]);
    const me = battle.combatants[1];
    const a = chooseCompanionAction(battle, me, 'veteran', { stood: false });
    expect(a).toMatchObject({ type: 'attack', target: { id: 'w1' } });
  });

  it('a veteran shield-bashes the toughest foe, then waits for her shield arm to recover', () => {
    const battle = new Battle([hero(), combatDefOf('sigrun', 1, 38), { id: 'mother', side: 'foes', hp: 80, ...FOES.wolfmother }]);
    const me = battle.combatants[1];
    const first = chooseCompanionAction(battle, me, 'veteran', { stood: false });
    expect(first).toMatchObject({ type: 'bash', target: { id: 'mother' } });
    battle.cooldown(me, 'bash', BASH_COOLDOWN);
    expect(chooseCompanionAction(battle, me, 'veteran', { stood: false })).toMatchObject({ type: 'attack' });
  });

  it('a shieldmate goes for the foe the hero has marked', () => {
    const battle = new Battle([hero(), combatDefOf('wat', 1, 26), wolf('w1'), wolf('w2', { hp: 3 })]);
    const [h, me, w1] = battle.combatants;
    battle.addStatus(w1, 'marked', 3, { by: h.id });
    expect(chooseCompanionAction(battle, me, 'shieldmate', { stood: false })).toMatchObject({ type: 'attack', target: { id: 'w1' } });
  });

  it('a shieldmate raises his guard when badly hurt', () => {
    const battle = new Battle([hero(), combatDefOf('wat', 1, 5), wolf('w1')]);
    expect(chooseCompanionAction(battle, battle.combatants[1], 'shieldmate', { stood: false })).toEqual({ type: 'guard' });
  });

  it('spends the turn getting up when knocked down', () => {
    const battle = new Battle([hero(), combatDefOf('wat', 1, 26), wolf('w1')]);
    expect(chooseCompanionAction(battle, battle.combatants[1], 'shieldmate', { stood: true })).toEqual({ type: 'stand' });
  });

  it('keeps the fight going while a companion stands, after the hero falls', () => {
    const battle = new Battle([hero({ hp: 0 }), combatDefOf('sigrun', 1, 20), wolf('w1')]);
    expect(battle.outcome()).toBe('ongoing');
    // The beasts turn on whoever is still up.
    expect(chooseFoeAction(battle, battle.combatants[2], false, () => 0.99)).toMatchObject({ type: 'attack', target: { id: fighterId('sigrun') } });
    battle.combatants[1].hp = 0;
    expect(battle.outcome()).toBe('defeat');
  });
});

describe('where they wait', () => {
  it('each one has an NPC on open ground in their home area', async () => {
    const maps = await allMaps();
    for (const id of COMPANION_IDS) {
      const def = COMPANIONS[id];
      const spawn = maps[def.home.area].npcs?.find((n) => n.id === def.npc);
      expect(spawn, `${id} waits in ${def.home.area}`).toBeDefined();
    }
    const wat = maps.market.npcs!.find((n) => n.id === 'wat')!;
    expect(maps.market.props[Math.floor(wat.gy)][Math.floor(wat.gx)]).toBe(0);
  });
});
