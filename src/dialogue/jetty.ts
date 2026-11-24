import { HERO_NAME } from '../config';
import type { Voyage } from '../systems/Voyages';
import type { DialogueChoice, DialogueScript } from './Dialogue';

/**
 * The folk of Adowvale Jetty (world/JettyMap.ts): Maren Tull, skipper of the
 * Grey Heron, who will one day carry the hero up and down the Wend (see
 * systems/Voyages.ts); Old Ebb, who has fished the river for sixty years and
 * mends his nets outside his hut; and Wren, his granddaughter, who keeps the
 * smokehouse counter and knows everybody's business.
 */

/** How the story stands, as far as the jetty has heard. */
export interface JettyNews {
  /** The goblins have burnt the farm in the Hollow and carried Mother off, and this one hasn't said their piece about it yet. */
  raided: boolean;
  /** Mother is dead (the hero found her in the brood hall). */
  bereaved: boolean;
}

// ---------------------------------------------------------------------------
// Maren
// ---------------------------------------------------------------------------

/**
 * Maren Tull on the pier beside her boat.
 * @param first whether this is the first time they've spoken
 * @param voyages the passages open now (none yet), each offered at its fare
 * @param coins what the hero has, to see which fares they can pay
 */
export function marenScript(first: boolean, news: JettyNews, voyages: Voyage[], coins: number): DialogueScript {
  const passages: DialogueChoice[] = voyages.map((v) =>
    coins >= v.fare
      ? { text: `${v.name}, then. (${v.fare} coins, ${v.hours} hours)`, next: 'cast-off', action: `voyage:${v.to}` }
      : { text: `${v.name}? (${v.fare} coins: I haven't enough)`, next: 'short' },
  );
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'maren',
        lines: [
          "Mind the rope. No, the other one. There. You'll be off the farms, by the boots. Come to look at the boats?",
          `${HERO_NAME}? Maren Tull. That's my Grey Heron, and I'm her skipper, her crew and her cook, on account of nobody else will put up with any of us.`,
        ],
        next: news.raided ? 'raid' : 'ask',
      },
      again: {
        speaker: 'maren',
        lines: ['Back again. Come aboard in your head, if not your boots.'],
        next: news.raided ? 'raid' : 'ask',
      },
      raid: {
        speaker: 'maren',
        lines: news.bereaved
          ? [
              "I heard about your mother. The whole river has, by now. I'm sorry. Truly.",
              'Goblins coming down off the fells and burning farms. My grandmother told me stories like that. I never thought to hear them as news.',
            ]
          : [
              "I heard about the farm in the Hollow. Smoke you could see from the water, and your mother taken.",
              "If you need to get somewhere fast, you come to me first. When I can sail, I'll sail you. That's a promise.",
            ],
        next: 'ask',
      },
      ask: {
        speaker: 'maren',
        lines: ['What is it?'],
        choices: [
          { text: 'Tell me about the Grey Heron.', next: 'boat' },
          { text: 'Could you take me somewhere?', next: voyages.length ? 'where' : 'shut' },
          { text: 'Where does the river go?', next: 'river' },
          { text: 'What do you carry?', next: 'cargo' },
          { text: "I'll let you get on.", next: 'bye' },
        ],
      },
      boat: {
        speaker: 'maren',
        lines: [
          'Forty foot of oak and pitch, flat enough in the bottom to run up the shallows and deep enough in the keel to beat back up against the stream. She was my father\'s, and his mother\'s before him.',
          "Heron, because she stands in the shallows on one leg looking miserable, my father said. Grey, because she's grey. We're not a fanciful family.",
          "She'll carry eight, and a cart's worth of cargo, and she sails closer to the wind than anything on the Wend. Don't tell the Harrowford boats I said so. Do tell them, actually.",
        ],
        next: 'ask',
      },
      shut: {
        speaker: 'maren',
        lines: [
          "I would if I could. Nobody's going anywhere on this river just now, not on my boat.",
          "Two barges gone below Harrowford since the spring, crews and all, and nobody saying what took them. The chain's up across the river at the Harrowford bridge, and the Reeve there won't let it down till he knows.",
          "When the Wend is open, you come and find me. I'll take you down to Harrowford and beyond, quicker than any road. For a fair fare, mind. I'm fond of you, not daft.",
        ],
        next: 'ask',
      },
      where: {
        speaker: 'maren',
        lines: ["Where to? She's ready when you are."],
        choices: [...passages, { text: 'Not today.', next: 'ask' }],
      },
      short: {
        speaker: 'maren',
        lines: ["That's not enough for the passage. I don't haggle on the water: the river doesn't, so I can't."],
        next: 'where',
      },
      'cast-off': {
        speaker: 'maren',
        lines: ['Then step aboard, sit where I put you, and keep your hands out of the water. Cast off forward!'],
      },
      river: {
        speaker: 'maren',
        lines: [
          'Upstream, it comes down out of the hills past the old abbey lands, too fast and too shallow for her above the weir. Downstream is where she earns her keep.',
          'Harrowford first, a day and a bit: a bridge, a market, and a Reeve who thinks very well of himself. Then the river widens and slows, through the marshes, and on to the sea at Saltmouth.',
          "I've been to the sea twice. It's like the river, only it doesn't stop, and it's angrier. You'd like it.",
        ],
        next: 'ask',
      },
      cargo: {
        speaker: 'maren',
        lines: [
          "Down the river: Adowvale wool, hides from Tamsin's yard, smoked eel from old Ebb's smokehouse, when that girl of his doesn't eat it first. Up the river: salt, iron, wine for the Headman's table, and news.",
          "Lately, more news than wine. None of it good.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'maren',
        lines: ["Fair winds. Or fair enough."],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Old Ebb
// ---------------------------------------------------------------------------

/**
 * Old Ebb, on his stool outside his hut, mending a net.
 * @param first whether this is the first time they've spoken
 * @param hasRod whether the hero has a rod of their own
 */
export function ebbScript(first: boolean, news: JettyNews, hasRod: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'ebb',
        lines: [
          "Eh? Come round where I can see you. My eyes are good for a hook at arm's length and a heron at a mile, and nothing in between.",
          `${HERO_NAME}, is it. Ebenezer Dunn. Old Ebb, they call me, on account of I'm always out on the ebb when the eels run. Sit, if you can find somewhere that isn't net.`,
        ],
        next: news.raided ? 'raid' : 'ask',
      },
      again: {
        speaker: 'ebb',
        lines: ["You again. Pass me that float. No, the red one."],
        next: news.raided ? 'raid' : 'ask',
      },
      raid: {
        speaker: 'ebb',
        lines: news.bereaved
          ? [
              "I heard about your mother. Wren told me, and then she cried, and then she was angry, and then she went and smoked a whole barrel of eels too hard. That's how she is.",
              "I've buried a wife and two sons in sixty years by this river. It doesn't get lighter. You just get stronger in the arms for carrying it.",
            ]
          : [
              "Goblins in the Hollow. Burning, and carrying folk off. I'm sorry for it, lad, I am. Truly.",
              "There's been goblins on the fells since I was a boy, but they never came down. Something's driving them, or calling them. Mark my words.",
            ],
        next: 'ask',
      },
      ask: {
        speaker: 'ebb',
        lines: ['Well?'],
        choices: [
          { text: 'What are you mending?', next: 'net' },
          { text: hasRod ? "What's biting in the river?" : 'Is there good fishing in the river?', next: 'fish' },
          { text: 'Tell me about the jetty.', next: 'jetty' },
          { text: 'What is the little shrine by the willow?', next: 'shrine' },
          { text: 'Have you always lived here?', next: 'life' },
          { text: "I'll leave you to your nets.", next: 'bye' },
        ],
      },
      net: {
        speaker: 'ebb',
        lines: [
          'Drift net. A pike went through it last night like it was a cobweb, and took half my eels with him. Teeth on him like a sawpit.',
          "Knot, loop, pull. Knot, loop, pull. Sixty years. Wren says I do it in my sleep. I say I don't sleep, I just mend nets with my eyes shut.",
        ],
        next: 'ask',
      },
      fish: {
        speaker: 'ebb',
        lines: hasRod
          ? [
              "Off the end of the pier, or anywhere the bank'll take your weight. Not off the quay, Maren'll have your ears.",
              "Barbel on the bottom, where the current's quick: big whiskery brutes, fight like a mule. Grayling in the clear runs by day, with a fin on them like a sail. Bream and roach in the slack water by the reeds, and eels at night, always eels.",
              "And pike, in the lilies. Leave the big one alone. He's mine, and he owes me a net.",
            ]
          : [
              "Good fishing? It's the Wend. There's more fish in that river than there are folk in the world. Barbel, grayling, roach, eel. Pike. And something big under the pier I've never seen the face of.",
              "You'll want a rod. Old Tobin up at the Hollow lake sells them, and fair. Then come down here and catch something worth catching.",
            ],
        next: 'ask',
      },
      jetty: {
        speaker: 'ebb',
        lines: [
          "When I was a boy there was the pier and my father's hut and nothing else. The quay came after, when the wool money came to Adowvale. The crane's newer than Wren.",
          "There's me and Wren, and the Pellows in the white hut: Jack's out on the water mostly and Bet's always at her beans. And Maren, when she's tied up. That's the jetty. Small, but we've a river, and that's more than most.",
          'The boathouse is the Headman\'s, by rights. Nobody\'s told him it leaks.',
        ],
        next: 'ask',
      },
      shrine: {
        speaker: 'ebb',
        lines: [
          "The Lady of the Wend. Every river's got one. You leave her a coin or a bit of bread when you go out, and she brings you home.",
          "Do I believe it? I've left her something every morning for sixty years, and I'm still here. My brothers didn't, and they aren't. Draw your own conclusions.",
        ],
        next: 'ask',
      },
      life: {
        speaker: 'ebb',
        lines: [
          'Born in that hut, and I mean to die in it, though not this week. Went down to the sea once, when I was young and daft, on a salt barge. Didn\'t care for it. Too much water, and none of it fresh.',
          "Wren's my boy's girl. Her mother went with the fever, and her father went with the river. So now it's her and me, and she's the one does the looking after, mostly. Don't tell her I said so.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'ebb',
        lines: ["Mind the nets on your way. Knot, loop, pull..."],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Wren
// ---------------------------------------------------------------------------

/**
 * Wren, at the smokehouse: smoked fish to sell, and all the news.
 * @param first whether this is the first time they've spoken
 */
export function wrenScript(first: boolean, news: JettyNews): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'wren',
        lines: [
          "Hello! You're new. Well, not new, you're from the farms, but you're new here. I'm Wren. Ebb's my grandad. That's our smokehouse, and these are our eels, and those are our nets, and that's our river. Well. Everybody's river.",
          `${HERO_NAME}? That's a good name. Do you want some smoked eel? Everybody wants some smoked eel. It's the best on the Wend, Maren says so, and she's been everywhere.`,
        ],
        next: news.raided ? 'raid' : 'ask',
      },
      again: {
        speaker: 'wren',
        lines: ["It's you! Have you come for eels? Say you've come for eels."],
        next: news.raided ? 'raid' : 'ask',
      },
      raid: {
        speaker: 'wren',
        lines: news.bereaved
          ? [
              "...Grandad told me about your mam. I'm sorry. Mine's gone too, so I know a bit. Not all of it. Just a bit.",
              "You can come down here whenever you like and not talk. Grandad does that. It helps, being by the water.",
            ]
          : [
              "Is it true the goblins burnt your farm? And took your mam? That's horrible. That's the most horrible thing.",
              "If I was you I'd get a big stick and go and get her back. Grandad says I mustn't say things like that. But I would.",
            ],
        next: 'ask',
      },
      ask: {
        speaker: 'wren',
        lines: ['What do you want to know? I know everything that happens down here. Nearly everything.'],
        choices: [
          { text: "What's for sale?", action: 'shop:smokehouse' },
          { text: "What's the news on the jetty?", next: 'gossip' },
          { text: 'How do you smoke the fish?', next: 'smoke' },
          { text: 'What do you think of Maren?', next: 'maren' },
          { text: 'Goodbye, Wren.', next: 'bye' },
        ],
      },
      gossip: {
        speaker: 'wren',
        lines: [
          "Bet Pellow's beans have got the blight and she says it's the Headman's fault, but she says everything's the Headman's fault. Jack Pellow caught a barbel this big. No, this big. He says this big, I saw it, it was this big.",
          "And Maren won't sail. She sits on the pier and looks down the river all day. Grandad says it's because of the barges that went missing. I think she's just waiting for somebody brave.",
          "And there's a heron on the eyot that's been standing on one leg since Tuesday. I've been counting.",
        ],
        next: 'ask',
      },
      smoke: {
        speaker: 'wren',
        lines: [
          "You gut them, that's the table, don't look, and salt them overnight in the barrels. Then they go up on the racks in the smokehouse, over oak and alder, for a day and a night. Longer if it's eels. Eels are stubborn.",
          "You have to keep the fire low. Smoke, not flame. If it flames you've got burnt eels, and you get told off, and you have to eat them yourself, which isn't really a punishment.",
        ],
        next: 'ask',
      },
      maren: {
        speaker: 'wren',
        lines: [
          "Maren's the best person in the world. She's been to the sea. She can tie forty knots. She once hit a man from Harrowford with an oar and he fell in, and everybody cheered.",
          "When I'm big I'm going to sail with her. Grandad says over his dead body. Maren says that can probably be arranged. Then they both laugh, so I think it's a joke.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'wren',
        lines: ['Bye! Come back for eels!'],
      },
    },
  };
}
