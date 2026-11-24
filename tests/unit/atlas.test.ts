import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', async () => (await import('./maps')).phaserMock());

const { allMaps } = await import('./maps');
const { anchor, atlasPoint, known, LINKS, neighbours, region, REGIONS, route, waypoint } = await import('../../src/world/atlas');
const { AREA_NAMES } = await import('../../src/systems/SaveGame');
type AreaId = import('../../src/world/MapData').AreaId;

const maps = await allMaps();
const AREAS = Object.keys(AREA_NAMES) as AreaId[];

describe('the world map layout', () => {
  it('knows every area, and every area can be reached from every other', () => {
    for (const a of AREAS) {
      expect(LINKS.some((l) => l.a === a || l.b === a), a).toBe(true);
      for (const b of AREAS) expect(route(a, b).length, `${a} to ${b}`).toBeGreaterThan(0);
    }
  });

  it('has a link for each door, at that door', () => {
    for (const [area, map] of Object.entries(maps) as Array<[AreaId, (typeof maps)[AreaId]]>) {
      for (const d of map.doors ?? []) {
        const n = neighbours(area).find((x) => x.to === d.to);
        expect(n, `${area} -> ${d.to}`).toBeDefined();
      }
      for (const n of neighbours(area)) {
        // (A passage by boat has no door at either end: it's at the landing.)
        if (LINKS.some((l) => l.boat && [l.a, l.b].includes(area) && [l.a, l.b].includes(n.to))) {
          const at = n.at;
          expect(map.entries?.heron ?? map.entries?.gloomhaven, `${area} has a landing`).toBeDefined();
          expect(at.x >= 0 && at.y >= 0 && at.x <= map.width && at.y <= map.height, `${area} -> ${n.to} spot`).toBe(true);
          continue;
        }
        // The link's spot is beside one of the doors that way (a road's end can be several tiles wide).
        const doors = (map.doors ?? []).filter((d) => d.to === n.to);
        expect(doors.length, `${area} has a door to ${n.to}`).toBeGreaterThan(0);
        const near = Math.min(...doors.map((d) => Math.hypot(d.tx + 0.5 - n.at.x, d.ty + 0.5 - n.at.y)));
        expect(near, `${area} -> ${n.to} spot`).toBeLessThan(1.6);
      }
    }
  });

  it("gives each region its map's size, and no two regions overlap", () => {
    for (const r of REGIONS) {
      expect(r.tiles, r.id).toEqual({ w: maps[r.id].width, h: maps[r.id].height });
      expect(maps[r.id].indoor, r.id).toBeFalsy();
    }
    for (const a of REGIONS) {
      for (const b of REGIONS) {
        if (a === b) continue;
        const apart =
          a.box.x + a.box.w <= b.box.x || b.box.x + b.box.w <= a.box.x || a.box.y + a.box.h <= b.box.y || b.box.y + b.box.h <= a.box.y;
        expect(apart, `${a.id} and ${b.id}`).toBe(true);
      }
    }
  });

  it('finds the shortest way through the doors', () => {
    expect(route('home', 'cellar')).toEqual(['home', 'world', 'market', 'tavern', 'cellar']);
    expect(route('chapel', 'deepden')).toEqual(['chapel', 'abbey', 'monastery', 'plains', 'den', 'deepden']);
    expect(route('market', 'market')).toEqual(['market']);
  });

  it('points at the door that leads the right way, or at the spot itself once there', () => {
    expect(waypoint('home', 'abbey', { x: 20, y: 15 })).toEqual({ at: { x: 0.5, y: 5.5 }, next: 'world' });
    expect(waypoint('world', 'abbey', { x: 20, y: 15 })).toEqual({ at: { x: 0.5, y: 54.5 }, next: 'market' });
    expect(waypoint('abbey', 'abbey', { x: 20, y: 15 })).toEqual({ at: { x: 20, y: 15 }, next: 'abbey' });
  });

  it('puts places indoors at their door in the region outside', () => {
    expect(anchor('cellar')).toEqual({ region: region('market'), at: { x: 10.5, y: 4.5 } });
    expect(anchor('deepden')).toEqual({ region: region('plains'), at: { x: 101.5, y: 60.5 } });
    expect(anchor('home')!.region.id).toBe('world');
    // A spot out of doors falls inside its region's box.
    const r = region('plains')!;
    const p = atlasPoint('plains', { x: 60, y: 75 })!;
    expect(p.x).toBeCloseTo(r.box.x + r.box.w / 2);
    expect(p.y).toBeCloseTo(r.box.y + r.box.h / 2);
  });

  it("shows a region once it, or somewhere inside it, has been visited", () => {
    const visited = new Set<AreaId>(['home', 'tavern']);
    expect(known('home', visited)).toBe(true);
    expect(known('world', visited)).toBe(true);
    expect(known('market', visited)).toBe(true);
    expect(known('plains', visited)).toBe(false);
    expect(known('cellar', visited)).toBe(false);
  });
});
