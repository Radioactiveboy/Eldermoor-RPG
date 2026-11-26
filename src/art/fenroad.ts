import Phaser from 'phaser';
import type { Tones } from './character';
import { Detail, generateFigure3D, Hit, limb, Model, Pose3D, Solid } from './figure3d';
import { FINE_SPEC, shade } from './fine3d';
import { sized, TownLook, townModel } from './gloomfolk3d';
import { hovel } from './gloomhaven';
import { dusted } from './models3d';
import { CX, EYE_DX, EYE_Y, lightness, paintPortrait, ramp, tone, townsfolk } from './portraits';
import { MODEL_ART, registerModel } from './interior';
import { IsoModel, RenderedModel, Shader } from './IsoModel';
import { PixelCanvas, seededRandom } from './PixelCanvas';
import { smoothNoise } from './scorch';
import { noise2 } from './trees';

/**
 * The Fen Road (see world/FenRoadMap.ts): Marrable's old causeway out of
 * Gloomhaven's Fen Gate and north over the bog, and what stands along it.
 *
 * The bog oaks that lean over the road, black-barked and crooked, their
 * limbs dripping with long grey beards of moss; drowned snags standing in the
 * pools; the causeway itself, a corduroy of split logs laid across a bank of
 * peat, sunk and broken and patched; the old iron lamps along it, most of them
 * dead; a waystone with the Marrables' mark on it; a little shrine to the Lady
 * of the Mere hung with rags and offerings; the reed-cutter's stilt hut; and
 * halfway along, at the Drowned Mile, the wreck of the guild's last caravan:
 * the lead wagon rolled off the causeway and half under the bog, a wagon burnt
 * to its ribs, a cart on its back, cloth slashed and casks stove, and the
 * tracks of whatever did it going down into the water.
 *
 * The trees are painted as light on a form, like the broadleaves in trees.ts:
 * each pixel gets a brightness from which way its surface faces the light
 * (upper left), and is then stepped onto a short colour ramp.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 0xff) * (1 - t) + ((b >> s) & 0xff) * t) << s;
  return ch(16) | ch(8) | ch(0);
}
const darken = (c: number, f = 0.75) => mix(c, 0x000000, 1 - f);

// ---------------------------------------------------------------- colours

type Ramp = readonly number[];
/** Bog oak bark: near black in the furrows, grey-brown where the light catches the ridges. */
const BARK: Ramp = [0x120f0e, 0x1e1917, 0x2c2522, 0x3d342e, 0x52473e, 0x6a5e52, 0x857a6a];
/** The leaves: a sour, dark olive, going brown at the edges, never green as upriver. */
const LEAF: Ramp = [0x0f140f, 0x172014, 0x222e1a, 0x2f3d21, 0x42502a, 0x5a6534, 0x747a42];
const LEAF_RUSSET: Ramp = [0x14120d, 0x221d13, 0x33291a, 0x463722, 0x5e4a2c, 0x765e36, 0x8e7442];
/** Old man's beard: grey-green moss hanging in long strands. */
const BEARD: Ramp = [0x3c4436, 0x535c4a, 0x6c7660, 0x879078, 0xa2aa90, 0xbcc2a8];
/** Lichen on the bark. */
const LICHEN = 0x7e8a6c;
const LICHEN_LIGHT = 0xa2ac8a;
/** Peat and the black water lying on it. */
const PEAT = 0x2e241c;
const PEAT_DARK = 0x1c1612;
const PEAT_WET = 0x3e342a;
const BOGWATER = 0x22262a;
const BOGWATER_LIGHT = 0x4a5458;
/** Split logs of the causeway, silvered with age and green with slime. */
const LOG = 0x5e5446;
const LOG_DARK = 0x3a332b;
const LOG_LIGHT = 0x7e7262;
const LOG_END = 0x8e7c60;
const SLIME = 0x3a4a2a;
const MOSS = 0x4e6430;
const MOSS_LIGHT = 0x6a8240;
/** Iron, rusted. */
const IRON = 0x34343a;
const IRON_LIGHT = 0x56565e;
const RUST = 0x6a3e26;
const RUST_LIGHT = 0x8e5634;
/** A lamp's flame through dirty glass. */
const LIT = 0xf0b45a;
const LIT_HOT = 0xffe0a0;
const LIT_DEEP = 0xc06a2a;
const GLASS_DEAD = 0x2a2e30;
/** Wet stone. */
const STONE = 0x6a665e;
const STONE_DARK = 0x45423d;
const STONE_LIGHT = 0x8a857a;
/** Wagon timber, the guild's green paint on it, iron tyres, canvas tilts. */
const OAK = 0x6e5a42;
const OAK_DARK = 0x46382a;
const OAK_LIGHT = 0x8e7656;
const GUILD_GREEN = 0x3e5a3e;
const GUILD_GREEN_DARK = 0x2a3e2c;
const CANVAS = 0xb0a688;
const CANVAS_DARK = 0x847a62;
const CANVAS_LIGHT = 0xcac0a0;
const CHAR = 0x1a1412;
const CHAR_LIGHT = 0x3a2c24;
const EMBER = 0x8a3a1a;
const ASH = 0x7a746c;
/** Tunstall's scarlet, slashed; Dame Marrable's wool, burnt; the salt and eels nobody took. */
const SCARLET = 0x9a2228;
const SCARLET_DARK = 0x6a1418;
const SCARLET_LIGHT = 0xc23a34;
const WOOL = 0xd0c4a4;
const WOOL_DARK = 0x9a8e72;
const SACKING = 0xa08e6a;
const SACKING_DARK = 0x6e6048;
const SALT = 0xe8e4dc;
const BONE = 0xd8ceb4;
const BONE_DARK = 0x9a9080;
/** The lizard men's prints, pressed into the peat and filled with water. */
const PRINT = 0x161210;
const PRINT_WATER = 0x3a464c;
/** The pale scale left in the mud. */
const SCALE_WHITE = 0xe8eadc;
const SCALE_SHADE = 0xa8b0a2;
/** Rags tied on the shrine, faded. */
const RAG_COLOURS = [0x8a3a32, 0x4a5a7a, 0xb09a5a, 0x5a7a4a, 0xc0b8a0, 0x7a4a6a];

// ---------------------------------------------------------------- the bog oaks

/** A picture painted as light: each pixel has who painted it (a ramp) and how bright it is there. */
class LightPainting {
  readonly w: number;
  readonly h: number;
  readonly v: Float32Array;
  readonly owner: Int8Array;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.v = new Float32Array(w * h);
    this.owner = new Int8Array(w * h).fill(-1);
  }
  put(x: number, y: number, owner: number, v: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.owner[i] = owner;
    this.v[i] = v;
  }
  /** A round, lit lump (a knot of bark, a clump of leaves), brightest towards the light. */
  disc(cx: number, cy: number, r: number, owner: number, base: number, holes?: (x: number, y: number) => boolean): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const nx = (x + 0.5 - cx) / r;
        const ny = (y + 0.5 - cy) / r;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        if (holes && d > 0.45 && holes(x, y)) continue;
        const nz = Math.sqrt(1 - d);
        this.put(x, y, owner, base + (-0.55 * nx - 0.5 * ny + 0.55 * nz) * 0.42);
      }
    }
  }
  /** Bakes it into pixels, each owner onto its own ramp. */
  paint(c: PixelCanvas, ramps: Ramp[], noise: (x: number, y: number) => number): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const o = this.owner[i];
        if (o < 0) continue;
        const ramp = ramps[o];
        const v = this.v[i] + (noise(x * 0.5, y * 0.5) - 0.5) * 0.12;
        const k = Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length)));
        c.set(x, y, ramp[k]);
      }
    }
  }
}

/** A point along a quadratic curve from a through b to c. */
function bez(a: [number, number], b: [number, number], c: [number, number], t: number): [number, number] {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
}

/** The bark's owners: plain bark, and bark with lichen on it. */
const O_BARK = 0;
const O_LEAF = 1;
const O_LEAF_RUSSET = 2;

interface OakShape {
  seed: number;
  /** How far the crown leans out over to the right, in pixels, at the top of the trunk. */
  lean: number;
  trunkH: number;
  /** How thick the trunk is at the foot. */
  girth: number;
  /** Leaves on it (0 bare, 1 full). */
  leafy: number;
  /** How much of the beard moss hangs from it (0..1.5). */
  beard: number;
  /** Mostly russet leaves rather than olive. */
  russet?: number;
  /** Stands in water: no roots spread on the ground, but a ring of ripples and knees round the foot. */
  drowned?: boolean;
}

/** A bog oak's picture and where its foot is. */
interface Painted {
  canvas: PixelCanvas;
  foot: { x: number; y: number };
}

const OAK_W = 380;
const OAK_H = 340;

/**
 * A bog oak: a squat, black, crooked trunk with its roots knuckled into the
 * peat, leaning hard one way, its great limbs reaching out over the road and
 * ending in dark, ragged clumps of leaf, and from every limb and clump the
 * moss hanging down in grey beards, some nearly to the ground.
 */
