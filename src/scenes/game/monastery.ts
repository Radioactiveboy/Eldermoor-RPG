/** The road to Saint Elda's: Lord Morten's toll gate, the Wolf Mother, and the monastery gate. */
import { GameAudio } from '../../audio/Audio';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { TOLL, tollGateShape } from '../../world/MarketMap';
import { monasteryGateDoors, monasteryGateShape } from '../../world/landmarks';
import type { GameScene } from '../GameScene';
import type { DialogueAction } from './dialogueActions';
import { give } from './sights';

/** Into the Wolf Mother's den: Brother Wystan's errand moves on, and the first time the hero takes it in. */
export function enteredDen(g: GameScene): void {
  QuestLog.complete('wolf-mother', 'den');
  if (g.visited.has('den')) return;
  g.time.delayedCall(1000, () => g.onHint?.('This is no hill-hole like the cave at home. It goes on and on, and the whole place reeks of wolf.'));
  QuestLog.writeDiary(
    "Found the old den on the plains, in a knoll of grey rock up a track the wolves have trodden. It is far bigger than the " +
      'cave at home, chamber after chamber, and full of bones. Somewhere in here is the Wolf Mother.',
  );
}

/**
 * The Wolf Mother is dead: Brother Wystan's errand moves on (even if he
 * never asked; he'll hear of it when the hero next speaks to him).
 */
export function slewWolfMother(): void {
  QuestLog.setFlag('slew-wolf-mother');
  QuestLog.complete('wolf-mother', 'den');
  QuestLog.complete('wolf-mother', 'slay');
  QuestLog.writeDiary(
    QuestLog.has('wolf-mother')
      ? 'Killed the Wolf Mother in her lair, on a bed of bones under a crack in the roof. She was as big as a pony and as white as frost, ' +
          'and she nearly had me. I took her hide. Brother Wystan should hear that the road is safe.'
      : 'Killed a great white she-wolf in an old den out on the plains, on a bed of bones. I have never seen a wolf so big. I took her hide; ' +
          'there cannot be another like it.',
  );
}

/**
 * Brother Wystan keeps his word: the Wolf Mother's errand is done, the gate
 * swings open as the conversation ends, and it stays open from then on (the
 * flag is saved, and the monastery is built with it open).
 */
export function openMonasteryGate(g: GameScene): void {
  if (QuestLog.hasFlag('monastery-open')) return;
  QuestLog.start('wolf-mother', ['talk', 'den', 'slay']);
  QuestLog.complete('wolf-mother', 'return');
  QuestLog.setFlag('monastery-open');
  QuestLog.writeDiary(
    'Told Brother Wystan the Wolf Mother is dead. The old man went quite pale, and then he took a key from his belt and opened ' +
      "the gate of Saint Elda for me with his own hands. It is open to me now, he says, now and always.",
  );
  g.afterTalk = () => {
    const gate = g.map.data.objects?.find((o) => o.key === 'mon-gate');
    if (!gate) return;
    const open = monasteryGateShape(true);
    GameAudio.door();
    g.map.reshapeObject(gate, 'mon-gate-open', open.shapes, open.blocks);
    g.map.data.doors!.push(...monasteryGateDoors());
    g.map.data.musings = [];
    g.time.delayedCall(200, () => g.onHint?.('The great doors swing back. Beyond them, a sunny court, a well, and a cloister. I can go in.'));
  };
}

/**
 * Paying Lord Morten's tithe at the toll gate: the coins go, the gate swings
 * open as the conversation ends, and it stays open from then on (the flag
 * is saved with the quest log, and Adowvale is built with the gate open).
 */
export function payToll(g: GameScene): void {
  if (QuestLog.hasFlag('paid-toll')) return;
  if (!Inventory.addCoins(-TOLL)) {
    g.onHint?.("I'm short of the toll. I'll need more coins than that.");
    return;
  }
  QuestLog.setFlag('paid-toll');
  GameAudio.coins();
  QuestLog.writeDiary(
    `Paid Lord Morten's toll guards ${TOLL} coins to use the gate north of Adowvale. A tithe, they called it. ` +
      "Robbery, Mother would call it. Still, the gate is open to me now, and the Lord's Road beyond.",
  );
  g.afterTalk = () => {
    const gate = g.map.data.objects?.find((o) => o.key === 'toll-gate');
    if (!gate) return;
    const open = tollGateShape(true);
    GameAudio.door();
    g.map.reshapeObject(gate, 'toll-gate-open', open.shapes, open.blocks);
    g.time.delayedCall(200, () => g.onHint?.('The guards heave the gate open. Beyond it, the road runs out into open country.'));
  };
}

/** What the toll gate, Brother Wystan and the brothers need from conversations (see dialogue/plains.ts, monastery.ts, abbey.ts). */
export const MONASTERY_ACTIONS: Record<string, DialogueAction> = {
  'pay-toll': (g) => {
    payToll(g);
  },
  'heard-of-monastery': () => {
    if (QuestLog.hasFlag('heard-of-monastery')) return;
    QuestLog.setFlag('heard-of-monastery');
    QuestLog.writeDiary(
      "Met a traveller on the Lord's Road who says the monks of Saint Elda grow moonpetal in their cloister pond, a day's " +
        'walk east of the crossroads. Brother Anselm keeps it dried. If anyone can help Mother, it is them.',
    );
  },
  'start-wolf-quest': () => {
    if (QuestLog.has('wolf-mother')) return;
    QuestLog.start('wolf-mother', ['talk']);
    QuestLog.writeDiary(
      "Brother Wystan will not open the gate: the Prior has barred it while wolves harry the brothers on the Lord's Road. " +
        'They are led by a great white she-wolf, the Wolf Mother, from an old den north of the road. I said I would put an end to her.',
    );
  },
  'finish-wolf-quest': (g) => {
    openMonasteryGate(g);
  },
  'hob-bread': (g) => {
    if (QuestLog.hasFlag('fed-by-hob')) return;
    QuestLog.setFlag('fed-by-hob');
    give(g, 'bread', 1);
  },
};
