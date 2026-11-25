import Phaser from 'phaser';
import { box, circle, Shape } from './Collision';
import { MapData, MapObject, placeObject, Prop, Terrain } from './MapData';
import { joinDiagonals, paintPath, smoothLine } from './MapGenerator';
import { deckKey, heronUnderwayKey } from '../art/jetty';
import { BLACK_ROSE, GLOOM_GATE, GLOOM_H, GLOOM_HERON, GLOOM_PIER, GLOOM_W, GLOOM_WALL, GLOOM_WELL } from './landmarks';

/**
 * Gloomhaven: a marsh town on the river, downstream of Adowvale, where folk go
 * who would rather not be found. Seen from the river (the boat from Adowvale
 * Jetty will tie up at its pier one day), it's a huddle of black, sagging
 * houses on a mudbank: the Staithe, a waterfront of duckboards and pilings
 * along the river; a lane up from the pier to the square, where a little well
 * stands in front of the Black Rose, the biggest building in the town and the
 * only one that's kept up; three shops round the square (Ossery's remedies,
 * Tallow's chandlery and Lusk's, who buys anything and asks nothing); and all
 * round, the town's houses, half of them sinking, some on stilts over the
 * pools, one burnt out. A wall of black stakes on a stone footing closes the
 * town in on three sides, down to the river, and the gate in the north wall
 * is kept shut by the hired heavies who stand about it.
 *
 * It's wet everywhere: standing pools with reeds and rushes, mud where the
 * ground is trodden, boards laid over the worst of it, dead trees, and a mist
 * that never quite lifts (MapData.fen).
 */

/** Where the near bank meets the water at column x: rows from here down are river. */
export function gloomBank(x: number): number {
  return 46.2 + 0.7 * Math.sin(x * 0.37 + 0.6) + 0.45 * Math.sin(x * 0.91 + 2.1);
}

/** Where the far bank comes down to the water: rows from here on are the far shore (all reeds and drowned trees). */
function farBank(x: number): number {
  return 80.4 + 1.6 * Math.sin(x * 0.21 + 1.3) + 0.8 * Math.sin(x * 0.53);
}

/** A reedy eyot out in the river, east of the pier: centre and radii, in tiles. */
const EYOT = { x: 45, y: 64, rx: 4.2, ry: 2.6 };

/** Standing pools inside the walls: centre and radii, in tiles. */
const POOLS: Array<{ x: number; y: number; rx: number; ry: number }> = [
  { x: 8.5, y: 20, rx: 3, ry: 2.2 },
  { x: 12, y: 36.5, rx: 3.4, ry: 2.4 },
  { x: 49, y: 22.5, rx: 2.6, ry: 2.2 },
  { x: 45.5, y: 37, rx: 3, ry: 2.2 },
  { x: 21, y: 8.5, rx: 2.2, ry: 1.6 },
];

/** The square, in tiles (x0, y0 inclusive; x1, y1 exclusive), cobbled once, now as much mud as stone. */
const SQUARE = { x0: 20, y0: 19, x1: 42, y1: 31 };

type Setter = (key: string, tx: number, ty: number, w: number, h: number, more?: Partial<MapObject>) => void;
type Slim = (key: string, tx: number, ty: number, shapes: Shape[], more?: Partial<MapObject>) => void;

