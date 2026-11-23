/**
 * Fights out in the world: the beasts of an area and the plains' chance meetings,
 * starting a fight (and bringing in the rest of a pack), and what's left after one
 * (spoils, footpads' purses, the hero's thoughts, quest steps). The fight itself is
 * scenes/CombatScene.ts; the rules are systems/Combat.ts.
 */
import Phaser from 'phaser';
import { GameAudio } from '../../audio/Audio';
import { SNEAK, SPRINT_NOTICE } from '../../config';
import { Creature } from '../../entities/Creature';
import { Npc } from '../../entities/Npc';
import { Bounties } from '../../systems/Bounties';
import { COMPANIONS, Companions } from '../../systems/Companions';
import { FoeKind, FOES, isOutlaw } from '../../systems/Combat';
import { Inventory, ItemId } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { Reputation } from '../../systems/Reputation';
import { RAID_DOOM } from '../../world/GoblinRaid';
import { PlainsEvents } from '../../world/PlainsEvents';
import type { CombatResult, CombatSceneData } from '../CombatScene';
import { checkCampCleared } from './gate';
import type { GameScene, GameSceneData } from '../GameScene';
import { countForBounties } from './bounties';
import { slewWolfMother } from './monastery';
import { raidDefeat } from './raid';
import { regroup } from './companions';
import { cancelChannel, give } from './sights';
import { standUp } from './sitting';
import { checkCellarClear } from './tavern';

/** The wolves of the den at home: once they're all gone, Brother Wystan hears of it. */
export const CAVE_WOLVES = ['cave-wolf-1', 'cave-wolf-2', 'cave-wolf-3'];

/** Other beasts this close (in tiles) to the one that starts a fight join in. */
export const PACK_RANGE = 7;

/** How loud the world's background sounds stay during a fight, under the battle music. */
export const COMBAT_DUCK = 0.35;

/** What's left of each kind of beast once it's slain. */
export const SPOILS: Record<FoeKind, Array<[ItemId, number]>> = {
  wolf: [['wolf-pelt', 1], ['wolf-meat', 1]],
  wolfmother: [['white-hide', 1], ['wolf-meat', 2]],
  deer: [['venison', 2], ['deer-hide', 1]],
  hare: [['hare-pelt', 1], ['raw-hare', 1]],
  boar: [['boar-tusk', 2], ['boar-meat', 2]],
  wildcat: [['wildcat-pelt', 1]],
  rat: [['rat-tail', 1]],
  // The footpads' purses are counted out separately (see FOOTPAD_PURSE).
  footpad: [],
  cutpurse: [['hunting-knife', 1]],
  // Nothing taken from the goblins: the raid ends with the hero on the ground (see world/GoblinRaid.ts).
  goblin: [],
  goblinspear: [],
  goblintorch: [],
  goblinbrute: [],
};

/** Coins in a footpad's purse, when he's beaten: at least the first, up to the second. */
export const FOOTPAD_PURSE: [number, number] = [8, 16];

