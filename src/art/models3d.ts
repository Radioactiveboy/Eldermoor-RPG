import { darker, type Tones } from './character';
import { Detail, Hit, limb, Material, Model, Pose3D, Solid } from './figure3d';
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
  gardener: gardenerModel,
  silent: silentModel,
  novice: noviceModel,
  prior: priorModel,
  anselm: anselmModel,
  cook: cookModel,
  pedlar: pedlarModel,
  pilgrim: pilgrimModel,
  drover: droverModel,
  carter: carterModel,
  herbwife: herbwifeModel,
  nell: nellModel,
  rosie: rosieModel,
  pell: pellModel,
  fisherman: fishermanModel,
  leofric: leofricModel,
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
  /** Tops the staff with a brass knob and makes it taller: a staff of office. */
  office?: boolean;
  /** The beard grown long, down over the chest. */
  longBeard?: boolean;
  /** A leather pouch hanging at the belt. */
  pouch?: boolean;
  /** A long apron over the front of the habit, from the chest down. */
  apron?: Tones;
  /** Sleeves pushed up to the elbow, showing the forearms. */
  rolled?: boolean;
  /** A well-fed belly. */
  stout?: boolean;
  /** The hood (when up) in its own colour: a cloak's hood over the habit or dress. */
  cowl?: Tones;
  /** Wounded: a bandage round the head and the left arm in a sling. */
  bandaged?: boolean;

  /** A head pushed forward with age. */
  stooped?: boolean;
  /** The habit hitched up to the knee for work, showing breeches (in these tones) and boots. */
  hitched?: Tones;
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
  const sit = !!pose.sit;
  const solids: Solid[] = [];

  for (const side of sit ? [] : [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 ? 0.8 : 0;
    if (look.hitched) solids.push(...limb([side * 2.3, 12 - b * 0.5, 0], [side * 2.3, 3.6 + lift, swing * 2.3], 1.9, 1.7, look.hitched));
    solids.push({ cx: side * 2.3, cy: 1.2 + lift, cz: 0.8 + swing * 2.3, rx: 1.7, ry: 1.3, rz: 2.5, material: boots });
  }

  // The habit to the ankles (or the knee, hitched), falling in a fold or two, the rope's end hanging at the front.
  const apron = look.apron;
  const inFront = (h: Hit) => !!apron && h.nz > 0.1 && Math.abs(h.nx) < 0.75;
  const skirt = (h: Hit): Tones => {
    if (inFront(h) && h.y > 4) return apron!;
    if (h.nz > 0.6 && Math.abs(h.x - 1.2) < 0.6 && h.y > 9) return rope;
    return habit;
  };
  const hem = look.hitched ? 8.5 : 2.5;
  if (sit) {
    // Seated: the habit falls over the knees and down the shins to the ankles.
    solids.push(...seatedLegs(2.3, habit, boots, 2.3));
    for (let y = 3; y <= 10; y += 0.5) solids.push({ cx: 0, cy: y, cz: 5.7, rx: 4.6, ry: 0.8, rz: 1.8, material: habit });
  }
  for (let y = sit ? 99 : hem; y <= 16; y += 0.5) {
    const t = ((16 - y) / 13.5) * (look.hitched ? 0.6 : 1);
    solids.push({ cx: 0, cy: y - b * (1 - t), cz: s * 0.4 * t, rx: 4.7 + t * 1.6, ry: 0.8, rz: 3.8 + t * 1.1, material: skirt });
  }
  const body = (h: Hit): Tones => (Math.abs(h.y - (16.6 - b)) < 0.6 ? rope : inFront(h) ? apron! : habit);
  const chest = (h: Hit): Tones => (inFront(h) && h.y < 23.5 - b && Math.abs(h.nx) < 0.5 ? apron! : habit);
  solids.push({ cx: 0, cy: 17 - b, cz: 0, rx: 4.6, ry: 2.8, rz: 3.6, material: body });
  if (look.stout) solids.push({ cx: 0, cy: 18 - b, cz: 0.8, rx: 5.6, ry: 4.4, rz: 4.6, material: body });
  solids.push({ cx: 0, cy: 21.8 - b, cz: lean * 0.5, rx: 5.1, ry: 4.6, rz: 3.8, material: chest });

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
    const elbow: [number, number, number] = sit ? [side * 5.6, 19.6 - b, 2] : [side * 5.8, 20.4 - b, lean * 0.5 + (holding ? 0.8 : swing * 0.5)];
    // Seated, the hands rest on the knees.
    const wrist: [number, number, number] = sit ? [side * 3.8, 13.4, 4.4] : holding ? [side * 6.8, 19.2 - b, 2] : [side * 6.1, 17.4 - b, 1 + lean * 0.5 + swing];
    solids.push(...limb([side * 5.2, 24 - b, lean * 0.5], elbow, 1.8, 1.9, habit));
    if (look.bandaged && side === 1) {
      // The left arm bound across the chest in a linen sling.
      const linen: Tones = [P.linen, P.linenDark, 0xfff6e6];
      solids.push(...limb([side * 5.4, 21 - b, lean * 0.5 + 1], [-1.4, 21.6 - b, 4.2], 1.7, 1.6, linen));
      solids.push(...limb([3.4, 25.6 - b, 2], [-2.6, 20 - b, 4.6], 0.6, 0.6, linen));
      solids.push({ cx: -2, cy: 21.8 - b, cz: 4.6, rx: 1.3, ry: 1.4, rz: 1.3, material: skin });
      continue;
    }
    if (look.rolled) solids.push(...limb(elbow, wrist, 1.5, 1.4, skin));
    else solids.push(...limb(elbow, wrist, 2, 2.4, habit));
    const hand = { cx: wrist[0], cy: wrist[1] - 1.2, cz: wrist[2] + 0.2, rx: 1.4, ry: 1.6, rz: 1.4, material: skin };
    solids.push(hand);
    if (holding) staffHand = [hand.cx, hand.cy, hand.cz];
  }
  if (staffHand) {
    const [x, , z] = staffHand;
    const top = (look.office ? 41 : 37) - b;
    const pole = limb([x, 0.4, z - s * 0.6], [x, top, z], 0.6, 0.6, shaft, 0.4);
    solids.push(...pole.map((p) => ({ ...p, soft: true })));
    if (look.office) solids.push({ cx: x, cy: top + 1, cz: z, rx: 1.3, ry: 1.3, rz: 1.3, material: [P.gold, 0xb08830, P.goldLight] });
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
  if (beard && look.longBeard) solids.push(...limb([0, hy - 5.4, hz + 2.8], [0, 20.5 - b, hz + 3.4], 2.8, 1.2, beard));
  if (look.pouch) solids.push({ cx: 3.4, cy: 14.6 - b, cz: 3, rx: 1.5, ry: 1.8, rz: 1.1, material: [P.leather, P.leatherDark, P.leatherLight] });
  solids.push({ cx: 0, cy: hy + 0.2, cz: hz + 5.2, rx: 0.9, ry: 1.1, rz: 0.9, material: skin });
  if (look.hoodUp) {
    // The cowl drawn up: a deep hood round the face, open at the front.
    // The hood's crown and back sit behind the face; its rim frames it.
    const hood = look.cowl ?? habit;
    solids.push({ cx: 0, cy: hy + 0.8, cz: hz - 1.8, rx: 6.4, ry: 6.6, rz: 5.4, material: hood });
    solids.push({ cx: 0, cy: hy + 5.6, cz: hz - 4.2, rx: 2, ry: 2.2, rz: 2, material: hood });
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI * 0.62 + (i / 12) * Math.PI * 1.24;
      solids.push({ cx: Math.sin(a) * 4.8, cy: hy + 0.2 + Math.cos(a) * 5, cz: hz + 3, rx: 1.8, ry: 1.8, rz: 2, material: hood });
    }
    // Shadow under the hood, on the face.
    solids.push({ cx: 0, cy: hy + 2.4, cz: hz + 3.9, rx: 3.6, ry: 1.2, rz: 1, material: [hood[1], darker(hood[1]), hood[1]] });
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

/** Brother Cuthbert, the gardener: sandy-haired and ruddy, his habit hitched up to the knee for digging. */
export function gardenerModel(pose: Pose3D): Model {
  return monkModel(pose, {
    habit: [0x6a5240, 0x4a3828, 0x866a54],
    skin: [0xe6a882, 0xbc8062, 0xf6c4a0],
    hair: [0xb08a4a, 0x806230, 0xcca464],
    boots: [P.barkDark, P.ink, P.bark],
    hitched: [0x4e3c2e, 0x342820, 0x645040],
  });
}

/** Brother Aldo, under a vow of silence: dark-bearded, in a dark grey habit with the cowl drawn up. */
export function silentModel(pose: Pose3D): Model {
  return monkModel(pose, {
    habit: [0x4e4a46, 0x34302e, 0x66625c],
    skin: [0xb88262, 0x8e5c44, 0xd09a78],
    hair: [0x2a2024, 0x18121a, 0x3e3238],
    beard: [0x2a2024, 0x18121a, 0x3e3238],
    boots: [P.leatherDark, P.barkDark, P.leather],
    hoodUp: true,
  });
}

/** Brother Tobin, a novice: young, freckled and red-haired, in an undyed habit. */
export function noviceModel(pose: Pose3D): Model {
  const model = monkModel(pose, {
    habit: [0x8a7a64, 0x645744, 0xa6967e],
    skin: [P.skin, P.skinShade, 0xf4cfa8],
    hair: [0xb4562a, 0x823c1c, 0xd0703e],
    boots: [P.leather, P.leatherDark, P.leatherLight],
  });
  // Freckles across the nose.
  const hy = 32 - pose.bob;
  for (const side of [-1, 1]) model.details.push({ x: side * 2.6, y: hy - 0.6, z: 4.8, color: 0xc88660 });
  return model;
}

/** Prior Benedict, who rules the house: iron-grey hair, a black habit, and his staff of office. */
export function priorModel(pose: Pose3D): Model {
  return monkModel(pose, {
    habit: [0x2e2a30, 0x1c181e, 0x48424c],
    skin: [0xe0b896, 0xb48c6c, 0xf4d0b0],
    hair: [0x8a8690, 0x625e68, 0xa8a4ae],
    boots: [P.leatherDark, P.barkDark, P.leather],
    staff: true,
    office: true,
  });
}

/** Brother Anselm, the infirmarian and herbalist: an old man in a green-grey habit with a long white beard and a pouch of herbs. */
export function anselmModel(pose: Pose3D): Model {
  return monkModel(pose, {
    habit: [0x5e6a52, 0x434c3a, 0x7a866a],
    skin: [0xe6bc9a, 0xbc9476, 0xf8d6b6],
    hair: [0xe8e4dc, 0xbab6ae, 0xfaf8f2],
    beard: [0xeeeae2, 0xc2beb6, 0xfcfaf6],
    boots: [P.leatherDark, P.barkDark, P.leather],
    stooped: true,
    longBeard: true,
    pouch: true,
  });
}

/** Brother Hob, the cook: a stout, ruddy man with his sleeves rolled and a long apron over his habit. */
export function cookModel(pose: Pose3D): Model {
  return monkModel(pose, {
    habit: [0x6a5240, 0x4a3828, 0x866a54],
    skin: [0xeaa886, 0xc0806a, 0xfac4a2],
    hair: [0x5a3a26, 0x3c2618, 0x74503a],
    boots: [P.barkDark, P.ink, P.bark],
    apron: [0xe4dccc, 0xb8ae9a, 0xf6f0e4],
    rolled: true,
    stout: true,
  });
}

/**
 * Bram the pedlar: a felt hat, a grizzled beard, a long mustard coat open over
 * a russet tunic, and a heavy pack with a bedroll on top and a pan hung at its side.
 */
export function pedlarModel(pose: Pose3D): Model {
  const coat: Tones = [0xa07a34, 0x74561e, 0xc29a4c];
  const tunic: Tones = [0x7a3a2e, 0x562820, 0x9a4e3c];
  const trouser: Tones = [0x5a4634, 0x3a2c22, 0x70583f];
  const skin: Tones = [0xe6b48c, 0xbc8a68, 0xf6cca8];
  const hair: Tones = [0x7a6656, 0x564638, 0x948070];
  const beard: Tones = [0x9a8a7a, 0x706254, 0xb4a696];
  const felt: Tones = [0x5e4a3a, 0x40322a, 0x786050];
  const pack: Tones = [P.leather, P.leatherDark, P.leatherLight];
  const wool: Tones = [P.wool, P.woolDark, 0xd8ccb4];
  const iron: Tones = [P.iron, 0x34343c, P.ironLight];
  const boots: Tones = [P.leatherDark, P.barkDark, P.leather];
  const b = pose.bob;
  const s = pose.stride;
  const solids: Solid[] = [];

  for (const side of [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 ? 0.9 : 0;
    solids.push(...limb([side * 2.3, 12 - b * 0.5, 0], [side * 2.3, 3.6 + lift, swing * 2.4], 2, 1.7, trouser));
    solids.push({ cx: side * 2.3, cy: 1.3 + lift, cz: 0.8 + swing * 2.4, rx: 1.8, ry: 1.4, rz: 2.7, material: boots });
  }

  // The coat to the knee, open down the front over the tunic.
  const open = (h: Hit) => h.z > 1.5 && Math.abs(h.x) < 1.6;
  for (let y = 7; y <= 15; y += 0.5) {
    const t = (15 - y) / 8;
    solids.push({ cx: 0, cy: y - b * 0.5, cz: s * 0.4 * t - t * 0.3, rx: 4.9 + t * 1.2, ry: 0.8, rz: 3.8 + t * 0.6, material: (h) => (open(h) && h.y > 10 ? tunic : coat) });
  }
  const body = (h: Hit): Tones => {
    if (open(h)) return Math.abs(h.y - (16.4 - b)) < 0.6 ? [P.leatherDark, P.barkDark, P.leather] : tunic;
    return coat;
  };
  solids.push({ cx: 0, cy: 17 - b, cz: 0, rx: 4.7, ry: 3, rz: 3.7, material: body });
  solids.push({ cx: 0, cy: 21.8 - b, cz: 0.3, rx: 5.2, ry: 4.6, rz: 3.8, material: body });

  // The pack, the bedroll on top, a pan hanging at its side, and the straps over the shoulders.
  solids.push({ cx: 0, cy: 21 - b, cz: -5.6, rx: 4.4, ry: 5.2, rz: 2.6, material: pack });
  solids.push(...limb([-4.6, 27 - b, -5.4], [4.6, 27 - b, -5.4], 2, 2, wool));
  solids.push({ cx: 4.4, cy: 18.5 - b, cz: -5.8, rx: 0.6, ry: 2.2, rz: 2.2, material: iron });
  for (const side of [-1, 1]) solids.push(...limb([side * 3, 26 - b, -2.4], [side * 3.4, 25.4 - b, 2.8], 0.7, 0.7, pack));

  for (const side of [-1, 1]) {
    const swing = -s * side * 2;
    solids.push({ cx: side * 4.8, cy: 24.6 - b, cz: 0.2, rx: 2.4, ry: 2.2, rz: 2.4, material: coat });
    const elbow: [number, number, number] = [side * 6, 20.3 - b, swing * 0.5];
    solids.push(...limb([side * 5.3, 24 - b, 0.2], elbow, 1.8, 1.7, coat));
    solids.push(...limb(elbow, [side * 6.2, 17 - b, 0.8 + swing], 1.7, 1.8, coat));
    solids.push({ cx: side * 6.2, cy: 15.8 - b, cz: 1 + swing, rx: 1.6, ry: 1.7, rz: 1.6, material: skin });
  }

  // Head: grizzled beard, and a felt hat with a round crown and a narrow brim.
  const hy = 32.2 - b;
  solids.push({ cx: 0, cy: 27 - b, cz: 0.2, rx: 2.1, ry: 2, rz: 2.1, material: skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (h.nz > -0.35 && (py < -1.6 || (py < 0 && Math.abs(h.nx) > 0.6))) return beard;
    if (h.nz < -0.2 || Math.abs(h.nx) > 0.7) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: 0.2, rx: 5.4, ry: 5.8, rz: 5.2, material: head, soft: true });
  solids.push({ cx: 0, cy: hy - 4.6, cz: 2.8, rx: 3.2, ry: 2.4, rz: 2, material: beard });
  solids.push({ cx: 0, cy: hy + 0.2, cz: 5.4, rx: 1, ry: 1.2, rz: 1, material: skin });
  solids.push({ cx: 0, cy: hy + 4.2, cz: 0.2, rx: 7.2, ry: 0.8, rz: 6.8, material: felt });
  solids.push({ cx: 0, cy: hy + 5.4, cz: 0, rx: 5.2, ry: 3.6, rz: 5, material: (h) => (Math.abs(h.y - (hy + 4.8)) < 0.5 ? [P.leatherDark, P.barkDark, P.leather] : felt) });

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 2, y: hy + 1, z: 5.1, color: P.eye });
  return { solids, details };
}

