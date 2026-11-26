import Phaser from 'phaser';
import { IsoModel, lipped, planks, SEAT_TOP, Shader, TABLE_TOP } from './IsoModel';
import { MODEL_ART, registerModel, WALL_HEIGHT } from './interior';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';
import { mixColor, smoothNoise } from './scorch';
import { generateSumpFolk } from './sump3d';

/**
 * Homes in the Sump, Gloomhaven's lowest and wettest lane (see
 * world/SumpMaps.ts): small, poor, damp and kept as well as anyone can keep
 * them. The Crowes' cottage of grey limewashed wattle and tarred posts, with
 * its little fire, box bed, dresser, sewing chest, washtub and Wisp's pallet
 * and treasures; Ned Wick's stilt house of weathered grey boards with the
 * water showing between them, his lamps, oil and wicks, stove, hammock and
 * the trap he fishes through; the Widow Pruett's hovel of sooty cob, rushes
 * drying on the wall, her chair, her rushlights, her cot and her cat; and the
 * burnt house, roofless and black, the walls burnt down to ragged edges. Its
 * people are drawn in sump3d.ts.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// Tarred posts and beams, as at the Rose but poorer: more worn, more grey.
const TAR = 0x2e2420;
const TAR_DARK = 0x1c1614;
const TAR_LIGHT = 0x463830;
const TAR_WORN = 0x5e4834;
// Limewash over wattle and daub, gone grey, brown at the foot with damp.
const LIME = 0x9a9686;
const LIME_LIGHT = 0xb0aa96;
const LIME_DAMP = 0x6e6a5a;
const DAUB = 0x6a5440;
const WATTLE = 0x5a4430;
const MOULD = 0x3e4834;
const SOOT = 0x1e1818;
// Weathered grey boards (the stilt house), silvered by the fen.
const GREY = 0x6a6a64;
const GREY_DARK = 0x4a4a46;
const GREY_LIGHT = 0x8a8a82;
const GREY_DEEP = 0x2e2e2c;
// Cob, sooty and brown (the Widow's hovel).
const COB = 0x7a6250;
const COB_LIGHT = 0x8e7460;
const COB_DARK = 0x5a4636;
// Plain deal and old oak for the furniture.
const DEAL = 0x7a5a3c;
const DEAL_DARK = 0x58402a;
const DEAL_LIGHT = 0x957250;
const DEAL_TOP = 0x8a6644;
// Char.
const CHAR = 0x1a1414;
const CHAR_LIGHT = 0x2e2622;
const EMBER_DEAD = 0x4a2a1e;
const ASH = 0x8a8680;
const ASH_DARK = 0x5a5654;
// Cloth.
const LINEN = 0xc8bca0;
const LINEN_DARK = 0x9a8e76;
const WOOL = 0x7a7470;
const WOOL_DARK = 0x5a5450;
const PATCH_RED = 0x8a3a32;
const PATCH_BLUE = 0x4a5a7a;
const PATCH_GREEN = 0x5a6a42;
const PATCH_OCHRE = 0xa8884a;
const STRAW = 0xc0a05a;
const STRAW_DARK = 0x8a7038;
// Metal, glass, water.
const TIN = 0x9a9ca4;
const TIN_DARK = 0x6a6c74;
const TIN_LIGHT = 0xc8cad2;
const BRASS = 0xb8903a;
const BRASS_LIGHT = 0xe0c070;
const GLASS = 0x46625a;
const GLASS_DARK = 0x2c3e3c;
const GLASS_LIGHT = 0x84a294;
const WATER = 0x1e2a2c;
const WATER_LIGHT = 0x4a6266;
const STONE = 0x56545a;
const STONE_DARK = 0x3a383e;
const STONE_LIGHT = 0x706e74;

// ---------------------------------------------------------------- walls

/** Whose walls: the Crowes', Ned's stilt house, the Widow Pruett's, the burnt house. */
export type SumpStyle = 'crowe' | 'stilt' | 'pruett' | 'ruin';
export type SumpWallKind =
  | 'plain' | 'brace' | 'window' | 'door'
  // The Crowes': the saint's shelf, cloaks on pegs, a crock shelf, the washing line.
  | 'saint' | 'pegs' | 'shelf' | 'line'
  // Ned's: lanterns on a rack, a net hung up.
  | 'lamps' | 'nets'
  // The Widow's: the oilskin on its peg, rushes drying.
  | 'oilskin' | 'rushes'
  // The burnt house: burnt clean through.
  | 'hole';

const KINDS: Record<SumpStyle, SumpWallKind[]> = {
  crowe: ['plain', 'brace', 'saint', 'window', 'pegs', 'shelf', 'line', 'door'],
  stilt: ['plain', 'brace', 'lamps', 'window', 'nets', 'door'],
  pruett: ['plain', 'brace', 'window', 'oilskin', 'rushes', 'door'],
  ruin: ['plain', 'brace', 'window', 'hole', 'door'],
};

/** A tarred post or beam: grain along it, lit on one edge. */
function timber(along: number, across: number, seed: number): number {
  if (across < 0.18) return TAR_LIGHT;
  if (across > 0.82) return TAR_DARK;
  const g = Math.sin(along * 0.9 + Math.sin(along * 0.13 + seed) * 4 + across * 3);
  if (g > 0.86) return TAR_WORN;
  return hash(Math.floor(along / 3), seed) < 0.12 && g > 0.5 ? TAR_LIGHT : TAR;
}

/** Limewash over wattle and daub: grey, blotched, flaking to the brown daub and the woven wattle under it, damp at the foot, sooty at the top. */
function limewash(x: number, y: number, seed: number): number {
  const n = smoothNoise(x / 8 + seed * 2.3, y / 10, seed);
  let c = n > 0.64 ? LIME_LIGHT : n < 0.36 ? LIME_DAMP : LIME;
  // Flaked off to the daub, and through that to the wattle.
  const flake = smoothNoise(x / 5 + 13, y / 5 + seed, seed + 3);
  if (flake > 0.74) {
    if (flake > 0.84) return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 ? WATTLE : mixColor(WATTLE, TAR, 0.4);
    c = hash(Math.floor(x), Math.floor(y)) < 0.2 ? mixColor(DAUB, TAR, 0.3) : DAUB;
  }
  // The damp rising up from the floor, green-black at the very foot.
  const rise = WALL_HEIGHT - 8 - smoothNoise(x / 6, 1, seed + 5) * 22;
  if (y > rise) c = mixColor(c, y > WALL_HEIGHT - 14 ? MOULD : LIME_DAMP, 0.55);
  // Soot at the top.
  const soot = Math.max(0, 1 - y / 26) * 0.6;
  if (soot > 0) c = mixColor(c, SOOT, soot * (0.6 + smoothNoise(x / 6, y / 4, seed + 2) * 0.5));
  return c;
}

/** Grey weathered boards, upright, each its own shade, with gaps between where the light comes in. */
function greyBoards(x: number, y: number, seed: number): number {
  const board = Math.floor((x + seed * 5) / 5.3);
  const lx = ((x + seed * 5) / 5.3) % 1;
  if (lx < 0.1) return hash(board, Math.floor(y / 9)) < 0.3 ? 0x8a9a98 : GREY_DEEP; // a gap, a chink of light in it
  const tone = hash(board, seed) * 3;
  let c = tone < 1 ? GREY : tone < 2 ? GREY_DARK : GREY_LIGHT;
  const grain = Math.sin(y * 0.7 + Math.sin(y * 0.11 + board) * 3 + lx * 4);
  if (grain > 0.88) c = mixColor(c, GREY_DEEP, 0.4);
  if (lx > 0.86) c = mixColor(c, GREY_DEEP, 0.35);
  // A knot or a nail.
  if (Math.hypot(lx - 0.5, (y % 23) / 23 - 0.4) < 0.08 && hash(board, 7) < 0.5) return GREY_DEEP;
  if ((Math.floor(y) === 10 || Math.floor(y) === WALL_HEIGHT - 12) && Math.abs(lx - 0.5) < 0.12) return 0x3a3430;
  // Green with damp at the foot.
  if (y > WALL_HEIGHT - 16 - smoothNoise(x / 4, 2, seed) * 10) c = mixColor(c, MOULD, 0.45);
  return c;
}

/** Cob: lumpy, brown, sooty, the straw showing in it, crumbling. */
function cob(x: number, y: number, seed: number): number {
  const n = smoothNoise(x / 6 + seed, y / 7, seed + 1);
  let c = n > 0.62 ? COB_LIGHT : n < 0.38 ? COB_DARK : COB;
  if (hash(Math.floor(x * 1.3), Math.floor(y * 2.1)) < 0.06) c = STRAW_DARK;
  const crack = smoothNoise(x / 3, y / 3 + seed * 3, seed + 9);
  if (crack > 0.88) c = SOOT;
  const soot = Math.max(0, 1 - y / 40) * 0.8;
  if (soot > 0) c = mixColor(c, SOOT, soot * (0.5 + smoothNoise(x / 5, y / 5, seed + 4) * 0.5));
  if (y > WALL_HEIGHT - 12) c = mixColor(c, MOULD, 0.4);
  return c;
}

/** How high the burnt house's wall still stands at x along it: ragged, lower in places. */
function burntTop(x: number, index: number): number {
  return 6 + smoothNoise((x + index * 32) / 9, 3, 41) * 26 + Math.max(0, Math.sin((x + index * 32) * 0.21)) * 8;
}

/** The burnt house's plaster: blackened from the top down, blistered, scorched brown at the edges of the burn, wet with rain. */
function charred(x: number, y: number, seed: number, index: number): number | null {
  const top = burntTop(x, index);
  if (y < top) return null;
  if (y < top + 2) return CHAR; // the burnt edge
  const c = limewash(x, y, seed);
  const burn = smoothNoise(x / 7 + seed, y / 9, seed + 17) + (1 - y / WALL_HEIGHT) * 0.9;
  if (burn > 0.95) return hash(Math.floor(x), Math.floor(y)) < 0.12 ? CHAR_LIGHT : CHAR;
  if (burn > 0.8) return mixColor(c, CHAR, 0.75);
  if (burn > 0.68) return mixColor(c, EMBER_DEAD, 0.5); // scorched brown
  // Rain streaks running down through the soot.
  if (smoothNoise(x / 1.8, y / 40, seed + 23) > 0.72) return mixColor(c, SOOT, 0.35);
  return mixColor(c, 0x2a2420, 0.3);
}

