import { darker, type Tones } from './character';
import { Detail, Hit, limb, Model, Pose3D, Solid } from './figure3d';
import { fineFace, shade } from './fine3d';
import { asChild, dusted, seatedLegs } from './models3d';
import { PALETTE as P } from './palette';

/**
 * The folk of Adowvale Jetty (world/JettyMap.ts), drawn finely like the hero
 * and the companions (FINE_SPEC in fine3d.ts): Maren Tull, skipper of the
 * Grey Heron; Old Ebb, who has fished the Wend all his life; and Wren, his
 * granddaughter, who keeps the smokehouse counter.
 */

type V3 = [number, number, number];

function along(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A standing leg: hip to ankle, the foot, and where along it a height falls. */
function standingLeg(x: number, side: number, b: number, s: number): { hip: V3; ankle: V3; foot: V3; at: (y: number) => V3 } {
  const swing = s * side;
  const lift = swing < 0 ? 0.9 : 0;
  const hip: V3 = [x, 12.5 - b * 0.5, 0];
  const ankle: V3 = [x, 3.4 + lift, swing * 2.3];
  const foot: V3 = [x, 1 + lift, 0.9 + swing * 2.3];
  return { hip, ankle, foot, at: (y) => along(hip, ankle, (hip[1] - y) / (hip[1] - ankle[1])) };
}

/** Knitting: rows of stitches, alternate rows a touch darker, so it reads as wool. */
function knit(base: Tones, h: Hit, rib = 1.3): Tones {
  const row = Math.floor(h.y * rib);
  const stitch = Math.floor(h.x * 1.4 + h.z * 1.4 + (row % 2) * 0.5);
  return (row + stitch) % 2 ? base : [base[0], base[1], base[0]];
}

// ---------------------------------------------------------------------------
// Maren Tull
// ---------------------------------------------------------------------------

const MAREN = {
  coat: [0x2e4a48, 0x1e3230, 0x42625e] as Tones,
  coatSeam: [0x1a2a28, 0x101a1a, 0x2a3e3c] as Tones,
  lining: [0x8a3a2a, 0x5e261c, 0xa84c38] as Tones,
  gansey: [0xd8ceb4, 0xaaa088, 0xeee6d0] as Tones,
  scarf: [0xb03a2c, 0x7a261c, 0xd04e3a] as Tones,
  cap: [0x3a527e, 0x26385a, 0x52709c] as Tones,
  trouser: [0x4a4038, 0x322a24, 0x625648] as Tones,
  boot: [0x3a2a20, 0x241a14, 0x54402e] as Tones,
  bootTop: [0x5a4432, 0x3e2e22, 0x765a42] as Tones,
  belt: [0x3e2c1e, 0x281c12, 0x56402c] as Tones,
  brass: [0xc8a048, 0x8a6a2a, 0xecca70] as Tones,
  skin: [0xc8906a, 0x9c6a4c, 0xe0aa84] as Tones,
  hair: [0x2e2220, 0x1c1414, 0x463630] as Tones,
  rope: [0xc0a878, 0x8a764e, 0xd8c498] as Tones,
};

/**
 * Maren Tull, skipper of the Grey Heron: a tall, weathered woman of forty in a
 * long oiled sea-coat of bottle green, its skirts split for walking and lined
 * red, buttoned with brass; a cream gansey knitted in rows under it, a red
 * kerchief knotted at her throat, a blue knitted cap over a thick black plait,
 * a broad belt with a brass buckle and a sheath knife, high sea-boots turned
 * down at the knee, and a coil of rope over her shoulder. Sun-browned, crow's
 * feet, a gold ring in one ear, and a level, measuring look.
 */
export function marenModel(pose: Pose3D): Model {
  const C = MAREN;
  const b = pose.bob;
  const s = pose.stride;
  const sit = !!pose.sit;
  const solids: Solid[] = [];
  const details: Detail[] = [];
  const waist = 15.8 - b * (sit ? 1 : 0.5);

  // Legs: dark canvas trousers into tall sea-boots, their tops turned down in a wide cuff.
  if (sit) {
    solids.push(...seatedLegs(2.2, C.trouser, C.boot, 1.8));
    for (const side of [-1, 1]) {
      solids.push(...limb([side * 2.2, 8.6, 5.7], [side * 2.2, 3.4, 5.8], 1.9, 1.8, C.boot));
      solids.push({ cx: side * 2.2, cy: 8.8, cz: 5.7, rx: 2.2, ry: 0.9, rz: 2.2, material: C.bootTop });
    }
  } else {
    for (const side of [-1, 1]) {
      const leg = standingLeg(side * 2.2, side, b, s);
      solids.push(...limb(leg.hip, leg.ankle, 1.8, 1.5, C.trouser));
      solids.push(...limb(leg.at(8.6), leg.ankle, 1.85, 1.7, C.boot));
      const top = leg.at(8.8);
      solids.push({ cx: top[0], cy: top[1], cz: top[2], rx: 2.15, ry: 0.95, rz: 2.15, material: (h) => (h.y > top[1] + 0.4 ? shade(C.bootTop) : C.bootTop) });
      solids.push({ cx: leg.foot[0], cy: leg.foot[1], cz: leg.foot[2], rx: 1.55, ry: 1, rz: 2.35, material: C.boot });
    }
  }

  // The coat's skirts: long, to the knee, split at the front and the back so
  // the red lining shows as they swing, a darker hem.
  const skirtCloth = (h: Hit, y: number): Tones => {
    const front = h.nz > 0.6;
    if (front && Math.abs(h.x) < 0.55 + (14 - y) * 0.06) return C.lining;
    if (y < 7.6) return C.coatSeam;
    if (Math.abs(Math.abs(h.nx) - 0.82) < 0.05) return C.coatSeam;
    return C.coat;
  };
  if (!sit) {
    for (let y = 7; y <= 14.5; y += 0.5) {
      const flare = (14.5 - y) * 0.2;
      solids.push({
        cx: 0, cy: y - b * 0.5, cz: s * 0.25 * (14.5 - y) / 7 - flare * 0.15, rx: 4.8 + flare, ry: 0.8, rz: 3.8 + flare * 0.7,
        material: (h) => skirtCloth(h, y),
      });
    }
  } else {
    // Seated, the skirts fall either side over the thighs.
    for (const side of [-1, 1]) solids.push({ cx: side * 3.4, cy: 10, cz: 2.2, rx: 2.2, ry: 2.6, rz: 4.6, material: C.coat });
  }

  // The body: the coat open over the gansey, the belt over the coat, the kerchief at the throat.
  const body = (h: Hit): Tones => {
    if (Math.abs(h.y - waist) < 0.75) {
      if (h.nz > 0.85 && Math.abs(h.x) < 0.9) return Math.abs(h.x) < 0.4 && Math.abs(h.y - waist) < 0.4 ? C.belt : C.brass;
      return Math.abs(h.y - waist) > 0.5 ? shade(C.belt) : C.belt;
    }
    // The opening: a V of gansey down the front, widening to the chest.
    const open = 0.6 + Math.max(0, h.y - waist) * 0.16;
    if (h.nz > 0.5 && Math.abs(h.x) < open && h.y > waist) return knit(C.gansey, h);
    // The lapels, turned back and showing the lining at their edge.
    if (h.nz > 0.5 && Math.abs(h.x) < open + 0.45 && h.y > waist + 3.5) return C.lining;
    // Brass buttons down the coat's edge.
    if (Math.abs(Math.abs(h.nx) - 0.82) < 0.05) return C.coatSeam;
    return C.coat;
  };
  solids.push({ cx: 0, cy: 14.6 - b * (sit ? 1 : 0.5), cz: 0, rx: 4.7, ry: 2.6, rz: 3.5, material: body });
  solids.push({ cx: 0, cy: 18.4 - b, cz: 0.1, rx: 4.6, ry: 3.4, rz: 3.5, material: body });
  solids.push({ cx: 0, cy: 22.4 - b, cz: 0.2, rx: 5.1, ry: 4.3, rz: 3.7, material: body });
  for (const side of [-1, 1]) {
    for (const y of [17.6, 19.6, 21.6]) details.push({ x: side * (1.5 + (y - waist) * 0.16), y: y - b, z: 3.55, color: C.brass[2], size: 0.5 });
  }
  // The sheath knife on her right hip, and a pouch on her left.
  if (!sit) solids.push(...limb([-4.1, waist - 0.4, 2.2], [-4.5, waist - 4, 1.9], 0.6, 0.45, C.belt, 0.5));
  solids.push({ cx: -4.1, cy: waist + 0.7, cz: 2.3, rx: 0.5, ry: 0.9, rz: 0.5, material: [0x7a5a3a, 0x56402a, 0x94704a] });
  solids.push({ cx: 3.9, cy: waist - 1.5, cz: 2.3, rx: 1.3, ry: 1.3, rz: 0.8, material: (h) => (h.y > waist - 1 ? shade(C.belt) : C.belt) });
  // The kerchief: knotted at the throat, the ends hanging down in front.
  solids.push({ cx: 0, cy: 26 - b, cz: 0.4, rx: 3.1, ry: 1.2, rz: 3, material: C.scarf });
  solids.push({ cx: 0.5, cy: 25.6 - b, cz: 3.2, rx: 0.9, ry: 0.8, rz: 0.6, material: shade(C.scarf) });
  solids.push({ cx: 0.9, cy: 24.2 - b, cz: 3.6, rx: 0.6, ry: 1.3, rz: 0.4, material: C.scarf });
  // The coat's collar, turned up at the back of the neck.
  solids.push({ cx: 0, cy: 26.4 - b, cz: -1.2, rx: 3.6, ry: 1.5, rz: 2.4, material: (h) => (h.nz > 0.3 ? C.lining : C.coat) });

  // The coil of rope over her left shoulder and across her body to the right hip.
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const p = along([4.4, 25.6 - b, -0.4], [-4.2, waist + 1, 3.3], t);
    solids.push({ cx: p[0], cy: p[1], cz: p[2] + Math.sin(t * Math.PI) * 0.8, rx: 0.95, ry: 0.95, rz: 0.95, material: i % 2 ? C.rope : shade(C.rope) });
  }

  // Arms in the coat's sleeves, turned back at the cuff to the lining; brown hands.
  for (const side of [-1, 1]) {
    const swing = sit ? 0 : -s * side * 2;
    const shoulder: V3 = [side * 5.2, 24.2 - b, 0.2];
    const elbow: V3 = sit ? [side * 5.6, 19.6 - b, 2] : [side * 6, 20.2 - b, 0.3 + swing * 0.5];
    const wrist: V3 = sit ? [side * 3.6, 12.6, 4.6] : [side * 6.3, 16.8 - b, 0.8 + swing];
    solids.push({ cx: side * 4.9, cy: 24.6 - b, cz: 0.2, rx: 2.6, ry: 2.3, rz: 2.6, material: C.coat });
    solids.push(...limb(shoulder, elbow, 1.9, 1.75, C.coat));
    const forearm = limb(elbow, wrist, 1.75, 1.65, C.coat);
    forearm.forEach((f, i) => solids.push(i >= forearm.length - 2 ? { ...f, rx: 1.95, ry: 1.95, rz: 1.95, material: C.lining } : f));
    solids.push({ cx: wrist[0], cy: wrist[1] - 1.1, cz: wrist[2] + 0.3, rx: 1.45, ry: 1.5, rz: 1.55, material: C.skin });
  }

  // Head: a weathered face; the knitted cap pulled down, its crown folded over to one side;
  // black hair under it in a thick plait down her back.
  const hy = 32.6 - b;
  const hz = 0.4;
  solids.push({ cx: 0, cy: 27.2 - b, cz: 0.3, rx: 2, ry: 2, rz: 2, material: C.skin });
  const strands = (h: Hit): Tones => ((Math.floor(h.x * 1.6 + h.y * 0.4) & 1) === 0 ? C.hair : shade(C.hair));
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (h.nz < -0.2 || (Math.abs(h.nx) > 0.75 && py > -2.4)) return strands(h);
    return C.skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 5.1, ry: 5.6, rz: 5, material: head, soft: true });
  solids.push({ cx: 0, cy: hy + 0.1, cz: hz + 5, rx: 0.85, ry: 1.15, rz: 0.9, material: C.skin });
  // Wisps of black hair over the brow, under the cap's band.
  for (const x of [-3.4, -1.6, 2.2, 3.8]) solids.push({ cx: x, cy: hy + 2.5, cz: hz + 3.7, rx: 1.2, ry: 0.7, rz: 0.8, material: C.hair });
  // The cap: a ribbed band round the head and a soft crown, slumped over to her left.
  const rib = (h: Hit): Tones => (Math.floor(Math.atan2(h.x, h.z - hz) * 10) % 2 ? C.cap : shade(C.cap));
  solids.push({ cx: 0, cy: hy + 3.2, cz: hz - 0.1, rx: 5.6, ry: 1.3, rz: 5.4, material: rib });
  solids.push({ cx: 0.4, cy: hy + 4.8, cz: hz - 0.4, rx: 5.2, ry: 2.6, rz: 5, material: (h) => knit(C.cap, h, 1.6) });
  solids.push({ cx: 3, cy: hy + 6.2, cz: hz - 1, rx: 3, ry: 1.6, rz: 3, material: (h) => knit(C.cap, h, 1.6) });
  solids.push({ cx: 5.3, cy: hy + 5.4, cz: hz - 1.2, rx: 1.1, ry: 1.1, rz: 1.1, material: C.scarf });
  // The plait, from under the cap down between her shoulders, tied with red.
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const r = 1.3 - t * 0.35;
    solids.push({ cx: i % 2 ? 0.3 : -0.3, cy: hy - 1.6 - t * 11, cz: hz - 4.8 - (t < 0.3 ? t * 3 : 0.9), rx: r, ry: r * 1.1, rz: r, material: i % 2 ? C.hair : shade(C.hair) });
  }
  solids.push({ cx: 0, cy: hy - 13.4, cz: hz - 5.8, rx: 0.8, ry: 0.55, rz: 0.8, material: C.scarf });
  // A gold ring in her left ear.
  details.push({ x: 5.2, y: hy - 0.6, z: hz + 0.6, color: P.goldLight, size: 0.5 });
  details.push({ x: 5.3, y: hy - 1.1, z: hz + 0.6, color: P.gold, size: 0.5 });

  details.push(...fineFace(hy, hz, {
    eye: P.eye,
    iris: 0x4a6a5a,
    brow: darker(C.hair[0]),
    browSlant: 0.35,
    browLift: 2,
    mouth: 0x9a5a4a,
    mouthWidth: 3,
  }, { rx: 5.1, ry: 5.6, rz: 5 }));
  // Crow's feet at the corners of her eyes, from years of squinting at the water.
  for (const side of [-1, 1]) details.push({ x: side * 3.2, y: hy + 0.8, z: hz + 3.6, color: darker(C.skin[1]), size: 0.5 });
  return { solids, details };
}

