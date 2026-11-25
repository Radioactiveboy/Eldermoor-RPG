import { box, circle } from './Collision';
import { MapData, MapObject, NpcSpawn, placeObject, Prop, Terrain } from './MapData';

/**
 * The Guildhall of the Causeway Merchants, on Gloomhaven's Staithe (its door
 * is on the waterfront, in world/GloomhavenMap.ts): the meeting hall, where
 * the guild sits at its long table under the great map of the trade roads;
 * the counting room behind it, where Pim the clerk keeps the ledgers and the
 * route book; and the guildmaster's office. The finest rooms in the town,
 * once, and still trying: the panelling is good oak and the banners are silk,
 * but the limewash is going green and there's a bucket under the leak.
 */

/** Where the hero comes in from the Staithe, and where each back door lets out into the hall. */
export const GUILD_ENTRY = { x: 1.2, y: 8.5 };

function emptyRoom(w: number, h: number): Pick<MapData, 'width' | 'height' | 'terrain' | 'props'> {
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < h; y++) {
    terrain.push(new Array(w).fill(Terrain.Floor));
    props.push(new Array(w).fill(Prop.None));
  }
  return { width: w, height: h, terrain, props };
}

const wall = (side: 'back' | 'side', kinds: string[]) => kinds.map((k, i) => `gd-wall-${side}-${k}-${i % 2}`);
const chairShape = [box(0.2, 0.2, 0.8, 0.8)];
const barrelShape = [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)];

/** The guild's limewash and oak: a warm, dim floor, darker under the walls. */
const SHADE = 0xa49888;

/**
 * The meeting hall. The door from the Staithe is in the left-hand wall near
 * the front; the long table runs down the middle on its faded carpet, the
 * guildmaster's great chair at its head by the counting-room door, the great
 * map of the trade roads on the back wall over the sideboard, the founder in
 * oils beside it, the office door and the fireplace in the far corner (where
 * Nat Garrow sits nursing his head), the charter and the roll of members, the
 * guild's scales, candlestands, benches for those who wait on the guild, and
 * sample bales by the door.
 *
 * @param met the meeting the hero walked in on is over: the members keep their own hours now, and Edric
 *   Lowe has moved off to the window to brood.
 */
