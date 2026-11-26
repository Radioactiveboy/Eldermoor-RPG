import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { CAMERA_ZOOM, FAST_FORWARD, SNEAK, SPRINT_MULTIPLIER } from '../config';
import { Child, Siblings } from '../entities/Child';
import { Companion, Trail } from '../entities/Companion';
import { Creature } from '../entities/Creature';
import { Hen } from '../entities/Hen';
import { Npc, NpcWorld } from '../entities/Npc';
import { Player } from '../entities/Player';
import { gridToScreen, Vec2 } from '../iso/IsoMath';
import { Crafting, Recipe } from '../systems/Crafting';
import { retry } from '../systems/Download';
import { Experience, HEALTH_PER_LEVEL, XP_REWARDS } from '../systems/Experience';
import { Farm } from '../systems/Farm';
import { Inventory, itemDef, ItemId, ITEMS } from '../systems/Inventory';
import { marketOpen } from '../systems/MarketHours';
import { GridPoint } from '../systems/Pathfinding';
import { Needs } from '../systems/Needs';
import { PlayerStats } from '../systems/PlayerStats';
import { QuestLog } from '../systems/Quests';
import { AREA_NAMES, SaveData, SaveGame } from '../systems/SaveGame';
import { ShopId, Shops } from '../systems/Shops';
import { Bounties } from '../systems/Bounties';
import { Companions } from '../systems/Companions';
import { Reputation } from '../systems/Reputation';
import type { DialogueScript } from '../dialogue/Dialogue';
import { Tavern } from '../systems/Tavern';
import { BlackRose } from '../systems/BlackRose';
import { TimeOfDay } from '../systems/TimeOfDay';
import { Weather } from '../systems/Weather';
import { Display } from '../ui/Display';
import { bodyStyle, THEME } from '../ui/Widgets';
import type { Speaker } from '../ui/SpeechBubbles';
import { Ambience } from '../world/Ambience';
import { AmbientSounds } from '../world/AmbientSounds';
import { Drips } from '../world/Drips';
import { FireGlow } from '../world/FireGlow';
import { RaidDirector, raidStage } from '../world/GoblinRaid';
import { IsoMap } from '../world/IsoMap';
import { AreaId, Musing, Seat } from '../world/MapData';
import { MotherRoutine } from '../world/MotherRoutine';
import { PlainsEvents } from '../world/PlainsEvents';
import type { DialogueSceneData } from './DialogueScene';
import type { InventoryTab } from './InventoryScene';
import type { PartySceneData } from './PartyScene';
import type { StationSceneData } from './StationScene';
import { areaReady, AREAS, arrivalArea, buildArea, loadArea, prefetchArea } from './game/areas';
import { companionsArrived, resetChatter, updateChatter } from './game/chatter';
import { npcHidden, offerCompanion, sendHome, spawnCompanions, updateCompanions } from './game/companions';
import { CAVE_WOLVES, COMBAT_DUCK, spawnCreatures, takeKnockedOutBy, startCombat, startRoadEvents, updateCreatures } from './game/combat';
import { runDialogueAction } from './game/dialogueActions';
import { boughtFeed, updateHens } from './game/hollow';
import { checkHomestead } from './game/homestead';
import { Homestead } from '../systems/Homestead';
import { Goat } from '../entities/Goat';
import { readKeyboard, setupInput, updateHover, type MoveKeys } from './game/input';
import { updateFocus, type Channel, type Interaction } from './game/interactions';
import { updateMarketHours } from './game/market';
import { updateMarketCrowd } from './game/marketCrowd';
import { madeAtStation } from './game/medicine';
import { cameAround, enteredAfterRaid, raidTestStart, startRaid } from './game/raid';
import { cancelChannel, syncCrops, syncGathered, updateChannel } from './game/sights';
import { enteredForSpeckle, siblingLines, updateSpeckle } from './game/speckle';
import { leftHome } from './game/medicine';
import { standUp, updateSitting } from './game/sitting';
import { loadSave, wakingThought } from './game/sleep';
import { fetchOrder, SERVICE_FIRST, syncNpcWorld, updateTavern } from './game/tavern';
import { updateBlackRose } from './game/blackrose';
import { updateGuildHall } from './game/guildhall';
import { checkMusings, checkRoadExits } from './game/travel';
import { checkGateAttack, gateTestStart, wokeAfterGate } from './game/gate';
import { warrenTestStart, wokeAfterBurial } from './game/warren';
import { wokeAfterWhisper } from './game/whisper';
import { absent } from '../world/GateAftermath';
import type { GateAttack } from '../world/GateAttack';

