import Phaser from 'phaser';
import { FEET_Y, FRAME_H, IDLE_FRAME_RATE } from '../art/character';
import { sheetScale } from '../art/fine3d';
import type { DialogueScript, SpeakerId } from '../dialogue/Dialogue';
import { raidAware, raidIsOver, toldOfRaid } from '../dialogue/afterRaid';
import { ashesOver, coombeAtTankardScript, hildeAtTankardScript, IRAN_AFTER_ASHES } from '../dialogue/afterAshes';
import { goblinPrisonerScript, jailerScript, prisonerScript, sergeantScript } from '../dialogue/garrison';
import { HOUSEMAID_CHORES, headmanScript, housecookScript, housemaidScript, stewardScript } from '../dialogue/residence';
import { MedicineStage, MOTHER_ASLEEP, MOTHER_DOZING, MOTHER_INTRO, motherScript } from '../dialogue/mother';
import { BAKER, GUARD, militiaScript, SMITH, TANNER } from '../dialogue/market';
import { droverScript, PEDLAR, PILGRIM, SheepStage } from '../dialogue/travellers';
import { FeedStage, IRAN_HIDING, iranScript } from '../dialogue/iran';
import { CARTER, HERBWIFE, tollGuardScript, tollRoadTalk } from '../dialogue/plains';
import { fishermanScript } from '../dialogue/fisherman';
import { ebbScript, JettyNews, marenScript, wrenScript } from '../dialogue/jetty';
import { openVoyages } from '../systems/Voyages';
import { GARDENER, NOVICE, porterScript, SILENT, WolfStage } from '../dialogue/monastery';
import { anselmScript, cookScript, HerbStage, LEOFRIC, PRIOR, SCRIBE } from '../dialogue/abbey';
import { adaScript, COBB, FENWICK, harlanScript, landlordNews, landlordScript, MAID_CHORES, maidScript, pellScript, RatStage, sigrunScript } from '../dialogue/tavern';
import { watScript } from '../dialogue/companions';
import { coombeScript, hildeCaptiveScript, motherDyingScript } from '../dialogue/warren';
import { corwinScript, garthScript, tegScript, linnetScript } from '../dialogue/beacon';
import { beaconHolders, beaconOutcome, beaconStage, BEACON_QUEST } from '../systems/Beacon';
import { courierScript, footpadScript, goatherdScript, SHAREABLE_FOOD, tinkerScript, Wayfarers } from '../dialogue/wayfarers';
import { ROOM_COUNT, Tavern } from '../systems/Tavern';
import { TOLL } from '../world/MarketMap';
import { depthAt, gridToScreen, Vec2 } from '../iso/IsoMath';
import { marketOpen } from '../systems/MarketHours';
import { inHours, isVillager, Villager, Whereabouts, whereabouts } from '../systems/VillageDay';
import { Inventory, itemDef } from '../systems/Inventory';
import { findPath } from '../systems/Pathfinding';
import { QuestLog } from '../systems/Quests';
import { Bounties } from '../systems/Bounties';
import { Reputation } from '../systems/Reputation';
import type { Body, IsoMap } from '../world/IsoMap';
import { HERO_ROOM, stepAround, underfoot } from '../world/Avoidance';
import type { Commute, MapData, NpcSpawn } from '../world/MapData';

/** How long someone on their way somewhere waits for the hero to step aside before going on regardless. */
const HELD_UP_SECONDS = 1.5;
/** How close (in tiles) the player must be to talk. */
export const TALK_RANGE = 1.7;
/** Travellers stop and turn to the player when they come this close. */
const NOTICE_RANGE = 2.4;
const WALK_SPEED = 1.3;
/** People standing at their posts watch the player go by within this many tiles. */
const WATCH_RANGE = 3.4;

interface NpcDef {
  texture: string;
  /** Idle animation, for people who stay put. Walkers use '<texture>-idle-<dir>' and '-walk-'. */
  anim?: string;
  /** Which conversation to have, given the story so far and the hour of the day. */
  script: (hour: number) => DialogueScript;
  /**
   * A trader's conversation while they're walking about the square on their
   * round: it opens on 'closing' as they pack up and walk home, 'opening' on
   * their way back to the stall, 'to-workshop' heading for the bakery or the
   * smithy, and 'to-tavern' making for the Crooked Tankard.
   */
  offDuty?: DialogueScript;
  /** What they say out loud as they cover the stall to go somewhere (by where they're off to). */
  leaving?: Partial<Record<Whereabouts, string[]>>;
  /** At work in their workshop (the smith at his anvil, the baker at her trough): the '-work-' frames, unless watching the hero. */
  works?: boolean;
  /** Wanders up and down the road, up to this many steps either side of where it started. */
  wander?: number;
  /** Strolls about anywhere within this many tiles of where it started (the militia on their rounds). */
  roam?: number;
  /** Talking distance, if not TALK_RANGE: stallholders are spoken to across their counters. */
  talkRange?: number;
  /** Sits where they are (on a stool, say) rather than standing. */
  sits?: boolean;
  /**
   * Stays about where they were put (or sent), as one of the bodies that bump
   * into each other rather than holding a tile: someone met by chance on the
   * road (see world/PlainsEvents.ts), who may be sent off somewhere with goTo.
   */
  loiters?: boolean;
  /**
   * A tavern maid: goes round the room tidying (the map's chores) between orders, and
   * doesn't hover beside the hero while they sit; she comes over when it's time to ask.
   */
  bustles?: boolean;
  /**
   * One of the market crowd (see scenes/game/marketCrowd.ts): not someone to talk
   * to, just about their business, so they don't stop for the hero either.
   */
  passerby?: boolean;
}

/** What a passer-by would say if spoken to; they never are (see NpcDef.passerby). */
const NOBODY: DialogueScript = { start: 'none', nodes: {} };

/** Travellers met before, who get a shorter hello next time. */
const met = new Set<string>();

/**
 * What the people of the Crooked Tankard need to know about the hero and the
 * clock when they're spoken to (whether the hero is sitting at a table, what
 * time it is), kept up to date by GameScene.
 */
export const NpcWorld = {
  /** The hero is sitting at a tavern table (so the maids take orders). */
  seated: false,
  /** The hero is sitting anywhere (so the maids get on with their work rather than stop and stare). */
  sitting: false,
  /** In-game hours since the start (TimeOfDay.elapsedHours). */
  now: 0,
  /** Hours from now until the clock next reads an hour (TimeOfDay.hoursUntil). */
  hoursUntil: (_hour: number) => 0,
  /** Mother is lying in her bed (see world/MotherRoutine.ts), so she's drowsy when spoken to. */
  motherInBed: false,
};

/** How Godric's job of clearing his cellar of rats stands. */
function ratStage(): RatStage {
  const quest = QuestLog.get('cellar-rats');
  if (!quest) return 'none';
  if (quest.completed) return 'done';
  return quest.done.has('clear') ? 'cleared' : 'active';
}

/** Godric's side of the bar: the room he'd give the hero is chosen now, so he can name it. */
function landlord(hour: number): DialogueScript {
  const first = !met.has('landlord');
  met.add('landlord');
  const now = NpcWorld.now;
  const renting = Tavern.renting(now);
  if (!renting) Tavern.room = 1 + Math.floor(Math.random() * ROOM_COUNT);
  return landlordScript({
    first,
    coins: Inventory.coins,
    room: Tavern.room!,
    renting,
    nightsLeft: Tavern.nightsLeft(now),
    rats: ratStage(),
    late: hour >= 0 && hour < 5,
    freeDrink: QuestLog.hasFlag('tankard-free-drink'),
    news: landlordNews({
      paidToll: QuestLog.hasFlag('paid-toll'),
      slewWolfMother: QuestLog.hasFlag('slew-wolf-mother'),
      foundCaveDoor: QuestLog.hasFlag('found-cave-door'),
      monasteryOpen: QuestLog.hasFlag('monastery-open'),
      footpads: Reputation.last('footpads'),
      goat: Reputation.last('goat'),
      courier: Reputation.last('courier'),
      bounties: Bounties.timesClaimed(),
      raidOver: raidIsOver(),
    }),
    medicine: QuestLog.has('mother-medicine') && !QuestLog.get('mother-medicine')!.completed,
    toldBench: QuestLog.hasFlag('may-use-cellar'),
  });
}

