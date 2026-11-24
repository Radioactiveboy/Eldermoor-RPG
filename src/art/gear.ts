import type { Tones } from './character';
import { Detail, Hit, limb, Solid } from './figure3d';
import { HERO_BOOTS, HeroFrame, HeroLook } from './hero3d';
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
const STEEL: Tones = [0x9aa2ac, 0x5c626c, 0xdfe6ec];
const SKIN: Tones = [P.skin, P.skinShade, 0xffdcb6];
const LINEN: Tones = [P.linen, P.linenDark, 0xf0e4c4];
const ANTLER: Tones = [0xd8c8a8, 0x9a8668, 0xf0e6cc];
const BLACKTHORN: Tones = [0x6e4a2c, 0x3a2414, 0x936640];

type V3 = [number, number, number];

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** `p` moved `t` along `d`. */
function along(p: V3, d: V3, t: number): V3 {
  return [p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t];
}

/** The right hand closed round a grip, drawn over it. */
function fist(at: V3): Solid {
  return { cx: at[0], cy: at[1], cz: at[2], rx: 1.55, ry: 1.5, rz: 1.65, material: SKIN };
}

/**
 * Which way something held in the right hand points: down and forward from
 * the hand, a little out from the body, as though carried ready (seated, it
 * lies forward across the knees).
 */
function heldDir(f: HeroFrame): V3 {
  return f.pose.sit ? norm([-0.35, -0.25, 1]) : norm([-0.4, -0.85, 0.45]);
}

/** A direction square to `d` that points down and back (an axe's blade, hanging from its haft). */
function underside(d: V3): V3 {
  return norm([0, -d[2], d[1]]);
}

/** A weapon in the right hand, from `back` units behind the fist to `reach` beyond it. */
function heldWeapon(build: (f: HeroFrame, d: V3) => Solid[]): GearLook {
  return {
    model: (f) => {
      const d = heldDir(f);
      return { solids: [...build(f, d), fist(f.hand)] };
    },
  };
}

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

/** A long ash spear carried upright like the staff, its leaf-shaped head standing over the hero's hood. */
const spear: GearLook = {
  adjust: (l) => ({ ...l, holding: true }),
  model: ({ pose, hand }) => {
    const [x, , z] = hand;
    const sit = !!pose.sit;
    const foot: V3 = sit ? [x, 0.4, z + 0.8] : [x, 0.4, z + 1.2 - pose.stride * 0.6];
    const top: V3 = sit ? [x - 1.2, 40, z - 3.4] : [x, 43.2 - pose.bob, z - 1];
    const up = norm([top[0] - foot[0], top[1] - foot[1], top[2] - foot[2]]);
    const len = Math.hypot(top[0] - foot[0], top[1] - foot[1], top[2] - foot[2]);
    const socket = along(foot, up, len - 5.2);
    const solids: Solid[] = [
      ...limb(foot, socket, 0.55, 0.55, ASH, 0.4).map((p) => ({ ...p, soft: true })),
      // The leather binding and iron socket under the head.
      ...limb(along(socket, up, -1.6), socket, 0.75, 0.75, GRIP, 0.4),
      ...limb(socket, along(socket, up, 0.9), 0.7, 0.6, IRON, 0.3),
      // The leaf: widest a third of the way up, tapering to the point.
      ...[0.4, 1.1, 1.8, 2.5, 3.2, 3.9, 4.6].map((t, i) => {
        const p = along(socket, up, 0.9 + t);
        const r = [0.75, 1.05, 1.15, 1, 0.8, 0.55, 0.35][i];
        return { cx: p[0], cy: p[1], cz: p[2], rx: r, ry: 0.55, rz: r, material: STEEL };
      }),
      fist(hand),
    ];
    return { solids };
  },
};

