/**
 * The Reeve's toll house at the Fen Gate (world/TollHouseMap.ts): the hero's
 * first thoughts in each room, the stairs Gaff keeps by day and the strongroom
 * door Lardy keeps by night, what's in the strongroom (the Reeve's true book,
 * the letter signed V., the coffer of foreign silver, Annet's creels), the key
 * on its hook by the Reeve's bed, and what the toll house folk's talk sets going.
 */
import { GameAudio } from '../../audio/Audio';
import { Inventory, ItemId } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import {
  ANNET_EELS, FLOOD_TOLL_QUEST, GAFF_HOURS, HEARING_FEE, REEVE_ASLEEP_UNTIL, REEVE_SILVER_QUEST, TALLOW_REWARD, TOLL_FLAGS,
  tollDoneAlready, tollStep,
} from '../../systems/TollHouse';
import type { Door, Sight } from '../../world/MapData';
import type { GameScene } from '../GameScene';
import { give } from './sights';

const flag = (f: string) => QuestLog.hasFlag(f);

/** Into the toll office, the first time. */
export function enteredTollHouse(g: GameScene): void {
  if (g.visited.has('tollhouse')) return;
  const open = g.clock.hour >= GAFF_HOURS[0] && g.clock.hour < GAFF_HOURS[1];
  g.time.delayedCall(1000, () =>
    g.onHint?.(open
      ? 'Warm, for Gloomhaven: a coal fire, and ink, and wet wool. A queue of one woman on a bench, a clerk behind an iron grille, and a man in a yellow armband smiling at me with half his teeth.'
      : 'Dark but for the brazier. Somebody very large is sitting by the iron door at the back, eating, and has stopped eating to look at me.'),
  );
  QuestLog.writeDiary(
    "Went into the Reeve's toll house by the Fen Gate. There is a grille across the room like a pawnbroker's, and behind it a little clerk " +
      'and more ledgers than I have seen in my life. In the corner by the door is a heap of things taken off folk who couldn\'t pay, every one ' +
      "chalked DISTRAINED. The men keeping the place wear a yellow band on the arm. They don't look like any town guard I've seen. They look like the people a town guard is for.",
  );
}

/** Into the strongroom, the first time. */
export function enteredTollStrong(g: GameScene): void {
  if (!flag(TOLL_FLAGS.strongOpen)) return;
  tollStep(REEVE_SILVER_QUEST, 'strong');
  if (g.visited.has('tollhouse-strong')) return;
  g.time.delayedCall(900, () => g.onHint?.('Cold stone, one slit of a window, and chests. A great many chests. On a stand by the far wall, a big book lies open, as if someone has just stopped writing in it.'));
}

/** Up the stairs, the first time. */
export function enteredTollUpstairs(g: GameScene): void {
  if (g.visited.has('tollhouse-upstairs')) return;
  const asleep = g.clock.hour < REEVE_ASLEEP_UNTIL;
  g.time.delayedCall(900, () =>
    g.onHint?.(asleep
      ? 'Snoring, from the big bed at the back, and a smell of cloves and wine. Every candle is out but one. Gilt glints at me from every wall.'
      : 'Panelling, a carpet, a looking-glass, a bird in a gilt cage. Downstairs is a toll house. Upstairs is a lord\'s house that has been put down on top of it.'),
  );
  QuestLog.writeDiary(
    "Went up to the Reeve's own rooms over the toll house. There's a carpet, a copper bath, wine, a goldfinch in a gilt cage and coats " +
      "enough for a king. Downstairs folk sit for three days waiting to get their creels back. It's all the same house.",
  );
}

/**
 * Doors in the toll house that may be shut: the stairs, while Gaff keeps them,
 * until Nibb's had the hearing fee; and the strongroom, till Lardy's been fed or
 * the hero has the key.
 */
export function tollDoorAllowed(g: GameScene, door: Door): boolean {
  if (g.area === 'tollhouse' && door.to === 'tollhouse-upstairs') {
    if (flag(TOLL_FLAGS.hearing) || !g.someone('gaff')) return true;
    GameAudio.rattle();
    g.someone('gaff')?.say(Math.random() < 0.5 ? `Hearing's ${HEARING_FEE} coin, fish. Clerk first.` : 'Up there? Not without paying the clerk, you\'re not.', 3);
    g.onHint?.('Gaff Tully steps across the foot of the stairs with his boathook, grinning. The clerk at the grille takes names for a hearing.');
    return false;
  }
  if (door.id !== 'toll-strong' || flag(TOLL_FLAGS.strongOpen)) return true;
  GameAudio.rattle();
  const lardy = g.someone('lardy');
  if (lardy) {
    lardy.say('Nobody goes in.', 2.5);
    g.onHint?.('Lardy Mott fills the doorway like a side of beef, chewing. He doesn\'t get up. He doesn\'t need to.');
  } else {
    g.onHint?.('Iron-bound, and locked, with a lock the size of my hand. The key will be wherever the Reeve keeps it. Or someone keeps the door at night who might open it for the right price.');
  }
  return false;
}

