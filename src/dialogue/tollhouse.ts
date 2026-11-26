import { HERO_NAME } from '../config';
import { itemDef, type ItemId } from '../systems/Inventory';
import { HEARING_FEE, type FloodTollStage, type ReeveSilverStage } from '../systems/TollHouse';
import type { DialogueChoice, DialogueScript } from './Dialogue';

/**
 * The Reeve's toll house at the Fen Gate (world/TollHouseMap.ts) and the folk in
 * it: Corvin Sallow, the Reeve, upstairs in his new furs; Tobias Nibb, his clerk,
 * behind the grille; Gaff Tully, a Hook in the Reeve's yellow, on the stairs by
 * day; Lardy Mott, a Red Apron, on the strongroom door by night; and Annet Marl,
 * an eel-wife, waiting on the bench for her creels. And what the folk at the gate
 * and Hobb Tallow have to say about it all (wrapped round their own talk in
 * dialogue/gloomhaven.ts). The gangs are in shared-cast terms: Hooks ("eels") off
 * the Staithe, Red Aprons ("knackers") out of the Shambles, both in the Reeve's
 * yellow on Watch duty. Nobody here knows where the Reeve's silver comes from:
 * "a new friend with deep pockets", "foreign money", never more.
 */

/** Where the hero stands with the toll house, for its folk's talk. */
export interface TollTalk {
  coins: number;
  hour: number;
  /** Paid Nibb for a hearing. */
  hearing: boolean;
  flood: FloodTollStage;
  silver: ReeveSilverStage;
  nibbTold: boolean;
  reeveHeard: boolean;
  /** Carrying Annet's creels out of the strongroom; given back. */
  creels: boolean;
  creelsBack: boolean;
  /** Lardy has had his supper off the hero. */
  fedLardy: boolean;
  /** Something Lardy would eat, if the hero has one. */
  food?: ItemId;
  /** The toll's off for the small folk. */
  lifted: boolean;
}

// ---------------------------------------------------------------------------
// The toll office
// ---------------------------------------------------------------------------

