import Phaser from 'phaser';
import { PALETTE as P } from '../art/palette';
import { depthAt, gridToScreen, screenToGrid } from '../iso/IsoMath';
import type { HillField } from './greyfellsHills';
import { HILL_BLOCKS, outcrop, valueNoise } from './greyfellsHills';
import type { BakedLayer } from './BakedLayer';

/** How much steeper than they are the slopes are shaded. */
const RELIEF = 2.6;
/** Height samples painted per tile, each way. */
const N = 24;
/** Largest canvas painted at once (see BakedLayer). */
const CHUNK = 2000;
/** Tiles further back than this along a strip are cut into separate pieces, so a hill only fades near whoever it hides. */
const STRIP = 4;

export interface HillSurroundings {
  width: number;
  height: number;
  /** Whether something that is drawn on its own (someone walking, a tree, a tent) can be on tile (tx, ty). */
  occupied(tx: number, ty: number): boolean;
  /** Multiplies the hills' turf so its foot matches the ground it rises out of. */
  groundShade?: number;
  fog: number;
  /** Tiles past the edge over which the land fades into the fog. */
  fade: number;
}

export interface PaintedHills {
  /** Hill pieces that have to sort with the people and things in front of and behind them. */
  pieces: Phaser.GameObjects.Image[];
  /** Textures only needed until the ground layer is baked. */
  temporary: string[];
}

type Rgb = [number, number, number];
const rgb = (c: number): Rgb => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
const mulRgb = (c: number, m: number): Rgb => {
  const a = rgb(c);
  const b = rgb(m);
  return [Math.round((a[0] * b[0]) / 255), Math.round((a[1] * b[1]) / 255), Math.round((a[2] * b[2]) / 255)];
};

