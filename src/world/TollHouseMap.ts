import { box, circle } from './Collision';
import { MapData, MapObject, placeObject, Prop, Terrain } from './MapData';

/**
 * The Reeve's toll house, just inside the Fen Gate on the west side of the
 * road (its front door is on the gate road, in world/GloomhavenMap.ts): the
 * toll office with its grille, where Tobias Nibb takes the Flood Toll and the
 * Reeve's yellowbands lounge; the strongroom behind it, where the takings and
 * the Reeve's true book are kept; and up the stairs, the Reeve's own rooms,
 * done up far too fine for Gloomhaven with silver nobody can account for.
 *
 * The toll house is the only building in town besides the Black Rose with a
 * stone floor downstairs and glass in all its windows. It's dry, which in
 * Gloomhaven is the surest sign that someone is being robbed.
 */

/** Where Nibb stands at his grille, and where whoever's paying stands across it. */
export const NIBB_SPOT = { x: 6.5, y: 2.35 };
export const GRILLE_FRONT = { x: 6.5, y: 4.3 };
/** Where the Reeve stands behind his desk, receiving. */
export const REEVE_SPOT = { x: 4.5, y: 1.35 };
/** The hook by the Reeve's bed where the strongroom key hangs while he sleeps. */
export const KEY_HOOK = { gx: 7.5, gy: 0.2 };

function emptyRoom(w: number, h: number, floor: Terrain): Pick<MapData, 'width' | 'height' | 'terrain' | 'props'> {
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < h; y++) {
    terrain.push(new Array(w).fill(floor));
    props.push(new Array(w).fill(Prop.None));
  }
  return { width: w, height: h, terrain, props };
}

const stoolShape = [circle(0.5, 0.5, 0.15)];
const chestShape = [box(0.1, 0.18, 0.9, 0.82)];
const crateShape = [box(0.1, 0.1, 0.9, 0.9)];
const postShape = [box(0.34, 0.34, 0.66, 0.66)];
const along = [box(0, 0.2, 1, 0.8)];

const wall = (side: 'back' | 'side', kinds: string[]) => kinds.map((k, i) => `th-wall-${side}-${k}-${i % 2}`);

/**
 * The toll office. The door from the gate road is in the left-hand wall; across
 * the room runs the toll counter with its iron grille, Nibb behind it among his
 * ledgers and scales, and behind him the iron door of the strongroom. On the
 * public side: a bench for those waiting (there's always someone waiting), the
 * stairs up to the Reeve, a heap of seized goods in the corner with DISTRAINED
 * chalked on them, the Reeve's table of tolls painted on the wall, and
 * his portrait, so you can't forget whose house you're in.
 */
