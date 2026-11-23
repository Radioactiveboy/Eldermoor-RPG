import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { SWAY_STEPS, swayKey } from '../art/props';
import { generateWeatherArt, RAIN_SHEET } from '../art/weather';
import { depthAt, gridToScreen, screenToGrid, Vec2 } from '../iso/IsoMath';
import type { TimeOfDay } from '../systems/TimeOfDay';
import { Sky, steadySky, Weather } from '../systems/Weather';
import { Aftermath, crowsAbout, smoulder } from './Aftermath';
import { raidStage } from './GoblinRaid';
import type { IsoMap } from './IsoMap';
import { Prop, Terrain } from './MapData';
import { puddleAt } from './Puddles';

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

/** A light's broken reflection on the water below it, after dark. */
interface Reflection {
  sprite: Phaser.GameObjects.Sprite;
  /** How strongly it shows (lanterns are brighter than a candle in a window). */
  strength: number;
  flicker: number;
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
 * And the weather (systems/Weather.ts): rain falling in sheets and splashing
 * on the ground and the water, puddles that fill as it rains and dry after,
 * mist lying on the ground of a morning, the wind harder in the trees; lamps
 * shining on the water at night; and after the goblins' raid, the ruins
 * smouldering and crows picking over the farm.
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
  /** Brighter foam running round the shore on top of the rest, as each wave comes in. */
  private readonly crests: Array<{ image: Phaser.GameObjects.Image; phase: number }> = [];
  private readonly reflections: Reflection[] = [];
  /** The hero's lantern on the water, when they stand at the edge after dark. */
  private heroReflection?: Phaser.GameObjects.Sprite;
  private crows: Sparrow[] = [];
  private crowTimer = 0;
  /** The first crows are already down when the hero arrives, rather than flying in. */
  private crowsLanded = false;
  /** The weather just now, and how wet the ground is. */
  private sky: Sky = steadySky('clear');
  private wet = 0;
  private wetTimer = 0;
  private rainNear?: Phaser.GameObjects.TileSprite;
  private rainFar?: Phaser.GameObjects.TileSprite;
  private readonly splashes: Phaser.GameObjects.Sprite[] = [];
  private splashDue = 0;
  private readonly puddles: Phaser.GameObjects.Image[] = [];
  private readonly mists: Phaser.GameObjects.Image[] = [];
  /** A thin, even haze under the banks of mist. */
  private haze?: Phaser.GameObjects.Rectangle;
  private time = 0;
  private flockTimer = 4;
  private rippleTimer = 2;
  private sparrowTimer = 3;
  private smokeTimer = 0;
  private leafTimer = 1;
  private windTimer = 0;
  /** Each tree's still texture, from before the wind started leaning it. */
  private readonly treeKeys = new Map<Phaser.GameObjects.Image, string>();

  constructor(scene: Phaser.Scene, map: IsoMap, clock: TimeOfDay) {
    this.scene = scene;
    this.map = map;
    this.clock = clock;
    generateWeatherArt(scene);
    this.sky = Weather.at(clock.elapsedHours);
    this.wet = Weather.wetness(clock.elapsedHours);
    this.dressWater();
    this.layPuddles();
    this.findReflections();
    for (const t of map.trees.values()) {
      this.treeImages.push(t.image);
      this.treeKeys.set(t.image, t.image.texture.key);
    }
    for (let i = 0; i < 3; i++) this.clouds.push(this.makeCloud(true));
  }

  /** Where the sun is up enough for birds and butterflies (and it isn't raining much). */
  private get daytime(): boolean {
    const h = this.clock.hour;
    return h > 6.5 && h < 19.5 && this.sky.rain < 0.25;
  }

  private get night(): boolean {
    return this.clock.ambient.darkness > 0.45;
  }