function bogOak(s: OakShape): Painted {
  const W = OAK_W;
  const H = OAK_H;
  const c = new PixelCanvas(W, H);
  const p = new LightPainting(W, H);
  const rnd = seededRandom(s.seed);
  const noise = noise2(s.seed);
  const foot = { x: Math.round(W * 0.42), y: H - 22 };
  const top: [number, number] = [foot.x + s.lean, foot.y - s.trunkH];
  const bend: [number, number] = [foot.x - s.lean * 0.4 + (rnd() - 0.5) * 20, foot.y - s.trunkH * 0.55];
  /** Where the beards hang from, and how long they may be. */
  const beards: Array<{ x: number; y: number; len: number }> = [];
  /** Where leaf clumps go. */
  const clumps: Array<{ x: number; y: number; r: number }> = [];

  // A limb, as a run of lit discs along a curve, with bark furrows in it.
  const limb = (a: [number, number], b: [number, number], ctl: [number, number], r0: number, r1: number, base = 0.5) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.ceil(len * 1.4);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const [x, y] = bez(a, ctl, b, t);
      const r = r0 + (r1 - r0) * t;
      p.disc(x, y, r, O_BARK, base + (noise(x * 0.3, y * 0.12) - 0.5) * 0.35);
      if (rnd() < 0.025 * (r > 3 ? 1 : 0.4)) beards.push({ x: x + (rnd() - 0.5) * r, y: y + r * 0.6, len: 10 + rnd() * 34 });
    }
  };
  // A branch that forks as it goes, ending in clumps of leaf.
  const branch = (x: number, y: number, a: number, len: number, r: number, depth: number) => {
    const ex = x + Math.sin(a) * len;
    const ey = y - Math.cos(a) * len * 0.8;
    // Sagging under its own weight, then lifting at the tip: the crooked bog-oak habit.
    const ctl: [number, number] = [x + Math.sin(a) * len * 0.5, y - Math.cos(a) * len * 0.25 + len * 0.12];
    limb([x, y], [ex, ey], ctl, r, Math.max(1, r * 0.55));
    if (depth > 0) {
      const forks = 2 + (rnd() < 0.4 ? 1 : 0);
      for (let k = 0; k < forks; k++) {
        const t = 0.55 + rnd() * 0.4;
        const [fx, fy] = bez([x, y], ctl, [ex, ey], t);
        branch(fx, fy, a + (rnd() - 0.5) * 1.5 + (k - (forks - 1) / 2) * 0.5, len * (0.45 + rnd() * 0.25), Math.max(1, r * 0.55), depth - 1);
      }
    } else {
      clumps.push({ x: ex, y: ey, r: 16 + rnd() * 14 });
    }
    if (depth <= 1) {
      clumps.push({ x: ex + (rnd() - 0.5) * 10, y: ey + (rnd() - 0.2) * 8, r: 14 + rnd() * 12 });
      const [mx, my] = bez([x, y], ctl, [ex, ey], 0.55);
      clumps.push({ x: mx, y: my - 6, r: 12 + rnd() * 10 });
    }
  };

  // The roots: knuckled over the peat and into it (or, standing in water, knees poking up round it).
  const roots = 6;
  for (let i = 0; i < roots; i++) {
    const side = i % 2 ? 1 : -1;
    const spread = (0.35 + rnd() * 0.65) * s.girth * 2.6;
    const end: [number, number] = [foot.x + side * spread, foot.y + 2 + rnd() * 9];
    const ctl: [number, number] = [foot.x + side * spread * 0.4, foot.y - 6 - rnd() * 8];
    limb([foot.x + side * s.girth * 0.3, foot.y - 6], end, ctl, s.girth * 0.45, 1.5, 0.42);
    if (s.drowned) for (let k = 0; k < 2; k++) p.disc(foot.x + side * (spread + 6 + rnd() * 16), foot.y + 4 + rnd() * 8, 2 + rnd() * 2, O_BARK, 0.45);
  }
  // Limbs behind the trunk first (they're shaded), then the trunk, then the limbs in front of it.
  const limbs = 4 + Math.floor(rnd() * 3);
  const limbAt: Array<{ t: number; a: number; len: number; front: boolean }> = [];
  for (let i = 0; i < limbs; i++) {
    const towards = rnd() < 0.72 ? 1 : -1;
    limbAt.push({
      t: 0.45 + rnd() * 0.55,
      a: towards * (0.5 + rnd() * 0.9) + s.lean / 400,
      len: (0.55 + rnd() * 0.4) * (80 + Math.abs(s.lean) * 0.35),
      front: rnd() < 0.5,
    });
  }
  for (const l of limbAt.filter((q) => !q.front)) {
    const [x, y] = bez([foot.x, foot.y], bend, top, l.t);
    branch(x, y, l.a, l.len, s.girth * 0.42, 2);
  }
  // The trunk: thick, furrowed and twisted, with a burr or two.
  const steps = Math.ceil(s.trunkH * 1.6);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [x, y] = bez([foot.x, foot.y], bend, top, t);
    const flare = Math.max(0, (0.18 - t) / 0.18);
    const r = s.girth * (1 - t * 0.45) + flare * flare * s.girth * 0.7;
    // Furrows spiral up the trunk.
    for (let yy = Math.floor(y - 1); yy <= Math.ceil(y + 1); yy++) {
      for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
        const n = (xx + 0.5 - x) / r;
        if (Math.abs(n) > 1) continue;
        let v = 0.6 - n * 0.42 - Math.abs(n) ** 3 * 0.18;
        const twist = n * 1.6 + t * 9;
        const furrow = Math.abs(Math.sin(twist * 2.2 + noise(xx * 0.2, yy * 0.05) * 3));
        if (furrow < 0.22) v -= 0.32;
        else if (furrow > 0.85) v += 0.08;
        if (t < 0.06) v -= (0.06 - t) * 4;
        p.put(xx, yy, O_BARK, v);
      }
    }
  }
  for (let k = 0; k < 2; k++) {
    const [x, y] = bez([foot.x, foot.y], bend, top, 0.25 + rnd() * 0.5);
    p.disc(x + (rnd() - 0.6) * s.girth, y, s.girth * (0.35 + rnd() * 0.2), O_BARK, 0.5);
  }
  for (const l of limbAt.filter((q) => q.front)) {
    const [x, y] = bez([foot.x, foot.y], bend, top, l.t);
    branch(x, y, l.a, l.len, s.girth * 0.45, 2);
  }
  // The crown at the top of the trunk, too.
  if (s.leafy > 0) clumps.push({ x: top[0], y: top[1] - 8, r: 18 }, { x: top[0] + s.lean * 0.3, y: top[1] - 2, r: 16 });

  // Leaf: each clump a heap of small lit lumps, ragged at the edge, brighter on the side towards the light.
  if (s.leafy > 0) {
    const holes = (x: number, y: number) => noise(x * 0.35, y * 0.35) < 0.45;
    clumps.sort((a, b) => a.y - b.y);
    for (const cl of clumps) {
      if (rnd() > s.leafy) continue;
      const russet = rnd() < (s.russet ?? 0.15);
      const lumps = Math.round(cl.r * 2.4);
      for (let k = 0; k < lumps; k++) {
        const ang = rnd() * Math.PI * 2;
        const dist = Math.sqrt(rnd()) * cl.r;
        const lx = cl.x + Math.cos(ang) * dist;
        const ly = cl.y + Math.sin(ang) * dist * 0.7;
        // Where in the clump: the upper left catches the light, the underside is in its own shade.
        const inClump = (-(lx - cl.x) * 0.5 - (ly - cl.y) * 0.7) / cl.r;
        p.disc(lx, ly, 3.5 + rnd() * 4, russet ? O_LEAF_RUSSET : O_LEAF, 0.4 + inClump * 0.22, holes);
      }
      // The underside of every clump drips with beard.
      for (let k = 0; k < 2; k++) beards.push({ x: cl.x + (rnd() - 0.5) * cl.r * 1.4, y: cl.y + cl.r * 0.5, len: 14 + rnd() * 46 * s.beard });
    }
  }
  p.paint(c, [BARK, LEAF, LEAF_RUSSET], noise);
  // Lichen in grey-green scabs on the trunk and the tops of the limbs.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (p.owner[i] !== O_BARK) continue;
      const n = noise(x * 0.18 + 40, y * 0.18);
      const lit = p.v[i] > 0.55;
      if (n > 0.78 && lit) c.set(x, y, n > 0.84 ? LICHEN_LIGHT : LICHEN);
      else if (n > 0.74 && y > foot.y - s.trunkH * 0.25) c.set(x, y, n > 0.8 ? MOSS_LIGHT : MOSS);
    }
  }
  c.outline();

  // The beards: long strands of moss, in hanks, swaying a little, thinning to wisps at the ends.
  for (const b of beards) {
    if (rnd() > Math.min(1, s.beard)) continue;
    const strands = 2 + Math.floor(rnd() * 4);
    for (let k = 0; k < strands; k++) {
      const sx = b.x + (rnd() - 0.5) * 6;
      const len = b.len * (0.5 + rnd() * 0.6) * (s.beard > 1 ? 1.3 : 1);
      const sway = (rnd() - 0.5) * 6;
      const lit = sx < foot.x + s.lean * 0.5 ? 1 : 0;
      for (let j = 0; j < len; j++) {
        const t = j / len;
        if (t > 0.7 && rnd() < (t - 0.7) * 2.4) continue;
        const x = sx + Math.sin(t * Math.PI) * sway + Math.sin(j * 0.4 + k) * 0.6;
        const y = b.y + j;
        if (y >= H) break;
        const shade = Math.min(BEARD.length - 1, Math.max(0, 1 + lit + Math.floor(rnd() * 3) - (t > 0.6 ? 1 : 0)));
        c.set(x, y, BEARD[shade], t > 0.8 ? 190 : 235);
        if (rnd() < 0.5 && t < 0.6) c.set(x + 1, y, BEARD[Math.max(0, shade - 2)], 220);
      }
    }
  }
  // A pool of shade on the ground under it (after the outline, so it has none).
  for (let y = foot.y - 14; y <= foot.y + 16; y++) {
    for (let x = foot.x - 120; x <= foot.x + 140; x++) {
      const d = ((x - foot.x - s.lean * 0.4) / 120) ** 2 + ((y - foot.y - 2) / 15) ** 2;
      if (d <= 1 && c.get(x, y) === null) c.set(x, y, 0x080a08, d < 0.4 ? 70 : 42);
    }
  }
  return { canvas: c, foot };
}

/** The bog oaks, by key: three in leaf, a russet one going over, and two drowned snags with nothing on them but beard. */
const OAKS: Record<string, OakShape> = {
  'fr-oak-0': { seed: 1101, lean: 70, trunkH: 120, girth: 15, leafy: 1, beard: 0.8 },
  'fr-oak-1': { seed: 1213, lean: 34, trunkH: 150, girth: 16, leafy: 1, beard: 1 },
  'fr-oak-2': { seed: 1327, lean: 96, trunkH: 96, girth: 17, leafy: 1, beard: 0.7 },
  'fr-oak-3': { seed: 1433, lean: 58, trunkH: 132, girth: 13, leafy: 0.9, beard: 0.9, russet: 0.7 },
  'fr-snag-0': { seed: 1549, lean: 30, trunkH: 110, girth: 8, leafy: 0, beard: 1.4, drowned: true },
  'fr-snag-1': { seed: 1663, lean: -20, trunkH: 80, girth: 9, leafy: 0.15, beard: 1.5, drowned: true },
};
export const FEN_OAKS = Object.keys(OAKS).filter((k) => k.startsWith('fr-oak'));
export const FEN_SNAGS = Object.keys(OAKS).filter((k) => k.startsWith('fr-snag'));

// ---------------------------------------------------------------- bulrushes and bog cotton

