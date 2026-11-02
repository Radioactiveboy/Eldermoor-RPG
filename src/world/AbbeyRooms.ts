import { ABBEY_WALL_HEIGHT } from '../art/abbey';
import { box, circle } from './Collision';
import { AreaId, LightSource, MapData, MapObject, NpcSpawn, placeObject, Prop, Seat, Terrain } from './MapData';

/**
 * The rooms within Saint Elda's that the hero can go into, each off the
 * grounds (see AbbeyMap.ts): stone-flagged and stone-walled, lit by candles
 * and windows. The door out is in the left-hand wall.
 */
interface RoomSpec {
  area: AreaId;
  w: number;
  h: number;
  /** Row of the door in the left-hand wall. */
  door: number;
  /** What's in each tile of the back wall (along x) and the left-hand wall (along y); see art/abbey.ts. */
  back: string[];
  side: string[];
  lights: LightSource[];
  npcs?: NpcSpawn[];
  seats?: Seat[];
  /** The hearth's crackle and warmth (the refectory), not the hush of stone. */
  music?: 'monastery';
}

function room(spec: RoomSpec, furnish: (add: (key: string, tx: number, ty: number, extra?: Partial<MapObject>) => void, data: MapData) => void): MapData {
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < spec.h; y++) {
    terrain.push(new Array(spec.w).fill(Terrain.Stone));
    props.push(new Array(spec.w).fill(Prop.None));
  }
  const door = { x: 1.2, y: spec.door + 0.5 };
  const data: MapData = {
    width: spec.w,
    height: spec.h,
    terrain,
    props,
    spawn: door,
    indoor: true,
    music: 'monastery',
    walls: {
      back: spec.back.map((k) => `swall-back-${k}`),
      side: spec.side.map((k, i) => (i === spec.door ? 'swall-side-door-0' : `swall-side-${k}`)),
      corner: 'swall-corner',
      height: ABBEY_WALL_HEIGHT,
    },
    doors: [{ tx: 0, ty: spec.door, to: 'abbey', entry: spec.area, label: 'Go outside' }],
    entries: { door },
    lights: spec.lights,
    npcs: spec.npcs ?? [],
    seats: spec.seats ?? [],
    sights: [],
    beds: [],
  };
  furnish((key, tx, ty, extra = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra }), data);
  return data;
}

/**
 * The chapel of Saint Elda: pews either side of an aisle up to the altar
 * under the tall windows, candles burning, the Saint in her niche, and the
 * great book on its lectern. Prior Benedict is at his prayers.
 */
export function buildChapelMap(): MapData {
  return room(
    {
      area: 'chapel',
      w: 9,
      h: 11,
      door: 8,
      back: ['niche-0', 'stained-0', 'plain-1', 'stained-1', 'cross-0', 'stained-0', 'plain-0', 'stained-1', 'niche-1'],
      side: ['plain-0', 'stained-0', 'plain-1', 'niche-0', 'plain-0', 'stained-1', 'plain-1', 'plain-0', 'door', 'plain-1', 'plain-0'],
      lights: [
        { gx: 4.5, gy: 0.8, z: 40, radius: 180, flicker: 0.4 },
        { gx: 1.5, gy: 1.5, z: 50, radius: 120, flicker: 0.6 },
        { gx: 7.5, gy: 1.5, z: 50, radius: 120, flicker: 0.6 },
        { gx: 1.5, gy: 9.5, z: 50, radius: 110, flicker: 0.6 },
      ],
      npcs: [{ id: 'prior', gx: 4.5, gy: 2.9, looking: { x: 0, y: -1 } }],
    },
    (add, data) => {
      add('abbey-altar', 3, 0, { w: 2, h: 1 });
      add('abbey-candles', 1, 1, { shapes: [circle(0.5, 0.5, 0.2)] });
      add('abbey-candles', 7, 1, { shapes: [circle(0.5, 0.5, 0.2)] });
      add('abbey-lectern', 6, 2, { shapes: [circle(0.5, 0.5, 0.22)] });
      add('mon-shrine-1', 8, 4, { shapes: [box(0.15, 0.15, 0.85, 0.85)] });
      for (const y of [4, 6, 8]) {
        add('abbey-pew', 1, y, { w: 2, h: 1, shapes: [box(0.1, 0.3, 1, 0.75), box(1, 0.3, 1.9, 0.75)], blocks: [[0, 0], [1, 0]] });
        add('abbey-pew', 5, y, { w: 2, h: 1, shapes: [box(0.1, 0.3, 1, 0.75), box(1, 0.3, 1.9, 0.75)], blocks: [[0, 0], [1, 0]] });
        data.seats!.push(
          { name: 'pew', gx: 2, gy: y + 0.45, faceX: 0, faceY: -1, standX: 3.5, standY: y + 0.5 },
          { name: 'pew', gx: 6, gy: y + 0.45, faceX: 0, faceY: -1, standX: 4.5, standY: y + 0.5 },
        );
      }
      data.sights!.push({
        id: 'chapel-book', gx: 6.5, gy: 2.6, label: 'Read the book', z: 40,
        sign: { heading: 'The great book, open on the lectern', lines: ['"I was sick, and ye visited me."', '', 'Someone has marked the place', 'with a pressed moonpetal.'] },
      });
    },
  );
}

/**
 * The infirmary: beds along the back wall under the windows, a guest's bed
 * (where the hero may sleep, and so save), Brother Anselm's table of jars and
 * herbs, and Brother Leofric, mending after the wolves caught him on the road.
 */
