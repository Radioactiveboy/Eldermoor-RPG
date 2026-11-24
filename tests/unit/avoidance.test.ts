import { describe, expect, it, vi } from 'vitest';
import { closingIn, HERO_ROOM, Round, stepAround, underfoot } from '../../src/world/Avoidance';
import { findPath } from '../../src/systems/Pathfinding';
import { Prop, Terrain } from '../../src/world/MapData';
import type { Body, Hero } from '../../src/world/IsoMap';

// IsoMap's art imports Phaser, which needs a browser; only its collision queries are used here.
vi.mock('phaser', () => ({ default: {} }));
const { IsoMap } = await import('../../src/world/IsoMap');

const HERO_R = 0.25;
const NPC_R = 0.28;

/** An open grass field, built without rendering anything (the constructor draws the map). */
function field(width = 12, height = 12): InstanceType<typeof IsoMap> {
  const map = Object.create(IsoMap.prototype) as InstanceType<typeof IsoMap>;
  Object.assign(map, {
    data: {
      width,
      height,
      terrain: Array.from({ length: height }, () => Array<Terrain>(width).fill(Terrain.Grass)),
      props: Array.from({ length: height }, () => Array<Prop>(width).fill(Prop.None)),
      spawn: { x: 1, y: 1 },
    },
    occupied: new Set<number>(),
    bodies: new Set<Body>(),
    shapes: [],
    decks: new Set<number>(),
  });
  return map;
}

const hero = (gx: number, gy: number, solid = true): Hero => ({ gx, gy, radius: HERO_R, solid });

/** The eight ways the hero can push with the keys, a short step each. */
const STEPS = Array.from({ length: 8 }, (_, i) => ({ x: Math.cos((i * Math.PI) / 4) * 0.05, y: Math.sin((i * Math.PI) / 4) * 0.05 }));

describe('closingIn', () => {
  const other: Round = { gx: 5, gy: 5, radius: 0.3 };

  it('stops a step into someone', () => {
    expect(closingIn({ x: 4, y: 5 }, { x: 4.6, y: 5 }, 0.25, other)).toBe(true);
  });

  it('lets a step pass that stays clear', () => {
    expect(closingIn({ x: 3, y: 5 }, { x: 3.5, y: 5 }, 0.25, other)).toBe(false);
  });

  it('always lets someone already overlapping back away', () => {
    expect(closingIn({ x: 5.1, y: 5 }, { x: 5.15, y: 5 }, 0.25, other)).toBe(false);
    expect(closingIn({ x: 5.1, y: 5 }, { x: 5.05, y: 5 }, 0.25, other)).toBe(true);
  });
});

describe('walking past the hero', () => {
  /** Walks someone from `from` to `to` around a hero standing still, frame by frame. */
  function walkPast(from: { x: number; y: number }, to: { x: number; y: number }, h: Round) {
    let at = { ...from };
    let closest = Infinity;
    let waited = 0;
    for (let frame = 0; frame < 600 && Math.hypot(to.x - at.x, to.y - at.y) > 0.02; frame++) {
      const next = stepAround(at, to, 1.4 / 60, NPC_R, h);
      if (!next) {
        waited++;
        continue;
      }
      at = next;
      closest = Math.min(closest, Math.hypot(at.x - h.gx, at.y - h.gy));
    }
    return { at, closest, waited };
  }

  it('goes round a hero standing in the way instead of through them', () => {
    const h = hero(5, 5);
    const { at, closest } = walkPast({ x: 2, y: 5 }, { x: 8, y: 5 }, h);
    expect(Math.hypot(at.x - 8, at.y - 5)).toBeLessThan(0.05);
    expect(closest).toBeGreaterThanOrEqual(NPC_R + HERO_R + HERO_ROOM - 1e-9);
  });

  it('goes round when the hero is a little to one side, too', () => {
    const h = hero(5, 5.2);
    const { at, closest } = walkPast({ x: 2, y: 5 }, { x: 8, y: 5 }, h);
    expect(Math.hypot(at.x - 8, at.y - 5)).toBeLessThan(0.05);
    expect(closest).toBeGreaterThanOrEqual(NPC_R + HERO_R + HERO_ROOM - 1e-9);
  });

  it('walks straight on with nobody in the way', () => {
    expect(stepAround({ x: 2, y: 5 }, { x: 8, y: 5 }, 0.5, NPC_R, undefined)).toEqual({ x: 2.5, y: 5 });
  });

  it('waits when there is no room either side', () => {
    const h = hero(5, 5);
    expect(stepAround({ x: 4.45, y: 5 }, { x: 8, y: 5 }, 0.05, NPC_R, h, () => false)).toBeUndefined();
  });

  it('knows a spot too close to the hero to stand on', () => {
    const h = hero(5, 5);
    expect(underfoot({ x: 5.3, y: 5 }, NPC_R, h)).toBe(true);
    expect(underfoot({ x: 6, y: 5 }, NPC_R, h)).toBe(false);
  });
});

