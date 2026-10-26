import Phaser from 'phaser';
import { CREATURE_ART, CREATURE_FRAME } from '../art/creatures';
import { depthAt, gridToScreen, Vec2 } from '../iso/IsoMath';
import { FoeKind, FOES } from '../systems/Combat';
import { findPath, GridPoint } from '../systems/Pathfinding';
import type { Body, IsoMap } from '../world/IsoMap';

/**
 * How each kind behaves in the wild. Fierce beasts notice the player within
 * `notice` tiles and attack; shy game never starts a fight (the player has to
 * hunt it, see GameScene) and bolts if the player comes running. `leash` is
 * how far from its spawn it wanders, in tiles, and `speed` how fast it trots.
 */
const WAYS: Record<FoeKind, { shy: boolean; notice: number; leash: number; speed: number }> = {
  wolf: { shy: false, notice: 3.5, leash: 4, speed: 1.5 },
  boar: { shy: false, notice: 2.6, leash: 4, speed: 1.2 },
  deer: { shy: true, notice: 0, leash: 7, speed: 1.3 },
  hare: { shy: true, notice: 0, leash: 5, speed: 1.8 },
};
/** Shy game bolts when the player sprints within this many tiles of it. */
const STARTLE_RANGE = 6;
/** How fast startled game runs, in tiles per second. */
const BOLT_SPEED = 4.5;
/** After the player runs from a fight, the beast leaves them alone for this long (seconds). */
const CALM_SECONDS = 15;
/** Collision radius in tiles: the player and travellers bump into it. */
const RADIUS = 0.35;

/**
 * What it's doing: nosing about, trotting somewhere, snarling at the player,
 * standing in a fight, or gone (dead, or fled into the woods).
 */
type State = 'sniff' | 'look' | 'roam' | 'alert' | 'fight' | 'gone';

/**
 * A wild animal that wanders near its den. It noses at the ground, trots to
 * somewhere new, and when the player comes close it snarls and starts a fight
 * (see GameScene.startCombat). Lives in grid space like the player.
 */
export class Creature implements Body {
  readonly id: string;
  readonly kind: FoeKind;
  gx: number;
  gy: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  /** Screen-pixel nudge for the sprite, for lunges and flinches. */
  readonly offset = { x: 0, y: 0 };
  readonly radius = RADIUS;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;
  private readonly map: IsoMap;
  private readonly home: Vec2;
  private state: State = 'sniff';
  private timer: number;
  private path: GridPoint[] = [];
  private calm = 0;
  /** Running from the player after being startled. */
  private bolting = false;
  private readonly ways: (typeof WAYS)[FoeKind];

  constructor(scene: Phaser.Scene, map: IsoMap, id: string, kind: FoeKind, gx: number, gy: number) {
    this.scene = scene;
    this.map = map;
    this.id = id;
    this.kind = kind;
    this.gx = gx;
    this.gy = gy;
    this.home = { x: gx, y: gy };
    this.ways = WAYS[kind];
    const art = CREATURE_ART[kind];
    this.shadow = scene.add.image(0, 0, 'shadow').setScale(kind === 'hare' ? 0.7 : 1.4, kind === 'hare' ? 0.6 : 1);
    this.sprite = scene.add.sprite(0, 0, `creature-${kind}`, 0).setOrigin(0.5, (art.feetY + 0.5) / art.h);
    this.sprite.play({ key: `${kind}-sniff`, startFrame: Math.floor(Math.random() * 4) });
    this.sprite.setFlipX(Math.random() < 0.5);
    this.timer = 1 + Math.random() * 3;
    map.bodies.add(this);
    this.sync();
  }

  get active(): boolean {
    return this.state !== 'gone';
  }

  /** Able to notice the player and start a fight. */
  get prowling(): boolean {
    return !this.ways.shy && this.state !== 'gone' && this.state !== 'fight' && this.calm <= 0;
  }

