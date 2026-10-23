import Phaser from 'phaser';
import { FEET_Y, FRAME_H, DrawnDir } from '../art/character';
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
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly map: IsoMap;
  private path: GridPoint[] = [];
  /** Facing as one of 8 screen directions: 0 = south, 2 = east, 4 = north, 6 = west. */
  private facing = 0;

  constructor(scene: Phaser.Scene, map: IsoMap, gx: number, gy: number) {
    this.map = map;
    this.gx = gx;
    this.gy = gy;
    this.shadow = scene.add.image(0, 0, 'shadow');
    this.sprite = scene.add.sprite(0, 0, 'player', 0).setOrigin(0.5, (FEET_Y + 0.5) / FRAME_H);
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
   * @param speedMultiplier e.g. above 1 while sprinting
   * @returns whether the player moved this frame
   */
  update(dt: number, input: Vec2, speedMultiplier = 1): boolean {
    let dir = input;
    if (input.x !== 0 || input.y !== 0) {
      this.path = [];
    } else if (this.path.length > 0) {
      dir = this.steerAlongPath();
    }

    const moving = dir.x !== 0 || dir.y !== 0;
    if (moving) {
      const step = PLAYER_SPEED * speedMultiplier * dt;
      this.tryMove(dir.x * step, 0);
      this.tryMove(0, dir.y * step);
      this.face(dir);
    }
    this.sync(moving);
    return moving;
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

  /** Turn to face a grid-space direction, using its on-screen angle. */
  private face(dir: Vec2): void {
    const screen = gridToScreen(dir.x, dir.y);
    // atan2(x, y) is 0 straight down the screen and grows through east towards north.
    const angle = Math.atan2(screen.x, screen.y);
    this.facing = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
  }

  private sync(moving: boolean): void {
    // Facings 0..4 are drawn (s, se, e, ne, n); 5..7 are the east ones mirrored.
    const names: DrawnDir[] = ['s', 'se', 'e', 'ne', 'n'];
    const mirrored = this.facing > 4;
    const drawn = names[mirrored ? 8 - this.facing : this.facing];
    this.sprite.setFlipX(mirrored);
    this.sprite.play(`player-${moving ? 'walk' : 'idle'}-${drawn}`, true);

    const p = gridToScreen(this.gx, this.gy);
    this.shadow.setPosition(p.x, p.y);
    this.sprite.setPosition(p.x, p.y);
    const d = depthAt(this.gx, this.gy);
    this.shadow.setDepth(d - 0.5);
    this.sprite.setDepth(d);
  }
}
