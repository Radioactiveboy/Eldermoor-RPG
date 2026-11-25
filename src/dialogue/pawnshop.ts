import type { ProtectionStage } from '../systems/Pawnshop';
import { LUSK_HUSH, LUSK_REWARD } from '../systems/Pawnshop';
import type { DialogueChoice, DialogueScript, SpeakerId } from './Dialogue';

/**
 * Lusk's pawnshop on Gloomhaven's square (world/PawnshopMap.ts): Abel Lusk,
 * cheerfully and completely shameless, who buys what nobody else will and
 * fences what the Hooks make him; Nettle, his shop girl, working off the
 * pocket she picked; and two of the Hooks, Nim Dace, who talks, and Orm, who
 * doesn't. The quest they're all in is "Protection" (systems/Pawnshop.ts).
 *
 * Actions (scenes/game/pawnshop.ts): `pawn-bell` starts the quest, `pawn-hooks-leave`
 * sends the Hooks off after collecting, `pawn-upstairs` lets the hero up to the
 * counting room, `pawn-help` and `pawn-squeeze` are the choice, `pawn-fight` and
 * `pawn-bluffed` settle Dace, `pawn-reward` pays out, and `pawn-told-eye` is Lusk
 * owning up to the sealed crate. (Nobody here knows of the orb, and nobody is told.)
 */

const pickOne = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

// ---------------------------------------------------------------- Abel Lusk

export interface LuskState {
  first: boolean;
  stage: ProtectionStage;
  /** Has looked at Saint Elda's bell on the shop floor. */
  sawBell: boolean;
  /** How it ended, once it has. */
  outcome?: 'fought' | 'bluffed' | 'squeezed';
  /** Has seen the crate with the silver eye under the roof, and whether Lusk has said who it's for. */
  sawEye: boolean;
  toldEye: boolean;
  /** Nim Dace and Orm are in the shop, come for the stash. */
  hooksHere: boolean;
  /** After midnight. */
  late: boolean;
}

