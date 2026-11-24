import Phaser from 'phaser';
import { depthAt, gridToScreen, screenToGrid, Vec2 } from '../iso/IsoMath';
import type { TimeOfDay } from '../systems/TimeOfDay';
import type { IsoMap } from './IsoMap';
import { Terrain } from './MapData';

/** Over the ground (the water's painted into it), under its shimmer and foam. */
const SHALLOWS_DEPTH = 0.2;
/** Just over the water and its shimmer, under everything standing. */
const STREAK_DEPTH = 0.43;
/** Up with the other birds, over everything. */
const SKY_DEPTH = 90000;

interface Streak {
  image: Phaser.GameObjects.Image;
  gx: number;
  gy: number;
  age: number;
  life: number;
}

interface Gull {
  sprite: Phaser.GameObjects.Sprite;
  /** Where it sits when it's down: a post's top, in screen pixels. */
  perch: Vec2;
  /** Wheeling over the water: round this point, at this radius, this fast. */
  centre: Vec2;
  radius: number;
  angle: number;
  speed: number;
  height: number;
  flying: boolean;
  /** Seconds until it does something: cries, comes back down, or flaps. */
  next: number;
  flap: number;
}

interface Duck {
  sprite: Phaser.GameObjects.Sprite;
  gx: number;
  gy: number;
  /** 0 for the drake's frames, 3 for the duck's. */
  base: number;
  dabble: number;
  paddle: number;
}

/**
 * A river that runs (see MapData.river), and the life on it: bright streaks
 * of the current drifting downstream, gulls sitting on the posts and wheeling
 * over the water (they're up and off, crying, if the hero comes close), and a
 * family of mallards paddling about the shallows, up-ending to feed.
 */
