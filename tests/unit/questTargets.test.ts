import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('./maps')).phaserMock());

const { allMaps } = await import('./maps');
const { QuestLog, QUESTS } = await import('../../src/systems/Quests');
const { currentTarget, QUEST_TARGETS, stepTarget } = await import('../../src/systems/QuestTargets');
const { waypoint } = await import('../../src/world/atlas');
const { buildHomeMap } = await import('../../src/world/HomeMap');
const { buildHutMap } = await import('../../src/world/HutMap');

const maps = await allMaps();
// After the raid, the quests that follow it happen in the ruined cottage and in Iran's hut, where he hides.
const ruined = { home: buildHomeMap(true), hut: buildHutMap(true) };
/** Steps with nowhere to mark yet: the story hasn't got there. */
const NO_TARGET = ['the-raid/bury', 'the-watcher/who'];

beforeEach(() => QuestLog.reset());

describe('quest targets', () => {
  it('name a spot for every quest step but the ones the story has not reached', () => {
    for (const q of Object.values(QUESTS)) {
      for (const o of q.objectives) {
        const key = `${q.id}/${o.id}`;
        expect(!!(o.target ?? QUEST_TARGETS[q.id]?.[o.id]), key).toBe(!NO_TARGET.includes(key));
      }
    }
    for (const [id, steps] of Object.entries(QUEST_TARGETS)) {
      for (const step of Object.keys(steps)) expect(QUESTS[id]?.objectives.some((o) => o.id === step), `${id}/${step}`).toBe(true);
    }
  });

  it('put every spot inside its map, with anyone named standing in that area', () => {
    for (const q of Object.values(QUESTS)) {
      const raid = q.id === 'the-raid' || q.id === 'speckle-and-moppet';
      for (const o of q.objectives) {
        const t = o.target ?? QUEST_TARGETS[q.id]?.[o.id];
        if (!t) continue;
        const key = `${q.id}/${o.id}`;
        const map = (raid && t.area in ruined ? ruined[t.area as keyof typeof ruined] : maps[t.area]);
        expect(t.x, key).toBeGreaterThanOrEqual(0);
        expect(t.y, key).toBeGreaterThanOrEqual(0);
        expect(t.x, key).toBeLessThanOrEqual(map.width);
        expect(t.y, key).toBeLessThanOrEqual(map.height);
        if (t.npc) expect(map.npcs?.some((n) => n.id === t.npc), key).toBe(true);
        // And there's a way there from home.
        expect(waypoint('home', t.area, t), key).toBeDefined();
      }
    }
  });

  it("follows the step the tracker shows", () => {
    // Before anything has begun: Mother.
    expect(currentTarget()).toMatchObject({ area: 'home', npc: 'mother' });
    QuestLog.start('mother-medicine', ['talk']);
    expect(currentTarget()).toMatchObject({ area: 'world' });
    QuestLog.complete('mother-medicine', 'leave');
    expect(currentTarget()).toMatchObject({ area: 'abbey', npc: 'anselm' });
    // A quest started later is the one in focus.
    QuestLog.start('cellar-rats', ['talk']);
    expect(currentTarget()).toMatchObject({ area: 'cellar' });
    // A step can carry its own target, which wins.
    const quest = QuestLog.get('cellar-rats')!;
    const step = { id: 'x', text: 'x', target: { area: 'smithy' as const, x: 1, y: 1 } };
    expect(stepTarget(quest, step)).toEqual(step.target);
  });

  it('has nowhere to point once every errand is done', () => {
    QuestLog.start('chicken-feed', ['talk', 'buy']);
    QuestLog.complete('chicken-feed', 'return');
    expect(QuestLog.active).toHaveLength(0);
    expect(currentTarget()).toBeUndefined();
    QuestLog.setFlag('raid-pending');
    expect(currentTarget()).toMatchObject({ area: 'home' });
  });
});
