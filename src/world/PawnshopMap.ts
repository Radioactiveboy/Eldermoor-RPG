import { box, circle } from './Collision';
import { MapData, MapObject, NpcSpawn, placeObject, Prop, Terrain } from './MapData';
import { COLLECTING_HOURS, LUSK_HOURS, STASH_HOURS } from '../systems/Pawnshop';

/**
 * Lusk's, the pawnshop on the north-east corner of Gloomhaven's square (its
 * door is on the square, in world/GloomhavenMap.ts): the shop floor, crammed
 * with what the town has sold and what's been stolen from it, behind a grilled
 * counter; up the stairs, the counting room where Abel Lusk keeps his ledgers
 * (both of them); and up again, under the roof, the Hooks' stash, which he
 * keeps for them whether he likes it or not. Its people, its quest and its
 * doors are in scenes/game/pawnshop.ts and dialogue/pawnshop.ts.
 */

/** Who's in the shop as things stand (scenes/game/pawnshop.ts works it out). */
export interface PawnshopState {
  /** The Hooks are in, collecting: Nim Dace at the counter, Orm in the door. */
  collecting: boolean;
  /** Nim Dace and Orm have come for the stash, and are at the foot of the stairs. */
  forTheStash: boolean;
}

/** Where Abel Lusk stands behind his counter. */
export const LUSK_SPOT = { x: 4.5, y: 1.7 };
/** Where Nim Dace leans on the counter, collecting, and where Orm stands, filling the door. */
export const DACE_AT_COUNTER = { x: 4.6, y: 4.35 };
export const ORM_AT_DOOR = { x: 1.5, y: 6.9 };
/** The street door's tile. */
export const PAWN_DOOR = { x: 1.2, y: 7.5 };

function emptyRoom(w: number, h: number, floor: Terrain): Pick<MapData, 'width' | 'height' | 'terrain' | 'props'> {
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < h; y++) {
    terrain.push(new Array(w).fill(floor));
    props.push(new Array(w).fill(Prop.None));
  }
  return { width: w, height: h, terrain, props };
}

const wall = (side: 'back' | 'side', kinds: string[]) => kinds.map((k, i) => `pw-wall-${side}-${k}-${i % 2}`);
const crateShape = [box(0.1, 0.1, 0.9, 0.9)];
const round = (r: number) => [circle(0.5, 0.5, r)];

/** Dusty and close: the boards are dark, and the light never quite gets into the corners. */
const DUSTY = 0x9a9088;

/**
 * The shop floor. The street door is in the left-hand wall near the front.
 * The counter runs from the side wall across the room, iron-grilled, with Lusk
 * behind it among his pledges and his safe, and the stairs climbing the back
 * wall beyond its end. Nettle tickets pledges at her table under the side
 * window. The rest is everything: armour, a bear, a heron, a font, a bride
 * with no head, swords in a barrel, chairs on chairs, and Saint Elda's bell.
 */
