import type { Tones } from './character';
import { Detail, Hit, limb, Model, Pose3D, Solid } from './figure3d';
import { PALETTE as P } from './palette';
import { MORTEN } from './tollgate';

/**
 * The people modelled in 3D (see figure3d.ts), one builder each: given a pose,
 * the solids that make them up. They're switched over from the flat-part
 * figures in folk.ts one at a time.
 */

/**
 * Godric, landlord of the Crooked Tankard: a stout man in shirt sleeves rolled
 * to the elbow, a maroon waistcoat, and a long white apron over maroon breeches.
 */
export function landlordModel(pose: Pose3D): Model {
  const shirt: Tones = [0xe8dcc4, 0xbcae94, 0xfff8ea];
  const apron: Tones = [0xece4d4, 0xbfb29a, 0xfffaf0];
  const maroon: Tones = [0x7a2e2e, 0x521c1e, 0x9a4040];
  const skin: Tones = [0xe8a888, 0xbf8064, 0xf8c4a4];
  const hair: Tones = [0x7a5232, 0x553620, 0x96683e];
  const boots: Tones = [P.barkDark, P.ink, P.bark];
  const b = pose.bob;
  const s = pose.stride;
  const solids: Solid[] = [];

  // Boots, stepping forward and back under the apron.
  for (const side of [-1, 1]) {
    const swing = s * side;
    solids.push({ cx: side * 2.4, cy: 1.3 + (swing < 0 ? 0.8 : 0), cz: 0.9 + swing * 2.4, rx: 1.8, ry: 1.4, rz: 2.6, material: boots });
  }

  // Apron in front, breeches behind: a skirt widening towards the hem.
  const front = (h: Hit): Tones => (h.nz > -0.15 ? apron : maroon);
  for (let y = 3; y <= 15; y += 0.5) {
    const t = (15 - y) / 12;
    solids.push({ cx: 0, cy: y - b * (1 - t), cz: s * 0.4 * t, rx: 5.2 + t * 1.3, ry: 0.8, rz: 4.2 + t * 0.8, material: front });
  }

  // Belly and chest: the apron's bib over the belly, the waistcoat above, open over the shirt.
  const torso = (h: Hit): Tones => {
    if (h.nz > 0.55 && Math.abs(h.nx) < 0.3 && h.y > 21 - b) return shirt;
    if (h.y < 18.5 - b && h.nz > -0.15) return apron;
    return maroon;
  };
  solids.push({ cx: 0, cy: 17.5 - b, cz: 0.5, rx: 5.6, ry: 4.4, rz: 4.7, material: torso });
  solids.push({ cx: 0, cy: 22.5 - b, cz: 0, rx: 5.6, ry: 5, rz: 4, material: torso });

  // Shoulders, then arms swinging opposite the legs; sleeves rolled to the elbow.
  for (const side of [-1, 1]) {
    const swing = -s * side * 2;
    solids.push({ cx: side * 5.2, cy: 25 - b, cz: 0, rx: 2.6, ry: 2.4, rz: 2.6, material: shirt });
    const elbow: [number, number, number] = [side * 6.6, 20.5 - b, swing * 0.5];
    solids.push(...limb([side * 5.8, 24.5 - b, 0], elbow, 2, 1.8, shirt));
    solids.push(...limb(elbow, [side * 6.8, 16.6 - b, 0.8 + swing], 1.6, 1.5, skin));
    solids.push({ cx: side * 6.8, cy: 15.6 - b, cz: 1 + swing, rx: 1.8, ry: 1.9, rz: 1.8, material: skin });
  }

  // Neck and head: hair over the crown and back, a full beard over the jaw.
  const hy = 33 - b;
  solids.push({ cx: 0, cy: 27.5 - b, cz: 0, rx: 2.4, ry: 2, rz: 2.4, material: skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (py > 2.4 || (h.nz < -0.35 && py > -3)) return hair;
    // The beard: jaw and chin, leaving the cheeks and mouth.
    if (py < -1.6 && h.nz > -0.3) return hair;
    if (py < -0.4 && h.nz > -0.3 && Math.abs(h.nx) > 0.55) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: 0.2, rx: 5.8, ry: 6.2, rz: 5.4, material: head });
  // Nose and ears, which give the head its turn.
  solids.push({ cx: 0, cy: hy + 0.2, cz: 5.6, rx: 1, ry: 1.2, rz: 1, material: skin });
  for (const side of [-1, 1]) solids.push({ cx: side * 5.3, cy: hy - 0.2, cz: 0.4, rx: 0.8, ry: 1.2, rz: 0.9, material: skin });

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 2.1, y: hy + 1.4, z: 5.2, color: P.eye });
  // Brass buttons down the waistcoat.
  for (const y of [21, 23.5]) details.push({ x: 2.4, y: y - b, z: 3.8, color: P.gold });
  return { solids, details };
}

