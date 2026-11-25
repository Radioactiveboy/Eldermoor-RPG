import { HERO_NAME } from '../config';
import { type TamFate, type WidowTam, widowTamNodes } from './shambles';
import { itemDef, ItemId } from '../systems/Inventory';
import { BACK_ROOM_FEE, HOLLIS_DRINK, ROSE_DRINKS, ROSE_FOOD, ROSE_MENU, ROSE_RENT, SILAS_STAKE } from '../systems/BlackRose';
import type { DialogueChoice, DialogueScript, SpeakerId } from './Dialogue';

/**
 * The Black Rose, Gloomhaven's tavern (world/BlackRoseMap.ts). The Widow
 * Morwen Thorne pours (`rose-drink:<item>`), lets her one room
 * (`rose-rent:<nights>`), and buys what you'd rather not be asked about
 * (`shop:blackrose`). Grubb keeps the curtain to the back room, where a
 * gentleman in grey who calls himself Vane buys curiosities out of the mud and
 * the water, and keeps a ledger of who sells. Midge carries the pots and knows everybody;
 * Silas Crane plays dice with loaded bones; Hollis, thrown out of Saint
 * Elda's, will tell what he read there for a drink; Old Sedge talks of the
 * lights out on the fen; and Dunn and Ferret off the wharf are spoiling for
 * trouble. Under all of it, what they say adds up: sealed crates coming in off
 * the fen at night, a drowned church out in the marsh, and new silver from
 * somewhere. (Nobody here knows of the orb, and nobody is told.)
 */

const coinText = (n: number) => `${n} coin${n === 1 ? '' : 's'}`;
const pickOne = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

/** Where the hero stands with the story, for the Rose's talk. */
export interface RoseNews {
  /** The goblins burnt the farm in the Hollow (dialogue/afterRaid.ts). */
  raidOver: boolean;
  /** The hero's mother is dead and buried. */
  bereaved: boolean;
  /** The great white wolf on Adowvale Plains is dead, by the hero's hand. */
  slewWolfMother: boolean;
}

// ---------------------------------------------------------------- the Widow

export interface WidowState {
  first: boolean;
  coins: number;
  renting: boolean;
  nightsLeft: number;
  /** Past midnight, before dawn. */
  late: boolean;
  /** The hero may go through the curtain into the back room. */
  backOk: boolean;
  news: RoseNews;
  /** Her errand about Tam Rudd, who owes her three silver (see dialogue/shambles.ts), and how it went. */
  tam?: WidowTam;
  tamFate?: TamFate;
}

/** What the Widow has heard, depending on how far the hero has got. */
export function widowRumours(n: RoseNews): string[] {
  const lines = [
    "Boats go out into the fen after dark that have no business there. They come back lighter. I don't ask. Nobody asks. That's why they drink here.",
    'The eel-catchers have stopped going out past the old causeway. Three boats in a month came back empty. Not empty of eels. Empty.',
    "The gate's doubled its men since harvest. Rag-and-bone, the lot of them, but they're paid in silver now. I'd like to know whose.",
    'A crate came up the river last week, nailed shut and sealed with my own rose. I did not seal it. Think on that, while you drink.',
  ];
  if (n.raidOver) lines.push("Goblins burnt a farm up Adowvale way, I hear. Goblins don't burn farms. Goblins steal hens. Somebody told them to.");
  if (n.slewWolfMother) lines.push('They say a lad from Adowvale killed the white wolf on the plains. Half my room wants to buy him a drink. The other half wants to know what he charges.');
  return lines;
}

/** What to ask the Widow about Tam Rudd, as her errand stands. */
function tamChoice(s: WidowState): DialogueChoice[] {
  switch (s.tam) {
    case 'none':
      return [{ text: 'The notice outside. Tam Rudd, three silver?', next: 'tam-ask' }];
    case 'asked':
      return [{ text: 'About Tam Rudd...', next: 'tam-still' }];
    case 'report':
      return [{ text: 'About Tam Rudd.', next: 'tam-report', key: true }];
    default:
      return [];
  }
}

