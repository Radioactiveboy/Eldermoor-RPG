/**
 * The weather (systems/Weather.ts): spells that follow on from each other,
 * the same sky every time for a seed, mist only on dry mornings, wet ground
 * that dries, the light under cloud, lightning, and the weather in saves.
 * And what's left after the raid (world/Aftermath.ts): the ruins smoulder
 * for a couple of days and the crows thin out.
 */
import { describe, expect, it } from 'vitest';
import { SaveGame } from '../../src/systems/SaveGame';
import { QuestLog } from '../../src/systems/Quests';
import { Sky, skyAt, steadySky, Weather, weatherLight, wetnessAt, WEATHER_KINDS } from '../../src/systems/Weather';
import { courierScript, footpadScript, tinkerScript } from '../../src/dialogue/wayfarers';
import { crowsAbout, smoulder, SMOULDER_HOURS } from '../../src/world/Aftermath';

const DAYS = 30;
const HOURS = DAYS * 24;

/** Every hour (and half hour) of the first month, for one seed. */
function month(seed: number): Sky[] {
  return Array.from({ length: HOURS * 2 }, (_, i) => skyAt(seed, i / 2));
}

describe('the weather', () => {
  it('is the same every time for a seed, and different for another', () => {
    const a = month(1234).map((s) => s.kind).join();
    expect(month(1234).map((s) => s.kind).join()).toBe(a);
    expect(month(98765).map((s) => s.kind).join()).not.toBe(a);
  });

  it('gives the same sky whether asked in order or jumping about (as sleeping does)', () => {
    Weather.reset(42);
    const inOrder = Array.from({ length: 200 }, (_, i) => Weather.at(i * 1.5));
    Weather.reset(42);
    const jumbled = Array.from({ length: 200 }, (_, i) => i).sort((a, b) => ((a * 7919) % 200) - ((b * 7919) % 200));
    const got = new Map(jumbled.map((i) => [i, Weather.at(i * 1.5)]));
    expect(inOrder).toEqual(inOrder.map((_, i) => got.get(i)));
  });

  it('opens a new game on a fine day', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (let h = 0; h <= 13.5; h += 0.5) expect(skyAt(seed, h).kind, `seed ${seed}, ${h}h`).toMatch(/clear|mist/);
    }
  });

  it('changes every few hours, through every kind, with rain and storms the rarer', () => {
    const counts = new Map<string, number>();
    let changes = 0;
    for (const seed of [7, 8, 9, 10]) {
      Weather.reset(seed);
      const spells = Weather.spells(0, HOURS);
      changes += spells.length;
      for (const s of spells) {
        expect(s.end - s.start).toBeGreaterThanOrEqual(1.5);
        expect(s.end - s.start).toBeLessThanOrEqual(14);
        counts.set(s.kind, (counts.get(s.kind) ?? 0) + (s.end - s.start));
      }
    }
    // About one change every four hours.
    expect(changes / (4 * DAYS)).toBeGreaterThan(4);
    expect(changes / (4 * DAYS)).toBeLessThan(9);
    for (const kind of ['clear', 'overcast', 'drizzle', 'rain', 'storm']) expect(counts.get(kind) ?? 0, kind).toBeGreaterThan(0);
    expect(counts.get('storm')!).toBeLessThan(counts.get('clear')!);
    expect(counts.get('rain')!).toBeLessThan(counts.get('clear')! + counts.get('overcast')!);
  });

  it('eases from one spell into the next rather than switching at once', () => {
    Weather.reset(77);
    const spells = Weather.spells(0, HOURS);
    const change = spells.find((s, i) => i > 0 && s.kind === 'rain' && spells[i - 1].kind !== 'rain')!;
    expect(change).toBeDefined();
    const before = Weather.at(change.start - 0.01).rain;
    const during = Weather.at(change.start + 0.3).rain;
    const after = Weather.at(change.start + 1).rain;
    expect(during).toBeGreaterThan(before);
    expect(during).toBeLessThan(after);
  });

  it('only lies misty in the early morning, and never in the rain', () => {
    let misty = 0;
    for (const sky of [...month(5), ...month(6)].map((s, i) => ({ s, h: (i % (HOURS * 2)) / 2 }))) {
      if (sky.s.mist === 0) continue;
      misty++;
      const hour = sky.h % 24;
      expect(hour).toBeGreaterThanOrEqual(4);
      expect(hour).toBeLessThanOrEqual(10);
      if (sky.s.kind === 'mist') expect(sky.s.rain).toBeLessThan(0.15);
    }
    expect(misty).toBeGreaterThan(0);
  });

  it('wets the ground while it rains and dries it over the next few hours', () => {
    const rainy = (h: number) => (h >= 10 && h < 14 ? steadySky('rain') : steadySky('clear'));
    expect(wetnessAt(rainy, 9)).toBe(0);
    expect(wetnessAt(rainy, 12)).toBeGreaterThan(0.8);
    const drying = [14.5, 15.5, 16.5, 18].map((h) => wetnessAt(rainy, h));
    expect(drying[0]).toBeGreaterThan(drying[1]);
    expect(drying[1]).toBeGreaterThan(drying[2]);
    expect(drying[3]).toBe(0);
  });

  it('darkens and greys the light under cloud, and lights it up with lightning', () => {
    const noon = { color: 0xffffff, darkness: 0 };
    const clear = weatherLight(noon, steadySky('clear'));
    expect(clear).toEqual(noon);
    const storm = weatherLight(noon, steadySky('storm'));
    const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    expect(lum(storm.color)).toBeLessThan(lum(noon.color) * 0.75);
    expect(storm.darkness).toBeGreaterThan(0);
    // Blue-grey: the blue is kept more than the red.
    expect(storm.color & 255).toBeGreaterThan((storm.color >> 16) & 255);
    const lit = weatherLight(noon, steadySky('storm'), 1);
    expect(lum(lit.color)).toBeGreaterThan(lum(storm.color));
    expect(lit.darkness).toBe(0);
  });

  it('flickers twice for a strike, then goes dark', () => {
    Weather.strike();
    expect(Weather.flash).toBe(1);
    const seen: number[] = [];
    for (let i = 0; i < 40; i++) {
      Weather.tick(1 / 60);
      seen.push(Weather.flash);
    }
    // Down, back up for the second flash, then out.
    const dip = seen.indexOf(Math.min(...seen.slice(0, 12)));
    expect(Math.max(...seen.slice(dip))).toBeGreaterThan(seen[dip] + 0.3);
    for (let i = 0; i < 30; i++) Weather.tick(1 / 60);
    expect(Weather.flash).toBe(0);
  });

  it('can be held for testing with ?weather=', () => {
    Weather.reset(3);
    for (const kind of WEATHER_KINDS) {
      Weather.readSwitch(`?area=world&weather=${kind}`);
      expect(Weather.at(500).kind).toBe(kind);
    }
    Weather.readSwitch('?weather=hailstones');
    expect(Weather.forced).toBeUndefined();
    Weather.readSwitch('');
  });

  it('is saved with the game, and a save from before it starts a run of weather', () => {
    Weather.reset(555);
    const sections = SaveGame.collect();
    expect(sections.weather).toEqual({ seed: 555 });
    const sky = Weather.at(321);
    Weather.reset(1);
    SaveGame.restore({ sections } as never);
    expect(Weather.seed).toBe(555);
    expect(Weather.at(321)).toEqual(sky);
    SaveGame.restore({ sections: {} } as never);
    expect(Number.isInteger(Weather.seed)).toBe(true);
  });
});

