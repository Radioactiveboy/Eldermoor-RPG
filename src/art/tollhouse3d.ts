import type Phaser from 'phaser';
import type { Tones } from './character';
import { speck } from './beasts3d';
import { RoseLook, roseModel } from './blackrose3d';
import { generateFigure3D, Hit, limb, Model, Pose3D, Solid } from './figure3d';
import { FINE_SPEC, shade } from './fine3d';

/**
 * The people of the Reeve's toll house by the Fen Gate (world/TollHouseMap.ts),
 * drawn finely on the Black Rose's frame (roseModel in blackrose3d.ts) with
 * what marks them out added on top: Corvin Sallow the Reeve, long and yellow
 * in a fur-collared gown, his gilt chain of office, a velvet cap and a pomander;
 * Tobias Nibb, his clerk, ink to the wrists, spectacles, a quill behind his
 * ear; Gaff Tully of the Hooks, in tarred oilskins with the Hooks' red rag at
 * his throat and the gaff he's named for; Lardy Mott of the Red Aprons, vast in
 * a blood-stiff leather apron, a cleaver at his belt and something to eat in
 * his hand; and Annet Marl, the eel-wife who has been waiting since Tuesday.
 * Both yellowbands wear the Reeve's yellow round the arm and his tin tally
 * on a cord: the two gangs both take his silver.
 */

type V3 = [number, number, number];

/** What the toll house folk wear or carry over a Rose look. */
interface TollExtras {
  /** The Reeve's yellow round the left upper arm, and his tin tally token on a cord at the breast. */
  yellowband?: boolean;
  /** The Hooks' rust-red rag knotted at the throat. */
  neckRag?: boolean;
  /** A fur collar over the shoulders. */
  fur?: Tones;
  /** A gilt chain of office across the breast, with a medallion. */
  chain?: boolean;
  /** A little round velvet cap. */
  coif?: Tones;
  /** Wire spectacles. */
  spectacles?: boolean;
  /** A quill tucked behind the left ear. */
  quill?: boolean;
  /** Ink up the fingers and cuffs. */
  inky?: boolean;
  /** What hangs from the left hand: a boathook taller than its owner, or nothing. */
  staff?: 'gaff';
  /** What the right hand (screen-left) holds, hanging at the side: a pomander, a ham bone, or nothing. */
  holding?: 'pomander' | 'ham';
  /** A cleaver hung from the belt. */
  cleaver?: boolean;
}

const YELLOW: Tones = [0xc89a2a, 0x8a6a1c, 0xe8c050];
const TIN: Tones = [0xa8acb4, 0x74787e, 0xd4d8e0];
const GILT: Tones = [0xc8a040, 0x8a6a28, 0xeccc70];
const RAG_RED: Tones = [0x9a3a2a, 0x6a2418, 0xba5a3a];
const IRON: Tones = [0x5a5a64, 0x3a3a42, 0x8a8a94];
const ASH: Tones = [0x6a5a42, 0x4a3e2e, 0x86745a];
const STEEL: Tones = [0xc8ccd4, 0x8a8e98, 0xf0f4fc];
const QUILL: Tones = [0xf0ece0, 0xc8c4b8, 0xffffff];

const knob = (p: V3, r: number, material: Tones | ((h: Hit) => Tones)): Solid => ({ cx: p[0], cy: p[1], cz: p[2], rx: r, ry: r, rz: r, material });