export function widowScript(s: WidowState): DialogueScript {
  const drinkChoices: DialogueChoice[] = [...ROSE_DRINKS, ...ROSE_FOOD].map((id) => {
    const m = ROSE_MENU[id]!;
    const ok = s.coins >= m.price;
    return { text: `${m.name} (${coinText(m.price)})`, action: ok ? `rose-drink:${id}` : undefined, next: ok ? undefined : 'short' };
  });
  const rentChoices = (next: string): DialogueChoice[] =>
    ROSE_RENT.map((o) => {
      const ok = s.coins >= o.price;
      return { text: `${o.label}: ${coinText(o.price)}`, action: ok ? `rose-rent:${o.nights}` : undefined, next: ok ? next : 'short-room' };
    });

  return {
    start: s.first ? 'greet' : s.late ? 'late' : 'again',
    nodes: {
      ...widowTamNodes(s.tamFate ?? 'hiding'),
      greet: {
        speaker: 'thorne',
        lines: [
          "(She doesn't look up from the tankard she's polishing.) Wipe your feet. The marsh comes in on everyone's boots and I'm the one who has to look at it.",
          'This is the Black Rose. I am Mrs Thorne. Widow Thorne, to those who want something. You look like you want something.',
          "Ale, cider, a bed, or the door. I don't do conversation, and I don't do tick.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'thorne',
        lines: [pickOne(['You again. Well?', `${HERO_NAME}. Still alive, then.`, '(She sets the tankard down.) What will it be?'])],
        next: 'ask',
      },
      late: {
        speaker: 'thorne',
        lines: ["(She is still behind the bar, still polishing, as if she never sleeps.) It's the dead hours. Drink quietly or go to bed."],
        next: 'ask',
      },
      ask: {
        speaker: 'thorne',
        lines: ['Well?'],
        choices: [
          { text: "I'll have a drink. Or something to eat.", next: 'drinks' },
          { text: 'Do you buy things? Or sell them?', action: 'shop:blackrose' },
          s.renting ? { text: 'About my room...', next: 'room-have' } : { text: 'Do you have a room?', next: 'rooms' },
          ...tamChoice(s),
          { text: "What's behind the curtain?", next: s.backOk ? 'curtain-ok' : 'curtain' },
          { text: 'Heard anything?', next: 'news' },
          { text: 'Tell me about Gloomhaven.', next: 'town' },
          { text: 'Why the Black Rose?', next: 'name' },
          { text: 'Goodbye, Mrs Thorne.', next: 'bye' },
        ],
      },
      drinks: {
        speaker: 'thorne',
        lines: [`Black ale's ${coinText(ROSE_MENU.ale!.price)}, and worth it. Cider's ${ROSE_MENU.cider!.price}. The mulled wine's ${ROSE_MENU['spiced-wine']!.price}, and there's eel in the pot.`],
        choices: [...drinkChoices, { text: 'Changed my mind.', next: 'ask' }],
      },
      short: {
        speaker: 'thorne',
        lines: ["You're short. I said I don't do tick. I don't do charity either. There's rainwater in the bucket, if you're desperate."],
        next: 'ask',
      },
      rooms: {
        speaker: 'thorne',
        lines: [
          `One room to let, second door at the top of the stairs. ${coinText(ROSE_RENT[0].price)} the night, ${ROSE_RENT[1].price} for three. The others are taken, and their occupants don't like to be disturbed.`,
          `The bed's dry, mostly. There's a bucket for the leak and a pot for the rest. Out by ${10} on your last morning, or Grubb helps you.`,
        ],
        choices: [...rentChoices('rented'), { text: 'Not just now.', next: 'ask' }],
      },
      rented: {
        speaker: 'thorne',
        lines: [
          '(She takes the coin, bites it, and drops a black iron key on the bar.) Second door. Wedge the chair under the handle. The lock is more of a suggestion.',
          "And if you hear anyone walking about in the passage at night, you don't.",
        ],
        next: 'ask',
      },
      'short-room': {
        speaker: 'thorne',
        lines: ["Then you'll sleep in the street with everyone else who was short. One night is cheaper."],
        next: 'ask',
      },
      'room-have': {
        speaker: 'thorne',
        lines: [`It's yours ${s.nightsLeft === 1 ? 'for tonight' : `for ${s.nightsLeft} more nights`}. Want it longer?`],
        choices: [...rentChoices('extended'), { text: "No, that's all.", next: 'ask' }],
      },
      extended: {
        speaker: 'thorne',
        lines: ["Done. Same room. Same leak."],
        next: 'ask',
      },
      curtain: {
        speaker: 'thorne',
        lines: [
          "The back room. For friends of the house.",
          `Grubb decides who's a friend. Grubb is fond of coin. ${coinText(BACK_ROOM_FEE)} usually makes a friend of him.`,
        ],
        next: 'ask',
      },
      'curtain-ok': {
        speaker: 'thorne',
        lines: ["You've been through already. Whatever you saw back there, you didn't see it in my house."],
        next: 'ask',
      },
      news: {
        speaker: 'thorne',
        lines: [pickOne(widowRumours(s.news))],
        next: 'ask',
      },
      town: {
        speaker: 'thorne',
        lines: [
          "Gloomhaven. River on one side, marsh on the other, and a wall round the rest to keep out whatever the marsh hasn't drowned.",
          "It was a port once, when the river ran deeper. Now it's a place people end up. Nobody comes here on purpose. Except the ones with crates.",
          "Keep to the boards after dark, stay off the causeway, and if you see a light out on the fen, don't follow it. That's all the welcome you'll get.",
        ],
        next: 'ask',
      },
      name: {
        speaker: 'thorne',
        lines: [
          '(For a moment she stops polishing.) My husband planted a rose by that door the year we married. It came up black. Everyone said it was the soil.',
          'He went out on the fen the winter after, following a light. They never found him. The rose has come up black every year since.',
          "I wear one, so nobody forgets. Least of all me. ...Was there anything else?",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'thorne',
        lines: [pickOne(["Mind the step. It's rotten.", 'Shut the door behind you. The damp gets in.', "(She doesn't look up.)"])],
      },
    },
  };
}

// ---------------------------------------------------------------- Grubb

export function grubbScript(first: boolean, backOk: boolean, coins: number): DialogueScript {
  return {
    start: backOk ? 'friend' : first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'grubb',
        lines: ['(A man the size of a door steps in front of the curtain. He looks down at you for a long time.)', 'No.'],
        next: 'ask',
      },
      again: { speaker: 'grubb', lines: ['Still no.'], next: 'ask' },
      friend: {
        speaker: 'grubb',
        lines: [pickOne(['(He steps aside from the curtain, just enough.) In.', "Go on. Wipe your feet. She'll have my hide.", '(He grunts, and lifts the curtain for you with the end of his cudgel.)'])],
      },
      ask: {
        speaker: 'grubb',
        lines: ["Back room's for friends."],
        choices: [
          { text: 'How do I become a friend?', next: 'fee' },
          { text: 'What happened to your nose?', next: 'nose' },
          { text: "Who's back there?", next: 'who' },
          { text: 'Never mind.', next: 'bye' },
        ],
      },
      fee: {
        speaker: 'grubb',
        lines: [`${coinText(BACK_ROOM_FEE)}.`, '(He holds out a hand like a shovel.)'],
        choices: [
          coins >= BACK_ROOM_FEE
            ? { text: `Pay him ${coinText(BACK_ROOM_FEE)}.`, action: 'rose-pay-grubb', next: 'paid' }
            : { text: "I haven't got that much.", next: 'poor' },
          { text: "That's robbery.", next: 'robbery' },
        ],
      },
      paid: {
        speaker: 'grubb',
        lines: ['(He counts it twice, slowly, moving his lips.) Friend.', '(He steps aside from the curtain.)'],
      },
      poor: { speaker: 'grubb', lines: ['Then no.'] },
      robbery: { speaker: 'grubb', lines: ['(He thinks about this.) Yes.', 'Still five.'], next: 'ask' },
      nose: {
        speaker: 'grubb',
        lines: ['Door.', '(A pause.)', 'I was the door.'],
        next: 'ask',
      },
      who: {
        speaker: 'grubb',
        lines: ["Gentleman. Pays the Widow. Pays me. Doesn't like questions.", "(He looks at you.) I don't like questions either."],
        next: 'ask',
      },
      bye: { speaker: 'grubb', lines: ['(He folds his arms and goes back to being a wall.)'] },
    },
  };
}

