import Phaser from 'phaser';
import { FENCE, fenceKey } from '../art/farm';
import { HUT_CHIMNEY } from '../art/henfarm';
import { TREK_HOURS } from '../config';
import type { CropKind } from '../systems/Farm';
import { box, circle, fenceShapes } from './Collision';
import { MapData, placeObject, Prop, Terrain } from './MapData';

/**
 * Placeholder procedural map: the family cottage and its vegetable garden, a
 * lake, a winding road and scattered forest. Swap this out for hand-made maps (e.g. Tiled JSON) later;
 * anything that produces a MapData works with the rest of the game.
 */
export function generateMap(width: number, height: number, seed: string): MapData {
  const rnd = new Phaser.Math.RandomDataGenerator([seed]);
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];

  for (let y = 0; y < height; y++) {
    terrain.push(new Array(width).fill(Terrain.Grass));
    props.push(new Array(width).fill(Prop.None));
  }

  // The family cottage sits west of the middle, in the southern half, with its garden beside it.
  // North of it there's room for Farmer Iran's smallholding and, further up, the hill with the cave.
  const home = { x: Math.floor(width / 2) - 8, y: height - 24 };

  // Lake in the north-east, with a sandy shore.
  const lake = { x: width * 0.74, y: height * 0.36, r: Math.min(width, height) * 0.14 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const wobble = Math.sin(x * 0.7) * 0.9 + Math.cos(y * 0.6) * 0.9;
      const d = Phaser.Math.Distance.Between(x, y, lake.x, lake.y) + wobble;
      if (d < lake.r) terrain[y][x] = Terrain.Water;
      else if (d < lake.r + 1.5) terrain[y][x] = Terrain.Sand;
    }
  }

  joinDiagonals(terrain, Terrain.Water, Terrain.Sand);

  // A winding dirt road in from the west edge, bending across the meadow up to the cottage yard.
  // Its line wanders a little each way and it's wider in places, worn in by carts rather than laid out.
  const roadEnd = { x: home.x + 4, y: home.y + 3 };
  const bends: Vec[] = [{ x: -3, y: height - 6.5 }];
  const legs = 4;
  for (let i = 1; i < legs; i++) {
    const t = i / legs;
    bends.push({
      x: Phaser.Math.Linear(0, roadEnd.x, t) + rnd.realInRange(-1.5, 1.5),
      y: Phaser.Math.Linear(height - 6.5, roadEnd.y + 0.5, t * t) + rnd.realInRange(-1.8, 1.8),
    });
  }
  bends.push({ x: roadEnd.x - 1.5, y: roadEnd.y + 0.5 }, { x: roadEnd.x + 0.5, y: roadEnd.y - 0.5 });
  const line = smoothLine(bends);
  // The middle of the road, a step at a time, for travellers to follow (from the west edge in).
  const road = spaced(line.filter((p) => p.x >= 0.6), 1);
  paintPath(terrain, line, (t) => 1.2 + 0.3 * Math.sin(t * 9.1 + 1.3) + 0.15 * Math.sin(t * 23.7));

  // Forest: denser near the edges, never on roads, water or around the cottage.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain[y][x] !== Terrain.Grass) continue;
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      const nearHome = Phaser.Math.Distance.Between(x, y, home.x + 5, home.y + 1) < 7;
      if (nearHome) continue;
      const treeChance = edge < 3 ? 0.65 : 0.08;
      const roll = rnd.frac();
      if (roll < treeChance) props[y][x] = Prop.Tree;
      else if (roll < treeChance + 0.015) props[y][x] = Prop.Rock;
    }
  }
  // Nothing grows on the road, nor right at its edge.
  for (const p of line) {
    for (let y = Math.floor(p.y - 2); y <= p.y + 2; y++) {
      for (let x = Math.floor(p.x - 2); x <= p.x + 2; x++) if (props[y]?.[x] === Prop.Tree || props[y]?.[x] === Prop.Rock) props[y][x] = Prop.None;
    }
  }

  const data: MapData = { width, height, terrain, props, road, music: 'world', spawn: { x: home.x + 4.5, y: home.y + 1.5 } };
  addRoadToMarket(data);
  addCottage(data, home.x, home.y);
  addGarden(data, home.x + 5, home.y - 2);
  addCave(data, { x: home.x + 4, y: home.y - 1 }, home.x + 7, 4);
  addHenFarm(data, home.x - 4, home.y - 23);
  addFisherman(data, Math.round(lake.x));
  joinDiagonals(terrain, Terrain.Dirt, Terrain.Grass);
  // A lone wolf nosing about south of the cottage, in sight of the door.
  (data.creatures ??= []).push({ id: 'cottage-wolf', kind: 'wolf', gx: home.x + 5.5, gy: home.y + 6.5 });
  // Folk travelling the road, spread out along it (see entities/Npc.ts).
  (data.npcs ??= []).push(
    ...[
      ['pedlar', 0.22],
      ['pilgrim', 0.5],
      ['drover', 0.74],
    ].map(([id, along]) => {
      const p = road[Math.floor(road.length * (along as number))];
      return { id: id as string, gx: p.x, gy: p.y };
    }),
  );
  return data;
}

