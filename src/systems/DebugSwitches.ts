/**
 * The page-address switches the game reads for testing (?area=, ?hour=, ...),
 * gathered in one place for the ?debug panel (see scenes/DebugScene.ts):
 * what each one is called, what it takes, and how to read them from the
 * address and write them back. Nothing here touches the game itself.
 */

export type SwitchKey = 'area' | 'hour' | 'raid' | 'event' | 'give' | 'wolves' | 'weather';

export interface SwitchDef {
  key: SwitchKey;
  label: string;
  /** A list to pick from (its choices come from the game, see DebugScene), a number, or free text. */
  kind: 'choice' | 'number' | 'text';
  /** What it does, shown beside it. */
  hint: string;
  /** For a number: the smallest and largest it takes. */
  min?: number;
  max?: number;
  step?: number;
}

/** Every switch, in the order the panel shows them. All of them except weather only count when a new game starts. */
export const SWITCHES: readonly SwitchDef[] = [
  { key: 'area', label: 'Area', kind: 'choice', hint: 'Start the new game here.' },
  { key: 'hour', label: 'Hour', kind: 'number', min: 0, max: 23.99, step: 0.25, hint: 'Start at this hour (21 is 9pm).' },
  { key: 'raid', label: 'Raid', kind: 'choice', hint: 'night: tincture in hand. morning: the raid. after: the ruins.' },
  { key: 'event', label: 'Road event', kind: 'choice', hint: 'The meeting on the plains, a few seconds in.' },
  { key: 'give', label: 'Give', kind: 'text', hint: 'Items in the satchel: moonpetal,raw-hare:3' },
  { key: 'wolves', label: 'Wolves', kind: 'number', min: 1, max: 6, step: 1, hint: 'The first beast in an area comes as a pack this big.' },
  { key: 'weather', label: 'Weather', kind: 'choice', hint: 'Hold the weather (read on every area).' },
];

export const RAID_SWITCHES = ['night', 'morning', 'after'] as const;

/** The switches' values in a page address's query (`?area=market&hour=21`); missing ones are left out. */
export function readSwitches(search: string): Partial<Record<SwitchKey, string>> {
  const params = new URLSearchParams(search);
  const out: Partial<Record<SwitchKey, string>> = {};
  for (const s of SWITCHES) {
    const v = params.get(s.key);
    if (v !== null && v !== '') out[s.key] = v;
  }
  return out;
}

/**
 * The query with these switches set: a value replaces the switch, an empty
 * one (or none) removes it. Anything else in the query (?debug, ?smoke) is
 * kept as it was. Returns '' or a string starting with '?'.
 */
export function withSwitches(search: string, values: Partial<Record<SwitchKey, string>>): string {
  const params = new URLSearchParams(search);
  for (const s of SWITCHES) {
    if (!(s.key in values)) continue;
    const v = values[s.key]?.trim();
    if (v) params.set(s.key, v);
    else params.delete(s.key);
  }
  // Bare flags like ?debug come back as "debug=": put them back as they were written.
  const text = params.toString().replace(/=(?=&|$)/g, '');
  return text ? `?${text}` : '';
}

/** Whether the page was opened with ?debug. */
export function debugWanted(search: string): boolean {
  return new URLSearchParams(search).has('debug');
}