describe('IsoMap: the hero is never pinned', () => {
  it('lets the hero step away from someone who walked right onto them', () => {
    const map = field();
    const from = { x: 5, y: 5 };
    map.bodies.add({ gx: 5.1, gy: 5.05, radius: NPC_R });
    // The old test refused every step, which is how the hero got stuck in the market.
    expect(STEPS.every((d) => map.blocked(from.x + d.x, from.y + d.y, HERO_R))).toBe(true);
    // Now every step that leads away from them is allowed...
    const free = STEPS.filter((d) => !map.blockedMove(from, from.x + d.x, from.y + d.y, HERO_R));
    expect(free.length).toBeGreaterThanOrEqual(3);
    // ...and none that pushes further into them.
    expect(map.blockedMove(from, 5.05, 5.025, HERO_R)).toBe(true);
  });

  it('still stops the hero walking into someone', () => {
    const map = field();
    map.bodies.add({ gx: 5, gy: 5, radius: NPC_R });
    expect(map.blockedMove({ x: 4.4, y: 5 }, 4.5, 5, HERO_R)).toBe(true);
    expect(map.blockedMove({ x: 3, y: 5 }, 3.1, 5, HERO_R)).toBe(false);
  });

  it("lets the hero walk off a tile someone has come back to stand on", () => {
    const map = field();
    map.setOccupied(5, 5, true);
    const from = { x: 5.4, y: 5.5 };
    expect(STEPS.every((d) => map.blocked(from.x + d.x, from.y + d.y, HERO_R))).toBe(true);
    // Away from the middle of it is fine, deeper in is not.
    expect(map.blockedMove(from, 5.35, 5.5, HERO_R)).toBe(false);
    expect(map.blockedMove(from, 5.45, 5.5, HERO_R)).toBe(true);
    // From outside, the tile is as solid as ever.
    expect(map.blockedMove({ x: 6.4, y: 5.5 }, 6.2, 5.5, HERO_R)).toBe(true);
  });

  it('keeps walls and trunks solid, stuck or not', () => {
    const map = field();
    (map as unknown as { shapes: unknown[] }).shapes[5 * 12 + 5] = [{ kind: 'circle', x: 5.5, y: 5.5, r: 0.2 }];
    expect(map.blockedMove({ x: 5.5, y: 5.6 }, 5.5, 5.65, HERO_R)).toBe(true);
  });
});

describe('IsoMap: planning a way round the hero', () => {
  it("leaves the hero's tile out of the people's paths while they stand", () => {
    const map = field();
    map.hero = hero(5.5, 5.5);
    expect(map.walkableAroundHero(5, 5)).toBe(false);
    expect(map.walkableAroundHero(6, 5)).toBe(true);
    const path = findPath({ x: 2, y: 5 }, { x: 8, y: 5 }, map.width, map.height, (x, y) => map.walkableAroundHero(x, y))!;
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((p) => p.x === 5 && p.y === 5)).toBe(false);
  });

  it('pays the hero no mind while they sit or work', () => {
    const map = field();
    map.hero = hero(5.5, 5.5, false);
    expect(map.heroInTheWay).toBeUndefined();
    expect(map.walkableAroundHero(5, 5)).toBe(true);
  });
});