export type Vec = { x: number; y: number };

/** A smooth curve through the points (Catmull-Rom), as closely spaced points along it. */
export function smoothLine(points: Vec[]): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const steps = Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 4);
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({
        x: Phaser.Math.Interpolation.CatmullRom([p0.x, p1.x, p2.x, p3.x], (1 + t) / 3),
        y: Phaser.Math.Interpolation.CatmullRom([p0.y, p1.y, p2.y, p3.y], (1 + t) / 3),
      });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Points along a line roughly `step` tiles apart. */
export function spaced(line: Vec[], step: number): Vec[] {
  const out: Vec[] = [line[0]];
  for (const p of line) {
    const last = out[out.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) >= step) out.push({ x: p.x, y: p.y });
  }
  return out;
}

/**
 * Where two patches of `kind` (dirt, water) only touch at a corner, turns one
 * of the `between` tiles that separate them into it too, so a path or the
 * shore never pinches down to a point.
 */
export function joinDiagonals(terrain: Terrain[][], kind: Terrain, between: Terrain): void {
  const dirt = (x: number, y: number) => terrain[y][x] === kind;
  for (let y = 0; y < terrain.length - 1; y++) {
    for (let x = 0; x < terrain[0].length - 1; x++) {
      const across = (dirt(x, y) && dirt(x + 1, y + 1)) || (dirt(x + 1, y) && dirt(x, y + 1));
      const grass = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].filter(([gx, gy]) => terrain[gy][gx] === between);
      if (across && grass.length === 2) terrain[grass[0][1]][grass[0][0]] = kind;
    }
  }
}

/**
 * Wears a path into the grass along a line: every tile whose centre lies
 * within `radius(t)` of it turns to dirt, t running 0..1 along the line, so
 * the path can widen and narrow as it goes.
 */
export function paintPath(terrain: Terrain[][], line: Vec[], radius: (t: number) => number): void {
  line.forEach((p, i) => {
    const r = radius(i / Math.max(1, line.length - 1));
    for (let y = Math.floor(p.y - r - 1); y <= p.y + r + 1; y++) {
      for (let x = Math.floor(p.x - r - 1); x <= p.x + r + 1; x++) {
        if ((x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2 <= r * r && terrain[y]?.[x] === Terrain.Grass) terrain[y][x] = Terrain.Dirt;
      }
    }
  });
}

/**
 * The road runs off the west edge of the map towards Adowvale and its market (see
 * MarketMap.ts): walking off the end of it goes there. A signpost beside the
 * road points the way.
 */
function addRoadToMarket(data: MapData): void {
  const road = data.road!;
  for (let y = 0; y < data.height; y++) {
    if (data.terrain[y][0] === Terrain.Dirt) {
      (data.doors ??= []).push({
        tx: 0, ty: y, to: 'market', entry: 'road', auto: true,
        ask: 'Do you want to make the trek to Adowvale?', travelHours: TREK_HOURS,
      });
    }
  }
  const arrive = road[3];
  (data.entries ??= {}).market = { x: arrive.x, y: arrive.y };
  // The signpost stands on the grass just north of the road, a few steps in.
  const at = road[5];
  const fromRoad = (x: number, y: number) => Math.min(...road.map((p) => Math.hypot(p.x - x, p.y - y)));
  const spots: Array<{ tx: number; ty: number; score: number }> = [];
  for (let ty = Math.floor(at.y) - 4; ty <= at.y + 4; ty++) {
    for (let tx = Math.floor(at.x) - 4; tx <= at.x + 4; tx++) {
      if (data.terrain[ty]?.[tx] !== Terrain.Grass) continue;
      const d = fromRoad(tx + 0.5, ty + 0.5);
      if (d < 2 || d > 3) continue;
      spots.push({ tx, ty, score: Math.hypot(tx + 0.5 - at.x, ty + 0.5 - (at.y - 2.5)) });
    }
  }
  spots.sort((a, b) => a.score - b.score);
  for (const { tx, ty } of spots.slice(0, 1)) {
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (data.props[y]?.[x] === Prop.Tree || data.props[y]?.[x] === Prop.Rock) data.props[y][x] = Prop.None;
    placeObject(data, { key: 'mkt-signpost', tx, ty, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.1)] });
    (data.sights ??= []).push({
      id: 'signpost-road', gx: tx + 0.5, gy: ty + 0.5, label: 'Read the sign', z: 58,
      sign: {
        heading: 'Signpost',
        lines: ['←  West: Adowvale village and market', '→  East: Adowvale Hollow', '↑  North: the hill caves'],
      },
    });
  }
}

