import Phaser from 'phaser';
import { BEAST_COLS } from '../art/beasts3d';
import { CREATURE_ART, CREATURE_FRAME } from '../art/creatures';
import { DIRECTIONS_8 } from '../art/figure3d';
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
  // She keeps close to her lair, and sees you coming from further off.
  wolfmother: { shy: false, notice: 4.5, leash: 2.5, speed: 1.4 },
  boar: { shy: false, notice: 2.6, leash: 4, speed: 1.2 },
  deer: { shy: true, notice: 0, leash: 7, speed: 1.3 },
  hare: { shy: true, notice: 0, leash: 5, speed: 1.8 },
  // Wild cats lie up in the north woods' thickets and let you come close before they spring.
  wildcat: { shy: false, notice: 2.2, leash: 3, speed: 1.7 },
  // Scurrying about their nests in the cellar, and quick to come at anyone with a lamp.
  rat: { shy: false, notice: 2.6, leash: 2, speed: 1.9 },
  // Footpads only come to blows when talked into it (see world/PlainsEvents.ts): they never pick a fight by themselves.
  footpad: { shy: false, notice: 0, leash: 1, speed: 1.4 },
  cutpurse: { shy: false, notice: 0, leash: 1, speed: 1.5 },
  // The raiding goblins are set on by the story (see world/GoblinRaid.ts), never by wandering close.
  goblin: { shy: false, notice: 0, leash: 2.5, speed: 1.9 },
  goblinspear: { shy: false, notice: 0, leash: 2.5, speed: 1.7 },
  goblintorch: { shy: false, notice: 0, leash: 3, speed: 2 },
  goblinbrute: { shy: false, notice: 0, leash: 1.5, speed: 1.3 },
  // The brigands in the beacon tower only fight when it comes to it in talk (see scenes/game/beacon.ts).
  brigandcaptain: { shy: false, notice: 0, leash: 1, speed: 1.4 },
  brigandbrute: { shy: false, notice: 0, leash: 1, speed: 1.2 },
  brigandcutter: { shy: false, notice: 0, leash: 1, speed: 1.6 },
  brigandarcher: { shy: false, notice: 0, leash: 1, speed: 1.6 },
  // The Red Aprons in the pit barn, the same (see scenes/game/shambles.ts).
  apronflay: { shy: false, notice: 0, leash: 1, speed: 1.6 },
  apronknacker: { shy: false, notice: 0, leash: 1, speed: 1.2 },
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
  /** Drawn in all eight directions (modelled in 3D, see beasts3d.ts), rather than side-on and mirrored. */
  private readonly eight: boolean;
  /** How many frames each direction's row of its sheet holds (more for the goblins, see goblins3d.ts). */
  private readonly cols: number;
  /** Which of DIRECTIONS_8 it faces. */
  private facing = Math.floor(Math.random() * 8);
  /** The animation playing ('walk', 'sniff', 'idle'), or the frame it's held on. */
  private showing: { anim: string } | { frame: number } = { anim: 'sniff' };

  /** Curled up asleep (goblins in their sleeping holes): lies still until it notices the hero, then is up and at them. */
  private sleeping = false;
  private snores?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, map: IsoMap, id: string, kind: FoeKind, gx: number, gy: number, notice?: number, asleep = false) {
    this.scene = scene;
    this.map = map;
    this.id = id;
    this.kind = kind;
    this.gx = gx;
    this.gy = gy;
    this.home = { x: gx, y: gy };
    this.ways = notice === undefined ? WAYS[kind] : { ...WAYS[kind], notice };
    const art = CREATURE_ART[kind];
    this.eight = !!art.eight;
    const scale = art.scale ?? 1;
    this.cols = art.cols ?? BEAST_COLS;
    const small = kind === 'hare' || kind === 'rat' || kind === 'wildcat';
    const upright = kind === 'footpad' || kind === 'cutpurse' || kind.startsWith('goblin') || kind.startsWith('brigand') || kind.startsWith('apron');
    const big = kind === 'goblinbrute' || kind === 'brigandbrute' || kind === 'apronknacker';
    this.shadow = scene.add.image(0, 0, 'shadow').setScale((small ? 0.7 : big ? 1.5 : upright ? 1 : 1.4) * scale, (small ? 0.6 : big ? 1.3 : 1) * scale);
    // A sheet drawn finer than it's shown (the goblins') is scaled down by as much.
    this.sprite = scene.add.sprite(0, 0, `creature-${kind}`, 0).setOrigin(0.5, (art.feetY + 0.5) / art.h).setScale(scale / (art.res ?? 1));
    // A fight animation played once ends on its last frame: hold that, so turning to face someone keeps it.
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if ('anim' in this.showing && anim.key === this.animKey(this.showing.anim)) this.showing = { frame: Number(frame.frame.name) % this.cols };
    });
    this.sprite.play({ key: this.animKey('sniff'), startFrame: Math.floor(Math.random() * 4) });
    if (!this.eight) this.sprite.setFlipX(Math.random() < 0.5);
    this.timer = 1 + Math.random() * 3;
    map.bodies.add(this);
    if (asleep) this.fallAsleep();
    this.sync();
  }

  /** Lie down on its side, with now and then a snore drifting up. */
  private fallAsleep(): void {
    this.sleeping = true;
    this.setFrame(0);
    this.sprite.setAngle(this.sprite.flipX ? 78 : -78);
    this.snores = this.scene.add.text(0, 0, 'z', { fontFamily: 'serif', fontSize: '13px', color: '#dfe6f0', fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0);
    const drift = () => {
      if (!this.sleeping || !this.snores) return;
      const p = gridToScreen(this.gx, this.gy);
      this.snores.setPosition(p.x + 6, p.y - 16).setAlpha(0.9).setText(Math.random() < 0.5 ? 'z' : 'Z');
      this.snores.setDepth(this.sprite.depth + 1);
      this.scene.tweens.add({ targets: this.snores, y: p.y - 40, x: p.x + 14, alpha: 0, duration: 1800, onComplete: () => this.scene.time.delayedCall(600 + Math.random() * 1600, drift) });
    };
    this.scene.time.delayedCall(Math.random() * 2000, drift);
  }

  /** Up off the floor. */
  private wake(): void {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.sprite.setAngle(0);
    this.snores?.destroy();
    this.snores = undefined;
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
   * @param noise how far off the player can be noticed, as a share of the usual
   *   distance: under 1 while they sneak, over 1 while they sprint
   */
  update(dt: number, player?: Vec2, running = false, noise = 1): boolean {
    this.calm = Math.max(0, this.calm - dt);
    if (this.state === 'gone' || this.state === 'fight') {
      this.sync();
      return false;
    }
    if (this.state === 'alert') {
      this.sync();
      return false;
    }
    if (player && this.prowling && this.distanceTo(player.x, player.y) < this.ways.notice * noise) {
      this.wake();
      this.state = 'alert';
      this.path = [];
      this.faceTowards(player.x, player.y);
      this.ready();
      this.sync();
      return true;
    }
    if (this.sleeping) {
      this.sync();
      return false;
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
    this.wake();
    this.state = 'fight';
    this.path = [];
    this.ready();
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
    if (!this.once('die')) this.setFrame(CREATURE_FRAME.dead);
    this.shadow.setVisible(false);
    this.sprite.setDepth(depthAt(this.gx, this.gy) - 1);
  }

  /** Taken off the map altogether (a pack that has moved on). */
  destroy(): void {
    this.wake();
    this.state = 'gone';
    this.map.bodies.delete(this);
    this.sprite.destroy();
    this.shadow.destroy();
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
    this.play('walk').anims.timeScale = 1.8;
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
    this.play('walk');
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        gx,
        gy,
        duration: ms,
        onUpdate: () => this.sync(),
        onComplete: () => {
          this.ready();
          this.sync();
          resolve();
        },
      });
    });
  }

  /**
   * Turn towards a point. A beast drawn in eight directions turns to the
   * nearest of them (keeping its place in whatever it's doing); one drawn
   * side-on facing screen-right is mirrored to face left.
   */
  faceTowards(gx: number, gy: number): void {
    const screen = gridToScreen(gx - this.gx, gy - this.gy);
    if (!this.eight) {
      if (Math.abs(screen.x) > 2) this.sprite.setFlipX(screen.x < 0);
      return;
    }
    if (Math.hypot(screen.x, screen.y) < 0.5) return;
    const facing = (Math.round(Math.atan2(screen.x, screen.y) / (Math.PI / 4)) + 8) % 8;
    if (facing === this.facing) return;
    this.facing = facing;
    if ('frame' in this.showing) this.setFrame(this.showing.frame);
    else if (this.sprite.anims.isPlaying) {
      const at = this.sprite.anims.currentFrame?.index ?? 1;
      const timeScale = this.sprite.anims.timeScale;
      this.sprite.play({ key: this.animKey(this.showing.anim), startFrame: at - 1 }).anims.timeScale = timeScale;
    }
  }

  /** The frame to show it by (in the fight's turn order): standing, turned three-quarters to the viewer. */
  get portraitFrame(): number {
    return this.eight ? 1 * this.cols : 0;
  }

  /** Hold on one of the frames in {@link CREATURE_FRAME}'s order, in the direction it faces. */
  setFrame(frame: number): void {
    this.showing = { frame };
    this.sprite.stop().setFrame(this.eight ? this.facing * this.cols + frame : frame);
  }

  /** Whether its sheet has an animation of this name (the goblins have fight animations, see goblins3d.ts). */
  private has(anim: string): boolean {
    return this.scene.anims.exists(this.animKey(anim));
  }

  /** Plays a one-off animation if its sheet has it, ending on its last frame. */
  private once(anim: string): boolean {
    if (!this.has(anim)) return false;
    this.sprite.anims.timeScale = 1;
    this.play(anim);
    return true;
  }

  /** Squared up for a fight: the fighting crouch, bobbing (or held on the snarl, for a beast). */
  ready(): void {
    if (this.has('ready')) {
      if ('anim' in this.showing && this.showing.anim === 'ready' && this.sprite.anims.isPlaying) return;
      this.sprite.anims.timeScale = 1;
      this.play('ready');
    } else this.setFrame(CREATURE_FRAME.snarl);
  }

  /**
   * Attack: wind up and swing (or, for a beast, the bite frame). Returns how
   * long the wind-up takes, in ms, for the lunge to wait on.
   */
  strike(): number {
    if (this.once('attack')) return 150;
    this.setFrame(CREATURE_FRAME.bite);
    return 0;
  }

  /** Struck: reel back and recover (or the hurt frame, for a beast). */
  flinch(): void {
    if (!this.once('hit')) this.setFrame(CREATURE_FRAME.hurt);
  }

  /** Jeer at the foe, if it's the sort to (the goblins). */
  taunt(): boolean {
    return this.once('taunt');
  }

  private animKey(anim: string): string {
    return this.eight ? `${this.kind}-${anim}-${DIRECTIONS_8[this.facing].name}` : `${this.kind}-${anim}`;
  }

  private play(anim: string): Phaser.GameObjects.Sprite {
    this.showing = { anim };
    return this.sprite.play(this.animKey(anim));
  }

  /** Stand and sniff the ground (or graze), or now and then lift the head to look around. */
  private rest(): void {
    this.bolting = false;
    this.sprite.anims.timeScale = 1;
    if (Math.random() < 0.35) {
      this.state = 'look';
      this.play('idle');
      this.timer = 1.2 + Math.random() * 1.5;
    } else {
      this.state = 'sniff';
      this.play('sniff');
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
      this.play('walk').anims.timeScale = 1.8;
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
      this.play('walk');
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
