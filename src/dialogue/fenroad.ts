import { HERO_NAME } from '../config';
import type { DialogueChoice, DialogueScript } from './Dialogue';

/**
 * The Fen Road (world/FenRoadMap.ts): Captain Vosk giving the hero leave to
 * go out by the Fen Gate; Gammer Teal, the reed-cutter who lives a mile out on
 * the causeway and lights its lamps; and Edric Lowe hearing what the hero found
 * at the Drowned Mile.
 *
 * What's out there (see the shared cast notes, and systems/Guild.ts): a band of
 * lizard men out of the deep fen, led by a great white lizard, paid in new
 * silver to wreck the guild's caravans. Nobody in town knows it yet. Gammer
 * Teal has seen more than anyone, and calls them the Mere-kin, the old name.
 */

/** Pick one of several lines at random. */
const pickOne = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

/** Adds a reply and its nodes to a script's 'ask' list (before the last reply, the goodbye). */
function weave(script: DialogueScript, choice: DialogueChoice | undefined, nodes: DialogueScript['nodes']): DialogueScript {
  const ask = script.nodes.ask;
  if (!ask?.choices || !choice) return { ...script, nodes: { ...script.nodes, ...nodes } };
  const choices = [...ask.choices];
  choices.splice(Math.max(0, choices.length - 1), 0, choice);
  return { ...script, nodes: { ...script.nodes, ...nodes, ask: { ...ask, choices } } };
}

// ---------------------------------------------------------------------------
// Captain Vosk, at the gate
// ---------------------------------------------------------------------------

/** Where the hero stands, for Vosk's talk about the gate. */
export interface FenGateTalk {
  /** He's already given leave, and the gate stands open. */
  open: boolean;
  /** The Merchants of the Causeway have taken the hero on about the raids. */
  hired: boolean;
  /** The hero brought him the Reeve's true book (the toll house): he owes them. */
  owed: boolean;
  /** The hero has seen the tracks at the wreck. */
  tracks: boolean;
  /** And told him about them. */
  toldVosk: boolean;
}

/**
 * Vosk's gate: asking him to open it now leads to his asking why, and then to
 * his opening it, with a warning (the old 'No' is gone: his gate opens for a
 * reason, and any honest one will do). Once it's open, he asks what's out there.
 */
