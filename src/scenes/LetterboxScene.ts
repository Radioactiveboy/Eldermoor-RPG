import Phaser from 'phaser';
import { letterboxHeight } from '../ui/CutSceneLayout';
import { UI_FONT } from '../ui/theme';

/** How long the bars take to slide in or out. */
const SLIDE_MS = 700;

/**
 * The black bars across the top and bottom of the screen during a cut-scene
 * (see ui/CutScene.ts), and the line being said or thought, written in the
 * bottom bar. It draws over the HUD, which clears away meanwhile (see UIScene).
 */
export class LetterboxScene extends Phaser.Scene {
  private top!: Phaser.GameObjects.Rectangle;
  private bottom!: Phaser.GameObjects.Rectangle;
  private line!: Phaser.GameObjects.Text;
  private ready = false;
  /** A caption asked for before the scene had started. */
  private pending?: { text: string; speaker?: string; ms: number };
  private lineTimer?: Phaser.Time.TimerEvent;
  private closing = false;

  constructor() {
    super('Letterbox');
  }

  create(): void {
    const { width, height } = this.scale;
    const bar = letterboxHeight(width, height);
    this.closing = false;
    this.top = this.add.rectangle(0, -bar, width, bar, 0x000000, 1).setOrigin(0);
    this.bottom = this.add.rectangle(0, height, width, bar, 0x000000, 1).setOrigin(0);
    this.line = this.add
      .text(width / 2, height - bar / 2, '', {
        fontFamily: UI_FONT,
        fontSize: '17px',
        color: '#e6dcc4',
        align: 'center',
        wordWrap: { width: Math.min(820, width - 48) },
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: this.top, y: 0, duration: SLIDE_MS, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: this.bottom, y: height - bar, duration: SLIDE_MS, ease: 'Sine.easeOut' });
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.layout, this);
      this.ready = false;
      this.pending = undefined;
    });
    this.ready = true;
    if (this.pending) {
      const p = this.pending;
      this.pending = undefined;
      this.caption(p.text, p.speaker, p.ms);
    }
  }

  /** Writes a line in the bottom bar for a while: a thought in italics, or a speaker's words after their name. */
  caption(text: string, speaker: string | undefined, ms: number): void {
    if (!this.ready) {
      this.pending = { text, speaker, ms };
      return;
    }
    this.lineTimer?.remove();
    this.tweens.killTweensOf(this.line);
    this.line.setText(speaker ? `${speaker}:  ${text}` : text);
    this.line.setFontStyle(speaker ? 'normal' : 'italic');
    this.line.setColor(speaker ? '#f0c987' : '#e6dcc4');
    this.tweens.add({ targets: this.line, alpha: 1, duration: 350 });
    this.lineTimer = this.time.delayedCall(ms, () => this.tweens.add({ targets: this.line, alpha: 0, duration: 450 }));
  }

  /** Slides the bars away, then stops. */
  close(onDone?: () => void): void {
    if (!this.ready) {
      this.scene.stop();
      onDone?.();
      return;
    }
    if (this.closing) return;
    this.closing = true;
    const { height } = this.scale;
    this.tweens.killTweensOf([this.top, this.bottom]);
    this.tweens.add({ targets: this.line, alpha: 0, duration: 250 });
    this.tweens.add({ targets: this.top, y: -this.top.height, duration: SLIDE_MS * 0.7, ease: 'Sine.easeIn' });
    this.tweens.add({
      targets: this.bottom,
      y: height,
      duration: SLIDE_MS * 0.7,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.scene.stop();
        onDone?.();
      },
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    const bar = letterboxHeight(width, height);
    this.tweens.killTweensOf([this.top, this.bottom]);
    this.top.setSize(width, bar).setPosition(0, this.closing ? -bar : 0);
    this.bottom.setSize(width, bar).setPosition(0, this.closing ? height : height - bar);
    this.line.setPosition(width / 2, height - bar / 2).setWordWrapWidth(Math.min(820, width - 48));
  }
}
