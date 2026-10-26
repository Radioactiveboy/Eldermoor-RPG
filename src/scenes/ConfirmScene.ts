import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { bodyStyle, makeButton, makePanel } from '../ui/Widgets';

export interface ConfirmSceneData {
  question: string;
  yes?: string;
  no?: string;
  /** Called once with the answer, as the box closes. */
  onAnswer: (yes: boolean) => void;
}

const W = 480;
const H = 210;
const BUTTON_W = 190;

/**
 * A yes-or-no question in a framed box over the game, such as "Do you want to
 * make the trek to Adowvale Market?" before leaving an area.
 *
 * Y, Enter or E says yes; N or Esc says no; or click/tap a button.
 */
export class ConfirmScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private box!: Phaser.GameObjects.Container;
  private answered = false;
  private readyAt = 0;

  constructor() {
    super('Confirm');
  }

  create(data: ConfirmSceneData): void {
    this.answered = false;
    // Ignore the key press that opened the box.
    this.readyAt = this.time.now + 150;
    const answer = (yes: boolean) => {
      if (this.answered || this.time.now < this.readyAt) return;
      this.answered = true;
      GameAudio.click();
      this.tweens.add({ targets: [this.box, this.dim], alpha: 0, duration: 140, onComplete: () => {
        this.scene.stop();
        data.onAnswer(yes);
      } });
    };

    // Clicks on the world behind are swallowed rather than walking the player about.
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.35).setOrigin(0).setInteractive();
    const panel = makePanel(this, W, H);
    const text = this.add
      .text(0, -42, data.question, { ...bodyStyle(21), align: 'center', wordWrap: { width: W - 60 }, lineSpacing: 4 })
      .setOrigin(0.5);
    const yes = makeButton(this, -BUTTON_W / 2 - 10, 52, data.yes ?? 'Yes', () => answer(true), BUTTON_W);
    const no = makeButton(this, BUTTON_W / 2 + 10, 52, data.no ?? 'No', () => answer(false), BUTTON_W);
    this.box = this.add.container(0, 0, [panel, text, yes, no]);

    const kb = this.input.keyboard!;
    for (const key of ['Y', 'ENTER', 'E']) kb.on(`keydown-${key}`, () => answer(true));
    for (const key of ['N', 'ESC']) kb.on(`keydown-${key}`, () => answer(false));

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));

    this.box.setAlpha(0).y += 20;
    this.tweens.add({ targets: this.box, alpha: 1, y: '-=20', duration: 200, ease: 'Cubic.easeOut' });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.box.setPosition(width / 2, height / 2);
    this.box.setScale(Math.min(1, (width - 24) / W, (height - 24) / H));
  }
}