export function buildGuildHallMap(met = false): MapData {
  const W = 14;
  const H = 10;
  const door = GUILD_ENTRY;
  const hours = (h: [number, number]) => (met ? { hours: h } : {});
  const npcs: NpcSpawn[] = [
    // The guildmaster at the head of the table, by his great chair.
    { id: 'wexley', gx: 3.55, gy: 3.4, looking: { x: 1, y: 0.4 }, ...hours([8, 20]) },
    // Dame Marrable on her feet behind the chairs, leaning on one.
    { id: 'marrable', gx: 5.5, gy: 2.45, looking: { x: 0.3, y: 1 }, ...hours([9, 18]) },
    // Master Thrale at his ease in his chair across the table.
    { id: 'thrale', gx: 8.5, gy: 3.45, looking: { x: -0.4, y: 1 }, seated: true, ...hours([11, 17]) },
    // Tunstall, beside the chair he knocked over getting up.
    { id: 'tunstall', gx: 9.5, gy: 6.55, looking: { x: -0.6, y: -1 }, ...hours([10, 16]) },
    // Garrow by the fire, on a stool, his head in a bandage.
    { id: 'garrow', gx: 12.5, gy: 2.5, looking: { x: -1, y: 0.4 }, seated: true },
  ];
  // Edric Lowe: at the table during the meeting; afterwards, at the window, out of the others' way.
  npcs.push(met ? { id: 'edric', gx: 0.65, gy: 5.5, looking: { x: -1, y: 0.2 }, hours: [8, 21] } : { id: 'edric', gx: 6.5, gy: 6.5, looking: { x: 0, y: -1 } });
  const data: MapData = {
    ...emptyRoom(W, H),
    spawn: door,
    indoor: true,
    music: 'tavern',
    groundShade: SHADE,
    walls: {
      back: wall('back', ['plain', 'shelf', 'door', 'plain', 'banner', 'map0', 'map1', 'map2', 'portrait', 'banner', 'door', 'plain', 'plain', 'window']),
      side: wall('side', ['plain', 'window', 'brace', 'charter', 'plain', 'window', 'plain', 'brace', 'door', 'plain']),
      corner: 'gd-wall-corner',
    },
    doors: [
      { tx: 0, ty: 8, to: 'gloomhaven', entry: 'guildhall', label: 'Go outside' },
      { tx: 2, ty: 0, to: 'guildhall-counting', entry: 'door', label: 'Into the counting room', facing: 'back', id: 'guild-counting' },
      { tx: 10, ty: 0, to: 'guildhall-office', entry: 'door', label: "The guildmaster's office", facing: 'back', id: 'guild-office' },
    ],
    entries: { door, counting: { x: 2.5, y: 1.1 }, office: { x: 10.5, y: 1.1 } },
    lights: [
      // The fire, the candelabrum on the table, the two candlestands, the candle by the roll, the window's grey daylight.
      { gx: 12, gy: 0.9, z: 14, radius: 280, flicker: 1 },
      { gx: 6.5, gy: 4.5, z: 44, radius: 170, flicker: 0.4 },
      { gx: 2.5, gy: 7.5, z: 60, radius: 140, flicker: 0.5 },
      { gx: 11.5, gy: 7.5, z: 60, radius: 140, flicker: 0.5 },
      { gx: 4.2, gy: 4.3, z: 36, radius: 70, flicker: 0.5 },
      { gx: 13.5, gy: 0.3, z: 50, radius: 90, flicker: 0.1 },
      { gx: 0.3, gy: 1.5, z: 50, radius: 80, flicker: 0.1 },
    ],
    npcs,
    seats: [],
    sights: [],
    drips: [{ gx: 9.5, gy: 8.5, z: 118 }],
  };

  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });

  // On the floor: the carpet under the table, wet prints in from the Staithe, a puddle under the leak.
  add('gd-carpet', 3, 3, { w: 8, h: 4, flat: true });
  add('gd-prints', 1, 8, { w: 2, flat: true });
  add('br-puddle-1', 9, 8, { flat: true });
  add('br-bucket', 10, 8, { shapes: [circle(0.5, 0.5, 0.18)] });

  // Along the back wall: the charter chest, the roll of members, the scales, the sideboard under the map, the fireplace.
  add('gd-chest', 0, 0, { shapes: [box(0.08, 0.15, 0.92, 0.85)] });
  add('gd-lectern', 1, 1, { shapes: [circle(0.5, 0.5, 0.2)] });
  add('gd-scales', 3, 1, { shapes: [box(0.25, 0.25, 0.75, 0.75)] });
  add('gd-sideboard', 5, 0, { w: 2, shapes: [box(0.05, 0.08, 1.95, 0.63)] });
  add('gd-hearth', 11, 0, { w: 2, anim: 'gd-hearth-fire' });
  add('br-stool', 12, 2, { shapes: [circle(0.5, 0.5, 0.15)] });

  // The long table, its chairs (one pushed back, one knocked over), and the great chair at its head.
  const ends = ['w', '', '', '', '', 'e'];
  ends.forEach((_e, i) => {
    add(`gd-table-n-${i}`, 4 + i, 4, { shapes: [box(0, 0.06, 1, 1)] });
    add(`gd-table-s-${i}`, 4 + i, 5, { shapes: [box(0, 0, 1, 0.94)] });
  });
  add('gd-greatchair', 3, 4, { h: 2, shapes: [box(0.12, 0.45, 0.84, 1.55)] });
  for (const x of [5, 6, 9]) add('gd-chair-s', x, 3, { shapes: chairShape });
  add('gd-chair-s-pushed', 7, 3, { shapes: chairShape });
  add('gd-chair-s', 8, 3, { shapes: chairShape }); // Master Thrale's
  for (const x of [5, 7]) add('gd-chair-n', x, 6, { shapes: chairShape });
  add('gd-chair-fallen', 8, 6, { shapes: [box(0.15, 0.2, 0.96, 0.8)] });

  // Candlestands, the benches for those who wait, sample bales by the door.
  add('gd-candlestand', 2, 7, { shapes: [circle(0.5, 0.5, 0.18)] });
  add('gd-candlestand', 11, 7, { shapes: [circle(0.5, 0.5, 0.18)] });
  add('gd-bench', 5, 8, { w: 2, shapes: [box(0.05, 0.25, 1.95, 0.75)] });
  add('gd-bench', 12, 5, { w: 2, shapes: [box(0.05, 0.25, 1.95, 0.75)] });
  // Somewhere to wait on the guild: the benches by the door and by the fire.
  for (const [gx, gy, standY] of [[5.5, 8.5, 7.6], [6.5, 8.5, 7.6], [12.5, 5.5, 6.5], [13.5, 5.5, 6.5]]) {
    data.seats!.push({ name: 'gd-bench', gx, gy: gy - 0.05, faceX: 0, faceY: -1, standX: gx, standY });
  }
  add('gd-bales', 2, 9, { shapes: [box(0.08, 0.1, 0.92, 0.9)] });
  add('gd-bales-low', 0, 6, { shapes: [box(0.1, 0.2, 0.9, 0.8)] });
  add('furn-barrels', 13, 9, { shapes: barrelShape });

  data.sights!.push(
    {
      id: 'gd-map', gx: 6.5, gy: 0.15, label: 'Look at the map', z: 64,
      thought:
        'A great painted map of the trade roads: Gloomhaven on its mudbank, the river, the fen, and the causeway running north over it ' +
        'to the Saltway and on east to Hallowmarket. Three red crosses are inked on the causeway, close together, each with a pin stuck in beside it. ' +
        'Someone has written beside the middle one, small: THE DROWNED MILE.',
    },
    {
      id: 'gd-founder', gx: 8.5, gy: 0.15, label: 'Look at the portrait', z: 62,
      thought:
        'A stern old man in a fur hat with a ledger in his hands, black with candle-smoke. The plate says GODWIN MARRABLE, FIRST WARDEN OF THE CAUSEWAY. ' +
        'He looks as if he has just been told the price of salt and does not believe it.',
    },
    {
      id: 'gd-banner', gx: 4.5, gy: 0.15, label: 'Look at the banner', z: 70,
      thought: 'The guild\'s banner: a gold ship over a pair of scales, on blue silk gone grey with damp. The moths have been at the hem. FIDES IN VIA, it says. Faith on the road.',
    },
    {
      id: 'gd-charter', gx: 0.15, gy: 3.5, label: 'Read the charter', z: 60,
      thought:
        "The guild's charter, framed, three seals hanging off it. \"To the Merchants of the Causeway, the right to carry, to store and to sell, " +
        'and to keep the road over the fen free and open, for ever.\' For ever has a lot of mould on it.',
    },
    {
      id: 'gd-roll', gx: 1.5, gy: 1.5, label: 'Read the roll', z: 46,
      thought:
        'The roll of members, on its lectern. Thirty-one names on the first page, in different hands and inks. Most are struck through, ' +
        'with a word beside them: DEAD, GONE, SOLD. The last one struck out is in fresh ink: "Jos Cobley, cloth. SOLD." Sold to whom, it doesn\'t say.',
    },
    {
      id: 'gd-scales', gx: 3.5, gy: 1.5, label: 'Look at the scales', z: 60,
      thought: 'The guild\'s great scales, brass, polished where hands go. One pan has a pinch of salt in it, and it\'s gone down. Someone\'s idea of a joke, or a sermon.',
    },
    {
      id: 'gd-table', gx: 6.5, gy: 4.6, label: 'Look at the papers', z: 36,
      thought:
        'Reports, spread out and pushed about. "Caravan of six wagons, Marrable and Tunstall, set upon at the Drowned Mile, two men dead." ' +
        '"Caravan of four, Cobley, set upon at the Drowned Mile, all goods destroyed." "Caravan of five, Marrable, Lowe and Tunstall..." Always the Drowned Mile. Never Master Thrale\'s name.',
    },
    {
      id: 'gd-fallen-chair', gx: 8.5, gy: 6.5, label: 'Look', z: 12,
      thought: 'A chair on its back, kicked over by someone getting up in a hurry. Nobody has picked it up. Nobody here picks things up, it seems; they argue about who should.',
    },
    {
      id: 'gd-hearth', gx: 12, gy: 1.1, label: 'Look', z: 44,
      thought: 'Sea-coal, burning low and smoky. Over the fire, the guild\'s ship and scales are carved in the stone and picked out in gold. On the mantel, a clock stopped at a quarter to three, and a ship in a bottle with no name on her.',
    },
    {
      id: 'gd-sideboard', gx: 6, gy: 0.9, label: 'Look', z: 34,
      thought: 'A decanter of wine, the goblets, a silver ewer, and something under a cloth. I lift a corner: the guild\'s plate, a great silver dish. There are marks on the cloth where a second one used to sit.',
    },
    { id: 'gd-bucket', gx: 10.5, gy: 8.5, label: 'Look', z: 14, thought: 'A bucket under a leak in the ceiling. Even here.' },
    {
      id: 'gd-window', gx: 0.15, gy: 1.5, label: 'Look out', z: 60,
      thought: 'Through the wet glass, the Staithe: the pier, the barges, a man sitting on a bollard watching the Guildhall door. When I look again he has gone.',
    },
  );
  return data;
}

