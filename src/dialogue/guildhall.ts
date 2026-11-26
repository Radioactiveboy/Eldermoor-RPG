import { HERO_NAME } from '../config';
import { GUILD_EARNEST, GUILD_FEE } from '../systems/Guild';
import type { DialogueChoice, DialogueScript, SpeakerId } from './Dialogue';

/**
 * The Guildhall of the Causeway Merchants (world/GuildHallMap.ts). The hero
 * walks in on a sitting gone wrong: three caravans lost at the Drowned Mile,
 * out on the causeway over the fen, and the guild at each other's throats over
 * it. Guildmaster Hamon Wexley, florid and worn out, keeps what order he can.
 * Dame Isolde Marrable, whose family built the causeway, wants something done.
 * Master Tunstall wants his scarlet back. Master Josiah Thrale wants to hire the
 * Reeve's yellowbands, and to lend everyone money. Edric Lowe, who was a factor
 * out east, says it is sabotage by foreign powers, and is shouted down. Nat
 * Garrow, the caravan master who came back, sits by the fire with his head
 * broken. Pim the clerk keeps the books, and the route book, and writes down
 * who reads it.
 *
 * The hero can offer to find out what is behind the raids (`guild-hire`), and
 * from there it's the guild's own people who point the way: Garrow's fog and
 * punt and coin, the route book's margins, the offers to buy, and Edric, away
 * from Thrale, sending the hero out along the Fen Road to the wreck. Nobody
 * here knows of the orb, and nobody is told; "foreign powers" is as near as
 * anyone comes.
 */

const pickOne = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];
const bye = (speaker: SpeakerId, lines: string[]) => ({ speaker, lines: [pickOne(lines)] });

/** Where the hero stands with the guild, for everybody's talk. */
export interface GuildState {
  /** First time spoken to since the meeting. */
  first: boolean;
  /** The guild has taken the hero on. */
  hired: boolean;
  /** Asked the guild to let Edric Lowe finish, at the meeting. */
  heardLowe: boolean;
  /** Nat Garrow told what he saw. */
  garrow: boolean;
  /** Pim has given leave to read the route book. */
  pimLeave: boolean;
  /** Read the route book. */
  ledger: boolean;
  /** Edric said his piece, and sent the hero to the wreck. */
  edric: boolean;
  /** Read the offer for the charter on the guildmaster's desk. */
  letters: boolean;
  /** Dame Marrable told of the man in grey who wanted her brother's share. */
  marrable: boolean;
  /** Tunstall owned to Thrale's loan. */
  tunstall: boolean;
}

// ---------------------------------------------------------------- the sitting

/**
 * The sitting the hero walks in on, the first time through the door: the
 * whole table at once, Wexley's gavel, Lowe shouted down, and then the guild
 * notices the stranger. It ends either with the hero taken on (`guild-hire`)
 * or shown the door; either way the sitting breaks up (`guild-adjourn`).
 */
