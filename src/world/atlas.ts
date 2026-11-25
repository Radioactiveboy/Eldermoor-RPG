/**
 * The shape of the world as a whole, for the world map (scenes/MapScene.ts) and the
 * quest markers (ui/QuestMarkers.ts): which areas lie where, and how each one leads
 * into the next. It knows nothing of the maps' contents, so it costs nothing to load:
 * every spot here is a tile position copied from a map file, and tests/unit/atlas.test.ts
 * checks them against the maps' doors and sizes. A new area needs an entry in LINKS
 * (and in REGIONS, if it's out of doors and should be drawn as a piece of the map).
 */
import type { AreaId } from './MapData';

export interface Spot {
  x: number;
  y: number;
}

/**
 * An area drawn on the world map as a piece of country: its map's size in tiles,
 * and the box it fills on the world map (in atlas units, drawn the same isometric
 * way round as the game, so "up the screen" is the same direction on both).
 * Places inside it (the cottage, the tavern) are drawn as marks at their doors.
 */
export interface Region {
  id: AreaId;
  /** Its map's width and height, in tiles. */
  tiles: { w: number; h: number };
  box: { x: number; y: number; w: number; h: number };
  /** How it's painted on the map. */
  look: 'fields' | 'woods' | 'village' | 'plains' | 'grounds' | 'cloister';
  /** Where its name is written (in its tiles), clear of its doors and the places people go; small ones have it above their top corner. */
  label?: Spot;
}

/**
 * A way between two areas: a door, a trapdoor, or a road off the edge of one map
 * onto the next. `at` holds the spot in each area where it is (where the door's
 * tile is, or the road's end), in that area's own tiles.
 */
export interface Link {
  a: AreaId;
  b: AreaId;
  at: Partial<Record<AreaId, Spot>>;
  /** The road's name, for a road between two regions. */
  road?: string;
  /**
   * By boat rather than through a door: a passage on the river (see systems/Voyages.ts), taken by talking to
   * whoever sails it, so neither end has a door; drawn as a dotted way over the water.
   */
  boat?: boolean;
}

export const REGIONS: Region[] = [
  { id: 'world', tiles: { w: 52, h: 60 }, box: { x: 15, y: 0, w: 26, h: 30 }, look: 'fields', label: { x: 40, y: 46 } },
  { id: 'northwoods', tiles: { w: 60, h: 76 }, box: { x: 19.5, y: -34, w: 24, h: 30 }, look: 'woods', label: { x: 30, y: 64 } },
  { id: 'greyfells', tiles: { w: 48, h: 56 }, box: { x: 27.7, y: -56.4, w: 19.2, h: 22.4 }, look: 'plains', label: { x: 34, y: 44 } },
  { id: 'market', tiles: { w: 34, h: 44 }, box: { x: -60, y: 18.5, w: 17, h: 22 }, look: 'village' },
  { id: 'jetty', tiles: { w: 52, h: 62 }, box: { x: -64.25, y: 40.5, w: 26, h: 31 }, look: 'fields', label: { x: 40, y: 8 } },
  // Downriver from the jetty, days by boat: the marsh town.
  { id: 'gloomhaven', tiles: { w: 60, h: 88 }, box: { x: -28, y: 64, w: 30, h: 44 }, look: 'village', label: { x: 44, y: 10 } },
  { id: 'plains', tiles: { w: 120, h: 150 }, box: { x: -67.6, y: -34.2, w: 40, h: 50 }, look: 'plains', label: { x: 40, y: 108 } },
  { id: 'monastery', tiles: { w: 64, h: 60 }, box: { x: -24.9, y: -22.2, w: 22, h: 20 }, look: 'grounds', label: { x: 36, y: 42 } },
  { id: 'abbey', tiles: { w: 46, h: 40 }, box: { x: -20.6, y: -34.2, w: 14, h: 12 }, look: 'cloister' },
];

const link = (a: AreaId, atA: Spot, b: AreaId, atB: Spot, road?: string): Link => ({ a, b, at: { [a]: atA, [b]: atB }, road });

