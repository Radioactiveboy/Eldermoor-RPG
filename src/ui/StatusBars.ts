import Phaser from 'phaser';
import type { PlayerStats } from '../systems/PlayerStats';
import { drawPanel } from './theme';

const BAR_W = 120;
const BAR_H = 8;
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

/** Slim health and stamina bars in a small panel at the top-left of the screen. */
export class StatusBars {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly bars: Phaser.GameObjects.Graphics;
  private x = 0;
  private y = 0;
  // Displayed values ease towards the real ones so changes animate smoothly.
  private shownHealth = 1;
  private shownStamina = 1;

  private barW = BAR_W;
  readonly height = PAD * 2 + BAR_H * 2 + GAP;

  constructor(scene: Phaser.Scene) {
    this.frame = scene.add.graphics();
    this.bars = scene.add.graphics();
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
  }

  private drawBar(x: number, y: number, fraction: number, style: BarStyle): void {
    const g = this.bars;
    g.fillStyle(style.back, 1);
    g.fillRoundedRect(x, y, this.barW, BAR_H, 3);
    const w = Math.max(0, Math.min(1, fraction)) * this.barW;
    if (w > 2) {
      g.fillStyle(style.fill, 1);
      g.fillRoundedRect(x, y, w, BAR_H, 3);
      g.fillStyle(style.shine, 1);
      g.fillRect(x + 2, y + 1, w - 4, 2);
    }
    g.lineStyle(1, 0x000000, 0.8);
    g.strokeRoundedRect(x, y, this.barW, BAR_H, 3);
  }
}