export function voskFenTalk(script: DialogueScript, f: FenGateTalk): DialogueScript {
  const ask = script.nodes.ask;
  const choices = (ask?.choices ?? []).filter((c) => c.next !== 'shut');
  const nodes: DialogueScript['nodes'] = { ...script.nodes, ask: { ...ask, choices } };
  if (f.open && nodes.again) nodes.again = { ...nodes.again, lines: [pickOne(["Gate's open to you. I still don't like it.", 'Back in one piece. Good. Keep it that way.', 'Mind the logs out there. Half of them are only pretending.'])] };
  const base = { ...script, nodes };
  if (f.open) {
    const choice: DialogueChoice = f.tracks && !f.toldVosk
      ? { text: 'I found tracks at the wreck. Something with claws, and a tail, that went into the water.', next: 'fen-tracks', key: true }
      : { text: 'About the causeway...', next: 'fen-after' };
    return weave(base, choice, {
      'fen-tracks': {
        speaker: 'vosk',
        lines: [
          "(He doesn't laugh. He looks past you, out through the arch, at the fog.) Three toes, long. A spur at the back. And between the prints, a furrow, like a man dragging a rope.",
          "I've seen them. In the mud under the wall, at dawn, after a night of fog. I told you: things come up to the wall and stand there. I never said what they were. I didn't know what to call them, and a captain who says lizards to the town council is a captain out of a job.",
        ],
        next: 'fen-tracks2',
      },
      'fen-tracks2': {
        speaker: 'vosk',
        lines: [
          "They never touched a cart before this spring. Never needed to. Something's changed, out there, or someone's changed it. (He spits.) And it's the guild's road, so it's the guild's trouble, and the town will sit and watch till it's the town's.",
          `Tell Lowe. He's the only one in that hall with his eyes open. And ${HERO_NAME}: when you go out again, take a lantern, and don't go past where the road goes under.`,
        ],
        action: 'fen-told-vosk',
        next: 'ask',
      },
      'fen-after': {
        speaker: 'vosk',
        lines: [
          pickOne([
            "Keep to the logs. Turn back where the water's over them. Don't follow any light you didn't light yourself. That's all the wisdom this gate has, and it's kept me alive.",
            "Gammer Teal will tell you more than I can. She's been out there sixty years. Whether she'll tell you the truth is another thing.",
            "The lads lean on the gate and watch the road for you. They won't say so. Brakk's started a wager on when you'll be back. He's lost twice.",
          ]),
        ],
        next: 'ask',
      },
    });
  }
  const choice: DialogueChoice = { text: 'Open the gate, Captain. I need to go out on the causeway.', next: 'fen-why', key: f.hired };
  return weave(base, choice, {
    'fen-why': {
      speaker: 'vosk',
      lines: [
        "(He looks at you for a long moment, the way a man looks at a horse he's been asked to buy.) Do you, now. Out there. On foot. Why?",
      ],
      choices: [
        ...(f.hired ? [{ text: "The guild has taken me on. I'm going to look at the wreck at the Drowned Mile.", next: 'fen-guild', key: true }] : []),
        ...(f.owed ? [{ text: 'I did you a good turn with the Reeve, Captain. Do me one.', next: 'fen-owed' }] : []),
        ...(!f.hired ? [{ text: "Someone has to find out what's been wrecking the caravans.", next: 'fen-raids' }] : []),
        { text: "I want to see what's out there for myself.", next: 'fen-see' },
        { text: 'Never mind.', next: 'ask' },
      ],
    },
    'fen-guild': {
      speaker: 'vosk',
      lines: [
        "Wexley's hired a farm hand to do what his whole hall wouldn't. That's Wexley. (Something nearly like a smile.) No offence meant. It's more than he's done in a year.",
        "Garrow came in through this gate on his knees, with his arm broke, the night it happened. He wouldn't say what he'd seen. Just kept asking for a light. Lowe sent you, did he? Then Lowe's not as mad as they say.",
      ],
      next: 'fen-open',
    },
    'fen-owed': {
      speaker: 'vosk',
      lines: ['(He grunts.) So you did. And I said the town wouldn\'t thank you and I would. Well. This is me, thanking you. Don\'t make me regret it.'],
      next: 'fen-open',
    },
    'fen-raids': {
      speaker: 'vosk',
      lines: [
        "Someone does. The guild won't, and the Reeve won't, and I can't leave the gate. (He rubs his jaw.) Three caravans since the spring, and one man walked back. You'll want to be cleverer than the other ones.",
      ],
      next: 'fen-open',
    },
    'fen-see': {
      speaker: 'vosk',
      lines: [
        "Curiosity. That's what's on half the stones in the Lady's churchyard, if they'd carved anything. (He sighs.) Your neck, not mine. I'm a gate captain, not your mother.",
      ],
      next: 'fen-open',
    },
    'fen-open': {
      speaker: 'vosk',
      lines: [
        "Here's how it is. Keep to the logs. Where the water's up over them, turn back; the causeway goes down to nothing past the Drowned Mile, and the bog has no bottom. Don't follow any light out there you didn't light yourself.",
        "A mile out there's Gammer Teal, who cuts reed, by the Lady's post. She's cracked as an old pot, and she knows that fen better than anyone living. Be civil to her.",
        "(He turns and shouts up at the gatehouse.) Brakk! Fitch! Get the bar off! (Then, to you.) It's open to you now, coming and going. Don't make me sorry.",
      ],
      action: 'fen-gate-open',
    },
  });
}

// ---------------------------------------------------------------------------
// Gammer Teal, the reed-cutter
// ---------------------------------------------------------------------------

/** What Gammer Teal knows about the hero. */
export interface GammerTalk {
  first: boolean;
  /** Working for the guild on the raids. */
  hired: boolean;
  /** Has seen the wreck, and the tracks. */
  wreck: boolean;
  tracks: boolean;
  /** Picked up the white scale. */
  scale: boolean;
  /** Has heard her tell of the white one. */
  heardWhite: boolean;
  /** Left something for the Lady at her shrine. */
  offered: boolean;
  coins: number;
}

/**
 * Gammer Teal: very old, bent nearly double, sharp as her reed-hook. She has
 * cut reed out here for sixty years, sells it and eels to the town, keeps the
 * Lady's shrine and lights the old Marrable lamps of an evening, "for whoever
 * else is walking". She saw the man in grey go by in his punt, and he paid her
 * not to have; she has heard the Mere-kin, and once, seen the white one.
 */
