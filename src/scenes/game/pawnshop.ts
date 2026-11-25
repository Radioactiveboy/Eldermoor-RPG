/**
 * Lusk's pawnshop on Gloomhaven's square (world/PawnshopMap.ts,
 * dialogue/pawnshop.ts, systems/Pawnshop.ts): the doors (the shop shut from two
 * till nine, the counting room Lusk's own until he asks the hero up, the top
 * floor locked until he hands over the key), Saint Elda's bell, walking in on
 * the Hooks collecting, the black ledger, and the night Nim Dace comes for the
 * stash: faced down with what the ledger says about him, or fought among the
 * clocks.
 */
import Phaser from 'phaser';
import { GameAudio } from '../../audio/Audio';
import { SpeakerId } from '../../dialogue/Dialogue';
import { BLACK_LEDGER, PAWN_CHATTER, PAWN_MUTTERS } from '../../dialogue/pawnshop';
import type { Creature } from '../../entities/Creature';
import { Npc } from '../../entities/Npc';
import { FoeKind } from '../../systems/Combat';
import { Inventory } from '../../systems/Inventory';
import {
  COLLECTING_HOURS, HOOKS_PURSE, LUSK_HOURS, LUSK_HUSH, LUSK_REWARD, PAWN_FLAGS, PROTECTION_QUEST, protectionOutcome, protectionStage, STASH_HOURS,
} from '../../systems/Pawnshop';
import { QuestLog } from '../../systems/Quests';
import type { Door, Sight } from '../../world/MapData';
import type { GameScene } from '../GameScene';
import { CHATTER_GAP, LINE_GAP } from './tavern';

/** The pawnshop's three floors. */
export const PAWN_AREAS = ['pawnshop', 'pawn-counting', 'pawn-attic'] as const;

/** Which of the Hooks fights as which foe. */
const HOOK_FOES: Record<string, FoeKind> = { dace: 'hookgaff', orm: 'hookbrute' };
/** The street door, inside: where the Hooks leave by. */
const DOOR = { x: 1.2, y: 7.5 };

/** Into the shop: the first time, the hero takes it in; and if the Hooks are here, they're seen. */
export function enteredPawnshop(g: GameScene): void {
  if (!g.visited.has('pawnshop')) {
    g.time.delayedCall(1000, () =>
      g.onHint?.('A bell jangles over the door. Inside it is dim and close and crammed to the ceiling: armour, clocks, a bear, chairs on chairs. Everything has a ticket on it. Behind an iron grille, a tall thin man in a wide black hat looks up and smiles.'),
    );
    QuestLog.writeDiary(
      "Went into Lusk's, the pawnshop on the corner of Gloomhaven's square. Three floors of other people's things, every one with a ticket on it, " +
        'and Abel Lusk behind an iron grille, smiling like a man who knows what you are going to sell him before you do. He has a shop girl called ' +
        'Nettle who looks as if she would bite.',
    );
  }
  g.pawnScene = undefined;
  g.time.delayedCall(700, () => hooksSeen(g));
}

/** Up the stairs to the counting room. */
export function enteredCounting(g: GameScene): void {
  if (g.visited.has('pawn-counting')) return;
  g.time.delayedCall(900, () => g.onHint?.('A low room that smells of ink and candle-wax and cat. Ledgers to the ceiling, a safe as big as a privy, and on the desk, a black book with a red ribbon.'));
}

/** Up under the roof, to the stash. */
export function enteredAttic(g: GameScene): void {
  if (g.visited.has('pawn-attic')) return;
  g.time.delayedCall(900, () => g.onHint?.("Cold up here, right under the slates, and the rain loud on them. Crates and sacks and bolts of cloth stacked to the rafters. None of it is Lusk's. All of it is the Hooks'."));
  QuestLog.writeDiary(
    "Lusk gave me the key to his top floor. It is the Hooks' stash: crates with other people's marks on, cloth with river mud on it, a figurehead off a barge called " +
      "the Wend Maiden, a gentleman's silver in straw. Everything the river \"gave\" them. And in the corner, set apart from the rest, a crate sealed in grey wax.",
  );
}

