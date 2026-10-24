import Phaser from 'phaser';
import { TILE_HEIGHT, TILE_WIDTH } from '../config';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';

/**
 * Little things that bring the world to life (see world/Ambience.ts): glints
 * moving on the water, foam lapping the shore, ripples, birds, bats,
 * butterflies and chimney smoke.
 */

export const SHIMMER_FRAMES = 8;

/** Is pixel (x, y) inside a tile's diamond? (Same rows as art/tiles.ts.) */
function inDiamond(x: number, y: number): boolean {
  const hw = TILE_WIDTH / 2;
  const row = y < TILE_HEIGHT / 2 ? y : TILE_HEIGHT - 1 - y;
  const half = 2 * (row + 1);
  return x >= hw - half && x < hw + half;
}

/** Grid-space position (u, v in 0..1) of a pixel in a tile. */
function uv(x: number, y: number): { u: number; v: number } {
  const sx = (x + 0.5 - TILE_WIDTH / 2) / (TILE_WIDTH / 2);
  const sy = (y + 0.5 - TILE_HEIGHT / 2) / (TILE_HEIGHT / 2);
  return { u: (sx + sy) / 2 + 0.5, v: (sy - sx) / 2 + 0.5 };
}

/**
 * Light glinting on the water: short streaks that brighten, stretch and fade
 * at their own pace, drifting slowly across the tile. One frame per row.
 */
function shimmer(): PixelCanvas {
  const c = new PixelCanvas(TILE_WIDTH, TILE_HEIGHT * SHIMMER_FRAMES);
  const rnd = seededRandom(77);
  const glints = Array.from({ length: 4 }, () => ({
    x: rnd() * TILE_WIDTH,
    y: 3 + rnd() * (TILE_HEIGHT - 6),
    phase: rnd(),
    len: 3 + Math.floor(rnd() * 4),
  }));
  for (let f = 0; f < SHIMMER_FRAMES; f++) {
    const t = f / SHIMMER_FRAMES;
    for (const g of glints) {
      const life = Math.sin((t + g.phase) * Math.PI * 2);
      if (life < 0.1) continue;
      const len = Math.max(1, Math.round(g.len * life));
      const x0 = Math.round((g.x + t * 6) % TILE_WIDTH - len / 2);
      const y = Math.round(g.y) + f * TILE_HEIGHT;
      for (let i = 0; i < len; i++) {
        const x = x0 + i;
        if (!inDiamond(x, y - f * TILE_HEIGHT)) continue;
        c.set(x, y, life > 0.8 && i === Math.floor(len / 2) ? P.foam : P.waterLight, life > 0.5 ? 200 : 110);
      }
    }
  }
  return c;
}

/** Foam along the edges of a water tile that meet land. Bits: 1 = -y, 2 = +y, 4 = -x, 8 = +x. */
function foam(edges: number): PixelCanvas {
  const c = new PixelCanvas(TILE_WIDTH, TILE_HEIGHT);
  const rnd = seededRandom(edges * 13 + 5);
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      if (!inDiamond(x, y)) continue;
      const { u, v } = uv(x, y);
      const d = Math.min(
        edges & 1 ? v : 9,
        edges & 2 ? 1 - v : 9,
        edges & 4 ? u : 9,
        edges & 8 ? 1 - u : 9,
      );
      const wobble = 0.03 * Math.sin((u + v) * 19);
      if (d < 0.08 + wobble) c.set(x, y, rnd() < 0.2 ? P.waterLight : P.foam, 220);
      else if (d < 0.16 + wobble && rnd() < 0.35) c.set(x, y, P.foam, 140);
    }
  }
  return c;
}

/** Expanding rings where a fish rose. */
function ripple(): PixelCanvas {
  const W = 28;
  const H = 12;
  const frames = 5;
  const c = new PixelCanvas(W * frames, H);
  for (let f = 0; f < frames; f++) {
    const rings = [f + 2, f - 1].filter((r) => r > 0);
    for (const r of rings) {
      const rx = r * 2.6;
      const ry = r * 1.1;
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        c.set(f * W + W / 2 + Math.cos(a) * rx, H / 2 + Math.sin(a) * ry, r === f + 2 ? P.foam : P.waterLight, f > 3 ? 120 : 220);
      }
    }
  }
  return c;
}

/** A small bird seen from below/side: wings up, level, down. */
function flyer(body: number, wing: number, frames: number[][]): PixelCanvas {
  const W = 11;
  const H = 7;
  const c = new PixelCanvas(W * frames.length, H);
  frames.forEach((wingRows, f) => {
    const ox = f * W;
    c.rect(ox + 4, 3, 3, 2, body);
    c.set(ox + 7, 3, body); // head
    c.set(ox + 3, 4, body); // tail
    // Wing tips: one row offset per pixel out from the body.
    wingRows.forEach((dy, i) => {
      c.set(ox + 3 - i, 3 + dy, wing);
      c.set(ox + 7 + i, 3 + dy, wing);
    });
  });
  return c;
}

