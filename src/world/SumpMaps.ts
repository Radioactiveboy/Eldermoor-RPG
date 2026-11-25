import { box, circle } from './Collision';
import { MapData, MapObject, placeObject, Prop, Terrain } from './MapData';

/**
 * Homes in the Sump: the lowest, wettest corner of Gloomhaven, down Sump Lane
 * in the west quarter, where the town sinks into its pools (the houses stand
 * in world/GloomhavenMap.ts). Four rooms, each one someone's whole life:
 *
 * - The Crowes' cottage: Annis Crowe, who scrubs pots at the Black Rose, and
 *   her girl Tansy, whom the square calls Wisp. One room, a box bed and a
 *   straw pallet, a little fire, a sewing box with a secret in it.
 * - Ned Wick's stilt house, out over the pool: the lamplighter's poles and
 *   oil and wicks, a hammock, gaps between the boards and black water under
 *   them, and a trap in the floor he fishes through.
 * - The Widow Pruett's hovel: Nan Pruett at her window making rushlights, as
 *   she has for fifty years, her drowned husband's oilskin still on its peg,
 *   and her cat.
 * - The burnt house, where Jory Cotter the lighterman lived until three nights
 *   after he said no: roofless, black, ash underfoot, and under the hearthstone
 *   what he hid.
 */

/** The Crowes' box bed (a save point? no: it's theirs) and where Annis's sewing box is, for the quest. */
export const CROWE_SEWING = { gx: 4.5, gy: 0.6 };
/** The loose hearthstone in the burnt house. */
export const RUIN_HEARTH = { gx: 1.5, gy: 0.75 };

function emptyRoom(w: number, h: number): Pick<MapData, 'width' | 'height' | 'terrain' | 'props'> {
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < h; y++) {
    terrain.push(new Array(w).fill(Terrain.Floor));
    props.push(new Array(w).fill(Prop.None));
  }
  return { width: w, height: h, terrain, props };
}

const stoolShape = [circle(0.5, 0.5, 0.15)];
const crateShape = [box(0.1, 0.1, 0.9, 0.9)];
const bucketShape = [circle(0.5, 0.5, 0.18)];

/** The walls of one of the Sump's houses: `style` is whose (see art/sump.ts), the kinds one per tile along each wall. */
const wall = (style: string, side: 'back' | 'side', kinds: string[]) => kinds.map((k, i) => `sp-${style}-${side}-${k}-${i % 2}`);

type Adder = (key: string, tx: number, ty: number, extra?: Partial<MapObject>) => void;
const adder = (data: MapData): Adder => (key, tx, ty, extra = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });

/**
 * The Crowes' cottage on Sump Lane: one low room under a holed thatch. The
 * little hearth and its kettle in the far corner, Annis's box bed with its
 * curtain along the back wall, her dresser of odd crockery, her sewing box on
 * the chest; Wisp's straw pallet under the window on the right, with her tin
 * of treasures; a table and two stools on a rag rug; a tin tub of washing; a
 * line of it strung along the wall; a bucket under the hole in the thatch.
 */
