import type Phaser from 'phaser';
import type { Tones } from './character';
import { speck } from './beasts3d';
import { roseModel, type RoseLook } from './blackrose3d';
import { generateFigure3D, Hit, limb, Model, Pose3D, Solid } from './figure3d';
import { FINE_SPEC, shade } from './fine3d';

/**
 * The Causeway Merchants and those about their Guildhall on Gloomhaven's
 * Staithe (world/GuildHallMap.ts), drawn finely like the Black Rose's folk and
 * built on the same body ({@link roseModel} in blackrose3d.ts), with what's
 * theirs alone put on over it: the guildmaster's chain of office and fur
 * collar, the clerk's sleeve-guards and spectacles, Edric Lowe's spectacles
 * and eastern sash, Master Thrale's silver ring, and the bandage and sling of
 * Nat Garrow, the muleteer who came back.
 */

type V3 = [number, number, number];

/** What a guild person wears over the Rose's body. */
interface GuildExtras {
  /** A gold chain of office over the shoulders, a medallion on the breast. */
  chain?: boolean;
  /** A collar of fur over the shoulders, in this. */
  fur?: Tones;
  /** Round wire spectacles, in this metal. */
  specs?: number;
  /** Black sleeve-guards over the forearms (a clerk's). */
  guards?: boolean;
  /** A silk sash across the body from the shoulder, in this. */
  sash?: Tones;
  /** A bandage round the head, a sling on the left arm. */
  hurt?: boolean;
  /** A ring that catches the light on the right hand. */
  ring?: number;
  /** A broad-brimmed hat with a turned-up side and a feather (a merchant's). */
  hat?: Tones;
}

const GOLD: Tones = [0xc8a048, 0x8a6a28, 0xecca70];
const LINEN: Tones = [0xe0d8c4, 0xb4ac98, 0xf4ecda];
const BLOOD: Tones = [0x9a3a2a, 0x6a2418, 0xb85040];

/** Where the head sits for this look and pose (as roseModel puts it). */
function headAt(pose: Pose3D, look: RoseLook): { hy: number; hz: number; Y: (y: number) => number } {
  const up = ((look.tall ?? 1) - 1) * 12;
  const sit = !!pose.sit;
  const Y = (y: number) => y + (sit ? 0 : up) - pose.bob;
  const stoop = look.stoop ?? 0;
  const lean = (y: number) => Math.max(0, y - Y(18)) * stoop * 0.32;
  return { hy: Y(32.2) - stoop * 1.6, hz: 0.4 + lean(32) + stoop * 0.8, Y };
}