// ---------------------------------------------------------------------------
// Old Ebb
// ---------------------------------------------------------------------------

const EBB = {
  smock: [0xa88a4e, 0x7a6236, 0xc4a466] as Tones,
  smockSeam: [0x7a6236, 0x544226, 0x94784a] as Tones,
  shirt: [0x8a8e94, 0x5e6268, 0xa8acb2] as Tones,
  breeches: [0x4e4438, 0x342c24, 0x665a4a] as Tones,
  stocking: [0x7a7266, 0x544e44, 0x948c7e] as Tones,
  clog: [0x8a6a42, 0x5e462a, 0xa8865a] as Tones,
  skin: [0xb8805a, 0x8a5a3e, 0xd09a72] as Tones,
  hair: [0xc8c4bc, 0x9a968e, 0xe4e0d8] as Tones,
  beard: [0xd4d0c8, 0xa6a29a, 0xeeeae2] as Tones,
  net: [0x8a7a5a, 0x5e523a, 0xa8966e] as Tones,
  cork: [0xc89a5a, 0x8e6a3a, 0xe0b678] as Tones,
  red: [0xb8423a, 0x842c26, 0xd85a4e] as Tones,
  pipe: [0xe8e0cc, 0xb8b09c, 0xfaf4e4] as Tones,
  wood: [0x8a6a42, 0x5e462a, 0xa8865a] as Tones,
};

