import type { HillField } from './greyfellsHills';
import type { TrackName } from '../audio/Audio';
import type { HenKind } from '../art/henfarm';
import type { FoeKind } from '../systems/Combat';
import type { CropKind } from '../systems/Farm';
import type { WaterId } from '../systems/Fishing';
import type { ItemId } from '../systems/Inventory';
import type { Villager, Whereabouts } from '../systems/VillageDay';
import type { Shape } from './Collision';

export enum Terrain {
  Grass,
  Dirt,
  Stone,
  Water,
  Sand,
  Floor,
  /** Tilled garden soil. */
  Soil,
  /** The gravelly rock floor of a cave. */
  Cave,
}

export enum Prop {
  None,
  Tree,
  Rock,
  /** A tile covered by a building or furniture (see MapData.objects). */
  Blocked,
}

/**
 * The places the player can be. Each is its own map; doors lead between them.
 * ('market' is the village of Adowvale, round its market square: the id is kept so old saves still load.)
 */
export type AreaId =
  | 'home' | 'world' | 'market' | 'cave' | 'hut' | 'plains' | 'monastery'
  // The forest north of the Hollow, beyond the wolves' cave, and inside the old watchtower there.
  | 'northwoods' | 'watchtower'
  // The old signal beacon on Corbie Tor, in the far north of the plains: the hall inside it, and its roof with the brazier.
  | 'beacon' | 'beacon-top'
  // The open moor above the north woods, where the goblins camped on their way home with Mother.
  | 'greyfells'
  // Under the Greyfells: the goblins' warren, and the brood hall at the bottom of it.
  | 'warren' | 'broodhall'
  // Inside Saint Elda's walls: the grounds, and the rooms off them.
  | 'abbey' | 'chapel' | 'infirmary' | 'scriptorium' | 'refectory'
  // The Wolf Mother's den on the plains, and the passage beyond its crevice.
  | 'den' | 'deepden'
  // The Crooked Tankard in Adowvale: the taproom, the passage upstairs, a rented room, and the cellar.
  | 'tavern' | 'tavern-hall' | 'tavern-room' | 'cellar'
  // Workshops off Adowvale's square: Osric's smithy and Hilde's bakery.
  | 'smithy' | 'bakery'
  // On the lane at the south end of Adowvale: the militia garrison, its jail, and the Headman's residence.
  | 'garrison' | 'jail' | 'residence'
  // Down the lane past the garrison: Adowvale's landing on the river Wend, with its pier, boats and fishing huts.
  | 'jetty'
  // Gloomhaven, the walled marsh town downriver (no way there in play yet: see the debug panel).
  | 'gloomhaven'
  // The Black Rose on Gloomhaven's square: the taproom, the back room behind the curtain, the passage upstairs, and the room to let.
  | 'blackrose' | 'blackrose-back' | 'blackrose-upstairs' | 'blackrose-room'
  // Lusk's, the pawnshop on the square's north-east corner: the shop floor, the counting room upstairs, and the stash under the roof.
  | 'pawnshop' | 'pawn-counting' | 'pawn-attic'
  // The Reeve's toll house just inside Gloomhaven's Fen Gate: the toll office, its strongroom, and the Reeve's rooms upstairs.
  | 'tollhouse' | 'tollhouse-strong' | 'tollhouse-upstairs'
  // Homes down Sump Lane in Gloomhaven's west quarter: the Crowes' cottage, Ned Wick's stilt house, the Widow Pruett's hovel, and the burnt house.
  | 'sump-crowe' | 'sump-stilt' | 'sump-pruett' | 'sump-ruin';

/**
 * A building or piece of furniture standing on the grid. Its art (see
 * art/interior.ts) is anchored at the object's back corner (tx, ty).
 */
export interface MapObject {
  key: string;
  tx: number;
  ty: number;
  /** Footprint in tiles, along x and y. */
  w: number;
  h: number;
  /** Painted flat into the floor (rugs, mats) instead of standing up. */
  flat?: boolean;
  /** Mirror the art, which swaps which wall it backs onto. */
  flipX?: boolean;
  /** Animation to play on it (e.g. the hearth's fire). */
  anim?: string;
  /** Hangs high overhead (stalactites), so it's drawn in front of anyone walking beneath it. */
  overhead?: boolean;
  /** Tiles it blocks, if not its whole footprint (relative to tx, ty). */
  blocks?: Array<[number, number]>;
  /**
   * Its outline for collisions (relative to tx, ty), if it's slimmer than the
   * tiles it blocks, like a fence. Each shape must lie inside one tile.
   */
  shapes?: Shape[];
  /**
   * Tall enough to hide someone (the rock walls in the Wolf Mother's den): it
   * turns see-through while the hero is behind it.
   */
  fades?: boolean;
  /**
   * Afloat (a boat at its moorings): it rides up and down on the water, this many
   * pixels either way, at its own slow pace (see IsoMap.placeObject).
   */
  bob?: number;
  /**
   * A fence or palisade: where it runs along the map's edge, the forest painted
   * past the edge still grows right up to it (see IsoMap.renderOutskirts),
   * rather than stopping as it does behind a building.
   */
  fence?: boolean;
}