/** Bulrushes: a dense stand of tall blades, with the brown cigar heads standing up out of them. */
function bulrushes(seed: number): PixelCanvas {
  const W = 56;
  const H = 96;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  const foot = { x: W / 2, y: H - 10 };
  const GREEN = [0x2e3a1c, 0x405028, 0x566a32, 0x70843e, 0x8a9a52];
  for (let i = 0; i < 44; i++) {
    const bx = foot.x + (rnd() - 0.5) * 26;
    const by = foot.y + (rnd() - 0.5) * 8;
    const len = 30 + rnd() * 48;
    const lean = (rnd() - 0.5) * 0.7;
    const tone = Math.floor(rnd() * 4);
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const x = bx + lean * k * t;
      const y = by - k;
      c.set(x, y, GREEN[Math.min(4, Math.max(0, tone + (t > 0.7 ? 1 : 0) - (t < 0.2 ? 2 : 0)))]);
    }
    // The seed heads: brown, velvety, on the taller stems.
    if (len > 54 && rnd() < 0.5) {
      const hx = bx + lean * len;
      const hy = by - len + 6;
      for (let k = 0; k < 9; k++) {
        c.set(hx, hy + k, k < 2 ? 0x8a6a42 : 0x5a3a20);
        c.set(hx + 1, hy + k, k < 3 ? 0x6e4a2a : 0x3e2a18);
      }
      c.set(hx, hy - 1, GREEN[2]);
      c.set(hx, hy - 2, GREEN[2]);
    }
  }
  c.outline();
  return c;
}

/** Bog cotton: a tussock of sedge with white tufts nodding on thin stalks, very bright in the gloom. */
function bogCotton(seed: number): PixelCanvas {
  const W = 40;
  const H = 40;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  const foot = { x: W / 2, y: H - 8 };
  for (let i = 0; i < 26; i++) {
    const bx = foot.x + (rnd() - 0.5) * 18;
    const len = 6 + rnd() * 10;
    const lean = (rnd() - 0.5) * 1.4;
    for (let k = 0; k < len; k++) c.set(bx + lean * k * 0.5, foot.y - k + (rnd() - 0.5) * 2, k < 3 ? 0x3e4a24 : rnd() < 0.3 ? 0x8a8a4a : 0x5e6e32);
  }
  for (let i = 0; i < 9; i++) {
    const x = foot.x + (rnd() - 0.5) * 22;
    const h = 12 + rnd() * 12;
    for (let k = 0; k < h; k++) c.set(x + (k / h) * (rnd() - 0.5), foot.y - k, 0x6a6a3e);
    const ty = foot.y - h - 2;
    c.ellipse(x, ty, 2.2, 2.6, 0xf2f0e6, 0xbab6aa, 0xffffff);
  }
  c.outline();
  return c;
}

// ---------------------------------------------------------------- the causeway

/** A flat piece of ground on a tile (see the duckboards and patches in gloomhaven.ts). */
function flat(paint: Shader): RenderedModel {
  const m = new IsoModel();
  m.quad({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, paint);
  return m.render(false);
}

/**
 * The causeway's corduroy on a tile: split logs laid side by side across the
 * way (along x, the road running along y), bedded in peat. `wear` 0 is sound;
 * 1 is sunk and broken, half the logs gone and black water standing in the gaps.
 */
function corduroy(seed: number, wear: number): RenderedModel {
  const m = new IsoModel();
  const rnd = seededRandom(seed);
  // The peat under it, wet and dark, with water lying in the hollows when it's worn.
  m.quad({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const n = smoothNoise(u * 5, v * 5, seed);
    if (wear > 0.4 && n > 0.62 - wear * 0.2) return n > 0.72 ? BOGWATER_LIGHT : BOGWATER;
    return n < 0.3 ? PEAT_DARK : n > 0.6 ? PEAT_WET : PEAT;
  });
  const logs = 5;
  for (let i = 0; i < logs; i++) {
    if (rnd() < wear * 0.55) continue;
    const y0 = 0.02 + i * (0.96 / logs);
    const d = 0.96 / logs - 0.03;
    // Logs don't quite reach the edges, and some are short, snapped or skewed.
    const x0 = 0.02 + rnd() * 0.1;
    const x1 = 0.98 - rnd() * (rnd() < wear ? 0.45 : 0.1);
    const sink = rnd() < wear ? -2 : 0;
    const green = rnd() < 0.35;
    const log: Shader = (u, v) => {
      if (hash(Math.floor(u * 40), i + seed) < 0.05) return LOG_DARK;
      // Rounded on top: the light along the near side, shade along the far.
      let c = v < 0.3 ? LOG_LIGHT : v > 0.75 ? LOG_DARK : LOG;
      if (green && smoothNoise(u * 3, v * 2, seed + i) > 0.55) c = mix(c, SLIME, 0.55);
      if (smoothNoise(u * 6, v, seed * 3 + i) > 0.78) c = mix(c, MOSS, 0.5);
      return c;
    };
    m.box(x0, y0, sink, x1 - x0, d, 2.6, { top: log, left: LOG_DARK, right: (u, v) => (v > 0.3 && v < 0.7 && u > 0.4 && u < 0.6 ? LOG_LIGHT : LOG_END) });
  }
  return m.render(false);
}

/** Black water lying in a hollow of the road: a sheet of it, catching the sky, with the logs showing through. */
function sunkPatch(seed: number): RenderedModel {
  return flat((u, v) => {
    const d = Math.hypot(u - 0.5, (v - 0.5) * 1.2) * 2 + (smoothNoise(u * 4, v * 4, seed) - 0.5) * 0.6;
    if (d > 0.9) return null;
    if (d > 0.78) return PEAT_WET;
    if (Math.floor(v * 5 + 0.3) % 1 === 0 && hash(Math.floor(v * 5), seed) < 0.5 && Math.abs((v * 5) % 1 - 0.5) < 0.3) return mix(BOGWATER, LOG, 0.35);
    if (u + v < 0.8 && d > 0.4 && hash(Math.floor(u * 30), Math.floor(v * 30)) < 0.6) return BOGWATER_LIGHT;
    return BOGWATER;
  });
}

/** A mire: black peat ooze with a sheen, bubbles of marsh gas, a tuft or two. */
function mire(seed: number): RenderedModel {
  return flat((u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2 + (smoothNoise(u * 3, v * 3, seed) - 0.5) * 0.7;
    if (d > 0.95) return null;
    const n = hash(Math.floor(u * 36), Math.floor(v * 36) + seed);
    if (d > 0.8) return n < 0.5 ? PEAT_DARK : null;
    // Bubbles, rings of them.
    const bx = u * 6 - Math.floor(u * 6) - 0.5;
    const by = v * 6 - Math.floor(v * 6) - 0.5;
    if (hash(Math.floor(u * 6), Math.floor(v * 6) + seed) < 0.18 && Math.abs(Math.hypot(bx, by) - 0.25) < 0.08) return 0x5a564a;
    return n < 0.15 ? 0x161210 : n > 0.85 ? 0x3e3a30 : 0x241e18;
  });
}

// ---------------------------------------------------------------- along the road

/** Draws a lit post: a round shaft of wood or iron. */
function shaft(m: IsoModel, x: number, y: number, r: number, h: number, base: number, dark: number, light: number, z = 0): void {
  m.cylinder(x, y, z, r, h, (u) => (u < 0.3 ? light : u > 0.7 ? dark : base), light);
}

/**
 * One of the causeway's old lamps: a crooked iron post leaning in the peat, a
 * hook, and a lantern of dirty glass swinging under it, lit or long dead.
 */
function causewayLamp(lit: boolean, lean: number): IsoModel {
  const m = new IsoModel();
  const H = 70;
  // The post, in short lengths so it can lean.
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const dx = lean * t * t * 0.4;
    m.box(0.46 + dx, 0.46, (H * i) / segs, 0.08, 0.08, H / segs + 0.5, {
      top: IRON_LIGHT,
      left: (_, v) => (hash(Math.floor(v * 6) + i * 6, 1) < 0.25 ? RUST : IRON),
      right: (_, v) => (hash(Math.floor(v * 6) + i * 6, 2) < 0.25 ? RUST : darken(IRON, 0.7)),
    });
  }
  const tx = 0.5 + lean * 0.4;
  // The arm, and the lantern on its hook.
  m.box(tx - 0.02, 0.48, H - 2, 0.32, 0.04, 2, { top: IRON_LIGHT, left: IRON, right: IRON });
  m.box(tx + 0.25, 0.49, H - 7, 0.02, 0.02, 5, { top: IRON, left: IRON, right: IRON });
  const glass = (u: number, v: number) => {
    if (u < 0.16 || u > 0.84 || v < 0.1 || v > 0.9) return IRON;
    if (!lit) return hash(Math.floor(u * 8), Math.floor(v * 8)) < 0.3 ? 0x3a4040 : GLASS_DEAD;
    return v < 0.35 ? LIT_HOT : v < 0.75 ? LIT : LIT_DEEP;
  };
  m.box(tx + 0.18, 0.42, H - 19, 0.16, 0.16, 12, { top: IRON, left: glass, right: (u, v) => (lit ? darken(glass(u, v) ?? IRON, 0.8) : glass(u, v)) });
  m.box(tx + 0.17, 0.41, H - 7, 0.18, 0.18, 1.5, { top: RUST_LIGHT, left: RUST, right: darken(RUST, 0.7) });
  // Tufts round the foot.
  for (let i = 0; i < 5; i++) m.box(0.3 + hash(i, 4) * 0.4, 0.3 + hash(i, 5) * 0.4, 0, 0.03, 0.03, 3 + hash(i, 6) * 4, { top: 0x6a7a3a, left: 0x4e5a2a, right: 0x3a4420 });
  return m;
}

/**
 * The waystone: a squat block of grey stone, leaning, its top furred with moss,
 * cut with a mark of three wavy lines under a bar (the Marrables') and the miles.
 */
function waystone(): IsoModel {
  const m = new IsoModel();
  const face = (seed: number, carve: boolean): Shader => (u, v) => {
    const n = smoothNoise(u * 4, v * 6, seed);
    let c = n < 0.35 ? STONE_DARK : n > 0.65 ? STONE_LIGHT : STONE;
    if (v < 0.18 + 0.1 * smoothNoise(u * 5, 1, seed)) c = n > 0.5 ? MOSS_LIGHT : MOSS;
    if (v > 0.86) c = mix(c, SLIME, 0.6);
    if (carve) {
      // The bar and three waves, then two strokes for the miles.
      const bar = Math.abs(v - 0.3) < 0.03 && u > 0.25 && u < 0.75;
      const wave = [0.4, 0.48, 0.56].some((w) => Math.abs(v - w - Math.sin(u * 18) * 0.02) < 0.018) && u > 0.25 && u < 0.75;
      const miles = (Math.abs(u - 0.43) < 0.03 || Math.abs(u - 0.57) < 0.03) && v > 0.65 && v < 0.8;
      if (bar || wave || miles) return 0x2a2826;
    }
    return c;
  };
  m.box(0.3, 0.32, 0, 0.4, 0.3, 26, { top: (u, v) => (smoothNoise(u * 3, v * 3, 7) > 0.4 ? MOSS_LIGHT : MOSS), left: face(3, true), right: face(5, false) });
  // A cap stone, set askew.
  m.box(0.27, 0.3, 26, 0.46, 0.35, 4, { top: MOSS, left: STONE, right: STONE_DARK });
  return m;
}

