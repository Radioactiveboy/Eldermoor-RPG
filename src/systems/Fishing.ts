import type { ItemId } from './Inventory';

/**
 * Fishing: what bites where, and when, and how hard each fish fights. Old
 * Tobin sells the hero a rod (dialogue/fisherman.ts); with it in the satchel,
 * standing at the edge of the lake, the mere, the plains ponds or the
 * monastery's fish ponds gives a "Fish" prompt. The minigame itself is
 * scenes/FishingScene.ts: hold and let go to cast (onto a rising fish if you
 * can), strike when the float goes under, then play the fish: reel in
 * between its runs and give it line while it runs (see stepFight).
 */

export type WaterId = 'lake' | 'mere' | 'reed-pond' | 'willow-pool' | 'monastery-ponds';
export type FishKind = 'perch' | 'roach' | 'pike' | 'eel' | 'tench' | 'carp' | 'trout' | 'boot';

/** What Tobin asks for his spare rod. */
export const ROD_PRICE = 6;

export interface FishDef {
  item: ItemId;
  /** As the catch is announced: "a perch". */
  name: string;
  /** Seconds the float stays under: strike within this. */
  bite: number;
  /** How hard it pulls, 0-1: how taut steady reeling keeps the line, and how fast a run snaps it if you don't give line. */
  strength: number;
  /** Seconds of steady reeling (between its runs) to bring it all the way in. */
  stamina: number;
  /** Seconds it rests between runs, least and most (no runs at all for the boot). */
  calm: [number, number];
  /** How long each run lasts, in seconds. */
  run: number;
  /** Its shadow in the water: length and depth of body in pixels, and its colour. */
  shape: { len: number; girth: number; color: number; fin: number };
  /** How long they grow, in inches, smallest to largest. */
  inches: [number, number];
  /** A word on it for the catch card. */
  note: string;
}

export const FISH: Record<FishKind, FishDef> = {
  roach: {
    item: 'roach', name: 'a roach', bite: 1.1, strength: 0.2, stamina: 2.4, calm: [2.2, 3.4], run: 0.7,
    shape: { len: 26, girth: 10, color: 0x9aa8b0, fin: 0xc8503c }, inches: [5, 10], note: 'Silver, with red fins. Every pond has them.',
  },
  perch: {
    item: 'perch', name: 'a perch', bite: 1, strength: 0.35, stamina: 3, calm: [1.8, 3], run: 0.8,
    shape: { len: 28, girth: 12, color: 0x8a9a3a, fin: 0xd8643a }, inches: [6, 14], note: 'Striped green-gold, with a spiny back fin. Mind your thumb.',
  },
  tench: {
    item: 'tench', name: 'a tench', bite: 1, strength: 0.5, stamina: 4.2, calm: [1.8, 3], run: 1,
    shape: { len: 34, girth: 14, color: 0x5a6a2a, fin: 0x3a4a1a }, inches: [10, 20], note: 'The doctor fish: olive-green, slimy, and stubborn.',
  },
  trout: {
    item: 'trout', name: 'a brown trout', bite: 0.8, strength: 0.6, stamina: 4.2, calm: [1.3, 2.4], run: 0.9,
    shape: { len: 34, girth: 11, color: 0x9a7a4a, fin: 0x6a4a2a }, inches: [9, 18], note: 'Speckled red and black, out of the cold brook water.',
  },
  carp: {
    item: 'carp', name: 'a golden carp', bite: 0.95, strength: 0.65, stamina: 5, calm: [1.6, 2.8], run: 1.2,
    shape: { len: 40, girth: 17, color: 0xd8a03a, fin: 0xb87a2a }, inches: [12, 26], note: 'Fat and golden, and far too well fed by the brothers.',
  },
  eel: {
    item: 'eel', name: 'an eel', bite: 0.85, strength: 0.6, stamina: 4.8, calm: [1.1, 2], run: 1.1,
    shape: { len: 48, girth: 7, color: 0x4a4a32, fin: 0x3a3a26 }, inches: [16, 34], note: 'It writhes, it knots, it will not keep still.',
  },
  pike: {
    item: 'pike', name: 'a pike', bite: 0.7, strength: 0.9, stamina: 5.5, calm: [1, 2], run: 1.4,
    shape: { len: 56, girth: 13, color: 0x5e7a3a, fin: 0x8a6a2a }, inches: [22, 40], note: 'All teeth and temper. Not Old Grandfather, but a cousin.',
  },
  // Tobin's boot. It doesn't fight at all.
  boot: {
    item: 'old-boot', name: 'an old boot', bite: 1.2, strength: 0.05, stamina: 1.6, calm: [99, 99], run: 0,
    shape: { len: 24, girth: 18, color: 0x4a3424, fin: 0x2a1e14 }, inches: [9, 9], note: 'Waterlogged leather, and a hole in the toe. Tobin\'s, surely.',
  },
};