/** Sister Ysolde, a pilgrim: a grey hooded robe, a tall staff, and a scallop shell, the pilgrim's badge, at her breast. */
export function pilgrimModel(pose: Pose3D): Model {
  const model = monkModel(pose, {
    habit: [0x7a7680, 0x58545e, 0x9a96a0],
    skin: [0xeac0a0, 0xc29478, 0xfad6b8],
    hair: [0x3a2a24, 0x241a16, 0x523e34],
    boots: [P.leatherDark, P.barkDark, P.leather],
    hoodUp: true,
    staff: true,
  });
  const b = pose.bob;
  for (const [x, y] of [[1.6, 23], [2.6, 23], [3.4, 22.8], [2, 22], [3, 22], [2.5, 21.2]]) {
    model.details.push({ x, y: y - b, z: 3.6, color: 0xf2e6c8 });
  }
  return model;
}

/**
 * Wil the drover: a lanky lad with a mop of red hair, a belted blue tunic over
 * linen sleeves, and a hazel switch for driving his sheep.
 */
export function droverModel(pose: Pose3D): Model {
  const tunic: Tones = [0x3d5a8a, 0x2a3e62, 0x5577aa];
  const linen: Tones = [P.linen, P.linenDark, 0xfff6e6];
  const trouser: Tones = [0x6b4a30, 0x4a3020, 0x845c3e];
  const belt: Tones = [P.leatherDark, P.barkDark, P.leather];
  const skin: Tones = [P.skin, P.skinShade, 0xf4cfa8];
  const hair: Tones = [0xb4562a, 0x823c1c, 0xd0703e];
  const boots: Tones = [P.leather, P.leatherDark, P.leatherLight];
  const hazel: Tones = [P.bark, P.barkDark, P.barkLight];
  const b = pose.bob;
  const s = pose.stride;
  const solids: Solid[] = [];

  for (const side of [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 ? 0.9 : 0;
    solids.push(...limb([side * 2.1, 13.5 - b * 0.5, 0], [side * 2.1, 3.6 + lift, swing * 2.5], 1.8, 1.5, trouser));
    solids.push(...limb([side * 2.1, 5.6 + lift, swing * 2.5], [side * 2.1, 2.6 + lift, swing * 2.5], 1.8, 1.7, boots));
    solids.push({ cx: side * 2.1, cy: 1.3 + lift, cz: 0.8 + swing * 2.5, rx: 1.6, ry: 1.3, rz: 2.4, material: boots });
  }

  // The tunic to the hips, belted, with the shirt showing at the neck.
  const body = (h: Hit): Tones => {
    if (Math.abs(h.y - (16.4 - b)) < 0.6) return belt;
    if (h.z > 2 && Math.abs(h.x) < 1.6 - (25.5 - b - h.y) * 0.5 && h.y > 23.5 - b) return linen;
    return tunic;
  };
  solids.push({ cx: 0, cy: 13.8 - b * 0.5, cz: 0, rx: 4.3, ry: 2.6, rz: 3.3, material: body });
  solids.push({ cx: 0, cy: 17.2 - b, cz: 0, rx: 4.1, ry: 3.4, rz: 3.2, material: body });
  solids.push({ cx: 0, cy: 22 - b, cz: 0, rx: 4.7, ry: 4.6, rz: 3.5, material: body });

  // Linen sleeves; the right hand (screen-left facing us) carries the switch.
  let switchHand: [number, number, number] = [0, 0, 0];
  for (const side of [-1, 1]) {
    const holding = side === -1;
    const swing = -s * side * 2;
    solids.push({ cx: side * 4.4, cy: 24.6 - b, cz: 0, rx: 2.1, ry: 2.1, rz: 2.1, material: tunic });
    const elbow: [number, number, number] = [side * 5.4, 20.2 - b, holding ? 0.8 : swing * 0.5];
    const wrist: [number, number, number] = holding ? [side * 5.8, 17.6 - b, 2.6] : [side * 5.6, 16.8 - b, 0.8 + swing];
    solids.push(...limb([side * 4.8, 24 - b, 0], elbow, 1.6, 1.4, linen));
    solids.push(...limb(elbow, wrist, 1.4, 1.3, linen));
    solids.push({ cx: wrist[0], cy: wrist[1] - 0.9, cz: wrist[2], rx: 1.4, ry: 1.5, rz: 1.4, material: skin });
    if (holding) switchHand = [wrist[0], wrist[1] - 0.9, wrist[2]];
  }
  // The hazel switch, held low and pointing ahead, flicking as he walks.
  const [hx, hy0, hz0] = switchHand;
  const flick = s * 1.5;
  const sw = limb([hx + 0.6, hy0 + 2, hz0 - 0.6], [hx - 4.5, 3 + Math.abs(flick), hz0 + 3 + flick], 0.55, 0.4, hazel, 0.35);
  solids.push(...sw.map((p) => ({ ...p, soft: true })));

  // Head: a mop of red hair falling over the brow.
  const hy = 32.2 - b;
  solids.push({ cx: 0, cy: 27 - b, cz: 0, rx: 1.9, ry: 2, rz: 1.9, material: skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (py > 1.6 || h.nz < -0.2 || (Math.abs(h.nx) > 0.66 && py > -2.4)) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: 0.2, rx: 5.3, ry: 5.7, rz: 5.1, material: head, soft: true });
  // Tufts sticking up.
  for (const [x, z] of [[-2.2, 1.6], [1.4, 2.4], [2.8, -0.8], [-1, -1.6]]) {
    solids.push({ cx: x, cy: hy + 5, cz: z, rx: 1.8, ry: 1.6, rz: 1.8, material: hair });
  }
  solids.push({ cx: 0, cy: hy - 0.4, cz: 5.1, rx: 0.8, ry: 1, rz: 0.8, material: skin });

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 1.9, y: hy + 0.8, z: 5, color: P.eye });
  details.push({ x: 0.4, y: hy - 2.4, z: 4.9, color: 0xb86a58 }); // a grin
  details.push({ x: -0.6, y: hy - 2.4, z: 4.9, color: 0xb86a58 });
  return { solids, details };
}

