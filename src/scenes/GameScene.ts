import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { CAMERA_ZOOM, FAST_FORWARD, MAP_HEIGHT, MAP_SEED, MAP_WIDTH, PLAYER_RADIUS, SPRINT_MULTIPLIER } from '../config';
import { Child, Siblings } from '../entities/Child';
import { Creature } from '../entities/Creature';
import { Hen } from '../entities/Hen';
import { Npc } from '../entities/Npc';
import { SpeakerId, SPEAKERS } from '../dialogue/Dialogue';
import { EGG_REWARD, FEED_MONEY, SIBLING_BANTER, SIBLING_GREETINGS, SIBLING_THANKS } from '../dialogue/iran';
import { Player } from '../entities/Player';
import { gridToScreen, screenToGrid, Vec2 } from '../iso/IsoMath';
import { Experience, HEALTH_PER_LEVEL, XP_REWARDS } from '../systems/Experience';
import { CROPS, Farm, PICK_SECONDS } from '../systems/Farm';
import { Inventory, ItemId, itemDef } from '../systems/Inventory';
import { marketOpen } from '../systems/MarketHours';
import { findPath, GridPoint } from '../systems/Pathfinding';
import { rollLoot } from '../systems/Loot';
import { PlayerStats } from '../systems/PlayerStats';
import { QuestLog } from '../systems/Quests';
import { AREA_NAMES, SAVE_VERSION, SaveData, SaveGame } from '../systems/SaveGame';
import { ShopId, Shops, SHOPS } from '../systems/Shops';
import { clockText, TimeOfDay } from '../systems/TimeOfDay';
import { buildCaveMap } from '../world/CaveMap';
import { Drips } from '../world/Drips';
import { buildHomeMap } from '../world/HomeMap';
import { buildHutMap } from '../world/HutMap';
import { buildMarketMap, TOLL, tollGateShape } from '../world/MarketMap';
import { buildPlainsMap } from '../world/PlainsMap';
import { Ambience } from '../world/Ambience';
import { IsoMap } from '../world/IsoMap';
import { AreaId, Bed, CropPatch, Door, MapData, Musing, Prop, Seat, Sight } from '../world/MapData';
import { FoeKind, FOES } from '../systems/Combat';
import { cropKey } from '../art/farm';
import type { InventoryTab } from './InventoryScene';
import { generateMap } from '../world/MapGenerator';
import type { Speaker } from '../ui/SpeechBubbles';
import type { DialogueSceneData } from './DialogueScene';
import type { CombatResult, CombatSceneData } from './CombatScene';
import type { SleepSceneData } from './SleepScene';
import type { ConfirmSceneData } from './ConfirmScene';

type MoveKeys = Record<
  'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'sprint' | 'fastForward',
  Phaser.Input.Keyboard.Key
>;

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
}

/** Things the HUD can show the player as a speech-like hint. */
export type HintListener = (text: string) => void;
/** A signpost the player has read, for the HUD to show. */
export type SignListener = (heading: string, lines: string[]) => void;

/**
 * Something the player can do where they stand: talk to someone, use a door,
 * sit down, pick crops, shake a tree. The nearest one in range gets an
 * "E  <label>" prompt over it; E, Enter, or tapping the prompt does it.
 */
export interface Interaction {
  /** Identifies it across frames, e.g. "crop:24,22". */
  key: string;
  /** What to do, e.g. "Talk-to" or "Go inside". */
  label: string;
  /** Who or what it's done to, shown after the label in yellow, e.g. "Mother". */
  target?: string;
  /** Where it is, in grid space, for the range check. */
  gx: number;
  gy: number;
  range: number;
  /** World pixel the prompt floats above. */
  promptX: number;
  promptY: number;
  /** The tile that clicking on selects it. */
  tile: GridPoint;
  /** Walk onto its tile (doors) rather than next to it. */
  walkOnto?: boolean;
  run: () => void;
}

/** Something that takes a few seconds (picking, shaking a tree). Moving cancels it. */
export interface Channel {
  label: string;
  seconds: number;
  elapsed: number;
  onDone: () => void;
  onCancel?: () => void;
}

/** Coins Wil pays for news of his ewes. */
const SHEEP_REWARD = 30;
/** Other beasts this close (in tiles) to the one that starts a fight join in. */
const PACK_RANGE = 7;
/** Seconds after arriving in an area before beasts can notice the player, so there's time to see them first. */
const ARRIVAL_GRACE = 2.5;

const SITTING_THOUGHTS: Record<string, string[]> = {
  bench: [
    'The garden could do with weeding again.',
    'Smoke curls up from the chimney and drifts over the trees.',
    'A blackbird is singing somewhere in the hedge.',
  ],
  stool: [
    'The fire pops and settles. It is warm in here, at least.',
    'The old table is covered in knife marks and candle wax.',
  ],
  'hut-stool': [
    'Somebody has carved a lopsided hen into the table. Two somebodies, by the look of it.',
    'There is a basket of eggs on the shelf, and a feather in the butter.',
  ],
  'market-bench': [
    'The smell of fresh bread drifts over from the bakehouse stall.',
    'Somewhere a cart rattles over the cobbles. Two women are arguing about the price of eggs.',
    'Clang, clang, clang. The smith is at it again.',
  ],
  // The same bench after the traders have gone home.
  'market-bench-closed': [
    'The stalls are covered over for the night. The square is quiet without the traders.',
    'A militiaman yawns by the well and leans on his spear.',
    'Lamplight pools on the trodden earth. Somewhere a shutter bangs in the wind.',
  ],
};

/** What's left of each kind of beast once it's slain. */
const SPOILS: Record<FoeKind, Array<[ItemId, number]>> = {
  wolf: [['wolf-pelt', 1]],
  deer: [['venison', 2], ['deer-hide', 1]],
  hare: [['hare-pelt', 1]],
  boar: [['boar-tusk', 2]],
};

/** What the hero thinks over a beast they've brought down, and when one gets away. */
const AFTER_THE_FIGHT: Record<FoeKind, { slain: string; fled: string }> = {
  wolf: { slain: 'It lies still now. The pelt might be worth something in the village.', fled: 'It ran off into the trees. I doubt it will come back.' },
  deer: { slain: 'Venison for the pot, and a fine hide. Tamsin will want that.', fled: 'Gone, white rump bobbing away over the grass. I need to be quicker.' },
  hare: { slain: 'A hare. Not much eating on it, but the pelt is soft.', fled: 'Gone in a flash. Hares are quicker than they look.' },
  boar: { slain: 'The boar is still at last. Those tusks are worth keeping, and so is my hide.', fled: 'It crashed off into the thicket. Good riddance.' },
};

/** What the militia call out about the market's hours. */
const MILITIA_CALLS = {
  closing: "Market's closing! Stalls are shut till morning, folks. Off home with you.",
  closed: "Market's shut for the night, friend. The traders have all gone home. Come back in the morning.",
  opening: "Morning! Market's open!",
};

/** What the hero thinks on waking, by the hour. */
function wakingThought(hour: number): string {
  if (hour >= 5 && hour < 10) return 'Morning already. I feel rested, and the fire has burned low.';
  if (hour >= 10 && hour < 16) return 'I slept half the day away. Still, I feel better for it.';
  if (hour >= 16 && hour < 20) return 'The light is going. I feel rested, at least.';
  return 'Dark outside. The fire crackles, and the house is quiet.';
}

/** Builds the map for an area. */
function buildArea(area: AreaId): MapData {
  if (area === 'home') return buildHomeMap();
  if (area === 'market') return buildMarketMap(QuestLog.hasFlag('paid-toll'));
  if (area === 'plains') return buildPlainsMap();
  if (area === 'cave') return buildCaveMap();
  if (area === 'hut') return buildHutMap();
  return generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED);
}