/** The toll house's dialogue actions: `toll-<name>`, and `toll-feed-lardy:<item>`. Returns false if it isn't one. */
export function tollAction(g: GameScene, action: string): boolean {
  if (action.startsWith('toll-feed-lardy:')) {
    feedLardy(g, action.slice(16) as ItemId);
    return true;
  }
  const run = TOLL_ACTIONS[action];
  if (!run) return false;
  run(g);
  return true;
}

/** Lardy takes the hero's food round the corner to eat it slowly, and the strongroom is on the latch. */
function feedLardy(g: GameScene, item: ItemId): void {
  if (flag(TOLL_FLAGS.fedLardy) || !Inventory.remove(item, 1)) return;
  QuestLog.setFlag(TOLL_FLAGS.fedLardy);
  openStrongroom();
  QuestLog.writeDiary(
    "Gave Lardy Mott, the Red Apron on the Reeve's strongroom door, something to eat. He looked at it as if nobody had ever given him anything. " +
      'Then he went and sat round the corner to eat it slowly, and left the door on the latch.',
  );
  g.afterTalk = () => g.someone('lardy')?.say('Mm. Mmm.', 3);
}

function openStrongroom(): void {
  QuestLog.setFlag(TOLL_FLAGS.strongOpen);
}

/** What the toll house folk's talk sets going (see dialogue/tollhouse.ts), and Vosk's and Tallow's. */
const TOLL_ACTIONS: Record<string, (g: GameScene) => void> = {
  'toll-hearing': () => {
    if (flag(TOLL_FLAGS.hearing) || !Inventory.addCoins(-HEARING_FEE)) return;
    GameAudio.coins();
    QuestLog.setFlag(TOLL_FLAGS.hearing);
  },
  'toll-nibb-told': () => {
    if (flag(TOLL_FLAGS.nibbTold)) return;
    QuestLog.setFlag(TOLL_FLAGS.nibbTold);
    QuestLog.writeDiary(
      "Nibb the clerk owned up: there are two sets of books, and the true one, in the Reeve's own hand, is on a stand in the strongroom. " +
        'The key hangs by the Reeve\'s bed, and he sleeps like the dead from midnight. Or there is Lardy Mott, who keeps the door at night, and would sell his mother for a pie.',
    );
  },
  'toll-reeve-heard': () => {
    if (flag(TOLL_FLAGS.reeveHeard)) return;
    QuestLog.setFlag(TOLL_FLAGS.reeveHeard);
    tollStep(FLOOD_TOLL_QUEST, 'reeve');
    QuestLog.writeDiary(
      "Had my hearing with the Reeve, Corvin Sallow. He stood me in front of his desk in his furs, smelling of cloves, and told me the toll stands. " +
        "Then he offered me work: collecting it, from the folk who won't pay the Watch. Starting with Hobb Tallow. Words won't shift that man. Something else will have to.",
    );
  },
  'toll-start-flood': () => {
    QuestLog.start(FLOOD_TOLL_QUEST, tollDoneAlready(FLOOD_TOLL_QUEST));
  },
  'toll-start-silver': () => {
    QuestLog.start(REEVE_SILVER_QUEST, tollDoneAlready(REEVE_SILVER_QUEST));
  },
  'toll-annet-creels': (g) => {
    if (flag(TOLL_FLAGS.creelsBack) || !flag(TOLL_FLAGS.creels)) return;
    QuestLog.setFlag(TOLL_FLAGS.creelsBack);
    tollStep(FLOOD_TOLL_QUEST, 'creels');
    g.afterTalk = () => give(g, 'eel', ANNET_EELS);
    QuestLog.writeDiary("Gave Annet Marl her creels back. She didn't ask how I got them, and gave me eels out of her bucket so I'd stop her crying.");
  },
  'toll-return': () => {
    if (flag(TOLL_FLAGS.lifted)) return;
    QuestLog.setFlag(TOLL_FLAGS.lifted);
    QuestLog.complete(REEVE_SILVER_QUEST, 'return');
    tollStep(FLOOD_TOLL_QUEST, 'lifted');
    QuestLog.writeDiary(
      "Gave Captain Vosk what I found in the Reeve's strongroom. He read it twice, and went very still. He's going up the Reeve's stairs with a fair copy " +
        "for him to read, and the toll comes off the small folk tonight, or the steward at Harrowford has it by the morning barge. He doesn't know who V. is. " +
        'He said not to say the name in the Rose. I think he can guess the colour of the coat.',
    );
  },
  'toll-tallow-done': () => {
    if (QuestLog.get(FLOOD_TOLL_QUEST)?.completed) return;
    QuestLog.complete(FLOOD_TOLL_QUEST, 'tell');
    Inventory.reward(TALLOW_REWARD);
    GameAudio.coins();
  },
};

