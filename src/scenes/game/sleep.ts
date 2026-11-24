/** Beds: choosing how long to sleep, sleeping, and saving (and loading) the game. */
import { checkHomestead, sleptAtHome } from './homestead';
import Phaser from 'phaser';
import { Needs } from '../../systems/Needs';
import { PlayerStats } from '../../systems/PlayerStats';
import { QuestLog } from '../../systems/Quests';
import { SAVE_VERSION, SaveData, SaveGame } from '../../systems/SaveGame';
import { Tavern } from '../../systems/Tavern';
import { TimeOfDay } from '../../systems/TimeOfDay';
import { raidStage } from '../../world/GoblinRaid';
import { AreaId, Bed } from '../../world/MapData';
import type { ConfirmSceneData } from '../ConfirmScene';
import type { GameScene, GameSceneData } from '../GameScene';
import type { SleepSceneData } from '../SleepScene';
import { standUp } from './sitting';

/** What the hero thinks on waking, by the hour (and in a rented room at the Crooked Tankard, where). */
export function wakingThought(hour: number, area: AreaId): string {
  if (area === 'tavern-room') {
    if (hour >= 5 && hour < 12) return 'Morning. Carts in the square below, and the smell of bacon coming up the stairs.';
    if (hour >= 12 && hour < 18) return 'I slept half the day away in a rented bed. Downstairs, somebody is already arguing about dice.';
    return 'Dark outside. Through the floor I can hear the taproom: laughing, tankards, and Pell, singing.';
  }
  if (hour >= 5 && hour < 10) return 'Morning already. I feel rested, and the fire has burned low.';
  if (hour >= 10 && hour < 16) return 'I slept half the day away. Still, I feel better for it.';
  if (hour >= 16 && hour < 20) return 'The light is going. I feel rested, at least.';
  return 'Dark outside. The fire crackles, and the house is quiet.';
}

/**
 * After the tincture: "Get some sleep, and hope she's better in the morning."
 * There's only the one answer, and it's straight to bed till dawn.
 */
export function askToSleep(g: GameScene): void {
  if (!g.takeControls()) {
    g.time.delayedCall(300, () => askToSleep(g));
    return;
  }
  if (g.seat) standUp(g);
  const bed = g.map.data.beds?.find((b) => b.id === 'home-bed');
  const data: ConfirmSceneData = {
    question: 'I should get some sleep.',
    note: 'Mother has had her tincture. All I can do now is rest, and hope to see her improved in the morning.',
    yes: 'Go to sleep until morning',
    only: true,
    onAnswer: () => {
      if (!bed) {
        g.release();
        return;
      }
      g.player.faceTowards(bed.gx, bed.gy);
      sleep(g, bed, g.clock.hoursUntil(6));
    },
  };
  g.scene.launch('Confirm', data);
}

/** Lie down in a bed: choose how long to sleep for, then sleep and save. */
export function goToBed(g: GameScene, bed: Bed): void {
  if (!QuestLog.has('mother-medicine')) {
    g.onHint?.("I can't sleep yet. Mother wants to speak with me.");
    return;
  }
  if (raidStage() === 'pending' && bed.id === 'home-bed') {
    askToSleep(g);
    return;
  }
  if (raidStage() === 'morning') {
    g.onHint?.("Sleep? With all that shouting outside? Something is very wrong.");
    return;
  }
  if (bed.id === 'tavern-room' && !Tavern.renting(g.clock.elapsedHours)) {
    g.onHint?.('My time in this room is up. I should see Godric downstairs if I want to stay another night.');
    return;
  }
  if (!g.takeControls()) return;
  const data: SleepSceneData = { clock: g.clock };
  g.scene.launch('Sleep', data);
  g.scene.get('Sleep').events.once('sleep-closed', (hours?: number) => {
    if (hours) sleep(g, bed, hours);
    else g.release();
  });
}

/** Fade to black, let the hours pass, wake rested, and save the game. */
export function sleep(g: GameScene, bed: Bed, hours: number): void {
  g.player.setPath([]);
  g.cameras.main.fadeOut(900, 0, 0, 0);
  g.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    g.clock.advance(hours);
    // The night after the tincture: and in the morning, the goblins.
    if (raidStage() === 'pending') {
      QuestLog.clearFlag('raid-pending');
      QuestLog.setFlag('raid-morning');
    }
    Needs.slept(hours, g.clock.elapsedHours);
    // Work on the Hollow goes on overnight; and the first night in the rebuilt cottage is the end of the rebuilding.
    checkHomestead(g);
    if (bed.id === 'home-bed' && g.map.data.sights?.some((s) => s.id === 'home-mother-bed')) sleptAtHome();
    g.stats.heal(g.stats.maxHealth);
    g.stats.restoreStamina(g.stats.maxStamina);
    const save = makeSave(g, bed);
    SaveGame.write(save);
    // Wake up from the save just made, so waking always matches what loading it later gives.
    g.scene.restart({ load: save, slept: hours } satisfies GameSceneData);
  });
}

/** Everything needed to come back to this moment, waking in `bed`. */
export function makeSave(g: GameScene, bed: Bed): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    savePoint: bed.id,
    area: g.area,
    position: { x: bed.gx, y: bed.gy },
    hours: g.clock.elapsedHours,
    health: g.stats.health,
    stamina: g.stats.stamina,
    sections: SaveGame.collect(),
  };
}

/** Puts the whole game back as it was when a save was made. */
export function loadSave(g: GameScene, save: SaveData): void {
  g.stats = new PlayerStats();
  g.stats.health = save.health;
  g.stats.stamina = save.stamina;
  g.clock = new TimeOfDay(save.hours);
  QuestLog.dayProvider = () => g.clock.day;
  QuestLog.hourProvider = () => g.clock.hour;
  SaveGame.restore(save);
}
