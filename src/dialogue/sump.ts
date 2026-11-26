import type { DialogueChoice, DialogueNode, DialogueScript } from './Dialogue';

/**
 * The folk of the Sump, down Sump Lane in Gloomhaven's west quarter
 * (world/SumpMaps.ts): Annis Crowe, who scrubs pots at the Black Rose, and
 * her girl Tansy, whom the square calls Wisp; the Widow Nan Pruett at her
 * window; and Ned Wick the lamplighter, in his stilt house over the pool.
 *
 * Two quests run through them (systems/Quests.ts; the doings are in
 * scenes/game/sump.ts). In Grey Silver, Wisp asks the hero to find out where
 * her mam's new money comes from: a foreign silver coin with a square hole,
 * which the men in grey pay Annis in for carrying their suppers down to the
 * Rose's cellar at night. In The Chalk Rose, the hero learns who lived in the
 * burnt house (Jory Cotter, a lighterman who poled sealed crates in off the
 * fen for those same men, until he said no), why a rose was chalked on its
 * door, and why the chalk didn't burn; and finds the tally Jory hid under his
 * hearthstone. Nobody here knows of the orb, and nobody is told.
 */

/** How far along a quest is: not begun, at one of its steps, or done. */
export type Stage<S extends string> = 'none' | S | 'done';
export type GreySilverStep = 'talk' | 'visit' | 'find' | 'annis' | 'tell';
export type ChalkRoseStep = 'look' | 'ask' | 'chalk' | 'ned' | 'hearth' | 'tell';

/** Where the hero stands with the Sump's two quests, for its folk's talk. */
export interface SumpNews {
  silver: Stage<GreySilverStep>;
  chalk: Stage<ChalkRoseStep>;
  /** The hero has the foreign coin from Annis's sewing box (or Jory's). */
  hasCoin: boolean;
  coins: number;
  /** Annis took the hero's money and is staying home from the cellar for a while. */
  annisStopped: boolean;
  /** Jory's little purse, from under his hearthstone, is still the hero's to give. */
  hasPurse: boolean;
}

/** What Annis asks to stay home from the cellar a while, and what Jory had saved. */
export const ANNIS_GIFT = 20;
export const JORY_PURSE = 15;

const pickOne = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

// ---------------------------------------------------------------- Wisp

/** Asking Wisp what's wrong, which starts Grey Silver: shared by the square and her home. */
function wispWorryNodes(atHome: boolean): Record<string, DialogueNode> {
  return {
    worry: {
      speaker: 'wisp',
      lines: [
        "...I'm not worried. I'm never worried. Worried's for people with something to lose.",
        'Mam\'s bringing home silver. Since the summer. Not coppers, silver. More than the Rose pays for pots, more than the Rose pays anybody.',
        "She goes out after the Rose's bell, when she thinks I'm asleep. She comes back before it's light, and she's been crying, and she smells of the cellar. And there's more silver.",
        "It's not Gloomhaven silver. It's got a hole in it. I've never seen money with a hole in it.",
      ],
      next: 'ask-help',
    },
    'ask-help': {
      speaker: 'wisp',
      lines: atHome
        ? ["She keeps it in her sewing box, on the chest. I'm not allowed to touch her sewing box. You're not me, though, are you?"]
        : [
            'Will you come and look? Our house is down Sump Lane, on the corner by the pool, the one with the hole in the thatch. Come after dark, when Mam\'s gone back to the Rose.',
            "Don't tell her I told. Promise. Pinky promise. You've got pinkies, haven't you? Everyone round here's lost one.",
          ],
      action: 'grey-silver-start',
    },
  };
}

