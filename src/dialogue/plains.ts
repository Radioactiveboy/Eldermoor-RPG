import { HERO_NAME } from '../config';
import type { DialogueChoice, DialogueScript } from './Dialogue';

/**
 * Lord Morten's toll guards at the gate north of Adowvale, and the folk met
 * on the Lord's Road across Adowvale Plains. The travellers know of the
 * monastery of Saint Elda, east of the crossroads, where moonpetal grows.
 */

/**
 * The toll guards. Until the tithe is paid they bar the gate, and the hero can
 * pay them (the 'pay-toll' action, see GameScene) once they have the coins;
 * after that the gate stays open for good.
 * @param toll what they ask, in coins
 * @param gruff the second guard, who has less to say for himself
 */
export function tollGuardScript(paid: boolean, canPay: boolean, toll: number, gruff: boolean): DialogueScript {
  const ask: DialogueChoice[] = paid
    ? []
    : canPay
      ? [{ text: `Here. ${toll} coins.`, next: 'pay' }, { text: `${toll} coins? That's robbery!`, next: 'robbery' }]
      : [{ text: "I don't have that much.", next: 'poor' }, { text: `${toll} coins? That's robbery!`, next: 'robbery' }];
  return {
    start: paid ? (gruff ? 'paid-gruff' : 'paid') : gruff ? 'greet-gruff' : 'greet',
    nodes: {
      greet: {
        speaker: 'tollguard',
        lines: [
          "Halt. This is the Lord's Road, and that's Lord Morten's gate. Nobody passes without paying His Lordship's tithe.",
          `${toll} coins. Paid once, and the gate's open to you for good. His Lordship is generous like that.`,
        ],
        next: 'ask',
      },
      'greet-gruff': {
        speaker: 'tollguard',
        lines: [`Toll's ${toll}. Talk to him if you want the speech. Or pay me. I'm not fussy.`],
        next: 'ask',
      },
      paid: {
        speaker: 'tollguard',
        lines: [`You've paid your tithe, ${HERO_NAME}. Gate's open to you, on His Lordship's word. Mind the boar out there.`],
        next: 'ask',
      },
      'paid-gruff': {
        speaker: 'tollguard',
        lines: ["You again. You've paid. Go on through, then."],
        next: 'ask',
      },
      ask: {
        speaker: 'tollguard',
        lines: [paid ? 'Something else?' : 'Well?'],
        choices: [
          ...ask,
          { text: 'Who is Lord Morten?', next: 'morten' },
          { text: "What's beyond the gate?", next: 'beyond' },
          { text: paid ? 'Good day.' : "I'll be on my way.", next: 'bye' },
        ],
      },
      pay: {
        speaker: 'tollguard',
        lines: [
          'Let me count that. ...Ninety-eight, ninety-nine, a hundred. All there, and only one of them clipped.',
          "Right! Open her up, Gerd. The gate's yours to use whenever you like, and nobody on this road will ask you again.",
        ],
        action: 'pay-toll',
      },
      robbery: {
        speaker: 'tollguard',
        lines: [
          "Take it up with His Lordship. He's a castle full of clerks who'd love to hear it.",
          "It's the same for everyone. Carters, drovers, monks. Even the monks, and they don't have any money.",
        ],
        next: 'ask',
      },
      poor: {
        speaker: 'tollguard',
        lines: [
          "Then you won't be going through, will you? Come back when your purse is heavier.",
          "Tamsin at the market pays well for pelts, they say. If you're handy with a stick.",
        ],
        next: 'ask',
      },
      morten: {
        speaker: 'tollguard',
        lines: [
          'Lord of everything from the Greyfells to the river. He had the old road mended this summer, and called it the Lord\'s Road.',
          'Now the folk who walk it can pay for the mending. A tithe, the herald said. Me, I just stand here.',
        ],
        next: 'ask',
      },
      beyond: {
        speaker: 'tollguard',
        lines: [
          "Adowvale Plains. Grass as far as you can see, a crossroads, and the road going on east and west.",
          'Deer and hares, if you fancy your supper. Boar in the thickets, if you fancy getting gored.',
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'tollguard',
        lines: [paid ? 'Safe road.' : 'Move along.'],
      },
    },
  };
}

/** Odo the carter, who carries for the monks and has paid the toll more times than he likes. */
export const CARTER: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'carter',
      lines: [
        "Whoa there! No, not you, sorry. The mule. ...There's no mule. She threw a shoe at the crossroads and went home without me.",
        "Odo. I carry for the monks of Saint Elda, east along the Lord's Road. Flour and salt there, wool and honey back.",
      ],
      next: 'ask',
    },
    again: {
      speaker: 'carter',
      lines: ["Still no mule. If you see a grey one with a guilty look, she's mine."],
      next: 'ask',
    },
    ask: {
      speaker: 'carter',
      lines: ['What can I do for you?'],
      choices: [
        { text: 'Tell me about the monks.', next: 'monks' },
        { text: 'My mother is sick. Do you know where to find moonpetal?', next: 'moonpetal' },
        { text: 'What do you make of the new toll?', next: 'toll' },
        { text: 'Safe travels, Odo.', next: 'bye' },
      ],
    },
    monks: {
      speaker: 'carter',
      lines: [
        "Saint Elda's monastery. A day's walk east from the crossroads, on a hill above a lake. Brothers mostly, and a few old sisters.",
        "They've walls round a garden you wouldn't believe. Every herb you can name, and some you can't.",
      ],
      next: 'ask',
    },
    moonpetal: {
      speaker: 'carter',
      lines: [
        "Moonpetal? Then it's the monastery you want. They grow it in a pond in the cloister, only place I know of this side of the hills.",
        "Brother Anselm keeps it dried in jars. He'll want something for it, mind. Everybody does, nowadays.",
      ],
      action: 'heard-of-monastery',
      next: 'ask',
    },
    toll: {
      speaker: 'carter',
      lines: [
        "A hundred coins! I paid it three times, coming and going, before they let on it was once only. Kept the change, they did.",
        'Lord Morten mended this road, I grant him that. But he mended it with my money.',
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'carter',
      lines: ['And you. Keep to the road after dark. The boar get bold.'],
    },
  },
};