export function buildPawnshopMap(state: PawnshopState = { collecting: false, forTheStash: false }): MapData {
  const W = 11;
  const H = 9;
  const door = PAWN_DOOR;
  const npcs: NpcSpawn[] = [
    { id: 'lusk', gx: LUSK_SPOT.x, gy: LUSK_SPOT.y, looking: { x: 0, y: 1 }, hours: LUSK_HOURS },
    { id: 'nettle', gx: 1.55, gy: 4.35, looking: { x: 1, y: 0 }, hours: [8, 21] },
  ];
  if (state.collecting) {
    npcs.push({ id: 'dace', gx: DACE_AT_COUNTER.x, gy: DACE_AT_COUNTER.y, looking: { x: 0, y: -1 }, hours: COLLECTING_HOURS });
    npcs.push({ id: 'orm', gx: ORM_AT_DOOR.x, gy: ORM_AT_DOOR.y, looking: { x: 1, y: -1 }, hours: COLLECTING_HOURS });
  } else if (state.forTheStash) {
    npcs.push({ id: 'dace', gx: 8.6, gy: 3.6, looking: { x: -1, y: 1 }, hours: STASH_HOURS });
    npcs.push({ id: 'orm', gx: 9.4, gy: 2.6, looking: { x: -1, y: 1 }, hours: STASH_HOURS });
  }
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: door,
    indoor: true,
    music: 'tavern',
    groundShade: DUSTY,
    walls: {
      back: wall('back', ['pictures', 'shelf', 'window', 'tickets', 'sign', 'tickets', 'hooks', 'plain', 'plain', 'plain', 'window']),
      side: wall('side', ['coats', 'window', 'pictures', 'shelf', 'hooks', 'plain', 'pictures', 'door', 'ious']),
      corner: 'pw-wall-corner',
    },
    doors: [
      { tx: 0, ty: 7, to: 'gloomhaven', entry: 'pawnshop', label: 'Go outside' },
      { tx: 8, ty: 1, to: 'pawn-counting', entry: 'stairs', label: 'Go upstairs', facing: 'back', id: 'pawn-up' },
    ],
    entries: { door, stairs: { x: 8.5, y: 1.7 } },
    lights: [
      // The lamp over the counter, the candle on Nettle's table, the windows' grey, a lantern by the stairs.
      { gx: 4.5, gy: 2.6, z: 64, radius: 170, flicker: 0.3 },
      { gx: 0.5, gy: 1.4, z: 34, radius: 80, flicker: 0.6 },
      { gx: 2.5, gy: 0.2, z: 40, radius: 90, flicker: 0 },
      { gx: 10.5, gy: 0.2, z: 40, radius: 90, flicker: 0 },
      { gx: 8.5, gy: 2.4, z: 60, radius: 120, flicker: 0.5 },
      { gx: 5.5, gy: 6.5, z: 70, radius: 150, flicker: 0.4 },
    ],
    npcs,
    sights: [],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });

  // The floor: the Turkey rug, worn to a path; dust and dropped tickets.
  add('pw-rug', 2, 5, { w: 4, h: 3, flat: true });
  add('pw-litter-0', 1, 7, { w: 2, flat: true });
  add('pw-litter-1', 7, 4, { w: 2, flat: true });
  add('pw-litter-0', 3, 1, { w: 2, flat: true });

  // The corner: the long-case clock, stopped. Nettle's table under the window.
  add('pw-clock', 0, 0, { shapes: [box(0.18, 0.16, 0.82, 0.7)] });
  add('pw-tagtable', 0, 1, { h: 2, shapes: [box(0.06, 0.06, 0.94, 1.94)] });
  add('pw-stool', 1, 2, { shapes: round(0.15) });

  // The counter: back along the side, round the corner, and across, grilled; its end folds up by the stairs.
  add('pw-counter-side', 2, 1, { shapes: [box(0.2, 0, 0.8, 1)] });
  add('pw-counter-side', 2, 2, { shapes: [box(0.2, 0, 0.8, 1)] });
  add('pw-counter-corner', 2, 3, { shapes: [box(0.2, 0, 0.8, 0.8), box(0.8, 0.2, 1, 0.8)] });
  [0, 1, 2, 3].forEach((k, i) => add(`pw-counter-${k}`, 3 + i, 3, { shapes: [box(0, 0.2, 1, 0.8)] }));
  add('pw-counter-end', 7, 3, { shapes: [box(0, 0.2, 0.56, 0.8)] });
  // Behind it: the safe, the pledges, and a harp nobody's come back for.
  add('pw-safe', 3, 0, { shapes: [box(0.12, 0.12, 0.88, 0.88)] });
  add('pw-pledges', 4, 0, { w: 2 });
  add('pw-harp', 6, 0, { shapes: [box(0.28, 0.28, 0.72, 0.68)] });

  // The stairs up the back wall, and the bear rearing up at the foot of them.
  for (let i = 0; i < 3; i++) add(`pw-stairs-${i}`, 8 + i, 0);
  add('pw-bear', 10, 2, { shapes: [box(0.1, 0.1, 0.9, 0.9)] });

  // The armour by the side wall, and the mirror that shows you twice.
  add('pw-armour', 0, 3, { shapes: [box(0.2, 0.25, 0.8, 0.8)] });
  add('pw-mirror', 0, 5, { shapes: [box(0.1, 0.35, 0.9, 0.6)] });
  add('pw-cage', 0, 4, { shapes: round(0.18) });

  // The middle of the shop: two tables of everything, the swords, the heron, the bell.
  add('pw-junk-0', 3, 5, { w: 2, shapes: [box(0.05, 0.08, 1, 0.92), box(1, 0.08, 1.95, 0.92)] });
  add('pw-junk-1', 6, 7, { w: 2, shapes: [box(0.05, 0.08, 1, 0.92), box(1, 0.08, 1.95, 0.92)] });
  add('pw-swords', 9, 5, { shapes: round(0.3) });
  add('pw-heron', 10, 4, { shapes: round(0.3) });
  add('pw-bell', 7, 5, { shapes: [box(0.18, 0.2, 0.82, 0.8)] });
  add('pw-font', 8, 7, { shapes: [box(0.2, 0.2, 0.8, 0.8)] });

  // Down the far side: the bride, the carpets, the chairs; boots by the door.
  add('pw-dummy', 10, 6, { shapes: round(0.3) });
  add('pw-carpets', 10, 7, { shapes: [box(0.12, 0.15, 0.78, 0.7)] });
  add('pw-chairs', 9, 8, { shapes: [box(0.08, 0.08, 0.95, 0.95)] });
  add('pw-boots', 3, 8, { shapes: [box(0.12, 0.12, 0.85, 0.85)] });
  add('br-crate', 10, 8, { shapes: crateShape });
  add('pw-stool', 6, 5, { shapes: round(0.15) });

  data.sights!.push(
    {
      id: 'pawn-bell', gx: 7.5, gy: 5.5, label: 'Look at the bell', z: 30,
      thought: "A bronze bell as big as a cooking pot, green at the lip, Saint Elda's lily cast on its shoulder. It hung over the brothers' gate. I rang it myself, to be let in. There is a ticket tied to it, and on the pallet somebody has chalked a hook.",
    },
    {
      id: 'pawn-sign', gx: 4.5, gy: 0.15, label: 'Read the sign', z: 70,
      sign: {
        heading: 'Painted on a board behind the counter',
        lines: [
          'A. LUSK',
          'BOUGHT & SOLD',
          'MONEY LENT ON ANY ARTICLE OF VALUE',
          'NO QUESTIONS ASKED',
          'NO QUESTIONS ANSWERED',
          'NO REFUNDS',
          '(Underneath, smaller, newer: "Pledges unredeemed after one month become the property of the house. The house is not sorry.")',
        ],
      },
    },
    { id: 'pawn-bear', gx: 10.5, gy: 2.5, label: 'Look', z: 70, thought: "A bear, stuffed, rearing up with its claws out. The moths have had most of its belly and one of its glass eyes, and somebody has put a top hat on it. There's a ticket on its paw: 'NOT FOR SALE. ASK.'" },
    { id: 'pawn-heron', gx: 10.5, gy: 4.5, label: 'Look', z: 54, thought: "A grey heron under a glass dome, stuffed mid-step, with an eel in its bill. There's a crack across the glass. The heron's eye has followed me across the shop. I am nearly sure of it." },
    { id: 'pawn-armour', gx: 0.5, gy: 3.5, label: 'Look', z: 54, thought: "A suit of armour on a stand, rusted at every joint. There is a bird's nest in the helmet. The ticket says 'KNIGHT'S HARNESS, AS WORN AT THE BATTLE OF', and then the rest has been torn off." },
    { id: 'pawn-dummy', gx: 10.5, gy: 6.5, label: 'Look', z: 44, thought: "A wedding dress on a dressmaker's dummy, yellowed, the veil falling over the head that isn't there. The ticket on it says 'WORN ONCE'. Somebody has written underneath, in a different hand: 'NOT EVEN THAT.'" },
    { id: 'pawn-font', gx: 8.5, gy: 7.5, label: 'Look', z: 30, thought: "A stone christening font, full to the brim with spoons. The name of the church has been chiselled off the rim. Not well. I can still read SAINT." },
    { id: 'pawn-mirror', gx: 0.5, gy: 5.4, label: 'Look', z: 46, thought: 'A tall glass, cracked from corner to corner. I look in it and two of me look back, one a little behind the other. The one behind is not quite keeping up.' },
    { id: 'pawn-clock', gx: 0.5, gy: 0.5, label: 'Look', z: 60, thought: "A long-case clock, stopped at a quarter past three. Its ticket says 'GOES'. It does not go." },
    { id: 'pawn-swords', gx: 9.5, gy: 5.5, label: 'Look', z: 40, thought: 'A barrel of swords, sticks, umbrellas and one crutch. A bishop\'s crook stands up out of the middle of it, gilt flaking. I decide not to ask.' },
    { id: 'pawn-junk', gx: 4, gy: 5.5, label: 'Look', z: 34, thought: 'Candlesticks, a carriage clock, a stack of blue plates, a skull wearing spectacles, and a box of glass eyes, sorted by colour. Everything here belonged to somebody once. Some of them would like it back.' },
    { id: 'pawn-pledges', gx: 5, gy: 0.4, label: 'Look', z: 66, thought: "Shelves of pledges, done up in brown paper and string, each with a ticket: a man's Sunday coat, a set of false teeth, a wedding ring, a wedding ring, a wedding ring. Everybody in this town owes Lusk something." },
    { id: 'pawn-cage', gx: 0.5, gy: 4.5, label: 'Look', z: 50, thought: "An empty birdcage on a hat stand, its door open. The ticket on it says 'BIRD'." },
    { id: 'pawn-chairs', gx: 9.5, gy: 8.5, label: 'Look', z: 50, thought: "Chairs on chairs, legs in the air, and on top of the heap a child's high chair. It's the only thing in the shop without a ticket on it." },
  );
  return data;
}

