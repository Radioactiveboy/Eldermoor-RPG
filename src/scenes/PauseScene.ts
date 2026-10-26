import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { bodyStyle, makeButton, makePanel, THEME, titleStyle } from '../ui/Widgets';
import { SaveGame } from '../systems/SaveGame';
import { openSettings } from './SettingsScene';
import type { GameSceneData } from './GameScene';

const PANEL_W = 380;
const PANEL_H = 480;

const KEY_CONTROLS: Array<[string, string]> = [
  ['WASD / arrows', 'Walk'],
  ['Shift', 'Sprint'],
  ['Click', 'Walk to a spot, or go and use something'],
  ['E / Enter', 'Talk, open doors, sit, sleep, pick, shake trees'],
  ['J', 'Journal'],
  ['I', 'Satchel'],
  ['C', 'Equipment'],
  ['Mouse wheel', 'Zoom'],
  ['Hold T', 'Fast-forward time'],
  ['Esc', 'Pause'],
];

const TOUCH_CONTROLS: Array<[string, string]> = [
  ['Tap the ground', 'Walk there'],
  ['Tap a person or thing', 'Go over and use it'],
  ['Tap a prompt', 'Do what it says'],
  ['Book button', 'Journal'],
  ['Satchel button', 'Satchel and equipment'],
  ['II button', 'Pause'],
];

/** In-game menu opened with Esc. The world is frozen while it's open. */
export class PauseScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private ui!: Phaser.GameObjects.Container;
  private controls!: Phaser.GameObjects.Container;
  private confirmLoad!: Phaser.GameObjects.Container;

  constructor() {
    super('Pause');
  }

  create(): void {
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.45).setOrigin(0).setInteractive();

    const panel = makePanel(this, PANEL_W, PANEL_H);
    const title = this.add.text(0, -185, 'Paused', titleStyle(40)).setOrigin(0.5);
    const resume = makeButton(this, 0, -100, 'Resume', () => this.resumeGame());
    const controls = makeButton(this, 0, -30, 'Controls', () => this.showControls(true));
    const settings = makeButton(this, 0, 40, 'Settings', () => {
      this.ui.setVisible(false);
      openSettings(this, () => this.ui.setVisible(true));
    });
    const load = makeButton(this, 0, 110, 'Load Last Save', () => this.showConfirmLoad(true));
    const quit = makeButton(this, 0, 180, 'Main Menu', () => this.quitToMenu());
    if (!SaveGame.read()) {
      // Nothing to load until the player has slept in a bed.
      load.setAlpha(0.4).disableInteractive();
    }
    this.ui = this.add.container(0, 0, [panel, title, resume, controls, settings, load, quit]);
    this.controls = this.buildControls().setVisible(false);
    this.confirmLoad = this.buildConfirmLoad().setVisible(false);

    this.input.keyboard!.on('keydown-ESC', () => {
      if (!this.input.enabled) return;
      if (this.controls.visible) this.showControls(false);
      else if (this.confirmLoad.visible) this.showConfirmLoad(false);
      else this.resumeGame();
    });
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
  }

  /** A list of what every key (or tap) does. */
  private buildControls(): Phaser.GameObjects.Container {
    const touch = this.sys.game.device.input.touch;
    const rows = touch ? TOUCH_CONTROLS : KEY_CONTROLS;
    const h = 170 + rows.length * 30;
    const panel = makePanel(this, 600, h);
    const title = this.add.text(0, -h / 2 + 46, 'Controls', titleStyle(34)).setOrigin(0.5);
    const lines = rows.flatMap(([key, action], i) => {
      const y = -h / 2 + 96 + i * 30;
      return [
        this.add.text(-60, y, key, bodyStyle(17, THEME.goldText)).setOrigin(1, 0),
        this.add.text(-40, y, action, { ...bodyStyle(16), fontFamily: 'Georgia, "Times New Roman", serif' }),
      ];
    });
    const back = makeButton(this, 0, h / 2 - 46, 'Back', () => this.showControls(false), 200);
    return this.add.container(0, 0, [panel, title, ...lines, back]);
  }

  /** "Are you sure?" before loading, since anything since the last sleep is lost. */
  private buildConfirmLoad(): Phaser.GameObjects.Container {
    const save = SaveGame.read();
    const panel = makePanel(this, PANEL_W, 330);
    const title = this.add.text(0, -115, 'Load Last Save?', titleStyle(32)).setOrigin(0.5);
    const when = this.add.text(0, -62, save ? SaveGame.describe(save) : '', bodyStyle(16, THEME.goldText)).setOrigin(0.5);
    const warning = this.add
      .text(0, -22, 'Anything since you last slept will be lost.', {
        ...bodyStyle(16, THEME.dimText),
        fontFamily: 'Georgia, "Times New Roman", serif',
        align: 'center',
        wordWrap: { width: PANEL_W - 60 },
      })
      .setOrigin(0.5);
    const yes = makeButton(this, 0, 45, 'Load', () => this.loadSave(), 220);
    const no = makeButton(this, 0, 112, 'Cancel', () => this.showConfirmLoad(false), 220);
    return this.add.container(0, 0, [panel, title, when, warning, yes, no]);
  }

  private showConfirmLoad(show: boolean): void {
    this.confirmLoad.setVisible(show);
    this.ui.setVisible(!show);
  }

  private loadSave(): void {
    const save = SaveGame.read();
    if (!save) return;
    this.scene.stop();
    this.scene.start('Game', { load: save } satisfies GameSceneData);
  }

  private showControls(show: boolean): void {
    this.controls.setVisible(show);
    this.ui.setVisible(!show);
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.ui.setPosition(width / 2, height / 2);
    const scale = Math.min(1, (width - 24) / PANEL_W, (height - 24) / PANEL_H);
    this.ui.setScale(scale);
    this.confirmLoad.setPosition(width / 2, height / 2).setScale(scale);
    const ch = 170 + (this.sys.game.device.input.touch ? TOUCH_CONTROLS : KEY_CONTROLS).length * 30;
    this.controls.setPosition(width / 2, height / 2);
    this.controls.setScale(Math.min(1, (width - 24) / 600, (height - 24) / ch));
  }

  private resumeGame(): void {
    this.scene.resume('Game');
    this.scene.stop();
  }

  private quitToMenu(): void {
    this.scene.stop('UI');
    this.scene.stop('Game');
    GameAudio.playMusic('menu');
    this.scene.start('MainMenu');
  }
}
