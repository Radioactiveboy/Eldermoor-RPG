import { HERO_NAME } from '../config';
import { QuestLog } from '../systems/Quests';
import type { RoadOutcome } from '../systems/Reputation';
import type { DialogueChoice, DialogueScript } from './Dialogue';

/**
 * Folk met by chance out on Adowvale Plains (see world/PlainsEvents.ts): a
 * pair of footpads, Jory the tinker, Mags the goatherd and her runaway goat,
 * and Hal, Lord Morten's messenger, laid up with a twisted ankle. Their
 * actions start with 'road:', and are handled by PlainsEvents.
 */

/** How the hunt for Mags's goat stands. */
export type GoatStage = 'lost' | 'searching' | 'following' | 'home';

/** What the chance meetings on the plains need to remember while they last. */
export const Wayfarers = {
  /** The hunt for Clover, in the goat meeting now on the plains. */
  goat: 'lost' as GoatStage,
  /** What the footpads asked for, in coins. */
  toll: 0,
  /** Hal has been given something to eat. */
  courierFed: false,
};

/** Whether the goblins have burnt the farm in the Hollow: word of it has got about on the road. */
const afterRaid = () => QuestLog.hasFlag('raid-over');

/**
 * What the folk on the road call out as the hero passes, once word of the
 * raid has got about (see world/PlainsEvents.ts).
 */
export const RAID_CALLS: Partial<Record<string, string[]>> = {
  tinker: ['Bolts! Bars! Shutters mended!', 'Locks to keep the goblins out!', 'Tinker! Tinker on the road! Safe while it lasts!'],
  goatherd: ['Clover! Come back, the goblins will get you!', 'Clooover! Please!'],
  courier: ['Goblins in the Hollow, and me with one leg.', 'Hello? Please be a person.'],
};

/** And what they call out when it's pouring. */
export const WET_CALLS: Partial<Record<string, string[]>> = {
  tinker: ['Rain! Good for business! Rusts everything!', 'Kettles! Pots! Buckets, for the leaks!'],
  goatherd: ['Clover! You hate the rain! Come HOME!'],
  courier: ['Rain. Of course. Of course it is.'],
};

/** Food that can be handed straight over (nothing raw), in the order the hero would offer it. */
export const SHAREABLE_FOOD = [
  'bread', 'cheese', 'apple', 'meat-pie', 'honey-cake', 'boiled-egg', 'roast-hare', 'wolf-steak', 'venison-steak', 'roast-boar',
  'hare-stew', 'hunters-pottage', 'stew', 'carrot', 'ale', 'cider', 'mead',
] as const;

/**
 * Rook and Nab, footpads, stepping out of the grass to stop the hero on the road.
 * @param toll half of what the hero carries (what they ask for); 0 if the purse is empty
 * @param slewMother whether the hero has killed the Wolf Mother (and can say so)
 * @param again whether they've stopped the hero before
 */
/** What Rook says on meeting the hero again, by how their last meeting ended (see systems/Reputation.ts). */
const FOOTPADS_AGAIN: Partial<Record<RoadOutcome, string[]>> = {
  fought: ["You! Nab, it's the one who laid us out in the grass.", "We've had a long think about that, Nab and me. Mostly about our heads. Same toll as ever, friend. No hard feelings. Some hard feelings."],
  paid: ['Well, well! Our best customer. Nab, you remember our friend? Paid up like a gentleman, last time.', "Same as before, friend. It's a toll road, out here."],
  scared: ["Oh. Oh, it's you. The wolf-killer.", "...We've had a think, Nab and me, and we reckon you were having us on. So. Same as before."],
  empty: ['Our friend with the empty purse! Filled it up since? Let\'s have a look.'],
  fled: ["Well, well, if it isn't the runner. Not so quick on your feet today?", "It's a toll road, out here. You'll remember."],
  outran: ["Well, well, if it isn't the runner. Not so quick on your feet today?", "It's a toll road, out here. You'll remember."],
  beaten: ['Back for more? Nab, look who it is. Still got all your teeth, friend?', "It's a toll road, out here. You'll remember."],
};

