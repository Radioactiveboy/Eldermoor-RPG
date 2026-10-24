import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { depthAt, gridToScreen, screenToGrid, Vec2 } from '../iso/IsoMath';
import type { TimeOfDay } from '../systems/TimeOfDay';
import type { IsoMap } from './IsoMap';
import { Prop, Terrain } from './MapData';

/** Drawn over everything in the world (but under the HUD, which is its own scene). */
const SKY_DEPTH = 90000;
/** Light falling on the ground: above the ground and props' shadows, below anything standing. */
const GROUND_FX_DEPTH = 0.4;

/** A light the HUD's night overlay should brighten (a firefly), in world pixels. */
export interface WorldLight {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

interface Flyer {
  sprite: Phaser.GameObjects.Sprite;
  shadow?: Phaser.GameObjects.Image;
  /** Position on the ground under it, in world pixels, and height above it. */
  x: number;
  y: number;
  height: number;
  vx: number;
  vy: number;
  /** Bats wheel about instead of flying straight. */
  turn?: number;
  life: number;
}

interface Sparrow {
  sprite: Phaser.GameObjects.Sprite;
  gx: number;
  gy: number;
  next: number;
}

interface Butterfly {
  sprite: Phaser.GameObjects.Sprite;
  gx: number;
  gy: number;
  heading: number;
  t: number;
}

interface Firefly {
  dot: Phaser.GameObjects.Rectangle;
  gx: number;
  gy: number;
  heading: number;
  phase: number;
  glow: number;
}

/**
 * Keeps the outdoor world moving: light glinting on the lake and foam lapping
 * its shore, fish rising, flocks of birds passing over by day and bats at
 * dusk, sparrows hopping about that scatter when someone comes near,
 * butterflies, fireflies at night, cloud shadows drifting over, smoke from the
 * chimney and the odd leaf falling.
 *
 * Nothing here affects play; it all lives near the camera and is thrown away
 * when it drifts out of view.
 */
export class Ambience {
  private readonly scene: Phaser.Scene;
  private readonly map: IsoMap;
  private readonly clock: TimeOfDay;
  private readonly water: Vec2[] = [];
  private readonly foam: Array<{ image: Phaser.GameObjects.Image; phase: number }> = [];
  private readonly treeImages: Phaser.GameObjects.Image[] = [];
  private readonly flyers: Flyer[] = [];
  private sparrows: Sparrow[] = [];
  private readonly butterflies: Butterfly[] = [];
  private readonly fireflies: Firefly[] = [];
  private readonly clouds: Phaser.GameObjects.Image[] = [];
  private time = 0;
  private flockTimer = 4;
  private rippleTimer = 2;
  private sparrowTimer = 3;
  private smokeTimer = 0;
  private leafTimer = 1;
  private chirpTimer = 4;

  constructor(scene: Phaser.Scene, map: IsoMap, clock: TimeOfDay) {
    this.scene = scene;
    this.map = map;
    this.clock = clock;
    this.dressWater();
    for (const t of map.trees.values()) this.treeImages.push(t.image);
    for (let i = 0; i < 3; i++) this.clouds.push(this.makeCloud(true));
  }

  /** Where the sun is up enough for birds and butterflies. */
  private get daytime(): boolean {
    const h = this.clock.hour;
    return h > 6.5 && h < 19.5;
  }

  private get night(): boolean {
    return this.clock.ambient.darkness > 0.45;
  }

  update(dt: number, view: Phaser.Geom.Rectangle, player: Vec2): void {
    this.time += dt;
    this.updateFoam();
    this.updateRipples(dt, view);
    this.updateFlyers(dt, view);
    this.updateSparrows(dt, view, player);
    this.updateButterflies(dt, view);
    this.updateFireflies(dt, view);
    this.updateClouds(dt);
    this.updateSmoke(dt);
    this.updateLeaves(dt, view);
  }

  /** Fireflies' glow, for the night-time lighting. */
  lights(): WorldLight[] {
    return this.fireflies
      .filter((f) => f.glow > 0.05)
      .map((f) => ({ x: f.dot.x, y: f.dot.y, radius: 16, alpha: f.glow * 0.55 }));
  }

  // ------------------------------------------------------------ water