/**
 * The shrine of the Lady of the Mere: a post of black bog oak carved at the top
 * into a woman's face with her eyes shut, a little roof of reed over it, rags
 * of every colour tied round it, and offerings on a flat stone at its foot:
 * coins, a fish's bones, a doll of rushes, a candle stub.
 */
function shrine(): IsoModel {
  const m = new IsoModel();
  // The stone at the foot, and what's on it.
  m.box(0.22, 0.38, 0, 0.56, 0.42, 4, { top: (u, v) => (smoothNoise(u * 3, v * 3, 2) > 0.6 ? MOSS : STONE), left: STONE_DARK, right: darken(STONE_DARK, 0.8) });
  for (const [x, y] of [[0.34, 0.5], [0.4, 0.56], [0.62, 0.48]]) m.cylinder(x, y, 4, 0.03, 0.6, () => 0x9a8a5a, 0xc8b070);
  m.box(0.5, 0.64, 4, 0.04, 0.04, 4, { top: LIT_HOT, left: 0xe8e0c8, right: 0xc8c0a8 });
  m.box(0.6, 0.6, 4, 0.12, 0.02, 1, { top: BONE, left: BONE_DARK, right: BONE_DARK });
  m.box(0.28, 0.66, 4, 0.05, 0.05, 6, { top: 0x8a8a4a, left: 0x6e6e3a, right: 0x5a5a2e });
  // The post, its carved face looking down the road.
  const H = 46;
  m.box(0.42, 0.42, 0, 0.16, 0.16, H, {
    top: CHAR_LIGHT,
    left: (u, v) => {
      // The face: brow, shut eyes, a long nose, a small mouth, in the top third.
      if (v < 0.32 && v > 0.04) {
        const y = v / 0.32;
        if (Math.abs(y - 0.35) < 0.05 && (Math.abs(u - 0.3) < 0.14 || Math.abs(u - 0.7) < 0.14)) return 0x0c0a0a;
        if (Math.abs(u - 0.5) < 0.06 && y > 0.35 && y < 0.65) return 0x4a3c32;
        if (Math.abs(y - 0.8) < 0.04 && Math.abs(u - 0.5) < 0.12) return 0x0c0a0a;
        return y < 0.2 ? 0x3c3028 : 0x4e4036;
      }
      return hash(Math.floor(u * 4), Math.floor(v * 30)) < 0.2 ? 0x1a1412 : CHAR_LIGHT;
    },
    right: (u, v) => (hash(Math.floor(u * 4) + 3, Math.floor(v * 30)) < 0.2 ? 0x0e0b0a : 0x2a221c),
  });
  // Rags, tied round it and hanging.
  for (let i = 0; i < 9; i++) {
    const z = 10 + hash(i, 1) * 22;
    const col = RAG_COLOURS[i % RAG_COLOURS.length];
    const side = hash(i, 2) < 0.5;
    if (side) m.quad({ x: 0.42 + hash(i, 3) * 0.14, y: 0.585, z }, { x: 0.05, y: 0, z: 0 }, { x: 0.02, y: 0.02, z: -(5 + hash(i, 4) * 6) }, (u, v) => (v > 0.8 && u > 0.5 ? null : col));
    else m.quad({ x: 0.585, y: 0.42 + hash(i, 3) * 0.14, z }, { x: 0, y: 0.05, z: 0 }, { x: 0.02, y: 0.02, z: -(5 + hash(i, 4) * 6) }, (u, v) => (v > 0.8 && u > 0.5 ? null : darken(col, 0.8)));
  }
  // The little roof of reed thatch.
  m.quad({ x: 0.3, y: 0.32, z: H + 6 }, { x: 0.4, y: 0, z: 0 }, { x: 0, y: 0.38, z: -8 }, (u, v) => (hash(Math.floor(u * 30), 3) < 0.3 ? 0x6a5a38 : v > 0.85 ? 0x4a3e26 : 0x8a7a4e));
  m.quad({ x: 0.3, y: 0.7, z: H - 2 }, { x: 0.4, y: 0, z: 0 }, { x: 0, y: 0, z: -2 }, 0x4a3e26);
  return m;
}

/**
 * A peat cut by the road, long abandoned, and what the cutters left in it: a
 * body as old as the fen, brown as a saddle, curled on its side with a cord
 * still round its neck.
 */
function bogBody(): RenderedModel {
  const m = new IsoModel();
  // The cut: a sunk rectangle of wet black peat, its walls showing the layers.
  m.quad({ x: 0.05, y: 0.1, z: -6 }, { x: 1.9, y: 0, z: 0 }, { x: 0, y: 0.8, z: 0 }, (u, v) => {
    const n = smoothNoise(u * 8, v * 4, 31);
    return n > 0.7 ? BOGWATER_LIGHT : n > 0.55 ? BOGWATER : PEAT_DARK;
  });
  m.quad({ x: 0.05, y: 0.1, z: 0 }, { x: 1.9, y: 0, z: 0 }, { x: 0, y: 0, z: -6 }, (_, v) => (Math.floor(v * 6) % 2 ? PEAT : 0x3a2c20));
  m.quad({ x: 0.05, y: 0.1, z: 0 }, { x: 0, y: 0.8, z: 0 }, { x: 0, y: 0, z: -6 }, (_, v) => (Math.floor(v * 6) % 2 ? PEAT_DARK : PEAT));
  // The body: leathery brown, knees drawn up, an arm over the face.
  const SKIN = [0x3e2614, 0x5a3a1e, 0x7a5230, 0x96683c];
  const blob = (x: number, y: number, rx: number, ry: number, h: number, tone = 1) =>
    m.cylinder(x, y, -6, Math.min(rx, ry), h, (u) => SKIN[Math.max(0, Math.min(3, tone + (u < 0.3 ? 1 : u > 0.7 ? -1 : 0)))], SKIN[tone + 1]);
  blob(1.45, 0.5, 0.16, 0.16, 7, 1); // head
  blob(1.15, 0.5, 0.22, 0.22, 8, 1); // shoulders
  blob(0.85, 0.52, 0.2, 0.2, 7, 1); // hips
  blob(0.75, 0.32, 0.12, 0.12, 6, 2); // knees
  blob(1.3, 0.62, 0.08, 0.08, 9, 2); // the arm over the face
  // The cord, and a scrap of hide cape.
  m.box(1.36, 0.42, 1.5, 0.04, 0.16, 0.6, { top: 0x8a6a3a, left: 0x6a4e2a, right: 0x5a4222 });
  m.quad({ x: 0.95, y: 0.62, z: 2 }, { x: 0.3, y: 0, z: 0 }, { x: 0, y: 0.16, z: -4 }, (u, v) => (hash(Math.floor(u * 9), Math.floor(v * 9)) < 0.25 ? null : 0x4a3220));
  // Rushes round the lip.
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const [x, y] = i % 2 ? [0.05 + t * 1.9, 0.08] : [0.05, 0.1 + t * 0.8];
    m.box(x, y, 0, 0.03, 0.03, 4 + hash(i, 9) * 6, { top: 0x6a7a3a, left: 0x56663a, right: 0x3a4420 });
  }
  return m.render(true);
}

// ---------------------------------------------------------------- the reed-cutter's place

