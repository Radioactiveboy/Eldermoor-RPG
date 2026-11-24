import { box, circle } from './Collision';
import { MapData, MapObject, NpcSpawn, placeObject, Prop, Sight, Terrain } from './MapData';

export const BEACON_HALL_W = 9;
export const BEACON_HALL_H = 9;
/** The doorway out is in the left-hand wall, near the front (art/beacon.ts draws it in that wall segment). */
const DOOR_ROW = 7;
/** How tall the walls stand at the back corner, in pixels (as art/beacon.ts HALL_WALL_HEIGHT draws them). */
const HALL_WALL_HEIGHT = 150;
/** How tall the battlements stand round the roof (as art/beacon.ts ROOF_WALL_HEIGHT draws them). */
const ROOF_WALL_HEIGHT = 46;
export const BEACON_TOP_W = 7;
export const BEACON_TOP_H = 7;

/** Who holds the tower: the brigands (still, or as its keepers now), or nobody. */
export type BeaconHolders = 'brigands' | 'keepers' | 'empty';

/** Where the four brigands stand about the hall, and which way they look. */
export const BRIGAND_POSTS: Array<NpcSpawn & { looking: { x: number; y: number } }> = [
  // Corwin by the warden's desk, where he can see the door.
  { id: 'corwin', gx: 2.4, gy: 1.75, looking: { x: -1, y: 1 } },
  // Garth on a stool by the fire.
  { id: 'garth', gx: 5.45, gy: 3.7, looking: { x: -1, y: 1 } },
  // Teg leaning by the loot, near the door.
  { id: 'teg', gx: 5.7, gy: 6.4, looking: { x: -1, y: 0 } },
  // Wren at the foot of the stair, bow in hand.
  { id: 'wren', gx: 6.6, gy: 1.6, looking: { x: -1, y: 1 } },
];

/**
 * Inside the old beacon on Corbie Tor (see PlainsMap.ts): the round tower's
 * ground floor, squared off to a hall, where the watch kept their stores and
 * slept. A stair climbs the back wall to a hatch and the roof; the hoist that
 * hauled fuel up for the brazier still stands beside it. Corwin Haske's band
 * hold it now: their bedrolls round the fire, their table (a door on two
 * barrels), what they have taken off the road stacked by the door, Lord
 * Morten's mark on the crates. Once they have gone the fire is out and the
 * place is cold, and the warden's strongbox can be opened.
 */
