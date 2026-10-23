import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { makeButton, makePanel, titleStyle } from '../ui/Widgets';
import { openSettings } from './SettingsScene';

/** In-game menu opened with Esc. The world is frozen while it's open. */
export class PauseScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Pause');
  }

  create(): void {
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.45).setOrigin(0).setInteractive();

    const panel = makePanel(this, 380, 340);
    const title = this.add.text(0, -115, 'Paused', titleStyle(40)).setOrigin(0.5);
    const resume = makeButton(this, 0, -30, 'Resume', () => this.resumeGame());
    const settings = makeButton(this, 0, 40, 'Settings', () => {
      this.ui.setVisible(false);
      openSettings(this, () => this.ui.setVisible(true));
    });
    const quit = makeButton(this, 0, 110, 'Main Menu', () => this.quitToMenu());
    this.ui = this.add.container(0, 0, [panel, title, resume, settings, quit]);

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.input.enabled) this.resumeGame();
    });
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.ui.setPosition(width / 2, height / 2);
    this.ui.setScale(Math.min(1, (width - 24) / 380, (height - 24) / 340));
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
