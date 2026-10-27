import Phaser from 'phaser';
import { box, circle } from './Collision';
import { MapData, placeObject, Prop, Terrain } from './MapData';
import { addFence, joinDiagonals, paintPath, smoothLine, spaced } from './MapGenerator';
import type { CropKind } from '../systems/Farm';

export const MONASTERY_W = 64;
export const MONASTERY_H = 60;

/** The row the monastery's wall stands on, across the whole map. */
const WALL_Y = 8;
/** The gatehouse's west corner: it is four tiles wide, with the road coming up to its middle. */
const GATE_X = 30;
/** Where the Lord's Road comes in from the plains, at the west edge. */
const ROAD_Y = 44;

/**
 * The grounds outside Saint Elda's monastery, at the east end of the Lord's
 * Road across Adowvale Plains: open meadow running up to the monastery's old
 * grey wall, with its gatehouse (barred for now) in the middle and the chapel
 * roof and bell tower showing over the top. In front of the gate a paved
 * forecourt round a statue of the Saint; along the road the brothers'
 * vegetable beds, a row of beehives, wayside shrines with candles burning,
 * and fish ponds with lilies and benches beside them. Four of the brothers
 * are out: the porter at the gate, the gardener, a silent brother walking
 * among the shrines and a novice sweeping the road. Inside the walls is for later.
 */
