import { HERO_NAME } from '../config';
import { itemDef, ItemId } from '../systems/Inventory';
import { BAR_DRINKS, MENU, RENT_OPTIONS, TABLE_DRINKS, TABLE_FOOD } from '../systems/Tavern';
import type { DialogueChoice, DialogueScript, SpeakerId } from './Dialogue';

/**
 * The Crooked Tankard, Adowvale's inn: Godric the landlord behind his bar,
 * his maids Nell and Rosie, and the regulars, some there all day and more of
 * an evening. Godric pours drinks (the `drink:<item>` action), lets rooms by
 * the night (`rent:<nights>`), sells food and drink to take away, and has a
 * job going: rats in his cellar. The maids take orders at the tables
 * (`order:<item>`), and the regulars have their own talk, and their own
 * chatter among themselves (TAVERN_CHATTER).
 */

/** How Godric's job of clearing the rats from his cellar stands (see the 'cellar-rats' quest). */
export type RatStage = 'none' | 'active' | 'cleared' | 'done';

/** Coins Godric pays for a cellar clear of rats. */
export const RAT_REWARD = 25;
/** Coins a game of dice with Ada is played for. */
export const DICE_STAKE = 2;
/** Coins Pell asks for a song, and Harlan for a drink. */
export const SONG_PRICE = 1;
export const HARLAN_DRINK = 2;

const price = (id: ItemId) => MENU[id]!.price;
const coinText = (n: number) => `${n} coin${n === 1 ? '' : 's'}`;

export interface LandlordState {
  first: boolean;
  coins: number;
  /** The room the hero has (or will be given), and whether it's theirs already. */
  room: number;
  renting: boolean;
  nightsLeft: number;
  rats: RatStage;
  /** Past midnight, before dawn. */
  late: boolean;
  /** The next drink is on the house (for clearing the rats). */
  freeDrink: boolean;
  /** Something he's heard, for "Heard any news?". */
  news: string[];
  /** The hero is after Mother's tincture, so may ask about his grandmother's brewing bench in the cellar. */
  medicine: boolean;
  /** He's already said they may use it. */
  toldBench: boolean;
}