// ---------------------------------------------------------------- Midge

export function midgeScript(first: boolean, coins: number): DialogueScript {
  const orders: DialogueChoice[] = (['ale', 'stew'] as ItemId[]).map((id) => {
    const m = ROSE_MENU[id]!;
    const ok = coins >= m.price;
    return { text: `${m.name} (${coinText(m.price)})`, action: ok ? `rose-order:${id}` : undefined, next: ok ? 'fetching' : 'skint' };
  });
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'midge',
        lines: [
          "Ooh, a new face! Don't get many of them. Get lots of old ones. Some of them are VERY old. I'm Midge. I do the pots.",
          "You want to keep your hand on your purse in here, mister. Not 'cause of me! I'm honest. Mostly. 'Cause of him.",
          '(She jerks her head towards a thin man at the trestle, who is cleaning his nails with a knife.)',
        ],
        next: 'ask',
      },
      again: { speaker: 'midge', lines: [pickOne(["Back again! You must like it here. Nobody likes it here.", 'Mind the puddle! No, the other puddle.', "Wotcher, mister."])], next: 'ask' },
      ask: {
        speaker: 'midge',
        lines: ['What d\'you want?'],
        choices: [
          { text: "Who's who in here?", next: 'who' },
          { text: 'Could you bring me something?', next: 'order' },
          { text: 'Do you live here?', next: 'home' },
          { text: "What's in the back room?", next: 'back' },
          { text: 'See you, Midge.', next: 'bye' },
        ],
      },
      who: {
        speaker: 'midge',
        lines: [
          "Mrs Thorne owns it. She's all right. She don't hit. Grubb's on the curtain; he's all right too if you don't make him think.",
          "Old Sedge by the fire, she catches eels and talks to 'em. Hollis in the booth used to be a monk till they caught him reading. Silas with the patch plays dice. Don't play dice with Silas.",
          "Dunn's the big one, Ferret's the one with the knife. They work for the gate, sort of. They hurt people for money, sort of. Don't be people.",
        ],
        next: 'ask',
      },
      order: {
        speaker: 'midge',
        lines: ["Course! There's black ale, or there's eel. The eel's from today. Probably."],
        choices: [...orders, { text: 'Never mind.', next: 'ask' }],
      },
      fetching: { speaker: 'midge', lines: ['Back in a tick!'] },
      skint: { speaker: 'midge', lines: ["You're skint! Join the club. It's got no members 'cause nobody can pay the fee."], next: 'ask' },
      home: {
        speaker: 'midge',
        lines: [
          "Up in the roof, over the kitchen. It's warm 'cause of the chimney. Mrs Thorne found me under the jetty when I was little and said I could stay if I worked.",
          "I don't remember before. Sedge says my mam went out on the fen after a light. Sedge says that about everyone's mam.",
        ],
        next: 'ask',
      },
      back: {
        speaker: 'midge',
        lines: [
          "(She goes quiet, which is the first time.) There's a man in grey in there of a night. He gives me a silver penny every time I bring his wine and he never drinks it.",
          "He's got a box that's cold. I touched it once. My fingers went numb all night, and I dreamed about someone looking at me. Not from anywhere. Just looking.",
          "...Don't tell Mrs Thorne I said.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'midge', lines: ['Bye! Mind the step, it\'s rotten. Everything\'s rotten.'] },
    },
  };
}

