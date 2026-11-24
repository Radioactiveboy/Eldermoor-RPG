/**
 * GameScene's side of the night the goblins come for Adowvale (the attack itself is
 * world/GateAttack.ts): the camp on the Greyfells cleared, the warning, the attack
 * starting once the hero is in the village after dark, and how it ends: the village
 * held, or the hero beaten on the road and Hilde carried off, her bakery burnt.
 */
import Phaser from 'phaser';
import { GameAudio } from '../../audio/Audio';
import { Creature } from '../../entities/Creature';
import { QuestLog } from '../../systems/Quests';
import { Reputation } from '../../systems/Reputation';
import { GateAttack, gateAttackDue, gateAttackHour, GATE_LINE } from '../../world/GateAttack';
import type { GameScene, GameSceneData } from '../GameScene';
import { startCombat } from './combat';
import type { DialogueAction } from './dialogueActions';
import { pathTo } from './input';

/** The goblins keeping the camp on the Greyfells (see world/GreyfellsMap.ts). */
export const CAMP_GOBLINS = ['gf-goblin-fire-0', 'gf-goblin-fire-1', 'gf-goblin-lookout', 'gf-goblin-pen'];

/**
 * Handy for testing the night the goblins come (with ?raid=after): ?gate=due has the camp cleared and the
 * militia not yet warned, ?gate=warned has them warned, ?gate=fell starts the morning after the village fell.
 * Add ?area=market&hour=21 to be there when they come.
 */
export function gateTestStart(clock: { setHour(hour: number): void }): void {
  const which = new URLSearchParams(window.location.search).get('gate');
  if (!which) return;
  QuestLog.start('the-gate');
  if (which === 'warned') warnedMilitia();
  if (which === 'fell') {
    for (const flag of ['gate-fell', 'hilde-taken', 'bakery-burnt']) QuestLog.setFlag(flag);
    QuestLog.complete('the-gate', 'warn');
    QuestLog.complete('the-gate', 'hold');
    clock.setHour(9);
  }
}

/** After a fight on the Greyfells: once the last of the camp's goblins is down, one more runs for the hill, blowing a horn. */
export function checkCampCleared(g: GameScene): void {
  if (g.area !== 'greyfells' || QuestLog.has('the-gate')) return;
  if (!CAMP_GOBLINS.every((id) => g.defeatedFoes.has(id))) return;
  QuestLog.start('the-gate');
  g.time.delayedCall(1600, () => {
    GameAudio.warHorn();
    g.cameras.main.shake(300, 0.002);
    g.onHint?.('A horn! Up on the hill: one more of them, running for the hole and blowing for all it is worth. It got away.');
  });
  g.time.delayedCall(7000, () => g.onHint?.('They will know someone was at their camp. And they will know where to look. Adowvale.'));
  QuestLog.writeDiary(
    'Fought the goblins keeping their camp on the fell, four of them, and put them down. But a fifth was up the hill, and it ran for ' +
      'the hole blowing a horn. They know now. They came to the Hollow for Mother; they will come to Adowvale for me. I have to warn the militia.',
  );
}

/** Telling the militia the goblins are coming (afterRaid.ts, the guards' 'gate-warn'). */
export const GATE_ACTIONS: Record<string, DialogueAction> = {
  'warned-militia': () => warnedMilitia(),
};

function warnedMilitia(): void {
  QuestLog.setFlag('gate-warned');
  QuestLog.complete('the-gate', 'warn');
}

/** Whether the guards have something to hear about the camp: the hero has the quest and hasn't warned them yet. */
export function canWarnMilitia(): boolean {
  return QuestLog.has('the-gate') && !QuestLog.isDone('the-gate', 'warn');
}

/** Every so often in Adowvale: if it's the night they come, they come. */
export function checkGateAttack(g: GameScene): void {
  if (g.area !== 'market' || g.gateAttack || g.busy || g.inCombat) return;
  if (!gateAttackDue() || !gateAttackHour(g.clock.hour)) return;
  g.gateAttack = startGateAttack(g);
  g.gateAttack.begin();
}