export class GameScene extends Phaser.Scene {
  map!: IsoMap;
  player!: Player;
  stats!: PlayerStats;
  clock!: TimeOfDay;
  area: AreaId = 'home';
  npcs: Npc[] = [];
  /** Wild animals roaming the area. */
  creatures: Creature[] = [];
  /** Farmer Iran's hens, pottering about their run. */
  private hens: Hen[] = [];
  private cluckTimer = 0;
  /** Iran's children, chattering away indoors. */
  private siblings?: Siblings;
  /** True during a fight: the clock stops and health doesn't regenerate. */
  inCombat = false;
  /** Birds, rippling water and the like, outdoors only. */
  ambience?: Ambience;
  /** Water dripping from stalactites, in the cave. */
  private drips?: Drips;
  /** What the player would do by pressing E right now, if anything. */
  focus?: Interaction;
  /** A few-seconds action in progress, for the HUD's progress bar. */
  channel?: Channel;
  /** True while a conversation, a menu or a door transition has the controls. */
  busy = false;
  /** The HUD sets this to show short messages. */
  onHint?: HintListener;
  onSign?: SignListener;
  private keys!: MoveKeys;
  private hover!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;
  /** Walking over to something after it was clicked; use it on arrival. */
  private walkingTo?: Interaction;
  /** The seat the player is sitting on, if any. */
  private seat?: Seat;
  private sitTimer = 0;
  private crackleTimer = 0;
  private cropTimer = 0;
  /** Beasts beaten or chased off for good, by spawn id. */
  private defeatedFoes = new Set<string>();
  private arrivalGrace = 0;
  /** Areas visited this game, for first-visit thoughts. */
  private visited = new Set<AreaId>();
  /** A trader's stall to open once the conversation that asked for it closes. */
  private pendingShop?: ShopId;
  /** Off while the player stands on a road exit they just turned back from, so it isn't asked again at once. */
  private exitArmed = true;
  /** The last tile the player stood on that isn't a road exit: where turning back walks them to. */
  private lastOffExit: GridPoint = { x: 0, y: 0 };
  /** Whether the market was open last frame, so the militia can call out when it shuts or opens. */
  private marketWasOpen = true;
  /** Sprinting this frame, which sends shy game running. */
  private sprinting = false;
  /** The patch of ground with a thought attached (MapData.musings) the player is standing in, so it's only had once. */
  private musing?: Musing;
  /** Something to happen once the conversation that led to it closes (the toll gate swinging open). */
  private afterTalk?: () => void;

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
    if (data.load) {
      this.loadSave(data.load);
    } else if (data.newGame || !this.stats) {
      this.stats = new PlayerStats();
      this.clock = new TimeOfDay();
      QuestLog.reset(
        'Woke before dawn to Mother coughing again. She says it is nothing, but she barely touched her supper ' +
          'and her hands were cold as river stones. I should sit with her today.',
      );
      QuestLog.dayProvider = () => this.clock.day;
      Inventory.reset();
      Experience.reset();
      Farm.reset();
      Shops.reset();
      this.defeatedFoes.clear();
      this.visited.clear();
      // Handy for testing: open the game with ?hour=21 to start at 9pm.
      const hourParam = new URLSearchParams(window.location.search).get('hour');
      if (hourParam !== null && !Number.isNaN(Number(hourParam))) this.clock.setHour(Number(hourParam));
    }
    this.area = data.load?.area ?? data.area ?? 'home';
    // Handy for testing: open the game with ?area=market (or world, or cave) to start there.
    const areaParam = new URLSearchParams(window.location.search).get('area');
    if (data.newGame && (['market', 'world', 'cave', 'hut', 'plains'] as const).some((a) => a === areaParam)) this.area = areaParam as AreaId;
    this.busy = false;
    this.walkingTo = undefined;
    this.focus = undefined;
    this.channel = undefined;
    this.seat = undefined;
    this.inCombat = false;
    this.arrivalGrace = ARRIVAL_GRACE;
    this.afterTalk = undefined;
    this.musing = undefined;

    this.map = new IsoMap(this, buildArea(this.area));
    const start = data.load?.position ?? ((data.entry && this.map.data.entries?.[data.entry]) || this.map.data.spawn);
    this.player = new Player(this, this.map, start.x, start.y);
    this.exitArmed = true;
    this.lastOffExit = { x: this.player.tileX, y: this.player.tileY };
    this.npcs = (this.map.data.npcs ?? []).map((n) => new Npc(this, this.map, n.id, n.gx, n.gy, n.commute, this.clock.hour, n.looking));
    this.marketWasOpen = marketOpen(this.clock.hour);
    this.creatures = this.spawnCreatures();
    const hens = this.map.data.hens;
    this.hens = (hens?.flock ?? []).map((h) => new Hen(this, this.map, hens!.pen, h.kind, h.gx, h.gy));
    const children = (this.map.data.children ?? []).map((c) => new Child(this, this.map, c.id, c.gx, c.gy));
    this.siblings = children.length > 0 ? new Siblings(children, SIBLING_BANTER, () => this.siblingHello()) : undefined;
    this.syncCrops();
    this.ambience = this.map.data.indoor ? undefined : new Ambience(this, this.map, this.clock);
    this.drips = this.map.data.drips ? new Drips(this, this.map.data) : undefined;

    this.hover = this.add.image(0, 0, 'tile-highlight').setDepth(1).setAlpha(0.6).setVisible(false);
    this.marker = this.add.image(0, 0, 'tile-highlight').setDepth(1).setTint(0x9cf09c).setVisible(false);

    this.setupCamera();
    this.setupInput();
    GameAudio.playMusic(this.map.data.music ?? 'world');
    this.cameras.main.fadeIn(450, 0, 0, 0);

