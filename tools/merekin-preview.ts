/**
 * A contact sheet of the Mere-kin (see src/art/merekin3d.ts): each standing in
 * all eight directions, then every frame of its fighting sheet. Served by
 * `npm run dev` at /tools/merekin-preview.html (?only=<kind>, ?angle=<degrees>, ?scale=<n>).
 */
import { DIRECTIONS_8, renderFrame } from '../src/art/figure3d';
import { MERE_LOOKS, MereKind, mereSheet } from '../src/art/merekin3d';
import type { PixelCanvas } from '../src/art/PixelCanvas';

const params = new URLSearchParams(location.search);
const SCALE = Number(params.get('scale') ?? 2);
const only = params.get('only');
const dir = Number(params.get('angle') ?? 45);
const frames = params.get('frames');

function strip(title: string, list: PixelCanvas[], scale: number): void {
  const w = list[0].width;
  const h = list[0].height;
  const canvas = document.createElement('canvas');
  canvas.width = list.length * w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d')!;
  list.forEach((f, i) => {
    f.outline();
    tctx.clearRect(0, 0, w, h);
    tctx.putImageData(f.toImageData(), 0, 0);
    ctx.drawImage(tmp, i * w * scale, 0, w * scale, h * scale);
  });
  const head = document.createElement('h2');
  head.textContent = title;
  document.getElementById('out')!.append(head, canvas);
}

for (const kind of Object.keys(MERE_LOOKS) as MereKind[]) {
  if (only && only !== kind) continue;
  const sheet = mereSheet(kind);
  strip(`${kind}: standing, in eight directions`, DIRECTIONS_8.map((d) => renderFrame(sheet.models[0], d.angle, sheet.spec)), SCALE / 2);
  const pick = frames ? frames.split(',').map(Number) : sheet.models.map((_, i) => i);
  strip(`${kind}: the fighting sheet`, pick.map((i) => renderFrame(sheet.models[i], dir, sheet.spec)), SCALE / 2);
}
document.body.dataset.done = '1';