function guildModel(pose: Pose3D, look: RoseLook, extra: GuildExtras): Model {
  const model = roseModel(pose, look);
  const w = look.bulk ?? 1;
  const belly = look.belly ?? 0;
  const { hy, hz, Y } = headAt(pose, look);
  const solids: Solid[] = [];
  const knob = (p: V3, r: number, m: Tones | ((h: Hit) => Tones)): Solid => ({ cx: p[0], cy: p[1], cz: p[2], rx: r, ry: r, rz: r, material: m });
  if (extra.fur) {
    const fur = extra.fur;
    const pile = (h: Hit): Tones => (speck(h, 0.9) < 0.3 ? shade(fur) : speck(h, 1.3) > 0.85 ? [fur[2], fur[0], fur[2]] : fur);
    solids.push({ cx: 0, cy: Y(25), cz: -0.2, rx: 5.9 * w, ry: 1.9, rz: 4.3 * w, material: pile });
    for (const side of [-1, 1]) solids.push(...limb([side * 2.2 * w, Y(25), 3.4 * w], [side * 1.6 * w, Y(15), 3.8 * w + belly], 1.2, 1, pile, 0.4));
  }
  if (extra.sash) solids.push(...limb([3.6 * w, Y(24.4), 2.8 * w], [-3.4 * w, Y(15.4), 3.6 * w + belly], 0.8, 0.8, extra.sash, 0.35));
  if (extra.chain) {
    // Links over the shoulders and down to a medallion on the breast.
    for (const side of [-1, 1]) {
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const p: V3 = [side * (4 - t * 4) * w, Y(25.6 - t * 5.4), 1.2 + t * (2.6 * w + belly * 0.8)];
        solids.push(knob(p, 0.42, GOLD));
      }
    }
    solids.push({ cx: 0, cy: Y(19.6), cz: 3.9 * w + belly * 0.9, rx: 1.2, ry: 1.3, rz: 0.4, material: (h) => (Math.hypot(h.x, h.y - Y(19.6)) < 0.5 ? [0x2e3e5a, 0x1e2a40, 0x4a5e7e] : GOLD) });
  }
  if (extra.specs !== undefined) {
    const metal: Tones = [extra.specs, extra.specs, extra.specs];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        model.details.push({ x: side * 1.9 + Math.cos(a) * 1.05, y: hy + 1 + Math.sin(a) * 0.85, z: hz + 5.05, color: extra.specs, size: 0.4 });
      }
    }
    solids.push(...limb([-0.9, hy + 1.1, hz + 5.2], [0.9, hy + 1.1, hz + 5.2], 0.16, 0.16, metal, 0.3));
  }
  if (extra.hurt) {
    // A bandage round the brow, stained at the temple.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      solids.push({ cx: Math.sin(a) * 5.3, cy: hy + 2.6, cz: hz + Math.cos(a) * 5.1, rx: 1.2, ry: 0.9, rz: 1.2, material: i === 13 || i === 12 ? BLOOD : LINEN, soft: true });
    }
    // The sling across the chest, the left forearm in it.
    solids.push(...limb([-3.8 * w, Y(25), 1.6], [2.6 * w, Y(18.4), 4 * w + belly], 0.7, 0.7, LINEN, 0.35));
    solids.push({ cx: 2.2 * w, cy: Y(18.2), cz: 4.4 * w + belly, rx: 2.6, ry: 1.8, rz: 1.2, material: LINEN });
  }
  if (extra.hat) {
    const hc = extra.hat;
    solids.push({ cx: 0, cy: hy + 4.6, cz: hz - 0.4, rx: 7.4, ry: 0.7, rz: 7, material: (h) => (speck(h, 1.3) < 0.1 ? shade(hc) : hc) });
    solids.push({ cx: 0, cy: hy + 6.6, cz: hz - 0.6, rx: 4.9, ry: 2.6, rz: 4.7, material: (h) => (h.y < hy + 5.6 ? [0x2a2a30, 0x1a1a1e, 0x40404a] : hc) });
    // The brim turned up at the left side, and a long feather in it.
    solids.push({ cx: 5.8, cy: hy + 6.4, cz: hz - 0.4, rx: 1.1, ry: 2.4, rz: 4.6, material: shade(hc) });
    solids.push(...limb([5, hy + 7, hz + 1], [6.4, hy + 11, hz - 5], 0.6, 0.25, [0xd8d0c0, 0xa8a090, 0xf4ecdc], 0.35));
  }
  if (extra.guards || extra.ring !== undefined) {
    // The forearms of a standing figure, as roseModel hangs them (hands at the sides).
    for (const side of [-1, 1]) {
      const right = side === -1;
      const swing = pose.sit ? 0 : -pose.stride * side * 2;
      const elbow: V3 = [side * 5.8 * w, Y(20.2), 0.3 + swing * 0.5];
      const hand: V3 = [side * 6 * w, Y(16.8), 0.8 + swing];
      if (extra.guards && !pose.sit && !(right && look.right && look.right !== 'none')) {
        solids.push(...limb(elbow, hand, 1.75 * w, 1.6 * w, [0x242024, 0x141014, 0x3a343a], 0.45).slice(1, -1));
      }
      if (right && extra.ring !== undefined) solids.push(knob([hand[0] + 0.6, hand[1] - 1.4, hand[2] + 1], 0.42, [extra.ring, extra.ring, 0xffffff]));
    }
  }
  model.solids.push(...solids);
  return model;
}

const BOOT: Tones = [0x3a2a20, 0x241a14, 0x54402e];
const BELT: Tones = [0x3a2a1e, 0x241a12, 0x523c2a];

interface GuildPerson {
  look: RoseLook;
  extra: GuildExtras;
}

