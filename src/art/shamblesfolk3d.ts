import type Phaser from 'phaser';
import type { Tones } from './character';
import { generateBeast, wolfSheet, type WolfCoat } from './beasts3d';
import { roseModel, type RoseLook } from './blackrose3d';
import { brigandFolkModel, FLAY, KNACKER } from './brigands3d';
import { generateFigure3D, type Model, type Pose3D } from './figure3d';
import { FINE_SPEC } from './fine3d';

/**
 * The people of the Shambles (world/ShamblesMap.ts), drawn finely like the
 * Black Rose's (they're built with the same {@link roseModel}): Saul Rendle,
 * "the Gaffer", in his spotless white shirt under an apron stiff with old
 * blood; Morrow Vetch the tanner, stained to the elbow; Old Scritch the
 * rat-catcher with his pole of rats; Tam Rudd, hiding, unshaven; Lugs the
 * dog-lad in an apron too big for him. Ned Flay and the knacker Gristle are
 * the Red Aprons' fighters, so they're drawn as the brigands are (see FLAY and
 * KNACKER in brigands3d.ts), and fight as 'apronflay' and 'apronknacker'.
 *
 * And the dogs: Nothing, Scritch's grey lurcher, and the brindled pit dogs.
 */

const BOOT: Tones = [0x3a2a20, 0x241a14, 0x54402e];
const BELT: Tones = [0x3a2a1e, 0x241a12, 0x523c2a];
const APRON: Tones = [0x6a4a34, 0x4a3224, 0x84603e];
const OLD_BLOOD = 0x5a221c;
const TAN_LIQUOR = 0x3e2a1a;
const WHITE: Tones = [0xf0ece4, 0xc8c2b8, 0xffffff];