/** Tobias Nibb, behind the grille: ink to the elbows, frightened of everyone, honest underneath. */
export function nibbScript(first: boolean, t: TollTalk): DialogueScript {
  const choices: DialogueChoice[] = [];
  if (t.silver === 'active' && !t.nibbTold) choices.push({ text: 'You keep two sets of books, Master Nibb. Don\'t you?', next: 'books', key: true });
  if (t.nibbTold && t.silver === 'active') choices.push({ text: 'Tell me again about the strongroom.', next: 'howin', key: true });
  if (!t.hearing) choices.push({ text: 'I want to see the Reeve.', next: 'hearing', key: t.flood === 'active' });
  else choices.push({ text: 'Can I go up to the Reeve?', next: 'goup' });
  choices.push(
    { text: 'What is the Flood Toll for?', next: 'toll' },
    { text: 'Who are the men in yellow?', next: 'watch' },
    { text: 'Do you sleep here?', next: 'cot' },
    { text: 'Good day, Master Nibb.', next: 'bye' },
  );
  return {
    start: t.lifted ? 'lifted' : first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'nibb',
        lines: [
          "Name? Business? Goods to declare? Coin, cloth, catch, candles, kine, kindling? ...Oh. You're not a cart. I'm sorry. I see a great many carts.",
          "Nibb. Tobias Nibb, clerk to the Reeve of Gloomhaven. I take the toll, I write it down, and I give a little paper that says it's been took. Taken. Sorry.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'nibb',
        lines: [t.hour >= 17 ? "We're nearly shut. I'm never quite shut. What is it?" : "Back again? Don't stand too close to the grille, please. Gaff doesn't like it."],
        next: 'ask',
      },
      lifted: {
        speaker: 'nibb',
        lines: [
          "It's you. I, um. I wanted to say. The Captain was here, with a paper, and the Reeve went the colour of whey, and now there's a new table up. No toll under a shilling's worth. Fishers and small traders, exempt.",
          "I handed out three DISTRAINED things back this morning and a woman kissed me through the grille. Nobody's ever done that. I've been shaking since. In a good way, I think.",
        ],
        next: 'ask',
      },
      ask: { speaker: 'nibb', lines: ['Yes?'], choices },
      toll: {
        speaker: 'nibb',
        lines: [
          "For the flood. The spring floods. For the walls, the drains, the dykes, the relief of the poor and the, um, the general improvement of Gloomhaven. It says so on the proclamation.",
          "It's a penny a cart, a penny a creel, a farthing a candle, and a licence for everything else. Doubled at the gate since midsummer. And if you can't pay, the Watch takes it in kind. That's the DISTRAINED corner.",
          "...I haven't seen a dyke mended. I'm not saying anything. I'm just saying I haven't seen one.",
        ],
        next: 'ask',
      },
      watch: {
        speaker: 'nibb',
        lines: [
          "The Fen Watch. The Reeve's Watch. They're, um. They're Hooks by day, from the Staithe, and Red Aprons by night, from the Shambles, and they wear the yellow, and they mustn't ever be in the house at the same time.",
          "The Reeve says they're keeping the peace. They are keeping it. They're keeping all of it, and nobody else gets any.",
          "Captain Vosk's men used to have the gate. They still stand at it. They just don't get to do anything there any more.",
        ],
        next: 'ask',
      },
      cot: {
        speaker: 'nibb',
        lines: [
          "Oh. That. Yes. The Reeve likes me on hand. In case of carts. There are carts at all hours, you'd be surprised.",
          "And it's warm, with the brazier. Warmer than my room in Fish Street, which has the river in it, most months. I don't mind. Much.",
        ],
        next: 'ask',
      },
      hearing: {
        speaker: 'nibb',
        lines: [
          `A hearing? With the Reeve? Yes, um. He gives hearings. You put your name down and pay the hearing fee, ${HEARING_FEE} coins, and Gaff lets you up the stairs.`,
          "It's to keep the time-wasters out, he says. It mostly keeps out the people who've come about the toll, because they haven't any coins left. That's not, um. That's not an accident. I shouldn't have said that.",
        ],
        choices: [
          ...(t.coins >= HEARING_FEE
            ? [{ text: `Put me down. Here's ${HEARING_FEE} coins.`, next: 'paid', action: 'toll-hearing', key: true }]
            : [{ text: "I haven't the coin.", next: 'nocoin' }]),
          { text: 'Pay to complain about paying? No.', next: 'ask' },
        ],
      },
      paid: {
        speaker: 'nibb',
        lines: [
          `There. ${HERO_NAME}... a hearing. Up the stairs at the back, past Gaff. Knock. Wait to be told. Don't sit until he says, and don't look at the bird.`,
          "Gaff! This one's paid! ...He heard. He hears everything. Good luck.",
        ],
        next: 'ask',
      },
      nocoin: {
        speaker: 'nibb',
        lines: ["No. Nobody has. I'm sorry. I'd lend it you, but they count my drawer at night. Both drawers."],
        next: 'ask',
      },
      goup: {
        speaker: 'nibb',
        lines: [t.hour < 20 ? "You're paid. Up you go, past Gaff. Don't look at the bird." : "Gaff's gone home, so nobody's keeping the stairs. Not that I'd tell you so. I didn't."],
        next: 'ask',
      },
      books: {
        speaker: 'nibb',
        lines: [
          "I, I don't know what. Who told you that. There's the CARTS, the CATCH, the CANDLES, the LICENCES, the DISTRAINT. That's all the books. That's all of them.",
          "...It's the Captain, isn't it. Vosk. He came in last week and looked at me, the way he looks at people, and didn't say anything, and I knew he knew.",
          "Yes. Two. The ones on the shelf, for anyone from Harrowford who asks, which nobody does. And the true one, that the Reeve writes in himself, in his own hand. I just add it up. He can't add.",
        ],
        next: 'books2',
      },
      books2: {
        speaker: 'nibb',
        lines: [
          "It's in the strongroom, on the stand, with the takings. I've never read what it says above the sums. I've been very careful never to.",
          "The key hangs on a hook by his bed, upstairs. He sleeps like the dead after midnight, after the wine. And at night the door's Lardy's. Lardy Mott. He's a knacker, a Red Apron, and he's, um, terrifying, but he would sell his own mother for a pie, and he likes his mother.",
          "You didn't hear any of it from me. I'm a clerk. I write things down. I've never once in my life said anything.",
        ],
        action: 'toll-nibb-told',
        next: 'ask',
      },
      howin: {
        speaker: 'nibb',
        lines: [
          "Shh! The key's on the hook by his bed, upstairs. He's asleep from midnight till eight. Or Lardy, on the door by night, and something to eat. I never said it.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'nibb',
        lines: [t.lifted ? 'Good day! It is, isn\'t it. A good day. Fancy.' : 'Mind the step. And the Watch. Mostly the Watch.'],
      },
    },
  };
}

