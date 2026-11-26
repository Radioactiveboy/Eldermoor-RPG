/**
 * The Shambles, Gloomhaven's east quarter (world/ShamblesYard.ts, world/ShamblesMap.ts, dialogue/shambles.ts):
 * going into its buildings, and its two stories. "Answers to Nothing": Old Scritch's grey lurcher, in a pen in
 * the Red Aprons' pit barn, bought off Ned Flay, fought for, or let out by Lugs. "Pay or Swim": the Widow
 * Thorne's three silver from Tam Rudd, hiding in the tannery loft.
 */
import Phaser from 'phaser';
import { GameAudio } from '../../audio/Audio';
import { NOTHING_PRICE, SCRITCH_REWARD, TAM_BOUNTY, TAM_DEBT, TAM_FARE, WIDOW_TAM_REWARD } from '../../dialogue/shambles';
import type { Creature } from '../../entities/Creature';
import type { FoeKind } from '../../systems/Combat';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { NOTHING_QUEST, Shambles, SHAMBLES_FLAGS as F, TAM_QUEST } from '../../systems/Shambles';
import type { Sight } from '../../world/MapData';
import type { GameScene } from '../GameScene';
import type { DialogueAction } from './dialogueActions';
import { fightAfterTalk } from './talkFight';

/** Which Red Apron fights as which foe. */
const PIT_FOES: Record<string, FoeKind> = { flay: 'apronflay', gristle: 'apronknacker' };

const FIRST_LOOKS: Partial<Record<string, { hint: string; diary: string }>> = {
  slaughterhouse: {
    hint: 'The smell hits first, then the heat off the scalding vat. Halves of pig swing on the rail. A man in a white shirt watches me come in, and doesn\'t blink.',
    diary: "Went into Rendle's slaughterhouse in the Shambles. Saul Rendle, whom they call the Gaffer, runs the Red Aprons from behind its counter: a big, soft-spoken man in a spotless white shirt, with very clean hands.",
  },
  tannery: {
    hint: 'Lime and bark and rot. My eyes are streaming before the door has shut behind me.',
    diary: "Looked in at Morrow Vetch's tannery: a year in the pits, he says, to make a hide into leather. There's a ladder up to a drying loft.",
  },
  'tannery-loft': {
    hint: 'Hides hanging in rows in the half-dark, turning in the draught. Something moves behind them.',
    diary: '',
  },
  ratden: {
    hint: 'Cages of rats from floor to rafters, all of them watching me. An old man looks up from among them.',
    diary: "Met Old Scritch, the rat-catcher of the Shambles, in his den at the end of the lane: cages of live rats, jars of poison, and an empty dog bed by the stove.",
  },
  dogpit: {
    hint: 'A ring of boards in the lamplight, the sand in it raked over and still dark. The dogs in the pens don\'t bark. They just watch.',
    diary: "Found the Red Aprons' pit in the barn behind the tannery. They fight dogs in it, Ned Flay's dogs, and rats, and bet on how long things take to die.",
  },
};

/** Into any of the Shambles' rooms: the first look, and the loft's discovery. */
export function enteredShambles(g: GameScene): void {
  if (g.area === 'tannery-loft' && Shambles.tamFate() === 'hiding' && !QuestLog.hasFlag('tam-found')) {
    QuestLog.setFlag('tam-found');
    QuestLog.complete(TAM_QUEST, 'find');
    QuestLog.writeDiary("Found Tam Rudd, hiding in the drying loft over Vetch's tannery, among the hides. He owes the Rose three silver, and Rendle more.");
  }
  if (g.visited.has(g.area)) return;
  const first = FIRST_LOOKS[g.area];
  if (!first) return;
  g.time.delayedCall(900, () => g.onHint?.(first.hint));
  if (first.diary) QuestLog.writeDiary(first.diary);
}

/** Seeing Nothing in her pen, or Flay's chalked "NEW STOCK. GREY", tells the hero where she is. Never handles the look itself. */
export function examineInShambles(_g: GameScene, sight: Sight): boolean {
  if ((sight.id === 'shp-pens' || sight.id === 'sh-pitboard') && !QuestLog.hasFlag(F.nothingFree)) foundNothing();
  return false;
}