/** What the hero thinks over a beast they've brought down, and when one gets away. */
export const AFTER_THE_FIGHT: Record<FoeKind, { slain: string; fled: string }> = {
  wolf: { slain: 'It lies still now. The pelt might be worth something in the village, and the meat will do for the pot, if I cook it well.', fled: 'It ran off into the trees. I doubt it will come back.' },
  wolfmother: {
    slain: 'The Wolf Mother is dead. Even lying still she is enormous, and her hide is as white as new snow. Brother Wystan will want to hear of this.',
    fled: 'She is gone into the dark.',
  },
  deer: { slain: 'Venison for the pot, and a fine hide. Tamsin will want that.', fled: 'Gone, white rump bobbing away over the grass. I need to be quicker.' },
  hare: { slain: 'A hare. The pelt is soft, and it would roast nicely over a hearth.', fled: 'Gone in a flash. Hares are quicker than they look.' },
  boar: { slain: 'The boar is still at last. Those tusks are worth keeping, and there is a feast of meat on it.', fled: 'It crashed off into the thicket. Good riddance.' },
  wildcat: { slain: 'Small, for all that fury. The pelt is thick and striped like a tabby, with a ringed tail. Tamsin might pay for it.', fled: 'Gone into the bracken without a sound. I will be watching the thickets now.' },
  rat: { slain: 'Rats. Big ones, too. I will take a tail or two to show Godric.', fled: 'It shot off into a hole in the wall. It will be back.' },
  footpad: { slain: "That's the end of the Plains tithe. There's a purse on him, heavier than mine was.", fled: 'He ran for the trees and never looked back. I doubt he will try this road again.' },
  cutpurse: { slain: "Nab won't be getting nervous on lonely roads any more. His knife is a good one.", fled: 'Gone, squealing, across the grass. So much for nerves.' },
  goblin: { slain: 'It lies twitching in the mud. There are so many more of them.', fled: 'It scuttles off, cackling.' },
  goblinspear: { slain: 'One less. There are so many more of them.', fled: 'It scuttles off, cackling.' },
  goblintorch: { slain: 'Its torch hisses out in the mud.', fled: 'It scuttles off, waving its torch.' },
  goblinbrute: { slain: 'The Brute is down.', fled: 'The Brute backs away, laughing.' },
};

/** Out on the plains: chance meetings on the road, with the people, beasts, talk and fights they need from the game. */
export function startRoadEvents(g: GameScene): PlainsEvents {
  return new PlainsEvents({
    scene: g,
    map: g.map,
    player: () => ({ x: g.player.gx, y: g.player.gy }),
    busy: () => g.busy || g.inCombat || !g.scene.isActive(),
    hour: () => g.clock.hour,
    addNpc: (id, gx, gy) => {
      const npc = new Npc(g, g.map, id, gx, gy, undefined, g.clock.hour);
      g.npcs.push(npc);
      return npc;
    },
    removeNpc: (npc) => {
      npc.destroy();
      g.npcs = g.npcs.filter((n) => n !== npc);
    },
    talk: (npc) => g.startConversation(npc),
    afterTalk: (fn) => {
      const before = g.afterTalk;
      g.afterTalk = () => {
        before?.();
        fn();
      };
    },
    addCreature: (id, kind, gx, gy) => {
      // Met by chance, so never counted among the foes defeated for good.
      (g.map.data.creatures ??= []).push({ id, kind, gx, gy, respawns: true });
      const creature = new Creature(g, g.map, id, kind, gx, gy);
      g.creatures.push(creature);
      return creature;
    },
    removeCreature: (creature) => {
      creature.destroy();
      g.creatures = g.creatures.filter((c) => c !== creature);
    },
    fight: (first) => startCombat(g, first),
    hint: (text) => g.onHint?.(text),
    give: (item, count) => give(g, item, count),
  });
}

export function spawnCreatures(g: GameScene): Creature[] {
  // Rats back in the cellar for the militia's bounty, and the like (counted as game that comes back, so they're never kept in the save).
  (g.map.data.creatures ??= []).push(...Bounties.spawns(g.area).map((s) => ({ ...s, respawns: true })));
  const spawns = (g.map.data.creatures ?? []).filter((s) => !g.defeatedFoes.has(s.id));
  // Handy for testing fights against a pack: open the game with ?wolves=3.
  const pack = Number(new URLSearchParams(window.location.search).get('wolves') ?? 1);
  const lead = spawns[0];
  if (lead && pack > 1) {
    const spots = [[1.5, 1], [-1, 1.5], [2, -1.5], [-2, -1], [0, 2.5]];
    for (let i = 0; i < Math.min(pack - 1, spots.length); i++) {
      const gx = lead.gx + spots[i][0];
      const gy = lead.gy + spots[i][1];
      const id = `${lead.id}-pack-${i}`;
      if (!g.defeatedFoes.has(id) && g.map.isWalkable(Math.floor(gx), Math.floor(gy))) spawns.push({ ...lead, id, gx, gy });
    }
  }
  return spawns.map((s) => new Creature(g, g.map, s.id, s.kind, s.gx, s.gy, s.notice));
}

