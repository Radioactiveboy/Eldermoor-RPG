import Phaser from 'phaser';
import { UI_FONT } from './theme';

/** Anyone who can say something out loud (see Npc.say). */
export interface Speaker {
  speech?: string;
  /** World position just above their head, for the talk prompt. */
  promptPoint: { x: number; y: number };
  /** Where a speech bubble's tail points: the top of their head (the prompt sits higher). */
  speechPoint?: { x: number; y: number };
}

const MAX_WIDTH = 190;
const PAD = 6;
const TAIL = 6;

/**
 * Small speech bubbles over the heads of people in the world who are saying
 * something out loud, like a militiaman calling that the market is shut.
 * Drawn on the HUD so the night doesn't darken them, but beneath its panels.
 */
export class SpeechBubbles {
  private readonly scene: Phaser.Scene;
  private readonly bubbles = new Map<Speaker, { text: string; box: Phaser.GameObjects.Container }>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Show a bubble for everyone speaking, over their heads; clear the ones who have finished. */
  update(speakers: Speaker[], toScreen: (x: number, y: number) => { x: number; y: number }, visible: boolean): void {
    for (const [who, b] of this.bubbles) {
      if (!speakers.includes(who) || who.speech !== b.text) {
        b.box.destroy();
        this.bubbles.delete(who);
      }
    }
    for (const who of speakers) {
      if (!who.speech) continue;
      let b = this.bubbles.get(who);
      if (!b) {
        b = { text: who.speech, box: this.make(who.speech) };
        this.bubbles.set(who, b);
      }
      const at = who.speechPoint ?? who.promptPoint;
      const p = toScreen(at.x, at.y);
      // Kept on screen, even if that leaves the tail a little to one side of the speaker.
      const half = b.box.width / 2 + 4;
      const x = Phaser.Math.Clamp(p.x, half, Math.max(half, this.scene.scale.width - half));
      const y = Math.max(b.box.height + TAIL + 4, p.y);
      b.box.setPosition(Math.round(x), Math.round(y)).setVisible(visible);
    }
  }

  destroy(): void {
    for (const b of this.bubbles.values()) b.box.destroy();
    this.bubbles.clear();
  }

  /** A cream bubble with a little tail pointing down at the speaker; its origin is the tail's tip. */
  private make(text: string): Phaser.GameObjects.Container {
    const label = this.scene.add
      .text(0, 0, text, { fontFamily: UI_FONT, fontSize: '12px', color: '#2a2018', align: 'center', wordWrap: { width: MAX_WIDTH } })
      .setOrigin(0.5, 1);
    const w = label.width + PAD * 2;
    const h = label.height + PAD * 2;
    label.setPosition(0, -TAIL - PAD);
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2 + 1, -TAIL - h + 2, w, h, 6);
    g.fillStyle(0xf6eedb, 1);
    g.lineStyle(1, 0x6b5a44, 1);
    g.fillRoundedRect(-w / 2, -TAIL - h, w, h, 6);
    g.strokeRoundedRect(-w / 2, -TAIL - h, w, h, 6);
    g.fillTriangle(-5, -TAIL - 1, 5, -TAIL - 1, 0, 0);
    g.lineBetween(-5, -TAIL, 0, 0);
    g.lineBetween(5, -TAIL, 0, 0);
    const box = this.scene.add.container(0, 0, [g, label]).setSize(w, h).setDepth(-0.5).setAlpha(0);
    this.scene.tweens.add({ targets: box, alpha: 1, duration: 180 });
    return box;
  }
}