export function buildTollHouseMap(): MapData {
  const W = 12;
  const H = 9;
  const door = { x: 1.2, y: 6.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Stone),
    spawn: door,
    indoor: true,
    music: 'tavern',
    groundShade: 0xa8a4a0,
    walls: {
      back: wall('back', ['plain', 'plain', 'plain', 'plain', 'shelf', 'tolls', 'window', 'portrait', 'irondoor', 'plain', 'proclaim', 'window']),
      side: wall('side', ['plain', 'window', 'hanging', 'plain', 'notice', 'plain', 'door', 'window', 'plain']),
      corner: 'th-wall-corner',
    },
    doors: [
      { tx: 0, ty: 6, to: 'gloomhaven', entry: 'tollhouse', label: 'Go outside' },
      { tx: 1, ty: 1, to: 'tollhouse-upstairs', entry: 'stairs', label: 'Go up to the Reeve', facing: 'back' },
      { tx: 8, ty: 0, to: 'tollhouse-strong', entry: 'door', label: 'Open the strongroom', facing: 'back', id: 'toll-strong' },
    ],
    entries: { door, stairs: { x: 1.5, y: 2.2 }, strong: { x: 8.5, y: 1.1 } },
    lights: [
      // The lamp over the grille, Nibb's candles, the post lantern, the strongroom's lantern, the windows' grey daylight.
      { gx: 6.5, gy: 2.8, z: 52, radius: 170, flicker: 0.4 },
      { gx: 5.6, gy: 1.4, z: 34, radius: 90, flicker: 0.6 },
      { gx: 4.7, gy: 6.3, z: 48, radius: 130, flicker: 0.7 },
      { gx: 8.5, gy: 0.4, z: 60, radius: 80, flicker: 0.3 },
      { gx: 2.2, gy: 6.4, z: 18, radius: 120, flicker: 0.9 },
      { gx: 10.5, gy: 4.6, z: 22, radius: 90, flicker: 0.8 },
    ],
    // Nibb at his grille and Gaff Tully on the counter's flap by day, Annet Marl on the bench waiting to be seen,
    // and by night Lardy Mott in front of the strongroom, eating.
    npcs: [
      { id: 'nibb', gx: NIBB_SPOT.x, gy: NIBB_SPOT.y, looking: { x: 0, y: 1 }, hours: [7, 20] },
      { id: 'gaff', gx: 10.6, gy: 4.5, looking: { x: -1, y: 0.4 }, hours: [7, 20] },
      { id: 'annet', gx: 0.45, gy: 4.3, looking: { x: 1, y: 0 }, hours: [8, 17] },
      { id: 'lardy', gx: 9.4, gy: 1.35, looking: { x: 0, y: 1 }, hours: [20, 31] },
    ],
    seats: [],
    sights: [],
  };

  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });

  // On the floor: mud tramped in from the road, a chalked line to wait behind, a worn path to the grille, a dropped copper.
  add('th-mud-0', 1, 6, { w: 2, flat: true });
  add('th-mud-1', 2, 5, { w: 2, flat: true });
  add('th-waitline', 4, 4, { w: 6, flat: true });
  add('th-straw', 9, 7, { w: 2, flat: true });
  add('th-stain', 7, 6, { flat: true });

  // The stairs up the back wall to the Reeve's rooms, at the end of the public side.
  for (let i = 0; i < 3; i++) add(`br-stairs-${i}`, i, 0);
  // The rail that keeps the public off Nibb's side, and the counter with its grille.
  add('th-rail', 3, 1, { shapes: [box(0.4, 0, 0.6, 1)] });
  add('th-rail', 3, 2, { shapes: [box(0.4, 0, 0.6, 1)] });
  add('th-counter-end', 3, 3, { shapes: [box(0.2, 0.2, 1, 0.8)] });
  add('th-counter-0', 4, 3, { shapes: along });
  add('th-counter-1', 5, 3, { shapes: along });
  add('th-grille', 6, 3, { shapes: along });
  add('th-grille-stamp', 7, 3, { shapes: along });
  add('th-counter-2', 8, 3, { shapes: along });
  add('th-counter-0', 9, 3, { shapes: along });
  add('th-flap', 10, 3, { shapes: [box(0, 0.2, 0.8, 0.8)] });

  // Nibb's side: the ledger press, his high desk and stool, the scales, the takings chest, his cot.
  add('th-ledgers', 4, 0, { shapes: [box(0.05, 0.1, 0.95, 0.7)] });
  add('th-scales', 5, 0, { shapes: [box(0.1, 0.1, 0.9, 0.8)] });
  add('th-desk', 5, 1, { shapes: [box(0.1, 0.15, 0.9, 0.85)] });
  add('th-highstool', 6, 1, { shapes: stoolShape });
  add('th-tallysticks', 7, 0, { shapes: [box(0.2, 0.1, 0.8, 0.5)] });
  add('th-takings', 9, 0, { shapes: chestShape });
  add('th-cot', 10, 0, { h: 2, shapes: [box(0.1, 0.05, 0.9, 1.95)] });
  add('th-stool', 9, 1, { shapes: stoolShape }); // Lardy's, at night
  add('th-lantern-post', 11, 2, { shapes: postShape });

  // The public side: the waiting bench, a brazier, the Watch's barrel of dice, the seized goods.
  add('th-bench', 0, 3, { h: 2, shapes: [box(0.1, 0.05, 0.6, 1.95)] });
  add('th-brazier', 4, 6, { shapes: [circle(0.5, 0.5, 0.26)] });
  add('th-dicebarrel', 10, 5, { shapes: [circle(0.5, 0.5, 0.3)] });
  add('th-stool', 11, 5, { shapes: stoolShape });
  add('th-handcart', 9, 7, { w: 2, shapes: [box(0.1, 0.2, 1.9, 0.85)] });
  add('th-oilcask', 11, 7, { shapes: [circle(0.5, 0.5, 0.32)] });
  add('th-seized', 11, 8, { shapes: crateShape });
  add('th-creels', 10, 8, { shapes: crateShape });
  add('th-boltcloth', 8, 8, { shapes: [box(0.15, 0.2, 0.85, 0.8)] });
  add('th-hencrate', 11, 6, { shapes: crateShape });
  add('th-board', 0, 7, { blocks: [] });

  data.sights!.push(
    {
      id: 'toll-table', gx: 5.5, gy: 0.15, label: 'Read the tolls', z: 64,
      sign: {
        heading: 'THE FLOOD TOLL, by order of the Reeve',
        lines: [
          'Every cart through the Fen Gate: 4 coppers the wheel. Every beast: 2.',
          'Every catch landed at the Staithe: one fish in five, or its worth.',
          'Every candle sold within the walls: half a copper.',
          'A licence to fish, to trade, to light a lamp after curfew, or to hold a wake: 1 silver each, by the quarter.',
          'Goods on which the toll is owed are DISTRAINED until it is paid, with a tenth for their keeping.',
          'For the repair of the town after the floods. -C. Sallow, Reeve',
          '(Someone has scratched beside it: "WHAT REPAIR")',
        ],
      },
    },
    { id: 'toll-portrait', gx: 7.5, gy: 0.15, label: 'Look', z: 70, thought: 'A portrait of a long yellow man in a fur collar, a chain of office on his chest and one hand on a book. The paint is new. The painter has been kind to his chin and unkind to everything else.' },
    {
      id: 'toll-proclaim', gx: 10.5, gy: 0.15, label: 'Read the proclamation', z: 64,
      sign: {
        heading: 'Proclamation',
        lines: [
          'Be it known that the Fen Watch, wearing the Reeve\'s yellow, is the lawful guard of this town.',
          'They are to be obeyed in all things touching the peace and the toll.',
          'The old gate guard is thanked for its service.',
          'Any person refusing the toll, hiding goods, or speaking against the Watch will answer to the Reeve.',
          'Given under my hand at Gloomhaven, midsummer. -Corvin Sallow',
        ],
      },
    },
    { id: 'toll-scales', gx: 5.5, gy: 0.5, label: 'Look', z: 34, thought: 'Brass scales for weighing coin, and goods taken in lieu. One pan sits a hair lower than the other with nothing in it. Hah. Even the scales are on the Reeve\'s side.' },
    { id: 'toll-ledgers', gx: 4.5, gy: 0.3, label: 'Look', z: 50, thought: 'Ledgers, dozens of them, every spine labelled in a small neat hand: CARTS, CATCH, CANDLES, LICENCES, DISTRAINT. There is no ledger labelled WHERE IT GOES.' },
    { id: 'toll-tally', gx: 7.5, gy: 0.3, label: 'Look', z: 30, thought: 'Bundles of hazel tally sticks, notched and split: the old way of keeping a toll, a half for the payer and a half for the town. These have both halves. Nobody got theirs back.' },
    { id: 'toll-cot', gx: 10.5, gy: 1, label: 'Look', z: 14, thought: 'A cot behind the takings chest, with a thin grey blanket and a pillow of rolled-up ledgers. Somebody sleeps here. Somebody who does not go home.' },
    { id: 'toll-seized', gx: 10.4, gy: 7.4, label: 'Look at the seized goods', z: 30, thought: 'A handcart of hen crates, a bolt of blue cloth, eel creels, and a cask of lamp oil branded TALLOW. Every one has DISTRAINED chalked on it, and a little tag with a sum owed that goes up every day it sits here.' },
    { id: 'toll-oil', gx: 11.5, gy: 7.6, label: 'Look', z: 26, thought: 'Hobb Tallow\'s lamp oil, a whole cask of it. Half the town\'s light for a month, sitting in the Reeve\'s corner in the dark.' },
    { id: 'toll-brazier', gx: 4.5, gy: 6.6, label: 'Look', z: 30, thought: 'Sea coal, not peat. Good coal, brought in by barge. Someone in this house can afford to be warm.' },
    { id: 'toll-dice', gx: 10.5, gy: 5.4, label: 'Look', z: 26, thought: 'An upturned barrel, three dice and a little pile of coppers. A boathook is chalked on one side of the barrel, and three notches cut in the other. Two gangs, one barrel. I wonder who wins.' },
    {
      id: 'toll-board', gx: 0.35, gy: 7.5, label: 'Read the notices', z: 58,
      sign: {
        heading: 'Pinned by the door',
        lines: [
          'DISTRAINED, unclaimed, to be SOLD at the Reeve\'s pleasure: 1 handcart, 6 hens (2 dead), 1 bolt blue cloth, creels, 1 cask oil.',
          'Petitions to the Reeve: upstairs, by appointment, 2 coppers the hearing.',
          'NO SPITTING. NO DOGS. NO ARGUING WITH THE CLERK.',
          '(Under it, small, in pencil:) Annet Marl has been waiting since Tuesday.',
        ],
      },
    },
  );
  return data;
}