/** A plain blade with an antler grip, hanging point-down from the hand. */
const huntingKnife = heldWeapon((f, d) => [
  ...limb(along(f.hand, d, -1.3), along(f.hand, d, 1.2), 0.6, 0.6, ANTLER, 0.3),
  { ...pointAt(along(f.hand, d, 1.3)), rx: 0.9, ry: 0.9, rz: 0.9, material: IRON },
  ...limb(along(f.hand, d, 1.6), along(f.hand, d, 5.8), 0.6, 0.25, STEEL, 0.3),
]);

/**
 * Which way the sword points: held loosely at the side, point down and a
 * little forward and out, so the blade runs clear of the leg instead of
 * splaying out sideways like a knife (seated, it lies forward across the knees).
 */
function swordDir(f: HeroFrame): V3 {
  return f.pose.sit ? norm([-0.3, -0.3, 1]) : norm([-0.28, -0.88, 0.38]);
}

/** Square to `d`, as near the body's left-right as it can be: the way the crossguard runs. */
function across(d: V3): V3 {
  const k = d[0];
  return norm([1 - k * d[0], -k * d[1], -k * d[2]]);
}

/**
 * Good village steel: a brass pommel and a leather grip showing above the
 * fist, a crossguard square to the blade just below it, and a long blade
 * tapering to the point, sized to the hero (about a third of his height).
 */
const shortSword: GearLook = {
  model: (f) => {
    const d = swordDir(f);
    const g = across(d);
    const guard = along(f.hand, d, 1.8);
    const brass: Tones = [P.gold, 0xa8802a, P.goldLight];
    const solids: Solid[] = [
      // The grip runs through the fist, its end and the pommel standing proud above it.
      { ...pointAt(along(f.hand, d, -2.9)), rx: 0.85, ry: 0.85, rz: 0.85, material: brass },
      ...limb(along(f.hand, d, -2.3), guard, 0.6, 0.6, GRIP, 0.3),
      // The crossguard, square to the blade, a little heavier at its tips.
      ...limb(along(guard, g, -2), along(guard, g, 2), 0.5, 0.5, IRON, 0.3),
      { ...pointAt(along(guard, g, -2.1)), rx: 0.6, ry: 0.6, rz: 0.6, material: IRON },
      { ...pointAt(along(guard, g, 2.1)), rx: 0.6, ry: 0.6, rz: 0.6, material: IRON },
      // The blade: broad at the shoulder, narrowing to the point.
      ...limb(along(guard, d, 0.4), along(guard, d, 10), 0.75, 0.5, STEEL, 0.3),
      ...limb(along(guard, d, 10), along(guard, d, 12.4), 0.5, 0.18, STEEL, 0.3),
      fist(f.hand),
    ];
    return { solids };
  },
};

/** A short ash haft with a bearded iron head, hanging head-down. */
const hatchet = heldWeapon((f, d) => {
  const e = underside(d);
  const head = along(f.hand, d, 6.6);
  const solids: Solid[] = [...limb(along(f.hand, d, -1.2), along(f.hand, d, 7.4), 0.55, 0.6, ASH, 0.3)];
  // The head: a poll behind the haft, and the blade widening into a beard below it.
  solids.push({ ...pointAt(along(head, e, -0.9)), rx: 0.8, ry: 0.8, rz: 0.8, material: IRON });
  for (const [t, w] of [[0.3, 0.9], [1.1, 1.1], [1.9, 1.4], [2.7, 1.7]]) {
    for (const k of [-1, 0, 1]) {
      const p = along(along(head, e, t), d, (k * w) / 1.6);
      solids.push({ cx: p[0], cy: p[1], cz: p[2], rx: 0.6, ry: 0.6, rz: 0.6, material: t > 2.5 ? STEEL : IRON });
    }
  }
  return solids;
});