/** A conversation that opens on one of several greetings, picked at random. */
function anyOf(script: DialogueScript, starts: string[]): () => DialogueScript {
  return () => ({ ...script, start: starts[Math.floor(Math.random() * starts.length)] });
}

/** A traveller's conversation: the long greeting the first time, the short one after. */
function traveller(id: string, script: DialogueScript): () => DialogueScript {
  return () => {
    const first = !met.has(id);
    met.add(id);
    return { ...script, start: first ? 'greet' : 'again' };
  };
}

/** How far along the hunt for Wil's ewes is (see the 'lost-sheep' quest). */
function sheepStage(): SheepStage {
  const quest = QuestLog.get('lost-sheep');
  if (!quest) return QuestLog.hasFlag('saw-bess') && QuestLog.hasFlag('saw-bramble') ? 'found-first' : 'none';
  if (quest.completed) return 'done';
  return quest.done.has('find') ? 'found' : 'active';
}

/** How Brother Wystan's errand to kill the Wolf Mother stands (see the 'wolf-mother' quest). */
function wolfStage(): WolfStage {
  const quest = QuestLog.get('wolf-mother');
  if (quest?.completed) return 'done';
  if (QuestLog.hasFlag('slew-wolf-mother')) return 'slain';
  return quest ? 'active' : 'none';
}

/** Where the hero is with the moonpetal, for Brother Anselm. */
function herbStage(): HerbStage {
  if (QuestLog.isDone('mother-medicine', 'moonpetal')) return 'picked';
  return QuestLog.hasFlag('may-pick-moonpetal') ? 'asked' : 'none';
}

/** The first thing in the satchel the hero could hand over to eat, if anything. */
export function foodToShare(): (typeof SHAREABLE_FOOD)[number] | undefined {
  return SHAREABLE_FOOD.find((id) => Inventory.count(id) > 0);
}

/** A chance meeting's conversation: `first` is whether they've met before. */
function wayfarer(id: string, script: (first: boolean) => DialogueScript): () => DialogueScript {
  return () => {
    const first = !met.has(id);
    met.add(id);
    return script(first);
  };
}

/** The militia grumble about their feet by day; after hours, they tell you the market is shut. */
const daytimeGuard = anyOf(GUARD, ['greet', 'tired', 'bored']);
function guardScript(hour: number): DialogueScript {
  // What they've heard of the hero colours it (see systems/Reputation.ts).
  return militiaScript(marketOpen(hour) ? daytimeGuard().start : 'closed', {
    standing: Reputation.level('militia'),
    footpads: Reputation.last('footpads'),
    wolves: Reputation.last('wolves'),
    bounties: Bounties.timesClaimed(),
  });
}

/**
 * Where a trader is in the square on their round: at the stall, covering it
 * over, walking off to a door, indoors somewhere (home, the workshop, the
 * tavern), walking back to the stall, or crossing from one door to another.
 */
type Shift = 'open' | 'packing' | 'leaving' | 'away' | 'arriving' | 'passing';
/** Seconds spent covering the stall before setting off home. */
const PACKING_SECONDS = 2.5;
/** Seconds to fade in or out at the front door. */
const DOOR_FADE_MS = 500;

/** How Mother's errand stands (see the 'mother-medicine' quest). */
function medicineStage(): MedicineStage {
  if (QuestLog.get('mother-medicine')?.completed) return 'well';
  if (Inventory.count('fever-tincture') > 0) return 'tincture';
  if (Inventory.count('moonpetal') > 0 && Inventory.count('willow-bark') > 0) return 'herbs';
  return 'looking';
}

/** Corwin Haske, as things stand with him: built again after each reply that changes them (the price haggled down, say). */
function corwin(): DialogueScript {
  const build = (first: boolean): DialogueScript => ({
    ...corwinScript({
      first,
      errand: QuestLog.has(BEACON_QUEST) && !QuestLog.isDone(BEACON_QUEST, 'brigands'),
      coins: Inventory.coins,
      haggled: QuestLog.hasFlag('beacon-haggled'),
      trusted: ['liked', 'honoured'].includes(Reputation.level('adowvale')),
      toldOfAldo: QuestLog.hasFlag('beacon-told-aldo'),
      keepers: beaconHolders() === 'keepers',
    }),
    refresh: () => build(first),
  });
  const first = !met.has('corwin');
  met.add('corwin');
  return build(first);
}

/** How Farmer Iran's errand for chicken feed stands (see the 'chicken-feed' quest). */
function feedStage(): FeedStage {
  const quest = QuestLog.get('chicken-feed');
  if (!quest) return 'none';
  if (quest.completed) return 'done';
  return Inventory.count('chicken-feed') > 0 ? 'carrying' : 'active';
}

