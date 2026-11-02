import { circle } from './Collision';
import { CreatureSpawn, MapData, MapObject, placeObject, Prop, Terrain } from './MapData';

export const DEN_W = 30;
export const DEN_H = 26;
/** The back-wall segment with the crevice in it, at the far end of the east hall. */
export const DEN_CREVICE_X = 24;

/**
 * The Wolf Mother's den: an old cave system in a rocky knoll on Adowvale
 * Plains, far bigger than the wolves' cave at home. Walls of rock split it
 * into four chambers. The mouth opens into the first, a wide hall in the
 * daylight; a gap in the rock leads east into a long hall where her wolves
 * lie up, and another south into a gallery round a black pool. Through the
 * gallery, and only through it, is her lair, under a crack in the roof where
 * a little daylight falls on her bed of bones and white fur.
 *
 * At the back of the east hall a low crevice leads deeper into the hill (see
 * DeepDenMap.ts).
 */
export function buildDenMap(): MapData {
  const W = DEN_W;
  const H = DEN_H;
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Cave));
    props.push(new Array(W).fill(Prop.None));
  }
  // The black pool in the gallery.
  for (let y = 19; y <= 23; y++) {
    for (let x = 2; x <= 7; x++) if (Math.hypot((x + 0.5 - 4.8) / 2.8, (y + 0.5 - 21.2) / 2.2) < 1) terrain[y][x] = Terrain.Water;
  }

  const mouth = { x: 1.2, y: 3.5 };
  const creatures: CreatureSpawn[] = [
    // Lying up in the east hall.
    { id: 'den-wolf-1', kind: 'wolf', gx: 17.5, gy: 5.5 },
    { id: 'den-wolf-2', kind: 'wolf', gx: 21.5, gy: 8.5 },
    // Prowling the gallery.
    { id: 'den-wolf-3', kind: 'wolf', gx: 9.5, gy: 17.5 },
    // The Wolf Mother on her bed, and one of her wolves at her side.
    { id: 'den-mother', kind: 'wolfmother', gx: 23.5, gy: 19.5 },
    { id: 'den-wolf-4', kind: 'wolf', gx: 20.5, gy: 22.5 },
  ];
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: mouth,
    indoor: true,
    underground: true,
    music: 'cave',
    walls: {
      back: Array.from({ length: W }, (_, i) => (i === DEN_CREVICE_X ? 'cave-wall-back-crevice' : `cave-wall-back-${(i * 3 + 2) % 4}`)),
      side: Array.from({ length: H }, (_, i) => (i === 3 ? 'cave-wall-side-mouth' : `cave-wall-side-${(i * 3 + 1) % 4}`)),
      corner: 'cave-corner',
      height: 120,
    },
    doors: [
      { tx: 0, ty: 3, to: 'plains', entry: 'den', label: 'Leave the den', ask: 'Do you want to leave the den and go back out onto the plains?' },
      {
        tx: DEN_CREVICE_X, ty: 0, to: 'deepden', entry: 'crevice', label: 'Crawl into the crevice', facing: 'front',
        ask: 'Do you want to squeeze into the crevice? It is a tight fit, and you cannot see where it goes.',
      },
    ],
    entries: { mouth, crevice: { x: DEN_CREVICE_X + 0.5, y: 1.6 } },
    lights: [
      // Daylight through the mouth, and through the crack in the roof over her lair.
      { gx: 0.3, gy: 3.5, z: 40, radius: 260, flicker: 0 },
      { gx: 23.5, gy: 19.5, z: 140, radius: 170, flicker: 0 },
    ],
    creatures,
    sights: [],
    drips: [],
    landmarks: [
      { gx: 5, gy: 5, name: 'The mouth of the den', range: 6 },
      { gx: 21, gy: 5, name: 'The east hall', range: 7 },
      { gx: 7, gy: 19, name: 'The gallery', range: 7 },
      { gx: 22.5, gy: 19.5, name: "The Wolf Mother's lair", range: 7 },
    ],
  };

  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) =>
    placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  // A block of solid rock wall; it turns see-through while the hero is behind it.
  const rock = (tx: number, ty: number) => {
    if (props[ty]?.[tx] !== Prop.None) return;
    add(`cave-rockwall-${(tx * 7 + ty * 3) % 4}`, tx, ty, { fades: true });
  };
  const boulder = (tx: number, ty: number, r = 0.42) => {
    if (props[ty]?.[tx] !== Prop.None) return;
    add(`cave-boulder-${(tx + ty) % 3}`, tx, ty, { shapes: [circle(0.5, 0.5, r)] });
  };

  // Walls of rock between the chambers, each with a gap to pass through.
  for (let y = 0; y <= 12; y++) if (y < 4 || y > 6) rock(12, y);
  for (let x = 0; x < W; x++) if (x < 5 || x > 7) rock(x, 12);
  for (let y = 13; y < H; y++) if (y < 17 || y > 19) rock(15, y);
  // A spur half across the east hall, and rubble along the near edges where the cave closes in.
  for (const [x, y] of [[19, 0], [19, 1], [18, 1]]) rock(x, y);
  for (let x = 0; x < W; x += 3) boulder(x, H - 1);
  for (let y = 0; y < H; y += 3) boulder(W - 1, y);

  // Stalagmites, columns, and stalactites dripping from the dark.
  for (const [tx, ty, v] of [[4, 8, 0], [9, 2, 1], [8, 9, 0], [15, 9, 1], [26, 3, 0], [27, 9, 1], [3, 15, 0], [11, 22, 1], [18, 15, 0], [27, 15, 1], [27, 23, 0]]) {
    add(`cave-stalagmites-${v}`, tx, ty, { shapes: [circle(0.5, 0.55, 0.3)] });
  }
  for (const [tx, ty] of [[6, 1], [23, 10], [10, 14], [19, 23]]) add('cave-column', tx, ty, { shapes: [circle(0.5, 0.5, 0.3)] });
  for (const [tx, ty, v] of [[3, 5, 0], [16, 3, 1], [25, 6, 0], [6, 17, 1], [12, 20, 0], [26, 21, 1]]) {
    add(`cave-stalactites-${v}`, tx, ty, { overhead: true, blocks: [] });
    data.drips!.push({ gx: tx + 0.5, gy: ty + 0.5, z: v === 0 ? 118 : 108 });
  }
  for (const gx of [3.4, 9.6, 15.3, 21.5, 27.4]) data.drips!.push({ gx, gy: 0.2, z: 70 });
  for (const gy of [7.4, 14.6, 20.3]) data.drips!.push({ gx: 0.2, gy, z: 70 });

  // Her lair: the trampled bed, and bones all about it. Some are worth a rummage.
  add('den-lair', 22, 19, { flat: true });
  for (const [tx, ty, v] of [[26, 21, 0], [22, 23, 1], [17, 20, 0], [24, 22, 1]]) add(`cave-bones-${v}`, tx, ty, { flat: true });
  for (const [tx, ty, v] of [[20, 18, 1], [25, 17, 0], [9, 21, 1], [22, 2, 0], [4, 10, 1]]) {
    add(`cave-bones-${v}`, tx, ty, { flat: true });
    data.sights!.push({ id: `den-bones-${tx},${ty}`, gx: tx + 0.5, gy: ty + 0.5, label: 'Search the bones', z: 18, loot: 'bones' });
  }
  data.sights!.push({
    id: 'den-crack', gx: 23.5, gy: 17.6, label: 'Look up', z: 30,
    thought: 'High above, a crack in the roof lets down a thread of daylight. Grass is growing round the edges of it, upside down.',
  });
  return data;
}

