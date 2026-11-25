import { QuestLog } from '../systems/Quests';
import { SHAMBLES_FLAGS } from '../systems/Shambles';
import { box, circle } from './Collision';
import { MapData, MapObject, placeObject, Prop, Terrain } from './MapData';

/**
 * Inside the Shambles, Gloomhaven's east quarter (the buildings themselves are
 * in world/ShamblesYard.ts, their art in art/shambles.ts): Saul Rendle's
 * slaughterhouse, Morrow Vetch's tannery and the drying loft over it where
 * Tam Rudd is hiding, Old Scritch the rat-catcher's den, and the barn behind
 * the tannery where the Red Aprons fight dogs.
 *
 * Who's where depends on how things have gone (see scenes/game/shambles.ts):
 * Nothing is in a pen in the barn until she's freed, and then about Scritch's
 * den; Lugs goes with her if he's the one who let her out; Tam leaves the loft
 * once his debt is settled one way or another; and after a fight in the barn
 * Flay and his knacker are elsewhere, licking their wounds.
 */


function emptyRoom(w: number, h: number, floor: Terrain): Pick<MapData, 'width' | 'height' | 'terrain' | 'props'> {
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < h; y++) {
    terrain.push(new Array(w).fill(floor));
    props.push(new Array(w).fill(Prop.None));
  }
  return { width: w, height: h, terrain, props };
}

const wall = (prefix: string, side: 'back' | 'side', kinds: string[]) => kinds.map((k, i) => `${prefix}-wall-${side}-${k}-${i % 2}`);
const adder = (data: MapData) => (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });

const barrelShape = [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)];
const roundShape = [circle(0.5, 0.5, 0.32)];
const benchShape = [box(0.08, 0.15, 1.92, 0.85)];
const penShape = [box(0, 0, 0.08, 1), box(0.92, 0, 1, 1)];

/** The slaughterhouse's floor goes pinkish-grey under the walls, the whitewash splashed. */
const RAW = 0xb4a4a4;
const TANNED = 0x9a8e7a;
const BARN = 0x8a8478;

/**
 * Rendle's slaughterhouse. The door from the lane is in the left-hand wall
 * near the front. The killing floor runs along the back: the pen where the
 * beasts wait, the hoist and the hook frame, the scalding vat over its fire,
 * the carcass rail hung with halves; a drain down the middle of the floor to
 * a grate. The shop end is on the right: the counter with its joints and the
 * cutting bench, sawdust down. Rendle watches from the middle of the floor,
 * in his white shirt, and Gristle works the block.
 */
