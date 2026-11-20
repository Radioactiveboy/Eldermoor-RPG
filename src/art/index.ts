import Phaser from 'phaser';
import { generateAbbey } from './abbey';
import { generateCave } from './cave';
import { generateCreatures } from './creatures';
import { generateCritters } from './critters';
import { generateFarm } from './farm';
import { generateFishing } from './fishing';
import { generateGoblins } from './goblins3d';
import { generateMother } from './mother3d';
import { generateRuin } from './ruin';
import { generateFolk } from './folk';
import { generateHenFarm } from './henfarm';
import { generateHero } from './hero3d';
import { generateInterior } from './interior';
import { generateItemIcons } from './items';
import { generateStationArt } from './stations';
import { generateMarket } from './market';
import { generateMonastery } from './monastery';
import { generatePortraits } from './portraits';
import { generateWayfarers } from './wayfarers3d';
import { generateProps } from './props';
import { generateTavern } from './tavern';
import { generateTiles } from './tiles';
import { generateTollGate } from './tollgate';
import { generateWillow } from './willow';

/** One step of drawing the art, with a name for the loading screen. */
export interface ArtStep {
  label: string;
  draw: (scene: Phaser.Scene) => void;
  /** Needed by the title screen (its drifting map of the Hollow), so drawn before it shows. */
  title?: boolean;
}

/**
 * Everything the game draws, in order. The steps the title screen needs come first; the rest are
 * drawn while it's up (see ArtLoader). Each step only reads art from steps above it (the burnt farm
 * makes burnt copies of the cottage, the farm and the hen farm), so add new steps near the end.
 */
export const ART_STEPS: ArtStep[] = [
  { label: 'the land', draw: generateTiles, title: true },
  { label: 'trees and rocks', draw: generateProps, title: true },
  // The hero is cheap, and BootScene dresses them straight after this.
  { label: 'the hero', draw: generateHero, title: true },
  { label: 'the cottage', draw: generateInterior, title: true },
  { label: 'the farm', draw: generateFarm, title: true },
  { label: 'Adowvale', draw: generateMarket, title: true },
  { label: 'the cave', draw: generateCave, title: true },
  { label: 'the hen farm', draw: generateHenFarm, title: true },
  { label: 'the river', draw: generateFishing, title: true },
  { label: 'beasts', draw: generateCreatures },
  { label: 'townsfolk', draw: generateFolk },
  { label: 'wayfarers', draw: generateWayfarers },
  { label: 'faces', draw: generatePortraits },
  { label: 'the satchel', draw: generateItemIcons },
  { label: 'the hearth and bench', draw: generateStationArt },
  { label: 'small creatures', draw: generateCritters },
  { label: 'the toll gate', draw: generateTollGate },
  { label: 'the monastery', draw: generateMonastery },
  { label: 'the abbey', draw: generateAbbey },
  { label: 'the tavern', draw: generateTavern },
  { label: 'the willow', draw: generateWillow },
  { label: 'Mother', draw: generateMother },
  { label: 'goblins', draw: generateGoblins },
  // Last: it makes burnt copies of art drawn above.
  { label: 'the burnt farm', draw: generateRuin },
];

/**
 * Draws all of the game's pixel art and registers it as textures and animations, in one go.
 * There are no image files: everything comes from code, so the art stays consistent with the
 * palette in palette.ts. BootScene uses ArtLoader instead, to draw it a step at a time.
 */
export function generateArt(scene: Phaser.Scene): void {
  for (const step of ART_STEPS) step.draw(scene);
}

/**
 * Draws the art a step at a time, so the loading screen can show how far it's got and the title
 * screen can show before the art for the rest of the game is ready. Steps draw into the game's
 * shared texture and animation managers, so any scene will do to draw them with.
 */
export const ArtLoader = {
  /** Steps drawn so far. */
  done: 0,
  get total(): number {
    return ART_STEPS.length;
  },
  get finished(): boolean {
    return this.done >= ART_STEPS.length;
  },
  /** How many steps the title screen needs (they come first). */
  get titleSteps(): number {
    return ART_STEPS.filter((s) => s.title).length;
  },
  /** True once everything the title screen shows is drawn. */
  get titleReady(): boolean {
    return ART_STEPS.slice(this.done).every((s) => !s.title);
  },
  /** What the next step draws, for the loading text ("" when finished). */
  get next(): string {
    return ART_STEPS[this.done]?.label ?? '';
  },
  /** How far it's got, from 0 to 1. */
  get progress(): number {
    return this.done / ART_STEPS.length;
  },
  /** Draws the next step, if there is one. */
  drawNext(scene: Phaser.Scene): void {
    const step = ART_STEPS[this.done];
    if (!step) return;
    // Counted first, so a step that throws isn't drawn again (and again) on every later call.
    this.done++;
    step.draw(scene);
    // For measuring boot (see BootScene).
    if (this.finished) performance.mark('eldermoor:art');
  },
  /** Draws everything that's left, there and then. */
  finish(scene: Phaser.Scene): void {
    while (!this.finished) this.drawNext(scene);
  },
};