/** A knobbed blackthorn club, thin at the grip and heavy at the end. */
const cudgel = heldWeapon((f, d) => {
  const end = along(f.hand, d, 7.2);
  return [
    ...limb(along(f.hand, d, -1.3), end, 0.5, 1.05, BLACKTHORN, 0.3),
    { ...pointAt(end), rx: 1.55, ry: 1.55, rz: 1.55, material: BLACKTHORN },
    // Knots where the thorns were trimmed.
    ...[[0.9, 0.6, 0], [-0.8, 0.2, 0.7], [0.3, -0.9, -0.6], [-0.4, 0.8, -0.9]].map(([dx, dy, dz]) => ({
      cx: end[0] + dx, cy: end[1] + dy, cz: end[2] + dz, rx: 0.65, ry: 0.65, rz: 0.65, material: [0x6c4a2c, 0x3a2414, 0x8c6440] as Tones,
    })),
  ];
});

/** Two plaited cords from the fist to a leather pouch with a stone in it, swinging at the hero's side. */
const sling: GearLook = {
  model: (f) => {
    const [x, y, z] = f.hand;
    const pouch: V3 = f.pose.sit ? [x - 1.2, y - 3.2, z + 1.4] : [x - 1.2, y - 6.6, z + 0.8 - f.pose.stride * 0.8];
    const cord: Tones = [0xd8bc8c, 0x9a7a50, 0xf0dcb0];
    const solids: Solid[] = [
      ...limb([x - 0.5, y - 1, z], [pouch[0] - 0.4, pouch[1] + 0.6, pouch[2] - 0.5], 0.4, 0.4, cord, 0.3),
      ...limb([x + 0.3, y - 1, z + 0.4], [pouch[0] + 0.4, pouch[1] + 0.6, pouch[2] + 0.5], 0.4, 0.4, cord, 0.3),
      { cx: pouch[0], cy: pouch[1], cz: pouch[2], rx: 1.6, ry: 1.1, rz: 1.6, material: [P.leatherLight, P.leather, 0xb07a4c] },
      { cx: pouch[0], cy: pouch[1] + 0.8, cz: pouch[2], rx: 1, ry: 0.85, rz: 1, material: [P.stoneLight, P.stone, 0xc8c6ce] },
      fist(f.hand),
    ];
    return { solids };
  },
};

/** A small round oak shield rimmed with iron, strapped to the left forearm and carried a little forward. */
const buckler: GearLook = {
  adjust: (l) => ({ ...l, shield: true }),
  model: (f) => {
    const arm = f.arms[1];
    const mid: V3 = [(arm.mid[0] + arm.end[0]) / 2, (arm.mid[1] + arm.end[1]) / 2, (arm.mid[2] + arm.end[2]) / 2];
    // Domed, and faced out and forward, so it reads as a round shield from every side.
    const c: V3 = f.pose.sit ? [mid[0] + 1.4, mid[1] + 0.4, mid[2] + 1] : [mid[0] + 1.4, mid[1], mid[2] + 1.4];
    const out = norm([1, 0, 1]);
    const oak: Tones = [P.plankLight, P.plank, P.logLight];
    const face = (h: Hit): Tones => {
      const facing = h.nx * out[0] + h.nz * out[2];
      if (facing > 0.93) return [P.ironLight, P.iron, 0xc4c4d0];
      if (facing < 0.5) return IRON;
      // Planks running up and down.
      return Math.floor((h.x - h.z + 20) / 1.2) % 2 === 0 ? oak : [P.plank, P.plankDark, P.plankLight];
    };
    return { solids: [{ cx: c[0], cy: c[1], cz: c[2], rx: 2.2, ry: 3.3, rz: 2.2, material: face }] };
  },
};

/** A dented iron kettle helm with a broad brim. Pushes the hood back. */
const ironCap: GearLook = {
  adjust: (l) => ({ ...l, hoodUp: false }),
  model: ({ hy, hz }) => {
    const brimY = hy + 3;
    const metal = (h: Hit): Tones => {
      // A raised ridge front to back over the crown, and a row of rivets round its foot.
      if (Math.abs(h.x) < 0.6 && h.y > brimY + 1.5) return [P.ironLight, P.iron, 0xb4b4c0];
      if (h.y < brimY + 1.2 && Math.floor((Math.atan2(h.z - hz, h.x) + 4) * 4) % 3 === 0) return [P.ironLight, P.iron, 0xb4b4c0];
      return IRON;
    };
    const solids: Solid[] = [
      { cx: 0, cy: brimY, cz: hz, rx: 7.8, ry: 0.6, rz: 7.4, material: IRON },
      { cx: 0, cy: hy + 3.6, cz: hz - 0.2, rx: 5.8, ry: 3.8, rz: 5.6, material: metal },
    ];
    return { solids };
  },
};

