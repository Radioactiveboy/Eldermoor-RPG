/**
 * How things stand at the old beacon on Corbie Tor (scenes/game/beacon.ts has
 * the story): kept apart so the people, the maps and the menus can ask without
 * pulling in the scene's code.
 */
import type { BeaconOutcome, BeaconStage } from '../dialogue/beacon';
import type { BeaconHolders } from '../world/BeaconMap';
import { QuestLog } from './Quests';

export const BEACON_QUEST = 'the-beacon';

/** How the beacon was settled, if it has been. */
export function beaconOutcome(): BeaconOutcome | undefined {
  return (['fought', 'paid', 'hired'] as const).find((o) => QuestLog.hasFlag(`beacon-${o}`));
}

/** Who holds the tower now. */
export function beaconHolders(): BeaconHolders {
  const outcome = beaconOutcome();
  return outcome === 'hired' ? 'keepers' : outcome ? 'empty' : 'brigands';
}

/** How the Headman's errand stands, for his conversation: offered once Mother is home and buried. */
export function beaconStage(): BeaconStage | undefined {
  const quest = QuestLog.get(BEACON_QUEST);
  if (quest?.completed) return 'done';
  if (quest) return quest.done.has('brigands') && quest.done.has('brazier') ? 'report' : 'active';
  return QuestLog.isDone('the-raid', 'bury') ? 'offer' : undefined;
}