/**
 * The counting room, behind the hall: shelves of ledgers to the cornice,
 * pigeonholes of waybills, the clerk's high desk and his stool, the counting
 * table with its chequered cloth, the guild's strongbox, a brazier for the
 * clerk's cold hands, and the route book chained to its lectern, where every
 * caravan's road and day of leaving is written before it goes.
 */
export function buildGuildCountingMap(): MapData {
  const W = 8;
  const H = 6;
  const door = { x: 1.2, y: 4.5 };
  const data: MapData = {
    ...emptyRoom(W, H),
    spawn: door,
    indoor: true,
    music: 'tavern',
    groundShade: 0x9a8e80,
    walls: {
      back: wall('back', ['shelf', 'shelf', 'holes', 'window', 'holes', 'shelf', 'plain', 'brace']),
      side: wall('side', ['plain', 'holes', 'plain', 'brace', 'door', 'plain']),
      corner: 'gd-wall-corner',
    },
    doors: [{ tx: 0, ty: 4, to: 'guildhall', entry: 'counting', label: 'Back to the hall' }],
    entries: { door },
    lights: [
      { gx: 2.8, gy: 1.2, z: 50, radius: 120, flicker: 0.5 },
      { gx: 3.5, gy: 0.3, z: 50, radius: 90, flicker: 0.1 },
      { gx: 7.5, gy: 3.5, z: 16, radius: 110, flicker: 0.8 },
      { gx: 4.8, gy: 4.7, z: 36, radius: 70, flicker: 0.5 },
    ],
    npcs: [{ id: 'pim', gx: 2.5, gy: 2.45, looking: { x: 0, y: -1 }, hours: [7, 21] }],
    seats: [],
    sights: [],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  add('gd-desk', 2, 1, { shapes: [box(0.1, 0.12, 0.92, 0.88)] });
  add('gd-highstool', 1, 1, { shapes: [circle(0.5, 0.5, 0.18)] });
  add('gd-routebook', 5, 2, { shapes: [box(0.2, 0.25, 0.8, 0.75)] });
  add('gd-countingtable', 3, 4, { w: 2, shapes: [box(0.05, 0.1, 1.95, 0.9)] });
  add('br-strongbox', 7, 0);
  add('gd-brazier', 7, 3, { shapes: [circle(0.5, 0.5, 0.22)] });
  add('gd-bales-low', 7, 5, { shapes: [box(0.1, 0.2, 0.9, 0.8)] });
  add('gd-chest', 0, 0, { shapes: [box(0.08, 0.15, 0.92, 0.85)] });
  data.sights!.push(
    {
      id: 'gd-routebook', gx: 5.5, gy: 2.5, label: 'Read the route book', z: 40,
      thought: 'The route book, chained to its lectern. Pim is watching me over his spectacles. Not without his say-so.',
    },
    {
      id: 'gd-holes', gx: 2.5, gy: 0.1, label: 'Look at the pigeonholes', z: 60,
      thought: 'Waybills, rolled and tied with red tape, a little label under each in a neat, anxious hand: SALT. WOOL. CLOTH. PEPPER. One hole is labelled PAID and is empty.',
    },
    {
      id: 'gd-ledgers', gx: 0.5, gy: 0.1, label: 'Look at the ledgers', z: 60,
      thought: 'Ledgers to the ceiling, dated in gilt on their spines, a hundred years of them. The last few are thin. The very last is hardly a ledger at all.',
    },
    {
      id: 'gd-strongbox', gx: 7.5, gy: 0.6, label: 'Look', z: 30,
      thought: 'The guild\'s strongbox, iron-bound, with three locks. I knock on it. It sounds less full than a strongbox ought to.',
    },
    {
      id: 'gd-counting', gx: 4, gy: 4.5, label: 'Look', z: 34,
      thought: 'A counting board on a chequered cloth, the counters pushed to the losing side, and three little stacks of coin. Two of copper and gold. One of a bright new silver I don\'t know, set apart from the others.',
    },
    {
      id: 'gd-daybook', gx: 2.5, gy: 1.4, label: 'Look at the day-book', z: 48,
      thought: 'The day-book, open. "Received of Master Thrale, against the debt of Master Tunstall, forty silver." The same line, a week before, for Jos Cobley. And before that for the Widow Ames.',
    },
  );
  return data;
}

/**
 * The guildmaster's office, off the hall: his desk under heaps of letters, a
 * leather armchair, a cabinet of maps, a little grate, the portrait of his
 * late wife, and a window onto the river. Hamon Wexley doesn't sit in it if he
 * can help it; it is where the bad news is kept.
 */
export function buildGuildOfficeMap(): MapData {
  const W = 6;
  const H = 5;
  const door = { x: 1.2, y: 3.5 };
  const data: MapData = {
    ...emptyRoom(W, H),
    spawn: door,
    indoor: true,
    music: 'menu',
    groundShade: 0x9a8e80,
    walls: {
      back: wall('back', ['plain', 'portrait', 'window', 'charter', 'plain', 'brace']),
      side: wall('side', ['shelf', 'plain', 'brace', 'door', 'plain']),
      corner: 'gd-wall-corner',
    },
    doors: [{ tx: 0, ty: 3, to: 'guildhall', entry: 'office', label: 'Back to the hall' }],
    entries: { door },
    lights: [
      { gx: 4.5, gy: 0.9, z: 14, radius: 160, flicker: 0.9 },
      { gx: 3.3, gy: 2.7, z: 40, radius: 90, flicker: 0.5 },
      { gx: 2.5, gy: 0.3, z: 50, radius: 90, flicker: 0.1 },
    ],
    npcs: [],
    sights: [],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  add('gd-rug', 1, 1, { w: 2, h: 2, flat: true });
  add('gd-bigdesk', 2, 2, { w: 2, shapes: [box(0.05, 0.1, 1.95, 0.95)] });
  add('gd-armchair', 3, 1, { shapes: [box(0.15, 0.12, 0.85, 0.85)] });
  add('gd-cabinet', 0, 0, { shapes: [box(0.08, 0.12, 0.92, 0.82)] });
  add('gd-grate', 4, 0);
  add('gd-chest', 5, 4, { shapes: [box(0.08, 0.15, 0.92, 0.85)] });
  add('gd-candlestand', 5, 1, { shapes: [circle(0.5, 0.5, 0.18)] });
  data.sights!.push(
    {
      id: 'gd-letters', gx: 2.6, gy: 2.4, label: 'Look at the letters', z: 36,
      thought: 'Letters in heaps: bills, duns, complaints. I should not read the guildmaster\'s letters. Not without his leave, anyway.',
    },
    {
      id: 'gd-wife', gx: 1.5, gy: 0.15, label: 'Look at the portrait', z: 62,
      thought: 'A woman in a red gown with a rose in her hand, and a kind, tired face. The plate says MARGERY WEXLEY. Someone dusts this frame, and nothing else in the room.',
    },
    {
      id: 'gd-cabinet', gx: 0.5, gy: 0.6, label: 'Look', z: 36,
      thought: 'Shallow drawers of maps: the fen, the causeway, the Saltway, the roads east. One drawer is labelled THE OLD ROAD and is nailed shut.',
    },
    {
      id: 'gd-office-window', gx: 2.5, gy: 0.15, label: 'Look out', z: 60,
      thought: 'The river, brown and slow. A barge is going down it with no lantern lit, low in the water. Nobody on the Staithe seems to see it.',
    },
  );
  return data;
}