export function landlordScript(s: LandlordState): DialogueScript {
  const drinkChoices: DialogueChoice[] = BAR_DRINKS.map((id) => {
    const cost = s.freeDrink ? 0 : price(id);
    return {
      text: `${itemDef(id).name} (${cost === 0 ? 'on the house' : coinText(cost)})`,
      action: s.coins >= cost ? `drink:${id}` : undefined,
      next: s.coins >= cost ? undefined : 'short',
    };
  });
  const rentChoices = (next: string): DialogueChoice[] =>
    RENT_OPTIONS.map((o) => ({
      text: `${o.label}: ${coinText(o.price)}`,
      action: s.coins >= o.price ? `rent:${o.nights}` : undefined,
      next: s.coins >= o.price ? next : 'short-room',
    }));
  const work: DialogueChoice = {
    none: { text: 'Any work going?', next: 'rats-offer' },
    active: { text: 'About those rats...', next: 'rats-progress' },
    cleared: { text: 'Your cellar is clear of rats.', next: 'rats-done' },
    done: { text: 'Any more work going?', next: 'no-work' },
  }[s.rats];

  return {
    start: s.first ? 'greet' : s.late ? 'late' : 'again',
    nodes: {
      greet: {
        speaker: 'landlord',
        lines: [
          "Come in, come in, shut the door, you're letting the warm out! Welcome to the Crooked Tankard.",
          "Godric. I own the place, I pour the ale, and I throw out anyone who sings worse than Pell. Which takes some doing.",
          "The ale's cold, the fire's hot and the beds are clean. Mostly. What'll it be?",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'landlord',
        lines: [`${HERO_NAME}! Back again. What'll it be?`],
        next: 'ask',
      },
      late: {
        speaker: 'landlord',
        lines: [
          "Still up? Don't mind me. I never sleep. Somebody has to watch the ale, or Harlan drinks it.",
        ],
        next: 'ask',
      },
      ask: {
        speaker: 'landlord',
        lines: ['Well?'],
        choices: [
          { text: "I'll have a drink.", next: 'drinks' },
          { text: 'What have you got to take away?', action: 'shop:tavern' },
          s.renting ? { text: 'About my room...', next: 'room-have' } : { text: 'Do you have a room?', next: 'rooms' },
          work,
          ...(s.medicine ? [{ text: s.toldBench ? 'About your grandmother\'s brewing bench...' : 'Do you know anyone who could brew a tincture?', next: s.toldBench ? 'bench-again' : 'bench' }] : []),
          { text: 'Heard any news?', next: 'news' },
          { text: 'Goodbye, Godric.', next: 'bye' },
        ],
      },
      drinks: {
        speaker: 'landlord',
        lines: [
          s.freeDrink
            ? "On the house, after what you did in my cellar. Name it."
            : `Ale's ${coinText(price('ale'))}, cider the same. Mead's ${price('mead')}, and the spiced wine's ${price('spiced-wine')}, since I have to stand over the pot.`,
        ],
        choices: [...drinkChoices, { text: 'Changed my mind.', next: 'ask' }],
      },
      short: {
        speaker: 'landlord',
        lines: ["That's not enough coin, friend. I don't give tick. Not since Harlan."],
        next: 'ask',
      },
      rooms: {
        speaker: 'landlord',
        lines: [
          `Rooms are up the stairs. ${coinText(RENT_OPTIONS[0].price)} a night, ${RENT_OPTIONS[1].price} for three, ${RENT_OPTIONS[2].price} for the week.`,
          'Clean straw, a lock on the door, a jug of water, and a pot under the bed. You sleep as long as you like, but you are out by eleven on the last morning.',
        ],
        choices: [...rentChoices('rented'), { text: 'Not just now.', next: 'ask' }],
      },
      rented: {
        speaker: 'landlord',
        lines: [
          `Here's your key: room ${s.room}, up the stairs. The doors are numbered, more or less.`,
          "If the bed's damp, blame Rosie. If it's got fleas, blame Harlan. He was in it last.",
        ],
        next: 'ask',
      },
      'short-room': {
        speaker: 'landlord',
        lines: ["You're a bit short for that, friend. A night's cheaper. Or there's always the stable."],
        next: 'ask',
      },
      'room-have': {
        speaker: 'landlord',
        lines: [
          `Room ${s.room}, top of the stairs. It's yours ${s.nightsLeft === 1 ? 'for tonight' : `for ${s.nightsLeft} more nights`}, then out by eleven.`,
          'Want it longer?',
        ],
        choices: [...rentChoices('extended'), { text: "No, that's all.", next: 'ask' }],
      },
      extended: {
        speaker: 'landlord',
        lines: ["Done. Same room, same fleas. I'll tell Rosie not to touch your things."],
        next: 'ask',
      },
      'rats-offer': {
        speaker: 'landlord',
        lines: [
          'Work? Funny you should ask. Rats. In my cellar. Big as cats and twice as bold.',
          "They've been at the grain, they've chewed through a keg of my best, and Nell won't go down there. Can't say I blame her.",
          `Clear them out and there's ${coinText(RAT_REWARD)} in it for you. What do you say?`,
        ],
        choices: [
          { text: "I'll do it.", action: 'start-rats-quest', next: 'rats-yes' },
          { text: 'Not my kind of work.', next: 'rats-no' },
        ],
      },
      'rats-yes': {
        speaker: 'landlord',
        lines: [
          "Good. The trapdoor's by the end of the bar. Mind the steps, and mind your ankles: they bite.",
          'Kill the lot and come and tell me. Bring me a tail or two if you like, though I would rather you didn\'t.',
          "And don't touch Gran's old brewing bench at the back. Well, touch it if you must. Just don't break anything.",
        ],
        next: 'ask',
      },
      'rats-no': {
        speaker: 'landlord',
        lines: ["Suit yourself. The offer stands, if you change your mind. And the rats aren't going anywhere."],
        next: 'ask',
      },
      'rats-progress': {
        speaker: 'landlord',
        lines: ['I can still hear them squeaking down there. The trapdoor is by the end of the bar. Kill the lot of them.'],
        next: 'ask',
      },
      'rats-done': {
        speaker: 'landlord',
        lines: [
          'All of them? You\'re sure? ...Well, it has gone quiet down there. I thought the cellar was just sulking.',
          `Here: ${coinText(RAT_REWARD)}, as promised. And your next drink is on the house.`,
        ],
        action: 'finish-rats-quest',
        next: 'ask',
      },
      bench: {
        speaker: 'landlord',
        lines: [
          "A tincture? Now there's a word I haven't heard since Gran. Old Maud, God rest her. She brewed cordials and cures for half the shire, down in that cellar.",
          "Her bench is still down there, copper still and all. Nobody's touched it in years. I keep meaning to sell the copper, but I haven't the heart.",
          "You're welcome to use it. Grind it, steep it, strain it, that's what she always said. Mind the rats, mind. They've no respect for the dead.",
        ],
        action: 'godric-brewing',
        next: 'ask',
      },
      'bench-again': {
        speaker: 'landlord',
        lines: ["Gran's bench is at the back of the cellar, against the far wall. Trapdoor's by the end of the bar. Use what you like, and don't break the flasks."],
        next: 'ask',
      },
      'no-work': {
        speaker: 'landlord',
        lines: ["Not unless you can mend a roof or teach Pell a new song. No? Then have a drink instead."],
        next: 'ask',
      },
      news: {
        speaker: 'landlord',
        lines: [s.news[Math.floor(Math.random() * s.news.length)]],
        next: 'ask',
      },
      bye: {
        speaker: 'landlord',
        lines: ['Mind the step on your way out. Everyone trips on it. I think it\'s the step\'s fault.'],
      },
    },
  };
}

/** Things Godric has heard, depending on how far the hero has got. */
export function landlordNews(flags: { paidToll: boolean; slewWolfMother: boolean; foundCaveDoor: boolean; monasteryOpen: boolean }): string[] {
  const news = [
    "The bridge at Harrowford's still down. Half my barley comes that way. You'll be paying more for your ale by midsummer, mark me.",
    "Fenwick, the wool man there, says Master Coombe has lost two ewes off the old road. Wolves, he reckons. Coombe reckons it's the drover's fault. Coombe would.",
  ];
  news.push(
    flags.paidToll
      ? "You paid Morten's toll? Ha! A hundred coins to walk down a road. My grandad walked it for nothing, and so did his donkey."
      : "Lord Morten's men want a hundred coins to open the north gate now. A tithe, they call it. I call it something I can't say in front of Rosie.",
  );
  news.push(
    flags.slewWolfMother
      ? "They say someone killed the great white wolf out on the plains. The brothers of Saint Elda's rang their bell for an hour. Was that you? Drink up, then!"
      : "There's talk of a great white wolf on the plains, leading the packs. The monks at Saint Elda's won't open their gate for love nor money.",
  );
  if (flags.foundCaveDoor) {
    news.push("A door in the wolves' cave, under the hill? Old Harlan has been on about that for years. I thought it was the ale talking. Ask him.");
  }
  if (flags.monasteryOpen) news.push("Brother Hob from Saint Elda's came in for leeks last week. Leeks! In a tavern! I sent him to Hilde.");
  return news;
}

/** A tavern maid. At a table, she takes an order; anywhere else, she has a word and tells you to sit down. */
export function maidScript(who: 'nell' | 'rosie', seated: boolean, coins: number): DialogueScript {
  // The menu is asked for in two short lists (drink, then food) rather than one long one.
  const orderChoices = (items: ItemId[]): DialogueChoice[] => [
    ...items.map((id) => ({
      text: `${itemDef(id).name}, ${coinText(price(id))}`,
      action: coins >= price(id) ? `order:${id}` : undefined,
      next: coins >= price(id) ? 'coming' : 'short',
    })),
    { text: 'Something else.', next: 'order' },
  ];
  const nell = who === 'nell';
  return {
    start: seated ? 'order' : 'chat',
    nodes: {
      order: {
        speaker: who,
        lines: [nell ? "What can I get you, love? Stew's good tonight. Well, it's hot." : 'Hello again! What are you having?'],
        choices: [
          { text: 'Something to drink.', next: 'drink' },
          { text: 'Something to eat.', next: 'food' },
          { text: 'Nothing just now, thanks.', next: 'later' },
        ],
      },
      drink: {
        speaker: who,
        lines: [nell ? "Ale, cider or mead. Godric keeps the wine for himself, mostly." : 'We have ale, cider and mead tonight!'],
        choices: orderChoices(TABLE_DRINKS),
      },
      food: {
        speaker: who,
        lines: [nell ? "There's stew in the pot, bread and cheese if you'd rather." : 'Stew, bread or cheese. The stew is my favourite!'],
        choices: orderChoices(TABLE_FOOD),
      },
      coming: {
        speaker: who,
        lines: [nell ? 'Coming right up.' : "Won't be a moment!"],
      },
      short: {
        speaker: who,
        lines: [nell ? "You're a coin or two short there, love. Something cheaper?" : "Oh! You haven't quite got enough for that. Something else?"],
        next: 'order',
      },
      later: {
        speaker: who,
        lines: [nell ? "Wave if you want anything. I'll be round again." : "I'll come back by in a bit, then!"],
      },
      chat: {
        speaker: who,
        lines: nell
          ? ["Find yourself a seat and I'll come and take your order, love. I can't carry a tray and chase you round the room."]
          : ["Sit yourself down anywhere and I'll be over. Not that stool, it wobbles. Or that one. Actually, try the bench."],
        choices: [
          { text: 'How is business?', next: 'gossip' },
          { text: 'Thanks.' },
        ],
      },
      gossip: {
        speaker: who,
        lines: nell
          ? [
              "Busy of an evening, quiet in the day. Harlan's here either way. I think he was here before the building was.",
              "Mind Ada if she asks you to play dice. She's never lost, not once, not in all the years I've worked here.",
            ]
          : [
              'Oh, lovely! Pell sang a song about me last week. Well, he said it was about me. It rhymed "Rosie" with "nosy".',
              "Don't tell Godric, but I won't go down the cellar either. Something down there squeaks at me.",
            ],
      },
    },
  };
}

/** What the maids say to themselves (or the room) while they tidy between orders. */
export const MAID_CHORES: Record<'nell' | 'rosie', string[]> = {
  nell: ['Who spilled this? Every night.', 'Elbows off, Harlan, I need to wipe there.', 'There. Clean enough to eat off. Not that anyone does.', 'Mind your feet, I\'m sweeping.'],
  rosie: ['La la la... where was I?', 'Ooh, a button! Is this anyone\'s?', 'Stack the cups, stack the cups...', 'Sticky. Why is it always sticky?'],
};

/** Old Harlan at the end of the bar, who knows a thing or two about the hill north of the lake, if someone buys him a drink. */
export function harlanScript(first: boolean, coins: number, toldSecret: boolean, sawDoor: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'harlan',
        lines: [
          "Eh? Who's that? Sit down, sit down, you're blocking my fire. Harlan. Been coming here since Godric's father had the place. And his father.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'harlan',
        lines: ["You again. Good. Nobody else listens to me."],
        next: 'ask',
      },
      ask: {
        speaker: 'harlan',
        lines: ["Well? Out with it."],
        choices: [
          { text: 'Tell me about the old days.', next: 'old' },
          toldSecret
            ? { text: 'Tell me about the door in the hill again.', next: 'secret' }
            : { text: `Can I buy you a drink? (${coinText(HARLAN_DRINK)})`, action: coins >= HARLAN_DRINK ? 'buy-harlan' : undefined, next: coins >= HARLAN_DRINK ? 'thanks' : 'skint' },
          { text: 'Goodbye, Harlan.', next: 'bye' },
        ],
      },
      old: {
        speaker: 'harlan',
        lines: [
          'The old days! There were no tolls in the old days. No Lord Morten neither, just his grandad, who was a decent sort and drank like a fish.',
          "There were bears in the forest, and I wrestled one. Twice. The second time it won. Don't ask about the first time.",
        ],
        next: 'ask',
      },
      skint: {
        speaker: 'harlan',
        lines: ["With what? Your pockets are as empty as mine. Come back when you're rich."],
        next: 'ask',
      },
      thanks: {
        speaker: 'harlan',
        lines: [
          "Now that's manners. Godric! An ale for my friend's friend. That's me.",
          sawDoor ? 'So. You found the door in the hill, I hear. I can see it in your face.' : "Here's something for your trouble, then. Lean in.",
        ],
        next: 'secret',
      },
      secret: {
        speaker: 'harlan',
        lines: [
          "North of the lake, in the hill where the wolves den, there's a door. Oak and iron. My grandad saw it built, when he was a boy.",
          "Old Lord Morten had it put there. The grandad, not this one. Something came up out of the deep places under the hill, and his men drove it back down and shut it in.",
          "And the key? He kept it. Buried with him, some say. Others say it's still up at the manor. Either way, you won't get it by asking nicely.",
        ],
        action: 'harlan-secret',
        next: 'ask',
      },
      bye: {
        speaker: 'harlan',
        lines: ["Off you go. I'll be here. I'm always here."],
      },
    },
  };
}

