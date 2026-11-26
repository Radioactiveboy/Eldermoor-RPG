import { describe, expect, it, vi } from 'vitest';
import { allMaps, phaserMock } from './maps';

vi.mock('phaser', () => phaserMock());

/**
 * Places to sit that are not a seat of their own, so nothing is found under them and the sitter is drawn
 * whole: the bench by the cottage door is part of the cottage, and Wisp sits on her pallet.
 */
const NO_SEAT = new Set(['world:bench', 'sump-crowe:wisp-home']);

describe('seating', () => {
  it('finds a seat under every place the hero can sit, and under everyone placed sitting', async () => {
    const { seatAt } = await import('../../src/world/Seating');
    const missing: string[] = [];
    for (const [area, data] of Object.entries(await allMaps())) {
      const spots = [
        ...(data.seats ?? []).map((s) => ({ name: s.name, gx: s.gx, gy: s.gy })),
        ...(data.npcs ?? []).filter((n) => n.seated).map((n) => ({ name: n.id, gx: n.gx, gy: n.gy })),
      ];
      for (const s of spots) {
        if (!NO_SEAT.has(`${area}:${s.name}`) && !seatAt(data.objects, s.gx, s.gy)) missing.push(`${area}: ${s.name} at ${s.gx}, ${s.gy}`);
      }
    }
    // A seat is known by its key (see Seating.ts): a new kind of seat needs a word there, or its sitters' legs show through it.
    expect(missing).toEqual([]);
  });

  it('seats people in front of an open seat, cut off at its top when they face away, and behind a turned chair or a pew', async () => {
    const { seatedDraw } = await import('../../src/world/Seating');
    const stool = { key: 'furn-stool', tx: 3, ty: 4, w: 1, h: 1 };
    const turned = { key: 'res-chair-turned', tx: 3, ty: 4, w: 1, h: 1 };
    const pew = { key: 'abbey-pew', tx: 3, ty: 4, w: 2, h: 1 };
    const { depthAt } = await import('../../src/iso/IsoMath');
    const standing = depthAt(3.5, 4.5);
    for (const facing of [0, 1, 2, 6, 7]) expect(seatedDraw(stool, standing, facing)).toMatchObject({ cut: false });
    for (const facing of [3, 4, 5]) expect(seatedDraw(stool, standing, facing)).toMatchObject({ cut: true });
    expect(seatedDraw(stool, standing, 4).depth).toBeGreaterThan(standing);
    expect(seatedDraw(stool, standing, 4).shadow).toBeLessThan(standing);
    expect(seatedDraw(turned, standing, 4)).toMatchObject({ cut: false });
    expect(seatedDraw(turned, standing, 4).depth).toBeLessThan(standing);
    expect(seatedDraw(pew, depthAt(4, 4.45), 4).depth).toBeLessThan(depthAt(4, 4.5));
    expect(seatedDraw(undefined, standing, 4)).toEqual({ depth: standing + 2, shadow: standing + 1.5, cut: false });
  });
});
