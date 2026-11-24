import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { DialogueChoice, DialogueNode, DialogueScript, Speaker, SpeakerId, SPEAKERS } from '../dialogue/Dialogue';
import { arrangeChoices, ChoiceMenu, MenuRow, MenuView, scrollToShow } from '../dialogue/ChoiceMenu';
import { ORB_PORTRAIT, PORTRAIT_SIZE } from '../art/sizes';
import { Affiliations } from '../dialogue/Affiliations';
import { THEME } from '../ui/Widgets';

export interface DialogueSceneData {
  script: DialogueScript;
  onAction?: (action: string) => void;
}

/** A reply's row inside the box (taller on a phone, for thumbs), and a "▲ 3 more" row. */
const ROW_H = 34;
const ROW_H_TOUCH = 38;
const ARROW_H = 22;
/** The most rows of replies shown at once; past that the list folds or scrolls (see ChoiceMenu.ts). */
const MAX_ROWS = 6;

/** Replies picked so far this session, so they can be dimmed and folded away next time. */
const HEARD = new Set<string>();
const heardKey = (speaker: SpeakerId, c: DialogueChoice) => `${speaker}|${c.next ?? ''}|${c.text}`;
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
}

function boxLayout(screenW: number): BoxLayout {
  if (screenW < COMPACT) {
    const w = screenW - 16;
    const portrait = 108;
    const px = -w / 2 + 10;
    return {
      compact: true, w, h: 150, portrait, px, py: -portrait + 16,
      textX: -w / 2 + 18, textY: 26, textW: w - 36, nameX: px + portrait + 24, font: 17,
    };
  }
  const w = 860;
  const portrait = 162;
  const px = -w / 2 + 18;
  const textX = px + portrait + 22;
  return {
    compact: false, w, h: 176, portrait, px, py: -26,
    textX, textY: 26, textW: w / 2 - textX - 28, nameX: textX + 14, font: 21,
  };
}
/** Letters per second while typing. */
const TYPE_SPEED = 42;
/** Extra pause after punctuation, in seconds. */
const PAUSES: Record<string, number> = { '.': 0.22, '!': 0.22, '?': 0.22, ',': 0.1, ';': 0.12, ':': 0.12 };
const TEXT_FONT = 'Merriweather, Georgia, "Times New Roman", serif';

/**
 * Conversation box: the speaker's portrait (which talks and blinks), their
 * name, and their words typed out letter by letter with little voice blips.
 * When a node offers replies they're listed in the box under the words; a long list
 * folds its everyday questions under "Ask about…" and scrolls (see ChoiceMenu.ts).
 *
 * Click, tap, Space, Enter or E to skip the typing or move on. Replies can be
 * picked with the mouse, number keys, or up/down then Enter; the mouse wheel
 * scrolls a long list, and Esc goes back out of "Ask about…".
 */
export class DialogueScene extends Phaser.Scene {
  private data_!: DialogueSceneData;
  private node!: DialogueNode;
  private lineIndex = 0;
  private speaker!: Speaker;
  /** Who last gave a voice bark in this conversation, so a speaker barks once per turn at talking. */
  private barked?: Speaker;

  private root!: Phaser.GameObjects.Container;
  private shade!: Phaser.GameObjects.Graphics;
  /** Invisible full-screen catcher, so a click anywhere moves the conversation on. */
  private catcher!: Phaser.GameObjects.Zone;
  private portrait!: Phaser.GameObjects.Image;
  /** Over the portrait, for the orb only: its stirred loop, faded in while it speaks. */
  private portraitStir!: Phaser.GameObjects.Image;
  /** How big the portrait is drawn, in the box's pixels. */
  private portraitSize = 0;
  private nameText!: Phaser.GameObjects.Text;
  private nameBg!: Phaser.GameObjects.Graphics;
  /** Who the speaker belongs to, under the portrait (on a phone, over their name), once the hero knows. */
  private factionText!: Phaser.GameObjects.Text;
  private factionBg!: Phaser.GameObjects.Graphics;
  /** Everyone who spoke in this conversation, so a `met` affiliation is known next time. */
  private spoke = new Set<SpeakerId>();
  private body!: Phaser.GameObjects.Text;
  private more!: Phaser.GameObjects.Text;
  private choiceBox!: Phaser.GameObjects.Container;
  private frameG!: Phaser.GameObjects.Graphics;
  /** The box's height now: its usual height, or taller while it holds a list of replies. */
  private boxH = 0;
  private L?: BoxLayout;

