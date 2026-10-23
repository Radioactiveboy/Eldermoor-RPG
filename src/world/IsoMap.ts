import Phaser from 'phaser';
import { MODEL_ART, WALL_HEIGHT } from '../art/interior';
import { CROP_H, CROP_ORIGIN_Y, cropKey } from '../art/farm';
import { DECOR_KEYS, ROCK_ART, TREE_ART } from '../art/props';
import { TILE_VARIANTS, tileKey } from '../art/tiles';
import { depthAt, gridToScreen } from '../iso/IsoMath';
import { MapData, MapObject, Prop, Terrain, TERRAIN_WALKABLE } from './MapData';

const TERRAIN_TEXTURE: Record<Terrain, string> = {
  [Terrain.Grass]: 'tile-grass',
  [Terrain.Dirt]: 'tile-dirt',
  [Terrain.Stone]: 'tile-stone',
  [Terrain.Water]: 'tile-water',
  [Terrain.Sand]: 'tile-sand',
  [Terrain.Floor]: 'tile-floor',
  [Terrain.Soil]: 'tile-soil',
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
  /** Tiles taken by things that can move, like NPCs. */
  private readonly occupied = new Set<number>();
  /** Tree sprites by tile index, so they can sway when shaken. */
  readonly trees = new Map<number, { image: Phaser.GameObjects.Image; pine: boolean }>();
  /** Crop sprites by tile index (see MapData.crops). */
  readonly crops = new Map<number, Phaser.GameObjects.Image>();

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
    if (this.occupied.has(ty * this.data.width + tx)) return false;
    return TERRAIN_WALKABLE[this.data.terrain[ty][tx]] && this.data.props[ty][tx] === Prop.None;
  }

  setOccupied(tx: number, ty: number, occupied: boolean): void {
    const i = ty * this.data.width + tx;
    if (occupied) this.occupied.add(i);
    else this.occupied.delete(i);
  }

  /** Pixel bounds of the whole map, for camera limits. */
  getWorldBounds(): Phaser.Geom.Rectangle {
    const left = gridToScreen(0, this.data.height).x;
    const right = gridToScreen(this.data.width, 0).x;
    const bottom = gridToScreen(this.data.width, this.data.height).y;
    // Leave room above the map for walls and tall things on the back row.
    const top = this.data.walls ? WALL_HEIGHT + 30 : 64;
    return new Phaser.Geom.Rectangle(left, -top, right - left, bottom + top);
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
        if (prop === Prop.Tree || prop === Prop.Rock) {
          this.placeProp(prop, tx, ty);
        } else if (prop === Prop.None && t === Terrain.Grass && tileHash(tx, ty, 2) < 0.22) {
          // Flowers, tufts and pebbles are painted flat into the ground layer.
          const key = DECOR_KEYS[Math.floor(tileHash(tx, ty, 3) * DECOR_KEYS.length)];
          stamp.setTexture(key).clearTint().setOrigin(0.5, 1);
          const ox = (tileHash(tx, ty, 4) - 0.5) * 24;
          const oy = (tileHash(tx, ty, 5) - 0.5) * 10 + 4;
          ground.batchDraw(stamp, center.x - bounds.x + ox, center.y - bounds.y + oy);
        }
      }
    }
    // Rugs and mats lie flat on the floor, so they're painted into it too.
    for (const obj of this.data.objects ?? []) {
      if (!obj.flat) continue;
      const art = MODEL_ART[obj.key];
      const p = gridToScreen(obj.tx, obj.ty);
      stamp.setTexture(art.key).clearTint().setFlipX(!!obj.flipX);
      stamp.setOrigin(obj.flipX ? 1 - art.originX : art.originX, art.originY);
      ground.batchDraw(stamp, p.x - bounds.x, p.y - bounds.y);
    }
    ground.endDraw();
    ground.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    stamp.destroy();

    this.renderWalls();
    for (const obj of this.data.objects ?? []) if (!obj.flat) this.placeObject(obj);
    for (const crop of this.data.crops ?? []) {
      const c = gridToScreen(crop.tx + 0.5, crop.ty + 0.5);
      const img = this.scene.add.image(c.x, c.y, cropKey(crop.kind, true));
      img.setOrigin(0.5, CROP_ORIGIN_Y / CROP_H).setDepth(depthAt(crop.tx + 0.5, crop.ty + 0.5));
      this.crops.set(crop.ty * width + crop.tx, img);
    }
  }

  /** The two back walls of an indoor room, behind everything else. */
  private renderWalls(): void {
    const walls = this.data.walls;
    if (!walls) return;
    const put = (key: string, gx: number, gy: number, depth: number) => {
      const art = MODEL_ART[key];
      const p = gridToScreen(gx, gy);
      this.scene.add.image(p.x, p.y, art.key).setOrigin(art.originX, art.originY).setDepth(depth);
    };
    walls.back.forEach((key, gx) => put(key, gx, 0, 0.8));
    walls.side.forEach((key, gy) => put(key, 0, gy, 0.8));
    put('wall-corner', 0, 0, 0.9);
  }

  private placeObject(obj: MapObject): void {
    const art = MODEL_ART[obj.key];
    const p = gridToScreen(obj.tx, obj.ty);
    // Sort by the middle of the footprint, so you can walk in front of and behind it.
    const depth = depthAt(obj.tx + obj.w / 2, obj.ty + obj.h / 2);
    const sprite = this.scene.add.sprite(p.x, p.y, art.key, obj.anim ? 0 : undefined);
    sprite.setOrigin(obj.flipX ? 1 - art.originX : art.originX, art.originY).setFlipX(!!obj.flipX).setDepth(depth);
    if (obj.anim) sprite.play(obj.anim);
  }

  private placeProp(prop: Prop, tx: number, ty: number): void {
    const center = gridToScreen(tx + 0.5, ty + 0.5);
    const depth = depthAt(tx + 0.5, ty + 0.5);
    const isTree = prop === Prop.Tree;
    const options = isTree ? TREE_ART : ROCK_ART;
    const index = Math.floor(tileHash(tx, ty, 6) * options.length);
    const art = options[index];
    if (isTree) {
      // Shadows sit just above the ground so they never cover a character.
      this.scene.add.image(center.x, center.y + 2, 'shadow-large').setDepth(0.5);
    }
    const img = this.scene.add.image(center.x, center.y + 4, art.key);
    img.setOrigin(0.5, art.originY).setDepth(depth);
    // Mirror half the props so the forest doesn't look stamped.
    img.setFlipX(tileHash(tx, ty, 7) < 0.5);
    if (isTree) this.trees.set(ty * this.data.width + tx, { image: img, pine: art.key.includes('pine') });
  }
}
