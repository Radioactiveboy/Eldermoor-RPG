import { HERO_NAME } from '../config';
import type { DialogueScript } from './Dialogue';

/** The first conversation: Mother asks the hero to find her medicine. */
export const MOTHER_INTRO: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'mother',
      lines: [
        `Oh... there you are, ${HERO_NAME}, my dear. Come here, let me look at you.`,
        "*cough* ...I won't pretend any longer. This sickness in my chest grows worse with every passing night.",
      ],
      choices: [
        { text: "Don't say that. What can I do?", next: 'remedy' },
        { text: 'How long have you been hiding this from me?', next: 'hiding' },
        { text: "It's only a cough. You'll be fine.", next: 'dismiss' },
      ],
    },
    hiding: {
      speaker: 'mother',
      lines: [
        "Since the first frost. I didn't want you fretting over an old woman...",
        "But the cough has turned to fever, and the fever won't break.",
      ],
      next: 'remedy',
    },
    dismiss: {
      speaker: 'mother',
      lines: ['I wish that were so, child. *cough* Look at my hands... they shake so, I can barely hold a cup.'],
      next: 'remedy',
    },
    remedy: {
      speaker: 'mother',
      lines: [
        'There is a remedy. A tincture of moonpetal and willow bark. My own mother used to brew it.',
        'We have none left, and I am far too weak to gather the herbs myself. Someone in the village may sell it... a healer, or a herbalist.',
      ],
      choices: [
        { text: "I'll find it. I promise.", next: 'farewell' },
        { text: 'Where should I start looking?', next: 'where' },
        { text: 'Rest, Mother. I will be back before you know it.', next: 'farewell' },
      ],
    },
    where: {
      speaker: 'mother',
      lines: [
        'The village square, just outside our door. Folk trade there most days.',
        'Ask around. Someone will know where moonpetal grows, or who keeps it.',
      ],
      choices: [{ text: "Then I'll go now.", next: 'farewell' }],
    },
    farewell: {
      speaker: 'mother',
      action: 'start-medicine-quest',
      lines: [
        `Bless you, ${HERO_NAME}. You've your father's stubborn heart.`,
        "Take care out there... and keep your journal close. You've always had a head like a sieve.",
      ],
    },
  },
};

/** How far along the hero is with Mother's medicine, as far as she can tell. */
export type MedicineStage = 'looking' | 'herbs' | 'tincture' | 'well';

/** What she says if you talk to her again: while the quest is under way, when the tincture is ready, and once she's mending. */
export function motherScript(stage: MedicineStage): DialogueScript {
  if (stage === 'well') return MOTHER_WELL;
  const ask = stage === 'tincture'
    ? { text: "I've brought your tincture, Mother. I brewed it myself.", next: 'give' }
    : stage === 'herbs'
      ? { text: "I've found the moonpetal and the willow bark.", next: 'herbs' }
      : { text: "Not yet. I'm still looking.", next: 'not-yet' };
  return {
    start: 'ask',
    nodes: {
      ask: {
        speaker: 'mother',
        lines: [stage === 'tincture' ? `${HERO_NAME}? Is that you? You look as if you've run all the way.` : `Back so soon, ${HERO_NAME}? Did you find the moonpetal tincture?`],
        choices: [
          ask,
          { text: 'How are you feeling?', next: 'feeling' },
          { text: 'What was I looking for again?', next: 'remind' },
        ],
      },
      'not-yet': {
        speaker: 'mother',
        lines: [`Then don't dawdle here on my account, ${HERO_NAME}. *cough* I'll keep.`],
      },
      herbs: {
        speaker: 'mother',
        lines: [
          'You clever thing! But they are no good to me as they are, love. They must be ground and steeped and strained, over a slow heat, and I have no still.',
          "My mother used old Maud's bench, at the Crooked Tankard in Adowvale. Maud's long gone, but Godric is her grandson. Ask him if it's still down in his cellar.",
        ],
      },
      feeling: {
        speaker: 'mother',
        lines: ['Tired. Cold, even this close to the fire.', 'Go on now. The sooner you leave, the sooner you are home.'],
      },
      remind: {
        speaker: 'mother',
        lines: [
          'Moonpetal and willow bark, brewed into a tincture at a proper bench. Ask in the village square for a healer or a herbalist.',
          "And it's all written down in your journal, if you'd only look.",
        ],
      },
      give: {
        speaker: 'mother',
        lines: [
          'Brewed it yourself? Oh, look at it glow. Just like my mother used to make. Give it here, then, and help me sit up.',
          '*sip* ...Ugh! Just as foul as hers was. That is how you know it works.',
          `I can feel it already, ${HERO_NAME}. Warm, all the way down. I think I shall sleep tonight. Thank you, my love. Thank you.`,
          "And so should you. You look half dead on your feet. Go on, off to bed with you, and we'll see how I am in the morning.",
        ],
        action: 'give-tincture',
      },
    },
  };
}

/** Woken while she's lying down in her bed: drowsy, and wanting to be let be. */
export const MOTHER_DOZING: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'mother',
      lines: [`Mm? ...Oh, it's you, ${HERO_NAME}. I was only resting my eyes.`],
      choices: [
        { text: 'How are you feeling?', next: 'feeling' },
        { text: 'Sorry, Mother. Go back to sleep.', next: 'sleep' },
      ],
    },
    feeling: {
      speaker: 'mother',
      lines: ['Like a wrung-out dishcloth. *cough* It eases a little when I lie still.', 'Wake me if you find that moonpetal, love.'],
    },
    sleep: {
      speaker: 'mother',
      lines: ['Mm. Mind the fire...'],
    },
  },
};

/** Asleep after her tincture: breathing easy at last, and not to be woken. */
export const MOTHER_ASLEEP: DialogueScript = {
  start: 'asleep',
  nodes: {
    asleep: {
      speaker: 'mother',
      lines: ['*slow, easy breathing* ...Mm. So warm... five more minutes, love...'],
    },
  },
};

/** Once she's had her tincture and is mending. */
export const MOTHER_WELL: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'mother',
      lines: [
        `There you are, ${HERO_NAME}. The fever's gone, and the cough's nearly gone with it. I even had some of the soup.`,
        "Off you go now, and don't worry about me. Just come home for supper now and then.",
      ],
    },
  },
};