/** The guild's people, by folk id. */
export const GUILD_PEOPLE: Record<string, GuildPerson> = {
  /**
   * Guildmaster Hamon Wexley: sixty, stout and florid, white mutton-chop
   * whiskers, a burgundy gown to the floor with a collar of grey fur, the gold
   * chain of office, a ring of keys, and a face that hasn't slept.
   */
  wexley: {
    look: {
      bulk: 1.12, belly: 0.8, tall: 1,
      skin: [0xe8b496, 0xc08a70, 0xf8caae], ruddy: 0xd8705e,
      hair: [0xd8d4cc, 0xb0aca4, 0xf0ece4], grey: [0xd8d4cc, 0xb0aca4, 0xf0ece4],
      hairStyle: 'short', beard: 'short',
      garment: 'dress', outer: [0x5a1e26, 0x3a1218, 0x7a2e36], inner: [0xe0d8c4, 0xb4ac98, 0xf4ecda],
      trouser: [0x3a2a2a, 0x261a1a, 0x503a3a], boot: BOOT, belt: [0x3a1a14, 0x240e0a, 0x523020],
      keys: true, right: 'none', left: 'swing',
      iris: 0x5a6a7a, brow: 0xb0aca4, browSlant: -0.3, lip: 0xa8645a, hollow: 0xc08a7a,
    },
    extra: { chain: true, fur: [0x8a8478, 0x5e5a52, 0xaaa498] },
  },
  /**
   * Dame Isolde Marrable, wool and salt: tall, fifty-odd and spare, iron-grey
   * hair braided round her head, a dark green riding coat over a high-necked
   * grey dress, black gloves, and a mouth like a shut purse.
   */
  marrable: {
    look: {
      tall: 1.04, bulk: 0.92,
      skin: [0xe6cbb6, 0xbca08c, 0xf6dcca],
      hair: [0x6a6268, 0x4a444a, 0x8a8288], grey: [0xa8a2a8, 0x807a80, 0xc8c2c8],
      hairStyle: 'bun', beard: 'none',
      garment: 'dress', outer: [0x2a3e30, 0x1a2a20, 0x3e5644], inner: [0x8a8a8e, 0x6a6a6e, 0xa8a8ac],
      waistcoat: [0x6a6a6e, 0x4a4a4e, 0x8a8a8e],
      trouser: [0x2a2a2e, 0x1a1a1e, 0x3e3e44], boot: [0x1e1a1a, 0x121010, 0x343030], belt: BELT,
      right: 'none', left: 'folded',
      iris: 0x5a7a6a, brow: 0x4a444a, browSlant: 0.5, lip: 0x8a4a4a, lashes: 0x2a2428, hollow: 0xb0988a,
    },
    extra: {},
  },
  /**
   * Master Ossian Tunstall, cloth: round, pink and frightened, a fine coat of
   * mulberry broadcloth straining at its buttons over a yellow waistcoat, a
   * feathered hat he keeps taking off, and sweat on his lip.
   */
  tunstall: {
    look: {
      bulk: 1.16, belly: 1, tall: 0.96,
      skin: [0xf0c0a4, 0xc8987e, 0xffd6bc], ruddy: 0xe08878,
      hair: [0x8a6a4a, 0x644a32, 0xa8865e],
      hairStyle: 'short', beard: 'none',
      garment: 'coat', outer: [0x5a2a4a, 0x3e1a32, 0x7a3e64], inner: [0xe8e0d0, 0xbcb4a4, 0xfaf4e8],
      waistcoat: [0xb89a3a, 0x8a7028, 0xd8b850],
      trouser: [0x3a2e3a, 0x261e26, 0x504050], boot: BOOT, belt: BELT,
      right: 'none', left: 'swing',
      iris: 0x6a5a3a, brow: 0x644a32, browSlant: -0.5, lip: 0xb86a62, mouthWidth: 3,
    },
    extra: { hat: [0x3a2a3a, 0x261a26, 0x523e52] },
  },
  /**
   * Master Gideon Thrale, river freight: forty, handsome and easy, a close
   * dark beard, a long coat of charcoal velvet, a silver-grey waistcoat, good
   * boots that have never seen the Staithe's mud, and a new silver ring.
   */
  thrale: {
    look: {
      tall: 1.04,
      skin: [0xdcb092, 0xb48a6e, 0xeec4a6],
      hair: [0x2a2224, 0x1a1416, 0x403638],
      hairStyle: 'crop', beard: 'short',
      garment: 'coat', outer: [0x34323a, 0x222026, 0x4a4852], inner: [0xe8e6e0, 0xbcbab4, 0xfaf8f2],
      waistcoat: [0x8a8a94, 0x62626c, 0xaaaab4],
      trouser: [0x2a282e, 0x1a181e, 0x3e3c44], boot: [0x1a1616, 0x0e0c0c, 0x302a2a], belt: [0x1e1c20, 0x121014, 0x343038],
      right: 'none', left: 'hip',
      iris: 0x4a3a2a, brow: 0x1a1416, browSlant: 0.2, lip: 0x9a5e54, mouthWidth: 3, smile: true,
    },
    extra: { ring: 0xd8d8e4 },
  },
  /**
   * Edric Lowe, spices and paper: twenty-eight, lean and eager, untidy brown
   * hair, round spectacles, ink on his fingers, a plain brown coat with an
   * eastern sash of faded saffron silk he brought home and won't stop wearing.
   */
  edric: {
    look: {
      bulk: 0.9, tall: 1.02,
      skin: [0xe8c0a0, 0xc09878, 0xf8d4b6],
      hair: [0x6a4a30, 0x4a321e, 0x8a6442],
      hairStyle: 'shaggy', beard: 'stubble',
      garment: 'coat', outer: [0x5a4632, 0x3e3022, 0x766048], inner: [0xd8d0bc, 0xaca490, 0xece4d0],
      waistcoat: [0x4a3a2a, 0x30261c, 0x645040],
      trouser: [0x3a342e, 0x26221e, 0x504840], boot: BOOT, belt: BELT,
      right: 'none', left: 'swing',
      iris: 0x5a6a3a, brow: 0x4a321e, browSlant: -0.2, lip: 0xa86a5e, freckles: 0xc8906c,
    },
    extra: { specs: 0xb8a070, sash: [0xc8962e, 0x946a1e, 0xe8b84a] },
  },
  /**
   * Pim Weatherby, the guild's clerk: small, bald on top and fussy, a fringe
   * of mousy hair, a black coat shiny with wear, black sleeve-guards, a pen
   * behind his ear, spectacles on the end of his nose.
   */
  pim: {
    look: {
      bulk: 0.86, tall: 0.94, stoop: 0.4,
      skin: [0xecccb4, 0xc4a48c, 0xfce0ca],
      hair: [0x8a7a60, 0x645640, 0xa8987a],
      hairStyle: 'tonsure', beard: 'none',
      garment: 'coat', outer: [0x262428, 0x161418, 0x3a383e], inner: [0xe0dcd0, 0xb4b0a4, 0xf4f0e4],
      waistcoat: [0x3a3a3e, 0x26262a, 0x52525a],
      trouser: [0x262428, 0x161418, 0x3a383e], boot: BOOT, belt: BELT,
      right: 'none', left: 'swing',
      iris: 0x6a7a8a, brow: 0x645640, browSlant: -0.4, lip: 0xb07a6a,
    },
    extra: { specs: 0x9a9aa4, guards: true },
  },
  /**
   * Nat Garrow, muleteer: fifty, weathered as an old saddle, a grizzled beard,
   * a leather jerkin over a wool shirt, a bloody bandage round his head and
   * his left arm in a sling, and a tankard the guild bought him.
   */
  garrow: {
    look: {
      bulk: 1.06, belly: 0.2,
      skin: [0xc8946e, 0xa07254, 0xdcaa84], ruddy: 0xb86a54,
      hair: [0x7a6a5a, 0x5a4c40, 0x968676], grey: [0xa89a8c, 0x80746a, 0xc4b8aa],
      hairStyle: 'shaggy', beard: 'full',
      garment: 'jerkin', outer: [0x5a4230, 0x3e2e20, 0x765840], inner: [0x8a7a5a, 0x6a5c42, 0xa8987a],
      trouser: [0x4a3e32, 0x302820, 0x605244], boot: BOOT, belt: BELT,
      right: 'tankard', left: 'swing', ragged: true,
      iris: 0x5a4a3a, brow: 0x5a4c40, browSlant: 0.3, lip: 0x9a5e50, scar: 0xa8785e, hollow: 0x9a7058,
    },
    extra: { hurt: true },
  },
};

/** The guild's people drawn finely, by folk id. */
export const GUILD_FOLK: Record<string, (pose: Pose3D) => Model> = Object.fromEntries(
  Object.entries(GUILD_PEOPLE).map(([id, p]) => [id, (pose: Pose3D) => guildModel(pose, p.look, p.extra)]),
);

/** Draws them all, as 'folk-<id>', eight directions each. */
export function generateGuildFolk(scene: Phaser.Scene): void {
  for (const [id, build] of Object.entries(GUILD_FOLK)) generateFigure3D(scene, `folk-${id}`, build, FINE_SPEC);
}