    if (data.knockedOut) {
      this.time.delayedCall(1200, () => this.onHint?.('I came to on the cottage floor, aching all over. That wolf is still out there.'));
    }
    if (data.slept !== undefined) {
      this.time.delayedCall(1000, () => this.onHint?.(wakingThought(this.clock.hour)));
    } else if (data.load) {
      this.time.delayedCall(1000, () => this.onHint?.('I wake in my own bed. The day is waiting.'));
    }
    if (data.newGame) {
      this.time.delayedCall(1200, () => this.onHint?.('Mother is resting by the hearth. She wants to speak with you.'));
    }
    if (this.area !== 'home') QuestLog.complete('mother-medicine', 'leave');
    if (this.area === 'market' && !this.marketWasOpen) {
      // Turning up after hours: the militia say so.
      this.time.delayedCall(1400, () => this.militiaCall(MILITIA_CALLS.closed));
    }
    if (this.area === 'market' && !this.visited.has('market')) {
      const firstSight = this.marketWasOpen
        ? 'Adowvale at last. Fresh bread, woodsmoke, and the clang of the smithy in the market square.'
        : 'Adowvale at last, but the market stalls are all covered over for the night.';
      this.time.delayedCall(1000, () => this.onHint?.(firstSight));
      QuestLog.writeDiary(
        'Followed the old road all the way to Adowvale. The market square was busier than I remembered, with the militia ' +
          'marching about in their tin hats. Someone here must know where to find moonpetal.',
      );
    }
    if (this.area === 'plains' && !this.visited.has('plains')) {
      this.time.delayedCall(1000, () => this.onHint?.('Open sky at last. The grass runs on for miles, and the wind smells of rain.'));
      QuestLog.writeDiary(
        "Went out through Lord Morten's gate onto Adowvale Plains. I have never seen so much sky. Deer grazing in the long " +
          'grass, the road running off to a crossroads, and not a wall in sight.',
      );
    }
    if (this.area === 'cave') this.enteredCave();
    if (this.area === 'hut' && !this.visited.has('hut')) {
      this.time.delayedCall(900, () => this.onHint?.('Warm, smoky, and loud. Iran was not exaggerating about the children.'));
    }
    // Finding somewhere new is worth a little experience (not the hero's own home).
    if (!this.visited.has(this.area) && !data.newGame && this.area !== 'home') {
      const name = AREA_NAMES[this.area];
      this.time.delayedCall(700, () => Experience.gain(XP_REWARDS.discovery, `Found ${name}`));
    }
    this.visited.add(this.area);
    // A new level brings more maximum health, and the hero gets that much back straight away.
    const offXp = Experience.onChange((e) => {
      if (e.type === 'levelled') this.stats.heal((e.level - e.from) * HEALTH_PER_LEVEL);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offXp);
    // Buying Iran's chicken feed moves his errand on.
    const offItems = Inventory.onChange((e) => {
      if (e.type === 'added' && e.id === 'chicken-feed') QuestLog.complete('chicken-feed', 'buy');
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offItems);
  }

  /** What the children say when the hero walks in: thanks once the hens are fed, a plain hello otherwise. */
  private siblingHello() {
    if (QuestLog.get('chicken-feed')?.completed) return SIBLING_THANKS[0];
    const met = QuestLog.hasFlag('met-iran-children');
    QuestLog.setFlag('met-iran-children');
    return met ? SIBLING_GREETINGS[2] : SIBLING_GREETINGS[Math.floor(Math.random() * 2)];
  }

  /** People besides the NPCs who can say things in speech bubbles (Iran's children), for the HUD. */
  get speakers(): Speaker[] {
    return this.siblings?.speakers ?? [];
  }

  /** Into the wolves' den: the first time, the hero takes it in; on Wil's errand, that step is done. */
  private enteredCave(): void {
    QuestLog.complete('lost-sheep', 'cave');
    if (this.visited.has('cave')) return;
    this.time.delayedCall(1000, () => this.onHint?.('Cold, wet rock, and the stink of wolf. Something has been dragged in here.'));
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const wantsSprint = !this.busy && this.keys.sprint.isDown && this.stats.canSprint();
    const input = this.busy ? { x: 0, y: 0 } : this.readKeyboard();
    const moving = input.x !== 0 || input.y !== 0;
    if (moving) {
      this.walkingTo = undefined;
      if (this.seat) this.standUp();
      if (this.channel) this.cancelChannel();
    }
    this.updateChannel(dt);
    const moved = this.player.update(dt, input, wantsSprint ? SPRINT_MULTIPLIER : 1);
    this.sprinting = wantsSprint && moved;
    for (const npc of this.npcs) npc.update(dt, { x: this.player.gx, y: this.player.gy }, this.busy, this.clock.hour);
    this.updateMarketHours();
    this.ambience?.update(dt, this.cameras.main.worldView, { x: this.player.gx, y: this.player.gy });
    this.drips?.update(dt, { x: this.player.gx, y: this.player.gy });
    // Time stands still while fighting, turn by turn.
    if (!this.inCombat) {
      this.stats.update(dt, wantsSprint && moved);
      this.clock.timeScale = !this.busy && this.keys.fastForward.isDown ? FAST_FORWARD : 1;
      this.clock.update(dt);
    }
    this.updateCreatures(dt);
    this.updateHens(dt);
    this.siblings?.update(dt, { x: this.player.gx, y: this.player.gy }, this.busy);
    this.checkRoadExits();
    this.checkMusings();
    this.updateHover();
    this.updateFocus();
    this.updateSitting(dt);

    this.cropTimer -= dt;
    if (this.cropTimer <= 0) {
      this.syncCrops();
      this.cropTimer = 1;
    }

    if (this.map.data.indoor && !this.map.data.underground) {
      this.crackleTimer -= dt;
      if (this.crackleTimer <= 0) {
        GameAudio.crackle();
        this.crackleTimer = 0.15 + Math.random() * 1.2;
      }
    }
  }

  /** In the market, the militia call out as the stalls shut in the evening and open in the morning. */
  private updateMarketHours(): void {
    if (this.area !== 'market') return;
    const open = marketOpen(this.clock.hour);
    if (open !== this.marketWasOpen) this.militiaCall(open ? MILITIA_CALLS.opening : MILITIA_CALLS.closing);
    this.marketWasOpen = open;
  }

  /** The militiaman nearest the player calls something out. */
  private militiaCall(text: string): void {
    const guards = this.npcs.filter((n) => n.id.startsWith('guard-'));
    const nearest = guards.sort((a, b) => a.distanceTo(this.player.gx, this.player.gy) - b.distanceTo(this.player.gx, this.player.gy))[0];
    nearest?.say(text, 6);
  }

  /** Do whatever is prompted (the E key, or tapping the prompt). */
  interact(): void {
    if (this.busy || this.channel || !this.focus) return;
    this.focus.run();
  }

  openJournal(): void {
    if (!this.takeControls()) return;
    this.scene.launch('Journal');
    this.scene.get('Journal').events.once('journal-closed', () => this.release());
  }

  /** The satchel (inventory) or equipment screen: I and C, or the HUD's satchel button. */
  openInventory(tab: InventoryTab = 'satchel'): void {
    if (!this.takeControls()) return;
    this.scene.launch('Inventory', { tab });
    this.scene.get('Inventory').events.once('inventory-closed', () => this.release());
  }

  /** Eat a piece of food from the satchel. */
  eat(index: number): boolean {
    const stack = Inventory.bag[index];
    const eat = stack && itemDef(stack.id).eat;
    if (!eat) return false;
    Inventory.takeOne(index);
    if (eat.health) this.stats.heal(eat.health);
    if (eat.stamina) this.stats.restoreStamina(eat.stamina);
    GameAudio.crunch();
    return true;
  }

  /** Stops whatever the player is doing so a menu can open. */
  private takeControls(): boolean {
    if (this.busy || !this.scene.isActive()) return false;
    if (this.channel) this.cancelChannel();
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
  private release(): void {
    this.time.delayedCall(80, () => {
      this.busy = false;
    });
  }

  private startConversation(npc: Npc): void {
    if (this.seat) this.standUp();
    this.busy = true;
    this.walkingTo = undefined;
    this.player.setPath([]);
    npc.faceTowards(this.player.gx, this.player.gy);
    this.pendingShop = undefined;
    const data: DialogueSceneData = {
      script: npc.script(),
      onAction: (action) => this.runDialogueAction(action),
    };
    this.scene.launch('Dialogue', data);
    this.scene.get('Dialogue').events.once('dialogue-closed', () => {
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

  /** A trader's stall: buy and sell. Opened from the conversation with them (see dialogue/market.ts). */
  private openShop(shop: ShopId): void {
    this.busy = true;
    this.scene.launch('Shop', { shop });
    this.scene.get('Shop').events.once('shop-closed', () => this.release());
  }

  /** Story effects triggered by lines of dialogue (see dialogue/*.ts). */
  private runDialogueAction(action: string): void {
    if (action.startsWith('shop:') && action.slice(5) in SHOPS) {
      this.pendingShop = action.slice(5) as ShopId;
      return;
    }
    switch (action) {
      case 'start-medicine-quest':
        if (QuestLog.has('mother-medicine')) return;
        QuestLog.start('mother-medicine', ['talk']);
        QuestLog.writeDiary(
          "Mother's cough is worse. She tried to hide the fever from me, but her hands shake too much to hold a cup. " +
            'She needs moonpetal and willow bark tincture. I will find someone in the village who has it.',
        );
        break;
      case 'start-sheep-quest':
        QuestLog.start('lost-sheep', ['talk']);
        QuestLog.writeDiary(
          "Met Wil the drover on the road again, still hunting for his master's two ewes. Something dragged them off " +
            'towards the cave in the hill north of the cottage. He is too scared to look, so I said I would.',
        );
        break;
      case 'start-feed-quest':
        if (QuestLog.has('chicken-feed')) return;
        QuestLog.start('chicken-feed', ['talk']);
        Inventory.reward(FEED_MONEY);
        GameAudio.coins();
        // Bought a sack already, before he asked.
        if (Inventory.count('chicken-feed') > 0) QuestLog.complete('chicken-feed', 'buy');
        QuestLog.writeDiary(
          'Met Farmer Iran up the hill, who keeps the hens. He remembered me as a boy. His hens have gone without feed for ' +
            `two days, so he gave me ${FEED_MONEY} coins to fetch a sack from Hilde at the market.`,
        );
        break;
      case 'finish-feed-quest':
        Inventory.remove('chicken-feed', 1);
        QuestLog.complete('chicken-feed', 'buy');
        QuestLog.complete('chicken-feed', 'return');
        this.give('egg', EGG_REWARD);
        QuestLog.writeDiary(
          "Took Iran his sack of feed. The hens mobbed him before he'd got it open. He sent me off with eggs for Mother, " +
            'and his little girl shouted goodbye from the doorway until I was halfway down the hill.',
        );
        break;
      case 'pay-toll':
        this.payToll();
        break;
      case 'heard-of-monastery':
        if (QuestLog.hasFlag('heard-of-monastery')) return;
        QuestLog.setFlag('heard-of-monastery');
        QuestLog.writeDiary(
          "Met a traveller on the Lord's Road who says the monks of Saint Elda grow moonpetal in their cloister pond, a day's " +
            'walk east of the crossroads. Brother Anselm keeps it dried. If anyone can help Mother, it is them.',
        );
        break;
      case 'finish-sheep-quest':
        // He may hear the news without having asked: the ewes were found first.
        QuestLog.start('lost-sheep', ['talk', 'cave', 'find']);
        QuestLog.complete('lost-sheep', 'tell');
        Inventory.reward(SHEEP_REWARD);
        GameAudio.coins();
        QuestLog.writeDiary(
          `Told Wil about Bess and Bramble. He took it quietly, then pressed ${SHEEP_REWARD} coins into my hand and would not ` +
            'hear of me giving them back. I hope his master is kinder to him than he expects.',
        );
        break;
      default:
        console.warn(`Unknown dialogue action: ${action}`);
    }
  }

  /** The hens peck about by day and roost in the coop at night; now and then one clucks. */
  private updateHens(dt: number): void {
    if (this.hens.length === 0) return;
    const hour = this.clock.hour;
    const roosting = hour >= 21 || hour < 6;
    const player = { x: this.player.gx, y: this.player.gy };
    for (const hen of this.hens) {
      hen.roosting = roosting;
      hen.update(dt, player);
    }
    this.cluckTimer -= dt;
    if (this.cluckTimer > 0 || roosting || this.busy) return;
    this.cluckTimer = 2 + Math.random() * 5;
    // Louder the closer the player is to the run.
    const pen = this.map.data.hens!.pen;
    const d = Math.hypot((pen.x0 + pen.x1) / 2 - player.x, (pen.y0 + pen.y1) / 2 - player.y);
    if (d < 12) GameAudio.cluck(Math.max(0.1, 1 - d / 12));
  }

  // ------------------------------------------------------------ sleeping and saving

  /** Lie down in a bed: choose how long to sleep for, then sleep and save. */
  private goToBed(bed: Bed): void {
    if (!QuestLog.has('mother-medicine')) {
      this.onHint?.("I can't sleep yet. Mother wants to speak with me.");
      return;
    }
    if (!this.takeControls()) return;
    const data: SleepSceneData = { clock: this.clock };
    this.scene.launch('Sleep', data);
    this.scene.get('Sleep').events.once('sleep-closed', (hours?: number) => {
      if (hours) this.sleep(bed, hours);
      else this.release();
    });
  }

  /** Fade to black, let the hours pass, wake rested, and save the game. */
  private sleep(bed: Bed, hours: number): void {
    this.player.setPath([]);
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.clock.advance(hours);
      this.stats.heal(this.stats.maxHealth);
      this.stats.restoreStamina(this.stats.maxStamina);
      const save = this.makeSave(bed);
      SaveGame.write(save);
      // Wake up from the save just made, so waking always matches what loading it later gives.
      this.scene.restart({ load: save, slept: hours } satisfies GameSceneData);
    });
  }

  /** Everything needed to come back to this moment, waking in `bed`. */
  private makeSave(bed: Bed): SaveData {
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      savePoint: bed.id,
      area: this.area,
      position: { x: bed.gx, y: bed.gy },
      hours: this.clock.elapsedHours,
      health: this.stats.health,
      stamina: this.stats.stamina,
      sections: SaveGame.collect(),
    };
  }

  /** Puts the whole game back as it was when a save was made. */
  private loadSave(save: SaveData): void {
    this.stats = new PlayerStats();
    this.stats.health = save.health;
    this.stats.stamina = save.stamina;
    this.clock = new TimeOfDay(save.hours);
    QuestLog.dayProvider = () => this.clock.day;
    SaveGame.restore(save);
  }

  // ------------------------------------------------------------ combat

  private spawnCreatures(): Creature[] {
    const spawns = (this.map.data.creatures ?? []).filter((s) => !this.defeatedFoes.has(s.id));
    // Handy for testing fights against a pack: open the game with ?wolves=3.
    const pack = Number(new URLSearchParams(window.location.search).get('wolves') ?? 1);
    const lead = spawns[0];
    if (lead && pack > 1) {
      const spots = [[1.5, 1], [-1, 1.5], [2, -1.5], [-2, -1], [0, 2.5]];
      for (let i = 0; i < Math.min(pack - 1, spots.length); i++) {
        const gx = lead.gx + spots[i][0];
        const gy = lead.gy + spots[i][1];
        const id = `${lead.id}-pack-${i}`;
        if (!this.defeatedFoes.has(id) && this.map.isWalkable(Math.floor(gx), Math.floor(gy))) spawns.push({ ...lead, id, gx, gy });
      }
    }
    return spawns.map((s) => new Creature(this, this.map, s.id, s.kind, s.gx, s.gy));
  }

  private updateCreatures(dt: number): void {
    this.arrivalGrace = Math.max(0, this.arrivalGrace - dt);
    for (const creature of this.creatures) {
      const watching = !this.busy && this.arrivalGrace <= 0 && this.scene.isActive();
      if (creature.update(dt, watching ? { x: this.player.gx, y: this.player.gy } : undefined, this.sprinting)) this.startCombat(creature);
    }
  }

  /** A beast has spotted the player (or the player has gone after some game): it and any of its pack close by fight. */
  startCombat(first: Creature): void {
    if (this.busy || this.inCombat) {
      first.disengage();
      return;
    }
    if (this.seat) this.standUp();
    if (this.channel) this.cancelChannel();
    this.busy = true;
    this.inCombat = true;
    this.walkingTo = undefined;
    this.player.setPath([]);
    // Only beasts that hunt in packs (wolves) bring the rest of the pack with them.
    const pack = FOES[first.kind].packs;
    const foes = this.creatures.filter(
      (c) => c === first || (pack && c.active && c.kind === first.kind && c.distanceTo(first.gx, first.gy) < PACK_RANGE),
    );
    const hunted = first.huntable;
    foes.forEach((c) => c.engage());
    if (!hunted) GameAudio.growl();
    GameAudio.playMusic('battle');
    const data: CombatSceneData = { foes };
    this.scene.launch('Combat', data);
    this.scene.get('Combat').events.once('combat-ended', (result: CombatResult) => this.endCombat(result, foes));
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

  private endCombat(result: CombatResult, foes: Creature[]): void {
    this.inCombat = false;
    // Gone for good, except the plains' game, which is back the next time the hero comes this way.
    const respawns = new Set((this.map.data.creatures ?? []).filter((s) => s.respawns).map((s) => s.id));
    for (const id of [...result.slain, ...result.fled]) if (!respawns.has(id)) this.defeatedFoes.add(id);
    this.fitCamera();
    if (result.outcome === 'defeat') {
      this.knockedOut();
      return;
    }
    GameAudio.playMusic(this.map.data.music ?? 'world');
    if (result.outcome === 'escaped') {
      foes.forEach((c) => c.disengage());
      this.onHint?.("I got away. Best keep my distance from it for now.");
    } else {
      const slain = foes.filter((c) => result.slain.includes(c.id));
      for (const beast of slain) for (const [item, count] of SPOILS[beast.kind]) this.give(item, count);
      const after = AFTER_THE_FIGHT[foes[0].kind];
      this.onHint?.(slain.length > 0 ? after.slain : after.fled);
      if (this.area === 'cave' && this.creatures.every((c) => !c.active || foes.includes(c))) {
        this.time.delayedCall(2600, () => this.onHint?.('The den is quiet now. Only the dripping water, and something pale at the back of the cave.'));
      }
      if (foes.some((c) => c.id === 'cottage-wolf')) {
        QuestLog.writeDiary(
          'A grey wolf was nosing around the cottage when I stepped out. It went for me, and I had to fight it off. ' +
            'My hands are still shaking. I must not tell Mother; she has enough to worry about.',
        );
      }
    }
    this.release();
  }

  /** Beaten: black out, and come round at home with a little health. */
  private knockedOut(): void {
    this.stats.heal(this.stats.maxHealth * 0.35);
    this.stats.restoreStamina(this.stats.maxStamina);
    this.cameras.main.fadeOut(1200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ area: 'home', knockedOut: true } satisfies GameSceneData);
    });
  }

