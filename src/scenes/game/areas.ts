/**
 * The area registry: every area id, how its map is built, whether ?area= can
 * start a new game there, and what happens on arriving. Adding an area is one
 * entry here (plus its id in MapData.AreaId and its name in SaveGame.AREA_NAMES).
 *
 * Most maps are kept out of the first download: an entry made with `lazy(...)`
 * names the map file to import() and how to build the map from it, and the file
 * comes down the first time the area is needed (GameScene waits for it behind a
 * fade if it hasn't arrived yet; neighbouring areas are fetched ahead). Import a
 * map file only here, through lazy(), or it lands back in the first download;
 * anything the rest of the game needs from a map goes in world/landmarks.ts.
 */
import { MAP_HEIGHT, MAP_SEED, MAP_WIDTH } from '../../config';
import { QuestLog } from '../../systems/Quests';
import { Tavern } from '../../systems/Tavern';
import { graveWorld, raidStage, raidWorld, ruinWorld } from '../../world/GoblinRaid';
import { AreaId, MapData } from '../../world/MapData';
import { generateMap } from '../../world/MapGenerator';
import { buildMarketMap } from '../../world/MarketMap';
import type { GameScene, GameSceneData } from '../GameScene';
import { enteredCave, enteredNorthWoods } from './hollow';
import { enteredGreyfells, greyfellsOpen } from './trail';
import { buryingMother, carryingMother, enteredBroodHall, enteredWarren, outOfWarren, penPrisoner } from './warren';
import { gateAftermath } from '../../world/GateAftermath';
import { enteredMarket } from './market';
import { enteredDen } from './monastery';
import { enteredCellar, enteredTavern } from './tavern';
import { enteredWorkshop } from './workshops';
import { enteredGarrison, enteredJail, enteredResidence } from './garrison';

export interface AreaDef {
  /** Builds the area's map as things stand (gates open or shut, the farm whole or burnt). Needs load() first, if it has one. */
  build: () => MapData;
  /** Fetches the area's map code (see lazy). Areas without one are in the first download. */
  load?: () => Promise<void>;
  /** A new game can start here with ?area=<id>, for testing (and the smoke test opens it). */
  test?: boolean;
  /**
   * Runs each time the hero arrives, once the area is built: first-visit thoughts
   * and diary lines, quest steps. The area isn't marked visited until after it.
   */
  enter?: (g: GameScene) => void;
}

/**
 * An area whose map file is fetched when first needed: `file` imports it, and `build` makes the
 * map from what it exports. The rest (test, enter) is as for any other area.
 */
function lazy<M>(file: () => Promise<M>, build: (map: M) => MapData, rest: Omit<AreaDef, 'build' | 'load'> = {}): AreaDef {
  let loaded: M | undefined;
  let loading: Promise<void> | undefined;
  return {
    ...rest,
    load: () =>
      (loading ??= file().then(
        (m) => {
          loaded = m;
        },
        (e: unknown) => {
          // Let a later try fetch it again (a dropped connection, say).
          loading = undefined;
          throw e;
        },
      )),
    build: () => {
      if (!loaded) throw new Error('Area map built before it was loaded');
      return build(loaded);
    },
  };
}

