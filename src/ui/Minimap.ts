import Phaser from 'phaser';
import { TILE_WIDTH } from '../config';
import { gridToScreen } from '../iso/IsoMath';
import { Prop, Terrain } from '../world/MapData';
import type { IsoMap } from '../world/IsoMap';
import { drawPanel } from './theme';

/** Minimap pixels per world pixel: each 64x32 tile becomes a 4x2 diamond, unless the map is too big for that. */
const SCALE = 4 / TILE_WIDTH;
/** Widest the minimap gets, in pixels: Adowvale Hollow's width. Bigger maps get smaller tiles. */
const MAX_W = 224;
const PAD = 10;

const TERRAIN_COLOR: Record<Terrain, number> = {
  [Terrain.Grass]: 0x4f8a3c,
  [Terrain.Dirt]: 0x9a7448,
  [Terrain.Stone]: 0x9a9ca3,
  [Terrain.Water]: 0x2f6fae,
  [Terrain.Sand]: 0xd8c38a,
  [Terrain.Floor]: 0x7a5636,
  [Terrain.Soil]: 0x5e3e26,
  [Terrain.Cave]: 0x4a4452,
};
const PROP_COLOR: Partial<Record<Prop, number>> = {
  [Prop.Tree]: 0x1f4d22,
  [Prop.Rock]: 0x6b6d73,
  [Prop.Blocked]: 0x6a4a2e,
};

/**
 * Isometric minimap, drawn the same way round as the world so directions match.
 * The terrain is baked into a texture once; the player marker and the camera
 * view outline are redrawn every frame.
 */
export class Minimap {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly image: Phaser.GameObjects.Image;
  private readonly overlay: Phaser.GameObjects.Graphics;
  /** World pixel position of the minimap texture's top-left corner. */
  private readonly origin: Phaser.Math.Vector2;
  private readonly mapW: number;
  private readonly mapH: number;
  private scale = 1;
  /** Minimap pixels per world pixel, for this map. */
  private readonly px: number;

  constructor(scene: Phaser.Scene, map: IsoMap) {
    this.origin = new Phaser.Math.Vector2(gridToScreen(0, map.height).x, 0);
    const worldW = (map.width + map.height) * (TILE_WIDTH / 2);
    this.px = Math.min(SCALE, MAX_W / worldW);
    this.mapW = worldW * this.px;
    this.mapH = this.mapW / 2;
    this.bake(scene, map);
    this.frame = scene.add.graphics();
    this.image = scene.add.image(0, 0, 'minimap').setOrigin(0, 0);
    this.overlay = scene.add.graphics();
  }

  get width(): number {
    return (this.mapW + PAD * 2) * this.scale;
  }

  get height(): number {
    return (this.mapH + PAD * 2) * this.scale;
  }

  setVisible(visible: boolean): void {
    [this.frame, this.image, this.overlay].forEach((o) => o.setVisible(visible));
  }

  destroy(): void {
    [this.frame, this.image, this.overlay].forEach((o) => o.destroy());
  }

  /** Shrink the minimap for small screens. Call before setPosition. */
  setScale(scale: number): void {
    this.scale = scale;
  }

  /** Place the minimap with its top-left corner at (x, y). */
  setPosition(x: number, y: number): void {
    const scale = this.scale;
    this.frame.clear().setPosition(x, y).setScale(scale);
    drawPanel(this.frame, 0, 0, this.mapW + PAD * 2, this.mapH + PAD * 2);
    this.image.setPosition(x + PAD * scale, y + PAD * scale).setScale(scale);
    this.overlay.setPosition(x + PAD * scale, y + PAD * scale).setScale(scale);
  }

