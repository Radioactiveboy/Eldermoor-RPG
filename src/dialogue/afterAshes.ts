import { HERO_NAME } from '../config';
import { QuestLog } from '../systems/Quests';
import type { RaidTalk } from './afterRaid';
import type { ChildLine } from './iran';
import type { DialogueChoice, DialogueScript, SpeakerId } from './Dialogue';

/**
 * How Adowvale talks once Ashes is over: the hero has been down the goblins'
 * hole on the Greyfells, killed the Brute, lost Mother in the brood hall, come
 * out with the orb, buried her in the Hollow, and woken two days later at the
 * Crooked Tankard (see scenes/game/warren.ts).
 *
 * Everyone who mattered has something to say: grief for Mother, and plain
 * pride in what the hero did under the hill, coloured by how the night at the
 * gate went (held, or the bakery burnt and Hilde carried off), by who was let
 * out of the goblins' pen (Hilde or Coombe, who are now at the Tankard), and
 * by who went down with the hero (Sigrun, Wat).
 *
 * This is the last layer of {@link raidAware} (dialogue/afterRaid.ts): the
 * raid's own talk still applies underneath, but nobody says their old opening
 * piece any more ("is it true they took your mother?"), and nobody offers to
 * help get her back. {@link ASHES_STALE} are the choices that go.
 */

/** Ashes is over: Mother is buried in the Hollow, and The Watcher in the Glass has begun. */
export const ashesOver = (): boolean => QuestLog.isDone('the-raid', 'bury');

/** The flag kept once someone has said their piece about the warren and Mother. */
export const toldOfAshes = (speaker: SpeakerId | string) => `ashes-told:${speaker}`;

/** Who went down into the warren with the hero (kept at the burial, scenes/game/warren.ts). */
export const wentDown = (companion: 'sigrun' | 'wat') => `ashes-with:${companion}`;

/** Everything about how Ashes went that the village knows, or can guess. */
export interface AshesState {
  /** The militia held the old road the night the goblins came (else they got in, burnt the bakery and took Hilde). */
  held: boolean;
  /** Who the hero let out of the goblins' pen: they're staying at the Tankard now. */
  freed?: 'hilde' | 'coombe';
  /** Who is still down there, if nobody was let out. */
  penned?: 'hilde' | 'coombe';
  /** Sigrun went down with the hero. */
  sigrun: boolean;
  /** So did Wat. */
  wat: boolean;
  /** The Headman paid Sigrun's hire. */
  sigrunPaid: boolean;
  /** The hero has told the Headman about the voice in the orb. */
  toldOrb: boolean;
  /** The Headman's purse has been settled one way or another. */
  purseSettled: boolean;
}

export function ashesState(): AshesState {
  const hildeTaken = QuestLog.hasFlag('hilde-taken');
  const prisoner = hildeTaken ? 'hilde' : 'coombe';
  const freed = QuestLog.hasFlag('pen-freed');
  return {
    held: !QuestLog.hasFlag('gate-fell'),
    freed: freed ? prisoner : undefined,
    penned: freed ? undefined : prisoner,
    sigrun: QuestLog.hasFlag(wentDown('sigrun')),
    wat: QuestLog.hasFlag(wentDown('wat')),
    sigrunPaid: QuestLog.hasFlag('headman-pays-sigrun'),
    toldOrb: QuestLog.hasFlag('told-headman-orb'),
    purseSettled: QuestLog.hasFlag('ashes-purse'),
  };
}

/**
 * Choices nobody offers once Mother is buried, by the node they lead to:
 * asking after her, asking for help to fetch her back, warning of a night
 * that's been and gone, and the Headman's arrangements for Sigrun.
 */
export const ASHES_STALE = [
  'raid-mother', 'raid-north', 'raid-help', 'raid-hunt', 'raid-saw', 'raid-men', 'gate-warn',
  'raid-greyfells', 'raid-sigrun',
];

/** Who's who in the lines below. */
const who = (s: AshesState) => ({
  /** "and Sigrun", "and Wat", "and Sigrun and Wat", or nothing. */
  party: s.sigrun && s.wat ? ' with Sigrun and Wat at your back' : s.sigrun ? ' with Sigrun at your back' : s.wat ? ' with young Wat at your back' : ' on your own',
});

