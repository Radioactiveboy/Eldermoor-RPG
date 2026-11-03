/**
 * The world's background sounds, made live with the Web Audio API like the
 * music: wind, water lapping, birdsong, crickets and owls, crowds talking,
 * the smith's hammer, a fire, bees, the cave's hollow drone, and church bells.
 *
 * The game says how much of each it wants with {@link Soundscape.setMix}
 * (see world/AmbientSounds.ts, which works that out from where the hero is
 * and the hour). Steady sounds are long loops whose volume glides to the
 * new level; the rest are one-off calls and clinks, scheduled a little ahead
 * on a timer and made more or less often by their level.
 */

/** How much of each sound to play, each 0 (none) to 1 (full). */
export interface AmbientMix {
  /** A breeze in the grass and trees, gusting now and then. */
  wind: number;
  /** Water lapping at a shore close by. */
  water: number;
  /** Songbirds, wood pigeons and crows. */
  birds: number;
  /** Crickets in the grass at night. */
  crickets: number;
  /** Frogs croaking at the water's edge at night. */
  frogs: number;
  /** Owls hooting at night. */
  owls: number;
  /** Wolves howling far off. */
  wolves: number;
  /** People talking: a busy market or a full taproom. */
  crowd: number;
  /** Mugs and plates knocking together. */
  clatter: number;
  /** A hammer ringing on an anvil. */
  forge: number;
  /** A fire burning in the hearth. */
  fire: number;
  /** Bees humming about their hives. */
  bees: number;
  /** The low, hollow moan of being underground. */
  cave: number;
  /** How much the surroundings echo: 0 out in the open, 1 in a cave. */
  echo: number;
}

export const SILENCE: AmbientMix = {
  wind: 0, water: 0, birds: 0, crickets: 0, frogs: 0, owls: 0, wolves: 0,
  crowd: 0, clatter: 0, forge: 0, fire: 0, bees: 0, cave: 0, echo: 0,
};

/** What a footstep lands on. */
export type Surface = 'grass' | 'dirt' | 'stone' | 'wood' | 'sand' | 'soil' | 'gravel';

const TICK_MS = 100;
const LOOKAHEAD_S = 0.3;
/** Seconds a steady sound takes to glide most of the way to a new level. */
const GLIDE = 1.2;
const VOICES = 7;
/** Overall loudness of the world, set by ear against the music. */
const LEVEL = 1.7;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A looping noise bed: noise through a filter into a gain we glide. */
interface Bed {
  filter: BiquadFilterNode;
  gain: GainNode;
  /** Loudness at level 1. */
  peak: number;
}

/** One murmuring voice in a crowd: a buzzy tone through a moving formant. */
interface Voice {
  osc: OscillatorNode;
  formant: BiquadFilterNode;
  formant2: BiquadFilterNode;
  gain: GainNode;
  pitch: number;
  /** When this voice next starts saying something. */
  next: number;
}

export class Soundscape {
  private mix: AmbientMix = { ...SILENCE };
  /** Combat and menus turn the world down without forgetting the mix. */
  private duck = 1;
  private readonly out: GainNode;
  private readonly dry: GainNode;
  private readonly send: GainNode;
  private readonly reverb: ConvolverNode;
  private readonly pink: AudioBuffer;
  private readonly brown: AudioBuffer;
  private readonly beds = new Map<string, Bed>();
  private voices: Voice[] = [];
  private bees?: { gain: GainNode; oscs: OscillatorNode[] };
  /** When each kind of one-off sound is next due. */
  private due: Record<string, number> = {};
  /** How hard the wind is blowing just now, as a multiple of its level. */
  private gust = 0.8;
  private crickets: Array<{ period: number; next: number; pitch: number }> = [];
  private readonly timer: number;

