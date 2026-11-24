import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('./maps')).phaserMock());

const { QuestLog } = await import('../../src/systems/Quests');
const { carryingMother, penPrisoner, warrenOpen } = await import('../../src/scenes/game/warren');
const { buildWarrenMap, WARREN_GOBLINS, WARREN_HUNTERS } = await import('../../src/world/WarrenMap');
const { buildBroodHallMap, BROODHALL_KEEPERS } = await import('../../src/world/BroodHallMap');
const { coombeScript, hildeCaptiveScript, motherDyingScript, orbScript } = await import('../../src/dialogue/warren');

beforeEach(() => QuestLog.reset());

/** Every node a script's choices and nexts lead to, from its start. */
function reachable(script: { start: string; nodes: Record<string, { next?: string; choices?: Array<{ next?: string }> }> }): Set<string> {
  const seen = new Set<string>();
  const go = (id: string) => {
    if (seen.has(id)) return;
    expect(script.nodes[id], id).toBeDefined();
    seen.add(id);
    const node = script.nodes[id];
    if (node.next) go(node.next);
    for (const c of node.choices ?? []) if (c.next) go(c.next);
  };
  go(script.start);
  return seen;
}

describe("the goblins' warren", () => {
  it('stays shut until the night at the gate is over', () => {
    expect(warrenOpen()).toBe(false);
    QuestLog.start('the-gate');
    QuestLog.complete('the-gate', 'warn');
    expect(warrenOpen()).toBe(false);
    QuestLog.complete('the-gate', 'hold');
    expect(warrenOpen()).toBe(true);
  });

  it('holds Hilde in the pen if the village fell, else Coombe, and nobody once they are let out', () => {
    expect(penPrisoner()).toBe('coombe');
    QuestLog.setFlag('hilde-taken');
    expect(penPrisoner()).toBe('hilde');
    expect(buildWarrenMap({ prisoner: 'hilde' }).npcs?.map((n) => n.id)).toEqual(['hilde-captive']);
    QuestLog.setFlag('pen-freed');
    expect(penPrisoner()).toBeUndefined();
    expect(buildWarrenMap({}).npcs).toEqual([]);
  });

  it('has its sleepers and sentries on the way down, and hunters on the way out with Mother', () => {
    expect(buildWarrenMap({}).creatures?.map((c) => c.id)).toEqual(WARREN_GOBLINS);
    expect(buildWarrenMap({ roused: true }).creatures?.map((c) => c.id)).toEqual(WARREN_HUNTERS);
    expect(buildWarrenMap({ roused: true, prisoner: 'coombe' }).npcs).toEqual([]);
    expect(carryingMother()).toBe(false);
  });

  it('has the Brute at the door of the brood hall, and Mother and the shaman by the orb, until she dies', () => {
    const before = buildBroodHallMap();
    expect(before.creatures?.map((c) => c.id)).toEqual(BROODHALL_KEEPERS);
    expect(before.npcs?.map((n) => n.id).sort()).toEqual(['mother-dying', 'shaman']);
    const after = buildBroodHallMap({ motherDead: true });
    expect(after.creatures).toEqual([]);
    expect(after.npcs).toEqual([]);
    expect(after.objects?.some((o) => o.key === 'bh-pallet')).toBe(true);
  });

  it('lets the prisoner go, has Mother die at the end of her last words, and the orb set them on the hero', () => {
    for (const script of [hildeCaptiveScript(), coombeScript()]) {
      const nodes = reachable(script);
      expect([...nodes].some((id) => script.nodes[id].action === 'freed-prisoner')).toBe(true);
    }
    const mother = motherDyingScript();
    const last = [...reachable(mother)].filter((id) => mother.nodes[id].action);
    expect(last.map((id) => mother.nodes[id].action)).toEqual(['mother-died']);
    expect(mother.nodes.father.lines.join(' ')).toContain('Aldo');
    expect(orbScript(true).nodes.speak.action).toBe('orb-spoke');
    expect(orbScript(true).nodes.speak.lines.join(' ')).toContain('Adowvale');
  });
});
