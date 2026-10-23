import Phaser from 'phaser';
import type { PlayerStats } from '../systems/PlayerStats';
import { drawPanel, UI_FONT } from './theme';

const BAR_W = 200;
const BAR_H = 16;
const PAD = 14;

interface BarStyle {
  label: string;
  fill: number;
  shine: number;
  back: number;
}

const HEALTH_STYLE: BarStyle = { label: 'Health', fill: 0xb3261e, shine: 0xe0574a, back: 0x3a0e0b };
const STAMINA_STYLE: BarStyle = { label: 'Stamina', fill: 0x4f9a34, shine: 0x86c95a, back: 0x14280d };
const EXHAUSTED_STYLE: BarStyle = { label: 'Stamina', fill: 0x7b6a3a, shine: 0x9c8a55, back: 0x14280d };

/** Health and stamina bars in a panel at the top-left of the screen. */
export class StatusBars {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly healthText: Phaser.GameObjects.Text;
  private readonly staminaText: Phaser.GameObjects.Text;
  private x = 0;
  private y = 0;
  // Displayed values ease towards the real ones so changes animate smoothly.
  private shownHealth = 1;
  private shownStamina = 1;

  private barW = BAR_W;
  readonly height = PAD * 2 + BAR_H * 2 + 10;

  constructor(scene: Phaser.Scene) {
    this.frame = scene.add.graphics();
    this.bars = scene.add.graphics();
    const style = { fontFamily: UI_FONT, fontSize: '12px', color: '#fff6e0', stroke: '#000000', strokeThickness: 3 };
    this.healthText = scene.add.text(0, 0, '', style).setOrigin(0.5);
    this.staminaText = scene.add.text(0, 0, '', style).setOrigin(0.5);
  }

  get width(): number {
    return this.barW + PAD * 2;
  }

  /** Narrow the bars on small screens. Call before setPosition. */
  setMaxWidth(maxWidth: number): void {
    this.barW = Math.max(120, Math.min(BAR_W, maxWidth - PAD * 2));
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.frame.clear();
    drawPanel(this.frame, x, y, this.width, this.height);
  }

  update(stats: PlayerStats, dt: number): void {
    const ease = 1 - Math.exp(-dt * 10);
    this.shownHealth = Phaser.Math.Linear(this.shownHealth, stats.health / stats.maxHealth, ease);
    this.shownStamina = Phaser.Math.Linear(this.shownStamina, stats.stamina / stats.maxStamina, ease);

    const bx = this.x + PAD;
    const hy = this.y + PAD;
    const sy = hy + BAR_H + 10;
    this.bars.clear();
    this.drawBar(bx, hy, this.shownHealth, HEALTH_STYLE);
    this.drawBar(bx, sy, this.shownStamina, stats.isExhausted ? EXHAUSTED_STYLE : STAMINA_STYLE);

    this.healthText
      .setText(`Health  ${Math.ceil(stats.health)} / ${stats.maxHealth}`)
      .setPosition(bx + this.barW / 2, hy + BAR_H / 2);
    this.staminaText
      .setText(`Stamina  ${Math.ceil(stats.stamina)} / ${stats.maxStamina}`)
      .setPosition(bx + this.barW / 2, sy + BAR_H / 2);
  }

  private drawBar(x: number, y: number, fraction: number, style: BarStyle): void {
    const g = this.bars;
    g.fillStyle(style.back, 1);
    g.fillRoundedRect(x, y, this.barW, BAR_H, 4);
    const w = Math.max(0, Math.min(1, fraction)) * this.barW;
    if (w > 2) {
      g.fillStyle(style.fill, 1);
      g.fillRoundedRect(x, y, w, BAR_H, 4);
      g.fillStyle(style.shine, 1);
      g.fillRect(x + 3, y + 2, w - 6, 4);
    }
    g.lineStyle(1, 0x000000, 0.8);
    g.strokeRoundedRect(x, y, this.barW, BAR_H, 4);
  }
}
