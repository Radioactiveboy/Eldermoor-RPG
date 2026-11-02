import { HERO_NAME } from '../config';
import type { DialogueScript } from './Dialogue';

/**
 * The brothers met within Saint Elda's walls, once Brother Wystan has opened
 * the gate to the hero: Prior Benedict at his prayers in the chapel, Brother
 * Anselm among his herbs in the cloister garden, Brother Leofric mending in
 * the infirmary, Brother Edmund at his copying in the scriptorium, and
 * Brother Hob at his hearth in the refectory. They all know by now who killed
 * the white wolf.
 */

/** Prior Benedict, at his prayers in the chapel: grave and courteous, and grateful for the road. */
export const PRIOR: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'prior',
      lines: [
        `...Amen. Ah. You will be ${HERO_NAME}, who killed the white wolf. Brother Wystan has told me. Several times.`,
        'I am Benedict, prior of this house. I barred our gate against the world, and you opened it again. I am not sure which of us did the better thing, but I am grateful.',
      ],
      next: 'ask',
    },
    again: {
      speaker: 'prior',
      lines: ['Peace be with you, my son.'],
      next: 'ask',
    },
    ask: {
      speaker: 'prior',
      lines: ['What is it you wish to ask?'],
      choices: [
        { text: 'Why did you bar the gate?', next: 'gate' },
        { text: 'My mother is sick with a fever.', next: 'mother' },
        { text: 'Tell me about this house.', next: 'house' },
        { text: "I'll leave you to your prayers, Father.", next: 'bye' },
      ],
    },
    gate: {
      speaker: 'prior',
      lines: [
        'Because every guest who came to us came along that road, and every one who left us went back along it, and I could not keep them safe on it.',
        'A gate is easy to shut and hard to open. Saint Elda never shut hers. I will try to remember that.',
      ],
      next: 'ask',
    },
    mother: {
      speaker: 'prior',
      lines: [
        'Then you have come to the right house. Saint Elda was a healer, and her brothers try to be. Brother Anselm is our infirmarian.',
        'You will find him in the cloister garden, among his herbs. Whatever he has is yours. That is not a favour. It is what we are for.',
      ],
      next: 'ask',
    },
    house: {
      speaker: 'prior',
      lines: [
        'Fourteen brothers, two novices, one porter who thinks he is the prior, and a cook who knows he is.',
        'We pray the hours, copy books, keep bees and a garden, and nurse anyone who comes to us sick. The chapel, the infirmary, the scriptorium, the refectory: go where you like. Only the dorter is ours alone.',
        'And if you are ever benighted here, there is a guest bed in the infirmary. Brother Anselm will not mind. Much.',
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'prior',
      lines: ['Go with God, and with the Saint.'],
    },
  },
};

/** How far along the hero is with Mother's medicine, as far as Brother Anselm is concerned. */
export type HerbStage = 'none' | 'asked' | 'picked';

/**
 * Brother Anselm, the infirmarian, among his herbs in the cloister garden. He
 * used the last of his dried moonpetal on Brother Leofric, but the fresh is
 * flowering round the pond, and he lets the hero pick it ('anselm-moonpetal').
 * The tincture also wants white willow bark, which he has none of.
 */
export function anselmScript(stage: HerbStage, first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'anselm',
        lines: [
          'Ah! Mind the feverfew, it bruises. There. Welcome, welcome. You are the young man who killed the white wolf.',
          'I am Anselm. I mend people, and I grow the things that mend them.',
        ],
        next: 'ask',
      },
      again: {
        speaker: 'anselm',
        lines: ['Back among the herbs? Good. They like company.'],
        next: 'ask',
      },
      ask: {
        speaker: 'anselm',
        lines: ['What can an old gardener do for you?'],
        choices: [
          stage === 'none'
            ? { text: 'My mother has a fever. She needs a tincture of moonpetal and willow bark.', next: 'tincture' }
            : stage === 'asked'
              ? { text: 'Which ones were the moonpetal again?', next: 'which' }
              : { text: "I've gathered the moonpetal.", next: 'picked' },
          { text: 'What is moonpetal?', next: 'what' },
          { text: 'How is Brother Leofric?', next: 'leofric' },
          { text: "I'll let you get on, Brother.", next: 'bye' },
        ],
      },
      tincture: {
        speaker: 'anselm',
        lines: [
          'Moonpetal and white willow, steeped together. Yes, that is the old remedy, and a good one. It breaks a fever and eases the chest.',
          'I had a jar of the dried, but it went on Brother Leofric when the wolves had him. Not to worry. The fresh is in flower now, round the pond. Silver-blue, like little stars.',
          'Pick the three blooms that are open, with my blessing. But you will need the willow bark as well, and that I have none of. White willow grows by water. Find some, and your mother shall have her tincture.',
        ],
        action: 'anselm-moonpetal',
        next: 'ask',
      },
      which: {
        speaker: 'anselm',
        lines: ['The pale ones on the rim of the pond, like stars. They shine a little after dark. Three blooms, and leave the rest to grow.'],
        next: 'ask',
      },
      picked: {
        speaker: 'anselm',
        lines: [
          'So you have. Keep them dry, and out of the sun. Steep them with the willow bark, a handful to a cup, and give it her warm, morning and night.',
          'And come back if she does not mend. That is what we are here for.',
        ],
        next: 'ask',
      },
      what: {
        speaker: 'anselm',
        lines: [
          'A little white flower that opens at the full of the moon and stays open as long as it is looked after. Saint Elda brought the first of it here, they say, from somewhere nobody remembers.',
          'It grows nowhere else in the shire. Believe me, I have looked.',
        ],
        next: 'ask',
      },
      leofric: {
        speaker: 'anselm',
        lines: ['Mending. He will limp till Candlemas and complain till Easter. Go and see him in the infirmary; he will want to thank you, and he is very bored.'],
        next: 'ask',
      },
      bye: {
        speaker: 'anselm',
        lines: ['Go well. And wash your hands before you pick anything.'],
      },
    },
  };
}

