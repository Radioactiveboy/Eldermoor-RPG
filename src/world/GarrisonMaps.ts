import { ABBEY_WALL_HEIGHT } from '../art/abbey';
import { PANEL_WALL_HEIGHT } from '../art/sizes';
import { box, circle } from './Collision';
import { MapData, MapObject, placeObject, Prop, Terrain } from './MapData';

/**
 * Inside the buildings on the lane at the south end of Adowvale (see
 * MarketMap.ts addGarrisonLane): the militia's garrison, the jail under it
 * (down through a trapdoor inside, or the hatch outside against the side
 * wall), and the Headman's residence.
 */

function emptyRoom(w: number, h: number, floor: Terrain): Pick<MapData, 'width' | 'height' | 'terrain' | 'props'> {
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < h; y++) {
    terrain.push(new Array(w).fill(floor));
    props.push(new Array(w).fill(Prop.None));
  }
  return { width: w, height: h, terrain, props };
}

const barrels = { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] };
const crate = { shapes: [box(0.1, 0.15, 0.95, 0.95)] };
const stool = { shapes: [circle(0.5, 0.5, 0.15)] };
/** A two-tile table by its legs, so there's room to edge round it. */
const table2 = { w: 2, shapes: [box(0.12, 0.12, 1, 0.88), box(1, 0.12, 1.88, 0.88)] };

/**
 * The garrison: one long guardroom of bare stone under a beamed ceiling. The
 * hearth on the back wall with the militia's spears racked beside it, their
 * shields and the duty roster on the wall, three straw bunks for whoever is
 * off watch, a trestle table with the remains of supper, and the sergeant's
 * writing table at the far end, where he keeps the watch book. The trapdoor
 * down to the jail is by his table. The door out to the lane is in the left-hand wall.
 */
export function buildGarrisonMap(): MapData {
  const W = 10;
  const H = 8;
  const door = { x: 1.2, y: 6.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Stone),
    spawn: door,
    indoor: true,
    music: 'market',
    walls: {
      back: ['plain-0', 'plain-1', 'plain-0', 'window-0', 'board-0', 'plain-1', 'plain-0', 'window-1', 'plain-1', 'niche-0'].map((k) => `swall-back-${k}`),
      side: ['plain-1', 'plain-0', 'window-0', 'plain-1', 'plain-0', 'plain-1', 'door-0', 'plain-0'].map((k) => `swall-side-${k}`),
      corner: 'swall-corner',
      height: ABBEY_WALL_HEIGHT,
    },
    doors: [
      { tx: 0, ty: 6, to: 'market', entry: 'garrison', label: 'Go outside' },
      { tx: 8, ty: 5, to: 'jail', entry: 'trapdoor', label: 'Go down to the cells', facing: 'front' },
    ],
    entries: { door, trapdoor: { x: 8.5, y: 6.3 } },
    landmarks: [{ gx: 8, gy: 2, name: "The sergeant's table", range: 2.5 }],
    lights: [
      { gx: 2, gy: 0.9, z: 14, radius: 260, flicker: 1 },
      { gx: 8.7, gy: 2.3, z: 34, radius: 120, flicker: 0.4 },
      { gx: 4.5, gy: 4.5, z: 60, radius: 110, flicker: 0.3 },
    ],
    // Sergeant Brannock at his table, day and night (he sleeps in his boots, these days).
    npcs: [{ id: 'sergeant', gx: 8, gy: 1.6, looking: { x: 0, y: 1 } }],
    seats: [],
    sights: [
      {
        id: 'garrison-roster', gx: 4.5, gy: 0.2, label: 'Read the roster', z: 66,
        sign: {
          heading: 'Chalked on the board',
          lines: [
            'GATE: Cooper\'s boys (both). Dusk till the bell.',
            'SQUARE: Garrick. Ned. Miller\'s Ned. (TWO NEDS: the tall one is Ned.)',
            'CELLS: Hamm.',
            'Spears to be OILED, not used for poking hens.',
            '— Brannock, Sgt.',
          ],
        },
      },
      {
        id: 'garrison-watchbook', gx: 8, gy: 2.6, label: 'Read the watch book', z: 30,
        thought:
          'The watch book, in the sergeant\'s square hand. "Quiet." "Quiet." "Geese loose on the green, three taken up." ' +
          '"Wolves heard on the Hollow road." Page after page of a village where nothing much ever happens.',
      },
    ],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  add('furn-hearth', 1, 0, { w: 2, anim: 'hearth-fire' });
  add('gar-rack', 3, 0, { shapes: [box(0.1, 0.05, 0.9, 0.3)] });
  add('gar-shields', 5, 0, { flat: false, blocks: [] });
  add('furn-chest', 6, 0, { shapes: [box(0.1, 0.15, 0.9, 0.75)] });
  add('furn-barrels', 9, 0, barrels);
  // The sergeant's writing table, with his stool behind it.
  add('gar-desk', 7, 2, table2);
  // The bunks along the side wall, end to end.
  add('furn-strawbed', 0, 1, { h: 2 });
  add('furn-strawbed', 0, 3, { h: 2 });
  // The trestle table, with stools either side and a bench of supper things.
  add('furn-table', 3, 3, table2);
  add('furn-stool', 3, 2, stool);
  add('furn-stool', 4, 4, stool);
  add('furn-stool', 2, 3, stool);
  add('tav-trapdoor', 8, 5, { flat: true });
  add('mkt-crates', 9, 1, crate);
  add('furn-doormat', 0, 6, { flat: true });
  data.seats!.push(
    { name: 'garrison-stool', gx: 3.5, gy: 2.45, faceX: 0, faceY: 1, standX: 3.5, standY: 1.6 },
    { name: 'garrison-stool', gx: 4.5, gy: 4.5, faceX: 0, faceY: -1, standX: 4.5, standY: 5.4 },
    { name: 'garrison-stool', gx: 2.5, gy: 3.5, faceX: 1, faceY: 0, standX: 1.6, standY: 3.5 },
  );
  return data;
}

