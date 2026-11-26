/**
 * Homes in the Sump (world/SumpMaps.ts), down Sump Lane in Gloomhaven's west quarter, and the two quests
 * that run through them (their talk is in dialogue/sump.ts):
 *
 * Grey Silver: Wisp asks the hero to find out where her mam's new silver comes from. In the Crowes'
 * sewing box, a foreign coin with a square hole; from Annis, the men in grey she carries suppers to in
 * the Rose's cellar after the bell, and that one of them asked after Jory Cotter's kin.
 *
 * The Chalk Rose: the burnt house was Jory Cotter's, a lighterman who poled sealed crates in off the
 * fen for those men until he said no. The Widow Pruett tells of the fire and the two men with a pail;
 * the chalk rose on the door was drawn over the soot, after; Ned Wick the lamplighter, Jory's friend,
 * sends the hero to the hearthstone, and under it is Jory's tally, drawn because he couldn't write.
 *
 * Steps can be found out of order (the chalk looked at before the Widow's asked, say): each is a flag,
 * and {@link advanceChalkRose} ticks off the steps in order as far as the flags go.
 */
import { GameAudio } from '../../audio/Audio';
import { ANNIS_GIFT, ChalkRoseStep, GreySilverStep, JORY_PURSE, Stage, SumpNews } from '../../dialogue/sump';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { Sight } from '../../world/MapData';
import type { GameScene } from '../GameScene';
import type { DialogueAction } from './dialogueActions';
import { give, startChannel } from './sights';

export const GREY_SILVER = 'grey-silver';
export const CHALK_ROSE = 'chalk-rose';

/** The Sump's flags: what the hero has found out, and done. */
export const SUMP_FLAGS = {
  ruinLooked: 'sump-ruin-looked',
  nanTold: 'sump-nan-told',
  chalkSeen: 'sump-chalk-seen',
  nedTold: 'sump-ned-told',
  tallyFound: 'sump-tally-found',
  coinFound: 'sump-coin-found',
  nanCoin: 'sump-nan-coin',
  annisStopped: 'sump-annis-stopped',
  purseGiven: 'sump-purse-given',
} as const;

/** Where a quest has got to: not begun, the step being worked on, or done. */
function stage<S extends string>(id: string): Stage<S> {
  const q = QuestLog.get(id);
  if (!q) return 'none';
  if (q.completed) return 'done';
  return (QuestLog.current(q)?.id ?? 'done') as S;
}

/** Where the hero stands with the Sump's two quests, for its folk's talk. */
export function sumpNews(): SumpNews {
  return {
    silver: stage<GreySilverStep>(GREY_SILVER),
    chalk: stage<ChalkRoseStep>(CHALK_ROSE),
    hasCoin: Inventory.count('grey-silver') > 0,
    coins: Inventory.coins,
    annisStopped: QuestLog.hasFlag(SUMP_FLAGS.annisStopped),
    hasPurse: QuestLog.hasFlag(SUMP_FLAGS.tallyFound) && !QuestLog.hasFlag(SUMP_FLAGS.purseGiven) && Inventory.coins >= JORY_PURSE,
  };
}

/** Which of the Chalk Rose's steps each flag marks done. */
const CHALK_STEPS: Array<[ChalkRoseStep, string]> = [
  ['look', SUMP_FLAGS.ruinLooked],
  ['ask', SUMP_FLAGS.nanTold],
  ['chalk', SUMP_FLAGS.chalkSeen],
  ['ned', SUMP_FLAGS.nedTold],
  ['hearth', SUMP_FLAGS.tallyFound],
];

/** Ticks off the Chalk Rose's steps, in order, as far as what's been found out goes. */
export function advanceChalkRose(): void {
  if (!QuestLog.has(CHALK_ROSE)) return;
  for (const [step, flag] of CHALK_STEPS) {
    if (QuestLog.isDone(CHALK_ROSE, step)) continue;
    if (!QuestLog.hasFlag(flag)) return;
    QuestLog.complete(CHALK_ROSE, step);
  }
}

/** Begins the Chalk Rose (once), from the burnt house, or from what Annis lets slip. */
function startChalkRose(): void {
  if (QuestLog.has(CHALK_ROSE)) return;
  QuestLog.start(CHALK_ROSE);
  advanceChalkRose();
}

