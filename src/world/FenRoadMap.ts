import Phaser from 'phaser';
import { box, circle } from './Collision';
import { MapData, MapObject, placeObject, Prop, Terrain } from './MapData';
import { joinDiagonals, paintPath, smoothLine } from './MapGenerator';
import { DROWNED_MILE, FEN_H, FEN_SUNK, FEN_TRACKS, FEN_W, FEN_WATCHER, FEN_WRECK, fenRoadX, gatehouseShape } from './landmarks';

/**
 * The Fen Road: Marrable's old causeway, out of Gloomhaven's Fen Gate and
 * north over the bog towards the Saltway, four miles of it, half of it sunk.
 *
 * A rag-tag road: split logs laid crossways on a bank of peat, broken and
 * patched and sinking, with black water standing in the ruts. Either side of
 * it, the fen: reed beds taller than a man, bulrushes and bog cotton, pools of
 * still black water, mires, and the bog oaks leaning in over the road from
 * both sides, so it runs in a tunnel of crooked limbs and long grey beards of
 * moss. The Marrables' old iron lamps stand along it, most of them dead.
 *
 * Going north from the gate: the reed-cutter's stilt hut by its pool, the
 * Lady's shrine, the waystone, the old peat cuts (and what's in one of them),
 * and then the trees open out and the water comes up on both sides, and the
 * causeway runs low across it for the best part of a mile: the Drowned Mile.
 * Halfway along it, the wreck of the guild's last caravan, the lead wagon half
 * over into the bog. Past it the trees close in again, until the causeway goes
 * under the water altogether and there's no going on (not yet).
 *
 * Mist always (MapData.fen), thicker than in the town.
 */

type Setter = (key: string, tx: number, ty: number, w: number, h: number, more?: Partial<MapObject>) => void;

const W = FEN_W;
const H = FEN_H;

/** How wide the causeway is (its half-width, in tiles) in row y: narrower and lower over the Drowned Mile. */
function roadHalf(y: number): number {
  return y >= DROWNED_MILE.y0 && y <= DROWNED_MILE.y1 ? 1.25 : 1.6;
}

/** How wet the fen is at (x, y): above about 1, it's open water. */
function wetness(x: number, y: number): number {
  const n = Math.sin(x * 0.42 + y * 0.17) + Math.sin(x * 0.13 - y * 0.29 + 2) * 0.9 + Math.sin((x + y * 0.6) * 0.71) * 0.35;
  // The Drowned Mile is open water nearly from edge to edge; elsewhere, pools among the trees.
  const mile = y >= DROWNED_MILE.y0 - 3 && y <= DROWNED_MILE.y1 + 3 ? 1.2 - 0.12 * Math.min(Math.abs(y - DROWNED_MILE.y0 + 3), Math.abs(y - DROWNED_MILE.y1 - 3), 6) : 0;
  return n * 0.55 + mile + (y < FEN_SUNK.y1 + 6 ? 0.45 : 0);
}

