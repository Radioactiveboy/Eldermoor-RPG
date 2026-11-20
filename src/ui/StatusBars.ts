import Phaser from 'phaser';
import { Experience } from '../systems/Experience';
import { Needs } from '../systems/Needs';
import type { PlayerStats } from '../systems/PlayerStats';
import { drawPanel, UI_COLORS, UI_FONT } from './theme';

const BAR_W = 120;
const BAR_H = 8;
/** The experience bar (and hunger and rest, when they're on) are thinner than health and stamina. */
const XP_H = 5;
const NEED_H = 5;
const GAP = 6;
const PAD = 9;
/** Room for the little heart and boot icons to the left of the bars. */
const ICON_W = 14;

interface BarStyle {
  fill: number;
  shine: number;
  back: number;
}

const HEALTH_STYLE: BarStyle = { fill: 0xb3261e, shine: 0xe0574a, back: 0x3a0e0b };
const STAMINA_STYLE: BarStyle = { fill: 0x4f9a34, shine: 0x86c95a, back: 0x14280d };
const EXHAUSTED_STYLE: BarStyle = { fill: 0x7b6a3a, shine: 0x9c8a55, back: 0x14280d };
const XP_STYLE: BarStyle = { fill: 0xc9a14a, shine: 0xf2d27a, back: 0x2a2110 };
const HUNGER_STYLE: BarStyle = { fill: 0xc27a34, shine: 0xe6a35c, back: 0x2c1a0b };
const REST_STYLE: BarStyle = { fill: 0x5b7fc0, shine: 0x8eaee6, back: 0x111a2c };
/** Either need running low: the bar turns a warning red. */
const LOW_STYLE: BarStyle = { fill: 0x9c2f24, shine: 0xc9584a, back: 0x2a0d0a };

/**
 * Slim health and stamina bars in a small panel at the top-left of the screen,
 * with the hero's level and a thin experience bar beneath them. With hunger
 * and rest switched on (Settings), two thin bars for them sit between.
 */
export class StatusBars {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly levelText: Phaser.GameObjects.Text;
  private x = 0;
  private y = 0;
  // Displayed values ease towards the real ones so changes animate smoothly.
  private shownHealth = 1;
  private shownStamina = 1;
  private shownXp = Experience.progress.fraction;
  private shownLevel = Experience.level;

  private shownFullness = Needs.fullness / 100;
  private shownRest = Needs.rest / 100;
  /** Whether the hunger and rest bars are showing. */
  private needs = Needs.enabled;

  private barW = BAR_W;

  constructor(scene: Phaser.Scene) {
    this.frame = scene.add.graphics();
    this.bars = scene.add.graphics();
    this.levelText = scene.add
      .text(0, 0, String(this.shownLevel), { fontFamily: UI_FONT, fontSize: '11px', color: '#f2d27a', fontStyle: 'bold' })
      .setOrigin(0.5);
  }

  get height(): number {
    return PAD * 2 + BAR_H * 2 + XP_H + GAP * 2 + (this.needs ? (NEED_H + GAP) * 2 : 0);
  }

  /** Where the experience bar's row starts, under health, stamina and (when on) the needs. */
  private get xpY(): number {
    return this.y + PAD + (BAR_H + GAP) * 2 + (this.needs ? (NEED_H + GAP) * 2 : 0);
  }

  /** Shows or hides the hunger and rest bars to match Settings. Returns true if they changed, so the HUD lays out again. */
  syncNeeds(): boolean {
    if (this.needs === Needs.enabled) return false;
    this.needs = Needs.enabled;
    this.shownFullness = Needs.fullness / 100;
    this.shownRest = Needs.rest / 100;
    return true;
  }

  get width(): number {
    return this.barW + ICON_W + PAD * 2;
  }

  /** Narrow the bars on small screens. Call before setPosition. */
  setMaxWidth(maxWidth: number): void {
    this.barW = Math.max(80, Math.min(BAR_W, maxWidth - ICON_W - PAD * 2));
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.frame.clear();
    drawPanel(this.frame, x, y, this.width, this.height);
    this.drawIcons();
    this.levelText.setPosition(x + PAD + 4.5, this.xpY + XP_H / 2);
  }

