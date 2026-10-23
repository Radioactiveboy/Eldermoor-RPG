import Phaser from 'phaser';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';

/**
 * Standing props (trees, rocks) and flat ground decorations (flowers, tufts).
 * Each standing prop records where its base sits so IsoMap can plant it on a tile.
 */
export interface PropArt {
  key: string;
  /** Sprite origin (0..1) that puts the base of the trunk/rock on the tile centre. */
  originY: number;
}

export const TREE_ART: PropArt[] = [];
export const ROCK_ART: PropArt[] = [];
/** Small flat details baked into the ground layer (repeated by how common each is). */
export const DECOR_KEYS: string[] = [];

function register(list: PropArt[], scene: Phaser.Scene, key: string, c: PixelCanvas, baseRow: number): void {
  c.toTexture(scene, key);
  list.push({ key, originY: (baseRow + 0.5) / c.height });
}

/** Dither: scatter darker pixels into shaded areas and lighter ones into lit areas. */
function texture(c: PixelCanvas, rnd: () => number, pairs: Array<[number, number]>, chance: number): void {
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const col = c.get(x, y);
      if (col === null || rnd() > chance) continue;
      for (const [from, to] of pairs) if (col === from) c.set(x, y, to);
    }
  }
}

function oak(seed: number): PixelCanvas {
  const W = 64;
  const H = 90;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  const j = () => Math.round((rnd() - 0.5) * 6);

  // Trunk with flared roots.
  c.shadedRect(28, 54, 9, 32, P.bark, P.barkDark, P.barkLight);
  c.shadedRect(25, 82, 15, 4, P.bark, P.barkDark, P.barkLight);
  c.rect(23, 85, 4, 2, P.bark);
  c.rect(38, 85, 4, 2, P.barkDark);
  for (let y = 58; y < 84; y += 5) c.set(31 + (y % 3), y, P.barkDark);
  // A low branch poking out.
  c.rect(37, 62, 6, 3, P.bark);
  c.rect(42, 59, 3, 4, P.bark);

  // Canopy: back clumps first, front clumps last, each shaded on its own.
  const clumps: Array<[number, number, number, number]> = [
    [32 + j(), 14, 12, 10],
    [20 + j(), 22, 12, 11],
    [44 + j(), 22, 12, 11],
    [32, 30, 20, 16],
    [14, 38 + j(), 11, 10],
    [50, 38 + j(), 11, 10],
    [24 + j(), 44, 13, 10],
    [42 + j(), 45, 13, 10],
  ];
  for (const [x, y, rx, ry] of clumps) c.ellipse(x, y, rx, ry, P.leaf, P.leafDark, P.leafLight);
  texture(c, rnd, [[P.leafDark, P.leafDeep], [P.leafLight, P.leafGlow], [P.leaf, P.leafLight]], 0.12);
  // Shadow cast by the canopy onto the trunk.
  for (let x = 28; x < 37; x++) if (c.get(x, 55) === P.bark || c.get(x, 55) === P.barkLight) c.set(x, 55, P.barkDark);
  c.outline();
  return c;
}

function pine(seed: number): PixelCanvas {
  const W = 52;
  const H = 96;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  const cx = 26;

  c.shadedRect(23, 70, 7, 22, P.bark, P.barkDark, P.barkLight);
  c.rect(21, 89, 11, 3, P.barkDark);

  // Four tiers, widest at the bottom, each with a ragged lower edge.
  const tiers: Array<[number, number, number]> = [
    [4, 28, 9],
    [16, 46, 15],
    [32, 64, 20],
    [48, 80, 24],
  ];
  for (const [top, bottom, half] of tiers) {
    for (let y = top; y <= bottom; y++) {
      const t = (y - top) / (bottom - top);
      const w = Math.max(1, Math.round(half * t + 1));
      for (let x = cx - w; x <= cx + w; x++) {
        const rel = (x - cx) / w;
        let col: number = P.pine;
        if (rel > 0.25) col = P.pineDark;
        else if (rel < -0.55 && t > 0.2) col = P.pineLight;
        c.set(x, y, col);
      }
    }
    for (let x = cx - half; x <= cx + half; x += 2) {
      const drop = 1 + Math.floor(rnd() * 3);
      for (let d = 1; d <= drop; d++) c.set(x, bottom + d, x > cx + 4 ? P.pineDark : P.pine);
    }
  }
  texture(c, rnd, [[P.pine, P.pineLight], [P.pineDark, P.pineDark]], 0.1);
  c.set(cx, 2, P.pine);
  c.set(cx, 3, P.pine);
  c.outline();
  return c;
}