export function buildFenRoadMap(): MapData {
  const rnd = new Phaser.Math.RandomDataGenerator(['fenroad']);
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Grass));
    props.push(new Array(W).fill(Prop.None));
  }
  const road = (y: number) => fenRoadX(y);
  const offRoad = (x: number, y: number) => Math.abs(x + 0.5 - road(y + 0.5)) - roadHalf(y);

  // ---- The water: pools among the trees, the open mere at the Drowned Mile, and the drowned stretch at the far end ----
  for (let y = 0; y < H - 4; y++) {
    for (let x = 0; x < W; x++) {
      if (offRoad(x, y) < 0.9) continue;
      const wet = wetness(x, y);
      if (wet > 0.72) terrain[y][x] = Terrain.Water;
      else if (wet > 0.48) terrain[y][x] = Terrain.Dirt;
    }
  }
  // ---- The causeway: a bank of peat with logs on it, the mud of it trodden wider at the gate ----
  const line = smoothLine(Array.from({ length: 17 }, (_, i) => ({ x: road(H - (i * H) / 16), y: H - (i * H) / 16 })));
  for (const p of line) {
    const r = roadHalf(p.y);
    for (let y = Math.floor(p.y - r - 1); y <= p.y + r + 1; y++) {
      for (let x = Math.floor(p.x - r - 1); x <= p.x + r + 1; x++) {
        if (y < 0 || y >= H || x < 0 || x >= W) continue;
        if ((x + 0.5 - p.x) ** 2 <= r * r && Math.abs(y + 0.5 - p.y) < 0.6) terrain[y][x] = Terrain.Dirt;
      }
    }
  }
  // Where it's gone under at the far end: open water across it, the logs showing through.
  for (let y = FEN_SUNK.y0; y < FEN_SUNK.y1; y++) for (let x = 0; x < W; x++) if (offRoad(x, y) < 1.5) terrain[y][x] = Terrain.Water;
  // A mud bank along the water's edge, here and there.
  const isWater = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && terrain[y][x] === Terrain.Water;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (terrain[y][x] !== Terrain.Grass) continue;
      const shore = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => isWater(x + dx, y + dy));
      if (shore && rnd.frac() < 0.55) terrain[y][x] = Terrain.Dirt;
    }
  }
  // Below the gate, the trodden mud of the road in to it.
  paintPath(terrain, smoothLine([{ x: road(H - 1), y: H }, { x: road(H - 6), y: H - 6 }]), () => 2.2);
  joinDiagonals(terrain, Terrain.Dirt, Terrain.Grass);

  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: { x: road(H - 6) + 0.5, y: H - 6 },
    music: 'woods',
    decor: 0.1,
    // Darker and greener than the town: the light comes down through the oaks and the mist.
    groundShade: 0x8e8e70,
    fen: 0.82,
    wilds: 'fen',
    entries: {},
    doors: [],
    sights: [],
    lights: [],
    landmarks: [],
    musings: [],
    npcs: [],
    crows: [],
    decks: [],
    waters: [{ id: 'river', gx: road(64) - 8, gy: 64, r: 10 }],
    road: line.filter((_, i) => i % 3 === 0).map((p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) })).filter((p) => p.y >= FEN_SUNK.y1 && p.y < H - 3),
  };
  const set: Setter = (key, tx, ty, w, h, more = {}) => {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (props[y]?.[x] === Prop.Tree || props[y]?.[x] === Prop.Rock) props[y][x] = Prop.None;
    placeObject(data, { key, tx, ty, w, h, ...more });
  };
  /** Something on a tile people can still walk across: it only blocks its own outline. */
  const slim = (key: string, tx: number, ty: number, shapes: ReturnType<typeof circle>[], more: Partial<MapObject> = {}) => set(key, tx, ty, 1, 1, { blocks: [], shapes, ...more });

  addGate(data, set);
  addCauseway(data, rnd);
  addReedCutter(data, set, slim);
  addWayside(data, set, slim);
  addWreck(data, set, slim);
  addFarEnd(data, set);
  addFen(data, rnd, set, slim);
  openWatchersPool(data);
  return data;
}

/**
 * The Fen Gate from the outside: the gatehouse standing open in Gloomhaven's
 * wall of black stakes along the south edge, the way back into town through it.
 */
function addGate(data: MapData, set: Setter): void {
  const gx = Math.round(fenRoadX(H - 2) - 0.5);
  const tx = gx - 2;
  const ty = H - 3;
  const shape = gatehouseShape(true);
  set('gh-gatehouse-open', tx, ty, 6, 2, { fence: true, shapes: shape.shapes, blocks: shape.blocks });
  for (const dx of [1.75, 4.25]) data.lights!.push({ gx: tx + dx, gy: ty + 2.1, z: 58, radius: 170, flicker: 0.6 });
  // The wall running off either way along the edge.
  const along = { fence: true, shapes: [box(0, 0.36, 1, 0.64)] };
  for (let x = 0; x < W; x++) {
    if (x >= tx && x < tx + 6) continue;
    if (data.terrain[H - 2][x] === Terrain.Water) data.terrain[H - 2][x] = Terrain.Dirt;
    if (x % 7 === 3) set('gh-wallpost', x, H - 2, 1, 1, { fence: true, shapes: [circle(0.5, 0.5, 0.22)] });
    else set(`gh-wall-${(x * 5) % 4}`, x, H - 2, 1, 1, along);
  }
  for (let x = 0; x < W; x++) data.terrain[H - 1][x] = Terrain.Dirt;
  // Back in through the gate: walking down the road through the arch and off the edge.
  for (const x of [gx, gx + 1]) data.doors!.push({ tx: x, ty: H - 1, to: 'gloomhaven', entry: 'fenroad', auto: true });
  data.entries!.gate = { x: gx + 1, y: H - 5.2 };
  data.landmarks!.push({ gx: gx + 1, gy: H - 3, name: 'The Fen Gate', range: 4 });
  data.sights!.push({
    id: 'fr-gate', gx: gx + 1, gy: H - 3.6, label: 'Look back at the gate', z: 60,
    thought: 'From out here the wall of Gloomhaven looks thin: black stakes, and a fog that comes and goes through them. Vosk\'s lads have left the gate on the jar for me. I hope they remember to open it again.',
  });
  // A gibbet's worth of warning on this side too: a skull on a stake by the road.
  set('fr-skullstake', gx + 4, H - 6, 1, 1, { blocks: [], shapes: [circle(0.5, 0.5, 0.1)] });
  data.sights!.push({
    id: 'fr-skull', gx: gx + 4.5, gy: H - 5.2, label: 'Look at the stake', z: 40,
    thought: "A skull on a stake by the road, facing out across the fen. Not a man's. Long and narrow, with a ridge down it and too many teeth, all of them pointed backwards. Somebody put it here to say something, and I don't know to whom.",
  });
  data.musings!.push({
    x0: gx - 2, y0: H - 9, x1: gx + 4, y1: H - 5,
    text: 'The gate creaks to behind me. The road goes off north on its logs into the fog, and the trees lean in over it, and nothing is moving out there but the moss.',
  });
}

