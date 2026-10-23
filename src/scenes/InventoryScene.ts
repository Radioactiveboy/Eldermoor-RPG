import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { BAG_SIZE, EQUIP_SLOTS, EquipSlot, Inventory, ItemDef, itemDef, ItemId } from '../systems/Inventory';
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

/**
 * The satchel (everything carried, in a grid of slots) and the equipment
 * screen (what's worn, around a portrait of the hero), as two tabs of one
 * window. Select an item to read about it and eat, equip or take it off.
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

    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.55).setOrigin(0).setInteractive();
    this.dim.on('pointerup', (p: Phaser.Input.Pointer) => {
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
    this.tab = tab;
    this.selection = undefined;
    this.build();
  }

  // ------------------------------------------------------------ building

  private build(): void {
    this.window?.destroy();
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

  /** One square slot, optionally holding an item, that can be selected. */
  private makeSlot(x: number, y: number, id: ItemId | undefined, count: number, selected: boolean, onClick: () => void): void {
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
    if (id) {
      const icon = this.add.image(x + SLOT / 2, y + SLOT / 2, itemDef(id).icon).setScale(2.5);
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
    hit.on('pointerup', () => {
      GameAudio.click();
      onClick();
    });
    this.content.add(hit);
  }

  private buildSatchel(x0: number, y0: number): void {
    Inventory.bag.forEach((stack, i) => {
      const x = x0 + (i % COLS) * (SLOT + GAP);
      const y = y0 + Math.floor(i / COLS) * (SLOT + GAP);
      const selected = this.selection?.kind === 'bag' && this.selection.index === i;
      this.makeSlot(x, y, stack?.id, stack?.count ?? 0, selected, () => this.select(stack ? { kind: 'bag', index: i } : undefined));
    });
    const used = Inventory.bag.filter((s) => s !== null).length;
    const footer = this.add
      .text(x0 + GRID_W / 2, y0 + GRID_H + 10, `${used} of ${BAG_SIZE} slots used`, bodyStyle(14, THEME.dimText))
      .setOrigin(0.5, 0);
    this.content.add(footer);
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
    this.content.add([stage, hero]);

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
    this.content.add(totals);
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
      else this.addText(x + w / 2, y + h / 2, 'Choose something to look at it more closely.', w - 40, THEME.dimText, true);
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
    for (const line of this.effectLines(def)) {
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

  private effectLines(def: ItemDef): string[] {
    const lines: string[] = [];
    if (def.eat?.health) lines.push(`Eat: +${def.eat.health} health`);
    if (def.eat?.stamina) lines.push(`Eat: +${def.eat.stamina} stamina`);
    if (def.slot) lines.push(`Worn: ${EQUIP_SLOTS.find((s) => s.id === def.slot)!.label}`);
    if (def.defence) lines.push(`Defence +${def.defence}`);
    if (def.attack) lines.push(`Attack +${def.attack}`);
    return lines;
  }

  private actionFor(def: ItemDef): { label: string; run: () => void } | undefined {
    const sel = this.selection;
    if (sel?.kind === 'slot') return { label: 'Take off', run: () => this.unequip(sel.slot) };
    if (sel?.kind !== 'bag') return undefined;
    if (def.eat) return { label: 'Eat', run: () => this.eat(sel.index) };
    if (def.slot) return { label: 'Wear', run: () => this.equip(sel.index) };
    return undefined;
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
