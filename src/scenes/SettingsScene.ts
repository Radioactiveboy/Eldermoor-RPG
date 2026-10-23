import Phaser from 'phaser';
import { Settings, SettingsData } from '../settings/Settings';
import { bodyStyle, makeButton, makePanel, makeSlider, THEME, titleStyle } from '../ui/Widgets';

/**
 * Opens the settings window over `caller`. The caller stops taking input while
 * it's open and gets it back when the window closes.
 */
export function openSettings(caller: Phaser.Scene, onClose?: () => void): void {
  caller.input.enabled = false;
  caller.scene.launch('Settings');
  caller.scene.get('Settings').events.once('settings-closed', () => {
    // Wait a moment so the key press that closed this window isn't also
    // handled by the caller (e.g. Esc closing settings and the pause menu).
    caller.time.delayedCall(50, () => {
      caller.input.enabled = true;
      onClose?.();
    });
  });
}

const VOLUMES: [keyof SettingsData, string][] = [
  ['masterVolume', 'Master'],
  ['musicVolume', 'Music'],
  ['effectsVolume', 'Effects'],
];

/** Volume sliders and display options. Changes save and apply immediately. */
export class SettingsScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private ui!: Phaser.GameObjects.Container;

  constructor() {
    super('Settings');
  }

  create(): void {
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.55).setOrigin(0).setInteractive();

    const panel = makePanel(this, 560, 430);
    const title = this.add.text(0, -170, 'Settings', titleStyle(40)).setOrigin(0.5);

    const sliders = VOLUMES.map(([key, label], i) =>
      makeSlider(this, 60, -90 + i * 56, label, Settings.get()[key], (v) => Settings.set(key, v)),
    );

    const fullscreen = makeButton(this, 0, 90, this.fullscreenLabel(), () => {
      this.scale.toggleFullscreen();
    }, 300);
    const fsText = fullscreen.list[1] as Phaser.GameObjects.Text;
    const refreshFs = () => fsText.setText(this.fullscreenLabel());
    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, refreshFs);
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, refreshFs);

    const back = makeButton(this, 0, 160, 'Back', () => this.close(), 200);
    const hint = this.add.text(0, 205, 'Esc to close', bodyStyle(14, THEME.dimText)).setOrigin(0.5);

    this.ui = this.add.container(0, 0, [panel, title, ...sliders, fullscreen, back, hint]);

    this.input.keyboard!.on('keydown-ESC', () => this.close());
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, refreshFs);
      this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, refreshFs);
    });

    this.ui.setAlpha(0);
    this.tweens.add({ targets: this.ui, alpha: 1, duration: 150 });
  }

  private fullscreenLabel(): string {
    return this.scale.isFullscreen ? 'Fullscreen: On' : 'Fullscreen: Off';
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.ui.setPosition(width / 2, height / 2);
    this.ui.setScale(Math.min(1, (width - 24) / 560, (height - 24) / 430));
  }

  private close(): void {
    this.events.emit('settings-closed');
    this.scene.stop();
  }
}
