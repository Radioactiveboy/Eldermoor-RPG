/**
 * The lane at the south end of Adowvale: the militia garrison, the cells under
 * it, and the Headman's residence. First impressions and diary lines, and the
 * residence's door, barred for the night while the household is abed.
 */
import { GameAudio } from '../../audio/Audio';
import { raidIsOver } from '../../dialogue/afterRaid';
import { inHours } from '../../systems/VillageDay';
import { QuestLog } from '../../systems/Quests';
import type { AreaId } from '../../world/MapData';
import type { GameScene } from '../GameScene';

/** The hours the Headman's door opens to callers: from six in the morning till ten at night. */
export const RESIDENCE_HOURS: [number, number] = [6, 22];

/** The first time the hero arrives somewhere: a thought a moment later, and a line in the diary. */
function firstTime(g: GameScene, thought: string, diary: string): void {
  if (g.visited.has(g.area)) return;
  g.time.delayedCall(1000, () => g.onHint?.(thought));
  QuestLog.writeDiary(diary);
}

export function enteredGarrison(g: GameScene): void {
  if (raidIsOver()) {
    firstTime(
      g,
      'Spears racked by the fire, mud on every boot, and nobody has swept in days. The sergeant looks up, and his face changes when he sees who it is.',
      "Went into the militia's garrison at the far end of Adowvale, a squat stone blockhouse past the backs of the houses. Sergeant Brannock " +
        'keeps it, at a table covered in letters. Since the Hollow they sleep in their boots there.',
    );
  } else {
    firstTime(
      g,
      'Woodsmoke, wet wool and boot grease. Spears racked by the fire, and a sergeant at the far table who looks as if he has heard every excuse there is.',
      "Went into the militia's garrison at the far end of Adowvale: a squat stone blockhouse past the backs of the houses on the square, " +
        'all bunks and spears inside. Sergeant Brannock keeps it, and the cells under it.',
    );
  }
}

export function enteredJail(g: GameScene): void {
  firstTime(
    g,
    'Cold, and low, and it smells of old straw. Somebody in the middle cell is whistling.',
    'Went down to the cells under the garrison. Three of them, barred, with steps up to the guardroom at one end and to the hatch in the lane ' +
      'at the other. Hamm of the cooper\'s boys keeps the keys, and Wat the poacher keeps the middle cell.',
  );
}

export function enteredResidence(g: GameScene): void {
  firstTime(
    g,
    raidIsOver()
      ? 'Panelled walls, polished floors, portraits in gold frames. And candles burnt down to stubs on the Headman\'s desk. Nobody here has been sleeping either.'
      : 'Panelled walls, polished floors, portraits in gold frames. I wipe my boots twice before anyone tells me to. Someone tells me to anyway.',
    "Called at the Headman's house, next to the garrison: a tall house of honey-coloured stone behind a garden wall. Inside it is one great hall, " +
      'all oak panelling and portraits of Headmen past. Headman Osbert Hale keeps it, with his steward Aldwin, a maid and a cook.',
  );
}

/**
 * The Headman's front door is barred from ten at night till six in the
 * morning. Returns false, with the hero saying so, if it is now.
 */
export function residenceOpen(g: GameScene, to: AreaId): boolean {
  if (to !== 'residence' || inHours(RESIDENCE_HOURS[0], RESIDENCE_HOURS[1], g.clock.hour)) return true;
  GameAudio.rattle();
  g.onHint?.("The Headman's door is barred for the night. A single light burns upstairs. I'll call again in the morning.");
  return false;
}