/**
 * A way to another area: a door the player uses with E, or (when `auto`) the
 * end of a road at the map's edge, which the player just walks off.
 */
export interface Door {
  tx: number;
  ty: number;
  to: AreaId;
  /** Entry point name in the destination's MapData.entries. */
  entry: string;
  /** Taken by walking onto the tile, with no E prompt: a road leading off the map. */
  auto?: boolean;
  /** What the prompt says, if not "Go inside" / "Go outside". */
  label?: string;
  /**
   * Whether it's in a wall along the tile's -x edge (the cottage's doors, which
   * have their prompt there), opens towards the viewer (the cave mouth, a
   * trapdoor), or is in a wall along the tile's -y edge ('back': the tavern's
   * front door, the doors along the passage upstairs).
   */
  facing?: 'wall' | 'front' | 'back';
  /** Names a door GameScene may keep shut (the tavern's cellar and its rooms, see doorAllowed in scenes/game/travel.ts). */
  id?: string;
  /**
   * Asked before going, e.g. "Do you want to make the trek to Adowvale?".
   * Saying no turns the player back the way they came.
   */
  ask?: string;
  /** In-game hours that pass on the way, as on the long road to Adowvale. */
  travelHours?: number;
}

/**
 * Something to look at closely: the lost ewes in the cave, a signpost, a pile
 * of bones. scenes/game/sights.ts decides what examining it does.
 */
/**
 * How a written thing is shown: 'post' is a signpost, read in a banner as the
 * hero passes; the rest open in the reading window, drawn as a notice board of
 * pinned slips, a book's page, a chalked slate, or a carved stone.
 */
export type ReadingStyle = 'post' | 'notices' | 'book' | 'slate' | 'stone';

export interface Sight {
  id: string;
  gx: number;
  gy: number;
  label: string;
  /** Height of the prompt above the ground, in pixels. */
  z: number;
  /**
   * Something written to read: a signpost (where each arm points, shown in a
   * passing banner), or a notice board, book, slate or carving, which opens
   * close up in its own window to read at leisure (scenes/ReaderScene.ts).
   */
  sign?: { heading: string; lines: string[]; style: ReadingStyle };
  /** Can be searched once for a random find (see systems/Loot.ts). */
  loot?: 'bones' | 'cache';
  /** A door that won't open (yet): trying it rattles the lock, and the hero wonders what's behind it. */
  locked?: boolean;
  /** Something growing that can be picked once (the moonpetal in the cloister garden): the item, and the art it's left as. */
  gather?: {
    item: ItemId;
    picked: string;
    /**
     * A wild herb that grows back (see systems/Herbs.ts): the art it has while
     * grown, how many one picking gives, and what the prompt says. Without it,
     * it's picked once for good (the moonpetal, the willow's bark).
     */
    regrow?: { grown: string; count: number; verb: string };
    /** A flag that must be set before it may be picked (the brothers' herbs, once Brother Anselm has said so), and the thought until then. */
    needs?: { flag: string; thought: string };
  };
  /** Just a thought on looking closely (a carving, a grave). */
  thought?: string;
  /** Somewhere to brew or cook: opens the station window (an id in systems/Crafting.ts STATIONS). */
  station?: string;
  /** Part of putting the Hollow right: a heap of burnt timber to drag out, or the builder's pile (see scenes/game/homestead.ts). */
  work?: 'rubble' | 'pile';
}

/** A warm light source that brightens its surroundings in the dark. */
export interface LightSource {
  gx: number;
  gy: number;
  /** Height above the floor in pixels, so lights on the hearth sit at the flames. */
  z: number;
  radius: number;
  /** 0 = steady, 1 = flickers like fire. */
  flicker: number;
  /** Daylight let in (through the watchtower's open top): it fades as night falls, rather than burning all night. */
  daylight?: boolean;
}

/** A tile of vegetables that can be picked (see systems/Farm.ts). */
export interface CropPatch {
  tx: number;
  ty: number;
  kind: CropKind;
}

