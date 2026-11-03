import type { Tones } from './character';
import { Detail, Hit, limb, Model, Pose3D, Solid } from './figure3d';
import { PALETTE as P } from './palette';

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