export type { Channel, Interaction } from './game/interactions';

export interface GameSceneData {
  /** Start a fresh game: reset health, the clock and the quest log. */
  newGame?: boolean;
  area?: AreaId;
  /** Named arrival point in the area (see MapData.entries); defaults to its spawn. */
  entry?: string;
  /** Coming round at home after being beaten in a fight. */
  knockedOut?: boolean;
  /** Carry on from a saved game: this replaces everything else here. */
  load?: SaveData;
  /** Just woke up after sleeping this many hours. */
  slept?: number;
  /** Ran back indoors from the goblins in the yard. */
  raidRetreat?: boolean;
  /** Coming round in the burnt-out cottage, after the raid. */
  raidAftermath?: boolean;
  /** The morning after the goblins took Adowvale's road, waking in the Tankard (see game/gate.ts). */
  gateAftermath?: boolean;
  /** Waking in the Tankard two days after Mother's burial, the prologue over (see game/warren.ts). */
  prologueOver?: boolean;
  /** Waking after the orb's whisper, the night after the beacon (see game/whisper.ts). */
  whispered?: boolean;
}

/** Things the HUD can show the player as a speech-like hint. */
export type HintListener = (text: string) => void;
/** A signpost the player has read, for the HUD to show. */
export type SignListener = (heading: string, lines: string[]) => void;

/** Seconds after arriving in an area before beasts can notice the player, so there's time to see them first. */
const ARRIVAL_GRACE = 2.5;

/**
 * The world: the area the hero is in, everyone and everything in it, the clock,
 * and the controls. Most of what happens here lives in scenes/game/ (areas,
 * interactions, dialogue actions, doors, fights, sleeping, the tavern, the raid),
 * as functions that take this scene; the fields they share are public.
 */
export class GameScene extends Phaser.Scene {
  map!: IsoMap;
  player!: Player;
  stats!: PlayerStats;
  clock!: TimeOfDay;
  area: AreaId = 'home';
  npcs: Npc[] = [];
  /** Whoever is travelling with the hero (see systems/Companions.ts), following in their footsteps. */
  companions: Companion[] = [];
  /** The hero's footsteps, for the companions to walk in. */
  trail = new Trail();
  /** Wild animals roaming the area. */
  creatures: Creature[] = [];
  /** Chance meetings out on Adowvale Plains (see world/PlainsEvents.ts). */
  roadEvents?: PlainsEvents;
  /** Farmer Iran's hens, pottering about their run. */
  hens: Hen[] = [];
  /** Goats in the Hollow's paddock, once it's built. */
  goats: Goat[] = [];
  cluckTimer = 0;
  /** Iran's children, chattering away indoors. */
  siblings?: Siblings;
  /** True during a fight: the clock stops and health doesn't regenerate. */
  inCombat = false;
  /** Birds, rippling water and the like, outdoors only. */
  ambience?: Ambience;
  /** Water dripping from stalactites, in the cave. */
  private drips?: Drips;
  /** A fire's light dancing on the walls, indoors. */
  private fireGlow?: FireGlow;
  private sounds!: AmbientSounds;
  /** What the player would do by pressing E right now, if anything. */
  focus?: Interaction;
  /** A few-seconds action in progress, for the HUD's progress bar. */
  channel?: Channel;
  /** True while a conversation, a menu or a door transition has the controls. */
  busy = false;
  /** The HUD sets this to show short messages. */
  onHint?: HintListener;
  onSign?: SignListener;
  keys!: MoveKeys;
  hover!: Phaser.GameObjects.Image;
  marker!: Phaser.GameObjects.Image;
  /** Walking over to something after it was clicked; use it on arrival. */
  walkingTo?: Interaction;
  /** The seat the player is sitting on, if any. */
  seat?: Seat;
  sitTimer = 0;
  private crackleTimer = 0;
  private cropTimer = 0;
  /** Beasts beaten or chased off for good, by spawn id. */
  defeatedFoes = new Set<string>();
  arrivalGrace = 0;
  /** Areas visited this game, for first-visit thoughts. */
  visited = new Set<AreaId>();
  /** A trader's stall to open once the conversation that asked for it closes. */
  pendingShop?: ShopId;
  /** Off while the player stands on a road exit they just turned back from, so it isn't asked again at once. */
  exitArmed = true;
  /** The last tile the player stood on that isn't a road exit: where turning back walks them to. */
  lastOffExit: GridPoint = { x: 0, y: 0 };
  /** Whether the market was open last frame, so the militia can call out when it shuts or opens. */
  marketWasOpen = true;
  /** Sprinting this frame, which sends shy game running. */
  sprinting = false;
  /** Sneaking this frame: slower, and beasts have to be closer to notice. */
  sneaking = false;
  /**
   * Sneaking switched on with the HUD's boot button (phones have no Ctrl key).
   * Static so it lasts through doors and treks, which restart this scene.
   */
  static sneakToggled = false;
  /** Whether the hero has been told about sneaking yet this session. */
  private static sneakExplained = false;
  /** The patch of ground with a thought attached (MapData.musings) the player is standing in, so it's only had once. */
  musing?: Musing;
  /** Something to happen once the conversation that led to it closes (the toll gate swinging open). */
  afterTalk?: () => void;
  /**
   * A tavern maid looking after the hero's table: on her way over, gone to
   * the bar with an order, or bringing it back.
   */
  service?: { maid: Npc; seat: Seat; item?: ItemId; stage: 'coming' | 'fetching' | 'bringing' };
  /** Seconds until a maid next comes to the hero's table. */
  serviceTimer = SERVICE_FIRST;
  /** Seconds until the tavern's regulars next say something among themselves. */
  chatterTimer = 3;
  /** An order just placed with a maid, to fetch once the conversation closes. */
  ordered?: ItemId;
  /** Mother going about her day, at home. */
  private motherRoutine?: MotherRoutine;
  /** The goblins' raid, on the morning it happens. */
  private raid?: RaidDirector;
  /** In the fight the goblins can't lose. */
  raidFight = false;
  /** The night the goblins come for Adowvale, while it's on (see game/gate.ts). */
  gateAttack?: GateAttack;
  /** Waiting for the area's map to download (see waitForArea): nothing else is set up yet. */
  waiting = false;

