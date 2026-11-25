import type { AreaId } from '../world/MapData';

/**
 * Saving and loading. The game is saved by sleeping in a bed (see
 * MapData.beds), and loading puts the player back in that bed's area at that
 * moment, with everything they had.
 *
 * Each system that remembers something (the satchel, the quest log, the
 * garden...) registers a "section" below with a function that writes its state
 * out and one that reads it back. A save is just the scene's own bits (where
 * the player is, the clock, health) plus every section by name. New systems
 * add a section and need no change here; a save made before a section existed
 * simply resets that system to how a new game starts.
 */
export interface SaveData {
  /** Bumped only if old saves can't be read as they are any more. */
  version: number;
  /** Real time it was written (ms since 1970), shown on the menu. */
  savedAt: number;
  /** The bed (MapData.beds id) slept in. */
  savePoint: string;
  area: AreaId;
  /** Where the player stands when the save is loaded, in tiles. */
  position: { x: number; y: number };
  /** The clock: hours since the start of day 1. */
  hours: number;
  health: number;
  stamina: number;
  /** Each system's own state, by section name. */
  sections: Record<string, unknown>;
}

export interface SaveSection {
  /** The system's state, as plain JSON-friendly data. */
  save(): unknown;
  /** Puts the state back. Called with undefined for a save older than the section: start it fresh. */
  load(data: unknown): void;
}

export const SAVE_VERSION = 1;
const STORAGE_KEY = 'eldermoor.save';

/** What the menus call each area. */
export const AREA_NAMES: Record<AreaId, string> = {
  home: 'The cottage',
  world: 'Adowvale Hollow',
  market: 'Adowvale',
  cave: "The wolves' cave",
  hut: "Farmer Iran's hut",
  plains: 'Adowvale Plains',
  northwoods: 'The north woods',
  watchtower: 'The old watchtower',
  beacon: 'The beacon on Corbie Tor',
  'beacon-top': 'The top of the beacon',
  greyfells: 'Greyfells Clearing',
  jetty: 'Adowvale Jetty',
  gloomhaven: 'Gloomhaven',
  blackrose: 'The Black Rose',
  'blackrose-back': 'The back room of the Black Rose',
  'blackrose-upstairs': 'Upstairs at the Black Rose',
  'blackrose-room': 'A room at the Black Rose',
  tollhouse: "The Reeve's toll house",
  'tollhouse-strong': "The toll house strongroom",
  'tollhouse-upstairs': "The Reeve's rooms",
  warren: "The goblins' warren",
  broodhall: 'The brood hall',
  monastery: "Saint Elda's Monastery",
  abbey: "Within Saint Elda's walls",
  chapel: "Saint Elda's chapel",
  infirmary: 'The infirmary',
  scriptorium: 'The scriptorium',
  refectory: 'The refectory',
  den: "The Wolf Mother's den",
  deepden: 'Beneath the den',
  tavern: 'The Crooked Tankard',
  'tavern-hall': 'Upstairs at the Crooked Tankard',
  'tavern-room': 'A room at the Crooked Tankard',
  cellar: "The Crooked Tankard's cellar",
  smithy: "Osric's smithy",
  bakery: "Hilde's bakery",
  garrison: 'The militia garrison',
  jail: 'The cells under the garrison',
  residence: "The Headman's house",
};

/**
 * Why the last save didn't reach browser storage: `blocked` (private mode, a
 * sandboxed page, cookies turned off) or `full` (the site's storage quota is used up).
 */
export type SaveProblem = 'blocked' | 'full';

/** @param stored false when the save only lives in memory: browser storage refused it. */
type Listener = (save: SaveData, stored: boolean) => void;

class SaveGameStore {
  private sections = new Map<string, SaveSection>();
  private listeners = new Set<Listener>();
  /** The last save made or loaded, kept in memory in case browser storage is blocked. */
  private latest?: SaveData;

  register(name: string, section: SaveSection): void {
    this.sections.set(name, section);
  }

  /** Every section's state, for a new save. */
  collect(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    this.sections.forEach((s, name) => (out[name] = s.save()));
    return out;
  }

  /** Puts every section back from a save. */
  restore(save: SaveData): void {
    this.sections.forEach((s, name) => s.load(save.sections[name]));
  }

  /** Why the last save couldn't be stored, or undefined if it was. */
  problem?: SaveProblem;

