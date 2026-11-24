import { HERO_NAME } from '../config';
import { CompanionId, Companions } from '../systems/Companions';
import { itemDef, ItemId } from '../systems/Inventory';
import {
  atLeast, BondId, BondLevel, BONDS, BOND_NAMES, GiftTaste, Relationships,
} from '../systems/Relationships';
import type { DialogueChoice, DialogueNode, SpeakerId } from './Dialogue';

/**
 * Getting to know the companions (see systems/Relationships.ts): the personal
 * questions, gifts, tending their wounds, a kind or a cruel word, and an
 * apology when it's needed. {@link bondTalk} gives the replies to add to a
 * conversation with them (where they wait, or while they follow the hero) and
 * the nodes those replies lead to; every node comes back to `back`.
 *
 * Each question opens up once they know the hero well enough. Asked too soon,
 * they won't answer, and like the hero a little less for prying. Asked when
 * they're ready, the first time, it brings them closer.
 *
 * Actions (handled in scenes/game/companions.ts):
 * - `bond:topic:<id>:<topic>` the first telling of a story
 * - `bond:pry:<id>` asked too soon
 * - `bond:say:<id>:<amount>:<what>` a remark; `what` once a day
 * - `bond:gift:<id>:<item>` / `bond:tend:<id>:<item>`
 * - `bond:keepsake:<id>` they give the hero something, once
 */

/** What the hero can answer after a story: their reply, what it does for the bond, and how it's taken. */
interface Answer {
  text: string;
  bond: number;
  lines: string[];
}

interface Topic {
  id: string;
  ask: string;
  /** How well they must know the hero to tell it. */
  needs: BondLevel;
  lines: string[];
  /** What they say when asked too soon (and it costs a little). */
  rebuff?: string[];
  /** Ways the hero can answer, each with its own effect. */
  answers?: Answer[];
  /** Only when this holds (the other companion has been met). */
  when?: () => boolean;
}

interface Remark {
  id: string;
  text: string;
  bond: number;
  lines: string[];
  /** Only offered when this holds (praise for a fight needs them to have fought beside the hero). */
  when?: (level: BondLevel) => boolean;
}

interface Voice {
  /** Opening words, by how they feel about the hero. */
  greet: Record<BondLevel, string>;
  /** "Tell me about yourself": how they take being asked. */
  life: Record<'cold' | 'warm', string>;
  topics: Topic[];
  remarks: Remark[];
  /** Taking a gift, by how they like it; and when they've had one today already. */
  gift: Record<GiftTaste, (item: string) => string[]> & { enough: string; none: string };
  /** Being patched up; and when they're not hurt. */
  tend: { ok: (item: string) => string[]; whole: string };
  /** The hero says sorry (offered when they're cooling on the hero). */
  sorry: { text: string; lines: string[] };
  /** What they hand over once they're close (see BondDef.keepsake). */
  keepsake: string[];
  /** Said on walking off when they've come to resent the hero. */
  quit: string;
  /** Said instead of agreeing to come, while they resent the hero. */
  refuse: string;
}

const recruited = (id: CompanionId) => () => Companions.isRecruited(id);