const NPCS: Record<string, NpcDef> = {
  // Modelled in 3D (art/mother3d.ts): she goes about her day round the cottage (see world/MotherRoutine.ts).
  mother: {
    texture: 'folk-mother',
    loiters: true,
    script: () => {
      if (!QuestLog.has('mother-medicine')) return MOTHER_INTRO;
      const stage = medicineStage();
      // Woken in her bed, she's drowsy, unless the hero has brought her tincture.
      if (NpcWorld.motherInBed && stage === 'well') return MOTHER_ASLEEP;
      return NpcWorld.motherInBed && stage !== 'tincture' ? MOTHER_DOZING : motherScript(stage);
    },
  },
  pedlar: { texture: 'folk-pedlar', script: traveller('pedlar', PEDLAR), wander: 7 },
  pilgrim: { texture: 'folk-pilgrim', script: traveller('pilgrim', PILGRIM), wander: 5 },
  drover: {
    texture: 'folk-drover',
    script: () => {
      const first = !met.has('drover');
      met.add('drover');
      return droverScript(sheepStage(), first);
    },
    wander: 9,
  },
  // Farmer Iran, keeping an eye on his hens.
  iran: {
    texture: 'folk-iran',
    script: () => {
      const first = !met.has('iran');
      met.add('iran');
      return iranScript(feedStage(), first, QuestLog.hasFlag('plot-lent'));
    },
  },
  // After the raid: Iran crouched in the corner of his hut with his children, too frightened to go out.
  'iran-hiding': { texture: 'folk-iran', sits: true, script: () => (ashesOver() && QuestLog.isDone('the-raid', 'iran') ? IRAN_AFTER_ASHES : IRAN_HIDING) },
  // Old Tobin, on his stool on the far shore of the lake, watching his float.
  fisherman: {
    texture: 'folk-fisherman',
    sits: true,
    script: () => {
      const first = !met.has('fisherman');
      met.add('fisherman');
      return fishermanScript(first, QuestLog.hasFlag('found-cave-door'), {
        hasRod: Inventory.count('fishing-rod') > 0,
        coins: Inventory.coins,
        hasBoot: Inventory.count('old-boot') > 0 && !QuestLog.hasFlag('tobin-boot'),
      });
    },
  },
  // The market's stallholders stand behind their counters, while the market is open.
  // In the square they keep their round (systems/VillageDay.ts); in the bakery, the smithy and the tavern they're there by it too.
  baker: {
    texture: 'folk-baker', script: traveller('baker', BAKER), offDuty: BAKER, talkRange: 2.6, works: true,
    leaving: { workshop: ['Back in a bit, loves! The noon loaves want me.', 'Ovens, ovens. Come and find me in the bakery!'] },
  },
  smith: {
    texture: 'folk-smith', script: traveller('smith', SMITH), offDuty: SMITH, talkRange: 2.6, works: true,
    leaving: { workshop: ["Hm. Anvil's waiting. I'll be in the smithy.", 'Forge. Knock if you want me.'] },
  },
  tanner: { texture: 'folk-tanner', script: traveller('tanner', TANNER), offDuty: TANNER, talkRange: 2.6 },
  // Lord Morten's men at the toll gate, who stand their ground.
  'tollguard-1': { texture: 'folk-tollguard', script: () => tollGuardScript(QuestLog.hasFlag('paid-toll'), Inventory.coins >= TOLL, TOLL, false, tollRoadTalk(Reputation.last('footpads'), Reputation.last('courier'))) },
  'tollguard-2': { texture: 'folk-tollguard', script: () => tollGuardScript(QuestLog.hasFlag('paid-toll'), Inventory.coins >= TOLL, TOLL, true) },
  // Travellers on the Lord's Road across the plains.
  carter: { texture: 'folk-carter', script: traveller('carter', CARTER), wander: 14 },
  herbwife: { texture: 'folk-herbwife', script: traveller('herbwife', HERBWIFE), wander: 10 },
  // The brothers outside Saint Elda's: the porter stays by his gate, the others potter about the grounds.
  porter: {
    texture: 'folk-porter',
    script: () => {
      const first = !met.has('porter');
      met.add('porter');
      return porterScript(wolfStage(), first, QuestLog.hasFlag('cleared-cave'), Inventory.count('white-hide') > 0, ['liked', 'honoured'].includes(Reputation.level('monastery')));
    },
  },
  gardener: { texture: 'folk-gardener', script: traveller('gardener', GARDENER), roam: 4 },
  silent: { texture: 'folk-silent', script: traveller('silent', SILENT), roam: 6 },
  novice: { texture: 'folk-novice', script: traveller('novice', NOVICE), wander: 12 },
  // Within the walls: the Prior at his prayers, Anselm among his herbs, and the brothers at their work.
  prior: { texture: 'folk-prior', script: traveller('prior', PRIOR) },
  anselm: {
    texture: 'folk-anselm',
    roam: 3,
    script: () => {
      const first = !met.has('anselm');
      met.add('anselm');
      return anselmScript(herbStage(), first);
    },
  },
  leofric: { texture: 'folk-leofric', sits: true, script: traveller('leofric', LEOFRIC) },
  scribe: { texture: 'folk-scribe', sits: true, script: traveller('scribe', SCRIBE) },
  cook: { texture: 'folk-cook', roam: 2, script: () => cookScript(QuestLog.hasFlag('fed-by-hob')) },
  // The Crooked Tankard: Godric behind his bar, his maids going round the tables, and the regulars.
  // (Godric is spoken to across the bar, from in front of the stools.)
  landlord: { texture: 'folk-landlord', script: landlord, talkRange: 3.2 },
  nell: { texture: 'folk-nell', roam: 3, bustles: true, script: () => maidScript('nell', NpcWorld.seated, Inventory.coins) },
  rosie: { texture: 'folk-rosie', roam: 3, bustles: true, script: () => maidScript('rosie', NpcWorld.seated, Inventory.coins) },
  harlan: {
    texture: 'folk-harlan',
    sits: true,
    script: () => {
      const first = !met.has('harlan');
      met.add('harlan');
      return harlanScript(first, Inventory.coins, QuestLog.hasFlag('harlan-secret'), QuestLog.hasFlag('found-cave-door'));
    },
  },
  fenwick: { texture: 'folk-fenwick', sits: true, script: traveller('fenwick', FENWICK) },
  sigrun: { texture: 'folk-sigrun', sits: true, script: () => sigrunScript(QuestLog.hasFlag('slew-wolf-mother')) },
  ada: { texture: 'folk-ada', sits: true, script: () => adaScript(Inventory.coins) },
  cobb: { texture: 'folk-cobb', sits: true, script: () => COBB },
  pell: { texture: 'folk-pell', script: () => pellScript(Inventory.coins) },
  // Met by chance out on Adowvale Plains (see world/PlainsEvents.ts).
  footpad: {
    texture: 'folk-footpad',
    loiters: true,
    script: wayfarer('footpad', (first) => {
      Wayfarers.toll = Math.ceil(Inventory.coins / 2);
      return footpadScript(Wayfarers.toll, QuestLog.hasFlag('slew-wolf-mother'), !first, Reputation.last('footpads'));
    }),
  },
  cutpurse: { texture: 'folk-cutpurse', loiters: true, script: () => ({ start: 'nab', nodes: { nab: { speaker: 'cutpurse', lines: ["Don't look at me. Talk to Rook."] } } }) },
  tinker: { texture: 'folk-tinker', loiters: true, script: wayfarer('tinker', tinkerScript) },
  goatherd: { texture: 'folk-goatherd', loiters: true, script: wayfarer('goatherd', (first) => goatherdScript(Wayfarers.goat, first)) },
  courier: {
    texture: 'folk-courier',
    loiters: true,
    script: wayfarer('courier', (first) => {
      const food = foodToShare();
      return courierScript(Wayfarers.courierFed, food && itemDef(food).name.toLowerCase(), first);
    }),
  },
  // Wat, the militia lad on the east watch after the raid, who will come along if asked (see systems/Companions.ts).
  wat: { texture: 'folk-wat', roam: 2, script: wayfarer('wat', watScript) },
  // Adowvale folk about the market by day, overheard rather than spoken to (scenes/game/marketCrowd.ts).
  'crowd-goodwife': { texture: 'folk-crowd-goodwife', passerby: true, roam: 6, script: () => NOBODY },
  'crowd-labourer': { texture: 'folk-crowd-labourer', passerby: true, roam: 7, script: () => NOBODY },
  'crowd-youth': { texture: 'folk-crowd-youth', passerby: true, roam: 7, script: () => NOBODY },
  'crowd-boy': { texture: 'folk-crowd-boy', passerby: true, roam: 6, script: () => NOBODY },
  'crowd-girl': { texture: 'folk-crowd-girl', passerby: true, roam: 5, script: () => NOBODY },
  'crowd-matron': { texture: 'folk-crowd-matron', passerby: true, script: () => NOBODY },
  'crowd-elder': { texture: 'folk-crowd-elder', passerby: true, script: () => NOBODY },
  // The village militia, walking their rounds of the square, day and night; the fifth keeps the garrison door.
  // Each is his own man (art/militia3d.ts): a spearman, an archer, the new recruit and a swordsman on the square, the old veteran on the door.
  'guard-1': { texture: 'folk-militia-spear', script: guardScript, roam: 5 },
  'guard-2': { texture: 'folk-militia-archer', script: guardScript, roam: 5 },
  'guard-3': { texture: 'folk-militia-recruit', script: guardScript, roam: 5 },
  'guard-4': { texture: 'folk-militia-sword', script: guardScript, roam: 5 },
  'guard-5': { texture: 'folk-militia-veteran', script: guardScript },
  // The garrison: Sergeant Brannock at his table, Hamm on the cells below, and Dickon the poacher in one of them.
  sergeant: {
    texture: 'folk-sergeant',
    talkRange: 2.4,
    script: () => {
      const first = !met.has('sergeant');
      met.add('sergeant');
      return sergeantScript({
        first,
        raidOver: raidIsOver(),
        toldRaid: ashesOver() || onceAfterRaid('sergeant'),
        standing: Reputation.level('militia'),
        bounties: Bounties.timesClaimed(),
        slewWolfMother: QuestLog.hasFlag('slew-wolf-mother'),
        trailNews: QuestLog.isDone('the-raid', 'edge') && !QuestLog.isDone('the-raid', 'sergeant'),
        goblinTalked: QuestLog.isDone('the-raid', 'prisoner'),
      });
    },
  },
  jailer: { texture: 'folk-jailer', script: wayfarer('jailer', (first) => jailerScript(raidIsOver(), first)) },
  prisoner: { texture: 'folk-prisoner', sits: true, talkRange: 3, script: wayfarer('prisoner', (first) => prisonerScript(raidIsOver(), first)) },
  // Snikkit, the goblin the militia caught after the raid, in the cell at the foot of the steps (only there once the raid is over).
  snikkit: {
    texture: 'folk-snikkit',
    talkRange: 3,
    script: wayfarer('snikkit', (first) => {
      const food = foodToShare();
      return goblinPrisonerScript({ first, talked: QuestLog.isDone('the-raid', 'prisoner'), food: food && itemDef(food).name.toLowerCase() });
    }),
  },
  // In the goblins' pen in the warren under the Greyfells (world/WarrenMap.ts): Hilde, if they took her from Adowvale, or else Coombe the shepherd, sat on the floor.
  'hilde-captive': { texture: 'folk-baker', talkRange: 2.4, script: hildeCaptiveScript },
  coombe: { texture: 'folk-coombe', sits: true, talkRange: 2.4, script: coombeScript },
  // Once Ashes is over, whoever the hero let out of the pen is staying at the Crooked Tankard (world/TavernMap.ts, freedAtTankard).
  'hilde-tankard': { texture: 'folk-baker', sits: true, talkRange: 2.6, script: wayfarer('hilde-tankard', hildeAtTankardScript) },
  'coombe-tankard': {
    texture: 'folk-coombe',
    sits: true,
    talkRange: 2.4,
    script: wayfarer('coombe-tankard', (first) => coombeAtTankardScript(first, QuestLog.hasFlag('coombe-thanked'))),
  },
  // Mother at the bottom of the warren (world/BroodHallMap.ts), drawn lying on her furs (so tucked out of sight, see scenes/game/warren.ts).
  'mother-dying': { texture: 'folk-mother', talkRange: 2.2, script: motherDyingScript },
  // The brood hall's shaman, crouched before the orb: nobody to talk to.
  shaman: { texture: 'folk-shaman', passerby: true, script: () => NOBODY },
  // The Headman's house: the Headman at his desk (spoken to across it), and his household.
  headman: {
    texture: 'folk-headman',
    sits: true,
    talkRange: 2.6,
    script: () => {
      const first = !met.has('headman');
      met.add('headman');
      const medicine = QuestLog.get('mother-medicine');
      return headmanScript({
        first,
        raidOver: raidIsOver(),
        toldRaid: ashesOver() || onceAfterRaid('headman'),
        medicine: !!medicine && !medicine.completed,
        paidToll: QuestLog.hasFlag('paid-toll'),
        slewWolfMother: QuestLog.hasFlag('slew-wolf-mother'),
        goblinTalked: QuestLog.isDone('the-raid', 'prisoner'),
        paysSigrun: QuestLog.hasFlag('headman-pays-sigrun'),
        beacon: beaconStage(),
        beaconOutcome: beaconOutcome(),
      });
    },
  },
  // The brigands holding the old beacon on Corbie Tor (world/BeaconMap.ts), or keeping it for the Headman, once Corwin has been talked round.
  corwin: { texture: 'folk-corwin', loiters: true, talkRange: 2.4, script: corwin },
  garth: { texture: 'folk-garth', loiters: true, script: () => garthScript(beaconHolders() === 'keepers') },
  teg: { texture: 'folk-teg', loiters: true, script: () => tegScript(beaconHolders() === 'keepers') },
  linnet: { texture: 'folk-linnet', loiters: true, talkRange: 2.4, script: () => linnetScript(beaconHolders() === 'keepers') },
  steward: { texture: 'folk-steward', script: (hour) => wayfarer('steward', (first) => stewardScript(raidIsOver(), first, Npc.within([7, 22], hour)))() },
  housemaid: { texture: 'folk-housemaid', roam: 3, bustles: true, script: () => housemaidScript(raidIsOver()) },
  housecook: { texture: 'folk-housecook', roam: 2, script: () => housecookScript(raidIsOver()) },
  // Down at Adowvale Jetty (world/JettyMap.ts): Maren on the pier by her boat, Old Ebb at his nets, and Wren about the smokehouse.
  maren: {
    texture: 'folk-maren', talkRange: 2.2,
    script: () => {
      const first = !met.has('maren');
      met.add('maren');
      return marenScript(first, jettyNews('maren'), openVoyages(), Inventory.coins);
    },
  },
  ebb: {
    texture: 'folk-ebb', sits: true,
    script: () => {
      const first = !met.has('ebb');
      met.add('ebb');
      return ebbScript(first, jettyNews('ebb'), Inventory.count('fishing-rod') > 0);
    },
  },
  wren: {
    texture: 'folk-wren', roam: 2, talkRange: 2.4,
    script: () => {
      const first = !met.has('wren');
      met.add('wren');
      return wrenScript(first, jettyNews('wren'));
    },
  },
};

