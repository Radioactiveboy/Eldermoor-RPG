import Phaser from 'phaser';
import { box, circle } from './Collision';
import { CreatureSpawn, MapData, placeObject, Prop, Terrain } from './MapData';
import { tollGateShape } from './MarketMap';
import { joinDiagonals, paintPath, smoothLine, spaced, Vec } from './MapGenerator';

export const PLAINS_W = 72;
export const PLAINS_H = 72;

/** Where the Lord's Road meets the roads west and north. */
const CROSSROADS = { x: 36, y: 35 };

/**
 * Adowvale Plains, beyond Lord Morten's toll gate north of the village: the
 * biggest place yet, rolling open grass full of wildflowers, with copses of
 * trees, a reedy mere and woods thickening at the edges. The Lord's Road comes
 * in through the gate at the south edge and runs up to a crossroads, where it
 * turns east towards Saint Elda's monastery and two older roads go off west and
 * north. Deer graze in herds, hares sit up in the grass, and boar root in the
 * thickets; the game comes back each time the plains are visited. A carter and
 * a herb-gatherer walk the road.
 */
export function buildPlainsMap(): MapData {
  const W = PLAINS_W;
  const H = PLAINS_H;
  const rnd = new Phaser.Math.RandomDataGenerator(['adowvale-plains']);
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Grass));
    props.push(new Array(W).fill(Prop.None));
  }

  // The mere, out in the grass east of the road, with a sandy, trodden rim.
  const mere = { x: 53, y: 53, r: 5.2 };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const wobble = Math.sin(x * 0.9) * 0.7 + Math.cos(y * 0.8) * 0.7;
      const d = Math.hypot(x + 0.5 - mere.x, (y + 0.5 - mere.y) * 1.2) + wobble;
      if (d < mere.r) terrain[y][x] = Terrain.Water;
      else if (d < mere.r + 1.3) terrain[y][x] = Terrain.Sand;
    }
  }
  joinDiagonals(terrain, Terrain.Water, Terrain.Sand);

  // The roads: the Lord's Road from the gate up to the crossroads and on east, and the old roads west and north.
  const gateX = 36;
  const wander = (from: Vec, to: Vec, legs: number, sway: number): Vec[] => {
    const points: Vec[] = [from];
    for (let i = 1; i < legs; i++) {
      const t = i / legs;
      points.push({
        x: Phaser.Math.Linear(from.x, to.x, t) + rnd.realInRange(-sway, sway),
        y: Phaser.Math.Linear(from.y, to.y, t) + rnd.realInRange(-sway, sway),
      });
    }
    points.push(to);
    return points;
  };
  const cross = { x: CROSSROADS.x + 0.5, y: CROSSROADS.y + 0.5 };
  const south = smoothLine([{ x: gateX, y: H + 2 }, { x: gateX, y: H - 3 }, ...wander({ x: gateX + 0.3, y: H - 7 }, { x: cross.x, y: cross.y + 4 }, 4, 2), cross]);
  const east = smoothLine([cross, ...wander({ x: cross.x + 4, y: cross.y - 0.5 }, { x: W - 4, y: 30 }, 5, 2), { x: W + 2, y: 30 }]);
  const west = smoothLine([cross, ...wander({ x: cross.x - 4, y: cross.y + 0.5 }, { x: 4, y: 41 }, 5, 2), { x: -3, y: 41 }]);
  const north = smoothLine([cross, ...wander({ x: cross.x + 0.5, y: cross.y - 4 }, { x: 41, y: 4 }, 4, 2), { x: 41, y: -3 }]);
  const lordsRoad = (t: number) => 1.15 + 0.25 * Math.sin(t * 13.1 + 0.7) + 0.12 * Math.sin(t * 31.3);
  const oldRoad = (t: number) => 0.8 + 0.18 * Math.sin(t * 17.9 + 2.1) + 0.1 * Math.sin(t * 43.7);
  paintPath(terrain, south, lordsRoad);
  paintPath(terrain, east, lordsRoad);
  paintPath(terrain, west, oldRoad);
  paintPath(terrain, north, oldRoad);
  // The crossroads itself, worn wide by carts turning.
  for (let y = CROSSROADS.y - 2; y <= CROSSROADS.y + 2; y++) {
    for (let x = CROSSROADS.x - 2; x <= CROSSROADS.x + 2; x++) {
      if (Math.hypot(x + 0.5 - cross.x, y + 0.5 - cross.y) < 2.2 && terrain[y][x] === Terrain.Grass) terrain[y][x] = Terrain.Dirt;
    }
  }
  joinDiagonals(terrain, Terrain.Dirt, Terrain.Grass);
  const roads = [...south, ...east, ...west, ...north];
  const nearRoad = (x: number, y: number, within: number) => roads.some((p) => Math.abs(p.x - x) < within && Math.abs(p.y - y) < within && Math.hypot(p.x - x, p.y - y) < within);

  // Woods thick along the edges, copses out in the grass, and here and there a lone oak or a boulder.
  const copses: Array<{ x: number; y: number; r: number }> = [];
  while (copses.length < 13) {
    const c = { x: rnd.realInRange(6, W - 6), y: rnd.realInRange(6, H - 10), r: rnd.realInRange(1.8, 3.6) };
    if (nearRoad(c.x, c.y, c.r + 3) || Math.hypot(c.x - mere.x, c.y - mere.y) < mere.r + c.r + 2) continue;
    if (copses.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < o.r + c.r + 4)) continue;
    copses.push(c);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (terrain[y][x] !== Terrain.Grass) continue;
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (nearRoad(cx, cy, 2.3)) continue;
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      const copse = copses.some((c) => Math.hypot(c.x - cx, c.y - cy) < c.r);
      const chance = edge < 2 ? 0.75 : edge < 4 ? 0.35 : copse ? 0.6 : 0.012;
      const roll = rnd.frac();
      if (roll < chance) props[y][x] = Prop.Tree;
      else if (roll < chance + (copse ? 0.05 : 0.006)) props[y][x] = Prop.Rock;
    }
  }

  // The middle of the Lord's Road, from the gate to the east edge, for travellers to walk.
  const road = spaced([...south, ...east].filter((p) => p.x >= 0.6 && p.x <= W - 0.6 && p.y >= 0.6 && p.y <= H - 1.6), 1);
  const entry = { x: gateX, y: H - 2.6 };
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    road,
    spawn: entry,
    music: 'world',
    decor: 0.42,
    entries: { gate: entry },
    doors: [],
    npcs: [],
    sights: [],
    landmarks: [
      { gx: cross.x, gy: cross.y, name: 'The crossroads', range: 7 },
      { gx: gateX, gy: H - 1, name: 'The toll gate', range: 6 },
      { gx: mere.x, gy: mere.y, name: 'The mere', range: mere.r + 4 },
    ],
    musings: [
      {
        x0: W - 5, y0: 26, x1: W, y1: 34,
        text: "The Lord's Road runs on east, to Saint Elda's monastery. A day's walk, they say. I should set out with a full satchel.",
      },
      { x0: 0, y0: 37, x1: 5, y1: 45, text: 'The old road west goes on towards Harrowford and its broken bridge. Nothing for me that way.' },
      { x0: 37, y0: 0, x1: 45, y1: 5, text: 'North, the road climbs towards the Greyfells, where the wolves come down from. Not today.' },
    ],
  };

  // Lord Morten's gate at the south edge, standing open, back to Adowvale.
  const gate = { tx: gateX - 2, ty: H - 1 };
  placeObject(data, { key: 'toll-gate-open', tx: gate.tx, ty: gate.ty, w: 4, h: 1, ...tollGateShape(true) });
  for (let x = gate.tx - 6; x <= gate.tx + 9; x++) {
    if (x >= gate.tx && x < gate.tx + 4) continue;
    props[gate.ty][x] = Prop.None;
    placeObject(data, { key: 'toll-palisade', tx: x, ty: gate.ty, w: 1, h: 1, shapes: [box(0, 0.38, 1, 0.62)] });
  }
  for (let x = gate.tx - 2; x <= gate.tx + 5; x++) for (let y = gate.ty - 3; y < gate.ty; y++) if (props[y][x] !== Prop.Blocked) props[y][x] = Prop.None;
  for (let x = gate.tx + 1; x <= gate.tx + 2; x++) {
    data.doors!.push({ tx: x, ty: gate.ty, to: 'market', entry: 'gate', auto: true, ask: 'Do you want to go back through the toll gate to Adowvale?' });
  }

  // A signpost on the corner of the crossroads.
  const sign = { tx: CROSSROADS.x + 2, ty: CROSSROADS.y + 2 };
  for (let y = sign.ty - 1; y <= sign.ty + 1; y++) for (let x = sign.tx - 1; x <= sign.tx + 1; x++) props[y][x] = Prop.None;
  terrain[sign.ty][sign.tx] = Terrain.Grass;
  placeObject(data, { key: 'mkt-signpost', tx: sign.tx, ty: sign.ty, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.1)] });
  data.sights!.push({
    id: 'signpost-crossroads', gx: sign.tx + 0.5, gy: sign.ty + 0.5, label: 'Read the sign', z: 58,
    sign: {
      heading: 'The crossroads',
      lines: ["→  East: Saint Elda's Monastery", '←  West: Harrowford', '↑  North: the Greyfells', '↓  South: Adowvale (toll gate)'],
    },
  });

  // Game, spread about the grass away from the gate. It comes back on every visit.
  const game: CreatureSpawn[] = [];
  const herd = (id: string, kind: CreatureSpawn['kind'], x: number, y: number, count: number, spread: number) => {
    let placed = 0;
    for (let tries = 0; placed < count && tries < 40; tries++) {
      const gx = x + rnd.realInRange(-spread, spread);
      const gy = y + rnd.realInRange(-spread, spread);
      const tx = Math.floor(gx);
      const ty = Math.floor(gy);
      if (terrain[ty]?.[tx] !== Terrain.Grass || props[ty][tx] !== Prop.None) continue;
      game.push({ id: `${id}-${placed}`, kind, gx: tx + 0.5, gy: ty + 0.5, respawns: true });
      placed++;
    }
  };
  herd('deer-west', 'deer', 18, 52, 3, 2.5);
  herd('deer-north', 'deer', 26, 16, 4, 3);
  herd('deer-east', 'deer', 58, 18, 3, 2.5);
  herd('hare-gate', 'hare', 46, 62, 2, 4);
  herd('hare-cross', 'hare', 26, 30, 2, 4);
  herd('hare-mere', 'hare', 62, 42, 2, 4);
  herd('hare-north', 'hare', 50, 10, 1, 3);
  // Boar keep to the thickets: each roots about at the edge of a copse.
  copses
    .filter((c) => Math.hypot(c.x - gateX, c.y - H) > 18)
    .slice(0, 3)
    .forEach((c, i) => herd(`boar-${i}`, 'boar', c.x + c.r + 1, c.y, 1, 1.2));
  data.creatures = game;

  // Folk on the Lord's Road, a long way apart.
  for (const [id, along] of [['carter', 0.45], ['herbwife', 0.8]] as const) {
    const p = road[Math.floor(road.length * along)];
    data.npcs!.push({ id, gx: p.x, gy: p.y });
  }
  return data;
}
