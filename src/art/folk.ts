import Phaser from 'phaser';
import { generateCharacter, Outfit } from './character';
import { PALETTE as P } from './palette';
import { MORTEN } from './tollgate';

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
  // Lord Morten's toll guards: a blackened helm, mail under his crimson, and a spear.
  tollguard: {
    cloak: [MORTEN.black, 0x18141a, 0x3a343c],
    hood: false,
    tunic: [MORTEN.crimson, MORTEN.crimsonDark, MORTEN.crimsonLight],
    shirt: [P.ironLight, P.iron],
    trouser: [0x2a2224, 0x1d1620],
    boots: [P.barkDark, P.ink, P.bark],
    skin: [0xd8a482, 0xb07a5a],
    hair: 0x2a2024,
    hat: [0x4e4a56, 0x36323e, 0x6a6672],
    beard: 0x2a2024,
    staff: true,
    spear: true,
    mail: true,
  },
  // Odo the carter: flat cap, russet coat, a blue neckerchief.
  carter: {
    cloak: null,
    hood: false,
    tunic: [0x8a4a2a, 0x66361e, 0xa8623c],
    shirt: [0x2e5a7a, 0x22465e],
    trouser: [0x4e4234, 0x3a3026],
    boots: [P.leatherDark, P.barkDark, P.leather],
    skin: [0xe0a07c, 0xbc7c5c],
    hair: 0x6a4a30,
    hat: [0x5a5a3e, 0x44442e, 0x74745a],
    beard: 0x6a4a30,
  },
  // Ness the herb-gatherer: a sage-green hooded cloak over a brown dress, a staff, and her basket on her back.
  herbwife: {
    cloak: [0x6a7a52, 0x4e5c3a, 0x86966a],
    hood: true,
    tunic: [0x7a5a46, 0x5a4232, 0x96745a],
    shirt: [0x7a5a46, 0x5a4232],
    trouser: [0x5a4232, 0x42301e],
    boots: [P.leatherDark, P.barkDark, P.leather],
    skin: [0xd8a888, 0xb08468],
    hair: 0x6a625e,
    robe: true,
    staff: true,
    pack: true,
  },
  // Farmer Iran: a battered straw hat, a grey beard and an undyed wool smock.
  iran: {
    cloak: null,
    hood: false,
    tunic: [0x9a8a6a, 0x766850, 0xb4a682],
    shirt: [0x7a5a3a, 0x5a4028],
    trouser: [0x4e4234, 0x3a3026],
    boots: [P.barkDark, P.ink, P.bark],
    skin: [0xc8906a, 0xa06e50],
    hair: 0x3a2e28,
    hat: [P.straw, P.strawDark, P.strawLight],
    beard: 0x7a706a,
  },
  // Iran's children. Pip: a scruffy lad in a patched green tunic.
  pip: {
    cloak: null,
    hood: false,
    tunic: [0x5a7a3a, 0x42602a, 0x76964e],
    shirt: [P.linen, P.linenDark],
    trouser: [0x6b4a30, 0x4a3020],
    boots: [P.leather, P.leatherDark, P.leatherLight],
    skin: [0xd8a07a, 0xb07a5a],
    hair: 0x2e2420,
    child: true,
  },
  // Hetty: his little sister, in a blue dress.
  hetty: {
    cloak: null,
    hood: false,
    tunic: [0x5a74a8, 0x42588a, 0x7a94c4],
    shirt: [P.linen, P.linenDark],
    trouser: [0x42588a, 0x32446a],
    boots: [P.leather, P.leatherDark, P.leatherLight],
    skin: [0xd8a07a, 0xb07a5a],
    hair: 0x3a2a22,
    robe: true,
    child: true,
  },
};

export function generateFolk(scene: Phaser.Scene): void {
  for (const [id, outfit] of Object.entries(FOLK)) {
    generateCharacter(scene, `folk-${id}`, outfit);
  }
}
