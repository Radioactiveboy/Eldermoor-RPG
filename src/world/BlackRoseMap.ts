import { box, circle } from './Collision';
import { MapData, MapObject, placeObject, Prop, Seat, Terrain } from './MapData';

/**
 * The Black Rose, Gloomhaven's big tavern on the north side of the town square
 * (its front door is on the square, in world/GloomhavenMap.ts): the taproom,
 * the back room behind the curtain, the passage upstairs, and the one room
 * the Widow Thorne lets. Everything here is damp: the roof leaks, the boards
 * are black with wet, and the marsh is in the walls.
 */

/** The bed in the Widow's room to let (a save point while it's the hero's). */
export const ROSE_BED = { tx: 3, ty: 1, gx: 2.5, gy: 1.6 };
/** Where Midge fetches orders from, at the end of the bar. */
export const ROSE_PICKUP = { x: 14.5, y: 3.6 };
/** Where the Widow stands behind her bar. */
export const WIDOW_SPOT = { x: 12.5, y: 1.4 };

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
const trestleShape = [box(0.12, 0.12, 1, 0.88), box(1, 0.12, 1.88, 0.88)];
const barrelShape = [circle(0.3, 0.3, 0.28), circle(0.7, 0.72, 0.26)];
const crateShape = [box(0.1, 0.1, 0.9, 0.9)];
const postShape = [box(0.34, 0.34, 0.66, 0.66)];

/** The walls are cold and green: the floor goes darker under them, the boards black with damp. */
const DAMP = 0x9a98a4;

const wall = (side: 'back' | 'side', kinds: string[]) => kinds.map((k, i) => `br-wall-${side}-${k}-${i % 2}`);

/**
 * The taproom. The door from the square is in the left-hand wall near the
 * front; the hearth is in the far corner with Old Sedge's rocker before it,
 * and the stairs climb the back wall beside it. Behind the bar on the right
 * the Widow keeps her kegs, her bottles and her strongbox, with the black rose
 * painted on the plaster over her head; the curtained door to the back room
 * is at the bar's end, with Grubb beside it. A booth along the side wall, a
 * trestle or two, Silas's dice table, posts holding up the sagging ceiling,
 * and buckets under the leaks.
 */