export function buildMonasteryMap(): MapData {
  const W = MONASTERY_W;
  const H = MONASTERY_H;
  const rnd = new Phaser.Math.RandomDataGenerator(['saint-elda']);
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Grass));
    props.push(new Array(W).fill(Prop.None));
  }
  const gateMid = GATE_X + 2;

  // The fish ponds, each edged with flat stones the brothers laid.
  const ponds = [
    { x: 12, y: 30, r: 3.1, name: 'The lily pond' },
    { x: 49, y: 37, r: 3.6, name: 'The carp pond' },
    { x: 41, y: 50, r: 2.6, name: 'The little pond' },
  ];
  for (const p of ponds) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const wobble = Math.sin(x * 1.3 + p.x) * 0.35 + Math.cos(y * 1.1 + p.y) * 0.35;
        const d = Math.hypot(x + 0.5 - p.x, (y + 0.5 - p.y) * 1.1) + wobble;
        if (d < p.r) terrain[y][x] = Terrain.Water;
        else if (d < p.r + 1) terrain[y][x] = Terrain.Stone;
      }
    }
  }
  joinDiagonals(terrain, Terrain.Water, Terrain.Stone);

  // The Lord's Road, in from the west and bending up to the gate.
  const road = smoothLine([
    { x: -3, y: ROAD_Y + 0.5 },
    { x: 2, y: ROAD_Y + 0.5 },
    { x: 10, y: ROAD_Y - 1 },
    { x: 20, y: ROAD_Y - 3.5 },
    { x: 27, y: 36 },
    { x: gateMid - 0.3, y: 28 },
    { x: gateMid, y: 19 },
    { x: gateMid, y: WALL_Y + 1 },
  ]);
  paintPath(terrain, road, (t) => 1.1 + 0.2 * Math.sin(t * 17.3 + 0.4) + 0.1 * Math.sin(t * 41.1));

  // The forecourt: flagstones in a rough circle before the gate, round the Saint's statue.
  const court = { x: gateMid, y: 14.5, r: 5.2 };
  for (let y = WALL_Y + 1; y < court.y + court.r + 1; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + 0.5 - court.x, (y + 0.5 - court.y) * 1.15);
      if (d < court.r || (y <= WALL_Y + 2 && Math.abs(x + 0.5 - gateMid) < 4)) terrain[y][x] = Terrain.Stone;
    }
  }
  joinDiagonals(terrain, Terrain.Dirt, Terrain.Grass);
  const roadPts = road.filter((p) => p.x >= 0 && p.y >= 0);
  const nearRoad = (x: number, y: number, within: number) => roadPts.some((p) => Math.hypot(p.x - x, p.y - y) < within);

  // Woods along the edges and a scatter of old trees out in the meadow; inside the wall, the brothers' orchard.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (terrain[y][x] !== Terrain.Grass) continue;
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (y < WALL_Y) {
        if ((y < 2 || x < 3 || x > W - 4) && rnd.frac() < 0.6) props[y][x] = Prop.Tree;
        continue;
      }
      if (y <= WALL_Y + 2 || nearRoad(cx, cy, 2.4)) continue;
      const edge = Math.min(x, W - 1 - x, H - 1 - y);
      const chance = edge < 2 ? 0.75 : edge < 4 ? 0.3 : 0.015;
      const roll = rnd.frac();
      if (roll < chance) props[y][x] = Prop.Tree;
      else if (roll < chance + 0.006) props[y][x] = Prop.Rock;
    }
  }

  const entry = { x: 2.2, y: ROAD_Y + 0.5 };
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    // Only the stretch below the forecourt, so the novice sweeping it never walks into the statue.
    road: spaced(road.filter((p) => p.x >= 0.6 && p.y >= 21), 1),
    spawn: entry,
    music: 'monastery',
    decor: 0.38,
    entries: { plains: entry },
    doors: [],
    npcs: [],
    sights: [],
    lights: [],
    seats: [],
    landmarks: [
      { gx: gateMid, gy: WALL_Y + 1, name: 'The monastery gate', range: 5 },
      { gx: court.x, gy: court.y, name: "Saint Elda's statue", range: court.r },
      ...ponds.map((p) => ({ gx: p.x, gy: p.y, name: p.name, range: p.r + 3 })),
    ],
    musings: [
      {
        x0: GATE_X, y0: WALL_Y + 1, x1: GATE_X + 4, y1: WALL_Y + 2,
        text: 'Barred from the inside. Beyond the wall a bell is ringing, and men are singing, very slowly.',
      },
    ],
  };
  const clear = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (props[y]?.[x] !== undefined && props[y][x] !== Prop.Blocked) props[y][x] = Prop.None;
  };

  // The wall, right across, with a buttress every so often and ivy here and there, and the gatehouse in the middle.
  for (let x = 0; x < W; x++) {
    props[WALL_Y][x] = Prop.None;
    if (x >= GATE_X && x < GATE_X + 4) continue;
    const pier = x === 0 || x === W - 1 || x === GATE_X - 1 || x === GATE_X + 4 || x % 9 === 4;
    const key = pier ? 'mon-wall-pier' : rnd.frac() < 0.22 ? 'mon-wall-ivy' : `mon-wall-${rnd.between(0, 2)}`;
    placeObject(data, { key, tx: x, ty: WALL_Y, w: 1, h: 1, shapes: [pier ? box(0.15, 0.2, 0.85, 0.8) : box(0, 0.3, 1, 0.7)] });
  }
  placeObject(data, {
    key: 'mon-gate', tx: GATE_X, ty: WALL_Y, w: 4, h: 1,
    shapes: [box(0.1, 0.2, 1, 0.95), box(1, 0.25, 2, 0.75), box(2, 0.25, 3, 0.75), box(3, 0.2, 3.9, 0.95)],
  });
  data.sights!.push({
    id: 'monastery-gate', gx: gateMid, gy: WALL_Y + 0.9, label: 'Read the carving', z: 92,
    sign: { heading: 'Carved over the gate', lines: ['PAX INTRANTIBUS', 'SALUS EXEUNTIBUS', '', '"Peace to all who enter,', 'and health to all who leave."'] },
  });
  for (const x of [GATE_X - 2, GATE_X + 5]) {
    clear(x, WALL_Y + 1, x, WALL_Y + 1);
    placeObject(data, { key: 'mkt-lamp', tx: x, ty: WALL_Y + 1, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.14)] });
    data.lights!.push({ gx: x + 0.5, gy: WALL_Y + 1.5, z: 50, radius: 140, flicker: 0.5 });
  }

  // Inside the walls, seen over the top: the chapel, the bell tower and the brothers' house.
  clear(6, 1, 14, 5);
  placeObject(data, { key: 'mon-chapel', tx: 7, ty: 2, w: 7, h: 3 });
  clear(39, 2, 42, 6);
  placeObject(data, { key: 'mon-tower', tx: 40, ty: 4, w: 2, h: 2 });
  clear(48, 2, 52, 6);
  placeObject(data, { key: 'bld-house-slate-back', tx: 49, ty: 3, w: 3, h: 3 });
  data.chimneys = [{ gx: 49.62, gy: 3.72, z: 150 }];

  // Saint Elda on her plinth in the middle of the forecourt.
  clear(court.x - 2, court.y - 2, court.x + 1, court.y + 1);
  placeObject(data, { key: 'mon-statue', tx: gateMid - 1, ty: Math.floor(court.y) - 1, w: 2, h: 2 });
  data.sights!.push({
    id: 'monastery-statue', gx: gateMid, gy: Math.floor(court.y) + 1.1, label: 'Read the plinth', z: 30,
    sign: { heading: 'Saint Elda', lines: ['Healer of the sick', 'who took no payment but a prayer.', '', 'Her well is within.'] },
  });

  // The vegetable beds, fenced, one either side of the road below the forecourt, each with a gate onto the road.
  const garden = (x0: number, y0: number, w: number, h: number, gateX: number, seed: number) => {
    const x1 = x0 + w - 1;
    const y1 = y0 + h - 1;
    clear(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    const kinds: Array<CropKind | 'beans'> = ['beans', 'cabbage', 'carrot', 'turnip', 'beans', 'cabbage'];
    let row = 0;
    for (let y = y0 + 1; y < y1; y++) {
      const path = (y - y0) % 2 === 0;
      for (let x = x0 + 1; x < x1; x++) {
        terrain[y][x] = path ? Terrain.Dirt : Terrain.Soil;
        if (path) continue;
        const kind = kinds[(row + seed) % kinds.length];
        const key = kind === 'beans' ? `mon-beans-${(x + y) % 2}` : `mon-crop-${kind}`;
        placeObject(data, { key, tx: x, ty: y, w: 1, h: 1 });
      }
      if (!path) row++;
    }
    for (let y = y0 + 2; y < y1; y += 2) terrain[y][gateX] = Terrain.Dirt;
    const gates = new Set<string>();
    for (let y = y0 + 2; y < y1; y += 2) gates.add(`${gateX},${y}`);
    addFence(data, x0, y0, x1, y1, gates);
  };
  garden(21, 20, 8, 9, 28, 0);
  garden(36, 20, 9, 9, 36, 2);
  // Paths from the garden gates to the road.
  for (const [from, to] of [[28, 31], [33, 36]]) for (let y = 22; y <= 26; y += 2) for (let x = from; x <= to; x++) if (terrain[y][x] === Terrain.Grass) terrain[y][x] = Terrain.Dirt;
  data.landmarks!.push({ gx: 25, gy: 24.5, name: 'The vegetable beds', range: 5 }, { gx: 40.5, gy: 24.5, name: 'The vegetable beds', range: 5 });

  // The beehives, in a row along the sunny side of the east beds.
  clear(46, 20, 48, 30);
  for (let i = 0; i < 5; i++) {
    placeObject(data, { key: 'mon-skep', tx: 47, ty: 21 + i * 2, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.32)] });
  }
  data.landmarks!.push({ gx: 47.5, gy: 25.5, name: 'The beehives', range: 3 });

  // Lilies on the ponds, and a bench beside each to sit and watch the carp.
  ponds.forEach((p, i) => {
    for (let y = Math.floor(p.y - p.r); y <= p.y + p.r; y++) {
      for (let x = Math.floor(p.x - p.r); x <= p.x + p.r; x++) {
        if (terrain[y]?.[x] === Terrain.Water && rnd.frac() < 0.3) placeObject(data, { key: `mon-lilies-${(x + y) % 2}`, tx: x, ty: y, w: 1, h: 1, flat: true });
      }
    }
    // The bench stands on the far (-y) side, facing across the water.
    const bx = Math.floor(p.x) + (i === 1 ? 1 : -1);
    let by = Math.floor(p.y);
    while (terrain[by][bx] === Terrain.Water || terrain[by][bx] === Terrain.Stone) by--;
    clear(bx - 1, by - 1, bx + 1, by);
    placeObject(data, { key: 'mkt-bench', tx: bx, ty: by, w: 1, h: 1, shapes: [box(0.08, 0.35, 0.92, 0.7)] });
    data.seats!.push({ name: `pond-bench-${i}`, gx: bx + 0.5, gy: by + 0.55, faceX: 0, faceY: 1, standX: bx + 0.5, standY: by + 1.5 });
  });

  // Wayside shrines, each with candles burning and a line carved for the passer-by.
  const shrines: Array<{ x: number; y: number; lines: string[] }> = [
    { x: 6, y: ROAD_Y - 3, lines: ["Traveller, you are near Saint Elda's.", 'Walk softly and say a word for the sick.'] },
    { x: 16, y: 28, lines: ['Here Saint Elda washed the feet', 'of a leper, and was not afraid.'] },
    { x: 53, y: 34, lines: ['Still water, still heart.'] },
    { x: 36, y: 45, lines: ['For Brother Hamo, who kept the bees', 'forty years, and was stung for every one.'] },
    { x: 23, y: 42, lines: ['Ask, and it shall be given.', 'Knock, and it shall be opened.', '(Someone has scratched underneath: "NOT THE GATE")'] },
  ];
  shrines.forEach((s, i) => {
    clear(s.x - 1, s.y - 1, s.x + 1, s.y + 1);
    placeObject(data, { key: `mon-shrine-${i % 2}`, tx: s.x, ty: s.y, w: 1, h: 1, shapes: [box(0.15, 0.15, 0.85, 0.85)] });
    data.lights!.push({ gx: s.x + 0.5, gy: s.y + 0.6, z: 44, radius: 80, flicker: 0.7 });
    data.sights!.push({ id: `monastery-shrine-${i}`, gx: s.x + 0.5, gy: s.y + 1, label: 'Read the shrine', z: 70, sign: { heading: 'A wayside shrine', lines: s.lines } });
  });

  // The road runs back west across the plains.
  for (let y = ROAD_Y - 3; y <= ROAD_Y + 3; y++) {
    if (terrain[y][0] !== Terrain.Dirt) continue;
    props[y][0] = Prop.None;
    data.doors!.push({ tx: 0, ty: y, to: 'plains', entry: 'monastery', auto: true, ask: "Do you want to take the Lord's Road back west across Adowvale Plains?" });
  }

  // The brothers: Wystan by his gate, Cuthbert among his beds, Aldo walking between the shrines and ponds, Tobin sweeping the road.
  data.npcs!.push(
    { id: 'porter', gx: GATE_X - 0.6, gy: WALL_Y + 1.8 },
    { id: 'gardener', gx: 32.5, gy: 23.5 },
    { id: 'silent', gx: 44.5, gy: 42.5 },
  );
  const sweep = data.road![Math.floor(data.road!.length * 0.45)];
  data.npcs!.push({ id: 'novice', gx: sweep.x, gy: sweep.y });
  return data;
}
