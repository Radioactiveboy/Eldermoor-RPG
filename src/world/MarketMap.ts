import Phaser from 'phaser';
import { GARRISON, RESIDENCE, RESIDENCE_CHIMNEYS } from '../art/sizes';
import { INN_CHIMNEY, TOWNHOUSE_CHIMNEY } from '../art/market';
import { TREK_HOURS } from '../config';
import { box, circle, Shape } from './Collision';
import type { Villager } from '../systems/VillageDay';
import { Commute, MapData, MapObject, NpcSpawn, placeObject, Prop, Terrain } from './MapData';
import { joinDiagonals, paintPath, smoothLine } from './MapGenerator';
import { BOUNTY_BOARD, GARRISON_LANE, JETTY_LANE } from './landmarks';

export const MARKET_W = 34;
/** Rows 0-29 are the square and the houses round it; the rows past them are the lane to the garrison and the Headman's house. */
export const MARKET_H = 44;

/** The back corner of Lord Morten's toll gate, across the road north out of the village (see addTollGate). */
export const TOLL_GATE = { tx: 23, ty: 0, w: 4, h: 1 };

/** Coins the toll guards ask for, once, to open the gate onto the Lord's Road. */
export const TOLL = 100;

/**
 * What the toll gate blocks, shut or open (relative to its corner): the stone
 * piers on its outer tiles always, and the road between them while it's shut.
 */
export function tollGateShape(open: boolean): { shapes: Shape[]; blocks: Array<[number, number]> } {
  const piers = [box(0, 0.3, 1, 0.7), box(3, 0.3, 4, 0.7)];
  if (open) return { shapes: piers, blocks: [[0, 0], [3, 0]] };
  return { shapes: [...piers, box(1, 0.42, 2, 0.58), box(2, 0.42, 3, 0.58)], blocks: [[0, 0], [1, 0], [2, 0], [3, 0]] };
}

/** The road comes in from the east edge along these two rows. */
const ROAD_ROWS = [17, 18];

/** The middle of the road (in y) at column x, from the square out to the east edge. */
function roadMiddle(x: number): number {
  const t = Phaser.Math.Clamp((x - 22) / (MARKET_W - 27), 0, 1);
  return ROAD_ROWS[1] - 1.2 * Math.sin(Math.PI * t);
}

/** Where the Crooked Tankard's front door lets people in from the square. */
const TAVERN_DOOR = { x: 10.5, y: 4.3 };

/**
 * The workshops on the north side of the square, each with its keeper living
 * over it: Hilde's bakery (the house on the corner) and Osric's smithy (the
 * stone house past the inn). Their doors lead inside (see WorkshopMaps.ts).
 */
export const WORKSHOPS = {
  bakery: { house: { tx: 5, ty: 1 }, door: { tx: 6, ty: 4 }, front: { x: 6.5, y: 4.3 } },
  smithy: { house: { tx: 14, ty: 1 }, door: { tx: 15, ty: 4 }, front: { x: 15.5, y: 4.3 } },
} as const;

/**
 * Where each stall stands (its back corner), which way it faces, and who keeps it; where the
 * keeper steps out from behind it, and the doors they go in at on their round (see
 * systems/VillageDay.ts): home (over the shop, for Hilde and Osric), the workshop, and the inn.
 */
const STALLS: Array<{
  kind: Villager; tx: number; ty: number; facing: 'y' | 'x';
  exit: { x: number; y: number }; doors: Commute['doors'];
}> = [
  {
    kind: 'baker', tx: 10, ty: 8, facing: 'y', exit: { x: 9.5, y: 8.5 },
    doors: { home: WORKSHOPS.bakery.front, workshop: WORKSHOPS.bakery.front, tavern: TAVERN_DOOR },
  },
  {
    kind: 'smith', tx: 16, ty: 8, facing: 'y', exit: { x: 15.5, y: 8.5 },
    doors: { home: WORKSHOPS.smithy.front, workshop: WORKSHOPS.smithy.front, tavern: TAVERN_DOOR },
  },
  { kind: 'tanner', tx: 7, ty: 13, facing: 'x', exit: { x: 7.5, y: 15.5 }, doors: { home: { x: 4.3, y: 17.5 }, tavern: TAVERN_DOOR } },
];

