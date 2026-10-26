import Phaser from 'phaser';
import type { TimeOfDay } from '../systems/TimeOfDay';
import { bodyStyle, makeButton, makePanel, THEME, titleStyle } from '../ui/Widgets';

export interface SleepSceneData {
  clock: TimeOfDay;
}

/** The times the player can sleep until. */
const WAKE_TIMES: Array<{ label: string; hour: number }> = [
  { label: 'Until morning', hour: 7 },
  { label: 'Until midday', hour: 12 },
  { label: 'Until evening', hour: 18 },
  { label: 'Until night', hour: 22 },
];

const PANEL_W = 420;
const ROW = 64;
const PANEL_H = 250 + WAKE_TIMES.length * ROW;

/**
 * "How long do you want to sleep?" Lying down in a bed opens this. Emits
 * `sleep-closed` with the hours to sleep, or nothing if the player changed
 * their mind. Number keys 1-4 pick a time; Esc cancels.
 */
export class SleepScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private ui!: Phaser.GameObjects.Container;
  private done = false;

  constructor() {
    super('Sleep');
  }

  create(data: SleepSceneData): void {
    this.done = false;
    const clock = data.clock;
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.5).setOrigin(0).setInteractive();

    const top = -PANEL_H / 2;
    const panel = makePanel(this, PANEL_W, PANEL_H);
    const title = this.add.text(0, top + 48, 'Sleep', titleStyle(38)).setOrigin(0.5);
    const note = this.add
      .text(0, top + 92, `It is ${clock.clockText}. Sleeping will save your game.`, bodyStyle(15, THEME.dimText))
      .setOrigin(0.5);

    const options = WAKE_TIMES.map((t, i) => {
      const hours = clock.hoursUntil(t.hour);
      const length = hours < 1 ? `${Math.round(hours * 60)} min` : `${Math.round(hours)} hr${Math.round(hours) === 1 ? '' : 's'}`;
      return makeButton(this, 0, top + 150 + i * ROW, `${t.label}  ·  ${length}`, () => this.close(hours), 340);
    });
    const cancel = makeButton(this, 0, top + 150 + WAKE_TIMES.length * ROW + 16, 'Not yet', () => this.close(), 200);

    this.ui = this.add.container(0, 0, [panel, title, note, ...options, cancel]);

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.close());
    WAKE_TIMES.forEach((t, i) => kb.on(`keydown-${['ONE', 'TWO', 'THREE', 'FOUR'][i]}`, () => this.close(clock.hoursUntil(t.hour))));

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.ui.setAlpha(0);
    this.tweens.add({ targets: this.ui, alpha: 1, duration: 150 });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.ui.setPosition(width / 2, height / 2);
    this.ui.setScale(Math.min(1, (width - 24) / PANEL_W, (height - 24) / PANEL_H));
  }

  private close(hours?: number): void {
    if (this.done) return;
    this.done = true;
    this.events.emit('sleep-closed', hours);
    this.scene.stop();
  }
}