/** Thick undyed wool: the hood worn up in place of the cloak's, with a short cape over the shoulders. */
const woolHood: GearLook = {
  adjust: (l) => ({ ...l, hoodUp: true, hood: [0xb0a48e, 0x84786a, 0xcfc4ae] }),
  model: ({ b }) => {
    const wool: Tones = [0xb0a48e, 0x84786a, 0xcfc4ae];
    const solids: Solid[] = [
      { cx: 0, cy: 25.2 - b, cz: 0.4, rx: 6.4, ry: 2.2, rz: 4.4, material: wool },
      { cx: 0, cy: 23.6 - b, cz: 0.6, rx: 6.6, ry: 1.4, rz: 4.5, material: wool },
    ];
    return { solids };
  },
};

/** The linen tunic: its hem showing below the vest to mid-thigh, and patches at the elbows. */
const tunic: GearLook = {
  model: ({ pose, arms, b }) => {
    const solids: Solid[] = [];
    if (pose.sit) solids.push({ cx: 0, cy: 10.4, cz: 2.2, rx: 4.9, ry: 1.2, rz: 4.4, material: LINEN });
    else for (let y = 9; y <= 11.5; y += 0.5) solids.push({ cx: 0, cy: y - b * 0.5, cz: pose.stride * 0.2, rx: 5 + (11.5 - y) * 0.16, ry: 0.8, rz: 3.7, material: LINEN });
    const details: Detail[] = arms.map((a) => ({ x: a.mid[0] + a.side * 1.5, y: a.mid[1], z: a.mid[2] - 0.6, color: P.linenDark }));
    return { solids, details };
  },
};

/** Boiled leather over a padded lining: a stiff, dark jerkin with stitched panels and shoulder caps, to the hip. */
const jerkin: GearLook = {
  model: ({ pose, b }) => {
    const leather: Tones = [0x4e3a2e, 0x30241c, 0x6c5646];
    const seam: Tones = [0xb08a5c, 0x7e603e, 0xd0aa78];
    const sit = !!pose.sit;
    const paint = (h: Hit): Tones => {
      if (Math.abs(h.y - (15.4 - b)) < 0.6) return [P.leatherDark, 0x2e1a0e, P.leather];
      // Stitched seams: one down each side of the chest, and one round the ribs.
      if (h.nz > 0.2 && Math.abs(Math.abs(h.x) - 2.2) < 0.35) return seam;
      if (Math.abs(h.y - (20.4 - b)) < 0.3) return seam;
      return leather;
    };
    const solids: Solid[] = [];
    if (sit) solids.push({ cx: 0, cy: 11.4, cz: 1.6, rx: 4.9, ry: 1.4, rz: 4.2, material: paint });
    else for (let y = 10.5; y <= 14.5; y += 0.5) solids.push({ cx: 0, cy: y - b * 0.5, cz: pose.stride * 0.2, rx: 4.9 + (14.5 - y) * 0.16, ry: 0.8, rz: 3.75, material: paint });
    solids.push({ cx: 0, cy: 14.4 - b * (sit ? 1 : 0.5), cz: 0, rx: 4.8, ry: 2.7, rz: 3.7, material: paint });
    solids.push({ cx: 0, cy: 18.2 - b, cz: 0.1, rx: 4.9, ry: 3.5, rz: 3.8, material: paint });
    solids.push({ cx: 0, cy: 22.2 - b, cz: 0.2, rx: 5.3, ry: 4.4, rz: 3.9, material: paint });
    for (const side of [-1, 1]) solids.push({ cx: side * 4.8, cy: 24.6 - b, cz: 0.2, rx: 2.6, ry: 1.9, rz: 2.6, material: leather });
    // Brass rivets on the shoulder caps.
    const details: Detail[] = [-1, 1].map((side) => ({ x: side * 5.6, y: 25.8 - b, z: 1.6, color: P.gold }));
    return { solids, details };
  },
};