const hash = (x: number, y: number): number => {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

interface Canvas {
  x0: number;
  y0: number;
  w: number;
  h: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

const makeCanvas = (x0: number, y0: number, w: number, h: number): Canvas => ({ x0, y0, w, h, data: new Uint8ClampedArray(w * h * 4) });

/**
 * Paints a map's hills (see greyfellsHills) as one landscape: every point of
 * the ground a column of turf or rock, lit from the same side as everything
 * else, with crags where it's steep, heather in patches and snow on the high
 * tops, and fading into the mist past the map's edge. Slopes nobody can stand
 * behind go flat into the ground layer; the rest are cut into strips along
 * the tile diagonals, which sort with everything else exactly as tiles would.
 */
export function paintHills(scene: Phaser.Scene, field: HillField, around: HillSurroundings, bounds: Phaser.Geom.Rectangle, ground: BakedLayer): PaintedHills {
  const shade = around.groundShade ?? 0xffffff;
  const turf = [P.leafDark, P.grassDark, P.grass, P.grassLight].map((c) => mulRgb(c, shade));
  // Bleached winter grass in drifts across the turf.
  const straw = [0x434a2c, 0x5c6236, 0x767842, 0x8f8e50].map((c) => mulRgb(c, shade | 0x303030));
  const bloom = rgb(0x8a5c8e);
  const rock = [P.mortar, P.stoneDark, P.stone, P.stoneLight].map((c) => mulRgb(c, 0xf4eee2));
  const snow = [0x7f8a9c, 0xaab5c4, 0xd4dce6, 0xf2f5f9].map(rgb);
  const moss = rgb(P.moss);
  const fog = rgb(around.fog);

  // Every tile whose hill could show: past the bottom of the view too, since tall ones reach up into it.
  const corners = [
    screenToGrid(bounds.left, bounds.top),
    screenToGrid(bounds.right, bounds.top),
    screenToGrid(bounds.left, bounds.bottom + 300),
    screenToGrid(bounds.right, bounds.bottom + 300),
  ];
  const minX = Math.floor(Math.min(...corners.map((c) => c.x))) - 1;
  const maxX = Math.ceil(Math.max(...corners.map((c) => c.x))) + 1;
  const minY = Math.floor(Math.min(...corners.map((c) => c.y))) - 1;
  const maxY = Math.ceil(Math.max(...corners.map((c) => c.y))) + 1;

  const inMap = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < around.width && ty < around.height;
  const occupied = (tx: number, ty: number) => inMap(tx, ty) && around.occupied(tx, ty);
  // A hill has to sort if anyone could stand where it would hide them: on a tile behind it, within its height.
  const mustSort = (tx: number, ty: number, top: number) => {
    const reach = Math.ceil(top / 16) + 2;
    for (let a = 0; a <= reach; a++) {
      for (let b = 0; b <= reach; b++) {
        if ((a === 0 && b === 0) || Math.abs(a - b) > 2) continue;
        if (occupied(tx - a, ty - b)) return true;
      }
    }
    return false;
  };

  type Tile = { tx: number; ty: number; top: number };
  const back: Tile[] = [];
  const strips = new Map<number, Tile[]>();
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const top = field.tileMax(tx, ty);
      if (top < 1.2) continue;
      const c = gridToScreen(tx + 0.5, ty + 0.5);
      if (c.x < bounds.left - 40 || c.x > bounds.right + 40 || c.y - top - 40 > bounds.bottom || c.y + 20 < bounds.top) continue;
      const tile = { tx, ty, top };
      if (top >= HILL_BLOCKS && mustSort(tx, ty, top)) {
        const k = tx + ty;
        if (!strips.has(k)) strips.set(k, []);
        strips.get(k)!.push(tile);
      } else back.push(tile);
    }
  }

  /** Paints one tile's worth of ground into whichever canvases it falls on. */
  const paintTile = (t: Tile, targets: Canvas[]) => {
    const out = Math.max(-t.tx, -t.ty, t.tx - around.width + 1, t.ty - around.height + 1);
    const haze = Math.min(1, Math.max(0, out) / around.fade) * 0.85;
    const e = 1 / N;
    const put = (x: number, y: number, c: Rgb) => {
      for (const cv of targets) {
        const px = x - cv.x0;
        const py = y - cv.y0;
        if (px < 0 || py < 0 || px >= cv.w || py >= cv.h) continue;
        const i = (py * cv.w + px) * 4;
        cv.data[i] = c[0] + (fog[0] - c[0]) * haze;
        cv.data[i + 1] = c[1] + (fog[1] - c[1]) * haze;
        cv.data[i + 2] = c[2] + (fog[2] - c[2]) * haze;
        cv.data[i + 3] = 255;
      }
    };
    for (let s = 0; s <= 2 * N - 2; s++) {
      for (let i = Math.max(0, s - N + 1); i <= Math.min(N - 1, s); i++) {
        const j = s - i;
        const x = t.tx + (i + 0.5) * e;
        const y = t.ty + (j + 0.5) * e;
        const h = field.at(x, y);
        if (h < 1.2) continue;
        const hx = (field.at(x + e, y) - field.at(x - e, y)) / (2 * e * 32);
        const hy = (field.at(x, y + e) - field.at(x, y - e)) / (2 * e * 32);
        const len = Math.hypot(hx, hy, 1);
        const nz = 1 / len;
        // Shaded as if the slopes were steeper than they are, so the lie of the land reads at a glance.
        const lumpy = valueNoise(x * 0.9, y * 0.9, 41);
        const crag = outcrop(x, y) > 0.66 && h > 24;
        const steep = crag || nz < 0.62 + (lumpy - 0.5) * 0.3 - Math.min(0.12, h / 1500);
        // Rock catches the light on every ledge and crack.
        const relief = steep ? RELIEF * 2.4 : RELIEF;
        const ex = hx * relief;
        const ey = hy * relief;
        const elen = Math.hypot(ex, ey, 1);
        // Lit from the upper left, like everything else (the +y side bright, the +x side in shade), with some light from the sky everywhere.
        const sun = Math.max(0, (ex * 0.45 - ey * 0.55 + 0.7) / elen);
        // Hollows darker than the ground round them.
        const r = 0.6;
        const around = (field.at(x - r, y) + field.at(x + r, y) + field.at(x, y - r) + field.at(x, y + r)) / 4;
        const hollow = Math.max(-0.12, Math.min(0.22, (around - h) / 40));
        const light = (steep ? 0.42 : 0.2) + 0.95 * sun - hollow;
        const gx = Math.floor(x * N);
        const gy = Math.floor(y * N);
        const n = hash(gx, gy);
        let ramp: Rgb[];
        if (h > 150 + lumpy * 50 && nz > 0.42) ramp = snow;
        else if (steep) ramp = rock;
        else ramp = turf;
        // Grain: rock is broken and fissured, turf tussocky.
        const grain = ramp === rock ? (valueNoise(x * 3.1, y * 3.1, 71) - 0.5) * 0.7 + (valueNoise(x * 7, y * 1.5, 73) - 0.5) * 0.4 : (valueNoise(x * 2.3, y * 2.3, 79) - 0.5) * 0.35;
        const k = Math.max(0, Math.min(3, Math.floor(light * 3.6 - 0.2 + grain + (n - 0.5) * 0.7)));
        let top: Rgb = ramp[k];
        if (ramp === rock) {
          // Bedding in the rock, and moss where it holds the wet.
          if (Math.floor(h / 7) % 3 === 0 && n < 0.35) top = rock[Math.max(0, k - 1)];
          else if (valueNoise(x * 1.7, y * 1.7, 23) > 0.72 && n > 0.4) top = moss;
        } else if (ramp === turf) {
          // Bleached winter grass in drifts across the turf, and the odd bloom.
          const dry = Math.max(0, valueNoise(x * 0.3, y * 0.3, 9) - 0.45) * 1.1 + (n - 0.5) * 0.15;
          if (dry > 0.12) top = straw[k];
          if (n > 0.988) top = n > 0.995 ? rgb(P.flowerYellow) : bloom;
        }
        // The face below a column's top is the slope itself where it's steep: shade it like the top, a touch darker,
        // with the rock's bedding running across it in level bands.
        const face = (z: number, py: number): Rgb => {
          const d = hash(gx * 7 + py, gy);
          let kk = Math.max(0, Math.min(3, Math.floor(light * 3.6 - 0.3 + grain + (d - 0.5) * 1.1)));
          if (ramp === rock && (Math.floor(z / 5) + Math.floor(valueNoise(x * 2, y * 2, 83) * 3)) % 4 === 0) kk = Math.max(0, kk - 1);
          return ramp[kk];
        };

        const p = gridToScreen(x, y);
        const sx = Math.round(p.x);
        const ty0 = Math.round(p.y - h);
        // Down to where the ground just in front takes over, or all the way at the tile's front edges.
        const f = gridToScreen(x + e, y + e);
        const bottom = Math.min(Math.round(p.y), Math.round(f.y - field.at(x + e, y + e)));
        for (let dx = 0; dx < 2; dx++) {
          put(sx + dx, ty0, top);
          for (let py = ty0 + 1; py <= Math.max(ty0 + 1, bottom); py++) put(sx + dx, py, face(h - (py - ty0), py));
        }
      }
    }
  };

  /** The screen box a tile's hill takes up. */
  const box = (t: Tile) => {
    const c = gridToScreen(t.tx + 0.5, t.ty + 0.5);
    return { left: Math.floor(c.x - 33), right: Math.ceil(c.x + 33), top: Math.floor(c.y - 16 - t.top - 2), bottom: Math.ceil(c.y + 17) };
  };

  const temporary: string[] = [];
  const pieces: Phaser.GameObjects.Image[] = [];
  const upload = (cv: Canvas, key: string) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, cv.w, cv.h)!;
    tex.context.putImageData(new ImageData(cv.data, cv.w, cv.h), 0, 0);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  };

  // The slopes nobody can get behind, flat into the ground.
  if (back.length > 0) {
    const boxes = back.map(box);
    const left = Math.min(...boxes.map((b) => b.left));
    const right = Math.max(...boxes.map((b) => b.right));
    const top = Math.min(...boxes.map((b) => b.top));
    const bottom = Math.max(...boxes.map((b) => b.bottom));
    const canvases: Canvas[] = [];
    for (let y0 = top; y0 < bottom; y0 += CHUNK) {
      for (let x0 = left; x0 < right; x0 += CHUNK) canvases.push(makeCanvas(x0, y0, Math.min(CHUNK, right - x0), Math.min(CHUNK, bottom - y0)));
    }
    const order = back.map((t, i) => ({ t, b: boxes[i] })).sort((a, b) => a.t.tx + a.t.ty - (b.t.tx + b.t.ty));
    for (const { t, b } of order) {
      paintTile(t, canvases.filter((cv) => b.right > cv.x0 && b.left < cv.x0 + cv.w && b.bottom > cv.y0 && b.top < cv.y0 + cv.h));
    }
    canvases.forEach((cv, i) => {
      const key = `hills-back-${i}`;
      upload(cv, key);
      temporary.push(key);
      ground.draw(key, cv.x0, cv.y0, { originX: 0, originY: 0 });
    });
  }

  // The rest in strips along the diagonals, each sorted like a tile on it.
  for (const [k, tiles] of strips) {
    tiles.sort((a, b) => a.tx - b.tx);
    let run: Tile[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const boxes = run.map(box);
      const left = Math.min(...boxes.map((b) => b.left));
      const right = Math.max(...boxes.map((b) => b.right));
      const top = Math.min(...boxes.map((b) => b.top));
      const bottom = Math.max(...boxes.map((b) => b.bottom));
      const cv = makeCanvas(left, top, right - left, bottom - top);
      for (const t of run) paintTile(t, [cv]);
      const key = `hills-${k}-${run[0].tx}`;
      upload(cv, key);
      const first = run[0];
      pieces.push(scene.add.image(left, top, key).setOrigin(0, 0).setDepth(depthAt(first.tx + 0.5, first.ty + 0.5)));
      run = [];
    };
    for (const t of tiles) {
      const last = run[run.length - 1];
      if (last && (t.tx !== last.tx + 1 || run.length >= STRIP)) flush();
      run.push(t);
    }
    flush();
  }
  return { pieces, temporary };
}
