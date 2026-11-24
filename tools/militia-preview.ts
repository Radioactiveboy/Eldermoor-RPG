/**
 * A contact sheet of Adowvale's militia (see src/art/militia3d.ts): each
 * standing in all eight directions, mid-stride and seated. Served by
 * `npm run dev` at /tools/militia-preview.html (`?only=<id>`, `?scale=<n>`).
 */
import { DIRECTIONS_8, Pose3D, renderFrame } from '../src/art/figure3d';
import { FINE_SPEC } from '../src/art/fine3d';
import { MILITIA_FOLK } from '../src/art/militia3d';
import type { PixelCanvas } from '../src/art/PixelCanvas';

const params = new URLSearchParams(location.search);
const SCALE = Number(params.get('scale') ?? 2);
const only = params.get('only');
const POSES: Pose3D[] = [
  { stride: 0, bob: 0 },
  { stride: 1, bob: 0.8, flutter: 1 },
  { stride: 0, bob: 3.5, sit: true },
];

function strip(title: string, frames: PixelCanvas[], scale: number): void {
  const w = frames[0].width;
  const h = frames[0].height;
  const canvas = document.createElement('canvas');
  canvas.width = frames.length * w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d')!;
  frames.forEach((f, i) => {
    f.outline();
    tctx.clearRect(0, 0, w, h);
    tctx.putImageData(f.toImageData(), 0, 0);
    ctx.drawImage(tmp, i * w * scale, 0, w * scale, h * scale);
  });
  const head = document.createElement('h2');
  head.textContent = title;
  document.getElementById('out')!.append(head, canvas);
}

const poses = params.get('still') !== null ? POSES.slice(0, 1) : POSES;
for (const [id, build] of Object.entries(MILITIA_FOLK)) {
  if (only && only !== id) continue;
  strip(id, poses.flatMap((p) => DIRECTIONS_8.map((d) => renderFrame(build(p), d.angle, FINE_SPEC))), SCALE);
}
