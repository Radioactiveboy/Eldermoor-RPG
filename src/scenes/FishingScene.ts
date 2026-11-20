import Phaser from 'phaser';
import { itemScale } from '../art/items';
import { GameAudio } from '../audio/Audio';
import { biteDelay, FISH, FishKind, fishAt, markerAt, MAX_SLIPS, onFish, rollFish, WaterId, WATERS } from '../systems/Fishing';
import { Inventory, itemDef } from '../systems/Inventory';
import { drawPanel, UI_COLORS, UI_FONT } from '../ui/theme';

export interface FishingSceneData {
  water: WaterId;
  /** The hour now (the clock keeps running while the hero fishes). */
  hour: () => number;
  /** Called with each fish landed (already in the satchel), for the diary and XP. */
  onCatch: (fish: FishKind) => void;
  /** Called once, as the hero packs up. */
  onClose: () => void;
}

const W = 460;
const H = 236;
const PAD = 14;
/** The close-up of the water with the float in it. */
const POOL = { x: -W / 2 + PAD, y: 40, w: W - PAD * 2, h: 78 };
/** The reel bar. */
const BAR = { x: -W / 2 + PAD + 8, y: 158, w: W - PAD * 2 - 16, h: 20 };
const MARGIN = 16;
const GOLD = '#e8c977';
const GOOD = 0x6fcf5a;
const BAD = 0xd0473a;

type Phase =
  /** The float sits on the water; something will bite in a while. Pressing now is too soon. */
  | { kind: 'wait'; until: number; nibbles: number }
  /** The float has gone under: strike before it comes up. */
  | { kind: 'bite'; fish: FishKind; until: number }
  /** Hooked: press while the marker is over the fish. */
  | { kind: 'reel'; fish: FishKind; t: number; pulls: number; slips: number; phase: number }
  /** Landed, lost, or struck too soon: press to cast again. */
  | { kind: 'done' };

/**
 * Fishing at the water's edge: a small window at the bottom of the screen
 * with a close-up of the float on the water and a reel bar.
 *
 * Cast, and watch the float. It bobs and twitches (nibbles) for a few seconds,
 * then goes under: press Space, E, Enter or tap to strike before it comes back
 * up. Hooked, the fish darts about along the reel bar while a marker sweeps to
 * and fro: press as the marker crosses the fish to pull it in, a few times for
 * a big one. Press when it's not over the fish and the line slips; three slips
 * and it's gone. Esc packs up. What bites depends on the water and the hour
 * (systems/Fishing.ts).
 */
export class FishingScene extends Phaser.Scene {
  private data_!: FishingSceneData;
  private box!: Phaser.GameObjects.Container;
  private blocker!: Phaser.GameObjects.Zone;
  private pool!: Phaser.GameObjects.Graphics;
  private bar!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;
  private prize?: Phaser.GameObjects.Image;
  private phase: Phase = { kind: 'done' };
  private clock = 0;
  /** The float's dip (0 resting, 1 under) and a ring spreading out from it. */
  private dip = 0;
  private rings: Array<{ r: number; a: number }> = [];
  private flash?: { color: number; until: number };
  private closed = false;
  private readyAt = 0;

  constructor() {
    super('Fishing');
  }

