import type { BountyDef, NoticeState } from '../systems/Bounties';
import type { StandingLevel } from '../systems/Reputation';
import type { DialogueChoice, DialogueNode, DialogueScript } from './Dialogue';

/**
 * The militia's notice board in Adowvale's market square (see
 * systems/Bounties.ts), and the militiaman who leans on its post, minding it
 * and paying out. Taking a notice is the `bounty:take:<id>` action, and being
 * paid for one `bounty:claim:<id>` (scenes/game/bounties.ts).
 */
export interface BoardNotice {
  def: BountyDef;
  state: NoticeState;
  count: number;
}

const coins = (n: number) => `${n} coin${n === 1 ? '' : 's'}`;
const short = (def: BountyDef) => def.title.replace('Bounty: ', '');

/** @param standing how the militia regard the hero */
export function bountyBoardScript(notices: BoardNotice[], standing: StandingLevel): DialogueScript {
  const friendly = standing === 'liked' || standing === 'honoured';
  const nodes: Record<string, DialogueNode> = {};
  const choices: DialogueChoice[] = notices.map(({ def, state, count }) => {
    if (state === 'ready') return { text: `Claim: ${short(def)} (${coins(def.coins)})`, action: `bounty:claim:${def.id}`, next: `paid-${def.id}` };
    if (state === 'taken') return { text: `${short(def)}: ${count} of ${def.need} so far`, next: `progress-${def.id}` };
    if (state === 'claimed') return { text: `${short(def)} (paid today)`, next: 'claimed' };
    return { text: `Read: ${short(def)} (${coins(def.coins)})`, next: `read-${def.id}` };
  });
  for (const { def } of notices) {
    nodes[`read-${def.id}`] = {
      speaker: 'guard',
      lines: [`"${def.notice}"`, "That's the one. Want it? I'll put your name down."],
      choices: [
        { text: "I'll take it.", action: `bounty:take:${def.id}`, next: 'taken' },
        { text: 'Not this one.', next: 'board' },
      ],
    };
    nodes[`progress-${def.id}`] = {
      speaker: 'guard',
      lines: [`${def.task}, the notice says. Come back when it's done and I'll pay you out.`],
      next: 'board',
    };
    nodes[`paid-${def.id}`] = {
      speaker: 'guard',
      lines: [
        `${def.need === 1 ? 'Done' : 'All done'}? Good work. That's ${coins(def.coins)} from the reeve's purse.`,
        friendly ? "The sergeant'll hear of it. He's starting to think you're one of ours." : "I'll tell the sergeant. He likes to know who's useful.",
      ],
    };
  }
  return {
    start: 'greet',
    nodes: {
      ...nodes,
      greet: {
        speaker: 'guard',
        lines: [
          friendly
            ? "Morning! Come for a notice? The sergeant said to keep the good ones for you. They're all much the same, mind."
            : standing === 'distrusted'
              ? "The board. Bounties are for honest folk. ...Well, the reeve's not fussy. Have a look."
              : "The militia's board. Bounties, posted by the sergeant, paid by the reeve. Have a look.",
        ],
        next: 'board',
      },
      board: {
        speaker: 'guard',
        lines: [notices.length ? 'What catches your eye?' : 'Nothing up today. Come back in the morning.'],
        choices: [...choices, { text: 'Leave the board.', next: 'bye' }],
      },
      taken: {
        speaker: 'guard',
        lines: ["Right, that's you down for it. Off you go, then, and come back here when it's done."],
      },
      claimed: {
        speaker: 'guard',
        lines: ["You've had that one today already. The sergeant posts a new one in the morning."],
        next: 'board',
      },
      bye: {
        speaker: 'guard',
        lines: ['Mind how you go.'],
      },
    },
  };
}
