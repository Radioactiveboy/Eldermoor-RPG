import { describe, expect, it, vi } from 'vitest';
import { FEET_Y, FRAME_H } from '../../src/art/character';
import { FINE_FOLK } from '../../src/art/companions3d';
import { DIRECTIONS_8, renderFrame } from '../../src/art/figure3d';
import { FINE_SPEC } from '../../src/art/fine3d';
import { HERO_SPEC } from '../../src/art/hero3d';
import type { PixelCanvas } from '../../src/art/PixelCanvas';

// The art files import Phaser for registering textures, which needs a browser; only the models are used here.
vi.mock('phaser', () => ({ default: {} }));

function pixels(c: PixelCanvas): number {
  let n = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.get(x, y) !== null) n++;
  return n;
}

function lowest(c: PixelCanvas): number {
  for (let y = c.height - 1; y >= 0; y--) for (let x = 0; x < c.width; x++) if (c.get(x, y) !== null) return y;
  return -1;
}

describe('the finely drawn companions', () => {
  it('use the same fine frame as the hero, standing on the same spot as the folk', () => {
    expect(FINE_SPEC).toEqual(HERO_SPEC);
    expect((FINE_SPEC.feetY + 0.5) / FINE_SPEC.h).toBeCloseTo((FEET_Y + 0.5) / FRAME_H, 6);
  });

  it('fill their frame in every direction and pose, feet on the ground row', () => {
    const k = FINE_SPEC.scale!;
    for (const [id, build] of Object.entries(FINE_FOLK)) {
      for (const pose of [{ stride: 0, bob: 0 }, { stride: 1, bob: 0.8, flutter: 1 }, { stride: 0, bob: 3.5, sit: true }]) {
        for (const d of DIRECTIONS_8) {
          const frame = renderFrame(build(pose), d.angle, FINE_SPEC);
          expect(pixels(frame), `${id} facing ${d.name}`).toBeGreaterThan(150 * k * k);
          // Standing still, they reach down to the ground row (give or take the soles' curve; Wat's
          // spear butt rests on the ground a little ahead of him, so a little lower on screen).
          if (pose.stride === 0 && !pose.sit) expect(lowest(frame), `${id}'s feet facing ${d.name}`).toBeGreaterThanOrEqual(FINE_SPEC.feetY - k);
        }
      }
    }
  });
});