/** If the Hooks are in the shop (and the hero hasn't dealt with them yet), the scene that goes with it plays. */
function hooksSeen(g: GameScene): void {
  if (g.area !== 'pawnshop' || g.busy || g.inCombat || g.pawnScene) return;
  const dace = g.someone('dace');
  if (!dace?.present) return;
  const stage = protectionStage();
  if (stage === 'evening') collecting(g, dace);
  else if (stage === 'stash') forTheStash(g, dace);
}

/** Walking in on the Hooks collecting: Dace and Lusk finish their business, and then Dace turns round. */
function collecting(g: GameScene, dace: Npc): void {
  g.pawnScene = 'collecting';
  g.busy = true;
  const lusk = g.someone('lusk');
  const orm = g.someone('orm');
  g.player.setPath([]);
  dace.say("There's the tithe, Abel. And the sack. Count it if you like.", 3.2);
  g.time.delayedCall(2600, () => lusk?.say('Wouldn\'t dream of it, Nim. Always a pleasure.', 3));
  g.time.delayedCall(4400, () => {
    orm?.say('...', 2);
    g.onHint?.('In the doorway, a huge man in a tarred oilskin lets a sack fall off his shoulder. Something in it clanks.');
  });
  g.time.delayedCall(6600, () => {
    dace.faceTowards(g.player.gx, g.player.gy);
    g.busy = false;
    if (g.area === 'pawnshop') g.startConversation(dace);
  });
}

/** Dace and Orm come for the stash, and find the hero there. */
function forTheStash(g: GameScene, dace: Npc): void {
  g.pawnScene = 'stash';
  g.busy = true;
  g.player.setPath([]);
  dace.say('Evening, Abel. Evening, friend. Busy night.', 3);
  g.time.delayedCall(1800, () => {
    dace.faceTowards(g.player.gx, g.player.gy);
    g.busy = false;
    if (g.area === 'pawnshop') g.startConversation(dace);
  });
}

/** Keeps Lusk and Nettle muttering between customers, and notices the Hooks coming in while the hero's here. */
export function updatePawnshop(g: GameScene, dt: number): void {
  if (g.area !== 'pawnshop') return;
  if (!g.pawnScene && !g.busy && g.someone('dace')?.present && !g.inCombat) hooksSeen(g);
  if (g.busy || g.someone('dace')?.present) return;
  g.chatterTimer -= dt;
  if (g.chatterTimer > 0) return;
  const gap = () => CHATTER_GAP[0] + Math.random() * (CHATTER_GAP[1] - CHATTER_GAP[0]) + 4;
  const exchanges = PAWN_CHATTER.filter((ex) => ex.every(([id]) => g.someone(id)?.idle));
  if (exchanges.length > 0 && Math.random() < 0.45) {
    const ex = exchanges[Math.floor(Math.random() * exchanges.length)];
    ex.forEach(([id, text], i) => g.time.delayedCall(i * LINE_GAP * 1000, () => g.someone(id)?.say(text, LINE_GAP + 0.3)));
    g.chatterTimer = ex.length * LINE_GAP + gap();
    return;
  }
  g.chatterTimer = gap();
  const talkers = g.npcs.filter((n) => n.present && n.idle && !n.speech && PAWN_MUTTERS[n.id as SpeakerId]);
  const who = talkers[Math.floor(Math.random() * talkers.length)];
  const lines = who && PAWN_MUTTERS[who.id as SpeakerId]!;
  if (who && lines) who.say(lines[Math.floor(Math.random() * lines.length)], 3);
}

/**
 * Doors at Lusk's that may be shut: the shop itself from two in the morning
 * till nine (unless it's the night Dace comes, and Lusk is waiting up), the
 * stairs until Lusk has asked the hero up, and the top floor until he's
 * handed over the key.
 */
