import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { HERO_NAME } from '../config';
import { Experience } from '../systems/Experience';
import { BAG_SIZE, EQUIP_SLOTS, EquipSlot, Inventory, ItemDef, itemDef, itemEffects, ItemId } from '../systems/Inventory';
import { bodyStyle, makeButton, makePanel, THEME, titleStyle } from '../ui/Widgets';
import type { GameScene } from './GameScene';

export type InventoryTab = 'satchel' | 'equipment';

const SLOT = 56;
const GAP = 8;
const COLS = 5;
const GRID_W = COLS * SLOT + (COLS - 1) * GAP;
const GRID_H = (BAG_SIZE / COLS) * SLOT + (BAG_SIZE / COLS - 1) * GAP;
const PAD = 28;
const DETAILS_W = 250;
/** Below this screen width the details go under the grid instead of beside it. */
const NARROW = 660;
const BODY_FONT = 'Georgia, "Times New Roman", serif';
const SLOT_FILL = 0x0d0a10;

type Selection = { kind: 'bag'; index: number } | { kind: 'slot'; slot: EquipSlot } | undefined;

/** A satchel item being pressed on, which becomes a drag once the pointer moves far enough. */
interface Drag {
  index: number;
  startX: number;
  startY: number;
  ghost?: Phaser.GameObjects.Image;
}

/** How far (in screen pixels) a press has to move before it's a drag rather than a tap. */
const DRAG_START = 8;

/**
 * The satchel (everything carried, in a grid of slots) and the equipment
 * screen (what's worn, around a portrait of the hero), as two tabs of one
 * window. Select an item to read about it and eat, equip or take it off;
 * drag items around the satchel to rearrange them, or Sort to tidy up.
 * Opens with I / C or the HUD's satchel button.
 */
export class InventoryScene extends Phaser.Scene {
  private tab: InventoryTab = 'satchel';
  private selection: Selection;
  private dim!: Phaser.GameObjects.Rectangle;
  private window!: Phaser.GameObjects.Container;
  private content!: Phaser.GameObjects.Container;
  private narrow = false;
  private panelW = 0;
  private panelH = 0;
  private closing = false;
  private drag?: Drag;
  /** Where each satchel slot sits in the window, for working out what a dragged item was dropped on. */
  private bagSlots: Array<{ x: number; y: number }> = [];
  private bagIcons: Array<Phaser.GameObjects.Image | undefined> = [];
  private dropMarker?: Phaser.GameObjects.Graphics;

  constructor() {
    super('Inventory');
  }

  private get game_(): GameScene {
    return this.scene.get('Game') as GameScene;
  }

