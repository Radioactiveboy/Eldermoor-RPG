import Phaser from 'phaser';
import { DIRECTIONS_8 } from '../art/figure3d';
import { wolfSpec } from '../art/beasts3d';
import { gridToScreen, Vec2 } from '../iso/IsoMath';
import { findPath, GridPoint } from '../systems/Pathfinding';
import type { IsoMap } from '../world/IsoMap';

const GRAZE_SPEED = 1.1;
/** How close behind whoever she's following she keeps, in tiles. */
const HEEL = 1.4;
/** She trots to catch up, up to this fast (tiles per second). */
const CATCH_UP = 5;
const RADIUS = 0.3;

/** A dog's kind ('lurcher': Nothing; 'pitdog': the Red Aprons' fighting dogs), its size as drawn, and how far it may roam. */
export interface HoundSpawn {
  kind: 'lurcher' | 'pitdog';
  gx: number;
  gy: number;
  /** How far from its spot it wanders, in tiles: 0 for one on a chain. */
  leash: number;
}

const SIZES: Record<HoundSpawn['kind'], number> = { lurcher: 0.78, pitdog: 0.72 };

/**
 * A dog in the Shambles (see world/ShamblesMap.ts, art/shamblesfolk3d.ts):
 * Nothing, Old Scritch's grey lurcher, nosing about his den once she's home;
 * the pit dogs, chained in their pens in the Red Aprons' barn. Like the goat
 * (entities/Goat.ts) it noses about near where it was left, never in anyone's
 * way, and can trot at someone's heel.
 */
export class Hound {
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

  readonly kind: HoundSpawn['kind'];
  private readonly leash: number;

  constructor(scene: Phaser.Scene, map: IsoMap, spawn: HoundSpawn) {
    this.map = map;
    this.kind = spawn.kind;
    this.leash = spawn.leash;
    this.gx = spawn.gx;
    this.gy = spawn.gy;
    this.home = { x: spawn.gx, y: spawn.gy };
    const spec = wolfSpec(SIZES[spawn.kind]);
    this.shadow = scene.add.image(0, 0, 'shadow').setScale(0.8, 0.7);
    this.sprite = scene.add.sprite(0, 0, `creature-${spawn.kind}`, 0).setOrigin(0.5, (spec.feetY + 0.5) / spec.h);
    this.play('sniff');
    this.sync();
  }

  /** Trot at someone's heel. */
  follow(leader: () => Vec2): void {
    this.leader = leader;
    this.path = [];
  }

  get following(): boolean {
    return !!this.leader;
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
      if (this.timer <= 0) {
        if (this.leash > 0) this.wander();
        else this.rest();
      }
    }
    this.sync();
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }

  /** Fade out, then be gone. */
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
      const tx = Math.floor(this.home.x + (Math.random() * 2 - 1) * this.leash);
      const ty = Math.floor(this.home.y + (Math.random() * 2 - 1) * this.leash);
      if (!this.map.isWalkable(tx, ty)) continue;
      const path = findPath(this.tile(), { x: tx, y: ty }, this.map.width, this.map.height, (x, y) => this.map.isWalkable(x, y), 400);
      if (!path || path.length === 0 || path.length > this.leash * 3) continue;
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
      this.sprite.play({ key: `${this.kind}-${anim}-${DIRECTIONS_8[this.facing].name}`, startFrame: anim === 'walk' ? 0 : Math.floor(Math.random() * 2) });
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
