import { describe, expect, it, vi } from 'vitest';
import { FEET_Y, FRAME_H, FRAME_W, HERO_SCALE } from '../../src/art/character';
import { DIRECTIONS_8, renderFrame } from '../../src/art/figure3d';
import { GEAR_LOOKS } from '../../src/art/gear';
import { HERO_SPEC, heroModel } from '../../src/art/hero3d';
import type { PixelCanvas } from '../../src/art/PixelCanvas';

// The art files import Phaser for registering textures, which needs a browser; only the models are used here.
vi.mock('phaser', () => ({ default: {} }));

function pixels(c: PixelCanvas): number {
  let n = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.get(x, y) !== null) n++;
  return n;
}

/** The lowest row with anything drawn in it. */
function lowest(c: PixelCanvas): number {
  for (let y = c.height - 1; y >= 0; y--) for (let x = 0; x < c.width; x++) if (c.get(x, y) !== null) return y;
  return -1;
}

describe('the hero', () => {
  it('is drawn HERO_SCALE times finer than the folk, standing on the same spot', () => {
    expect(HERO_SPEC.w).toBe(FRAME_W * HERO_SCALE);
    expect(HERO_SPEC.h).toBe(FRAME_H * HERO_SCALE);
    // The sprite's origin is the same fraction of the frame as the folk's.
    expect((HERO_SPEC.feetY + 0.5) / HERO_SPEC.h).toBeCloseTo((FEET_Y + 0.5) / FRAME_H, 6);
    const frame = renderFrame(heroModel({ stride: 0, bob: 0 }), 0, HERO_SPEC);
    // Feet on the ground row, give or take the soles' curve.
    expect(Math.abs(lowest(frame) - HERO_SPEC.feetY)).toBeLessThanOrEqual(HERO_SCALE);
  });

  it('fills his finer frame in every direction, in every piece of gear', () => {
    for (const [id, look] of Object.entries(GEAR_LOOKS)) {
      for (const d of DIRECTIONS_8) {
        const frame = renderFrame(heroModel({ stride: 1, bob: 0.8, flutter: 1 }, [look!]), d.angle, HERO_SPEC);
        expect(pixels(frame), `${id} facing ${d.name}`).toBeGreaterThan(150 * HERO_SCALE * HERO_SCALE);
      }
    }
  });
});
