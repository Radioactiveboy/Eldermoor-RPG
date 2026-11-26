import type { DialogueChoice, DialogueScript } from './Dialogue';

/**
 * The Shambles, Gloomhaven's east quarter (world/ShamblesMap.ts,
 * scenes/game/shambles.ts): Saul Rendle, "the Gaffer", who leads the Red
 * Aprons from behind the counter of his slaughterhouse; Morrow Vetch the
 * tanner, who lets them have his barn; Ned Flay, who runs the dog pit in it,
 * and Lugs, who minds the dogs; Gristle, a knacker of few words; Old Scritch
 * the rat-catcher, whose dog is missing; and Tam Rudd, hiding in the tannery
 * loft from everyone he owes.
 *
 * Two stories run through them. "Answers to Nothing": Scritch's grey lurcher
 * is in Flay's barn as new stock for the pit, and the hero can buy her, fight
 * for her, or talk Lugs into leaving her pen open. "Pay or Swim": the Widow
 * Thorne wants the three silver Tam owes the Rose, and the hero can find him
 * and settle it: send him to work it off, pay it, get him rowed away, or sell
 * his hiding place to Rendle.
 *
 * Nobody here knows anything about the orb. The gangs know only that the
 * Reeve has "a new friend with deep pockets".
 */

/** What Tam owes the Rose: three silver, in coin. */
export const TAM_DEBT = 30;
/** What Flay will take for the grey dog. */
export const NOTHING_PRICE = 30;
/** What Rendle pays for knowing where Tam is. */
export const TAM_BOUNTY = 12;
/** What it costs to have Cray row Tam away downriver, at night, no questions. */
export const TAM_FARE = 8;
/** Scritch's thanks, and the Widow's. */
export const SCRITCH_REWARD = 15;
export const WIDOW_TAM_REWARD = 10;

/** How Scritch's dog stands: not asked yet, being looked for, home but he's not been told, or done. */
export type NothingStage = 'none' | 'asked' | 'free' | 'done';
/** How it went: bought off Flay, fought for, or let out by Lugs. */
export type NothingHow = 'bought' | 'fought' | 'lugs' | undefined;
/** Where Tam is: hiding in the loft, or gone one of four ways. */
export type TamFate = 'hiding' | 'potboy' | 'paid' | 'rowed' | 'sold';