/** Master Fenwick, a wool merchant on his rounds: cautious, tidy, and very interested in sheep. */
export const FENWICK: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'fenwick',
      lines: [
        'Fenwick. I buy wool. All of it, if the price is right, and in Adowvale it seldom is.',
        "I'd be at Harrowford by now if the bridge weren't in the river. So here I sit, drinking Godric's ale and losing money.",
      ],
      next: 'ask',
    },
    again: {
      speaker: 'fenwick',
      lines: ['Ah, the young fellow from the Hollow. Sit, if you like. Mind my ledger.'],
      next: 'ask',
    },
    ask: {
      speaker: 'fenwick',
      lines: ['Something on your mind?'],
      choices: [
        { text: 'How is the wool trade?', next: 'wool' },
        { text: 'Do you know Master Coombe?', next: 'coombe' },
        { text: 'Goodbye.', next: 'bye' },
      ],
    },
    wool: {
      speaker: 'fenwick',
      lines: [
        "Dreadful. Wolves take the sheep, the toll takes the profit, and the bridge takes the carts. What's left, the moths take.",
        'If you ever come by a white wolf pelt, mind, there are lords in the south who would pay a great deal for one. I only mention it.',
      ],
      next: 'ask',
    },
    coombe: {
      speaker: 'fenwick',
      lines: [
        "Coombe? The meanest man on the old road. He's lost two ewes and he's blaming his drover, poor lad. Wil, is it?",
        "The boy's terrified of him. I would be too. Coombe once charged me for the mud on my boots.",
      ],
      next: 'ask',
    },
    bye: {
      speaker: 'fenwick',
      lines: ['Good evening to you.'],
    },
  },
};