/** @param heron the Grey Heron has brought the hero down, and lies at the pier with Maren Tull, to take them home. */
export function buildGloomhavenMap(heron = false): MapData {
  const W = GLOOM_W;
  const H = GLOOM_H;
  const rnd = new Phaser.Math.RandomDataGenerator(['gloomhaven']);
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Grass));
    props.push(new Array(W).fill(Prop.None));
  }

  // ---- The river, its muddy near bank and its reedy far shore ----
  for (let x = 0; x < W; x++) {
    const near = gloomBank(x);
    const far = farBank(x);
    for (let y = 0; y < H; y++) {
      const cy = y + 0.5;
      if (cy >= near && cy < far) terrain[y][x] = Terrain.Water;
      else if (cy < near && cy >= near - 2.2) terrain[y][x] = Terrain.Dirt;
      else if (cy >= far && cy < far + 0.8) terrain[y][x] = Terrain.Dirt;
    }
  }
  // ---- The eyot: a mudbank in mid-river, all reeds and a drowned tree or two ----
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x + 0.5 - EYOT.x) / EYOT.rx, (y + 0.5 - EYOT.y) / EYOT.ry) + 0.15 * Math.sin(x * 1.7 + y * 2.3);
      if (d < 1) terrain[y][x] = d < 0.6 ? Terrain.Grass : Terrain.Dirt;
    }
  }
  // ---- The pools ----
  for (const p of POOLS) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x + 0.5 - p.x) / p.rx, (y + 0.5 - p.y) / p.ry) + 0.18 * Math.sin(x * 2.1 + y * 1.3);
        if (d < 1) terrain[y][x] = Terrain.Water;
        else if (d < 1.45 && terrain[y][x] === Terrain.Grass) terrain[y][x] = Terrain.Dirt;
      }
    }
  }
  // Out past the north wall, the fen: pools and mud either side of the road.
  for (let y = 0; y < GLOOM_WALL.north - 1; y++) {
    for (let x = 0; x < W; x++) {
      const n = Math.sin(x * 0.7 + y * 1.9) + Math.sin(x * 0.23 - y * 0.8);
      if (Math.abs(x - 37.5) > 3 && n > 1.1) terrain[y][x] = Terrain.Water;
      else if (n > 0.55) terrain[y][x] = Terrain.Dirt;
    }
  }

  // ---- The square: broken cobbles, patched with mud ----
  for (let y = SQUARE.y0; y < SQUARE.y1; y++) {
    for (let x = SQUARE.x0; x < SQUARE.x1; x++) {
      const edge = Math.min(x - SQUARE.x0, SQUARE.x1 - 1 - x, y - SQUARE.y0, SQUARE.y1 - 1 - y);
      const ragged = edge === 0 && rnd.frac() < 0.45;
      if (terrain[y][x] === Terrain.Water || ragged) continue;
      terrain[y][x] = rnd.frac() < 0.13 + (edge < 2 ? 0.15 : 0) ? Terrain.Dirt : Terrain.Stone;
    }
  }

  // ---- The roads and lanes, all mud ----
  const road = (pts: Array<{ x: number; y: number }>, r: number) => paintPath(terrain, smoothLine(pts), (t) => r + 0.15 * Math.sin(t * 11));
  const gateX = (GLOOM_GATE.road.x0 + GLOOM_GATE.road.x1 + 1) / 2;
  // In at the gate and down to the square.
  road([{ x: gateX, y: -1 }, { x: gateX, y: 6 }, { x: gateX - 0.4, y: 11 }, { x: gateX + 0.2, y: 16 }, { x: gateX - 0.5, y: 19.5 }], 1.25);
  // From the square down to the Staithe and the pier.
  road([{ x: 30, y: 30 }, { x: 30.4, y: 34 }, { x: 29.6, y: 38 }, { x: 30.2, y: 42 }, { x: 30, y: 45 }], 1.05);
  // West, past the shops, to the houses in the west quarter.
  road([{ x: 20.5, y: 30 }, { x: 16, y: 31.5 }, { x: 11, y: 30.5 }, { x: 7, y: 29 }, { x: 5, y: 27 }], 0.85);
  road([{ x: 13, y: 30.8 }, { x: 13.4, y: 26 }, { x: 12.5, y: 20 }, { x: 13.5, y: 14 }, { x: 11, y: 10 }], 0.75);
  // East, behind the square, to the east quarter and the tannery yard by the wall.
  road([{ x: 41.5, y: 27 }, { x: 45, y: 28.2 }, { x: 49, y: 29.5 }, { x: 53, y: 30 }], 0.85);
  road([{ x: 46, y: 28.5 }, { x: 46.5, y: 32 }, { x: 44, y: 41 }, { x: 40, y: 43.5 }], 0.75);
  // The Staithe: the trodden mud along the waterfront.
  road([{ x: 6, y: 43.5 }, { x: 15, y: 43.2 }, { x: 24, y: 43.8 }, { x: 30, y: 43.6 }, { x: 40, y: 43.4 }, { x: 52, y: 43.8 }], 1.1);
  // Round behind the Black Rose to its yard.
  road([{ x: 22.5, y: 20 }, { x: 22.4, y: 15 }, { x: 25, y: 10.6 }, { x: 31, y: 10.4 }, { x: 34.4, y: 12.5 }], 0.7);
  // Everywhere inside the walls, the grass is worn through to mud in patches; more of it the nearer the water.
  for (let y = GLOOM_WALL.north + 1; y < H; y++) {
    for (let x = GLOOM_WALL.west + 1; x < GLOOM_WALL.east; x++) {
      if (terrain[y][x] !== Terrain.Grass || y > gloomBank(x)) continue;
      const n = Math.sin(x * 0.45 + y * 0.21) + Math.sin(y * 0.53 - x * 0.17 + 1.7) + Math.sin((x + y) * 0.9) * 0.4 + rnd.frac() * 0.7;
      if (n > 1.45 - Math.max(0, y - 34) * 0.04) terrain[y][x] = Terrain.Dirt;
    }
  }
  joinDiagonals(terrain, Terrain.Dirt, Terrain.Grass);

  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: { x: GLOOM_PIER.x1 + 0.2, y: GLOOM_PIER.headY + 0.6 },
    music: 'world',
    decor: 0.14,
    // Dank and sodden: everything a little greener and darker than upriver.
    groundShade: 0xc8b49c,
    fen: 0.6,
    wilds: 'fen',
    entries: {},
    doors: [],
    sights: [],
    lights: [],
    landmarks: [],
    musings: [],
    npcs: [],
    seats: [],
    chimneys: [],
    decks: [],
    crows: [],
    river: { flow: { x: 1, y: 0.06 }, speed: 0.3 },
    waters: [{ id: 'river', gx: 30, gy: 51, r: 40 }],
  };
  // Arriving by the river, at the end of the pier; and (for the debug panel) by the gate, from inside it.
  data.entries!.heron = { x: GLOOM_PIER.x1 + 0.2, y: GLOOM_PIER.headY + 0.6 };
  data.entries!.gate = { x: gateX, y: GLOOM_WALL.north + 2.2 };

  const set: Setter = (key, tx, ty, w, h, more = {}) => {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (props[y]?.[x] === Prop.Tree || props[y]?.[x] === Prop.Rock) props[y][x] = Prop.None;
    placeObject(data, { key, tx, ty, w, h, ...more });
  };
  /** Something slim on a tile people can still walk across: it only blocks its own outline. */
  const slim: Slim = (key, tx, ty, shapes, more = {}) => set(key, tx, ty, 1, 1, { blocks: [], shapes, ...more });

  addWall(data, set);
  addGate(data, set, slim);
  addSquare(data, set, slim);
  addBlackRose(data, set, slim);
  addShops(data, set, slim);
  addHouses(data, set, slim);
  addStaithe(data, set, slim);
  addMarsh(data, rnd, set, slim);
  addFolk(data);
  if (heron) addHeron(data, set);
  return data;
}

/** The Grey Heron alongside the pier head, her sail furled, and Maren Tull on the boards beside her. */
function addHeron(data: MapData, set: Setter): void {
  const h = GLOOM_HERON;
  // She lies on the water, out of everyone's way; the pier head she's alongside stays walkable.
  set(heronUnderwayKey(0, false), h.tx, h.ty, h.w, h.h, { bob: 1.5, blocks: [], shapes: [] });
  data.lights!.push({ gx: h.tx + 2.6, gy: h.ty + 3.5, z: 40, radius: 110, flicker: 0.4 });
  data.landmarks!.push({ gx: h.tx + 1, gy: h.ty + 3.5, name: 'The Grey Heron', range: 2.6 });
  data.npcs!.push({ id: 'maren', gx: GLOOM_PIER.headX0 + 2.2, gy: GLOOM_PIER.headY + 1.45, looking: { x: 0.3, y: 1 } });
}