  /** Shy game the player can go after: it never starts a fight itself. */
  get huntable(): boolean {
    return this.ways.shy && this.state !== 'gone' && this.state !== 'fight' && !this.bolting;
  }

  /** What it's called, for the hunt prompt. */
  get name(): string {
    return FOES[this.kind].name;
  }

  distanceTo(gx: number, gy: number): number {
    return Math.hypot(gx - this.gx, gy - this.gy);
  }

  /**
   * Wander and sniff about. Returns true on the frame it notices the player
   * (pass no player while they're busy, so it doesn't).
   * @param running whether the player is sprinting, which sends shy game bolting
   */
  update(dt: number, player?: Vec2, running = false): boolean {
    this.calm = Math.max(0, this.calm - dt);
    if (this.state === 'gone' || this.state === 'fight') {
      this.sync();
      return false;
    }
    if (this.state === 'alert') {
      this.sync();
      return false;
    }
    if (player && this.prowling && this.distanceTo(player.x, player.y) < this.ways.notice) {
      this.state = 'alert';
      this.path = [];
      this.faceTowards(player.x, player.y);
      this.sprite.stop().setFrame(CREATURE_FRAME.snarl);
      this.sync();
      return true;
    }
    if (player && running && this.huntable && this.distanceTo(player.x, player.y) < STARTLE_RANGE) this.startle(player);

    this.timer -= dt;
    if (this.state === 'roam') {
      this.walk(dt);
      if (this.path.length === 0) this.rest();
    } else if (this.timer <= 0) {
      this.wander();
    }
    this.sync();
    return false;
  }

  /** Stop wandering and stand ready to fight. */
  engage(): void {
    this.state = 'fight';
    this.path = [];
    this.sprite.stop().setFrame(CREATURE_FRAME.snarl);
  }

  /** Back to wandering, and leave the player be for a while (after they run away). */
  disengage(): void {
    if (this.state === 'gone') return;
    this.calm = CALM_SECONDS;
    this.offset.x = this.offset.y = 0;
    this.rest();
  }

  /** Lie still. The body stays where it fell until the player leaves the area. */
  die(): void {
    this.state = 'gone';
    this.map.bodies.delete(this);
    this.sprite.stop().setFrame(CREATURE_FRAME.dead);
    this.shadow.setVisible(false);
    this.sprite.setDepth(depthAt(this.gx, this.gy) - 1);
  }

