import Phaser from 'phaser';
import { itemScale } from '../art/sizes';
import { GameAudio } from '../audio/Audio';
import {
  Band, biteDelay, castPower, castReach, FISH, FishDef, fishInches, FishKind, Fight, hourBand, onTheRise, rollFish, startFight, stepFight,
  TENSION_SAFE, WaterId, WATERS,
} from '../systems/Fishing';
import { Inventory, itemDef } from '../systems/Inventory';
import { QuestLog } from '../systems/Quests';
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

const W = 520;
const H = 360;
const PAD = 14;
/** The view of the water: sky and far bank above, the water in cross-section below. */
const VIEW = { x: -W / 2 + PAD, y: 40, w: W - PAD * 2, h: 210 };
/** The water's surface, across the view. */
const SURFACE = VIEW.y + 70;
/** The riverbed. */
const BED = VIEW.y + VIEW.h - 14;
/** The near bank, where the hero stands: its edge. */
const BANK = VIEW.x + 58;
/** Where a cast can land, nearest and furthest. */
const NEAR = BANK + 20;
const FAR = VIEW.x + VIEW.w - 22;
/** The rod: its butt on the bank, its tip out over the water. */
const ROD_BUTT = { x: VIEW.x + 10, y: SURFACE - 6 };
const ROD_TIP = { x: VIEW.x + 112, y: VIEW.y + 16 };
/** How deep the bait hangs under the float. */
const HOOK_DEPTH = 62;
/** The meter under the view. */
const METER = { x: -W / 2 + PAD + 56, y: VIEW.y + VIEW.h + 40, w: W - PAD * 2 - 96, h: 14 };
const MARGIN = 16;
const GOLD = '#e8c977';
const GOLD_N = 0xe8c977;
const GOOD = 0x6fcf5a;
const BAD = 0xd0473a;

/** The colours of the sky and the water at each part of the day. */
const SKY: Record<Band, { top: number; low: number; water: number; deep: number; bank: number; light: number }> = {
  dawn: { top: 0x5a5a8e, low: 0xf0b08a, water: 0x4a6e8e, deep: 0x0e1e30, bank: 0x2a3a3a, light: 0.06 },
  day: { top: 0x5a9ad0, low: 0xcce8f4, water: 0x3a80a6, deep: 0x0c2638, bank: 0x2a4a2e, light: 0.08 },
  dusk: { top: 0x2e2a5a, low: 0xf08c4a, water: 0x3a4c6c, deep: 0x0a1222, bank: 0x1e2430, light: 0.05 },
  night: { top: 0x060a1e, low: 0x1c2a4c, water: 0x16304a, deep: 0x04080f, bank: 0x0a1018, light: 0 },
};

type Phase =
  /** On the bank, rod ready: hold to swing back, let go to cast. */
  | { kind: 'ready'; charging: boolean; held: number }
  /** The float flying out. */
  | { kind: 'flying'; t: number; from: number; to: number; rise: boolean }
  /** The float sits on the water; a fish is coming. Pressing now is too soon. */
  | { kind: 'wait'; fish: FishKind; until: number; nextNibble: number; nibbled: boolean }
  /** The float has gone under: strike before it comes up. */
  | { kind: 'bite'; fish: FishKind; until: number }
  /** Hooked: play it. */
  | { kind: 'fight'; fish: FishKind; fight: Fight; lastClick: number; lastSplash: number }
  /** Out of the water it comes. */
  | { kind: 'leap'; fish: FishKind; t: number; from: { x: number; y: number } }
  /** The catch card: press to fish on. */
  | { kind: 'card'; fish: FishKind }
  /** Lost it (or struck too soon): press to fish on. */
  | { kind: 'lost' };

interface Ring { x: number; r: number; a: number; grow: number }
interface Drop { x: number; y: number; vx: number; vy: number; a: number; under: boolean }

/** A little seeded random, so the far bank and the weed stay put. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function mix(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const ch = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * Fishing at the water's edge: a window at the bottom of the screen with the
 * water in cross-section, the sky and the far bank above (as the hour has
 * them), and what's going on under the float below.
 *
 * Hold Space, E, Enter or a tap to swing the rod back (a marker sweeps out
 * across the water and back), and let go to cast. Land on the rings of a
 * rising fish and something bites twice as soon. Watch the shadow come in
 * and nose at the bait; when the float goes right under, strike. Then play
 * it: hold to reel in, and let go when it gathers itself and runs (the water
 * boils first), or the line snaps. Leave the line slack too long and the hook
 * falls out. Land it and it leaps out onto a catch card. Esc packs up. The
 * rules are in systems/Fishing.ts.
 */
export class FishingScene extends Phaser.Scene {
  private data_!: FishingSceneData;
  private box!: Phaser.GameObjects.Container;
  private blocker!: Phaser.GameObjects.Zone;
  private world!: Phaser.GameObjects.Graphics;
  private fishG!: Phaser.GameObjects.Graphics;
  private front!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private help!: Phaser.GameObjects.Text;
  private card: Phaser.GameObjects.GameObject[] = [];
  private cardRays?: Phaser.GameObjects.Graphics;
  private phase: Phase = { kind: 'lost' };
  private clock = 0;
  private held = false;
  /** Where the float sits on the water (x), and how far it's dipped (0 riding, 1 under). */
  private floatX = NEAR + 120;
  private dip = 0;
  /** A fish rising out on the water: where (0-1 across), and when it next shows. */
  private rise = 0.6;
  private nextRise = 0;
  private rings: Ring[] = [];
  private drops: Drop[] = [];
  private bubbles: Array<{ x: number; y: number; r: number; v: number }> = [];
  private shake = 0;
  private closed = false;
  private readyAt = 0;
  /** The scenery that doesn't move: the far treeline, the stars, the weed, the pebbles. */
  private trees: Array<{ x: number; h: number; w: number }> = [];
  private stars: Array<{ x: number; y: number; s: number }> = [];
  private weeds: Array<{ x: number; h: number; phase: number }> = [];
  private pebbles: Array<{ x: number; y: number; r: number; c: number }> = [];
  private idlers: Array<{ x: number; y: number; v: number; len: number }> = [];

  constructor() {
    super('Fishing');
  }