/** What each person says now, by whose talk it is (as in afterRaid.ts: 'guard' is all the militia). */
export function ashesTalk(s: AshesState): Record<string, RaidTalk> {
  const { party } = who(s);
  const t: Record<string, Omit<RaidTalk, 'flag'>> = {
    // ---- The Headman's house ----
    headman: {
      speaker: 'headman',
      first: [
        `${HERO_NAME}. Come in, lad. Sit. No, sit, I insist. Aldwin can tut at the floor after.`,
        'I heard. Godric came over the night you brought her home, and stood in my hall with his hat in his hands, and could not get the words out. I am so very sorry. Your mother was the best of us.',
        `And I will say the other thing as well, because somebody ought to say it plainly.`,
        `You went down into that hill${party}, where my grandfather's men would not go, and you came back up.`,
        `The Brute that burnt the Hollow is dead. Their brood is dead. The shepherds say there is not a fire burning on the Greyfells.`,
        s.held
          ? "Adowvale is standing because you stood on the old road with Brannock's lads. I have written that to Lord Morten in so many words. Let him underline that."
          : "We lost the bakery the night they came, and very nearly Hilde, and I do not hold you to account for it. I hold myself. What you did after, under the hill, this village will not forget.",
        ...(s.purseSettled ? [] : ['There is a matter of the village chest, too, before you go. Ask me about it.']),
      ],
      lines: {
        bye: ['Rest, lad. Properly. And come back to me.'],
      },
      ask: [
        { text: 'About the village chest.', next: 'ashes-purse' },
        { text: 'Something spoke to me down there, out of a glass orb.', next: 'ashes-orb' },
        { text: 'About the orb.', next: 'ashes-orb-again' },
        { text: 'What happens to the Hollow now?', next: 'ashes-hollow' },
        ...(s.penned === 'hilde' ? [{ text: 'I saw Hilde down there, in a pen. I never got her out.', next: 'ashes-hilde' }] : []),
        ...(s.sigrunPaid && s.sigrun ? [{ text: 'Sigrun earned her coin.', next: 'ashes-sigrun' }] : []),
      ],
      when: {
        'ashes-purse': () => !s.purseSettled,
        'ashes-orb': () => !s.toldOrb,
        'ashes-orb-again': () => s.toldOrb,
      },
      nodes: {
        'ashes-purse': {
          speaker: 'headman',
          lines: [
            'The village chest. I told you once that this is what it is for, and I meant it. Sixty coins. The reeve counted it twice and complained both times.',
            'It is not payment. Nobody could pay for what you have lost, and I would not insult you by trying. Call it the village saying thank you, in the only words it has.',
          ],
          choices: [
            { text: 'Thank you, Headman. I will take it.', next: 'ashes-purse-kept', action: 'ashes-purse-kept' },
            { text: 'Give it to Iran, for his hens and his coop.', next: 'ashes-purse-given', action: 'ashes-purse-iran' },
            ...(s.held ? [] : [{ text: "Put it toward Hilde's bakery.", next: 'ashes-purse-given', action: 'ashes-purse-bakery' } satisfies DialogueChoice]),
          ],
        },
        'ashes-purse-kept': {
          speaker: 'headman',
          lines: ["Good. Buy yourself a coat that has not been down a goblin hole. And eat something; Marjory says you look like a rake with a shirt on."],
          next: 'ask',
        },
        'ashes-purse-given': {
          speaker: 'headman',
          lines: [
            '...Your mother would have done exactly that. I should have known you would.',
            'It will be done today. And I will see the village hears who it came from, whether you like it or not.',
          ],
          next: 'ask',
        },
        'ashes-orb': {
          speaker: 'headman',
          action: 'told-headman-orb',
          lines: [
            '(The Headman puts down his pen.) An orb. Tell me what it said. Every word.',
            '"Leave nothing standing in Adowvale." ...Goblins do not write letters to one another, lad, and they do not take their orders from glass.',
            'Somebody wanted a healer out of the Hollow, and somebody wants this village gone. That is not a raid. That is a war, and we did not know we were in it.',
            'Your father. Aldo. I knew him.',
            'He kept the watch at the old tower in the north woods, and when Lord Morten\'s father had the watch taken down, it was my name under the order beside his.',
            'The village could not pay its share of the watchmen. Aldo stood in this hall and told me we would be sorry.',
            'I am sorry now. ...Keep that thing close, and keep it quiet. And come back to me when you have rested. I have been thinking about the old watch, and what it would take to open it up again.',
          ],
          next: 'ask',
        },
        'ashes-orb-again': {
          speaker: 'headman',
          lines: [
            "Keep it close, and keep it quiet. I have told Brannock, and nobody else, and he did not like it any better than I did.",
            'Whoever looked out of that glass knows your face now. I would rather they did not know where you sleep.',
          ],
          next: 'ask',
        },
        'ashes-hollow': {
          speaker: 'headman',
          lines: [
            "The cottage is yours, and the land, and I have written that in the village book in my own hand: nobody is to touch it.",
            "When you are ready, and only when you are ready, there will be men to put a roof on it again. Osric has said so, and the cooper's boys, and half the Tankard.",
            'Iran is keeping the grave. He goes up every morning with the children. Hetty takes flowers. I thought you would want to know.',
          ],
          next: 'ask',
        },
        'ashes-hilde': {
          speaker: 'headman',
          lines: [
            '(He is quiet for a long moment.) Then she may still be alive. Gods. Alive, down there.',
            "Brannock has no men to send that he would get back. I know that. You know that. I will not ask it of you.",
            "But if you find you can go back down, lad, I will not stand in your way, and the village chest will pay whoever goes with you.",
          ],
          next: 'ask',
        },
        'ashes-sigrun': {
          speaker: 'headman',
          lines: [
            'So Godric tells me. She sent me her bill the morning after, written on the back of one of the sergeant\'s notices.',
            'I paid it twice. I told her the second was for bringing you back. She told me I was a soft old fool. I believe that was a compliment.',
          ],
          next: 'ask',
        },
      },
    },
    steward: {
      speaker: 'steward',
      first: [
        "Good day. ...You may leave your boots as they are. Just today.",
        'The Headman is expecting you. He has been expecting you for two days, and he has been sleeping, which he had not done for a week before that. I have you to thank for it, I think.',
      ],
      lines: {
        raid: [
          "Sleeping, at last. He sat up the night you brought your mother home, and then he slept like a child. I put a blanket over him myself.",
          'Speak with him. He has things he wishes to say to you, and he is no better at saying them than he was at six.',
        ],
      },
    },
    housemaid: {
      speaker: 'housemaid',
      first: [`Oh! It's you. ${HERO_NAME}. Everyone's talking about you, all down the lane. I'm sorry about your mum. I'm so sorry.`],
      at: 'greet',
    },
    housecook: {
      speaker: 'housecook',
      first: [
        'There he is. Sit down. Thinner, you are, and grey round the eyes.',
        "The Headman ate his whole plate last night, first time since the Hollow. I'm telling you that because I think it's your doing, and because nobody else will.",
      ],
    },
    // ---- The garrison ----
    sergeant: {
      speaker: 'sergeant',
      first: [
        `${HERO_NAME}. ...Sit down. I'll not say much. I've never been any good at this.`,
        "I held the lads back the morning the Hollow burned, and I'd do it again, and I'll be sorry for it every day I've got left.",
        "And then you went down into that hill on your own two feet and did what I couldn't send a man to do.",
        s.held
          ? "And the night on the old road. My lads stood because you stood first. Garrick tells it with you killing forty. It was nine. I counted."
          : "The night on the old road, they got past us. Past me. That's mine to carry, not yours. You went and finished it anyway.",
        ...(s.wat ? ["And you brought Wat back. In one piece, near enough. His mother was at my door every hour you were gone, and now she's at it to thank me, which is worse."] : []),
        ...(s.freed === 'hilde' ? ['Hilde walked in through the gate at dawn with a rock in her fist. I nearly wept in front of the lads. Nearly.'] : []),
        ...(s.freed === 'coombe' ? ['Coombe came down off the fell and stood in my guardroom and thanked me for my trouble. Coombe. I think you broke something in him.'] : []),
        "Your mother. I'm sorry.",
      ],
      lines: {
        bye: ["Get some sleep. That's an order, and you're not even one of mine."],
      },
      ask: [
        { text: 'Are there any goblins left out there?', next: 'ashes-goblins' },
        { text: 'What happens to the militia now?', next: 'ashes-militia' },
        { text: 'Did the Headman tell you about the orb?', next: 'ashes-orb' },
      ],
      when: { 'ashes-orb': () => s.toldOrb },
      nodes: {
        'ashes-goblins': {
          speaker: 'sergeant',
          lines: [
            "Hamm and two of the lads went up as far as the camp on the Greyfells yesterday. Empty. Cold fires and bones.",
            "The hole in the hill still breathing warm air, and not a sound out of it. They didn't go closer, and I didn't ask them to.",
            "Broken, I'd say. Not finished. You don't finish goblins, my grandad said. You teach them to stay down.",
          ],
          next: 'ask',
        },
        'ashes-militia': {
          speaker: 'sergeant',
          lines: [
            "We bar the gate at dusk till I'm sure. The lads have stopped throwing spears at hens. Mostly.",
            "And every one of them wants to stand you a drink. Let them. It'll do them more good than it does you.",
          ],
          next: 'ask',
        },
        'ashes-orb': {
          speaker: 'sergeant',
          lines: [
            "He did. I don't hold with glass that talks. I don't hold with anything that sends goblins after a sick woman, either.",
            "If something out there is giving them their orders, then the watch I keep is the wrong shape for it. Twelve lads round a square. I'm thinking about that. I'm thinking about it a lot.",
          ],
          next: 'ask',
        },
      },
    },
    jailer: {
      speaker: 'jailer',
      first: [
        "You went down! Down the actual goblin hole! ...Sorry. Sorry about your mother. The sergeant says I'm to say that first and I forgot.",
        "The goblin's gone quiet since. Won't hiss. Just sits in the back of the cell. I don't like it. I liked it better when it bit.",
      ],
    },
    snikkit: {
      speaker: 'snikkit',
      at: 'told',
      lines: {
        told: [
          "(It's sitting very still at the back of the cell. It doesn't hiss.)",
          'Long-legs. Snikkit knows. Snikkit felt it, in the night: the Mother went cold. All of us feel it, everywhere. Like a fire going out in the belly.',
          "And long-legs' mother too. Hsss. Snikkit is... Snikkit has no word for it in long-legs talk. Snikkit is that word.",
        ],
        bye: ['Hsss. Go, long-legs.'],
      },
      drop: ['where', 'healer', 'threat'],
      ask: [
        { text: 'Something spoke out of an orb, down there. What was it?', next: 'ashes-glass' },
        { text: 'What happens to your people now?', next: 'ashes-brood' },
      ],
      nodes: {
        'ashes-glass': {
          speaker: 'snikkit',
          lines: [
            '(Its ears go flat to its skull.) The Glass. The cold voice. The Shamans listen to it at night, with their faces in the green light. Snikkit never listens. Snikkit is only a fetcher.',
            'It says, and the Mother obeys. It wants, and the Brute goes. It wanted the long-legs healer. It wanted the little houses burnt. Snikkit does not know why. Snikkit does not know where it is. Far. Cold. That is all.',
            '...It will want something new now. Snikkit is glad Snikkit is in here.',
          ],
          next: 'told',
        },
        'ashes-brood': {
          speaker: 'snikkit',
          lines: [
            'No Mother. No eggs. The Shamans will fight. The big ones will go off on their own, in bands, and be hungry.',
            "Snikkit's people is finished, maybe. Or maybe not. Goblins is hard to finish. Long-legs knows that now.",
          ],
          next: 'told',
        },
      },
    },
    // ---- The market square ----
    guard: {
      speaker: 'guard',
      first: s.held
        ? [
            `It's ${HERO_NAME}! Lads! LADS! ...Sorry. Sorry. We heard. About your mother. I'm sorry.`,
            "But you went down the hole. Down the actual hole! Garrick says he'd have gone with you if you'd asked. Garrick's a liar, but he means it.",
            ...(s.wat ? ["And you brought Wat back! He's not stopped talking since. To hear him tell it, he killed the Brute himself."] : []),
          ]
        : [
            `${HERO_NAME}. ...We heard. We couldn't hold the road that night, and you went up there and finished it anyway. I'm sorry about your mother. We all are.`,
            ...(s.wat ? ["And Wat came back with you. We'd given him up. Don't tell him that."] : []),
          ],
      lines: {
        bye: ["Go careful. We've got the gate."],
        wolves: [
          'Goblins. My gran told us about goblins to make us eat our greens. Then there was a band of them burning farms an hour from here. And then you went down their hole and put a stop to it.',
          "I'll eat my greens, though. Just in case.",
        ],
      },
    },
    baker: {
      speaker: 'baker',
      first: [
        "Oh, love. Oh, come here. ...No, don't say anything. You don't need to say anything.",
        "I told you, you bring her home. I said it like it was a thing a body could promise. And you did bring her home, you did, only not... Oh, I'm sorry. I'm a daft old woman.",
        "Forty years she sold eggs off the end of my stall. I'll not have another egg-woman there. I'll not.",
        "There's a loaf in that basket with your name on it, and there'll be one every morning. Every morning, mind.",
      ],
      lines: {
        bye: ['Mind how you go, love. And come by. Every day, mind.'],
      },
      ask: [{ text: 'What are folk saying in the square?', next: 'ashes-square' }],
      nodes: {
        'ashes-square': {
          speaker: 'baker',
          lines: [
            "That you went down a goblin hole and came up again with your mother in your arms, and the Brute dead behind you. Odo says you carried her all the way down off the fell. Is that true? ...Oh, love.",
            ...(s.freed === 'coombe'
              ? ["And that Coombe's sat by Godric's fire buying rounds. Coombe! I went in to see for myself. He bought me a cider and said sorry for the business with the mud. Thirty years ago, that was."]
              : []),
            'Tamsin says your boots are on her from now on. Tamsin! She has never given anything away in her life.',
          ],
          next: 'ask',
        },
      },
    },
    smith: {
      speaker: 'smith',
      first: [
        'Hm. ...Heard.',
        "I've made something. For the cairn. An iron band, to go round the foot of the stones, so the frost doesn't shift them. It's at the forge. I'll carry it down the Hollow when you say.",
        "And the Brute's dead. Good. ...Good.",
        ...(s.held ? [] : ["I've been at Hilde's bakery every morning, clearing the ash, before I light my own fire. Don't tell her. She'll make a fuss."]),
      ],
      drop: ['raid-goblins'],
      ask: [{ text: 'Thank you, Osric.', next: 'ashes-thanks' }],
      nodes: {
        'ashes-thanks': {
          speaker: 'smith',
          lines: [
            "Hm. Don't.",
            '...She mended my hand once. Burnt to the bone, when I was a lad, and too proud to go to the brothers. Never told anyone. There. Now I have.',
          ],
          next: 'ask',
        },
      },
    },
    tanner: {
      speaker: 'tanner',
      first: [
        "You're back. ...I'm sorry. About her. I'm no good at this, so I'll say the useful thing.",
        "Any boots you want, from now on, are on me. No, you're not paying. I'll not hear of it, and I have never said that to anyone in my life, so don't make me say it twice.",
      ],
      lines: {
        bye: ["Go on. And come back with all your hide on. You've a habit of it now; don't break it."],
      },
    },
    // ---- The Crooked Tankard ----
    landlord: {
      speaker: 'landlord',
      first: [
        "There you are. Up and about. Good. ...Sit, lad, sit. Nell! A bowl for him, and the good bread.",
        "And I'll not take a coin for that room. Not now, not ever. Don't argue with me in my own taproom.",
        "She'd sit at that table there of a market day with one cider, slow, and tell me what was wrong with my stew. She was always right. I never told her.",
        "The whole room knows what you did under that hill. They'll be wanting to stand you drinks. Let them. It's how this village says the things it can't say.",
        ...(s.freed === 'hilde' ? ["Hilde's staying here till her bakery's up again. She's by the barrels, there. She's been asking for you every hour."] : []),
        ...(s.freed === 'coombe' ? ["And Coombe's here, by the fire, if you can believe it. Buying his own drinks. I've kept this house twenty years and never seen the like."] : []),
      ],
      lines: {
        news: ashesNews(s),
        late: ["Still up? So am I. Habit, now. Somebody watches the door. ...Sit by the fire, lad. You needn't talk."],
      },
    },
    nell: {
      speaker: 'nell',
      first: ["Oh, love. Sit down. I'll bring you something hot and you'll eat all of it, and I'll stand over you till you do."],
    },
    rosie: {
      speaker: 'rosie',
      first: ["Is it true you went right down under the hill? Cobb says you killed a hundred. ...Sorry. I'm sorry about your mam. I didn't mean to start with the goblins."],
    },
    harlan: {
      speaker: 'harlan',
      first: [
        "Lad. Sit down. ...My grandad's whole company went up to that hill, in the old lord's time, and only half came back down, and none of them went into the hole. You did.",
        "I'm sorry about your mother. Here. (He raises his cup.) To her. And to you, you stubborn young fool.",
      ],
    },
    pell: {
      speaker: 'pell',
      first: [
        "I'll not sing it. Not yet. Godric has my lute, and for once I let him take it.",
        "When you're ready, tell me, and I'll write it properly: her, and you, and the dark under the hill. Until then I shall sit here and be quiet, which you'll agree is a novelty.",
      ],
      lines: {
        wolves: ['Wolves? Goblins? No. No songs about either, not for a while yet. When you say.'],
      },
    },
    fenwick: {
      speaker: 'fenwick',
      lines: {
        again: [
          "Ah. I heard. I am very sorry, young man. ...And you went down there. Well.",
          'I find I am in no great hurry for the bridge now. One gets attached to a place that has people like you in it.',
        ],
      },
    },
    ada: {
      speaker: 'ada',
      first: ["Sit down, dearie. ...Dice, if you want them. I won't cheat. I'll even let you win, and I've never done that for anybody, so you mind you don't tell."],
    },
    sigrun: {
      speaker: 'sigrun',
      first: s.sigrun
        ? ["You're up. Good. ...You did well, down there. I don't say that. Don't make me say it again.", 'Sit, if you want. You needn\'t talk.']
        : ['So. You went down without me. And came back up. Hm.', "I'm sorry about your mother. When you go after whoever's behind that glass, I'm coming. Don't argue about the price."],
    },
    wat: {
      speaker: 'wat',
      first: s.wat
        ? [
            "We did it. We did, didn't we? ...I keep dreaming about the noise down there. Like a hall full of babies crying. Is that normal? Don't tell the sergeant.",
            `I'm sorry about your mam, ${HERO_NAME}. I'm glad I was there. I'm not glad. You know what I mean.`,
          ]
        : [`You went down on your own? And came back up? ...I'm sorry about your mam, ${HERO_NAME}. I should have been there. I keep telling the sergeant that.`],
    },
    // ---- The road ----
    tollguard: {
      speaker: 'tollguard',
      more: {
        greet: ["And His Lordship's heard about the goblins' hole on the Greyfells. He says he is \"gratified\". The toll still stands."],
      },
    },
    carter: {
      speaker: 'carter',
      first: [
        "Lad. I heard, at the Tankard. I'm sorry. Your mother bought my turnips every market day for ten years and never once haggled.",
        "...She haggled. She haggled something terrible. I liked it. I'll miss it.",
      ],
    },
    herbwife: {
      speaker: 'herbwife',
      first: [
        'Oh, my dear. I heard. Willow and moonpetal, they say she was using, down there in the dark. Even there.',
        'She was a healer to the last. You go gently now. You have earned a little gentleness.',
      ],
    },
    // ---- Saint Elda's ----
    porter: {
      speaker: 'porter',
      first: [
        `${HERO_NAME}. Peace be with you. The Prior has rung the passing bell for her, morning and evening, these three days.`,
        "The brothers ask if you will let them come down and say the words over her grave. Brother Anselm most of all. There is no hurry. Whenever you are ready.",
      ],
    },
    prior: {
      speaker: 'prior',
      first: [
        'Sit, my child. We rang the bell for her to come home, and you brought her home. That is not nothing. Whatever you believe, that is not nothing.',
        'The Saint found the lost, they say. I think she had help, this time.',
      ],
    },
    anselm: {
      speaker: 'anselm',
      first: [
        "Come here. ...She was mending. I would have sworn to it. It was not the fever that took her, was it? It was nursing that creature, day and night, with nothing left over for herself.",
        'That is what healers do. It is what she taught you, I think, without ever meaning to. Look at your hands: you have been tending everyone but yourself. Sit down and let me see that scalp.',
      ],
    },
    leofric: {
      speaker: 'leofric',
      first: ["Anselm told me. I'm sorry. ...And you went down there on two legs and came back up on two legs. That's Saint Elda's own luck. Keep hold of it."],
    },
    cook: {
      speaker: 'cook',
      first: ['Sit. Eat. You have not eaten properly in days; I can see it on you from the door. Nobody grieves well hungry.'],
    },
    // ---- The Hollow ----
    fisherman: {
      speaker: 'fisherman',
      first: [
        "Lad. I saw you come down off the hill road at sundown with her in your arms. I took my cap off. I'd nothing else to give.",
        "I'm sorry. She was a good neighbour. A better one than I was.",
      ],
      lines: {
        peace: ['Peaceful again, near enough. The fish don\'t know anything happened. I find I\'m glad of that.'],
      },
    },
  };
  return Object.fromEntries(Object.entries(t).map(([id, talk]) => [id, { ...talk, flag: toldOfAshes(talk.speaker) }]));
}