function wallShader(style: SumpStyle, kind: SumpWallKind, side: 'back' | 'side', index: number): Shader {
  const seed = index * 13 + (side === 'back' ? 3 : 7) + kind.length + style.length * 5;
  const H = WALL_HEIGHT;
  return (u, v) => {
    const x = u * 32;
    const y = v * H;
    const material = (): number | null => {
      if (style === 'stilt') return greyBoards(x + index * 32, y, seed);
      if (style === 'pruett') return cob(x + index * 32, y, seed);
      if (style === 'ruin') return charred(x, y, seed, index);
      return limewash(x + index * 32, y, seed);
    };
    const burnt = style === 'ruin';
    if (burnt && y < burntTop(x, index)) return null;
    const frame = (c: number) => (burnt ? mixColor(c, CHAR, 0.7) : c);

    // The frame: a plate along the top (not on the stilt house: just boards), a sole along the foot, and a post at every other segment.
    if (style !== 'stilt' && y < 5) return frame(timber(x + index * 32, y / 5, seed));
    if (y > H - 5) return y > H - 2 ? TAR_DARK : frame(timber(x + index * 32, (y - (H - 5)) / 3, seed + 1));
    const post = index % 2 === 0 && x < 4 && style !== 'stilt';
    if (post) return frame(timber(y, x / 4, seed + 2));

    if (kind === 'window') {
      const small = style === 'pruett' || style === 'stilt';
      const [x0, x1, y0, y1] = small ? [9, 24, 20, 40] : [8, 25, 17, 44];
      if (x > x0 - 2 && x < x1 + 2 && y > y0 - 2 && y < y1 + 2) {
        if (x < x0 || x > x1 || y < y0 || y > y1) return frame(x < x0 ? TAR_LIGHT : TAR_DARK);
        if (burnt) {
          // No glass at all now: a black hole, the glass a glittering scatter at its foot, the night beyond.
          if (y > y1 - 2 && hash(Math.floor(x), 3) < 0.4) return GLASS_LIGHT;
          return smoothNoise(x / 4, y / 4, 9) > 0.7 ? 0x1a2228 : 0x0e1216;
        }
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        if (Math.abs(x - mx) < 0.8 || Math.abs(y - my) < 0.8) return TAR; // the cross-bar
        if (style === 'pruett' && y > my) return hash(Math.floor(x), Math.floor(y / 2)) < 0.5 ? 0x8a7a5a : GLASS_DARK; // a rag stuffed in a broken pane
        const rain = hash(Math.floor(x), Math.floor((y + x * 3) / 3)) < 0.1;
        if (rain) return GLASS_LIGHT;
        const n = smoothNoise(x / 3, y / 3, seed);
        return n > 0.7 ? mixColor(GLASS, GLASS_LIGHT, 0.4) : n < 0.35 ? GLASS_DARK : GLASS;
      }
      if (x > x0 - 3 && x < x1 + 3 && y >= y1 + 2 && y < y1 + 5) {
        // The sill, and on the Widow's, a jar of dried flowers; on the Crowes', a shell.
        return frame(y < y1 + 3 ? TAR_WORN : TAR);
      }
      if (style === 'pruett' && y > y1 - 9 && y < y1 + 2 && x > x1 - 6 && x < x1 - 1) {
        if (y > y1 - 4) return x < x1 - 4 ? 0x6a7a6a : 0x4a5a4a; // the jar
        return hash(Math.floor(x * 2), Math.floor(y)) < 0.5 ? 0xa86a8a : 0x8a7a4a; // dead heather
      }
      if (style === 'crowe' && y > y1 - 2 && y < y1 + 2 && x > x0 + 1 && x < x0 + 6) return Math.hypot(x - x0 - 3.5, y - y1) < 1.6 ? 0xe8d8c8 : null; // a shell
    }

    if (kind === 'door') {
      // A low plank door, its latch on a string, rags stuffed round the bottom against the draught.
      if (x > 6 && x < 27 && y > 18) {
        if (x < 8 || x > 25 || y < 20) return frame(TAR_DARK);
        if (burnt) {
          // Burnt nearly through: charred planks, gaps glowing faintly with the lane's light.
          if ((Math.floor(x) - 8) % 5 === 0) return 0x2a3238;
          return smoothNoise(x / 2, y / 6, 3) > 0.62 ? CHAR_LIGHT : CHAR;
        }
        if ((Math.floor(x) - 8) % 6 === 0) return TAR_DARK;
        if ((y > 30 && y < 33) || (y > 66 && y < 69)) return x > 20 ? P.iron : P.ironLight;
        if (Math.abs(x - 11) < 1 && Math.abs(y - 52) < 1.5) return BRASS;
        if (y > H - 9 && hash(Math.floor(x), Math.floor(y)) < 0.7) return hash(Math.floor(x / 3), 1) < 0.5 ? LINEN_DARK : WOOL;
        const base = style === 'stilt' ? greyBoards(x + 200, y, 5) : timber(y, ((x - 8) % 6) / 6, seed + 9);
        return base;
      }
    }

    if (kind === 'hole' && burnt) {
      // Burnt right through: the night beyond, the pool, the stilt house on its legs, a lit window across the water.
      const cx = 16;
      const r = Math.hypot((x - cx) / 13, (y - 46) / 22) + smoothNoise(x / 3, y / 3, 7) * 0.25;
      if (r < 1) {
        if (r > 0.9) return hash(Math.floor(x), Math.floor(y)) < 0.5 ? EMBER_DEAD : CHAR;
        // Across the pool: the stilt house in silhouette, its window lit.
        if (y > 52) return (Math.floor(y) % 3 === 0 && hash(Math.floor(x / 2), Math.floor(y)) < 0.4) ? 0x3a4a52 : 0x141c22; // water
        if (x > 18 && x < 27 && y > 38 && y < 46) return Math.abs(x - 21) < 1.5 && Math.abs(y - 42) < 1.5 ? P.glassLit : 0x0a0e10;
        if (y >= 46 && y <= 52 && (Math.abs(x - 19) < 0.6 || Math.abs(x - 26) < 0.6)) return 0x0a0e10; // its stilts
        return smoothNoise(x / 6, y / 4, 13) > 0.6 ? 0x2a3640 : 0x1a2430; // mist and sky
      }
      if (style === 'ruin' && kind === 'hole' && side === 'side' && y > H - 26 && Math.abs(x - 16) < 8) return null;
    }

    if (kind === 'saint') {
      // A little shelf with a candle stub that's never been lit, a dried primrose, and a whittled bird.
      if (y > 36 && y < 39 && x > 7 && x < 26) return y < 37 ? DEAL_LIGHT : DEAL_DARK;
      if (y > 26 && y <= 36) {
        if (x > 9 && x < 12 && y > 28) return y < 29.5 ? 0xf0e8d0 : x < 10.5 ? 0xe8e0c8 : 0xc8c0a8; // the candle
        if (x > 14 && x < 21 && y > 30) {
          // The bird: a fat little body, a tail cocked up, a bead of an eye.
          const bx = x - 17.5;
          const by = y - 33;
          if (Math.hypot(bx / 3.2, by / 2.2) < 1) return Math.hypot(bx + 1.8, by + 0.6) < 0.6 ? 0x1a1414 : by < 0 ? 0xb8a07a : 0x9a845e;
          if (bx > 2.4 && bx < 4 && by < -0.5 && by > -3.5 + (bx - 2.4)) return 0x9a845e;
        }
        if (x > 22 && x < 25 && y > 29) return (Math.floor(y) % 3 === 0 ? 0xd8c860 : y < 31 ? 0xe8d870 : 0x6a7a4a); // the primrose
      }
      // A smudge of soot on the wall above, from a candle that was lit there once, years ago.
      if (y > 16 && y < 26 && Math.abs(x - 10.5) < 2.5 - (26 - y) * 0.15) return mixColor(material() ?? LIME, SOOT, 0.4);
    }

    if (kind === 'pegs') {
      // Three pegs: Annis's grey shawl, Wisp's little green coat, and a bonnet.
      if (y > 18 && y < 21 && x > 3 && x < 30) return TAR_LIGHT;
      for (const px of [7, 16, 25]) if (Math.abs(x - px) < 1 && y >= 21 && y < 24) return TAR_WORN;
      // The shawl: a long grey drape, fringed.
      if (x > 3 && x < 12 && y > 22 && y < 56 - Math.abs(x - 7) * 0.6) {
        if (y > 52 - Math.abs(x - 7) * 0.6) return Math.floor(x) % 2 ? WOOL : null;
        return (Math.floor(x * 1.4) + Math.floor(y / 3)) % 5 === 0 ? WOOL_DARK : Math.sin(x * 1.6) > 0.4 ? 0x8a8480 : WOOL;
      }
      // Wisp's coat: small, fen green, patched at the elbow.
      if (x > 12.5 && x < 20 && y > 22 && y < 44) {
        if (y > 34 && y < 39 && x > 16 && x < 19) return PATCH_OCHRE;
        return (Math.floor(y / 4) % 2 ? 0x3e5232 : 0x34462a);
      }
      // A bonnet hung by its strings.
      if (Math.hypot((x - 25) / 4, (y - 28) / 3.5) < 1) return y < 28 ? 0x5a4a3a : 0x6a5a48;
      if (Math.abs(x - 25 + (y - 31) * 0.3) < 0.5 && y > 31 && y < 40) return LINEN_DARK;
    }

    if (kind === 'shelf') {
      // A shelf of crocks: a salt crock, a jar of dripping, a bunch of dried thyme hung under it.
      if (y > 30 && y < 33 && x > 3 && x < 29) return y < 31 ? DEAL_LIGHT : DEAL_DARK;
      if (y > 18 && y <= 30) {
        if (Math.hypot((x - 8) / 3.4, (y - 25) / 5) < 1) return x < 7 ? 0xb8a890 : 0x8a7a64;
        if (x > 13 && x < 19 && y > 21) return y < 23 ? LINEN : x < 14.5 ? 0xd8ccb0 : 0xb0a488;
        if (x > 22 && x < 27 && y > 23) return y < 24.5 ? 0x5a4030 : x < 23.5 ? 0x7a6a52 : 0x5a4c3a;
      }
      if (x > 12 && x < 20 && y > 33 && y < 46) {
        const stem = Math.abs(x - 16) < 0.6;
        if (y < 35) return stem ? P.bark : null;
        if (hash(Math.floor(x), Math.floor(y)) < 0.55 - (y - 35) * 0.04) return hash(Math.floor(x * 3), Math.floor(y)) < 0.5 ? 0x6a7a4a : 0x4e5a38;
      }
    }

    if (kind === 'line') {
      // A washing line along the wall, a child's smock, stockings, an apron with ROSE stitched on its bib.
      const sag = 20 + Math.sin((x / 32) * Math.PI) * 3;
      if (Math.abs(y - sag) < 0.6) return LINEN_DARK;
      if (y > sag && y < sag + 2 && (Math.abs(x - 4) < 0.8 || Math.abs(x - 13) < 0.8 || Math.abs(x - 22) < 0.8)) return DEAL_LIGHT; // pegs
      if (x > 2 && x < 11 && y > sag && y < sag + 24) return (Math.floor(y / 3) % 4 === 0 ? 0x8a8a9a : 0x9aa0b0); // the smock
      if (x > 12 && x < 15 && y > sag && y < sag + 18) return 0x5a4a3a; // a stocking
      if (x > 15.5 && x < 18 && y > sag && y < sag + 16) return 0x6a5a48;
      if (x > 20 && x < 30 && y > sag && y < sag + 28) {
        // The apron, the Rose's black rose on its bib.
        if (Math.hypot(x - 25, y - sag - 6) < 2.4) return Math.hypot(x - 25, y - sag - 6) < 1.2 ? 0x1a0e12 : 0x5a1424;
        return LINEN;
      }
    }

    if (kind === 'lamps') {
      // A rail of hooks, three street lanterns hung from it waiting to be mended, one with its glass out.
      if (y > 14 && y < 17 && x > 2 && x < 30) return TAR_LIGHT;
      for (const [lx, broken] of [[8, false], [16.5, true], [25, false]] as const) {
        const dx = x - lx;
        if (Math.abs(dx) < 0.6 && y >= 17 && y < 21) return P.iron;
        if (y >= 21 && y < 23 && Math.abs(dx) < 3.4 - (22 - y)) return P.iron; // the cap
        if (y >= 23 && y < 34 && Math.abs(dx) < 3) {
          if (Math.abs(dx) > 2.3 || Math.abs(dx) < 0.4) return P.iron;
          if (broken) return y > 29 && Math.abs(dx) < 2 ? 0x2a2420 : null;
          return hash(Math.floor(x), Math.floor(y)) < 0.15 ? GLASS_LIGHT : mixColor(GLASS, 0x9a9a7a, 0.3);
        }
        if (y >= 34 && y < 36 && Math.abs(dx) < 3.4) return P.iron;
      }
      // A ladder of chalk marks, Ned's tally of lamps lit: four strokes and a cross.
      if (y > 46 && y < 58 && x > 6 && x < 27) {
        const g = Math.floor((x - 6) / 5);
        const lx = (x - 6) % 5;
        if (Math.abs(lx - 0.6) < 0.4 || Math.abs(lx - 1.6) < 0.4 || Math.abs(lx - 2.6) < 0.4 || Math.abs(lx - 3.6) < 0.4) return g < 4 ? 0xd8d4c4 : null;
        if (g === 4 || Math.abs(lx - (y - 46) * 0.36) < 0.4) return 0xc8c4b4;
      }
    }

    if (kind === 'nets') {
      // A net hung up to mend, a cork float or two, a gaff.
      const sag = 18 + Math.sin(((x + index * 7) / 32) * Math.PI) * 8;
      if (y > 12 && y < sag + 32) {
        const mx = (x + y * 0.6) % 3.4;
        const my = (x - y * 0.6 + 200) % 3.4;
        if (mx < 0.55 || my < 0.55) return y < sag ? 0x8a7a5a : 0x6a5c44;
      }
      if (Math.abs(y - (12 + Math.sin(x / 4) * 1.5)) < 2 && Math.floor(x) % 7 < 3) return 0xb08a52;
      if (Math.abs(x - 27 - (y - 20) * 0.05) < 0.7 && y > 18 && y < 74) return DEAL_LIGHT; // the gaff's shaft
      if (y > 16 && y < 22 && x > 27 && x < 30 - (y - 16) * 0.3) return P.iron;
    }

    if (kind === 'oilskin') {
      // A peg, and on it an oilskin coat stiff with forty years' dust, a sou'wester on top; a pipe in the pocket.
      if (Math.abs(x - 16) < 1.2 && y > 15 && y < 19) return TAR_WORN;
      if (Math.hypot((x - 16) / 7, (y - 20) / 3) < 1 && y < 22) return y < 19 ? 0x8a7a3a : 0x6a5a2a; // the hat's brim
      if (y >= 21 && y < 62) {
        const half = 5 + (y - 21) * 0.18;
        if (Math.abs(x - 16) < half) {
          if (Math.abs(x - 16) < 0.5 && y > 24) return 0x4a3e1e; // the front
          if (x > 18.5 && x < 22 && y > 40 && y < 46) return y < 41 ? 0x4a3e1e : Math.abs(x - 20) < 0.6 && y < 44 ? 0xe8e0cc : 0x6a5a2a; // pocket and pipe
          const fold = Math.sin((x - 16) * 1.1 + y * 0.05);
          const dust = hash(Math.floor(x * 2), Math.floor(y * 2)) < 0.12;
          return dust ? 0x9a8e6a : fold > 0.5 ? 0x7a6a34 : fold < -0.5 ? 0x4e4420 : 0x645628;
        }
      }
    }

    if (kind === 'rushes') {
      // Bundles of rushes hung head-down on a string to dry, the near ones green, the far ones gone straw.
      if (y > 10 && y < 12 && x > 2 && x < 30) return LINEN_DARK;
      for (const [bx, green] of [[7, true], [15, false], [23, true]] as const) {
        const dx = x - bx;
        if (y >= 12 && y < 16 && Math.abs(dx) < 1.6) return LINEN_DARK; // the tie
        if (y >= 16 && y < 58) {
          const spread = 1.8 + (y - 16) * 0.08;
          if (Math.abs(dx) < spread && Math.floor((dx + 20) * 1.6) % 2 === 0) return green ? (hash(Math.floor(x * 2), Math.floor(y / 4)) < 0.5 ? 0x5a7a3a : 0x4a6a2e) : STRAW;
        }
      }
    }

    if (kind === 'brace') {
      const t = (y - 43) / (H - 49);
      if (t > 0 && t < 1 && Math.abs(x - (4 + t * 26)) < 2.4 && style !== 'stilt') return frame(timber(y, (x - (4 + t * 26) + 2.4) / 4.8, seed + 5));
      if (style === 'stilt' && Math.abs(y - 44 - (x - 16) * 0.9) < 2) return timber(x, (y - 44 - (x - 16) * 0.9 + 2) / 4, seed);
    }

    // The rail half way up, on the framed walls.
    if (style !== 'stilt' && style !== 'pruett' && y > 40 && y < 44) return frame(timber(x + index * 32, (y - 40) / 4, seed + 3));
    return material();
  };
}

