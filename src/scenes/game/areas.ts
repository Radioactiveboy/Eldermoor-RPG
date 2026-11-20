/**
 * The area registry: every area id, how its map is built, whether ?area= can
 * start a new game there, and what happens on arriving. Adding an area is one
 * entry here (plus its id in MapData.AreaId and its name in SaveGame.AREA_NAMES).
 */
import { MAP_HEIGHT, MAP_SEED, MAP_WIDTH } from '../../config';
import { QuestLog } from '../../systems/Quests';
import { Tavern } from '../../systems/Tavern';
import { buildAbbeyMap } from '../../world/AbbeyMap';
import { buildChapelMap, buildInfirmaryMap, buildRefectoryMap, buildScriptoriumMap } from '../../world/AbbeyRooms';
import { buildCaveMap } from '../../world/CaveMap';
import { buildDeepDenMap, buildDenMap } from '../../world/DenMap';
import { raidStage, raidWorld, ruinWorld } from '../../world/GoblinRaid';
import { buildHomeMap } from '../../world/HomeMap';
import { buildHutMap } from '../../world/HutMap';
import { AreaId, MapData } from '../../world/MapData';
import { generateMap } from '../../world/MapGenerator';
import { buildMarketMap } from '../../world/MarketMap';
import { buildMonasteryMap } from '../../world/MonasteryMap';
import { buildNorthWoodsMap } from '../../world/NorthWoodsMap';
import { buildPlainsMap } from '../../world/PlainsMap';
import { buildCellarMap, buildTavernHallMap, buildTavernMap, buildTavernRoomMap } from '../../world/TavernMap';
import type { GameScene } from '../GameScene';
import { enteredCave, enteredNorthWoods } from './hollow';
import { enteredMarket } from './market';
import { enteredDen } from './monastery';
import { enteredCellar, enteredTavern } from './tavern';

export interface AreaDef {
  /** Builds the area's map as things stand (gates open or shut, the farm whole or burnt). */
  build: () => MapData;
  /** A new game can start here with ?area=<id>, for testing (and the smoke test opens it). */
  test?: boolean;
  /**
   * Runs each time the hero arrives, once the area is built: first-visit thoughts
   * and diary lines, quest steps. The area isn't marked visited until after it.
   */
  enter?: (g: GameScene) => void;
}

/** The Hollow outside the cottage: the generated map, overrun on the raid's morning and ruined after it. */
function buildHollow(): MapData {
  const raid = raidStage();
  const world = generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED);
  if (raid === 'morning') raidWorld(world);
  if (raid === 'over') ruinWorld(world);
  return world;
}

/** The first time the hero arrives: a passing thought a second later, and a line in the diary. */
function firstVisit(thought: string, diary: string): (g: GameScene) => void {
  return (g) => {
    if (g.visited.has(g.area)) return;
    g.time.delayedCall(1000, () => g.onHint?.(thought));
    QuestLog.writeDiary(diary);
  };
}

/** Into Farmer Iran's hut, the first time (after the raid, enteredAfterRaid has its own words). */
function enteredHut(g: GameScene): void {
  if (raidStage() === 'over' || g.visited.has('hut')) return;
  g.time.delayedCall(900, () => g.onHint?.('Warm, smoky, and loud. Iran was not exaggerating about the children.'));
}

export const AREAS: Record<AreaId, AreaDef> = {
  home: { build: () => buildHomeMap(raidStage() === 'over') },
  world: { build: buildHollow, test: true },
  hut: { build: () => buildHutMap(raidStage() === 'over'), test: true, enter: enteredHut },
  cave: { build: () => buildCaveMap(), test: true, enter: enteredCave },
  market: { build: () => buildMarketMap(QuestLog.hasFlag('paid-toll')), test: true, enter: enteredMarket },
  tavern: { build: () => buildTavernMap(), test: true, enter: enteredTavern },
  'tavern-hall': { build: () => buildTavernHallMap(), test: true },
  // No ?area= for a rented room: it needs a room taken first.
  'tavern-room': { build: () => buildTavernRoomMap(Tavern.room ?? 1) },
  cellar: { build: () => buildCellarMap(), test: true, enter: enteredCellar },
  plains: {
    build: () => buildPlainsMap(),
    test: true,
    enter: firstVisit(
      'Open sky at last. The grass runs on for miles, and the wind smells of rain.',
      "Went out through Lord Morten's gate onto Adowvale Plains. I have never seen so much sky. Deer grazing in the long " +
        'grass, the road running off to a crossroads, and not a wall in sight.',
    ),
  },
  // The woods north of the Hollow; after the raid, the goblins' trail through them shows (as scenery, for now).
  northwoods: { build: () => buildNorthWoodsMap(raidStage() === 'over'), test: true, enter: enteredNorthWoods },
  den: { build: () => buildDenMap(), test: true, enter: enteredDen },
  deepden: {
    build: () => buildDeepDenMap(),
    test: true,
    enter: firstVisit(
      'The crevice opens out into a cold chamber. The air moves here, as if it comes from somewhere further down.',
      "Squeezed through a crevice at the back of the Wolf Mother's den and came out in a cold, empty cave. The passage runs on down " +
        'into the dark. Something about the place makes the hair on my neck stand up. I will come back better prepared.',
    ),
  },
  monastery: {
    build: () => buildMonasteryMap(QuestLog.hasFlag('monastery-open')),
    test: true,
    enter: firstVisit(
      "Bells, and bees, and somewhere beyond the wall, men singing. This must be Saint Elda's.",
      "Followed the Lord's Road east to Saint Elda's monastery. Grey walls, a great shut gate, and the brothers' gardens and fish " +
        'ponds spread out in front. The moonpetal is somewhere inside. I have to find a way in.',
    ),
  },
  abbey: {
    build: () => buildAbbeyMap(),
    test: true,
    enter: firstVisit(
      'Inside at last. Flagstones, a well, and the smell of herbs and woodsmoke. It is so quiet in here.',
      "Went in through the gate of Saint Elda's at last. Inside the walls it is like another country: a court with the Saint's well, " +
        'a cloister round a garden, and brothers going quietly about everywhere. Brother Anselm keeps the moonpetal in the garden.',
    ),
  },
  chapel: { build: () => buildChapelMap(), test: true },
  infirmary: { build: () => buildInfirmaryMap(), test: true },
  scriptorium: { build: () => buildScriptoriumMap(), test: true },
  refectory: { build: () => buildRefectoryMap(), test: true },
};

/** Builds the map for an area (an id this version doesn't know, from some other save, gets the Hollow). */
export function buildArea(area: AreaId): MapData {
  return (AREAS[area] ?? AREAS.world).build();
}

/** Whether ?area=<id> can start a new game there. */
export function isTestArea(id: string | null): id is AreaId {
  return id !== null && Object.hasOwn(AREAS, id) && !!AREAS[id as AreaId].test;
}
