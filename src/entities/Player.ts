import Phaser from 'phaser';
import { FEET_Y, FRAME_H, DrawnDir } from '../art/character';
import { PLAYER_RADIUS, PLAYER_SPEED } from '../config';
import { gridToScreen, Vec2 } from '../iso/IsoMath';
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
  /** Points to walk through, in grid space (click-to-move). */
  private route: Vec2[] = [];
  /** Seconds spent pushing along the route without getting anywhere. */
  private stuck = 0;
  /** Facing as one of 8 screen directions: 0 = south, 2 = east, 4 = north, 6 = west. */
  private facing = 0;
  /** Sitting on a seat, or crouched working (picking crops). Either way the player stays put. */
  pose: 'stand' | 'sit' | 'work' = 'stand';
  /** Screen-pixel nudge for the sprite, for lunges and flinches in a fight. */
  readonly offset = { x: 0, y: 0 };

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

  get hasPath(): boolean {
    return this.route.length > 0;
  }

  /**
   * Follow a tile path (from click-to-move), optionally finishing at an exact
   * point instead of the last tile's centre. Corners with room to cut are
   * smoothed away, so the player walks straight past a tree trunk instead of
   * zig-zagging from tile centre to tile centre. Keyboard input cancels it.
   */
  setPath(path: GridPoint[], end?: Vec2): void {
    const points = path.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
    if (end) {
      const last = path[path.length - 1];
      if (last && last.x === Math.floor(end.x) && last.y === Math.floor(end.y)) points[points.length - 1] = end;
      else points.push(end);
    }
    this.route = this.smooth(points);
    this.stuck = 0;
  }

  /**
   * @param input direction in grid space (already normalised), or zero vector for none
   * @param speedMultiplier e.g. above 1 while sprinting
   * @returns whether the player moved this frame
   */
  update(dt: number, input: Vec2, speedMultiplier = 1): boolean {
    if (this.pose !== 'stand') {
      this.sync(false);
      return false;
    }
    let dir = input;
    const step = PLAYER_SPEED * speedMultiplier * dt;
    if (input.x !== 0 || input.y !== 0) {
      this.route = [];
    } else if (this.route.length > 0) {
      dir = this.steerAlongPath(step);
    }

    const moving = dir.x !== 0 || dir.y !== 0;
    if (moving) {
      const moved = this.move(dir, step);
      this.face(dir);
      // Something (or someone) is in the way of the route: give up rather than walk on the spot.
      this.stuck = this.route.length > 0 && !moved ? this.stuck + dt : 0;
      if (this.stuck > 0.4) this.route = [];
    }
    this.sync(moving);
    return moving;
  }

  /** Sit down at a spot (which may be on a blocked tile, like a bench), facing a grid direction. */
  sitAt(gx: number, gy: number, face: Vec2): void {
    this.route = [];
    this.gx = gx;
    this.gy = gy;
    this.face(face);
    this.pose = 'sit';
    this.sync(false);
  }

  /** Get up and step to a free spot. */
  standAt(gx: number, gy: number): void {
    this.gx = gx;
    this.gy = gy;
    this.pose = 'stand';
    this.sync(false);
  }

  /** Crouch to work at something (or stand back up), facing it. */
  setWorking(working: boolean, towards?: Vec2): void {
    this.route = [];
    if (towards) this.face({ x: towards.x - this.gx, y: towards.y - this.gy });
    this.pose = working ? 'work' : 'stand';
    this.sync(false);
  }

  /** Turn to look at a point in grid space. */
  faceTowards(gx: number, gy: number): void {
    if (gx !== this.gx || gy !== this.gy) this.face({ x: gx - this.gx, y: gy - this.gy });
    this.sync(false);
  }

  /** Direction towards the next waypoint, shortened so this frame's step of `maxStep` tiles can't overshoot it. */
  private steerAlongPath(maxStep: number): Vec2 {
    const next = this.route[0];
    const dx = next.x - this.gx;
    const dy = next.y - this.gy;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.08) {
      this.route.shift();
      return this.route.length > 0 ? this.steerAlongPath(maxStep) : { x: 0, y: 0 };
    }
    // Don't overshoot the waypoint, which at low frame rates would make the player jitter around it forever.
    const scale = Math.min(1, dist / Math.max(maxStep, 1e-6)) / dist;
    return { x: dx * scale, y: dy * scale };
  }

  /** Drop route points that can be reached in a straight line from an earlier one. */
  private smooth(points: Vec2[]): Vec2[] {
    const out: Vec2[] = [];
    // A hair wider than the player, so the smoothed route never grazes a corner it can't pass.
    const r = PLAYER_RADIUS + 0.03;
    let from: Vec2 = { x: this.gx, y: this.gy };
    let i = 0;
    while (i < points.length) {
      let j = i;
      while (j + 1 < points.length && this.map.segmentClear(from, points[j + 1], r)) j++;
      out.push(points[j]);
      from = points[j];
      i = j + 1;
    }
    return out;
  }

  /**
   * Step `step` tiles along `dir`, sliding along whatever is in the way. Each
   * axis is tried on its own (so walls can be slid along), and if that gets
   * nowhere because something round is in the way (a tree trunk, a person),
   * the player steps sideways round its edge instead of stopping dead.
   * @returns whether the player moved at all
   */
  private move(dir: Vec2, step: number): boolean {
    const x0 = this.gx;
    const y0 = this.gy;
    this.tryMove(dir.x * step, 0);
    this.tryMove(0, dir.y * step);
    if (this.gx === x0 && this.gy === y0) {
      const round = this.map.roundBlocker(x0 + dir.x * step, y0 + dir.y * step, PLAYER_RADIUS);
      if (round) {
        // Along the edge of the round thing, whichever way is nearer where we want to go.
        let tx = -(y0 - round.y);
        let ty = x0 - round.x;
        const len = Math.hypot(tx, ty) || 1;
        const sign = tx * dir.x + ty * dir.y >= 0 ? 1 : -1;
        tx = (tx / len) * sign;
        ty = (ty / len) * sign;
        // Lean a little outwards too, so the circle never quite touches and sticks.
        const ox = (x0 - round.x) / len;
        const oy = (y0 - round.y) / len;
        this.tryMove((tx + ox * 0.15) * step, (ty + oy * 0.15) * step);
      }
    }
    return this.gx !== x0 || this.gy !== y0;
  }

  /** Move by (dx, dy) unless the collision circle would then overlap something solid. */
  private tryMove(dx: number, dy: number): boolean {
    if (dx === 0 && dy === 0) return false;
    const nx = this.gx + dx;
    const ny = this.gy + dy;
    if (this.map.blocked(nx, ny, PLAYER_RADIUS)) return false;
    this.gx = nx;
    this.gy = ny;
    return true;
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
    const anim = this.pose === 'stand' ? (moving ? 'walk' : 'idle') : this.pose;
    this.sprite.play(`player-${anim}-${drawn}`, true);

    const p = gridToScreen(this.gx, this.gy);
    this.shadow.setPosition(p.x, p.y);
    this.sprite.setPosition(p.x + this.offset.x, p.y + this.offset.y);
    // Seated, draw in front of the seat even when sitting right on its tile.
    const d = this.map.characterDepth(this.gx, this.gy) + (this.pose === 'sit' ? 2 : 0);
    this.shadow.setDepth(d - 0.5);
    this.sprite.setDepth(d);
  }
}
