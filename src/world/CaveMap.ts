import { circle } from './Collision';
import { MapData, MapObject, placeObject, Prop, Terrain } from './MapData';

export const CAVE_W = 16;
export const CAVE_H = 14;

/** Where the ewes lie, deep in the cave: their ids are what GameScene and the quest know them by. */
export const EWES = [
  { id: 'bess', tx: 12, ty: 11, art: 'cave-ewe-0' },
  { id: 'bramble', tx: 14, ty: 11, art: 'cave-ewe-1' },
] as const;

/**
 * The wolves' den: a cave in the hill north of the cottage. The mouth is in
 * the left-hand wall, with daylight showing through it; inside it's dark but
 * for the hero's lantern. Stalactites hang from the walls and the unseen roof,
 * stalagmites and columns rise from the gravelly floor, and a still pool lies
 * in the corner. Three wolves have made it their den, and at the back lie
 * Bess and Bramble, the drover's two lost ewes.
 */
export function buildCaveMap(): MapData {
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < CAVE_H; y++) {
    terrain.push(new Array(CAVE_W).fill(Terrain.Cave));
    props.push(new Array(CAVE_W).fill(Prop.None));
  }
  // A still pool in the far corner of the left wall.
  for (const [x, y] of [[1, 9], [2, 9], [1, 10], [2, 10], [3, 10], [1, 11], [2, 11]]) terrain[y][x] = Terrain.Water;

  const mouth = { x: 1.2, y: 2.5 };
  const data: MapData = {
    width: CAVE_W,
    height: CAVE_H,
    terrain,
    props,
    spawn: mouth,
    indoor: true,
    underground: true,
    music: 'cave',
    walls: {
      back: Array.from({ length: CAVE_W }, (_, i) => `cave-wall-back-${(i * 3 + 1) % 4}`),
      side: Array.from({ length: CAVE_H }, (_, i) => (i === 2 ? 'cave-wall-side-mouth' : `cave-wall-side-${(i * 3 + 2) % 4}`)),
      corner: 'cave-corner',
      height: 120,
    },
    doors: [{ tx: 0, ty: 2, to: 'world', entry: 'cave', label: 'Leave the cave', ask: 'Do you want to leave the cave and head back to Adowvale Hollow?' }],
    entries: { mouth },
    // Daylight through the mouth.
    lights: [{ gx: 0.3, gy: 2.5, z: 40, radius: 240, flicker: 0 }],
    creatures: [
      { id: 'cave-wolf-1', kind: 'wolf', gx: 8.5, gy: 4.5 },
      { id: 'cave-wolf-2', kind: 'wolf', gx: 9.5, gy: 6.5 },
      { id: 'cave-wolf-3', kind: 'wolf', gx: 13, gy: 9.5 },
    ],
    sights: EWES.map((e) => ({ id: e.id, gx: e.tx + 0.5, gy: e.ty + 0.5, label: 'Examine', z: 22 })),
    drips: [],
  };

  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) =>
    placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  const boulder = (tx: number, ty: number, variant: number, r = 0.42) =>
    add(`cave-boulder-${variant}`, tx, ty, { shapes: [circle(0.5, 0.5, r)] });

  // A spur of rock out from the back wall, and another by the pool.
  boulder(7, 0, 0);
  boulder(8, 0, 2);
  boulder(7, 1, 2);
  boulder(7, 2, 1, 0.32);
  boulder(4, 7, 0);
  boulder(3, 7, 1, 0.32);
  boulder(4, 8, 2);
  // Rubble along the near edges, where the cave narrows away into the dark.
  for (const x of [0, 1, 5, 9, 15]) boulder(x, CAVE_H - 1, x % 3);
  for (const y of [0, 5, 6, 10]) boulder(CAVE_W - 1, y, (y + 1) % 3);

  // Stalagmites and columns rising from the floor.
  for (const [tx, ty, v] of [[3, 5, 0], [9, 2, 1], [13, 2, 0], [14, 7, 1], [6, 10, 0], [10, 10, 1], [8, 12, 0], [12, 6, 1]]) {
    add(`cave-stalagmites-${v}`, tx, ty, { shapes: [circle(0.5, 0.55, 0.3)] });
  }
  for (const [tx, ty] of [[11, 3], [5, 12]]) add('cave-column', tx, ty, { shapes: [circle(0.5, 0.5, 0.3)] });

  // Stalactites hanging from the roof, high overhead, dripping.
  for (const [tx, ty, v] of [[4, 3, 0], [9, 8, 1], [12, 12, 0], [6, 6, 1]]) {
    add(`cave-stalactites-${v}`, tx, ty, { overhead: true, blocks: [] });
    data.drips!.push({ gx: tx + 0.5, gy: ty + 0.5, z: v === 0 ? 118 : 108 });
  }
  // And from the tips of the ones along the back walls.
  for (const gx of [2.4, 5.6, 10.3, 13.5]) data.drips!.push({ gx, gy: 0.2, z: 70 });
  for (const gy of [5.4, 8.6, 11.3]) data.drips!.push({ gx: 0.2, gy, z: 70 });

  // The ewes, and old bones the wolves have left about, each worth a rummage.
  for (const e of EWES) add(e.art, e.tx, e.ty, { shapes: [circle(0.5, 0.5, 0.3)] });
  for (const [tx, ty, v] of [[11, 12, 0], [12, 9, 1], [9, 11, 1], [10, 5, 0], [5, 4, 1]]) {
    add(`cave-bones-${v}`, tx, ty, { flat: true });
    data.sights!.push({ id: `bones-${tx},${ty}`, gx: tx + 0.5, gy: ty + 0.5, label: 'Search the bones', z: 18, loot: 'bones' });
  }
  return data;
}
