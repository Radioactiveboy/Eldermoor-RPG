import Phaser from 'phaser';
import { PixelCanvas, seededRandom } from './PixelCanvas';

/**
 * The weather's art (see world/Ambience.ts and systems/Weather.ts): sheets of
 * falling rain, splashes and rings where drops land, puddles, banks of mist,
 * the crows that come down on the ruined farm, a lamp's light broken up on
 * the water, and the firelight thrown on a room's walls.
 *
 * Small, so it's drawn the first time an area needs it rather than at boot.
 */

/** Size of a sheet of rain, which is tiled over the view. */
export const RAIN_SHEET = 128;

/**
 * A sheet of rain streaks, slanting a little with the wind, that tiles
 * seamlessly. `far` makes a finer, fainter one for drops further off.
 */
function rainSheet(seed: number, count: number, far: boolean): PixelCanvas {
  const S = RAIN_SHEET;
  const c = new PixelCanvas(S, S);
  const rnd = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    const x0 = Math.floor(rnd() * S);
    const y0 = Math.floor(rnd() * S);
    const len = far ? 4 + Math.floor(rnd() * 3) : 8 + Math.floor(rnd() * 6);
    for (let k = 0; k < len; k++) {
      // One pixel across for every four down: a slight slant, as if blown from the west.
      const x = (x0 + Math.floor(k / 4)) % S;
      const y = (y0 + k) % S;
      const fade = k / len;
      c.set(x, y, fade > 0.7 ? 0xeef4fa : 0xc4d4e4, Math.round((far ? 120 : 210) * (0.45 + fade * 0.55)));
    }
  }
  return c;
}

/** A drop landing on the ground: a little crown of spray, three frames. */
function splash(): PixelCanvas {
  const W = 7;
  const H = 5;
  const c = new PixelCanvas(W * 3, H);
  const col = 0xd4e0ec;
  // Frame 0: the drop hits.
  c.set(3, 4, col, 220);
  c.set(2, 4, col, 140);
  c.set(4, 4, col, 140);
  // Frame 1: spray thrown up and out.
  c.set(W + 1, 3, col, 200);
  c.set(W + 5, 3, col, 200);
  c.set(W + 2, 2, col, 160);
  c.set(W + 4, 2, col, 160);
  c.set(W + 3, 4, col, 120);
  // Frame 2: falling back, fading.
  c.set(2 * W + 0, 4, col, 110);
  c.set(2 * W + 6, 4, col, 110);
  c.set(2 * W + 1, 3, col, 90);
  c.set(2 * W + 5, 3, col, 90);
  return c;
}

/** A ring spreading where a drop lands on water: four frames. */
function rainRing(): PixelCanvas {
  const W = 11;
  const H = 5;
  const frames = 4;
  const c = new PixelCanvas(W * frames, H);
  for (let f = 0; f < frames; f++) {
    const rx = 1 + f * 1.4;
    const ry = 0.6 + f * 0.5;
    for (let a = 0; a < Math.PI * 2; a += 0.12) {
      c.set(f * W + 5 + Math.cos(a) * rx, 2 + Math.sin(a) * ry, 0xc8dae8, 210 - f * 45);
    }
  }
  return c;
}

/** A puddle lying in a rut or a dip: a flat, uneven pool with the grey sky in it. */
function puddle(seed: number): PixelCanvas {
  const W = 22;
  const H = 9;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  const blobs = Array.from({ length: 3 }, () => ({ x: 6 + rnd() * 10, y: 3.5 + rnd() * 2, rx: 4 + rnd() * 4, ry: 1.8 + rnd() * 1.2 }));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inside = blobs.some((b) => ((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2 <= 1);
      if (!inside) continue;
      const edge = !blobs.some((b) => ((x - b.x) / (b.rx - 1)) ** 2 + ((y - b.y) / (b.ry - 0.8)) ** 2 <= 1);
      // Dark water with the grey sky in it: lighter towards the far (upper) side, where it catches the light.
      const sky = y < 4 ? 0x6e8296 : 0x55687a;
      c.set(x, y, edge ? 0x3a4652 : sky, edge ? 170 : 200);
    }
  }
  // The sky's sheen across it.
  const b = blobs[0];
  for (let i = -2; i <= 2; i++) c.set(Math.round(b.x + i), Math.round(b.y - b.ry * 0.3), 0xb8c8d8, Math.abs(i) === 2 ? 130 : 210);
  return c;
}

