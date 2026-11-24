import Phaser from 'phaser';
import { ORB_PORTRAIT } from '../art/sizes';
import { GameAudio } from '../audio/Audio';
import { WHISPER_LINES, WHISPER_OPENING, WHISPER_VOICES, WHISPER_WAKING, WhisperLine } from '../dialogue/orbWhisper';
import { captionMs } from '../ui/CutSceneLayout';
import { UI_FONT } from '../ui/theme';
import { THEME, titleStyle } from '../ui/Widgets';

export interface OrbWhisperSceneData {
  /** Called once the last waking line has faded, with the screen left black. */
  onDone: () => void;
}

/** The orb's light, for the motes drifting into it and the glow behind it (its wheel, see art/orbPortrait.ts). */
const MOTE_COLOURS = [0x6a3ad0, 0xb040c8, 0xe060a8, 0xffa050, 0x40c0c8, 0x3050b8];
/** Characters typed per second, and a voice blip every this many. */
const TYPE_RATE = 34;
const BLIP_EVERY = 3;
/** Each of the dream's dim lines before and after, as in InterludeScene. */
const DIM_LINE_MS = 2300;

/**
 * The night after the beacon (see scenes/game/whisper.ts): asleep in the dark,
 * the orb in the satchel wakes and carries two voices from the other side of
 * it. Built like the prologue's ending (TitleCardScene, InterludeScene): black,
 * slow, a few lines at a time; but in the orb's own light, with its portrait
 * turning large in the middle of the screen and its colours drifting in.
 *
 * Any key or a tap finishes a line that's being typed, or moves on to the next.
 */
export class OrbWhisperScene extends Phaser.Scene {
  private opts!: OrbWhisperSceneData;
  private skipDim?: () => void;
  private orb!: Phaser.GameObjects.Image;
  private stir!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.Text;
  private lineText!: Phaser.GameObjects.Text;
  /** How much of the current line is shown, in characters, and the whole of it. */
  private shown = 0;
  private full = '';
  private line?: WhisperLine;
  private lineIndex = -1;
  /** How eager the orb is: 0 calm, 1 speaking, more as it leans in close. */
  private eager = 0;
  private stage: 'opening' | 'voices' | 'waking' | 'done' = 'opening';
  private advance?: Phaser.Time.TimerEvent;
  private orbScale = 1;
  private lastBlip = 0;

  constructor() {
    super('OrbWhisper');
  }

