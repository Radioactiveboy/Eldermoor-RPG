import type Phaser from 'phaser';
import { FINE_FOLK } from './companions3d';
import { generateFightFrames } from './fight3d';
import { FINE_SPEC } from './fine3d';
import { dressed } from './gear';
import { generateHeroFight, HERO_FIGHT_SPEC } from './hero3d';
import { Inventory } from '../systems/Inventory';

/** The companions who fight beside the hero, by their folk id (see systems/Companions.ts). */
const FIGHTERS = ['sigrun', 'wat'];

/**
 * The hero's and the companions' fight frames (see fight3d.ts): the hero in
 * whatever he's wearing now (BootScene redraws them when that changes).
 */
export function generateFightStances(scene: Phaser.Scene): void {
  generateHeroFight(scene, dressed(Inventory.equipped));
  for (const id of FIGHTERS) generateFightFrames(scene, `folk-${id}`, FINE_FOLK[id], { ...HERO_FIGHT_SPEC, scale: FINE_SPEC.scale });
}