/** What Godric has heard, now: the village has only the one story, and tells it with pride. */
function ashesNews(s: AshesState): string[] {
  return [
    "Hamm and two of the lads went up to the goblins' camp on the Greyfells. Cold fires and bones, they say, and not a sound from the hole. They came back and drank till I threw them out.",
    "Lord Morten's sent a letter. Not men: a letter. \"Gratified to hear,\" it says. The Headman read it out in the square, and the square laughed till it cried.",
    "Iran's coop is half up again. The cooper's boys are doing it of an evening, for nothing, and complaining about it the whole time, which is how you know they mean it.",
    s.held
      ? "Garrick's telling the night on the old road again, at the militia table. You killed forty, last I heard. Brannock says it was nine. Brannock counts."
      : "Osric's at the bakery every morning, clearing the ash. He thinks nobody knows. Everybody knows.",
    s.freed === 'coombe'
      ? "Coombe's bought a round. Coombe! Rosie dropped a tray. I've told him he can stay as long as he likes, and I'm still not sure I wasn't dreaming."
      : "Harlan's been telling anyone who'll sit still that his grandad was right all along. He was, mind. I've stopped arguing.",
  ];
}

/** Hilde, staying at the Tankard by the barrels till her bakery is built again, after the hero let her out of the goblins' pen. */
export function hildeAtTankardScript(first: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'baker',
        lines: [
          `${HERO_NAME}! Oh, love, come here. Mind my wrists, they're still raw, but come here.`,
          'You cut me loose and went on down after her. I heard what you found. I am so sorry, love. I am so very sorry.',
          "They carried her past me, coughing, and I couldn't do a thing. And then there you were with your knife. I'll not forget it as long as I live.",
        ],
        next: 'ask',
      },
      again: { speaker: 'baker', lines: ['There you are, love. Sit down a minute.'], next: 'ask' },
      ask: {
        speaker: 'baker',
        lines: ['What is it, love?'],
        choices: [
          { text: 'How are you, Hilde?', next: 'how' },
          { text: 'What will you do now?', next: 'next' },
          { text: 'Did they hurt you, down there?', next: 'pen' },
          { text: 'I should go.', next: 'bye' },
        ],
      },
      how: {
        speaker: 'baker',
        lines: [
          "Me? I'm alive, love, and that's more than I thought I'd be. Godric's put me by his barrels and won't let me lift a finger. I'm going spare.",
          "Osric says he'll have the bakery roof on by the turn of the month. Osric says a lot of things. He's been up there at dawn every day all the same, clearing the ash.",
        ],
        next: 'ask',
      },
      next: {
        speaker: 'baker',
        lines: [
          "Bake. What else? Godric's letting me have his ovens of a morning till mine are built again.",
          "And the first loaf out, I'm bringing to you. Don't you argue with me.",
        ],
        next: 'ask',
      },
      pen: {
        speaker: 'baker',
        lines: [
          'They dragged me down that road by my hair, and put me in a pen like a ewe, and poked me with sticks to see if I was fat enough. I bit one. I told you that. I would bite it again.',
          "But the worst was the noise. All night, down there. Like a great hall full of babies crying. I'll hear it till I die.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'baker', lines: ["Go on, then. Come back and sit with me. I'll do the talking; you just eat."] },
    },
  };
}