/**
 * Old Ebb, who has fished the Wend for sixty years: a broad, bent old man in
 * an ochre canvas smock, stiff with salt and fish-scale, its sleeves rolled to
 * the elbow over a grey shirt; patched breeches, thick stockings and wooden
 * clogs. Bald and brown on top with a fringe of white, a long white beard
 * gathered in a knot of twine, a clay pipe in the corner of his mouth, and,
 * sitting, a net across his knees that he's mending with a wooden needle.
 */
export function ebbModel(pose: Pose3D): Model {
  const C = EBB;
  const b = pose.bob;
  const s = pose.stride;
  const sit = !!pose.sit;
  const solids: Solid[] = [];
  const details: Detail[] = [];
  const lean = sit ? 1.2 : 0.7;

  // Legs: breeches to the knee, grey stockings, clogs.
  const breeches = (h: Hit): Tones => (h.z > 3 && h.x < -0.6 && h.x > -3.8 && Math.abs(h.y - (sit ? 10.6 : 9.2)) < 1.4 ? [0x6a5a40, 0x4a3e2c, 0x86744e] : C.breeches);
  if (sit) {
    solids.push(...seatedLegs(2.4, breeches, C.clog));
    for (const side of [-1, 1]) solids.push(...limb([side * 2.4, 8.2, 5.7], [side * 2.4, 3.4, 5.8], 1.7, 1.55, (h) => knit(C.stocking, h)));
  } else {
    for (const side of [-1, 1]) {
      const leg = standingLeg(side * 2.4, side, b, s);
      solids.push(...limb(leg.hip, leg.at(8), 2, 1.8, breeches));
      solids.push(...limb(leg.at(8), leg.ankle, 1.7, 1.5, (h) => knit(C.stocking, h)));
      solids.push({ cx: leg.foot[0], cy: leg.foot[1] + 0.2, cz: leg.foot[2] + 0.2, rx: 1.7, ry: 1.25, rz: 2.7, material: C.clog });
    }
  }

  // The smock: a loose canvas shirt to mid-thigh, smocked in rows across the chest,
  // salt-stained and spangled with fish scales, a pocket at the front.
  const smock = (h: Hit): Tones => {
    if (dusted(h, 0.05)) return [0xd8dcd8, 0xa8aca8, 0xf4f8f4];
    if (h.nz > 0.4 && Math.abs(h.x) < 2.8 && h.y > 20.5 - b && h.y < 24 - b) return Math.floor(h.y * 2.4 + h.x * 0.5) % 2 ? C.smock : C.smockSeam;
    if (h.nz > 0.6 && h.x > 0.6 && h.x < 3.4 && Math.abs(h.y - (sit ? 13.6 : 13) + b) < 1.5) return Math.abs(h.y - (sit ? 13.6 : 13) + b) > 1.2 ? C.smockSeam : shade(C.smock);
    if (Math.abs(Math.abs(h.nx) - 0.86) < 0.05) return C.smockSeam;
    return C.smock;
  };
  if (!sit) {
    for (let y = 9.5; y <= 14; y += 0.5) solids.push({ cx: 0, cy: y - b * 0.5, cz: s * 0.2 + lean * 0.2, rx: 5 + (14 - y) * 0.16, ry: 0.8, rz: 3.9 + (14 - y) * 0.08, material: y < 10 ? C.smockSeam : smock });
  } else {
    solids.push({ cx: 0, cy: 11, cz: 2.4, rx: 5.2, ry: 1.4, rz: 4.6, material: smock });
  }
  // A round, bent old back.
  solids.push({ cx: 0, cy: 14.4 - b, cz: lean * 0.2, rx: 5, ry: 2.8, rz: 3.8, material: smock });
  solids.push({ cx: 0, cy: 18 - b, cz: lean * 0.5, rx: 5.2, ry: 3.4, rz: 4, material: smock });
  solids.push({ cx: 0, cy: 22.2 - b, cz: lean, rx: 5.5, ry: 4.4, rz: 4.1, material: smock });
  solids.push({ cx: 0, cy: 22.6 - b, cz: lean - 1.6, rx: 4.8, ry: 3.6, rz: 3, material: smock });
  // The shirt's collar showing at the neck.
  solids.push({ cx: 0, cy: 26 - b, cz: lean + 0.2, rx: 3.2, ry: 1.1, rz: 3, material: C.shirt });

  // Arms: the smock's sleeves rolled to the elbow, brown forearms, big hands.
  // Seated, both hands are at the net in his lap: the left holding it up, the right with the needle.
  for (const side of [-1, 1]) {
    const swing = sit ? 0 : -s * side * 2;
    const shoulder: V3 = [side * 5.4, 24 - b, lean];
    const elbow: V3 = sit ? [side * 6, 19 - b, lean + 2.4] : [side * 6.2, 20.2 - b, lean + swing * 0.5];
    const hand: V3 = sit ? [side * 2.6, 15.6 - b, 7.6] : [side * 6.4, 16.6 - b, 1 + lean + swing];
    solids.push({ cx: side * 5, cy: 24.6 - b, cz: lean, rx: 2.6, ry: 2.3, rz: 2.6, material: smock });
    solids.push(...limb(shoulder, elbow, 2, 1.9, smock));
    // The rolled cuff, then bare forearm.
    solids.push({ cx: elbow[0], cy: elbow[1], cz: elbow[2], rx: 2.05, ry: 1.2, rz: 2.05, material: C.smockSeam });
    solids.push(...limb(along(elbow, hand, 0.15), hand, 1.55, 1.45, C.skin));
    solids.push({ cx: hand[0], cy: hand[1] - 0.6, cz: hand[2] + 0.3, rx: 1.65, ry: 1.55, rz: 1.75, material: C.skin, soft: true });
  }

  // The net across his knees and hanging down to the ground in front, a few
  // cork floats and a red one along its head-rope; the wooden needle in his right hand.
  if (sit) {
    const mesh = (h: Hit): Tones => {
      // Diamond mesh: the twine where either diagonal crosses a line, dark gaps between.
      const a = (h.x * 1.4 + h.y * 1.4 + 40) % 1.4;
      const d = (h.x * 1.4 - h.y * 1.4 + 40) % 1.4;
      return a < 0.4 || d < 0.4 ? C.net : [0x3a3224, 0x2a2418, 0x4a4030];
    };
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      // Over the knees, then falling to the ground.
      const y = t < 0.4 ? 12.8 - t * 2 : 12 - (t - 0.4) * 18;
      const z = t < 0.4 ? 4 + t * 10 : 8 + (t - 0.4) * 2.5;
      solids.push({ cx: 0.4, cy: y, cz: z, rx: 5.6 + t * 1.4, ry: 1.4, rz: 1.2, material: mesh });
    }
    for (let i = 0; i < 5; i++) {
      const x = -5 + i * 2.5;
      solids.push({ cx: x, cy: 1.4, cz: 9.6, rx: 0.9, ry: 0.7, rz: 0.7, material: i === 2 ? C.red : C.cork });
    }
    // A heap of net beside the stool.
    solids.push({ cx: 6.8, cy: 1.6, cz: 3.4, rx: 3, ry: 1.6, rz: 2.8, material: mesh });
    solids.push({ cx: 7.6, cy: 3, cz: 3.4, rx: 0.8, ry: 0.6, rz: 0.6, material: C.cork });
    // The needle, pointing up out of his right fist, a twist of twine on it.
    solids.push(...limb([-2.4, 15.4 - b, 8.4], [-1.6, 18.4 - b, 8.8], 0.35, 0.25, C.wood, 0.4));
    solids.push({ cx: -2.2, cy: 16.6 - b, cz: 8.5, rx: 0.5, ry: 0.7, rz: 0.5, material: C.net });
  }

  // Head pushed forward: bald and brown on top, a white fringe round the back and over the
  // ears, bushy brows, a long beard tied with twine, the clay pipe in the corner of his mouth.
  const hy = 31.4 - b;
  const hz = lean + 1.2;
  solids.push({ cx: 0, cy: 27 - b, cz: hz * 0.6, rx: 2.2, ry: 2, rz: 2.2, material: C.skin });
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (h.nz > -0.3 && (py < -1.8 || (py < 0.2 && Math.abs(h.nx) > 0.62))) return C.beard;
    if (py < 1.4 && (h.nz < -0.1 || Math.abs(h.nx) > 0.72)) return (Math.floor(h.y * 2 + h.x) & 1) === 0 ? C.hair : shade(C.hair);
    // Liver spots on the crown.
    if (py > 3 && dusted(h, 0.08)) return [C.skin[1], darker(C.skin[1]), C.skin[0]];
    return C.skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 5.4, ry: 5.8, rz: 5.2, material: head, soft: true });
  solids.push({ cx: 0, cy: hy - 0.2, cz: hz + 5.2, rx: 1.15, ry: 1.4, rz: 1.1, material: C.skin, soft: true });
  for (const side of [-1, 1]) solids.push({ cx: side * 5.3, cy: hy + 0.1, cz: hz + 0.2, rx: 0.8, ry: 1.4, rz: 1, material: C.skin });
  // The beard: full over the jaw, then gathered and tied, and on down to his chest.
  const beard = (h: Hit): Tones => ((Math.floor(h.x * 2.2 + h.y * 0.3) & 1) === 0 ? C.beard : shade(C.beard));
  solids.push({ cx: 0, cy: hy - 4.4, cz: hz + 2.8, rx: 3.8, ry: 2.8, rz: 2.4, material: beard });
  // The moustache, drooping either side of the mouth.
  for (const side of [-1, 1]) solids.push({ cx: side * 1.3, cy: hy - 2, cz: hz + 4.9, rx: 1.5, ry: 0.6, rz: 0.6, material: C.beard });
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    solids.push({ cx: 0, cy: hy - 7 - t * 4.4, cz: hz + 3.2 - t * 0.6, rx: 1.9 - t * 0.9, ry: 1.2, rz: 1.1 - t * 0.3, material: i === 1 ? [0x9a8a64, 0x6e6246, 0xb4a47c] : beard });
  }
  // Bushy white brows.
  for (const side of [-1, 1]) solids.push({ cx: side * 2, cy: hy + 2.2, cz: hz + 4.5, rx: 1.4, ry: 0.55, rz: 0.6, material: C.beard });
  // The clay pipe: from the corner of his mouth (his left), the stem dipping, the bowl up.
  solids.push(...limb([1.4, hy - 2.2, hz + 5], [3.6, hy - 3.4, hz + 6.6], 0.3, 0.3, C.pipe, 0.3));
  solids.push({ cx: 3.9, cy: hy - 2.7, cz: hz + 6.8, rx: 0.65, ry: 0.9, rz: 0.65, material: C.pipe });
  details.push({ x: 3.9, y: hy - 1.9, z: hz + 6.9, color: 0x3a2a20, size: 0.5 });
  details.push({ x: 3.8, y: hy - 1.9, z: hz + 7.1, color: 0xe87a32, size: 0.5 });

  for (const side of [-1, 1]) {
    // Small, deep-set eyes, creased at the corners.
    details.push({ x: side * 1.9, y: hy + 1, z: hz + 4.95, color: P.eye, size: 0.5 });
    details.push({ x: side * 1.9, y: hy + 0.5, z: hz + 5, color: 0x5a7a8a, size: 0.5 });
    details.push({ x: side * 3, y: hy + 0.6, z: hz + 4.2, color: darker(C.skin[1]), size: 0.5 });
    details.push({ x: side * 2.9, y: hy + 1.2, z: hz + 4.3, color: darker(C.skin[1]), size: 0.5 });
  }
  return { solids, details };
}

