import { SaveGame } from './SaveGame';
import type { Ambient } from './TimeOfDay';

/**
 * The weather over Adowvale: clear skies, cloud, drizzle, rain and the odd
 * thunderstorm, each lasting a few hours, and a mist lying in the hollows on
 * some mornings.
 *
 * It's all worked out from a seed and the clock (hours since the start of
 * day 1), so the sky over any hour is always the same for a game: only the
 * seed needs saving, and sleeping through a storm just means waking after it.
 * The weather follows on from itself (rain tends to come after cloud, and a
 * storm blows itself out into rain), one spell after another.
 *
 * What the weather looks and sounds like is up to world/Ambience.ts (rain,
 * puddles, mist), ui/DayNightOverlay.ts (a darker sky, lightning) and
 * world/AmbientSounds.ts (rain, wind, thunder, rain on the roof). Nothing here
 * uses Phaser, so it can be tested on its own.
 *
 * For testing, ?weather=rain (or clear, overcast, drizzle, storm, mist) holds
 * the weather where it is.
 */
export type WeatherKind = 'clear' | 'overcast' | 'drizzle' | 'rain' | 'storm' | 'mist';

export const WEATHER_KINDS: readonly WeatherKind[] = ['clear', 'overcast', 'drizzle', 'rain', 'storm', 'mist'];

/** What the sky is doing at a moment, each part 0 (none) to 1 (as much as there is). */
export interface Sky {
  /** What to call it (the strongest part of it, as it changes from one spell to the next). */
  kind: WeatherKind;
  /** Cloud over the sun: dims and greys the light. */
  cloud: number;
  /** How hard it's raining. */
  rain: number;
  /** Wind on top of the usual breeze. */
  wind: number;
  /** Thunder and lightning about. */
  storm: number;
  /** Mist lying on the ground. */
  mist: number;
}

/** A spell of weather: what it is, and when it starts and ends (hours since the start of day 1). */
export interface Spell {
  kind: Exclude<WeatherKind, 'mist'>;
  start: number;
  end: number;
}

type SpellKind = Spell['kind'];

/** How each kind of weather looks, once it's set in. */
const LOOKS: Record<SpellKind, Omit<Sky, 'kind' | 'mist'>> = {
  clear: { cloud: 0, rain: 0, wind: 0, storm: 0 },
  overcast: { cloud: 0.45, rain: 0, wind: 0.15, storm: 0 },
  drizzle: { cloud: 0.6, rain: 0.3, wind: 0.1, storm: 0 },
  rain: { cloud: 0.78, rain: 0.7, wind: 0.35, storm: 0 },
  storm: { cloud: 1, rain: 1, wind: 0.9, storm: 1 },
};

/** What tends to follow what: the chance of each kind of spell after this one. */
const NEXT: Record<SpellKind, Array<[SpellKind, number]>> = {
  clear: [['clear', 0.5], ['overcast', 0.4], ['drizzle', 0.1]],
  overcast: [['clear', 0.35], ['overcast', 0.2], ['drizzle', 0.25], ['rain', 0.15], ['storm', 0.05]],
  drizzle: [['clear', 0.15], ['overcast', 0.35], ['drizzle', 0.15], ['rain', 0.35]],
  rain: [['overcast', 0.25], ['drizzle', 0.35], ['rain', 0.2], ['storm', 0.2]],
  storm: [['drizzle', 0.25], ['rain', 0.6], ['overcast', 0.15]],
};

/** How long a spell lasts, in hours: [shortest, longest]. Storms blow over quicker. */
const LENGTHS: Record<SpellKind, [number, number]> = {
  clear: [3, 7],
  overcast: [2, 5],
  drizzle: [2, 4],
  rain: [2, 4],
  storm: [1.5, 3],
};

/** A new game opens on a fine day: the first spell is clear until the afternoon. */
const FIRST_SPELL: Spell = { kind: 'clear', start: 0, end: 14 };
/** Hours one spell takes to give way to the next. */
const CHANGE_HOURS = 0.75;
/** The chance of a misty morning, when the night before was dry. */
const MIST_CHANCE = 0.4;
/** The hours mist lies on the ground: thickening before dawn, gone by mid-morning. */
const MIST = { from: 4, thick: 5.5, thin: 7.5, to: 10 };