function rock(seed: number): PixelCanvas {
  const c = new PixelCanvas(44, 34);
  const rnd = seededRandom(seed);
  const big = seed % 2 === 0;
  c.ellipse(22, 20, big ? 17 : 14, big ? 12 : 10, P.stone, P.stoneDark, P.stoneLight);
  c.ellipse(big ? 33 : 10, 25, 7, 5, P.stone, P.stoneDark, P.stoneLight);
  // Crack and moss cap.
  for (let i = 0; i < 6; i++) c.set(20 + i, 14 + Math.floor(i / 2), P.stoneDark);
  for (let x = 12; x < 30; x++) {
    for (let y = 8; y < 14; y++) if (c.get(x, y) !== null && rnd() < 0.45) c.set(x, y, rnd() < 0.5 ? P.moss : P.leafLight);
  }
  texture(c, rnd, [[P.stone, P.stoneLight]], 0.06);
  c.outline();
  return c;
}

function flowers(seed: number, petal: number): PixelCanvas {
  const c = new PixelCanvas(14, 10);
  const rnd = seededRandom(seed);
  for (let i = 0; i < 4; i++) {
    const x = 2 + Math.floor(rnd() * 10);
    const y = 3 + Math.floor(rnd() * 5);
    c.set(x, y + 1, P.grassDark);
    c.set(x, y, petal);
    c.set(x - 1, y, petal);
    c.set(x + 1, y, petal);
    c.set(x, y - 1, petal);
    c.set(x, y, P.flowerYellow === petal ? P.flowerWhite : P.flowerYellow);
  }
  return c;
}

function tuft(seed: number): PixelCanvas {
  const c = new PixelCanvas(12, 9);
  const rnd = seededRandom(seed);
  for (let i = 0; i < 6; i++) {
    const x = 2 + i + Math.floor(rnd() * 2);
    const h = 3 + Math.floor(rnd() * 5);
    for (let y = 0; y < h; y++) c.set(x + (y > h - 2 ? (i % 2 ? 1 : -1) : 0), 8 - y, y > h - 3 ? P.grassTip : P.leafDark);
  }
  return c;
}

function mushrooms(): PixelCanvas {
  const c = new PixelCanvas(14, 12);
  const one = (x: number, y: number, r: number) => {
    c.rect(x - 1, y, 2, 3, P.linen);
    c.ellipse(x, y, r, r * 0.6, P.mushroom, 0x8a2a28);
    c.set(x - 1, y - 1, P.flowerWhite);
  };
  one(5, 6, 3.2);
  one(10, 8, 2.2);
  c.outline();
  return c;
}

function pebbles(): PixelCanvas {
  const c = new PixelCanvas(12, 7);
  c.ellipse(4, 4, 2.5, 1.6, P.stoneLight, P.stone);
  c.ellipse(8, 3, 1.8, 1.2, P.stone, P.stoneDark);
  c.outline(P.stoneDark);
  return c;
}

/** Soft oval shadows for characters and trees. */
function shadow(w: number, h: number): PixelCanvas {
  const c = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2);
      const ny = (y + 0.5 - h / 2) / (h / 2);
      const d = nx * nx + ny * ny;
      if (d <= 1) c.set(x, y, 0x0b0812, d < 0.55 ? 110 : 70);
    }
  }
  return c;
}

export function generateProps(scene: Phaser.Scene): void {
  TREE_ART.length = 0;
  ROCK_ART.length = 0;
  DECOR_KEYS.length = 0;

  // 'prop-tree' / 'prop-rock' stay as the first variants so old code still finds them.
  register(TREE_ART, scene, 'prop-tree', oak(11), 86);
  register(TREE_ART, scene, 'prop-tree-1', oak(23), 86);
  register(TREE_ART, scene, 'prop-pine', pine(5), 91);
  register(TREE_ART, scene, 'prop-pine-1', pine(9), 91);
  register(ROCK_ART, scene, 'prop-rock', rock(2), 30);
  register(ROCK_ART, scene, 'prop-rock-1', rock(3), 30);

  // [key, art, weight]: higher weight shows up more often.
  const decor: Array<[string, PixelCanvas, number]> = [
    ['decor-tuft', tuft(4), 4],
    ['decor-tuft-1', tuft(12), 4],
    ['decor-flowers-red', flowers(3, P.flowerRed), 2],
    ['decor-flowers-yellow', flowers(5, P.flowerYellow), 2],
    ['decor-flowers-blue', flowers(8, P.flowerBlue), 2],
    ['decor-pebbles', pebbles(), 2],
    ['decor-mushrooms', mushrooms(), 1],
  ];
  for (const [key, art, weight] of decor) {
    art.toTexture(scene, key);
    for (let i = 0; i < weight; i++) DECOR_KEYS.push(key);
  }

  shadow(28, 10).toTexture(scene, 'shadow');
  shadow(52, 18).toTexture(scene, 'shadow-large');
}