/**
 * The village folk about the square while the market is on, each about from a
 * little after it opens to a little before it shuts, at their own hours: a few
 * strolling about (wherever they started, a few tiles either way), and two
 * stopped by the well for a gossip, facing each other. Nobody to talk to, but
 * worth listening to (see scenes/game/marketCrowd.ts).
 */
export const MARKET_CROWD: NpcSpawn[] = [
  { id: 'crowd-goodwife', gx: 12.5, gy: 11.5, hours: [7.5, 16.5] },
  { id: 'crowd-labourer', gx: 19.5, gy: 15.5, hours: [8, 17.5] },
  { id: 'crowd-youth', gx: 16.5, gy: 19.5, hours: [9, 17] },
  { id: 'crowd-boy', gx: 13.5, gy: 19.5, hours: [9.5, 16] },
  { id: 'crowd-girl', gx: 10.5, gy: 19.5, hours: [9.5, 16] },
  { id: 'crowd-matron', gx: 17.5, gy: 15.5, looking: { x: -1, y: 0 }, hours: [8, 15.5] },
  { id: 'crowd-elder', gx: 16.5, gy: 15.5, looking: { x: 1, y: 0 }, hours: [10, 16.5] },
];

/** Where the smith works, for the sound of the hammer through the smithy door (see world/AmbientSounds.ts). */
export const SMITHY = WORKSHOPS.smithy.front;

/**
 * Adowvale, the village at the far end of the road from the cottage, built
 * round its market square: bare earth with the well in the middle, three
 * traders' stalls, tall townhouses and an inn around it, lamp posts that light
 * up at night, and the village militia walking their rounds. The traders keep
 * market hours (see systems/MarketHours.ts), going home to the houses round the
 * square at night. The road leaves by the east edge, back towards home, and a
 * lane runs north out of the square to Lord Morten's toll gate and the Lord's
 * Road onto Adowvale Plains.
 * @param gateOpen whether the toll has been paid, so the gate stands open
 */