/** Folk drawn from a 3D model instead of their outfit in folk.ts, by id. */
export const MODELS_3D: Record<string, (pose: Pose3D) => Model> = {
  landlord: landlordModel,
  baker: bakerModel,
  smith: smithModel,
  tanner: tannerModel,
  guard: guardModel,
  tollguard: tollGuardModel,
  iran: iranModel,
  porter: porterModel,
};

/** A dusting of flour: a scattered few points of a surface, the same every time it's drawn. */
function dusted(h: Hit, amount = 0.14): boolean {
  const n = Math.sin(Math.floor(h.x * 1.3) * 12.9898 + Math.floor(h.y * 1.3) * 78.233 + Math.floor(h.z * 1.3) * 37.719) * 43758.5453;
  return n - Math.floor(n) > 1 - amount;
}

/**
 * Hilde, Adowvale's baker: a rose dress with the sleeves pushed up, a long
 * flour-dusted apron, and fair hair pinned up in a bun.
 */
export function bakerModel(pose: Pose3D): Model {
  const dress: Tones = [0xb0605a, 0x844440, 0xc87a70];
  const apron: Tones = [0xece4d4, 0xbfb29a, 0xfffaf0];
  const flour: Tones = [0xfff8ee, 0xe0d6c4, 0xffffff];
  const dressDusted: Tones = [0xc88a80, 0xa06a62, 0xdca096];
  const skin: Tones = [0xf2caa4, 0xc89c7a, 0xffe0c0];
  const hair: Tones = [0xd8b060, 0xa8843e, 0xf0d080];
  const boots: Tones = [P.leatherDark, P.barkDark, P.leather];
  const b = pose.bob;
  const s = pose.stride;
  const solids: Solid[] = [];

  for (const side of [-1, 1]) {
    const swing = s * side;
    solids.push({ cx: side * 2.1, cy: 1.2 + (swing < 0 ? 0.8 : 0), cz: 0.8 + swing * 2.2, rx: 1.6, ry: 1.3, rz: 2.3, material: boots });
  }

  // A full skirt to the ankles, the apron over its front; flour on both.
  const skirt = (h: Hit): Tones => {
    const front = h.nz > 0.1 && Math.abs(h.nx) < 0.75 && h.y < 15;
    if (front) return dusted(h) ? flour : apron;
    return dusted(h, 0.05) ? dressDusted : dress;
  };
  for (let y = 3; y <= 15; y += 0.5) {
    const t = (15 - y) / 12;
    solids.push({ cx: 0, cy: y - b * (1 - t), cz: s * 0.4 * t, rx: 4.4 + t * 1.8, ry: 0.8, rz: 3.6 + t * 1.2, material: skirt });
  }

  // Bodice, the apron's bib over its front and the strings tied round the waist.
  const bodice = (h: Hit): Tones => {
    if (Math.abs(h.y - (16 - b)) < 0.6) return apron;
    if (h.nz > 0.35 && Math.abs(h.nx) < 0.45 && h.y < 23 - b) return dusted(h) ? flour : apron;
    return dress;
  };
  solids.push({ cx: 0, cy: 16.5 - b, cz: 0, rx: 4.3, ry: 3, rz: 3.5, material: bodice });
  solids.push({ cx: 0, cy: 21.5 - b, cz: 0.2, rx: 4.8, ry: 4.8, rz: 3.7, material: bodice });

  // Sleeves pushed up to the elbow, floury forearms.
  for (const side of [-1, 1]) {
    const swing = -s * side * 2;
    solids.push({ cx: side * 4.5, cy: 24.5 - b, cz: 0, rx: 2.2, ry: 2.1, rz: 2.2, material: dress });
    const elbow: [number, number, number] = [side * 5.8, 20.3 - b, swing * 0.5];
    solids.push(...limb([side * 5, 24 - b, 0], elbow, 1.8, 1.6, dress));
    solids.push(...limb(elbow, [side * 6, 16.8 - b, 0.8 + swing], 1.4, 1.3, (h) => (dusted(h) ? flour : skin)));
    solids.push({ cx: side * 6, cy: 15.9 - b, cz: 1 + swing, rx: 1.6, ry: 1.7, rz: 1.6, material: skin });
  }

  // Head: fair hair swept back from the face into a bun.
  const hy = 32.5 - b;
  solids.push({ cx: 0, cy: 27 - b, cz: 0, rx: 2, ry: 2, rz: 2, material: skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (py > 2.2 || h.nz < -0.25) return hair;
    if (Math.abs(h.nx) > 0.72 && py > -1.5) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: 0.2, rx: 5.4, ry: 5.9, rz: 5.2, material: head });
  solids.push({ cx: 0, cy: hy + 2, cz: -4.9, rx: 2.6, ry: 2.4, rz: 2.2, material: hair });
  solids.push({ cx: 0, cy: hy - 0.2, cz: 5.2, rx: 0.8, ry: 1, rz: 0.8, material: skin });

  const details: Detail[] = [];
  for (const side of [-1, 1]) {
    details.push({ x: side * 2, y: hy + 1.2, z: 5, color: P.eye });
    // Rosy cheeks from the oven.
    details.push({ x: side * 2.6, y: hy - 0.8, z: 4.7, color: 0xe08a7a });
  }
  details.push({ x: 0, y: hy - 2.4, z: 5, color: 0xb05a50 }); // mouth
  return { solids, details };
}