export function meetingScript(): DialogueScript {
  const offer: DialogueChoice = { text: `My name is ${HERO_NAME}. You have trouble on the road. I could find out who is behind it.`, next: 'offer', key: true };
  const leave: DialogueChoice = { text: 'Sorry. Wrong door.', next: 'wrong-door' };
  return {
    start: 'm1',
    nodes: {
      m1: {
        speaker: 'marrable',
        lines: [
          '(A spare, grey woman in a green riding coat is on her feet, both hands flat on the table.) Three, Hamon. Three caravans in a month. All at the Drowned Mile. And you sit there and ring for more wine.',
        ],
        next: 'm2',
      },
      m2: {
        speaker: 'tunstall',
        lines: [
          "And mine not even ROBBED! Forty bolts of good scarlet, slashed through in the wagon and left in the mud for the eels! Who slashes cloth? What sort of thief leaves the cloth?",
        ],
        next: 'm3',
      },
      m3: {
        speaker: 'thrale',
        lines: [
          '(A dark, handsome man leans back in his chair, turning a silver ring on his finger.) Brigands, Tunstall. Fen-rats, who couldn\'t sell scarlet in a town of drab if they tried, so they spoil it out of spite.',
          "Hire spears. The Reeve's men will ride with a caravan for a fair price. I have said so. I keep saying so.",
        ],
        next: 'm4',
      },
      m4: {
        speaker: 'marrable',
        lines: [
          "With what money, Master Thrale? The Reeve's fair price is a third of the cargo, and his men are Hooks and knackers with yellow rags round their arms. I would sooner hire the eels.",
        ],
        next: 'm5',
      },
      m5: {
        speaker: 'garrow',
        lines: [
          "(From the fire, a weathered man with a bandaged head speaks up without getting up.) Begging the guild's pardon. They weren't fen-rats. They knew which wagon. They went straight past the salt to Master Tunstall's cloth, like they'd read the waybill.",
        ],
        next: 'm6',
      },
      m6: {
        speaker: 'wexley',
        lines: [
          '(A stout old man in burgundy and fur, a gold chain across his chest, bangs a little gavel on the table.) Order. ORDER. Garrow, you are here on the guild\'s charity, not on its business. Thank you.',
        ],
        next: 'm7',
      },
      m7: {
        speaker: 'edric',
        lines: [
          "(A lean young man in spectacles is up out of his chair.) He's right, though, Guildmaster. It isn't brigands. It's sabotage. Somebody wants the causeway ruined, and I'll tell you who would pay for that.",
          'Foreign powers. A buyer from abroad. There is coin going round this town I have never seen the like of, new silver with a mark on it from...',
        ],
        next: 'm8',
      },
      m8: { speaker: 'thrale', lines: ['Oh, sit DOWN, Lowe.'], next: 'm9' },
      m9: {
        speaker: 'tunstall',
        lines: ['Foreign powers! Foreign powers slashed my scarlet! Will it be the Fair Folk next, Lowe? Shall we leave out milk?'],
        next: 'm10',
      },
      m10: {
        speaker: 'marrable',
        lines: ['Master Lowe. We have lost two drivers and three caravans. We do not have the time for your stories about coins.'],
        next: 'm11',
      },
      m11: {
        speaker: 'wexley',
        lines: [
          'Master Lowe is out of order. Sit down, Edric.',
          '(He sees you, at last, standing by the door, and his face goes from red to redder.) And who, in the name of the scales, are you? This is a closed sitting of the Merchants of the Causeway. Who let you in?',
        ],
        choices: [offer, { text: 'I would like to hear what Master Lowe was going to say.', next: 'lowe', action: 'guild-heard-lowe' }, leave],
      },
      lowe: {
        speaker: 'edric',
        lines: ['(He looks at you as if you have thrown him a rope.) Thank you. As I was saying, the coin. It has a tower on it, and over the tower...'],
        next: 'lowe2',
      },
      lowe2: {
        speaker: 'thrale',
        lines: [
          '(Pleasantly, and without looking at Edric at all.) As he was saying, he reads a great many books. Guildmaster, do we take the floor from strangers now? I only ask.',
        ],
        next: 'lowe3',
      },
      lowe3: {
        speaker: 'wexley',
        lines: ['No. Quite. Sit down, Edric. (To you.) Well? Who are you, and what do you want?'],
        choices: [offer, leave],
      },
      offer: {
        speaker: 'wexley',
        lines: ['(He looks you up and down: the mud on your boots, the sword.) Find out. Ha. The Reeve said that. The Reeve said it in the spring, and took our money, and found out nothing.'],
        next: 'offer2',
      },
      offer2: {
        speaker: 'marrable',
        lines: [
          'Hamon. We have tried the Reeve. We have tried prayers. A stranger owes nobody in this town anything, which is more than can be said for anyone at this table. That might be worth paying for.',
        ],
        next: 'offer3',
      },
      offer3: {
        speaker: 'thrale',
        lines: ["A stranger owes nobody, and so answers to nobody. I'd rather the Reeve's men. But I see I'm outvoted. (He smiles at you.) I usually am."],
        next: 'offer4',
      },
      offer4: {
        speaker: 'wexley',
        lines: [
          `Very well. The guild will take you on. ${GUILD_EARNEST} coins on account, now, and ${GUILD_FEE} when you can tell this table who is behind the raids, and why, and prove it.`,
          'Start with Garrow, there; he was with the last caravan, and he has told it to everyone but us. Pim, our clerk, will open the books to you, in the counting room. And the office is yours to look in, if it helps. The guild has no secrets from its own servants.',
          '(He says it as though he wishes it were true.)',
        ],
        action: 'guild-hire',
        next: 'close',
      },
      close: {
        speaker: 'wexley',
        lines: ['(The gavel again, wearily.) The sitting is closed. Go home, all of you. And mind the road.'],
        action: 'guild-adjourn',
      },
      'wrong-door': {
        speaker: 'wexley',
        lines: ["Then find the right one, and shut this one behind you. (He's already turning back to the table.) Now. Where were we. The sitting is closed. We will take it up again when we are calmer, if we live so long."],
        action: 'guild-adjourn',
      },
    },
  };
}