/** What the jetty folk have heard: the raid (said once, the first time after it), and whether Mother is dead. */
function jettyNews(id: SpeakerId): JettyNews {
  return { raided: onceAfterRaid(id) === false && raidIsOver(), bereaved: QuestLog.hasFlag('mother-dead') };
}

/**
 * Whether someone has already said their piece about the raid (and if not,
 * marks that they now have, since they're about to). False before the raid.
 */
function onceAfterRaid(id: SpeakerId): boolean {
  if (!raidIsOver()) return false;
  const flag = toldOfRaid(id);
  const told = QuestLog.hasFlag(flag);
  QuestLog.setFlag(flag);
  return told;
}

/**
 * Someone in the world who can be talked to. People who stay put (Mother, the
 * stallholders) block the tile they stand on; travellers stroll along the
 * road and the militia about the square, stopping to look about, and are
 * bumped into like any solid thing (see IsoMap.bodies). Stallholders keep
 * market hours: in the evening they cover their stalls and walk home, and in
 * the morning they walk back and open up again.
 */
export class Npc implements Body {
  readonly id: string;
  gx: number;
  gy: number;
  readonly radius = 0.28;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly def: NpcDef;
  private readonly map: IsoMap;
  /** Facing as one of 8 screen directions: 0 = south, 2 = east, 4 = north, 6 = west. */
  private facing = 0;
  // Wandering along the road.
  private readonly road: Vec2[] = [];
  private roadIndex = 0;
  private home = 0;
  /** Which side of the road they keep to: a nudge across it, in tiles. */
  private lane = 0;
  /** Points to walk through, with the road index each one is at (-1 off the road). */
  private route: Array<{ point: Vec2; index: number }> = [];
  private wait = 0;
  /** Seconds spent waiting for the hero to get out of the way, on a walk they must finish. */
  private heldUp = 0;
  /** Where a roaming NPC started, which it never strays far from. */
  private readonly origin: Vec2;
  /** A trader's walk between their stall and their front door, and where they are in their day. */
  private readonly commute?: Commute;
  private shift: Shift = 'open';
  /** Where a trader is off to (or has gone in to) while away from the stall. */
  private bound: Whereabouts = 'home';
  /** Only here while their round has them here (see NpcSpawn.keeps). */
  private readonly keeps?: Whereabouts;
  /** The hour of the day, as of the last update. */
  private hour: number;
  /** Something said out loud, shown in a bubble over their head (see ui/SpeechBubbles.ts). */
  speech?: string;
  private speechLeft = 0;

