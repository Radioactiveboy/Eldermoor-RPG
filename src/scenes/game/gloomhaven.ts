/**
 * Gloomhaven (world/GloomhavenMap.ts), the walled marsh town downriver: arriving there, and its folk's
 * doings (their talk is in dialogue/gloomhaven.ts, and who they are in entities/Npc.ts). There's no way
 * there in play yet (the Grey Heron will carry the hero down from Adowvale Jetty one day; see
 * systems/Voyages.ts): the debug panel's teleport, or ?area=gloomhaven. Cray rows the hero back.
 */
import { GameAudio } from '../../audio/Audio';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import type { GameScene } from '../GameScene';
import type { DialogueAction } from './dialogueActions';
import { leaveThrough } from './travel';

/** What Cray asks to row the hero up the Wend to Adowvale Jetty, and how long it takes against the stream. */
export const CRAY_FARE = 10;
const CRAY_HOURS = 9;
/** The most Wisp lifts from the hero's purse. */
const WISP_TAKES = 3;

/** The first time in Gloomhaven: a thought on arriving, and a line in the diary. */
export function enteredGloomhaven(g: GameScene): void {
  if (g.visited.has('gloomhaven')) return;
  g.time.delayedCall(1200, () => g.onHint?.('Gloomhaven. It smells of rot and woodsmoke, and everyone on the Staithe has stopped to look at me.'));
  QuestLog.writeDiary(
    'Came to Gloomhaven, down the river. A town on a mudbank in the middle of the fen, black houses sinking into the marsh, ' +
      'a wall round three sides of it and the river on the fourth. In the square there is a well and a great black tavern called ' +
      'the Black Rose. Nobody here asks your name, and I am not sure I want to give it.',
  );
}

/** How many coins Wisp lifted from the hero (0 if she hasn't, or found nothing). */
export function wispPinched(): number {
  for (let n = WISP_TAKES; n > 0; n--) if (QuestLog.hasFlag(`wisp-took-${n}`)) return n;
  return 0;
}

export const GLOOM_ACTIONS: Record<string, DialogueAction> = {
  // Gutter Jack takes an ale off the hero, and tells what he's seen come up out of the Rose's cellar.
  'gutter-ale': (g) => {
    if (!Inventory.remove('ale', 1)) return;
    QuestLog.setFlag('gutter-told');
    QuestLog.writeDiary(
      'Gave Gutter Jack an ale. He says the Black Rose has a way down from its cellar to the river, under the Staithe, ' +
        'that the gate never sees: barrels come in by it, and some nights people with their hands tied.',
    );
    g.time.delayedCall(400, () => g.onHint?.('People with their hands tied. I should keep my eyes open in the Rose.'));
  },
  // Wisp's trick: while the hero watches her hands, a few coins go from their purse. They notice after.
  'wisp-pinch': (g) => {
    if (wispPinched() > 0) return;
    const n = Math.min(WISP_TAKES, Inventory.coins);
    if (n <= 0 || !Inventory.addCoins(-n)) return;
    QuestLog.setFlag(`wisp-took-${n}`);
    g.time.delayedCall(900, () => g.onHint?.(`Wait. My purse is lighter. ${n === 1 ? 'A coin is' : `${n} coins are`} gone. That little...`));
  },
  'wisp-return': () => {
    const n = wispPinched();
    if (!n || QuestLog.hasFlag('wisp-returned')) return;
    QuestLog.setFlag('wisp-returned');
    Inventory.addCoins(n);
    GameAudio.coins();
  },
  // Cray rows the hero up the Wend, landing them at the end of Adowvale's pier.
  'row:jetty': (g) => {
    if (!Inventory.addCoins(-CRAY_FARE)) return;
    GameAudio.coins();
    QuestLog.writeDiary(`Paid Cray ${CRAY_FARE} coins to row me up the Wend from Gloomhaven to Adowvale Jetty. He did not speak once the whole way, and I did not look over the side.`);
    g.time.delayedCall(600, () =>
      leaveThrough(g, { tx: g.player.tileX, ty: g.player.tileY, to: 'jetty', entry: 'gloomhaven', auto: true, travelHours: CRAY_HOURS }),
    );
  },
};
