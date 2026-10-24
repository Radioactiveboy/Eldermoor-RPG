import Phaser from 'phaser';
import { darker, generateCharacter, Outfit } from './character';
import { PORTRAIT_SIZE } from './npc';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Travelling folk met on the road. Each walks with the hero's body in their own
 * clothes (see character.ts) and has a talking portrait for conversations.
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
};

/** Head and shoulders for the dialogue box. Frames: 0 mouth closed, 1 mouth open, 2 blinking. */
function drawPortrait(c: PixelCanvas, o: Outfit, mouthOpen: boolean, blink: boolean): void {
  const [cloth, clothDark, clothLight] = o.cloak ?? o.tunic;
  const [skin, skinShade] = o.skin;
  if (o.hood) c.ellipse(32, 30, 19, 21, cloth, clothDark, clothLight);
  else if (!o.hat) c.ellipse(32, 27, 15, 15, o.hair, darker(o.hair));
  // Shoulders, neck and collar.
  c.ellipse(32, 68, 30, 18, cloth, clothDark, clothLight);
  if (o.cloak && !o.hood) c.ellipse(32, 70, 18, 14, o.tunic[0], o.tunic[1], o.tunic[2]);
  c.shadedRect(27, 42, 11, 12, skinShade, skinShade);
  for (let y = 52; y < 60; y++) {
    const half = (y - 50) * 0.7;
    c.rect(32 - half, y, half * 2, 1, o.shirt[0]);
  }
  if (o.pack) {
    // Pack straps over the shoulders.
    c.rect(17, 54, 3, 10, P.leatherDark);
    c.rect(44, 54, 3, 10, P.leatherDark);
  }

  c.ellipse(32, 33, 12.5, 15, skin, skinShade);

  // Hair (or the hood's rim) over the forehead.
  if (o.hood) {
    for (let y = 12; y < 26; y++) {
      for (let x = 14; x < 51; x++) {
        const nx = (x + 0.5 - 32) / 19;
        const ny = (y + 0.5 - 30) / 21;
        if (nx * nx + ny * ny > 1) continue;
        const line = 21 + Math.pow((x - 32) / 12, 2) * 9;
        if (y <= line) c.set(x, y, y > line - 2 ? clothDark : x > 40 ? clothDark : cloth);
      }
    }
    c.rect(20, 25, 3, 3, o.hair);
    c.rect(42, 25, 3, 3, o.hair);
  } else {
    for (let y = 14; y < 26; y++) {
      for (let x = 18; x < 47; x++) {
        const line = 22 + Math.pow((x - 32) / 12, 2) * 6 + ((x >> 1) % 2);
        if (y > line || (x - 32) ** 2 / 196 + (y - 26) ** 2 / 144 > 1) continue;
        c.set(x, y, x > 40 || (x + y) % 5 === 0 ? darker(o.hair) : o.hair);
      }
    }
  }
  if (o.hat) {
    c.ellipse(32, 11, 13, 8, o.hat[0], o.hat[1], o.hat[2]);
    c.rect(19, 15, 26, 2, P.leatherDark);
    c.ellipse(32, 19, 25, 4.5, o.hat[0], o.hat[1], o.hat[2]);
  }

  // Brows, eyes, nose.
  for (let i = 0; i < 5; i++) {
    c.set(24 + i, 27, o.hood ? P.ink : o.hair);
    c.set(36 + i, 27, o.hood ? P.ink : o.hair);
  }
  for (const ex of [27, 37]) {
    if (blink) {
      c.rect(ex - 2, 31, 5, 1, skinShade);
    } else {
      c.rect(ex - 2, 30, 5, 2, P.flowerWhite);
      c.rect(ex - 1, 30, 2, 2, P.eye);
      c.set(ex - 1, 30, P.stoneLight);
    }
  }
  for (let y = 32; y < 38; y++) c.set(34, y, skinShade);
  c.rect(32, 38, 3, 1, skinShade);

  if (o.beard !== undefined) {
    c.ellipse(32, 44, 11.5, 7, o.beard, P.stone);
    c.rect(26, 39, 12, 2, o.beard); // moustache
  }
  if (mouthOpen) {
    c.rect(29, 42, 7, 1, P.lip);
    c.rect(30, 43, 5, 2, P.ink);
  } else {
    c.rect(29, 43, 7, 1, o.beard !== undefined ? P.ink : P.lip);
    if (o.beard === undefined) {
      c.set(28, 42, skinShade);
      c.set(36, 42, skinShade);
    }
  }
  c.outline();
}

export function generateFolk(scene: Phaser.Scene): void {
  for (const [id, outfit] of Object.entries(FOLK)) {
    generateCharacter(scene, `folk-${id}`, outfit);
    const sheet = new PixelCanvas(PORTRAIT_SIZE * 3, PORTRAIT_SIZE);
    [
      [false, false],
      [true, false],
      [false, true],
    ].forEach(([mouth, blink], i) => {
      const frame = new PixelCanvas(PORTRAIT_SIZE, PORTRAIT_SIZE);
      drawPortrait(frame, outfit, mouth, blink);
      sheet.blit(frame, i * PORTRAIT_SIZE, 0);
    });
    const tex = sheet.toTexture(scene, `portrait-${id}`);
    for (let i = 0; i < 3; i++) tex.add(i, 0, i * PORTRAIT_SIZE, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
  }
}
