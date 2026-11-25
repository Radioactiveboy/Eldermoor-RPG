import Phaser from 'phaser';
import { retry } from '../systems/Download';
import { generateCave } from './cave';
import { generateCreatures } from './creatures';
import { generateFarm } from './farm';
import { generateFishing } from './fishing';
import { generateFolk } from './folk';
import { generateBrigands } from './brigands3d';
import { generateGoblins } from './goblins3d';
import { generateHenFarm } from './henfarm';
import { generateFightStances } from './fightStances';
import { generateHero } from './hero3d';
import { generateInterior } from './interior';
import { generateStationArt } from './stations';
import { generateMarket } from './market';
import { generateWayfarers } from './wayfarers3d';
import { generateProps } from './props';
import { generateTiles } from './tiles';
import { generateTollGate } from './tollgate';
import { generatePalisade } from './palisade';

type Painter = (scene: Phaser.Scene) => void;

/** One step of drawing the art, with a name for the loading screen. */
export interface ArtStep {
  label: string;
  /** Draws it. A step with `load` instead gets this once its code has downloaded. */
  draw?: Painter;
  /**
   * Fetches the step's code, for art the title screen doesn't need: it stays out of the first
   * download and comes down while the title art is drawn (ArtLoader.fetch). Only use it for a
   * painter nothing else imports, or the import here won't split anything off.
   */
  load?: () => Promise<Painter>;
  /** Needed by the title screen (its drifting map of the Hollow), so drawn before it shows. */
  title?: boolean;
}

/**
 * Everything the game draws, in order. The steps the title screen needs come first; the rest are
 * drawn while it's up (see ArtLoader). Each step only reads art from steps above it (the burnt farm
 * makes burnt copies of the cottage, the farm and the hen farm), so add new steps near the end.
 * A step is `draw: painter` (in the first download) or `load: () => import(...)` (fetched while the
 * title art is drawn); prefer `load` for anything past the title screen.
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
  { label: 'the market crowd', load: () => import('./townsfolk3d').then((m) => m.generateCrowd) },
  { label: 'faces', load: () => import('./portraits').then((m) => m.generatePortraits) },
  { label: 'the orb', load: () => import('./orbPortrait').then((m) => m.generateOrbPortrait) },
  { label: 'the satchel', load: () => import('./items').then((m) => m.generateItemIcons) },
  { label: 'the hearth and bench', draw: generateStationArt },
  { label: 'small creatures', load: () => import('./critters').then((m) => m.generateCritters) },
  // (The toll gate and the goblins stay in the first download: other art draws from them.)
  { label: 'the toll gate', draw: generateTollGate },
  { label: 'the stockade', draw: generatePalisade },
  { label: 'the monastery', load: () => import('./monastery').then((m) => m.generateMonastery) },
  { label: 'the abbey', load: () => import('./abbey').then((m) => m.generateAbbey) },
  { label: 'the tavern', load: () => import('./tavern').then((m) => m.generateTavern) },
  { label: 'the willow', load: () => import('./willow').then((m) => m.generateWillow) },
  { label: 'Mother', load: () => import('./mother3d').then((m) => m.generateMother) },
  { label: 'goblins', draw: generateGoblins },
  { label: 'swordplay', draw: generateFightStances },
  { label: 'brigands', draw: generateBrigands },
  { label: 'wild herbs', load: () => import('./herbs').then((m) => m.generateHerbs) },
  { label: 'the north woods', load: () => import('./northwoods').then((m) => m.generateNorthWoods) },
  { label: 'the Greyfells', load: () => import('./greyfells').then((m) => m.generateGreyfells) },
  { label: 'the beacon on Corbie Tor', load: () => import('./beacon').then((m) => m.generateBeacon) },
  { label: 'the brood hall', load: () => import('./broodhall').then((m) => m.generateBroodHall) },
  // After the townsfolk: it redraws the smith's and the baker's working frames.
  { label: 'the smithy and bakery', load: () => import('./workshops').then((m) => m.generateWorkshops) },
  { label: "the garrison and the Headman's house", load: () => import('./garrison').then((m) => m.generateGarrison) },
  // (Gloomhaven's map also uses the river front's piers, boats, reeds and lilies, drawn below.)
  { label: 'Gloomhaven', load: () => import('./gloomhaven').then((m) => m.generateGloomhaven) },
  { label: 'the folk of Gloomhaven', load: () => import('./gloomfolk3d').then((m) => m.generateGloomFolk) },
  // Last: it makes burnt copies of art drawn above.
  { label: 'the river front', load: () => import('./jetty').then((m) => m.generateJetty) },
  { label: 'the Black Rose', load: () => import('./blackrose').then((m) => m.generateBlackRose) },
  // (After Gloomhaven and the faces: it draws with their pieces.)
  { label: 'the Guildhall', load: () => import('./guildhall').then((m) => m.generateGuildHall) },
  { label: 'the merchants of the Guildhall', load: () => import('./guildPortraits').then((m) => m.generateGuildPortraits) },
  { label: 'the burnt farm', load: () => import('./ruin').then((m) => m.generateRuin) },
  { label: 'the Hollow rebuilt', load: () => import('./homestead').then((m) => m.generateHomestead) },
];

/**
 * Draws the art a step at a time, so the loading screen can show how far it's got and the title
 * screen can show before the art for the rest of the game is ready. Steps draw into the game's
 * shared texture and animation managers, so any scene will do to draw them with. Steps with `load`
 * wait for their code: fetch() starts downloading all of it, and drawNext() stops at a step whose
 * code hasn't arrived yet (drawAll() waits for it).
 */
export const ArtLoader = {
  /** Steps drawn so far. */
  done: 0,
  /** Set once the code for a step couldn't be fetched, even after retrying (shown on screen). */
  failed: '',
  /** Each step's download (already done for `draw` steps), once fetch() has started them. */
  loads: undefined as Array<Promise<void>> | undefined,
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
  /** Whether the next step can be drawn now (its code is here). */
  get ready(): boolean {
    return !!ART_STEPS[this.done]?.draw;
  },
  /** Starts downloading the code for every `load` step, all at once (does nothing the second time). */
  fetch(): Array<Promise<void>> {
    this.loads ??= ART_STEPS.map(async (step) => {
      if (step.draw || !step.load) return;
      step.draw = await retry(step.load, () => (this.failed ||= step.label));
    });
    return this.loads;
  },
  /** Resolves once the next step can be drawn. */
  whenReady(): Promise<void> {
    return this.fetch()[this.done] ?? Promise.resolve();
  },
  /** Draws the next step, if it can (false when finished, or its code is still on its way). */
  drawNext(scene: Phaser.Scene): boolean {
    const step = ART_STEPS[this.done];
    if (!step) return false;
    if (!step.draw) {
      this.fetch();
      return false;
    }
    // Counted first, so a step that throws isn't drawn again (and again) on every later call.
    this.done++;
    step.draw(scene);
    // For measuring boot (see BootScene).
    if (this.finished) performance.mark('eldermoor:art');
    return true;
  },
  /** Draws everything that's left whose code is here, there and then. */
  finish(scene: Phaser.Scene): void {
    while (this.drawNext(scene));
  },
  /** Draws everything that's left, waiting for any code still downloading. */
  async drawAll(scene: Phaser.Scene): Promise<void> {
    this.finish(scene);
    while (!this.finished) {
      await this.whenReady();
      this.finish(scene);
    }
  },
};
