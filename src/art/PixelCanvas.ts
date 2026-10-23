import Phaser from 'phaser';
import { PALETTE } from './palette';

/**
 * A tiny pixel-art painter. Art is drawn pixel by pixel into a buffer, then
 * uploaded to Phaser as a texture with nearest-neighbour filtering so it stays
 * crisp when the camera zooms.
 */
export class PixelCanvas {
  readonly width: number;
  readonly height: number;
  /** 0 = transparent, otherwise 0xRRGGBB with the alpha in `alpha`. */
  private readonly rgb: Int32Array;
  private readonly alpha: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.rgb = new Int32Array(width * height);
    this.alpha = new Uint8Array(width * height);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  set(x: number, y: number, color: number, a = 255): void {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return;
    const i = y * this.width + x;
    this.rgb[i] = color;
    this.alpha[i] = a;
  }

  get(x: number, y: number): number | null {
    if (!this.inside(x, y)) return null;
    const i = y * this.width + x;
    return this.alpha[i] > 0 ? this.rgb[i] : null;
  }

  isSolid(x: number, y: number): boolean {
    return this.inside(x, y) && this.alpha[y * this.width + x] > 0;
  }

  rect(x: number, y: number, w: number, h: number, color: number): void {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++) this.set(xx, yy, color);
    }
  }

  /** Rect lit from the top-left: light left column, shaded right side. */
  shadedRect(x: number, y: number, w: number, h: number, base: number, shade: number, light?: number): void {
    const x0 = Math.round(x);
    const x1 = Math.round(x + w);
    const shadeFrom = x1 - Math.max(1, Math.round((x1 - x0) / 3));
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
      for (let xx = x0; xx < x1; xx++) {
        let c = base;
        if (xx >= shadeFrom) c = shade;
        else if (light !== undefined && xx === x0 && x1 - x0 > 2) c = light;
        this.set(xx, yy, c);
      }
    }
  }

  /** Filled ellipse, optionally shaded towards the bottom-right. */
  ellipse(cx: number, cy: number, rx: number, ry: number, base: number, shade?: number, light?: number): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        let c = base;
        const lit = nx * 0.7 + ny * 0.7;
        if (shade !== undefined && lit > 0.35) c = shade;
        else if (light !== undefined && lit < -0.45 && d > 0.15) c = light;
        this.set(x, y, c);
      }
    }
  }

  /** Paint a 1px outline around every solid shape (pixel-art "selout"). */
  outline(color: number = PALETTE.outline): void {
    const edge: number[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.isSolid(x, y)) continue;
        if (this.isSolid(x - 1, y) || this.isSolid(x + 1, y) || this.isSolid(x, y - 1) || this.isSolid(x, y + 1)) {
          edge.push(y * this.width + x);
        }
      }
    }
    for (const i of edge) {
      this.rgb[i] = color;
      this.alpha[i] = 255;
    }
  }

  /** Copy another canvas onto this one at (dx, dy), skipping transparent pixels. */
  blit(src: PixelCanvas, dx: number, dy: number): void {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const i = y * src.width + x;
        if (src.alpha[i] > 0) this.set(dx + x, dy + y, src.rgb[i], src.alpha[i]);
      }
    }
  }

  toImageData(): ImageData {
    const data = new ImageData(this.width, this.height);
    for (let i = 0; i < this.rgb.length; i++) {
      const c = this.rgb[i];
      data.data[i * 4] = (c >> 16) & 0xff;
      data.data[i * 4 + 1] = (c >> 8) & 0xff;
      data.data[i * 4 + 2] = c & 0xff;
      data.data[i * 4 + 3] = this.alpha[i];
    }
    return data;
  }

  /** Upload as a Phaser texture. Returns the texture so callers can add frames. */
  toTexture(scene: Phaser.Scene, key: string): Phaser.Textures.CanvasTexture {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, this.width, this.height)!;
    tex.context.putImageData(this.toImageData(), 0, 0);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return tex;
  }
}

/** Small deterministic RNG so generated art is identical on every load. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