/**
 * The player's home. The door is on its east side; standing on the tile in
 * front of it and pressing E goes inside. The bench by the door can be sat on.
 */
function addCottage(data: MapData, x0: number, y0: number): void {
  // Clear a yard around it and lay a little path from the door to the square.
  for (let y = y0 - 1; y <= y0 + 4; y++) {
    for (let x = x0 - 1; x <= x0 + 4; x++) if (data.props[y]?.[x] !== undefined) data.props[y][x] = Prop.None;
  }
  for (let x = x0 + 3; x < x0 + 5; x++) setIf(data.terrain, x, y0 + 1, Terrain.Dirt);
  placeObject(data, {
    key: 'bld-cottage',
    tx: x0,
    ty: y0,
    w: 3,
    h: 3,
    // The house itself, plus the bench and water barrel by the door.
    blocks: [
      [0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2],
      [3, 0], [3, 2],
    ],
  });
  (data.doors ??= []).push({ tx: x0 + 3, ty: y0 + 1, to: 'home', entry: 'door' });
  // The top of the chimney (see the cottage in art/interior.ts), where the hearth's smoke comes out.
  (data.chimneys ??= []).push({ gx: x0 + 0.78, gy: y0 + 0.68, z: 134 });
  (data.entries ??= {}).cottage = { x: x0 + 4.5, y: y0 + 1.5 };
  (data.seats ??= []).push({ name: 'bench', gx: x0 + 3.32, gy: y0 + 0.6, faceX: 1, faceY: 0, standX: x0 + 4.5, standY: y0 + 0.5 });
  // A dirt track from the door along the yard to the garden gates.
  for (let y = y0; y <= y0 + 3; y++) setIf(data.terrain, x0 + 4, y, Terrain.Dirt);
}

/**
 * The wolves' cave, in the hill at the north edge of the map: a sheep track
 * winds up to it from the cottage yard (starting at `from`, just north of the
 * door), past Farmer Iran's, and the cave mouth opens towards it. (hx, hy) is
 * the hill's back corner. See CaveMap.ts for inside.
 */
function addCave(data: MapData, from: Vec, hx: number, hy: number): void {
  // The hill's 3x3 footprint; its mouth is over the front tile (2, 2), which stays open.
  const door = { x: hx + 2, y: hy + 2 };
  // The track leaves the yard heading north, wanders to and fro, and comes straight at the mouth.
  const rnd = new Phaser.Math.RandomDataGenerator(['sheep-track']);
  const bends: Vec[] = [{ x: from.x + 0.5, y: from.y + 1.5 }, { x: from.x + 0.5, y: from.y - 2 }];
  const legs = 5;
  for (let i = 1; i < legs; i++) {
    const t = i / legs;
    const y = Phaser.Math.Linear(from.y - 3, door.y + 4, t);
    bends.push({ x: Phaser.Math.Linear(from.x + 0.5, door.x + 0.5, t) + (i % 2 ? 1 : -1) * rnd.realInRange(1, 2), y });
  }
  bends.push({ x: door.x + 0.5, y: door.y + 2.5 }, { x: door.x + 0.5, y: door.y + 0.5 });
  const line = smoothLine(bends);
  for (const p of line) {
    for (let y = Math.floor(p.y - 1.5); y <= p.y + 1.5; y++) {
      for (let x = Math.floor(p.x - 1.5); x <= p.x + 1.5; x++) if (data.props[y]?.[x] === Prop.Tree || data.props[y]?.[x] === Prop.Rock) data.props[y][x] = Prop.None;
    }
  }
  paintPath(data.terrain, line, (t) => 0.62 + 0.18 * Math.sin(t * 17.3) + 0.1 * Math.sin(t * 41.9 + 2));
  // Clear the hillside and the ground in front of the mouth.
  for (let y = hy - 1; y <= hy + 4; y++) {
    for (let x = hx - 1; x <= hx + 4; x++) {
      const front = x >= hx + 1 && y >= hy + 1;
      if (data.props[y]?.[x] !== undefined && (front || y >= hy)) data.props[y][x] = Prop.None;
    }
  }
  // The hill itself stands on grass, the track stopping at its mouth.
  for (let y = hy; y < hy + 3; y++) for (let x = hx; x < hx + 3; x++) data.terrain[y][x] = Terrain.Grass;
  const blocks: Array<[number, number]> = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (x !== 2 || y !== 2) blocks.push([x, y]);
  placeObject(data, { key: 'cave-entrance', tx: hx, ty: hy, w: 3, h: 3, blocks });
  data.terrain[door.y][door.x] = Terrain.Dirt;
  (data.doors ??= []).push({ tx: door.x, ty: door.y, to: 'cave', entry: 'mouth', label: 'Enter the cave', facing: 'front', ask: 'Do you want to venture into the cave?' });
  (data.entries ??= {}).cave = { x: door.x + 0.5, y: door.y + 1.6 };
}

