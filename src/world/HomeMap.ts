import { MapData, placeObject, Prop, Terrain } from './MapData';

export const HOME_W = 8;
export const HOME_H = 7;

/**
 * The family cottage, inside. A single room: Mother's bed and the hearth along
 * the back wall, the table in the middle, the player's straw bed by the front,
 * and the door out to the village on the left wall.
 *
 * Wall art keys come from art/interior.ts; index 0..7 along each wall.
 */
export function buildHomeMap(): MapData {
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < HOME_H; y++) {
    terrain.push(new Array(HOME_W).fill(Terrain.Floor));
    props.push(new Array(HOME_W).fill(Prop.None));
  }

  const data: MapData = {
    width: HOME_W,
    height: HOME_H,
    terrain,
    props,
    spawn: { x: 6.5, y: 3.5 },
    indoor: true,
    walls: {
      back: ['plain-0', 'plain-1', 'window-0', 'plain-0', 'plain-1', 'shelf-0', 'plain-1', 'window-1'].map((k) => `wall-back-${k}`),
      side: ['plain-1', 'shelf-1', 'window-0', 'plain-0', 'plain-1', 'door-0', 'window-1'].map((k) => `wall-side-${k}`),
    },
    doors: [{ tx: 0, ty: 5, to: 'world', entry: 'cottage' }],
    entries: { door: { x: 1.2, y: 5.5 } },
    lights: [
      { gx: 4, gy: 0.9, z: 14, radius: 300, flicker: 1 },
      { gx: 4.6, gy: 3.3, z: 40, radius: 110, flicker: 0.35 },
      { gx: 0.6, gy: 0.6, z: 26, radius: 90, flicker: 0.35 },
    ],
    npcs: [{ id: 'mother', gx: 2.5, gy: 1.6 }],
  };

  const add = (key: string, tx: number, ty: number, w = 1, h = 1, extra: Partial<Parameters<typeof placeObject>[1]> = {}) =>
    placeObject(data, { key: `furn-${key}`, tx, ty, w, h, ...extra });

  add('rug', 2, 2, 3, 2, { flat: true });
  add('doormat', 0, 5, 1, 1, { flat: true });
  add('stool', 0, 0);
  add('bed', 1, 0, 1, 2);
  add('hearth', 3, 0, 2, 1, { anim: 'hearth-fire' });
  add('cupboard', 6, 0);
  add('barrels', 7, 0);
  add('table', 3, 3, 2, 1);
  add('stool', 2, 3);
  add('stool', 5, 3);
  add('stool', 4, 4);
  add('chest', 0, 3, 1, 1, { flipX: true });
  add('strawbed', 7, 4, 1, 2);
  return data;
}
