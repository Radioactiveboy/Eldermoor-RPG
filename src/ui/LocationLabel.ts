import Phaser from 'phaser';
import { AREA_NAMES } from '../systems/SaveGame';
import type { AreaId, MapData } from '../world/MapData';
import { drawPanel, UI_COLORS, UI_FONT } from './theme';

const PAD_X = 12;
const PAD_Y = 6;
/** How close (in tiles) to a landmark's door the player must be for its name to show under the area's. */
const NEAR = 9;

/** Places in the Hollow that are worth naming, found by the door that leads into them. */
const LANDMARKS: Partial<Record<AreaId, string>> = {
  home: 'Home',
  hut: "Farmer Iran's farm",
  cave: 'The hill caves',
};

/**
 * Where the player is, e.g. "Adowvale Hollow" and, near a landmark, "Home"
 * beneath it. Sits under the minimap, or on its own indoors where there's no map.
 */
export class LocationLabel {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly place: Phaser.GameObjects.Text;
  private landmarks: Array<{ x: number; y: number; name: string }> = [];
  private area?: AreaId;
  private shown = '';
  private visible = true;
  private cx = 0;
  private y = 0;
  private below = true;
  private alignRight = false;

  constructor(scene: Phaser.Scene) {
    this.frame = scene.add.graphics();
    this.title = scene.add
      .text(0, 0, '', { fontFamily: UI_FONT, fontSize: '14px', color: '#e8c977', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    this.place = scene.add.text(0, 0, '', { fontFamily: UI_FONT, fontSize: '12px', color: UI_COLORS.textMuted }).setOrigin(0.5, 0);
  }

  /** The area the player is now in, and its map for finding the landmarks in it. */
  setArea(area: AreaId, map: MapData): void {
    this.area = area;
    this.landmarks = (map.doors ?? []).flatMap((d) => {
      const name = LANDMARKS[d.to];
      return name && d.to !== area ? [{ x: d.tx + 0.5, y: d.ty + 0.5, name }] : [];
    });
    this.shown = '';
  }

  get height(): number {
    return this.title.height + (this.place.text ? this.place.height : 0) + PAD_Y * 2;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    [this.frame, this.title, this.place].forEach((o) => o.setVisible(visible));
  }

  /**
   * @param x the centre to line up with (the minimap's), or the right edge if `alignRight`
   * @param y the top edge, or the bottom edge if `below` is false
   */
  setPosition(x: number, y: number, below = true, alignRight = false): void {
    this.cx = x;
    this.y = y;
    this.below = below;
    this.alignRight = alignRight;
    this.shown = '';
  }

  /** @param gx, gy the player's grid position */
  update(gx: number, gy: number): void {
    if (!this.visible || !this.area) return;
    const near = this.landmarks
      .map((l) => ({ name: l.name, d: Phaser.Math.Distance.Between(gx, gy, l.x, l.y) }))
      .filter((l) => l.d < NEAR)
      .sort((a, b) => a.d - b.d)[0];
    const title = AREA_NAMES[this.area];
    const place = near?.name ?? '';
    const key = `${title}|${place}|${this.cx},${this.y},${this.below},${this.alignRight}`;
    if (key === this.shown) return;
    this.shown = key;

    this.title.setText(title);
    this.place.setText(place).setVisible(!!place);
    const w = Math.max(this.title.width, place ? this.place.width : 0) + PAD_X * 2;
    const h = this.height;
    const top = Math.round(this.below ? this.y : this.y - h);
    const left = Math.round(this.alignRight ? this.cx - w : this.cx - w / 2);
    const mid = left + w / 2;
    this.frame.clear();
    drawPanel(this.frame, left, top, w, h);
    this.title.setPosition(Math.round(mid), top + PAD_Y);
    this.place.setPosition(Math.round(mid), top + PAD_Y + this.title.height);
  }

  destroy(): void {
    [this.frame, this.title, this.place].forEach((o) => o.destroy());
  }
}