export class RiverLife {
  private readonly streaks: Streak[] = [];
  private readonly gulls: Gull[] = [];
  private readonly ducks: Duck[] = [];
  private readonly flow: Vec2;
  private readonly speed: number;
  private readonly flowAngle: number;
  private streakTimer = 0;
  private duckTarget?: Vec2;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: IsoMap,
    private readonly clock: TimeOfDay,
  ) {
    const river = map.data.river!;
    this.flow = river.flow;
    this.speed = river.speed;
    const a = gridToScreen(0, 0);
    const b = gridToScreen(this.flow.x, this.flow.y);
    this.flowAngle = Math.atan2(b.y - a.y, b.x - a.x);
    this.paintShallows();
    this.placeGulls();
    this.placeDucks();
  }

  private water(gx: number, gy: number): boolean {
    const tx = Math.floor(gx);
    const ty = Math.floor(gy);
    return this.map.inBounds(tx, ty) && this.map.data.terrain[ty][tx] === Terrain.Water && !this.map.isDeck(tx, ty);
  }

  /** How much there is to see: the streaks and birds fade with the light. */
  private get light(): number {
    return 1 - Math.min(0.75, this.clock.ambient.darkness);
  }

  private get daytime(): boolean {
    const h = this.clock.hour;
    return h > 6 && h < 20;
  }

  update(dt: number, view: Phaser.Geom.Rectangle, player: Vec2): void {
    this.updateStreaks(dt, view);
    this.updateGulls(dt, player);
    this.updateDucks(dt, player);
  }

  // ------------------------------------------------------------ the shallows

  /**
   * The river shelving away from its banks: over the first few tiles out the
   * water is shallow, greener and browner, the gravel bed showing through,
   * clearing to the deep blue of the channel. Painted once, as one soft wash
   * over the whole river at half resolution, so it follows the shore's curves
   * rather than the tiles. Not along the quay: that drops into deep water,
   * which is why the boats can come alongside it.
   */
  private paintShallows(): void {
    const { width, height, terrain } = this.map.data;
    // Steps from the nearest bank, for each tile: 0 on land, deep (4) on the quay's stone.
    const DEEP = 4;
    const steps: number[] = new Array(width * height).fill(DEEP);
    const queue: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = terrain[y][x];
        if (t !== Terrain.Water && t !== Terrain.Stone) {
          steps[y * width + x] = 0;
          queue.push(y * width + x);
        }
      }
    }
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const x = i % width;
      const y = Math.floor(i / width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (terrain[ny][nx] !== Terrain.Water || steps[j] <= steps[i] + 1) continue;
        steps[j] = steps[i] + 1;
        if (steps[j] < DEEP) queue.push(j);
      }
    }
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? DEEP : steps[y * width + x]);
    // Smoothly between tile middles.
    const depth = (gx: number, gy: number) => {
      const fx = gx - 0.5;
      const fy = gy - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const u = fx - x0;
      const v = fy - y0;
      return (at(x0, y0) * (1 - u) + at(x0 + 1, y0) * u) * (1 - v) + (at(x0, y0 + 1) * (1 - u) + at(x0 + 1, y0 + 1) * u) * v;
    };
    const S = 2;
    const left = gridToScreen(0, height).x;
    const right = gridToScreen(width, 0).x;
    const bottom = gridToScreen(width, height).y;
    const cw = Math.ceil((right - left) / S);
    const ch = Math.ceil(bottom / S);
    const key = 'jt-shallows-wash';
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const tex = this.scene.textures.createCanvas(key, cw, ch)!;
    const ctx = tex.getContext();
    const img = ctx.createImageData(cw, ch);
    const bed = (gx: number, gy: number) => {
      const s = Math.sin(gx * 91.7 + gy * 47.3) * 43758.5;
      return s - Math.floor(s);
    };
    for (let py = 0; py < ch; py++) {
      for (let px = 0; px < cw; px++) {
        const g = screenToGrid(left + (px + 0.5) * S, (py + 0.5) * S);
        const tx = Math.floor(g.x);
        const ty = Math.floor(g.y);
        if (tx < 0 || ty < 0 || tx >= width || ty >= height || terrain[ty][tx] !== Terrain.Water || this.map.isDeck(tx, ty)) continue;
        const d = depth(g.x, g.y);
        const a = Math.max(0, Math.min(1, 1 - (d - 0.5) / 2.6));
        if (a <= 0) continue;
        // Sandy olive at the very edge, through weedy green, to clear teal.
        const near = Math.max(0, Math.min(1, 1 - (d - 0.6) / 1.1));
        const pebble = bed(Math.floor(g.x * 9), Math.floor(g.y * 9));
        let r = 64 + (168 - 64) * near;
        let gr = 150 + (164 - 150) * near;
        let b = 150 + (112 - 150) * near;
        if (pebble > 0.93 && near > 0.2) {
          r *= 1.25;
          gr *= 1.2;
          b *= 1.1;
        } else if (pebble < 0.08) {
          r *= 0.8;
          gr *= 0.85;
          b *= 0.85;
        }
        const o = (py * cw + px) * 4;
        img.data[o] = Math.min(255, r);
        img.data[o + 1] = Math.min(255, gr);
        img.data[o + 2] = Math.min(255, b);
        img.data[o + 3] = Math.round(a * a * 215);
      }
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.scene.add.image(left, 0, key).setOrigin(0, 0).setScale(S).setDepth(SHALLOWS_DEPTH);
  }

  // ------------------------------------------------------------ the current

  private updateStreaks(dt: number, view: Phaser.Geom.Rectangle): void {
    this.streakTimer -= dt;
    while (this.streakTimer <= 0 && this.streaks.length < 46) {
      this.streakTimer += 0.07;
      this.spawnStreak(view);
    }
    const light = this.light;
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i];
      s.age += dt;
      // Faster out in the channel than near the banks.
      s.gx += this.flow.x * this.speed * dt;
      s.gy += this.flow.y * this.speed * dt;
      const p = gridToScreen(s.gx, s.gy);
      const t = s.age / s.life;
      s.image.setPosition(p.x, p.y).setAlpha(Math.sin(Math.min(1, t) * Math.PI) * 0.75 * light);
      if (t >= 1 || !this.water(s.gx, s.gy)) {
        s.image.destroy();
        this.streaks.splice(i, 1);
      }
    }
  }

  private spawnStreak(view: Phaser.Geom.Rectangle): void {
    // Try a few spots in view for one on open water.
    for (let tries = 0; tries < 6; tries++) {
      const x = view.x + Math.random() * view.width;
      const y = view.y + Math.random() * view.height;
      const g = screenToGrid(x, y);
      if (!this.water(g.x, g.y)) continue;
      const image = this.scene.add
        .image(x, y, 'jt-current')
        .setDepth(STREAK_DEPTH)
        .setRotation(this.flowAngle)
        .setScale(0.6 + Math.random() * 0.8, 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      this.streaks.push({ image, gx: g.x, gy: g.y, age: 0, life: 2.5 + Math.random() * 3 });
      return;
    }
  }

  // ------------------------------------------------------------ gulls

  /** A gull on some of the bollards and lamp posts, and a couple wheeling over the water. */
  private placeGulls(): void {
    const posts: Vec2[] = [];
    for (const o of this.map.data.objects ?? []) {
      const top = o.key === 'jt-bollard' ? 15 : o.key.startsWith('jt-pierlamp') ? 47 : 0;
      if (!top) continue;
      const p = gridToScreen(o.tx + 0.5, o.ty + 0.5);
      posts.push({ x: p.x, y: p.y - top });
    }
    const river = this.riverMiddle();
    Phaser.Utils.Array.Shuffle(posts);
    const count = Math.min(posts.length, 5);
    for (let i = 0; i < count + 3; i++) {
      const perch = posts[i % Math.max(1, posts.length)] ?? river;
      const flying = i >= count;
      const sprite = this.scene.add.sprite(perch.x, perch.y, 'jt-gull', flying ? 2 : 0).setOrigin(0.5, 0.85).setFlipX(Math.random() < 0.5);
      const gull: Gull = {
        sprite,
        perch,
        centre: { x: river.x + (Math.random() - 0.5) * 300, y: river.y + (Math.random() - 0.5) * 120 },
        radius: 90 + Math.random() * 110,
        angle: Math.random() * Math.PI * 2,
        speed: (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.2),
        height: 0,
        flying,
        next: 1 + Math.random() * 4,
        flap: 0,
      };
      // Ones that are flying from the start don't come back to a post someone else is on.
      if (flying) gull.perch = { x: Number.NaN, y: Number.NaN };
      sprite.setDepth(flying ? SKY_DEPTH : depthAt(0, 0));
      this.sitDepth(gull);
      this.gulls.push(gull);
    }
  }

  /** The middle of the river in screen pixels: where gulls circle. */
  private riverMiddle(): Vec2 {
    let sx = 0;
    let sy = 0;
    let n = 0;
    const { width, height } = this.map.data;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (!this.water(x + 0.5, y + 0.5)) continue;
        const p = gridToScreen(x + 0.5, y + 0.5);
        sx += p.x;
        sy += p.y;
        n++;
      }
    }
    return n ? { x: sx / n, y: sy / n } : gridToScreen(width / 2, height / 2);
  }

  private sitDepth(g: Gull): void {
    if (g.flying || Number.isNaN(g.perch.x)) return;
    const grid = screenToGrid(g.perch.x, g.perch.y + 30);
    g.sprite.setDepth(depthAt(grid.x, grid.y) + 0.2);
  }

  private updateGulls(dt: number, player: Vec2): void {
    const playerAt = gridToScreen(player.x, player.y);
    const light = this.light;
    for (const g of this.gulls) {
      g.next -= dt;
      if (!g.flying) {
        g.sprite.setAlpha(1);
        // Up and off if the hero comes near.
        if (Math.hypot(playerAt.x - g.perch.x, playerAt.y - 12 - g.perch.y) < 70) {
          this.takeOff(g);
          continue;
        }
        if (g.next <= 0) {
          // Throw its head back and cry now and then, or turn round.
          g.next = 2 + Math.random() * 6;
          if (Math.random() < 0.6) {
            g.sprite.setFrame(1);
            this.scene.time.delayedCall(700, () => g.sprite.active && !g.flying && g.sprite.setFrame(0));
          } else g.sprite.toggleFlipX();
        }
        continue;
      }
      // Wheeling: round and round over the water, gliding with a few lazy flaps.
      g.angle += g.speed * dt;
      const x = g.centre.x + Math.cos(g.angle) * g.radius;
      const y = g.centre.y + Math.sin(g.angle) * g.radius * 0.45;
      g.height = Math.min(110, g.height + 60 * dt);
      const lift = Math.sin(g.angle * 2) * 6;
      const vx = -Math.sin(g.angle) * g.speed;
      g.sprite.setPosition(x, y - g.height + lift).setFlipX(vx < 0).setAlpha(light);
      g.flap -= dt;
      if (g.flap <= 0) {
        // A beat or two of the wings, then a long glide with them up.
        const beating = g.sprite.frame.name === '3';
        g.sprite.setFrame(beating ? 2 : 3);
        g.flap = beating ? (Math.random() < 0.7 ? 0.18 : 1.4 + Math.random() * 2) : 0.18;
      }
      // Back down on its post after a while, if it has one and nobody's near it.
      if (g.next <= 0) {
        g.next = 6 + Math.random() * 10;
        const free = !Number.isNaN(g.perch.x) && Math.hypot(playerAt.x - g.perch.x, playerAt.y - g.perch.y) > 160;
        if (free && (Math.random() < 0.5 || !this.daytime)) this.land(g);
      }
    }
  }

  private takeOff(g: Gull): void {
    g.flying = true;
    g.height = 0;
    g.sprite.setDepth(SKY_DEPTH).setFrame(3);
    // Wheel round from where it was.
    const dx = g.perch.x - g.centre.x;
    const dy = (g.perch.y - g.centre.y) / 0.45;
    g.radius = Phaser.Math.Clamp(Math.hypot(dx, dy), 80, 220);
    g.angle = Math.atan2(dy, dx);
    g.next = 8 + Math.random() * 8;
    g.flap = 0.15;
  }

  private land(g: Gull): void {
    const from = { x: g.sprite.x, y: g.sprite.y };
    g.flying = false;
    g.sprite.setFrame(2);
    this.scene.tweens.add({
      targets: g.sprite,
      x: g.perch.x,
      y: g.perch.y,
      duration: 1400,
      ease: 'Sine.easeInOut',
      onStart: () => g.sprite.setFlipX(g.perch.x < from.x),
      onComplete: () => {
        if (!g.sprite.active || g.flying) return;
        g.sprite.setFrame(0);
        this.sitDepth(g);
      },
    });
  }

  // ------------------------------------------------------------ ducks

  /** A drake and two ducks somewhere along the reeds, east of the pier. */
  private placeDucks(): void {
    const spots: Vec2[] = [];
    const { width, height } = this.map.data;
    for (let y = 0; y < height; y++) for (let x = Math.floor(width * 0.6); x < width - 2; x++) if (this.water(x + 0.5, y + 0.5) && this.nearBank(x + 0.5, y + 0.5)) spots.push({ x: x + 0.5, y: y + 0.5 });
    if (spots.length === 0) return;
    const at = spots[Math.floor(Math.random() * spots.length)];
    for (let i = 0; i < 3; i++) {
      const gx = at.x + (i - 1) * 0.6;
      const gy = at.y + (i % 2) * 0.4;
      if (!this.water(gx, gy)) continue;
      const base = i === 0 ? 0 : 3;
      const p = gridToScreen(gx, gy);
      const sprite = this.scene.add.sprite(p.x, p.y, 'jt-duck', base).setOrigin(0.5, 0.75).setDepth(depthAt(gx, gy));
      this.ducks.push({ sprite, gx, gy, base, dabble: 0, paddle: Math.random() });
    }
  }

  private nearBank(gx: number, gy: number): boolean {
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (!this.water(gx + dx, gy + dy)) return true;
    return false;
  }

  private updateDucks(dt: number, player: Vec2): void {
    if (this.ducks.length === 0) return;
    const lead = this.ducks[0];
    // The drake picks somewhere along the bank to paddle to; the others follow him.
    if (!this.duckTarget || Math.hypot(this.duckTarget.x - lead.gx, this.duckTarget.y - lead.gy) < 0.3) {
      for (let tries = 0; tries < 12; tries++) {
        const t = { x: lead.gx + (Math.random() - 0.5) * 8, y: lead.gy + (Math.random() - 0.5) * 4 };
        if (this.water(t.x, t.y) && this.clearRun({ x: lead.gx, y: lead.gy }, t) && Math.hypot(t.x - player.x, t.y - player.y) > 3) {
          this.duckTarget = t;
          break;
        }
      }
    }
    // Shy: they paddle away from the hero when they come close (on the bank or the pier).
    const scared = Math.hypot(player.x - lead.gx, player.y - lead.gy) < 2.5;
    this.ducks.forEach((d, i) => {
      const goal = i === 0 ? this.duckTarget : { x: this.ducks[i - 1].gx - 0.55, y: this.ducks[i - 1].gy + (i % 2 ? 0.35 : -0.35) };
      d.paddle += dt;
      if (d.dabble > 0) {
        d.dabble -= dt;
        if (d.dabble <= 0) d.sprite.setFrame(d.base);
        return;
      }
      if (!scared && Math.random() < dt * 0.06) {
        d.dabble = 1.5 + Math.random() * 2;
        d.sprite.setFrame(d.base + 2);
        return;
      }
      if (!goal) return;
      let vx = goal.x - d.gx;
      let vy = goal.y - d.gy;
      if (scared) {
        vx = d.gx - player.x;
        vy = d.gy - player.y;
      }
      const len = Math.hypot(vx, vy);
      if (len < 0.08) return;
      const step = Math.min(len, (scared ? 0.9 : 0.3) * dt);
      const nx = d.gx + (vx / len) * step;
      const ny = d.gy + (vy / len) * step;
      if (!this.water(nx, ny)) {
        this.duckTarget = undefined;
        return;
      }
      d.gx = nx;
      d.gy = ny;
      const p = gridToScreen(nx, ny);
      const before = d.sprite.x;
      d.sprite.setPosition(p.x, p.y + Math.sin(d.paddle * 3) * 0.5).setDepth(depthAt(nx, ny));
      if (Math.abs(p.x - before) > 0.01) d.sprite.setFlipX(p.x < before);
      d.sprite.setFrame(d.base + (Math.floor(d.paddle * 2.5) % 2));
    });
  }

  private clearRun(from: Vec2, to: Vec2): boolean {
    for (let t = 0; t <= 1; t += 0.1) if (!this.water(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)) return false;
    return true;
  }
}