/** The hero's own scuffed leather boots, turned down at the ankle. */
const boots: GearLook = {
  model: ({ legs, pose }) => {
    const solids: Solid[] = [];
    for (const l of legs) {
      if (!pose.sit) solids.push({ cx: l.ankle[0], cy: l.ankle[1], cz: l.ankle[2], rx: 1.95, ry: 1.2, rz: 1.95, material: HERO_BOOTS });
      solids.push({ cx: l.foot[0], cy: l.foot[1], cz: l.foot[2], rx: 1.8, ry: 1.4, rz: 2.7, material: HERO_BOOTS });
    }
    return { solids };
  },
};

/** Tall boots of dark oiled leather, laced up the front to the knee, with a turned-down top. */
const ridingBoots: GearLook = {
  model: ({ legs, pose }) => {
    const oiled: Tones = [0x40261a, 0x26160e, 0x684430];
    const cuff: Tones = [0x5a3624, 0x3a2216, 0x7e5640];
    const solids: Solid[] = [];
    const details: Detail[] = [];
    for (const l of legs) {
      // The shaft runs from the foot up the shin to just under the knee.
      const bottom: V3 = [l.ankle[0], l.foot[1] + 1.2, l.ankle[2]];
      const top: V3 = pose.sit
        ? [l.knee[0], l.knee[1] - 1.2, l.knee[2] + 0.1]
        : [l.hip[0], 10.4 - pose.bob * 0.2, l.ankle[2] + (l.hip[2] - l.ankle[2]) * 0.75];
      solids.push(...limb(bottom, top, 2.05, 2.15, oiled, 0.4));
      solids.push({ cx: top[0], cy: top[1] + 0.2, cz: top[2], rx: 2.4, ry: 0.9, rz: 2.4, material: cuff });
      solids.push({ cx: l.foot[0], cy: l.foot[1], cz: l.foot[2], rx: 1.85, ry: 1.45, rz: 2.75, material: oiled });
      for (let t = 0.15; t < 0.9; t += 0.18) {
        const p = along(bottom, [top[0] - bottom[0], top[1] - bottom[1], top[2] - bottom[2]], t);
        details.push({ x: p[0], y: p[1], z: p[2] + 2.15, color: P.linen });
      }
    }
    return { solids, details };
  },
};

/** What each item looks like worn. Add an entry here to dress the hero in new gear. */
export const GEAR_LOOKS: Partial<Record<ItemId, GearLook>> = {
  'walking-staff': walkingStaff,
  'straw-hat': strawHat,
  'iron-cap': ironCap,
  'wool-hood': woolHood,
  tunic,
  jerkin,
  boots,
  'riding-boots': ridingBoots,
  'hunting-knife': huntingKnife,
  'short-sword': shortSword,
  buckler,
  spear,
  hatchet,
  sling,
  cudgel,
};

/** A solid's centre at a point (the rest filled in by the caller). */
function pointAt(p: V3): { cx: number; cy: number; cz: number } {
  return { cx: p[0], cy: p[1], cz: p[2] };
}

/** Layering order, from the body outwards: what's worn goes on before what's held. */
const LAYER_ORDER: EquipSlot[] = ['body', 'feet', 'hands', 'cloak', 'neck', 'ring', 'trinket', 'head', 'offHand', 'mainHand'];

/** The looks of whatever the hero is wearing and carrying, in layering order. */
export function dressed(equipped: Partial<Record<EquipSlot, ItemId>>): GearLook[] {
  return LAYER_ORDER.map((slot) => equipped[slot] && GEAR_LOOKS[equipped[slot]]).filter((g): g is GearLook => !!g);
}