  /** For someone who stays put: the way they look when nobody is talking to them (the fisherman, at his float). */
  private readonly looking?: Vec2;
  /** The way someone who stays put faces when they're not looking at anything in particular. */
  private restFacing = 0;
  /** Seconds until they next glance aside, and how long the glance they're in has left. */
  private glanceIn = 3 + Math.random() * 6;
  private glanceLeft = 0;
  /** How quickly they breathe, a little different for everyone so a crowd doesn't breathe as one. */
  private readonly breath = 0.8 + Math.random() * 0.4;
  /** Only about between these hours (see NpcSpawn.hours). */
  private readonly hours?: [number, number];
  /** Out for now, outside their hours. */
  private off = false;
  /** Somewhere they've been sent (a maid fetching an order): walked to whatever's in the way, then `then` runs. */
  private errand?: { route: Vec2[]; then?: () => void };
  /** For a maid, the spot she's on her way to tidy (see MapData.chores). */
  private chore?: { x: number; y: number; face: Vec2 };
  /** Sat down for now (Mother at the table), whether or not they always sit. */
  sitting = false;
  /**
   * Moved about by a script (the militia fighting at the gate, see world/GateSkirmish.ts) rather than
   * going about by themselves: they stay where they're put, and aren't to be talked to, until let go.
   */
  scripted = false;
  /** Screen-pixel nudge for the sprite, for a lunge or a flinch while scripted. */
  readonly offset = { x: 0, y: 0 };
  /**
   * Out of sight but still there to talk to (Mother lying in her bed, which is
   * drawn with her in it): `prompt` is where the talk prompt goes instead.
   */
  private tucked?: { prompt: { x: number; y: number } };

  /**
   * @param commute for a trader, their walk home (see MapData.Commute)
   * @param hour the hour of the day now, so a trader who has gone home isn't there to begin with
   * @param looking for someone who stays put, the grid direction they face when left alone
   * @param hours the hours they're about, if not all day (the tavern's regulars)
   * @param spawn the rest of how the map placed them: kept here by their round, sat down
   */
  constructor(
    scene: Phaser.Scene, map: IsoMap, id: string, gx: number, gy: number, commute?: Commute, hour = 12, looking?: Vec2, hours?: [number, number],
    spawn: Pick<NpcSpawn, 'keeps' | 'seated'> = {},
  ) {
    const def = NPCS[id];
    if (!def) throw new Error(`Unknown NPC: ${id}`);
    this.id = id;
    this.def = def;
    this.map = map;
    this.gx = gx;
    this.gy = gy;
    this.origin = { x: gx, y: gy };
    this.commute = commute;
    this.hour = hour;
    this.looking = looking;
    this.hours = hours;
    this.keeps = isVillager(id) ? spawn.keeps : undefined;
    this.sitting = !!spawn.seated;
    if (looking) this.face(looking);
    this.restFacing = this.facing;
    this.shadow = scene.add.image(0, 0, 'shadow');
    // Some are drawn finer than they stand, like the hero (see art/fine3d.ts).
    this.sprite = scene.add.sprite(0, 0, def.texture, 0).setOrigin(0.5, (FEET_Y + 0.5) / FRAME_H).setScale(1 / sheetScale(scene, def.texture));
    if (def.wander && map.data.road?.length) {
      this.road = map.data.road;
      this.roadIndex = this.home = this.nearestRoadIndex(gx, gy);
      this.lane = (Math.random() - 0.5) * 0.6;
      this.facing = Math.floor(Math.random() * 8);
      this.wait = 1 + Math.random() * 3;
      map.bodies.add(this);
    } else if (def.roam || def.loiters) {
      this.facing = Math.floor(Math.random() * 8);
      this.wait = 1 + Math.random() * 4;
      map.bodies.add(this);
    } else {
      map.setOccupied(Math.floor(gx), Math.floor(gy), true);
    }
    if (def.anim) this.sprite.play({ key: def.anim, startFrame: Math.floor(Math.random() * 4) });
    const now = commute && whereabouts(commute.villager, hour);
    if (now && now !== 'stall') {
      // Already gone in somewhere: home for the night, the workshop, the tavern.
      this.shift = 'away';
      this.bound = now;
      this.setVisible(false);
      map.setObjectArt(commute.stall, `${commute.stall.key}-closed`);
    }
    if (!this.about(hour)) this.goOff(true);
    this.sync(false);
  }

  /** Whether an hour falls in [from, to), where `to` may run past midnight (e.g. [18, 26] is 6pm to 2am). */
  static within(hours: [number, number], hour: number): boolean {
    return inHours(hours[0], hours[1], hour);
  }

  /** Whether they're about here at this hour: within their hours, and where their round has them. */
  private about(hour: number): boolean {
    if (this.hours && !Npc.within(this.hours, hour)) return false;
    if (this.keeps && whereabouts(this.id as Villager, hour) !== this.keeps) return false;
    return true;
  }

  /** Here to be seen and talked to (not indoors for the night, nor gone home from the tavern). */
  get present(): boolean {
    return this.shift !== 'away' && !this.off;
  }

  /** Someone to talk to, rather than one of the market crowd going about their business. */
  get talks(): boolean {
    return !this.def.passerby && !this.scripted;
  }

  /** Not walking anywhere they've been sent. */
  get idle(): boolean {
    return !this.errand;
  }

  /**
   * Send them somewhere (round the furniture), then do something on arrival.
   * They keep walking whoever's in the way; nobody stops a maid with a tray.
   */
  goTo(target: Vec2, then?: () => void): void {
    const from = { x: Math.floor(this.gx), y: Math.floor(this.gy) };
    const to = { x: Math.floor(target.x), y: Math.floor(target.y) };
    const tiles = findPath(from, to, this.map.width, this.map.height, (x, y) => this.map.walkableAroundHero(x, y), 3000) ?? [];
    const route = tiles.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
    if (route.length > 0) route.pop();
    route.push(target);
    this.route = [];
    this.chore = undefined;
    this.errand = { route, then };
  }

  /** Leave (or arrive), fading out at the end of their hours: no longer in the way, nor to be talked to. */
  private goOff(off: boolean, fade = false): void {
    this.off = off;
    this.errand = undefined;
    this.route = [];
    if (this.moves) {
      if (off) this.map.bodies.delete(this);
      else this.map.bodies.add(this);
    } else {
      this.map.setOccupied(Math.floor(this.gx), Math.floor(this.gy), !off);
    }
    if (off) this.speech = undefined;
    this.setVisible(!off, fade);
  }

  /** Gone for good: off the map, out of everyone's way. */
  destroy(): void {
    this.map.bodies.delete(this);
    if (!this.moves) this.map.setOccupied(Math.floor(this.gx), Math.floor(this.gy), false);
    this.sprite.scene.tweens.killTweensOf([this.sprite, this.shadow]);
    this.sprite.destroy();
    this.shadow.destroy();
  }

  /** Walk off somewhere, then fade away and be gone (see {@link destroy}); `then` runs once they've gone. */
  leave(to: Vec2, then?: () => void): void {
    this.goTo(to, () => {
      this.off = true;
      this.map.bodies.delete(this);
      this.speech = undefined;
      this.setVisible(false, true);
      this.sprite.scene.time.delayedCall(DOOR_FADE_MS + 50, () => {
        this.destroy();
        then?.();
      });
    });
  }