export function buildSlaughterhouseMap(): MapData {
  const W = 12;
  const H = 9;
  const door = { x: 1.2, y: 6.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Stone),
    spawn: door,
    indoor: true,
    groundShade: RAW,
    walls: {
      back: wall('shk', 'back', ['plain', 'brace', 'hoist', 'hooks', 'plain', 'window', 'brace', 'hooks', 'sausages', 'plain', 'tools', 'window']),
      side: wall('shk', 'side', ['plain', 'window', 'notches', 'brace', 'tools', 'plain', 'door', 'plain', 'window']),
      corner: 'shk-wall-corner',
    },
    doors: [{ tx: 0, ty: 6, to: 'gloomhaven', entry: 'slaughterhouse', label: 'Go outside' }],
    entries: { door },
    lights: [
      { gx: 5.5, gy: 0.9, z: 10, radius: 160, flicker: 1 },
      { gx: 2.5, gy: 1.2, z: 56, radius: 110, flicker: 0.5 },
      { gx: 9.5, gy: 5.2, z: 50, radius: 140, flicker: 0.4 },
      { gx: 5.5, gy: 0.2, z: 60, radius: 120, flicker: 0, daylight: true },
      { gx: 11.5, gy: 0.2, z: 60, radius: 120, flicker: 0, daylight: true },
      { gx: 0.2, gy: 1.5, z: 60, radius: 110, flicker: 0, daylight: true },
    ],
    npcs: [
      { id: 'rendle', gx: 6.5, gy: 5.6, looking: { x: -1, y: -1 }, hours: [6, 21] },
      { id: 'gristle', gx: 4.5, gy: 3.9, looking: { x: 0, y: -1 }, hours: [5, 19] },
    ],
    sights: [],
  };
  const add = adder(data);
  // On the floor: the drain down the middle to the grate, blood where it misses, sawdust at the shop end.
  for (let x = 1; x <= 8; x++) if (x !== 6) add('sh-drain-x', x, 4, { flat: true });
  add('sh-grate', 6, 4, { flat: true });
  add('sh-stain-0', 3, 3, { flat: true });
  add('sh-stain-1', 5, 2, { flat: true });
  add('sh-stain-2', 2, 5, { flat: true });
  add('sh-stain-0', 7, 3, { flat: true });
  add('sh-sawdust', 9, 6, { w: 2, flat: true });
  add('sh-sawdust', 9, 7, { w: 2, flat: true });
  // The killing floor along the back wall.
  add('sh-killpen', 0, 0);
  add('sh-killpen', 1, 0);
  add('sh-hookframe', 2, 1, { w: 2, shapes: [box(0.1, 0.4, 0.3, 0.6), box(1.7, 0.4, 1.9, 0.6)] });
  add('sh-scaldvat', 4, 0, { w: 2 });
  add('sh-bloodtub', 6, 1, { shapes: roundShape });
  add('sh-block', 4, 3, { shapes: roundShape });
  add('sh-carcassrail', 7, 0, { w: 2, shapes: [box(0.1, 0.3, 1.9, 0.7)] });
  add('sh-bones', 9, 0);
  add('furn-barrels', 10, 0, { shapes: barrelShape });
  add('sh-bloodtub', 11, 0, { shapes: roundShape });
  // The shop end: the cutting bench and the counter, joints laid out on it.
  add('sh-bench', 9, 2, { w: 2, shapes: benchShape });
  add('sh-counter-0', 9, 5);
  add('sh-counter-1', 10, 5);
  add('sh-counter-2', 11, 5);
  add('sh-bones', 11, 8);
  data.sights!.push(
    { id: 'shk-killpen', gx: 1, gy: 0.6, label: 'Look', z: 20, thought: 'A pen of rails, the straw in it trodden to muck. Whatever waits here waits where it can see the hook. They put it there on purpose, or they never thought about it at all. I don\'t know which is worse.' },
    { id: 'shk-hoist', gx: 2.5, gy: 0.15, label: 'Look', z: 70, thought: 'A block and tackle up in the rafters, the rope black and stiff. The hook on the end of it is as big as my hand, and it\'s been scrubbed clean. The only clean thing on this wall.' },
    { id: 'shk-scald', gx: 5, gy: 0.7, label: 'Look', z: 30, thought: 'The scalding vat, steaming over its fire. A grey scum of bristles floats on the water. The heat of it hits my face from here, and the smell sits at the back of my throat.' },
    { id: 'shk-rail', gx: 8, gy: 0.5, label: 'Look', z: 60, thought: 'Halves of pig on the rail, split nose to tail, swinging very slightly. There are more halves than there are pigs in the pen. There are always more halves than pigs.' },
    { id: 'shk-drain', gx: 6.5, gy: 4.5, label: 'Look', z: 2, thought: 'A channel in the flags, running down to an iron grate. It\'s been sluiced, but not well enough. Something pink is stuck in the bars. I stop looking.' },
    { id: 'shk-notches', gx: 0.15, gy: 2.5, label: 'Look', z: 46, thought: 'Three cleaver notches cut in a doorpost that isn\'t a door any more. The Red Aprons\' mark. Under it, smaller, rows and rows of tally scratches. Rendle doesn\'t write his debts down, they say. Somebody here does.' },
    { id: 'shk-counter', gx: 10.5, gy: 5.5, label: 'Look', z: 26, thought: 'Joints laid out on the counter on a bed of dock leaves, and a chalk price above each. "MUTTON". It isn\'t. The legs are too long for mutton. I have eaten "mutton" at the Rose.' },
    { id: 'shk-sausages', gx: 8.5, gy: 0.15, label: 'Look', z: 62, thought: 'Strings of black sausages hung up on the wall to dry, and a cloud of flies keeping them company. The flies look well fed.' },
    { id: 'shk-tools', gx: 10.5, gy: 0.15, label: 'Look', z: 50, thought: 'Knives, saws, a poleaxe and the knacker\'s hammers, hung in order of size on pegs, every one of them oiled and sharp. Rendle\'s hands are very clean. His tools are cleaner.' },
  );
  return data;
}