export function buildMarketMap(gateOpen = false): MapData {
  const W = MARKET_W;
  const H = MARKET_H;
  const rnd = new Phaser.Math.RandomDataGenerator(['eldermoor-market']);
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Grass));
    props.push(new Array(W).fill(Prop.None));
  }

  // The square: earth trodden bare by feet and carts, fading into worn grass at the edges.
  for (let y = 5; y <= 22; y++) {
    for (let x = 5; x <= 24; x++) {
      const edge = Math.min(x - 5, 24 - x, y - 5, 22 - y);
      const bare = edge >= 3 ? 1 : edge === 2 ? 0.8 : edge === 1 ? 0.5 : 0.25;
      if (rnd.frac() < bare) terrain[y][x] = Terrain.Dirt;
      // Bare earth all round the well, where the flat stones are laid (see below).
      if (Math.hypot(x + 0.5 - 15, y + 0.5 - 14) < 3) terrain[y][x] = Terrain.Dirt;
    }
  }
  // The road in from the east, worn into the grass: it dips north a little on its way out of the
  // square and widens and narrows as it goes, then runs straight along ROAD_ROWS off the edge.
  for (let x = 22; x < W; x++) {
    const mid = roadMiddle(x);
    const half = 1 + 0.25 * Math.sin(x * 1.3);
    for (let y = 0; y < H; y++) if (Math.abs(y + 0.5 - mid) <= half) terrain[y][x] = Terrain.Dirt;
  }

  // Trees thick around the edges, a few dotted about the meadow east of town.
  const inTown = (x: number, y: number) => x >= 1 && x <= 26 && y >= 1 && y <= 40;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (terrain[y][x] !== Terrain.Grass) continue;
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      const nearRoad = Math.abs(y + 0.5 - roadMiddle(x)) < 3 && x > 22;
      if (nearRoad) continue;
      const chance = edge < 2 ? 0.7 : inTown(x, y) ? 0 : 0.12;
      const roll = rnd.frac();
      if (roll < chance) props[y][x] = Prop.Tree;
      else if (!inTown(x, y) && roll < chance + 0.02) props[y][x] = Prop.Rock;
    }
  }

  const entry = { x: W - 2.5, y: 18 };
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: entry,
    music: 'market',
    entries: { road: entry },
    doors: ROAD_ROWS.map((ty) => ({
      tx: W - 1, ty, to: 'world' as const, entry: 'market', auto: true,
      ask: 'Do you want to make the trek home to Adowvale Hollow?', travelHours: TREK_HOURS,
    })),
    landmarks: [{ gx: 15, gy: 14, name: 'The market square', range: 10 }],
    lights: [],
    npcs: [],
    seats: [],
    chimneys: [],
  };

  // Houses around the square, all facing into it: a row along the back, more down the west side
  // (mirrored, so their fronts face east), and along the south a row seen from behind (their doors
  // are on the side facing the square, out of view).
  const house = (key: string, tx: number, ty: number, flipX = false) => {
    placeObject(data, { key, tx, ty, w: 3, h: 3, flipX });
    const c = key === 'bld-inn' ? INN_CHIMNEY : TOWNHOUSE_CHIMNEY;
    // Mirroring the art swaps x and y on the grid.
    data.chimneys!.push({ gx: tx + (flipX ? c.gy : c.gx), gy: ty + (flipX ? c.gx : c.gy), z: c.z });
  };
  house('bld-bakery', WORKSHOPS.bakery.house.tx, WORKSHOPS.bakery.house.ty);
  house('bld-inn', 9, 1);
  addTavernFront(data);
  house('bld-smithy', WORKSHOPS.smithy.house.tx, WORKSHOPS.smithy.house.ty);
  addWorkshopFronts(data);
  house('bld-house-chandler', 19, 2);
  house('bld-house-reeve', 1, 6, true);
  house('bld-house-miller', 1, 16, true);
  house('bld-house-back-slate', 8, 24);
  house('bld-house-back-tile', 13, 24);
  house('bld-house-back-shingle', 19, 24);

  // The well in the middle of the square, on a ragged spread of flat stones set into the earth.
  placeObject(data, { key: 'mkt-well-stones', tx: 14, ty: 13, w: 2, h: 2, flat: true });
  placeObject(data, { key: 'mkt-well', tx: 14, ty: 13, w: 2, h: 2 });

  // The traders, each behind their counter.
  for (const s of STALLS) {
    const flip = s.facing === 'x';
    // Laid out facing +y; a stall facing +x is the same thing mirrored (x and y swapped).
    const swap = (sh: Shape): Shape =>
      !flip ? sh : sh.kind === 'circle' ? circle(sh.y, sh.x, sh.r) : box(sh.y0, sh.x0, sh.y1, sh.x1);
    const stall: MapObject = {
      key: `mkt-stall-${s.kind}`,
      tx: s.tx,
      ty: s.ty,
      w: 2,
      h: 2,
      flipX: flip,
      // The back row is the trader's; the counter takes the front of the next.
      shapes: [box(0, 0, 1, 1), box(1, 0, 2, 1), box(0.05, 1, 1, 1.65), box(1, 1, 1.95, 1.65)].map(swap),
    };
    placeObject(data, stall);
    const keeper = flip ? { x: 0.55, y: 1 } : { x: 1, y: 0.55 };
    data.npcs!.push({
      id: s.kind, gx: s.tx + keeper.x, gy: s.ty + keeper.y,
      commute: { villager: s.kind, stall, exit: s.exit, doors: s.doors },
    });
  }

  // Lamp posts at the corners of the square, lit at dusk.
  for (const [tx, ty] of [[6, 7], [23, 7], [6, 21], [23, 21], [22, 15]]) {
    placeObject(data, { key: 'mkt-lamp', tx, ty, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.14)] });
    data.lights!.push({ gx: tx + 0.5, gy: ty + 0.5, z: 50, radius: 150, flicker: 0.5 });
  }

  // Benches looking out over the square, and stock piled up by the stalls.
  for (const [tx, ty] of [[12, 17], [18, 17]]) {
    placeObject(data, { key: 'mkt-bench', tx, ty, w: 1, h: 1, shapes: [box(0.08, 0.35, 0.92, 0.7)] });
    data.seats!.push({ name: 'market-bench', gx: tx + 0.5, gy: ty + 0.55, faceX: 0, faceY: 1, standX: tx + 0.5, standY: ty + 1.5 });
  }
  placeObject(data, { key: 'mkt-crates', tx: 12, ty: 8, w: 1, h: 1, shapes: [box(0.1, 0.15, 0.95, 0.95)] });
  placeObject(data, { key: 'furn-barrels', tx: 13, ty: 8, w: 1, h: 1, shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  placeObject(data, { key: 'mkt-crates', tx: 18, ty: 8, w: 1, h: 1, shapes: [box(0.1, 0.15, 0.95, 0.95)] });
  placeObject(data, { key: 'furn-barrels', tx: 7, ty: 11, w: 1, h: 1, shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  placeObject(data, { key: 'mkt-crates', tx: 24, ty: 14, w: 1, h: 1, shapes: [box(0.1, 0.15, 0.95, 0.95)] });

  // Odds and ends that make it lived in: a hay cart by the road, a trough for the carters' horses,
  // a washing line between the houses on the west side, and sacks and baskets by the stalls.
  const set = (key: string, tx: number, ty: number, w: number, h: number, more: Partial<MapObject> = {}) => {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (data.props[y][x] !== Prop.Blocked) data.props[y][x] = Prop.None;
    placeObject(data, { key, tx, ty, w, h, ...more });
  };
  set('mkt-haycart', 20, 20, 2, 1);
  set('mkt-trough', 20, 11, 2, 1, { shapes: [box(0.1, 0.25, 1, 0.78), box(1, 0.25, 1.9, 0.78)] });
  set('mkt-washing', 2, 10, 1, 3, { blocks: [[0, 0], [0, 2]], shapes: [circle(0.5, 0.2, 0.08), circle(0.5, 2.8, 0.08)] });
  set('mkt-sacks', 14, 9, 1, 1, { shapes: [circle(0.45, 0.4, 0.3), circle(0.45, 0.7, 0.18)] });
  set('mkt-sacks', 6, 11, 1, 1, { shapes: [circle(0.45, 0.4, 0.3), circle(0.45, 0.7, 0.18)] });

  // The ground: cart ruts down the road and into the square, and cobbles laid along the house fronts.
  placeObject(data, { key: 'mkt-ruts', tx: 0, ty: 0, w: 1, h: 1, flat: true });
  for (const [tx, ty] of [[5, 4], [9, 4], [14, 4], [19, 5]]) placeObject(data, { key: 'mkt-cobbles', tx, ty, w: 3, h: 1, flat: true });
  for (const [tx, ty] of [[4, 6], [4, 16]]) placeObject(data, { key: 'mkt-cobbles', tx, ty, w: 1, h: 3, flat: true, flipX: true });

  // A signpost where the road leaves the square, pointing the way home.
  placeObject(data, { key: 'mkt-signpost', tx: 27, ty: 19, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.1)] });
  data.sights = [{
    id: 'signpost-market', gx: 27.5, gy: 19.5, label: 'Read the sign', z: 58,
    sign: { heading: 'Signpost', lines: ['→  East: Adowvale Hollow', '←  West: Adowvale market square', '↑  North: the toll gate and the Lord\'s Road'] },
  }];
  // The militia's notice board, by the trough, where bounties are posted and paid (see systems/Bounties.ts).
  const board = BOUNTY_BOARD;
  placeObject(data, { key: 'mkt-noticeboard', tx: board.tx, ty: board.ty, w: 2, h: 1, shapes: [circle(0.14, 0.5, 0.08), circle(1.86, 0.5, 0.08), box(0.1, 0.42, 1.9, 0.54)] });
  data.sights.push({ id: board.id, gx: board.tx + 1, gy: board.ty + 0.9, label: 'Read the notices', z: 62 });
  addTollGate(data, gateOpen);
  addGarrisonLane(data);
  addJettyLane(data);

  // The militia, each walking their own patch of the square.
  data.npcs!.push(
    { id: 'guard-1', gx: 11.5, gy: 15.5 },
    { id: 'guard-2', gx: 19.5, gy: 12.5 },
    { id: 'guard-3', gx: 17.5, gy: 20.5 },
    { id: 'guard-4', gx: 25.5, gy: 16.5 },
    // Wat, on the east watch towards the Hollow, once the goblins have been (hidden before; see scenes/game/companions.ts).
    { id: 'wat', gx: 27.5, gy: 14.5 },
  );
  data.npcs!.push(...MARKET_CROWD);
  return data;
}

/**
 * The Crooked Tankard, the inn on the north side of the square (see
 * TavernMap.ts for inside): its front door, a lantern's glow over it, a bench
 * and a couple of barrels out front.
 */
function addTavernFront(data: MapData): void {
  data.doors!.push({ tx: 10, ty: 4, to: 'tavern', entry: 'door', label: 'Go inside', facing: 'back' });
  data.entries!.tavern = { x: 10.5, y: 4.7 };
  data.landmarks!.push({ gx: 10.5, gy: 4.5, name: 'The Crooked Tankard', range: 2.5 });
  data.lights!.push({ gx: 10.5, gy: 4.1, z: 52, radius: 110, flicker: 0.5 });
  placeObject(data, { key: 'furn-barrels', tx: 8, ty: 4, w: 1, h: 1, shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  placeObject(data, { key: 'mkt-bench', tx: 12, ty: 4, w: 1, h: 1, shapes: [box(0.08, 0.35, 0.92, 0.7)] });
  data.seats!.push({ name: 'tavern-bench', gx: 12.5, gy: 4.55, faceX: 0, faceY: 1, standX: 12.5, standY: 5.5 });
}

/**
 * The doors into Hilde's bakery and Osric's smithy, with a lantern over each,
 * and their names under the area's name as the hero walks by.
 */
function addWorkshopFronts(data: MapData): void {
  const fronts: Array<[keyof typeof WORKSHOPS, string]> = [['bakery', "Hilde's bakery"], ['smithy', "Osric's smithy"]];
  for (const [id, name] of fronts) {
    const w = WORKSHOPS[id];
    data.doors!.push({ tx: w.door.tx, ty: w.door.ty, to: id, entry: 'door', label: 'Go inside', facing: 'back' });
    data.entries![id] = { x: w.front.x, y: w.front.y + 0.4 };
    data.landmarks!.push({ gx: w.front.x, gy: w.front.y, name, range: 2.5 });
    data.lights!.push({ gx: w.front.x, gy: w.front.y - 0.2, z: 52, radius: 100, flicker: 0.5 });
  }
}

/**
 * Lord Morten's toll gate: a lane leaves the north-east corner of the square
 * and runs up to a stone-piered gate in a stake palisade at the north edge of
 * the village, where the Lord's Road sets off across Adowvale Plains. Two of
 * his men keep the gate, with a booth to shelter in and his banner flying. The
 * gate opens once the toll is paid, and stays open (see payToll in scenes/game/monastery.ts).
 */
function addTollGate(data: MapData, open: boolean): void {
  const { tx, ty } = TOLL_GATE;
  const middle = tx + 2;
  // Clear the ground up to the gate, keeping the trees either side of the palisade.
  for (let y = 0; y <= 6; y++) {
    for (let x = 20; x <= 30; x++) if (data.props[y][x] === Prop.Tree || data.props[y][x] === Prop.Rock) data.props[y][x] = Prop.None;
  }
  // The lane, worn into the grass, bending up out of the corner of the square to the gate.
  const lane = smoothLine([{ x: 22.5, y: 9 }, { x: 23.8, y: 6 }, { x: middle - 0.2, y: 3 }, { x: middle, y: 1 }, { x: middle, y: -1 }]);
  paintPath(data.terrain, lane, (t) => 1.05 + 0.2 * Math.sin(t * 11 + 2));
  for (let x = tx + 1; x <= tx + 2; x++) data.terrain[ty][x] = Terrain.Dirt;
  joinDiagonals(data.terrain, Terrain.Dirt, Terrain.Grass);

  const shape = tollGateShape(open);
  placeObject(data, { key: open ? 'toll-gate-open' : 'toll-gate', tx, ty, w: TOLL_GATE.w, h: TOLL_GATE.h, ...shape });
  // The palisade either side, running off into the trees.
  for (let x = 19; x <= 30; x++) {
    if (x >= tx && x < tx + TOLL_GATE.w) continue;
    placeObject(data, { key: 'toll-palisade', tx: x, ty, w: 1, h: 1, shapes: [box(0, 0.38, 1, 0.62)] });
  }
  placeObject(data, { key: 'toll-booth', tx: 28, ty: 1, w: 1, h: 1, shapes: [box(0.1, 0.1, 0.9, 0.9)] });
  placeObject(data, { key: 'toll-banner', tx: 21, ty: 1, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.1)] });
  placeObject(data, { key: 'mkt-lamp', tx: 27, ty: 3, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.14)] });
  data.lights!.push({ gx: 27.5, gy: 3.5, z: 50, radius: 150, flicker: 0.5 });

  // Through the gate: the Lord's Road, and Adowvale Plains beyond.
  for (let x = tx + 1; x <= tx + 2; x++) {
    data.doors!.push({ tx: x, ty, to: 'plains', entry: 'gate', auto: true, ask: "Do you want to take the Lord's Road out onto Adowvale Plains?" });
  }
  data.entries!.gate = { x: middle, y: 2.2 };
  // Lord Morten's men, one in front of each pier.
  data.npcs!.push({ id: 'tollguard-1', gx: tx + 0.5, gy: 1.5 }, { id: 'tollguard-2', gx: tx + 3.5, gy: 1.5 });

  placeObject(data, { key: 'mkt-signpost', tx: 26, ty: 7, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.1)] });
  data.sights!.push({
    id: 'signpost-tollgate', gx: 26.5, gy: 7.5, label: 'Read the sign', z: 58,
    sign: { heading: 'Signpost', lines: ['↑  North: toll gate, the Lord\'s Road, Adowvale Plains', '↓  South: Adowvale market square'] },
  });
  data.landmarks!.push({ gx: middle, gy: 1, name: 'The toll gate', range: 6 });
}

