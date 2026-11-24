import { HERO_NAME } from '../config';
import type { DialogueChoice, DialogueNode, DialogueScript } from './Dialogue';

/**
 * The old beacon on Corbie Tor (see world/BeaconMap.ts and scenes/game/beacon.ts).
 *
 * Headman Hale asks the hero, once Mother is home and buried, to go up and see
 * whether the beacon can be opened again. Inside, Corwin Haske, who kept it for
 * twenty years until Lord Morten stood the watch down, holds it with three of
 * his band: Big Garth, Teg and Wren. The hero can pay them to go (haggling them
 * down), talk Corwin into keeping the tower again for the Headman's wage and a
 * pardon, or fight them for it. Corwin knew the hero's father, Aldo, who stood
 * the watch at the old tower in the north woods.
 */

/** How the beacon was settled: the band beaten, paid to go, or taken on as its keepers. */
export type BeaconOutcome = 'fought' | 'paid' | 'hired';

/** What Corwin's band asks to go, and what Corwin comes down to. */
export const BEACON_PRICE = 80;
export const BEACON_HAGGLED = 60;
/** Coins given Corwin on account, till the Headman's wage comes (when the hero's word alone won't do). */
export const BEACON_EARNEST = 20;
/** What the Headman pays from the village chest. */
export const BEACON_REWARD = 60;

/** What Corwin knows when spoken to. */
export interface CorwinTalk {
  /** The first time: he stops the hero at the door. */
  first: boolean;
  /** The Headman has sent the hero (the quest is on), so there's something to bargain over. */
  errand: boolean;
  coins: number;
  /** The hero has beaten him down to {@link BEACON_HAGGLED} already. */
  haggled: boolean;
  /** Adowvale likes the hero well enough that their word stands for a pardon. */
  trusted: boolean;
  /** He's already told the hero about their father. */
  toldOfAldo: boolean;
  /** He and his band keep the tower now, for the Headman. */
  keepers: boolean;
}

