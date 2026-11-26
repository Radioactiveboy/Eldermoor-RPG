import { describe, expect, it, vi } from 'vitest';
import { sigrunModel, watModel } from '../../src/art/companions3d';
import { bendUpper, FIGHT_ANIMS, FIGHT_COLS, FIGHT_FRAME, FIGHT_ORIGIN_Y, FIGHT_POSES, fightLegs, placeUpper, STANCES } from '../../src/art/fight3d';
import { DIRECTIONS_8, renderFrame } from '../../src/art/figure3d';
import { dressed, GEAR_LOOKS } from '../../src/art/gear';
import { HERO_FIGHT_SPEC, HERO_SPEC, heroModel } from '../../src/art/hero3d';
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

/** Nothing drawn on the frame's outermost rows and columns: the swing fits. */
function inside(c: PixelCanvas): boolean {
  for (let i = 0; i < c.width; i++) if (c.get(i, 0) !== null) return false;
  for (let y = 0; y < c.height; y++) if (c.get(0, y) !== null || c.get(c.width - 1, y) !== null) return false;
  return true;
}

const FIGHTERS = {
  'hero (sword and buckler)': (p: Parameters<typeof heroModel>[0]) => heroModel(p, dressed({ mainHand: 'short-sword', offHand: 'buckler', feet: 'riding-boots', body: 'jerkin' })),
  'hero (spear)': (p: Parameters<typeof heroModel>[0]) => heroModel(p, dressed({ mainHand: 'spear', feet: 'boots' })),
  'hero (empty-handed)': (p: Parameters<typeof heroModel>[0]) => heroModel(p),
  sigrun: sigrunModel,
  wat: watModel,
};

describe('fighting stances', () => {
  it('have a frame for every act, and animate only frames the sheet has', () => {
    expect(FIGHT_POSES).toHaveLength(FIGHT_COLS);
    expect(Object.values(FIGHT_FRAME).sort((a, b) => a - b)).toEqual([...Array(FIGHT_COLS).keys()]);
    for (const [name, anim] of Object.entries(FIGHT_ANIMS)) {
      for (const { f, ms } of anim.frames) {
        expect(f, name).toBeLessThan(FIGHT_COLS);
        expect(ms).toBeGreaterThan(0);
      }
    }
    expect(FIGHT_ANIMS.ready.repeat).toBe(-1);
    for (const name of ['attack', 'hit', 'guard', 'down']) expect(FIGHT_ANIMS[name].repeat, name).toBe(0);
    expect(FIGHT_ANIMS.attack.frames.map((x) => x.f)).toEqual([FIGHT_FRAME.windup, FIGHT_FRAME.strike, FIGHT_FRAME.follow]);
    expect(FIGHT_ANIMS.down.frames.at(-1)!.f).toBe(FIGHT_FRAME.kneel);
  });

  it('keep the feet on the ground and the knees joined up', () => {
    for (const pose of FIGHT_POSES) {
      for (const l of fightLegs(pose.fight!)) {
        expect(l.hip[1]).toBeCloseTo(12.5 - STANCES[pose.fight!].drop, 6);
        // Thigh and shin about as long as they are standing.
        expect(Math.hypot(l.knee[0] - l.hip[0], l.knee[1] - l.hip[1], l.knee[2] - l.hip[2])).toBeLessThan(5.6);
        expect(l.foot[1]).toBeLessThan(1.6);
        for (const y of [0, 4, 8, 8.4, 12, 20]) expect(Math.abs(l.at(y)[2]), `${pose.fight} at ${y}`).toBeLessThan(8);
      }
    }
  });

  it('turn the upper body without changing a solid\'s shape or paint', () => {
    const paint = vi.fn(() => [0xffffff, 0x888888, 0xffffff] as [number, number, number]);
    const model = { solids: [{ cx: 0, cy: 20, cz: 0, rx: 1, ry: 2, rz: 3, material: paint }], details: [] };
    const bent = bendUpper(model, 0, 'strike');
    const s = bent.solids[0];
    expect([s.rx, s.ry, s.rz]).toEqual([1, 2, 3]);
    expect([s.cx, s.cy, s.cz]).toEqual(placeUpper([0, 20, 0], 'strike'));
    // Leant forward into the blow.
    expect(s.cz).toBeGreaterThan(1);
    // Painted as it was before it moved.
    (s.material as (h: unknown) => unknown)({ x: s.cx, y: s.cy, z: s.cz, nx: 0, ny: 1, nz: 0 });
    const [hit] = paint.mock.calls[0] as unknown as [{ x: number; y: number; z: number }];
    expect(hit.x).toBeCloseTo(0, 6);
    expect(hit.y).toBeCloseTo(20, 6);
    expect(hit.z).toBeCloseTo(0, 6);
  });

  it('fit every swing in the fight frame from every side, the feet on the ground row', () => {
    const k = HERO_FIGHT_SPEC.scale!;
    expect(HERO_FIGHT_SPEC.scale).toBe(HERO_SPEC.scale);
    expect((HERO_FIGHT_SPEC.feetY + 0.5) / HERO_FIGHT_SPEC.h).toBeCloseTo(FIGHT_ORIGIN_Y, 6);
    for (const [who, build] of Object.entries(FIGHTERS)) {
      for (const pose of FIGHT_POSES) {
        for (const d of DIRECTIONS_8) {
          const frame = renderFrame(build(pose), d.angle, HERO_FIGHT_SPEC);
          const what = `${who} ${pose.fight} facing ${d.name}`;
          expect(pixels(frame), what).toBeGreaterThan(140 * k * k);
          expect(inside(frame), what).toBe(true);
          expect(lowest(frame), what).toBeGreaterThanOrEqual(HERO_FIGHT_SPEC.feetY - 2 * k);
          // (A foot planted ahead or a shin laid back along the ground reaches a little nearer the viewer, so lower down the frame.)
          expect(lowest(frame), what).toBeLessThanOrEqual(HERO_FIGHT_SPEC.feetY + 3 * k);
        }
      }
    }
    // (It renders every fighter in every pose from eight sides: about 3s here, and past vitest's 5s default on a busy CI runner.)
  }, 20_000);

  it('can be drawn in every piece of gear', () => {
    for (const [id, look] of Object.entries(GEAR_LOOKS)) {
      for (const pose of FIGHT_POSES) expect(pixels(renderFrame(heroModel(pose, [look!]), 90, HERO_FIGHT_SPEC)), `${id} ${pose.fight}`).toBeGreaterThan(500);
    }
  }, 20_000);
});