// ---------------------------------------------------------------- the guildmaster

/** Hamon Wexley, guildmaster: at the head of the table, or by his great chair. */
export function wexleyScript(s: GuildState): DialogueScript {
  const ask: DialogueChoice[] = [
    s.hired
      ? { text: 'About the raids...', next: 'report', key: true }
      : { text: 'About the raids. I can find out who is behind them.', next: 'offer', key: true },
    ...(s.letters ? [{ text: 'About the letter on your desk. The one with the grey seal.', next: 'letter', key: true }] : []),
    { text: 'Tell me about the guild.', next: 'guild' },
    { text: 'What do you make of Master Thrale?', next: 'thrale' },
    { text: 'And Master Lowe?', next: 'lowe' },
    { text: 'Goodbye, Guildmaster.', next: 'bye' },
  ];
  const report: string[] = [];
  if (!s.garrow) report.push("Have you spoken to Garrow? Start there. He was there. (He rubs his eyes.) I can't listen to it again; I've heard it in my sleep.");
  else if (!s.ledger) report.push('So Garrow says they knew which wagon. Then someone told them. Go and see Pim in the counting room, and look at the route book; every caravan is written up in it before it goes.');
  else if (!s.edric) report.push("The route book. (He goes quiet.) I don't want to know what you read in it. Not yet. Talk to Lowe first. Not while Thrale is in the room.");
  else report.push('Lowe has sent you out to the Drowned Mile? Then go. Go by the Fen Gate; Captain Vosk is honest, whatever the Reeve says, and the yellowbands are not. And the fen is worse than either.');
  return {
    start: s.first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'wexley',
        lines: [
          s.hired
            ? "(He lowers himself into the great chair with a grunt.) Our new servant. Hamon Wexley, guildmaster, for my sins, of which this guild is the greatest. Well?"
            : "(He lowers himself into the great chair with a grunt.) You again. The sitting's over, such as it was. Hamon Wexley, guildmaster, for my sins. What is it?",
        ],
        next: 'ask',
      },
      again: { speaker: 'wexley', lines: [pickOne(['Well?', '(He looks up from the reports.) Any news? No, of course not. Well?', 'Yes, yes. What is it?'])], next: 'ask' },
      ask: { speaker: 'wexley', lines: ['What do you want?'], choices: ask },
      offer: {
        speaker: 'wexley',
        lines: [
          "(He looks at you a long time.) Dame Marrable thinks a stranger is worth the money. She is generally right, which is the most annoying thing about her.",
          `${GUILD_EARNEST} coins on account, now, and ${GUILD_FEE} when you can tell me who is behind the raids, and prove it. Start with Garrow, by the fire. Pim will open the books to you; the office is yours to look in.`,
        ],
        action: 'guild-hire',
        next: 'ask',
      },
      report: { speaker: 'wexley', lines: report, next: 'ask' },
      letter: {
        speaker: 'wexley',
        lines: [
          "(He goes a worse colour.) Ah. You found that. Somebody wants to buy the charter. Not a share; the guild itself, root and branch, and the road with it. No name. A grey seal. A sum that would pay off every debt at this table.",
          "I put it in a drawer and I haven't slept since. If the members heard of it, half of them would vote to sell by suppertime. (Quietly.) And I don't know that I'd blame them.",
        ],
        next: 'ask',
      },
      guild: {
        speaker: 'wexley',
        lines: [
          "The Merchants of the Causeway. A hundred years ago old Godwin Marrable, on the wall there, and a handful of others drove oak piles across the fen and laid a road on them, and the old lord gave them a charter for it.",
          'Everything that comes into Gloomhaven by land comes over our causeway. Salt in, wool and eels out, cloth and wine and pepper both ways. We were rich once. Now we are thirty-one names on a roll, and most of them struck out.',
        ],
        next: 'ask',
      },
      thrale: {
        speaker: 'wexley',
        lines: [
          'Josiah Thrale. Came to us four years ago with a cargo of wine and very good manners. He has done well, which is more than the rest of us have.',
          "He lends to the members when they're short. The guild ought to be grateful. I am grateful. (He does not look it.)",
        ],
        next: 'ask',
      },
      lowe: {
        speaker: 'wexley',
        lines: [
          'Edric. His father was a good man and a better trader. The boy reads. He went out east as a factor for a year, and came back with spectacles and ideas.',
          "Foreign powers. (He shakes his head.) I've trouble enough with the powers in this town.",
        ],
        next: 'ask',
      },
      bye: bye('wexley', ['Mind the road.', 'Yes. Go on.', '(He has already gone back to the reports.)']),
    },
  };
}

