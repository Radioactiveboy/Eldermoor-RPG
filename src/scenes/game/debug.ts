/**
 * What the ?debug panel (scenes/DebugScene.ts) does to the world: GameScene's
 * side of it. Every function here does nothing (and says why) when the game
 * isn't in a state to take it, rather than breaking a conversation or a fight.
 */
import Phaser from 'phaser';
import { COMPANIONS, CompanionId, Companions } from '../../systems/Companions';
import { Experience } from '../../systems/Experience';
import { Inventory } from '../../systems/Inventory';
import { QuestLog } from '../../systems/Quests';
import { Weather } from '../../systems/Weather';
import { AreaId } from '../../world/MapData';
import type { CombatScene } from '../CombatScene';
import type { GameScene, GameSceneData } from '../GameScene';
import { companionAction } from './companions';

/** Scenes left running when the panel jumps somewhere: the world, its HUD, and the panel itself. */
const KEEP = new Set(['Game', 'UI', 'Debug']);

/** The world, if a game is going (not the title screen). */
export function liveGame(game: Phaser.Game): GameScene | undefined {
  const g = game.scene.getScene('Game') as GameScene | undefined;
  const sys = g?.sys;
  return sys && (sys.isActive() || sys.isPaused()) && g.player ? g : undefined;
}

/** Closes whatever is open over the world (a conversation, a menu, a fight) so it can be restarted cleanly. */
function closeOverlays(game: Phaser.Game): void {
  for (const s of game.scene.getScenes(false)) {
    const key = s.sys.settings.key;
    if (!KEEP.has(key) && (s.sys.isActive() || s.sys.isPaused() || s.sys.isSleeping())) game.scene.stop(key);
  }
}

/**
 * A new game with the page's switches as they now are (the panel has just
 * written them into the address). On the title screen it only says so: the
 * switches count once a new game is begun from there.
 */
export function restartNewGame(game: Phaser.Game): string {
  if (!liveGame(game)) return 'Switches set. Begin a new journey to use them.';
  closeOverlays(game);
  game.scene.start('Game', { newGame: true, area: 'home' } satisfies GameSceneData);
  if (!game.scene.isActive('UI')) game.scene.start('UI');
  return 'New game started with these switches.';
}

/** Straight to an area, keeping everything else as it is (like walking through a door, without the walk). */
export function teleport(game: Phaser.Game, area: AreaId): string {
  const g = liveGame(game);
  if (!g) return 'Start a game first.';
  if (g.inCombat) return 'Not in a fight. Kill them all first.';
  closeOverlays(game);
  if (g.sys.isPaused()) g.scene.resume();
  g.scene.restart({ area } satisfies GameSceneData);
  return `Off to ${area}.`;
}

export function setHour(game: Phaser.Game, hour: number): string {
  const g = liveGame(game);
  if (!g) return 'Start a game first.';
  if (!Number.isFinite(hour)) return 'That is not an hour.';
  g.clock.setHour(hour);
  return `It is now ${g.clock.hour.toFixed(2)} on day ${g.clock.day}.`;
}

/** Holds the weather now, as ?weather= would (an empty kind lets it change again). */
export function setWeather(kind: string): string {
  Weather.readSwitch(kind ? `?weather=${kind}` : '');
  return kind ? `Weather held at ${kind}.` : 'Weather left to itself.';
}

export function setFlag(flag: string, on: boolean): string {
  const f = flag.trim();
  if (!f) return 'Which flag?';
  if (on) QuestLog.setFlag(f);
  else QuestLog.clearFlag(f);
  return `${on ? 'Set' : 'Cleared'} ${f}.`;
}

/** The story's flags as they stand, in order. */
export function flags(): string[] {
  return [...(QuestLog.toSave().flags ?? [])].sort();
}

export function giveCoins(n: number): string {
  Inventory.addCoins(n);
  return `${Inventory.coins} coins.`;
}

export function giveXp(n: number): string {
  Experience.gain(n, 'Debug');
  return `Level ${Experience.level}.`;
}

export function heal(game: Phaser.Game): string {
  const g = liveGame(game);
  if (!g) return 'Start a game first.';
  g.stats.heal(g.stats.maxHealth);
  g.stats.restoreStamina(g.stats.maxStamina);
  return 'Health and stamina full.';
}

/**
 * Someone comes along at once, wherever the hero is, without asking or paying
 * (or, if they're already along, is sent home). The story flag they wait for
 * is set too, so they stay willing.
 */
export function toggleCompanion(game: Phaser.Game, id: CompanionId): string {
  const g = liveGame(game);
  if (!g) return 'Start a game first.';
  if (g.inCombat) return 'Not in a fight.';
  const def = COMPANIONS[id];
  if (Companions.isWith(id)) {
    companionAction(g, `companion:leave:${id}`);
    return `${def.short} sent home.`;
  }
  if (def.needs) QuestLog.setFlag(def.needs);
  if (Companions.full) return `The party is full (${Companions.party.join(', ')}). Send someone home first.`;
  Companions.recruited.add(id);
  companionAction(g, `companion:join:${id}`);
  return `${def.short} is with you.`;
}

/** Every foe in the fight going on drops (see CombatScene.killAll). */
export function killAll(game: Phaser.Game): string {
  const g = liveGame(game);
  if (!g?.inCombat || !game.scene.isActive('Combat')) return 'No fight going on.';
  void (game.scene.getScene('Combat') as CombatScene).killAll();
  return g.raidFight ? 'They fall... and the raid goes on as it must.' : 'All down.';
}

/** A line about where things stand, for the top of the panel. */
export function status(game: Phaser.Game): string {
  const g = liveGame(game);
  if (!g) return 'On the title screen.';
  const h = g.clock.hour;
  const time = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  const where = g.player ? `${g.area} (${g.player.gx.toFixed(1)}, ${g.player.gy.toFixed(1)})` : g.area;
  return [
    where,
    `day ${g.clock.day} ${time}`,
    `${Weather.now.kind}`,
    `hp ${Math.round(g.stats.health)}/${g.stats.maxHealth}`,
    `lvl ${Experience.level}`,
    `${Inventory.coins}c`,
    g.inCombat ? 'IN A FIGHT' : g.busy ? 'busy' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
