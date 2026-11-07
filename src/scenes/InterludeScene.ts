import Phaser from 'phaser';
import { UI_FONT } from '../ui/theme';

export interface InterludeSceneData {
  /** Shown one after another in the dark, each fading in under the last. */
  lines: string[];
  /** Called once the last line has faded out. */
  onDone: () => void;
}

/** Seconds each line takes to come up, and how long the screen holds once they're all up. */
const LINE_MS = 1700;
const HOLD_MS = 1800;

/**
 * A moment in the dark between scenes (the hero beaten senseless in the
 * goblin raid): a black screen and a few half-remembered lines, one at a time.
 * Any key or a tap hurries it on.
 */
export class InterludeScene extends Phaser.Scene {
  constructor() {
    super('Interlude');
  }

  create(data: InterludeSceneData): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x000000, 1).setOrigin(0).setInteractive();
    const gap = 30;
    const top = height / 2 - ((data.lines.length - 1) * gap) / 2;
    const texts = data.lines.map((line, i) =>
      this.add
        .text(width / 2, top + i * gap, line, { fontFamily: UI_FONT, fontSize: '17px', color: '#d8cdb4', fontStyle: 'italic', align: 'center', wordWrap: { width: width - 48 } })
        .setOrigin(0.5)
        .setAlpha(0),
    );
    texts.forEach((t, i) => this.tweens.add({ targets: t, alpha: i === texts.length - 1 ? 0.6 : 0.9, delay: 600 + i * LINE_MS, duration: 900 }));
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.tweens.add({
        targets: texts,
        alpha: 0,
        duration: 700,
        onComplete: () => {
          this.scene.stop();
          data.onDone();
        },
      });
    };
    this.time.delayedCall(600 + texts.length * LINE_MS + HOLD_MS, finish);
    // Hurry it on, though not straight away (so the key press that ended the fight doesn't skip it).
    this.time.delayedCall(1500, () => {
      this.input.keyboard?.on('keydown', finish);
      this.input.on('pointerup', finish);
    });
  }
}
