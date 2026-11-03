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

  /**
   * Rounds out a figure drawn from flat, evenly shaded parts, so it reads as a
   * solid body rather than a paper cut-out. Lit from the upper left, as the
   * rest of the art is:
   * - each horizontal run of the figure is shaded as a cylinder: a lit band on
   *   the left, a core shadow on the right, deepest at the far edge;
   * - the whole figure darkens a little from head to foot, and more near the
   *   ground where it stands (ambient occlusion);
   * - a warm rim of light catches the edges facing the light.
   * Call before {@link outline}; the outline is left untouched.
   */
  shadeForm(): void {
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!this.isSolid(x, y)) continue;
        if (top < 0) top = y;
        bottom = y;
        break;
      }
    }
    if (top < 0) return;
    const height = Math.max(1, bottom - top);
    const src = this.rgb.slice();
    const solid = (x: number, y: number) => this.isSolid(x, y);
    for (let y = top; y <= bottom; y++) {
      // Head to foot: a gentle fall-off in steps of three rows, so it stays crisp.
      const t = Math.floor((y - top) / 3) * 3 / height;
      let vertical = 1.06 - t * 0.2;
      const fromGround = bottom - y;
      if (fromGround < 4) vertical *= 0.8 + fromGround * 0.05;
      let x = 0;
      while (x < this.width) {
        if (!solid(x, y)) {
          x++;
          continue;
        }
        let end = x;
        while (end + 1 < this.width && solid(end + 1, y)) end++;
        const len = end - x + 1;
        for (let px = x; px <= end; px++) {
          const i = y * this.width + px;
          let f = vertical;
          if (len >= 3) {
            // -1 at the run's left edge to 1 at its right.
            const n = ((px - x + 0.5) / len) * 2 - 1;
            if (n < -0.45) f *= 1.1;
            else if (n > 0.7 && len >= 5) f *= 0.68;
            else if (n > 0.3) f *= 0.82;
          }
          let color = shadeColor(src[i], f);
          // Rim light on edges that face the light (open to the left or above).
          if (!solid(px - 1, y) || (!solid(px, y - 1) && !solid(px - 1, y - 1))) color = mix(color, RIM_LIGHT, 0.22);
          this.rgb[i] = color;
        }
        x = end + 1;
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

/** The warm light that catches a figure's lit edges (see PixelCanvas.shadeForm). */
const RIM_LIGHT = 0xffe8b8;

/** A colour darkened (f < 1, multiplied) or lightened (f > 1, towards white). */
function shadeColor(color: number, f: number): number {
  const ch = (shift: number) => {
    const v = (color >> shift) & 0xff;
    const out = f <= 1 ? v * f : v + (255 - v) * (f - 1);
    return Math.max(0, Math.min(255, Math.round(out))) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}

/** `a` blended towards `b` by `t` (0..1). */
function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t) << shift;
  return ch(16) | ch(8) | ch(0);
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
