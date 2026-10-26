import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { CAMERA_ZOOM, FAST_FORWARD, MAP_HEIGHT, MAP_SEED, MAP_WIDTH, PLAYER_RADIUS, SPRINT_MULTIPLIER } from '../config';
import { Creature } from '../entities/Creature';
import { Npc } from '../entities/Npc';
import { Player } from '../entities/Player';
import { gridToScreen, screenToGrid, Vec2 } from '../iso/IsoMath';
import { CROPS, Farm, PICK_SECONDS } from '../systems/Farm';
import { Inventory, ItemId, itemDef } from '../systems/Inventory';
import { findPath, GridPoint } from '../systems/Pathfinding';
import { PlayerStats } from '../systems/PlayerStats';
import { QuestLog } from '../systems/Quests';
import { ShopId, Shops, SHOPS } from '../systems/Shops';
import { TimeOfDay } from '../systems/TimeOfDay';
import { buildCaveMap } from '../world/CaveMap';
import { Drips } from '../world/Drips';
import { buildHomeMap } from '../world/HomeMap';
import { buildMarketMap } from '../world/MarketMap';
import { Ambience } from '../world/Ambience';
import { IsoMap } from '../world/IsoMap';
import { AreaId, CropPatch, Door, MapData, Prop, Seat, Sight } from '../world/MapData';
import { cropKey } from '../art/farm';
import type { InventoryTab } from './InventoryScene';
import { generateMap } from '../world/MapGenerator';
import type { DialogueSceneData } from './DialogueScene';
import type { CombatResult, CombatSceneData } from './CombatScene';

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
}

/** Things the HUD can show the player as a speech-like hint. */
export type HintListener = (text: string) => void;

/**
 * Something the player can do where they stand: talk to someone, use a door,
 * sit down, pick crops, shake a tree. The nearest one in range gets an
 * "E  <label>" prompt over it; E, Enter, or tapping the prompt does it.
 */
export interface Interaction {
  /** Identifies it across frames, e.g. "crop:24,22". */
  key: string;
  label: string;
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
  'market-bench': [
    'The smell of fresh bread drifts over from the bakehouse stall.',
    'Somewhere a cart rattles over the cobbles. Two women are arguing about the price of eggs.',
    'Clang, clang, clang. The smith is at it again.',
  ],
};

