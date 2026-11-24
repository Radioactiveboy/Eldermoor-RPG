/**
 * Every area's map, built in Node for tests that check things against the maps themselves
 * (the world map's layout, the quest markers' spots). Import it after mocking Phaser with
 * `phaserMock` below: the maps are laid out with Phaser's seeded dice and curves.
 */
import type { AreaId, MapData } from '../../src/world/MapData';

/** Phaser's maths and geometry, which is all the map builders use; the rest of Phaser needs a browser. */
export async function phaserMock() {
  // (Through a variable, so the type-check, which has no Node types, leaves it alone.)
  const nodeModule = 'node:module';
  const req = (await import(/* @vite-ignore */ nodeModule)).createRequire(import.meta.url);
  return { default: { Math: req('phaser/src/math/index.js'), Geom: req('phaser/src/geom/index.js') } };
}

/**
 * Each area's map as it stands with every gate open (the toll paid, Saint Elda's opened), before the raid,
 * except the north woods, which has the goblins' trail and the way on up to the Greyfells open.
 */
export async function allMaps(): Promise<Record<AreaId, MapData>> {
  const { MAP_HEIGHT, MAP_SEED, MAP_WIDTH } = await import('../../src/config');
  const { generateMap } = await import('../../src/world/MapGenerator');
  const { buildNorthWoodsMap } = await import('../../src/world/NorthWoodsMap');
  const { buildMarketMap } = await import('../../src/world/MarketMap');
  const { buildPlainsMap } = await import('../../src/world/PlainsMap');
  const { buildMonasteryMap } = await import('../../src/world/MonasteryMap');
  const { buildAbbeyMap } = await import('../../src/world/AbbeyMap');
  const rooms = await import('../../src/world/AbbeyRooms');
  const { buildCaveMap } = await import('../../src/world/CaveMap');
  const den = await import('../../src/world/DenMap');
  const { buildHomeMap } = await import('../../src/world/HomeMap');
  const { buildHutMap } = await import('../../src/world/HutMap');
  const tavern = await import('../../src/world/TavernMap');
  const workshops = await import('../../src/world/WorkshopMaps');
  const { buildWatchtowerMap } = await import('../../src/world/WatchtowerMap');
  const { buildGreyfellsMap } = await import('../../src/world/GreyfellsMap');
  const garrison = await import('../../src/world/GarrisonMaps');
  const { buildJettyMap } = await import('../../src/world/JettyMap');
  const { buildWarrenMap } = await import('../../src/world/WarrenMap');
  const { buildBroodHallMap } = await import('../../src/world/BroodHallMap');
  const beacon = await import('../../src/world/BeaconMap');
  return {
    world: generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED),
    // With the goblins' trail and the way on up to the Greyfells open, so every way out is there.
    northwoods: buildNorthWoodsMap(true, true),
    greyfells: buildGreyfellsMap(),
    watchtower: buildWatchtowerMap(),
    beacon: beacon.buildBeaconMap(),
    'beacon-top': beacon.buildBeaconTopMap(),
    market: buildMarketMap(true),
    plains: buildPlainsMap(),
    monastery: buildMonasteryMap(true),
    abbey: buildAbbeyMap(),
    chapel: rooms.buildChapelMap(),
    infirmary: rooms.buildInfirmaryMap(),
    scriptorium: rooms.buildScriptoriumMap(),
    refectory: rooms.buildRefectoryMap(),
    cave: buildCaveMap(),
    den: den.buildDenMap(),
    deepden: den.buildDeepDenMap(),
    home: buildHomeMap(false),
    hut: buildHutMap(false),
    tavern: tavern.buildTavernMap(),
    'tavern-hall': tavern.buildTavernHallMap(),
    'tavern-room': tavern.buildTavernRoomMap(1),
    cellar: tavern.buildCellarMap(),
    smithy: workshops.buildSmithyMap(),
    bakery: workshops.buildBakeryMap(),
    garrison: garrison.buildGarrisonMap(),
    jail: garrison.buildJailMap(true),
    residence: garrison.buildResidenceMap(),
    jetty: buildJettyMap(),
    warren: buildWarrenMap({ prisoner: 'hilde' }),
    broodhall: buildBroodHallMap(),
  };
}