/**
 * Odo the carter: a burly man in a flat cap, a brown beard, a russet coat to
 * mid-thigh with a blue neckerchief, and a coiled whip at his belt.
 */
export function carterModel(pose: Pose3D): Model {
  const coat: Tones = [0x8a4a2a, 0x62341c, 0xa8623c];
  const kerchief: Tones = [0x2e5a7a, 0x1e405a, 0x427492];
  const trouser: Tones = [0x4e4234, 0x342a20, 0x645440];
  const skin: Tones = [0xe0a07c, 0xb4785a, 0xf2ba96];
  const hair: Tones = [0x6a4a30, 0x4a321e, 0x845e40];
  const cap: Tones = [0x5a5a3e, 0x3e3e2a, 0x74745a];
  const belt: Tones = [P.leatherDark, P.barkDark, P.leather];
  const boots: Tones = [P.leatherDark, P.barkDark, P.leather];
  const b = pose.bob;
  const s = pose.stride;
  const solids: Solid[] = [];

  for (const side of [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 ? 0.9 : 0;
    solids.push(...limb([side * 2.5, 12 - b * 0.5, 0], [side * 2.5, 3.6 + lift, swing * 2.4], 2.1, 1.8, trouser));
    solids.push({ cx: side * 2.5, cy: 1.4 + lift, cz: 0.9 + swing * 2.4, rx: 1.9, ry: 1.5, rz: 2.8, material: boots });
  }

  // The coat to mid-thigh, belted, buttoned down the front.
  const body = (h: Hit): Tones => (Math.abs(h.y - (16.6 - b)) < 0.6 ? belt : coat);
  for (let y = 9; y <= 15; y += 0.5) {
    const t = (15 - y) / 6;
    solids.push({ cx: 0, cy: y - b * 0.5, cz: s * 0.3 * t, rx: 5.2 + t * 0.6, ry: 0.8, rz: 4 + t * 0.4, material: coat });
  }
  solids.push({ cx: 0, cy: 17 - b, cz: 0.2, rx: 5.2, ry: 3, rz: 4, material: body });
  solids.push({ cx: 0, cy: 21.8 - b, cz: 0.2, rx: 5.8, ry: 4.8, rz: 4, material: body });
  // The neckerchief, knotted at the throat.
  solids.push({ cx: 0, cy: 26 - b, cz: 0.6, rx: 3.2, ry: 1.4, rz: 3, material: kerchief });
  solids.push({ cx: 0.4, cy: 25 - b, cz: 3, rx: 1.1, ry: 1.2, rz: 0.8, material: kerchief });
  // A coiled whip hanging at his left hip.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    solids.push({ cx: 5 + Math.cos(a) * 0.4, cy: 14 - b + Math.sin(a) * 2, cz: 1.2 + Math.cos(a) * 2, rx: 0.7, ry: 0.7, rz: 0.7, material: belt });
  }

  for (const side of [-1, 1]) {
    const swing = -s * side * 2;
    solids.push({ cx: side * 5.4, cy: 24.8 - b, cz: 0.2, rx: 2.6, ry: 2.4, rz: 2.6, material: coat });
    const elbow: [number, number, number] = [side * 6.7, 20.3 - b, swing * 0.5];
    solids.push(...limb([side * 6, 24.2 - b, 0.2], elbow, 2, 1.9, coat));
    solids.push(...limb(elbow, [side * 6.9, 17 - b, 0.8 + swing], 1.9, 2, coat));
    solids.push({ cx: side * 6.9, cy: 15.7 - b, cz: 1 + swing, rx: 1.8, ry: 1.9, rz: 1.8, material: skin });
  }

  // Head: a short brown beard, and a flat cap with its peak over the brow.
  const hy = 32.2 - b;
  solids.push({ cx: 0, cy: 27.4 - b, cz: 0.2, rx: 2.3, ry: 2, rz: 2.3, material: skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (h.nz > -0.35 && (py < -1.8 || (py < -0.2 && Math.abs(h.nx) > 0.6))) return hair;
    if (h.nz < -0.2 || Math.abs(h.nx) > 0.7) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: 0.2, rx: 5.5, ry: 5.8, rz: 5.3, material: head, soft: true });
  solids.push({ cx: 0, cy: hy + 0.2, cz: 5.5, rx: 1.1, ry: 1.2, rz: 1, material: skin });
  solids.push({ cx: 0, cy: hy + 3.4, cz: -0.4, rx: 6, ry: 2.8, rz: 6, material: cap });
  solids.push({ cx: 0, cy: hy + 2.8, cz: 4.6, rx: 4.2, ry: 0.7, rz: 2.4, material: cap });

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 2, y: hy + 0.9, z: 5.1, color: P.eye });
  for (const y of [22, 19.6]) details.push({ x: 0, y: y - b, z: 4.1, color: P.leatherDark });
  return { solids, details };
}

