import Phaser from 'phaser';
import { depthAt, gridToScreen } from '../iso/IsoMath';
import { MapData, Prop, Terrain, TERRAIN_WALKABLE } from './MapData';

const TERRAIN_TEXTURE: Record<Terrain, string> = {
  [Terrain.Grass]: 'tile-grass',
  [Terrain.Dirt]: 'tile-dirt',
  [Terrain.Stone]: 'tile-stone',
  [Terrain.Water]: 'tile-water',
  [Terrain.Sand]: 'tile-sand',
};

/** Renders a MapData in isometric view and answers walkability queries. */
export class IsoMap {
  readonly data: MapData;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, data: MapData) {
    this.scene = scene;
    this.data = data;
    this.render();
  }

  get width(): number {
    return this.data.width;
  }

  get height(): number {
    return this.data.height;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.data.width && ty < this.data.height;
  }

  isWalkable(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return false;
    return TERRAIN_WALKABLE[this.data.terrain[ty][tx]] && this.data.props[ty][tx] === Prop.None;
  }

  /** Pixel bounds of the whole map, for camera limits. */
  getWorldBounds(): Phaser.Geom.Rectangle {
    const left = gridToScreen(0, this.data.height).x;
    const right = gridToScreen(this.data.width, 0).x;
    const bottom = gridToScreen(this.data.width, this.data.height).y;
    return new Phaser.Geom.Rectangle(left, -64, right - left, bottom + 64);
  }

  private render(): void {
    const { width, height, terrain, props } = this.data;

    // Bake all ground tiles into one texture: one draw call instead of thousands.
    const bounds = this.getWorldBounds();
    const ground = this.scene.add.renderTexture(bounds.x, bounds.y, bounds.width, bounds.height);
    ground.setOrigin(0, 0).setDepth(0);
    const stamp = this.scene.make.image({ key: 'tile-grass' }, false);

    ground.beginDraw();
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const center = gridToScreen(tx + 0.5, ty + 0.5);
        stamp.setTexture(TERRAIN_TEXTURE[terrain[ty][tx]]);
        // Subtle per-tile brightness variation so large areas don't look flat.
        const shade = 0xe6 + ((tx * 7 + ty * 13) % 0x1a);
        stamp.setTint(Phaser.Display.Color.GetColor(shade, shade, shade));
        ground.batchDraw(stamp, center.x - bounds.x, center.y - bounds.y);

        const prop = props[ty][tx];
        if (prop !== Prop.None) {
          const key = prop === Prop.Tree ? 'prop-tree' : 'prop-rock';
          const img = this.scene.add.image(center.x, center.y + 4, key);
          img.setOrigin(0.5, prop === Prop.Tree ? 0.95 : 0.8);
          img.setDepth(depthAt(tx + 0.5, ty + 0.5));
        }
      }
    }
    ground.endDraw();
    stamp.destroy();
  }
}
