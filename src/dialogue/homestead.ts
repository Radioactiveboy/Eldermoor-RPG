import { HERO_NAME } from '../config';
import { Homestead, IMPROVEMENTS, PROJECTS, STEAD_GIFT, STEAD_STAGES } from '../systems/Homestead';
import { Inventory, ItemId, itemDef } from '../systems/Inventory';
import { QuestLog } from '../systems/Quests';
import { applyRaidTalk, RaidTalk } from './afterRaid';
import type { DialogueChoice, DialogueScript } from './Dialogue';

/**
 * How people talk about putting the Hollow right (see systems/Homestead.ts),
 * once Mother is buried: the Headman, whose offer it was; Osric, who builds it;
 * Farmer Iran, whose stead the hero helps mend; and the men at work on it. It's
 * the last layer over everyone's talk (see {@link homesteadAware}).
 */

const REBUILDING = 'hearth-and-home';
const STEAD = 'irans-stead';

/** "12 oak timber, 16 bundles of reed and 2 kegs of nails", in Osric's words. */
function wants(what: Record<string, number>): string {
  const parts = Object.entries(what).map(([k, n]) => {
    if (k === 'coins') return `${n} coins for the joiner`;
    const name = itemDef(k as ItemId).name.toLowerCase();
    const short: Record<string, string> = {
      'oak timber': n === 1 ? 'a length of oak' : `${n} lengths of oak`,
      'bundle of reed': n === 1 ? 'a bundle of reed' : `${n} bundles of reed`,
      'keg of nails': n === 1 ? 'a keg of nails' : `${n} kegs of nails`,
      'dressed stone': `${n} dressed stone`,
      'roofing slate': `${n} slates`,
    };
    return short[name] ?? `${n} ${name}`;
  });
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** What each of them says now about the rebuilding, by whose talk it is (as in afterRaid.ts). */
export function homesteadTalk(): Record<string, RaidTalk> {
  const started = QuestLog.has(REBUILDING);
  const done = !!QuestLog.get(REBUILDING)?.completed;
  const stage = Homestead.stage;
  const talk: Record<string, RaidTalk> = {};

  // ---- The Headman: it was his offer.
  const headmanAsk: DialogueChoice[] = [];
  if (!started) headmanAsk.push({ text: "I'm ready to put a roof on the cottage.", next: 'hs-ready' });
  else if (!done) headmanAsk.push({ text: 'About the cottage.', next: 'hs-how' });
  talk.headman = {
    speaker: 'headman',
    ask: headmanAsk,
    flag: 'hs-told:headman',
    nodes: {
      'hs-ready': {
        speaker: 'headman',
        lines: [
          '(He puts down his pen.) Are you, lad? ...Yes. I believe you are.',
          'Then here is how it goes. The burnt timber comes out first: nobody can build on char, and you will want to do that yourself, I think.',
          "Then go to Osric. He has roofed half of Adowvale, and he will tell you what it wants, to the last nail. Oak, reed for the thatch, iron, stone. Some of it you can cut and gather; the rest he sells from his yard, at a fair price, if he knows what's good for him.",
          'And when it is all there, he and the cooper\'s boys will come up and raise it. It will take some days. Let it.',
        ],
        action: 'hs-start',
        next: 'ask',
      },
      'hs-how': {
        speaker: 'headman',
        lines: [headmanOnProgress(stage)],
        next: 'ask',
      },
    },
  };

  // ---- Osric: the builder.
  const osricAsk: DialogueChoice[] = [];
  if (started && !QuestLog.isDone(REBUILDING, 'clear')) osricAsk.push({ text: 'About rebuilding the cottage.', next: 'hs-first' });
  else if (started && !QuestLog.isDone(REBUILDING, 'osric')) osricAsk.push({ text: 'The cottage is swept out. What will it need?', next: 'hs-needs' });
  else if (started && Homestead.open().length + (Homestead.work ? 1 : 0) > 0) osricAsk.push({ text: 'What does the work want now?', next: 'hs-now' });
  if (started && QuestLog.isDone(REBUILDING, 'osric')) osricAsk.push({ text: 'Sell me building goods: oak, nails, stone, slate.', action: 'shop:smith' });
  const open = Homestead.open();
  const first = open[0];
  talk.smith = {
    speaker: 'smith',
    ask: osricAsk,
    flag: 'hs-told:smith',
    nodes: {
      'hs-first': {
        speaker: 'smith',
        lines: [
          'Hm. The Headman said you might come.',
          "Burnt stuff out first. All of it, down to the boards. Can't tell what's sound till it's out, and I'll not build on char. Come back when it's swept.",
        ],
        next: 'ask',
      },
      'hs-needs': {
        speaker: 'smith',
        lines: [
          "Hm. Went up and had a look yesterday. Chimney's sound. Bottom courses are sound. The rest wants cutting out.",
          `So. ${wants(PROJECTS.walls.needs as Record<string, number>)}. Bring it to the pile by the yard; I've pinned what's wanted to a post there.`,
          "Oak: there's boughs down at the edge of your woods and up by the old tower, if you've a hatchet and a back. Reed grows along your lake. Wren sells it dried, down at the jetty. Nails, I make.",
          "Or buy the lot off me. Yard behind the forge. I'll not rob you. Much.",
          "When it's all there, me and the cooper's boys come up at first light. Three days: walls, rafters, thatch. After that, the hearth.",
        ],
        action: 'hs-osric',
        next: 'ask',
      },
      'hs-now': {
        speaker: 'smith',
        lines: Homestead.work
          ? [`Hm. We're on ${PROJECTS[Homestead.work.project].name.toLowerCase()}. Don't stand under the ladder.`]
          : first && Homestead.built.has('hearth')
            ? [
                "Hm. Plans are on the post by your pile. Well, herb beds, a lean-to, a paddock, a wall, slate. Pick one, bring what it wants, and the lads'll come.",
                `${PROJECTS[first].name}, say: that wants ${wants(Homestead.missing(first))}.`,
              ]
            : first
              ? [`Still wants ${wants(Homestead.missing(first))}. Then we come up.`]
              : ["Hm. Nothing. It's done. Go and sit in it."],
        next: 'ask',
      },
    },
  };

  // ---- Iran, in his hut: his stead.
  const iranAsk: DialogueChoice[] = [];
  const steadStarted = QuestLog.has(STEAD);
  const wanted = Homestead.steadWanted;
  if (!steadStarted) iranAsk.push({ text: 'Let me help you put the stead right.', next: 'hs-stead-offer' });
  else if (wanted > 0) {
    if (Inventory.coins > 0) iranAsk.push({ text: `Here, for the stead. (${Math.min(STEAD_GIFT, wanted, Inventory.coins)} coins)`, next: 'hs-stead-thanks', action: 'hs-iran-give' });
    if (Inventory.coins >= wanted && wanted > STEAD_GIFT) iranAsk.push({ text: `Here's all of it. (${wanted} coins)`, next: 'hs-stead-thanks', action: 'hs-iran-give-all' });
    iranAsk.push({ text: "How's the stead coming on?", next: 'hs-stead-how' });
  } else if (Homestead.steadWork) iranAsk.push({ text: "How's the stead coming on?", next: 'hs-stead-how' });
  const next = Homestead.nextStead;
  talk['iran-hiding'] = {
    speaker: 'iran',
    ask: iranAsk,
    flag: 'hs-told:iran',
    lines: {
      stay: [
        steadStarted
          ? "Stay? Lad, with what you're putting in, I'd be ashamed to leave."
          : "Where else would we go? The cooper's boys would put the coop up again, but there's oak to buy and they've their own bread to earn. It'll come, a piece at a time.",
        '...And somebody ought to be near her.',
      ],
    },
    nodes: {
      'hs-stead-offer': {
        speaker: 'iran',
        lines: [
          "Help? Lad, you've your own roof to think of. I'll not take your coin. I won't.",
          '(Hetty tugs his sleeve and whispers something. He sighs.)',
          "...Hetty says it's not charity if it's rent. For the plot, she means. She's her mother's daughter, that one.",
          "All right. Rent, then. Whatever you can spare, when you can spare it, and the cooper's boys will build with it. The coop first. Forty coins'd see that up. Then the hut wants thatching, then the fences, and then... well. A man can dream of a barn.",
        ],
        action: 'hs-iran-start',
        next: 'ask',
      },
      'hs-stead-thanks': {
        speaker: 'iran',
        lines: [
          next && Homestead.iranGiven + Math.min(STEAD_GIFT, wanted, Inventory.coins) >= next.at
            ? `That's enough for ${next.name}. I'll send for the lads. ...Thank you, ${HERO_NAME}. I'll not forget it.`
            : "Thank you, lad. It goes in the jar on the shelf, and it comes out for timber and nothing else. Pip's been told.",
        ],
      },
      'hs-stead-how': {
        speaker: 'iran',
        lines: [steadProgress()],
        next: 'ask',
      },
    },
  };
  return talk;
}

function headmanOnProgress(stage: string): string {
  switch (stage) {
    case 'ruin':
      return "Osric tells me you've been up there dragging out the old timbers on your own. Good. Some things a man should do with his own hands.";
    case 'cleared':
      return "Swept out, I hear. Now Osric. And mind he doesn't charge you for the nails twice; he did me, in '09.";
    case 'raising':
      return "I walked out to the Hollow road last evening and saw a roof going on. I had to sit down on the milestone a while. Old men are allowed.";
    case 'roofed':
    case 'furnishing':
      return 'A roof! And a hearth to come. Your mother would be scolding you about the draughts already.';
    default:
      return 'You sleep under your own roof again. That is all I wanted for you, lad. Now: rest.';
  }
}

function steadProgress(): string {
  const w = Homestead.steadWork;
  const next = Homestead.nextStead;
  if (w && next) return `The lads are on ${next.name}. They argue about it all day, so it must be going well.`;
  if (!next) return "It's all done, lad. More than I ever had. I go out of a morning and just look at it.";
  const built = STEAD_STAGES.filter((s) => Homestead.steadHas(s.id)).map((s) => s.name);
  const short = next.at - Homestead.iranGiven;
  return `${built.length ? `We've ${built[built.length - 1]}, thanks to you. ` : ''}Next is ${next.name}. ${short} coins more would see it done.`;
}

/** The men at work on the cottage, by day, while it's being rebuilt (see world/Homestead.ts). */
export function osricAtWork(): DialogueScript {
  const w = Homestead.work;
  const day = w ? Math.min(3, Math.floor((Homestead.clock() - w.from) / 24) + 1) : 1;
  const lines: Record<string, string[]> = {
    walls: [
      [
        "Hm. Day one. Cut out the burnt courses, new oak in, rafters up. Don't stand there; hold this.",
        "(He hands you a mallet and points at a peg. You hit it. He grunts.) Hm. Again.",
      ],
      ["Day two. Thatching. The lads go up, I stay down. Someone has to shout.", "Reed's good. Wren's, or yours? ...Hm. Yours. It'll do."],
      ["Last day. Ridge on by noon, scaffold down by dark. Then it's a house."],
    ][day - 1],
    hearth: [
      ["Hm. Hearth today. Stone's the easy part. It's getting it to draw that takes the knack."],
      ["Joiner's bringing the bed up this afternoon. Don't let him sell you a dresser."],
    ][Math.min(1, day - 1)],
  };
  const project = w?.project ?? 'walls';
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'smith',
        lines: lines[project] ?? [`Hm. ${PROJECTS[project].name}. Busy.`, "Pass me that bucket of nails."],
      },
    },
  };
}

