import Phaser from 'phaser';
import type { TimeOfDay } from '../systems/TimeOfDay';
import { UI_COLORS, UI_FONT } from './theme';

const R = 64;

/**
 * Rotating time-of-day dial. The wheel is a disc whose top half is daytime sky
 * with the sun and whose bottom half is night sky with the moon. Only the upper
 * half of the disc shows through a semicircular window, and the disc turns once
 * per in-game day:
 *
 *   06:00  sun rising on the left, night sky still on the right
 *   12:00  sun at the top, the window is all daytime sky
 *   18:00  sun setting on the right, night sky coming in from the left
 *   00:00  moon at the top, the window is all night sky
 */
export class TimeWheel {
  private readonly disc: Phaser.GameObjects.Container;
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;

  readonly width = R * 2 + 12;
  readonly height = R + 40;

  constructor(scene: Phaser.Scene) {
    this.disc = scene.add.container(0, 0, [this.drawDisc(scene)]);
    this.maskShape = scene.make.graphics({}, false);
    this.disc.setMask(this.maskShape.createGeometryMask());
    this.frame = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, '', { fontFamily: UI_FONT, fontSize: '14px', color: UI_COLORS.text })
      .setOrigin(0.5, 0.5);
  }

  setVisible(visible: boolean): void {
    [this.disc, this.frame, this.label].forEach((o) => o.setVisible(visible));
  }

  /** Place the dial with its top-left corner at (x, y). */
  setPosition(x: number, y: number): void {
    const cx = x + this.width / 2;
    const cy = y + R + 6;
    this.disc.setPosition(cx, cy);

    // The window: only the top half of the disc is visible.
    this.maskShape.clear();
    this.maskShape.fillStyle(0xffffff, 1);
    this.maskShape.slice(cx, cy, R, Math.PI, Math.PI * 2, false);
    this.maskShape.fillPath();

    const f = this.frame.clear();
    // Hills along the horizon, so the sun and moon rise and set behind them.
    f.fillStyle(0x1f3320, 1);
    f.beginPath();
    f.moveTo(cx - R, cy);
    const hills = [0.1, 0.17, 0.08, 0.14, 0.2, 0.09, 0.15, 0.06, 0.12, 0.1];
    hills.forEach((h, i) => {
      const t = i / (hills.length - 1);
      const hx = cx - R + t * R * 2;
      // Keep the hills inside the round window near its edges.
      const edge = Math.sqrt(Math.max(0, R * R - (hx - cx) ** 2));
      f.lineTo(hx, cy - Math.min(h * R, edge));
    });
    f.lineTo(cx + R, cy);
    f.closePath();
    f.fillPath();
    // Gold rim and baseline.
    f.lineStyle(4, UI_COLORS.trim, 1);
    f.beginPath();
    f.arc(cx, cy, R + 1, Math.PI, Math.PI * 2, false);
    f.strokePath();
    f.lineStyle(1, UI_COLORS.trimDark, 1);
    f.beginPath();
    f.arc(cx, cy, R - 3, Math.PI, Math.PI * 2, false);
    f.strokePath();
    // Plaque under the dial for the clock text.
    f.fillStyle(UI_COLORS.panel, UI_COLORS.panelAlpha);
    f.fillRoundedRect(cx - R - 6, cy - 2, R * 2 + 12, 30, 6);
    f.lineStyle(2, UI_COLORS.trim, 1);
    f.strokeRoundedRect(cx - R - 6, cy - 2, R * 2 + 12, 30, 6);
    // "Now" marker at the top of the window.
    f.fillStyle(UI_COLORS.trim, 1);
    f.fillTriangle(cx - 6, cy - R - 8, cx + 6, cy - R - 8, cx, cy - R + 2);

    this.label.setPosition(cx, cy + 13);
  }

  update(clock: TimeOfDay): void {
    // Noon puts the sun at the top; each hour turns the disc 15 degrees clockwise.
    this.disc.setRotation(((clock.hour - 12) / 24) * Math.PI * 2);
    this.label.setText(`Day ${clock.day}  ·  ${clock.clockText}`);
  }

  /** Disc drawn around (0, 0): day sky and sun on top, night sky and moon underneath. */
  private drawDisc(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    const half = (top: boolean, radius: number, color: number) => {
      g.fillStyle(color, 1);
      g.slice(0, 0, radius, top ? Math.PI : 0, top ? Math.PI * 2 : Math.PI, false);
      g.fillPath();
    };

    // Day sky: deeper blue at the rim, paler towards the horizon.
    half(true, R, 0x4f9fdb);
    half(true, R * 0.75, 0x6fb7e6);
    half(true, R * 0.45, 0x9fd2f0);
    // Night sky.
    half(false, R, 0x121a3d);
    half(false, R * 0.75, 0x1b2550);
    half(false, R * 0.45, 0x26316a);

    // Stars, scattered with a fixed seed so they never jump around.
    const rnd = new Phaser.Math.RandomDataGenerator(['stars']);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 26; i++) {
      const a = rnd.realInRange(0.15, Math.PI - 0.15);
      const d = rnd.realInRange(R * 0.25, R * 0.92);
      g.fillCircle(Math.cos(a) * d, Math.sin(a) * d, rnd.pick([0.6, 0.9, 1.2]));
    }

    // Sun, top centre of the disc.
    const sy = -R * 0.56;
    const sr = R * 0.22;
    g.fillStyle(0xfff3b0, 0.35);
    g.fillCircle(0, sy, sr * 1.7);
    g.lineStyle(2, 0xffd34d, 1);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.lineBetween(Math.cos(a) * sr * 1.2, sy + Math.sin(a) * sr * 1.2, Math.cos(a) * sr * 1.55, sy + Math.sin(a) * sr * 1.55);
    }
    g.fillStyle(0xffc93a, 1);
    g.fillCircle(0, sy, sr);
    g.fillStyle(0xffe680, 1);
    g.fillCircle(-sr * 0.25, sy - sr * 0.25, sr * 0.55);

    // Full moon, bottom centre of the disc (upside down until the disc turns it to the top).
    const my = R * 0.56;
    const mr = R * 0.2;
    g.fillStyle(0xdfe6ff, 0.18);
    g.fillCircle(0, my, mr * 1.7);
    g.fillStyle(0xe8ecf7, 1);
    g.fillCircle(0, my, mr);
    g.fillStyle(0xc4cbe0, 1);
    g.fillCircle(mr * 0.3, my - mr * 0.25, mr * 0.25);
    g.fillCircle(-mr * 0.35, my + mr * 0.2, mr * 0.18);
    g.fillCircle(mr * 0.1, my + mr * 0.5, mr * 0.12);

    return g;
  }
}