/** A crow on the ground: standing, pecking, and wings up to take off. */
function crow(): PixelCanvas {
  const W = 12;
  const H = 10;
  const c = new PixelCanvas(W * 3, H);
  const black = 0x26222c;
  const sheen = 0x3e3a52;
  const beak = 0x4a4650;
  for (let f = 0; f < 3; f++) {
    const ox = f * W;
    const peck = f === 1;
    c.rect(ox + 3, 4, 5, 4, black); // body
    c.rect(ox + 4, 4, 3, 1, sheen);
    c.set(ox + 2, 5, black); // tail
    c.set(ox + 1, 6, black);
    c.set(ox + 0, 6, black);
    if (peck) {
      c.rect(ox + 8, 6, 2, 2, black); // head down
      c.set(ox + 10, 7, beak);
      c.set(ox + 11, 8, beak);
    } else {
      c.rect(ox + 7, 2, 3, 2, black); // head
      c.set(ox + 8, 2, 0xb0a8a0);
      c.set(ox + 10, 3, beak);
      c.set(ox + 11, 3, beak);
    }
    if (f === 2) {
      // Wings up.
      c.set(ox + 4, 3, black);
      c.set(ox + 3, 2, black);
      c.set(ox + 2, 1, black);
      c.set(ox + 6, 3, black);
      c.set(ox + 6, 2, black);
      c.set(ox + 7, 1, black);
    }
    c.set(ox + 4, 8, black); // legs
    c.set(ox + 6, 8, black);
    c.set(ox + 4, 9, beak);
    c.set(ox + 6, 9, beak);
  }
  c.outline();
  return c;
}

/** A lamp's light on the water, broken up into wavering bars: three frames. */
function lampReflection(): PixelCanvas {
  const W = 9;
  const H = 28;
  const frames = 3;
  const c = new PixelCanvas(W * frames, H);
  const rnd = seededRandom(31);
  for (let f = 0; f < frames; f++) {
    for (let y = 0; y < H; y += 2) {
      const fall = 1 - y / H;
      // Each bar a little off-centre, and shorter further down.
      const half = Math.max(0, Math.round((1 + fall * 3) * (0.6 + rnd() * 0.6)));
      const shift = Math.round((rnd() - 0.5) * 2);
      for (let x = -half; x <= half; x++) {
        const col = Math.abs(x) <= half / 2 ? 0xffb85a : 0xc8682a;
        c.set(f * W + 4 + x + shift, y, col, Math.round(60 + fall * 170));
      }
    }
  }
  return c;
}

/** Uploads a strip of equal frames side by side as one texture with numbered frames. */
function strip(scene: Phaser.Scene, key: string, c: PixelCanvas, frames: number): void {
  const tex = c.toTexture(scene, key);
  const w = c.width / frames;
  for (let i = 0; i < frames; i++) tex.add(i, 0, i * w, 0, w, c.height);
}

/** A soft bank of mist. Not pixel art: it should be blurry. */
function mistBank(scene: Phaser.Scene): void {
  const W = 384;
  const H = 128;
  const tex = scene.textures.createCanvas('mist-bank', W, H)!;
  const ctx = tex.getContext();
  const rnd = seededRandom(5);
  for (let i = 0; i < 9; i++) {
    const x = 70 + rnd() * (W - 140);
    const y = 44 + rnd() * 40;
    const r = 40 + rnd() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(226, 232, 240, 0.55)');
    g.addColorStop(1, 'rgba(226, 232, 240, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  tex.refresh();
}

/** The warm light a fire throws on the wall behind it. Soft, not pixel art. */
function wallGlow(scene: Phaser.Scene): void {
  const W = 128;
  const H = 128;
  const tex = scene.textures.createCanvas('fire-wall-glow', W, H)!;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  g.addColorStop(0, 'rgba(255, 170, 90, 0.9)');
  g.addColorStop(0.5, 'rgba(220, 110, 50, 0.35)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  tex.refresh();
}

/** Draws the weather's art, once; later calls do nothing. */
export function generateWeatherArt(scene: Phaser.Scene): void {
  if (scene.textures.exists('rain-sheet')) return;
  rainSheet(11, 44, false).toTexture(scene, 'rain-sheet');
  rainSheet(23, 80, true).toTexture(scene, 'rain-sheet-far');
  strip(scene, 'rain-splash', splash(), 3);
  scene.anims.create({ key: 'rain-splash', frames: scene.anims.generateFrameNumbers('rain-splash', {}), frameRate: 16 });
  strip(scene, 'rain-ring', rainRing(), 4);
  scene.anims.create({ key: 'rain-ring', frames: scene.anims.generateFrameNumbers('rain-ring', {}), frameRate: 10 });
  for (let i = 0; i < 3; i++) puddle(40 + i * 7).toTexture(scene, `puddle-${i}`);
  strip(scene, 'crow', crow(), 3);
  strip(scene, 'lamp-reflection', lampReflection(), 3);
  scene.anims.create({ key: 'lamp-reflection', frames: scene.anims.generateFrameNumbers('lamp-reflection', {}), frameRate: 5, repeat: -1 });
  mistBank(scene);
  wallGlow(scene);
}