function foundNothing(): void {
  if (QuestLog.hasFlag('nothing-found')) return;
  QuestLog.setFlag('nothing-found');
  if (!QuestLog.has(NOTHING_QUEST)) return;
  QuestLog.complete(NOTHING_QUEST, 'find');
  QuestLog.writeDiary("Scritch's dog is in Ned Flay's pit barn, in a pen with her chain pulled tight, waiting for Saturday's fights.");
}

/** Steps already behind the hero when Scritch asks. */
function nothingDone(): string[] {
  const done = ['talk'];
  if (QuestLog.hasFlag('nothing-found') || QuestLog.hasFlag(F.nothingFree)) done.push('find');
  if (QuestLog.hasFlag(F.nothingFree)) done.push('free');
  return done;
}

/** Nothing is out: the flags, the quest step, and (if she's in sight) her gone through the barn door. */
function freeNothing(g: GameScene, how: string, diary: string): void {
  if (QuestLog.hasFlag(F.nothingFree)) return;
  QuestLog.setFlag(F.nothingFree);
  QuestLog.setFlag(how);
  foundNothing();
  QuestLog.complete(NOTHING_QUEST, 'free');
  QuestLog.writeDiary(diary);
  const dog = g.hounds.find((h) => h.kind === 'lurcher');
  if (dog) {
    g.hounds = g.hounds.filter((h) => h !== dog);
    dog.fadeAway(900);
  }
}

/** "Fight him." Flay (and Gristle, if he's in) become the foes they fight as, where they stand. */
function pitFight(g: GameScene): void {
  fightAfterTalk(g, { sides: PIT_FOES, tag: 'pit', stillOn: () => !QuestLog.hasFlag(F.pitFought) });
}

/** After a fight in the barn: if Flay went down, Nothing is out of her pen and away home, and the cash box is open. */
export function checkPitFight(g: GameScene, slain: Creature[]): void {
  if (g.area !== 'dogpit' || !slain.some((c) => c.kind === 'apronflay') || QuestLog.hasFlag(F.pitFought)) return;
  QuestLog.setFlag(F.pitFought);
  const purse = Phaser.Math.Between(18, 30);
  Inventory.reward(purse);
  GameAudio.coins();
  freeNothing(
    g,
    F.nothingFought,
    `Fought Ned Flay in his own pit barn over Scritch's dog, and put him on the floor. There were ${purse} coins in his cash box. ` +
      "I let the grey dog out of her pen and she went through the door like smoke. Rendle will hear of this before I'm off the lane.",
  );
  g.time.delayedCall(2600, () => g.onHint?.('The middle pen stands open. The two brindles watch me go, and don\'t make a sound.'));
}

/** The Widow's reward and the end of the errand, whichever way it went. */
function tamReported(): void {
  const fate = Shambles.tamFate();
  if (fate === 'hiding' || !QuestLog.has(TAM_QUEST) || QuestLog.isDone(TAM_QUEST, 'tell')) return;
  if (fate !== 'rowed') {
    Inventory.reward(WIDOW_TAM_REWARD);
    GameAudio.coins();
  }
  for (const step of ['talk', 'find', 'settle', 'tell']) QuestLog.complete(TAM_QUEST, step);
  const lines: Record<typeof fate, string> = {
    potboy: 'Told the Widow Thorne that Tam would work off his slate. He is in her scullery now, scrubbing, and Grubb sleeps across the door so the Aprons cannot get at him.',
    paid: "Told the Widow I'd paid Tam Rudd's slate myself. She called me a fool, and gave me some of it back.",
    rowed: "Told the Widow Thorne that Tam Rudd is gone downriver in Cray's boat. She is not pleased. She did not pay me.",
    sold: "The Widow knows Rendle paid Tam Rudd's slate. She knows how he found him. She paid me, and wouldn't look at me.",
  };
  QuestLog.writeDiary(lines[fate]);
}

/** Tam leaves the loft one way or another: the flag, and the quest step. */
function tamGoes(g: GameScene, how: string, diary: string): void {
  if (Shambles.tamFate() !== 'hiding') return;
  QuestLog.setFlag(how);
  QuestLog.setFlag(F.tamGone);
  QuestLog.complete(TAM_QUEST, 'find');
  QuestLog.complete(TAM_QUEST, 'settle');
  QuestLog.writeDiary(diary);
  const tam = g.someone('tam');
  if (tam) g.afterTalk = () => tam.leave({ x: 7.5, y: 3.2 });
}

