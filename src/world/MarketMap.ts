import Phaser from 'phaser';
import { TOWNHOUSE_CHIMNEY } from '../art/market';
import { box, circle, Shape } from './Collision';
import { MapData, MapObject, placeObject, Prop, Terrain } from './MapData';

export const MARKET_W = 34;
export const MARKET_H = 30;

/** The road comes in from the east edge along these two rows. */
const ROAD_ROWS = [17, 18];

/** Where each stall stands (its back corner), which way it faces, and who keeps it. */
const STALLS: Array<{ kind: 'baker' | 'smith' | 'tanner'; tx: number; ty: number; facing: 'y' | 'x' }> = [
  { kind: 'baker', tx: 10, ty: 8, facing: 'y' },
  { kind: 'smith', tx: 16, ty: 8, facing: 'y' },
  { kind: 'tanner', tx: 7, ty: 13, facing: 'x' },
];

/**
 * The market at Eldermoor, at the far end of the road from the cottage: a
 * bare-earth square with the well in the middle, three traders' stalls, tall
 * townhouses and an inn around it, lamp posts that light up at night, and the
 * village militia walking their rounds. The road leaves by the east edge,
 * back towards home.
 */
export function buildMarketMap(): MapData {
  const W = MARKET_W;
  const H = MARKET_H;
  const rnd = new Phaser.Math.RandomDataGenerator(['eldermoor-market']);
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Grass));
    props.push(new Array(W).fill(Prop.None));
  }

  // The square: earth trodden bare by feet and carts, fading into worn grass at the edges, with a
  // few flagstones laid round the well.
  for (let y = 5; y <= 22; y++) {
    for (let x = 5; x <= 24; x++) {
      const edge = Math.min(x - 5, 24 - x, y - 5, 22 - y);
      const bare = edge >= 3 ? 1 : edge === 2 ? 0.8 : edge === 1 ? 0.5 : 0.25;
      if (rnd.frac() < bare) terrain[y][x] = Terrain.Dirt;
      if (Math.hypot(x + 0.5 - 15, y + 0.5 - 14) < 2.3) terrain[y][x] = Terrain.Stone;
    }
  }
  // The road in from the east, worn into the grass.
  for (let x = 23; x < W; x++) for (const y of ROAD_ROWS) terrain[y][x] = Terrain.Dirt;
  for (let x = 25; x < W; x += 1) if (rnd.frac() < 0.4) terrain[ROAD_ROWS[0] - 1][x] = Terrain.Dirt;

  // Trees thick around the edges, a few dotted about the meadow east of town.
  const inTown = (x: number, y: number) => x >= 1 && x <= 26 && y >= 1 && y <= 27;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (terrain[y][x] !== Terrain.Grass) continue;
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      const nearRoad = Math.abs(y - 17.5) < 3 && x > 22;
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
      ask: 'Do you want to make the trek home to Adowvale Hollow?',
    })),
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
    const c = TOWNHOUSE_CHIMNEY;
    // Mirroring the art swaps x and y on the grid.
    data.chimneys!.push({ gx: tx + (flipX ? c.gy : c.gx), gy: ty + (flipX ? c.gx : c.gy), z: c.z });
  };
  house('bld-house-red', 5, 1);
  house('bld-inn', 9, 1);
  house('bld-house-slate', 14, 1);
  house('bld-house-red', 19, 2);
  house('bld-house-slate', 1, 6, true);
  house('bld-house-ochre', 1, 16, true);
  house('bld-house-slate-back', 8, 24);
  house('bld-house-red-back', 13, 24);
  house('bld-house-ochre-back', 19, 24);

  // The well in the middle of the square.
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
    data.npcs!.push({ id: s.kind, gx: s.tx + keeper.x, gy: s.ty + keeper.y });
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
  placeObject(data, { key: 'furn-barrels', tx: 13, ty: 8, w: 1, h: 1, shapes: [circle(0.35, 0.35, 0.3), circle(0.55, 0.8, 0.2)] });
  placeObject(data, { key: 'mkt-crates', tx: 18, ty: 8, w: 1, h: 1, shapes: [box(0.1, 0.15, 0.95, 0.95)] });
  placeObject(data, { key: 'furn-barrels', tx: 7, ty: 11, w: 1, h: 1, shapes: [circle(0.35, 0.35, 0.3), circle(0.55, 0.8, 0.2)] });
  placeObject(data, { key: 'mkt-crates', tx: 24, ty: 14, w: 1, h: 1, shapes: [box(0.1, 0.15, 0.95, 0.95)] });

  // The militia, each walking their own patch of the square.
  data.npcs!.push(
    { id: 'guard-1', gx: 11.5, gy: 15.5 },
    { id: 'guard-2', gx: 19.5, gy: 12.5 },
    { id: 'guard-3', gx: 17.5, gy: 20.5 },
    { id: 'guard-4', gx: 25.5, gy: 16.5 },
  );
  return data;
}