export const LINKS: Link[] = [
  link('world', { x: 0.5, y: 54.5 }, 'market', { x: 33, y: 17.5 }, 'The old road'),
  link('world', { x: 33.5, y: 0.5 }, 'northwoods', { x: 30.5, y: 75 }, 'The path north'),
  link('northwoods', { x: 13.5, y: 22.5 }, 'watchtower', { x: 0.5, y: 5.5 }),
  link('northwoods', { x: 41.5, y: 0.5 }, 'greyfells', { x: 21, y: 55.5 }, "The goblins' trail"),
  link('greyfells', { x: 24.5, y: 6.5 }, 'warren', { x: 0.5, y: 3.5 }),
  link('warren', { x: 29.5, y: 0.5 }, 'broodhall', { x: 4.5, y: 0.5 }),
  link('world', { x: 21.5, y: 37.5 }, 'home', { x: 0.5, y: 5.5 }),
  link('world', { x: 16.5, y: 14.5 }, 'hut', { x: 0.5, y: 3.5 }),
  link('world', { x: 27.5, y: 6.5 }, 'cave', { x: 0.5, y: 2.5 }),
  link('market', { x: 25, y: 0.5 }, 'plains', { x: 60, y: 149 }, "Lord Morten's gate"),
  link('market', { x: 10.5, y: 4.5 }, 'tavern', { x: 0.5, y: 8.5 }),
  link('market', { x: 6.5, y: 4.5 }, 'bakery', { x: 0.5, y: 5.5 }),
  link('market', { x: 15.5, y: 4.5 }, 'smithy', { x: 0.5, y: 5.5 }),
  link('market', { x: 7.5, y: 35.5 }, 'garrison', { x: 0.5, y: 6.5 }),
  link('market', { x: 12, y: 43.5 }, 'jetty', { x: 20.5, y: 0.5 }, 'The jetty lane'),
  // Down the Wend by boat, from the end of Adowvale's pier to the end of Gloomhaven's.
  { ...link('jetty', { x: 23.5, y: 31.5 }, 'gloomhaven', { x: 30.5, y: 54.5 }, 'The river Wend'), boat: true },
  link('garrison', { x: 8.5, y: 5.5 }, 'jail', { x: 1.5, y: 1.5 }),
  link('market', { x: 9.5, y: 33.5 }, 'jail', { x: 13.5, y: 1.5 }),
  link('market', { x: 17.5, y: 34.5 }, 'residence', { x: 0.5, y: 6.5 }),
  link('tavern', { x: 4.5, y: 1.5 }, 'tavern-hall', { x: 0.5, y: 1.5 }),
  link('tavern', { x: 6.5, y: 2.5 }, 'cellar', { x: 1.5, y: 1.5 }),
  link('tavern-hall', { x: 2.5, y: 0.5 }, 'tavern-room', { x: 0.5, y: 3.5 }),
  link('gloomhaven', { x: 29.5, y: 19.5 }, 'blackrose', { x: 0.5, y: 9.5 }),
  link('blackrose', { x: 4.5, y: 1.5 }, 'blackrose-upstairs', { x: 0.5, y: 1.5 }),
  link('blackrose', { x: 7.5, y: 0.5 }, 'blackrose-back', { x: 0.5, y: 5.5 }),
  link('blackrose-upstairs', { x: 4.5, y: 0.5 }, 'blackrose-room', { x: 0.5, y: 3.5 }),
  link('gloomhaven', { x: 33.5, y: 7.5 }, 'tollhouse', { x: 0.5, y: 6.5 }),
  link('tollhouse', { x: 1.5, y: 1.5 }, 'tollhouse-upstairs', { x: 0.5, y: 1.5 }),
  link('tollhouse', { x: 8.5, y: 0.5 }, 'tollhouse-strong', { x: 0.5, y: 3.5 }),
  link('plains', { x: 119, y: 80.5 }, 'monastery', { x: 0.5, y: 44.5 }, "The Lord's Road"),
  link('plains', { x: 101.5, y: 60.5 }, 'den', { x: 0.5, y: 3.5 }),
  link('den', { x: 24.5, y: 0.5 }, 'deepden', { x: 0.5, y: 5.5 }),
  link('plains', { x: 90.5, y: 8.5 }, 'beacon', { x: 0.5, y: 7.5 }),
  link('beacon', { x: 5.5, y: 1.5 }, 'beacon-top', { x: 1.5, y: 5.5 }),
  link('monastery', { x: 32, y: 8.5 }, 'abbey', { x: 22, y: 39 }, "Saint Elda's gate"),
  link('abbey', { x: 7.5, y: 5.5 }, 'chapel', { x: 0.5, y: 8.5 }),
  link('abbey', { x: 33.5, y: 5.5 }, 'infirmary', { x: 0.5, y: 4.5 }),
  link('abbey', { x: 4.5, y: 13.5 }, 'scriptorium', { x: 0.5, y: 4.5 }),
  link('abbey', { x: 4.5, y: 22.5 }, 'refectory', { x: 0.5, y: 5.5 }),
];