const coinText = (n: number) => `${n} coin${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------------------
// Old Scritch, the rat-catcher
// ---------------------------------------------------------------------------

export interface ScritchState {
  first: boolean;
  stage: NothingStage;
  how: NothingHow;
  lugs: boolean;
}

export function scritchScript(s: ScritchState): DialogueScript {
  const ask: DialogueChoice[] = [];
  if (s.stage === 'none') ask.push({ text: 'The notice on the square. A grey dog. Is she yours?', next: 'dog', key: true });
  if (s.stage === 'asked') ask.push({ text: 'About Nothing...', next: 'still', key: true });
  if (s.stage === 'free') ask.push({ text: "She's home. Nothing's home.", next: 'home', key: true });
  ask.push(
    { text: 'Rats, then?', next: 'rats' },
    { text: 'Who buys rats?', next: 'buyers' },
    { text: 'Goodbye.', next: 'bye' },
  );
  const thanks: Record<NonNullable<NothingHow>, string> = {
    bought: "You paid Ned Flay for her? Paid him? (He shakes his head, and keeps shaking it.) He'll have told everyone in the Shambles there's a soft touch about. Well. I'm glad of it. I'm glad of you.",
    fought: "Lugs came by and told me. Ned Flay and the big one, on the floor of their own barn. (He laughs, a dry little cough of a laugh.) Rendle won't forget that. Nor will I. Watch yourself on the lane after dark.",
    lugs: "And the lad, Lugs, came with her. Stood in my door with his great ears red and said he wasn't going back, and could he learn ratting. (He sniffs.) He's soft with the dogs and he's afraid of the rats. He'll do.",
  };
  return {
    start: s.first ? 'greet' : s.stage === 'free' ? 'home-start' : 'again',
    nodes: {
      greet: {
        speaker: 'scritch',
        lines: [
          "(An old man, bent almost double, looks up from a cage of rats he's sorting by the tail.) Mind the jars. The one by your elbow would kill a horse. Has done.",
          "Scritch. Rat-catcher to the Shambles, and the Staithe, and the Reeve's own cellars when he remembers to pay. Forty years. I've caught more rats than there are people in this town, and liked most of them better.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'scritch',
        lines: [s.stage === 'done' ? (s.lugs ? "(Lugs is at the cages, holding a rat at arm's length. Scritch winks at you.) Come in, come in. Mind the dog." : '(The grey dog by the stove lifts her head, and puts it down again.) Come in. Mind the dog.') : "(He doesn't look up.) Back again. Shut the door, the draught gets in the cages."],
        next: 'ask',
      },
      'home-start': {
        speaker: 'scritch',
        lines: ["(He's on his knees by the stove with his arms round the grey dog's neck, and he doesn't get up when you come in.)"],
        next: 'home',
      },
      ask: {
        speaker: 'scritch',
        lines: ['Well?'],
        choices: ask,
      },
      dog: {
        speaker: 'scritch',
        lines: [
          "(He stops sorting.) Mine. Her name's Nothing. Lurcher, grey, long in the leg, a white blaze on her chest like a spill of milk. Best ratter on the river, and she's never bitten anyone that didn't have it coming. I put 'bites' on the notice so nobody'd keep her.",
          "\"Answers to nothing\". That's the joke, see. You shout \"Nothing!\" and she comes. People think I'm mad. They thought that anyway.",
          "Gone eight days. She never strays. Not ever. Somebody's took her. And I've a fair notion who'd want a dog like her, and what for, and I'm too old and too small to go asking.",
        ],
        choices: [
          { text: "I'll look for her.", next: 'look', action: 'nothing-accept', key: true },
          { text: 'Who would want her?', next: 'who' },
          { text: "I can't help you, sorry.", next: 'no' },
        ],
      },
      who: {
        speaker: 'scritch',
        lines: [
          "The Red Aprons. Rendle's lot, the butchers' boys. Ned Flay keeps a pit in Vetch's barn, behind the tannery, and fights dogs in it of a night. Fights them to the death, some nights, when the money's right.",
          "A lurcher's no fighting dog. She's all legs and nose. She'd last about as long as it takes them to lay the bets. (He looks at his hands.) They'd put her in first, see. To warm the big ones up.",
        ],
        choices: [
          { text: "I'll look for her.", next: 'look', action: 'nothing-accept', key: true },
          { text: "I can't help you, sorry.", next: 'no' },
        ],
      },
      look: {
        speaker: 'scritch',
        lines: [
          "(He looks at you for a long moment.) You would? (He wipes his nose on his sleeve.) Then look in Flay's barn. And if she's not there, look in the river. And if she's in the river, don't tell me. Just say you never found her.",
          "I've not much. But what I've got's yours if you bring her home.",
        ],
      },
      no: {
        speaker: 'scritch',
        lines: ["No. No, why would you. (He goes back to his rats.)"],
      },
      still: {
        speaker: 'scritch',
        lines: ["(He looks up quickly, and reads your face, and looks down again.) Not yet, then. Her bowl's full. I keep it full."],
        next: 'ask',
      },
      home: {
        speaker: 'scritch',
        lines: [
          s.how ? thanks[s.how] : "She came scratching at the door at first light, thin as a lath. Ate everything. Slept on my feet.",
          `Here. ${coinText(SCRITCH_REWARD)}. It's not what she's worth. Nothing could be. (He hears himself, and wheezes.) Nothing could be. Ha.`,
          "And something else, for nothing. You go about, I've seen you, asking questions. Here's one I can't answer.",
          "Rats go everywhere. Everywhere. Cellars, bilges, the Reeve's bed. But there's crates come in off the fen of a night, sealed with red wax, and the rats won't go near them. Won't cross the floor where they've stood. I found one by a crate in the Staithe last month, a big buck rat, frozen stiff. In August.",
          "I put my hand on that crate. (He holds the hand up: the fingertips are white and shiny, like old burns.) Cold as the bottom of the river. I don't know what's in them. I'd not open one for all the silver in Harrowford.",
        ],
        action: 'nothing-reward',
        next: 'ask',
      },
      rats: {
        speaker: 'scritch',
        lines: [
          "Rats. Brown rats in the cellars, black rats in the thatch, water rats on the Staithe. Ferrets for the holes, traps for the runs, poison for the rest, and a good dog for the ones that bolt.",
          "This town's built on mud and the mud's built on rats. I don't get rid of them. Nobody could. I keep them down to where folk can sleep.",
        ],
        next: 'ask',
      },
      buyers: {
        speaker: 'scritch',
        lines: [
          "Skins go to the glover on the Staithe, for cheap gloves that wear out. Tails go to the Reeve: a farthing a tail, for the flood toll's \"vermin bounty\", which he pays me out of what he took off me at the gate.",
          "And live ones go to Flay's barn, a penny a head, for the ratting. Fifty in the pit with a terrier, and they bet on how long. (He's quiet.) I sell him them. I hate it, and I sell him them. A man's got to eat. Write that on my stone.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'scritch',
        lines: ['Shut the door behind you.'],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Ned Flay, the pit-master
// ---------------------------------------------------------------------------

export interface FlayState {
  first: boolean;
  /** Looking for Scritch's dog, and she's still here. */
  asked: boolean;
  free: boolean;
  how: NothingHow;
  coins: number;
}

export function flayScript(s: FlayState): DialogueScript {
  const ask: DialogueChoice[] = [];
  if (s.asked && !s.free) ask.push({ text: 'The grey dog in the middle pen.', next: 'grey', key: true });
  ask.push(
    { text: "What's on tonight?", next: 'tonight' },
    { text: 'You run this pit?', next: 'pit' },
    { text: 'You wear the yellow, some nights.', next: 'watch' },
    { text: 'Goodbye.', next: 'bye' },
  );
  const buy: DialogueChoice =
    s.coins >= NOTHING_PRICE
      ? { text: `I'll buy her. (${coinText(NOTHING_PRICE)})`, next: 'sold', action: 'nothing-buy', key: true }
      : { text: `I'll buy her. (${coinText(NOTHING_PRICE)}: I haven't enough)`, next: 'short' };
  return {
    start: s.first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'flay',
        lines: [
          "(A long, rangy man with a cropped ginger head and forearms crossed with old bites. He looks you over like a dog at a sale.) Well, here's fresh stock. Wandered in on its own. They never do that.",
          "Ned Flay. I keep the pit. That makes me the most popular man in the Shambles of a Saturday and the least popular any other day. (He grins. His eyes don't.) Betting's after dark. Watching's free. Bleeding's extra.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'flay',
        lines: [s.how === 'bought' ? "Look who it is: my best customer. Come to buy another? I've got a three-legged one you'd love." : "You again. You've got the look of someone who wants to bet and hasn't the stomach."],
        next: 'ask',
      },
      ask: {
        speaker: 'flay',
        lines: ['Well?'],
        choices: ask,
      },
      grey: {
        speaker: 'flay',
        lines: [
          "The lurcher? New stock. A Hook brought her in on a rope, said she'd come off a barge. I gave him a shilling and didn't ask which barge. I never ask which barge.",
          "She's for Saturday. Not to win: to start. You put something quick and frightened in the ring first, it gets the big lads' blood up. (He looks at the pen.) She won't last long. That's the point.",
        ],
        choices: [
          { text: "She's Old Scritch's dog. He wants her back.", next: 'scritch' },
          buy,
          { text: "Let her go, or I'll make you.", next: 'threat', key: true },
          { text: 'Never mind.', next: 'ask' },
        ],
      },
      scritch: {
        speaker: 'flay',
        lines: [
          "Scritch? (He laughs: a noise like a dog being sick.) Then Scritch should've kept her on a string. Finders, keepers. Isn't that right, Lugs? (Over by the pens, Lugs doesn't answer.)",
          "Tell you what, seeing as it's Scritch. She's yours for what she'd earn me on Saturday. Call it three silver.",
        ],
        choices: [
          buy,
          { text: "Let her go, or I'll make you.", next: 'threat', key: true },
          { text: 'Never mind.', next: 'ask' },
        ],
      },
      short: {
        speaker: 'flay',
        lines: ["(He pats your pocket.) That's not three silver. That's a hope and a button. Come back when it's heavier."],
        next: 'ask',
      },
      sold: {
        speaker: 'flay',
        lines: [
          "(He counts it twice, and bites one.) Sold, to the soft touch at the back. Lugs! Open the middle pen and let the gentry's dog go.",
          "(The grey dog is out of the pen and through the barn door before Lugs has the bar off, a grey streak, gone.) There. She knows the way home better than you do. (He tips you a wink with no warmth in it.) Pleasure doing business.",
        ],
      },
      threat: {
        speaker: 'flay',
        lines: [
          "(The jokes go out of him all at once, like a lamp.) Make me. In here? In my barn? (He shrugs the chain off his shoulder and lets it drop.)",
          "Go on, then. It's been a slow week.",
        ],
        choices: [
          { text: 'Fight him.', action: 'pit-fight', key: true },
          { text: '(Back off.) Not today.', next: 'backoff' },
        ],
      },
      backoff: {
        speaker: 'flay',
        lines: ["(The grin comes back.) Thought not. They never do, in the end. Mind the step on your way out."],
      },
      tonight: {
        speaker: 'flay',
        lines: [
          "Tonight? Ratting by the minute: fifty rats and the Butcher, that's Rendle's own terrier, and you bet on the time. Then a proper match, if the Hooks have the nerve to bring their brindle, which they won't.",
          "Saturday's the big one. Saturday there's new stock. (He nods at the pens.)",
        ],
        next: 'ask',
      },
      pit: {
        speaker: 'flay',
        lines: [
          "For the Gaffer. Vetch owns the barn, Rendle owns Vetch, I keep the pit and Lugs keeps the stock. Everyone's happy except the stock.",
          "Don't look like that. You eat mutton? Mutton's a sheep that lost. Same here, only you get to watch, and win money.",
        ],
        next: 'ask',
      },
      watch: {
        speaker: 'flay',
        lines: [
          "Yellow on the arm and a tin on a string, and you're the Reeve's Watch. (He shows you the token on its cord, the scales and the river.) Keeps the peace, it says. And the peace pays very nicely, thank you.",
          "Where's the Reeve get it? (He shrugs.) New friend with deep pockets, they say. Foreign money. I don't ask. Same as the barges.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'flay',
        lines: ["Come Saturday. Bring money. Leave the face at home."],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Lugs, the dog-lad
// ---------------------------------------------------------------------------

export interface LugsState {
  first: boolean;
  /** With Scritch, learning ratting. */
  apprentice: boolean;
  asked: boolean;
  free: boolean;
}

export function lugsScript(s: LugsState): DialogueScript {
  if (s.apprentice) {
    return {
      start: 'rats',
      nodes: {
        rats: {
          speaker: 'lugs',
          lines: [
            "(He's got a rat by the tail and is holding it as far from himself as his arm will go.) Hello! Mister Scritch says I've got to stop apologising to them.",
            "I sleep by the stove with Nothing. She snores. (He goes red.) I don't miss the barn. I miss Biscuit and Mags. The brindles. Mister Scritch says one day, maybe.",
          ],
        },
      },
    };
  }
  const ask: DialogueChoice[] = [];
  if (s.asked && !s.free) ask.push({ text: "That grey dog is Scritch's. You know that.", next: 'grey', key: true });
  ask.push({ text: 'You look after the dogs?', next: 'dogs' }, { text: 'Goodbye.', next: 'bye' });
  return {
    start: s.first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'lugs',
        lines: [
          "(A big, soft-faced lad, ears like jug handles, in an apron made for a much bigger man and tied twice round. He jumps when you speak.) Sorry. Sorry. You're not meant to be back here. Ned says nobody's to touch the stock.",
          "I'm Lugs. (He touches one ear.) On account of. I feed them and that.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'lugs',
        lines: ["(He looks over at the barn door before he answers.) Oh. Hello."],
        next: 'ask',
      },
      ask: {
        speaker: 'lugs',
        lines: ['(He wipes his hands on the apron.)'],
        choices: ask,
      },
      dogs: {
        speaker: 'lugs',
        lines: [
          "Ned calls them stock. They've got names, though. I gave them. That's Biscuit, she's the clever one, and that's Mags. They're not bad dogs. They were made bad. You'd be bad.",
          "(Quieter.) I sew them up after. With a needle from Vetch's. Ned says it's a waste of thread.",
        ],
        next: 'ask',
      },
      grey: {
        speaker: 'lugs',
        lines: [
          "(He goes very red.) I know. I know she is. Mister Scritch used to let me hold the ferrets, when I was little. He gave me a sugar mouse once. (He looks at the middle pen.) She won't eat. She just lies there with her face to the wall.",
          "Ned'll put her in Saturday. I can't do nothing. He'd hang me up. Rendle would. You don't know them.",
        ],
        choices: [
          { text: "Leave her pen unbarred. Let her run home. Then go with her.", next: 'run', key: true },
          { text: "You're right. Forget it.", next: 'ask' },
        ],
      },
      run: {
        speaker: 'lugs',
        lines: [
          "Go with her? (He stares.) Where? I've got nowhere. I sleep up the hay. My mam's dead and my dad's in the river.",
        ],
        choices: [
          { text: "Scritch is old and he's alone. He needs someone who's good with dogs.", next: 'yes', action: 'nothing-lugs', key: true },
          { text: 'Never mind.', next: 'ask' },
        ],
      },
      yes: {
        speaker: 'lugs',
        lines: [
          "(For a long moment he just breathes.) He'd... he might. He might. (He takes his apron off, slowly, and folds it, and puts it on the straw.)",
          "Go on out. Don't look back. When Ned comes there'll be nobody here but Biscuit and Mags, and they won't tell.",
        ],
      },
      bye: {
        speaker: 'lugs',
        lines: ['Mind Mags. She takes fingers.'],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Saul Rendle, "the Gaffer"
// ---------------------------------------------------------------------------

export interface RendleState {
  first: boolean;
  how: NothingHow;
  /** Looking for Tam for the Widow, Tam still hiding, and the hero knows where. */
  tamHunt: boolean;
  tamKnown: boolean;
  tam: TamFate;
}

export function rendleScript(s: RendleState): DialogueScript {
  const ask: DialogueChoice[] = [];
  if (s.tamHunt && s.tam === 'hiding') ask.push({ text: "I'm looking for Tam Rudd.", next: 'tam', key: true });
  ask.push(
    { text: 'What are the Red Aprons?', next: 'aprons' },
    { text: 'And the Hooks?', next: 'hooks' },
    { text: 'What do you make of the Reeve?', next: 'reeve' },
    { text: 'Goodbye.', next: 'bye' },
  );
  const tamChoices: DialogueChoice[] = [];
  if (s.tamKnown) tamChoices.push({ text: `He's hiding in Vetch's drying loft. (${coinText(TAM_BOUNTY)})`, next: 'sold', action: 'tam-sell', key: true });
  tamChoices.push({ text: "If I find him, I'll think about it.", next: 'ask' });
  const after: Record<NonNullable<NothingHow>, string> = {
    bought: "(He wipes his cleaver, though it's clean.) Ned tells me you bought a dog. Paid full price, and didn't haggle. (He smiles, softly.) I like a sentimental customer. Come again.",
    fought: "You put Ned Flay and Gristle on the floor of my barn. (He says it gently, as if telling you the price of mutton.) I don't shout. I don't need to. I've written it down. (He taps his temple.) In here. With everything else.",
    lugs: "My dog-lad has gone to live with the rat-catcher. (He tilts his head.) Boys do these things. Someone puts a notion in them. Then the notion wears off, and they come back. Or they don't come back, and nobody remembers them at all.",
  };
  const opening = s.how ? after[s.how] : "(He looks up from the joint he's dressing, and puts the cleaver down square, the way a clerk lays down a pen.) Good day. Shut the door, there's flies enough.";
  return {
    start: s.first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'rendle',
        lines: [
          "(A wide, bald man in a white shirt so clean it hurts, under an apron gone stiff and brown. His hands are pink and scrubbed, and very still. When he speaks, it's barely above a murmur.) Good day.",
          "Saul Rendle. I'm a butcher. (He lets that sit.) Most folk call me the Gaffer, because it saves them remembering my name, and I let them, because it saves me remembering theirs.",
          "If you want meat, the counter's there. If you want something else, you'll have to be patient with me. I'm a slow man. I do one thing at a time, and I do it all the way through.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'rendle',
        lines: [opening],
        next: 'ask',
      },
      ask: {
        speaker: 'rendle',
        lines: ['(He waits, perfectly still.)'],
        choices: ask,
      },
      aprons: {
        speaker: 'rendle',
        lines: [
          "Slaughtermen, and tanners' lads, and knackers. Men who do the work nobody else in this town will do, and are thanked for it by being called animals. (He smooths his apron.) We wear what we work in. People learned to call us by it.",
          "We lend a little money. We keep a little order. We have a little sport of a Saturday. And everything that's owed to us, I remember. Every penny, every name. I've never written a debt down in my life.",
        ],
        next: 'ask',
      },
      hooks: {
        speaker: 'rendle',
        lines: [
          "The Hooks are what the river leaves on the mud when the tide goes out. Moll Ketch is a loud old woman on a rotting barge who thinks she's a queen. (Mildly.) They steal cargo and sell it back to the men they stole it from. We, at least, sell meat.",
          "The Reeve pays us both to wear his yellow and stand together at his gate. So we stand together. (He smiles.) For now.",
        ],
        next: 'ask',
      },
      reeve: {
        speaker: 'rendle',
        lines: [
          "Corvin Sallow is a useful man. He needs things done, and he can't do them himself, and he pays. I like a man who knows what he can't do.",
          "Where's his silver from? (A small shrug.) He has a new friend with deep pockets. Foreign money, they say. I don't need to know whose. I only need to know it keeps coming. When it stops, we'll all find out together what the Reeve's worth without it.",
        ],
        next: 'ask',
      },
      tam: {
        speaker: 'rendle',
        lines: [
          "Tam Rudd. (He doesn't need to think.) Owes the Rose three silver. Borrowed four from me to pay it and lost it all at Silas Crane's dice, in an evening. With what's grown on it since, he owes me seven, and he's owed me it for a week. There are four notches on his door.",
          `I'd like to know where he is. Not to hurt him. (A pause, while the word "hurt" lies there between you.) To talk. I'll give you ${coinText(TAM_BOUNTY)}, for knowing.`,
        ],
        choices: tamChoices,
      },
      sold: {
        speaker: 'rendle',
        lines: [
          "(He counts the coins out onto the counter without looking at them, and slides them across.) Thank you. Gristle.",
          "(Gristle sets down his cleaver and goes out without a word. Rendle picks up his own again, and goes back to the joint.) And I'll settle his slate at the Rose for him myself. The Widow should be paid. Then he'll owe it all to me. That's tidier.",
        ],
      },
      bye: {
        speaker: 'rendle',
        lines: ['Good day to you. Shut the door.'],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Morrow Vetch, the tanner
// ---------------------------------------------------------------------------

export function vetchScript(first: boolean, tamHiding: boolean, tamHunt: boolean): DialogueScript {
  const ask: DialogueChoice[] = [
    { text: 'How does tanning work?', next: 'tanning' },
    { text: 'The barn behind your yard...', next: 'barn' },
  ];
  if (tamHiding && tamHunt) ask.unshift({ text: "I'm looking for Tam Rudd.", next: 'tam', key: true });
  ask.push({ text: 'Goodbye.', next: 'bye' });
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'vetch',
        lines: [
          "(A lean grey man scraping a hide over a wooden beam. His arms are stained brown to the elbow, and he doesn't stop scraping.) If you've come about the smell, everyone has. It doesn't go away. You stop noticing in about twenty years.",
          "Morrow Vetch. Master tanner, for what that's worth, in a town that'd rather buy its boots off a barge.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'vetch',
        lines: ['(Scrape. Scrape.) Back again.'],
        next: 'ask',
      },
      ask: {
        speaker: 'vetch',
        lines: ['(He keeps scraping.)'],
        choices: ask,
      },
      tanning: {
        speaker: 'vetch',
        lines: [
          "Lime first, to slip the hair. Then the beam, to scrape it clean. Then the bark pits, weak to strong, a year of it, two for a good sole leather. You can't hurry it. People try. You get leather that cracks in the first frost.",
          "(He holds up a finished piece, and for a moment looks almost happy.) That's a year of my life, that is. It'll outlast me.",
        ],
        next: 'ask',
      },
      barn: {
        speaker: 'vetch',
        lines: [
          "(The scraping stops.) It's my barn. The Aprons use it. Rendle pays me for it, and in return nobody fires my yard, and my lads don't get hung up on the lane. That's the bargain.",
          "I hear it at night. Through the boards. (He starts scraping again, harder.) I hear it at night, and I put my pillow over my head. I'm not proud. I'm alive.",
        ],
        next: 'ask',
      },
      tam: {
        speaker: 'vetch',
        lines: [
          "(The knife slips on the hide. He looks at the ladder in the corner, and then very hard at you.) Tam's a good lad. Stupid, but good. He used to carry for me.",
          "If you're Rendle's, then I never saw him. If you're not... (barely a breath) be quiet on the ladder. Lardy Pell's cousin watches the yard from the barn.",
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'vetch',
        lines: ['(Scrape. Scrape.)'],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Gristle, a knacker
// ---------------------------------------------------------------------------

export function gristleScript(first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'gristle',
        lines: [
          "(A slab of a man with a shaved head, a blood-stiff apron, and his mouth full. He chews, and looks at you, and chews.)",
          "Gaffer says no talking to the customers.",
        ],
        choices: [
          { text: "What's your name?", next: 'name' },
          { text: 'What do you think of the Hooks?', next: 'hooks' },
          { text: 'Never mind.' },
        ],
      },
      again: {
        speaker: 'gristle',
        lines: ['(Chews.) Mm.'],
        choices: [
          { text: 'What do you think of the Hooks?', next: 'hooks' },
          { text: 'Never mind.' },
        ],
      },
      name: {
        speaker: 'gristle',
        lines: ['Gristle. (He swallows.) On account of I eat it.'],
      },
      hooks: {
        speaker: 'gristle',
        lines: ['Offal. (He thinks about it some more.) Wet offal.'],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Tam Rudd, in the loft
// ---------------------------------------------------------------------------

export interface TamState {
  first: boolean;
  coins: number;
  /** The Widow has asked the hero to settle it. */
  widow: boolean;
  /** Scritch's dog is being looked for, and isn't out yet. */
  dog: boolean;
}

export function tamScript(s: TamState): DialogueScript {
  const ways: DialogueChoice[] = [];
  if (s.widow) ways.push({ text: 'The Widow says you can work it off. Scrubbing pots at the Rose, a copper a day.', next: 'potboy', key: true });
  ways.push(
    s.coins >= TAM_DEBT
      ? { text: `I'll pay the Rose for you. (${coinText(TAM_DEBT)})`, next: 'paid', action: 'tam-pay', key: true }
      : { text: `I'll pay the Rose for you. (${coinText(TAM_DEBT)}: I haven't enough)`, next: 'cant' },
    s.coins >= TAM_FARE
      ? { text: `Cray the boatman could row you out of here tonight. I'll pay him. (${coinText(TAM_FARE)})`, next: 'rowed', action: 'tam-row', key: true }
      : { text: `Cray could row you away, if I had the fare. (${coinText(TAM_FARE)})`, next: 'cant' },
    { text: 'Let me think about it.', next: 'ask' },
  );
  const ask: DialogueChoice[] = [
    { text: 'You owe the Black Rose three silver.', next: 'debt', key: true },
    { text: 'What happened?', next: 'what' },
  ];
  if (s.dog) ask.push({ text: 'Have you seen a grey dog? A lurcher.', next: 'dog', key: true });
  ask.push({ text: "I'll leave you be.", next: 'bye' });
  return {
    start: s.first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'tam',
        lines: [
          "(Something scrambles back into the hides with a gasp. A young man, unshaven, straw in his hair, holding a candle-end like a knife.) Don't. Don't! Who sent you? Rendle? The Widow? Was it Grubb? It's always Grubb.",
          "(He sees you're alone, and sags.) Tam. Tam Rudd. You know that already, or you wouldn't be up a ladder in a tannery. Nobody comes up here for the air.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'tam',
        lines: ["(He's been crying, and pretends he hasn't.) It's you. Close the hatch. Please."],
        next: 'ask',
      },
      ask: {
        speaker: 'tam',
        lines: ['(He hugs his knees.)'],
        choices: ask,
      },
      debt: {
        speaker: 'tam',
        lines: [
          "Three silver to the Rose, on the slate she never gives anyone. She gave it me because my mam used to scrub for her. And seven to Rendle, now, or eight, it grows in the night like mould.",
          "If I go home, Rendle's lads hang me up. If I go to the Rose, Grubb holds me upside down over the river till I remember where I put three silver. I didn't put it anywhere. It's gone. (He laughs, horribly.) Pay or swim.",
        ],
        choices: ways,
      },
      what: {
        speaker: 'tam',
        lines: [
          "Dice. At the Rose, with Silas Crane. I was winning, that's the thing, I was winning all night and then I wasn't, and I put my slate on the next throw to win it back, and the next.",
          "So I went to Rendle to pay the Widow, and he lent me four silver, ever so kindly, in his white shirt. And I went back to Silas to win it double. (He puts his face in his knees.) I know. I know.",
          "(Muffled.) There's a girl. Bett. At the chandler's. I was going to buy her a ring.",
        ],
        next: 'ask',
      },
      dog: {
        speaker: 'tam',
        lines: [
          "A grey one, with a white chest? (He nods to the louvres.) I watch the yard. Nothing else to do. A Hook brought her in on a rope, a week back, to Flay's barn. She dug her feet in all the way across the yard. Flay gave him a coin.",
          "She's in there still. I hear her at night. She doesn't bark like the others. She just cries.",
        ],
        action: 'nothing-found-tam',
        next: 'ask',
      },
      potboy: {
        speaker: 'tam',
        lines: [
          "Work for her? For the Widow? (He thinks about it, and a terrible hope comes over his face.) She'd... and Grubb wouldn't...? And Rendle won't come in the Rose. Nobody does trouble in the Rose. She won't have it.",
          "I'll do it. I'll scrub till my hands come off. (He's already scrambling for his boots.) Tell her I'm coming. Tell her I'm sorry. No, I'll tell her. I'll tell her myself.",
        ],
        action: 'tam-potboy',
      },
      paid: {
        speaker: 'tam',
        lines: [
          "(He stares at the coins.) Why? You don't know me. (He doesn't wait for an answer, in case it's the wrong one.) I'll pay you back. I swear on my mam. Every copper.",
          "That's the Rose. There's still Rendle. But he can't hang me up for a debt that's cleared at the Widow's. Not where folk can see. (He's grabbing his things.) I'm going to Bett's. Her brothers are big.",
        ],
      },
      rowed: {
        speaker: 'tam',
        lines: [
          "Away? Out of Gloomhaven? (He looks about the loft as if it were a palace he was leaving.) I've never been further than the Fen Gate. There's my cousin at Harrowford. She'd take me. Maybe.",
          "Tonight, then. Cray's pier at the dead hour. (He grips your hand, hard.) Tell Bett I'm sorry. No. Don't tell her anything.",
        ],
      },
      cant: {
        speaker: 'tam',
        lines: ["(He looks at your purse, and then away, ashamed to have looked.) No. It's all right. It's not your trouble."],
        next: 'ask',
      },
      bye: {
        speaker: 'tam',
        lines: ["Don't tell anyone. Please. Don't tell Rendle."],
      },
    },
  };
}

/** Tam at the Black Rose, working off his slate. */
export function tamPotboyScript(): DialogueScript {
  return {
    start: 'pots',
    nodes: {
      pots: {
        speaker: 'tam',
        lines: [
          "(He's up to his elbows in a bucket, and he's never looked happier.) It's you! Twenty-six days to go. The Widow says thirty, but she's knocked four off for not breaking anything. Yet.",
          "Grubb sleeps across the door at night, so Rendle's lads won't come in. He says it's to keep me in. (He grins.) Bett comes by for a cider. She hasn't said no.",
        ],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// The Widow Thorne, about Tam (her own script is in dialogue/blackrose.ts)
// ---------------------------------------------------------------------------

/** Where the Widow's errand about Tam stands, for her talk. */
export type WidowTam = 'none' | 'asked' | 'report' | 'done';

/** The Widow's nodes about Tam Rudd, merged into her script (see widowScript). */
export function widowTamNodes(fate: TamFate): DialogueScript['nodes'] {
  const report: Record<Exclude<TamFate, 'hiding'>, string[]> = {
    potboy: [
      "(She jerks her head at the scullery, where something is being scrubbed with great violence.) He came in at a run and went down on his knees on my clean floor. I told him to get up and get a bucket.",
      `Thirty days at a copper a day. He'll be useless for ten of them and Grubb will hate him for all thirty. (She puts ${coinText(WIDOW_TAM_REWARD)} on the bar.) For your trouble. Don't tell anyone I paid it.`,
    ],
    paid: [
      `(She counts the coins in the till twice.) You paid it. His slate. Out of your own purse. (She looks at you for a long moment.) That's either kindness or stupidity, and in this town they're the same thing.`,
      `(She pushes ${coinText(WIDOW_TAM_REWARD)} back across the bar.) Here. I'll not be paid by a fool for another fool. Call it even and get out of my sight.`,
    ],
    rowed: [
      "Gone. Downriver in Cray's boat, at the dead hour, Ferret says. With my three silver still owing. (She polishes the tankard so hard it squeaks.)",
      "Well. He's not my debt any more, he's the river's. You found him. I suppose that's what I asked. (She doesn't pay you.)",
    ],
    sold: [
      "Rendle came in this morning. In that white shirt. He put three silver on my bar, and said, \"For Tam Rudd's slate, Mrs Thorne,\" and went out again without a drink.",
      `(She is very quiet for a while.) I asked you to find him. I suppose you did. (She puts ${coinText(WIDOW_TAM_REWARD)} on the bar, and doesn't look at you.) Take it. I don't want it in my till.`,
    ],
  };
  return {
    'tam-ask': {
      speaker: 'thorne',
      lines: [
        "Tam Rudd. (Her mouth goes thin.) His mother scrubbed my floors for nineteen years, so I gave the boy a slate, which I give nobody, and he drank it and dropped it on Silas's dice. Three silver.",
        "He's not been home in a week, and the Aprons are looking for him too, which means he owes Rendle more than he owes me. If they find him first there'll be nothing left to pay me with.",
        "Find him. Bring me three silver, or bring me him and he can scrub it off at a copper a day. I'd rather the silver. I'd settle for him.",
      ],
      choices: [
        { text: "I'll find him.", next: 'tam-yes', action: 'tam-accept', key: true },
        { text: 'Not my business.', next: 'ask' },
      ],
    },
    'tam-yes': {
      speaker: 'thorne',
      lines: ["Good. His door's the one down the bottom of the square with the four notches cut in it. Ask whoever's still speaking to him. There aren't many."],
      next: 'ask',
    },
    'tam-still': {
      speaker: 'thorne',
      lines: ['Well? No? Then go and look harder.'],
      next: 'ask',
    },
    'tam-report': {
      speaker: 'thorne',
      lines: fate === 'hiding' ? ['Well?'] : report[fate],
      action: 'tam-reported',
      next: 'ask',
    },
  };
}