/** One segment of a Sump wall, keyed 'sp-<style>-<side>-<kind>-<index>'. */
function sumpWall(scene: Phaser.Scene, style: SumpStyle, side: 'back' | 'side', kind: SumpWallKind, index: number): void {
  const m = new IsoModel();
  const H = WALL_HEIGHT;
  const cap = 0.14;
  const shade = wallShader(style, kind, side, index);
  const top = style === 'ruin' ? CHAR : style === 'stilt' ? GREY_LIGHT : TAR_LIGHT;
  if (side === 'back') {
    m.quad({ x: 0, y: 0, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, shade);
    if (style !== 'ruin') m.quad({ x: 0, y: -cap, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: cap, z: 0 }, lipped(top, TAR_WORN));
  } else {
    m.quad({ x: 0, y: 0, z: H }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -H }, (u, v) => {
      const c = shade(u, v);
      return c === null ? null : mixColor(c, 0x0e0a10, 0.22);
    });
    if (style !== 'ruin') m.quad({ x: -cap, y: 0, z: H }, { x: cap, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, top);
  }
  registerModel(scene, `sp-${style}-${side}-${kind}-${index}`, m.render(false));
}

function cornerPost(style: SumpStyle): IsoModel {
  const m = new IsoModel();
  const h = style === 'ruin' ? 40 : WALL_HEIGHT + 3;
  const burnt = (c: number) => (style === 'ruin' ? mixColor(c, CHAR, 0.75) : style === 'stilt' ? mixColor(c, GREY, 0.5) : c);
  m.box(-0.16, -0.16, 0, 0.3, 0.3, h, {
    top: burnt(TAR_LIGHT),
    left: (u, v) => burnt(timber(v * 80, u, 4)),
    right: (u, v) => mixColor(burnt(timber(v * 80, u, 5)), 0x000000, 0.3),
  });
  return m;
}

// ---------------------------------------------------------------- floor things

/** A braided rag rug, round-ended, of every scrap there was: red, blue, ochre, grey, in rings. */
function ragRug(w: number, h: number, seed: number): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.1, z: 0 }, { x: w - 0.2, y: 0, z: 0 }, { x: 0, y: h - 0.2, z: 0 }, (u, v) => {
    const dx = (u - 0.5) * (w - 0.2);
    const dy = (v - 0.5) * (h - 0.2);
    const rx = (w - 0.2) / 2;
    const ry = (h - 0.2) / 2;
    const d = Math.hypot(dx / rx, dy / ry);
    if (d > 1) return null;
    const ring = Math.floor(d * 7);
    const braid = Math.sin(Math.atan2(dy, dx) * 26 + ring * 2) > 0.3;
    const cols = [PATCH_RED, PATCH_BLUE, PATCH_OCHRE, WOOL, PATCH_GREEN, LINEN_DARK, PATCH_RED];
    let c = cols[(ring + seed) % cols.length];
    if (braid) c = mixColor(c, 0x000000, 0.22);
    if (smoothNoise(u * 6, v * 6, seed) > 0.75) c = mixColor(c, 0x3a2e24, 0.4); // trodden dirty
    return c;
  });
  return m;
}

