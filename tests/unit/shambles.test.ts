import { beforeEach, describe, expect, it } from 'vitest';
import type { DialogueScript } from '../../src/dialogue/Dialogue';
import {
  flayScript, gristleScript, lugsScript, NOTHING_PRICE, rendleScript, scritchScript, TAM_DEBT, tamPotboyScript, tamScript, vetchScript, widowTamNodes,
} from '../../src/dialogue/shambles';
import { QuestLog } from '../../src/systems/Quests';
import { NOTHING_QUEST, Shambles, SHAMBLES_FLAGS, TAM_QUEST } from '../../src/systems/Shambles';

beforeEach(() => QuestLog.reset());

/** Every `next` in a script goes to a node that's there. */
function wellFormed(script: DialogueScript, extra: string[] = []): void {
  const ids = new Set([...Object.keys(script.nodes), ...extra]);
  expect(ids.has(script.start), `start ${script.start}`).toBe(true);
  for (const [id, node] of Object.entries(script.nodes)) {
    if (node.next) expect(ids.has(node.next), `${id} -> ${node.next}`).toBe(true);
    for (const c of node.choices ?? []) if (c.next) expect(ids.has(c.next), `${id} -> ${c.next}`).toBe(true);
  }
}
const actions = (script: DialogueScript) => Object.values(script.nodes).flatMap((n) => [n.action, ...(n.choices ?? []).map((c) => c.action)]).filter(Boolean);

describe('the Shambles', () => {
  it('writes every conversation whole, whichever way things stand', () => {
    for (const first of [true, false]) {
      for (const stage of ['none', 'asked', 'free', 'done'] as const) {
        for (const how of ['bought', 'fought', 'lugs', undefined] as const) wellFormed(scritchScript({ first, stage, how, lugs: how === 'lugs' }));
      }
      for (const coins of [0, 100]) {
        wellFormed(flayScript({ first, asked: true, free: false, how: undefined, coins }));
        wellFormed(tamScript({ first, coins, widow: true, dog: true }));
        wellFormed(tamScript({ first, coins, widow: false, dog: false }));
      }
      wellFormed(lugsScript({ first, apprentice: false, asked: true, free: false }));
      wellFormed(lugsScript({ first, apprentice: true, asked: true, free: true }));
      for (const tam of ['hiding', 'potboy', 'paid', 'rowed', 'sold'] as const) {
        wellFormed(rendleScript({ first, how: 'fought', tamHunt: true, tamKnown: true, tam }));
      }
      wellFormed(vetchScript(first, true, true));
      wellFormed(gristleScript(first));
    }
    wellFormed(tamPotboyScript());
    for (const fate of ['hiding', 'potboy', 'paid', 'rowed', 'sold'] as const) wellFormed({ start: 'tam-ask', nodes: widowTamNodes(fate) }, ['ask']);
  });

  it('frees Nothing three ways: bought, fought for, or let out by Lugs', () => {
    expect(actions(flayScript({ first: false, asked: true, free: false, how: undefined, coins: NOTHING_PRICE }))).toEqual(expect.arrayContaining(['nothing-buy', 'pit-fight']));
    expect(actions(flayScript({ first: false, asked: true, free: false, how: undefined, coins: 0 }))).not.toContain('nothing-buy');
    expect(actions(lugsScript({ first: false, apprentice: false, asked: true, free: false }))).toContain('nothing-lugs');
    // Not before Scritch has asked.
    expect(flayScript({ first: false, asked: false, free: false, how: undefined, coins: 100 }).nodes.ask.choices!.map((c) => c.next)).not.toContain('grey');
  });

  it("follows Scritch's dog from asked to home to thanked", () => {
    expect(Shambles.nothingStage()).toBe('none');
    QuestLog.start(NOTHING_QUEST, ['talk']);
    expect(Shambles.nothingStage()).toBe('asked');
    QuestLog.setFlag(SHAMBLES_FLAGS.nothingFree);
    QuestLog.setFlag(SHAMBLES_FLAGS.nothingLugs);
    expect(Shambles.nothingStage()).toBe('free');
    expect(Shambles.nothingHow()).toBe('lugs');
    for (const step of ['find', 'free', 'tell']) QuestLog.complete(NOTHING_QUEST, step);
    expect(Shambles.nothingStage()).toBe('done');
  });

  it("settles Tam's slate four ways, and the Widow hears how", () => {
    expect(Shambles.widowTam()).toBe('none');
    QuestLog.start(TAM_QUEST, ['talk']);
    expect(Shambles.widowTam()).toBe('asked');
    // Work it off only if she offered; pay or row him away if the purse allows.
    const ways = (coins: number, widow: boolean) => tamScript({ first: false, coins, widow, dog: false }).nodes.debt.choices!.map((c) => c.action ?? c.next);
    expect(ways(TAM_DEBT, true)).toEqual(['potboy', 'tam-pay', 'tam-row', 'ask']);
    expect(ways(0, false)).toEqual(['cant', 'cant', 'ask']);
    // Sold to Rendle only once the hero knows where he is.
    expect(actions(rendleScript({ first: false, how: undefined, tamHunt: true, tamKnown: false, tam: 'hiding' }))).not.toContain('tam-sell');
    expect(actions(rendleScript({ first: false, how: undefined, tamHunt: true, tamKnown: true, tam: 'hiding' }))).toContain('tam-sell');
    QuestLog.setFlag(SHAMBLES_FLAGS.tamSold);
    expect(Shambles.tamFate()).toBe('sold');
    expect(Shambles.widowTam()).toBe('report');
    expect(widowTamNodes('sold')['tam-report'].action).toBe('tam-reported');
  });
});
