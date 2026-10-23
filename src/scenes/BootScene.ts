import Phaser from 'phaser';
import { generateArt } from '../art';

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

    this.scene.start('Game');
    this.scene.launch('UI');
  }
}