/** A stack of cut reed in bundles, leaning on a frame to dry. */
function reedStack(): IsoModel {
  const m = new IsoModel();
  shaft(m, 0.1, 0.5, 0.04, 24, OAK, OAK_DARK, OAK_LIGHT);
  shaft(m, 0.9, 0.5, 0.04, 24, OAK, OAK_DARK, OAK_LIGHT);
  m.box(0.08, 0.48, 22, 0.84, 0.04, 2, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  for (let i = 0; i < 7; i++) {
    const x = 0.14 + i * 0.11;
    m.quad({ x, y: 0.9, z: 0 }, { x: 0.1, y: 0, z: 0 }, { x: 0, y: -0.38, z: 26 }, (u, v) => {
      if (Math.abs(v - 0.55) < 0.04) return 0x5a3e22; // the band round the bundle
      const n = hash(Math.floor(u * 10) + i * 10, 1);
      if (v < 0.12) return n < 0.5 ? 0x9a7a4a : null; // the feathery heads
      return n < 0.2 ? 0x8a7a4a : n < 0.6 ? 0xb4a26a : 0xc8b884;
    });
  }
  return m;
}

/** An eel trap: a long tapering basket of withies, and a little heap of them by the door. */
function eelTraps(): IsoModel {
  const m = new IsoModel();
  for (let i = 0; i < 3; i++) {
    const y = 0.25 + i * 0.22;
    const r = 0.1 - i * 0.01;
    m.cylinder(0.3 + i * 0.05, y, 0, r, 5, (u) => (Math.floor(u * 12) % 2 ? 0x8a7448 : 0x6a5634), 0x4a3c26);
    m.box(0.3 + i * 0.05, y - r * 0.6, 1, 0.45, r * 1.2, 3, { top: (u) => (Math.floor(u * 14) % 2 ? 0x9a845a : 0x6e5a38), left: 0x6a5634, right: 0x5a4628 });
  }
  return m;
}

/** The reed-cutter's hut: one room of grey boards up on stilts over her pool, thatched with her own reed, a lit window, a ladder. */
function reedHut(): IsoModel {
  return hovel({
    seed: 97, size: 3, H: 32, R: 40, walls: 'boards', roof: 'thatch', lean: 0.14, sag: 8, stilts: 24,
    front: [{ u0: 0.14, u1: 0.32, y0: 8, y1: 20, pane: 'lit' }],
    side: [{ u0: 0.42, u1: 0.6, y0: 8, y1: 20, pane: 'shuttered' }],
    door: [0.52, 0.7], chimney: { at: 0.78, lean: 0.25 }, lantern: true, crow: 0.3, creeper: 0.85,
  });
}

/**
 * A stake by the road outside the gate with a skull on it, facing out over the fen: not a man's, but long
 * and flat, ridged down the middle, with too many teeth and all of them pointing back.
 */
function skullStake(): IsoModel {
  const m = new IsoModel();
  shaft(m, 0.5, 0.5, 0.05, 38, OAK, OAK_DARK, OAK_LIGHT);
  // The skull: a long wedge, the snout towards +y (out over the road), eye holes, a ridge, the teeth.
  m.box(0.4, 0.36, 36, 0.2, 0.5, 7, {
    top: (u, v) => (Math.abs(u - 0.5) < 0.1 ? 0xb8b098 : v > 0.15 && v < 0.35 && Math.abs(u - 0.5) > 0.25 ? 0x1a1410 : BONE),
    left: (u, v) => (v > 0.6 && Math.floor(u * 14) % 2 === 0 ? 0xf0ead8 : u < 0.3 && v < 0.5 ? 0x2a2018 : BONE_DARK),
    right: (u, v) => (v > 0.6 && Math.floor(u * 14) % 2 === 0 ? 0xd8d0bc : darken(BONE_DARK, 0.8)),
  });
  // A few rags and a string of snail shells tied under it.
  m.quad({ x: 0.55, y: 0.56, z: 34 }, { x: 0.05, y: 0, z: 0 }, { x: 0.01, y: 0.02, z: -9 }, 0x8a3a32);
  for (let i = 0; i < 4; i++) m.box(0.46, 0.56, 30 - i * 3, 0.04, 0.04, 2, { top: 0xd8c8a0, left: 0xb8a880, right: 0x8a7a5a });
  return m;
}

// ---------------------------------------------------------------- the wreck at the Drowned Mile

/** A spoked wheel standing (or lying) as a quad: rim, spokes and an iron tyre. */
function wheel(m: IsoModel, origin: { x: number; y: number; z: number }, du: { x: number; y: number; z: number }, dv: { x: number; y: number; z: number }, broken = 0, burnt = false): void {
  const rim = burnt ? CHAR : OAK_DARK;
  const spoke = burnt ? CHAR_LIGHT : OAK;
  m.quad(origin, du, dv, (u, v) => {
    const dx = (u - 0.5) * 2;
    const dy = (v - 0.5) * 2;
    const d = Math.hypot(dx, dy);
    if (d > 1) return null;
    const a = Math.atan2(dy, dx);
    if (broken && a > 0.6 && a < 0.6 + broken) return null;
    if (d > 0.9) return burnt ? 0x2a2a30 : IRON;
    if (d > 0.76) return rim;
    if (d < 0.2) return d < 0.1 ? IRON_LIGHT : rim;
    return Math.abs(((a / Math.PI) * 5 + 10) % 1 - 0.5) < 0.12 ? spoke : null;
  });
}

/**
 * The lead wagon, rolled off the causeway: a big four-wheeled tilt wagon in
 * the guild's green, lying over on its side at a slant, the near side under
 * the black water up to the bed, the far wheels up in the air, the tilt
 * slashed open and scarlet cloth spilling out of it into the bog. Drawn with a
 * depth buffer (it's tipped every which way). 3 x 2 tiles.
 */
function sunkWagon(): IsoModel {
  const m = IsoModel.turned(-0.32, { x: 1.5, y: 1 });
  // The bed: tilted over, its near side (+y) down in the water, the far side up.
  const x0 = 0.2;
  const x1 = 2.85;
  const yNear = 1.55;
  const yFar = 0.55;
  const zNear = 0;
  const zFar = 26;
  const side: Shader = (u, v) => {
    const n = hash(Math.floor(u * 40), Math.floor(v * 6));
    let c = Math.floor(v * 4) % 2 ? GUILD_GREEN : GUILD_GREEN_DARK;
    if (n < 0.12) c = OAK_DARK;
    if (Math.abs(u - 0.02) < 0.02 || Math.abs(u - 0.98) < 0.02 || Math.abs(u - 0.5) < 0.015) c = OAK_DARK;
    // Painted letters: the guild's mark, a bar and three waves, flaking.
    if (u > 0.4 && u < 0.6 && v > 0.25 && v < 0.75) {
      const w = (v - 0.25) * 2;
      if (Math.abs(w - 0.2) < 0.06 || [0.45, 0.65, 0.85].some((k) => Math.abs(w - k - Math.sin(u * 60) * 0.04) < 0.05)) c = n < 0.3 ? c : 0xc8b070;
    }
    if (v > 0.8) c = mix(c, SLIME, 0.5);
    return c;
  };
  // Floor of the bed (seen, as it's tipped towards us).
  m.quad({ x: x0, y: yFar, z: zFar }, { x: x1 - x0, y: 0, z: 0 }, { x: 0, y: yNear - yFar, z: zNear - zFar }, (_, v) => (Math.floor(v * 7) % 2 ? OAK : OAK_DARK));
  // The far side board, now pointing up at the sky, and the near side board, under water to its rim.
  m.quad({ x: x0, y: yFar, z: zFar }, { x: x1 - x0, y: 0, z: 0 }, { x: 0, y: -0.25, z: 10 }, side);
  m.quad({ x: x0, y: yNear - 0.1, z: zNear + 2 }, { x: x1 - x0, y: 0, z: 0 }, { x: 0, y: 0.32, z: 4 }, side);
  // The tail board, hanging open.
  m.quad({ x: x1, y: yFar, z: zFar }, { x: 0, y: yNear - yFar, z: zNear - zFar }, { x: 0.3, y: 0.05, z: -6 }, (u, _) => (Math.floor(u * 6) % 2 ? GUILD_GREEN_DARK : GUILD_GREEN));
  // The tilt: hoops of ash bent over the bed, the canvas over them slashed to ribbons in places.
  const hoops = 5;
  const hoop = (t: number, a: number) => {
    // a: 0 at the far side, 1 at the near; the hoop rises off the tipped bed.
    const x = x0 + 0.12 + t * (x1 - x0 - 0.24);
    const y = yFar + (yNear - yFar) * a;
    const zBase = zFar + (zNear - zFar) * a;
    const up = Math.sin(a * Math.PI) * 26;
    // Tipped: "up" from the bed is up and towards the near side.
    return { x, y: y + up * 0.018, z: zBase + up * 0.85 + 6 };
  };
  const slashes = [0.18, 0.44, 0.71];
  for (let i = 0; i < 18; i++) {
    const a0 = i / 18;
    const a1 = (i + 1) / 18;
    const p0 = hoop(0, a0);
    const p1 = hoop(0, a1);
    m.quad(p0, { x: x1 - x0 - 0.24, y: 0, z: 0 }, { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z }, (u, _) => {
      // Hoop ribs.
      if (Array.from({ length: hoops }, (_, k) => k / (hoops - 1)).some((k) => Math.abs(u - k) < 0.012)) return OAK_DARK;
      // The slashes: long rents, the dark inside showing.
      for (const s of slashes) {
        const width = 0.03 + 0.02 * Math.sin(a0 * 9 + s * 20);
        if (Math.abs(u - s - (a0 - 0.5) * 0.08) < width && a0 > 0.15 && a0 < 0.9) return a0 > 0.5 ? null : 0x14100e;
      }
      const n = smoothNoise(u * 8, a0 * 6, 41);
      let c = n < 0.35 ? CANVAS_DARK : n > 0.7 ? CANVAS_LIGHT : CANVAS;
      if (a0 > 0.75) c = mix(c, PEAT, Math.min(0.75, (a0 - 0.75) * 3));
      return c;
    });
  }
  // The far wheels, up in the air (front and back), one with spokes broken; the near ones are under.
  wheel(m, { x: 0.35, y: yFar - 0.08, z: zFar + 22 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0.1, z: -26 });
  wheel(m, { x: 1.95, y: yFar - 0.08, z: zFar + 22 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0.1, z: -26 }, 1.2);
  // The axle and the broken pole, out of the water.
  m.box(0.6, yFar - 0.1, zFar - 8, 0.06, 0.06, 10, { top: OAK_DARK, left: OAK_DARK, right: OAK_DARK });
  m.quad({ x: -0.2, y: 1.0, z: 6 }, { x: 0.55, y: 0.1, z: 6 }, { x: 0, y: 0.06, z: 0 }, OAK_DARK);
  // Scarlet cloth, spilling out of a rent into the water in a long tongue.
  m.quad({ x: 1.2, y: yNear - 0.05, z: 6 }, { x: 0.55, y: 0.1, z: 0 }, { x: 0.1, y: 0.55, z: -6 }, (u, v) => {
    if (Math.abs(u - 0.5) > 0.5 - v * 0.2) return null;
    const fold = Math.sin(v * 20 + u * 6);
    return fold > 0.6 ? SCARLET_LIGHT : fold < -0.5 ? SCARLET_DARK : SCARLET;
  });
  // A bolt of it floating, unrolled.
  m.quad({ x: 2.2, y: yNear + 0.15, z: 0.6 }, { x: 0.6, y: 0.15, z: 0 }, { x: -0.05, y: 0.18, z: 0 }, (u, _) => (Math.sin(u * 18) > 0.3 ? SCARLET_LIGHT : SCARLET));
  // Where the water closes round it: a lip of scum, ripples.
  m.quad({ x: 0, y: yNear + 0.05, z: 0.4 }, { x: x1 + 0.1, y: 0, z: 0 }, { x: 0, y: 0.35, z: 0 }, (u, v) => {
    const n = hash(Math.floor(u * 50), Math.floor(v * 8));
    if (v < 0.25) return n < 0.5 ? 0x5a7032 : 0x3e5228;
    return n < 0.25 ? BOGWATER_LIGHT : null;
  });
  return m;
}

/**
 * A wagon burnt where it stood on the causeway: the bed fallen in, black ribs
 * of its frame standing up, the wheels charred and one gone, and a heap of
 * ash and burnt wool in it, still faintly smoking. 3 x 2 tiles.
 */
function burntWagon(): IsoModel {
  const m = IsoModel.turned(0.18, { x: 1.5, y: 1 });
  // The bed, sagged in the middle where it burnt through.
  m.quad({ x: 0.3, y: 0.45, z: 12 }, { x: 2.4, y: 0, z: 0 }, { x: 0, y: 1.1, z: 0 }, (u, v) => {
    const hole = Math.hypot((u - 0.55) * 2.2, (v - 0.5) * 2) < 0.45 + smoothNoise(u * 6, v * 6, 51) * 0.2;
    if (hole) return null;
    const n = hash(Math.floor(u * 30), Math.floor(v * 10));
    return n < 0.2 ? EMBER : Math.floor(v * 7) % 2 ? CHAR : CHAR_LIGHT;
  });
  // The heap fallen through, of ash and wool and char, under the hole.
  m.cylinder(1.6, 1.0, 0, 0.55, 8, (u, v) => {
    const n = hash(Math.floor(u * 30), Math.floor(v * 10));
    return n < 0.15 ? EMBER : n < 0.4 ? ASH : n < 0.55 ? WOOL_DARK : CHAR_LIGHT;
  }, (u, v) => {
    const n = hash(Math.floor(u * 20), Math.floor(v * 20));
    return n < 0.08 ? 0xd0602a : n < 0.4 ? ASH : n < 0.55 ? WOOL : 0x5a524a;
  });
  // The side boards, burnt away to stubs, and the ribs standing up.
  for (const y of [0.45, 1.55]) {
    m.quad({ x: 0.3, y, z: 12 }, { x: 2.4, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }, (u, v) => (v > 0.3 + 0.6 * smoothNoise(u * 7, y * 3, 61) ? null : v > 0.2 ? CHAR : CHAR_LIGHT));
    for (let i = 0; i < 5; i++) {
      const x = 0.4 + i * 0.55;
      const h = 14 + hash(i, y * 10) * 20;
      if (hash(i, y) < 0.25) continue;
      m.box(x, y - 0.03, 12, 0.06, 0.06, h, { top: EMBER, left: CHAR, right: 0x0e0a08 });
    }
  }
  // Wheels: three left, charred; one fallen flat.
  wheel(m, { x: 0.35, y: 1.58, z: 26 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0, z: -26 }, 0.8, true);
  wheel(m, { x: 1.95, y: 1.58, z: 26 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0, z: -26 }, 0, true);
  wheel(m, { x: 0.35, y: 0.42, z: 26 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0, z: -26 }, 0, true);
  wheel(m, { x: 2.3, y: 0.1, z: 0.5 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0.7, z: 0 }, 2, true);
  // Scorch round it on the logs.
  m.quad({ x: -0.1, y: 0.05, z: 0.3 }, { x: 3.2, y: 0, z: 0 }, { x: 0, y: 1.9, z: 0 }, (u, v) => {
    const d = Math.hypot((u - 0.5) * 2, (v - 0.5) * 2) + (smoothNoise(u * 5, v * 5, 71) - 0.5) * 0.6;
    if (d > 1) return null;
    return hash(Math.floor(u * 60), Math.floor(v * 40)) < 0.5 - d * 0.4 ? 0x14100c : null;
  });
  return m;
}

/** A handcart on its back, wheels in the air, one gone, its sacks of salt split and not one taken. 2 x 2 tiles. */
function overturnedCart(): IsoModel {
  const m = IsoModel.turned(0.6, { x: 1, y: 1 });
  // The bed, upside down: its underside, with the axle across it.
  m.box(0.3, 0.4, 0, 1.4, 1.0, 9, {
    top: (u, _) => (Math.floor(u * 6) % 2 ? OAK_DARK : OAK),
    left: (u) => (Math.floor(u * 12) % 3 === 0 ? OAK_DARK : GUILD_GREEN),
    right: GUILD_GREEN_DARK,
  });
  m.box(0.4, 0.86, 9, 1.2, 0.08, 4, { top: OAK_DARK, left: OAK_DARK, right: OAK_DARK });
  // One wheel left, sticking up into the air at the end of its axle; the other's gone.
  wheel(m, { x: 1.6, y: 0.62, z: 37 }, { x: 0, y: 0.55, z: 0 }, { x: 0, y: 0, z: -26 }, 0);
  m.box(0.36, 0.86, 11, 0.06, 0.08, 3, { top: IRON_LIGHT, left: IRON, right: IRON });
  // The shafts sticking up and out.
  m.box(1.62, 0.55, 8, 0.6, 0.05, 2, { top: OAK, left: OAK_DARK, right: OAK_DARK });
  m.box(1.62, 1.2, 8, 0.6, 0.05, 2, { top: OAK, left: OAK_DARK, right: OAK_DARK });
  // Salt sacks, slit, the salt spilled white on the logs.
  for (const [x, y] of [[0.2, 1.55], [0.6, 1.7], [1.5, 1.6]]) {
    m.cylinder(x, y, 0, 0.18, 6, (u) => (u < 0.3 ? SACKING : u > 0.7 ? SACKING_DARK : 0x8a7a5a), (u, _) => (Math.abs(u - 0.5) < 0.08 ? SALT : SACKING));
  }
  m.quad({ x: 0.05, y: 1.4, z: 0.4 }, { x: 1.7, y: 0, z: 0 }, { x: 0, y: 0.55, z: 0 }, (u, v) => (smoothNoise(u * 6, v * 4, 81) > 0.55 ? SALT : null));
  return m;
}

/** Casks stove in, their staves sprung, eels spilled out of one and left to rot. */
function stoveCasks(): IsoModel {
  const m = new IsoModel();
  // A cask on its side, staved in.
  m.quad({ x: 0.15, y: 0.3, z: 10 }, { x: 0.6, y: 0, z: 0 }, { x: 0, y: 0.4, z: -10 }, (u, v) => (Math.abs(u - 0.2) < 0.03 || Math.abs(u - 0.8) < 0.03 ? IRON : Math.floor(v * 8) % 2 ? OAK : OAK_DARK));
  m.quad({ x: 0.15, y: 0.7, z: 0 }, { x: 0.6, y: 0, z: 0 }, { x: 0, y: 0, z: 10 }, (u, v) => (u > 0.35 && u < 0.6 && v > 0.3 ? 0x140e0c : Math.abs(u - 0.2) < 0.03 || Math.abs(u - 0.8) < 0.03 ? IRON : Math.floor(u * 10) % 2 ? OAK : OAK_LIGHT));
  // One upright, its head smashed in.
  m.cylinder(0.72, 0.68, 0, 0.18, 12, (u) => (u < 0.3 ? OAK_LIGHT : u > 0.7 ? OAK_DARK : OAK), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0x140e0c : OAK_DARK));
  // Sprung staves, and eels on the logs.
  for (let i = 0; i < 4; i++) m.box(0.1 + hash(i, 1) * 0.6, 0.75 + hash(i, 2) * 0.2, 0, 0.3, 0.04, 1.2, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  for (let i = 0; i < 4; i++) m.quad({ x: 0.2 + i * 0.12, y: 0.85, z: 0.6 }, { x: 0.1, y: 0.14, z: 0 }, { x: 0.03, y: 0, z: 0 }, (u) => (u < 0.2 ? 0x4a4a3a : 0x2e3026));
  return m;
}

/** The bones of a draught ox, picked clean by the crows: the long skull, the ribs like a basket, the yoke still across its neck. 2 x 1. */
function oxBones(): IsoModel {
  const m = new IsoModel();
  // Ribs, arching.
  for (let i = 0; i < 8; i++) {
    const x = 0.5 + i * 0.1;
    for (let k = 0; k < 6; k++) {
      const a = (k / 5) * Math.PI;
      m.box(x, 0.5 - Math.cos(a) * 0.28, Math.sin(a) * 9, 0.03, 0.06, 1.5, { top: BONE, left: BONE_DARK, right: BONE_DARK });
    }
  }
  // The spine, and the skull with its horns.
  m.box(0.45, 0.48, 8, 0.9, 0.05, 2, { top: BONE, left: BONE_DARK, right: BONE_DARK });
  m.box(1.4, 0.42, 1, 0.42, 0.16, 5, { top: BONE, left: (u) => (u > 0.2 && u < 0.32 ? 0x1a1410 : BONE), right: BONE_DARK });
  m.box(1.5, 0.3, 5, 0.04, 0.4, 2, { top: 0xc8c0a0, left: BONE_DARK, right: BONE_DARK });
  // The yoke: a black beam with a bow of withy.
  m.box(1.3, 0.1, 6, 0.08, 0.8, 4, { top: OAK, left: OAK_DARK, right: OAK_DARK });
  m.box(0.3, 0.4, 0.2, 0.15, 0.2, 2, { top: BONE, left: BONE_DARK, right: BONE_DARK });
  return m;
}

/** Garrow's lantern pole, fallen across the logs, the lantern smashed at the end of it. 2 x 1. */
function fallenLantern(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.45, 0, 1.6, 0.07, 3, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.box(1.7, 0.36, 0, 0.18, 0.2, 8, { top: IRON, left: (u, v) => (hash(Math.floor(u * 6), Math.floor(v * 6)) < 0.4 ? 0x0c0a0a : 0x5a5248), right: IRON });
  for (let i = 0; i < 6; i++) m.box(1.5 + hash(i, 3) * 0.4, 0.2 + hash(i, 4) * 0.6, 0, 0.03, 0.03, 0.6, { top: 0xb8c4c0, left: 0x8a9490, right: 0x6a7470 });
  return m;
}

/** A bale of Tunstall's scarlet, slashed open, the cloth pulled out and trodden into the mud. */
function slashedBale(seed: number): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(seed);
  m.box(0.2, 0.25, 0, 0.55, 0.45, 10, {
    top: (u, v) => (Math.abs(u - 0.5 - (v - 0.5) * 0.4) < 0.06 ? 0x2a0c0c : SACKING),
    left: (u, v) => (Math.abs(v - 0.5) < 0.05 ? 0x5a3e22 : Math.abs(u - 0.45) < 0.05 && v > 0.2 ? SCARLET : SACKING),
    right: SACKING_DARK,
  });
  // The cloth, pulled out in a long torn tongue across the ground.
  const len = 0.5 + rnd() * 0.3;
  m.quad({ x: 0.45, y: 0.7, z: 0.5 }, { x: 0.2, y: len, z: 0 }, { x: 0.25, y: -0.05, z: 0 }, (u, v) => {
    if (hash(Math.floor(u * 12), Math.floor(v * 12) + seed) < 0.12) return null;
    const muddy = smoothNoise(u * 4, v * 4, seed) > 0.6;
    const fold = Math.sin(u * 30 + v * 4);
    const c = fold > 0.5 ? SCARLET_LIGHT : fold < -0.5 ? SCARLET_DARK : SCARLET;
    return muddy ? mix(c, PEAT, 0.6) : c;
  });
  return m;
}

