import { beforeEach, describe, expect, it } from 'vitest';
import { applyRaidTalk, raidAware, toldOfRaid } from '../../src/dialogue/afterRaid';
import type { DialogueScript } from '../../src/dialogue/Dialogue';
import { BAKER, GUARD, militiaScript, SMITH, TANNER } from '../../src/dialogue/market';
import { CARTER, HERBWIFE, tollGuardScript } from '../../src/dialogue/plains';
import { GARDENER, porterScript } from '../../src/dialogue/monastery';
import { anselmScript, PRIOR } from '../../src/dialogue/abbey';
import { fishermanScript } from '../../src/dialogue/fisherman';
import { harlanScript, landlordNews, landlordScript, maidScript } from '../../src/dialogue/tavern';
import { QuestLog } from '../../src/systems/Quests';

/** Adowvale's people, by NPC id, as they'd talk with nothing else going on. */
const PEOPLE: Record<string, () => DialogueScript> = {
  'guard-1': () => militiaScript('greet', { standing: 'known', bounties: 0 }),
  'guard-2': () => militiaScript('closed', { standing: 'liked', bounties: 2 }),
  baker: () => BAKER,
  smith: () => SMITH,
  tanner: () => TANNER,
  landlord: () =>
    landlordScript({
      first: true, coins: 50, room: 1, renting: false, nightsLeft: 0, rats: 'none', late: false, freeDrink: false,
      news: landlordNews({ paidToll: true, slewWolfMother: true, foundCaveDoor: true, monasteryOpen: true, raidOver: true }),
      medicine: false, toldBench: true,
    }),
  nell: () => maidScript('nell', false, 10),
  harlan: () => harlanScript(false, 10, true, true),
  'tollguard-1': () => tollGuardScript(true, true, 100, false),
  carter: () => CARTER,
  herbwife: () => HERBWIFE,
  porter: () => porterScript('done', false, true, true),
  gardener: () => GARDENER,
  prior: () => PRIOR,
  anselm: () => anselmScript('none', false),
  anselm2: () => anselmScript('picked', false),
  fisherman: () => fishermanScript(false, true),
};

/** Everything that can be read or picked in a conversation, from its start. */
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

/** What nobody should still be saying once Mother has been carried off: her fever, and the errand for her tincture. */
const STALE_CHOICE = /is sick|sick with|has a fever|moonpetal|willow|tincture/i;
const STALE_LINE = /give your mother my love|sick mother|for your mother\. yes|your mother shall have|who is it for\?|for a fever, is it|if she does not mend/i;

beforeEach(() => QuestLog.reset());

describe('Adowvale after the goblin raid', () => {
  it('still asks after a sick mother before the raid (so the test can tell)', () => {
    const { choices } = reachable(raidAware('baker', BAKER));
    expect(choices.some((c) => STALE_CHOICE.test(c))).toBe(true);
  });

  for (const [id, make] of Object.entries(PEOPLE)) {
    it(`${id} no longer talks about Mother's fever`, () => {
      QuestLog.setFlag('raid-over');
      const { lines, choices } = reachable(raidAware(id.replace(/\d$/, ''), make()));
      expect(choices.filter((c) => STALE_CHOICE.test(c))).toEqual([]);
      expect(lines.filter((l) => STALE_LINE.test(l))).toEqual([]);
    });
  }

  it('has the militia say their piece about the raid once, then ask about it', () => {
    QuestLog.setFlag('raid-over');
    const first = raidAware('guard-3', militiaScript('greet', { standing: 'known', bounties: 0 }));
    expect(first.start).toBe('raid-first');
    expect(first.nodes['raid-first'].lines.join(' ')).toMatch(/smoke/);
    expect(first.nodes['raid-first'].next).toBe('greet');
    expect(QuestLog.hasFlag(toldOfRaid('guard'))).toBe(true);

    const again = raidAware('guard-1', militiaScript('greet', { standing: 'known', bounties: 0 }));
    expect(again.start).toBe('greet');
    const asks = again.nodes.ask.choices!.map((c) => c.text);
    expect(asks).toContain('Goblins burnt our cottage. They took my mother.');
    // Goodbye is still last.
    expect(again.nodes.ask.choices!.at(-1)!.next).toBe('bye');
    expect(reachable(again).lines.join(' ')).toMatch(/Lord Morten/);
  });

  it('leaves a conversation alone before the raid', () => {
    expect(raidAware('guard-1', GUARD)).toBe(GUARD);
  });

  it('works new nodes and choices into a script', () => {
    const script: DialogueScript = {
      start: 'ask',
      nodes: { ask: { speaker: 'guard', lines: ['?'], choices: [{ text: 'old', next: 'old' }, { text: 'bye' }] }, old: { speaker: 'guard', lines: ['x'] } },
    };
    const out = applyRaidTalk(script, {
      speaker: 'guard', drop: ['old'], ask: [{ text: 'new', next: 'new' }], nodes: { new: { speaker: 'guard', lines: ['y'] } },
    });
    expect(out.nodes.ask.choices!.map((c) => c.text)).toEqual(['new', 'bye']);
    expect(out.nodes.new.lines).toEqual(['y']);
  });
});
