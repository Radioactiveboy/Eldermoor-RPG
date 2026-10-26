import Phaser from 'phaser';
import { generateCharacter, Outfit } from './character';
import { PALETTE as P } from './palette';

/**
 * Travelling folk met on the road. Each walks with the hero's body in their own
 * clothes (see character.ts); their talking portraits are in portraits.ts.
 */
export const FOLK: Record<string, Outfit> = {
  // Bram the pedlar: felt hat, grizzled beard, a mustard coat and a heavy pack.
  pedlar: {
    cloak: [0xa07a34, 0x7a5a24, 0xc29a4c],
    hood: false,
    tunic: [0x7a3a2e, 0x5a2820, 0x9a4e3c],
    shirt: [P.linen, P.linenDark],
    trouser: [0x5a4634, 0x40322a],
    boots: [P.leatherDark, P.barkDark, P.leather],
    skin: [0xe6b48c, 0xc08c6a],
    hair: 0x7a6656,
    hat: [0x5e4a3a, 0x463628, 0x786050],
    beard: 0x9a8a7a,
    pack: true,
  },
  // Sister Ysolde, a pilgrim: grey hooded robe and a tall staff.
  pilgrim: {
    cloak: [0x8a8690, 0x67636e, 0xaba8b0],
    hood: true,
    tunic: [0x6e6a74, 0x504c56, 0x8a8690],
    shirt: [0x8a8690, 0x67636e],
    trouser: [0x504c56, 0x3e3a44],
    boots: [P.leatherDark, P.barkDark, P.leather],
    skin: [0xeac0a0, 0xc8987c],
    hair: 0x3a2a24,
    robe: true,
    staff: true,
  },
  // Wil the drover: a lad in a blue tunic with a hazel switch for driving sheep.
  drover: {
    cloak: null,
    hood: false,
    tunic: [0x3d5a8a, 0x2c4266, 0x5577aa],
    shirt: [P.linen, P.linenDark],
    trouser: [0x6b4a30, 0x4a3020],
    boots: [P.leather, P.leatherDark, P.leatherLight],
    skin: [P.skin, P.skinShade],
    hair: 0xb4562a,
    staff: true,
  },
  // Hilde the baker: flour-dusted apron over a rose dress, fair hair.
  baker: {
    cloak: null,
    hood: false,
    tunic: [0xece4d4, 0xc8bca6, 0xfffaf0],
    shirt: [0xb0605a, 0x8a4440],
    trouser: [0x8a4440, 0x6a3030],
    boots: [P.leatherDark, P.barkDark, P.leather],
    skin: [0xf2caa4, 0xd09e7c],
    hair: 0xd8b060,
    robe: true,
  },
  // Osric the smith: bald and black-bearded, in a scorched leather apron.
  smith: {
    cloak: null,
    hood: false,
    tunic: [0x3e2a20, 0x2a1c16, 0x56402e],
    shirt: [0x6e6a62, 0x504c46],
    trouser: [0x3a3032, 0x2a2224],
    boots: [P.barkDark, P.ink, P.bark],
    skin: [0xd8a07a, 0xb07a5a],
    hair: 0xd8a07a,
    beard: 0x2a2024,
  },
  // Tamsin the tanner: red hair, a green jerkin and a short brown cloak.
  tanner: {
    cloak: [0x7a5434, 0x5a3c24, 0x96704a],
    hood: false,
    tunic: [0x4e6a3a, 0x3a5028, 0x6a8a4e],
    shirt: [P.linen, P.linenDark],
    trouser: [0x5a4634, 0x40322a],
    boots: [P.leather, P.leatherDark, P.leatherLight],
    skin: [0xf0c8a6, 0xcc9c7c],
    hair: 0xb04a24,
  },
  // The militia: kettle helm, mail under a blue-and-gold tabard, and a spear.
  guard: {
    cloak: null,
    hood: false,
    tunic: [0x2e4a7a, 0x22365a, 0x40629a],
    shirt: [P.ironLight, P.iron],
    trouser: [0x3a3032, 0x2a2224],
    boots: [P.leatherDark, P.barkDark, P.leather],
    skin: [P.skin, P.skinShade],
    hair: 0x4a3020,
    hat: [P.ironLight, P.iron, P.stoneLight],
    staff: true,
    spear: true,
    mail: true,
  },
};

export function generateFolk(scene: Phaser.Scene): void {
  for (const [id, outfit] of Object.entries(FOLK)) {
    generateCharacter(scene, `folk-${id}`, outfit);
  }
}