/** The strongroom and the Reeve's rooms: what's handled here rather than as a plain thought. Returns false if it isn't one. */
export function examineAtTollHouse(g: GameScene, sight: Sight): boolean {
  switch (sight.id) {
    case 'toll-ledger':
      GameAudio.pageTurn();
      g.onHint?.(
        "The true book, in a big looping hand that isn't Nibb's. 'Tolls taken': a few hundred silver since midsummer. And above it, every new moon, 'From V.', ten times as much. " +
          "Paid out: so much 'to Ketch', so much 'to Rendle', a little to Nibb, and the biggest column of all: 'Kept back for the Reeve's own'.",
      );
      if (!flag(TOLL_FLAGS.ledger)) {
        QuestLog.setFlag(TOLL_FLAGS.ledger);
        tollStep(REEVE_SILVER_QUEST, 'ledger');
        QuestLog.writeDiary(
          "Read the Reeve's true book, in the strongroom. The Flood Toll is nothing to him: a few hundred silver. What pays for the furs and the Watch is " +
            "'From V.', every new moon, ten times as much. He pays the Hooks and the Red Aprons out of it, and keeps the most for himself.",
        );
      }
      return true;
    case 'toll-letter':
      GameAudio.pageTurn();
      g.onHint?.(
        "Folded in the back of the book, a letter on thick grey paper. 'For the Reeve's continued good offices, at the gate and on the river, the enclosed. " +
          "A further sum at the dark of the moon. Burn this. —V.' He didn't burn it. The seal is grey wax, pressed with an open eye.",
      );
      if (!flag(TOLL_FLAGS.letter)) {
        QuestLog.setFlag(TOLL_FLAGS.letter);
        tollStep(REEVE_SILVER_QUEST, 'letter');
        QuestLog.writeDiary(
          "Found a letter in the Reeve's book, sealed with grey wax pressed with an eye: 'For the Reeve's continued good offices, at the gate and on the river.' " +
            'Signed only V. The gentleman in grey at the Black Rose has a ledger of his own. I wonder what letter his name begins with.',
        );
      }
      return true;
    case 'toll-coffer':
      QuestLog.setFlag(TOLL_FLAGS.coffer);
      GameAudio.coins();
      g.onHint?.(
        "A little coffer apart from the chests, full of silver. Not our silver: square-holed coins, struck with a script I can't read, that runs round the hole like a snake eating its tail. Foreign money. Heavy, and very new.",
      );
      return true;
    case 'toll-creels':
      if (flag(TOLL_FLAGS.creels)) {
        g.onHint?.(flag(TOLL_FLAGS.creelsBack) ? 'An empty corner where Annet\'s creels were.' : "I've got Annet's creels already. She's waiting on the bench in the toll office.");
        return true;
      }
      GameAudio.rustle();
      QuestLog.setFlag(TOLL_FLAGS.creels);
      g.onHint?.(
        "Willow eel creels, a dozen, nested one in another, tied with a DISTRAINED tag: 'MARL, A. Four silver, and rising.' One has a mend in blue twine. I tear off the tag and take them. They're lighter than they look.",
      );
      return true;
    case 'toll-key':
      if (flag(TOLL_FLAGS.hasKey)) {
        g.onHint?.('An empty hook. The key is in my pocket. I should put it back before he wakes. I won\'t.');
        return true;
      }
      if (g.someone('reeve')) {
        g.onHint?.("A big iron key on a hook by the bed: the strongroom's, I'd guess. With the Reeve sitting there watching me over his desk, I don't think I'll reach for it.");
        return true;
      }
      GameAudio.pickup();
      QuestLog.setFlag(TOLL_FLAGS.hasKey);
      openStrongroom();
      g.onHint?.('I lift the big iron key off its hook, an inch at a time. Behind the curtains, the Reeve snores, sighs, and snores again. The strongroom is mine.');
      QuestLog.writeDiary("Took the strongroom key off the hook by the Reeve's bed while he snored. I don't think I have ever done anything so foolish, or felt so pleased with myself.");
      return true;
    case 'toll-bed':
      g.onHint?.(
        g.clock.hour < REEVE_ASLEEP_UNTIL
          ? "The Reeve, asleep on his back under a heap of furs, his mouth open, a pomander still clutched in one hand. He snores like a saw in wet wood. He does not look dangerous asleep. Hardly anyone does."
          : 'A great bed with yellow curtains and a heap of furs on it. On the pillow, a nightcap with a tassel. There is nothing in Gloomhaven like this bed, and there is nobody in it but him.',
      );
      return true;
    case 'toll-desk':
      g.onHint?.(
        g.someone('reeve')
          ? 'Papers, seals, a silver inkstand. The Reeve lays a long yellow hand flat on them as I look. "Those are the town\'s," he says. "Not yours."'
          : 'Licences, written out and waiting to be sold: to land a catch, to sell a candle, to keep a goat. A draft proclamation: a toll on the Black Rose\'s ale, crossed out, hard, twice.',
      );
      return true;
    default:
      return false;
  }
}
