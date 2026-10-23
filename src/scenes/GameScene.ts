import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { CAMERA_ZOOM, FAST_FORWARD, MAP_HEIGHT, MAP_SEED, MAP_WIDTH, SPRINT_MULTIPLIER } from '../config';
import { Npc, TALK_RANGE } from '../entities/Npc';
import { Player } from '../entities/Player';
import { gridToScreen, screenToGrid, Vec2 } from '../iso/IsoMath';
import { findPath, GridPoint } from '../systems/Pathfinding';
import { PlayerStats } from '../systems/PlayerStats';
import { QuestLog } from '../systems/Quests';
import { TimeOfDay } from '../systems/TimeOfDay';
import { buildHomeMap } from '../world/HomeMap';
import { IsoMap } from '../world/IsoMap';
import { AreaId, Door } from '../world/MapData';
import { generateMap } from '../world/MapGenerator';
import type { DialogueSceneData } from './DialogueScene';

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
}

/** Things the HUD can show the player as a speech-like hint. */
export type HintListener = (text: string) => void;

export class GameScene extends Phaser.Scene {
  map!: IsoMap;
  player!: Player;
  stats!: PlayerStats;
  clock!: TimeOfDay;
  area: AreaId = 'home';
  npcs: Npc[] = [];
  /** The NPC close enough to talk to right now, if any. */
  talkTarget?: Npc;
  /** True while a conversation, the journal or a door transition has the controls. */
  busy = false;
  /** The HUD sets this to show short messages. */
  onHint?: HintListener;
  private keys!: MoveKeys;
  private hover!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;
  /** Walking over to someone after they were clicked; talk on arrival. */
  private walkingTo?: Npc;
  /** Ignore doors until the player has stepped off the one they arrived by. */
  private doorArmed = false;
  private crackleTimer = 0;

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
      // Handy for testing: open the game with ?hour=21 to start at 9pm.
      const hourParam = new URLSearchParams(window.location.search).get('hour');
      if (hourParam !== null && !Number.isNaN(Number(hourParam))) this.clock.setHour(Number(hourParam));
    }
    this.area = data.area ?? 'home';
    this.busy = false;
    this.walkingTo = undefined;
    this.talkTarget = undefined;
    this.doorArmed = false;

    this.map = new IsoMap(this, this.area === 'home' ? buildHomeMap() : generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED));
    const start = (data.entry && this.map.data.entries?.[data.entry]) || this.map.data.spawn;
    this.player = new Player(this, this.map, start.x, start.y);
    this.npcs = (this.map.data.npcs ?? []).map((n) => new Npc(this, this.map, n.id, n.gx, n.gy));

    this.hover = this.add.image(0, 0, 'tile-highlight').setDepth(1).setAlpha(0.6).setVisible(false);
    this.marker = this.add.image(0, 0, 'tile-highlight').setDepth(1).setTint(0x9cf09c).setVisible(false);

    this.setupCamera();
    this.setupInput();
    GameAudio.playMusic(this.area === 'home' ? 'home' : 'world');
    this.cameras.main.fadeIn(450, 0, 0, 0);

    if (data.newGame) {
      this.time.delayedCall(1200, () => this.onHint?.('Mother is resting by the hearth. She wants to speak with you.'));
    }
    if (this.area === 'world') QuestLog.complete('mother-medicine', 'leave');
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const wantsSprint = !this.busy && this.keys.sprint.isDown && this.stats.canSprint();
    const input = this.busy ? { x: 0, y: 0 } : this.readKeyboard();
    if (input.x !== 0 || input.y !== 0) this.walkingTo = undefined;
    const moved = this.player.update(dt, input, wantsSprint ? SPRINT_MULTIPLIER : 1);
    this.stats.update(dt, wantsSprint && moved);
    this.clock.timeScale = !this.busy && this.keys.fastForward.isDown ? FAST_FORWARD : 1;
    this.clock.update(dt);
    this.updateHover();
    this.updateTalkTarget();
    this.checkDoors();

    if (this.map.data.indoor) {
      this.crackleTimer -= dt;
      if (this.crackleTimer <= 0) {
        GameAudio.crackle();
        this.crackleTimer = 0.15 + Math.random() * 1.2;
      }
    }
  }

  /** Talk to whoever is in range (the E key, or tapping the prompt). */
  interact(): void {
    if (this.busy || !this.talkTarget) return;
    this.startConversation(this.talkTarget);
  }

  openJournal(): void {
    if (this.busy || !this.scene.isActive()) return;
    this.busy = true;
    this.player.setPath([]);
    this.scene.launch('Journal');
    this.scene.get('Journal').events.once('journal-closed', () => this.release());
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
    this.busy = true;
    this.walkingTo = undefined;
    this.player.setPath([]);
    npc.faceTowards(this.player.gx, this.player.gy);
    const data: DialogueSceneData = {
      script: npc.script(),
      onAction: (action) => this.runDialogueAction(action),
    };
    this.scene.launch('Dialogue', data);
    this.scene.get('Dialogue').events.once('dialogue-closed', () => this.release());
  }

  /** Story effects triggered by lines of dialogue (see dialogue/*.ts). */
  private runDialogueAction(action: string): void {
    switch (action) {
      case 'start-medicine-quest':
        if (QuestLog.has('mother-medicine')) return;
        QuestLog.start('mother-medicine', ['talk']);
        QuestLog.writeDiary(
          "Mother's cough is worse. She tried to hide the fever from me, but her hands shake too much to hold a cup. " +
            'She needs moonpetal and willow bark tincture. I will find someone in the village who has it.',
        );
        break;
      default:
        console.warn(`Unknown dialogue action: ${action}`);
    }
  }

  private updateTalkTarget(): void {
    let best: Npc | undefined;
    let bestDist = TALK_RANGE;
    for (const npc of this.npcs) {
      const d = npc.distanceTo(this.player.gx, this.player.gy);
      if (d <= bestDist) {
        best = npc;
        bestDist = d;
      }
    }
    this.talkTarget = best;
    if (this.walkingTo && best === this.walkingTo && !this.busy) {
      this.startConversation(best);
    } else if (this.walkingTo && !this.player.hasPath) {
      this.walkingTo = undefined;
    }
  }

  private checkDoors(): void {
    const door = this.map.data.doors?.find((d) => d.tx === this.player.tileX && d.ty === this.player.tileY);
    if (!door) {
      this.doorArmed = true;
      return;
    }
    if (!this.doorArmed || this.busy) return;
    this.useDoor(door);
  }

  private useDoor(door: Door): void {
    if (this.area === 'home' && !QuestLog.has('mother-medicine')) {
      // Don't let the story start without its first scene.
      this.doorArmed = false;
      this.onHint?.("I shouldn't go anywhere before I've spoken with Mother.");
      const back = this.map.data.entries?.door;
      if (back) this.player.setPath([{ x: Math.floor(back.x), y: Math.floor(back.y) }]);
      return;
    }
    this.busy = true;
    this.player.setPath([]);
    GameAudio.door();
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({ area: door.to, entry: door.entry } satisfies GameSceneData);
    });
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    // Pixel art looks best zoomed in, but phones need to see more of the map.
    cam.setZoom(Phaser.Math.Clamp(this.scale.width / 640, 1, CAMERA_ZOOM.default));
    cam.setBackgroundColor('#0e0f14');
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

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.busy) return;
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), CAMERA_ZOOM.min, CAMERA_ZOOM.max));
      this.fitCamera();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.busy) return;
      const tile = this.pointerTile(pointer);
      // Clicking someone walks over to them and starts a conversation.
      const npc = this.npcs.find((n) => n.tileX === tile.x && n.tileY === tile.y);
      if (npc) {
        if (npc.distanceTo(this.player.gx, this.player.gy) <= TALK_RANGE) {
          this.startConversation(npc);
          return;
        }
        const path = this.pathNextTo(npc);
        if (path) {
          this.walkingTo = npc;
          this.player.setPath(path);
        }
        return;
      }
      this.walkingTo = undefined;
      const path = this.pathTo(tile);
      if (!path) return;
      this.player.setPath(path);
      const c = gridToScreen(tile.x + 0.5, tile.y + 0.5);
      this.marker.setPosition(c.x, c.y).setVisible(true);
      this.tweens.killTweensOf(this.marker);
      this.marker.setAlpha(1);
      this.tweens.add({ targets: this.marker, alpha: 0, duration: 900, onComplete: () => this.marker.setVisible(false) });
    });
  }

  private pathTo(tile: GridPoint): GridPoint[] | null {
    return findPath(
      { x: this.player.tileX, y: this.player.tileY },
      tile,
      this.map.width,
      this.map.height,
      (x, y) => this.map.isWalkable(x, y),
    );
  }

  /** Shortest path to any free tile beside an NPC. */
  private pathNextTo(npc: Npc): GridPoint[] | null {
    let best: GridPoint[] | null = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const path = this.pathTo({ x: npc.tileX + dx, y: npc.tileY + dy });
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
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const g = screenToGrid(world.x, world.y);
    return { x: Math.floor(g.x), y: Math.floor(g.y) };
  }

  private updateHover(): void {
    const tile = this.pointerTile(this.input.activePointer);
    if (this.busy || !this.map.inBounds(tile.x, tile.y)) {
      this.hover.setVisible(false);
      return;
    }
    const c = gridToScreen(tile.x + 0.5, tile.y + 0.5);
    const npc = this.npcs.some((n) => n.tileX === tile.x && n.tileY === tile.y);
    this.hover
      .setPosition(c.x, c.y)
      .setTint(npc ? 0xffe08a : this.map.isWalkable(tile.x, tile.y) ? 0xffffff : 0xff6b6b)
      .setVisible(true);
  }
}
