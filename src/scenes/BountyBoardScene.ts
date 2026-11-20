import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { Bounties, BountyDef, BountyId, NoticeState } from '../systems/Bounties';
import { Inventory } from '../systems/Inventory';
import { FACTIONS, LEVEL_NAMES, Reputation } from '../systems/Reputation';
import { THEME, titleStyle } from '../ui/Widgets';

export interface BountyBoardSceneData {
  /** Take a notice down (the bounty's quest begins). */
  onTake: (id: BountyId) => void;
  /** Be paid for a finished one. */
  onClaim: (id: BountyId) => void;
}

/** The board's size, before it's scaled to fit the screen. */
const BOARD_W = 940;
const BOARD_H = 640;
const CARD_W = 196;
const CARD_H = 252;
const CARD_GAP = 22;

const INK = '#2b2130';
const INK_FADED = '#5a4a40';
const SEAL_RED = 0xa8201a;
const SERIF = 'Merriweather, Georgia, "Times New Roman", serif';

/** Paper colours, one per notice, so they don't all look cut from the same sheet. */
const PAPER: Record<BountyId, number> = { rats: 0xeadfbe, boar: 0xe2d4ae, footpads: 0xeee4c8, wolves: 0xe6d8b4 };
/** A slight tilt, as if pinned in a hurry. */
const TILT: Record<BountyId, number> = { rats: -2.2, boar: 1.6, footpads: -1.1, wolves: 2.4 };

/** "RAT-CATCHER WANTED." and the rest of the notice. */
function splitNotice(def: BountyDef): { heading: string; body: string } {
  const i = def.notice.indexOf('. ');
  return i < 0 ? { heading: def.title, body: def.notice } : { heading: def.notice.slice(0, i), body: def.notice.slice(i + 2) };
}

/**
 * The militia's notice board in the market square, close up (see
 * systems/Bounties.ts): a plank board under a little hood, with today's
 * notices pinned to it on scraps of parchment. Click or tap one (or use the
 * arrow keys or 1-4) to pick it out; the strip along the bottom reads it in
 * full, with the button to take it down or to be paid for it. Taken notices
 * show how far along the hunt is; one paid for today wears the reeve's stamp.
 */
export class BountyBoardScene extends Phaser.Scene {
  private data_!: BountyBoardSceneData;
  private dim!: Phaser.GameObjects.Rectangle;
  private board!: Phaser.GameObjects.Container;
  /** What's redrawn as notices change: the cards and the strip below. */
  private content!: Phaser.GameObjects.Container;
  private cards: Array<{ id: BountyId; card: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Graphics }> = [];
  private selected = 0;
  private closing = false;

  constructor() {
    super('BountyBoard');
  }

  create(data: BountyBoardSceneData): void {
    this.data_ = data;
    this.selected = 0;
    this.closing = false;
    this.cards = [];
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.6).setOrigin(0).setInteractive();
    this.dim.on('pointerup', () => this.close());

