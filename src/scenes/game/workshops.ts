/**
 * Osric's smithy and Hilde's bakery, off Adowvale's square: going in (and
 * finding them shut at night), first impressions, and the life of the room
 * while its keeper is at work: sparks off the anvil as the hammer lands, a
 * puff of flour from the trough.
 */
import Phaser from 'phaser';
import { GameAudio } from '../../audio/Audio';
import { depthAt, gridToScreen } from '../../iso/IsoMath';
import { QuestLog } from '../../systems/Quests';
import { Villager, whereabouts } from '../../systems/VillageDay';
import { AreaId } from '../../world/MapData';
import { ANVIL, HAMMER_LANDS, TROUGH } from '../../world/landmarks';
import type { GameScene } from '../GameScene';

type Workshop = Extract<AreaId, 'smithy' | 'bakery'>;

/** Who keeps each workshop, and what the hero makes of it. */
const WORKSHOPS: Record<Workshop, { keeper: Villager; busy: string; empty: string; diary: string; locked: string }> = {
  smithy: {
    keeper: 'smith',
    busy: 'Heat like a slap in the face, and the ring of the hammer. Osric does not look up.',
    empty: 'The forge is banked down to a red glow. Osric must be out at his stall.',
    diary:
      "Went into Osric's smithy, off the market square. The heat of the forge, the reek of hot iron and coal smoke, and tools " +
      'hung on every wall. There is a slate of the jobs he owes, and spearheads for the militia are at the top of it.',
    locked: "The smithy door is barred. Osric will have gone up to bed; he's at the forge again before it's light.",
  },
  bakery: {
    keeper: 'baker',
    busy: 'Warm as a summer noon, and the smell of fresh bread is enough to make me dizzy.',
    empty: 'The oven ticks as it cools, and the racks are full. Hilde must be out at her stall.',
    diary:
      "Went into Hilde's bakery, by the corner of the square. A great domed oven, racks of loaves cooling to the ceiling, and " +
      'flour on everything, Hilde included. I came out with my mouth watering.',
    locked: "Locked. Hilde will be asleep upstairs; bakers' hours start in the dark.",
  },
};

function isWorkshop(area: AreaId): area is Workshop {
  return area === 'smithy' || area === 'bakery';
}

/**
 * The workshop doors on the square are barred while their keeper is home in
 * bed (see systems/VillageDay.ts). Returns false, with the hero saying so, if
 * this one is.
 */
export function workshopOpen(g: GameScene, to: AreaId): boolean {
  if (!isWorkshop(to)) return true;
  const w = WORKSHOPS[to];
  if (whereabouts(w.keeper, g.clock.hour) !== 'home') return true;
  GameAudio.rattle();
  g.onHint?.(w.locked);
  return false;
}

/** Into the smithy or the bakery: what the hero notices, the first time, and the room coming to life. */
export function enteredWorkshop(g: GameScene): void {
  if (!isWorkshop(g.area)) return;
  const w = WORKSHOPS[g.area];
  const here = whereabouts(w.keeper, g.clock.hour) === 'workshop';
  if (!g.visited.has(g.area)) {
    g.time.delayedCall(1000, () => g.onHint?.(here ? w.busy : w.empty));
    QuestLog.writeDiary(w.diary);
  } else if (!here) {
    g.time.delayedCall(900, () => g.onHint?.(w.empty));
  }
  if (g.area === 'smithy') sparksOffTheAnvil(g);
  else flourFromTheTrough(g);
}

/** Each time Osric's hammer comes down on the anvil, a spray of sparks off the glowing bar. */
function sparksOffTheAnvil(g: GameScene): void {
  const smith = g.npcs.find((n) => n.id === 'smith');
  if (!smith) return;
  const onFrame = (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
    if (!anim.key.startsWith('folk-smith-work-') || frame.index - 1 !== HAMMER_LANDS) return;
    // Where the bar lies on the anvil's face: a little in front of the smith's hands.
    const p = gridToScreen(ANVIL.x, ANVIL.y);
    burst(g, p.x - 1, p.y - 18, depthAt(ANVIL.x + 0.6, ANVIL.y + 0.6), [0xffd25a, 0xff7a3a, 0xfff2c0], 7, 'up');
  };
  smith.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame);
  g.events.once(Phaser.Scenes.Events.SHUTDOWN, () => smith.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, onFrame));
}

/** Now and then, while Hilde kneads, a puff of flour rises off the trough. */
function flourFromTheTrough(g: GameScene): void {
  const baker = g.npcs.find((n) => n.id === 'baker');
  if (!baker) return;
  g.time.addEvent({
    delay: 1300,
    loop: true,
    callback: () => {
      if (!baker.present || !baker.sprite.anims.currentAnim?.key.startsWith('folk-baker-work-') || Math.random() < 0.4) return;
      const x = TROUGH.x - 0.6 + Math.random() * 1.2;
      const p = gridToScreen(x, TROUGH.y);
      burst(g, p.x, p.y - 30, depthAt(TROUGH.x + 1, TROUGH.y + 1), [0xffffff, 0xf4ecdc, 0xe8e0d0], 5, 'drift');
    },
  });
}

/** A few specks thrown off a point: sparks leaping and falling, or flour drifting up and fading. */
function burst(g: GameScene, x: number, y: number, depth: number, colors: number[], n: number, how: 'up' | 'drift'): void {
  for (let i = 0; i < n; i++) {
    const speck = g.add.rectangle(x, y, 1.5, 1.5, colors[i % colors.length]).setDepth(depth);
    const spread = (Math.random() - 0.5) * (how === 'up' ? 34 : 16);
    g.tweens.add({
      targets: speck,
      x: x + spread,
      y: how === 'up' ? y - 6 - Math.random() * 12 : y - 8 - Math.random() * 10,
      alpha: 0,
      duration: how === 'up' ? 260 + Math.random() * 200 : 900 + Math.random() * 600,
      ease: how === 'up' ? 'Quad.easeOut' : 'Sine.easeOut',
      onComplete: () => speck.destroy(),
    });
  }
}
