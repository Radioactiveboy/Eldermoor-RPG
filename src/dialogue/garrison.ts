import { HERO_NAME } from '../config';
import type { StandingLevel } from '../systems/Reputation';
import type { DialogueChoice, DialogueNode, DialogueScript } from './Dialogue';

/**
 * The militia garrison at the south end of Adowvale (see world/GarrisonMaps.ts):
 * Sergeant Brannock at his table in the guardroom, Hamm of the cooper's boys
 * keeping the cells below, and Wat the poacher in one of them.
 *
 * It follows what the militia say in the square (dialogue/market.ts, and
 * dialogue/afterRaid.ts once the goblins have been): the sergeant is the man
 * they all quote, who held them in the village while the Hollow burned, sent a
 * rider to Lord Morten for men, and was sent back a bill. The reeve pays the
 * bounties; the sergeant posts them.
 */

/** What the sergeant knows of the hero and the world. */
export interface SergeantTalk {
  /** The first time he's been spoken to. */
  first: boolean;
  /** The goblins have burnt the Hollow and taken Mother. */
  raidOver: boolean;
  /** Said his piece about the raid already. */
  toldRaid: boolean;
  standing: StandingLevel;
  /** Militia bounties claimed, all told. */
  bounties: number;
  /** The hero has put the Wolf Mother down. */
  slewWolfMother: boolean;
}

