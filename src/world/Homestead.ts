import { FENCE } from '../art/farm';
import { HERBS } from '../systems/Herbs';
import { Homestead, ProjectId, PROJECTS, RUBBLE } from '../systems/Homestead';
import { QuestLog } from '../systems/Quests';
import { box, circle } from './Collision';
import { freeGround } from './HerbPatches';
import { MapData, MapObject, placeObject, Prop, Terrain } from './MapData';
import { addFence } from './MapGenerator';

/**
 * How the Hollow looks as it's put right again (see systems/Homestead.ts):
 * laid over the burnt farm (world/GoblinRaid.ts ruinWorld) each time the map
 * is built, so it always shows the work as it stands.
 *
 * - The cottage: the burnt shell with heaps of charred timber round it, then
 *   swept out, then raised again a day at a time under scaffolding with Osric
 *   and the cooper's boys at work, then whole with a fresh thatch (and smoke
 *   from the chimney once the hearth's in), and later slated.
 * - The builder's pile by the yard, filling up as things are brought.
 * - The improvements on Osric's plans, as each is built.
 * - Timber, reed and stone to be had about the Hollow while there's building to do.
 * - Farmer Iran's stead, mended a piece at a time.
 */

/** The art for a piece of dry-stone wall joined on the sides `mask` says (see art/homestead.ts). */
export function stoneWallKey(mask: number): string {
  return `hs-wall-${mask}`;
}

/** Quest flags (see systems/Quests.ts): the rebuilding is under way, and the improvements after it. */
export const REBUILDING = 'hearth-and-home';

/** Something here belongs to the rebuilding: what E does with it is in scenes/game/homestead.ts. */
export type HomesteadWork = 'rubble' | 'pile';

/** The cottage's back corner, as laid out by the map generator. */
function cottageAt(data: MapData): MapObject | undefined {
  return (data.objects ?? []).find((o) => o.key.startsWith('bld-cottage'));
}

const GROUND = [Terrain.Grass, Terrain.Dirt];

/** Clears trees and rocks off a rectangle, so something can be built there. */
function clearGround(data: MapData, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = data.props[y]?.[x];
      if (p === Prop.Tree || p === Prop.Rock) data.props[y][x] = Prop.None;
    }
  }
}

/** A tile with nothing on it. */
function free(data: MapData, tx: number, ty: number): boolean {
  if (tx < 1 || ty < 1 || tx >= data.width - 1 || ty >= data.height - 1) return false;
  if (data.props[ty][tx] !== Prop.None || data.terrain[ty][tx] === Terrain.Water) return false;
  return !(data.objects ?? []).some((o) => !o.flat && tx >= o.tx && tx < o.tx + o.w && ty >= o.ty && ty < o.ty + o.h);
}

/** The stage of the cottage's art, by how the work stands at `now`. */
export function cottageKey(now: number): string {
  const stage = Homestead.stage;
  if (stage === 'ruin') return 'bld-cottage-burnt';
  if (stage === 'cleared') return 'bld-cottage-cleared';
  if (stage === 'raising') {
    // Before the lads come at dawn, still the swept shell; then a day at a time.
    const w = Homestead.work!;
    if (now < w.from) return 'bld-cottage-cleared';
    return `bld-cottage-raising-${Math.min(2, Math.floor(Homestead.progress(now) * 3))}`;
  }
  return Homestead.built.has('slate-roof') ? 'bld-cottage-slate' : 'bld-cottage-new';
}

/** How full the builder's pile looks (0..3), by how much of what's wanted for the open work has been brought. */
export function pileFill(): 0 | 1 | 2 | 3 {
  if (Homestead.work) return 3;
  let best = 0;
  for (const p of Homestead.open()) {
    const items = Object.entries(PROJECTS[p].needs);
    const total = items.reduce((n, [, k]) => n + (k ?? 0), 0);
    const brought = items.reduce((n, [what]) => n + Homestead.brought(p, what), 0);
    if (total > 0) best = Math.max(best, brought / total);
  }
  return best >= 1 ? 3 : best >= 0.5 ? 2 : best > 0 ? 1 : 0;
}