export function buildCroweMap(): MapData {
  const W = 7;
  const H = 6;
  const door = { x: 1.2, y: 4.5 };
  const data: MapData = {
    ...emptyRoom(W, H),
    spawn: door,
    indoor: true,
    music: 'menu',
    groundShade: 0xa8a29a,
    walls: {
      back: wall('crowe', 'back', ['plain', 'brace', 'saint', 'window', 'plain', 'brace', 'pegs']),
      side: wall('crowe', 'side', ['plain', 'shelf', 'line', 'plain', 'door', 'plain']),
      corner: 'sp-crowe-corner',
    },
    doors: [{ tx: 0, ty: 4, to: 'gloomhaven', entry: 'crowe', label: 'Go out to Sump Lane' }],
    entries: { door },
    lights: [
      { gx: 1.5, gy: 0.8, z: 14, radius: 200, flicker: 1 },
      { gx: 3.5, gy: 2.4, z: 26, radius: 70, flicker: 0.5 },
      { gx: 3.5, gy: 0.3, z: 50, radius: 60, flicker: 0.2 },
    ],
    // Annis home from the Rose of an evening, until the bell; Wisp at home from dark until morning.
    npcs: [
      { id: 'annis', gx: 3.5, gy: 3.45, looking: { x: 0, y: -1 }, hours: [17, 24], seated: true },
      { id: 'wisp-home', gx: 6.5, gy: 4.3, looking: { x: -1, y: 0 }, hours: [21, 31], seated: true },
    ],
    seats: [],
    sights: [],
    drips: [{ gx: 5.5, gy: 4.5, z: 90 }],
  };
  const add = adder(data);

  // On the floor: the rag rug, a puddle under the hole in the thatch, a smear of mud in at the door.
  add('sp-ragrug', 2, 2, { w: 2, h: 2, flat: true });
  add('br-puddle-1', 5, 4, { flat: true });
  add('br-mud-0', 1, 4, { w: 2, flat: true });

  // The hearth in the corner, a basket of peat beside it.
  add('sp-peatbasket', 0, 0, { shapes: [circle(0.5, 0.5, 0.3)] });
  add('sp-hearth', 1, 0, { anim: 'sp-hearth-fire' });
  // Along the back: a stool by the fire, the sewing chest, Annis's box bed, her dresser.
  add('sp-sewing', 4, 0, { shapes: [box(0.1, 0.15, 0.9, 0.85)] });
  add('sp-boxbed', 5, 0, { h: 2 });
  add('sp-dresser', 6, 0, { shapes: [box(0.1, 0.05, 0.95, 0.75)] });
  add('sp-washtub', 0, 2, { shapes: [circle(0.5, 0.5, 0.38)] });

  // The table, and the stool Annis sits on to mend; the other one is Wisp's.
  add('sp-table', 3, 2, { shapes: [box(0.12, 0.12, 0.88, 0.88)] });
  add('br-stool', 3, 3, { shapes: stoolShape });
  add('br-stool', 2, 1, { shapes: stoolShape });
  data.seats!.push({ name: 'crowe-table', gx: 2.5, gy: 1.5, faceX: 1, faceY: 1, standX: 2.5, standY: 2.5 });

  // Wisp's corner: her pallet under the window, her tin of treasures, her doll.
  add('sp-pallet', 6, 3, { h: 2, shapes: [box(0.05, 0.1, 0.95, 1.9)] });
  add('sp-treasure', 6, 5, { shapes: [box(0.2, 0.2, 0.8, 0.8)] });
  add('br-bucket', 5, 4, { shapes: bucketShape });

  data.sights!.push(
    {
      id: 'crowe-sewing', gx: CROWE_SEWING.gx, gy: CROWE_SEWING.gy, label: 'Look in the sewing box', z: 26,
      thought: "Annis's sewing box: a darning egg, a card of buttons, a pincushion like a hedgehog, wool in every grey there is. It's old and it's been mended itself.",
    },
    {
      id: 'crowe-saint', gx: 2.5, gy: 0.12, label: 'Look', z: 60,
      thought: 'A little shelf with a candle stub on it, a dried primrose, and a bird whittled out of driftwood, very carefully, by somebody with big hands. The candle has never been lit. It is being saved.',
    },
    {
      id: 'crowe-window', gx: 3.5, gy: 0.12, label: 'Look out', z: 60,
      thought: 'Sump Lane, and the pool, and the stilt house on its legs over the water. Beyond the roofs, the back of the Black Rose, and one lit window in it.',
    },
    {
      id: 'crowe-treasure', gx: 6.5, gy: 5.45, label: 'Look', z: 16,
      thought: "A biscuit tin with a ship on the lid. Inside: buttons, a brass thimble, a blue glass bead, a key to nothing, two hairpins, a tin soldier with no head, and a gull's feather. Every one of them pinched. Every one of them treasured.",
    },
    {
      id: 'crowe-pallet', gx: 6.5, gy: 4, label: 'Look', z: 10,
      thought: 'A straw pallet with a patched blanket, and on the pillow a rag fox with button eyes, worn bald with love. One ear has been sewn back on with grey wool.',
    },
    {
      id: 'crowe-boxbed', gx: 5.5, gy: 1.2, label: 'Look', z: 30,
      thought: "Annis's box bed, its curtain drawn half across. The blanket is folded square and the pillow plumped, as if she's never once got into it.",
    },
    {
      id: 'crowe-dresser', gx: 6.5, gy: 0.45, label: 'Look', z: 50,
      thought: 'Two cups that do not match, a jug with a chip, three bowls, a tea caddy with no tea in it. On the top shelf, turned to the wall, a picture of a man in a lighterman\'s cap.',
    },
    {
      id: 'crowe-washing', gx: 0.15, gy: 2.5, label: 'Look', z: 54,
      thought: "A line of washing along the wall: a child's smock, two pairs of stockings, an apron with ROSE stitched on the bib in red. None of it has dried since the summer.",
    },
  );
  return data;
}