/** Corwin Haske, captain of the brigands in the beacon, once its warden. */
export function corwinScript(t: CorwinTalk): DialogueScript {
  if (t.keepers) return CORWIN_KEEPER;
  const price = t.haggled ? BEACON_HAGGLED : BEACON_PRICE;
  const menu: DialogueChoice[] = [
    ...(t.errand ? [{ text: 'The Headman wants his beacon back.', next: 'errand', key: true }] : []),
    { text: 'Who are you?', next: 'who' },
    { text: 'What are you doing up here?', next: 'why' },
    { text: 'Draw my weapon. (Fight)', next: 'fight-sure' },
    { text: "I'll leave you to it.", next: 'leave' },
  ];
  const nodes: Record<string, DialogueNode> = {
    halt: {
      speaker: 'corwin',
      lines: [
        "That's far enough.",
        'Easy, now. Nobody here wants blood on the floor, least of all the floor. Wren has had an arrow on the string since you came up the path, and Wren does not miss.',
        'So. Who sent you, and what for?',
      ],
      choices: menu,
    },
    again: {
      speaker: 'corwin',
      lines: ['Back again. Wren, ease off the string. Well?'],
      choices: menu,
    },
    menu: { speaker: 'corwin', lines: ['Well?'], choices: menu },
    who: {
      speaker: 'corwin',
      lines: [
        "Corwin Haske. I kept this beacon twenty years, for Lord Morten's grandfather and then for him, till he decided the north was quiet and the tower cost too much.",
        "That's Garth by the fire, Teg by the door, and Wren up on the stair. Garth was a drover. Teg was a tanner's lad. Wren was the best shot in the Stonebrook watch, before there wasn't a Stonebrook watch.",
        'Twelve years since they stood us down. No pay after Lammas, and no thanks either. A man has to eat.',
      ],
      next: t.toldOfAldo ? 'menu' : 'look',
    },
    look: {
      speaker: 'corwin',
      lines: ['...Hold on. Come into the light.', 'You have a look of Aldo about you. Aldo from the Hollow, who stood the watch at the old tower in the north woods. Your father?'],
      choices: [
        { text: 'He was. You knew him?', next: 'aldo', action: 'beacon-told-aldo' },
        { text: 'Leave my father out of it.', next: 'menu', action: 'beacon-told-aldo' },
      ],
    },
    aldo: {
      speaker: 'corwin',
      lines: [
        'Knew him? I lit this beacon for him once. His tower saw lights in the trees three nights running, low down and moving, and he sent a rider to me.',
        'Small grey men at the edge of the wood, he said. Every beacon from here to Harrowford was burning by midnight, and the next morning they were gone, back under their hill.',
        'A good man, your father. Went off north after something, they told me, and never came back. I was sorry for it.',
      ],
      next: 'menu',
    },
    why: {
      speaker: 'corwin',
      lines: [
        "Holding out. It's a roof, and it's dry, and from the top of it a man can see trouble coming two hours off.",
        "We take a toll off Lord Morten's carts when they come up the north road. He tolls everyone else. Call it the same thing, from the other end.",
      ],
      next: 'menu',
    },
    errand: {
      speaker: 'corwin',
      lines: [
        'Hale sent you? Osbert Hale wants his beacon back.',
        'Course he does. Goblins down off the fells, farms burnt, folk carried off. Now he remembers what the tower was for.',
        "Twelve years I asked him for the wage to keep it. Twelve years. And now it's wanted, there's a band of thieves in it. Funny old world.",
      ],
      choices: [
        { text: 'Leave the tower, and nobody needs to get hurt.', next: 'price', key: true },
        { text: 'The tower needs a keeper. Who better than its old warden?', next: 'keeper', key: true },
        { text: "Then we'll settle it the other way.", next: 'fight-sure' },
        { text: 'Let me think on it.', next: 'menu' },
      ],
    },
    price: {
      speaker: 'corwin',
      lines: t.haggled
        ? [`${BEACON_HAGGLED} coins, and we're down the north road by dark. I said not a copper under, and I meant it.`]
        : [
            'Leave? And go where, at the back end of the year, with goblins on the fells?',
            `We'd go. For a price. ${BEACON_PRICE} coins, and we're down the north road by dark and you never see us again.`,
          ],
      choices: [
        ...(t.coins >= price ? [{ text: `Here. ${price} coins. (Pay)`, next: 'paid', action: `beacon-pay:${price}`, key: true }] : []),
        ...(t.haggled ? [] : [{ text: `${BEACON_PRICE}? Forty, and you keep your skins.`, next: 'haggle', action: 'beacon-haggle' }]),
        ...(t.coins < price ? [{ text: "I haven't got that much.", next: 'poor' }] : []),
        { text: 'Not a coin.', next: 'menu' },
      ],
    },
    haggle: {
      speaker: 'corwin',
      lines: [
        'Ha! Garth, do you hear? Forty.',
        `${BEACON_HAGGLED}. Not a copper under. And that's only because you came up here and asked, instead of coming through the door with a sword out.`,
      ],
      choices: [
        ...(t.coins >= BEACON_HAGGLED ? [{ text: `${BEACON_HAGGLED} it is. (Pay)`, next: 'paid', action: `beacon-pay:${BEACON_HAGGLED}`, key: true }] : []),
        ...(t.coins < BEACON_HAGGLED ? [{ text: "I haven't got that much.", next: 'poor' }] : []),
        { text: 'Let me think on it.', next: 'menu' },
      ],
    },
    poor: {
      speaker: 'corwin',
      lines: ["Then go and get it. We're not going anywhere. That's rather the point."],
      next: 'menu',
    },
    paid: {
      speaker: 'corwin',
      lines: [
        'Done. Garth, Teg, Wren: get your packs.',
        "Look after my tower. The stair's sound, the hatch sticks, and there's fuel laid on the roof. Don't let the fools light it for nothing.",
      ],
    },
    keeper: {
      speaker: 'corwin',
      lines: ['...Say that again.'],
      choices: [{ text: 'Keep the beacon, as you did. Hale pays a warden\'s wage, and you keep watch on the fells.', next: 'terms', key: true }],
    },
    terms: {
      speaker: 'corwin',
      lines: [
        "And the carts we've had off the road? Hale's a Headman. He'll want us in Brannock's cells, not on his wage.",
        'A pardon, then. His word, for all four of us, and the wage paid. Then we keep his tower, and we light his beacon when the goblins come, and not before.',
        t.trusted ? "They talk about you in Adowvale, mind. If you say Hale will do it, I'd half believe you." : "Only I've never met you before today. Why should I take your word for Hale's?",
      ],
      choices: [
        ...(t.trusted ? [{ text: 'You have my word. Hale will do it.', next: 'bargain', action: 'beacon-hire', key: true }] : []),
        ...(t.coins >= BEACON_EARNEST
          ? [{ text: `Here's ${BEACON_EARNEST} coins on account, till the wage comes.`, next: 'bargain', action: 'beacon-hire-earnest', key: true }]
          : []),
        { text: "I can't promise that.", next: 'menu' },
      ],
    },
    bargain: {
      speaker: 'corwin',
      lines: [
        "Then we've a bargain.",
        "Wren, unstring that bow. Teg, put the kettle on. Garth, you're on watch, top of the tower, and if you fall asleep up there I'll push you off it.",
        `Go and tell Hale his beacon's manned. And tell him Corwin Haske said he took his time about it. The roof's yours whenever you want it, ${HERO_NAME}.`,
      ],
    },
    'fight-sure': {
      speaker: 'corwin',
      lines: ['You would fight four of us, in our own tower? Think, now. This is the last time I ask.'],
      choices: [
        { text: 'Yes. (Fight)', next: 'fight', key: true },
        { text: 'No. Not today.', next: 'menu' },
      ],
    },
    fight: {
      speaker: 'corwin',
      lines: ["Is that how it is. Shame. I liked you.", 'Garth. Teg. Wren.'],
      action: 'beacon-fight',
    },
    leave: {
      speaker: 'corwin',
      lines: ["Mind the step on the way out. And if anyone asks, there's nothing up here but rooks."],
    },
  };
  return { start: t.first ? 'halt' : 'again', nodes };
}

