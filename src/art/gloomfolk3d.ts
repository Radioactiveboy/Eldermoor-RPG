import Phaser from 'phaser';
import type { Tones } from './character';
import { BrigandLook, brigandFolkModel } from './brigands3d';
import { Detail, generateFigure3D, Hit, limb, Model, Pose3D, Solid } from './figure3d';
import { FINE_SPEC, fineFace, shade } from './fine3d';
import { asChild, dusted, seatedLegs } from './models3d';
import { PALETTE as P } from './palette';

/**
 * The folk of Gloomhaven (world/GloomhavenMap.ts), drawn finely like the hero,
 * the companions and the jetty's folk (FINE_SPEC in fine3d.ts).
 *
 * On the Fen Gate, the hired heavies and guards Captain Vosk keeps there, drawn
 * on the brigands' frame (brigands3d.ts) in Gloomhaven's own colours: Vosk in
 * a faded black-and-red tabard over mail, scarred, with a falchion; Brakk, a
 * bald slab of a man with tattooed arms and a maul; Fitch, hooded and masked,
 * with a longbow; and Old Crabbe, grey-bearded in a patched jerkin, with a pair of
 * hatchets.
 *
 * And the townsfolk, each modelled here on one frame dressed many ways
 * ({@link townModel}): Mother Ossery, the bent old apothecary in black with her
 * spectacles and a jar of leeches; Hobb Tallow the chandler, stout and bald in a
 * wax-spattered leather apron; Abel Lusk the pawnbroker, tall and thin in black
 * under a wide hat, rings on every finger; Gutter Jack, the town drunk, slumped
 * by the well with his bottle; Wisp, a hooded urchin with quick fingers; and
 * Cray the ferryman, cloaked in black oilskin, leaning on his pole.
 */

type V3 = [number, number, number];