function annisHere(g: GameScene): boolean {
  return !!g.someone('annis')?.present;
}

// ---------------------------------------------------------------- arriving

/** Into the Crowes' cottage: the first time, a thought; and if Wisp asked the hero to come, that's done. */
export function enteredCrowe(g: GameScene): void {
  if (!g.visited.has('sump-crowe')) {
    g.time.delayedCall(900, () =>
      g.onHint?.('One room, low and smoky and clean as anyone could make it. A little fire, a box bed, a straw pallet, washing on a line. It smells of soap and damp and peat.'),
    );
  }
  if (stage(GREY_SILVER) === 'visit') QuestLog.complete(GREY_SILVER, 'visit');
}

/** Into the burnt house, the first time: it starts the Chalk Rose, if looking at it from the lane hasn't. */
export function enteredSumpRuin(g: GameScene): void {
  if (!g.visited.has('sump-ruin')) {
    g.time.delayedCall(900, () =>
      g.onHint?.('No roof. The sky, and the mist, and the rain coming straight down onto black ash. It still smells of burning, and under the burning, of lamp oil.'),
    );
    QuestLog.writeDiary(
      'Went into the burnt house on Sump Lane. Whoever lived there lived alone: one bed, one chair, two cups. The fire took everything ' +
        'but the iron. It smells of lamp oil, under the smoke. Houses do not burn like that on their own, not in a place this wet.',
    );
  }
  QuestLog.setFlag(SUMP_FLAGS.ruinLooked);
  startChalkRose();
  advanceChalkRose();
}

export function enteredStilt(g: GameScene): void {
  if (g.visited.has('sump-stilt')) return;
  g.time.delayedCall(900, () => g.onHint?.('The whole house sways when I step in. Light comes up between the floorboards, off the water. It smells of lamp oil and fish.'));
}

export function enteredPruett(g: GameScene): void {
  if (g.visited.has('sump-pruett')) return;
  g.time.delayedCall(900, () => g.onHint?.('So small I could touch both walls. Warm, though: a peat fire, and a little old woman at the window with a rushlight, watching me come in as if she knew I would.'));
}

// ---------------------------------------------------------------- looking closely

/** Things in the Sump that do more than give a thought. True if it was one of them. */
export function examineInSump(g: GameScene, sight: Sight): boolean {
  if (sight.id === 'gh-ruin') {
    lookAtBurntDoor(g, sight);
    return true;
  }
  if (sight.id === 'crowe-sewing') return searchSewingBox(g, sight);
  if (sight.id === 'ruin-hearthstone') return liftHearthstone(g, sight);
  return false;
}

/** The burnt house from the lane: the first look starts the Chalk Rose; a closer one sees what the chalk means. */
function lookAtBurntDoor(g: GameScene, sight: Sight): void {
  if (!QuestLog.has(CHALK_ROSE)) {
    g.onHint?.(sight.thought ?? '');
    QuestLog.setFlag(SUMP_FLAGS.ruinLooked);
    startChalkRose();
    QuestLog.writeDiary(
      "There is a burnt house on Sump Lane, black to the ground. Somebody has chalked a rose on what's left of its door, and the chalk " +
        "isn't burnt. I want to know who lived there. The neighbours will know. Neighbours always know.",
    );
    return;
  }
  if (!QuestLog.hasFlag(SUMP_FLAGS.chalkSeen)) {
    QuestLog.setFlag(SUMP_FLAGS.chalkSeen);
    g.onHint?.(
      "I look closer at the rose. The chalk lies over the soot, not under it: where it drags across the char the lines are clean and white. " +
        'Nobody drew this before the fire. Somebody came back after, and drew it, here, where the whole lane would have to see it.',
    );
    QuestLog.writeDiary(
      'The rose on the burnt door was chalked after the fire, over the soot. It is not a mark of whose house it was. It is a message to ' +
        'everyone else on the lane: this is what happens. The Black Rose has a rose on its sign.',
    );
    advanceChalkRose();
    return;
  }
  g.onHint?.('The chalk rose on the black door. This is what happens, it says. Everyone on the lane walks past it every day.');
}

