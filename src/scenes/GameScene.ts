import Phaser from 'phaser';
import { CAMERA_ZOOM, FAST_FORWARD, MAP_HEIGHT, MAP_SEED, MAP_WIDTH, SPRINT_MULTIPLIER } from '../config';
import { Player } from '../entities/Player';
import { gridToScreen, screenToGrid, Vec2 } from '../iso/IsoMath';
import { findPath } from '../systems/Pathfinding';
import { PlayerStats } from '../systems/PlayerStats';
import { TimeOfDay } from '../systems/TimeOfDay';
import { IsoMap } from '../world/IsoMap';
import { generateMap } from '../world/MapGenerator';

type MoveKeys = Record<
  'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'sprint' | 'fastForward',
  Phaser.Input.Keyboard.Key
>;

export class GameScene extends Phaser.Scene {
  map!: IsoMap;
  player!: Player;
  stats!: PlayerStats;
  clock!: TimeOfDay;
  private keys!: MoveKeys;
  private hover!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;

  constructor() {
    super('Game');
  }

  create(): void {
    this.map = new IsoMap(this, generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED));
    const spawn = this.map.data.spawn;
    this.player = new Player(this, this.map, spawn.x, spawn.y);
    this.stats = new PlayerStats();
    this.clock = new TimeOfDay();
    // Handy for testing: open the game with ?hour=21 to start at 9pm.
    const hourParam = new URLSearchParams(window.location.search).get('hour');
    if (hourParam !== null && !Number.isNaN(Number(hourParam))) this.clock.setHour(Number(hourParam));

    this.hover = this.add.image(0, 0, 'tile-highlight').setDepth(1).setAlpha(0.6).setVisible(false);
    this.marker = this.add.image(0, 0, 'tile-highlight').setDepth(1).setTint(0x9cf09c).setVisible(false);

    this.setupCamera();
    this.setupInput();
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const wantsSprint = this.keys.sprint.isDown && this.stats.canSprint();
    const moved = this.player.update(dt, this.readKeyboard(), wantsSprint ? SPRINT_MULTIPLIER : 1);
    this.stats.update(dt, wantsSprint && moved);
    this.clock.timeScale = this.keys.fastForward.isDown ? FAST_FORWARD : 1;
    this.clock.update(dt);
    this.updateHover();
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    const b = this.map.getWorldBounds();
    cam.setBounds(b.x, b.y, b.width, b.height);
    cam.setZoom(CAMERA_ZOOM.default);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.setBackgroundColor('#0e0f14');
    cam.roundPixels = true;
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D,
      sprint: K.SHIFT, fastForward: K.T,
    }) as MoveKeys;

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), CAMERA_ZOOM.min, CAMERA_ZOOM.max));
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const tile = this.pointerTile(pointer);
      const path = findPath(
        { x: this.player.tileX, y: this.player.tileY },
        tile,
        this.map.width,
        this.map.height,
        (x, y) => this.map.isWalkable(x, y),
      );
      if (!path) return;
      this.player.setPath(path);
      const c = gridToScreen(tile.x + 0.5, tile.y + 0.5);
      this.marker.setPosition(c.x, c.y).setVisible(true);
      this.tweens.killTweensOf(this.marker);
      this.marker.setAlpha(1);
      this.tweens.add({ targets: this.marker, alpha: 0, duration: 900, onComplete: () => this.marker.setVisible(false) });
    });
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
    if (!this.map.inBounds(tile.x, tile.y)) {
      this.hover.setVisible(false);
      return;
    }
    const c = gridToScreen(tile.x + 0.5, tile.y + 0.5);
    this.hover
      .setPosition(c.x, c.y)
      .setTint(this.map.isWalkable(tile.x, tile.y) ? 0xffffff : 0xff6b6b)
      .setVisible(true);
  }
}