export function buildBlackRoseMap(): MapData {
  const W = 16;
  const H = 12;
  const door = { x: 1.2, y: 9.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: door,
    indoor: true,
    music: 'tavern',
    groundShade: DAMP,
    walls: {
      back: wall('back', ['brace', 'plain', 'plain', 'pike', 'plain', 'brace', 'nets', 'curtain', 'plain', 'shelf', 'plain', 'window', 'rose', 'plain', 'brace', 'window']),
      side: wall('side', ['brace', 'window', 'plain', 'shelf', 'plain', 'window', 'plain', 'brace', 'plain', 'door', 'nets', 'window']),
      corner: 'br-wall-corner',
    },
    doors: [
      { tx: 0, ty: 9, to: 'gloomhaven', entry: 'blackrose', label: 'Go outside' },
      { tx: 4, ty: 1, to: 'blackrose-upstairs', entry: 'stairs', label: 'Go upstairs', facing: 'back' },
      { tx: 7, ty: 0, to: 'blackrose-back', entry: 'door', label: 'Go through the curtain', facing: 'back', id: 'rose-back' },
    ],
    entries: { door, stairs: { x: 4.5, y: 1.7 }, back: { x: 7.5, y: 1.1 } },
    lights: [
      { gx: 2, gy: 0.9, z: 14, radius: 300, flicker: 1 },
      { gx: 2.5, gy: 2.5, z: 40, radius: 110, flicker: 0.5 },
      { gx: 12.5, gy: 1.6, z: 44, radius: 150, flicker: 0.4 },
      { gx: 6.1, gy: 5.5, z: 60, radius: 150, flicker: 0.5 },
      { gx: 4.7, gy: 7.2, z: 44, radius: 90, flicker: 0.7 },
      { gx: 8.3, gy: 8.3, z: 42, radius: 100, flicker: 0.7 },
      { gx: 11.7, gy: 5.2, z: 44, radius: 90, flicker: 0.7 },
      { gx: 13.6, gy: 9.3, z: 44, radius: 90, flicker: 0.7 },
      { gx: 1.7, gy: 4.9, z: 42, radius: 90, flicker: 0.7 },
      { gx: 7.5, gy: 0.3, z: 30, radius: 60, flicker: 0.3 },
    ],
    // The Widow and Grubb always; Midge from morning; the regulars by the hour, and the worst of them after dark.
    npcs: [
      { id: 'thorne', gx: WIDOW_SPOT.x, gy: WIDOW_SPOT.y, looking: { x: 0, y: 1 } },
      { id: 'grubb', gx: 8.5, gy: 1.3, looking: { x: 0, y: 1 } },
      { id: 'midge', gx: 6.5, gy: 4.5, hours: [7, 26] },
      { id: 'hollis', gx: 0.55, gy: 4.6, looking: { x: 1, y: 0 }, hours: [9, 27] },
      { id: 'sedge', gx: 1.5, gy: 2.55, looking: { x: 1, y: 1 }, hours: [15, 25] },
      { id: 'silas', gx: 7.5, gy: 8.5, looking: { x: 1, y: 0 }, hours: [17, 29] },
      { id: 'ferret', gx: 2.5, gy: 7.5, looking: { x: 1, y: 0 }, hours: [18, 28] },
      { id: 'dunn', gx: 5.5, gy: 7.5, looking: { x: -1, y: 0 }, hours: [18, 28] },
    ],
    seats: [],
    sights: [],
    drips: [
      { gx: 6.5, gy: 6.5, z: 118 },
      { gx: 14.4, gy: 7.6, z: 118 },
      { gx: 10.6, gy: 10.4, z: 118 },
    ],
    // Where Midge wipes, sweeps and collects pots between times.
    chores: [
      { x: 3.5, y: 6.5, face: { x: 0, y: 1 } },
      { x: 11.5, y: 4.5, face: { x: 0, y: 1 } },
      { x: 12.5, y: 8.5, face: { x: 0, y: 1 } },
      { x: 2.5, y: 4.5, face: { x: -1, y: 0 } },
      { x: 9.5, y: 9.5, face: { x: -1, y: -1 } },
      { x: 6.5, y: 7.5, face: { x: 0, y: -1 } },
      { x: 3.5, y: 2.5, face: { x: -1, y: -1 } },
      { x: 14.5, y: 3.6, face: { x: -1, y: -1 } },
    ],
  };

  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  const seat = (tx: number, ty: number, face: { x: number; y: number }, stand: { x: number; y: number }, name = 'rose-table') =>
    data.seats!.push({ name, gx: tx + 0.5, gy: ty + 0.5 - (face.y < 0 ? 0.05 : 0), faceX: face.x, faceY: face.y, standX: stand.x, standY: stand.y } satisfies Seat);

  // On the floor: the rug before the hearth, mud tramped in from the square, puddles under the leaks, sawdust at the bar, old stains.
  add('br-rug', 1, 1, { w: 3, h: 2, flat: true });
  add('br-mud-0', 1, 9, { w: 2, flat: true });
  add('br-mud-1', 2, 10, { w: 2, flat: true });
  add('br-puddle-0', 1, 10, { flat: true });
  add('br-puddle-1', 6, 7, { flat: true });
  add('br-puddle-2', 14, 7, { flat: true });
  add('br-puddle-0', 10, 10, { flat: true });
  add('br-sawdust', 10, 3, { w: 3, flat: true });
  add('br-stain', 9, 5, { flat: true });
  add('br-stain', 6, 10, { flat: true });

  // The back wall: barrels in the corner, the hearth and its woodpile, the stairs, the back room's curtain.
  add('furn-barrels', 0, 0, { shapes: barrelShape });
  add('br-hearth', 1, 0, { w: 2, anim: 'br-hearth-fire' });
  add('br-woodpile', 3, 0, { shapes: [box(0.1, 0.05, 0.9, 0.85)] });
  for (let i = 0; i < 3; i++) add(`br-stairs-${i}`, 4 + i, 0);
  // Behind the bar: the strongbox, the kegs, the dresser of bottles, and more barrels.
  add('br-strongbox', 9, 0);
  add('br-kegs', 10, 0, { w: 2 });
  add('br-shelf', 13, 0, { w: 2 });
  add('furn-barrels', 15, 0, { shapes: barrelShape });
  add('br-bar-side', 9, 1, { shapes: [box(0.2, 0, 0.8, 1)] });
  add('br-bar-corner', 9, 2, { shapes: [box(0.2, 0, 0.8, 0.8), box(0.8, 0.2, 1, 0.8)] });
  [0, 1, 2, 3, 0].forEach((k, i) => add(`br-bar-${k}`, 10 + i, 2, { shapes: [box(0, 0.2, 1, 0.8)] }));
  for (let x = 10; x <= 14; x++) {
    add('br-stool', x, 3, { shapes: stoolShape });
    seat(x, 3, { x: 0, y: -1 }, { x: x + 0.5, y: 4.5 }, 'rose-bar');
  }

  // Old Sedge's rocker before the fire.
  add('br-rocker', 1, 2, { shapes: [box(0.18, 0.15, 0.82, 0.85)] });

  // The booth along the side wall: Hollis's settle, the table, and stools across from him.
  add('br-settle', 0, 4, { h: 2, shapes: [box(0.05, 0.02, 0.75, 1), box(0.05, 1, 0.75, 1.98)] });
  add('br-boothtable', 1, 4, { h: 2, shapes: [box(0.1, 0.05, 0.9, 1), box(0.1, 1, 0.9, 1.95)] });
  for (const y of [4, 5]) {
    add('br-stool', 2, y, { shapes: stoolShape });
    seat(2, y, { x: -1, y: 0 }, { x: 3.5, y: y + 0.5 }, 'rose-booth');
  }

  // The posts holding up the ceiling's sagging beam, one with a lantern.
  add('br-post-lantern', 5, 5, { shapes: postShape });
  add('br-post', 11, 7, { shapes: postShape });
  // Buckets under two of the leaks.
  add('br-bucket', 6, 6, { shapes: [circle(0.5, 0.5, 0.18)] });
  add('br-bucket', 10, 10, { shapes: [circle(0.5, 0.5, 0.18)] });

  // Dunn and Ferret's trestle.
  add('br-trestle-2', 3, 7, { w: 2, shapes: trestleShape });
  add('br-stool', 2, 7, { shapes: stoolShape }); // Ferret's
  add('br-stool', 5, 7, { shapes: stoolShape }); // Dunn's
  for (const x of [3, 4]) {
    add('br-stool', x, 8, { shapes: stoolShape });
    seat(x, 8, { x: 0, y: -1 }, { x: x + 0.5, y: 9.5 });
  }

  // Silas's dice table.
  add('br-dicetable', 8, 8, { shapes: [circle(0.5, 0.5, 0.42)] });
  add('br-stool', 7, 8, { shapes: stoolShape }); // Silas's
  add('br-stool', 9, 8, { shapes: stoolShape });
  seat(9, 8, { x: -1, y: 0 }, { x: 9.5, y: 9.5 }, 'rose-dice');
  add('br-stool', 8, 9, { shapes: stoolShape });
  seat(8, 9, { x: 0, y: -1 }, { x: 8.5, y: 10.5 }, 'rose-dice');

  // Two more trestles for whoever comes in.
  add('br-trestle-0', 11, 5, { w: 2, shapes: trestleShape });
  add('br-stool', 13, 5, { shapes: stoolShape });
  seat(13, 5, { x: -1, y: 0 }, { x: 13.5, y: 4.5 });
  for (const x of [11, 12]) {
    add('br-stool', x, 6, { shapes: stoolShape });
    seat(x, 6, { x: 0, y: -1 }, { x: x + 0.5, y: 7.5 });
  }
  add('br-trestle-1', 12, 9, { w: 2, shapes: trestleShape });
  add('br-stool', 14, 9, { shapes: stoolShape });
  seat(14, 9, { x: -1, y: 0 }, { x: 14.5, y: 8.5 });
  for (const x of [12, 13]) {
    add('br-stool', x, 10, { shapes: stoolShape });
    seat(x, 10, { x: 0, y: -1 }, { x: x + 0.5, y: 11.5 });
  }

  // Barrels and crates along the right, the notice board by the door.
  add('furn-barrels', 15, 5, { shapes: barrelShape });
  add('br-crate', 15, 11, { shapes: crateShape });
  add('br-crate', 0, 11, { shapes: crateShape });
  add('br-board', 0, 7, { blocks: [] });

  data.sights!.push(
    { id: 'rose-hearth', gx: 2, gy: 1.1, label: 'Look', z: 40, thought: "A pot of something grey bubbles over the fire. Eels, by the smell. One of them is looking at me." },
    { id: 'rose-pike', gx: 3.5, gy: 0.2, label: 'Look', z: 66, thought: 'A pike as long as my arm, stuffed and nailed to a board. Its glass eye has been painted over with a black rose. Somebody here has a sense of humour, or a grudge.' },
    { id: 'rose-mural', gx: 12.5, gy: 0.15, label: 'Look', z: 72, thought: 'A black rose, painted big on the plaster over the bar, the paint flaking with damp. The thorns have been gone over again in something darker, more recently.' },
    { id: 'rose-bucket', gx: 6.5, gy: 6.5, label: 'Look', z: 14, thought: 'Drip. Drip. Drip. The bucket is half full of rainwater with a scum of soot on top. Nobody is going to empty it.' },
    {
      id: 'rose-board', gx: 0.35, gy: 7.5, label: 'Read the notices', z: 58,
      sign: {
        heading: 'Nailed to the board',
        lines: [
          'WANTED: the man who calls himself "Tanner Jack". For the matter of the boat. Ask at the gate.',
          'EEL-CATCHER WANTED. Own traps. No questions. See Old Sedge.',
          'LOST: the Marigold, flat-bottomed, green, last seen going out into the fen at dusk. Reward.',
          '(Underneath, in another hand: "Not lost. Ask the lights.")',
          'The Rose does not give tick, does not hold coats, and does not know anybody. -M. Thorne',
          'In the middle, on its own nail: a little black card with a silver eye painted on it. Nothing else.',
        ],
      },
    },
  );
  return data;
}