    this.board = this.add.container(0, 0);
    this.drawBoard();
    this.content = this.add.container(0, 0);
    this.board.add(this.content);
    this.build();

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.close());
    for (const k of ['LEFT', 'A']) kb.on(`keydown-${k}`, () => this.select(this.selected - 1));
    for (const k of ['RIGHT', 'D']) kb.on(`keydown-${k}`, () => this.select(this.selected + 1));
    for (const k of ['ENTER', 'E', 'SPACE']) kb.on(`keydown-${k}`, () => this.act());
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.select(i)));

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));

    GameAudio.pageTurn();
    const target = this.board.scale;
    this.board.setScale(target * 0.92).setAlpha(0);
    this.tweens.add({ targets: this.board, scale: target, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.dim.input!.hitArea.setSize(width, height);
    this.board.setPosition(Math.round(width / 2), Math.round(height / 2));
    this.board.setScale(Math.min(1.2, (width - 16) / BOARD_W, (height - 16) / BOARD_H));
  }

  // ------------------------------------------------------------ the board itself

  /** Posts, a plank board with a frame, the hood over it, and the reeve's plaque. */
  private drawBoard(): void {
    const g = this.add.graphics();
    const w = BOARD_W;
    const h = BOARD_H;
    // Swallow clicks on the board, so only clicks outside it close it.
    const blocker = this.add.rectangle(0, 0, w, h, 0, 0).setInteractive();
    // Shadow, then the posts showing below the board.
    g.fillStyle(0x000000, 0.45).fillRoundedRect(-w / 2 + 8, -h / 2 + 12, w, h, 10);
    g.fillStyle(0x3a2616).fillRect(-w / 2 + 34, h / 2 - 30, 30, 30).fillRect(w / 2 - 64, h / 2 - 30, 30, 30);
    // Planks, running across, each a slightly different brown, with the grain picked out.
    const planks = 9;
    const ph = (h - 60) / planks;
    const browns = [0x6b4a30, 0x73502f, 0x654428, 0x6f4c2e, 0x684830];
    for (let i = 0; i < planks; i++) {
      const y = -h / 2 + 40 + i * ph;
      g.fillStyle(browns[i % browns.length]).fillRect(-w / 2 + 14, y, w - 28, ph);
      g.lineStyle(1, 0x4a3020, 0.55);
      for (let k = 0; k < 4; k++) {
        const gy = y + ph * (0.2 + k * 0.2) + Math.sin(i * 3 + k) * 2;
        g.lineBetween(-w / 2 + 20, gy, w / 2 - 20, gy + Math.sin(i + k * 2) * 3);
      }
      g.fillStyle(0x3a2616).fillRect(-w / 2 + 14, y + ph - 2, w - 28, 2);
      // A knot here and there.
      if (i % 3 === 1) g.fillStyle(0x4a3020).fillEllipse(-w / 2 + 120 + ((i * 271) % (w - 240)), y + ph / 2, 18, 9);
    }
    // The frame.
    g.lineStyle(14, 0x4a3020).strokeRect(-w / 2 + 14, -h / 2 + 40, w - 28, h - 60);
    g.lineStyle(2, 0x87603d, 0.8).strokeRect(-w / 2 + 7, -h / 2 + 33, w - 14, h - 46);
    // The hood: a shingled strip along the top.
    g.fillStyle(0x4a3a30).fillRect(-w / 2 - 10, -h / 2, w + 20, 40);
    for (let x = -w / 2 - 10; x < w / 2 + 10; x += 34) {
      g.fillStyle(((x / 34) | 0) % 2 ? 0x6e5a48 : 0x7e6a54).fillRect(x + 1, -h / 2 + 4, 32, 30);
      g.fillStyle(0x3a2c24).fillRect(x, -h / 2 + 34, 34, 6);
    }
    // Iron nails at the corners.
    for (const [x, y] of [[-w / 2 + 22, -h / 2 + 50], [w / 2 - 22, -h / 2 + 50], [-w / 2 + 22, h / 2 - 28], [w / 2 - 22, h / 2 - 28]]) {
      g.fillStyle(0x2a2a30).fillCircle(x, y, 5);
      g.fillStyle(0x8a8a94).fillCircle(x - 1, y - 1, 2);
    }
    // The reeve's plaque, carved and painted.
    const plaque = this.add.graphics();
    plaque.fillStyle(0x3a2616).fillRoundedRect(-230, -h / 2 + 52, 460, 56, 8);
    plaque.lineStyle(2, THEME.gold, 0.8).strokeRoundedRect(-230, -h / 2 + 52, 460, 56, 8);
    const title = this.add.text(0, -h / 2 + 72, 'Militia Notices', titleStyle(30)).setOrigin(0.5);
    const sub = this.add
      .text(0, -h / 2 + 97, 'by order of the reeve of Adowvale', { fontFamily: SERIF, fontSize: '13px', fontStyle: 'italic', color: THEME.dimText })
      .setOrigin(0.5);
    // A close button in the corner, for touch.
    const close = this.add.text(w / 2 - 26, -h / 2 + 20, '✕', { fontFamily: SERIF, fontSize: '24px', color: THEME.text, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
    close.setInteractive({ useHandCursor: true }).on('pointerup', () => this.close());
    this.board.add([blocker, g, plaque, title, sub, close]);
  }

  // ------------------------------------------------------------ the notices

  private build(): void {
    this.content.removeAll(true);
    this.cards = [];
    const notices = Bounties.notices();
    this.selected = Phaser.Math.Clamp(this.selected, 0, Math.max(0, notices.length - 1));
    const total = notices.length * CARD_W + (notices.length - 1) * CARD_GAP;
    notices.forEach(({ def, state, count }, i) => {
      const x = -total / 2 + CARD_W / 2 + i * (CARD_W + CARD_GAP);
      const { card, glow } = this.makeCard(def, state, count, x, -48, i);
      this.cards.push({ id: def.id, card, glow });
    });
    if (notices.length === 0) {
      this.content.add(
        this.add.text(0, -48, 'Nothing pinned up today.\nThe sergeant posts new notices in the morning.', {
          fontFamily: SERIF, fontSize: '20px', fontStyle: 'italic', color: THEME.text, align: 'center',
        }).setOrigin(0.5),
      );
    }
    this.buildStrip(notices[this.selected]);
    this.buildFooter();
    this.highlight();
  }

  /** One notice: a scrap of parchment pinned to the board, with its heading, a line or two, the reward, and a stamp for where it stands. */
  private makeCard(def: BountyDef, state: NoticeState, count: number, x: number, y: number, index: number): { card: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Graphics } {
    const card = this.add.container(x, y).setAngle(TILT[def.id]);
    const glow = this.add.graphics();
    const paper = this.add.graphics();
    const w = CARD_W;
    const h = CARD_H;
    // Shadow, then a ragged-edged sheet.
    paper.fillStyle(0x000000, 0.35).fillRect(-w / 2 + 5, -h / 2 + 7, w, h);
    const edge: Phaser.Math.Vector2[] = [];
    const jag = (n: number, a: number) => (Math.sin(n * 12.9898 + a * 78.233) * 43758.5453) % 1;
    const steps = 10;
    for (let i = 0; i <= steps; i++) edge.push(new Phaser.Math.Vector2(-w / 2 + (w * i) / steps, -h / 2 + Math.abs(jag(i, index)) * 4));
    for (let i = 1; i <= steps; i++) edge.push(new Phaser.Math.Vector2(w / 2 - Math.abs(jag(i, index + 3)) * 3, -h / 2 + (h * i) / steps));
    for (let i = 1; i <= steps; i++) edge.push(new Phaser.Math.Vector2(w / 2 - (w * i) / steps, h / 2 - Math.abs(jag(i, index + 7)) * 5));
    for (let i = 1; i < steps; i++) edge.push(new Phaser.Math.Vector2(-w / 2 + Math.abs(jag(i, index + 11)) * 3, h / 2 - (h * i) / steps));
    paper.fillStyle(PAPER[def.id]).fillPoints(edge, true);
    // Age: a darker band at the foot.
    paper.fillStyle(0x8a6a40, 0.12).fillRect(-w / 2 + 2, h / 2 - 34, w - 6, 30);
    // The pin.
    paper.fillStyle(0x2a2a30).fillCircle(0, -h / 2 + 12, 6);
    paper.fillStyle(0xb0b0ba).fillCircle(-2, -h / 2 + 10, 2);

    const { heading, body } = splitNotice(def);
    const head = this.add
      .text(0, -h / 2 + 30, heading, { fontFamily: THEME.font, fontSize: '19px', fontStyle: 'bold', color: INK, align: 'center', wordWrap: { width: w - 26 } })
      .setOrigin(0.5, 0);
    const rule = this.add.graphics();
    rule.lineStyle(1, 0x2b2130, 0.6).lineBetween(-w / 2 + 24, head.y + head.height + 6, w / 2 - 24, head.y + head.height + 6);
    const text = this.add
      .text(0, head.y + head.height + 14, body, { fontFamily: SERIF, fontSize: '12px', color: INK_FADED, align: 'center', lineSpacing: 2, wordWrap: { width: w - 30 } })
      .setOrigin(0.5, 0);
    const reward = this.add
      .text(0, h / 2 - 22, `Reward: ${def.coins} coins`, { fontFamily: THEME.font, fontSize: '15px', fontStyle: 'bold', color: INK })
      .setOrigin(0.5);
    card.add([glow, paper, head, rule, text, reward]);
    const stamp = this.stamp(state, count, def);
    if (stamp) card.add(stamp);

    card.setSize(w, h).setInteractive({ useHandCursor: true });
    card.on('pointerover', () => {
      if (this.selected !== index) GameAudio.hover();
    });
    card.on('pointerup', () => {
      if (this.selected === index) this.act();
      else this.select(index);
    });
    this.content.add(card);
    return { card, glow };
  }

  /** What's written or stamped across a notice that isn't simply up for the taking. */
  private stamp(state: NoticeState, count: number, def: BountyDef): Phaser.GameObjects.Container | undefined {
    if (state === 'open') return undefined;
    const c = this.add.container(0, 66).setAngle(-12);
    const label = state === 'claimed' ? 'PAID' : state === 'ready' ? 'DONE' : `${count} of ${def.need}`;
    const color = state === 'taken' ? 0x2b2130 : SEAL_RED;
    const t = this.add
      .text(0, 0, label, { fontFamily: THEME.font, fontSize: state === 'taken' ? '24px' : '30px', fontStyle: 'bold', color: Phaser.Display.Color.IntegerToColor(color).rgba })
      .setOrigin(0.5)
      .setAlpha(0.85);
    const box = this.add.graphics();
    box.lineStyle(3, color, 0.8).strokeRoundedRect(-t.width / 2 - 10, -t.height / 2 - 4, t.width + 20, t.height + 8, 4);
    c.add([box, t]);
    return c;
  }

  /** The strip along the bottom: the chosen notice in full, where the hero is with it, and what can be done. */
  private buildStrip(notice?: { def: BountyDef; state: NoticeState; count: number }): void {
    const y = 116;
    const w = BOARD_W - 80;
    const h = 116;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2 + 4, y + 5, w, h, 8);
    g.fillStyle(0xe8dcb8).fillRoundedRect(-w / 2, y, w, h, 8);
    g.lineStyle(2, 0x87603d).strokeRoundedRect(-w / 2, y, w, h, 8);
    this.content.add(g);
    if (!notice) return;
    const { def, state, count } = notice;
    const textW = w - 290;
    const title = this.add.text(-w / 2 + 20, y + 14, def.title.replace('Bounty: ', ''), { fontFamily: THEME.font, fontSize: '20px', fontStyle: 'bold', color: INK });
    const what = {
      open: `${def.task}. Paid at this board: ${def.coins} coins, and the militia's thanks.`,
      taken: `${def.task}. So far: ${count} of ${def.need}. Come back here when it's done.`,
      ready: `Done: ${def.need} of ${def.need}. The militiaman by the board will pay you ${def.coins} coins.`,
      claimed: "Paid today. The sergeant posts it again another morning.",
    }[state];
    const line = this.add.text(-w / 2 + 20, y + 46, what, { fontFamily: SERIF, fontSize: '14px', color: INK_FADED, lineSpacing: 3, wordWrap: { width: textW } });
    this.content.add([title, line]);

    const label = { open: 'Take the notice', ready: `Claim ${def.coins} coins`, taken: '', claimed: '' }[state];
    if (label) this.content.add(this.parchmentButton(w / 2 - 130, y + h / 2, label, () => this.act()));
    else {
      const note = state === 'taken' ? 'Your name is on it' : 'Paid';
      this.content.add(this.add.text(w / 2 - 130, y + h / 2, note, { fontFamily: SERIF, fontSize: '15px', fontStyle: 'italic', color: INK_FADED }).setOrigin(0.5));
    }
  }

  /** A red wax-seal button for the strip. */
  private parchmentButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const w = 220;
    const h = 50;
    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? 0xc0302a : SEAL_RED).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(2, 0x5a0e0a).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    draw(false);
    const text = this.add.text(0, 0, label, { fontFamily: THEME.font, fontSize: '18px', fontStyle: 'bold', color: '#fff3dc' }).setOrigin(0.5);
    const button = this.add.container(x, y, [bg, text]).setSize(w, h).setInteractive({ useHandCursor: true });
    button.on('pointerover', () => {
      draw(true);
      GameAudio.hover();
    });
    button.on('pointerout', () => draw(false));
    button.on('pointerup', onClick);
    return button;
  }

  /** The militia's opinion of the hero and the purse, under the strip, and how to leave. */
  private buildFooter(): void {
    const y = BOARD_H / 2 - 42;
    const level = Reputation.level('militia');
    const style = { fontFamily: SERIF, fontSize: '14px', color: THEME.text, stroke: '#1a1008', strokeThickness: 3 };
    const left = this.add.text(-BOARD_W / 2 + 40, y, `${FACTIONS.militia.name}: ${LEVEL_NAMES[level]}    ·    Purse: ${Inventory.coins} coins`, style).setOrigin(0, 0.5);
    const right = this.add.text(BOARD_W / 2 - 40, y, '←  →  choose    Enter  take or claim    Esc  step away', { ...style, color: THEME.dimText }).setOrigin(1, 0.5);
    this.content.add([left, right]);
  }

  // ------------------------------------------------------------ choosing

  private select(i: number): void {
    if (this.cards.length === 0) return;
    const next = Phaser.Math.Wrap(i, 0, this.cards.length);
    if (next === this.selected) return;
    this.selected = next;
    GameAudio.click();
    this.rebuild();
  }

  /** Lifts the chosen notice off the board a little, with a gold edge. */
  private highlight(): void {
    this.cards.forEach(({ card, glow }, i) => {
      glow.clear();
      const on = i === this.selected;
      if (on) {
        glow.lineStyle(4, THEME.gold, 0.95).strokeRoundedRect(-CARD_W / 2 - 6, -CARD_H / 2 - 6, CARD_W + 12, CARD_H + 12, 6);
      }
      card.setScale(on ? 1.06 : 1).setDepth(on ? 1 : 0);
      if (on) this.content.bringToTop(card);
    });
  }

  /** Takes the chosen notice down, or claims its reward. */
  private act(): void {
    const notice = Bounties.notices()[this.selected];
    if (!notice || this.closing) return;
    if (notice.state === 'open') {
      this.data_.onTake(notice.def.id);
      GameAudio.pageTurn();
      this.rebuild();
    } else if (notice.state === 'ready') {
      this.data_.onClaim(notice.def.id);
      this.rebuild();
    }
  }

  /** Redraws on the next tick, so a card isn't destroyed while its own click is being handled. */
  private rebuild(): void {
    this.time.delayedCall(0, () => this.build());
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    GameAudio.click();
    this.tweens.add({
      targets: this.board,
      alpha: 0,
      scale: this.board.scale * 0.95,
      duration: 140,
      onComplete: () => {
        this.events.emit('board-closed');
        this.scene.stop();
      },
    });
  }
}
