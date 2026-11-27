/**
 * The recorded music and fight sounds and voices (public/audio/music/ and
 * public/audio/sfx/, credited in the CREDITS.md in each folder). Audio.ts
 * decides what to play; this file fetches and plays the recordings, and says
 * when one can't be had so the synthesised version can stand in.
 */

const BASE = import.meta.env.BASE_URL;

// ---------------------------------------------------------------- music

/** Which recording plays for each piece of music, by the hour where it changes. */
export const MUSIC_FILES = {
  menu: 'menu',
  world: { day: 'hollow-day', night: 'hollow-night' },
  woods: { day: 'woods-day', night: 'woods-night' },
  home: { day: 'home-day', night: 'home-night' },
  market: 'market',
  tavern: { day: 'tavern-day', night: 'tavern-night', from: 18, until: 4 },
  monastery: 'monastery',
  cave: 'cave',
  battle: 'battle',
  raid: 'raid',
  ruin: 'ruin',
  mourning: { day: 'mourning-day', night: 'mourning-night' },
} as const;

type MusicChoice = string | { day: string; night: string; from?: number; until?: number };

/** The recording for a track at an hour of the day. Night runs 20:00 to 05:30 unless a track says otherwise. */
export function musicFileFor(choice: MusicChoice, hour: number): string {
  if (typeof choice === 'string') return choice;
  const from = choice.from ?? 20;
  const until = choice.until ?? 5.5;
  const night = hour >= from || hour < until;
  return night ? choice.night : choice.day;
}

/** How loud the recordings play against the sound effects (they're levelled hot). */
const MUSIC_LEVEL = 0.42;

/**
 * One recorded track, streamed from an <audio> element (so a three-minute
 * piece needn't be downloaded and decoded before it starts) and looped.
 */
export class RecordedTrack {
  private readonly el: HTMLAudioElement;
  private readonly node: MediaElementAudioSourceNode;
  private readonly out: GainNode;
  private stopped = false;

  constructor(
    private readonly ctx: AudioContext,
    readonly file: string,
    dest: AudioNode,
    fadeIn: number,
    onFail: () => void,
  ) {
    this.el = new Audio();
    this.el.crossOrigin = 'anonymous';
    this.el.loop = true;
    this.el.preload = 'auto';
    this.el.src = `${BASE}audio/music/${file}.mp3`;
    this.node = ctx.createMediaElementSource(this.el);
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.node.connect(this.out).connect(dest);
    const fail = (err: unknown) => {
      if (this.stopped) return;
      console.warn(`Music: couldn't play ${file}.mp3`, err);
      this.stop(0);
      onFail();
    };
    this.el.addEventListener('error', () => fail(this.el.error));
    // Start the fade once sound is actually coming, so a slow download doesn't eat it.
    this.el.addEventListener(
      'playing',
      () => {
        const t = ctx.currentTime;
        this.out.gain.setValueAtTime(0, t);
        this.out.gain.linearRampToValueAtTime(MUSIC_LEVEL, t + fadeIn);
      },
      { once: true },
    );
    this.el.play().catch((err: unknown) => {
      // A pause() from stop() rejects the play() promise too; that's not a failure.
      if ((err as DOMException)?.name !== 'AbortError') fail(err);
    });
  }

  /** Pauses the element while the tab is hidden, and carries on after. */
  setPaused(paused: boolean): void {
    if (this.stopped) return;
    if (paused) this.el.pause();
    else void this.el.play().catch(() => undefined);
  }

  stop(fadeSeconds = 2.5): void {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + fadeSeconds);
    window.setTimeout(() => {
      this.el.pause();
      this.el.removeAttribute('src');
      this.el.load();
      this.node.disconnect();
      this.out.disconnect();
    }, fadeSeconds * 1000 + 100);
  }
}

// ---------------------------------------------------------------- sounds

const numbered = (name: string, n: number) => Array.from({ length: n }, (_, i) => `${name}-${i + 1}`);

/** The recorded sounds, by what they're for. Each is a few takes to pick between. */
export const SFX = {
  hit: numbered('hit', 4),
  hitHeavy: numbered('hit-heavy', 3),
  crit: ['crit-1'],
  crack: numbered('crack', 2),
  thud: ['thud-1'],
  whoosh: numbered('whoosh', 5),
  swoosh: numbered('swoosh', 3),
  block: numbered('block', 3),
  clash: ['clash-1'],
  snarl: numbered('snarl', 3),
  pig: numbered('pig', 2),
  goblin: numbered('goblin', 3),
  goblinLaugh: numbered('goblin-laugh', 2),
  goblinDeath: numbered('goblin-death', 2),
  brute: numbered('brute', 3),
  bruteLaugh: ['brute-laugh-1'],
  bruteDeath: ['brute-death-1'],
  manHurt: [...numbered('man1-hurt', 3), ...numbered('man2-hurt', 3)],
  heroHurt: numbered('man1-hurt', 3),
  manDeath: ['man1-death-1', 'man2-death-1'],
  // The Mere-kin (built by tools/build-merekin-sound.py): hisses, cries, death rattles, the war-chief's bellow, a harpoon thrown.
  mereHiss: numbered('mere-hiss', 3),
  mereHurt: numbered('mere-hurt', 3),
  mereDeath: numbered('mere-death', 2),
  mereChief: numbered('mere-chief', 2),
  mereChiefDeath: ['mere-chief-death-1'],
  harpoon: numbered('harpoon', 2),
  levelUp: ['levelup-1'],
  victory: ['victory-1'],
  defeat: ['defeat-1'],
} as const;