export const SHAMBLES_LOOKS: Record<string, RoseLook> = {
  /**
   * Saul Rendle, "the Gaffer": wide, bald and soft-spoken, very clean hands, a
   * spotless white shirt buttoned to the throat under a leather apron gone
   * stiff and brown with old blood, a cleaver at rest in his hand.
   */
  rendle: {
    bulk: 1.22,
    belly: 0.7,
    skin: [0xe8c4a8, 0xc09c84, 0xf8dcc4],
    ruddy: 0xd8968a,
    hair: [0x8a7060, 0x6a5444, 0xa48a78],
    hairStyle: 'bald',
    beard: 'none',
    garment: 'smock',
    outer: WHITE,
    inner: WHITE,
    trouser: [0x3a3634, 0x262422, 0x524c4a],
    boot: BOOT,
    belt: BELT,
    apron: APRON,
    stain: OLD_BLOOD,
    right: 'cleaver',
    left: 'folded',
    iris: 0x6a7a8a,
    brow: 0x8a7060,
    browSlant: 0.1,
    lip: 0xa06a64,
    mouthWidth: 1.2,
    smile: true,
  },
  /**
   * Morrow Vetch, the master tanner: lean and grey, his forearms dyed brown to
   * the elbow by the pits, a scraping knife, a shapeless cap, ashamed of the
   * barn he lets the Aprons have.
   */
  vetch: {
    tall: 1.02,
    bulk: 0.94,
    stoop: 0.35,
    skin: [0xd8b494, 0xb08c70, 0xecc8a8],
    hair: [0x6a6258, 0x4a443e, 0x8a8278],
    grey: [0xa8a29a, 0x847e76, 0xc8c2ba],
    hairStyle: 'short',
    beard: 'short',
    hat: 'cap',
    hatCloth: [0x5a4e3e, 0x3e3428, 0x766a58],
    garment: 'smock',
    outer: [0x7a6a50, 0x5a4c38, 0x968668],
    inner: [0x9a8a70, 0x7a6c56, 0xb4a48a],
    trouser: [0x4a4034, 0x322a22, 0x62564a],
    boot: BOOT,
    belt: BELT,
    apron: [0x4a3626, 0x30221a, 0x664a34],
    stain: TAN_LIQUOR,
    right: 'knife',
    left: 'swing',
    iris: 0x6a5a3a,
    brow: 0x7a7268,
    browSlant: -0.35,
    lip: 0x9a6a5a,
    hollow: 0xa08870,
  },
  /**
   * Old Scritch, the rat-catcher: small and bent and very old, a long patched
   * coat with its pockets full of traps, a slouch hat, a whiskery chin, and
   * his pole hung with the day's rats.
   */
  scritch: {
    tall: 0.92,
    bulk: 0.86,
    stoop: 0.7,
    skin: [0xd8b090, 0xac8670, 0xecc4a4],
    ruddy: 0xc8806a,
    hair: [0xb8b0a4, 0x908a80, 0xd8d2c8],
    hairStyle: 'shaggy',
    beard: 'stubble',
    hat: 'slouch',
    hatCloth: [0x4a4038, 0x302a24, 0x645850],
    garment: 'coat',
    outer: [0x5a5040, 0x3e3628, 0x766a58],
    inner: [0x8a7e6a, 0x6a604e, 0xa49882],
    waistcoat: [0x6a3a2a, 0x4a281e, 0x864e3a],
    trouser: [0x4a4238, 0x322c26, 0x625a4e],
    boot: BOOT,
    belt: BELT,
    ragged: true,
    right: 'ratpole',
    left: 'swing',
    iris: 0x7a8a6a,
    brow: 0xc8c0b4,
    browSlant: -0.2,
    lip: 0x9a6a5a,
    smile: true,
  },
  /**
   * Tam Rudd, a week in Vetch's drying loft: young, scared, unshaven, his good
   * shirt filthy and his hair full of straw.
   */
  tam: {
    bulk: 0.92,
    skin: [0xe8c4a4, 0xc09c80, 0xf8d8bc],
    hair: [0x6a4a2e, 0x4a321e, 0x866040],
    hairStyle: 'shaggy',
    beard: 'stubble',
    garment: 'jerkin',
    outer: [0x4a5a6a, 0x34404c, 0x627486],
    inner: [0xc8bca0, 0x9a8e76, 0xe0d6bc],
    trouser: [0x5a4c3a, 0x3e3428, 0x766450],
    boot: BOOT,
    belt: BELT,
    ragged: true,
    right: 'none',
    left: 'swing',
    iris: 0x5a7a9a,
    brow: 0x5a3e26,
    browSlant: -0.7,
    lip: 0xb07a6a,
    hollow: 0xb89884,
    freckles: 0xd0a080,
  },
  /**
   * Lugs, the dog-lad: sixteen, big ears, a big soft face, in an apron made
   * for a much bigger man and tied twice round.
   */
  lugs: {
    bulk: 1.02,
    skin: [0xecc8a8, 0xc4a084, 0xfcdcc0],
    ruddy: 0xe0a090,
    hair: [0x9a7a4a, 0x765a32, 0xb49462],
    hairStyle: 'crop',
    beard: 'none',
    garment: 'smock',
    outer: [0x8a7a5e, 0x6a5c46, 0xa49478],
    inner: [0x9a8c70, 0x7a6e56, 0xb4a68a],
    trouser: [0x4a4034, 0x322a22, 0x62564a],
    boot: BOOT,
    belt: BELT,
    apron: APRON,
    stain: OLD_BLOOD,
    right: 'none',
    left: 'swing',
    iris: 0x6a8aa0,
    brow: 0x8a6a3e,
    browSlant: -0.4,
    lip: 0xc08070,
    freckles: 0xd09a7a,
  },
};

/** The Shambles' people, by folk id. */
export const SHAMBLES_FOLK: Record<string, (pose: Pose3D) => Model> = {
  ...Object.fromEntries(Object.entries(SHAMBLES_LOOKS).map(([id, look]) => [id, (pose: Pose3D) => roseModel(pose, look)])),
  flay: brigandFolkModel(FLAY),
  gristle: brigandFolkModel(KNACKER),
};

/** Nothing: a rough grey lurcher, long in the leg, pale at the chest, amber-eyed. */
export const LURCHER: WolfCoat = {
  deep: 0x3a383e,
  dark: 0x5a5860,
  fur: 0x86848c,
  light: 0xaaa8ae,
  buff: 0x9a968e,
  pale: 0xd0ccc4,
  eye: 0xc89a3a,
};

/** The pit dogs: brindled brown and black, scarred, heavy in the head. */
export const PIT_DOG: WolfCoat = {
  deep: 0x241a14,
  dark: 0x3e2a1e,
  fur: 0x6a4a30,
  light: 0x8a6444,
  buff: 0x7a5a3e,
  pale: 0xb89a7a,
  eye: 0x8a5a2a,
};

export function generateShamblesFolk(scene: Phaser.Scene): void {
  for (const [id, build] of Object.entries(SHAMBLES_FOLK)) generateFigure3D(scene, `folk-${id}`, build, FINE_SPEC);
  generateBeast(scene, 'lurcher', wolfSheet(LURCHER, 0.78), 9);
  generateBeast(scene, 'pitdog', wolfSheet(PIT_DOG, 0.72), 8);
}