/** Telling Wisp what's what, the end of Grey Silver: shared by the square and her home. */
function wispTellNodes(news: SumpNews): { choices: DialogueChoice[]; nodes: Record<string, DialogueNode> } {
  const choices: DialogueChoice[] = [{ text: "Your mam's all right, Tansy. She's being careful.", next: 'tell-careful', key: true }];
  if (news.annisStopped) choices.push({ text: "She won't be going down to the cellar for a while. I've seen to it.", next: 'tell-stopped', key: true });
  choices.push({ text: 'The truth? She carries suppers to bad men. She knows it. She has no choice.', next: 'tell-truth', key: true });
  return {
    choices,
    nodes: {
      'tell-careful': {
        speaker: 'wisp',
        lines: [
          "...You called me Tansy. Nobody calls me that but Mam. Did she tell you to? She did, didn't she.",
          "Careful. Careful's all right. Careful's what Mam's good at. She's been careful my whole life.",
          "I'll be careful too. I'll stay in when the bell goes. ...Mostly.",
        ],
        action: 'grey-silver-done',
      },
      'tell-stopped': {
        speaker: 'wisp',
        lines: [
          "She's not going? Not at all? She'll be home all night, every night?",
          "...I don't know what to do with my face. It's doing something on its own. Don't look at it.",
          "I'm never pinching from you again. Not ever. Well. Hardly ever. Only for practice.",
        ],
        action: 'grey-silver-done',
      },
      'tell-truth': {
        speaker: 'wisp',
        lines: [
          "...I knew. I knew it was them. The grey coats. I see them come up out of the cellar, I told you, I see everything.",
          "No choice. That's what grown-ups say when they mean nobody's helping. ...Thank you for telling me true. Nobody tells me true.",
          "I'll watch her. I'm good at watching. If anyone does anything to my mam, they'll be sorry. I'll pinch everything they've got. Even their teeth.",
        ],
        action: 'grey-silver-done',
      },
    },
  };
}

/**
 * What Grey Silver adds to Wisp's talk in the square (dialogue/gloomhaven.ts,
 * wispScript): asking what's wrong, once she's been met, and telling her what's
 * what at the end. Merged into her conversation's 'ask' menu.
 */
export function wispSquareExtra(news: SumpNews): { choices: DialogueChoice[]; nodes: Record<string, DialogueNode> } {
  if (news.silver === 'none') {
    return { choices: [{ text: 'You look worried, Wisp.', next: 'worry', key: true }], nodes: wispWorryNodes(false) };
  }
  if (news.silver === 'tell') {
    const tell = wispTellNodes(news);
    return {
      choices: [{ text: "About your mam, and the silver.", next: 'tell', key: true }],
      nodes: { ...tell.nodes, tell: { speaker: 'wisp', lines: ['...Well? Go on. I can take it. I can take anything.'], choices: tell.choices } },
    };
  }
  if (news.silver === 'visit' || news.silver === 'find') {
    return { choices: [{ text: 'Where did you say your house was?', next: 'where', key: true }], nodes: { where: { speaker: 'wisp', lines: ["Down Sump Lane, on the corner by the pool. The hole in the thatch. Come after dark. Mam's sewing box, on the chest."], next: 'ask' } } };
  }
  return { choices: [], nodes: {} };
}