/**
 * Vetch's tannery. The door from the yard is in the left-hand wall. Along the
 * back: the lime vat for the raw hides, three vats of bark liquor darkening
 * from weak to strong, the bark copper on its fire; the ladder up to the
 * drying loft in the far corner. Vetch scrapes hides at his beam in the
 * middle of the floor, with finished leather stacked behind him and a heap
 * of raw hides by the door.
 */
export function buildTanneryMap(): MapData {
  const W = 12;
  const H = 8;
  const door = { x: 1.2, y: 5.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Dirt),
    spawn: door,
    indoor: true,
    groundShade: TANNED,
    walls: {
      back: wall('shn', 'back', ['plain', 'hides', 'brace', 'plain', 'window', 'hides', 'plain', 'tools', 'brace', 'plain', 'shelf', 'hatch']),
      side: wall('shn', 'side', ['plain', 'hides', 'window', 'brace', 'plain', 'door', 'tools', 'plain']),
      corner: 'shn-wall-corner',
    },
    doors: [
      { tx: 0, ty: 5, to: 'gloomhaven', entry: 'tannery', label: 'Go outside' },
      { tx: 11, ty: 1, to: 'tannery-loft', entry: 'ladder', label: 'Climb to the loft', facing: 'back' },
    ],
    entries: { door, loft: { x: 11.5, y: 1.7 } },
    lights: [
      { gx: 9.5, gy: 0.8, z: 10, radius: 170, flicker: 1 },
      { gx: 6.5, gy: 4.2, z: 48, radius: 130, flicker: 0.5 },
      { gx: 4.5, gy: 0.2, z: 60, radius: 120, flicker: 0, daylight: true },
      { gx: 0.2, gy: 2.5, z: 60, radius: 120, flicker: 0, daylight: true },
    ],
    npcs: [{ id: 'vetch', gx: 6.5, gy: 5.3, looking: { x: 0, y: -1 }, hours: [6, 20] }],
    sights: [],
  };
  const add = adder(data);
  add('sh-vat-lime', 0, 0, { shapes: roundShape });
  add('sh-vat-0', 2, 0, { shapes: roundShape });
  add('sh-vat-1', 3, 0, { shapes: roundShape });
  add('sh-vat-2', 4, 0, { shapes: roundShape });
  add('sh-barkstack', 6, 0);
  add('sh-barkstack', 7, 0);
  add('sh-copper', 9, 0, { shapes: roundShape });
  add('sh-ladder', 11, 0);
  add('sh-fleshbeam', 6, 4);
  add('sh-leather', 9, 4);
  add('sh-leather', 10, 4);
  add('sh-dryrack-0', 2, 2, { w: 2, shapes: [box(0.1, 0.4, 1.9, 0.6)] });
  add('sh-dryrack-1', 8, 2, { w: 2, shapes: [box(0.1, 0.4, 1.9, 0.6)] });
  add('sh-hides', 2, 7);
  add('sh-hides', 3, 7);
  add('furn-barrels', 11, 7, { shapes: barrelShape });
  add('sh-purebarrow', 10, 6);
  data.sights!.push(
    { id: 'shn-lime', gx: 0.5, gy: 0.5, label: 'Look', z: 20, thought: 'The lime vat: hides soaking in milky water until the hair slips off them. My eyes start running a step away. Vetch\'s hands must have no skin left on them at all.' },
    { id: 'shn-vats', gx: 3.5, gy: 0.5, label: 'Look', z: 20, thought: 'Bark liquor in three vats, weak to strong, tea-coloured to black. The hides go from one to the next for a year, Vetch says, and come out leather. A year in the dark, soaking. That\'s what it takes to make something tough.' },
    { id: 'shn-copper', gx: 9.5, gy: 0.5, label: 'Look', z: 26, thought: 'Oak bark boiling in a copper. Of everything in the Shambles, this is the one smell that isn\'t foul: like a wood after rain. I stand in it for a moment, gratefully.' },
    { id: 'shn-leather', gx: 9.5, gy: 4.5, label: 'Look', z: 22, thought: 'Finished leather, stacked and rolled, brown and supple and good. Hard to believe it started in the lime vat. Vetch is good at this. He\'d be proud of it, if he let himself.' },
    { id: 'shn-hides', gx: 2.5, gy: 7.4, label: 'Look', z: 12, thought: 'Raw hides heaped by the door, salted, waiting. One of them is a dog\'s. A big brindled dog, scarred all over. I know where that came from.' },
    { id: 'shn-ladder', gx: 11.5, gy: 0.4, label: 'Look', z: 40, thought: 'A ladder up through a hatch to the drying loft. There\'s fresh mud on the rungs, and the hatch is pulled nearly shut from above. Vetch keeps his eyes on his beam and very carefully doesn\'t look at it.' },
  );
  return data;
}