/**
 * The back room, through the curtain: a card table under a low ceiling, a
 * high-backed chair for the gentleman in grey, smugglers' crates stacked to
 * the beams (one of them with a cold green light leaking between its slats),
 * the Widow's second strongbox, and a chart of the river and the fens nailed
 * up and marked in red.
 */
export function buildBlackRoseBackMap(): MapData {
  const W = 8;
  const H = 7;
  const door = { x: 1.2, y: 5.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: door,
    indoor: true,
    music: 'tavern',
    groundShade: 0x8a8898,
    walls: {
      back: wall('back', ['brace', 'plain', 'plain', 'shelf', 'plain', 'brace', 'plain', 'plain']),
      side: wall('side', ['plain', 'brace', 'plain', 'shelf', 'plain', 'curtain', 'plain']),
      corner: 'br-wall-corner',
    },
    doors: [{ tx: 0, ty: 5, to: 'blackrose', entry: 'back', label: 'Back to the taproom' }],
    entries: { door },
    lights: [
      { gx: 4.4, gy: 2.4, z: 40, radius: 150, flicker: 0.6 },
      { gx: 1.5, gy: 5.5, z: 30, radius: 60, flicker: 0.3 },
      { gx: 7.4, gy: 2.5, z: 20, radius: 90, flicker: 0.2 },
    ],
    npcs: [{ id: 'vane', gx: 3.5, gy: 1.45, looking: { x: 0, y: 1 }, hours: [19, 29] }],
    seats: [],
    sights: [],
    drips: [{ gx: 6.5, gy: 5.5, z: 110 }],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  add('br-cardtable', 3, 2, { w: 2, h: 2, shapes: [box(0.3, 0.3, 1, 1), box(1, 0.3, 1.7, 1), box(0.3, 1, 1, 1.7), box(1, 1, 1.7, 1.7)] });
  add('br-chair', 3, 1, { shapes: [box(0.2, 0.15, 0.8, 0.8)] });
  add('br-chair', 5, 2, { shapes: [box(0.2, 0.15, 0.8, 0.8)] });
  add('br-stool', 3, 4, { shapes: stoolShape });
  data.seats!.push({ name: 'rose-card', gx: 3.5, gy: 4.45, faceX: 0, faceY: -1, standX: 2.5, standY: 4.5 });
  add('br-chart', 1, 0, { blocks: [] });
  add('br-crate', 0, 0, { shapes: crateShape });
  add('br-crate', 0, 1, { shapes: crateShape });
  add('br-crate', 6, 0, { shapes: crateShape });
  add('br-crate-glow', 7, 0, { shapes: crateShape });
  add('br-crate', 7, 1, { shapes: crateShape });
  add('br-crate', 7, 4, { shapes: crateShape });
  add('br-strongbox', 5, 0);
  add('furn-barrels', 0, 3, { shapes: barrelShape });
  add('br-bucket', 6, 5, { shapes: [circle(0.5, 0.5, 0.18)] });
  add('br-puddle-1', 5, 5, { flat: true });
  add('br-rug', 2, 1, { w: 3, h: 2, flat: true });
  data.sights!.push(
    { id: 'rose-glow-crate', gx: 7.5, gy: 0.5, label: 'Look', z: 40, thought: 'A crate nailed down tight, sealed in red wax with a rose stamped in it. A cold green light leaks out between the slats, and the air round it is colder than the rest of the room. It feels like the orb did, under the hill.' },
    { id: 'rose-chart', gx: 1.5, gy: 0.1, label: 'Look', z: 56, thought: 'A chart of the river and the fens beyond Gloomhaven, the channels drawn in blue ink. Three places out in the marsh are marked in red. One of them is ringed twice, and someone has written beside it: "the old church".' },
    { id: 'rose-crates', gx: 0.5, gy: 0.5, label: 'Look', z: 30, thought: 'Crates stencilled SALT FISH. They do not smell of fish. They do not smell of anything, which is somehow worse.' },
  );
  return data;
}

/** The passage upstairs: four doors, one of them the room the Widow lets, a candle at the end, a bucket under the worst of the leaks. */
export function buildBlackRoseUpstairsMap(): MapData {
  const W = 10;
  const H = 3;
  const stairs = { x: 1.2, y: 1.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: stairs,
    indoor: true,
    music: 'tavern',
    groundShade: DAMP,
    walls: {
      back: wall('back', ['window', 'plain', 'door', 'brace', 'door', 'plain', 'door', 'plain', 'door', 'window']),
      side: wall('side', ['plain', 'door', 'brace']),
      corner: 'br-wall-corner',
    },
    doors: [{ tx: 0, ty: 1, to: 'blackrose', entry: 'stairs', label: 'Go downstairs' }],
    entries: { stairs },
    lights: [
      { gx: 9.5, gy: 2.5, z: 28, radius: 130, flicker: 0.7 },
      { gx: 4.5, gy: 0.4, z: 60, radius: 110, flicker: 0.4 },
    ],
    sights: [
      { id: 'rose-up-window', gx: 0.5, gy: 0.3, label: 'Look out', z: 60, thought: 'The square, below, black and wet. Somebody is standing by the well in the rain, not moving, looking up at this window. Then they are not.' },
      { id: 'rose-up-boots', gx: 1.7, gy: 0.5, label: 'Look', z: 6, thought: 'A pair of boots outside the first door, as if left out to be blacked. They are full of water. Something is living in the left one.' },
      { id: 'rose-up-scratches', gx: 7.3, gy: 0.3, label: 'Look', z: 30, thought: 'Scratches in the plaster beside the Widow\'s door, low down, in fours. Like a dog wanting in. A big dog.' },
    ],
    drips: [{ gx: 5.5, gy: 2.5, z: 100 }],
  };
  // The second door is the room to let; the others are the lodgers' and the Widow's own.
  [1, 2, 3, 4].forEach((n) => {
    const tx = n * 2;
    data.doors!.push({ tx, ty: 0, to: 'blackrose-room', entry: 'door', label: n === 2 ? 'The room to let' : `Door ${n}`, facing: 'back', id: `rose-room-${n}` });
    data.entries![`room-${n}`] = { x: tx + 0.5, y: 1.1 };
  });
  placeObject(data, { key: 'br-runner', tx: 1, ty: 1, w: 8, h: 1, flat: true });
  placeObject(data, { key: 'br-sidetable', tx: 9, ty: 2, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.3)] });
  placeObject(data, { key: 'br-bucket', tx: 5, ty: 2, w: 1, h: 1, shapes: [circle(0.5, 0.5, 0.18)] });
  placeObject(data, { key: 'br-crate', tx: 0, ty: 2, w: 1, h: 1, shapes: crateShape });
  placeObject(data, { key: 'br-plainchair', tx: 7, ty: 2, w: 1, h: 1, shapes: [box(0.28, 0.28, 0.72, 0.72)] });
  placeObject(data, { key: 'br-mud-1', tx: 2, ty: 1, w: 2, h: 1, flat: true });
  placeObject(data, { key: 'br-puddle-1', tx: 5, ty: 1, w: 1, h: 1, flat: true });
  return data;
}