/** Coombe the shepherd, at the Tankard's fire, after the hero let him out of the goblins' pen: a hard man, trying to be a softer one. */
export function coombeAtTankardScript(first: boolean, thanked: boolean): DialogueScript {
  return {
    start: first ? 'greet' : 'again',
    nodes: {
      greet: {
        speaker: 'coombe',
        lines: [
          "Hm. It's you. The lad with the knife. ...Sit down. I'm buying. Don't look at me like that, Godric, I can buy a drink.",
          "I heard about your mother. The woman on the litter. She said \"courage\" to me, and her dying. I've thought about it every hour since.",
          "I've been a hard man to folk. Ask anybody; they'll tell you, and they'll enjoy it. I mean to try and be less of one. That's on her account.",
        ],
        next: 'ask',
      },
      again: { speaker: 'coombe', lines: ["Lad. Sit, if you're sitting."], next: 'ask' },
      ask: {
        speaker: 'coombe',
        lines: ['Well?'],
        choices: [
          { text: 'How did you get home?', next: 'home' },
          { text: 'What about Wil, your drover?', next: 'wil' },
          ...(thanked ? [] : [{ text: "You don't owe me anything.", next: 'owe' }]),
          { text: 'Mind how you go, Master Coombe.', next: 'bye' },
        ],
      },
      home: {
        speaker: 'coombe',
        lines: [
          'Over the fell, in the dark, the way I said I would. Fell in a beck twice. Found the fold empty, and the dog\'s chain still on its post.',
          'Sat down there and cried like a bairn, if you must know. Then I came down here. Godric\'s put me up. I\'m paying him. He keeps trying to stop me.',
        ],
        next: 'ask',
      },
      wil: {
        speaker: 'coombe',
        lines: [
          "The drover lad? I've told him he's to have a rise, and his back pay, and an apology, and I've told him I'll not say any of it twice.",
          'He went white as milk. Thought I was dying. ...Maybe I was, a bit, down there. Maybe that\'s no bad thing.',
        ],
        next: 'ask',
      },
      owe: {
        speaker: 'coombe',
        action: 'coombe-thanks',
        lines: [
          "Owe you? I owe you my neck, lad. (He presses a purse into your hand, and closes your fingers round it.)",
          "Twenty-five coins. That's more than I've given away in forty years, and I'll not have it back. Don't shame me.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'coombe', lines: ['Hm. Mind the fell.'] },
    },
  };
}

/** Farmer Iran in his hut, once Mother is buried: no longer hiding, and keeping her grave. */
export const IRAN_AFTER_ASHES: DialogueScript = {
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'iran',
      lines: [
        `${HERO_NAME}. Come in, lad, come in. Sit, if you can find a stool the children haven't taken.`,
        "We've been up to her every morning. Hetty takes bluebells, though they're not out yet; she takes the leaves. Pip puts another stone on the cairn. I let him.",
      ],
      next: 'ask',
    },
    ask: {
      speaker: 'iran',
      lines: ['What is it, lad?'],
      choices: [
        { text: 'Thank you for keeping her grave.', next: 'grave' },
        { text: 'Will you stay in the Hollow?', next: 'stay' },
        { text: "They won't come back, Iran.", next: 'back' },
        { text: 'I should go.', next: 'bye' },
      ],
    },
    grave: {
      speaker: 'iran',
      lines: [
        "She kept all of us, lad, for years. She sat up with Hetty three nights through the spotted fever when the brothers wouldn't come down the hill.",
        "It's the least we can do. It's a deal less than the least.",
      ],
      next: 'ask',
    },
    stay: {
      speaker: 'iran',
      lines: [
        "Where else would we go? The cooper's boys are putting the coop up again of an evening. There'll be hens in it by spring, one way or another.",
        '...And somebody ought to be near her.',
      ],
      next: 'ask',
    },
    back: {
      speaker: 'iran',
      lines: [
        "No? ...No. Not after what you did. The children sleep through most nights now. That's your doing, and don't you go thinking it isn't.",
      ],
      next: 'ask',
    },
    bye: { speaker: 'iran', lines: ['Come for supper. Any night. I mean it, lad. Any night.'] },
  },
};

