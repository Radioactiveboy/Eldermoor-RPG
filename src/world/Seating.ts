import Phaser from 'phaser';
import { FEET_Y, FRAME_H } from '../art/character';
import { SEAT_TOP } from '../art/IsoModel';
import { depthAt } from '../iso/IsoMath';
import type { MapObject } from './MapData';

/**
 * How someone sitting is drawn with what they sit on. A seat is a separate
 * sprite from its sitter, so one of the two has to go in front, and which is
 * right depends on the seat and on the way the sitter faces:
 *
 * - Facing the camera or side-on, their legs hang down in front of (or beside)
 *   the seat: they are drawn over it, whole.
 * - Facing away, their legs are behind the seat. They are still drawn over it
 *   (they sit on top of it), but cut off at the seat's top, so its front shows
 *   below them instead of their shins and feet.
 * - On a chair with its back to the camera (a `-turned` one, or a pew), they are
 *   behind the chair: it is drawn over them, and only what rises above its back shows.
 *
 * Sitting on something that isn't a seat (a pallet, the floor), nothing is cut.
 */

/** The keys of things to sit on: the stools, chairs, settles, benches and pews of every area. */
const SEAT = /(^|-)(stool|chair|plainchair|armchair|rocker|settle|bench|pew)(-|$)/;
/** Benches that are for working at, not sitting on. */
const WORKTOP = /kitchen-bench/;
/** Seats drawn with their backs on the near side (turned chairs, pews): whoever sits in one faces away, behind its back. */
const BACK_NEAR = /-turned$|(^|-)pew$/;

/** The facings (see Npc.sync: s, se, e, ne, n, nw, w, sw) that look up the screen, away from the camera. */
const AWAY = [3, 4, 5];

/** The seat at a spot, if there is one: the stool or chair whose tile it is. */
export function seatAt(objects: readonly MapObject[] | undefined, gx: number, gy: number): MapObject | undefined {
  return objects?.find((o) => !o.flat && SEAT.test(o.key) && !WORKTOP.test(o.key) && gx >= o.tx && gx < o.tx + o.w && gy >= o.ty && gy < o.ty + o.h);
}

export interface SeatedDraw {
  /** The depth to draw the sitter at. */
  depth: number;
  /** The depth for their shadow: under the seat, so it doesn't lie across its top. */
  shadow: number;
  /** Whether to cut them off at the seat's top (see {@link cutAtSeat}). */
  cut: boolean;
}

/**
 * How to draw someone sitting at a spot, facing `facing`. `depth` is where they'd be drawn standing
 * there, and `seat` what they sit on (see {@link seatAt}), if anything.
 */
export function seatedDraw(seat: MapObject | undefined, depth: number, facing: number): SeatedDraw {
  // On no seat, as before: in front of whatever shares the tile.
  if (!seat) return { depth: depth + 2, shadow: depth + 1.5, cut: false };
  const at = depthAt(seat.tx + seat.w / 2, seat.ty + seat.h / 2);
  if (BACK_NEAR.test(seat.key)) return { depth: at - 0.25, shadow: at - 0.5, cut: false };
  return { depth: Math.max(depth + 2, at + 0.5), shadow: at - 0.5, cut: AWAY.includes(facing) };
}

/** Cuts a figure's sprite off at the top of the seat it sits on (or undoes that), whatever size its frames are. */
export function cutAtSeat(sprite: Phaser.GameObjects.Sprite, cut: boolean): void {
  if (cut) {
    // Frames are FRAME_H tall, or a whole multiple of it for the finely drawn (see figure3d's personSpec).
    const k = sprite.frame.height / FRAME_H;
    sprite.setCrop(0, 0, sprite.frame.width, Math.round((FEET_Y + 0.5 - (SEAT_TOP - 1)) * k));
  } else if (sprite.isCropped) {
    sprite.setCrop();
  }
}
