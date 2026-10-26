import Phaser from 'phaser';
import { generateCave } from './cave';
import { generateCharacter } from './character';
import { generateCreatures } from './creatures';
import { generateCritters } from './critters';
import { generateFarm } from './farm';
import { generateFolk } from './folk';
import { generateHenFarm } from './henfarm';
import { generateInterior } from './interior';
import { generateItemIcons } from './items';
import { generateMarket } from './market';
import { generateNpcs } from './npc';
import { generatePortraits } from './portraits';
import { generateProps } from './props';
import { generateTiles } from './tiles';
import { generateTollGate } from './tollgate';

/**
 * Draws all of the game's pixel art at startup and registers it as textures
 * and animations. There are no image files: everything comes from code, so
 * the art stays consistent with the palette in palette.ts.
 */
export function generateArt(scene: Phaser.Scene): void {
  generateTiles(scene);
  generateProps(scene);
  generateCharacter(scene);
  generateNpcs(scene);
  generateCreatures(scene);
  generateFolk(scene);
  generatePortraits(scene);
  generateInterior(scene);
  generateFarm(scene);
  generateItemIcons(scene);
  generateCritters(scene);
  generateMarket(scene);
  generateCave(scene);
  generateHenFarm(scene);
  generateTollGate(scene);
}
