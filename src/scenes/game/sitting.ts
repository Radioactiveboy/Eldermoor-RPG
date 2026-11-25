/** Sitting on benches, stools and pews, and the thoughts that come while sitting. */
import { PLAYER_RADIUS } from '../../config';
import { NpcWorld } from '../../entities/Npc';
import { marketOpen } from '../../systems/MarketHours';
import { Seat } from '../../world/MapData';
import type { GameScene } from '../GameScene';
import { SERVICE_FIRST } from './tavern';
import { ROSE_SITTING_THOUGHTS } from '../../dialogue/blackrose';

export const SITTING_THOUGHTS: Record<string, string[]> = {
  ...ROSE_SITTING_THOUGHTS,
  bench: [
    'The garden could do with weeding again.',
    'Smoke curls up from the chimney and drifts over the trees.',
    'A blackbird is singing somewhere in the hedge.',
  ],
  stool: [
    'The fire pops and settles. It is warm in here, at least.',
    'The old table is covered in knife marks and candle wax.',
  ],
  'hut-stool': [
    'Somebody has carved a lopsided hen into the table. Two somebodies, by the look of it.',
    'There is a basket of eggs on the shelf, and a feather in the butter.',
  ],
  'market-bench': [
    'The smell of fresh bread drifts over from the bakehouse stall.',
    'Somewhere a cart rattles over the cobbles. Two women are arguing about the price of eggs.',
    'Clang, clang, clang. The smith is at it again.',
  ],
  pew: [
    'The candles gutter and steady. Somewhere behind the altar a brother is humming, very low.',
    'The light through the windows lies in blue and gold on the floor.',
  ],
  'cloister-bench': [
    'Bees go about the herbs. Somewhere a bell rings once, and stops.',
    'The moonpetal by the pond nods in the breeze. Brother Anselm is talking to his sage.',
  ],
  'abbey-bench': [
    'A brother crosses the court with an armful of books, nods, and is gone.',
    'The well bucket creaks in the wind. The whole place smells of lavender and woodsmoke.',
  ],
  'refectory-bench': [
    'The pottage smells of leeks. It always smells of leeks, Brother Hob says, and he is proud of it.',
    'Someone has carved a very small wolf into the table. It looks a bit like her.',
  ],
  // The same bench after the traders have gone home.
  'tavern-table': [
    'Someone has carved "COBB IS A CHEAT" into the table. Underneath, in another hand: "ADA IS".',
    'The fire roars, the tankards clatter, and the floor is sticky underfoot. It is wonderful.',
    'A dog under the next table is eating something it found. Best not to ask what.',
  ],
  'tavern-bar': [
    'Godric polishes the same tankard, over and over, watching the room.',
    'A row of tankards hangs over the bar, each with a name scratched on it. One just says "NO".',
  ],
  'tavern-table-quiet': [
    'It is quiet at this hour. Dust turns in the light from the window, and the fire ticks.',
    'Godric is chalking up debts on a slate. The list for "HARLAN" goes right off the bottom.',
  ],
  'tavern-bar-quiet': ['Godric polishes the same tankard, over and over. The taproom is nearly empty.'],
  'tavern-bench': [
    'Noise and warm light spill out of the Crooked Tankard every time the door opens.',
    'The sign over the door creaks in the wind: a tankard, painted crooked, on purpose.',
  ],
  'market-bench-closed': [
    'The stalls are covered over for the night. The square is quiet without the traders.',
    'A militiaman yawns by the well and leans on his spear.',
    'Lamplight pools on the trodden earth. Somewhere a shutter bangs in the wind.',
  ],
};

export function sitOn(g: GameScene, seat: Seat): void {
  g.walkingTo = undefined;
  g.seat = seat;
  NpcWorld.sitting = true;
  g.sitTimer = 0;
  // Sitting down at a tavern table: a maid will be over in a moment.
  if (seat.name === 'tavern-table') g.serviceTimer = Math.max(g.serviceTimer, SERVICE_FIRST);
  g.player.sitAt(seat.gx, seat.gy, { x: seat.faceX, y: seat.faceY });
}

export function standUp(g: GameScene): void {
  const seat = g.seat;
  if (!seat) return;
  g.seat = undefined;
  NpcWorld.sitting = false;
  // Step off the seat, round anyone standing just there (a maid with a tray, say).
  let spot = { x: seat.standX, y: seat.standY };
  if (g.map.blocked(spot.x, spot.y, PLAYER_RADIUS)) {
    const around = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ x: Math.floor(seat.gx) + dx + 0.5, y: Math.floor(seat.gy) + dy + 0.5 })));
    const free = around
      .filter((p) => !g.map.blocked(p.x, p.y, PLAYER_RADIUS))
      .sort((a, b) => Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b.x - spot.x, b.y - spot.y))[0];
    if (free) spot = free;
  }
  g.player.standAt(spot.x, spot.y);
}

/** Sitting for a little while brings on a passing thought. */
export function updateSitting(g: GameScene, dt: number): void {
  if (!g.seat || g.busy) return;
  const before = g.sitTimer;
  g.sitTimer += dt;
  if (before < 3 && g.sitTimer >= 3) {
    const closed = g.area === 'market' && !marketOpen(g.clock.hour);
    const quiet = g.area === 'tavern' && g.clock.hour >= 2 && g.clock.hour < 17;
    const thoughts = SITTING_THOUGHTS[closed ? `${g.seat.name}-closed` : quiet ? `${g.seat.name}-quiet` : g.seat.name] ?? SITTING_THOUGHTS[g.seat.name] ?? [];
    if (thoughts.length > 0) g.onHint?.(thoughts[Math.floor(Math.random() * thoughts.length)]);
  }
}
