import { describe, expect, it } from 'vitest';
import { marketOpen } from '../../src/systems/MarketHours';
import { inHours, VILLAGER_DAYS, VILLAGERS, villagersAt, whereabouts } from '../../src/systems/VillageDay';

/** Every quarter hour of a day. */
const QUARTERS = Array.from({ length: 96 }, (_, i) => i / 4);

describe("Adowvale's villagers' days", () => {
  it('only keep their stall while the market is open, by their own hours', () => {
    for (const id of VILLAGERS) {
      for (const h of QUARTERS) {
        if (whereabouts(id, h) === 'stall') expect(marketOpen(h, VILLAGER_DAYS[id].late), `${id} at ${h}`).toBe(true);
      }
    }
  });

  it('are at their stall for most of the market day', () => {
    for (const id of VILLAGERS) {
      const open = QUARTERS.filter((h) => marketOpen(h, VILLAGER_DAYS[id].late));
      const atStall = open.filter((h) => whereabouts(id, h) === 'stall');
      expect(atStall.length / open.length, id).toBeGreaterThan(0.7);
    }
  });

  it("follow Hilde's baker's day: ovens before dawn, stall, noon loaves, dough, a cup at the Tankard, an early bed", () => {
    expect(whereabouts('baker', 2)).toBe('home');
    expect(whereabouts('baker', 4)).toBe('workshop');
    expect(whereabouts('baker', 7)).toBe('stall');
    expect(whereabouts('baker', 12)).toBe('workshop');
    expect(whereabouts('baker', 15)).toBe('stall');
    expect(whereabouts('baker', 17.75)).toBe('workshop');
    expect(whereabouts('baker', 19)).toBe('tavern');
    expect(whereabouts('baker', 21)).toBe('home');
  });

  it("follow Osric's: the forge early, the stall, the anvil at midday and after hours, then the Tankard", () => {
    expect(whereabouts('smith', 5)).toBe('home');
    expect(whereabouts('smith', 6)).toBe('workshop');
    expect(whereabouts('smith', 8)).toBe('stall');
    expect(whereabouts('smith', 12)).toBe('workshop');
    expect(whereabouts('smith', 16)).toBe('stall');
    expect(whereabouts('smith', 18.5)).toBe('workshop');
    expect(whereabouts('smith', 21)).toBe('tavern');
    expect(whereabouts('smith', 23)).toBe('home');
  });

  it("follow Tamsin's, who has no workshop in the square: stall, Tankard, home", () => {
    expect(QUARTERS.some((h) => whereabouts('tanner', h) === 'workshop')).toBe(false);
    expect(whereabouts('tanner', 7)).toBe('home');
    expect(whereabouts('tanner', 7.5)).toBe('stall');
    expect(whereabouts('tanner', 18.5)).toBe('tavern');
    expect(whereabouts('tanner', 22.5)).toBe('home');
  });

  it('fill the Tankard of an evening and empty it by midnight', () => {
    expect(villagersAt('tavern', 20)).toEqual(['baker', 'smith', 'tanner']);
    expect(villagersAt('tavern', 23.5)).toEqual([]);
    expect(villagersAt('tavern', 12)).toEqual([]);
  });

  it('read the clock round past midnight and from a running total of hours', () => {
    expect(whereabouts('baker', 24 + 4)).toBe('workshop');
    expect(whereabouts('smith', -3)).toBe(whereabouts('smith', 21));
    expect(inHours(18, 26, 1)).toBe(true);
    expect(inHours(18, 26, 3)).toBe(false);
  });
});
