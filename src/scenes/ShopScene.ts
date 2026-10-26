import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { Inventory, ItemDef, itemDef, itemEffects, ItemId } from '../systems/Inventory';
import { ShopDef, ShopId, Shops } from '../systems/Shops';
import { bodyStyle, makeButton, makePanel, THEME, titleStyle } from '../ui/Widgets';

export interface ShopSceneData {
  shop: ShopId;
}

type Side = 'shop' | 'bag';

const SLOT = 54;
const GAP = 6;
const COLS = 5;
const ROWS = 4;
const GRID_W = COLS * SLOT + (COLS - 1) * GAP;
const GRID_H = ROWS * SLOT + (ROWS - 1) * GAP;
const PAD = 28;
/** Space between the two grids in the wide layout. */
const MID = 56;
const LABEL_H = 28;
/** Below this screen width the grids stack instead of sitting side by side. */
const NARROW = 760;
const BODY_FONT = 'Georgia, "Times New Roman", serif';
const SLOT_FILL = 0x0d0a10;
/** Pixels the pointer must move before a press on a slot becomes a drag. */
const DRAG_START = 8;

/** One thing in one of the two grids. */
interface Entry {
  id: ItemId;
  count: number;
}

interface Drag {
  side: Side;
  id: ItemId;
  count: number;
  startX: number;
  startY: number;
  ghost?: Phaser.GameObjects.Image;
}

/** The "how many?" box shown when dropping or choosing more than one of something. */
interface Picker {
  side: Side;
  id: ItemId;
  qty: number;
  max: number;
  unit: number;
}

/**
 * Trading at a market stall. The trader's goods are on one side and the
 * satchel on the other; drag something across (or choose it and press Buy or
 * Sell) to trade. When there's more than one to move, a box asks how many,
 * with a slider and - / + buttons, and shows the total.
 *
 * Prices and stock live in systems/Shops.ts; coins in the Inventory.
 */
export class ShopScene extends Phaser.Scene {
  private shopId!: ShopId;
  private def!: ShopDef;
  private dim!: Phaser.GameObjects.Rectangle;
  private window!: Phaser.GameObjects.Container;
  private content!: Phaser.GameObjects.Container;
  private narrow = false;
  private panelW = 0;
  private panelH = 0;
  private closing = false;
  private selection?: { side: Side; id: ItemId };
  private drag?: Drag;
  /** Where each grid sits inside the window, for working out where things are dropped. */
  private grids: Record<Side, Phaser.Geom.Rectangle> = { shop: new Phaser.Geom.Rectangle(), bag: new Phaser.Geom.Rectangle() };
  private gridGlow: Partial<Record<Side, (on: boolean) => void>> = {};
  private picker?: Picker;
  private pickerUi?: Phaser.GameObjects.Container;
  private pickerBlock?: Phaser.GameObjects.Rectangle;
  /** What the trader last said (a thank-you, or why not), shown in place of the greeting for a moment. */
  private remark?: string;
  private remarkText?: Phaser.GameObjects.Text;
  private remarkTimer?: Phaser.Time.TimerEvent;
  private purseText?: Phaser.GameObjects.Text;

  constructor() {
    super('Shop');
  }

