import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { drawPanel, UI_COLORS, UI_FONT } from '../ui/theme';

export interface ConfirmSceneData {
  question: string;
  yes?: string;
  no?: string;
  /** Called once with the answer, as the box closes. */
  onAnswer: (yes: boolean) => void;
}

const W = 340;
const PAD = 12;
const ROW = 22;
/** Room left at the bottom of the screen under the box. */
const MARGIN = 16;

const TEXT = '#f3e9d2';
const HOVER = '#ffffff';
const NUMBER = '#c9a14a';

/**
 * A yes-or-no question in a small box at the bottom of the screen, in the
 * manner of Old School RuneScape's "Select an Option": the question, then the
 * answers as a short numbered list, such as "Do you want to make the trek to
 * Adowvale Market?" before leaving an area.
 *
 * 1, Y, Enter or E says yes; 2, N or Esc says no; or click/tap an answer.
 */
export class ConfirmScene extends Phaser.Scene {
  private blocker!: Phaser.GameObjects.Zone;
  private box!: Phaser.GameObjects.Container;
  private boxH = 0;
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
      this.tweens.add({ targets: this.box, alpha: 0, duration: 120, onComplete: () => {
        this.scene.stop();
        data.onAnswer(yes);
      } });
    };

    // Clicks on the world behind are swallowed rather than walking the player about; the world isn't dimmed.
    this.blocker = this.add.zone(0, 0, 10, 10).setOrigin(0).setInteractive();

    const question = this.add
      .text(0, PAD, data.question, {
        fontFamily: UI_FONT,
        fontSize: '13px',
        color: '#e8c977',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: W - PAD * 2 },
      })
      .setOrigin(0.5, 0);
    let y = PAD + question.height + 8;
    const options = [
      this.makeOption(1, data.yes ?? 'Yes', y, () => answer(true)),
      this.makeOption(2, data.no ?? 'No', y + ROW, () => answer(false)),
    ];
    y += ROW * 2 + PAD - 6;
    this.boxH = y;

    const frame = this.add.graphics();
    // Solid underneath, so the minimap doesn't show through where they overlap on a phone.
    frame.fillStyle(UI_COLORS.panel, 1);
    frame.fillRoundedRect(-W / 2, 0, W, this.boxH, 8);
    drawPanel(frame, -W / 2, 0, W, this.boxH);
    this.box = this.add.container(0, 0, [frame, question, ...options]);

    const kb = this.input.keyboard!;
    for (const key of ['ONE', 'NUMPAD_ONE', 'Y', 'ENTER', 'E']) kb.on(`keydown-${key}`, () => answer(true));
    for (const key of ['TWO', 'NUMPAD_TWO', 'N', 'ESC']) kb.on(`keydown-${key}`, () => answer(false));

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));

    this.box.setAlpha(0).y += 8;
    this.tweens.add({ targets: this.box, alpha: 1, y: '-=8', duration: 140, ease: 'Cubic.easeOut' });
  }

  /** "1. Set off": turns white under the pointer, like the options in RuneScape's chat box. */
  private makeOption(n: number, label: string, y: number, onPick: () => void): Phaser.GameObjects.Container {
    const num = this.add.text(0, 0, `${n}.`, { fontFamily: UI_FONT, fontSize: '14px', color: NUMBER }).setOrigin(0, 0.5);
    const text = this.add.text(num.width + 5, 0, label, { fontFamily: UI_FONT, fontSize: '14px', color: TEXT }).setOrigin(0, 0.5);
    const w = num.width + 5 + text.width;
    num.x = -w / 2;
    text.x = -w / 2 + num.width + 5;
    const option = this.add.container(0, y + ROW / 2, [num, text]);
    // The whole row is clickable, not just the words, so it's easy to hit on a phone.
    option.setSize(W - PAD * 2, ROW).setInteractive({ useHandCursor: true });
    option.on('pointerover', () => {
      text.setColor(HOVER);
      GameAudio.hover();
    });
    option.on('pointerout', () => text.setColor(TEXT));
    option.on('pointerup', onPick);
    return option;
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.blocker.setSize(width, height);
    this.blocker.input!.hitArea.setSize(width, height);
    const scale = Math.min(1, (width - 24) / W);
    this.box.setScale(scale);
    this.box.setPosition(Math.round(width / 2), Math.round(height - MARGIN - this.boxH * scale));
  }
}