/** Sigrun, a sellsword: few words, a long memory, and an eye on the door. */
export function sigrunScript(slewWolfMother: boolean): DialogueScript {
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'sigrun',
        lines: slewWolfMother
          ? ["You. You're the one who killed the white wolf on the plains. Hm. You don't look like much.", "Neither do I. Sit, if you want. Don't talk too much."]
          : ['What.'],
        next: 'ask',
      },
      ask: {
        speaker: 'sigrun',
        lines: ['Well?'],
        choices: [
          { text: 'What brings you to Adowvale?', next: 'why' },
          { text: 'Any advice for a fight?', next: 'advice' },
          { text: 'Sorry to bother you.', next: 'bye' },
        ],
      },
      why: {
        speaker: 'sigrun',
        lines: slewWolfMother
          ? ["I came for the white wolf. Lord Morten wouldn't pay, so I stayed for the ale. Then you went and killed her for nothing. Thanks for that."]
          : [
              "There's a great white wolf on the plains. I came to kill it. Then I asked who'd pay me for it.",
              "Lord Morten won't. The monks can't. So I'm drinking instead. She can wait.",
            ],
        next: 'ask',
      },
      advice: {
        speaker: 'sigrun',
        lines: [
          'Eat before a fight, not during. Wear something on your head. And if you are losing, leave. Dead heroes get songs. Live ones get supper.',
          "Pell sings the songs. You've heard him. Stay alive.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'sigrun',
        lines: ['Mm.'],
      },
    },
  };
}