  /** Stand somewhere at once (no walking), e.g. getting up out of bed. */
  placeAt(gx: number, gy: number): void {
    this.errand = undefined;
    this.route = [];
    this.gx = gx;
    this.gy = gy;
    this.sync(false);
  }

  /** For a script moving them itself: stand (or be mid-stride) at a spot, facing a point. */
  pose(gx: number, gy: number, faceAt: Vec2, moving: boolean): void {
    this.gx = gx;
    this.gy = gy;
    this.face({ x: faceAt.x - gx, y: faceAt.y - gy });
    this.sync(moving);
  }

  /** Face a grid direction and stay so (sat at the table, looking at it). */
  turnTo(dir: Vec2): void {
    this.face(dir);
    this.sync(false);
  }

  /**
   * Hide them while they're drawn as part of something else (Mother in her
   * bed), but keep them there to be spoken to, with the prompt at `prompt`
   * (a world pixel); or, with no prompt, bring them back into view.
   */
  tuck(prompt?: { x: number; y: number }): void {
    this.tucked = prompt && { prompt };
    this.speech = prompt ? undefined : this.speech;
    this.setVisible(!prompt);
  }

  get isTucked(): boolean {
    return !!this.tucked;
  }

  /** Say something out loud, in a bubble over their head, for a few seconds. */
  say(text: string, seconds = 5): void {
    this.speech = text;
    this.speechLeft = seconds;
  }

  get tileX(): number {
    return Math.floor(this.gx);
  }

  get tileY(): number {
    return Math.floor(this.gy);
  }

  /** The top of their head, where a speech bubble's tail points. */
  get speechPoint(): { x: number; y: number } {
    if (this.tucked) return { x: this.tucked.prompt.x, y: this.tucked.prompt.y + 10 };
    return { x: this.sprite.x, y: this.sprite.y - FEET_Y + 7 + (this.seated ? 8 : 0) };
  }

  /** World position just above their head, for the talk prompt. */
  get promptPoint(): { x: number; y: number } {
    if (this.tucked) return this.tucked.prompt;
    return { x: this.sprite.x, y: this.sprite.y - FEET_Y - 6 + (this.seated ? 8 : 0) };
  }

  /**
   * At their trade in their own workshop (Osric at the anvil, Hilde kneading),
   * rather than watching the hero, who has come close.
   */
  private get atWork(): boolean {
    return !!this.def.works && this.keeps === 'workshop' && !this.watching;
  }

  /** Turned to look at the hero (standAbout), which stops work for a moment. */
  private watching = false;

  /** Sitting down, always or for now. */
  private get seated(): boolean {
    return !!this.def.sits || this.sitting;
  }

  /** What they have to say, as it stands after the goblins' raid, if that's been (see dialogue/afterRaid.ts). */
  script(): DialogueScript {
    return raidAware(this.id, this.ordinaryScript());
  }

  private ordinaryScript(): DialogueScript {
    if (this.shift !== 'open' && this.def.offDuty) {
      const start = this.shift === 'arriving' ? 'opening' : this.bound === 'home' ? 'closing' : `to-${this.bound}`;
      return { ...this.def.offDuty, start: this.def.offDuty.nodes[start] ? start : 'closing' };
    }
    // A trader at the Tankard for the evening doesn't trade; one at work in their workshop says so.
    if (this.keeps === 'tavern' && this.def.offDuty?.nodes.tavern) return { ...this.def.offDuty, start: 'tavern' };
    const script = this.def.script(this.hour);
    if (this.keeps === 'workshop' && script.start === 'again' && script.nodes.workshop) return { ...script, start: 'workshop' };
    return script;
  }

  /** Stallholders are spoken to across their counters; out from behind them, up close like anyone else. */
  get talkRange(): number {
    return (this.shift === 'open' || this.shift === 'packing') && this.def.talkRange ? this.def.talkRange : TALK_RANGE;
  }

  /** Walks about (along the road, round the square, or home from the market) rather than standing in one place. */
  private get moves(): boolean {
    return this.road.length > 0 || !!this.def.roam || !!this.def.loiters || this.commuting;
  }

  private get commuting(): boolean {
    return this.shift === 'leaving' || this.shift === 'arriving' || this.shift === 'passing';
  }

  /** Turn to face a point (Mother is only drawn facing forward, so she just mirrors). */
  faceTowards(gx: number, gy: number): void {
    if (this.tucked) return;
    if (this.def.anim) {
      const screenDx = gridToScreen(gx - this.gx, gy - this.gy).x;
      if (Math.abs(screenDx) > 4) this.sprite.setFlipX(screenDx < 0);
      return;
    }
    this.face({ x: gx - this.gx, y: gy - this.gy });
    this.sync(false);
  }

  distanceTo(gx: number, gy: number): number {
    return Math.hypot(gx - this.gx, gy - this.gy);
  }

  /**
   * Stroll along the road (or about the square): walk a few steps, stop and
   * look about, repeat. Stops to face the player when they come near, so
   * they're easy to talk to.
   */
  update(dt: number, player: Vec2, paused: boolean, hour: number): void {
    this.hour = hour;
    if (this.speech && !paused) {
      this.speechLeft -= dt;
      if (this.speechLeft <= 0) this.speech = undefined;
    }
    if (this.scripted) return;
    if (this.commute) {
      this.keepHours(dt, paused, player);
      return;
    }
    if ((this.hours || this.keeps) && !paused && this.about(hour) === this.off && !this.errand) {
      this.goOff(!this.off, true);
    }
    if (this.off) return;
    if (this.errand) {
      if (paused) {
        this.sync(false);
        return;
      }
      if (this.walkRoute(dt, this.errand.route)) return;
      const then = this.errand.then;
      this.errand = undefined;
      this.wait = 4 + Math.random() * 4;
      this.sync(false);
      then?.();
      return;
    }
    if (!this.moves) {
      if (!paused) this.standAbout(dt, player);
      return;
    }
    // In bed, or sat at the table: staying as they are.
    if (this.tucked || this.sitting) return;
    // (A maid at work doesn't stop to stare at someone sitting down.)
    // (Nor does a passer-by, who has their own business to be about.)
    const noticed = this.distanceTo(player.x, player.y) < NOTICE_RANGE && !(this.def.bustles && NpcWorld.sitting) && !this.def.passerby;
    if (paused || noticed) {
      if (noticed) this.face({ x: player.x - this.gx, y: player.y - this.gy });
      this.sync(false);
      return;
    }
    if (this.route.length === 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.decide();
      this.sync(false);
      return;
    }
    // Making for where the hero is standing: that spot will do from here, on to the next.
    this.skipUnderfoot(this.route, (r) => r.point);
    if (this.route.length === 0) {
      this.wait = 0.8 + Math.random();
      this.sync(false);
      return;
    }
    const next = this.route[0].point;
    const dx = next.x - this.gx;
    const dy = next.y - this.gy;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(dist, WALK_SPEED * dt);
    // Round the hero if they're in the way, as the hero would go round them.
    const to = stepAround({ x: this.gx, y: this.gy }, next, step, this.radius, this.map.heroInTheWay, (p) => !this.map.blocked(p.x, p.y, this.radius, true, this));
    if (!to || this.map.blocked(to.x, to.y, this.radius, true, this)) {
      // Someone else on the road: wait a moment, then think again.
      this.route = [];
      this.wait = 0.8 + Math.random();
      this.sync(false);
      return;
    }
    this.gx = to.x;
    this.gy = to.y;
    this.face({ x: dx, y: dy });
    if (Math.hypot(next.x - this.gx, next.y - this.gy) < 0.02) {
      const reached = this.route.shift()!.index;
      if (reached >= 0) this.roadIndex = reached;
    }
    this.sync(true);
  }