/**
 * Ned Wick's stilt house, out on its legs over the pool off Sump Lane: one
 * room of grey boards with daylight (and the water) showing between them. The
 * lamplighter's poles racked by the door, his cans of oil and his bench of
 * wicks and lantern-glasses, a little iron stove, a hammock slung under the
 * window, and the trap in the floor, propped open, that he fishes through.
 */
export function buildStiltMap(): MapData {
  const W = 6;
  const H = 5;
  const door = { x: 1.2, y: 3.5 };
  const data: MapData = {
    ...emptyRoom(W, H),
    spawn: door,
    indoor: true,
    music: 'menu',
    groundShade: 0xa4aaa8,
    walls: {
      back: wall('stilt', 'back', ['plain', 'lamps', 'plain', 'window', 'plain', 'nets']),
      side: wall('stilt', 'side', ['plain', 'brace', 'plain', 'door', 'plain']),
      corner: 'sp-stilt-corner',
    },
    doors: [{ tx: 0, ty: 3, to: 'gloomhaven', entry: 'stilt', label: 'Go out onto the boards' }],
    entries: { door },
    lights: [
      { gx: 0.6, gy: 0.6, z: 18, radius: 160, flicker: 0.8 },
      { gx: 2, gy: 0.7, z: 36, radius: 110, flicker: 0.4 },
      { gx: 3.5, gy: 3.5, z: 2, radius: 50, flicker: 0.9 },
    ],
    // Ned sleeps by day and lights the lanes at dusk: at home through the afternoon, mending lamps.
    npcs: [{ id: 'ned', gx: 2.5, gy: 1.5, looking: { x: 0, y: 1 }, hours: [6, 17] }],
    seats: [],
    sights: [],
    drips: [{ gx: 4.5, gy: 3.5, z: 80 }],
  };
  const add = adder(data);

  add('sp-gaps-0', 1, 1, { w: 2, flat: true });
  add('sp-gaps-1', 4, 2, { w: 2, flat: true });
  add('sp-gaps-0', 2, 4, { w: 2, flat: true });
  add('sp-trap', 3, 3, { flat: true });
  add('br-mud-1', 1, 3, { w: 2, flat: true });

  add('sp-stove', 0, 0, { shapes: [box(0.15, 0.15, 0.85, 0.85)] });
  add('sp-wickbench', 1, 0, { w: 2, shapes: [box(0.05, 0.1, 1.95, 0.8)] });
  add('sp-hammock', 3, 0, { w: 2, h: 2, blocks: [[0, 0], [1, 0]], shapes: [box(0.05, 0.05, 1.95, 0.8)] });
  add('sp-oilcans', 5, 0, { shapes: [box(0.1, 0.1, 0.9, 0.9)] });
  add('sp-poles', 0, 1, { shapes: [box(0.05, 0.1, 0.5, 0.9)] });
  add('sp-eeltrap', 5, 3, { shapes: [box(0.15, 0.1, 0.85, 0.9)] });
  add('sp-ropecoil', 5, 4, { shapes: [circle(0.5, 0.5, 0.3)] });
  add('br-stool', 2, 2, { shapes: stoolShape });
  add('br-crate', 0, 4, { shapes: crateShape });

  data.sights!.push(
    {
      id: 'stilt-trap', gx: 3.5, gy: 3.5, label: 'Look down the trap', z: 4,
      thought: 'Black water, a man\'s height down, and the stilts going into it slimy and green. A line is tied off to a nail with a cork bobbing on it. Something under there is nibbling the bait, very gently.',
    },
    {
      id: 'stilt-bench', gx: 1.8, gy: 0.45, label: 'Look', z: 30,
      thought: 'Wicks, trimmed and coiled. Lantern-glasses, one cracked, every one polished. A pot of soot scraped off them. A list chalked on the wall above in pictures: a lamp, a lamp, a lamp, a cross through one. Somebody here cannot read, and somebody here is very careful.',
    },
    {
      id: 'stilt-hammock', gx: 4, gy: 0.6, label: 'Look', z: 20,
      thought: 'A sailcloth hammock slung under the window, a blanket in a knot in the bottom of it. There is a boat-hook hung over it, carved on the handle: J.C.',
    },
    {
      id: 'stilt-oil', gx: 5.5, gy: 0.5, label: 'Look', z: 24,
      thought: "Cans of lamp oil, a funnel, a dipper. The whole house smells of it. One spark in here and it would go up like... I'd rather not finish that thought, not on this lane.",
    },
    {
      id: 'stilt-window', gx: 3.5, gy: 0.12, label: 'Look out', z: 58,
      thought: "Across the pool: the black shell of the burnt house. From here you'd see anyone coming and going at its door. You'd see everything.",
    },
  );
  return data;
}