/**
 * The drying loft over the tannery: louvred walls to let the wind through,
 * hides hung from the rafters in rows, and in the corner behind them the
 * nest Tam Rudd has made of sacks and straw.
 */
export function buildTanneryLoftMap(): MapData {
  const W = 9;
  const H = 5;
  const ladder = { x: 7.5, y: 2.6 };
  const tamHere = !QuestLog.hasFlag(SHAMBLES_FLAGS.tamGone);
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: ladder,
    indoor: true,
    groundShade: TANNED,
    walls: {
      back: wall('shl', 'back', ['louvre', 'hides', 'plain', 'louvre', 'brace', 'hides', 'plain', 'louvre', 'hatch']),
      side: wall('shl', 'side', ['plain', 'louvre', 'brace', 'hides', 'louvre']),
      corner: 'shl-wall-corner',
    },
    doors: [{ tx: 7, ty: 3, to: 'tannery', entry: 'loft', label: 'Climb down', facing: 'front' }],
    entries: { ladder },
    lights: [
      { gx: 0.5, gy: 0.2, z: 50, radius: 110, flicker: 0, daylight: true },
      { gx: 3.5, gy: 0.2, z: 50, radius: 110, flicker: 0, daylight: true },
      { gx: 7.5, gy: 0.2, z: 50, radius: 110, flicker: 0, daylight: true },
      { gx: 1.8, gy: 1.8, z: 20, radius: 70, flicker: 0.8 },
    ],
    npcs: tamHere ? [{ id: 'tam', gx: 2.6, gy: 2.4, looking: { x: 1, y: 0.5 } }] : [],
    sights: [],
  };
  const add = adder(data);
  add('sh-tamnest', 0, 1, { w: 2, flat: !tamHere });
  add('sh-dryrack-0', 3, 0, { w: 2, shapes: [box(0.1, 0.4, 1.9, 0.6)] });
  add('sh-dryrack-1', 5, 0, { w: 2, shapes: [box(0.1, 0.4, 1.9, 0.6)] });
  add('sh-dryrack-1', 3, 3, { w: 2, shapes: [box(0.1, 0.4, 1.9, 0.6)] });
  add('sh-leather', 0, 4);
  data.sights!.push(
    { id: 'shl-hides', gx: 4, gy: 0.5, label: 'Look', z: 50, thought: 'Hides hung over the poles like washing, stiffening in the draught through the louvres. They turn, a little, all together, when the wind gets up. It is like standing in a crowd of people with no insides.' },
    { id: 'shl-louvre', gx: 7.5, gy: 0.15, label: 'Look out', z: 56, thought: 'Through the slats: the tannery yard below, the pits, and the barn against the town wall. A big man in an apron is standing in the barn door, eating something, looking up at this loft. Then he goes back in.' },
  );
  if (tamHere) data.sights!.push({ id: 'shl-nest', gx: 1, gy: 1.5, label: 'Look', z: 10, thought: 'Sacks and straw pushed together into a bed, a candle-end stuck in a puddle of its own wax, crusts, a jug, and a cheap tin locket, open, with a girl\'s face painted in it. Someone has been living up here, and not well.' });
  else data.sights!.push({ id: 'shl-nest', gx: 1, gy: 1.5, label: 'Look', z: 6, thought: 'Where Tam\'s nest was: flattened straw and a dribble of candle wax. He took the locket.' });
  return data;
}

/**
 * Old Scritch's den, at the lane's end against the town wall: cages of live
 * rats for the pit (he hates selling them, and sells them), his traps and
 * poisons, his stove and his cot, and an empty dog bed by the stove until
 * Nothing is home to fill it.
 */