/**
 * The counting room, up the stairs: Lusk's desk with the day book and the
 * black ledger, shelves of old ledgers, the big safe, a cot for nights he
 * doesn't trust the counter, Mister Pledge the cat, and the notes of hand pinned
 * up by the dozen. A door at the back goes up again, to the stash. It's locked.
 */
export function buildPawnCountingMap(): MapData {
  const W = 7;
  const H = 6;
  const stairs = { x: 1.2, y: 4.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: stairs,
    indoor: true,
    music: 'tavern',
    groundShade: DUSTY,
    walls: {
      back: wall('back', ['ledgers', 'ledgers', 'window', 'plain', 'door', 'ious', 'pictures']),
      side: wall('side', ['window', 'plain', 'ious', 'plain', 'door', 'plain']),
      corner: 'pw-wall-corner',
    },
    doors: [
      { tx: 0, ty: 4, to: 'pawnshop', entry: 'stairs', label: 'Go downstairs' },
      { tx: 4, ty: 0, to: 'pawn-attic', entry: 'hatch', label: 'Go up to the top floor', facing: 'back', id: 'pawn-attic' },
    ],
    entries: { stairs, attic: { x: 4.5, y: 1.1 } },
    lights: [
      { gx: 2.25, gy: 2.3, z: 40, radius: 150, flicker: 0.6 },
      { gx: 2.5, gy: 0.2, z: 40, radius: 90, flicker: 0 },
      { gx: 1.5, gy: 0.3, z: 80, radius: 60, flicker: 0.5 },
    ],
    sights: [],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  add('pw-rug-small', 2, 3, { w: 2, h: 2, flat: true });
  add('pw-ledgercase', 0, 0, { w: 2 });
  add('pw-desk', 2, 2, { w: 2, shapes: [box(0, 0.1, 1, 0.95), box(1, 0.1, 2, 0.95)] });
  add('pw-deskchair', 2, 1, { shapes: [box(0.2, 0.18, 0.8, 0.8)] });
  add('pw-safe-big', 6, 0, { shapes: [box(0.12, 0.12, 0.88, 0.88)] });
  add('pw-cot', 6, 2, { h: 2, shapes: [box(0.1, 0.05, 0.9, 1.95)] });
  add('pw-cat', 5, 1, { shapes: round(0.2) });
  add('pw-crate-3', 0, 1, { shapes: crateShape });
  add('pw-litter-1', 3, 4, { w: 2, flat: true });
  // Lusk's own things: the clock he winds every night, his strongbox, his boots, and one crate he hasn't sold.
  add('pw-clock', 5, 0, { shapes: [box(0.18, 0.16, 0.82, 0.7)] });
  add('pw-chest', 0, 5, { shapes: [box(0.12, 0.2, 0.88, 0.8)] });
  add('pw-boots', 6, 4, { shapes: [box(0.12, 0.12, 0.85, 0.85)] });
  add('pw-crate-0', 6, 5, { shapes: crateShape });
  add('pw-litter-0', 4, 5, { w: 2, flat: true });
  data.sights!.push(
    {
      id: 'pawn-ledger', gx: 3.1, gy: 2.4, label: 'Open the black ledger', z: 34,
    },
    { id: 'pawn-daybook', gx: 2.6, gy: 2.4, label: 'Look', z: 32, thought: "The day book, open: who pawned what, for how much, and when it's due. A widow's ring, two coppers. A fiddle, five. 'Pair of boots, gentleman's, river-damaged. Seller would not give name. Did not need to.'" },
    { id: 'pawn-cat', gx: 5.5, gy: 1.5, label: 'Look', z: 18, thought: 'A black cat the size of a ham, asleep on a velvet cushion, one yellow eye open. There is a ticket tied round its neck. It says MISTER PLEDGE, and under that, NOT FOR SALE. The cat seems to agree.' },
    { id: 'pawn-ious', gx: 5.5, gy: 0.2, label: 'Read the notes', z: 50, thought: 'Notes of hand, pinned up by the dozen. I O U four silver. I O U the boat. I O U, signed with a cross. On some of them somebody has drawn a little hook in red.' },
    { id: 'pawn-safe', gx: 6.5, gy: 0.5, label: 'Look', z: 46, thought: "A safe as big as a privy, black and gold, with a dent in the door the size of a fist and a candle on top. 'ARMITAGE & SONS, UNBREAKABLE'. Somebody has tested that." },
    { id: 'pawn-ledgers', gx: 1, gy: 0.3, label: 'Look', z: 60, thought: 'Ledgers, years of them, with the years in gold on their spines. Every one of them is somebody\'s worst week.' },
    { id: 'pawn-cot', gx: 6.5, gy: 3, label: 'Look', z: 18, thought: 'A narrow cot with a grey blanket. The end of a cudgel pokes out from under the pillow.' },
    { id: 'pawn-lusk-clock', gx: 5.5, gy: 0.5, label: 'Look', z: 56, thought: "A long-case clock, the only one in the building that keeps time. A paper is pasted inside the door: 'WIND ME. A.L.' He must forget sometimes." },
    { id: 'pawn-strongbox', gx: 0.5, gy: 5.5, label: 'Look', z: 18, thought: 'A strongbox with three locks, all of them different. Chained to the floor, and the chain padlocked to a ring set in the boards. Whatever is in there, Lusk did not buy it from the Hooks.' },
    { id: 'pawn-own-boots', gx: 6.5, gy: 4.5, label: 'Look', z: 10, thought: 'A pair of good black boots, polished, with no ticket on them. The only things in this house that nobody else has worn first.' },
  );
  return data;
}

/**
 * The top floor, under the roof: the Hooks' stash. Crates stencilled with
 * other people's marks, bolts of cloth off a merchant's barge, a ship's
 * figurehead, a gentleman's silver in straw, sacks of tea, a chest in chains,
 * and in the corner, apart from the rest, a crate sealed in grey wax with a
 * silver eye in it, waiting for somebody.
 */
export function buildPawnAtticMap(): MapData {
  const W = 7;
  const H = 5;
  const hatch = { x: 4.5, y: 1.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: hatch,
    indoor: true,
    cold: true,
    music: 'tavern',
    groundShade: 0x8a8088,
    walls: {
      back: wall('back', ['eaves', 'eaves', 'eaves-window', 'eaves', 'eaves', 'eaves', 'eaves']),
      side: wall('side', ['eaves', 'eaves-window', 'eaves', 'eaves', 'eaves']),
      corner: 'pw-wall-corner',
    },
    doors: [{ tx: 4, ty: 1, to: 'pawn-counting', entry: 'attic', label: 'Go back down', facing: 'front' }],
    entries: { hatch },
    lights: [
      { gx: 2.5, gy: 0.3, z: 40, radius: 110, flicker: 0 },
      { gx: 0.3, gy: 1.5, z: 40, radius: 90, flicker: 0 },
      { gx: 6.5, gy: 3.5, z: 20, radius: 40, flicker: 0.2 },
    ],
    sights: [],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  add('tav-trapdoor', 4, 1, { flat: true });
  add('pw-crate-0', 0, 0, { shapes: crateShape });
  add('pw-crate-1', 1, 0, { shapes: crateShape });
  add('pw-crate-2', 0, 2, { shapes: crateShape });
  add('pw-crate-1', 0, 3, { shapes: crateShape });
  add('pw-cloth', 3, 0, { shapes: [box(0.1, 0.15, 0.9, 0.85)] });
  add('pw-silver', 5, 0, { shapes: crateShape });
  add('furn-barrels', 6, 0, { shapes: [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)] });
  add('pw-figurehead', 1, 4, { w: 2, shapes: [box(0.1, 0.25, 1, 0.75), box(1, 0.25, 1.8, 0.75)] });
  add('pw-sacks', 3, 4, { shapes: [box(0.1, 0.1, 0.9, 0.9)] });
  add('pw-chest', 6, 2, { shapes: [box(0.12, 0.2, 0.88, 0.8)] });
  add('pw-crate-eye', 6, 4, { shapes: crateShape });
  add('pw-litter-0', 2, 2, { w: 2, flat: true });
  data.sights!.push(
    {
      id: 'pawn-eye-crate', gx: 6.5, gy: 4.5, label: 'Look at the sealed crate', z: 34,
      thought: "A crate set apart from the rest, its iron straps chained, its lid sealed in grey wax. Pressed into the wax there's an eye in silver leaf, like the black card on the Rose's board. Chalked on the side, in Lusk's careful hand: 'NOT HOOKS'. 'TO BE COLLECTED'. 'DO NOT OPEN'. Underlined three times.",
    },
    { id: 'pawn-crates', gx: 0.5, gy: 0.5, label: 'Look', z: 30, thought: "Crates stencilled with other people's marks: a wheel, a key, a lily, a fish. A merchant's, a guild's, a monastery's, a fishmonger's. None of them are the Hooks'. All of them are." },
    { id: 'pawn-cloth', gx: 3.5, gy: 0.5, label: 'Look', z: 26, thought: 'Bolts of good cloth: grey wool, linen, a bolt of red silk. There is a tide-line of river mud along the bottom of every one.' },
    { id: 'pawn-figurehead', gx: 2, gy: 4.5, label: 'Look', z: 16, thought: "A ship's figurehead lying on her side: a woman with a gilded crown and her nose broken off, salt-white, staring up at the rafters. The name of her ship is carved on her scroll: WEND MAIDEN. A barge, by the size of her. I wonder where the rest of it is." },
    { id: 'pawn-silver', gx: 5.5, gy: 0.5, label: 'Look', z: 30, thought: "A gentleman's silver, packed in straw: a teapot, salvers, a pair of candlesticks with a crest filed off. Somebody's whole dining room, lifted off a barge." },
    { id: 'pawn-chest', gx: 6.5, gy: 2.5, label: 'Look', z: 24, thought: 'A sea-chest with a chain round it and a padlock the size of my fist. Something inside it shifts when I touch it, and clinks.' },
  );
  return data;
}