/**
 * The causeway's surface: the corduroy of split logs on every tile of it,
 * sound near the gate, worse further out and worst on the Drowned Mile; black
 * water standing in the hollows; and the stubs of the old marker posts.
 */
function addCauseway(data: MapData, rnd: Phaser.Math.RandomDataGenerator): void {
  const { terrain } = data;
  for (let y = 0; y < H - 2; y++) {
    for (let x = 0; x < W; x++) {
      const off = Math.abs(x + 0.5 - fenRoadX(y + 0.5)) - roadHalf(y);
      if (off > 0.15 || terrain[y][x] !== Terrain.Dirt) continue;
      const mile = y >= DROWNED_MILE.y0 && y <= DROWNED_MILE.y1;
      const far = y < DROWNED_MILE.y0;
      const r = rnd.frac();
      const worn = mile ? 0.7 : far ? 0.35 : 0.12;
      if (r < worn) placeObject(data, { key: `fr-logs-worn-${rnd.between(0, 2)}`, tx: x, ty: y, w: 1, h: 1, flat: true });
      else if (r < 0.93) placeObject(data, { key: `fr-logs-${rnd.between(0, 3)}`, tx: x, ty: y, w: 1, h: 1, flat: true });
      else placeObject(data, { key: `fr-sunk-${rnd.between(0, 1)}`, tx: x, ty: y, w: 1, h: 1, flat: true });
    }
  }
  // Along the gone-under stretch: the logs under the water, and the stubs of posts.
  for (let y = FEN_SUNK.y0; y < FEN_SUNK.y1; y++) {
    const x = Math.floor(fenRoadX(y + 0.5));
    for (const dx of [-1, 0, 1]) placeObject(data, { key: `fr-sunk-${(y + dx) & 1}`, tx: x + dx, ty: y, w: 1, h: 1, flat: true });
  }
}

/**
 * The reed-cutter's place, a little way out from the gate on the east side:
 * her hut up on stilts over a pool, a plank walk out to it, reed drying on its
 * frames, eel traps, a punt pulled up, and Gammer Teal herself about it.
 */