  /**
   * Saves the game. Returns false if browser storage refused it (see `problem`):
   * the save then lasts only until the page closes, unless the player downloads it.
   */
  write(save: SaveData): boolean {
    const stored = this.store(save);
    this.listeners.forEach((fn) => fn(save, stored));
    return stored;
  }

  /** Makes `save` the one to continue from (one loaded from a file), without announcing it as a new save. */
  adopt(save: SaveData): boolean {
    return this.store(save);
  }

  private store(save: SaveData): boolean {
    this.latest = save;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      this.problem = undefined;
      return true;
    } catch (err) {
      // Storage can be blocked (private mode, sandboxed iframe) or full: the save still lasts until the page closes.
      this.problem = saveProblem(err);
      return false;
    }
  }

  /** Whether this browser lets the game keep a save at all (false in some private windows). */
  storageWorks(): boolean {
    try {
      const probe = `${STORAGE_KEY}.probe`;
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  /** The save to continue from, if there is one. */
  read(): SaveData | undefined {
    let stored: SaveData | undefined;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) stored = saveFromText(raw);
    } catch {
      // Blocked storage: fall back to the one in memory, if any.
    }
    // When storage is full the one kept there is older than the save just made in memory.
    if (this.latest && (!stored || this.latest.savedAt >= stored.savedAt)) return this.latest;
    return stored;
  }

  /** "Day 3, 07:00 · The cottage", for the menus. */
  describe(save: SaveData): string {
    const hour = ((save.hours % 24) + 24) % 24;
    const minutes = Math.floor(hour * 60);
    const clock = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const day = Math.floor(save.hours / 24) + 1;
    return `Day ${day}, ${clock}  ·  ${AREA_NAMES[save.area] ?? save.area}`;
  }

  /** Calls fn whenever the game is saved. Returns an unsubscribe function. */
  onSave(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

/** The warning shown when a save couldn't be kept. */
export function saveProblemText(problem: SaveProblem | undefined): string {
  return problem === 'full'
    ? "Your game could not be saved: this browser's storage for the game is full."
    : 'Your game could not be saved: this browser is blocking storage.';
}

/** Tells a full storage quota apart from storage that's blocked outright. */
export function saveProblem(err: unknown): SaveProblem {
  const e = err as { name?: string; code?: number } | null;
  const full =
    !!e &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
  return full ? 'full' : 'blocked';
}

// ------------------------------------------------------------ save files

/** A save written out as a file the player can keep, in exactly the format kept in browser storage. */
export function saveToText(save: SaveData): string {
  return JSON.stringify(save);
}

/** Reads a save file back. Returns undefined if it isn't an Elwyrn save (or is from a newer version). */
export function saveFromText(text: string): SaveData | undefined {
  try {
    const save = JSON.parse(text) as SaveData;
    return isSave(save) ? save : undefined;
  } catch {
    return undefined;
  }
}

/** "eldermoor-day-3-0700.json". */
export function saveFileName(save: SaveData): string {
  const minutes = Math.floor((((save.hours % 24) + 24) % 24) * 60);
  const hhmm = `${String(Math.floor(minutes / 60)).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}`;
  return `eldermoor-day-${Math.floor(save.hours / 24) + 1}-${hhmm}.json`;
}

/** Hands the browser the save as a file to download. Call it from a click or tap. */
export function downloadSave(save: SaveData): void {
  const blob = new Blob([saveToText(save)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = saveFileName(save);
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before letting the file go.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Asks the player to pick a save file. Call it from a click or tap. Resolves with
 * the save, `null` if the file isn't a save, or undefined if they picked nothing.
 */
export function pickSaveFile(): Promise<SaveData | null | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);
    const done = (result: SaveData | null | undefined) => {
      input.remove();
      resolve(result);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return done(undefined);
      file.text().then(
        (text) => done(saveFromText(text) ?? null),
        () => done(null),
      );
    });
    input.addEventListener('cancel', () => done(undefined));
    input.click();
  });
}

function isSave(s: SaveData): boolean {
  return (
    !!s &&
    typeof s === 'object' &&
    s.version <= SAVE_VERSION &&
    typeof s.area === 'string' &&
    s.area in AREA_NAMES &&
    typeof s.hours === 'number' &&
    !!s.position &&
    typeof s.sections === 'object'
  );
}

export const SaveGame = new SaveGameStore();