export function updateCreatures(g: GameScene, dt: number): void {
  g.arrivalGrace = Math.max(0, g.arrivalGrace - dt);
  for (const creature of g.creatures) {
    const watching = !g.busy && g.arrivalGrace <= 0 && g.scene.isActive();
    if (creature.update(dt, watching ? { x: g.player.gx, y: g.player.gy } : undefined, g.sprinting, noise(g))) startCombat(g, creature);
  }
}

/** How far off beasts can notice the hero, as a share of the usual: closer while sneaking, further while sprinting. */
export function noise(g: GameScene): number {
  return g.sneaking ? SNEAK.notice : g.sprinting ? SPRINT_NOTICE : 1;
}

/** A beast has spotted the player (or the player has gone after some game): it and any of its pack close by fight. */
export function startCombat(g: GameScene, first: Creature, raid?: Creature[], band?: Creature[]): void {
  if (g.busy || g.inCombat) {
    first.disengage();
    return;
  }
  if (g.seat) standUp(g);
  if (g.channel) cancelChannel(g);
  g.busy = true;
  g.inCombat = true;
  GameAudio.duckAmbience(COMBAT_DUCK);
  g.walkingTo = undefined;
  g.player.setPath([]);
  // Only beasts that hunt in packs (wolves) bring the rest of the pack with them.
  const pack = FOES[first.kind].packs;
  // (The Wolf Mother and her wolves are one pack.)
  const foes = raid ?? band ?? g.gateAttack?.bandFor(first) ?? g.creatures.filter(
    (c) =>
      c === first ||
      (pack && c.active && FOES[c.kind].packs && isOutlaw(c.kind) === isOutlaw(first.kind) && c.distanceTo(first.gx, first.gy) < PACK_RANGE),
  );
  g.raidFight = !!raid;
  const hunted = first.huntable;
  foes.forEach((c) => c.engage());
  if (first.kind === 'rat') GameAudio.squeak();
  else if (raid) GameAudio.shriek(true);
  else if (!hunted) GameAudio.growl();
  GameAudio.playMusic('battle');
  const data: CombatSceneData = { foes, doom: raid ? RAID_DOOM : undefined };
  g.scene.launch('Combat', data);
  g.scene.get('Combat').events.once('combat-ended', (result: CombatResult) => endCombat(g, result, foes));
}