  // ------------------------------------------------------------ interactions

  /** Everything the player could use from around (gx, gy). */
  private interactionsNear(gx: number, gy: number): Interaction[] {
    const list: Interaction[] = [];
    if (this.seat) {
      // Sitting: the only thing to do is get up.
      const head = this.player.sprite;
      list.push({
        key: 'stand', label: 'Stand up', gx: this.player.gx, gy: this.player.gy, range: Infinity,
        promptX: head.x, promptY: head.y - 44, tile: { x: -1, y: -1 }, run: () => this.standUp(),
      });
      return list;
    }
    for (const npc of this.npcs) if (npc.present) list.push(this.npcInteraction(npc));
    for (const beast of this.creatures) if (beast.huntable) list.push(this.huntInteraction(beast));
    for (const door of this.map.data.doors ?? []) if (!door.auto) list.push(this.doorInteraction(door));
    for (const seat of this.map.data.seats ?? []) list.push(this.seatInteraction(seat));
    for (const sight of this.map.data.sights ?? []) {
      // A pile already searched has nothing more to give.
      if (sight.loot && QuestLog.hasFlag(`searched-${sight.id}`)) continue;
      list.push(this.sightInteraction(sight));
    }
    for (const bed of this.map.data.beds ?? []) list.push(this.bedInteraction(bed));
    for (const crop of this.map.data.crops ?? []) {
      if (Math.abs(crop.tx + 0.5 - gx) < 2 && Math.abs(crop.ty + 0.5 - gy) < 2) {
        const i = this.cropInteraction(crop);
        if (i) list.push(i);
      }
    }
    const tx = Math.floor(gx);
    const ty = Math.floor(gy);
    for (let y = ty - 2; y <= ty + 2; y++) {
      for (let x = tx - 2; x <= tx + 2; x++) {
        const tree = this.treeInteraction(x, y);
        if (tree) list.push(tree);
      }
    }
    return list;
  }