const LAD_LINES: string[][] = [
  ["Mind the saw! ...Sorry. Osric says if I take a finger off he's docking my pay.", "We're not getting paid. That's how much he means it."],
  ["Hamm says you went down a goblin hole. Is that true? ...Can I see your knife?", "Osric! He's here! ...He's not listening."],
  ["Iran's lot keep bringing us bread. I'd build anything for that bread.", "Pip's been holding the ladder all morning. Not very well."],
];

/** One of the cooper's boys at work. */
export function ladAtWork(n: number): DialogueScript {
  return { start: 'greet', nodes: { greet: { speaker: 'cooper', lines: LAD_LINES[(n - 1) % LAD_LINES.length] } } };
}

/**
 * Someone's conversation with the rebuilding worked in, once Mother is buried.
 * The Headman's word on the Hollow ("the cottage is yours") leads straight on
 * to offering to start, until the hero has.
 */
export function homesteadAware(id: string, script: DialogueScript): DialogueScript {
  const talk = homesteadTalk()[id.replace(/-\d+$/, '')];
  if (!talk) return script;
  let out = applyRaidTalk(script, talk);
  const hollow = out.nodes['ashes-hollow'];
  if (hollow && !QuestLog.has(REBUILDING)) {
    out = {
      ...out,
      nodes: {
        ...out.nodes,
        'ashes-hollow': {
          ...hollow,
          next: undefined,
          choices: [
            { text: "I'm ready now. Let's put a roof on it.", next: 'hs-ready', key: true },
            { text: 'Not yet.', next: 'ask' },
          ],
        },
      },
    };
  }
  return out;
}

/** How many improvements are built, for anyone who asks. */
export function improvementsBuilt(): number {
  return IMPROVEMENTS.filter((p) => Homestead.built.has(p)).length;
}
