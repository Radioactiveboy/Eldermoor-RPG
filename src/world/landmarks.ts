/**
 * Spots in the area maps that the game needs while it runs, wherever the hero is: where the
 * tavern's bar is, which rats are in the cellar, where the moonpetal grows, the monastery
 * gate's shape when it opens. They live here rather than in the map files, so the map files
 * can stay out of the first download and come down when their area is first entered
 * (see scenes/game/areas.ts). Anything the rest of the game reads from a map belongs here too.
 */
import { box, Shape } from './Collision';
import type { CreatureSpawn, Door, HenPen, Sight } from './MapData';

/** Where Osric stands to the anvil's face, and Hilde's kneading trough (WorkshopMaps), for the sparks and the flour. */
export const ANVIL = { x: 3.5, y: 3.3 };
export const TROUGH = { x: 4, y: 3.3 };

/**
 * Osric's hammer stroke, top (0) to bottom (1), as the frames of his '-work-' animation
 * (art/workshops.ts), and the frame where it lands on the anvil (scenes/game/workshops.ts).
 */
export const HAMMER_STROKE = [1, 0.65, 0.3, 0.05, 0, 0.45, 1, 1];
export const HAMMER_LANDS = HAMMER_STROKE.indexOf(1, 1);

/** Where a maid goes to fetch an order from the bar (TavernMap). */
export const BAR_PICKUP = { x: 7.5, y: 3.5 };

/** The rats in the cellar, in two nests (see the 'cellar-rats' quest and TavernMap). */
export const CELLAR_RATS = ['cellar-rat-1', 'cellar-rat-2', 'cellar-rat-3', 'cellar-rat-4', 'cellar-rat-5', 'cellar-rat-6'];
/** Where they nest (TavernMap), which is where more come back to when the militia post a bounty on them (systems/Bounties.ts). */
export const CELLAR_RAT_SPOTS: Array<[number, number]> = [
  [11.5, 2.6], [10.4, 3.4], [12.2, 3.6],
  [2.6, 6.5], [3.6, 7.4], [4.4, 6.2],
];

/** The militia's notice board in the market square (MarketMap), where bounties are posted and paid. */
export const BOUNTY_BOARD = { id: 'bounty-board', tx: 21, ty: 13 };

/**
 * The lane at the south end of Adowvale (see MarketMap.ts addGarrisonLane): the back corners of the
 * militia garrison and the Headman's residence, the hatch down to the jail, and the residence's garden gate.
 */
export const GARRISON_LANE = {
  garrison: { tx: 5, ty: 32 },
  hatch: { tx: 9, ty: 33 },
  residence: { tx: 14, ty: 30 },
  gate: { tx: 17, ty: 37 },
};

/** Where the moonpetal grows, on the stone rim of the cloister pond (tile positions, AbbeyMap). */
export const MOONPETAL = [
  { id: 'moonpetal-0', tx: 19, ty: 14 },
  { id: 'moonpetal-1', tx: 24, ty: 15 },
  { id: 'moonpetal-2', tx: 20, ty: 19 },
] as const;

/** The row the monastery's wall stands on, across the whole map (MonasteryMap). */
export const MONASTERY_WALL_Y = 8;
/** The monastery gatehouse's west corner: it is four tiles wide, with the road coming up to its middle. */
export const MONASTERY_GATE_X = 30;

/** The gatehouse's outline: shut, the whole width; open, only the buttresses either side of the arch. */
export function monasteryGateShape(open: boolean): { shapes: Shape[]; blocks: Array<[number, number]> } {
  return open
    ? { shapes: [box(0.1, 0.2, 1, 0.95), box(3, 0.2, 3.9, 0.95)], blocks: [[0, 0], [3, 0]] }
    : {
        shapes: [box(0.1, 0.2, 1, 0.95), box(1, 0.25, 2, 0.75), box(2, 0.25, 3, 0.75), box(3, 0.2, 3.9, 0.95)],
        blocks: [[0, 0], [1, 0], [2, 0], [3, 0]],
      };
}

/**
 * The tiles in the gate's arch, which lead inside once it's open: like the toll
 * gate, walking into the arch asks whether to go in (and saying no steps back).
 */
export function monasteryGateDoors(): Door[] {
  return [MONASTERY_GATE_X + 1, MONASTERY_GATE_X + 2].map((tx) => ({
    tx, ty: MONASTERY_WALL_Y, to: 'abbey' as const, entry: 'gate', auto: true, ask: "Do you want to go in through the gate of Saint Elda's?",
  }));
}

/** Where Speckle pecks about in Iran's hut once she's home (scenes/game/speckle.ts): the floor between the door and the table. */
export const HUT_HEN_PEN: HenPen = { x0: 1, y0: 3, x1: 4.6, y1: 5.6 };
export const HUT_SPECKLE = { x: 2.4, y: 4.4 };

/** Where Hetty's rag doll Moppet lies after the raid, under the beam that fell in the burnt cottage (see HomeMap.ts). */
export const MOPPET_SIGHT: Sight = { id: 'ruin-moppet', gx: 4.6, gy: 5.5, label: 'Look under the fallen beam', z: 12 };

/**
 * Where Speckle hides after the raid: the open ground inside the garden fence
 * beside the cottage, its crops trampled flat (see MapGenerator.ts addGarden).
 */
export const GARDEN_PEN: HenPen = { x0: 24, y0: 35, x1: 29, y1: 40 };

/** Where the hero comes into the goblins' warren (WarrenMap), from the hole in the hill on the Greyfells. */
export const WARREN_MOUTH = { x: 1.2, y: 3.5 };

