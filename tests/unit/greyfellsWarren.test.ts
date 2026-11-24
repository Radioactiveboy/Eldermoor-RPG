import { describe, expect, it, vi } from 'vitest';
import { Prop, Terrain } from '../../src/world/MapData';

vi.mock('phaser', async () => (await import('./maps')).phaserMock());

/** The hole in the hill is cut into the crags (see greyfellsHills): the way up the cleft to it has to stay open. */
describe('the hole in the hill on the Greyfells', () => {
  it('can be walked into from where the trail comes up out of the woods', async () => {
    const { buildGreyfellsMap } = await import('../../src/world/GreyfellsMap');
    const map = buildGreyfellsMap();
    const door = map.doors!.find((d) => d.id === 'warren')!;
    const open = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < map.width && y < map.height && map.props[y][x] === Prop.None && map.terrain[y][x] !== Terrain.Water;
    expect(open(door.tx, door.ty)).toBe(true);
    // Walk tile to tile, side to side only (a diagonal step squeezes between two corners), from the way in.
    const start = { x: Math.floor(map.spawn.x), y: Math.floor(map.spawn.y) };
    const seen = new Set([start.y * map.width + start.x]);
    const queue = [start];
    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = (y + dy) * map.width + x + dx;
        if (!seen.has(k) && open(x + dx, y + dy)) {
          seen.add(k);
          queue.push({ x: x + dx, y: y + dy });
        }
      }
    }
    expect(seen.has(door.ty * map.width + door.tx)).toBe(true);
    // And the spot the hero comes back out at is on that same open ground.
    const back = map.entries!.warren;
    expect(seen.has(Math.floor(back.y) * map.width + Math.floor(back.x))).toBe(true);
  });
});