/** Gaps between the stilt house's floorboards, the black water glinting below. */
function floorGaps(seed: number): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(seed * 17 + 3);
  const gaps = [0.2 + rnd() * 0.15, 0.55 + rnd() * 0.15, 0.85];
  m.quad({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    for (const g of gaps) {
      if (Math.abs(v - g) < 0.035 && smoothNoise(u * 10, g * 10, seed) > 0.3) {
        return hash(Math.floor(u * 70), Math.floor(g * 40)) < 0.12 ? WATER_LIGHT : WATER;
      }
    }
    // A rotten board end, a knot hole.
    if (Math.hypot(u * 2 - 1.3, v - 0.4) < 0.05) return WATER;
    return null;
  });
  return m;
}

/** The trap in Ned's floor, propped open: the water a man's height down, a line tied off with a cork bobbing. */
function trap(): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.15, y: 0.15, z: 0 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0.7, z: 0 }, (u, v) => {
    if (u < 0.06 || u > 0.94 || v < 0.06 || v > 0.94) return TAR_DARK;
    const ripple = Math.sin(Math.hypot(u - 0.6, v - 0.55) * 40) > 0.85;
    if (Math.hypot(u - 0.6, v - 0.55) < 0.05) return 0xc8884a; // the cork
    if (ripple) return WATER_LIGHT;
    // The stilts going down into it, green with slime.
    if (Math.abs(u - 0.2) < 0.05 || Math.abs(v - 0.8) < 0.05) return 0x2e3a2a;
    return WATER;
  });
  // The lid, propped up against the wall side.
  m.quad({ x: 0.15, y: 0.15, z: 0 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: -0.06, z: 20 }, planks(3, GREY, GREY_DARK, GREY_LIGHT, 4));
  // The line, from a nail at the rim to the cork.
  m.quad({ x: 0.6, y: 0.18, z: 0.5 }, { x: 0.02, y: 0.36, z: 0 }, { x: 0.01, y: 0, z: 0 }, () => LINEN);
  return m;
}

/** Ash and char swept in heaps by the wind, a few burnt scraps in it. */
function ash(seed: number): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const n = smoothNoise(u * 4 + seed, v * 4, seed + 1);
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (n * (1 - d) < 0.28) return null;
    const h = hash(Math.floor(u * 40), Math.floor(v * 40) + seed);
    if (h < 0.06) return EMBER_DEAD;
    if (h < 0.12) return CHAR;
    return n > 0.62 ? ASH : n > 0.5 ? ASH_DARK : 0x3e3a38;
  });
  return m;
}

// ---------------------------------------------------------------- hearths

function hearthStone(seed: number): Shader {
  return (u, v) => {
    const row = Math.floor(v * 5);
    const off = hash(row, seed) * 0.6;
    const lu = (u * 3 + off) % 1;
    const lv = (v * 5) % 1;
    if (lu < 0.08 || lv < 0.12) return SOOT;
    const c = hash(Math.floor(u * 3 + off), row + seed) < 0.5 ? STONE : hash(row, seed + 1) < 0.5 ? STONE_LIGHT : STONE_DARK;
    return mixColor(c, SOOT, Math.min(1, (1 - v) * 0.7 + smoothNoise(u * 4, v * 4, seed) * 0.3) * 0.55);
  };
}

/**
 * A little stone hearth in the corner, one tile: a low arched firebox, a
 * hood and chimney breast going up into the wall, a kettle on a hook, and a
 * mantel shelf. `peat` for the Widow's, with a heap of peat turfs and a
 * griddle; `cold` for the burnt house's, full of wet ash, its stone cracked.
 */
function hearth(kind: 'crowe' | 'peat' | 'cold'): IsoModel {
  const m = new IsoModel();
  const cold = kind === 'cold';
  const dark = (c: number) => (cold ? mixColor(c, CHAR, 0.55) : c);
  // The chimney breast going up the wall.
  m.box(0.15, 0, 34, 0.7, 0.35, WALL_HEIGHT - 34 + (cold ? -20 : 4), { top: SOOT, left: (u, v) => dark(hearthStone(2)(u, v) ?? SOOT), right: (u, v) => dark(mixColor(hearthStone(3)(u, v) ?? SOOT, 0, 0.25)) });
  // The fireplace itself, with its arch.
  m.box(0, 0, 0, 1, 0.65, 34, {
    top: dark(STONE_DARK),
    left: (u, v) => {
      const x = (u - 0.5) * 32;
      const y = v * 34;
      const top = 10 + (x * x) / 14;
      if (Math.abs(x) < 9 && y > top) return y > 31 ? (cold ? 0x22201e : 0x120c0e) : cold ? 0x2a2624 : SOOT;
      return dark(hearthStone(1)(u, v) ?? SOOT);
    },
    right: (u, v) => dark(mixColor(hearthStone(4)(u, v) ?? SOOT, 0, 0.25)),
  });
  // The mantel shelf.
  m.box(-0.05, -0.02, 34, 1.1, 0.75, 3, { top: dark(TAR_WORN), left: lipped(dark(TAR), dark(TAR_LIGHT)), right: dark(TAR_DARK) });
  if (kind === 'crowe') {
    // On the mantel: a candlestick, a china dog with one ear, a tin box.
    m.cylinder(0.2, 0.4, 37, 0.06, 2, () => BRASS, BRASS_LIGHT);
    m.box(0.18, 0.38, 39, 0.04, 0.04, 7, { top: P.fireYellow, left: 0xe8e0c8, right: 0xc8c0a8 });
    m.box(0.5, 0.35, 37, 0.14, 0.1, 5, { top: 0xe8e4dc, left: 0xd8d4cc, right: 0xb8b4ac });
    m.box(0.55, 0.36, 42, 0.06, 0.06, 3, { top: 0xe8e4dc, left: 0xd8d4cc, right: 0xb8b4ac });
    m.box(0.76, 0.3, 37, 0.14, 0.18, 4, { top: TIN_LIGHT, left: TIN, right: TIN_DARK });
    // The kettle on its hook over the fire.
    m.box(0.48, 0.3, 14, 0.04, 0.04, 20, { top: P.ironLight, left: P.iron, right: 0x2a2a30 });
    m.cylinder(0.5, 0.42, 6, 0.14, 8, (u, v) => (v < 0.15 ? 0x3a3a42 : u < 0.3 ? 0x5a5a62 : u > 0.7 ? 0x1c1c20 : 0x2e2e34), 0x2e2e34);
    m.box(0.62, 0.42, 9, 0.12, 0.04, 2, { top: 0x2e2e34, left: 0x2e2e34, right: 0x1c1c20 });
  } else if (kind === 'peat') {
    // Turfs of peat stacked beside it, a griddle hung on the breast, a pot of tallow warming at the side.
    for (let i = 0; i < 3; i++) m.box(0.72, 0.62 + (i % 2) * 0.08, i * 4, 0.24, 0.14, 4, { top: 0x4a3626, left: 0x3a2a1e, right: 0x2a1e16 });
    m.cylinder(0.5, 0.06, 46, 0.18, 1, () => 0x2a2a30, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.42 ? 0x1e1e22 : 0x3a3a42));
    m.cylinder(0.2, 0.55, 2, 0.1, 7, (u) => (u < 0.3 ? 0x5a5a62 : 0x2e2e34), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.38 ? 0xe8dcb0 : 0x2e2e34));
  } else {
    // Cold: wet ash heaped in the firebox, a crack across the hearthstone in front, and the stone itself a little proud of the rest.
    m.box(0.1, 0.65, 0, 0.8, 0.32, 2, {
      top: (u, v) => (Math.abs(v - 0.3 - u * 0.4) < 0.04 ? 0x1a1818 : u < 0.06 || u > 0.94 || v < 0.1 ? 0x2a2826 : mixColor(STONE, CHAR, 0.45)),
      left: STONE_DARK,
      right: 0x2a2828,
    });
    m.quad({ x: 0.3, y: 0.35, z: 1 }, { x: 0.4, y: 0, z: 0 }, { x: 0, y: 0.25, z: 0 }, (u, v) => (smoothNoise(u * 5, v * 5, 3) > 0.4 ? ASH_DARK : ASH));
    // A rusted pot fallen on its side.
    m.cylinder(0.75, 0.2, 34 + 3, 0.1, 6, (u) => (u < 0.4 ? 0x6a3a22 : 0x4a2a1a), 0x2a1a12);
  }
  return m;
}

/** Flames for one frame, rising from the firebox mouth at (bx, by), `w` pixels across, `h` high. */
function paintFlames(c: PixelCanvas, bx: number, by: number, frame: number, w: number, h: number, peat = false): void {
  const rnd = seededRandom(71 + frame * 29 + (peat ? 5 : 0));
  for (let i = -w; i <= w; i++) {
    c.set(bx + i, by - 1, P.barkDark);
    c.set(bx + i, by - 2, i % 3 === 0 ? P.ember : peat ? 0x4a3626 : P.bark);
  }
  for (let i = 0; i < w * 2 + 6; i++) {
    const x = Math.round((rnd() - 0.5) * w * 2);
    const fh = (peat ? 2 : 3) + rnd() * (h - Math.abs(x) * 0.6);
    for (let y = 0; y < fh; y++) {
      const t = y / fh;
      const col = t < 0.3 ? P.fireYellow : t < 0.7 ? P.fireOrange : P.fireRed;
      const sway = Math.round(Math.sin(t * 3 + frame * 2 + i) * t * 1.2);
      c.set(bx + x + sway, by - 3 - y, col);
    }
  }
  for (let i = 0; i < 3; i++) c.set(bx + Math.round((rnd() - 0.5) * w * 1.6), by - h - 4 - rnd() * 5, P.ember);
}

const FIRE_FRAMES = 4;

/** Draws a hearth with its fire burning, as frames, and its animation. */
function putFire(scene: Phaser.Scene, key: string, model: IsoModel, peat: boolean): void {
  const base = model.render();
  const w = base.canvas.width;
  const sheet = new PixelCanvas(w * FIRE_FRAMES, base.canvas.height);
  // The mouth of the firebox: the middle of its front face (+y, at y = 0.65), on the floor.
  const bx = Math.round(base.anchorX + (0.5 - 0.65) * 32);
  const by = Math.round(base.anchorY + (0.5 + 0.65) * 16 - 2);
  for (let f = 0; f < FIRE_FRAMES; f++) {
    const frame = new PixelCanvas(w, base.canvas.height);
    frame.blit(base.canvas, 0, 0);
    paintFlames(frame, bx, by, f, peat ? 6 : 7, peat ? 7 : 11, peat);
    sheet.blit(frame, f * w, 0);
  }
  const tex = sheet.toTexture(scene, key);
  for (let f = 0; f < FIRE_FRAMES; f++) tex.add(f, 0, f * w, 0, w, base.canvas.height);
  MODEL_ART[key] = { key, originX: base.anchorX / w, originY: base.anchorY / base.canvas.height };
  const anim = `${key}-fire`;
  if (!scene.anims.exists(anim)) {
    scene.anims.create({ key: anim, frames: [0, 1, 2, 3, 2, 1].map((frame) => ({ key, frame })), frameRate: peat ? 5 : 7, repeat: -1 });
  }
}

