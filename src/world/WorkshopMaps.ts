import { ABBEY_WALL_HEIGHT } from '../art/abbey';
import { box, circle } from './Collision';
import { MapData, MapObject, placeObject, Prop, Terrain } from './MapData';

/**
 * Inside the two workshops on the north side of Adowvale's square (see
 * MarketMap.ts): Osric's smithy and Hilde's bakery. Each keeper is there while
 * their round has them at work (systems/VillageDay.ts: before the market
 * opens, a spell in the middle of the day, and after it shuts), and can be
 * traded with there as at their stall. The rest of the day the forge is banked
 * and the oven left to cool, and the room is empty.
 */

const W = 8;
const H = 7;
/** Both doors are in the left-hand wall, near the front. */
const DOOR_ROW = 5;
const door = { x: 1.2, y: DOOR_ROW + 0.5 };

function emptyRoom(floor: Terrain): Pick<MapData, 'width' | 'height' | 'terrain' | 'props'> {
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(floor));
    props.push(new Array(W).fill(Prop.None));
  }
  return { width: W, height: H, terrain, props };
}

/**
 * Osric's smithy: flagged floor and bare stone walls, the forge against the
 * back wall with its bellows beside it and the coal heaped in the corner, the
 * anvil on its stump in front of it with the quench tub to hand, tools on the
 * wall, a rack of finished iron, a grindstone, and his order slate. He works
 * behind the anvil with the forge at his back, facing the room.
 */
export function buildSmithyMap(): MapData {
  const data: MapData = {
    ...emptyRoom(Terrain.Stone),
    spawn: door,
    indoor: true,
    music: 'market',
    walls: {
      back: ['plain-0', 'plain-1', 'plain-0', 'plain-1', 'window-0', 'plain-0', 'plain-1', 'board-0'].map((k) => `swall-back-${k}`),
      side: ['plain-1', 'window-0', 'plain-0', 'plain-1', 'plain-0', 'door-0', 'plain-1'].map((k) => `swall-side-${k}`),
      corner: 'swall-corner',
      height: ABBEY_WALL_HEIGHT,
    },
    doors: [{ tx: 0, ty: DOOR_ROW, to: 'market', entry: 'smithy', label: 'Go outside' }],
    entries: { door },
    landmarks: [{ gx: 3, gy: 1, name: 'The forge', range: 2.5 }],
    // The forge's glow fills the room; the anvil catches it.
    lights: [
      { gx: 3, gy: 0.7, z: 30, radius: 330, flicker: 1 },
      { gx: 3.5, gy: 3.3, z: 20, radius: 110, flicker: 0.7 },
      { gx: 6.5, gy: 5.5, z: 60, radius: 120, flicker: 0.3 },
    ],
    npcs: [{ id: 'smith', gx: 3.5, gy: 2.88, looking: { x: 0, y: 1 }, keeps: 'workshop' }],
    seats: [],
    sights: [
      {
        id: 'smithy-slate', gx: 7.5, gy: 0.4, label: 'Read the slate', z: 56,
        sign: {
          heading: 'Chalked on the slate',
          lines: [
            'REEVE: 12 spearheads for the militia. WANTED YESTERDAY',
            'Iran: ploughshare mended. Paid (in eggs)',
            'Godric: new hoops for the kegs',
            'Lord Morten\'s men: hinges for the toll booth',
            '(Rubbed out, and chalked again, harder: NO MORE SWORDS ON TICK)',
          ],
        },
      },
    ],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  add('wsh-coal', 0, 0, { shapes: [circle(0.5, 0.5, 0.42)] });
  add('wsh-forge', 2, 0, { w: 2, anim: 'wsh-forge-fire' });
  add('wsh-bellows', 4, 0, { shapes: [box(0.1, 0.1, 0.9, 0.8)] });
  add('wsh-toolrack', 5, 0, { shapes: [box(0, 0, 1, 0.2)] });
  add('wsh-ironrack', 6, 0, { shapes: [box(0.05, 0.05, 0.95, 0.55)] });
  add('furn-barrels', 7, 1, { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  add('wsh-anvil', 3, 3, { shapes: [circle(0.5, 0.32, 0.28)] });
  add('wsh-quench', 4, 3, { shapes: [circle(0.5, 0.5, 0.35)] });
  add('wsh-grindstone', 6, 4, { shapes: [box(0.12, 0.2, 0.88, 0.75)] });
  add('mkt-crates', 7, 5, { shapes: [box(0.1, 0.15, 0.95, 0.95)] });
  add('furn-doormat', 0, DOOR_ROW, { flat: true });
  return data;
}

/**
 * Hilde's bakery: boards underfoot and limewashed walls, the domed bread oven
 * against the back wall with its woodpile, racks of loaves cooling beside it,
 * flour sacks in the corner, the kneading trough in the middle of the floor
 * (Hilde works it from behind, facing the room), and a counter of the day's
 * bread by the door.
 */
export function buildBakeryMap(): MapData {
  const data: MapData = {
    ...emptyRoom(Terrain.Floor),
    spawn: door,
    indoor: true,
    music: 'market',
    walls: {
      back: ['shelf-0', 'plain-1', 'plain-0', 'plain-1', 'window-0', 'plain-0', 'plain-1', 'window-1'].map((k) => `wall-back-${k}`),
      side: ['plain-0', 'window-0', 'plain-1', 'shelf-1', 'plain-0', 'door-0', 'plain-1'].map((k) => `wall-side-${k}`),
    },
    doors: [{ tx: 0, ty: DOOR_ROW, to: 'market', entry: 'bakery', label: 'Go outside' }],
    entries: { door },
    landmarks: [{ gx: 3, gy: 1, name: 'The bread oven', range: 2.5 }],
    lights: [
      { gx: 3, gy: 1, z: 22, radius: 280, flicker: 0.9 },
      { gx: 4, gy: 3.5, z: 50, radius: 130, flicker: 0.3 },
      { gx: 6.5, gy: 5.5, z: 50, radius: 120, flicker: 0.3 },
    ],
    npcs: [{ id: 'baker', gx: 4, gy: 2.45, looking: { x: 0, y: 1 }, keeps: 'workshop' }],
    seats: [],
    sights: [],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  const sacks = [circle(0.45, 0.4, 0.3), circle(0.45, 0.7, 0.18)];
  add('mkt-sacks', 0, 0, { shapes: sacks });
  add('mkt-sacks', 1, 0, { shapes: sacks });
  add('mkt-sacks', 0, 1, { shapes: sacks });
  add('wsh-oven', 2, 0, { w: 2, anim: 'wsh-oven-fire' });
  add('wsh-woodpile', 4, 0, { shapes: [box(0.1, 0.1, 0.9, 0.8)] });
  add('wsh-breadrack-0', 6, 0, { shapes: [box(0.05, 0, 0.95, 0.5)] });
  add('wsh-breadrack-1', 7, 0, { shapes: [box(0.05, 0, 0.95, 0.5)] });
  add('wsh-trough', 3, 3, { w: 2, shapes: [box(0.04, 0.06, 1, 0.94), box(1, 0.06, 1.96, 0.94)] });
  add('furn-barrels', 7, 2, { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  add('wsh-counter', 6, 5, { shapes: [box(0.08, 0.05, 0.92, 0.95)] });
  add('mkt-crates', 7, 5, { shapes: [box(0.1, 0.15, 0.95, 0.95)] });
  add('furn-doormat', 0, DOOR_ROW, { flat: true });
  return data;
}
