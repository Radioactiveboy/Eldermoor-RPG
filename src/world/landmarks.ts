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
/** The goblins who come pouring out of their holes at the far end of the brood hall when the orb sets them on the hero. */
export const SWARM: CreatureSpawn[] = [
  { id: 'bh-swarm-0', kind: 'goblinspear', gx: 22.5, gy: 24.5, notice: 12 },
  { id: 'bh-swarm-1', kind: 'goblin', gx: 23.5, gy: 21.5, notice: 12 },
  { id: 'bh-swarm-2', kind: 'goblintorch', gx: 20.5, gy: 26.2, notice: 12 },
  { id: 'bh-swarm-3', kind: 'goblin', gx: 24.2, gy: 18.5, notice: 12 },
];
