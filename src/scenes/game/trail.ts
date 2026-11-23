/**
 * Following the goblins' trail through the north woods after the raid (see
 * world/NorthWoodsMap.ts): what moves the Ashes quest on as the hero goes.
 * Kept apart from raid.ts so travel.ts can use it without pulling in the
 * rest of the scene's code.
 */
import { QuestLog } from '../../systems/Quests';

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
