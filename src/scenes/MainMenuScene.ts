import Phaser from 'phaser';
import { Display } from '../ui/Display';
import { GameAudio } from '../audio/Audio';
import { HERO_NAME, MAP_HEIGHT, MAP_SEED, MAP_WIDTH } from '../config';
import { IsoMap } from '../world/IsoMap';
import { generateMap } from '../world/MapGenerator';
import { pickSaveFile, SaveData, SaveGame } from '../systems/SaveGame';
import type { GameSceneData } from './GameScene';
import { bodyStyle, makeButton, THEME, titleStyle } from '../ui/Widgets';
import { openSettings } from './SettingsScene';
import type { ConfirmSceneData } from './ConfirmScene';
import { Settings } from '../settings/Settings';
import { ArtLoader } from '../art';
import { retry } from '../systems/Download';
import { areaReady, arrivalArea, loadArea, prefetchArea } from './game/areas';

/**
 * Title screen. The real world map drifts slowly behind a darkened veil, with
 * fireflies floating over it, so the menu previews the game's look.
 */
export class MainMenuScene extends Phaser.Scene {
  private veil!: Phaser.GameObjects.Graphics;
  private ui!: Phaser.GameObjects.Container;
  private soundHint!: Phaser.GameObjects.Text;
  /** A line under the buttons: a save file that wouldn't load, or a browser that won't keep saves. */
  private notice!: Phaser.GameObjects.Text;
  private fireflies!: Phaser.GameObjects.Particles.ParticleEmitter;
  /** The main camera drifts over the map; this one stays still and draws the menu on top. */
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private leaving = false;
  /** The new-game question about hunger and rest is up. */
  private choosing = false;
  /** Says what art is still being drawn, after New Journey or Continue, until it's ready. */
  private waitingFor?: Phaser.GameObjects.Text;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.leaving = false;
    this.choosing = false;
    this.waitingFor = undefined;
    // The drifting map is drawn at the screen's resolution; the menu on top in interface pixels (see ui/Display).
    Display.worldCameras.add(this.cameras.main);
    Display.fitCameras(this, [this.cameras.main]);
    this.cameras.main.setOrigin(0.5);
    this.buildBackdrop();
    const backdrop = [...this.children.list];
    this.buildOverlay();
    this.buildUi();
    this.uiCam = this.cameras.add(0, 0, this.game.scale.width, this.game.scale.height);
    Display.fitCameras(this, [this.uiCam]);
    this.uiCam.ignore(backdrop);
    this.cameras.main.ignore([this.veil, this.fireflies, this.ui]);
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