  /**
   * @param playerWorld the player's position in world pixels
   * @param view the world camera's visible area (camera.worldView)
   * @param tint ambient light colour, so the minimap dims at night too
   * @param target where the quest marker points, in world pixels (the step's spot, or the door that leads to it)
   */
  update(playerWorld: Phaser.Types.Math.Vector2Like, view: Phaser.Geom.Rectangle, tint: number, target?: Phaser.Types.Math.Vector2Like): void {
    // Only dim halfway, so the minimap stays readable at night.
    const c = Phaser.Display.Color.IntegerToColor(tint);
    const half = Phaser.Display.Color.GetColor((c.red + 255) / 2, (c.green + 255) / 2, (c.blue + 255) / 2);
    this.image.setTint(half);

    const g = this.overlay.clear();
    const bounds = new Phaser.Geom.Rectangle(0, 0, this.mapW, this.mapH);
    const cam = new Phaser.Geom.Rectangle(
      (view.x - this.origin.x) * this.px,
      (view.y - this.origin.y) * this.px,
      view.width * this.px,
      view.height * this.px,
    );
    const visible = Phaser.Geom.Rectangle.Intersection(bounds, cam);
    if (visible.width > 0 && visible.height > 0) {
      g.lineStyle(1, 0xffffff, 0.7);
      g.strokeRectShape(visible);
    }

    const px = (playerWorld.x! - this.origin.x) * this.px;
    const py = (playerWorld.y! - this.origin.y) * this.px;
    if (target) this.drawTarget(g, px, py, (target.x! - this.origin.x) * this.px, (target.y! - this.origin.y) * this.px);
    g.fillStyle(0x000000, 1);
    g.fillCircle(px, py, 4);
    g.fillStyle(0xffd34d, 1);
    g.fillCircle(px, py, 2.5);
  }

  /** The quest marker: a gold diamond where it is, and a little arrow off the hero's dot pointing at it. */
  private drawTarget(g: Phaser.GameObjects.Graphics, px: number, py: number, tx: number, ty: number): void {
    const x = Phaser.Math.Clamp(tx, 0, this.mapW);
    const y = Phaser.Math.Clamp(ty, 0, this.mapH);
    g.fillStyle(0x000000, 1);
    g.fillPoints([new Phaser.Geom.Point(x, y - 5), new Phaser.Geom.Point(x + 5, y), new Phaser.Geom.Point(x, y + 5), new Phaser.Geom.Point(x - 5, y)], true);
    g.fillStyle(0xffc43d, 1);
    g.fillPoints([new Phaser.Geom.Point(x, y - 3.5), new Phaser.Geom.Point(x + 3.5, y), new Phaser.Geom.Point(x, y + 3.5), new Phaser.Geom.Point(x - 3.5, y)], true);
    const dist = Math.hypot(x - px, y - py);
    if (dist < 12) return;
    const a = Math.atan2(y - py, x - px);
    const tip = { x: px + Math.cos(a) * 10, y: py + Math.sin(a) * 10 };
    const side = (s: number) => new Phaser.Geom.Point(px + Math.cos(a + s) * 5.5, py + Math.sin(a + s) * 5.5);
    g.fillStyle(0x000000, 0.9);
    g.fillTriangle(tip.x + Math.cos(a), tip.y + Math.sin(a), side(0.75).x, side(0.75).y, side(-0.75).x, side(-0.75).y);
    g.fillStyle(0xffc43d, 1);
    g.fillTriangle(tip.x, tip.y, side(0.6).x, side(0.6).y, side(-0.6).x, side(-0.6).y);
  }

  private bake(scene: Phaser.Scene, map: IsoMap): void {
    if (scene.textures.exists('minimap')) scene.textures.remove('minimap');
    const g = scene.make.graphics({}, false);
    const hw = (TILE_WIDTH / 2) * this.px + 0.3; // slight overlap hides seams between tiles
    const hh = hw / 2;
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const p = gridToScreen(tx + 0.5, ty + 0.5);
        const cx = (p.x - this.origin.x) * this.px;
        const cy = (p.y - this.origin.y) * this.px;
        const color = PROP_COLOR[map.data.props[ty][tx]] ?? TERRAIN_COLOR[map.data.terrain[ty][tx]];
        g.fillStyle(color, 1);
        g.fillPoints(
          [
            new Phaser.Geom.Point(cx, cy - hh),
            new Phaser.Geom.Point(cx + hw, cy),
            new Phaser.Geom.Point(cx, cy + hh),
            new Phaser.Geom.Point(cx - hw, cy),
          ],
          true,
        );
      }
    }
    g.generateTexture('minimap', Math.ceil(this.mapW), Math.ceil(this.mapH));
    g.destroy();
  }
}