// ---------------------------------------------------------------- Dame Marrable

export function marrableScript(s: GuildState): DialogueScript {
  return {
    start: s.hired ? (s.first ? 'greet' : 'again') : 'closed',
    nodes: {
      closed: {
        speaker: 'marrable',
        lines: ['(She looks at you down a long nose.) That was a closed sitting. As far as I am concerned it is still a closed sitting. Good day.'],
      },
      greet: {
        speaker: 'marrable',
        lines: ['(She looks at you down a long nose.) The guild\'s hireling. I spoke for you, so do not make a fool of me. Dame Isolde Marrable. What do you want to know?'],
        next: 'ask',
      },
      again: { speaker: 'marrable', lines: [pickOne(['Well?', 'You have news, I hope.', '(She does not sit.) What is it?'])], next: 'ask' },
      ask: {
        speaker: 'marrable',
        lines: ['Ask.'],
        choices: [
          { text: 'Tell me about the raids.', next: 'raids' },
          ...(s.marrable ? [] : [{ text: 'Has anyone offered to buy you out?', next: 'offer', key: true }]),
          { text: 'Who is the man in the portrait?', next: 'founder' },
          { text: 'Good day, Dame Marrable.', next: 'bye' },
        ],
      },
      raids: {
        speaker: 'marrable',
        lines: [
          'Mine was the first. Six wagons, mine and my late brother Hugh\'s share, and Tunstall\'s. Two drivers killed. Good men; I knew their mothers.',
          'The Reeve sent four yellowbands out to look, a week later. They came back and said brigands, and asked for their money. That is the sum of what the Reeve of Gloomhaven has done for us.',
        ],
        next: 'ask',
      },
      offer: {
        speaker: 'marrable',
        lines: [
          '(Her mouth tightens.) A man in a grey coat came to my door the week after Hugh\'s funeral. Very civil. Very clean boots, which you will agree is a thing to notice in Gloomhaven.',
          "He would buy Hugh's share in the guild, at a price nobody in their right mind would pay for it. I told him the Marrables built the causeway and do not sell it to men with no names.",
          'My first caravan was set upon a fortnight later. I have not said so at the table. I am saying so to you.',
        ],
        action: 'guild-marrable',
        next: 'ask',
      },
      founder: {
        speaker: 'marrable',
        lines: [
          "Godwin Marrable. My great-great-grandfather. He drove the first pile into the fen with his own hands, they say, and drowned two horses doing it. He would have known what to do. He would have hanged someone.",
        ],
        next: 'ask',
      },
      bye: bye('marrable', ['Good day.', 'Do not make a fool of me.', '(A nod, the least she can give.)']),
    },
  };
}

// ---------------------------------------------------------------- Master Tunstall

