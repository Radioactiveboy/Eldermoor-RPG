import Phaser from 'phaser';
import { FEET_Y, FRAME_H, IDLE_FRAME_RATE } from '../art/character';
import { sheetScale } from '../art/fine3d';
import { FIGHT_ORIGIN_Y, WINDUP_MS } from '../art/fight3d';
import { DIRECTIONS_8 } from '../art/figure3d';
import { PLAYER_SPEED, SPRINT_MULTIPLIER } from '../config';
import { gridToScreen, Vec2 } from '../iso/IsoMath';
import { COMPANIONS, CompanionDef, CompanionId } from '../systems/Companions';
import { stepAround } from '../world/Avoidance';
import type { IsoMap } from '../world/IsoMap';

/** How far behind the hero the first companion walks, in tiles, and how much further back each one after. */
export const FOLLOW_GAP = 1.3;
export const FOLLOW_SPACING = 1.1;
/** Further behind than this (lost round a corner, left behind by a door) and they catch up at once. */
const LOST = 9;
/** How wide they are, for keeping out of the hero's way (as wide as the hero). */
const RADIUS = 0.25;
/** The hero's trail is noted each time they've gone this far. */
const CRUMB = 0.2;

/**
 * The hero's footsteps, for companions to walk in: the points the hero has
 * passed through, oldest first, so that whoever follows goes round the same
 * corners rather than through walls.
 */
export class Trail {
  points: Vec2[] = [];

  reset(at: Vec2): void {
    this.points = [{ ...at }];
  }

  /** Note where the hero is now, if they've moved far enough since the last point. */
  note(at: Vec2): void {
    const last = this.points[this.points.length - 1];
    if (!last) {
      this.points.push({ ...at });
      return;
    }
    if (Math.hypot(at.x - last.x, at.y - last.y) >= CRUMB) this.points.push({ ...at });
    // Nobody follows more than a few tiles back, so the far end can go.
    if (this.points.length > 200) this.points.splice(0, this.points.length - 200);
  }

  /** The point on the trail `gap` tiles back from the hero (or the oldest one, and `short`, if the trail isn't that long). */
  behind(hero: Vec2, gap: number): { point: Vec2; index: number; short?: boolean } {
    let left = gap;
    let from = hero;
    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i];
      const d = Math.hypot(p.x - from.x, p.y - from.y);
      if (d >= left) {
        const t = left / d;
        return { point: { x: from.x + (p.x - from.x) * t, y: from.y + (p.y - from.y) * t }, index: i };
      }
      left -= d;
      from = p;
    }
    return { point: { ...(this.points[0] ?? hero) }, index: 0, short: true };
  }
}

/**
 * Someone travelling with the hero (see systems/Companions.ts): they walk in
 * the hero's footsteps a little way behind, keeping up when the hero runs,
 * and stand and look about when the hero stops. In a fight, CombatScene moves
 * them about itself (moveTo, offset), and they stay where they're put.
 */
export class Companion {
  readonly id: CompanionId;
  readonly def: CompanionDef;
  gx: number;
  gy: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly map: IsoMap;
  /** Facing as one of 8 screen directions: 0 = south, 2 = east, 4 = north, 6 = west. */
  private facing = 0;
  /** Screen-pixel nudge for the sprite, for lunges and flinches in a fight. */
  readonly offset = { x: 0, y: 0 };
  /** Their place in the line behind the hero: 0 walks closest. */
  place: number;
  /** Knocked down in a fight: drawn lying low and greyed until they're up again. */
  down = false;
  /** Something said out loud, shown in a bubble over their head (see ui/SpeechBubbles.ts). */
  speech?: string;
  private speechLeft = 0;
  /** Seconds standing still, for an idle look about now and then. */
  private still = 0;
  private gone = false;
  private moving = false;
  /** In a fight, the fight animation showing ('ready', 'attack', 'hit', 'guard', 'down': see art/fight3d.ts). */
  private fighting?: string;