/** Annis's sewing box, in the Crowes' cottage: what's under the darning, once Wisp has said. */
function searchSewingBox(g: GameScene, sight: Sight): boolean {
  const s = stage<GreySilverStep>(GREY_SILVER);
  if (s !== 'visit' && s !== 'find') return false;
  if (annisHere(g)) {
    g.onHint?.('Not with Annis sitting right there. Not with anyone sitting right there.');
    return true;
  }
  if (!Inventory.canAdd('grey-silver')) {
    g.onHint?.('My satchel is full.');
    return true;
  }
  GameAudio.rustle();
  startChannel(
    g,
    {
      label: 'Looking through the sewing box',
      seconds: 2.2,
      onDone: () => {
        QuestLog.setFlag(SUMP_FLAGS.coinFound);
        give(g, 'grey-silver', 1);
        g.onHint?.(
          "Under the darning, rolled up tight in a stocking: silver. Eleven coins, heavy and cold, each with a square hole through the middle and " +
            "writing round it like birds' feet. I take one, to ask about. I put the stocking back exactly as it was.",
        );
        QuestLog.writeDiary(
          "Wisp's mam keeps eleven silver coins rolled in a stocking at the bottom of her sewing box. Not Gloomhaven silver, not any king's I " +
            "know: each has a square hole through the middle, and writing round it I can't read. Somebody has scratched a tiny rose on one.",
        );
        if (stage(GREY_SILVER) === 'visit') QuestLog.complete(GREY_SILVER, 'visit');
        QuestLog.complete(GREY_SILVER, 'find');
      },
    },
    { x: sight.gx, y: sight.gy },
  );
  return true;
}

/** The loose hearthstone in the burnt house: once Ned has said, Jory's tally is under it. */
function liftHearthstone(g: GameScene, sight: Sight): boolean {
  if (QuestLog.hasFlag(SUMP_FLAGS.tallyFound)) {
    g.onHint?.('The hearthstone, put back where it was. There is nothing under it now but a hollow in the mud the shape of a little box.');
    return true;
  }
  if (!QuestLog.hasFlag(SUMP_FLAGS.nedTold)) {
    g.onHint?.(`${sight.thought ?? ''} If he kept anything, somebody on the lane would know where.`);
    return true;
  }
  if (!Inventory.canAdd('jory-tally')) {
    g.onHint?.('My satchel is full.');
    return true;
  }
  GameAudio.rustle();
  startChannel(
    g,
    {
      label: 'Prising up the hearthstone',
      seconds: 3,
      onDone: () => {
        QuestLog.setFlag(SUMP_FLAGS.tallyFound);
        give(g, 'jory-tally', 1);
        if (Inventory.canAdd('grey-silver')) Inventory.add('grey-silver', 1);
        Inventory.addCoins(JORY_PURSE);
        GameAudio.coins();
        g.onHint?.(
          `Under the stone, in a hollow scraped in the clay: a tin box, wrapped in oilcloth. A purse made out of an old boot with ${JORY_PURSE} coins in it, ` +
            'one silver coin with a hole through it, and a board scratched all over with little pictures. No words. Jory couldn\'t write.',
        );
        QuestLog.writeDiary(
          "Found what Jory Cotter hid under his hearthstone: a little purse of coins, one of the grey men's holed silver pieces, and his tally, " +
            "scratched on a board in pictures because he could not write. Ned Wick should see it. It was his friend's.",
        );
        advanceChalkRose();
      },
    },
    { x: sight.gx, y: sight.gy },
  );
  return true;
}

// ---------------------------------------------------------------- what's said