/** Somewhere to sit: a bench or stool. The player sits at (gx, gy) facing (faceX, faceY). */
export interface Seat {
  gx: number;
  gy: number;
  faceX: number;
  faceY: number;
  /** Where to stand when getting up. */
  standX: number;
  standY: number;
  name: string;
}

/**
 * Somewhere to sleep. Sleeping passes the time and saves the game, so every
 * bed is a save point: add one to any area to make another.
 */
export interface Bed {
  /** Remembered in the save, so loading knows where the player went to sleep. */
  id: string;
  /** The tile clicking on selects it, and the point its prompt floats over. */
  tx: number;
  ty: number;
  /** Where the player must stand near to use it, and where they wake up. */
  gx: number;
  gy: number;
}

export interface NpcSpawn {
  id: string;
  gx: number;
  gy: number;
  /** A trader who keeps market hours and a daily round (see systems/VillageDay.ts): stall, workshop, tavern, home. */
  commute?: Commute;
  /** For someone who stays put: the grid direction they face when nobody is talking to them. */
  looking?: { x: number; y: number };
  /**
   * Only about between these hours (the tavern's regulars, who come in of an
   * evening): [from, to), where `to` may run past 24 into the small hours.
   */
  hours?: [number, number];
  /**
   * A villager with a daily round (systems/VillageDay.ts), only here while
   * their round has them at this place: the smith in his smithy, the baker in
   * her bakery, the traders at the Crooked Tankard of an evening.
   */
  keeps?: Whereabouts;
  /** Sits where they're put (at a tavern table), though they don't always sit. */
  seated?: boolean;
}

/**
 * How a stallholder gets about the square on their daily round (see
 * systems/VillageDay.ts): between their stall and the doors they go in at.
 */
export interface Commute {
  /** Who they are, for their round. */
  villager: Villager;
  /** Their stall, which is covered over while they're away. */
  stall: MapObject;
  /** Where they step out from behind the counter. */
  exit: { x: number; y: number };
  /** The doors they go in at: home, their workshop (if they have one) and the tavern. */
  doors: Partial<Record<Whereabouts, { x: number; y: number }>>;
}

/** A wild animal that roams near where it starts (see entities/Creature.ts). */
export interface CreatureSpawn {
  /** Remembered once it's beaten, so it stays gone. */
  id: string;
  kind: FoeKind;
  gx: number;
  gy: number;
  /** Game that's back the next time the area is visited, however many times it's hunted (the plains' deer and hares). */
  respawns?: boolean;
  /**
   * How close the hero can come before it attacks, in tiles, if not as its kind usually does (the goblins
   * in their camp on the Greyfells, who keep watch; the raiders only fight when the story says).
   */
  notice?: number;
  /** Asleep where it lies until it notices the hero (`notice` is then how close they can creep). */
  asleep?: boolean;
}

/** A named spot, shown under the area's name when the player is near it (see ui/LocationLabel.ts). */
export interface Landmark {
  gx: number;
  gy: number;
  name: string;
  /** How close the player must be, in tiles. */
  range?: number;
}

/** A stretch of ground where the hero has a thought on stepping into it, e.g. where a road runs on off the map. */
export interface Musing {
  /** Names it, for a quest step that's done by standing there (see scenes/game/raid.ts). */
  id?: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  text: string;
}