// ---------------------------------------------------------------- Silas

export function silasScript(first: boolean, coins: number, wonOff: boolean, caught: boolean): DialogueScript {
  const play: DialogueChoice =
    coins >= SILAS_STAKE
      ? { text: `Play a round of dice (${coinText(SILAS_STAKE)}).`, action: 'rose-dice' }
      : { text: "I'd play, but I'm short.", next: 'short' };
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'silas',
        lines: [
          '(The one-eyed man rattles a leather cup without looking at it.) Sit, friend, sit. Silas Crane, late of the river trade, presently of this chair.',
          `A little game? ${coinText(SILAS_STAKE)} a throw, high roll takes the pot. Honest bones, honest man. You can ask anyone. Don't ask Midge.`,
        ],
        next: 'ask',
      },
      again: { speaker: 'silas', lines: [pickOne(['My favourite customer.', 'Back for more? I admire that in a man. I profit from it, too.', '(He grins with half his face.) Feeling lucky?'])], next: 'ask' },
      ask: {
        speaker: 'silas',
        lines: ['Well?'],
        choices: [
          play,
          ...(wonOff && !caught ? [{ text: 'Those dice are loaded.', next: 'caught', key: true } as DialogueChoice] : []),
          { text: 'What do you trade on the river?', next: caught ? 'trade-true' : 'trade' },
          { text: 'How did you lose the eye?', next: 'eye' },
          { text: 'Not tonight.', next: 'bye' },
        ],
      },
      short: { speaker: 'silas', lines: ['Then sit and watch, friend. Watching is free. For now.'], next: 'ask' },
      caught: {
        speaker: 'silas',
        action: 'rose-silas-caught',
        lines: [
          "(His smile doesn't move, but his hand does: the cup is suddenly gone under the table.) Loaded? These? Friend, you wound me.",
          `...Hm. Sharp eyes. Both of them, too. Here. (He slides ${coinText(SILAS_STAKE)} back across the table.) No hard feelings. Honest bones from now on. My hand on my heart.`,
          "And since we're friends now: you want to know what I really carry upriver? Ask me.",
        ],
        next: 'ask',
      },
      trade: {
        speaker: 'silas',
        lines: ['Salt fish. Barrels of it. Very dull. Ask me something more interesting.'],
        next: 'ask',
      },
      'trade-true': {
        speaker: 'silas',
        lines: [
          '(He leans in, and his breath smells of cloves.) Crates. Nailed and sealed. I take them from a boat out at the old causeway, at night, and I bring them here, and the gentleman in grey pays in silver.',
          "I don't open them. Nobody opens them. One of my lads did, at Harrow Bend, and he went quiet after. Sat in the boat staring at nothing. Walked into the river at dawn like he'd been called.",
          'He never did say what he saw. Only that it was cold. Colder than the river.',
        ],
        next: 'ask',
      },
      eye: {
        speaker: 'silas',
        lines: [
          'Bet it. On a pair of threes. Fellow had a pair of fours.',
          "(He taps the patch.) He's still got both his. Doesn't use them much, mind. Not where he is.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'silas', lines: ['The bones will be here, friend. So will I. One of us is honest.'] },
    },
  };
}

