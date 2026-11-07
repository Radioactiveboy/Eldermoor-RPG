import { MapData, placeObject, Prop, Terrain } from './MapData';

export const HOME_W = 8;
export const HOME_H = 7;

/**
 * The family cottage, inside. A single room: Mother's bed and the hearth along
 * the back wall, the table in the middle, the player's straw bed by the front,
 * and the door out to the village on the left wall.
 *
 * Wall art keys come from art/interior.ts; index 0..7 along each wall.
 */
export function buildHomeMap(ruined = false): MapData {
  if (ruined) return buildRuinedHomeMap();
  const terrain: Terrain[][] = [];
  const props: Prop[][] = [];
  for (let y = 0; y < HOME_H; y++) {
    terrain.push(new Array(HOME_W).fill(Terrain.Floor));
    props.push(new Array(HOME_W).fill(Prop.None));
  }

  const data: MapData = {
    width: HOME_W,
    height: HOME_H,
    terrain,
    props,
    spawn: { x: 6.5, y: 3.5 },
    indoor: true,
    music: 'home',
    walls: {
      back: ['plain-0', 'plain-1', 'window-0', 'plain-0', 'plain-1', 'shelf-0', 'plain-1', 'window-1'].map((k) => `wall-back-${k}`),
      side: ['plain-1', 'shelf-1', 'window-0', 'plain-0', 'plain-1', 'door-0', 'window-1'].map((k) => `wall-side-${k}`),
    },
    doors: [{ tx: 0, ty: 5, to: 'world', entry: 'cottage' }],
    entries: { door: { x: 1.2, y: 5.5 } },
    lights: [
      { gx: 4, gy: 0.9, z: 14, radius: 300, flicker: 1 },
      { gx: 4.6, gy: 3.3, z: 40, radius: 110, flicker: 0.35 },
      { gx: 0.6, gy: 0.6, z: 26, radius: 90, flicker: 0.35 },
    ],
    npcs: [{ id: 'mother', gx: 2.5, gy: 1.6 }],
    // The hero's own straw bed: sleeping in it saves the game.
    beds: [{ id: 'home-bed', tx: 7, ty: 4, gx: 6.5, gy: 4.9 }],
    // The stools around the table, each facing it.
    seats: [
      { name: 'stool', gx: 2.5, gy: 3.5, faceX: 1, faceY: 0, standX: 2.5, standY: 4.5 },
      { name: 'stool', gx: 5.5, gy: 3.5, faceX: -1, faceY: 0, standX: 5.5, standY: 4.5 },
      { name: 'stool', gx: 4.5, gy: 4.5, faceX: 0, faceY: -1, standX: 4.5, standY: 5.5 },
    ],
  };

  const add = (key: string, tx: number, ty: number, w = 1, h = 1, extra: Partial<Parameters<typeof placeObject>[1]> = {}) =>
    placeObject(data, { key: `furn-${key}`, tx, ty, w, h, ...extra });

  add('rug', 2, 2, 3, 2, { flat: true });
  add('doormat', 0, 5, 1, 1, { flat: true });
  add('stool', 0, 0);
  add('bed', 1, 0, 1, 2);
  add('hearth', 3, 0, 2, 1, { anim: 'hearth-fire' });
  add('cupboard', 6, 0);
  add('barrels', 7, 0);
  add('table', 3, 3, 2, 1);
  add('stool', 2, 3);
  add('stool', 5, 3);
  add('stool', 4, 4);
  add('chest', 0, 3, 1, 1, { flipX: true });
  add('strawbed', 7, 4, 1, 2);
  // Mother's pot and spit over the hearth: cook here (see systems/Crafting.ts).
  data.sights = [{ id: 'home-hearth', gx: 4, gy: 1.1, label: 'Cook at the hearth', z: 34, station: 'home-hearth' }];
  return data;
}