/** What Pip and Hetty say to each other, once Mother is buried. */
export const SIBLING_AFTER_ASHES: ChildLine[][] = [
  [['hetty', 'I took her the leaves again.'], ['pip', "They're not flowers, Hetty."], ['hetty', "They will be. She'll know."]],
  [['pip', `${HERO_NAME} went down a goblin hole. A real one.`], ['hetty', 'I know. You said.'], ['pip', "I'm saying it again."]],
  [['pip', 'I put a big stone on today. The biggest.'], ['hetty', 'Da had to help you.'], ['pip', 'A bit.']],
  [['hetty', 'Your mam sewed Moppet her eye.'], ['pip', 'She did all the eyes. On everything.'], ['hetty', '...I miss her.']],
];

/** And how they say hello. */
export const SIBLING_AFTER_ASHES_HELLO: ChildLine[] = [
  ['hetty', `${HERO_NAME}! Da, it's ${HERO_NAME}!`],
  ['pip', "We've been looking after her. Every day. Like you'd want."],
];

/** What the Tankard's regulars say among themselves, once Mother is buried. */
export const TAVERN_ASHES_CHATTER: Array<Array<[SpeakerId, string]>> = [
  [['cobb', 'He went down a hole full of them. A hole!'], ['ada', 'We know, Cobb.'], ['cobb', "I'm only saying. A hole."]],
  [['harlan', "Did what my grandad's whole company couldn't."], ['landlord', 'Aye. Drink up, Harlan.'], ['harlan', '...To her, then.']],
  [['pell', 'I have the first verse, if anyone—'], ['landlord', 'Not yet, Pell.'], ['pell', '...Not yet. No.']],
  [['nell', 'He hardly touches his bowl.'], ['landlord', "Then keep bringing it. He'll eat when he's ready."]],
  [['rosie', 'Godric, can I unbar the door yet?'], ['landlord', 'In the daytime, love. Just in the daytime, for now.']],
  [['fenwick', 'I find I am in no great hurry for that bridge now.'], ['ada', "That's the ale talking."], ['fenwick', 'It is a very persuasive ale.']],
];