/**
 * The lane past the back of the square: a dirt path leaves its south-west
 * corner between the backs of the houses there and comes out on a lane at the
 * far end of the village. On it stand the militia's garrison, a squat stone
 * blockhouse with the hatch down to its jail beside it (see GarrisonMaps.ts
 * for inside), and the Headman's residence, behind a low garden wall with a
 * gate and roses. A militiaman keeps the garrison door.
 */
function addGarrisonLane(data: MapData): void {
  const { garrison: g, residence: r, hatch, gate } = GARRISON_LANE;
  // The path down from the square, and the lane it comes out on.
  const path = smoothLine([{ x: 11.6, y: 21.5 }, { x: 11.9, y: 25 }, { x: 11.5, y: 29 }, { x: 12.2, y: 33 }, { x: 12, y: 36.6 }, { x: 11, y: 38.2 }]);
  paintPath(data.terrain, path, (t) => 0.9 + 0.15 * Math.sin(t * 9));
  const lane = smoothLine([{ x: 2.5, y: 39.2 }, { x: 7, y: 38.4 }, { x: 12, y: 38.3 }, { x: 17.5, y: 38.8 }, { x: 23, y: 38.4 }, { x: 25.5, y: 39.4 }]);
  paintPath(data.terrain, lane, (t) => 1 + 0.2 * Math.sin(t * 13 + 1));
  // The garrison's trodden yard, and the path round to the hatch.
  for (let y = g.ty + GARRISON.h; y <= g.ty + GARRISON.h + 2; y++) {
    for (let x = g.tx - 1; x <= g.tx + GARRISON.w + 1; x++) if (Math.abs(x - (g.tx + 2)) + (y - g.ty - GARRISON.h) < 5) data.terrain[y][x] = Terrain.Dirt;
  }
  for (let y = hatch.ty; y <= g.ty + GARRISON.h; y++) data.terrain[y][hatch.tx] = Terrain.Dirt;
  joinDiagonals(data.terrain, Terrain.Dirt, Terrain.Grass);

  // The garrison, door to the lane, and the hatch against its side wall.
  placeObject(data, { key: 'bld-garrison', tx: g.tx, ty: g.ty, w: GARRISON.w, h: GARRISON.h });
  const door = { tx: g.tx + GARRISON.doorTile, ty: g.ty + GARRISON.h };
  data.doors!.push({ tx: door.tx, ty: door.ty, to: 'garrison', entry: 'door', label: 'Go inside', facing: 'back' });
  data.entries!.garrison = { x: door.tx + 0.5, y: door.ty + 0.7 };
  data.lights!.push({ gx: g.tx + GARRISON.doorTile + 1.12, gy: door.ty + 0.05, z: 48, radius: 110, flicker: 0.5 });
  placeObject(data, { key: 'gar-hatch', tx: hatch.tx, ty: hatch.ty, w: 1, h: 1, flat: true });
  data.doors!.push({ tx: hatch.tx, ty: hatch.ty, to: 'jail', entry: 'hatch', label: 'Go down through the hatch', facing: 'front' });
  data.entries!.hatch = { x: hatch.tx + 0.5, y: hatch.ty + 1.3 };
  data.landmarks!.push({ gx: door.tx + 0.5, gy: door.ty + 0.5, name: 'The militia garrison', range: 3.5 });
  // A militiaman on the door, day and night.
  data.npcs!.push({ id: 'guard-5', gx: door.tx + 1.6, gy: door.ty + 0.75, looking: { x: 0, y: 1 } });

  // The Headman's residence, with its chimneys smoking, behind its garden wall.
  placeObject(data, { key: 'bld-residence', tx: r.tx, ty: r.ty, w: RESIDENCE.w, h: RESIDENCE.h });
  for (const c of RESIDENCE_CHIMNEYS) data.chimneys!.push({ gx: r.tx + c.gx, gy: r.ty + c.gy, z: c.z });
  const front = r.ty + RESIDENCE.h;
  const porch = r.tx + RESIDENCE.porch;
  data.doors!.push({ tx: Math.floor(porch), ty: front, to: 'residence', entry: 'door', label: 'Knock and go in', facing: 'back' });
  data.entries!.residence = { x: porch, y: front + 1.1 };
  for (const dx of [-0.62, 0.62]) data.lights!.push({ gx: porch + dx, gy: front + 0.05, z: 38, radius: 90, flicker: 0.4 });
  data.landmarks!.push({ gx: porch, gy: front + 1.5, name: "The Headman's house", range: 4 });
  const wall = { shapes: [box(0, 0.36, 1, 0.64)] };
  const side = { flipX: true, shapes: [box(0.36, 0, 0.64, 1)] };
  const pier = { shapes: [box(0.22, 0.22, 0.78, 0.78)] };
  for (let x = r.tx - 1; x <= r.tx + RESIDENCE.w; x++) {
    const key = x === r.tx - 1 || x === r.tx + RESIDENCE.w || Math.abs(x + 0.5 - porch) === 1 ? 'res-pier' : 'res-gardenwall';
    if (x === gate.tx) continue;
    placeObject(data, { key, tx: x, ty: gate.ty, w: 1, h: 1, ...(key === 'res-pier' ? pier : wall) });
  }
  for (let y = front; y < gate.ty; y++) {
    for (const x of [r.tx - 1, r.tx + RESIDENCE.w]) placeObject(data, { key: 'res-gardenwall', tx: x, ty: y, w: 1, h: 1, ...side });
  }
  // A flagged walk from the gate to the porch, and rose beds either side of it.
  for (let y = front; y <= gate.ty; y++) data.terrain[y][gate.tx] = Terrain.Stone;
  placeObject(data, { key: 'res-flowerbed', tx: r.tx, ty: front + 1, w: 2, h: 1, shapes: [box(0.08, 0.15, 1, 0.85), box(1, 0.15, 1.92, 0.85)] });
  placeObject(data, { key: 'res-flowerbed', tx: r.tx + RESIDENCE.w - 2, ty: front + 1, w: 2, h: 1, shapes: [box(0.08, 0.15, 1, 0.85), box(1, 0.15, 1.92, 0.85)] });
  placeObject(data, { key: 'mkt-bench', tx: r.tx + 2, ty: front + 1, w: 1, h: 1, shapes: [box(0.08, 0.35, 0.92, 0.7)] });
  data.seats!.push({ name: 'residence-bench', gx: r.tx + 2.5, gy: front + 1.55, faceX: 0, faceY: 1, standX: r.tx + 2.5, standY: front + 2.4 });

  // Lamps along the lane, and a signpost at the top of the path where it leaves the square.
  for (const [tx, ty] of [[g.tx - 2, g.ty + GARRISON.h + 1], [gate.tx + 5, gate.ty]]) {
    placeObject(data, { key: 'mkt-lamp', tx, ty, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.14)] });
    data.lights!.push({ gx: tx + 0.5, gy: ty + 0.5, z: 50, radius: 150, flicker: 0.5 });
  }
  placeObject(data, { key: 'mkt-signpost', tx: 13, ty: 22, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.1)] });
  data.sights!.push({
    id: 'signpost-garrison', gx: 13.5, gy: 22.5, label: 'Read the sign', z: 58,
    sign: { heading: 'Signpost', lines: ["↓  South: the militia garrison, and the Headman's house", '↑  North: Adowvale market square'] },
  });
  // Barrels and a cart by the garrison, and a woodpile against the residence's end wall.
  placeObject(data, { key: 'furn-barrels', tx: g.tx - 1, ty: g.ty + 1, w: 1, h: 1, shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  placeObject(data, { key: 'mkt-crates', tx: g.tx - 1, ty: g.ty + 2, w: 1, h: 1, shapes: [box(0.1, 0.15, 0.95, 0.95)] });
  placeObject(data, { key: 'mkt-haycart', tx: r.tx + RESIDENCE.w + 2, ty: r.ty + 2, w: 2, h: 1 });
}

/**
 * The lane on down to the river: from where the path from the square meets
 * the garrison lane, it carries straight on south between the trees and off
 * the bottom of the map, to Adowvale Jetty (see JettyMap.ts), with a signpost
 * at the top. (The palisade round the village leaves a gap for it.)
 */
function addJettyLane(data: MapData): void {
  const H = data.height;
  // Clear the trees either side of the lane.
  for (let y = 39; y < H; y++) {
    for (let x = JETTY_LANE.x0 - 2; x <= JETTY_LANE.x1 + 3; x++) if (data.props[y][x] === Prop.Tree || data.props[y][x] === Prop.Rock) data.props[y][x] = Prop.None;
  }
  const lane = smoothLine([{ x: 11.6, y: 38.2 }, { x: 12.2, y: 40.5 }, { x: 11.8, y: 42.5 }, { x: 12, y: H + 1 }]);
  paintPath(data.terrain, lane, (t) => 0.95 + 0.15 * Math.sin(t * 7 + 1));
  for (let y = 39; y < H; y++) for (let x = JETTY_LANE.x0; x <= JETTY_LANE.x1; x++) data.terrain[y][x] = Terrain.Dirt;
  joinDiagonals(data.terrain, Terrain.Dirt, Terrain.Grass);
  for (let x = JETTY_LANE.x0; x <= JETTY_LANE.x1; x++) {
    data.doors!.push({ tx: x, ty: H - 1, to: 'jetty', entry: 'market', auto: true, ask: 'Do you want to go down the lane to Adowvale Jetty, on the river?' });
  }
  data.entries!.jetty = { x: (JETTY_LANE.x0 + JETTY_LANE.x1 + 1) / 2, y: H - 2.2 };
  placeObject(data, { key: 'mkt-signpost', tx: 14, ty: 40, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.1)] });
  data.sights!.push({
    id: 'signpost-jetty', gx: 14.5, gy: 40.5, label: 'Read the sign', z: 58,
    sign: { heading: 'Signpost', lines: ['↓  South: Adowvale Jetty and the river Wend', "↑  North: the garrison, the Headman's house and the market square"] },
  });
  data.landmarks!.push({ gx: 12, gy: H - 1, name: 'The lane down to the jetty', range: 3.5 });
}
