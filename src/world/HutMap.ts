import { MapData, placeObject, Prop, Terrain } from './MapData';

export const HUT_ROOM_W = 7;
export const HUT_ROOM_H = 6;

/**
 * Inside Farmer Iran's hut: one cosy room with the hearth on the back wall,
 * his bed in the corner and the children's straw beds along the far side, a
 * table in the middle, and the door out on the left wall. His two children,
 * Pip and Hetty, are at home squabbling (see entities/Child.ts).
 */
export function buildHutMap(): MapData {
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < HUT_ROOM_H; y++) {
    terrain.push(new Array(HUT_ROOM_W).fill(Terrain.Floor));
    props.push(new Array(HUT_ROOM_W).fill(Prop.None));
  }

  const data: MapData = {
    width: HUT_ROOM_W,
    height: HUT_ROOM_H,
    terrain,
    props,
    spawn: { x: 1.2, y: 3.5 },
    indoor: true,
    music: 'home',
    walls: {
      back: ['plain-1', 'shelf-1', 'plain-0', 'plain-1', 'window-0', 'plain-0', 'window-1'].map((k) => `wall-back-${k}`),
      side: ['plain-0', 'window-1', 'plain-1', 'door-0', 'shelf-0', 'plain-0'].map((k) => `wall-side-${k}`),
    },
    doors: [{ tx: 0, ty: 3, to: 'world', entry: 'hut' }],
    entries: { door: { x: 1.2, y: 3.5 } },
    lights: [
      { gx: 3, gy: 0.9, z: 14, radius: 260, flicker: 1 },
      { gx: 3.4, gy: 2.5, z: 40, radius: 100, flicker: 0.35 },
    ],
    children: [
      { id: 'pip', gx: 3.2, gy: 4.6 },
      { id: 'hetty', gx: 5.1, gy: 3.3 },
    ],
    seats: [
      { name: 'hut-stool', gx: 1.5, gy: 2.5, faceX: 1, faceY: 0, standX: 1.5, standY: 3.5 },
      { name: 'hut-stool', gx: 4.5, gy: 2.5, faceX: -1, faceY: 0, standX: 4.5, standY: 3.5 },
    ],
  };

  const add = (key: string, tx: number, ty: number, w = 1, h = 1, extra: Partial<Parameters<typeof placeObject>[1]> = {}) =>
    placeObject(data, { key: `furn-${key}`, tx, ty, w, h, ...extra });

  add('doormat', 0, 3, 1, 1, { flat: true });
  add('rug', 2, 3, 3, 2, { flat: true });
  add('barrels', 0, 0);
  add('hearth', 2, 0, 2, 1, { anim: 'hearth-fire' });
  add('cupboard', 4, 0);
  add('bed', 6, 0, 1, 2);
  add('strawbed', 6, 2, 1, 2);
  add('strawbed', 6, 4, 1, 2);
  add('table', 2, 2, 2, 1);
  add('stool', 1, 2);
  add('stool', 4, 2);
  add('chest', 0, 5, 1, 1, { flipX: true });
  return data;
}