/** Marrable's wool, burnt in a heap, black outside and still white at the heart where the fire didn't reach. */
function burntWool(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.5, 0.5, 0, 0.36, 7, (u, v) => {
    const n = hash(Math.floor(u * 24), Math.floor(v * 8));
    return n < 0.5 ? CHAR : n < 0.7 ? CHAR_LIGHT : n < 0.85 ? WOOL_DARK : EMBER;
  }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    const n = hash(Math.floor(u * 20), Math.floor(v * 20));
    return d < 0.2 ? (n < 0.5 ? WOOL : WOOL_DARK) : n < 0.4 ? ASH : CHAR_LIGHT;
  });
  return m;
}

/**
 * Tracks in the peat: the prints of something that walks on three long toes
 * and a spur behind, with the drag of a heavy tail between them, filled with
 * water, going one way: off the causeway and down into the mere. `n` picks how many
 * and how they lie.
 */
function tracks(n: number): RenderedModel {
  return flat((u, v) => {
    // Two lines of prints running down the tile along +x (the walker's way), and the tail's drag between.
    const step = 0.33;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const cu = 0.15 + k * step + (side > 0 ? step / 2 : 0) + n * 0.03;
        const cv = 0.5 + side * 0.14 + Math.sin(k + n) * 0.03;
        const du = u - cu;
        const dv = v - cv;
        // Three toes, splayed forward (+u), and a spur back.
        const toe = [-0.5, 0, 0.5].some((a) => {
          const tx = Math.cos(a) * 0.09;
          const ty = Math.sin(a) * 0.09;
          const t = (du * tx + dv * ty) / (0.09 * 0.09);
          if (t < 0 || t > 1) return false;
          return Math.hypot(du - tx * t, dv - ty * t) < 0.016;
        });
        const heel = Math.hypot(du, dv) < 0.03;
        const spur = du < 0 && du > -0.06 && Math.abs(dv) < 0.01;
        if (toe || heel || spur) return Math.hypot(du, dv) < 0.05 ? PRINT_WATER : PRINT;
      }
    }
    // The tail's drag: a shallow sinuous groove.
    if (Math.abs(v - 0.5 - Math.sin(u * 9 + n) * 0.04) < 0.022) return hash(Math.floor(u * 40), n) < 0.3 ? PRINT_WATER : 0x1e1814;
    return null;
  });
}