/**
 * The jail under the garrison: a low stone vault with three cells along the
 * back, barred across the front and between. Steps climb the back wall at
 * each end: on the left up to the trapdoor in the guardroom, on the right up
 * to the hatch out in the lane. Hamm keeps the keys at a little table by the
 * steps; Wat the poacher is in the middle cell, and the end one has had a goose in it.
 */
export function buildJailMap(): MapData {
  const W = 16;
  const H = 8;
  const foot = { x: 1.5, y: 1.7 };
  const hatchFoot = { x: 13.5, y: 1.7 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Stone),
    spawn: foot,
    indoor: true,
    underground: true,
    music: 'cave',
    walls: {
      back: Array.from({ length: W }, (_v, i) => `swall-back-${i === 4 ? 'niche-0' : `plain-${i % 2}`}`),
      side: Array.from({ length: H }, (_v, i) => `swall-side-plain-${(i + 1) % 2}`),
      corner: 'swall-corner',
      height: ABBEY_WALL_HEIGHT,
    },
    doors: [
      { tx: 1, ty: 1, to: 'garrison', entry: 'trapdoor', label: 'Go up to the guardroom', facing: 'back' },
      { tx: 13, ty: 1, to: 'market', entry: 'hatch', label: 'Go up through the hatch', facing: 'back' },
    ],
    entries: { trapdoor: foot, hatch: hatchFoot },
    lights: [
      { gx: 1.5, gy: 1.2, z: 70, radius: 140, flicker: 0.5 },
      { gx: 13.5, gy: 1.2, z: 70, radius: 120, flicker: 0.5 },
      { gx: 3.6, gy: 4.6, z: 36, radius: 130, flicker: 0.7 },
      { gx: 8, gy: 3.4, z: 80, radius: 120, flicker: 0.4 },
    ],
    npcs: [
      { id: 'jailer', gx: 4.6, gy: 4.5, looking: { x: 1, y: -1 } },
      { id: 'prisoner', gx: 7.55, gy: 1.75, looking: { x: 0, y: 1 } },
    ],
    seats: [],
    sights: [
      {
        id: 'jail-goose', gx: 10.5, gy: 3.1, label: 'Look into the cell', z: 30,
        thought:
          'An empty cell, white feathers all over the straw, and chalked on the wall: "GOOSE. 3 DAYS. FOR BITING A MILITIAMAN." ' +
          'Underneath, in another hand: "HE STARTED IT."',
      },
      {
        id: 'jail-tally', gx: 6, gy: 3.1, label: 'Look into the cell', z: 30,
        thought: 'Scratched into the stone at the back of the cell, rows and rows of tally marks, and a crude little drawing of a hare. Somebody had a long time to think in here.',
      },
      {
        id: 'jail-keys', gx: 2.5, gy: 4.3, label: 'Look at the keys', z: 24,
        thought: "A great iron ring of keys on the table by Hamm's elbow, and Hamm's elbow very firmly on it.",
      },
    ],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  for (let i = 0; i < 3; i++) add(`tav-stairs-${i}`, 1 + i, 0);
  for (let i = 0; i < 3; i++) add(`tav-stairs-${i}`, 13 + i, 0);
  // The cells: x 5-6, 7-8 and 9-10, three tiles deep, barred between and across the front (y = 3).
  for (let x = 5; x <= 11; x += 2) for (let y = 0; y < 3; y++) add('gar-bars', x, y, { flipX: true, blocks: [], shapes: [box(0, 0, 0.08, 1)] });
  for (let x = 5; x <= 10; x++) add(x % 2 === 0 ? 'gar-bars-door' : 'gar-bars', x, 3, { shapes: [box(0, 0, 1, 0.08)] });
  // Straw on the floor of each, and a bucket and a jug.
  for (const x of [5, 7, 9]) add('furn-strawbed', x, 0, { h: 2 });
  add('gar-cellbits', 6, 1, { blocks: [] });
  add('gar-cellbits', 8, 2, { blocks: [] });
  // Hamm's table and stool by the steps, with a lantern on it.
  add('furn-table', 2, 4, table2);
  add('furn-stool', 3, 5, stool);
  add('furn-barrels', 0, 6, barrels);
  add('mkt-crates', 0, 7, crate);
  add('furn-barrels', 15, 6, barrels);
  add('tav-sacks', 15, 4, { shapes: [circle(0.32, 0.35, 0.26), circle(0.68, 0.62, 0.27)] });
  return data;
}