  create(data: FishingSceneData): void {
    this.data_ = data;
    this.closed = false;
    this.clock = 0;
    this.rings = [];
    this.flash = undefined;
    this.prize = undefined;
    this.readyAt = this.time.now + 200;

    // Clicks on the world behind strike (or cast) rather than walking the hero off.
    this.blocker = this.add.zone(0, 0, 10, 10).setOrigin(0).setInteractive();
    this.blocker.on('pointerdown', () => this.press());

    const frame = this.add.graphics();
    frame.fillStyle(UI_COLORS.panel, 1);
    frame.fillRoundedRect(-W / 2, 0, W, H, 8);
    drawPanel(frame, -W / 2, 0, W, H);
    const title = this.add
      .text(-W / 2 + PAD, PAD - 2, `Fishing ${WATERS[data.water].name}`, { fontFamily: UI_FONT, fontSize: '14px', color: GOLD, fontStyle: 'bold' })
      .setOrigin(0, 0);
    const esc = this.add
      .text(W / 2 - PAD, PAD - 1, 'Esc: pack up', { fontFamily: UI_FONT, fontSize: '12px', color: UI_COLORS.textMuted })
      .setOrigin(1, 0);
    esc.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.close();
    });
    this.pool = this.add.graphics();
    this.bar = this.add.graphics();
    this.status = this.add
      .text(0, 126, '', { fontFamily: UI_FONT, fontSize: '14px', color: UI_COLORS.text, align: 'center' })
      .setOrigin(0.5, 0);
    this.help = this.add
      .text(0, H - PAD - 14, '', { fontFamily: UI_FONT, fontSize: '12px', color: UI_COLORS.textMuted, align: 'center' })
      .setOrigin(0.5, 0);
    this.box = this.add.container(0, 0, [frame, title, esc, this.pool, this.bar, this.status, this.help]);

    const kb = this.input.keyboard!;
    for (const key of ['SPACE', 'E', 'ENTER']) kb.on(`keydown-${key}`, () => this.press());
    kb.on('keydown-ESC', () => this.close());

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));
    this.box.setAlpha(0).y += 8;
    this.tweens.add({ targets: this.box, alpha: 1, y: '-=8', duration: 160, ease: 'Cubic.easeOut' });
    this.cast();
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.1, deltaMs / 1000);
    this.clock += dt;
    const p = this.phase;
    if (p.kind === 'wait') {
      // Now and then a nibble: the float twitches, but it isn't a bite yet.
      if (Math.random() < dt * 0.6 && this.clock < p.until - 0.6) {
        p.nibbles++;
        this.dip = 0.35;
        this.ring();
        GameAudio.drip(0.35);
      }
      if (this.clock >= p.until) this.bite();
    } else if (p.kind === 'bite') {
      this.dip = 1;
      if (this.clock >= p.until) this.lost('Too slow. The float bobs back up, and the bait is gone.');
    } else if (p.kind === 'reel') {
      p.t += dt;
    }
    if (p.kind !== 'bite') this.dip = Math.max(0, this.dip - dt * 2.5);
    for (const r of this.rings) {
      r.r += dt * 28;
      r.a -= dt * 0.9;
    }
    this.rings = this.rings.filter((r) => r.a > 0);
    this.drawPool();
    this.drawBar();
  }

  // ------------------------------------------------------------ the phases

  private cast(): void {
    this.prize?.destroy();
    this.prize = undefined;
    GameAudio.swing();
    this.time.delayedCall(220, () => GameAudio.splash(false));
    this.ring();
    this.phase = { kind: 'wait', until: this.clock + biteDelay(this.data_.hour()), nibbles: 0 };
    this.status.setText('You cast out, and watch the float...');
    this.help.setText('Wait for it to go right under, then strike: Space, E or tap');
  }

  private bite(): void {
    const fish = rollFish(this.data_.water, this.data_.hour());
    this.phase = { kind: 'bite', fish, until: this.clock + FISH[fish].bite };
    this.dip = 1;
    this.ring();
    this.ring();
    GameAudio.splash(false);
    this.status.setText('The float goes under! Strike!');
    this.status.setColor(GOLD);
  }

  private hook(fish: FishKind): void {
    this.phase = { kind: 'reel', fish, t: 0, pulls: 0, slips: 0, phase: Math.random() * Math.PI * 2 };
    GameAudio.splash(true);
    this.status.setColor(UI_COLORS.text);
    this.status.setText(fish === 'boot' ? 'Something heavy... it isn\'t fighting much.' : 'Hooked! Reel in when the marker is over the fish.');
    this.help.setText('Press as the marker crosses the green. Miss three times and it\'s gone');
  }

  private landed(fish: FishKind): void {
    const def = FISH[fish];
    this.phase = { kind: 'done' };
    GameAudio.splash(true);
    if (!Inventory.add(def.item, 1)) {
      this.status.setText(`You land ${def.name}, but your satchel is full. You let it go.`);
    } else {
      GameAudio.pickup();
      this.status.setText(fish === 'boot' ? 'An old boot. Tobin will laugh.' : `You land ${def.name}!`);
      this.data_.onCatch(fish);
      this.prize = this.add.image(0, POOL.y + POOL.h / 2, itemDef(def.item).icon).setScale(itemScale(3.2));
      this.box.add(this.prize);
      this.tweens.add({ targets: this.prize, y: '-=10', duration: 260, yoyo: true, ease: 'Sine.easeOut' });
    }
    this.status.setColor(GOLD);
    this.help.setText('Space: cast again    Esc: pack up');
  }

  private lost(why: string): void {
    this.phase = { kind: 'done' };
    this.status.setText(why);
    this.status.setColor(UI_COLORS.text);
    this.help.setText('Space: cast again    Esc: pack up');
  }

  /** Space, E, Enter or a tap: strike, pull, or cast again, depending. */
  private press(): void {
    if (this.closed || this.time.now < this.readyAt) return;
    const p = this.phase;
    if (p.kind === 'done') {
      this.cast();
    } else if (p.kind === 'wait') {
      GameAudio.swing();
      this.lost(p.nibbles > 0 ? 'Too soon: that was only a nibble. The bait comes up bare.' : 'Too soon. Nothing was biting yet.');
    } else if (p.kind === 'bite') {
      this.hook(p.fish);
    } else {
      const def = FISH[p.fish];
      const marker = markerAt(p.t);
      if (onFish(marker, fishAt(def, p.t, p.phase), def.zone)) {
        p.pulls++;
        GameAudio.reel();
        this.flash = { color: GOOD, until: this.clock + 0.25 };
        this.ring();
        if (p.pulls >= def.pulls) this.landed(p.fish);
      } else {
        p.slips++;
        GameAudio.miss();
        this.flash = { color: BAD, until: this.clock + 0.25 };
        if (p.slips >= MAX_SLIPS) this.lost(`The line goes slack. ${def.name[0].toUpperCase()}${def.name.slice(1)} slipped the hook.`);
      }
    }
  }

  private close(): void {
    if (this.closed) return;
    this.closed = true;
    GameAudio.click();
    this.tweens.add({
      targets: this.box,
      alpha: 0,
      duration: 140,
      onComplete: () => {
        this.scene.stop();
        this.data_.onClose();
      },
    });
  }

  // ------------------------------------------------------------ drawing

  private ring(): void {
    this.rings.push({ r: 4, a: 0.8 });
  }

  /** The close-up of the water: ripples, the line coming in from the top, and the red and white float. */
  private drawPool(): void {
    const g = this.pool;
    g.clear();
    const { x, y, w, h } = POOL;
    const night = this.data_.hour() >= 21 || this.data_.hour() < 5;
    g.fillStyle(night ? 0x14283e : 0x2a5a7a, 1);
    g.fillRoundedRect(x, y, w, h, 6);
    g.fillStyle(night ? 0x1c3450 : 0x3a7090, 1);
    g.fillRoundedRect(x, y, w, h * 0.45, { tl: 6, tr: 6, bl: 0, br: 0 });
    // Slow ripples across the water.
    g.lineStyle(1, 0xbfe0f0, night ? 0.15 : 0.3);
    for (let i = 0; i < 7; i++) {
      const rx = x + ((i * 83 + this.clock * 14) % w);
      const ry = y + 12 + ((i * 29) % (h - 20));
      g.lineBetween(rx, ry, Math.min(x + w - 4, rx + 18 + (i % 3) * 8), ry);
    }
    const fx = 0;
    const bob = Math.sin(this.clock * 2.2) * 1.5;
    const fy = y + h * 0.55 + bob + this.dip * 9;
    // The line, down from the rod tip out of view.
    g.lineStyle(1, 0xe8e4d8, 0.8);
    g.lineBetween(x + w * 0.2, y, fx, fy - 10 + this.dip * 8);
    for (const r of this.rings) {
      g.lineStyle(1.5, 0xe0f4ff, r.a);
      g.strokeEllipse(fx, fy + 2, r.r * 2.4, r.r * 0.8);
    }
    // The float: a red cap over a white body, sinking as it's pulled.
    const show = 1 - this.dip * 0.75;
    g.fillStyle(0xeee8dc, 1);
    g.fillEllipse(fx, fy - 2 * show, 7, 8 * show);
    g.fillStyle(0xc8434a, 1);
    g.fillEllipse(fx, fy - 7 * show, 6, 7 * show);
    g.fillStyle(0x1a1410, 1);
    g.fillRect(fx - 0.5, fy - 13 * show, 1, 4 * show);
    // The water's surface over the float's foot.
    g.fillStyle(night ? 0x14283e : 0x2a5a7a, 0.9);
    g.fillRect(fx - 6, fy + 1, 12, 3);
  }

  /** The reel bar: the fish (green) darting about, the marker sweeping, and pips for pulls and slips. */
  private drawBar(): void {
    const g = this.bar;
    g.clear();
    const p = this.phase;
    if (p.kind !== 'reel') return;
    const def = FISH[p.fish];
    const { x, y, w, h } = BAR;
    g.fillStyle(0x0d0a10, 1);
    g.fillRoundedRect(x, y, w, h, 5);
    const fish = fishAt(def, p.t, p.phase);
    g.fillStyle(GOOD, 0.8);
    g.fillRoundedRect(x + (fish - def.zone / 2) * w, y + 2, def.zone * w, h - 4, 4);
    const m = markerAt(p.t);
    const flash = this.flash && this.clock < this.flash.until ? this.flash.color : 0xffffff;
    g.fillStyle(flash, 1);
    g.fillRect(x + m * w - 2, y - 4, 4, h + 8);
    g.lineStyle(2, 0xc9a14a, 1);
    g.strokeRoundedRect(x, y, w, h, 5);
    // Pulls landed (gold) and slips (red) underneath.
    for (let i = 0; i < def.pulls; i++) {
      g.fillStyle(i < p.pulls ? 0xe8c977 : 0x3a3020, 1);
      g.fillCircle(x + 6 + i * 14, y + h + 10, 4);
    }
    for (let i = 0; i < MAX_SLIPS; i++) {
      g.fillStyle(i < p.slips ? BAD : 0x3a3020, 1);
      g.fillCircle(x + w - 6 - i * 14, y + h + 10, 4);
    }
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.blocker.setSize(width, height);
    this.blocker.input!.hitArea.setSize(width, height);
    const scale = Math.min(1, (width - 24) / W);
    this.box.setScale(scale);
    this.box.setPosition(Math.round(width / 2), Math.round(height - MARGIN - H * scale - 60 * scale));
  }
}