/** Sergeant Brannock: square, grey, tired, and fair. He never raises his voice and never needs to. */
export function sergeantScript(t: SergeantTalk): DialogueScript {
  const ask: DialogueChoice[] = [];
  if (t.raidOver) {
    ask.push({ text: 'Will you send men after my mother?', next: 'raid-men' });
    ask.push({ text: 'What do you know about goblins?', next: 'raid-goblins' });
  }
  ask.push(
    { text: 'What does the militia do?', next: 'duty' },
    { text: 'Any work going?', next: 'work' },
    { text: "Who's in the cells?", next: 'cells' },
    { text: 'What do you make of the Headman?', next: 'headman' },
  );
  if (!t.raidOver) ask.push({ text: 'Is the Hollow road safe?', next: 'wolves' });
  ask.push({ text: 'I should go.', next: 'bye' });

  const greeting = (): string[] => {
    if (t.first) {
      return [
        `You'll be ${HERO_NAME}, from the cottage down the Hollow road. Brannock. Sergeant of the Adowvale militia, such as it is.`,
        "Twelve lads, eleven spears, and a goose with a grudge. What can I do for you?",
      ];
    }
    if (t.standing === 'honoured' || t.standing === 'liked') return [`${HERO_NAME}. Good. Sit down if you like; the stools don't bite. Hamm's goose does.`];
    if (t.standing === 'distrusted') return ['You again. Say what you came to say.'];
    return [`${HERO_NAME}. What is it?`];
  };

  const nodes: Record<string, DialogueNode> = {
    greet: { speaker: 'sergeant', lines: greeting(), next: 'ask' },
    ask: { speaker: 'sergeant', lines: ['Well?'], choices: ask },
    duty: {
      speaker: 'sergeant',
      lines: [
        "Keep the peace in the square. Walk the rounds. Shut the gate at night and open it in the morning. Take up drunks, thieves and geese.",
        'The Headman decides who stays in the cells and how long. I just turn the key. It works better that way round.',
        t.raidOver
          ? "And now, hold the village. That's all I've let them do since the Hollow, and it's the hardest thing I've ever asked of them."
          : "Twenty years it's been mostly geese. Then the wolves came down off the plains, and the Headman had the reeve call the lads up again.",
      ],
      next: 'ask',
    },
    work: {
      speaker: 'sergeant',
      lines: [
        "The notice board by the trough. Rats, boar, footpads, wolves: the reeve pays and I post them. Do the job, bring me the proof, take the coin.",
        t.bounties >= 2
          ? "You've had a few off us already. The lads were glad of it. They'd rather walk round the square than walk into a boar."
          : 'Nobody minds who does them, so long as they get done.',
      ],
      next: 'ask',
    },
    cells: {
      speaker: 'sergeant',
      lines: [
        "Wat, the poacher. Took a hare off the plains, and Lord Morten's men brought him to us rather than walk him all the way to the manor. He's ours till the Headman says.",
        "He's harmless. Go down and see him if you like; Hamm has the keys. Don't let Wat talk you into anything.",
      ],
      next: 'ask',
    },
    headman: {
      speaker: 'sergeant',
      lines: t.raidOver
        ? [
            "Headman Hale's had the reeve and me in that hall of his three nights running. He writes letters. I count spears. Neither of us is sleeping.",
            "Go and see him. He'll want to hear it from you. He listens, I'll give him that; more than most men with a chain round their neck.",
          ]
        : [
            "Osbert Hale. Fourth Hale to wear the chain. Lives in the big house next door, so he can see if I'm up of a morning.",
            "He's fair. Careful with the village's money, which the village complains about, and careful with Lord Morten, which I complain about. You'll find him at his desk most days.",
          ],
      next: 'ask',
    },
    wolves: {
      speaker: 'sergeant',
      lines: [
        "By day, mostly. Keep to the road. There's a she-wolf on the plains the size of a pony, they say, and her pack's been coming further every season.",
        t.slewWolfMother
          ? "...Was. The way I hear it, you put the big one down. The lads have been telling it round the Tankard all week, getting bigger every time."
          : "I'd go after her myself, but I'm not allowed past Morten's gate without paying his toll like anyone else. Ask me how I feel about that.",
      ],
      next: 'ask',
    },
    'raid-first': {
      speaker: 'sergeant',
      lines: [
        `${HERO_NAME}. I heard. Gods help me, I watched it. We saw the smoke from the square at first light.`,
        "I held the lads in the village. If it was goblins, there'd be more than one band, and if we'd all gone down the Hollow road there'd have been nobody on the gate. I'd make the same call again.",
        "And I'll be sorry for it till they put me in the ground. Your mother. I'm sorry.",
      ],
      next: 'ask',
    },
    'raid-men': {
      speaker: 'sergeant',
      lines: [
        "Not yet. I've twelve lads who've never seen a goblin, and the only one of them who's seen a fight is deaf in one ear.",
        "I sent a rider to Lord Morten the same morning. He sent back asking who'd pay for the men. The Headman's writing to him again. Harder, this time.",
        "Find out where they went. Where they are, how many. Bring me that and I'll have something to put in front of the Headman, and Morten. Don't go in alone.",
      ],
      next: 'ask',
    },
    'raid-goblins': {
      speaker: 'sergeant',
      lines: [
        "What my grandad told me. Small, quick, and cleverer than you'd like. They hate the light and they hate iron. They came up out of the deep places under the hill once, before my grandad's time, and old Lord Morten's men drove them back down.",
        "Nobody's seen one in sixty years. And now they've come up again, and carried off a living woman. Goblins don't do that for nothing. I don't like it.",
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'sergeant',
      lines: t.raidOver ? ['Watch the north road. And come back and tell me what you find.'] : ['Keep out of trouble. Or at least keep it outside the village.'],
    },
  };
  const start = t.raidOver && !t.toldRaid ? 'raid-first' : 'greet';
  if (start === 'raid-first' && t.first) nodes['raid-first'].lines.unshift('Brannock. Sergeant of the militia.');
  return { start, nodes };
}

/** Hamm, one of the cooper's boys, who keeps the cells (and the keys, and Wat's supper). */
export function jailerScript(raidOver: boolean, first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'jailer',
        lines: [
          "Halt! Who goes... Oh. You came down the steps like a normal person. Nobody does that. They always come down the hatch and frighten the life out of me.",
          raidOver
            ? "Hamm. I keep the cells. The sergeant put me down here after the Hollow, because I kept jumping at shadows on the gate. Now I jump at shadows down here."
            : "Hamm. One of the cooper's boys. The other one's on the gate. I keep the cells.",
        ],
        next: 'ask',
      },
      again: { speaker: 'jailer', lines: [raidOver ? 'Anything moving up there? ...No? Good.' : "Back again? It's not much of a show. Wat mostly sleeps."], next: 'ask' },
      ask: {
        speaker: 'jailer',
        lines: ['What do you want?'],
        choices: [
          { text: "Who's in the cells?", next: 'wat' },
          { text: 'What was the goose in for?', next: 'goose' },
          { text: 'Can I go out through the hatch?', next: 'hatch' },
          { text: 'Never mind.', next: 'bye' },
        ],
      },
      wat: {
        speaker: 'jailer',
        lines: [
          "Just Wat. Poacher. He's been in and out of here since before I could hold a spear. I think he likes it. Dry, and somebody brings him his dinner.",
          "Don't give him anything sharp. Or anything at all. Last time somebody gave him a spoon he dug half a brick out of the wall.",
        ],
        next: 'ask',
      },
      goose: {
        speaker: 'jailer',
        lines: [
          "Biting. Assaulting the watch, the sergeant wrote. It went for Garrick on the green and wouldn't let go of his breeches.",
          raidOver
            ? "We let it out, after. It didn't feel right, keeping a goose locked up when there's goblins about. It's still angry, mind."
            : 'Three days. It never said sorry. Then Mistress Pottle came and paid its fine, and it bit me on the way out.',
        ],
        next: 'ask',
      },
      hatch: {
        speaker: 'jailer',
        lines: [
          "Up the steps at the far end. It comes out in the lane by the garrison wall. It's how we bring the drunks in without going through the guardroom.",
          'Mind your head on the beam. Everybody hits it. I hit it this morning.',
        ],
        next: 'ask',
      },
      bye: { speaker: 'jailer', lines: ["Right. I'll just... sit here, then. With the keys."] },
    },
  };
}