  constructor(scene: Phaser.Scene, map: IsoMap, id: CompanionId, gx: number, gy: number, place: number) {
    this.id = id;
    this.def = COMPANIONS[id];
    this.map = map;
    this.gx = gx;
    this.gy = gy;
    this.place = place;
    this.shadow = scene.add.image(0, 0, 'shadow');
    // Drawn finer than they stand, like the hero (see art/fine3d.ts).
    this.sprite = scene.add.sprite(0, 0, this.def.texture, 0).setOrigin(0.5, (FEET_Y + 0.5) / FRAME_H).setScale(1 / sheetScale(scene, this.def.texture));
    this.sync();
  }

  get name(): string {
    return this.def.short;
  }

  /** How far behind the hero they keep. */
  get gap(): number {
    return FOLLOW_GAP + this.place * FOLLOW_SPACING;
  }

  /** The top of their head, where a speech bubble's tail points. */
  get speechPoint(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y - FEET_Y + 7 };
  }

  /** World position just above their head, for the talk prompt. */
  get promptPoint(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y - FEET_Y - 6 };
  }

  say(text: string, seconds = 4): void {
    this.speech = text;
    this.speechLeft = seconds;
  }

  distanceTo(gx: number, gy: number): number {
    return Math.hypot(gx - this.gx, gy - this.gy);
  }

  /** Stand somewhere at once. */
  /** Out of sight for a while (gone aboard the Heron with the hero, say), or back again. */
  setShown(shown: boolean): void {
    this.sprite.setVisible(shown);
    this.shadow.setVisible(shown);
  }

  placeAt(gx: number, gy: number): void {
    this.gx = gx;
    this.gy = gy;
    this.sync();
  }

  /**
   * Keep up with the hero, along their trail. `paused` (a conversation, a
   * menu, a fight) keeps them where they are.
   */
  update(dt: number, hero: Vec2, trail: Trail, paused: boolean, heroSpeed: number): void {
    if (this.gone) return;
    if (this.speech && !paused) {
      this.speechLeft -= dt;
      if (this.speechLeft <= 0) this.speech = undefined;
    }
    if (paused) {
      this.moving = false;
      this.sync();
      return;
    }
    const lag = this.distanceTo(hero.x, hero.y);
    if (lag > LOST + this.gap) {
      // Left far behind (the hero ran off, or came out of a door): catch up out of sight.
      const spot = trail.behind(hero, this.gap).point;
      this.placeAt(spot.x, spot.y);
      return;
    }
    const onTrail = trail.behind(hero, this.gap);
    const target = onTrail.point;
    const dx = target.x - this.gx;
    const dy = target.y - this.gy;
    const dist = Math.hypot(dx, dy);
    // Close enough to where they'd be: stand, facing the hero, and now and then look about.
    // (The hero has hardly gone anywhere yet: no need to bunch up on the one spot they've been.)
    if (dist < 0.12 || lag < this.gap * 0.85 || (onTrail.short && lag < this.gap + 1)) {
      this.moving = false;
      this.still += dt;
      if (lag > 0.3) this.face({ x: hero.x - this.gx, y: hero.y - this.gy });
      if (this.still > 4 && Math.random() < dt * 0.25) {
        this.facing = (this.facing + (Math.random() < 0.5 ? 1 : 7)) % 8;
        this.still = 0;
      }
      this.sync();
      return;
    }
    this.still = 0;
    // As fast as the hero is going, and a little faster when they've dropped back.
    const behind = dist > 0.6 ? 1.25 : 1;
    const speed = Math.min(PLAYER_SPEED * SPRINT_MULTIPLIER * 1.15, Math.max(PLAYER_SPEED * 0.9, heroSpeed) * behind);
    const step = Math.min(dist, speed * dt);
    // Never through the hero (who may have doubled back towards them): round, or wait.
    const to = stepAround({ x: this.gx, y: this.gy }, target, step, RADIUS, this.map.heroInTheWay);
    this.face({ x: dx, y: dy });
    this.moving = !!to;
    if (to) {
      this.gx = to.x;
      this.gy = to.y;
    }
    this.sync();
  }

  /** Walk to a spot (taking their place in a fight). */
  moveTo(gx: number, gy: number, ms: number): Promise<void> {
    if (Math.hypot(gx - this.gx, gy - this.gy) < 0.05) return Promise.resolve();
    this.faceTowards(gx, gy);
    this.moving = true;
    return new Promise((resolve) => {
      this.sprite.scene.tweens.add({
        targets: this,
        gx,
        gy,
        duration: ms,
        onUpdate: () => this.sync(),
        onComplete: () => {
          this.moving = false;
          this.sync();
          resolve();
        },
      });
    });
  }

  faceTowards(gx: number, gy: number): void {
    this.face({ x: gx - this.gx, y: gy - this.gy });
    this.sync();
  }

  /** Knocked off their feet in a fight (greyed and sunk a little), or back up again. */
  setDown(down: boolean): void {
    this.down = down;
    if (down) this.sprite.setTint(0x8a8a8a);
    else this.sprite.clearTint();
    this.sync();
  }

  /**
   * Squares up for a fight (or, with nothing, stands easy again), like the hero
   * (see Player.fight). Knocked down, they show 'down' whatever this says.
   */
  fight(anim?: string): void {
    this.fighting = anim;
    if (anim) this.sprite.anims.stop();
    this.sync();
  }

  ready(): void {
    if (this.fighting !== 'ready') this.fight('ready');
  }

  /** Wind up and swing; returns how long the wind-up takes, in ms. */
  strike(): number {
    this.fight('attack');
    return this.showingFight ? WINDUP_MS : 0;
  }

  /** Whether they're in a fight and have the frames for it (see art/fight3d.ts). */
  private get showingFight(): boolean {
    return !!this.fighting && this.sprite.scene.anims.exists(`${this.def.texture}-ready-s`);
  }

  /** Off back to where they wait: a few steps away, fading as they go, and gone. */
  leave(away: Vec2, then?: () => void): void {
    this.gone = true;
    this.speech = undefined;
    this.faceTowards(away.x, away.y);
    this.moving = true;
    const scene = this.sprite.scene;
    scene.tweens.add({ targets: this, gx: away.x, gy: away.y, duration: 1400, onUpdate: () => this.sync() });
    scene.tweens.add({
      targets: [this.sprite, this.shadow],
      alpha: 0,
      delay: 700,
      duration: 700,
      onComplete: () => {
        this.destroy();
        then?.();
      },
    });
  }

  destroy(): void {
    this.gone = true;
    this.sprite.scene?.tweens.killTweensOf([this, this.sprite, this.shadow]);
    this.sprite.destroy();
    this.shadow.destroy();
  }

  get isGone(): boolean {
    return this.gone;
  }

  private face(dir: Vec2): void {
    if (dir.x === 0 && dir.y === 0) return;
    const screen = gridToScreen(dir.x, dir.y);
    this.facing = (Math.round(Math.atan2(screen.x, screen.y) / (Math.PI / 4)) + 8) % 8;
  }

  private sync(): void {
    if (!this.sprite.active) return;
    const p = gridToScreen(this.gx, this.gy);
    this.shadow.setPosition(p.x, p.y);
    const fightFrames = this.showingFight;
    // Knocked down in a fight, they're drawn on one knee; otherwise sat, and sunk a little.
    this.sprite.setPosition(p.x + this.offset.x, p.y + this.offset.y + (this.down && !fightFrames ? 5 : 0));
    const d = this.map.characterDepth(this.gx, this.gy);
    this.shadow.setDepth(d - 0.5);
    this.sprite.setDepth(d);
    if (fightFrames && !this.moving) {
      const key = `${this.def.texture}-${this.down ? 'down' : this.fighting}-${DIRECTIONS_8[this.facing].name}`;
      if (this.sprite.anims.currentAnim?.key !== key) this.sprite.setOrigin(0.5, FIGHT_ORIGIN_Y).play(key);
      return;
    }
    this.sprite.setOrigin(0.5, (FEET_Y + 0.5) / FRAME_H);
    const pose = this.down ? 'sit' : this.moving ? 'walk' : 'idle';
    const key = `${this.def.texture}-${pose}-${DIRECTIONS_8[this.facing].name}`;
    if (pose === 'idle') this.sprite.play({ key, frameRate: IDLE_FRAME_RATE }, true);
    else this.sprite.play(key, true);
  }
}
