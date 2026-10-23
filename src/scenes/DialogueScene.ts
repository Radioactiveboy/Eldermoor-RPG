import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { DialogueChoice, DialogueNode, DialogueScript, Speaker, SPEAKERS } from '../dialogue/Dialogue';
import { PORTRAIT_SIZE } from '../art/npc';
import { THEME } from '../ui/Widgets';

export interface DialogueSceneData {
  script: DialogueScript;
  onAction?: (action: string) => void;
}

const CHOICE_H = 44;
/** Below this screen width the box switches to a phone layout with the portrait above it. */
const COMPACT = 640;

/** Sizes and positions inside the box, relative to its top-centre. */
interface BoxLayout {
  compact: boolean;
  w: number;
  h: number;
  portrait: number;
  px: number;
  py: number;
  textX: number;
  textY: number;
  textW: number;
  nameX: number;
  font: number;
  choiceW: number;
  /** Where the replies list sits: its centre x, and how far above the box its bottom is. */
  choiceX: number;
  choiceGap: number;
}

function boxLayout(screenW: number): BoxLayout {
  if (screenW < COMPACT) {
    const w = screenW - 16;
    const portrait = 92;
    const px = -w / 2 + 10;
    return {
      compact: true, w, h: 150, portrait, px, py: -portrait + 16,
      textX: -w / 2 + 18, textY: 26, textW: w - 36, nameX: px + portrait + 24, font: 17,
      choiceW: w, choiceX: 0, choiceGap: portrait - 4,
    };
  }
  const w = 860;
  const portrait = 144;
  const px = -w / 2 + 18;
  const textX = px + portrait + 22;
  return {
    compact: false, w, h: 176, portrait, px, py: -26,
    textX, textY: 26, textW: w / 2 - textX - 28, nameX: textX + 14, font: 21,
    choiceW: 520, choiceX: w / 2 - 520 / 2 - 10, choiceGap: 18,
  };
}
/** Letters per second while typing. */
const TYPE_SPEED = 42;
/** Extra pause after punctuation, in seconds. */
const PAUSES: Record<string, number> = { '.': 0.22, '!': 0.22, '?': 0.22, ',': 0.1, ';': 0.12, ':': 0.12 };
const TEXT_FONT = 'Georgia, "Times New Roman", serif';

/**
 * Conversation box: the speaker's portrait (which talks and blinks), their
 * name, and their words typed out letter by letter with little voice blips.
 * When a node offers replies they appear as a list above the box.
 *
 * Click, tap, Space, Enter or E to skip the typing or move on. Replies can be
 * picked with the mouse, number keys, or up/down then Enter.
 */
export class DialogueScene extends Phaser.Scene {
  private data_!: DialogueSceneData;
  private node!: DialogueNode;
  private lineIndex = 0;
  private speaker!: Speaker;

  private root!: Phaser.GameObjects.Container;
  private shade!: Phaser.GameObjects.Graphics;
  /** Invisible full-screen catcher, so a click anywhere moves the conversation on. */
  private catcher!: Phaser.GameObjects.Zone;
  private portrait!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.Text;
  private nameBg!: Phaser.GameObjects.Graphics;
  private body!: Phaser.GameObjects.Text;
  private more!: Phaser.GameObjects.Text;
  private choiceBox!: Phaser.GameObjects.Container;
  private L?: BoxLayout;

  private fullText = '';
  private shown = 0;
  private typeClock = 0;
  private typing = false;
  private mouthTimer = 0;
  private blinkTimer = 3;
  private choices: DialogueChoice[] = [];
  private choiceButtons: Array<{ draw: (on: boolean) => void }> = [];
  private selected = 0;
  private closing = false;
  private readyAt = 0;

  constructor() {
    super('Dialogue');
  }