/**
 * Osric the smith: a big, bald man with a black beard, in a grey work shirt
 * with the sleeves rolled up over thick forearms, and a scorched leather
 * apron from chest to knee.
 */
export function smithModel(pose: Pose3D): Model {
  const shirt: Tones = [0x6e6a62, 0x4a4640, 0x8a867c];
  const leather: Tones = [0x4e3626, 0x2e1e16, 0x6a4c36];
  const scorch: Tones = [0x2a1c16, 0x1a1210, 0x3a2a20];
  const trouser: Tones = [0x3a3032, 0x241c1e, 0x50444a];
  const skin: Tones = [0xd8a07a, 0xa87454, 0xf0bc96];
  const beard: Tones = [0x2a2024, 0x18121a, 0x3e3238];
  const boots: Tones = [P.barkDark, P.ink, P.bark];
  const b = pose.bob;
  const s = pose.stride;
  const solids: Solid[] = [];

  // Legs in dark breeches, boots stepping out.
  for (const side of [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 ? 0.9 : 0;
    const foot: [number, number, number] = [side * 2.6, 3.4 + lift, swing * 2.4];
    solids.push(...limb([side * 2.6, 13 - b * 0.5, 0], foot, 2.3, 2, trouser));
    solids.push({ cx: side * 2.6, cy: 1.4 + lift, cz: 0.9 + swing * 2.4, rx: 2, ry: 1.5, rz: 2.8, material: boots });
  }

  // A barrel of a body; the apron hangs over its front from chest to knee.
  const apron = (h: Hit): boolean => h.nz > 0.05 && Math.abs(h.nx) < 0.8 && h.y > 7 && h.y < 25 - b;
  // Its straps cross over his back.
  const strap = (h: Hit): boolean => h.nz < -0.1 && h.y > 17 - b && h.y < 26.5 - b && Math.abs(Math.abs(h.x) - (h.y - (17 - b)) * 0.55) < 0.8;
  const body = (h: Hit): Tones => (apron(h) ? (dusted(h, 0.08) ? scorch : leather) : strap(h) ? leather : shirt);
  solids.push({ cx: 0, cy: 14 - b * 0.5, cz: 0, rx: 5, ry: 3, rz: 3.8, material: (h) => (apron(h) ? leather : trouser) });
  solids.push({ cx: 0, cy: 18 - b, cz: 0.3, rx: 5.8, ry: 4.4, rz: 4.6, material: body });
  solids.push({ cx: 0, cy: 22.8 - b, cz: 0, rx: 6.6, ry: 4.8, rz: 4.4, material: body });
  // The apron's skirt, standing a little proud of the legs.
  for (let y = 7.5; y <= 13; y += 0.5) {
    const t = (13 - y) / 5.5;
    solids.push({ cx: 0, cy: y, cz: 2.2 + t * 0.4 + s * 0.3 * t, rx: 5 + t * 0.4, ry: 0.8, rz: 1.6, material: (h) => (dusted(h, 0.08) ? scorch : leather) });
  }

  // Broad shoulders, sleeves rolled up over thick bare forearms.
  for (const side of [-1, 1]) {
    const swing = -s * side * 2;
    solids.push({ cx: side * 6.2, cy: 25 - b, cz: 0, rx: 3, ry: 2.6, rz: 2.9, material: shirt });
    const elbow: [number, number, number] = [side * 7.6, 20.2 - b, swing * 0.5];
    solids.push(...limb([side * 6.8, 24.4 - b, 0], elbow, 2.4, 2.1, shirt));
    solids.push(...limb(elbow, [side * 7.8, 16.4 - b, 0.8 + swing], 2, 1.8, skin));
    solids.push({ cx: side * 7.8, cy: 15.2 - b, cz: 1 + swing, rx: 2, ry: 2.1, rz: 2, material: skin });
  }

  // Bald head over a thick neck, and a full black beard.
  const hy = 32.6 - b;
  solids.push({ cx: 0, cy: 27.6 - b, cz: 0.2, rx: 3, ry: 2.2, rz: 2.8, material: skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (py < -1.2 && h.nz > -0.35) return beard;
    if (py < 0.2 && h.nz > -0.35 && Math.abs(h.nx) > 0.6) return beard;
    return skin;
  };
  solids.push({ cx: 0, cy: hy - 0.3, cz: 0.2, rx: 5.7, ry: 5.6, rz: 5.4, material: head });
  // The beard spreads over the chest a little.
  solids.push({ cx: 0, cy: hy - 5, cz: 3, rx: 3.6, ry: 2.4, rz: 2.2, material: beard });
  solids.push({ cx: 0, cy: hy + 0.2, cz: 5.5, rx: 1.1, ry: 1.2, rz: 1, material: skin });
  for (const side of [-1, 1]) solids.push({ cx: side * 5.3, cy: hy - 0.2, cz: 0.4, rx: 0.8, ry: 1.2, rz: 0.9, material: skin });

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 2.1, y: hy + 1.4, z: 5.2, color: P.eye });
  // A heavy brow over the eyes.
  for (const side of [-1, 1]) details.push({ x: side * 2.1, y: hy + 2.4, z: 5.1, color: 0x8a5a40 });
  return { solids, details };
}