// ---------------------------------------------------------------- Hollis

export function hollisScript(first: boolean, coins: number, told: boolean): DialogueScript {
  const buy: DialogueChoice =
    coins >= HOLLIS_DRINK ? { text: `Buy him a drink (${coinText(HOLLIS_DRINK)}).`, action: 'rose-buy-hollis', next: told ? 'thanks' : 'book' } : { text: "I can't stand you a drink.", next: 'dry' };
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'hollis',
        lines: [
          '(A grey, unshaven man in the rags of a monk\'s habit squints up at you over his tankard.) Pax tecum. Peace be with you. That\'s Latin. I used to know a great deal of Latin.',
          "Brother Hollis. Formerly of Saint Elda's. Formerly of a great many things. Presently of this booth, which I will defend to the death.",
        ],
        next: 'ask',
      },
      again: { speaker: 'hollis', lines: [pickOne(['Ah. My confessor returns.', '(He raises his tankard, finds it empty, and looks at it betrayed.)', 'Pax. Sit, sit.'])], next: 'ask' },
      ask: {
        speaker: 'hollis',
        lines: [told ? 'More questions? Questions are thirsty work.' : 'A man could tell you a thing or two. A thirsty man tells it slower.'],
        choices: [
          buy,
          { text: "Why did they throw you out of Saint Elda's?", next: 'why' },
          ...(told ? [{ text: 'Tell me again about the drowned kingdom.', next: 'book-again' } as DialogueChoice] : []),
          { text: 'Goodbye, Brother.', next: 'bye' },
        ],
      },
      dry: { speaker: 'hollis', lines: ['Then we shall sit in silence, like the Carthusians. I was never very good at being a Carthusian.'], next: 'ask' },
      thanks: { speaker: 'hollis', lines: ['Deo gratias. And you. Mostly you.'], next: 'ask' },
      why: {
        speaker: 'hollis',
        lines: [
          'Reading. I was the under-librarian. There is a press at the bottom of the library that is always locked, and I had the key, and I was curious. Curiosity is a sin. So is drink. I collect them.',
          "Prior Benedict burned the book in front of the chapter, and then he burned my habit, though I was still wearing most of it. He's a hard man, but he wasn't wrong.",
        ],
        next: 'ask',
      },
      book: {
        speaker: 'hollis',
        action: 'rose-hollis-book',
        lines: [
          '(He drinks half of it at once, and wipes his mouth.) The book. Yes. "Of the Drowned Kingdom." Very old, older than the abbey. It came out of the fens.',
          'Before the sea came in, there were kings out there, on the fen. Rich. Proud. They built a great church of black stone on the Long Mere, with a bell you could hear in Adowvale.',
          'Then the sea came in, in one night, and took the lot of them. The book said the church is still down there, whole, and the bell still rings when the tide is wrong. And that the kings did not drown so much as... wait.',
          "Fairy tales, the Prior said. Then why burn it? You don't burn a fairy tale. You burn a map.",
        ],
        next: 'ask',
      },
      'book-again': {
        speaker: 'hollis',
        lines: [
          'Kings on the fen, a church of black stone, and the sea in one night. The church is still down there. Whole.',
          "There were drawings in the margins, of men in boats, rowing out to it at low water, with lanterns. Recent ink. That's what frightened me, at the time.",
          "...It still does, rather.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'hollis', lines: ['Dominus vobiscum. And keep away from the lights on the fen.'] },
    },
  };
}