  /** What clicking on a tile would use, if anything. */
  private interactionAt(tile: GridPoint): Interaction | undefined {
    const npc = this.npcs.find((n) => n.present && n.tileX === tile.x && n.tileY === tile.y);
    if (npc) return this.npcInteraction(npc);
    const near = this.interactionsNear(tile.x + 0.5, tile.y + 0.5);
    return near.find((i) => i.tile.x === tile.x && i.tile.y === tile.y);
  }

  private inRange(i: Interaction): boolean {
    return Math.hypot(this.player.gx - i.gx, this.player.gy - i.gy) <= i.range;
  }

  private npcInteraction(npc: Npc): Interaction {
    const head = npc.promptPoint;
    return {
      key: `npc:${npc.id}`, label: 'Talk-to', target: SPEAKERS[npc.id as SpeakerId]?.name, gx: npc.gx, gy: npc.gy, range: npc.talkRange,
      promptX: head.x, promptY: head.y, tile: { x: npc.tileX, y: npc.tileY },
      run: () => this.startConversation(npc),
    };
  }

  /** Go after a deer or a hare: walk up quietly (running sends it off) and the hunt starts as a fight. */
  private huntInteraction(beast: Creature): Interaction {
    const p = gridToScreen(beast.gx, beast.gy);
    return {
      key: `hunt:${beast.id}`, label: 'Hunt', target: beast.name, gx: beast.gx, gy: beast.gy, range: 2.2,
      promptX: p.x, promptY: p.y - beast.sprite.displayHeight * beast.sprite.originY - 4,
      tile: { x: Math.floor(beast.gx), y: Math.floor(beast.gy) },
      run: () => {
        if (beast.huntable) this.startCombat(beast);
      },
    };
  }

  private doorInteraction(door: Door): Interaction {
    // Doors in a wall along the tile's -x edge have the prompt over the doorway; the cave mouth, over its tile.
    const front = door.facing === 'front';
    const p = front ? gridToScreen(door.tx + 0.5, door.ty + 0.5) : gridToScreen(door.tx, door.ty + 0.5);
    return {
      key: `door:${door.tx},${door.ty}`, label: door.label ?? (door.to === 'home' ? 'Go inside' : 'Go outside'),
      gx: door.tx + 0.5, gy: door.ty + 0.5, range: 1.3, promptX: p.x, promptY: p.y - (front ? 62 : 58),
      tile: { x: door.tx, y: door.ty }, walkOnto: true, run: () => this.useDoor(door),
    };
  }

  private sightInteraction(sight: Sight): Interaction {
    const p = gridToScreen(sight.gx, sight.gy);
    return {
      key: `sight:${sight.id}`, label: sight.label, gx: sight.gx, gy: sight.gy, range: 1.5,
      promptX: p.x, promptY: p.y - sight.z, tile: { x: Math.floor(sight.gx), y: Math.floor(sight.gy) },
      run: () => this.examine(sight),
    };
  }

  private seatInteraction(seat: Seat): Interaction {
    const p = gridToScreen(seat.gx, seat.gy);
    return {
      key: `seat:${seat.gx},${seat.gy}`, label: 'Sit', gx: seat.gx, gy: seat.gy, range: 1.3,
      promptX: p.x, promptY: p.y - 26, tile: { x: Math.floor(seat.gx), y: Math.floor(seat.gy) },
      run: () => this.sitOn(seat),
    };
  }

  private bedInteraction(bed: Bed): Interaction {
    const p = gridToScreen(bed.tx + 0.5, bed.ty + 0.5);
    return {
      key: `bed:${bed.id}`, label: 'Sleep', gx: bed.gx, gy: bed.gy, range: 1.2,
      promptX: p.x, promptY: p.y - 30, tile: { x: bed.tx, y: bed.ty },
      run: () => this.goToBed(bed),
    };
  }

  private cropInteraction(crop: CropPatch): Interaction | undefined {
    if (!Farm.isRipe(crop.tx, crop.ty, this.clock.elapsedHours)) return undefined;
    const p = gridToScreen(crop.tx + 0.5, crop.ty + 0.5);
    return {
      key: `crop:${crop.tx},${crop.ty}`, label: CROPS[crop.kind].verb, gx: crop.tx + 0.5, gy: crop.ty + 0.5,
      range: 1.2, promptX: p.x, promptY: p.y - 24, tile: { x: crop.tx, y: crop.ty },
      run: () => this.pickCrop(crop),
    };
  }