/** A small, quick, seeded random number generator (mulberry32): the same seed gives the same numbers. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random number for slot `n` of a seed: the same every time it's asked for. */
function roll(seed: number, n: number): number {
  return seeded((seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0)();
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The spells of weather for one seed, worked out as far as they're asked for and kept. */
class Forecast {
  readonly spells: Spell[] = [FIRST_SPELL];

  constructor(readonly seed: number) {}

  /** The spell covering hour `hours` (and the one before it, for the change between them). */
  spellAt(hours: number): { spell: Spell; before?: Spell } {
    const h = Math.max(0, hours);
    while (this.spells[this.spells.length - 1].end <= h) this.grow();
    // Search from the end: the clock is usually near the latest spell.
    for (let i = this.spells.length - 1; i >= 0; i--) {
      if (this.spells[i].start <= h) return { spell: this.spells[i], before: this.spells[i - 1] };
    }
    return { spell: this.spells[0] };
  }

  private grow(): void {
    const i = this.spells.length;
    const last = this.spells[i - 1];
    let r = roll(this.seed, i * 2);
    let kind: SpellKind = NEXT[last.kind][0][0];
    for (const [k, p] of NEXT[last.kind]) {
      kind = k;
      if ((r -= p) < 0) break;
    }
    const [lo, hi] = LENGTHS[kind];
    const length = lo + roll(this.seed, i * 2 + 1) * (hi - lo);
    this.spells.push({ kind, start: last.end, end: last.end + Math.round(length * 4) / 4 });
  }
}

/** The sky at an hour, given a seed: see {@link Weather}. Pure, so it can be tested. */
export function skyAt(seed: number, hours: number, forecast = new Forecast(seed)): Sky {
  const { spell, before } = forecast.spellAt(hours);
  const now = LOOKS[spell.kind];
  // Over the first part of a spell, the last one gives way to it.
  const t = before ? clamp01((hours - spell.start) / CHANGE_HOURS) : 1;
  const was = before ? LOOKS[before.kind] : now;
  const sky: Sky = {
    kind: t < 0.5 && before ? before.kind : spell.kind,
    cloud: lerp(was.cloud, now.cloud, t),
    rain: lerp(was.rain, now.rain, t),
    wind: lerp(was.wind, now.wind, t),
    storm: lerp(was.storm, now.storm, t),
    mist: mistAt(seed, hours, forecast),
  };
  // Mist only lies when the air is still and dry; it names the weather once it's thick.
  if (sky.mist > 0.35 && sky.rain < 0.15) sky.kind = 'mist';
  return sky;
}

/** How thick the mist is at an hour (0..1): only on some mornings, after a dry night. */
function mistAt(seed: number, hours: number, forecast: Forecast): number {
  const day = Math.floor(hours / 24);
  const h = hours - day * 24;
  if (h < MIST.from || h > MIST.to) return 0;
  if (roll(seed, 100000 + day) >= MIST_CHANCE) return 0;
  // A dry, still night before (and no rain at dawn): it's the cool clear air that makes it.
  const dawn = forecast.spellAt(day * 24 + MIST.from).spell.kind;
  if (dawn !== 'clear' && dawn !== 'overcast') return 0;
  const thick = h < MIST.thick ? (h - MIST.from) / (MIST.thick - MIST.from) : h > MIST.thin ? (MIST.to - h) / (MIST.to - MIST.thin) : 1;
  const sky = forecast.spellAt(hours).spell.kind;
  // Rain coming on washes it away.
  const damp = sky === 'clear' || sky === 'overcast' ? 1 : 0.3;
  return clamp01(thick) * damp;
}

/** A sky held still: what ?weather=<kind> shows. */
export function steadySky(kind: WeatherKind): Sky {
  const look = LOOKS[kind === 'mist' ? 'clear' : kind];
  return { kind, ...look, mist: kind === 'mist' ? 1 : 0 };
}

/**
 * How wet the ground is (0..1): it soaks up quickly while it rains, and dries
 * out over a few hours after it stops. Puddles show by this.
 */
export function wetnessAt(sky: (hours: number) => Sky, hours: number): number {
  let wet = 0;
  // Look back over the last few hours: rain longer ago counts for less.
  for (let k = 0; k <= 8; k++) wet = Math.max(wet, sky(hours - k * 0.5).rain * 1.3 * (1 - k / 9));
  return clamp01(wet);
}

// ------------------------------------------------------------ light

/** The grey of light through heavy cloud. */
const CLOUD_GREY = { r: 0x9c, g: 0xa6, b: 0xb6 };
/** Mist softens everything towards a pale, cool white. */
const MIST_WHITE = { r: 0xd8, g: 0xde, b: 0xe6 };

/**
 * The day's light (see TimeOfDay.ambientAt) under this sky: greyer and
 * darker under cloud, paler in mist, and lit up for a moment by lightning.
 * @param flash lightning, 0 (none) to 1 (the moment of the strike)
 */
export function weatherLight(light: Ambient, sky: Sky, flash = 0): Ambient {
  let r = (light.color >> 16) & 0xff;
  let g = (light.color >> 8) & 0xff;
  let b = light.color & 0xff;
  // Under cloud: towards grey, and dimmer.
  const grey = sky.cloud * 0.55;
  const dim = 1 - sky.cloud * 0.3;
  r = lerp(r, (r * CLOUD_GREY.r) / 255, grey) * dim;
  g = lerp(g, (g * CLOUD_GREY.g) / 255, grey) * dim;
  b = lerp(b, (b * CLOUD_GREY.b) / 255, grey) * dim;
  // Mist: flatter, paler light.
  const pale = sky.mist * 0.35;
  r = lerp(r, Math.max(r, MIST_WHITE.r * (1 - light.darkness * 0.7)), pale);
  g = lerp(g, Math.max(g, MIST_WHITE.g * (1 - light.darkness * 0.7)), pale);
  b = lerp(b, Math.max(b, MIST_WHITE.b * (1 - light.darkness * 0.65)), pale);
  // Lightning: the world lit cold and white for a moment.
  r = lerp(r, 0xe8, flash);
  g = lerp(g, 0xee, flash);
  b = lerp(b, 0xff, flash);
  const byte = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return {
    color: (byte(r) << 16) | (byte(g) << 8) | byte(b),
    // Lanterns come on sooner under storm clouds.
    darkness: clamp01(light.darkness + sky.cloud * 0.22 * (1 - light.darkness)) * (1 - flash),
  };
}

// ------------------------------------------------------------ the game's weather

/** The flicker of one lightning strike: [seconds after it, brightness]. Two quick flashes, as real lightning does. */
const STRIKE: Array<[number, number]> = [[0, 1], [0.09, 0.25], [0.16, 0.85], [0.5, 0]];

class WeatherStore {
  seed = WeatherStore.newSeed();
  /** Held at one kind for testing (?weather=). */
  forced?: WeatherKind;
  /** Held still and dry for a story moment (the goblins' raid). */
  calm?: WeatherKind;
  /** Lightning lighting up the sky just now, 0..1 (see {@link strike}). */
  flash = 0;
  /** The sky where the hero is, as of this frame (kept up by world/AmbientSounds.ts), for anyone who wants to remark on it. */
  now: Sky = steadySky('clear');
  private forecast = new Forecast(this.seed);
  private strikeAge?: number;

  /** A new game: a new run of weather. */
  reset(seed = WeatherStore.newSeed()): void {
    this.seed = seed >>> 0;
    this.forecast = new Forecast(this.seed);
    this.flash = 0;
    this.strikeAge = undefined;
    this.now = skyAt(this.seed, 0, this.forecast);
  }

  /** The sky at `hours` (hours since the start of day 1). */
  at(hours: number): Sky {
    const held = this.forced ?? this.calm;
    if (held) return steadySky(held);
    return skyAt(this.seed, hours, this.forecast);
  }

  /** How wet the ground is at `hours`. */
  wetness(hours: number): number {
    const held = this.forced ?? this.calm;
    if (held) return clamp01(steadySky(held).rain * 1.3);
    return wetnessAt((h) => this.at(h), hours);
  }

  /** The spells of weather from `from` to `to` hours, for testing and the debug overlay. */
  spells(from: number, to: number): Spell[] {
    this.forecast.spellAt(to);
    return this.forecast.spells.filter((s) => s.end > from && s.start < to);
  }

  /** A lightning strike: the sky flickers bright, and {@link flash} follows it as {@link tick} is called. */
  strike(): void {
    this.strikeAge = 0;
    this.flash = STRIKE[0][1];
  }

  /** Moves a lightning strike on. */
  tick(dt: number): void {
    if (this.strikeAge === undefined) return;
    this.strikeAge += dt;
    const age = this.strikeAge;
    let i = 0;
    while (i < STRIKE.length - 1 && age >= STRIKE[i + 1][0]) i++;
    if (i >= STRIKE.length - 1) {
      this.flash = 0;
      this.strikeAge = undefined;
      return;
    }
    const [t0, a] = STRIKE[i];
    const [t1, b] = STRIKE[i + 1];
    this.flash = lerp(a, b, (age - t0) / (t1 - t0));
  }

  /** Reads ?weather=<kind> from the page address, for testing. */
  readSwitch(search: string): void {
    const w = new URLSearchParams(search).get('weather');
    this.forced = w && (WEATHER_KINDS as readonly string[]).includes(w) ? (w as WeatherKind) : undefined;
  }

  private static newSeed(): number {
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
  }
}

export const Weather = new WeatherStore();

SaveGame.register('weather', {
  save: () => ({ seed: Weather.seed }),
  load(data) {
    const seed = (data as { seed?: number } | undefined)?.seed;
    // A save from before the weather: start a run of it from here.
    Weather.reset(typeof seed === 'number' ? seed : undefined);
  },
});