  /** Glints on every water tile, and foam where it meets the shore. */
  private dressWater(): void {
    const { width, height, terrain } = this.map.data;
    const isWater = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= height || terrain[y][x] === Terrain.Water;
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (terrain[ty][tx] !== Terrain.Water) continue;
        const c = gridToScreen(tx + 0.5, ty + 0.5);
        this.water.push({ x: tx + 0.5, y: ty + 0.5 });
        this.scene.add
          .sprite(c.x, c.y, 'water-shimmer')
          .setDepth(GROUND_FX_DEPTH)
          .play({ key: 'water-shimmer', startFrame: (tx * 3 + ty * 5) % 8 });
        const edges =
          (isWater(tx, ty - 1) ? 0 : 1) | (isWater(tx, ty + 1) ? 0 : 2) | (isWater(tx - 1, ty) ? 0 : 4) | (isWater(tx + 1, ty) ? 0 : 8);
        if (edges) {
          const image = this.scene.add.image(c.x, c.y, `water-foam-${edges}`).setDepth(GROUND_FX_DEPTH + 0.01);
          // Neighbouring tiles are a little out of step, so the lapping travels round the shore.
          this.foam.push({ image, phase: (tx + ty) * 0.45 });
        }
      }
    }
  }

  private updateFoam(): void {
    for (const f of this.foam) f.image.setAlpha(0.45 + 0.4 * Math.sin(this.time * 1.4 + f.phase));
  }

  /** Every so often a fish rises somewhere on the lake in view. */
  private updateRipples(dt: number, view: Phaser.Geom.Rectangle): void {
    this.rippleTimer -= dt;
    if (this.rippleTimer > 0 || this.water.length === 0) return;
    this.rippleTimer = 1.5 + Math.random() * 3;
    const visible = this.water.filter((w) => view.contains(gridToScreen(w.x, w.y).x, gridToScreen(w.x, w.y).y));
    if (visible.length === 0) return;
    const w = visible[Math.floor(Math.random() * visible.length)];
    const p = gridToScreen(w.x + (Math.random() - 0.5) * 0.6, w.y + (Math.random() - 0.5) * 0.6);
    const ring = this.scene.add.sprite(p.x, p.y, 'ripple').setDepth(GROUND_FX_DEPTH + 0.02);
    ring.play('ripple');
    ring.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => ring.destroy());
  }

  // ------------------------------------------------------------ birds and bats

  private updateFlyers(dt: number, view: Phaser.Geom.Rectangle): void {
    this.flockTimer -= dt;
    if (this.flockTimer <= 0) {
      const dusk = this.clock.hour > 18.5 || this.clock.hour < 5.5;
      if (this.daytime) this.spawnFlock(view);
      else if (dusk && this.flyers.length < 3) this.spawnBats(view);
      this.flockTimer = this.daytime ? 10 + Math.random() * 18 : 6 + Math.random() * 8;
    }
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.life -= dt;
      if (f.turn !== undefined) {
        // Bats: jink about, wheeling in loose circles.
        f.turn += (Math.random() - 0.5) * 9 * dt;
        f.turn = Phaser.Math.Clamp(f.turn, -3, 3);
        const a = Math.atan2(f.vy, f.vx) + f.turn * dt;
        const speed = 70;
        f.vx = Math.cos(a) * speed;
        f.vy = Math.sin(a) * speed;
        f.height = 50 + Math.sin(this.time * 3 + i) * 12;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.sprite.setPosition(f.x, f.y - f.height).setFlipX(f.vx < 0);
      f.shadow?.setPosition(f.x, f.y);
      const gone = f.life <= 0 && !Phaser.Geom.Rectangle.Contains(Phaser.Geom.Rectangle.Inflate(Phaser.Geom.Rectangle.Clone(view), 80, 80), f.x, f.y - f.height);
      if (gone) {
        f.sprite.destroy();
        f.shadow?.destroy();
        this.flyers.splice(i, 1);
      }
    }
  }

  /** A loose flock crossing the view from one side to the other, their shadows sliding over the ground. */
  private spawnFlock(view: Phaser.Geom.Rectangle): void {
    const fromLeft = Math.random() < 0.5;
    const dir = fromLeft ? 1 : -1;
    const x0 = fromLeft ? view.left - 60 : view.right + 60;
    const y0 = view.top + view.height * (0.3 + Math.random() * 0.6);
    const vy = (Math.random() - 0.5) * 40;
    const count = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const sprite = this.scene.add.sprite(0, 0, 'bird').setDepth(SKY_DEPTH);
      sprite.play({ key: 'bird-fly', startFrame: i % 3 });
      sprite.anims.timeScale = 0.8 + Math.random() * 0.4;
      const shadow = this.scene.add.image(0, 0, 'shadow').setScale(0.3, 0.35).setAlpha(0.5).setDepth(GROUND_FX_DEPTH + 0.1);
      this.flyers.push({
        sprite,
        shadow,
        x: x0 - dir * i * (14 + Math.random() * 10),
        y: y0 + (Math.random() - 0.5) * 50,
        height: 70 + Math.random() * 40,
        vx: dir * (80 + Math.random() * 15),
        vy,
        life: 8,
      });
    }
  }

  /** At dusk and through the night, a few bats flit about near the player. */
  private spawnBats(view: Phaser.Geom.Rectangle): void {
    for (let i = 0; i < 2; i++) {
      const sprite = this.scene.add.sprite(0, 0, 'bat').setDepth(SKY_DEPTH);
      sprite.play({ key: 'bat-fly', startFrame: i });
      const a = Math.random() * Math.PI * 2;
      this.flyers.push({
        sprite,
        x: view.centerX + Math.cos(a) * view.width * 0.4,
        y: view.centerY + Math.sin(a) * view.height * 0.4,
        height: 50,
        vx: -Math.cos(a) * 70,
        vy: -Math.sin(a) * 70,
        turn: 0,
        life: 10 + Math.random() * 8,
      });
    }
  }

  /** A few sparrows hop and peck on the grass, and take fright when anyone comes close. */
  private updateSparrows(dt: number, view: Phaser.Geom.Rectangle, player: Vec2): void {
    this.sparrowTimer -= dt;
    if (this.sparrowTimer <= 0) {
      this.sparrowTimer = 6 + Math.random() * 8;
      if (this.daytime && this.sparrows.length < 6) this.spawnSparrows(view, player);
    }
    const people: Vec2[] = [player, ...[...this.map.bodies].map((b) => ({ x: b.gx, y: b.gy }))];
    for (const s of this.sparrows) {
      if (people.some((p) => Math.hypot(p.x - s.gx, p.y - s.gy) < 2.6)) {
        this.scatter(s, player);
        continue;
      }
      s.next -= dt;
      if (s.next > 0) continue;
      s.next = 0.4 + Math.random() * 1.6;
      if (Math.random() < 0.5) {
        s.sprite.setFrame(1); // peck
        this.scene.time.delayedCall(220, () => s.sprite.active && s.sprite.setFrame(0));
      } else {
        // A little hop.
        const nx = s.gx + (Math.random() - 0.5) * 0.5;
        const ny = s.gy + (Math.random() - 0.5) * 0.5;
        if (this.map.blocked(nx, ny, 0.05, false)) continue;
        s.gx = nx;
        s.gy = ny;
        const p = gridToScreen(nx, ny);
        s.sprite.setFlipX(p.x < s.sprite.x).setDepth(depthAt(nx, ny));
        this.scene.tweens.add({ targets: s.sprite, x: p.x, duration: 180 });
        this.scene.tweens.add({ targets: s.sprite, y: { from: s.sprite.y, to: p.y - 4 }, duration: 90, yoyo: true, onComplete: () => s.sprite.setY(p.y) });
      }
    }
    this.sparrows = this.sparrows.filter((s) => s.sprite.active);
  }

  private spawnSparrows(view: Phaser.Geom.Rectangle, player: Vec2): void {
    for (let tries = 0; tries < 10; tries++) {
      const g = screenToGrid(view.x + Math.random() * view.width, view.y + Math.random() * view.height);
      const tx = Math.floor(g.x);
      const ty = Math.floor(g.y);
      if (!this.map.inBounds(tx, ty) || this.map.data.terrain[ty][tx] !== Terrain.Grass || this.map.data.props[ty][tx] !== Prop.None) continue;
      if (Math.hypot(g.x - player.x, g.y - player.y) < 5) continue;
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const gx = g.x + (Math.random() - 0.5) * 1.2;
        const gy = g.y + (Math.random() - 0.5) * 1.2;
        if (this.map.blocked(gx, gy, 0.05, false)) continue;
        const p = gridToScreen(gx, gy);
        const sprite = this.scene.add.sprite(p.x, p.y, 'sparrow', 0).setOrigin(0.5, 0.9).setDepth(depthAt(gx, gy));
        sprite.setFlipX(Math.random() < 0.5);
        this.sparrows.push({ sprite, gx, gy, next: Math.random() });
      }
      return;
    }
  }

  /** Off it goes, up and away from whoever startled it. */
  private scatter(s: Sparrow, from: Vec2): void {
    const sprite = s.sprite;
    sprite.setActive(false);
    const away = gridToScreen(s.gx - from.x, s.gy - from.y);
    const len = Math.hypot(away.x, away.y) || 1;
    const flyer = this.scene.add.sprite(sprite.x, sprite.y - 3, 'bird').setDepth(SKY_DEPTH).setScale(0.8);
    flyer.play({ key: 'bird-fly', startFrame: Math.floor(Math.random() * 3) }).setFlipX(away.x < 0);
    sprite.destroy();
    this.flyers.push({
      sprite: flyer,
      x: sprite.x,
      y: sprite.y,
      height: 3,
      vx: (away.x / len) * 110 + (Math.random() - 0.5) * 40,
      vy: (away.y / len) * 110 + (Math.random() - 0.5) * 40,
      life: 0,
    });
    // Climb as it goes.
    const f = this.flyers[this.flyers.length - 1];
    this.scene.tweens.add({ targets: f, height: 90 + Math.random() * 40, duration: 1400, ease: 'Sine.easeOut' });
    GameAudio.flutter();
  }

  // ------------------------------------------------------------ butterflies and fireflies

  private updateButterflies(dt: number, view: Phaser.Geom.Rectangle): void {
    if (this.daytime && this.butterflies.length < 4 && Math.random() < dt * 0.3) {
      const g = screenToGrid(view.x + Math.random() * view.width, view.y + Math.random() * view.height);
      const tx = Math.floor(g.x);
      const ty = Math.floor(g.y);
      if (this.map.inBounds(tx, ty) && this.map.data.terrain[ty][tx] === Terrain.Grass) {
        const sprite = this.scene.add.sprite(0, 0, `butterfly-${Math.floor(Math.random() * 4)}`);
        sprite.play({ key: sprite.texture.key, startFrame: Math.floor(Math.random() * 2) });
        sprite.setAlpha(0);
        this.scene.tweens.add({ targets: sprite, alpha: 1, duration: 800 });
        this.butterflies.push({ sprite, gx: g.x, gy: g.y, heading: Math.random() * Math.PI * 2, t: Math.random() * 10 });
      }
    }
    for (let i = this.butterflies.length - 1; i >= 0; i--) {
      const b = this.butterflies[i];
      b.t += dt;
      b.heading += (Math.random() - 0.5) * 6 * dt;
      b.gx += Math.cos(b.heading) * 0.5 * dt;
      b.gy += Math.sin(b.heading) * 0.5 * dt;
      const p = gridToScreen(b.gx, b.gy);
      // Bobbing flight, a hand's height or two off the ground.
      b.sprite.setPosition(Math.round(p.x), Math.round(p.y - 12 - Math.abs(Math.sin(b.t * 5)) * 6)).setDepth(depthAt(b.gx, b.gy) + 0.2);
      if (!this.daytime || !view.contains(p.x, p.y)) {
        b.sprite.destroy();
        this.butterflies.splice(i, 1);
      }
    }
  }

  private updateFireflies(dt: number, view: Phaser.Geom.Rectangle): void {
    if (this.night && this.fireflies.length < 16 && Math.random() < dt * 4) {
      const g = screenToGrid(view.x + Math.random() * view.width, view.y + Math.random() * view.height);
      const tx = Math.floor(g.x);
      const ty = Math.floor(g.y);
      if (this.map.inBounds(tx, ty) && this.map.data.terrain[ty][tx] !== Terrain.Water) {
        const dot = this.scene.add.rectangle(0, 0, 2, 2, 0xe8ff8a).setDepth(depthAt(g.x, g.y) + 0.2);
        this.fireflies.push({ dot, gx: g.x, gy: g.y, heading: Math.random() * Math.PI * 2, phase: Math.random() * 10, glow: 0 });
      }
    }
    for (let i = this.fireflies.length - 1; i >= 0; i--) {
      const f = this.fireflies[i];
      f.phase += dt;
      f.heading += (Math.random() - 0.5) * 3 * dt;
      f.gx += Math.cos(f.heading) * 0.25 * dt;
      f.gy += Math.sin(f.heading) * 0.25 * dt;
      // Slow pulses of light with dark gaps between.
      f.glow = Math.max(0, Math.sin(f.phase * 1.7)) ** 2;
      const p = gridToScreen(f.gx, f.gy);
      f.dot.setPosition(Math.round(p.x), Math.round(p.y - 10 - Math.sin(f.phase * 0.9) * 5)).setAlpha(0.2 + f.glow * 0.8);
      if (!this.night || !view.contains(p.x, p.y)) {
        f.dot.destroy();
        this.fireflies.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------ sky, smoke and leaves

  private makeCloud(anywhere: boolean): Phaser.GameObjects.Image {
    const b = this.map.getWorldBounds();
    const x = anywhere ? b.x + Math.random() * b.width : b.x - 200;
    const y = b.y + Math.random() * b.height;
    const scale = 1.5 + Math.random() * 1.5;
    return this.scene.add.image(x, y, 'cloud-shadow').setScale(scale, scale * 0.8).setDepth(SKY_DEPTH - 1);
  }

  /** Cloud shadows drift slowly across with the wind; they only show while the sun is up. */
  private updateClouds(dt: number): void {
    const b = this.map.getWorldBounds();
    const sun = 1 - this.clock.ambient.darkness;
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.x += 9 * dt;
      c.y += 3 * dt;
      c.setAlpha(0.3 * sun);
      if (c.x - c.displayWidth / 2 > b.right || c.y - c.displayHeight / 2 > b.bottom) {
        c.destroy();
        this.clouds[i] = this.makeCloud(false);
      }
    }
  }

  /** Smoke from the hearth fire curls out of the chimney and drifts off downwind. */
  private updateSmoke(dt: number): void {
    const chimneys = this.map.data.chimneys ?? [];
    this.smokeTimer -= dt;
    if (this.smokeTimer > 0 || chimneys.length === 0) return;
    this.smokeTimer = 0.35 + Math.random() * 0.3;
    for (const ch of chimneys) {
      const p = gridToScreen(ch.gx, ch.gy);
      const puff = this.scene.add
        .image(p.x + (Math.random() - 0.5) * 4, p.y - ch.z, `smoke-${Math.floor(Math.random() * 3)}`)
        .setDepth(SKY_DEPTH - 2)
        .setAlpha(0.85);
      const duration = 3600 + Math.random() * 1400;
      this.scene.tweens.add({
        targets: puff,
        x: puff.x + 26 + Math.random() * 14,
        y: puff.y - 50 - Math.random() * 20,
        scale: 2 + Math.random(),
        duration,
        ease: 'Sine.easeOut',
        onComplete: () => puff.destroy(),
      });
      // Thins out towards the end, rather than fading from the start.
      this.scene.tweens.add({ targets: puff, alpha: 0, duration, ease: 'Cubic.easeIn' });
    }
  }

  /** Now and then a leaf comes loose from a tree in view and spins down. */
  private updateLeaves(dt: number, view: Phaser.Geom.Rectangle): void {
    this.leafTimer -= dt;
    this.chirpTimer -= dt;
    if (this.chirpTimer <= 0) {
      this.chirpTimer = 5 + Math.random() * 12;
      if (this.daytime) GameAudio.chirp();
    }
    if (this.leafTimer > 0) return;
    this.leafTimer = 0.6 + Math.random() * 1.4;
    const visible = this.treeImages.filter((t) => view.contains(t.x, t.y));
    if (visible.length === 0) return;
    const tree = visible[Math.floor(Math.random() * visible.length)];
    const pine = tree.texture.key.includes('pine');
    const x = tree.x + (Math.random() - 0.5) * tree.width * 0.6;
    const y = tree.y - tree.height * (0.45 + Math.random() * 0.3);
    const colors = pine ? [0x24503a, 0x37704a] : [0x5c9e48, 0x8cc456, 0xc8a040];
    const leaf = this.scene.add.rectangle(x, y, 2, 2, colors[Math.floor(Math.random() * colors.length)]).setDepth(tree.depth + 1);
    const drift = 20 + Math.random() * 30;
    this.scene.tweens.add({
      targets: leaf,
      y: tree.y + Math.random() * 8,
      duration: 2600 + Math.random() * 1200,
      ease: 'Sine.easeIn',
      onComplete: () => leaf.destroy(),
    });
    // Swaying side to side as it falls, drifting with the wind.
    this.scene.tweens.add({ targets: leaf, x: { from: x, to: x + drift }, angle: 270, duration: 3000 });
    this.scene.tweens.add({ targets: leaf, scaleX: { from: 1, to: 0.3 }, duration: 300, yoyo: true, repeat: 5 });
  }
}