  private fullText = '';
  private shown = 0;
  private typeClock = 0;
  private typing = false;
  private mouthTimer = 0;
  private blinkTimer = 3;
  private choices: DialogueChoice[] = [];
  private choiceButtons: Array<{ draw: (on: boolean) => void }> = [];
  /** The open list's rows (its scrolling rows, then its pinned ones); number keys and `selected` index into this. */
  private rows: MenuRow[] = [];
  private menu?: ChoiceMenu;
  private view: 'top' | 'sub' = 'top';
  /** First scrolling row in view, and how many are. */
  private offset = 0;
  private visible = 0;
  private nodeId = '';
  /** The node whose "Ask about…" list the last reply was picked from, to open it again on coming back. */
  private subFor?: string;
  private selected = 0;
  private closing = false;
  private readyAt = 0;

  constructor() {
    super('Dialogue');
  }

  create(data: DialogueSceneData): void {
    this.data_ = data;
    this.closing = false;
    this.barked = undefined;
    this.subFor = undefined;
    this.spoke.clear();
    // Ignore the key press or click that opened the conversation.
    this.readyAt = this.time.now + 150;

    this.shade = this.add.graphics();
    this.catcher = this.add.zone(0, 0, 10, 10).setOrigin(0).setInteractive();
    this.catcher.on('pointerup', () => this.advance());
    this.L = undefined;

    const kb = this.input.keyboard!;
    for (const key of ['SPACE', 'ENTER', 'E']) kb.on(`keydown-${key}`, () => this.confirm());
    kb.on('keydown-UP', () => this.moveSelection(-1));
    kb.on('keydown-W', () => this.moveSelection(-1));
    kb.on('keydown-DOWN', () => this.moveSelection(1));
    kb.on('keydown-S', () => this.moveSelection(1));
    kb.on('keydown-ESC', () => this.back());
    kb.on('keydown-BACKSPACE', () => this.back());
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.rows.length > 0) this.scrollBy(dy > 0 ? 1 : -1);
    });
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'].forEach((key, i) => kb.on(`keydown-${key}`, () => this.choose(i)));

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

    // The orb's portrait never stops turning, and stirs while the voice in it speaks.
    if (this.speaker?.portrait === ORB_PORTRAIT.key) {
      const f = Math.floor((this.time.now / 1000) * ORB_PORTRAIT.fps) % ORB_PORTRAIT.frames;
      this.portrait.setFrame(f);
      this.portraitStir.setFrame(ORB_PORTRAIT.frames + f);
      const want = this.typing ? 1 : 0;
      const a = this.portraitStir.alpha;
      this.portraitStir.setAlpha(a + (want - a) * Math.min(1, dt * (want > a ? 5 : 2)));
      this.more.setVisible(!this.typing && this.choices.length === 0 && !this.closing);
      return;
    }

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
    this.frameG = this.add.graphics();
    this.boxH = L.h;

    // Portrait in its own frame, standing proud of the box.
    const { px, py, portrait: P } = L;
    const frame = this.add.graphics();
    frame.fillStyle(0x000000, 0.5);
    frame.fillRoundedRect(px + 3, py + 5, P, P, 10);
    frame.fillGradientStyle(0x3a2c3e, 0x3a2c3e, 0x1a1420, 0x1a1420, 1);
    frame.fillRoundedRect(px, py, P, P, 10);
    frame.lineStyle(3, THEME.gold, 1);
    frame.strokeRoundedRect(px, py, P, P, 10);
    this.portraitSize = P - P / 9;
    this.portrait = this.add
      .image(px + P / 2, py + P - Math.round(P / 18), 'portrait-mother', 0)
      .setOrigin(0.5, 1)
      .setScale(this.portraitSize / PORTRAIT_SIZE);
    this.portraitStir = this.add
      .image(this.portrait.x, this.portrait.y, 'portrait-mother', 0)
      .setOrigin(0.5, 1)
      .setVisible(false);

    this.nameBg = this.add.graphics();
    this.nameText = this.add
      .text(L.nameX, -2, '', { fontFamily: THEME.font, fontSize: '20px', color: THEME.goldText, fontStyle: 'bold' })
      .setOrigin(0, 0.5);
    this.factionBg = this.add.graphics();
    this.factionText = this.add
      .text(0, 0, '', { fontFamily: THEME.font, fontSize: L.compact ? '12px' : '13px', color: '#c8b88e', fontStyle: 'bold' })
      .setOrigin(L.compact ? 0 : 0.5, 0.5);
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

    // Replies are listed inside the box, under what was said.
    this.choiceBox = this.add.container(0, 0);
    this.root = this.add.container(0, 0, [this.frameG, frame, this.portrait, this.portraitStir, this.factionBg, this.factionText, this.nameBg, this.nameText, this.body, this.more, this.choiceBox]);
    this.drawFrame();
    if (this.speaker) this.setSpeaker(this.speaker, this.node ? this.node.speaker : undefined);
  }

  /** The box itself, at its current height. */
  private drawFrame(): void {
    const L = this.L!;
    const g = this.frameG;
    const left = -L.w / 2;
    const h = this.boxH;
    g.clear();
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(left + 4, 6, L.w, h, 14);
    g.fillStyle(THEME.panel, 0.95);
    g.fillRoundedRect(left, 0, L.w, h, 14);
    g.lineStyle(2, THEME.gold, 0.95);
    g.strokeRoundedRect(left, 0, L.w, h, 14);
    g.lineStyle(1, THEME.gold, 0.35);
    g.strokeRoundedRect(left + 7, 7, L.w - 14, h - 14, 10);
  }

  private boxScale(): number {
    const L = this.L!;
    const { width, height } = this.scale;
    return L.compact ? 1 : Math.min(1, (width - 20) / L.w, (height - 20) / 420);
  }

  /** Sits the box on the bottom of the screen, growing upwards when it's taller. */
  private place(): void {
    const { width, height } = this.scale;
    const scale = this.boxScale();
    this.root.setScale(scale).setPosition(width / 2, height - (this.boxH + 10) * scale);
  }

  private layout(): void {
    const { width, height } = this.scale;
    const L = boxLayout(width);
    if (!this.L || this.L.w !== L.w) {
      this.L = L;
      this.buildBox(L);
    }
    // The number of rows that fit depends on the height too, so lay the replies out again, in the same list.
    if (this.choices.length > 0) {
      const pending = this.choices;
      const inSub = this.view === 'sub';
      const keep = this.subFor;
      this.clearChoices();
      if (inSub) this.subFor = this.nodeId;
      this.showChoices(pending);
      this.subFor = keep;
    }
    this.place();
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
    this.nodeId = id;
    this.lineIndex = 0;
    const speaker = SPEAKERS[node.speaker];
    // A short bark as someone starts speaking, under the typing blips.
    this.spoke.add(node.speaker);
    if (speaker !== this.barked) GameAudio.bark(speaker.name, speaker.voice.pitch, speaker.voice.wave, node.lines[0] ?? '');
    this.barked = speaker;
    this.setSpeaker(speaker, node.speaker);
    this.showLine();
  }

  private setSpeaker(speaker: Speaker, id?: SpeakerId): void {
    this.speaker = speaker;
    this.portrait.setTexture(speaker.portrait, 0);
    // Most portraits are PORTRAIT_SIZE square; the orb's is painted bigger, so size by the frame.
    this.portrait.setScale(this.portraitSize / this.portrait.frame.width);
    const orb = speaker.portrait === ORB_PORTRAIT.key;
    this.portraitStir.setVisible(orb);
    if (orb) {
      this.portraitStir.setTexture(speaker.portrait, ORB_PORTRAIT.frames).setScale(this.portrait.scale);
      this.portraitStir.setAlpha(0);
    }
    this.nameText.setText(speaker.name);
    const w = this.nameText.width + 28;
    this.nameBg.clear();
    this.nameBg.fillStyle(0x2a1d14, 1);
    this.nameBg.fillRoundedRect(this.nameText.x - 14, -18, w, 32, 8);
    this.nameBg.lineStyle(2, THEME.gold, 1);
    this.nameBg.strokeRoundedRect(this.nameText.x - 14, -18, w, 32, 8);
    this.showFaction(id);
  }

  /** The speaker's faction under their portrait: in the box below it on a wide screen, on a little plate over their name on a phone. */
  private showFaction(id?: SpeakerId): void {
    const L = this.L!;
    const known = id ? Affiliations.known(id) : undefined;
    this.factionBg.clear();
    this.factionText.setText(known?.label ?? '').setVisible(!!known);
    if (!known) return;
    const t = this.factionText.setScale(1);
    if (L.compact) {
      t.setPosition(this.nameText.x - 8, -32);
      const w = t.width + 16;
      this.factionBg.fillStyle(THEME.panel, 0.92);
      this.factionBg.fillRoundedRect(t.x - 8, t.y - 10, w, 20, 6);
      this.factionBg.lineStyle(1, THEME.gold, 0.6);
      this.factionBg.strokeRoundedRect(t.x - 8, t.y - 10, w, 20, 6);
      return;
    }
    // In the strip of box between the bottom of the portrait and the box's inner edge.
    const top = L.py + L.portrait;
    t.setPosition(L.px + L.portrait / 2, (top + L.h - 7) / 2 + 1);
    t.setScale(Math.min(1, (L.portrait + 6) / t.width));
    this.factionBg.lineStyle(1, THEME.gold, 0.35);
    const half = Math.min(L.portrait, t.displayWidth + 24) / 2;
    this.factionBg.lineBetween(t.x - half, top + 5, t.x + half, top + 5);
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
    if (this.rows.length > 0 && !this.typing) this.choose(this.selected);
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
    if (this.node.action) this.runAction(this.node.action);
  }

  /** Runs an action, then brings the conversation up to date if it can be (see DialogueScript.refresh). */
  private runAction(action: string): void {
    this.data_.onAction?.(action);
    const refresh = this.data_.script.refresh;
    if (refresh) this.data_.script = refresh();
  }

  private showChoices(choices: DialogueChoice[]): void {
    this.choices = choices;
    const heard = choices.map((c) => HEARD.has(heardKey(this.node.speaker, c)));
    const last = choices[choices.length - 1];
    const lastLeaves = !!last && this.leaves(last);
    this.menu = arrangeChoices({ choices, heard, lastLeaves, fit: this.fitRows() });
    // Back from one of the folded-away questions: open them again, as that's likely where the player is browsing.
    const reopen = this.menu.sub && this.subFor === this.nodeId;
    this.openView(reopen ? 'sub' : 'top');
  }

  /** Whether a reply ends the conversation: it goes nowhere, or to a last word with nothing after it. */
  private leaves(c: DialogueChoice): boolean {
    if (!c.next) return true;
    const to = this.data_.script.nodes[c.next];
    return !!to && !to.choices && !to.next && !to.action && !c.action;
  }

  /** Where the list of replies starts in the box: under what was said, past the portrait on a phone. */
  private listTop(): number {
    const L = this.L!;
    const under = L.textY + Math.ceil(this.body.height) + 14;
    return L.compact ? under : Math.max(under, L.textY + 34);
  }

  private rowH(): number {
    return this.L!.compact ? ROW_H_TOUCH : ROW_H;
  }

  /** How many rows of replies fit, keeping the box to about half the screen at most. */
  private fitRows(): number {
    const scale = this.boxScale();
    const room = (this.scale.height * 0.5) / scale - this.listTop() - 20;
    return Phaser.Math.Clamp(Math.floor(room / this.rowH()), 3, MAX_ROWS);
  }

  private openView(view: 'top' | 'sub'): void {
    this.view = view;
    const v = this.currentView();
    this.rows = [...v.scroll, ...v.pinned];
    this.offset = 0;
    const fit = this.fitRows();
    this.visible = v.scroll.length + v.pinned.length > fit ? Math.max(2, fit - v.pinned.length - 1) : v.scroll.length;
    // Start on the first thing not yet asked.
    const first = v.scroll.findIndex((r) => typeof r === 'number' && !HEARD.has(heardKey(this.node.speaker, this.choices[r])));
    this.selected = Math.max(0, first);
    this.offset = scrollToShow(0, this.selected, this.visible, v.scroll.length);
    this.renderChoices(true);
  }

  private currentView(): MenuView {
    return (this.view === 'sub' && this.menu?.sub) || this.menu!.top;
  }

  /** Draws the rows of the open list that are in view, inside the box under what was said, and fits the box round them. */
  private renderChoices(slideIn = false): void {
    this.choiceBox.removeAll(true);
    this.choiceButtons = [];
    const L = this.L!;
    const v = this.currentView();
    const x0 = L.textX;
    const W = L.compact ? L.textW : L.w / 2 - x0 - 30;
    const rowH = this.rowH();
    const shown = v.scroll.slice(this.offset, this.offset + this.visible);
    const above = this.offset;
    const below = v.scroll.length - this.offset - shown.length;
    let y = this.listTop();

    // A hairline between what was said and the replies.
    const rule = this.add.graphics();
    rule.lineStyle(1, THEME.gold, 0.3);
    rule.lineBetween(x0, y - 7, x0 + W, y - 7);
    this.choiceBox.add(rule);

    const items: Phaser.GameObjects.Container[] = [];
    const addArrow = (up: boolean, n: number) => {
      const t = this.add
        .text(W / 2, 0, `${up ? '▲' : '▼'}  ${n} more`, { fontFamily: TEXT_FONT, fontSize: '13px', color: THEME.goldText })
        .setOrigin(0.5)
        .setAlpha(0.85);
      const c = this.add.container(x0, y + ARROW_H / 2, [t]);
      c.setInteractive(new Phaser.Geom.Rectangle(0, -ARROW_H / 2, W, ARROW_H), Phaser.Geom.Rectangle.Contains);
      c.input!.cursor = 'pointer';
      c.on('pointerup', () => this.scrollBy(up ? -1 : 1));
      items.push(c);
      y += ARROW_H;
    };
    const addRow = (row: MenuRow, at: number) => {
      const choice = typeof row === 'number' ? this.choices[row] : undefined;
      const heard = !!choice && HEARD.has(heardKey(this.node.speaker, choice));
      const sub = this.menu?.sub;
      const side = row === 'more' || row === 'back';
      const text = row === 'more' ? 'Ask about…' : row === 'back' ? 'Back' : choice!.text;
      const label = this.add
        .text(28, 0, text, {
          fontFamily: TEXT_FONT,
          fontSize: L.compact ? '16px' : '17px',
          color: THEME.text,
          fontStyle: side ? 'italic' : 'normal',
          wordWrap: { width: W - (row === 'more' ? 140 : 56) },
        })
        .setOrigin(0, 0.5);
      const H = Math.max(rowH, Math.ceil(label.height) + 10);
      const num = this.add
        .text(10, 0, row === 'back' ? '‹' : `${at + 1}`, { fontFamily: THEME.font, fontSize: '15px', color: THEME.goldText })
        .setOrigin(0.5);
      const bg = this.add.graphics();
      const parts: Phaser.GameObjects.GameObject[] = [bg, num, label];
      if (row === 'more' && sub) {
        const fresh = sub.scroll.some((r) => typeof r === 'number' && !HEARD.has(heardKey(this.node.speaker, this.choices[r])));
        parts.push(
          this.add
            .text(W - 6, 0, `${sub.scroll.length} questions  ›`, { fontFamily: TEXT_FONT, fontSize: '14px', color: fresh ? THEME.goldText : THEME.dimText })
            .setOrigin(1, 0.5),
        );
      }
      if (heard) parts.push(this.add.text(W - 6, 0, '✓', { fontFamily: TEXT_FONT, fontSize: '14px', color: THEME.dimText }).setOrigin(1, 0.5));
      const idle = heard || side ? THEME.dimText : THEME.text;
      const draw = (on: boolean) => {
        bg.clear();
        if (on) {
          bg.fillStyle(THEME.panelLight, 1);
          bg.fillRoundedRect(-6, -H / 2 + 1, W + 12, H - 2, 7);
          bg.fillStyle(THEME.gold, 1);
          bg.fillRect(-6, -H / 2 + 6, 3, H - 12);
        }
        label.setColor(on ? THEME.goldText : idle);
      };
      const button = this.add.container(x0, y + H / 2, parts);
      button.setInteractive(new Phaser.Geom.Rectangle(-6, -H / 2, W + 12, H), Phaser.Geom.Rectangle.Contains);
      button.input!.cursor = 'pointer';
      button.on('pointerover', () => this.select(at));
      button.on('pointerup', () => this.pick(at));
      items.push(button);
      this.choiceButtons[at] = { draw };
      y += H;
    };

    if (above > 0) addArrow(true, above);
    shown.forEach((row, i) => addRow(row, this.offset + i));
    if (below > 0) addArrow(false, below);
    if (v.pinned.length > 0) y += 6;
    v.pinned.forEach((row, i) => addRow(row, v.scroll.length + i));

    items.forEach((item, i) => {
      this.choiceBox.add(item);
      if (!slideIn) return;
      item.setAlpha(0);
      this.tweens.add({ targets: item, alpha: 1, delay: i * 40, duration: 160, ease: 'Cubic.easeOut' });
    });
    this.fitBox(Math.max(L.h, y + 18));
    this.select(this.selected, false);
  }

  /** Grows (or shrinks) the box to `h`, keeping its bottom where it is. */
  private fitBox(h: number): void {
    if (h === this.boxH) return;
    this.boxH = h;
    this.more.setY(h - 14);
    this.drawFrame();
    this.place();
  }

  private select(i: number, sound = true): void {
    if (i < 0 || i >= this.rows.length || !this.choiceButtons[i]) return;
    if (sound && i !== this.selected) GameAudio.hover();
    this.selected = i;
    this.choiceButtons.forEach((b, j) => b?.draw(j === i));
  }

  private moveSelection(delta: number): void {
    if (this.rows.length === 0) return;
    const next = (this.selected + delta + this.rows.length) % this.rows.length;
    const total = this.currentView().scroll.length;
    if (next < total) {
      const offset = scrollToShow(this.offset, next, this.visible, total);
      if (offset !== this.offset) {
        this.offset = offset;
        this.selected = next;
        this.renderChoices();
        GameAudio.hover();
        return;
      }
    }
    this.select(next);
  }

  private scrollBy(delta: number): void {
    const total = this.currentView().scroll.length;
    const offset = Phaser.Math.Clamp(this.offset + delta, 0, Math.max(0, total - this.visible));
    if (offset === this.offset) return;
    this.offset = offset;
    // Keep the selection on a row that's in view.
    if (this.selected < total) this.selected = Phaser.Math.Clamp(this.selected, offset, offset + this.visible - 1);
    this.renderChoices();
  }

  /** A number key: the reply with that number in the open list. */
  private choose(i: number): void {
    if (this.closing || this.typing || i >= this.rows.length || this.time.now < this.readyAt) return;
    this.pick(i);
  }

  private pick(at: number): void {
    if (this.closing || this.typing || this.time.now < this.readyAt) return;
    const row = this.rows[at];
    if (row === undefined) return;
    GameAudio.click();
    if (row === 'more' || row === 'back') {
      this.subFor = undefined;
      this.openView(row === 'more' ? 'sub' : 'top');
      return;
    }
    const choice = this.choices[row];
    this.subFor = this.view === 'sub' ? this.nodeId : undefined;
    HEARD.add(heardKey(this.node.speaker, choice));
    this.clearChoices();
    this.leaveNode();
    if (choice.action) this.runAction(choice.action);
    this.goTo(choice.next);
  }

  /** Esc / Backspace in the "Ask about…" list goes back up. */
  private back(): void {
    if (this.view === 'sub' && this.rows.length > 0 && !this.typing) {
      GameAudio.click();
      this.subFor = undefined;
      this.openView('top');
    }
  }

  private clearChoices(): void {
    this.choices = [];
    this.rows = [];
    this.menu = undefined;
    this.choiceButtons = [];
    this.choiceBox.removeAll(true);
    if (this.L) this.fitBox(this.L.h);
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    this.spoke.forEach((id) => Affiliations.markMet(id));
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
