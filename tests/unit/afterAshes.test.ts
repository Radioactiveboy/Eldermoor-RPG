import { beforeEach, describe, expect, it } from 'vitest';
import { raidAware } from '../../src/dialogue/afterRaid';
import { ashesState, coombeAtTankardScript, hildeAtTankardScript, IRAN_AFTER_ASHES, toldOfAshes } from '../../src/dialogue/afterAshes';
import type { DialogueScript } from '../../src/dialogue/Dialogue';
import { BAKER, militiaScript, SMITH, TANNER } from '../../src/dialogue/market';
import { CARTER, HERBWIFE, tollGuardScript } from '../../src/dialogue/plains';
import { porterScript } from '../../src/dialogue/monastery';
import { anselmScript, PRIOR } from '../../src/dialogue/abbey';
import { fishermanScript } from '../../src/dialogue/fisherman';
import { harlanScript, landlordNews, landlordScript, maidScript, pellScript, sigrunScript } from '../../src/dialogue/tavern';
import { goblinPrisonerScript, jailerScript, sergeantScript } from '../../src/dialogue/garrison';
import { headmanScript, stewardScript } from '../../src/dialogue/residence';
import { ASHES_ACTIONS, COOMBE_PURSE, HEADMAN_PURSE } from '../../src/scenes/game/ashes';
import { Inventory } from '../../src/systems/Inventory';
import { QuestLog } from '../../src/systems/Quests';
import { Reputation } from '../../src/systems/Reputation';
import type { GameScene } from '../../src/scenes/GameScene';

/** Everyone with something to say once Mother is buried, by NPC id, as their own scripts would build it then. */
const PEOPLE: Record<string, () => DialogueScript> = {
  headman: () => headmanScript({ first: false, raidOver: true, toldRaid: true, medicine: false, paidToll: true, slewWolfMother: true, goblinTalked: true, paysSigrun: true }),
  sergeant: () => sergeantScript({ first: false, raidOver: true, toldRaid: true, standing: 'liked', bounties: 1, slewWolfMother: true, goblinTalked: true }),
  snikkit: () => goblinPrisonerScript({ first: false, talked: true }),
  jailer: () => jailerScript(true, false),
  steward: () => stewardScript(true, false, true),
  'guard-1': () => militiaScript('greet', { standing: 'known', bounties: 0 }),
  baker: () => BAKER,
  smith: () => SMITH,
  tanner: () => TANNER,
  landlord: () =>
    landlordScript({
      first: false, coins: 50, room: 1, renting: true, nightsLeft: 2, rats: 'none', late: false, freeDrink: false,
      news: landlordNews({ paidToll: true, slewWolfMother: true, foundCaveDoor: true, monasteryOpen: true, raidOver: true }),
      medicine: false, toldBench: true,
    }),
  nell: () => maidScript('nell', false, 10),
  harlan: () => harlanScript(false, 10, true, true),
  pell: () => pellScript(10),
  sigrun: () => sigrunScript(true),
  'tollguard-1': () => tollGuardScript(true, true, 100, false),
  carter: () => CARTER,
  herbwife: () => HERBWIFE,
  porter: () => porterScript('done', false, true, true),
  prior: () => PRIOR,
  anselm: () => anselmScript('none', false),
  fisherman: () => fishermanScript(false, true),
};

function reachable(script: DialogueScript): { lines: string[]; choices: string[] } {
  const seen = new Set<string>();
  const lines: string[] = [];
  const choices: string[] = [];
  const visit = (id: string | undefined) => {
    if (!id || seen.has(id) || !script.nodes[id]) return;
    seen.add(id);
    const node = script.nodes[id];
    lines.push(...node.lines);
    visit(node.next);
    for (const c of node.choices ?? []) {
      choices.push(c.text);
      visit(c.next);
    }
  };
  visit(script.start);
  return { lines, choices };
}

/** What nobody should be saying once Mother is dead and buried: asking after her, or offering to help fetch her home. */
const STALE_CHOICE = /took my mother|send men after my mother|help me (get|hunt)|did you see anything else|where did your people take|they'll come here next/i;
const STALE_LINE = /you bring her home\. you hear|if you bring her home|until you bring her home|go and get your mother|then there's hope|she is alive|is it true\? the cottage|mind the brute|is it true they took/i;

