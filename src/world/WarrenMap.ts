import { box, circle } from './Collision';
import { WARREN_MOUTH } from './landmarks';
import { CreatureSpawn, MapData, MapObject, placeObject, Prop, Terrain } from './MapData';

export { WARREN_MOUTH };

export const WARREN_W = 34;
export const WARREN_H = 21;
/** The back-wall segment with the way down to the brood hall in it. */
export const WARREN_DOWN_X = 29;

/** Who the goblins are holding in their pen: Hilde, if they carried her off from Adowvale, or else Coombe the shepherd. */
export type PenPrisoner = 'hilde' | 'coombe';

export interface WarrenState {
  /** Still in the pen: nobody has let them out yet. */
  prisoner?: PenPrisoner;
  /** On the way back up with Mother, after the brood hall: every goblin left in the warren is awake and hunting. */
  roused?: boolean;
}

/** The sentries at the guard post, the patrol in the store, the sleepers in their holes, and the one dozing by the pen. */
const SENTRIES: CreatureSpawn[] = [
  { id: 'wr-sentry-0', kind: 'goblinspear', gx: 14.5, gy: 8.2, notice: 4 },
  { id: 'wr-sentry-1', kind: 'goblin', gx: 20.4, gy: 8.0, notice: 4 },
];
const PATROL: CreatureSpawn[] = [{ id: 'wr-patrol', kind: 'goblintorch', gx: 16.5, gy: 16.5, notice: 3.6 }];
const SLEEPERS: CreatureSpawn[] = [
  { id: 'wr-sleeper-0', kind: 'goblin', gx: 25.6, gy: 12.4, notice: 2.4, asleep: true },
  { id: 'wr-sleeper-1', kind: 'goblinspear', gx: 32.0, gy: 12.6, notice: 2.4, asleep: true },
  { id: 'wr-sleeper-2', kind: 'goblin', gx: 26.0, gy: 19.2, notice: 2.4, asleep: true },
  { id: 'wr-sleeper-3', kind: 'goblin', gx: 31.6, gy: 18.6, notice: 2.4, asleep: true },
];
const PEN_GUARD: CreatureSpawn[] = [{ id: 'wr-penguard', kind: 'goblinspear', gx: 8.6, gy: 13.2, notice: 2.6, asleep: true }];
/** Up and hunting on the way back out, wherever the hero has to pass. */
const HUNTERS: CreatureSpawn[] = [
  { id: 'wr-hunter-0', kind: 'goblin', gx: 29.5, gy: 6.5, notice: 9 },
  { id: 'wr-hunter-1', kind: 'goblinspear', gx: 28.5, gy: 15.5, notice: 9 },
  { id: 'wr-hunter-2', kind: 'goblintorch', gx: 17.5, gy: 14.5, notice: 9 },
  { id: 'wr-hunter-3', kind: 'goblin', gx: 17.5, gy: 5.5, notice: 9 },
  { id: 'wr-hunter-4', kind: 'goblinspear', gx: 6.5, gy: 4.5, notice: 9 },
];

/** Every goblin in the upper tunnels, in the order the hero meets them on the way down. */
export const WARREN_GOBLINS = [...SENTRIES, ...PATROL, ...SLEEPERS, ...PEN_GUARD].map((c) => c.id);
/** The ones waiting on the way back out with Mother. */
export const WARREN_HUNTERS = HUNTERS.map((c) => c.id);

/**
 * The goblins' warren under the Greyfells: the upper tunnels, through the hole
 * in the hill above their camp. Walls of rock split it into chambers along a
 * twisting way down. The hole lets into the first, where the daylight still
 * reaches; off it, through a low gap, is a pen of hurdles with somebody in it.
 * The other way is the guard post, two sentries by a brazier on either side of
 * the way on; then the store, where they heap up what they carry off, with one
 * of them pacing it with a torch; then the sleeping holes, goblins curled up
 * snoring on stolen fleeces. Past those, in the back wall of the last chamber,
 * a passage slopes down into the warm, stinking dark: the way to the brood
 * hall (BroodHallMap). Quiet feet can get a long way down here.
 */
