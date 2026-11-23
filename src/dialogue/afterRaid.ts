import { HERO_NAME } from '../config';
import { QuestLog } from '../systems/Quests';
import type { DialogueChoice, DialogueNode, DialogueScript, SpeakerId } from './Dialogue';

/**
 * How Adowvale talks once the goblins have burnt the farm in the Hollow and
 * carried Mother off (the 'raid-over' flag, see world/GoblinRaid.ts).
 *
 * Nobody asks after a sick mother any more, and nobody points the hero to
 * moonpetal or willow bark: all of that is behind them. Instead everyone has
 * heard of the raid, and has something to say about it: the militia most of
 * all, who saw the smoke from the square and have been jumping at shadows
 * since. Each person's ordinary conversation is changed here, by
 * {@link raidAware}, rather than in every script, so the writing before the
 * raid stays as it was.
 */

/** The goblins have been: the farm is ash and Mother is gone. */
export const raidIsOver = (): boolean => QuestLog.hasFlag('raid-over');

/** How one person's conversation changes after the raid. */
export interface RaidTalk {
  speaker: SpeakerId;
  /**
   * Said the first time they're spoken to after the raid, before whatever
   * they'd have said anyway: how sorry they are, what they saw.
   */
  first?: string[];
  /** Nodes whose lines are different now. */
  lines?: Record<string, string[]>;
  /** Lines added to the end of a node. */
  more?: Record<string, string[]>;
  /** Choices no longer offered, by the node they lead to: errands for Mother's fever. */
  drop?: string[];
  /** New things to ask, offered in `at` (default 'ask'), before its last choice (the goodbye). */
  ask?: DialogueChoice[];
  at?: string;
  /** New nodes those lead to. */
  nodes?: Record<string, DialogueNode>;
}

/** The flag kept once someone has said their piece about the raid, so they only say it once. */
export const toldOfRaid = (speaker: SpeakerId) => `raid-told:${speaker}`;

/**
 * Someone's conversation, as it stands after the raid: unchanged before it,
 * or for anyone without anything new to say.
 * @param id who's talking (an NPC id: 'guard-3' is one of the militia)
 */
export function raidAware(id: string, script: DialogueScript): DialogueScript {
  if (!raidIsOver()) return script;
  const talk = RAID_TALK[talkerOf(id)];
  return talk ? applyRaidTalk(script, talk) : script;
}

/** Whose talk an NPC has: the four militiamen share theirs, as do the two toll guards. */
function talkerOf(id: string): string {
  return id.replace(/-\d+$/, '');
}

/** One person's conversation with their {@link RaidTalk} worked in. */
export function applyRaidTalk(script: DialogueScript, talk: RaidTalk): DialogueScript {
  const drop = new Set(talk.drop ?? []);
  const nodes: Record<string, DialogueNode> = {};
  for (const [key, node] of Object.entries(script.nodes)) {
    const lines = talk.lines?.[key] ?? node.lines;
    const more = talk.more?.[key] ?? [];
    const choices = node.choices?.filter((c) => !c.next || !drop.has(c.next));
    nodes[key] = { ...node, lines: [...lines, ...more], ...(choices ? { choices } : {}) };
  }
  Object.assign(nodes, talk.nodes);
  const at = nodes[talk.at ?? 'ask'];
  if (talk.ask && at?.choices) {
    const choices = [...at.choices];
    choices.splice(Math.max(0, choices.length - 1), 0, ...talk.ask);
    nodes[talk.at ?? 'ask'] = { ...at, choices };
  }
  let start = script.start;
  const flag = toldOfRaid(talk.speaker);
  if (talk.first && !QuestLog.hasFlag(flag)) {
    QuestLog.setFlag(flag);
    nodes['raid-first'] = { speaker: talk.speaker, lines: talk.first, next: start };
    start = 'raid-first';
  }
  return { start, nodes };
}

