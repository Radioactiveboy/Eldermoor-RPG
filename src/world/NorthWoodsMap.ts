import Phaser from 'phaser';
import type { HerbKind } from '../systems/Herbs';
import { circle } from './Collision';
import { plantHerbNear } from './HerbPatches';
import { CreatureSpawn, MapData, placeObject, Prop, Terrain } from './MapData';
import { joinDiagonals, paintPath, smoothLine, Vec } from './MapGenerator';

export const NORTH_WOODS_W = 60;
export const NORTH_WOODS_H = 76;

/** Where the path from the Hollow comes in, along the south edge. */
const SOUTH_GATE_X = 30;
/** The back corner of the old watchtower's 3x3 footprint, up on its rise in the west. */
const TOWER = { tx: 12, ty: 19 };
/** The middle of the glade in the south-east, where the deer graze. */
const GLADE = { x: 46, y: 58, r: 6.5 };
/** The bramble thickets west of the path, where the wild cats lie up. */
const THICKETS = { x: 17, y: 52 };
/** The great fallen oak across the old way north, in the north-east. */
const DEADFALL = { tx: 37, ty: 15 };

/**
 * The north woods: the old forest beyond the wolves' cave, north of the
 * Hollow, where the goblins came from and went back to. A path comes up from
 * the Hollow at the south edge and winds north through the trees, wading the
 * brook at a ford; off it, a side path climbs west to an old watchtower on a
 * rise, long fallen to ruin, and to the east lies a sunny glade where deer
 * graze. Fallen trees lie across the forest floor and brambles grow thick in
 * the west, where wild cats lie up. Up in the north-east a great oak has come
 * down across the old way north, and beyond it the woods run on unbroken.
 *
 * After the raid (`goblinTrail`), the goblins' track is plain to see: a swathe
 * of bracken trodden flat, running up from the Hollow and away north, a burnt
 * torch dropped in the ferns, and a scrap of Mother's quilt caught on the
 * brambles. Following it is part of the Ashes quest. Once the hero has taken
 * word to Adowvale (`greyfells`), the trail can be followed off the north
 * edge, up onto the Greyfells (see GreyfellsMap.ts).
 */