/**
 * The vegetable garden: a fenced square of tilled soil with three rows of
 * crops (carrots, cabbages, turnips) and two paths between them, each with a
 * gate on the side facing the cottage.
 */
function addGarden(data: MapData, x0: number, y0: number): void {
  const size = 7;
  const x1 = x0 + size - 1;
  const y1 = y0 + size - 1;
  const rows: Array<[number, CropKind]> = [[y0 + 1, 'carrot'], [y0 + 3, 'cabbage'], [y0 + 5, 'turnip']];
  const gates = new Set([`${x0},${y0 + 2}`, `${x0},${y0 + 4}`]);
  for (let y = y0 - 1; y <= y1 + 1; y++) {
    for (let x = x0 - 1; x <= x1 + 1; x++) if (data.props[y]?.[x] !== undefined) data.props[y][x] = Prop.None;
  }
  for (let y = y0 + 1; y < y1; y++) {
    for (let x = x0 + 1; x < x1; x++) setIf(data.terrain, x, y, Terrain.Soil);
  }
  for (const [y, kind] of rows) {
    for (let x = x0 + 1; x < x1; x++) {
      (data.crops ??= []).push({ tx: x, ty: y, kind });
      data.props[y][x] = Prop.Blocked;
    }
  }
  // Packed-earth paths between the rows, out through the gates.
  for (const y of [y0 + 2, y0 + 4]) for (let x = x0; x < x1; x++) setIf(data.terrain, x, y, Terrain.Dirt);

  addFence(data, x0, y0, x1, y1, gates);
}

/**
 * Farmer Iran's smallholding, west of the sheep track up to the cave: his
 * thatched hut (see HutMap.ts for inside), and in front of it a fenced hen run
 * with a coop and a water trough, its gate opening onto the track. Iran
 * stands by the run. (x0, y0) is the hut's back corner.
 */
