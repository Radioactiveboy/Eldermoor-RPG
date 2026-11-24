import { HERO_NAME } from '../config';
import type { DialogueChoice, DialogueNode, DialogueScript } from './Dialogue';
import { BeaconOutcome, BeaconStage, beaconTopics } from './beacon';

/**
 * The Headman's residence at the south end of Adowvale (see
 * world/GarrisonMaps.ts): Headman Osbert Hale at his desk, Aldwin his
 * steward by the door, Elsie the maid, and Marjory in the kitchen.
 *
 * The Headman is who the village answers to (the reeve collects its dues and
 * pays its bounties for him; Sergeant Brannock keeps its peace) and who speaks
 * for it to Lord Morten. His conversation is built from {@link HeadmanTopic}s,
 * so errands for him are added as topics (with their nodes) without touching
 * the rest: see headmanScript.
 */

/** What the Headman knows of the hero and the village, when spoken to. */
export interface HeadmanTalk {
  /** The first time he's been spoken to. */
  first: boolean;
  raidOver: boolean;
  /** He's already said his piece about the raid. */
  toldRaid: boolean;
  /** Mother's fever: the hero is out looking for her medicine. */
  medicine: boolean;
  /** The toll on the Lord's Road has been paid. */
  paidToll: boolean;
  /** The Wolf Mother is dead. */
  slewWolfMother: boolean;
  /** The goblin in the cells has told the hero where Mother is, and the Headman hasn't yet offered to pay for help. */
  goblinTalked?: boolean;
  /** He's promised to pay Sigrun's hire. */
  paysSigrun?: boolean;
  /** His errand to the old beacon on Corbie Tor, offered once Mother is home and buried (see dialogue/beacon.ts). */
  beacon?: BeaconStage;
  beaconOutcome?: BeaconOutcome;
}

/**
 * Something to ask the Headman about: the choice in his list, and the nodes it
 * leads to (which come back to 'ask' when done). `when` leaves it out unless
 * it holds; quests for him are topics too, offered while they apply.
 */
export interface HeadmanTopic {
  choice: DialogueChoice;
  nodes: Record<string, DialogueNode>;
  when?: (t: HeadmanTalk) => boolean;
}

