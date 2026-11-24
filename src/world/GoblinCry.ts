import type { Creature } from '../entities/Creature';
import type { Speaker } from '../ui/SpeechBubbles';

/** A goblin's voice: a bubble over its head when it shrieks something. */
export class GoblinCry implements Speaker {
  speech?: string;
  private left = 0;
  constructor(readonly creature: Creature) {}

  get promptPoint(): { x: number; y: number } {
    const s = this.creature.sprite;
    return { x: s.x, y: s.y - s.displayHeight * s.originY + 4 };
  }

  get speechPoint(): { x: number; y: number } {
    return this.promptPoint;
  }

  say(text: string, seconds = 2.6): void {
    this.speech = text;
    this.left = seconds;
  }

  update(dt: number): void {
    if (!this.speech) return;
    this.left -= dt;
    if (this.left <= 0) this.speech = undefined;
  }
}