export function tunstallScript(s: GuildState): DialogueScript {
  return {
    start: s.hired ? (s.first ? 'greet' : 'again') : 'closed',
    nodes: {
      closed: {
        speaker: 'tunstall',
        lines: ['(He mops his face with a yellow handkerchief.) Is it over? It\'s over. Nothing decided, as usual. Oh, my scarlet. Forty bolts.'],
      },
      greet: {
        speaker: 'tunstall',
        lines: ["(He mops his face with a yellow handkerchief.) Ah! The hireling! Have you found my scarlet's murderer yet? No? Bartholomew Tunstall, cloth. Cloth that was."],
        next: 'ask',
      },
      again: { speaker: 'tunstall', lines: [pickOne(['Any news? Any news at all?', 'Ah! You! Well?', '(Mopping.) Well?'])], next: 'ask' },
      ask: {
        speaker: 'tunstall',
        lines: ['What can I tell you?'],
        choices: [
          { text: 'What happened to your cloth?', next: 'cloth' },
          ...(s.tunstall ? [] : [{ text: 'How will you manage, with your caravans lost?', next: 'debt', key: true }]),
          { text: 'Goodbye, Master Tunstall.', next: 'bye' },
        ],
      },
      cloth: {
        speaker: 'tunstall',
        lines: [
          "Scarlet. Ypres scarlet, the real thing, dyed with kermes, not madder. Forty bolts, and they slashed every one through, in the wagon, and threw the bolts into the mud. And the wool behind it, fired. And the wine broken.",
          'Robbers rob. Anybody knows that. These people came all that way out into the fen in the fog to spoil things. Who does that? Who can afford to?',
        ],
        next: 'ask',
      },
      debt: {
        speaker: 'tunstall',
        lines: [
          "(He mops.) Manage. Yes. Well. Master Thrale has been very decent. Very decent indeed. He's lent me against my next caravan, forty silver, at hardly any interest at all.",
          "And if the next one doesn't come in, well, he'll have my share of the guild instead, it's all written down. But it will come in. It must. (He does not seem sure.)",
        ],
        action: 'guild-tunstall',
        next: 'ask',
      },
      bye: bye('tunstall', ['Find them! Find them.', 'Oh dear. Oh dear, oh dear.', '(He goes back to mopping.)']),
    },
  };
}

// ---------------------------------------------------------------- Master Thrale

export function thraleScript(s: GuildState): DialogueScript {
  return {
    start: s.first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'thrale',
        lines: [
          s.hired
            ? '(He doesn\'t get up.) Our new friend. Josiah Thrale: wine, and sundries. Sit, if you like. There is a chair going spare; Tunstall kicked it over.'
            : '(He doesn\'t get up.) The stranger at the door. Josiah Thrale: wine, and sundries. You came at a bad time. Every time is a bad time, here.',
        ],
        next: 'ask',
      },
      again: { speaker: 'thrale', lines: [pickOne(['(He smiles.) Back again.', 'You do get about.', 'Well, now. What can I do for you?'])], next: 'ask' },
      ask: {
        speaker: 'thrale',
        lines: ['Ask away.'],
        choices: [
          { text: "You don't think it's brigands at all, do you?", next: 'brigands' },
          { text: "That's a fine ring.", next: 'ring' },
          ...(s.tunstall || s.ledger ? [{ text: 'I hear you lend to the members.', next: 'loans', key: true }] : []),
          ...(s.ledger ? [{ text: 'You read the route book a good deal, for a man who ships by river.', next: 'book', key: true }] : []),
          { text: 'Good day, Master Thrale.', next: 'bye' },
        ],
      },
      brigands: {
        speaker: 'thrale',
        lines: [
          'I think brigands are the cheapest answer, and in my experience the cheapest answer is usually the right one. Lowe\'s answer is very dear: it means a war, with someone. Do you have a war about you? No?',
          'Brigands, then. Hire spears and be done with it.',
        ],
        next: 'ask',
      },
      ring: {
        speaker: 'thrale',
        lines: ["Isn't it? A gift, from a friend abroad. Silver's cheap there, they say. (He turns it so the firelight catches it. It is very bright, and very new.)"],
        next: 'ask',
      },
      loans: {
        speaker: 'thrale',
        lines: [
          "Someone has to. The guild can't, the Reeve charges like a knacker, and the back room at the Rose wants security I wouldn't give my own mother.",
          'I lend at fair rates against good security. If that makes me a villain, then so is every banker from here to Hallowmarket.',
        ],
        next: 'ask',
      },
      book: {
        speaker: 'thrale',
        lines: ["(The smile stays exactly where it was.) I like to know what goes out, and when. Doesn't everyone? Ask Pim; Lowe reads it more than I do."],
        next: 'ask',
      },
      bye: bye('thrale', ['Mind the fen.', 'Do come again.', '(He raises the ring hand, idly.)']),
    },
  };
}

