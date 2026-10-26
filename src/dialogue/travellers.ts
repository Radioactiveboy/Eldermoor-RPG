import type { DialogueScript } from './Dialogue';

/**
 * Folk travelling the road past the cottage. Most don't start quests (Wil the
 * drover, who has lost two ewes, is the exception); they pass the time of day and know a little about Eldermoor and what's around it.
 * Each has a first meeting, a shorter hello afterwards, and a few things to ask.
 */

export const PEDLAR: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'pedlar',
      lines: [
        "Ho there! Mind the pack, it swings. Bram's the name, needles and news, buttons and gossip, all for sale.",
        "Well. I say for sale. The Harrowford fair picked me clean, so mostly it's the news I've got left.",
      ],
      next: 'ask',
    },
    again: {
      speaker: 'pedlar',
      lines: ['Back for more news? Cheapest thing in my pack. Free, in fact.'],
      next: 'ask',
    },
    ask: {
      speaker: 'pedlar',
      lines: ['What would you know?'],
      choices: [
        { text: 'Why come this way? Nobody uses this road.', next: 'road' },
        { text: 'What news from the towns?', next: 'news' },
        { text: 'What are those stones up on the moor?', next: 'stones' },
        { text: 'Safe travels, Bram.', next: 'bye' },
      ],
    },
    road: {
      speaker: 'pedlar',
      lines: [
        "Floods took the bridge at Harrowford, so the King's Road's no good till spring. This old track goes round by the lake instead.",
        'Longer, mind. And quieter than I like. A quiet road is one where nobody hears you shout.',
      ],
      next: 'ask',
    },
    news: {
      speaker: 'pedlar',
      lines: [
        "Wolves, mostly. They've come down out of the Greyfells early this year. Lean ones. Hungry ones.",
        "A farmer by Thornwick lost half his flock in a night. Keep a stick handy if you walk out after dark, that's my advice.",
      ],
      next: 'ask',
    },
    stones: {
      speaker: 'pedlar',
      lines: [
        "The Nine Maidens? Older than the village, older than anyone's grandmother's grandmother.",
        "Folk say they were dancers turned to stone for dancing on a holy day. I say they're good for keeping the wind off while you eat your lunch.",
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'pedlar',
      lines: ['And to you. If you hear of anyone wanting thimbles, send them my way.'],
    },
  },
};

export const PILGRIM: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'pilgrim',
      lines: [
        'Peace on your house, child. I am Sister Ysolde, walking to the shrine of Saint Elda at the edge of the moor.',
        'I have been walking since the new moon. My feet would like a word with the saint when I get there.',
      ],
      next: 'ask',
    },
    again: {
      speaker: 'pilgrim',
      lines: ['Peace on you again, child.'],
      next: 'ask',
    },
    ask: {
      speaker: 'pilgrim',
      lines: ['Is there something on your mind?'],
      choices: [
        { text: 'Who was Saint Elda?', next: 'elda' },
        { text: 'My mother is sick. Do you know of moonpetal?', next: 'moonpetal' },
        { text: 'Why walk all this way?', next: 'why' },
        { text: 'Go safely, Sister.', next: 'bye' },
      ],
    },
    elda: {
      speaker: 'pilgrim',
      lines: [
        'A healer, long ago, when this was all bog and heather. They say she walked the moor with a lantern, finding the lost and tending the sick.',
        "Eldermoor is her moor: Elda's moor. The village took her name, though most have forgotten why.",
      ],
      next: 'ask',
    },
    moonpetal: {
      speaker: 'pilgrim',
      lines: [
        "Moonpetal... a pale flower. It grows by still water and only opens under the moon. Saint Elda's own remedy, the stories say.",
        'Any healer worth her salt keeps some dried. I will remember your mother at the shrine.',
      ],
      next: 'ask',
    },
    why: {
      speaker: 'pilgrim',
      lines: [
        'I made a promise, years ago, to someone who could no longer make the walk themselves.',
        'Some promises you keep with your feet.',
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'pilgrim',
      lines: ['And you, child. Keep a light by you after dark.'],
    },
  },
};

/**
 * How far along Wil's lost ewes are: not yet asked about, found before he
 * asked ('found-first'), being looked for, found, or the news given.
 */