/**
 * Where everything goes, relative to the cottage's back corner (x0, y0): it
 * stands 3 x 3 with its door on the east side, the garden east of the yard,
 * the road along the south and Mother's grave to the south-west.
 */
export const SPOTS = {
  rubble: [[-1, 2], [0.5, 3.6], [2.5, 3.8], [5, -0.5], [4.6, 3]] as Array<[number, number]>,
  pile: [4, -2] as [number, number],
  well: [3, -2] as [number, number],
  beds: [[-1, 1], [-1, 2], [-2, 2]] as Array<[number, number]>,
  workshop: [-4, 0] as [number, number],
  paddock: { x0: 13, y0: -1, x1: 17, y1: 3 },
  wall: { x0: -5, y0: -4, x1: 3, y1: 2 },
};

/** Lays the rebuilding over the Hollow, as it stands at `now` (clock hours). */
export function homesteadWorld(data: MapData, now: number, hour: number): void {
  Homestead.advance(now);
  steadWorld(data, now, hour);
  const home = cottageAt(data);
  if (!home || !QuestLog.has(REBUILDING)) return;
  const x0 = home.tx;
  const y0 = home.ty;
  const stage = Homestead.stage;
  home.key = cottageKey(now);

  if (stage === 'ruin') {
    // The heaps of burnt timber still to drag out.
    RUBBLE.forEach((id, i) => {
      if (Homestead.cleared.has(id)) return;
      const [dx, dy] = SPOTS.rubble[i];
      const at = freeGround(data, x0 + dx, y0 + dy, GROUND, 3);
      if (!at) return;
      placeObject(data, { key: 'hs-rubble', tx: at.tx, ty: at.ty, w: 1, h: 1, shapes: [box(0.12, 0.15, 0.88, 0.85)] });
      (data.sights ??= []).push({ id, gx: at.tx + 0.5, gy: at.ty + 0.5, label: 'Drag out the burnt timber', z: 22, work: 'rubble' });
    });
  } else {
    sweepUp(data, x0, y0, stage === 'cleared' || (stage === 'raising' && now < Homestead.work!.from));
  }

  // The builder's pile, from the day the shell's swept until everything on Osric's plans is built.
  if (stage !== 'ruin' && Homestead.open().length + (Homestead.work ? 1 : 0) > 0) {
    const at = freeGround(data, x0 + SPOTS.pile[0], y0 + SPOTS.pile[1], GROUND, 3);
    if (at) {
      placeObject(data, { key: `hs-pile-${pileFill()}`, tx: at.tx, ty: at.ty, w: 1, h: 1 });
      const label = Homestead.built.has('hearth') ? "Look over Osric's plans" : "The builder's pile";
      (data.sights ??= []).push({ id: 'hs-pile', gx: at.tx + 0.5, gy: at.ty + 0.5, label, z: 40, work: 'pile' });
    }
  }

  // Work under way: the sawhorse in the yard, and (by day, while they're at it) Osric and the cooper's boys.
  const w = Homestead.work;
  if (w && now >= w.from) {
    const saw = freeGround(data, x0 + 4, y0 + 3, GROUND, 3);
    if (saw) placeObject(data, { key: 'hs-sawhorse', tx: saw.tx, ty: saw.ty, w: 1, h: 1, shapes: [box(0.1, 0.35, 0.9, 0.65)] });
    if (hour >= 7 && hour < 19 && now < w.until) {
      const npcs = (data.npcs ??= []);
      // Osric at the near corner, hammering; one lad at the sawhorse, one carrying about the yard.
      npcs.push({ id: 'hs-osric', gx: x0 + 3.6, gy: y0 + 3.4, looking: { x: -1, y: -1 } });
      if (saw) npcs.push({ id: 'hs-lad-1', gx: saw.tx + 0.5, gy: saw.ty + 1.3, looking: { x: 0, y: -1 } });
      npcs.push({ id: 'hs-lad-2', gx: x0 + 1.5, gy: y0 + 3.8, looking: { x: 0, y: -1 } });
    }
  }

  // The cottage a home again: smoke from the chimney, and the Hollow's own tune back, if quieter.
  if (stage === 'home') {
    (data.chimneys ??= []).push({ gx: x0 + 0.78, gy: y0 + 0.68, z: 134 });
    data.music = 'world';
  }
  for (const p of Homestead.built) improve(data, p, x0, y0);
}

