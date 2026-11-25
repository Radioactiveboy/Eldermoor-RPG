import Phaser from 'phaser';
import { box, circle, Shape } from './Collision';
import { MapData, MapObject, placeObject, Prop, Terrain } from './MapData';
import { joinDiagonals, paintPath, smoothLine } from './MapGenerator';
import { deckKey } from '../art/jetty';
import { HERON_BERTH, JETTY_H, JETTY_PATH_X, JETTY_W, PIER } from './landmarks';

/**
 * Where the near bank meets the water at column x: rows below this are river.
 * The stone quay runs dead straight; to the west the shingle shelves away to the
 * south, and to the east the bank wanders, low and reedy.
 */
export function nearBank(x: number): number {
  if (x >= QUAY.x0 && x <= QUAY.x1) return QUAY.edge;
  if (x < QUAY.x0) return QUAY.edge + (QUAY.x0 - x) * 0.3 + 0.6 * Math.sin(x * 0.9);
  return QUAY.edge - Math.min(2.2, (x - QUAY.x1) * 0.3) + 0.9 * Math.sin(x * 0.55 + 1.2);
}

/** Where the far bank comes down to the water at column x: rows from here on are the far shore. */
export function farBank(x: number): number {
  return 53.5 + 1.8 * Math.sin(x * 0.17 + 0.8) + 0.7 * Math.sin(x * 0.43 + 2);
}

/** The stone quay along the front: its first and last columns, and the row the water starts on. */
const QUAY = { x0: 13, x1: 31, edge: 20 };

/** The reedy islet out in the stream, east of the pier. */
const ISLET = { x: 40, y: 41.5, rx: 3.2, ry: 2 };

/**
 * Adowvale Jetty: the village's landing on the river Wend, down the lane past
 * the garrison. The path comes out of the trees onto a front of fishing huts,
 * a smokehouse and a boathouse, with nets hung up to dry, eel traps and creels
 * stacked about, and a cobbled stone quay with a crane. From the quay a timber
 * pier runs out into the stream on piles, and at it lies the Grey Heron, a
 * single-masted river boat (Maren Tull's: once she's mended she carries the hero
 * down the river to Gloomhaven; see systems/Voyages.ts), with rowing boats tied up round it.
 * West, rowing boats are drawn up on a shingle beach below the boathouse; east,
 * the bank goes to reeds, lilies and an old willow, with a little islet out in
 * the stream. Across the water, the far bank is all woods.
 */