// ---------------------------------------------------------------- the Crowes'

/** A wicker basket of peat turfs by the hearth. */
function peatBasket(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.3, 12, (u, v) => ((Math.floor(u * 30) + Math.floor(v * 6)) % 2 ? 0x8a6a3a : 0x6a4e2a), 0x3a2a1e);
  for (const [x, y, z] of [[0.4, 0.45, 12], [0.58, 0.55, 12], [0.48, 0.5, 15]] as const) m.box(x - 0.1, y - 0.07, z, 0.2, 0.14, 3, { top: 0x4a3626, left: 0x3a2a1e, right: 0x2a1e16 });
  return m;
}

/**
 * Annis's sewing box on top of the old chest she brought from home: a
 * wooden box with a hinged lid, a pincushion, reels, a darning egg; and the
 * chest under it, iron-bound, her mother's.
 */
function sewing(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.15, 0, 0.8, 0.7, 18, {
    top: DEAL_TOP,
    left: (u, v) => (Math.abs(u - 0.15) < 0.04 || Math.abs(u - 0.85) < 0.04 || v < 0.08 ? P.iron : Math.hypot(u - 0.5, v - 0.35) < 0.07 ? BRASS : planks(3, DEAL, DEAL_DARK, DEAL_LIGHT, 2)(u, v)),
    right: DEAL_DARK,
  });
  // The sewing box, lid up.
  m.box(0.22, 0.3, 18, 0.5, 0.38, 6, { top: (u, v) => (u < 0.08 || u > 0.92 || v < 0.1 || v > 0.9 ? 0x6a4a30 : (Math.floor(u * 5) + Math.floor(v * 3)) % 2 ? 0x8a8478 : 0x6a6470), left: 0x7a5636, right: 0x5a3e26 });
  m.quad({ x: 0.22, y: 0.3, z: 24 }, { x: 0.5, y: 0, z: 0 }, { x: 0, y: -0.04, z: 12 }, (u, v) => (v < 0.15 ? 0x5a3e26 : u < 0.06 || u > 0.94 ? 0x5a3e26 : 0x7a5636));
  // A pincushion like a hedgehog, reels of wool, a darning egg.
  m.cylinder(0.32, 0.5, 24, 0.07, 3, () => 0x8a3a32, (u, v) => (hash(Math.floor(u * 9), Math.floor(v * 9)) < 0.3 ? 0xd8d8e0 : 0xa84a3e));
  for (const [x, c] of [[0.48, 0x8a8a8a], [0.56, 0x5a5a62], [0.64, 0xb0a890]] as const) m.cylinder(x, 0.48, 24, 0.035, 4, () => c, DEAL_LIGHT);
  m.box(0.66, 0.6, 24, 0.07, 0.05, 3, { top: 0xd8c8a8, left: 0xc0b090, right: 0xa09070 });
  return m;
}

/**
 * Annis's box bed against the back wall: a cupboard of a bed with a canopy,
 * a faded blue curtain half drawn across it, a straw mattress, a grey blanket
 * folded square, one pillow plumped.
 */
function boxBed(): IsoModel {
  const m = new IsoModel();
  const wood = { top: TAR_LIGHT, left: lipped(TAR, TAR_LIGHT), right: TAR_DARK };
  // The back and the head and foot boards, and a canopy over.
  m.box(0, 0, 0, 1, 0.1, 58, wood);
  m.box(0, 0.1, 0, 0.1, 1.84, 58, { top: TAR_LIGHT, left: TAR, right: (u, v) => (v < 0.05 ? TAR_LIGHT : planks(4, TAR, TAR_DARK, TAR_LIGHT, 3)(v, u)) });
  m.box(0, 0.1, 0, 1, 1.84, 12, wood);
  m.box(0.1, 0.15, 12, 0.85, 1.75, 4, { top: (u, v) => (smoothNoise(u * 4, v * 6, 3) > 0.6 ? STRAW_DARK : STRAW), left: 0xb09858, right: STRAW_DARK });
  // The blanket folded square at the foot, the pillow at the head.
  m.box(0.15, 1.2, 16, 0.75, 0.55, 5, { top: (u) => (Math.floor(u * 10) % 4 === 0 ? WOOL_DARK : WOOL), left: WOOL, right: WOOL_DARK });
  m.box(0.2, 0.2, 16, 0.6, 0.35, 5, { top: 0xd8d0b8, left: 0xc0b8a0, right: 0xa8a088 });
  m.box(0, 1.9, 0, 1, 0.08, 58, wood);
  m.box(0, 0, 58, 1, 1.98, 4, { top: TAR_WORN, left: TAR, right: TAR_DARK });
  // The curtain, hung from the canopy along the front edge, drawn over the foot half.
  m.quad({ x: 1, y: 1.0, z: 58 }, { x: 0, y: 0.95, z: 0 }, { x: 0, y: 0, z: -56 }, (u, v) => {
    if (v > 0.97) return null;
    const fold = Math.sin(u * 30);
    if (hash(Math.floor(u * 40), Math.floor(v * 30)) < 0.02) return 0x1a2030;
    return fold > 0.4 ? 0x6a7a9a : fold < -0.4 ? 0x3a4a62 : 0x52627e;
  });
  // A tie-back bunch at the head end.
  m.quad({ x: 1, y: 0.12, z: 58 }, { x: 0, y: 0.18, z: 0 }, { x: 0, y: 0, z: -40 }, (u, v) => (Math.sin(u * 20 + v * 4) > 0 ? 0x52627e : 0x3a4a62));
  return m;
}

/** A narrow dresser of odd crockery: cups that don't match, a chipped jug, bowls, a tea caddy, and a picture turned to the wall. */
function dresser(): IsoModel {
  const m = new IsoModel();
  const wood = { top: DEAL_TOP, left: lipped(DEAL, DEAL_LIGHT), right: DEAL_DARK };
  m.box(0.1, 0.05, 0, 0.85, 0.7, 26, { top: DEAL_TOP, left: (u, v) => (Math.abs(u - 0.5) < 0.02 || v < 0.06 ? DEAL_DARK : Math.hypot(u - 0.42, v - 0.4) < 0.04 || Math.hypot(u - 0.58, v - 0.4) < 0.04 ? BRASS : DEAL), right: DEAL_DARK });
  m.box(0.1, 0.05, 26, 0.85, 0.08, 40, wood);
  for (const z of [40, 54]) m.box(0.1, 0.05, z, 0.85, 0.3, 2, wood);
  m.box(0.05, 0.03, 66, 0.95, 0.38, 3, wood);
  // Bowls, cups, the jug.
  m.cylinder(0.3, 0.35, 26, 0.12, 3, (u) => (u < 0.3 ? 0xe0d8c8 : 0xb0a898), 0xc8c0b0);
  m.cylinder(0.3, 0.35, 29, 0.12, 3, (u) => (u < 0.3 ? 0xd8c8a8 : 0xa89878), 0xc8b898);
  m.cylinder(0.7, 0.4, 26, 0.09, 9, (u, v) => (v < 0.1 ? 0xd0c8b8 : u < 0.3 ? 0xe8e0d0 : u > 0.7 ? 0x9a9080 : 0xc8c0b0), 0x2a2620);
  m.cylinder(0.3, 0.2, 42, 0.06, 4, () => 0x6a8aa8, 0x3a3a3a);
  m.cylinder(0.55, 0.2, 42, 0.06, 4, () => 0xc8b898, 0x3a3a3a);
  m.box(0.72, 0.12, 42, 0.14, 0.14, 7, { top: 0x6a2a2a, left: 0x8a3a32, right: 0x5a2420 }); // the caddy
  // The picture on the top shelf, turned face to the wall: a frame's back.
  m.box(0.4, 0.12, 56, 0.3, 0.04, 10, { top: DEAL_DARK, left: (u, v) => (u < 0.1 || u > 0.9 || v < 0.1 || v > 0.9 ? TAR_WORN : 0x8a7a5a), right: TAR });
  return m;
}

/** A tin washtub with a scrubbing board in it, grey water and a shirt soaking. */
function washtub(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.36, 9, (u, v) => (Math.abs(v - 0.15) < 0.06 ? TIN_LIGHT : u < 0.3 ? TIN_LIGHT : u > 0.72 ? TIN_DARK : TIN), (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.44) return TIN;
    if (Math.abs(u - 0.6 - (v - 0.5) * 0.4) < 0.08 && d < 0.4) return 0xb8b8c8; // the soaking shirt
    return d < 0.2 && hash(Math.floor(u * 20), Math.floor(v * 20)) < 0.2 ? 0xa8aca8 : 0x5a6262;
  });
  // The scrubbing board, leaning in the tub.
  m.quad({ x: 0.3, y: 0.32, z: 6 }, { x: 0.3, y: 0, z: 0 }, { x: -0.04, y: 0.02, z: 18 }, (u, v) => (v < 0.15 || u < 0.08 || u > 0.92 ? DEAL : (v * 12) % 1 < 0.45 ? 0xc8ccd0 : 0x8a8e94));
  return m;
}