/**
 * The shell swept out: the smoke, the crows, the blood and the ash about the
 * yard go (the scorched ground stays till the walls go up again, `scorched`).
 */
function sweepUp(data: MapData, x0: number, y0: number, scorched: boolean): void {
  const near = (gx: number, gy: number, r: number) => Math.hypot(gx - (x0 + 1.5), gy - (y0 + 1.5)) < r;
  data.chimneys = (data.chimneys ?? []).filter((c) => !(c.ruin && near(c.gx, c.gy, 4)));
  data.crows = (data.crows ?? []).filter((c) => !near(c.gx, c.gy, 9));
  const gone = scorched ? ['decal-blood', 'decal-ash', 'decal-debris'] : ['decal-blood', 'decal-ash', 'decal-debris', 'decal-scorch', 'decal-trampled'];
  data.objects = (data.objects ?? []).filter((o) => !(o.flat && gone.some((k) => o.key.startsWith(k)) && near(o.tx, o.ty, 9)));
}

/** An improvement on Osric's plans, built. */
function improve(data: MapData, p: ProjectId, x0: number, y0: number): void {
  const at = (dx: number, dy: number) => ({ tx: x0 + dx, ty: y0 + dy });
  switch (p) {
    case 'well': {
      const { tx, ty } = at(...SPOTS.well);
      clearGround(data, tx, ty, tx, ty);
      placeObject(data, { key: 'hs-well', tx, ty, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.4)] });
      (data.sights ??= []).push({
        id: 'hs-well', gx: tx + 0.5, gy: ty + 0.5, label: 'Look down the well', z: 56,
        thought: 'Cold, clean water, a long way down. Osric says it never runs dry. I dropped a pebble and counted to three before it splashed.',
      });
      return;
    }
    case 'herb-garden': {
      (['yarrow', 'comfrey', 'sage'] as const).forEach((kind, i) => {
        const { tx, ty } = at(...SPOTS.beds[i]);
        if (!free(data, tx, ty)) return;
        placeObject(data, { key: `hs-bed-${kind}`, tx, ty, w: 1, h: 1, shapes: [box(0.08, 0.08, 0.92, 0.92)] });
        const herb = HERBS[kind];
        (data.sights ??= []).push({
          id: `hs-bed-${kind}`, gx: tx + 0.5, gy: ty + 0.5, label: herb.verb, z: 26,
          gather: { item: herb.item, picked: `hs-bed-${kind}-picked`, regrow: { grown: `hs-bed-${kind}`, count: herb.count + 1, verb: herb.verb } },
        });
      });
      return;
    }
    case 'workshop': {
      const { tx, ty } = at(...SPOTS.workshop);
      clearGround(data, tx - 1, ty - 1, tx + 2, ty + 2);
      placeObject(data, { key: 'hs-workshop', tx, ty, w: 2, h: 2, blocks: [[0, 0], [1, 0], [0, 1]] });
      (data.sights ??= []).push({ id: 'home-bench', gx: tx + 1.0, gy: ty + 0.9, label: 'Brew at the bench', z: 40, station: 'home-bench' });
      return;
    }
    case 'paddock': {
      const { x0: a, y0: b, x1: c, y1: d } = SPOTS.paddock;
      const px0 = x0 + a;
      const py0 = y0 + b;
      const px1 = x0 + c;
      const py1 = y0 + d;
      clearGround(data, px0 - 1, py0 - 1, px1 + 1, py1 + 1);
      // Fenced all round, so the goats stay put (the hero leans on the rails).
      addFence(data, px0, py0, px1, py1, new Set());
      placeObject(data, { key: 'hs-goatshed', tx: px1 - 1, ty: py0 + 1, w: 1, h: 1 });
      for (let y = py0 + 1; y < py1; y++) for (let x = px0 + 1; x < px1; x++) if (data.terrain[y][x] === Terrain.Grass && (x + y) % 3 === 0) data.terrain[y][x] = Terrain.Dirt;
      data.goats = [{ gx: px0 + 1.6, gy: py0 + 2.4 }, { gx: px0 + 2.8, gy: py0 + 3.1 }];
      (data.landmarks ??= []).push({ gx: px0 + 2.5, gy: py0 + 2.5, name: 'The goat paddock', range: 3 });
      return;
    }
    case 'yard-wall': {
      const { x0: a, y0: b, x1: c, y1: d } = SPOTS.wall;
      // A wall along the north and west of the yard, with the gate where the track leaves it north for the cave.
      const tiles = new Set<string>();
      const gates: Array<{ x: number; y: number; along: 'x' | 'y' }> = [];
      for (let x = x0 + a; x <= x0 + c + 1; x++) {
        const y = y0 + b;
        if (data.terrain[y][x] === Terrain.Dirt) {
          if (!gates.length) gates.push({ x, y, along: 'x' });
          continue;
        }
        if (free(data, x, y) || data.props[y][x] === Prop.Tree || data.props[y][x] === Prop.Rock) tiles.add(`${x},${y}`);
      }
      for (let y = y0 + b + 1; y <= y0 + d; y++) {
        const x = x0 + a;
        if (free(data, x, y) || data.props[y][x] === Prop.Tree || data.props[y][x] === Prop.Rock) tiles.add(`${x},${y}`);
      }
      const has = (x: number, y: number) => tiles.has(`${x},${y}`) || gates.some((g) => g.x === x && g.y === y);
      for (const t of tiles) {
        const [x, y] = t.split(',').map(Number);
        data.props[y][x] = Prop.None;
        const mask = (has(x, y - 1) ? FENCE.N : 0) | (has(x, y + 1) ? FENCE.S : 0) | (has(x - 1, y) ? FENCE.W : 0) | (has(x + 1, y) ? FENCE.E : 0);
        placeObject(data, { key: stoneWallKey(mask), tx: x, ty: y, w: 1, h: 1 });
      }
      for (const g of gates) {
        // The gate stands open (it's hung to swing back against the wall): only its piers are in the way.
        placeObject(data, { key: `hs-gate-${g.along}`, tx: g.x, ty: g.y, w: 1, h: 1, blocks: [], shapes: [] });
      }
      return;
    }
    // The walls, the hearth and the slate are in the cottage's own art.
    default:
      return;
  }
}

