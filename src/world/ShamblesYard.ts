import { box, circle } from './Collision';
import { MapData, placeObject, Terrain } from './MapData';
import { SHAMBLES } from './landmarks';
import type { Setter, Slim } from './GloomhavenMap';

/**
 * The Shambles, Gloomhaven's east quarter, where the town's meat is killed and
 * its hides are cured, and where nobody lives who can afford not to. Down the
 * lane from the square, past the backs of the houses: Saul Rendle's
 * slaughterhouse on the north side, its killing-floor doors open on the lane,
 * a rail of carcasses under its eaves, a pen of pigs waiting their turn and a
 * gutter running red down the middle of the mud. Across the lane, Morrow
 * Vetch's tannery turns its back on the street; round its side is its yard,
 * the pits sunk in rows (lime, then bark liquor, darker and darker), racks of
 * stretched hides, stacks of oak bark and the fleshing beam, all running down
 * to the pool the tannery soaks its hides in. In the corner of the yard,
 * against the town wall, the Red Aprons' barn, where the dogs fight. And on
 * the corner by the road to the Staithe, Old Scritch the rat-catcher's den,
 * its front nailed with rat skins.
 *
 * Their insides are world/ShamblesMap.ts; the art is art/shambles.ts.
 */
export function addShambles(data: MapData, set: Setter, slim: Slim): void {
  addSlaughterhouse(data, set, slim);
  addTannery(data, set, slim);
  addPitBarn(data, set, slim);
  addRatDen(data, set, slim);
  addLane(data, set, slim);
}

/** Make the ground under a building firm: no pool water under its footing. */
function firm(data: MapData, tx: number, ty: number, w: number, h: number): void {
  for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (data.terrain[y]?.[x] === Terrain.Water) data.terrain[y][x] = Terrain.Dirt;
}

/**
 * Saul Rendle's slaughterhouse: stone below and black boards above, the
 * killing floor's double doors open on the lane, a hoist beam at the gable,
 * and the shop's counter let down beside the door with the day's joints on it.
 */
function addSlaughterhouse(data: MapData, set: Setter, _slim: Slim): void {
  const s = SHAMBLES.slaughterhouse;
  firm(data, s.tx, s.ty, s.w, s.h);
  set('gh-slaughterhouse', s.tx, s.ty, s.w, s.h);
  data.chimneys!.push({ gx: s.tx + 4.1, gy: s.ty + 0.9, z: 150 });
  data.entries!.slaughterhouse = { x: s.door.tx + 0.5, y: s.door.ty + 0.7 };
  data.doors!.push({ tx: s.door.tx, ty: s.door.ty, to: 'slaughterhouse', entry: 'door', label: 'Go inside', facing: 'back' });
  data.landmarks!.push({ gx: s.door.tx + 0.5, gy: s.door.ty + 0.5, name: "Rendle's slaughterhouse", range: 3 });
  data.lights!.push({ gx: s.door.tx + 0.5, gy: s.door.ty + 0.05, z: 44, radius: 120, flicker: 0.5 });
  data.lights!.push({ gx: s.tx + 1.2, gy: s.ty + s.h + 0.1, z: 24, radius: 80, flicker: 0.3 });
  // The rail of carcasses under the eaves, west of the door, and the chopping block before it.
  set('sh-carcassrail', s.tx, s.ty + s.h, 2, 1, { shapes: [circle(0.12, 0.5, 0.1), circle(1.88, 0.5, 0.1)] });
  set('sh-block', s.tx + 3, s.ty + s.h, 1, 1, { shapes: [circle(0.5, 0.5, 0.3)] });
  set('sh-bloodtub', s.tx + 4, s.ty + s.h, 1, 1, { shapes: [circle(0.5, 0.5, 0.3)] });
  // The pigs' pen against its east end, and a heap of horns and bones.
  set('sh-pigpen', s.tx + s.w, s.ty + 2, 2, 2, { shapes: [box(0.05, 0.05, 1, 1), box(1, 0.05, 1.95, 1), box(0.05, 1, 1, 1.95), box(1, 1, 1.95, 1.95)] });
  set('sh-bones', s.tx + s.w, s.ty + 1, 1, 1, { shapes: [circle(0.5, 0.5, 0.3)] });
  data.sights!.push(
    {
      id: 'sh-notches', gx: s.door.tx - 0.2, gy: s.door.ty + 0.1, label: 'Look at the doorpost', z: 36,
      thought:
        'Three short, deep notches cut in the doorpost with a cleaver, one above the other, the wood gone black in them. ' +
        "I've seen the same three on half the doors in this lane. On one or two, a fourth cut runs across them.",
    },
    {
      id: 'sh-carcasses', gx: s.tx + 1, gy: s.ty + s.h + 0.9, label: 'Look at the carcasses', z: 40,
      thought:
        'Pigs, split down the middle and hung by the heels, white as candles, and a side of something bigger that was never a cow. ' +
        'The flies have found them. So, from the look of it, have the crows.',
    },
    {
      id: 'sh-pigs', gx: s.tx + s.w + 1, gy: s.ty + 4.1, label: 'Look at the pigs', z: 22,
      thought: "Three pigs in a pen of hurdles, up to their knees in muck, watching the slaughterhouse door. They know. I'm sure they know.",
    },
  );
  data.crows!.push({ gx: s.tx + 1.4, gy: s.ty + s.h + 1.6 }, { gx: s.tx + s.w + 0.3, gy: s.ty + 0.6 });
}

