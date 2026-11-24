/**
 * The fights and the words at the bottom of the goblins' warren (see warren.ts for
 * arriving): letting whoever is in the pen go, the Brute, Mother's last words,
 * what speaks out of the orb and the fight it starts, and being beaten down there.
 */
import Phaser from 'phaser';
import { GameAudio } from '../../audio/Audio';
import { orbScript } from '../../dialogue/warren';
import { Creature } from '../../entities/Creature';
import { COMPANIONS, Companions } from '../../systems/Companions';
import { QuestLog } from '../../systems/Quests';
import { ORB, SWARM, WARREN_MOUTH } from '../../world/landmarks';
import type { GameScene, GameSceneData } from '../GameScene';
import { startCombat } from './combat';
import type { DialogueAction } from './dialogueActions';
import { carryingMother, draggedOut, penPrisoner } from './warren';

/** Letting whoever is in the pen out (dialogue/warren.ts): off they creep, back up to the daylight. */
function freedPrisoner(g: GameScene): void {
  const who = penPrisoner();
  if (!who) return;
  QuestLog.setFlag('pen-freed');
  QuestLog.start('the-pen');
  QuestLog.complete('the-pen', 'free');
  QuestLog.writeDiary(
    who === 'hilde'
      ? 'Found Hilde in a pen of hurdles in the goblins\' tunnels, and cut her loose. She is going to her sister at the mill till her bakery is ' +
          'built again. She saw them carry Mother past, further down. Coughing, she said, badly. And they were gentle with her.'
      : "Found Coombe the shepherd in a pen in the goblins' tunnels, where they keep him for the pot, and cut him loose. He has gone home over " +
          'the fell. He saw them carry Mother past, further down, on a litter. She told him to have courage.',
  );
  g.afterTalk = () => {
    const npc = g.npcs.find((n) => n.id === (who === 'hilde' ? 'hilde-captive' : 'coombe'));
    if (!npc) return;
    npc.leave({ x: WARREN_MOUTH.x + 0.4, y: WARREN_MOUTH.y }, () => {
      g.npcs = g.npcs.filter((n) => n !== npc);
    });
  };
}

/** After a fight in the brood hall: the Brute down, or the ones the orb set on the hero. */
export function checkBroodHall(g: GameScene, slain: string[]): void {
  if (g.area !== 'broodhall') return;
  if (slain.includes('bh-brute') && !QuestLog.isDone('the-raid', 'brute')) {
    QuestLog.complete('the-raid', 'brute');
    g.time.delayedCall(2200, () => g.onHint?.('The way is open. And that cough, somewhere on the other side. Mother!'));
    QuestLog.writeDiary("Fought the Brute at the door of the brood hall, and put him down at last. The one who burnt our cottage. It doesn't feel like anything.");
  }
  if (QuestLog.hasFlag('mother-dead') && !carryingMother() && SWARM.every((s) => g.defeatedFoes.has(s.id))) liftMother(g);
}

/** Mother's last words (dialogue/warren.ts): she dies in the hero's arms, and something in the orb has been watching. */
function motherDied(g: GameScene): void {
  if (QuestLog.hasFlag('mother-dead')) return;
  QuestLog.setFlag('mother-dead');
  QuestLog.complete('the-raid', 'brute');
  QuestLog.complete('the-raid', 'mother');
  QuestLog.writeDiary(
    "I found her. On a heap of furs, at the bottom of their warren, beside the great swollen thing they brought her to heal. She knew me. " +
      'She told me about Father: his name was Aldo, and he kept the watch at the old tower, and he went north after the goblins the winter ' +
      'I was born and never came back. She never knew what became of him. Then she asked me to hold her, and I did, and she died.',
  );
  g.afterTalk = () =>
    g.time.delayedCall(150, () => {
      g.busy = true;
      // Nobody to talk to on the furs now.
      const mother = g.someone('mother-dying');
      if (mother) {
        mother.destroy();
        g.npcs = g.npcs.filter((n) => n !== mother);
      }
      GameAudio.stopMusic();
      g.onHint?.('She is gone.');
      g.time.delayedCall(4200, () => orbWakes(g));
    });
}