// ---------------------------------------------------------------- gathering

/**
 * Timber, reed and stone to be had about the Hollow while there's building to
 * do: fallen boughs at the edge of the woods and reed along the lakeshore. They
 * grow back (a bough comes down in every wind) like the wild herbs do.
 */
export function gatheringWorld(data: MapData): void {
  if (!QuestLog.has(REBUILDING) && !QuestLog.has('hollow-made-good')) return;
  // Fallen boughs where the woods meet the meadow, west and south of the cottage.
  for (const [i, [x, y]] of ([[8, 33], [10, 45], [27, 46], [5, 24]] as Array<[number, number]>).entries()) deadfall(data, `hs-deadfall-${i}`, x, y);
  // Reed along the lake's west and south shores.
  const shore: Array<{ tx: number; ty: number }> = [];
  for (let y = 1; y < data.height - 1; y++) {
    for (let x = 1; x < data.width - 1; x++) {
      if (data.terrain[y][x] !== Terrain.Sand || data.props[y][x] !== Prop.None) continue;
      const wet = data.terrain[y][x + 1] === Terrain.Water || data.terrain[y - 1][x] === Terrain.Water;
      if (wet) shore.push({ tx: x, ty: y });
    }
  }
  // A handful, spread out along it (the same every time).
  const picks = shore.filter((_, i) => i % 5 === 2).slice(0, 5);
  picks.forEach(({ tx, ty }, i) => {
    if (!free(data, tx, ty)) return;
    placeObject(data, { key: 'hs-reeds', tx, ty, w: 1, h: 1, shapes: [], blocks: [] });
    (data.sights ??= []).push({
      id: `hs-reeds-${i}`, gx: tx + 0.5, gy: ty + 0.5, label: 'Cut reed', z: 36,
      gather: { item: 'thatching-reed', picked: 'hs-reeds-cut', regrow: { grown: 'hs-reeds', count: 3, verb: 'Cut reed' } },
    });
  });
}