/** A small deal table, scrubbed white, two bowls, a heel of bread, a candle stub in a saucer, Annis's mending. */
function table(): IsoModel {
  const m = new IsoModel();
  const leg = { top: DEAL_DARK, left: DEAL, right: DEAL_DARK };
  for (const [x, y] of [[0.18, 0.18], [0.76, 0.18], [0.18, 0.76], [0.76, 0.76]]) m.box(x, y, 0, 0.06, 0.06, 24, leg);
  m.box(0.12, 0.12, 24, 0.76, 0.76, 3, { top: (u, v) => planks(3, 0xb0a080, 0x8a7a5c, 0xc8b898, 5)(v, u) ?? 0xb0a080, left: DEAL_LIGHT, right: DEAL });
  m.cylinder(0.32, 0.32, 27, 0.1, 2, (u) => (u < 0.4 ? 0xd8d0c0 : 0xa8a090), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.32 ? 0x8a7a5a : 0xc8c0b0));
  m.cylinder(0.55, 0.3, 27, 0.08, 2, (u) => (u < 0.4 ? 0xd8d0c0 : 0xa8a090), 0xc8c0b0);
  m.box(0.6, 0.55, 27, 0.18, 0.12, 3, { top: 0xc8a060, left: 0xa8803e, right: 0x88602a }); // the heel of bread
  // The candle stub in its saucer.
  m.cylinder(0.3, 0.62, 27, 0.07, 1, () => 0xa8a090, 0xc8c0b0);
  m.box(0.28, 0.6, 28, 0.04, 0.04, 4, { top: P.fireYellow, left: 0xe8e0c8, right: 0xc8c0a8 });
  m.box(0.29, 0.61, 32, 0.02, 0.02, 3, { top: P.fireYellow, left: P.fireOrange, right: P.fireYellow });
  // Mending: a child's smock folded, a needle stuck in it.
  m.box(0.55, 0.62, 27, 0.25, 0.18, 2, { top: (u) => (Math.floor(u * 8) % 3 === 0 ? 0x8a8a9a : 0x9aa0b0), left: 0x8a8a9a, right: 0x7a7a8a });
  return m.lower(24, 27 - TABLE_TOP);
}

/** Wisp's pallet on the floor: a straw tick, a patched blanket, a rag fox on the pillow. */
function pallet(): IsoModel {
  const m = new IsoModel();
  m.box(0.08, 0.12, 0, 0.84, 1.76, 5, { top: (u, v) => (smoothNoise(u * 4, v * 7, 5) > 0.6 ? STRAW_DARK : STRAW), left: 0xa08848, right: STRAW_DARK });
  // The patched blanket: squares of every colour.
  m.box(0.1, 0.6, 5, 0.8, 1.25, 2, {
    top: (u, v) => {
      const cols = [PATCH_RED, PATCH_BLUE, PATCH_OCHRE, WOOL, PATCH_GREEN, LINEN_DARK];
      const c = cols[(Math.floor(u * 3) * 3 + Math.floor(v * 5)) % cols.length];
      return (u * 3) % 1 < 0.06 || (v * 5) % 1 < 0.06 ? 0x2a2420 : c;
    },
    left: PATCH_BLUE,
    right: 0x3a4a62,
  });
  m.box(0.2, 0.18, 5, 0.6, 0.35, 4, { top: 0xd0c8b0, left: 0xb8b098, right: 0x9a9480 });
  // The rag fox: a body, a head with ears, a white-tipped tail, button eyes.
  m.box(0.38, 0.24, 9, 0.24, 0.16, 4, { top: 0xb8642e, left: 0xa05424, right: 0x84441c });
  m.box(0.6, 0.26, 10, 0.12, 0.12, 4, { top: 0xc8743a, left: 0xb0602c, right: 0x8a4a20 });
  for (const y of [0.27, 0.34]) m.box(0.66, y, 14, 0.04, 0.03, 2, { top: 0xb8642e, left: 0xa05424, right: 0x84441c });
  m.box(0.71, 0.3, 11, 0.01, 0.03, 1, { top: 0x1a1414, left: 0x1a1414, right: 0x1a1414 });
  m.box(0.22, 0.3, 9, 0.16, 0.08, 2, { top: (u) => (u < 0.3 ? 0xe8e0d0 : 0xb8642e), left: 0xa05424, right: 0x84441c });
  return m;
}

/** Wisp's treasure: a biscuit tin with a ship on its lid, lid off, full of pinched bright things. */
function treasure(): IsoModel {
  const m = new IsoModel();
  m.box(0.3, 0.3, 0, 0.4, 0.3, 5, {
    top: (u, v) => {
      if (u < 0.06 || u > 0.94 || v < 0.08 || v > 0.92) return TIN;
      const h = hash(Math.floor(u * 9), Math.floor(v * 7));
      return h < 0.15 ? BRASS_LIGHT : h < 0.25 ? 0x4a6aca : h < 0.35 ? 0xd8d8e0 : h < 0.45 ? 0x8a3a32 : h < 0.55 ? 0x6a6a72 : 0x3a3a42;
    },
    left: (_u, v) => (v < 0.2 ? TIN_LIGHT : 0x3a5a8a),
    right: 0x2a4068,
  });
  // The lid, leant against it: a painted ship, sails set.
  m.quad({ x: 0.72, y: 0.3, z: 0 }, { x: 0, y: 0.3, z: 0 }, { x: 0.04, y: 0, z: 10 }, (u, v) => {
    if (u < 0.06 || u > 0.94 || v < 0.06 || v > 0.94) return TIN_LIGHT;
    if (v < 0.35 && Math.abs(u - 0.5) < 0.04) return 0x3a2a20;
    if (v > 0.35 && v < 0.6 && Math.abs(u - 0.5) < 0.25 - (0.6 - v) * 0.4) return 0x6a3a22;
    if (v < 0.4 && Math.abs(u - 0.5) < 0.22 && v > 0.12) return 0xe8e0d0;
    return v > 0.6 ? 0x2a4a7a : 0x8ab0d0;
  });
  return m;
}

// ---------------------------------------------------------------- Ned's

/** A little cast-iron stove on four feet, its pipe going up through the roof, a can of water warming on it. */
function stove(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.2, 0.2], [0.72, 0.2], [0.2, 0.72], [0.72, 0.72]]) m.box(x, y, 0, 0.06, 0.06, 4, { top: 0x2a2a30, left: 0x2a2a30, right: 0x1a1a1e });
  m.box(0.15, 0.15, 4, 0.7, 0.7, 20, {
    top: (u, v) => (Math.hypot(u - 0.35, v - 0.35) < 0.14 ? 0x1a1a1e : 0x3a3a42),
    left: (u, v) => {
      if (Math.abs(u - 0.5) < 0.22 && v > 0.3 && v < 0.75) return (Math.floor(u * 20) % 2 === 0 ? (v > 0.55 ? P.fireOrange : 0x4a2418) : 0x1a1a1e); // the grate glowing
      return u < 0.08 ? 0x4a4a52 : 0x2e2e34;
    },
    right: 0x1e1e22,
  });
  m.cylinder(0.3, 0.3, 24, 0.08, WALL_HEIGHT - 24, (u) => (u < 0.3 ? 0x4a4a52 : 0x22222a), 0x22222a);
  m.cylinder(0.62, 0.6, 24, 0.1, 6, (u) => (u < 0.3 ? TIN_LIGHT : TIN_DARK), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.38 ? WATER : TIN));
  return m;
}

/**
 * Ned's bench under his rail of lamps, two tiles long: wicks trimmed and
 * coiled, lantern-glasses polished in a row (one cracked), a pot of soot
 * scraped off them, a lantern in bits, his scissors, a rag, a lit lamp.
 */
function wickBench(): IsoModel {
  const m = new IsoModel();
  const leg = { top: GREY_DARK, left: GREY, right: GREY_DARK };
  for (const x of [0.1, 1.8]) m.box(x, 0.15, 0, 0.08, 0.6, 26, leg);
  m.box(0.05, 0.1, 26, 1.9, 0.7, 3, { top: (u, v) => planks(3, 0x7a7a70, 0x5a5a52, 0x9a9a8e, 8)(u, v) ?? GREY, left: GREY_LIGHT, right: GREY });
  // The glasses.
  for (let i = 0; i < 4; i++) {
    const x = 0.25 + i * 0.18;
    m.cylinder(x, 0.32, 29, 0.06, 9, (u, v) => (i === 2 && Math.abs(u - 0.5 - v * 0.3) < 0.04 ? 0xe8f0f0 : u < 0.3 ? GLASS_LIGHT : mixColor(GLASS, 0xb8b8a8, 0.5)), mixColor(GLASS, 0xb8b8a8, 0.4));
  }
  // Coils of wick, the soot pot, scissors, a rag.
  for (const x of [1.0, 1.12]) m.cylinder(x, 0.6, 29, 0.05, 1, () => 0xe0d8c0, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.2 ? 0xa89878 : 0xe0d8c0));
  m.cylinder(1.35, 0.3, 29, 0.07, 5, (u) => (u < 0.3 ? 0x5a5a62 : 0x2e2e34), 0x0e0e10);
  m.box(1.2, 0.55, 29, 0.14, 0.02, 1, { top: P.ironLight, left: P.iron, right: P.iron });
  m.box(0.55, 0.6, 29, 0.2, 0.12, 1.5, { top: 0x5a5448, left: 0x4a4438, right: 0x3a3428 });
  // A lantern in bits (frame, no glass), and a lit one at the end.
  m.box(1.5, 0.45, 29, 0.16, 0.16, 10, { top: P.iron, left: (u) => (u < 0.15 || u > 0.85 ? P.iron : null), right: (u) => (u < 0.15 || u > 0.85 ? P.iron : null) });
  m.box(1.72, 0.25, 29, 0.14, 0.14, 2, { top: P.iron, left: P.iron, right: 0x2a2a30 });
  m.box(1.73, 0.26, 31, 0.12, 0.12, 8, { top: P.iron, left: (u) => (u < 0.15 || u > 0.85 ? P.iron : P.glassLit), right: (u) => (u < 0.15 || u > 0.85 ? 0x2a2a30 : 0xe8b860) });
  m.box(1.72, 0.25, 39, 0.14, 0.14, 2, { top: P.iron, left: P.iron, right: 0x2a2a30 });
  return m.lower(26, 32 - TABLE_TOP);
}

/** A sailcloth hammock slung under the window between two hooks, a blanket knotted in the bottom of it, a boat-hook hung above. */
function hammock(): IsoModel {
  const m = new IsoModel();
  // The hooks, at the wall, and two posts out front of it.
  for (const x of [0.1, 1.9]) m.box(x - 0.04, 0.12, 0, 0.08, 0.08, 40, { top: GREY_LIGHT, left: GREY, right: GREY_DARK });
  // The sling: a sagging curve of canvas along x, deepest in the middle.
  const N = 24;
  for (let i = 0; i < N; i++) {
    const t0 = i / N;
    const t1 = (i + 1) / N;
    const z0 = 36 - Math.sin(t0 * Math.PI) * 22;
    const z1 = 36 - Math.sin(t1 * Math.PI) * 22;
    m.quad({ x: 0.1 + t0 * 1.8, y: 0.1, z: z0 }, { x: 1.8 / N, y: 0, z: z1 - z0 }, { x: 0, y: 0.6, z: 0 }, (_u, v) => {
      if (v < 0.06 || v > 0.94) return 0x8a8470;
      const knot = Math.hypot((t0 - 0.52) * 3, v - 0.55) < 0.35;
      if (knot) return hash(Math.floor(t0 * 40), Math.floor(v * 10)) < 0.5 ? WOOL : WOOL_DARK;
      return (Math.floor(v * 8) + i) % 5 === 0 ? 0xa8a088 : 0xc0b89c;
    });
  }
  // The cords from the ends to the hooks.
  for (const [x, dx] of [[0.1, 0.0], [1.9, 0.0]]) m.box(x + dx - 0.01, 0.38, 34, 0.02, 0.02, 6, { top: LINEN_DARK, left: LINEN_DARK, right: LINEN_DARK });
  return m;
}