/** The Hollow outside the cottage: the generated map, overrun on the raid's morning and ruined after it. */
function buildHollow(): MapData {
  const raid = raidStage();
  const world = generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED);
  if (raid === 'morning') raidWorld(world);
  if (raid === 'over') ruinWorld(world);
  if (QuestLog.hasFlag('mother-buried')) graveWorld(world);
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
  home: lazy(() => import('../../world/HomeMap'), (m) => m.buildHomeMap(raidStage() === 'over')),
  world: { build: buildHollow, test: true, enter: buryingMother },
  hut: lazy(() => import('../../world/HutMap'), (m) => m.buildHutMap(raidStage() === 'over', !!QuestLog.get('speckle-and-moppet')?.completed), { test: true, enter: enteredHut }),
  cave: lazy(() => import('../../world/CaveMap'), (m) => m.buildCaveMap(), { test: true, enter: enteredCave }),
  market: { build: () => gateAftermath(buildMarketMap(QuestLog.hasFlag('paid-toll'))), test: true, enter: enteredMarket },
  tavern: lazy(() => import('../../world/TavernMap'), (m) => m.buildTavernMap(), { test: true, enter: enteredTavern }),
  'tavern-hall': lazy(() => import('../../world/TavernMap'), (m) => m.buildTavernHallMap(), { test: true }),
  // No ?area= for a rented room: it needs a room taken first.
  'tavern-room': lazy(() => import('../../world/TavernMap'), (m) => m.buildTavernRoomMap(Tavern.room ?? 1)),
  cellar: lazy(() => import('../../world/TavernMap'), (m) => m.buildCellarMap(), { test: true, enter: enteredCellar }),
  smithy: lazy(() => import('../../world/WorkshopMaps'), (m) => m.buildSmithyMap(), { test: true, enter: enteredWorkshop }),
  bakery: lazy(() => import('../../world/WorkshopMaps'), (m) => m.buildBakeryMap(), { test: true, enter: enteredWorkshop }),
  // On the lane at the south end of Adowvale: the militia's garrison, the cells under it, and the Headman's house.
  garrison: lazy(() => import('../../world/GarrisonMaps'), (m) => m.buildGarrisonMap(), { test: true, enter: enteredGarrison }),
  jail: lazy(() => import('../../world/GarrisonMaps'), (m) => m.buildJailMap(raidStage() === 'over'), { test: true, enter: enteredJail }),
  residence: lazy(() => import('../../world/GarrisonMaps'), (m) => m.buildResidenceMap(), { test: true, enter: enteredResidence }),
  plains: lazy(() => import('../../world/PlainsMap'), (m) => m.buildPlainsMap(), {
    test: true,
    enter: firstVisit(
      'Open sky at last. The grass runs on for miles, and the wind smells of rain.',
      "Went out through Lord Morten's gate onto Adowvale Plains. I have never seen so much sky. Deer grazing in the long " +
        'grass, the road running off to a crossroads, and not a wall in sight.',
    ),
  }),
  // The woods north of the Hollow; after the raid, the goblins' trail through them shows, and in time leads on up onto the Greyfells.
  northwoods: lazy(() => import('../../world/NorthWoodsMap'), (m) => m.buildNorthWoodsMap(raidStage() === 'over', greyfellsOpen()), { test: true, enter: enteredNorthWoods }),
  // Up the goblins' trail out of the north woods: their camp, and the hole in the hill.
  greyfells: lazy(() => import('../../world/GreyfellsMap'), (m) => m.buildGreyfellsMap(), {
    test: true,
    enter: (g) => {
      enteredGreyfells(g);
      outOfWarren(g);
    },
  }),
  warren: lazy(() => import('../../world/WarrenMap'), (m) => m.buildWarrenMap({ prisoner: penPrisoner(), roused: carryingMother() }), { test: true, enter: enteredWarren }),
  broodhall: lazy(() => import('../../world/BroodHallMap'), (m) => m.buildBroodHallMap({ motherDead: QuestLog.hasFlag('mother-dead'), orbTaken: QuestLog.hasFlag('orb-taken') }), { test: true, enter: enteredBroodHall }),
  watchtower: lazy(() => import('../../world/WatchtowerMap'), (m) => m.buildWatchtowerMap(), {
    test: true,
    enter: firstVisit(
      'No roof at all: the walls just stop, and there is the sky. It smells of wet stone and rook.',
      'Climbed over the rubble into the old watchtower in the north woods. The top fell in long ago and the stair is broken, ' +
        'but the last watch left their things behind: a table, rusted spears, a chest, and their logbook, rotted nearly to pulp.',
    ),
  }),
  den: lazy(() => import('../../world/DenMap'), (m) => m.buildDenMap(), { test: true, enter: enteredDen }),
  deepden: lazy(() => import('../../world/DenMap'), (m) => m.buildDeepDenMap(), {
    test: true,
    enter: firstVisit(
      'The crevice opens out into a cold chamber. The air moves here, as if it comes from somewhere further down.',
      "Squeezed through a crevice at the back of the Wolf Mother's den and came out in a cold, empty cave. The passage runs on down " +
        'into the dark. Something about the place makes the hair on my neck stand up. I will come back better prepared.',
    ),
  }),
  monastery: lazy(() => import('../../world/MonasteryMap'), (m) => m.buildMonasteryMap(QuestLog.hasFlag('monastery-open')), {
    test: true,
    enter: firstVisit(
      "Bells, and bees, and somewhere beyond the wall, men singing. This must be Saint Elda's.",
      "Followed the Lord's Road east to Saint Elda's monastery. Grey walls, a great shut gate, and the brothers' gardens and fish " +
        'ponds spread out in front. The moonpetal is somewhere inside. I have to find a way in.',
    ),
  }),
  abbey: lazy(() => import('../../world/AbbeyMap'), (m) => m.buildAbbeyMap(), {
    test: true,
    enter: firstVisit(
      'Inside at last. Flagstones, a well, and the smell of herbs and woodsmoke. It is so quiet in here.',
      "Went in through the gate of Saint Elda's at last. Inside the walls it is like another country: a court with the Saint's well, " +
        'a cloister round a garden, and brothers going quietly about everywhere. Brother Anselm keeps the moonpetal in the garden.',
    ),
  }),
  chapel: lazy(() => import('../../world/AbbeyRooms'), (m) => m.buildChapelMap(), { test: true }),
  infirmary: lazy(() => import('../../world/AbbeyRooms'), (m) => m.buildInfirmaryMap(), { test: true }),
  scriptorium: lazy(() => import('../../world/AbbeyRooms'), (m) => m.buildScriptoriumMap(), { test: true }),
  refectory: lazy(() => import('../../world/AbbeyRooms'), (m) => m.buildRefectoryMap(), { test: true }),
};

