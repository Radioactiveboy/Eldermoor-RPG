import Phaser from 'phaser';
import { ArtLoader } from '../art';
import { dressed } from '../art/gear';
import { redrawHero } from '../art/hero3d';
import { Inventory } from '../systems/Inventory';
import { Display } from '../ui/Display';
import { bodyStyle, THEME, titleStyle } from '../ui/Widgets';

/** Scenes that can be shown before all the art is drawn (the title screen only needs some of it). */
const EARLY_SCENES = new Set(['Boot', 'MainMenu', 'Settings']);

/**
 * Draws the game's pixel art (see src/art/) a step at a time behind a loading bar, then shows the
 * title screen as soon as the art it needs is ready, and draws the rest a step a frame while it's
 * up. Any other scene that starts (the game itself) first draws whatever is still left, so nothing
 * past the title screen ever sees missing art.
 * To swap in hand-drawn art later, load it here with this.load.image /
 * spritesheet under the same texture keys and nothing else needs to change.
 */
export class BootScene extends Phaser.Scene {
  private bar!: Phaser.GameObjects.Graphics;
  private label!: Phaser.GameObjects.Text;
  private leaving = false;

  constructor() {
    super('Boot');
  }

  create(): void {
    performance.mark('eldermoor:boot');
    this.markTimings();
    this.guardLaterScenes();

    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2 - 70, 'ELDERMOOR', titleStyle(52)).setOrigin(0.5);
    this.bar = this.add.graphics();
    this.label = this.add.text(width / 2, height / 2 + 34, '', bodyStyle(16, THEME.dimText)).setOrigin(0.5);
    Display.sharpenText(this.children.list);
    this.showProgress();
  }

  update(): void {
    if (this.leaving) return;
    // A tenth of a second's worth of steps a frame, so the bar moves along.
    const until = performance.now() + 100;
    do ArtLoader.drawNext(this);
    while (!ArtLoader.titleReady && performance.now() < until);
    this.showProgress();
    if (!ArtLoader.titleReady) return;
    this.leaving = true;
    performance.mark('eldermoor:title-art');
    this.dressHero();
    // The rest is drawn while the title screen is up, a step at a time between its frames. If the
    // player starts before it's done, the title screen draws what's left in one go.
    const more = () => {
      if (ArtLoader.finished) return;
      ArtLoader.drawNext(this);
      setTimeout(more, 0);
    };
    setTimeout(more, 0);
    this.scene.start('MainMenu');
  }

  private showProgress(): void {
    const { width, height } = this.scale;
    const w = Math.min(320, width - 64);
    const x = (width - w) / 2;
    const y = height / 2;
    this.bar.clear();
    this.bar.fillStyle(THEME.panelLight, 1).fillRoundedRect(x, y, w, 10, 5);
    // The title screen comes once its steps are drawn, so the bar fills over those.
    const p = Math.min(1, ArtLoader.done / ArtLoader.titleSteps);
    if (p > 0) this.bar.fillStyle(THEME.gold, 1).fillRoundedRect(x, y, Math.max(10, w * p), 10, 5);
    this.label.setText(ArtLoader.next ? `Drawing ${ArtLoader.next}…` : '');
  }

  /**
   * Before any scene beyond the title screen starts (the game, from New Journey or Continue), draws
   * whatever art is still left, there and then. The title screen waits for it with a message of its
   * own, so this is only a safety net.
   */
  private guardLaterScenes(): void {
    for (const scene of this.scene.manager.getScenes(false)) {
      const key = scene.sys.settings.key;
      if (EARLY_SCENES.has(key)) continue;
      scene.sys.events.on(Phaser.Scenes.Events.START, () => {
        if (!ArtLoader.finished) ArtLoader.finish(this);
      });
    }
  }

  /**
   * Timings for measuring boot (see the README), read with performance.getEntriesByName:
   * eldermoor:boot (this scene starts), eldermoor:menu (the title screen is up),
   * eldermoor:art (all the art is drawn) and eldermoor:area (the first area is up).
   */
  private markTimings(): void {
    this.scene.get('MainMenu').events.once(Phaser.Scenes.Events.CREATE, () => performance.mark('eldermoor:menu'));
    this.scene.get('Game').events.once(Phaser.Scenes.Events.CREATE, () => performance.mark('eldermoor:area'));
  }

  /** Repaints the hero's sprite whenever what they're wearing changes, wherever it's shown. */
  private dressHero(): void {
    let worn = '';
    const dress = () => {
      const now = JSON.stringify(Inventory.equipped);
      if (now === worn) return;
      worn = now;
      redrawHero(this, dressed(Inventory.equipped));
    };
    dress();
    Inventory.onChange(dress);
  }
}