/**
 * The town wall: black stakes on a footing of rough stone, round the north,
 * west and east of the town and down to the river; squat stone towers at the
 * two north corners, and a stouter post every few yards.
 */
function addWall(data: MapData, set: Setter): void {
  const { north, west, east } = GLOOM_WALL;
  const along = { fence: true, shapes: [box(0, 0.36, 1, 0.64)] };
  const across = { fence: true, flipX: true, shapes: [box(0.36, 0, 0.64, 1)] };
  const post = { fence: true, shapes: [circle(0.5, 0.5, 0.22)] };
  const gate = (x: number) => x >= GLOOM_GATE.tx && x < GLOOM_GATE.tx + GLOOM_GATE.w;
  const piece = (tx: number, ty: number, flip: boolean, n: number) => {
    if (data.terrain[ty][tx] === Terrain.Water) data.terrain[ty][tx] = Terrain.Dirt;
    if (n % 7 === 6) set('gh-wallpost', tx, ty, 1, 1, post);
    else set(`gh-wall-${(tx * 5 + ty * 3) % 4}`, tx, ty, 1, 1, flip ? across : along);
  };
  for (let x = west + 2; x < east - 1; x++) if (!gate(x)) piece(x, north, false, x);
  // Down each side to the water's edge, where the last stakes stand in the mud.
  for (const x of [west, east]) {
    for (let y = north + 2; y < Math.floor(gloomBank(x)) + 1; y++) piece(x, y, true, y + (x === east ? 3 : 0));
  }
  // The corner towers.
  set('gh-walltower', west - 1, north - 1, 3, 3, { fence: true, shapes: [circle(1.5, 1.5, 1.15)] });
  set('gh-walltower', east - 1, north - 1, 3, 3, { fence: true, flipX: true, shapes: [circle(1.5, 1.5, 1.15)] });
  data.lights!.push({ gx: west + 0.5, gy: north + 0.5, z: 120, radius: 150, flicker: 0.8 });
  data.lights!.push({ gx: east + 0.5, gy: north + 0.5, z: 120, radius: 150, flicker: 0.8 });
  data.landmarks!.push({ gx: west + 3, gy: north + 3, name: 'The north-west tower', range: 3 });
}

/**
 * The gate: a timber gatehouse between two stone towers, its gates barred,
 * and the men who keep it lounging about a brazier inside: a guard hut, a
 * rack of spears, a table with dice on it, and a gibbet by the road as a
 * welcome.
 */
function addGate(data: MapData, set: Setter, slim: Slim): void {
  const g = GLOOM_GATE;
  // The gatehouse: the towers at either end block; the gates between are barred (they block too).
  set('gh-gatehouse', g.tx, g.ty, g.w, g.h, {
    fence: true,
    shapes: [box(0, 0.05, 1.6, 1.95), box(4.4, 0.05, 6, 1.95), box(1.6, 0.6, 4.4, 1.2)],
  });
  for (const dx of [1.75, 4.25]) data.lights!.push({ gx: g.tx + dx, gy: g.ty + g.h + 0.1, z: 58, radius: 170, flicker: 0.6 });
  data.sights!.push({
    id: 'gh-gate', gx: g.road.x0 + 1, gy: g.ty + g.h + 0.4, label: 'Look at the gate', z: 50,
    thought:
      'Oak, black with age, studded with iron and barred with a beam as thick as I am. Whatever is out on the causeway, ' +
      'the folk of Gloomhaven would rather it stayed there. Or maybe it is the other way about.',
  });
  data.landmarks!.push({ gx: g.road.x0 + 1, gy: g.ty + g.h + 1, name: 'The Fen Gate', range: 4 });
  // The guards' brazier, a table with a game of dice left on it, stools, a rack of spears and their hut.
  const by = g.ty + g.h + 2;
  slim('gh-brazier', g.tx + 6, by, [circle(0.5, 0.5, 0.26)]);
  data.lights!.push({ gx: g.tx + 6.5, gy: by + 0.5, z: 26, radius: 170, flicker: 1 });
  set('gh-dicetable', g.tx + 7, by + 1, 1, 1, { shapes: [box(0.12, 0.2, 0.88, 0.8)] });
  data.sights!.push({
    id: 'gh-dice', gx: g.tx + 7.5, gy: by + 2.1, label: 'Look at the table', z: 22,
    thought: "Bone dice, and a little heap of coppers. The dice are loaded: one face has been drilled and filled with lead. I wonder which of them doesn't know.",
  });
  slim('jt-stool', g.tx + 8, by + 1, [circle(0.5, 0.5, 0.16)]);
  set('gh-spearrack', g.tx - 1, by - 1, 1, 1, { shapes: [box(0.1, 0.3, 0.9, 0.7)] });
  set('gh-guardhut', g.tx + 7, g.ty + 2, 3, 2);
  data.chimneys!.push({ gx: g.tx + 7.6, gy: g.ty + 2.6, z: 76 });
  // The gibbet beside the road, its cage empty but for a few crows.
  set('gh-gibbet', g.tx - 2, by + 2, 1, 1, { shapes: [circle(0.3, 0.5, 0.14)] });
  data.crows!.push({ gx: g.tx - 2.5, gy: by + 3.4 }, { gx: g.tx - 1.2, gy: by + 2.8 });
  data.sights!.push({
    id: 'gh-gibbet', gx: g.tx - 1.5, gy: by + 3, label: 'Look at the gibbet', z: 60,
    thought: 'An iron cage on a post, empty now, swinging a little in the wind. A board nailed under it says TOLD TALES. Someone has scratched NO under that, and someone else a lot of crosses.',
  });
  // Outside, the causeway runs off north over the fen. Nobody's going out that way yet.
  data.musings!.push({
    x0: g.road.x0 - 1, y0: g.ty + g.h, x1: g.road.x1 + 2, y1: g.ty + g.h + 2,
    text: "The causeway runs off north across the fen from here, they say, to roads nobody in Adowvale has ever walked. The gate stays shut, and the men on it don't look like they open it for asking.",
  });
}

