/**
 * The plot Farmer Iran lends the hero in his yard (see systems/Farm.ts for how
 * it grows): showing each tile as weeds, bare soil, damp soil, or a crop at
 * some stage, and the jobs done there with the E prompt: dig, sow, water, pick,
 * or have a look at how it's coming on.
 */
import Phaser from 'phaser';
import { cropKey, CROP_H, CROP_ORIGIN_Y, plotKey } from '../../art/farm';
import { tileKey, TILE_VARIANTS } from '../../art/tiles';
import { GameAudio } from '../../audio/Audio';
import { depthAt, gridToScreen } from '../../iso/IsoMath';
import { CropKind, CROPS, Farm, hoursToRipe, PLOT_SECONDS, PlotTile, plotStage, SEEDS } from '../../systems/Farm';
import { Inventory, itemDef } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { Weather } from '../../systems/Weather';
import type { IsoMap } from '../../world/IsoMap';
import type { ConfirmSceneData } from '../ConfirmScene';
import type { GameScene } from '../GameScene';
import type { Interaction } from './interactions';
import { give, startChannel } from './sights';

/** Set once Iran has lent the hero the plot (dialogue/iran.ts). */
export const PLOT_FLAG = 'plot-lent';

/** Damp soil is darker. */
const WET_TINT = 0x8a7c74;
/** The order seeds are offered in. */
const KINDS: CropKind[] = ['carrot', 'turnip', 'cabbage'];

const rainAt = (h: number) => Weather.at(h).rain;

/** A plot tile as of now. */
function tileNow(g: GameScene, tx: number, ty: number): PlotTile {
  return Farm.plotTile(tx, ty, g.clock.elapsedHours, rainAt);
}

/** The images for each tile of the plot on a map: the ground under it, and what's growing (or the weeds). */
const sprites = new WeakMap<IsoMap, Map<string, { ground: Phaser.GameObjects.Image; top: Phaser.GameObjects.Image }>>();

/** Keeps the plot looking as it should: called on arrival and once a second (see syncCrops). */
export function syncPlot(g: GameScene): void {
  const plot = g.map.data.plot;
  if (!plot) return;
  let images = sprites.get(g.map);
  if (!images) {
    images = new Map();
    sprites.set(g.map, images);
    for (const { tx, ty } of plot) {
      const c = gridToScreen(tx + 0.5, ty + 0.5);
      // Just above the baked ground (and under the tile highlights).
      const ground = g.add.image(c.x, c.y, tileKey('tile-soil', (tx * 7 + ty * 3) % TILE_VARIANTS)).setDepth(0.5);
      const top = g.add.image(c.x, c.y, plotKey('weeds')).setOrigin(0.5, CROP_ORIGIN_Y / CROP_H).setDepth(depthAt(tx + 0.5, ty + 0.5));
      images.set(`${tx},${ty}`, { ground, top });
    }
  }
  const now = g.clock.elapsedHours;
  for (const { tx, ty } of plot) {
    const img = images.get(`${tx},${ty}`)!;
    const tile = tileNow(g, tx, ty);
    // Under the weeds, the bed's outline shows faintly.
    img.ground.setAlpha(tile.dug ? 1 : 0.3);
    const tint = tile.wetUntil > now ? WET_TINT : 0xffffff;
    if (img.ground.tintTopLeft !== tint) img.ground.setTint(tint);
    const key = topKey(tile);
    img.top.setVisible(!!key);
    if (key && img.top.texture.key !== key) img.top.setTexture(key);
  }
}

/** What stands on a tile: weeds, a crop at its stage, or nothing on bare soil. */
function topKey(tile: PlotTile): string | undefined {
  if (!tile.dug) return plotKey('weeds');
  if (!tile.crop) return undefined;
  const stage = plotStage(tile);
  if (stage === 'ripe') return cropKey(tile.crop, true);
  if (stage === 'young') return plotKey(`young-${tile.crop}`);
  if (stage === 'sprout') return cropKey(tile.crop, false);
  return plotKey('sown');
}

/** The job for each tile near (gx, gy), for the E prompt. */
export function plotInteractions(g: GameScene, gx: number, gy: number): Interaction[] {
  const list: Interaction[] = [];
  for (const { tx, ty } of g.map.data.plot ?? []) {
    if (Math.abs(tx + 0.5 - gx) >= 2 || Math.abs(ty + 0.5 - gy) >= 2) continue;
    const job = plotJob(g, tx, ty);
    const p = gridToScreen(tx + 0.5, ty + 0.5);
    list.push({
      key: `plot:${tx},${ty}`, label: job.label, gx: tx + 0.5, gy: ty + 0.5, range: 1.2,
      promptX: p.x, promptY: p.y - 24, tile: { x: tx, y: ty }, run: job.run,
    });
  }
  return list;
}

/** What E does at a plot tile, by how it stands. */
function plotJob(g: GameScene, tx: number, ty: number): { label: string; run: () => void } {
  const towards = { x: tx + 0.5, y: ty + 0.5 };
  if (!QuestLog.hasFlag(PLOT_FLAG)) {
    return { label: 'Look at', run: () => look(g, towards, "A corner of Iran's yard, gone to docks and long grass. Good dark soil under it, I'd bet.") };
  }
  const tile = tileNow(g, tx, ty);
  if (!tile.dug) return { label: 'Dig', run: () => dig(g, tx, ty) };
  if (!tile.crop) return { label: 'Sow', run: () => askWhatToSow(g, tx, ty) };
  if (plotStage(tile) === 'ripe') return { label: CROPS[tile.crop].verb, run: () => harvest(g, tx, ty) };
  if (tile.wetUntil <= g.clock.elapsedHours) return { label: 'Water', run: () => water(g, tx, ty) };
  return { label: 'Look at', run: () => look(g, towards, howItsComing(tile)) };
}

