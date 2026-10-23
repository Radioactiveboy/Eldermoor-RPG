import { Settings, SettingsData } from '../settings/Settings';

/**
 * All game audio, generated live with the Web Audio API. There are no audio
 * files, so nothing to license: the music is composed here in code.
 *
 * Browsers only allow sound after the player clicks or presses a key, so the
 * engine starts silent and unlocks itself on the first input. Asking for a
 * track before then just remembers it and starts it on unlock.
 */

export type TrackName = 'menu' | 'world';

interface TrackDef {
  bpm: number;
  /** Chords in MIDI notes, each held for `barsPerChord` bars of 8 eighth-notes. */
  chords: number[][];
  barsPerChord: number;
  /** Indices into the current chord's notes (spread over two octaves); -1 = rest. */
  arp: number[];
  /** Scale the wandering melody picks from. */
  scale: number[];
  melodyChance: number;
  padCutoff: number;
}

// D minor / dorian: suits a quiet medieval-fantasy feel.
const TRACKS: Record<TrackName, TrackDef> = {
  menu: {
    bpm: 64,
    chords: [
      [50, 53, 57], // Dm
      [46, 50, 53], // Bb
      [48, 52, 55], // C
      [45, 48, 52], // Am
    ],
    barsPerChord: 2,
    arp: [0, 2, 4, 2, 5, 4, 2, -1],
    scale: [62, 64, 65, 67, 69, 71, 72, 74],
    melodyChance: 0.35,
    padCutoff: 900,
  },
  world: {
    bpm: 80,
    chords: [
      [50, 53, 57], // Dm
      [48, 52, 55], // C
      [53, 57, 60], // F
      [48, 52, 55], // C
      [46, 50, 53], // Bb
      [53, 57, 60], // F
      [45, 49, 52], // A
      [45, 49, 52], // A
    ],
    barsPerChord: 1,
    arp: [0, -1, 2, 3, -1, 2, 4, -1],
    scale: [62, 64, 65, 67, 69, 71, 72],
    melodyChance: 0.2,
    padCutoff: 700,
  },
};

const LOOKAHEAD_S = 0.4;
const TICK_MS = 50;

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

class Track {
  readonly out: GainNode;
  private step = 0;
  private nextTime: number;
  private melodyNote: number;
  private timer: number;

  constructor(
    private ctx: AudioContext,
    private def: TrackDef,
    dest: AudioNode,
    reverb: AudioNode,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.setTargetAtTime(1, ctx.currentTime, 1.0); // fade in
    this.out.connect(dest);
    this.out.connect(reverb);
    this.nextTime = ctx.currentTime + 0.1;
    this.melodyNote = def.scale[Math.floor(def.scale.length / 2)];
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  stop(fadeSeconds = 1.5): void {
    window.clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + fadeSeconds);
    window.setTimeout(() => this.out.disconnect(), (fadeSeconds + 4) * 1000);
  }

