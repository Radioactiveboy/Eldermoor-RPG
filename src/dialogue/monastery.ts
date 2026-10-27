import { HERO_NAME } from '../config';
import type { DialogueScript } from './Dialogue';

/**
 * The brothers of Saint Elda met outside the monastery walls. The gate is shut
 * for now: Brother Wystan the porter keeps it, and the way in (and Brother
 * Anselm's moonpetal) comes later.
 */

/** Brother Wystan, the porter, who sits by the gate and lets no-one in without the Prior's leave. */
export const PORTER: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'porter',
      lines: [
        'Peace be with you, traveller. You have come to the gate of Saint Elda. I am Brother Wystan, and I keep it.',
        "Keep it shut, mostly. That is the larger part of a porter's work, whatever the young ones think.",
      ],
      next: 'ask',
    },
    again: {
      speaker: 'porter',
      lines: ['Peace be with you again. The gate is as you left it.'],
      next: 'ask',
    },
    ask: {
      speaker: 'porter',
      lines: ['What would you ask of an old man?'],
      choices: [
        { text: 'May I come inside?', next: 'inside' },
        { text: 'My mother is sick. I was told you grow moonpetal here.', next: 'moonpetal' },
        { text: 'Who was Saint Elda?', next: 'elda' },
        { text: 'Peace be with you, Brother.', next: 'bye' },
      ],
    },
    inside: {
      speaker: 'porter',
      lines: [
        'Not today. The Prior admits no guest without his leave, and he is at his prayers, and his prayers are long.',
        'Walk the grounds, if you like. Say a word at the shrines. Do not eat the beans, whatever Brother Cuthbert tells you.',
      ],
      next: 'ask',
    },
    moonpetal: {
      speaker: 'porter',
      lines: [
        'Moonpetal. Yes. It grows in the cloister pond, and Brother Anselm tends it as if it were his own child.',
        `A sick mother is a hard thing. I will tell the Prior a ${HERO_NAME} came asking. Whether he will open the gate for it, I cannot say.`,
      ],
      next: 'ask',
    },
    elda: {
      speaker: 'porter',
      lines: [
        'A healer, long ago, when this was all forest. She went among the sick when others ran from them, and she took no payment but a prayer.',
        'The brothers built these walls round her well. Her statue stands outside, so she can still see who is coming.',
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'porter',
      lines: ['And with you. Mind the step by the ponds. It has had three novices this year.'],
    },
  },
};

/** Brother Cuthbert, who works the vegetable beds and keeps the bees, and would rather talk than dig. */
export const GARDENER: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'gardener',
      lines: [
        "Ah, a visitor! Mind the cabbages. No, the other way. That's it. Brother Cuthbert, at your service, and at the slugs' mercy.",
        'Everything you see out here is mine to look after. Beans, roots, cabbages, the bees, and the carp, when the heron lets me.',
      ],
      next: 'ask',
    },
    again: {
      speaker: 'gardener',
      lines: ["Back again? The beans haven't grown since you left. I checked."],
      next: 'ask',
    },
    ask: {
      speaker: 'gardener',
      lines: ['What can I tell you?'],
      choices: [
        { text: 'What are the ponds for?', next: 'ponds' },
        { text: 'Tell me about the bees.', next: 'bees' },
        { text: 'Do you grow moonpetal out here?', next: 'moonpetal' },
        { text: "I'll let you get on, Brother.", next: 'bye' },
      ],
    },
    ponds: {
      speaker: 'gardener',
      lines: [
        "Fish ponds. Stew ponds, the old brothers called them. Carp for the Friday table, and lilies because Saint Elda liked lilies. So I'm told.",
        "There's a heron that thinks they're for him. We have had words. He did not listen.",
      ],
      next: 'ask',
    },
    bees: {
      speaker: 'gardener',
      lines: [
        "Five skeps, and every one with a temper. Honey for Odo to sell in Adowvale, and wax for the chapel's candles.",
        "Walk past them slowly and hum. They like a hymn. They don't like Brother Tobin, but nobody can say why.",
      ],
      next: 'ask',
    },
    moonpetal: {
      speaker: 'gardener',
      lines: [
        "Out here? Bless you, no. It would sulk and die. It wants the cloister pond, and Brother Anselm fussing over it day and night.",
        "That's inside the walls, I'm afraid. You'd want Brother Wystan to let you in. Best of luck with that.",
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'gardener',
      lines: ['Go well! And if you see a slug, be merciless.'],
    },
  },
};