function addHenFarm(data: MapData, x0: number, y0: number): void {
  const rnd = new Phaser.Math.RandomDataGenerator(['iran']);
  // The run: fenced from (px0, py0) to (px1, py1), with the gate on its east side.
  const px0 = x0 - 2;
  const py0 = y0 + 5;
  const px1 = px0 + 6;
  const py1 = py0 + 5;
  const gate = { x: px1, y: py0 + 2 };
  // Clear the woods for the yard, then lay paths from the hut door and the gate out to the track.
  for (let y = y0 - 2; y <= py1 + 1; y++) {
    for (let x = px0 - 1; x <= px1 + 2; x++) if (data.props[y]?.[x] !== undefined) data.props[y][x] = Prop.None;
  }
  // Each path heads east and meets the track wherever it first comes to it, sagging a little on the way.
  const toTrack = (x: number, y: number) => {
    let end = x + 1;
    while (end < data.width && data.terrain[y][end] !== Terrain.Dirt) end++;
    const sag = rnd.realInRange(-0.8, 0.8);
    const line = smoothLine([{ x: x + 0.5, y: y + 0.5 }, { x: (x + end) / 2 + 0.5, y: y + 0.5 + sag }, { x: end + 0.5, y: y + 0.5 }]);
    paintPath(data.terrain, line, (t) => 0.6 + 0.12 * Math.sin(t * 13 + x));
    setIf(data.terrain, x, y, Terrain.Dirt);
  };
  const door = { x: x0 + 2, y: y0 + 1 };
  toTrack(door.x, door.y);
  toTrack(gate.x, gate.y);
  // Inside the run the hens have scratched the grass down to bare earth.
  for (let y = py0 + 1; y < py1; y++) for (let x = px0 + 1; x < px1; x++) setIf(data.terrain, x, y, Terrain.Dirt);
  addFence(data, px0, py0, px1, py1, new Set([`${gate.x},${gate.y}`]));

  placeObject(data, {
    key: 'bld-hut', tx: x0, ty: y0, w: 2, h: 3,
    // The hut, plus the chopping block by the door and the woodpile along the front.
    blocks: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2], [0, 3], [1, 3]],
  });
  (data.doors ??= []).push({ tx: door.x, ty: door.y, to: 'hut', entry: 'door', label: 'Go inside' });
  (data.entries ??= {}).hut = { x: door.x + 0.5, y: door.y + 0.5 };
  (data.chimneys ??= []).push({ gx: x0 + HUT_CHIMNEY.gx, gy: y0 + HUT_CHIMNEY.gy, z: HUT_CHIMNEY.z });

  // The coop in the back corner of the run, its ramp facing the gate, and a trough by the fence.
  placeObject(data, { key: 'farm-coop', tx: px0 + 1, ty: py0 + 1, w: 2, h: 1 });
  placeObject(data, { key: 'farm-trough', tx: px0 + 1, ty: py1 - 1, w: 1, h: 1, shapes: [box(0.2, 0.3, 0.8, 0.7)] });
  const pen = { x0: px0 + 1, y0: py0 + 1, x1: px1, y1: py1 };
  const flock = (['rooster', 'white', 'brown', 'speckled', 'white', 'brown'] as const).map((kind, i) => ({
    kind,
    gx: px0 + 2 + (i % 3) * 1.4 + rnd.frac() * 0.5,
    gy: py0 + 2.6 + Math.floor(i / 3) * 1.3 + rnd.frac() * 0.4,
  }));
  data.hens = { pen, flock };
  // Iran keeps an eye on his hens from just outside the run, by the corner nearest his door.
  (data.npcs ??= []).push({ id: 'iran', gx: px1 - 0.5, gy: py0 - 0.5 });
}

/**
 * Old Tobin's spot on the far shore of the lake, across the water from the
 * cottage: a stool on the sand of the north shore at column x, his rod propped
 * out over the water in front of him and his creel at his side. He faces the
 * lake (+y), towards the cottage.
 */
function addFisherman(data: MapData, x: number): void {
  let y = 1;
  while (y < data.height - 1 && !(data.terrain[y][x] !== Terrain.Water && data.terrain[y + 1][x] === Terrain.Water)) y++;
  for (let ty = y - 2; ty <= y; ty++) {
    for (let tx = x - 2; tx <= x + 2; tx++) if (data.props[ty]?.[tx] === Prop.Tree || data.props[ty]?.[tx] === Prop.Rock) data.props[ty][tx] = Prop.None;
  }
  placeObject(data, { key: 'furn-stool', tx: x, ty: y, w: 1, h: 1 });
  placeObject(data, { key: 'fish-rod', tx: x, ty: y + 1, w: 1, h: 1, blocks: [] });
  placeObject(data, { key: 'fish-creel', tx: x + 1, ty: y, w: 1, h: 1, shapes: [box(0.25, 0.3, 0.75, 0.7)] });
  (data.npcs ??= []).push({ id: 'fisherman', gx: x + 0.5, gy: y + 0.5, looking: { x: 0, y: 1 } });
  (data.landmarks ??= []).push({ gx: x + 0.5, gy: y + 0.5, name: "Tobin's fishing spot", range: 4 });
}

/** A rectangle of split-rail fence; each piece joins up with the pieces beside it. Gates are left open. */
export function addFence(data: MapData, x0: number, y0: number, x1: number, y1: number, gates: Set<string>): void {
  const isFence = (x: number, y: number) =>
    (x === x0 || x === x1 || y === y0 || y === y1) && x >= x0 && x <= x1 && y >= y0 && y <= y1 && !gates.has(`${x},${y}`);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!isFence(x, y)) continue;
      const mask =
        (isFence(x, y - 1) ? FENCE.N : 0) | (isFence(x, y + 1) ? FENCE.S : 0) |
        (isFence(x - 1, y) ? FENCE.W : 0) | (isFence(x + 1, y) ? FENCE.E : 0);
      placeObject(data, { key: fenceKey(mask), tx: x, ty: y, w: 1, h: 1, shapes: fenceShapes(mask) });
    }
  }
}

function setIf(grid: Terrain[][], x: number, y: number, t: Terrain): void {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) grid[y][x] = t;
}
