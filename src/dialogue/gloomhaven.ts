import { HERO_NAME } from '../config';
import type { DialogueChoice, DialogueNode, DialogueScript } from './Dialogue';

/**
 * The folk of Gloomhaven (world/GloomhavenMap.ts), out of doors; the Black Rose's
 * are in their own file. At the Fen Gate, Captain Vosk and his gate men: Brakk,
 * Fitch and Old Crabbe, a rag-tag of heavies paid out of the tolls, who keep the
 * gate shut and the fen out. Round the square: Mother Ossery the apothecary,
 * Hobb Tallow the chandler, and Abel Lusk, who buys anything and asks nothing (he's in his shop now: dialogue/pawnshop.ts).
 * By the well, Gutter Jack; about the square, Wisp, whose fingers are quicker
 * than her grin; and at the end of the pier, Cray, who rows folk about the
 * river for a price, and back up it to Adowvale.
 */

// ---------------------------------------------------------------------------
// The Fen Gate
// ---------------------------------------------------------------------------

/**
 * Captain Vosk, in front of the gate. The gate stays shut: there's nothing past it
 * the story goes to yet, and he says why in his own way.
 * @param first whether this is the first time they've spoken
 */
export function voskScript(first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'vosk',
        lines: [
          "Far enough. You came in off the river, so you've paid the river. That's between you and the Lady. This is my gate, and my gate is shut.",
          "Vosk. Captain, if you're being polite, and you'd better be. The lads and I keep the Fen Gate, and the town pays us to, and on the whole the town gets what it pays for.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'vosk',
        lines: ['Still shut. Same as it was. Same as it will be.'],
        next: 'ask',
      },
      ask: {
        speaker: 'vosk',
        lines: ['Well?'],
        choices: [
          { text: 'Open the gate. I want to go through.', next: 'shut' },
          { text: "What's out there?", next: 'fen' },
          { text: 'Who pays you?', next: 'pay' },
          { text: 'What is this place?', next: 'town' },
          { text: "I'll leave you to it.", next: 'bye' },
        ],
      },
      shut: {
        speaker: 'vosk',
        lines: [
          "No. Not tonight, not tomorrow, and not for a farm hand with mud to the knee and a look in their eye like they're owed something.",
          "Out there's the causeway, and the causeway goes four miles over the fen to dry land, and half of it's sunk. The last party that went out it was six. Two came back. We don't talk about what the two said.",
          "When there's a reason to open it, it'll open. Till then, coin can't buy it, and nor can you.",
        ],
        next: 'ask',
      },
      fen: {
        speaker: 'vosk',
        lines: [
          "Reeds, water, more reeds. Lights on it at night that aren't lanterns. Things that come up to the wall in the fog and stand there, and when the fog lifts, they've gone and the mud's all prints.",
          "That's why there's a wall, and that's why there's us. The wall keeps the fen out. We keep the wall up. And the gate shut.",
        ],
        next: 'ask',
      },
      pay: {
        speaker: 'vosk',
        lines: [
          'The tolls, mostly. Every cart that comes in, every barge that ties up. And the Black Rose stands us our ale, which is the best part of the wage.',
          "There's a Reeve, somewhere. Nobody's seen him since the spring floods. So it's us, and the Rose, and the river. It works. Don't ask me how.",
        ],
        next: 'ask',
      },
      town: {
        speaker: 'vosk',
        lines: [
          "Gloomhaven. A mudbank with houses on it, sinking an inch a year. Fishers, eel men, smugglers, and folk who had a good reason to leave somewhere else.",
          'Keep your hand on your purse, keep out of the Shambles after dark, and if anyone in the Rose offers to tell your fortune, say no.',
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'vosk',
        lines: ['Mind how you go. Nobody else will.'],
      },
    },
  };
}

