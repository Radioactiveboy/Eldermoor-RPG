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

/** What she says if you talk to her again while the quest is under way. */
export const MOTHER_WAITING: DialogueScript = {
  start: 'ask',
  nodes: {
    ask: {
      speaker: 'mother',
      lines: [`Back so soon, ${HERO_NAME}? Did you find the moonpetal tincture?`],
      choices: [
        { text: "Not yet. I'm still looking.", next: 'not-yet' },
        { text: 'How are you feeling?', next: 'feeling' },
        { text: 'What was I looking for again?', next: 'remind' },
      ],
    },
    'not-yet': {
      speaker: 'mother',
      lines: [`Then don't dawdle here on my account, ${HERO_NAME}. *cough* I'll keep.`],
    },
    feeling: {
      speaker: 'mother',
      lines: ['Tired. Cold, even this close to the fire.', 'Go on now. The sooner you leave, the sooner you are home.'],
    },
    remind: {
      speaker: 'mother',
      lines: [
        'Moonpetal and willow bark, as a tincture. Ask in the village square for a healer or a herbalist.',
        "And it's all written down in your journal, if you'd only look.",
      ],
    },
  },
};
