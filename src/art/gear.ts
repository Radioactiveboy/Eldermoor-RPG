import type { Tones } from './character';
import { Detail, Hit, limb, Solid } from './figure3d';
import type { HeroFrame, HeroLook } from './hero3d';
import { PALETTE as P } from './palette';
import type { EquipSlot, ItemId } from '../systems/Inventory';

/**
 * How worn and carried things look on the hero (see hero3d.ts). Each piece of
 * gear adds its own solids to the hero's 3D model, placed from where his head
 * and hand are in that pose, and can change him under it first.
 *
 * To make a new item show up when worn, give it a look in {@link GEAR_LOOKS}.
 * Items without one are still worn, they just don't change the sprite.
 */
export interface GearLook {
  /** Changes to the hero under the gear, e.g. a hat pushes the hood back. */
  adjust?: (l: HeroLook) => HeroLook;
  /** The gear's own solids (and any small marks), in the hero's body space. */
  model: (f: HeroFrame) => { solids: Solid[]; details?: Detail[] };
}

const ASH: Tones = [P.ash, P.ashDark, P.ashLight];
const ASH_KNOT: Tones = [P.ashDark, P.ashDark, P.ash];
const GRIP: Tones = [P.leather, P.leatherDark, P.leatherLight];
const IRON: Tones = [P.iron, P.iron, P.ironLight];

/** A long ash staff in the right hand: knotted, a worn knob at the top, a leather grip and an iron-shod foot. */
const walkingStaff: GearLook = {
  adjust: (l) => ({ ...l, holding: true }),
  model: ({ pose, hand }) => {
    const [x, y, z] = hand;
    const sit = !!pose.sit;
    // Planted a little ahead, leaning back to the shoulder; seated, propped against it.
    const foot: [number, number, number] = sit ? [x, 0.4, z + 0.8] : [x, 0.4, z + 1.2 - pose.stride * 0.6];
    const top: [number, number, number] = sit ? [x - 1, 34, z - 3] : [x, 39 - pose.bob, z - 0.8];
    const wood = (h: Hit): Tones => (Math.abs(h.y - 21) < 0.5 || Math.abs(h.y - 33) < 0.5 ? ASH_KNOT : ASH);
    const shaft = limb(foot, top, 0.65, 0.65, wood, 0.4).map((p) => ({ ...p, soft: true }));
    // Where along the shaft a height falls, for the grip.
    const at = (py: number): [number, number, number] => {
      const t = (py - foot[1]) / (top[1] - foot[1]);
      return [foot[0] + (top[0] - foot[0]) * t, py, foot[2] + (top[2] - foot[2]) * t];
    };
    const grip = limb(at(y + 1.2), at(y + 3.6), 0.85, 0.85, GRIP, 0.4);
    const solids: Solid[] = [
      ...shaft,
      ...grip,
      { cx: top[0], cy: top[1] + 0.6, cz: top[2], rx: 1.15, ry: 1.2, rz: 1.15, material: ASH, soft: true },
      { cx: foot[0], cy: 0.5, cz: foot[2], rx: 0.75, ry: 0.6, rz: 0.75, material: IRON },
      // The hand closed round the shaft, over it.
      { cx: x, cy: y, cz: z, rx: 1.55, ry: 1.5, rz: 1.65, material: [P.skin, P.skinShade, 0xffdcb6] },
    ];
    return { solids };
  },
};

/** A wide-brimmed woven straw hat with a red ribbon. Pushes the hood back. */
const strawHat: GearLook = {
  adjust: (l) => ({ ...l, hoodUp: false }),
  model: ({ hy, hz }) => {
    const straw: Tones = [P.straw, P.strawDark, P.strawLight];
    const ribbon: Tones = [P.flowerRed, P.quilt, P.flowerRed];
    // The weave: a few darker and lighter strands, the same every time.
    const weave = (h: Hit): Tones => {
      const n = (Math.floor(h.x * 1.4) * 3 + Math.floor(h.z * 1.4) * 5 + Math.floor(h.y * 1.4) * 7) % 9;
      return n === 0 ? [P.strawDark, P.strawDark, P.straw] : n === 4 ? [P.strawLight, P.straw, P.strawLight] : straw;
    };
    const brimY = hy + 3.4;
    const crown = (h: Hit): Tones => (h.y < brimY + 2.1 ? ribbon : weave(h));
    const solids: Solid[] = [
      // The brim: a wide, flat disc, sagging a little at the edge.
      { cx: 0, cy: brimY, cz: hz, rx: 9.2, ry: 0.75, rz: 8.6, material: weave },
      { cx: 0, cy: brimY + 0.6, cz: hz, rx: 6.4, ry: 0.8, rz: 6, material: weave },
      // The crown: a rounded dome, the ribbon round its foot.
      { cx: 0, cy: brimY + 2.8, cz: hz - 0.3, rx: 5.2, ry: 3.6, rz: 5, material: crown },
    ];
    // The ribbon's two tails, hanging at the back.
    const details: Detail[] = [
      { x: 0.4, y: brimY + 0.6, z: hz - 5.4, color: P.flowerRed },
      { x: -0.6, y: brimY - 0.2, z: hz - 6.6, color: P.quilt },
    ];
    return { solids, details };
  },
};

/** What each item looks like worn. Add an entry here to dress the hero in new gear. */
export const GEAR_LOOKS: Partial<Record<ItemId, GearLook>> = {
  'walking-staff': walkingStaff,
  'straw-hat': strawHat,
};

/** Layering order, from the body outwards: what's worn goes on before what's held. */
const LAYER_ORDER: EquipSlot[] = ['body', 'feet', 'trinket', 'head', 'offHand', 'mainHand'];

/** The looks of whatever the hero is wearing and carrying, in layering order. */
export function dressed(equipped: Partial<Record<EquipSlot, ItemId>>): GearLook[] {
  return LAYER_ORDER.map((slot) => equipped[slot] && GEAR_LOOKS[equipped[slot]]).filter((g): g is GearLook => !!g);
}