function along(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Every solid and detail scaled about the feet: `k` up, `w` across. */
export function sized(m: Model, k: number, w = k): Model {
  if (k === 1 && w === 1) return m;
  const back = (h: Hit): Hit => ({ ...h, x: h.x / w, y: h.y / k, z: h.z / w });
  return {
    solids: m.solids.map((s) => ({ ...s, cx: s.cx * w, cy: s.cy * k, cz: s.cz * w, rx: s.rx * w, ry: s.ry * k, rz: s.rz * w, material: typeof s.material === 'function' ? ((mat) => (h: Hit) => mat(back(h)))(s.material) : s.material })),
    details: m.details.map((d) => ({ ...d, x: d.x * w, y: d.y * k, z: d.z * w })),
  };
}

// ---------------------------------------------------------------------------
// The gate: Vosk's men, on the brigands' frame
// ---------------------------------------------------------------------------

const MAIL: Tones = [P.ironLight, 0x6a6a76, 0xb8b8c4];
const FUR: Tones = [0x5a4a3a, 0x3a3026, 0x786652];

/** Captain Vosk: a hard, scarred man going grey, mail under a faded black tabard with a red rose, a black cloak, a falchion. */
const VOSK: BrigandLook = {
  skin: [0xd0a084, 0xa47a60, 0xe4b89c],
  hair: [0x2a2226, 0x1a1418, 0x3e3438],
  grey: [0x8a8488, 0x5e5a5e, 0xaaa4a8],
  hairStyle: 'crop',
  beard: 'stubble',
  torso: 'tabard',
  cloth: [0x2a2628, 0x1a1618, 0x3e3a3c],
  trim: [0x8a2a2a, 0x5e1a1c, 0xaa3a38],
  sleeve: MAIL,
  trouser: [0x3a3236, 0x282226, 0x4e4448],
  boot: [0x2e221c, 0x1e1612, 0x463428],
  belt: [0x4a3424, 0x30221a, 0x644a34],
  weapon: 'falchion',
  cloak: [0x26232a, 0x18161c, 0x38343e],
  scar: 0xe8b8a0,
  iris: 0x7a8a8a,
  brow: 0x2a2226,
  lip: 0x8a5048,
  browSlant: 0.6,
  size: 1.04,
};

/** Brakk: a bald slab of a man, bare tattooed arms under a fur-trimmed vest, a broken nose and a maul. */
const BRAKK: BrigandLook = {
  skin: [0xb8866a, 0x8e604a, 0xcc9e80],
  hair: [0x3a2a22, 0x241a14, 0x54402e],
  hairStyle: 'bald',
  beard: 'stubble',
  torso: 'vest',
  cloth: [0x3e3a30, 0x2a2620, 0x565044],
  trim: FUR,
  sleeve: [0xb8866a, 0x8e604a, 0xcc9e80],
  trouser: [0x4a3c30, 0x30261e, 0x625040],
  boot: [0x3a2c22, 0x261c16, 0x54402e],
  belt: [0x2e2218, 0x1e1610, 0x463424],
  weapon: 'maul',
  tattoo: 0x4a2a3a,
  earring: true,
  iris: 0x5a4a3a,
  brow: 0x3a2a22,
  lip: 0x8a5040,
  browSlant: 0.4,
  size: 1.16,
  bulk: 1.26,
};

/** Fitch: thin and watchful, hooded and masked in fen-green, a strapped jerkin, a longbow. */
const FITCH: BrigandLook = {
  skin: [0xe0b898, 0xb8907a, 0xf0d0b0],
  hair: [0x5a4632, 0x3e3020, 0x765e44],
  hairStyle: 'crop',
  beard: 'none',
  torso: 'archer',
  cloth: [0x4a4436, 0x322e24, 0x625a48],
  trim: [0x8a7a5a, 0x5e523a, 0xa8966e],
  sleeve: [0x3e4a36, 0x2a3224, 0x56644a],
  trouser: [0x3e3a34, 0x2a2622, 0x56504a],
  boot: [0x3a2c22, 0x261c16, 0x54402e],
  belt: [0x4a3424, 0x30221a, 0x644a34],
  weapon: 'bow',
  hood: [0x3a4632, 0x262e22, 0x505e46],
  mask: [0x2e3428, 0x1e221a, 0x424a3a],
  iris: 0x8a7a3a,
  brow: 0x5a4632,
  lip: 0xa06a5a,
  browSlant: 0.3,
  bulk: 0.88,
  size: 0.98,
};

/** Old Crabbe: grey-bearded and going bald, a patched leather jerkin, a hatchet in each hand, and a squint. */
const CRABBE: BrigandLook = {
  skin: [0xc89878, 0x9e705a, 0xdcb092],
  hair: [0x8a8480, 0x5e5a56, 0xaaa4a0],
  grey: [0xb8b4ae, 0x8a8680, 0xd4d0ca],
  hairStyle: 'tied',
  beard: 'full',
  torso: 'jerkin',
  cloth: [0x5a4632, 0x3e3022, 0x765e44],
  trim: [0x3a2e24, 0x261e18, 0x524236],
  sleeve: [0x4e4a44, 0x34322e, 0x66625a],
  trouser: [0x463e36, 0x2e2822, 0x5e544a],
  boot: [0x3e2c22, 0x281c16, 0x5a4232],
  belt: [0x3a2a1e, 0x241a12, 0x54402e],
  weapon: 'hatchets',
  iris: 0x6a7a8a,
  brow: 0x8a8480,
  lip: 0x8a5a50,
  browSlant: -0.1,
  size: 0.96,
};

// ---------------------------------------------------------------------------
// The townsfolk
// ---------------------------------------------------------------------------

/** How one of the town's folk is made up (see {@link townModel}). */
export interface TownLook {
  skin: Tones;
  hair: Tones;
  /** Bald on top with a fringe, cropped short, long and lank to the shoulders, pinned up in a knot, or hidden. */
  hairStyle: 'bald' | 'short' | 'lank' | 'knot';
  beard?: 'stubble' | 'full' | 'goatee' | 'matted';
  beardTones?: Tones;
  /** The main garment: a coat to the knee, a smock to the thigh, a dress to the ground. */
  garment: 'coat' | 'smock' | 'dress';
  cloth: Tones;
  /** Its seams, hem and cuffs. */
  seam: Tones;
  /** What shows at the neck and in the coat's opening: a shirt or a waistcoat. */
  under: Tones;
  sleeves?: Tones;
  legs: Tones;
  boots: Tones;
  belt?: Tones;
  apron?: Tones;
  /** A shawl round the shoulders and crossed at the chest. */
  shawl?: Tones;
  /** On the head: a hood up, a wide-brimmed hat, a flat cap, or a kerchief. */
  hat?: 'hood' | 'brim' | 'cap' | 'kerchief';
  hatTones?: Tones;
  /** A cloak to the calf (with the hood, if `hat` is 'hood'). */
  cloak?: Tones;
  /** What the hands are doing. */
  hands: 'side' | 'folded' | 'pole' | 'jar' | 'bottle' | 'ledger';
  /** Patches on the garment, in this colour. */
  patches?: Tones;
  /** How far forward the back bends (0 straight, 2 bent double). */
  hunch?: number;
  /** Wider (stout) or narrower (thin) than most, across the body. */
  girth?: number;
  // The face.
  iris: number;
  brow: number;
  browSlant: number;
  mouth: number;
  smile?: boolean;
  /** Round spectacles; or a single lens in the right eye. */
  specs?: 'pair' | 'monocle';
  /** A red drinker's nose. */
  redNose?: boolean;
  scar?: number;
  freckles?: number;
  /** Anything else, on top. */
  extras?: (hy: number, hz: number, b: number, sit: boolean) => { solids: Solid[]; details: Detail[] };
}

/** A clay bottle's tones, a jar's glass, the brass of rings, the wood of a pole. */
const BOTTLE: Tones = [0x5a4a3a, 0x3a3026, 0x7a6650];
const GLASS: Tones = [0x5a7a6a, 0x3e5a4c, 0x8ab0a0];
const LEECH: Tones = [0x1e1a1e, 0x100e10, 0x3a2e34];
const GOLD: Tones = [P.gold, 0xa8802e, P.goldLight];
const POLE: Tones = [0x6a5a44, 0x46392a, 0x8a765a];
const LEDGER: Tones = [0x5a2a22, 0x3e1c16, 0x7a3a30];
const PAGE: Tones = [0xd8ccb0, 0xaa9e84, 0xf0e6cc];

/**
 * One of Gloomhaven's folk, standing (or sitting): legs in breeches or under a
 * long skirt, a coat, smock or dress with whatever's over it (an apron, a
 * shawl, a cloak), arms doing what their trade has them do, and a head with its
 * hair, beard, hat and face. Patterned on the jetty folk (jettyfolk3d.ts).
 */
export function townModel(pose: Pose3D, look: TownLook): Model {
  const b = pose.bob;
  const s = pose.stride;
  const sit = !!pose.sit;
  const hunch = look.hunch ?? 0;
  const g = look.girth ?? 1;
  const solids: Solid[] = [];
  const details: Detail[] = [];
  const waist = 15.6 - b * (sit ? 1 : 0.5);
  const lean = (sit ? 0.9 : 0.3) + hunch;
  const sleeves = look.sleeves ?? look.cloth;
  const patched = (base: Tones) => (h: Hit): Tones => {
    if (!look.patches) return base;
    const px = Math.floor(h.x * 0.45 + 7);
    const py = Math.floor(h.y * 0.35);
    const n = Math.sin(px * 12.9898 + py * 78.233 + Math.floor(h.z * 0.4) * 3.1) * 43758.5453;
    return n - Math.floor(n) > 0.9 ? look.patches : base;
  };
  const clothAt = (h: Hit): Tones => {
    // Mud spattered round the hem, wet dark at the bottom.
    if (h.y < 6 && dusted(h, 0.3)) return [0x3a3024, 0x271f17, 0x4e463a];
    if (Math.abs(Math.abs(h.nx) - 0.84) < 0.05 && look.garment !== 'dress') return look.seam;
    return patched(look.cloth)(h);
  };

  // ---- Legs, or the skirt over them.
  if (look.garment === 'dress') {
    if (sit) {
      solids.push(...seatedLegs(2.2 * g, look.cloth, look.boots));
    } else {
      for (let y = 1.2; y <= 15; y += 0.6) {
        const flare = (15 - y) * 0.16;
        solids.push({ cx: 0, cy: y - b * 0.4, cz: s * 0.2 * (15 - y) / 14 + hunch * 0.2, rx: (4.5 + flare) * g, ry: 0.9, rz: 3.7 + flare * 0.8, material: y < 2.4 ? look.seam : clothAt });
      }
      // The toes of her boots showing under the hem.
      for (const side of [-1, 1]) solids.push({ cx: side * 1.8, cy: 0.9, cz: 2.8 + s * side * 1.2, rx: 1.3, ry: 0.9, rz: 1.6, material: look.boots });
    }
  } else if (sit) {
    solids.push(...seatedLegs(2.3 * g, look.legs, look.boots));
  } else {
    for (const side of [-1, 1]) {
      const swing = s * side;
      const lift = swing < 0 ? 0.9 : 0;
      const hip: V3 = [side * 2.3 * g, 12.5 - b * 0.5, 0];
      const ankle: V3 = [side * 2.3 * g, 3.4 + lift, swing * 2.3];
      solids.push(...limb(hip, ankle, 1.95 * g, 1.6, look.legs));
      // Boots to mid-calf, scuffed.
      solids.push(...limb(along(hip, ankle, 0.62), ankle, 1.8, 1.7, look.boots));
      solids.push({ cx: side * 2.3 * g, cy: 1.2 + lift, cz: 0.9 + swing * 2.3, rx: 1.7, ry: 1.25, rz: 2.6, material: look.boots });
    }
  }

  // ---- The garment's skirts: a coat to the knee, a smock to mid-thigh.
  if (!sit && look.garment !== 'dress') {
    const hem = look.garment === 'coat' ? 7 : 10.5;
    for (let y = hem; y <= 14.5; y += 0.5) {
      const flare = (14.5 - y) * 0.16;
      solids.push({
        cx: 0, cy: y - b * 0.5, cz: s * 0.25 * (14.5 - y) / 7 + hunch * 0.3, rx: (4.9 + flare) * g, ry: 0.8, rz: (3.8 + flare * 0.6) * Math.min(1.2, g),
        material: (h) => (y < hem + 0.6 ? look.seam : look.garment === 'coat' && h.nz > 0.7 && Math.abs(h.x) < 0.5 ? look.seam : clothAt(h)),
      });
    }
  } else if (sit && look.garment === 'coat') {
    solids.push({ cx: 0, cy: 10.6, cz: 2.6, rx: 5 * g, ry: 1.4, rz: 4.4, material: clothAt });
  }

  // ---- The body: the garment over the shirt; an apron; a belt.
  const body = (h: Hit): Tones => {
    if (look.apron && h.nz > 0.35 && Math.abs(h.x) < 3.6 * g && h.y < waist + 6) return dusted(h, 0.12) ? shade(look.apron) : look.apron;
    if (look.belt && Math.abs(h.y - waist) < 0.7) return h.nz > 0.85 && Math.abs(h.x) < 0.7 ? GOLD : look.belt;
    if (look.garment === 'coat') {
      const open = 0.5 + Math.max(0, h.y - waist) * 0.14;
      if (h.nz > 0.5 && Math.abs(h.x) < open && h.y > waist - 1) return look.under;
    }
    if (h.nz > 0.5 && Math.abs(h.x) < 1.2 && h.y > waist + 9) return look.under;
    return clothAt(h);
  };
  const by = (y: number) => y - b * (sit ? 1 : 0.5);
  solids.push({ cx: 0, cy: by(14.6), cz: hunch * 0.3, rx: 4.8 * g, ry: 2.7, rz: 3.7 * Math.min(1.25, g), material: body });
  solids.push({ cx: 0, cy: 18.2 - b, cz: lean * 0.5, rx: 4.8 * g, ry: 3.4, rz: 3.7 * Math.min(1.3, g), material: body });
  solids.push({ cx: 0, cy: 22.2 - b - hunch * 0.6, cz: lean * 0.9, rx: 5.2 * Math.max(0.9, g * 0.95), ry: 4.3, rz: 3.8 * Math.min(1.2, g), material: body });
  if (hunch > 0.6) solids.push({ cx: 0, cy: 22.4 - b - hunch * 0.5, cz: lean - 1.8, rx: 4.6, ry: 3.6, rz: 3, material: body });
  if (look.apron && !sit) {
    // The apron hangs below the waist, to the knee.
    for (let y = 8; y <= waist; y += 0.6) solids.push({ cx: 0, cy: y, cz: 3.4 * Math.min(1.25, g) + 0.4 + hunch * 0.3 + s * 0.15, rx: 3.6 * g, ry: 0.7, rz: 0.6, material: (h) => (dusted(h, 0.15) ? shade(look.apron!) : look.apron!) });
  }
  // The collar at the neck.
  solids.push({ cx: 0, cy: 26 - b - hunch * 0.8, cz: lean + 0.2, rx: 3.2, ry: 1.1, rz: 3, material: look.under });

  // ---- A shawl crossed over the chest, its ends tucked in; a cloak down the back.
  if (look.shawl) {
    const sh = look.shawl;
    solids.push({ cx: 0, cy: 24.4 - b - hunch * 0.7, cz: lean * 0.9 - 0.2, rx: 5.8, ry: 2.6, rz: 4.3, material: (h) => ((Math.floor(h.x * 1.2 + h.y * 1.2) & 1) === 0 ? sh : shade(sh)) });
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        solids.push({ cx: side * (3 - t * 3.4), cy: 23.6 - b - t * 5 - hunch * 0.6, cz: lean + 3 + t * 0.4, rx: 1.4, ry: 1.2, rz: 0.8, material: sh });
      }
    }
    // A fringe at the back, hanging in a point.
    for (let i = 0; i < 5; i++) solids.push({ cx: 0, cy: 21.6 - b - i * 1.2 - hunch * 0.5, cz: lean - 3.6 - hunch * 0.3, rx: 3.4 - i * 0.6, ry: 0.8, rz: 0.8, material: sh });
  }
  if (look.cloak) {
    const ck = look.cloak;
    const flutter = pose.flutter ?? 0;
    for (let y = sit ? 9 : 3; y <= 25; y += 0.7) {
      const t = (25 - y) / 22;
      solids.push({ cx: 0, cy: y - b * (y > 15 ? 1 : 0.5), cz: lean * (y / 25) - 3.4 - t * (1.4 + flutter * 0.5), rx: 5.2 + t * 1.6, ry: 0.9, rz: 1.4, material: (h) => (y < 4 ? shade(ck) : Math.floor(h.x * 0.8 + 9) % 3 === 0 ? shade(ck) : ck) });
    }
    solids.push({ cx: 0, cy: 25 - b - hunch * 0.6, cz: lean - 0.6, rx: 5.6, ry: 2.2, rz: 4.2, material: ck });
  }

  // ---- Arms, and what's in the hands.
  const hy = 32.4 - b - hunch * 1.6;
  const hz = 0.4 + lean + hunch * 0.8;
  for (const side of [-1, 1]) {
    const swing = sit ? 0 : -s * side * 2;
    const shoulder: V3 = [side * 5 * Math.max(0.9, g * 0.95), 24 - b - hunch * 0.8, lean];
    let elbow: V3 = sit ? [side * 5.6, 19.4 - b, lean + 2] : [side * 6 * g, 20.2 - b - hunch * 0.5, lean + swing * 0.5];
    let hand: V3 = sit ? [side * 3.4, 12.6, 4.8] : [side * 6.2 * g, 16.6 - b - hunch * 0.4, 1 + lean + swing];
    const h = look.hands;
    if (h === 'folded') {
      // Arms folded over the chest: each hand tucked under the other arm.
      elbow = [side * 5.8 * g, 19 - b, lean + 2.6];
      hand = [-side * 2.6 * g, 20.6 - b, lean + 4.4 * Math.min(1.2, g)];
    } else if (h === 'pole' && side === -1) {
      elbow = [side * 6.4, 21.6 - b, lean + 2.4];
      hand = [side * 5.6, 24.2 - b, lean + 4.2];
    } else if ((h === 'jar' || h === 'ledger') && side === 1) {
      elbow = [side * 5.8, 19.2 - b - hunch * 0.5, lean + 2];
      hand = [side * 2.6, 18.6 - b - hunch * 0.6, lean + 5.4];
    } else if (h === 'ledger' && side === -1) {
      elbow = [side * 5.8, 19.2 - b, lean + 2];
      hand = [side * 2.2, 18.2 - b, lean + 5.6];
    } else if (h === 'bottle' && side === -1) {
      hand = sit ? [side * 3, 15.4, 6.6] : [side * 4.6, 18.6 - b, lean + 4];
      elbow = sit ? [side * 5.4, 17.6 - b, lean + 2] : elbow;
    }
    solids.push({ cx: side * 4.8 * Math.max(0.9, g * 0.95), cy: 24.6 - b - hunch * 0.8, cz: lean, rx: 2.4, ry: 2.2, rz: 2.4, material: sleeves });
    solids.push(...limb(shoulder, elbow, 1.8, 1.65, sleeves));
    const fore = limb(elbow, hand, 1.65, 1.5, sleeves);
    fore.forEach((f, i) => solids.push(i >= fore.length - 2 ? { ...f, rx: 1.85, ry: 1.85, rz: 1.85, material: look.seam } : f));
    solids.push({ cx: hand[0], cy: hand[1] - 0.7, cz: hand[2] + 0.3, rx: 1.45, ry: 1.5, rz: 1.5, material: look.skin, soft: true });
    if (h === 'ledger' && side === 1) {
      // Rings on the fingers that show.
      for (const dz of [0.6, 1.2]) details.push({ x: hand[0] + 0.6, y: hand[1] - 0.6, z: hand[2] + 1.4 + dz * 0.3, color: P.goldLight, size: 0.5 });
    }
  }
  if (look.hands === 'pole') {
    // A long pole, held upright in the left hand, its foot on the ground beside him.
    solids.push(...limb([-5.6, 0, lean + 5], [-5.6, 44 - b, lean + 3.6], 0.6, 0.55, POLE, 0.45));
  }
  if (look.hands === 'jar') {
    // A glass jar of leeches held against her chest, its lid tied with cloth.
    const j: V3 = [1.6, 19.2 - b - hunch * 0.6, lean + 6.4];
    solids.push({ cx: j[0], cy: j[1], cz: j[2], rx: 1.9, ry: 2.4, rz: 1.8, material: (h) => (h.y > j[1] + 1.8 ? PAGE : Math.abs(h.x - j[0] + Math.sin(h.y * 2) * 0.5) < 0.5 || Math.abs(h.y - j[1] + 0.4) < 0.4 ? LEECH : GLASS) });
    solids.push({ cx: j[0], cy: j[1] + 2.4, cz: j[2], rx: 1.5, ry: 0.5, rz: 1.5, material: [0x8a6a4a, 0x5e4630, 0xa8865e] });
  }
  if (look.hands === 'bottle') {
    const bt: V3 = sit ? [-3, 17.4, 7] : [-4.6, 20.8 - b, lean + 4.4];
    solids.push(...limb([bt[0], bt[1] - 2, bt[2]], [bt[0], bt[1] + 1.4, bt[2]], 1.2, 1.1, BOTTLE, 0.4));
    solids.push(...limb([bt[0], bt[1] + 1.4, bt[2]], [bt[0] + 0.2, bt[1] + 3.2, bt[2] + 0.2], 0.5, 0.4, BOTTLE, 0.3));
  }
  if (look.hands === 'ledger') {
    // A fat ledger held open against his chest, a pen tucked in it.
    solids.push({ cx: 0.2, cy: 19.4 - b, cz: lean + 6.2, rx: 3, ry: 2.2, rz: 0.6, material: (h) => (h.nz > 0.6 && Math.abs(h.x - 0.2) > 0.25 && Math.abs(h.y - 19.4 + b) < 1.8 ? PAGE : LEDGER) });
  }

  // ---- The head.
  solids.push({ cx: 0, cy: 27.2 - b - hunch * 1.1, cz: lean * 0.7 + hunch * 0.4, rx: 2, ry: 2, rz: 2, material: look.skin });
  const beard = look.beardTones ?? look.hair;
  const strands = (h: Hit): Tones => ((Math.floor(h.x * 1.6 + h.y * 0.4) & 1) === 0 ? look.hair : shade(look.hair));
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    const jaw = h.nz > -0.35 && (py < -1.6 || (py < 0 && Math.abs(h.nx) > 0.6));
    if (look.beard === 'full' || look.beard === 'matted') {
      if (jaw) return look.beard === 'matted' && dusted(h, 0.25) ? shade(beard) : beard;
    } else if (look.beard === 'stubble' && jaw && dusted(h, 0.55)) return shade(beard);
    else if (look.beard === 'goatee' && h.nz > 0.6 && Math.abs(h.x) < 1.2 && py < -2.4) return beard;
    if (look.redNose && h.nz > 0.85 && Math.abs(h.x) < 1.6 && Math.abs(py + 0.6) < 1.2) return [0xc86a5a, 0x9a4a40, 0xe08a78];
    switch (look.hairStyle) {
      case 'bald':
        if (py < 1.5 && (h.nz < -0.2 || Math.abs(h.nx) > 0.8)) return strands(h);
        return look.skin;
      case 'short':
        if (h.nz < -0.2 || (Math.abs(h.nx) > 0.78 && py > -1.5) || py > 3) return strands(h);
        return look.skin;
      default:
        if (h.nz < -0.2 || (Math.abs(h.nx) > 0.72 && py > -3.4) || py > 2.8) return strands(h);
        return look.skin;
    }
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 5.1, ry: 5.6, rz: 5, material: head, soft: true });
  solids.push({ cx: 0, cy: hy + 0.1, cz: hz + 5, rx: look.redNose ? 1.15 : 0.85, ry: look.redNose ? 1.3 : 1.1, rz: 0.95, material: look.redNose ? [0xc86a5a, 0x9a4a40, 0xe08a78] : look.skin });
  for (const side of [-1, 1]) solids.push({ cx: side * 5, cy: hy + 0.1, cz: hz + 0.3, rx: 0.7, ry: 1.2, rz: 0.9, material: look.skin });
  if (look.hairStyle === 'lank') {
    // Hair to the shoulders, in lank strands.
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) solids.push({ cx: side * (4.6 - i * 0.1), cy: hy - 1 - i * 1.4, cz: hz - 1.4, rx: 1.3, ry: 1.2, rz: 2.6, material: strands });
    solids.push({ cx: 0, cy: hy - 3, cz: hz - 4.2, rx: 4, ry: 4, rz: 1.6, material: strands });
  } else if (look.hairStyle === 'knot') {
    solids.push({ cx: 0, cy: hy + 3.4, cz: hz - 4.4, rx: 2.2, ry: 2, rz: 2, material: strands });
  }
  if (look.beard === 'full' || look.beard === 'matted') {
    const long = look.beard === 'matted' ? 1.4 : 1;
    solids.push({ cx: 0, cy: hy - 4.4 * long, cz: hz + 2.6, rx: 3.3, ry: 2.6 * long, rz: 2.1, material: (h) => (dusted(h, 0.2) ? shade(beard) : beard) });
  }
  if (look.beard === 'goatee') solids.push({ cx: 0, cy: hy - 4.6, cz: hz + 3.2, rx: 1, ry: 1.6, rz: 0.9, material: beard });

  // ---- Hats.
  const hat = look.hatTones ?? look.cloth;
  if (look.hat === 'hood') {
    const hood = (h: Hit): Tones => (h.nz > 0.55 && Math.abs(h.x) < 3.4 && h.y < hy + 3.6 ? [0x0e0c0e, 0x080608, 0x1a161a] : h.nz > 0.4 && h.y < hy + 4.6 ? shade(hat) : hat);
    solids.push({ cx: 0, cy: hy + 0.6, cz: hz - 0.6, rx: 6.1, ry: 6.6, rz: 6, material: hood });
    solids.push({ cx: 0, cy: hy + 4.6, cz: hz + 2.2, rx: 4.6, ry: 2.2, rz: 4, material: hat });
    // It hangs in a point down the back.
    solids.push({ cx: 0, cy: hy - 2.4, cz: hz - 5.4, rx: 2.6, ry: 3.4, rz: 1.6, material: hat });
  } else if (look.hat === 'brim') {
    const brim = (h: Hit): Tones => (Math.hypot(h.x, h.z - hz) > 7.4 ? shade(hat) : hat);
    solids.push({ cx: 0, cy: hy + 3.8, cz: hz - 0.2, rx: 8.4, ry: 0.7, rz: 8, material: brim });
    solids.push({ cx: 0, cy: hy + 6, cz: hz - 0.3, rx: 4.6, ry: 3, rz: 4.5, material: (h) => (Math.abs(h.y - hy - 4.6) < 0.5 ? [0x3a2a24, 0x241a16, 0x4e3a30] : hat) });
  } else if (look.hat === 'cap') {
    solids.push({ cx: 0.4, cy: hy + 3.8, cz: hz - 0.4, rx: 5.6, ry: 2.4, rz: 5.4, material: (h) => (dusted(h, 0.2) ? shade(hat) : hat) });
    solids.push({ cx: 0, cy: hy + 3, cz: hz + 4.6, rx: 3.4, ry: 0.5, rz: 1.8, material: shade(hat) });
  } else if (look.hat === 'kerchief') {
    solids.push({ cx: 0, cy: hy + 3.2, cz: hz - 0.5, rx: 5.5, ry: 3, rz: 5.3, material: hat });
    solids.push({ cx: 0, cy: hy + 0.4, cz: hz - 5.2, rx: 1.4, ry: 1.1, rz: 0.9, material: shade(hat) });
  }

  // ---- The face.
  details.push(...fineFace(hy, hz, {
    eye: P.eye,
    iris: look.iris,
    brow: look.brow,
    browSlant: look.browSlant,
    browLift: 2.1,
    mouth: look.mouth,
    mouthWidth: look.smile ? 3 : 2,
    smile: look.smile,
    scar: look.scar,
    freckles: look.freckles,
  }, { rx: 5.1, ry: 5.6, rz: 5 }));
  if (look.specs) {
    // Wire spectacles: a ring round each eye (or just the right), and the bridge.
    const sides = look.specs === 'pair' ? [-1, 1] : [-1];
    for (const side of sides) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        details.push({ x: side * 1.9 + Math.cos(a) * 1.15, y: hy + 0.9 + Math.sin(a) * 1.05, z: hz + 5.15, color: look.specs === 'monocle' ? P.goldLight : 0x9a9aa4, size: 0.5 });
      }
    }
    if (look.specs === 'pair') details.push({ x: 0, y: hy + 1.2, z: hz + 5.3, color: 0x9a9aa4, size: 0.5 });
    else for (let i = 0; i < 6; i++) details.push({ x: -3.2 - i * 0.2, y: hy + 0.2 - i * 0.9, z: hz + 4.4 - i * 0.3, color: P.gold, size: 0.5 });
  }
  if (look.extras) {
    const more = look.extras(hy, hz, b, sit);
    solids.push(...more.solids);
    details.push(...more.details);
  }
  return { solids, details };
}