/** Ness the herb-gatherer, just back from trading at the monastery. */
export const HERBWIFE: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'herbwife',
      lines: [
        "Well now, you've a kind face. I'm Ness. I gather what grows wild and sell it to whoever has an ache.",
        "Just back from the monastery, east past the crossroads. My feet are telling me all about it.",
      ],
      next: 'ask',
    },
    again: {
      speaker: 'herbwife',
      lines: ['Hello again, dear. Still on your feet? Good.'],
      next: 'ask',
    },
    ask: {
      speaker: 'herbwife',
      lines: ['What is it, dear?'],
      choices: [
        { text: 'Do you have any moonpetal?', next: 'moonpetal' },
        { text: 'What took you to the monastery?', next: 'monastery' },
        { text: 'Any advice for the plains?', next: 'advice' },
        { text: 'Good day, Ness.', next: 'bye' },
      ],
    },
    moonpetal: {
      speaker: 'herbwife',
      lines: [
        "Moonpetal? Not I. It's too fussy for the wild. It wants still water, and moonlight, and someone to fret over it.",
        "The brothers of Saint Elda grow it in their cloister pond. East along the Lord's Road, past the crossroads.",
        'Ask for Brother Anselm, and be polite. Who is it for? ...Your mother. Then go soon, dear.',
      ],
      action: 'heard-of-monastery',
      next: 'ask',
    },
    monastery: {
      speaker: 'herbwife',
      lines: [
        'Trading. Brother Anselm has the finest herb garden in the shire, and he swaps for wild things he cannot grow. Sorrel, meadowsweet, the like.',
        "Their Saint was a healer, you know. They've not forgotten it, even if the village has.",
      ],
      next: 'ask',
    },
    advice: {
      speaker: 'herbwife',
      lines: [
        'Mind the boar in the thickets. Tempers like a drunk miller, and tusks to match.',
        "The deer startle if you come at them running, so walk, don't run. And hares are just hares. Quick, and not much eating on them.",
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'herbwife',
      lines: ['Go gently, dear.'],
    },
  },
};
