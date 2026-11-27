import { describe, expect, it, vi } from 'vitest';
import { BEAST_FRAME } from '../../src/art/beasts3d';
import { CREATURE_ART } from '../../src/art/creatures';
import { DIRECTIONS_8, renderFrame } from '../../src/art/figure3d';
import { MERE_ANIMS, MERE_COLS, MERE_FRAME, MERE_LOOKS, MERE_RES, mereSheet, mereShownSpec, type MereKind } from '../../src/art/merekin3d';
import type { PixelCanvas } from '../../src/art/PixelCanvas';
import { faction, FOES, isArmed, isMereKin } from '../../src/systems/Combat';

// The art files import Phaser for registering textures, which needs a browser; only the models are used here.
vi.mock('phaser', () => ({ default: {} }));

const KINDS = Object.keys(MERE_LOOKS) as MereKind[];

function pixels(c: PixelCanvas): number {
  let n = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.get(x, y) !== null) n++;
  return n;
}

function lowest(c: PixelCanvas): number {
  for (let y = c.height - 1; y >= 0; y--) for (let x = 0; x < c.width; x++) if (c.get(x, y) !== null) return y;
  return -1;
}

/** Whether anything is drawn on the frame's outermost rows or columns (it would be cut off). */
function touchesEdge(c: PixelCanvas): boolean {
  for (let x = 0; x < c.width; x++) if (c.get(x, 0) !== null) return true;
  for (let y = 0; y < c.height; y++) if (c.get(0, y) !== null || c.get(c.width - 1, y) !== null) return true;
  return false;
}

describe('the Mere-kin', () => {
  it('are drawn MERE_RES times finer than shown, matching the creatures’ table, within a 4096-pixel texture', () => {
    for (const kind of KINDS) {
      const { spec } = mereSheet(kind);
      const shown = mereShownSpec(kind);
      expect(spec.scale).toBe(MERE_RES);
      expect(spec.w).toBe(shown.w * MERE_RES);
      expect((spec.feetY + 0.5) / spec.h).toBeCloseTo((shown.feetY + 0.5) / shown.h, 6);
      expect(CREATURE_ART[kind]).toMatchObject({ w: shown.w, h: shown.h, feetY: shown.feetY, res: MERE_RES, cols: MERE_COLS, eight: true });
      expect(spec.w * MERE_COLS).toBeLessThanOrEqual(4096);
    }
  });

  it('keep the beasts’ first twelve frames in their places, and have every frame MERE_FRAME names', () => {
    expect(MERE_FRAME.ready).toBe(BEAST_FRAME.snarl);
    expect(MERE_FRAME.strike).toBe(BEAST_FRAME.bite);
    expect(MERE_FRAME.hurt).toBe(BEAST_FRAME.hurt);
    expect(MERE_FRAME.dead).toBe(BEAST_FRAME.dead);
    for (const kind of KINDS) expect(mereSheet(kind).models).toHaveLength(MERE_COLS);
    expect(Math.max(...Object.values(MERE_FRAME))).toBe(MERE_COLS - 1);
  });

  it('animate only frames the sheet has; the fights play once and the rest loop', () => {
    for (const [name, anim] of Object.entries(MERE_ANIMS)) {
      for (const { f, ms } of anim.frames) {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(MERE_COLS);
        expect(ms).toBeGreaterThan(0);
      }
      expect(anim.repeat, name).toBe(['attack', 'hit', 'die', 'taunt'].includes(name) ? 0 : -1);
    }
    expect(MERE_ANIMS.die.frames.at(-1)!.f).toBe(MERE_FRAME.dead);
    // Coiled, then the wind-up, then the blow.
    expect(MERE_ANIMS.attack.frames.map((x) => x.f).slice(0, 3)).toEqual([MERE_FRAME.coil, MERE_FRAME.windup, MERE_FRAME.strike]);
  });

  // One test for each kind, each with room to draw its frames on a slow machine.
  it.each(KINDS)('%s stands on the ground row and fits its frames in every direction, weapons, tail and all', (kind) => {
    {
      const { spec, models } = mereSheet(kind);
      const k = spec.scale!;
      for (const d of DIRECTIONS_8) {
        const standing = renderFrame(models[0], d.angle, spec);
        expect(pixels(standing), `${kind} facing ${d.name}`).toBeGreaterThan(260 * k * k);
        expect(lowest(standing), `${kind}'s feet facing ${d.name}`).toBeGreaterThanOrEqual(spec.feetY - 2 * k);
        for (const f of [0, 2, MERE_FRAME.windup, MERE_FRAME.strike, MERE_FRAME.follow, MERE_FRAME.reel, MERE_FRAME.taunt, MERE_FRAME.hiss, MERE_FRAME.dead, MERE_FRAME.twitch]) {
          const frame = renderFrame(models[f], d.angle, spec);
          expect(pixels(frame), `${kind} frame ${f} facing ${d.name}`).toBeGreaterThan(160 * k * k);
          expect(touchesEdge(frame), `${kind} frame ${f} facing ${d.name} runs off its frame`).toBe(false);
        }
      }
    }
  }, 30000);

  it('fight with weapons, as one band, beside nobody else', () => {
    for (const kind of KINDS) {
      expect(isMereKin(kind)).toBe(true);
      expect(isArmed(kind)).toBe(true);
      expect(faction(kind)).toBe('merekin');
      expect(FOES[kind].packs).toBe(true);
    }
    expect(faction('wolf')).toBe('beast');
    expect(faction('hookgaff')).toBe('outlaw');
  });
});
