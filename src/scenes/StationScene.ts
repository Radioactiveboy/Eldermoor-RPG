import Phaser from 'phaser';
import { itemScale } from '../art/items';
import { STATION_H, STATION_POINTS, STATION_RES } from '../art/stations';
import { GameAudio } from '../audio/Audio';
import { Crafting, Recipe, STATION_SLOTS, StationDef, STATIONS } from '../systems/Crafting';
import { Experience } from '../systems/Experience';
import { Inventory, itemDef, itemEffects, ItemId } from '../systems/Inventory';
import { bodyStyle, makeButton, makePanel, THEME, titleStyle } from '../ui/Widgets';

export interface StationSceneData {
  /** An id in STATIONS (systems/Crafting.ts). */
  station: string;
}

const BODY_FONT = 'Georgia, "Times New Roman", serif';
const SLOT_FILL = 0x0d0a10;
const SLOT = 54;
const GAP = 6;
const COLS = 5;
const ROWS = 4;
const GRID_W = COLS * SLOT + (COLS - 1) * GAP;
const GRID_H = ROWS * SLOT + (ROWS - 1) * GAP;
const PAD = 28;
const PANEL_W = 1120;
const PANEL_H = 660;
const HEADER = 92;
/** The middle column, where the brewing or cooking happens. */
const WORK_W = 400;
const BOOK_W = 300;
const ING = 66;
/** Pixels the pointer must move before a press becomes a drag. */
const DRAG_START = 8;
/** Where on the progress bar food is done to a turn (cooking): take it off the fire then for a bonus. */
const SWEET = [0.78, 0.92] as const;
/** Each stir of the pot (brewing) moves it on this much. */
const STIR = 0.045;

interface Drag {
  /** Dragged from a satchel slot, or out of one of the station's ingredient slots. */
  from: { bag: number } | { slot: number };
  id: ItemId;
  startX: number;
  startY: number;
  ghost?: Phaser.GameObjects.Image;
}

interface Work {
  recipe: Recipe;
  batches: number;
  elapsed: number;
  seconds: number;
  /** Cooking: whether it was taken off the fire at just the right moment. */
  perfect?: boolean;
}

/**
 * Brewing and cooking. The satchel is on the left, the station in the middle
 * (an alchemist's still over a brazier, or a pot over the fire) with three
 * slots for ingredients above it, and the recipe book on the right.
 *
 * Drag things from the satchel into the slots (or click them), and whatever
 * they make shows on the right of the pot: the dish itself if it's a known
 * recipe, a question mark if it's one still to be found, or a cross if nothing
 * would come of them. Choose how many to make and press Brew (or Cook): the
 * ingredients go into the pot, a progress bar runs through the steps, and a
 * popup shows what was made. While brewing, stirring the pot hurries it along;
 * while cooking, taking it off the fire in the golden band is "done to a turn".
 *
 * Clicking a recipe in the book fills the slots from the satchel.
 */
export class StationScene extends Phaser.Scene {
  private def!: StationDef;
  private dim!: Phaser.GameObjects.Rectangle;
  private window!: Phaser.GameObjects.Container;
  private content!: Phaser.GameObjects.Container;
  /** What's in each ingredient slot. */
  private slots: Array<ItemId | undefined> = [];
  private batches = 1;
  private drag?: Drag;
  private work?: Work;
  private closing = false;
  /** Areas in window space, for working out where something is dropped. */
  private bagRect = new Phaser.Geom.Rectangle();
  private workRect = new Phaser.Geom.Rectangle();
  private slotRects: Phaser.Geom.Rectangle[] = [];
  private slotGlow: Array<(on: boolean) => void> = [];
  private hoverText?: Phaser.GameObjects.Text;
  /** The pot and what's in it, redrawn every frame: bubbling liquid, flickering flames. */
  private vessel!: Phaser.GameObjects.Graphics;
  private vesselX = 0;
  private vesselY = 0;
  private fxTimer = 0;
  private bar?: { g: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; x: number; y: number; w: number };
  private actionButton?: Phaser.GameObjects.Container;
  private popup?: Phaser.GameObjects.Container;
  private popupBlock?: Phaser.GameObjects.Rectangle;
  private time0 = 0;
  private lastFrame = 0;
  private flames: Phaser.GameObjects.Image[] = [];
  private glow?: Phaser.GameObjects.Image;

  /** Where the pot's mouth is, in window space: where ingredients drop in and steam rises. */
  private get mouth(): { x: number; y: number } {
    const m = this.alchemy ? STATION_POINTS.stillMouth : STATION_POINTS.potMouth;
    return { x: this.vesselX + m.x, y: this.vesselY + m.y };
  }

  constructor() {
    super('Station');
  }

  private get alchemy(): boolean {
    return this.def.kind === 'alchemy';
  }