/** Corwin once the band keep the tower for the Headman. */
const CORWIN_KEEPER: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'corwin',
      lines: ['Warden of the beacon on Corbie Tor, at your service. Again. What can I do for you?'],
      choices: [
        { text: 'How is the watch?', next: 'watch' },
        { text: 'Anything on the fells?', next: 'fells' },
        { text: 'Tell me about the beacons.', next: 'chain' },
        { text: 'Just passing. Good day.', next: 'bye' },
      ],
    },
    watch: {
      speaker: 'corwin',
      lines: [
        "Garth's up top by day, Wren by night: she sees better in the dark than an owl. Teg keeps the fuel dry and the hoist greased.",
        "We've a fire laid in the brazier and the pitch to hand. If it goes up, it'll be because something is coming down.",
      ],
      next: 'greet',
    },
    fells: {
      speaker: 'corwin',
      lines: [
        'Smoke, some mornings, a long way up. Their fires, under the hill, coming out of cracks in the rock. Nothing moving on the moor, yet.',
        "When it does, you'll know. Everyone between here and the river will know.",
      ],
      next: 'greet',
    },
    chain: {
      speaker: 'corwin',
      lines: [
        "Five of them, from the fells to Adowvale. This is the second. The first is up on the moor itself, and I'd not go near it now.",
        'Light this, and the Stonebrook light sees it, and the next, and the last is on the hill above the village. The whole valley has an hour to bar its doors. That was the idea, anyway.',
      ],
      next: 'greet',
    },
    bye: { speaker: 'corwin', lines: ['Mind the step.'] },
  },
};

/** Big Garth: says little, and that slowly. */
export function garthScript(keepers: boolean): DialogueScript {
  return {
    start: 'garth',
    nodes: {
      garth: {
        speaker: 'garth',
        lines: keepers
          ? ['Warden says I am a watchman now. I have never been a watchman.', 'It is mostly standing up. I am good at standing up.']
          : ['Corwin does the talking.', 'I do the other thing.'],
      },
    },
  };
}

/** Teg: quick, masked, and fond of the loot. */
export function tegScript(keepers: boolean): DialogueScript {
  return {
    start: 'teg',
    nodes: {
      teg: {
        speaker: 'teg',
        lines: keepers
          ? ["Kettle's on. Don't tell the Headman about the crates. We're giving them back. Mostly."]
          : ["Don't touch the crates.", "Don't look at the crates either. Talk to Corwin."],
      },
    },
  };
}

/** Wren: the archer, who doesn't miss. */
export function wrenScript(keepers: boolean): DialogueScript {
  return {
    start: 'wren',
    nodes: {
      wren: {
        speaker: 'wren',
        lines: keepers
          ? ['From the top you can see the Stonebrook tor on a clear day. There should be a light there. There will be again.']
          : ["I'd not, if I were you.", "Whatever it is you're thinking. Talk to Corwin."],
      },
    },
  };
}

/** How the Headman's errand stands, as he sees it. */
export type BeaconStage = 'offer' | 'active' | 'report' | 'done';