/** A fallen bough on the nearest free ground to (x, y), to cut up for timber. */
export function deadfall(data: MapData, id: string, x: number, y: number): void {
  const at = freeGround(data, x, y, GROUND, 4);
  if (!at) return;
  placeObject(data, { key: 'hs-deadfall', tx: at.tx, ty: at.ty, w: 1, h: 1, shapes: [box(0.05, 0.3, 0.95, 0.7)] });
  (data.sights ??= []).push({
    id, gx: at.tx + 0.5, gy: at.ty + 0.5, label: 'Cut up the fallen bough', z: 22,
    gather: { item: 'timber', picked: 'hs-deadfall-cut', regrow: { grown: 'hs-deadfall', count: 2, verb: 'Cut up the fallen bough' } },
  });
}

/** Fallen facing stones about the old watchtower in the north woods, squared already: as good as dressed. */
export function looseStones(data: MapData, id: string, x: number, y: number): void {
  const at = freeGround(data, x, y, GROUND, 4);
  if (!at) return;
  placeObject(data, { key: 'hs-stones', tx: at.tx, ty: at.ty, w: 1, h: 1, shapes: [box(0.12, 0.15, 0.88, 0.85)] });
  (data.sights ??= []).push({
    id, gx: at.tx + 0.5, gy: at.ty + 0.5, label: 'Take the fallen stones', z: 22,
    gather: { item: 'dressed-stone', picked: 'hs-stones-taken', regrow: { grown: 'hs-stones', count: 2, verb: 'Take the fallen stones' } },
  });
}

/** In the north woods while there's building to do: boughs down by the brook, and stones fallen from the tower. */
export function northWoodsGathering(data: MapData, tower: { x: number; y: number }): void {
  if (!QuestLog.has(REBUILDING) && !QuestLog.has('hollow-made-good')) return;
  looseStones(data, 'hs-stones-0', tower.x - 1, tower.y + 4);
  looseStones(data, 'hs-stones-1', tower.x + 4, tower.y + 3);
  looseStones(data, 'hs-stones-2', tower.x + 4, tower.y - 1);
  deadfall(data, 'hs-deadfall-nw-0', tower.x + 7, tower.y + 6);
  deadfall(data, 'hs-deadfall-nw-1', tower.x + 2, tower.y + 9);
}

// ---------------------------------------------------------------- Iran's stead