/** A great scale lying in the mud: as big as a palm, white as a drowned thing, with a sheen like pearl on it. */
function whiteScale(): RenderedModel {
  return flat((u, v) => {
    const du = (u - 0.55) * 2.8;
    const dv = (v - 0.45) * 3.6;
    const d = du * du + dv * dv;
    if (d > 1) return null;
    if (d > 0.82) return 0x7a8478;
    // Ridged growth lines, a pearly sheen.
    const ring = Math.floor(Math.sqrt(d) * 5) % 2;
    if (du + dv < -0.4 && d > 0.2) return 0xfafcf0;
    return ring ? SCALE_WHITE : SCALE_SHADE;
  });
}

// ---------------------------------------------------------------- registering

/** Registers a standing canvas whose foot is at (fx, fy) in the picture, standing on the middle of its tile. */
function onTile(scene: Phaser.Scene, key: string, c: PixelCanvas, fx: number, fy: number): void {
  c.toTexture(scene, key);
  // The middle of the tile is 16 pixels below its back corner.
  MODEL_ART[key] = { key, originX: fx / c.width, originY: (fy - 16) / c.height };
}

/** Bog oak art, for a preview page (tools/) to look at without the game. */
export function paintOak(key: string): PixelCanvas {
  return bogOak(OAKS[key]).canvas;
}

export function generateFenRoad(scene: Phaser.Scene): void {
  const put = (key: string, m: IsoModel, outline = true) => registerModel(scene, key, m.render(outline));
  for (const [key, shape] of Object.entries(OAKS)) {
    const { canvas, foot } = bogOak(shape);
    onTile(scene, key, canvas, foot.x, foot.y);
  }
  for (let i = 0; i < 3; i++) onTile(scene, `fr-bulrush-${i}`, bulrushes(1701 + i * 13), 28, 86);
  for (let i = 0; i < 2; i++) onTile(scene, `fr-cotton-${i}`, bogCotton(1801 + i * 17), 20, 32);
  for (let i = 0; i < 4; i++) registerModel(scene, `fr-logs-${i}`, corduroy(1901 + i * 7, 0.08 + (i % 2) * 0.12));
  for (let i = 0; i < 3; i++) registerModel(scene, `fr-logs-worn-${i}`, corduroy(1951 + i * 7, 0.7 + i * 0.1));
  for (let i = 0; i < 2; i++) registerModel(scene, `fr-sunk-${i}`, sunkPatch(2001 + i * 7));
  for (let i = 0; i < 2; i++) registerModel(scene, `fr-mire-${i}`, mire(2051 + i * 7));
  put('fr-lamp', causewayLamp(false, 0.25));
  put('fr-lamp-lit', causewayLamp(true, -0.15));
  put('fr-lamp-leaning', causewayLamp(false, 0.9));
  put('fr-waystone', waystone());
  put('fr-reedhut', reedHut());
  put('fr-skullstake', skullStake());
  put('fr-shrine', shrine());
  registerModel(scene, 'fr-bogbody', bogBody());
  put('fr-reedstack', reedStack());
  put('fr-eeltraps', eelTraps());
  put('fr-wagon-sunk', sunkWagon());
  put('fr-wagon-burnt', burntWagon());
  put('fr-cart-over', overturnedCart());
  put('fr-casks', stoveCasks());
  put('fr-oxbones', oxBones());
  put('fr-lantern-fallen', fallenLantern());
  for (let i = 0; i < 3; i++) put(`fr-bale-${i}`, slashedBale(2101 + i * 11));
  put('fr-burntwool', burntWool());
  for (let i = 0; i < 3; i++) registerModel(scene, `fr-tracks-${i}`, tracks(i));
  registerModel(scene, 'fr-scale', whiteScale());
  for (const [id, model] of Object.entries(FEN_FOLK)) generateFigure3D(scene, `folk-${id}`, model, FINE_SPEC);
  paintPortrait(scene, 'gammer', gammerPortrait);
}

// ---------------------------------------------------------------------------
// Gammer Teal, the reed-cutter, and the thing in the mere
// ---------------------------------------------------------------------------

const REED: Tones = [0xb8a468, 0x8a7a48, 0xd4c288];

/**
 * Gammer Teal: small and bent, brown as a bog oak, in a patched fen-green dress
 * kirtled up over her boots, a rust shawl, a faded red kerchief over white hair,
 * her eel-pole in her hand, a sheaf of cut reed on her back and a clay pipe in her
 * teeth. One eye is milky.
 */
const GAMMER: TownLook = {
  skin: [0xb88868, 0x8a6048, 0xd0a284],
  hair: [0xd8d4c8, 0xa8a498, 0xf0ece0],
  hairStyle: 'knot',
  garment: 'dress',
  cloth: [0x4a5a3a, 0x323e26, 0x627450],
  seam: [0x323e26, 0x222a1a, 0x4a5a3a],
  under: [0xc0b49a, 0x928872, 0xd8ccb2],
  legs: [0x3a3a2e, 0x26261e, 0x4e4e40],
  boots: [0x2e2820, 0x1e1a14, 0x463c30],
  shawl: [0x8a4a2a, 0x5e321c, 0xa8603a],
  apron: [0x7a6a4e, 0x544834, 0x968464],
  patches: [0x6a5a3a, 0x4a3e26, 0x86744e],
  hat: 'kerchief',
  hatTones: [0x9a3a2e, 0x6a261e, 0xb8524a],
  hands: 'pole',
  hunch: 1.2,
  girth: 0.9,
  iris: 0x6a7a5a,
  brow: 0xc8c4b8,
  browSlant: -0.1,
  mouth: 0x7a4a40,
  smile: true,
  extras: (hy, hz, b, sit) => {
    const solids: Solid[] = [];
    const details: Detail[] = [];
    // The milky eye (her right, the viewer's left).
    details.push({ x: -1.9, y: hy + 0.7, z: hz + 4.9, color: 0xd8dcd4, size: 0.9 });
    // A clay pipe from the corner of her mouth.
    solids.push(...limb([1.4, hy - 2.6, hz + 4.6], [3, hy - 3.4, hz + 7], 0.3, 0.3, [0xd8ccb4, 0xa89c86, 0xf0e4cc], 0.3));
    solids.push({ cx: 3.2, cy: hy - 2.8, cz: hz + 7.3, rx: 0.8, ry: 1, rz: 0.8, material: [0xc8bca4, 0x9a8e78, 0xe0d4bc] });
    details.push({ x: 3.2, y: hy - 1.8, z: hz + 7.3, color: 0xe86a3a, size: 0.6 });
    if (!sit) {
      // A sheaf of cut reed on her back, tied with a cord, its heads nodding over her shoulder.
      for (let i = 0; i < 9; i++) {
        const x = -3 + i * 0.75;
        const top: [number, number, number] = [x + 1.6 + Math.sin(i * 2.1) * 0.8, 33 - b + (i % 3) * 1.4, -6.4 - Math.cos(i) * 0.8];
        solids.push(...limb([x, 12 - b, -5.6], top, 0.45, 0.35, i % 3 === 1 ? shade(REED) : REED, 0.6));
        solids.push({ cx: top[0], cy: top[1] + 1, cz: top[2], rx: 0.7, ry: 1.6, rz: 0.7, material: [0x6a4a2a, 0x4a321c, 0x86603a] });
      }
      solids.push({ cx: 0, cy: 21 - b, cz: -5.8, rx: 3.8, ry: 0.6, rz: 1.4, material: [0x4a3a28, 0x32261a, 0x5e4a34] });
    }
    return { solids, details };
  },
};

/** A scale's colour: grey-green on the back, a dull yellow on the belly, mottled, with a sheen where it's wet. */
const SCALE_BACK: Tones = [0x4e5a44, 0x343e2e, 0x6a7a5a];
const SCALE_DARK: Tones = [0x3a4434, 0x262e22, 0x505c46];
const BELLY: Tones = [0x9a9668, 0x6e6c4a, 0xb8b484];
const WET: Tones = [0x7a8a6e, 0x56624c, 0xa0b090];
const CLAW: Tones = [0x2a241e, 0x1a1612, 0x463c30];
const SPEAR: Tones = [0x5a4a36, 0x3e3224, 0x766246];
const BONE_TIP: Tones = [0xd8d0b8, 0xa8a08a, 0xf0e8d0];

function scales(h: Hit): Tones {
  if (h.nz > 0.55 && Math.abs(h.x) < 2.6) return (Math.floor(h.y * 1.4) & 1) === 0 ? BELLY : shade(BELLY);
  const u = Math.floor(h.x * 1.1 + (Math.floor(h.y * 1.1) & 1) * 0.5);
  const v = Math.floor(h.y * 1.1);
  const n = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453;
  const r = n - Math.floor(n);
  if (r > 0.86) return WET;
  if (r < 0.22 || dusted(h, 0.1)) return SCALE_DARK;
  return SCALE_BACK;
}