/** Abel Lusk, behind his grille: buys anything, sells everything, and is ashamed of none of it. */
export function luskScript(s: LuskState): DialogueScript {
  const shop = s.outcome ? 'shop:lusk-best' : 'shop:pawnbroker';
  const choices: DialogueChoice[] = [{ text: 'Show me what you have.', action: shop }];
  if (s.stage === 'none' && s.sawBell) choices.push({ text: "That bell by the counter. It's Saint Elda's. I've rung it.", next: 'bell', key: true });
  if (s.stage === 'evening') choices.push({ text: 'About the bell, and your "arrangement"...', next: 'evening', key: true });
  if (s.stage === 'talk') choices.push({ text: 'Who were those two?', next: 'collected', key: true });
  if (s.stage === 'ledger') choices.push({ text: 'This black book of yours...', next: 'ledger', key: true });
  if (s.stage === 'choose') choices.push({ text: "I've read your black ledger.", next: 'choose', key: true });
  if (s.stage === 'stash') choices.push({ text: s.hooksHere ? 'They\'re here.' : 'Dace is coming tonight?', next: s.hooksHere ? 'here' : 'tonight', key: true });
  if (s.stage === 'reward') choices.push({ text: "The Hooks won't trouble you again.", next: `reward-${s.outcome === 'bluffed' ? 'bluffed' : 'fought'}`, key: true });
  if (s.sawEye && !s.toldEye && (s.outcome || s.stage === 'stash' || s.stage === 'reward')) {
    choices.push({ text: 'The crate under the roof, with the silver eye. Who is it for?', next: 'eye', key: true });
  }
  choices.push({ text: 'Where does all this come from?', next: 'where' });
  choices.push({ text: 'Why the bars on the windows?', next: 'bars' });
  choices.push({ text: 'Who is the girl?', next: 'nettle' });
  if (s.stage === 'done') choices.push({ text: "How's business?", next: 'business' });
  choices.push({ text: 'Goodbye.', next: 'bye' });

  const again = s.late
    ? "Open! Always open. I sleep on the counter, you see. It saves on a bed, and on burglars."
    : s.outcome === 'squeezed'
      ? pickOne(["My dear partner in crime. Come to count your cut? It's in the safe. I always pay. It's the only rule I keep.", 'Ah, my blackmailer! Lovely to see you. I mean that. I admire good work.'])
      : s.outcome
        ? pickOne(['My friend! My only friend, very nearly. Mind the bear.', 'Ah! The scourge of the Hooks. Come in, come in. Touch anything you like. Within reason.'])
        : pickOne([
            "Back again! They always come back. It's the smell: damp, dust, and opportunity.",
            'Ah, my favourite customer. I say that to everyone. With you I very nearly mean it.',
            "Welcome back. Everything's still for sale. Some of it's even mine.",
          ]);

  return {
    start: s.first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'lusk',
        lines: [
          'Come in, come in, mind the bear. Abel Lusk: buyer, seller, lender, and keeper of this town\'s secrets at very reasonable rates. Everything you see is for sale. Including, on a slow day, me.',
          "Whatever you've got, I'll buy. Whatever you want, I've probably got, or know whose house it's in. And whatever passes over this counter stays on this side of it.",
        ],
        next: 'ask',
      },
      again: { speaker: 'lusk', lines: [again], next: 'ask' },
      ask: { speaker: 'lusk', lines: ['Buying, selling, or just admiring?'], choices },
      where: {
        speaker: 'lusk',
        lines: [
          "From people who no longer need it. A ring from a widow. A sword from a man who's decided he isn't a soldier after all. A pair of boots from a gentleman the river took, that the river gave back. Without the gentleman.",
          "I don't ask. That's what I'm for. If I asked, they'd go to the Rose, and the Rose pays half what I do and remembers twice as much.",
          "And some of it comes from friends I can't refuse. But that's a longer story, and you haven't bought anything yet.",
        ],
        next: 'ask',
      },
      bars: {
        speaker: 'lusk',
        lines: [
          "To keep what's inside in and what's outside out. Half this town has sold me something it would now like back, at no cost to itself.",
          "The bars are iron, the door's oak, and I sleep on the counter with a cudgel. Nobody's tried in four years. Well. Nobody's tried twice.",
        ],
        next: 'ask',
      },
      nettle: {
        speaker: 'lusk',
        lines: [
          "Nettle? My apprentice. My shop girl. My conscience, if I had one, which thank the river I don't.",
          'She tried to pick my pocket in the square. Picked it beautifully. I was so impressed I hired her. She\'s working off the debt. At this rate she\'ll be free when she\'s forty. I tell her that every year, and every year she believes me.',
        ],
        next: 'ask',
      },
      bell: {
        speaker: 'lusk',
        lines: [
          "Is it? Well, well. Saint Elda's. I did wonder, with the lily on it. Holy bells fetch a terrible price. Nobody wants to be the one ringing it at their wedding when the saint comes looking.",
          "I'll tell you how it came here, since you've an honest face and I like to watch it fall. There's a crowd on the waterfront called the Hooks. They take what comes up and down the river: cargo off the barges, nets, boats, and now, apparently, bells.",
          "They can't sell a monastery's bell in this town. But I can. I'm in the business of things nobody can sell. So once a week they bring me a sack of whatever the river gave them, and I buy it, at their price, which is a great deal more than it's worth.",
          'And then I pay them a little more on top, for my windows. They call that protection. I call it rent. On Fridays I call it something else.',
          "Don't take my word for it. Come in of an evening and watch. You'll know them. They smell of eels, and they don't knock.",
        ],
        action: 'pawn-bell',
        next: 'ask',
      },
      evening: {
        speaker: 'lusk',
        lines: ["Of an evening, I said. After six. They come most nights now, since the Reeve put them in yellow and called them the Watch. The law is so much hungrier than the lawless. Who knew?"],
        next: 'ask',
      },
      collected: {
        speaker: 'lusk',
        lines: [
          "Nim Dace. Charming, isn't he? Talks like a dictionary that fell in the river. And Orm, who doesn't talk at all, and doesn't need to.",
          "That was the tithe. Their sack, my silver, and a little word about my windows. Every week since midsummer, when the Reeve came back from upriver with a fur coat and silver to spend, and put both gangs in yellow and called it the Watch.",
          "Before that it was only the Hooks being the Hooks. Now it's the Hooks being the law. It's much more expensive.",
        ],
        choices: [
          { text: 'Why not go to Captain Vosk at the gate?', next: 'vosk' },
          { text: 'Why are you telling me all this?', next: 'why', key: true },
        ],
      },
      vosk: {
        speaker: 'lusk',
        lines: [
          "Vosk is a decent man with four men and a gate, and the Reeve is pushing him off it a yard at a time. He'd come if I asked. And then he'd be found in the river, and I'd be offered his boots.",
          "I'd give a fair price for them. It still wouldn't be worth it.",
        ],
        choices: [{ text: 'Why are you telling me all this?', next: 'why', key: true }],
      },
      why: {
        speaker: 'lusk',
        lines: [
          'Because you looked at that bell the way nobody in Gloomhaven has looked at anything in years. As if it mattered whose it was.',
          "Come upstairs. My desk. There's a black book on it with a red ribbon. Read it, all of it, and particularly the bits with Dace's initials in. Then come down and tell me if you still want to look at me like that.",
        ],
        action: 'pawn-upstairs',
        next: 'ask',
      },
      ledger: {
        speaker: 'lusk',
        lines: ["Upstairs, on my desk. Black, red ribbon, can't miss it. Read it all. I didn't write it for my health. Well. I did, in a way."],
        next: 'ask',
      },
      choose: {
        speaker: 'lusk',
        lines: [
          'Well. Now you know what I am. I write it all down: every sack, every coin, every "gentleman\'s silver, river-damaged". If Moll Ketch knew there was a book, I\'d be at the bottom of the Wend with my pen still in my hand.',
          "And you've seen the rest. Dace has been selling a little of the Hooks' takings on his own account, through me, and telling Moll the river was poor that week. Moll Ketch would hang him off the Staithe by his own gaff.",
          'So you have a choice. And so, for once in my life, do I. Dace comes tonight, after dark, with Orm and the handcart, for the stash upstairs. I could let him have it, as usual. Or I could have a friend standing at my counter when he comes.',
        ],
        choices: [
          { text: "Then I'll stand at your counter. Let's get you out from under them.", next: 'help', action: 'pawn-help', key: true },
          { text: `Or I could tell the Hooks you keep a book. Unless you make it worth my while.`, next: 'squeeze', key: true },
          { text: 'I need to think about it.', next: 'think' },
        ],
      },
      think: { speaker: 'lusk', lines: ["Think quickly. Dace doesn't, but he does everything else fast."] },
      help: {
        speaker: 'lusk',
        lines: [
          "Ha! I hoped you'd say that, and I'd have bet against it. I'd have lost. I hate losing.",
          "Tonight, then: he'll come after dark, with Orm and a handcart, for the stash under the roof. Be here. Stand where he can see you. Say what you like to him. You know what's in the book, and so, now, does your face.",
          "And if it goes badly, the cudgel's under the counter, and so am I. Here: the key to the top floor. Go up and look at what you're risking your neck for, if you like. Don't touch the crate with the eye on it.",
        ],
      },
      squeeze: {
        speaker: 'lusk',
        lines: [
          "(For a moment his face does nothing at all. Then he laughs, delighted, and claps his long hands.)",
          "Oh, well done. Well done! I knew there was something under that face. I said to myself, Abel, that one's either a saint or a shark, and Saint Elda's is a long way upriver.",
          `${LUSK_HUSH} silver, and my best prices from now on, and we're friends who never speak of it. A pleasure doing business. It always is, at first.`,
        ],
        choices: [
          { text: `Done. ${LUSK_HUSH} silver.`, next: 'squeezed', action: 'pawn-squeeze', key: true },
          { text: "On second thoughts, I'll help you instead.", next: 'help', action: 'pawn-help' },
        ],
      },
      squeezed: {
        speaker: 'lusk',
        lines: [
          'There. Counted out twice. You can count it a third time; I won\'t be offended. I\'d think less of you if you didn\'t.',
          "Go on up and see the top floor, if you like. You've paid for the view. Just don't touch the crate with the eye on it. And I'll go on paying Dace, and Dace will go on smiling, and you'll go on knowing. Everyone wins. I win most of all. I always do.",
        ],
      },
      tonight: {
        speaker: 'lusk',
        lines: ["After dark. Up the street, Orm pushing the handcart, Dace walking beside it like a bishop. I'll keep the lamp lit. Be here before him if you can. He hates a surprise, and I adore them."],
        next: 'ask',
      },
      here: {
        speaker: 'lusk',
        lines: ["(Lusk doesn't look up from his ledger.) Don't look at me. I'm a bystander. I'm very good at it. Talk to him, not me."],
      },
      'reward-fought': {
        speaker: 'lusk',
        lines: [
          'You fought them. In my shop. Among my clocks. Orm broke eleven of them, and the rest are still chiming.',
          "Do you know what you've done? You've made Moll Ketch wonder. Wonder is very bad for business. The Hooks will remember your face now, and they're the sort who keep a grudge in salt.",
          `But they won't come back here in a hurry, and that's worth something. ${LUSK_REWARD.fought} silver, my best prices for as long as I live, and if any Hook asks, I've never met you. I've never met anyone.`,
        ],
        action: 'pawn-reward',
        next: 'ask',
      },
      'reward-bluffed': {
        speaker: 'lusk',
        lines: [
          "You didn't even raise your voice. You told Nim Dace what Moll would do with his gaff, and he went as white as a christening.",
          "He'll tell the Hooks I've been squeezed dry, poor old Abel, not worth the hook. And they'll believe him, because he'll make very, very sure they do. I'm free. I'm free! I don't know what to do with my hands.",
          `${LUSK_REWARD.bluffed} silver, and my best prices, and you may call me Abel. Nobody does.`,
        ],
        action: 'pawn-reward',
        next: 'ask',
      },
      eye: {
        speaker: 'lusk',
        lines: [
          "Ah. That. That came in with Dace, but it isn't the Hooks'. A gentleman at the Rose sends for it now and then. Grey coat, grey gloves, a voice like a door closing in another room.",
          "He pays in silver I don't know: new-struck, heavy, with a head on it I've never seen and letters I can't read. Foreign money, Dace says, very knowing, as if that explained anything.",
          "I don't ask what's in it. He doesn't haggle. We're made for each other. Leave it be. I mean that, which you'll have noticed is rare.",
        ],
        action: 'pawn-told-eye',
        next: 'ask',
      },
      business: {
        speaker: 'lusk',
        lines: [
          s.outcome === 'squeezed'
            ? "Thriving, no thanks to you. Ha! I'm joking. Mostly. Your cut's safe; I always pay. Dace still comes on Fridays and still smiles, and I still smile back. We're all smiling. It's dreadful."
            : "Thriving. I paid for my own windows this week, out of my own pocket. It was the strangest feeling. I think it was pride. I'm hoping it passes.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'lusk', lines: [pickOne(['Until next time. There is always a next time.', 'Mind the bear on your way out.', "Off you go. Don't steal anything. That's my job."])] },
    },
  };
}