  create(data: { tab?: InventoryTab } = {}): void {
    this.tab = data.tab ?? 'satchel';
    this.selection = undefined;
    this.closing = false;
    this.drag = undefined;

    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.55).setOrigin(0).setInteractive();
    this.dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.drag?.ghost) return;
      // Clicking outside the window closes it.
      const local = this.window.getWorldTransformMatrix().applyInverse(p.x, p.y);
      if (Math.abs(local.x) > this.panelW / 2 + 10 || Math.abs(local.y) > this.panelH / 2 + 10) this.close();
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.close());
    kb.on('keydown-I', () => (this.tab === 'satchel' ? this.close() : this.showTab('satchel')));
    kb.on('keydown-C', () => (this.tab === 'equipment' ? this.close() : this.showTab('equipment')));
    kb.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.showTab(this.tab === 'satchel' ? 'equipment' : 'satchel');
    });

    const off = Inventory.onChange((e) => {
      if (e.type === 'changed') this.build();
    });
    this.input.on('pointermove', this.onDragMove, this);
    this.input.on('pointerup', this.onDragEnd, this);
    this.input.on('pointerupoutside', this.onDragEnd, this);

    this.narrow = this.scale.width < NARROW;
    this.build();
    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this);
      off();
    });

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

  private showTab(tab: InventoryTab): void {
    if (tab === this.tab) return;
    GameAudio.pageTurn();
    this.cancelDrag();
    this.tab = tab;
    this.selection = undefined;
    this.build();
  }

  // ------------------------------------------------------------ building

  private build(): void {
    this.window?.destroy();
    this.bagSlots = [];
    this.bagIcons = [];
    this.dropMarker = undefined;
    this.panelW = this.narrow ? GRID_W + PAD * 2 : GRID_W + DETAILS_W + PAD * 3;
    this.panelH = this.narrow ? 690 : 420;
    const top = -this.panelH / 2;
    const left = -this.panelW / 2;

    const panel = makePanel(this, this.panelW, this.panelH);
    // Swallow clicks on the window so they don't reach the backdrop.
    const blocker = this.add.zone(0, 0, this.panelW, this.panelH).setInteractive();
    const tabs = this.makeTabs(top);
    const close = this.add
      .text(this.panelW / 2 - 22, top + 22, '✕', { fontFamily: BODY_FONT, fontSize: '22px', color: THEME.text })
      .setOrigin(0.5)
      .setPadding(8)
      .setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.close());
    close.on('pointerover', () => close.setColor(THEME.goldText));
    close.on('pointerout', () => close.setColor(THEME.text));

    this.content = this.add.container(0, 0);
    const areaX = left + PAD;
    const areaY = top + 84;
    if (this.tab === 'satchel') this.buildSatchel(areaX, areaY);
    else this.buildEquipment(areaX, areaY);
    const detailsX = this.narrow ? areaX : areaX + GRID_W + PAD;
    const detailsY = this.narrow ? areaY + GRID_H + 40 : areaY;
    const detailsW = this.narrow ? GRID_W : DETAILS_W;
    this.buildDetails(detailsX, detailsY, detailsW, this.panelH / 2 - PAD - detailsY);

    this.window = this.add.container(0, 0, [panel, blocker, ...tabs, close, this.content]);
    this.layout();
    // Rebuilt mid-drag: keep the lifted item's slot looking empty.
    if (this.drag?.ghost) this.bagIcons[this.drag.index]?.setAlpha(0.25);
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.dim.input!.hitArea.setSize(width, height);
    const scale = Math.min(1.15, (width - 12) / this.panelW, (height - 12) / this.panelH);
    this.window.setPosition(Math.round(width / 2), Math.round(height / 2)).setScale(scale);
  }

  private makeTabs(top: number): Phaser.GameObjects.GameObject[] {
    const tabs: Array<{ id: InventoryTab; label: string }> = [
      { id: 'satchel', label: 'Satchel' },
      { id: 'equipment', label: 'Equipment' },
    ];
    const w = 150;
    const out: Phaser.GameObjects.GameObject[] = [];
    tabs.forEach((t, i) => {
      const x = (i - 0.5) * (w + 10);
      const y = top + 40;
      const active = t.id === this.tab;
      const g = this.add.graphics();
      g.fillStyle(active ? THEME.panelLight : THEME.panel, 1);
      g.fillRoundedRect(x - w / 2, y - 20, w, 40, 10);
      g.lineStyle(active ? 2 : 1, THEME.gold, active ? 1 : 0.45);
      g.strokeRoundedRect(x - w / 2, y - 20, w, 40, 10);
      const label = this.add
        .text(x, y, t.label, { ...titleStyle(20), color: active ? THEME.goldText : THEME.dimText, shadow: undefined })
        .setOrigin(0.5);
      const hit = this.add.zone(x, y, w, 40).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.showTab(t.id));
      hit.on('pointerover', () => !active && label.setColor(THEME.text));
      hit.on('pointerout', () => !active && label.setColor(THEME.dimText));
      out.push(g, label, hit);
    });
    return out;
  }

  /** One square slot, optionally holding an item, that can be selected (and, given onPress, dragged). */
  private makeSlot(
    x: number,
    y: number,
    id: ItemId | undefined,
    count: number,
    selected: boolean,
    onClick: () => void,
    onPress?: (p: Phaser.Input.Pointer) => void,
  ): Phaser.GameObjects.Image | undefined {
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
    let icon: Phaser.GameObjects.Image | undefined;
    if (id) {
      icon = this.add.image(x + SLOT / 2, y + SLOT / 2, itemDef(id).icon).setScale(2.5);
      this.content.add(icon);
      if (count > 1) {
        const n = this.add
          .text(x + SLOT - 5, y + SLOT - 3, `${count}`, { fontFamily: BODY_FONT, fontSize: '14px', color: '#fff6e0', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 })
          .setOrigin(1, 1);
        this.content.add(n);
      }
    }
    const hit = this.add.zone(x + SLOT / 2, y + SLOT / 2, SLOT, SLOT).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    if (onPress) hit.on('pointerdown', onPress);
    hit.on('pointerup', () => {
      // A drag is dropped by onDragEnd, not taken as a click.
      if (this.drag?.ghost) return;
      GameAudio.click();
      onClick();
    });
    this.content.add(hit);
    return icon;
  }

  private buildSatchel(x0: number, y0: number): void {
    Inventory.bag.forEach((stack, i) => {
      const x = x0 + (i % COLS) * (SLOT + GAP);
      const y = y0 + Math.floor(i / COLS) * (SLOT + GAP);
      const selected = this.selection?.kind === 'bag' && this.selection.index === i;
      const press = stack ? (p: Phaser.Input.Pointer) => (this.drag = { index: i, startX: p.x, startY: p.y }) : undefined;
      this.bagSlots[i] = { x, y };
      this.bagIcons[i] = this.makeSlot(x, y, stack?.id, stack?.count ?? 0, selected, () => this.select(stack ? { kind: 'bag', index: i } : undefined), press);
    });
    this.dropMarker = this.add.graphics();
    this.content.add(this.dropMarker);
    const used = Inventory.bag.filter((s) => s !== null).length;
    const footer = this.add.text(x0, y0 + GRID_H + 10, `${used} / ${BAG_SIZE} slots`, bodyStyle(14, THEME.dimText));
    // A small button to tidy the satchel, between the count and the purse.
    const sortW = 64;
    const sortH = 26;
    const sortX = x0 + GRID_W / 2 + 4;
    const sortY = footer.y + footer.height / 2;
    const sortBg = this.add.graphics();
    const drawSort = (hover: boolean) => {
      sortBg.clear();
      sortBg.fillStyle(hover ? THEME.panelLight : THEME.panel, 0.92);
      sortBg.fillRoundedRect(sortX - sortW / 2, sortY - sortH / 2, sortW, sortH, 7);
      sortBg.lineStyle(1, THEME.gold, hover ? 1 : 0.5);
      sortBg.strokeRoundedRect(sortX - sortW / 2, sortY - sortH / 2, sortW, sortH, 7);
    };
    drawSort(false);
    const sortLabel = this.add.text(sortX, sortY, 'Sort', bodyStyle(14, THEME.text)).setOrigin(0.5);
    const sortHit = this.add.zone(sortX, sortY, sortW, sortH).setInteractive({ useHandCursor: true });
    sortHit.on('pointerover', () => {
      drawSort(true);
      sortLabel.setColor(THEME.goldText);
    });
    sortHit.on('pointerout', () => {
      drawSort(false);
      sortLabel.setColor(THEME.text);
    });
    sortHit.on('pointerup', () => {
      GameAudio.rustle();
      this.selection = undefined;
      Inventory.sort();
    });
    this.content.add([sortBg, sortLabel, sortHit]);
    // The purse, on the right.
    const coins = this.add.text(x0 + GRID_W, y0 + GRID_H + 10, `${Inventory.coins} coins`, bodyStyle(14, THEME.goldText)).setOrigin(1, 0);
    const coin = this.add.image(coins.x - coins.width - 12, coins.y + coins.height / 2, 'item-coin').setScale(1.4);
    this.content.add([footer, coins, coin]);
  }

  /** The hero in the middle, worn items in slots down either side, totals underneath. */
  private buildEquipment(x0: number, y0: number): void {
    const cx = x0 + GRID_W / 2;
    // A dark oval for the hero to stand on, and the hero drawn large.
    const stage = this.add.graphics();
    stage.fillStyle(SLOT_FILL, 0.7);
    stage.fillEllipse(cx, y0 + 168, 120, 30);
    stage.lineStyle(1, THEME.gold, 0.35);
    stage.strokeEllipse(cx, y0 + 168, 120, 30);
    const hero = this.add.image(cx, y0 + 172, 'player', 0).setOrigin(0.5, 1).setScale(3.4);
    const name = this.add.text(cx, y0 + 6, HERO_NAME, titleStyle(20)).setOrigin(0.5, 0);
    this.content.add([stage, hero, name]);

    EQUIP_SLOTS.forEach((s, i) => {
      const leftSide = i < 3;
      const x = leftSide ? x0 + 4 : x0 + GRID_W - SLOT - 4;
      const y = y0 + (i % 3) * (SLOT + 26);
      const id = Inventory.equipped[s.id];
      const selected = this.selection?.kind === 'slot' && this.selection.slot === s.id;
      this.makeSlot(x, y, id, 1, selected, () => this.select({ kind: 'slot', slot: s.id }));
      const label = this.add.text(x + SLOT / 2, y + SLOT + 3, s.label, bodyStyle(12, THEME.dimText)).setOrigin(0.5, 0);
      this.content.add(label);
    });

    const { defence, attack } = Inventory.totals;
    const totals = this.add
      .text(cx, y0 + GRID_H + 30, `Defence ${defence}     Attack ${attack}`, bodyStyle(17, THEME.goldText))
      .setOrigin(0.5, 1);
    // The hero's level, between the slots, and how far it is to the next one.
    const { into, span } = Experience.progress;
    const next = span > 0 ? `${into} / ${span} XP to level ${Experience.level + 1}` : 'Highest level';
    const level = this.add.text(cx, y0 + 196, `Level ${Experience.level}`, bodyStyle(17, THEME.goldText)).setOrigin(0.5, 0);
    const xp = this.add.text(cx, level.y + level.height + 2, next, bodyStyle(12, THEME.dimText)).setOrigin(0.5, 0);
    this.content.add([totals, level, xp]);
  }

  /** What's selected: its picture, name, description and what you can do with it. */
  private buildDetails(x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    g.fillStyle(SLOT_FILL, 0.55);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(1, THEME.gold, 0.3);
    g.strokeRoundedRect(x, y, w, h, 10);
    this.content.add(g);

    const sel = this.selection;
    const id = sel?.kind === 'bag' ? Inventory.bag[sel.index]?.id : sel?.kind === 'slot' ? Inventory.equipped[sel.slot] : undefined;
    if (!id) {
      if (sel?.kind === 'slot') this.buildEmptySlot(x, y, w, sel.slot);
      else {
        const hint = this.tab === 'satchel' ? '\n\nDrag things between slots to rearrange your satchel.' : '';
        this.addText(x + w / 2, y + h / 2, `Choose something to look at it more closely.${hint}`, w - 40, THEME.dimText, true);
      }
      return;
    }
    const def = itemDef(id);
    const pad = 16;
    const icon = this.add.image(x + pad + 28, y + pad + 28, def.icon).setScale(3.5);
    const name = this.add.text(x + pad + 66, y + pad + 6, def.name, { ...titleStyle(19), shadow: undefined, wordWrap: { width: w - pad * 2 - 66 } });
    const kind = this.add.text(x + pad + 66, name.y + name.height + 2, def.category, bodyStyle(13, THEME.dimText));
    this.content.add([icon, name, kind]);
    let ty = y + pad + 66;
    const desc = this.add.text(x + pad, ty, def.description, {
      fontFamily: BODY_FONT,
      fontSize: '15px',
      fontStyle: 'italic',
      color: THEME.text,
      lineSpacing: 3,
      wordWrap: { width: w - pad * 2 },
    });
    this.content.add(desc);
    ty += desc.height + 10;
    for (const line of itemEffects(def)) {
      const t = this.add.text(x + pad, ty, line, bodyStyle(14, '#9fd66a'));
      this.content.add(t);
      ty += t.height + 2;
    }

    const action = this.actionFor(def);
    if (action) {
      const button = makeButton(this, x + w / 2, y + h - 38, action.label, action.run, Math.min(200, w - 32));
      this.content.add(button);
    }
  }

  /** An empty equipment slot: offer whatever in the satchel could go there. */
  private buildEmptySlot(x: number, y: number, w: number, slot: EquipSlot): void {
    const label = EQUIP_SLOTS.find((s) => s.id === slot)!.label;
    const pad = 16;
    const title = this.add.text(x + pad, y + pad, label, { ...titleStyle(19), shadow: undefined });
    this.content.add(title);
    const fits = Inventory.bag
      .map((s, index) => ({ s, index }))
      .filter(({ s }) => s && itemDef(s.id).slot === slot);
    if (fits.length === 0) {
      this.addText(x + pad, y + pad + 40, 'Nothing worn here, and nothing in your satchel that would fit.', w - pad * 2, THEME.dimText, false);
      return;
    }
    this.addText(x + pad, y + pad + 40, 'Nothing worn here. From your satchel:', w - pad * 2, THEME.dimText, false);
    fits.slice(0, 3).forEach(({ s, index }, i) => {
      const button = makeButton(this, x + w / 2, y + pad + 104 + i * 62, `Wear ${itemDef(s!.id).name}`, () => this.equip(index), w - 32);
      this.content.add(button);
    });
  }

  private addText(x: number, y: number, text: string, wrap: number, color: string, centred: boolean): void {
    const t = this.add.text(x, y, text, {
      fontFamily: BODY_FONT,
      fontSize: '15px',
      fontStyle: 'italic',
      color,
      align: centred ? 'center' : 'left',
      wordWrap: { width: wrap },
    });
    if (centred) t.setOrigin(0.5);
    this.content.add(t);
  }

  private actionFor(def: ItemDef): { label: string; run: () => void } | undefined {
    const sel = this.selection;
    if (sel?.kind === 'slot') return { label: 'Take off', run: () => this.unequip(sel.slot) };
    if (sel?.kind !== 'bag') return undefined;
    if (def.eat) return { label: 'Eat', run: () => this.eat(sel.index) };
    if (def.slot) return { label: 'Wear', run: () => this.equip(sel.index) };
    return undefined;
  }

  // ------------------------------------------------------------ dragging

  private onDragMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d) return;
    if (!p.isDown) return this.cancelDrag();
    if (!d.ghost) {
      if (Phaser.Math.Distance.Between(p.x, p.y, d.startX, d.startY) < DRAG_START) return;
      const stack = Inventory.bag[d.index];
      if (!stack) return this.cancelDrag();
      // Lift the item: a copy follows the pointer and its slot looks empty.
      d.ghost = this.add
        .image(p.x, p.y, itemDef(stack.id).icon)
        .setScale(2.8 * this.window.scale)
        .setDepth(10)
        .setAlpha(0.9);
      this.bagIcons[d.index]?.setAlpha(0.25);
      GameAudio.click();
    }
    d.ghost.setPosition(p.x, p.y);
    const over = this.slotAt(p);
    this.dropMarker?.clear();
    if (over >= 0 && over !== d.index) {
      const { x, y } = this.bagSlots[over];
      this.dropMarker?.lineStyle(3, THEME.gold, 1).strokeRoundedRect(x - 2, y - 2, SLOT + 4, SLOT + 4, 8);
    }
  }

  private onDragEnd(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    this.drag = undefined;
    if (!d?.ghost) return;
    d.ghost.destroy();
    const to = this.slotAt(p);
    if (to < 0 || to === d.index || !Inventory.bag[d.index]) {
      // Dropped somewhere that isn't another slot: it goes back where it was.
      this.build();
      return;
    }
    GameAudio.pickup();
    this.selection = { kind: 'bag', index: to };
    Inventory.move(d.index, to);
  }

  private cancelDrag(): void {
    if (!this.drag) return;
    const lifted = !!this.drag.ghost;
    this.drag.ghost?.destroy();
    this.drag = undefined;
    if (lifted) this.build();
  }

  /** Which satchel slot is under the pointer, or -1. */
  private slotAt(p: Phaser.Input.Pointer): number {
    const local = this.window.getWorldTransformMatrix().applyInverse(p.x, p.y);
    return this.bagSlots.findIndex((s) => s && local.x >= s.x && local.x < s.x + SLOT && local.y >= s.y && local.y < s.y + SLOT);
  }

  // ------------------------------------------------------------ actions

  private select(selection: Selection): void {
    this.selection = selection;
    this.build();
  }

  private eat(index: number): void {
    this.game_.eat(index);
    if (!Inventory.bag[index]) this.selection = undefined;
    this.build();
  }

  private equip(index: number): void {
    const id = Inventory.bag[index]?.id;
    const slot = id && itemDef(id).slot;
    if (!slot || !Inventory.equip(index)) return;
    // Keep the newly worn item selected, on whichever tab is showing.
    this.selection = this.tab === 'equipment' ? { kind: 'slot', slot } : Inventory.bag[index] ? { kind: 'bag', index } : undefined;
    this.build();
  }

  private unequip(slot: EquipSlot): void {
    if (!Inventory.unequip(slot)) {
      this.game_.onHint?.('My satchel is too full to carry that.');
      return;
    }
    this.build();
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    this.cancelDrag();
    GameAudio.bookClose();
    this.tweens.add({ targets: this.window, scale: this.window.scale * 0.92, alpha: 0, duration: 160, ease: 'Cubic.easeIn' });
    this.tweens.add({
      targets: this.dim,
      alpha: 0,
      duration: 160,
      onComplete: () => {
        this.events.emit('inventory-closed');
        this.scene.stop();
      },
    });
  }
}
