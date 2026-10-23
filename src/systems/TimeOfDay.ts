import Phaser from 'phaser';
import { DAY_LENGTH_SECONDS, START_HOUR } from '../config';

/**
 * The in-game clock. Time is stored as total hours since the start of day 1,
 * so 30.5 means 06:30 on day 2. Everything that depends on the time of day
 * (the HUD wheel, world lighting) reads from here.
 */
export class TimeOfDay {
  private totalHours: number;
  /** Multiplier on how fast time passes, e.g. for fast-forward. */
  timeScale = 1;

  constructor(startHour = START_HOUR) {
    this.totalHours = startHour;
  }

  /** Jump to an hour of the current day, e.g. 0 for midnight. */
  setHour(hour: number): void {
    this.totalHours = Math.floor(this.totalHours / 24) * 24 + Phaser.Math.Wrap(hour, 0, 24);
  }

  update(dt: number): void {
    this.totalHours += dt * (24 / DAY_LENGTH_SECONDS) * this.timeScale;
  }

  /** Hour of the day, 0 (midnight) up to 24. */
  get hour(): number {
    return Phaser.Math.Wrap(this.totalHours, 0, 24);
  }

  /** Hours since the start of day 1, for timing things that last across days. */
  get elapsedHours(): number {
    return this.totalHours;
  }

  get day(): number {
    return Math.floor(this.totalHours / 24) + 1;
  }

  /** "HH:MM" on a 24-hour clock. */
  get clockText(): string {
    const minutes = Math.floor(this.hour * 60);
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /** The world's ambient light colour right now. See {@link ambientAt}. */
  get ambient(): Ambient {
    return ambientAt(this.hour);
  }
}

export interface Ambient {
  /** Colour the world is multiplied by: white = full daylight. */
  color: number;
  /** 0 in full daylight, 1 at the darkest point of night. Drives lantern glow. */
  darkness: number;
}

/**
 * Lighting keyframes across the day. Between two keyframes the colour is
 * blended smoothly. Tweak these to change how dawn, day, dusk and night look.
 */
const KEYFRAMES: Array<{ hour: number; color: number; darkness: number }> = [
  { hour: 0, color: 0x2b3566, darkness: 1 },
  { hour: 4.5, color: 0x2f3a6c, darkness: 1 },
  { hour: 5.5, color: 0x6a5a8c, darkness: 0.7 },
  { hour: 6.5, color: 0xe0a07c, darkness: 0.25 },
  { hour: 8, color: 0xfff1dc, darkness: 0 },
  { hour: 12, color: 0xffffff, darkness: 0 },
  { hour: 16.5, color: 0xfff0d8, darkness: 0 },
  { hour: 18, color: 0xf0a070, darkness: 0.2 },
  { hour: 19, color: 0x9a5e86, darkness: 0.55 },
  { hour: 20.5, color: 0x3a3c74, darkness: 0.9 },
  { hour: 24, color: 0x2b3566, darkness: 1 },
];

export function ambientAt(hour: number): Ambient {
  let i = 0;
  while (i < KEYFRAMES.length - 2 && hour >= KEYFRAMES[i + 1].hour) i++;
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[i + 1];
  const t = Phaser.Math.Clamp((hour - a.hour) / (b.hour - a.hour), 0, 1);
  const ca = Phaser.Display.Color.IntegerToColor(a.color);
  const cb = Phaser.Display.Color.IntegerToColor(b.color);
  const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 1, t);
  return {
    color: Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b),
    darkness: Phaser.Math.Linear(a.darkness, b.darkness, t),
  };
}
