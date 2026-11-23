import { describe, expect, it } from 'vitest';
import { RECIPES } from '../../src/systems/Crafting';
import {
  biteDelay, castPower, castReach, catchTable, FISH, FishDef, fishInches, FishKind, Fight, FightEnd, hourBand, onTheRise, rollFish,
  SLACK_LIMIT, startFight, stepFight, waterNear, WaterId, WATERS,
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

describe('casting', () => {
  it('swings the power up to full and back while held', () => {
    expect(castPower(0)).toBe(0);
    expect(castPower(0.625)).toBeCloseTo(1);
    expect(castPower(1.25)).toBeCloseTo(0);
    expect(castReach(0)).toBeLessThan(castReach(1));
    expect(castReach(1)).toBeLessThanOrEqual(1);
  });

  it('counts a cast onto the rising fish only when it lands close', () => {
    expect(onTheRise(0.6, 0.64)).toBe(true);
    expect(onTheRise(0.4, 0.64)).toBe(false);
  });
});

/** Plays a fight out with a rule for when to reel; returns how it ended and how long it took. */
function play(def: FishDef, reel: (f: Fight) => boolean, seed = 7): { end: FightEnd | undefined; t: number } {
  let s = seed;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const f = startFight(def, rng);
  for (let i = 0; i < 60 * 60; i++) {
    const end = stepFight(f, def, reel(f), 1 / 60, rng);
    if (end) return { end, t: f.t };
  }
  return { end: undefined, t: f.t };
}

describe('playing a fish', () => {
  const careful = (f: Fight) => f.mode !== 'run';

  it('lands every fish for an angler who reels between runs and gives line during them', () => {
    for (const [kind, def] of Object.entries(FISH)) {
      for (const seed of [3, 7, 11]) expect(play(def, careful, seed).end, kind).toBe('landed');
    }
  });

  it('snaps the line on anything that runs if you just keep reeling', () => {
    for (const [kind, def] of Object.entries(FISH)) {
      if (kind === 'boot') continue;
      expect(play(def, () => true).end, kind).toBe('snapped');
    }
  });

  it('lets the hook fall out of a slack line', () => {
    const r = play(FISH.roach, () => false);
    expect(r.end).toBe('slipped');
    expect(r.t).toBeGreaterThan(SLACK_LIMIT);
  });

  it('reels a boot straight in: it never runs', () => {
    expect(play(FISH.boot, () => true).end).toBe('landed');
  });

  it('makes a pike a longer, harder fight than a roach', () => {
    expect(play(FISH.pike, careful).t).toBeGreaterThan(play(FISH.roach, careful).t);
    expect(FISH.pike.strength).toBeGreaterThan(FISH.roach.strength);
    expect(FISH.pike.bite).toBeLessThan(FISH.roach.bite);
  });

  it('sizes each catch within its kind', () => {
    for (const def of Object.values(FISH)) {
      expect(fishInches(def, () => 0)).toBe(def.inches[0]);
      expect(fishInches(def, () => 0.9999)).toBe(def.inches[1]);
    }
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