/**
 * Tamsin the tanner: slight and quick, with red hair to the shoulders, a
 * belted green jerkin over linen sleeves, and a short brown cloak.
 */
export function tannerModel(pose: Pose3D): Model {
  const jerkin: Tones = [0x4e6a3a, 0x344a26, 0x6a8a4e];
  const linen: Tones = [P.linen, P.linenDark, 0xfff6e6];
  const cloak: Tones = [0x7a5434, 0x52381f, 0x96704a];
  const trouser: Tones = [0x5a4634, 0x3a2c22, 0x70583f];
  const belt: Tones = [P.leatherDark, P.barkDark, P.leather];
  const skin: Tones = [0xf0c8a6, 0xc89a78, 0xffe2c4];
  const hair: Tones = [0xb04a24, 0x7e3218, 0xd06636];
  const boots: Tones = [P.leather, P.leatherDark, P.leatherLight];
  const b = pose.bob;
  const s = pose.stride;
  const solids: Solid[] = [];

  for (const side of [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 ? 0.9 : 0;
    solids.push(...limb([side * 2.2, 13 - b * 0.5, 0], [side * 2.2, 3.6 + lift, swing * 2.4], 1.9, 1.6, trouser));
    // Boots to mid-calf.
    solids.push(...limb([side * 2.2, 6 + lift, swing * 2.4], [side * 2.2, 2.6 + lift, swing * 2.4], 1.9, 1.8, boots));
    solids.push({ cx: side * 2.2, cy: 1.3 + lift, cz: 0.8 + swing * 2.4, rx: 1.7, ry: 1.3, rz: 2.5, material: boots });
  }

  // The jerkin to the hips, belted at the waist, laced up the front.
  const body = (h: Hit): Tones => {
    if (Math.abs(h.y - (16.2 - b)) < 0.7) return belt;
    if (h.nz > 0.75 && Math.abs(h.nx) < 0.15 && h.y > 17 - b) return linen;
    return jerkin;
  };
  solids.push({ cx: 0, cy: 13.6 - b * 0.5, cz: 0, rx: 4.4, ry: 2.6, rz: 3.4, material: body });
  solids.push({ cx: 0, cy: 17 - b, cz: 0, rx: 4.3, ry: 3.4, rz: 3.3, material: body });
  solids.push({ cx: 0, cy: 21.8 - b, cz: 0, rx: 4.9, ry: 4.6, rz: 3.6, material: body });

  // A short cloak over the shoulders, hanging to the small of the back, swinging as they walk.
  for (let y = 15; y <= 25; y += 0.5) {
    const t = (25 - y) / 10;
    solids.push({ cx: 0, cy: y - b, cz: -2.2 - t * 1.2 - Math.abs(s) * t * 0.8, rx: 5.4 + t * 0.9, ry: 0.8, rz: 2.4, material: cloak });
  }

  for (const side of [-1, 1]) {
    const swing = -s * side * 2;
    solids.push({ cx: side * 4.6, cy: 24.6 - b, cz: 0, rx: 2.3, ry: 2.2, rz: 2.3, material: cloak });
    const elbow: [number, number, number] = [side * 5.6, 20.2 - b, swing * 0.5];
    solids.push(...limb([side * 5, 24 - b, 0], elbow, 1.7, 1.5, linen));
    solids.push(...limb(elbow, [side * 5.8, 16.6 - b, 0.8 + swing], 1.5, 1.4, linen));
    solids.push({ cx: side * 5.8, cy: 15.6 - b, cz: 1 + swing, rx: 1.5, ry: 1.6, rz: 1.5, material: skin });
  }

  // Head: red hair to the shoulders, parted at the front.
  const hy = 32.4 - b;
  solids.push({ cx: 0, cy: 27 - b, cz: 0, rx: 2, ry: 2, rz: 2, material: skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (py > 2.4 || h.nz < -0.15) return hair;
    if (Math.abs(h.nx) > 0.62) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: 0.2, rx: 5.4, ry: 5.8, rz: 5.2, material: head, soft: true });
  // Hair falling behind the ears to the shoulders.
  solids.push(...limb([0, hy - 1, -2], [0, hy - 5.6, -2.6], 4.6, 3.6, hair));
  solids.push({ cx: 0, cy: hy - 0.2, cz: 5.2, rx: 0.8, ry: 1, rz: 0.8, material: skin });

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 2, y: hy + 1.2, z: 5, color: P.eye });
  // Freckles.
  for (const side of [-1, 1]) details.push({ x: side * 2.7, y: hy - 0.6, z: 4.6, color: 0xc88660 });
  details.push({ x: 0, y: hy - 2.4, z: 5, color: 0xb86a58 }); // mouth
  return { solids, details };
}

