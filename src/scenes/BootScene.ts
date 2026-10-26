import Phaser from 'phaser';
import { generateArt } from '../art';
import { HERO_OUTFIT, redrawCharacter } from '../art/character';
import { dressed } from '../art/gear';
import { Inventory } from '../systems/Inventory';

/**
 * Draws all the game's pixel art (see src/art/) before anything else starts.
 * To swap in hand-drawn art later, load it here with this.load.image /
 * spritesheet under the same texture keys and nothing else needs to change.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateArt(this);
    this.dressHero();

    this.scene.start('MainMenu');
  }

  /** Repaints the hero's sprite whenever what they're wearing changes, wherever it's shown. */
  private dressHero(): void {
    let worn = '';
    const dress = () => {
      const now = JSON.stringify(Inventory.equipped);
      if (now === worn) return;
      worn = now;
      redrawCharacter(this, 'player', dressed(HERO_OUTFIT, Inventory.equipped));
    };
    dress();
    Inventory.onChange(dress);
  }
}