/** Ness the herb-gatherer: a sage-green hooded cloak over a brown dress, a staff, and her basket of herbs on her back. */
export function herbwifeModel(pose: Pose3D): Model {
  const cloak: Tones = [0x6a7a52, 0x4a5838, 0x86966a];
  const wicker: Tones = [0xb08a4e, 0x7e6034, 0xcaa466];
  const herbs: Tones = [0x5a8a3a, 0x3e6628, 0x7aaa52];
  const model = monkModel(pose, {
    habit: [0x7a5a46, 0x564030, 0x96745a],
    skin: [0xd8a888, 0xae8064, 0xeac0a0],
    hair: [0x6a625e, 0x4c4642, 0x847c78],
    boots: [P.leatherDark, P.barkDark, P.leather],
    hoodUp: true,
    staff: true,
    cowl: cloak,
  });
  const b = pose.bob;
  const s = pose.stride;
  // The cloak hangs from the shoulders behind her to the backs of the knees.
  for (let y = 9; y <= 25; y += 0.5) {
    const t = (25 - y) / 16;
    model.solids.push({ cx: 0, cy: y - b * (1 - t), cz: -2.6 - t * 1.6 - Math.abs(s) * t, rx: 5.6 + t * 1.4, ry: 0.8, rz: 2.4, material: cloak });
  }
  for (const side of [-1, 1]) model.solids.push({ cx: side * 4.8, cy: 24.8 - b, cz: 0, rx: 2.6, ry: 2.4, rz: 2.6, material: cloak });
  // The basket on her back, with greenery spilling over its rim.
  const basket = (h: Hit): Tones => ((Math.floor(h.y * 0.9) + Math.floor((h.x + h.z) * 0.6)) % 2 ? wicker : [wicker[1], darker(wicker[1]), wicker[0]]);
  model.solids.push({ cx: 0, cy: 21 - b, cz: -6.4, rx: 3.8, ry: 4.4, rz: 2.6, material: basket });
  for (const [x, z] of [[-2, -6], [0.4, -7], [2.2, -5.8], [-0.6, -5.4]]) {
    model.solids.push({ cx: x, cy: 25.6 - b, cz: z, rx: 1.6, ry: 1.4, rz: 1.6, material: herbs });
  }
  return model;
}