  private treeInteraction(tx: number, ty: number): Interaction | undefined {
    if (!this.map.inBounds(tx, ty) || this.map.data.props[ty][tx] !== Prop.Tree) return undefined;
    const tree = this.map.trees.get(ty * this.map.width + tx);
    // Each tree only gives something once a day.
    if (!tree || Farm.wasShakenToday(tx, ty, this.clock.day)) return undefined;
    const p = gridToScreen(tx + 0.5, ty + 0.5);
    return {
      key: `tree:${tx},${ty}`, label: 'Shake the tree', gx: tx + 0.5, gy: ty + 0.5, range: 1.45,
      promptX: p.x, promptY: p.y - 40, tile: { x: tx, y: ty },
      run: () => this.shakeTree(tx, ty, tree.image, tree.pine),
    };
  }

  /** The nearest thing in range becomes the prompt; a clicked target is used on arrival. */
  private updateFocus(): void {
    if (this.busy || this.channel) {
      this.focus = undefined;
      return;
    }
    let best: Interaction | undefined;
    let bestDist = Infinity;
    for (const i of this.interactionsNear(this.player.gx, this.player.gy)) {
      const d = Math.hypot(this.player.gx - i.gx, this.player.gy - i.gy);
      // People come first: someone standing by a tree is more likely to be wanted than the tree.
      const rank = i.key.startsWith('npc:') ? d - 1 : d;
      if (d <= i.range && rank < bestDist) {
        best = i;
        bestDist = rank;
      }
    }
    this.focus = best;
    const target = this.walkingTo;
    if (!target) return;
    // NPCs are greeted as soon as they're in reach; other things once the walk is over.
    const arrived = target.walkOnto
      ? this.player.tileX === target.tile.x && this.player.tileY === target.tile.y
      : this.inRange(target) && (target.key.startsWith('npc:') || !this.player.hasPath);
    if (arrived) {
      this.walkingTo = undefined;
      this.player.setPath([]);
      target.run();
    } else if (!this.player.hasPath) {
      this.walkingTo = undefined;
    }
  }

  // ------------------------------------------------------------ actions

  private startChannel(channel: Omit<Channel, 'elapsed'>, towards: Vec2): void {
    this.walkingTo = undefined;
    this.channel = { ...channel, elapsed: 0 };
    this.player.setWorking(true, towards);
  }

  private updateChannel(dt: number): void {
    const c = this.channel;
    if (!c || this.busy) return;
    c.elapsed += dt;
    if (c.elapsed < c.seconds) return;
    this.channel = undefined;
    this.player.setWorking(false);
    c.onDone();
  }

  private cancelChannel(): void {
    const c = this.channel;
    if (!c) return;
    this.channel = undefined;
    this.player.setWorking(false);
    c.onCancel?.();
  }

  private pickCrop(crop: CropPatch): void {
    const item = CROPS[crop.kind].item;
    if (!Inventory.canAdd(item)) {
      this.onHint?.('My satchel is full. I should eat something, or leave it for later.');
      return;
    }
    GameAudio.rustle();
    this.startChannel(
      {
        label: 'Picking',
        seconds: PICK_SECONDS,
        onDone: () => {
          Farm.pick(crop.tx, crop.ty, this.clock.elapsedHours);
          this.syncCrops();
          this.give(item, crop.kind === 'cabbage' ? 1 : 2);
        },
      },
      { x: crop.tx + 0.5, y: crop.ty + 0.5 },
    );
  }

  private shakeTree(tx: number, ty: number, image: Phaser.GameObjects.Image, pine: boolean): void {
    // The tree sways (pivoting at its base) while leaves drift down.
    const sway = this.tweens.add({ targets: image, angle: { from: -3, to: 3 }, duration: 110, yoyo: true, repeat: -1 });
    const leaves = this.time.addEvent({ delay: 140, loop: true, callback: () => this.dropLeaf(image, pine) });
    const stop = () => {
      sway.stop();
      leaves.remove();
      this.tweens.add({ targets: image, angle: 0, duration: 200 });
    };
    GameAudio.rustle();
    this.startChannel(
      {
        label: 'Shaking',
        seconds: 1.4,
        onCancel: stop,
        onDone: () => {
          stop();
          Farm.shake(tx, ty, this.clock.day);
          const roll = Math.random();
          const found: ItemId | undefined = pine ? (roll < 0.7 ? 'pinecone' : undefined) : roll < 0.55 ? 'apple' : roll < 0.8 ? 'stick' : undefined;
          if (found) this.give(found, 1);
          else this.onHint?.(pine ? 'Only a shower of needles.' : 'Just a few leaves. Nothing worth keeping.');
        },
      },
      { x: tx + 0.5, y: ty + 0.5 },
    );
  }

  /** A leaf (or needle) falling from somewhere in a tree's canopy. */
  private dropLeaf(tree: Phaser.GameObjects.Image, pine: boolean): void {
    const x = tree.x + (Math.random() - 0.5) * tree.width * 0.7;
    const y = tree.y - tree.height * (0.45 + Math.random() * 0.4);
    const colors = pine ? [0x24503a, 0x37704a] : [0x5c9e48, 0x8cc456, 0x3e7a3e];
    const leaf = this.add.rectangle(x, y, 2, 2, colors[Math.floor(Math.random() * colors.length)]).setDepth(tree.depth + 1);
    this.tweens.add({
      targets: leaf,
      y: tree.y - 2 + Math.random() * 6,
      x: x + (Math.random() - 0.5) * 24,
      angle: 180,
      alpha: { from: 1, to: 0.2 },
      duration: 700 + Math.random() * 500,
      ease: 'Sine.easeIn',
      onComplete: () => leaf.destroy(),
    });
  }

  /** Look closely at something: a signpost, a pile of bones, the remains of Wil's ewes in the cave. */
  private examine(sight: Sight): void {
    this.walkingTo = undefined;
    this.player.setPath([]);
    this.player.faceTowards(sight.gx, sight.gy);
    if (sight.sign) {
      GameAudio.click();
      this.onSign?.(sight.sign.heading, sight.sign.lines);
      return;
    }
    if (sight.loot) {
      this.search(sight);
      return;
    }
    if (sight.locked) {
      this.tryLockedDoor();
      return;
    }
    const flag = `saw-${sight.id}`;
    const first = !QuestLog.hasFlag(flag);
    QuestLog.setFlag(flag);
    const asked = QuestLog.has('lost-sheep');
    const thoughts: Record<string, string> = {
      bess: asked
        ? 'A ewe, torn open and cold. There is a little bell on a cord round her neck, scratched "BESS". Poor Wil.'
        : 'A dead ewe, torn open and cold. A bell round her neck is scratched with a name: "BESS".',
      bramble: asked
        ? 'Another ewe, just beyond the first. This must be Bramble. She followed Bess right to the end.'
        : 'Another dead ewe, wool matted with blood. Someone has lost two sheep, and wolves have found them.',
    };
    if (!first) {
      this.onHint?.('I would rather not look again. Wil should hear what happened.');
      return;
    }
    this.onHint?.(thoughts[sight.id] ?? 'Nothing worth a closer look.');
    if (!QuestLog.hasFlag('saw-bess') || !QuestLog.hasFlag('saw-bramble')) return;
    if (asked) {
      QuestLog.complete('lost-sheep', 'cave');
      QuestLog.complete('lost-sheep', 'find');
    }
    QuestLog.writeDiary(
      asked
        ? 'Found Bess and Bramble at the back of the wolves\' cave. The wolves got them both. I will have to tell Wil; ' +
            'I would rather he heard it from me than found them like that.'
        : 'Found two dead ewes at the back of a wolves\' den in the hill, a bell on one scratched "BESS". Someone on the road ' +
            'must be missing them.',
    );
  }