// ---------------------------------------------------------------- Nettle

export interface NettleState {
  first: boolean;
  stage: ProtectionStage;
  sawBell: boolean;
  outcome?: 'fought' | 'bluffed' | 'squeezed';
}

/** Nettle, at her table under the window, ticketing pledges: fourteen, sullen, sharp, and nobody's fool. */
export function nettleScript(s: NettleState): DialogueScript {
  const choices: DialogueChoice[] = [
    { text: 'Who are you?', next: 'who' },
    { text: 'What do you do here?', next: 'what' },
    { text: 'Is Lusk a good master?', next: 'master' },
  ];
  if (s.sawBell) choices.push({ text: 'The bell by the counter. Where did it come from?', next: 'bell', key: s.stage === 'none' });
  if (s.stage !== 'none' && s.stage !== 'done') choices.push({ text: 'Tell me about the Hooks.', next: 'hooks', key: true });
  if (s.stage === 'done') choices.push({ text: 'How are things?', next: 'things' });
  choices.push({ text: 'Goodbye.', next: 'bye' });
  return {
    start: s.first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'nettle',
        lines: ["(The girl at the table doesn't look up from her tickets.) We're open. He's over there. Don't touch nothing."],
        next: 'ask',
      },
      again: { speaker: 'nettle', lines: [pickOne(['What.', "(She doesn't look up.) Still here, then.", "If you're buying, he's over there. If you're not, I'm busy."])], next: 'ask' },
      ask: { speaker: 'nettle', lines: ['Well?'], choices },
      who: {
        speaker: 'nettle',
        lines: [
          'Nettle. I work here.',
          "Working off a debt. I picked his pocket in the square and he caught me. Nobody catches me. Now I tie string round things till I'm old.",
          "He says I'll have it paid off in eleven years. He says that every year.",
        ],
        next: 'ask',
      },
      what: {
        speaker: 'nettle',
        lines: [
          "Tickets. Everything that comes in gets one: what it is, who brought it, what he paid, when it goes in the window if they don't come back for it. They never come back for it.",
          "If it's got river mud on, it came off the boats, and it gets a red ticket and goes upstairs, and I don't write who brought it. That's the rule.",
        ],
        next: 'ask',
      },
      master: {
        speaker: 'nettle',
        lines: [
          "He's a pig.",
          "He's the only one in this town who pays, though. A copper a week and the soup. And he never hits. (She glares.) Don't tell him I said he pays.",
        ],
        next: 'ask',
      },
      bell: {
        speaker: 'nettle',
        lines: [
          'Came in Thursday with the eel sacks. Orm carried it up the street on his shoulder like a baby. He was humming.',
          "Orm don't hum. It gave me the shivers.",
        ],
        next: 'ask',
      },
      hooks: {
        speaker: 'nettle',
        lines: [
          'Eel-men. Wreckers. River rats with knives. They wear red rags round their necks, and now they wear yellow round their arms too, since the Reeve pays them to call themselves the Watch.',
          'Dace does the talking. Orm does the rest. Moll Ketch does the thinking, down on her barge on the Staithe, and nobody does the arguing.',
          "If you're going to be here when they come, stand away from the door. Orm likes the door.",
        ],
        next: 'ask',
      },
      things: {
        speaker: 'nettle',
        lines: [
          s.outcome === 'squeezed'
            ? "He's been humming. He only hums when somebody owes him. (She looks at you sideways.) Or when he owes somebody, and he's working out how not to."
            : 'He gave me a rise. Two coppers. I nearly fell off my stool. Then he took one back for the soup.',
        ],
        next: 'ask',
      },
      bye: { speaker: 'nettle', lines: ['Mm.'] },
    },
  };
}