  constructor(
    private readonly ctx: AudioContext,
    dest: AudioNode,
    private readonly white: AudioBuffer,
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
    this.pink = this.colouredNoise(11, 'pink');
    this.brown = this.colouredNoise(9, 'brown');
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  setMix(mix: AmbientMix): void {
    this.mix = mix;
    const t = this.ctx.currentTime;
    this.send.gain.setTargetAtTime(0.12 + mix.echo * 0.6, t, GLIDE);
    // A wide band rather than a lowpass: a breeze is a hiss in the leaves more than a rumble.
    this.bed('wind', mix.wind * this.gust, () => this.makeBed(this.pink, 'bandpass', 600, 0.45, 0.07));
    this.bed('water', mix.water, () => this.makeBed(this.brown, 'lowpass', 420, 0.8, 0.12));
    this.bed('fire', mix.fire, () => this.makeBed(this.brown, 'lowpass', 260, 0.7, 0.09));
    this.bed('cave', mix.cave, () => this.makeBed(this.brown, 'lowpass', 140, 1, 0.09));
    // The wind whistling through a passage: a narrow band of noise that wanders.
    this.bed('hollow', mix.cave, () => this.makeBed(this.pink, 'bandpass', 320, 9, 0.12));
    this.bed('babble', mix.crowd, () => this.makeBed(this.pink, 'bandpass', 600, 1.2, 0.035));
    this.setBees(mix.bees);
  }

  /** Turns the whole world down (0..1), e.g. to 0.35 during a fight or 0 when paused. */
  setDuck(level: number, seconds = 0.6): void {
    this.duck = level;
    this.out.gain.setTargetAtTime(level * LEVEL, this.ctx.currentTime, seconds / 3);
  }

  /** One footstep. `loud` is about 1 for walking, less sneaking and more sprinting. */
  footstep(surface: Surface, loud: number, dest: AudioNode): void {
    const t = this.ctx.currentTime;
    const v = loud * rand(0.8, 1.1);
    switch (surface) {
      case 'grass':
        this.noise(dest, t, 0.13, 'bandpass', 1700, 900, 0.8, 0.09 * v);
        this.thud(dest, t, 90, 0.06 * v);
        break;
      case 'soil':
        this.noise(dest, t, 0.1, 'lowpass', 900, 400, 0.7, 0.12 * v);
        this.thud(dest, t, 80, 0.08 * v);
        break;
      case 'dirt':
        this.noise(dest, t, 0.09, 'bandpass', 2200, 1400, 1, 0.1 * v);
        this.thud(dest, t, 95, 0.08 * v);
        break;
      case 'sand':
        this.noise(dest, t, 0.16, 'highpass', 2600, 1800, 0.6, 0.06 * v);
        break;
      case 'gravel':
        this.noise(dest, t, 0.08, 'bandpass', 3000, 1800, 1.2, 0.11 * v);
        this.noise(dest, t + 0.03, 0.06, 'highpass', 3500, 2500, 0.8, 0.05 * v);
        this.thud(dest, t, 110, 0.07 * v);
        break;
      case 'stone':
        this.thud(dest, t, 140, 0.1 * v);
        this.noise(dest, t, 0.04, 'highpass', 2800, 2200, 0.8, 0.07 * v);
        break;
      case 'wood':
        this.thud(dest, t, 120, 0.16 * v, 0.09);
        this.knock(dest, t, rand(330, 380), 0.05 * v);
        break;
    }
  }

  /** A church bell rung `strokes` times, slow and far-carrying. */
  bell(strokes: number, near = 0.6): void {
    const t0 = this.ctx.currentTime + 0.1;
    for (let i = 0; i < strokes; i++) this.bellStroke(t0 + i * 2.6, near);
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.setMix({ ...SILENCE });
  }

  // ---------------------------------------------------------------- beds

  private bed(name: string, level: number, make: () => Bed): void {
    let bed = this.beds.get(name);
    if (!bed) {
      if (level <= 0) return;
      bed = make();
      this.beds.set(name, bed);
    }
    bed.gain.gain.setTargetAtTime(level * bed.peak, this.ctx.currentTime, GLIDE);
  }

  private makeBed(buffer: AudioBuffer, type: BiquadFilterType, freq: number, q: number, peak: number): Bed {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.dry);
    src.start(this.ctx.currentTime, Math.random() * buffer.duration);
    return { filter, gain, peak };
  }