/** A toll house person in one pose: the Rose frame, then the extras laid over it in the same body space. */
function tollModel(pose: Pose3D, look: RoseLook, x: TollExtras): Model {
  const base = roseModel(pose, look);
  const solids = [...base.solids];
  const details = [...base.details];
  const w = look.bulk ?? 1;
  const up = ((look.tall ?? 1) - 1) * 12;
  const b = pose.bob;
  const s = pose.stride;
  const stoop = look.stoop ?? 0;
  const belly = look.belly ?? 0;
  const Y = (y: number) => y + up - b;
  const lean = (y: number) => Math.max(0, y - Y(18)) * stoop * 0.32;
  const waist = Y(15.6) + b * 0.5;
  const hy = Y(32.2) - stoop * 1.6;
  const hz = 0.4 + lean(32) + stoop * 0.8;
  const HEAD = { rx: 5.2, ry: 5.6, rz: 5 };
  const onFace = (fx: number, dy: number): V3 => [fx, hy + dy, hz + HEAD.rz * Math.sqrt(Math.max(0, 1 - (fx / HEAD.rx) ** 2 - (dy / HEAD.ry) ** 2)) + 0.18];
  const mark = (p: V3, color: number, size = 0.5) => details.push({ x: p[0], y: p[1], z: p[2], color, size });
  const chest = 3.6 * w + belly * 0.9;

  if (x.fur) {
    const f = x.fur;
    const pelt = (h: Hit): Tones => (speck(h, 0.9) < 0.3 ? shade(f) : speck(h, 1.3) > 0.85 ? [f[2], f[0], f[2]] : f);
    solids.push({ cx: 0, cy: Y(25.2), cz: 0.2 + lean(25), rx: 5.8 * w, ry: 1.9, rz: 4.3 * w, material: pelt });
    // Down the front edges of the gown, either side.
    for (const side of [-1, 1]) solids.push(...limb([side * 2.4 * w, Y(24.4), chest + lean(24)], [side * 2.8 * w, Y(14), chest * 0.9], 1.1, 0.9, pelt, 0.5));
  }
  if (x.chain) {
    // Gilt links in a swag from shoulder to shoulder, and the medallion with the scales.
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const a = (t - 0.5) * Math.PI * 0.9;
      const px = Math.sin(a) * 4.1 * w;
      const py = Y(25) - Math.cos(a) * 3.4;
      solids.push(knob([px, py, chest + 0.4 + lean(py) - Math.abs(Math.sin(a)) * 1.2], 0.42, GILT));
    }
    solids.push({ cx: 0, cy: Y(20.8), cz: chest + 0.7 + lean(21), rx: 1.2, ry: 1.2, rz: 0.4, material: GILT });
    mark([0, Y(20.8), chest + 1.2 + lean(21)], 0x2a2018, 0.6);
  }
  if (x.yellowband) {
    // The yellow round the left arm (screen-right), above the elbow, and the tally on its cord.
    const sh: V3 = [5 * w, Y(24), 0.1 + lean(24)];
    const el: V3 = [5.8 * w, Y(20.2), 0.3 - s * 1 + lean(20)];
    const at: V3 = [(sh[0] + el[0]) / 2 + 0.1, (sh[1] + el[1]) / 2, (sh[2] + el[2]) / 2];
    solids.push({ cx: at[0], cy: at[1], cz: at[2], rx: 2.25 * w, ry: 0.85, rz: 2.15 * w, material: (h) => (speck(h, 1.2) < 0.15 ? shade(YELLOW) : YELLOW) });
    solids.push({ cx: at[0] + 1.6 * w, cy: at[1] - 1, cz: at[2] + 0.6, rx: 0.4, ry: 1.2, rz: 0.3, material: YELLOW }); // the knot's tail
    for (let i = 0; i < 5; i++) mark([-1.6 + i * 0.8, Y(24.6) - Math.abs(i - 2) * 0.7, chest + 0.2 + lean(24)], 0x4a3a2a, 0.4);
    solids.push({ cx: 0, cy: Y(22.6), cz: chest + 0.5 + lean(22.6), rx: 0.9, ry: 0.9, rz: 0.3, material: TIN });
    mark([0, Y(22.6), chest + 0.9 + lean(22.6)], 0x3a3a40, 0.5);
  }
  if (x.neckRag) {
    solids.push({ cx: 0, cy: Y(26), cz: 1.6 + lean(26), rx: 2.6 * w, ry: 1.1, rz: 2.2 * w, material: (h) => (speck(h, 1) < 0.2 ? shade(RAG_RED) : RAG_RED) });
    solids.push(...limb([0.6, Y(25.4), 2.8 + lean(25)], [1.2, Y(22.6), 3.4 * w + lean(23)], 0.7, 0.4, RAG_RED, 0.4));
    solids.push(...limb([-0.4, Y(25.4), 2.8 + lean(25)], [-0.9, Y(23.2), 3.3 * w + lean(23)], 0.6, 0.35, shade(RAG_RED), 0.4));
  }
  if (x.coif) {
    solids.push({ cx: 0, cy: hy + 4.1, cz: hz - 0.7, rx: 5.1, ry: 2.4, rz: 4.9, material: (h) => (h.y < hy + 2.6 ? shade(x.coif!) : x.coif!) });
  }
  if (x.spectacles) {
    // Two wire rings over the eyes and the bridge between.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        mark(onFace(side * 1.9 + Math.cos(a) * 1.1, 0.8 + Math.sin(a) * 0.9), 0x8a8a92, 0.35);
      }
      mark(onFace(side * 3.4, 1.1), 0x6a6a72, 0.35);
    }
    mark(onFace(0, 1), 0x8a8a92, 0.35);
  }
  if (x.quill) solids.push(...limb([4.6, hy + 0.4, hz - 0.6], [6.2, hy + 6.6, hz - 2.6], 0.35, 0.15, QUILL, 0.3));

  // Hands: the right one hangs at the side with whatever it holds; the left one carries the staff.
  const swingR = s * 2;
  const rightHand: V3 = [-6 * w, Y(16.8) - 0.9, 0.8 + swingR + lean(17) + 0.2];
  if (x.inky) for (const [dx, dy] of [[0.4, -0.6], [-0.3, -1], [0.1, -1.3]]) mark([rightHand[0] + dx, rightHand[1] + dy, rightHand[2] + 1.2], 0x2a2a4a, 0.45);
  if (x.holding === 'pomander') {
    solids.push(knob([rightHand[0] + 0.2, rightHand[1] - 1.6, rightHand[2] + 0.8], 0.95, GILT));
    solids.push(...limb([rightHand[0] + 0.2, rightHand[1] - 0.5, rightHand[2] + 0.7], [rightHand[0] + 0.2, rightHand[1] + 0.6, rightHand[2] + 0.5], 0.15, 0.15, GILT, 0.3));
    for (const a of [0, 2.1, 4.2]) mark([rightHand[0] + 0.2 + Math.cos(a) * 0.6, rightHand[1] - 1.6, rightHand[2] + 1.6 + Math.sin(a) * 0.3], 0x5a3a1a, 0.4);
  } else if (x.holding === 'ham') {
    // A ham hock, half eaten, the bone sticking out.
    solids.push({ cx: rightHand[0] - 0.2, cy: rightHand[1] - 1.8, cz: rightHand[2] + 1.6, rx: 1.5, ry: 2.2, rz: 1.4, material: (h) => (speck(h, 1) < 0.25 ? [0x8a4a32, 0x5a2a1a, 0xaa6a4a] : [0xb86a4a, 0x8a4a32, 0xd88a6a]) });
    solids.push(...limb([rightHand[0] - 0.2, rightHand[1] + 0.2, rightHand[2] + 1.2], [rightHand[0] - 0.4, rightHand[1] + 2.4, rightHand[2] + 1.6], 0.5, 0.6, [0xe8e0c8, 0xb8b098, 0xfff8e0], 0.3));
  }
  if (x.staff === 'gaff') {
    const swingL = -s * 2;
    const hand: V3 = [6 * w, Y(16.8) - 0.9, 0.8 + swingL + 1.2];
    const foot: V3 = [hand[0] + 0.4, 0.6, hand[2] + 1.6];
    const top: V3 = [hand[0] - 0.3, Y(37), hand[2] - 0.6];
    solids.push(...limb(foot, top, 0.55, 0.5, ASH, 0.5));
    // The iron hook and its spike, and a lashing of tarred cord where it's held.
    solids.push(...limb(top, [top[0] - 0.1, top[1] + 2.6, top[2] - 0.2], 0.35, 0.2, IRON, 0.3));
    solids.push(...limb([top[0], top[1] + 1, top[2]], [top[0] + 1.6, top[1] + 1.8, top[2] + 0.6], 0.32, 0.28, IRON, 0.3));
    solids.push(...limb([top[0] + 1.6, top[1] + 1.8, top[2] + 0.6], [top[0] + 2, top[1] + 0.2, top[2] + 0.9], 0.28, 0.16, IRON, 0.3));
    solids.push({ cx: hand[0], cy: hand[1] + 2, cz: hand[2] - 0.2, rx: 0.75, ry: 1.6, rz: 0.75, material: [0x2a2420, 0x1a1614, 0x3e3630] });
  }
  if (x.cleaver) {
    // On the right hip: the blade broad and dark, the edge bright.
    const at: V3 = [-4.2 * w, waist - 2.6, 2.2 * w + belly * 0.6];
    solids.push({ cx: at[0], cy: at[1], cz: at[2], rx: 0.3, ry: 2.2, rz: 1.8, material: (h) => (h.z > at[2] + 1.3 ? STEEL : [0x6a6a72, 0x4a4a52, 0x8a8a92]) });
    solids.push(...limb([at[0], at[1] + 2, at[2] - 0.6], [at[0], at[1] + 4.4, at[2] - 0.8], 0.45, 0.45, [0x4a2c1b, 0x2e1a10, 0x6e4228], 0.3));
  }
  return { solids, details };
}