// ---------------------------------------------------------------- the Hooks

/** Nim Dace, at the counter, collecting: the hero has walked in on the Hooks' weekly visit. */
export function daceCollectingScript(): DialogueScript {
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'dace',
        lines: [
          "(A thin man in a clean black oilskin turns from the counter, all teeth.) Well, now. Company! You didn't say you had company, Abel.",
          "Nim Dace, of the Hooks. We're in the protection trade, friend. The river's custodians, you might say. Mister Lusk and I were just concluding our weekly arrangement.",
        ],
        next: 'lusk',
      },
      lusk: { speaker: 'lusk', lines: ['(Lusk, behind the grille, smiles like a man being shaved by a stranger.) We were, Nim. Always a pleasure.'], next: 'ask' },
      ask: {
        speaker: 'dace',
        lines: ['Always a pleasure. You hear that, Orm? (In the doorway, the big man says nothing at all.)'],
        choices: [
          { text: 'What arrangement?', next: 'arrangement' },
          { text: 'Leave him alone.', next: 'brave' },
          { text: '(Say nothing.)', next: 'quiet' },
        ],
      },
      arrangement: {
        speaker: 'dace',
        lines: [
          'Ours. A little river tithe for the Hooks, and a little sack of goods for Abel to find good homes for. Everyone wins. Abel wins most of all. Don\'t you, Abel?',
          "And now that we're the Watch, the Reeve's own, it's practically a civic duty. You should be proud, Abel. I am.",
        ],
        choices: [
          { text: 'Leave him alone.', next: 'brave' },
          { text: '(Say nothing.)', next: 'quiet' },
        ],
      },
      brave: {
        speaker: 'dace',
        lines: [
          "Oh, I like this one. Brave. Orm, isn't this one brave? (Orm looks at you the way a heron looks at a frog.)",
          "We're leaving anyway, friend. We've had our tithe. Do keep well. The river's a dangerous neighbour, and so are we. Evening, Abel.",
        ],
        action: 'pawn-hooks-leave',
      },
      quiet: {
        speaker: 'dace',
        lines: ["The quiet type. Very wise. Quiet people live longest in Gloomhaven. Evening, Abel. Same time next week. Come on, Orm."],
        action: 'pawn-hooks-leave',
      },
    },
  };
}