/** A fenced run that hens stay inside, in grid units (the open ground within the fence). */
export interface HenPen {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Children who play together and chatter in speech bubbles rather than
 * holding a conversation (see entities/Child.ts). They say hello when the
 * player comes near.
 */
export interface ChildSpawn {
  id: string;
  gx: number;
  gy: number;
}

export interface MapData {
  width: number;
  height: number;
  terrain: Terrain[][]; // [y][x]
  props: Prop[][]; // [y][x]
  spawn: { x: number; y: number };
  objects?: MapObject[];
  /** Back walls of an indoor room: texture keys along y = 0 (back) and x = 0 (side), the corner post, and their height. */
  walls?: { back: string[]; side: string[]; corner?: string; height?: number };
  doors?: Door[];
  /** Named arrival points, in tile units. */
  entries?: Record<string, { x: number; y: number }>;
  lights?: LightSource[];
  npcs?: NpcSpawn[];
  crops?: CropPatch[];
  /** The plot Farmer Iran lends the hero, a tile at a time: dug, sown, watered and picked (see systems/Farm.ts). */
  plot?: Array<{ tx: number; ty: number }>;
  seats?: Seat[];
  /** Spots where the tavern maids tidy up between orders (wiping a table, sweeping the hearth), and which way they face there. */
  chores?: Array<{ x: number; y: number; face: { x: number; y: number } }>;
  beds?: Bed[];
  creatures?: CreatureSpawn[];
  /** Hens pottering about a pen (see entities/Hen.ts). */
  hens?: { pen: HenPen; flock: Array<{ kind: HenKind; gx: number; gy: number }> };
  children?: ChildSpawn[];
  sights?: Sight[];
  /** Where water drips from overhead (stalactite tips): grid position and height in pixels. */
  drips?: Array<{ gx: number; gy: number; z: number }>;
  /**
   * Chimney tops that smoke: grid position and height in pixels. `ruin` marks
   * a burnt building smouldering, which dies down over a couple of days (see world/Aftermath.ts).
   */
  chimneys?: Array<{ gx: number; gy: number; z: number; ruin?: boolean }>;
  /** Where crows come down to pick about, in tiles (the ruined farm, after the raid). */
  crows?: Array<{ gx: number; gy: number }>;
  /** Goats grazing in a paddock (the Hollow's, once it's built: see world/Homestead.ts). */
  goats?: Array<{ gx: number; gy: number }>;
  landmarks?: Landmark[];
  musings?: Musing[];
  /** Multiplies the colour of the ground (the gloom under thick woods); white or not given leaves it as it is. */
  groundShade?: number;
  /**
   * What stands past the map's edge (it's only painted): thick forest if not given. With `crags`, the
   * north, west and east run on into crags (these art keys, all `cragSize` tiles across), and only the
   * south, below `forestFromY`, is forest.
   */
  /** The lie of the land, where there are hills to paint (see HillPainter); the hills block the way where they rise. */
  hills?: HillField;
  /** How much of the grass has flowers, tufts and pebbles on it (0..1; 0.22 if not given). */
  decor?: number;
  /** Tile rectangles (x0, y0 inclusive; x1, y1 exclusive) where the trees are apple trees. */
  orchards?: Array<{ x0: number; y0: number; x1: number; y1: number }>;
  /** Road tiles in order from one end to the other, for travellers to wander along. */
  road?: Array<{ x: number; y: number }>;
  /**
   * Planking laid over water (a pier, a landing stage): tiles that can be walked on though their
   * ground is water. The planks themselves are drawn as flat objects; the water still shows round them.
   */
  decks?: Array<[number, number]>;
  /**
   * A river running through the map: which way it flows (in tiles, along the grid), and how fast,
   * for the current drifting by and whatever floats on it (see world/RiverLife.ts).
   */
  river?: { flow: { x: number; y: number }; speed: number };
  /** Water that can be fished (see systems/Fishing.ts): which water, and roughly where it is. */
  waters?: Array<{ id: WaterId; gx: number; gy: number; r: number }>;
  /**
   * A marsh (Gloomhaven): mist that never lifts, at least this thick (0..1) whatever the weather, on top of
   * whatever the morning brings, and the ground always at least this wet.
   */
  fen?: number;
  /** What grows past the map's edge, if not thick forest: 'fen' is reeds, pools and dead trees. */
  wilds?: 'fen';
  /** Indoors: no minimap, and lit by the fire rather than the sky. */
  indoor?: boolean;
  /** Indoors with no fire burning (the roofless watchtower): no crackle of one. */
  cold?: boolean;
  /** Underground (with `indoor`): dark whatever the hour, so the hero's lantern is lit. */
  underground?: boolean;
  /** The music for the area (see audio/Audio.ts). */
  music?: TrackName;
}

export const TERRAIN_WALKABLE: Record<Terrain, boolean> = {
  [Terrain.Grass]: true,
  [Terrain.Dirt]: true,
  [Terrain.Stone]: true,
  [Terrain.Water]: false,
  [Terrain.Sand]: true,
  [Terrain.Floor]: true,
  [Terrain.Soil]: true,
  [Terrain.Cave]: true,
};

/** Marks every tile an object covers as blocked (or just the ones it lists). */
export function placeObject(data: MapData, obj: MapObject): void {
  (data.objects ??= []).push(obj);
  if (obj.flat) return;
  const tiles: Array<[number, number]> = obj.blocks ?? [];
  if (!obj.blocks) {
    for (let y = 0; y < obj.h; y++) for (let x = 0; x < obj.w; x++) tiles.push([x, y]);
  }
  for (const [x, y] of tiles) {
    const tx = obj.tx + x;
    const ty = obj.ty + y;
    if (ty >= 0 && ty < data.height && tx >= 0 && tx < data.width) data.props[ty][tx] = Prop.Blocked;
  }
}
