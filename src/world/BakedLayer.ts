import Phaser from 'phaser';

/** Largest texture a baked layer uses, in pixels a side: some phones can't hold anything bigger. */
const CHUNK = 2048;

interface Stamp {
  key: string;
  x: number;
  y: number;
  tint: number;
  flipX: boolean;
  originX: number;
  originY: number;
}

export interface StampOptions {
  tint?: number;
  flipX?: boolean;
  originX?: number;
  originY?: number;
}

/**
 * Art painted flat into one layer, such as the ground or the far trees in
 * front of the map. Everything is drawn first and then baked into render
 * textures of at most CHUNK pixels a side, laid edge to edge, so a big map
 * (Adowvale Plains) still fits on a phone whose GPU can't hold one huge texture.
 */
export class BakedLayer {
  private readonly stamps: Stamp[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly area: Phaser.Geom.Rectangle,
  ) {}

  /** Paints a texture at a world position. */
  draw(key: string, x: number, y: number, opts: StampOptions = {}): void {
    this.stamps.push({
      key,
      x,
      y,
      tint: opts.tint ?? 0xffffff,
      flipX: opts.flipX ?? false,
      originX: opts.originX ?? 0.5,
      originY: opts.originY ?? 0.5,
    });
  }

  /** Bakes everything drawn into textures shown at `depth`. */
  bake(depth: number): void {
    const { scene, area } = this;
    const stamp = scene.make.image({ key: this.stamps[0]?.key ?? '__WHITE' }, false);
    const sizes = new Map<string, { w: number; h: number }>();
    const size = (key: string) => {
      let s = sizes.get(key);
      if (!s) {
        const frame = scene.textures.getFrame(key);
        s = { w: frame.width, h: frame.height };
        sizes.set(key, s);
      }
      return s;
    };
    const left = Math.floor(area.x);
    const top = Math.floor(area.y);
    const right = Math.ceil(area.right);
    const bottom = Math.ceil(area.bottom);
    for (let y0 = top; y0 < bottom; y0 += CHUNK) {
      for (let x0 = left; x0 < right; x0 += CHUNK) {
        const w = Math.min(CHUNK, right - x0);
        const h = Math.min(CHUNK, bottom - y0);
        const rt = scene.add.renderTexture(x0, y0, w, h).setOrigin(0, 0).setDepth(depth);
        rt.beginDraw();
        for (const s of this.stamps) {
          // Skip anything that can't reach this piece (generously: the origin can be anywhere in the art).
          const { w: sw, h: sh } = size(s.key);
          if (s.x + sw < x0 || s.x - sw > x0 + w || s.y + sh < y0 || s.y - sh > y0 + h) continue;
          stamp.setTexture(s.key).setTint(s.tint).setFlipX(s.flipX).setOrigin(s.originX, s.originY);
          rt.batchDraw(stamp, s.x - x0, s.y - y0);
        }
        rt.endDraw();
        rt.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    stamp.destroy();
  }
}
