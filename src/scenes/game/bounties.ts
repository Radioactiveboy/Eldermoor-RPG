/** The militia's notice board in the market square: looking at it, taking a notice, and being paid (see systems/Bounties.ts). */
import { GameAudio } from '../../audio/Audio';
import { BOUNTIES, Bounties, BountyId } from '../../systems/Bounties';
import { QuestLog } from '../../systems/Quests';
import type { BountyBoardSceneData } from '../BountyBoardScene';
import type { GameScene } from '../GameScene';

/** Steps up to the board: it opens close up (scenes/BountyBoardScene.ts). */
export function readBountyBoard(g: GameScene): void {
  if (!g.takeControls()) return;
  const data: BountyBoardSceneData = { onTake: takeBounty, onClaim: claimBounty };
  g.scene.launch('BountyBoard', data);
  g.scene.get('BountyBoard').events.once('board-closed', () => g.release());
}

export function takeBounty(id: BountyId): void {
  Bounties.take(id);
}

/** Paid at the board: coins, standing, the quest done, and a line in the diary. */
export function claimBounty(id: BountyId): void {
  if (!Bounties.claim(id)) return;
  GameAudio.coins();
  const def = BOUNTIES[id];
  const what = def.title.replace('Bounty: ', '').toLowerCase();
  const times = Bounties.timesClaimed(id);
  QuestLog.writeDiary(
    times === 1
      ? `Claimed the militia's bounty: ${what}. ${def.coins} coins from the reeve's purse, and the sergeant knows my name now.`
      : `Another of the militia's bounties paid: ${what}, ${def.coins} coins. That's ${times} times now.`,
  );
}
