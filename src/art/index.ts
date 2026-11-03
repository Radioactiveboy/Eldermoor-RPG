import Phaser from 'phaser';
import { generateAbbey } from './abbey';
import { generateCave } from './cave';
import { generateCreatures } from './creatures';
import { generateCritters } from './critters';
import { generateFarm } from './farm';
import { generateFishing } from './fishing';
import { generateFolk } from './folk';
import { generateHenFarm } from './henfarm';
import { generateHero } from './hero3d';
import { generateInterior } from './interior';
import { generateItemIcons } from './items';
import { generateMarket } from './market';
import { generateMonastery } from './monastery';
import { generateNpcs } from './npc';
import { generatePortraits } from './portraits';
import { generateProps } from './props';
import { generateTavern } from './tavern';
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
  generateHero(scene);
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
  generateFishing(scene);
  generateMonastery(scene);
  generateAbbey(scene);
  generateTavern(scene);
}