/** Mother Ossery, the apothecary: bent nearly double, in black to the ground under a grey shawl, spectacles, a jar of leeches. */
const OSSERY: TownLook = {
  skin: [0xd8b8a0, 0xa88a76, 0xecd0b8],
  hair: [0xb8b4ac, 0x8a8680, 0xd8d4cc],
  hairStyle: 'knot',
  garment: 'dress',
  cloth: [0x2a2a2e, 0x1a1a1e, 0x3e3e44],
  seam: [0x1a1a1e, 0x101014, 0x2a2a2e],
  under: [0xc8c0aa, 0x9a9282, 0xe0d8c2],
  legs: [0x2a2a2e, 0x1a1a1e, 0x3e3e44],
  boots: [0x2e2420, 0x1e1814, 0x463830],
  shawl: [0x5a5a52, 0x3e3e38, 0x76766c],
  apron: [0x6a6a52, 0x4a4a38, 0x86866a],
  hands: 'jar',
  hunch: 1.6,
  girth: 0.92,
  iris: 0x5a7a5a,
  brow: 0x9a968e,
  browSlant: -0.2,
  mouth: 0x8a5a54,
  smile: true,
  specs: 'pair',
  extras: (hy, hz) => {
    // A string of little bottles and charms round her neck; a wart on her chin.
    const solids: Solid[] = [];
    const details: Detail[] = [{ x: 1.2, y: hy - 3.4, z: hz + 4.4, color: 0x8a6a5a, size: 0.5 }];
    for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * 1.6;
      solids.push({ cx: Math.sin(a) * 3.4, cy: hy - 9.4 - Math.cos(a) * 1.6, cz: hz + 3.4, rx: 0.45, ry: 0.7, rz: 0.45, material: i % 2 ? GLASS : [0xd8d0b8, 0xa8a090, 0xf0e8d0] });
    }
    return { solids, details };
  },
};