/** Nim Dace come for the stash, and the hero standing in his way. */
export function daceStashScript(readLedger: boolean): DialogueScript {
  const choices: DialogueChoice[] = [{ text: 'The stash stays where it is.', next: 'stays' }];
  if (readLedger) choices.push({ text: "How's Moll, Nim? Does she know about the Wend Maiden's silver? The bits you sold on your own account?", next: 'moll', key: true });
  choices.push({ text: 'Then take it. (Step aside.)', next: 'aside' });
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'dace',
        lines: [
          "Ah. You. I did wonder if you'd be here. Abel's made a friend. How touching. How very unlike him.",
          "We've come for the stash, friend: everything under the roof, and the gentleman's crate. Step aside, there's a good fellow, and nobody gets landed.",
        ],
        choices,
      },
      stays: {
        speaker: 'dace',
        lines: ["Does it. Orm? (Orm takes the boathook down off his shoulder.) Last chance, friend. I'd hate to get blood on Abel's lovely rug. Well. I'd mind a bit."],
        choices: [
          { text: 'Then come and take it.', action: 'pawn-fight', key: true },
          ...(readLedger ? [{ text: "Wait. Let's talk about Moll instead.", next: 'moll', key: true }] : []),
          { text: '...Fine. Take it.', next: 'aside' },
        ],
      },
      moll: {
        speaker: 'dace',
        lines: ["(Nim Dace's smile stays exactly where it is. The rest of his face leaves it there.) ...I don't know what you mean."],
        choices: [{ text: 'Lusk wrote it all down. Dates, prices, your initials. Moll would love to read it.', next: 'owned', key: true }],
      },
      owned: {
        speaker: 'dace',
        lines: [
          '(For a long moment he says nothing at all. Then he laughs, very quietly, and looks past you at Lusk.) Abel. You sly old eel.',
          "Here's how it is, then, friend. Abel's been squeezed dry. Very sad. Nothing more to be had from this shop; not worth the hook. I'll tell Moll so myself, and she'll believe me, because I'm very convincing.",
          "The stash can stay where it is. And the gentleman's crate, he can send for himself; I want no more to do with it, nor him. And you and I never spoke. Agreed?",
        ],
        choices: [{ text: 'Agreed. Get out.', action: 'pawn-bluffed', key: true }],
      },
      aside: {
        speaker: 'dace',
        lines: ["Sensible. I do like sensible. (He doesn't move, though; he's watching Lusk.) Go on, then, friend. We'll be a while. Mind the bear on your way out."],
      },
    },
  };
}