export const VOICES: Record<BondId, Voice> = {
  sigrun: {
    greet: {
      resentful: "You. I've nothing to say to you.",
      wary: 'What do you want now.',
      acquainted: 'What.',
      friendly: `${HERO_NAME}. Sit, if you like.`,
      close: "There you are. I was starting to wonder if you'd got yourself killed.",
      trusted: `${HERO_NAME}. Good. I'd rather you than anyone else in this place.`,
    },
    life: {
      cold: "Myself? There's not much worth telling. Ask, and I'll see.",
      warm: "Ask, then. You've earned a few answers.",
    },
    topics: [
      {
        id: 'home', ask: 'Where are you from?', needs: 'acquainted',
        lines: [
          'North. Past the Greyfells, where the rivers freeze hard enough to drive a cart across. A place called Skarholt.',
          "It isn't there any more. Raiders, the winter I was twelve. Not goblins. Men. That's usually how it goes.",
        ],
      },
      {
        id: 'trade', ask: 'How did you become a sellsword?', needs: 'acquainted',
        lines: [
          'My uncle took me in. He was a smith. I was better at testing his blades than making them.',
          'At sixteen a captain came through looking for spears. I took his coin and never went back to the forge. That was a long time ago.',
        ],
      },
      {
        id: 'fording', ask: 'What happened at the Fording?', needs: 'friendly',
        rebuff: ['That is not a story for someone I met last week.'],
        lines: [
          "Two lords and a river. Three hundred of us went into the water at dawn. Eighty came out the other side.",
          "Our lord won. He gave a speech about it. I don't remember a word of it. I remember the sound the river made.",
        ],
        answers: [
          { text: "I'm sorry. That must stay with you.", bond: 3, lines: ['...It does. Thank you for not making a song of it.'] },
          { text: 'At least you were one of the eighty.', bond: 1, lines: ["Aye. I tell myself that. Some days it works."] },
          { text: 'Sounds like a glorious fight.', bond: -5, lines: ["Glorious. ...You've never seen a man drown in his armour. Don't say that word to me again."] },
        ],
      },
      {
        id: 'scar', ask: 'How did you get that scar?', needs: 'close',
        rebuff: ['Ask me that again and you will have one to match.'],
        lines: [
          'A boy. Younger than Wat. He came at me with a knife at a burned farm, and I hesitated. He opened my face before I took it off him.',
          "I let him go. I'd do it again. That's the part that worries me, in my trade.",
        ],
        answers: [
          { text: "That doesn't sound like a weakness to me.", bond: 4, lines: ["...No. Maybe not. Don't tell anyone."] },
          { text: 'You should have finished him.', bond: -4, lines: ['Then you and I are not the same. Good to know.'] },
        ],
      },
      {
        id: 'family', ask: 'Is there anyone waiting for you, somewhere?', needs: 'trusted',
        rebuff: ['No.', '...Leave it.'],
        lines: [
          'A daughter. Astrid. She was four when I went south for a winter\'s work. She\'d be twenty now.',
          "I send coin to her every year, care of a priest in Harrowmere. She doesn't write back. That's fair. I wouldn't either.",
        ],
        answers: [
          { text: 'You should go to her, when this is done.', bond: 5, lines: ['Maybe. If you come and stand behind me while I knock. I\'ve faced worse. I just can\'t think when.'] },
          { text: "She might not want to see you.", bond: -2, lines: ["I know. You don't need to tell me."] },
        ],
      },
      {
        id: 'wat', ask: 'What do you make of Wat?', needs: 'acquainted', when: recruited('wat'),
        lines: ["He'll be a good soldier or a dead one. I'm trying to make it the first. He doesn't make it easy."],
      },
    ],
    remarks: [
      { id: 'praise', text: 'You fought well back there.', bond: 2, when: () => Companions.isRecruited('sigrun'), lines: ['I know. ...But it\'s good to hear.'] },
      { id: 'smile', text: 'Do you ever smile, or does it hurt your face?', bond: -5, lines: ['Walk away. Now.'] },
      { id: 'coin', text: "You're only in this for the coin, aren't you?", bond: -3, lines: ["Coin's honest. More honest than most reasons I've heard."], when: (l) => !atLeast(l, 'close') },
    ],
    gift: {
      loved: (item) => [`${item}? ...Hm. You've been paying attention.`, "My thanks. I mean it."],
      liked: (item) => [`${item}. That'll do. Thank you.`],
      plain: (item) => [`${item}. Well. I'll find a use for it.`],
      disliked: (item) => [`${item}? What am I meant to do with that?`, 'Keep it. Or give it to Wat. He eats anything.'],
      enough: "You've given me enough for one day. I'm not a shrine.",
      none: "You've nothing I'd want. It's the thought, I'm told.",
    },
    tend: {
      ok: (item) => ['Stop fussing. ...Fine. Give it here.', `(You see to her cuts with the ${item.toLowerCase()}. She doesn't flinch.)`, 'Better. Thank you.'],
      whole: "I'm not hurt. Save it for when I am.",
    },
    sorry: { text: "I'm sorry. I spoke out of turn.", lines: ['Hm.', "...Fine. We'll leave it there. Don't make a habit of it."] },
    keepsake: [
      'Here. Take these. Wolfsbane oil, from my own kit. A thumb of it on the blade and wolves feel it to the bone.',
      "Don't thank me. Just don't die before I'm done with you.",
    ],
    quit: "I'm done. Find someone else to bleed for you.",
    refuse: "No. Not with you. Not after that.",
  },
  wat: {
    greet: {
      resentful: "Oh. It's you. I'm, er, busy. On watch. Very busy.",
      wary: "...Yes? Did you want something?",
      acquainted: "Hello! Did you want me?",
      friendly: `${HERO_NAME}! I was hoping it was you.`,
      close: `${HERO_NAME}! I saved you half my bread. Well, a quarter. I got hungry.`,
      trusted: `There you are! I always feel braver when you're about. Don't tell the sergeant.`,
    },
    life: {
      cold: "About me? Oh! Nobody ever asks about me. What do you want to know?",
      warm: "Ask me anything! Well. Most things.",
    },
    topics: [
      {
        id: 'family', ask: 'Tell me about your family.', needs: 'acquainted',
        lines: [
          "There's Mum, and my sisters, Agnes and little Win, and my brother Hob, who went for a soldier in the Lord's levy.",
          'He sends letters. Well, somebody writes them for him. Mum keeps them in the flour crock so the mice can\'t get them.',
        ],
      },
      {
        id: 'militia', ask: 'Why did you join the militia?', needs: 'acquainted',
        lines: [
          'Sergeant Brannock came up to the farm and said they needed lads. Mum said no. I said yes.',
          "It was the first time I ever said no to my mother. Well, yes. You know what I mean.",
        ],
      },
      {
        id: 'farm', ask: 'Do you miss the farm?', needs: 'acquainted',
        lines: [
          "I miss the pigs. Is that daft? There was a sow called Duchess who'd follow me about like a dog.",
          'She knocked me in the duck pond once. Twice. All right, a lot.',
        ],
      },
      {
        id: 'fear', ask: 'What scares you, Wat?', needs: 'friendly',
        rebuff: ["Nothing! ...Lots of things. I don't want to say. You'll laugh."],
        lines: [
          "Being the one who runs. Everyone thinks I'll run. I think I'll run.",
          "I don't want to find out I'm right. That's the worst bit, not knowing till it happens.",
        ],
        answers: [
          { text: "You won't run. I've seen you stand.", bond: 4, lines: ['...You mean that? I\'ll remember you said it. When it gets bad, I\'ll remember.'] },
          { text: 'Everyone feels that way, Wat.', bond: 2, lines: ['Even Sigrun? ...Don\'t answer. I like thinking she\'s scared of something.'] },
          { text: 'Then try not to run.', bond: -2, lines: ["Right. Yes. Thanks. Very helpful."] },
        ],
      },
      {
        id: 'sweetheart', ask: "Is there someone you're sweet on?", needs: 'close',
        rebuff: ['What? No! Why? Who said? Was it Agnes? It was Agnes.'],
        lines: [
          "...Bess. Tamsin's girl, at the tannery. She smells of tanning lye and I don't even mind.",
          "I've never said a word to her. Well, I said \"morning\" once. She said \"morning\" back. I think about it a lot.",
        ],
        answers: [
          { text: 'Talk to her when we get back. Properly.', bond: 3, lines: ["Properly. Right. I will. Will you come? No. No, that'd be odd. I'll go on my own. Probably."] },
          { text: 'She could do better than you.', bond: -6, lines: ['...I know. You didn\'t have to say it.'] },
        ],
      },
      {
        id: 'dream', ask: 'What will you do when all this is over?', needs: 'trusted',
        rebuff: ["Over? I haven't thought that far. I try not to think too far."],
        lines: [
          'I want to be a sergeant. A good one.',
          'The kind that runs down the hill when the smoke goes up. Not the kind that holds his lads back by the collar. I\'d run down the hill. With you, I think I could.',
        ],
        answers: [
          { text: "You'll be a fine sergeant, Wat.", bond: 4, lines: ["Sergeant Wat. ...Sergeant Wat! It sounds right, doesn't it? Don't laugh."] },
        ],
      },
      {
        id: 'sigrun', ask: 'What do you make of Sigrun?', needs: 'acquainted', when: recruited('sigrun'),
        lines: ["She's terrifying. I think she likes me, though. She said my guard was \"less bad\". That's nearly good!"],
      },
    ],
    remarks: [
      { id: 'praise', text: 'You did well today, Wat.', bond: 3, when: () => Companions.isRecruited('wat'), lines: ['Did I? I did! Wait till I tell Mum. Well, not the dangerous bits.'] },
      { id: 'quiet', text: 'You talk too much, Wat.', bond: -6, lines: ['...Sorry. I\'ll be quiet.'] },
      { id: 'useless', text: "Try not to get in the way, all right?", bond: -4, lines: ["Right. Course. I'll... stand over here."], when: (l) => !atLeast(l, 'close') },
    ],
    gift: {
      loved: (item) => [`${item}! For me? You're the best. You're actually the best.`, "Mum's going to be so jealous. I'm not sharing."],
      liked: (item) => [`Oh, ${item.toLowerCase()}! Thanks! I'm starving. I'm always starving.`],
      plain: (item) => [`A ${item.toLowerCase()}? Er. Thank you! I'll... keep it somewhere safe.`],
      disliked: (item) => [`Oh. ${item}. ...The sergeant would have my hide if he caught me with that.`, "It's kind of you. I just can't."],
      enough: "You've given me loads today already! I'll get fat. Fatter.",
      none: "You don't have to give me anything! But, er, if you ever find a honey cake...",
    },
    tend: {
      ok: (item) => ['Oh! It\'s nothing. It\'s... ow. Yes. Thank you.', `(You patch up his scrapes with the ${item.toLowerCase()}. He tries very hard to look brave.)`, 'I feel loads better. You\'re as good as my mum.'],
      whole: "I'm fine! Not a scratch. Well, one scratch. From a bramble. It doesn't count.",
    },
    sorry: { text: "I'm sorry, Wat. I didn't mean it.", lines: ["...Really? Oh, that's all right then! I get it. Everyone's on edge."] },
    keepsake: [
      "Wait! Before I forget. Mum baked these and said I was to give you two. \"For the poor lad from the Hollow,\" she said.",
      "I only had a little bit of one. The crust. It fell off on its own. Mostly.",
    ],
    quit: "I'm going back to the square. I don't think you even want me here.",
    refuse: "I... no. I don't think so. Not after what you said.",
  },
};

