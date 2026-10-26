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
  market: 'Adowvale Market',
  cave: "The wolves' cave",
};

type Listener = (save: SaveData) => void;

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

  write(save: SaveData): boolean {
    this.latest = save;
    let stored = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch {
      // Storage can be blocked (private mode, sandboxed iframe): the save still lasts until the page closes.
      stored = false;
    }
    this.listeners.forEach((fn) => fn(save));
    return stored;
  }

  /** The save to continue from, if there is one. */
  read(): SaveData | undefined {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const save = JSON.parse(raw) as SaveData;
        if (isSave(save)) return save;
      }
    } catch {
      // Blocked storage or a corrupt save: fall back to the one in memory, if any.
    }
    return this.latest;
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
