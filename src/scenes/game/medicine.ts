/** Mother's medicine: the moonpetal, the willow bark, brewing the tincture and giving it to her. */
import { GameAudio } from '../../audio/Audio';
import { Recipe } from '../../systems/Crafting';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { MOONPETAL } from '../../world/landmarks';
import type { GameScene } from '../GameScene';
import type { DialogueAction } from './dialogueActions';
import { askToSleep } from './sleep';

/** Something brewed or cooked: Mother's tincture moves her errand on. */
export function madeAtStation(g: GameScene, recipe: Recipe): void {
  if (recipe.makes !== 'fever-tincture' || !QuestLog.has('mother-medicine') || QuestLog.isDone('mother-medicine', 'brew')) return;
  QuestLog.complete('mother-medicine', 'moonpetal');
  QuestLog.complete('mother-medicine', 'willow');
  QuestLog.complete('mother-medicine', 'brew');
  QuestLog.writeDiary(
    "Brewed Mother's tincture at old Maud's bench in the Tankard's cellar: ground the willow bark, steeped the moonpetal, and strained it " +
      'into a little flask. It glows, faintly, like the flowers did. Now home to Mother, as fast as my legs will carry me.',
  );
  g.time.delayedCall(400, () => g.onHint?.('It glows, just like the flowers. Now home to Mother, quickly!'));
}

/** Out of the cottage on Mother's errand, the first time: that step is done. */
export function leftHome(): void {
  if (!QuestLog.has('mother-medicine') || QuestLog.isDone('mother-medicine', 'leave')) return;
  QuestLog.complete('mother-medicine', 'leave');
  QuestLog.writeDiary(
    'Pulled the door to behind me, softly, so as not to wake her. The whole of Eldermoor out there, and somewhere in it, ' +
      "moonpetal. Hilde's stall at the market will know, or the inn. Somebody always knows.",
  );
}

/** Mother takes her tincture: the end of her errand. */
export function gaveMotherTincture(g: GameScene): void {
  if (!Inventory.remove('fever-tincture', 1)) return;
  for (const step of ['leave', 'find', 'moonpetal', 'willow', 'brew', 'return']) QuestLog.complete('mother-medicine', step);
  GameAudio.questChime();
  QuestLog.writeDiary(
    'Gave Mother the tincture, warm, by the fire. She made a face at the taste and said it was just as foul as her own mother\'s, ' +
      'which she says is how you know it works. She was asleep before I had tucked her in, and not coughing once. Tomorrow we will see.',
  );
  // That's the day done: she goes to bed, and so must the hero.
  QuestLog.setFlag('raid-pending');
  g.afterTalk = () => g.time.delayedCall(250, () => askToSleep(g));
}

export function gatheredMoonpetal(g: GameScene): void {
  if (!MOONPETAL.every((m) => QuestLog.hasFlag(`gathered-${m.id}`))) return;
  QuestLog.complete('mother-medicine', 'moonpetal');
  const haveBark = QuestLog.isDone('mother-medicine', 'willow');
  g.onHint?.(
    haveBark
      ? "Three blooms of moonpetal, wrapped in a dock leaf. With the willow bark, that is all of it. Now to brew it, at the old bench in Godric's cellar."
      : 'Three blooms of moonpetal, wrapped in a dock leaf. Now for the willow bark.',
  );
  QuestLog.writeDiary(
    haveBark
      ? "Gathered three blooms of moonpetal from the rim of the cloister pond. They glow a little, even in the satchel. With the willow bark I cut on the plains, I have all of Mother's tincture. " +
          "Brother Anselm says it wants brewing at a proper bench, and that Godric's grandmother's is still down in the Tankard's cellar."
      : "Gathered three blooms of moonpetal from the rim of the cloister pond. They glow a little, even in the satchel. That is half of Mother's " +
          'tincture. Now I need white willow bark. Brother Anselm says it grows by water.',
  );
}

export function gatheredWillowBark(g: GameScene): void {
  QuestLog.complete('mother-medicine', 'willow');
  const havePetal = QuestLog.isDone('mother-medicine', 'moonpetal');
  g.onHint?.(
    havePetal
      ? "Three long curls of white willow bark, bitter as sloes. With the moonpetal, that is all of it. Now to brew it, at the old bench in Godric's cellar."
      : 'Three long curls of white willow bark, bitter as sloes. Half of the tincture. Now for the moonpetal.',
  );
  QuestLog.writeDiary(
    'Found an old white willow up on the plains, past where the north road climbs into the upland, leaning out over a still pool. ' +
      'It must be older than the monastery. I cut three long strips of bark from the side away from the water, and begged its pardon. ' +
      (havePetal
        ? "With Brother Anselm's moonpetal, that is the whole of Mother's tincture. It only wants brewing now, at the old bench in the Tankard's cellar."
        : 'Now I need the moonpetal to go with it.'),
  );
}

/** What Mother's errand needs from conversations (see dialogue/mother.ts, abbey.ts, tavern.ts). */
export const MEDICINE_ACTIONS: Record<string, DialogueAction> = {
  'start-medicine-quest': () => {
    if (QuestLog.has('mother-medicine')) return;
    QuestLog.start('mother-medicine', ['talk']);
    QuestLog.writeDiary(
      "Mother's cough is worse. She tried to hide the fever from me, but her hands shake too much to hold a cup. " +
        'She needs moonpetal and willow bark tincture. I will find someone in the village who has it.',
    );
  },
  'anselm-moonpetal': () => {
    if (QuestLog.hasFlag('may-pick-moonpetal')) return;
    QuestLog.setFlag('may-pick-moonpetal');
    QuestLog.complete('mother-medicine', 'find');
    QuestLog.writeDiary(
      "Brother Anselm says Mother's tincture is moonpetal and white willow bark steeped together. His dried moonpetal is all gone, " +
        'but the fresh is flowering round the cloister pond and he has let me pick it. The willow bark I must find for myself.',
    );
  },
  'godric-brewing': () => {
    if (QuestLog.hasFlag('may-use-cellar')) return;
    QuestLog.setFlag('may-use-cellar');
    QuestLog.writeDiary(
      "Godric says his grandmother Maud brewed cordials and cures for half the shire, and her bench is still down in his cellar, " +
        'still and all. I may use it, if I can get past his rats. The trapdoor is by the end of the bar.',
    );
  },
  'give-tincture': (g) => {
    gaveMotherTincture(g);
  },
};
