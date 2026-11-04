/**
 * The world's background sounds: real recordings of wind, water lapping,
 * birdsong, crickets, frogs, owls and wolves, a market crowd, a full taproom,
 * mugs and plates, the smith's hammer, a fire, bees and a dripping cave. The
 * recordings live in public/audio/ambience/ (CC0 and CC BY, credited in
 * CREDITS.md there) and are only fetched when a place first needs them.
 *
 * The game says how much of each it wants with {@link Soundscape.setMix}
 * (see world/AmbientSounds.ts, which works that out from where the hero is
 * and the hour). Steady sounds are long seamless loops whose volume glides to
 * the new level; the rest are one-off calls and clinks, scheduled a little
 * ahead on a timer and played more or less often by their level.
 *
 * The hero's footsteps (a few takes per surface) and the monastery bell are
 * recordings too, loaded up front since they're small.
 */

/** How much of each sound to play, each 0 (none) to 1 (full). */
export interface AmbientMix {
  /** A breeze in the grass and trees, gusting now and then. */
  wind: number;
  /** Water lapping at a shore close by. */
  water: number;
  /** Songbirds in the trees. */
  birds: number;
  /** Crickets in the grass at night. */
  crickets: number;
  /** Frogs croaking at the water's edge at night. */
  frogs: number;
  /** Owls hooting at night. */
  owls: number;
  /** Wolves howling far off. */
  wolves: number;
  /** People talking out of doors: a busy market. */
  crowd: number;
  /** People talking and laughing indoors: a full taproom. */
  taproom: number;
  /** Mugs and plates knocking together. */
  clatter: number;
  /** A hammer ringing on an anvil. */
  forge: number;
  /** A fire burning in the hearth. */
  fire: number;
  /** Bees humming about their hives. */
  bees: number;
  /** Being underground: water dripping and the wind moaning through the passages. */
  cave: number;
  /** How much the surroundings echo: 0 out in the open, 1 in a cave. */
  echo: number;
}

export const SILENCE: AmbientMix = {
  wind: 0, water: 0, birds: 0, crickets: 0, frogs: 0, owls: 0, wolves: 0,
  crowd: 0, taproom: 0, clatter: 0, forge: 0, fire: 0, bees: 0, cave: 0, echo: 0,
};

/** What a footstep lands on. */
export type Surface = 'grass' | 'dirt' | 'stone' | 'wood' | 'sand' | 'soil' | 'gravel';

const TICK_MS = 100;
const LOOKAHEAD_S = 0.3;
/** Seconds a steady sound takes to glide most of the way to a new level. */
const GLIDE = 1.2;
/** Overall loudness of the world, set against the music. */
const LEVEL = 1.7;
/** A loop that's been silent this long is let go, so its recording doesn't sit in memory. */
const UNLOAD_AFTER_S = 90;

const BASE = `${import.meta.env.BASE_URL}audio/ambience/`;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const numbered = (name: string, n: number) => Array.from({ length: n }, (_, i) => `${name}-${i + 1}`);

/** A steady, looping recording and how it's played. */
interface LoopDef {
  file: string;
  /** Loudness at level 1. */
  peak: number;
  /** Optional filter, e.g. to make the wind into a cave's low moan. */
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  /** How much of it goes to the echo, on top of the place's own. */
  echo?: number;
}

const LOOPS: Record<string, LoopDef> = {
  wind: { file: 'wind', peak: 0.13, filter: { type: 'lowpass', freq: 2400, q: 0.5 } },
  water: { file: 'water', peak: 1 },
  birds: { file: 'birds', peak: 0.08 },
  crickets: { file: 'crickets', peak: 0.075 },
  frogs: { file: 'frogs', peak: 0.1 },
  crowd: { file: 'market', peak: 0.06 },
  taproom: { file: 'taproom', peak: 0.075 },
  fire: { file: 'fire', peak: 0.44 },
  bees: { file: 'bees', peak: 0.08 },
  drips: { file: 'drips', peak: 0.25, echo: 0.6 },
  // The wind heard down a passage: muffled and hollow.
  hollow: { file: 'wind', peak: 0.22, filter: { type: 'lowpass', freq: 380, q: 1.5 }, echo: 0.5 },
};