export function buildNorthWoodsMap(goblinTrail: boolean, greyfells = false): MapData {
  const W = NORTH_WOODS_W;
  const H = NORTH_WOODS_H;
  const rnd = new Phaser.Math.RandomDataGenerator(['north-woods']);
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < H; y++) {
    terrain.push(new Array(W).fill(Terrain.Grass));
    props.push(new Array(W).fill(Prop.None));
  }

  // The brook: in from the west edge, down through the middle of the woods, and out to the east, with a stony bank.
  const brook = smoothLine([
    { x: -3, y: 27 },
    { x: 6, y: 30 },
    { x: 14, y: 35.5 },
    { x: 22, y: 37 },
    { x: 30, y: 40.5 },
    { x: 39, y: 43 },
    { x: 47, y: 41.5 },
    { x: 54, y: 45 },
    { x: W + 3, y: 47 },
  ]);
  brook.forEach((p, i) => {
    const r = 0.55 + 0.15 * Math.sin(i * 0.21) + 0.1 * Math.sin(i * 0.67);
    for (let y = Math.floor(p.y - r - 2); y <= p.y + r + 2; y++) {
      for (let x = Math.floor(p.x - r - 2); x <= p.x + r + 2; x++) {
        if (terrain[y]?.[x] === undefined) continue;
        const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
        if (d <= r) terrain[y][x] = Terrain.Water;
        else if (d <= r + 0.75 && terrain[y][x] === Terrain.Grass) terrain[y][x] = Terrain.Sand;
      }
    }
  });
  joinDiagonals(terrain, Terrain.Water, Terrain.Sand);

  // The path north from the Hollow, the side path up to the watchtower, and the way east to the glade.
  const path = smoothLine([
    { x: SOUTH_GATE_X + 0.5, y: H + 2 },
    { x: SOUTH_GATE_X + 0.5, y: H - 3 },
    { x: 28.5, y: H - 10 },
    { x: 32.5, y: H - 18 },
    { x: 29, y: 50 },
    { x: 30.5, y: 44.5 },
    { x: 30, y: 40.5 },
    { x: 28, y: 35 },
    { x: 30.5, y: 28 },
    { x: 29, y: 20 },
    { x: 31.5, y: 12 },
    { x: 30.5, y: 6 },
  ]);
  const towerDoor = { x: TOWER.tx + 1.5, y: TOWER.ty + 3.4 };
  const towerPath = smoothLine([
    { x: 29.2, y: 31 },
    { x: 24, y: 29.5 },
    { x: 19.5, y: 26.5 },
    { x: 16.5, y: 25.5 },
    towerDoor,
  ]);
  const gladePath = smoothLine([
    { x: 30.5, y: H - 15 },
    { x: 36, y: H - 13.5 },
    { x: 40, y: H - 16 },
    { x: GLADE.x - 3, y: GLADE.y + 1 },
  ]);
  const trail = (t: number) => 0.62 + 0.14 * Math.sin(t * 19.1) + 0.08 * Math.sin(t * 47.3 + 1);
  paintPath(terrain, path, trail);
  paintPath(terrain, towerPath, (t) => 0.5 + 0.1 * Math.sin(t * 23.1));
  paintPath(terrain, gladePath, (t) => 0.48 + 0.1 * Math.sin(t * 17.7 + 2));
  joinDiagonals(terrain, Terrain.Dirt, Terrain.Grass);
  // The ford: where the path wades the brook, the stream runs broad and shallow over gravel.
  const ford = path.reduce((best, p) => (Math.abs(p.y - 40.5) < Math.abs(best.y - 40.5) ? p : best));
  const fordTiles: Array<{ x: number; y: number }> = [];
  for (let y = Math.floor(ford.y) - 2; y <= ford.y + 2; y++) {
    for (let x = Math.floor(ford.x) - 1; x <= ford.x + 1; x++) {
      if (terrain[y][x] === Terrain.Water) {
        terrain[y][x] = Terrain.Sand;
        fordTiles.push({ x, y });
      }
    }
  }

  // The goblins' way: straight through the woods, as they go, from the Hollow away north. Before the
  // raid it's just an old deer track, a line through the trees with nothing growing on it.
  const goblinWay = smoothLine([
    { x: 25.5, y: H + 2 },
    { x: 24.5, y: H - 8 },
    { x: 26, y: 56 },
    { x: 27.5, y: 46 },
    { x: 27, y: 39 },
    { x: 33, y: 30 },
    { x: 38, y: 22 },
    { x: 41.5, y: 12 },
    { x: 41, y: 4 },
    { x: 42, y: -3 },
  ]);

  // Thick old forest everywhere but the paths, the glade and the rise the tower stands on; a few
  // boulders among the trees, and thinner on the brook's banks.
  const ways = [...path, ...towerPath, ...gladePath, ...goblinWay];
  const near = (line: Vec[], x: number, y: number, within: number) => line.some((p) => Math.abs(p.x - x) < within && Math.abs(p.y - y) < within && Math.hypot(p.x - x, p.y - y) < within);
  const towerMid = { x: TOWER.tx + 1.5, y: TOWER.ty + 1.5 };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (terrain[y][x] !== Terrain.Grass) continue;
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (near(ways, cx, cy, 1.6)) continue;
      const glade = Math.hypot(cx - GLADE.x, (cy - GLADE.y) * 1.15) / GLADE.r;
      const rise = Math.hypot(cx - towerMid.x, cy - towerMid.y) / 5.5;
      if (glade < 1 || rise < 1) continue;
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      const bank = near(brook, cx, cy, 2.4);
      const chance = edge < 3 ? 0.85 : bank ? 0.22 : glade < 1.4 || rise < 1.4 ? 0.28 : 0.46;
      const roll = rnd.frac();
      if (roll < chance) props[y][x] = Prop.Tree;
      else if (roll < chance + 0.025) props[y][x] = Prop.Rock;
    }
  }

  const entry = { x: SOUTH_GATE_X + 0.5, y: H - 2.6 };
  const data: MapData = {
    width: W,
    height: H,
    terrain,
    props,
    spawn: entry,
    music: 'woods',
    // Few flowers under the trees: the forest floor is bracken and leaf litter instead (below).
    decor: 0.08,
    // The forest floor lies in the trees' shade, darker and mossier than open grass.
    groundShade: 0xb4c0a4,
    entries: { world: entry },
    doors: [],
    sights: [],
    creatures: [],
    landmarks: [
      { gx: TOWER.tx + 1.5, gy: TOWER.ty + 1.5, name: 'The old watchtower', range: 7 },
      { gx: ford.x, gy: ford.y, name: 'The ford', range: 4 },
      { gx: GLADE.x, gy: GLADE.y, name: 'The glade', range: GLADE.r + 2 },
      { gx: THICKETS.x, gy: THICKETS.y, name: 'The bramble thickets', range: 7 },
      { gx: DEADFALL.tx + 2, gy: DEADFALL.ty + 0.5, name: 'The fallen oak', range: 5 },
      { gx: SOUTH_GATE_X + 0.5, gy: H - 1, name: 'The path to the Hollow', range: 5 },
    ],
    musings: [
      {
        x0: 26, y0: 3, x1: 36, y1: 9,
        text: 'The path gives out here. North, the trees just go on and on, up towards the Greyfells. I would be lost in an hour.',
      },
    ],
  };

  // The path runs off the south edge, back down past the wolves' cave to the Hollow.
  for (let x = 0; x < W; x++) {
    if (terrain[H - 1][x] !== Terrain.Dirt) continue;
    data.doors!.push({ tx: x, ty: H - 1, to: 'world', entry: 'northwoods', auto: true, ask: 'Do you want to follow the path back down to the Hollow?' });
  }

  // The stones of the ford.
  for (const t of fordTiles.filter((_, i) => i % 2 === 0)) placeObject(data, { key: 'nw-ford-stones', tx: t.x, ty: t.y, w: 1, h: 1, flat: true });

  // The old watchtower on its rise, fallen to ruin: the doorway faces the path up to it.
  for (let y = TOWER.ty - 1; y <= TOWER.ty + 4; y++) for (let x = TOWER.tx - 1; x <= TOWER.tx + 4; x++) props[y][x] = Prop.None;
  // The whole footprint blocks; the way in is over the rubble in the doorway, from the tile in front of it.
  placeObject(data, { key: 'nw-watchtower', tx: TOWER.tx, ty: TOWER.ty, w: 3, h: 3, fades: true });
  const doorTile = { x: TOWER.tx + 1, y: TOWER.ty + 3 };
  data.doors!.push({ tx: doorTile.x, ty: doorTile.y, to: 'watchtower', entry: 'door', label: 'Climb inside', facing: 'front' });
  data.entries!.watchtower = { x: doorTile.x + 0.5, y: doorTile.y + 0.75 };
  // Round the side, away from the doorway, so the two prompts don't crowd each other.
  data.sights!.push({
    id: 'nw-watchtower', gx: TOWER.tx + 3.1, gy: TOWER.ty + 1.3, label: 'Look at the tower', z: 40,
    thought: 'A watchtower, from when the lords kept men up here to watch the north road. The top has fallen in, and rooks nest in what is left. The doorway is half choked with rubble, but I could climb in over it.',
  });
  // Bones in the grass by the tower: something's kills, dragged out of the thickets.
  {
    const tx = TOWER.tx + 4;
    const ty = TOWER.ty + 3;
    props[ty][tx] = Prop.None;
    placeObject(data, { key: 'cave-bones-1', tx, ty, w: 1, h: 1, flat: true });
    data.sights!.push({ id: `nw-bones-${tx},${ty}`, gx: tx + 0.5, gy: ty + 0.5, label: 'Search the bones', z: 18, loot: 'bones' });
  }

  // Fallen trees: the great oak across the old way north, and others lying where they came down.
  const fallen = (key: string, tx: number, ty: number, len: number, alongY: boolean) => {
    const w = alongY ? 1 : len;
    const h = alongY ? len : 1;
    for (let y = ty - 1; y <= ty + h; y++) for (let x = tx - 1; x <= tx + w; x++) if (props[y]?.[x] === Prop.Tree) props[y][x] = Prop.None;
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (terrain[y][x] !== Terrain.Grass) return;
    placeObject(data, { key, tx, ty, w, h, flipX: alongY });
  };
  fallen('nw-log-long', DEADFALL.tx, DEADFALL.ty, 4, false);
  fallen('nw-deadfall', 20, 9, 3, true);
  fallen('nw-log', 8, 44, 2, false);
  fallen('nw-deadfall', 46, 30, 3, false);
  fallen('nw-log', 37, 60, 2, true);
  fallen('nw-log', 20, 64, 2, false);
  fallen('nw-deadfall', 50, 10, 3, true);
  data.sights!.push({
    id: 'nw-fallen-oak', gx: DEADFALL.tx + 2, gy: DEADFALL.ty + 1.4, label: 'Look at the fallen oak', z: 26,
    thought: 'An oak as old as the Hollow, come down in some winter storm right across the old way north. Moss all over it. Nobody has been up this way to clear it in years.',
  });

  // The bramble thickets, a tangle of them west of the path.
  const brambles: Array<{ tx: number; ty: number }> = [];
  for (let tries = 0; brambles.length < 16 && tries < 400; tries++) {
    const tx = Math.floor(THICKETS.x + rnd.realInRange(-6, 6));
    const ty = Math.floor(THICKETS.y + rnd.realInRange(-5, 5));
    if (terrain[ty]?.[tx] !== Terrain.Grass || near(ways, tx + 0.5, ty + 0.5, 1.4)) continue;
    if (brambles.some((b) => b.tx === tx && b.ty === ty)) continue;
    brambles.push({ tx, ty });
  }
  // And a few elsewhere, at the edges of clearings and along the brook.
  for (let tries = 0, placed = 0; placed < 14 && tries < 600; tries++) {
    const tx = rnd.between(4, W - 5);
    const ty = rnd.between(4, H - 5);
    if (terrain[ty][tx] !== Terrain.Grass || props[ty][tx] !== Prop.None || near(ways, tx + 0.5, ty + 0.5, 1.4)) continue;
    brambles.push({ tx, ty });
    placed++;
  }
  for (const b of brambles) {
    props[b.ty][b.tx] = Prop.None;
    placeObject(data, { key: `nw-bramble-${rnd.between(0, 2)}`, tx: b.tx, ty: b.ty, w: 1, h: 1, flipX: rnd.frac() < 0.5, shapes: [circle(0.5, 0.5, 0.42)] });
  }

  // Bracken and leaf litter over the forest floor, wherever nothing else is.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (terrain[y][x] !== Terrain.Grass || props[y][x] !== Prop.None) continue;
      // (The dice are rolled either way, so the rest of the woods comes out the same before and after the raid.)
      const roll = rnd.frac();
      const variant = rnd.between(0, 3);
      const flip = rnd.frac() < 0.5;
      // After the raid, the goblins' way is trodden flat instead (see addGoblinTrail).
      if (goblinTrail && near(goblinWay, x + 0.5, y + 0.5, 0.9)) continue;
      const glade = Math.hypot(x + 0.5 - GLADE.x, (y + 0.5 - GLADE.y) * 1.15) < GLADE.r - 1;
      if (roll < (glade ? 0.06 : 0.3)) placeObject(data, { key: `nw-fern-${variant}`, tx: x, ty: y, w: 1, h: 1, flat: true, flipX: flip });
      else if (roll < 0.42 && !glade) placeObject(data, { key: `nw-leaves-${variant % 3}`, tx: x, ty: y, w: 1, h: 1, flat: true });
    }
  }

  // Game: deer in the glade, hares about its edges and along the paths, a boar rooting in the north. It comes back each visit.
  const herd = (id: string, kind: CreatureSpawn['kind'], x: number, y: number, count: number, spread: number, respawns = true) => {
    let placed = 0;
    for (let tries = 0; placed < count && tries < 60; tries++) {
      const tx = Math.floor(x + rnd.realInRange(-spread, spread));
      const ty = Math.floor(y + rnd.realInRange(-spread, spread));
      if (terrain[ty]?.[tx] !== Terrain.Grass || props[ty][tx] !== Prop.None) continue;
      data.creatures!.push({ id: `${id}-${placed}`, kind, gx: tx + 0.5, gy: ty + 0.5, respawns: respawns || undefined });
      placed++;
    }
  };
  herd('nw-deer', 'deer', GLADE.x, GLADE.y, 3, 3);
  herd('nw-hare-glade', 'hare', GLADE.x - 4, GLADE.y + 4, 2, 2.5);
  herd('nw-hare-ford', 'hare', ford.x + 4, ford.y - 4, 1, 2);
  herd('nw-boar', 'boar', 46, 22, 1, 2);
  // The wild cats: two in the thickets, one by the tower, one by the fallen oak. Once killed, they stay gone.
  herd('nw-cat-thicket', 'wildcat', THICKETS.x, THICKETS.y, 2, 4, false);
  herd('nw-cat-tower', 'wildcat', TOWER.tx + 5, TOWER.ty - 1, 1, 2, false);
  herd('nw-cat-oak', 'wildcat', DEADFALL.tx + 3, DEADFALL.ty - 3, 1, 2, false);

  // Wild herbs for Old Maud's bench (see world/HerbPatches.ts): wolfsbane in the shade by the tower and the fallen
  // oak, nettles round the ruin, comfrey on the damp ground by the ford, and yarrow at the sunny edge of the glade.
  const herbs: Array<[string, HerbKind, number, number]> = [
    ['nw-wolfsbane-tower', 'wolfsbane', TOWER.tx + 4, TOWER.ty + 1],
    ['nw-wolfsbane-oak', 'wolfsbane', DEADFALL.tx + 1, DEADFALL.ty + 3],
    ['nw-nettle-tower', 'nettle', TOWER.tx - 1, TOWER.ty + 4],
    ['nw-comfrey-ford', 'comfrey', ford.x - 3, ford.y + 2],
    ['nw-yarrow-glade', 'yarrow', GLADE.x - GLADE.r, GLADE.y - 2],
  ];
  for (const [id, kind, x, y] of herbs) plantHerbNear(data, id, kind, x, y, [Terrain.Grass, Terrain.Sand]);

  if (goblinTrail) addGoblinTrail(data, goblinWay, greyfells);
  return data;
}