/** Dace, any other time: oily and pleasant and in no hurry. */
export function daceIdleScript(): DialogueScript {
  return {
    start: 'line',
    nodes: {
      line: { speaker: 'dace', lines: [pickOne(["Business, friend. Run along.", "Don't mind us. We're practically furniture.", 'Lovely evening for it. For anything, really.'])] },
    },
  };
}

/** Orm, who never says a word. */
export function ormScript(stash: boolean): DialogueScript {
  return {
    start: 'look',
    nodes: {
      look: {
        speaker: 'orm',
        lines: [
          "(The big man looks at you. He goes on looking at you for a long time. He doesn't say anything.)",
          stash
            ? '(He shifts the boathook on his shoulder, the way another man might clear his throat.)'
            : '(There is a hook tattooed on the back of each of his hands. One of them is upside down.)',
        ],
      },
    },
  };
}

// ---------------------------------------------------------------- chatter

/** What they mutter, standing about the shop. */
export const PAWN_MUTTERS: Partial<Record<SpeakerId, string[]>> = {
  lusk: ['Mind the bear.', "Everything's for sale.", 'Two coppers. Final offer. Three.', 'Nettle! Ticket!', "Who's been at the spoons?"],
  nettle: ['Red ticket. Upstairs.', 'Mm.', "That's not a real ruby.", 'Seven... eight... where\'s eight?'],
};