/** Mail: rows of rings, light and dark by turns. */
function mailRings(h: Hit, mail: Tones, ring: Tones): Tones {
  return (Math.floor(h.x * 0.9 + h.z * 0.9) + Math.floor(h.y * 1.1)) % 2 ? mail : ring;
}

/** How a spearman is turned out: the militia, or Lord Morten's men at the toll gate. */
interface SoldierLook {
  tabard: Tones;
  /** The tabard's hem. */
  trim: Tones;
  helm: Tones;
  trouser: Tones;
  skin: Tones;
  hair: Tones;
  boots: Tones;
  beard?: Tones;
  /** A cloak hanging from the shoulders. */
  cloak?: Tones;
  /** The badge on the chest: its colour, and its pixels (x, y offsets). */
  badge: { color: number; at: Array<[number, number]> };
}

const MILITIA: SoldierLook = {
  tabard: [0x2e4a7a, 0x1e3256, 0x40629a],
  trim: [P.gold, 0xb08830, P.goldLight],
  helm: [P.ironLight, P.iron, P.stoneLight],
  trouser: [0x3a3032, 0x241c1e, 0x50444a],
  skin: [P.skin, P.skinShade, 0xf4cfa8],
  hair: [0x4a3020, 0x2e1e14, 0x664430],
  boots: [P.leatherDark, P.barkDark, P.leather],
  badge: { color: P.gold, at: [[0, 23], [0, 22], [-1, 22], [1, 22], [0, 21]] },
};

/** Lord Morten's toll guards: a blackened helm, mail under his crimson, a black cloak, and black beards. */
const TOLL_GUARD: SoldierLook = {
  tabard: [MORTEN.crimson, MORTEN.crimsonDark, MORTEN.crimsonLight],
  trim: [MORTEN.black, 0x18141a, 0x3a343c],
  helm: [0x4e4a56, 0x36323e, 0x6a6672],
  trouser: [0x2a2224, 0x1d1620, 0x3a3034],
  skin: [0xd8a482, 0xb07a5a, 0xecbc9a],
  hair: [0x2a2024, 0x18121a, 0x3e3238],
  boots: [P.barkDark, P.ink, P.bark],
  beard: [0x2a2024, 0x18121a, 0x3e3238],
  cloak: [MORTEN.black, 0x18141a, 0x3a343c],
  // A black lozenge.
  badge: { color: MORTEN.black, at: [[0, 23.5], [-1, 22.5], [0, 22.5], [1, 22.5], [-1, 21.5], [0, 21.5], [1, 21.5], [0, 20.5]] },
};

/** The village militia: a kettle helm with a wide brim, a shirt of mail, a blue tabard edged in gold, and a spear. */
export function guardModel(pose: Pose3D): Model {
  return soldierModel(pose, MILITIA);
}

/** Lord Morten's men at the toll gate. */
export function tollGuardModel(pose: Pose3D): Model {
  return soldierModel(pose, TOLL_GUARD);
}