// ---------------------------------------------------------------- Edric Lowe

/** @param thraleHere Master Thrale is in the hall, so Edric won't speak freely. */
export function edricScript(s: GuildState, thraleHere: boolean): DialogueScript {
  return {
    start: !s.hired ? 'unhired' : thraleHere && !s.edric ? 'watched' : s.edric ? 'after' : 'free',
    nodes: {
      unhired: {
        speaker: 'edric',
        lines: [
          s.heardLowe
            ? "(He pushes his spectacles up.) You asked them to let me finish. Thank you. Nobody's done that in a year. But they won't hear it from me. Maybe they would from someone they were paying."
            : "(He's staring out of the window.) Don't. I know. Foreign powers. The Fair Folk. Leave out milk. (Bitterly.) Edric Lowe, at your service, guild madman.",
        ],
      },
      watched: {
        speaker: 'edric',
        lines: [
          '(He glances across at Thrale, and then says, too loudly) I was mistaken, at the sitting. Brigands, I am sure of it.',
          '(Very quietly.) Not here. Not while he is in the room. He goes about five, most days.',
        ],
      },
      free: {
        speaker: 'edric',
        lines: ['(He pushes his spectacles up and starts talking fast, as if he has been saving it.) Thank you. For asking. Nobody asks.'],
        next: 'ask',
      },
      after: {
        speaker: 'edric',
        lines: [
          thraleHere
            ? '(Very quietly, not looking at you.) The Drowned Mile. Have you been yet?'
            : pickOne(['Have you been out to the Drowned Mile yet?', '(He looks up from his book.) Well? The wreck?']),
        ],
        next: thraleHere ? undefined : 'ask',
      },
      ask: {
        speaker: 'edric',
        lines: ['Ask me. Please.'],
        choices: [
          { text: 'Tell me about this new silver.', next: 'coin' },
          { text: 'Why would anyone want the causeway ruined?', next: 'why' },
          { text: 'What should I do?', next: 'lead', key: true },
          { text: 'Goodbye, Master Lowe.', next: 'bye' },
        ],
      },
      coin: {
        speaker: 'edric',
        lines: [
          '(He takes a coin out of his purse and puts it on the sill: silver, bright, very thin, with a tower stamped on it and a little star over the tower.) That.',
          'There has been more of that in Gloomhaven since the spring than there has been honest silver in ten years. The Reeve pays his yellowbands in it. The back room at the Black Rose pays in it. And Master Thrale, who came here with a cargo of wine he never seems to sell, pays our members\' debts in it.',
        ],
        next: 'coin2',
      },
      coin2: {
        speaker: 'edric',
        lines: [
          "I was a factor at Hallowmarket for a year. I saw one of these there once, off a ship from further east than any map in this hall goes. The man who had it wouldn't say where it came from.",
          'He said there were places out there where the bells ring at the wrong hours, and men who would buy a whole coast, one merchant at a time. (He puts the coin away, quickly.) I thought he was drunk. I thought so for a long while.',
        ],
        next: 'ask',
      },
      why: {
        speaker: 'edric',
        lines: [
          "Not ruined. Bought. You can't buy a guild by asking; Dame Marrable would set the dogs on you. You make it poor first.",
          'You make the road dear and dangerous, until nobody can pay their debts, except to the one man in town who has silver. Then you buy the debts. Look at the roll by the door. Cobley, struck out. SOLD. Who to? Nobody wrote it down.',
        ],
        next: 'ask',
      },
      lead: {
        speaker: 'edric',
        lines: [
          'Go and look at the wreck. The last caravan is still out there at the Drowned Mile, where the causeway runs low through the reeds. Nobody has dared go back for it.',
          'If it was brigands, there will be things missing. If it was not... Garrow says that when it was done they went into the mere, and he never saw one come up. Brigands do not swim. Look at the tracks. Look at what made them.',
          'Out of the Fen Gate and north. And go carefully. Whoever they are, they will know by tonight that the guild has hired someone.',
        ],
        action: 'guild-edric',
        next: 'ask',
      },
      bye: bye('edric', ['Be careful.', 'Thank you. Truly.', '(He has gone back to the window.)']),
    },
  };
}