export type SheepStage = 'none' | 'found-first' | 'active' | 'found' | 'done';

/**
 * Wil the drover, who has lost two of his master's ewes. He asks the hero to
 * look for them (see the 'lost-sheep' quest); once they're found he hears the
 * news and pays for the trouble.
 * @param first whether this is the first time they've met
 */
export function droverScript(stage: SheepStage, first: boolean): DialogueScript {
  const start = stage === 'active' ? 'waiting' : stage === 'found' ? 'back' : stage === 'done' ? 'thanks' : first ? 'greet' : 'again';
  return {
    start,
    nodes: {
      greet: {
        speaker: 'drover',
        lines: [
          "Oh! Sorry, you made me jump. Wil. I'm a drover, or I was meant to be, driving Master Coombe's ewes to market.",
          "Only I've lost two of them. Again. He'll have my hide.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'drover',
        lines: ["Still no sign of them. You'd think sheep would be easier to find. They're white."],
        next: 'ask',
      },
      waiting: {
        speaker: 'drover',
        lines: ['Any luck? The tracks went north, up the sheep track past your garden, to that cave in the hill.'],
        next: 'ask',
      },
      back: {
        speaker: 'drover',
        lines: ["You're back! And in one piece. Did you find them? Bess and Bramble?"],
        choices: [{ text: "I found them, Wil. I'm sorry.", next: 'news' }],
      },
      thanks: {
        speaker: 'drover',
        lines: ["Master Coombe took it better than I feared. Said wolves aren't my fault. Then docked my pay anyway."],
        next: 'ask',
      },
      ask: {
        speaker: 'drover',
        lines: ['You live round here?'],
        choices: [
          stage === 'found-first'
            ? { text: 'I found two ewes in a cave north of here. Wolves got them.', next: 'news' }
            : { text: 'How did you lose them?', next: 'lost' },
          { text: 'Tell me about the lake.', next: 'lake' },
          { text: 'Seen anything strange on the road?', next: 'strange' },
          { text: stage === 'done' ? 'Take care, Wil.' : 'Good luck finding them.', next: 'bye' },
        ],
      },
      lost: {
        speaker: 'drover',
        lines: [
          'Something spooked them last night by the lake. I found tracks in the mud this morning. Big ones. Bigger than a dog\'s.',
          'They went north, up past your cottage towards the old cave in the hill. Something dragged them, by the look of it.',
          "I'm not saying it was a wolf. I'm just saying I'm not going up there on my own.",
        ],
        // Not yet asked: the hero can offer to go and look.
        ...(stage === 'none'
          ? { choices: [{ text: "I'll go up there and look for them.", next: 'offer' }, { text: 'Rather you than me.', next: 'ask' }] }
          : { next: 'ask' }),
      },
      offer: {
        speaker: 'drover',
        lines: [
          'You would? Honest? Follow the sheep track north from your garden, up to the hill. That\'s where the tracks went.',
          "If they're alive, bring me word and I'll fetch them. If they're not... I'd still rather know. I'll make it worth your while.",
        ],
        action: 'start-sheep-quest',
      },
      news: {
        speaker: 'drover',
        lines: [
          'Wolves. In the cave. Both of them? ...Poor Bess. She always was the one to wander, and Bramble followed her everywhere.',
          "Well. At least now I know, and I can tell Master Coombe something better than \"they ran off\".",
          "Here. Master Coombe gave me coin for the road. You've earned it more than I have, going in there.",
        ],
        action: 'finish-sheep-quest',
      },
      lake: {
        speaker: 'drover',
        lines: [
          "Mirrormere, my gran called it. Still as glass on a calm day. There's a chapel at the bottom, she said, drowned when the river changed its course.",
          "On quiet nights you can hear its bell. I've never heard it. I've never stayed out late enough to try.",
        ],
        next: 'ask',
      },
      strange: {
        speaker: 'drover',
        lines: [
          "There's a pedlar with a pack bigger than he is, and a holy sister who walks slower than my sheep. That's about all.",
          "Oh, and the birds have all gone quiet down by the trees past your garden. Birds don't go quiet for nothing.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'drover',
        lines: [stage === 'done' ? 'And you. Mind the wolves.' : 'Thanks. If you see two ewes looking guilty, they answer to Bess and Bramble.'],
      },
    },
  };
}