/** Whether a topic can be told now (and whether it's on offer at all). */
function topicOpen(t: Topic, level: BondLevel): boolean {
  return atLeast(level, t.needs);
}

/** The things in the satchel that could be given: food, drink, brews and trinkets; not quest items or worn gear. */
export function giftable(bag: Array<{ id: ItemId; count: number } | null>): ItemId[] {
  const seen = new Set<ItemId>();
  for (const s of bag) {
    if (!s || seen.has(s.id)) continue;
    const def = itemDef(s.id);
    if (def.quest) continue;
    if (def.category === 'Food' || def.category === 'Potion' || (def.category === 'Clothing' && def.slot === 'trinket') || s.id === 'old-boot' || s.id === 'rat-tail') seen.add(s.id);
  }
  return [...seen];
}

/** The things that would mend a wound: anything that gives health back. */
export function healers(bag: Array<{ id: ItemId; count: number } | null>): ItemId[] {
  const seen = new Set<ItemId>();
  for (const s of bag) if (s && !seen.has(s.id) && (itemDef(s.id).eat?.health ?? 0) >= 5) seen.add(s.id);
  return [...seen].sort((a, b) => (itemDef(b).eat?.health ?? 0) - (itemDef(a).eat?.health ?? 0));
}

export interface BondTalkInput {
  id: BondId;
  speaker: SpeakerId;
  /** What's in the satchel now. */
  bag: Array<{ id: ItemId; count: number } | null>;
  /** Hurt (with the hero, below full health): offer to tend them. */
  hurt: boolean;
  /** The node every branch comes back to. */
  back: string;
}

