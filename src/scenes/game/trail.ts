/**
 * Following the goblins' trail through the north woods after the raid (see
 * world/NorthWoodsMap.ts): what moves the Ashes quest on as the hero goes.
 * Kept apart from raid.ts so travel.ts can use it without pulling in the
 * rest of the scene's code.
 */
import { SHAREABLE_FOOD } from '../../dialogue/wayfarers';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import type { GameScene } from '../GameScene';

/** The goblins' trail through the north woods (see world/NorthWoodsMap.ts): what moves the Ashes quest on as the hero follows it. */
export function lookedAtTrailSign(id: string): void {
  if (!QuestLog.hasFlag('raid-over')) return;
  if (id === 'nw-goblin-torch' && !QuestLog.hasFlag('saw-goblin-torch')) {
    QuestLog.setFlag('saw-goblin-torch');
    QuestLog.complete('the-raid', 'trail');
  } else if (id === 'nw-quilt-scrap' && !QuestLog.isDone('the-raid', 'signs')) {
    QuestLog.complete('the-raid', 'trail');
    QuestLog.complete('the-raid', 'signs');
    QuestLog.writeDiary(
      "A scrap of Mother's quilt, the red patchwork one, caught on a bramble beside their trail. They carried her this far wrapped " +
        'in it, and carried her carefully, or it would be dragged through the mud and not torn high on the thorns. She was alive here.',
    );
  }
}

/** Standing where the goblins' trail runs off into the deep woods: as far as the hero can follow it, for now. */
export function reachedTrailEnd(): void {
  if (!QuestLog.hasFlag('raid-over') || QuestLog.isDone('the-raid', 'edge')) return;
  QuestLog.complete('the-raid', 'trail');
  QuestLog.complete('the-raid', 'edge');
  QuestLog.writeDiary(
    'The trail runs on north out of the woods I know, up towards the Greyfells, and there were dozens of them. Iran was right. ' +
      "I can't do this alone and half beaten. I'll take word to the militia in Adowvale, and see who will help.",
  );
}

/** Whether the goblins' trail leads on off the north woods, up onto the Greyfells: once the goblin in the cells has said where it goes. */
export function greyfellsOpen(): boolean {
  return QuestLog.hasFlag('raid-over') && QuestLog.isDone('the-raid', 'prisoner');
}

/** Telling Sergeant Brannock where the trail goes (dialogue/garrison.ts): he has a goblin in the cells. */
export function toldSergeant(): void {
  if (QuestLog.isDone('the-raid', 'sergeant')) return;
  QuestLog.complete('the-raid', 'word');
  QuestLog.complete('the-raid', 'sergeant');
  QuestLog.writeDiary(
    'Told Sergeant Brannock where their trail goes. He has no men to send, but he has something else: his lads caught a goblin two nights ' +
      "after the raid, skulking round Coombe's fold, and it's in the cells under the garrison. It won't talk to them. He thinks it might talk to me.",
  );
}

/** The goblin in the cells talked (dialogue/garrison.ts): the Mother, the healer, and the hole on the Greyfells. */
export function questionedGoblin(): void {
  if (QuestLog.isDone('the-raid', 'prisoner')) return;
  QuestLog.complete('the-raid', 'word');
  QuestLog.complete('the-raid', 'sergeant');
  QuestLog.complete('the-raid', 'prisoner');
  QuestLog.writeDiary(
    "The goblin in the cells is called Snikkit, and in the end it talked. They took Mother because she is a healer: they could smell " +
      "the medicine on her. Their own Mother, the great one who lays their young, is dying, and they want her made well. She is alive, then. " +
      'They have her in a hole in the hill on the Greyfells, at the top of the trail. I am going up there.',
  );
}

/** The Headman offers to pay Sigrun's hire out of the village chest (dialogue/residence.ts). */
export function headmanPaysSigrun(): void {
  if (QuestLog.hasFlag('headman-pays-sigrun')) return;
  QuestLog.setFlag('headman-pays-sigrun');
  QuestLog.writeDiary(
    "Told Headman Hale what the goblin said. He can't send the militia, but he'll pay a sellsword out of the village chest: Sigrun, " +
      "who drinks at the Tankard. \"Tell her Hale sends you and Hale pays.\" I won't have to go down that hole alone.",
  );
}

/** Handing Snikkit, the goblin in the cells, something to eat through the bars. */
export function fedGoblin(): void {
  const food = SHAREABLE_FOOD.find((id) => Inventory.count(id) > 0);
  if (!food) return;
  Inventory.remove(food, 1);
  QuestLog.setFlag('fed-snikkit');
}

/** The story's dialogue actions on the way to the Greyfells. */
export const TRAIL_ACTIONS: Record<string, () => void> = {
  'told-sergeant': toldSergeant,
  'fed-goblin': fedGoblin,
  'questioned-goblin': questionedGoblin,
  'headman-pays-sigrun': headmanPaysSigrun,
};

/** The things in the goblins' camp on the Greyfells that move the Ashes quest on, and what the hero writes of each. */
const CAMP_FINDS: Record<string, { step?: string; flag: string; diary: string }> = {
  'gf-litter': {
    step: 'camp',
    flag: 'saw-gf-litter',
    diary:
      "Found where they rested on the fell, at a camp round a fire. Mother's quilt is there, on a litter of poles they carried her on, and " +
      'the blood on it is old and dry. Beside it someone had left her a bowl of water and a cup. Goblins, looking after a prisoner. ' +
      'Whatever they want with her, they want her alive.',
  },
  'gf-stone': {
    flag: 'saw-gf-stone',
    diary:
      'There is a stone at the camp with pictures scratched on it and rubbed with red earth: a great swollen figure lying down with a crown ' +
      'of spikes, little ones all round her, and a tall thin one apart from them holding out a cup. I keep thinking about that cup.',
  },
  'gf-warren': {
    step: 'warren',
    flag: 'saw-gf-warren',
    diary:
      "The trail ends at a hole in the hillside above the camp. Warm air breathes out of it, and far down I could hear them, more than I " +
      'could count. She is down there. I know it. And I would not last a minute down there alone. I need someone at my back.',
  },
};

/** Looking at something in the goblins' camp. */
export function lookedAtCamp(id: string): void {
  const find = CAMP_FINDS[id];
  if (!find || !QuestLog.hasFlag('raid-over') || QuestLog.hasFlag(find.flag)) return;
  QuestLog.setFlag(find.flag);
  QuestLog.complete('the-raid', 'fells');
  if (find.step === 'warren') QuestLog.complete('the-raid', 'camp');
  if (find.step) QuestLog.complete('the-raid', find.step);
  QuestLog.writeDiary(find.diary);
}

/** Up onto the Greyfells: the first time, a thought and a diary line, and the quest moves on. */
export function enteredGreyfells(g: GameScene): void {
  QuestLog.complete('the-raid', 'fells');
  if (g.visited.has('greyfells')) return;
  g.time.delayedCall(1000, () =>
    g.onHint?.('Out of the trees at last, onto open moor. Wind, heather, grey stone. And smoke, up ahead: a fire, where nobody honest would light one.'),
  );
  QuestLog.writeDiary(
    "Followed the goblins' trail up out of the north woods onto the Greyfells: open moor, heather and grey rock, and the wind never stops. " +
      'There is smoke rising from a fire further up the trail.',
  );
}