  update(dt: number, view: Phaser.Geom.Rectangle, player: Vec2): void {
    this.time += dt;
    this.updateSky(dt);
    this.updateRain(dt, view);
    this.updatePuddles();
    this.updateMist(dt, view);
    this.updateReflections(player);
    this.updateCrows(dt, player);
    this.updateFoam();
    this.updateRipples(dt, view);
    this.updateFlyers(dt, view);
    this.updateSparrows(dt, view, player);
    this.updateButterflies(dt, view);
    this.updateFireflies(dt, view);
    this.updateClouds(dt);
    this.updateSmoke(dt);
    this.updateLeaves(dt, view);
    this.updateWind(dt, view);
  }

  /** Fireflies' glow, for the night-time lighting. */
  lights(): WorldLight[] {
    return this.fireflies
      .filter((f) => f.glow > 0.05)
      .map((f) => ({ x: f.dot.x, y: f.dot.y, radius: 16, alpha: f.glow * 0.55 }));
  }

  // ------------------------------------------------------------ water

  /** Glints on the open water, and foam where it meets the shore. */
  private dressWater(): void {
    const { width, height, terrain } = this.map.data;
    const isWater = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= height || terrain[y][x] === Terrain.Water;
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        if (terrain[ty][tx] !== Terrain.Water) continue;
        const c = gridToScreen(tx + 0.5, ty + 0.5);
        this.water.push({ x: tx + 0.5, y: ty + 0.5 });
        // Not on the edge, where the shore's soft line cuts into the tile.
        if (!isWater(tx, ty - 1) || !isWater(tx, ty + 1) || !isWater(tx - 1, ty) || !isWater(tx + 1, ty)) continue;
        this.scene.add
          .sprite(c.x, c.y, 'water-shimmer')
          .setDepth(GROUND_FX_DEPTH)
          .play({ key: 'water-shimmer', startFrame: (tx * 3 + ty * 5) % 8 });
      }
    }
    // The foam follows the shore's blended edge (see IsoMap.foam).
    for (const [i, key] of this.map.foam) {
      const tx = i % width;
      const ty = Math.floor(i / width);
      const c = gridToScreen(tx + 0.5, ty + 0.5);
      const image = this.scene.add.image(c.x, c.y, key).setDepth(GROUND_FX_DEPTH + 0.01);
      // Neighbouring tiles are a little out of step, so the lapping travels round the shore.
      this.foam.push({ image, phase: (tx + ty) * 0.45 });
      const crest = this.scene.add.image(c.x, c.y, key).setDepth(GROUND_FX_DEPTH + 0.015).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.crests.push({ image: crest, phase: (tx + ty) * 0.45 });
    }
  }

  /**
   * The waves coming in: the foam swells and fades all along the shore, a
   * little out of step from tile to tile, and every so often a brighter crest
   * runs round it. Quicker and rougher in a wind.
   */
  private updateFoam(): void {
    const rough = 1 + this.sky.wind * 0.9;
    const t = this.time * rough;
    for (const f of this.foam) f.image.setAlpha(0.45 + 0.4 * Math.sin(t * 1.4 + f.phase));
    for (const c of this.crests) {
      const wave = Math.max(0, Math.sin(t * 0.8 - c.phase * 0.55));
      c.image.setAlpha(wave ** 6 * (0.55 + this.sky.wind * 0.3));
    }
  }

  /** Every so often a fish rises somewhere on the lake in view. */
  private updateRipples(dt: number, view: Phaser.Geom.Rectangle): void {
    this.rippleTimer -= dt;
    // Fish don't rise for flies in the rain.
    if (this.rippleTimer > 0 || this.water.length === 0 || this.sky.rain > 0.4) return;
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
  private scatter(s: Sparrow, from: Vec2, size = 0.8): void {
    const sprite = s.sprite;
    sprite.setActive(false);
    const away = gridToScreen(s.gx - from.x, s.gy - from.y);
    const len = Math.hypot(away.x, away.y) || 1;
    const flyer = this.scene.add.sprite(sprite.x, sprite.y - 3, 'bird').setDepth(SKY_DEPTH).setScale(size);
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
    if (this.night && this.sky.rain < 0.1 && this.fireflies.length < 16 && Math.random() < dt * 4) {
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
    // No sun to cast them under a grey sky.
    const sun = (1 - this.clock.ambient.darkness) * (1 - this.sky.cloud);
    const wind = 1 + this.sky.wind * 2;
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.x += 9 * wind * dt;
      c.y += 3 * wind * dt;
      c.setAlpha(0.3 * sun);
      if (c.x - c.displayWidth / 2 > b.right || c.y - c.displayHeight / 2 > b.bottom) {
        c.destroy();
        this.clouds[i] = this.makeCloud(false);
      }
    }
  }

  /**
   * Smoke from the hearth fire curls out of the chimney and drifts off
   * downwind (further in a wind, and kept low by rain). After the raid the
   * ruins smoulder, darker and thicker at first, dying down over a couple of days.
   */
  private updateSmoke(dt: number): void {
    const chimneys = this.map.data.chimneys ?? [];
    this.smokeTimer -= dt;
    if (this.smokeTimer > 0 || chimneys.length === 0) return;
    this.smokeTimer = 0.35 + Math.random() * 0.3;
    // An old save from before the raid's hour was kept: count from now.
    if (raidStage() === 'over' && Aftermath.raidAt === undefined) Aftermath.raidAt = this.clock.elapsedHours;
    const embers = Aftermath.raidAt === undefined ? 0 : smoulder(this.clock.elapsedHours - Aftermath.raidAt);
    const drift = 1 + this.sky.wind * 1.6;
    const rise = 1 - this.sky.rain * 0.35;
    for (const ch of chimneys) {
      // The ruins smoke less and less, and only now and then towards the end.
      if (ch.ruin && Math.random() >= embers * 1.4) continue;
      const p = gridToScreen(ch.gx, ch.gy);
      const puff = this.scene.add
        .image(p.x + (Math.random() - 0.5) * 4, p.y - ch.z, `smoke-${Math.floor(Math.random() * 3)}`)
        .setDepth(SKY_DEPTH - 2)
        .setAlpha(ch.ruin ? 0.5 + embers * 0.4 : 0.85);
      if (ch.ruin) puff.setTint(embers > 0.5 ? 0x5e5a62 : 0x807c86);
      const duration = (3600 + Math.random() * 1400) * (ch.ruin ? 1.3 : 1);
      this.scene.tweens.add({
        targets: puff,
        x: puff.x + (26 + Math.random() * 14) * drift,
        y: puff.y - (50 + Math.random() * 20) * rise,
        scale: (2 + Math.random()) * (ch.ruin ? 1 + embers * 0.6 : 1),
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
  /**
   * The wind in the trees: gusts roll across the woods from the west, and
   * each crown leans a pixel or two downwind as one passes, then rights
   * itself. Pines are stiffer than the broadleaves. The leaning is done with
   * ready-made textures (see art/props.ts), so the art stays pixel-crisp.
   */
  private updateWind(dt: number, view: Phaser.Geom.Rectangle): void {
    this.windTimer -= dt;
    if (this.windTimer > 0) return;
    this.windTimer = 0.12;
    const t = this.time;
    // How gusty it is just now: slow swells, sometimes nearly still. A storm bends them right over.
    const calm = Math.max(0, 0.45 + 0.4 * Math.sin(t * 0.21) * Math.sin(t * 0.47 + 1.3) + 0.15 * Math.sin(t * 0.9));
    const gust = calm * (1 + this.sky.wind * 1.3) + this.sky.wind * 0.35;
    for (const image of this.treeImages) {
      const key = this.treeKeys.get(image);
      if (!key || !view.contains(image.x, image.y - image.height * 0.5)) continue;
      // Being shaken by the hero: leave it be.
      if (image.angle !== 0) continue;
      const wave = Math.sin(t * 1.7 - image.x * 0.011 + (image.y % 37) * 0.05);
      const stiff = key.includes('pine') ? 0.7 : 1;
      const lean = gust * stiff * (0.5 + 0.5 * wave) * 2.6;
      const step = Math.min(SWAY_STEPS, Math.floor(lean));
      // A mirrored tree leans the other way in its own texture, so it bends with the rest.
      const want = swayKey(key, image.flipX ? -step : step);
      if (image.texture.key !== want) image.setTexture(want);
    }
  }

  // ------------------------------------------------------------ weather

  /** What the sky's doing (every frame: it's cheap) and how wet the ground is (now and then: it changes slowly). */
  private updateSky(dt: number): void {
    const hours = this.clock.elapsedHours;
    this.sky = Weather.at(hours);
    this.wetTimer -= dt;
    if (this.wetTimer <= 0) {
      this.wetTimer = 0.5;
      this.wet = Weather.wetness(hours);
    }
  }

  /**
   * Rain: two sheets of streaks tiled over the view, near and far, falling at
   * their own speeds and blown sideways by the wind, with drops splashing on
   * the ground and ringing the water and the puddles. The sheets are fixed to
   * the world, so the rain doesn't follow the camera about.
   */
  private updateRain(dt: number, view: Phaser.Geom.Rectangle): void {
    const rain = this.sky.rain;
    if (rain <= 0.02) {
      this.rainNear?.setVisible(false);
      this.rainFar?.setVisible(false);
      return;
    }
    if (!this.rainNear) {
      this.rainFar = this.scene.add.tileSprite(0, 0, 8, 8, 'rain-sheet-far').setOrigin(0, 0).setDepth(SKY_DEPTH + 1);
      this.rainNear = this.scene.add.tileSprite(0, 0, 8, 8, 'rain-sheet').setOrigin(0, 0).setDepth(SKY_DEPTH + 2);
    }
    const wind = 0.3 + this.sky.wind;
    for (const [sheet, speed, alpha] of [[this.rainNear, 430, 0.35 + rain * 0.55], [this.rainFar!, 290, rain * 0.75]] as const) {
      // A sheet covers the view, snapped to whole tiles of rain so it doesn't shimmer.
      const x = Math.floor(view.x / RAIN_SHEET) * RAIN_SHEET;
      const y = Math.floor(view.y / RAIN_SHEET) * RAIN_SHEET;
      const w = Math.ceil((view.right - x) / RAIN_SHEET + 1) * RAIN_SHEET;
      const h = Math.ceil((view.bottom - y) / RAIN_SHEET + 1) * RAIN_SHEET;
      if (sheet.width !== w || sheet.height !== h) sheet.setSize(w, h);
      sheet.setPosition(x, y).setVisible(true).setAlpha(alpha);
      // Falling: the texture slides down (and sideways in the wind) under the sheet.
      sheet.tilePositionY = Phaser.Math.Wrap(sheet.tilePositionY - speed * dt, 0, RAIN_SHEET);
      sheet.tilePositionX = Phaser.Math.Wrap(sheet.tilePositionX - speed * 0.25 * wind * dt, 0, RAIN_SHEET);
    }
    this.rainFar!.setVisible(rain > 0.35);
    // Drops landing: a handful a second in drizzle, a constant patter in a storm.
    this.splashDue += dt * (8 + rain * 70);
    while (this.splashDue >= 1) {
      this.splashDue -= 1;
      this.splashAt(view);
    }
  }

  /** One drop landing somewhere in view: a splash on the ground, a ring on water or in a puddle. */
  private splashAt(view: Phaser.Geom.Rectangle): void {
    let x: number;
    let y: number;
    let ring: boolean;
    const puddles = this.wet > 0.25 ? this.puddles.filter((p) => view.contains(p.x, p.y)) : [];
    if (puddles.length > 0 && Math.random() < 0.3) {
      const p = puddles[Math.floor(Math.random() * puddles.length)];
      x = p.x + (Math.random() - 0.5) * 12;
      y = p.y + (Math.random() - 0.5) * 3;
      ring = true;
    } else {
      x = view.x + Math.random() * view.width;
      y = view.y + Math.random() * view.height;
      const g = screenToGrid(x, y);
      const tx = Math.floor(g.x);
      const ty = Math.floor(g.y);
      if (!this.map.inBounds(tx, ty)) return;
      ring = this.map.data.terrain[ty][tx] === Terrain.Water;
      // Not on top of trees, rocks and houses: they'd want splashes at their own height.
      if (!ring && this.map.data.props[ty][tx] !== Prop.None) return;
    }
    let s = this.splashes.find((sp) => !sp.visible);
    if (!s) {
      if (this.splashes.length >= 48) return;
      s = this.scene.add.sprite(0, 0, 'rain-splash').setVisible(false);
      s.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s!.setVisible(false));
      this.splashes.push(s);
    }
    s.setPosition(Math.round(x), Math.round(y)).setVisible(true).setAlpha(0.8).setDepth(GROUND_FX_DEPTH + 0.05);
    s.play(ring ? 'rain-ring' : 'rain-splash');
  }

  /**
   * Puddles lie in the ruts of the paths and the dips in bare earth: a few
   * tiles in each stretch, chosen the same way every visit. They're laid now
   * and only shown as the ground gets wet.
   */
  private layPuddles(): void {
    const { width, height, terrain, props } = this.map.data;
    for (let ty = 1; ty < height - 1; ty++) {
      for (let tx = 1; tx < width - 1; tx++) {
        const t = terrain[ty][tx];
        if ((t !== Terrain.Dirt && t !== Terrain.Soil) || props[ty][tx] !== Prop.None) continue;
        const spot = puddleAt(tx, ty);
        if (!spot) continue;
        const c = gridToScreen(spot.x, spot.y);
        const image = this.scene.add
          .image(Math.round(c.x), Math.round(c.y), `puddle-${spot.kind}`)
          .setDepth(GROUND_FX_DEPTH + 0.005)
          .setFlipX(spot.flip)
          .setVisible(false);
        this.puddles.push(image);
        if (this.puddles.length >= 220) return;
      }
    }
  }

  private updatePuddles(): void {
    const a = Phaser.Math.Clamp((this.wet - 0.15) / 0.6, 0, 1) * 0.85;
    for (const p of this.puddles) {
      if (a <= 0.01) {
        if (p.visible) p.setVisible(false);
      } else if (!p.visible || Math.abs(p.alpha - a) > 0.01) {
        p.setVisible(true).setAlpha(a);
      }
    }
  }

  /** Mist: soft banks of it drifting slowly over the ground, thickest in the hour after dawn. */
  private updateMist(dt: number, view: Phaser.Geom.Rectangle): void {
    const mist = this.sky.mist;
    if (mist <= 0.02 && this.mists.length === 0) return;
    const BANKS = 12;
    if (this.mists.length === 0) {
      this.haze = this.scene.add.rectangle(0, 0, 8, 8, 0xdfe5ec).setOrigin(0, 0).setDepth(SKY_DEPTH - 4);
      for (let i = 0; i < BANKS; i++) {
        const image = this.scene.add.image(0, 0, 'mist-bank').setDepth(SKY_DEPTH - 3);
        image.setScale(1.5 + Math.random() * 0.9, 1.1 + Math.random() * 0.6);
        this.mists.push(image);
      }
      this.scatterMist(view);
    }
    this.haze!.setPosition(view.x, view.y).setSize(view.width, view.height).setAlpha(mist * 0.1).setVisible(mist > 0.02);
    // The view jumped (the camera settling on arrival): spread the banks over it again.
    const far = this.mists.filter((m) => !Phaser.Geom.Rectangle.Overlaps(Phaser.Geom.Rectangle.Inflate(Phaser.Geom.Rectangle.Clone(view), 300, 200), m.getBounds()));
    if (far.length > BANKS / 2) this.scatterMist(view);
    for (let i = 0; i < this.mists.length; i++) {
      const m = this.mists[i];
      m.x += (5 + (i % 3) * 2) * dt;
      // Keep the banks over the view as it moves, wrapping round at the edges.
      const half = m.displayWidth / 2;
      if (m.x - half > view.right) m.x = view.x - half + 10;
      else if (m.x + half < view.x) m.x = view.right + half - 10;
      if (m.y > view.bottom + 60) m.y -= view.height + 120;
      else if (m.y < view.y - 60) m.y += view.height + 120;
      m.setAlpha(mist * (0.32 + 0.13 * Math.sin(this.time * 0.15 + i * 1.7))).setVisible(mist > 0.02);
    }
  }

  /** Spreads the banks of mist evenly over the view, a row at a time. */
  private scatterMist(view: Phaser.Geom.Rectangle): void {
    this.mists.forEach((m, i) => {
      const row = i % 4;
      m.setPosition(view.x + ((Math.floor(i / 4) + Math.random()) / 3) * view.width, view.y + ((row + 0.3 + Math.random() * 0.4) / 4) * view.height);
    });
  }

  // ------------------------------------------------------------ light on the water

  /**
   * Lamps by the water (the abbey's ponds, the market's lanterns) shine on it
   * after dark: a wavering bar of light below each, where it would be
   * reflected. Worked out once; they only show at night.
   */
  private findReflections(): void {
    for (const l of this.map.data.lights ?? []) {
      const p = gridToScreen(l.gx, l.gy);
      // The reflection of something z pixels up lies about z pixels below its foot, or
      // further down, on the near edge of the water, when the lamp stands back from the bank.
      let at: Vec2 | undefined;
      for (let dy = l.z * 0.6; dy < l.z * 0.6 + 90 && !at; dy += 4) if (this.waterAt(p.x, p.y + dy)) at = { x: p.x, y: p.y + dy };
      if (!at) continue;
      const sprite = this.scene.add
        .sprite(Math.round(at.x), Math.round(at.y), 'lamp-reflection')
        .setOrigin(0.5, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(GROUND_FX_DEPTH + 0.03)
        .setAlpha(0);
      sprite.play({ key: 'lamp-reflection', startFrame: this.reflections.length % 3 });
      this.reflections.push({ sprite, strength: Math.min(1, l.radius / 140), flicker: l.flicker });
    }
  }

  private updateReflections(player: Vec2): void {
    const dark = this.clock.ambient.darkness;
    // Rain on the water breaks the reflections up.
    const calm = 1 - this.sky.rain * 0.6;
    for (let i = 0; i < this.reflections.length; i++) {
      const r = this.reflections[i];
      const flicker = 1 - r.flicker * 0.25 * (0.5 + 0.5 * Math.sin(this.time * 9 + i * 2));
      r.sprite.setAlpha(Phaser.Math.Clamp((dark - 0.3) / 0.5, 0, 1) * 0.8 * r.strength * calm * flicker);
    }
    // The hero's lantern, when they stand at the water's edge (it hangs about 20 pixels up).
    const p = gridToScreen(player.x, player.y);
    const on = dark > 0.35 && this.waterAt(p.x, p.y + 24) && this.waterAt(p.x, p.y + 34);
    if (on && !this.heroReflection) {
      this.heroReflection = this.scene.add
        .sprite(0, 0, 'lamp-reflection')
        .setOrigin(0.5, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(GROUND_FX_DEPTH + 0.03)
        .setScale(0.8);
      this.heroReflection.play('lamp-reflection');
    }
    if (this.heroReflection) {
      this.heroReflection.setVisible(on).setPosition(Math.round(p.x), Math.round(p.y + 24));
      this.heroReflection.setAlpha(Phaser.Math.Clamp((dark - 0.35) / 0.4, 0, 1) * 0.85 * calm);
    }
  }

  private waterAt(x: number, y: number): boolean {
    const g = screenToGrid(x, y);
    const tx = Math.floor(g.x);
    const ty = Math.floor(g.y);
    return this.map.inBounds(tx, ty) && this.map.data.terrain[ty][tx] === Terrain.Water;
  }

  // ------------------------------------------------------------ crows

  /**
   * After the raid, crows come down on the farm to pick over the trampled
   * garden and the yard: a good many at first, fewer as the days go by. Like
   * the sparrows, they're off if anyone comes close (but they come back).
   */
  private updateCrows(dt: number, player: Vec2): void {
    const spots = this.map.data.crows;
    if (!spots || spots.length === 0) return;
    this.crowTimer -= dt;
    if (this.crowTimer <= 0) {
      this.crowTimer = 4 + Math.random() * 6;
      const since = Aftermath.raidAt === undefined ? 0 : this.clock.elapsedHours - Aftermath.raidAt;
      const most = Math.round(crowsAbout(since) * 8);
      if (!this.crowsLanded) {
        this.crowsLanded = true;
        for (const spot of spots) if (this.daytime) this.landCrows([spot], player, Math.ceil(most / spots.length), true);
      } else if (this.daytime && this.crows.length < most) {
        this.landCrows(spots, player, most - this.crows.length);
      }
    }
    for (const c of this.crows) {
      if (!this.daytime || Math.hypot(player.x - c.gx, player.y - c.gy) < 3.2) {
        this.scatter(c, player, 1.25);
        continue;
      }
      c.next -= dt;
      if (c.next > 0) continue;
      c.next = 0.6 + Math.random() * 2.2;
      if (Math.random() < 0.6) {
        c.sprite.setFrame(1);
        this.scene.time.delayedCall(300, () => c.sprite.active && c.sprite.setFrame(0));
      } else {
        // A stiff little walk, not a hop.
        const nx = c.gx + (Math.random() - 0.5) * 0.7;
        const ny = c.gy + (Math.random() - 0.5) * 0.7;
        if (this.map.blocked(nx, ny, 0.08, false)) continue;
        c.gx = nx;
        c.gy = ny;
        const p = gridToScreen(nx, ny);
        c.sprite.setFlipX(p.x < c.sprite.x).setDepth(depthAt(nx, ny));
        this.scene.tweens.add({ targets: c.sprite, x: p.x, y: p.y, duration: 420 });
      }
    }
    this.crows = this.crows.filter((c) => c.sprite.active);
  }

  /** A few crows drop down round one of the spots, out of the hero's way. */
  private landCrows(spots: Array<{ gx: number; gy: number }>, player: Vec2, count: number, already = false): void {
    const spot = spots[Math.floor(Math.random() * spots.length)];
    if (Math.hypot(spot.gx - player.x, spot.gy - player.y) < (already ? 4.5 : 6)) return;
    const n = already ? count : Math.min(count, 1 + Math.floor(Math.random() * 3));
    for (let i = 0; i < n; i++) {
      const gx = spot.gx + (Math.random() - 0.5) * 2;
      const gy = spot.gy + (Math.random() - 0.5) * 2;
      if (this.map.blocked(gx, gy, 0.08, false)) continue;
      const p = gridToScreen(gx, gy);
      const sprite = this.scene.add.sprite(p.x, already ? p.y : p.y - 60, 'crow', already ? 0 : 2).setOrigin(0.5, 0.9).setDepth(depthAt(gx, gy));
      sprite.setFlipX(Math.random() < 0.5);
      const crow: Sparrow = { sprite, gx, gy, next: 1 + Math.random() };
      if (!already) {
        this.scene.tweens.add({ targets: sprite, y: p.y, duration: 900 + Math.random() * 400, ease: 'Sine.easeOut', onComplete: () => sprite.active && sprite.setFrame(0) });
      }
      this.crows.push(crow);
    }
  }
}