export function buildJettyMap(): MapData {
  const W = JETTY_W;
  const H = JETTY_H;
  const rnd = new Phaser.Math.RandomDataGenerator(['adowvale-jetty']);
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Grass));
    props.push(new Array(W).fill(Prop.None));
  }

  // ---- The river and its banks ----
  for (let x = 0; x < W; x++) {
    const near = nearBank(x);
    const far = farBank(x);
    for (let y = 0; y < H; y++) {
      const cy = y + 0.5;
      if (cy >= near && cy < far) terrain[y][x] = Terrain.Water;
      // The shingle beach west of the quay, a few rows deep; elsewhere a thin strip of sand at the water's edge.
      else if (cy < near && cy >= near - (x < QUAY.x0 ? 3.2 : x > QUAY.x1 ? 0.9 : 0)) terrain[y][x] = Terrain.Sand;
      else if (cy >= far && cy < far + 1.4) terrain[y][x] = Terrain.Sand;
    }
  }
  // The islet: a hump of sand and grass in the stream.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x + 0.5 - ISLET.x) / ISLET.rx, (y + 0.5 - ISLET.y) / ISLET.ry);
      if (d < 0.62) terrain[y][x] = Terrain.Grass;
      else if (d < 1) terrain[y][x] = Terrain.Sand;
    }
  }

  // ---- The quay: cobbled stone along the front, down to the water ----
  for (let y = QUAY.edge - 5; y < QUAY.edge; y++) {
    for (let x = QUAY.x0; x <= QUAY.x1; x++) {
      // Ragged where it gives onto the grass behind it.
      const back = QUAY.edge - 5 + (x === QUAY.x0 || x === QUAY.x1 ? 2 : 0) + (rnd.frac() < 0.3 ? 1 : 0);
      if (y >= back) terrain[y][x] = Terrain.Stone;
    }
  }

  // ---- The path down from Adowvale, and the tracks along the front ----
  const path = smoothLine([
    { x: JETTY_PATH_X, y: -1 }, { x: JETTY_PATH_X, y: 1.5 }, { x: JETTY_PATH_X - 0.6, y: 5 }, { x: JETTY_PATH_X + 0.4, y: 9 }, { x: JETTY_PATH_X - 0.2, y: 13 }, { x: JETTY_PATH_X, y: 15.5 },
  ]);
  paintPath(terrain, path, (t) => 0.95 + 0.18 * Math.sin(t * 11));
  // West along the front to Ebb's hut and the boathouse, and east to the Pellows' hut and the willow.
  paintPath(terrain, smoothLine([{ x: 14, y: 15.4 }, { x: 11, y: 13.6 }, { x: 7.5, y: 15.6 }, { x: 5, y: 17.8 }]), (t) => 0.7 + 0.15 * Math.sin(t * 9));
  paintPath(terrain, smoothLine([{ x: 30.5, y: 15.4 }, { x: 28, y: 13.4 }]), () => 0.65);
  joinDiagonals(terrain, Terrain.Dirt, Terrain.Grass);

  // ---- Trees ----
  const clearings: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  const keepClear = (x0: number, y0: number, x1: number, y1: number) => clearings.push({ x0, y0, x1, y1 });
  keepClear(1, 8, 36, 20); // the front: huts, boathouse, smokehouse, quay
  keepClear(JETTY_PATH_X - 2, 0, JETTY_PATH_X + 3, 9); // the path down
  keepClear(32, 10, 38, 18); // round the willow
  const clear = (x: number, y: number) => clearings.some((c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (terrain[y][x] !== Terrain.Grass) continue;
      const edge = Math.min(x, W - 1 - x, y);
      const farSide = y > farBank(x) + 1;
      const onIslet = Math.hypot(x + 0.5 - ISLET.x, y + 0.5 - ISLET.y) < 3;
      if (onIslet) continue;
      let chance: number;
      if (farSide) chance = 0.62; // the far bank: woods down to the water
      else if (clear(x, y)) chance = 0;
      else if (y < 9) chance = edge < 2 ? 0.85 : 0.42 - y * 0.02; // the woods the path comes down through
      else chance = edge < 2 ? 0.6 : 0.08;
      const roll = rnd.frac();
      if (roll < chance) props[y][x] = Prop.Tree;
      else if (!farSide && !clear(x, y) && roll < chance + 0.015) props[y][x] = Prop.Rock;
    }
  }

  const entry = { x: JETTY_PATH_X + 0.5, y: 1.6 };
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: entry,
    music: 'world',
    decor: 0.3,
    // Stepping ashore off a boat from downriver (Cray's or the Heron, from Gloomhaven), at the end of the pier; and back on the pier
    // beside Maren, after mending her boat (scenes/game/jetty.ts).
    entries: { market: entry, gloomhaven: { x: PIER.x1 + 0.5, y: PIER.headY + 1.4 }, pier: { x: PIER.x1 - 0.4, y: PIER.headY + 0.9 } },
    doors: [],
    sights: [],
    lights: [],
    landmarks: [
      { gx: 22.5, gy: 26, name: 'The pier', range: 4 },
      { gx: HERON_BERTH.tx + 1, gy: HERON_BERTH.ty + 3.5, name: 'The Grey Heron', range: 2.6 },
      { gx: 10.5, gy: 13, name: "Old Ebb's hut", range: 3 },
      { gx: 5, gy: 17, name: 'The boathouse', range: 3.2 },
      { gx: 15, gy: 12, name: 'The smokehouse', range: 2.4 },
      { gx: 6, gy: 21, name: 'The shingle', range: 4 },
      { gx: 22, gy: 17.5, name: 'The quay', range: 6 },
      { gx: 38, gy: 18, name: 'The reed bank', range: 5 },
      { gx: ISLET.x, gy: ISLET.y, name: "Heron's Eyot", range: 4 },
      { gx: JETTY_PATH_X + 0.5, gy: 1, name: 'The lane up to Adowvale', range: 4 },
    ],
    musings: [
      {
        x0: PIER.x0, y0: PIER.headY, x1: PIER.x1 + 1, y1: PIER.headY + 2,
        text: 'The Wend, wide and brown and in no hurry. Somewhere down there it runs past Harrowford, and on to places I have only heard of.',
      },
      {
        x0: 0, y0: 19, x1: 9, y1: 26,
        text: 'Shingle and tar and old rope. It smells of fish, and of the sea, though the sea is days away.',
      },
    ],
    npcs: [],
    seats: [],
    chimneys: [],
    decks: [],
    river: { flow: { x: 1, y: 0.08 }, speed: 0.45 },
    waters: [{ id: 'river', gx: 26, gy: 30, r: 40 }],
  };

  // The path runs off the top edge, up through the trees to Adowvale.
  for (let x = 0; x < W; x++) {
    if (terrain[0][x] !== Terrain.Dirt) continue;
    props[0][x] = Prop.None;
    data.doors!.push({ tx: x, ty: 0, to: 'market', entry: 'jetty', auto: true, ask: 'Do you want to go back up the lane to Adowvale?' });
  }

  const set = (key: string, tx: number, ty: number, w: number, h: number, more: Partial<MapObject> = {}) => {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (props[y]?.[x] === Prop.Tree || props[y]?.[x] === Prop.Rock) props[y][x] = Prop.None;
    placeObject(data, { key, tx, ty, w, h, ...more });
  };
  /** A post or anything slim on a tile people can still walk across: it only blocks its own outline. */
  const slim = (key: string, tx: number, ty: number, shapes: Shape[], more: Partial<MapObject> = {}) =>
    set(key, tx, ty, 1, 1, { blocks: [], shapes, ...more });

  addQuay(data, set, slim);
  addPier(data, slim);
  addBoats(data, set);
  addFront(data, set, slim);
  addBanks(data, rnd, set);

  // ---- Who's here ----
  data.npcs!.push(
    // Maren Tull, at the end of the pier by her boat's stern, looking up the river; she sleeps aboard.
    { id: 'maren', gx: PIER.x1 + 0.5, gy: PIER.headY + 0.55, looking: { x: 0.4, y: -1 }, hours: [6, 22] },
    // Old Ebb, on his stool outside his hut, mending a net.
    { id: 'ebb', gx: 10.5, gy: 13.65, looking: { x: 0, y: 1 }, hours: [6.5, 20.5] },
    // Wren, his granddaughter, busy about the smokehouse and the drying racks.
    { id: 'wren', gx: 16.5, gy: 13.6, hours: [7, 19.5] },
  );
  return data;
}