/** The Headman's side of it: the topics he offers (see dialogue/residence.ts headmanTopics). */
export function beaconTopics(stage: BeaconStage | undefined, outcome: BeaconOutcome | undefined): Array<{ choice: DialogueChoice; nodes: Record<string, DialogueNode> }> {
  if (stage === 'offer') {
    return [
      {
        choice: { text: 'Is there anything I can do for the village?', next: 'beacon-offer', key: true },
        nodes: {
          'beacon-offer': {
            speaker: 'headman',
            lines: [
              'Sit a moment. I heard you brought her home, and buried her beside the cottage. I am sorry, lad. More sorry than I know how to say.',
              "I won't keep you long. But there is a thing I've been turning over since the night at the gate, and you are the one I'd trust with it.",
            ],
            next: 'beacon-what',
          },
          'beacon-what': {
            speaker: 'headman',
            lines: [
              "Up the north road, past the old willow and away east, there's a tor with a tower on it. Corbie Tor, and the old beacon. There were five of them once, strung from the fells down to here, so that a light on the first could bring the whole valley to its doors inside an hour.",
              'Lord Morten stood the watch down twelve years ago. No need, he wrote, the north being quiet. I signed the order myself. I have regretted few things more.',
              "Given what came down off the Greyfells, I want it opened up again. Go up and see what state it's in: the door, the stair, the brazier on top. If it can be kept, I'll find someone to keep it.",
            ],
            next: 'beacon-warn',
          },
          'beacon-warn': {
            speaker: 'headman',
            lines: [
              "One thing. Do not light it. A lit beacon means goblins, and every farm from here to Harrowford will bar its door and send its sons to the square with pitchforks. Look, and come back, and tell me.",
              "And go carefully. The carters say there's been smoke from the top of it, some nights. Shepherds, most likely. Most likely.",
            ],
            choices: [
              { text: "I'll go up and look.", next: 'beacon-thanks', action: 'beacon-accept', key: true },
              { text: 'Not now.', next: 'ask' },
            ],
          },
          'beacon-thanks': {
            speaker: 'headman',
            lines: [`Good. There'll be ${BEACON_REWARD} coins from the village chest when you come back, and my thanks, which are worth rather less.`],
            next: 'ask',
          },
        },
      },
    ];
  }
  if (stage === 'active') {
    return [
      {
        choice: { text: 'About the beacon.', next: 'beacon-about' },
        nodes: {
          'beacon-about': {
            speaker: 'headman',
            lines: ["Corbie Tor: up the north road onto the upland, and away east along the sheep path. There's a cairn where it leaves the road. You'll see the tower a long way off.", "And don't light it."],
            next: 'ask',
          },
        },
      },
    ];
  }
  if (stage === 'report') {
    const told: Record<BeaconOutcome, string[]> = {
      fought: [
        'Brigands? In the beacon? Four of them, and you... gods, lad. Sit down before you fall down.',
        'Corwin Haske. I knew him. He kept that tower twenty years, and when we stood the watch down he came to this house and asked me for a wage to keep it on his own. I told him there was no money. There was not.',
        "...Well. It is done, and I'll not pretend I'm sorry it was them and not you. I'll send Brannock up with two men to hold the tower.",
      ],
      paid: [
        "You paid them to go. Out of your own purse. To clear the village's beacon of the village's thieves.",
        "I should be angry about it, and I find I'm not. Nobody bled for it. I'll send Brannock up with two men to hold the tower.",
        'Corwin Haske. He kept that tower twenty years. I hope he finds somewhere warm.',
      ],
      hired: [
        'You promised them what? A warden\'s wage, and my pardon, for a band of road thieves?',
        '...Corwin Haske. He kept that tower twenty years, for half a wage and then for none. When we stood the watch down he came to this house and asked me for the money to keep it on his own, and I told him there wasn\'t any.',
        "Very well. He'll have his pardon, and I'll pay the wage out of the chest till Lord Morten can be shamed into paying it himself. If Corwin keeps it as he kept it once, it's cheap at the price. And he'll not light it for nothing. He never did.",
      ],
    };
    return [
      {
        choice: { text: "I've been up the beacon.", next: 'beacon-report', key: true },
        nodes: {
          'beacon-report': {
            speaker: 'headman',
            lines: [
              'You have? Tell me.',
              ...told[outcome ?? 'fought'],
            ],
            next: 'beacon-pay',
          },
          'beacon-pay': {
            speaker: 'headman',
            lines: [
              `And the brazier is sound, and not lit. Good. Here: ${BEACON_REWARD} coins, as I said. The village owes you, and I don't forget what the village owes.`,
            ],
            action: 'beacon-reward',
            next: 'ask',
          },
        },
      },
    ];
  }
  if (stage === 'done') {
    return [
      {
        choice: { text: 'About the beacon.', next: 'beacon-after' },
        nodes: {
          'beacon-after': {
            speaker: 'headman',
            lines:
              outcome === 'hired'
                ? ["Corwin sends word down with the carters every week. 'Nothing on the fells. Wage late.' The second part is always true."]
                : ["Brannock's two hate it up there. Too windy, they say, and the rooks. Good. Men who hate a post stay awake on it."],
            next: 'ask',
          },
        },
      },
    ];
  }
  return [];
}