  /** Bees: a few detuned buzzing tones whose pitch wavers as they fly about. */
  private setBees(level: number): void {
    if (!this.bees) {
      if (level <= 0) return;
      const ctx = this.ctx;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 900;
      band.Q.value = 0.8;
      band.connect(gain).connect(this.dry);
      const oscs: OscillatorNode[] = [];
      for (const f of [196, 214, 231, 247]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const wobble = ctx.createOscillator();
        wobble.frequency.value = rand(0.3, 1.2);
        const depth = ctx.createGain();
        depth.gain.value = rand(6, 14);
        wobble.connect(depth).connect(o.frequency);
        const g = ctx.createGain();
        g.gain.value = 0.25;
        o.connect(g).connect(band);
        o.start();
        wobble.start();
        oscs.push(o, wobble);
      }
      this.bees = { gain, oscs };
    }
    this.bees.gain.gain.setTargetAtTime(level * 0.05, this.ctx.currentTime, GLIDE);
  }

  // ---------------------------------------------------------------- scheduler

  private tick(): void {
    if (this.duck <= 0.01 || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const m = this.mix;
    this.gusts(now);
    this.every('lap', m.water, 1.3, 3.2, (t) => this.lap(t, m.water));
    this.every('bird', m.birds, 1.2, 5, (t) => this.bird(t, m.birds));
    this.every('owl', m.owls, 18, 45, (t) => this.owl(t, m.owls));
    this.every('wolf', m.wolves, 45, 110, (t) => this.howl(t, m.wolves));
    this.every('frog', m.frogs, 0.6, 2.4, (t) => this.frog(t, m.frogs));
    this.every('clink', m.clatter, 0.8, 4, (t) => this.clink(t, m.clatter));
    this.every('forge', m.forge, 3, 7, (t) => this.hammer(t, m.forge));
    this.every('settle', m.cave, 14, 40, (t) => this.settle(t, m.cave));
    this.cricketChorus(now, m.crickets);
    this.murmur(now, m.crowd);
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

  /** The wind rises and falls: its filter and loudness drift to new targets every few seconds. */
  private gusts(now: number): void {
    const wind = this.beds.get('wind');
    if (wind && (this.due.gust ?? 0) <= now) {
      const strength = Math.random();
      const len = rand(2.5, 6);
      this.gust = 0.45 + strength * 0.75;
      wind.filter.frequency.setTargetAtTime(380 + strength * 1000, now, len / 3);
      wind.gain.gain.setTargetAtTime(this.mix.wind * wind.peak * this.gust, now, len / 3);
      this.due.gust = now + len;
    }
    const hollow = this.beds.get('hollow');
    if (hollow && (this.due.moan ?? 0) <= now) {
      const len = rand(4, 9);
      hollow.filter.frequency.setTargetAtTime(rand(220, 520), now, len / 2);
      this.due.moan = now + len;
    }
    const fire = this.beds.get('fire');
    if (fire && (this.due.flare ?? 0) <= now) {
      fire.filter.frequency.setTargetAtTime(rand(180, 420), now, 0.4);
      this.due.flare = now + rand(0.5, 2);
    }
  }

  // ---------------------------------------------------------------- one-off sounds

  /** A wave washing in and drawing back. */
  private lap(t: number, level: number): void {
    const len = rand(0.9, 1.6);
    this.noise(this.dry, t, len, 'lowpass', 300, 1100, 0.6, 0.09 * level, this.brown);
    this.noise(this.dry, t + len * 0.4, len * 0.7, 'bandpass', 1800, 900, 0.9, 0.025 * level);
  }

  private bird(t: number, level: number): void {
    const r = Math.random();
    if (r < 0.45) this.chirp(t, level);
    else if (r < 0.75) this.warble(t, level);
    else if (r < 0.92) this.coo(t, level);
    else this.caw(t, level);
  }

  /** A few quick, high, falling whistles. */
  private chirp(t0: number, level: number): void {
    const base = rand(2600, 4000);
    const notes = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * rand(0.09, 0.14);
      this.tone(t, 0.07, 'sine', base * rand(1, 1.15), base * 0.7, 0.05 * level, this.dry);
    }
  }

  /** A blackbird-like run of rising and falling notes. */
  private warble(t0: number, level: number): void {
    let f = rand(1800, 2600);
    let t = t0;
    const notes = 5 + Math.floor(Math.random() * 6);
    for (let i = 0; i < notes; i++) {
      const len = rand(0.05, 0.14);
      const to = f * rand(0.8, 1.3);
      this.tone(t, len, 'sine', f, to, 0.04 * level, this.dry);
      f = Math.min(4200, Math.max(1500, to * rand(0.9, 1.15)));
      t += len + rand(0.01, 0.06);
    }
  }

  /** A wood pigeon somewhere in the trees: "coo-COO-coo, coo-coo". */
  private coo(t0: number, level: number): void {
    const base = rand(480, 560);
    const pattern = [
      [0, 0.28, 1], [0.38, 0.42, 1.08], [0.9, 0.22, 1], [1.35, 0.22, 0.97], [1.65, 0.3, 0.95],
    ];
    for (const [at, len, p] of pattern) this.tone(t0 + at, len, 'sine', base * p, base * p * 0.93, 0.03 * level, this.dry, 0.06);
  }

  /** A crow far off: two or three hoarse caws. */
  private caw(t0: number, level: number): void {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * rand(0.38, 0.5);
      const band = this.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1300;
      band.Q.value = 3;
      band.connect(this.send);
      band.connect(this.dry);
      this.tone(t, 0.26, 'sawtooth', 720, 560, 0.025 * level, band, 0.03);
    }
  }