/** Gaff Tully, a Hook in the Reeve's yellow, minding the queue and the stairs by day. */
export function gaffScript(first: boolean, t: TollTalk): DialogueScript {
  return {
    start: t.lifted ? 'lifted' : first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'gaff',
        lines: [
          "Well, here's a fish swum in off the river. Fresh one, too, look at it. Gaff Tully, of the Reeve's own Watch, and don't my band look lovely.",
          "You want to pay your toll, the grille's that way. You want to see the Reeve, the clerk takes your coin and I take you up. You want to argue, I've a boathook says you're landed.",
        ],
        next: 'ask',
      },
      again: { speaker: 'gaff', lines: ['Swimming round again, little fish?'], next: 'ask' },
      lifted: {
        speaker: 'gaff',
        lines: [
          "Oh, it's the clever one. Mind me while I weep. No toll on a creel no more, and the river's tithe gone with it, and Moll's face when she heard. Hah! I'd have paid a toll to see it.",
          "Don't look so pleased. Toll or no toll, the Hooks was here before the Reeve and we'll be here after him. You want to watch the water, fish. It's got a long memory.",
        ],
        next: 'ask',
      },
      ask: {
        speaker: 'gaff',
        lines: ['Well?'],
        choices: [
          ...(t.hearing
            ? [{ text: "I've paid for a hearing.", next: 'paid' }]
            : [{ text: 'Let me up the stairs.', next: 'stairs' }]),
          { text: "You're a Hook, aren't you? Not a guard.", next: 'hook' },
          { text: 'What happens to folk who can\'t pay?', next: 'cantpay' },
          { text: 'Where does the Reeve get his silver?', next: 'silver' },
          { text: 'Leave him to it.', next: 'bye' },
        ],
      },
      stairs: {
        speaker: 'gaff',
        lines: [`Clerk first, fish. ${HEARING_FEE} coin. The Reeve don't see folk for free, and nor do I.`],
        next: 'ask',
      },
      paid: {
        speaker: 'gaff',
        lines: ["So I heard. Up you go, then, past me, mind the third stair. Knock, and wait. He likes you to wait."],
        next: 'ask',
      },
      hook: {
        speaker: 'gaff',
        lines: [
          "Can't I be both? Under the yellow I'm the Watch. Under the Watch I'm Moll Ketch's, same as I ever was, off the Maggie Mae. The yellow comes off at sundown. The rag stays on.",
          "Knackers have the door at night. We don't speak. We leave the barrel and the dice for 'em, and they leave the dice and take the barrel. Offal, the lot.",
        ],
        next: 'ask',
      },
      cantpay: {
        speaker: 'gaff',
        lines: [
          "Then they're on the hook, fish. We take it in kind: creels, crates, casks, a coat if it's a good coat. It's all writ down, legal. The clerk writes beautiful.",
          "And every day it sits in that corner it costs 'em more to get it back. That's the Reeve's notion, not mine. Mine was simpler. Mine was a boathook.",
        ],
        next: 'ask',
      },
      silver: {
        speaker: 'gaff',
        lines: [
          "Ha! You'd have to ask him. He went off to Harrowford with holes in his boots and come back a lord. Friend with deep pockets, he says. Foreign money, Moll says.",
          "Don't care, me. Silver's silver. It don't smell of nothing. ...Grey coats in the Rose don't smell of nothing either, and I'd not cross 'em. Forget I said grey coats.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'gaff', lines: ['Swim along.'] },
    },
  };
}

