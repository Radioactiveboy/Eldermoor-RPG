import Phaser from 'phaser';
import { currentTarget, placeIn } from '../systems/QuestTargets';
import { QuestLog } from '../systems/Quests';
import type { AreaId } from '../world/MapData';
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
  /** Which place the step is in, when it isn't here (with the quest markers on). */
  private readonly where: Phaser.GameObjects.Text;
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
    this.where = scene.add.text(0, 0, '', { fontFamily: UI_FONT, fontSize: '12px', color: '#d9b45a', fontStyle: 'italic' });
    // Tapping the tracker opens the journal too.
    this.title.setInteractive({ useHandCursor: true }).on('pointerup', onClick);
    this.step.setInteractive({ useHandCursor: true }).on('pointerup', onClick);
    this.where.setInteractive({ useHandCursor: true }).on('pointerup', onClick);
  }

  setVisible(visible: boolean): void {
    [this.frame, this.title, this.step, this.where].forEach((o) => o.setVisible(visible));
  }

  get height(): number {
    const last = this.where.text ? this.where : this.step;
    return last.y + last.height + PAD - this.y;
  }

  setMaxWidth(w: number): void {
    this.maxWidth = Math.min(300, w);
    this.step.setWordWrapWidth(this.maxWidth - PAD * 2 - 14);
    this.where.setWordWrapWidth(this.maxWidth - PAD * 2 - 14);
    this.shownText = '';
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.shownText = '';
  }

  /** @param area where the hero is, to say where the step is when it's elsewhere; undefined when quest markers are off */
  update(area?: AreaId): void {
    const quest = QuestLog.focused;
    // Before anything has begun, Mother is waiting; once every errand is done, the world is the hero's to wander.
    const begun = QuestLog.all.length > 0;
    // (The night of the tincture, and the morning after, before the goblins' raid starts its own quest.)
    const raid = QuestLog.hasFlag('raid-morning') ? 'morning' : QuestLog.hasFlag('raid-pending') ? 'night' : undefined;
    const title = quest ? quest.def.title : raid === 'morning' ? 'Dawn' : raid === 'night' ? 'Rest' : begun ? 'Free to roam' : 'At home';
    const step = quest
      ? (QuestLog.current(quest)?.text ?? 'Return to whoever gave you this quest')
      : raid === 'morning'
        ? 'Find out what the shouting is outside'
        : raid === 'night'
          ? 'Get some sleep, and hope Mother is better in the morning'
          : begun ? 'Mother is mending. Explore, hunt and cook.' : 'Speak with Mother';
    const target = area ? currentTarget() : undefined;
    const where = target && target.area !== area ? `In ${placeIn(target.area)}` : '';
    const text = `${title}|${step}|${where}`;
    if (text === this.shownText) return;
    const changed = this.shownText !== '';
    this.shownText = text;

    this.title.setText(title).setPosition(this.x + PAD, this.y + PAD - 2);
    this.step.setText(`◆ ${step}`).setPosition(this.x + PAD, this.y + PAD + 18);
    this.where.setText(where).setPosition(this.x + PAD + 14, this.step.y + this.step.height + 3);
    this.frame.clear();
    drawPanel(this.frame, this.x, this.y, this.maxWidth, this.height);
    if (changed) this.pulse();
  }

  /** Flash briefly so a new objective catches the eye. */
  private pulse(): void {
    const targets = [this.title, this.step, this.where, this.frame];
    this.scene.tweens.add({ targets, alpha: { from: 0.2, to: 1 }, duration: 260, repeat: 2 });
  }
}
