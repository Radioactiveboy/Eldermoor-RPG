/**
 * A contact sheet of the brigands in the beacon tower (see src/art/brigands3d.ts):
 * each standing in all eight directions, mid-stride and seated, then every frame
 * of their fighting sheet. Served by `npm run dev` at /tools/brigand-preview.html.
 */
import { BRIGAND_FOLK, BRIGAND_LOOKS, BrigandKind, brigandFolkModel, brigandSheet } from '../src/art/brigands3d';
import { DIRECTIONS_8, Pose3D, renderFrame } from '../src/art/figure3d';
import { FINE_SPEC } from '../src/art/fine3d';
import type { PixelCanvas } from '../src/art/PixelCanvas';

const SCALE = Number(new URLSearchParams(location.search).get('scale') ?? 2);
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

const only = new URLSearchParams(location.search).get('only');
for (const [id, look] of Object.entries(BRIGAND_FOLK)) {
  if (only && only !== id) continue;
  const build = brigandFolkModel(look);
  strip(`${id}: standing, walking, seated`, POSES.flatMap((p) => DIRECTIONS_8.map((d) => renderFrame(build(p), d.angle, FINE_SPEC))), SCALE);
}
const dir = Number(new URLSearchParams(location.search).get('angle') ?? 45);
for (const kind of Object.keys(BRIGAND_LOOKS) as BrigandKind[]) {
  if (only && BRIGAND_FOLK[only] !== BRIGAND_LOOKS[kind]) continue;
  const sheet = brigandSheet(kind);
  strip(`${kind}: the fighting sheet`, sheet.models.map((m) => renderFrame(m, dir, sheet.spec)), SCALE / 2);
}