  create(data: DialogueSceneData): void {
    this.data_ = data;
    this.closing = false;
    // Ignore the key press or click that opened the conversation.
    this.readyAt = this.time.now + 150;

    this.shade = this.add.graphics();
    this.catcher = this.add.zone(0, 0, 10, 10).setOrigin(0).setInteractive();
    this.catcher.on('pointerup', () => this.advance());
    this.L = undefined;
    this.choiceBox = this.add.container(0, 0);

    const kb = this.input.keyboard!;
    for (const key of ['SPACE', 'ENTER', 'E']) kb.on(`keydown-${key}`, () => this.confirm());
    kb.on('keydown-UP', () => this.moveSelection(-1));
    kb.on('keydown-W', () => this.moveSelection(-1));
    kb.on('keydown-DOWN', () => this.moveSelection(1));
    kb.on('keydown-S', () => this.moveSelection(1));
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, i) => kb.on(`keydown-${key}`, () => this.choose(i)));

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));

    this.root.setAlpha(0).y += 30;
    this.tweens.add({ targets: this.root, alpha: 1, y: '-=30', duration: 220, ease: 'Cubic.easeOut' });
    this.goTo(data.script.start);
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.updateTyping(dt);

    // Portrait: mouth flaps while letters appear, and she blinks now and then.
    this.blinkTimer -= dt;
    let frame = 0;
    if (this.typing && this.mouthTimer > 0) frame = Math.floor(this.time.now / 90) % 2;
    if (this.blinkTimer < 0) {
      frame = 2;
      if (this.blinkTimer < -0.13) this.blinkTimer = 2.5 + Math.random() * 3;
    }
    this.mouthTimer -= dt;
    this.portrait.setFrame(frame);
    this.more.setVisible(!this.typing && this.choices.length === 0 && !this.closing);
  }

  /** (Re)builds the box for the given layout, keeping whatever is currently being said. */
  private buildBox(L: BoxLayout): void {
    const keepText = this.body?.text ?? '';
    this.root?.destroy();
    const left = -L.w / 2;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(left + 4, 6, L.w, L.h, 14);
    g.fillStyle(THEME.panel, 0.95);
    g.fillRoundedRect(left, 0, L.w, L.h, 14);
    g.lineStyle(2, THEME.gold, 0.95);
    g.strokeRoundedRect(left, 0, L.w, L.h, 14);
    g.lineStyle(1, THEME.gold, 0.35);
    g.strokeRoundedRect(left + 7, 7, L.w - 14, L.h - 14, 10);

    // Portrait in its own frame, standing proud of the box.
    const { px, py, portrait: P } = L;
    const frame = this.add.graphics();
    frame.fillStyle(0x000000, 0.5);
    frame.fillRoundedRect(px + 3, py + 5, P, P, 10);
    frame.fillGradientStyle(0x3a2c3e, 0x3a2c3e, 0x1a1420, 0x1a1420, 1);
    frame.fillRoundedRect(px, py, P, P, 10);
    frame.lineStyle(3, THEME.gold, 1);
    frame.strokeRoundedRect(px, py, P, P, 10);
    this.portrait = this.add
      .image(px + P / 2, py + P - Math.round(P / 18), 'portrait-mother', 0)
      .setOrigin(0.5, 1)
      .setScale((P - P / 9) / PORTRAIT_SIZE);

    this.nameBg = this.add.graphics();
    this.nameText = this.add
      .text(L.nameX, -2, '', { fontFamily: THEME.font, fontSize: '20px', color: THEME.goldText, fontStyle: 'bold' })
      .setOrigin(0, 0.5);
    this.body = this.add
      .text(L.textX, L.textY, keepText, {
        fontFamily: TEXT_FONT,
        fontSize: `${L.font}px`,
        color: THEME.text,
        lineSpacing: L.compact ? 5 : 7,
        wordWrap: { width: L.textW },
      })
      .setOrigin(0, 0);
    this.more = this.add
      .text(L.w / 2 - 22, L.h - 14, '▼', { fontFamily: TEXT_FONT, fontSize: '16px', color: THEME.goldText })
      .setOrigin(0.5, 1);
    this.tweens.add({ targets: this.more, y: '+=4', duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.root = this.add.container(0, 0, [g, frame, this.portrait, this.nameBg, this.nameText, this.body, this.more]);
    if (this.speaker) this.setSpeaker(this.speaker);
  }

  private layout(): void {
    const { width, height } = this.scale;
    const L = boxLayout(width);
    if (!this.L || this.L.w !== L.w) {
      this.L = L;
      this.buildBox(L);
      if (this.choices.length > 0) {
        const pending = this.choices;
        this.clearChoices();
        this.showChoices(pending);
      }
    }
    const scale = L.compact ? 1 : Math.min(1, (width - 20) / L.w, (height - 20) / 420);
    this.root.setScale(scale).setPosition(width / 2, height - (L.h + 10) * scale);
    this.choiceBox.setScale(scale).setPosition(width / 2 + L.choiceX * scale, this.root.y - L.choiceGap * scale);
    // Darken the bottom of the screen so the box stands out from the room.
    this.shade.clear();
    this.shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.55, 0.55);
    this.shade.fillRect(0, height * 0.45, width, height * 0.55);
    this.catcher.setSize(width, height);
    this.catcher.input!.hitArea.setSize(width, height);
  }

  private goTo(id: string | undefined): void {
    if (!id) {
      this.close();
      return;
    }
    const node = this.data_.script.nodes[id];
    if (!node) throw new Error(`Missing dialogue node: ${id}`);
    this.node = node;
    this.lineIndex = 0;
    this.setSpeaker(SPEAKERS[node.speaker]);
    this.showLine();
  }

  private setSpeaker(speaker: Speaker): void {
    this.speaker = speaker;
    this.portrait.setTexture(speaker.portrait, 0);
    this.nameText.setText(speaker.name);
    const w = this.nameText.width + 28;
    this.nameBg.clear();
    this.nameBg.fillStyle(0x2a1d14, 1);
    this.nameBg.fillRoundedRect(this.nameText.x - 14, -18, w, 32, 8);
    this.nameBg.lineStyle(2, THEME.gold, 1);
    this.nameBg.strokeRoundedRect(this.nameText.x - 14, -18, w, 32, 8);
  }

  private showLine(): void {
    this.clearChoices();
    this.fullText = this.node.lines[this.lineIndex];
    this.shown = 0;
    this.typeClock = 0;
    this.typing = true;
    this.body.setText('');
  }

  private updateTyping(dt: number): void {
    if (!this.typing) return;
    this.typeClock -= dt;
    while (this.typing && this.typeClock <= 0) {
      const ch = this.fullText[this.shown];
      this.shown++;
      this.typeClock += 1 / TYPE_SPEED + (PAUSES[ch] ?? 0);
      if (/[a-z0-9]/i.test(ch)) {
        this.mouthTimer = 0.12;
        // A blip every other letter sounds like speech; every letter sounds like a machine gun.
        if (this.shown % 2 === 0) GameAudio.voice(this.speaker.voice.pitch, this.speaker.voice.spread, this.speaker.voice.wave);
      }
      if (this.shown >= this.fullText.length) this.finishLine();
    }
    this.body.setText(this.fullText.slice(0, this.shown));
  }

  private finishLine(): void {
    this.typing = false;
    this.shown = this.fullText.length;
    this.body.setText(this.fullText);
    const last = this.lineIndex >= this.node.lines.length - 1;
    if (last && this.node.choices) this.showChoices(this.node.choices);
  }

  private confirm(): void {
    if (this.choices.length > 0 && !this.typing) this.choose(this.selected);
    else this.advance();
  }

  /** Skip the typing, or move on to the next line / node. */
  private advance(): void {
    if (this.closing || this.time.now < this.readyAt) return;
    if (this.typing) {
      this.finishLine();
      return;
    }
    if (this.choices.length > 0) return;
    GameAudio.hover();
    if (this.lineIndex < this.node.lines.length - 1) {
      this.lineIndex++;
      this.showLine();
    } else {
      this.leaveNode();
      this.goTo(this.node.next);
    }
  }

  /** A node's action runs once its lines have been read, so its effects (like a "New quest" banner) follow the words. */
  private leaveNode(): void {
    if (this.node.action) this.data_.onAction?.(this.node.action);
  }

  private showChoices(choices: DialogueChoice[]): void {
    this.choices = choices;
    this.selected = 0;
    this.choiceButtons = [];
    const W = this.L!.choiceW;
    const top = -(choices.length * (CHOICE_H + 8));
    choices.forEach((choice, i) => {
      const y = top + i * (CHOICE_H + 8) + CHOICE_H / 2;
      const bg = this.add.graphics();
      const label = this.add
        .text(-W / 2 + 46, 0, choice.text, {
          fontFamily: TEXT_FONT,
          fontSize: this.L!.compact ? '16px' : '18px',
          color: THEME.text,
          wordWrap: { width: W - 64 },
        })
        .setOrigin(0, 0.5);
      const num = this.add
        .text(-W / 2 + 22, 0, `${i + 1}`, { fontFamily: THEME.font, fontSize: '18px', color: THEME.goldText })
        .setOrigin(0.5);
      const draw = (on: boolean) => {
        bg.clear();
        bg.fillStyle(on ? THEME.panelLight : THEME.panel, 0.95);
        bg.fillRoundedRect(-W / 2, -CHOICE_H / 2, W, CHOICE_H, 10);
        bg.lineStyle(2, THEME.gold, on ? 1 : 0.5);
        bg.strokeRoundedRect(-W / 2, -CHOICE_H / 2, W, CHOICE_H, 10);
        label.setColor(on ? THEME.goldText : THEME.text);
      };
      const button = this.add.container(0, y, [bg, num, label]);
      button.setSize(W, CHOICE_H).setInteractive({ useHandCursor: true });
      button.on('pointerover', () => this.select(i));
      button.on('pointerup', () => this.choose(i));
      this.choiceBox.add(button);
      this.choiceButtons.push({ draw });
      // Slide in one after another.
      button.setAlpha(0).x += 24;
      this.tweens.add({ targets: button, alpha: 1, x: 0, delay: i * 70, duration: 180, ease: 'Cubic.easeOut' });
    });
    this.select(0, false);
  }

  private select(i: number, sound = true): void {
    if (i < 0 || i >= this.choiceButtons.length) return;
    if (sound && i !== this.selected) GameAudio.hover();
    this.selected = i;
    this.choiceButtons.forEach((b, j) => b.draw(j === i));
  }

  private moveSelection(delta: number): void {
    if (this.choices.length === 0) return;
    this.select((this.selected + delta + this.choices.length) % this.choices.length);
  }

  private choose(i: number): void {
    if (this.closing || this.typing || i >= this.choices.length || this.time.now < this.readyAt) return;
    const choice = this.choices[i];
    GameAudio.click();
    this.clearChoices();
    this.leaveNode();
    if (choice.action) this.data_.onAction?.(choice.action);
    this.goTo(choice.next);
  }

  private clearChoices(): void {
    this.choices = [];
    this.choiceButtons = [];
    this.choiceBox.removeAll(true);
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    this.tweens.add({
      targets: this.root,
      alpha: 0,
      y: '+=30',
      duration: 180,
      onComplete: () => {
        this.events.emit('dialogue-closed');
        this.scene.stop();
      },
    });
    this.tweens.add({ targets: this.shade, alpha: 0, duration: 180 });
  }
}
