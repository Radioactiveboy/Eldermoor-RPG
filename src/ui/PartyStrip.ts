import Phaser from 'phaser';
import { sheetScale } from '../art/fine3d';
import { COMPANIONS, CompanionId, Companions, maxHpOf } from '../systems/Companions';
import { Experience } from '../systems/Experience';
import { drawPanel, UI_COLORS, UI_FONT } from './theme';

const CARD_W = 118;
const CARD_H = 34;
const GAP = 6;
/** The folk's figure, cropped to head and shoulders. */
const FACE = 28;
/** The part of a folk frame (32 by 48) that's their head and shoulders. */
const CROP = { x: 6, y: 4, w: 20, h: 20 };

/**
 * Who's travelling with the hero, under the health bars on the HUD: a little
 * card each, with their face, name and health. Clicking (or tapping) one
 * opens the party screen (P).
 */
export class PartyStrip {
  private readonly root: Phaser.GameObjects.Container;
  private shown = '';
  private x = 0;
  private y = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly onClick: () => void) {
    this.root = scene.add.container(0, 0);
  }

  get height(): number {
    return Companions.party.length === 0 ? 0 : CARD_H;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.root.setPosition(x, y);
  }

  setVisible(on: boolean): void {
    this.root.setVisible(on);
  }

  /** Redraws when someone joins or leaves, or their health changes. Returns whether the strip's height changed. */
  update(): boolean {
    const level = Experience.level;
    const key = Companions.party.map((id) => `${id}:${Math.round(Companions.hp(id, level))}`).join(',');
    if (key === this.shown) return false;
    const before = this.shown === '' ? 0 : 1;
    this.shown = key;
    this.root.removeAll(true);
    Companions.party.forEach((id, i) => this.card(id, i * (CARD_W + GAP), level));
    this.root.setPosition(this.x, this.y);
    return before !== (key === '' ? 0 : 1);
  }

  private card(id: CompanionId, x: number, level: number): void {
    const def = COMPANIONS[id];
    const s = this.scene;
    const bg = s.add.graphics();
    drawPanel(bg, 0, 0, CARD_W, CARD_H);
    // Head and shoulders, cut from the first (south-facing) frame of their walking figure.
    // A finely drawn figure's frame is bigger by its sheet's scale (see art/fine3d.ts).
    const fine = sheetScale(s, def.texture);
    const k = FACE / CROP.h / fine;
    const face = s.add
      .image(6 - CROP.x * fine * k, (CARD_H - FACE) / 2 - CROP.y * fine * k, def.texture, 0)
      .setOrigin(0, 0)
      .setScale(k)
      .setCrop(CROP.x * fine, CROP.y * fine, CROP.w * fine, CROP.h * fine);
    const name = s.add.text(FACE + 12, 5, def.short, { fontFamily: UI_FONT, fontSize: '12px', color: UI_COLORS.text, fontStyle: 'bold' });
    const hp = Companions.hp(id, level);
    const max = maxHpOf(id, level);
    const t = Phaser.Math.Clamp(hp / max, 0, 1);
    const bar = s.add.graphics();
    const bx = FACE + 12;
    const bw = CARD_W - bx - 8;
    bar.fillStyle(0x3a0e0b, 1).fillRect(bx, 22, bw, 6);
    bar.fillStyle(t > 0.5 ? 0xb3261e : t > 0.25 ? 0xd9a22a : 0x8a1a12, 1).fillRect(bx, 22, bw * t, 6);
    const card = s.add.container(x, 0, [bg, face, name, bar]);
    card.setSize(CARD_W, CARD_H).setInteractive(new Phaser.Geom.Rectangle(0, 0, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
    card.input!.cursor = 'pointer';
    card.on('pointerup', () => this.onClick());
    this.root.add(card);
  }
}
