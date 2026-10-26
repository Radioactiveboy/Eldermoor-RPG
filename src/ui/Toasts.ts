import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { THEME } from './Widgets';
import { UI_FONT } from './theme';

interface Toast {
  /** Quest news and level-ups are announced with a heading and a sound; thoughts are quiet italics. */
  kind: 'quest' | 'level' | 'thought' | 'sign';
  heading?: string;
  text: string;
}

/**
 * Banners that slide in near the top of the screen one at a time: "New quest"
 * announcements with a chime, "Level up!" with a fanfare, the hero's passing
 * thoughts (hints), and what a signpost says.
 */
export class Toasts {
  private readonly scene: Phaser.Scene;
  private readonly queue: Toast[] = [];
  private current?: Phaser.GameObjects.Container;
  private x = 0;
  private y = 0;
  private maxWidth = 520;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  setPosition(x: number, y: number, maxWidth: number): void {
    this.x = x;
    this.y = y;
    this.maxWidth = Math.min(520, maxWidth);
    this.current?.setPosition(x, y);
  }

  quest(heading: string, text: string): void {
    this.push({ kind: 'quest', heading, text });
  }

  levelUp(heading: string, text: string): void {
    this.push({ kind: 'level', heading, text });
  }

  thought(text: string): void {
    // Don't repeat a hint that's already showing or waiting.
    if (this.queue.some((t) => t.text === text) || this.current?.name === text) return;
    this.push({ kind: 'thought', text });
  }

  /** A signpost read: one line per arm, e.g. "← West: Adowvale Market". */
  sign(heading: string, lines: string[]): void {
    const text = lines.join('\n');
    if (this.queue.some((t) => t.text === text) || this.current?.name === text) return;
    this.push({ kind: 'sign', heading, text });
  }

  private push(t: Toast): void {
    this.queue.push(t);
    if (!this.current) this.next();
  }

  private next(): void {
    const t = this.queue.shift();
    if (!t) {
      this.current = undefined;
      return;
    }
    const s = this.scene;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const announce = t.kind === 'quest' || t.kind === 'level';
    const body = s.add
      .text(0, 0, t.text, {
        fontFamily: t.kind === 'thought' ? UI_FONT : THEME.font,
        fontSize: announce ? '22px' : t.kind === 'sign' ? '17px' : '16px',
        color: announce ? THEME.text : '#f3e9d2',
        fontStyle: t.kind === 'thought' ? 'italic' : 'normal',
        align: t.kind === 'sign' ? 'left' : 'center',
        lineSpacing: t.kind === 'sign' ? 6 : 0,
        wordWrap: { width: this.maxWidth - 40 },
      })
      .setOrigin(0.5, 0);
    let top = 12;
    if (t.heading) {
      const head = s.add
        .text(0, 10, t.heading.toUpperCase(), { fontFamily: THEME.font, fontSize: '13px', color: THEME.goldText, fontStyle: 'bold' })
        .setOrigin(0.5, 0);
      head.setLetterSpacing(3);
      parts.push(head);
      top = 30;
    }
    body.setY(top);
    const w = Math.min(this.maxWidth, Math.max(body.width, 200) + 48);
    const h = top + body.height + 12;
    const bg = s.add.graphics();
    bg.fillStyle(0x000000, 0.35);
    bg.fillRoundedRect(-w / 2 + 3, 4, w, h, 10);
    bg.fillStyle(THEME.panel, 0.92);
    bg.fillRoundedRect(-w / 2, 0, w, h, 10);
    bg.lineStyle(announce ? 2 : 1, THEME.gold, announce ? 1 : 0.6);
    bg.strokeRoundedRect(-w / 2, 0, w, h, 10);
    const box = s.add.container(this.x, this.y, [bg, ...parts, body]).setName(t.text).setDepth(10);
    this.current = box;

    if (t.kind === 'quest') GameAudio.questChime();
    else if (t.kind === 'level') GameAudio.levelUp();
    const hold = announce ? 3200 : t.kind === 'sign' ? 4500 : 2200 + t.text.length * 30;
    box.setAlpha(0).setScale(0.9);
    s.tweens.add({ targets: box, alpha: 1, scale: 1, duration: 250, ease: 'Back.easeOut' });
    s.tweens.add({
      targets: box,
      alpha: 0,
      delay: hold,
      duration: 400,
      onComplete: () => {
        box.destroy();
        this.next();
      },
    });
  }
}
