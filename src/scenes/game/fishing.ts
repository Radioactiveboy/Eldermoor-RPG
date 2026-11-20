/**
 * Fishing from the shore: the "Fish" prompt at the edge of any fishable water
 * once the hero has a rod from Old Tobin, and what a catch means (a diary line
 * for the first of each kind, a little experience). The minigame is
 * scenes/FishingScene.ts; what bites where and when is systems/Fishing.ts.
 */
import { GameAudio } from '../../audio/Audio';
import { gridToScreen } from '../../iso/IsoMath';
import { Experience } from '../../systems/Experience';
import { FISH, FishKind, ROD_PRICE, waterNear, WaterId, WATERS } from '../../systems/Fishing';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { Terrain } from '../../world/MapData';
import type { FishingSceneData } from '../FishingScene';
import type { GameScene } from '../GameScene';
import type { DialogueAction } from './dialogueActions';
import type { Interaction } from './interactions';
import { give } from './sights';
import { standUp } from './sitting';

/** Experience for landing a fish (the first of each kind is worth more). */
const CATCH_XP = 4;
const FIRST_CATCH_XP = 15;

/** "Fish" at the nearest water within reach of (gx, gy), if the hero has a rod and there's fishable water there. */
export function fishInteraction(g: GameScene, gx: number, gy: number): Interaction | undefined {
  const waters = g.map.data.waters;
  if (!waters || Inventory.count('fishing-rod') === 0) return undefined;
  const tx = Math.floor(gx);
  const ty = Math.floor(gy);
  let best: { x: number; y: number; d: number } | undefined;
  for (let y = ty - 2; y <= ty + 2; y++) {
    for (let x = tx - 2; x <= tx + 2; x++) {
      if (!g.map.inBounds(x, y) || g.map.data.terrain[y][x] !== Terrain.Water) continue;
      const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  if (!best) return undefined;
  const water = waterNear(waters, best.x + 0.5, best.y + 0.5);
  if (!water) return undefined;
  const p = gridToScreen(best.x + 0.5, best.y + 0.5);
  return {
    key: `fish:${best.x},${best.y}`, label: 'Fish', gx: best.x + 0.5, gy: best.y + 0.5, range: 1.6,
    promptX: p.x, promptY: p.y - 20, tile: { x: best.x, y: best.y },
    run: () => openFishing(g, water, best!),
  };
}

/** Sit down to fish: the hero faces the water and the fishing window opens. */
export function openFishing(g: GameScene, water: WaterId, at: { x: number; y: number }): void {
  if (g.seat) standUp(g);
  if (!g.takeControls()) return;
  g.player.faceTowards(at.x + 0.5, at.y + 0.5);
  const data: FishingSceneData = {
    water,
    hour: () => g.clock.hour,
    onCatch: (fish) => caughtFish(g, water, fish),
    onClose: () => g.release(),
  };
  g.scene.launch('Fishing', data);
}

/** A fish landed (and in the satchel): the first of each kind goes in the diary. */
export function caughtFish(g: GameScene, water: WaterId, fish: FishKind): void {
  const flag = `caught-${fish}`;
  const first = !QuestLog.hasFlag(flag);
  QuestLog.setFlag(flag);
  if (fish === 'boot') {
    if (first) g.time.delayedCall(600, () => g.onHint?.('A boot. I think it might be Tobin\'s boot.'));
    return;
  }
  Experience.gain(first ? FIRST_CATCH_XP : CATCH_XP, `Caught ${FISH[fish].name}`);
  if (!first) return;
  const lines: Partial<Record<FishKind, string>> = {
    perch: `Caught my first perch in ${WATERS[water].name}, green-gold and spiny. It will grill nicely.`,
    roach: `Caught a roach in ${WATERS[water].name}. Only a little one, but it counts.`,
    pike: `Landed a pike from ${WATERS[water].name}, all teeth and temper! Not Old Grandfather, but Tobin will want to hear about it.`,
    eel: `Pulled an eel out of ${WATERS[water].name} in the dark. It nearly wriggled back in.`,
    tench: `Caught a tench in ${WATERS[water].name}: fat, olive-green and slimy.`,
    carp: "Caught one of the brothers' golden carp. I shall not mention it to Brother Aldo.",
    trout: 'Caught a speckled brown trout in the cold pool under the Greyfells. The prettiest fish I have ever seen.',
  };
  const line = lines[fish];
  if (line) QuestLog.writeDiary(line);
}

/** What Old Tobin's conversation needs (see dialogue/fisherman.ts). */
export const FISHING_ACTIONS: Record<string, DialogueAction> = {
  'buy-rod': (g) => {
    if (Inventory.count('fishing-rod') > 0 || !Inventory.canAdd('fishing-rod')) {
      if (!Inventory.canAdd('fishing-rod')) g.onHint?.('My satchel is full. I need to make room for the rod.');
      return;
    }
    if (!Inventory.addCoins(-ROD_PRICE)) return;
    GameAudio.coins();
    give(g, 'fishing-rod', 1);
    QuestLog.writeDiary(
      `Bought Old Tobin's spare fishing rod for ${ROD_PRICE} coppers. He says perch and roach bite by day, pike at dawn and dusk, ` +
        'and eels at night, and that I am to leave Old Grandfather alone.',
    );
  },
  'tobin-boot': () => {
    if (QuestLog.hasFlag('tobin-boot')) return;
    QuestLog.setFlag('tobin-boot');
    Inventory.reward(3);
    GameAudio.coins();
  },
};