export function pawnDoorAllowed(g: GameScene, door: Door): boolean {
  const hour = g.clock.hour;
  if (door.to === 'pawnshop' && g.area === 'gloomhaven') {
    const waiting = protectionStage() === 'stash' && Npc.within(STASH_HOURS, hour);
    if (Npc.within(LUSK_HOURS, hour) || waiting) return true;
    GameAudio.rattle();
    g.onHint?.('Barred, and the shutters are up. Through a crack I can see a candle on the counter, and a long shape lying on it, snoring. "Nine o\'clock!" it says, without waking.');
    return false;
  }
  if (door.id === 'pawn-up') {
    if (QuestLog.hasFlag(PAWN_FLAGS.upstairs)) return true;
    GameAudio.rattle();
    g.someone('lusk')?.say(Math.random() < 0.5 ? 'Private, friend.' : 'Upstairs is for family. I have none. Down here, please.', 2.6);
    g.onHint?.('Lusk lifts one long finger, without looking up. The stairs are his.');
    return false;
  }
  if (door.id === 'pawn-attic') {
    if (QuestLog.hasFlag(PAWN_FLAGS.helping) || QuestLog.hasFlag(PAWN_FLAGS.squeezed)) return true;
    GameAudio.rattle();
    g.onHint?.('Locked, with a good lock. Lusk keeps the key on his watch chain. Somewhere overhead, something shifts on the boards, and settles.');
    return false;
  }
  return true;
}

/** Looking closely at things at Lusk's: the bell, the black ledger, the sealed crate. Returns false if it's none of them. */
export function examinePawnshop(g: GameScene, sight: Sight): boolean {
  if (sight.id === 'pawn-bell') {
    g.onHint?.(sight.thought!);
    if (!QuestLog.hasFlag(PAWN_FLAGS.sawBell)) {
      QuestLog.setFlag(PAWN_FLAGS.sawBell);
      QuestLog.writeDiary(
        "Found Saint Elda's bell in Lusk's pawnshop: the one that hung over the brothers' gate, with the saint's lily on it. I rang it myself, to be let in. " +
          'Somebody stole it off its frame and brought it all the way down the river. I want to know who.',
      );
    }
    return true;
  }
  if (sight.id === 'pawn-ledger') {
    GameAudio.click();
    g.onSign?.(BLACK_LEDGER.heading, BLACK_LEDGER.lines);
    if (!QuestLog.hasFlag(PAWN_FLAGS.readLedger)) {
      QuestLog.setFlag(PAWN_FLAGS.readLedger);
      QuestLog.complete(PROTECTION_QUEST, 'ledger');
      QuestLog.writeDiary(
        "Read Lusk's black ledger. Every sack the Hooks have made him buy since midsummer, and what he paid, and what it was worth. And something else: " +
          'Nim Dace has been selling a little of the Hooks\' takings through Lusk on his own account, and keeping it from Moll Ketch, who runs them. ' +
          'His initials are on every page. There is a crate upstairs that isn\'t the Hooks\' at all, held for "the gentleman at the Rose", and paid for in a silver Lusk doesn\'t know.',
      );
    }
    return true;
  }
  if (sight.id === 'pawn-eye-crate') {
    g.onHint?.(sight.thought!);
    if (!QuestLog.hasFlag(PAWN_FLAGS.sawEye)) {
      QuestLog.setFlag(PAWN_FLAGS.sawEye);
      QuestLog.writeDiary(
        "Under Lusk's roof there's a crate that isn't the Hooks', sealed in grey wax with an eye in silver leaf pressed into it, the same eye as on the black card " +
          "nailed up on the Black Rose's notice board. It's waiting for somebody to collect it. I think I know who.",
      );
    }
    return true;
  }
  return false;
}

/** The Hooks, as they stand about the shop. */
function hooks(g: GameScene): Npc[] {
  return Object.keys(HOOK_FOES)
    .map((id) => g.someone(id))
    .filter((n): n is Npc => !!n);
}

/** The Hooks go, out of the street door, Dace first, Orm after, not hurrying. */
function hooksLeave(g: GameScene, parting?: string): void {
  g.afterTalk = () => {
    const [dace, orm] = [g.someone('dace'), g.someone('orm')];
    if (parting) dace?.say(parting, 3);
    g.time.delayedCall(600, () => dace?.leave(DOOR));
    g.time.delayedCall(1700, () => orm?.leave(DOOR));
  };
}

