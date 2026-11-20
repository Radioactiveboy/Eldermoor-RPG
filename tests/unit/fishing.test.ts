import { describe, expect, it } from 'vitest';
import { RECIPES } from '../../src/systems/Crafting';
import {
  biteDelay, catchTable, FISH, FishKind, fishAt, hourBand, MARKER_SPEED, markerAt, onFish, rollFish, waterNear, WaterId, WATERS,
} from '../../src/systems/Fishing';
import { ITEMS } from '../../src/systems/Inventory';

describe('what bites where, and when', () => {
  it('splits the day into dawn, day, dusk and night', () => {
    expect([4, 5, 7, 8, 16, 17, 20, 21, 0].map(hourBand)).toEqual(['night', 'dawn', 'dawn', 'day', 'day', 'dusk', 'dusk', 'night', 'night']);
    expect(hourBand(29)).toBe('dawn');
  });

  it('brings eels out at night and keeps them in the mud by day', () => {
    const fish = (water: WaterId, hour: number) => catchTable(water, hour).map((e) => e.fish);
    expect(fish('lake', 12)).not.toContain('eel');
    expect(fish('lake', 23)).toContain('eel');
    expect(fish('willow-pool', 12)).toContain('trout');
    expect(fish('monastery-ponds', 12)).toContain('carp');
    expect(fish('mere', 6)).toContain('tench');
  });

  it('picks by weight', () => {
    const table = catchTable('lake', 12);
    expect(rollFish('lake', 12, () => 0)).toBe(table[0].fish);
    expect(rollFish('lake', 12, () => 0.99999)).toBe(table[table.length - 1].fish);
    // Over many casts the most likely fish turns up most.
    const counts = new Map<FishKind, number>();
    let s = 1;
    const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 4000; i++) {
      const f = rollFish('monastery-ponds', 12, rng);
      counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBe(counts.get('carp'));
  });

  it('only lands real items, and every fish but the boot can be cooked', () => {
    for (const water of Object.values(WATERS)) {
      for (const f of Object.keys(water.fish) as FishKind[]) {
        expect(FISH[f]).toBeDefined();
        expect(ITEMS[FISH[f].item]).toBeDefined();
        if (f !== 'boot') expect(RECIPES.some((r) => r.station === 'cooking' && r.needs.some(([id]) => id === FISH[f].item)), f).toBe(true);
      }
    }
  });

  it('bites sooner at dawn and dusk than in the heat of the day', () => {
    expect(biteDelay(6, () => 0)).toBeLessThan(biteDelay(12, () => 0));
    expect(biteDelay(12, () => 0.999)).toBeLessThan(10);
  });
});

describe('reeling in', () => {
  it('sweeps the marker along the bar and back', () => {
    expect(markerAt(0)).toBe(0);
    expect(markerAt(1 / MARKER_SPEED)).toBeCloseTo(1);
    expect(markerAt(0.5 / MARKER_SPEED)).toBeCloseTo(0.5);
    expect(markerAt(2 / MARKER_SPEED)).toBeCloseTo(0);
  });

  it('keeps the fish on the bar', () => {
    for (const def of Object.values(FISH)) {
      for (let t = 0; t < 20; t += 0.1) {
        const x = fishAt(def, t, 1.3);
        expect(x).toBeGreaterThanOrEqual(def.zone / 2);
        expect(x).toBeLessThanOrEqual(1 - def.zone / 2);
      }
    }
  });

  it('counts a press only over the fish', () => {
    expect(onFish(0.5, 0.55, 0.2)).toBe(true);
    expect(onFish(0.3, 0.55, 0.2)).toBe(false);
  });

  it('makes a pike harder than a roach', () => {
    expect(FISH.pike.pulls).toBeGreaterThan(FISH.roach.pulls);
    expect(FISH.pike.zone).toBeLessThan(FISH.roach.zone);
    expect(FISH.pike.bite).toBeLessThan(FISH.roach.bite);
  });
});

describe('finding the water', () => {
  const waters = [
    { id: 'mere' as const, gx: 88, gy: 118, r: 7 },
    { id: 'reed-pond' as const, gx: 30, gy: 60, r: 3.6 },
  ];
  it('names the water at hand, and none far from any', () => {
    expect(waterNear(waters, 95, 118)).toBe('mere');
    expect(waterNear(waters, 34, 60)).toBe('reed-pond');
    expect(waterNear(waters, 60, 90)).toBeUndefined();
    expect(waterNear(undefined, 0, 0)).toBeUndefined();
  });
});