/** Ned's cans of lamp oil, a funnel in one, a long-handled dipper, a pail of sand in case. */
function oilCans(): IsoModel {
  const m = new IsoModel();
  for (const [x, y, h] of [[0.3, 0.3, 16], [0.62, 0.28, 14], [0.4, 0.62, 12]] as const) {
    m.cylinder(x, y, 0, 0.13, h, (u, v) => (v < 0.08 ? 0x4a6a5a : Math.abs(v - 0.4) < 0.05 ? 0x2a3a32 : u < 0.3 ? 0x6a8a7a : u > 0.7 ? 0x2e4038 : 0x4a6a5a), 0x3a5048);
  }
  // A funnel in the tall can.
  m.cylinder(0.3, 0.3, 16, 0.08, 4, (u) => (u < 0.3 ? TIN_LIGHT : TIN), 0x1a1a1a);
  // The pail of sand.
  m.cylinder(0.72, 0.68, 0, 0.12, 9, (u) => (u < 0.3 ? 0x6a6a72 : 0x3a3a42), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.38 ? P.sand : 0x3a3a42));
  return m;
}

/** The lamplighter's poles stood in the corner: a long one with a brass hook and wick-holder at the top, a short one, a ladder pole. */
function poles(): IsoModel {
  const m = new IsoModel();
  m.box(0.12, 0.2, 0, 0.05, 0.05, 92, { top: BRASS, left: (_u, v) => (v < 0.06 ? BRASS_LIGHT : DEAL_LIGHT), right: DEAL });
  m.box(0.1, 0.18, 92, 0.1, 0.03, 6, { top: BRASS_LIGHT, left: BRASS, right: BRASS });
  m.box(0.28, 0.4, 0, 0.05, 0.05, 74, { top: P.iron, left: (_u, v) => (v < 0.05 ? P.iron : DEAL), right: DEAL_DARK });
  m.box(0.16, 0.6, 0, 0.04, 0.04, 80, { top: GREY, left: GREY_LIGHT, right: GREY });
  m.box(0.34, 0.6, 0, 0.04, 0.04, 80, { top: GREY, left: GREY_LIGHT, right: GREY });
  for (let z = 10; z < 80; z += 12) m.box(0.16, 0.6, z, 0.22, 0.03, 2, { top: GREY_LIGHT, left: GREY, right: GREY_DARK });
  return m;
}

/** An eel trap of woven withies, a long cone on its side. */
function eelTrap(): IsoModel {
  const m = new IsoModel();
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const r = 0.26 - t * 0.16;
    m.cylinder(0.5, 0.15 + t * 0.7, 0, r, r * 50, (u, v) => ((Math.floor(u * 16) + Math.floor(v * 4) + i) % 2 ? 0x8a6a3a : 0x6a4e2a), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0x2a1e14 : 0x7a5c32));
  }
  return m;
}

/** A coil of rope on the boards. */
function ropeCoil(): IsoModel {
  const m = new IsoModel();
  for (let i = 0; i < 4; i++) m.cylinder(0.5, 0.5, i * 2.2, 0.3 - i * 0.03, 2.2, (u) => ((u * 30 + i) % 2 < 1 ? 0xb09a6a : 0x8a764a), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.25 ? 0x3a2e22 : (Math.atan2(v - 0.5, u - 0.5) * 6) % 1 < 0.5 ? 0xb09a6a : 0x8a764a));
  return m;
}

// ---------------------------------------------------------------- the Widow's

/** Rushes cut and bundled, stood in the corner to dry, a reaping hook stuck in the top. */
function rushBundle(): IsoModel {
  const m = new IsoModel();
  for (const [x, y, h, green] of [[0.3, 0.3, 52, false], [0.55, 0.35, 46, true], [0.42, 0.55, 40, false]] as const) {
    m.cylinder(x, y, 0, 0.12, h, (u, v) => {
      if (Math.abs(v - 0.55) < 0.04) return LINEN_DARK; // the tie
      const s = Math.floor(u * 20) % 2;
      return green ? (s ? 0x5a7a3a : 0x46622e) : s ? STRAW : STRAW_DARK;
    }, (u, v) => (hash(Math.floor(u * 10), Math.floor(v * 10)) < 0.5 ? (green ? 0x6a8a4a : STRAW) : 0x3a2e22));
  }
  return m;
}

/** Nan's chair, facing her table and the fire: low and rush-seated, a cushion, a shawl over its back. */
function armchair(): IsoModel {
  const m = new IsoModel();
  const wood = { top: DEAL_LIGHT, left: DEAL, right: DEAL_DARK };
  const seat = SEAT_TOP - 2;
  for (const [x, y] of [[0.35, 0.35], [0.61, 0.35], [0.35, 0.61], [0.61, 0.61]]) m.box(x, y, 0, 0.04, 0.04, seat, wood);
  m.box(0.34, 0.34, seat, 0.32, 0.32, 2, { top: (u, v) => ((Math.floor(u * 6) + Math.floor(v * 6)) % 2 ? STRAW : STRAW_DARK), left: DEAL, right: DEAL_DARK });
  // The back, behind her, coming to her shoulders; the shawl over it.
  m.box(0.32, 0.34, seat, 0.04, 0.32, 14, { top: DEAL_LIGHT, left: DEAL_DARK, right: (u) => ((u * 4) % 1 < 0.5 ? DEAL : DEAL_DARK) });
  m.box(0.31, 0.38, seat + 8, 0.06, 0.24, 7, { top: 0x4a5a3a, left: 0x2e3a24, right: (u, v) => ((Math.floor(u * 6) + Math.floor(v * 4)) % 2 ? 0x5a6a46 : 0x3e4a30) });
  return m;
}

/**
 * The table at Nan's elbow where she makes rushlights: rushes peeled to the
 * pith in rows, a long tallow pan, rushlights set out to harden, and one
 * burning in its iron nip on a block of wood.
 */
function rushTable(): IsoModel {
  const m = new IsoModel();
  const leg = { top: DEAL_DARK, left: DEAL, right: DEAL_DARK };
  for (const [x, y] of [[0.2, 0.2], [0.74, 0.2], [0.2, 0.74], [0.74, 0.74]]) m.box(x, y, 0, 0.06, 0.06, 22, leg);
  m.box(0.15, 0.15, 22, 0.7, 0.7, 3, { top: (u, v) => planks(3, 0x7a6248, 0x5a4632, 0x8e7458, 9)(v, u) ?? DEAL, left: DEAL, right: DEAL_DARK });
  // The tallow pan: long and narrow, grey fat set in it.
  m.box(0.22, 0.25, 25, 0.5, 0.14, 2, { top: (u, v) => (u < 0.06 || u > 0.94 || v < 0.15 || v > 0.85 ? 0x3a3a42 : 0xd8ccaa), left: 0x3a3a42, right: 0x2a2a30 });
  // Rushlights set out to harden.
  for (let i = 0; i < 7; i++) m.box(0.25 + i * 0.065, 0.48, 25, 0.02, 0.28, 1, { top: i % 2 ? 0xe0d4ac : 0xc8bc94, left: 0xb8ac84, right: 0xa89c74 });
  // The nip on its block, the rushlight burning in it.
  m.box(0.55, 0.62, 25, 0.16, 0.16, 4, { top: DEAL_LIGHT, left: DEAL, right: DEAL_DARK });
  m.box(0.62, 0.69, 29, 0.02, 0.02, 12, { top: P.iron, left: P.iron, right: 0x2a2a30 });
  m.quad({ x: 0.58, y: 0.7, z: 40 }, { x: 0.12, y: 0, z: 2 }, { x: 0, y: 0, z: -1 }, () => 0xd8ccaa);
  m.box(0.69, 0.69, 41, 0.02, 0.02, 3, { top: P.fireYellow, left: P.fireOrange, right: P.fireYellow });
  return m.lower(22, 25 - TABLE_TOP);
}

/** A narrow cot under a patchwork quilt: every patch from a dress, a shirt, a sail. */
function cot(): IsoModel {
  const m = new IsoModel();
  const wood = { top: DEAL_LIGHT, left: lipped(DEAL, DEAL_LIGHT), right: DEAL_DARK };
  m.box(0.1, 0, 0, 0.8, 0.1, 30, wood);
  m.box(0.1, 0.1, 0, 0.8, 1.8, 9, wood);
  m.box(0.14, 0.12, 9, 0.72, 1.74, 4, { top: STRAW, left: STRAW_DARK, right: STRAW_DARK });
  m.box(0.12, 0.5, 13, 0.76, 1.42, 3, {
    top: (u, v) => {
      const cols = [PATCH_RED, PATCH_BLUE, PATCH_OCHRE, 0x8a8478, PATCH_GREEN, 0xc8bca0, 0x6a3a5a];
      const c = cols[(Math.floor(u * 4) * 5 + Math.floor(v * 7) * 3) % cols.length];
      return (u * 4) % 1 < 0.05 || (v * 7) % 1 < 0.05 ? 0x2a2420 : c;
    },
    left: PATCH_RED,
    right: 0x5a2420,
  });
  m.box(0.22, 0.16, 13, 0.56, 0.3, 4, { top: 0xd0c8b0, left: 0xb8b098, right: 0x9a9480 });
  m.box(0.1, 1.86, 0, 0.8, 0.08, 18, wood);
  return m;
}