/** Brother Aldo, who has taken a vow of silence and answers everything with looks and gestures. */
export const SILENT: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'silent',
      lines: [
        '...',
        '(The brother looks you up and down, then presses a finger to his lips and nods towards the shrine.)',
      ],
      next: 'ask',
    },
    again: {
      speaker: 'silent',
      lines: ['(Brother Aldo inclines his head. He seems pleased to see you, in a quiet sort of way.)'],
      next: 'ask',
    },
    ask: {
      speaker: 'silent',
      lines: ['(He waits, hands folded in his sleeves.)'],
      choices: [
        { text: 'Have you taken a vow of silence?', next: 'vow' },
        { text: 'Where can I find Brother Anselm?', next: 'anselm' },
        { text: 'Sorry to disturb you, Brother.', next: 'bye' },
      ],
    },
    vow: {
      speaker: 'silent',
      lines: ['(He nods, very solemnly. Then holds up seven fingers. Then, after some thought, three more.)', '(Ten years, you think. Or ten days. It is hard to tell with him.)'],
      next: 'ask',
    },
    anselm: {
      speaker: 'silent',
      lines: [
        '(He points at the gate. Then mimes a man bent over, peering at something small, and very carefully watering it.)',
        '(Then he shakes his head and points at the gate again, and makes a face like a locked door. You get the idea.)',
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'silent',
      lines: ['(He makes the sign of Saint Elda over you, and goes back to his walking.)'],
    },
  },
};

/** Brother Tobin, a novice sent out to sweep the road, who would rather do anything else. */
export const NOVICE: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'novice',
      lines: [
        "Oh! A traveller! Hello! Sorry. We're meant to be calm. Peace be with you. I'm Brother Tobin. Novice Tobin, really.",
        "I'm meant to be sweeping the road. Have you ever tried sweeping a road? It just keeps being a road.",
      ],
      next: 'ask',
    },
    again: {
      speaker: 'novice',
      lines: ["Hello again! I've swept that bit. It's still a road."],
      next: 'ask',
    },
    ask: {
      speaker: 'novice',
      lines: ['Is there anything you want to know? I know lots. Brother Wystan says too much.'],
      choices: [
        { text: "What's it like inside the walls?", next: 'inside' },
        { text: 'Why is the gate shut?', next: 'gate' },
        { text: 'Who are the other brothers out here?', next: 'brothers' },
        { text: 'Good luck with the sweeping.', next: 'bye' },
      ],
    },
    inside: {
      speaker: 'novice',
      lines: [
        "There's the chapel, and the cloister with the pond, and the infirmary, and the scriptorium, and the kitchens. The kitchens are the best bit.",
        'And the bell tower. I rang the bell once when I wasn\'t meant to. Everyone came running. I am still sweeping because of it.',
      ],
      next: 'ask',
    },
    gate: {
      speaker: 'novice',
      lines: [
        "The Prior keeps it shut. He says the world comes in through an open gate. I think the world is quite nice, mostly. Don't tell him I said so.",
        'Brother Wystan opens it for carts, and for the Prior, and for nobody else. He says he opened it for a goose once and has regretted it ever since.',
      ],
      next: 'ask',
    },
    brothers: {
      speaker: 'novice',
      lines: [
        "Brother Wystan, by the gate. He's a hundred. Brother Cuthbert, in the gardens, who is kind and smells of onions.",
        "And Brother Aldo, by the shrines. He's taken a vow of silence. I tried to make him laugh once. He didn't. But he wanted to.",
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'novice',
      lines: ['Thank you! Peace be with you! Sorry. Peace be with you.'],
    },
  },
};
