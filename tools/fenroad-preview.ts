/**
 * A contact sheet of the Fen Road's art (src/art/fenroad.ts): every texture it draws, side by side.
 * Served by `npm run dev` at /tools/fenroad-preview.html.
 */
import type Phaser from 'phaser';

const params = new URLSearchParams(location.search);
const SCALE = Number(params.get('scale') ?? 2);
const only = params.get('only');

// A stand-in for Phaser's texture manager: each texture becomes a canvas on the page.
const made: Array<{ key: string; canvas: HTMLCanvasElement }> = [];
const textures = {
  exists: () => false,
  remove: () => undefined,
  createCanvas: (key: string, w: number, h: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    made.push({ key, canvas });
    return { context: canvas.getContext('2d')!, refresh: () => undefined, setFilter: () => undefined, add: () => undefined };
  },
};
const scene = { textures, anims: { create: () => undefined, exists: () => false } } as unknown as Phaser.Scene;

const art = await import(params.get('module') ?? '../src/art/fenroad');
const fn = Object.entries(art).find(([k]) => k.startsWith('generate'))![1] as (s: Phaser.Scene) => void;
fn(scene);
for (const { key, canvas } of made) {
  if (only && !key.startsWith(only)) continue;
  const div = document.createElement('div');
  div.className = 'item';
  const big = document.createElement('canvas');
  big.width = canvas.width * SCALE;
  big.height = canvas.height * SCALE;
  const ctx = big.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, big.width, big.height);
  div.append(big, key);
  document.getElementById('out')!.append(div);
}
document.body.dataset.done = '1';