  /** A tawny owl: a long "hoo", a pause, then a wavering "hoo-hoo-hooo". */
  private owl(t0: number, level: number): void {
    const f = rand(380, 430);
    const v = 0.04 * level;
    this.tone(t0, 0.55, 'sine', f, f * 0.92, v, this.send, 0.08);
    this.tone(t0, 0.55, 'sine', f, f * 0.92, v, this.dry, 0.08);
    const t1 = t0 + rand(1.6, 2.4);
    for (let i = 0; i < 3; i++) {
      const len = i === 2 ? 0.9 : 0.16;
      this.tone(t1 + i * 0.24, len, 'sine', f * 1.02, f * 0.9, v * 0.8, this.send, 0.03);
      this.tone(t1 + i * 0.24, len, 'sine', f * 1.02, f * 0.9, v * 0.8, this.dry, 0.03);
    }
  }

  /** A wolf howling a long way off, mostly echo. */
  private howl(t0: number, level: number): void {
    const ctx = this.ctx;
    const len = rand(2.2, 3.2);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = rand(330, 400);
    o.frequency.setValueAtTime(base * 0.8, t0);
    o.frequency.exponentialRampToValueAtTime(base * 1.5, t0 + 0.5);
    o.frequency.setValueAtTime(base * 1.5, t0 + len * 0.6);
    o.frequency.exponentialRampToValueAtTime(base * 1.05, t0 + len);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5;
    const depth = ctx.createGain();
    depth.gain.value = 6;
    vib.connect(depth).connect(o.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.03 * level, t0 + 0.4);
    g.gain.setValueAtTime(0.03 * level, t0 + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(lp).connect(g);
    g.connect(this.send);
    g.connect(this.dry);
    o.start(t0);
    vib.start(t0);
    o.stop(t0 + len + 0.05);
    vib.stop(t0 + len + 0.05);
  }

  /** A frog at the water's edge: a short, burbling croak. */
  private frog(t0: number, level: number): void {
    const f = rand(160, 260);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.045;
      const band = this.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = f * 4;
      band.Q.value = 2;
      band.connect(this.dry);
      this.tone(t, 0.035, 'square', f, f * 0.9, 0.05 * level, band, 0.005);
    }
  }