/** "The goblins took my mother", and what each of them makes of it. */
const TOOK_MOTHER = 'Goblins burnt our cottage. They took my mother.';

const RAID_TALK: Record<string, RaidTalk> = {
  // ---- The market square ----
  // The village militia: the cooper's boys, the miller's nephew and old Garrick, who watched the smoke go up and did nothing.
  guard: {
    speaker: 'guard',
    first: [
      `You're ${HERO_NAME}, from the cottage in the Hollow. Gods. We thought... We saw the smoke from the square at first light, a great black column of it.`,
      "The sergeant wouldn't let us go down. \"If it's goblins, we hold the village,\" he said. I wanted to go. I swear I did. I'm sorry.",
    ],
    lines: {
      tired: ["Double watches since the Hollow. I've not been to my bed since. Nobody has. The sergeant sleeps in his boots now."],
      bored: ["Quiet. Too quiet. Every time a dog barks, half of us drop our spears. Garrick threw his at a hen this morning."],
      closed: [
        "Market's shut, and the gates are barred at dusk now. Sergeant's orders, since the Hollow.",
        "Hilde, Osric and Tamsin went home before the light went, with their shutters up. They'll be back in the morning, gods willing.",
      ],
      wolves: [
        "Goblins. Goblins! My gran told us about goblins to make us eat our greens. And now there's a band of them burning farms an hour's walk from here.",
        'The wolves, too, still. But nobody talks about the wolves any more.',
      ],
      road: [
        "Not since the Hollow. In daylight, keep to the road and keep moving. After dark, nobody goes past the trough alone. Sergeant's orders.",
        "Fire won't keep goblins off, mind. They brought their own.",
      ],
      bye: ['Move along, then. And watch the north road. Please.'],
    },
    more: {
      board: ["The reeve wants a goblin notice up, but nobody can agree what to pay for one. Or who'd be daft enough to take it."],
    },
    ask: [
      { text: TOOK_MOTHER, next: 'raid-mother' },
      { text: 'What is the militia doing about the goblins?', next: 'raid-doing' },
    ],
    nodes: {
      'raid-mother': {
        speaker: 'guard',
        action: 'told-militia',
        lines: [
          'Took her? Alive? ...Then there\'s hope, isn\'t there. Goblins don\'t carry off the dead.',
          "Which way did they go? Did anyone see?",
        ],
        choices: [
          { text: 'North, past the cave and into the woods.', next: 'raid-north' },
          { text: 'Will you help me get her back?', next: 'raid-help' },
        ],
      },
      'raid-north': {
        speaker: 'guard',
        lines: [
          "The north woods? Nobody goes in there. There's the old watchtower on the rise, and past that nothing but trees, all the way to the fells.",
          "I'll tell the sergeant. He'll want to know. He'll go pale, but he'll want to know.",
        ],
        next: 'raid-help',
      },
      'raid-help': {
        speaker: 'guard',
        lines: [
          "I... We're the cooper's boys and the miller's nephew and old Garrick, who's deaf in one ear. None of us has ever seen a goblin. Not a live one.",
          "The sergeant says the militia's for the village, and if we march off into the woods there's nobody on the gate. He's not wrong. I hate that he's not wrong.",
          "He's sent to Lord Morten for men. If you go after her first, take a proper blade off Osric, and a helm. And come back and tell us what you find.",
        ],
        next: 'ask',
      },
      'raid-doing': {
        speaker: 'guard',
        lines: [
          "Doubled the watch. Barred the gates at dusk. Sharpened everything that'll take an edge, and some things that won't.",
          "The sergeant's sent a rider to Lord Morten asking for men. Morten's sent back asking who's to pay for them. So that's going well.",
          "And we've stopped arresting geese. It didn't feel right, after.",
        ],
        next: 'ask',
      },
    },
  },
  baker: {
    speaker: 'baker',
    first: [
      `Oh, ${HERO_NAME}. Oh, love, come here. We saw the smoke from the square. Half the village was out on the green watching it.`,
      "Is it true? The cottage, and your mother? Iran's not been in, and nobody dared go down to look. I've not slept a wink.",
    ],
    lines: {
      greet: [
        `${HERO_NAME}, love. I'd know your face anywhere, and I'm so glad to see it with breath in it.`,
        "Hilde, from the bakery. I bake for half the village and gossip for the other half, and this morning there's only one thing anyone's talking about.",
      ],
      trade: [
        "Trade? Nobody's buying cakes, love. They're buying bread by the armful and locking it up, as if the goblins were coming for the loaves.",
        "And the militia lads still eat like horses. More, now. Fear's hungry work.",
      ],
      bye: [`Mind how you go, ${HERO_NAME}. And you bring her home. You hear me? You bring her home.`],
      closing: [
        "I'm off home before the light goes, love. Everyone is, now. Bar your door, the sergeant says, and I'm not one to argue.",
        "Come and find me at my stall tomorrow. There'll be a warm one for you, always.",
      ],
      tavern: [
        "Off duty, love. Not a crumb to sell till the morning.",
        "Sit with us, if you like. Nobody's telling stories tonight. We're just... sitting together. It helps.",
      ],
    },
    drop: ['healer'],
    ask: [{ text: TOOK_MOTHER, next: 'raid-mother' }],
    nodes: {
      'raid-mother': {
        speaker: 'baker',
        lines: [
          "Oh, love. Oh, your poor mother. She was only just on the mend, Godric said. You'd brewed her something.",
          "Took her, not... Then she's alive. You hold on to that. Your mother's tougher than any goblin. I've seen her haggle.",
          "Eat something before you go anywhere. I mean it. You're no use to her starved.",
        ],
        next: 'ask',
      },
    },
  },
  smith: {
    speaker: 'smith',
    first: [
      "Hm. ...Heard about the Hollow. About your mother.",
      "I'm sorry. I'm no good with words. I'm good with iron. If you're going after them, you'll want iron.",
    ],
    lines: {
      blades: [
        "Wolves, it was. Now it's goblins. The reeve wants spearheads by the dozen, and I've been at the anvil since the smoke went up.",
        "I'd still rather be making ploughshares. But nobody ploughs with goblins in the Hollow.",
      ],
      tavern: ["Hm. Not drinking much tonight. Nobody is.", "...Sit, if you're sitting."],
    },
    ask: [{ text: "I'm going after the goblins.", next: 'raid-goblins' }],
    nodes: {
      'raid-goblins': {
        speaker: 'smith',
        lines: [
          "Hm. Thought you might be. My grandad fought them, in the old lord's time. Said they're small, quick, and there's always more of them than you counted.",
          "Don't let them get round you. Back to a tree, or a wall. And wear something on your head: they go for the head, he said, and they bite.",
          "And a blade, not a stick. They don't scare off.",
        ],
        next: 'ask',
      },
    },
  },
  tanner: {
    speaker: 'tanner',
    first: [
      "...It's you. I heard. The whole square's heard. I'm sorry about your mother. And your home.",
      "Don't mind me if I'm short with folk. I can't stop looking at the north road.",
    ],
    lines: {
      militia: [
        "The village militia. The cooper's boys, the miller's nephew, and old Garrick who's deaf in one ear.",
        "They used to walk round the square looking stern. Since the smoke went up over the Hollow, they walk round it looking frightened. So does everyone.",
        "I made their belts. I'm making them leather caps now, with an iron band. Small heads, goblins go for, they say. I don't want to know how they know.",
      ],
      bye: ["Watch yourself out there. I mean it. Come back with all your hide on."],
    },
    ask: [{ text: 'What do you know about goblins?', next: 'raid-goblins' }],
    nodes: {
      'raid-goblins': {
        speaker: 'tanner',
        lines: [
          "Only what my nan said. That they live under the hills and come up when there's a hard winter coming. That they steal anything that shines, and anyone who can't run.",
          "She said they took her uncle's cow and sent the bell back. I always thought she made that bit up.",
        ],
        next: 'ask',
      },
    },
  },
  // ---- The Crooked Tankard ----
  landlord: {
    speaker: 'landlord',
    first: [
      `${HERO_NAME}. ...Shut the door, lad, and come by the fire. We heard. The whole room's heard. Odo came in from the crossroads at noon, shouting about smoke over the Hollow.`,
      "Your mother. In my cellar not two days since you were, brewing her that tincture. And now... I'm sorry. Whatever you need, you ask.",
    ],
    lines: {
      greet: [
        "Come in, come in, and bar the door behind you. Welcome to the Crooked Tankard.",
        "Godric. I own the place and I pour the ale. Nobody's singing tonight, not even Pell. What'll it be?",
      ],
      again: [`${HERO_NAME}. Good to see you whole. What'll it be?`],
      late: ["Still up? So am I. I don't sleep much since the Hollow. Somebody has to watch the door."],
    },
  },
  nell: {
    speaker: 'nell',
    first: ["Oh, love. I heard about your mother. I'm so sorry.", "You sit down and eat something. You look like you've been dragged through a hedge."],
    lines: {
      gossip: [
        "Busy. Busier than it's been all year, and nobody laughing. Folk don't want to be home alone, so they're here, all of them, with their backs to the wall.",
        "Godric's put a bar on the door. First time in my life I've seen it barred.",
      ],
    },
  },
  rosie: {
    speaker: 'rosie',
    first: ["You're the one from the Hollow! Oh, I'm so sorry. Is it true there were hundreds of them? Cobb says hundreds."],
    lines: {
      gossip: [
        "Nobody's dancing. Pell tried a jig and Godric told him to stop. Then he said sorry for it, which is worse.",
        "I won't go down the cellar now at all. Not for anything. Not with goblins coming up out of the ground.",
      ],
    },
  },
  harlan: {
    speaker: 'harlan',
    first: [
      "Eh? The lad from the Hollow. Sit down. I heard. Goblins.",
      "My grandad said they'd come back one day. Nobody listened to him either.",
    ],
    ask: [{ text: 'Your grandad knew about goblins?', next: 'raid-goblins' }],
    nodes: {
      'raid-goblins': {
        speaker: 'harlan',
        lines: [
          "Knew about them? He fought them. Old Lord Morten's men, the grandad, not this one, drove them back down into the deep places under the hill.",
          "That's what the door was for, lad. The one in the hill. To keep them down there. Somebody's found another way up, I'd wager. North, in the old woods.",
          "...I'll have that drink now. I don't like thinking about it sober.",
        ],
        next: 'ask',
      },
    },
  },
  fenwick: {
    speaker: 'fenwick',
    lines: {
      again: ["Ah. The young fellow from the Hollow. I heard. I'm very sorry. Sit, if you like. I can't keep my mind on the ledger anyway."],
    },
    ask: [{ text: 'Have you heard anything about the goblins?', next: 'raid-goblins' }],
    nodes: {
      'raid-goblins': {
        speaker: 'fenwick',
        lines: [
          "Only that they've been seen on the fells, north of the woods, driving off whole flocks. Coombe's lost a dozen more ewes, and for once he isn't blaming the drover.",
          "I'm going south the moment that bridge is mended. I'd advise you to come with me, but I can see you won't.",
        ],
        next: 'ask',
      },
    },
  },
  sigrun: {
    speaker: 'sigrun',
    ask: [{ text: 'Will you help me hunt the goblins?', next: 'raid-hunt' }],
    nodes: {
      'raid-hunt': {
        speaker: 'sigrun',
        lines: [
          "Goblins. I heard. Who's paying? ...You? With what?",
          "Hm. Find out where they've gone, first. I don't walk into woods blind, not for coin and not for anyone's mother. Then ask me again.",
          "And go in daylight. They hate the sun. It's the only thing they hate more than us.",
        ],
        next: 'ask',
      },
    },
  },
  pell: {
    speaker: 'pell',
    lines: {
      wolves: [
        "Wolves? ...Nobody wants songs tonight, friend. Not about wolves, and gods help me, not about goblins. I tried. Godric took my lute away.",
        'If you bring her home, though. Then there will be a song, and I shall write it for nothing.',
      ],
    },
  },
  ada: {
    speaker: 'ada',
    first: ["Not today, dearie. ...Well. If you want to throw the dice to take your mind off it, I'll let you. I won't even cheat."],
  },
  // ---- The road and the gate ----
  tollguard: {
    speaker: 'tollguard',
    more: {
      greet: ["And yes, His Lordship's heard about the goblins in the Hollow, before you ask. He's \"considering it\". The toll still stands."],
      paid: ["Keep your eyes open out there. There's talk of goblins on the fells now, not just in the Hollow."],
    },
    ask: [{ text: 'Goblins burnt a farm in the Hollow. Will Lord Morten send men?', next: 'raid-morten' }],
    nodes: {
      'raid-morten': {
        speaker: 'tollguard',
        lines: [
          "Not ours to say. Your sergeant sent a rider. His Lordship sent back asking who'd pay for the men, and the rider's been sat in the guardhouse at the manor since.",
          "Between us, the two of us on this gate are all the men His Lordship's got on this side of the river. And we're staying on this gate.",
        ],
        next: 'ask',
      },
    },
  },
  carter: {
    speaker: 'carter',
    drop: ['moonpetal'],
    ask: [{ text: 'Have you seen any goblins on the road?', next: 'raid-goblins' }],
    nodes: {
      'raid-goblins': {
        speaker: 'carter',
        lines: [
          "Goblins? Not with my own eyes, and I'd like to keep it that way. Saw the smoke from the crossroads, over the Hollow. I thought it was a hayrick.",
          "The brothers are praying for whoever lived there. ...That was you? Gods. I'm sorry, lad. I'll keep my eyes open, coming and going.",
        ],
        next: 'ask',
      },
    },
  },
  herbwife: {
    speaker: 'herbwife',
    drop: ['moonpetal', 'willow'],
    ask: [{ text: TOOK_MOTHER, next: 'raid-mother' }],
    nodes: {
      'raid-mother': {
        speaker: 'herbwife',
        lines: [
          "Oh, my dear. ...I heard there'd been a burning in the Hollow. I didn't know it was yours.",
          "If you're going after her, take yarrow for the cuts and comfrey for the bruises. They grow wild all over the plains. Your mother would tell you the same, I'm sure.",
          'Go gently. And then not gently at all, when you find them.',
        ],
        next: 'ask',
      },
    },
  },
  // ---- Saint Elda's ----
  porter: {
    speaker: 'porter',
    first: [
      `${HERO_NAME}. Peace be with you. ...Odo brought us the news from the crossroads. The Prior has rung the bell for your mother, morning and evening.`,
      'Saint Elda found the lost, they say. We have asked her to find yours.',
    ],
    lines: {
      accept: [
        "You would do that? For a gate and an old man's blessing? ...You have enough to carry already, I would have thought. But I see you mean it.",
        'Then go with Saint Elda. Kill the white wolf, come back and tell me, and I will open this gate to you myself, and the Prior can say what he likes.',
      ],
    },
    drop: ['moonpetal', 'moonpetal-open'],
    ask: [{ text: TOOK_MOTHER, next: 'raid-mother' }],
    nodes: {
      'raid-mother': {
        speaker: 'porter',
        lines: [
          'I know, my child. I know. It is a cruel thing, to see someone mended only for this.',
          'The brothers have not seen goblins on the road. They do not come east, not yet. Whatever they want, it is north of you, under the trees.',
        ],
        next: 'ask',
      },
    },
  },
  gardener: { speaker: 'gardener', drop: ['moonpetal'] },
  prior: {
    speaker: 'prior',
    first: [`${HERO_NAME}. We heard. I am sorry. Sit, if you wish, and pray with me, or do not, as you like. The Saint does not mind which.`],
    drop: ['mother'],
    ask: [{ text: TOOK_MOTHER, next: 'raid-mother' }],
    nodes: {
      'raid-mother': {
        speaker: 'prior',
        lines: [
          'Yes. Brother Wystan told me. We have rung the bell for her, and we will go on ringing it until you bring her home or bring us word.',
          'I have written to Lord Morten myself. He does not read my letters, but he will have this one read to him, and I have not been gentle in it.',
          'Whatever you need from this house, take it. That is not a favour. It is what we are for.',
        ],
        next: 'ask',
      },
    },
  },
  anselm: {
    speaker: 'anselm',
    first: [
      "Ah, there you are. Wystan told me. Come here, let me look at you. ...Bruised to the bone, and a cut on your scalp you have not even noticed.",
      'Take sage and comfrey from the beds before you go, as much as you can carry. I insist.',
    ],
    drop: ['tincture', 'which', 'picked', 'what'],
    ask: [{ text: TOOK_MOTHER, next: 'raid-mother' }],
    nodes: {
      'raid-mother': {
        speaker: 'anselm',
        lines: [
          'She had the tincture, though? She took it? Then she was mending when they took her. That matters more than you think.',
          'A woman who is mending can endure a great deal. Hold on to that, as I am holding on to it.',
        ],
        next: 'ask',
      },
    },
  },
  leofric: {
    speaker: 'leofric',
    first: ["Anselm told me about your home. And your mother. I'm sorry. ...I'd come with you after them, if I had two good legs. I've a mind to try with one."],
  },
  cook: {
    speaker: 'cook',
    first: ['Sit. Eat. No, I am not asking. Grief or goblins, you go nowhere on an empty belly from my kitchen.'],
  },
  // ---- The Hollow ----
  fisherman: {
    speaker: 'fisherman',
    first: [
      "Lad. ...I saw it. The fire. From here, across the water, with the sun coming up behind it. I couldn't do a thing. Not with these legs, not with the lake between.",
      "They went off north after, a whole crowd of them, shrieking. I hid in the reeds like a coward. Your mother... did they...?",
    ],
    lines: {
      peace: [
        "Peaceful? Not since the fire. I come out every morning because I always have. I don't know what else to do.",
        "The fish don't mind goblins. I find I do.",
      ],
    },
    ask: [{ text: 'They took her north. Did you see anything else?', next: 'raid-saw' }],
    nodes: {
      'raid-saw': {
        speaker: 'fisherman',
        lines: [
          "A big one, in iron, carrying something wrapped in red. The rest running round him like dogs. Up past the cave, along the path into the woods.",
          "If she's in that bundle, lad, she was carried careful. Goblins don't carry the dead careful. Hold on to that.",
        ],
        next: 'ask',
      },
    },
  },
};

/** What the militia call out about the market's hours, once the goblins have been. */
export const MILITIA_RAID_CALLS = {
  closing: "Market's closing! Off home, all of you, before the light goes. And bar your doors!",
  closed: "Market's shut, friend, and the gates are barred at dusk now. Sergeant's orders.",
  opening: 'Morning! Market\'s open. Keep close to the square, folks.',
};

/** What the militia shout to each other on their rounds, since the raid. */
export const MILITIA_WATCH = [
  'Eyes on the north road!',
  'All quiet on the gate!',
  'Did you hear that? ...No. Just a dog.',
  "Nobody goes past the trough alone!",
  'Keep your spear up, Garrick!',
  "If it's small and it's grinning, shout!",
];