/**
 * The strongroom, behind its iron door: stone all round, a barred slit high in
 * the wall, iron-bound chests and coin sacks, the Reeve's lectern with the
 * true book on it, things seized and never returned, and a little coffer
 * that doesn't belong to anybody in this town.
 */
export function buildTollStrongMap(): MapData {
  const W = 6;
  const H = 5;
  const door = { x: 1.2, y: 3.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Stone),
    spawn: door,
    indoor: true,
    music: 'tavern',
    groundShade: 0x9a98a0,
    walls: {
      back: wall('back', ['stone', 'stone', 'slit', 'stone', 'stone', 'rack']),
      side: wall('side', ['stone', 'stone', 'stone', 'irondoor', 'stone']),
      corner: 'th-wall-corner-stone',
    },
    doors: [{ tx: 0, ty: 3, to: 'tollhouse', entry: 'strong', label: 'Back to the toll office' }],
    entries: { door },
    lights: [
      { gx: 2.5, gy: 0.3, z: 70, radius: 70, flicker: 0.1 },
      { gx: 3.5, gy: 1.6, z: 36, radius: 130, flicker: 0.6 },
    ],
    sights: [],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  add('th-moneychest', 0, 0, { shapes: chestShape });
  add('th-moneychest', 1, 0, { shapes: chestShape });
  add('th-coffer', 3, 0, { shapes: [box(0.2, 0.2, 0.8, 0.8)] });
  add('th-lectern', 3, 1, { shapes: [box(0.2, 0.2, 0.8, 0.8)] });
  add('th-coinsacks', 4, 0, { shapes: [circle(0.5, 0.5, 0.36)] });
  add('th-coinsacks', 0, 1, { shapes: [circle(0.5, 0.5, 0.36)] });
  add('th-weapons', 5, 1, { shapes: [box(0.2, 0.1, 0.8, 0.9)] });
  add('th-creels', 5, 3, { shapes: crateShape });
  add('th-seized', 5, 4, { shapes: crateShape });
  add('th-seized', 4, 4, { shapes: crateShape });
  add('th-candle-floor', 2, 1, { shapes: [circle(0.5, 0.5, 0.12)] });
  add('th-stain', 2, 3, { flat: true });
  data.sights!.push(
    { id: 'toll-chests', gx: 0.6, gy: 0.5, label: 'Look', z: 30, thought: 'Iron-bound chests, padlocked. I lift a corner of one: heavy. Coppers, mostly, by the sound. The whole town\'s coppers, a few at a time.' },
    { id: 'toll-weapons', gx: 5.5, gy: 1.5, label: 'Look', z: 30, thought: 'Spears, a fowling piece, an old boarding axe, a child\'s bow. Taken off folk at the gate "for the peace". The bow has a name carved in it: DICKON.' },
    // The true book, the coffer and the letter, and Annet's creels: what they do is in scenes/game/tollhouse.ts.
    { id: 'toll-ledger', gx: 3.5, gy: 1.5, label: 'Read the book', z: 40 },
    { id: 'toll-letter', gx: 3.2, gy: 1.8, label: 'Look at the letter', z: 36 },
    { id: 'toll-coffer', gx: 3.5, gy: 0.5, label: 'Look in the coffer', z: 26 },
    { id: 'toll-creels', gx: 5.5, gy: 3.5, label: 'Look at the creels', z: 28 },
    { id: 'toll-seized-strong', gx: 4.5, gy: 4.3, label: 'Look', z: 26, thought: 'A wedding chest, a fiddle with no strings, a box of good knives. More DISTRAINED tags. Some of these are a year old, which is odd, since the Reeve only came back at midsummer.' },
  );
  return data;
}

