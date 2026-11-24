import { beforeEach, describe, expect, it } from 'vitest';
import { bondTalk, giftable, healers, VOICES } from '../../src/dialogue/companionTalk';
import { combatDefOf, Companions } from '../../src/systems/Companions';
import { Inventory } from '../../src/systems/Inventory';
import { QuestLog } from '../../src/systems/Quests';
import {
  bondCombatBonus, bondLevelOf, bondPrice, BondEvent, GIFT_BOND, Relationships, willTravel,
} from '../../src/systems/Relationships';

let events: BondEvent[] = [];
let off: () => void;
let day = 1;

beforeEach(() => {
  QuestLog.reset();
  day = 1;
  QuestLog.dayProvider = () => day;
  Relationships.reset();
  Companions.reset();
  Inventory.reset();
  off?.();
  events = [];
  off = Relationships.onChange((e) => events.push(e));
});

describe('bond levels', () => {
  it('reads scores as levels, in order', () => {
    expect(bondLevelOf(-50)).toBe('resentful');
    expect(bondLevelOf(-10)).toBe('wary');
    expect(bondLevelOf(0)).toBe('acquainted');
    expect(bondLevelOf(20)).toBe('friendly');
    expect(bondLevelOf(45)).toBe('close');
    expect(bondLevelOf(100)).toBe('trusted');
  });

  it('starts Sigrun cold and Wat keen, both just acquainted', () => {
    expect(Relationships.score('sigrun')).toBe(0);
    expect(Relationships.score('wat')).toBeGreaterThan(0);
    expect(Relationships.level('sigrun')).toBe('acquainted');
    expect(Relationships.level('wat')).toBe('acquainted');
  });

  it('announces each change, and a new level once', () => {
    Relationships.gain('sigrun', 12);
    Relationships.gain('sigrun', 12);
    expect(events.filter((e) => e.type === 'level')).toEqual([{ type: 'level', id: 'sigrun', level: 'friendly', rose: true }]);
    Relationships.gain('sigrun', -200);
    expect(Relationships.score('sigrun')).toBe(-100);
  });
});

describe('gifts', () => {
  it('counts what they think of it, once a day', () => {
    expect(Relationships.gift('sigrun', 'mead')).toBe('loved');
    expect(Relationships.score('sigrun')).toBe(GIFT_BOND.loved);
    expect(Relationships.canGift('sigrun')).toBe(false);
    Relationships.gift('sigrun', 'mead');
    expect(Relationships.score('sigrun')).toBe(GIFT_BOND.loved);
    day = 2;
    expect(Relationships.gift('sigrun', 'honey-cake')).toBe('disliked');
    expect(Relationships.score('sigrun')).toBe(GIFT_BOND.loved + GIFT_BOND.disliked);
  });

  it('gives each of them different tastes', () => {
    Relationships.gift('wat', 'honey-cake');
    expect(events.find((e) => e.type === 'changed')).toMatchObject({ id: 'wat', delta: GIFT_BOND.loved });
  });

  it('offers food, drink and brews from the satchel, but not gear or quest things', () => {
    const bag = [{ id: 'bread' as const, count: 2 }, { id: 'walking-staff' as const, count: 1 }, { id: 'rag-doll' as const, count: 1 }, { id: 'healing-draught' as const, count: 1 }, null];
    expect(giftable(bag)).toEqual(['bread', 'healing-draught']);
    expect(healers(bag)).toEqual(['healing-draught', 'bread']);
  });
});

describe('what a bond changes', () => {
  it("prices Sigrun's company by how she feels", () => {
    expect(bondPrice(40, 'acquainted')).toBe(40);
    expect(bondPrice(40, 'wary')).toBe(60);
    expect(bondPrice(40, 'close')).toBe(20);
    expect(bondPrice(40, 'trusted')).toBe(0);
  });

  it('makes them fight better beside a friend', () => {
    const before = combatDefOf('sigrun', 1, 38);
    Relationships.gain('sigrun', 80);
    const after = combatDefOf('sigrun', 1, 38);
    expect(after.toHit - before.toHit).toBe(bondCombatBonus('trusted').toHit);
    expect(after.ac - before.ac).toBe(1);
  });

  it("won't travel with someone they resent", () => {
    expect(willTravel('wary')).toBe(true);
    expect(willTravel('resentful')).toBe(false);
  });

  it('caps the bond from fights won together each day', () => {
    for (let i = 0; i < 10; i++) Relationships.foughtBeside('wat');
    expect(Relationships.score('wat')).toBe(12 + 3);
  });
});

describe('getting to know them', () => {
  const talk = (id: 'sigrun' | 'wat') => bondTalk({ id, speaker: id, bag: Inventory.bag, hurt: true, back: 'ask' });

  it('rebuffs a personal question asked too soon, and answers it once trusted', () => {
    const early = talk('sigrun');
    expect(early.nodes['bond-topic-scar'].action).toBe('bond:pry:sigrun');
    Relationships.gain('sigrun', 50);
    const later = talk('sigrun');
    expect(later.nodes['bond-topic-scar'].action).toBe('bond:topic:sigrun:scar');
    expect(later.nodes['bond-topic-scar'].choices?.length).toBeGreaterThan(0);
  });

  it('leads every reply somewhere that exists', () => {
    for (const id of ['sigrun', 'wat'] as const) {
      Relationships.gain(id, 100);
      const { choices, nodes } = talk(id);
      const all: Record<string, unknown> = { ...nodes, ask: { speaker: id, lines: [''] } };
      for (const c of choices) expect(all[c.next!], `${id}: ${c.text}`).toBeDefined();
      for (const [key, n] of Object.entries(nodes)) {
        if (n.next) expect(all[n.next], `${id} ${key} -> ${n.next}`).toBeDefined();
        for (const c of n.choices ?? []) if (c.next) expect(all[c.next], `${id} ${key}: ${c.text}`).toBeDefined();
      }
    }
  });

  it('offers an apology only once they have cooled on the hero', () => {
    expect(talk('sigrun').choices.some((c) => c.text === VOICES.sigrun.sorry.text)).toBe(false);
    Relationships.gain('sigrun', -10);
    expect(talk('sigrun').choices.some((c) => c.text === VOICES.sigrun.sorry.text)).toBe(true);
  });
});

describe('saving', () => {
  it('keeps bonds, stories told and the day of the last gift', () => {
    Relationships.gain('wat', 20);
    Relationships.mark('wat', 'topic:family');
    Relationships.gift('sigrun', 'ale');
    const data = Relationships.toSave();
    Relationships.reset();
    Relationships.fromSave(JSON.parse(JSON.stringify(data)));
    expect(Relationships.score('wat')).toBe(32);
    expect(Relationships.has('wat', 'topic:family')).toBe(true);
    expect(Relationships.canGift('sigrun')).toBe(false);
  });
});
