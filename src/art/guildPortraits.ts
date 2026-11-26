import type Phaser from 'phaser';
import type { PixelCanvas } from './PixelCanvas';
import { blob, CX, EYE_Y, lightness, mix, paintPortrait, PORTRAIT_S as S, ramp, specs, tone, townsfolk, type Painter } from './portraits';

/**
 * Faces for the Guildhall of the Causeway Merchants on Gloomhaven's Staithe
 * (see art/guildhall3d.ts for the same people in the round): painted on the
 * same face, eyes and shading as everyone else's portraits (art/portraits.ts),
 * with their own touches: the guildmaster's chain and fur, Dame Marrable's
 * braided crown, Tunstall's feathered hat, Thrale's ring, Edric's spectacles
 * and saffron sash, Pim's pen behind his ear, Garrow's bandage.
 */

/** A gold chain of office across the shoulders, a blue-enamelled medallion at the middle. */
function chainOfOffice(c: PixelCanvas): void {
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    for (const side of [-1, 1]) {
      const x = Math.round(CX + side * (24 - t * 22));
      const y = Math.round(78 + t * 12 + Math.sin(t * Math.PI) * 2);
      c.set(x, y, i % 2 ? 0xecca70 : 0x8a6a28);
      c.set(x, y + 1, 0x6a4e1c);
    }
  }
  blob(c, CX, 93, 4, 3.5, ramp(0xc8a048), 0.1);
  blob(c, CX, 93, 2, 1.8, ramp(0x2e3e5a), 0.1);
}

/** A collar of grey fur over the shoulders. */
function furCollar(c: PixelCanvas, color: number): void {
  const fur = ramp(color);
  for (let y = 72; y < 86; y++) {
    for (let x = 0; x < S; x++) {
      const dx = Math.abs(x + 0.5 - CX);
      if (dx < 12 + (y - 72) * 0.5 || dx > 40 - (y - 72) * 0.2) continue;
      const tuft = ((x * 7 + y * 3) % 5) / 5 - 0.4;
      c.set(x, y, tone(fur, lightness((x - CX) / 36, (y - 78) / 12) + tuft * 0.3, x, y));
    }
  }
}

/** Guildmaster Wexley: stout and florid, white mutton-chops, tired eyes, burgundy, fur and the gold chain. */
const wexley = townsfolk({
  skin: 0xe8b496, hair: 0xe0dcd4, style: 'bald', cloth: 0x5a1e26, shirt: 0xe0d8c4,
  iris: 0x5a6a7a, brow: 'worried', smile: 0, width: 20, jaw: 12, old: true, tired: true, nose: 2, blush: [0xd8705e, 0.4], look: 0,
  over: (c) => {
    // Mutton-chop whiskers down each cheek, white.
    const white = ramp(0xe0dcd4);
    for (const side of [-1, 1]) {
      for (let y = EYE_Y; y < 70; y++) {
        const x0 = CX + side * (18 - (y - EYE_Y) * 0.15);
        for (let k = 0; k < 6; k++) {
          const x = Math.round(x0 - side * k);
          if (c.get(x, y) === null) continue;
          c.set(x, y, tone(white, lightness(side * 0.6, (y - 58) / 20) + ((x + y) % 3 === 0 ? -0.15 : 0), x, y));
        }
      }
    }
    furCollar(c, 0x8a8478);
    chainOfOffice(c);
  },
});

/** Dame Isolde Marrable: spare and severe, iron-grey braids round her head, green riding coat, a high grey collar. */
const marrable = townsfolk({
  skin: 0xe6cbb6, hair: 0x8a8288, style: 'bun', cloth: 0x2a3e30, shirt: 0x8a8a8e,
  iris: 0x5a7a6a, brow: 'stern', smile: -1, width: 15.5, jaw: 6, lashes: true, old: true, nose: 1, look: -1,
  over: (c) => {
    // A braid laid round the crown like a coronet.
    const braid = ramp(0x9a949a);
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const x = CX - 18 + t * 36;
      const y = 25 - Math.sin(t * Math.PI) * 8;
      blob(c, x, y, 2.6, 2.2, braid, 0.05);
    }
    // The coat's high collar, turned up, and its brass buttons.
    const coat = ramp(0x2a3e30);
    for (let y = 70; y < 80; y++) {
      for (const side of [-1, 1]) for (let k = 0; k < 5; k++) c.set(CX + side * (9 + k + Math.round((y - 70) * 0.3)), y, tone(coat, lightness(side * 0.5, (y - 75) / 8), CX + side * (9 + k), y));
    }
    for (let y = 84; y < S; y += 5) c.set(CX + 6, y, 0xc8a048);
  },
});

/** Master Tunstall: round, pink and sweating, a mulberry coat over a yellow waistcoat, a feathered hat. */
const tunstall = townsfolk({
  skin: 0xf0c0a4, hair: 0x8a6a4a, style: 'short', cloth: 0x5a2a4a, shirt: 0xb89a3a, cap: 0x3a2a3a, feather: 0xe8e0d0,
  iris: 0x6a5a3a, brow: 'worried', smile: -1, width: 21, jaw: 13, nose: 1, blush: [0xe08878, 0.55], look: 1,
  over: (c) => {
    // Sweat on the brow and the lip, catching the light.
    for (const [x, y] of [[CX - 8, 37], [CX + 6, 36], [CX - 2, 38], [CX + 3, EYE_Y + 13], [CX - 4, EYE_Y + 13]]) c.set(x, y, 0xfff0e0);
    // A double chin over the stock.
    for (let x = CX - 10; x <= CX + 10; x++) c.set(x, 71, mix(0xf0c0a4, 0x8a5a4a, 0.4));
  },
});

