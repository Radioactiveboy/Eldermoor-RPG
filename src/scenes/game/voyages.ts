/** Sailing on the Grey Heron from Adowvale Jetty (see systems/Voyages.ts and dialogue/jetty.ts). */
import { GameAudio } from '../../audio/Audio';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { openVoyages } from '../../systems/Voyages';
import type { GameScene } from '../GameScene';
import { leaveThrough } from './travel';

/**
 * Sailing on the Grey Heron (the `voyage:<area>` action, from Maren's talk):
 * pay the fare, and off down the river, the hours passing on the way, to step
 * ashore at the destination's landing (its entry named in systems/Voyages.ts).
 */
export function sailTo(g: GameScene, to: string): void {
  const voyage = openVoyages().find((v) => v.to === to);
  if (!voyage || !Inventory.addCoins(-voyage.fare)) return;
  GameAudio.coins();
  QuestLog.writeDiary(`Paid Maren Tull ${voyage.fare} coins for a passage on the Grey Heron, down the Wend to ${voyage.name}.`);
  g.time.delayedCall(600, () => leaveThrough(g, { tx: g.player.tileX, ty: g.player.tileY, to: voyage.to, entry: voyage.entry, auto: true, travelHours: voyage.hours }));
}