/** What they mutter to themselves, now. */
export const TAVERN_ASHES_MUTTERS: Partial<Record<SpeakerId, string[]>> = {
  harlan: ['To the healer of the Hollow.', "Hrmph. Grandad would've liked that lad."],
  landlord: ['On the house. No, I said on the house.', 'Poor woman. Brave lad.'],
  nell: ['Two ales for the militia table. Again.', 'Mind your backs.'],
  rosie: ['Down a hole full of goblins. I can\'t even do the cellar.'],
  pell: ['♪ ...hm. No. Not yet. ♪'],
  cobb: ['Down a hole...'],
  ada: ["Nobody's cheating tonight. Not even me."],
  sigrun: ['...'],
};

/** What the room raises a cup to, now. */
export const TAVERN_ASHES_TOASTS = ['To the healer of the Hollow.', 'To the lad!', 'To her.', 'Absent friends.', 'To the Greyfells, and may they stay quiet!'];

/** What the militia call to each other on their rounds, now. */
export const MILITIA_ASHES_WATCH = [
  'All quiet on the gate!',
  'Nothing on the north road. Nothing for days.',
  "Garrick, that's a hen. Put the spear down.",
  'Did you hear? Down the hole. Down it!',
  "Gate at dusk, lads. Sergeant's orders.",
];

/** What someone following the hero says the first time they're asked about the warren and Mother. */
export const COMPANION_ASHES: Record<'sigrun' | 'wat', { went: string[]; stayed: string[] }> = {
  sigrun: {
    went: [
      "I've buried people. You don't get better at it. You just get quicker at picking up the spade again.",
      "She was proud of you, at the end. I saw her face. That's worth more than anything I could tell you, so I'll stop.",
    ],
    stayed: [
      "I heard. I should have been down there. I wasn't paid to be; that isn't the same as not wanting to.",
      "Whoever's behind that glass. When you go after them, I'm coming. We'll argue about the price after.",
    ],
  },
  wat: {
    went: [
      'I keep thinking about her. How she held on till you got there. My mam says that\'s what mothers do.',
      "I'm glad I was there. I'm not glad. You know what I mean. ...Thanks for taking me.",
    ],
    stayed: [
      'I should have come. I keep saying that to the sergeant. He says I\'ll get my chance. I don\'t think he means it kindly.',
      "Next time you go anywhere like that, I'm coming. I mean it. I've been practising.",
    ],
  },
};