/** Ada, who will play anyone at dice, and Cobb, who always loses to her. */
export function adaScript(coins: number): DialogueScript {
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'ada',
        lines: [
          `Well now, fresh blood! Fancy a throw of the dice, dearie? Highest roll takes the pot. ${coinText(DICE_STAKE)} a game.`,
        ],
        choices: [
          { text: "I'll play.", action: coins >= DICE_STAKE ? 'dice-game' : undefined, next: coins >= DICE_STAKE ? undefined : 'skint' },
          { text: 'Does anyone ever beat you?', next: 'beat' },
          { text: 'Not today.', next: 'bye' },
        ],
      },
      skint: {
        speaker: 'ada',
        lines: ["With empty pockets? I don't play for buttons, dearie. Come back with coin."],
      },
      beat: {
        speaker: 'ada',
        lines: [
          "Beat me? Cobb nearly did, once, in the year of the big frost. Then I won his pig off him.",
          'I named her Lucky. She is, too. Lives better than Cobb does.',
        ],
        next: 'greet',
      },
      bye: {
        speaker: 'ada',
        lines: ["Your loss. Well, no. My loss, really, since I'd have won."],
      },
    },
  };
}

export const COBB: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'cobb',
      lines: [
        "Don't play her. Whatever you do, don't play her. I've lost three harvests and a pig to that woman.",
        "I keep thinking my luck's got to turn. It's got to, hasn't it? Hasn't it?",
      ],
      choices: [
        { text: "It's bound to turn.", next: 'hope' },
        { text: 'Maybe stop playing?', next: 'stop' },
      ],
    },
    hope: {
      speaker: 'cobb',
      lines: ["That's what I keep saying! Ada! One more game!"],
    },
    stop: {
      speaker: 'cobb',
      lines: ["Stop? And let her keep my pig? Never. A man's got his pride. And a pig, normally."],
    },
  },
};

