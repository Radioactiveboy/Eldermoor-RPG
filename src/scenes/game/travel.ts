/** Doors and roads between areas: locked doors, "set off on the trek?", and fading out to the next area. */
import Phaser from 'phaser';
import { GameAudio } from '../../audio/Audio';
import { Inventory } from '../../systems/Inventory';
import { marketOpen } from '../../systems/MarketHours';
import { QuestLog } from '../../systems/Quests';
import { Tavern } from '../../systems/Tavern';
import { clockText } from '../../systems/TimeOfDay';
import { Door } from '../../world/MapData';
import type { ConfirmSceneData } from '../ConfirmScene';
import type { GameScene, GameSceneData } from '../GameScene';
import { pathTo } from './input';
import { standUp } from './sitting';
import { residenceOpen } from './garrison';
import { workshopOpen } from './workshops';

/** Walking off the end of a road at the edge of the map goes on to the next area. */
export function checkRoadExits(g: GameScene): void {
  if (g.busy) return;
  const { tileX, tileY } = g.player;
  const exit = g.map.data.doors?.find((d) => d.auto && d.tx === tileX && d.ty === tileY);
  if (!exit) {
    g.exitArmed = true;
    g.lastOffExit = { x: tileX, y: tileY };
  } else if (g.exitArmed) {
    useDoor(g, exit);
  }
}

/** Stepping into a patch of ground with a thought attached (where a road runs on off the map) brings it on, once each time. */
export function checkMusings(g: GameScene): void {
  const { gx, gy } = g.player;
  const here = g.map.data.musings?.find((m) => gx >= m.x0 && gx < m.x1 && gy >= m.y0 && gy < m.y1);
  if (here && here !== g.musing && !g.busy) g.onHint?.(here.text);
  g.musing = here;
}

export function useDoor(g: GameScene, door: Door): void {
  if (g.area === 'home' && !QuestLog.has('mother-medicine')) {
    // Don't let the story start without its first scene.
    g.onHint?.("I shouldn't go anywhere before I've spoken with Mother.");
    return;
  }
  if (!doorAllowed(g, door)) return;
  if (door.ask) askBeforeLeaving(g, door);
  else leaveThrough(g, door);
}

/**
 * Doors that may be shut to the hero: the smithy and the bakery while their
 * keepers are in bed, the Headman's house at night, the Crooked Tankard's cellar until Godric asks for the
 * rats to be cleared, and the rooms upstairs, of which only the one let to the
 * hero opens (and only while it's paid for).
 */
export function doorAllowed(g: GameScene, door: Door): boolean {
  if (!workshopOpen(g, door.to) || !residenceOpen(g, door.to)) return false;
  if (door.id === 'cellar' && !QuestLog.has('cellar-rats') && !QuestLog.hasFlag('may-use-cellar')) {
    GameAudio.rattle();
    g.onHint?.("The trapdoor is bolted, and Godric is watching me over the bar. Not without asking him first.");
    return false;
  }
  const room = door.id?.startsWith('room-') ? Number(door.id.slice(5)) : undefined;
  if (room === undefined) return true;
  const renting = Tavern.renting(g.clock.elapsedHours);
  if (renting && Tavern.room === room) return true;
  GameAudio.rattle();
  const others = [
    `Room ${room} is locked. Somebody on the other side is snoring like a saw.`,
    `Locked. A voice from inside: "Go away! I paid for this one!"`,
    `Room ${room} is locked. It smells of pipe smoke and wet dog.`,
  ];
  g.onHint?.(
    !renting
      ? Tavern.room === room && Tavern.paidUntil > 0
        ? 'Locked. My time in this room is up. I would have to take it again from Godric.'
        : "Locked. I'd have to take a room from Godric downstairs first."
      : others[(room + g.clock.day) % others.length],
  );
  return false;
}

/** "Do you want to make the trek to...?" Yes goes; no turns back. */
export function askBeforeLeaving(g: GameScene, door: Door): void {
  if (!g.takeControls()) return;
  if (g.seat) standUp(g);
  const data: ConfirmSceneData = {
    question: door.ask!,
    note: door.travelHours ? trekNote(g, door) : undefined,
    yes: 'Set off',
    no: 'Not yet',
    onAnswer: (yes) => (yes ? leaveThrough(g, door) : turnBack(g, door)),
  };
  g.scene.launch('Confirm', data);
}

/** "It's about 2 hours on foot: I'd get there around 14:00." And a warning if the market will be shut by then. */
export function trekNote(g: GameScene, door: Door): string {
  const hours = door.travelHours!;
  const arrive = g.clock.hour + hours;
  let note = `It's about ${hours} hour${hours === 1 ? '' : 's'} on foot: I'd get there around ${clockText(arrive)}.`;
  if (door.to === 'market' && !marketOpen(Phaser.Math.Wrap(arrive, 0, 24))) note += ' The market will be shut by then.';
  return note;
}

/** Changed their mind at a road's end: step back off it, so the question isn't asked again straight away. */
export function turnBack(g: GameScene, door: Door): void {
  g.release();
  if (!door.auto) return;
  g.exitArmed = false;
  const path = pathTo(g, g.lastOffExit);
  if (path) g.player.setPath(path);
}

export function leaveThrough(g: GameScene, door: Door): void {
  // An order still on its way from the bar comes along, wrapped in a cloth.
  const order = g.service?.item;
  if (order) {
    g.service = undefined;
    Inventory.add(order, 1);
  }
  g.busy = true;
  g.player.setPath([]);
  // Only real doors creak: not the end of a road, nor the mouth of a cave.
  if (!door.auto && door.facing !== 'front' && !g.map.data.underground) GameAudio.door();
  g.cameras.main.fadeOut(door.auto ? 500 : 350, 0, 0, 0);
  g.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    // The long road takes a while: the clock moves on before the next area is built, so it arrives at the right hour.
    if (door.travelHours) g.clock.advance(door.travelHours);
    g.scene.restart({ area: door.to, entry: door.entry } satisfies GameSceneData);
  });
}