/** The brood hall at the bottom of the warren (BroodHallMap): Mother's furs (2 x 1) and where she is spoken to, and the orb on its plinth. */
export const MOTHER_PALLET = { tx: 15, ty: 15 };
export const MOTHER_AT = { x: 16.2, y: 16.6 };
export const ORB = { tx: 16, ty: 20 };
/** The dark orb on its plinth once the voice has gone out of it: the hero takes it (see scenes/game/warren.ts). */
export const ORB_TAKE: Sight = {
  id: 'bh-orb-take', gx: ORB.tx + 0.5, gy: ORB.ty + 0.5, label: 'Take the orb', z: 34,
};
/** The goblins who come pouring out of their holes at the far end of the brood hall when the orb sets them on the hero. */
export const SWARM: CreatureSpawn[] = [
  { id: 'bh-swarm-0', kind: 'goblinspear', gx: 22.5, gy: 24.5, notice: 12 },
  { id: 'bh-swarm-1', kind: 'goblin', gx: 23.5, gy: 21.5, notice: 12 },
  { id: 'bh-swarm-2', kind: 'goblintorch', gx: 20.5, gy: 26.2, notice: 12 },
  { id: 'bh-swarm-3', kind: 'goblin', gx: 24.2, gy: 18.5, notice: 12 },
];

/** Where the hero lies in a rented room at the Crooked Tankard (the bed in TavernMap's room), for waking there. */
export const TAVERN_BED = { tx: 3, ty: 1, gx: 2.5, gy: 1.6 };

/** Adowvale Jetty, the landing on the river Wend below the village (JettyMap): its size, and where the path comes down from Adowvale. */
export const JETTY_W = 52;
export const JETTY_H = 62;
export const JETTY_PATH_X = 20;
/**
 * The pier: its stem, two planks wide (columns x0 and x1), runs out from the quay to the cross-head, whose
 * two rows start at headY and run from headX0 to headX1.
 */
export const PIER = { x0: 22, x1: 23, headY: 30, headX0: 19, headX1: 26 };
/** Where the Grey Heron lies alongside the pier (her back corner, and her footprint along the stem). */
export const HERON_BERTH = { tx: 24, ty: 22, w: 2, h: 7 };
/**
 * The lane down to the jetty, off the bottom of Adowvale's map (MarketMap): the columns its road runs off on,
 * through the gap in the palisade.
 */
export const JETTY_LANE = { x0: 11, x1: 12 };

/**
 * Gloomhaven (GloomhavenMap), the marsh town downriver: its size, and the places other code needs to find in it.
 * The river runs along its south side, a palisade on a stone footing closes the other three, and the gate is
 * in the north wall.
 */
export const GLOOM_W = 60;
export const GLOOM_H = 88;
/** The wall: the rows and columns its north, west and east runs stand on (they run down to the river). */
export const GLOOM_WALL = { north: 4, west: 3, east: 56 };
/** The gatehouse in the north wall: its back corner and footprint, and the columns of the way through it. */
export const GLOOM_GATE = { tx: 35, ty: 3, w: 6, h: 2, road: { x0: 37, x1: 38 } };
/**
 * The Black Rose, the big tavern on the north side of the square: its back corner and footprint, and its front
 * door (in the middle of its +y face). Inside is the 'blackrose' area, once it's built.
 */
export const BLACK_ROSE = { tx: 24, ty: 12, w: 10, h: 7, door: { tx: 29, ty: 19 } };
/** The well in the middle of the square, in front of the Black Rose. */
export const GLOOM_WELL = { tx: 29, ty: 24 };
/** The pier out into the river: its stem (two planks wide) from the bank to its head, and the head's two rows. */
export const GLOOM_PIER = { x0: 29, x1: 30, fromY: 45, headY: 53, headX0: 26, headX1: 33 };
/**
 * Where the Grey Heron lies at Gloomhaven, while she's brought the hero down from Adowvale: alongside the
 * outer face of the pier's cross-head, bow upstream (west). Her art is her 2 x 7 footprint turned a quarter
 * about its middle (art/jetty.ts, HERON_PIVOT), so that middle, at (tx + 1, ty + 3.5), is (30, 56.5).
 */
export const GLOOM_HERON = { tx: 29, ty: 53, w: 2, h: 7 };

/**
 * The Shambles, Gloomhaven's east quarter (world/ShamblesYard.ts): Saul Rendle's slaughterhouse on the north
 * side of the lane, facing it; behind the lane, Morrow Vetch's tannery with its yard of pits on its far (south)
 * side, the barn where the Red Aprons keep their dog pit beside it against the east wall, and Old Scritch the
 * rat-catcher's den on the corner by the road down to the Staithe. Each is a back corner, a footprint, and the
 * tile in front of its door. Inside are the 'slaughterhouse', 'tannery', 'ratden' and 'dogpit' areas.
 */
export const SHAMBLES = {
  slaughterhouse: { tx: 44, ty: 23, w: 5, h: 4, door: { tx: 46, ty: 27 } },
  tannery: { tx: 48, ty: 31, w: 5, h: 4, door: { tx: 49, ty: 35 } },
  pitbarn: { tx: 53, ty: 31, w: 3, h: 3, door: { tx: 54, ty: 34 } },
  // Turned to face the road (+x), so its door is in its east wall.
  ratden: { tx: 42, ty: 31, w: 3, h: 3, door: { tx: 45, ty: 32 } },
} as const;

/**
 * The Reeve's toll house, just inside the Fen Gate on the west side of the road: its back corner and footprint
 * (its art is 5 wide and 4 deep, turned so its front faces the road, +x), and its front door, on the road side.
 * Inside is the 'tollhouse' area (world/TollHouseMap.ts).
 */
export const TOLL_HOUSE = { tx: 29, ty: 5, w: 4, h: 5, door: { tx: 33, ty: 7 } };