/**
 * The cottage after the goblins: the thatch burnt off and the sky showing
 * through the rafters, the walls charred and holed, everything smashed or
 * turned out, the hearth cold, and blood by Mother's bed and across the floor
 * to the door. Mother is gone. The hero's straw bed, scorched, can still be
 * slept in.
 */
function buildRuinedHomeMap(): MapData {
  const data = buildHomeMap();
  data.objects = [];
  for (const row of data.props) row.fill(Prop.None);
  data.npcs = [];
  data.music = 'ruin';
  data.walls = {
    back: ['plain-0', 'plain-1', 'window-0', 'plain-0', 'plain-1', 'shelf-0', 'plain-1', 'window-1'].map((k) => `wall-back-burnt-${k}`),
    side: ['plain-1', 'shelf-1', 'window-0', 'plain-0', 'plain-1', 'door-0', 'window-1'].map((k) => `wall-side-burnt-${k}`),
  };
  // No fire in the hearth: only daylight through the roof, and a last glow in the ashes.
  data.lights = [
    { gx: 4, gy: 0.9, z: 6, radius: 70, flicker: 0.6 },
    { gx: 3.5, gy: 3, z: 120, radius: 260, flicker: 0 },
  ];
  data.seats = [];
  data.beds = [{ id: 'home-bed', tx: 7, ty: 4, gx: 6.5, gy: 4.9 }];
  const add = (key: string, tx: number, ty: number, w = 1, h = 1, extra: Partial<Parameters<typeof placeObject>[1]> = {}) =>
    placeObject(data, { key, tx, ty, w, h, ...extra });

  add('furn-rug-burnt', 2, 2, 3, 2, { flat: true });
  add('decal-scorch-0', 4, 1, 2, 2, { flat: true });
  add('decal-ash-1', 6, 2, 1, 1, { flat: true });
  add('decal-debris-0', 5, 5, 1, 1, { flat: true });
  // Mother's blood: a pool by her bed, smeared across the floor, and drops out of the door.
  add('decal-blood-pool', 2, 1, 1, 1, { flat: true });
  add('decal-blood-smear', 1, 3, 2, 1, { flat: true });
  add('decal-blood-drops', 1, 4, 1, 1, { flat: true });
  add('decal-blood-drops', 0, 5, 1, 1, { flat: true });
  add('furn-stool-burnt', 0, 0);
  add('furn-bed-ruined', 1, 0, 1, 2);
  add('furn-hearth-cold', 3, 0, 2, 1);
  add('furn-cupboard-ransacked', 6, 0);
  add('furn-barrels-smashed', 7, 0);
  add('furn-table-broken', 3, 3, 2, 1);
  add('furn-stool-fallen', 2, 4);
  add('furn-stool-burnt', 5, 3);
  add('furn-chest-broken', 0, 3, 1, 1, { flipX: true });
  add('ruin-beam', 4, 5, 2, 1, { blocks: [] });
  add('furn-strawbed-burnt', 7, 4, 1, 2);
  data.sights = [
    {
      id: 'ruin-mother-bed', gx: 2.4, gy: 1.4, label: "Look at Mother's bed", z: 30,
      thought: "Her quilt is torn half off, and soaked dark. There's so much blood. And a trail of it, all the way to the door. They dragged her out. Please, please let her be alive.",
    },
    {
      id: 'ruin-hearth', gx: 4, gy: 1.1, label: 'Look at the hearth', z: 30,
      thought: "Stone cold. Mother's pot is gone, and the spit. They even took the pot.",
    },
    {
      id: 'ruin-chest', gx: 1.4, gy: 3.5, label: 'Look in the chest', z: 22,
      thought: "Smashed open and emptied. Father's old cloak, the good candlesticks, the little purse she kept for the winter. All gone.",
    },
    {
      id: 'ruin-roof', gx: 3.5, gy: 3.5, label: 'Look up', z: 34,
      thought: 'Nothing but black rafters and grey sky where the thatch was. It still smells of smoke and burnt straw.',
    },
  ];
  return data;
}
