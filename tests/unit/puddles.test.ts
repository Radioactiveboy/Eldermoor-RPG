/**
 * Where the puddles lie (world/Puddles.ts): every puddle asks for a drawing
 * that exists and stays on its own tile, on every tile of a map far bigger
 * than any the game has.
 */
import { describe, expect, it } from 'vitest';
import { puddleAt, PUDDLE_KINDS } from '../../src/world/Puddles';

describe('puddles', () => {
  it('always use one of the puddle drawings, and lie on their own tile', () => {
    let count = 0;
    for (let ty = 0; ty < 400; ty++) {
      for (let tx = 0; tx < 400; tx++) {
        const p = puddleAt(tx, ty);
        if (!p) continue;
        count++;
        expect(Number.isInteger(p.kind) && p.kind >= 0 && p.kind < PUDDLE_KINDS, `kind ${p.kind} at ${tx},${ty}`).toBe(true);
        expect(Math.floor(p.x)).toBe(tx);
        expect(Math.floor(p.y)).toBe(ty);
      }
    }
    // About one tile in seven.
    expect(count).toBeGreaterThan(400 * 400 * 0.1);
  });

  it('are the same every visit', () => {
    expect(puddleAt(35, 22)).toEqual(puddleAt(35, 22));
  });
});