function startGateAttack(g: GameScene): GateAttack {
  return new GateAttack(
    {
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
        const go = () => {
          if (g.inCombat || !foes.some((f) => f.active)) return;
          g.busy = false;
          startCombat(g, foes[0], undefined, foes.filter((f) => f.active));
        };
        // The last fight's tally card may still be up: the next band comes once it's gone.
        if (g.scene.isActive('Combat')) g.scene.get('Combat').events.once(Phaser.Scenes.Events.SHUTDOWN, () => g.time.delayedCall(300, go));
        else go();
      },
      walkTo: (to) => {
        const path = pathTo(g, { x: Math.floor(to.x), y: Math.floor(to.y) });
        if (path) g.player.setPath(path);
      },
      militia: (text) => {
        const guards = g.npcs.filter((n) => n.id.startsWith('guard-') && n.present);
        if (guards.length === 0) return;
        const near = guards.sort((a, b) => Math.hypot(a.gx - GATE_LINE.x, a.gy - GATE_LINE.y) - Math.hypot(b.gx - GATE_LINE.x, b.gy - GATE_LINE.y));
        near[Math.floor(Math.random() * Math.min(2, near.length))].say(text, 3);
      },
      // The militia of the square (not the one at the jail door).
      guards: () => g.npcs.filter((n) => /^guard-[1-4]$/.test(n.id) && n.present),
      addGoblin: (id, kind, gx, gy) => new Creature(g, g.map, id, kind, gx, gy),
      done: (held) => (held ? gateHeld(g) : gateFell(g)),
    },
    QuestLog.hasFlag('gate-warned'),
  );
}

/** The goblins beaten off: the village comes out, and the hero's name is made. */
function gateHeld(g: GameScene): void {
  QuestLog.setFlag('gate-held');
  QuestLog.complete('the-gate', 'warn');
  QuestLog.complete('the-gate', 'hold');
  Reputation.gainAll({ adowvale: 15, militia: 20 }, 'Held Adowvale against the goblins');
  GameAudio.playMusic(g.map.data.music ?? 'market');
  g.onHint?.('The last of them are running back down the road into the dark. Doors opening all round the square. Somebody is cheering.');
  g.time.delayedCall(5200, () => g.onHint?.('We held. Adowvale held.'));
  QuestLog.writeDiary(
    'They came in the night, up the old road from the Hollow, with torches and horns, just as I said they would. Two bands of them. ' +
      'The militia held the end of the square and I met them on the road, and we beat them back. Not a roof burnt. Old Garrick cried. So did I, after.',
  );
}

/**
 * Beaten on the road: a while in the dark, then the morning after in the Crooked Tankard,
 * Godric's face over the hero, and the news. They burnt Hilde's bakery, and took her.
 */
function gateFell(g: GameScene): void {
  QuestLog.setFlag('gate-fell');
  QuestLog.setFlag('hilde-taken');
  QuestLog.setFlag('bakery-burnt');
  QuestLog.complete('the-gate', 'warn');
  QuestLog.complete('the-gate', 'hold');
  g.busy = true;
  GameAudio.stopMusic();
  g.cameras.main.fadeOut(1600, 0, 0, 0);
  g.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    g.stats.health = Math.max(1, Math.round(g.stats.maxHealth * 0.3));
    g.clock.advance(g.clock.hoursUntil(8));
    QuestLog.writeDiary(
      'They came up the old road in the night and I could not stop them. I went down on the road with a spear-butt to the head. ' +
        "I woke in the Tankard with Godric over me. They fired Hilde's bakery, and when she ran out into the square they took her. " +
        'Carried her off down the road towards the Hollow, screaming. It is my fault. I brought them here. I will bring her back.',
    );
    // Laid down by the fire, near the stairs.
    g.scene.restart({ area: 'tavern', entry: 'stairs', gateAftermath: true } satisfies GameSceneData);
  });
}

/** Coming round in the Tankard the morning after the village fell. */
export function wokeAfterGate(g: GameScene): void {
  g.time.delayedCall(1000, () => g.onHint?.("Godric's taproom. Morning. My head is splitting. Why is everyone so quiet?"));
  g.time.delayedCall(5600, () => g.onHint?.("Hilde. They took Hilde. And her bakery is ash. I brought them here."));
}
