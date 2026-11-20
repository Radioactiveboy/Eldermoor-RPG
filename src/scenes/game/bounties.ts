/** The militia's notice board in the market square: looking at it, taking a notice, and being paid (see systems/Bounties.ts). */
import { GameAudio } from '../../audio/Audio';
import { BOUNTIES, BOUNTY_IDS, Bounties, BountyId } from '../../systems/Bounties';
import type { FoeKind } from '../../systems/Combat';
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

/** A notice taken down from the board: the bounty's quest begins, with a line in the diary. */
export function takeBounty(id: BountyId): void {
  if (!Bounties.take(id)) return;
  const def = BOUNTIES[id];
  QuestLog.writeDiary(
    `Took a notice down from the militia's board in the square: ${def.title.replace('Bounty: ', '').toLowerCase()}. ` +
      `${def.coins} coins from the reeve's purse when it's done.`,
  );
}

/** Beasts killed in a fight: counted towards any bounties on them, and a line in the diary for any bounty now done. Returns what to tell the hero. */
export function countForBounties(kinds: FoeKind[]): string[] {
  const before = new Set(BOUNTY_IDS.filter((id) => Bounties.state(id) === 'ready'));
  const said = Bounties.slain(kinds);
  for (const id of BOUNTY_IDS) {
    if (before.has(id) || Bounties.state(id) !== 'ready') continue;
    QuestLog.writeDiary(`That is the militia's bounty done: ${BOUNTIES[id].title.replace('Bounty: ', '').toLowerCase()}. Back to the board in the square to be paid.`);
  }
  return said;
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