// ---------------------------------------------------------------- Old Sedge

export function sedgeScript(first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'sedge',
        lines: [
          "(A tiny old woman by the fire takes her pipe out of her gums and looks you up and down with eyes like a heron's.) Hah. Upriver boy. You've the smell of hay on you.",
          "Sit, if you like. I'm Sedge. I catch eels. Been catching 'em seventy year. They don't like me, and I don't like them, and that's fair dealing.",
        ],
        next: 'ask',
      },
      again: { speaker: 'sedge', lines: [pickOne(['Hah. Hay-boy.', "Sit down, you're blocking the fire.", '(She puffs, and says nothing, and then says:) Well?'])], next: 'ask' },
      ask: {
        speaker: 'sedge',
        lines: ['What is it?'],
        choices: [
          { text: 'Tell me about the lights on the fen.', next: 'lights' },
          { text: 'What happened to the eel-catchers?', next: 'catchers' },
          { text: 'Is there a church out in the marsh?', next: 'church' },
          { text: 'Leave her to her pipe.', next: 'bye' },
        ],
      },
      lights: {
        speaker: 'sedge',
        lines: [
          "Corpse-candles, my mam called 'em. Little lights, out over the reeds, of a night. Green as rot. They go against the wind, which no honest light does.",
          "You see one, you look away. You follow one, you don't come back. That's all there is. Folk make it more complicated 'cause they want it to be.",
          "...Only, there's more of 'em this year than I ever saw. And they've started coming closer.",
        ],
        next: 'ask',
      },
      catchers: {
        speaker: 'sedge',
        lines: [
          "Gone out past the causeway. Gone where the eels are fattest, which is where the drowned things lie, which is why they're fat.",
          "Hob Tanner's boat came back on the tide with his traps in it, and his pipe, still warm. No Hob. Same with the Marigold. Same with the Ashby boys.",
          'The frogs stop, before. You listen for the frogs. When the frogs stop all at once, you row home, and you don\'t look behind you.',
        ],
        next: 'ask',
      },
      church: {
        speaker: 'sedge',
        lines: [
          "Hah. Who told you that? The monk? (She spits into the fire.) There's a bell-tower sticks out of the water at the far end of the Long Mere. Black stone. No church under it you can see.",
          'At low water you can row right up to it and look down, and there\'s windows, under the water. Big ones. And there\'s light in them, some nights. Green.',
          "Nobody goes there. Some people go there. Them with crates.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'sedge', lines: ['(She puts the pipe back in her gums and turns back to the fire.)'] },
    },
  };
}

// ---------------------------------------------------------------- Dunn and Ferret

