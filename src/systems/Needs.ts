import { Settings } from '../settings/Settings';
import type { ItemDef } from './Inventory';
import { SaveGame } from './SaveGame';

/**
 * Hunger and rest: an optional need to eat and sleep (Settings → "Hunger and
 * rest", off by default, and offered when a new game starts).
 *
 * Both are 0-100, where 100 is well fed or well rested. They fall as in-game
 * hours pass (walking, a trek on the road, fast-forward all count), meals fill
 * the belly and sleep puts rest right. Running low costs a little, never more:
 * - Hungry: health stops mending by itself and stamina refills at half speed.
 * - Weary: stamina only refills to part of its full bar.
 *
 * While the setting is off nothing falls and nothing is penalised; the values
 * just wait where they were.
 */

/** How much fullness and rest are lost per in-game hour awake, and fullness asleep. */
export const NEEDS_RATES = { hungerPerHour: 5, tirednessPerHour: 3, hungerAsleepPerHour: 2, restPerHourAsleep: 100 / 7 };
/** Below this the hero is hungry or weary, and the penalty applies. */
export const NEEDS_LOW = 25;
/** A weary hero's stamina only refills to this share of the bar. */
export const WEARY_STAMINA = 0.6;
/** A hungry hero's stamina refills at this share of the usual speed. */
export const HUNGRY_REGEN = 0.5;

export type NeedsEvent =
  /** One of the needs has just dropped below NEEDS_LOW. */
  | { type: 'low'; need: 'hunger' | 'rest' }
  | { type: 'changed' };

type Listener = (e: NeedsEvent) => void;

/** How full a meal makes you, from what it restores: a stew fills you more than a carrot, an ale a little, a potion not at all. */
export function fullnessFrom(def: ItemDef): number {
  if (!def.eat || def.category !== 'Food') return 0;
  const worth = (def.eat.health ?? 0) + (def.eat.stamina ?? 0);
  const fill = Math.round(worth * (def.drink ? 0.3 : 0.7));
  return Math.max(def.drink ? 2 : 5, Math.min(60, fill));
}

class NeedsStore {
  /** 100 = well fed. */
  fullness = 100;
  /** 100 = well rested. */
  rest = 100;
  /** The clock (hours since day 1) at the last tick; undefined until the first tick after a load. */
  private lastHours?: number;
  private listeners: Listener[] = [];

  get enabled(): boolean {
    return !!Settings.get().needs;
  }

  get hungry(): boolean {
    return this.enabled && this.fullness < NEEDS_LOW;
  }

  get weary(): boolean {
    return this.enabled && this.rest < NEEDS_LOW;
  }

  /** The share of the stamina bar the hero can refill to (1 unless weary). */
  get staminaCap(): number {
    return this.weary ? WEARY_STAMINA : 1;
  }

  /** The share of the usual stamina refill speed (1 unless hungry). */
  get staminaRegen(): number {
    return this.hungry ? HUNGRY_REGEN : 1;
  }

  /** Whether health mends by itself over time (not while hungry). */
  get healthRegen(): boolean {
    return !this.hungry;
  }

  /** A new game: fed and rested. */
  reset(): void {
    this.fullness = 100;
    this.rest = 100;
    this.lastHours = undefined;
    this.emit({ type: 'changed' });
  }

  onChange(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  /** Call every frame with the clock's hours since day 1: the needs fall by however long has passed. */
  tick(nowHours: number): void {
    const last = this.lastHours;
    this.lastHours = nowHours;
    if (last === undefined || !this.enabled) return;
    const hours = nowHours - last;
    if (hours <= 0) return;
    this.set(this.fullness - hours * NEEDS_RATES.hungerPerHour, this.rest - hours * NEEDS_RATES.tirednessPerHour);
  }

  /** Something eaten or drunk. */
  ate(def: ItemDef): void {
    if (!this.enabled) return;
    const fill = fullnessFrom(def);
    if (fill > 0) this.set(this.fullness + fill, this.rest);
  }

  /** A sleep of `hours`, ending at `nowHours`: rested again in about seven hours, and a little hungrier. */
  slept(hours: number, nowHours: number): void {
    this.lastHours = nowHours;
    if (!this.enabled) return;
    this.set(this.fullness - hours * NEEDS_RATES.hungerAsleepPerHour, this.rest + hours * NEEDS_RATES.restPerHourAsleep);
  }

  private set(fullness: number, rest: number): void {
    const wasHungry = this.fullness < NEEDS_LOW;
    const wasWeary = this.rest < NEEDS_LOW;
    this.fullness = clamp(fullness);
    this.rest = clamp(rest);
    if (!wasHungry && this.fullness < NEEDS_LOW) this.emit({ type: 'low', need: 'hunger' });
    if (!wasWeary && this.rest < NEEDS_LOW) this.emit({ type: 'low', need: 'rest' });
    this.emit({ type: 'changed' });
  }

  toSave(): { fullness: number; rest: number } {
    return { fullness: this.fullness, rest: this.rest };
  }

  fromSave(data: Partial<ReturnType<NeedsStore['toSave']>>): void {
    this.fullness = typeof data.fullness === 'number' ? clamp(data.fullness) : 100;
    this.rest = typeof data.rest === 'number' ? clamp(data.rest) : 100;
    this.lastHours = undefined;
    this.emit({ type: 'changed' });
  }

  private emit(e: NeedsEvent): void {
    for (const l of this.listeners) l(e);
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export const Needs = new NeedsStore();

SaveGame.register('needs', {
  save: () => Needs.toSave(),
  load(data) {
    Needs.reset();
    if (data) Needs.fromSave(data as Partial<ReturnType<NeedsStore['toSave']>>);
  },
});