  create(data: ShopSceneData): void {
    this.shopId = data.shop;
    this.def = Shops.def(data.shop);
    this.selection = undefined;
    this.drag = undefined;
    this.picker = undefined;
    this.remark = undefined;
    this.closing = false;

    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.55).setOrigin(0).setInteractive();
    this.dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      // Clicking outside the window closes it (but not letting go of something dragged out there).
      if (this.drag || this.picker) return;
      const local = this.window.getWorldTransformMatrix().applyInverse(p.x, p.y);
      if (Math.abs(local.x) > this.panelW / 2 + 10 || Math.abs(local.y) > this.panelH / 2 + 10) this.close();
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => (this.picker ? this.closePicker() : this.close()));
    kb.on('keydown-ENTER', () => this.picker && this.confirmPicker());
    kb.on('keydown-E', () => this.picker && this.confirmPicker());
    for (const [key, step] of [['LEFT', -1], ['A', -1], ['MINUS', -1], ['RIGHT', 1], ['D', 1], ['PLUS', 1], ['UP', 5], ['DOWN', -5]] as const) {
      kb.on(`keydown-${key}`, () => this.picker && this.setQty(this.picker.qty + step));
    }

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onDragMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onDragEnd(p));

    this.narrow = this.scale.width < NARROW;
    this.build();
    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.onResize, this));

    GameAudio.bookOpen();
    const target = this.window.scale;
    this.window.setScale(target * 0.9).setAlpha(0);
    this.tweens.add({ targets: this.window, scale: target, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  }

  private onResize(): void {
    const narrow = this.scale.width < NARROW;
    if (narrow !== this.narrow) {
      this.narrow = narrow;
      this.build();
    } else {
      this.layout();
    }
  }

  private get keeperName(): string {
    return this.def.name.split("'")[0];
  }

  // ------------------------------------------------------------ building

  private build(): void {
    this.window?.destroy();
    this.gridGlow = {};
    const header = this.narrow ? 118 : 104;
    const gridsH = this.narrow ? (LABEL_H + GRID_H) * 2 + 16 : LABEL_H + GRID_H;
    const detailsH = this.narrow ? 150 : 118;
    this.panelW = this.narrow ? GRID_W + PAD * 2 : GRID_W * 2 + MID + PAD * 2;
    this.panelH = PAD + header + gridsH + 18 + detailsH + PAD;
    const top = -this.panelH / 2;
    const left = -this.panelW / 2;

    const panel = makePanel(this, this.panelW, this.panelH);
    const blocker = this.add.zone(0, 0, this.panelW, this.panelH).setInteractive();
    blocker.on('pointerup', () => {
      // A click on the window's background (not a slot or button) clears the selection.
      if (!this.drag && this.selection) this.select(undefined);
    });
    this.content = this.add.container(0, 0);
    this.buildHeader(left + PAD, top + PAD, this.panelW - PAD * 2);

    const gridY = top + PAD + header;
    if (this.narrow) {
      this.buildGrid('shop', left + PAD, gridY);
      this.buildGrid('bag', left + PAD, gridY + LABEL_H + GRID_H + 16);
    } else {
      this.buildGrid('shop', left + PAD, gridY);
      this.buildGrid('bag', left + PAD + GRID_W + MID, gridY);
      // Arrows between the two sides, a reminder that things can be dragged across.
      const arrows = this.add.text(0, gridY + LABEL_H + GRID_H / 2, '⇄', { fontFamily: BODY_FONT, fontSize: '30px', color: THEME.goldText }).setOrigin(0.5).setAlpha(0.6);
      this.content.add(arrows);
    }
    this.buildDetails(left + PAD, gridY + gridsH + 18, this.panelW - PAD * 2, detailsH);

    const close = this.add
      .text(this.panelW / 2 - 22, top + 22, '✕', { fontFamily: BODY_FONT, fontSize: '22px', color: THEME.text })
      .setOrigin(0.5)
      .setPadding(8)
      .setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.close());
    close.on('pointerover', () => close.setColor(THEME.goldText));
    close.on('pointerout', () => close.setColor(THEME.text));

    this.window = this.add.container(0, 0, [panel, blocker, this.content, close]);
    this.layout();
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.dim.input!.hitArea.setSize(width, height);
    const scale = Math.min(1.15, (width - 12) / this.panelW, (height - 12) / this.panelH);
    this.window.setPosition(Math.round(width / 2), Math.round(height / 2)).setScale(scale);
    if (this.picker) this.buildPicker();
  }

  /** The trader's portrait, the stall's name, what they say, and the hero's purse. */
  private buildHeader(x: number, y: number, w: number): void {
    const frame = this.add.graphics();
    frame.fillStyle(SLOT_FILL, 0.8);
    frame.fillRoundedRect(x, y, 80, 80, 8);
    frame.lineStyle(2, THEME.gold, 0.8);
    frame.strokeRoundedRect(x, y, 80, 80, 8);
    const portrait = this.add.image(x + 40, y + 40, `portrait-${this.def.keeper}`, 0).setDisplaySize(76, 76);
    const purseW = 120;
    const name = this.add.text(x + 96, y + 2, this.def.name, { ...titleStyle(this.narrow ? 19 : 24), shadow: undefined });
    this.remarkText = this.add.text(x + 96, name.y + name.height + 6, '', {
      fontFamily: BODY_FONT,
      fontSize: this.narrow ? '14px' : '16px',
      fontStyle: 'italic',
      color: THEME.text,
      lineSpacing: 2,
      wordWrap: { width: w - 96 - (this.narrow ? 0 : purseW) },
    });
    this.updateRemark();

    // The purse: a coin and how many the hero has. Narrow screens put it under the name.
    const px = this.narrow ? x + w : x + w - 30;
    const py = this.narrow ? y + 108 : y + 24;
    this.purseText = this.add.text(px, py, `${Inventory.coins}`, { ...titleStyle(this.narrow ? 20 : 26), shadow: undefined }).setOrigin(1, 0.5);
    const coin = this.add.image(this.purseText.x - this.purseText.width - 16, py, 'item-coin').setScale(2);
    const label = this.add.text(px, py + 22, 'your purse', bodyStyle(12, THEME.dimText)).setOrigin(1, 0.5);
    if (this.narrow) label.setVisible(false);
    this.content.add([frame, portrait, name, this.remarkText, this.purseText, coin, label]);
  }

  private updateRemark(): void {
    const text = this.remark ?? this.def.greeting;
    this.remarkText?.setText(`"${text}"`).setColor(this.remark ? THEME.goldText : THEME.text);
  }

  /** The trader says something for a few seconds. */
  private say(text: string): void {
    this.remark = text;
    this.updateRemark();
    this.remarkTimer?.remove();
    this.remarkTimer = this.time.delayedCall(3500, () => {
      this.remark = undefined;
      this.updateRemark();
    });
  }

  private entries(side: Side): Entry[] {
    if (side === 'shop') return Shops.goods(this.shopId).map((g) => ({ ...g }));
    return Inventory.bag.filter((s) => s !== null).map((s) => ({ id: s!.id, count: s!.count }));
  }

  /** A titled grid of slots: the stall's goods, or the satchel. */
  private buildGrid(side: Side, x0: number, y0: number): void {
    const title = side === 'shop' ? 'For sale' : 'Your satchel';
    const label = this.add.text(x0 + 2, y0 + 2, title, { ...titleStyle(17), shadow: undefined });
    this.content.add(label);
    const gy = y0 + LABEL_H;
    this.grids[side].setTo(x0 - GAP, gy - GAP, GRID_W + GAP * 2, GRID_H + GAP * 2);

    // A frame round the grid that lights up when something is dragged over it.
    const glow = this.add.graphics();
    const r = this.grids[side];
    const draw = (on: boolean) => {
      glow.clear();
      glow.lineStyle(on ? 3 : 1, THEME.gold, on ? 1 : 0.25);
      glow.strokeRoundedRect(r.x, r.y, r.width, r.height, 10);
      if (on) {
        glow.fillStyle(THEME.gold, 0.08);
        glow.fillRoundedRect(r.x, r.y, r.width, r.height, 10);
      }
    };
    draw(false);
    this.gridGlow[side] = draw;
    this.content.add(glow);

    const list = side === 'shop' ? this.entries('shop') : Inventory.bag.map((s) => (s ? { id: s.id, count: s.count } : null));
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = x0 + (i % COLS) * (SLOT + GAP);
      const y = gy + Math.floor(i / COLS) * (SLOT + GAP);
      this.makeSlot(side, x, y, list[i] ?? undefined);
    }
  }

  private makeSlot(side: Side, x: number, y: number, entry: Entry | undefined): void {
    const selected = !!entry && this.selection?.side === side && this.selection.id === entry.id;
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(selected ? THEME.panelLight : SLOT_FILL, selected ? 1 : 0.85);
      g.fillRoundedRect(x, y, SLOT, SLOT, 7);
      g.lineStyle(selected ? 2 : 1, THEME.gold, selected ? 1 : hover ? 0.8 : 0.35);
      g.strokeRoundedRect(x, y, SLOT, SLOT, 7);
    };
    draw(false);
    this.content.add(g);
    if (!entry) return;

    // The price: what it costs on the stall, or what the trader would pay for it in the satchel.
    const price = side === 'shop' ? Shops.price(entry.id) : Shops.offer(this.shopId, entry.id);
    const icon = this.add.image(x + SLOT / 2, y + SLOT / 2 + 2, itemDef(entry.id).icon).setScale(2.4);
    // Things the trader won't buy are greyed out.
    if (price === 0) icon.setAlpha(0.35);
    this.content.add(icon);
    if (price > 0) {
      const tag = this.add.text(x + 4, y + 2, `${price}`, { fontFamily: BODY_FONT, fontSize: '12px', color: THEME.goldText, fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 });
      this.content.add(tag);
    }
    if (entry.count > 1) {
      const n = this.add
        .text(x + SLOT - 4, y + SLOT - 2, `${entry.count}`, { fontFamily: BODY_FONT, fontSize: '14px', color: '#fff6e0', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 })
        .setOrigin(1, 1);
      this.content.add(n);
    }
    const hit = this.add.zone(x + SLOT / 2, y + SLOT / 2, SLOT, SLOT).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.picker) return;
      this.drag = { side, id: entry.id, count: entry.count, startX: p.x, startY: p.y };
    });
    this.content.add(hit);
  }

  /** The chosen item up close: what it is, what it does, its price, and a Buy or Sell button. */
  private buildDetails(x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    g.fillStyle(SLOT_FILL, 0.55);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(1, THEME.gold, 0.3);
    g.strokeRoundedRect(x, y, w, h, 10);
    this.content.add(g);

    const sel = this.selection;
    if (!sel) {
      const touch = this.sys.game.device.input.touch;
      const hint = `Drag things between the stall and your satchel to buy and sell, or ${touch ? 'tap' : 'click'} one to look at it.`;
      const t = this.add
        .text(x + w / 2, y + h / 2, hint, { fontFamily: BODY_FONT, fontSize: '15px', fontStyle: 'italic', color: THEME.dimText, align: 'center', wordWrap: { width: w - 40 } })
        .setOrigin(0.5);
      this.content.add(t);
      return;
    }
    const def = itemDef(sel.id);
    const pad = 14;
    const buttonW = this.narrow ? 0 : 150;
    const textW = w - pad * 2 - 64 - (buttonW ? buttonW + 24 : 0);
    const icon = this.add.image(x + pad + 26, y + pad + 26, def.icon).setScale(3.2);
    const name = this.add.text(x + pad + 64, y + pad - 2, def.name, { ...titleStyle(18), shadow: undefined });
    const facts = [def.category, ...itemEffects(def)].join('  ·  ');
    const kind = this.add.text(name.x, name.y + name.height + 1, facts, { ...bodyStyle(13, '#9fd66a'), wordWrap: { width: textW } });
    const desc = this.add.text(name.x, kind.y + kind.height + 4, def.description, {
      fontFamily: BODY_FONT,
      fontSize: '14px',
      fontStyle: 'italic',
      color: THEME.text,
      wordWrap: { width: textW },
    });
    this.content.add([icon, name, kind, desc]);

    const action = this.priceLine(sel.side, sel.id, def);
    const price = this.add.text(name.x, desc.y + desc.height + 5, action.line, bodyStyle(14, action.ok ? THEME.goldText : '#d08a6a'));
    this.content.add(price);
    if (action.ok) {
      const bx = this.narrow ? x + w - 70 : x + w - pad - buttonW / 2;
      const by = this.narrow ? y + h - 36 : y + h / 2;
      const button = makeButton(this, bx, by, sel.side === 'shop' ? 'Buy' : 'Sell', () => this.startTrade(sel.side, sel.id), this.narrow ? 120 : buttonW);
      this.content.add(button);
    }
  }

  /** The price line under an item's description, and whether it can be traded at all. */
  private priceLine(side: Side, id: ItemId, def: ItemDef): { line: string; ok: boolean } {
    const worn = def.slot ? Inventory.equipped[def.slot] : undefined;
    const wearing = def.slot ? `   (wearing: ${worn ? itemDef(worn).name : 'nothing'})` : '';
    if (side === 'shop') {
      const stock = Shops.goods(this.shopId).find((g) => g.id === id)?.count ?? 0;
      return { line: `${Shops.price(id)} coins each, ${stock} on the stall${wearing}`, ok: stock > 0 };
    }
    const offer = Shops.offer(this.shopId, id);
    if (offer === 0) return { line: def.value ? `${this.keeperName} doesn't deal in these.` : "You'd never sell this.", ok: false };
    return { line: `${this.keeperName} pays ${offer} coin${offer === 1 ? '' : 's'} each`, ok: true };
  }

  // ------------------------------------------------------------ dragging

  private onDragMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || !p.isDown) return;
    if (!d.ghost) {
      if (Math.hypot(p.x - d.startX, p.y - d.startY) < DRAG_START) return;
      d.ghost = this.add.image(p.x, p.y, itemDef(d.id).icon).setScale(2.6 * this.window.scale).setAlpha(0.9).setDepth(50);
      this.tweens.add({ targets: d.ghost, scale: d.ghost.scale * 1.15, duration: 120, yoyo: true });
    }
    d.ghost.setPosition(p.x, p.y);
    const over = this.gridAt(p);
    const target: Side = d.side === 'shop' ? 'bag' : 'shop';
    this.gridGlow[target]?.(over === target);
  }

  private onDragEnd(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d) return;
    this.drag = undefined;
    if (!d.ghost) {
      // Pressed and let go without moving: a click, which selects it.
      GameAudio.click();
      this.select({ side: d.side, id: d.id });
      return;
    }
    const over = this.gridAt(p);
    const ghost = d.ghost;
    for (const glow of Object.values(this.gridGlow)) glow?.(false);
    if (over && over !== d.side) {
      ghost.destroy();
      this.selection = { side: d.side, id: d.id };
      this.startTrade(d.side, d.id, d.count);
      return;
    }
    // Dropped back where it came from (or off the window): it slides back and nothing happens.
    this.tweens.add({ targets: ghost, alpha: 0, scale: ghost.scale * 0.6, duration: 150, onComplete: () => ghost.destroy() });
  }

  private gridAt(p: Phaser.Input.Pointer): Side | undefined {
    const local = this.window.getWorldTransformMatrix().applyInverse(p.x, p.y);
    if (this.grids.shop.contains(local.x, local.y)) return 'shop';
    if (this.grids.bag.contains(local.x, local.y)) return 'bag';
    return undefined;
  }

  // ------------------------------------------------------------ trading

  private select(selection: { side: Side; id: ItemId } | undefined): void {
    this.selection = selection;
    this.build();
  }

  /**
   * Buy or sell something: straight away if only one can change hands, or
   * via the "how many?" box. `suggested` is the stack that was dragged, the
   * natural amount to sell.
   */
  private startTrade(side: Side, id: ItemId, suggested = 1): void {
    const { max, reason } = this.limit(side, id);
    if (max === 0) {
      GameAudio.hover();
      this.say(reason);
      return;
    }
    const unit = side === 'shop' ? Shops.price(id) : Shops.offer(this.shopId, id);
    if (max === 1) {
      this.trade(side, id, 1);
      return;
    }
    this.picker = { side, id, max, unit, qty: side === 'bag' ? Phaser.Math.Clamp(suggested, 1, max) : 1 };
    this.buildPicker();
  }

  /** The most of something that can change hands, and if none, why not. */
  private limit(side: Side, id: ItemId): { max: number; reason: string } {
    if (side === 'bag') {
      if (Shops.offer(this.shopId, id) === 0) return { max: 0, reason: this.def.refuse };
      return { max: Inventory.count(id), reason: '' };
    }
    const price = Shops.price(id);
    const stock = Shops.goods(this.shopId).find((g) => g.id === id)?.count ?? 0;
    const afford = price > 0 ? Math.floor(Inventory.coins / price) : stock;
    const room = Inventory.room(id);
    if (afford === 0) return { max: 0, reason: `That's ${price} coins, and you've only got ${Inventory.coins}.` };
    if (room === 0) return { max: 0, reason: "You've no room for it. Your satchel is full." };
    return { max: Math.min(stock, afford, room), reason: '' };
  }

  private trade(side: Side, id: ItemId, qty: number): void {
    const { max } = this.limit(side, id);
    const n = Math.min(qty, max);
    if (n <= 0) return;
    if (side === 'shop') {
      const cost = Shops.price(id) * n;
      if (!Inventory.canAdd(id, n) || !Inventory.addCoins(-cost)) return;
      Inventory.add(id, n);
      Shops.take(this.shopId, id, n);
      this.floatCoins(-cost);
    } else {
      const pay = Shops.offer(this.shopId, id) * n;
      if (!Inventory.remove(id, n)) return;
      Inventory.addCoins(pay);
      Shops.put(this.shopId, id, n);
      this.floatCoins(pay);
    }
    GameAudio.coins();
    const thanks = this.def.thanks;
    this.say(thanks[Math.floor(Math.random() * thanks.length)]);
    // Keep the item selected while there's any of it left on that side.
    if (this.selection && !this.entries(this.selection.side).some((e) => e.id === this.selection!.id)) this.selection = undefined;
    this.build();
  }

  /** "+12" or "-6" rising from the purse. */
  private floatCoins(amount: number): void {
    const purse = this.purseText;
    if (!purse) return;
    const m = purse.getWorldTransformMatrix();
    const s = this.window.scale;
    const t = this.add
      .text(m.tx - (purse.width / 2) * s, m.ty, `${amount > 0 ? '+' : ''}${amount}`, {
        fontFamily: BODY_FONT,
        fontSize: `${Math.round(20 * s)}px`,
        fontStyle: 'bold',
        color: amount > 0 ? '#9fd66a' : '#e08060',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({ targets: t, y: t.y - 40 * s, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------ how many?

  private buildPicker(): void {
    const pk = this.picker;
    if (!pk) return;
    this.pickerUi?.destroy();
    this.pickerBlock?.destroy();
    const { width, height } = this.scale;
    // Shades the window behind and swallows clicks outside the box; clicking there cancels.
    this.pickerBlock = this.add.rectangle(0, 0, width, height, 0x000000, 0.45).setOrigin(0).setInteractive().setDepth(39);
    this.pickerBlock.on('pointerup', () => this.closePicker());

    const w = 360;
    const h = 300;
    const def = itemDef(pk.id);
    const buying = pk.side === 'shop';
    const panel = makePanel(this, w, h);
    const block = this.add.zone(0, 0, w, h).setInteractive();
    const title = this.add.text(0, -h / 2 + 30, `${buying ? 'Buy' : 'Sell'} ${def.name}`, { ...titleStyle(21), shadow: undefined }).setOrigin(0.5);
    const rowY = -h / 2 + 92;
    const icon = this.add.image(-w / 2 + 62, rowY, def.icon).setScale(3.6);
    const qty = this.add.text(48, rowY, '', { ...titleStyle(30), shadow: undefined }).setOrigin(0.5);
    const minus = this.stepButton(-28, rowY, '−', () => this.setQty(pk.qty - 1));
    const plus = this.stepButton(124, rowY, '+', () => this.setQty(pk.qty + 1));
    const total = this.add.text(12, rowY + 112, '', bodyStyle(18, THEME.goldText)).setOrigin(0.5);
    const coin = this.add.image(0, rowY + 112, 'item-coin').setScale(1.6);

    // A slider from 1 to the most that can change hands.
    const barX = -w / 2 + 40;
    const barW = w - 80;
    const barY = rowY + 54;
    const bar = this.add.graphics();
    const knob = this.add.circle(0, barY, 11, THEME.gold).setStrokeStyle(2, 0x2a1a08);
    const lo = this.add.text(barX, barY + 18, '1', bodyStyle(12, THEME.dimText)).setOrigin(0.5, 0);
    const hi = this.add.text(barX + barW, barY + 18, `${pk.max}`, bodyStyle(12, THEME.dimText)).setOrigin(0.5, 0);
    const track = this.add.zone(barX + barW / 2, barY, barW + 28, 34).setInteractive({ useHandCursor: true, draggable: true });
    const fromPointer = (p: Phaser.Input.Pointer) => {
      const local = this.pickerUi!.getWorldTransformMatrix().applyInverse(p.x, p.y);
      const f = Phaser.Math.Clamp((local.x - barX) / barW, 0, 1);
      this.setQty(1 + Math.round(f * (pk.max - 1)));
    };
    track.on('pointerdown', fromPointer);
    track.on('drag', fromPointer);

    const cancel = makeButton(this, -w / 4 - 4, h / 2 - 46, 'Cancel', () => this.closePicker(), w / 2 - 36);
    const ok = makeButton(this, w / 4 + 4, h / 2 - 46, buying ? 'Buy' : 'Sell', () => this.confirmPicker(), w / 2 - 36);

    const refresh = () => {
      qty.setText(`${pk.qty}`);
      const f = pk.max > 1 ? (pk.qty - 1) / (pk.max - 1) : 1;
      bar.clear();
      bar.fillStyle(0x000000, 0.6);
      bar.fillRoundedRect(barX, barY - 5, barW, 10, 5);
      bar.fillStyle(THEME.gold, 0.85);
      bar.fillRoundedRect(barX, barY - 5, Math.max(10, barW * f), 10, 5);
      knob.x = barX + barW * f;
      const sum = pk.qty * pk.unit;
      total.setText(buying ? `Total: ${sum}   (you have ${Inventory.coins})` : `You get: ${sum}`);
      coin.x = total.x - total.width / 2 - 14;
    };
    this.pickerUi = this.add
      .container(this.window.x, this.window.y, [panel, block, title, icon, minus, qty, plus, bar, knob, lo, hi, track, total, coin, cancel, ok])
      .setScale(this.window.scale)
      .setDepth(40);
    this.pickerUi.setData('refresh', refresh);
    refresh();
  }

  private stepButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(hover ? THEME.panelLight : SLOT_FILL, 1);
      g.fillRoundedRect(-20, -20, 40, 40, 8);
      g.lineStyle(2, THEME.gold, hover ? 1 : 0.6);
      g.strokeRoundedRect(-20, -20, 40, 40, 8);
    };
    draw(false);
    const t = this.add.text(0, -1, label, { ...titleStyle(24), shadow: undefined }).setOrigin(0.5);
    const c = this.add.container(x, y, [g, t]).setSize(40, 40).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => draw(true));
    c.on('pointerout', () => draw(false));
    c.on('pointerup', () => {
      GameAudio.click();
      onClick();
    });
    return c;
  }

  private setQty(n: number): void {
    const pk = this.picker;
    if (!pk) return;
    const q = Phaser.Math.Clamp(Math.round(n), 1, pk.max);
    if (q === pk.qty) return;
    pk.qty = q;
    GameAudio.hover();
    (this.pickerUi?.getData('refresh') as (() => void) | undefined)?.();
  }

  private confirmPicker(): void {
    const pk = this.picker;
    if (!pk) return;
    this.closePicker();
    this.trade(pk.side, pk.id, pk.qty);
  }

  private closePicker(): void {
    this.picker = undefined;
    this.pickerUi?.destroy();
    this.pickerBlock?.destroy();
    this.pickerUi = undefined;
    this.pickerBlock = undefined;
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    this.closePicker();
    GameAudio.bookClose();
    this.tweens.add({ targets: this.window, scale: this.window.scale * 0.92, alpha: 0, duration: 160, ease: 'Cubic.easeIn' });
    this.tweens.add({
      targets: this.dim,
      alpha: 0,
      duration: 160,
      onComplete: () => {
        this.events.emit('shop-closed');
        this.scene.stop();
      },
    });
  }
}
