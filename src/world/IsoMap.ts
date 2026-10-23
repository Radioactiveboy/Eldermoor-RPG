import Phaser from 'phaser';
import { DECOR_KEYS, ROCK_ART, TREE_ART } from '../art/props';
import { TILE_VARIANTS, tileKey } from '../art/tiles';
import { depthAt, gridToScreen } from '../iso/IsoMath';
import { MapData, Prop, Terrain, TERRAIN_WALKABLE } from './MapData';

const TERRAIN_TEXTURE: Record<Terrain, string> = {
  [Terrain.Grass]: 'tile-grass',
  [Terrain.Dirt]: 'tile-dirt',
  [Terrain.Stone]: 'tile-stone',
  [Terrain.Water]: 'tile-water',
  [Terrain.Sand]: 'tile-sand',
};

/** Stable pseudo-random number per tile, so variants don't change between loads. */
function tileHash(tx: number, ty: number, salt = 0): number {
  let h = (tx * 374761393 + ty * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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
        const t = terrain[ty][tx];
        const variant = Math.floor(tileHash(tx, ty) * TILE_VARIANTS);
        stamp.setTexture(tileKey(TERRAIN_TEXTURE[t], variant));
        // Subtle per-tile brightness variation so large areas don't look flat.
        const shade = 0xec + Math.floor(tileHash(tx, ty, 1) * 0x14);
        stamp.setTint(Phaser.Display.Color.GetColor(shade, shade, shade));
        stamp.setOrigin(0.5);
        ground.batchDraw(stamp, center.x - bounds.x, center.y - bounds.y);

        const prop = props[ty][tx];
        if (prop !== Prop.None) {
          this.placeProp(prop, tx, ty);
        } else if (t === Terrain.Grass && tileHash(tx, ty, 2) < 0.22) {
          // Flowers, tufts and pebbles are painted flat into the ground layer.
          const key = DECOR_KEYS[Math.floor(tileHash(tx, ty, 3) * DECOR_KEYS.length)];
          stamp.setTexture(key).clearTint().setOrigin(0.5, 1);
          const ox = (tileHash(tx, ty, 4) - 0.5) * 24;
          const oy = (tileHash(tx, ty, 5) - 0.5) * 10 + 4;
          ground.batchDraw(stamp, center.x - bounds.x + ox, center.y - bounds.y + oy);
        }
      }
    }
    ground.endDraw();
    ground.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    stamp.destroy();
  }

  private placeProp(prop: Prop, tx: number, ty: number): void {
    const center = gridToScreen(tx + 0.5, ty + 0.5);
    const depth = depthAt(tx + 0.5, ty + 0.5);
    const isTree = prop === Prop.Tree;
    const options = isTree ? TREE_ART : ROCK_ART;
    const art = options[Math.floor(tileHash(tx, ty, 6) * options.length)];
    if (isTree) {
      // Shadows sit just above the ground so they never cover a character.
      this.scene.add.image(center.x, center.y + 2, 'shadow-large').setDepth(0.5);
    }
    const img = this.scene.add.image(center.x, center.y + 4, art.key);
    img.setOrigin(0.5, art.originY).setDepth(depth);
    // Mirror half the props so the forest doesn't look stamped.
    img.setFlipX(tileHash(tx, ty, 7) < 0.5);
  }
}