/** The lines of Pell's song, sung one bubble at a time for a coin. */
export const PELL_SONG = [
  '♪ Oh, there\'s a tankard in Adowvale, crooked and old... ♪',
  '♪ It was dropped by a duke and was kicked by a mule... ♪',
  '♪ But it pours a fine ale for the wise and the fool! ♪',
  '♪ So drink, lads, drink, while the fire burns bright! ♪',
  '♪ For the Tankard is crooked, but the ale is right! ♪',
];

export function pellScript(coins: number): DialogueScript {
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'pell',
        lines: [
          'Pell! Minstrel, poet, teller of tales, and the finest lute in three shires. It used to be my father\'s. It used to be in tune.',
          `A song, friend? ${coinText(SONG_PRICE)}, and I'll sing you the Ballad of the Crooked Tankard. All five verses.`,
        ],
        choices: [
          { text: `Sing me a song. (${coinText(SONG_PRICE)})`, action: coins >= SONG_PRICE ? 'pell-song' : undefined, next: coins >= SONG_PRICE ? 'sing' : 'skint' },
          { text: 'Do you know any songs about wolves?', next: 'wolves' },
          { text: 'Maybe later.', next: 'bye' },
        ],
      },
      sing: {
        speaker: 'pell',
        lines: ['Splendid! Ahem. Ahem. (He tunes a string, then gives up and tunes another.)'],
      },
      skint: {
        speaker: 'pell',
        lines: ["Ah. An admirer of the arts with no money. My favourite kind, and my poorest."],
      },
      wolves: {
        speaker: 'pell',
        lines: [
          "About the white wolf of the plains? I'm writing one! I need an ending. Somebody brave, a terrible fight, that sort of thing.",
          'If you know anyone heroic, send them my way. I rhyme very reasonably.',
        ],
        next: 'greet',
      },
      bye: {
        speaker: 'pell',
        lines: ["I'll be here, enriching the evening!"],
      },
    },
  };
}