  /**
   * The door at the back of the wolves' cave: it won't open, and the hero
   * notes it in the diary the first time. A hint of things to come.
   */
  private tryLockedDoor(): void {
    GameAudio.rattle();
    if (QuestLog.hasFlag('found-cave-door')) {
      this.onHint?.('Still locked fast. Whoever has the key to this, it is not me.');
      return;
    }
    QuestLog.setFlag('found-cave-door');
    this.onHint?.(
      'A door, deep in the hill: old oak bound with iron, and a lock as big as my hand. It will not budge. ' +
        'Someone went to a lot of trouble to keep something in. Or out.',
    );
    QuestLog.writeDiary(
      'There is a door at the back of the wolves\' cave, set right into the rock. Old oak, iron straps, a great lock, ' +
        'and no key anywhere. Who would build a door down there? I mean to find out what is behind it.',
    );
  }

  /** Rummage through something (a pile of bones) for a random find. Each can only be searched once. */
  private search(sight: Sight): void {
    GameAudio.rustle();
    this.startChannel(
      {
        label: 'Searching',
        seconds: 1.6,
        onDone: () => {
          const find = rollLoot(sight.loot!);
          // Leave it be if there's no room, so it can be searched again once there is.
          if (find.item && !Inventory.canAdd(find.item)) {
            this.onHint?.('There is something under the bones, but my satchel is full.');
            return;
          }
          QuestLog.setFlag(`searched-${sight.id}`);
          if (find.item) this.give(find.item, 1);
          if (find.coins) {
            Inventory.reward(find.coins);
            GameAudio.coins();
          }
          this.onHint?.(find.text);
        },
      },
      { x: sight.gx, y: sight.gy },
    );
  }

  /** Adds items to the satchel, or says why not. The HUD shows what was gained. */
  private give(id: ItemId, count: number): void {
    if (Inventory.add(id, count)) GameAudio.pickup();
    else if (Inventory.add(id, 1)) GameAudio.pickup();
    else this.onHint?.('My satchel is full.');
  }

  private sitOn(seat: Seat): void {
    this.walkingTo = undefined;
    this.seat = seat;
    this.sitTimer = 0;
    this.player.sitAt(seat.gx, seat.gy, { x: seat.faceX, y: seat.faceY });
  }

  private standUp(): void {
    const seat = this.seat;
    if (!seat) return;
    this.seat = undefined;
    this.player.standAt(seat.standX, seat.standY);
  }

  /** Sitting for a little while brings on a passing thought. */
  private updateSitting(dt: number): void {
    if (!this.seat || this.busy) return;
    const before = this.sitTimer;
    this.sitTimer += dt;
    if (before < 3 && this.sitTimer >= 3) {
      const closed = this.area === 'market' && !marketOpen(this.clock.hour);
      const thoughts = SITTING_THOUGHTS[closed ? `${this.seat.name}-closed` : this.seat.name] ?? [];
      if (thoughts.length > 0) this.onHint?.(thoughts[Math.floor(Math.random() * thoughts.length)]);
    }
  }

  /** Show each crop as ripe or freshly picked; picked ones grow back over time. */
  private syncCrops(): void {
    for (const crop of this.map.data.crops ?? []) {
      const img = this.map.crops.get(crop.ty * this.map.width + crop.tx);
      const key = cropKey(crop.kind, Farm.isRipe(crop.tx, crop.ty, this.clock.elapsedHours));
      if (img && img.texture.key !== key) img.setTexture(key);
    }
  }

  /** Walking off the end of a road at the edge of the map goes on to the next area. */
  private checkRoadExits(): void {
    if (this.busy) return;
    const { tileX, tileY } = this.player;
    const exit = this.map.data.doors?.find((d) => d.auto && d.tx === tileX && d.ty === tileY);
    if (!exit) {
      this.exitArmed = true;
      this.lastOffExit = { x: tileX, y: tileY };
    } else if (this.exitArmed) {
      this.useDoor(exit);
    }
  }

  /** Stepping into a patch of ground with a thought attached (where a road runs on off the map) brings it on, once each time. */
  private checkMusings(): void {
    const { gx, gy } = this.player;
    const here = this.map.data.musings?.find((m) => gx >= m.x0 && gx < m.x1 && gy >= m.y0 && gy < m.y1);
    if (here && here !== this.musing && !this.busy) this.onHint?.(here.text);
    this.musing = here;
  }

  /**
   * Paying Lord Morten's tithe at the toll gate: the coins go, the gate swings
   * open as the conversation ends, and it stays open from then on (the flag
   * is saved with the quest log, and Adowvale is built with the gate open).
   */
  private payToll(): void {
    if (QuestLog.hasFlag('paid-toll')) return;
    if (!Inventory.addCoins(-TOLL)) {
      this.onHint?.("I'm short of the toll. I'll need more coins than that.");
      return;
    }
    QuestLog.setFlag('paid-toll');
    GameAudio.coins();
    QuestLog.writeDiary(
      `Paid Lord Morten's toll guards ${TOLL} coins to use the gate north of Adowvale. A tithe, they called it. ` +
        "Robbery, Mother would call it. Still, the gate is open to me now, and the Lord's Road beyond.",
    );
    this.afterTalk = () => {
      const gate = this.map.data.objects?.find((o) => o.key === 'toll-gate');
      if (!gate) return;
      const open = tollGateShape(true);
      GameAudio.door();
      this.map.reshapeObject(gate, 'toll-gate-open', open.shapes, open.blocks);
      this.time.delayedCall(200, () => this.onHint?.('The guards heave the gate open. Beyond it, the road runs out into open country.'));
    };
  }

  private useDoor(door: Door): void {
    if (this.area === 'home' && !QuestLog.has('mother-medicine')) {
      // Don't let the story start without its first scene.
      this.onHint?.("I shouldn't go anywhere before I've spoken with Mother.");
      return;
    }
    if (door.ask) this.askBeforeLeaving(door);
    else this.leaveThrough(door);
  }

  /** "Do you want to make the trek to...?" Yes goes; no turns back. */
  private askBeforeLeaving(door: Door): void {
    if (!this.takeControls()) return;
    if (this.seat) this.standUp();
    const data: ConfirmSceneData = {
      question: door.ask!,
      note: door.travelHours ? this.trekNote(door) : undefined,
      yes: 'Set off',
      no: 'Not yet',
      onAnswer: (yes) => (yes ? this.leaveThrough(door) : this.turnBack(door)),
    };
    this.scene.launch('Confirm', data);
  }

  /** "It's about 2 hours on foot: I'd get there around 14:00." And a warning if the market will be shut by then. */
  private trekNote(door: Door): string {
    const hours = door.travelHours!;
    const arrive = this.clock.hour + hours;
    let note = `It's about ${hours} hour${hours === 1 ? '' : 's'} on foot: I'd get there around ${clockText(arrive)}.`;
    if (door.to === 'market' && !marketOpen(Phaser.Math.Wrap(arrive, 0, 24))) note += ' The market will be shut by then.';
    return note;
  }

  /** Changed their mind at a road's end: step back off it, so the question isn't asked again straight away. */
  private turnBack(door: Door): void {
    this.release();
    if (!door.auto) return;
    this.exitArmed = false;
    const path = this.pathTo(this.lastOffExit);
    if (path) this.player.setPath(path);
  }

