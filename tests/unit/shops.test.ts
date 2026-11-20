import { beforeEach, describe, expect, it } from 'vitest';
import { itemDef, ItemId } from '../../src/systems/Inventory';
import { QuestLog } from '../../src/systems/Quests';
import { Reputation, StandingLevel } from '../../src/systems/Reputation';
import {
  buyPrice, drift, MAX_OFFER, MIN_PRICE, restock, sellPrice, ShopId, SHOPS, Shops, STANDING_TERMS, supplyFactor, usualStock,
} from '../../src/systems/Shops';
import { SaveGame } from '../../src/systems/SaveGame';

let day = 1;
beforeEach(() => {
  day = 1;
  QuestLog.reset();
  QuestLog.dayProvider = () => day;
  Shops.reset();
  Reputation.reset();
});

const LEVELS = Object.keys(STANDING_TERMS) as StandingLevel[];
const SHOP_IDS = Object.keys(SHOPS) as ShopId[];

describe('price rules', () => {
  it('drifts steadily: the same all day, within bounds, and different on other days', () => {
    expect(drift('baker', 'bread', 3)).toBe(drift('baker', 'bread', 3));
    const days = Array.from({ length: 60 }, (_, d) => drift('baker', 'bread', d));
    for (const d of days) expect(Math.abs(d)).toBeLessThanOrEqual(1);
    expect(new Set(days.map((d) => d.toFixed(3))).size).toBeGreaterThan(30);
  });

  it('charges more when stock runs short and less when overstocked', () => {
    expect(supplyFactor(8, 8)).toBe(1);
    expect(supplyFactor(0, 8)).toBeGreaterThan(1);
    expect(supplyFactor(16, 8)).toBeLessThan(1);
    expect(sellPrice(10, 1, 8, 0)).toBeGreaterThan(sellPrice(10, 8, 8, 0));
  });

  it('gives better terms to friends of the village', () => {
    expect(sellPrice(20, 4, 4, 0, 'honoured')).toBeLessThan(sellPrice(20, 4, 4, 0, 'stranger'));
    expect(sellPrice(20, 4, 4, 0, 'distrusted')).toBeGreaterThan(sellPrice(20, 4, 4, 0, 'stranger'));
    expect(buyPrice(20, 0.5, 0, 0, 0, 'honoured')).toBeGreaterThan(buyPrice(20, 0.5, 0, 0, 0, 'stranger'));
  });

  it('never pays more than it would charge, on any stall, day, stock or standing', () => {
    for (const value of [1, 2, 3, 5, 8, 12, 20, 45, 80]) {
      for (const level of LEVELS) {
        for (let d = -1; d <= 1; d += 0.25) {
          for (const have of [0, 1, 4, 12]) {
            const lowest = sellPrice(value, 40, 1, -1, 'honoured');
            const pay = buyPrice(value, 0.5, have, 4, d, level);
            expect(lowest).toBeGreaterThanOrEqual(Math.round(value * MIN_PRICE));
            if (value >= 3) expect(pay).toBeLessThan(lowest);
            expect(pay).toBeLessThanOrEqual(Math.max(1, Math.floor(value * MAX_OFFER)));
          }
        }
      }
    }
  });
});

describe('the stalls', () => {
  it('sell for no less than any trader buys, so there is no profit in carrying goods between them', () => {
    for (const level of LEVELS) {
      Reputation.reset();
      Reputation.gain('adowvale', { distrusted: -50, stranger: 0, known: 15, liked: 40, honoured: 80 }[level]);
      for (day = 1; day < 12; day++) {
        for (const seller of SHOP_IDS) {
          for (const { id } of Shops.goods(seller)) {
            const cost = Shops.price(seller, id);
            for (const buyer of SHOP_IDS) {
              const pay = Shops.offer(buyer, id);
              if (pay > 0 && (itemDef(id).value ?? 0) >= 2) expect(pay, `${id} from ${seller} to ${buyer}`).toBeLessThan(cost);
            }
          }
        }
      }
    }
  });

  it('buy back nothing for more than they sell it for, even what they want most', () => {
    for (let n = 0; n < 6; n++) {
      const pay = Shops.offer('tanner', 'wolf-pelt');
      Shops.put('tanner', 'wolf-pelt', 1);
      expect(pay).toBeLessThan(Shops.price('tanner', 'wolf-pelt'));
    }
  });

  it('price by standing only for village traders, not the tinker on the road', () => {
    const before = Shops.price('tinker', 'cheese');
    const hilde = Shops.price('baker', 'cheese');
    Reputation.gain('adowvale', 80);
    expect(Shops.price('tinker', 'cheese')).toBe(before);
    expect(Shops.price('baker', 'cheese')).toBeLessThan(hilde);
    expect(Shops.standing('baker')).toBe('honoured');
    expect(Shops.standing('tinker')).toBe('stranger');
  });
});

describe('restocking', () => {
  it('tops their own goods back up a third at a time, and sells on what they bought', () => {
    const usual = new Map<ItemId, number>([['bread', 9]]);
    const after = restock([{ id: 'bread', count: 0 }, { id: 'wolf-pelt', count: 4 }], usual, 1);
    expect(after).toEqual([{ id: 'bread', count: 3 }, { id: 'wolf-pelt', count: 2 }]);
    expect(restock(after, usual, 5)).toEqual([{ id: 'bread', count: 9 }]);
    // Overstocked: the surplus is sold off.
    expect(restock([{ id: 'bread', count: 15 }], usual, 1)).toEqual([{ id: 'bread', count: 12 }]);
  });

  it('brings back goods sold out entirely', () => {
    expect(restock([], usualStock('smith'), 1).find((g) => g.id === 'short-sword')?.count).toBe(1);
  });

  it('restocks a stall the morning after', () => {
    Shops.take('baker', 'bread', 8);
    Shops.put('baker', 'raw-hare', 4);
    expect(Shops.count('baker', 'bread')).toBe(0);
    day = 2;
    expect(Shops.count('baker', 'bread')).toBe(3);
    expect(Shops.count('baker', 'raw-hare')).toBe(2);
    // Only once a day.
    expect(Shops.count('baker', 'bread')).toBe(3);
  });

  it('keeps an errand item on the stall whatever happens', () => {
    Shops.take('baker', 'chicken-feed', 3);
    expect(Shops.count('baker', 'chicken-feed')).toBe(1);
  });
});

describe('saving the stalls', () => {
  it('round-trips the stock and the day it was stocked', () => {
    day = 4;
    Shops.take('smith', 'buckler', 2);
    const saved = JSON.parse(JSON.stringify(SaveGame.collect()));
    Shops.reset();
    SaveGame.restore({ sections: saved } as never);
    expect(Shops.count('smith', 'buckler')).toBe(0);
    day = 5;
    expect(Shops.count('smith', 'buckler')).toBe(1);
  });

  it("reads a save from before stalls restocked (just each stall's stock)", () => {
    day = 6;
    Shops.fromSave({ smith: [{ id: 'buckler', count: 5 }], nobody: [{ id: 'bread', count: 1 }] });
    expect(Shops.count('smith', 'buckler')).toBe(5);
    expect(Shops.count('smith', 'short-sword')).toBe(0);
    day = 7;
    expect(Shops.count('smith', 'short-sword')).toBe(1);
  });
});