/** Everything there is to ask him about, in the order it's offered. Add errands here. */
export function headmanTopics(t: HeadmanTalk): HeadmanTopic[] {
  const topics: HeadmanTopic[] = [
    {
      when: (x) => x.raidOver,
      choice: { text: 'The goblins took my mother.', next: 'raid-mother' },
      nodes: {
        'raid-mother': {
          speaker: 'headman',
          lines: [
            "I know. I know, lad. I've had the sergeant tell me three times what he saw from the square, as if hearing it again would change it.",
            "I wrote to Lord Morten the morning it happened. His men are his, not mine, and he wants paying for them. I have written to him again since, and I was not polite.",
            "I am not a soldier. But I will not leave a woman of this village in the hands of goblins while I sit here with my chain on. Give me a little time. I mean to find out what is to be done, and who can do it.",
          ],
          next: 'raid-come-back',
        },
        'raid-come-back': {
          speaker: 'headman',
          lines: [
            'Come back to me. Often. Anything you learn, out there, I want to hear it, and I may have need of someone who is not afraid of the woods.',
          ],
          next: 'ask',
        },
      },
    },
    {
      when: (x) => !!x.goblinTalked && !x.paysSigrun,
      choice: { text: 'The goblin in the cells talked. They have Mother up on the Greyfells.', next: 'raid-greyfells' },
      nodes: {
        'raid-greyfells': {
          speaker: 'headman',
          lines: [
            'The Greyfells. Under the hill, where my grandfather always said they were. And she is alive? Then I was right not to give up on her.',
            "A healer for their sick queen... Gods. I have no men to give you, lad. Brannock has his twelve, and I'll not strip the village of them; you know why.",
            "But I have the village chest, and this is what it is for. There is a sellsword drinking at the Tankard, Sigrun, who came for the Wolf Mother's bounty and stayed. She has done this sort of work before.",
            'Go and see her. Tell her Hale sends you, and Hale pays. Whatever she asks. And bring your mother home.',
          ],
          action: 'headman-pays-sigrun',
          next: 'ask',
        },
      },
    },
    {
      when: (x) => !!x.paysSigrun,
      choice: { text: 'About the sellsword.', next: 'raid-sigrun' },
      nodes: {
        'raid-sigrun': {
          speaker: 'headman',
          lines: ["Sigrun, at the Tankard. Hale sends you, Hale pays. If she argues, tell her I said she's to send the bill to me, and I'll argue with her myself."],
          next: 'ask',
        },
      },
    },
    {
      when: (x) => x.raidOver,
      choice: { text: 'What is the village doing about the goblins?', next: 'raid-village' },
      nodes: {
        'raid-village': {
          speaker: 'headman',
          lines: [
            'Doubled the watch. Barred the gates at dusk. Sent to the farms round about to come in at night if they will. Most of them will not.',
            "And counted what we have, which is a dozen frightened lads, Osric's spearheads, and Godric's offer of the Tankard's takings. It's a start. It is not enough.",
          ],
          next: 'ask',
        },
      },
    },
    {
      choice: { text: 'What does a Headman do?', next: 'role' },
      nodes: {
        role: {
          speaker: 'headman',
          lines: [
            "Whatever nobody else will. I keep the market's peace and its weights honest, I hear the village's quarrels and settle them, and I decide who sits in the sergeant's cells and for how long.",
            "The reeve gathers the village's dues for me and pays its bounties out of them. And when Lord Morten wants something of Adowvale, it's me he asks. When Adowvale wants something of Lord Morten, it's me who asks, and asks, and asks.",
          ],
          next: 'ask',
        },
      },
    },
    {
      choice: { text: 'Tell me about Lord Morten.', next: 'morten' },
      nodes: {
        morten: {
          speaker: 'headman',
          lines: [
            'His grandfather was lord here when my grandfather wore this chain. A hard man, but he kept the roads, and he kept what was under the hill under it.',
            t.paidToll
              ? "This one keeps a toll gate. You've paid it, I see. A hundred coins to walk a road the village built. I've told him so. He sent back a copy of the charter, with the clause about the road underlined."
              : 'This one keeps a toll gate. A hundred coins to walk a road the village built. I have told him so. He sent back a copy of the charter, with the clause about the road underlined.',
          ],
          next: 'ask',
        },
      },
    },
    {
      when: (x) => !x.raidOver,
      choice: { text: 'What about the wolves?', next: 'wolves' },
      nodes: {
        wolves: {
          speaker: 'headman',
          lines: t.slewWolfMother
            ? [
                "Quieter, since the great white she-wolf was killed. I hear that was you. The village owes you, and I don't forget what the village owes.",
              ]
            : [
                "Worse every season. They come down off the plains in packs, and there's a white she-wolf among them the drovers swear is as big as a pony.",
                'I had the reeve call up the militia for the first time in twenty years, and the bounties are on the board. If you go after them yourself, go well armed.',
              ],
          next: 'ask',
        },
      },
    },
    {
      when: (x) => x.medicine && !x.raidOver,
      choice: { text: 'My mother has a fever.', next: 'fever' },
      nodes: {
        fever: {
          speaker: 'headman',
          lines: [
            "I'm sorry to hear it. Brother Anselm at Saint Elda's is the best physician this side of the fells, if you can get past their gate. And Hilde swears by willow bark for a fever, for whatever a baker's word is worth.",
            'Give her my good wishes. Your mother sold eggs in our square for twenty years and never once short-changed anybody. That is rarer than you would think.',
          ],
          next: 'ask',
        },
      },
    },
    {
      choice: { text: 'Who are the people in the portraits?', next: 'portraits' },
      nodes: {
        portraits: {
          speaker: 'headman',
          lines: [
            'Hales. Four generations of us have worn the chain. My great-grandfather, who kept the bridge in the flood year. My grandfather. My father, who hated sitting for that painting and looks it.',
            'There is room on the wall for me, my steward reminds me. He reminds me every year.',
          ],
          next: 'ask',
        },
      },
    },
  ];
  // The beacon's errand comes first while there's something new in it.
  return [...beaconTopics(t.beacon, t.beaconOutcome), ...topics.filter((topic) => !topic.when || topic.when(t))];
}

/** Headman Osbert Hale: grey-bearded, careful, kind under it, and very tired since the raid. */
export function headmanScript(t: HeadmanTalk): DialogueScript {
  const topics = headmanTopics(t);
  const nodes: Record<string, DialogueNode> = {
    greet: {
      speaker: 'headman',
      lines: t.first
        ? [
            `${HERO_NAME}, isn't it? From the cottage in the Hollow. Come in, come in. Osbert Hale. I'm Headman here, for my sins.`,
            "Aldwin will have told you to wipe your boots. He tells the Lord's own messengers to wipe their boots. What can I do for you?",
          ]
        : [t.raidOver ? `${HERO_NAME}. Any news? Sit, if you like.` : `${HERO_NAME}. Good to see you. What can I do for you?`],
      next: 'ask',
    },
    'raid-first': {
      speaker: 'headman',
      lines: [
        t.first ? `You'll be ${HERO_NAME}. Osbert Hale. I'm Headman here. I wish we were meeting some other way.` : `${HERO_NAME}. Gods. Come in, lad.`,
        "I've heard. The whole village has. The farm in the Hollow burnt, and your mother carried off. I am so very sorry.",
      ],
      next: 'ask',
    },
    ask: {
      speaker: 'headman',
      lines: [t.raidOver ? 'Ask me anything. I will tell you what I can.' : 'Ask away.'],
      choices: [...topics.map((topic) => topic.choice), { text: 'Thank you, Headman.', next: 'bye' }],
    },
    bye: {
      speaker: 'headman',
      lines: t.raidOver ? ['Go carefully. And come back to me.'] : ['Good day to you. Mind Aldwin on the way out; he has opinions about the doormat.'],
    },
  };
  for (const topic of topics) Object.assign(nodes, topic.nodes);
  return { start: t.raidOver && !t.toldRaid ? 'raid-first' : 'greet', nodes };
}