export function gammerScript(t: GammerTalk): DialogueScript {
  return {
    start: t.first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'gammer',
        lines: [
          "(An old woman, bent nearly double, is cutting reed at the water's edge with a hook on a pole. She doesn't look up.) Vosk let you out, did he. Then either he likes you, or he wants rid of you. With Vosk it's hard to tell.",
          "(Now she looks: one eye bright and black, the other milky as a boiled egg.) Teal. Gammer Teal, they call me in town, them as call me anything. I cut reed. Sixty years I've cut reed. Half the roofs in Gloomhaven are mine. The other half leak.",
        ],
        next: 'ask',
      },
      again: {
        speaker: 'gammer',
        lines: [
          pickOne([
            "(Swish, swish, goes the hook.) Still alive, then. The fen's in no hurry. It never is.",
            "You again. Sit on the stool if you're stopping. Don't if you're not.",
            "(She is talking quietly to the water, and stops.) Oh. It's you. I wasn't talking to anybody.",
          ]),
        ],
        next: 'ask',
      },
      ask: {
        speaker: 'gammer',
        lines: ['Well?'],
        choices: [
          { text: 'Have you been out to the Drowned Mile? The wreck?', next: 'wreck', key: t.hired && !t.wreck },
          ...(t.tracks ? [{ text: 'Something left tracks at the wreck. Claws. A tail. It went into the water.', next: 'merekin', key: !t.heardWhite }] : []),
          ...(t.scale ? [{ text: '(Show her the white scale.)', next: 'scale', key: !t.heardWhite }] : []),
          { text: 'Who lights the lamps along the causeway?', next: 'lamps' },
          { text: 'Who is the Lady?', next: 'lady' },
          { text: 'Do you live out here alone?', next: 'alone' },
          { text: "I'll leave you to your reed.", next: 'bye' },
        ],
      },
      wreck: {
        speaker: 'gammer',
        lines: [
          "Half a mile on, where the oaks give out and the water comes up both sides. The causeway runs low there, low as a sow's belly, and the reeds come up over your head. Drowned Mile. It always was. My granddam called it that when the logs were new.",
          "The wagons are still there. Nobody's been back for them. Nobody's buried the ox, and the crows are very grateful.",
        ],
        next: 'wreck2',
      },
      wreck2: {
        speaker: 'gammer',
        lines: [
          "I heard it. The night of it. Sound carries on the water, in fog. Not shouting. Hissing. Like a choir of kettles on the boil. And the oxen screaming. You don't forget an ox screaming.",
          "And at first light, a punt went by. Here. Close as you are. Poled up from the north, from the Mile, by a man in a good grey coat with clean boots. Clean boots, out here.",
        ],
        next: 'wreck3',
      },
      wreck3: {
        speaker: 'gammer',
        lines: [
          "(She opens her hand. On the palm, a thin bright coin: a tower, and a star over the tower.) He gave me that. A silver penny, he said, not to have seen him. So I didn't. I'm telling you what I didn't see.",
          '(She closes her hand.) I\'m keeping it. The Lady can have it, when I\'m done with it.',
        ],
        action: 'fen-gammer-punt',
        next: 'ask',
      },
      merekin: {
        speaker: 'gammer',
        lines: [
          "(She stops cutting.) So you've seen their marks. Good. Now you know, and you can stop wondering, which is worse.",
          "The Mere-kin, the old folk called them. Scaly folk, out in the deep fen past the Mile, where the water goes black and doesn't stop. They were always there. My granddam left them eels on the far bank, and they left her be. They kept themselves to themselves.",
        ],
        next: 'merekin2',
      },
      merekin2: {
        speaker: 'gammer',
        lines: [
          "Never came up on the road, not in sixty years. Not till this spring. Now they're up on it bold as yellowbands, and there's more of them every month, and fatter.",
          "And there's a white one.",
        ],
        next: 'white',
      },
      scale: {
        speaker: 'gammer',
        lines: [
          "(She takes it from you very carefully, holding it by the edges, and turns it to the light.) Oh, yes. Oh, that's off him. That's off the white one.",
        ],
        next: 'white',
      },
      white: {
        speaker: 'gammer',
        lines: [
          "I've seen him once. At dusk, on the far side of the mere, sat up on a drowned oak like a king on his chair, with the others in the water round him like dogs. Big as your Brakk at the gate, and bigger. White all over, white as a drowned man's belly. And still. Watching the road.",
          "He's old. Older than the causeway, maybe. Things don't grow that big quick. And he's clever. They never cared for the road before. Somebody's given him a reason to.",
        ],
        next: 'white2',
      },
      white2: {
        speaker: 'gammer',
        lines: [
          "Where do they come from? North. Past where the causeway goes under. Past where any road goes. There's old stones out there, my granddam said, that were there before the fen came. I've never been, and I've lived to be old.",
          '(She goes back to her reed.) You\'ll go anyway. I can see it on you. Take a light, and leave something for the Lady first.',
        ],
        action: 'fen-gammer-white',
        next: 'ask',
      },
      lamps: {
        speaker: 'gammer',
        lines: [
          "I do. Some of them. The ones that still take a flame. The Marrables put them up, the whole way to the Saltway, when the causeway was new, so the carts could go by night. The carts don't, now.",
          'So I light them for whoever else is walking. (She looks at you with the black eye.) There\'s always somebody walking, out here, of a night. You\'ll see.',
        ],
        next: 'ask',
      },
      lady: {
        speaker: 'gammer',
        lines: [
          "The Lady of the Mere. She's in the water, and the water's everywhere, so she's everywhere. Gloomhaven used to keep her proper. There was a church for her, before it was a church for the other one, and now it's under the river anyway.",
          t.offered
            ? "You left her something. I saw. (She nods, satisfied.) She'll remember. She remembers everything."
            : "Leave her something when you pass her post. A copper, a crust, a bit of ribbon. She doesn't want much. She takes the ones who give her nothing, in the end.",
        ],
        next: 'ask',
      },
      alone: {
        speaker: 'gammer',
        lines: [
          "Alone? (She laughs, a sound like a stick in a fire.) There's the heron, who comes for the eel guts. There's the Lady. There's the lamps. There's whoever's walking. I'm never alone out here. It's in town I'm alone.",
          'I had a husband. He went out after eels one fog, and the fen kept him. That was forty years ago. I still set his bowl, some nights. He never comes for it. But it gets eaten.',
        ],
        next: 'ask',
      },
      bye: {
        speaker: 'gammer',
        lines: [pickOne(["Keep to the logs.", '(Swish, swish.)', "Mind the Lady.", "Don't follow the lights."])],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Edric Lowe, back at the Guildhall
// ---------------------------------------------------------------------------

/** What the hero can tell Edric about the Drowned Mile. */
export interface WreckReport {
  /** Seen the tracks (and so has something to tell). */
  tracks: boolean;
  /** Already told him. */
  told: boolean;
  /** Carrying the white scale. */
  scale: boolean;
  /** Heard from Gammer Teal about the man in grey's punt. */
  punt: boolean;
  /** Thrale is in the room: Edric won't talk. */
  thraleHere: boolean;
}

/** Edric hears what the hero found at the wreck (once the guild has hired them and he's sent them there). */
export function edricWreckTalk(script: DialogueScript, r: WreckReport): DialogueScript {
  if (!r.tracks || r.thraleHere) return script;
  const choice: DialogueChoice = r.told
    ? { text: 'About the lizard men...', next: 'fen-again' }
    : { text: "I've been out to the wreck at the Drowned Mile.", next: 'fen-wreck', key: true };
  return weave(script, choice, {
    'fen-wreck': {
      speaker: 'edric',
      lines: [
        '(He takes his spectacles off, and puts them on again, and listens without once interrupting, which looks as if it costs him.)',
        "The salt left. The eels left. Tunstall's scarlet slashed and Marrable's wool burnt, and the lead wagon pushed off the road into the bog. Not robbery. Ruin. Somebody wanted those two members ruined, and was particular about it.",
      ],
      next: 'fen-wreck2',
    },
    'fen-wreck2': {
      speaker: 'edric',
      lines: [
        "And the tracks. Three toes and a tail, going down into the mere. (He doesn't laugh. He goes rather pale.) Lizards. Men like lizards. Garrow said low and quick and hissing, and they went into the water and never came up. Of course they didn't. They didn't need to.",
        r.scale
          ? "(You show him the scale. He turns it over and over in his long fingers, and holds it to the window, and the light comes through it white.) Keep it. Keep it safe, and don't show it to anyone in this hall. It's the first thing anyone's brought back from the Drowned Mile that a man can't call a knock on the head."
          : 'There are stories at Hallowmarket of marsh-folk in the south, who trade with nobody, who were paid once by a duke to sink his rival\'s barges. Paid. They took payment.',
      ],
      next: 'fen-wreck3',
    },
    'fen-wreck3': {
      speaker: 'edric',
      lines: [
        r.punt
          ? "And a man in grey, in a punt, poling away from it at dawn, who pays old women in tower silver not to have seen him. (Very quietly.) Then someone is paying them. And I think we both know what the coin looks like."
          : "Garrow's man in grey, in his punt, watching. Like a man at a cattle sale, he said. Like a man checking he'd had what he paid for.",
        "I can't take this to the table. Thrale would have them laughing in a moment: the farm hand has seen lizards. Not yet. We need where they come from. Where they go back to, after. Who meets them there, and with what.",
        'Garrow says they went into the water, north. Find where. And be careful. Please. I have only just found someone who listens.',
      ],
      action: 'fen-report',
      next: 'ask',
    },
    'fen-again': {
      speaker: 'edric',
      lines: [
        pickOne([
          "Where they go back to. That's what we need. And who meets them there.",
          "(Quietly.) I've been reading everything the guild has on the fen north of the Mile. It's very little, and most of it says HERE BE NOTHING. I don't believe it.",
          "Have you shown the scale to anyone? Don't. Not yet.",
        ]),
      ],
      next: 'ask',
    },
  });
}
