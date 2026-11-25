import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { Display } from '../ui/Display';
import { THEME } from '../ui/Widgets';
import type { ReadingStyle } from '../world/MapData';

export interface ReaderSceneData {
  heading: string;
  lines: string[];
  style: Exclude<ReadingStyle, 'post'>;
}

const SERIF = 'Merriweather, Georgia, "Times New Roman", serif';
/** The widest the sheet gets, and the gap kept round it on a small screen. */
const MAX_W = 640;
const EDGE = 12;
const HEAD_H = 62;
const FOOT_H = 54;
const SCROLL_STEP = 48;

/** How each kind of thing is drawn: its ground, its frame, and the colour of its writing. */
interface Look {
  /** Inner padding, either side of the writing. */
  pad: number;
  heading: string;
  ink: string;
  /** Lines that describe rather than quote (the hero's own words): fainter, in italics. */
  aside: string;
}

const LOOKS: Record<ReaderSceneData['style'], Look> = {
  notices: { pad: 30, heading: THEME.goldText, ink: '#2b2130', aside: '#3d4f78' },
  book: { pad: 34, heading: '#8e2f22', ink: '#3a2717', aside: '#7a6448' },
  slate: { pad: 32, heading: '#f1efe6', ink: '#ecebe2', aside: '#b9c2bd' },
  stone: { pad: 34, heading: '#2e2a26', ink: '#2e2a26', aside: '#4e4842' },
};

/** Slips of paper on a board: a few shades, so they aren't all cut from one sheet. */
const PAPERS = [0xeadfbe, 0xe2d4ae, 0xeee4c8, 0xe6d8b4, 0xdfd0a8];