/** The orb flares, and someone far away speaks out of it. */
function orbWakes(g: GameScene): void {
  GameAudio.thunder(0, 1, 0.6);
  g.cameras.main.flash(500, 120, 60, 200);
  g.cameras.main.shake(400, 0.003);
  const shaman = g.someone('shaman');
  shaman?.say('Hssss! It comes! It speaks!', 3);
  g.time.delayedCall(1400, () => {
    g.busy = false;
    g.startScript(orbScript(Companions.fighters.length === 0));
  });
}

/** What the orb said: the shaman shrieks it on, and the goblins come pouring out of their holes. */
function orbSpoke(g: GameScene): void {
  g.afterTalk = () =>
    g.time.delayedCall(150, () => {
      g.busy = true;
      const shaman = g.someone('shaman');
      if (shaman) {
        shaman.say('KILL! KILL THEM!', 3);
        shaman.leave({ x: 24.5, y: 23.5 }, () => (g.npcs = g.npcs.filter((n) => n !== shaman)));
      }
      GameAudio.warHorn();
      GameAudio.shriek(true);
      const band = SWARM.filter((s) => !g.defeatedFoes.has(s.id)).map((s) => {
        (g.map.data.creatures ??= []).push(s);
        const c = new Creature(g, g.map, s.id, s.kind, s.gx, s.gy, s.notice);
        g.creatures.push(c);
        return c;
      });
      g.time.delayedCall(1800, () => {
        g.busy = false;
        if (band.length > 0) startCombat(g, band[0], undefined, band);
        else liftMother(g);
      });
    });
}

/** The last of them down: the orb has gone dark, and the hero lifts Mother up to carry her home. */
function liftMother(g: GameScene): void {
  QuestLog.setFlag('carrying-mother');
  const pallet = g.map.data.objects?.find((o) => o.key === 'bh-pallet-mother');
  if (pallet) g.map.setObjectArt(pallet, 'bh-pallet');
  const orb = g.map.data.objects?.find((o) => o.key === 'bh-orb' && o.tx === ORB.tx && o.ty === ORB.ty);
  if (orb) g.map.setObjectArt(orb, 'bh-orb-dark');
  const carrier = Companions.fighters[0];
  g.time.delayedCall(2000, () => g.onHint?.('The orb has gone dark. I lift her up. She weighs nothing at all. I am taking her home.'));
  if (carrier) g.time.delayedCall(6500, () => g.onHint?.(`${COMPANIONS[carrier].short} goes ahead with a torch. Up, then. Through all of them.`));
  QuestLog.writeDiary(
    'The thing in the glass spoke when she died. A voice, cold, from very far away: it called her a failure and told them to kill me, and then ' +
      'go up and finish Adowvale. They came out of their holes and we fought them over her body. The orb is dark now. Whoever it was, they ' +
      'saw my face. I am carrying her home.',
  );
}

/** Beaten down here: dragged out, or crawled out, and come round in the heather by the hole. With Mother, if they were carrying her. */
export function beatenUnderground(g: GameScene): boolean {
  if (g.area !== 'warren' && g.area !== 'broodhall') return false;
  if (QuestLog.hasFlag('mother-dead')) QuestLog.setFlag('carrying-mother');
  const carrier = Companions.fighters[0];
  draggedOut(carrier ? COMPANIONS[carrier].short : 'nobody');
  g.stats.heal(g.stats.maxHealth * 0.35);
  g.stats.restoreStamina(g.stats.maxStamina);
  g.cameras.main.fadeOut(1200, 0, 0, 0);
  g.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => g.scene.restart({ area: 'greyfells', entry: 'warren' } satisfies GameSceneData));
  return true;
}

/** The story's dialogue actions down the hole. */
export const WARREN_ACTIONS: Record<string, DialogueAction> = {
  'freed-prisoner': freedPrisoner,
  'mother-died': motherDied,
  'orb-spoke': orbSpoke,
};