/**
 * The Reeve's rooms, at the top of the stairs: the front room where he
 * receives, behind a great desk under his own portrait; and through the arch,
 * his bedchamber, done in yellow damask: a curtained bed, a dressing table of
 * pomanders and powders, a copper bath (the only one in Gloomhaven), wine, a
 * goldfinch in a cage, and the key to the strongroom on a hook by the bed.
 */
export function buildTollUpstairsMap(): MapData {
  const W = 10;
  const H = 7;
  const stairs = { x: 1.2, y: 1.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: stairs,
    indoor: true,
    music: 'menu',
    groundShade: 0xc8b8a8,
    walls: {
      back: wall('back', ['panel', 'window', 'hanging', 'bigportrait', 'panel', 'mirror', 'panel', 'keyhook', 'panel', 'window']),
      side: wall('side', ['panel', 'door', 'panel', 'window', 'hanging', 'panel', 'shelf']),
      corner: 'th-wall-corner-panel',
    },
    doors: [{ tx: 0, ty: 1, to: 'tollhouse', entry: 'stairs', label: 'Go downstairs' }],
    entries: { stairs },
    lights: [
      { gx: 4.5, gy: 2.1, z: 38, radius: 170, flicker: 0.5 },
      { gx: 3.4, gy: 2.4, z: 38, radius: 70, flicker: 0.6 },
      { gx: 6.6, gy: 0.5, z: 34, radius: 90, flicker: 0.5 },
      { gx: 8.5, gy: 4.5, z: 30, radius: 100, flicker: 0.6 },
      { gx: 1.5, gy: 5.6, z: 26, radius: 80, flicker: 0.4 },
    ],
    // The Reeve at his desk from the morning until he goes to bed; behind his curtains after that.
    npcs: [{ id: 'reeve', gx: REEVE_SPOT.x, gy: REEVE_SPOT.y, looking: { x: 0, y: 1 }, hours: [8, 24] }],
    sights: [],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  // The front room: the rug, the great desk, the Reeve's chair behind it, a stool for petitioners, a wine table.
  add('th-rug', 3, 2, { w: 3, h: 2, flat: true });
  add('th-bigdesk', 3, 2, { w: 2, shapes: [box(0.1, 0.15, 1, 0.85), box(1, 0.15, 1.9, 0.85)] });
  add('th-reevechair', 4, 1, { shapes: [box(0.2, 0.15, 0.8, 0.8)] });
  add('th-stool', 4, 4, { shapes: stoolShape });
  add('th-cabinet', 0, 4, { shapes: [box(0.1, 0.1, 0.8, 0.9)] });
  add('th-winetable', 7, 4, { shapes: [circle(0.5, 0.5, 0.32)] });
  add('th-birdcage', 9, 5, { shapes: [circle(0.5, 0.5, 0.22)] });
  // The bedchamber: the bed, the dressing table, the bath, the clothes press.
  add('th-bed', 8, 0, { w: 2, h: 2 });
  add('th-dresser', 6, 0, { shapes: [box(0.05, 0.1, 0.95, 0.7)] });
  add('th-press', 9, 3, { shapes: [box(0.1, 0.1, 0.9, 0.9)] });
  add('th-bath', 1, 5, { w: 2, shapes: [box(0.15, 0.15, 1.85, 0.85)] });
  add('th-furrug', 7, 2, { w: 2, flat: true });
  add('th-pot-gilt', 9, 2, { shapes: [circle(0.5, 0.5, 0.14)] });
  add('th-candlestand', 2, 2, { shapes: [circle(0.5, 0.5, 0.12)] });
  data.sights!.push(
    { id: 'toll-key', gx: KEY_HOOK.gx, gy: KEY_HOOK.gy, label: 'Look at the hook', z: 46 },
    { id: 'toll-bed', gx: 8.9, gy: 1.9, label: 'Look', z: 40 },
    { id: 'toll-desk', gx: 3.6, gy: 2.6, label: 'Look at the desk', z: 34 },
    { id: 'toll-bigportrait', gx: 3.5, gy: 0.15, label: 'Look', z: 72, thought: 'The Reeve again, bigger, in a gilt frame. In this one he has a sword he has never drawn and a horse he has never sat. Behind him the painter has put a Gloomhaven with sunshine and clean streets. It looks like nowhere I have ever been.' },
    { id: 'toll-mirror', gx: 5.5, gy: 0.15, label: 'Look', z: 64, thought: 'A real looking-glass, silvered, not polished tin. There is a mark on it at the height of a tall man\'s mouth, where somebody practises smiling.' },
    { id: 'toll-dresser', gx: 6.5, gy: 0.5, label: 'Look', z: 30, thought: 'Pomanders stuck with cloves, a pot of powder, a pot of rouge, a comb with long black hairs in it, and a little bottle of scent with a stopper of green glass, the label in a script I can\'t read.' },
    { id: 'toll-bath', gx: 2, gy: 5.6, label: 'Look', z: 22, thought: 'A copper bath. In Gloomhaven. The rest of the town washes in the rain, when it washes at all. There\'s a ring of grey scum round it at the height of a long, thin man.' },
    { id: 'toll-wine', gx: 7.5, gy: 4.5, label: 'Look', z: 24, thought: 'A decanter of wine, red, and a dish of sugared almonds. I haven\'t seen a sugared almond since the fair at Harrowford, and that was a long time ago and I only looked.' },
    { id: 'toll-bird', gx: 9.5, gy: 5.5, label: 'Look', z: 30, thought: 'A goldfinch in a gilt cage, hopping from perch to perch and back. It is the only yellow thing in this house that looks happy about it.' },
    { id: 'toll-press', gx: 9.5, gy: 3.5, label: 'Look', z: 40, thought: 'A clothes press full of coats: damask, velvet, a fur-lined gown. All new. Under them, folded small and pushed to the back, an old black coat worn through at the elbows. He kept it. I wonder why.' },
    { id: 'toll-window-up', gx: 1.5, gy: 0.2, label: 'Look out', z: 60, thought: 'Over the wall and out across the fen. The causeway runs north into the fog. From up here the Reeve can see every cart on it a mile before it reaches his gate.' },
    { id: 'toll-cabinet', gx: 0.5, gy: 4.5, label: 'Look', z: 40, thought: 'A cabinet of curiosities, or what passes for them: a narwhal\'s horn (a carved cow\'s), a mermaid\'s comb (a fish spine), a stone with a hole in it. A gentleman\'s cabinet, for a man who has been a gentleman since midsummer.' },
  );
  return data;
}