describe('after the raid', () => {
  it('the ruins smoke thickly at first and die down over a couple of days', () => {
    expect(smoulder(0)).toBe(1);
    expect(smoulder(12)).toBeGreaterThan(smoulder(30));
    expect(smoulder(30)).toBeGreaterThan(0);
    expect(smoulder(SMOULDER_HOURS)).toBe(0);
    expect(smoulder(200)).toBe(0);
  });

  it('the crows are thickest at first, and a few stay on', () => {
    expect(crowsAbout(0)).toBe(1);
    expect(crowsAbout(48)).toBeLessThan(crowsAbout(2));
    expect(crowsAbout(1000)).toBeCloseTo(0.2);
  });

  it('the folk on the road talk of the goblins', () => {
    QuestLog.reset();
    // Before the raid, nothing leads to talk of goblins.
    const choices = [tinkerScript(true), courierScript(false, undefined, true)].flatMap((s) => Object.values(s.nodes).flatMap((n) => n.choices ?? []));
    expect(choices.some((c) => c.next === 'goblins')).toBe(false);
    expect(footpadScript(5, false, false).nodes.greet.lines.join(' ')).not.toMatch(/goblin/i);
    QuestLog.setFlag('raid-over');
    const tinker = tinkerScript(true);
    expect(tinker.nodes.ask.choices!.some((c) => c.next === 'goblins')).toBe(true);
    expect(tinker.nodes.goblins.next).toBe('ask');
    const courier = courierScript(false, undefined, true);
    expect(courier.nodes.greet.choices!.some((c) => c.next === 'goblins')).toBe(true);
    expect(courier.nodes.goblins.choices!.some((c) => c.next === 'goblins')).toBe(false);
    expect(footpadScript(5, false, false).nodes.greet.lines.join(' ')).toMatch(/goblins/);
    QuestLog.reset();
  });
});