/** Lusk and Nettle, between customers. */
export const PAWN_CHATTER: Array<Array<[SpeakerId, string]>> = [
  [['lusk', 'Nettle, what did we give for the harp?'], ['nettle', 'Four.'], ['lusk', 'Then it\'s worth twelve.']],
  [['nettle', "The bear's lost another claw."], ['lusk', 'Ticket it. "Bear, eleven claws."']],
  [['lusk', "Nettle, dear, you've got ink on your nose."], ['nettle', "You've got ink on your soul."], ['lusk', 'Ha! Lovely.']],
  [['nettle', 'Somebody wants the wedding dress.'], ['lusk', "Tell them it's haunted. Then double it."]],
];

/** The thought on reading the black ledger, page by page (scenes/game/pawnshop.ts shows it as a sign). */
export const BLACK_LEDGER = {
  heading: 'The black ledger, in Lusk\'s careful hand',
  lines: [
    'Received of the Hooks, per N. Dace. Every sack, every Friday since midsummer, with what I paid and what it was worth. The difference, in a column of its own, headed "PROTECTION".',
    'Mar. Silver plate, a gentleman\'s, river-damaged (the barge WEND MAIDEN, I am told; I did not ask). Paid 30 to Moll\'s tally. Also, privately, per N.D., candlesticks x2, salver: paid 9 to N.D. himself, "not for the tally". Ditto in May, in June, in July. The initials N.D. are on every one.',
    'Bell, bronze, monastery (Saint Elda\'s lily). Paid 6. Worth 60. Unsellable. Kept upstairs.',
    'Crate, grey wax, sealed with an eye. NOT HOOKS\'. Brought by N.D. "for the gentleman at the Rose", to be held until sent for. Paid to me for the keeping: 2 silver, new-struck, heavy, a head I do not know and letters I cannot read.',
    'Underneath, in a smaller hand: "If you are reading this, Abel is dead, or you are a friend of his. He has very few. Burn it either way."',
  ],
};