export function buildWarrenMap(state: WarrenState = {}): MapData {
  const W = WARREN_W;
  const H = WARREN_H;
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Cave));
    props.push(new Array(W).fill(Prop.None));
  }
  const creatures: CreatureSpawn[] = state.roused ? [...HUNTERS] : [...SENTRIES, ...PATROL, ...SLEEPERS, ...PEN_GUARD];
  const down = { x: WARREN_DOWN_X + 0.5, y: 1.6 };
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: WARREN_MOUTH,
    indoor: true,
    underground: true,
    music: 'cave',
    walls: {
      back: Array.from({ length: W }, (_, i) => (i === WARREN_DOWN_X ? 'cave-wall-back-door' : `cave-wall-back-${(i * 5 + 1) % 4}`)),
      side: Array.from({ length: H }, (_, i) => (i === 3 ? 'cave-wall-side-mouth' : `cave-wall-side-${(i * 3 + 2) % 4}`)),
      corner: 'cave-corner',
      height: 120,
    },
    doors: [
      {
        tx: 0, ty: 3, to: 'greyfells', entry: 'warren', label: 'Climb out',
        ask: state.roused ? 'Do you want to carry Mother up out of the warren?' : 'Do you want to climb back out onto the fell?',
      },
      {
        id: 'warren-down', tx: WARREN_DOWN_X, ty: 0, to: 'broodhall', entry: 'stair', label: 'Go down', facing: 'front',
        ask: 'Do you want to go on down? It is hot down there, and the stink of them is worse than ever.',
      },
    ],
    entries: { mouth: WARREN_MOUTH, down },
    lights: [
      // Daylight down the hole.
      { gx: 0.3, gy: 3.5, z: 40, radius: 220, flicker: 0 },
    ],
    creatures,
    npcs: [],
    sights: [],
    drips: [],
    landmarks: [
      { gx: 5, gy: 4, name: 'Under the hole', range: 5 },
      { gx: 5, gy: 15.5, name: 'The pen', range: 5 },
      { gx: 17.5, gy: 5, name: 'The guard post', range: 6 },
      { gx: 17.5, gy: 15.5, name: 'The store', range: 6 },
      { gx: 28.5, gy: 15.5, name: 'The sleeping holes', range: 6 },
      { gx: 28.5, gy: 4.5, name: 'The way down', range: 6 },
    ],
  };

  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  const rock = (tx: number, ty: number) => {
    if (props[ty]?.[tx] !== Prop.None) return;
    add(`cave-rockwall-${(tx * 7 + ty * 3) % 4}`, tx, ty, { fades: true });
  };
  const boulder = (tx: number, ty: number, r = 0.42) => {
    if (props[ty]?.[tx] !== Prop.None) return;
    add(`cave-boulder-${(tx + ty) % 3}`, tx, ty, { shapes: [circle(0.5, 0.5, r)] });
  };
  /** A fire in a ring of stones, with its light. */
  const fire = (tx: number, ty: number, radius = 150) => {
    add('nwt-firering', tx, ty, { shapes: [circle(0.5, 0.5, 0.4)] });
    add('fire-small', tx, ty, { anim: 'fire-small-burn' });
    data.lights!.push({ gx: tx + 0.5, gy: ty + 0.5, z: 12, radius, flicker: 1 });
  };

  // ---- The walls of rock between the chambers, each with its gap ----
  // Under the hole | the guard post, through a gap halfway down.
  for (let y = 0; y < 10; y++) if (y < 4 || y > 6) rock(11, y);
  // Under the hole / the pen, through a low gap.
  for (let x = 0; x < 11; x++) if (x < 3 || x > 5) rock(x, 10);
  rock(11, 10);
  // The pen | the store: solid.
  for (let y = 11; y < H; y++) rock(11, y);
  // The guard post / the store, the gap between the sentries.
  for (let x = 12; x < 23; x++) if (x < 16 || x > 18) rock(x, 10);
  // The guard post | the way down: solid. The store | the sleeping holes, a gap.
  for (let y = 0; y < 11; y++) rock(23, y);
  for (let y = 11; y < H; y++) if (y < 14 || y > 16) rock(23, y);
  // The sleeping holes / the way down.
  for (let x = 24; x < W; x++) if (x < 28 || x > 30) rock(x, 10);
  // Rubble along the near edges where the rock closes in.
  for (let x = 1; x < W; x += 3) boulder(x, H - 1);
  for (let y = 1; y < H; y += 3) boulder(W - 1, y);

  // ---- Under the hole ----
  for (const [tx, ty, v] of [[3, 1, 0], [8, 7, 1]]) add(`cave-stalagmites-${v}`, tx, ty, { shapes: [circle(0.5, 0.55, 0.3)] });
  for (const [tx, ty, v] of [[6, 2, 1], [16, 3, 0], [27, 13, 1], [19, 18, 0]]) {
    add(`cave-stalactites-${v}`, tx, ty, { overhead: true, blocks: [] });
    data.drips!.push({ gx: tx + 0.5, gy: ty + 0.5, z: v === 0 ? 118 : 108 });
  }
  add('cave-bones-0', 4, 6, { flat: true });
  add('nw-trampled-1', 2, 4, { flat: true });

  // ---- The pen ----
  // Hurdles round a corner of the chamber, the gate end lashed shut.
  const hurdle = (tx: number, ty: number) =>
    placeObject(data, { key: 'gf-hurdle', tx, ty, w: 2, h: 1, shapes: [box(0, 0.4, 1, 0.6), box(1, 0.4, 2, 0.6)], blocks: [[0, 0], [1, 0]] });
  hurdle(1, 15);
  hurdle(3, 15);
  add('nw-trampled-2', 2, 17, { flat: true });
  add('cave-bones-1', 4, 19, { flat: true });
  add('mkt-sacks', 9, 18, { shapes: [circle(0.45, 0.4, 0.3), circle(0.45, 0.7, 0.18)] });
  fire(9, 11, 120);
  if (state.prisoner && !state.roused) {
    data.npcs!.push({ id: state.prisoner === 'hilde' ? 'hilde-captive' : 'coombe', gx: 2.6, gy: 17.8, looking: { x: 1, y: -1 } });
  }
  if (state.prisoner && !state.roused) {
    data.musings = [{
      id: 'warren-pen', x0: 0, y0: 11, x1: 11, y1: WARREN_H,
      text: state.prisoner === 'hilde'
        ? 'Somebody in the pen, hunched up behind the hurdles, in a floury apron. Hilde. Saints, it is Hilde.'
        : 'Somebody in the pen behind the hurdles. Not a goblin: a man, filthy, with his hands tied behind him.',
    }];
  }
  data.sights!.push({
    id: 'wr-pen', gx: 4.5, gy: 15.4, label: 'Look at the pen', z: 14,
    thought: state.prisoner
      ? 'Hurdles lashed with gut, like the pen up at the camp. Only it was sheep in that one.'
      : 'The pen is empty now. The gut they lashed the hurdles with is cut through.',
  });

  // ---- The guard post: a brazier between the sentries ----
  fire(17, 7, 170);
  add('cave-column', 13, 2, { shapes: [circle(0.5, 0.5, 0.3)] });
  add('cave-stalagmites-0', 21, 3, { shapes: [circle(0.5, 0.55, 0.3)] });
  add('cave-bones-1', 19, 5, { flat: true });

  // ---- The store: everything they carried off ----
  add('mkt-crates', 13, 12, { shapes: [box(0.1, 0.15, 0.95, 0.95)] });
  add('mkt-sacks', 14, 12, { shapes: [circle(0.45, 0.4, 0.3), circle(0.45, 0.7, 0.18)] });
  add('furn-barrels-smashed', 12, 14);
  add('mkt-crates', 21, 19, { shapes: [box(0.1, 0.15, 0.95, 0.95)] });
  add('nwt-chest', 20, 12, { shapes: [box(0.1, 0.2, 0.9, 0.85)] });
  add('cave-bones-0', 15, 18, { flat: true });
  data.lights!.push({ gx: 16.5, gy: 16.5, z: 30, radius: 110, flicker: 1 });
  data.sights!.push({
    id: 'wr-store', gx: 13.5, gy: 13.4, label: 'Search the heap', z: 20,
    thought:
      "Everything they carried off, heaped up anyhow: sacks of grain, a cartwheel, pots, somebody's Sunday boots. And on top, Mother's " +
      'satchel. Her herbs are still in it, and her knife, and the little brass scales. They took her medicines too. Of course they did.',
  });
  data.sights!.push({ id: 'wr-cache', gx: 20.5, gy: 12.5, label: 'Open the chest', z: 22, loot: 'cache' });

  // ---- The sleeping holes ----
  for (const s of SLEEPERS) add(`nw-trampled-${Math.floor(s.gx + s.gy) % 4}`, Math.floor(s.gx), Math.floor(s.gy), { flat: true });
  add('cave-column', 29, 17, { shapes: [circle(0.5, 0.5, 0.3)] });
  add('cave-bones-1', 24, 18, { flat: true });
  data.drips!.push({ gx: 28.5, gy: 12.2, z: 100 });

  // ---- The way down ----
  fire(26, 3, 150);
  add('cave-stalagmites-1', 32, 6, { shapes: [circle(0.5, 0.55, 0.3)] });
  add('cave-bones-0', 31, 2, { flat: true });
  data.sights!.push({
    id: 'wr-down', gx: WARREN_DOWN_X + 0.5, gy: 0.4, label: 'Listen', z: 40,
    thought:
      'A passage slopes down into the dark, hot as an oven. Down there: a sound like a great slow bellows, breathing. And chanting, ' +
      'high and thin. And under it all, so faint I might be dreaming it, someone coughing.',
  });
  return data;
}