/** How one of the Crooked Tankard's maids is turned out. */
interface MaidLook {
  dress: Tones;
  /** Sleeves, if not the dress's own. */
  sleeves?: Tones;
  skin: Tones;
  hair: Tones;
  /** A long braid down the back, or the hair worn loose to the shoulders. */
  hairStyle: 'braid' | 'loose';
  /** No apron: the dress is worn plain, with a belt at the waist. */
  noApron?: boolean;
}

/**
 * A tavern maid: a dress to the ankles with a white apron and bib over it, a
 * cloth tucked in at the apron strings, and her hair braided or loose.
 */
function maidModel(pose: Pose3D, look: MaidLook): Model {
  const { dress, skin, hair } = look;
  const sleeves = look.sleeves ?? dress;
  const apron: Tones = [0xece4d4, 0xbfb29a, 0xfffaf0];
  const cloth: Tones = [0xc8b48a, 0x9a8862, 0xe0cca2];
  const boots: Tones = [P.leatherDark, P.barkDark, P.leather];
  const b = pose.bob;
  const s = pose.stride;
  const solids: Solid[] = [];

  for (const side of [-1, 1]) {
    const swing = s * side;
    solids.push({ cx: side * 2.1, cy: 1.2 + (swing < 0 ? 0.8 : 0), cz: 0.8 + swing * 2.2, rx: 1.6, ry: 1.3, rz: 2.3, material: boots });
  }

  const front = (h: Hit) => !look.noApron && h.nz > 0.1 && Math.abs(h.nx) < 0.75;
  for (let y = 3; y <= 15; y += 0.5) {
    const t = (15 - y) / 12;
    solids.push({ cx: 0, cy: y - b * (1 - t), cz: s * 0.4 * t, rx: 4.4 + t * 1.8, ry: 0.8, rz: 3.6 + t * 1.2, material: (h) => (front(h) && h.y > 4.5 ? apron : dress) });
  }
  const bodice = (h: Hit): Tones => {
    if (Math.abs(h.y - (16 - b)) < 0.6) return look.noApron ? [P.leatherDark, P.barkDark, P.leather] : apron;
    if (look.noApron) return h.z > 2 && Math.abs(h.x) < 1.8 - (25.5 - b - h.y) * 0.5 && h.y > 23 - b ? sleeves : dress;
    if (h.nz > 0.35 && Math.abs(h.nx) < 0.45 && h.y < 22.5 - b) return apron;
    return dress;
  };
  solids.push({ cx: 0, cy: 16.5 - b, cz: 0, rx: 4.3, ry: 3, rz: 3.5, material: bodice });
  solids.push({ cx: 0, cy: 21.5 - b, cz: 0.2, rx: 4.8, ry: 4.8, rz: 3.7, material: bodice });
  // A cloth tucked in at her left hip.
  solids.push({ cx: 4, cy: 13.6 - b, cz: 1.6, rx: 1.2, ry: 2.4, rz: 1.4, material: cloth });

  for (const side of [-1, 1]) {
    const swing = -s * side * 2;
    solids.push({ cx: side * 4.5, cy: 24.5 - b, cz: 0, rx: 2.2, ry: 2.1, rz: 2.2, material: sleeves });
    const elbow: [number, number, number] = [side * 5.8, 20.3 - b, swing * 0.5];
    solids.push(...limb([side * 5, 24 - b, 0], elbow, 1.8, 1.6, sleeves));
    solids.push(...limb(elbow, [side * 6, 17.2 - b, 0.8 + swing], 1.6, 1.5, sleeves));
    solids.push({ cx: side * 6, cy: 15.9 - b, cz: 1 + swing, rx: 1.5, ry: 1.6, rz: 1.5, material: skin });
  }

  const hy = 32.5 - b;
  solids.push({ cx: 0, cy: 27 - b, cz: 0, rx: 2, ry: 2, rz: 2, material: skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (py > 2.2 || h.nz < -0.25) return hair;
    if (Math.abs(h.nx) > 0.68 && py > -2) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: 0.2, rx: 5.4, ry: 5.9, rz: 5.2, material: head, soft: true });
  if (look.hairStyle === 'braid') {
    // A braid down her back, swinging a little as she walks.
    for (let i = 0; i < 6; i++) {
      solids.push({ cx: (i % 2 ? 0.4 : -0.4) + s * 0.2 * i, cy: hy - 3 - i * 1.7, cz: -4.4 - i * 0.15, rx: 1.3 - i * 0.08, ry: 1.2, rz: 1.2, material: hair });
    }
  } else {
    solids.push(...limb([0, hy - 1, -2], [0, hy - 5.6, -2.6], 4.6, 3.8, hair));
  }
  solids.push({ cx: 0, cy: hy - 0.2, cz: 5.2, rx: 0.8, ry: 1, rz: 0.8, material: skin });

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 2, y: hy + 1.2, z: 5, color: P.eye });
  details.push({ x: 0, y: hy - 2.4, z: 5, color: 0xb05a50 });
  return { solids, details };
}