    // Enter carries on from the last save if there is one.
    this.input.keyboard!.on('keydown-ENTER', () => this.startGame(SaveGame.read()));
    GameAudio.playMusic('menu');
    this.cameras.main.fadeIn(800, 0, 0, 0);
    this.uiCam.fadeIn(800, 0, 0, 0);
  }

  update(): void {
    this.soundHint.setVisible(!GameAudio.unlocked && !this.waitingFor);
  }

  private buildBackdrop(): void {
    const map = new IsoMap(this, generateMap(MAP_WIDTH, MAP_HEIGHT, MAP_SEED));
    const b = map.getWorldBounds();
    const cam = this.cameras.main;
    cam.setBounds(b.x, b.y, b.width, b.height);
    cam.setBackgroundColor(map.backgroundColor);
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
    const title = this.add.text(0, -190, 'ELWYRN', titleStyle(76)).setOrigin(0.5);
    const subtitle = this.add
      .text(0, -120, '~  an isometric adventure  ~', bodyStyle(18, THEME.dimText))
      .setOrigin(0.5);

    // With a saved game, Continue comes first, with where and when it was saved underneath.
    const save = SaveGame.read();
    // Fetch the map the game will open on while the title screen is up (see game/areas.ts).
    prefetchArea(arrivalArea(save ? { load: save } : { newGame: true, area: 'home' }));
    const items: Phaser.GameObjects.GameObject[] = [];
    let y = -10;
    if (save) {
      items.push(makeButton(this, 0, y - 20, 'Continue', () => this.startGame(save)));
      items.push(this.add.text(0, y + 18, SaveGame.describe(save), bodyStyle(14, THEME.dimText)).setOrigin(0.5));
      y += 70;
    }
    items.push(makeButton(this, 0, y, save ? 'New Journey' : 'Begin Journey', () => this.startGame()));
    items.push(makeButton(this, 0, y + 70, 'Settings', () => openSettings(this)));
    items.push(makeButton(this, 0, y + 140, 'Load from File', () => this.loadFromFile()));

    // In a browser that won't keep saves (some private windows), say so before the player puts hours in.
    const blocked = !SaveGame.storageWorks();
    this.notice = this.add
      .text(0, y + 190, blocked ? "This browser is blocking storage, so the game can't keep a save here. After sleeping, download your save from the pause menu." : '', {
        ...bodyStyle(14, THEME.goldText),
        align: 'center',
        wordWrap: { width: 460 },
      })
      .setOrigin(0.5, 0);

    this.soundHint = this.add
      .text(0, y + 270, 'Click anywhere to enable sound', bodyStyle(16, THEME.dimText))
      .setOrigin(0.5);
    this.tweens.add({ targets: this.soundHint, alpha: 0.35, duration: 1200, yoyo: true, repeat: -1 });

    this.ui = this.add.container(0, 0, [title, subtitle, ...items, this.notice, this.soundHint]);

    // Gentle entrance.
    title.setAlpha(0).y -= 20;
    this.tweens.add({ targets: title, alpha: 1, y: '+=20', duration: 1400, ease: 'Cubic.easeOut' });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.cameras.main.setSize(this.game.scale.width, this.game.scale.height);
    this.uiCam.setSize(this.game.scale.width, this.game.scale.height);
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
    this.ui.setScale(Math.min(1, width / 640, height / 720));
  }

  /** Carries on from a save file the player downloaded earlier (see SaveWarningScene and the pause menu). */
  private loadFromFile(): void {
    if (this.leaving) return;
    pickSaveFile().then((save) => {
      if (save === undefined || this.leaving || !this.scene.isActive()) return;
      if (!save) {
        this.notice.setText("That file isn't an Elwyrn save.");
        return;
      }
      // It becomes the save to continue from, as if slept just now; kept in browser storage too where allowed.
      SaveGame.adopt(save);
      this.startGame(save);
    });
  }

  /**
   * Before a new game: should the hero need to eat and sleep? The answer
   * becomes the "Hunger & rest" setting, which can be changed later in Settings.
   */
  private askAboutNeeds(): void {
    this.choosing = true;
    const data: ConfirmSceneData = {
      question: `Should ${HERO_NAME} need to eat and rest?`,
      note: 'If so, he slowly grows hungry and tired. Meals and sleep put it right; let it slide and he tires quicker and heals slower. You can change this any time in Settings.',
      yes: 'Yes, he needs food and sleep',
      no: 'No, leave it out',
      onAnswer: (yes) => {
        Settings.set('needs', yes);
        this.choosing = false;
        this.startGame(undefined, true);
      },
    };
    this.scene.launch('Confirm', data);
  }

  /** Begins a new game (asking about hunger and rest first), or carries on from a save. */
  private startGame(save?: SaveData, asked = false): void {
    if (this.leaving || this.choosing || !this.input.enabled) return;
    if (!save && !asked) {
      this.askAboutNeeds();
      return;
    }
    this.leaving = true;
    const data: GameSceneData = save ? { load: save } : { newGame: true, area: 'home' };
    const area = arrivalArea(data);
    if (!ArtLoader.finished || !areaReady(area)) {
      // The rest of the art is still being drawn (see BootScene), or the first area's map is still
      // on its way. Say so, and once that's on screen (a frame later), draw the rest and wait for the map.
      this.waitingFor = this.add.text(0, this.soundHint.y, 'Drawing the rest of the world…', bodyStyle(16, THEME.dimText)).setOrigin(0.5);
      this.ui.add(this.waitingFor);
      this.cameras.main.ignore(this.waitingFor);
      Display.sharpenText([this.waitingFor]);
      let frames = 0;
      const wait = () => {
        if (++frames < 2) return;
        this.events.off(Phaser.Scenes.Events.UPDATE, wait);
        const stuck = () => this.waitingFor?.setText('Waiting for the connection…');
        void Promise.all([ArtLoader.drawAll(this), retry(() => loadArea(area), stuck)]).then(() => this.leave(data));
      };
      this.events.on(Phaser.Scenes.Events.UPDATE, wait);
      return;
    }
    this.leave(data);
  }

  /** Into the game: a new one begins at home, inside the cottage. */
  private leave(data: GameSceneData): void {
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.uiCam.fadeOut(700, 0, 0, 0);
    this.uiCam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Game', data);
      this.scene.launch('UI');
    });
  }
}