/** Hobb Tallow, the chandler: stout and bald, ruddy, a grey fringe and stubble, a leather apron spattered with wax, arms folded. */
const TALLOW: TownLook = {
  skin: [0xe0a88a, 0xb07e66, 0xf2c2a6],
  hair: [0x9a948a, 0x6e6a62, 0xb8b2a8],
  hairStyle: 'bald',
  beard: 'stubble',
  garment: 'smock',
  cloth: [0x6a5a44, 0x4a3e2e, 0x86745a],
  seam: [0x4a3e2e, 0x30281e, 0x5e5040],
  under: [0xc8baa0, 0x9a8e78, 0xe0d4bc],
  sleeves: [0xc8baa0, 0x9a8e78, 0xe0d4bc],
  legs: [0x4a4038, 0x302a24, 0x625648],
  boots: [0x3a2c22, 0x261c16, 0x54402e],
  apron: [0x6a4a32, 0x4a3222, 0x86603e],
  belt: [0x3a2a1e, 0x241a12, 0x54402e],
  hands: 'folded',
  girth: 1.24,
  iris: 0x5a6a7a,
  brow: 0x9a948a,
  browSlant: 0.1,
  mouth: 0xa86a5a,
  smile: true,
  extras: (_hy, _hz, b) => {
    // Drips of tallow down the apron.
    const details: Detail[] = [];
    for (const [x, y] of [[-1.4, 15.8], [1.2, 13.4], [0.2, 17.6], [-2.2, 12.2], [2, 18.8]]) details.push({ x, y: y - b, z: 5.2, color: 0xf0e4c0, size: 0.5 });
    return { solids: [], details };
  },
};

