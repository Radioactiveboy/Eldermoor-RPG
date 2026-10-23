import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { DiaryEntry, QuestLog, QuestState } from '../systems/Quests';
import { THEME } from '../ui/Widgets';
import type { GameScene } from './GameScene';

const PAGE_W = 344;
const PAGE_H = 470;
const SPINE_GAP = 6;
const COVER_PAD = 22;
const BOOK_H = PAGE_H + COVER_PAD * 2;
/** Below this screen width the journal shows one page at a time. */
const SINGLE_PAGE = 700;
const MARGIN = 28;
const TEXT_W = PAGE_W - MARGIN * 2;
const FLIP_MS = 380;

const INK = '#3a2717';
const INK_FADED = '#8a7458';
const RUBRIC = '#8e2f22';
const PARCHMENT = 0xefe1c0;
const PARCHMENT_EDGE = 0xd9c49a;
const BODY_FONT = 'Georgia, "Times New Roman", serif';

type Section = 'tasks' | 'quests' | 'diary';

interface Page {
  section: Section;
  draw: (page: PageWriter) => void;
}

const SECTIONS: Array<{ id: Section; label: string; color: number }> = [
  { id: 'tasks', label: 'Tasks', color: 0x8e2f22 },
  { id: 'quests', label: 'Quests', color: 0x2f5a3e },
  { id: 'diary', label: 'Diary', color: 0x2e4a72 },
];