/** Each of the Hooks becomes the foe they fight as, where they stand, and the fight is on (as the beacon's band: see beacon.ts). */
function fight(g: GameScene): void {
  g.afterTalk = () => {
    const code = Promise.all([import('../../entities/Creature'), import('./combat')]);
    g.time.delayedCall(150, () => void code.then(([{ Creature }, { startCombat }]) => {
      if (g.inCombat || protectionStage() !== 'stash') return;
      g.busy = false;
      const stamp = Date.now();
      g.someone('lusk')?.say('Not the clocks! Not the clocks!', 2.5);
      const foes: Creature[] = hooks(g).map((npc) => {
        const kind = HOOK_FOES[npc.id];
        const id = `pawn-${npc.id}-${stamp}`;
        (g.map.data.creatures ??= []).push({ id, kind, gx: npc.gx, gy: npc.gy, respawns: true });
        const c = new Creature(g, g.map, id, kind, npc.gx, npc.gy);
        g.creatures.push(c);
        c.faceTowards(g.player.gx, g.player.gy);
        npc.destroy();
        g.npcs = g.npcs.filter((n) => n !== npc);
        return c;
      });
      if (foes.length > 0) startCombat(g, foes[0], undefined, foes);
    }));
  };
}

/** After a fight in the shop: the Hooks beaten (or run off), the stash is Lusk's to keep. */
export function checkPawnFight(g: GameScene, foes: Creature[]): void {
  if (g.area !== 'pawnshop' || !foes.some((c) => c.kind === 'hookgaff' || c.kind === 'hookbrute') || protectionStage() !== 'stash') return;
  QuestLog.setFlag(PAWN_FLAGS.fought);
  QuestLog.setFlag(PAWN_FLAGS.hooksGrudge);
  QuestLog.complete(PROTECTION_QUEST, 'dace');
  const purse = Phaser.Math.Between(HOOKS_PURSE[0], HOOKS_PURSE[1]);
  Inventory.reward(purse);
  GameAudio.coins();
  QuestLog.writeDiary(
    "Nim Dace came for the Hooks' stash at Lusk's tonight, with Orm, and found me in the way. I told him it was staying where it was. It came to blows among the clocks. " +
      `When it was over Orm had broken a shelf of them and Dace had gone out of the door holding his arm. They left ${purse} coins on the floor between them. The Hooks will remember my face.`,
  );
  g.time.delayedCall(2600, () => g.onHint?.('Every clock in the shop is chiming at once. Behind the grille, Lusk slowly takes his hands off his ears.'));
}