  /** Crickets: each keeps its own steady beat of three or four quick pulses. */
  private cricketChorus(now: number, level: number): void {
    const want = Math.round(level * 5);
    while (this.crickets.length < want) {
      this.crickets.push({ period: rand(0.5, 1.1), next: now + Math.random(), pitch: rand(4100, 4900) });
    }
    this.crickets.length = Math.min(this.crickets.length, want);
    for (const c of this.crickets) {
      while (c.next < now + LOOKAHEAD_S) {
        const t = Math.max(now, c.next);
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = c.pitch;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        const pulses = 3 + (Math.random() < 0.5 ? 1 : 0);
        const v = 0.012 * level * rand(0.6, 1);
        for (let i = 0; i < pulses; i++) {
          const p = t + i * 0.028;
          g.gain.setValueAtTime(0, p);
          g.gain.linearRampToValueAtTime(v, p + 0.004);
          g.gain.linearRampToValueAtTime(0, p + 0.016);
        }
        o.connect(g).connect(this.dry);
        o.start(t);
        o.stop(t + pulses * 0.028 + 0.02);
        c.next += c.period * rand(0.95, 1.05);
      }
    }
  }

  /**
   * A crowd: several voices, each saying a phrase of mumbled syllables then
   * listening for a while. No words, just the rise and fall of talk. Now and
   * then one of them laughs.
   */
  private murmur(now: number, level: number): void {
    if (level > 0 && this.voices.length === 0) {
      for (let i = 0; i < VOICES; i++) this.voices.push(this.makeVoice(i));
    }
    this.voices.forEach((v, i) => {
      const active = i < Math.ceil(level * VOICES);
      if (!active || v.next > now + LOOKAHEAD_S) return;
      const t0 = Math.max(now, v.next);
      const loud = 0.09 * Math.min(1, level * 1.4) * rand(0.5, 1) * (i < 2 ? 1 : 0.7);
      let t = t0;
      if (Math.random() < 0.07) {
        // A laugh: a run of "ha"s, falling.
        for (let k = 0; k < 5; k++) {
          this.syllable(v, t, 0.11, v.pitch * (1.5 - k * 0.07), loud * 1.2, 900);
          t += 0.16;
        }
      } else {
        const syllables = 3 + Math.floor(Math.random() * 10);
        let p = v.pitch * rand(0.95, 1.1);
        for (let k = 0; k < syllables; k++) {
          const len = rand(0.08, 0.2);
          p *= rand(0.94, 1.05);
          this.syllable(v, t, len, p, loud, rand(450, 1100));
          t += len + (Math.random() < 0.15 ? rand(0.15, 0.35) : rand(0.02, 0.06));
        }
      }
      v.next = t + rand(0.6, 3.5);
    });
  }

  private makeVoice(i: number): Voice {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    // A mix of deeper and higher voices.
    const pitch = i % 3 === 2 ? rand(190, 240) : rand(95, 150);
    osc.frequency.value = pitch;
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.Q.value = 4;
    formant.frequency.value = 700;
    const formant2 = ctx.createBiquadFilter();
    formant2.type = 'bandpass';
    formant2.Q.value = 6;
    formant2.frequency.value = 1500;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    // Far enough off that no one word comes through: muffle it.
    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 1800;
    osc.connect(formant).connect(gain);
    osc.connect(formant2).connect(gain);
    gain.connect(muffle).connect(this.dry);
    osc.start();
    return { osc, formant, formant2, gain, pitch, next: ctx.currentTime + Math.random() * 2 };
  }

  private syllable(v: Voice, t: number, len: number, pitch: number, loud: number, vowel: number): void {
    v.osc.frequency.setTargetAtTime(pitch, t, 0.02);
    v.formant.frequency.setTargetAtTime(vowel, t, 0.03);
    v.formant2.frequency.setTargetAtTime(vowel * rand(1.8, 2.6), t, 0.03);
    v.gain.gain.setTargetAtTime(loud, t, 0.02);
    v.gain.gain.setTargetAtTime(0, t + len * 0.75, 0.03);
  }

  /** A pot or tankard knocking on a table, or two mugs clinking. */
  private clink(t: number, level: number): void {
    if (Math.random() < 0.55) {
      const f = rand(2300, 3100);
      for (const [mul, v] of [[1, 1], [2.71, 0.5], [4.1, 0.25]]) this.ring(t, f * mul, 0.025 * level * v, 0.35);
      if (Math.random() < 0.4) for (const [mul, v] of [[1, 1], [2.71, 0.5]]) this.ring(t + 0.09, f * 1.07 * mul, 0.018 * level * v, 0.3);
    } else {
      this.knock(this.dry, t, rand(260, 420), 0.05 * level);
    }
  }