/** Wat the poacher, on the straw in the middle cell: cheerful, unrepentant, and always hungry. */
export function prisonerScript(raidOver: boolean, first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'prisoner',
        lines: [
          "Psst. You. Yes, you, with the face. You wouldn't have a file on you? A key? A big spoon?",
          "...No? A pie, then. I'd settle for a pie. Wat's the name. I'm a guest of the militia.",
        ],
        next: 'ask',
      },
      again: { speaker: 'prisoner', lines: ['My favourite visitor! My only visitor. Did you bring a pie?'], next: 'ask' },
      ask: {
        speaker: 'prisoner',
        lines: [raidOver ? 'Any news from up top?' : 'Go on, then. Ask. Everyone asks.'],
        choices: [
          { text: 'What are you in for?', next: 'crime' },
          { text: 'When do you get out?', next: 'out' },
          ...(raidOver ? [{ text: 'Goblins took my mother.', next: 'raid' }] : []),
          { text: 'Goodbye, Wat.', next: 'bye' },
        ],
      },
      crime: {
        speaker: 'prisoner',
        lines: [
          "A hare. One hare. Out on the plains, which Lord Morten says are his, and which I say are God's, and the hare didn't say anything because I'd already caught it.",
          "His men walked me all the way back here, and ate the hare on the way. So who's the poacher? I ask you.",
        ],
        next: 'ask',
      },
      out: {
        speaker: 'prisoner',
        lines: [
          "When the Headman says. He's a fair man, Hale. Too fair. He'll give me a week, and a talking-to, and I'll have to sit through the talking-to.",
          "Hamm eats my supper, by the way. Tell the sergeant. No, don't. He'll stop bringing it altogether.",
        ],
        next: 'ask',
      },
      raid: {
        speaker: 'prisoner',
        lines: [
          "...I heard. The lads talk on the steps. I'm sorry, friend. Truly.",
          "And here's me, locked up safe as a babe while the whole village shakes. Tell the sergeant I'll fight. I've a good arm for a sling, and I know the north woods better than any of his spearmen.",
          "Snares, I mean. For hares. That's all I've ever been in the north woods for. Don't tell him that bit.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'prisoner', lines: ["Come back soon! I'm not going anywhere. That's the problem."] },
    },
  };
}