/** Brother Leofric, mending in the infirmary after the wolves caught him on the road. */
export const LEOFRIC: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'leofric',
      lines: [
        "You're the one who killed her? The white one? ...I could kiss you. I won't. Anselm says I'm not to get up.",
        'She came out of the grass on the road like a ghost. I never even saw the others. If Odo had not come by with his cart, I would be in her den now, and not in this nice bed.',
      ],
      next: 'ask',
    },
    again: {
      speaker: 'leofric',
      lines: ['Back to visit the invalid? Very kind. Nobody else does. Except Anselm, with his potions, which are vile.'],
      next: 'ask',
    },
    ask: {
      speaker: 'leofric',
      lines: ['Sit a while, if you like.'],
      choices: [
        { text: 'How is your leg?', next: 'leg' },
        { text: 'What were you doing on the road?', next: 'road' },
        { text: 'Rest well, Brother.', next: 'bye' },
      ],
    },
    leg: {
      speaker: 'leofric',
      lines: ['Stitched like a sack of wool. Anselm says I will walk by Candlemas. I say I will walk by Sunday. We have a bet on. The stakes are leeks.'],
      next: 'ask',
    },
    road: {
      speaker: 'leofric',
      lines: [
        'Taking our honey to Adowvale market, to sell. Twenty pots, and I got a good price, and then I lost every coin of it in the grass when she knocked me down.',
        'Somebody on the plains is going to find a purse one day and think the Saint has blessed them.',
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'leofric',
      lines: ['And you. Come back and tell me about it properly sometime. Leave out nothing. Especially the teeth.'],
    },
  },
};

/** Brother Edmund, copying an old herbal in the scriptorium, who knows a thing or two from his books. */
export const SCRIBE: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'scribe',
      lines: ["Oh! Sorry. I didn't hear you. Brother Edmund. I'm copying the herbal. Please don't breathe on the page, the ink isn't dry."],
      next: 'ask',
    },
    again: {
      speaker: 'scribe',
      lines: ["Hello again. I've done four more lines since you left. That's good, for me."],
      next: 'ask',
    },
    ask: {
      speaker: 'scribe',
      lines: ['Was there something?'],
      choices: [
        { text: 'What are you copying?', next: 'herbal' },
        { text: 'What do your books say about the old den on the plains?', next: 'den' },
        { text: "I'll leave you to it.", next: 'bye' },
      ],
    },
    herbal: {
      speaker: 'scribe',
      lines: [
        'The great herbal of Saint Elda. Every plant she knew, and what it cures. There is a whole page on moonpetal, with the willow bark, for fevers.',
        'It takes me a month a page. The Prior says patience is a virtue. I say so is finishing.',
      ],
      next: 'ask',
    },
    den: {
      speaker: 'scribe',
      lines: [
        'The knoll on the plains? There is an old account of it in the chronicle. Before the wolves, a hermit lived under that hill. He went in one winter, and did not come out.',
        'The chronicle says he went "down to the deep places". Nobody knows what that means. I like to think it means a cellar.',
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'scribe',
      lines: ['Mind the inkpot on your way out. Everyone kicks it.'],
    },
  },
};

/**
 * Brother Hob, the cook, at his hearth in the refectory. The first time, he
 * presses a loaf on the hero ('hob-bread').
 */
export function cookScript(fed: boolean): DialogueScript {
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'cook',
        lines: fed
          ? ['Back again? There is always pottage. There is always, always pottage.']
          : [
              "Out of my way, out of my way! ...Oh. It's you. The wolf-killer. Sit down, sit down, you're thin as a rake.",
              "Here. Take this loaf, and don't argue. Nobody leaves Hob's kitchen hungry. Not even the Prior, and he tries.",
            ],
        action: fed ? undefined : 'hob-bread',
        next: 'ask',
      },
      ask: {
        speaker: 'cook',
        lines: ['Well?'],
        choices: [
          { text: "What's cooking?", next: 'pot' },
          { text: 'Do the brothers really eat in silence?', next: 'silence' },
          { text: 'Thank you, Brother.', next: 'bye' },
        ],
      },
      pot: {
        speaker: 'cook',
        lines: ["Pottage. Leeks, beans, barley, and whatever Cuthbert hasn't let the slugs have. On Fridays, carp. On feast days, carp with a sauce."],
        next: 'ask',
      },
      silence: {
        speaker: 'cook',
        lines: ['They do. Someone reads aloud while they eat, and they make signs at each other for the salt. Brother Aldo is very good at it. Too good. I have seen him tell a whole joke with a spoon.'],
        next: 'ask',
      },
      bye: {
        speaker: 'cook',
        lines: ['Off you go. And come back hungry.'],
      },
    },
  };
}