/**
 * @param last how the hero's last run-in with them ended, if there's been one
 */
export function footpadScript(toll: number, slewMother: boolean, again: boolean, last?: RoadOutcome): DialogueScript {
  const choices: DialogueChoice[] = [
    toll > 0 ? { text: `Fine. Take your ${toll} coins.`, next: 'paid' } : { text: "Take it. There's nothing in it.", next: 'empty' },
    ...(slewMother ? [{ text: 'I killed the Wolf Mother in her own den. Want to be next?', next: 'mother' }] : []),
    { text: 'Come and take it, then.', next: 'fight' },
  ];
  return {
    start: again || last ? 'again' : 'greet',
    nodes: {
      greet: {
        speaker: 'footpad',
        lines: afterRaid()
          ? [
              'Hold up there, friend. No hurry, is there?',
              "Lonely road, since the goblins burnt that farm in the Hollow. Nab's been nervous ever since. And when Nab gets nervous, his knife comes out.",
            ]
          : [
              'Hold up there, friend. No hurry, is there? Lovely day for a walk.',
              'Lonely road, mind. Nab here gets nervous on lonely roads. And when Nab gets nervous, his knife comes out.',
            ],
        next: 'nab',
      },
      again: {
        speaker: 'footpad',
        lines: (last && FOOTPADS_AGAIN[last]) || ["Well, well. Our friend from the road. Nab, you remember our friend?", "Same as last time, friend. It's a toll road, out here."],
        next: 'nab',
      },
      nab: {
        speaker: 'cutpurse',
        lines: ['Nervous. Very nervous, me.'],
        next: 'demand',
      },
      demand: {
        speaker: 'footpad',
        lines: [
          toll > 0
            ? `So let's keep him calm. Half your purse, ${toll} coins, and we'll call it the Plains tithe. His Lordship takes his at the gate; we take ours out here.`
            : "So let's keep him calm. Your purse, if you please. All of it.",
        ],
        choices,
      },
      paid: {
        speaker: 'footpad',
        lines: ["Sensible. There, Nab, see? The gentleman's paid his tithe.", 'Safe road to you, friend. Safe as it gets, out here.'],
        action: 'road:footpads-paid',
      },
      empty: {
        speaker: 'footpad',
        lines: ["...It's empty, Nab. Not so much as a clipped farthing."],
        next: 'boots',
      },
      boots: {
        speaker: 'cutpurse',
        lines: ['Take his boots, then?'],
        next: 'pity',
      },
      pity: {
        speaker: 'footpad',
        lines: ['Leave him his boots. Go on, get out of it, before I start feeling sorry for you.'],
        action: 'road:footpads-leave',
      },
      mother: {
        speaker: 'footpad',
        lines: [
          "The white wolf? ...That's her hide they were on about in the Tankard?",
          'Nab. Nab, put the knife away. We were only passing, friend. Weren\'t we, Nab?',
        ],
        next: 'passing',
      },
      passing: {
        speaker: 'cutpurse',
        lines: ['Only passing. Very much only passing.'],
        action: 'road:footpads-scared',
      },
      fight: {
        speaker: 'footpad',
        lines: ['Have it your way, then. Nab!'],
        action: 'road:footpads-fight',
      },
    },
  };
}

/** What Jory has heard on his travels: one piece of news each time he's asked. */
const TINKER_NEWS = [
  [
    "The Harrowford bridge? They've started on a new one. Stone, this time. Lord Morten's not pleased: once the King's Road opens again, nobody'll pay his toll.",
  ],
  [
    'Wolves, wolves, everyone talks of wolves. I had one follow me two days in the Greyfells. Never came close. Just watched.',
    "I banged a pan at it in the end. It looked at me like I was a fool. Which I was, a bit.",
  ],
  [
    "Godric at the Tankard's had me mend the same kettle three times this year. I think he likes the company.",
  ],
  [
    "There's a woman in Thornwick says a door's been found in a hillside past the Hollow. Iron, and locked. I told her I'd pick it for a silver penny.",
    "She said it wasn't that sort of door. I don't know what other sort there is.",
  ],
];