/** The parts of the day fish care about. */
export type Band = 'dawn' | 'day' | 'dusk' | 'night';

export function hourBand(hour: number): Band {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'dusk';
  return 'night';
}

type Weights = Record<Band, number>;
const w = (dawn: number, day: number, dusk: number, night: number): Weights => ({ dawn, day, dusk, night });

export interface WaterDef {
  name: string;
  /** How likely each fish is at each part of the day (relative weights). */
  fish: Partial<Record<FishKind, Weights>>;
}

export const WATERS: Record<WaterId, WaterDef> = {
  // The lake in the Hollow, where Tobin sits. Pike lurk in the reeds at either end of the day; eels come out at night.
  lake: { name: 'the lake', fish: { perch: w(3, 5, 3, 0.5), roach: w(4, 4, 4, 2), pike: w(1.2, 0.3, 1.2, 0.2), eel: w(0.3, 0, 0.6, 4), boot: w(0.4, 0.4, 0.4, 0.4) } },
  // The reedy mere out on the plains: tench in the weed, the odd pike.
  mere: { name: 'the mere', fish: { tench: w(4, 2, 4, 1), perch: w(2, 3, 2, 0.3), roach: w(3, 3, 3, 1), eel: w(0.5, 0, 1, 4), pike: w(0.8, 0.2, 0.8, 0.1) } },
  'reed-pond': { name: 'the reed pond', fish: { tench: w(3, 2, 3, 1), roach: w(4, 4, 4, 2), carp: w(1, 2, 1, 0.5) } },
  // The cold, brook-fed pool under the Greyfells: trout.
  'willow-pool': { name: 'the willow pool', fish: { trout: w(4, 4, 3, 0.5), roach: w(1, 1, 1, 1), eel: w(0.3, 0, 0.5, 2) } },
  // The brothers' fish ponds outside Saint Elda's, stocked with carp.
  'monastery-ponds': { name: "the brothers' fish ponds", fish: { carp: w(3, 5, 3, 1), roach: w(3, 3, 3, 2), tench: w(1, 1, 1, 0.5) } },
};

/** What can bite here at this hour, and how likely each is (only the ones that can). */
export function catchTable(water: WaterId, hour: number): Array<{ fish: FishKind; weight: number }> {
  const band = hourBand(hour);
  return (Object.entries(WATERS[water].fish) as Array<[FishKind, Weights]>)
    .map(([fish, weights]) => ({ fish, weight: weights[band] }))
    .filter((e) => e.weight > 0);
}

/** Which fish takes the bait. `rng` gives 0-1. */
export function rollFish(water: WaterId, hour: number, rng: () => number = Math.random): FishKind {
  const table = catchTable(water, hour);
  const total = table.reduce((n, e) => n + e.weight, 0);
  let r = rng() * total;
  for (const e of table) {
    r -= e.weight;
    if (r < 0) return e.fish;
  }
  return table[table.length - 1].fish;
}

/** Seconds of watching the float before something bites: quicker at dawn and dusk, slower in the heat of the day. */
export function biteDelay(hour: number, rng: () => number = Math.random): number {
  const band = hourBand(hour);
  const base = band === 'dawn' || band === 'dusk' ? 2.5 : band === 'night' ? 3.5 : 4;
  return base + rng() * 5;
}

// ------------------------------------------------------------ the cast

/** How fast the cast's power swings full and back, in swings a second, while the button is held. */
export const CAST_SWING = 0.8;
/** How close to the rising fish the float must land (as a share of the water's width) to count. */
export const RISE_REACH = 0.08;

/** The cast's power, 0-1, after holding for `t` seconds: it climbs to full and falls back, over and over. */
export function castPower(t: number): number {
  const p = (t * CAST_SWING * 2) % 2;
  return p <= 1 ? p : 2 - p;
}

/** How far out the float lands for a cast of this power, 0 (at your feet) to 1 (the far side of the view). */
export function castReach(power: number): number {
  return 0.22 + 0.74 * Math.min(1, Math.max(0, power));
}