/**
 * Morrow Vetch's tannery: a long, low shed of black boards with a louvred
 * drying loft over it, its back to the lane and its front on the yard, where
 * the pits are: two of lime, white and caustic, then the tan pits, the bark
 * liquor darker in each; racks of hides drying, oak bark stacked, the fleshing
 * beam, and a barrow of dog's muck (the tanners call it "pure").
 */
function addTannery(data: MapData, set: Setter, slim: Slim): void {
  const t = SHAMBLES.tannery;
  firm(data, t.tx, t.ty, t.w, t.h);
  set('gh-tannery', t.tx, t.ty, t.w, t.h);
  data.chimneys!.push({ gx: t.tx + 4.2, gy: t.ty + 1, z: 116 });
  data.entries!.tannery = { x: t.door.tx + 0.5, y: t.door.ty + 0.7 };
  data.doors!.push({ tx: t.door.tx, ty: t.door.ty, to: 'tannery', entry: 'door', label: 'Go inside', facing: 'back' });
  data.landmarks!.push({ gx: t.door.tx + 1, gy: t.door.ty + 2, name: "Vetch's tannery", range: 4 });
  data.lights!.push({ gx: t.door.tx + 0.5, gy: t.door.ty + 0.05, z: 40, radius: 110, flicker: 0.5 });

  // The yard: the pits in two rows, lime nearest the shed and the tan pits running on towards the water.
  const pitShape = [box(0.08, 0.08, 0.92, 0.92)];
  const pits: Array<[string, number, number]> = [
    ['sh-limepit', 47, 37], ['sh-limepit', 48, 37], ['sh-tanpit-0', 50, 37], ['sh-tanpit-1', 51, 37], ['sh-tanpit-2', 52, 37],
    ['sh-tanpit-0', 48, 39], ['sh-tanpit-1', 50, 39], ['sh-tanpit-2', 51, 39], ['sh-tanpit-3', 52, 39],
  ];
  for (const [key, x, y] of pits) {
    firm(data, x, y, 1, 1);
    set(key, x, y, 1, 1, { shapes: pitShape });
  }
  set('sh-hiderack', 53, 37, 2, 1, { shapes: [circle(0.12, 0.5, 0.1), circle(1.88, 0.5, 0.1)] });
  set('sh-hiderack', 53, 39, 2, 1, { shapes: [circle(0.12, 0.5, 0.1), circle(1.88, 0.5, 0.1)] });
  set('sh-barkstack', 46, 35, 1, 1, { shapes: [box(0.08, 0.15, 0.92, 0.9)] });
  set('sh-barkstack', 47, 41, 1, 1, { shapes: [box(0.08, 0.15, 0.92, 0.9)] });
  set('sh-fleshbeam', 52, 35, 1, 1, { shapes: [box(0.15, 0.3, 0.85, 0.7)] });
  set('sh-purebarrow', 49, 41, 1, 1, { shapes: [box(0.12, 0.2, 0.88, 0.85)] });
  set('sh-hides', 54, 41, 1, 1, { shapes: [box(0.1, 0.1, 0.9, 0.9)] });
  set('furn-barrels', 50, 41, 1, 1, { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  slim('gh-lamp', 53, 36, [circle(0.5, 0.5, 0.14)]);
  data.lights!.push({ gx: 53.5, gy: 36.5, z: 52, radius: 150, flicker: 0.6 });
  data.landmarks!.push({ gx: 50, gy: 38.5, name: 'The tannery yard', range: 4 });

  data.sights!.push(
    {
      id: 'sh-limepit', gx: 47.5, gy: 38.1, label: 'Look into the pit', z: 6,
      thought: 'Lime, white and thick as porridge, with a skin on it. The hides go in hairy and come out bald. My eyes water just standing over it.',
    },
    {
      id: 'sh-tanpit', gx: 51.5, gy: 40.1, label: 'Look into the pit', z: 6,
      thought:
        'Bark liquor, brown as strong tea in the first pit and black as tar in the last. Hides lie folded under it like drowned men. ' +
        'Something rises to the surface, turns slowly over, and sinks again.',
    },
    {
      id: 'sh-pure', gx: 49.5, gy: 42, label: 'Look in the barrow', z: 12,
      thought:
        "A barrow of dog's muck, collected off the streets. The tanners call it \"pure\", and rub it into the hides to soften them. " +
        'There is a boy in Adowvale who would laugh at this until he was sick. I am trying very hard not to be sick.',
    },
    {
      id: 'sh-hiderack', gx: 54, gy: 38.1, label: 'Look at the hides', z: 30,
      thought: 'Cow hides, stretched on frames to dry, and a smaller one with grey fur still on it at the edges. It is not a cow. It is not a sheep, either.',
    },
  );
  data.musings!.push({
    x0: 46, y0: 36, x1: 55, y1: 42,
    text: 'The stink of the yard is a solid thing: lime, rot, bark and worse, all at once. It gets into my mouth. I can taste it.',
  });
}

/**
 * The Red Aprons' barn, in the corner of the tannery yard against the town
 * wall: black boards, the big door barred, every window boarded, and a board
 * chalked with tonight's fights. The dogs inside never stop.
 */
function addPitBarn(data: MapData, set: Setter, _slim: Slim): void {
  const b = SHAMBLES.pitbarn;
  firm(data, b.tx, b.ty, b.w, b.h);
  set('gh-pitbarn', b.tx, b.ty, b.w, b.h);
  data.entries!.pitbarn = { x: b.door.tx + 0.5, y: b.door.ty + 0.7 };
  data.doors!.push({ tx: b.door.tx, ty: b.door.ty, to: 'dogpit', entry: 'door', label: 'Go inside', facing: 'back', id: 'pit-door' });
  data.landmarks!.push({ gx: b.door.tx + 0.5, gy: b.door.ty + 0.5, name: 'The pit barn', range: 2.5 });
  data.lights!.push({ gx: b.door.tx - 0.4, gy: b.door.ty + 0.05, z: 46, radius: 120, flicker: 0.7 });
  data.sights!.push({
    id: 'sh-pitboard', gx: b.tx + 0.4, gy: b.ty + b.h + 0.2, label: 'Read the board', z: 30,
    sign: {
      heading: 'Chalked on a board by the door',
      lines: [
        'PIT NIGHT. DOOR AT DARK. A PENNY TO STAND.',
        'BRINDLE JACK v. THE TANNERS BITCH',
        'GRIP v. ALL COMERS',
        'RATS. 20 IN THE PIT. A SILVER SAYS SHE DOES IT IN THE MINUTE',
        '(A space, rubbed out and chalked again:) NEW STOCK. GREY. ASK NED',
      ],
    },
  });
  set('sh-chalkboard', b.tx, b.ty + b.h, 1, 1, { blocks: [], shapes: [circle(0.2, 0.5, 0.08)] });
  set('sh-kennel', b.tx + 2, b.ty + b.h, 1, 1, { shapes: [box(0.12, 0.12, 0.88, 0.88)] });
}

/**
 * Old Scritch's den, on the corner by the road down to the Staithe: a crooked
 * shack of boards with rat skins nailed in rows across its front, traps hung
 * by the door, a ferret hutch, and a sign of a rat on a board.
 */
function addRatDen(data: MapData, set: Setter, slim: Slim): void {
  const r = SHAMBLES.ratden;
  firm(data, r.tx, r.ty, r.w, r.h);
  set('gh-ratden', r.tx, r.ty, r.w, r.h, { flipX: true });
  data.chimneys!.push({ gx: r.tx + 0.7, gy: r.ty + 0.6, z: 96 });
  data.entries!.ratden = { x: r.door.tx + 0.7, y: r.door.ty + 0.5 };
  data.doors!.push({ tx: r.door.tx, ty: r.door.ty, to: 'ratden', entry: 'door', label: 'Go inside', facing: 'wall' });
  data.landmarks!.push({ gx: r.door.tx + 0.5, gy: r.door.ty + 0.5, name: "Scritch's den", range: 2.4 });
  data.lights!.push({ gx: r.tx + r.w + 0.05, gy: r.ty + 0.8, z: 30, radius: 80, flicker: 0.4 });
  set('sh-hutch', r.tx + r.w, r.ty + 2, 1, 1, { shapes: [box(0.1, 0.15, 0.6, 0.85)] });
  slim('sh-traps', r.tx + r.w, r.ty, [box(0.1, 0.2, 0.5, 0.8)]);
  data.sights!.push(
    {
      id: 'sh-ratsign', gx: r.tx + r.w + 0.1, gy: r.ty + 0.3, label: 'Read the sign', z: 46,
      sign: {
        heading: 'A board with a rat painted on it',
        lines: ['SCRITCH. RATS KILLED. MOLES, WEASELS, ALL VERMIN.', 'DOGS AND FERRETS FOR RATTING.', 'NO RAT TOO BIG', '(Painted over, nearly:) NO JOB TOO SMALL'],
      },
    },
    {
      id: 'sh-ratskins', gx: r.tx + r.w + 0.1, gy: r.ty + 1.5, label: 'Look at the skins', z: 30,
      thought: 'Rat skins, nailed in rows like the tally of a war. Dozens of them. Hundreds. A few of the newest are as big as cats.',
    },
    {
      id: 'sh-hutch', gx: r.tx + r.w + 0.5, gy: r.ty + 3, label: 'Look in the hutch', z: 16,
      thought: 'Ferrets, three of them, coiled together in the straw like a knot of pale rope. One opens a red eye at me and yawns, all teeth.',
    },
  );
}

/**
 * The lane through the Shambles: a gutter down its middle, running red from
 * the slaughterhouse, a knacker's cart left by the lamp, and Tam Rudd's house,
 * shuttered, with a fourth notch cut across the Aprons' three.
 */
function addLane(data: MapData, set: Setter, _slim: Slim): void {
  // The gutter, along the low side of the lane from the slaughterhouse's door down to the pool.
  for (const [x, y] of [[46, 28], [47, 29], [48, 29], [49, 30], [45, 29], [45, 30]] as const) {
    if (data.terrain[y]?.[x] === Terrain.Water) continue;
    placeObject(data, { key: `sh-gutter-${(x + y) % 2}`, tx: x, ty: y, w: 1, h: 1, flat: true });
  }
  set('sh-offalcart', 40, 28, 2, 1, { shapes: [box(0.1, 0.2, 1.9, 0.85)] });
  data.sights!.push(
    {
      id: 'sh-offalcart', gx: 41, gy: 29.1, label: 'Look in the cart', z: 26,
      thought: "A knacker's cart, a tarpaulin over its load. A hoof sticks out from under the edge. I don't lift the tarpaulin.",
    },
    {
      id: 'sh-gutter', gx: 47.5, gy: 29.5, label: 'Look at the gutter', z: 2,
      thought: 'A gutter down the middle of the lane, running red-brown from the slaughterhouse to the pool, and a skin of fat on it. A rat sits on the far side washing its face, quite unbothered by me.',
    },
    // Tam Rudd's, across the way: see world/GloomhavenMap.ts's houses.
    {
      id: 'sh-tamsdoor', gx: 39.5, gy: 36.2, label: 'Look at the door', z: 30,
      thought:
        'Shutters nailed shut, the door barred from outside. Three notches in its post, like the others in the lane, and a fourth cut hard across them, fresh. ' +
        'A neighbour leaning out of her window says this is Tam Rudd\'s, and he hasn\'t been home in a week, and if I know what\'s good for me I haven\'t seen him either.',
    },
  );
  data.landmarks!.push({ gx: 47, gy: 28.5, name: 'The Shambles', range: 4 });
  data.musings!.push({
    x0: 43, y0: 27, x1: 50, y1: 30,
    text: 'The Shambles. A pig screams, somewhere behind those doors, and stops. Nobody in the lane so much as turns their head.',
  });
}