function addReedCutter(data: MapData, set: Setter, slim: (key: string, tx: number, ty: number, shapes: ReturnType<typeof circle>[], more?: Partial<MapObject>) => void): void {
  const y = 106;
  const rx = Math.round(fenRoadX(y + 1));
  const hx = rx + 6;
  const hy = y - 2;
  // A pool under the hut.
  for (let ty = hy - 2; ty < hy + 5; ty++) {
    for (let tx = hx - 2; tx < hx + 5; tx++) {
      const d = Math.hypot((tx + 0.5 - hx - 1.5) / 3.4, (ty + 0.5 - hy - 1.5) / 3.2);
      if (d < 1) data.terrain[ty][tx] = Terrain.Water;
      else if (d < 1.3 && data.terrain[ty][tx] === Terrain.Grass) data.terrain[ty][tx] = Terrain.Dirt;
    }
  }
  set('fr-reedhut', hx, hy, 3, 3, { shapes: [circle(0.3, 0.3, 0.12), circle(2.7, 0.3, 0.12), circle(0.3, 2.7, 0.12), circle(2.7, 2.7, 0.12)], fades: true });
  data.lights!.push({ gx: hx + 0.6, gy: hy + 3, z: 50, radius: 120, flicker: 0.6 });
  data.chimneys = [{ gx: hx + 2.3, gy: hy + 1.2, z: 98 }];
  // A plank walk from the road to the foot of her ladder.
  for (let tx = rx + 2; tx < hx + 1; tx++) {
    const ty = hy + 3;
    if (data.terrain[ty][tx] === Terrain.Water) {
      data.decks!.push([tx, ty]);
      placeObject(data, { key: 'gh-boards-x-deck', tx, ty, w: 1, h: 1, flat: true });
    } else {
      data.terrain[ty][tx] = Terrain.Dirt;
      placeObject(data, { key: 'gh-boards-x', tx, ty, w: 1, h: 1, flat: true });
    }
  }
  set('fr-reedstack', rx + 3, hy + 5, 1, 1, { shapes: [box(0.05, 0.35, 0.95, 0.95)] });
  set('fr-reedstack', rx + 5, hy + 5, 1, 1, { shapes: [box(0.05, 0.35, 0.95, 0.95)], flipX: true });
  slim('fr-eeltraps', rx + 3, hy + 1, [circle(0.4, 0.5, 0.3)]);
  slim('jt-stool', rx + 4, hy + 2, [circle(0.5, 0.5, 0.16)]);
  data.npcs!.push({ id: 'gammer', gx: rx + 3.6, gy: hy + 3.6, looking: { x: -1, y: 0.4 } });
  data.landmarks!.push({ gx: hx + 1.5, gy: hy + 1.5, name: "The reed-cutter's hut", range: 5 });
  data.sights!.push(
    { id: 'fr-reeds', gx: rx + 4, gy: hy + 6.2, label: 'Look at the reed', z: 30, thought: 'Reed cut and bundled and stood up to dry, hundreds of bundles, each tied with a twist of its own stalks. Half the roofs in Gloomhaven came from here. The other half are leaking.' },
    { id: 'fr-traps', gx: rx + 3.5, gy: hy + 2, label: 'Look at the eel traps', z: 14, thought: 'Long baskets of withy, narrowing to a mouth the eels can get in and not out. One has something in it still, moving, very slowly.' },
  );
}

/**
 * Along the road, going north: the Lady's shrine across the way from the
 * reed-cutter's, the waystone, the old lamps, and the peat cuts in the west,
 * where the cutters left more in the peat than peat.
 */