  /** Bolt away from (gx, gy) and vanish into the trees. */
  flee(fromX: number, fromY: number): Promise<void> {
    this.state = 'gone';
    this.map.bodies.delete(this);
    const dx = this.gx - fromX;
    const dy = this.gy - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const to = { gx: this.gx + (dx / len) * 6, gy: this.gy + (dy / len) * 6 };
    this.faceTowards(to.gx, to.gy);
    this.sprite.play(`${this.kind}-walk`).anims.timeScale = 1.8;
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        gx: to.gx,
        gy: to.gy,
        duration: 1300,
        onUpdate: () => this.sync(),
        onComplete: () => {
          this.sprite.setVisible(false);
          this.shadow.setVisible(false);
          resolve();
        },
      });
      this.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: 0, delay: 700, duration: 600 });
    });
  }

  /** Trot to a spot (used to close in at the start of a fight). */
  moveTo(gx: number, gy: number, ms: number): Promise<void> {
    if (Math.hypot(gx - this.gx, gy - this.gy) < 0.05) return Promise.resolve();
    this.faceTowards(gx, gy);
    this.sprite.play(`${this.kind}-walk`);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        gx,
        gy,
        duration: ms,
        onUpdate: () => this.sync(),
        onComplete: () => {
          this.sprite.stop().setFrame(CREATURE_FRAME.snarl);
          this.sync();
          resolve();
        },
      });
    });
  }

  /** The sprite is drawn facing screen-right; mirror it to face left. */
  faceTowards(gx: number, gy: number): void {
    const screenDx = gridToScreen(gx - this.gx, gy - this.gy).x;
    if (Math.abs(screenDx) > 2) this.sprite.setFlipX(screenDx < 0);
  }

  setFrame(frame: number): void {
    this.sprite.stop().setFrame(frame);
  }

  /** Stand and sniff the ground (or graze), or now and then lift the head to look around. */
  private rest(): void {
    this.bolting = false;
    this.sprite.anims.timeScale = 1;
    if (Math.random() < 0.35) {
      this.state = 'look';
      this.sprite.play(`${this.kind}-idle`);
      this.timer = 1.2 + Math.random() * 1.5;
    } else {
      this.state = 'sniff';
      this.sprite.play(`${this.kind}-sniff`);
      this.timer = 2 + Math.random() * 3;
    }
  }

  /** Startled: bound away from the player, as far as its range allows, then settle again. */
  private startle(from: Vec2): void {
    const dx = this.gx - from.x;
    const dy = this.gy - from.y;
    const len = Math.hypot(dx, dy) || 1;
    for (const dist of [7, 5, 3]) {
      const tx = Math.floor(this.gx + (dx / len) * dist);
      const ty = Math.floor(this.gy + (dy / len) * dist);
      if (!this.map.isWalkable(tx, ty) || Math.hypot(tx - this.home.x, ty - this.home.y) > this.ways.leash * 2) continue;
      const path = findPath({ x: Math.floor(this.gx), y: Math.floor(this.gy) }, { x: tx, y: ty }, this.map.width, this.map.height, (x, y) => this.map.isWalkable(x, y), 800);
      if (!path || path.length === 0) continue;
      this.path = path;
      this.state = 'roam';
      this.bolting = true;
      this.sprite.play(`${this.kind}-walk`).anims.timeScale = 1.8;
      return;
    }
  }

  /** Pick somewhere nearby to trot to. */
  private wander(): void {
    for (let tries = 0; tries < 8; tries++) {
      const leash = this.ways.leash;
      const tx = Math.floor(this.home.x + (Math.random() * 2 - 1) * leash);
      const ty = Math.floor(this.home.y + (Math.random() * 2 - 1) * leash);
      if (!this.map.isWalkable(tx, ty)) continue;
      const path = findPath(
        { x: Math.floor(this.gx), y: Math.floor(this.gy) },
        { x: tx, y: ty },
        this.map.width,
        this.map.height,
        (x, y) => this.map.isWalkable(x, y),
      );
      if (!path || path.length === 0 || path.length > leash * 3) continue;
      this.path = path;
      this.state = 'roam';
      this.sprite.play(`${this.kind}-walk`);
      return;
    }
    this.rest();
  }

  private walk(dt: number): void {
    const next = this.path[0];
    if (!next) return;
    const dx = next.x + 0.5 - this.gx;
    const dy = next.y + 0.5 - this.gy;
    const dist = Math.hypot(dx, dy);
    const step = (this.bolting ? BOLT_SPEED : this.ways.speed) * dt;
    // Someone in the way: stop and sniff, then pick somewhere else.
    if (this.map.blocked(this.gx + (dx / dist) * step, this.gy + (dy / dist) * step, RADIUS, true, this)) {
      this.path = [];
      return;
    }
    if (dist <= step) {
      this.gx = next.x + 0.5;
      this.gy = next.y + 0.5;
      this.path.shift();
      return;
    }
    this.gx += (dx / dist) * step;
    this.gy += (dy / dist) * step;
    this.faceTowards(this.gx + dx, this.gy + dy);
  }

  private sync(): void {
    const p = gridToScreen(this.gx, this.gy);
    this.shadow.setPosition(p.x, p.y);
    this.sprite.setPosition(p.x + this.offset.x, p.y + this.offset.y);
    // A body lying on the ground keeps the depth it fell at (see die()).
    if (this.state === 'gone') return;
    const d = this.map.characterDepth(this.gx, this.gy);
    this.shadow.setDepth(d - 0.5);
    this.sprite.setDepth(d);
  }
}