  update(stats: PlayerStats, dt: number): void {
    const ease = 1 - Math.exp(-dt * 10);
    this.shownHealth = Phaser.Math.Linear(this.shownHealth, stats.health / stats.maxHealth, ease);
    this.shownStamina = Phaser.Math.Linear(this.shownStamina, stats.stamina / stats.maxStamina, ease);

    const bx = this.x + PAD + ICON_W;
    const hy = this.y + PAD;
    this.bars.clear();
    this.drawBar(bx, hy, this.shownHealth, HEALTH_STYLE);
    this.drawBar(bx, hy + BAR_H + GAP, this.shownStamina, stats.isExhausted ? EXHAUSTED_STYLE : STAMINA_STYLE);
    if (this.needs) {
      this.shownFullness = Phaser.Math.Linear(this.shownFullness, Needs.fullness / 100, ease);
      this.shownRest = Phaser.Math.Linear(this.shownRest, Needs.rest / 100, ease);
      const ny = hy + (BAR_H + GAP) * 2;
      this.drawBar(bx, ny, this.shownFullness, Needs.hungry ? LOW_STYLE : HUNGER_STYLE, NEED_H);
      this.drawBar(bx, ny + NEED_H + GAP, this.shownRest, Needs.weary ? LOW_STYLE : REST_STYLE, NEED_H);
    }

    // On a level-up the bar runs to the end first, then starts again from empty.
    const level = Experience.level;
    const xp = Experience.progress.fraction;
    if (level !== this.shownLevel) {
      this.shownXp = Phaser.Math.Linear(this.shownXp, 1, ease);
      if (this.shownXp > 0.98 || level < this.shownLevel) {
        this.shownLevel = level;
        this.shownXp = 0;
        this.levelText.setText(String(level));
      }
    } else {
      this.shownXp = Phaser.Math.Linear(this.shownXp, xp, ease);
    }
    this.drawBar(bx, this.xpY, this.shownXp, XP_STYLE, XP_H);
  }


  /** A tiny heart beside health and a lightning bolt beside stamina. */
  private drawIcons(): void {
    const g = this.frame;
    const x = this.x + PAD;
    const hy = this.y + PAD + BAR_H / 2;
    g.fillStyle(0xe0574a, 1);
    g.fillCircle(x + 2.5, hy - 1.5, 2.5);
    g.fillCircle(x + 6.5, hy - 1.5, 2.5);
    g.fillTriangle(x, hy - 0.5, x + 9, hy - 0.5, x + 4.5, hy + 4.5);
    const sy = this.y + PAD + BAR_H + GAP;
    g.fillStyle(0x9fd66a, 1);
    g.fillTriangle(x + 5, sy - 1, x + 1, sy + 5, x + 5, sy + 4);
    g.fillTriangle(x + 4, sy + 3, x + 8, sy + 3, x + 3, sy + 10);
    if (!this.needs) return;
    // A loaf beside hunger, a crescent moon beside rest.
    const fy = this.y + PAD + (BAR_H + GAP) * 2 + NEED_H / 2;
    g.fillStyle(0xe6a35c, 1);
    g.fillEllipse(x + 4.5, fy, 9, 6);
    g.fillStyle(0x8a5424, 1);
    g.fillRect(x + 2.5, fy - 1.5, 1, 2);
    g.fillRect(x + 5.5, fy - 1.5, 1, 2);
    const my = fy + NEED_H + GAP;
    g.fillStyle(0xbcd0f2, 1);
    g.fillCircle(x + 4.5, my, 3.5);
    g.fillStyle(UI_COLORS.panel, 1);
    g.fillCircle(x + 6.3, my - 1.2, 2.9);
  }

  private drawBar(x: number, y: number, fraction: number, style: BarStyle, h = BAR_H): void {
    const g = this.bars;
    const r = Math.min(3, h / 2);
    g.fillStyle(style.back, 1);
    g.fillRoundedRect(x, y, this.barW, h, r);
    const w = Math.max(0, Math.min(1, fraction)) * this.barW;
    if (w > 2) {
      g.fillStyle(style.fill, 1);
      g.fillRoundedRect(x, y, w, h, r);
      g.fillStyle(style.shine, 1);
      g.fillRect(x + 2, y + 1, w - 4, h > 6 ? 2 : 1);
    }
    g.lineStyle(1, 0x000000, 0.8);
    g.strokeRoundedRect(x, y, this.barW, h, r);
  }
}