function areaDef(area: AreaId): AreaDef {
  return AREAS[area] ?? AREAS.world;
}

/** Areas whose map code is here, ready to build. */
const ready = new Set<AreaDef>();

/** Whether an area's map can be built now (its code is here, or was never split off). */
export function areaReady(area: AreaId): boolean {
  const def = areaDef(area);
  return !def.load || ready.has(def);
}

/** Fetches an area's map code, if it has its own file and it isn't here yet. Rejects if the download fails. */
export function loadArea(area: AreaId): Promise<void> {
  const def = areaDef(area);
  if (!def.load || ready.has(def)) return Promise.resolve();
  return def.load().then(() => {
    ready.add(def);
  });
}

/** Fetches an area's map code ahead of time, in case the hero goes there next (a failure is ignored: it's tried again on arrival). */
export function prefetchArea(area: AreaId): void {
  loadArea(area).catch(() => undefined);
}

/** Builds the map for an area (an id this version doesn't know, from some other save, gets the Hollow). Call loadArea() first. */
export function buildArea(area: AreaId): MapData {
  return areaDef(area).build();
}

/** Whether ?area=<id> can start a new game there. */
export function isTestArea(id: string | null): id is AreaId {
  return id !== null && Object.hasOwn(AREAS, id) && !!AREAS[id as AreaId].test;
}

/** Which area the game scene starts in for this data: a save's, the door's, or ?area= for a new game. */
export function arrivalArea(data: GameSceneData): AreaId {
  // Handy for testing: open the game with ?area=market (or world, or cave...) to start there.
  const areaParam = new URLSearchParams(window.location.search).get('area');
  if (data.newGame && !data.load && isTestArea(areaParam)) return areaParam;
  return data.load?.area ?? data.area ?? 'home';
}