/** The one-off sounds, each a few recordings to pick between. */
const SHOTS = {
  owl: numbered('owl', 2),
  wolf: numbered('wolf', 4),
  anvil: [...numbered('anvil', 2), 'anvil-strike'],
  clink: numbered('clink', 9),
} as const;

/** How each surface sounds underfoot: which takes, and how they're coloured. */
const STEPS: Record<Surface, { takes: string[]; peak: number; rate?: [number, number]; lowpass?: number }> = {
  grass: { takes: numbered('step-grass', 5), peak: 0.175 },
  dirt: { takes: numbered('step-dirt', 5), peak: 0.23 },
  // Tilled earth: a soft, dull tread.
  soil: { takes: numbered('step-boot', 10), peak: 0.21, rate: [0.86, 0.96], lowpass: 1800 },
  // A soft shush rather than a crunch.
  sand: { takes: numbered('step-crunch', 5), peak: 0.09, rate: [0.82, 0.92], lowpass: 2400 },
  gravel: { takes: numbered('step-crunch', 5), peak: 0.165, rate: [1, 1.1] },
  stone: { takes: numbered('step-stone', 5), peak: 0.29 },
  wood: { takes: numbered('step-wood', 5), peak: 0.29 },
};

/** A loop that's playing (or about to, once its recording has loaded). */
interface Bed {
  def: LoopDef;
  gain: GainNode;
  filter?: BiquadFilterNode;
  src?: AudioBufferSourceNode;
  /** The level last asked for, 0..1. */
  level: number;
  /** When it last had a level above zero. */
  heard: number;
}

export class Soundscape {
  private mix: AmbientMix = { ...SILENCE };
  /** Combat and menus turn the world down without forgetting the mix. */
  private duck = 1;
  private readonly out: GainNode;
  private readonly dry: GainNode;
  private readonly send: GainNode;
  private readonly reverb: ConvolverNode;
  private readonly beds = new Map<string, Bed>();
  /** Recordings, fetched and decoded on first use. */
  private readonly clips = new Map<string, Promise<AudioBuffer | undefined>>();
  private readonly loaded = new Map<string, AudioBuffer>();
  /** When each kind of one-off sound is next due. */
  private due: Record<string, number> = {};
  /** How hard the wind is blowing just now, as a multiple of its level. */
  private gust = 0.8;
  private readonly timer: number;

  constructor(
    private readonly ctx: AudioContext,
    dest: AudioNode,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = LEVEL;
    this.out.connect(dest);
    this.dry = ctx.createGain();
    this.dry.connect(this.out);
    // Its own reverb, so the echo of a cave doesn't follow the music slider.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(3.2);
    this.send = ctx.createGain();
    this.send.gain.value = 0.15;
    this.send.connect(this.reverb).connect(this.out);
    this.dry.connect(this.send);
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    // Small and wanted at once: the footsteps and the bell.
    for (const s of Object.values(STEPS)) s.takes.forEach((f) => void this.clip(f));
    void this.clip('bell');
  }

  setMix(mix: AmbientMix): void {
    this.mix = mix;
    const t = this.ctx.currentTime;
    this.send.gain.setTargetAtTime(0.12 + mix.echo * 0.6, t, GLIDE);
    this.bed('wind', mix.wind * this.gust);
    this.bed('water', mix.water);
    this.bed('birds', mix.birds);
    this.bed('crickets', mix.crickets);
    this.bed('frogs', mix.frogs);
    this.bed('crowd', mix.crowd);
    this.bed('taproom', mix.taproom);
    this.bed('fire', mix.fire);
    this.bed('bees', mix.bees);
    this.bed('drips', mix.cave);
    this.bed('hollow', mix.cave * 0.8);
    // Fetch the one-off sounds a little before they're wanted.
    if (mix.owls > 0) SHOTS.owl.forEach((f) => void this.clip(f));
    if (mix.wolves > 0) SHOTS.wolf.forEach((f) => void this.clip(f));
    if (mix.forge > 0) SHOTS.anvil.forEach((f) => void this.clip(f));
    if (mix.clatter > 0) SHOTS.clink.forEach((f) => void this.clip(f));
  }