/** Brakk, by the brazier with his maul: big, slow and fond of his captain. */
export function brakkScript(first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'brakk',
        lines: [
          "Hnh. You're stood in my warm.",
          "...That's alright. Captain says I'm to be nicer to folk. Brakk. I hit things, when the Captain says. Mostly I don't have to. Mostly they look at me and go home.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'brakk',
        lines: ["Hnh. You again. Warm your hands, if you want. The brazier's for everyone. Everyone on this side of the gate."],
        next: 'ask',
      },
      ask: {
        speaker: 'brakk',
        lines: ['What?'],
        choices: [
          { text: "That's a big hammer.", next: 'maul' },
          { text: 'Have you ever been out past the gate?', next: 'out' },
          { text: 'What do you think of Vosk?', next: 'vosk' },
          { text: 'Never mind.', next: 'bye' },
        ],
      },
      maul: {
        speaker: 'brakk',
        lines: [
          "Was a smith's, once. Not mine. The smith's. He didn't need it after, so the Captain said I could have it.",
          "Don't ask after what. The Captain says it's not a nice story and I'm not to tell it to strangers.",
        ],
        next: 'ask',
      },
      out: {
        speaker: 'brakk',
        lines: [
          'Once. Went out with the Captain after the eel men that went missing. Found their boat. Found one of them.',
          "...I don't like the fen. I don't like the fog. I'm big, and things out there aren't scared of big. I'm happy this side.",
        ],
        next: 'ask',
      },
      vosk: {
        speaker: 'brakk',
        lines: [
          "Best man in Gloomhaven. Only man in Gloomhaven who ever gave me a fair shake. He reads, you know. Books. He reads me bits, sometimes, by the fire. There's one about a whale.",
          "You be civil to him and I'll be civil to you. That's a deal. Shake. ...Not that hard? Hnh. Sorry.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'brakk',
        lines: ['Hnh.'],
      },
    },
  };
}

/** Fitch, with his bow on the west side of the road: watchful and not one for talk. */
export function fitchScript(first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'fitch',
        lines: [
          "Don't come any closer and don't move your hands fast. ...Fine. You're nobody.",
          "Fitch. I watch the wall. I watch the road. I watch you, now.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'fitch',
        lines: ["Still watching."],
        next: 'ask',
      },
      ask: {
        speaker: 'fitch',
        lines: ['Make it quick.'],
        choices: [
          { text: 'Are you any good with that bow?', next: 'bow' },
          { text: 'What do you watch for?', next: 'watch' },
          { text: 'Bye, Fitch.', next: 'bye' },
        ],
      },
      bow: {
        speaker: 'fitch',
        lines: [
          'See the crow on the gibbet? No, you don\'t, because yesterday there were two.',
          "Yew from the abbey woods, upriver. Strung with gut. I made it, and I don't lend it, and I don't miss.",
        ],
        next: 'ask',
      },
      watch: {
        speaker: 'fitch',
        lines: [
          "Lights on the fen that move against the wind. Smugglers who think the north-west tower's empty. Folk going over the wall who should be coming in by the gate.",
          "And folk going out over the wall who shouldn't. Those, I shoot. Mostly in the leg.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'fitch',
        lines: ['Hands where I can see them on your way.'],
      },
    },
  };
}

