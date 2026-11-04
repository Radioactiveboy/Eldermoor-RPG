import Phaser from 'phaser';
import { DIRECTIONS_8 } from '../art/figure3d';
import { goatSpec } from '../art/wayfarers3d';
import { gridToScreen, Vec2 } from '../iso/IsoMath';
import { findPath, GridPoint } from '../systems/Pathfinding';
import type { IsoMap } from '../world/IsoMap';

/** How far from where she was left she wanders while grazing, in tiles. */
const LEASH = 3;
const GRAZE_SPEED = 0.9;
/** How close behind whoever she's following she keeps, in tiles. */
const HEEL = 1.4;
/** She trots to catch up, up to this fast (tiles per second). */
const CATCH_UP = 5;
const RADIUS = 0.3;

/**
 * Clover, Mags's runaway nanny goat (see world/PlainsEvents.ts), modelled in
 * 3D in eight directions (see art/wayfarers3d.ts). She grazes about where she
 * strayed to until someone takes her by the collar (she never gets in anyone's way); then she trots along
 * behind them, a little way back.
 */
export class Goat {
  gx: number;
  gy: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly map: IsoMap;
  private home: Vec2;
  private facing = Math.floor(Math.random() * 8);
  private path: GridPoint[] = [];
  private timer = 1;
  private anim = '';
  /** Who she's trotting after, if anyone. */
  private leader?: () => Vec2;

  constructor(scene: Phaser.Scene, map: IsoMap, gx: number, gy: number) {
    this.map = map;
    this.gx = gx;
    this.gy = gy;
    this.home = { x: gx, y: gy };
    const spec = goatSpec();
    this.shadow = scene.add.image(0, 0, 'shadow').setScale(0.9, 0.8);
    this.sprite = scene.add.sprite(0, 0, 'creature-goat', 0).setOrigin(0.5, (spec.feetY + 0.5) / spec.h);
    this.play('sniff');
    this.sync();
  }

  /** Trot after someone (the hero leading her, or Mags taking her home). */
  follow(leader: () => Vec2): void {
    this.leader = leader;
    this.path = [];
  }

  get following(): boolean {
    return !!this.leader;
  }

  /** Where the prompt to lead her goes: just over her back. */
  get promptPoint(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y - 30 };
  }

  update(dt: number, paused: boolean): void {
    if (paused) return;
    if (this.leader) {
      this.trotAfter(dt, this.leader());
    } else if (this.path.length > 0) {
      this.walk(dt, GRAZE_SPEED);
      if (this.path.length === 0) this.rest();
    } else {
      this.timer -= dt;
      if (this.timer <= 0) this.wander();
    }
    this.sync();
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }

  /** Fade out (walking off with Mags), then be gone. */
  fadeAway(ms: number): void {
    this.sprite.scene.tweens.add({ targets: [this.sprite, this.shadow], alpha: 0, duration: ms, onComplete: () => this.destroy() });
  }

  private trotAfter(dt: number, to: Vec2): void {
    const dx = to.x - this.gx;
    const dy = to.y - this.gy;
    const dist = Math.hypot(dx, dy);
    if (dist <= HEEL) {
      this.play('idle');
      this.face(dx, dy);
      return;
    }
    // Quicker the further behind she's fallen.
    const speed = Math.min(CATCH_UP, 1.4 + (dist - HEEL) * 1.6);
    const step = Math.min(dist - HEEL, speed * dt);
    const nx = this.gx + (dx / dist) * step;
    const ny = this.gy + (dy / dist) * step;
    if (this.map.blocked(nx, ny, RADIUS, false)) {
      // Round whatever's in the way, tile by tile.
      if (this.path.length === 0) {
        this.path = findPath(this.tile(), { x: Math.floor(to.x), y: Math.floor(to.y) }, this.map.width, this.map.height, (x, y) => this.map.isWalkable(x, y), 1500) ?? [];
        this.path = this.path.slice(0, -1);
      }
      if (this.path.length > 0) this.walk(dt, speed);
      return;
    }
    this.path = [];
    this.gx = nx;
    this.gy = ny;
    this.face(dx, dy);
    this.play('walk', speed > 2.5 ? 1.6 : 1);
  }

  private wander(): void {
    for (let tries = 0; tries < 6; tries++) {
      const tx = Math.floor(this.home.x + (Math.random() * 2 - 1) * LEASH);
      const ty = Math.floor(this.home.y + (Math.random() * 2 - 1) * LEASH);
      if (!this.map.isWalkable(tx, ty)) continue;
      const path = findPath(this.tile(), { x: tx, y: ty }, this.map.width, this.map.height, (x, y) => this.map.isWalkable(x, y), 400);
      if (!path || path.length === 0 || path.length > LEASH * 3) continue;
      this.path = path;
      this.play('walk');
      return;
    }
    this.rest();
  }

  private rest(): void {
    this.play(Math.random() < 0.7 ? 'sniff' : 'idle');
    this.timer = 2 + Math.random() * 4;
  }

  private walk(dt: number, speed: number): void {
    const next = this.path[0];
    if (!next) return;
    const dx = next.x + 0.5 - this.gx;
    const dy = next.y + 0.5 - this.gy;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    if (dist <= step) {
      this.gx = next.x + 0.5;
      this.gy = next.y + 0.5;
      this.path.shift();
      return;
    }
    this.gx += (dx / dist) * step;
    this.gy += (dy / dist) * step;
    this.face(dx, dy);
    this.play('walk');
  }

  private tile(): GridPoint {
    return { x: Math.floor(this.gx), y: Math.floor(this.gy) };
  }

  private face(dx: number, dy: number): void {
    const screen = gridToScreen(dx, dy);
    if (Math.hypot(screen.x, screen.y) < 0.01) return;
    const facing = (Math.round(Math.atan2(screen.x, screen.y) / (Math.PI / 4)) + 8) % 8;
    if (facing === this.facing) return;
    this.facing = facing;
    const anim = this.anim;
    this.anim = '';
    if (anim) this.play(anim, this.sprite.anims.timeScale);
  }

  private play(anim: string, timeScale = 1): void {
    if (this.anim !== anim) {
      this.anim = anim;
      this.sprite.play({ key: `goat-${anim}-${DIRECTIONS_8[this.facing].name}`, startFrame: anim === 'walk' ? 0 : Math.floor(Math.random() * 2) });
    }
    this.sprite.anims.timeScale = timeScale;
  }

  private sync(): void {
    const p = gridToScreen(this.gx, this.gy);
    this.shadow.setPosition(p.x, p.y);
    this.sprite.setPosition(p.x, p.y);
    const d = this.map.characterDepth(this.gx, this.gy);
    this.shadow.setDepth(d - 0.5);
    this.sprite.setDepth(d);
  }
}