/** Master Thrale: handsome and easy, a close dark beard, a knowing half-smile, charcoal velvet, a silver ring at his chin. */
const thrale = townsfolk({
  skin: 0xdcb092, hair: 0x2a2224, style: 'short', cloth: 0x34323a, shirt: 0x8a8a94,
  iris: 0x4a3a2a, brow: 'arched', smile: 1, width: 16.5, jaw: 9, beard: 0x2a2224, nose: 1, look: 1,
  over: (c) => {
    // His hand raised to his beard, a silver ring on it.
    const skin = ramp(0xdcb092);
    blob(c, CX + 22, 74, 6, 8, skin, 0.1);
    for (let i = 0; i < 4; i++) c.set(CX + 18 + i * 2, 68, mix(0xdcb092, 0x6a4a3a, 0.4));
    blob(c, CX + 20, 73, 2, 1.6, ramp(0xd8d8e4), 0.2);
    c.set(CX + 19, 72, 0xffffff);
    // A silver pin at the throat.
    blob(c, CX, 80, 1.6, 1.6, ramp(0xc8c8d0), 0.2);
  },
});

/** Edric Lowe: lean and eager, untidy brown hair, round spectacles, freckles, a saffron sash. */
const edric = townsfolk({
  skin: 0xe8c0a0, hair: 0x6a4a30, style: 'curly', cloth: 0x5a4632, shirt: 0xd8d0bc,
  iris: 0x5a6a3a, brow: 'worried', smile: 0, width: 15, jaw: 6, freckles: true, nose: 1, look: -1,
  over: (c) => {
    specs(c, 'pair');
    // The sash, from the shoulder across the chest.
    const silk = ramp(0xc8962e);
    for (let y = 76; y < S; y++) {
      const x0 = CX + 24 - (y - 76) * 1.6;
      for (let x = Math.round(x0 - 3); x <= Math.round(x0 + 3); x++) if (c.get(x, y) !== null) c.set(x, y, tone(silk, lightness(0, (y - 86) / 10) + Math.sin(x * 0.8) * 0.08, x, y));
    }
    // Ink on his fingers, held up as he talks.
    blob(c, CX - 26, 84, 5, 6, ramp(0xe8c0a0), 0.1);
    for (const [x, y] of [[CX - 28, 80], [CX - 25, 79]]) c.set(x, y, 0x2a2420);
  },
});

/** Pim Weatherby: small and bald on top, a mousy fringe, spectacles on the end of his nose, a pen behind his ear. */
const pim = townsfolk({
  skin: 0xecccb4, hair: 0x8a7a60, style: 'bald', cloth: 0x262428, shirt: 0xe0dcd0,
  iris: 0x6a7a8a, brow: 'worried', smile: 1, width: 15, jaw: 6, nose: 2, look: 1,
  over: (c) => {
    specs(c, 'pair', 0x9a9aa4);
    // The quill behind his right ear.
    for (let i = 0; i < 16; i++) {
      const x = CX + 17 + Math.round(i * 0.5);
      const y = EYE_Y + 6 - i;
      c.set(x, y, i < 3 ? 0x2a2420 : 0xf0ece0);
      if (i > 4) c.set(x + 1, y, 0xd8d0c0);
    }
    // An ink smudge on his cheek.
    for (const [x, y] of [[CX - 11, 58], [CX - 10, 59]]) c.set(x, y, 0x3a3440);
  },
});

/** Nat Garrow: weathered, a grizzled beard, a bloody bandage round his head, a leather jerkin. */
const garrow = townsfolk({
  skin: 0xc8946e, hair: 0x8a7a6a, style: 'short', cloth: 0x5a4230, shirt: 0x8a7a5a,
  iris: 0x5a4a3a, brow: 'heavy', smile: 0, width: 18, jaw: 10, old: true, tired: true, beard: 0x8a7a6a, nose: 3, scar: true, blush: [0xb86a54, 0.3], look: 0,
  over: (c) => {
    // The bandage, round the brow and over one ear, a red stain soaking through at the temple.
    const linen = ramp(0xe0d8c4);
    for (let y = 27; y < 36; y++) {
      for (let x = CX - 24; x <= CX + 24; x++) {
        if (c.get(x, y) === null) continue;
        const wrap = Math.sin((x + y * 2) * 0.5) * 0.08;
        const stain = Math.hypot(x - (CX + 15), y - 31) < 4;
        c.set(x, y, stain ? (Math.hypot(x - (CX + 15), y - 31) < 2.5 ? 0x8a2a1a : 0xb85040) : tone(linen, lightness((x - CX) / 26, (y - 31) / 6) + wrap, x, y));
      }
    }
    // The sling's strap over the shoulder.
    for (let y = 74; y < S; y++) for (let k = -2; k <= 2; k++) c.set(Math.round(CX - 20 + (y - 74) * 0.9) + k, y, k === -2 ? 0xa8a088 : 0xd8d0bc);
  },
});

/** The Guildhall's speakers, by speaker id. */
const GUILD_PAINTERS: Record<string, Painter> = { wexley, marrable, tunstall, thrale, edric, pim, garrow };

export function generateGuildPortraits(scene: Phaser.Scene): void {
  for (const [id, paint] of Object.entries(GUILD_PAINTERS)) paintPortrait(scene, id, paint);
}