/**
 * What the goblins left on their way home with Mother: the bracken trodden
 * flat along their way, a torch one of them dropped, and a scrap of her quilt
 * torn off on the brambles. The hero has a thought at each, and where the
 * trail runs on off the map; the scrap and the trail's end move the Ashes
 * quest on (see scenes/game/raid.ts).
 */
function addGoblinTrail(data: MapData, way: Vec[], greyfells: boolean): void {
  const seen = new Set<string>();
  way.forEach((p, i) => {
    for (const [dx, dy] of [[0, 0], [i % 2 ? 1 : -1, 0]]) {
      const tx = Math.floor(p.x) + dx;
      const ty = Math.floor(p.y) + dy;
      const key = `${tx},${ty}`;
      if (seen.has(key) || data.terrain[ty]?.[tx] === undefined || data.props[ty][tx] !== Prop.None) continue;
      if (data.terrain[ty][tx] === Terrain.Water || data.terrain[ty][tx] === Terrain.Dirt) continue;
      seen.add(key);
      placeObject(data, { key: `nw-trampled-${(tx * 7 + ty * 3) % 4}`, tx, ty, w: 1, h: 1, flat: true });
    }
  });
  const at = (t: number) => {
    const p = way[Math.floor(way.length * t)];
    return { tx: Math.floor(p.x), ty: Math.floor(p.y) };
  };

  // A torch, dropped in the ferns south of the brook and left to burn out.
  const torch = at(0.2);
  placeObject(data, { key: 'nw-torch', tx: torch.tx + 1, ty: torch.ty, w: 1, h: 1, flat: true });
  data.sights!.push({
    id: 'nw-goblin-torch', gx: torch.tx + 1.5, gy: torch.ty + 0.5, label: 'Look at the torch', z: 14,
    thought: 'A torch, burnt out and dropped in the ferns: a crooked stick bound with rags and pitch. Goblin-made. This is the way they came, and the way they went back.',
  });

  // A scrap of Mother's quilt, torn off on a bramble beside the trail north of the brook.
  const scrap = at(0.55);
  const qx = scrap.tx + 2;
  const qy = scrap.ty;
  for (let y = qy - 1; y <= qy + 1; y++) for (let x = qx - 1; x <= qx + 1; x++) if (data.props[y]?.[x] === Prop.Tree) data.props[y][x] = Prop.None;
  placeObject(data, { key: 'nw-bramble-quilt', tx: qx, ty: qy, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.42)] });
  data.sights!.push({
    id: 'nw-quilt-scrap', gx: qx + 0.5, gy: qy + 0.9, label: 'Look at the scrap of cloth', z: 30,
    thought: "Red patchwork, caught on the thorns. I know that stitching: it is from the quilt on Mother's bed. They carried her this way, wrapped in it. She was alive when they came through here. She has to be.",
  });

  data.landmarks!.push({ gx: way[Math.floor(way.length * 0.45)].x, gy: way[Math.floor(way.length * 0.45)].y, name: 'The goblin trail', range: 4 });
  data.musings!.push(
    {
      x0: 22, y0: data.height - 9, x1: 29, y1: data.height - 3,
      text: 'The bracken is trodden flat in a wide swathe, all of it pressed the same way: north. Dozens of them came through here.',
    },
    {
      id: 'goblin-trail-end',
      x0: 37, y0: 2, x1: 46, y1: 9,
      text: greyfells
        ? 'Their trail climbs on north out of the trees, up onto the Greyfells. Nobody is coming to help. So be it.'
        : 'Their trail runs on north into the deep woods, up towards the Greyfells, further than I can see. Dozens of them, and me half beaten. ' +
          'Not alone, and not like this. Iran was right: Adowvale first.',
    },
  );
  if (!greyfells) return;
  // Where it leaves the map: on up the goblins' trail, onto the moor (see GreyfellsMap.ts).
  const exit = way.reduce((best, p) => (Math.abs(p.y) < Math.abs(best.y) ? p : best));
  for (let tx = Math.floor(exit.x) - 1; tx <= Math.floor(exit.x) + 1; tx++) {
    for (let ty = 0; ty <= 2; ty++) if (data.props[ty][tx] === Prop.Tree || data.props[ty][tx] === Prop.Rock) data.props[ty][tx] = Prop.None;
    data.doors!.push({ tx, ty: 0, to: 'greyfells', entry: 'northwoods', auto: true, ask: "Do you want to follow the goblins' trail up onto the Greyfells?" });
  }
  data.entries!.greyfells = { x: Math.floor(exit.x) + 0.5, y: 2.4 };
}