function look(g: GameScene, at: { x: number; y: number }, thought: string): void {
  g.walkingTo = undefined;
  g.player.setPath([]);
  g.player.faceTowards(at.x, at.y);
  g.onHint?.(thought);
}

/** "Carrot shoots, the soil still damp. They want about a day more." */
export function howItsComing(tile: PlotTile): string {
  const kind = tile.crop!;
  const name = { carrot: 'carrots', turnip: 'turnips', cabbage: 'cabbages' }[kind];
  const stage = plotStage(tile);
  const what = stage === 'sown' ? `Nothing showing yet where I sowed the ${name}.` : stage === 'sprout' ? `The ${name} are up: little green shoots.` : `The ${name} are coming on well.`;
  const hours = hoursToRipe(tile);
  const left = hours > 30 ? 'They want a couple of days yet' : hours > 14 ? 'They want about a day more' : 'They should be ready by tomorrow';
  return `${what} The soil is still damp. ${left}, so long as they're kept watered.`;
}

/** Needs Iran's old spade (he lends it with the plot). */
function dig(g: GameScene, tx: number, ty: number): void {
  if (Inventory.count('spade') === 0) {
    g.onHint?.("I need a spade to dig this over. Iran said he'd lend me his old one.");
    return;
  }
  GameAudio.rustle();
  startChannel(g, {
    label: 'Digging',
    seconds: PLOT_SECONDS.dig,
    onDone: () => {
      GameAudio.rustle();
      Farm.dig(tx, ty, g.clock.elapsedHours);
      syncPlot(g);
      if (!QuestLog.hasFlag('plot-first-dug')) {
        QuestLog.setFlag('plot-first-dug');
        g.onHint?.('Turned over and the weeds dug in. Now for some seed.');
      }
    },
  }, { x: tx + 0.5, y: ty + 0.5 });
}

/** One kind of seed goes straight in; with more than one, a box asks which. */
function askWhatToSow(g: GameScene, tx: number, ty: number): void {
  const have = KINDS.filter((k) => Inventory.count(SEEDS[k]) > 0);
  if (have.length === 0) {
    g.onHint?.('I have no seed to sow. Hilde sells it at her stall in the market.');
    return;
  }
  if (have.length === 1) {
    sow(g, tx, ty, have[0]);
    return;
  }
  if (!g.takeControls()) return;
  const data: ConfirmSceneData = {
    question: 'What shall I sow here?',
    choices: have.map((k) => `${itemDef(SEEDS[k]).name} (${Inventory.count(SEEDS[k])})`),
    onAnswer: () => undefined,
    onChoice: (i) => {
      g.release();
      if (i !== undefined) sow(g, tx, ty, have[i]);
    },
  };
  g.scene.launch('Confirm', data);
}

function sow(g: GameScene, tx: number, ty: number, kind: CropKind): void {
  GameAudio.rustle();
  startChannel(g, {
    label: 'Sowing',
    seconds: PLOT_SECONDS.sow,
    onDone: () => {
      if (!Inventory.remove(SEEDS[kind], 1)) return;
      Farm.sow(tx, ty, kind, g.clock.elapsedHours, rainAt);
      syncPlot(g);
      const tile = tileNow(g, tx, ty);
      if (tile.wetUntil <= g.clock.elapsedHours) g.onHint?.('Sown. It will want watering before anything comes up.');
      if (!QuestLog.hasFlag('plot-first-sown')) {
        QuestLog.setFlag('plot-first-sown');
        QuestLog.writeDiary(
          "Dug over a bit of Iran's yard and put my first seed in. If I keep it watered it should be up in a day or two. " +
            'Mother will laugh at me, a farmer at last.',
        );
      }
    },
  }, { x: tx + 0.5, y: ty + 0.5 });
}

/** Needs the watering can; Iran's water butt by the plot keeps it full. */
function water(g: GameScene, tx: number, ty: number): void {
  if (Inventory.count('watering-can') === 0) {
    g.onHint?.("It's dry. I need something to carry water in.");
    return;
  }
  GameAudio.splash();
  startChannel(g, {
    label: 'Watering',
    seconds: PLOT_SECONDS.water,
    onDone: () => {
      GameAudio.drip(0.6);
      Farm.water(tx, ty, g.clock.elapsedHours, rainAt);
      syncPlot(g);
    },
  }, { x: tx + 0.5, y: ty + 0.5 });
}

function harvest(g: GameScene, tx: number, ty: number): void {
  const tile = tileNow(g, tx, ty);
  if (!tile.crop || !Inventory.canAdd(CROPS[tile.crop].item)) {
    g.onHint?.('My satchel is full. I should eat something, or leave it for later.');
    return;
  }
  GameAudio.rustle();
  startChannel(g, {
    label: 'Picking',
    seconds: PLOT_SECONDS.dig,
    onDone: () => {
      const got = Farm.harvest(tx, ty, g.clock.elapsedHours, rainAt);
      syncPlot(g);
      if (!got) return;
      give(g, got.item, got.count);
      if (!QuestLog.hasFlag('plot-first-harvest')) {
        QuestLog.setFlag('plot-first-harvest');
        QuestLog.writeDiary(`Pulled my first ${itemDef(got.item).name.toLowerCase()}s from the plot in Iran's yard. Grown from seed, by my own hand. They taste better for it.`);
      }
    },
  }, { x: tx + 0.5, y: ty + 0.5 });
}