/** A spearman in a kettle helm and a tabard over mail, spear in the right hand. */
function soldierModel(pose: Pose3D, look: SoldierLook): Model {
  const { tabard, helm, trouser, skin, hair, boots } = look;
  const gold = look.trim;
  const mail: Tones = [P.ironLight, P.iron, 0x9a9aa6];
  const ring: Tones = [P.iron, 0x34343c, P.ironLight];
  const shaft: Tones = [P.bark, P.barkDark, P.barkLight];
  const b = pose.bob;
  const s = pose.stride;
  const solids: Solid[] = [];

  for (const side of [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 ? 0.9 : 0;
    solids.push(...limb([side * 2.4, 13 - b * 0.5, 0], [side * 2.4, 3.6 + lift, swing * 2.4], 2, 1.7, trouser));
    solids.push({ cx: side * 2.4, cy: 1.3 + lift, cz: 0.8 + swing * 2.4, rx: 1.8, ry: 1.4, rz: 2.6, material: boots });
  }

  // The tabard over the mail, front and back, to mid-thigh with a gold hem; mail shows at the sides.
  const body = (h: Hit): Tones => {
    if (Math.abs(h.y - (16 - b)) < 0.6) return [P.leatherDark, P.barkDark, P.leather];
    if (Math.abs(h.nx) > 0.72) return mailRings(h, mail, ring);
    if (h.y < 11.4) return gold;
    return tabard;
  };
  for (let y = 10.5; y <= 14; y += 0.5) {
    solids.push({ cx: 0, cy: y - b * 0.5, cz: s * 0.3 * (14 - y) / 3.5, rx: 4.9, ry: 0.8, rz: 3.8, material: body });
  }
  solids.push({ cx: 0, cy: 17 - b, cz: 0, rx: 4.8, ry: 3.6, rz: 3.6, material: body });
  solids.push({ cx: 0, cy: 22 - b, cz: 0, rx: 5.4, ry: 4.8, rz: 3.9, material: body });

  // A cloak hanging from the shoulders to the backs of the knees.
  if (look.cloak) {
    for (let y = 8; y <= 25; y += 0.5) {
      const t = (25 - y) / 17;
      solids.push({ cx: 0, cy: y - b * (1 - t), cz: -2.6 - t * 1.4 - Math.abs(s) * t, rx: 5.6 + t * 1.2, ry: 0.8, rz: 2.4, material: look.cloak });
    }
  }

  // Mail sleeves; the right hand (screen-left, facing us) holds the spear.
  let spearHand: [number, number, number] = [0, 0, 0];
  for (const side of [-1, 1]) {
    const holding = side === -1;
    const swing = holding ? 0 : -s * side * 2;
    solids.push({ cx: side * 5.2, cy: 24.8 - b, cz: 0, rx: 2.5, ry: 2.3, rz: 2.5, material: (h) => mailRings(h, mail, ring) });
    const elbow: [number, number, number] = [side * 6.6, 20.4 - b, holding ? 0.8 : swing * 0.5];
    const hand: [number, number, number] = holding ? [side * 7.4, 19.4 - b, 1.8] : [side * 6.6, 16.6 - b, 0.8 + swing];
    solids.push(...limb([side * 5.6, 24.2 - b, 0], elbow, 1.9, 1.7, (h) => mailRings(h, mail, ring)));
    solids.push(...limb(elbow, hand, 1.7, 1.5, (h) => mailRings(h, mail, ring)));
    solids.push({ cx: hand[0], cy: hand[1] - 0.8, cz: hand[2], rx: 1.6, ry: 1.7, rz: 1.6, material: skin });
    if (holding) spearHand = hand;
  }

  // The spear, butt on the ground, planted ahead as they walk; an iron leaf at the top.
  const [sx, , sz] = spearHand;
  const top = 43.5 - b;
  const pole = [...limb([sx, 0.5, sz - s * 0.6], [sx, top - 3, sz], 0.6, 0.6, shaft, 0.4), ...limb([sx, top - 3.4, sz], [sx, top, sz], 1.1, 0.4, helm, 0.4)];
  solids.push(...pole.map((p) => ({ ...p, soft: true })));

  // Head under a kettle helm: a wide brim round a rounded crown.
  const hy = 32.4 - b;
  solids.push({ cx: 0, cy: 27 - b, cz: 0, rx: 2.2, ry: 2, rz: 2.2, material: skin });
  const beard = look.beard;
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (beard && h.nz > -0.35 && (py < -1.6 || (py < 0 && Math.abs(h.nx) > 0.6))) return beard;
    if (h.nz < -0.2 || (Math.abs(h.nx) > 0.66 && py > -2)) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: 0.2, rx: 5.4, ry: 5.8, rz: 5.2, material: head, soft: true });
  solids.push({ cx: 0, cy: hy + 0.2, cz: 5.3, rx: 0.9, ry: 1.1, rz: 0.9, material: skin });
  solids.push({ cx: 0, cy: hy + 4.4, cz: 0, rx: 8.4, ry: 0.9, rz: 7.8, material: helm });
  solids.push({ cx: 0, cy: hy + 5, cz: -0.2, rx: 5.6, ry: 4.2, rz: 5.4, material: helm });

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 2, y: hy + 0.9, z: 5, color: P.eye });
  // A gold emblem on the chest.
  for (const [x, y] of look.badge.at) details.push({ x, y: y - b, z: 3.9, color: look.badge.color });
  return { solids, details };
}

/**
 * Farmer Iran: weathered and a little stooped, in a battered straw hat, a
 * grey beard, and an undyed wool smock tied at the waist with rope.
 */