function addWayside(data: MapData, set: Setter, slim: (key: string, tx: number, ty: number, shapes: ReturnType<typeof circle>[], more?: Partial<MapObject>) => void): void {
  // The shrine, on the west verge.
  const sy = 99;
  const sx = Math.round(fenRoadX(sy) - 3.2);
  clear(data, sx, sy);
  set('fr-shrine', sx, sy, 1, 1, { shapes: [circle(0.5, 0.5, 0.2)] });
  data.lights!.push({ gx: sx + 0.5, gy: sy + 0.7, z: 10, radius: 60, flicker: 0.9 });
  data.landmarks!.push({ gx: sx + 0.5, gy: sy + 0.5, name: 'The shrine of the Lady', range: 3 });
  data.sights!.push({
    id: 'fr-shrine', gx: sx + 0.7, gy: sy + 1.3, label: 'Look at the shrine', z: 46,
    thought:
      'A post of black bog oak carved at the top into a woman\'s face, with her eyes shut. The Lady of the Mere. Rags of every colour tied round her, ' +
      'and on the stone at her foot coppers, a doll of plaited rushes, fish bones, a candle stub, still warm. Someone keeps her.',
  });
  // The waystone, on the east verge, a mile out.
  const wy = 88;
  const wx = Math.round(fenRoadX(wy) + 2.6);
  clear(data, wx, wy);
  set('fr-waystone', wx, wy, 1, 1, { shapes: [box(0.25, 0.28, 0.75, 0.68)] });
  data.landmarks!.push({ gx: wx + 0.5, gy: wy + 0.5, name: 'The waystone', range: 3 });
  data.sights!.push({
    id: 'fr-waystone', gx: wx + 0.4, gy: wy + 1.2, label: 'Read the waystone', z: 30,
    sign: {
      style: 'stone',
      heading: "Marrable's Causeway",
      lines: [
        '(Cut deep, under a bar and three waves:)',
        'THIS WAY WAS LAID BY GODWIN MARRABLE',
        'AND THE MERCHANTS OF THE CAUSEWAY',
        'FOR ALL WHO GO IN PEACE',
        'GLOOMHAVEN I',
        'THE SALTWAY IIII',
        '(And scratched under it, much later, with a knife: GO BACK)',
      ],
    },
  });
  // The lamps: an old iron post every so often, now one side, now the other; most dead, a few still lit (Gammer Teal lights them: dialogue/fenroad.ts).
  const lamps: Array<[number, number, string]> = [
    [114, 1, 'fr-lamp-lit'], [96, -1, 'fr-lamp-leaning'], [84, 1, 'fr-lamp-lit'], [76, -1, 'fr-lamp'],
    [70, 1, 'fr-lamp-leaning'], [57, -1, 'fr-lamp-lit'], [46, 1, 'fr-lamp'], [36, -1, 'fr-lamp-lit'], [24, 1, 'fr-lamp-leaning'], [16, -1, 'fr-lamp'],
  ];
  for (const [ly, side, key] of lamps) {
    const lx = Math.round(fenRoadX(ly + 0.5) + side * (roadHalf(ly) + 0.9) - 0.5);
    clear(data, lx, ly);
    if (data.terrain[ly][lx] === Terrain.Water) data.terrain[ly][lx] = Terrain.Dirt;
    slim(key, lx, ly, [circle(0.5, 0.5, 0.1)], { flipX: side < 0 });
    if (key === 'fr-lamp-lit') data.lights!.push({ gx: lx + 0.8, gy: ly + 0.5, z: 52, radius: 150, flicker: 0.5 });
  }
  data.sights!.push(
    {
      id: 'fr-lamp-lit', gx: Math.round(fenRoadX(84.5) + roadHalf(84) + 0.9 - 0.5) + 0.5, gy: 85.2, label: 'Look at the lamp', z: 50,
      thought: 'One of the old causeway lamps, an iron post with a lantern on a hook. This one is lit. Somebody came out here today, with oil and a taper, and lit it. For whom?',
    },
    {
      id: 'fr-lamp', gx: Math.round(fenRoadX(76.5) - roadHalf(76) - 0.9 - 0.5) + 0.5, gy: 77.2, label: 'Look at the lamp', z: 50,
      thought: 'A dead lamp, the glass furred green inside and a snail asleep on it. The post has a mark cast into it at the foot: a bar and three waves. The Marrables put these up, all the way to the Saltway, so the carts could go by night.',
    },
  );
  // The peat cuts, off the west side, and the one with someone in it.
  const by = 80;
  const bx = Math.round(fenRoadX(by) - 7);
  for (let ty = by - 2; ty < by + 3; ty++) for (let tx = bx - 2; tx < bx + 5; tx++) if (data.terrain[ty]?.[tx] === Terrain.Water) data.terrain[ty][tx] = Terrain.Grass;
  for (let ty = by - 1; ty <= by + 1; ty++) for (let tx = bx - 1; tx <= bx + 2; tx++) clear(data, tx, ty);
  set('fr-bogbody', bx, by, 2, 1, { flat: false, blocks: [[0, 0], [1, 0]] });
  // A trodden way to it off the road.
  for (let tx = bx + 2; tx < Math.round(fenRoadX(by + 1)) - 1; tx++) if (data.terrain[by + 1][tx] !== Terrain.Water) data.terrain[by + 1][tx] = Terrain.Dirt;
  data.landmarks!.push({ gx: bx + 1, gy: by + 0.5, name: 'The old peat cuts', range: 4 });
  data.sights!.push({
    id: 'fr-bogbody', gx: bx + 1.2, gy: by + 1.3, label: 'Look into the peat cut', z: 6,
    thought:
      'Somebody is lying in the bottom of the old cut. I nearly cried out. But it is old, older than the causeway: brown as a saddle, curled on its side with its knees drawn up ' +
      'and an arm over its face, a cord of plaited hide still round its neck. The cutters found it and left it, and took no more peat from here. I don\'t blame them.',
  });
}

/**
 * The wreck at the Drowned Mile: the guild's last caravan, where the
 * causeway runs lowest. The lead wagon rolled off the east side into the bog
 * and half under it; behind it on the logs, a wagon burnt to its ribs, Dame
 * Marrable's wool burnt in heaps; a handcart on its back with its salt split
 * and left; casks stove in and their eels left to rot; Tunstall's scarlet
 * slashed and trodden in; the ox's bones; Garrow's lantern pole where it fell.
 * And off the west side, tracks going down into the water.
 */
