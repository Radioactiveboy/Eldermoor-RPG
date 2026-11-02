import { HERO_NAME } from '../config';
import type { DialogueChoice, DialogueScript } from './Dialogue';

/**
 * The brothers of Saint Elda met outside the monastery walls. Brother Wystan
 * the porter keeps the gate, barred to guests while the Wolf Mother's wolves
 * harry the road; deal with her, and he opens it to the hero for good. The
 * brothers within are in abbey.ts.
 */

/**
 * How Brother Wystan's errand stands: not asked yet, under way, the Wolf
 * Mother dead but not yet reported, or done and the gate open to the hero.
 */
export type WolfStage = 'none' | 'active' | 'slain' | 'done';

/**
 * Brother Wystan, the porter, who sits by the gate and lets no-one in without
 * the Prior's leave. The Prior has barred it to guests while the Wolf Mother's
 * pack harries the brothers on the road ('start-wolf-quest'); put an end to
 * her, tell him, and it opens ('finish-wolf-quest').
 * @param first whether this is the first time they've spoken
 * @param clearedCave whether the hero has killed the wolves in the cave at home, which he has a word to say about
 * @param hasHide whether the hero has the Wolf Mother's hide to show for it
 */
export function porterScript(stage: WolfStage, first: boolean, clearedCave: boolean, hasHide: boolean): DialogueScript {
  const quest: DialogueChoice[] =
    stage === 'none'
      ? [{ text: 'May I come inside?', next: 'inside' }]
      : stage === 'active'
        ? [{ text: 'Tell me about the Wolf Mother again.', next: 'den' }, { text: 'May I come inside yet?', next: 'still-barred' }]
        : stage === 'slain'
          ? [{ text: 'The Wolf Mother is dead.', next: 'slain' }]
          : [{ text: 'May I go inside?', next: 'welcome' }];
  const offer: DialogueChoice[] = [
    { text: "I'll put an end to this Wolf Mother.", next: 'accept' },
    { text: 'Where is her den?', next: 'where' },
    ...(clearedCave ? [{ text: "I've cleared a den of wolves before, in the hill by my home.", next: 'cave' }] : []),
    { text: "Isn't that a job for Lord Morten's men?", next: 'morten' },
    { text: 'Not today, Brother.', next: 'ask' },
  ];
  const without = (next: string) => offer.filter((c) => c.next !== next);
  return {
    start: first ? 'greet' : stage === 'done' ? 'again-open' : 'again',
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
      'again-open': {
        speaker: 'porter',
        lines: [`${HERO_NAME}! Peace be with you. The gate is open, as I promised. Go in whenever you like.`],
        next: 'ask',
      },
      ask: {
        speaker: 'porter',
        lines: ['What would you ask of an old man?'],
        choices: [
          ...quest,
          { text: 'My mother is sick. I was told you grow moonpetal here.', next: stage === 'done' ? 'moonpetal-open' : 'moonpetal' },
          { text: 'Who was Saint Elda?', next: 'elda' },
          { text: 'Peace be with you, Brother.', next: 'bye' },
        ],
      },
      inside: {
        speaker: 'porter',
        lines: [
          'Not today. Not any day, I am afraid, until the wolves are dealt with. The Prior has barred the gate to all guests.',
          "There is a pack on the Lord's Road. They have had three of our donkeys this autumn, and last week they had Brother Leofric by the leg, coming back from Adowvale with the honey money.",
          'Brother Leofric will walk again, Anselm says. The honey money will not. And the Prior will not have guests coming and going on that road and being eaten on our account.',
        ],
        next: 'wolves',
      },
      wolves: {
        speaker: 'porter',
        lines: [
          'They are led by a she-wolf. A great white one, bigger than any wolf has a right to be. The shepherds call her the Wolf Mother.',
          'She has taken the old den in the rocks north of the road, out on the plains. Kill her, and the pack will scatter. Then the road is safe, and the gate can open.',
        ],
        choices: offer,
      },
      cave: {
        speaker: 'porter',
        lines: [
          'Have you, now? In the hill by the Hollow? Then you know the smell of a den, and the sound of them in the dark. That is more than most.',
          'But those were grey hill-wolves. The Wolf Mother is another thing. Go carefully, and go with the Saint.',
        ],
        choices: without('cave'),
      },
      morten: {
        speaker: 'porter',
        lines: ['Lord Morten takes his tithe for the road, and the road is still full of wolves. Draw your own conclusions. I have drawn mine, and confessed them.'],
        choices: without('morten'),
      },
      where: {
        speaker: 'porter',
        lines: [
          "Back west along the Lord's Road, before it comes to the crossroads. North of the road there is a knoll of grey rock with a track worn up to it. The track was not there two summers ago.",
          'Follow the paw prints. You will smell it before you see it.',
        ],
        choices: without('where'),
      },
      accept: {
        speaker: 'porter',
        lines: [
          "You would do that? For a gate and an old man's blessing? ...And for your mother. Yes. I see.",
          'Then go with Saint Elda. Kill the white wolf, come back and tell me, and I will open this gate to you myself, and the Prior can say what he likes.',
        ],
        action: 'start-wolf-quest',
      },
      den: {
        speaker: 'porter',
        lines: [
          "The Wolf Mother. White as frost, and the size of a pony. She lairs in the old den in the grey rocks, north of the Lord's Road, back towards the crossroads.",
          'Her wolves lie up in the den with her, and some watch the track. Do not go in tired.',
        ],
        next: 'ask',
      },
      'still-barred': {
        speaker: 'porter',
        lines: ['Not while the white wolf lives. I am sorry. I would open it for you myself, but the Prior has my word.'],
        next: 'ask',
      },
      slain: {
        speaker: 'porter',
        lines: [
          hasHide
            ? 'Dead? The Wolf Mother? ...Saints preserve us. That is her hide, I would know it anywhere. Nobody has ever seen a wolf that colour but her.'
            : 'Dead? The Wolf Mother? ...You have the look of someone who has been in a den, I will say that. The smell, too.',
          'Then the road is safe again, and Brother Leofric will have something to smile about, and the Prior has no reason left to keep the gate.',
          'And I keep my word. Stand back from the door.',
        ],
        action: 'finish-wolf-quest',
        next: 'opened',
      },
      opened: {
        speaker: 'porter',
        lines: [
          `There. The gate of Saint Elda is open to ${HERO_NAME}, now and always. Go in and welcome. Brother Anselm will be in the cloister garden. He usually is.`,
        ],
      },
      welcome: {
        speaker: 'porter',
        lines: ['Go in, go in. You need not ask me again, after what you did. The court is straight through, and the cloister beyond it.'],
        next: 'ask',
      },
      moonpetal: {
        speaker: 'porter',
        lines: [
          'Moonpetal. Yes. It grows in the cloister garden, round the pond, and Brother Anselm tends it as if it were his own child.',
          'A sick mother is a hard thing. But the gate is barred to all guests while the wolves are on the road. Help us with the wolves, and it will open for you.',
        ],
        next: 'ask',
      },
      'moonpetal-open': {
        speaker: 'porter',
        lines: ['In the cloister garden, round the pond. Ask Brother Anselm. Tell him Wystan sent you, and he will pretend to be annoyed about it.'],
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
}

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
        "And since the wolves got Brother Leofric on the road, he's barred it to guests altogether. Till somebody does something about the white one, Brother Wystan says.",
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
