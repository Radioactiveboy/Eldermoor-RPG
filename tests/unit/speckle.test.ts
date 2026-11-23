import { describe, expect, it, vi } from 'vitest';
import { phaserMock } from './maps';

vi.mock('phaser', () => phaserMock());

const { MAP_HEIGHT, MAP_SEED, MAP_WIDTH } = await import('../../src/config');
const { generateMap } = await import('../../src/world/MapGenerator');
const { buildHomeMap } = await import('../../src/world/HomeMap');
const { buildHutMap } = await import('../../src/world/HutMap');
const { GARDEN_PEN, HUT_HEN_PEN, HUT_SPECKLE, MOPPET_SIGHT } = await import('../../src/world/landmarks');
const { Prop, TERRAIN_WALKABLE } = await import('../../src/world/MapData');
const { QUESTS } = await import('../../src/systems/Quests');
const iran = await import('../../src/dialogue/iran');
type MapData = import('../../src/world/MapData').MapData;
type HenPen = import('../../src/world/MapData').HenPen;

/** Whether a tile is open ground: walkable terrain, nothing standing on it. */
function open(map: MapData, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  return TERRAIN_WALKABLE[map.terrain[ty][tx]] && map.props[ty][tx] === Prop.None;
}

/** Every whole tile inside a hen's pen. */
function penTiles(pen: HenPen): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let y = Math.ceil(pen.y0); y < Math.floor(pen.y1); y++) for (let x = Math.ceil(pen.x0); x < Math.floor(pen.x1); x++) out.push([x, y]);
  return out;
}

describe("Pip and Hetty's side story", () => {
  it('hides Speckle in the trampled garden, inside its fence, with room to run about', () => {
    const world = generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED);
    const tiles = penTiles(GARDEN_PEN);
    expect(tiles.length).toBeGreaterThanOrEqual(16);
    // Open ground, or a crop that the goblins trample flat (world/GoblinRaid.ts trampleGarden clears them all).
    const crop = (x: number, y: number) => world.crops?.some((c) => c.tx === x && c.ty === y);
    for (const [x, y] of tiles) expect(open(world, x, y) || crop(x, y), `${x},${y}`).toBe(true);
    expect(tiles.filter(([x, y]) => crop(x, y)).length).toBeGreaterThan(0);
    // The fence (burnt, but there) runs round it.
    const fence = (world.objects ?? []).filter((o) => o.key.startsWith('fence-'));
    expect(fence.some((o) => o.tx === GARDEN_PEN.x0 - 1)).toBe(true);
    expect(fence.some((o) => o.tx === GARDEN_PEN.x1)).toBe(true);
  });

  it("leaves Moppet in the ruined cottage where the hero can reach her", () => {
    const home = buildHomeMap(true);
    expect(MOPPET_SIGHT.gx).toBeLessThan(home.width);
    expect(MOPPET_SIGHT.gy).toBeLessThan(home.height);
    const near: Array<[number, number]> = [];
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) near.push([Math.floor(MOPPET_SIGHT.gx) + x, Math.floor(MOPPET_SIGHT.gy) + y]);
    expect(near.some(([x, y]) => open(home, x, y))).toBe(true);
    expect(home.sights?.some((s) => s.id === MOPPET_SIGHT.id)).toBeFalsy();
  });

  it("brings Speckle home to the hut floor once she's found", () => {
    expect(buildHutMap(true).hens).toBeUndefined();
    const hut = buildHutMap(true, true);
    expect(hut.hens?.flock).toEqual([{ kind: 'speckled', gx: HUT_SPECKLE.x, gy: HUT_SPECKLE.y }]);
    expect(HUT_SPECKLE.x).toBeGreaterThan(HUT_HEN_PEN.x0);
    expect(HUT_SPECKLE.x).toBeLessThan(HUT_HEN_PEN.x1);
    expect(HUT_SPECKLE.y).toBeGreaterThan(HUT_HEN_PEN.y0);
    expect(HUT_SPECKLE.y).toBeLessThan(HUT_HEN_PEN.y1);
    expect(open(hut, Math.floor(HUT_SPECKLE.x), Math.floor(HUT_SPECKLE.y))).toBe(true);
  });

  it('is a quest of four steps, each with somewhere to go', () => {
    const q = QUESTS['speckle-and-moppet'];
    expect(q.objectives.map((o) => o.id)).toEqual(['talk', 'moppet', 'speckle', 'return']);
    expect(q.objectives.every((o) => o.target)).toBe(true);
  });

  it('gives the children lines only they say', () => {
    const scenes = [iran.SIBLING_LOST, iran.SIBLING_REUNITED, ...iran.SIBLING_WAITING, ...iran.SIBLING_COMFORTED, ...iran.SIBLING_GLAD_HELLO];
    for (const scene of scenes) {
      expect(scene.length).toBeGreaterThan(0);
      for (const [who, text] of scene) {
        expect(['pip', 'hetty']).toContain(who);
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });
});