export const SHAMBLES_ACTIONS: Record<string, DialogueAction> = {
  'nothing-accept': () => {
    if (QuestLog.has(NOTHING_QUEST)) return;
    QuestLog.start(NOTHING_QUEST, nothingDone());
    QuestLog.writeDiary(
      "Old Scritch the rat-catcher has lost his dog, Nothing: a grey lurcher with a white blaze. He thinks the Red Aprons took her for Ned Flay's dog pit, " +
        'in the barn behind the tannery, and that they will put her in the ring first, to warm the fighting dogs up. I said I would look.',
    );
  },
  'nothing-found-tam': () => foundNothing(),
  'nothing-buy': (g) => {
    if (QuestLog.hasFlag(F.nothingFree) || !Inventory.addCoins(-NOTHING_PRICE)) return;
    GameAudio.coins();
    freeNothing(g, F.nothingBought, `Bought Scritch's dog off Ned Flay for ${NOTHING_PRICE} coins. She was out of the barn before the pen was fully open.`);
  },
  'nothing-lugs': (g) => {
    QuestLog.setFlag(F.lugsApprentice);
    freeNothing(g, F.nothingLugs, "Talked Lugs, the Red Aprons' dog-lad, into letting Scritch's dog out and going with her. He folded his apron and left it on the straw.");
    const lugs = g.someone('lugs');
    if (lugs) g.afterTalk = () => lugs.leave({ x: 1.2, y: 6.5 });
  },
  'pit-fight': pitFight,
  'nothing-reward': (g) => {
    if (!QuestLog.has(NOTHING_QUEST) || QuestLog.isDone(NOTHING_QUEST, 'tell')) return;
    Inventory.reward(SCRITCH_REWARD);
    GameAudio.coins();
    QuestLog.complete(NOTHING_QUEST, 'tell');
    QuestLog.setFlag('scritch-crates');
    QuestLog.writeDiary(
      `Nothing is home with Old Scritch, and he gave me ${SCRITCH_REWARD} coins. He told me something else: the rats won't go near the crates that come in off the fen at night, ` +
        'sealed with red wax. He found a rat frozen dead beside one, in August, and the crate burned his fingers with cold.',
    );
    g.time.delayedCall(600, () => g.onHint?.('Red wax. Cold enough to burn. Like the crate in the back room of the Rose.'));
  },
  'tam-accept': () => {
    if (QuestLog.has(TAM_QUEST)) return;
    const done = ['talk'];
    if (QuestLog.hasFlag('tam-found') || Shambles.tamFate() !== 'hiding') done.push('find');
    if (Shambles.tamFate() !== 'hiding') done.push('settle');
    QuestLog.start(TAM_QUEST, done);
    QuestLog.writeDiary(
      'The Widow Thorne wants the three silver Tam Rudd owes the Rose, or Tam himself to scrub it off at a copper a day. He has not been home in a week, ' +
        'and the Red Aprons are looking for him too.',
    );
  },
  'tam-pay': (g) => {
    if (!Inventory.addCoins(-TAM_DEBT)) return;
    GameAudio.coins();
    tamGoes(g, F.tamPaid, `Paid Tam Rudd's slate at the Rose for him, ${TAM_DEBT} coins. He's gone to his girl's, whose brothers are big.`);
  },
  'tam-row': (g) => {
    if (!Inventory.addCoins(-TAM_FARE)) return;
    GameAudio.coins();
    tamGoes(g, F.tamRowed, `Paid Cray ${TAM_FARE} coins to row Tam Rudd away downriver at the dead hour. The Widow will not see her three silver.`);
  },
  'tam-potboy': (g) => tamGoes(g, F.tamPotboy, 'Tam Rudd has gone to the Black Rose to work off his slate, at a copper a day. Nobody does trouble in the Rose.'),
  'tam-sell': () => {
    if (Shambles.tamFate() !== 'hiding') return;
    Inventory.reward(TAM_BOUNTY);
    GameAudio.coins();
    QuestLog.setFlag(F.tamSold);
    QuestLog.setFlag(F.tamGone);
    QuestLog.complete(TAM_QUEST, 'find');
    QuestLog.complete(TAM_QUEST, 'settle');
    QuestLog.writeDiary(`Told Saul Rendle where Tam Rudd is hiding, for ${TAM_BOUNTY} coins. He sent Gristle. He says he'll pay the Widow's slate himself.`);
  },
  'tam-reported': () => tamReported(),
};
