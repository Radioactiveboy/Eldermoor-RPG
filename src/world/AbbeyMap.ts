import Phaser from 'phaser';
import { abbeyBuilding } from '../art/abbey';
import { box, circle } from './Collision';
import { MapData, MapObject, placeObject, Prop, Terrain } from './MapData';
import { joinDiagonals } from './MapGenerator';
import { monasteryGateShape } from './MonasteryMap';

export const ABBEY_W = 46;
export const ABBEY_H = 40;

/** The gatehouse in the south wall, four tiles wide; its middle two lead back out. */
const GATE_X = 20;
/** The cloister: its arcade runs round this square, with a way in through the middle of each side. */
const CLOISTER = { x0: 13, y0: 9, x1: 30, y1: 23 };
/** Where the moonpetal grows, on the stone rim of the cloister pond (tile positions). */
export const MOONPETAL = [
  { id: 'moonpetal-0', tx: 19, ty: 14 },
  { id: 'moonpetal-1', tx: 24, ty: 15 },
  { id: 'moonpetal-2', tx: 20, ty: 19 },
] as const;

/**
 * Inside Saint Elda's walls, once Brother Wystan has opened the gate to the
 * hero. Through the gatehouse is the outer court, flagged, with the Saint's
 * well in the middle. North of it the cloister: a square arcade round a
 * garden of herbs and a little pond, where Brother Anselm's moonpetal grows
 * on the rim. Round about stand the brothers' buildings: the chapel and bell
 * tower, the dorter where they sleep, the infirmary and the Prior's lodging
 * along the north; the scriptorium and refectory to the west; and to the east
 * the brothers' graves among old yews. The chapel, infirmary, scriptorium and
 * refectory can be gone into (see AbbeyRooms.ts).
 */