  create(data: OrbWhisperSceneData): void {
    this.opts = data;
    this.stage = 'opening';
    this.lineIndex = -1;
    this.eager = 0;
    this.line = undefined;
    const { width, height } = this.scale;
    const cx = width / 2;
    this.add.rectangle(0, 0, width, height, 0x000000, 1).setOrigin(0).setInteractive();
    GameAudio.playMusic('ruin', 3);
    GameAudio.duckAmbience(0.15, 2);

    // The orb, big in the middle and a little above it, so the words fit beneath.
    const orbY = height * (height > width ? 0.36 : 0.4);
    this.orbScale = Math.min(2.4, (Math.min(width * 0.8, height * 0.5)) / ORB_PORTRAIT.size);
    this.makeGlowTexture();
    this.glow = this.add.image(cx, orbY, 'orbwhisper-glow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.glow.setDisplaySize(ORB_PORTRAIT.size * this.orbScale * 2.2, ORB_PORTRAIT.size * this.orbScale * 2.2);
    this.orb = this.add.image(cx, orbY, ORB_PORTRAIT.key, 0).setScale(this.orbScale * 0.92).setAlpha(0);
    this.stir = this.add.image(cx, orbY, ORB_PORTRAIT.key, ORB_PORTRAIT.frames).setScale(this.orbScale * 0.92).setAlpha(0);
    // Drawn this big and smooth, the frame's outer pixel picks up its neighbour on the sheet: trim it.
    for (const img of [this.orb, this.stir]) img.setCrop(1, 1, ORB_PORTRAIT.size - 2, ORB_PORTRAIT.size - 2);
    this.tweens.add({ targets: [this.orb, this.stir], y: orbY - 6, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Motes of its light, drawn in from the dark towards the glass.
    this.time.addEvent({ delay: 140, loop: true, callback: () => this.mote(cx, orbY) });

    // The words: who's speaking, in gilt, and the line under it.
    const textY = orbY + (ORB_PORTRAIT.size * this.orbScale) / 2 + 18;
    const size = Math.round(Math.min(20, Math.max(15, width / 42)));
    this.nameText = this.add.text(cx, textY, '', { ...titleStyle(Math.round(size * 0.8)), align: 'center' }).setOrigin(0.5, 0).setAlpha(0);
    this.nameText.setLetterSpacing(3);
    this.lineText = this.add
      .text(cx, textY + size * 1.6, '', {
        fontFamily: UI_FONT,
        fontSize: `${size}px`,
        color: '#e6dcf2',
        fontStyle: 'italic',
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: Math.min(640, width - 48) },
        shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 6, fill: true },
      })
      .setOrigin(0.5, 0);

    this.dimLines(WHISPER_OPENING, () => this.beginVoices());
    // Hurry it on, though not straight away (so the key that put the hero to bed doesn't skip it).
    this.time.delayedCall(1200, () => {
      this.input.keyboard?.on('keydown', () => this.hurry());
      this.input.on('pointerup', () => this.hurry());
    });
  }

  update(time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const f = Math.floor((time / 1000) * ORB_PORTRAIT.fps * (1 + this.eager * 0.4)) % ORB_PORTRAIT.frames;
    this.orb.setFrame(f);
    this.stir.setFrame(ORB_PORTRAIT.frames + f);
    if (this.stage === 'voices' && this.line) {
      const speaking = this.shown < this.full.length;
      const want = (this.line.near ? 1.6 : 1) * (speaking ? 1 : 0.55);
      this.eager += (want - this.eager) * Math.min(1, dt * (want > this.eager ? 4 : 1.5));
      if (speaking) this.type(dt, time);
    } else if (this.stage !== 'voices') {
      this.eager += (0 - this.eager) * Math.min(1, dt * 1.5);
    }
    if (this.stage === 'voices') {
      this.stir.setAlpha(Math.min(1, this.eager) * this.orb.alpha);
      const s = this.orbScale * (1 + Math.max(0, this.eager - 1) * 0.18);
      this.orb.setScale(s);
      this.stir.setScale(s);
      this.glow.setAlpha(0.18 + this.eager * 0.22);
    }
  }

  /** A few dim lines in the dark, one under another, then `then`. */
  private dimLines(lines: string[], then: () => void): void {
    const { width, height } = this.scale;
    // Stacked by their real heights, since a long line wraps on a narrow (phone) screen.
    const gap = 10;
    const texts = lines.map((line) =>
      this.add
        .text(width / 2, 0, line, { fontFamily: UI_FONT, fontSize: '17px', color: '#d8cdb4', fontStyle: 'italic', align: 'center', wordWrap: { width: width - 48 } })
        .setOrigin(0.5, 0)
        .setAlpha(0),
    );
    const total = texts.reduce((h, t) => h + t.height, 0) + gap * (texts.length - 1);
    let y = this.stage === 'waking' ? height / 2 - total / 2 : height * 0.86 - total;
    for (const t of texts) {
      t.setY(y);
      y += t.height + gap;
    }
    texts.forEach((t, i) => this.tweens.add({ targets: t, alpha: 0.85, delay: 500 + i * DIM_LINE_MS, duration: 1100 }));
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      this.advance = undefined;
      this.tweens.add({ targets: texts, alpha: 0, duration: 900, onComplete: () => { texts.forEach((t) => t.destroy()); then(); } });
    };
    this.advance = this.time.delayedCall(500 + lines.length * DIM_LINE_MS + 1600, go);
    this.skipDim = go;
  }

  /** The orb comes up out of the dark, and the first voice speaks. */
  private beginVoices(): void {
    this.stage = 'voices';
    this.skipDim = undefined;
    GameAudio.whisper(2.4);
    this.tweens.add({ targets: this.orb, alpha: 1, scale: this.orbScale, duration: 2600, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: this.glow, alpha: 0.18, duration: 2600 });
    this.time.delayedCall(2200, () => this.nextLine());
  }

  private nextLine(): void {
    this.advance?.remove();
    this.advance = undefined;
    this.lineIndex++;
    const line = WHISPER_LINES[this.lineIndex];
    if (!line) {
      this.endVoices();
      return;
    }
    this.line = line;
    this.full = line.text;
    this.shown = 0;
    this.lastBlip = 0;
    const voice = line.voice ? WHISPER_VOICES[line.voice] : undefined;
    this.nameText.setText(voice ? voice.name.toUpperCase() : '');
    this.nameText.setColor(line.voice === 'other' ? '#b9a6d8' : THEME.goldText);
    this.nameText.setAlpha(0.9);
    this.lineText.setText('');
    this.lineText.setColor(line.near ? '#f4e6ff' : '#e6dcf2');
    if (line.near) {
      GameAudio.whisper(1.6);
      this.cameras.main.shake(900, 0.002);
    }
  }