/** Abel Lusk, the pawnbroker: tall and thin in a long black coat, a grey waistcoat, a wide black hat, a monocle, a ledger, rings. */
const LUSK: TownLook = {
  skin: [0xe8d0c0, 0xbaa294, 0xf8e4d6],
  hair: [0x1e1a1c, 0x121012, 0x342e30],
  hairStyle: 'lank',
  beard: 'goatee',
  garment: 'coat',
  cloth: [0x22201e, 0x141210, 0x34302e],
  seam: [0x3a3632, 0x262422, 0x4e4a46],
  under: [0x5a5a5e, 0x3e3e42, 0x76767a],
  legs: [0x2a2826, 0x1a1816, 0x3e3a38],
  boots: [0x1e1816, 0x121010, 0x302826],
  hat: 'brim',
  hatTones: [0x1e1c1e, 0x121012, 0x302e30],
  hands: 'ledger',
  girth: 0.86,
  iris: 0x6a6a5a,
  brow: 0x1e1a1c,
  browSlant: 0.45,
  mouth: 0x8a5a5a,
  smile: true,
  specs: 'monocle',
};

/** Gutter Jack: the town drunk, slumped on the bench by the well in a patched coat and a flat cap, a matted beard, a red nose, his bottle. */
const GUTTER: TownLook = {
  skin: [0xc8987a, 0x9a6e58, 0xdcb092],
  hair: [0x5a4a3a, 0x3e3226, 0x766250],
  beardTones: [0x6a5a48, 0x4a3e30, 0x86745e],
  hairStyle: 'short',
  beard: 'matted',
  garment: 'coat',
  cloth: [0x5a4a36, 0x3e3226, 0x76624a],
  seam: [0x3e3226, 0x2a2218, 0x544430],
  under: [0x8a8070, 0x5e5648, 0xa89c8a],
  legs: [0x4a4440, 0x322e2a, 0x625a54],
  boots: [0x3a2e26, 0x261e18, 0x54443a],
  patches: [0x6e5a3a, 0x4a3c26, 0x8a7450],
  hat: 'cap',
  hatTones: [0x4a4a42, 0x32322c, 0x62625a],
  hands: 'bottle',
  hunch: 0.8,
  iris: 0x6a5a4a,
  brow: 0x5a4a3a,
  browSlant: -0.3,
  mouth: 0x8a5a50,
  smile: true,
  redNose: true,
};