/** The square: the little well in the middle, a horse trough, the stocks, a notice board, lamps on crooked posts, and a broken cart. */
function addSquare(data: MapData, set: Setter, slim: Slim): void {
  const w = GLOOM_WELL;
  set('gh-well', w.tx, w.ty, 1, 1, { shapes: [circle(0.5, 0.5, 0.4)] });
  data.sights!.push({
    id: 'gh-well', gx: w.tx + 0.5, gy: w.ty + 1.2, label: 'Look into the well', z: 30,
    thought:
      "A long way down, and it smells of iron and something dead. Someone has chalked on the stones: DON'T. Under it, in a different hand: DIDN'T.",
  });
  data.landmarks!.push({ gx: w.tx + 0.5, gy: w.ty + 0.5, name: 'The town square', range: 7 });
  // Lamps round the square: few, and not all lit.
  for (const [tx, ty] of [[21, 20], [35, 20], [23, 29], [39, 28], [34, 25]]) {
    slim('gh-lamp', tx, ty, [circle(0.5, 0.5, 0.14)]);
    data.lights!.push({ gx: tx + 0.5, gy: ty + 0.5, z: 52, radius: 165, flicker: 0.6 });
  }
  // The stocks, with a lad in them some days; empty today, with a rotten cabbage on the ground before them.
  set('gh-stocks', 25, 27, 2, 1, { shapes: [box(0.1, 0.3, 1.9, 0.7)] });
  data.sights!.push({
    id: 'gh-stocks', gx: 26, gy: 28.2, label: 'Look at the stocks', z: 30,
    thought: 'The wood round the holes is worn smooth and dark. Somebody carved a little rose in the post, and the words SHE SEES.',
  });
  // The notice board by the Black Rose's corner: bounties, debts, and warnings.
  set('gh-noticeboard', 22, 19, 1, 1, { shapes: [circle(0.25, 0.5, 0.1), circle(0.75, 0.5, 0.1)] });
  data.sights!.push({
    id: 'gh-notices', gx: 22.5, gy: 20.2, label: 'Read the notices', z: 50,
    sign: {
      heading: 'Notices',
      lines: [
        'OWING: Tam Rudd, 3 silver, to the Rose. Pay or swim.',
        'LOST: a grey dog, answers to nothing. Bites.',
        'Boatmen to the Staithe by curfew. Lights on the river after dark will be SHOT AT.',
        'The Fen Gate opens by leave of Captain Vosk only.',
        '(Pinned with a knife:) WHO TOOK MY BOOTS',
      ],
    },
  });
  // A water trough, a cart with a broken wheel, barrels and crates waiting outside the Rose.
  set('gh-trough', 35, 22, 1, 1, { shapes: [box(0.1, 0.25, 0.9, 0.75)] });
  set('gh-brokencart', 37, 25, 2, 2, { shapes: [box(0.2, 0.3, 1.8, 1.6)] });
  set('furn-barrels', 23, 18, 1, 1, { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  set('mkt-crates', 34, 18, 1, 1, { shapes: [box(0.1, 0.15, 0.95, 0.95)] });
  set('mkt-sacks', 33, 19, 1, 1, { shapes: [circle(0.45, 0.4, 0.3), circle(0.45, 0.7, 0.18)] });
  // A bench by the well, where Gutter Jack sleeps it off.
  slim('gh-bench', 27, 25, [box(0.08, 0.55, 0.92, 0.85)]);
  data.seats!.push({ name: 'gh-well-bench', gx: 27.5, gy: 25.62, faceX: 0, faceY: 1, standX: 27.5, standY: 26.5 });
  // The square's own crows, picking about the mud.
  data.crows!.push({ gx: 32.5, gy: 28.5 }, { gx: 24, gy: 23 });
}

/**
 * The Black Rose: two storeys of black timber over soot-streaked plaster, a
 * steep slate roof with three chimneys, a gallery over the door, leaded windows
 * lit red and gold, and a black rose on its sign. The only building in the
 * town anyone paints. Its door is the way in to the tavern itself (the
 * 'blackrose' area, in world/BlackRoseMap.ts).
 */
function addBlackRose(data: MapData, set: Setter, slim: Slim): void {
  const r = BLACK_ROSE;
  set('gh-blackrose', r.tx, r.ty, r.w, r.h);
  for (const [gx, gy, z] of [[1.6, 2.2, 214], [5.2, 2.2, 224], [8.6, 2.4, 206]]) data.chimneys!.push({ gx: r.tx + gx, gy: r.ty + gy, z });
  data.entries!.blackrose = { x: r.door.tx + 0.5, y: r.door.ty + 0.7 };
  // The way in to the taproom (world/BlackRoseMap.ts).
  data.doors!.push({ tx: r.door.tx, ty: r.door.ty, to: 'blackrose', entry: 'door', label: 'Go inside', facing: 'back' });
  data.landmarks!.push({ gx: r.door.tx + 0.5, gy: r.door.ty + 0.5, name: 'The Black Rose', range: 3.5 });
  // Lanterns either side of the door, and the glow of the windows on the mud.
  for (const dx of [-1.4, 1.4]) data.lights!.push({ gx: r.door.tx + 0.5 + dx, gy: r.door.ty + 0.05, z: 46, radius: 130, flicker: 0.5 });
  for (const gx of [2.5, 7.5]) data.lights!.push({ gx: r.tx + gx, gy: r.ty + r.h + 0.1, z: 24, radius: 90, flicker: 0.3 });
  // A hitching rail and a mounting block out front; a drunk's bucket by the corner.
  slim('gh-hitchrail', r.tx + 1, r.ty + r.h, [box(0.05, 0.4, 0.95, 0.6)]);
  slim('gh-hitchrail', r.tx + 7, r.ty + r.h, [box(0.05, 0.4, 0.95, 0.6)]);
  // Round the back: the yard, its barrels, a rain butt and the midden.
  set('furn-barrels', r.tx + r.w, r.ty + 1, 1, 1, { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  set('gh-waterbutt', r.tx + r.w, r.ty + 3, 1, 1, { shapes: [circle(0.5, 0.5, 0.32)] });
  set('gh-midden', r.tx + 3, r.ty - 2, 2, 1, { shapes: [box(0.1, 0.1, 1.9, 0.9)] });
  data.sights!.push({
    id: 'gh-rose-sign', gx: r.tx + 1.2, gy: r.ty + r.h + 0.4, label: 'Look at the sign', z: 90,
    thought: 'THE BLACK ROSE, in gold that has gone green, over a rose painted black on black. You only see it when the lamp swings.',
  });
}

/**
 * The shops round the square: Ossery's Remedies and Tallow's Chandlery on the
 * west side, facing in across it, and Lusk's on the north-east corner by the
 * gate road. Each keeper serves from a counter in their shopfront, under a
 * hanging sign.
 */
function addShops(data: MapData, set: Setter, slim: Slim): void {
  // Ossery's: a narrow, leaning house hung with drying herbs and jars, a pestle on its sign. Front onto the square (+x).
  set('gh-apothecary', 16, 20, 3, 4, { flipX: true });
  data.chimneys!.push({ gx: 16.7, gy: 21.4, z: 150 });
  data.lights!.push({ gx: 19.1, gy: 22, z: 40, radius: 100, flicker: 0.5 });
  data.landmarks!.push({ gx: 19.5, gy: 22, name: "Ossery's Remedies", range: 2.6 });
  set('gh-herbtable', 19, 20, 1, 1, { shapes: [box(0.15, 0.1, 0.85, 0.9)] });
  data.sights!.push({
    id: 'gh-leeches', gx: 19.9, gy: 20.5, label: 'Look at the jars', z: 26,
    thought: 'Jars of leeches, black and fat, pressed up against the glass as if they can smell me. One of them is labelled GOOD BOY.',
  });

  // Tallow's: a squat, tarred place with candles in every window, coils of rope and lanterns hung out front.
  set('gh-chandler', 16, 25, 3, 4, { flipX: true });
  data.chimneys!.push({ gx: 16.7, gy: 26.4, z: 132 });
  data.lights!.push({ gx: 19.1, gy: 27, z: 40, radius: 110, flicker: 0.5 });
  data.landmarks!.push({ gx: 19.5, gy: 27, name: "Tallow's Chandlery", range: 2.6 });
  set('gh-ropecoils', 19, 28, 1, 1, { shapes: [circle(0.5, 0.5, 0.34)] });
  set('furn-barrels', 19, 25, 1, 1, { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });

  // Lusk's: tall and thin, three storeys of black boards, iron bars on every window, three brass balls on the sign.
  set('gh-pawn', 42, 15, 4, 3);
  data.chimneys!.push({ gx: 42.6, gy: 15.5, z: 178 });
  data.lights!.push({ gx: 44, gy: 18.1, z: 40, radius: 100, flicker: 0.4 });
  data.landmarks!.push({ gx: 44, gy: 18.5, name: "Lusk's", range: 2.6 });
  slim('gh-pawnjunk', 46, 17, [circle(0.4, 0.5, 0.3)]);
  data.sights!.push({
    id: 'gh-pawnjunk', gx: 46.5, gy: 18, label: 'Look at the junk', z: 20,
    thought: "A birdcage, a child's sword, three left boots, a christening cup with the name filed off. Everything here belonged to somebody once.",
  });
}

/**
 * The houses: black, sagging, patched with boards and tarpaulin, some up on
 * stilts over the pools and the mud, one burnt out, a few no more than hovels
 * leaning on each other. Smoke from about half their chimneys.
 */
function addHouses(data: MapData, set: Setter, slim: Slim): void {
  // [key, tx, ty, flip, chimney]
  const houses: Array<[string, number, number, boolean, boolean]> = [
    // The north-west quarter, behind the shops.
    ['gh-house-0', 6, 7, false, true],
    ['gh-house-1', 14, 6, false, true],
    ['gh-house-2', 5, 12, true, false],
    ['gh-house-3', 15, 13, false, true],
    ['gh-shack-0', 9, 15, false, false],
    // The west quarter, down to the water.
    ['gh-house-4', 5, 24, false, true],
    ['gh-stilthouse', 9, 33, false, true],
    ['gh-house-1', 5, 31, true, true],
    ['gh-ruin', 16, 34, false, false],
    ['gh-shack-1', 20, 37, false, true],
    ['gh-house-0', 5, 37, false, false],
    // Along the lane down to the pier.
    ['gh-house-5', 25, 33, false, true],
    ['gh-house-2', 32, 33, false, true],
    ['gh-shack-0', 25, 38, false, false],
    ['gh-house-3', 33, 38, true, true],
    // The east quarter: backs to the square, and on round to the wall.
    ['gh-house-4', 42, 20, true, true],
    ['gh-house-0', 47, 13, false, true],
    ['gh-house-5', 52, 15, true, false],
    ['gh-stilthouse', 51, 20, false, false],
    ['gh-house-1', 43, 31, false, true],
    ['gh-house-3', 49, 32, false, false],
    ['gh-shack-1', 52, 36, true, true],
    ['gh-house-2', 38, 33, false, false],
    ['gh-shack-0', 40, 38, true, false],
    // Up by the gate road, opposite Lusk's.
    ['gh-house-5', 30, 6, false, true],
    ['gh-shack-1', 25, 6, false, false],
    ['gh-house-4', 44, 7, false, true],
  ];
  for (const [key, tx, ty, flip, smokes] of houses) {
    const size = key.startsWith('gh-shack') ? 2 : 3;
    for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) if (data.terrain[y][x] === Terrain.Water && key !== 'gh-stilthouse') data.terrain[y][x] = Terrain.Dirt;
    set(key, tx, ty, size, size, { flipX: flip, ...(key === 'gh-stilthouse' ? { shapes: [circle(0.3, 0.3, 0.12), circle(2.7, 0.3, 0.12), circle(0.3, 2.7, 0.12), circle(2.7, 2.7, 0.12)] } : {}) });
    if (smokes) data.chimneys!.push({ gx: tx + (flip ? 0.72 : 0.62), gy: ty + (flip ? 0.62 : 0.72), z: size === 2 ? 92 : 128 });
    // A candle in the window of about every other house, after dark.
    if (smokes) data.lights!.push({ gx: tx + (flip ? size + 0.05 : size * 0.72), gy: ty + (flip ? size * 0.72 : size + 0.05), z: 30, radius: 70, flicker: 0.4 });
  }
  data.chimneys!.push({ gx: 17.4, gy: 35.3, z: 40, ruin: true });
  data.sights!.push({
    id: 'gh-ruin', gx: 17.5, gy: 37.3, label: 'Look at the house', z: 30,
    thought: "Burnt out, and not long ago: the ash is still wet. There's a rose chalked on what's left of the door, and the chalk isn't burnt.",
  });
  data.landmarks!.push({ gx: 17.5, gy: 36, name: 'The burnt house', range: 3 });
  // Washing that will never dry, a rain butt or two, a goat's tether, firewood stacks, rubbish.
  set('mkt-washing', 8, 10, 1, 3, { blocks: [[0, 0], [0, 2]], shapes: [circle(0.5, 0.2, 0.08), circle(0.5, 2.8, 0.08)] });
  set('mkt-washing', 46, 33, 1, 3, { blocks: [[0, 0], [0, 2]], shapes: [circle(0.5, 0.2, 0.08), circle(0.5, 2.8, 0.08)] });
  set('gh-waterbutt', 8, 27, 1, 1, { shapes: [circle(0.5, 0.5, 0.32)] });
  set('gh-waterbutt', 47, 16, 1, 1, { shapes: [circle(0.5, 0.5, 0.32)] });
  set('gh-woodpile', 18, 9, 1, 1, { shapes: [box(0.1, 0.2, 0.9, 0.8)] });
  set('gh-woodpile', 36, 36, 1, 1, { shapes: [box(0.1, 0.2, 0.9, 0.8)] });
  set('gh-rubbish', 22, 35, 1, 1, { shapes: [circle(0.5, 0.5, 0.3)] });
  set('gh-rubbish', 50, 27, 1, 1, { shapes: [circle(0.5, 0.5, 0.3)] });
  set('gh-rubbish', 11, 16, 1, 1, { shapes: [circle(0.5, 0.5, 0.3)] });
  // Lamps down the lanes, at the corners where a cutpurse might wait.
  for (const [tx, ty] of [[14, 30], [29, 38], [46, 30], [12, 13], [40, 9]]) {
    slim('gh-lamp', tx, ty, [circle(0.5, 0.5, 0.14)]);
    data.lights!.push({ gx: tx + 0.5, gy: ty + 0.5, z: 52, radius: 165, flicker: 0.6 });
  }
  data.landmarks!.push(
    { gx: 9, gy: 12, name: 'Rookery Row', range: 5 },
    { gx: 9, gy: 32, name: 'Sump Lane', range: 5 },
    { gx: 48, gy: 30, name: 'The Shambles', range: 5 },
    { gx: 30, gy: 37, name: 'Pier Lane', range: 3.5 },
  );
}

/**
 * The Staithe, the town's waterfront: duckboards along the mud, pilings
 * and mooring posts, a fishing shed on stilts, eel traps and nets, a barge
 * tied up and rotting, rowing boats, and the pier out into the stream, where
 * the boat from Adowvale will put in.
 */
function addStaithe(data: MapData, set: Setter, slim: Slim): void {
  const p = GLOOM_PIER;
  // The pier: planking on piles out over the water, with a cross-head at the end.
  const tiles: Array<[number, number]> = [];
  for (let y = p.fromY; y < p.headY; y++) for (let x = p.x0; x <= p.x1; x++) tiles.push([x, y]);
  for (let y = p.headY; y < p.headY + 2; y++) for (let x = p.headX0; x <= p.headX1; x++) tiles.push([x, y]);
  const isDeck = (x: number, y: number) => tiles.some(([dx, dy]) => dx === x && dy === y);
  for (const [tx, ty] of tiles) {
    if (data.terrain[ty][tx] !== Terrain.Water) {
      placeObject(data, { key: 'gh-boards-x', tx, ty, w: 1, h: 1, flat: true });
      continue;
    }
    data.decks!.push([tx, ty]);
    const open = { n: !isDeck(tx, ty - 1) && data.terrain[ty - 1][tx] === Terrain.Water, e: !isDeck(tx + 1, ty), s: !isDeck(tx, ty + 1), w: !isDeck(tx - 1, ty) };
    placeObject(data, { key: deckKey(open), tx, ty, w: 1, h: 1, flat: true });
  }
  for (const [tx, ty, sx, sy] of [[p.x0, p.fromY + 4, 0.14, 0.5], [p.headX0, p.headY + 1, 0.2, 0.8], [p.headX1, p.headY + 1, 0.8, 0.8]] as const) {
    slim(sx < 0.5 ? 'jt-pierlamp-w' : 'jt-pierlamp-e', tx, ty, [circle(sx, sy, 0.1)]);
    data.lights!.push({ gx: tx + sx, gy: ty + sy, z: 44, radius: 120, flicker: 0.5 });
  }
  for (const [tx, ty, sx] of [[p.x0, p.fromY + 2, 0.16], [p.x1, p.fromY + 6, 0.84], [p.headX0 + 1, p.headY, 0.5], [p.headX1 - 1, p.headY, 0.5]] as const) slim('jt-bollard', tx, ty, [circle(sx, 0.5, 0.13)]);
  slim('jt-ropecoil', p.x1, p.fromY + 3, [circle(0.6, 0.5, 0.22)]);
  slim('jt-creels', p.headX0 + 2, p.headY + 1, [box(0.12, 0.12, 0.9, 0.9)]);
  data.landmarks!.push({ gx: p.x1, gy: p.headY, name: 'The pier', range: 4 });
  data.musings!.push({
    x0: p.headX0, y0: p.headY, x1: p.headX1 + 1, y1: p.headY + 2,
    text: 'The river is slow and brown here, and smells of rot. Upstream, round the bend and days away, is Adowvale. It feels further.',
  });
  data.sights!.push({
    id: 'gh-pier-sign', gx: p.x0 - 0.2, gy: p.fromY - 0.6, label: 'Read the board', z: 46,
    sign: {
      heading: 'Gloomhaven Staithe',
      lines: [
        'Mooring: two coppers the night, paid to the Rose.',
        'No boat leaves after curfew. No boat leaves before it without leave.',
        'Cargo is searched. Complaints to Captain Vosk.',
        '↑  The square, and the Black Rose',
      ],
    },
  });
  set('jt-signboard', p.x0 - 1, p.fromY - 1, 1, 1, { shapes: [circle(0.25, 0.5, 0.1), circle(0.75, 0.5, 0.1)] });

  // A barge tied up along the bank west of the pier, low in the water and going green; rowing boats about.
  set('gh-barge', 19, Math.ceil(gloomBank(21)) + 1, 6, 2, { bob: 1 });
  data.sights!.push({
    id: 'gh-barge', gx: 22, gy: Math.ceil(gloomBank(22)) - 0.2, label: 'Look at the barge', z: 26,
    thought: "A river barge, flat and broad, with a hold full of rainwater. MAGGIE MAE on her bow. Nobody's sailed her in years, but somebody still pays her mooring.",
  });
  set('jt-rowboat-2', p.x0 - 2, p.fromY + 3, 1, 2, { bob: 1 });
  set('jt-rowboat-0', p.headX1 + 1, p.headY - 2, 1, 2, { bob: 1 });
  set('jt-rowboat-beached', 37, Math.floor(gloomBank(37)) - 2, 1, 2);
  // Duckboards along the Staithe, over the worst of the mud.
  for (let x = 7; x < 53; x++) {
    if (x >= p.x0 - 1 && x <= p.x1 + 1) continue;
    const y = 43;
    if (data.props[y][x] !== Prop.None || data.terrain[y][x] === Terrain.Water) continue;
    if (x % 9 === 4) continue; // a missing board or two
    placeObject(data, { key: `gh-boards-x${x % 3 === 0 ? '-broken' : ''}`, tx: x, ty: y, w: 1, h: 1, flat: true });
  }
  // The fishing shed on stilts at the water's edge, nets out to dry, eel traps, a smoking fire.
  set('gh-fishshed', 9, Math.floor(gloomBank(10)) - 3, 3, 3);
  set('jt-netrack', 13, 41, 2, 1, { shapes: [circle(0.12, 0.5, 0.1), circle(1.88, 0.5, 0.1)] });
  set('jt-eeltraps', 15, 44, 1, 1, { shapes: [box(0.1, 0.15, 0.9, 0.9)] });
  set('jt-eeltraps', 42, 44, 1, 1, { shapes: [box(0.1, 0.15, 0.9, 0.9)] });
  set('jt-creels', 26, 42, 1, 1, { shapes: [box(0.12, 0.12, 0.9, 0.9)] });
  set('furn-barrels', 33, 42, 1, 1, { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  set('gh-crane', 35, 44, 1, 1, { shapes: [circle(0.5, 0.5, 0.3)], fades: true });
  data.landmarks!.push({ gx: 20, gy: 44, name: 'The Staithe', range: 9 });
  // Pilings standing in the shallows, where an older pier once was.
  for (const [tx, oy] of [[39, 1], [40, 2], [41, 1], [43, 2], [44, 1]]) {
    const ty = Math.ceil(gloomBank(tx)) + oy;
    if (data.terrain[ty]?.[tx] === Terrain.Water) set('gh-piling', tx, ty, 1, 1, { blocks: [], shapes: [circle(0.5, 0.5, 0.12)] });
  }
  for (const [tx, ty] of [[24, 43], [41, 43], [14, 43]]) {
    slim('gh-lamp', tx, ty - 1, [circle(0.5, 0.5, 0.14)]);
    data.lights!.push({ gx: tx + 0.5, gy: ty - 0.5, z: 52, radius: 120, flicker: 0.6 });
  }
}

/**
 * The marsh in and around the town: rushes and reeds round every pool and
 * along both banks, lilies and scum on the still water, dead trees, stumps,
 * puddles and mud, and boards laid across the worst of it.
 */
function addMarsh(data: MapData, rnd: Phaser.Math.RandomDataGenerator, set: Setter, slim: Slim): void {
  const { terrain, props } = data;
  const W = data.width;
  const H = data.height;
  const isWater = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && terrain[y][x] === Terrain.Water;
  const deck = (x: number, y: number) => (data.decks ?? []).some(([dx, dy]) => Math.abs(dx - x) <= 1 && Math.abs(dy - y) <= 1);
  const free = (x: number, y: number) => props[y][x] === Prop.None && !deck(x, y) && !(data.objects ?? []).some((o) => x >= o.tx - 1 && x <= o.tx + o.w && y >= o.ty - 1 && y <= o.ty + o.h);

  // Boardwalks across the pools in the way of a lane.
  const walkway = (x0: number, x1: number, y: number) => {
    for (let x = x0; x <= x1; x++) {
      if (isWater(x, y)) {
        data.decks!.push([x, y]);
        placeObject(data, { key: 'gh-boards-x-deck', tx: x, ty: y, w: 1, h: 1, flat: true });
      } else placeObject(data, { key: 'gh-boards-x', tx: x, ty: y, w: 1, h: 1, flat: true });
    }
  };
  const walkwayY = (x: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y++) {
      if (isWater(x, y)) {
        data.decks!.push([x, y]);
        placeObject(data, { key: 'gh-boards-y-deck', tx: x, ty: y, w: 1, h: 1, flat: true });
      } else placeObject(data, { key: 'gh-boards-y', tx: x, ty: y, w: 1, h: 1, flat: true });
    }
  };
  walkway(9, 15, 36); // across the Sump
  walkwayY(12, 33, 39);
  walkway(4, 12, 20); // across the west pool, Rookery Row to the wall
  walkwayY(49, 20, 25); // past the stilt house in the east
  walkway(42, 49, 37);

  // Reeds and rushes round the water's edge: thick round the pools and along the far bank, sparse at the Staithe.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!isWater(x, y) || !free(x, y)) continue;
      const shore = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => !isWater(x + dx, y + dy));
      if (!shore) continue;
      const nearBank = y < 50 && y > 40;
      const chance = nearBank ? (x < 8 || x > 50 ? 0.7 : 0.2) : 0.75;
      const clump = Math.sin(x * 0.7 + y * 1.3) + Math.sin(x * 0.31 - y * 0.5);
      if (clump > -0.6 && rnd.frac() < chance) set(`jt-reeds-${rnd.between(0, 2)}`, x, y, 1, 1, { flipX: rnd.frac() < 0.5 });
    }
  }
  // Lilies and scum on the still water.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!isWater(x, y) || props[y][x] !== Prop.None || deck(x, y)) continue;
      const pool = y < 44 || y > 54;
      if (rnd.frac() < (pool ? 0.16 : 0.03)) placeObject(data, { key: rnd.frac() < 0.45 ? `jt-lilies-${(x + y) % 2}` : `gh-scum-${(x * 3 + y) % 3}`, tx: x, ty: y, w: 1, h: 1, blocks: [], flat: true });
    }
  }
  // Rushes and sedge on the wet ground, puddles and mud on the lanes.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!free(x, y)) continue;
      const t = terrain[y][x];
      const r = rnd.frac();
      if (t === Terrain.Dirt && r < 0.14) placeObject(data, { key: `gh-puddle-${rnd.between(0, 2)}`, tx: x, ty: y, w: 1, h: 1, flat: true });
      else if (t === Terrain.Dirt && r < 0.26) placeObject(data, { key: `gh-mud-${rnd.between(0, 2)}`, tx: x, ty: y, w: 1, h: 1, flat: true });
      else if (t === Terrain.Stone && r < 0.1) placeObject(data, { key: `gh-puddle-${rnd.between(0, 2)}`, tx: x, ty: y, w: 1, h: 1, flat: true });
      else if (t === Terrain.Grass) {
        const wetNear = [[0, -1], [0, 1], [-1, 0], [1, 0], [1, 1], [-1, -1]].some(([dx, dy]) => isWater(x + dx, y + dy));
        if (r < (wetNear ? 0.4 : 0.07)) slim(`gh-rushes-${rnd.between(0, 2)}`, x, y, [], { flipX: rnd.frac() < 0.5 });
        else if (r < (wetNear ? 0.46 : 0.1)) placeObject(data, { key: `gh-mud-${rnd.between(0, 2)}`, tx: x, ty: y, w: 1, h: 1, flat: true });
      }
    }
  }
  // Dead trees: in the town where there's room, thick out past the north wall and over on the far bank.
  const inTown = (x: number, y: number) => x > GLOOM_WALL.west && x < GLOOM_WALL.east && y > GLOOM_WALL.north && y < 42;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!free(x, y) || isWater(x, y)) continue;
      const roll = rnd.frac();
      const eyot = Math.hypot((x + 0.5 - EYOT.x) / EYOT.rx, (y + 0.5 - EYOT.y) / EYOT.ry) < 0.8;
      const outside = y < GLOOM_WALL.north - 1 || y > farBank(x) + 1 || eyot;
      const town = inTown(x, y) && terrain[y][x] === Terrain.Grass;
      const edge = x < 2 || x > W - 3;
      const chance = outside ? (Math.abs(x - 37.5) < 3 ? 0 : 0.2) : edge ? 0.12 : town ? 0.035 : 0;
      if (roll < chance) set(`gh-deadtree-${rnd.between(0, 3)}`, x, y, 1, 1, { shapes: [circle(0.5, 0.5, 0.18)], flipX: rnd.frac() < 0.5, fades: true });
      else if (roll < chance * 1.6) slim('gh-stump', x, y, [circle(0.5, 0.5, 0.2)]);
    }
  }
  // Will-o'-the-wisp: a cold light out over the far bank some nights.
  data.lights!.push({ gx: 14, gy: 82, z: 12, radius: 60, flicker: 0.9 });
  data.landmarks!.push({ gx: EYOT.x, gy: EYOT.y, name: 'Heron Eyot', range: 5 });
  data.musings!.push({
    x0: 3, y0: 17, x1: 14, y1: 23,
    text: 'The boards are slick and they give underfoot. The water either side is black and still, and it is not as shallow as it looks.',
  });
}