/**
 * The Widow Pruett's hovel, at the bottom of Sump Lane: one tiny room. Her
 * chair at the window, where she sits peeling rushes and dipping them in
 * tallow, the rushlights burning in their iron nips on the table beside her;
 * a peat fire; her cot with its patchwork; the cat in its basket; bundles of
 * rushes drying along the wall; and her husband's oilskin and hat on their
 * peg, where he left them forty years ago, the morning he didn't come back.
 */
export function buildPruettMap(): MapData {
  const W = 5;
  const H = 5;
  const door = { x: 1.2, y: 3.5 };
  const data: MapData = {
    ...emptyRoom(W, H),
    spawn: door,
    indoor: true,
    music: 'menu',
    groundShade: 0xa09a90,
    walls: {
      back: wall('pruett', 'back', ['plain', 'window', 'plain', 'oilskin', 'brace']),
      side: wall('pruett', 'side', ['brace', 'rushes', 'plain', 'door', 'plain']),
      corner: 'sp-pruett-corner',
    },
    doors: [{ tx: 0, ty: 3, to: 'gloomhaven', entry: 'pruett', label: 'Go out to the lane' }],
    entries: { door },
    lights: [
      { gx: 2.5, gy: 0.8, z: 12, radius: 150, flicker: 0.9 },
      { gx: 2.4, gy: 1.4, z: 30, radius: 90, flicker: 0.7 },
    ],
    // She is always here. She has nowhere else to be.
    npcs: [{ id: 'nan', gx: 1.55, gy: 1.5, looking: { x: 1, y: 0 }, seated: true }],
    seats: [],
    sights: [],
    drips: [],
  };
  const add = adder(data);

  add('sp-ragrug-small', 1, 3, { w: 2, flat: true });
  add('br-mud-1', 1, 3, { w: 2, flat: true });
  add('sp-rushbundle', 0, 0, { shapes: [box(0.1, 0.1, 0.9, 0.7)] });
  add('sp-armchair', 1, 1, { shapes: [box(0.2, 0.2, 0.8, 0.8)] });
  add('sp-hearth-peat', 2, 0, { anim: 'sp-hearth-peat-fire' });
  add('br-chest', 3, 0, { shapes: [box(0.1, 0.2, 0.9, 0.8)] });
  add('sp-cot', 4, 0, { h: 2 });
  add('sp-rushtable', 2, 1, { shapes: [box(0.15, 0.15, 0.85, 0.85)] });
  add('sp-catbasket', 3, 2, { shapes: [circle(0.5, 0.5, 0.3)] });
  add('br-bucket', 4, 4, { shapes: bucketShape });

  data.sights!.push(
    {
      id: 'pruett-oilskin', gx: 3.5, gy: 0.12, label: 'Look', z: 60,
      thought: 'An oilskin coat and a sou\'wester on a peg, stiff with forty years of dust. There\'s a pipe still in the coat pocket. Nobody has touched them, and you can tell nobody ever will.',
    },
    {
      id: 'pruett-rushes', gx: 2.5, gy: 1.4, label: 'Look', z: 26,
      thought: 'Rushes peeled to the pith and dipped in mutton fat, laid in rows to set. A rushlight burns in an iron nip, steady and small. A farthing a dozen, and she must have made a million of them.',
    },
    {
      id: 'pruett-cat', gx: 3.5, gy: 2.5, label: 'Stroke the cat', z: 10,
      thought: 'An old black cat with a white chin, curled nose to tail. It opens one yellow eye, considers me, decides I am not worth the trouble, and goes back to sleep. It purrs anyway.',
    },
    {
      id: 'pruett-window', gx: 1.5, gy: 0.12, label: 'Look out', z: 58,
      thought: 'The lane, the burnt house, the pool, the stilt house, the Crowes\' door. From this chair you can see the whole of the Sump, and everyone in it, and everyone who comes into it.',
    },
    {
      id: 'pruett-cot', gx: 4.5, gy: 1.2, label: 'Look', z: 20,
      thought: 'A narrow cot with a patchwork quilt: every patch from a dress, a shirt, a sail. A whole life, sewn into squares.',
    },
  );
  return data;
}

/**
 * The burnt house, where Jory Cotter lived: what the fire left. No roof but
 * the sky, the walls black to the tops, ash and wet char underfoot, a beam
 * come down across the room, the bed burnt to its frame, the table on its
 * side, the hearth cold, and under its stone what he hid there.
 */
