import { ABBEY_WALL_HEIGHT } from '../art/abbey';
import { ROOM_COUNT } from '../systems/Tavern';
import { box, circle } from './Collision';
import { CreatureSpawn, MapData, MapObject, placeObject, Prop, Seat, Terrain } from './MapData';

/**
 * The Crooked Tankard, Adowvale's inn, on the north side of the market square
 * (see MarketMap.ts): the taproom, the passage upstairs with its four rooms
 * to let, a room, and the cellar where Godric's rats are.
 */

/** Where a maid goes to fetch an order from the bar. */
export const BAR_PICKUP = { x: 7.5, y: 3.5 };

/** The rats in the cellar, in two nests (see the 'cellar-rats' quest). */
export const CELLAR_RATS = ['cellar-rat-1', 'cellar-rat-2', 'cellar-rat-3', 'cellar-rat-4', 'cellar-rat-5', 'cellar-rat-6'];

function emptyRoom(w: number, h: number, floor: Terrain): Pick<MapData, 'width' | 'height' | 'terrain' | 'props'> {
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < h; y++) {
    terrain.push(new Array(w).fill(floor));
    props.push(new Array(w).fill(Prop.None));
  }
  return { width: w, height: h, terrain, props };
}

const stoolShape = [circle(0.5, 0.5, 0.26)];

/**
 * The taproom. The bar runs along the back on the right, with Godric behind
 * it and his kegs and bottles on the wall; the stairs up to the rooms climb
 * the back wall beside it, and the trapdoor to the cellar is by the end of
 * the bar. The hearth is in the far corner, tables are spread about the
 * floor, and the door out to the square is in the left-hand wall. Regulars
 * come and go by the hour (see NpcSpawn.hours): quiet in the day, busy of an
 * evening.
 */
