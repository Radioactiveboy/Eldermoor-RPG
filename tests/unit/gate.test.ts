import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('./maps')).phaserMock());
import { raidAware, toldOfRaid } from '../../src/dialogue/afterRaid';
import type { DialogueScript } from '../../src/dialogue/Dialogue';
import { BAKER, militiaScript, TANNER } from '../../src/dialogue/market';
import { QuestLog } from '../../src/systems/Quests';
import { buildMarketMap } from '../../src/world/MarketMap';
import { absent, gateAftermath } from '../../src/world/GateAftermath';
import { gateAttackDue, gateAttackHour, gateWaves } from '../../src/world/GateNight';

/** The night the goblins come for Adowvale ('the-gate'), and the morning after. */
beforeEach(() => {
  QuestLog.reset();
  QuestLog.setFlag('raid-over');
});

const WARN = "I fought the goblins at their camp on the fell. They'll come here next.";

/** Everything that can be read or picked in a conversation, from its start. */
function reachable(script: DialogueScript): { lines: string[]; choices: string[]; actions: string[] } {
  const seen = new Set<string>();
  const out = { lines: [] as string[], choices: [] as string[], actions: [] as string[] };
  const visit = (id: string | undefined) => {
    if (!id || seen.has(id) || !script.nodes[id]) return;
    seen.add(id);
    const node = script.nodes[id];
    out.lines.push(...node.lines);
    if (node.action) out.actions.push(node.action);
    visit(node.next);
    for (const c of node.choices ?? []) {
      out.choices.push(c.text);
      visit(c.next);
    }
  };
  visit(script.start);
  return out;
}

const guard = () => raidAware('guard-1', militiaScript('greet', { standing: 'known', bounties: 0 }));

describe('when the goblins come', () => {
  it('comes only after dark, and before first light', () => {
    expect([20, 21, 23, 0, 3, 4, 12].map(gateAttackHour)).toEqual([false, true, true, true, true, false, false]);
  });

  it('is due once the camp is cleared, and only until it has happened', () => {
    expect(gateAttackDue()).toBe(false);
    QuestLog.start('the-gate');
    expect(gateAttackDue()).toBe(true);
    QuestLog.complete('the-gate', 'warn');
    expect(gateAttackDue()).toBe(true);
    QuestLog.complete('the-gate', 'hold');
    expect(gateAttackDue()).toBe(false);
  });

  it('never comes twice, even if the village fell', () => {
    QuestLog.start('the-gate');
    QuestLog.setFlag('gate-fell');
    expect(gateAttackDue()).toBe(false);
  });

  it('sends bigger bands against a militia caught unready', () => {
    const warned = gateWaves(true);
    const unready = gateWaves(false);
    expect(warned).toHaveLength(2);
    expect(unready).toHaveLength(2);
    for (let i = 0; i < 2; i++) expect(unready[i].length).toBe(warned[i].length + 1);
  });
});

describe('warning the militia', () => {
  it("can't be done before the camp", () => {
    expect(reachable(guard()).choices).not.toContain(WARN);
  });

  it('is there once the hero has the quest, and gone once told', () => {
    QuestLog.start('the-gate');
    const { choices, actions } = reachable(guard());
    expect(choices).toContain(WARN);
    expect(actions).toContain('warned-militia');
    QuestLog.complete('the-gate', 'warn');
    expect(reachable(guard()).choices).not.toContain(WARN);
  });
});

describe('the morning after the village fell', () => {
  beforeEach(() => {
    for (const flag of ['gate-fell', 'hilde-taken', 'bakery-burnt']) QuestLog.setFlag(flag);
  });

  it('has the bakery burnt out, her stall sheeted over and Hilde gone', () => {
    const map = gateAftermath(buildMarketMap(true));
    const keys = (map.objects ?? []).map((o) => o.key);
    expect(keys).toContain('bld-bakery-burnt');
    expect(keys).not.toContain('bld-bakery');
    expect(keys).toContain('mkt-stall-baker-closed');
    expect((map.npcs ?? []).some((n) => n.id === 'baker')).toBe(false);
    expect(absent('baker')).toBe(true);
    expect(absent('smith')).toBe(false);
  });

  it('leaves the village as it was if it held', () => {
    QuestLog.reset();
    QuestLog.setFlag('gate-held');
    const keys = (gateAftermath(buildMarketMap(true)).objects ?? []).map((o) => o.key);
    expect(keys).toContain('bld-bakery');
    expect(absent('baker')).toBe(false);
  });

  it('has folk tell of it once, after what they make of the raid', () => {
    const first = reachable(raidAware('tanner', TANNER));
    expect(first.lines.join(' ')).toMatch(/stall/);
    const again = raidAware('tanner', TANNER);
    expect(reachable(again).lines.join(' ')).not.toMatch(/flowers/);
  });

  it("doesn't lose the raid talk when both come at once", () => {
    const script = guard();
    const { lines } = reachable(script);
    expect(lines.join(' ')).toMatch(/smoke/);
    expect(lines.join(' ')).toMatch(/dragged her off/);
    expect(script.nodes['raid-first'].next).toBe('raid-first-2');
    expect(script.nodes['raid-first-2'].next).toBe('greet');
  });
});

describe('the morning after the village held', () => {
  it('has Hilde still about, and glad of the hero', () => {
    QuestLog.setFlag('gate-held');
    QuestLog.setFlag(toldOfRaid('baker'));
    expect(reachable(raidAware('baker', BAKER)).lines.join(' ')).toMatch(/magnificent/);
  });
});
