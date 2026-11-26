/**
 * Whether the orb's whisper is waiting for the hero's next sleep, and putting older saves right
 * about it (the scene side is scenes/game/whisper.ts). Kept free of Phaser for the tests.
 */
import { WHISPER_HEARD, WHISPER_PENDING } from '../dialogue/orbWhisper';
import { BEACON_QUEST } from './Beacon';
import { QuestLog } from './Quests';

/** The main quest the whisper answers (started in warren.ts as Mother dies). */
export const WATCHER_QUEST = 'the-watcher';

/** The next sleep carries the orb's whisper. */
export const whisperPending = (): boolean => QuestLog.hasFlag(WHISPER_PENDING) && !QuestLog.hasFlag(WHISPER_HEARD);

/**
 * Puts older saves right on loading (see sleep.ts's loadSave): a beacon reported before the whisper
 * existed never set it waiting, so the orb would stay dark for good; and The Watcher in the Glass
 * gained its first step (asking the Headman) after some heroes were already past it.
 */
export function repairWhisper(): void {
  const beacon = QuestLog.get(BEACON_QUEST);
  if (beacon?.completed && !QuestLog.hasFlag(WHISPER_HEARD)) QuestLog.setFlag(WHISPER_PENDING);
  // Quietly, as the save is put back: no toasts or experience for steps already behind the hero.
  const watcher = QuestLog.get(WATCHER_QUEST);
  if (!watcher) return;
  if (beacon) watcher.done.add('hale');
  if (QuestLog.hasFlag(WHISPER_HEARD)) {
    watcher.done.add('who');
    watcher.done.add('hale');
  }
  watcher.completed = watcher.def.objectives.every((o) => watcher.done.has(o.id));
}
