/**
 * A contact sheet of the hero in every piece of gear (see src/art/gear.ts):
 * each item worn on its own, over the clothes he starts in, in all eight
 * directions, standing, mid-stride and seated. For checking new gear looks
 * without playing to them. Served by `npm run dev` at /tools/gear-preview.html.
 */
import { renderFrame, DIRECTIONS_8, Pose3D } from '../src/art/figure3d';
import { dressed, GEAR_LOOKS } from '../src/art/gear';
import { HERO_SPEC, heroModel } from '../src/art/hero3d';
import type { EquipSlot, ItemId } from '../src/systems/Inventory';
import { ITEMS } from '../src/systems/Inventory';

/** The hero's frames are drawn HERO_SCALE times finer already (see character.ts). */
const SCALE = 2;
const POSES: Pose3D[] = [
  { stride: 0, bob: 0 },
  { stride: 1, bob: 0.8, flutter: 1 },
  { stride: 0, bob: 3.5, sit: true },
];
/** What he wears at the start of the game, under whatever's being shown. */
const BASE: Partial<Record<EquipSlot, ItemId>> = { body: 'tunic', feet: 'boots' };

function sheet(title: string, equipped: Partial<Record<EquipSlot, ItemId>>): void {
  const gear = dressed(equipped);
  const first = renderFrame(heroModel(POSES[0], gear), 0, HERO_SPEC);
  const w = first.width;
  const h = first.height;
  const canvas = document.createElement('canvas');
  canvas.width = DIRECTIONS_8.length * POSES.length * w * SCALE;
  canvas.height = h * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d')!;
  let col = 0;
  for (const pose of POSES) {
    for (const d of DIRECTIONS_8) {
      tctx.clearRect(0, 0, w, h);
      tctx.putImageData(renderFrame(heroModel(pose, gear), d.angle, HERO_SPEC).toImageData(), 0, 0);
      ctx.drawImage(tmp, col * w * SCALE, 0, w * SCALE, h * SCALE);
      col++;
    }
  }
  const head = document.createElement('h2');
  head.textContent = title;
  document.getElementById('out')!.append(head, canvas);
}

const only = new URLSearchParams(location.search).get('only');
if (only) {
  const equipped: Partial<Record<EquipSlot, ItemId>> = { ...BASE };
  for (const id of only.split(',') as ItemId[]) if (ITEMS[id]?.slot) equipped[ITEMS[id].slot!] = id;
  sheet(only, equipped);
} else {
  sheet('Nothing at all', {});
  sheet('As he starts (tunic and boots)', BASE);
  for (const id of Object.keys(GEAR_LOOKS) as ItemId[]) {
    const slot = ITEMS[id].slot!;
    sheet(ITEMS[id].name, { ...BASE, [slot]: id });
  }
}
document.body.dataset.ready = '1';
