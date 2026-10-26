/** Player preferences, saved in the browser so they survive a page reload. */
export interface SettingsData {
  masterVolume: number; // 0..1
  musicVolume: number; // 0..1
  effectsVolume: number; // 0..1
  /** Whether the minimap is shown (M toggles it). */
  showMinimap: boolean;
}

const STORAGE_KEY = 'eldermoor.settings';

const DEFAULTS: SettingsData = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  effectsVolume: 0.8,
  showMinimap: true,
};

type Listener = (s: SettingsData) => void;

function load(): SettingsData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // Storage can be blocked (private mode, sandboxed iframe); fall back to defaults.
  }
  return { ...DEFAULTS };
}

class SettingsStore {
  private data = load();
  private listeners = new Set<Listener>();

  get(): Readonly<SettingsData> {
    return this.data;
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.data = { ...this.data, [key]: value };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Not fatal: the setting still applies for this session.
    }
    this.listeners.forEach((fn) => fn(this.data));
  }

  /** Calls fn on every change. Returns an unsubscribe function. */
  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const Settings = new SettingsStore();