/** Builds the map for an area. */
function buildArea(area: AreaId): MapData {
  if (area === 'home') return buildHomeMap();
  if (area === 'market') return buildMarketMap();
  if (area === 'cave') return buildCaveMap();
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

  constructor() {
    super('Game');
  }

  create(data: GameSceneData = {}): void {
    if (data.newGame || !this.stats) {
      this.stats = new PlayerStats();
      this.clock = new TimeOfDay();
      QuestLog.reset(
        'Woke before dawn to Mother coughing again. She says it is nothing, but she barely touched her supper ' +
          'and her hands were cold as river stones. I should sit with her today.',
      );
      QuestLog.dayProvider = () => this.clock.day;
      Inventory.reset();
      Farm.reset();
      Shops.reset();
      this.defeatedFoes.clear();
      this.visited.clear();
      // Handy for testing: open the game with ?hour=21 to start at 9pm.
      const hourParam = new URLSearchParams(window.location.search).get('hour');
      if (hourParam !== null && !Number.isNaN(Number(hourParam))) this.clock.setHour(Number(hourParam));
    }
    this.area = data.area ?? 'home';
    // Handy for testing: open the game with ?area=market (or world, or cave) to start there.
    const areaParam = new URLSearchParams(window.location.search).get('area');
    if (data.newGame && (areaParam === 'market' || areaParam === 'world' || areaParam === 'cave')) this.area = areaParam;
    this.busy = false;
    this.walkingTo = undefined;
    this.focus = undefined;
    this.channel = undefined;
    this.seat = undefined;
    this.inCombat = false;
    this.arrivalGrace = ARRIVAL_GRACE;

    this.map = new IsoMap(this, buildArea(this.area));
    const start = (data.entry && this.map.data.entries?.[data.entry]) || this.map.data.spawn;
    this.player = new Player(this, this.map, start.x, start.y);
    this.npcs = (this.map.data.npcs ?? []).map((n) => new Npc(this, this.map, n.id, n.gx, n.gy));
    this.creatures = this.spawnCreatures();
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
    if (data.newGame) {
      this.time.delayedCall(1200, () => this.onHint?.('Mother is resting by the hearth. She wants to speak with you.'));
    }
    if (this.area !== 'home') QuestLog.complete('mother-medicine', 'leave');
    if (this.area === 'market' && !this.visited.has('market')) {
      this.time.delayedCall(1000, () => this.onHint?.('The market at last. Fresh bread, woodsmoke, and the clang of the smithy.'));
      QuestLog.writeDiary(
        'Followed the old road all the way to the market. The square was busier than I remembered, with the militia ' +
          'marching about in their tin hats. Someone here must know where to find moonpetal.',
      );
    }
    if (this.area === 'cave') this.enteredCave();
    this.visited.add(this.area);
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
    for (const npc of this.npcs) npc.update(dt, { x: this.player.gx, y: this.player.gy }, this.busy);
    this.ambience?.update(dt, this.cameras.main.worldView, { x: this.player.gx, y: this.player.gy });
    this.drips?.update(dt, { x: this.player.gx, y: this.player.gy });
    // Time stands still while fighting, turn by turn.
    if (!this.inCombat) {
      this.stats.update(dt, wantsSprint && moved);
      this.clock.timeScale = !this.busy && this.keys.fastForward.isDown ? FAST_FORWARD : 1;
      this.clock.update(dt);
    }
    this.updateCreatures(dt);
    this.checkRoadExits();
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
      if (creature.update(dt, watching ? { x: this.player.gx, y: this.player.gy } : undefined)) this.startCombat(creature);
    }
  }

  /** A beast has spotted the player: it and any of its pack close by attack. */
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
    const foes = this.creatures.filter((c) => c === first || (c.active && c.distanceTo(first.gx, first.gy) < PACK_RANGE));
    foes.forEach((c) => c.engage());
    GameAudio.growl();
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
    for (const id of [...result.slain, ...result.fled]) this.defeatedFoes.add(id);
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
      if (result.slain.length > 0) this.give('wolf-pelt', result.slain.length);
      this.onHint?.(
        result.slain.length > 0
          ? 'It lies still now. The pelt might be worth something in the village.'
          : 'It ran off into the trees. I doubt it will come back.',
      );
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
    for (const npc of this.npcs) list.push(this.npcInteraction(npc));
    for (const door of this.map.data.doors ?? []) if (!door.auto) list.push(this.doorInteraction(door));
    for (const seat of this.map.data.seats ?? []) list.push(this.seatInteraction(seat));
    for (const sight of this.map.data.sights ?? []) list.push(this.sightInteraction(sight));
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
    const npc = this.npcs.find((n) => n.tileX === tile.x && n.tileY === tile.y);
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
      key: `npc:${npc.id}`, label: 'Talk', gx: npc.gx, gy: npc.gy, range: npc.talkRange,
      promptX: head.x, promptY: head.y, tile: { x: npc.tileX, y: npc.tileY },
      run: () => this.startConversation(npc),
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

  /** Look closely at something: so far, the remains of Wil's ewes in the cave. */
  private examine(sight: Sight): void {
    this.walkingTo = undefined;
    this.player.setPath([]);
    this.player.faceTowards(sight.gx, sight.gy);
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
      const thoughts = SITTING_THOUGHTS[this.seat.name] ?? [];
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
    if (exit) this.useDoor(exit);
  }

  private useDoor(door: Door): void {
    if (this.area === 'home' && !QuestLog.has('mother-medicine')) {
      // Don't let the story start without its first scene.
      this.onHint?.("I shouldn't go anywhere before I've spoken with Mother.");
      return;
    }
    this.busy = true;
    this.player.setPath([]);
    if (!door.auto) GameAudio.door();
    this.cameras.main.fadeOut(door.auto ? 500 : 350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
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
