import Phaser from 'phaser';
import { box, circle } from './Collision';
import { CreatureSpawn, MapData, placeObject, Prop, Terrain } from './MapData';
import { joinDiagonals, paintPath, smoothLine, Vec } from './MapGenerator';

export const GREYFELLS_W = 48;
export const GREYFELLS_H = 56;

/** Where the goblins' trail comes up out of the north woods, along the south edge. */
export const GREYFELLS_SOUTH_X = 21;
/** The middle of the goblins' camp: their cookfire. */
export const GOBLIN_CAMP = { x: 23.5, y: 21.5 };
/** The back corner of the hole in the hill (4x4; its mouth is the front corner tile, (3, 3)). */
export const WARREN = { tx: 21, ty: 3 };
/** The tarn, a cold little lake east of the camp. */
const TARN = { x: 37, y: 31, rx: 5.5, ry: 3.8 };

/**
 * The edge of the Greyfells: the open moor above the north woods, where the
 * goblins' trail comes up out of the trees. Heather and coarse grass, grey
 * outcrops and scree, a few wind-bent trees near the wood's edge and a cold
 * tarn to the east. Halfway up, round a cookfire, is the camp where the
 * goblins rested on their way home with Mother: three hide tents, a lookout
 * of lashed saplings, a pen of hurdles with the last of Coombe's ewes, sheep
 * skulls on stakes, the litter they carried her on, and a stone they've
 * scratched pictures into. A handful of goblins keep it. Beyond, the trail
 * climbs to a hole in the hillside: the way down into their warren, which the
 * hero can't take yet.
 */