export function buildRatDenMap(): MapData {
  const W = 6;
  const H = 6;
  const door = { x: 1.2, y: 3.5 };
  const home = QuestLog.hasFlag(SHAMBLES_FLAGS.nothingFree);
  const lugs = QuestLog.hasFlag(SHAMBLES_FLAGS.lugsApprentice);
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: door,
    indoor: true,
    groundShade: 0x8a8070,
    walls: {
      back: wall('shr', 'back', ['cages', 'plain', 'shelf', 'window', 'traps', 'skins']),
      side: wall('shr', 'side', ['skins', 'traps', 'plain', 'door', 'window', 'shelf']),
      corner: 'shr-wall-corner',
    },
    doors: [{ tx: 0, ty: 3, to: 'gloomhaven', entry: 'ratden', label: 'Go outside' }],
    entries: { door },
    lights: [
      { gx: 2.5, gy: 0.8, z: 14, radius: 150, flicker: 1 },
      { gx: 3.5, gy: 0.2, z: 56, radius: 100, flicker: 0, daylight: true },
      { gx: 4.5, gy: 3.5, z: 40, radius: 70, flicker: 0.6 },
    ],
    npcs: [
      { id: 'scritch', gx: 3.4, gy: 2.6, looking: { x: -1, y: 0.5 } },
      ...(lugs ? [{ id: 'lugs', gx: 1.6, gy: 1.6, looking: { x: 0, y: -1 } }] : []),
    ],
    hounds: home ? [{ kind: 'lurcher', gx: 2.6, gy: 4.6, leash: 2 }] : [],
    sights: [],
  };
  const add = adder(data);
  add('sh-ratcages', 0, 0);
  add('sh-stove', 2, 0, { shapes: roundShape });
  add('sh-poisontable', 4, 0);
  add('sh-traps', 5, 0);
  add('sh-hutch', 0, 5);
  add('sh-cot', 5, 2, { h: 2 });
  add('sh-dogbed', 3, 5, { flat: true });
  add('furn-stool', 4, 2, { shapes: [circle(0.5, 0.5, 0.15)] });
  data.sights!.push(
    { id: 'shr-cages', gx: 0.5, gy: 0.5, label: 'Look', z: 30, thought: 'Wire cages stacked to the rafters, full of rats: brown ones, black ones, a white one with red eyes on its own. All of them watching me. Every few heartbeats they all move at once, like one animal.' },
    { id: 'shr-poison', gx: 4.5, gy: 0.5, label: 'Look', z: 24, thought: 'Jars and twists of paper on a little table, labelled in a careful, spidery hand: ARSENIC. RED SQUILL. HELLEBORE. "NOT FOR THE DOG". That last jar is the only one with a lid tied on.' },
    { id: 'shr-dogbed', gx: 3.5, gy: 5.5, label: 'Look', z: 6, thought: home
      ? 'The dog bed by the stove, a grey dog curled in it nose to tail, one eye open on me. She\'s home.'
      : 'A dog bed by the stove, an old sack stuffed with straw, worn hollow in the middle in the shape of a dog. There\'s a bowl beside it, filled, and the water in it fresh. Nobody has eaten from it.' },
    { id: 'shr-skins', gx: 0.15, gy: 0.5, label: 'Look', z: 50, thought: 'Rat skins tacked to the wall in rows, drying. Somebody buys them. I really don\'t want to know who.' },
    { id: 'shr-cot', gx: 5.5, gy: 3, label: 'Look', z: 14, thought: 'An old man\'s cot, the blanket folded with a soldier\'s care. A little carved wooden dog sits on the shelf over it.' },
  );
  return data;
}

/**
 * The barn behind the tannery, against the town wall, where the Red Aprons
 * fight dogs (and rats, and men, if the stakes are right). The ring of
 * boards in the middle, tiered planks round it for the crowd, the dogs in
 * pens along the back with their chains in the wall, Flay's table
 * and cash box by the door, a barrel of rats. Flay and Gristle are here from
 * the afternoon; Lugs, who minds the dogs, all day.
 */