function addWreck(data: MapData, set: Setter, slim: (key: string, tx: number, ty: number, shapes: ReturnType<typeof circle>[], more?: Partial<MapObject>) => void): void {
  const y = FEN_WRECK.y;
  const rx = (yy: number) => Math.round(fenRoadX(yy + 0.5) - 0.5);
  // The sunk wagon in the water off the east side.
  const wx = rx(y - 2) + 2;
  for (let ty = y - 4; ty < y + 1; ty++) for (let tx = wx - 1; tx < wx + 5; tx++) if (Math.abs(tx + 0.5 - fenRoadX(ty + 0.5)) > roadHalf(ty) + 0.4) data.terrain[ty][tx] = Terrain.Water;
  set('fr-wagon-sunk', wx, y - 3, 3, 2, { blocks: [], shapes: [box(0, 0.2, 1, 1), box(1, 0.2, 2, 1)] });
  // The burnt wagon on the causeway, slewed across it: there's just room to squeeze by on its west side.
  const bx = rx(y + 2);
  set('fr-wagon-burnt', bx, y + 1, 3, 2, { blocks: [[1, 0], [2, 0], [1, 1], [2, 1]], shapes: [box(0.3, 0.2, 1, 1), box(0, 0.2, 1, 1)] });
  // The cart on its back, behind; casks, bales and wool strewn about.
  set('fr-cart-over', rx(y - 5) - 1, y - 6, 2, 2, { blocks: [[0, 0], [0, 1]], shapes: [box(0.2, 0.2, 1, 1)] });
  slim('fr-casks', rx(y - 1) - 1, y - 1, [circle(0.6, 0.6, 0.3)]);
  slim('fr-bale-0', rx(y) + 1, y, [box(0.2, 0.25, 0.75, 0.7)]);
  slim('fr-bale-1', rx(y + 4) - 1, y + 4, [box(0.2, 0.25, 0.75, 0.7)], { flipX: true });
  slim('fr-bale-2', rx(y - 3), y - 3, [box(0.2, 0.25, 0.75, 0.7)]);
  slim('fr-burntwool', rx(y + 4) + 1, y + 4, [circle(0.5, 0.5, 0.34)]);
  set('fr-oxbones', rx(y - 8) - 1, y - 8, 2, 1, { blocks: [], shapes: [box(0.4, 0.2, 1, 0.8), box(0, 0.2, 0.6, 0.8)] });
  placeObject(data, { key: 'fr-lantern-fallen', tx: rx(y + 6), ty: y + 6, w: 2, h: 1, blocks: [] });
  data.crows!.push({ gx: rx(y - 8) + 0.2, gy: y - 7.4 }, { gx: rx(y - 8) + 1.1, gy: y - 7.8 }, { gx: wx + 1.5, gy: y - 3.6 });
  // The tracks: off the west side of the causeway and down into the mere, and the scale by them.
  const t = FEN_TRACKS;
  for (let k = 0; k < 4; k++) {
    const tx = t.x - k;
    if (data.terrain[t.y][tx] === Terrain.Grass) data.terrain[t.y][tx] = Terrain.Dirt;
    placeObject(data, { key: `fr-tracks-${k % 3}`, tx, ty: t.y, w: 1, h: 1, flat: true, flipX: true });
  }
  for (let tx = t.x - 4; tx > t.x - 12; tx--) if (data.terrain[t.y][tx] !== Terrain.Water && tx < t.x - 3) data.terrain[t.y][tx] = Terrain.Water;
  placeObject(data, { key: 'fr-scale', tx: t.x - 1, ty: t.y + 1, w: 1, h: 1, flat: true });
  if (data.terrain[t.y + 1][t.x - 1] === Terrain.Water) data.terrain[t.y + 1][t.x - 1] = Terrain.Dirt;
  // What there is to look at.
  data.landmarks!.push({ gx: fenRoadX(y), gy: y, name: 'The Drowned Mile', range: 13 });
  data.sights!.push(
    { id: 'fr-wreck-wagon', gx: wx + 0.6, gy: y - 0.6, label: 'Look at the wagon', z: 30, thought: '' },
    { id: 'fr-wreck-burnt', gx: bx + 0.4, gy: y + 2.6, label: 'Look at the burnt wagon', z: 24, thought: '' },
    { id: 'fr-wreck-cart', gx: rx(y - 5) - 0.2, gy: y - 4.2, label: 'Look at the cart', z: 16, thought: '' },
    { id: 'fr-wreck-casks', gx: rx(y - 1) - 0.4, gy: y - 0.1, label: 'Look at the casks', z: 14, thought: '' },
    { id: 'fr-wreck-bale', gx: rx(y) + 1.5, gy: y + 1.1, label: 'Look at the bale', z: 14, thought: '' },
    { id: 'fr-wreck-ox', gx: rx(y - 8) + 0.2, gy: y - 6.9, label: 'Look at the bones', z: 10, thought: '' },
    { id: 'fr-wreck-lantern', gx: rx(y + 6) + 1.8, gy: y + 7, label: 'Look at the lantern', z: 8, thought: '' },
    { id: 'fr-tracks', gx: t.x - 0.5, gy: t.y + 0.5, label: 'Look at the tracks', z: 4, thought: '' },
    { id: 'fr-scale', gx: t.x - 0.4, gy: t.y + 1.5, label: 'Pick up the scale', z: 4, thought: '' },
  );
  data.musings!.push({
    x0: 0, y0: DROWNED_MILE.y1 - 1, x1: W, y1: DROWNED_MILE.y1 + 2,
    text: 'The oaks give out, and the water comes up on both sides, flat and black, and the causeway runs out low across it. And there is a smell on the wind, sweet and rotten. Garrow said I would smell it before I saw it.',
  });
}