export function endCombat(g: GameScene, result: CombatResult, foes: Creature[]): void {
  g.inCombat = false;
  GameAudio.duckAmbience(1, 2);
  // Gone for good, except the plains' game, which is back the next time the hero comes this way.
  const respawns = new Set((g.map.data.creatures ?? []).filter((s) => s.respawns).map((s) => s.id));
  for (const id of [...result.slain, ...result.fled]) if (!respawns.has(id)) g.defeatedFoes.add(id);
  g.fitCamera();
  regroup(g);
  g.roadEvents?.fightOver(result.outcome);
  if (g.raidFight) {
    // However it went, it ends the same way.
    raidDefeat(g);
    return;
  }
  // The night the goblins come for Adowvale: going down, or running, loses the road (see game/gate.ts).
  if (g.gateAttack?.active && result.outcome !== 'victory') {
    g.gateAttack.lost();
    return;
  }
  if (result.outcome === 'defeat') {
    const by = foes[0]?.kind === 'wolfmother' ? 'The Wolf Mother' : `A ${foes[0]?.name.toLowerCase() ?? 'beast'}`;
    // Whoever was fighting beside the hero got them home.
    const carrier = Companions.fighters[0];
    QuestLog.writeDiary(
      `${by} got the better of me${foes.length > 1 ? ', and the rest of them with it' : ''}. I do not remember the end of it. ` +
        (carrier
          ? `${COMPANIONS[carrier].short} must have carried me home: I came to on the cottage floor with my head ringing and every bone aching. Next time I will be readier.`
          : 'I came to on the cottage floor with my head ringing and every bone aching. Next time I will be readier.'),
    );
    knockedOut(g, carrier && COMPANIONS[carrier].short);
    return;
  }
  GameAudio.playMusic(g.map.data.music ?? 'world');
  if (result.outcome === 'escaped') {
    foes.forEach((c) => c.disengage());
    g.onHint?.("I got away. Best keep my distance from it for now.");
  } else {
    const slain = foes.filter((c) => result.slain.includes(c.id));
    for (const beast of slain) for (const [item, count] of SPOILS[beast.kind]) give(g, item, count);
    const outlaws = slain.filter((c) => isOutlaw(c.kind));
    if (outlaws.length > 0) {
      const purse = outlaws.reduce((n) => n + Phaser.Math.Between(FOOTPAD_PURSE[0], FOOTPAD_PURSE[1]), 0);
      Inventory.reward(purse);
      GameAudio.coins();
      QuestLog.writeDiary(
        "Two footpads stopped me on the Lord's Road and asked for half my purse. I said no. They came at me with a cudgel and a knife, " +
          (outlaws.length > 1 ? 'and I put them both down in the grass. ' : 'and I put one of them down in the grass; the other ran. ') +
          `${outlaws.length > 1 ? 'Their purses' : 'His purse'} held ${purse} coins, no doubt taken from travellers before me.`,
      );
    }
    const after =
      foes[0].kind === 'rat' && g.area !== 'cellar'
        ? { slain: 'Rats, fat as cats. Whatever they live on up here, I would rather not know.', fled: 'It shot off into the rubble. It will be back.' }
        : AFTER_THE_FIGHT[foes[0].kind];
    g.onHint?.(slain.length > 0 ? after.slain : after.fled);
    // The plains' night wolves: word gets about.
    if (slain.some((c) => c.id.startsWith('road-wolf-'))) {
      Reputation.record('wolves', 'slain');
      Reputation.gain('militia', 2, 'Killed wolves on the plains');
    }
    // Beasts with a price on their heads.
    for (const said of countForBounties(slain.map((c) => c.kind))) g.onHint?.(said);
    if (g.area === 'cave' && g.creatures.every((c) => !c.active || foes.includes(c))) {
      g.time.delayedCall(2600, () => g.onHint?.('The den is quiet now. Only the dripping water, and something pale at the back of the cave.'));
    }
    if (CAVE_WOLVES.every((id) => g.defeatedFoes.has(id))) QuestLog.setFlag('cleared-cave');
    if (g.area === 'cellar') {
      const before = QuestLog.isDone('cellar-rats', 'clear');
      checkCellarClear(g);
      if (!g.creatures.some((c) => c.active)) {
        g.time.delayedCall(2600, () =>
          g.onHint?.(QuestLog.isDone('cellar-rats', 'clear') && !before ? 'That is the last of them. Godric will want to hear.' : 'The cellar is quiet now, apart from the dripping.'),
        );
      }
    }
    if (result.slain.includes('den-mother')) slewWolfMother();
    checkCampCleared(g);
    if (g.gateAttack?.active) {
      g.release();
      g.gateAttack.won();
      return;
    }
    if (foes.some((c) => c.id === 'cottage-wolf')) {
      QuestLog.writeDiary(
        'A grey wolf was nosing around the cottage when I stepped out. It went for me, and I had to fight it off. ' +
          'My hands are still shaking. I must not tell Mother; she has enough to worry about.',
      );
    }
  }
  g.release();
}

/** Who carried the hero home after their last beating, for the thought on coming round. */
let knockedOutBy: string | undefined;

export function takeKnockedOutBy(): string | undefined {
  const by = knockedOutBy;
  knockedOutBy = undefined;
  return by;
}

/** Beaten: black out, and come round at home with a little health. */
export function knockedOut(g: GameScene, carriedBy?: string): void {
  knockedOutBy = carriedBy;
  g.stats.heal(g.stats.maxHealth * 0.35);
  g.stats.restoreStamina(g.stats.maxStamina);
  g.cameras.main.fadeOut(1200, 0, 0, 0);
  g.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    g.scene.restart({ area: 'home', knockedOut: true } satisfies GameSceneData);
  });
}