/** Lays out text down a page, top to bottom. */
class PageWriter {
  y = MARGIN;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly container: Phaser.GameObjects.Container,
  ) {}

  heading(text: string): void {
    const t = this.scene.add
      .text(PAGE_W / 2, this.y, text, { fontFamily: THEME.font, fontSize: '24px', color: RUBRIC, fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    this.container.add(t);
    this.y += t.height + 4;
    this.flourish();
  }

  /** A small ornamental rule under headings. */
  flourish(): void {
    const g = this.scene.add.graphics();
    const cx = PAGE_W / 2;
    g.lineStyle(1, 0x8a7458, 0.8);
    g.lineBetween(cx - 70, this.y + 4, cx - 8, this.y + 4);
    g.lineBetween(cx + 8, this.y + 4, cx + 70, this.y + 4);
    g.fillStyle(0x8e2f22, 0.9);
    g.fillTriangle(cx, this.y, cx + 4, this.y + 4, cx, this.y + 8);
    g.fillTriangle(cx, this.y, cx - 4, this.y + 4, cx, this.y + 8);
    this.container.add(g);
    this.y += 20;
  }

  subheading(text: string, color = INK): void {
    const t = this.scene.add.text(MARGIN, this.y, text, {
      fontFamily: THEME.font,
      fontSize: '17px',
      color,
      fontStyle: 'bold',
      wordWrap: { width: TEXT_W },
    });
    this.container.add(t);
    this.y += t.height + 4;
  }

  para(text: string, opts: { color?: string; italic?: boolean; size?: number; indent?: number } = {}): Phaser.GameObjects.Text {
    const indent = opts.indent ?? 0;
    const t = this.scene.add.text(MARGIN + indent, this.y, text, {
      fontFamily: BODY_FONT,
      fontSize: `${opts.size ?? 16}px`,
      color: opts.color ?? INK,
      fontStyle: opts.italic ? 'italic' : 'normal',
      lineSpacing: 4,
      wordWrap: { width: TEXT_W - indent },
    });
    this.container.add(t);
    this.y += t.height + 8;
    return t;
  }

  /** A hand-drawn tick box with a line of text beside it. Done items are ticked and faded. */
  checkbox(text: string, done: boolean): void {
    const g = this.scene.add.graphics();
    const bx = MARGIN + 2;
    const by = this.y + 3;
    g.lineStyle(1.5, 0x3a2717, 0.9);
    g.strokeRect(bx, by, 13, 13);
    this.container.add(g);
    const t = this.para(text, { indent: 24, color: done ? INK_FADED : INK });
    if (done) {
      g.lineStyle(2.5, 0x8e2f22, 1);
      g.beginPath();
      g.moveTo(bx + 2, by + 7);
      g.lineTo(bx + 5, by + 11);
      g.lineTo(bx + 14, by - 1);
      g.strokePath();
      // Struck through, like crossing it off.
      g.lineStyle(1, 0x8a7458, 0.9);
      g.lineBetween(t.x, t.y + 10, t.x + Math.min(t.width, TEXT_W - 24), t.y + 10);
    }
  }

  space(px: number): void {
    this.y += px;
  }
}

/**
 * The hero's journal: a leather-bound book with Tasks (what to do next),
 * Quests (each quest's story and steps) and Diary sections. Opens with J or
 * the HUD's book button; pages turn with the arrow keys, the corner arrows,
 * the side tabs, or by clicking a page. On phones it shows one page at a time.
 */
export class JournalScene extends Phaser.Scene {
  private book!: Phaser.GameObjects.Container;
  private dim!: Phaser.GameObjects.Rectangle;
  /** Page containers in view: two for an open spread, one on phones. */
  private views: Phaser.GameObjects.Container[] = [];
  private flipper!: Phaser.GameObjects.Graphics;
  private prevArrow!: Phaser.GameObjects.Text;
  private nextArrow!: Phaser.GameObjects.Text;
  private pages: Page[] = [];
  /** Index of the first page in view. */
  private first = 0;
  private single = false;
  private bookW = 0;
  private flipping = false;
  private closing = false;

  constructor() {
    super('Journal');
  }

  create(): void {
    this.closing = false;
    this.flipping = false;
    this.pages = this.buildPages();
    this.first = 0;

    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.55).setOrigin(0).setInteractive();
    this.dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      // Clicking outside the book closes it.
      const local = this.book.getWorldTransformMatrix().applyInverse(p.x, p.y);
      if (Math.abs(local.x) > this.bookW / 2 + 80 || Math.abs(local.y) > BOOK_H / 2 + 40) this.close();
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.close());
    kb.on('keydown-J', () => this.close());
    kb.on('keydown-RIGHT', () => this.turn(1));
    kb.on('keydown-D', () => this.turn(1));
    kb.on('keydown-LEFT', () => this.turn(-1));
    kb.on('keydown-A', () => this.turn(-1));

    this.single = this.scale.width < SINGLE_PAGE;
    this.buildBook();
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));

    GameAudio.bookOpen();
    const target = this.book.scale;
    this.book.setScale(target * 0.85).setAlpha(0);
    this.tweens.add({ targets: this.book, scale: target, alpha: 1, duration: 260, ease: 'Back.easeOut' });
  }

  private get perView(): number {
    return this.single ? 1 : 2;
  }

  // ------------------------------------------------------------ contents

  private buildPages(): Page[] {
    const game = this.scene.get('Game') as GameScene;
    const pages: Page[] = [];
    const active = QuestLog.active;

    pages.push({
      section: 'tasks',
      draw: (w) => {
        w.heading('Current Tasks');
        w.para(`Day ${game.clock.day}, ${game.clock.clockText}`, { italic: true, color: INK_FADED, size: 14 });
        if (active.length === 0) {
          w.para('Nothing written here yet.', { italic: true });
          w.checkbox('Speak with Mother. She is resting by the hearth.', false);
          return;
        }
        for (const quest of active) {
          const step = QuestLog.current(quest);
          w.subheading(quest.def.title, RUBRIC);
          if (step) w.checkbox(step.text, false);
          w.space(6);
        }
        if (QuestLog.get('mother-medicine') && !QuestLog.get('mother-medicine')!.completed) {
          w.space(10);
          w.para('Mother is counting on me. I must not dawdle.', { italic: true, color: INK_FADED });
        }
      },
    });

    pages.push({
      section: 'quests',
      draw: (w) => {
        w.heading('Quests');
        const all = QuestLog.all;
        if (all.length === 0) {
          w.para('No quests yet. Adventure has a way of finding people, though.', { italic: true });
          return;
        }
        const list = (title: string, quests: readonly QuestState[], done: boolean) => {
          if (quests.length === 0) return;
          w.subheading(title, INK_FADED);
          for (const q of quests) {
            w.checkbox(`${q.def.title}  (from ${q.def.giver})`, done);
          }
          w.space(8);
        };
        list('In progress', all.filter((q) => !q.completed), false);
        list('Completed', all.filter((q) => q.completed), true);
        w.para('Turn the page for the details of each.', { italic: true, color: INK_FADED, size: 14 });
      },
    });

    for (const quest of QuestLog.all) {
      pages.push({
        section: 'quests',
        draw: (w) => {
          w.heading(quest.def.title);
          w.para(`Asked of me by ${quest.def.giver}, on day ${quest.day}.`, { italic: true, color: INK_FADED, size: 14 });
          w.para(quest.def.summary);
          w.space(4);
          for (const o of QuestLog.visibleObjectives(quest)) w.checkbox(o.text, o.done);
        },
      });
    }

    // Diary entries, oldest first, packed onto as many pages as they need.
    const groups: Array<readonly DiaryEntry[]> = [];
    let rest = QuestLog.diary;
    do {
      const n = Math.max(1, this.entriesThatFit(rest, groups.length === 0));
      groups.push(rest.slice(0, n));
      rest = rest.slice(n);
    } while (rest.length > 0);
    groups.forEach((group, i) => {
      pages.push({
        section: 'diary',
        draw: (w) => {
          if (i === 0) w.heading('Diary');
          if (group.length === 0) w.para('The pages are blank.', { italic: true });
          for (const entry of group) {
            w.subheading(`Day ${entry.day}`, RUBRIC);
            w.para(entry.text, { italic: true });
            w.space(6);
          }
        },
      });
    });

    if (pages.length % 2 === 1) pages.push({ section: 'diary', draw: () => undefined });
    return pages;
  }

  /** How many diary entries fit on one page, going by a rough estimate of their height. */
  private entriesThatFit(entries: readonly DiaryEntry[], first: boolean): number {
    let room = PAGE_H - MARGIN * 2 - 24 - (first ? 56 : 0);
    let n = 0;
    for (const e of entries) {
      const needed = 30 + Math.ceil(e.text.length / 36) * 22 + 14;
      if (n > 0 && needed > room) break;
      room -= needed;
      n++;
    }
    return n;
  }

  // ------------------------------------------------------------ the book itself

  private buildBook(): void {
    this.book?.destroy();
    const single = this.single;
    const pagesW = single ? PAGE_W : (PAGE_W + SPINE_GAP) * 2;
    this.bookW = pagesW + COVER_PAD * 2 + (single ? 10 : 0);
    const hw = this.bookW / 2;
    const hh = BOOK_H / 2;
    // Left edge of each visible page. On one page, the binding is down its left side.
    const pageXs = single ? [-PAGE_W / 2 + 5] : [-PAGE_W - SPINE_GAP, SPINE_GAP];

    const g = this.add.graphics();
    // Shadow, leather cover, stitching and gold corners.
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(-hw + 6, -hh + 10, this.bookW, BOOK_H, 18);
    g.fillStyle(0x4a2a1a, 1);
    g.fillRoundedRect(-hw, -hh, this.bookW, BOOK_H, 18);
    g.fillStyle(0x5e3622, 1);
    g.fillRoundedRect(-hw + 4, -hh + 4, this.bookW - 8, BOOK_H - 8, 15);
    g.lineStyle(1, 0xc9a14a, 0.55);
    for (let x = -hw + 12; x < hw - 12; x += 8) {
      g.lineBetween(x, -hh + 10, x + 4, -hh + 10);
      g.lineBetween(x, hh - 10, x + 4, hh - 10);
    }
    g.fillStyle(0xc9a14a, 1);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = sx * (hw - 4);
      const cy = sy * (hh - 4);
      g.fillTriangle(cx, cy, cx - sx * 28, cy, cx, cy - sy * 28);
    }

    // Page block: stacked page edges, then the open page(s).
    pageXs.forEach((px, i) => {
      const outward = single || i === 1 ? 1 : -1;
      for (let k = 4; k >= 1; k--) {
        g.fillStyle(k % 2 ? 0xcdb98e : 0xe3d3ae, 1);
        g.fillRect(px + outward * k * 1.5, -PAGE_H / 2 + k, PAGE_W, PAGE_H);
      }
      this.drawPage(g, px, single || i === 1 ? 'right' : 'left');
    });
    // Shadow where the pages meet the spine.
    const spineX = single ? pageXs[0] : 0;
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.35, 0, 0.35, 0);
    g.fillRect(spineX + (single ? 0 : SPINE_GAP), -PAGE_H / 2, 24, PAGE_H);
    if (!single) {
      g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.35, 0, 0.35);
      g.fillRect(-SPINE_GAP - 24, -PAGE_H / 2, 24, PAGE_H);
    }
    g.fillStyle(0x3a2014, 1);
    g.fillRect(single ? spineX - 10 : -SPINE_GAP, -PAGE_H / 2 - 4, single ? 10 : SPINE_GAP * 2, PAGE_H + 8);

    this.views = pageXs.map((px) => this.add.container(px, -PAGE_H / 2));

    // Ribbon bookmark hanging out of the bottom.
    const rx = single ? pageXs[0] + PAGE_W - 52 : 0;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x9a2a2a, 1);
    ribbon.fillRect(rx - 4, -PAGE_H / 2 - 6, 8, PAGE_H + 40);
    ribbon.fillTriangle(rx - 4, hh + 18, rx + 4, hh + 18, rx, hh + 10);
    ribbon.fillStyle(0xc04040, 1);
    ribbon.fillRect(rx - 4, -PAGE_H / 2 - 6, 2, PAGE_H + 36);

    // The page that sweeps over when turning, hinged at the spine.
    this.flipper = this.add.graphics().setVisible(false).setPosition(single ? pageXs[0] : 0, 0);
    this.drawPage(this.flipper, single ? 0 : SPINE_GAP, 'right');

    // Section tabs: down the right edge of an open book, along the top of a single page.
    const tabs = SECTIONS.map((sec, i) =>
      single
        ? this.makeTab(sec.label, sec.color, -hw + 70 + i * 104, -hh, 'top', () => this.jumpTo(sec.id))
        : this.makeTab(sec.label, sec.color, hw - 6, -hh + 70 + i * 52, 'side', () => this.jumpTo(sec.id)),
    );

    const arrowStyle = { fontFamily: THEME.font, fontSize: '30px', color: '#8e2f22' };
    const lastX = pageXs[pageXs.length - 1] + PAGE_W;
    this.prevArrow = this.add.text(pageXs[0] + 22, PAGE_H / 2 - 16, '◂', arrowStyle).setOrigin(0.5, 1);
    this.nextArrow = this.add.text(lastX - 22, PAGE_H / 2 - 16, '▸', arrowStyle).setOrigin(0.5, 1);
    for (const [arrow, dir] of [[this.prevArrow, -1], [this.nextArrow, 1]] as const) {
      arrow.setPadding(12).setInteractive({ useHandCursor: true });
      arrow.on('pointerup', () => this.turn(dir));
      arrow.on('pointerover', () => arrow.setScale(1.2));
      arrow.on('pointerout', () => arrow.setScale(1));
    }

    // Clicking the left half of the book turns back, the right half forwards.
    const left = pageXs[0];
    const span = lastX - left;
    const backHit = this.add.zone(left + span / 4, 0, span / 2, PAGE_H).setInteractive();
    const fwdHit = this.add.zone(left + (span * 3) / 4, 0, span / 2, PAGE_H).setInteractive();
    backHit.on('pointerup', () => this.turn(-1));
    fwdHit.on('pointerup', () => this.turn(1));

    const close = this.add
      .text(hw - 4, -hh + 4, '✕', { fontFamily: BODY_FONT, fontSize: '22px', color: '#f3e2b3', backgroundColor: '#3a2014' })
      .setPadding(8, 3, 8, 5)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.close());

    const touch = this.sys.game.device.input.touch;
    const hint = this.add
      .text(0, hh + 26, touch ? 'Tap a page or the arrows to turn it' : 'Arrow keys or click to turn pages   ·   J or Esc to close', {
        fontFamily: BODY_FONT,
        fontSize: '14px',
        color: THEME.dimText,
      })
      .setOrigin(0.5, 0);

    this.book = this.add.container(0, 0, [
      ...tabs.map((t) => t.back),
      g,
      backHit,
      fwdHit,
      ...this.views,
      ribbon,
      this.flipper,
      ...tabs.map((t) => t.front),
      this.prevArrow,
      this.nextArrow,
      close,
      hint,
    ]);
    this.showPages();
  }

  /** Parchment page, darker towards the spine. */
  private drawPage(g: Phaser.GameObjects.Graphics, x: number, side: 'left' | 'right'): void {
    const [a, b] = side === 'left' ? [PARCHMENT, PARCHMENT_EDGE] : [PARCHMENT_EDGE, PARCHMENT];
    g.fillGradientStyle(a, b, a, b, 1);
    g.fillRect(x, -PAGE_H / 2, PAGE_W, PAGE_H);
    g.lineStyle(1, 0xb9a47a, 0.6);
    g.strokeRect(x + 10, -PAGE_H / 2 + 10, PAGE_W - 20, PAGE_H - 20);
  }

  /** A leather tab: its body tucks behind the cover and its label sticks out past the edge. */
  private makeTab(label: string, color: number, x: number, y: number, edge: 'side' | 'top', onClick: () => void) {
    const back = this.add.graphics();
    back.fillStyle(color, 1);
    let tx: number;
    let ty: number;
    if (edge === 'side') {
      back.fillRoundedRect(x - 20, y - 18, 96, 36, 8);
      tx = x + 40;
      ty = y - 1;
    } else {
      back.fillRoundedRect(x - 46, y - 34, 92, 52, 8);
      tx = x;
      ty = y - 17;
    }
    const front = this.add
      .text(tx, ty, label, { fontFamily: THEME.font, fontSize: '14px', color: '#f3e2b3', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setPadding(10, 8, 10, 8)
      .setInteractive({ useHandCursor: true });
    front.on('pointerup', onClick);
    front.on('pointerover', () => front.setColor(THEME.goldText));
    front.on('pointerout', () => front.setColor('#f3e2b3'));
    return { back, front };
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.dim.input!.hitArea.setSize(width, height);
    const single = width < SINGLE_PAGE;
    if (single !== this.single) {
      this.single = single;
      // Keep the same page in view when switching between one and two pages.
      this.first = single ? this.first : this.first - (this.first % 2);
      this.buildBook();
    }
    // Room for the side tabs (or top tabs) and the hint underneath.
    const extraW = single ? 16 : 150;
    const extraH = single ? 110 : 60;
    const scale = Math.min(1.25, (width - 12) / (this.bookW + extraW), (height - 16) / (BOOK_H + extraH));
    const offsetX = single ? 0 : -30 * scale;
    const offsetY = single ? 12 * scale : -14 * scale;
    this.book.setPosition(width / 2 + offsetX, height / 2 + offsetY).setScale(scale);
  }

  // ------------------------------------------------------------ turning

  private fillPage(container: Phaser.GameObjects.Container, index: number): void {
    container.removeAll(true);
    const page = this.pages[index];
    if (!page) return;
    const writer = new PageWriter(this, container);
    page.draw(writer);
    const num = this.add
      .text(PAGE_W / 2, PAGE_H - 24, `${index + 1}`, { fontFamily: BODY_FONT, fontSize: '13px', color: INK_FADED })
      .setOrigin(0.5);
    container.add(num);
  }

  private showPages(): void {
    this.views.forEach((v, i) => this.fillPage(v, this.first + i));
    this.updateArrows();
  }

  private updateArrows(): void {
    this.prevArrow.setVisible(this.first > 0);
    this.nextArrow.setVisible(this.first + this.perView < this.pages.length);
  }

  private jumpTo(section: Section): void {
    const index = this.pages.findIndex((p) => p.section === section);
    if (index < 0) return;
    const target = index - (index % this.perView);
    if (target !== this.first) this.turn((target - this.first) / this.perView);
  }

  /**
   * Turn `delta` views forwards (positive) or back. A blank page sweeps over
   * on its hinge; the side it uncovers is filled in first, the side it lands
   * on at the halfway point, so the new pages appear as the page settles.
   */
  private turn(delta: number): void {
    if (this.flipping || this.closing || delta === 0) return;
    const last = Math.max(0, Math.ceil(this.pages.length / this.perView) - 1) * this.perView;
    const target = Phaser.Math.Clamp(this.first + delta * this.perView, 0, last);
    if (target === this.first) return;
    const forward = target > this.first;
    this.first = target;
    this.flipping = true;
    GameAudio.pageTurn();
    this.prevArrow.setVisible(false);
    this.nextArrow.setVisible(false);

    if (this.single) {
      // One page: forwards, the old page lifts off the new one; backwards, the old page is laid back down.
      if (forward) this.fillPage(this.views[0], target);
      this.flipper.setVisible(true).setScale(forward ? 1 : 0, 1);
      this.tweens.add({
        targets: this.flipper,
        scaleX: forward ? 0 : 1,
        duration: FLIP_MS,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (!forward) this.fillPage(this.views[0], target);
          this.flipper.setVisible(false);
          this.flipping = false;
          this.updateArrows();
        },
      });
      return;
    }

    const [uncovered, landing] = forward ? [this.views[1], this.views[0]] : [this.views[0], this.views[1]];
    this.fillPage(uncovered, target + (forward ? 1 : 0));
    this.flipper.setVisible(true).setScale(forward ? 1 : -1, 1);
    let swapped = false;
    this.tweens.addCounter({
      from: forward ? 1 : -1,
      to: forward ? -1 : 1,
      duration: FLIP_MS,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        // A page rises a little as it turns, so it looks curved rather than flat.
        this.flipper.setScale(v, 1 + (1 - Math.abs(v)) * 0.03);
        if (!swapped && (forward ? v < 0 : v > 0)) {
          swapped = true;
          this.fillPage(landing, target + (forward ? 0 : 1));
        }
      },
      onComplete: () => {
        this.flipper.setVisible(false);
        this.flipping = false;
        this.updateArrows();
      },
    });
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    GameAudio.bookClose();
    this.tweens.add({
      targets: this.book,
      scale: this.book.scale * 0.9,
      alpha: 0,
      duration: 180,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.events.emit('journal-closed');
        this.scene.stop();
      },
    });
    this.tweens.add({ targets: this.dim, alpha: 0, duration: 180 });
  }
}
