import Phaser from 'phaser';
import { FENCE, fenceKey } from '../art/farm';
import type { CropKind } from '../systems/Farm';
import { fenceShapes } from './Collision';
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

  const data: MapData = { width, height, terrain, props, road, spawn: { x: home.x + 4.5, y: home.y + 1.5 } };
  addCottage(data, home.x, home.y);
  addGarden(data, home.x + 5, home.y - 2);
  // Folk travelling the road, spread out along it (see entities/Npc.ts).
  data.npcs = [
    ['pedlar', 0.22],
    ['pilgrim', 0.5],
    ['drover', 0.74],
  ].map(([id, along]) => {
    const p = road[Math.floor(road.length * (along as number))];
    return { id: id as string, gx: p.x, gy: p.y };
  });
  return data;
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

  // The fence: each piece joins up with the fence pieces beside it.
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