  /** The smith at work: a few ringing blows on the anvil. */
  private hammer(t0: number, level: number): void {
    const n = 2 + Math.floor(Math.random() * 4);
    const base = rand(1050, 1200);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * rand(0.42, 0.55);
      const v = 0.05 * level * (i === n - 1 ? 0.7 : 1);
      // An anvil's partials don't line up like a note's: that's what makes it clang.
      for (const [mul, a, d] of [[1, 1, 0.9], [2.32, 0.6, 0.6], [3.51, 0.45, 0.4], [5.17, 0.3, 0.25]]) this.ring(t, base * mul, v * a, d);
      this.noise(this.dry, t, 0.03, 'highpass', 3000, 3000, 0.7, v * 0.8);
    }
  }

  /** A stone shifting deep in the rock, or a pebble falling: a dull knock and a trickle, echoing. */
  private settle(t: number, level: number): void {
    this.thud(this.send, t, 70, 0.12 * level, 0.3);
    for (let i = 0; i < 4; i++) this.noise(this.send, t + 0.1 + i * rand(0.05, 0.12), 0.04, 'bandpass', 2400, 1600, 1, 0.04 * level);
  }

  private bellStroke(t: number, near: number): void {
    const base = 196;
    // The partials of a cast bell: hum, prime, minor third, fifth, octave.
    const partials: Array<[number, number, number]> = [[0.5, 0.5, 6], [1, 0.8, 4.5], [1.19, 0.45, 3], [1.5, 0.3, 2.5], [2, 0.35, 2], [2.66, 0.15, 1.2]];
    for (const [mul, a, d] of partials) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * mul;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06 * a * near, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(this.dry);
      g.connect(this.send);
      o.start(t);
      o.stop(t + d + 0.05);
    }
  }

  // ---------------------------------------------------------------- building blocks

  /** A sine (or other) tone gliding from one pitch to another, with a soft swell. */
  private tone(t: number, len: number, type: OscillatorType, from: number, to: number, peak: number, dest: AudioNode, attack = 0.01): void {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + len);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.min(attack, len * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  /** A single struck partial ringing away. */
  private ring(t: number, f: number, peak: number, decay: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(this.dry);
    o.start(t);
    o.stop(t + decay + 0.02);
  }

  /** A low, quickly falling thump: a foot coming down, a stone dropping. */
  private thud(dest: AudioNode, t: number, f: number, peak: number, len = 0.12): void {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, t + len);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, peak), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  /** A hollow wooden knock. */
  private knock(dest: AudioNode, t: number, f: number, peak: number): void {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.06);
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f * 2;
    band.Q.value = 3;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, peak), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(band).connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.09);
  }

  /** Filtered noise with a swell-and-fade, the filter sweeping from one frequency to another. */
  private noise(dest: AudioNode, t: number, len: number, type: BiquadFilterType, from: number, to: number, q: number, peak: number, buffer = this.white): void {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + len);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + len * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * Math.max(0, buffer.duration - len - 0.1));
    src.stop(t + len + 0.02);
  }

  /** Pink noise (soft, like wind) or brown noise (deeper still, like surf or a rumble). */
  private colouredNoise(seconds: number, colour: 'pink' | 'brown'): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const fade = Math.floor(rate * 0.05);
    const raw = new Float32Array(Math.floor(rate * seconds) + fade);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      if (colour === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        raw[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      } else {
        last = (last + 0.02 * w) / 1.02;
        raw[i] = last * 3.5;
      }
    }
    // Crossfade the extra tail into the start, so the loop joins without a click.
    const len = raw.length - fade;
    const buf = this.ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const k = i < fade ? i / fade : 1;
      d[i] = raw[i] * k + (i < fade ? raw[len + i] * (1 - k) : 0);
    }
    return buf;
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
