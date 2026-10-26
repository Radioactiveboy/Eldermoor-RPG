import type { Draw, FigureFrame, Outfit } from './character';
import { PALETTE as P } from './palette';
import type { EquipSlot, ItemId } from '../systems/Inventory';

/**
 * How worn and carried things look on the hero's sprite. Each piece of gear
 * adds its own layers to the figure, at depths among the body's parts (so a
 * staff held in the right hand goes behind the body when walking away and in
 * front of it when walking past), and can change the body under it first.
 *
 * To make a new item show up when worn, give it a look in {@link GEAR_LOOKS}.
 * Items without one are still worn, they just don't change the sprite.
 */
export interface GearLook {
  /** Changes to the figure under the gear, e.g. a hat pushes the hood back. */
  adjust?: (o: Outfit) => Outfit;
  /** The gear's own pieces, each with a depth to sort among the body's. */
  parts: (f: FigureFrame) => Draw[];
}

/** Where the right hand is (the figure's right: L is to its left). */
const RIGHT_ARM = -6;

/** The right hand, as the arm draws it: its left x, top y, and depth. */
function rightHand(f: FigureFrame): { x: number; y: number; D: number } {
  // Arms swing opposite to the legs, as in character.ts.
  const D = f.pose.stride * 2;
  return { x: Math.round(f.X(RIGHT_ARM, D) - 1), y: f.oy + 32 + f.pose.bob, D };
}

/** A long staff planted ahead in the right hand: a knotted ash shaft with a leather grip. */
const walkingStaff: GearLook = {
  parts: (f) => {
    const hand = rightHand(f);
    return [
      {
        // Just in front of the arm holding it.
        z: f.Z(RIGHT_ARM, hand.D + 0.5) + 0.25,
        paint: () => {
          const { c, oy, feet } = f;
          const grip = hand.x + 1;
          // Leans from a little behind the hand at the top to a little ahead of it on the ground.
          // Seen side-on it's held lower, so it doesn't cross the face.
          const top = { x: Math.round(f.X(RIGHT_ARM, hand.D - 0.6)), y: oy + 12 + Math.round(f.sin * f.sin * 8) + f.pose.bob };
          const foot = { x: Math.round(f.X(RIGHT_ARM, hand.D + 1.6)), y: feet - 1 };
          const xAt = (y: number) =>
            y <= hand.y ? grip + Math.round(((top.x - grip) * (hand.y - y)) / (hand.y - top.y)) : grip + Math.round(((foot.x - grip) * (y - hand.y)) / Math.max(1, foot.y - hand.y));
          // Two pixels thick: lit on the left, shaded on the right, with a knot or two.
          for (let y = top.y; y <= foot.y; y++) {
            const knot = y === oy + 21 || y === oy + 40;
            c.set(xAt(y), y, knot ? P.ashDark : P.ash);
            c.set(xAt(y) + 1, y, P.ashDark);
          }
          // Worn, rounded knob at the top.
          const kx = xAt(top.y);
          c.rect(kx - 1, top.y - 2, 3, 3, P.ash);
          c.set(kx - 1, top.y - 2, P.ashLight);
          c.set(kx, top.y - 2, P.ashLight);
          c.set(kx + 1, top.y, P.ashDark);
          c.set(kx + 2, top.y - 1, P.ashDark);
          // Leather grip wound above the hand, and the iron-shod foot.
          for (let y = hand.y - 3; y < hand.y; y++) c.rect(xAt(y), y, 2, 1, y % 2 ? P.leatherDark : P.leather);
          c.rect(xAt(foot.y), foot.y, 2, 1, P.ironLight);
          // The hand closed round it.
          c.rect(hand.x, hand.y, 3, 2, f.outfit.skin[0]);
          c.set(hand.x + 2, hand.y + 1, f.outfit.skin[1]);
        },
      },
    ];
  },
};

/** A wide-brimmed woven straw hat with a red ribbon. Pushes the hood back. */
const strawHat: GearLook = {
  adjust: (o) => (o.hood ? { ...o, hood: false, hoodDown: true } : o),
  parts: (f) => [
    {
      // On top of everything: nothing is held up in front of the hat.
      z: 10,
      paint: () => {
        const { c, X, oy } = f;
        const hy = oy + 15 + f.pose.bob;
        const weave = (x: number, y: number, base: number) => ((x + y * 3) % 7 === 0 ? P.strawDark : (x - y * 2) % 9 === 0 ? P.strawLight : base);
        // Brim: a flat ring seen from above, darker on its underside at the front edge.
        const bx = X(0, 0.3);
        const by = hy - 4;
        for (let y = Math.floor(by - 3); y <= Math.ceil(by + 3); y++) {
          for (let x = Math.floor(bx - 10); x <= Math.ceil(bx + 10); x++) {
            const nx = (x + 0.5 - bx) / 9;
            const ny = (y + 0.5 - by) / 2.8;
            const d = nx * nx + ny * ny;
            if (d > 1) continue;
            const underside = ny > 0.55;
            c.set(x, y, underside ? P.strawDark : weave(x, y, nx < -0.45 ? P.strawLight : nx > 0.6 ? P.thatch : P.straw));
          }
        }
        // Crown: a rounded dome, flat on top, shaded to the right.
        const kx = X(0, -0.3);
        for (let y = hy - 10; y <= by; y++) {
          const t = (y - (hy - 10)) / (by - (hy - 10));
          const half = 3.4 + Math.min(1, t * 2) * 1.6;
          const left = Math.round(kx - half);
          const right = Math.round(kx + half);
          for (let x = left; x <= right; x++) {
            const rel = (x - left) / Math.max(1, right - left);
            c.set(x, y, y === hy - 10 ? P.strawLight : rel > 0.7 ? P.strawDark : weave(x, y, rel < 0.25 ? P.strawLight : P.straw));
          }
        }
        // Red ribbon round the crown, tied at the back with two tails.
        const left = Math.round(kx - 5);
        c.rect(left, hy - 6, 11, 1, P.flowerRed);
        c.rect(left + 8, hy - 6, 3, 1, P.quilt);
        if (f.cos < -0.2) {
          const tx = Math.round(kx);
          c.set(tx, hy - 5, P.flowerRed);
          c.set(tx + 1, hy - 5, P.quilt);
          c.set(tx, hy - 4, P.quilt);
        }
      },
    },
  ],
};

/** What each item looks like worn. Add an entry here to dress the hero in new gear. */
export const GEAR_LOOKS: Partial<Record<ItemId, GearLook>> = {
  'walking-staff': walkingStaff,
  'straw-hat': strawHat,
};

/** Layering order, from the body outwards: what's worn goes on before what's held. */
const LAYER_ORDER: EquipSlot[] = ['body', 'feet', 'trinket', 'head', 'offHand', 'mainHand'];

/** The hero's outfit with whatever they're wearing layered on top. */
export function dressed(base: Outfit, equipped: Partial<Record<EquipSlot, ItemId>>): Outfit {
  const gear = LAYER_ORDER.map((slot) => equipped[slot] && GEAR_LOOKS[equipped[slot]]).filter((g): g is GearLook => !!g);
  return { ...base, gear: [...(base.gear ?? []), ...gear] };
}
