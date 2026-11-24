/**
 * Down the hole in the hill on the Greyfells, after Mother: arriving in the
 * goblins' warren (world/WarrenMap.ts) and the brood hall below it
 * (world/BroodHallMap.ts), the way in, coming round on the fell after a
 * beating down there, carrying her out, and the burial in the Hollow, which is
 * the end of Ashes. Kept apart from broodhall.ts (the fights and what Mother
 * and the orb say) so the area registry can use it without pulling that in.
 */
import Phaser from 'phaser';
import { COMPANIONS, Companions } from '../../systems/Companions';
import { QuestLog } from '../../systems/Quests';
import { MOTHER_PALLET } from '../../world/landmarks';
import { Door } from '../../world/MapData';
import { gridToScreen } from '../../iso/IsoMath';
import type { GameScene, GameSceneData } from '../GameScene';

/**
 * Handy for testing the way down (with ?raid=after): ?warren=open has the night at the gate over (held, or
 * fallen with ?gate=fell as well), ?warren=carrying has Mother dead and the hero carrying her out, and
 * ?warren=burial with ?area=world starts the burial in the Hollow.
 * Add ?area=warren or ?area=broodhall to start down there.
 */
export function warrenTestStart(): void {
  const which = new URLSearchParams(window.location.search).get('warren');
  if (!which) return;
  QuestLog.start('the-gate');
  QuestLog.complete('the-gate', 'warn');
  QuestLog.complete('the-gate', 'hold');
  if (which === 'carrying' || which === 'burial') for (const flag of ['mother-dead', 'carrying-mother']) QuestLog.setFlag(flag);
  if (which === 'burial') QuestLog.setFlag('mother-buried');
}

/** The way into the hole opens once the night the goblins came for Adowvale is over, one way or the other. */
export function warrenOpen(): boolean {
  return QuestLog.isDone('the-gate', 'hold');
}

/** The hole in the hill on the Greyfells, before the night they come for Adowvale: not yet. */
export function warrenDoorAllowed(g: GameScene, door: Door): boolean {
  if (door.id !== 'warren' || warrenOpen()) return true;
  g.onHint?.(
    QuestLog.has('the-gate')
      ? 'I can hear them down there, dozens of them, and they know someone was at their camp. If they go for Adowvale, I have to be there to meet them, not down a hole.'
      : 'Warm air breathes out of the dark, and I can hear them, far down. With their camp still keeping watch at my back? Not yet.',
  );
  return false;
}

/** Who is in the pen, for the map: Hilde if they took her from Adowvale, else Coombe; nobody once they've been let out. */
export function penPrisoner(): 'hilde' | 'coombe' | undefined {
  if (QuestLog.hasFlag('pen-freed')) return undefined;
  return QuestLog.hasFlag('hilde-taken') ? 'hilde' : 'coombe';
}

/** Mother is gone, and the hero is carrying her out. */
export function carryingMother(): boolean {
  return QuestLog.hasFlag('carrying-mother');
}

/** Into the upper tunnels: the first time, a thought and a diary line; on the way back out with Mother, the warren is awake. */
export function enteredWarren(g: GameScene): void {
  for (const step of ['fells', 'camp', 'warren', 'descend']) QuestLog.complete('the-raid', step);
  if (carryingMother()) {
    if (QuestLog.hasFlag('warren-roused-seen')) return;
    QuestLog.setFlag('warren-roused-seen');
    g.time.delayedCall(900, () => g.onHint?.('Horns, everywhere, and feet. They are all awake now, every one of them, and they know which way I have to go.'));
    return;
  }
  if (g.visited.has('warren')) return;
  g.time.delayedCall(1000, () =>
    g.onHint?.('Dark, and warm, and the stink of them. Voices further in. If I keep low and quiet I might get a long way before anything sees me.'),
  );
  QuestLog.writeDiary(
    "Went down the hole in the hill. It opens into tunnels, the goblins' own, lit by their fires: they live down here, dozens of them, " +
      'and they do not keep much of a watch. Mother is somewhere further down. I can smell the medicine on the air.',
  );
}

/** Coming in sight of the pen in the warren: someone is in it. */
export function sawPen(): void {
  const who = penPrisoner();
  if (!who || QuestLog.has('the-pen')) return;
  QuestLog.start('the-pen');
}