/**
 * The Headman's residence: one great hall, oak-panelled under a plaster
 * frieze hung with portraits of the Headmen before him and a harvest
 * tapestry. The hearth is on the back wall with the long table before it;
 * the Headman's writing desk and his books are at the far end, where he
 * receives callers; the kitchen end is by the front, where Marjory cooks. The
 * front door is in the left-hand wall, where Aldwin the steward meets visitors.
 * Elsie the maid is forever tidying.
 */
export function buildResidenceMap(): MapData {
  const W = 14;
  const H = 11;
  const door = { x: 1.2, y: 9.5 };
  const back = ['plain-0', 'plain-1', 'plain-0', 'sconce-0', 'plain-1', 'plain-0', 'portrait-0', 'tapestry-0', 'portrait-1', 'plain-0', 'plain-1', 'sconce-1', 'plain-0', 'plain-1'];
  const side = ['plain-0', 'portrait-1', 'plain-1', 'window-0', 'plain-0', 'sconce-0', 'plain-1', 'window-1', 'plain-0', 'door-0', 'plain-1'];
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: door,
    indoor: true,
    music: 'home',
    walls: {
      back: back.map((k) => `pwall-back-${k}`),
      side: side.map((k) => `pwall-side-${k}`),
      corner: 'pwall-corner',
      height: PANEL_WALL_HEIGHT,
    },
    doors: [{ tx: 0, ty: 9, to: 'market', entry: 'residence', label: 'Go outside' }],
    entries: { door },
    landmarks: [
      { gx: 11, gy: 2, name: "The Headman's desk", range: 3 },
      { gx: 11.5, gy: 8.5, name: 'The kitchen', range: 2.5 },
    ],
    lights: [
      { gx: 5, gy: 0.9, z: 14, radius: 300, flicker: 1 },
      { gx: 3.5, gy: 0.2, z: 64, radius: 90, flicker: 0.5 },
      { gx: 11.5, gy: 0.2, z: 64, radius: 90, flicker: 0.5 },
      { gx: 0.2, gy: 5.5, z: 64, radius: 90, flicker: 0.5 },
      { gx: 5, gy: 4.5, z: 44, radius: 130, flicker: 0.6 },
      { gx: 10.5, gy: 2.6, z: 34, radius: 110, flicker: 0.5 },
      { gx: 13.5, gy: 7.5, z: 24, radius: 150, flicker: 0.6 },
    ],
    npcs: [
      // The Headman at his desk from first light till late; his household about him.
      { id: 'headman', gx: 11, gy: 1.55, looking: { x: 0, y: 1 }, hours: [7, 22] },
      { id: 'steward', gx: 2.5, gy: 8.5, looking: { x: -1, y: 1 }, hours: [6, 23] },
      { id: 'housemaid', gx: 7.5, gy: 6.5, hours: [6, 22] },
      { id: 'housecook', gx: 11.5, gy: 9.5, hours: [5, 21] },
    ],
    seats: [],
    sights: [
      {
        id: 'residence-portraits', gx: 6.5, gy: 0.2, label: 'Look at the portrait', z: 70,
        thought:
          'A stern old man in black, with the same chain round his neck that the Headman wears. A brass plate on the frame: ' +
          '"Headman Godwin Hale. He kept the bridge." Whatever that means, he looks very pleased about it.',
      },
      {
        id: 'residence-tapestry', gx: 7.5, gy: 0.2, label: 'Look at the tapestry', z: 70,
        thought: 'A harvest in Adowvale, stitched in wool: sheaves standing in the fields, the church tower, and a tiny cottage in the Hollow with smoke going up from its chimney. I look at that one for a long time.',
      },
      {
        id: 'residence-armour', gx: 1.5, gy: 6.5, label: 'Look at the armour', z: 60,
        thought: 'Old mail, a great helm and a kite shield in green and gold, polished till they shine. Nobody has worn them in a hundred years. Elsie dusts them every morning, she says, "in case."',
      },
    ],
    chores: [
      { x: 4.5, y: 5.5, face: { x: 0, y: -1 } },
      { x: 7.5, y: 2.6, face: { x: 0, y: -1 } },
      { x: 2.5, y: 2.5, face: { x: 0, y: -1 } },
      { x: 9.5, y: 5.5, face: { x: 1, y: 0 } },
      { x: 3.5, y: 6.6, face: { x: -1, y: 0 } },
      { x: 6.5, y: 8.5, face: { x: 0, y: 1 } },
    ],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  // The hall: the hearth on the back wall, a rug before it, and the long table down the middle.
  add('abbey-bookcase', 0, 0, { w: 2 });
  add('res-dresser', 2, 0, { shapes: [box(0.05, 0.1, 0.95, 0.6)] });
  add('furn-hearth', 4, 0, { w: 2, anim: 'hearth-fire' });
  add('furn-rug', 3, 2, { w: 4, h: 3, flat: true });
  add('res-table', 3, 4, { w: 3, shapes: [box(0.15, 0.12, 1, 0.9), box(1, 0.12, 2, 0.9), box(2, 0.12, 2.9, 0.9)] });
  for (let x = 3; x < 6; x++) add('res-chair', x, 3, { shapes: [box(0.2, 0.2, 0.8, 0.8)] });
  add('res-chair-grand', 2, 4, { flipX: true, shapes: [box(0.2, 0.2, 0.8, 0.8)] });
  // The Headman's end: his desk and chair, his books, the village's charter chest.
  add('abbey-bookcase', 9, 0, { w: 2 });
  add('abbey-bookcase', 12, 0, { w: 2 });
  add('res-chair-grand', 11, 1, { blocks: [], shapes: [] });
  add('res-desk', 10, 2, table2);
  add('furn-chest', 13, 2, { flipX: true, shapes: [box(0.15, 0.1, 0.75, 0.9)] });
  // By the door: the old armour, and a seat for callers kept waiting.
  add('res-armour', 0, 6, { shapes: [circle(0.5, 0.5, 0.3)] });
  add('furn-doormat', 0, 9, { flat: true });
  add('mkt-bench', 0, 7, { flipX: true, shapes: [box(0.35, 0.08, 0.7, 0.92)] });
  data.seats!.push({ name: 'residence-hall-bench', gx: 0.55, gy: 7.5, faceX: 1, faceY: 0, standX: 1.5, standY: 7.5 });
  // The kitchen end, out from the side: a second fire for the pots, a work table, stores.
  add('abbey-cauldron', 13, 7, { shapes: [circle(0.5, 0.5, 0.34)] });
  add('furn-table', 11, 7, table2);
  add('furn-barrels', 13, 9, barrels);
  add('mkt-sacks', 13, 10, { shapes: [circle(0.45, 0.4, 0.3), circle(0.45, 0.7, 0.18)] });
  add('mkt-crates', 12, 10, crate);
  return data;
}
