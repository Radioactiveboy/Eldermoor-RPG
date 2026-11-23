import { Settings, SettingsData } from '../settings/Settings';
import { AmbientMix, SILENCE, Soundscape, Surface } from './Soundscape';
import {
  BarkKind, FIGHT_SFX, MUSIC_FILES, RecordedTrack, SFX, SfxBank, VOICE_FILES, barkFor, barkVoice, foeVoice, musicFileFor,
} from './Recordings';

/**
 * All game audio, played with the Web Audio API. The music is recorded
 * (public/audio/music/, streamed when an area first wants it and crossfaded
 * by area and hour), and so are the fight sounds and the voice barks under
 * dialogue (public/audio/sfx/); see audio/Recordings.ts. The tunes composed
 * here in code stand in for any recording that fails to load, as do the
 * synthesised hits, swings and cries. UI blips are synthesised. The world's
 * background sounds, footsteps and the bell are recordings too (see
 * audio/Soundscape.ts and public/audio/ambience/CREDITS.md).
 *
 * Browsers only allow sound after the player clicks or presses a key, so the
 * engine starts silent and unlocks itself on the first input. Asking for a
 * track before then just remembers it and starts it on unlock.
 */

export type TrackName = 'menu' | 'world' | 'woods' | 'home' | 'battle' | 'market' | 'cave' | 'monastery' | 'tavern' | 'raid' | 'ruin' | 'mourning';

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
  /**
   * Hand drum and tambourine, one character per eighth note: 'X' a loud drum
   * beat, 'x' a soft one, 'j' a jingle, '.' nothing. Loops independently.
   */
  drums?: string;
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
  // The north woods: slow and hushed under the trees, wandering between E minor and its neighbours.
  woods: {
    bpm: 62,
    chords: [
      [40, 47, 52], // Em
      [36, 43, 48], // C
      [38, 45, 50], // D
      [40, 47, 52], // Em
      [43, 47, 50], // G
      [38, 42, 45], // D
    ],
    barsPerChord: 2,
    arp: [0, -1, -1, 2, -1, 1, -1, -1],
    scale: [64, 66, 67, 69, 71, 72, 74, 76],
    melodyChance: 0.18,
    padCutoff: 560,
  },
  // Slow and low by the fire: a little sadder, for Mother's sickbed.
  home: {
    bpm: 56,
    chords: [
      [45, 48, 52], // Am
      [41, 45, 48], // F
      [43, 47, 50], // G
      [40, 44, 47], // E
    ],
    barsPerChord: 2,
    arp: [0, -1, 2, -1, 4, -1, 2, -1],
    scale: [57, 59, 60, 62, 64, 65, 67, 69],
    melodyChance: 0.25,
    padCutoff: 600,
  },
  // The goblins at the door: a pounding war drum under a low, grinding drone.
  raid: {
    bpm: 132,
    chords: [
      [38, 41, 45], // Dm
      [37, 40, 44], // C# dim
      [38, 41, 45],
      [39, 43, 46], // Eb
    ],
    barsPerChord: 1,
    arp: [0, -1, 0, 3, -1, 0, 5, -1],
    scale: [62, 63, 65, 66, 69, 70, 72],
    melodyChance: 0.1,
    padCutoff: 420,
    drums: 'X.x.X.xxX.x.X.Xx',
  },
  // After: the cottage in ashes. Very slow, sparse, and low.
  ruin: {
    bpm: 44,
    chords: [
      [45, 48, 52], // Am
      [41, 44, 48], // Fm, darker than home's F
      [40, 43, 47], // Em
      [45, 48, 52],
    ],
    barsPerChord: 2,
    arp: [0, -1, -1, 2, -1, -1, -1, -1],
    scale: [57, 59, 60, 62, 64, 65, 68],
    melodyChance: 0.12,
    padCutoff: 420,
  },
  // The Hollow after the raid: the outdoor tune's D minor, slowed right down and emptied out, with nothing to lift it.
  mourning: {
    bpm: 50,
    chords: [
      [50, 53, 57], // Dm
      [46, 50, 53], // Bb
      [43, 46, 50], // Gm
      [45, 48, 52], // Am, never resolving to the A major of the old tune
    ],
    barsPerChord: 2,
    arp: [0, -1, -1, 2, -1, -1, 1, -1],
    scale: [62, 64, 65, 67, 69, 70, 72],
    melodyChance: 0.1,
    padCutoff: 480,
  },
  // A fight: quicker, darker and restless, rocking between D minor and its neighbours.
  battle: {
    bpm: 118,
    chords: [
      [38, 45, 50], // Dm (low)
      [38, 45, 50],
      [39, 46, 51], // Eb, a tense half-step up
      [37, 44, 49], // C# diminished-ish, pulling back home
    ],
    barsPerChord: 1,
    arp: [0, 0, 3, 0, 4, 0, 3, 5],
    scale: [62, 63, 65, 67, 69, 70, 73, 74],
    melodyChance: 0.15,
    padCutoff: 500,
  },
  // Market day: a bright, bouncing G major dance with a frame drum and tambourine.
  market: {
    bpm: 104,
    chords: [
      [55, 59, 62], // G
      [48, 52, 55], // C
      [55, 59, 62], // G
      [50, 54, 57], // D
      [52, 55, 59], // Em
      [48, 52, 55], // C
      [50, 54, 57], // D
      [55, 59, 62], // G
    ],
    barsPerChord: 1,
    arp: [0, 2, 4, 2, 3, 2, 4, 5],
    scale: [67, 69, 71, 72, 74, 76, 78, 79],
    melodyChance: 0.45,
    padCutoff: 1100,
    drums: 'X.jxX.jj',
  },
  // The wolves' cave: very slow, low and sparse, hanging on an unresolved E phrygian.
  cave: {
    bpm: 44,
    chords: [
      [40, 47, 52], // E5
      [41, 48, 53], // F, a half-step of dread
      [40, 47, 52],
      [38, 45, 50], // D5
    ],
    barsPerChord: 2,
    arp: [0, -1, -1, 3, -1, -1, 1, -1],
    scale: [64, 65, 67, 69, 71, 72, 74],
    melodyChance: 0.1,
    padCutoff: 380,
  },
  // Outside Saint Elda's: slow and still like plainchant, open fifths in D dorian with a wandering line over them.
  monastery: {
    bpm: 52,
    chords: [
      [38, 45, 50], // D5
      [36, 43, 48], // C5
      [38, 45, 50],
      [41, 48, 53], // F5
      [43, 50, 55], // G5
      [38, 45, 50],
    ],
    barsPerChord: 2,
    arp: [0, -1, -1, 2, -1, -1, 1, -1],
    scale: [62, 64, 65, 67, 69, 71, 72, 74],
    melodyChance: 0.5,
    padCutoff: 650,
  },
  // The Crooked Tankard: a rollicking jig in A dorian, with the drum thumping on every beat like boots on the boards.
  tavern: {
    bpm: 126,
    chords: [
      [45, 52, 57], // Am
      [43, 50, 55], // G
      [45, 52, 57], // Am
      [50, 54, 57], // D
      [45, 52, 57], // Am
      [43, 50, 55], // G
      [41, 48, 53], // F
      [40, 47, 52], // E
    ],
    barsPerChord: 1,
    arp: [0, 2, 1, 3, 2, 1, 4, 2],
    scale: [69, 71, 72, 74, 76, 78, 79, 81],
    melodyChance: 0.55,
    padCutoff: 1000,
    drums: 'X.jX.jXj',
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
  /** White noise for the tambourine, made the first time it's needed. */
  private noise?: AudioBuffer;

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
    const { chords, barsPerChord, arp, scale, melodyChance, padCutoff, drums } = this.def;
    if (drums) {
      const hit = drums[step % drums.length];
      if (hit === 'X' || hit === 'x') this.drum(t, hit === 'X' ? 0.3 : 0.16);
      else if (hit === 'j') this.jingle(t);
    }
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

  /** A frame drum: a low, quickly falling thump. */
  private drum(t: number, peak: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.12);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.3);
  }

  /** Tambourine: a short burst of bright, high noise. */
  private jingle(t: number): void {
    if (!this.noise) {
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 + Math.random() * 0.05);
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + 0.2);
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
  private ambienceBus!: GainNode;
  private soundscape?: Soundscape;
  /** The world sounds asked for, kept until the engine unlocks. */
  private ambience: AmbientMix = { ...SILENCE };
  private ambienceDuck = 1;
  private reverb!: ConvolverNode;
  private noiseBuffer!: AudioBuffer;
  private track?: Track;
  private recorded?: RecordedTrack;
  private sfx?: SfxBank;
  private wanted?: TrackName;
  /** What's playing: a recording's file name, or `synth:<track>` for a composed tune. */
  private playing?: string;
  /** Recordings that failed to load; their tracks fall back to the composed tunes. */
  private readonly broken = new Set<string>();
  /** The in-game hour, which picks day or night music. */
  private hour = 12;
  private musicTimer = 0;
  private musicFade = 2.5;
  /** A cut-scene has the music held (see holdMusic): what's asked for meanwhile waits until it's let go. */
  private held = false;
  private afterHold?: { name: TrackName; fade: number };

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
      this.recorded?.setPaused(document.hidden);
    });
    Settings.onChange((s) => this.applyVolumes(s));
  }

  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  /** Switches to a track (crossfading), or does nothing if it's already playing. */
  playMusic(name: TrackName, fade = 2.5): void {
    if (this.held) {
      this.afterHold = { name, fade };
      return;
    }
    this.wanted = name;
    this.musicFade = fade;
    // Wait a moment before choosing, so that on entering an area the world can
    // say the hour first and the night tune doesn't start out as the day one.
    if (!this.unlocked || this.musicTimer) return;
    this.musicTimer = window.setTimeout(() => {
      this.musicTimer = 0;
      if (this.wanted) this.switchMusic(this.wanted, this.musicFade);
    }, 150);
  }

  private switchMusic(name: TrackName, fade: number): void {
    const file = musicFileFor(MUSIC_FILES[name], this.hour);
    const want = this.broken.has(file) ? `synth:${name}` : file;
    if (this.playing === want) return;
    this.track?.stop();
    this.track = undefined;
    this.recorded?.stop(fade);
    this.recorded = undefined;
    this.playing = want;
    if (want.startsWith('synth:')) {
      this.track = new Track(this.ctx!, TRACKS[name], this.musicBus, this.reverb);
    } else {
      this.recorded = new RecordedTrack(this.ctx!, file, this.musicBus, fade, () => {
        this.broken.add(file);
        if (this.playing === file) {
          this.playing = undefined;
          if (this.wanted) this.switchMusic(this.wanted, 1);
        }
      });
    }
    // A fight's sounds are wanted as soon as its music starts.
    if (name === 'battle') this.sfx?.preload(FIGHT_SFX);
  }

  /**
   * For a cut-scene: plays this track (or keeps what's playing) and holds it
   * there, so walking into another area or the hour turning doesn't change it,
   * until releaseMusic().
   */
  holdMusic(name?: TrackName, fade = 2.5): void {
    this.held = false;
    if (name) this.playMusic(name, fade);
    this.afterHold = undefined;
    this.held = true;
  }

  /** Lets the music go again after a cut-scene: whatever was asked for meanwhile plays now. */
  releaseMusic(): void {
    if (!this.held) return;
    this.held = false;
    const next = this.afterHold;
    this.afterHold = undefined;
    if (next) this.playMusic(next.name, next.fade);
  }

  stopMusic(): void {
    this.held = false;
    this.afterHold = undefined;
    this.wanted = undefined;
    window.clearTimeout(this.musicTimer);
    this.musicTimer = 0;
    this.playing = undefined;
    this.track?.stop();
    this.track = undefined;
    this.recorded?.stop(1.5);
    this.recorded = undefined;
  }

  /** Tells the music the in-game hour, so a place's day tune gives way to its night one. */
  setHour(hour: number): void {
    this.hour = hour;
    if (!this.held && this.wanted && this.unlocked && this.recorded) {
      const file = musicFileFor(MUSIC_FILES[this.wanted], hour);
      if (file !== this.playing && !this.broken.has(file) && !this.musicTimer) this.switchMusic(this.wanted, 6);
    }
  }

  /** Sets how much of each background sound the world should have (see audio/Soundscape.ts). */
  setAmbience(mix: AmbientMix): void {
    this.ambience = mix;
    this.soundscape?.setMix(mix);
  }

  /** Turns the world's background sounds down (1 = normal, 0 = silent), e.g. in a fight or a menu. */
  duckAmbience(level: number, seconds = 0.6): void {
    this.ambienceDuck = level;
    this.soundscape?.setDuck(level, seconds);
  }

  /** Silences the world's background sounds, e.g. on leaving for the main menu. */
  stopAmbience(): void {
    this.setAmbience({ ...SILENCE });
  }

  /** One of the hero's footsteps. `loud` is 1 for walking, lower creeping, higher running. */
  footstep(surface: Surface, loud = 1): void {
    if (!this.unlocked) return;
    this.soundscape!.footstep(surface, loud, this.sfxBus);
  }

  /** A church bell tolling `strokes` times; `near` 0..1 for how close the tower is. */
  bell(strokes: number, near = 0.6): void {
    if (!this.unlocked) return;
    this.soundscape!.bell(strokes, near);
  }

  /** A clap of thunder, `delay` seconds after the lightning (see Soundscape.thunder). */
  thunder(delay: number, near: number, muffled = 0): void {
    if (!this.unlocked) return;
    this.soundscape!.thunder(delay, near, muffled);
  }

  /** Short UI blip for button presses. */
  click(): void {
    this.blip(660, 990, 0.09, 0.25);
  }

  /** Very quiet tick for hovering over a button. */
  hover(): void {
    this.blip(1320, 1320, 0.03, 0.06);
  }

  /**
   * One syllable of "voice" while dialogue types out: a short vowel-ish blip
   * around the speaker's pitch, varied a little so it sounds like mumbling speech.
   */
  voice(pitch: number, spread: number, wave: OscillatorType): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const f = pitch * (1 + (Math.random() * 2 - 1) * spread);
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * (Math.random() < 0.5 ? 0.92 : 1.06), t + 0.07);
    // A formant-ish band-pass makes it sound more like a voice than a beep.
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = 700 + Math.random() * 900;
    formant.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(formant).connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.1);
  }

  /**
   * A short recorded bark as someone starts speaking: a friendly "heh", a
   * laugh or a grunt, in one of four voices pitched to suit the speaker.
   * Played under the typing blips, and only if the recording is loaded.
   */
  bark(name: string, pitch: number, wave: OscillatorType, line: string, kind?: BarkKind): void {
    if (!this.unlocked) return;
    // Stage directions, like "(He nods.)", aren't spoken.
    if (/^[(*]/.test(line.trim())) return;
    const { voice, rate } = barkVoice(name, pitch);
    const k = kind ?? barkFor(line, wave, pitch);
    this.sfx!.play([`voice-${voice}-${k}`], { gain: 0.55, rate: [rate * 0.98, rate * 1.02] });
  }

  /** Paper swishing past: a page of the journal turning. */
  pageTurn(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.32, 'bandpass', 900, 3800, 0.9, 0.5);
    this.noise(t + 0.2, 0.12, 'highpass', 2500, 2500, 0.7, 0.25); // the page settling
  }

  /** The journal's heavy cover thumping open or shut. */
  bookOpen(): void {
    this.thump(0);
    if (this.unlocked) this.noise(this.ctx!.currentTime + 0.05, 0.25, 'bandpass', 1200, 2600, 0.8, 0.3);
  }

  bookClose(): void {
    if (this.unlocked) this.noise(this.ctx!.currentTime, 0.12, 'bandpass', 2600, 1200, 0.8, 0.25);
    this.thump(0.1);
  }

  /** Bright rising arpeggio for a new quest or a finished step. */
  questChime(): void {
    if (!this.unlocked) return;
    [74, 77, 81, 86].forEach((n, i) => this.pluckNote(n, this.ctx!.currentTime + i * 0.09, 0.16));
  }

  /** Wooden door: a creak then a soft knock as it shuts. */
  door(): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t);
    o.frequency.linearRampToValueAtTime(230, t + 0.35);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.08);
    g.gain.linearRampToValueAtTime(0, t + 0.4);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.45);
    this.thump(0.4);
  }

  /** A locked door tried: two dull knocks as it catches on the bolt, and the lock clinking. */
  rattle(): void {
    this.thump(0);
    this.thump(0.16);
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    this.noise(t + 0.02, 0.05, 'highpass', 4200, 5200, 0.8, 0.14);
    this.noise(t + 0.18, 0.05, 'highpass', 3800, 4800, 0.8, 0.12);
  }

  /** Leaves and stalks rustling: picking crops, shaking a tree. */
  rustle(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < 4; i++) this.noise(t + i * 0.22 + Math.random() * 0.08, 0.18, 'bandpass', 2400, 4200, 1.2, 0.18);
  }

  /** Something going into the satchel: a soft pluck and a little rising note. */
  pickup(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    this.pluckNote(79, t, 0.12);
    this.pluckNote(86, t + 0.08, 0.1);
  }

  /** Coins changing hands: a few bright metallic clinks. */
  coins(): void {
    if (!this.unlocked) return;
    const t0 = this.ctx!.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.07 + Math.random() * 0.02;
      this.pluckNote(96 + Math.floor(Math.random() * 4), t, 0.07);
      this.noise(t, 0.04, 'highpass', 5000, 7000, 0.7, 0.12);
    }
  }

  /** A bite of food. */
  crunch(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.08, 'highpass', 1500, 900, 0.7, 0.3);
    this.noise(t + 0.16, 0.07, 'highpass', 1400, 800, 0.7, 0.22);
  }

  /** A swallow of something to drink: a low glug, then another. */
  gulp(): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.22;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(260, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g).connect(this.sfxBus);
      o.start(t);
      o.stop(t + 0.16);
    }
  }

  /** A rat's thin squeak. */
  squeak(): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(2600, t);
    o.frequency.linearRampToValueAtTime(3400, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(2200, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.16);
  }

  /** A single pop from the fire. */
  crackle(): void {
    if (!this.unlocked) return;
    this.noise(this.ctx!.currentTime, 0.03 + Math.random() * 0.03, 'highpass', 1800, 1800, 0.5, 0.05 + Math.random() * 0.08);
  }

  /** A low, rattling snarl. */
  growl(): void {
    if (!this.unlocked) return;
    if (this.sfx!.play(SFX.snarl, { gain: 0.8, rate: [0.68, 0.8] })) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(95, t + 0.5);
    o.frequency.linearRampToValueAtTime(60, t + 0.9);
    // A fast wobble on the volume gives the throat-rattle.
    const rattle = ctx.createOscillator();
    rattle.frequency.value = 23;
    const depth = ctx.createGain();
    depth.gain.value = 0.09;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 520;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.15);
    g.gain.linearRampToValueAtTime(0, t + 0.95);
    rattle.connect(depth).connect(g.gain);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t);
    rattle.start(t);
    o.stop(t + 1);
    rattle.stop(t + 1);
  }

  /** A goblin's shriek: a harsh, wavering cry, rising then cracking. The Brute's is a deep bellow. */
  shriek(big = false): void {
    if (!this.unlocked) return;
    const takes = big ? (Math.random() < 0.5 ? SFX.bruteLaugh : SFX.brute) : Math.random() < 0.4 ? SFX.goblinLaugh : SFX.goblin;
    if (this.sfx!.play(takes, { gain: 0.7, rate: big ? [0.95, 1.05] : [1.3, 1.5] })) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const base = big ? 150 : 520 + Math.random() * 260;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * 1.6, t + 0.12);
    o.frequency.linearRampToValueAtTime(base * 0.9, t + (big ? 0.6 : 0.34));
    // A fast warble on the pitch: the cackle in it.
    const warble = ctx.createOscillator();
    warble.frequency.value = big ? 11 : 17;
    const depth = ctx.createGain();
    depth.gain.value = base * 0.12;
    warble.connect(depth).connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = big ? 600 : 1500;
    f.Q.value = 1.4;
    const g = ctx.createGain();
    const len = big ? 0.7 : 0.4;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(big ? 0.22 : 0.12, t + 0.03);
    g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t);
    warble.start(t);
    o.stop(t + len + 0.05);
    warble.stop(t + len + 0.05);
  }

  /** A goblin war horn: a long, rough, falling blast. */
  warHorn(): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (const [freq, peak] of [[98, 0.16], [147, 0.08], [196, 0.04]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq * 0.9, t);
      o.frequency.linearRampToValueAtTime(freq, t + 0.25);
      o.frequency.linearRampToValueAtTime(freq * 0.86, t + 1.6);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.2);
      g.gain.setValueAtTime(peak, t + 1.2);
      g.gain.linearRampToValueAtTime(0, t + 1.7);
      o.connect(f).connect(g).connect(this.sfxBus);
      if (this.reverb) g.connect(this.reverb);
      o.start(t);
      o.stop(t + 1.8);
    }
  }

  /** Something heavy splintering: a door broken in. */
  smash(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    this.thump(0);
    this.thump(0.03);
    this.noise(t, 0.35, 'lowpass', 2400, 300, 0.7, 0.7);
    for (let i = 0; i < 5; i++) this.noise(t + 0.05 + i * 0.06, 0.05, 'highpass', 2600, 1800, 0.9, 0.25);
  }

  /** A heavy blow on a barred door. */
  bang(): void {
    if (!this.unlocked) return;
    this.thump(0);
    this.noise(this.ctx!.currentTime, 0.12, 'lowpass', 900, 200, 0.7, 0.5);
  }

  /** Something swung quickly through the air. */
  swing(heavy = false): void {
    if (!this.unlocked) return;
    if (this.sfx!.play(heavy ? SFX.swoosh : SFX.whoosh.slice(3), { gain: heavy ? 0.55 : 0.4 })) return;
    this.noise(this.ctx!.currentTime, heavy ? 0.32 : 0.2, 'bandpass', heavy ? 500 : 900, heavy ? 2200 : 3200, 1.5, heavy ? 0.5 : 0.35);
  }

  /** A blow landing: a dull thud with a crack on top. Louder for critical hits. */
  hit(crit = false, heavy = false): void {
    if (!this.unlocked) return;
    if (crit) {
      if (this.sfx!.play(SFX.crit, { gain: 1 })) {
        this.sfx!.play(SFX.crack, { gain: 0.6, delay: 0.03 });
        return;
      }
    } else if (this.sfx!.play(heavy ? SFX.hitHeavy : SFX.hit, { gain: 0.85 })) {
      return;
    }
    this.thump(0);
    this.noise(this.ctx!.currentTime, 0.09, 'lowpass', 1800, 300, 0.8, crit ? 0.8 : 0.45);
    if (crit) this.thump(0.06);
  }

  /** A blow that misses: it whistles past. */
  miss(): void {
    if (!this.unlocked) return;
    if (this.sfx!.play(SFX.whoosh.slice(0, 3), { gain: 0.6, rate: [0.85, 1] })) return;
    this.noise(this.ctx!.currentTime, 0.26, 'bandpass', 700, 2600, 1.4, 0.35);
  }

  /** A blow turned aside by a shield: a ringing clang. */
  block(): void {
    if (!this.unlocked) return;
    if (this.sfx!.play(Math.random() < 0.25 ? SFX.clash : SFX.block, { gain: 0.75 })) return;
    const t = this.ctx!.currentTime;
    this.pluckNote(88, t, 0.12);
    this.pluckNote(95, t, 0.06);
    this.noise(t, 0.08, 'highpass', 3000, 2000, 0.8, 0.3);
  }

  /** The hero crying out as a blow lands. */
  hurt(): void {
    if (!this.unlocked) return;
    this.sfx!.play(SFX.heroHurt, { gain: 0.55, rate: [0.97, 1.03], delay: 0.05 });
  }

  /** A foe crying out as it's hurt, in its own voice (`kind` is its FOES key). */
  cry(kind: string): void {
    if (!this.unlocked) return;
    const v = foeVoice(kind);
    const s = this.sfx!;
    if (v === 'goblin' || v === 'brute') this.shriek(v === 'brute');
    else if (v === 'wolf') {
      if (!s.play(SFX.snarl, { gain: 0.7, rate: [0.95, 1.1] })) this.yelp();
    } else if (v === 'boar') {
      if (!s.play(SFX.pig, { gain: 0.65, rate: [0.62, 0.72] })) this.yelp();
    } else if (v === 'man') s.play(SFX.manHurt, { gain: 0.6 });
    else this.yelp();
  }

  /** A foe's last cry and the thud of it falling (`kind` is its FOES key), or the hero's if none. */
  death(kind?: string): void {
    if (!this.unlocked) return;
    const v = kind ? foeVoice(kind) : 'hero';
    const s = this.sfx!;
    if (v === 'goblin') s.play(SFX.goblinDeath, { gain: 0.7, rate: [1.3, 1.45] });
    else if (v === 'brute') s.play(SFX.bruteDeath, { gain: 0.8 });
    else if (v === 'man' || v === 'hero') s.play(SFX.manDeath, { gain: 0.6 });
    else if (v === 'boar') s.play(SFX.pig, { gain: 0.6, rate: [0.5, 0.56] });
    else if (v === 'wolf' && !s.play(SFX.snarl, { gain: 0.5, rate: [0.55, 0.6] })) this.yelp();
    else if (v === 'small') this.yelp();
    if (!s.play(SFX.thud, { gain: 0.7, lowpass: 900, delay: 0.45, rate: [0.7, 0.8] })) this.thump(0.45);
  }

  /** Jaws snapping shut. */
  bite(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.05, 'highpass', 2200, 1400, 0.9, 0.45);
    this.noise(t + 0.07, 0.05, 'highpass', 2000, 1200, 0.9, 0.35);
  }

  /** A wolf's yelp of pain: a sharp falling cry. */
  yelp(): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1300, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.3);
  }

  /** A die clattering across a table. */
  dice(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < 5; i++) this.noise(t + i * 0.07 + Math.random() * 0.03, 0.03, 'highpass', 3000, 2400, 0.6, 0.18 - i * 0.025);
  }

  /** Bright fanfare for winning a fight. */
  victory(): void {
    if (!this.unlocked) return;
    if (this.sfx!.play(SFX.victory, { gain: 0.6, rate: [1, 1] })) return;
    const t = this.ctx!.currentTime;
    [62, 66, 69, 74].forEach((n, i) => this.pluckNote(n, t + i * 0.12, 0.18));
    this.pluckNote(78, t + 0.5, 0.2);
  }

  /** Rising run of notes and a held top one, for gaining a level. */
  levelUp(): void {
    if (!this.unlocked) return;
    if (this.sfx!.play(SFX.levelUp, { gain: 0.65, rate: [1, 1] })) return;
    const t = this.ctx!.currentTime;
    [67, 71, 74, 79, 83].forEach((n, i) => this.pluckNote(n, t + i * 0.08, 0.17));
    this.pluckNote(86, t + 0.45, 0.2);
    this.pluckNote(79, t + 0.45, 0.14);
  }

  /** Slow falling notes for being beaten. */
  defeat(): void {
    if (!this.unlocked) return;
    if (this.sfx!.play(SFX.defeat, { gain: 0.6, rate: [1, 1] })) return;
    const t = this.ctx!.currentTime;
    [69, 65, 62, 57].forEach((n, i) => this.pluckNote(n, t + i * 0.3, 0.16));
  }

  /** A songbird somewhere nearby: a few quick, high, falling whistles. */
  chirp(): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const base = 2600 + Math.random() * 1400;
    const notes = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < notes; i++) {
      const t = t0 + i * (0.09 + Math.random() * 0.05);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * (1 + Math.random() * 0.15), t);
      o.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.06);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g).connect(this.sfxBus);
      o.start(t);
      o.stop(t + 0.08);
    }
  }

  /** A hen muttering to herself: a few short, nasal "buk" notes, the last drawn out and rising. */
  cluck(volume = 1): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t0 = ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 3);
    const base = 480 + Math.random() * 160;
    for (let i = 0; i < notes; i++) {
      const last = i === notes - 1;
      const t = t0 + i * 0.12;
      const len = last ? 0.16 : 0.05;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(base * (last ? 1.1 : 1), t);
      o.frequency.linearRampToValueAtTime(base * (last ? 1.5 : 0.85), t + len);
      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.value = 1200;
      formant.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06 * volume, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(formant).connect(g).connect(this.sfxBus);
      o.start(t);
      o.stop(t + len + 0.02);
    }
  }

  /** A drop of water falling into a puddle somewhere in the cave: a short rising bloop, echoing. */
  drip(volume = 1): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const base = 900 + Math.random() * 700;
    o.type = 'sine';
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * 2.2, t + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * volume, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(this.sfxBus);
    g.connect(this.reverb);
    o.start(t);
    o.stop(t + 0.1);
  }

  /** Something going into the water: a cast float plopping in (small), or a fish thrashing at the surface (big). */
  splash(big = false): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    this.noise(t, big ? 0.35 : 0.14, 'bandpass', big ? 900 : 1400, big ? 500 : 900, 0.9, big ? 0.22 : 0.12);
    this.drip(big ? 0.9 : 0.6);
    if (big) for (let i = 1; i < 4; i++) this.noise(t + i * 0.09 + Math.random() * 0.04, 0.08, 'bandpass', 1600, 1100, 1, 0.08);
  }

  /** The reel's ratchet clicking as the line comes in. */
  reel(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < 4; i++) this.noise(t + i * 0.035, 0.012, 'highpass', 4200, 4200, 1, 0.1);
  }

  /** Little wings beating as birds take off. */
  flutter(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < 5; i++) this.noise(t + i * 0.045, 0.04, 'bandpass', 900, 1400, 1.5, 0.06);
  }

  /** A bubble rising and popping in a pot or a still. */
  bubble(): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = 300 + Math.random() * 300;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.1);
  }

  /** Meat sizzling in a hot pan: a burst of hissing fat. */
  sizzle(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.5 + Math.random() * 0.4, 'highpass', 5200, 3800, 0.6, 0.08);
    for (let i = 0; i < 3; i++) this.noise(t + Math.random() * 0.5, 0.03, 'highpass', 3000, 3000, 0.5, 0.06 + Math.random() * 0.05);
  }

  /** A spoon going round a pot. */
  stir(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.28, 'bandpass', 700, 1500, 2, 0.18);
  }

  /** Something wonderful made: a shimmering run up and a bright chord. */
  sparkle(): void {
    if (!this.unlocked) return;
    const t = this.ctx!.currentTime;
    [72, 76, 79, 84, 88, 91].forEach((n, i) => this.pluckNote(n, t + i * 0.06, 0.13));
    [84, 88, 91].forEach((n) => this.pluckNote(n, t + 0.45, 0.1));
    this.noise(t + 0.1, 0.6, 'highpass', 6000, 9000, 0.7, 0.05);
  }

  /** A dull "no": that won't work. */
  fizzle(): void {
    this.blip(220, 140, 0.18, 0.18);
  }

  private thump(delay: number): void {
    if (!this.unlocked) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.15);
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.22);
  }

  /** Filtered white noise with a swell-and-fade envelope; the filter sweeps from one frequency to another. */
  private noise(t: number, length: number, type: BiquadFilterType, from: number, to: number, q: number, peak: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + length * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + length + 0.02);
  }

  private pluckNote(midi: number, t: number, peak: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq(midi);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.95);
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
    this.ambienceBus = ctx.createGain();
    this.ambienceBus.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(ctx, 2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    this.reverb.connect(wet).connect(this.musicBus);

    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.soundscape = new Soundscape(ctx, this.ambienceBus);
    this.soundscape.setMix(this.ambience);
    this.soundscape.setDuck(this.ambienceDuck, 0.1);

    this.sfx = new SfxBank(ctx, this.sfxBus);
    // Small, and wanted whenever anyone speaks or a level is gained.
    this.sfx.preload([...VOICE_FILES, ...SFX.levelUp, ...SFX.victory, ...SFX.defeat]);

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
    this.ambienceBus.gain.setTargetAtTime(s.ambienceVolume ** 2, t, 0.05);
  }
}

export const GameAudio = new AudioEngine();