export function ferretScript(first: boolean, n: RoseNews): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'ferret',
        lines: [
          '(The thin man looks up from his nails, and smiles with too many teeth.) Well, well. Fresh off the boat. Nice boots. Nice satchel. Shame about the face.',
          'Dunn. Dunn. Look. Lost lamb.',
        ],
        next: 'dunn',
      },
      dunn: {
        speaker: 'dunn',
        lines: ['(The big man looks at you. He keeps looking. Then he drinks.) Mm.'],
        next: 'ask',
      },
      again: { speaker: 'ferret', lines: [pickOne(["Lamb's back.", "Something you want, lamb? Something you'd like to give us?", '(He flicks the knife round in his fingers.) Hello again.'])], next: 'ask' },
      ask: {
        speaker: 'ferret',
        lines: ['Well?'],
        choices: [
          { text: 'Say that again.', next: n.slewWolfMother ? 'wolf' : 'brave' },
          { text: 'Who do you work for?', next: 'work' },
          { text: "I hear someone's asking about people from Adowvale.", next: 'asking', key: true },
          { text: 'Leave it.', next: 'bye' },
        ],
      },
      brave: {
        speaker: 'ferret',
        lines: [
          '(He stands up. So does Dunn, which takes longer and goes higher.) Ooh. Brave lamb.',
        ],
        next: 'brave-dunn',
      },
      'brave-dunn': {
        speaker: 'dunn',
        lines: ['(A huge hand settles on Ferret\'s shoulder.) Widow\'s watching.', '(Behind the bar, Mrs Thorne has stopped polishing.)'],
        next: 'brave-end',
      },
      'brave-end': {
        speaker: 'ferret',
        lines: ['(He sits, slowly, still smiling.) Another time, lamb. Outside. Gloomhaven\'s full of dark corners.'],
      },
      wolf: {
        speaker: 'dunn',
        lines: [
          '(Dunn puts his tankard down, and looks at you properly for the first time.) Ferret. That\'s him. The Adowvale one. Did for the white wolf on the plains. Bare-handed, they say.',
        ],
        next: 'wolf-ferret',
      },
      'wolf-ferret': {
        speaker: 'ferret',
        lines: ["(The knife stops moving.) ...Is it, now. Well. No offence meant, friend. Just our way. Drink's on Dunn."],
        next: 'ask',
      },
      work: {
        speaker: 'ferret',
        lines: [
          "Whoever's paying. Right now that's the lads on the gate, who pay us to see that nobody goes out it who shouldn't, and that's whoever they say.",
          "And sometimes the gentleman in the back, who pays us to see that boats get unloaded quiet. He pays better. In silver. New silver.",
        ],
        next: 'ask',
      },
      asking: {
        speaker: 'ferret',
        lines: [
          '(He glances at the curtain, and lowers his voice.) The grey one. Asks everyone off the river what they\'ve pulled up out of the mud. Old things. Pays in new silver, and writes your name down when he does.',
          "Don't know who he buys for. Don't want to. Man like that, you don't want him wanting you.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'ferret', lines: ['Mind how you go, lamb. Mind every step.'] },
    },
  };
}

export function dunnScript(first: boolean, coins: number): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'dunn',
        lines: ['(The big man looks at you over his tankard. His knuckles are scabbed.) ...What.'],
        next: 'ask',
      },
      again: { speaker: 'dunn', lines: ['Mm.'], next: 'ask' },
      ask: {
        speaker: 'dunn',
        lines: ['(He waits.)'],
        choices: [
          coins >= 2 ? { text: 'Arm-wrestle me. Two coins.', action: 'rose-armwrestle' } : { text: "I'd arm-wrestle you, but I'm skint.", next: 'skint' },
          { text: 'What do you do?', next: 'do' },
          { text: 'Nothing.', next: 'bye' },
        ],
      },
      skint: { speaker: 'dunn', lines: ['(He looks at your arm, then his, and laughs. It goes on a while.)'] },
      do: { speaker: 'dunn', lines: ['Lift things.', '(He thinks.)', 'People, sometimes.'], next: 'ask' },
      bye: { speaker: 'dunn', lines: ['Mm.'] },
    },
  };
}

// ---------------------------------------------------------------- Vane

export function vaneScript(first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'vane',
        lines: [
          '(The man in grey does not look up from his ledger. When he speaks, his voice is soft, and very clear.) You have paid Grubb, so you are a friend of the house. Sit, if you wish.',
          'My name is Vane. I buy curiosities. Old things, out of the ground and out of the water. Have you anything curious?',
        ],
        next: 'ask',
      },
      again: { speaker: 'vane', lines: ['(He turns a page.) You are back.'], next: 'ask' },
      ask: {
        speaker: 'vane',
        lines: ['What do you want?'],
        choices: [
          { text: 'Who do you buy for?', next: 'who' },
          { text: "What's in the crate in the corner?", next: 'crate' },
          { text: "I haven't got anything you'd want.", next: 'nothing' },
          { text: 'Leave him to his ledger.', next: 'bye' },
        ],
      },
      who: {
        speaker: 'vane',
        lines: ['For a collector, a long way from here, with a long memory and a great deal of new silver.', '(He smiles without showing his teeth.) He does not care to be named. Patience is the only virtue that pays.'],
        next: 'ask',
      },
      crate: {
        speaker: 'vane',
        lines: ['Salt fish.', '(The candle gutters, although there is no draught.) You should not stand so close to it.'],
        next: 'ask',
      },
      nothing: {
        speaker: 'vane',
        lines: ["No. Not yet. But you've a look about you of someone who goes down into places. If you ever bring anything up, I pay better than anyone on this river."],
        next: 'ask',
      },
      bye: { speaker: 'vane', lines: ['(He goes back to his ledger as if you had never been there.)'] },
    },
  };
}

// ---------------------------------------------------------------- chatter

