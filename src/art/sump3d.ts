import type Phaser from 'phaser';
import type { Tones } from './character';
import { roseModel, type RoseLook } from './blackrose3d';
import { generateFigure3D, limb, Model, Pose3D } from './figure3d';
import { FINE_SPEC } from './fine3d';

/**
 * The folk of the Sump, Gloomhaven's lowest lane (world/SumpMaps.ts), drawn
 * finely on the Black Rose's frame (blackrose3d.ts): Annis Crowe, Wisp's mam,
 * in a faded blue dress and the Rose's apron; the Widow Nan Pruett, tiny and
 * bent in rusty black under a white cap; and Ned Wick the lamplighter, long
 * and thin and twitchy, with his pole.
 */

const BOOT: Tones = [0x3a2a20, 0x241a14, 0x54402e];
const BELT: Tones = [0x3a2a1e, 0x241a12, 0x523c2a];

export const SUMP_LOOKS: Record<string, RoseLook> = {
  /**
   * Annis Crowe: thirty, thin and worn, pretty once and still when she
   * smiles, which isn't often; Wisp's red-brown hair, pinned up anyhow; a
   * faded blue dress darned at the elbows, a grey shawl, and the Rose's apron
   * with the black rose stitched on its bib; tired, frightened eyes.
   */
  annis: {
    bulk: 0.9,
    skin: [0xf0c8a8, 0xc8a080, 0xfcdcc0],
    hair: [0x8a4a26, 0x64341a, 0xa8603a],
    hairStyle: 'bun',
    beard: 'none',
    garment: 'dress',
    outer: [0x5a6a82, 0x3e4a5e, 0x76869e],
    inner: [0xd8ccb4, 0xaea28a, 0xece2cc],
    waistcoat: [0x4a4a58, 0x34343e, 0x62627a],
    trouser: [0x4a3a30, 0x30261e, 0x605044],
    boot: BOOT,
    belt: BELT,
    apron: [0xc8bca0, 0x9a8e76, 0xe0d6bc],
    shawl: [0x7a7470, 0x5a5450, 0x9a9490],
    ragged: true,
    right: 'none',
    left: 'swing',
    iris: 0x6a8a4a,
    brow: 0x64341a,
    browSlant: -0.35,
    lip: 0xb8786a,
    mouthWidth: 2,
    lashes: 0x4a2a1a,
    freckles: 0xd09070,
    hollow: 0xc89a88,
  },
  /**
   * The Widow Nan Pruett: past eighty, tiny and bent nearly double, sharp as
   * a needle; a white linen cap over thin white hair, a dress of rusty black
   * gone brown, a dark green shawl, a sacking apron stiff with tallow, hands
   * folded, and eyes that miss nothing.
   */
  nan: {
    bulk: 0.84,
    tall: 0.9,
    stoop: 0.85,
    skin: [0xd8b098, 0xb08a72, 0xeac4ac],
    hair: [0xe0dcd4, 0xb8b4ac, 0xf4f0e8],
    grey: [0xe0dcd4, 0xb8b4ac, 0xf4f0e8],
    hairStyle: 'bun',
    beard: 'none',
    hat: 'kerchief',
    hatCloth: [0xe0d8c8, 0xb8b0a0, 0xf0eadc],
    garment: 'dress',
    outer: [0x3a322c, 0x26201c, 0x504640],
    inner: [0xd8ccb4, 0xaea28a, 0xece2cc],
    trouser: [0x3a322c, 0x26201c, 0x504640],
    boot: BOOT,
    belt: BELT,
    apron: [0x8a7a5a, 0x6a5c42, 0xa8987a],
    shawl: [0x3e4e36, 0x2a3624, 0x56684a],
    ragged: true,
    right: 'none',
    left: 'folded',
    iris: 0x5a6a7a,
    brow: 0xc8c4bc,
    browSlant: 0.2,
    lip: 0xa0705e,
    mouthWidth: 2,
    smile: true,
  },
  /**
   * Ned Wick, the lamplighter: long, thin and stooping, forty and looking
   * fifty, sandy stubble and a knitted cap pulled down to his ears, a long
   * coat of oiled brown canvas with soot on the cuffs, a leather apron with
   * pockets of wicks and flints, and his pole, never out of his hand.
   */
  ned: {
    bulk: 0.86,
    tall: 1.08,
    stoop: 0.35,
    skin: [0xe0b898, 0xb8907a, 0xf2ccae],
    hair: [0xa8865a, 0x806440, 0xc8a478],
    hairStyle: 'short',
    beard: 'stubble',
    hat: 'cap',
    hatCloth: [0x6a4a3a, 0x4a3428, 0x86604c],
    garment: 'coat',
    outer: [0x5a4a36, 0x3e3226, 0x766248],
    inner: [0xb8ae98, 0x8e8672, 0xd0c8b2],
    waistcoat: [0x4a3a2a, 0x30261c, 0x62503a],
    trouser: [0x3e3a34, 0x2a2622, 0x56504a],
    boot: BOOT,
    belt: BELT,
    apron: [0x6e4a2c, 0x4a301c, 0x8a6040],
    right: 'none',
    left: 'swing',
    iris: 0x7a8a9a,
    brow: 0x806440,
    browSlant: -0.5,
    lip: 0xa86a5e,
    mouthWidth: 2,
    hollow: 0xb08a78,
  },
};

const POLE: Tones = [0x7a5a3c, 0x58402a, 0x957250];
const BRASS: Tones = [0xb8903a, 0x8a6a28, 0xe0c070];

/** Ned with his pole: grounded beside his right foot, up past his head, his hand round it, a brass hook and wick-cup at the top. */
function nedModel(pose: Pose3D): Model {
  const m = roseModel(pose, SUMP_LOOKS.ned);
  if (pose.sit) return m;
  const foot: [number, number, number] = [-7.2, 0, 2.2];
  const top: [number, number, number] = [-6.6, 50, 1.6];
  m.solids.push(...limb(foot, top, 0.45, 0.4, POLE, 0.5));
  m.solids.push(...limb([top[0], top[1], top[2]], [top[0] + 1.6, top[1] + 1.4, top[2] + 0.6], 0.35, 0.3, BRASS, 0.3));
  m.solids.push({ cx: top[0], cy: top[1] + 0.8, cz: top[2], rx: 0.7, ry: 1, rz: 0.7, material: BRASS });
  return m;
}

/** The Sump's people drawn finely, by folk id. */
export const SUMP_FOLK: Record<string, (pose: Pose3D) => Model> = {
  annis: (pose) => roseModel(pose, SUMP_LOOKS.annis),
  nan: (pose) => roseModel(pose, SUMP_LOOKS.nan),
  ned: nedModel,
};

/** Draws them all, as 'folk-<id>', eight directions each. */
export function generateSumpFolk(scene: Phaser.Scene): void {
  for (const [id, build] of Object.entries(SUMP_FOLK)) generateFigure3D(scene, `folk-${id}`, build, FINE_SPEC);
}