/**
 * One of the Mere-kin, as the hero sees it from the causeway: taller than a
 * man, stooped, on long bent legs with three-toed feet, a heavy tail to the
 * ground behind; scaled grey-green with a yellow belly; a long flat head with a
 * ridge of spines down to the shoulders and small gold eyes; a bone-tipped
 * fishing spear in one hand and a twist of reed cord about its middle.
 */
function lizardman(pose: Pose3D): Model {
  const b = pose.bob;
  const s = pose.stride;
  const solids: Solid[] = [];
  const details: Detail[] = [];
  const lean = 3.2;

  // ---- Legs: thigh forward, shin back, a long foot on its toes.
  for (const side of [-1, 1]) {
    const swing = s * side;
    const lift = swing < 0 ? 1.2 : 0;
    const hip: [number, number, number] = [side * 2.8, 15 - b * 0.5, 0];
    const knee: [number, number, number] = [side * 3.2, 9.4 + lift, 3 + swing * 2];
    const ankle: [number, number, number] = [side * 3, 3.6 + lift, -1.4 + swing * 2.4];
    solids.push(...limb(hip, knee, 2.6, 1.9, scales));
    solids.push(...limb(knee, ankle, 1.8, 1.2, scales));
    // Three long toes, splayed, with black claws.
    for (const t of [-1, 0, 1]) {
      const toe: [number, number, number] = [ankle[0] + t * 1.3, 0.6 + lift, ankle[2] + 3.6 - Math.abs(t) * 0.6];
      solids.push(...limb([ankle[0], 1.4 + lift, ankle[2]], toe, 0.9, 0.6, scales, 0.4));
      solids.push({ cx: toe[0] + t * 0.2, cy: toe[1], cz: toe[2] + 0.7, rx: 0.4, ry: 0.4, rz: 0.8, material: CLAW });
    }
    // The spur at the back of the foot.
    solids.push({ cx: ankle[0], cy: 1 + lift, cz: ankle[2] - 1.4, rx: 0.5, ry: 0.5, rz: 0.9, material: CLAW });
  }

  // ---- The tail: thick at the hips, down to the ground behind, curling.
  const sway = Math.sin(b * 2 + s) * 1.2;
  let prev: [number, number, number] = [0, 13.6 - b * 0.5, -2.6];
  for (let i = 1; i <= 14; i++) {
    const t = i / 14;
    const next: [number, number, number] = [Math.sin(t * 2.2) * (2.4 + sway) , 13.6 - t * 12.4 - b * 0.5 * (1 - t), -2.6 - t * 13];
    solids.push(...limb(prev, next, 2.8 - (i - 1) * 0.18, 2.8 - i * 0.18, scales, 0.5));
    prev = next;
  }

  // ---- The body: a narrow waist, a deep chest, hunched.
  const by = (y: number) => y - b;
  solids.push({ cx: 0, cy: by(15.6), cz: 0.4, rx: 4.4, ry: 3, rz: 3.6, material: scales });
  solids.push({ cx: 0, cy: by(19.6), cz: lean * 0.5, rx: 4.2, ry: 3.4, rz: 3.4, material: scales });
  solids.push({ cx: 0, cy: by(24), cz: lean, rx: 5.6, ry: 4.4, rz: 4.4, material: scales });
  // A twist of reed cord round the middle, a pouch hanging from it.
  solids.push({ cx: 0, cy: by(16.6), cz: 0.5, rx: 4.6, ry: 0.55, rz: 3.8, material: REED });
  solids.push({ cx: 3.4, cy: by(14.4), cz: 2.4, rx: 1.4, ry: 1.8, rz: 1, material: [0x5a4a30, 0x3e3220, 0x766246] });
  // Spines down the back, from the crown to the tail's root.
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    solids.push({ cx: 0, cy: by(30 - t * 15), cz: lean - 4.4 - t * 0.2 + (1 - t) * 1.4, rx: 0.4, ry: 1.2 - t * 0.5, rz: 1.4 - t * 0.5, material: i % 2 ? SCALE_DARK : [0x8a4a3a, 0x5e3228, 0xa8604e] });
  }

  // ---- Arms: long, the hands three-fingered with claws; the right holds the spear upright.
  for (const side of [-1, 1]) {
    const shoulder: [number, number, number] = [side * 5.4, by(26), lean];
    const elbow: [number, number, number] = side === 1 ? [side * 7, by(21.4), lean + 2.6] : [side * 6.8, by(20), lean - 0.4 - s * side];
    const hand: [number, number, number] = side === 1 ? [side * 6.4, by(23.6), lean + 5.4] : [side * 6.4, by(14), lean + 1.4 - s * side * 1.6];
    solids.push({ cx: shoulder[0], cy: shoulder[1], cz: shoulder[2], rx: 2.4, ry: 2.4, rz: 2.4, material: scales });
    solids.push(...limb(shoulder, elbow, 1.7, 1.4, scales));
    solids.push(...limb(elbow, hand, 1.4, 1.1, scales));
    for (const f of [-1, 0, 1]) {
      solids.push({ cx: hand[0] + f * 0.6, cy: hand[1] - 1.3, cz: hand[2] + 0.6, rx: 0.4, ry: 0.9, rz: 0.4, material: CLAW });
    }
  }
  // The spear: a black pole, a binding of cord, a long point of sharpened bone.
  const sp0: [number, number, number] = [6.4, 0.4, lean + 6];
  const sp1: [number, number, number] = [6.4, by(36), lean + 5];
  solids.push(...limb(sp0, sp1, 0.55, 0.5, SPEAR, 0.45));
  solids.push(...limb([6.4, by(35.6), lean + 5], [6.4, by(37.2), lean + 5], 0.75, 0.75, REED, 0.3));
  solids.push(...limb([6.4, by(37.2), lean + 5], [6.4, by(41.6), lean + 4.9], 0.9, 0.15, BONE_TIP, 0.3));

  // ---- The head: low and forward, flat on top, a long snout; a frill of skin at the jaw.
  const hy = by(29.2);
  const hz = lean + 2.4;
  solids.push(...limb([0, by(27), lean + 0.6], [0, hy, hz], 2.6, 2.3, scales));
  const head = (h: Hit): Tones => (h.y < hy - 1 && h.nz > -0.2 ? BELLY : scales(h));
  solids.push({ cx: 0, cy: hy + 0.4, cz: hz + 0.4, rx: 3.6, ry: 3, rz: 3.8, material: head });
  solids.push({ cx: 0, cy: hy - 0.2, cz: hz + 4.4, rx: 2.4, ry: 1.9, rz: 3.4, material: head });
  solids.push({ cx: 0, cy: hy - 0.4, cz: hz + 7.2, rx: 1.8, ry: 1.4, rz: 1.8, material: head });
  // Brow ridges over the eyes, and the frill.
  for (const side of [-1, 1]) {
    solids.push({ cx: side * 2.2, cy: hy + 2.4, cz: hz + 2.6, rx: 1.4, ry: 0.7, rz: 1.6, material: SCALE_DARK });
    solids.push({ cx: side * 3.4, cy: hy - 1.2, cz: hz - 1.4, rx: 0.6, ry: 2.4, rz: 2.4, material: (h) => (Math.floor(h.y * 2) & 1 ? [0x8a4a3a, 0x5e3228, 0xa8604e] : SCALE_DARK) });
    // The eye: small, gold, a black slit.
    details.push({ x: side * 2.6, y: hy + 1.4, z: hz + 3.4, color: 0xd8a82a, size: 1 });
    details.push({ x: side * 2.7, y: hy + 1.4, z: hz + 3.7, color: 0x101010, size: 0.4 });
    // The nostril.
    details.push({ x: side * 0.7, y: hy + 0.4, z: hz + 8.8, color: 0x1a1a14, size: 0.45 });
  }
  // The line of the mouth, with a tooth or two showing.
  for (let i = 0; i < 8; i++) {
    const z = hz + 1.6 + i * 0.9;
    for (const side of [-1, 1]) details.push({ x: side * (2.5 - i * 0.12), y: hy - 1.2, z, color: i % 3 === 2 ? 0xe8e0c8 : 0x1e1a14, size: 0.5 });
  }
  return { solids, details };
}

/** The folk of the Fen Road, by folk id, drawn finely as 'folk-<id>'. */
export const FEN_FOLK: Record<string, (pose: Pose3D) => Model> = {
  gammer: (pose) => sized(townModel(pose, GAMMER), 0.9, 1),
  lizardman: (pose) => sized(lizardman(pose), 1.1),
};

/** Gammer Teal's portrait: brown and deep-lined, a red kerchief over white hair, a milky eye, a clay pipe, her rust shawl. */
const gammerPortrait = townsfolk({
  skin: 0xb88868, hair: 0xe0dcd0, style: 'bun', cloth: 0x4a5a3a, shirt: 0xc0b49a,
  iris: 0x6a7a5a, brow: 'worried', smile: 1, width: 15.5, jaw: 6, old: true, nose: 2, look: -1, kerchief: 0x9a3a2e,
  over: (c, f) => {
    // The milky eye, the viewer's left.
    if (!f.blink) {
      const milk = ramp(0xd0d4cc);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) < 3) c.set(CX - EYE_DX + dx, EYE_Y + dy, tone(milk, lightness(dx / 3, dy / 3), CX + dx, EYE_Y + dy));
    }
    // The clay pipe, from the corner of the mouth.
    for (let i = 0; i < 11; i++) {
      const x = CX + 6 + i;
      const y = 69 + Math.round(i * 0.25);
      c.set(x, y, 0xd8ccb4);
      c.set(x, y + 1, 0xa89c86);
    }
    for (let dy = -4; dy <= 1; dy++) for (let dx = 0; dx < 4; dx++) c.set(CX + 16 + dx, 72 + dy, dx === 0 || dy === -4 ? 0xa89c86 : 0xc8bca4);
    c.set(CX + 17, 67, 0xe86a3a);
    c.set(CX + 18, 67, 0xf0a04a);
    // The rust shawl over her shoulders.
    const shawl = ramp(0x8a4a2a);
    for (let y = 77; y < 96; y++) {
      for (const side of [-1, 1]) {
        const x0 = CX + side * (24 - (y - 77) * 0.8);
        for (let x = Math.round(x0 - 7); x <= Math.round(x0 + 7); x++) c.set(x, y, tone(shawl, lightness(side * 0.3, (y - 86) / 12) + ((x * 3 + y) % 5 === 0 ? -0.14 : 0), x, y));
      }
    }
    // A wisp of smoke.
    for (let i = 0; i < 6; i++) c.set(CX + 18 + Math.round(Math.sin(i * 1.3) * 1.5), 64 - i * 2, mix(0xb8b4ac, 0x6a6a64, i / 6));
  },
});
