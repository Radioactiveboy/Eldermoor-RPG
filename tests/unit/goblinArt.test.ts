import { describe, expect, it, vi } from 'vitest';
import { BEAST_FRAME } from '../../src/art/beasts3d';
import { CREATURE_ART } from '../../src/art/creatures';
import { DIRECTIONS_8, renderFrame } from '../../src/art/figure3d';
import { GOBLIN_ANIMS, GOBLIN_COLS, GOBLIN_FRAME, GOBLIN_RES, goblinSheet, goblinShownSpec, type GoblinKind } from '../../src/art/goblins3d';
import type { PixelCanvas } from '../../src/art/PixelCanvas';

// The art files import Phaser for registering textures, which needs a browser; only the models are used here.
vi.mock('phaser', () => ({ default: {} }));

const KINDS: GoblinKind[] = ['goblin', 'goblinspear', 'goblintorch', 'goblinbrute'];

function pixels(c: PixelCanvas): number {
  let n = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.get(x, y) !== null) n++;
  return n;
}

function lowest(c: PixelCanvas): number {
  for (let y = c.height - 1; y >= 0; y--) for (let x = 0; x < c.width; x++) if (c.get(x, y) !== null) return y;
  return -1;
}

describe('the goblins drawn finely', () => {
  it('are drawn GOBLIN_RES times finer than shown, with the feet on the same spot', () => {
    for (const kind of KINDS) {
      const { spec } = goblinSheet(kind);
      const shown = goblinShownSpec(kind);
      expect(spec.scale).toBe(GOBLIN_RES);
      expect(spec.w).toBe(shown.w * GOBLIN_RES);
      expect((spec.feetY + 0.5) / spec.h).toBeCloseTo((shown.feetY + 0.5) / shown.h, 6);
      // The creatures' table is in shown sizes, with the resolution and the longer rows alongside.
      expect(CREATURE_ART[kind]).toMatchObject({ w: shown.w, h: shown.h, feetY: shown.feetY, res: GOBLIN_RES, cols: GOBLIN_COLS });
    }
  });

  it('keep the beasts’ first twelve frames in their places, and have a frame for every one GOBLIN_FRAME names', () => {
    expect(GOBLIN_FRAME.ready).toBe(BEAST_FRAME.snarl);
    expect(GOBLIN_FRAME.strike).toBe(BEAST_FRAME.bite);
    expect(GOBLIN_FRAME.hurt).toBe(BEAST_FRAME.hurt);
    expect(GOBLIN_FRAME.dead).toBe(BEAST_FRAME.dead);
    for (const kind of KINDS) expect(goblinSheet(kind).models).toHaveLength(GOBLIN_COLS);
    expect(Math.max(...Object.values(GOBLIN_FRAME))).toBe(GOBLIN_COLS - 1);
  });

  it('animate only frames the sheet has; the fights play once, the rest loop', () => {
    for (const [name, anim] of Object.entries(GOBLIN_ANIMS)) {
      expect(anim.frames.length, name).toBeGreaterThan(1);
      for (const { f, ms } of anim.frames) {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(GOBLIN_COLS);
        expect(ms).toBeGreaterThan(0);
      }
    }
    for (const name of ['attack', 'hit', 'die', 'taunt']) expect(GOBLIN_ANIMS[name].repeat, name).toBe(0);
    for (const name of ['idle', 'ready']) expect(GOBLIN_ANIMS[name].repeat, name).toBe(-1);
    // The death throes end lying down.
    expect(GOBLIN_ANIMS.die.frames.at(-1)!.f).toBe(GOBLIN_FRAME.dead);
    // The wind-up comes before the blow.
    expect(GOBLIN_ANIMS.attack.frames.map((x) => x.f).slice(0, 2)).toEqual([GOBLIN_FRAME.windup, GOBLIN_FRAME.strike]);
  });

  it('fill their frames in every direction, standing on the ground row', () => {
    for (const kind of KINDS) {
      const { spec, models } = goblinSheet(kind);
      const k = spec.scale!;
      for (const d of DIRECTIONS_8) {
        const standing = renderFrame(models[0], d.angle, spec);
        expect(pixels(standing), `${kind} facing ${d.name}`).toBeGreaterThan(200 * k * k);
        expect(lowest(standing), `${kind}'s feet facing ${d.name}`).toBeGreaterThanOrEqual(spec.feetY - 2 * k);
        expect(lowest(standing)).toBeLessThan(spec.h);
        for (const f of [GOBLIN_FRAME.windup, GOBLIN_FRAME.reel, GOBLIN_FRAME.slump, GOBLIN_FRAME.taunt]) {
          expect(pixels(renderFrame(models[f], d.angle, spec)), `${kind} frame ${f} facing ${d.name}`).toBeGreaterThan(180 * k * k);
        }
      }
    }
  });
});