/** Nell, a tavern maid: a green dress and a white apron, and her auburn hair in a long braid. */
export function nellModel(pose: Pose3D): Model {
  return maidModel(pose, {
    dress: [0x3a6a5a, 0x264a3e, 0x4e8a76],
    skin: [0xf0c4a0, 0xc69a7a, 0xffdcbc],
    hair: [0x9a4426, 0x6e2e18, 0xb85a36],
    hairStyle: 'braid',
  });
}

/** Rosie, the other maid: a wine-red dress over a linen blouse, and fair hair worn loose. */
export function rosieModel(pose: Pose3D): Model {
  return maidModel(pose, {
    dress: [0x8a3a4a, 0x642632, 0xa84e5e],
    sleeves: [0xf0e8d8, 0xc4baa8, 0xfffaf0],
    skin: [0xf4cca8, 0xcaa282, 0xffe2c4],
    hair: [0xe0c070, 0xb09048, 0xf4dc90],
    hairStyle: 'loose',
    noApron: true,
  });
}

/**
 * Pell the minstrel: a motley tunic, teal on one side and mustard on the
 * other, a short mustard cape, plum hose and a plum cap with a feather, and
 * his lute held ready across his chest.
 */
export function pellModel(pose: Pose3D): Model {
  const teal: Tones = [0x2a6a6a, 0x1c4c4c, 0x3a8a8a];
  const mustard: Tones = [0xd8b040, 0xa4842a, 0xecc860];
  const plum: Tones = [0x8a2a4a, 0x641e36, 0xa8405e];
  const skin: Tones = [0xecc0a0, 0xc29878, 0xfad6b8];
  const hair: Tones = [0x6a3a22, 0x4a2816, 0x845036];
  const wood: Tones = [0xc89050, 0x8e6432, 0xe2ac6a];
  const boots: Tones = [P.leather, P.leatherDark, P.leatherLight];
  const b = pose.bob;
  const s = pose.stride;
  const solids: Solid[] = [];
  const motley = (h: Hit): Tones => (h.x > 0 ? teal : mustard);

  for (const side of [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 ? 0.9 : 0;
    solids.push(...limb([side * 2.1, 13.5 - b * 0.5, 0], [side * 2.1, 3.4 + lift, swing * 2.4], 1.8, 1.5, plum));
    // Soft boots, the toes a little pointed.
    solids.push({ cx: side * 2.1, cy: 1.3 + lift, cz: 1.2 + swing * 2.4, rx: 1.5, ry: 1.3, rz: 2.8, material: boots });
  }

  // The tunic to the hips, motley, with a dagged hem.
  solids.push({ cx: 0, cy: 13.6 - b * 0.5, cz: 0, rx: 4.5, ry: 2.6, rz: 3.4, material: (h) => (Math.floor(h.x + h.z + 20) % 3 === 0 && h.y < 12.4 ? plum : motley(h)) });
  solids.push({ cx: 0, cy: 17 - b, cz: 0, rx: 4.2, ry: 3.4, rz: 3.3, material: (h) => (Math.abs(h.y - (16.2 - b)) < 0.6 ? [P.leatherDark, P.barkDark, P.leather] : motley(h)) });
  solids.push({ cx: 0, cy: 21.8 - b, cz: 0, rx: 4.8, ry: 4.6, rz: 3.6, material: motley });
  // A short cape over the shoulders.
  for (let y = 19; y <= 25.5; y += 0.5) {
    const t = (25.5 - y) / 6.5;
    solids.push({ cx: 0, cy: y - b, cz: -2 - t * 1, rx: 5.4 + t * 0.8, ry: 0.8, rz: 2.6, material: mustard });
  }

  // The lute across his chest: the bowl at his belly, the neck up to his right.
  solids.push({ cx: 1.4, cy: 17.4 - b, cz: 4.2, rx: 3.3, ry: 3.6, rz: 1.8, material: wood });
  solids.push(...limb([0, 19.6 - b, 4.4], [-5.6, 25.4 - b, 3.8], 0.8, 0.7, [wood[1], darker(wood[1]), wood[0]], 0.4));
  solids.push({ cx: -6, cy: 25.9 - b, cz: 3.6, rx: 1, ry: 1.1, rz: 0.8, material: [wood[1], darker(wood[1]), wood[0]] });

  // Arms: the right (screen-left) at the neck fretting, the left strumming the bowl.
  for (const side of [-1, 1]) {
    solids.push({ cx: side * 4.5, cy: 24.6 - b, cz: 0, rx: 2.2, ry: 2.1, rz: 2.2, material: side > 0 ? teal : mustard });
    const elbow: [number, number, number] = side < 0 ? [-5.8, 20.6 - b, 2] : [5.6, 19.8 - b, 1.2];
    const hand: [number, number, number] = side < 0 ? [-4.6, 23.6 - b, 4.6] : [2.6, 17.6 - b, 5.4];
    const sleeve = side > 0 ? teal : mustard;
    solids.push(...limb([side * 5, 24 - b, 0], elbow, 1.6, 1.4, sleeve));
    solids.push(...limb(elbow, hand, 1.4, 1.3, sleeve));
    solids.push({ cx: hand[0], cy: hand[1], cz: hand[2], rx: 1.3, ry: 1.4, rz: 1.3, material: skin });
  }

  // Head: a soft plum cap set at an angle, with a feather.
  const hy = 32.2 - b;
  solids.push({ cx: 0, cy: 27 - b, cz: 0, rx: 1.9, ry: 2, rz: 1.9, material: skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (py > 2 || h.nz < -0.2 || (Math.abs(h.nx) > 0.68 && py > -2)) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: 0.2, rx: 5.3, ry: 5.7, rz: 5.1, material: head, soft: true });
  solids.push({ cx: 0, cy: hy - 0.4, cz: 5.1, rx: 0.8, ry: 1, rz: 0.8, material: skin });
  solids.push({ cx: 0.8, cy: hy + 4.2, cz: -0.4, rx: 5.6, ry: 2.6, rz: 5.4, material: plum });
  solids.push({ cx: 3.6, cy: hy + 4.6, cz: -1, rx: 2.6, ry: 1.8, rz: 2.8, material: plum });
  solids.push(...limb([3.6, hy + 5.4, -2.4], [5.8, hy + 9.6, -4.4], 0.8, 0.4, [0xf0ece0, 0xc4beb0, 0xffffff], 0.35));

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 1.9, y: hy + 0.8, z: 5, color: P.eye });
  for (const side of [-1, 1]) details.push({ x: side * 0.6, y: hy - 2.4, z: 4.9, color: 0xb86a58 }); // a smile
  // The lute's sound-hole.
  details.push({ x: 1.4, y: 18.2 - b, z: 6, color: 0x3a2414 });
  return { solids, details };
}

