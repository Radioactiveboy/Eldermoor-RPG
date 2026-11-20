/** The Hollow round the cottage: Wil's lost ewes, Farmer Iran's hens and his children, and the wolves' cave. */
import { GameAudio } from '../../audio/Audio';
import { EGG_REWARD, FEED_MONEY, SIBLING_GREETINGS, SIBLING_THANKS } from '../../dialogue/iran';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import type { GameScene } from '../GameScene';
import type { DialogueAction } from './dialogueActions';
import { give } from './sights';

/** Coins Wil pays for news of his ewes. */
export const SHEEP_REWARD = 30;

/** What the children say when the hero walks in: thanks once the hens are fed, a plain hello otherwise. */
export function siblingHello() {
  if (QuestLog.get('chicken-feed')?.completed) return SIBLING_THANKS[0];
  const met = QuestLog.hasFlag('met-iran-children');
  QuestLog.setFlag('met-iran-children');
  return met ? SIBLING_GREETINGS[2] : SIBLING_GREETINGS[Math.floor(Math.random() * 2)];
}

/** Into the wolves' den: the first time, the hero takes it in; on Wil's errand, that step is done. */
export function enteredCave(g: GameScene): void {
  QuestLog.complete('lost-sheep', 'cave');
  if (g.visited.has('cave')) return;
  g.time.delayedCall(1000, () => g.onHint?.('Cold, wet rock, and the stink of wolf. Something has been dragged in here.'));
}

/** The hens peck about by day and roost in the coop at night; now and then one clucks. */
export function updateHens(g: GameScene, dt: number): void {
  if (g.hens.length === 0) return;
  const hour = g.clock.hour;
  const roosting = hour >= 21 || hour < 6;
  const player = { x: g.player.gx, y: g.player.gy };
  for (const hen of g.hens) {
    hen.roosting = roosting;
    hen.update(dt, player);
  }
  g.cluckTimer -= dt;
  if (g.cluckTimer > 0 || roosting || g.busy) return;
  g.cluckTimer = 2 + Math.random() * 5;
  // Louder the closer the player is to the run.
  const pen = g.map.data.hens!.pen;
  const d = Math.hypot((pen.x0 + pen.x1) / 2 - player.x, (pen.y0 + pen.y1) / 2 - player.y);
  if (d < 12) GameAudio.cluck(Math.max(0.1, 1 - d / 12));
}

/** What Wil's and Farmer Iran's errands need from conversations (see dialogue/travellers.ts, iran.ts). */
export const HOLLOW_ACTIONS: Record<string, DialogueAction> = {
  'start-sheep-quest': () => {
    QuestLog.start('lost-sheep', ['talk']);
    QuestLog.writeDiary(
      "Met Wil the drover on the road again, still hunting for his master's two ewes. Something dragged them off " +
        'towards the cave in the hill north of the cottage. He is too scared to look, so I said I would.',
    );
  },
  'finish-sheep-quest': () => {
    // He may hear the news without having asked: the ewes were found first.
    QuestLog.start('lost-sheep', ['talk', 'cave', 'find']);
    QuestLog.complete('lost-sheep', 'tell');
    Inventory.reward(SHEEP_REWARD);
    GameAudio.coins();
    QuestLog.writeDiary(
      `Told Wil about Bess and Bramble. He took it quietly, then pressed ${SHEEP_REWARD} coins into my hand and would not ` +
        'hear of me giving them back. I hope his master is kinder to him than he expects.',
    );
  },
  'start-feed-quest': () => {
    if (QuestLog.has('chicken-feed')) return;
    QuestLog.start('chicken-feed', ['talk']);
    Inventory.reward(FEED_MONEY);
    GameAudio.coins();
    // Bought a sack already, before he asked.
    if (Inventory.count('chicken-feed') > 0) QuestLog.complete('chicken-feed', 'buy');
    QuestLog.writeDiary(
      'Met Farmer Iran up the hill, who keeps the hens. He remembered me as a boy. His hens have gone without feed for ' +
        `two days, so he gave me ${FEED_MONEY} coins to fetch a sack from Hilde at the market.`,
    );
  },
  'finish-feed-quest': (g) => {
    Inventory.remove('chicken-feed', 1);
    QuestLog.complete('chicken-feed', 'buy');
    QuestLog.complete('chicken-feed', 'return');
    give(g, 'egg', EGG_REWARD);
    QuestLog.writeDiary(
      "Took Iran his sack of feed. The hens mobbed him before he'd got it open. He sent me off with eggs for Mother, " +
        'and his little girl shouted goodbye from the doorway until I was halfway down the hill.',
    );
  },
};