  constructor() {
    super('Game');
    // What this scene itself remembers about the world goes in saves too.
    SaveGame.register('world', {
      save: () => ({ defeatedFoes: [...this.defeatedFoes], visited: [...this.visited] }),
      load: (data) => {
        const d = data as { defeatedFoes?: string[]; visited?: AreaId[] } | undefined;
        this.defeatedFoes = new Set(d?.defeatedFoes ?? []);
        this.visited = new Set(d?.visited ?? []);
      },
    });
  }

  create(data: GameSceneData = {}): void {
    // Most areas' maps come in files of their own (see game/areas.ts), fetched ahead as the hero
    // nears a door. If this one hasn't arrived yet, wait for it in the dark and come in again.
    this.waiting = !areaReady(arrivalArea(data));
    // The interface over the top (health, minimap, prompts) still shows the last area, so it's hidden meanwhile.
    this.scene.setVisible(!this.waiting, 'UI');
    if (this.waiting) {
      this.waitForArea(arrivalArea(data), data);
      return;
    }
    if (data.load) {
      loadSave(this, data.load);
    } else if (data.newGame || !this.stats) {
      this.stats = new PlayerStats();
      this.clock = new TimeOfDay();
      QuestLog.reset(
        'Woke before dawn to Mother coughing again. She says it is nothing, but she barely touched her supper ' +
          'and her hands were cold as river stones. I should sit with her today.',
      );
      QuestLog.dayProvider = () => this.clock.day;
      QuestLog.hourProvider = () => this.clock.hour;
      Inventory.reset();
      Experience.reset();
      Farm.reset();
      Shops.reset();
      Reputation.reset();
      Bounties.reset();
      Tavern.reset();
      BlackRose.reset();
      Crafting.reset();
      Weather.reset();
      Needs.reset();
      Companions.reset();
      Homestead.reset();
      resetChatter();
      this.defeatedFoes.clear();
      this.visited.clear();
      // Handy for testing: open the game with ?hour=21 to start at 9pm.
      const hourParam = new URLSearchParams(window.location.search).get('hour');
      if (hourParam !== null && !Number.isNaN(Number(hourParam))) this.clock.setHour(Number(hourParam));
      // Handy for testing the brewing and cooking: ?give=moonpetal,willow-bark,raw-hare:3 puts things in the satchel.
      for (const part of (new URLSearchParams(window.location.search).get('give') ?? '').split(',').filter(Boolean)) {
        const [id, n] = part.split(':');
        if (id in ITEMS) Inventory.add(id as ItemId, Math.max(1, Number(n) || 1));
      }
      raidTestStart(this.clock);
      gateTestStart(this.clock);
      warrenTestStart();
    }
    this.area = arrivalArea(data);
    // Saves from before the wolves at home counted for anything: if they're all dead, note it.
    if (CAVE_WOLVES.every((id) => this.defeatedFoes.has(id))) QuestLog.setFlag('cleared-cave');
    this.busy = false;
    this.walkingTo = undefined;
    this.focus = undefined;
    this.channel = undefined;
    this.seat = undefined;
    NpcWorld.sitting = false;
    this.inCombat = false;
    this.arrivalGrace = ARRIVAL_GRACE;
    this.afterTalk = undefined;
    this.musing = undefined;

    // Handy for testing: ?weather=rain (or clear, overcast, drizzle, storm, mist) holds the weather (see systems/Weather.ts).
    Weather.readSwitch(window.location.search);
    // The raid's morning stays dry and clear, as it was written.
    Weather.calm = raidStage() === 'morning' ? 'clear' : undefined;
    // Putting the Hollow right goes on by the clock (see systems/Homestead.ts): anything finished while away is finished now.
    Homestead.clock = () => this.clock.elapsedHours;
    checkHomestead(this);
    this.map = new IsoMap(this, buildArea(this.area));
    const start = data.load?.position ?? ((data.entry && this.map.data.entries?.[data.entry]) || this.map.data.spawn);
    this.player = new Player(this, this.map, start.x, start.y);
    this.exitArmed = true;
    this.lastOffExit = { x: this.player.tileX, y: this.player.tileY };
    // (Someone travelling with the hero isn't also waiting where they were met.)
    this.npcs = (this.map.data.npcs ?? []).filter((n) => !npcHidden(n.id) && !absent(n.id)).map((n) => new Npc(this, this.map, n.id, n.gx, n.gy, n.commute, this.clock.hour, n.looking, n.hours, n));
    this.companions = spawnCompanions(this);
    companionsArrived(this);
    // A night's sleep sets everyone right.
    if (data.slept !== undefined) Companions.rested();
    const mother = this.someone('mother');
    NpcWorld.motherInBed = false;
    this.motherRoutine = mother ? new MotherRoutine(mother, this.map, () => this.seat) : undefined;
    this.motherRoutine?.settle(this.clock.hour);
    this.raidFight = false;
    this.service = undefined;
    this.serviceTimer = SERVICE_FIRST;
    this.chatterTimer = 3;
    this.marketWasOpen = marketOpen(this.clock.hour);
    this.creatures = spawnCreatures(this);
    this.roadEvents?.shutdown();
    this.roadEvents = this.area === 'plains' ? startRoadEvents(this) : undefined;
    const hens = this.map.data.hens;
    this.hens = (hens?.flock ?? []).map((h) => new Hen(this, this.map, hens!.pen, h.kind, h.gx, h.gy));
    this.goats = (this.map.data.goats ?? []).map((p) => new Goat(this, this.map, p.gx, p.gy));
    const children = (this.map.data.children ?? []).map((c) => new Child(this, this.map, c.id, c.gx, c.gy));
    // What they chatter about depends on the raid, and on Speckle and Moppet after it (see game/speckle.ts).
    const lines = siblingLines();
    this.siblings = children.length > 0 ? new Siblings(children, lines.banter, lines.hello) : undefined;
    syncCrops(this);
    syncGathered(this);
    this.ambience = this.map.data.indoor ? undefined : new Ambience(this, this.map, this.clock);
    this.drips = this.map.data.drips ? new Drips(this, this.map.data) : undefined;
    this.fireGlow = this.map.data.indoor ? new FireGlow(this, this.map.data) : undefined;
    this.sounds = new AmbientSounds(this.area, this.map.data);
    GameAudio.duckAmbience(1);
    // The world falls quiet behind the pause menu.
    const hush = () => GameAudio.duckAmbience(0);
    const unhush = () => GameAudio.duckAmbience(this.inCombat ? COMBAT_DUCK : 1);
    this.events.on(Phaser.Scenes.Events.PAUSE, hush);
    this.events.on(Phaser.Scenes.Events.RESUME, unhush);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.PAUSE, hush);
      this.events.off(Phaser.Scenes.Events.RESUME, unhush);
      this.sounds.stop();
    });

    this.hover = this.add.image(0, 0, 'tile-highlight').setDepth(1).setAlpha(0.6).setVisible(false);
    this.marker = this.add.image(0, 0, 'tile-highlight').setDepth(1).setTint(0x9cf09c).setVisible(false);

    this.setupCamera();
    setupInput(this);
    GameAudio.playMusic(this.map.data.music ?? 'world');
    this.cameras.main.fadeIn(450, 0, 0, 0);

    this.raid = undefined;
    this.gateAttack = undefined;
    if (raidStage() === 'morning' && (this.area === 'world' || this.area === 'home')) {
      this.raid = startRaid(this);
      if (this.area === 'world') this.raid.beginOutside();
      else this.raid.beginInside(!!data.raidRetreat);
    }
    if (data.knockedOut) {
      const by = takeKnockedOutBy();
      this.time.delayedCall(1200, () =>
        this.onHint?.(by ? `I came to on the cottage floor, aching all over. ${by} must have dragged me home.` : 'I came to on the cottage floor, aching all over. That wolf is still out there.'),
      );
    }
    if (data.gateAftermath) wokeAfterGate(this);
    if (data.raidAftermath) {
      cameAround(this);
    } else if (data.prologueOver) {
      wokeAfterBurial(this);
    } else if (data.whispered) {
      wokeAfterWhisper(this);
    } else if (data.slept !== undefined && raidStage() === 'morning') {
      this.time.delayedCall(900, () => this.onHint?.('Shouting. Screaming, outside, and the smell of smoke. What in the world is going on out there?'));
      this.time.delayedCall(5200, () => this.onHint?.("Mother is still asleep. I'd better go and see."));
    } else if (data.slept !== undefined) {
      this.time.delayedCall(1000, () => this.onHint?.(wakingThought(this.clock.hour, this.area)));
    } else if (data.load) {
      const waking =
        this.area === 'tavern-room'
          ? 'I wake in my room above the Crooked Tankard. The day is waiting.'
          : this.area === 'blackrose-room'
            ? 'I wake in the room above the Black Rose, with the chair still under the handle. The day is waiting.'
            : 'I wake in my own bed. The day is waiting.';
      this.time.delayedCall(1000, () => this.onHint?.(waking));
    }
    if (data.newGame) {
      this.time.delayedCall(1200, () => this.onHint?.('Mother is resting by the hearth. She wants to speak with you.'));
    }
    if (this.area !== 'home') leftHome();
    // Each area's own arrival: first-visit thoughts and diary lines, quest steps (see game/areas.ts).
    AREAS[this.area]?.enter?.(this);
    if (raidStage() === 'over') enteredAfterRaid(this);
    enteredForSpeckle(this);
    // Finding somewhere new is worth a little experience (not the hero's own home).
    if (!this.visited.has(this.area) && !data.newGame && this.area !== 'home') {
      const name = AREA_NAMES[this.area];
      this.time.delayedCall(700, () => Experience.gain(XP_REWARDS.discovery, `Found ${name}`));
    }
    this.visited.add(this.area);
    this.prefetchNeighbours();
    // A new level brings more maximum health, and the hero gets that much back straight away.
    const offXp = Experience.onChange((e) => {
      if (e.type === 'levelled') this.stats.heal((e.level - e.from) * HEALTH_PER_LEVEL);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offXp);
    // Buying Iran's chicken feed moves his errand on.
    const offItems = Inventory.onChange((e) => {
      if (e.type === 'added' && e.id === 'chicken-feed') boughtFeed();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offItems);
    // The scene object is reused across restarts: start each one stood up, with a fresh hero.
    this.sneaking = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('beforeunload', GameScene.holdTab));
  }

  /** People besides the NPCs who can say things in speech bubbles (Iran's children), for the HUD. */
  get speakers(): Speaker[] {
    return [...(this.siblings?.speakers ?? []), ...(this.raid?.speakers ?? []), ...(this.gateAttack?.speakers ?? []), ...this.companions];
  }

  update(_time: number, deltaMs: number): void {
    if (this.waiting) return;
    const dt = Math.min(deltaMs / 1000, 0.1);
    // Sneaking wins over sprinting: you can't creep and run at once.
    const wantsSneak = !this.busy && (this.keys.sneak.isDown || GameScene.sneakToggled);
    const wantsSprint = !this.busy && !wantsSneak && this.keys.sprint.isDown && this.stats.canSprint();
    const input = this.busy ? { x: 0, y: 0 } : readKeyboard(this);
    const moving = input.x !== 0 || input.y !== 0;
    if (moving) {
      this.walkingTo = undefined;
      if (this.seat) standUp(this);
      if (this.channel) cancelChannel(this);
    }
    updateChannel(this, dt);
    this.setSneaking(wantsSneak);
    const before = { x: this.player.gx, y: this.player.gy };
    const moved = this.player.update(dt, input, wantsSprint ? SPRINT_MULTIPLIER : wantsSneak ? SNEAK.speed : 1);
    this.sprinting = wantsSprint && moved;
    updateCompanions(this, dt, dt > 0 ? Math.hypot(this.player.gx - before.x, this.player.gy - before.y) / dt : 0);
    updateChatter(this, dt);
    this.motherRoutine?.update(dt, this.clock.hour, this.busy);
    for (const npc of this.npcs) npc.update(dt, { x: this.player.gx, y: this.player.gy }, this.busy, this.clock.hour);
    this.raid?.update(dt, this.busy || this.inCombat);
    this.gateAttack?.update(dt);
    checkGateAttack(this);
    updateMarketHours(this);
    updateMarketCrowd(this, dt);
    this.ambience?.update(dt, this.cameras.main.worldView, { x: this.player.gx, y: this.player.gy });
    this.drips?.update(dt, { x: this.player.gx, y: this.player.gy });
    this.fireGlow?.update(dt);
    const stepLoudness = !moved ? 0 : this.sprinting ? 1.4 : wantsSneak ? 0.35 : 1;
    this.sounds.update(dt, { x: this.player.gx, y: this.player.gy }, this.clock.hour, this.npcs, stepLoudness, this.player.footfalls, this.clock.elapsedHours);
    // Time stands still while fighting, turn by turn.
    if (!this.inCombat) {
      this.stats.update(dt, wantsSprint && moved);
      this.clock.timeScale = !this.busy && this.keys.fastForward.isDown ? FAST_FORWARD : 1;
      this.clock.update(dt);
      Needs.tick(this.clock.elapsedHours);
    }
    updateCreatures(this, dt);
    this.roadEvents?.update(dt);
    this.map.updateFading(this.player.sprite.x, this.player.sprite.y, this.player.sprite.depth, dt);
    updateHens(this, dt);
    for (const goat of this.goats) goat.update(dt, this.busy);
    this.siblings?.update(dt, { x: this.player.gx, y: this.player.gy }, this.busy);
    updateSpeckle(this);
    checkRoadExits(this);
    checkMusings(this);
    updateHover(this);
    updateFocus(this);
    updateSitting(this, dt);
    updateTavern(this, dt);
    updateBlackRose(this, dt);
    updateGuildHall(this, dt);

    this.cropTimer -= dt;
    if (this.cropTimer <= 0) {
      syncCrops(this);
      syncGathered(this);
      checkHomestead(this);
      this.cropTimer = 1;
    }

    if (this.map.data.indoor && !this.map.data.underground && !this.map.data.cold) {
      this.crackleTimer -= dt;
      if (this.crackleTimer <= 0) {
        GameAudio.crackle();
        this.crackleTimer = 0.15 + Math.random() * 1.2;
      }
    }
  }

  /** Do whatever is prompted (the E key, or tapping the prompt). */
  interact(): void {
    if (this.busy || this.channel || !this.focus) return;
    this.focus.run();
  }

  openJournal(): void {
    if (!this.takeControls()) return;
    this.scene.launch('Journal');
    // The journal's Map tab closes the book and opens the world map in its place.
    this.scene.get('Journal').events.once('journal-closed', (then?: 'map') => (then === 'map' ? this.showWorldMap() : this.release()));
  }

  /** The world map (M, or the journal's Map tab): where the hero has been, where they are, and where to go next. */
  openWorldMap(): void {
    if (!this.takeControls()) return;
    this.showWorldMap();
  }

  private showWorldMap(): void {
    this.scene.launch('Map');
    this.scene.get('Map').events.once('map-closed', () => this.release());
  }

  /** The satchel (inventory) or equipment screen: I and C, or the HUD's satchel button. */
  openInventory(tab: InventoryTab = 'satchel'): void {
    if (!this.takeControls()) return;
    this.scene.launch('Inventory', { tab });
    this.scene.get('Inventory').events.once('inventory-closed', () => this.release());
  }

  /** Who travels with the hero (P, or a companion's card on the HUD): see scenes/PartyScene.ts. */
  openParty(): void {
    if (!this.takeControls()) return;
    this.scene.launch('Party', { onSendHome: (id) => sendHome(this, id) } satisfies PartySceneData);
    this.scene.get('Party').events.once('party-closed', () => this.release());
  }

  /** Eat a piece of food from the satchel. */
  eat(index: number): boolean {
    const stack = Inventory.bag[index];
    const def = stack && itemDef(stack.id);
    // An oil (a boon and nothing to eat) is only used in a fight, which reads its boon itself.
    if (!def || (!def.eat && !def.boon)) return false;
    const eat = def.eat ?? {};
    Inventory.takeOne(index);
    if (eat.health) this.stats.heal(eat.health);
    if (eat.stamina) this.stats.restoreStamina(eat.stamina);
    Needs.ate(def);
    if (def.drink) GameAudio.gulp();
    else GameAudio.crunch();
    return true;
  }

  /** Stops whatever the player is doing so a menu can open. */
  takeControls(): boolean {
    if (this.busy || !this.scene.isActive()) return false;
    if (this.channel) cancelChannel(this);
    this.busy = true;
    this.walkingTo = undefined;
    this.player.setPath([]);
    return true;
  }

  /** Freezes the world and shows the pause menu (Esc, or the HUD's pause button). */
  openPauseMenu(): void {
    if (this.busy || !this.scene.isActive()) return;
    this.scene.pause();
    this.scene.launch('Pause');
  }

  /** Hands control back after a menu closes, a moment later so the closing key press isn't reused. */
  release(): void {
    this.time.delayedCall(80, () => {
      // (Unless a fight has broken out in the meantime: the fight hands control back when it's over.)
      if (!this.inCombat) this.busy = false;
    });
  }

  /** @param keepSeat stay sitting (a maid taking an order at the table) */
  startConversation(npc: Npc, keepSeat = false): void {
    if (this.seat && !keepSeat) standUp(this);
    syncNpcWorld(this);
    this.ordered = undefined;
    this.busy = true;
    this.walkingTo = undefined;
    this.player.setPath([]);
    npc.faceTowards(this.player.gx, this.player.gy);
    // Someone who could come along is asked here too (see game/companions.ts).
    this.runScript(offerCompanion(npc.id, npc.script()), npc);
  }

  /** A conversation with someone who isn't one of the map's NPCs (a companion following the hero). */
  startScript(script: DialogueScript): void {
    if (this.seat) standUp(this);
    this.busy = true;
    this.walkingTo = undefined;
    this.player.setPath([]);
    this.runScript(script);
  }

  private runScript(script: DialogueScript, npc?: Npc): void {
    this.pendingShop = undefined;
    const data: DialogueSceneData = {
      script,
      onAction: (action) => runDialogueAction(this, action),
    };
    this.scene.launch('Dialogue', data);
    this.scene.get('Dialogue').events.once('dialogue-closed', () => {
      if (npc && this.ordered && this.service?.maid === npc) fetchOrder(this, this.ordered);
      else if (npc && this.service?.maid === npc && !this.service.item) this.service = undefined;
      this.ordered = undefined;
      const shop = this.pendingShop;
      this.pendingShop = undefined;
      const after = this.afterTalk;
      this.afterTalk = undefined;
      after?.();
      // Asked to see a trader's goods: go straight from talking to trading.
      if (shop) this.openShop(shop);
      else this.release();
    });
  }

  /**
   * Shuts a conversation that's still open, at once and without what would
   * follow it (a shop, an order, an afterTalk): a fight has broken out (see
   * game/combat.ts startCombat), and the box would sit over it.
   */
  closeDialogue(): void {
    if (!this.scene.isActive('Dialogue') && !this.scene.isPaused('Dialogue')) return;
    const dialogue = this.scene.get('Dialogue');
    dialogue.events.removeAllListeners('dialogue-closed');
    this.scene.stop('Dialogue');
    this.pendingShop = undefined;
    this.ordered = undefined;
    this.afterTalk = undefined;
  }

  /** Brew at a bench or cook at a hearth (see scenes/StationScene.ts). */
  openStation(station: string): void {
    if (!this.takeControls()) return;
    if (this.seat) standUp(this);
    this.scene.launch('Station', { station } satisfies StationSceneData);
    const ui = this.scene.get('Station');
    const made = (recipe: Recipe) => madeAtStation(this, recipe);
    ui.events.on('station-made', made);
    ui.events.once('station-closed', () => {
      ui.events.off('station-made', made);
      this.release();
    });
  }

  /** A trader's stall: buy and sell. Opened from the conversation with them (see dialogue/market.ts). */
  private openShop(shop: ShopId): void {
    this.busy = true;
    this.scene.launch('Shop', { shop });
    this.scene.get('Shop').events.once('shop-closed', () => this.release());
  }

  /** The person with this id, if they're about. */
  someone(id: string): Npc | undefined {
    return this.npcs.find((n) => n.id === id && n.present);
  }

  /** Crouch into a sneak, or straighten up. The first time, the hero says what it's for. */
  private setSneaking(on: boolean): void {
    if (on === this.sneaking) return;
    this.sneaking = on;
    this.player.sneaking = on;
    // Ctrl+W closes the browser tab and can't be blocked, so while Ctrl is held for sneaking, ask before leaving.
    if (on) window.addEventListener('beforeunload', GameScene.holdTab);
    else window.removeEventListener('beforeunload', GameScene.holdTab);
    if (on && !GameScene.sneakExplained) {
      GameScene.sneakExplained = true;
      this.onHint?.('Low and quiet. Beasts will have to be a good deal closer to catch wind of me.');
    }
  }

  /** Switch sneaking on or off without holding Ctrl (the HUD's boot button). */
  toggleSneak(): void {
    GameScene.sneakToggled = !GameScene.sneakToggled;
  }

  private static holdTab(e: BeforeUnloadEvent): void {
    e.preventDefault();
    e.returnValue = '';
  }

  /** A beast has spotted the player (or the player has gone after some game): it and any of its pack close by fight. */
  startCombat(first: Creature, raid?: Creature[]): void {
    startCombat(this, first, raid);
  }

  /** Point the camera at the middle of a fight (grid positions). */
  frameFight(points: Vec2[]): void {
    const cam = this.cameras.main;
    cam.stopFollow();
    const gx = points.reduce((n, p) => n + p.x, 0) / points.length;
    const gy = points.reduce((n, p) => n + p.y, 0) / points.length;
    const p = gridToScreen(gx, gy);
    cam.pan(p.x, p.y - 20, 500, 'Sine.easeInOut');
  }

  /**
   * The area's map is still downloading: a dark screen (with a word, if it takes more than a
   * moment), then the scene starts again with the same data once it's here.
   */
  private waitForArea(area: AreaId, data: GameSceneData): void {
    // Nothing of the last area is left, so the interface over the top shouldn't try to draw it.
    this.player = undefined as unknown as Player;
    const { width, height } = this.scale;
    const text = this.add
      .text(width / 2, height / 2, 'On the way…', bodyStyle(16 * Display.zoom, THEME.dimText))
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: text, alpha: 1, delay: 400, duration: 300 });
    void retry(
      () => loadArea(area),
      () => text.setText('Waiting for the connection…'),
    ).then(() => {
      if (this.scene.isActive()) this.scene.restart(data);
    });
  }

  /** Fetches the maps behind this area's doors in the background, so walking through one doesn't wait. */
  private prefetchNeighbours(): void {
    const next = new Set((this.map.data.doors ?? []).map((d) => d.to));
    this.time.delayedCall(1500, () => next.forEach((to) => prefetchArea(to)));
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    // Pixel art looks best zoomed in, but phones need to see more of the map.
    cam.setZoom(Phaser.Math.Clamp(Display.page.width / 640, 1, CAMERA_ZOOM.default) * Display.render);
    // (The camera works in canvas pixels, so its zoom includes the screen's pixel density; see ui/Display.)
    cam.setBackgroundColor(this.map.backgroundColor);
    cam.roundPixels = true;
    this.fitCamera();
    this.scale.on('resize', this.fitCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.fitCamera, this));
  }

  /**
   * Follow the player within the map's bounds. Bounds smaller than the screen
   * (a small room, or a narrow phone) are padded out around the map's centre,
   * so the map sits in the middle instead of being pushed into a corner.
   */
  fitCamera(): void {
    const cam = this.cameras.main;
    const b = this.map.getWorldBounds();
    const w = Math.max(b.width, this.scale.width / cam.zoom);
    const h = Math.max(b.height, this.scale.height / cam.zoom);
    cam.setBounds(Math.round(b.centerX - w / 2), Math.round(b.centerY - h / 2), Math.ceil(w), Math.ceil(h));
    // In a fight the camera stays on the fight (see frameFight) rather than the hero.
    if (!this.inCombat) cam.startFollow(this.player.sprite, true, 0.12, 0.12);
  }

  /** Zooms the world camera in (factor above 1) or out, within the usual limits, keeping what's in the middle of the screen there. */
  zoomBy(factor: number): void {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, CAMERA_ZOOM.min * Display.render, CAMERA_ZOOM.max * Display.render));
    this.fitCamera();
  }
}
