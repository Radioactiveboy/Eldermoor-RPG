/**
 * GameScene's side of the goblin raid (the raid itself is world/GoblinRaid.ts):
 * handing it the scene, the beating, coming round in the ruins, and the ?raid= switch.
 */
import Phaser from 'phaser';
import { GameAudio } from '../../audio/Audio';
import { Creature } from '../../entities/Creature';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { SAVE_VERSION, SaveData, SaveGame } from '../../systems/SaveGame';
import { TimeOfDay } from '../../systems/TimeOfDay';
import { Aftermath } from '../../world/Aftermath';
import { RAID_BLACKOUT, RaidDirector } from '../../world/GoblinRaid';
import type { ConfirmSceneData } from '../ConfirmScene';
import type { GameScene, GameSceneData } from '../GameScene';
import type { InterludeSceneData } from '../InterludeScene';
import { startCombat } from './combat';
import type { DialogueAction } from './dialogueActions';
import { pathTo } from './input';

/**
 * Handy for testing the goblin raid: ?raid=night starts with the tincture in
 * the satchel and Mother's errand otherwise done; ?raid=morning wakes on the
 * morning of the raid; ?raid=after comes round in the ruins.
 */
export function raidTestStart(clock: TimeOfDay): void {
  // (Called for every new game: the raid hasn't happened yet.)
  Aftermath.raidAt = undefined;
  const params = new URLSearchParams(window.location.search);
  const which = params.get('raid');
  if (!which) return;
  // (An ?hour=, if given, wins.)
  const setHour = (hour: number) => !params.has('hour') && clock.setHour(hour);
  QuestLog.start('mother-medicine', ['talk', 'leave', 'find', 'moonpetal', 'willow', 'brew']);
  if (which === 'night') {
    Inventory.add('fever-tincture', 1);
    setHour(20);
    return;
  }
  QuestLog.complete('mother-medicine', 'return');
  if (which === 'morning') {
    QuestLog.setFlag('raid-morning');
    setHour(6.2);
  } else if (which === 'after') {
    QuestLog.setFlag('raid-over');
    QuestLog.start('the-raid');
    setHour(13);
    // The raid was at dawn today.
    Aftermath.raidAt = Math.min(clock.elapsedHours, Math.floor(clock.elapsedHours / 24) * 24 + 6.2);
  }
}

/** The raid's hold on this scene: its goblins, its fights, and running back indoors. */
export function startRaid(g: GameScene): RaidDirector {
  return new RaidDirector({
    scene: g,
    map: g.map,
    player: () => ({ x: g.player.gx, y: g.player.gy }),
    follow: () => g.fitCamera(),
    hint: (text) => g.onHint?.(text),
    hold: () => g.takeControls(),
    release: () => g.release(),
    addCreature: (id, kind, gx, gy) => {
      const creature = new Creature(g, g.map, id, kind, gx, gy);
      g.creatures.push(creature);
      return creature;
    },
    fight: (foes) => {
      g.busy = false;
      startCombat(g, foes[0], foes);
    },
    ask: (question, note, yes, no, onAnswer) => {
      const data: ConfirmSceneData = { question, note, yes, no, onAnswer };
      g.scene.launch('Confirm', data);
    },
    retreat: () => {
      g.busy = true;
      g.player.setPath([]);
      GameAudio.door();
      g.cameras.main.fadeOut(350, 0, 0, 0);
      g.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        g.scene.restart({ area: 'home', entry: 'door', raidRetreat: true } satisfies GameSceneData);
      });
    },
    mother: () => g.someone('mother'),
    backAway: (to) => {
      const path = pathTo(g, { x: Math.floor(to.x), y: Math.floor(to.y) });
      if (path) g.player.setPath(path);
    },
  });
}

/**
 * Beaten by the goblins: a few moments half remembered in the dark, then
 * coming round hours later in the ruins of the cottage. The game is saved
 * there (in the scorched straw bed), so there's no going back.
 */
export function raidDefeat(g: GameScene): void {
  g.busy = true;
  GameAudio.stopMusic();
  g.cameras.main.fadeOut(1600, 0, 0, 0);
  g.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    const data: InterludeSceneData = {
      lines: RAID_BLACKOUT,
      onDone: () => {
        QuestLog.clearFlag('raid-morning');
        QuestLog.clearFlag('raid-pending');
        QuestLog.setFlag('raid-over');
        QuestLog.start('the-raid');
        Aftermath.raidAt = g.clock.elapsedHours;
        g.clock.advance(g.clock.hoursUntil(13));
        g.stats.health = Math.max(1, Math.round(g.stats.maxHealth * 0.3));
        g.stats.restoreStamina(g.stats.maxStamina * 0.4);
        const save: SaveData = {
          version: SAVE_VERSION,
          savedAt: Date.now(),
          savePoint: 'home-bed',
          area: 'home',
          position: { x: 3.4, y: 2.2 },
          hours: g.clock.elapsedHours,
          health: g.stats.health,
          stamina: g.stats.stamina,
          sections: SaveGame.collect(),
        };
        SaveGame.write(save);
        g.scene.restart({ load: save, raidAftermath: true } satisfies GameSceneData);
      },
    };
    g.scene.launch('Interlude', data);
  });
}

/** Coming round on the floor of the burnt-out cottage. */
export function cameAround(g: GameScene): void {
  const say = (ms: number, text: string) => g.time.delayedCall(ms, () => g.onHint?.(text));
  say(1400, 'My head... Everything hurts. How long was I lying here?');
  say(6000, 'Mother? MOTHER!');
  say(10500, "She's gone. The roof's gone. And there's blood... all over the floor by her bed.");
  QuestLog.writeDiary(
    'Goblins. A whole band of them came down on the farm at first light, burning and smashing and screaming, with a great brute in iron ' +
      'at their head. I went out to fight them and they beat me to the ground. When I came to it was past midday. The cottage is burnt ' +
      'to its rafters and everything in it is broken or gone. There is blood by her bed. Mother is gone.',
  );
}

/** Walking about after the raid: the cottage, the yard, Iran's hut. */
export function enteredAfterRaid(g: GameScene): void {
  if (g.area === 'world') {
    QuestLog.complete('the-raid', 'search');
    QuestLog.complete('the-raid', 'outside');
    if (!QuestLog.hasFlag('saw-ruined-yard')) {
      QuestLog.setFlag('saw-ruined-yard');
      g.time.delayedCall(900, () => g.onHint?.('The farm... all of it. The garden trampled flat, the fences down, and smoke still rising from the thatch.'));
      g.time.delayedCall(6000, () => g.onHint?.("No sign of her. No travellers on the road, either. Iran's hut is still standing. Maybe he saw something."));
    }
  } else if (g.area === 'hut') {
    g.time.delayedCall(900, () => g.onHint?.('Dark and cold in here, and the fire out. Iran is huddled on the floor with Pip and Hetty.'));
  }
}

/** What the Ashes quest needs from conversations (see dialogue/iran.ts). */
export const RAID_ACTIONS: Record<string, DialogueAction> = {
  'found-iran': () => {
    QuestLog.complete('the-raid', 'search');
    QuestLog.complete('the-raid', 'outside');
    if (QuestLog.isDone('the-raid', 'iran')) return;
    QuestLog.complete('the-raid', 'iran');
    QuestLog.writeDiary(
      'Found Iran on the floor of his hut with Pip and Hetty, the fire out and the shutters closed. They are alive, thank the gods. ' +
        'He saw the big goblin, the one in iron, carry something out of our door wrapped in a quilt, and the whole band went off north, ' +
        'up past the cave and into the trees. Mother. It has to have been Mother.',
    );
  },
};
