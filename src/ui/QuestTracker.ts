import Phaser from 'phaser';
import { QuestLog } from '../systems/Quests';
import { drawPanel, UI_COLORS, UI_FONT } from './theme';

const PAD = 12;

/**
 * A small reminder under the health bars: the current quest and the step to
 * do next, so the player always knows what they're meant to be doing.
 * Before any quest has begun it nudges them towards Mother instead.
 */
export class QuestTracker {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly step: Phaser.GameObjects.Text;
  private readonly scene: Phaser.Scene;
  private x = 0;
  private y = 0;
  private maxWidth = 300;
  private shownText = '';

  constructor(scene: Phaser.Scene, onClick: () => void) {
    this.scene = scene;
    this.frame = scene.add.graphics();
    this.title = scene.add.text(0, 0, '', {
      fontFamily: UI_FONT,
      fontSize: '14px',
      color: '#e8c977',
      fontStyle: 'bold',
    });
    this.step = scene.add.text(0, 0, '', { fontFamily: UI_FONT, fontSize: '13px', color: UI_COLORS.text, lineSpacing: 2 });
    // Tapping the tracker opens the journal too.
    this.title.setInteractive({ useHandCursor: true }).on('pointerup', onClick);
    this.step.setInteractive({ useHandCursor: true }).on('pointerup', onClick);
  }

  get height(): number {
    return this.step.y + this.step.height + PAD - this.y;
  }

  setMaxWidth(w: number): void {
    this.maxWidth = Math.min(300, w);
    this.step.setWordWrapWidth(this.maxWidth - PAD * 2 - 14);
    this.shownText = '';
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.shownText = '';
  }

  update(): void {
    const quest = QuestLog.active[0];
    const title = quest ? quest.def.title : 'At home';
    const step = quest ? (QuestLog.current(quest)?.text ?? 'Return to whoever gave you this quest') : 'Speak with Mother';
    const text = `${title}|${step}`;
    if (text === this.shownText) return;
    const changed = this.shownText !== '';
    this.shownText = text;

    this.title.setText(title).setPosition(this.x + PAD, this.y + PAD - 2);
    this.step.setText(`◆ ${step}`).setPosition(this.x + PAD, this.y + PAD + 18);
    this.frame.clear();
    drawPanel(this.frame, this.x, this.y, this.maxWidth, this.height);
    if (changed) this.pulse();
  }

  /** Flash briefly so a new objective catches the eye. */
  private pulse(): void {
    const targets = [this.title, this.step, this.frame];
    this.scene.tweens.add({ targets, alpha: { from: 0.2, to: 1 }, duration: 260, repeat: 2 });
  }
}