/** Bits of talk overheard between the regulars, as speech bubbles. Each needs everyone in it to be about. */
export const TAVERN_CHATTER: Array<Array<[SpeakerId, string]>> = [
  [['harlan', 'Another, Godric.'], ['landlord', "You've had six, Harlan."], ['harlan', "Then this'll be my lucky seventh."]],
  [['ada', 'Double sixes! Pay up, Cobb.'], ['cobb', "You've weighted them. You must have."], ['ada', 'Sore losers buy the next round.']],
  [['cobb', "One more game. My luck's turning, I can feel it."], ['ada', "That's the cider you can feel."]],
  [['fenwick', "Wool's down a penny again."], ['landlord', "Ale isn't."]],
  [['harlan', 'Did I ever tell you about the bear I wrestled?'], ['sigrun', 'Three times. Tonight.']],
  [['rosie', 'The table by the fire wants more stew.'], ['nell', 'The table by the fire always wants more stew.']],
  [['pell', "Godric! A drink for the musician!"], ['landlord', 'When the musician plays something new.']],
  [['fenwick', "Is there a room with a lock that works?"], ['landlord', "They all work. It's the doors that don't."]],
  [['rosie', "Sigrun, you've barely touched your ale."], ['sigrun', "I'm watching the door."], ['rosie', "...Why? What's coming through it?"]],
  [['harlan', 'In my day, ale cost a farthing.'], ['nell', 'In your day, Harlan, you paid for it.']],
  [['cobb', 'Godric, there is a hair in my ale.'], ['landlord', "That's the hops. Very fine hops, those."]],
  [['ada', 'Pell! Play something we can dance to.'], ['pell', 'Madam, I only play things you can weep to.']],
];

/** Things said out loud now and then by whoever's about, to nobody in particular. */
export const TAVERN_MUTTERS: Partial<Record<SpeakerId, string[]>> = {
  harlan: ['Hrmph.', "Wasn't like this in my day.", '*hic*', 'Where did I put my hat? Oh. On my head.'],
  landlord: ["Last orders! ...No, I'm joking. Drink up.", 'Who left the cellar door open? Rats, I tell you. Rats!', 'Mind that tankard, it was my mother\'s.'],
  nell: ["Two ales and a stew, coming through!", 'Mind your backs!'],
  rosie: ['Ooh, is that a new song, Pell?', 'Who ordered the cheese?'],
  pell: ['♪ Hey nonny... nonny... hm, what rhymes with nonny? ♪', '♪ Oh the ale is brown and the night is long... ♪'],
  ada: ['Who wants a game? Anyone? Two coins a throw!', 'Come on, Cobb, the night is young!'],
  cobb: ['My pig...', "I'll win it back. You see if I don't."],
  fenwick: ['Twelve fleeces, at a penny short of... no. No, that is not right at all.'],
  sigrun: ['...'],
};

/** What the crowd raises a cup to, of an evening. */
export const TAVERN_TOASTS = ['Cheers!', "To Lord Morten's purse: may it be lighter tomorrow!", 'To Godric!', 'Your health!', 'Down in one!'];
