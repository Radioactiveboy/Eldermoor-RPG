import { box, circle } from './Collision';
import { CreatureSpawn, MapData, MapObject, placeObject, Prop, Terrain } from './MapData';

export const WATCHTOWER_W = 7;
export const WATCHTOWER_H = 7;
/** The doorway out is in the left-hand wall, near the front (art/northwoods.ts draws it in that wall segment). */
const DOOR_ROW = 5;
/** How tall the walls stand at the back corner, in pixels (as art/northwoods.ts TOWER_WALL_HEIGHT draws them). */
const WALL_HEIGHT = 124;

/**
 * Inside the old watchtower in the north woods (see NorthWoodsMap.ts). The
 * top of the tower fell in long ago, so there's no roof: the walls stand
 * ragged against the sky, tallest at the back, and the daylight (and the
 * rain) falls straight in. The stair that wound up the inside of the wall
 * to the lookout has broken off five steps up. What the last watch left is
 * still here, gone grey with damp: their table with the logbook on it, a
 * rack of rusted spears, the ring of their fire, their chest (searchable,
 * once), and the days someone counted, scratched into the wall. Rooks nest
 * up on a ledge, and a pair of rats live in the heap of fallen stone.
 */
export function buildWatchtowerMap(): MapData {
  const W = WATCHTOWER_W;
  const H = WATCHTOWER_H;
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Stone));
    props.push(new Array(W).fill(Prop.None));
  }
  const door = { x: 1.2, y: DOOR_ROW + 0.5 };
  const creatures: CreatureSpawn[] = [
    // Nesting in the heap of fallen stone.
    { id: 'nwt-rat-0', kind: 'rat', gx: 5.2, gy: 4.6 },
    { id: 'nwt-rat-1', kind: 'rat', gx: 6.4, gy: 4.4 },
  ];
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: door,
    indoor: true,
    // Nothing has burned in here for years.
    cold: true,
    music: 'woods',
    walls: {
      back: Array.from({ length: W }, (_v, i) => `nwt-wall-back-${i}`),
      side: Array.from({ length: H }, (_v, i) => `nwt-wall-side-${i}`),
      corner: 'nwt-corner',
      height: WALL_HEIGHT,
    },
    doors: [{ tx: 0, ty: DOOR_ROW, to: 'northwoods', entry: 'watchtower', label: 'Climb back out' }],
    entries: { door },
    lights: [
      // Daylight falling in through the open top, and through the doorway and the arrow slits.
      { gx: 3.6, gy: 3.4, z: 170, radius: 330, flicker: 0, daylight: true },
      { gx: 0.3, gy: DOOR_ROW + 0.5, z: 30, radius: 120, flicker: 0, daylight: true },
      { gx: 1.5, gy: 0.2, z: 64, radius: 60, flicker: 0, daylight: true },
      { gx: 5.5, gy: 0.2, z: 64, radius: 60, flicker: 0, daylight: true },
      { gx: 0.2, gy: 2.5, z: 64, radius: 60, flicker: 0, daylight: true },
    ],
    creatures,
    landmarks: [{ gx: 4.5, gy: 1, name: 'The broken stair', range: 2 }],
    seats: [],
    sights: [
      {
        id: 'nwt-stair', gx: 4.6, gy: 1.1, label: 'Look up the stair', z: 52,
        thought: 'The stair wound up round the wall to the lookout once. Five steps, and then nothing but sky. I could not get up there now without wings.',
      },
      { id: 'nwt-chest', gx: 1.5, gy: 1.05, label: 'Search the chest', z: 22, loot: 'cache' },
      {
        id: 'nwt-logbook', gx: 1.7, gy: 3.55, label: 'Read the logbook', z: 30,
        sign: { style: 'book',
          heading: 'The watch log, swollen with damp',
          lines: [
            'Most of the pages have rotted together. A few near the end can still be read:',
            '"Fair. Nothing on the north road. Aldo has the cough again."',
            '"Lights in the trees to the north, three nights running. Low down, and moving. Not charcoal-burners."',
            '"Small grey men at the edge of the wood at dusk, watching us. When we lit the beacon they were gone."',
            '"Word from the lord: the north is quiet, the tower costs too much, we are to come down. So be it."',
            'The last page is blank but for a ring where a cup stood.',
          ],
        },
      },
      {
        id: 'nwt-tally', gx: 0.08, gy: 1.5, label: 'Look at the scratches', z: 44,
        thought: 'Tally marks, scratched into the stone in fives. Someone stood watch up here a long time, and counted every day of it.',
      },
      {
        id: 'nwt-rack', gx: 0.55, gy: 2.6, label: 'Look at the spears', z: 40,
        thought: 'The watch left their spears behind. The heads are rusted right through. They would snap at the first blow.',
      },
      {
        id: 'nwt-firering', gx: 3.5, gy: 4.55, label: 'Look at the fire', z: 12,
        thought: 'A ring of stones round old ash, cold for years. The rain has beaten it flat. They kept a fire in here, up under the lookout.',
      },
      {
        id: 'nwt-rooks', gx: 2.5, gy: 1.3, label: 'Look up', z: 16,
        thought: 'A rooks\' nest, wedged on a ledge high up the wall. The floor under it is white with their mess. They do not like me being here.',
      },
    ],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  const rubble = { shapes: [circle(0.5, 0.5, 0.44)] };
  add('nwt-rubble-1', 0, 0, rubble);
  add('nwt-chest', 1, 0, { shapes: [box(0.15, 0.18, 0.88, 0.78)] });
  add('nwt-rookmess', 2, 1, { flat: true });
  // The stair along the back wall, and the treads that fell from it.
  add('nwt-stair', 3, 0, { w: 3 });
  add('nwt-rubble-0', 6, 0, rubble);
  add('nwt-rack', 0, 2, { shapes: [box(0.1, 0.05, 0.4, 0.95)] });
  add('nwt-table', 1, 3, { w: 2, shapes: [box(0.05, 0.1, 1, 0.9), box(1, 0.1, 1.95, 0.9)] });
  add('nwt-firering', 3, 4, { shapes: [circle(0.5, 0.5, 0.38)] });
  // The great heap where the top of the wall came down, on the right.
  add('nwt-rubble-big', 5, 2, { w: 2, h: 2 });
  // A joist from the lookout floor, fallen across the flags: it can be stepped over.
  add('nwt-joist', 3, 5, { w: 2, blocks: [] });
  // Moss and grit over the floor where the rain gets in, and leaves blown in at the door.
  const scatter: Array<[string, number, number]> = [
    ['nwt-moss-0', 2, 2], ['nwt-moss-1', 4, 3], ['nwt-moss-2', 3, 2], ['nwt-moss-0', 5, 5], ['nwt-moss-1', 1, 5], ['nwt-moss-2', 6, 6],
    ['nwt-scatter-0', 4, 2], ['nwt-scatter-1', 2, 4], ['nwt-scatter-2', 4, 4], ['nwt-scatter-0', 5, 4], ['nwt-scatter-1', 3, 6], ['nwt-scatter-2', 6, 1],
    ['nw-leaves-0', 1, 5], ['nw-leaves-1', 1, 6], ['nw-leaves-2', 2, 5],
  ];
  for (const [key, tx, ty] of scatter) add(key, tx, ty, { flat: true });
  // Bracken grown up in the corners, out of the reach of feet.
  add('nw-fern-1', 0, 6, { flat: true });
  add('nw-fern-2', 6, 5, { flat: true, flipX: true });
  return data;
}
