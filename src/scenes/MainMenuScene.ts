import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { MAP_HEIGHT, MAP_SEED, MAP_WIDTH } from '../config';
import { IsoMap } from '../world/IsoMap';
import { generateMap } from '../world/MapGenerator';
import { bodyStyle, makeButton, THEME, titleStyle } from '../ui/Widgets';
import { openSettings } from './SettingsScene';

/**
 * Title screen. The real world map drifts slowly behind a darkened veil, with
 * fireflies floating over it, so the menu previews the game's look.
 */
export class MainMenuScene extends Phaser.Scene {
  private veil!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Container;
  private soundHint!: Phaser.GameObjects.Text;
  private fireflies!: Phaser.GameObjects.Particles.ParticleEmitter;
  /** The main camera drifts over the map; this one stays still and draws the menu on top. */
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private leaving = false;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.leaving = false;
    this.buildBackdrop();
    const backdrop = [...this.children.list];
    this.buildOverlay();
    this.buildUi();
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore(backdrop);
    this.cameras.main.ignore([this.veil, this.fireflies, this.ui]);
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

    this.input.keyboard!.on('keydown-ENTER', () => this.startGame());
    GameAudio.playMusic('menu');
    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.uiCam.fadeIn(800, 0, 0, 0);
  }

  update(): void {
    this.soundHint.setVisible(!GameAudio.unlocked);
  }

  private buildBackdrop(): void {
    const map = new IsoMap(this, generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED));
    const b = map.getWorldBounds();
    const cam = this.cameras.main;
    cam.setBounds(b.x, b.y, b.width, b.height);
    cam.centerOn(b.centerX - b.width * 0.2, b.centerY);
    // Slow back-and-forth drift across the land.
    this.tweens.add({
      targets: cam,
      scrollX: cam.scrollX + b.width * 0.4,
      scrollY: cam.scrollY - b.height * 0.1,
      duration: 60000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  private buildOverlay(): void {
    this.veil = this.add.graphics();

    if (!this.textures.exists('mote')) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xffffff, 0.25);
      g.fillCircle(8, 8, 8);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 3);
      g.generateTexture('mote', 16, 16);
      g.destroy();
    }
    this.fireflies = this.add
      .particles(0, 0, 'mote', {
        lifespan: { min: 4000, max: 8000 },
        speedX: { min: -12, max: 12 },
        speedY: { min: -18, max: -4 },
        scale: { min: 0.4, max: 1 },
        // Fade in then out over each firefly's life.
        alpha: { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) },
        tint: [0xffe08a, 0xd9f29b, 0xffc56b],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 180,
      });
  }

  private buildUi(): void {
    const title = this.add.text(0, -190, 'ELDERMOOR', titleStyle(76)).setOrigin(0.5);
    const subtitle = this.add
      .text(0, -120, '~  an isometric adventure  ~', bodyStyle(18, THEME.dimText))
      .setOrigin(0.5);

    const start = makeButton(this, 0, -10, 'Begin Journey', () => this.startGame());
    const settings = makeButton(this, 0, 60, 'Settings', () => openSettings(this));

    this.soundHint = this.add
      .text(0, 150, 'Click anywhere to enable sound', bodyStyle(16, THEME.dimText))
      .setOrigin(0.5);
    this.tweens.add({ targets: this.soundHint, alpha: 0.35, duration: 1200, yoyo: true, repeat: -1 });

    this.ui = this.add.container(0, 0, [title, subtitle, start, settings, this.soundHint]);

    // Gentle entrance.
    title.setAlpha(0).y -= 20;
    this.tweens.add({ targets: title, alpha: 1, y: '+=20', duration: 1400, ease: 'Cubic.easeOut' });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.cameras.main.setSize(width, height);
    this.uiCam.setSize(width, height);
    this.veil.clear();
    this.veil.fillStyle(0x07060b, 0.55);
    this.veil.fillRect(0, 0, width, height);
    // Darker at top and bottom, like a vignette.
    this.veil.fillGradientStyle(0x07060b, 0x07060b, 0x07060b, 0x07060b, 0.8, 0.8, 0, 0);
    this.veil.fillRect(0, 0, width, height * 0.35);
    this.veil.fillGradientStyle(0x07060b, 0x07060b, 0x07060b, 0x07060b, 0, 0, 0.85, 0.85);
    this.veil.fillRect(0, height * 0.65, width, height * 0.35);

    const area = new Phaser.Geom.Rectangle(0, height * 0.3, width, height * 0.75);
    this.fireflies.setEmitZone(
      new Phaser.GameObjects.Particles.Zones.RandomZone(area as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource),
    );

    this.ui.setPosition(width / 2, height / 2);
    this.ui.setScale(Math.min(1, width / 640, height / 560));
  }

  private startGame(): void {
    if (this.leaving || !this.input.enabled) return;
    this.leaving = true;
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.uiCam.fadeOut(700, 0, 0, 0);
    this.uiCam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // A new game begins at home, inside the cottage.
      this.scene.start('Game', { newGame: true, area: 'home' });
      this.scene.launch('UI');
    });
  }
}
