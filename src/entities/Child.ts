import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { DrawnDir, FEET_Y, FRAME_H } from '../art/character';
import type { ChildLine } from '../dialogue/iran';
import { depthAt, gridToScreen, Vec2 } from '../iso/IsoMath';
import type { Speaker } from '../ui/SpeechBubbles';
import type { IsoMap } from '../world/IsoMap';

/** The children's voices, for the blips as a bubble pops up. */
const VOICES: Record<string, number> = { pip: 430, hetty: 540 };
/** They say hello when the player comes this close (in tiles). */
const GREET_RANGE = 1.9;
/** A pause between one line and the reply. */
const LINE_GAP = 0.35;

/**
 * A child who stays in one spot, chattering in little speech bubbles over
 * their head instead of holding a conversation. They turn to whoever they're
 * talking to and bob on their toes as they speak.
 */
export class Child implements Speaker {
  readonly id: string;
  readonly gx: number;
  readonly gy: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;
  private facing = 0;
  /** What they're saying, and for how much longer. */
  private line?: { text: string; left: number };

  constructor(scene: Phaser.Scene, map: IsoMap, id: string, gx: number, gy: number) {
    this.scene = scene;
    this.id = id;
    this.gx = gx;
    this.gy = gy;
    this.shadow = scene.add.image(0, 0, 'shadow').setScale(0.8);
    this.sprite = scene.add.sprite(0, 0, `folk-${id}`, 0).setOrigin(0.5, (FEET_Y + 0.5) / FRAME_H);
    map.setOccupied(Math.floor(gx), Math.floor(gy), true);
    const p = gridToScreen(gx, gy);
    this.shadow.setPosition(p.x, p.y).setDepth(depthAt(gx, gy) - 0.5);
    this.sprite.setPosition(p.x, p.y).setDepth(depthAt(gx, gy));
    this.faceTowards(gx + 1, gy);
  }

  get speaking(): boolean {
    return !!this.line;
  }

  /** What they're saying, shown in a bubble over their head (see ui/SpeechBubbles.ts). */
  get speech(): string | undefined {
    return this.line?.text;
  }

  /** Just above their head, which is lower than a grown-up's. */
  get promptPoint(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y - FEET_Y + 1 };
  }

  say(text: string): void {
    this.line = { text, left: 1.6 + text.length * 0.055 };
    const y = gridToScreen(this.gx, this.gy).y;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.y = y;
    this.scene.tweens.add({ targets: this.sprite, y: y - 2, duration: 90, yoyo: true, repeat: 1, ease: 'Sine.easeOut' });
    const pitch = VOICES[this.id] ?? 480;
    for (let i = 0; i < 3; i++) this.scene.time.delayedCall(i * 75, () => GameAudio.voice(pitch, 0.18, 'triangle'));
  }

  hush(): void {
    this.line = undefined;
  }

  update(dt: number): void {
    if (!this.line) return;
    this.line.left -= dt;
    if (this.line.left <= 0) this.line = undefined;
  }

  /** Turn to face a point, using its on-screen angle (as everyone else does). */
  faceTowards(gx: number, gy: number): void {
    const screen = gridToScreen(gx - this.gx, gy - this.gy);
    if (screen.x === 0 && screen.y === 0) return;
    const facing = (Math.round(Math.atan2(screen.x, screen.y) / (Math.PI / 4)) + 8) % 8;
    if (facing === this.facing && this.sprite.anims.isPlaying) return;
    this.facing = facing;
    // Facings 0..4 are drawn (s, se, e, ne, n); 5..7 are the east ones mirrored.
    const names: DrawnDir[] = ['s', 'se', 'e', 'ne', 'n'];
    const mirrored = facing > 4;
    this.sprite.setFlipX(mirrored);
    this.sprite.play(`folk-${this.id}-idle-${names[mirrored ? 8 - facing : facing]}`, true);
  }
}

/**
 * A pair of children squabbling: they take turns teasing each other in speech
 * bubbles, a little scene at a time, with a pause between scenes. When the
 * player comes close they break off to say hello.
 */
export class Siblings {
  private readonly children: Child[];
  private readonly banter: ChildLine[][];
  private readonly greetings: () => ChildLine[];
  private queue: ChildLine[] = [];
  private wait = 1.5;
  private last = -1;
  private greeted = false;
  /** Looking at the player while saying hello, until this many seconds after. */
  private watching = 0;

  /**
   * @param banter scenes they play out between themselves
   * @param greetings picks what they say when the player comes close (once per visit)
   */
  constructor(children: Child[], banter: ChildLine[][], greetings: () => ChildLine[]) {
    this.children = children;
    this.banter = banter;
    this.greetings = greetings;
    this.lookAtEachOther();
  }

  get speakers(): Speaker[] {
    return this.children;
  }

  update(dt: number, player: Vec2, paused: boolean): void {
    for (const c of this.children) c.update(dt);
    if (paused) return;
    const near = this.children.some((c) => Math.hypot(c.gx - player.x, c.gy - player.y) < GREET_RANGE);
    if (near && !this.greeted) {
      this.greeted = true;
      this.children.forEach((c) => c.hush());
      this.queue = [...this.greetings()];
      this.wait = 0.2;
      this.watching = 1;
    }
    if (this.watching > 0) {
      this.children.forEach((c) => c.faceTowards(player.x, player.y));
      if (this.queue.length === 0 && !this.children.some((c) => c.speaking)) {
        this.watching -= dt;
        if (this.watching <= 0) this.lookAtEachOther();
      }
    }
    if (this.children.some((c) => c.speaking)) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    const next = this.queue.shift();
    if (next) {
      this.children.find((c) => c.id === next[0])?.say(next[1]);
      this.wait = LINE_GAP;
      if (this.queue.length === 0) this.wait = 4 + Math.random() * 4;
      return;
    }
    // Start another squabble, never the same one twice running.
    let pick = Math.floor(Math.random() * this.banter.length);
    if (pick === this.last) pick = (pick + 1) % this.banter.length;
    this.last = pick;
    this.queue = [...this.banter[pick]];
  }

  private lookAtEachOther(): void {
    const [a, b] = this.children;
    if (!a || !b) return;
    a.faceTowards(b.gx, b.gy);
    b.faceTowards(a.gx, a.gy);
  }
}
