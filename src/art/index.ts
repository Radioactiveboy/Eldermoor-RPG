import Phaser from 'phaser';
import { generateCharacter } from './character';
import { generateProps } from './props';
import { generateTiles } from './tiles';

/**
 * Draws all of the game's pixel art at startup and registers it as textures
 * and animations. There are no image files: everything comes from code, so
 * the art stays consistent with the palette in palette.ts.
 */
export function generateArt(scene: Phaser.Scene): void {
  generateTiles(scene);
  generateProps(scene);
  generateCharacter(scene);
}