export function buildTavernMap(): MapData {
  const W = 12;
  const H = 10;
  const door = { x: 1.2, y: 8.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: door,
    indoor: true,
    music: 'tavern',
    walls: {
      back: ['shelf-0', 'plain-0', 'plain-1', 'window-0', 'plain-0', 'plain-1', 'plain-0', 'window-1', 'plain-1', 'plain-0', 'plain-1', 'shelf-1'].map((k) => `wall-back-${k}`),
      side: ['plain-0', 'window-0', 'plain-1', 'plain-0', 'window-1', 'plain-1', 'plain-0', 'window-0', 'door-0', 'plain-1'].map((k) => `wall-side-${k}`),
    },
    doors: [
      { tx: 0, ty: 8, to: 'market', entry: 'tavern', label: 'Go outside' },
      { tx: 4, ty: 1, to: 'tavern-hall', entry: 'stairs', label: 'Go upstairs', facing: 'back' },
      { tx: 6, ty: 2, to: 'cellar', entry: 'trapdoor', label: 'Go down to the cellar', facing: 'front', id: 'cellar' },
    ],
    entries: { door, stairs: { x: 4.5, y: 1.7 }, cellar: { x: 5.5, y: 2.6 } },
    lights: [
      { gx: 2, gy: 0.9, z: 14, radius: 280, flicker: 1 },
      { gx: 2.5, gy: 2.5, z: 40, radius: 120, flicker: 0.4 },
      { gx: 9.7, gy: 2.25, z: 38, radius: 150, flicker: 0.5 },
      { gx: 3.7, gy: 4.25, z: 38, radius: 110, flicker: 0.6 },
      { gx: 7.7, gy: 5.25, z: 38, radius: 110, flicker: 0.6 },
      { gx: 4.7, gy: 7.25, z: 38, radius: 110, flicker: 0.6 },
      { gx: 9.7, gy: 8.25, z: 38, radius: 110, flicker: 0.6 },
    ],
    // Godric always; the maids from morning (Rosie from the afternoon); the regulars as the day wears on.
    npcs: [
      { id: 'landlord', gx: 9.5, gy: 1.5, looking: { x: 0, y: 1 } },
      { id: 'nell', gx: 6.5, gy: 4.2, hours: [6, 25] },
      { id: 'rosie', gx: 6.5, gy: 7.5, hours: [16, 25] },
      { id: 'harlan', gx: 11.5, gy: 3.45, looking: { x: 0, y: -1 }, hours: [10, 26] },
      { id: 'fenwick', gx: 5.5, gy: 7.5, looking: { x: -1, y: 0 }, hours: [11, 23] },
      { id: 'sigrun', gx: 1.5, gy: 4.5, looking: { x: 1, y: 0 }, hours: [18, 26] },
      { id: 'ada', gx: 7.5, gy: 8.5, looking: { x: 1, y: 0 }, hours: [17, 24] },
      { id: 'cobb', gx: 10.5, gy: 8.5, looking: { x: -1, y: 0 }, hours: [17, 24] },
      { id: 'pell', gx: 3.5, gy: 2.4, looking: { x: 1, y: 1 }, hours: [19, 25] },
    ],
    seats: [],
    sights: [],
    // Where Nell and Rosie wipe, sweep and tidy between orders.
    chores: [
      { x: 2.5, y: 5.5, face: { x: 0, y: -1 } },
      { x: 3.5, y: 3.5, face: { x: 0, y: 1 } },
      { x: 6.5, y: 4.5, face: { x: 0, y: 1 } },
      { x: 4.5, y: 6.5, face: { x: -1, y: 1 } },
      { x: 8.5, y: 7.5, face: { x: 0, y: 1 } },
      { x: 2.5, y: 1.6, face: { x: -1, y: -1 } },
      { x: 7.5, y: 3.5, face: { x: 0, y: -1 } },
      { x: 10.5, y: 5.5, face: { x: 1, y: 0 } },
      { x: 9.5, y: 9.4, face: { x: -1, y: -1 } },
    ],
  };

  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  const seat = (tx: number, ty: number, face: { x: number; y: number }, stand: { x: number; y: number }, name = 'tavern-table') =>
    data.seats!.push({ name, gx: tx + 0.5, gy: ty + 0.5 - (face.y < 0 ? 0.05 : 0), faceX: face.x, faceY: face.y, standX: stand.x, standY: stand.y } satisfies Seat);

  add('furn-rug', 1, 1, { w: 3, h: 2, flat: true });
  add('furn-doormat', 0, 8, { flat: true });
  add('furn-barrels', 0, 0, { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  add('furn-hearth', 1, 0, { w: 2, anim: 'hearth-fire' });
  // The stairs up, the bar and what's behind it.
  for (let i = 0; i < 3; i++) add(`tav-stairs-${i}`, 4 + i, 0);
  add('furn-cupboard', 7, 0);
  add('tav-kegs', 8, 0, { w: 2 });
  add('tav-shelf', 10, 0, { w: 2 });
  add('tav-bar-side', 7, 1, { shapes: [box(0.2, 0, 0.8, 1)] });
  add('tav-bar-corner', 7, 2, { shapes: [box(0.2, 0, 0.8, 0.8), box(0.8, 0.2, 1, 0.8)] });
  ['tav-bar-1', 'tav-bar-0', 'tav-bar-2', 'tav-bar-1'].forEach((key, i) => add(key, 8 + i, 2, { shapes: [box(0, 0.2, 1, 0.8)] }));
  add('tav-trapdoor', 6, 2, { flat: true });
  add('tav-board', 0, 3, { blocks: [] });
  // Stools along the bar (Harlan has the one at the end).
  for (let x = 8; x <= 11; x++) {
    add('furn-stool', x, 3, { shapes: stoolShape });
    if (x < 11) seat(x, 3, { x: 0, y: -1 }, { x: x + 0.5, y: 4.5 }, 'tavern-bar');
  }
  // The tables, each with its stools, some of them the regulars'. The hero's stools all face away from
  // the room (towards the back walls), so they're seen sitting at the table rather than through it.
  add('tav-table-0', 2, 4, { w: 2 });
  add('furn-stool', 1, 4, { shapes: stoolShape }); // Sigrun's
  add('furn-stool', 4, 4, { shapes: stoolShape });
  seat(4, 4, { x: -1, y: 0 }, { x: 4.5, y: 3.5 });

  add('tav-table-1', 6, 5, { w: 2 });
  add('furn-stool', 8, 5, { shapes: stoolShape });
  add('furn-stool', 6, 6, { shapes: stoolShape });
  add('furn-stool', 7, 6, { shapes: stoolShape });
  seat(8, 5, { x: -1, y: 0 }, { x: 8.5, y: 4.5 });
  seat(6, 6, { x: 0, y: -1 }, { x: 6.5, y: 7.5 });
  seat(7, 6, { x: 0, y: -1 }, { x: 7.5, y: 7.5 });

  add('tav-table-2', 3, 7, { w: 2 });
  add('furn-stool', 3, 8, { shapes: stoolShape });
  add('furn-stool', 5, 7, { shapes: stoolShape }); // Fenwick's
  seat(3, 8, { x: 0, y: -1 }, { x: 2.5, y: 8.5 });

  add('tav-table-3', 8, 8, { w: 2 });
  add('furn-stool', 7, 8, { shapes: stoolShape }); // Ada's
  add('furn-stool', 10, 8, { shapes: stoolShape }); // Cobb's
  add('furn-stool', 8, 9, { shapes: stoolShape });
  seat(8, 9, { x: 0, y: -1 }, { x: 7.5, y: 9.5 });

  add('furn-barrels', 11, 5, { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  add('furn-chest', 0, 6, { flipX: true });

  data.sights!.push({ id: 'tavern-hearth', gx: 2, gy: 1.1, label: 'Cook at the hearth', z: 34, station: 'tavern-hearth' });
  data.sights!.push(
    {
      id: 'tavern-board', gx: 0.35, gy: 3.5, label: 'Read the notices', z: 56,
      sign: {
        heading: 'Pinned to the board',
        lines: [
          'ROOMS TO LET. By the night or the week. Ask Godric.',
          'RATCATCHER WANTED. Good coin. (Ask Godric. Please.)',
          'LOST: one pig, answers to Lucky. -Cobb',
          '(Underneath, another hand: "Not lost. Won. -Ada")',
          'NO SINGING AFTER MIDNIGHT. THIS MEANS YOU, PELL.',
        ],
      },
    },
  );
  return data;
}

/** The passage upstairs: four numbered doors along it, a candle on a little table at the end, and the stairs back down. */
export function buildTavernHallMap(): MapData {
  const W = 10;
  const H = 3;
  const stairs = { x: 1.2, y: 1.5 };
  const back = ['window-0', 'plain-0', 'door-0', 'plain-1', 'door-1', 'plain-0', 'door-0', 'plain-1', 'door-1', 'window-1'];
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: stairs,
    indoor: true,
    music: 'tavern',
    walls: {
      back: back.map((k) => `wall-back-${k}`),
      side: ['plain-0', 'door-1', 'plain-1'].map((k) => `wall-side-${k}`),
    },
    doors: [{ tx: 0, ty: 1, to: 'tavern', entry: 'stairs', label: 'Go downstairs' }],
    entries: { stairs },
    lights: [
      { gx: 9.5, gy: 2.5, z: 28, radius: 140, flicker: 0.6 },
      { gx: 4.5, gy: 0.4, z: 60, radius: 150, flicker: 0.4 },
    ],
    sights: [],
  };
  for (let n = 1; n <= ROOM_COUNT; n++) {
    const tx = n * 2;
    data.doors!.push({ tx, ty: 0, to: 'tavern-room', entry: 'door', label: `Room ${n}`, facing: 'back', id: `room-${n}` });
    data.entries![`room-${n}`] = { x: tx + 0.5, y: 1.1 };
  }
  placeObject(data, { key: 'tav-runner', tx: 1, ty: 1, w: 8, h: 1, flat: true });
  placeObject(data, { key: 'tav-sidetable', tx: 9, ty: 2, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.3)] });
  placeObject(data, { key: 'furn-chest', tx: 0, ty: 2, w: 1, h: 1, flipX: true });
  return data;
}

/**
 * A room to let upstairs: a proper bed (the hero's to sleep in, and so save,
 * while the room is theirs), a washstand, a chest, a candle by the window.
 * All four rooms are alike; `room` is the one the hero has, for the way back
 * out to its door in the passage.
 */
export function buildTavernRoomMap(room: number): MapData {
  const W = 5;
  const H = 5;
  const door = { x: 1.2, y: 3.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: door,
    indoor: true,
    music: 'menu',
    walls: {
      back: ['plain-0', 'window-0', 'plain-1', 'shelf-0', 'window-1'].map((k) => `wall-back-${k}`),
      side: ['plain-1', 'window-1', 'plain-0', 'door-0', 'plain-1'].map((k) => `wall-side-${k}`),
    },
    doors: [{ tx: 0, ty: 3, to: 'tavern-hall', entry: `room-${room}`, label: 'Go out to the passage' }],
    entries: { door },
    lights: [
      { gx: 4.5, gy: 0.5, z: 28, radius: 160, flicker: 0.6 },
      { gx: 1.5, gy: 0.4, z: 50, radius: 90, flicker: 0.2 },
    ],
    beds: [{ id: 'tavern-room', tx: 3, ty: 1, gx: 2.5, gy: 1.6 }],
    sights: [
      { id: 'tavern-room-window', gx: 1.5, gy: 0.3, label: 'Look out', z: 60, thought: 'The window looks out over the market square. Somebody down there is singing, badly. Pell, probably.' },
    ],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  add('furn-rug', 1, 2, { w: 3, h: 2, flat: true });
  add('furn-bed', 3, 0, { h: 2 });
  add('tav-sidetable', 4, 0, { shapes: [circle(0.5, 0.5, 0.3)] });
  add('tav-washstand', 1, 0, { shapes: [box(0.15, 0.15, 0.85, 0.85)] });
  add('furn-chest', 4, 3);
  add('furn-stool', 2, 0, { shapes: stoolShape });
  return data;
}

/**
 * The cellar under the taproom: cold stone, barrels and sacks of grain, a
 * keg the rats have gnawed through, and two nests of rats. The steps climb
 * the back wall up to the trapdoor.
 */
export function buildCellarMap(): MapData {
  const W = 14;
  const H = 9;
  const foot = { x: 1.5, y: 1.7 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Stone),
    spawn: foot,
    indoor: true,
    underground: true,
    music: 'cave',
    walls: {
      back: Array.from({ length: W }, (_v, i) => `swall-back-plain-${i % 2}`),
      side: Array.from({ length: H }, (_v, i) => `swall-side-plain-${(i + 1) % 2}`),
      corner: 'swall-corner',
      height: ABBEY_WALL_HEIGHT,
    },
    doors: [{ tx: 1, ty: 1, to: 'tavern', entry: 'cellar', label: 'Go up to the taproom', facing: 'back' }],
    entries: { trapdoor: foot },
    lights: [
      { gx: 1.5, gy: 1.2, z: 70, radius: 140, flicker: 0.5 },
      { gx: 7.5, gy: 4.5, z: 60, radius: 70, flicker: 0.2 },
    ],
    sights: [],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  const barrels = { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] };
  const crate = { shapes: [box(0.1, 0.15, 0.95, 0.95)] };
  const sack = { shapes: [circle(0.32, 0.35, 0.26), circle(0.68, 0.62, 0.27)] };
  for (let i = 0; i < 3; i++) add(`tav-stairs-${i}`, 1 + i, 0);
  add('furn-barrels', 5, 0, barrels);
  add('furn-barrels', 6, 0, barrels);
  add('mkt-crates', 7, 0, crate);
  add('tav-sacks', 8, 0, sack);
  add('tav-sacks', 9, 0, sack);
  add('furn-barrels', 13, 0, barrels);
  add('mkt-crates', 13, 1, crate);
  add('furn-barrels', 13, 4, barrels);
  add('tav-sacks', 13, 7, sack);
  add('mkt-crates', 12, 8, crate);
  add('furn-barrels', 0, 4, barrels);
  add('mkt-crates', 0, 5, crate);
  add('tav-sacks', 0, 8, sack);
  add('furn-barrels', 6, 8, barrels);
  add('mkt-crates', 7, 8, crate);
  add('furn-barrels', 7, 4, barrels);
  add('tav-sacks', 8, 4, sack);
  // Old Maud's brewing bench, Godric's grandmother's, along the back wall: where the hero brews (see systems/Crafting.ts).
  add('tav-brewbench', 10, 0, { w: 2 });
  data.lights!.push({ gx: 10.5, gy: 0.8, z: 30, radius: 90, flicker: 0.6 });

  const rats: CreatureSpawn[] = [
    [11.5, 2.6], [10.4, 3.4], [12.2, 3.6],
    [2.6, 6.5], [3.6, 7.4], [4.4, 6.2],
  ].map(([gx, gy], i) => ({ id: CELLAR_RATS[i], kind: 'rat', gx, gy }));
  data.creatures = rats;
  data.sights!.push(
    { id: 'cellar-keg', gx: 6.3, gy: 1.2, label: 'Look', z: 30, thought: "A keg gnawed clean through at the bottom. The floor round it is sticky with Godric's best ale. No wonder he's cross." },
    { id: 'cellar-hole', gx: 0.3, gy: 7.5, label: 'Look', z: 14, thought: 'A hole in the bottom of the wall, gnawed smooth by teeth. It goes back a long way. Something squeaks in there, then goes quiet.' },
    { id: 'cellar-bench', gx: 11, gy: 1.15, label: 'Brew at the bench', z: 52, station: 'cellar-bench' },
  );
  return data;
}