/** A note "in another hand", written under the one before it: "(Underneath: ...)". */
const isAside = (line: string) => line.startsWith('(');
/** In a book, the words actually written there are quoted; the rest is the hero describing it. */
const isQuoted = (line: string) => /^["“]/.test(line);

/**
 * Something written, close up, to read at the player's own pace: a notice
 * board's slips (the Crooked Tankard's, the Black Rose's, Gloomhaven's), a
 * book or log (the beacon's, the watchtower's), a chalked slate, or words cut
 * in stone. It opens over the world on its own sheet, scrolls if there is more
 * than fits (wheel, drag, the arrow keys), and stays until closed: the ✕, the
 * Close button, Esc or E, or a click outside it.
 */
export class ReaderScene extends Phaser.Scene {
  private data_!: ReaderSceneData;
  private dim!: Phaser.GameObjects.Rectangle;
  /** Everything but the dimming, rebuilt when the screen changes size. */
  private sheet?: Phaser.GameObjects.Container;
  private body?: Phaser.GameObjects.Container;
  private maskShape?: Phaser.GameObjects.Graphics;
  private bar?: Phaser.GameObjects.Graphics;
  private more?: Phaser.GameObjects.Text;
  private view = { x: 0, y: 0, w: 0, h: 0 };
  private contentH = 0;
  private scroll = 0;
  private drag?: { y: number; scroll: number; moved: boolean };
  /** Where a press began, so a drag that wanders off the sheet doesn't count as a click outside it. */
  private pressedOutside = false;
  private closing = false;

  constructor() {
    super('Reader');
  }

  create(data: ReaderSceneData): void {
    this.data_ = data;
    this.scroll = 0;
    this.closing = false;
    this.drag = undefined;
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.62).setOrigin(0).setInteractive();
    this.dim.on('pointerdown', () => (this.pressedOutside = true));
    this.dim.on('pointerup', () => {
      if (this.pressedOutside && !this.drag?.moved) this.close();
      this.pressedOutside = false;
    });

    const kb = this.input.keyboard!;
    for (const k of ['ESC', 'E', 'ENTER', 'SPACE']) kb.on(`keydown-${k}`, () => this.close());
    for (const k of ['UP', 'W']) kb.on(`keydown-${k}`, () => this.scrollTo(this.scroll - SCROLL_STEP));
    for (const k of ['DOWN', 'S']) kb.on(`keydown-${k}`, () => this.scrollTo(this.scroll + SCROLL_STEP));
    kb.on('keydown-PAGE_UP', () => this.scrollTo(this.scroll - this.view.h * 0.85));
    kb.on('keydown-PAGE_DOWN', () => this.scrollTo(this.scroll + this.view.h * 0.85));
    kb.on('keydown-HOME', () => this.scrollTo(0));
    kb.on('keydown-END', () => this.scrollTo(Infinity));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollTo(this.scroll + dy * 0.6));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return;
      const y = Display.point(p).y;
      if (Math.abs(y - this.drag.y) > 6) this.drag.moved = true;
      if (this.drag.moved) this.scrollTo(this.drag.scroll - (y - this.drag.y));
    });
    this.input.on('pointerup', () => this.time.delayedCall(0, () => (this.drag = undefined)));

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.layout, this);
      this.maskShape?.destroy();
    });

    GameAudio.pageTurn();
    this.sheet!.setAlpha(0);
    this.tweens.add({ targets: this.sheet, alpha: 1, duration: 200, ease: 'Sine.easeOut' });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.dim.input!.hitArea.setSize(width, height);
    this.build(width, height);
  }

  // ------------------------------------------------------------ building the sheet

  private build(screenW: number, screenH: number): void {
    const keepAlpha = this.sheet?.alpha ?? 1;
    this.sheet?.destroy();
    this.maskShape?.destroy();
    const { style, heading, lines } = this.data_;
    const look = LOOKS[style];
    const w = Math.min(MAX_W, screenW - EDGE * 2);
    const pad = w < 420 ? Math.round(look.pad * 0.6) : look.pad;
    const innerW = w - pad * 2;

    // The writing first, so the sheet can be sized to it.
    const body = this.add.container(0, 0);
    this.contentH = this.writeBody(body, style, lines, innerW, look);
    const maxView = screenH - EDGE * 2 - HEAD_H - FOOT_H;
    const viewH = Math.max(80, Math.min(this.contentH, maxView));
    const h = HEAD_H + viewH + FOOT_H;
    const cx = Math.round(screenW / 2);
    const top = Math.round((screenH - h) / 2);

    const sheet = this.add.container(cx, top);
    // Swallow presses on the sheet, so only those outside it close it; a press here starts a drag.
    const blocker = this.add.rectangle(0, h / 2, w, h, 0, 0).setInteractive();
    blocker.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pressedOutside = false;
      this.drag = { y: Display.point(p).y, scroll: this.scroll, moved: false };
    });
    sheet.add([blocker, this.drawGround(style, w, h)]);

    const title = this.add
      .text(0, HEAD_H / 2 + 4, heading, {
        fontFamily: THEME.font,
        fontSize: w < 420 ? '19px' : '23px',
        fontStyle: 'bold',
        color: look.heading,
        align: 'center',
        wordWrap: { width: w - 110 },
        ...(style === 'stone' ? { shadow: { offsetX: 0, offsetY: 1, color: '#c9c3b8', blur: 0, fill: true } } : {}),
        ...(style === 'notices' ? { stroke: '#2a1a08', strokeThickness: 3 } : {}),
      })
      .setOrigin(0.5);
    if (title.height > HEAD_H - 10) title.setFontSize(w < 420 ? 16 : 19);
    sheet.add(title);

    // The ✕ in the corner.
    const xColor = style === 'book' || style === 'stone' ? look.ink : THEME.text;
    const x = this.add
      .text(w / 2 - 24, 24, '✕', { fontFamily: SERIF, fontSize: '22px', color: xColor })
      .setOrigin(0.5)
      .setPadding(8)
      .setInteractive({ useHandCursor: true });
    x.on('pointerup', () => this.close());
    sheet.add(x);

    // The writing, clipped to its window.
    this.view = { x: cx - w / 2 + 4, y: top + HEAD_H, w: w - 8, h: viewH };
    body.setPosition(0, HEAD_H);
    sheet.add(body);
    this.body = body;
    this.maskShape = this.make.graphics({}, false).fillRect(this.view.x, this.view.y, this.view.w, this.view.h);
    body.setMask(this.maskShape.createGeometryMask());

    // A thin bar showing how far down the page is, and a nudge that there's more.
    this.bar = this.add.graphics();
    sheet.add(this.bar);
    this.more = this.add
      .text(w / 2 - 22, h - FOOT_H / 2 - 2, '▼ more', { fontFamily: SERIF, fontSize: '13px', fontStyle: 'italic', color: style === 'notices' ? THEME.dimText : look.aside })
      .setOrigin(1, 0.5);
    sheet.add(this.more);

    // Along the foot: how to put it down.
    sheet.add(this.closeButton(style, 0, h - FOOT_H / 2 - 2));
    sheet.setAlpha(keepAlpha);
    this.sheet = sheet;
    this.scrollTo(this.scroll);
  }

  /** Lays the lines out for this kind of thing; returns how tall they came to. */
  private writeBody(body: Phaser.GameObjects.Container, style: ReaderSceneData['style'], lines: string[], innerW: number, look: Look): number {
    const small = innerW < 360;
    const size = (n: number) => `${small ? n - 1 : n}px`;
    if (style === 'notices') return this.writeNotices(body, lines, innerW, look, size);
    let y = 10;
    const centred = style === 'stone';
    const x = centred ? 0 : -innerW / 2;
    for (const line of lines) {
      if (!line) {
        y += 12;
        continue;
      }
      const aside = style === 'book' ? !isQuoted(line) : isAside(line);
      const t = this.add.text(x, y, line, {
        fontFamily: style === 'stone' && !aside ? THEME.font : SERIF,
        fontSize: style === 'stone' && !aside ? size(19) : aside ? size(15) : size(17),
        fontStyle: aside ? 'italic' : style === 'stone' ? 'bold' : 'normal',
        color: aside ? look.aside : look.ink,
        align: centred ? 'center' : 'left',
        lineSpacing: 5,
        wordWrap: { width: innerW },
        ...(style === 'stone' ? { shadow: { offsetX: 0, offsetY: 1, color: '#cfc9be', blur: 0, fill: true } } : {}),
      });
      if (centred) t.setOrigin(0.5, 0);
      if (style === 'slate') t.setAlpha(aside ? 0.85 : 0.95);
      body.add(t);
      y += t.height + (style === 'book' ? 14 : 10);
    }
    return y + 8;
  }

  /** A board: each notice on its own slip of paper, pinned up a little askew; "(Underneath...)" lines are scrawled on the slip above. */
  private writeNotices(body: Phaser.GameObjects.Container, lines: string[], innerW: number, look: Look, size: (n: number) => string): number {
    const slips: Array<{ text: string; asides: string[] }> = [];
    for (const line of lines) {
      if (!line) continue;
      const last = slips[slips.length - 1];
      if (isAside(line) && last) last.asides.push(line);
      else slips.push({ text: line, asides: [] });
    }
    let y = 14;
    slips.forEach((slip, i) => {
      const slipW = innerW - (i % 3) * 14;
      const textW = slipW - 36;
      const parts: Phaser.GameObjects.GameObject[] = [];
      const main = this.add.text(-slipW / 2 + 18, 18, slip.text, {
        fontFamily: SERIF, fontSize: size(16), color: look.ink, lineSpacing: 4, wordWrap: { width: textW },
      });
      let sh = 18 + main.height;
      parts.push(main);
      for (const a of slip.asides) {
        const t = this.add.text(-slipW / 2 + 30, sh + 8, a, {
          fontFamily: SERIF, fontSize: size(15), fontStyle: 'italic', color: look.aside, lineSpacing: 3, wordWrap: { width: textW - 12 },
        });
        t.setAngle(-1.2);
        parts.push(t);
        sh += 8 + t.height;
      }
      sh += 16;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.28).fillRect(-slipW / 2 + 4, 5, slipW, sh);
      g.fillStyle(PAPERS[i % PAPERS.length]).fillRect(-slipW / 2, 0, slipW, sh);
      g.lineStyle(1, 0x9a8460, 0.5).strokeRect(-slipW / 2, 0, slipW, sh);
      // A folded-down corner on some, and the pin (or nail) through the top.
      if (i % 2 === 1) g.fillStyle(0xc7b48a).fillTriangle(slipW / 2 - 16, 0, slipW / 2, 0, slipW / 2, 16);
      g.fillStyle(0x5a1612).fillCircle(0, 7, 5);
      g.fillStyle(0xd0504a).fillCircle(-1.5, 5.5, 2);
      const offset = ((i * 37) % 3 - 1) * 7;
      const card = this.add.container(offset, y, [g, ...parts]);
      card.setAngle(((i * 53) % 5 - 2) * 0.55);
      body.add(card);
      y += sh + 16;
    });
    return y;
  }

  /** The thing itself: board, parchment, slate or stone, sized w by h with its top edge at y = 0. */
  private drawGround(style: ReaderSceneData['style'], w: number, h: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const l = -w / 2;
    g.fillStyle(0x000000, 0.45).fillRoundedRect(l + 6, 10, w, h, 10);
    if (style === 'notices') {
      // Planks across, in a dark frame, with the heading on a plaque.
      const browns = [0x6b4a30, 0x73502f, 0x654428, 0x6f4c2e, 0x684830];
      const ph = 46;
      for (let y = 0, i = 0; y < h; y += ph, i++) {
        g.fillStyle(browns[i % browns.length]).fillRect(l, y, w, Math.min(ph, h - y));
        g.lineStyle(1, 0x4a3020, 0.5);
        for (let k = 0; k < 3; k++) g.lineBetween(l + 6, y + ph * (0.25 + k * 0.25), l + w - 6, y + ph * (0.25 + k * 0.25) + Math.sin(i + k) * 3);
        g.fillStyle(0x3a2616).fillRect(l, y + ph - 2, w, 2);
      }
      g.lineStyle(10, 0x4a3020).strokeRect(l + 5, 5, w - 10, h - 10);
      g.lineStyle(2, 0x87603d, 0.8).strokeRect(l, 0, w, h);
      g.fillStyle(0x3a2616).fillRoundedRect(-Math.min(220, w / 2 - 40), 12, Math.min(440, w - 80), HEAD_H - 16, 8);
      g.lineStyle(2, THEME.gold, 0.7).strokeRoundedRect(-Math.min(220, w / 2 - 40), 12, Math.min(440, w - 80), HEAD_H - 16, 8);
    } else if (style === 'book') {
      // A page of the ledger: parchment, darker at the edges, a rubric line under the heading.
      g.fillStyle(0xd9c49a).fillRoundedRect(l, 0, w, h, 6);
      g.fillStyle(0xefe1c0).fillRoundedRect(l + 6, 6, w - 12, h - 12, 4);
      g.fillStyle(0xe6d5ad, 0.6).fillRect(l + 6, 6, 14, h - 12);
      g.lineStyle(1, 0x8e2f22, 0.5).lineBetween(l + 40, HEAD_H - 4, -l - 40, HEAD_H - 4);
      g.lineStyle(1, 0x8e2f22, 0.25).lineBetween(l + 24, 10, l + 24, h - 10);
      g.lineStyle(2, 0x7a5a2a, 0.9).strokeRoundedRect(l, 0, w, h, 6);
    } else if (style === 'slate') {
      // A slate in a wooden frame, smudged where it's been rubbed out.
      g.fillStyle(0x6b4a30).fillRoundedRect(l, 0, w, h, 8);
      g.fillStyle(0x2f3735).fillRect(l + 14, 14, w - 28, h - 28);
      g.fillStyle(0x47504d, 0.35).fillEllipse(l + w * 0.3, h * 0.4, w * 0.4, 60).fillEllipse(l + w * 0.75, h * 0.7, w * 0.3, 50);
      g.lineStyle(2, 0x3a2616).strokeRect(l + 14, 14, w - 28, h - 28);
      g.lineStyle(2, 0x87603d, 0.8).strokeRoundedRect(l, 0, w, h, 8);
      g.fillStyle(0xe8e6dc, 0.9).fillRect(l + w - 70, h - 10, 22, 5);
    } else {
      // A slab of grey stone, bevelled, with lichen in a corner.
      g.fillStyle(0x6e6a64).fillRoundedRect(l, 0, w, h, 14);
      g.fillStyle(0x9a958c).fillRoundedRect(l + 8, 8, w - 16, h - 16, 10);
      g.fillStyle(0xa8a398, 0.6).fillRoundedRect(l + 8, 8, w - 16, 14, 8);
      g.fillStyle(0x7d8a5a, 0.5).fillCircle(l + 22, h - 22, 10).fillCircle(l + 36, h - 16, 6).fillCircle(-l - 60, h - 20, 7);
      g.lineStyle(2, 0x4e4a44).strokeRoundedRect(l, 0, w, h, 14);
    }
    return g;
  }

  private closeButton(style: ReaderSceneData['style'], x: number, y: number): Phaser.GameObjects.Container {
    const light = style === 'book' || style === 'stone';
    const w = 150;
    const bh = 36;
    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(light ? 0x3a2717 : THEME.panel, hover ? 0.95 : 0.82).fillRoundedRect(-w / 2, -bh / 2, w, bh, 8);
      bg.lineStyle(1.5, THEME.gold, hover ? 1 : 0.6).strokeRoundedRect(-w / 2, -bh / 2, w, bh, 8);
    };
    draw(false);
    const label = this.add.text(0, 0, 'Close', { fontFamily: THEME.font, fontSize: '17px', color: THEME.text }).setOrigin(0.5);
    const button = this.add.container(x, y, [bg, label]).setSize(w, bh).setInteractive({ useHandCursor: true });
    button.on('pointerover', () => {
      draw(true);
      GameAudio.hover();
    });
    button.on('pointerout', () => draw(false));
    button.on('pointerup', () => this.close());
    return button;
  }

  // ------------------------------------------------------------ scrolling

  private scrollTo(to: number): void {
    const max = Math.max(0, this.contentH - this.view.h);
    this.scroll = Phaser.Math.Clamp(Number.isFinite(to) ? to : max, 0, max);
    this.body?.setY(HEAD_H - this.scroll);
    const bar = this.bar;
    if (!bar) return;
    bar.clear();
    this.more?.setVisible(max > 0 && this.scroll < max - 4);
    if (max <= 0) return;
    const w = this.view.w + 8;
    const trackH = this.view.h - 12;
    const thumb = Math.max(28, (trackH * this.view.h) / this.contentH);
    const at = this.scroll / max;
    const color = this.data_.style === 'book' || this.data_.style === 'stone' ? 0x5a4030 : THEME.gold;
    bar.fillStyle(color, 0.18).fillRoundedRect(w / 2 - 12, HEAD_H + 6, 4, trackH, 2);
    bar.fillStyle(color, 0.7).fillRoundedRect(w / 2 - 12, HEAD_H + 6 + (trackH - thumb) * at, 4, thumb, 2);
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    GameAudio.click();
    this.tweens.add({ targets: [this.sheet, this.dim], alpha: 0, duration: 140 });
    // Put down on a timer rather than when the fade ends, so a fade cut short (the sheet rebuilt on a resize) can't leave it open.
    this.time.delayedCall(150, () => {
      this.events.emit('reader-closed');
      this.scene.stop();
    });
  }
}
