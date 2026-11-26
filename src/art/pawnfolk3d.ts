import type Phaser from 'phaser';
import { BRIGAND_ANIMS, BrigandLook, brigandFolkModel, fineSpec, lookSheet, shownSpec } from './brigands3d';
import { generateBeast } from './beasts3d';
import { roseModel, RoseLook } from './blackrose3d';
import { generateFigure3D, Model, Pose3D } from './figure3d';
import { FINE_SPEC } from './fine3d';
import { asChild } from './models3d';

/**
 * The folk of Lusk's pawnshop (world/PawnshopMap.ts), drawn finely like the
 * Rose's. Abel Lusk himself is one of Gloomhaven's townsfolk (gloomfolk3d.ts).
 *
 * Nettle, his shop girl: fourteen, small and sharp and sullen, a thatch of
 * black hair hacked short, a grey dress under a man's waistcoat far too big
 * for her, its pockets stuffed with tickets, and ink to the wrists.
 *
 * And two of the Hooks, the waterfront gang (see /gloomhaven-expansion/shared-cast.md),
 * drawn on the brigands' frame (brigands3d.ts) so that they can fight: Nim Dace,
 * neat and thin and smiling, his waxed moustache, his clean black oilskin, a
 * sou'wester worn far back, the rust-red rag knotted in a careful bow, and his
 * gaff; and Orm, who never speaks, huge and shaven, bare arms tattooed with
 * hooks, a boathook taller than he is.
 */

/** Nettle, Lusk's shop girl. */
const NETTLE: RoseLook = {
  bulk: 0.9,
  skin: [0xe8c8b0, 0xc0a088, 0xf8dcc4],
  hair: [0x1e1a1c, 0x121012, 0x342e30],
  hairStyle: 'shaggy',
  beard: 'none',
  garment: 'dress',
  outer: [0x5a5a5e, 0x3e3e42, 0x76767a],
  inner: [0xd0c8b4, 0xa8a08a, 0xe8e0cc],
  waistcoat: [0x4a3a2a, 0x30241a, 0x645040],
  trouser: [0x3a3a3e, 0x262628, 0x4e4e52],
  boot: [0x2e2420, 0x1e1814, 0x443830],
  belt: [0x3a2a1e, 0x241a12, 0x523c2a],
  apron: [0x8a7a5a, 0x6a5c42, 0xa8987a],
  ragged: true,
  right: 'rag',
  left: 'folded',
  iris: 0x4a5a6a,
  brow: 0x1e1a1c,
  browSlant: 0.5,
  lip: 0xb0786a,
  mouthWidth: 2.4,
  hollow: 0xc8a898,
  lashes: 0x1e1a1c,
  freckles: 0xc89878,
};

const OILSKIN: [number, number, number] = [0x262a2a, 0x161a1a, 0x3e4444];
const RUST_RAG: [number, number, number] = [0x8a3a22, 0x5e2616, 0xaa5232];

/** Nim Dace of the Hooks, who does the talking. */
export const DACE: BrigandLook = {
  skin: [0xd8b098, 0xae8670, 0xeac6b0],
  hair: [0x1a1618, 0x0e0c0e, 0x2e282a],
  hairStyle: 'crop',
  beard: 'moustache',
  torso: 'jerkin',
  cloth: OILSKIN,
  trim: [0x1e2222, 0x121414, 0x343a3a],
  sleeve: OILSKIN,
  trouser: [0x3a3632, 0x262420, 0x4e4a46],
  boot: [0x1e1c1c, 0x121010, 0x343030],
  belt: [0x3a2a1e, 0x241a12, 0x54402e],
  weapon: 'gaff',
  souwester: [0x2a2e2e, 0x1a1e1e, 0x464e4e],
  rag: RUST_RAG,
  earring: true,
  iris: 0x6a7a5a,
  brow: 0x1a1618,
  lip: 0xa86a5a,
  browSlant: 0.3,
  bulk: 0.9,
};

/** Orm of the Hooks, who doesn't. */
export const ORM: BrigandLook = {
  skin: [0xc89a7e, 0x9e705a, 0xdeb294],
  hair: [0x3a2e26, 0x241c16, 0x524236],
  hairStyle: 'bald',
  beard: 'stubble',
  torso: 'vest',
  cloth: OILSKIN,
  trim: OILSKIN,
  sleeve: [0xc89a7e, 0x9e705a, 0xdeb294],
  trouser: [0x2e2c2a, 0x1e1c1a, 0x44403c],
  boot: [0x1e1c1c, 0x121010, 0x343030],
  belt: [0x3a2a1e, 0x241a12, 0x54402e],
  weapon: 'boathook',
  rag: RUST_RAG,
  tattoo: 0x2a3a5a,
  scar: 0xe0b098,
  iris: 0x5a5a4a,
  brow: 0x3a2e26,
  lip: 0x8a5a4a,
  browSlant: 0.1,
  size: 1.16,
  bulk: 1.26,
};

/** The pawnshop's people drawn finely, by folk id. */
export const PAWN_FOLK: Record<string, (pose: Pose3D) => Model> = {
  nettle: (pose) => asChild(roseModel(pose, NETTLE), 26, 0.86, 0.92),
  dace: brigandFolkModel(DACE),
  orm: brigandFolkModel(ORM),
};

/** Draws them as 'folk-<id>', and the two Hooks' fighting sheets ('creature-hookgaff' and 'creature-hookbrute'). */
export function generatePawnFolk(scene: Phaser.Scene): void {
  for (const [id, build] of Object.entries(PAWN_FOLK)) generateFigure3D(scene, `folk-${id}`, build, FINE_SPEC);
  generateBeast(scene, 'hookgaff', lookSheet(DACE, fineSpec(shownSpec(false))), 10, BRIGAND_ANIMS);
  generateBeast(scene, 'hookbrute', lookSheet(ORM, fineSpec(shownSpec(true))), 8, BRIGAND_ANIMS);
}