export function buildInfirmaryMap(): MapData {
  return room(
    {
      area: 'infirmary',
      w: 10,
      h: 7,
      door: 4,
      back: ['herbs-0', 'plain-0', 'window-0', 'plain-1', 'window-1', 'plain-0', 'window-0', 'books-0', 'plain-1', 'herbs-1'],
      side: ['plain-0', 'herbs-0', 'plain-1', 'niche-0', 'door', 'plain-0', 'plain-1'],
      lights: [
        { gx: 3.5, gy: 0.7, z: 56, radius: 130, flicker: 0.5 },
        { gx: 7, gy: 4.5, z: 50, radius: 150, flicker: 0.6 },
      ],
      npcs: [{ id: 'leofric', gx: 3.5, gy: 2.5, looking: { x: 1, y: 0 } }],
    },
    (add, data) => {
      add('furn-bed', 2, 0, { h: 2 });
      add('furn-bed', 4, 0, { h: 2 });
      add('furn-bed', 6, 0, { h: 2 });
      add('furn-bed', 9, 0, { h: 2 });
      add('furn-stool', 3, 2);
      add('abbey-herbtable', 6, 5, { w: 2, h: 1 });
      add('abbey-candles', 9, 5, { shapes: [circle(0.5, 0.5, 0.2)] });
      add('furn-chest', 0, 0, { flipX: true });
      add('furn-cupboard', 8, 0);
      data.beds!.push({ id: 'abbey-guest', tx: 9, ty: 1, gx: 8.5, gy: 2.5 });
      data.sights!.push({
        id: 'infirmary-jars', gx: 7, gy: 5.2, label: 'Look', z: 36,
        thought: "Jars of dried herbs, each labelled in a tiny hand: feverfew, comfrey, self-heal, moonpetal. The moonpetal jar is empty.",
      });
    },
  );
}

/** The scriptorium: shelves of books, writing desks under the windows, and Brother Edmund at his copying. */
export function buildScriptoriumMap(): MapData {
  return room(
    {
      area: 'scriptorium',
      w: 8,
      h: 7,
      door: 4,
      back: ['books-0', 'books-1', 'window-0', 'plain-0', 'window-1', 'plain-1', 'books-0', 'books-1'],
      side: ['books-1', 'plain-0', 'window-0', 'plain-1', 'door', 'plain-0', 'books-0'],
      lights: [
        { gx: 3.5, gy: 1, z: 46, radius: 140, flicker: 0.5 },
        { gx: 6, gy: 4.5, z: 46, radius: 120, flicker: 0.5 },
      ],
      npcs: [{ id: 'scribe', gx: 3.5, gy: 3.5, looking: { x: 0, y: -1 } }],
    },
    (add, data) => {
      add('abbey-desk', 3, 2);
      add('furn-stool', 3, 3);
      add('abbey-desk', 5, 2);
      add('abbey-desk', 5, 4);
      add('abbey-bookcase', 6, 0, { w: 2, h: 1 });
      add('abbey-lectern', 1, 1, { shapes: [circle(0.5, 0.5, 0.22)] });
      add('abbey-candles', 7, 3, { shapes: [circle(0.5, 0.5, 0.2)] });
      add('furn-chest', 0, 6, { flipX: true });
      data.sights!.push({
        id: 'scriptorium-page', gx: 5.5, gy: 2.9, label: 'Read the page', z: 34,
        sign: {
          heading: 'A page, half copied',
          lines: [
            '"...and of the moon-petal: gathered at its flowering',
            'and steeped with the bark of the white willow,',
            'it breaketh the fever, and easeth the chest..."',
          ],
        },
      });
    },
  );
}

/** The refectory: the long table where the brothers eat in silence, and the kitchen hearth where Brother Hob rules. */
export function buildRefectoryMap(): MapData {
  return room(
    {
      area: 'refectory',
      w: 10,
      h: 7,
      door: 5,
      back: ['plain-0', 'window-0', 'plain-1', 'plain-0', 'plain-1', 'plain-0', 'window-1', 'plain-1', 'herbs-0', 'plain-0'],
      side: ['plain-0', 'window-0', 'board-0', 'cross-0', 'plain-0', 'door', 'plain-1'],
      lights: [
        { gx: 5, gy: 0.9, z: 14, radius: 260, flicker: 1 },
        { gx: 4, gy: 3.5, z: 40, radius: 120, flicker: 0.4 },
      ],
      npcs: [{ id: 'cook', gx: 7.5, gy: 1.5 }],
    },
    (add, data) => {
      add('furn-hearth', 4, 0, { w: 2, h: 1, anim: 'hearth-fire' });
      add('abbey-cauldron', 6, 0, { shapes: [circle(0.5, 0.5, 0.34)] });
      add('furn-cupboard', 8, 0);
      add('furn-barrels', 0, 0);
      add('furn-barrels', 9, 2);
      for (const x of [1, 3, 5, 7]) add('furn-table', x, 3, { w: 2, h: 1 });
      for (let x = 1; x <= 8; x++) {
        add('mkt-bench', x, 4, { shapes: [box(0.08, 0.35, 0.92, 0.7)] });
        if (x % 2 === 0) data.seats!.push({ name: 'refectory-bench', gx: x + 0.5, gy: 4.55, faceX: 0, faceY: -1, standX: x + 0.5, standY: 5.5 });
      }
      data.sights!.push({
        id: 'refectory-board', gx: 0.3, gy: 2.5, label: 'Read the board', z: 30,
        sign: { heading: 'Chalked on a board', lines: ['MONDAY: pottage', 'TUESDAY: pottage', 'WEDNESDAY: pottage (with leeks)', 'FRIDAY: carp', '', '(Underneath: "MORE LEEKS. -H.")'] },
      });
    },
  );
}
