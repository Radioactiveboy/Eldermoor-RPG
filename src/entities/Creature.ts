import Phaser from 'phaser';
import { WOLF_FEET_Y, WOLF_FRAME, WOLF_H } from '../art/creatures';
import { depthAt, gridToScreen, Vec2 } from '../iso/IsoMath';
import type { FoeKind } from '../systems/Combat';
import { findPath, GridPoint } from '../systems/Pathfinding';
import type { IsoMap } from '../world/IsoMap';

/** How close (in tiles) the player can get before a beast notices them. */
export const NOTICE_RANGE = 3.5;
/** How far from its spawn a beast wanders, in tiles. */
const LEASH = 4;
const ROAM_SPEED = 1.5;
/** After the player runs from a fight, the beast leaves them alone for this long (seconds). */
const CALM_SECONDS = 15;

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
export class Creature {
  readonly id: string;
  readonly kind: FoeKind;
  gx: number;
  gy: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  /** Screen-pixel nudge for the sprite, for lunges and flinches. */
  readonly offset = { x: 0, y: 0 };
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;
  private readonly map: IsoMap;
  private readonly home: Vec2;
  private state: State = 'sniff';
  private timer: number;
  private path: GridPoint[] = [];
  private calm = 0;

  constructor(scene: Phaser.Scene, map: IsoMap, id: string, kind: FoeKind, gx: number, gy: number) {
    this.scene = scene;
    this.map = map;
    this.id = id;
    this.kind = kind;
    this.gx = gx;
    this.gy = gy;
    this.home = { x: gx, y: gy };
    this.shadow = scene.add.image(0, 0, 'shadow').setScale(1.4, 1);
    this.sprite = scene.add.sprite(0, 0, 'creature-wolf', 0).setOrigin(0.5, (WOLF_FEET_Y + 0.5) / WOLF_H);
    this.sprite.play({ key: 'wolf-sniff', startFrame: Math.floor(Math.random() * 4) });
    this.sprite.setFlipX(Math.random() < 0.5);
    this.timer = 1 + Math.random() * 3;
    this.sync();
  }

  get active(): boolean {
    return this.state !== 'gone';
  }

  /** Able to notice the player and start a fight. */
  get prowling(): boolean {
    return this.state !== 'gone' && this.state !== 'fight' && this.calm <= 0;
  }

  distanceTo(gx: number, gy: number): number {
    return Math.hypot(gx - this.gx, gy - this.gy);
  }

  /**
   * Wander and sniff about. Returns true on the frame it notices the player
   * (pass no player while they're busy, so it doesn't).
   */
  update(dt: number, player?: Vec2): boolean {
    this.calm = Math.max(0, this.calm - dt);
    if (this.state === 'gone' || this.state === 'fight') {
      this.sync();
      return false;
    }
    if (this.state === 'alert') {
      this.sync();
      return false;
    }
    if (player && this.prowling && this.distanceTo(player.x, player.y) < NOTICE_RANGE) {
      this.state = 'alert';
      this.path = [];
      this.faceTowards(player.x, player.y);
      this.sprite.stop().setFrame(WOLF_FRAME.snarl);
      this.sync();
      return true;
    }

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
    this.sprite.stop().setFrame(WOLF_FRAME.snarl);
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
    this.sprite.stop().setFrame(WOLF_FRAME.dead);
    this.shadow.setVisible(false);
    this.sprite.setDepth(depthAt(this.gx, this.gy) - 1);
  }

  /** Bolt away from (gx, gy) and vanish into the trees. */
  flee(fromX: number, fromY: number): Promise<void> {
    this.state = 'gone';
    const dx = this.gx - fromX;
    const dy = this.gy - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const to = { gx: this.gx + (dx / len) * 6, gy: this.gy + (dy / len) * 6 };
    this.faceTowards(to.gx, to.gy);
    this.sprite.play('wolf-walk').anims.timeScale = 1.8;
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
    this.sprite.play('wolf-walk');
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        gx,
        gy,
        duration: ms,
        onUpdate: () => this.sync(),
        onComplete: () => {
          this.sprite.stop().setFrame(WOLF_FRAME.snarl);
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

  /** Stand and sniff the ground, or now and then lift the head to look around. */
  private rest(): void {
    if (Math.random() < 0.35) {
      this.state = 'look';
      this.sprite.play('wolf-idle');
      this.timer = 1.2 + Math.random() * 1.5;
    } else {
      this.state = 'sniff';
      this.sprite.play('wolf-sniff');
      this.timer = 2 + Math.random() * 3;
    }
  }

  /** Pick somewhere nearby to trot to. */
  private wander(): void {
    for (let tries = 0; tries < 8; tries++) {
      const tx = Math.floor(this.home.x + (Math.random() * 2 - 1) * LEASH);
      const ty = Math.floor(this.home.y + (Math.random() * 2 - 1) * LEASH);
      if (!this.map.isWalkable(tx, ty)) continue;
      const path = findPath(
        { x: Math.floor(this.gx), y: Math.floor(this.gy) },
        { x: tx, y: ty },
        this.map.width,
        this.map.height,
        (x, y) => this.map.isWalkable(x, y),
      );
      if (!path || path.length === 0 || path.length > LEASH * 3) continue;
      this.path = path;
      this.state = 'roam';
      this.sprite.play('wolf-walk');
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
    const step = ROAM_SPEED * dt;
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
    const d = depthAt(this.gx, this.gy);
    this.shadow.setDepth(d - 0.5);
    this.sprite.setDepth(d);
  }
}