  /** Turns the whole world down (0..1), e.g. to 0.35 during a fight or 0 when paused. */
  setDuck(level: number, seconds = 0.6): void {
    this.duck = level;
    this.out.gain.setTargetAtTime(level * LEVEL, this.ctx.currentTime, seconds / 3);
  }

  /** One footstep. `loud` is about 1 for walking, less sneaking and more sprinting. */
  footstep(surface: Surface, loud: number, dest: AudioNode): void {
    const s = STEPS[surface];
    this.shot(s.takes, this.ctx.currentTime, s.peak * loud * rand(0.8, 1.05), { rate: s.rate, lowpass: s.lowpass, dest });
  }

  /** A church bell rung `strokes` times, slow and far-carrying. */
  bell(strokes: number, near = 0.6): void {
    const t0 = this.ctx.currentTime + 0.1;
    for (let i = 0; i < strokes; i++) {
      // Each stroke a touch different, as a real bell swings.
      this.shot(['bell'], t0 + i * 2.6, 0.27 * near * rand(0.9, 1.05), { rate: [0.99, 1.01], echo: 0.8 });
    }
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.setMix({ ...SILENCE });
  }

  // ---------------------------------------------------------------- recordings

  /** Fetches and decodes a recording once; resolves to nothing if it can't be had. */
  private clip(name: string): Promise<AudioBuffer | undefined> {
    let p = this.clips.get(name);
    if (!p) {
      p = fetch(`${BASE}${name}.mp3`)
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
          console.warn(`Ambience: couldn't load ${name}.mp3`, err);
          return undefined;
        });
      this.clips.set(name, p);
    }
    return p;
  }

  /** Lets go of a recording no loop is using, so it can be freed. */
  private forget(file: string): void {
    for (const b of this.beds.values()) if (b.def.file === file) return;
    this.clips.delete(file);
    this.loaded.delete(file);
  }

  // ---------------------------------------------------------------- loops

  private bed(name: string, level: number): void {
    const now = this.ctx.currentTime;
    let bed = this.beds.get(name);
    if (!bed) {
      if (level <= 0) return;
      bed = this.makeBed(name, LOOPS[name]);
      this.beds.set(name, bed);
    }
    bed.level = level;
    if (level > 0) bed.heard = now;
    bed.gain.gain.setTargetAtTime(level * bed.def.peak, now, GLIDE);
  }

  private makeBed(name: string, def: LoopDef): Bed {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    let filter: BiquadFilterNode | undefined;
    if (def.filter) {
      filter = ctx.createBiquadFilter();
      filter.type = def.filter.type;
      filter.frequency.value = def.filter.freq;
      filter.Q.value = def.filter.q ?? 0.7;
      filter.connect(gain);
    }
    gain.connect(this.dry);
    if (def.echo) {
      const wet = ctx.createGain();
      wet.gain.value = def.echo;
      gain.connect(wet).connect(this.send);
    }
    const bed: Bed = { def, gain, filter, level: 0, heard: ctx.currentTime };
    void this.clip(def.file).then((buf) => {
      // It may have been let go while loading.
      if (!buf || this.beds.get(name) !== bed) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(filter ?? gain);
      // Start somewhere in the middle, so two visits don't sound the same.
      src.start(ctx.currentTime, Math.random() * buf.duration);
      bed.src = src;
    });
    return bed;
  }

  /** Stops and lets go of loops that have been silent a while. */
  private sweep(now: number): void {
    for (const [name, bed] of this.beds) {
      if (bed.level > 0 || now - bed.heard < UNLOAD_AFTER_S) continue;
      bed.src?.stop();
      bed.src?.disconnect();
      bed.gain.disconnect();
      this.beds.delete(name);
      this.forget(bed.def.file);
    }
  }

  // ---------------------------------------------------------------- scheduler

  private tick(): void {
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    this.sweep(now);
    if (this.duck <= 0.01) return;
    const m = this.mix;
    this.gusts(now);
    this.every('owl', m.owls, 18, 45, (t) => this.owl(t, m.owls));
    this.every('wolf', m.wolves, 45, 110, (t) => this.howl(t, m.wolves));
    this.every('clink', m.clatter, 0.8, 4, (t) => this.clink(t, m.clatter));
    this.every('forge', m.forge, 6, 14, (t) => this.hammer(t, m.forge));
  }

  /**
   * Runs `play` every so often while `level` is up: about every `min`-`max`
   * seconds at full level, less often as it drops.
   */
  private every(name: string, level: number, min: number, max: number, play: (t: number) => void): void {
    const now = this.ctx.currentTime;
    if (level <= 0.02) {
      delete this.due[name];
      return;
    }
    const spread = () => rand(min, max) / Math.max(0.25, level);
    // When a sound first becomes possible, wait a little rather than starting at once.
    this.due[name] ??= now + spread() * Math.random();
    if (this.due[name] > now + LOOKAHEAD_S) return;
    play(Math.max(now, this.due[name]));
    this.due[name] = now + spread();
  }

  /** The wind rises and falls: its loudness and brightness drift to new targets every few seconds. */
  private gusts(now: number): void {
    const wind = this.beds.get('wind');
    if (wind && (this.due.gust ?? 0) <= now) {
      const strength = Math.random();
      const len = rand(3, 7);
      this.gust = 0.6 + strength * 0.55;
      wind.filter?.frequency.setTargetAtTime(1400 + strength * 3000, now, len / 3);
      wind.gain.gain.setTargetAtTime(this.mix.wind * wind.def.peak * this.gust, now, len / 3);
      this.due.gust = now + len;
    }
    const hollow = this.beds.get('hollow');
    if (hollow && (this.due.moan ?? 0) <= now) {
      const len = rand(4, 9);
      hollow.filter?.frequency.setTargetAtTime(rand(260, 560), now, len / 2);
      this.due.moan = now + len;
    }
  }

  // ---------------------------------------------------------------- one-off sounds

  /**
   * Plays one of a few recordings at time `t`, slightly re-pitched so repeats
   * don't sound the same, through a filter if given, with some going to the echo.
   * It plays into the world's sounds unless `dest` says otherwise.
   */
  private shot(names: readonly string[], t: number, peak: number, opts: { rate?: [number, number]; lowpass?: number; echo?: number; dest?: AudioNode } = {}): void {
    const buf = this.loaded.get(pick(names));
    if (!buf) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const [lo, hi] = opts.rate ?? [0.94, 1.06];
    src.playbackRate.value = rand(lo, hi);
    const g = ctx.createGain();
    g.gain.value = peak;
    const head: AudioNode = g;
    if (opts.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = opts.lowpass;
      src.connect(lp).connect(g);
    } else {
      src.connect(g);
    }
    head.connect(opts.dest ?? this.dry);
    if (opts.echo) {
      const wet = ctx.createGain();
      wet.gain.value = opts.echo;
      head.connect(wet).connect(this.send);
    }
    src.start(t);
  }

  /** A tawny owl somewhere in the trees. */
  private owl(t: number, level: number): void {
    this.shot(SHOTS.owl, t, 0.15 * level, { echo: 0.5 });
  }

  /** A wolf howling a long way off, mostly echo. */
  private howl(t: number, level: number): void {
    this.shot(SHOTS.wolf, t, 0.25 * level, { lowpass: 2200, echo: 1, rate: [0.92, 1.04] });
  }

  /** A pot or tankard knocking on a table, or two mugs clinking. */
  private clink(t: number, level: number): void {
    this.shot(SHOTS.clink, t, rand(0.04, 0.09) * level, { rate: [0.85, 1.15], lowpass: 6000 });
  }

  /** The smith at work: a run of ringing blows on the anvil. */
  private hammer(t: number, level: number): void {
    this.shot(SHOTS.anvil, t, 0.27 * level, { rate: [0.96, 1.04] });
  }

  private impulse(seconds: number): AudioBuffer {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    return buf;
  }
}