/** Down in the brood hall: the first time, the heat and the Brute; and with Mother gone, the silence after. */
export function enteredBroodHall(g: GameScene): void {
  QuestLog.complete('the-raid', 'tunnels');
  // Come back to after Mother died but before the fight over her was done (a save from then): she is in the hero's arms.
  if (QuestLog.hasFlag('mother-dead')) QuestLog.setFlag('carrying-mother');
  // Mother lies drawn on her furs: she is spoken to there.
  const mother = g.someone('mother-dying');
  if (mother) {
    const p = gridToScreen(MOTHER_PALLET.tx + 1, MOTHER_PALLET.ty + 0.5);
    mother.tuck({ x: p.x, y: p.y - 24 });
  }
  if (g.visited.has('broodhall')) return;
  g.time.delayedCall(1000, () =>
    g.onHint?.('Hot as a bread oven, and the stink. Something huge gets up off a heap of bones by the way on: horned helm, club. The Brute, from the Hollow.'),
  );
  QuestLog.writeDiary(
    'Went down to the bottom of their tunnels, into the heat. The Brute who led them on the Hollow was waiting at the only way on, ' +
      'with his club. Beyond him I could hear something breathing, slow and enormous, and somebody coughing. Mother.',
  );
}

/** Who got the hero out of the warren after a beating ('nobody' if they crawled out themselves). */
let cameRound: string | undefined;

/** Beaten down there: someone, or nobody, got the hero out onto the fell (see broodhall.ts). */
export function draggedOut(by: string): void {
  cameRound = by;
}

/** Back up on the fell from the warren: after a beating, coming round; with Mother, the way home, and the burial. */
export function outOfWarren(g: GameScene): void {
  const by = cameRound;
  cameRound = undefined;
  if (by) {
    g.time.delayedCall(1200, () =>
      g.onHint?.(
        by === 'nobody'
          ? 'Heather under my face, and daylight. I must have crawled out. I do not remember it. Everything hurts.'
          : `Heather under my face, and daylight. ${by} dragged me out of there. Everything hurts.`,
      ),
    );
  }
  if (!carryingMother() || QuestLog.isDone('the-raid', 'out')) return;
  QuestLog.complete('the-raid', 'out');
  g.busy = true;
  g.time.delayedCall(by ? 5200 : 900, () => g.onHint?.('Out. Daylight, and the wind, and Mother in my arms. The long way home now.'));
  g.time.delayedCall(by ? 9500 : 5200, () => {
    g.cameras.main.fadeOut(2200, 0, 0, 0);
    g.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // Down off the fell, through the north woods, and home: it takes the rest of the day.
      g.clock.advance(g.clock.hoursUntil(18));
      QuestLog.setFlag('mother-buried');
      g.scene.restart({ area: 'world', entry: 'grave' } satisfies GameSceneData);
    });
  });
}

/** Home in the Hollow with Mother, the evening the hero carries her out: they bury her beside the cottage, and Ashes is over. */
export function buryingMother(g: GameScene): void {
  if (!QuestLog.hasFlag('mother-buried') || QuestLog.isDone('the-raid', 'bury')) return;
  QuestLog.clearFlag('carrying-mother');
  g.busy = true;
  const carrier = Companions.fighters[0];
  const lines = [
    'We buried her in the hollow beside the cottage, under the hawthorn, where the bluebells come up in spring. As she asked.',
    carrier ? `${COMPANIONS[carrier].short} dug beside me without a word, and stood back when it was done.` : 'I dug it myself. It took until the light went.',
    'Stones from the old wall for a cairn, and Father\'s name cut into the marker beside hers. Aldo. Wherever he is.',
  ];
  lines.forEach((line, i) => g.time.delayedCall(1400 + i * 5200, () => g.onHint?.(line)));
  g.time.delayedCall(1400 + lines.length * 5200, () => {
    QuestLog.complete('the-raid', 'bury');
    QuestLog.writeDiary(
      'Buried Mother in the hollow beside the cottage, as she asked, and put up a cairn. I have cut Father\'s name on the marker too, beside hers. ' +
        'Aldo, who kept the watch at the tower and went north after the goblins and never came back. Something out there gives them their orders, ' +
        'and it knows my face now. I have nothing left to keep me here but her grave. When I am ready, I will go and find out what he found.',
    );
    g.release();
  });
}
