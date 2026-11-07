import Phaser from 'phaser';
import { Settings } from '../settings/Settings';
import { Display, RENDER_SCALES, UI_SCALES } from '../ui/Display';
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

type Volume = 'masterVolume' | 'musicVolume' | 'effectsVolume' | 'ambienceVolume';
const VOLUMES: [Volume, string][] = [
  ['masterVolume', 'Master'],
  ['musicVolume', 'Music'],
  ['effectsVolume', 'Effects'],
  ['ambienceVolume', 'Ambience'],
];

const PANEL_H = 580;

/** The choice after `current` in `choices`, round to the first again. */
function next(choices: number[], current: number): number {
  const i = choices.indexOf(current);
  return choices[(i + 1) % choices.length];
}

/** Volume sliders and display options. Changes save and apply immediately. */
export class SettingsScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private ui!: Phaser.GameObjects.Container;
  private resolutionText!: Phaser.GameObjects.Text;
  private uiSizeText!: Phaser.GameObjects.Text;

  constructor() {
    super('Settings');
  }

  create(): void {
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.55).setOrigin(0).setInteractive();

    const panel = makePanel(this, 560, PANEL_H);
    const title = this.add.text(0, -222, 'Settings', titleStyle(40)).setOrigin(0.5);

    const sliders = VOLUMES.map(([key, label], i) =>
      makeSlider(this, 60, -160 + i * 50, label, Settings.get()[key], (v) => Settings.set(key, v)),
    );

    // Display: each button steps through its choices.
    const resolution = makeButton(this, 0, 40, '', () => {
      Settings.set('renderScale', next(RENDER_SCALES, Settings.get().renderScale || 1));
      this.refreshDisplay();
    }, 440);
    const uiSize = makeButton(this, 0, 100, '', () => {
      Settings.set('uiScale', next(UI_SCALES, Settings.get().uiScale));
      this.refreshDisplay();
    }, 440);
    this.resolutionText = (resolution.list[1] as Phaser.GameObjects.Text).setFontSize(18);
    this.uiSizeText = (uiSize.list[1] as Phaser.GameObjects.Text).setFontSize(18);
    this.refreshDisplay();

    const fullscreen = makeButton(this, 0, 160, this.fullscreenLabel(), () => {
      this.scale.toggleFullscreen();
    }, 300);
    const fsText = fullscreen.list[1] as Phaser.GameObjects.Text;
    const refreshFs = () => {
      fsText.setText(this.fullscreenLabel());
      this.refreshDisplay();
    };
    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, refreshFs);
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, refreshFs);

    const back = makeButton(this, 0, 222, 'Back', () => this.close(), 200);
    const hint = this.add.text(0, 262, 'Esc to close', bodyStyle(14, THEME.dimText)).setOrigin(0.5);

    this.ui = this.add.container(0, 0, [panel, title, ...sliders, resolution, uiSize, fullscreen, back, hint]);

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

  /** The display buttons' labels, for the settings as they are now. */
  private refreshDisplay(): void {
    const r = Settings.get().renderScale || 1;
    const size = Display.canvasSize(r);
    const res = r === 1 ? 'Native' : `${Math.round(r * 100)}%`;
    this.resolutionText.setText(`Resolution: ${res} (${size.width} × ${size.height})`);
    const u = Settings.get().uiScale;
    const ui = u ? `${Math.round(u * 100)}%` : `Auto (${Math.round(Display.autoUi() * 100)}%)`;
    this.uiSizeText.setText(`Interface size: ${ui}`);
  }

  private fullscreenLabel(): string {
    return this.scale.isFullscreen ? 'Fullscreen: On' : 'Fullscreen: Off';
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.ui.setPosition(width / 2, height / 2);
    this.ui.setScale(Math.min(1, (width - 24) / 560, (height - 24) / PANEL_H));
    this.refreshDisplay();
  }

  private close(): void {
    this.events.emit('settings-closed');
    this.scene.stop();
  }
}