/** Aldwin, the Headman's steward: old, upright, grave, and devoted to the doormat. */
export function stewardScript(raidOver: boolean, first: boolean, headmanIn: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'steward',
        lines: [
          'Good day. You are in the house of the Headman of Adowvale. Kindly wipe your boots.',
          "...Thoroughly. Thank you. I am Aldwin, the Headman's steward.",
          headmanIn ? 'The Headman receives callers at his desk, at the far end of the hall. Do not keep him long.' : 'The Headman has retired for the night. You may call again in the morning.',
        ],
        next: 'ask',
      },
      again: { speaker: 'steward', lines: ['Boots.'], next: 'ask' },
      ask: {
        speaker: 'steward',
        lines: ['Is there something I can help you with?'],
        choices: [
          { text: 'Tell me about the house.', next: 'house' },
          { text: 'How long have you served here?', next: 'service' },
          ...(raidOver ? [{ text: 'How is the Headman?', next: 'raid' }] : []),
          { text: "That's all.", next: 'bye' },
        ],
      },
      house: {
        speaker: 'steward',
        lines: [
          "Built by the Headman's great-grandfather, of stone from the old quarry on the plains, when there was still a quarry and still a bridge to bring it over.",
          "The armour by the door was his. The portraits are the Hales. The tapestry is the Hollow at harvest; the Headman's late wife stitched it. Please do not touch the tapestry.",
        ],
        next: 'ask',
      },
      service: {
        speaker: 'steward',
        lines: [
          'Forty-one years. I served his father, and I carried the present Headman on my shoulders when he was small enough to be carried.',
          'He was a dreadful child. He is a good man. The two are not so very far apart.',
        ],
        next: 'ask',
      },
      raid: {
        speaker: 'steward',
        lines: [
          "Not sleeping. He sits at his desk till the candles are out, writing to Lord Morten, and the sergeant comes and goes at all hours with mud on his boots.",
          "Speak with him. Do not keep him long. ...But do not go without speaking with him, either.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'steward', lines: ['Good day.'] },
    },
  };
}

/** Elsie, the Headman's maid: young, quick, and never still. */
export function housemaidScript(raidOver: boolean): DialogueScript {
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'housemaid',
        lines: raidOver
          ? [
              "Oh! You made me jump. Everybody makes me jump, since the Hollow. Sorry. I'm Elsie.",
              "Is it true they took your mother? My gran says goblins only take what they mean to keep. I told her to hush.",
            ]
          : ["Mind the floor, I've just done it! ...Sorry. Hello. I'm Elsie. Don't mind me, I'm only dusting. Again."],
        choices: [
          { text: 'What do you do here?', next: 'work' },
          { text: "I'll let you get on.", next: 'bye' },
        ],
      },
      work: {
        speaker: 'housemaid',
        lines: [
          'Everything Aldwin is too grand to do and Marjory is too busy to. Fires, floors, the armour. Aldwin says the armour must be polished every day, in case.',
          'In case of what, I asked. "In case," he said.',
        ],
        next: 'bye',
      },
      bye: { speaker: 'housemaid', lines: [raidOver ? 'Bar your door tonight. Everybody is.' : 'Wipe your boots on the way out! Aldwin will know if you don\'t.'] },
    },
  };
}

/** Marjory, the Headman's cook: broad, floury, and the real power in the house. */
export function housecookScript(raidOver: boolean): DialogueScript {
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'housecook',
        lines: raidOver
          ? [
              "Sit down before you fall down, lad. You look like you've not eaten in a week. Nobody in this house has, either. The Headman pushes his plate away and I take it back full.",
            ]
          : ["Out of my kitchen, unless you're carrying onions. ...You're not carrying onions. Well. You can stay a minute. Marjory."],
        choices: [
          { text: "What's cooking?", next: 'pot' },
          { text: "I'll leave you to it.", next: 'bye' },
        ],
      },
      pot: {
        speaker: 'housecook',
        lines: [
          "Mutton and barley, the same as every Fiveday. The Headman likes it, Aldwin says it's beneath the house, and Elsie eats three bowls.",
          raidOver
            ? "And bread for the lads on the gate. I send it over to the garrison every night now. The sergeant says thank you like it hurts him."
            : 'If you want something to take on the road, Hilde in the square bakes a better loaf than I do. Don\'t tell her I said so.',
        ],
        next: 'bye',
      },
      bye: { speaker: 'housecook', lines: ['Go on, then. Mind the pot.'] },
    },
  };
}

/** What Elsie says as she tidies (see Npc.doChores), now and then. */
export const HOUSEMAID_CHORES = ['Dust, dust, dust...', 'Who walked mud in here? Aldwin will have a fit.', 'Shine, you old tin can.', 'There. Lovely.'];
