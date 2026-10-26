import Phaser from 'phaser';
import { HEN_FEET_Y, HEN_FRAME, HenKind } from '../art/henfarm';
import { gridToScreen, Vec2 } from '../iso/IsoMath';
import type { IsoMap } from '../world/IsoMap';
import type { HenPen } from '../world/MapData';

const WALK_SPEED = 0.9;
/** Hens scurry off when the player comes this close. */
const SHY_RANGE = 1.1;
const SCURRY_SPEED = 2.6;
/** Small enough to slip between fence rails' posts without getting stuck on them. */
const RADIUS = 0.15;

type State = 'idle' | 'peck' | 'walk';

/**
 * One of Farmer Iran's hens (or his rooster), pottering about the pen: pecking
 * at the ground, strutting somewhere new, and scurrying out of the player's
 * way. They never leave the pen, and they're shut in the coop at night.
 */
export class Hen {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly map: IsoMap;
  private readonly pen: HenPen;
  private readonly key: string;
  private gx: number;
  private gy: number;
  private state: State = 'idle';
  private timer: number;
  private target?: Vec2;
  private speed = WALK_SPEED;

  constructor(scene: Phaser.Scene, map: IsoMap, pen: HenPen, kind: HenKind, gx: number, gy: number) {
    this.map = map;
    this.pen = pen;
    this.gx = gx;
    this.gy = gy;
    this.key = `hen-${kind}`;
    this.shadow = scene.add.image(0, 0, 'shadow').setScale(0.5, 0.6);
    this.sprite = scene.add.sprite(0, 0, this.key, 0).setOrigin(0.5, (HEN_FEET_Y + 0.5) / HEN_FRAME);
    this.sprite.setFlipX(Math.random() < 0.5);
    this.timer = Math.random() * 3;
    this.setState(Math.random() < 0.5 ? 'peck' : 'idle');
    this.sync();
  }

  /** Roosting in the coop: hidden, and nothing to do. */
  set roosting(on: boolean) {
    this.sprite.setVisible(!on);
    this.shadow.setVisible(!on);
  }

  update(dt: number, player: Vec2): void {
    if (!this.sprite.visible) return;
    const away = { x: this.gx - player.x, y: this.gy - player.y };
    const near = Math.hypot(away.x, away.y);
    if (near < SHY_RANGE && this.speed !== SCURRY_SPEED) this.scurry(away);

    if (this.state === 'walk' && this.target) {
      const dx = this.target.x - this.gx;
      const dy = this.target.y - this.gy;
      const dist = Math.hypot(dx, dy);
      const step = Math.min(dist, this.speed * dt);
      const nx = this.gx + (dx / dist) * step;
      const ny = this.gy + (dy / dist) * step;
      if (dist < 0.02 || this.map.blocked(nx, ny, RADIUS, false)) {
        this.target = undefined;
        this.speed = WALK_SPEED;
        this.setState(Math.random() < 0.65 ? 'peck' : 'idle');
        this.timer = 1.5 + Math.random() * 3;
      } else {
        this.gx = nx;
        this.gy = ny;
        const screenDx = gridToScreen(dx, dy).x;
        if (Math.abs(screenDx) > 0.5) this.sprite.setFlipX(screenDx < 0);
      }
      this.sync();
      return;
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    if (Math.random() < 0.55) {
      this.wander();
    } else {
      this.setState(this.state === 'peck' ? 'idle' : 'peck');
      this.timer = 1.5 + Math.random() * 3;
    }
  }

  /** Strut off to somewhere else in the pen. */
  private wander(): void {
    for (let tries = 0; tries < 6; tries++) {
      const x = this.gx + (Math.random() * 2 - 1) * 2.5;
      const y = this.gy + (Math.random() * 2 - 1) * 2.5;
      if (this.goTo({ x, y })) return;
    }
    this.timer = 1;
  }

  /** Run a little way from whoever came too close. */
  private scurry(away: Vec2): void {
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2]) {
      const a = Math.atan2(away.y, away.x) + turn;
      const reach = 1.2 + Math.random() * 0.6;
      if (this.goTo({ x: this.gx + Math.cos(a) * reach, y: this.gy + Math.sin(a) * reach }, SCURRY_SPEED)) return;
    }
  }

  private goTo(p: Vec2, speed = WALK_SPEED): boolean {
    const { x0, y0, x1, y1 } = this.pen;
    const target = { x: Phaser.Math.Clamp(p.x, x0 + 0.3, x1 - 0.3), y: Phaser.Math.Clamp(p.y, y0 + 0.3, y1 - 0.3) };
    if (Math.hypot(target.x - this.gx, target.y - this.gy) < 0.4) return false;
    if (!this.map.segmentClear({ x: this.gx, y: this.gy }, target, RADIUS)) return false;
    this.target = target;
    this.speed = speed;
    this.setState('walk');
    return true;
  }

  private setState(state: State): void {
    this.state = state;
    this.sprite.play({ key: `${this.key}-${state}`, startFrame: state === 'walk' ? 0 : Math.floor(Math.random() * 2) }, true);
    this.sprite.anims.timeScale = this.speed === SCURRY_SPEED ? 2 : 1;
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