/** A sparrow on the ground: standing, pecking, and with wings up to take off. */
function sparrow(): PixelCanvas {
  const W = 9;
  const H = 8;
  const c = new PixelCanvas(W * 3, H);
  const brown = 0x8a5a36;
  const dark = 0x4a2e1e;
  const belly = 0xd8c0a0;
  for (let f = 0; f < 3; f++) {
    const ox = f * W;
    const peck = f === 1;
    c.rect(ox + 2, 3, 4, 3, brown); // body
    c.rect(ox + 3, 5, 3, 1, belly);
    c.set(ox + 1, 3, dark); // tail
    c.set(ox + 0, 2, dark);
    if (peck) {
      c.rect(ox + 6, 4, 2, 2, brown); // head down
      c.set(ox + 8, 5, P.gold);
    } else {
      c.rect(ox + 5, 1, 2, 2, brown); // head
      c.set(ox + 6, 1, P.eye);
      c.set(ox + 7, 2, P.gold);
    }
    if (f === 2) {
      c.set(ox + 3, 1, dark);
      c.set(ox + 2, 0, dark);
      c.set(ox + 4, 2, dark);
    } else {
      c.rect(ox + 3, 3, 2, 1, dark); // folded wing
    }
    c.set(ox + 3, 6, dark); // legs
    c.set(ox + 5, 6, dark);
  }
  c.outline();
  return c;
}

/** A butterfly: wings open, then folded. */
function butterfly(color: number): PixelCanvas {
  const c = new PixelCanvas(14, 5);
  c.rect(0, 0, 2, 2, color);
  c.rect(4, 0, 2, 2, color);
  c.set(1, 2, color);
  c.set(4, 2, color);
  c.rect(2, 0, 2, 4, P.ink);
  c.rect(9, 0, 2, 4, P.ink);
  c.rect(10, 0, 1, 3, color);
  return c;
}

/** A puff of smoke (pixel circle with a lighter top). */
function puff(r: number): PixelCanvas {
  const c = new PixelCanvas(r * 2 + 2, r * 2 + 2);
  c.ellipse(r + 1, r + 1, r, r, 0x9a96a0, 0x7a7680, 0xc4c0c8);
  return c;
}

/** The soft, dark blot of a passing cloud's shadow. Not pixel art: it should be blurry. */
function cloudShadow(scene: Phaser.Scene): void {
  if (scene.textures.exists('cloud-shadow')) scene.textures.remove('cloud-shadow');
  const W = 320;
  const H = 160;
  const tex = scene.textures.createCanvas('cloud-shadow', W, H)!;
  const ctx = tex.getContext();
  const rnd = seededRandom(9);
  for (let i = 0; i < 7; i++) {
    const x = 70 + rnd() * 180;
    const y = 50 + rnd() * 60;
    const r = 40 + rnd() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(20, 24, 50, 0.5)');
    g.addColorStop(1, 'rgba(20, 24, 50, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  tex.refresh();
}

/** Uploads a strip of equal frames side by side (or stacked) as one texture with numbered frames. */
function strip(scene: Phaser.Scene, key: string, c: PixelCanvas, frames: number, vertical = false): void {
  const tex = c.toTexture(scene, key);
  const w = vertical ? c.width : c.width / frames;
  const h = vertical ? c.height / frames : c.height;
  for (let i = 0; i < frames; i++) tex.add(i, 0, vertical ? 0 : i * w, vertical ? i * h : 0, w, h);
}

export function generateCritters(scene: Phaser.Scene): void {
  strip(scene, 'water-shimmer', shimmer(), SHIMMER_FRAMES, true);
  scene.anims.create({
    key: 'water-shimmer',
    frames: scene.anims.generateFrameNumbers('water-shimmer', { start: 0, end: SHIMMER_FRAMES - 1 }),
    frameRate: 5,
    repeat: -1,
  });
  for (let edges = 1; edges < 16; edges++) foam(edges).toTexture(scene, `water-foam-${edges}`);

  strip(scene, 'ripple', ripple(), 5);
  scene.anims.create({ key: 'ripple', frames: scene.anims.generateFrameNumbers('ripple', {}), frameRate: 6 });

  // Wing tip offsets per frame: up, level, down, level.
  strip(scene, 'bird', flyer(0x3a2e36, 0x3a2e36, [[-1, -2, -3], [0, -1, -1], [1, 2, 2]]), 3);
  scene.anims.create({ key: 'bird-fly', frames: scene.anims.generateFrameNumbers('bird', { frames: [0, 1, 2, 1] }), frameRate: 10, repeat: -1 });
  strip(scene, 'bat', flyer(0x241c26, 0x3b2e40, [[-2, -2, -1], [1, 1, 2]]), 2);
  scene.anims.create({ key: 'bat-fly', frames: scene.anims.generateFrameNumbers('bat', {}), frameRate: 14, repeat: -1 });

  strip(scene, 'sparrow', sparrow(), 3);
  [P.flowerYellow, P.flowerWhite, P.flowerBlue, 0xe08a3a].forEach((color, i) => {
    strip(scene, `butterfly-${i}`, butterfly(color), 2);
    scene.anims.create({ key: `butterfly-${i}`, frames: scene.anims.generateFrameNumbers(`butterfly-${i}`, {}), frameRate: 8, repeat: -1 });
  });

  [3, 4, 5].forEach((r, i) => puff(r).toTexture(scene, `smoke-${i}`));
  cloudShadow(scene);
}
