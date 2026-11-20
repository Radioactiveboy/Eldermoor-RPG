/** The militia's notice board in the market square: reading it, taking a notice, and being paid (see systems/Bounties.ts). */
import { GameAudio } from '../../audio/Audio';
import { bountyBoardScript } from '../../dialogue/bounties';
import { BOUNTIES, Bounties, BountyId } from '../../systems/Bounties';
import { QuestLog } from '../../systems/Quests';
import { Reputation } from '../../systems/Reputation';
import type { GameScene } from '../GameScene';

export function readBountyBoard(g: GameScene): void {
  GameAudio.click();
  g.readScript(bountyBoardScript(Bounties.notices(), Reputation.level('militia')));
}

/** `bounty:take:<id>` or `bounty:claim:<id>` (the part after 'bounty:'). */
export function bountyAction(_g: GameScene, action: string): void {
  const [what, id] = action.split(':') as ['take' | 'claim', BountyId];
  if (!(id in BOUNTIES)) return;
  if (what === 'take') {
    Bounties.take(id);
    return;
  }
  if (what === 'claim' && Bounties.claim(id)) {
    GameAudio.coins();
    const def = BOUNTIES[id];
    const times = Bounties.timesClaimed(id);
    QuestLog.writeDiary(
      times === 1
        ? `Claimed the militia's bounty: ${def.title.replace('Bounty: ', '').toLowerCase()}. ${def.coins} coins from the reeve's purse, and the sergeant knows my name now.`
        : `Another of the militia's bounties paid: ${def.title.replace('Bounty: ', '').toLowerCase()}, ${def.coins} coins. That's ${times} times now.`,
    );
  }
}