/** Landing right on the rings of a rising fish brings a bite on twice as quick. */
export function onTheRise(reach: number, rise: number): boolean {
  return Math.abs(reach - rise) <= RISE_REACH;
}

// ------------------------------------------------------------ the fight

/**
 * Playing a hooked fish. Hold to reel in: the line tightens and the fish comes
 * closer. Every so often the fish gathers itself (`warn`, a moment's notice)
 * and makes a run: keep reeling through a run and the line snaps; let go and
 * it takes some line back out, but the line holds. Let the line go slack for
 * too long between runs and the hook falls out.
 */
export interface Fight {
  /** How far out it is: 1 where it bit, 0 landed. */
  dist: number;
  /** How taut the line is: 1 snaps it. */
  tension: number;
  /** Seconds the line has been slack. */
  slack: number;
  mode: 'calm' | 'warn' | 'run';
  /** Seconds left in this mode. */
  left: number;
  /** Seconds since the fish was hooked. */
  t: number;
}

export type FightEnd = 'landed' | 'snapped' | 'slipped';

/** Warning before a run, in seconds: the fish tenses and the water boils. */
export const RUN_WARNING = 0.45;
/** Below this the line is slack. */
export const SLACK = 0.12;
/** Seconds of slack line before the hook falls out. */
export const SLACK_LIMIT = 2.2;
/** Where tension is comfortable: below is slack-ish, above is risky. */
export const TENSION_SAFE: [number, number] = [0.2, 0.82];

const between = (r: [number, number], rng: () => number) => r[0] + (r[1] - r[0]) * rng();

export function startFight(def: FishDef, rng: () => number = Math.random): Fight {
  return { dist: 1, tension: 0.45, slack: 0, mode: 'calm', left: between(def.calm, rng) * 0.8, t: 0 };
}

/** Where tension is heading: reeling or not, and whether the fish is running. */
export function tensionTarget(def: FishDef, mode: Fight['mode'], reeling: boolean): number {
  if (mode === 'run') return reeling ? 1.1 + 0.3 * def.strength : 0.3 + 0.2 * def.strength;
  return reeling ? 0.5 + 0.3 * def.strength : 0;
}

/** One step of the fight, `dt` seconds long. Returns how it ended, if it did. */
export function stepFight(f: Fight, def: FishDef, reeling: boolean, dt: number, rng: () => number = Math.random): FightEnd | undefined {
  f.t += dt;
  f.left -= dt;
  if (f.left <= 0) {
    if (f.mode === 'calm' && def.run > 0) {
      f.mode = 'warn';
      f.left = RUN_WARNING;
    } else if (f.mode === 'warn') {
      f.mode = 'run';
      f.left = def.run * (0.8 + 0.4 * rng());
    } else {
      f.mode = 'calm';
      f.left = between(def.calm, rng);
    }
  }
  const target = tensionTarget(def, f.mode, reeling);
  const k = f.mode === 'run' && reeling ? 1.6 : reeling ? 3 : 2.2;
  f.tension += (target - f.tension) * Math.min(1, k * dt);
  if (f.tension >= 1) return 'snapped';
  if (f.mode === 'run') {
    if (!reeling) f.dist = Math.min(1, f.dist + dt * 0.06 * (0.5 + def.strength));
  } else if (reeling) {
    f.dist -= dt / def.stamina;
  }
  if (f.dist <= 0) {
    f.dist = 0;
    return 'landed';
  }
  f.slack = f.tension < SLACK && f.mode === 'calm' ? f.slack + dt : 0;
  if (f.slack >= SLACK_LIMIT) return 'slipped';
  return undefined;
}

/** How long this one is, in inches (`rng` gives 0-1; middling sizes are commonest). */
export function fishInches(def: FishDef, rng: () => number = Math.random): number {
  const r = (rng() + rng()) / 2;
  return Math.round(def.inches[0] + (def.inches[1] - def.inches[0]) * r);
}

/** The fishable water nearest a point, if it's close enough to be the water at hand. */
export function waterNear(waters: Array<{ id: WaterId; gx: number; gy: number; r: number }> | undefined, gx: number, gy: number): WaterId | undefined {
  let best: WaterId | undefined;
  let bestD = Infinity;
  for (const wt of waters ?? []) {
    const d = Math.hypot(gx - wt.gx, gy - wt.gy) - wt.r;
    if (d < 4 && d < bestD) {
      best = wt.id;
      bestD = d;
    }
  }
  return best;
}