/** Jory the tinker, stopped by the road with his pots and pans. Shows his wares (the 'tinker' shop). */
export function tinkerScript(first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'tinker',
        lines: [
          'Ho, a customer! Or a fellow traveller, which is nearly as good. Jory, tinker by trade: pots mended, knives ground, kettles un-holed.',
          "I go where the roads go, and the roads go everywhere, if you've the boots for it.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'tinker',
        lines: ['Back again! The pots have missed you.'],
        next: 'ask',
      },
      ask: {
        speaker: 'tinker',
        lines: ["What'll it be?"],
        choices: [
          { text: "Show me what you've got.", next: 'wares' },
          { text: 'Where are you headed?', next: 'road' },
          { text: 'Heard any news?', next: 'news' },
          ...(afterRaid() ? [{ text: 'Goblins burnt our farm in the Hollow.', next: 'goblins' }] : []),
          { text: 'Fare you well, Jory.', next: 'bye' },
        ],
      },
      wares: {
        speaker: 'tinker',
        lines: ["Feast your eyes. Mind the kettle, it bites. And I'll buy most anything, if the price is right. The price is usually low."],
        action: 'shop:tinker',
      },
      road: {
        speaker: 'tinker',
        lines: [
          "Saint Elda's, then over the Greyfells by the pass, if the snow holds off. The brothers always have a pot that wants mending.",
          'Their cook, Brother Hob, burns everything. Good for business, is Hob.',
        ],
        next: 'ask',
      },
      news: {
        speaker: 'tinker',
        lines: TINKER_NEWS[Math.floor(Math.random() * TINKER_NEWS.length)],
        next: 'ask',
      },
      goblins: {
        speaker: 'tinker',
        lines: [
          "That was your place? I saw the smoke from the toll road and took it for charcoal burners. Gods. I'm sorry.",
          "I mended a pot for a goblin once, up in the Greyfells. Paid me in teeth. But they never come down this far, not in a band. Not unless something's driven them.",
          "Folk are barring their doors from here to Thornwick. I've sold more bolts this week than in a year. I'm not proud of it.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'tinker',
        lines: ["And you! If you hear a clanking on the road, that'll be me."],
      },
    },
  };
}

/** Mags the goatherd, whose nanny goat Clover has slipped her tether. */
export function goatherdScript(stage: GoatStage, first: boolean): DialogueScript {
  const start = stage === 'following' ? 'found' : stage === 'home' ? 'home' : stage === 'searching' ? 'waiting' : first ? 'greet' : 'again';
  return {
    start,
    nodes: {
      greet: {
        speaker: 'goatherd',
        lines: [
          'Have you seen a goat? A brown one, with a white face and a bell, and a horrible temper?',
          "Her name's Clover. She slipped her tether while I was picking blackberries, and now she's gone, and Gran will skin me.",
          ...(afterRaid() ? ["And Gran says there's goblins about now, burning farms. Goblins eat goats. Everyone knows that."] : []),
        ],
        choices: [
          { text: "I'll help you look for her.", next: 'help' },
          { text: "Sorry, I haven't seen her.", next: 'sorry' },
        ],
      },
      again: {
        speaker: 'goatherd',
        lines: ["You again! Clover's gone off. AGAIN. Will you help me find her? Please?"],
        choices: [
          { text: "All right. I'll look for her.", next: 'help' },
          { text: 'Not this time, Mags.', next: 'sorry' },
        ],
      },
      help: {
        speaker: 'goatherd',
        lines: [
          "Would you? She can't have gone far. She's too greedy to walk anywhere when there's grass to eat.",
          "If you find her, take hold of her collar and she'll follow you. Mostly. Bring her back here to me!",
        ],
        action: 'road:goat-search',
      },
      sorry: {
        speaker: 'goatherd',
        lines: ["Oh. Well, if you see her, she answers to Clover. Or she doesn't, but that's her name."],
      },
      waiting: {
        speaker: 'goatherd',
        lines: ["Any sign of her? Listen for her bell. She'll be off eating something she shouldn't."],
      },
      found: {
        speaker: 'goatherd',
        lines: [
          "Clover! You found her! Oh, you wicked, horrible goat, I've been calling and calling!",
          `Thank you, thank you. Here: Gran's cheese, made with Clover's own milk. And this, it's all I've got. Gran will want to know your name... ${HERO_NAME}? I'll tell her.`,
        ],
        action: 'road:goat-home',
      },
      home: {
        speaker: 'goatherd',
        lines: ["Clover's never leaving my sight again. Are you, Clover? ...She's eating my hat."],
      },
    },
  };
}