/** Old Crabbe, leaning on the guard hut with a hatchet in each hand: has been on the gate longer than anyone. */
export function crabbeScript(first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'crabbe',
        lines: [
          "Eh? Eh. A new face. We don't get many of those, and we don't keep many of 'em either. Crabbe. Old Crabbe, they say, like there's a young one somewhere.",
          `${HERO_NAME}, is it. Up-river name, that. Clean. You'll lose that here.`,
        ],
        next: 'ask',
      },
      again: {
        speaker: 'crabbe',
        lines: ["Back for more of an old man's talk? You're the only one, then."],
        next: 'ask',
      },
      ask: {
        speaker: 'crabbe',
        lines: ['Ask, then. I\'ve nothing but time and a bad knee.'],
        choices: [
          { text: 'How long have you kept the gate?', next: 'long' },
          { text: 'Tell me about the Black Rose.', next: 'rose' },
          { text: 'Why two hatchets?', next: 'hatchets' },
          { text: "I'll let you rest.", next: 'bye' },
        ],
      },
      long: {
        speaker: 'crabbe',
        lines: [
          "Since before Vosk was a captain, and since before there was a wall, near enough. When I was a lad it was a palisade of alder, and the fen came in under it in a wet spring.",
          "Stone at the bottom now, and oak on top. Built it ourselves, every man in the town, the year of the drowning. Twenty foot. Kept most of it out.",
        ],
        next: 'ask',
      },
      rose: {
        speaker: 'crabbe',
        lines: [
          "The Rose? Only house in Gloomhaven that's kept up, and that tells you who's got the money. Best ale south of Harrowford, mind, and the worst company.",
          "If you've business there, keep it short. If you've no business there, you'll find you have by the time you leave. That's how it goes.",
        ],
        next: 'ask',
      },
      hatchets: {
        speaker: 'crabbe',
        lines: [
          "One for what's in front of me, one for what's behind. You learn that on the fen. Things come at you two at a time, out there.",
          "And if I drop one, I've still got one. Hah! My old dad's wisdom, that. Didn't save him, mind.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'crabbe',
        lines: ['Off you go. Mind the gibbet, it swings.'],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// The shops
// ---------------------------------------------------------------------------

/** Mother Ossery at her counter: remedies, poisons she won't admit to, and leeches. */
export function osseryScript(first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'ossery',
        lines: [
          "Come in, come in, out of the damp. Not that it helps. Let me look at you. Hmm. Pale. Damp in the chest. Mud on the boots. River fever by Thursday, I should think.",
          "Mother Ossery. I'm nobody's mother, dear, it's what they call you when you've been old long enough. Remedies, tinctures, oils, and leeches for them that wants them.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'ossery',
        lines: ["Still standing, then? Good. My remedies, or your constitution, and I know which I'd bet on."],
        next: 'ask',
      },
      ask: {
        speaker: 'ossery',
        lines: ['What can I do for you, dear?'],
        choices: [
          { text: 'Let me see what you have.', action: 'shop:apothecary' },
          { text: 'What are the leeches for?', next: 'leeches' },
          { text: "What's river fever?", next: 'fever' },
          { text: 'Do you sell poisons?', next: 'poison' },
          { text: 'Good day, Mother.', next: 'bye' },
        ],
      },
      leeches: {
        speaker: 'ossery',
        lines: [
          "Bad blood, dear. Bruises, swellings, a black eye after a night in the Rose. You put one on and it has its supper and you feel better, and so does it.",
          'I catch them myself, off the Staithe, with my own legs. I could show you. No? Nobody ever wants to see.',
        ],
        next: 'ask',
      },
      fever: {
        speaker: 'ossery',
        lines: [
          "Shivers and sweats and a cough like a crow. Comes up off the fen with the fog, they say. I say it comes up off the water, and that's why I boil mine.",
          "A tincture of willow and feverfew sees most folk through it. Most. Keep your feet dry, which is a joke in Gloomhaven, I know.",
        ],
        next: 'ask',
      },
      poison: {
        speaker: 'ossery',
        lines: [
          "Poisons? Me? Dear, I'm a respectable woman. Everything on these shelves will cure you, if you take the right amount of it.",
          "...And if you take the wrong amount of it, that's between you and whoever you gave it to. I sell remedies. What folk do with them is their business.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'ossery',
        lines: ['Keep your chest warm, dear, and your feet dry, and your back to the wall in the Rose.'],
      },
    },
  };
}

/** Hobb Tallow at his chandlery: candles, rope, lamp oil, and everything a fisher needs. */
export function tallowScript(first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'tallow',
        lines: [
          "A customer! Or a thief. Either way, welcome to Tallow's. Candles, lamps, rope, line, hooks, nets, boots that'll keep the river out for nearly a week.",
          "Hobb Tallow. My father was a Tallow, and he made tallow, and so do I. Rendered fat and a wick. Lights the whole of Gloomhaven, that does, such as it's lit.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'tallow',
        lines: ["Back again! Bought too little last time, did you? Everyone does."],
        next: 'ask',
      },
      ask: {
        speaker: 'tallow',
        lines: ['What are you after?'],
        choices: [
          { text: "What's for sale?", action: 'shop:chandler' },
          { text: 'Why is every window here full of candles?', next: 'candles' },
          { text: "What's the Staithe?", next: 'staithe' },
          { text: "I'll be off.", next: 'bye' },
        ],
      },
      candles: {
        speaker: 'tallow',
        lines: [
          "So the things on the fen can see we're in, and stay out. That's what my grandmother said. My father said it was so the smugglers could see which houses were awake and which they could run their barrels past.",
          "I say it's good for trade. A candle in every window, every night, and who sells the candles? Hah!",
        ],
        next: 'ask',
      },
      staithe: {
        speaker: 'tallow',
        lines: [
          "The bank, along the river. Where the boats tie up and the eel men gut their catch and the barges unload, when there are barges. There aren't many, these days.",
          "Something's been taking them, up and down the Wend. Lost two this summer. Nobody wants to sail it now but Cray, and Cray's not right in the head.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'tallow',
        lines: ['Light your way, friend. Buy a candle next time!'],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// About the square
// ---------------------------------------------------------------------------

/**
 * Gutter Jack, slumped on the bench by the well with his bottle.
 * @param ale whether the hero has an ale to give him (he'll tell what he knows for one)
 * @param told whether he's already had one, and told it
 */
export function gutterScript(first: boolean, ale: boolean, told: boolean): DialogueScript {
  const choices: DialogueChoice[] = [
    { text: 'Who are you?', next: 'who' },
    { text: 'What do you know about this town?', next: told ? 'told' : ale ? 'thirsty' : 'dry' },
    { text: "What's down the well?", next: 'well' },
    { text: 'Leave him to it.', next: 'bye' },
  ];
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'gutter',
        lines: [
          "Oi. Oi, you. You've a kind face. 'S the only one in Gloomhaven. Siddown. No, don't, there's no room. Stand, then. Stand and be kind.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'gutter',
        lines: ["Kind face! You came back. Nobody comes back. Have you brought me anything? No. Course not."],
        next: 'ask',
      },
      ask: {
        speaker: 'gutter',
        lines: ['Wha\' d\'you want?'],
        choices,
      },
      who: {
        speaker: 'gutter',
        lines: [
          "Jack. Gutter Jack, 'cause that's where they find me, mornings. I was a pilot once. Took barges up the Wend and down, never lost one. Knew every shoal.",
          "Then they started losing themselves. Barges. With nobody on 'em. Floating down the river all quiet, empty as a church. After the third one nobody'd hire me. Can't think why.",
        ],
        next: 'ask',
      },
      dry: {
        speaker: 'gutter',
        lines: [
          "Know? I know everything, kind face. Every secret in this sinking town. But my throat's so dry, see, the words stick in it.",
          "An ale. Just the one. You bring me an ale and I'll tell you a thing worth ten.",
        ],
        next: 'ask',
      },
      thirsty: {
        speaker: 'gutter',
        lines: ["Is that... is that an ale I smell on you? Kind face. Kindest face."],
        choices: [
          { text: 'Give him an ale.', next: 'secret', action: 'gutter-ale' },
          { text: 'Not a chance.', next: 'ask' },
        ],
      },
      secret: {
        speaker: 'gutter',
        lines: [
          "Ahh. That's the stuff. Right. Lean in. Closer. Not that close.",
          "The Rose has a cellar, and the cellar's got a door at the back of it that goes down to the river. Under the Staithe. That's how the barrels come in that the gate never sees.",
          "And it's not only barrels. Some nights I've seen 'em bring folk up out of it. Folk with their hands tied. That's all. That's all I know. You never heard it off me.",
        ],
        next: 'ask',
      },
      told: {
        speaker: 'gutter',
        lines: ["I told you already. I don't tell it twice. Telling it once was daft enough."],
        next: 'ask',
      },
      well: {
        speaker: 'gutter',
        lines: [
          "Water. Bad water. Don't drink it. I don't. I don't drink water at all, haven't in years, and look at me. Picture of health.",
          "They say a girl fell down it in my granddad's day and they never got her out, and on still nights you hear her singing. I've heard it. Course, I'd had a few.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'gutter',
        lines: ['G\'bye, kind face. Mind the mud. Mud\'s deeper than it looks.'],
      },
    },
  };
}

/**
 * Wisp, a girl of ten or so with a quick grin, about the square. The first time,
 * she lifts a few coins while she talks (the 'wisp-pinch' action); after that,
 * the hero can call her on it and get them back.
 * @param pinched how many coins she took the first time (0 if none, or none to take)
 * @param returned whether she's already given them back
 * @param extra more to ask her about, and where it leads (her mam's silver: see dialogue/sump.ts)
 */
export function wispScript(
  first: boolean, pinched: number, returned: boolean, extra: { choices: DialogueChoice[]; nodes: Record<string, DialogueNode> } = { choices: [], nodes: {} },
): DialogueScript {
  const choices: DialogueChoice[] = [
    ...extra.choices,
    { text: 'What are you doing out here on your own?', next: 'alone' },
    { text: 'Who should I watch out for?', next: 'watch' },
  ];
  if (pinched > 0 && !returned) choices.push({ text: 'Give me back my coins.', next: 'caught', action: 'wisp-return' });
  choices.push({ text: 'Run along, Wisp.', next: 'bye' });
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      ...extra.nodes,
      greet: {
        speaker: 'wisp',
        lines: [
          "Hello! You're not from here, you've got all your teeth. I'm Wisp. On account of you see me and then you don't. Watch.",
          "...See? You were looking at my hands and I was over here. Good, wasn't it? You can clap if you like.",
        ],
        next: 'gone',
      },
      gone: {
        speaker: 'wisp',
        lines: ["Anyway, I've got to go. Places to be. Bye-bye!"],
        action: 'wisp-pinch',
      },
      again: {
        speaker: 'wisp',
        lines: returned || pinched === 0 ? ["Hello again! I've not touched your purse. Honest. Check, if you like."] : ['Oh! Hello again. Lovely day. Lovely, foggy day.'],
        next: 'ask',
      },
      ask: {
        speaker: 'wisp',
        lines: ['What?'],
        choices,
      },
      alone: {
        speaker: 'wisp',
        lines: [
          "I'm not on my own, I've got the whole square. Mam's in the Rose, working. She says stay where she can see me from the window, and I do. Mostly.",
          "Mother Ossery gives me a honey sweet if I sweep her step. Mister Lusk gives me a copper if I tell him who's new. You're new. So that's a copper.",
        ],
        next: 'ask',
      },
      watch: {
        speaker: 'wisp',
        lines: [
          "Not Gutter Jack, he's nice, he's just sad. Not the Captain, he's fair. Brakk's scary but he's soft. He let me hold his hammer once. I couldn't.",
          "The men in the grey coats who come up out of the Rose's cellar at night. Them. Don't look at them and don't let them see you looking. That's what Mam says.",
        ],
        next: 'ask',
      },
      caught: {
        speaker: 'wisp',
        lines: [
          "...How did you know? Nobody ever knows. Fine. Here. All of them. I didn't spend any.",
          "You're sharp, you are. Sharper than you look. Don't tell Mam.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'wisp',
        lines: ['Bye-bye! Watch your pockets!'],
      },
    },
  };
}

/**
 * Cray, at the end of the pier by his boat: rows the hero back up the Wend to
 * Adowvale Jetty, for a fare (the 'row:jetty' action; see scenes/game/gloomhaven.ts).
 * @param fare what he charges
 * @param coins what the hero has
 */
export function crayScript(first: boolean, fare: number, coins: number): DialogueScript {
  const row: DialogueChoice =
    coins >= fare
      ? { text: `Row me up to Adowvale. (${fare} coins)`, next: 'off', action: 'row:jetty' }
      : { text: `Row me up to Adowvale? (${fare} coins: I haven't enough)`, next: 'short' };
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'cray',
        lines: [
          "...",
          "You're standing on my pier. Everyone stands on my pier. Nobody gets in my boat. They will, in the end. Everyone gets in a boat in the end.",
          "Cray. I row. Up the river, down the river, across it, to the eyots and the old staithes and the drowned church. Wherever you like. For coin.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'cray',
        lines: ['The river is still here. So am I.'],
        next: 'ask',
      },
      ask: {
        speaker: 'cray',
        lines: ['Well?'],
        choices: [
          row,
          { text: "Aren't you afraid of what's taking the barges?", next: 'barges' },
          { text: 'The drowned church?', next: 'church' },
          { text: 'Not today.', next: 'bye' },
        ],
      },
      off: {
        speaker: 'cray',
        lines: ["Get in. Sit in the middle. Don't trail your hands in the water. Don't look over the side, whatever you hear. It's a long row upstream."],
      },
      short: {
        speaker: 'cray',
        lines: ["Coin first. Always coin first. The river doesn't do favours, and nor do I."],
        next: 'ask',
      },
      barges: {
        speaker: 'cray',
        lines: [
          "No. It doesn't want me. I'm too small. Too slow. Too old and too stringy. It wants the big boats, the full ones, with plenty aboard.",
          "I've seen it go by, once. Under the water, at night. Like a long dark shadow, longer than the barge it was following. I sat very still. It went on downstream.",
        ],
        next: 'ask',
      },
      church: {
        speaker: 'cray',
        lines: [
          'Downriver, where the old village was, before the water came up. You can see the top of the tower at low water, and on calm nights you can hear the bell. There is no bell. It went down with the rest.',
          "I'll row you there, one day. When you're ready. Not yet.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'cray',
        lines: ['I will be here.'],
      },
    },
  };
}
