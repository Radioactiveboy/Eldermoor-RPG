/**
 * When the goblins come for Adowvale, and in what numbers (see GateAttack.ts for
 * the attack itself). Kept free of Phaser so it can be tested on its own.
 */
import type { FoeKind } from '../systems/Combat';
import { QuestLog } from '../systems/Quests';

/** When the goblins can come: from an hour after dusk till before first light. */
export function gateAttackHour(hour: number): boolean {
  return hour >= 21 || hour < 4;
}

/** Whether tonight's the night: the hero has the quest, it isn't over, and the goblins haven't come yet. */
export function gateAttackDue(): boolean {
  const q = QuestLog.get('the-gate');
  return !!q && !q.completed && !QuestLog.isDone('the-gate', 'hold') && !QuestLog.hasFlag('gate-fell');
}

/** The goblins in each wave, by whether the militia were warned. */
export function gateWaves(warned: boolean): FoeKind[][] {
  const first: FoeKind[] = ['goblin', 'goblintorch', 'goblinspear'];
  const second: FoeKind[] = ['goblin', 'goblin', 'goblintorch'];
  return warned ? [first, second] : [[...first, 'goblin'], [...second, 'goblinspear']];
}