// ---------------------------------------------------------------------------
// Wren
// ---------------------------------------------------------------------------

const WREN = {
  dress: [0x8a4a32, 0x603222, 0xa8603e] as Tones,
  apron: [0xc8bca0, 0x9a8e76, 0xe0d6bc] as Tones,
  soot: [0x6a6256, 0x4a443c, 0x847c70] as Tones,
  shift: [0xe0d8c4, 0xb4ac98, 0xf4ecda] as Tones,
  scarf: [0x4a7a5a, 0x325440, 0x62987a] as Tones,
  stocking: [0x5a4e44, 0x3e362e, 0x766a5e] as Tones,
  shoe: [0x3e2c22, 0x281c16, 0x5a4232] as Tones,
  skin: [0xf0c8a4, 0xcc9e7e, 0xffdcbc] as Tones,
  hair: [0xb8562a, 0x8a3c1c, 0xd8743e] as Tones,
  basket: [0xb89058, 0x7e5e32, 0xd8b478] as Tones,
  fish: [0xc08a3a, 0x7a4e1e, 0xe0aa58] as Tones,
};

/**
 * Wren, Ebb's granddaughter, twelve and never still: a russet wool dress with
 * its sleeves pushed up over a linen shift, a canvas apron smudged with soot
 * from the smokehouse, a green kerchief tied over a mop of copper hair that
 * won't stay under it, freckles, a gap-toothed grin, and a flat basket of
 * smoked fish on her hip.
 */