/** Ashes over, the way the game leaves it at the burial. */
function buried(opts: { fell?: boolean; freed?: boolean; with?: Array<'sigrun' | 'wat'> } = {}) {
  QuestLog.setFlag('raid-over');
  QuestLog.start('the-raid');
  QuestLog.complete('the-raid', 'prisoner');
  if (opts.fell) for (const f of ['gate-fell', 'hilde-taken', 'bakery-burnt']) QuestLog.setFlag(f);
  else QuestLog.setFlag('gate-held');
  if (opts.freed) QuestLog.setFlag('pen-freed');
  for (const c of opts.with ?? []) QuestLog.setFlag(`ashes-with:${c}`);
  for (const f of ['mother-dead', 'orb-taken', 'mother-buried', 'headman-pays-sigrun']) QuestLog.setFlag(f);
  QuestLog.complete('the-raid', 'bury');
}

const scene = {} as GameScene;

beforeEach(() => {
  QuestLog.reset();
  Reputation.reset?.();
});

describe('Adowvale once Mother is buried', () => {
  for (const fell of [false, true]) {
    for (const [id, make] of Object.entries(PEOPLE)) {
      it(`${id} has moved on from fetching Mother home (gate ${fell ? 'fell' : 'held'})`, () => {
        buried({ fell, freed: true, with: ['sigrun', 'wat'] });
        const { lines, choices } = reachable(raidAware(id, make()));
        expect(choices.filter((c) => STALE_CHOICE.test(c))).toEqual([]);
        expect(lines.filter((l) => STALE_LINE.test(l))).toEqual([]);
      });
    }
  }

  it('has the key people say their piece about the warren once, then not again', () => {
    buried();
    for (const id of ['headman', 'sergeant', 'landlord', 'guard-1', 'smith']) {
      const first = raidAware(id, PEOPLE[id]());
      expect(first.start, id).toBe('raid-first');
      expect(QuestLog.hasFlag(toldOfAshes(id.replace(/-\d+$/, '') === 'guard' ? 'guard' : first.nodes['raid-first'].speaker))).toBe(true);
      expect(raidAware(id, PEOPLE[id]()).start, id).not.toBe('raid-first');
    }
  });

  it('has the Headman speak to how the gate went and who came down', () => {
    buried({ with: ['sigrun'] });
    const held = raidAware('headman', PEOPLE.headman()).nodes['raid-first'].lines.join(' ');
    expect(held).toMatch(/old road/);
    expect(held).toMatch(/Sigrun/);
    QuestLog.reset();
    buried({ fell: true });
    expect(raidAware('headman', PEOPLE.headman()).nodes['raid-first'].lines.join(' ')).toMatch(/bakery/);
  });

  it('only lets the Headman ask Hilde to be fetched when she is still down there', () => {
    buried({ fell: true, freed: false });
    expect(reachable(raidAware('headman', PEOPLE.headman())).choices.join('|')).toMatch(/never got her out/);
    QuestLog.reset();
    buried({ fell: true, freed: true });
    expect(reachable(raidAware('headman', PEOPLE.headman())).choices.join('|')).not.toMatch(/never got her out/);
    expect(ashesState().freed).toBe('hilde');
  });

  it("pays out the Headman's purse once, however many times it's picked", () => {
    buried();
    const before = Inventory.coins;
    ASHES_ACTIONS['ashes-purse-kept'](scene);
    ASHES_ACTIONS['ashes-purse-kept'](scene);
    ASHES_ACTIONS['ashes-purse-iran'](scene);
    expect(Inventory.coins - before).toBe(HEADMAN_PURSE);
    expect(QuestLog.hasFlag('ashes-purse-iran')).toBe(false);
    expect(reachable(raidAware('headman', PEOPLE.headman())).choices).not.toContain('About the village chest.');
  });

  it("pays out Coombe's thanks once, and stops offering it", () => {
    buried({ freed: true });
    const before = Inventory.coins;
    ASHES_ACTIONS['coombe-thanks'](scene);
    ASHES_ACTIONS['coombe-thanks'](scene);
    expect(Inventory.coins - before).toBe(COOMBE_PURSE);
    expect(reachable(coombeAtTankardScript(false, true)).choices).not.toContain("You don't owe me anything.");
  });

  it('gives Hilde, Coombe and Iran conversations that end', () => {
    for (const script of [hildeAtTankardScript(true), coombeAtTankardScript(true, false), IRAN_AFTER_ASHES]) {
      const { lines } = reachable(script);
      expect(lines.length).toBeGreaterThan(5);
      expect(Object.values(script.nodes).some((n) => !n.next && !n.choices)).toBe(true);
    }
  });

  it('keeps the goblin in the cells talking about the Glass, not the way down', () => {
    buried();
    const { lines, choices } = reachable(raidAware('snikkit', PEOPLE.snikkit()));
    expect(choices.join('|')).toMatch(/orb/);
    expect(lines.join(' ')).toMatch(/Mother went cold/);
  });
});