  private schedule(): void {
    const eighth = 60 / this.def.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(this.step, this.nextTime, eighth);
      this.step++;
      this.nextTime += eighth;
    }
  }

  private playStep(step: number, t: number, eighth: number): void {
    const { chords, barsPerChord, arp, scale, melodyChance, padCutoff } = this.def;
    const stepsPerChord = 8 * barsPerChord;
    const chord = chords[Math.floor(step / stepsPerChord) % chords.length];
    const inChord = step % stepsPerChord;

    if (inChord === 0) {
      const hold = stepsPerChord * eighth;
      this.drone(chord[0] - 12, t, hold);
      chord.forEach((n) => this.pad(n, t, hold, padCutoff));
    }

    const idx = arp[step % arp.length];
    if (idx >= 0) {
      const tones = [...chord, ...chord.map((n) => n + 12)];
      this.pluck(tones[idx % tones.length] + 12, t, 0.12);
    }

    // A slow wandering melody on the beat, stepping through the scale.
    if (step % 2 === 0 && Math.random() < melodyChance) {
      const i = scale.indexOf(this.melodyNote);
      const move = Math.random() < 0.5 ? -1 : 1;
      this.melodyNote = scale[Math.max(0, Math.min(scale.length - 1, i + move))];
      this.flute(this.melodyNote, t, eighth * 3);
    }
  }

  private envelope(t: number, attack: number, peak: number, release: number, length: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + Math.max(attack, length - release));
    g.gain.linearRampToValueAtTime(0, t + length);
    g.connect(this.out);
    return g;
  }

  private osc(type: OscillatorType, midi: number, t: number, length: number, dest: AudioNode, detune = 0): void {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq(midi);
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(t + length + 0.05);
  }

  private drone(midi: number, t: number, length: number): void {
    this.osc('sine', midi, t, length, this.envelope(t, 1.0, 0.18, 1.0, length));
  }

  private pad(midi: number, t: number, length: number, cutoff: number): void {
    const env = this.envelope(t, 1.5, 0.035, 1.5, length + 0.5);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    filter.connect(env);
    this.osc('sawtooth', midi, t, length + 0.5, filter, -6);
    this.osc('sawtooth', midi, t, length + 0.5, filter, 6);
  }

  /** Harp / lute-like pluck: quick attack, long decay. */
  private pluck(midi: number, t: number, peak: number): void {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    g.connect(this.out);
    this.osc('triangle', midi, t, 1.6, g);
    const shimmer = this.ctx.createGain();
    shimmer.gain.value = 0.25;
    shimmer.connect(g);
    this.osc('sine', midi + 12, t, 1.6, shimmer);
  }

  /** Soft breathy lead with a little vibrato. */
  private flute(midi: number, t: number, length: number): void {
    const env = this.envelope(t, 0.15, 0.06, 0.4, length);
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq(midi);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5;
    const depth = this.ctx.createGain();
    depth.gain.value = 4;
    lfo.connect(depth).connect(o.frequency);
    o.connect(env);
    o.start(t);
    lfo.start(t);
    o.stop(t + length + 0.05);
    lfo.stop(t + length + 0.05);
  }
}

class AudioEngine {
  private ctx?: AudioContext;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private reverb!: ConvolverNode;
  private track?: Track;
  private wanted?: TrackName;
  private playing?: TrackName;

  constructor() {
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchend', unlock);
    // Timers are throttled in background tabs, which would make the music
    // stutter, so pause audio entirely while the tab is hidden.
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
    Settings.onChange((s) => this.applyVolumes(s));
  }

  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Switches to a track (crossfading), or does nothing if it's already playing. */
  playMusic(name: TrackName): void {
    this.wanted = name;
    if (!this.unlocked || this.playing === name) return;
    this.track?.stop();
    this.track = new Track(this.ctx!, TRACKS[name], this.musicBus, this.reverb);
    this.playing = name;
  }

  stopMusic(): void {
    this.wanted = undefined;
    this.playing = undefined;
    this.track?.stop();
    this.track = undefined;
  }

  /** Short UI blip for button presses. */
  click(): void {
    this.blip(660, 990, 0.09, 0.25);
  }

  /** Very quiet tick for hovering over a button. */
  hover(): void {
    this.blip(1320, 1320, 0.03, 0.06);
  }

  private blip(from: number, to: number, length: number, peak: number): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + length);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + length + 0.02);
  }

  private unlock(): void {
    if (!this.ctx) this.build();
    const ctx = this.ctx!;
    const start = () => {
      if (this.wanted) this.playMusic(this.wanted);
    };
    if (ctx.state === 'running') start();
    else if (!document.hidden) void ctx.resume().then(start);
  }

  private build(): void {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(ctx, 2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    this.reverb.connect(wet).connect(this.musicBus);

    this.applyVolumes(Settings.get());
  }

  /** Decaying stereo noise: a cheap but convincing "stone hall" reverb. */
  private makeImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  private applyVolumes(s: SettingsData): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Squaring makes the sliders feel even: ears hear volume logarithmically.
    this.master.gain.setTargetAtTime(s.masterVolume ** 2, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.musicVolume ** 2, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.effectsVolume ** 2, t, 0.05);
  }
}

export const GameAudio = new AudioEngine();