/** Lines of dialogue that move "Protection" on (see dialogueActions.ts). */
export const PAWN_ACTIONS: Record<string, (g: GameScene) => void> = {
  'pawn-bell': () => {
    if (QuestLog.has(PROTECTION_QUEST)) return;
    QuestLog.start(PROTECTION_QUEST, ['bell']);
    QuestLog.writeDiary(
      "Asked Lusk about Saint Elda's bell. He bought it, he says, off a waterfront gang called the Hooks, who make him buy whatever they steal off the river at their price, " +
        'and charge him for his windows on top. Protection, they call it. He told me to come back of an evening if I wanted to see it for myself.',
    );
  },
  'pawn-hooks-leave': (g) => {
    if (QuestLog.hasFlag(PAWN_FLAGS.sawCollection)) return;
    QuestLog.setFlag(PAWN_FLAGS.sawCollection);
    QuestLog.complete(PROTECTION_QUEST, 'evening');
    QuestLog.writeDiary(
      'Walked in on the Hooks collecting at Lusk\'s: a smiling, talkative one called Nim Dace, and a giant in the doorway who never said a word. ' +
        'They left a sack of stolen goods for Lusk to buy and took his silver, and Lusk thanked them for it.',
    );
    hooksLeave(g);
    g.time.delayedCall(6500, () => g.someone('lusk')?.say('...Well. Now you\'ve met the family.', 3.5));
  },
  'pawn-upstairs': () => {
    if (QuestLog.hasFlag(PAWN_FLAGS.upstairs)) return;
    QuestLog.setFlag(PAWN_FLAGS.upstairs);
    QuestLog.complete(PROTECTION_QUEST, 'talk');
    // Already read it (impossible without the stairs, but saves made in testing may have): the step's done.
    if (QuestLog.hasFlag(PAWN_FLAGS.readLedger)) QuestLog.complete(PROTECTION_QUEST, 'ledger');
  },
  'pawn-help': () => {
    if (QuestLog.hasFlag(PAWN_FLAGS.helping)) return;
    QuestLog.setFlag(PAWN_FLAGS.helping);
    QuestLog.complete(PROTECTION_QUEST, 'choose');
    QuestLog.writeDiary(
      "Told Lusk I'd help him get out from under the Hooks. Nim Dace comes after dark for the stash on Lusk's top floor. I'm to be standing at the counter when he does. " +
        'Lusk gave me the key to the top floor, and told me not to touch the crate with the eye on it.',
    );
  },
  'pawn-squeeze': (g) => {
    if (QuestLog.hasFlag(PAWN_FLAGS.squeezed) || QuestLog.hasFlag(PAWN_FLAGS.helping)) return;
    QuestLog.setFlag(PAWN_FLAGS.squeezed);
    Inventory.reward(LUSK_HUSH);
    GameAudio.coins();
    for (const step of ['choose', 'dace', 'done']) QuestLog.complete(PROTECTION_QUEST, step);
    QuestLog.writeDiary(
      `Told Lusk I'd let the Hooks know about his black ledger unless he made it worth my while. He laughed, and paid me ${LUSK_HUSH} silver, and promised me his best prices. ` +
        'He seemed almost proud of me. The Hooks will go on collecting, and Lusk will go on paying, and now so will I. I am not sure what Mother would have said.',
    );
    g.time.delayedCall(800, () => g.someone('nettle')?.say('...Huh.', 2.5));
  },
  'pawn-fight': fight,
  'pawn-bluffed': (g) => {
    if (protectionStage() !== 'stash') return;
    QuestLog.setFlag(PAWN_FLAGS.bluffed);
    QuestLog.complete(PROTECTION_QUEST, 'dace');
    QuestLog.writeDiary(
      "Nim Dace came for the Hooks' stash at Lusk's tonight, with Orm. I asked him how Moll Ketch would like to know what he's been selling on his own account. " +
        "He went very still, and then he laughed, and said Lusk's shop has been squeezed dry and isn't worth the Hooks' while. He'll tell Moll so himself. And we never spoke.",
    );
    hooksLeave(g, 'Come on, Orm. Nothing for us here. Nothing at all.');
  },
  'pawn-reward': () => {
    const outcome = protectionOutcome();
    if (!outcome || outcome === 'squeezed' || QuestLog.hasFlag(PAWN_FLAGS.freed)) return;
    QuestLog.setFlag(PAWN_FLAGS.freed);
    const pay = outcome === 'bluffed' ? LUSK_REWARD.bluffed : LUSK_REWARD.fought;
    Inventory.reward(pay);
    GameAudio.coins();
    QuestLog.complete(PROTECTION_QUEST, 'done');
    QuestLog.writeDiary(
      `Lusk paid me ${pay} silver for seeing the Hooks off, and says I'll have his best prices for as long as he lives. ` +
        (outcome === 'bluffed' ? 'He says he is free, and does not know what to do with his hands.' : 'He also says the Hooks will remember my face. I believe him.'),
    );
  },
  'pawn-told-eye': () => {
    if (QuestLog.hasFlag(PAWN_FLAGS.toldOfEye)) return;
    QuestLog.setFlag(PAWN_FLAGS.toldOfEye);
    QuestLog.writeDiary(
      "Lusk says the crate with the silver eye is held for a gentleman at the Black Rose: grey coat, grey gloves. He pays in silver Lusk has never seen, new-struck, " +
        'with a strange head on it and letters nobody here can read. The gentleman in the Rose\'s back room, who calls himself Vane. What is he collecting?',
    );
  },
};

/** The hours the Hooks come collecting, for anything that needs them (the quest marker, the debug panel). */
export const HOOKS_COLLECT = COLLECTING_HOURS;
