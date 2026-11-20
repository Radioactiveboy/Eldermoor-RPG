import type { ItemId } from './Inventory';

/**
 * Fishing: what bites where, and when, and how hard each fish fights. Old
 * Tobin sells the hero a rod (dialogue/fisherman.ts); with it in the satchel,
 * standing at the edge of the lake, the mere, the plains ponds or the
 * monastery's fish ponds gives a "Fish" prompt. The minigame itself is
 * scenes/FishingScene.ts: wait for the float to go under, strike in time,
 * then reel in by pressing while the marker is over the fish.
 */

export type WaterId = 'lake' | 'mere' | 'reed-pond' | 'willow-pool' | 'monastery-ponds';
export type FishKind = 'perch' | 'roach' | 'pike' | 'eel' | 'tench' | 'carp' | 'trout' | 'boot';

/** What Tobin asks for his spare rod. */
export const ROD_PRICE = 6;
/** Slips of the line allowed while reeling in before the fish is lost. */
export const MAX_SLIPS = 3;
/** How fast the reel's marker sweeps along the bar and back, in bar-lengths a second. */
export const MARKER_SPEED = 1.15;

export interface FishDef {
  item: ItemId;
  /** As the catch is announced: "a perch". */
  name: string;
  /** Good presses needed to land it. */
  pulls: number;
  /** How wide the fish is on the reel bar, as a fraction of it. */
  zone: number;
  /** How quickly it darts about along the bar. */
  speed: number;
  /** Seconds the float stays under: strike within this. */
  bite: number;
}

export const FISH: Record<FishKind, FishDef> = {
  roach: { item: 'roach', name: 'a roach', pulls: 2, zone: 0.3, speed: 0.5, bite: 1.1 },
  perch: { item: 'perch', name: 'a perch', pulls: 2, zone: 0.26, speed: 0.7, bite: 1 },
  tench: { item: 'tench', name: 'a tench', pulls: 3, zone: 0.24, speed: 0.6, bite: 1 },
  trout: { item: 'trout', name: 'a brown trout', pulls: 3, zone: 0.2, speed: 1.1, bite: 0.8 },
  carp: { item: 'carp', name: 'a golden carp', pulls: 3, zone: 0.22, speed: 0.8, bite: 0.95 },
  eel: { item: 'eel', name: 'an eel', pulls: 3, zone: 0.2, speed: 1.3, bite: 0.85 },
  pike: { item: 'pike', name: 'a pike', pulls: 4, zone: 0.17, speed: 1.2, bite: 0.7 },
  // Tobin's boot. It doesn't fight at all.
  boot: { item: 'old-boot', name: 'an old boot', pulls: 1, zone: 0.5, speed: 0.1, bite: 1.2 },
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

/** Where the reel's marker is, 0-1 along the bar, `t` seconds into reeling: it sweeps along and back. */
export function markerAt(t: number): number {
  const p = (t * MARKER_SPEED) % 2;
  return p <= 1 ? p : 2 - p;
}

/** Where the fish is on the bar, 0-1, `t` seconds into reeling: it darts back and forth, faster for a fighter. */
export function fishAt(def: FishDef, t: number, phase = 0): number {
  const half = def.zone / 2;
  const x = 0.5 + 0.32 * Math.sin(t * def.speed * 1.7 + phase) + 0.12 * Math.sin(t * def.speed * 4.3 + phase * 2.1);
  return Math.min(1 - half, Math.max(half, x));
}

/** Whether the marker is over the fish. */
export function onFish(marker: number, fish: number, zone: number): boolean {
  return Math.abs(marker - fish) <= zone / 2;
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