/** What Hal tells the hero, in thanks for something to eat: one of these, picked at random. */
const COURIER_NEWS = [
  "Here's something for nothing: the letters I carry say the bridge at Harrowford will be rebuilt by spring. When the King's Road opens again, His Lordship's tolls will dry up. Don't tell him I said so.",
  "His Lordship's letters are all about wolves. They've come further down from the Greyfells this year than anyone remembers. Shepherds up at Thornwick are sleeping out with their flocks.",
  "They're talking in Harrowford about a door in a hillside, out past the Hollow. Iron, and locked, and older than the village. Old Lord Morten had the key, they say, and took it to his grave.",
  "The Prior at Saint Elda's has written to His Lordship three times about the wolves on the road. His Lordship hasn't answered. I've the fourth letter here.",
];

/** Hal, Lord Morten's messenger, sat by the road with a twisted ankle. Something to eat buys his thanks, some coin and some news. */
export function courierScript(fed: boolean, food: string | undefined, first: boolean): DialogueScript {
  const ask: DialogueChoice[] = [
    ...(food ? [{ text: `Here, have my ${food}.`, next: 'fed' }] : []),
    { text: 'Can I help?', next: 'help' },
    ...(afterRaid() ? [{ text: 'Goblins burnt a farm in the Hollow. Does His Lordship know?', next: 'goblins' }] : []),
    { text: 'Mind how you go.', next: 'bye' },
  ];
  return {
    start: fed ? 'better' : first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'courier',
        lines: [
          "Ah. Hello. Don't mind me, I'm only resting here admiring the view. And my ankle, which has gone a very interesting colour.",
          "Hal. I carry Lord Morten's letters. Or I did, until a hare ran under my feet and I put one leg down a rabbit hole.",
        ],
        choices: ask,
      },
      again: {
        speaker: 'courier',
        lines: ["Still here. The ankle's still purple. The rabbit hole's still there, I checked."],
        choices: ask,
      },
      help: {
        speaker: 'courier',
        lines: [
          "Unless you've a spare leg, no. I'll hobble on to the toll gate; Gerd will find me a cart going to Adowvale.",
          "Though I'd not say no to something to eat. I've had nothing since Harrowford.",
        ],
        choices: ask.filter((c) => c.next !== 'help'),
      },
      fed: {
        speaker: 'courier',
        lines: [
          "Oh, that's... you're a saint. Truly.",
          COURIER_NEWS[Math.floor(Math.random() * COURIER_NEWS.length)],
          "And take these. His Lordship pays me extra for speed, and I'll not be earning it today.",
        ],
        action: 'road:courier-fed',
      },
      goblins: {
        speaker: 'courier',
        lines: [
          "Goblins? This side of the Greyfells? ...Then the Prior's letters weren't only about wolves, were they.",
          "His Lordship will know by tonight, if I have to hop to Harrowford on one leg. Whether he'll do anything is another matter. He hasn't answered the wolves yet.",
        ],
        choices: ask.filter((c) => c.next !== 'goblins'),
      },
      better: {
        speaker: 'courier',
        lines: ["Much better, thank you. I'll be on my way. Slowly."],
      },
      bye: {
        speaker: 'courier',
        lines: ["I'll mind it. Mind the rabbit holes."],
      },
    },
  };
}