  private leaveThrough(door: Door): void {
    this.busy = true;
    this.player.setPath([]);
    // Only real doors creak: not the end of a road, nor the mouth of a cave.
    if (!door.auto && door.facing !== 'front' && !this.map.data.underground) GameAudio.door();
    this.cameras.main.fadeOut(door.auto ? 500 : 350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // The long road takes a while: the clock moves on before the next area is built, so it arrives at the right hour.
      if (door.travelHours) this.clock.advance(door.travelHours);
      this.scene.restart({ area: door.to, entry: door.entry } satisfies GameSceneData);
    });
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    // Pixel art looks best zoomed in, but phones need to see more of the map.
    cam.setZoom(Phaser.Math.Clamp(this.scale.width / 640, 1, CAMERA_ZOOM.default));
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
  private fitCamera(): void {
    const cam = this.cameras.main;
    const b = this.map.getWorldBounds();
    const w = Math.max(b.width, this.scale.width / cam.zoom);
    const h = Math.max(b.height, this.scale.height / cam.zoom);
    cam.setBounds(Math.round(b.centerX - w / 2), Math.round(b.centerY - h / 2), Math.ceil(w), Math.ceil(h));
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D,
      sprint: K.SHIFT, fastForward: K.T,
    }) as MoveKeys;

    kb.on('keydown-ESC', () => this.openPauseMenu());
    kb.on('keydown-E', () => this.interact());
    kb.on('keydown-ENTER', () => this.interact());
    kb.on('keydown-J', () => this.openJournal());
    kb.on('keydown-I', () => this.openInventory('satchel'));
    kb.on('keydown-C', () => this.openInventory('equipment'));

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.busy) return;
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), CAMERA_ZOOM.min, CAMERA_ZOOM.max));
      this.fitCamera();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.busy) return;
      const tile = this.pointerTile(pointer);
      if (this.channel) this.cancelChannel();
      // Clicking a person or thing walks over to it and uses it.
      const target = this.interactionAt(tile);
      if (this.seat) {
        if (target?.key === 'stand') return;
        this.standUp();
      }
      if (target) {
        if (this.inRange(target) && !target.walkOnto) {
          this.walkingTo = undefined;
          this.player.setPath([]);
          target.run();
          return;
        }
        const path = target.walkOnto ? this.pathTo(target.tile) : this.pathNextTo(target.tile);
        if (path) {
          this.walkingTo = target;
          this.player.setPath(path);
          if (path.length === 0) this.updateFocus();
        }
        return;
      }
      this.walkingTo = undefined;
      const route = this.routeTo(this.pointerPoint(pointer));
      if (!route) return;
      this.player.setPath(route.path, route.end);
      const c = gridToScreen(tile.x + 0.5, tile.y + 0.5);
      this.marker.setPosition(c.x, c.y).setVisible(true);
      this.tweens.killTweensOf(this.marker);
      this.marker.setAlpha(1);
      this.tweens.add({ targets: this.marker, alpha: 0, duration: 900, onComplete: () => this.marker.setVisible(false) });
    });
  }

  /**
   * Tile path from the player to a tile. Diagonal steps may squeeze between
   * two blocked tiles when there's room for the player in between (two tree
   * trunks, say), since collisions follow each thing's real outline.
   */
  private pathTo(tile: GridPoint): GridPoint[] | null {
    const start = this.startTile();
    const clear = PLAYER_RADIUS + 0.03;
    const path = findPath(
      start,
      tile,
      this.map.width,
      this.map.height,
      (x, y) => this.map.isWalkable(x, y),
      5000,
      (x, y, dx, dy) => this.map.segmentClear({ x: x + 0.5, y: y + 0.5 }, { x: x + dx + 0.5, y: y + dy + 0.5 }, clear),
    );
    if (!path) return null;
    // Starting beside a fence or trunk: step onto the open tile next to it first.
    return start.x === this.player.tileX && start.y === this.player.tileY ? path : [start, ...path];
  }

  /**
   * Where pathfinding starts: the player's tile, or, if they've squeezed onto
   * part of a tile with a fence or tree on it, the nearest open tile they can
   * step straight onto.
   */
  private startTile(): GridPoint {
    const { gx, gy, tileX, tileY } = this.player;
    if (this.map.isWalkable(tileX, tileY)) return { x: tileX, y: tileY };
    let best: GridPoint | undefined;
    let bestDist = Infinity;
    for (let y = tileY - 1; y <= tileY + 1; y++) {
      for (let x = tileX - 1; x <= tileX + 1; x++) {
        if (!this.map.isWalkable(x, y)) continue;
        const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
        if (d < bestDist && this.map.segmentClear({ x: gx, y: gy }, { x: x + 0.5, y: y + 0.5 }, PLAYER_RADIUS)) {
          best = { x, y };
          bestDist = d;
        }
      }
    }
    return best ?? { x: tileX, y: tileY };
  }

  /**
   * A route to the exact spot that was clicked. The spot may be in the open
   * part of a tile with a tree or a fence on it, which pathfinding (working in
   * whole tiles) can't go to, so the route goes to the open tile beside it and
   * then straight to the spot.
   */
  private routeTo(point: Vec2): { path: GridPoint[]; end?: Vec2 } | null {
    const tile = { x: Math.floor(point.x), y: Math.floor(point.y) };
    const open = !this.map.blocked(point.x, point.y, PLAYER_RADIUS, false);
    if (this.map.isWalkable(tile.x, tile.y)) {
      const path = this.pathTo(tile);
      // A spot too close to a wall to stand on: settle for the middle of its tile.
      return path && { path, end: open ? point : undefined };
    }
    if (!open) return null;
    const besides: GridPoint[] = [];
    for (let y = tile.y - 1; y <= tile.y + 1; y++) {
      for (let x = tile.x - 1; x <= tile.x + 1; x++) {
        if (this.map.isWalkable(x, y) && this.map.segmentClear({ x: x + 0.5, y: y + 0.5 }, point, PLAYER_RADIUS)) {
          besides.push({ x, y });
        }
      }
    }
    besides.sort((a, b) => Math.hypot(a.x + 0.5 - point.x, a.y + 0.5 - point.y) - Math.hypot(b.x + 0.5 - point.x, b.y + 0.5 - point.y));
    for (const t of besides) {
      const path = this.pathTo(t);
      if (path) return { path, end: point };
    }
    return null;
  }

  /** Shortest path to any free tile beside a tile (an NPC, a crop, a tree). Straight neighbours first. */
  private pathNextTo(tile: GridPoint): GridPoint[] | null {
    let best: GridPoint[] | null = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const path = this.pathTo({ x: tile.x + dx, y: tile.y + dy });
      if (path && (!best || path.length < best.length)) best = path;
    }
    return best;
  }

  /**
   * Screen-relative controls: "up" moves up the screen, which in grid space
   * is diagonal (-x, -y). Returns a normalised grid-space direction.
   */
  private readKeyboard(): Vec2 {
    const k = this.keys;
    const sx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const sy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    if (sx === 0 && sy === 0) return { x: 0, y: 0 };
    const gx = sx + sy;
    const gy = sy - sx;
    const len = Math.hypot(gx, gy);
    return { x: gx / len, y: gy / len };
  }

  private pointerTile(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    const g = this.pointerPoint(pointer);
    return { x: Math.floor(g.x), y: Math.floor(g.y) };
  }

  /** The exact grid point under the pointer. */
  private pointerPoint(pointer: Phaser.Input.Pointer): Vec2 {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return screenToGrid(world.x, world.y);
  }

  private updateHover(): void {
    const tile = this.pointerTile(this.input.activePointer);
    if (this.busy || !this.map.inBounds(tile.x, tile.y)) {
      this.hover.setVisible(false);
      return;
    }
    const c = gridToScreen(tile.x + 0.5, tile.y + 0.5);
    const usable = !!this.interactionAt(tile);
    this.hover
      .setPosition(c.x, c.y)
      .setTint(usable ? 0xffe08a : this.map.isWalkable(tile.x, tile.y) ? 0xffffff : 0xff6b6b)
      .setVisible(true);
  }
}