export function buildBeaconMap(holders: BeaconHolders = 'brigands'): MapData {
  const W = BEACON_HALL_W;
  const H = BEACON_HALL_H;
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Stone));
    props.push(new Array(W).fill(Prop.None));
  }
  const door = { x: 1.2, y: DOOR_ROW + 0.5 };
  const lit = holders !== 'empty';
  const sights: Sight[] = [
    {
      id: 'bcn-book', gx: 1.9, gy: 0.95, label: "Read the warden's book", z: 34,
      sign: {
        heading: 'The beacon book of Corbie Tor',
        lines: [
          'A great ledger, the watch kept in it every night the beacon was tended. The last pages are in a strong, square hand:',
          '"Fair. Clear to the Greyfells. Fire laid, not lit. C.H."',
          '"Wind north-east. Saw the Stonebrook light answer the Harrowford light at the trial. All five beacons good. C.H."',
          '"Word from Lord Morten: the watch is to be stood down, there being no need. No pay after Lammas. C.H."',
          '"Fire laid, not lit. Nobody to light it for. Going down to the village. God keep the tower. C.H."',
          lit
            ? 'Under that, newer, the same hand gone shaky: a tally of what was taken off the road, and who it was shared out to.'
            : 'Under that, newer, the same hand gone shaky: a tally of what was taken off the road. It stops halfway down a page.',
        ],
      },
    },
    {
      id: 'bcn-chart', gx: 2.5, gy: 0.1, label: 'Look at the chart', z: 86,
      thought:
        'Scratched into the stone and rubbed with soot: the line of the fells, and five beacons strung down from them to Adowvale, ' +
        'joined by lines. This is the second one down. Light this, and the next sees it, and the next, and the village has an hour to bar its doors.',
    },
    {
      id: 'bcn-banner', gx: 0.1, gy: 1.5, label: 'Look at the banner', z: 86,
      thought: 'Blue, with a gold flame on it, the hem gone to threads. The colours of the old beacon watch. Somebody has kept the moth out of it.',
    },
    {
      id: 'bcn-loot', gx: 7.8, gy: 7.2, label: 'Look at the crates', z: 40,
      thought: lit && holders === 'brigands'
        ? "Crates and sacks, stacked up by the door. One is stencilled with Lord Morten's mark, a black tower in a ring. Off the road, then."
        : "Crates and sacks, stacked up by the door. One is stencilled with Lord Morten's mark: a black tower in a ring.",
    },
    {
      id: 'bcn-hoist', gx: 3.5, gy: 0.9, label: 'Look at the hoist', z: 40,
      thought: 'A winch, its rope running up into the dark to the roof. They hauled the fuel up with this, a basket at a time. The rope is new.',
    },
  ];
  // With the band gone, their captain's strongbox is there to be opened.
  if (!lit) sights.push({ id: 'bcn-strongbox', gx: 0.5, gy: 0.75, label: 'Open the strongbox', z: 22, loot: 'cache' });
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: door,
    indoor: true,
    cold: !lit,
    music: 'woods',
    walls: {
      back: Array.from({ length: W }, (_v, i) => `bcn-wall-back-${i}`),
      side: Array.from({ length: H }, (_v, i) => `bcn-wall-side-${i}`),
      corner: 'bcn-corner',
      height: HALL_WALL_HEIGHT,
    },
    doors: [
      { tx: 0, ty: DOOR_ROW, to: 'plains', entry: 'beacon', label: 'Go outside' },
      { tx: 5, ty: 1, to: 'beacon-top', entry: 'hatch', label: 'Climb to the roof', facing: 'back' },
    ],
    entries: { door, stair: { x: 5.5, y: 1.7 } },
    lights: [
      // Daylight down the stair from the hatch, and in at the door and the arrow slits.
      { gx: 7.5, gy: 0.4, z: 140, radius: 150, flicker: 0, daylight: true },
      { gx: 0.3, gy: DOOR_ROW + 0.5, z: 30, radius: 130, flicker: 0, daylight: true },
      { gx: 5.5, gy: 0.2, z: 82, radius: 60, flicker: 0, daylight: true },
      { gx: 0.2, gy: 2.5, z: 82, radius: 60, flicker: 0, daylight: true },
      { gx: 0.2, gy: 6.5, z: 82, radius: 60, flicker: 0, daylight: true },
      ...(lit
        ? [
            // The fire in the middle of the floor, and the torches in their brackets.
            { gx: 4.5, gy: 4.5, z: 14, radius: 300, flicker: 1 },
            { gx: 4.5, gy: 0.15, z: 96, radius: 130, flicker: 1 },
            { gx: 0.15, gy: 4.5, z: 96, radius: 130, flicker: 1 },
          ]
        : []),
    ],
    npcs: holders === 'empty' ? [] : BRIGAND_POSTS.map((p) => ({ ...p })),
    landmarks: [{ gx: 4.5, gy: 4.5, name: 'The beacon hall', range: 9 }],
    seats: [],
    sights,
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  // Along the back wall: the warden's strongbox and desk, the hoist, a cask, and the stair up to the hatch.
  add('bcn-strongbox', 0, 0, { shapes: [box(0.15, 0.2, 0.88, 0.75)] });
  add('bcn-desk', 1, 0, { w: 2, shapes: [box(0.05, 0.1, 1, 0.85), box(1, 0.1, 1.92, 0.85)] });
  add('bcn-hoist', 3, 0, { shapes: [box(0.05, 0.05, 0.95, 0.95)] });
  add('bcn-cask', 4, 0, { shapes: [box(0.1, 0.15, 0.9, 0.85)] });
  add('bcn-stair', 5, 0, { w: 3 });
  // The watch's weapon rack against the side wall.
  add('bcn-rack', 0, 2, { h: 2, shapes: [box(0.1, 0.05, 0.6, 1), box(0.1, 1, 0.6, 1.95)] });
  // The fire in the middle of the floor, while there's anyone here to keep it.
  add('bcn-firestones', 4, 4, { flat: true });
  if (lit) add('fire-small', 4, 4, { anim: 'fire-small-burn', shapes: [circle(0.5, 0.5, 0.36)] });
  else add('nwt-firering', 4, 4, { shapes: [circle(0.5, 0.5, 0.36)] });
  // Their bedrolls round it (stepped over, not round), their table and stools, and the loot by the door.
  add('bcn-bedroll-0', 7, 2, { h: 2, blocks: [] });
  add('bcn-bedroll-1', 7, 4, { h: 2, blocks: [] });
  add('bcn-bedroll-2', 1, 4, { h: 2, blocks: [] });
  add('bcn-bedroll-3', 5, 7, { h: 2, blocks: [] });
  add('bcn-table', 2, 6, { w: 2, shapes: [box(0.05, 0.1, 1, 0.92), box(1, 0.1, 1.95, 0.92)] });
  add('bcn-stool', 2, 7, { shapes: [circle(0.5, 0.5, 0.2)] });
  add('bcn-stool', 4, 6, { shapes: [circle(0.5, 0.5, 0.2)] });
  add('bcn-stool', 5, 3, { shapes: [circle(0.5, 0.5, 0.2)] });
  add('bcn-loot', 7, 7, { w: 2, h: 2 });
  // Grit and straw over the flags, and leaves blown in at the door.
  const scatter: Array<[string, number, number]> = [
    ['nwt-scatter-0', 3, 2], ['nwt-scatter-1', 6, 5], ['nwt-scatter-2', 2, 3], ['nwt-scatter-0', 6, 2], ['nwt-scatter-1', 3, 7],
    ['nw-leaves-0', 1, 7], ['nw-leaves-1', 1, 8], ['nw-leaves-2', 2, 8],
  ];
  for (const [key, tx, ty] of scatter) add(key, tx, ty, { flat: true });
  return data;
}