export function buildSumpRuinMap(): MapData {
  const W = 7;
  const H = 6;
  const door = { x: 1.2, y: 4.5 };
  const data: MapData = {
    ...emptyRoom(W, H),
    spawn: door,
    indoor: true,
    cold: true,
    music: 'ruin',
    groundShade: 0x5a5654,
    walls: {
      back: wall('ruin', 'back', ['plain', 'window', 'hole', 'plain', 'brace', 'window', 'plain']),
      side: wall('ruin', 'side', ['plain', 'hole', 'plain', 'brace', 'door', 'plain']),
      corner: 'sp-ruin-corner',
    },
    doors: [{ tx: 0, ty: 4, to: 'gloomhaven', entry: 'ruin', label: 'Go out to the lane' }],
    entries: { door },
    // No fire: the only light is the sky through where the roof was, and the town's glow.
    lights: [
      { gx: 3.5, gy: 2.5, z: 120, radius: 220, flicker: 0.05 },
      { gx: 2.5, gy: 0.3, z: 50, radius: 60, flicker: 0.1 },
    ],
    seats: [],
    sights: [],
    drips: [
      { gx: 2.5, gy: 3.5, z: 100 },
      { gx: 5.5, gy: 2.5, z: 100 },
    ],
  };
  const add = adder(data);

  for (const [k, x, y] of [[0, 1, 1], [1, 3, 1], [2, 4, 3], [0, 2, 4], [1, 5, 4], [2, 1, 2], [0, 5, 2]] as const) add(`sp-ash-${k}`, x, y, { flat: true });
  add('br-puddle-0', 2, 3, { flat: true });
  add('br-puddle-2', 5, 2, { flat: true });

  add('sp-hearth-cold', 1, 0);
  add('sp-burntbed', 5, 0, { h: 2 });
  add('sp-beam', 2, 2, { w: 3, blocks: [[0, 0], [2, 0]], shapes: [box(0.1, 0.25, 0.6, 0.75), box(2.4, 0.25, 2.9, 0.75)] });
  add('sp-burnttable', 3, 4, { shapes: [box(0.1, 0.15, 0.9, 0.85)] });
  add('sp-rubble-0', 6, 3, { shapes: [circle(0.5, 0.5, 0.36)] });
  add('sp-rubble-1', 0, 0, { shapes: [circle(0.5, 0.5, 0.36)] });
  add('sp-rubble-1', 4, 0, { shapes: [circle(0.5, 0.5, 0.36)] });
  add('sp-burntchair', 6, 5, { shapes: [box(0.2, 0.2, 0.8, 0.8)] });

  data.sights!.push(
    {
      id: 'ruin-hearthstone', gx: RUIN_HEARTH.gx, gy: RUIN_HEARTH.gy, label: 'Look at the hearth', z: 10,
      thought: 'A cold hearth full of black water and ash. The big flat stone in front of it rocks, very slightly, when I tread on its edge.',
    },
    {
      id: 'ruin-bed', gx: 5.5, gy: 1, label: 'Look', z: 18,
      thought: 'The bed, burnt to its iron. No blanket, no straw, nothing but springs and ash. Whoever was in it that night, if anyone was, was not found in it.',
    },
    {
      id: 'ruin-beam', gx: 3.5, gy: 2.5, label: 'Look', z: 20,
      thought: 'The roof-tree, come down across the room, charred to the heart. It cracks like old bread under my thumb.',
    },
    {
      id: 'ruin-table', gx: 3.5, gy: 4.5, label: 'Look', z: 14,
      thought: 'The table, on its side, half burnt. Under it a pewter cup has melted into a shining puddle and set. Two cups. He had somebody over, or meant to.',
    },
    {
      id: 'ruin-chair', gx: 6.5, gy: 5.5, label: 'Look', z: 14,
      thought: 'A chair by where the window was. A lighterman\'s boots beside it, burnt to the shape of the feet that were in them. Not in them that night. Standing ready.',
    },
    {
      id: 'ruin-hole', gx: 2.5, gy: 0.12, label: 'Look', z: 58,
      thought: 'The wall burnt clean through. Through the hole: the pool, and the stilt house on its legs, and the lamplighter\'s window. It looks straight in here.',
    },
    {
      id: 'ruin-back-hole', gx: 0.12, gy: 1.5, label: 'Look', z: 40,
      thought: 'A hole burnt low in the wall at the back, right down to the mud. Big enough for a man to get through, if he had to, on his belly, into the reeds and the pool beyond.',
    },
  );
  return data;
}