/** An old black cat with a white chin asleep in a basket, nose to tail. */
function catBasket(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.3, 6, (u, v) => ((Math.floor(u * 30) + Math.floor(v * 3)) % 2 ? 0x8a6a3a : 0x6a4e2a), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.4 ? PATCH_RED : 0x7a5c32));
  // The cat, curled: a body, a head tucked in, a tail round the nose, a white chin.
  m.cylinder(0.48, 0.5, 4, 0.2, 5, (u) => (u < 0.3 ? 0x3a3438 : 0x1a1618), (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d < 0.18 && u > 0.5 && v > 0.45) return 0x2a2428; // the head
    if (Math.abs(d - 0.36) < 0.06) return 0x2e282c; // the tail curled round
    return (Math.floor(u * 14) + Math.floor(v * 14)) % 6 === 0 ? 0x3a3438 : 0x221e20;
  });
  m.box(0.6, 0.62, 8, 0.08, 0.06, 1, { top: 0xe8e4dc, left: 0xd8d4cc, right: 0xc8c4bc });
  for (const x of [0.58, 0.68]) m.box(x, 0.52, 9, 0.05, 0.04, 2, { top: 0x2a2428, left: 0x221e20, right: 0x1a1618 });
  return m;
}

// ---------------------------------------------------------------- the burnt house

/** What's left of the bed: the iron frame and springs, the straw gone, a heap of ash in the middle. */
function burntBed(): IsoModel {
  const m = new IsoModel();
  const iron = { top: 0x3a3230, left: 0x2a2422, right: 0x1a1414 };
  for (const [x, y] of [[0.08, 0.05], [0.88, 0.05], [0.08, 1.85], [0.88, 1.85]]) m.box(x, y, 0, 0.05, 0.05, 14, iron);
  m.box(0.08, 0.05, 14, 0.85, 0.05, 2, iron);
  m.box(0.08, 1.85, 14, 0.85, 0.05, 2, iron);
  m.box(0.08, 0.05, 8, 0.05, 1.85, 2, iron);
  m.box(0.88, 0.05, 8, 0.05, 1.85, 2, iron);
  // The springs: a sagging grid with ash heaped through it.
  m.quad({ x: 0.12, y: 0.1, z: 8 }, { x: 0.76, y: 0, z: 0 }, { x: 0, y: 1.75, z: 0 }, (u, v) => {
    const grid = (u * 8) % 1 < 0.12 || (v * 16) % 1 < 0.12;
    const heap = smoothNoise(u * 3, v * 5, 4) > 0.5;
    if (heap) return hash(Math.floor(u * 30), Math.floor(v * 50)) < 0.1 ? EMBER_DEAD : smoothNoise(u * 9, v * 9, 5) > 0.5 ? ASH : ASH_DARK;
    return grid ? 0x3a2e2a : null;
  });
  // The head-rail, bent with the heat.
  m.box(0.08, 0.05, 16, 0.85, 0.04, 14, { top: 0x3a3230, left: (u, v) => (v < 0.15 || (u * 6) % 1 < 0.15 ? 0x2a2422 : null), right: 0x1a1414 });
  return m;
}

/** The roof-tree, come down across the room: a great charred beam, one end on the floor, cracked into scales of char. */
function beam(): IsoModel {
  const m = new IsoModel();
  const charShade: Shader = (u, v) => {
    const scale = (Math.floor(u * 30) + Math.floor(v * 4)) % 2;
    if (hash(Math.floor(u * 60), Math.floor(v * 8)) < 0.05) return EMBER_DEAD;
    return scale ? CHAR : CHAR_LIGHT;
  };
  // Tilted: high at the far end (on the rubble) and down at the near end.
  const N = 12;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const z0 = 4 + t * 18;
    m.box(0.15 + t * 2.7, 0.3, z0, 2.7 / N + 0.02, 0.4, 8, { top: charShade, left: charShade, right: (u, v) => mixColor(charShade(u, v) ?? CHAR, 0, 0.3) });
  }
  // A heap of rubble at the far end that it rests on.
  m.cylinder(2.7, 0.5, 0, 0.3, 14, (u) => (u < 0.4 ? ASH_DARK : 0x3a3634), (u, v) => (hash(Math.floor(u * 8), Math.floor(v * 8)) < 0.4 ? CHAR : ASH_DARK));
  return m;
}

/** The table, half burnt and on its side, a pewter cup melted to a puddle beside it. */
function burntTable(): IsoModel {
  const m = new IsoModel();
  // The top, standing on its edge like a wall, burnt away at one corner.
  m.box(0.1, 0.4, 0, 0.8, 0.08, 26, {
    top: CHAR,
    left: (u, v) => (u + (1 - v) * 0.6 > 1.25 ? null : smoothNoise(u * 6, v * 6, 2) > 0.6 ? CHAR : (u * 4) % 1 < 0.06 ? CHAR : mixColor(DEAL_DARK, CHAR, 0.6)),
    right: CHAR,
  });
  // Two legs sticking out at the viewer.
  for (const z of [3, 20]) m.box(0.15, 0.48, z, 0.06, 0.4, 3, { top: mixColor(DEAL, CHAR, 0.6), left: CHAR, right: CHAR });
  // The melted cup: a bright shining puddle set hard.
  m.quad({ x: 0.5, y: 0.6, z: 0.3 }, { x: 0.35, y: 0, z: 0 }, { x: 0, y: 0.3, z: 0 }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) + smoothNoise(u * 6, v * 6, 1) * 0.15;
    if (d > 0.42) return null;
    return d < 0.15 ? TIN_LIGHT : (u + v) % 0.3 < 0.06 ? 0xe0e0e8 : TIN;
  });
  return m;
}

/** A heap of fallen daub and burnt lath. */
function rubble(seed: number): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(seed * 31 + 7);
  for (let i = 0; i < 6; i++) {
    const x = 0.25 + rnd() * 0.5;
    const y = 0.25 + rnd() * 0.5;
    const s = 0.12 + rnd() * 0.12;
    m.box(x - s / 2, y - s / 2, i * 1.5, s, s * 0.8, 3 + rnd() * 3, { top: rnd() < 0.5 ? DAUB : mixColor(LIME, CHAR, 0.5), left: mixColor(DAUB, CHAR, 0.4), right: CHAR });
  }
  for (let i = 0; i < 3; i++) m.box(0.2 + rnd() * 0.4, 0.3 + rnd() * 0.4, 6 + i, 0.4, 0.03, 1.5, { top: CHAR_LIGHT, left: CHAR, right: CHAR }); // lath
  return m;
}

/** A chair by where the window was, scorched; a pair of lighterman's boots beside it, burnt to the shape of the feet. */
function burntChair(): IsoModel {
  const m = new IsoModel();
  const wood = { top: mixColor(DEAL, CHAR, 0.6), left: CHAR_LIGHT, right: CHAR };
  for (const [x, y] of [[0.35, 0.35], [0.61, 0.35], [0.35, 0.61], [0.61, 0.61]]) m.box(x, y, 0, 0.04, 0.04, SEAT_TOP - 2, wood);
  m.box(0.34, 0.34, SEAT_TOP - 2, 0.32, 0.32, 2, wood);
  m.box(0.34, 0.34, SEAT_TOP, 0.04, 0.32, 12, { top: CHAR, left: (u) => ((u * 3) % 1 < 0.5 ? CHAR_LIGHT : null), right: CHAR });
  // The boots, side by side, tall and buckled, charred.
  for (const y of [0.72, 0.8]) {
    m.box(0.45, y, 0, 0.14, 0.06, 2, { top: 0x2a2220, left: 0x1e1816, right: 0x141010 });
    m.box(0.45, y, 2, 0.06, 0.06, 7, { top: 0x2a2220, left: (_u, v) => (Math.abs(v - 0.3) < 0.1 ? 0x5a5048 : 0x221c1a), right: 0x141010 });
  }
  return m;
}

// ---------------------------------------------------------------- registry

function put(scene: Phaser.Scene, key: string, model: IsoModel, outline = true): void {
  registerModel(scene, key, model.render(outline));
}

export function generateSump(scene: Phaser.Scene): void {
  for (const [style, kinds] of Object.entries(KINDS) as Array<[SumpStyle, SumpWallKind[]]>) {
    for (const kind of kinds) {
      for (let i = 0; i < 2; i++) {
        sumpWall(scene, style, 'back', kind, i);
        sumpWall(scene, style, 'side', kind, i);
      }
    }
    put(scene, `sp-${style}-corner`, cornerPost(style));
  }
  // The floors' things.
  put(scene, 'sp-ragrug', ragRug(2, 2, 0), false);
  put(scene, 'sp-ragrug-small', ragRug(2, 1, 3), false);
  for (let i = 0; i < 2; i++) put(scene, `sp-gaps-${i}`, floorGaps(i), false);
  put(scene, 'sp-trap', trap(), false);
  for (let i = 0; i < 3; i++) put(scene, `sp-ash-${i}`, ash(i * 5 + 2), false);
  // The hearths, two of them alight.
  putFire(scene, 'sp-hearth', hearth('crowe'), false);
  putFire(scene, 'sp-hearth-peat', hearth('peat'), true);
  put(scene, 'sp-hearth-cold', hearth('cold'));
  // The Crowes'.
  put(scene, 'sp-peatbasket', peatBasket());
  put(scene, 'sp-sewing', sewing());
  put(scene, 'sp-boxbed', boxBed());
  put(scene, 'sp-dresser', dresser());
  put(scene, 'sp-washtub', washtub());
  put(scene, 'sp-table', table());
  put(scene, 'sp-pallet', pallet());
  put(scene, 'sp-treasure', treasure());
  // Ned's.
  put(scene, 'sp-stove', stove());
  put(scene, 'sp-wickbench', wickBench());
  put(scene, 'sp-hammock', hammock());
  put(scene, 'sp-oilcans', oilCans());
  put(scene, 'sp-poles', poles());
  put(scene, 'sp-eeltrap', eelTrap());
  put(scene, 'sp-ropecoil', ropeCoil());
  // The Widow's.
  put(scene, 'sp-rushbundle', rushBundle());
  put(scene, 'sp-armchair', armchair());
  put(scene, 'sp-rushtable', rushTable());
  put(scene, 'sp-cot', cot());
  put(scene, 'sp-catbasket', catBasket());
  // The burnt house.
  put(scene, 'sp-burntbed', burntBed());
  put(scene, 'sp-beam', beam());
  put(scene, 'sp-burnttable', burntTable());
  for (let i = 0; i < 2; i++) put(scene, `sp-rubble-${i}`, rubble(i));
  put(scene, 'sp-burntchair', burntChair());
  generateSumpFolk(scene);
}
