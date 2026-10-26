import { HERO_NAME } from '../config';
import type { DialogueScript } from './Dialogue';

/**
 * Farmer Iran, who keeps hens on the hill north of the cottage, and his two
 * children. He has known the hero since they were small, so he calls them by
 * name. He sends them to the market for chicken feed (the 'chicken-feed'
 * quest), paying for it up front, and gives them eggs when they bring it back.
 */

/** How the errand stands: not asked yet, asked, the feed bought and in the satchel, or done. */
export type FeedStage = 'none' | 'active' | 'carrying' | 'done';

/** Coins Iran hands over for the feed. */
export const FEED_MONEY = 10;
/** Eggs he gives as thanks. */
export const EGG_REWARD = 4;

/**
 * @param first whether this is the first time they've spoken
 */
export function iranScript(stage: FeedStage, first: boolean): DialogueScript {
  const start = stage === 'carrying' ? 'feed-back' : stage === 'active' ? 'waiting' : stage === 'done' ? 'laying' : first ? 'greet' : 'again';
  return {
    start,
    nodes: {
      greet: {
        speaker: 'iran',
        lines: [
          `Well, I'll be. ${HERO_NAME}! Haven't seen you up this way since you were knee-high to a hen.`,
          "You won't remember me, I expect. Iran. I keep the chickens up here, and two children who make more noise than the chickens.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'iran',
        lines: [`${HERO_NAME}. Come to look at the hens again?`],
        next: 'ask',
      },
      waiting: {
        speaker: 'iran',
        lines: ["Back already? Hilde's bakehouse stall, in the market square. She keeps the feed in sacks round the back."],
        next: 'ask',
      },
      laying: {
        speaker: 'iran',
        lines: [`${HERO_NAME}! They're laying again, every one of them. Even Sir Reginald looks pleased with himself, and he lays nothing.`],
        next: 'ask',
      },
      ask: {
        speaker: 'iran',
        lines: ['What can I do for you?'],
        choices: [
          stage === 'none'
            ? { text: 'You look worried. Is something wrong?', next: 'trouble' }
            : { text: 'How are the hens?', next: 'hens' },
          { text: 'Who is the one with the big red comb?', next: 'rooster' },
          { text: 'Where are your children?', next: 'children' },
          { text: 'Goodbye, Iran.', next: 'bye' },
        ],
      },
      trouble: {
        speaker: 'iran',
        lines: [
          "Worried? I'm out of feed, that's what. The last sack split in the rain, and the hens have been scratching at bare dirt for two days.",
          "Hungry hens don't lay. And I can't leave the farm with wolves about, nor send the little ones all that way on their own.",
          "Would you go to the market for me? Hilde at the bakehouse stall sells sacks of feed. I'll give you the coin for it.",
        ],
        choices: [
          { text: 'Leave it with me.', next: 'accept' },
          { text: 'Not right now, sorry.', next: 'not-now' },
        ],
      },
      accept: {
        speaker: 'iran',
        action: 'start-feed-quest',
        lines: [
          `Good lad. Here, ${FEED_MONEY} coins. That's what Hilde charged me last time, robber that she is.`,
          "Bring it straight back here and I'll see you right. The hens will thank you too, in their way.",
        ],
      },
      'not-now': {
        speaker: 'iran',
        lines: ["No, no, you've your mother to think of. If you find yourself at the market, though, you know where I am."],
        next: 'ask',
      },
      'feed-back': {
        speaker: 'iran',
        lines: ['Is that... it is! A whole sack of feed! Listen to them, they can smell it from here.'],
        choices: [{ text: 'Here you are.', next: 'thanks' }],
      },
      thanks: {
        speaker: 'iran',
        action: 'finish-feed-quest',
        lines: [
          `Bless you, ${HERO_NAME}. Your mother raised you right.`,
          `Here, take these eggs. ${EGG_REWARD} of the best, laid this morning before they went on strike. Boil one up for her, eh? Do her good.`,
        ],
      },
      hens: {
        speaker: 'iran',
        lines:
          stage === 'done'
            ? ['Fat and happy and laying. I owe you for that.']
            : ['Hungry. Grumpy. They keep giving me looks.'],
        next: 'ask',
      },
      rooster: {
        speaker: 'iran',
        lines: [
          "That's Sir Reginald. He thinks he owns the place, and the hens let him think it.",
          "Don't turn your back on him. He's had the drover twice.",
        ],
        next: 'ask',
      },
      children: {
        speaker: 'iran',
        lines: [
          "Pip and Hetty? Indoors, squabbling, most likely. They've been at each other since breakfast.",
          "Go in and say hello, if you like. They'd love a visitor. Mind your ears.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'iran',
        lines: [stage === 'active' ? "Hilde's stall. Feed. Don't forget!" : 'Mind how you go, and give your mother my best.'],
      },
    },
  };
}

/** One line spoken in a speech bubble by one of the children. */
export type ChildLine = [child: 'pip' | 'hetty', text: string];

/** What Iran's children squabble about while nobody is listening. Each is played out line by line. */
export const SIBLING_BANTER: ChildLine[][] = [
  [['pip', 'Hetty smells like the hen house.'], ['hetty', 'We LIVE by the hen house, turnip-head.'], ['pip', 'Still.']],
  [['hetty', 'I can count to a hundred.'], ['pip', 'Go on, then.'], ['hetty', 'One, two... a hundred!'], ['pip', "That's cheating!"]],
  [['pip', 'When I grow up I\'m going to fight wolves.'], ['hetty', 'You ran away from a goose.'], ['pip', 'It was a BIG goose!']],
  [['hetty', 'Sir Reginald likes me best.'], ['pip', 'He pecked you yesterday.'], ['hetty', "That's how he shows it."]],
  [['hetty', 'Pip ate the last honey cake.'], ['pip', 'Did not!'], ['hetty', "You've got crumbs on your chin."], ['pip', '...'], ['pip', 'Those are old crumbs.']],
  [['pip', 'Bet I can hold my breath longer than you.'], ['hetty', '...'], ['pip', 'Hetty?'], ['hetty', 'Ha! You blinked. I win.'], ['pip', "That's not how it works!"]],
  [['hetty', "Da says you're not to touch the eggs."], ['pip', "Da says that to YOU. You dropped three."], ['hetty', 'Two. One bounced.']],
];

/** Hellos when the hero comes close. They all know Arthus from the cottage down the hill. */
export const SIBLING_GREETINGS: ChildLine[][] = [
  [['hetty', `It's ${HERO_NAME}! Hello, ${HERO_NAME}!`], ['pip', 'Hello! Did you bring us anything?'], ['hetty', "Don't be rude, Pip."]],
  [['pip', `${HERO_NAME}! Hello!`], ['hetty', `Hello, ${HERO_NAME}! Pip's being horrid.`], ['pip', 'Am not!']],
  [['hetty', `Hello again, ${HERO_NAME}!`], ['pip', 'Have you seen any wolves? Did you fight them?']],
];

/** Hellos once the hens have been fed. */
export const SIBLING_THANKS: ChildLine[][] = [
  [['hetty', `${HERO_NAME}! Da says you saved the hens!`], ['pip', 'We had eggs for breakfast. I had three.'], ['hetty', 'He had FOUR.']],
];