export function region(area: AreaId): Region | undefined {
  return REGIONS.find((r) => r.id === area);
}

/** The areas one step away from `area`, each with the spot in `area` that leads there. */
export function neighbours(area: AreaId): Array<{ to: AreaId; at: Spot }> {
  return LINKS.flatMap((l) => (l.a === area ? [{ to: l.b, at: l.at[l.a]! }] : l.b === area ? [{ to: l.a, at: l.at[l.b]! }] : []));
}

/** The areas to pass through from `from` to `to`, both included; empty if there's no way. */
export function route(from: AreaId, to: AreaId): AreaId[] {
  const came = new Map<AreaId, AreaId | null>([[from, null]]);
  const queue: AreaId[] = [from];
  while (queue.length) {
    const here = queue.shift()!;
    if (here === to) break;
    for (const n of neighbours(here)) {
      if (came.has(n.to)) continue;
      came.set(n.to, here);
      queue.push(n.to);
    }
  }
  if (!came.has(to)) return [];
  const path: AreaId[] = [];
  for (let a: AreaId | null = to; a; a = came.get(a) ?? null) path.unshift(a);
  return path;
}

/**
 * Where to head for, in the area the hero is in, to get to `spot` in area `to`:
 * the spot itself when it's here, otherwise the door or road end that leads the
 * right way. `next` is the area that way leads into. Undefined if there's no way.
 */
export function waypoint(from: AreaId, to: AreaId, spot: Spot): { at: Spot; next: AreaId } | undefined {
  if (from === to) return { at: spot, next: to };
  const path = route(from, to);
  if (path.length < 2) return undefined;
  const step = neighbours(from).find((n) => n.to === path[1]);
  return step && { at: step.at, next: path[1] };
}

/**
 * The region an area is drawn in, and where in that region (its tiles): a region is in
 * itself, and a place indoors or underground is at the door that leads into it
 * (the tavern's cellar at the tavern's door on the square).
 */
export function anchor(area: AreaId, spot?: Spot): { region: Region; at: Spot } | undefined {
  const own = region(area);
  if (own) return spot ? { region: own, at: spot } : { region: own, at: { x: own.tiles.w / 2, y: own.tiles.h / 2 } };
  // The nearest region, by the fewest doors.
  let best: AreaId[] | undefined;
  for (const r of REGIONS) {
    const path = route(area, r.id);
    if (path.length && (!best || path.length < best.length)) best = path;
  }
  if (!best) return undefined;
  const r = region(best[best.length - 1])!;
  const door = neighbours(r.id).find((n) => n.to === best![best!.length - 2])!;
  return { region: r, at: door.at };
}

/** A spot in a region's tiles, in atlas units. */
export function toAtlas(r: Region, at: Spot): Spot {
  return { x: r.box.x + (at.x / r.tiles.w) * r.box.w, y: r.box.y + (at.y / r.tiles.h) * r.box.h };
}

/** Where a spot in any area falls on the world map, in atlas units. */
export function atlasPoint(area: AreaId, spot?: Spot): Spot | undefined {
  const a = anchor(area, spot);
  return a && toAtlas(a.region, a.at);
}

/** Whether an area shows on the map yet: visited, or a region with somewhere visited inside it. */
export function known(area: AreaId, visited: ReadonlySet<AreaId>): boolean {
  if (visited.has(area)) return true;
  if (!region(area)) return false;
  return [...visited].some((v) => !region(v) && anchor(v)?.region.id === area);
}