/**
 * Who's about: the heavies and guards on the Fen Gate, the three shopkeepers
 * at their counters, Gutter Jack by the well, Wisp the cutpurse about the
 * square, and Cray, who rows folk about for a price, at the end of the pier.
 */
function addFolk(data: MapData): void {
  const g = GLOOM_GATE;
  const by = g.ty + g.h;
  data.npcs!.push(
    // Captain Vosk, who runs the gate (and takes the tolls), in front of it.
    { id: 'vosk', gx: g.road.x0 + 1, gy: by + 1.6, looking: { x: 0, y: 1 } },
    // Brakk, the biggest of them, leaning on his maul by the brazier.
    { id: 'brakk', gx: g.tx + 6.5, gy: by + 1.6, looking: { x: -0.6, y: 1 } },
    // Fitch, with his bow, on the west side of the road; Old Crabbe with his hatchets, by the hut.
    { id: 'fitch', gx: g.tx + 0.4, gy: by + 1.2, looking: { x: 0.6, y: 1 } },
    { id: 'crabbe', gx: g.tx + 8.5, gy: by + 1.9, looking: { x: -1, y: 0.4 } },
    // The keepers at their counters (Ossery and Tallow face the square across theirs).
    { id: 'ossery', gx: 19.65, gy: 22.4, looking: { x: 1, y: 0 }, hours: [7, 22] },
    { id: 'tallow', gx: 19.65, gy: 26.8, looking: { x: 1, y: 0.2 }, hours: [6, 21] },
    { id: 'lusk', gx: 44.2, gy: 18.65, looking: { x: 0, y: 1 }, hours: [9, 26] },
    // About the square.
    { id: 'gutter', gx: 27.5, gy: 25.62, looking: { x: 0, y: 1 }, seated: true },
    { id: 'wisp', gx: 32.5, gy: 27.5 },
    // Cray, at the end of the pier, by his boat.
    { id: 'cray', gx: GLOOM_PIER.headX1 - 1.4, gy: GLOOM_PIER.headY + 0.5, looking: { x: 0.4, y: 1 } },
  );
}