export const SUMP_ACTIONS: Record<string, DialogueAction> = {
  // Wisp asks the hero to find out where her mam's silver comes from (in the square, or at home).
  'grey-silver-start': (g) => {
    if (QuestLog.has(GREY_SILVER)) return;
    QuestLog.start(GREY_SILVER, g.area === 'sump-crowe' ? ['talk', 'visit'] : ['talk']);
    QuestLog.writeDiary(
      "Wisp is frightened, though she'd bite me for saying so. Her mam works at the Black Rose, and since the summer she has been bringing " +
        "home silver: foreign silver, with holes in. She goes out after the Rose's bell and comes home crying. Wisp wants me to find out why.",
    );
  },
  'grey-silver-visited': () => {
    if (stage(GREY_SILVER) === 'visit') QuestLog.complete(GREY_SILVER, 'visit');
  },
  // Annis tells what she does for the men in grey, and what one of them asked her about Jory Cotter.
  'grey-silver-annis': () => {
    if (stage(GREY_SILVER) !== 'annis') return;
    QuestLog.complete(GREY_SILVER, 'annis');
    QuestLog.writeDiary(
      'Annis Crowe carries suppers down to the Rose\'s cellar after the bell, for men in grey coats who talk in a sing-song tongue over sealed ' +
        'crates, and pay her in their holed silver. One of them asked her if Jory Cotter, from the burnt house, had any kin. Why ask that about ' +
        'a dead man? Unless he isn\'t one.',
    );
    startChalkRose();
  },
  'annis-gift': () => {
    if (QuestLog.hasFlag(SUMP_FLAGS.annisStopped) || !Inventory.addCoins(-ANNIS_GIFT)) return;
    GameAudio.coins();
    QuestLog.setFlag(SUMP_FLAGS.annisStopped);
  },
  'grey-silver-done': () => {
    if (stage(GREY_SILVER) !== 'tell') return;
    QuestLog.complete(GREY_SILVER, 'tell');
    QuestLog.writeDiary(
      QuestLog.hasFlag(SUMP_FLAGS.annisStopped)
        ? 'Told Wisp her mam will be home of a night for a while. She pretended not to care, very badly. Her name is Tansy. Only her mam calls her that. And me, now.'
        : 'Told Wisp what I know about her mam and the silver. She took it better than I would have. Her name is Tansy. Only her mam calls her that. And me, now.',
    );
  },
  // The Widow Pruett tells who lived in the burnt house, and of the fire.
  'nan-told': () => {
    if (QuestLog.hasFlag(SUMP_FLAGS.nanTold)) return;
    QuestLog.setFlag(SUMP_FLAGS.nanTold);
    startChalkRose();
    QuestLog.writeDiary(
      'The burnt house was Jory Cotter\'s, a lighterman. Since the summer he poled sealed crates in off the fen at night for the people under ' +
        'the Rose, paid in their holed silver, until one night he came back grey and said he would not go again. Three nights later his house ' +
        "burned, and the whole lane watched. The Widow Pruett saw two men go up the lane before: one big, one thin, with a pail. The lamplighter, Ned Wick, was Jory's friend.",
    );
    advanceChalkRose();
  },
  'nan-coin': () => QuestLog.setFlag(SUMP_FLAGS.nanCoin),
  'nan-purse': () => {
    if (QuestLog.hasFlag(SUMP_FLAGS.purseGiven) || !Inventory.addCoins(-JORY_PURSE)) return;
    GameAudio.coins();
    QuestLog.setFlag(SUMP_FLAGS.purseGiven);
    QuestLog.writeDiary("Gave Jory Cotter's little purse to the Widow Pruett, for peat and mutton fat till spring. It felt like the right place for it.");
  },
  // Ned Wick tells what Jory said of the last crate, what he saw the night of the fire, and where Jory kept his money.
  'ned-told': () => {
    if (QuestLog.hasFlag(SUMP_FLAGS.nedTold)) return;
    QuestLog.setFlag(SUMP_FLAGS.nedTold);
    startChalkRose();
    QuestLog.writeDiary(
      "Ned Wick says Jory poled crates for the grey men out to the old drowned church in the fen. The last one was cold as a grave in August, " +
        'and it hummed. The night of the fire Ned saw Dunn and Ferret, from the Rose, with a pail, and after, three men in grey coats in the lane, ' +
        "watching it burn. He didn't go out. He wants me to look under Jory's hearthstone.",
    );
    advanceChalkRose();
  },
  // Reading Jory's tally to Ned: the end of the Chalk Rose.
  'chalk-rose-done': () => {
    advanceChalkRose();
    if (stage(CHALK_ROSE) !== 'tell') return;
    QuestLog.complete(CHALK_ROSE, 'tell');
    QuestLog.writeDiary(
      "Read Jory's tally to Ned. Runs out to the old church, crates and holed silver, a rose; then one crate on its own, with something coming " +
        'off it, and a cross through his boat. That was him saying no. Somebody in the Rose answered with a pail of lamp oil and a stick of chalk. ' +
        "Ned saw something swim away through the reeds that night. He looks for it every night. I think I will too.",
    );
  },
};