export type VoiceId = 'm1' | 'm2' | 'f1' | 'f2';
export type BarkKind = 'greet' | 'laugh' | 'grunt';
export const VOICE_FILES = (['m1', 'm2', 'f1', 'f2'] as const).flatMap((v) => (['greet', 'laugh', 'grunt'] as const).map((k) => `voice-${v}-${k}`));

/** The sounds every fight wants, fetched as one starts. */
export const FIGHT_SFX: readonly string[] = Object.entries(SFX)
  .filter(([k]) => k !== 'levelUp' && k !== 'victory' && k !== 'defeat')
  .flatMap(([, v]) => v);

export interface ClipOptions {
  /** Loudness, 1 = as recorded. */
  gain?: number;
  /** Playback speed range: below 1 is slower and deeper. */
  rate?: [number, number];
  lowpass?: number;
  /** Seconds from now. */
  delay?: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Fetches, decodes and plays the short recorded sounds. */
export class SfxBank {
  private readonly clips = new Map<string, Promise<AudioBuffer | undefined>>();
  private readonly loaded = new Map<string, AudioBuffer>();
  /** The take last played for each set, so the same one doesn't come twice running. */
  private readonly last = new Map<readonly string[], string>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly dest: AudioNode,
  ) {}

  /** Starts fetching recordings so they're ready when wanted. */
  preload(names: readonly string[]): void {
    for (const n of names) void this.clip(n);
  }

  /**
   * Plays one of the takes, if it's loaded. Returns false if none is (still
   * downloading, or failed), so the caller can play the synthesised sound instead.
   */
  play(takes: readonly string[], opts: ClipOptions = {}): boolean {
    const ready = takes.filter((t) => this.loaded.has(t));
    if (!ready.length) {
      this.preload(takes);
      return false;
    }
    const choices = ready.length > 1 ? ready.filter((t) => t !== this.last.get(takes)) : ready;
    const name = choices[Math.floor(Math.random() * choices.length)];
    this.last.set(takes, name);
    const ctx = this.ctx;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.loaded.get(name)!;
    const [lo, hi] = opts.rate ?? [0.95, 1.05];
    src.playbackRate.value = rand(lo, hi);
    const g = ctx.createGain();
    g.gain.value = opts.gain ?? 1;
    let node: AudioNode = src;
    if (opts.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.lowpass;
      node = node.connect(f);
    }
    node.connect(g).connect(this.dest);
    src.start(t);
    return true;
  }

  private clip(name: string): Promise<AudioBuffer | undefined> {
    let p = this.clips.get(name);
    if (!p) {
      p = fetch(`${BASE}audio/sfx/${name}.mp3`)
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.arrayBuffer();
        })
        .then((data) => this.ctx.decodeAudioData(data))
        .then((buf) => {
          this.loaded.set(name, buf);
          return buf;
        })
        .catch((err) => {
          console.warn(`Sound: couldn't load ${name}.mp3`, err);
          return undefined;
        });
      this.clips.set(name, p);
    }
    return p;
  }
}

// ---------------------------------------------------------------- voices

/** Who a fighting foe sounds like, from its kind. */
export type FoeVoice = 'wolf' | 'boar' | 'goblin' | 'brute' | 'man' | 'mere' | 'merechief' | 'small';

export function foeVoice(kind: string): FoeVoice {
  if (kind === 'goblinbrute') return 'brute';
  if (kind === 'merechief') return 'merechief';
  if (kind.startsWith('mere')) return 'mere';
  if (kind.startsWith('goblin')) return 'goblin';
  if (kind.startsWith('wolf')) return 'wolf';
  if (kind === 'boar') return 'boar';
  if (kind === 'footpad' || kind === 'cutpurse') return 'man';
  return 'small';
}

/**
 * A speaker's recorded voice for barks, from their typing-blip voice: a low
 * pitch is a man's, a high one a woman's or a child's. The name picks between
 * the two voices of each, and the pitch sets how fast it plays, so each
 * speaker keeps the same voice and no two sound quite alike.
 */
export function barkVoice(name: string, pitch: number): { voice: VoiceId; rate: number } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const woman = pitch >= 270;
  const voice: VoiceId = woman ? (h % 2 ? 'f1' : 'f2') : h % 2 ? 'm1' : 'm2';
  // The recordings sit about here; a speaker above it plays a little faster.
  const base = woman ? 320 : 170;
  const rate = Math.min(1.25, Math.max(0.85, Math.pow(pitch / base, 0.4)));
  return { voice, rate };
}

/** Which bark suits a line: a laugh where they laugh, a grunt from gruff men, otherwise a friendly "heh". */
export function barkFor(line: string, wave: OscillatorType, pitch: number): BarkKind {
  if (/\b(ha|hah|heh|haha|ho ho)\b/i.test(line)) return 'laugh';
  if ((wave === 'sawtooth' || wave === 'square') && pitch < 270) return 'grunt';
  return 'greet';
}