type Setter = (key: string, tx: number, ty: number, w: number, h: number, more?: Partial<MapObject>) => void;
type Slim = (key: string, tx: number, ty: number, shapes: Shape[], more?: Partial<MapObject>) => void;

/** The quay's stone edge where it drops into the river, a crane, bollards, lamps, and stock waiting to be loaded. */
function addQuay(data: MapData, set: Setter, slim: Slim): void {
  // The quay wall: dressed stone dropping into the water along the front, drawn flat on the edge tiles.
  for (let x = QUAY.x0; x <= QUAY.x1; x++) {
    if (x === 16) continue;
    placeObject(data, { key: `jt-quay-${x % 3}`, tx: x, ty: QUAY.edge - 1, w: 1, h: 1, flat: true });
  }
  // Steps down to the water, cut into the quay west of the pier.
  placeObject(data, { key: 'jt-quay-steps', tx: 16, ty: QUAY.edge - 1, w: 1, h: 1, flat: true });
  // The crane at the quay's edge, its rope down to a net of crates.
  set('jt-crane', 18, QUAY.edge - 2, 1, 1, { shapes: [circle(0.5, 0.5, 0.3)], fades: true });
  set('mkt-crates', 19, QUAY.edge - 3, 1, 1, { shapes: [box(0.1, 0.15, 0.95, 0.95)] });
  set('furn-barrels', 20, QUAY.edge - 4, 1, 1, { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  set('jt-barrels-fish', 14, QUAY.edge - 3, 1, 1, { shapes: [circle(0.5, 0.5, 0.36)] });
  set('jt-creels', 26, QUAY.edge - 2, 1, 1, { shapes: [box(0.12, 0.12, 0.9, 0.9)] });
  set('jt-ropecoil', 25, QUAY.edge - 1, 1, 1, { blocks: [], shapes: [circle(0.5, 0.55, 0.26)] });
  set('jt-anchor', 29, QUAY.edge - 2, 1, 1, { shapes: [circle(0.5, 0.5, 0.3)] });
  // Bollards along the edge to tie up to.
  for (const x of [15, 20, 27, 30]) slim('jt-bollard', x, QUAY.edge - 1, [circle(0.5, 0.62, 0.15)]);
  // Lamps along the quay and up the path.
  for (const [tx, ty] of [[QUAY.x0 + 1, QUAY.edge - 2], [QUAY.x1 - 1, QUAY.edge - 3], [JETTY_PATH_X + 2, 13]]) {
    slim('mkt-lamp', tx, ty, [circle(0.5, 0.5, 0.14)]);
    data.lights!.push({ gx: tx + 0.5, gy: ty + 0.5, z: 50, radius: 150, flicker: 0.5 });
  }
  // The signboard at the head of the quay, where the path comes down.
  set('jt-signboard', JETTY_PATH_X + 2, 15, 1, 1, { shapes: [circle(0.25, 0.5, 0.1), circle(0.75, 0.5, 0.1)] });
  data.sights!.push({
    id: 'jetty-sign', gx: JETTY_PATH_X + 2.5, gy: 15.9, label: 'Read the board', z: 46,
    sign: {
      heading: 'Adowvale Jetty',
      lines: [
        'Wend landing. Tolls to the Headman, Lady Day and Michaelmas.',
        'No boat to put out after the curfew bell.',
        'Eels and smoked fish: ask at the smokehouse.',
        '↑  North: the lane up to Adowvale',
      ],
    },
  });
  data.landmarks!.push({ gx: 17, gy: QUAY.edge - 1.5, name: 'The crane', range: 1.6 });
}

/** The pier: planking on piles out from the quay, with a cross-head at the end; lamps and bollards along it, and a bench at the end. */
function addPier(data: MapData, slim: Slim): void {
  // Lay out the boards first, then dress each tile for the edges it has open to the water.
  const tiles: Array<[number, number]> = [];
  for (let y = QUAY.edge; y < PIER.headY; y++) for (let x = PIER.x0; x <= PIER.x1; x++) tiles.push([x, y]);
  for (let y = PIER.headY; y < PIER.headY + 2; y++) for (let x = PIER.headX0; x <= PIER.headX1; x++) tiles.push([x, y]);
  const isDeck = (x: number, y: number) => tiles.some(([dx, dy]) => dx === x && dy === y);
  for (const [tx, ty] of tiles) {
    data.decks!.push([tx, ty]);
    const open = { n: !isDeck(tx, ty - 1) && ty - 1 >= QUAY.edge, e: !isDeck(tx + 1, ty), s: !isDeck(tx, ty + 1), w: !isDeck(tx - 1, ty) };
    placeObject(data, { key: deckKey(open), tx, ty, w: 1, h: 1, flat: true });
  }
  // Lanterns on posts at the corners of the stem and the cross-head.
  for (const [tx, ty, sx, sy] of [
    [PIER.x0, QUAY.edge + 4, 0.14, 0.5], [PIER.x1, QUAY.edge + 7, 0.86, 0.5], [PIER.headX0, PIER.headY + 1, 0.2, 0.8], [PIER.headX1, PIER.headY + 1, 0.8, 0.8],
  ] as const) {
    slim(sx < 0.5 ? 'jt-pierlamp-w' : 'jt-pierlamp-e', tx, ty, [circle(sx, sy, 0.1)]);
    data.lights!.push({ gx: tx + sx, gy: ty + sy, z: 44, radius: 130, flicker: 0.45 });
  }
  // Bollards on the stem's edges, where the boats tie up.
  for (const [tx, ty, sx] of [[PIER.x0, QUAY.edge + 2, 0.16], [PIER.x0, QUAY.edge + 7, 0.16], [PIER.x1, HERON_BERTH.ty + 1, 0.84], [PIER.x1, HERON_BERTH.ty + 5, 0.84]] as const) {
    slim('jt-bollard', tx, ty, [circle(sx, 0.5, 0.13)]);
  }
  // Odds and ends on the boards.
  slim('jt-ropecoil', PIER.x0, QUAY.edge + 5, [circle(0.35, 0.5, 0.22)]);
  slim('jt-creels', PIER.headX0 + 1, PIER.headY, [box(0.12, 0.12, 0.9, 0.9)]);
  slim('jt-fishbasket', PIER.x1, QUAY.edge + 1, [circle(0.6, 0.5, 0.22)]);
  // A bench at the end, looking out over the water.
  const bx = PIER.x1 + 1;
  const by = PIER.headY + 1;
  slim('mkt-bench', bx, by, [box(0.08, 0.55, 0.92, 0.85)]);
  data.seats!.push({ name: 'pier-bench', gx: bx + 0.5, gy: by + 0.62, faceX: 0, faceY: 1, standX: bx + 0.5, standY: by - 0.4 });
}

/** The Grey Heron at her berth beside the pier, and the rowing boats: tied up, drawn up on the shingle, and one upturned for tarring. */
function addBoats(data: MapData, set: Setter): void {
  const h = HERON_BERTH;
  set('jt-heron', h.tx, h.ty, h.w, h.h, { bob: 1.5 });
  // Her stern lantern, lit at dusk.
  data.lights!.push({ gx: h.tx + 1, gy: h.ty + h.h - 0.6, z: 40, radius: 110, flicker: 0.4 });
  data.sights!.push({
    id: 'jetty-heron', gx: PIER.x1 + 0.85, gy: h.ty + 2.2, label: 'Look at the boat', z: 30,
    thought:
      'The Grey Heron, by the name carved on her stern. A proper river boat: one mast, a sail furled on its yard, ' +
      'a little cabin aft and a hold amidships. She could go anywhere the Wend goes.',
  });
  // Rowing boats tied up round the pier.
  set('jt-rowboat-0', PIER.x0 - 1, QUAY.edge + 3, 1, 2, { bob: 1 });
  set('jt-rowboat-1', PIER.headX0 + 1, PIER.headY + 2, 1, 2, { bob: 1 });
  set('jt-rowboat-2', PIER.headX1 - 1, PIER.headY + 2, 1, 2, { bob: 1 });
  // Drawn up on the shingle below the boathouse.
  set('jt-rowboat-beached', 7, 20, 1, 2);
  set('jt-rowboat-beached', 10, 21, 1, 2, { flipX: true });
  // Upturned on trestles to be tarred, with the tar pot on a fire beside it.
  set('jt-upturned', 1, 18, 1, 2, { shapes: [box(0.1, 0.1, 0.9, 1), box(0.1, 1, 0.9, 1.9)] });
  set('jt-tarpot', 2, 18, 1, 1, { shapes: [circle(0.5, 0.5, 0.25)] });
  data.lights!.push({ gx: 2.5, gy: 18.5, z: 8, radius: 70, flicker: 1 });
  data.sights!.push({
    id: 'jetty-tar', gx: 2.5, gy: 19.2, label: 'Look at the boat', z: 20,
    thought: 'Somebody is tarring the bottom of this one. The pitch is still warm and it sticks to everything, me included.',
  });
}

/** The front: Ebb's hut, the smokehouse, the Pellows' hut, the boathouse and its slipway, nets and traps, and the shrine. */
function addFront(data: MapData, set: Setter, slim: Slim): void {
  // Old Ebb's hut, with a stool outside where he mends his nets.
  set('jt-hut-ebb', 9, 10, 3, 3);
  data.chimneys!.push({ gx: 9.6, gy: 11.3, z: 92 });
  data.lights!.push({ gx: 10.5, gy: 13.1, z: 26, radius: 90, flicker: 0.6 });
  slim('jt-stool', 10, 13, [circle(0.5, 0.5, 0.16)]);
  slim('jt-netmend', 11, 13, [circle(0.55, 0.45, 0.2)]);
  data.sights!.push({
    id: 'jetty-ebb-door', gx: 9.7, gy: 13.3, label: 'Look at the door', z: 26,
    thought: 'A pike\'s head nailed over the door, dried hard, teeth and all. For luck, I suppose. Not the pike\'s.',
  });
  // Nets hung up to dry beside it, and a rack of fish curing in the wind.
  set('jt-netrack', 12, 11, 2, 1, { shapes: [circle(0.12, 0.5, 0.1), circle(1.88, 0.5, 0.1)] });
  set('jt-fishrack', 7, 11, 1, 2, { shapes: [circle(0.5, 0.15, 0.1), circle(0.5, 1.85, 0.1)] });
  set('jt-eeltraps', 8, 13, 1, 1, { shapes: [box(0.1, 0.15, 0.9, 0.9)] });
  data.sights!.push({
    id: 'jetty-eeltraps', gx: 8.5, gy: 14.1, label: 'Look at the traps', z: 16,
    thought: 'Eel traps: long wicker bottles, each with a funnel in its neck. In goes the eel, and it never thinks to come back out the way it went in.',
  });

  // The smokehouse, its vents breathing woodsmoke.
  set('jt-smokehouse', 14, 9, 2, 2);
  data.chimneys!.push({ gx: 15, gy: 10, z: 84 });
  data.chimneys!.push({ gx: 14.6, gy: 9.8, z: 80 });
  data.lights!.push({ gx: 15.2, gy: 11.1, z: 12, radius: 70, flicker: 1 });
  set('jt-guttable', 16, 12, 1, 1, { shapes: [box(0.1, 0.2, 0.9, 0.8)] });
  data.sights!.push({
    id: 'jetty-smokehouse', gx: 15.2, gy: 11.4, label: 'Look inside', z: 20,
    thought: 'Rows and rows of eels and herring hung in the smoke, turning gold. My eyes are streaming. It smells wonderful.',
  });

  // The Pellows' hut, east along the front, with a garden of beans and a water butt.
  set('jt-hut-pellow', 26, 10, 3, 3);
  data.chimneys!.push({ gx: 28.4, gy: 11.3, z: 92 });
  data.lights!.push({ gx: 27.5, gy: 13.1, z: 26, radius: 90, flicker: 0.6 });
  set('jt-netrack', 29, 13, 2, 1, { shapes: [circle(0.12, 0.5, 0.1), circle(1.88, 0.5, 0.1)] });
  set('furn-barrels', 25, 12, 1, 1, { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });

  // The boathouse above the shingle, its doors open on a slipway down to the water.
  set('jt-boathouse', 2, 13, 4, 4);
  data.lights!.push({ gx: 4, gy: 17.1, z: 50, radius: 100, flicker: 0.5 });
  for (let y = 17; y <= 21; y++) {
    for (const x of [3, 4]) {
      data.terrain[y][x] = data.terrain[y][x] === Terrain.Water ? Terrain.Water : Terrain.Sand;
    }
    placeObject(data, { key: y === 17 ? 'jt-slip-top' : 'jt-slip', tx: 3, ty: y, w: 2, h: 1, flat: true });
  }
  data.sights!.push({
    id: 'jetty-boathouse', gx: 4, gy: 17.4, label: 'Look inside', z: 30,
    thought: 'A boat half-built on the stocks, just ribs and a keel like a fish picked clean. Shavings everywhere, and the smell of new oak.',
  });

  // A little shrine by the water, with candles in a niche, to the saint who keeps those who go on the river.
  // Washing out behind the Pellows' hut, and sacks of salt waiting on the quay for the smokehouse.
  set('mkt-washing', 30, 10, 1, 3, { blocks: [[0, 0], [0, 2]], shapes: [circle(0.5, 0.2, 0.08), circle(0.5, 2.8, 0.08)] });
  set('mkt-sacks', 17, 16, 1, 1, { shapes: [circle(0.45, 0.4, 0.3), circle(0.45, 0.7, 0.18)] });
  set('mkt-sacks', 24, 17, 1, 1, { shapes: [circle(0.45, 0.4, 0.3), circle(0.45, 0.7, 0.18)] });
  set('jt-shrine', 32, 14, 1, 1, { shapes: [box(0.2, 0.25, 0.8, 0.8)] });
  data.lights!.push({ gx: 32.5, gy: 14.6, z: 20, radius: 60, flicker: 0.8 });
  data.sights!.push({
    id: 'jetty-shrine', gx: 32.5, gy: 15.2, label: 'Look at the shrine', z: 30,
    thought:
      "A stone niche with the Saints' ring cut over it, and candle stubs, and little things left on the ledge: a fish-hook, a child's shoe, a twist of hair. " +
      'For the ones the river kept.',
  });
  // The old willow on the bank, trailing in the water.
  set('plains-willow', 36, 12, 3, 3);
}

/** Reeds and flags along the soft banks, water lilies in the slack water, and the islet's reeds and a heron. */
function addBanks(data: MapData, rnd: Phaser.Math.RandomDataGenerator, set: Setter): void {
  const { terrain, props } = data;
  const W = data.width;
  const H = data.height;
  const isWater = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && terrain[y][x] === Terrain.Water;
  const busy = (x: number, y: number) => props[y][x] !== Prop.None || (data.decks ?? []).some(([dx, dy]) => Math.abs(dx - x) <= 1 && Math.abs(dy - y) <= 2);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!isWater(x, y) || busy(x, y)) continue;
      const shore = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => !isWater(x + dx, y + dy));
      if (!shore) continue;
      // Reeds along the soft banks: thick to the east and on the islet, here and there on the far side, none at the quay or the shingle.
      const east = x > QUAY.x1 + 1 && y < 30;
      const islet = Math.hypot(x + 0.5 - ISLET.x, y + 0.5 - ISLET.y) < 4;
      const far = y > 46;
      const chance = east ? 0.75 : islet ? 0.7 : far ? 0.35 : 0;
      // In clumps, with open water between.
      const clump = Math.sin(x * 0.7 + y * 1.3) + Math.sin(x * 0.31 - y * 0.5);
      if (clump > -0.4 && rnd.frac() < chance) set(`jt-reeds-${rnd.between(0, 2)}`, x, y, 1, 1, { flipX: rnd.frac() < 0.5 });
    }
  }
  // Lilies in the slack water below the reed bank and round the islet.
  for (const [x, y] of [[36, 21], [38, 22], [40, 21], [43, 20], [37, 40], [43, 43], [36, 43], [44, 39], [46, 22], [34, 23]]) {
    if (isWater(x, y) && props[y][x] === Prop.None) placeObject(data, { key: `jt-lilies-${(x + y) % 2}`, tx: x, ty: y, w: 1, h: 1, blocks: [] });
  }
  // The islet's own tree and the heron fishing off it.
  const ix = Math.floor(ISLET.x);
  const iy = Math.floor(ISLET.y);
  props[iy][ix] = Prop.Tree;
  if (isWater(ix - 2, iy + 1)) set('jt-heronbird', ix - 2, iy + 1, 1, 1);
  data.sights!.push({
    id: 'jetty-heronbird', gx: PIER.headX1 + 0.6, gy: PIER.headY + 1.4, label: 'Look across the water', z: 30,
    thought: 'A heron, out on the eyot, still as a post. Grey as the boat. I suppose that is where she gets her name. Or the other way about.',
  });
}