const BOOT: Tones = [0x3a2a20, 0x241a14, 0x54402e];
const BELT: Tones = [0x3a2a1e, 0x241a12, 0x523c2a];

/** The toll house folk, by folk id: their Rose look and their extras. */
export const TOLL_LOOKS: Record<string, { look: RoseLook; extras: TollExtras }> = {
  /**
   * Corvin Sallow, Reeve of Gloomhaven: tall, stooped and thin, a long sallow
   * face, black hair oiled flat to his collar, a thin smile; a gown of black
   * velvet with a fur collar and a gilt chain, a doublet of mustard silk, rings,
   * a little black cap, and a gilt pomander held where he can lift it to his nose.
   */
  reeve: {
    look: {
      tall: 1.1,
      bulk: 0.86,
      stoop: 0.45,
      skin: [0xd8c08a, 0xb09a68, 0xeed6a0],
      hair: [0x1a1618, 0x0e0c0e, 0x2e282c],
      hairStyle: 'long',
      beard: 'none',
      garment: 'coat',
      outer: [0x221c24, 0x141016, 0x3a323e],
      inner: [0xe8e0cc, 0xbcb4a0, 0xf8f0dc],
      waistcoat: [0xb8902a, 0x8a6a1c, 0xd8b048],
      trouser: [0x221c24, 0x141016, 0x3a323e],
      boot: [0x1a1418, 0x0e0a0e, 0x2e262c],
      belt: [0x2a2024, 0x1a1418, 0x403438],
      right: 'none',
      left: 'swing',
      iris: 0x3a3a2a,
      brow: 0x1a1618,
      browSlant: 0.45,
      lip: 0x8a5a4a,
      mouthWidth: 3,
      smile: true,
      hollow: 0xa89868,
    },
    extras: { fur: [0x6a5a48, 0x4a3e30, 0x8a7a64], chain: true, coif: [0x1a141a, 0x0e0a0e, 0x2e262e], holding: 'pomander' },
  },
  /**
   * Tobias Nibb, the Reeve's clerk: small, round-shouldered and short-sighted,
   * thinning sandy hair, wire spectacles, a quill behind his ear, a threadbare
   * brown coat shiny at the elbows, ink to the wrists.
   */
  nibb: {
    look: {
      tall: 0.94,
      bulk: 0.88,
      stoop: 0.6,
      skin: [0xecc8aa, 0xc4a086, 0xfcdcc2],
      hair: [0xb08a5a, 0x8a6a42, 0xc8a474],
      hairStyle: 'short',
      beard: 'none',
      garment: 'coat',
      outer: [0x5a4632, 0x3e3022, 0x766048],
      inner: [0xd8ccb4, 0xaea28a, 0xece2cc],
      waistcoat: [0x4a4a3a, 0x32322a, 0x62624e],
      trouser: [0x3a3430, 0x262220, 0x504844],
      boot: BOOT,
      belt: BELT,
      right: 'none',
      left: 'swing',
      iris: 0x5a6a7a,
      brow: 0x8a6a42,
      browSlant: -0.45,
      lip: 0xb07a68,
      mouthWidth: 2,
      hollow: 0xc0a090,
    },
    extras: { spectacles: true, quill: true, inky: true },
  },
  /**
   * Gaff Tully of the Hooks, on the Reeve's Watch by day: wiry and weathered,
   * a gap-toothed grin, a knitted cap, a brass ring in his ear, tarred black
   * oilskins with the Hooks' red rag at the throat, the Reeve's yellow round
   * his arm, a knife in one hand and his gaff in the other.
   */
  gaff: {
    look: {
      bulk: 0.95,
      skin: [0xc8946e, 0xa07052, 0xdcaa84],
      ruddy: 0xc0705a,
      hair: [0x4a3a2a, 0x30241a, 0x645040],
      hairStyle: 'shaggy',
      beard: 'stubble',
      hat: 'cap',
      hatCloth: [0x2a2a2e, 0x1a1a1e, 0x3e3e44],
      earring: 0xc8a040,
      garment: 'coat',
      outer: [0x242424, 0x141414, 0x4a4a4e],
      inner: [0x8a8070, 0x6a6052, 0xa49a88],
      waistcoat: [0x3a342e, 0x26221e, 0x504840],
      trouser: [0x2a2828, 0x1a1818, 0x403c3c],
      boot: [0x1e1c1c, 0x121010, 0x343030],
      belt: BELT,
      right: 'knife',
      left: 'swing',
      iris: 0x6a7a5a,
      brow: 0x30241a,
      browSlant: 0.35,
      lip: 0x9a5e50,
      mouthWidth: 3,
      smile: true,
      scar: 0xb88068,
    },
    extras: { yellowband: true, neckRag: true, staff: 'gaff' },
  },
  /**
   * Lardy Mott of the Red Aprons, on the Reeve's Watch by night: vast and slow,
   * a shaven head on no neck, small mild eyes, bare tattooed forearms, a leather
   * apron stiff with old blood over a stained smock, the Reeve's yellow round
   * an arm like a thigh, a cleaver at his belt and a ham hock in his fist.
   */
  lardy: {
    look: {
      bulk: 1.36,
      tall: 1.06,
      belly: 1,
      skin: [0xe8b898, 0xc0907a, 0xf8ccb0],
      ruddy: 0xd88a7a,
      hair: [0x8a6a4a, 0x644a32, 0xa8865e],
      hairStyle: 'bald',
      beard: 'stubble',
      garment: 'smock',
      outer: [0x8a7a62, 0x645844, 0xa4947a],
      inner: [0x9a8e76, 0x726852, 0xb4a88e],
      trouser: [0x3a3430, 0x262220, 0x504844],
      boot: [0x3a2a1e, 0x241a12, 0x52402e],
      belt: BELT,
      apron: [0x6a3424, 0x4a2216, 0x864634],
      tattoo: 0x5a2a2a,
      right: 'none',
      left: 'swing',
      iris: 0x6a8a9a,
      brow: 0x644a32,
      browSlant: -0.15,
      lip: 0xb07060,
      mouthWidth: 2,
      smile: true,
    },
    extras: { yellowband: true, holding: 'ham', cleaver: true },
  },
  /**
   * Annet Marl, eel-wife, who has been waiting since Tuesday for her creels:
   * small and weather-brown, grey hair under a kerchief, a shawl crossed and
   * tied, a fisher's oilskin apron over a patched skirt, her arms folded tight.
   */
  annet: {
    look: {
      bulk: 0.9,
      tall: 0.95,
      stoop: 0.25,
      skin: [0xc89a78, 0xa0765a, 0xdcb090],
      ruddy: 0xc87a6a,
      hair: [0x9a948a, 0x726c64, 0xb8b2a8],
      grey: [0xc8c4bc, 0xa09c94, 0xe0dcd4],
      hairStyle: 'bun',
      beard: 'none',
      hat: 'kerchief',
      hatCloth: [0x5a6a7a, 0x3e4a56, 0x7a8a9a],
      garment: 'dress',
      outer: [0x5a4a3e, 0x3e322a, 0x766254],
      inner: [0xc8bca0, 0x9a8e76, 0xe0d6bc],
      waistcoat: [0x4a3a2e, 0x32261e, 0x625040],
      trouser: [0x3a302a, 0x26201c, 0x50443c],
      boot: BOOT,
      belt: BELT,
      apron: [0x3a4038, 0x262a24, 0x525a50],
      shawl: [0x6a3a3a, 0x4a2626, 0x864e4e],
      ragged: true,
      right: 'none',
      left: 'folded',
      iris: 0x5a6a5a,
      brow: 0x726c64,
      browSlant: -0.5,
      lip: 0x9a6050,
      mouthWidth: 2,
      hollow: 0xa8806a,
    },
    extras: {},
  },
};

/** The toll house folk drawn finely, by folk id. */
export const TOLL_FOLK: Record<string, (pose: Pose3D) => Model> = Object.fromEntries(
  Object.entries(TOLL_LOOKS).map(([id, { look, extras }]) => [id, (pose: Pose3D) => tollModel(pose, look, extras)]),
);

/** Draws them all, as 'folk-<id>', eight directions each. */
export function generateTollFolk(scene: Phaser.Scene): void {
  for (const [id, build] of Object.entries(TOLL_FOLK)) generateFigure3D(scene, `folk-${id}`, build, FINE_SPEC);
}