/**
 * Through the crevice: a low, cold chamber deep in the hill, where the air
 * moves as if from somewhere further in. Nothing lives here. A passage runs
 * on into the dark beyond the lantern's reach, for another day.
 */
export function buildDeepDenMap(): MapData {
  const W = 14;
  const H = 12;
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Cave));
    props.push(new Array(W).fill(Prop.None));
  }
  for (let y = 1; y <= 5; y++) {
    for (let x = 8; x <= 12; x++) if (Math.hypot((x + 0.5 - 10.3) / 2, (y + 0.5 - 3.2) / 1.6) < 1) terrain[y][x] = Terrain.Water;
  }
  const crevice = { x: 1.2, y: 5.5 };
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: crevice,
    indoor: true,
    underground: true,
    music: 'cave',
    walls: {
      back: Array.from({ length: W }, (_, i) => `cave-wall-back-${(i * 3 + 3) % 4}`),
      side: Array.from({ length: H }, (_, i) => (i === 5 ? 'cave-wall-side-crevice' : `cave-wall-side-${(i * 3 + 2) % 4}`)),
      corner: 'cave-corner',
      height: 120,
    },
    doors: [{ tx: 0, ty: 5, to: 'den', entry: 'crevice', label: 'Crawl back through', ask: 'Do you want to squeeze back through the crevice to the den?' }],
    entries: { crevice },
    lights: [],
    drips: [],
    sights: [],
    landmarks: [{ gx: 7, gy: 6, name: 'A cold chamber', range: 10 }],
    musings: [
      {
        x0: 9, y0: 9, x1: W, y1: H,
        text: 'The cave runs on, down and away into the dark, further than my lantern reaches. Not today. But I will come back.',
      },
    ],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) =>
    placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  for (const [tx, ty, v] of [[4, 2, 0], [6, 8, 1], [11, 7, 0]]) add(`cave-stalagmites-${v}`, tx, ty, { shapes: [circle(0.5, 0.55, 0.3)] });
  add('cave-column', 7, 4, { shapes: [circle(0.5, 0.5, 0.3)] });
  for (const [tx, ty] of [[0, H - 1], [3, H - 1], [6, H - 1], [W - 1, 0], [W - 1, 3], [W - 1, 6]]) add(`cave-boulder-${(tx + ty) % 3}`, tx, ty, { shapes: [circle(0.5, 0.5, 0.42)] });
  for (const [tx, ty] of [[3, 7], [9, 6]]) {
    add('cave-stalactites-1', tx, ty, { overhead: true, blocks: [] });
    data.drips!.push({ gx: tx + 0.5, gy: ty + 0.5, z: 108 });
  }
  data.sights!.push({
    id: 'deep-marks', gx: 5.5, gy: 0.2, label: 'Look closer', z: 50,
    thought: 'Marks scored into the rock: rows of short straight lines, far too neat for claws. Someone has been down here before me, and counted something.',
  });
  return data;
}