/** The far end: the causeway going under the water, posts standing up out of it, and the road going on beyond, out of reach. */
function addFarEnd(data: MapData, set: Setter): void {
  for (let y = FEN_SUNK.y0; y < FEN_SUNK.y1; y++) {
    for (const side of [-1, 1]) {
      const x = Math.round(fenRoadX(y + 0.5) + side * 1.6 - 0.5);
      if ((y + side) % 2) set('gh-piling', x, y, 1, 1, { blocks: [], shapes: [circle(0.5, 0.5, 0.12)] });
    }
  }
  data.landmarks!.push({ gx: fenRoadX(FEN_SUNK.y1), gy: FEN_SUNK.y1, name: 'Where the causeway sinks', range: 6 });
  data.musings!.push({
    x0: 0, y0: FEN_SUNK.y1, x1: W, y1: FEN_SUNK.y1 + 3,
    text: "The causeway goes down under the water here, the logs sloping into it, and comes up again a long stone's throw on, with the posts standing up out of the water between like a line of drowned men. It's too deep to wade. Not today.",
  });
  // The road's end past the gap, for the map: it runs on north to the Saltway.
  for (let y = 0; y < FEN_SUNK.y0; y++) {
    const x = Math.floor(fenRoadX(y + 0.5));
    for (const dx of [-1, 0, 1]) if (data.terrain[y][x + dx] === Terrain.Water) data.terrain[y][x + dx] = Terrain.Dirt;
  }
}

/** Clears a tile of anything growing on it, for something to stand there. */
function clear(data: MapData, tx: number, ty: number): void {
  data.props[ty][tx] = Prop.None;
}

/**
 * The fen itself: the bog oaks leaning in over the road from both sides (and
 * thinning out over the Drowned Mile), drowned snags standing in the water,
 * reed beds and bulrushes round every pool, sedge and bog cotton on the wet
 * ground, mires, lilies and scum on the still water, and the cold lights out
 * over it at night.
 */
/** The deep, open pool off the Drowned Mile where something comes up to look at the hero (scenes/game/fenroad.ts): clear water, nothing growing in it. */
function openWatchersPool(data: MapData): void {
  const w = FEN_WATCHER;
  const inPool = (x: number, y: number) => Math.hypot(x + 0.5 - w.x, (y + 0.5 - w.y) * 1.2) < 2.3;
  for (let y = Math.floor(w.y - 3); y <= w.y + 3; y++) {
    for (let x = Math.floor(w.x - 3); x <= w.x + 3; x++) {
      if (!inPool(x, y)) continue;
      data.terrain[y][x] = Terrain.Water;
      data.props[y][x] = Prop.None;
    }
  }
  data.objects = data.objects!.filter((o) => !inPool(o.tx, o.ty));
}