/** Iran's stead as far as it's been mended, and the lads at work on it by day. */
function steadWorld(data: MapData, now: number, hour: number): void {
  const objects = data.objects ?? [];
  const hut = objects.find((o) => o.key.startsWith('bld-hut'));
  const coop = objects.find((o) => o.key.startsWith('farm-coop'));
  if (Homestead.steadHas('coop') && coop) {
    coop.key = 'farm-coop';
    const trough = objects.find((o) => o.key === 'farm-trough-burnt');
    if (trough) trough.key = 'farm-trough';
    // The feathers and the scorch about the coop swept up.
    data.objects = objects.filter((o) => !(o.flat && /^decal-(feathers|scorch|blood)/.test(o.key) && Math.hypot(o.tx - coop.tx, o.ty - coop.ty) < 5));
    data.chimneys = (data.chimneys ?? []).filter((c) => !(c.ruin && Math.hypot(c.gx - coop.tx, c.gy - coop.ty) < 3));
    data.crows = (data.crows ?? []).filter((c) => Math.hypot(c.gx - coop.tx, c.gy - coop.ty) > 4);
  }
  if (Homestead.steadHas('hut') && hut) {
    hut.key = 'bld-hut';
    data.objects = (data.objects ?? []).filter((o) => !(o.flat && o.key.startsWith('decal-scorch') && Math.hypot(o.tx - hut.tx, o.ty - hut.ty) < 4));
  }
  if (Homestead.steadHas('barn') && hut) {
    const tx = hut.tx - 5;
    const ty = hut.ty - 2;
    clearGround(data, tx - 1, ty - 1, tx + 3, ty + 2);
    placeObject(data, { key: 'hs-barn', tx, ty, w: 3, h: 2 });
    (data.landmarks ??= []).push({ gx: tx + 1.5, gy: ty + 1, name: "Iran's barn", range: 3 });
  }
  // The cooper's boys at work on whatever's being built, by day.
  const w = Homestead.steadWork;
  if (w && now >= w.from && hour >= 7 && hour < 19 && hut) {
    const next = Homestead.nextStead?.id;
    const spot = next === 'coop' && coop ? { x: coop.tx + 2.6, y: coop.ty + 0.6 } : next === 'barn' ? { x: hut.tx - 1.5, y: hut.ty + 0.5 } : { x: hut.tx + 2.6, y: hut.ty + 3.4 };
    (data.npcs ??= []).push({ id: 'hs-lad-3', gx: spot.x, gy: spot.y, looking: { x: -1, y: 0 } });
  }
}

/**
 * Before the burnt farm is laid over the Hollow: what Iran's pen and the
 * cottage garden looked like, so a mended stead (or a cottage that's home
 * again) can have its fences and hens back as they were.
 */
export interface SteadSnapshot {
  fences: MapObject[];
  hens?: MapData['hens'];
}

export function snapshotStead(data: MapData): SteadSnapshot {
  return {
    fences: (data.objects ?? []).filter((o) => o.key.startsWith('fence-')).map((o) => ({ ...o })),
    hens: data.hens ? { ...data.hens, flock: data.hens.flock.map((h) => ({ ...h })) } : undefined,
  };
}

/** Puts back the fences round Iran's pen (once it's mended) and the cottage garden (once the cottage is home), and his hens. */
export function restoreStead(data: MapData, before: SteadSnapshot): void {
  const pen = data.hens?.pen ?? before.hens?.pen;
  const inPen = (o: MapObject) => !!pen && o.tx >= pen.x0 - 1 && o.tx <= pen.x1 && o.ty >= pen.y0 - 1 && o.ty <= pen.y1;
  const home = cottageAt(data);
  const inGarden = (o: MapObject) => !!home && !inPen(o) && o.tx > home.tx + 3 && o.tx < home.tx + 14 && o.ty > home.ty - 4 && o.ty < home.ty + 8;
  const mend = (which: (o: MapObject) => boolean) => {
    data.objects = (data.objects ?? []).filter((o) => !(o.key.startsWith('fence-') && which(o)));
    for (const f of before.fences.filter(which)) {
      placeObject(data, { ...f });
      // (A knocked-down piece left debris on its tile: that goes too.)
      data.objects = data.objects!.filter((o) => !(o.flat && o.key.startsWith('decal-debris') && o.tx === f.tx && o.ty === f.ty));
    }
  };
  if (Homestead.steadHas('pen')) {
    mend(inPen);
    if (before.hens) data.hens = before.hens;
  }
  if (Homestead.stage === 'home') mend(inGarden);
}