/** Lardy Mott, a Red Apron, on the strongroom door at night: huge, slow, always eating. */
export function lardyScript(first: boolean, t: TollTalk): DialogueScript {
  const food = t.food ? itemDef(t.food).name.toLowerCase() : undefined;
  return {
    start: t.fedLardy ? 'fed' : first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'lardy',
        lines: [
          "...Mm. Nobody goes in. That's the job. Nobody goes in, and Lardy sits.",
          "Lardy Mott. Gaffer sent me. Gaffer says sit, so I sit. I'm good at sitting.",
        ],
        next: 'ask',
      },
      again: { speaker: 'lardy', lines: ['Still nobody goes in.'], next: 'ask' },
      fed: {
        speaker: 'lardy',
        lines: ["You're the one with the food. Door's open. You never come in, mind. Lardy never saw. Lardy was eating."],
        next: 'ask',
      },
      ask: {
        speaker: 'lardy',
        lines: ['Mm?'],
        choices: [
          ...(!t.fedLardy && food
            ? [{ text: `You look hungry. Want my ${food}?`, next: 'feed', action: `toll-feed-lardy:${t.food}`, key: true }]
            : []),
          ...(!t.fedLardy ? [{ text: 'Let me into the strongroom.', next: 'no' }] : []),
          { text: 'Is that a cat?', next: 'cat' },
          { text: 'You work for Saul Rendle?', next: 'gaffer' },
          { text: 'Night, Lardy.', next: 'bye' },
        ],
      },
      no: {
        speaker: 'lardy',
        lines: [
          "No. Nobody goes in.",
          "...Gaffer says if anyone goes in, Lardy gets hung up. Lardy doesn't like being hung up. ...Lardy's hungry, though. Lardy's always hungry. The Reeve don't feed us. Says it's in the wage.",
        ],
        next: 'ask',
      },
      feed: {
        speaker: 'lardy',
        lines: [
          `...For me? A ${food}? All of it?`,
          "Mm. Mmm. ...That's good, that is. That's a proper thing. Lardy's going to sit round the corner and eat it slow. Takes a while, eating slow. A long while.",
          "Door's on the latch. Don't take the chests. Gaffer counts the chests.",
        ],
        next: 'ask',
      },
      cat: {
        speaker: 'lardy',
        lines: [
          "Cat. Comes in under the strongroom door for the rats. I give her the rind off my ham. She's called Cat.",
          "Everyone's frit of Lardy. Cat's not. Cat's got sense.",
        ],
        next: 'ask',
      },
      gaffer: {
        speaker: 'lardy',
        lines: [
          "Gaffer's the Gaffer. Mr Rendle. Lardy's been his since I was little. He does the sums. Lardy does the... the other part.",
          "Gaffer says the Reeve's a useful fool. I don't know what useful is. He's a fool, though. He smells of flowers.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'lardy', lines: ['Mm.'] },
    },
  };
}

/** Annet Marl, an eel-wife off the Staithe, on the bench, waiting for her creels and her boy's bow. */
export function annetScript(first: boolean, t: TollTalk): DialogueScript {
  const choices: DialogueChoice[] = [];
  if (t.creels && !t.creelsBack) choices.push({ text: "I've got your creels. Here.", next: 'back', action: 'toll-annet-creels', key: true });
  choices.push(
    { text: 'Why are you waiting here?', next: 'why' },
    { text: 'Who is Dickon?', next: 'dickon' },
    { text: 'What was it like before the toll?', next: 'before' },
    { text: 'Take care, Annet.', next: 'bye' },
  );
  return {
    start: t.creelsBack ? 'thanks' : first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'annet',
        lines: [
          "Don't mind me, I'm part of the furniture now. Third day on this bench. Annet Marl. Eel-wife, off the Staithe, when I've creels to fish with.",
          "Which I haven't. They're in there. Behind that door, with DISTRAINED on 'em, and a tag that says I owe four silver, and tomorrow it'll say five.",
        ],
        next: 'ask',
      },
      again: { speaker: 'annet', lines: ["Still here. Where else would I be? The eels don't catch theirselves."], next: 'ask' },
      thanks: {
        speaker: 'annet',
        lines: [
          t.lifted
            ? "There's the one! The whole Staithe's heard. No toll on a creel. My Dickon's been telling everyone you're a knight in disguise. I told him you're not dressed for it."
            : `There's ${HERO_NAME}. Creels back in the water, and the eels are running. Don't you go telling the Watch where I set 'em.`,
        ],
        next: 'ask',
      },
      ask: { speaker: 'annet', lines: ['What is it, love?'], choices },
      why: {
        speaker: 'annet',
        lines: [
          "Flood Toll. A penny a creel landed, and that was this summer, and then it was a penny a creel set, and then it was a licence to set 'em. I paid, and I paid, and then I didn't have it.",
          "So the yellowbands come down the Staithe, and that Gaff, and took the lot, twelve creels, and the boat-knife, and my Dickon's bow off his back for good measure, \"for the peace\".",
          "I can't fish without creels, and I can't pay without fishing, and the clerk's very sorry, and the Reeve won't see me without two coins I haven't got. So I sit. If I sit long enough someone'll be ashamed. That's the plan.",
        ],
        next: 'ask',
      },
      dickon: {
        speaker: 'annet',
        lines: [
          "My boy. Nine. Made himself a bow out of a willow wand and his granddad's gut line, and carved his name in it, and shot at gulls off the Staithe and never hit one in his life.",
          "They took that and all. A child's bow. Weapons in the town, they said. He cried all night and pretended he hadn't.",
        ],
        next: 'ask',
      },
      before: {
        speaker: 'annet',
        lines: [
          "Hard. It was always hard. But you paid the Hooks their tithe and they left you be, and Vosk's men took a penny at the gate and a cart got through, and the Reeve was a rumour.",
          "Now the Hooks and the knackers both wear his yellow and they've stopped hating each other long enough to rob everyone else. And Vosk just stands at his gate, looking like a man swallowing a stone.",
        ],
        next: 'ask',
      },
      back: {
        speaker: 'annet',
        lines: [
          "...Oh. Oh, those are mine. That's my mend, there, with the blue twine. How did you... no, don't tell me. I don't want to know, then I can't say.",
          "Here. Take these eels, they were in the bottom of my bucket from this morning and they're still good. Don't make that face, they're lovely stewed.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'annet', lines: ['And you, love. Mind the yellow.'] },
    },
  };
}