export function wrenAdult(pose: Pose3D): Model {
  const C = WREN;
  const b = pose.bob;
  const s = pose.stride;
  const sit = !!pose.sit;
  const solids: Solid[] = [];
  const details: Detail[] = [];
  const waist = 15.8 - b * (sit ? 1 : 0.5);

  // Legs in dark stockings, and scuffed shoes.
  if (sit) {
    solids.push(...seatedLegs(2, C.stocking, C.shoe, 1.6));
  } else {
    for (const side of [-1, 1]) {
      const leg = standingLeg(side * 2, side, b, s);
      solids.push(...limb(leg.hip, leg.ankle, 1.6, 1.35, C.stocking));
      solids.push({ cx: leg.foot[0], cy: leg.foot[1], cz: leg.foot[2], rx: 1.4, ry: 1, rz: 2.1, material: C.shoe });
    }
  }

  // The dress's skirt, to mid-shin, and the apron over the front of it.
  const skirt = (h: Hit, y: number): Tones => {
    if (h.nz > 0.35 && Math.abs(h.x) < 3.4 + (15 - y) * 0.08) {
      if (y < 6.6) return C.soot;
      return dusted(h, 0.12) ? C.soot : C.apron;
    }
    return y < 6.3 ? shade(C.dress) : C.dress;
  };
  if (!sit) {
    for (let y = 6; y <= 15; y += 0.5) {
      const flare = (15 - y) * 0.15;
      solids.push({ cx: 0, cy: y - b * 0.5, cz: s * 0.3 * (15 - y) / 9, rx: 4.4 + flare, ry: 0.8, rz: 3.6 + flare * 0.8, material: (h) => skirt(h, y) });
    }
  } else {
    solids.push({ cx: 0, cy: 10.6, cz: 2.6, rx: 4.8, ry: 1.6, rz: 4.8, material: (h) => skirt(h, 10) });
  }

  // The bodice: laced up the front, the apron's bib over it, its strings tied at the back.
  const bodice = (h: Hit): Tones => {
    if (Math.abs(h.y - waist) < 0.45) return h.nz < -0.6 && Math.abs(h.x) < 1.2 ? shade(C.apron) : C.apron;
    if (h.nz > 0.55 && Math.abs(h.x) < 2.4 && h.y > waist && h.y < 22.6 - b) return dusted(h, 0.1) ? C.soot : C.apron;
    if (h.y > 24.2 - b && h.nz > -0.2) return C.shift;
    return C.dress;
  };
  solids.push({ cx: 0, cy: 15.6 - b * (sit ? 1 : 0.5), cz: 0, rx: 4.2, ry: 2, rz: 3.2, material: bodice });
  solids.push({ cx: 0, cy: 18.6 - b, cz: 0, rx: 4.1, ry: 3, rz: 3.2, material: bodice });
  solids.push({ cx: 0, cy: 22.2 - b, cz: 0.1, rx: 4.6, ry: 3.8, rz: 3.4, material: bodice });
  // The apron's bow at the small of her back.
  for (const side of [-1, 1]) solids.push({ cx: side * 1, cy: waist + 0.2, cz: -3.5, rx: 1, ry: 0.7, rz: 0.4, material: C.apron });

  // Arms: the sleeves pushed up past the elbow, linen showing, bare forearms.
  // The left arm crooks round the basket on her hip.
  for (const side of [-1, 1]) {
    const carrying = side === 1 && !sit;
    const swing = sit || carrying ? 0 : -s * side * 2;
    const shoulder: V3 = [side * 4.8, 24 - b, 0.1];
    const elbow: V3 = sit ? [side * 5.2, 19.6 - b, 2] : carrying ? [side * 6.4, 20 - b, -0.6] : [side * 5.6, 20.2 - b, 0.3 + swing * 0.5];
    const hand: V3 = sit ? [side * 3.4, 12.8, 4.4] : carrying ? [side * 5.4, 16.4 - b, 2.6] : [side * 5.8, 16.8 - b, 0.8 + swing];
    solids.push({ cx: side * 4.5, cy: 24.4 - b, cz: 0.1, rx: 2.2, ry: 2, rz: 2.2, material: C.dress });
    solids.push(...limb(shoulder, elbow, 1.6, 1.5, C.dress));
    solids.push({ cx: elbow[0], cy: elbow[1], cz: elbow[2], rx: 1.7, ry: 1.1, rz: 1.7, material: C.shift });
    solids.push(...limb(along(elbow, hand, 0.2), hand, 1.3, 1.2, C.skin));
    solids.push({ cx: hand[0], cy: hand[1] - 0.6, cz: hand[2] + 0.2, rx: 1.25, ry: 1.3, rz: 1.3, material: C.skin, soft: true });
  }
  // The basket: a flat round of wicker on her left hip, smoked fish laid in it head to tail.
  if (!sit) {
    const bx = 6;
    const by = waist - 0.4;
    const bz = 1.4;
    solids.push({ cx: bx, cy: by, cz: bz, rx: 3.4, ry: 1.3, rz: 2.8, material: (h) => (Math.floor(Math.atan2(h.x - bx, h.z - bz) * 6 + h.y * 2) % 2 ? C.basket : shade(C.basket)) });
    for (const [dx, dz, flip] of [[-1.4, 0.2, 1], [0, 0.9, -1], [1.3, 0, 1]]) {
      solids.push({ cx: bx + dx, cy: by + 1.3, cz: bz + dz, rx: 0.8, ry: 0.55, rz: 2.2, material: C.fish });
      solids.push({ cx: bx + dx, cy: by + 1.3, cz: bz + dz + flip * 2.2, rx: 0.6, ry: 0.4, rz: 0.5, material: shade(C.fish) });
    }
  }

  // Head: copper hair escaping a green kerchief tied at the nape; freckles and a grin.
  const hy = 32.2 - b;
  const hz = 0.4;
  solids.push({ cx: 0, cy: 27 - b, cz: 0.3, rx: 1.8, ry: 2, rz: 1.8, material: C.skin });
  const curls = (h: Hit): Tones => ((Math.floor(h.x * 1.8 + h.z * 0.9) + Math.floor(h.y * 1.4)) % 2 ? C.hair : shade(C.hair));
  const head = (h: Hit): Tones => {
    const py = h.y - hy;
    if (py > 2.2) return C.scarf;
    if (h.nz < -0.2 || (Math.abs(h.nx) > 0.78 && py > -2)) return curls(h);
    return C.skin;
  };
  solids.push({ cx: 0, cy: hy, cz: hz, rx: 5.2, ry: 5.6, rz: 5, material: head, soft: true });
  solids.push({ cx: 0, cy: hy, cz: hz + 5, rx: 0.8, ry: 0.9, rz: 0.8, material: C.skin });
  // The kerchief: a band over the crown and the knot at the back with its tails.
  solids.push({ cx: 0, cy: hy + 3.4, cz: hz - 0.4, rx: 5.5, ry: 2.6, rz: 5.3, material: (h) => (dusted(h, 0.15) ? C.shift : C.scarf) });
  solids.push({ cx: 0, cy: hy + 0.6, cz: hz - 5.2, rx: 1.4, ry: 1.1, rz: 0.9, material: shade(C.scarf) });
  for (const side of [-1, 1]) solids.push({ cx: side * 0.8, cy: hy - 1.4, cz: hz - 5.3, rx: 0.6, ry: 1.6, rz: 0.4, material: C.scarf });
  // Curls escaping: over the brow and in bunches at the sides.
  for (const [x, y, z] of [[-2.6, 2.4, 4.2], [-0.6, 2.6, 4.6], [1.8, 2.3, 4.4], [-4.9, -0.6, 2.4], [4.9, -0.6, 2.4], [-5.2, -2.6, 0.8], [5.2, -2.6, 0.8], [-1.6, -1.6, -5]]) {
    solids.push({ cx: x, cy: hy + y, cz: hz + z, rx: 1.3, ry: 1.3, rz: 1.1, material: curls });
  }

  details.push(...fineFace(hy, hz, {
    eye: P.eye,
    iris: 0x6a8a4a,
    brow: darker(C.hair[1]),
    browSlant: -0.3,
    browLift: 2.2,
    mouth: 0xb0705c,
    mouthWidth: 3,
    smile: true,
    freckles: 0xc88058,
  }, { rx: 5.2, ry: 5.6, rz: 5 }));
  // The gap in her grin.
  details.push({ x: 0, y: hy - 2.1, z: hz + 5.05, color: 0xf4ecdc, size: 0.5 });
  return { solids, details };
}

/** Wren at her size: a child's body under a child's head (see asChild). */
export function wrenModel(pose: Pose3D): Model {
  return asChild(wrenAdult(pose));
}

/** The jetty's folk, by id, for FINE_FOLK. */
export const JETTY_FOLK: Record<string, (pose: Pose3D) => Model> = {
  maren: marenModel,
  ebb: ebbModel,
  wren: wrenModel,
};
