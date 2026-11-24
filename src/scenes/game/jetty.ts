/**
 * Adowvale Jetty (world/JettyMap.ts): arriving at the river. The people there
 * are in entities/Npc.ts and dialogue/jetty.ts; the boat that will one day
 * carry the hero up and down the Wend is systems/Voyages.ts (and voyages.ts here).
 */
import { QuestLog } from '../../systems/Quests';
import type { GameScene } from '../GameScene';

/** The first time down at the river: a thought on arriving, and a line in the diary. */
export function enteredJetty(g: GameScene): void {
  if (g.visited.has('jetty')) return;
  g.time.delayedCall(1100, () => g.onHint?.('The river! I could smell it from the lane: weed and tar and woodsmoke. Boats, nets, gulls on every post.'));
  QuestLog.writeDiary(
    'Went down the lane past the garrison to Adowvale Jetty, on the river Wend. Fishing huts, a smokehouse, nets hung out to dry, and a pier ' +
      'out over the water with a proper sailing boat tied up at it, the Grey Heron. The river is wider than I ever imagined.',
  );
}