  create(data: FishingSceneData): void {
    this.data_ = data;
    this.closed = false;
    this.clock = 0;
    this.held = false;
    this.rings = [];
    this.drops = [];
    this.bubbles = [];
    this.card = [];
    this.cardRays = undefined;
    this.readyAt = this.time.now + 200;
    this.scenery();

    // Clicks on the world behind strike (or cast) rather than walking the hero off.
    this.blocker = this.add.zone(0, 0, 10, 10).setOrigin(0).setInteractive();
    this.blocker.on('pointerdown', () => this.down());
    this.input.on('pointerup', () => this.up());

    const frame = this.add.graphics();
    frame.fillStyle(UI_COLORS.panel, 1);
    frame.fillRoundedRect(-W / 2, 0, W, H, 8);
    drawPanel(frame, -W / 2, 0, W, H);
    const title = this.add
      .text(-W / 2 + PAD + 2, PAD - 2, `Fishing ${WATERS[data.water].name}`, { fontFamily: UI_FONT, fontSize: '15px', color: GOLD, fontStyle: 'bold' })
      .setOrigin(0, 0);
    const esc = this.add
      .text(W / 2 - PAD - 2, PAD, 'Esc: pack up', { fontFamily: UI_FONT, fontSize: '12px', color: UI_COLORS.textMuted })
      .setOrigin(1, 0);
    esc.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.close();
    });
    this.world = this.add.graphics();
    this.fishG = this.add.graphics();
    this.front = this.add.graphics();
    this.hud = this.add.graphics();
    this.status = this.add
      .text(0, VIEW.y + VIEW.h + 10, '', { fontFamily: UI_FONT, fontSize: '15px', color: UI_COLORS.text, align: 'center' })
      .setOrigin(0.5, 0);
    this.help = this.add
      .text(0, H - PAD - 16, '', { fontFamily: UI_FONT, fontSize: '13px', color: UI_COLORS.textMuted, align: 'center' })
      .setOrigin(0.5, 0);
    const small = { fontFamily: UI_FONT, fontSize: '12px', color: UI_COLORS.textMuted };
    this.labels = {
      top: this.add.text(METER.x - 10, METER.y + METER.h / 2, '', small).setOrigin(1, 0.5),
      under: this.add.text(METER.x - 10, METER.y + METER.h + 12, '', small).setOrigin(1, 0.5),
      right: this.add.text(METER.x + METER.w + 10, METER.y + METER.h / 2, '', small).setOrigin(0, 0.5),
    };
    this.box = this.add.container(0, 0, [
      frame, title, esc, this.world, this.fishG, this.front, this.hud, this.status, this.help, this.labels.top, this.labels.under, this.labels.right,
    ]);

    const kb = this.input.keyboard!;
    for (const key of ['SPACE', 'E', 'ENTER']) {
      kb.on(`keydown-${key}`, (e: KeyboardEvent) => !e.repeat && this.down());
      kb.on(`keyup-${key}`, () => this.up());
    }
    kb.on('keydown-ESC', () => this.close());

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.layout, this);
      this.input.off('pointerup');
    });
    this.box.setAlpha(0);
    this.tweens.add({ targets: this.box, alpha: 1, duration: 160, ease: 'Cubic.easeOut' });
    this.ready();
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.1, deltaMs / 1000);
    this.clock += dt;
    const p = this.phase;
    if (p.kind === 'ready') {
      if (p.charging) p.held += dt;
    } else if (p.kind === 'flying') {
      p.t += dt / 0.55;
      if (p.t >= 1) this.landFloat(p.to, p.rise);
    } else if (p.kind === 'wait') {
      if (this.clock >= p.nextNibble && this.clock < p.until - 0.3) {
        // The fish noses at the bait: the float twitches, but it isn't a bite yet.
        p.nextNibble = this.clock + 0.5 + Math.random() * 0.6;
        p.nibbled = true;
        this.dip = 0.3 + Math.random() * 0.15;
        this.ring(this.floatX, 0.5);
        GameAudio.drip(0.3);
      }
      if (this.clock >= p.until) this.bite(p.fish);
    } else if (p.kind === 'bite') {
      this.dip = 1;
      if (Math.random() < dt * 8) this.bubble(this.floatX + (Math.random() - 0.5) * 8, SURFACE + 8);
      if (this.clock >= p.until) this.lost('Too slow. The float bobs back up, and the bait is gone.');
    } else if (p.kind === 'fight') {
      this.fightStep(p, dt);
    } else if (p.kind === 'leap') {
      p.t += dt / 0.8;
      if (p.t >= 1) this.showCard(p.fish);
    }
    if (p.kind !== 'bite' && p.kind !== 'fight') this.dip = Math.max(0, this.dip - dt * 2.5);

    // A fish rising now and then, out on the water: rings to aim a cast at.
    if (this.clock >= this.nextRise && (p.kind === 'ready' || p.kind === 'flying')) {
      this.nextRise = this.clock + 1.1 + Math.random() * 0.6;
      const x = this.reachX(this.rise);
      this.ring(x, 0.9, 30);
      this.ring(x, 0.6, 22);
      if (Math.random() < 0.5) this.splash(x, 4, 0.8);
    }
    this.animate(dt);
    this.draw();
  }

  // ------------------------------------------------------------ the phases

  private ready(): void {
    this.clearCard();
    this.phase = { kind: 'ready', charging: false, held: 0 };
    this.rise = 0.35 + Math.random() * 0.55;
    this.nextRise = this.clock + 0.2;
    this.dip = 0;
    this.setStatus('The water is still. Look for a fish rising...', UI_COLORS.text);
    this.help.setText('Hold to swing the rod back, let go to cast. Aim for the rings.');
  }

  private cast(power: number): void {
    const reach = castReach(power);
    const rise = onTheRise(reach, this.rise);
    this.phase = { kind: 'flying', t: 0, from: ROD_TIP.x, to: this.reachX(reach), rise };
    GameAudio.swing();
    this.setStatus('Whssh...', UI_COLORS.text);
    this.help.setText('');
  }

  private landFloat(x: number, rise: boolean): void {
    this.floatX = x;
    this.dip = 0.6;
    this.ring(x, 1, 26);
    this.ring(x, 0.7, 16);
    this.splash(x, 6, 0.7);
    GameAudio.splash(false);
    const fish = rollFish(this.data_.water, this.data_.hour());
    const delay = biteDelay(this.data_.hour()) * (rise ? 0.5 : 1);
    this.phase = { kind: 'wait', fish, until: this.clock + delay, nextNibble: this.clock + Math.max(0.8, delay - 1.6), nibbled: false };
    this.setStatus(rise ? 'Plop! Right on the rise.' : 'Plop. You watch the float...', rise ? GOLD : UI_COLORS.text);
    this.help.setText('Wait for the float to go right under, then strike.');
  }

  private bite(fish: FishKind): void {
    this.phase = { kind: 'bite', fish, until: this.clock + FISH[fish].bite };
    this.dip = 1;
    this.ring(this.floatX, 1, 30);
    this.ring(this.floatX, 0.8, 20);
    this.splash(this.floatX, 8, 1);
    this.shake = 0.15;
    GameAudio.splash(false);
    this.setStatus('It\'s under! Strike!', GOLD);
    this.help.setText('Press now!');
  }

  private hook(fish: FishKind): void {
    this.phase = { kind: 'fight', fish, fight: startFight(FISH[fish]), lastClick: 0, lastSplash: 0 };
    this.shake = 0.25;
    GameAudio.splash(true);
    this.splash(this.floatX, 12, 1.2);
    this.setStatus(fish === 'boot' ? 'Something heavy... it isn\'t fighting much.' : 'Hooked! Reel it in.', UI_COLORS.text);
    this.help.setText('Hold to reel. Let go when it runs, or the line snaps.');
  }

  private fightStep(p: Extract<Phase, { kind: 'fight' }>, dt: number): void {
    const def = FISH[p.fish];
    const was = p.fight.mode;
    const end = stepFight(p.fight, def, this.held, dt);
    const f = p.fight;
    if (f.mode !== was) {
      if (f.mode === 'warn') {
        GameAudio.bubble();
        this.setStatus('It\'s gathering itself...', '#f0a860');
      } else if (f.mode === 'run') {
        GameAudio.splash(true);
        this.shake = 0.2;
        this.setStatus('It runs! Let it have some line!', '#f07a60');
      } else {
        this.setStatus('It tires. Reel in!', UI_COLORS.text);
      }
    }
    const pos = this.fightFishAt(p);
    if (f.mode === 'warn' && Math.random() < dt * 14) this.bubble(pos.x + (Math.random() - 0.5) * 20, pos.y);
    if (f.mode === 'run' && this.clock - p.lastSplash > 0.22) {
      p.lastSplash = this.clock;
      this.splash(pos.x, 5, 0.9);
      this.ring(pos.x, 0.7, 18);
    }
    if (this.held && f.mode !== 'run' && this.clock - p.lastClick > 0.12) {
      p.lastClick = this.clock;
      GameAudio.reel();
    }
    if (end === 'landed') this.landed(p.fish, pos);
    else if (end === 'snapped') {
      GameAudio.miss();
      this.shake = 0.3;
      this.lost(`Snap! The line parts, and ${def.name} is gone with your hook.`);
    } else if (end === 'slipped') this.lost(`The line goes slack. ${def.name[0].toUpperCase()}${def.name.slice(1)} shakes the hook free.`);
  }

  private landed(fish: FishKind, from: { x: number; y: number }): void {
    this.phase = { kind: 'leap', fish, t: 0, from };
    GameAudio.splash(true);
    this.splash(from.x, 16, 1.5);
    this.ring(from.x, 1, 34);
    this.setStatus('', UI_COLORS.text);
    this.help.setText('');
  }

  private showCard(fish: FishKind): void {
    const def = FISH[fish];
    this.phase = { kind: 'card', fish };
    const first = !QuestLog.hasFlag(`caught-${fish}`);
    const kept = Inventory.add(def.item, 1);
    if (kept) {
      GameAudio.pickup();
      if (first) GameAudio.questChime();
      else GameAudio.sparkle();
      this.data_.onCatch(fish);
    } else {
      GameAudio.splash(false);
    }
    const cx = VIEW.x + VIEW.w / 2;
    const cy = VIEW.y + 74;
    const shade = this.add.graphics();
    shade.fillStyle(0x0c0906, 0.62);
    shade.fillRoundedRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h, 6);
    this.cardRays = this.add.graphics().setPosition(cx, cy);
    const icon = this.add.image(cx, cy, itemDef(def.item).icon).setScale(itemScale(1));
    const caps = def.name.replace(/^(a|an) /, '');
    const name = this.add
      .text(cx, VIEW.y + 138, caps[0].toUpperCase() + caps.slice(1), { fontFamily: UI_FONT, fontSize: '22px', color: GOLD, fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setShadow(0, 2, '#000000', 4, false, true);
    const size = fish === 'boot' ? 'About a size nine' : `${fishInches(def)} inches`;
    const where = kept ? size : `${size}, but your satchel is full. You let it go.`;
    const info = this.add
      .text(cx, VIEW.y + 168, where, { fontFamily: UI_FONT, fontSize: '14px', color: UI_COLORS.text })
      .setOrigin(0.5, 0);
    const note = this.add
      .text(cx, VIEW.y + 188, def.note, { fontFamily: UI_FONT, fontSize: '12px', color: UI_COLORS.textMuted, fontStyle: 'italic' })
      .setOrigin(0.5, 0);
    this.card = [shade, this.cardRays, icon, name, info, note];
    if (first && kept && fish !== 'boot') {
      const ribbon = this.add.graphics();
      const rx = cx + 62;
      const ry = VIEW.y + 26;
      ribbon.fillStyle(0xb8323a, 1);
      ribbon.fillRoundedRect(rx - 34, ry - 11, 68, 22, 4);
      ribbon.lineStyle(1.5, GOLD_N, 1);
      ribbon.strokeRoundedRect(rx - 34, ry - 11, 68, 22, 4);
      const label = this.add.text(rx, ry, 'First!', { fontFamily: UI_FONT, fontSize: '13px', color: '#fff4dc', fontStyle: 'bold' }).setOrigin(0.5);
      ribbon.setAngle(8);
      label.setAngle(8);
      this.card.push(ribbon, label);
      this.tweens.add({ targets: [ribbon, label], scale: { from: 1.8, to: 1 }, alpha: { from: 0, to: 1 }, duration: 320, delay: 250, ease: 'Back.easeOut' });
    }
    this.box.add(this.card);
    this.box.bringToTop(this.hud);
    this.tweens.add({ targets: icon, scale: { from: itemScale(0.6), to: itemScale(5) }, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: icon, y: cy - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 420 });
    for (const t of [name, info, note]) this.tweens.add({ targets: t, alpha: { from: 0, to: 1 }, y: '+=0', duration: 300, delay: 160 });
    this.setStatus(fish === 'boot' ? 'An old boot. Tobin will laugh.' : `You land ${def.name}!`, GOLD);
    this.help.setText('Press to cast again    Esc: pack up');
  }

  private clearCard(): void {
    for (const o of this.card) o.destroy();
    this.card = [];
    this.cardRays = undefined;
  }

  private lost(why: string): void {
    this.phase = { kind: 'lost' };
    this.setStatus(why, UI_COLORS.text);
    this.help.setText('Press to cast again    Esc: pack up');
  }

  /** Space, E, Enter or a tap going down. */
  private down(): void {
    if (this.closed || this.time.now < this.readyAt) return;
    this.held = true;
    const p = this.phase;
    if (p.kind === 'ready') {
      p.charging = true;
      p.held = 0;
      GameAudio.click();
    } else if (p.kind === 'wait') {
      GameAudio.swing();
      this.lost(p.nibbled ? 'Too soon: that was only a nibble. The bait comes up bare.' : 'Too soon. Nothing was biting yet.');
    } else if (p.kind === 'bite') {
      this.hook(p.fish);
    } else if (p.kind === 'card' || p.kind === 'lost') {
      this.held = false;
      this.ready();
    }
  }

  /** ...and coming up. */
  private up(): void {
    if (!this.held) return;
    this.held = false;
    const p = this.phase;
    if (p.kind === 'ready' && p.charging) this.cast(castPower(p.held));
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

  private setStatus(text: string, color: string): void {
    this.status.setText(text).setColor(color);
  }

  // ------------------------------------------------------------ the water's life

  private reachX(reach: number): number {
    return NEAR + (FAR - NEAR) * ((reach - castReach(0)) / (castReach(1) - castReach(0)));
  }

  private ring(x: number, a = 0.8, grow = 22): void {
    this.rings.push({ x, r: 3, a, grow });
  }

  private splash(x: number, n: number, force: number): void {
    for (let i = 0; i < n; i++) {
      this.drops.push({ x, y: SURFACE, vx: (Math.random() - 0.5) * 70 * force, vy: -(50 + Math.random() * 70) * force, a: 1, under: false });
    }
  }

  private bubble(x: number, y: number): void {
    this.bubbles.push({ x, y, r: 1 + Math.random() * 1.6, v: 14 + Math.random() * 14 });
  }

  private scenery(): void {
    const r = seeded(97);
    this.trees = [];
    for (let x = VIEW.x + 70; x < VIEW.x + VIEW.w - 18; x += 9 + r() * 10) this.trees.push({ x, h: 12 + r() * 22, w: 7 + r() * 6 });
    this.stars = Array.from({ length: 26 }, () => ({ x: VIEW.x + r() * VIEW.w, y: VIEW.y + 4 + r() * 46, s: r() }));
    this.weeds = Array.from({ length: 14 }, (_, i) => ({ x: BANK + 10 + i * 33 + r() * 18, h: 20 + r() * 34, phase: r() * 6 }));
    this.pebbles = Array.from({ length: 22 }, () => ({ x: VIEW.x + 50 + r() * (VIEW.w - 60), y: BED + 2 + r() * 8, r: 1.5 + r() * 3, c: r() }));
    this.idlers = Array.from({ length: 3 }, (_, i) => ({ x: VIEW.x + r() * VIEW.w, y: SURFACE + 40 + i * 30 + r() * 10, v: (8 + r() * 10) * (i % 2 ? -1 : 1), len: 14 + r() * 10 }));
  }

  private animate(dt: number): void {
    for (const r of this.rings) {
      r.r += dt * r.grow;
      r.a -= dt * 0.85;
    }
    this.rings = this.rings.filter((r) => r.a > 0);
    for (const d of this.drops) {
      d.vy += 260 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.a -= dt * 1.2;
      if (d.y > SURFACE && d.vy > 0) d.a = 0;
    }
    this.drops = this.drops.filter((d) => d.a > 0);
    for (const b of this.bubbles) {
      b.y -= b.v * dt;
      b.x += Math.sin(this.clock * 6 + b.r * 9) * 6 * dt;
    }
    this.bubbles = this.bubbles.filter((b) => b.y > SURFACE + 2);
    if (Math.random() < dt * 0.8) this.bubble(VIEW.x + 60 + Math.random() * (VIEW.w - 70), BED - 2);
    for (const f of this.idlers) {
      f.x += f.v * dt;
      if (f.x > VIEW.x + VIEW.w + 30) f.x = VIEW.x - 30;
      if (f.x < VIEW.x - 30) f.x = VIEW.x + VIEW.w + 30;
    }
    this.shake = Math.max(0, this.shake - dt);
  }

  /** Where the fish on the line is: x, y, which way it faces, and how hard it's thrashing. */
  private fightFishAt(p: Extract<Phase, { kind: 'fight' }>): { x: number; y: number; face: number; thrash: number } {
    const f = p.fight;
    const x = BANK + 26 + f.dist * (this.floatX - BANK - 26);
    const run = f.mode === 'run' ? 1 : f.mode === 'warn' ? 0.5 : 0;
    const y = SURFACE + 34 + f.dist * 24 + Math.sin(f.t * (2 + run * 6)) * (6 + run * 8);
    return { x, y, face: f.mode === 'run' ? 1 : -1, thrash: run };
  }

  // ------------------------------------------------------------ drawing

  private draw(): void {
    const band = hourBand(this.data_.hour());
    const pal = SKY[band];
    const g = this.world;
    g.clear();
    this.fishG.clear();
    const f = this.front;
    f.clear();
    const { x, y, w } = VIEW;
    const p = this.phase;

    // The sky, fading down to the horizon.
    const skyH = SURFACE - y;
    for (let i = 0; i < 14; i++) {
      g.fillStyle(mix(pal.top, pal.low, i / 13), 1);
      const y0 = y + (skyH * i) / 14;
      g.fillRect(x, y0, w, skyH / 14 + 1);
    }
    // Sun, moon and stars.
    if (band === 'night') {
      for (const s of this.stars) {
        g.fillStyle(0xfff4dc, 0.35 + 0.5 * Math.abs(Math.sin(this.clock * (0.6 + s.s) + s.s * 9)));
        g.fillRect(s.x, s.y, s.s > 0.8 ? 2 : 1, s.s > 0.8 ? 2 : 1);
      }
      g.fillStyle(0xf4ecd0, 1);
      g.fillCircle(x + w - 70, y + 22, 10);
      g.fillStyle(pal.top, 1);
      g.fillCircle(x + w - 65, y + 19, 9);
    } else {
      const sun = band === 'day' ? { sx: x + w - 80, sy: y + 20, c: 0xfff0b0 } : { sx: band === 'dawn' ? x + w - 120 : x + 170, sy: SURFACE - 22, c: 0xffc070 };
      g.fillStyle(sun.c, 0.18);
      g.fillCircle(sun.sx, sun.sy, 22);
      g.fillStyle(sun.c, 0.3);
      g.fillCircle(sun.sx, sun.sy, 15);
      g.fillStyle(sun.c, 1);
      g.fillCircle(sun.sx, sun.sy, 9);
    }
    // The far bank: a dark line of trees.
    g.fillStyle(mix(pal.bank, pal.low, 0.25), 1);
    for (const t of this.trees) g.fillTriangle(t.x - t.w, SURFACE - 4, t.x + t.w, SURFACE - 4, t.x, SURFACE - 4 - t.h);
    g.fillStyle(pal.bank, 1);
    for (const t of this.trees) g.fillTriangle(t.x - t.w * 0.7 + 5, SURFACE, t.x + t.w * 0.7 + 5, SURFACE, t.x + 5, SURFACE - t.h * 0.7);
    g.fillRect(x + 60, SURFACE - 4, w - 60, 4);

    // The water, deepening to the bed.
    const waterH = BED - SURFACE + 14;
    for (let i = 0; i < 16; i++) {
      g.fillStyle(mix(pal.water, pal.deep, i / 15), 1);
      g.fillRect(x, SURFACE + (waterH * i) / 16, w, waterH / 16 + 1);
    }
    // Shafts of light down through it.
    if (pal.light > 0) {
      for (let i = 0; i < 4; i++) {
        const sx = x + 110 + i * 110 + Math.sin(this.clock * 0.4 + i) * 12;
        g.fillStyle(0xe8f6ff, pal.light * (0.7 + 0.3 * Math.sin(this.clock * 0.7 + i * 2)));
        g.fillTriangle(sx, SURFACE, sx + 26, SURFACE, sx - 30, BED);
        g.fillTriangle(sx + 26, SURFACE, sx - 30, BED, sx - 6, BED);
      }
    }
    // Fish going about their business in the distance.
    for (const i of this.idlers) this.drawShadow(g, i.x, i.y, i.len, i.v > 0 ? 1 : -1, mix(pal.deep, pal.water, 0.25), 0.55);
    // The bed: mud, pebbles, weed swaying.
    g.fillStyle(mix(0x2a2016, pal.deep, 0.4), 1);
    g.fillRect(x, BED, w, y + VIEW.h - BED);
    for (const pb of this.pebbles) {
      g.fillStyle(mix(pb.c > 0.5 ? 0x6a6458 : 0x4a443a, pal.deep, 0.35), 1);
      g.fillEllipse(pb.x, pb.y, pb.r * 2.2, pb.r * 1.4);
    }
    for (const wd of this.weeds) {
      g.lineStyle(2.5, mix(0x3a6a2a, pal.deep, 0.45), 1);
      g.beginPath();
      g.moveTo(wd.x, BED + 2);
      for (let s = 1; s <= 6; s++) {
        const k = s / 6;
        g.lineTo(wd.x + Math.sin(this.clock * 1.2 + wd.phase + k * 2.4) * 6 * k, BED + 2 - wd.h * k);
      }
      g.strokePath();
    }
    for (const b of this.bubbles) {
      g.lineStyle(1, 0xdff4ff, 0.6);
      g.strokeCircle(b.x, b.y, b.r);
    }

    // The near bank, where the hero stands, with reeds at its edge.
    g.fillStyle(0x3a2a1c, 1);
    g.fillPoints([{ x, y: SURFACE - 8 }, { x: BANK - 8, y: SURFACE - 8 }, { x: BANK + 6, y: SURFACE + 18 }, { x: BANK - 6, y: BED }, { x, y: BED + 14 }], true);
    g.fillStyle(0x2a1e14, 1);
    g.fillPoints([{ x: BANK - 12, y: SURFACE + 10 }, { x: BANK + 6, y: SURFACE + 18 }, { x: BANK - 6, y: BED }, { x: BANK - 22, y: BED }], true);
    g.fillStyle(band === 'night' ? 0x1e3a1e : 0x4a7a32, 1);
    g.fillRect(x, SURFACE - 12, BANK - x - 6, 5);
    for (let i = 0; i < 5; i++) {
      const rx = BANK - 14 + i * 5;
      const sway = Math.sin(this.clock * 1.4 + i) * 2;
      g.lineStyle(1.5, band === 'night' ? 0x2a3a1a : 0x6a8a3a, 1);
      g.lineBetween(rx, SURFACE + 4, rx + sway, SURFACE - 26 - (i % 3) * 6);
      if (i % 2 === 0) {
        g.fillStyle(0x5a3a1e, 1);
        g.fillRoundedRect(rx + sway - 1.5, SURFACE - 30 - (i % 3) * 6, 3, 8, 1.5);
      }
    }

    // The surface: a bright line with glints drifting along it.
    g.lineStyle(1.5, mix(pal.low, 0xffffff, 0.4), band === 'night' ? 0.35 : 0.7);
    g.lineBetween(BANK + 4, SURFACE, x + w, SURFACE);
    for (let i = 0; i < 9; i++) {
      const gx = BANK + 10 + ((i * 61 + this.clock * 10) % (x + w - BANK - 30));
      g.lineStyle(1, 0xffffff, band === 'night' ? 0.2 : 0.45);
      g.lineBetween(gx, SURFACE + 3 + (i % 3) * 4, gx + 8 + (i % 4) * 3, SURFACE + 3 + (i % 3) * 4);
    }
    for (const r of this.rings) {
      g.lineStyle(1.5, 0xe8f6ff, r.a);
      g.strokeEllipse(r.x, SURFACE, r.r * 2.4, r.r * 0.7);
    }

    this.drawTackle(pal);
    this.drawHookedFish();

    for (const d of this.drops) {
      f.fillStyle(0xe8f6ff, d.a);
      f.fillCircle(d.x, d.y, 1.5);
    }
    // The landing marker as the rod swings back, and the rise to aim for.
    if (p.kind === 'ready' && p.charging) {
      const mx = this.reachX(castReach(castPower(p.held)));
      const on = onTheRise(castReach(castPower(p.held)), this.rise);
      f.lineStyle(2, on ? GOLD_N : 0xffffff, 0.9);
      f.strokeEllipse(mx, SURFACE, 22, 7);
      f.fillStyle(on ? GOLD_N : 0xffffff, 0.9);
      f.fillTriangle(mx - 5, SURFACE - 14, mx + 5, SURFACE - 14, mx, SURFACE - 7);
    }
    // The bite: a gold "!" over the float.
    if (p.kind === 'bite') this.mark(f, this.floatX, SURFACE - 30, GOLD_N, 1 + 0.15 * Math.sin(this.clock * 30));
    if (p.kind === 'fight' && p.fight.mode !== 'calm') {
      const at = this.fightFishAt(p);
      this.mark(f, at.x, SURFACE - 22, p.fight.mode === 'warn' ? 0xf0a860 : BAD, p.fight.mode === 'warn' ? 0.8 + 0.2 * Math.sin(this.clock * 40) : 1);
    }
    // A frame around the view.
    f.lineStyle(2, UI_COLORS.trimDark, 1);
    f.strokeRoundedRect(x, y, w, VIEW.h, 6);

    if (this.cardRays) {
      const r = this.cardRays;
      r.clear();
      r.setRotation(this.clock * 0.35);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        r.fillStyle(GOLD_N, 0.13);
        r.fillTriangle(0, 0, Math.cos(a - 0.12) * 92, Math.sin(a - 0.12) * 92, Math.cos(a + 0.12) * 92, Math.sin(a + 0.12) * 92);
      }
      r.fillStyle(GOLD_N, 0.12);
      r.fillCircle(0, 0, 40);
    }
    this.drawMeter();
    const s = this.shake > 0 ? this.shake * 14 : 0;
    this.world.setPosition((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    this.fishG.setPosition(this.world.x, this.world.y);
  }

  /** A "!" in a little circle. */
  private mark(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, scale: number): void {
    g.fillStyle(0x1c1712, 0.85);
    g.fillCircle(x, y, 10 * scale);
    g.lineStyle(2, color, 1);
    g.strokeCircle(x, y, 10 * scale);
    g.fillStyle(color, 1);
    g.fillRoundedRect(x - 1.5 * scale, y - 6 * scale, 3 * scale, 8 * scale, 1);
    g.fillCircle(x, y + 5 * scale, 1.6 * scale);
  }

  /** The rod, the line, the float and the bait. */
  private drawTackle(pal: (typeof SKY)[Band]): void {
    const g = this.world;
    const p = this.phase;
    const fight = p.kind === 'fight' ? p.fight : undefined;
    // How far the rod bends: with the swing back as it charges, and with the strain of a fish.
    let bend = fight ? fight.tension : this.dip * 0.25;
    let back = 0;
    if (p.kind === 'ready' && p.charging) back = castPower(p.held);
    if (p.kind === 'flying') back = -Math.sin(Math.min(1, p.t * 2) * Math.PI) * 0.4;
    if (p.kind === 'bite') bend = 0.35;
    const tip = {
      x: ROD_TIP.x - back * 58 + bend * 6,
      y: ROD_TIP.y + back * 6 + bend * 30,
    };
    // A curve from the butt, bending most near the tip.
    const ctrl = { x: (ROD_BUTT.x + ROD_TIP.x) / 2 - back * 20, y: (ROD_BUTT.y + ROD_TIP.y) / 2 - 8 };
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push({
        x: (1 - t) * (1 - t) * ROD_BUTT.x + 2 * (1 - t) * t * ctrl.x + t * t * tip.x,
        y: (1 - t) * (1 - t) * ROD_BUTT.y + 2 * (1 - t) * t * ctrl.y + t * t * tip.y,
      });
    }
    for (let i = 0; i < 12; i++) {
      g.lineStyle(i < 3 ? 4 : 3 - (i / 12) * 2, i < 3 ? 0x5a3a22 : 0x9a7444, 1);
      g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    }
    // The reel on the butt.
    const reel = pts[2];
    g.fillStyle(0x3a3a3e, 1);
    g.fillCircle(reel.x, reel.y + 4, 5);
    g.fillStyle(0x8a8a90, 1);
    g.fillCircle(reel.x, reel.y + 4, 2.5);
    g.lineStyle(1.5, 0xc8c8cc, 1);
    const spin = fight && this.held ? this.clock * 18 : 0;
    g.lineBetween(reel.x, reel.y + 4, reel.x + Math.cos(spin) * 5, reel.y + 4 + Math.sin(spin) * 5);

    const lineColor = fight && fight.tension > TENSION_SAFE[1] ? mix(0xe8e4d8, BAD, (fight.tension - TENSION_SAFE[1]) / (1 - TENSION_SAFE[1])) : 0xe8e4d8;
    if (p.kind === 'ready') {
      // Float dangling from the tip.
      const fy = tip.y + 22;
      g.lineStyle(1, lineColor, 0.8);
      g.lineBetween(tip.x, tip.y, tip.x, fy - 6);
      this.drawFloat(tip.x, fy, 0, 1);
      return;
    }
    if (p.kind === 'flying') {
      const t = Math.min(1, p.t);
      const fx = p.from + (p.to - p.from) * t;
      const fy = (1 - t) * (tip.y + 22) + t * SURFACE - Math.sin(t * Math.PI) * 60;
      g.lineStyle(1, lineColor, 0.8);
      g.lineBetween(tip.x, tip.y, fx, fy - 6);
      this.drawFloat(fx, fy, 0, 1);
      return;
    }
    if (p.kind === 'leap' || p.kind === 'card') return;
    if (fight) {
      // Straight from the tip into the water, and down to the fish's mouth.
      const at = this.fightFishAt(p as Extract<Phase, { kind: 'fight' }>);
      const entry = { x: at.x - 4, y: SURFACE };
      g.lineStyle(1 + fight.tension * 0.6, lineColor, 0.9);
      g.lineBetween(tip.x, tip.y, entry.x, entry.y);
      g.lineStyle(1, lineColor, 0.55);
      g.lineBetween(entry.x, entry.y, at.x + (at.face * FISH[(p as Extract<Phase, { kind: 'fight' }>).fish].shape.len) / 2, at.y);
      // Where the line cuts the water, a little wake.
      g.lineStyle(1, 0xe8f6ff, 0.5 + 0.3 * Math.sin(this.clock * 12));
      g.strokeEllipse(entry.x, SURFACE, 10 + fight.tension * 6, 3);
      return;
    }
    // Waiting, or biting: the line sags from the tip down to the float, then hangs to the bait.
    const bob = Math.sin(this.clock * 2.2) * 1.2;
    const fy = SURFACE + bob + this.dip * 10;
    const fx = this.floatX;
    g.lineStyle(1, lineColor, 0.8);
    g.beginPath();
    g.moveTo(tip.x, tip.y);
    for (let i = 1; i <= 16; i++) {
      const t = i / 16;
      g.lineTo(tip.x + (fx - tip.x) * t, tip.y + (fy - 9 - tip.y) * t + Math.sin(t * Math.PI) * 14);
    }
    g.strokePath();
    const hookY = SURFACE + HOOK_DEPTH + this.dip * 8;
    g.lineStyle(1, lineColor, 0.45);
    g.lineBetween(fx, fy + 2, fx, hookY);
    // The hook and its worm.
    g.lineStyle(1.5, 0xb0b0b8, 1);
    g.beginPath();
    g.arc(fx - 2.5, hookY + 2, 2.5, 0, Math.PI, false);
    g.strokePath();
    g.lineStyle(2.5, 0xd87a7a, 1);
    g.beginPath();
    for (let i = 0; i <= 6; i++) {
      const wy = hookY + 1 + i * 1.6;
      const wx = fx + Math.sin(this.clock * 7 + i * 1.3) * 2;
      if (i === 0) g.moveTo(wx, wy);
      else g.lineTo(wx, wy);
    }
    g.strokePath();
    // Lead shot.
    g.fillStyle(0x5a5a60, 1);
    g.fillCircle(fx, hookY - 12, 1.8);

    // The fish coming in to the bait.
    if (p.kind === 'wait' || p.kind === 'bite') {
      const def = FISH[p.fish];
      const until = p.kind === 'wait' ? p.until : p.until - def.bite;
      const k = p.kind === 'bite' ? 1 : Math.max(0, 1 - (until - this.clock) / 2.6);
      if (k > 0) {
        const ease = 1 - (1 - k) * (1 - k);
        const side = this.floatX > VIEW.x + VIEW.w * 0.6 ? -1 : 1;
        // Nosing at the bait: little darts in.
        const nose = p.kind === 'wait' ? Math.max(0, Math.sin(this.clock * 9)) * 4 * ease : 0;
        const cx = fx + side * (def.shape.len / 2 + 4) + side * (1 - ease) * 150 - side * nose;
        const cy = hookY + 8 + (1 - ease) * 24;
        this.drawFish(this.fishG, cx, cy, def, -side, mix(def.shape.color, pal.deep, 0.35), mix(def.shape.fin, pal.deep, 0.35), 0.55 + 0.35 * ease, p.kind === 'bite' ? 1 : 0.3);
      }
    }
    this.drawFloat(fx, fy, this.dip, 1);
    // The water over the float's foot, so it sits in it rather than on it.
    g.fillStyle(pal.water, 0.85);
    g.fillRect(fx - 6, SURFACE + 1, 12, 2);
  }

  private drawFloat(x: number, y: number, dip: number, alpha: number): void {
    const g = this.world;
    const show = 1 - dip * 0.8;
    // A quill float: a red tip, a white body and a dark band.
    g.fillStyle(0xeee8dc, alpha);
    g.fillEllipse(x, y - 3 * show, 7, 10 * show);
    g.fillStyle(0x2a2420, alpha);
    g.fillRect(x - 3.5, y - 6 * show, 7, 1.5);
    g.fillStyle(0xd0404a, alpha);
    g.fillEllipse(x, y - 10 * show, 5.5, 8 * show);
    g.fillStyle(0xff8a80, alpha);
    g.fillRect(x - 1.5, y - 13 * show, 1.5, 2 * show);
    g.fillStyle(0x1a1410, alpha);
    g.fillRect(x - 0.5, y - 17 * show, 1, 4 * show);
  }

  /** The fish on the line, fighting or leaping out. */
  private drawHookedFish(): void {
    const p = this.phase;
    const pal = SKY[hourBand(this.data_.hour())];
    if (p.kind === 'fight') {
      const def = FISH[p.fish];
      const at = this.fightFishAt(p);
      const depth = Math.min(1, (at.y - SURFACE) / 60);
      this.drawFish(this.fishG, at.x, at.y, def, at.face, mix(def.shape.color, pal.deep, 0.2 + depth * 0.2), mix(def.shape.fin, pal.deep, 0.2), 0.95, 0.4 + at.thrash);
    } else if (p.kind === 'leap') {
      const def = FISH[p.fish];
      const t = Math.min(1, p.t);
      const to = { x: VIEW.x + VIEW.w / 2, y: VIEW.y + 74 };
      const x = p.from.x + (to.x - p.from.x) * t;
      const y = p.from.y + (to.y - p.from.y) * t - Math.sin(t * Math.PI) * 50;
      this.fishG.setPosition(0, 0);
      this.drawFish(this.fishG, x, y, def, 1, def.shape.color, def.shape.fin, 1, 1, t * Math.PI * 2 * 0.9 - 0.6);
    }
  }

  /** A distant fish: just a darker shape. */
  private drawShadow(g: Phaser.GameObjects.Graphics, x: number, y: number, len: number, face: number, color: number, alpha: number): void {
    g.fillStyle(color, alpha);
    g.fillEllipse(x, y, len, len * 0.36);
    g.fillTriangle(x - (face * len) / 2 + face * 2, y, x - (face * len) / 2 - face * 7, y - 4, x - (face * len) / 2 - face * 7, y + 4);
  }

  /**
   * A fish, side on, centred at (x, y) and facing right (face 1) or left (-1),
   * its tail beating with `thrash`. The boot is a boot.
   */
  private drawFish(g: Phaser.GameObjects.Graphics, x: number, y: number, def: FishDef, face: number, body: number, fin: number, alpha: number, thrash: number, angle = 0): void {
    const { len, girth } = def.shape;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const at = (u: number, v: number) => ({ x: x + (u * face) * cos - v * sin, y: y + (u * face) * sin + v * cos });
    const wag = Math.sin(this.clock * (6 + thrash * 16)) * (2 + thrash * 4);
    if (def.item === 'old-boot') {
      g.fillStyle(body, alpha);
      g.fillPoints([at(-10, -12), at(2, -12), at(3, 2), at(12, 4), at(13, 9), at(-10, 9)], true);
      g.fillStyle(fin, alpha);
      g.fillPoints([at(-11, 7), at(13, 7), at(13, 10), at(-11, 10)], true);
      g.fillStyle(0x6a5440, alpha);
      g.fillPoints([at(-10, -12), at(2, -12), at(2, -10), at(-10, -10)], true);
      return;
    }
    const half = len / 2;
    const tail = def.item === 'eel' ? 4 : girth * 0.75;
    // The tail, beating.
    g.fillStyle(fin, alpha);
    g.fillPoints([at(-half + 3, 0), at(-half - tail, -tail * 0.8 + wag), at(-half - tail * 0.6, wag * 0.6), at(-half - tail, tail * 0.8 + wag)], true);
    // Fins along the back and belly.
    g.fillPoints([at(-half * 0.2, -girth / 2 + 1), at(half * 0.05, -girth / 2 - girth * 0.45), at(half * 0.35, -girth / 2 + 1)], true);
    g.fillPoints([at(-half * 0.1, girth / 2 - 1), at(half * 0.05, girth / 2 + girth * 0.3), at(half * 0.25, girth / 2 - 1)], true);
    // The body: a fat ellipse, as a polygon so it can turn.
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const bulge = Math.cos(a) > 0 ? 1 : 0.85;
      pts.push(at(Math.cos(a) * half, Math.sin(a) * (girth / 2) * bulge));
    }
    g.fillStyle(body, alpha);
    g.fillPoints(pts, true);
    // A paler belly, and the perch's stripes or the trout's spots.
    g.fillStyle(mix(body, 0xf0ead8, 0.35), alpha * 0.8);
    g.fillPoints([at(-half * 0.7, girth * 0.12), at(half * 0.75, girth * 0.08), at(half * 0.5, girth * 0.38), at(-half * 0.5, girth * 0.36)], true);
    if (def.item === 'perch') {
      g.fillStyle(0x2a3a12, alpha * 0.7);
      for (let i = -2; i <= 2; i++) g.fillPoints([at(i * 5 - 1, -girth / 2 + 1), at(i * 5 + 1.5, -girth / 2 + 1), at(i * 5 + 0.5, girth * 0.2), at(i * 5 - 2, girth * 0.2)], true);
    } else if (def.item === 'trout') {
      for (let i = 0; i < 7; i++) {
        const s = at(-half * 0.6 + i * (len / 9), -girth * 0.12 + ((i * 3) % 5) - 2);
        g.fillStyle(i % 2 ? 0xa83a2a : 0x2a1a12, alpha);
        g.fillCircle(s.x, s.y, 1.1);
      }
    } else if (def.item === 'pike') {
      g.fillStyle(0xd8d890, alpha * 0.5);
      for (let i = 0; i < 6; i++) {
        const s = at(-half * 0.6 + i * (len / 8), -girth * 0.1 + (i % 2) * 3);
        g.fillEllipse(s.x, s.y, 3, 1.6);
      }
    }
    // Gill line and eye.
    const gill = [at(half * 0.55, -girth * 0.32), at(half * 0.5, girth * 0.3)];
    g.lineStyle(1, mix(body, 0x000000, 0.4), alpha);
    g.lineBetween(gill[0].x, gill[0].y, gill[1].x, gill[1].y);
    const eye = at(half * 0.72, -girth * 0.12);
    g.fillStyle(0xf4f0e0, alpha);
    g.fillCircle(eye.x, eye.y, Math.max(1.5, girth * 0.13));
    g.fillStyle(0x0a0806, alpha);
    g.fillCircle(eye.x + face * 0.4, eye.y, Math.max(0.8, girth * 0.07));
  }

  /** Under the view: the cast's power, or the line's tension and how far out the fish is. */
  private drawMeter(): void {
    const g = this.hud;
    g.clear();
    const p = this.phase;
    const { x, y, w, h } = METER;
    if (p.kind === 'ready') {
      g.fillStyle(0x0d0a10, 1);
      g.fillRoundedRect(x, y, w, h, 5);
      // The power that lands on the rise, marked in gold.
      const want = (this.rise - castReach(0)) / (castReach(1) - castReach(0));
      g.fillStyle(GOLD_N, 0.3);
      g.fillRect(x + (want - 0.08 / 0.74) * w, y + 1, (0.16 / 0.74) * w, h - 2);
      if (p.charging) {
        const pw = castPower(p.held);
        const on = onTheRise(castReach(pw), this.rise);
        g.fillStyle(on ? GOLD_N : 0x8ab8d8, 1);
        g.fillRoundedRect(x + 2, y + 2, Math.max(4, (w - 4) * pw), h - 4, 4);
      }
      g.lineStyle(2, UI_COLORS.trim, 1);
      g.strokeRoundedRect(x, y, w, h, 5);
      this.meterLabels('Power', '', 'Far');
      return;
    }
    if (p.kind === 'bite') {
      // The strike window, draining away.
      const left = Math.max(0, (p.until - this.clock) / FISH[p.fish].bite);
      g.fillStyle(0x0d0a10, 1);
      g.fillRoundedRect(x, y, w, h, 5);
      g.fillStyle(GOLD_N, 0.6 + 0.4 * Math.abs(Math.sin(this.clock * 18)));
      g.fillRoundedRect(x + 2 + ((w - 4) * (1 - left)) / 2, y + 2, Math.max(2, (w - 4) * left), h - 4, 4);
      g.lineStyle(2, UI_COLORS.trim, 1);
      g.strokeRoundedRect(x, y, w, h, 5);
      this.meterLabels('Strike', '', '');
      return;
    }
    if (p.kind !== 'fight') {
      this.meterLabels('', '', '');
      return;
    }
    const f = p.fight;
    // Tension: slack (grey-blue), good (green), danger (red), with a needle.
    const [lo, hi] = TENSION_SAFE;
    g.fillStyle(0x0d0a10, 1);
    g.fillRoundedRect(x, y, w, h, 5);
    g.fillStyle(0x4a5a6a, 0.6);
    g.fillRect(x + 2, y + 2, (w - 4) * lo, h - 4);
    g.fillStyle(GOOD, 0.45);
    g.fillRect(x + 2 + (w - 4) * lo, y + 2, (w - 4) * (hi - lo), h - 4);
    g.fillStyle(BAD, 0.55 + (f.tension > hi ? 0.35 * Math.abs(Math.sin(this.clock * 20)) : 0));
    g.fillRect(x + 2 + (w - 4) * hi, y + 2, (w - 4) * (1 - hi) - 2, h - 4);
    const nx = x + 2 + (w - 4) * Math.min(1, f.tension);
    g.fillStyle(0xffffff, 1);
    g.fillRect(nx - 2, y - 4, 4, h + 8);
    g.lineStyle(2, UI_COLORS.trim, 1);
    g.strokeRoundedRect(x, y, w, h, 5);
    // Line out: a track from the bank to where it bit, with the fish on it.
    const ty = y + h + 12;
    g.lineStyle(2, 0x5a4a30, 1);
    g.lineBetween(x, ty, x + w, ty);
    for (let i = 0; i <= 10; i++) g.lineBetween(x + (w * i) / 10, ty - 2, x + (w * i) / 10, ty + 2);
    g.fillStyle(GOLD_N, 1);
    g.fillCircle(x, ty, 4);
    const def = FISH[p.fish];
    const fx = x + w * f.dist;
    this.drawShadow(g, fx, ty, 16, -1, mix(def.shape.color, 0xffffff, 0.2), 1);
    this.meterLabels('Tension', 'Line', 'Snap');
  }

  private meterLabels(top: string, under: string, right: string): void {
    this.labels.top.setText(top);
    this.labels.under.setText(under);
    this.labels.right.setText(right);
  }

  private labels!: { top: Phaser.GameObjects.Text; under: Phaser.GameObjects.Text; right: Phaser.GameObjects.Text };

  private layout(): void {
    const { width, height } = this.scale;
    this.blocker.setSize(width, height);
    this.blocker.input!.hitArea.setSize(width, height);
    const scale = Math.min(1, (width - 16) / W);
    this.box.setScale(scale);
    this.box.setPosition(Math.round(width / 2), Math.round(height - MARGIN - H * scale - 60 * scale));
  }
}
