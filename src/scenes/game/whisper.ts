/**
 * The night after the beacon: once the Headman has paid up, the hero is told
 * to get some sleep (a bed at the Crooked Tankard, on the village), and that
 * night, wherever they sleep, the orb wakes and carries two voices from the
 * other side (scenes/OrbWhisperScene.ts, dialogue/orbWhisper.ts). What they let
 * slip starts the road to Gloomhaven.
 */
import { GLOOMHAVEN_QUEST, WHISPER_HEARD, WHISPER_PENDING, WHISPER_WAKING_THOUGHTS } from '../../dialogue/orbWhisper';
import { WATCHER_QUEST, whisperPending } from '../../systems/OrbWhisper';
import { QuestLog } from '../../systems/Quests';
import { CHECKOUT_HOUR, Tavern } from '../../systems/Tavern';
import { TAVERN_BED } from '../../world/landmarks';
import type { Bed } from '../../world/MapData';
import type { ConfirmSceneData } from '../ConfirmScene';
import type { GameScene } from '../GameScene';
import type { OrbWhisperSceneData } from '../OrbWhisperScene';
import { sleep } from './sleep';
import { standUp } from './sitting';

/** The Tankard's bed, for being sent straight to it from elsewhere. */
const TANKARD_BED: Bed = { id: 'tavern-room', ...TAVERN_BED };

export { repairWhisper, whisperPending } from '../../systems/OrbWhisper';

/** The Headman has paid for the beacon: the whisper waits for the next sleep, and the hero is told to go and get some. */
export function beaconPaidOff(g: GameScene): void {
  if (QuestLog.hasFlag(WHISPER_PENDING)) return;
  QuestLog.setFlag(WHISPER_PENDING);
  g.afterTalk = () => g.time.delayedCall(700, () => askToRest(g));
}

/** "I'm dead on my feet": off to the Tankard to sleep, or not yet (and then any bed will do). */
export function askToRest(g: GameScene): void {
  if (!whisperPending()) return;
  if (!g.takeControls()) {
    g.time.delayedCall(400, () => askToRest(g));
    return;
  }
  if (g.seat) standUp(g);
  const data: ConfirmSceneData = {
    question: "I'm dead on my feet.",
    note: "Up the tor and back, and the brigands besides. The Headman says Godric has a bed for me at the Crooked Tankard tonight, on the village.",
    yes: 'Go to the Tankard and sleep till morning',
    no: 'Not yet',
    onAnswer: (yes) => {
      if (!yes) {
        g.release();
        g.time.delayedCall(300, () => g.onHint?.('Not yet. But soon: I can hardly keep my eyes open. Any bed will do.'));
        return;
      }
      // The room is the village's tonight, whatever the hero has paid for already.
      if (!Tavern.renting(g.clock.elapsedHours)) Tavern.rent(1, g.clock.elapsedHours, g.clock.hoursUntil(CHECKOUT_HOUR));
      sleep(g, TANKARD_BED, g.clock.hoursUntil(7), 'tavern-room');
    },
  };
  g.scene.launch('Confirm', data);
}

/** Asleep, with the screen gone black (from sleep.ts): the orb's whisper, then `then`. */
export function hearWhisper(g: GameScene, then: () => void): void {
  QuestLog.setFlag(WHISPER_HEARD);
  QuestLog.clearFlag(WHISPER_PENDING);
  const data: OrbWhisperSceneData = {
    onDone: () => {
      // Who spoke through the orb: the Astarix. The Watcher in the Glass is answered, and the road to Gloomhaven begins.
      QuestLog.complete(WATCHER_QUEST, 'hale');
      QuestLog.complete(WATCHER_QUEST, 'who');
      if (!QuestLog.has(GLOOMHAVEN_QUEST)) QuestLog.start(GLOOMHAVEN_QUEST);
      QuestLog.writeDiary(
        'The orb woke in the night, and I heard two voices in it, talking to each other. They never knew I was listening. One was the cold ' +
          'voice from the brood hall; the other called him Astarix, and spoke of Daejonguk. The orb is one of a pair of seeing stones, and he ' +
          'holds the other. Adowvale has cost him the Mother and her brood, and he has given us up, for now. "We must send them to ' +
          'Gloomhaven then, on the marshes." He means to buy it from the inside, guild by guild, and from there every road runs to some ' +
          'other door. Ours among them. I am going to Gloomhaven.',
      );
      then();
    },
  };
  g.scene.launch('OrbWhisper', data);
}

/** Waking after it (see GameScene's arrival). */
export function wokeAfterWhisper(g: GameScene): void {
  WHISPER_WAKING_THOUGHTS.forEach((line, i) => g.time.delayedCall(1200 + i * 5600, () => g.onHint?.(line)));
}