/** Legs for a seated figure: thighs forward from the hips, shins down to the ground, feet flat. */
function seatedLegs(width: number, legs: Material, boots: Material, r = 1.9): Solid[] {
  const out: Solid[] = [];
  const hip = 10;
  for (const side of [-1, 1]) {
    const x = side * width;
    out.push(...limb([x, hip, -0.5], [x, hip + 0.4, 5], r, r * 0.95, legs));
    out.push(...limb([x, hip, 5.4], [x, 3.4, 5.8], r * 0.9, r * 0.8, legs));
    out.push({ cx: x, cy: 1.3, cz: 6.6, rx: r * 0.9, ry: 1.4, rz: 2.6, material: boots });
  }
  return out;
}

/**
 * Old Tobin the fisherman, on his stool watching his float: a sagging oilcloth
 * hat, a white beard, a darned blue-grey jersey and patched breeches, his hands
 * resting on his knees.
 */
export function fishermanModel(pose: Pose3D): Model {
  const jersey: Tones = [0x56687a, 0x3c4a5a, 0x72869a];
  const darn: Tones = [0x6e7e8e, 0x4e5c6a, 0x8a9aaa];
  const breeches: Tones = [0x5e5040, 0x40362a, 0x766650];
  const patch: Tones = [0x7a6a4a, 0x5a4c34, 0x94845e];
  const skin: Tones = [0xd09a76, 0xa47052, 0xe8b490];
  const hair: Tones = [0xd8d4cc, 0xaaa69e, 0xf0ece4];
  const beard: Tones = [0xe4e0d8, 0xb6b2aa, 0xfaf8f2];
  const oilcloth: Tones = [0x6a5e3a, 0x4a4026, 0x847650];
  const boots: Tones = [P.barkDark, P.ink, P.bark];
  const b = pose.bob;
  const s = pose.stride;
  const sit = !!pose.sit;
  const solids: Solid[] = [];
  // A knitted jersey, the rows showing, darned here and there.
  const knit = (h: Hit): Tones => {
    if (dusted(h, 0.06)) return darn;
    return Math.floor(h.y * 1.2) % 2 ? jersey : [jersey[0], jersey[1], jersey[0]];
  };
  const patched = (h: Hit): Tones => (h.z > 3 && h.x > 0.5 && h.x < 3.6 && Math.abs(h.y - (sit ? 10.6 : 8)) < 1.6 ? patch : breeches);

  if (sit) {
    solids.push(...seatedLegs(2.3, patched, boots));
  } else {
    for (const side of [-1, 1]) {
      const swing = s * side;
      const lift = swing < 0 ? 0.9 : 0;
      solids.push(...limb([side * 2.3, 12.5 - b * 0.5, 0], [side * 2.3, 3.6 + lift, swing * 2.4], 2, 1.7, patched));
      solids.push({ cx: side * 2.3, cy: 1.3 + lift, cz: 0.8 + swing * 2.4, rx: 1.8, ry: 1.4, rz: 2.7, material: boots });
    }
  }

  // A round old back under the jersey, hunched a little forward.
  const lean = sit ? 1 : 0.5;
  solids.push({ cx: 0, cy: 14 - b, cz: 0, rx: 4.7, ry: 2.8, rz: 3.6, material: knit });
  solids.push({ cx: 0, cy: 17.6 - b, cz: lean * 0.4, rx: 4.9, ry: 3.4, rz: 3.8, material: knit });
  solids.push({ cx: 0, cy: 22 - b, cz: lean * 0.8, rx: 5.3, ry: 4.6, rz: 3.9, material: knit });
  // A rolled collar.
  solids.push({ cx: 0, cy: 26 - b, cz: lean, rx: 3.4, ry: 1.3, rz: 3.2, material: jersey });

  for (const side of [-1, 1]) {
    const swing = sit ? 0 : -s * side * 2;
    solids.push({ cx: side * 4.8, cy: 24.6 - b, cz: lean, rx: 2.4, ry: 2.2, rz: 2.4, material: knit });
    // Seated, the hands rest on the knees.
    const elbow: [number, number, number] = sit ? [side * 5.6, 19.6 - b, 2] : [side * 6, 20.2 - b, lean + swing * 0.5];
    const hand: [number, number, number] = sit ? [side * 3.6, 12, 4.8] : [side * 6.2, 16.6 - b, 1 + lean + swing];
    solids.push(...limb([side * 5.3, 24 - b, lean], elbow, 1.8, 1.6, knit));
    solids.push(...limb(elbow, hand, 1.6, 1.5, knit));
    solids.push({ cx: hand[0], cy: hand[1] - 0.6, cz: hand[2] + 0.4, rx: 1.6, ry: 1.5, rz: 1.7, material: skin });
  }

  // Head pushed forward: white hair and beard, and the hat's brim sagging all round.
  const hy = 31.6 - b;
  const hz = 1.4;
  solids.push({ cx: 0, cy: 27 - b, cz: hz * 0.6, rx: 2.1, ry: 2, rz: 2.1, material: skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (h.nz > -0.35 && (py < -1.6 || (py < 0 && Math.abs(h.nx) > 0.6))) return beard;
    if (h.nz < -0.2 || Math.abs(h.nx) > 0.7) return hair;
    return skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 5.4, ry: 5.8, rz: 5.2, material: head, soft: true });
  solids.push({ cx: 0, cy: hy - 4.8, cz: hz + 2.6, rx: 3.4, ry: 2.6, rz: 2.2, material: beard });
  solids.push({ cx: 0, cy: hy + 0.2, cz: hz + 5.2, rx: 1.1, ry: 1.2, rz: 1, material: skin });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const sag = 0.8 + Math.max(0, Math.sin(a)) * 0.8;
    solids.push({ cx: Math.cos(a) * 5.4, cy: hy + 3.4 - sag, cz: hz - 0.4 + Math.sin(a) * 5.2, rx: 2.6, ry: 0.8, rz: 2.6, material: oilcloth });
  }
  solids.push({ cx: 0, cy: hy + 4, cz: hz - 0.4, rx: 5.3, ry: 3.6, rz: 5.1, material: oilcloth });

  const details: Detail[] = [];
  for (const side of [-1, 1]) details.push({ x: side * 2, y: hy + 0.9, z: hz + 5, color: P.eye });
  return { solids, details };
}

/** Brother Leofric, mending in the infirmary after the wolves caught him on the road: a bandaged head and his arm in a sling. */
export function leofricModel(pose: Pose3D): Model {
  const model = monkModel(pose, {
    habit: [0x6a5444, 0x4c3c30, 0x86705c],
    skin: [0xd8a07a, 0xac7656, 0xeeb894],
    hair: [0x6a3a22, 0x4a2816, 0x845036],
    boots: [P.leatherDark, P.barkDark, P.leather],
    bandaged: true,
  });
  // A linen bandage wound round his brow, a spot of blood showing at the temple.
  const hy = 32 - pose.bob;
  model.solids.push({ cx: 0, cy: hy + 2.6, cz: 0.2, rx: 5.7, ry: 1.3, rz: 5.5, material: [P.linen, P.linenDark, 0xfff6e6] });
  model.details.push({ x: -3.6, y: hy + 2.6, z: 4.4, color: 0xa0302a });
  return model;
}
