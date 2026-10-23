import Phaser from 'phaser';
import { PLAYER_RADIUS, PLAYER_SPEED } from '../config';
import { depthAt, gridToScreen, Vec2 } from '../iso/IsoMath';
import { IsoMap } from '../world/IsoMap';
import { GridPoint } from '../systems/Pathfinding';

/**
 * The player lives in grid space (gx, gy in tiles). Every frame it moves,
 * resolves collisions against the map, then syncs its sprites to screen space.
 */
export class Player {
  gx: number;
  gy: number;
  readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly map: IsoMap;
  private path: GridPoint[] = [];
  private bobTime = 0;

  constructor(scene: Phaser.Scene, map: IsoMap, gx: number, gy: number) {
    this.map = map;
    this.gx = gx;
    this.gy = gy;
    this.shadow = scene.add.image(0, 0, 'shadow');
    this.sprite = scene.add.image(0, 0, 'player').setOrigin(0.5, 0.95);
    this.sync(false);
  }

  get tileX(): number {
    return Math.floor(this.gx);
  }

  get tileY(): number {
    return Math.floor(this.gy);
  }

  /** Follow a tile path (from click-to-move). Keyboard input cancels it. */
  setPath(path: GridPoint[]): void {
    this.path = path;
  }

  /**
   * @param input direction in grid space (already normalised), or zero vector for none
   */
  update(dt: number, input: Vec2): void {
    let dir = input;
    if (input.x !== 0 || input.y !== 0) {
      this.path = [];
    } else if (this.path.length > 0) {
      dir = this.steerAlongPath();
    }

    const moving = dir.x !== 0 || dir.y !== 0;
    if (moving) {
      const step = PLAYER_SPEED * dt;
      this.tryMove(dir.x * step, 0);
      this.tryMove(0, dir.y * step);
      if (dir.x - dir.y !== 0) this.sprite.setFlipX(dir.x - dir.y < 0);
    }
    this.sync(moving, dt);
  }

  private steerAlongPath(): Vec2 {
    const next = this.path[0];
    const tx = next.x + 0.5;
    const ty = next.y + 0.5;
    const dx = tx - this.gx;
    const dy = ty - this.gy;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.08) {
      this.path.shift();
      return this.path.length > 0 ? this.steerAlongPath() : { x: 0, y: 0 };
    }
    // Don't overshoot the waypoint on low frame rates.
    const scale = Math.min(1, dist / 0.08) / dist;
    return { x: dx * scale, y: dy * scale };
  }

  /** Move along one axis, rejecting the move if the collision circle would overlap a blocked tile. */
  private tryMove(dx: number, dy: number): void {
    const nx = this.gx + dx;
    const ny = this.gy + dy;
    const r = PLAYER_RADIUS;
    const corners: Array<[number, number]> = [
      [nx - r, ny - r], [nx + r, ny - r], [nx - r, ny + r], [nx + r, ny + r],
    ];
    for (const [cx, cy] of corners) {
      if (!this.map.isWalkable(Math.floor(cx), Math.floor(cy))) return;
    }
    this.gx = nx;
    this.gy = ny;
  }

  private sync(moving: boolean, dt = 0): void {
    const p = gridToScreen(this.gx, this.gy);
    this.bobTime = moving ? this.bobTime + dt * 12 : 0;
    const bob = moving ? Math.abs(Math.sin(this.bobTime)) * 3 : 0;
    this.shadow.setPosition(p.x, p.y);
    this.sprite.setPosition(p.x, p.y - bob);
    const d = depthAt(this.gx, this.gy);
    this.shadow.setDepth(d - 0.5);
    this.sprite.setDepth(d);
  }
}