/** The replies to add to a companion's conversation, and the nodes they lead to. */
export function bondTalk(input: BondTalkInput): { choices: DialogueChoice[]; nodes: Record<string, DialogueNode> } {
  const { id, speaker, back } = input;
  const v = VOICES[id];
  const level = Relationships.level(id);
  const nodes: Record<string, DialogueNode> = {};
  const choices: DialogueChoice[] = [];

  // --- Their life: the questions, each opening up as they come to trust the hero.
  const topics = v.topics.filter((t) => !t.when || t.when());
  const lifeChoices: DialogueChoice[] = [];
  for (const t of topics) {
    const told = Relationships.has(id, `topic:${t.id}`);
    const key = `bond-topic-${t.id}`;
    if (topicOpen(t, level)) {
      const node: DialogueNode = { speaker, lines: t.lines, action: told ? undefined : `bond:topic:${id}:${t.id}` };
      if (t.answers && !told) {
        node.choices = t.answers.map((a, i) => ({ text: a.text, next: `${key}-a${i}` }));
        t.answers.forEach((a, i) => {
          nodes[`${key}-a${i}`] = { speaker, lines: a.lines, action: `bond:say:${id}:${a.bond}:${t.id}`, next: 'bond-life' };
        });
      } else {
        node.next = 'bond-life';
      }
      nodes[key] = node;
      lifeChoices.push({ text: t.ask, next: key });
    } else if (t.rebuff) {
      nodes[key] = { speaker, lines: t.rebuff, action: `bond:pry:${id}`, next: 'bond-life' };
      lifeChoices.push({ text: t.ask, next: key });
    }
  }
  lifeChoices.push({ text: 'That\'s all for now.', next: back });
  nodes['bond-life'] = { speaker, lines: [atLeast(level, 'friendly') ? v.life.warm : v.life.cold], choices: lifeChoices };
  choices.push({ text: id === 'sigrun' ? 'Tell me about yourself.' : 'Tell me about yourself, Wat.', next: 'bond-life' });

  // --- A gift.
  const gifts = giftable(input.bag);
  if (!Relationships.canGift(id)) {
    nodes['bond-gift'] = { speaker, lines: [v.gift.enough], next: back };
  } else if (gifts.length === 0) {
    nodes['bond-gift'] = { speaker, lines: [v.gift.none], next: back };
  } else {
    nodes['bond-gift'] = {
      speaker,
      lines: [id === 'sigrun' ? 'For me? What is it?' : 'A present? For me? What is it?'],
      choices: [
        ...gifts.map((item) => ({ text: `Give ${itemDef(item).name}`, next: `bond-gift-${item}` })),
        { text: 'Never mind.', next: back },
      ],
    };
    for (const item of gifts) {
      const name = itemDef(item).name;
      const taste = BONDS[id].tastes[item] ?? 'plain';
      nodes[`bond-gift-${item}`] = { speaker, lines: v.gift[taste](name), action: `bond:gift:${id}:${item}`, next: back };
    }
  }
  choices.push({ text: 'I brought you something.', next: 'bond-gift' });

  // --- Tending their wounds.
  if (input.hurt) {
    const meds = healers(input.bag);
    if (meds.length === 0) {
      nodes['bond-tend'] = { speaker, lines: [id === 'sigrun' ? "With what? You've nothing to dress it with." : "That's kind, but you haven't got anything to put on it!"], next: back };
    } else {
      nodes['bond-tend'] = {
        speaker,
        lines: [id === 'sigrun' ? "If you must. What have you got?" : 'Would you? What have you got?'],
        choices: [
          ...meds.map((item) => ({ text: `Use ${itemDef(item).name} (+${itemDef(item).eat!.health} health)`, next: `bond-tend-${item}` })),
          { text: 'Never mind.', next: back },
        ],
      };
      for (const item of meds) nodes[`bond-tend-${item}`] = { speaker, lines: v.tend.ok(itemDef(item).name), action: `bond:tend:${id}:${item}`, next: back };
    }
    choices.push({ text: 'Let me see to your wounds.', next: 'bond-tend' });
  }

  // --- A word, kind or otherwise.
  for (const r of v.remarks) {
    if (r.when && !r.when(level)) continue;
    // A kind word only counts once a day; a cruel one stings every time.
    const key = `bond-say-${r.id}`;
    nodes[key] = { speaker, lines: r.lines, action: `bond:say:${id}:${r.bond}:${r.bond > 0 ? `day:${r.id}` : r.id}`, next: back };
    choices.push({ text: r.text, next: key });
  }
  if (Relationships.score(id) < 0 && Relationships.today(id, 'sorry') === 0) {
    nodes['bond-sorry'] = { speaker, lines: v.sorry.lines, action: `bond:sorry:${id}`, next: back };
    choices.push({ key: true, text: v.sorry.text, next: 'bond-sorry' });
  }
  return { choices, nodes };
}

/** Their opening words, by how they feel about the hero. */
export function bondGreeting(id: BondId): string {
  return VOICES[id].greet[Relationships.level(id)];
}

/** A keepsake they'd hand over now, if they're close enough and haven't yet: the node to say it in. */
export function keepsakeNode(id: BondId, speaker: SpeakerId, next: string): DialogueNode | undefined {
  const k = BONDS[id].keepsake;
  if (!k || Relationships.has(id, 'keepsake') || !atLeast(Relationships.level(id), k.at)) return undefined;
  return { speaker, lines: VOICES[id].keepsake, action: `bond:keepsake:${id}`, next };
}

export { BOND_NAMES };