/**
 * The roof of the beacon: flagstones inside the battlements, the brazier on
 * its dais in the middle, piled with charred wood never lit since the watch
 * was stood down, fuel stacked under oiled cloth, a cask of pitch, and the
 * warden's horn on its post by the hatch. All round is the sky (painted
 * behind it by scenes/game/beacon.ts): the Greyfells to the north, where the
 * goblins came from, and the plains running away south to Adowvale.
 */
export function buildBeaconTopMap(): MapData {
  const W = BEACON_TOP_W;
  const H = BEACON_TOP_H;
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Stone));
    props.push(new Array(W).fill(Prop.None));
  }
  const hatch = { x: 2.4, y: 5.4 };
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: hatch,
    indoor: true,
    cold: true,
    music: 'world',
    walls: {
      back: Array.from({ length: W }, (_v, i) => `bct-wall-back-${i}`),
      side: Array.from({ length: H }, (_v, i) => `bct-wall-side-${i}`),
      corner: 'bct-corner',
      height: ROOF_WALL_HEIGHT,
    },
    doors: [{ tx: 1, ty: 5, to: 'beacon', entry: 'stair', label: 'Climb back down', facing: 'front' }],
    entries: { hatch },
    lights: [
      // Out under the sky: the whole roof is in the daylight.
      { gx: 3.5, gy: 3.5, z: 220, radius: 520, flicker: 0, daylight: true },
      { gx: 1, gy: 5.5, z: 120, radius: 260, flicker: 0, daylight: true },
      { gx: 5.5, gy: 1, z: 120, radius: 260, flicker: 0, daylight: true },
    ],
    landmarks: [{ gx: 3.5, gy: 3.5, name: 'The top of the beacon', range: 8 }],
    seats: [],
    sights: [
      { id: 'bct-brazier', gx: 3.5, gy: 4.55, label: 'Look over the brazier', z: 64 },
      {
        id: 'bct-north', gx: 3.5, gy: 0.35, label: 'Look north', z: 40,
        thought:
          'The Greyfells, grey on grey, and somewhere under them the hole the goblins came out of. From up here you would see a war band ' +
          'coming down off the moor an hour before it reached the woods. That is what this tower was for.',
      },
      {
        id: 'bct-south', gx: 5.7, gy: 3.5, label: 'Look out over the plains', z: 30,
        thought:
          'The whole of the plains, laid out like a cloth: the road, the crossroads, the mere shining, the toll gate. And past it, a smudge ' +
          'of smoke that is Adowvale. Somewhere south of that, home.',
      },
      {
        id: 'bct-horn', gx: 0.5, gy: 4.45, label: 'Look at the horn', z: 44,
        thought: 'A great curled horn, bound in brass, on a post by the hatch. The warden would blow it to wake the watch below when the next beacon was seen burning.',
      },
      {
        id: 'bct-fuel', gx: 5.5, gy: 1.4, label: 'Look at the fuel', z: 22,
        thought: 'Faggots of brushwood, bone dry under an oiled cloth, and a cask of pitch. Someone has kept this ready, all these years.',
      },
    ],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  add('bct-hatch', 1, 5, { flat: true });
  add('bct-brazier', 2, 2, { w: 3, h: 3, blocks: [[1, 1]], shapes: [circle(1.5, 1.5, 0.62)] });
  add('bct-fuel', 5, 1, { shapes: [box(0.05, 0.05, 0.95, 0.95)] });
  add('bct-pitch', 5, 0, { shapes: [circle(0.5, 0.5, 0.3)] });
  add('bct-horn', 0, 4, { shapes: [circle(0.5, 0.5, 0.12)] });
  // The battlements along the near edges, low enough to see over (the corner post last, so its outline covers both runs).
  for (let i = 0; i < W; i++) add(`bct-parapet-x-${i}`, i, H - 1, { shapes: [box(0, 0.76, 1, 1)] });
  for (let i = 0; i < H; i++) add(`bct-parapet-y-${i}`, W - 1, i, { shapes: [box(0.76, 0, 1, 1)] });
  add('bct-parapet-corner', W - 1, H - 1, { shapes: [box(0.76, 0, 1, 1), box(0, 0.76, 0.76, 1)] });
  return data;
}