/** The regulars' talk among themselves, overheard. */
export const ROSE_CHATTER: Array<Array<[SpeakerId, string]>> = [
  [['ferret', "Dunn. Dunn. Bet you can't drink that in one."], ['dunn', '(He drinks it in one.)'], ['ferret', "...I didn't actually have the money."]],
  [['silas', 'Hollis! A throw, for old times?'], ['hollis', 'I have taken a vow against gambling.'], ['silas', 'Since when?'], ['hollis', 'Since you.']],
  [['sedge', "Frogs were quiet last night."], ['hollis', '(He crosses himself, badly.)'], ['ferret', "Frogs. Ha. Scared of frogs."], ['sedge', "You will be, boy."]],
  [['midge', 'Mrs Thorne, the bucket by the post is full again.'], ['thorne', 'Then empty it.'], ['midge', 'Into what?'], ['thorne', 'The other bucket.']],
  [['dunn', 'Widow. Another.'], ['thorne', 'Pay for the last one, Dunn.'], ['dunn', '...Mm.']],
  [['silas', 'Pair of sixes. Again. The saints love me tonight.'], ['ferret', 'The saints have got nothing to do with it.'], ['silas', '(He smiles.) Nor have you, Ferret.']],
  [['hollis', 'In nomine Patris...'], ['thorne', 'Not in my bar, Hollis.'], ['hollis', 'Sorry, Mrs Thorne.']],
  [['midge', 'Grubb, what happened to your nose?'], ['grubb', 'Door.'], ['midge', 'You always say that.'], ['grubb', 'Always a door.']],
  [['ferret', "Saw lights out on the Long Mere again."], ['sedge', 'Then you looked. More fool you.']],
];

/** What they mutter to nobody in particular. */
export const ROSE_MUTTERS: Partial<Record<SpeakerId, string[]>> = {
  thorne: ['(She polishes the same tankard.)', 'Feet.', "Grubb. The door."],
  midge: ['Pots, pots, pots...', "Nobody goes in the cellar. Nobody. Mrs Thorne says.", 'Mind your feet, mister!', "Who's spilt this? Again?"],
  hollis: ['...et ne nos inducas...', 'Is this empty? This is empty.', 'Can you hear a bell? No? Good.'],
  sedge: ['(Puff.) Hah.', 'Tide turns at midnight.', 'Frogs, listen to the frogs...'],
  silas: ['Come on, come on...', 'Bones, bones, be kind.', 'Who wants to lose some money?'],
  ferret: ['(He flicks the knife round his fingers.)', "Pretty boots in here tonight.", "Dunn. Dunn. Look."],
  dunn: ['Mm.', '(He cracks his knuckles, one by one.)'],
  grubb: ['(He shifts his weight. The floor creaks.)'],
};

/** When the room is full, someone raises a tankard. */
export const ROSE_TOASTS = ['To the Rose!', 'To the drowned!', 'Damn the damp!', 'Another!', "To the Widow's health, and her ale's!"];

/** What comes to mind sitting at the Rose's tables. */
export const ROSE_SITTING_THOUGHTS: Record<string, string[]> = {
  'rose-table': [
    'Someone has carved a rose into the table, and under it: "SHE SEES ALL." Under that, smaller: "the widow I mean."',
    'The table is wet. I do not know with what. I keep my sleeves off it.',
    'Somewhere a drip hits a bucket, over and over. Plink. Plink. Plink.',
  ],
  'rose-bar': [
    'The Widow polishes the same tankard. Her eyes never stop moving round the room.',
    'Under the bar-top, by my knee, my fingers find a row of notches cut into the wood. Dozens of them.',
  ],
  'rose-booth': [
    "Hollis's book lies open on the table, upside down. The page is a picture of a church with water to its windows.",
    'The settle\'s high back keeps the draught off. It smells of old ale and older smoke.',
  ],
  'rose-dice': [
    "Silas rattles his cup without looking at it. His one eye is on everybody else's coin.",
    'There is a chalk circle on the table for the dice. Someone has drawn a tiny eye in the middle of it.',
  ],
  'rose-card': [
    'The candle on the card table burns perfectly still, even when the curtain stirs.',
    'Across the table, the crate in the corner gives off its faint green light. I find I keep looking at it.',
  ],
};

/** What's said for the hero, ordered from Midge and brought to the table, in passing. */
export function servedLine(id: ItemId): string {
  return ROSE_MENU[id]?.served ?? `One ${itemDef(id).name.toLowerCase()}.`;
}