  create(data: StationSceneData): void {
    this.def = STATIONS[data.station] ?? STATIONS['home-hearth'];
    this.slots = new Array(STATION_SLOTS).fill(undefined);
    this.batches = 1;
    this.drag = undefined;
    this.work = undefined;
    this.closing = false;
    this.popup = undefined;

    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.6).setOrigin(0).setInteractive();
    this.dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.drag || this.work || this.popup) return;
      const local = this.window.getWorldTransformMatrix().applyInverse(p.x, p.y);
      if (Math.abs(local.x) > PANEL_W / 2 + 10 || Math.abs(local.y) > PANEL_H / 2 + 10) this.close();
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => (this.popup ? this.closePopup() : this.work ? undefined : this.close()));
    kb.on('keydown-ENTER', () => (this.popup ? this.closePopup() : this.pressAction()));
    kb.on('keydown-SPACE', () => (this.popup ? this.closePopup() : this.pressAction()));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onDragMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onDragEnd(p));

    this.build();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));

    GameAudio.bookOpen();
    const target = this.window.scale;
    this.window.setScale(target * 0.9).setAlpha(0);
    this.tweens.add({ targets: this.window, scale: target, alpha: 1, duration: 240, ease: 'Back.easeOut' });
  }

  update(): void {
    // Real time, not the game loop's smoothed step, so a slow frame rate doesn't slow the pot down.
    const now = performance.now();
    const dt = Math.min(0.25, (now - (this.lastFrame || now)) / 1000);
    this.lastFrame = now;
    this.time0 += dt;
    this.drawVessel();
    this.updateWork(dt);
    // Bubbles, sparks and smoke rising from the pot now and then; more of them while it's working.
    this.fxTimer -= dt;
    if (this.fxTimer <= 0) {
      this.fxTimer = this.work ? 0.07 : this.alchemy ? 0.5 : 0.18;
      this.puff();
    }
  }

  // ------------------------------------------------------------ building

  private build(): void {
    this.window?.destroy();
    this.slotGlow = [];
    this.slotRects = [];
    const top = -PANEL_H / 2;
    const left = -PANEL_W / 2;
    const panel = makePanel(this, PANEL_W, PANEL_H);
    const blocker = this.add.zone(0, 0, PANEL_W, PANEL_H).setInteractive();
    this.content = this.add.container(0, 0);

    // The station's name and a line about it.
    const crest = this.add.image(left + PAD + 22, top + PAD + 22, this.alchemy ? 'item-fever-tincture' : 'item-roast-boar').setScale(itemScale(3.4));
    const name = this.add.text(left + PAD + 52, top + PAD - 4, this.def.name, { ...titleStyle(26), shadow: undefined });
    const blurb = this.add.text(name.x, name.y + name.height + 2, this.def.blurb, {
      fontFamily: BODY_FONT,
      fontSize: '15px',
      fontStyle: 'italic',
      color: THEME.dimText,
      wordWrap: { width: PANEL_W - PAD * 2 - 120 },
    });
    this.content.add([crest, name, blurb]);

    const colY = top + PAD + HEADER;
    const bagX = left + PAD;
    const workX = bagX + GRID_W + 34;
    const bookX = workX + WORK_W + 34;
    this.buildBag(bagX, colY);
    this.buildWork(workX, colY);
    this.buildBook(bookX, colY);

    const close = this.add
      .text(PANEL_W / 2 - 22, top + 22, '✕', { fontFamily: BODY_FONT, fontSize: '22px', color: THEME.text })
      .setOrigin(0.5)
      .setPadding(8)
      .setInteractive({ useHandCursor: true });
    close.on('pointerup', () => !this.work && this.close());
    close.on('pointerover', () => close.setColor(THEME.goldText));
    close.on('pointerout', () => close.setColor(THEME.text));

    this.window = this.add.container(0, 0, [panel, blocker, this.content, close]);
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.dim.input!.hitArea.setSize(width, height);
    const scale = Math.min(1.1, (width - 12) / PANEL_W, (height - 12) / PANEL_H);
    this.window.setPosition(Math.round(width / 2), Math.round(height / 2)).setScale(scale);
    this.popupBlock?.setSize(width, height);
    this.popup?.setPosition(this.window.x, this.window.y).setScale(scale);
  }

  /** How many of an item are in the slots already. */
  private inSlots(id: ItemId): number {
    return this.slots.filter((s) => s === id).length;
  }

  /** The satchel, with what can't be used here dimmed. */
  private buildBag(x0: number, y0: number): void {
    const usable = Crafting.ingredientsFor(this.def.kind);
    const label = this.add.text(x0 + 2, y0, 'Your satchel', { ...titleStyle(17), shadow: undefined });
    this.content.add(label);
    const gy = y0 + 30;
    this.bagRect.setTo(x0 - GAP, gy - GAP, GRID_W + GAP * 2, GRID_H + GAP * 2);
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = x0 + (i % COLS) * (SLOT + GAP);
      const y = gy + Math.floor(i / COLS) * (SLOT + GAP);
      const stack = Inventory.bag[i];
      const g = this.add.graphics();
      const ok = !!stack && usable.has(stack.id);
      // What's left once the slots are counted: two hares in the pot leaves one of three.
      const left = stack ? Math.max(0, Inventory.count(stack.id) - this.inSlots(stack.id)) : 0;
      const draw = (hover: boolean) => {
        g.clear();
        g.fillStyle(ok && hover ? THEME.panelLight : SLOT_FILL, 0.85);
        g.fillRoundedRect(x, y, SLOT, SLOT, 7);
        g.lineStyle(ok ? 1.5 : 1, ok ? 0x9fd66a : THEME.gold, ok ? (hover ? 1 : 0.55) : 0.25);
        g.strokeRoundedRect(x, y, SLOT, SLOT, 7);
      };
      draw(false);
      this.content.add(g);
      if (!stack) continue;
      const icon = this.add.image(x + SLOT / 2, y + SLOT / 2 + 2, itemDef(stack.id).icon).setScale(itemScale(2.4));
      if (!ok) icon.setAlpha(0.28);
      this.content.add(icon);
      if (stack.count > 1) {
        const n = this.add
          .text(x + SLOT - 4, y + SLOT - 2, `${stack.count}`, { fontFamily: BODY_FONT, fontSize: '14px', color: '#fff6e0', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 })
          .setOrigin(1, 1)
          .setAlpha(ok ? 1 : 0.4);
        this.content.add(n);
      }
      const hit = this.add.zone(x + SLOT / 2, y + SLOT / 2, SLOT, SLOT).setInteractive({ useHandCursor: ok });
      hit.on('pointerover', () => {
        draw(true);
        const def = itemDef(stack.id);
        this.showHover(ok ? `${def.name}: ${def.description}` : `${def.name}. That's no use ${this.alchemy ? 'at a brewing bench' : 'over a fire'}.`);
      });
      hit.on('pointerout', () => {
        draw(false);
        this.showHover(undefined);
      });
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (this.work || this.popup) return;
        if (!ok) {
          GameAudio.fizzle();
          this.shake(icon);
          return;
        }
        if (left <= 0) {
          GameAudio.fizzle();
          this.showHover(`All your ${itemDef(stack.id).name.toLowerCase()} is in the ${this.alchemy ? 'still' : 'pot'} already.`);
          return;
        }
        this.drag = { from: { bag: i }, id: stack.id, startX: p.x, startY: p.y };
      });
      this.content.add(hit);
    }
    // A line under the satchel naming whatever the pointer is over.
    const hy = gy + GRID_H + 16;
    const info = this.add.graphics();
    info.fillStyle(SLOT_FILL, 0.55);
    const ih = PANEL_H / 2 - PAD - hy;
    info.fillRoundedRect(x0 - GAP, hy, GRID_W + GAP * 2, ih, 10);
    info.lineStyle(1, THEME.gold, 0.3);
    info.strokeRoundedRect(x0 - GAP, hy, GRID_W + GAP * 2, ih, 10);
    this.hoverText = this.add.text(x0 + 6, hy + 12, '', {
      fontFamily: BODY_FONT,
      fontSize: '14px',
      fontStyle: 'italic',
      color: THEME.text,
      lineSpacing: 3,
      wordWrap: { width: GRID_W - 12 },
    });
    this.content.add([info, this.hoverText]);
    this.showHover(undefined);
  }

  private showHover(text: string | undefined): void {
    if (!this.hoverText) return;
    const idle = this.alchemy
      ? 'Drag ingredients from your satchel into the bowls above the still, or click them. Things you can brew with are ringed in green.\n\nWhile it brews, stir the pot to hurry it along.'
      : 'Drag food from your satchel into the bowls above the fire, or click it. Things you can cook are ringed in green.\n\nTake it off the fire while the bar is in the golden band, and it will be done to a turn.';
    this.hoverText.setText(text ?? idle).setColor(text ? THEME.text : THEME.dimText);
  }

  /** The station itself: the slots, the pot, what it'll make, how many, and the button. */
  private buildWork(x0: number, y0: number): void {
    const cx = x0 + WORK_W / 2;
    this.workRect.setTo(x0, y0, WORK_W, PANEL_H / 2 - PAD - y0);
    const frame = this.add.graphics();
    frame.fillStyle(0x0a0709, 0.6);
    frame.fillRoundedRect(x0, y0, WORK_W, this.workRect.height, 14);
    frame.lineStyle(1, THEME.gold, 0.3);
    frame.strokeRoundedRect(x0, y0, WORK_W, this.workRect.height, 14);
    // A warm glow behind the pot.
    const glow = this.add.graphics();
    const gcol = this.alchemy ? 0x5ad8c0 : 0xff8a3a;
    for (let r = 150; r > 0; r -= 10) {
      glow.fillStyle(gcol, 0.012 + (150 - r) / 150 * 0.03);
      glow.fillCircle(cx, y0 + 240, r);
    }
    this.content.add([frame, glow]);

    const title = this.add.text(cx, y0 + 14, this.alchemy ? 'Into the still' : 'Into the pot', { ...titleStyle(17), shadow: undefined }).setOrigin(0.5, 0);
    this.content.add(title);

    // The three ingredient slots, side by side, with little arrows down to the pot.
    const sy = y0 + 46;
    const total = STATION_SLOTS * ING + (STATION_SLOTS - 1) * 22;
    for (let i = 0; i < STATION_SLOTS; i++) {
      const x = cx - total / 2 + i * (ING + 22);
      this.makeIngredientSlot(i, x, sy);
    }
    const arrows = this.add.text(cx, sy + ING + 4, '⌄   ⌄   ⌄', { fontFamily: BODY_FONT, fontSize: '22px', color: THEME.goldText }).setOrigin(0.5, 0).setAlpha(0.45);
    this.content.add(arrows);

    // The still or the pot, in painted layers with the moving parts in between.
    this.vesselX = this.alchemy ? cx - 40 : cx - 62;
    this.vesselY = y0 + (this.alchemy ? 236 : 230);
    this.buildVessel();

    // What it'll make, to the right of the pot.
    const recipe = Crafting.match(this.def.kind, this.slots);
    const rx = x0 + WORK_W - 70;
    const ry = y0 + 228;
    const arrow = this.add.text(rx - 56, ry, '➜', { fontFamily: BODY_FONT, fontSize: '28px', color: THEME.goldText }).setOrigin(0.5).setAlpha(recipe ? 0.9 : 0.25);
    const rg = this.add.graphics();
    rg.fillStyle(SLOT_FILL, 0.9);
    rg.fillRoundedRect(rx - 38, ry - 38, 76, 76, 10);
    rg.lineStyle(2, THEME.gold, recipe ? 1 : 0.35);
    rg.strokeRoundedRect(rx - 38, ry - 38, 76, 76, 10);
    this.content.add([arrow, rg]);
    const filled = this.slots.some((s) => s);
    let caption = filled ? 'Nothing would come of that.' : this.alchemy ? 'What will you brew?' : 'What will you cook?';
    let captionColor = THEME.dimText;
    if (recipe) {
      const known = Crafting.isKnown(recipe);
      const icon = this.add.image(rx, ry + 2, itemDef(recipe.makes).icon).setScale(itemScale(3.6));
      if (!known) icon.setTint(0x000000).setAlpha(0.75);
      this.content.add(icon);
      this.tweens.add({ targets: icon, scale: icon.scale * 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (!known) this.content.add(this.add.text(rx, ry, '?', { ...titleStyle(36), shadow: undefined }).setOrigin(0.5));
      if (recipe.yields > 1) {
        this.content.add(
          this.add
            .text(rx + 34, ry + 34, `×${recipe.yields}`, { fontFamily: BODY_FONT, fontSize: '15px', color: '#fff6e0', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 })
            .setOrigin(1, 1),
        );
      }
      caption = known ? itemDef(recipe.makes).name : 'Something new...?';
      captionColor = known ? THEME.goldText : '#c8b0f0';
    } else if (filled) {
      this.content.add(this.add.text(rx, ry, '✕', { fontFamily: BODY_FONT, fontSize: '40px', color: '#a05a4a' }).setOrigin(0.5).setAlpha(0.8));
    }
    this.content.add(
      this.add.text(rx, ry + 48, caption, { fontFamily: BODY_FONT, fontSize: '14px', fontStyle: 'italic', color: captionColor, align: 'center', wordWrap: { width: 140 } }).setOrigin(0.5, 0),
    );

    // How many batches, and the button.
    const by = y0 + this.workRect.height - 120;
    const max = recipe ? Crafting.maxBatches(recipe) : 0;
    this.batches = Phaser.Math.Clamp(this.batches, 1, Math.max(1, max));
    if (recipe && max > 1) {
      const minus = this.stepButton(cx - 150, by, '−', () => this.setBatches(this.batches - 1));
      const plus = this.stepButton(cx - 50, by, '+', () => this.setBatches(this.batches + 1));
      const n = this.add.text(cx - 100, by, `${this.batches}`, { ...titleStyle(26), shadow: undefined }).setOrigin(0.5);
      const of = this.add.text(cx - 100, by + 26, `of ${max}`, bodyStyle(12, THEME.dimText)).setOrigin(0.5);
      this.content.add([minus, plus, n, of]);
    } else if (recipe && max === 0) {
      this.content.add(this.add.text(cx - 100, by, 'No room in your satchel', { ...bodyStyle(13, '#d08a6a'), align: 'center', wordWrap: { width: 140 } }).setOrigin(0.5));
    }
    const verb = this.alchemy ? 'Brew' : 'Cook';
    const canMake = !!recipe && max > 0;
    this.actionButton = makeButton(this, cx + (recipe && max !== 1 ? 70 : 0), by, verb, () => this.pressAction(), 190);
    this.actionButton.setAlpha(canMake ? 1 : 0.45);
    this.content.add(this.actionButton);

    // The progress bar, empty until it's working.
    const bx = x0 + 24;
    const bw = WORK_W - 48;
    const barY = y0 + this.workRect.height - 56;
    const bg = this.add.graphics();
    const label = this.add.text(cx, barY + 22, '', bodyStyle(14, THEME.text)).setOrigin(0.5, 0);
    this.content.add([bg, label]);
    this.bar = { g: bg, label, x: bx, y: barY, w: bw };
    this.drawBar(0, recipe);
  }

  private makeIngredientSlot(i: number, x: number, y: number): void {
    this.slotRects[i] = new Phaser.Geom.Rectangle(x - 8, y - 8, ING + 16, ING + 16);
    const id = this.slots[i];
    const g = this.add.graphics();
    const draw = (hot: boolean) => {
      g.clear();
      g.fillStyle(hot ? THEME.panelLight : SLOT_FILL, 0.95);
      g.fillRoundedRect(x, y, ING, ING, ING / 2);
      g.lineStyle(hot ? 3 : 2, hot ? 0x9fd66a : THEME.gold, hot ? 1 : id ? 0.9 : 0.4);
      g.strokeRoundedRect(x, y, ING, ING, ING / 2);
      if (!id) {
        // An empty bowl: a faint dashed inner ring.
        g.lineStyle(1, THEME.gold, 0.25);
        g.strokeCircle(x + ING / 2, y + ING / 2, ING / 2 - 9);
      }
    };
    draw(false);
    this.slotGlow[i] = draw;
    this.content.add(g);
    if (!id) {
      this.content.add(this.add.text(x + ING / 2, y + ING / 2, '+', { fontFamily: BODY_FONT, fontSize: '26px', color: THEME.goldText }).setOrigin(0.5).setAlpha(0.25));
      return;
    }
    const icon = this.add.image(x + ING / 2, y + ING / 2 + 2, itemDef(id).icon).setScale(itemScale(3));
    icon.setData('slot', i);
    this.content.add(icon);
    const hit = this.add.zone(x + ING / 2, y + ING / 2, ING, ING).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => this.showHover(`${itemDef(id).name}. Drag it out, or click it, to take it back.`));
    hit.on('pointerout', () => this.showHover(undefined));
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.work || this.popup) return;
      this.drag = { from: { slot: i }, id, startX: p.x, startY: p.y };
    });
    this.content.add(hit);
  }

  /** The recipe book: what's known, and clues to what isn't. */
  private buildBook(x0: number, y0: number): void {
    const h = PANEL_H / 2 - PAD - y0;
    const g = this.add.graphics();
    // A page of old paper.
    g.fillStyle(0xe8d8b0, 0.95);
    g.fillRoundedRect(x0, y0, BOOK_W, h, 8);
    g.lineStyle(2, 0x7a5a30, 1);
    g.strokeRoundedRect(x0, y0, BOOK_W, h, 8);
    g.lineStyle(1, 0xb09060, 0.6);
    g.strokeRoundedRect(x0 + 6, y0 + 6, BOOK_W - 12, h - 12, 6);
    this.content.add(g);
    const title = this.add.text(x0 + BOOK_W / 2, y0 + 14, this.alchemy ? 'Book of Remedies' : 'Recipes', {
      fontFamily: THEME.font,
      fontSize: '19px',
      color: '#5a2a10',
    }).setOrigin(0.5, 0);
    this.content.add(title);

    const recipes = Crafting.recipesFor(this.def.kind);
    const rowH = Math.min(62, (h - 56) / recipes.length);
    recipes.forEach((r, i) => {
      const y = y0 + 48 + i * rowH;
      const known = Crafting.isKnown(r);
      const can = Crafting.maxBatches(r) > 0;
      const row = this.add.graphics();
      const draw = (hover: boolean) => {
        row.clear();
        if (hover && known) {
          row.fillStyle(0xc8a870, 0.45);
          row.fillRoundedRect(x0 + 10, y - 2, BOOK_W - 20, rowH - 4, 6);
        }
        row.lineStyle(1, 0xb09060, 0.5);
        row.lineBetween(x0 + 16, y + rowH - 4, x0 + BOOK_W - 16, y + rowH - 4);
      };
      draw(false);
      this.content.add(row);
      const icon = this.add.image(x0 + 34, y + rowH / 2 - 2, itemDef(r.makes).icon).setScale(itemScale(2.4));
      if (!known) icon.setTint(0x3a2a1a).setAlpha(0.55);
      this.content.add(icon);
      const name = this.add.text(x0 + 60, y + 2, known ? itemDef(r.makes).name : '? ? ?', {
        fontFamily: BODY_FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: known ? '#3a1a08' : '#7a6040',
      });
      this.content.add(name);
      if (known) {
        // Each ingredient as a little icon, red where the satchel hasn't enough.
        let ix = x0 + 66;
        for (const [id, n] of r.needs) {
          const have = Inventory.count(id) >= n;
          const ic = this.add.image(ix, y + 34, itemDef(id).icon).setScale(itemScale(1.5));
          if (!have) ic.setAlpha(0.4);
          const t = this.add.text(ix + 12, y + 34, n > 1 ? `×${n}` : '', { fontFamily: BODY_FONT, fontSize: '11px', color: have ? '#3a1a08' : '#a03020' }).setOrigin(0, 0.5);
          this.content.add([ic, t]);
          ix += n > 1 ? 40 : 28;
        }
        if (Crafting.hasMade(r) || r.known) {
          const ready = this.add.text(x0 + BOOK_W - 18, y + 4, can ? 'ready' : '', { fontFamily: BODY_FONT, fontSize: '11px', fontStyle: 'italic', color: '#3a7a2a' }).setOrigin(1, 0);
          this.content.add(ready);
        }
      } else {
        const hint = this.add.text(x0 + 60, y + 22, r.hint, { fontFamily: BODY_FONT, fontSize: '11px', fontStyle: 'italic', color: '#6a5030', wordWrap: { width: BOOK_W - 80 } });
        this.content.add(hint);
      }
      const hit = this.add.zone(x0 + BOOK_W / 2, y + rowH / 2 - 2, BOOK_W - 20, rowH - 4).setInteractive({ useHandCursor: known });
      hit.on('pointerover', () => {
        draw(true);
        if (known) {
          const def = itemDef(r.makes);
          this.showHover(`${def.name}: ${[...itemEffects(def)].join(', ')}. Click to fill the ${this.alchemy ? 'still' : 'pot'} from your satchel.`);
        } else this.showHover('A recipe not yet found. Try putting things together and see what comes of it.');
      });
      hit.on('pointerout', () => {
        draw(false);
        this.showHover(undefined);
      });
      hit.on('pointerup', () => known && !this.work && !this.popup && this.fillFrom(r));
      this.content.add(hit);
    });
    // The rest of the book is still to be written.
    if (recipes.length < 4) {
      const blank = this.add.text(x0 + BOOK_W / 2, y0 + h - 40, 'The pages after this are blank...\nfor now.', {
        fontFamily: BODY_FONT,
        fontSize: '13px',
        fontStyle: 'italic',
        color: '#8a7050',
        align: 'center',
      }).setOrigin(0.5);
      this.content.add(blank);
    }
  }

  private stepButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(hover ? THEME.panelLight : SLOT_FILL, 1);
      g.fillRoundedRect(-18, -18, 36, 36, 8);
      g.lineStyle(2, THEME.gold, hover ? 1 : 0.6);
      g.strokeRoundedRect(-18, -18, 36, 36, 8);
    };
    draw(false);
    const t = this.add.text(0, -1, label, { ...titleStyle(22), shadow: undefined }).setOrigin(0.5);
    const c = this.add.container(x, y, [g, t]).setSize(36, 36).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => draw(true));
    c.on('pointerout', () => draw(false));
    c.on('pointerup', () => {
      GameAudio.click();
      onClick();
    });
    return c;
  }

  private setBatches(n: number): void {
    const recipe = Crafting.match(this.def.kind, this.slots);
    if (!recipe || this.work) return;
    this.batches = Phaser.Math.Clamp(n, 1, Math.max(1, Crafting.maxBatches(recipe)));
    this.build();
  }

  // ------------------------------------------------------------ the pot

  /** Puts a painted station layer (art/stations.ts) at the vessel's spot. */
  private layer(key: string): Phaser.GameObjects.Image {
    const img = this.add.image(this.vesselX, this.vesselY, key).setScale(1 / STATION_RES);
    this.content.add(img);
    return img;
  }

  /**
   * The still over its brazier, or the cauldron over the fire: the painted
   * layers, a glow that breathes, flames that flicker, and between them the
   * Graphics that draws what's in the pot (redrawn every frame by drawVessel).
   */
  private buildVessel(): void {
    const P = STATION_POINTS;
    const x = this.vesselX;
    const y = this.vesselY;
    this.flames = [];
    const glow = this.layer('stn-glow').setBlendMode(Phaser.BlendModes.ADD);
    if (this.alchemy) {
      glow.setPosition(x + P.coals.x, y + P.coals.y).setScale(0.55 / STATION_RES);
      this.glow = glow;
      this.layer('stn-still');
      this.vessel = this.add.graphics();
      this.content.add(this.vessel);
      this.layer('stn-flask-shine');
    } else {
      glow.setPosition(x, y + 70).setScale(1.1 / STATION_RES);
      this.glow = glow;
      this.layer('stn-hearth-back');
      const flame = (fx: number, fy: number, size: number, i: number): void => {
        const f = this.layer(`stn-flame-${i % 3}`)
          .setOrigin(0.5, (STATION_H / 2 + 40) / STATION_H)
          .setPosition(x + fx, y + fy)
          .setScale(size / STATION_RES)
          .setBlendMode(Phaser.BlendModes.SCREEN);
        f.setData('size', size).setData('phase', i * 1.7);
        this.flames.push(f);
      };
      [-78, -56, -30, 0, 30, 56, 78].forEach((fx, i) => flame(fx, P.flames[0].y + Math.abs(fx) * 0.12, Math.abs(fx) > 50 ? 0.75 : 1.05, i));
      this.layer('stn-cauldron');
      this.vessel = this.add.graphics();
      this.content.add(this.vessel);
      [-34, 6, 40].forEach((fx, i) => flame(fx, 100, 0.45, i + 1));
      this.layer('stn-hearth-front');
    }
    this.drawVessel();
  }

  /** What's in the pot, as of now: the liquid at the mouth, the flask filling, drips; and the fire and glow breathing. */
  private drawVessel(): void {
    const g = this.vessel;
    if (!g || !g.active) return;
    g.clear();
    const P = STATION_POINTS;
    const x = this.vesselX;
    const y = this.vesselY;
    const t = this.time0;
    const recipe = this.work?.recipe ?? Crafting.match(this.def.kind, this.slots);
    const working = !!this.work;
    // The glow breathes, faster and brighter while it's working.
    this.glow?.setAlpha(0.55 + 0.2 * Math.sin(t * (working ? 7 : 2.5)) + (working ? 0.25 : 0));
    for (const f of this.flames) {
      const size = f.getData('size') as number;
      const ph = f.getData('phase') as number;
      const lick = Math.sin(t * (working ? 13 : 8) + ph) * 0.12 + Math.sin(t * 21 + ph * 2) * 0.05;
      const tall = (working ? 1.25 : 1) * size;
      f.setScale((size * (1 - lick * 0.4)) / STATION_RES, (tall * (1 + lick)) / STATION_RES);
      f.setAngle(Math.sin(t * 5 + ph) * 5);
    }
    if (this.alchemy) {
      const m = P.stillMouth;
      const known = !recipe || Crafting.isKnown(recipe) || working;
      const liquid = recipe ? (known ? 0x8ae8d8 : 0xa890e8) : 0x2a4a5a;
      // The liquid in the mouth, swirling, with a gleam going round.
      g.fillStyle(liquid, 1);
      g.fillEllipse(x + m.x, y + m.y + 1, m.rx * 2 - 2, m.ry * 2 - 1);
      g.fillStyle(0xffffff, recipe ? 0.45 : 0.2);
      const a = t * (working ? 4 : 1.2);
      g.fillEllipse(x + m.x + Math.cos(a) * m.rx * 0.5, y + m.y + Math.sin(a) * m.ry * 0.4, 8, 2.5);
      if (recipe) {
        // A soft glow over the brew.
        g.fillStyle(liquid, 0.18 + 0.08 * Math.sin(t * 3));
        g.fillEllipse(x + m.x, y + m.y - 4, m.rx * 2.6, m.ry * 4);
      }
      // The flask filling as it works, the tincture pooling in the bottom of the bulb.
      const fill = working ? this.work!.elapsed / this.work!.seconds : 0;
      if (fill > 0) {
        const rr = 5 + fill * (P.flask.r - 5);
        const fy = y + P.flask.y + P.flask.r - rr;
        g.fillStyle(0x4aa0b8, 0.95);
        g.fillCircle(x + P.flask.x, fy, rr);
        g.fillStyle(0x8ae8d8, 0.95);
        g.fillCircle(x + P.flask.x - rr * 0.15, fy - rr * 0.15, rr * 0.8);
        g.fillStyle(0xffffff, 0.35);
        g.fillEllipse(x + P.flask.x, fy - rr + 3, rr * 1.1, 2.5);
        // A drip falling from the pipe.
        const d = (t * 1.4) % 1;
        g.fillStyle(0x8ae8d8, 1 - d * 0.5);
        g.fillEllipse(x + P.drip.x, y + P.drip.y + 4 + d * (P.flask.y + P.flask.r - rr * 2 - P.drip.y - 4), 4, 5.5);
      }
    } else {
      const m = P.potMouth;
      // What's in it: water, or a simmering stew, or meat in the fat.
      const broth = recipe ? (recipe.needs.length > 1 ? 0x9a6030 : recipe.makes === 'boiled-egg' ? 0x6a8a9a : 0x7a3414) : 0x2a2420;
      g.fillStyle(broth, 1);
      g.fillEllipse(x + m.x, y + m.y + 1, m.rx * 2 - 4, m.ry * 2 - 2);
      g.fillStyle(0x000000, 0.25);
      g.fillEllipse(x + m.x, y + m.y + 3, m.rx * 2 - 10, m.ry * 1.2);
      if (recipe) {
        // Bits of what's cooking, bobbing about.
        const bits = recipe.needs.length > 1 ? [0xf08a2a, 0xf0e0b0, 0x8ac050, 0xc87a50] : recipe.makes === 'boiled-egg' ? [0xf8f4ec] : [0x8a3a20, 0xa04a28];
        bits.forEach((col, i) => {
          const bx = x + m.x + Math.sin(i * 2.4 + t * (working ? 1.6 : 0.4)) * m.rx * 0.55;
          const by = y + m.y + Math.cos(i * 1.9 + t * (working ? 1.3 : 0.3)) * m.ry * 0.4;
          g.fillStyle(0x1a0f08, 1);
          g.fillEllipse(bx, by, 15, 8);
          g.fillStyle(col, 1);
          g.fillEllipse(bx, by - 0.5, 12, 6);
        });
      }
      if (working) {
        // Bubbles breaking the surface.
        for (let i = 0; i < 6; i++) {
          const k = (t * 1.5 + i * 0.37) % 1;
          const bx = x + m.x + Math.sin(i * 3.1) * m.rx * 0.7;
          const by = y + m.y + Math.cos(i * 2.3) * m.ry * 0.5;
          g.lineStyle(1.5, 0xffffff, 0.5 * (1 - k));
          g.strokeEllipse(bx, by, 4 + k * 8, 2 + k * 4);
        }
      }
      g.fillStyle(0xffffff, 0.18);
      g.fillEllipse(x + m.x - 20, y + m.y - 3, 26, 3);
    }
  }

  /** One bubble, spark or wisp of steam rising from the pot. */
  private puff(): void {
    if (!this.vessel?.active) return;
    const mouth = this.mouth;
    const x = mouth.x + (Math.random() - 0.5) * (this.alchemy ? 30 : 90);
    const y = mouth.y - 4;
    const working = !!this.work;
    let dot: Phaser.GameObjects.Arc;
    if (this.alchemy) {
      dot = this.add.circle(x, y, 3 + Math.random() * 4, 0xbaf8ec, 0.75).setStrokeStyle(1, 0xffffff, 0.6);
      if (working && Math.random() < 0.25) GameAudio.bubble();
    } else if (working && Math.random() < 0.5) {
      // A spark spitting up from the fire.
      dot = this.add.circle(this.vesselX + (Math.random() - 0.5) * 140, this.vesselY + 70, 2, 0xffd25a, 1);
      if (Math.random() < 0.12) GameAudio.sizzle();
    } else {
      dot = this.add.circle(x, y, 6 + Math.random() * 8, 0xf0ece8, working ? 0.22 : 0.1);
    }
    this.content.add(dot);
    this.tweens.add({
      targets: dot,
      y: dot.y - 60 - Math.random() * 60,
      x: dot.x + (Math.random() - 0.5) * 30,
      alpha: 0,
      scale: this.alchemy ? 0.5 : 1.8,
      duration: 900 + Math.random() * 700,
      ease: 'Sine.easeOut',
      onComplete: () => dot.destroy(),
    });
  }

  private drawBar(f: number, recipe?: Recipe): void {
    const b = this.bar;
    if (!b) return;
    const g = b.g;
    g.clear();
    g.fillStyle(0x000000, 0.65);
    g.fillRoundedRect(b.x, b.y, b.w, 16, 8);
    if (!this.alchemy && this.work) {
      // The golden band where it's done to a turn.
      g.fillStyle(THEME.gold, 0.35);
      g.fillRect(b.x + b.w * SWEET[0], b.y, b.w * (SWEET[1] - SWEET[0]), 16);
    }
    if (f > 0) {
      const col = this.alchemy ? 0x5ad8c0 : f >= SWEET[0] && f <= SWEET[1] ? THEME.gold : 0xe8803a;
      g.fillStyle(col, 0.95);
      g.fillRoundedRect(b.x, b.y, Math.max(16, b.w * f), 16, 8);
      g.fillStyle(0xffffff, 0.25);
      g.fillRoundedRect(b.x + 3, b.y + 2, Math.max(10, b.w * f - 6), 5, 3);
    }
    g.lineStyle(1.5, THEME.gold, 0.8);
    g.strokeRoundedRect(b.x, b.y, b.w, 16, 8);
    if (!this.work) {
      b.label.setText(recipe ? `${recipe.seconds * this.batchTime(this.batches) | 0} seconds over the ${this.alchemy ? 'coals' : 'fire'}` : '').setColor(THEME.dimText);
      return;
    }
    const stages = this.work.recipe.stages;
    const stage = stages[Math.min(stages.length - 1, Math.floor(f * stages.length))];
    b.label.setText(`${stage}...  ${Math.floor(f * 100)}%`).setColor(THEME.text);
  }

  /** Several at once take longer, but not that much longer. */
  private batchTime(n: number): number {
    return 1 + (n - 1) * 0.35;
  }

  // ------------------------------------------------------------ dragging

  private onDragMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || !p.isDown) return;
    if (!d.ghost) {
      if (Math.hypot(p.x - d.startX, p.y - d.startY) < DRAG_START) return;
      d.ghost = this.add.image(p.x, p.y, itemDef(d.id).icon).setScale(itemScale(2.8 * this.window.scale)).setAlpha(0.9).setDepth(50);
      this.tweens.add({ targets: d.ghost, scale: d.ghost.scale * 1.15, duration: 120, yoyo: true });
      GameAudio.hover();
    }
    d.ghost.setPosition(p.x, p.y);
    const local = this.local(p);
    const over = this.slotAt(local.x, local.y);
    this.slotGlow.forEach((glow, i) => glow('bag' in d.from && (over === i || (over === undefined && this.workRect.contains(local.x, local.y) && i === this.slots.indexOf(undefined)))));
  }

  private onDragEnd(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d) return;
    this.drag = undefined;
    this.slotGlow.forEach((glow) => glow(false));
    if (!d.ghost) {
      // A click: into the first free slot, or back out of the pot.
      if ('bag' in d.from) this.put(d.id);
      else this.takeOut(d.from.slot);
      return;
    }
    const ghost = d.ghost;
    const local = this.local(p);
    const over = this.slotAt(local.x, local.y);
    if ('bag' in d.from) {
      if (over !== undefined || this.workRect.contains(local.x, local.y)) {
        ghost.destroy();
        this.put(d.id, over);
        return;
      }
    } else if (over === undefined || over !== d.from.slot) {
      ghost.destroy();
      if (over !== undefined) {
        // Moved from one bowl to another: swap them round.
        const a = d.from.slot;
        [this.slots[a], this.slots[over]] = [this.slots[over], this.slots[a]];
        GameAudio.click();
        this.build();
      } else this.takeOut(d.from.slot);
      return;
    }
    this.tweens.add({ targets: ghost, alpha: 0, scale: ghost.scale * 0.6, duration: 150, onComplete: () => ghost.destroy() });
  }

  private local(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.window.getWorldTransformMatrix().applyInverse(p.x, p.y);
  }

  private slotAt(x: number, y: number): number | undefined {
    const i = this.slotRects.findIndex((r) => r.contains(x, y));
    return i < 0 ? undefined : i;
  }

  /** Put one of something into a slot (or the first free one). */
  private put(id: ItemId, slot?: number): void {
    if (Inventory.count(id) - this.inSlots(id) <= 0) return;
    const at = slot ?? this.slots.indexOf(undefined);
    if (at < 0) {
      GameAudio.fizzle();
      this.showHover(`The ${this.alchemy ? 'still' : 'pot'} is full. Take something out first.`);
      return;
    }
    this.slots[at] = id;
    GameAudio.pickup();
    this.build();
    this.popIn(at);
  }

  private takeOut(slot: number): void {
    if (!this.slots[slot]) return;
    this.slots[slot] = undefined;
    GameAudio.click();
    this.build();
  }

  /** The icon just dropped in a slot bounces as it lands. */
  private popIn(slot: number): void {
    const icon = this.content.list.find((o) => o instanceof Phaser.GameObjects.Image && o.getData('slot') === slot) as Phaser.GameObjects.Image | undefined;
    if (!icon) return;
    const s = icon.scale;
    icon.setScale(s * 1.5);
    this.tweens.add({ targets: icon, scale: s, duration: 260, ease: 'Back.easeOut' });
    const r = this.slotRects[slot];
    const ring = this.add.circle(r.centerX, r.centerY, ING / 2, 0x9fd66a, 0).setStrokeStyle(3, 0x9fd66a, 0.9);
    this.content.add(ring);
    this.tweens.add({ targets: ring, scale: 1.5, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
  }

  /** Fill the slots for a recipe from the satchel. */
  private fillFrom(r: Recipe): void {
    const missing = r.needs.find(([id, n]) => Inventory.count(id) < n);
    if (missing) {
      GameAudio.fizzle();
      this.showHover(`You haven't enough ${itemDef(missing[0]).name.toLowerCase()} for that.`);
      return;
    }
    this.slots = new Array(STATION_SLOTS).fill(undefined);
    let i = 0;
    for (const [id, n] of r.needs) for (let k = 0; k < n; k++) this.slots[i++] = id;
    this.batches = 1;
    GameAudio.pickup();
    this.build();
    for (let k = 0; k < i; k++) this.popIn(k);
  }

  private shake(o: Phaser.GameObjects.Image): void {
    this.tweens.add({ targets: o, x: o.x + 4, duration: 50, yoyo: true, repeat: 2 });
  }

  // ------------------------------------------------------------ making

  /** The big button: start, stir the pot, or take it off the fire. */
  private pressAction(): void {
    if (this.popup || this.closing) return;
    if (this.work) {
      if (this.alchemy) this.stirPot();
      else this.takeOffFire();
      return;
    }
    const recipe = Crafting.match(this.def.kind, this.slots);
    if (!recipe || Crafting.maxBatches(recipe) < 1) {
      GameAudio.fizzle();
      if (this.actionButton) this.tweens.add({ targets: this.actionButton, x: this.actionButton.x + 5, duration: 50, yoyo: true, repeat: 2 });
      return;
    }
    this.startWork(recipe);
  }

  private startWork(recipe: Recipe): void {
    const batches = Phaser.Math.Clamp(this.batches, 1, Crafting.maxBatches(recipe));
    this.work = { recipe, batches, elapsed: 0, seconds: recipe.seconds * this.batchTime(batches) };
    // The ingredients drop from their bowls into the pot.
    for (let i = 0; i < STATION_SLOTS; i++) {
      const icon = this.content.list.find((o) => o instanceof Phaser.GameObjects.Image && o.getData('slot') === i) as Phaser.GameObjects.Image | undefined;
      if (!icon) continue;
      this.tweens.add({
        targets: icon,
        x: this.mouth.x + (i - 1) * 14,
        y: this.mouth.y,
        scale: icon.scale * 0.4,
        alpha: 0,
        delay: i * 120,
        duration: 420,
        ease: 'Quad.easeIn',
        onComplete: () => (this.alchemy ? GameAudio.bubble() : GameAudio.sizzle()),
      });
    }
    GameAudio.rustle();
    // The button becomes "Stir" or "Take it off".
    this.replaceButton(this.alchemy ? 'Stir the pot' : 'Take it off!', 1);
  }

  private replaceButton(label: string, alpha: number): void {
    const b = this.actionButton;
    if (!b) return;
    const { x, y } = b;
    b.destroy();
    this.actionButton = makeButton(this, x, y, label, () => this.pressAction(), 190).setAlpha(alpha);
    this.content.add(this.actionButton);
  }

  private updateWork(dt: number): void {
    const w = this.work;
    if (!w) return;
    w.elapsed += dt;
    const f = Math.min(1, w.elapsed / w.seconds);
    this.drawBar(f);
    if (f >= 1) this.finish();
  }

  /** Brewing: each stir hurries it along a little, with a swirl in the pot. */
  private stirPot(): void {
    const w = this.work!;
    w.elapsed = Math.min(w.seconds, w.elapsed + w.seconds * STIR);
    GameAudio.stir();
    const ring = this.add.ellipse(this.mouth.x, this.mouth.y, 40, 10, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 0.8);
    this.content.add(ring);
    this.tweens.add({ targets: ring, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
  }

  /** Cooking: taken off in the golden band, it's done to a turn; too soon, and it goes back on. */
  private takeOffFire(): void {
    const w = this.work!;
    const f = w.elapsed / w.seconds;
    if (f < SWEET[0]) {
      GameAudio.fizzle();
      this.bar?.label.setText('Not done yet! Wait for the golden band.').setColor('#e08060');
      return;
    }
    w.perfect = f <= SWEET[1];
    this.finish();
  }

  private finish(): void {
    const w = this.work!;
    this.work = undefined;
    const first = !Crafting.hasMade(w.recipe);
    if (!Crafting.make(w.recipe, w.batches)) {
      this.build();
      return;
    }
    const xp = (first ? w.recipe.xp : 0) + (w.perfect ? 5 * w.batches : 0);
    if (xp > 0) Experience.gain(xp, first ? `New recipe: ${itemDef(w.recipe.makes).name}` : 'Done to a turn');
    this.events.emit('station-made', w.recipe, w.batches);
    // What was used up goes from the slots, as far as there's no more of it to fill them again.
    const keep = Crafting.maxBatches(w.recipe) > 0;
    if (!keep) this.slots = new Array(STATION_SLOTS).fill(undefined);
    this.batches = 1;
    this.build();
    this.showPopup(w, first, xp);
  }

  /** "Brewed!": the thing made, held up in a burst of light. */
  private showPopup(w: Work, first: boolean, xp: number): void {
    GameAudio.sparkle();
    const { width, height } = this.scale;
    this.popupBlock = this.add.rectangle(0, 0, width, height, 0x000000, 0.45).setOrigin(0).setInteractive().setDepth(39);
    this.popupBlock.on('pointerup', () => this.closePopup());
    const def = itemDef(w.recipe.makes);
    const count = w.recipe.yields * w.batches;
    const pw = 440;
    const ph = 420;
    const panel = makePanel(this, pw, ph);
    const block = this.add.zone(0, 0, pw, ph).setInteractive();
    const heading = this.alchemy ? 'Brewed!' : w.perfect ? 'Done to a turn!' : 'Cooked!';
    const title = this.add.text(0, -ph / 2 + 36, heading, { ...titleStyle(30), shadow: undefined }).setOrigin(0.5);
    // Rays of light turning slowly behind the icon.
    const rays = this.add.graphics();
    const col = this.alchemy ? 0x8ae8d8 : THEME.gold;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rays.fillStyle(col, 0.16);
      rays.fillTriangle(0, 0, Math.cos(a - 0.12) * 120, Math.sin(a - 0.12) * 120, Math.cos(a + 0.12) * 120, Math.sin(a + 0.12) * 120);
    }
    rays.fillStyle(col, 0.18);
    rays.fillCircle(0, 0, 46);
    rays.setPosition(0, -40);
    this.tweens.add({ targets: rays, angle: 360, duration: 12000, repeat: -1 });
    const icon = this.add.image(0, -38, def.icon).setScale(0);
    this.tweens.add({ targets: icon, scale: itemScale(6), duration: 520, ease: 'Back.easeOut' });
    const name = this.add.text(0, 54, count > 1 ? `${def.name}  ×${count}` : def.name, { ...titleStyle(21), shadow: undefined }).setOrigin(0.5);
    const facts = this.add.text(0, 80, itemEffects(def).join('  ·  '), bodyStyle(13, '#9fd66a')).setOrigin(0.5);
    const lines: string[] = [];
    if (first && !w.recipe.known) lines.push('A new recipe, written in your book!');
    if (xp > 0) lines.push(`+${xp} XP`);
    const extra = this.add.text(0, 110, lines.join('     '), { fontFamily: BODY_FONT, fontSize: '15px', fontStyle: 'italic', color: '#c8b0f0' }).setOrigin(0.5);
    const ok = makeButton(this, 0, ph / 2 - 44, 'Into the satchel', () => this.closePopup(), 220);
    this.popup = this.add
      .container(this.window.x, this.window.y, [panel, block, rays, title, icon, name, facts, extra, ok])
      .setScale(this.window.scale * 0.85)
      .setAlpha(0)
      .setDepth(40);
    this.tweens.add({ targets: this.popup, alpha: 1, scale: this.window.scale, duration: 260, ease: 'Back.easeOut' });
    // A shower of sparkles.
    for (let i = 0; i < 18; i++) {
      const s = this.add.circle(0, -40, 2 + Math.random() * 3, Math.random() < 0.5 ? 0xffffff : col, 1);
      this.popup.add(s);
      const a = Math.random() * Math.PI * 2;
      const d = 80 + Math.random() * 90;
      this.tweens.add({ targets: s, x: Math.cos(a) * d, y: -40 + Math.sin(a) * d, alpha: 0, duration: 700 + Math.random() * 500, ease: 'Cubic.easeOut', onComplete: () => s.destroy() });
    }
  }

  private closePopup(): void {
    const p = this.popup;
    if (!p) return;
    this.popup = undefined;
    GameAudio.pickup();
    this.popupBlock?.destroy();
    this.popupBlock = undefined;
    this.tweens.add({ targets: p, alpha: 0, scale: p.scale * 0.9, duration: 160, onComplete: () => p.destroy() });
  }

  private close(): void {
    if (this.closing || this.work) return;
    this.closing = true;
    GameAudio.bookClose();
    this.tweens.add({ targets: this.window, scale: this.window.scale * 0.92, alpha: 0, duration: 160, ease: 'Cubic.easeIn' });
    this.tweens.add({
      targets: this.dim,
      alpha: 0,
      duration: 160,
      onComplete: () => {
        this.events.emit('station-closed');
        this.scene.stop();
      },
    });
  }
}