export function iranModel(pose: Pose3D): Model {
  const smock: Tones = [0x9a8a6a, 0x6e6048, 0xb4a682];
  const sleeve: Tones = [0x7a5a3a, 0x54402a, 0x94704a];
  const rope: Tones = [0xc8b07a, 0x9a8458, 0xe0c890];
  const trouser: Tones = [0x4e4234, 0x342a20, 0x645440];
  const skin: Tones = [0xc8906a, 0x9c6a4c, 0xe0a882];
  const hair: Tones = [0x3a2e28, 0x241c18, 0x504038];
  const beard: Tones = [0x8a807a, 0x625a56, 0xa8a09a];
  const straw: Tones = [P.straw, P.strawDark, P.strawLight];
  const boots: Tones = [P.barkDark, P.ink, P.bark];
  const b = pose.bob;
  const s = pose.stride;
  const solids: Solid[] = [];

  for (const side of [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 ? 0.9 : 0;
    solids.push(...limb([side * 2.3, 12 - b * 0.5, 0], [side * 2.3, 3.6 + lift, swing * 2.4], 2, 1.7, trouser));
    solids.push({ cx: side * 2.3, cy: 1.3 + lift, cz: 0.8 + swing * 2.4, rx: 1.8, ry: 1.4, rz: 2.7, material: boots });
  }

  // The smock: loose, to mid-thigh, gathered at the waist by a rope.
  const body = (h: Hit): Tones => (Math.abs(h.y - (17 - b)) < 0.6 ? rope : smock);
  for (let y = 9; y <= 16; y += 0.5) {
    const t = (16 - y) / 7;
    solids.push({ cx: 0, cy: y - b * 0.5, cz: s * 0.3 * t, rx: 4.9 + t * 0.8, ry: 0.8, rz: 3.9 + t * 0.5, material: smock });
  }
  solids.push({ cx: 0, cy: 17.4 - b, cz: 0.1, rx: 4.8, ry: 2.6, rz: 3.8, material: body });
  // Stooped: the chest and shoulders lean a little forward.
  solids.push({ cx: 0, cy: 22 - b, cz: 0.5, rx: 5.3, ry: 4.6, rz: 3.9, material: body });

  for (const side of [-1, 1]) {
    const swing = -s * side * 2;
    solids.push({ cx: side * 4.9, cy: 24.6 - b, cz: 0.5, rx: 2.4, ry: 2.2, rz: 2.4, material: smock });
    const elbow: [number, number, number] = [side * 6, 20.2 - b, 0.6 + swing * 0.5];
    solids.push(...limb([side * 5.4, 24 - b, 0.5], elbow, 1.8, 1.6, sleeve));
    solids.push(...limb(elbow, [side * 6.2, 16.6 - b, 1.4 + swing], 1.6, 1.5, sleeve));
    solids.push({ cx: side * 6.2, cy: 15.6 - b, cz: 1.6 + swing, rx: 1.7, ry: 1.8, rz: 1.7, material: skin });
  }

  // Head pushed forward, grey beard, and the hat.
  const hy = 31.8 - b;
  const hz = 1.2;
  solids.push({ cx: 0, cy: 27 - b, cz: 0.8, rx: 2.1, ry: 2, rz: 2.1, material: skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (h.nz > -0.35 && (py < -1.6 || (py < 0 && Math.abs(h.nx) > 0.6))) return beard;
    if (h.nz < -0.2 || Math.abs(h.nx) > 0.7) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 5.4, ry: 5.8, rz: 5.2, material: head, soft: true });
  solids.push({ cx: 0, cy: hy - 4.6, cz: hz + 2.6, rx: 3.2, ry: 2.2, rz: 2, material: beard });
  solids.push({ cx: 0, cy: hy + 0.2, cz: hz + 5.2, rx: 1, ry: 1.2, rz: 1, material: skin });
  // A battered straw hat: the brim droops on one side, the crown is dented.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const droop = Math.max(0, Math.cos(a - 0.8)) * 1.3;
    solids.push({ cx: Math.cos(a) * 5.6, cy: hy + 3.6 - droop, cz: hz + Math.sin(a) * 5.2, rx: 3, ry: 0.8, rz: 3, material: straw });
  }
  solids.push({ cx: 0, cy: hy + 5, cz: hz - 0.2, rx: 5, ry: 3.4, rz: 4.8, material: (h) => (Math.abs(h.y - (hy + 4)) < 0.5 ? sleeve : straw) });
  solids.push({ cx: 0.8, cy: hy + 7.4, cz: hz, rx: 3.4, ry: 1.6, rz: 3.2, material: straw });

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 2, y: hy + 0.9, z: hz + 5, color: P.eye });
  return { solids, details };
}

/** How one of the brothers of Saint Elda's is turned out. */
interface MonkLook {
  habit: Tones;
  skin: Tones;
  /** The ring of hair round a shaved crown. */
  hair: Tones;
  beard?: Tones;
  boots: Tones;
  /** The cowl up over the head rather than lying on the shoulders. */
  hoodUp?: boolean;
  /** A tall staff in the right hand. */
  staff?: boolean;
  /** A head pushed forward with age. */
  stooped?: boolean;
}

/**
 * A brother of Saint Elda's: a wool habit to the ankles with wide sleeves, a
 * rope cincture, the cowl on the shoulders (or up), and a tonsured head.
 */