// ---------------------------------------------------------------------------
// Upstairs
// ---------------------------------------------------------------------------

/** Corvin Sallow, Reeve of Gloomhaven, at his great desk: fussy, legalistic, smiling and cruel. */
export function reeveScript(first: boolean, t: TollTalk): DialogueScript {
  const choices: DialogueChoice[] = [];
  if (t.flood === 'active' && !t.reeveHeard) choices.push({ text: "I've come about the Flood Toll. The small traders can't pay it.", next: 'case', key: true });
  if (t.reeveHeard && !t.lifted) choices.push({ text: 'About your offer of work...', next: 'offer2' });
  choices.push(
    { text: 'Where were you after the spring floods?', next: 'away' },
    { text: 'Your Watch are gang men.', next: 'watch' },
    { text: 'Where does the money from the toll go?', next: 'money' },
    { text: 'I\'ll take my leave, Reeve.', next: 'bye' },
  );
  return {
    start: t.lifted ? 'lifted' : first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'reeve',
        lines: [
          "No, do stand. The stool is for petitioners of consequence. Corvin Sallow, Reeve of Gloomhaven, by appointment of the lord's steward at Harrowford, as the proclamation says, which I trust you read. Everyone reads it. It is nailed up at eye level for that purpose.",
          "You have paid for a hearing, so you shall have one. I am a fair man. Ask anyone. Ask Nibb. Nibb! ...He will tell you. Speak.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'reeve',
        lines: ['You again. The fee was for one hearing, strictly, but I am in a generous humour. Briefly, now.'],
        next: 'ask',
      },
      lifted: {
        speaker: 'reeve',
        lines: [
          "Ah. The meddler. Do you know, the Captain has never once in eleven years climbed my stairs, and today he climbed them with a paper in his hand that he should not have.",
          "The Flood Toll is suspended for fishers and small traders. The distrained goods are returned. I have been magnanimous. It will be in the proclamation. I hope you're pleased. I hope you sleep soundly. It is a long way down from the Fen Gate wall, in the fog.",
        ],
        next: 'ask',
      },
      ask: { speaker: 'reeve', lines: ['Well? My time is the town\'s, and the town is in a hurry.'], choices },
      case: {
        speaker: 'reeve',
        lines: [
          "Can't pay. Can't. A word I hear a great deal in this room. Tallow can't. The eel-woman downstairs can't. The cooper can't, the carter can't, the whole of Fish Street can't. And yet the dykes, you see, must be paid for. Somebody must pay for the flood.",
          "If they cannot pay in coin, the law, which I keep, lets the Watch take it in kind. If the goods are not redeemed, they are sold, and the sum goes to the relief of the town. It is all written down. Nibb writes beautifully.",
          "So, no. The toll stands. I am sorry for Tallow. I am sorry for all of them, in a general way.",
        ],
        next: 'offer',
      },
      offer: {
        speaker: 'reeve',
        lines: [
          "But you. You're new. Clean, more or less. Nobody in this town owes you a grudge yet. The Watch are, between ourselves, a little rough with the reluctant. A clean face at a door does wonders.",
          "A shilling in the pound of everything you collect. Start with Tallow's, since you know the way. Think about it. People who work for me do very well. People who don't, well. You have seen the corner downstairs.",
        ],
        choices: [
          { text: "I'll think about it.", next: 'think', action: 'toll-reeve-heard' },
          { text: "I'd sooner eat eel raw.", next: 'refuse', action: 'toll-reeve-heard' },
        ],
      },
      think: {
        speaker: 'reeve',
        lines: ['Do. Thinking is cheap. It is the only thing in Gloomhaven I have not yet put a toll on.'],
        next: 'ask',
      },
      refuse: {
        speaker: 'reeve',
        lines: ["How very rustic. Well. The offer stands until it doesn't. Most things do."],
        next: 'ask',
      },
      offer2: {
        speaker: 'reeve',
        lines: ['Have you come to your senses? No? Then you have come to waste my time, which is the town\'s time, and the town will be charged for it.'],
        next: 'ask',
      },
      away: {
        speaker: 'reeve',
        lines: [
          "Upriver, petitioning for flood relief. On the town's behalf. At considerable personal inconvenience. The steward's people were not, at first, receptive.",
          "But I found... friends, let us say. Men of means who take an interest in the improvement of small towns. Gloomhaven is fortunate in its friends. Gloomhaven does not know how fortunate.",
        ],
        next: 'ask',
      },
      watch: {
        speaker: 'reeve',
        lines: [
          "Gang men. What a word. I prefer to say that I have given employment to two of the town's oldest institutions, and they are now on the side of the law. Who better to keep a peace than the people who were breaking it?",
          "The gate captain had his chance. Vosk. Four old men and a brazier. Did the tolls ever reach me, under Vosk? They did not. Now they do. Draw your own conclusions. I have drawn mine.",
        ],
        next: 'ask',
      },
      money: {
        speaker: 'reeve',
        lines: [
          "To the town. For the town. On the town's behalf. You will find it all accounted for in the ledgers below. Every farthing. Every candle.",
          "...My coat? A gift. From a grateful friend. A reeve must look like a reeve, or who would pay him?",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'reeve',
        lines: [t.lifted ? 'Go. And mind the stairs. They are very steep.' : 'Nibb will see you out. Close the door. Gently. The bird is nervous.'],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// About the town: what Vosk, his men and Hobb Tallow have to say about the toll
// ---------------------------------------------------------------------------

/** Adds a reply and its nodes to a script's 'ask' list (before the last reply, the goodbye). */
function weave(script: DialogueScript, choice: DialogueChoice | undefined, nodes: DialogueScript['nodes']): DialogueScript {
  const ask = script.nodes.ask;
  if (!ask?.choices || !choice) return script;
  const choices = [...ask.choices];
  choices.splice(Math.max(0, choices.length - 1), 0, choice);
  return { ...script, nodes: { ...script.nodes, ...nodes, ask: { ...ask, choices } } };
}

/** Captain Vosk: the Reeve's story as the gate sees it, his errand, and what he does with the book once he has it. */
export function voskTollTalk(script: DialogueScript, t: TollTalk): DialogueScript {
  const choice: DialogueChoice | undefined =
    t.silver === 'none'
      ? { text: 'What do you make of the Reeve?', next: 'reeve', key: t.flood !== 'none' }
      : t.silver === 'proof'
        ? { text: "I've been in the Reeve's strongroom. I found his true book.", next: 'proof', key: true }
        : t.silver === 'active'
          ? { text: 'About the Reeve\'s silver...', next: 'remind' }
          : { text: 'How are things, with the Reeve?', next: 'after' };
  return weave(script, choice, {
    reeve: {
      speaker: 'vosk',
      lines: [
        "Corvin Sallow. A clerk with a chain on. The steward at Harrowford gave him Gloomhaven years ago to get him out of the way, and forgot him, and so did we. He'd sit in that toll house and scratch at his ledgers and nobody minded.",
        "After the spring floods he went off upriver. Gone to petition for flood relief, he said. He went with holes in his boots. He came back at midsummer with fur on his collar, rings on every finger, and silver enough to hire both gangs at once.",
        "The Hooks and the Red Aprons, in the same yellow, on the same gate. Ten years I've kept those two apart. He's put them in a uniform and given them my job. And my men stand there and watch them do it.",
      ],
      next: 'reeve2',
    },
    reeve2: {
      speaker: 'vosk',
      lines: [
        "Flood relief doesn't buy fur. Nobody in Harrowford gave that man a penny. Somebody else did, and wants something for it, and I'd like to know who, and what.",
        "Sallow keeps two sets of books. Clerks always do, when they're told to, and his clerk's honest enough to be miserable about it. The true one'll be in his strongroom.",
        "Find out where the silver comes from. Get me it in writing, in his hand. I'll copy it to the steward at Harrowford, and the steward would sooner hang a reeve than have it known his reeve is bought. Sallow knows it. He'll do as he's told, after.",
      ],
      choices: [
        { text: "I'll find out where it comes from.", next: 'yes', action: 'toll-start-silver', key: true },
        { text: 'Why not go in yourself?', next: 'whynot' },
        { text: 'Not my business, Captain.', next: 'ask' },
      ],
    },
    whynot: {
      speaker: 'vosk',
      lines: [
        "Because I'm the gate captain, and if the gate captain kicks in the Reeve's door, the Reeve calls it a riot and the Watch have their excuse, and the Hooks and the Aprons stop being a Watch and start being a war in my streets.",
        "Nobody notices you yet. That's worth a great deal. Don't waste it.",
      ],
      next: 'reeve2',
    },
    yes: {
      speaker: 'vosk',
      lines: [
        "Good. Quietly. The strongroom's behind the toll office. Lardy Mott keeps it at night, one of Rendle's knackers. Don't fight him. I mean it. Lardy's killed men by sitting on them.",
        "Talk to Nibb, the clerk. Kindly. He's more frightened of me than of the Reeve, and he ought to be more frightened of the Reeve.",
      ],
      next: 'ask',
    },
    remind: {
      speaker: 'vosk',
      lines: ["The true book, in the strongroom, behind the toll office. And who's paying. In writing. Nibb knows how to get in, if he'll say it."],
      next: 'ask',
    },
    proof: {
      speaker: 'vosk',
      lines: [
        "Show me. ...Hm. 'From V.', every new moon, ten times what the toll brings in. 'Kept back for the Reeve's own.' And a letter, under a grey seal with an eye on it. 'For the Reeve's continued good offices.'",
        "Good offices. Keeping the gate. Keeping the river quiet. Keeping his yellow Watch in the streets and the town looking at the toll and not at the Black Rose's cellar, or who goes up the river by night.",
        "I don't know who V. is. I can guess the colour of his coat. ...Leave that with me. Don't say that name in the Rose. Don't say it anywhere.",
      ],
      next: 'proof2',
    },
    proof2: {
      speaker: 'vosk',
      lines: [
        "I'll go up those stairs this afternoon with a fair copy and watch him read it. The toll comes off the small folk by tonight, and what he's taken comes back, or the steward gets it by the morning barge.",
        `You've done the town a good turn, ${HERO_NAME}. It won't thank you. Towns don't. I will.`,
      ],
      action: 'toll-return',
      next: 'ask',
    },
    after: {
      speaker: 'vosk',
      lines: [
        "Quieter. The toll's off the small folk and the corner downstairs is empty. The yellowbands still walk about in it, but they've less to do, and the Hooks and the Aprons are already looking at each other again.",
        "That'll be my trouble, when it comes. It's always been my trouble. I'd rather have it than his.",
      ],
      next: 'ask',
    },
  });
}

/** Hobb Tallow: the toll that's emptying his shop, his quest, and his thanks. */
export function tallowTollTalk(script: DialogueScript, t: TollTalk): DialogueScript {
  const choice: DialogueChoice | undefined =
    t.flood === 'none'
      ? { text: 'You look worried, Master Tallow.', next: 'worried', key: true }
      : t.flood === 'lifted'
        ? { text: 'The Flood Toll is off, for the small traders.', next: 'lifted', key: true }
        : t.flood === 'active'
          ? { text: 'About the Flood Toll...', next: 'remind' }
          : { text: 'How is trade, now?', next: 'after' };
  return weave(script, choice, {
    worried: {
      speaker: 'tallow',
      lines: [
        "Worried? Me? Hah. ...Yes. Look at the shelves. Half empty. Not sold, mind. Never got here. The Reeve's Flood Toll, a farthing a candle going out and a penny a pound of fat coming in, and a licence to sell, and a licence to render.",
        "I couldn't pay the last of it, so his yellowbands took my lamp oil. A whole cask. It's sat in his toll house with DISTRAINED on it and every day it costs me more to get back. Half the town's light for a month.",
        "And I'm one of the lucky ones. Annet Marl's been sat on his bench three days for her creels. Can't fish without 'em, can't pay without fishing.",
      ],
      next: 'worried2',
    },
    worried2: {
      speaker: 'tallow',
      lines: [
        "Somebody ought to have a word with the Reeve. Not me. I've had a word. I paid two coins for a hearing and he offered me a licence to complain.",
        "You've got an honest face, and nobody's taken anything off you yet. Would you go up and have a word? For Annet's sake, if not mine?",
      ],
      choices: [
        { text: "I'll have a word with the Reeve.", next: 'yes', action: 'toll-start-flood', key: true },
        { text: "I've troubles of my own.", next: 'ask' },
      ],
    },
    yes: {
      speaker: 'tallow',
      lines: [
        "Bless you. The toll house is by the Fen Gate, on the west side of the road, under the gilt scales. Nibb at the grille takes names for a hearing. Don't let that Gaff Tully rile you.",
        "And if you see Captain Vosk, tell him from me that I'd rather pay his old penny than this. He'll know what I mean.",
      ],
      next: 'ask',
    },
    remind: {
      speaker: 'tallow',
      lines: [
        t.reeveHeard
          ? "He offered you work? Collecting? From me? Hah! That man. Words won't shift him, then. Something will. Vosk's had a look on him for months like he knows what."
          : 'The toll house by the Fen Gate, under the gilt scales. Nibb at the grille, two coins for a hearing, and up the stairs past Gaff. Good luck.',
      ],
      next: 'ask',
    },
    lifted: {
      speaker: 'tallow',
      lines: [
        "Off? Off! I heard a rumour this morning and didn't dare believe it. Nibb sent a boy round with my cask on a barrow, and a note saying 'with the Reeve's compliments', and the boy ran off before I could ask whose compliments.",
        "That was you. Don't say it wasn't. Here. Take this. No, take it, I'd only spend it on fat. And come by for candles whenever you like. They're on the house. Well. Some of them.",
      ],
      action: 'toll-tallow-done',
      next: 'ask',
    },
    after: {
      speaker: 'tallow',
      lines: ["Better! There's light in Gloomhaven's windows again, and my light at that. A candle in every window, every night. And who sells the candles?"],
      next: 'ask',
    },
  });
}

/** Brakk, Fitch and Old Crabbe, the old gate guard, on the men in yellow who've taken their gate. */
export function gateManTollTalk(id: 'brakk' | 'fitch' | 'crabbe', script: DialogueScript, t: TollTalk): DialogueScript {
  const lines: Record<typeof id, string[]> = {
    brakk: t.lifted
      ? ["Captain went up the Reeve's stairs. I waited at the bottom with my hammer. He came down smiling. Captain doesn't smile. Hnh. It was good."]
      : [
          "Yellowbands. Hooks in the day, knackers in the night. They stand in our gate and take the coin and we stand next to them and don't.",
          "Captain says don't hit them. I don't hit them. I want to. Gaff Tully calls me Big Fish. I'm not a fish.",
        ],
    fitch: t.lifted
      ? ["The Reeve's taken his yellow off the gate road. They're back on their own turf, eyeing each other. I'm watching. Better than watching them watch me."]
      : [
          "Twenty of them, near enough, in the yellow. Moll Ketch's on the river and Rendle's from the Shambles. I know every face. I've had an arrow on most of them, one time or another.",
          "The Reeve pays them. Pays them more than the town pays us. You'd wonder where a Reeve gets that much silver. I do wonder. Out loud, never.",
        ],
    crabbe: t.lifted
      ? ["Hah! I hear the Flood Toll's drowned. Good riddance. Took the Reeve eleven years to find his backbone and a month for Vosk to bend it back."]
      : [
          "The Reeve? Corvin Sallow, son of a ferryman's clerk. I knew him when he was a boy with ink on his nose. Never had two coins together. Now look at him. Fur. On a Gloomhaven man. In summer.",
          "Gone a season and back a lord, and his pockets full, and nobody asks. Things that come back from upriver changed, friend, you don't ask. You watch.",
        ],
  };
  return weave(script, { text: 'What about the men in yellow?', next: 'yellow' }, { yellow: { speaker: id, lines: lines[id], next: 'ask' } });
}
