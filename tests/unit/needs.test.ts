import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HEALTH } from '../../src/config';
import { itemDef } from '../../src/systems/Inventory';
import { fullnessFrom, Needs, NeedsEvent, NEEDS_LOW, NEEDS_RATES, WEARY_STAMINA } from '../../src/systems/Needs';
import { PlayerStats } from '../../src/systems/PlayerStats';
import { SaveGame } from '../../src/systems/SaveGame';
import { Settings } from '../../src/settings/Settings';

// PlayerStats only needs Phaser's Clamp.
vi.mock('phaser', () => ({ default: { Math: { Clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)) } } }));

function switchOn(on = true): void {
  Settings.set('needs', on);
}

beforeEach(() => {
  switchOn(false);
  Needs.reset();
});

describe('switched off (the default)', () => {
  it('is off unless chosen', () => {
    expect(Needs.enabled).toBe(false);
  });

  it('nothing falls and nothing is penalised', () => {
    Needs.tick(8);
    Needs.tick(8 + 48);
    expect(Needs.fullness).toBe(100);
    expect(Needs.rest).toBe(100);
    Needs.fullness = 0;
    Needs.rest = 0;
    expect(Needs.hungry).toBe(false);
    expect(Needs.weary).toBe(false);
    expect(Needs.staminaCap).toBe(1);
  });

  it("doesn't count the hours it was off once switched on", () => {
    Needs.tick(8);
    Needs.tick(30);
    switchOn();
    Needs.tick(31);
    expect(Needs.fullness).toBe(100 - NEEDS_RATES.hungerPerHour);
  });
});

describe('switched on', () => {
  beforeEach(() => switchOn());

  it('hunger and tiredness grow with the hours', () => {
    Needs.tick(8);
    Needs.tick(12);
    expect(Needs.fullness).toBe(100 - 4 * NEEDS_RATES.hungerPerHour);
    expect(Needs.rest).toBe(100 - 4 * NEEDS_RATES.tirednessPerHour);
  });

  it('starts counting from the first tick after a load', () => {
    Needs.tick(500);
    expect(Needs.fullness).toBe(100);
  });

  it('never drops below empty', () => {
    Needs.tick(0);
    Needs.tick(1000);
    expect(Needs.fullness).toBe(0);
    expect(Needs.rest).toBe(0);
  });

  it('says once when each runs low', () => {
    const events: NeedsEvent[] = [];
    const off = Needs.onChange((e) => e.type === 'low' && events.push(e));
    Needs.tick(0);
    for (let h = 1; h <= 30; h++) Needs.tick(h);
    off();
    expect(events).toEqual([{ type: 'low', need: 'hunger' }, { type: 'low', need: 'rest' }]);
  });

  it('a meal fills you up, a hearty one more than a carrot, a potion not at all', () => {
    Needs.fullness = 20;
    Needs.ate(itemDef('stew'));
    expect(Needs.fullness).toBeGreaterThan(40);
    expect(fullnessFrom(itemDef('stew'))).toBeGreaterThan(fullnessFrom(itemDef('carrot')));
    expect(fullnessFrom(itemDef('ale'))).toBeLessThan(fullnessFrom(itemDef('bread')));
    expect(fullnessFrom(itemDef('healing-draught'))).toBe(0);
    expect(fullnessFrom(itemDef('wolf-pelt'))).toBe(0);
  });

  it('a night in bed puts rest right and leaves you a little hungrier', () => {
    Needs.rest = 10;
    Needs.fullness = 80;
    Needs.slept(7, 31);
    expect(Needs.rest).toBe(100);
    expect(Needs.fullness).toBe(80 - 7 * NEEDS_RATES.hungerAsleepPerHour);
    // The hours slept aren't counted again on the next tick.
    Needs.tick(31);
    expect(Needs.rest).toBe(100);
  });

  it('hungry: no healing by itself, and slower stamina', () => {
    const fed = new PlayerStats();
    const hungry = new PlayerStats();
    for (const s of [fed, hungry]) {
      s.health = 50;
      s.stamina = 20;
    }
    fed.update(2, false);
    Needs.fullness = NEEDS_LOW - 1;
    hungry.update(2, false);
    expect(hungry.health).toBe(50);
    expect(fed.health).toBe(50 + 2 * HEALTH.regenPerSecond);
    expect(hungry.stamina - 20).toBeCloseTo((fed.stamina - 20) * 0.5, 5);
  });

  it("weary: stamina refills only part way, but what's there isn't taken", () => {
    const stats = new PlayerStats();
    Needs.rest = NEEDS_LOW - 1;
    expect(stats.stamina).toBe(stats.maxStamina);
    stats.restoreStamina(10);
    expect(stats.stamina).toBe(stats.maxStamina);
    stats.stamina = 20;
    for (let i = 0; i < 20; i++) stats.update(1, false);
    expect(stats.stamina).toBe(stats.maxStamina * WEARY_STAMINA);
    stats.restoreStamina(50);
    expect(stats.stamina).toBe(stats.maxStamina * WEARY_STAMINA);
  });
});

describe('saving', () => {
  it('round-trips, and an old save without needs starts fed and rested', () => {
    Needs.fullness = 33;
    Needs.rest = 44;
    const sections = SaveGame.collect();
    Needs.reset();
    SaveGame.restore({ sections } as never);
    expect(Needs.fullness).toBe(33);
    expect(Needs.rest).toBe(44);
    SaveGame.restore({ sections: {} } as never);
    expect(Needs.fullness).toBe(100);
    expect(Needs.rest).toBe(100);
  });
});
