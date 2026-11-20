import { describe, expect, it, vi } from 'vitest';

// The maps are laid out with Phaser's seeded dice and curves; the rest of Phaser needs a browser.
vi.mock('phaser', async () => {
  // (Through a variable, so the type-check, which has no Node types, leaves it alone.)
  const nodeModule = 'node:module';
  const req = (await import(/* @vite-ignore */ nodeModule)).createRequire(import.meta.url);
  return {
    default: {
      Math: {
        RandomDataGenerator: req('phaser/src/math/random-data-generator/RandomDataGenerator.js'),
        Linear: req('phaser/src/math/Linear.js'),
        Interpolation: { CatmullRom: req('phaser/src/math/interpolation/CatmullRomInterpolation.js') },
        Distance: { Between: req('phaser/src/math/distance/DistanceBetween.js') },
      },
    },
  };
});

const { MAP_HEIGHT, MAP_SEED, MAP_WIDTH } = await import('../../src/config');
const { generateMap } = await import('../../src/world/MapGenerator');
const { buildNorthWoodsMap } = await import('../../src/world/NorthWoodsMap');
const { Prop, TERRAIN_WALKABLE } = await import('../../src/world/MapData');
type MapData = import('../../src/world/MapData').MapData;

const open = (m: MapData, x: number, y: number) =>
  x >= 0 && y >= 0 && x < m.width && y < m.height && TERRAIN_WALKABLE[m.terrain[y][x]] && m.props[y][x] === Prop.None;

/** Every tile that can be walked to from (x, y), four ways. */
function reachable(m: MapData, x: number, y: number): Set<string> {
  const seen = new Set([`${x},${y}`]);
  const queue = [[x, y]];
  while (queue.length) {
    const [cx, cy] = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${cx + dx},${cy + dy}`;
      if (seen.has(k) || !open(m, cx + dx, cy + dy)) continue;
      seen.add(k);
      queue.push([cx + dx, cy + dy]);
    }
  }
  return seen;
}

describe('the north woods', () => {
  const before = buildNorthWoodsMap(false);
  const after = buildNorthWoodsMap(true);
  const hollow = generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED);

  it('joins up with the Hollow both ways', () => {
    const north = hollow.doors!.filter((d) => d.to === 'northwoods');
    expect(north.length).toBeGreaterThan(0);
    for (const d of north) expect(before.entries![d.entry]).toBeDefined();
    const south = before.doors!.filter((d) => d.to === 'world');
    expect(south.length).toBeGreaterThan(0);
    for (const d of south) expect(hollow.entries![d.entry]).toBeDefined();
    // The path up from the cottage reaches the woods' edge, and back down from the woods' edge to the Hollow.
    const fromCottage = reachable(hollow, Math.floor(hollow.entries!.cottage.x), Math.floor(hollow.entries!.cottage.y));
    expect(north.some((d) => fromCottage.has(`${d.tx},${d.ty}`))).toBe(true);
    const fromEntry = reachable(before, Math.floor(before.entries!.world.x), Math.floor(before.entries!.world.y));
    expect(south.every((d) => fromEntry.has(`${d.tx},${d.ty}`))).toBe(true);
  });

  it('can be walked end to end, over the ford, to every landmark', () => {
    for (const m of [before, after]) {
      const walk = reachable(m, Math.floor(m.entries!.world.x), Math.floor(m.entries!.world.y));
      for (const l of m.landmarks!) {
        const near = [...walk].some((k) => {
          const [x, y] = k.split(',').map(Number);
          return Math.hypot(x + 0.5 - l.gx, y + 0.5 - l.gy) < Math.max(3, (l.range ?? 4) * 0.6);
        });
        expect(near, l.name).toBe(true);
      }
      // And every sight can be stood beside.
      for (const s of m.sights!) {
        const near = [...walk].some((k) => {
          const [x, y] = k.split(',').map(Number);
          return Math.hypot(x + 0.5 - s.gx, y + 0.5 - s.gy) < 1.6;
        });
        expect(near, s.id).toBe(true);
      }
    }
  });

  it('has wild cats that stay dead, and game that comes back', () => {
    const cats = before.creatures!.filter((c) => c.kind === 'wildcat');
    expect(cats.length).toBe(4);
    expect(cats.every((c) => !c.respawns)).toBe(true);
    const game = before.creatures!.filter((c) => c.kind !== 'wildcat');
    expect(game.length).toBeGreaterThan(3);
    expect(game.every((c) => c.respawns)).toBe(true);
    for (const c of before.creatures!) expect(open(before, Math.floor(c.gx), Math.floor(c.gy)), c.id).toBe(true);
    expect(new Set(before.creatures!.map((c) => c.id)).size).toBe(before.creatures!.length);
  });

  it("shows the goblins' trail only after the raid, as scenery", () => {
    const ids = (m: MapData) => m.sights!.map((s) => s.id);
    expect(ids(before)).not.toContain('nw-quilt-scrap');
    expect(ids(after)).toEqual(expect.arrayContaining(['nw-goblin-torch', 'nw-quilt-scrap']));
    expect(before.objects!.some((o) => o.key.startsWith('nw-trampled'))).toBe(false);
    expect(after.objects!.filter((o) => o.key.startsWith('nw-trampled')).length).toBeGreaterThan(40);
    // Only thoughts: nothing to pick up, no doors, nothing that moves the story on.
    for (const s of after.sights!.filter((s) => s.id.startsWith('nw-goblin') || s.id === 'nw-quilt-scrap')) {
      expect(s.thought).toBeTruthy();
      expect(s.gather ?? s.loot ?? s.station ?? s.locked).toBeUndefined();
    }
    expect(after.doors).toEqual(before.doors);
    // The woods themselves are laid out the same either way.
    expect(after.terrain).toEqual(before.terrain);
    expect(after.creatures).toEqual(before.creatures);
  });
});