export function buildAbbeyMap(): MapData {
  const W = ABBEY_W;
  const H = ABBEY_H;
  const rnd = new Phaser.Math.RandomDataGenerator(['saint-elda-within']);
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Grass));
    props.push(new Array(W).fill(Prop.None));
  }
  const fill = (x0: number, y0: number, x1: number, y1: number, t: Terrain) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (terrain[y]?.[x] !== undefined) terrain[y][x] = t;
  };

  // The outer court, flagged, from the gate up to the cloister.
  for (let y = 26; y < H - 1; y++) {
    for (let x = 5; x < W - 5; x++) {
      const d = Math.hypot((x + 0.5 - 22) / 17.5, (y + 0.5 - 32) / 7.5);
      if (d < 1) terrain[y][x] = Terrain.Stone;
    }
  }
  fill(GATE_X, 33, GATE_X + 3, H - 1, Terrain.Stone);
  // Flagged paths: from the court up into the cloister, round to every door, and along the north range.
  fill(21, CLOISTER.y1, 22, 27, Terrain.Stone);
  fill(21, 5, 22, CLOISTER.y0, Terrain.Stone);
  fill(3, 5, 41, 6, Terrain.Stone);
  fill(4, 13, 5, 22, Terrain.Stone);
  fill(4, 15, CLOISTER.x0, 16, Terrain.Stone);
  fill(CLOISTER.x1, 15, 36, 16, Terrain.Stone);
  fill(4, 22, 5, 27, Terrain.Stone);
  // Inside the cloister, the walk round under the arcade and a cross of paths to the pond.
  fill(CLOISTER.x0 + 1, CLOISTER.y0 + 1, CLOISTER.x1 - 1, CLOISTER.y0 + 1, Terrain.Stone);
  fill(CLOISTER.x0 + 1, CLOISTER.y1 - 1, CLOISTER.x1 - 1, CLOISTER.y1 - 1, Terrain.Stone);
  fill(CLOISTER.x0 + 1, CLOISTER.y0 + 1, CLOISTER.x0 + 1, CLOISTER.y1 - 1, Terrain.Stone);
  fill(CLOISTER.x1 - 1, CLOISTER.y0 + 1, CLOISTER.x1 - 1, CLOISTER.y1 - 1, Terrain.Stone);
  fill(21, CLOISTER.y0 + 1, 22, CLOISTER.y1 - 1, Terrain.Stone);
  fill(CLOISTER.x0 + 1, 15, CLOISTER.x1 - 1, 16, Terrain.Stone);

  // The herb beds in the four quarters of the cloister garden, and the pond in the middle with a flagged rim.
  const beds: Array<[number, number, number, number]> = [
    [15, 11, 19, 13],
    [24, 11, 28, 13],
    [15, 18, 19, 21],
    [24, 18, 28, 21],
  ];
  for (const [x0, y0, x1, y1] of beds) fill(x0, y0, x1, y1, Terrain.Soil);
  const pond = { x: 22, y: 16, r: 2.3 };
  for (let y = 12; y <= 20; y++) {
    for (let x = 18; x <= 26; x++) {
      const d = Math.hypot(x + 0.5 - pond.x, (y + 0.5 - pond.y) * 1.05);
      if (d < pond.r) terrain[y][x] = Terrain.Water;
      else if (d < pond.r + 1.25) terrain[y][x] = Terrain.Stone;
    }
  }
  joinDiagonals(terrain, Terrain.Water, Terrain.Stone);

  const gateEntry = { x: GATE_X + 2, y: H - 2.6 };
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: gateEntry,
    music: 'monastery',
    decor: 0.3,
    entries: { gate: gateEntry },
    doors: [],
    npcs: [],
    sights: [],
    lights: [],
    seats: [],
    chimneys: [],
    landmarks: [
      { gx: 22, gy: 32, name: 'The outer court', range: 8 },
      { gx: 22, gy: 16, name: 'The cloister garden', range: 8 },
      { gx: 38.5, gy: 15, name: "The brothers' graves", range: 6 },
    ],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });

  // The precinct wall all round: the far sides seen from within, the near sides from behind, with a buttress here and there.
  const wallPiece = (x: number, y: number, alongY: boolean, seed: number) => {
    const pier = seed % 9 === 4;
    const key = pier ? 'mon-wall-pier' : rnd.frac() < 0.2 ? 'mon-wall-ivy' : `mon-wall-${rnd.between(0, 2)}`;
    const shape = pier ? box(0.15, 0.2, 0.85, 0.8) : alongY ? box(0.3, 0, 0.7, 1) : box(0, 0.3, 1, 0.7);
    add(key, x, y, { flipX: alongY, shapes: [shape] });
  };
  for (let x = 0; x < W; x++) {
    wallPiece(x, 0, false, x);
    if (x < GATE_X || x >= GATE_X + 4) wallPiece(x, H - 1, false, x);
  }
  for (let y = 1; y < H - 1; y++) {
    wallPiece(0, y, true, y);
    wallPiece(W - 1, y, true, y + 3);
  }
  // The gatehouse, standing open, with lamps either side.
  placeObject(data, { key: 'mon-gate-open', tx: GATE_X, ty: H - 1, w: 4, h: 1, ...monasteryGateShape(true) });
  for (const tx of [GATE_X + 1, GATE_X + 2]) {
    data.doors!.push({ tx, ty: H - 1, to: 'monastery', entry: 'gate', auto: true, ask: "Do you want to go back out through the gate?" });
  }
  for (const x of [GATE_X - 2, GATE_X + 5]) {
    add('mkt-lamp', x, H - 3, { shapes: [circle(0.5, 0.5, 0.14)] });
    data.lights!.push({ gx: x + 0.5, gy: H - 2.5, z: 50, radius: 140, flicker: 0.5 });
  }

  // The brothers' buildings. Those with a door get it on their front, onto the path along it.
  const building = (key: string, tx: number, ty: number, door?: { to: 'chapel' | 'infirmary' | 'scriptorium' | 'refectory'; label: string }) => {
    const b = abbeyBuilding(key);
    placeObject(data, { key, tx, ty, w: b.w, h: b.h });
    for (const c of b.chimneys) data.chimneys!.push({ gx: tx + c.gx, gy: ty + c.gy, z: c.z });
    if (door && b.door !== undefined) {
      const dx = tx + b.door;
      const dy = ty + b.h;
      terrain[dy][dx] = Terrain.Stone;
      data.doors!.push({ tx: dx, ty: dy, to: door.to, entry: 'door', label: door.label, facing: 'front' });
      data.entries![door.to] = { x: dx + 0.5, y: dy + 1.2 };
    }
  };
  building('abbey-chapel', 4, 1, { to: 'chapel', label: 'Enter the chapel' });
  add('mon-tower', 13, 2, { w: 2, h: 2 });
  building('abbey-dorter', 17, 1);
  building('abbey-infirmary', 30, 2, { to: 'infirmary', label: 'Enter the infirmary' });
  building('abbey-lodging', 38, 1);
  building('abbey-scriptorium', 2, 10, { to: 'scriptorium', label: 'Enter the scriptorium' });
  building('abbey-refectory', 2, 19, { to: 'refectory', label: 'Enter the refectory' });
  add('abbey-turret', 27, 4);
  add('abbey-turret-short', 10, 13);
  data.sights!.push(
    {
      id: 'abbey-dorter', gx: 22, gy: 4.2, label: 'Look', z: 40,
      thought: "The dorter, where the brothers sleep. A board by the door says, in careful letters: 'Brothers only. Guests, this means you.'",
    },
    {
      id: 'abbey-lodging', gx: 40.5, gy: 4.2, label: 'Look', z: 40,
      thought: "The Prior's lodging. The shutters are closed, and there is a very clean step.",
    },
  );
  data.landmarks!.push(
    { gx: 8, gy: 6, name: 'The chapel', range: 4 },
    { gx: 33.5, gy: 6, name: 'The infirmary', range: 4 },
    { gx: 5.5, gy: 14, name: 'The scriptorium', range: 3.5 },
    { gx: 5.5, gy: 23, name: 'The refectory', range: 3.5 },
    { gx: 14, gy: 4.5, name: 'The bell tower', range: 3 },
  );

  // The cloister arcade, all the way round, with a corner pier at each corner and a way through in the middle of each side.
  const midX = (x: number) => x === 21 || x === 22;
  const midY = (y: number) => y === 15 || y === 16;
  const walk = box(0, 0.32, 1, 0.68);
  for (let x = CLOISTER.x0; x <= CLOISTER.x1; x++) {
    for (const y of [CLOISTER.y0, CLOISTER.y1]) {
      const corner = x === CLOISTER.x0 || x === CLOISTER.x1;
      if (corner) add('abbey-arcade-corner', x, y, { shapes: [box(0.28, 0.28, 0.72, 0.72)] });
      else if (!midX(x)) add('abbey-arcade', x, y, { shapes: [walk] });
    }
  }
  for (let y = CLOISTER.y0 + 1; y < CLOISTER.y1; y++) {
    for (const x of [CLOISTER.x0, CLOISTER.x1]) if (!midY(y)) add('abbey-arcade', x, y, { flipX: true, shapes: [box(0.32, 0, 0.68, 1)] });
  }

  // Herbs in the beds, in rows of one kind, and the moonpetal on the pond's rim.
  beds.forEach(([x0, y0, x1, y1], i) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Every other row is left as a path between the plants.
        if ((y - y0) % 2 === 1 || terrain[y][x] !== Terrain.Soil) continue;
        add(`abbey-herbs-${(i + y) % 4}`, x, y, { shapes: [circle(0.5, 0.5, 0.3)] });
      }
    }
  });
  for (const m of MOONPETAL) {
    terrain[m.ty][m.tx] = Terrain.Stone;
    add('abbey-moonpetal', m.tx, m.ty, { shapes: [circle(0.5, 0.5, 0.26)] });
    data.sights!.push({ id: m.id, gx: m.tx + 0.5, gy: m.ty + 0.5, label: 'Gather moonpetal', z: 30, gather: { item: 'moonpetal', picked: 'abbey-moonpetal-picked' } });
    // It shines a little in the dark.
    data.lights!.push({ gx: m.tx + 0.5, gy: m.ty + 0.5, z: 22, radius: 60, flicker: 0 });
  }
  // Benches in the cloister walk, facing the garden.
  for (const [x, y, faceY] of [[17, CLOISTER.y0 + 1, 1], [26, CLOISTER.y0 + 1, 1], [17, CLOISTER.y1 - 1, -1], [26, CLOISTER.y1 - 1, -1]] as const) {
    add('mkt-bench', x, y, { shapes: [box(0.08, 0.35, 0.92, 0.7)] });
    data.seats!.push({ name: 'cloister-bench', gx: x + 0.5, gy: y + 0.55, faceX: 0, faceY, standX: x + 1.5, standY: y + 0.5 });
  }

  // Saint Elda's well in the middle of the court, with benches round it and lamps at the corners.
  add('mkt-well', 21, 31, { w: 2, h: 2 });
  data.sights!.push({
    id: 'abbey-well', gx: 22, gy: 33.1, label: 'Look into the well', z: 40,
    thought: 'Saint Elda\'s well. The water is very clear and very cold, a long way down. Someone has carved "she drank here" on the rim.',
  });
  for (const [x, y] of [[17, 30], [26, 30]] as const) {
    add('mkt-bench', x, y, { shapes: [box(0.08, 0.35, 0.92, 0.7)] });
    data.seats!.push({ name: 'abbey-bench', gx: x + 0.5, gy: y + 0.55, faceX: 0, faceY: 1, standX: x + 0.5, standY: y + 1.5 });
  }
  for (const [x, y] of [[12, 28], [31, 28], [12, 35], [31, 35]] as const) {
    add('mkt-lamp', x, y, { shapes: [circle(0.5, 0.5, 0.14)] });
    data.lights!.push({ gx: x + 0.5, gy: y + 0.5, z: 50, radius: 140, flicker: 0.5 });
  }
  // A carter's barrels by the gate, waiting to go into the cellar.
  add('furn-barrels', 8, 33);
  add('furn-barrels', 9, 34);

  // The brothers' graves, in rows among old yews, east of the cloister.
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 4; i++) {
      const x = 34 + i * 2 + (row % 2);
      const y = 10 + row * 3;
      add(`abbey-grave-${(row * 3 + i) % 3}`, x, y, { shapes: [box(0.3, 0.15, 0.7, 0.35)] });
    }
  }
  data.sights!.push({
    id: 'abbey-grave-hamo', gx: 37.5, gy: 13.8, label: 'Read the stone', z: 24,
    sign: { heading: 'A headstone', lines: ['BROTHER HAMO', 'Keeper of the bees', '', '"Now he rests,', 'and they are glad of it."'] },
  });

  // Trees: yews by the graves, an old pear and an apple in the corners, and a few along the walls.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (terrain[y][x] !== Terrain.Grass || props[y][x] !== Prop.None) continue;
      const graves = x >= 33 && x <= 43 && y >= 8 && y <= 22;
      const edge = Math.min(x - 1, W - 2 - x, y - 1, H - 2 - y);
      const nearDoor = (data.doors ?? []).some((d) => Math.abs(d.tx - x) < 3 && Math.abs(d.ty - y) < 3);
      if (nearDoor || (y <= 7 && x < 44) || (x >= CLOISTER.x0 - 1 && x <= CLOISTER.x1 + 1 && y >= CLOISTER.y0 - 1 && y <= CLOISTER.y1 + 1)) continue;
      const chance = graves ? 0.07 : edge < 1 ? 0.22 : 0.025;
      if (rnd.frac() < chance) props[y][x] = Prop.Tree;
    }
  }

  // Who's about: Brother Anselm among his herbs.
  data.npcs!.push({ id: 'anselm', gx: 17.5, gy: 15.5 });
  return data;
}
