import Phaser from 'phaser';
import { FENCE, fenceKey } from '../art/farm';
import { HUT_CHIMNEY } from '../art/henfarm';
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

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  // Lake in the north-east, with a sandy shore.
  const lake = { x: width * 0.72, y: height * 0.25, r: Math.min(width, height) * 0.14 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const wobble = Math.sin(x * 0.7) * 0.9 + Math.cos(y * 0.6) * 0.9;
      const d = Phaser.Math.Distance.Between(x, y, lake.x, lake.y) + wobble;
      if (d < lake.r) terrain[y][x] = Terrain.Water;
      else if (d < lake.r + 1.5) terrain[y][x] = Terrain.Sand;
    }
  }

  // The family cottage sits just west of the middle, with its garden beside it.
  const home = { x: cx - 7, y: cy - 1 };

  // Winding dirt road from the south-west edge up to the cottage yard.
  const roadEnd = { x: home.x + 3, y: home.y + 3 };
  let rx = 0;
  let ry = height - 6;
  // The middle of the road (it's two tiles wide), step by step, for travellers to follow.
  const road: Array<{ x: number; y: number }> = [];
  while (rx < roadEnd.x || ry > roadEnd.y) {
    road.push({ x: rx + 1, y: ry + 1 });
    for (let oy = 0; oy <= 1; oy++) {
      for (let ox = 0; ox <= 1; ox++) setIf(terrain, rx + ox, ry + oy, Terrain.Dirt);
    }
    if (rx < roadEnd.x && (ry <= roadEnd.y || rnd.frac() < 0.55)) rx++;
    else ry--;
  }

  // Forest: denser near the edges, never on roads, water or around the cottage.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain[y][x] !== Terrain.Grass) continue;
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      const nearSpawn = Phaser.Math.Distance.Between(x, y, cx, cy) < 6;
      if (nearSpawn) continue;
      const treeChance = edge < 3 ? 0.65 : 0.08;
      const roll = rnd.frac();
      if (roll < treeChance) props[y][x] = Prop.Tree;
      else if (roll < treeChance + 0.015) props[y][x] = Prop.Rock;
    }
  }

  const data: MapData = { width, height, terrain, props, road, music: 'world', spawn: { x: home.x + 4.5, y: home.y + 1.5 } };
  addRoadToMarket(data);
  addCottage(data, home.x, home.y);
  addGarden(data, home.x + 5, home.y - 2);
  addCave(data, home.x + 4, home.y - 1);
  addHenFarm(data, home.x - 5, home.y - 16);
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

/**
 * The road runs off the west edge of the map towards the market (see
 * MarketMap.ts): walking off the end of it goes there. A signpost beside the
 * road points the way.
 */
function addRoadToMarket(data: MapData): void {
  const road = data.road!;
  for (let y = 0; y < data.height; y++) {
    if (data.terrain[y][0] === Terrain.Dirt) {
      (data.doors ??= []).push({
        tx: 0, ty: y, to: 'market', entry: 'road', auto: true,
        ask: 'Do you want to make the trek to Adowvale Market?',
      });
    }
  }
  const arrive = road[3];
  (data.entries ??= {}).market = { x: arrive.x, y: arrive.y };
  // The signpost stands on the first patch of grass beside the road, a few steps in.
  const at = road[5];
  for (const [dx, dy] of [[0, -2], [-1, -2], [1, -2], [0, 1], [1, 1]]) {
    const tx = Math.floor(at.x) + dx;
    const ty = Math.floor(at.y) + dy;
    if (data.terrain[ty]?.[tx] !== Terrain.Grass) continue;
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (data.props[y]?.[x] === Prop.Tree || data.props[y]?.[x] === Prop.Rock) data.props[y][x] = Prop.None;
    placeObject(data, { key: 'mkt-signpost', tx, ty, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.1)] });
    (data.sights ??= []).push({
      id: 'signpost-road', gx: tx + 0.5, gy: ty + 0.5, label: 'Read the sign', z: 58,
      sign: {
        heading: 'Signpost',
        lines: ['←  West: Adowvale Market', '→  East: Adowvale Hollow', '↑  North: the hill caves'],
      },
    });
    break;
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
 * runs up to it from the cottage yard (starting at `from`, just north of the
 * door), and the cave mouth opens towards it. See CaveMap.ts for inside.
 */
function addCave(data: MapData, fromX: number, fromY: number): void {
  // The hill's 3x3 footprint; its mouth is over the front tile (2, 2), which stays open.
  const hx = fromX - 2;
  const hy = 3;
  const door = { x: hx + 2, y: hy + 2 };
  // The track wanders a little on its way north.
  const track: Array<{ x: number; y: number }> = [];
  let last = fromX;
  for (let y = fromY; y > door.y; y--) {
    const x = y > fromY - 4 || y < door.y + 3 ? door.x : door.x + Math.round(Math.sin(y * 0.45) * 1.2);
    // Step sideways on the same row, so the track never breaks at a corner.
    for (let sx = Math.min(x, last); sx <= Math.max(x, last); sx++) track.push({ x: sx, y });
    last = x;
  }
  for (const t of track) {
    for (let y = t.y - 1; y <= t.y + 1; y++) for (let x = t.x - 1; x <= t.x + 1; x++) if (data.props[y]?.[x] === Prop.Tree || data.props[y]?.[x] === Prop.Rock) data.props[y][x] = Prop.None;
    setIf(data.terrain, t.x, t.y, Terrain.Dirt);
  }
  // Clear the hillside and the ground in front of the mouth.
  for (let y = hy - 1; y <= hy + 4; y++) {
    for (let x = hx - 1; x <= hx + 4; x++) {
      const front = x >= hx + 1 && y >= hy + 1;
      if (data.props[y]?.[x] !== undefined && (front || y >= hy)) data.props[y][x] = Prop.None;
    }
  }
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
  const toTrack = (x: number, y: number) => {
    for (; x < data.width && data.terrain[y][x] !== Terrain.Dirt; x++) setIf(data.terrain, x, y, Terrain.Dirt);
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

/** A rectangle of split-rail fence; each piece joins up with the pieces beside it. Gates are left open. */
function addFence(data: MapData, x0: number, y0: number, x1: number, y1: number, gates: Set<string>): void {
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