// ---------------------------------------------------------------- Pim the clerk

export function pimScript(s: GuildState): DialogueScript {
  return {
    start: s.first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'pim',
        lines: [
          '(A small, stooped clerk peers at you over his spectacles, pen raised.) Yes? The counting room is for members and servants of the guild. Are you a member? You are not a member.',
          s.hired ? '(He sniffs.) Ah. The guildmaster\'s new servant. Pim. Pim Weatherby. Clerk. Forty-one years.' : 'Pim. Clerk. Forty-one years. Mind the ink.',
        ],
        next: 'ask',
      },
      again: { speaker: 'pim', lines: [pickOne(['(Scratch, scratch.) Yes?', '(Without looking up.) Mind the ink.', 'Yes? Quickly, please. I am adding.'])], next: 'ask' },
      ask: {
        speaker: 'pim',
        lines: [s.ledger ? "(He lowers his voice.) You've read it, then. I saw your face. I write down what I'm told to write down. I don't write down what I think." : 'What is it?'],
        choices: [
          ...(s.hired && !s.pimLeave ? [{ text: 'The guildmaster has taken me on. I need to see the route book.', next: 'leave', key: true }] : []),
          { text: 'Who reads the route book?', next: 'readers', key: s.hired && !s.ledger },
          { text: 'How is the guild for money?', next: 'money' },
          { text: "I'll let you get on.", next: 'bye' },
        ],
      },
      leave: {
        speaker: 'pim',
        lines: [
          '(He takes off his spectacles, polishes them, and puts them back on.) The route book. Every caravan that leaves, its day, its road and its cargo, written up three days before it goes, so the members can send goods along.',
          'Nobody outside the guild sees it. That is the whole point of it. (He looks at you for a long time.) But if the guildmaster says. Do not unchain it. Do not lick your fingers.',
        ],
        action: 'guild-pim-leave',
        next: 'ask',
      },
      readers: {
        speaker: 'pim',
        lines: [
          'Members. Any member may read it, and I write down who has, in the margin, because I was told to forty years ago and nobody has told me to stop.',
          'Masters Lowe and Thrale read it most. They ship most. (A pause.) Master Lowe ships most.',
        ],
        next: 'ask',
      },
      money: {
        speaker: 'pim',
        lines: [
          'Money comes in, and money goes out. Mostly out. (His eyes go to the little stack of bright coin set apart on the counting table.) Some comes in that I would rather did not.',
        ],
        next: 'ask',
      },
      bye: bye('pim', ['(Scratch, scratch.)', 'Mind the ink.', '(He has already gone back to his adding.)']),
    },
  };
}

// ---------------------------------------------------------------- Nat Garrow