function monkModel(pose: Pose3D, look: MonkLook): Model {
  const { habit, skin, hair, boots } = look;
  const rope: Tones = [0xc8b07a, 0x9a8458, 0xe0c890];
  const shaft: Tones = [P.bark, P.barkDark, P.barkLight];
  const b = pose.bob;
  const s = pose.stride;
  const lean = look.stooped ? 1 : 0;
  const solids: Solid[] = [];

  for (const side of [-1, 1]) {
    const swing = s * side;
    solids.push({ cx: side * 2.3, cy: 1.2 + (swing < 0 ? 0.8 : 0), cz: 0.8 + swing * 2.3, rx: 1.7, ry: 1.3, rz: 2.5, material: boots });
  }

  // The habit to the ankles, falling in a fold or two, the rope's end hanging at the front.
  const skirt = (h: Hit): Tones => {
    if (h.nz > 0.6 && Math.abs(h.x - 1.2) < 0.6 && h.y > 9) return rope;
    return habit;
  };
  for (let y = 2.5; y <= 16; y += 0.5) {
    const t = (16 - y) / 13.5;
    solids.push({ cx: 0, cy: y - b * (1 - t), cz: s * 0.4 * t, rx: 4.7 + t * 1.6, ry: 0.8, rz: 3.8 + t * 1.1, material: skirt });
  }
  const body = (h: Hit): Tones => (Math.abs(h.y - (16.6 - b)) < 0.6 ? rope : habit);
  solids.push({ cx: 0, cy: 17 - b, cz: 0, rx: 4.6, ry: 2.8, rz: 3.6, material: body });
  solids.push({ cx: 0, cy: 21.8 - b, cz: lean * 0.5, rx: 5.1, ry: 4.6, rz: 3.8, material: habit });

  // The cowl, lying in folds over the shoulders and back.
  if (!look.hoodUp) {
    solids.push({ cx: 0, cy: 25.6 - b, cz: lean * 0.5 - 1.4, rx: 5.4, ry: 2, rz: 4.2, material: habit });
    solids.push({ cx: 0, cy: 24 - b, cz: lean * 0.5 - 3.4, rx: 3.6, ry: 3, rz: 1.8, material: habit });
  }

  // Wide sleeves; the right hand (screen-left facing us) holds the staff if there is one.
  let staffHand: [number, number, number] | undefined;
  for (const side of [-1, 1]) {
    const holding = !!look.staff && side === -1;
    const swing = holding ? 0 : -s * side * 2;
    solids.push({ cx: side * 4.7, cy: 24.4 - b, cz: lean * 0.5, rx: 2.3, ry: 2.2, rz: 2.3, material: habit });
    const elbow: [number, number, number] = [side * 5.8, 20.4 - b, lean * 0.5 + (holding ? 0.8 : swing * 0.5)];
    const wrist: [number, number, number] = holding ? [side * 6.8, 19.2 - b, 2] : [side * 6.1, 17.4 - b, 1 + lean * 0.5 + swing];
    solids.push(...limb([side * 5.2, 24 - b, lean * 0.5], elbow, 1.8, 1.9, habit));
    solids.push(...limb(elbow, wrist, 2, 2.4, habit));
    const hand = { cx: wrist[0], cy: wrist[1] - 1.2, cz: wrist[2] + 0.2, rx: 1.4, ry: 1.6, rz: 1.4, material: skin };
    solids.push(hand);
    if (holding) staffHand = [hand.cx, hand.cy, hand.cz];
  }
  if (staffHand) {
    const [x, , z] = staffHand;
    const pole = limb([x, 0.4, z - s * 0.6], [x, 37 - b, z], 0.6, 0.6, shaft, 0.4);
    solids.push(...pole.map((p) => ({ ...p, soft: true })));
  }

  // The head: a ring of hair round a shaved crown, or the cowl drawn up over it.
  const hy = 32 - b - lean * 0.4;
  const hz = 0.2 + lean;
  solids.push({ cx: 0, cy: 27 - b, cz: lean * 0.6, rx: 2.1, ry: 2, rz: 2.1, material: skin });
  const beard = look.beard;
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (beard && h.nz > -0.35 && (py < -1.6 || (py < 0 && Math.abs(h.nx) > 0.6))) return beard;
    if (py > 3.6) return skin; // the tonsure
    if (h.nz < -0.2 || (Math.abs(h.nx) > 0.7 && py > -1.5) || py > 2.4) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 5.4, ry: 5.8, rz: 5.2, material: head, soft: true });
  if (beard) solids.push({ cx: 0, cy: hy - 4.6, cz: hz + 2.6, rx: 3, ry: 2.4, rz: 2, material: beard });
  solids.push({ cx: 0, cy: hy + 0.2, cz: hz + 5.2, rx: 0.9, ry: 1.1, rz: 0.9, material: skin });
  if (look.hoodUp) {
    // The cowl drawn up: a deep hood round the face, open at the front.
    for (const [dy, dz, r] of [[0.6, -1.6, 7], [3.4, -2.2, 6.2], [-3.6, -1.6, 6.4]] as const) {
      solids.push({ cx: 0, cy: hy + dy, cz: hz + dz, rx: r, ry: r, rz: r - 0.4, material: habit });
    }
  }

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 2, y: hy + 0.9, z: hz + 5, color: P.eye });
  return { solids, details };
}

/** Brother Wystan, the porter: an old man in a grey-brown habit, white-haired, leaning on his staff. */
export function porterModel(pose: Pose3D): Model {
  return monkModel(pose, {
    habit: [0x5a4636, 0x3c2e24, 0x76604a],
    skin: [0xe2b896, 0xb88c6e, 0xf6d2b2],
    hair: [0xd8d4d0, 0xa8a4a2, 0xf0ece8],
    boots: [P.leatherDark, P.barkDark, P.leather],
    staff: true,
    stooped: true,
  });
}