function addFen(data: MapData, rnd: Phaser.Math.RandomDataGenerator, set: Setter, slim: (key: string, tx: number, ty: number, shapes: ReturnType<typeof circle>[], more?: Partial<MapObject>) => void): void {
  const { terrain, props } = data;
  const isWater = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && terrain[y][x] === Terrain.Water;
  const taken = new Set<number>();
  for (const o of data.objects ?? []) {
    if (o.flat && !o.key.startsWith('fr-logs') && !o.key.startsWith('fr-sunk') && !o.key.startsWith('gh-boards')) continue;
    for (let y = o.ty - 1; y <= o.ty + o.h; y++) for (let x = o.tx - 1; x <= o.tx + o.w; x++) taken.add(y * W + x);
  }
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H - 3 && props[y][x] === Prop.None && !taken.has(y * W + x);
  const mile = (y: number) => y >= DROWNED_MILE.y0 && y <= DROWNED_MILE.y1;
  const off = (x: number, y: number) => Math.abs(x + 0.5 - fenRoadX(y + 0.5)) - roadHalf(y);
  const take = (x: number, y: number, r = 1) => {
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) taken.add(yy * W + xx);
  };

  // The bog oaks: a row along each verge leaning in over the road, then thinner further out.
  const oaks = ['fr-oak-0', 'fr-oak-1', 'fr-oak-2', 'fr-oak-3'];
  for (let y = 2; y < H - 6; y++) {
    for (let x = 0; x < W; x++) {
      if (!free(x, y) || terrain[y][x] !== Terrain.Grass) continue;
      const d = off(x, y);
      if (d < 0.6) continue;
      const verge = d < 3.2;
      const chance = mile(y) ? 0.012 : verge ? 0.2 : d < 9 ? 0.07 : 0.045;
      if (rnd.frac() >= chance) continue;
      // Lean in over the road: east of it, mirrored so the crown reaches back west.
      const east = x + 0.5 > fenRoadX(y + 0.5);
      set(oaks[rnd.between(0, oaks.length - 1)], x, y, 1, 1, { shapes: [circle(0.5, 0.5, 0.3)], flipX: east, fades: true });
      take(x, y, 2);
    }
  }
  // Drowned snags standing up out of the water, more of them on the Drowned Mile.
  for (let y = 2; y < H - 6; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!isWater(x, y) || !free(x, y) || off(x, y) < 2) continue;
      if (rnd.frac() >= (mile(y) ? 0.035 : 0.012)) continue;
      set(`fr-snag-${rnd.between(0, 1)}`, x, y, 1, 1, { blocks: [], shapes: [], flipX: rnd.frac() < 0.5, fades: true });
      take(x, y, 2);
    }
  }
  // Reeds and bulrushes round the water's edges: thick, tall, closing in on the road over the Drowned Mile.
  for (let y = 1; y < H - 3; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!free(x, y)) continue;
      const water = isWater(x, y);
      const shore = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => isWater(x + dx, y + dy) !== water);
      if (!shore) continue;
      if (water) {
        if (rnd.frac() < (mile(y) ? 0.8 : 0.6)) set(rnd.frac() < 0.4 ? `fr-bulrush-${rnd.between(0, 2)}` : `jt-reeds-${rnd.between(0, 2)}`, x, y, 1, 1, { flipX: rnd.frac() < 0.5 });
      } else if (off(x, y) > 0.3 && rnd.frac() < 0.45) slim(`gh-rushes-${rnd.between(0, 2)}`, x, y, [], { flipX: rnd.frac() < 0.5 });
    }
  }
  // Out on the open water: lilies and scum, and a reed bed here and there.
  for (let y = 1; y < H - 3; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!isWater(x, y) || props[y][x] !== Prop.None || (data.decks ?? []).some(([dx, dy]) => dx === x && dy === y)) continue;
      const r = rnd.frac();
      if (r < 0.06) set(`jt-reeds-${rnd.between(0, 2)}`, x, y, 1, 1, { flipX: rnd.frac() < 0.5 });
      else if (r < 0.2) placeObject(data, { key: rnd.frac() < 0.45 ? `jt-lilies-${(x + y) % 2}` : `gh-scum-${(x * 3 + y) % 3}`, tx: x, ty: y, w: 1, h: 1, blocks: [], flat: true });
    }
  }
  // On the wet ground: sedge, bog cotton, mires, mud.
  for (let y = 0; y < H - 3; y++) {
    for (let x = 0; x < W; x++) {
      if (!free(x, y) || off(x, y) < 0.5) continue;
      const t = terrain[y][x];
      const r = rnd.frac();
      if (t === Terrain.Grass) {
        if (r < 0.08) slim(`fr-cotton-${rnd.between(0, 1)}`, x, y, []);
        else if (r < 0.2) slim(`gh-rushes-${rnd.between(0, 2)}`, x, y, [], { flipX: rnd.frac() < 0.5 });
        else if (r < 0.24) placeObject(data, { key: `fr-mire-${rnd.between(0, 1)}`, tx: x, ty: y, w: 1, h: 1, flat: true });
        else if (r < 0.28) slim('gh-stump', x, y, [circle(0.5, 0.5, 0.2)]);
      } else if (t === Terrain.Dirt) {
        if (r < 0.16) placeObject(data, { key: `gh-mud-${rnd.between(0, 2)}`, tx: x, ty: y, w: 1, h: 1, flat: true });
        else if (r < 0.26) placeObject(data, { key: `gh-puddle-${rnd.between(0, 2)}`, tx: x, ty: y, w: 1, h: 1, flat: true });
      }
    }
  }
  // Will-o'-the-wisps: cold lights low over the water at night, out where nobody could have lit them.
  for (const [gx, gy] of [[12, 60], [44, 70], [9, 30], [46, 40], [14, 92], [40, 18], [20, 66], [15, 84], [35, 78], [16, 110], [37, 52], [33, 96]]) data.lights!.push({ gx, gy, z: 8, radius: 72, flicker: 0.95 });
}
