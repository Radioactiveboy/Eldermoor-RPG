import { Display } from '../ui/Display';
import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { diaryStamp, QuestLog, QuestState } from '../systems/Quests';
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
/** The Map tab's leather, a weathered brown. */
const MAP_TAB = 0x7a5a2a;
const BODY_FONT = 'Merriweather, Georgia, "Times New Roman", serif';

type Section = 'tasks' | 'quests' | 'diary';

/** Draws one piece of a page (a heading, a quest, a diary entry) at the writer's current line. */
type Block = (page: PageWriter) => void;

interface Page {
  section: Section;
  draw: Block;
}

/** Something to set down in a section: pages break between blocks, never inside one. */
interface Piece {
  draw: Block;
  /** Remembers the page this piece lands on, so the quest list can point to it. */
  anchor?: string;
}

/** The lowest a page's writing may reach, leaving room for the page number and the corner arrows. */
const PAGE_BOTTOM = PAGE_H - 50;

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
      .text(PAGE_W / 2, this.y, text, {
        fontFamily: THEME.font,
        fontSize: '24px',
        color: RUBRIC,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: TEXT_W },
      })
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

  /**
   * A line in the quest list: a tick box, the quest's title, a faded note under it, and the page its
   * details are on at the right, like a book's table of contents. Clicking it turns to that page.
   */
  entry(title: string, note: string | undefined, done: boolean, pageNo: number | undefined, onClick?: () => void): void {
    const g = this.scene.add.graphics();
    const bx = MARGIN + 2;
    const by = this.y + 3;
    g.lineStyle(1.5, 0x3a2717, 0.9);
    g.strokeRect(bx, by, 13, 13);
    if (done) {
      g.lineStyle(2.5, 0x8e2f22, 1);
      g.beginPath();
      g.moveTo(bx + 2, by + 7);
      g.lineTo(bx + 5, by + 11);
      g.lineTo(bx + 14, by - 1);
      g.strokePath();
    }
    this.container.add(g);
    const color = done ? INK_FADED : INK;
    const top = this.y;
    const t = this.scene.add.text(MARGIN + 24, this.y, title, {
      fontFamily: BODY_FONT,
      fontSize: '15px',
      color,
      lineSpacing: 2,
      wordWrap: { width: TEXT_W - 24 - 30 },
    });
    this.container.add(t);
    this.y += t.height + 2;
    if (note) {
      const n = this.scene.add.text(MARGIN + 24, this.y, note, {
        fontFamily: BODY_FONT,
        fontSize: '12px',
        color: INK_FADED,
        fontStyle: 'italic',
        wordWrap: { width: TEXT_W - 24 - 30 },
      });
      this.container.add(n);
      this.y += n.height + 2;
    }
    if (pageNo !== undefined) {
      const num = this.scene.add
        .text(MARGIN + TEXT_W, top + 1, `${pageNo}`, { fontFamily: BODY_FONT, fontSize: '13px', color: INK_FADED, fontStyle: 'italic' })
        .setOrigin(1, 0);
      this.container.add(num);
    }
    if (onClick) {
      // The whole line is the link, so it's easy to hit on a phone.
      const hit = this.scene.add.zone(MARGIN - 4, top - 3, TEXT_W + 8, this.y - top + 6).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => t.setColor(RUBRIC));
      hit.on('pointerout', () => t.setColor(color));
      hit.on('pointerup', onClick);
      this.container.add(hit);
    }
    this.y += 7;
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
  /** The page each quest's own page starts on, for the quest list (see Piece.anchor). */
  private readonly anchors = new Map<string, number>();
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
      const local = this.book.getWorldTransformMatrix().applyInverse(Display.point(p).x, Display.point(p).y);
      if (Math.abs(local.x) > this.bookW / 2 + 80 || Math.abs(local.y) > BOOK_H / 2 + 40) this.close();
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.close());
    kb.on('keydown-J', () => this.close());
    kb.on('keydown-M', () => this.close('map'));
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
    this.anchors.clear();
    const active = QuestLog.active;
    // The quest list and the quests' own pages go: those under way, then those finished, newest first.
    const finished = QuestLog.all.filter((q) => q.completed).reverse();
    const anchor = (q: QuestState) => `quest:${q.def.id}`;

    // Tasks: the next step of every quest under way.
    const tasks: Piece[] = [
      {
        draw: (w) => {
          w.heading('Current Tasks');
          w.para(`Day ${game.clock.day}, ${game.clock.clockText}`, { italic: true, color: INK_FADED, size: 14 });
        },
      },
    ];
    if (active.length === 0) {
      tasks.push({
        draw: (w) => {
          if (QuestLog.all.length > 0) {
            w.para('Every errand done, for now. Mother is mending, and the shire is mine to wander.', { italic: true });
            return;
          }
          w.para('Nothing written here yet.', { italic: true });
          w.checkbox('Speak with Mother. She is resting by the hearth.', false);
        },
      });
    }
    for (const quest of active) {
      tasks.push({
        draw: (w) => {
          const step = QuestLog.current(quest);
          w.subheading(quest.def.title, RUBRIC);
          if (step) w.checkbox(step.text, false);
          w.space(6);
        },
      });
    }
    const mother = QuestLog.get('mother-medicine');
    if (mother && !mother.completed) {
      tasks.push({ draw: (w) => w.para('Mother is counting on me. I must not dawdle.', { italic: true, color: INK_FADED }) });
    }
    this.paginate(pages, 'tasks', tasks, 'Current Tasks, continued');

    // Quests: a contents list, one line a quest, each pointing to the quest's own page.
    const list: Piece[] = [{ draw: (w) => w.heading('Quests') }];
    if (QuestLog.all.length === 0) {
      list.push({ draw: (w) => w.para('No quests yet. Adventure has a way of finding people, though.', { italic: true }) });
    }
    const listed = (title: string, quests: readonly QuestState[], done: boolean) => {
      quests.forEach((q, i) => {
        const line: Block = (w) => {
          const page = this.anchors.get(anchor(q));
          w.entry(q.def.title, done ? undefined : `from ${q.def.giver}`, done, page === undefined ? undefined : page + 1, () => {
            const target = this.anchors.get(anchor(q));
            if (target !== undefined) this.goToPage(target);
          });
        };
        // A list's title always comes with its first quest, so it's never left alone at the foot of a page.
        list.push({
          draw:
            i > 0
              ? line
              : (w) => {
                  w.space(4);
                  w.subheading(`${title} (${quests.length})`, INK_FADED);
                  line(w);
                },
        });
      });
    };
    listed('In progress', active, false);
    listed('Completed', finished, true);
    if (QuestLog.all.length > 0) {
      const touch = this.sys.game.device.input.touch;
      list.push({
        draw: (w) => {
          w.space(4);
          w.para(`${touch ? 'Tap' : 'Click'} a quest to turn to its page.`, { italic: true, color: INK_FADED, size: 13 });
        },
      });
    }
    this.paginate(pages, 'quests', list, 'Quests, continued');

    // Each quest's own page: who asked, what it's about, and the steps so far.
    for (const quest of [...active, ...finished]) {
      const steps: Piece[] = [
        {
          anchor: anchor(quest),
          draw: (w) => {
            w.heading(quest.def.title);
            w.para(`Asked of me by ${quest.def.giver}, on day ${quest.day}.`, { italic: true, color: INK_FADED, size: 14 });
            w.para(quest.def.summary);
            w.space(4);
          },
        },
      ];
      for (const o of QuestLog.visibleObjectives(quest)) steps.push({ draw: (w) => w.checkbox(o.text, o.done) });
      this.paginate(pages, 'quests', steps, `${quest.def.title}, continued`);
    }

    // Diary entries, oldest first.
    const diary: Piece[] = [{ draw: (w) => w.heading('Diary') }];
    if (QuestLog.diary.length === 0) diary.push({ draw: (w) => w.para('The pages are blank.', { italic: true }) });
    for (const entry of QuestLog.diary) {
      diary.push({
        draw: (w) => {
          w.subheading(diaryStamp(entry), RUBRIC);
          w.para(entry.text, { italic: true });
          w.space(6);
        },
      });
    }
    this.paginate(pages, 'diary', diary);

    if (pages.length % 2 === 1) pages.push({ section: 'diary', draw: () => undefined });
    return pages;
  }

  /**
   * Sets a section's pieces down page by page, measuring each one as it is really drawn and starting a
   * new page whenever the next would run past the foot of this one. A page that carries on from the
   * one before opens with a faded note saying so.
   */
  private paginate(pages: Page[], section: Section, pieces: readonly Piece[], continued?: string): void {
    const note: Block | undefined = continued
      ? (w) => w.para(continued, { italic: true, color: INK_FADED, size: 13 })
      : undefined;
    let blocks: Block[] = [];
    let y = MARGIN;
    const flush = () => {
      const these = blocks;
      pages.push({ section, draw: (w) => these.forEach((b) => b(w)) });
    };
    for (const piece of pieces) {
      const h = this.measure(piece.draw);
      if (blocks.length > 0 && y + h > PAGE_BOTTOM) {
        flush();
        blocks = [];
        y = MARGIN;
        if (note) {
          blocks.push(note);
          y += this.measure(note);
        }
      }
      if (piece.anchor) this.anchors.set(piece.anchor, pages.length);
      blocks.push(piece.draw);
      y += h;
    }
    flush();
  }

  /** How far down the page a block reaches, found by drawing it off to one side and throwing it away. */
  private measure(block: Block): number {
    const scratch = this.add.container(-10000, -10000);
    const w = new PageWriter(this, scratch);
    w.y = 0;
    block(w);
    const h = w.y;
    scratch.destroy();
    return h;
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
    // On a single page it hangs down the outer margin, clear of the writing.
    const rx = single ? pageXs[0] + PAGE_W - 6 : 0;
    const ribbon = this.add.graphics();
    ribbon.fillStyle(0x9a2a2a, 1);
    ribbon.fillRect(rx - 4, -PAGE_H / 2 - 6, 8, PAGE_H + 40);
    ribbon.fillTriangle(rx - 4, hh + 18, rx + 4, hh + 18, rx, hh + 10);
    ribbon.fillStyle(0xc04040, 1);
    ribbon.fillRect(rx - 4, -PAGE_H / 2 - 6, 2, PAGE_H + 36);

    // The page that sweeps over when turning, hinged at the spine.
    this.flipper = this.add.graphics().setVisible(false).setPosition(single ? pageXs[0] : 0, 0);
    this.drawPage(this.flipper, single ? 0 : SPINE_GAP, 'right');

    // Section tabs: down the right edge of an open book, along the top of a single page. The last, Map, opens the world map.
    const tabDefs = [
      ...SECTIONS.map((sec) => ({ label: sec.label, color: sec.color, go: () => this.jumpTo(sec.id) })),
      { label: 'Map', color: MAP_TAB, go: () => this.close('map') },
    ];
    const tabs = tabDefs.map((tab, i) =>
      single
        ? this.makeTab(tab.label, tab.color, -hw + 56 + i * 88, -hh, 'top', tab.go)
        : this.makeTab(tab.label, tab.color, hw - 6, -hh + 70 + i * 52, 'side', tab.go),
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
      .text(0, hh + 26, touch ? 'Tap a page or the arrows to turn it' : 'Arrow keys or click to turn pages   ·   M for the map   ·   J or Esc to close', {
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
    if (index >= 0) this.goToPage(index);
  }

  /** Turns straight to the view that shows page `index`. */
  private goToPage(index: number): void {
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

  /** @param then 'map' to open the world map once the book has closed */
  private close(then?: 'map'): void {
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
        this.events.emit('journal-closed', then);
        this.scene.stop();
      },
    });
    this.tweens.add({ targets: this.dim, alpha: 0, duration: 180 });
  }
}