export function garrowScript(s: GuildState): DialogueScript {
  return {
    start: s.first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'garrow',
        lines: ["(He squints up at you from under the bandage.) Don't mind me. Nat Garrow. Caravan master. I'm the guild's charity, the guildmaster says. Charity gets a stool by the fire, at least."],
        next: 'ask',
      },
      again: { speaker: 'garrow', lines: [pickOne(['(He nods, carefully, so as not to jar his head.)', "You again. Pull up the fire.", 'Still here. Where else would I be?'])], next: 'ask' },
      ask: {
        speaker: 'garrow',
        lines: ['What is it?'],
        choices: [
          { text: 'What happened at the Drowned Mile?', next: 'g1', key: !s.garrow },
          ...(s.garrow ? [{ text: 'Where is the wreck now?', next: 'wreck' }] : []),
          { text: "How's your head?", next: 'head' },
          { text: 'Rest. I will leave you be.', next: 'bye' },
        ],
      },
      g1: {
        speaker: 'garrow',
        lines: [
          'Fog. You get fog out there like wet wool. Five wagons, and me in front with a lantern on a pole. We come to where the causeway runs low, the Drowned Mile, and the reeds come up taller than the wagons on both sides.',
          'And out of them come ten, twelve of them. Faces wrapped, I thought, or hooded. Low to the ground, and quick in the mud, quicker than a man has any right to be. No shouting. Brigands shout, to frighten you. These only hissed.',
        ],
        next: 'g2',
      },
      g2: {
        speaker: 'garrow',
        lines: [
          "They went past the salt. Past the eels. Straight to Master Tunstall's wagon and Dame Marrable's, and slashed the cloth, and stove the casks, and fired the wool. Took nothing. One of them put me down with a cudgel and I lay there in the reeds with my arm broke, and I watched.",
        ],
        next: 'g3',
      },
      g3: {
        speaker: 'garrow',
        lines: [
          "And there was a punt. Out on the mere, in the fog, with a man stood up in it. A good grey coat. He didn't help and he didn't hide. He just watched, like a man at a cattle sale.",
          'When it was done they went off the causeway into the mere. Into the water, mark you, and not one of them came up that I saw. I lay there till dark, waiting for a head. Nothing.',
        ],
        next: 'g4',
      },
      g4: {
        speaker: 'garrow',
        lines: [
          "I found this in the mud where they'd stood. (He opens his good hand: a thin, bright coin, with a tower on it and a star over the tower.) New silver. Brigands with new silver, that rob and don't take anything. You tell me.",
          "I told the guildmaster. He said I'd had a knock on the head. I have. That's not the same as being wrong.",
        ],
        action: 'guild-garrow',
        next: 'ask',
      },
      wreck: {
        speaker: 'garrow',
        lines: [
          "Still out there, what's left. Wagons don't float, and nobody's been back for them. Out of the Fen Gate and up the causeway, a couple of hours, till the reeds close in. You'll smell it before you see it.",
        ],
        next: 'ask',
      },
      head: {
        speaker: 'garrow',
        lines: ["Still on. The arm's worse. I'll drive again when it knits. Somebody has to, and the young ones won't, now."],
        next: 'ask',
      },
      bye: bye('garrow', ['Mind the reeds.', '(He goes back to the fire.)', 'Aye.']),
    },
  };
}

// ---------------------------------------------------------------- the hall's talk

/** Who says what on the way in, before the sitting notices the hero: shouted over each other. */
export const MEETING_BARKS: Array<[SpeakerId, string]> = [
  ['tunstall', 'SLASHED, I tell you!'],
  ['thrale', 'Brigands, Tunstall.'],
  ['marrable', 'Three caravans, Hamon!'],
  ['wexley', 'Order! Order!'],
];

/** The members, muttering to themselves about the hall, once the sitting is over. */
export const GUILD_MUTTERS: Partial<Record<SpeakerId, string[]>> = {
  wexley: ['Thirty-one names...', 'Where is that wine?', 'Margery would have known what to do.'],
  marrable: ['Fog. Always fog.', 'Brigands. Hm.'],
  tunstall: ['Forty bolts.', 'Oh, dear.', 'Kermes. Real kermes.'],
  thrale: ['(He turns his ring.)', 'Mm.'],
  edric: ['A tower, and a star...', 'Nobody listens.'],
  garrow: ['(He shifts on the stool, and winces.)', 'Fog like wet wool.'],
  pim: ['Carry the four...', '(Scratch, scratch.)', 'Forty-one years.'],
};

/** What the hero thinks, sat on the guild's benches. */
export const GUILD_SITTING_THOUGHTS: Record<string, string[]> = {
  'gd-bench': [
    'The bench for those who wait on the guild. It is polished smooth by a hundred years of people waiting.',
    'From here I can see the whole table, and everyone at it can pretend not to see me.',
  ],
};