/**
 * The room the Widow lets: a sagging bed (the hero's to sleep in, and so save,
 * while it's paid for), a cracked washstand, a sea-chest, a chamber pot, a
 * chair to wedge under the door handle, and a window on the marsh.
 */
export function buildBlackRoseRoomMap(): MapData {
  const W = 5;
  const H = 5;
  const door = { x: 1.2, y: 3.5 };
  const data: MapData = {
    ...emptyRoom(W, H, Terrain.Floor),
    spawn: door,
    indoor: true,
    music: 'menu',
    groundShade: DAMP,
    walls: {
      back: wall('back', ['plain', 'window', 'plain', 'brace', 'window']),
      side: wall('side', ['brace', 'window', 'plain', 'door', 'plain']),
      corner: 'br-wall-corner',
    },
    doors: [{ tx: 0, ty: 3, to: 'blackrose-upstairs', entry: 'room-2', label: 'Go out to the passage' }],
    entries: { door },
    lights: [
      { gx: 4.5, gy: 0.5, z: 28, radius: 140, flicker: 0.6 },
      { gx: 1.5, gy: 0.4, z: 50, radius: 70, flicker: 0.2 },
    ],
    beds: [{ id: 'blackrose-room', ...ROSE_BED }],
    sights: [
      { id: 'rose-room-window', gx: 1.5, gy: 0.3, label: 'Look out', z: 60, thought: 'Over the roofs the marsh runs out flat and grey to nowhere. Far out in it, a pale green light moves, stops, and goes out.' },
      { id: 'rose-room-bedpost', gx: 3.2, gy: 0.3, label: 'Look', z: 30, thought: 'Somebody has scratched words into the bedpost with a knife, small and careful: IT SEES WHAT YOU SEE. Then, bigger: DONT LOOK IN IT.' },
      { id: 'rose-room-hole', gx: 0.3, gy: 1.5, label: 'Look', z: 8, thought: 'A rat-hole in the skirting, stuffed with a rag. The rag is moving.' },
    ],
    drips: [{ gx: 1.5, gy: 2.5, z: 90 }],
  };
  const add = (key: string, tx: number, ty: number, extra: Partial<MapObject> = {}) => placeObject(data, { key, tx, ty, w: 1, h: 1, ...extra });
  add('br-bed', 3, 0, { h: 2 });
  add('br-washstand', 1, 0, { shapes: [box(0.15, 0.15, 0.85, 0.85)] });
  add('br-chest', 4, 3, { shapes: [box(0.1, 0.2, 0.9, 0.8)] });
  add('br-pot', 4, 2, { shapes: [circle(0.5, 0.5, 0.14)] });
  add('br-plainchair', 0, 4, { shapes: [box(0.28, 0.28, 0.72, 0.72)] });
  add('br-bucket', 1, 2, { shapes: [circle(0.5, 0.5, 0.18)] });
  add('br-puddle-2', 2, 2, { flat: true });
  return data;
}