  /** Types the line out, with the speaker's voice under it. */
  private type(dt: number, time: number): void {
    this.shown = Math.min(this.full.length, this.shown + dt * TYPE_RATE);
    const n = Math.floor(this.shown);
    this.lineText.setText(this.full.slice(0, n));
    const voice = this.line?.voice ? WHISPER_VOICES[this.line.voice] : undefined;
    if (voice && n - this.lastBlip >= BLIP_EVERY && /\w/.test(this.full[n - 1] ?? '') && time > 0) {
      this.lastBlip = n;
      GameAudio.voice(voice.pitch, voice.spread, voice.wave);
    }
    if (n >= this.full.length) this.lineTyped();
  }

  /** The whole line is up: hold it a while, then the next. */
  private lineTyped(): void {
    this.shown = this.full.length;
    this.lineText.setText(this.full);
    if (this.advance) return;
    this.advance = this.time.delayedCall(Math.max(1800, captionMs(this.full) - this.full.length * 20), () => this.nextLine());
  }

  /** The last line: the orb flares, close against the glass, and goes out. */
  private endVoices(): void {
    this.stage = 'waking';
    this.line = undefined;
    GameAudio.whisper(3);
    const { width, height } = this.scale;
    const flash = this.add.rectangle(0, 0, width, height, 0xd8c0ff, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: [this.orb, this.stir], scale: this.orbScale * 1.5, duration: 700, ease: 'Cubic.easeIn' });
    this.tweens.add({
      targets: flash,
      alpha: 0.85,
      duration: 650,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.orb.setVisible(false);
        this.stir.setVisible(false);
        this.glow.setVisible(false);
        this.nameText.setVisible(false);
        this.lineText.setVisible(false);
        this.tweens.add({ targets: flash, alpha: 0, duration: 1400 });
        GameAudio.stopMusic();
        this.time.delayedCall(1800, () => this.dimLines(WHISPER_WAKING, () => this.finish()));
      },
    });
  }

  private hurry(): void {
    if (this.stage === 'done') return;
    if (this.stage === 'voices' && this.line) {
      if (this.shown < this.full.length) this.lineTyped();
      else this.nextLine();
      return;
    }
    this.skipDim?.();
  }

  private finish(): void {
    if (this.stage === 'done') return;
    this.stage = 'done';
    GameAudio.duckAmbience(1, 1.5);
    this.scene.stop();
    this.opts.onDone();
  }

  /** One mote of the orb's light, drifting in from the dark and going into the glass. */
  private mote(cx: number, cy: number): void {
    if (this.stage === 'done' || !this.orb.visible) return;
    const { width, height } = this.scale;
    const a = Math.random() * Math.PI * 2;
    const r = Math.max(width, height) * Phaser.Math.FloatBetween(0.35, 0.6);
    const dot = this.add
      .circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Phaser.Math.FloatBetween(1.2, 3), Phaser.Utils.Array.GetRandom(MOTE_COLOURS), 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(-1);
    // A little sideways, so they swirl rather than fall straight in.
    const turn = a + Phaser.Math.FloatBetween(0.6, 1.2);
    const end = (ORB_PORTRAIT.size * this.orbScale) * 0.18;
    const duration = Phaser.Math.Between(4200, 7200) / (1 + this.eager * 0.6);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeIn',
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const ang = a + (turn - a) * t;
        const rad = r + (end - r) * t;
        dot.setPosition(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
        dot.setAlpha(Math.sin(t * Math.PI) * 0.8 * (0.5 + Math.min(1, this.eager) * 0.5));
      },
      onComplete: () => dot.destroy(),
    });
  }

  /** A soft round glow in the orb's violet, made once. */
  private makeGlowTexture(): void {
    if (this.textures.exists('orbwhisper-glow')) return;
    const tex = this.textures.createCanvas('orbwhisper-glow', 256, 256);
    if (!tex) return;
    const c = tex.getContext();
    const grad = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(170,90,255,1)');
    grad.addColorStop(0.4, 'rgba(110,50,200,0.45)');
    grad.addColorStop(1, 'rgba(40,10,90,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 256, 256);
    tex.refresh();
  }
}
