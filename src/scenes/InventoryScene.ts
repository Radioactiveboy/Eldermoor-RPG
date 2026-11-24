import { Display } from '../ui/Display';
import Phaser from 'phaser';
import { HERO_DOLL_KEY, paintHeroDoll } from '../art/heroDoll';
import { itemScale } from '../art/sizes';
import { GameAudio } from '../audio/Audio';
import { HERO_NAME } from '../config';
import { Experience } from '../systems/Experience';
import { heroSheet } from '../systems/HeroSheet';
import {
  BAG_SIZE,
  compareGear,
  EquipSlot,
  groupCounts,
  Inventory,
  ItemCategory,
  ItemDef,
  itemDef,
  itemEffects,
  ItemId,
  SatchelGroup,
  satchelGroup,
  slotLabel,
  SortKey,
} from '../systems/Inventory';
import { ensureGlyphs, GLYPH_SIZE, glyphKey, GlyphName } from '../ui/Glyphs';
import { bodyStyle, makePanel, THEME, titleStyle } from '../ui/Widgets';
import type { GameScene } from './GameScene';

export type InventoryTab = 'satchel' | 'equipment';

// ---------------------------------------------------------------- sizes

/** The satchel's slots. */
const SLOT = 60;
const GAP = 6;
const COLS = 5;
const ROWS = BAG_SIZE / COLS;
const GRID_W = COLS * SLOT + (COLS - 1) * GAP;
const GRID_H = ROWS * SLOT + (ROWS - 1) * GAP;
/** The equipment slots down either side of the hero, and the two weapon slots under their feet. */
const EQ = 58;
const EQ_GAP = 10;
const WEAPON = 66;
/** The paper doll: four slots down each side, the hero between them, the weapons beneath. */
const DOLL_SIDE_H = 4 * EQ + 3 * EQ_GAP;
const DOLL_H = DOLL_SIDE_H + 14 + WEAPON;
const STATS_H = 62;
/** The hero picture's size (see art/heroDoll.ts). */
const HERO_W = 160;
const HERO_H = 240;

const PAD = 24;
/** Side by side: the character on the left, the satchel on the right. */
const LEFT_W = 372;
const COL_GAP = 34;
const WIDE_W = PAD * 2 + LEFT_W + COL_GAP + GRID_W;
const WIDE_H = 552;
/** One at a time, under tabs, on a tall narrow screen (a phone held upright). */
const NARROW_PAD = 18;
const NARROW_W = GRID_W + NARROW_PAD * 2;
const NARROW_H = 820;
/** Below this the side-by-side window would be too small to read, so the narrow one is used. */
const MIN_WIDE_SCALE = 0.6;

const FILTER_H = 46;
const CHIP_H = 30;
const CARD_W = 276;
const BODY_FONT = 'Merriweather, Georgia, "Times New Roman", serif';
const SLOT_FILL = 0x0d0a10;
/** Two taps (or clicks) on the same slot this close together use the item. */
const DOUBLE_TAP_MS = 340;
/** How far (in screen pixels) a press has to move before it's a drag rather than a tap. */
const DRAG_START = 8;

/** Each kind of thing's colour: its slot's rim and its name in the tooltip. */
const CATEGORY_COLOR: Record<ItemCategory | 'Quest', number> = {
  Weapon: 0xe0805f,
  Armour: 0x8fb4dc,
  Clothing: 0x9dcf86,
  Tool: 0xc9a46a,
  Potion: 0xc48fe6,
  Food: 0xe8b66a,
  Material: 0xb9a68c,
  Quest: 0xf2d47a,
};
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const colorOf = (def: ItemDef) => CATEGORY_COLOR[def.quest ? 'Quest' : def.category];

/** Where each equipment slot sits on the doll. */
const LEFT_SLOTS: EquipSlot[] = ['head', 'neck', 'cloak', 'body'];
const RIGHT_SLOTS: EquipSlot[] = ['hands', 'ring', 'trinket', 'feet'];
const WEAPON_SLOTS: EquipSlot[] = ['mainHand', 'offHand'];

type Filter = SatchelGroup | 'all';
const FILTERS: Array<{ id: Filter; label: string; glyph: GlyphName }> = [
  { id: 'all', label: 'All', glyph: 'all' },
  { id: 'food', label: 'Food', glyph: 'food' },
  { id: 'gear', label: 'Gear', glyph: 'gear' },
  { id: 'materials', label: 'Materials', glyph: 'materials' },
  { id: 'quest', label: 'Quest', glyph: 'quest' },
];
const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: 'type', label: 'Type' },
  { id: 'value', label: 'Value' },
  { id: 'name', label: 'Name' },
];
/** The filter and sort last chosen, kept while the game is open. */
let shownFilter: Filter = 'all';
let lastSort: SortKey = 'type';

type Selection = { kind: 'bag'; index: number } | { kind: 'slot'; slot: EquipSlot };
const sameSel = (a: Selection | undefined, b: Selection | undefined) =>
  !!a && !!b && a.kind === b.kind && (a.kind === 'bag' ? a.index === (b as typeof a).index : a.slot === (b as typeof a).slot);

/** Something being pressed on, which becomes a drag once the pointer moves far enough. */
interface Drag {
  from: Selection;
  id: ItemId;
  startX: number;
  startY: number;
  ghost?: Phaser.GameObjects.Image;
}

/** A slot drawn on screen: where it is, for dropping things on, and how to light it up. */
interface SlotView {
  sel: Selection;
  x: number;
  y: number;
  size: number;
  icon?: Phaser.GameObjects.Image;
  redraw: (state: 'idle' | 'hover' | 'target') => void;
}

/**
 * The satchel and the hero's equipment, in the manner of a paper doll: the hero
 * drawn large with what they wear in slots around them (head, neck, cloak, body
 * down one side; hands, ring, trinket, feet down the other; weapons beneath),
 * their fighting numbers under that, and the satchel's grid beside it. On a
 * narrow screen the two go under tabs instead.
 *
 * Hover over anything for a tooltip (what it is, what it does, how it compares
 * with what's worn); click or tap to pin it, with buttons to eat, wear or take
 * off; double-click or tap twice to do that straight away. Drag things around
 * the satchel, onto the doll to wear them, or off it to take them off. Tabs over
 * the satchel pick out food, gear, materials or quest things (the rest fade back).
 * Opens with I / C or the HUD's satchel button.
 */