/** Wisp: a girl of ten or so in a too-big hooded cape of fen-green, patched, a quick grin and quicker fingers. */
const WISP: TownLook = {
  skin: [0xf0c8a8, 0xc8a084, 0xffdcc0],
  hair: [0x8a4a26, 0x5e3218, 0xaa6232],
  hairStyle: 'short',
  garment: 'smock',
  cloth: [0x6a5a42, 0x4a3e2c, 0x86745a],
  seam: [0x4a3e2c, 0x30281c, 0x5e503a],
  under: [0xb8ae98, 0x8a8270, 0xd0c6b0],
  legs: [0x4a4440, 0x322e2a, 0x625a54],
  boots: [0x3a2e26, 0x261e18, 0x54443a],
  patches: [0x5a6a3a, 0x3e4a28, 0x76884e],
  hat: 'hood',
  hatTones: [0x3e5232, 0x2a3822, 0x566a46],
  cloak: [0x3e5232, 0x2a3822, 0x566a46],
  hands: 'side',
  iris: 0x6a8a4a,
  brow: 0x8a4a26,
  browSlant: 0.2,
  mouth: 0xb06a5c,
  smile: true,
  freckles: 0xd08a68,
};

/** Cray, the ferryman: tall in a long black oilskin cloak and hood, a grey beard, his pole in his hand. */
const CRAY: TownLook = {
  skin: [0xb88a6c, 0x8a6250, 0xcca080],
  hair: [0x6a6662, 0x4a4642, 0x86827c],
  beardTones: [0x9a968e, 0x6e6a64, 0xb8b4ac],
  hairStyle: 'short',
  beard: 'full',
  garment: 'coat',
  cloth: [0x2a2e2e, 0x1a1e1e, 0x3e4444],
  seam: [0x1a1e1e, 0x101414, 0x2a2e2e],
  under: [0x5a5248, 0x3e3830, 0x766c60],
  legs: [0x3a3632, 0x262420, 0x4e4a46],
  boots: [0x2a2420, 0x1a1614, 0x3e3630],
  hat: 'hood',
  hatTones: [0x2a2e2e, 0x1a1e1e, 0x3e4444],
  cloak: [0x2a2e2e, 0x1a1e1e, 0x3e4444],
  hands: 'pole',
  hunch: 0.4,
  girth: 0.94,
  iris: 0x8a9aa4,
  brow: 0x6a6662,
  browSlant: 0.3,
  mouth: 0x7a5048,
};

/** The folk of Gloomhaven, by folk id. */
export const GLOOM_FOLK: Record<string, (pose: Pose3D) => Model> = {
  vosk: brigandFolkModel(VOSK),
  brakk: brigandFolkModel(BRAKK),
  fitch: brigandFolkModel(FITCH),
  crabbe: brigandFolkModel(CRABBE),
  ossery: (pose) => sized(townModel(pose, OSSERY), 0.94),
  tallow: (pose) => townModel(pose, TALLOW),
  lusk: (pose) => sized(townModel(pose, LUSK), 1.08, 1),
  gutter: (pose) => townModel(pose, GUTTER),
  wisp: (pose) => asChild(townModel(pose, WISP)),
  cray: (pose) => sized(townModel(pose, CRAY), 1.06, 1),
};

/** Draws each of them as 'folk-<id>', finely. */
export function generateGloomFolk(scene: Phaser.Scene): void {
  for (const [id, model] of Object.entries(GLOOM_FOLK)) generateFigure3D(scene, `folk-${id}`, model, FINE_SPEC);
}