export function buildGreyfellsMap(): MapData {
  const W = GREYFELLS_W;
  const H = GREYFELLS_H;
  const rnd = new Phaser.Math.RandomDataGenerator(['greyfells']);
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Grass));
    props.push(new Array(W).fill(Prop.None));
  }
  const noise = (x: number, y: number, seed: number) => {
    const s = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
    return s - Math.floor(s);
  };
  // Where the rock breaks through: a few big patches thick with boulders, rather than an even scatter.
  const blobs = Array.from({ length: 14 }, () => ({ x: rnd.realInRange(2, W - 2), y: rnd.realInRange(2, H - 12), r: rnd.realInRange(1.6, 3.6) }));
  const scree = (x: number, y: number) => blobs.some((b) => Math.hypot(x - b.x, (y - b.y) * 1.2) < b.r + (noise(x, y, 3) - 0.5) * 0.8);

  // The tarn, with a ring of gravel.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x + 0.5 - TARN.x) / TARN.rx, (y + 0.5 - TARN.y) / TARN.ry) + (noise(x, y, 7) - 0.5) * 0.12;
      if (d < 1) terrain[y][x] = Terrain.Water;
      else if (d < 1.28) terrain[y][x] = Terrain.Sand;
    }
  }

  // The goblins' trail: up from the woods, through the camp, and on to the hole in the hill.
  const mouth = { x: WARREN.tx + 3.5, y: WARREN.ty + 4.4 };
  const trail = smoothLine([
    { x: GREYFELLS_SOUTH_X + 0.5, y: H + 2 },
    { x: 20, y: H - 9 },
    { x: 23, y: 40 },
    { x: 21.5, y: 31 },
    { x: GOBLIN_CAMP.x, y: GOBLIN_CAMP.y + 3.5 },
    { x: GOBLIN_CAMP.x + 1.5, y: GOBLIN_CAMP.y - 4 },
    { x: 25.5, y: 12 },
    { x: mouth.x, y: mouth.y - 0.8 },
  ]);
  paintPath(terrain, trail, (t) => 0.55 + 0.12 * Math.sin(t * 17.3));
  // The camp's trodden ground round the fire.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (terrain[y][x] !== Terrain.Grass) continue;
      const d = Math.hypot(x + 0.5 - GOBLIN_CAMP.x, (y + 0.5 - GOBLIN_CAMP.y) * 1.1);
      if (d < 4.6 + (noise(x, y, 11) - 0.5) * 1.4) terrain[y][x] = Terrain.Dirt;
    }
  }
  joinDiagonals(terrain, Terrain.Dirt, Terrain.Grass);

  const near = (line: Vec[], x: number, y: number, within: number) => line.some((p) => Math.hypot(p.x - x, p.y - y) < within);
  const inCamp = (x: number, y: number) => Math.hypot(x - GOBLIN_CAMP.x, (y - GOBLIN_CAMP.y) * 1.1) < 8;
  const underHill = (x: number, y: number) => x >= WARREN.tx - 2 && x < WARREN.tx + 7 && y < WARREN.ty + 6;

  // Boulders on the open fell, thick where the rock breaks through, trees only near the wood's edge to the south,
  // stunted and few; the north edge a wall of rock where the fell climbs on into the hills.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (terrain[y][x] !== Terrain.Grass) continue;
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (near(trail, cx, cy, 1.5) || inCamp(cx, cy) || underHill(cx, cy)) continue;
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      const woods = Math.max(0, (y - (H - 12)) / 12);
      const stony = scree(cx, cy);
      const roll = rnd.frac();
      if (edge < 2) props[y][x] = y > H - 6 ? Prop.Tree : roll < 0.8 ? Prop.Rock : Prop.None;
      else if (roll < 0.03 + woods * 0.5) props[y][x] = Prop.Tree;
      else if (roll < 0.03 + woods * 0.5 + (stony ? 0.2 : 0.04)) props[y][x] = Prop.Rock;
    }
  }

  const entry = { x: GREYFELLS_SOUTH_X + 0.5, y: H - 2.4 };
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: entry,
    music: 'woods',
    decor: 0.12,
    // Open moor: browner and greyer than the Hollow's grass.
    groundShade: 0xa89c7e,
    entries: { northwoods: entry },
    doors: [],
    sights: [],
    creatures: [],
    lights: [],
    landmarks: [
      { gx: GOBLIN_CAMP.x, gy: GOBLIN_CAMP.y, name: 'The goblin camp', range: 7 },
      { gx: TARN.x, gy: TARN.y, name: 'The tarn', range: TARN.rx + 2 },
      { gx: mouth.x, gy: mouth.y - 2, name: 'The hole in the hill', range: 5 },
      { gx: GREYFELLS_SOUTH_X + 0.5, gy: H - 1, name: 'The way down to the north woods', range: 5 },
    ],
    musings: [
      {
        x0: 2, y0: 2, x1: 14, y1: 10,
        text: 'The fell climbs on north into the hills, grey on grey, as far as I can see. Nothing up there but wind and stone.',
      },
    ],
  };

  // ---- The crags ----
  // The clearing is a bowl among crags: a wall of great buttresses along the north where the fell climbs on into the hills,
  // broken ridges down either side, and tors standing out of the heather in between.
  const taken = new Set<number>();
  const nearTarn = (x: number, y: number) => Math.hypot((x - TARN.x) / (TARN.rx + 2.5), (y - TARN.y) / (TARN.ry + 2.5)) < 1;
  const fits = (tx: number, ty: number, size: number) => {
    if (tx < 0 || ty < 0 || tx + size > W || ty + size > H - 7) return false;
    for (let y = ty; y < ty + size; y++) {
      for (let x = tx; x < tx + size; x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        if (terrain[y][x] !== Terrain.Grass || taken.has(y * W + x)) return false;
        if (near(trail, cx, cy, 2.6) || Math.hypot(cx - GOBLIN_CAMP.x, (cy - GOBLIN_CAMP.y) * 1.1) < 10 || underHill(cx, cy) || nearTarn(cx, cy)) return false;
      }
    }
    return true;
  };
  const crag = (tx: number, ty: number, size: number): boolean => {
    if (!fits(tx, ty, size)) return false;
    for (let y = ty; y < ty + size; y++) for (let x = tx; x < tx + size; x++) {
      taken.add(y * W + x);
      props[y][x] = Prop.None;
    }
    placeObject(data, { key: `gf-crag-${size}-${rnd.between(0, 2)}`, tx, ty, w: size, h: size, fades: size >= 3 });
    return true;
  };
  const biggest = (tx: number, ty: number, sizes: number[]) => sizes.find((size) => crag(tx, ty, size));
  // Along the north.
  for (let tx = 0; tx < W; ) tx += biggest(tx, rnd.between(0, 1), [5, 4, 3]) ?? 1;
  for (let tx = 1; tx < W; ) tx += (rnd.frac() < 0.55 ? biggest(tx, 5, [3, 2]) : undefined) ?? 2;
  // Down either side, leaving gaps.
  for (const side of [0, 1]) {
    for (let ty = 6; ty < H - 10; ) {
      const size = rnd.pick([3, 4, 4, 5]);
      const tx = side === 0 ? rnd.between(0, 1) : W - size - rnd.between(0, 1);
      ty += crag(tx, ty, size) ? size + (rnd.frac() < 0.3 ? rnd.between(1, 2) : 0) : 1;
    }
  }
  // Tors in the heather.
  for (let i = 0; i < 40; i++) crag(rnd.between(5, W - 8), rnd.between(8, H - 12), rnd.pick([2, 2, 3]));

  // The trail runs off the south edge, back down into the north woods.
  for (let x = 0; x < W; x++) {
    if (terrain[H - 1][x] !== Terrain.Dirt) continue;
    props[H - 1][x] = Prop.None;
    data.doors!.push({ tx: x, ty: H - 1, to: 'northwoods', entry: 'greyfells', auto: true, ask: 'Do you want to go back down into the north woods?' });
  }

  // ---- The camp ----
  const cx = Math.floor(GOBLIN_CAMP.x);
  const cy = Math.floor(GOBLIN_CAMP.y);
  const clear = (tx: number, ty: number, w = 1, h = 1) => {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (props[y]?.[x] !== undefined) props[y][x] = Prop.None;
  };
  // The cookfire: a ring of stones, still burning, with a spit over it.
  clear(cx, cy);
  placeObject(data, { key: 'nwt-firering', tx: cx, ty: cy, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.4)] });
  placeObject(data, { key: 'fire-small', tx: cx, ty: cy, w: 1, h: 1, anim: 'fire-small-burn' });
  placeObject(data, { key: 'gf-spit', tx: cx, ty: cy, w: 1, h: 1 });
  data.lights!.push({ gx: GOBLIN_CAMP.x, gy: GOBLIN_CAMP.y, z: 12, radius: 150, flicker: 1 });
  data.sights!.push({
    id: 'gf-cookfire', gx: GOBLIN_CAMP.x + 0.9, gy: GOBLIN_CAMP.y + 0.6, label: 'Look at the fire', z: 16,
    thought: "Still burning. Something on the spit, burnt black: one of Iran's hens, by the feathers in the ashes. They left someone to keep the fire in.",
  });

  // Three tents round it, their open ends towards the fire.
  for (const [tx, ty, art] of [[cx - 6, cy - 4, 0], [cx + 2, cy - 6, 1], [cx - 7, cy + 1, 1]] as const) {
    clear(tx, ty, 2, 2);
    placeObject(data, { key: `gf-tent-${art}`, tx, ty, w: 2, h: 2, shapes: [box(0.2, 0.15, 1, 1), box(1, 0.15, 1.8, 1), box(0.2, 1, 1, 1.85), box(1, 1, 1.8, 1.85)] });
  }
  data.sights!.push({
    id: 'gf-tent', gx: cx - 3.9, gy: cy - 2.6, label: 'Look in the tent', z: 20,
    thought: 'It stinks. Heaps of filthy fleeces to sleep on, gnawed bones, a pot of something rancid. And a child\'s wooden horse from somebody\'s farm.',
  });

  // The lookout, east of the fire, watching the trail come up.
  clear(cx + 4, cy + 1, 2, 2);
  placeObject(data, { key: 'gf-lookout', tx: cx + 4, ty: cy + 1, w: 2, h: 2, fades: true, shapes: [circle(0.35, 0.35, 0.12), circle(1.65, 0.35, 0.12), circle(0.35, 1.65, 0.12), circle(1.65, 1.65, 0.12)], blocks: [[0, 0], [1, 0], [0, 1], [1, 1]] });

  // The litter, by the fire on the west side: where they set her down.
  clear(cx - 3, cy + 1, 2, 1);
  placeObject(data, { key: 'gf-litter', tx: cx - 3, ty: cy + 1, w: 2, h: 1 });
  data.sights!.push({
    id: 'gf-litter', gx: cx - 2, gy: cy + 2.2, label: 'Look at the litter', z: 10,
    thought:
      "Two poles and crosspieces, lashed with gut. Mother's quilt is on it. The blood on it is dry. And beside it, a wooden bowl with water in it, " +
      'and a cup. They gave her water. Goblins.',
  });

  // The scratched stone, north-west of the fire.
  clear(cx - 3, cy - 6);
  placeObject(data, { key: 'gf-stone', tx: cx - 3, ty: cy - 6, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.45)] });
  data.sights!.push({
    id: 'gf-stone', gx: cx - 2.5, gy: cy - 4.9, label: 'Look at the stone', z: 24,
    thought:
      'Pictures, scratched into the stone and rubbed with red earth. A huge fat figure lying down, with a crown of spikes. Little ones all round her. ' +
      'And off to one side, a tall thin one, holding out a cup.',
  });

  // The pen: hurdles round the last of Coombe's ewes, dead now.
  const pen = { tx: cx + 4, ty: cy - 3 };
  clear(pen.tx, pen.ty - 1, 3, 4);
  placeObject(data, { key: 'gf-hurdle', tx: pen.tx, ty: pen.ty - 1, w: 2, h: 1, shapes: [box(0, 0.4, 1, 0.6), box(1, 0.4, 2, 0.6)], blocks: [[0, 0], [1, 0]] });
  placeObject(data, { key: 'gf-hurdle', tx: pen.tx, ty: pen.ty + 2, w: 2, h: 1, shapes: [box(0, 0.4, 1, 0.6), box(1, 0.4, 2, 0.6)], blocks: [[0, 0], [1, 0]] });
  placeObject(data, { key: 'cave-ewe-1', tx: pen.tx, ty: pen.ty, w: 2, h: 1, flat: true });
  placeObject(data, { key: 'cave-bones-0', tx: pen.tx + 1, ty: pen.ty + 1, w: 1, h: 1, flat: true });
  data.sights!.push({
    id: 'gf-pen', gx: pen.tx + 1, gy: pen.ty + 0.9, label: 'Look in the pen', z: 8,
    thought: "Sheep, or what's left of them. One still has a bell on. Master Coombe's mark is on her fleece. Wil was right to be frightened.",
  });

  // Bones, feathers and trodden ground about the camp.
  for (const [dx, dy, key] of [[-1, 2, 'decal-feathers-0'], [2, 1, 'decal-feathers-1'], [-2, -2, 'cave-bones-1'], [1, -3, 'decal-feathers-2'], [-4, 3, 'nw-trampled-1'], [3, 3, 'nw-trampled-2']] as const) {
    const tx = cx + dx;
    const ty = cy + dy;
    if (props[ty][tx] === Prop.None) placeObject(data, { key, tx, ty, w: 1, h: 1, flat: true });
  }

  // Skulls on stakes where the trail comes into the camp, and where it leaves for the hill.
  for (const [tx, ty, art] of [[cx - 2, cy + 6, 0], [cx + 2, cy + 6, 1], [cx - 1, cy - 9, 1], [cx + 3, cy - 9, 0]] as const) {
    clear(tx, ty);
    placeObject(data, { key: `gf-skullpole-${art}`, tx, ty, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.12)] });
  }
  data.sights!.push({
    id: 'gf-skulls', gx: cx - 1.5, gy: cy + 6.9, label: 'Look at the skull', z: 50,
    thought: 'A sheep\'s skull on a stake, with rags tied under it. A warning. Or a boast.',
  });

  // ---- The hole in the hill ----
  for (let y = WARREN.ty - 1; y < WARREN.ty + 5; y++) for (let x = WARREN.tx - 1; x < WARREN.tx + 5; x++) if (props[y]?.[x] !== undefined) props[y][x] = Prop.None;
  for (let y = WARREN.ty; y < WARREN.ty + 4; y++) for (let x = WARREN.tx; x < WARREN.tx + 4; x++) terrain[y][x] = Terrain.Grass;
  const warrenBlocks: Array<[number, number]> = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!(x === 3 && y === 3)) warrenBlocks.push([x, y]);
  placeObject(data, { key: 'gf-warren', tx: WARREN.tx, ty: WARREN.ty, w: 4, h: 4, blocks: warrenBlocks });
  // The mouth tile itself is too low and dark to go into, for now.
  props[WARREN.ty + 3][WARREN.tx + 3] = Prop.Blocked;
  data.sights!.push({
    id: 'gf-warren', gx: WARREN.tx + 3.5, gy: WARREN.ty + 4.2, label: 'Look into the hole', z: 30,
    thought:
      'A hole in the hillside, low and black, with the earth worn smooth by feet going in and out. Warm air breathes out of it, and it stinks of smoke ' +
      'and goblin. Far down, I can hear them. Dozens. Hundreds. I would not last a minute down there alone.',
  });

  // ---- Heather on the open fell ----
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (terrain[y][x] !== Terrain.Grass || props[y][x] !== Prop.None) continue;
      if (near(trail, x + 0.5, y + 0.5, 1) || inCamp(x + 0.5, y + 0.5)) continue;
      if (rnd.frac() < 0.4) placeObject(data, { key: `gf-heather-${rnd.between(0, 2)}`, tx: x, ty: y, w: 1, h: 1, flat: true, flipX: rnd.frac() < 0.5 });
    }
  }

  // ---- Who's here ----
  // The goblins left to keep the camp: two at the fire, one on the lookout's ladder, one by the pen. They see you coming.
  const goblins: CreatureSpawn[] = [
    { id: 'gf-goblin-fire-0', kind: 'goblin', gx: GOBLIN_CAMP.x - 1.2, gy: GOBLIN_CAMP.y - 1.1, notice: 3.5 },
    { id: 'gf-goblin-fire-1', kind: 'goblintorch', gx: GOBLIN_CAMP.x + 1.3, gy: GOBLIN_CAMP.y + 1.2, notice: 3.5 },
    { id: 'gf-goblin-lookout', kind: 'goblinspear', gx: cx + 5, gy: cy + 3.6, notice: 5 },
    { id: 'gf-goblin-pen', kind: 'goblin', gx: pen.tx + 2.6, gy: pen.ty + 0.8, notice: 3 },
  ];
  data.creatures!.push(...goblins);
  // Hares out on the heather, away from the camp.
  for (const [id, x, y] of [['gf-hare-0', 9, 40], ['gf-hare-1', 38, 44], ['gf-hare-2', 41, 16]] as const) {
    if (terrain[y][x] !== Terrain.Water && props[y][x] === Prop.None) data.creatures!.push({ id, kind: 'hare', gx: x + 0.5, gy: y + 0.5, respawns: true });
  }

  return data;
}