export function buildDogPitMap(): MapData {
  const W = 10;
  const H = 9;
  const door = { x: 1.2, y: 6.5 };
  const free = QuestLog.hasFlag(SHAMBLES_FLAGS.nothingFree);
  const lugsGone = QuestLog.hasFlag(SHAMBLES_FLAGS.lugsApprentice);
  const fought = QuestLog.hasFlag(SHAMBLES_FLAGS.pitFought);
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Dirt),
    spawn: door,
    indoor: true,
    groundShade: BARN,
    walls: {
      back: wall('shp', 'back', ['plain', 'brace', 'chalk', 'plain', 'lantern', 'plain', 'brace', 'chains', 'chains', 'chains']),
      side: wall('shp', 'side', ['chains', 'plain', 'brace', 'lantern', 'boarded', 'plain', 'door', 'plain', 'chalk']),
      corner: 'shp-wall-corner',
    },
    doors: [{ tx: 0, ty: 6, to: 'gloomhaven', entry: 'pitbarn', label: 'Go outside' }],
    entries: { door },
    lights: [
      { gx: 5, gy: 2.2, z: 44, radius: 200, flicker: 0.7 },
      { gx: 4.5, gy: 0.2, z: 60, radius: 90, flicker: 0.6 },
      { gx: 0.2, gy: 3.5, z: 60, radius: 90, flicker: 0.6 },
      { gx: 1.8, gy: 7.6, z: 26, radius: 80, flicker: 0.5 },
    ],
    npcs: [
      ...(fought ? [] : [
        { id: 'flay', gx: 2.6, gy: 7.4, looking: { x: 1, y: -1 }, hours: [14, 28] as [number, number] },
        { id: 'gristle', gx: 7.4, gy: 6.6, looking: { x: -1, y: -1 }, hours: [19, 28] as [number, number] },
      ]),
      ...(lugsGone ? [] : [{ id: 'lugs', gx: 7.6, gy: 2.5, looking: { x: 1, y: -1 } }]),
    ],
    hounds: [
      { kind: 'pitdog', gx: 7.5, gy: 1.15, leash: 0 },
      { kind: 'pitdog', gx: 9.5, gy: 1.15, leash: 0 },
      ...(free ? [] : [{ kind: 'lurcher' as const, gx: 8.5, gy: 1.15, leash: 0 }]),
    ],
    sights: [],
  };
  const add = adder(data);
  for (const [x, y, i] of [[1, 1, 0], [7, 2, 1], [2, 5, 2], [6, 7, 0], [8, 6, 1]] as const) add(`sh-straw-${i}`, x, y, { flat: true });
  add('sh-pit', 3, 2, { w: 4, h: 4, shapes: [circle(2, 2, 1.75)] });
  add('sh-tiers', 3, 0, { w: 2, shapes: benchShape });
  add('sh-tiers', 5, 0, { w: 2, shapes: benchShape });
  add('sh-tiers', 1, 2, { w: 2, shapes: benchShape });
  for (const x of [7, 8, 9]) add('sh-dogpen', x, 0, { shapes: penShape });
  add('sh-cashtable', 2, 8);
  add('sh-ratbarrel', 0, 0, { shapes: roundShape });
  add('furn-barrels', 9, 8, { shapes: barrelShape });
  add('sh-bones', 9, 3);
  data.sights!.push(
    { id: 'shp-pit', gx: 5, gy: 4, label: 'Look', z: 24, thought: 'The ring: a wall of boards chest-high to a man, round, the sand inside raked over and still dark in patches. The boards are gnawed at the bottom, all the way round, where things tried to dig their way out.' },
    { id: 'shp-chalk', gx: 2.5, gy: 0.15, label: 'Read the board', z: 56, sign: { heading: 'Chalked on the boards', lines: ['TONIGHT: BUTCHER v. THE WIDOW\'S CUR', 'RATS — 50 IN THE PIT — BY THE MINUTE', 'NEW STOCK. GREY. ASK NED.', 'NO CREDIT. NO HOOKS.'] } },
    { id: 'shp-pens', gx: 8.5, gy: 0.9, label: 'Look', z: 20, thought: free
      ? 'Two dogs in two bays, brindled, scarred, chained short to rings in the wall. The middle bay is empty now, the chain lying in the straw. They watch me without moving. They have stopped expecting anything else.'
      : 'Three kennel bays. Two brindled pit dogs, scarred, chained short. In the middle one, a grey lurcher, long-legged and thin, straining away from the pit with her chain pulled tight. She answers to nothing. To Nothing. It\'s her.' },
    { id: 'shp-cash', gx: 2.5, gy: 8.3, label: 'Look', z: 22, thought: 'Flay\'s table: a cash box chained to the leg, a tally book, a bottle, and a muzzle of wire and leather with teeth marks in the straps.' },
    { id: 'shp-rats', gx: 0.5, gy: 0.5, label: 'Look', z: 22, thought: 'A barrel with a board on it and a stone on the board. It is squeaking. It is squeaking a great deal.' },
  );
  return data;
}