export class InventoryScene extends Phaser.Scene {
  private tab: InventoryTab = 'satchel';
  private selection: Selection | undefined;
  private hover: Selection | undefined;
  private dim!: Phaser.GameObjects.Rectangle;
  private window!: Phaser.GameObjects.Container;
  private content!: Phaser.GameObjects.Container;
  private card?: Phaser.GameObjects.Container;
  private wide = true;
  private panelW = 0;
  private panelH = 0;
  /** Narrow screens show the selected thing's card here, under the grid or the doll. */
  private dock?: { x: number; y: number; w: number; h: number };
  private closing = false;
  private drag?: Drag;
  private slots: SlotView[] = [];
  private lastTap?: { sel: Selection; at: number };
  private touch = false;

  constructor() {
    super('Inventory');
  }

  private get game_(): GameScene {
    return this.scene.get('Game') as GameScene;
  }

  create(data: { tab?: InventoryTab } = {}): void {
    this.tab = data.tab ?? 'satchel';
    this.selection = undefined;
    this.hover = undefined;
    this.closing = false;
    this.drag = undefined;
    this.touch = !this.sys.game.device.os.desktop;
    ensureGlyphs(this);

    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.6).setOrigin(0).setInteractive();
    this.dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.drag?.ghost) return;
      // Clicking outside the window closes it.
      const local = this.toLocal(p);
      if (Math.abs(local.x) > this.panelW / 2 + 10 || Math.abs(local.y) > this.panelH / 2 + 10) this.close();
    });

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => {
      if (this.selection) this.select(undefined);
      else this.close();
    });
    kb.on('keydown-I', () => (this.wide || this.tab === 'satchel' ? this.close() : this.showTab('satchel')));
    kb.on('keydown-C', () => (this.wide || this.tab === 'equipment' ? this.close() : this.showTab('equipment')));
    kb.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      if (!this.wide) this.showTab(this.tab === 'satchel' ? 'equipment' : 'satchel');
    });

    const off = Inventory.onChange((e) => {
      if (e.type === 'changed') this.build();
    });
    this.input.on('pointermove', this.onDragMove, this);
    this.input.on('pointerup', this.onDragEnd, this);
    this.input.on('pointerupoutside', this.onDragEnd, this);

    this.wide = this.fitsWide();
    this.build();
    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.onResize, this);
      off();
    });

    GameAudio.bookOpen();
    const target = this.window.scale;
    this.window.setScale(target * 0.94).setAlpha(0);
    this.tweens.add({ targets: this.window, scale: target, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  }

  private fitsWide(): boolean {
    const { width, height } = this.scale;
    return Math.min((width - 12) / WIDE_W, (height - 12) / WIDE_H) >= MIN_WIDE_SCALE;
  }

  private onResize(): void {
    const wide = this.fitsWide();
    if (wide !== this.wide) {
      this.wide = wide;
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
    this.hover = undefined;
    this.build();
  }

  private toLocal(p: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    const pt = Display.point(p);
    return this.window.getWorldTransformMatrix().applyInverse(pt.x, pt.y);
  }

  // ------------------------------------------------------------ building

  private build(): void {
    this.window?.destroy();
    this.slots = [];
    this.card = undefined;
    this.dock = undefined;
    this.panelW = this.wide ? WIDE_W : NARROW_W;
    this.panelH = this.wide ? WIDE_H : NARROW_H;
    const top = -this.panelH / 2;
    const left = -this.panelW / 2;

    const panel = makePanel(this, this.panelW, this.panelH);
    const trim = this.add.graphics();
    this.drawCorners(trim, left, top, this.panelW, this.panelH);
    // Swallow clicks on the window so they don't reach the backdrop; a click on
    // nothing in particular lets go of what's selected.
    const blocker = this.add.zone(0, 0, this.panelW, this.panelH).setInteractive();
    blocker.on('pointerup', () => {
      if (this.drag?.ghost || !this.selection) return;
      this.select(undefined);
    });
    const close = this.add
      .text(this.panelW / 2 - 30, top + 30, '✕', { fontFamily: BODY_FONT, fontSize: '22px', color: THEME.text })
      .setOrigin(0.5)
      .setPadding(8)
      .setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.close());
    close.on('pointerover', () => close.setColor(THEME.goldText));
    close.on('pointerout', () => close.setColor(THEME.text));

    this.content = this.add.container(0, 0);
    const parts: Phaser.GameObjects.GameObject[] = [panel, trim, blocker];

    if (this.wide) {
      const lx = left + PAD;
      const rx = lx + LEFT_W + COL_GAP;
      this.buildCharacter(lx, top + 22, LEFT_W);
      this.buildSatchel(rx, top + 22, true);
      // A gold rule between the two halves, with a diamond at its middle.
      const div = this.add.graphics();
      const dx = lx + LEFT_W + COL_GAP / 2;
      div.lineStyle(1, THEME.gold, 0.28);
      div.lineBetween(dx, top + 34, dx, top + this.panelH - 34);
      div.fillStyle(THEME.gold, 0.7);
      div.fillPoints([new Phaser.Math.Vector2(dx, -8), new Phaser.Math.Vector2(dx + 5, 0), new Phaser.Math.Vector2(dx, 8), new Phaser.Math.Vector2(dx - 5, 0)], true);
      this.content.add(div);
    } else {
      parts.push(...this.makeTabs(top));
      const x = left + NARROW_PAD;
      const y = top + 78;
      const bottom = this.tab === 'satchel' ? this.buildSatchel(x, y, false) : this.buildCharacter(x, y, GRID_W);
      this.dock = { x, y: bottom + 14, w: GRID_W, h: top + this.panelH - NARROW_PAD - (bottom + 14) };
    }

    this.window = this.add.container(0, 0, [...parts, close, this.content]);
    this.layout();
    this.showCard();
    if (this.drag?.ghost) this.liftedLook();
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.dim.input!.hitArea.setSize(width, height);
    const scale = Math.min(1.2, (width - 12) / this.panelW, (height - 12) / this.panelH);
    this.window.setPosition(Math.round(width / 2), Math.round(height / 2)).setScale(scale);
  }

  /** Small gold brackets in the window's four corners. */
  private drawCorners(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    const arm = 26;
    const inset = 13;
    g.lineStyle(2, THEME.gold, 0.75);
    for (const [cx, sx] of [
      [x + inset, 1],
      [x + w - inset, -1],
    ]) {
      for (const [cy, sy] of [
        [y + inset, 1],
        [y + h - inset, -1],
      ]) {
        g.beginPath();
        g.moveTo(cx, cy + sy * arm);
        g.lineTo(cx, cy);
        g.lineTo(cx + sx * arm, cy);
        g.strokePath();
        g.fillStyle(THEME.gold, 0.85);
        g.fillCircle(cx + sx * 4, cy + sy * 4, 2.2);
      }
    }
  }

  private makeTabs(top: number): Phaser.GameObjects.GameObject[] {
    const tabs: Array<{ id: InventoryTab; label: string }> = [
      { id: 'satchel', label: 'Satchel' },
      { id: 'equipment', label: 'Equipment' },
    ];
    const w = 140;
    const out: Phaser.GameObjects.GameObject[] = [];
    tabs.forEach((t, i) => {
      const x = (i - 0.5) * (w + 10) - 22;
      const y = top + 38;
      const active = t.id === this.tab;
      const g = this.add.graphics();
      g.fillStyle(active ? THEME.panelLight : THEME.panel, 1);
      g.fillRoundedRect(x - w / 2, y - 19, w, 38, 10);
      g.lineStyle(active ? 2 : 1, THEME.gold, active ? 1 : 0.45);
      g.strokeRoundedRect(x - w / 2, y - 19, w, 38, 10);
      const label = this.add.text(x, y, t.label, { ...titleStyle(19), color: active ? THEME.goldText : THEME.dimText, shadow: undefined }).setOrigin(0.5);
      const hit = this.add.zone(x, y, w, 38).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.showTab(t.id));
      hit.on('pointerover', () => !active && label.setColor(THEME.text));
      hit.on('pointerout', () => !active && label.setColor(THEME.dimText));
      out.push(g, label, hit);
    });
    return out;
  }

  /** A heading with fine gold rules running out either side of it. */
  private heading(cx: number, y: number, w: number, text: string, size = 22): Phaser.GameObjects.Text {
    const t = this.add.text(cx, y, text, titleStyle(size)).setOrigin(0.5, 0);
    const g = this.add.graphics();
    const my = y + t.height / 2 + 1;
    const gap = t.width / 2 + 14;
    g.lineStyle(1, THEME.gold, 0.4);
    g.lineBetween(cx - w / 2 + 6, my, cx - gap, my);
    g.lineBetween(cx + gap, my, cx + w / 2 - 6, my);
    g.fillStyle(THEME.gold, 0.8);
    for (const x of [cx - gap + 4, cx + gap - 4]) g.fillCircle(x, my, 2);
    this.content.add([g, t]);
    return t;
  }

  // ------------------------------------------------------------ the character

  /** Name and level, the paper doll, and the fighting numbers. Returns the bottom edge. */
  private buildCharacter(x0: number, y0: number, w: number): number {
    const cx = x0 + w / 2;
    const name = this.heading(cx, y0, w, HERO_NAME, 26);

    // Level, and how far it is to the next one.
    const { into, span, fraction } = Experience.progress;
    const ly = name.y + name.height + 4;
    const level = this.add.text(cx, ly, span > 0 ? `Level ${Experience.level}   ·   ${into} / ${span} XP` : `Level ${Experience.level}   ·   Highest level`, bodyStyle(13, THEME.dimText)).setOrigin(0.5, 0);
    const bar = this.add.graphics();
    const bw = 210;
    const by = ly + level.height + 5;
    bar.fillStyle(0x000000, 0.6).fillRoundedRect(cx - bw / 2, by, bw, 6, 3);
    bar.fillStyle(THEME.gold, 0.9).fillRoundedRect(cx - bw / 2, by, Math.max(6, bw * (span > 0 ? fraction : 1)), 6, 3);
    bar.lineStyle(1, THEME.gold, 0.35).strokeRoundedRect(cx - bw / 2, by, bw, 6, 3);
    this.content.add([level, bar]);

    const dy = by + 20;
    this.buildDoll(x0, dy, w);
    return this.buildStats(x0, dy + DOLL_H + 14, w);
  }

  /** The hero drawn large, with what they wear in slots around them. */
  private buildDoll(x0: number, y0: number, w: number): void {
    const stageX = x0 + EQ + 12;
    const stageW = w - (EQ + 12) * 2;
    const stageH = DOLL_SIDE_H;
    this.content.add(this.add.image(stageX, y0, this.backdrop(stageW, stageH)).setOrigin(0));
    const cx = stageX + stageW / 2;
    const feet = y0 + stageH - 22;
    const shadow = this.add.ellipse(cx, feet - 2, 110, 22, 0x000000, 0.45);
    paintHeroDoll(this, Inventory.equipped);
    const s = Math.min(1, (stageH - 18) / HERO_H, (stageW - 8) / HERO_W);
    const hero = this.add.image(cx, feet + 8 * s, HERO_DOLL_KEY).setOrigin(0.5, 1).setScale(s);
    this.content.add([shadow, hero]);

    LEFT_SLOTS.forEach((slot, i) => this.equipSlot(x0, y0 + i * (EQ + EQ_GAP), EQ, slot));
    RIGHT_SLOTS.forEach((slot, i) => this.equipSlot(x0 + w - EQ, y0 + i * (EQ + EQ_GAP), EQ, slot));
    const wy = y0 + DOLL_SIDE_H + 14;
    WEAPON_SLOTS.forEach((slot, i) => this.equipSlot(cx + (i === 0 ? -WEAPON - 8 : 8), wy, WEAPON, slot));
    // A little label under the weapons, as they hang below everything else.
    const g = this.add.graphics();
    g.lineStyle(1, THEME.gold, 0.25);
    g.lineBetween(x0 + 10, wy + WEAPON / 2, cx - WEAPON - 18, wy + WEAPON / 2);
    g.lineBetween(cx + WEAPON + 18, wy + WEAPON / 2, x0 + w - 10, wy + WEAPON / 2);
    this.content.add(g);
  }

  /** An arch-topped niche lit warmly from above, for the hero to stand in. Made once per size. */
  private backdrop(w: number, h: number): string {
    const key = `doll-backdrop-${w}x${h}`;
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, w, h)!;
    const c = tex.context;
    const r = w / 2;
    c.beginPath();
    c.moveTo(0, h);
    c.lineTo(0, r);
    c.arc(r, r, r, Math.PI, 0);
    c.lineTo(w, h);
    c.closePath();
    c.save();
    c.clip();
    const glow = c.createRadialGradient(w / 2, h * 0.42, 10, w / 2, h * 0.5, h * 0.75);
    glow.addColorStop(0, '#4a3a4c');
    glow.addColorStop(0.5, '#2a2030');
    glow.addColorStop(1, '#0e0a12');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, h);
    // Faint courses of stone.
    c.strokeStyle = 'rgba(255, 230, 180, 0.035)';
    c.lineWidth = 1;
    for (let y = 18, row = 0; y < h - 30; y += 22, row++) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      for (let x = (row % 2) * 24; x < w; x += 48) {
        c.moveTo(x, y);
        c.lineTo(x, y + 22);
      }
      c.stroke();
    }
    // A pool of light on the floor.
    const floor = c.createRadialGradient(w / 2, h - 22, 4, w / 2, h - 22, w * 0.55);
    floor.addColorStop(0, 'rgba(232, 201, 119, 0.28)');
    floor.addColorStop(1, 'rgba(232, 201, 119, 0)');
    c.fillStyle = floor;
    c.fillRect(0, h - 70, w, 70);
    c.restore();
    c.strokeStyle = 'rgba(217, 180, 90, 0.55)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0.75, h);
    c.lineTo(0.75, r);
    c.arc(r, r, r - 0.75, Math.PI, 0);
    c.lineTo(w - 0.75, h);
    c.stroke();
    tex.refresh();
    return key;
  }

  /** Health, armour, aim and damage, in four framed tiles. Returns the bottom edge. */
  private buildStats(x0: number, y0: number, w: number): number {
    const sheet = heroSheet();
    const stats = this.game_.stats;
    const dmg = `d${sheet.die}${sheet.damageBonus ? `+${sheet.damageBonus}` : ''}`;
    const tiles: Array<{ glyph: GlyphName; color: number; value: string; label: string }> = [
      { glyph: 'heart', color: 0xd9534f, value: stats ? `${Math.round(stats.health)}/${stats.maxHealth}` : '-', label: 'Health' },
      { glyph: 'shield', color: 0x8fb4dc, value: `${sheet.ac}`, label: 'Armour' },
      { glyph: 'aim', color: 0x9dcf86, value: `+${sheet.toHit}`, label: 'To hit' },
      { glyph: 'die', color: 0xe0805f, value: dmg, label: 'Damage' },
    ];
    const gap = 8;
    const tw = (w - gap * (tiles.length - 1)) / tiles.length;
    tiles.forEach((t, i) => {
      const x = x0 + i * (tw + gap);
      const g = this.add.graphics();
      g.fillStyle(SLOT_FILL, 0.75).fillRoundedRect(x, y0, tw, STATS_H, 9);
      g.fillStyle(0xffffff, 0.03).fillRoundedRect(x + 2, y0 + 2, tw - 4, STATS_H / 2 - 2, { tl: 8, tr: 8, bl: 0, br: 0 });
      g.lineStyle(1, THEME.gold, 0.35).strokeRoundedRect(x, y0, tw, STATS_H, 9);
      const icon = this.add.image(x + tw / 2, y0 + 15, glyphKey(t.glyph)).setScale(18 / GLYPH_SIZE).setTint(t.color);
      const value = this.add.text(x + tw / 2, y0 + 26, t.value, { ...titleStyle(t.value.length > 5 ? 15 : 18), shadow: undefined }).setOrigin(0.5, 0);
      const label = this.add.text(x + tw / 2, y0 + STATS_H - 5, t.label, bodyStyle(10, THEME.dimText)).setOrigin(0.5, 1);
      this.content.add([g, icon, value, label]);
    });
    return y0 + STATS_H;
  }

  // ------------------------------------------------------------ the satchel

  /** Heading, filter tabs, the grid, the purse and sort buttons. Returns the bottom edge. */
  private buildSatchel(x0: number, y0: number, wide: boolean): number {
    const shown = FILTERS.find((f) => f.id === shownFilter)!;
    this.heading(x0 + GRID_W / 2, y0, GRID_W, shownFilter === 'all' ? 'Satchel' : `Satchel · ${shown.label}`, 22);
    const fy = y0 + 40;
    this.buildFilters(x0, fy);

    const gy = fy + FILTER_H + 10;
    Inventory.bag.forEach((stack, i) => {
      const x = x0 + (i % COLS) * (SLOT + GAP);
      const y = gy + Math.floor(i / COLS) * (SLOT + GAP);
      // Outside the chosen tab, things fade back but stay put (and can still be moved).
      const faded = !!stack && shownFilter !== 'all' && satchelGroup(itemDef(stack.id)) !== shownFilter;
      this.makeSlot({ kind: 'bag', index: i }, x, y, SLOT, stack?.id, stack?.count ?? 0, faded);
    });

    // The purse and how full the satchel is.
    const fy2 = gy + GRID_H + 12;
    const used = Inventory.bag.filter((s) => s !== null).length;
    const coin = this.add.image(x0 + 10, fy2 + 9, 'item-coin').setScale(itemScale(1.5));
    const coins = this.add.text(x0 + 22, fy2, `${Inventory.coins}`, { ...titleStyle(16), shadow: undefined }).setOrigin(0, 0);
    const coinsLabel = this.add.text(coins.x + coins.width + 5, fy2 + 3, 'coins', bodyStyle(12, THEME.dimText));
    const full = used >= BAG_SIZE;
    const count = this.add.text(x0 + GRID_W, fy2 + 2, `${used} / ${BAG_SIZE} slots${full ? ' (full)' : ''}`, bodyStyle(13, full ? '#e0806a' : THEME.dimText)).setOrigin(1, 0);
    this.content.add([coin, coins, coinsLabel, count]);

    // Sort: by type, value or name.
    const sy = fy2 + 40;
    const label = this.add.text(x0, sy, 'Sort', bodyStyle(13, THEME.dimText)).setOrigin(0, 0.5);
    this.content.add(label);
    const chipsX = x0 + label.width + 12;
    this.chipRow(chipsX, sy, x0 + GRID_W - chipsX, SORTS, lastSort, (id) => {
      GameAudio.rustle();
      lastSort = id;
      this.selection = undefined;
      Inventory.sort(id);
    });
    let bottom = sy + CHIP_H / 2;

    if (wide) {
      const hint = this.touch
        ? 'Tap to look closer, tap twice to use.\nDrag onto Arthus to wear, or off to take off.'
        : 'Hover to look closer, double-click to use.\nDrag onto Arthus to wear, or off to take off.';
      const t = this.add
        .text(x0 + GRID_W / 2, y0 + WIDE_H - 22 - 22, hint, { fontFamily: BODY_FONT, fontSize: '12px', fontStyle: 'italic', color: THEME.dimText, align: 'center', lineSpacing: 2 })
        .setOrigin(0.5, 1)
        .setAlpha(0.8);
      this.content.add(t);
      bottom = t.y;
    }
    return bottom;
  }

  /** The filter tabs over the satchel: All, Food, Gear, Materials, Quest, each with how many slots it covers. */
  private buildFilters(x0: number, y0: number): void {
    const counts = groupCounts(Inventory.bag);
    const w = (GRID_W - GAP * (FILTERS.length - 1)) / FILTERS.length;
    FILTERS.forEach((f, i) => {
      const x = x0 + i * (w + GAP);
      const lit = f.id === shownFilter;
      const g = this.add.graphics();
      const icon = this.add.image(x + w / 2, y0 + 16, glyphKey(f.glyph)).setScale(20 / GLYPH_SIZE);
      const label = this.add.text(x + w / 2, y0 + FILTER_H - 5, f.label, bodyStyle(10, lit ? THEME.goldText : THEME.dimText)).setOrigin(0.5, 1);
      const n = counts[f.id];
      const badge = n > 0 && f.id !== 'all' ? this.add.text(x + w - 5, y0 + 3, `${n}`, bodyStyle(10, THEME.dimText)).setOrigin(1, 0) : undefined;
      const draw = (hover: boolean) => {
        g.clear();
        g.fillStyle(lit || hover ? THEME.panelLight : SLOT_FILL, lit ? 1 : 0.8);
        g.fillRoundedRect(x, y0, w, FILTER_H, 8);
        if (lit) {
          g.fillStyle(THEME.gold, 0.9);
          g.fillRoundedRect(x + 10, y0 + FILTER_H - 3, w - 20, 3, 1.5);
        }
        g.lineStyle(lit ? 2 : 1, THEME.gold, lit ? 1 : hover ? 0.85 : 0.35);
        g.strokeRoundedRect(x, y0, w, FILTER_H, 8);
        icon.setTint(lit ? THEME.gold : hover ? 0xf3e2b3 : 0x8a7c62);
        label.setColor(lit || hover ? THEME.goldText : THEME.dimText);
      };
      draw(false);
      const hit = this.add.zone(x + w / 2, y0 + FILTER_H / 2, w, FILTER_H).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => draw(true));
      hit.on('pointerout', () => draw(false));
      hit.on('pointerup', () => {
        if (this.drag?.ghost || f.id === shownFilter) return;
        GameAudio.pageTurn();
        shownFilter = f.id;
        this.build();
      });
      this.content.add([g, icon, label, ...(badge ? [badge] : []), hit]);
    });
  }

  /** A row of small buttons across `width`, with the `active` one lit. */
  private chipRow<T extends string>(x0: number, cy: number, width: number, chips: Array<{ id: T; label: string }>, active: T, onPick: (id: T) => void): void {
    const gap = 6;
    const w = (width - gap * (chips.length - 1)) / chips.length;
    chips.forEach((c, i) => {
      // Each chip keeps its own left edge: drawing it from a shared, moving x
      // once put a hovered chip's box past the end of the row.
      const left = x0 + i * (w + gap);
      const lit = c.id === active;
      const label = this.add.text(left + w / 2, cy, c.label, bodyStyle(13, lit ? THEME.goldText : THEME.text)).setOrigin(0.5);
      const g = this.add.graphics();
      const draw = (hover: boolean) => {
        g.clear();
        g.fillStyle(lit || hover ? THEME.panelLight : THEME.panel, lit ? 1 : 0.92);
        g.fillRoundedRect(left, cy - CHIP_H / 2, w, CHIP_H, 7);
        g.lineStyle(lit ? 2 : 1, THEME.gold, lit ? 1 : hover ? 0.9 : 0.45);
        g.strokeRoundedRect(left, cy - CHIP_H / 2, w, CHIP_H, 7);
        if (!lit) label.setColor(hover ? THEME.goldText : THEME.text);
      };
      draw(false);
      const hit = this.add.zone(left + w / 2, cy, w, CHIP_H).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => draw(true));
      hit.on('pointerout', () => draw(false));
      hit.on('pointerup', () => {
        if (this.drag?.ghost) return;
        onPick(c.id);
      });
      this.content.add([g, label, hit]);
    });
  }

  // ------------------------------------------------------------ slots

  private equipSlot(x: number, y: number, size: number, slot: EquipSlot): void {
    this.makeSlot({ kind: 'slot', slot }, x, y, size, Inventory.equipped[slot], 1, false);
  }

  /** One square slot, empty or holding an item, that can be hovered, selected, used and dragged. */
  private makeSlot(sel: Selection, x: number, y: number, size: number, id: ItemId | undefined, count: number, faded: boolean): void {
    const def = id ? itemDef(id) : undefined;
    const accent = def && !faded ? colorOf(def) : undefined;
    const selected = sameSel(sel, this.selection);
    const g = this.add.graphics();
    const redraw = (state: 'idle' | 'hover' | 'target') => {
      g.clear();
      if (selected || state === 'target') {
        g.lineStyle(6, THEME.gold, 0.18);
        g.strokeRoundedRect(x - 2, y - 2, size + 4, size + 4, 10);
      }
      g.fillStyle(selected ? THEME.panelLight : SLOT_FILL, selected ? 1 : 0.88);
      g.fillRoundedRect(x, y, size, size, 8);
      // A soft bevel: lighter above, a shadow under the top edge.
      g.fillStyle(0xffffff, 0.035).fillRoundedRect(x + 2, y + 2, size - 4, size * 0.45, { tl: 6, tr: 6, bl: 0, br: 0 });
      g.lineStyle(1, 0x000000, 0.6).lineBetween(x + 6, y + 2, x + size - 6, y + 2);
      if (accent !== undefined) {
        g.fillStyle(accent, 0.13).fillCircle(x + size / 2, y + size / 2, size * 0.34);
        g.fillStyle(accent, 0.6).fillRoundedRect(x + 8, y + size - 4, size - 16, 2, 1);
      }
      const rim = state === 'target' ? THEME.gold : accent ?? THEME.gold;
      const alpha = selected || state === 'target' ? 1 : state === 'hover' ? 0.95 : accent !== undefined ? 0.55 : 0.3;
      g.lineStyle(selected || state === 'target' ? 2 : 1, selected ? THEME.gold : rim, alpha);
      g.strokeRoundedRect(x, y, size, size, 8);
    };
    redraw('idle');
    this.content.add(g);

    let icon: Phaser.GameObjects.Image | undefined;
    if (def) {
      icon = this.add.image(x + size / 2, y + size / 2, def.icon).setScale(itemScale((2.8 * size) / 56)).setAlpha(faded ? 0.22 : 1);
      this.content.add(icon);
      if (count > 1) {
        const n = this.add
          .text(x + size - 5, y + size - 3, `${count}`, { fontFamily: BODY_FONT, fontSize: '14px', color: '#fff6e0', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 })
          .setOrigin(1, 1)
          .setAlpha(faded ? 0.3 : 1);
        this.content.add(n);
      }
      if (def.quest && !faded) {
        // A gold diamond in the corner marks what a quest needs.
        const q = this.add.graphics();
        const qx = x + 9;
        const qy = y + 9;
        q.fillStyle(0x000000, 0.6).fillPoints([new Phaser.Math.Vector2(qx, qy - 6), new Phaser.Math.Vector2(qx + 6, qy), new Phaser.Math.Vector2(qx, qy + 6), new Phaser.Math.Vector2(qx - 6, qy)], true);
        q.fillStyle(CATEGORY_COLOR.Quest, 1).fillPoints([new Phaser.Math.Vector2(qx, qy - 4), new Phaser.Math.Vector2(qx + 4, qy), new Phaser.Math.Vector2(qx, qy + 4), new Phaser.Math.Vector2(qx - 4, qy)], true);
        this.content.add(q);
      }
    } else if (sel.kind === 'slot') {
      // An empty equipment slot shows the outline of what goes there.
      const glyph = this.add
        .image(x + size / 2, y + size / 2, glyphKey(sel.slot))
        .setScale((size * 0.52) / GLYPH_SIZE)
        .setTint(0x8a7c62)
        .setAlpha(0.4);
      this.content.add(glyph);
    }

    const view: SlotView = { sel, x, y, size, icon, redraw };
    this.slots.push(view);

    const hit = this.add.zone(x + size / 2, y + size / 2, size, size).setInteractive({ useHandCursor: true });
    hit.on('pointerover', (p: Phaser.Input.Pointer) => {
      if (this.drag?.ghost) return;
      redraw('hover');
      if (!p.wasTouch && this.wide) {
        this.hover = sel;
        this.showCard();
      }
    });
    hit.on('pointerout', () => {
      if (this.drag?.ghost) return;
      redraw('idle');
      if (sameSel(this.hover, sel)) {
        this.hover = undefined;
        this.showCard();
      }
    });
    if (id) {
      hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
        const pt = Display.point(p);
        this.drag = { from: sel, id, startX: pt.x, startY: pt.y };
      });
    }
    hit.on('pointerup', (p: Phaser.Input.Pointer) => {
      // A drag is dropped by onDragEnd, not taken as a click.
      if (this.drag?.ghost) return;
      p.event?.stopPropagation();
      this.tap(sel, !!id);
    });
    this.content.add(hit);
  }

  /** A tap or click on a slot: select it, or use it if it's the second tap in quick succession. */
  private tap(sel: Selection, filled: boolean): void {
    const now = this.time.now;
    const again = this.lastTap && sameSel(this.lastTap.sel, sel) && now - this.lastTap.at < DOUBLE_TAP_MS;
    this.lastTap = { sel, at: now };
    if (again && filled) {
      this.lastTap = undefined;
      const action = this.actionFor(sel);
      if (action) {
        action.run();
        return;
      }
    }
    GameAudio.click();
    if (!filled && sel.kind === 'bag') {
      this.select(undefined);
      return;
    }
    this.select(sel);
  }

  // ------------------------------------------------------------ the tooltip card

  /**
   * Shows the card for whatever's hovered (on a wide screen with a mouse), or
   * else what's selected, with buttons; narrow screens dock it under the grid.
   */
  private showCard(): void {
    this.card?.destroy();
    this.card = undefined;
    // Nothing covers the slots while something is being dragged onto them.
    if (this.drag?.ghost && !this.dock) return;
    const sel = this.hover ?? this.selection;
    const pinned = !!sel && sameSel(sel, this.selection);
    if (this.dock) {
      this.card = this.makeCard(this.selection, this.dock.w, true, this.dock.h);
      // Too much to fit: again, with the story cut short.
      if ((this.card.getData('over') as boolean) === true) {
        this.card.destroy();
        this.card = this.makeCard(this.selection, this.dock.w, true, this.dock.h, true);
      }
      this.card.setPosition(this.dock.x, this.dock.y);
    } else if (sel) {
      if (sel.kind === 'bag' && !Inventory.bag[sel.index]) return;
      const view = this.slots.find((v) => sameSel(v.sel, sel));
      if (!view) return;
      this.card = this.makeCard(sel, CARD_W, pinned);
      // Beside the slot, on whichever side has room, kept inside the window.
      const left = -this.panelW / 2;
      const top = -this.panelH / 2;
      const right = view.x + view.size + 12;
      const x = right + CARD_W <= left + this.panelW - 14 ? right : view.x - 12 - CARD_W;
      const h = (this.card.getData('h') as number) ?? 0;
      const y = Phaser.Math.Clamp(view.y - 6, top + 14, top + this.panelH - 14 - h);
      this.card.setPosition(x, y);
    }
    if (this.card) this.window.add(this.card);
  }

  /** The card itself: name, kind, what it does, how it compares, its story, its worth, and what to do with it. */
  private makeCard(sel: Selection | undefined, w: number, pinned: boolean, fixedH?: number, compact = false): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const pad = 14;
    const parts: Phaser.GameObjects.GameObject[] = [];
    let y = pad;
    const text = (s: string, style: Phaser.Types.GameObjects.Text.TextStyle, x = pad, wrap = w - pad * 2) => {
      const t = this.add.text(x, y, s, { ...style, wordWrap: { width: wrap } });
      parts.push(t);
      y += t.height;
      return t;
    };
    const rule = () => {
      y += 7;
      const g = this.add.graphics();
      g.lineStyle(1, THEME.gold, 0.25).lineBetween(pad, y, w - pad, y);
      parts.push(g);
      y += 8;
    };

    const id = sel?.kind === 'bag' ? Inventory.bag[sel.index]?.id : sel?.kind === 'slot' ? Inventory.equipped[sel.slot] : undefined;
    const buttons: Array<{ label: string; run: () => void }> = [];

    if (!sel) {
      // Nothing chosen (only on a narrow screen, where the card has its own place).
      y = (fixedH ?? 120) / 2 - 30;
      const hint = this.tab === 'satchel' ? 'Tap something to look at it more closely.\n\nTap twice to use it, or drag it to another slot.' : 'Tap a slot to see what is worn there.\n\nDrag gear off Arthus to put it in your satchel.';
      const t = text(hint, { fontFamily: BODY_FONT, fontSize: '14px', fontStyle: 'italic', color: THEME.dimText, align: 'center' });
      t.setX(w / 2).setOrigin(0.5, 0);
    } else if (!id && sel.kind === 'slot') {
      // An empty equipment slot: offer whatever in the satchel could go there.
      text(slotLabel(sel.slot), { ...titleStyle(18), shadow: undefined });
      y += 2;
      text('Equipment slot', bodyStyle(11, THEME.dimText));
      rule();
      const fits = Inventory.bag.map((s, index) => ({ s, index })).filter(({ s }) => s && itemDef(s.id).slot === sel.slot);
      if (fits.length === 0) {
        text('Nothing worn here, and nothing in your satchel that would fit.', { fontFamily: BODY_FONT, fontSize: '14px', fontStyle: 'italic', color: THEME.dimText });
      } else {
        text('Nothing worn here. From your satchel:', { fontFamily: BODY_FONT, fontSize: '14px', fontStyle: 'italic', color: THEME.dimText });
        if (pinned) for (const { s, index } of fits.slice(0, 3)) buttons.push({ label: `Wear ${itemDef(s!.id).name}`, run: () => this.equip(index) });
        else for (const { s } of fits.slice(0, 3)) text(`·  ${itemDef(s!.id).name}`, bodyStyle(13, THEME.text));
      }
    } else if (id) {
      const def = itemDef(id);
      const accent = colorOf(def);
      // The icon in a little frame, the name and kind beside it.
      const frame = this.add.graphics();
      frame.fillStyle(SLOT_FILL, 1).fillRoundedRect(pad, y, 46, 46, 7);
      frame.fillStyle(accent, 0.16).fillCircle(pad + 23, y + 23, 17);
      frame.lineStyle(1, accent, 0.7).strokeRoundedRect(pad, y, 46, 46, 7);
      const icon = this.add.image(pad + 23, y + 23, def.icon).setScale(itemScale(2.4));
      parts.push(frame, icon);
      const top = y;
      const tx = pad + 58;
      const name = text(def.name, { ...titleStyle(17), color: hex(accent), shadow: undefined }, tx, w - tx - pad);
      y += 1;
      const kind = [def.category, def.slot && slotLabel(def.slot), def.quest && 'Quest'].filter(Boolean).join('  ·  ');
      text(kind, bodyStyle(11, THEME.dimText), tx, w - tx - pad);
      if (sel.kind === 'slot') {
        y += 2;
        text('Worn', bodyStyle(11, THEME.goldText), tx);
      }
      y = Math.max(y, top + 46);
      void name;

      // What it does.
      const effects = itemEffects(def).filter((l) => !l.startsWith('Worn:'));
      if (effects.length) {
        rule();
        for (const line of effects) {
          text(line, bodyStyle(13, '#9fd66a'));
          y += 2;
        }
      }
      // Against what's worn there now.
      if (sel.kind === 'bag' && def.slot) {
        const wornId = Inventory.equipped[def.slot];
        const worn = wornId ? itemDef(wornId) : undefined;
        const changes = compareGear(def, worn);
        if (changes.length) {
          rule();
          if (!compact) {
            text(worn ? `Instead of your ${worn.name}:` : `Nothing worn there now:`, bodyStyle(11, THEME.dimText));
            y += 3;
          }
          for (const ch of changes) {
            const arrow = ch.better > 0 ? '▲' : ch.better < 0 ? '▼' : '•';
            const col = ch.better > 0 ? '#9fd66a' : ch.better < 0 ? '#e0806a' : THEME.text;
            text(`${arrow}  ${ch.label}  ${ch.from} → ${ch.to}`, bodyStyle(13, col));
            y += 2;
          }
        }
      }
      rule();
      text(def.description, { fontFamily: BODY_FONT, fontSize: compact ? '13px' : '14px', fontStyle: 'italic', color: THEME.text, lineSpacing: compact ? 1 : 3, maxLines: compact ? 2 : 0 });
      // Its worth, and how many there are.
      const stack = sel.kind === 'bag' ? Inventory.bag[sel.index] : undefined;
      if (def.value || (stack && stack.count > 1)) {
        y += 8;
        const row = y;
        if (def.value) {
          const coin = this.add.image(w - pad - 7, row + 8, 'item-coin').setScale(itemScale(1.3));
          const v = this.add.text(w - pad - 18, row, `${def.value}`, bodyStyle(13, THEME.goldText)).setOrigin(1, 0);
          parts.push(coin, v);
        }
        if (stack && stack.count > 1) parts.push(this.add.text(pad, row, `${stack.count} of ${def.stack} in this stack`, bodyStyle(11, THEME.dimText)));
        y = row + 18;
      }
      const action = pinned ? this.actionFor(sel) : undefined;
      if (action) buttons.push(action);
      if (!pinned && !this.touch) {
        const use = this.actionFor(sel);
        y += 6;
        text(use ? `Click to choose  ·  Double-click: ${use.label}` : 'Click to choose', bodyStyle(10, THEME.dimText)).setAlpha(0.75);
      }
    }

    // Buttons along the bottom.
    const bh = 34;
    if (buttons.length) y += 10;
    let by = fixedH !== undefined ? Math.max(y, fixedH - pad - buttons.length * (bh + 6) + 6) : y;
    for (const b of buttons) {
      parts.push(this.smallButton(w / 2, by + bh / 2, w - pad * 2, bh, b.label, b.run));
      by += bh + 6;
    }
    if (buttons.length) y = by - 6;
    const h = fixedH ?? y + pad;
    c.setData('over', fixedH !== undefined && y + pad > fixedH);

    const bg = this.add.graphics();
    if (fixedH === undefined) bg.fillStyle(0x000000, 0.45).fillRoundedRect(4, 6, w, h, 10);
    bg.fillStyle(0x120d16, fixedH === undefined ? 0.98 : 0.6).fillRoundedRect(0, 0, w, h, 10);
    bg.lineStyle(fixedH === undefined ? 1.5 : 1, THEME.gold, fixedH === undefined ? 0.8 : 0.3).strokeRoundedRect(0, 0, w, h, 10);
    if (fixedH === undefined) bg.lineStyle(1, THEME.gold, 0.2).strokeRoundedRect(4, 4, w - 8, h - 8, 7);
    // The card swallows taps, so pressing on it doesn't let go of the selection.
    const blocker = this.add.zone(w / 2, h / 2, w, h).setInteractive();
    blocker.on('pointerup', (p: Phaser.Input.Pointer) => p.event?.stopPropagation());
    c.add([bg, blocker, ...parts]);
    c.setData('h', h);
    if (!pinned && fixedH === undefined) {
      // A hover card shouldn't catch the pointer.
      blocker.disableInteractive();
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 90 });
    }
    return c;
  }

  private smallButton(cx: number, cy: number, w: number, h: number, label: string, run: () => void): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    const t = this.add.text(0, 0, label, bodyStyle(15)).setOrigin(0.5);
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(hover ? 0x3a2c40 : THEME.panelLight, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      g.lineStyle(1.5, THEME.gold, hover ? 1 : 0.7).strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
      t.setColor(hover ? THEME.goldText : THEME.text);
    };
    draw(false);
    const b = this.add.container(cx, cy, [g, t]).setSize(w, h).setInteractive({ useHandCursor: true });
    b.on('pointerover', () => {
      draw(true);
      GameAudio.hover();
    });
    b.on('pointerout', () => draw(false));
    b.on('pointerup', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation();
      GameAudio.click();
      run();
    });
    return b;
  }

  private actionFor(sel: Selection): { label: string; run: () => void } | undefined {
    if (sel.kind === 'slot') return Inventory.equipped[sel.slot] ? { label: 'Take off', run: () => this.unequip(sel.slot) } : undefined;
    const stack = Inventory.bag[sel.index];
    if (!stack) return undefined;
    const def = itemDef(stack.id);
    if (def.eat) return { label: def.drink ? 'Drink' : 'Eat', run: () => this.eat(sel.index) };
    if (def.slot) return { label: 'Wear', run: () => this.equip(sel.index) };
    return undefined;
  }

  // ------------------------------------------------------------ dragging

  private onDragMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d) return;
    if (!p.isDown) return this.cancelDrag();
    const pt = Display.point(p);
    if (!d.ghost) {
      if (Phaser.Math.Distance.Between(pt.x, pt.y, d.startX, d.startY) < DRAG_START) return;
      // Lift the item: a copy follows the pointer and its slot looks empty.
      d.ghost = this.add.image(pt.x, pt.y, itemDef(d.id).icon).setScale(itemScale(3.1 * this.window.scale)).setDepth(10).setAlpha(0.92);
      this.hover = undefined;
      this.showCard();
      this.liftedLook();
      GameAudio.click();
    }
    d.ghost.setPosition(pt.x, pt.y);
    const over = this.slotAt(p);
    for (const v of this.slots) {
      if (sameSel(v.sel, d.from)) continue;
      v.redraw(v === over && this.accepts(v.sel, d) ? 'target' : this.accepts(v.sel, d) && v.sel.kind === 'slot' ? 'hover' : 'idle');
    }
  }

  /** While dragging: the lifted slot looks empty, and the doll's slots the item could go in are lit. */
  private liftedLook(): void {
    const d = this.drag;
    if (!d) return;
    for (const v of this.slots) {
      if (sameSel(v.sel, d.from)) v.icon?.setAlpha(0.25);
      else if (v.sel.kind === 'slot' && this.accepts(v.sel, d)) v.redraw('hover');
    }
  }

  /** Whether what's being dragged could be dropped on a slot. */
  private accepts(sel: Selection, d: Drag): boolean {
    if (sel.kind === 'slot') return d.from.kind === 'bag' && itemDef(d.id).slot === sel.slot;
    if (d.from.kind === 'bag') return true;
    // Gear taken off goes into an empty satchel slot, or swaps with something that fits where it came from.
    const there = Inventory.bag[sel.index];
    return !there || itemDef(there.id).slot === d.from.slot;
  }

  private onDragEnd(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    this.drag = undefined;
    if (!d?.ghost) return;
    d.ghost.destroy();
    const to = this.slotAt(p);
    if (!to || sameSel(to.sel, d.from) || !this.accepts(to.sel, d)) {
      // Dropped somewhere it can't go: it goes back where it was.
      this.build();
      return;
    }
    GameAudio.pickup();
    if (d.from.kind === 'bag' && to.sel.kind === 'bag') {
      this.selection = to.sel;
      Inventory.move(d.from.index, to.sel.index);
    } else if (d.from.kind === 'bag' && to.sel.kind === 'slot') {
      this.selection = this.wide || this.tab === 'equipment' ? to.sel : undefined;
      if (!Inventory.equip(d.from.index)) this.build();
    } else if (d.from.kind === 'slot' && to.sel.kind === 'bag') {
      this.selection = undefined;
      if (!Inventory.unequip(d.from.slot, to.sel.index)) this.build();
    } else {
      this.build();
    }
  }

  private cancelDrag(): void {
    if (!this.drag) return;
    const lifted = !!this.drag.ghost;
    this.drag.ghost?.destroy();
    this.drag = undefined;
    if (lifted) this.build();
  }

  /** Which slot is under the pointer, if any. */
  private slotAt(p: Phaser.Input.Pointer): SlotView | undefined {
    const local = this.toLocal(p);
    return this.slots.find((s) => local.x >= s.x && local.x < s.x + s.size && local.y >= s.y && local.y < s.y + s.size);
  }

  // ------------------------------------------------------------ actions

  private select(selection: Selection | undefined): void {
    this.selection = selection;
    this.hover = undefined;
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
    if (!slot) return;
    // Keep the newly worn item selected, wherever it can be seen.
    this.selection = this.wide || this.tab === 'equipment' ? { kind: 'slot', slot } : undefined;
    this.hover = undefined;
    GameAudio.pickup();
    if (!Inventory.equip(index)) this.build();
  }

  private unequip(slot: EquipSlot): void {
    if (!Inventory.unequip(slot)) {
      this.game_.onHint?.('My satchel is too full to carry that.');
      return;
    }
    this.selection = undefined;
    this.hover = undefined;
    this.build();
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    this.cancelDrag();
    GameAudio.bookClose();
    this.tweens.add({ targets: this.window, scale: this.window.scale * 0.94, alpha: 0, duration: 160, ease: 'Cubic.easeIn' });
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