  /**
   * For someone who stays put: keep an eye on the player while they're near,
   * now and then glance aside, and otherwise face the way they always do (the
   * fisherman at his float, a trader over their counter). Those sitting down
   * stay as they're sat.
   */
  private standAbout(dt: number, player: Vec2): void {
    if (this.def.anim) return;
    const before = this.facing;
    const near = this.distanceTo(player.x, player.y);
    if (this.def.works && this.keeps === 'workshop') {
      // At work: they look up when the hero comes close, and otherwise keep at it.
      const watching = near < NOTICE_RANGE;
      if (watching) this.face({ x: player.x - this.gx, y: player.y - this.gy });
      else this.facing = this.restFacing;
      if (watching !== this.watching) {
        this.watching = watching;
        this.sync(false);
      }
    } else if (this.seated) {
      // Once the player has gone, back to what they were doing.
      if (this.looking && near > NOTICE_RANGE) this.facing = this.restFacing;
    } else if (near < WATCH_RANGE) {
      this.face({ x: player.x - this.gx, y: player.y - this.gy });
      this.glanceLeft = 0;
    } else if (this.glanceLeft > 0) {
      this.glanceLeft -= dt;
      if (this.glanceLeft <= 0) this.facing = this.restFacing;
    } else {
      this.facing = this.restFacing;
      this.glanceIn -= dt;
      if (this.glanceIn <= 0) {
        // A look to one side, or now and then a little further round.
        const turn = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.25 ? 2 : 1);
        this.facing = (this.restFacing + turn + 8) % 8;
        this.glanceLeft = 1.2 + Math.random() * 1.8;
        this.glanceIn = 4 + Math.random() * 7;
      }
    }
    if (this.facing !== before) this.sync(false);
  }

  /**
   * A trader's round in the square (see systems/VillageDay.ts): when it's time
   * to go somewhere else, cover the stall and walk to that door (home, the
   * workshop, the tavern) and go in; when it's time for the stall again, come
   * out of whichever door they went in at and walk back to it; and between two
   * places indoors, come out of one door and cross to the other. They don't
   * stop for the player on the way (it's been a long day), but will stop to talk.
   */
  private keepHours(dt: number, paused: boolean, player: Vec2): void {
    const c = this.commute!;
    const want = whereabouts(c.villager, this.hour);
    if (paused) {
      if (this.commuting) this.sync(false);
      return;
    }
    const door = (at: Whereabouts) => c.doors[at] ?? c.doors.home!;
    switch (this.shift) {
      case 'open':
        if (want === 'stall') {
          this.standAbout(dt, player);
          return;
        }
        this.shift = 'packing';
        this.bound = want;
        this.wait = PACKING_SECONDS;
        this.map.setObjectArt(c.stall, `${c.stall.key}-closed`);
        this.callOut(want);
        return;
      case 'packing':
        this.wait -= dt;
        if (this.wait > 0) return;
        this.shift = 'leaving';
        this.route = this.commuteRoute(this.origin, c.exit, door(this.bound));
        return;
      case 'away': {
        if (want === this.bound) return;
        const from = door(this.bound);
        if (want !== 'stall' && from === door(want)) {
          // In at the same door (Hilde's home is over her bakery): nothing to see from the square.
          this.bound = want;
          return;
        }
        this.gx = from.x;
        this.gy = from.y;
        if (want === 'stall') {
          this.shift = 'arriving';
          this.route = this.commuteRoute(from, c.exit, this.origin, true);
        } else {
          this.shift = 'passing';
          this.route = this.doorToDoor(from, door(want));
        }
        this.bound = want === 'stall' ? this.bound : want;
        this.setVisible(true, true);
        return;
      }
      default:
        if (this.walkRoute(dt)) return;
        if (this.shift === 'leaving' || this.shift === 'passing') {
          // In at the door, gone till their round brings them out again.
          this.shift = 'away';
          this.setVisible(false, true);
        } else {
          // Back behind the counter: uncover the goods.
          this.shift = 'open';
          this.facing = this.restFacing;
          this.map.setObjectArt(c.stall, c.stall.key);
          this.sync(false);
        }
    }
  }

  /** Covering the stall to go somewhere, they may say where (so the hero knows to look in the smithy). */
  private callOut(to: Whereabouts): void {
    const lines = this.def.leaving?.[to];
    if (lines?.length) this.say(lines[Math.floor(Math.random() * lines.length)], 5);
  }

  /** Across the open ground from one front door to another. */
  private doorToDoor(from: Vec2, to: Vec2): Array<{ point: Vec2; index: number }> {
    const a = { x: Math.floor(from.x), y: Math.floor(from.y) };
    const b = { x: Math.floor(to.x), y: Math.floor(to.y) };
    const tiles = findPath(a, b, this.map.width, this.map.height, (x, y) => this.map.walkableAroundHero(x, y), 4000) ?? [];
    return [...tiles.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 })), to].map((point) => ({ point, index: -1 }));
  }

  /**
   * The way between the stall and home: out from behind the counter (which
   * only the trader may walk through), then by the open ground to the door.
   * @param reverse walking from home to the stall rather than from the stall home
   */
  private commuteRoute(from: Vec2, exit: Vec2, to: Vec2, reverse = false): Array<{ point: Vec2; index: number }> {
    const ground = reverse ? from : to;
    const a = { x: Math.floor(exit.x), y: Math.floor(exit.y) };
    const b = { x: Math.floor(ground.x), y: Math.floor(ground.y) };
    const tiles = findPath(reverse ? b : a, reverse ? a : b, this.map.width, this.map.height, (x, y) => this.map.walkableAroundHero(x, y), 4000) ?? [];
    const middle = tiles.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
    const points = reverse ? [...middle, exit, to] : [exit, ...middle, to];
    return points.map((point) => ({ point, index: -1 }));
  }

  /**
   * Walk on along the route (or the given points), through anything in the way
   * but the hero, whom they step round (or wait for). False once it's walked.
   */
  private walkRoute(dt: number, points?: Vec2[]): boolean {
    const list: Array<Vec2 | { point: Vec2 }> = points ?? this.route;
    const pointOf = (e: Vec2 | { point: Vec2 }) => ('point' in e ? e.point : e);
    this.skipUnderfoot(list, pointOf, true);
    const next = list[0] && pointOf(list[0]);
    if (!next) return false;
    const dx = next.x - this.gx;
    const dy = next.y - this.gy;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(dist, WALK_SPEED * dt);
    if (dist > 0) {
      const hero = this.map.heroInTheWay;
      // (Bound for the very spot the hero is stood on: no way round that, only waiting.)
      const to = hero && underfoot(next, this.radius, hero, HERO_ROOM)
        ? undefined
        : stepAround({ x: this.gx, y: this.gy }, next, step, this.radius, hero, (p) => !this.map.blocked(p.x, p.y, this.radius, false));
      if (!to && this.heldUp < HELD_UP_SECONDS) {
        // The hero is in the doorway (or wherever they're bound): give them a moment to move.
        this.heldUp += dt;
        this.sync(false);
        return true;
      }
      // Waited long enough, or no hero in the way: on they go (the hero can always step clear).
      const at = to ?? { x: this.gx + (dx / dist) * step, y: this.gy + (dy / dist) * step };
      this.heldUp = 0;
      this.gx = at.x;
      this.gy = at.y;
      this.face({ x: dx, y: dy });
    }
    if (Math.hypot(next.x - this.gx, next.y - this.gy) < 0.02) list.shift();
    this.sync(true);
    return true;
  }

  /**
   * Drop waypoints the hero is standing on, so nobody circles round them
   * trying to reach the spot. The last one is kept on a walk that must end
   * somewhere in particular (`keepLast`): a door, a stall, a table to serve.
   */
  private skipUnderfoot<T>(list: T[], pointOf: (e: T) => Vec2, keepLast = false): void {
    const hero = this.map.heroInTheWay;
    if (!hero) return;
    while (list.length > (keepLast ? 1 : 0) && underfoot(pointOf(list[0]), this.radius, hero, HERO_ROOM)) list.shift();
  }

  /** Show or hide them, fading at the front door. */
  private setVisible(visible: boolean, fade = false): void {
    const targets = [this.sprite, this.shadow];
    this.sprite.scene.tweens.killTweensOf(targets);
    if (!fade) {
      for (const t of targets) t.setVisible(visible).setAlpha(1);
      return;
    }
    for (const t of targets) t.setVisible(true).setAlpha(visible ? 0 : 1);
    this.sprite.scene.tweens.add({
      targets,
      alpha: visible ? 1 : 0,
      duration: DOOR_FADE_MS,
      onComplete: () => {
        if (!visible) for (const t of targets) t.setVisible(false);
      },
    });
  }

  /** Pick what to do next: usually a short walk along the road, sometimes just a look round. */
  private decide(): void {
    const chores = this.map.data.chores;
    if (this.def.bustles && chores?.length) {
      this.doChores(chores);
      return;
    }
    if (this.def.roam) {
      this.roamSomewhere(this.def.roam);
      return;
    }
    if (this.def.loiters) {
      // Shift about and look round now and then.
      if (Math.random() < 0.5) this.facing = Math.floor(Math.random() * 8);
      this.wait = 2 + Math.random() * 4;
      return;
    }
    const span = this.def.wander ?? 0;
    const lo = Math.max(0, this.home - span);
    const hi = Math.min(this.road.length - 1, this.home + span);
    if (Math.random() < 0.3) {
      this.facing = Math.floor(Math.random() * 8);
      this.wait = 1.5 + Math.random() * 2.5;
      return;
    }
    const target = Phaser.Math.Between(lo, hi);
    const dir = Math.sign(target - this.roadIndex);
    for (let i = this.roadIndex + dir; dir !== 0 && i !== target + dir; i += dir) {
      const p = this.road[i];
      this.route.push({ point: { x: p.x + this.lane, y: p.y + this.lane }, index: i });
    }
    this.wait = 2 + Math.random() * 4;
  }

  /**
   * A maid between orders: on reaching the spot she was making for, tidy it for
   * a while (now and then saying something about it); then off to the next one.
   */
  private doChores(spots: NonNullable<MapData['chores']>): void {
    const chore = this.chore;
    this.chore = undefined;
    if (chore && this.distanceTo(chore.x, chore.y) < 0.6) {
      this.face(chore.face);
      const lines = this.id === 'housemaid' ? HOUSEMAID_CHORES : MAID_CHORES[this.id as 'nell' | 'rosie'];
      if (lines && Math.random() < 0.35) this.say(lines[Math.floor(Math.random() * lines.length)], 3.5);
      this.wait = 5 + Math.random() * 6;
      return;
    }
    const from = { x: Math.floor(this.gx), y: Math.floor(this.gy) };
    const options = spots.filter((s) => Math.hypot(s.x - this.gx, s.y - this.gy) > 1.5);
    const spot = options[Math.floor(Math.random() * options.length)];
    const path = spot && findPath(from, { x: Math.floor(spot.x), y: Math.floor(spot.y) }, this.map.width, this.map.height, (x, y) => this.map.walkableAroundHero(x, y), 3000);
    if (!spot || !path) {
      this.wait = 2;
      return;
    }
    this.route = path.map((p) => ({ point: { x: p.x + 0.5, y: p.y + 0.5 }, index: -1 }));
    if (this.route.length > 0) this.route[this.route.length - 1].point = { x: spot.x, y: spot.y };
    else this.route.push({ point: { x: spot.x, y: spot.y }, index: -1 });
    this.chore = spot;
    this.wait = 0.3;
  }

  /**
   * Walk to a random open spot near where they started, or now and then just
   * stand and look about. Pauses are long: the militia are in no hurry.
   */
  private roamSomewhere(radius: number): void {
    if (Math.random() < 0.35) {
      this.facing = Math.floor(Math.random() * 8);
      this.wait = 2 + Math.random() * 3;
      return;
    }
    const from = { x: Math.floor(this.gx), y: Math.floor(this.gy) };
    for (let tries = 0; tries < 8; tries++) {
      const tx = Math.floor(this.origin.x + (Math.random() * 2 - 1) * radius);
      const ty = Math.floor(this.origin.y + (Math.random() * 2 - 1) * radius);
      if (!this.map.isWalkable(tx, ty) || (tx === from.x && ty === from.y)) continue;
      const path = findPath(from, { x: tx, y: ty }, this.map.width, this.map.height, (x, y) => this.map.walkableAroundHero(x, y), 2000);
      if (!path || path.length === 0 || path.length > radius * 3) continue;
      this.route = path.map((p) => ({ point: { x: p.x + 0.5, y: p.y + 0.5 }, index: -1 }));
      break;
    }
    this.wait = 3 + Math.random() * 5;
  }

  private nearestRoadIndex(gx: number, gy: number): number {
    let best = 0;
    this.road.forEach((p, i) => {
      if (Math.hypot(p.x - gx, p.y - gy) < Math.hypot(this.road[best].x - gx, this.road[best].y - gy)) best = i;
    });
    return best;
  }

  /** Turn to face a grid-space direction, using its on-screen angle (as the player does). */
  private face(dir: Vec2): void {
    if (dir.x === 0 && dir.y === 0) return;
    const screen = gridToScreen(dir.x, dir.y);
    this.facing = (Math.round(Math.atan2(screen.x, screen.y) / (Math.PI / 4)) + 8) % 8;
  }

  private sync(moving: boolean): void {
    const p = gridToScreen(this.gx, this.gy);
    this.shadow.setPosition(p.x, p.y);
    this.sprite.setPosition(p.x + this.offset.x, p.y + this.offset.y);
    // Seated, drawn in front of the seat (as the player is).
    const d = (this.moves ? this.map.characterDepth(this.gx, this.gy) : depthAt(this.gx, this.gy)) + (this.seated ? 2 : 0);
    this.shadow.setDepth(d - 0.5);
    this.sprite.setDepth(d);
    if (this.def.anim) return;
    const pose = moving ? 'walk' : this.seated ? 'sit' : this.atWork ? 'work' : 'idle';
    // Facings 0..4 are drawn (s, se, e, ne, n); 5..7 are the east ones mirrored,
    // unless the figure is modelled in 3D and has all eight drawn (see figure3d.ts).
    const names: string[] = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'];
    const allEight = this.sprite.scene.anims.exists(`${this.def.texture}-idle-w`);
    const mirrored = !allEight && this.facing > 4;
    this.sprite.setFlipX(mirrored);
    const key = `${this.def.texture}-${pose}-${names[mirrored ? 8 - this.facing : this.facing]}`;
    // Standing still, each breathes at their own pace, from wherever in the breath they happen to be.
    if (pose === 'idle') this.sprite.play({ key, frameRate: IDLE_FRAME_RATE * this.breath, randomFrame: true }, true);
    else this.sprite.play(key, true);
  }
}