/** Wisp at home in the Crowes' cottage, of a night (a separate spawn, 'wisp-home', with her face and voice). */
export function wispHomeScript(first: boolean, news: SumpNews): DialogueScript {
  const s = news.silver;
  const choices: DialogueChoice[] = [];
  if (s === 'none') choices.push({ text: "Something's wrong, Wisp. What is it?", next: 'worry', key: true });
  if (s === 'tell') choices.push({ text: 'About your mam, and the silver.', next: 'tell', key: true });
  choices.push({ text: 'Why are you up so late?', next: 'late' }, { text: 'What are all these treasures?', next: 'treasure' }, { text: 'Go to sleep, Wisp.', next: 'bye' });
  const tell = wispTellNodes(news);
  const opening = (): string[] => {
    if (s === 'visit') return ["You came! Shh. Shut the door, the draught gets in. Mam's gone. She went when the bell went. She always goes when the bell goes."];
    if (s === 'find') return ["Did you look yet? In the sewing box. On the chest by the bed. Go on. I'll keep watch."];
    if (s === 'annis') return ["You found it. It's funny money, isn't it? It hasn't got a king on. Talk to Mam. She's home of an evening, after the Rose and before the bell."];
    if (first) return ["Who's that?! ...Oh. It's you. You nearly got a stool on your head. I'm a very good thrower."];
    return [pickOne(["Hello. I'm not asleep. I'm resting my eyes with them open.", "Mam's not back yet. I'm keeping the fire in. I'm good at fires.", "Shh. Listen. ...That's the Rose's bell. She'll be going down now."])];
  };
  return {
    start: 'greet',
    nodes: {
      greet: { speaker: 'wisp', lines: opening(), next: s === 'visit' ? 'show' : 'ask' },
      show: {
        speaker: 'wisp',
        lines: ["It's in her sewing box, on the chest by the bed. I'm not allowed to touch her sewing box. You're not me, though, are you?"],
        action: 'grey-silver-visited',
        next: 'ask',
      },
      ask: { speaker: 'wisp', lines: ['What?'], choices },
      ...(s === 'none' ? wispWorryNodes(true) : {}),
      ...(s === 'tell' ? { ...tell.nodes, tell: { speaker: 'wisp', lines: ['...Well? Go on. I can take it. I can take anything.'], choices: tell.choices } } : {}),
      late: {
        speaker: 'wisp',
        lines: [
          "I can't sleep when the bell's gone and Mam's not back. I lie there and count. I got to four thousand once.",
          'The Widow Pruett says if you can\'t sleep, count the lamps. Ned lights them, one by one, all down the lane. I can see six from the window.',
        ],
        next: 'ask',
      },
      treasure: {
        speaker: 'wisp',
        lines: [
          "They're not treasures, they're collected. Collected's different from pinched. Collected is when nobody's looking after it properly.",
          "The bead's my favourite. It's blue all the way through. The thimble's Mam's, really. The key's to nothing. I'm going to find what it's to, one day.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'wisp', lines: [pickOne(["Night. Don't let the Sump in.", "Night night. Mind the bucket.", 'Bye. Shut the door properly, it sticks.'])] },
    },
  };
}

// ---------------------------------------------------------------- Annis

/** Annis Crowe, at home of an evening, mending at the table. */
export function annisScript(first: boolean, news: SumpNews): DialogueScript {
  const s = news.silver;
  const choices: DialogueChoice[] = [];
  if (s === 'annis' && news.hasCoin) choices.push({ text: 'Annis, where does this coin come from?', next: 'coin', key: true });
  if (news.chalk !== 'none' && news.chalk !== 'done') choices.push({ text: 'Did you know Jory Cotter, from the burnt house?', next: 'jory-knew' });
  choices.push(
    { text: 'What do you do at the Rose?', next: 'rose' },
    { text: 'How long have you lived in the Sump?', next: 'sump' },
    { text: "I'll leave you be.", next: 'bye' },
  );
  const greet = (): string[] => {
    if (first) {
      return [
        "...Oh! The door. I thought you were... Who are you? If you're from the Rose, I've done my shift. If you're from the gate, I've paid.",
        "You're the one Tansy's been telling me about, aren't you. The stranger with all his teeth. I'm Annis. Annis Crowe. Sit down, if you like. Not that stool, it bites.",
      ];
    }
    if (s === 'done' && news.annisStopped) return [pickOne(['A week at home of a night. I don\'t know what to do with myself. I darned everything twice.', 'Come in. Tansy\'s asleep for once. She sleeps, now. Did you know she snores?'])];
    if (s === 'done') return [pickOne(['Evening. I keep my eyes on the floor down there, like I said. It\'s all right. It\'s all right.', "Come in. Mind the bucket. Tansy says you're the sharpest man in Gloomhaven. She doesn't say that about anybody."])];
    return [pickOne(['Evening. Mind the bucket.', "Oh, it's you. Come in, shut the door. The Sump gets in.", 'Evening. I\'m only mending. I\'m always only mending.'])];
  };
  return {
    start: 'greet',
    nodes: {
      greet: { speaker: 'annis', lines: greet(), next: 'ask' },
      ask: { speaker: 'annis', lines: ['What is it?'], choices },
      rose: {
        speaker: 'annis',
        lines: [
          "Pots. Mrs Thorne's kitchen, out the back, from first light till the bell. Eels, mostly. You get so you can't smell them. Then you get so you can't smell anything else.",
          "She's fair, Mrs Thorne, in her way. She pays on the day. She doesn't ask. She doesn't like being asked, either.",
        ],
        next: 'ask',
      },
      sump: {
        speaker: 'annis',
        lines: [
          "Since I was married. Twelve years. Crowe was a lighterman, on the flats, before. He went out on the fen one winter and the fen kept him.",
          "The Widow Pruett says the fen keeps somebody from every house in the Sump. She says it like it's rent.",
        ],
        next: 'ask',
      },
      'jory-knew': {
        speaker: 'annis',
        lines: [
          "Everybody knew Jory. He used to bring Tansy a mint humbug every Saturday, out of his pocket, all fluffy. She ate every one.",
          "Don't ask me about the fire. I didn't see. I'd gone down to the... I wasn't home. Ask the Widow. She sees everything from that chair.",
        ],
        next: 'ask',
      },
      coin: {
        speaker: 'annis',
        lines: [
          '...Where did you get that? Put it back. Please. Put it back where it was.',
          "Tansy. She showed you. Of course she did. She thinks I don't know she knows. ...Sit down. Sit down, I can't say it standing up.",
          "After the bell, when the Rose is shut, there's men down in the cellar. Men in grey coats, under the Staithe, where the river comes in. They have suppers sent down. Eel pie and the good wine. I carry it.",
          "I go down the steps with my tray, and I keep my eyes on the floor, and I put it on the crates, and I come back up. That's all. I never look at the crates. I never look at their faces.",
          "They talk while I'm there, like I'm a chair. Not in our tongue. Sing-song, up and down. And they pay me in that. One of those every night. You can't spend it, but Lusk will weigh it for you.",
        ],
        next: 'coin-choice',
      },
      'coin-choice': {
        speaker: 'annis',
        lines: ["...Well? Say it. Everybody's got something to say about it."],
        choices: [
          { text: "Stop going down there. It isn't safe.", next: 'stop', key: true },
          { text: 'Then be careful. And keep Tansy away from the Rose at night.', next: 'careful', key: true },
        ],
      },
      stop: {
        speaker: 'annis',
        lines: [
          "And pay the Widow Thorne for the cottage with what? Feed Tansy with what? The pots pay for the pots. The silver pays for everything else.",
        ],
        choices: [
          ...(news.coins >= ANNIS_GIFT
            ? [{ text: `Then take this. ${ANNIS_GIFT} coins. Stay home of a night till it's gone.`, next: 'gift', action: 'annis-gift', key: true }]
            : []),
          { text: "I can't help you with money. I'm sorry.", next: 'cant' },
        ],
      },
      gift: {
        speaker: 'annis',
        lines: [
          "...I can't take that. I can't. ...I'm taking it. Look, I'm taking it. Don't watch me cry, I'm ugly when I cry.",
          "A week. Two, if I'm careful. Mrs Thorne will be cross. Let her. I'll say I'm poorly. I'll say Tansy's poorly. I'll say something.",
        ],
        next: 'jory',
      },
      cant: { speaker: 'annis', lines: ["No. Nobody can. It's all right. I'll keep my eyes on the floor."], next: 'jory' },
      careful: {
        speaker: 'annis',
        lines: [
          "Careful. I'm the most careful woman in Gloomhaven. I'm so careful I hardly breathe.",
          "She stays in when the bell goes. She doesn't. She thinks I don't know. I'll tie her to the bed if I have to.",
        ],
        next: 'jory',
      },
      jory: {
        speaker: 'annis',
        lines: [
          "...There's one more thing. I haven't told anybody. I haven't got anybody to tell.",
          "Last week one of them looked up when I put the tray down. The one with no gloves. He asked me, in our tongue, very polite, did Jory Cotter have any kin. Jory, from the burnt house.",
          "I said no. He hasn't. ...Hadn't. I don't know which to say. Why would they want to know a thing like that, about a dead man? Unless he isn't.",
        ],
        action: 'grey-silver-annis',
        next: 'ask',
      },
      bye: { speaker: 'annis', lines: [pickOne(['Mind the step. And the bucket. And the lane.', 'Goodnight. Shut it hard, it sticks.'])] },
    },
  };
}

// ---------------------------------------------------------------- Nan

/** The Widow Nan Pruett, at her window. */
export function nanScript(first: boolean, news: SumpNews, askedCoin: boolean, toldFire: boolean): DialogueScript {
  const c = news.chalk;
  const choices: DialogueChoice[] = [];
  if (c === 'ask' || (c !== 'none' && c !== 'done' && !toldFire)) choices.push({ text: 'Who lived in the burnt house?', next: 'jory', key: true });
  if (toldFire) choices.push({ text: 'Who chalked the rose on Jory\'s door?', next: 'chalk' });
  if (news.hasCoin && !askedCoin) choices.push({ text: 'Have you ever seen a coin like this?', next: 'coin', key: true });
  if (news.hasPurse) choices.push({ text: 'Jory had a little money hidden. Would it see you through the winter?', next: 'purse', action: 'nan-purse', key: true });
  choices.push({ text: 'What do you make here?', next: 'rushes' }, { text: 'Tell me about the Sump.', next: 'sump' }, { text: "I'll let you get on.", next: 'bye' });
  return {
    start: 'greet',
    nodes: {
      greet: {
        speaker: 'nan',
        lines: first
          ? [
              "Come in, come in, shut that door, you're letting the Sump in. Sit where you like. Not there, that's the cat's.",
              "Nan Pruett. The Widow Pruett, the lane calls me, as if I'm the only widow on it. I'm only the oldest. You're the stranger off the Grey Heron. I saw you come up the lane. I see everybody come up the lane.",
            ]
          : [pickOne(["Oh, it's you again. Sit. The cat won't mind. The cat minds everything, but it won't say.", 'Come in. I was just thinking about you. I think about everybody, sitting here.', 'Mind the bucket, dear.'])],
        next: 'ask',
      },
      ask: { speaker: 'nan', lines: ['Well?'], choices },
      rushes: {
        speaker: 'nan',
        lines: [
          "Rushlights. You peel the rush to the pith, all but one strip of skin to hold it up, and you draw it through the fat. A farthing a dozen. I've made them since I was six.",
          "A rushlight burns an hour. I've made a million of them, near enough, and I've seen every one go out. That's a lot of hours. That's a lot of going out.",
        ],
        next: 'ask',
      },
      sump: {
        speaker: 'nan',
        lines: [
          "The Sump's where the town runs down to. Everything ends up here in the end: the water, the rubbish, and the folk nobody else wants.",
          "Annis Crowe and her girl, on the corner. Good girl, Annis. Hard luck. The child's a thief and a treasure. Ned Wick, out on his stilts, the lamplighter. Frightened of his own shadow, which is sensible, round here.",
          "And the burnt house. That was Jory Cotter's. It isn't anybody's now.",
        ],
        next: 'ask',
      },
      jory: {
        speaker: 'nan',
        lines: [
          "Jory Cotter. A lighterman, like his father, like Annis's Crowe. Poled flat-boats out on the fen, ferrying whatever wanted ferrying. Peat. Reed. Eels. Lately, other things.",
          "Since the summer, he'd go out at night for the Rose's people. Not the Widow Thorne's people. The ones under the Rose. Out into the fen and back before light, with crates, sealed. Paid in silver, he was. Funny silver.",
          "Then one night he came back and he was the colour of that wall. He sat in that chair you're nearly sitting in and he said, Nan, I'm not going again. Not with what was in the last one. And he wouldn't say what.",
          "Three nights after, his house burned. Burned hot and quick, like something helped it. The whole lane came out and stood in their doors, and nobody went to the pump. Nobody. I'm too old to carry a pail. That's my excuse. What's theirs?",
          "I saw two men go back up the lane before it took hold. One big, one thin. The big one swinging a pail. I know who they drink with. So do you, if you've been in the Rose.",
          "And in the morning there was a rose drawn on his door in chalk. Ask Ned Wick about the rest. He was Jory's friend. He won't talk to you. He'll talk to you if you say Jory's name.",
        ],
        action: 'nan-told',
        next: 'ask',
      },
      chalk: {
        speaker: 'nan',
        lines: [
          "Not me. And not anybody from the lane. Nobody in the Sump owns a stick of chalk. Chalk's a thing you carry on purpose.",
          "It was meant for us, that rose. Meant for everybody who stood in their doors and watched. It says: this is what happens. And everybody on the lane looked at it, and went in, and shut their doors. And here we all are.",
        ],
        next: 'ask',
      },
      coin: {
        speaker: 'nan',
        lines: [
          "Let me see. Closer. My eyes are good for far and no good for near, like a gull's.",
          "My Aldo sailed the salt sea before he went on the fen. He brought me coin from Varr and the Salt Isles and the Copper Coast, and none of it had a hole in. A hole's for stringing. You carry it a hundred on a string. That's money from a long way east of anywhere I've heard of.",
          "And look: somebody's scratched a little rose in it, there, over the writing. That's not where it was made. That's where it's been.",
        ],
        action: 'nan-coin',
        next: 'ask',
      },
      purse: {
        speaker: 'nan',
        lines: [
          "...Jory's. That's Jory's purse, I'd know it anywhere, his mother made it out of a boot.",
          "I won't say no. I'm too old for saying no to things. It'll buy peat till spring, and mutton fat. He'd have wanted it gone somewhere. Thank you, dear. Don't tell the cat. It'll want a share.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'nan', lines: [pickOne(['Mind how you go. Mind who you go with.', 'Off you go. I\'ll see you from the window.', 'Shut the door after you. Hard. It sticks.'])] },
    },
  };
}

// ---------------------------------------------------------------- Ned

/** Ned Wick the lamplighter, at home in his stilt house of an afternoon, or out on the lanes after dark. */
export function nedScript(first: boolean, news: SumpNews, outside: boolean): DialogueScript {
  const c = news.chalk;
  const choices: DialogueChoice[] = [];
  if (c === 'ned') choices.push({ text: "Nan Pruett says you were Jory Cotter's friend.", next: 'jory', key: true });
  if (c === 'tell') choices.push({ text: 'I found what Jory hid under his hearthstone.', next: 'tally', key: true });
  if (news.hasCoin) choices.push({ text: 'Have you seen coins like this before?', next: 'coin' });
  choices.push({ text: "You're the lamplighter?", next: 'lamps' }, { text: 'Leave you to it.', next: 'bye' });
  const greet = (): string[] => {
    if (first) {
      return outside
        ? ["Who's that? ...Oh. Oh, you're not... Sorry. Evening. Ned. Ned Wick. I do the lamps. I'm only doing the lamps.", "Don't stand behind me. Please. I don't like people behind me."]
        : ["Who's... oh. Oh, it's not... What do you want? I've done the lamps. I do the lamps, that's all I do. That's all I've ever done.", "Ned Wick. Lamplighter. Sorry. You made me jump. Everything makes me jump."];
    }
    if (c === 'done') return [pickOne(["Evening. I keep looking at the pool. Every night. Just in case.", "It's you. Good. It's good when it's you."])];
    return [pickOne(["Oh! It's you. Sorry. Evening.", "You again. Don't stand behind me.", 'Mind the gaps in the boards. Mind the trap. Mind everything.'])];
  };
  return {
    start: 'greet',
    nodes: {
      greet: { speaker: 'ned', lines: greet(), next: 'ask' },
      ask: { speaker: 'ned', lines: ['...Yes?'], choices },
      lamps: {
        speaker: 'ned',
        lines: [
          "Thirty-eight lamps. Up at dusk, out at dawn, oil and wick and glass. Sump Lane, Rookery Row, Pier Lane, the Shambles. Not the square. The square's lamps are the Rose's business.",
          "Nobody thanks the lamplighter. Nobody notices till a lamp's out. Then they notice. Then it's, Ned, where were you. ...I like it. Nobody looks at the man with the pole.",
        ],
        next: 'ask',
      },
      jory: {
        speaker: 'ned',
        lines: [
          '...Jory.',
          "Jory was my friend. Twenty years. He'd come out here of a night and we'd fish through the trap and not say anything. That's a friend, when you can not say anything.",
          "He poled crates for the grey men. Out to the old church in the fen, the drowned one, and back before light. Good money. Funny money. He said it didn't matter what was in them, it was only boxes.",
          "Then the last one. He came out here after and his hands were shaking so he couldn't hold the line. He said, Ned, it was cold. Cold as a grave in August. And it hummed. Like a hive. He said, I'm not going again.",
          "Three nights later I was at my window. I saw them. Two of the Rose's lot, Dunn, and that thin one, Ferret. A pail. And in the lane, after, when it was going up, three men in grey coats, standing. Not helping. Watching. Like you'd watch a fire in a grate.",
          "I didn't go out. I had a pole and a pail and thirty feet of boards, and I didn't go out. I stood at my window and I held the curtain. ...I'm telling you that so you know what I am.",
        ],
        next: 'jory-2',
      },
      'jory-2': {
        speaker: 'ned',
        lines: [
          "If he left anything, it's under the hearthstone. His dad kept his money under the hearthstone, and Jory did. Everybody on the lane knew. Nobody'd have touched it. Nobody'd rob Jory.",
          "I haven't been in. I can't. Will you look? For him?",
        ],
        action: 'ned-told',
        next: 'ask',
      },
      tally: {
        speaker: 'ned',
        lines: [
          "...That's his tally. He couldn't write, Jory. He drew. Read it me. I can't either.",
        ],
        next: 'tally-read',
      },
      'tally-read': {
        speaker: 'ned',
        lines: [
          "A church with water round it. The old church. Crates, three and three and four, and a coin with a hole by each. Then a rose. Then one crate, by itself, with wavy lines coming off it, like heat. Or cold. Then a cross through the boat.",
          "...That's it, then. That's him saying no. In his own hand.",
          "Keep it. Keep it safe, and don't show it in the Rose. And don't let Cray row you out to that church, whatever he says. Cray rows anybody anywhere.",
          "And... I'll tell you a thing I've told nobody. That night, after, when it had burned down to nothing, I saw something in the pool. Something swimming, low, out through the reeds. Jory swam like an eel. Like an eel.",
          "I keep looking. Every night, when I'm doing the lamps. In case.",
        ],
        action: 'chalk-rose-done',
        next: 'ask',
      },
      coin: {
        speaker: 'ned',
        lines: [
          "Jory had a pocketful. The grey men paid him in them. You can't spend them, nobody'll take them. Lusk weighs them for you and gives you half. Lusk takes anything.",
          "Jory said the writing on them looks like birds' feet. He said he'd ask somebody one day what it said. ...He didn't.",
        ],
        next: 'ask',
      },
      bye: { speaker: 'ned', lines: [pickOne(['Mind the boards.', 'Mind how you go. Not behind me. Thank you.', "I've a lamp to see to. I've always a lamp to see to."])] },
    },
  };
}
