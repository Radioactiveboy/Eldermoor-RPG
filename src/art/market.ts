import Phaser from 'phaser';
import { IsoModel, lipped, planks, Shader } from './IsoModel';
import { MODEL_ART } from './interior';
import { PALETTE as P } from './palette';

/**
 * The market at Eldermoor: striped market stalls, timber-framed townhouses
 * around the square, the well, lamp posts, benches, crates and the signpost
 * at the end of the road. Built with IsoModel like the cottage, and registered
 * in MODEL_ART so maps can place them as objects.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function darken(c: number, f = 0.75): number {
  const ch = (shift: number) => Math.round(((c >> shift) & 0xff) * f) << shift;
  return ch(16) | ch(8) | ch(0);
}

/** How a stall is dressed: its awning colours and what's laid out on the counter. */
export type StallKind = 'baker' | 'smith' | 'tanner';

/** Awning stripes, and the cloth over the counter. */
const AWNINGS: Record<StallKind, [number, number, number]> = {
  baker: [0xc8434a, 0xeee8dc, 0xeee8dc],
  smith: [0x2e4a7a, 0xd9b45a, 0x4a4450],
  tanner: [0x4e6a3a, 0xd8c8a4, 0xb09e7c],
};

/**
 * A market stall on a 2x2 footprint facing +y: a plank counter across the
 * front row with goods on top, four posts, and a striped awning high enough
 * that the stallholder (standing in the back row) is seen beneath it.
 * Closed for the night, the goods are gone and a sheet is roped over the counter.
 */
function stall(kind: StallKind, closed = false): IsoModel {
  const m = new IsoModel();
  const [stripe, stripe2, cloth] = AWNINGS[kind];
  const post = { top: P.barkLight, left: P.bark, right: P.barkDark };
  const counterTop = 24;
  // Back posts first, so the counter and goods are painted over them.
  m.box(0.08, 0.08, 0, 0.1, 0.1, 86, post);
  m.box(1.82, 0.08, 0, 0.1, 0.1, 86, post);
  // A crate or two behind the counter, for stock.
  m.box(0.3, 0.25, 0, 0.45, 0.4, 16, { top: P.plankLight, left: planks(2, P.plank, P.plankDark, P.plankLight, 4), right: P.plankDark });
  // The counter: a plank front with a cloth draped over the top.
  const front = planks(3, P.plank, P.plankDark, P.plankLight, 2);
  m.box(0.05, 1.0, 0, 1.9, 0.62, counterTop, {
    top: lipped(cloth, lighten(cloth), 0.1),
    left: (u, v) => (v < 0.22 ? (Math.floor(u * 16) % 2 ? stripe : cloth) : front(u, v)),
    right: P.plankDark,
  });
  if (closed) coverUp(m, counterTop);
  else goods(m, kind, counterTop);
  // Front posts, then the sloping awning on top of everything.
  m.box(0.08, 1.52, 0, 0.1, 0.1, 74, post);
  m.box(1.82, 1.52, 0, 0.1, 0.1, 74, post);
  const awning: Shader = (u, v) => {
    const band = Math.floor(u * 10) % 2 === 0;
    const base = band ? stripe : stripe2;
    return v > 0.92 ? darken(base) : v < 0.06 ? darken(base, 0.85) : base;
  };
  m.quad({ x: -0.06, y: -0.05, z: 90 }, { x: 2.12, y: 0, z: 0 }, { x: 0, y: 1.72, z: -16 }, awning);
  // A scalloped valance hanging from the front edge.
  m.quad({ x: -0.06, y: 1.67, z: 74 }, { x: 2.12, y: 0, z: 0 }, { x: 0, y: 0, z: -9 }, (u, v) => {
    const scallop = 0.55 + 0.45 * Math.abs(Math.sin(u * Math.PI * 10));
    if (v > scallop) return null;
    return Math.floor(u * 10) % 2 === 0 ? darken(stripe, 0.9) : darken(stripe2, 0.9);
  });
  return m;
}

/** A sackcloth sheet over the bare counter, tied down with rope, for the night. */
function coverUp(m: IsoModel, z: number): void {
  const sack = 0xb8a47c;
  const rope = (u: number) => Math.abs(u - 0.22) < 0.02 || Math.abs(u - 0.78) < 0.02;
  m.box(0.1, 1.03, z, 1.8, 0.56, 7, {
    top: (u, v) => (rope(u) ? P.strawDark : hash(Math.floor(u * 40), Math.floor(v * 12)) < 0.15 ? darken(sack, 0.9) : sack),
    left: (u) => (rope(u) ? P.strawDark : darken(sack, 0.85)),
    right: darken(sack, 0.7),
  });
}

/** What each trader sets out on the counter. */
function goods(m: IsoModel, kind: StallKind, z: number): void {
  if (kind === 'baker') {
    // Loaves in a basket, a round cheese and a pie.
    m.box(0.2, 1.08, z, 0.7, 0.42, 6, { top: P.strawDark, left: P.straw, right: P.strawDark });
    for (const [x, y] of [[0.35, 1.2], [0.6, 1.25], [0.45, 1.38], [0.75, 1.4]]) {
      m.cylinder(x, y, z + 5, 0.12, 4, (u) => (u < 0.4 ? 0xd09048 : 0xa8642e), 0xd09048);
    }
    m.cylinder(1.25, 1.3, z, 0.2, 7, (u) => (u < 0.5 ? 0xf2d27a : 0xc89a30), 0xfbe6a0);
    m.cylinder(1.65, 1.3, z, 0.18, 5, (u) => (u < 0.4 ? 0xd09048 : 0x7a4420), 0xe8b060);
  } else if (kind === 'smith') {
    // Blades laid out on a cloth, a helm, and a shield leaning on the counter.
    m.quad({ x: 0.15, y: 1.08, z: z + 0.5 }, { x: 0.9, y: 0, z: 0 }, { x: 0, y: 0.45, z: 0 }, 0x3a3032);
    for (const x of [0.25, 0.48, 0.71]) {
      m.box(x, 1.12, z + 1, 0.06, 0.32, 1, { top: P.ironLight, left: P.iron, right: P.iron });
      m.box(x - 0.03, 1.4, z + 1, 0.12, 0.03, 2, { top: P.gold, left: P.gold, right: P.gold });
    }
    m.cylinder(1.35, 1.3, z, 0.17, 8, (u) => (u < 0.35 ? P.ironLight : P.iron), P.stoneLight);
    m.cylinder(1.35, 1.3, z, 0.24, 1, () => P.iron, P.ironLight);
    // A round shield propped against the front of the counter.
    m.quad({ x: 1.45, y: 1.66, z: 20 }, { x: 0.36, y: 0, z: 0 }, { x: 0, y: 0, z: -18 }, (u, v) => {
      const d = (u - 0.5) ** 2 + (v - 0.5) ** 2;
      if (d > 0.25) return null;
      if (d > 0.18) return P.iron;
      if (d < 0.02) return P.ironLight;
      return Math.floor(v * 5) % 2 ? P.plank : P.plankLight;
    });
  } else {
    // Folded hides in a pile, and a grey pelt draped over the end.
    const hides = [0x8f5c38, 0x6e4228, 0xa07a54];
    hides.forEach((c, i) => m.box(0.2 + i * 0.05, 1.1 + i * 0.03, z + i * 3, 0.65, 0.38, 3, { top: c, left: darken(c), right: darken(c, 0.6) }));
    m.box(1.1, 1.05, z, 0.7, 0.5, 2, { top: 0x7a7480, left: 0x4b4652, right: 0x4b4652 });
    m.quad({ x: 1.1, y: 1.62, z }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0, z: -12 }, (u, v) => (v > 0.7 + 0.3 * Math.sin(u * 9) ? null : u < 0.3 ? 0xa29ca6 : 0x7a7480));
    m.box(1.3, 1.15, z + 2, 0.25, 0.2, 6, { top: P.leatherLight, left: P.leather, right: P.leatherDark });
  }
}

/** Mixes two colours, t = 0 gives a, t = 1 gives b. */
function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - t) + ((b >> shift) & 0xff) * t) << shift;
  return ch(16) | ch(8) | ch(0);
}

/** Fieldstone greys, some cool and some warm, so no two stones quite match. */
const FIELDSTONE = [0x8a8790, 0x7c7a86, 0x9d9ba6, 0x8c8478, 0x76716a, 0xa39d92, 0x6c6a74];

/**
 * A rough fieldstone wall wrapped round a cylinder: courses of uneven height,
 * stones of uneven length, each lit along its top and shadowed along its foot
 * so it bulges out of the mortar, with moss creeping up from the ground.
 */
function fieldstone(courses: number[], seed: number, mossy = true): Shader {
  // Course boundaries from the top down, as fractions of the wall's height.
  const total = courses.reduce((a, b) => a + b, 0);
  const edges: number[] = [0];
  for (const c of courses) edges.push(edges[edges.length - 1] + c / total);
  return (u, v) => {
    let row = 0;
    while (row < courses.length - 1 && v >= edges[row + 1]) row++;
    const lv = (v - edges[row]) / (edges[row + 1] - edges[row]);
    // Each course is cut into stones of 3 to 6 per visible half-turn.
    const count = 3 + Math.floor(hash(row, seed) * 4);
    const fu = u * count + hash(row + 7, seed) * 0.9;
    const stone = Math.floor(fu);
    const lu = fu - stone;
    // A cylinder's side comes in 24 slices, so a joint must be at least one slice wide to show.
    // Rounded ends: the joint widens near the top and bottom of each stone.
    const round = (count / 24) * 0.9 + 0.15 * Math.max(0, Math.abs(lv - 0.5) * 2 - 0.5);
    if (lv < 0.1 || lv > 0.9 || lu < round || lu > 1 - round) return P.mortar;
    const h = hash(stone + row * 13, seed + 3);
    let c = FIELDSTONE[Math.floor(h * FIELDSTONE.length)];
    // The light comes from the upper left: brighter on the left of the curve, darker round the right.
    c = mix(c, u < 0.4 ? 0xc4c1ca : 0x3e3c48, u < 0.4 ? (0.4 - u) * 0.5 : (u - 0.4) * 0.45);
    if (lv < 0.24) c = mix(c, 0xd2d0d8, 0.3);
    else if (lv > 0.76) c = mix(c, 0x2e2c38, 0.3);
    // Speckles of lichen, and moss on the bottom courses.
    const speck = hash(Math.floor(u * 90), Math.floor(v * 30) + seed);
    if (mossy && v > 0.62 && speck < (v - 0.62) * 1.6) c = speck < 0.12 ? 0x4e6a32 : P.moss;
    else if (speck > 0.96) c = mix(c, 0xb4b070, 0.5);
    return c;
  };
}

/**
 * A rounded boulder, built from stacked discs that shrink towards the top, so
 * it reads as a lump of rock rather than a box. Light on its left and top.
 */
function boulder(m: IsoModel, cx: number, cy: number, r: number, h: number, base: number, moss = 0): void {
  const layers = Math.max(2, Math.round(h / 2.5));
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const rr = r * Math.sqrt(1 - t * t * 0.85);
    const z = (h * i) / layers;
    const lit = mix(base, 0xd8d6dc, 0.15 + t * 0.35);
    const top = moss > 0 && t > 0.5 ? mix(lit, P.moss, moss) : lit;
    m.cylinder(cx, cy, z, rr, h / layers + 0.5, (u) => (u < 0.3 ? mix(base, 0xd8d6dc, 0.2) : u > 0.7 ? darken(base, 0.62) : darken(base, 0.85)), top);
  }
}

/**
 * The village well: a round wall of rough fieldstone with a lip of capstones,
 * rising from a heap of boulders, under a little shingled roof on two timber
 * posts with a windlass, rope and bucket. Its footprint is 2x2, centred on (1, 1).
 */
function well(): IsoModel {
  const m = new IsoModel();
  const cx = 1;
  const cy = 1;
  const wallR = 0.66;
  const wallH = 22;
  const lipH = 5;
  const rim = wallH + lipH;

  // Boulders heaped round the foot of the wall, as if the ground were built up round it.
  const rocks: Array<[number, number, number, number, number]> = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + hash(i, 4) * 0.4;
    const r = 0.08 + hash(i, 5) * 0.09;
    const d = wallR + r * 0.35 + hash(i, 6) * 0.05;
    const h = 2 + hash(i, 7) * 4 + r * 14;
    rocks.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, h, FIELDSTONE[Math.floor(hash(i, 8) * FIELDSTONE.length)]]);
  }
  // A few smaller stones tumbled further out, still within the footprint.
  for (const [a, d, r] of [[0.6, 0.93, 0.06], [2.1, 0.9, 0.07], [3.6, 0.94, 0.05], [5.5, 0.9, 0.05]]) {
    rocks.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, 2 + r * 20, FIELDSTONE[Math.floor(hash(a, d) * FIELDSTONE.length)]]);
  }
  rocks.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const behind = rocks.filter(([x, y]) => x + y < cx + cy);
  const before = rocks.filter(([x, y]) => x + y >= cx + cy);
  for (const [x, y, r, h, c] of behind) boulder(m, x, y, r, h, c, 0.35);

  // The wall itself.
  m.cylinder(cx, cy, 0, wallR, wallH, fieldstone([5, 4, 6, 4, 5], 11), P.mortar);
  // The lip: big flat capstones, slightly overhanging the wall.
  const capR = wallR + 0.06;
  const caps = 9;
  m.cylinder(cx, cy, wallH, capR, lipH, (u, v) => {
    const fu = u * caps * 0.5 + 0.3;
    if ((fu % 1) < (caps * 0.5) / 24) return P.mortar;
    let c = FIELDSTONE[Math.floor(hash(Math.floor(fu), 21) * FIELDSTONE.length)];
    c = mix(c, 0xd0ced6, 0.25);
    c = mix(c, u < 0.4 ? 0xe0dee6 : 0x3e3c48, u < 0.4 ? (0.4 - u) * 0.5 : (u - 0.4) * 0.4);
    return v > 0.75 ? darken(c, 0.7) : v < 0.25 ? mix(c, 0xe8e6ee, 0.25) : c;
  }, (u, v) => {
    // Looking down on the lip: capstones round the edge, then the dark shaft.
    const dx = u * 2 - 1;
    const dy = v * 2 - 1;
    const d = Math.hypot(dx, dy);
    const inner = wallR / capR - 0.2;
    if (d > inner) {
      const ang = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) % 1;
      const fa = ang * caps * 2 + 0.15;
      if (fa % 1 < 0.08 || d < inner + 0.035) return P.mortar;
      const c = mix(FIELDSTONE[Math.floor(hash(Math.floor(fa), 21) * FIELDSTONE.length)], 0xd0ced6, 0.35);
      // Worn smooth and pale where hands and buckets rest on it; lit from the upper left.
      return dx + dy < -0.6 ? mix(c, 0xeceaf0, 0.25) : dx + dy > 0.8 ? darken(c, 0.85) : c;
    }
    // Down the shaft: the far side's stones show at the back, fading into the dark.
    const depth = (dx + dy) / (inner * 2.2) + 0.5; // 0 at the back wall, 1 at the front
    if (depth < 0.45) {
      const ring = Math.floor((Math.atan2(dy, dx) + Math.PI) * 6);
      const course = Math.floor(depth * 14);
      if ((depth * 14) % 1 < 0.2 || hash(ring, course) < 0.12) return 0x1c1a24;
      return mix(0x5a5866, 0x1c1a24, depth / 0.45);
    }
    // Far below, a glint of water.
    const w = (dx - 0.05) ** 2 + (dy - 0.1) ** 2;
    if (w < 0.02) return w < 0.004 ? 0x5a8cb4 : 0x1d3a5c;
    return 0x14121a;
  });

  // The windlass posts: rough-hewn timber, set into the lip on either side.
  const post = { top: P.barkLight, left: (u: number, v: number) => (hash(Math.floor(v * 20), 3) < 0.15 ? P.barkDark : u < 0.3 ? P.barkLight : P.bark), right: P.barkDark };
  m.box(0.94, 0.28, rim - 2, 0.12, 0.12, 36, post);
  // A wedge of stone at the foot of each post holds it fast.
  m.box(0.9, 0.32, rim - 2, 0.2, 0.08, 4, { top: P.stoneLight, left: P.stone, right: P.stoneDark });

  // The windlass: a log drum between the posts with the rope wound round its middle.
  const drumZ = rim + 18;
  m.box(0.96, 0.4, drumZ, 0.08, 1.2, 7, {
    top: (_u, v) => (v > 0.38 && v < 0.62 ? P.straw : P.barkLight),
    left: (_u, v) => (v < 0.2 ? P.barkLight : v > 0.75 ? P.barkDark : P.bark),
    right: (u) => (u > 0.38 && u < 0.62 ? (Math.floor(u * 60) % 2 ? P.strawDark : P.straw) : P.bark),
  });
  // The rope down to the bucket, which hangs just above the shaft.
  m.box(1.0, 1.0, rim + 12, 0.02, 0.02, drumZ - rim - 12, { top: P.straw, left: P.straw, right: P.strawDark });
  m.box(0.93, 1.0, rim + 11, 0.14, 0.02, 1, { top: P.iron, left: P.iron, right: P.iron });
  m.cylinder(1, 1, rim + 2, 0.13, 10, (u, v) => {
    if (v < 0.12 || (v > 0.55 && v < 0.65)) return u < 0.35 ? P.ironLight : P.iron;
    const stave = Math.floor(u * 7);
    const c = stave % 2 ? P.plank : P.plankLight;
    return u > 0.7 ? darken(c, 0.75) : c;
  }, (u, v) => ((u - 0.5) ** 2 + (v - 0.5) ** 2 < 0.12 ? 0x1d3a5c : P.plankDark));

  // Front post, the crank sticking out of it, and its stone wedge.
  m.box(0.94, 1.6, rim - 2, 0.12, 0.12, 36, post);
  m.box(0.9, 1.64, rim - 2, 0.2, 0.08, 4, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.box(0.98, 1.72, drumZ + 2, 0.04, 0.16, 3, { top: P.ironLight, left: P.iron, right: P.iron });
  m.box(0.98, 1.85, drumZ - 6, 0.04, 0.04, 10, { top: P.ironLight, left: P.iron, right: P.iron });
  m.box(0.98, 1.85, drumZ - 8, 0.16, 0.04, 3, { top: P.plankLight, left: P.plank, right: P.plankDark });

  // Boulders in front of the wall, painted over its foot.
  for (const [x, y, r, h, c] of before) boulder(m, x, y, r, h, c, 0.35);

  // A little gabled roof of wooden shingles, overhanging the posts, with a ridge board.
  const roofZ = rim + 34;
  const shingles = (dim: number): Shader => (u, v) => {
    const row = Math.floor(v * 6);
    const lv = (v * 6) % 1;
    const col = Math.floor(u * 7 + row * 0.5);
    if (lv > 0.82) return darken(P.barkDark, dim);
    if ((u * 7 + row * 0.5) % 1 < 0.07) return darken(P.barkDark, dim);
    const base = hash(col, row) < 0.25 ? P.plankDark : hash(col, row) > 0.8 ? P.plankLight : P.plank;
    return darken(lv < 0.2 ? mix(base, 0xd8b890, 0.25) : base, dim);
  };
  const eave = 0.36;
  const rise = 17;
  // Gable ends: a triangle of boards under each slope.
  const gable: Shader = (u, v) => (Math.abs(u - 0.5) * 2 > 1 - v ? null : Math.floor(u * 6) % 2 ? P.plankDark : P.plank);
  m.quad({ x: 1 - eave, y: 1.66, z: roofZ + rise }, { x: eave * 2, y: 0, z: 0 }, { x: 0, y: 0, z: -rise }, (u, v) => {
    const g = gable(u, 1 - v);
    return g === null ? null : darken(g, 0.85);
  });
  m.quad({ x: 1 - eave, y: 0.1, z: roofZ }, { x: eave, y: 0, z: rise }, { x: 0, y: 1.8, z: 0 }, shingles(0.72));
  m.quad({ x: 1, y: 0.1, z: roofZ + rise }, { x: eave, y: 0, z: -rise }, { x: 0, y: 1.8, z: 0 }, shingles(1));
  m.box(0.97, 0.06, roofZ + rise - 1, 0.06, 1.88, 3, { top: P.barkLight, left: P.bark, right: P.barkDark });
  return m;
}

/**
 * The ground round the market well: flat stones of all shapes and sizes laid
 * in the earth, close-set by the well and thinning out raggedly towards the
 * square, with grass and moss in the cracks. Painted flat into the ground, in
 * the same frame as the well so both can be placed at the same corner.
 */
function wellStones(): IsoModel {
  const m = new IsoModel();
  const cx = 1;
  const cy = 1;
  const span = 2.6;
  const cell = 0.42;
  // Jittered seeds on a grid make an uneven crazy-paving of flagstones.
  const seed = (i: number, j: number) => ({
    x: (i + 0.15 + hash(i, j) * 0.7) * cell,
    y: (j + 0.15 + hash(j + 31, i + 17) * 0.7) * cell,
  });
  // How far the paving reaches in each direction: ragged, never a neat circle.
  const reach = (a: number) => 1.75 + 0.28 * Math.sin(a * 3 + 1.1) + 0.18 * Math.sin(a * 5 + 2.3) + 0.1 * Math.sin(a * 9);
  const kept = (i: number, j: number) => {
    const s = seed(i, j);
    const d = Math.hypot(s.x - cx, s.y - cy);
    const r = reach(Math.atan2(s.y - cy, s.x - cx));
    if (d < r - 0.45) return true;
    // Near the edge, some stones are missing or sunk out of sight.
    if (d < r + 0.2) return hash(i * 3 + 5, j * 7 + 2) < (r + 0.2 - d) / 0.65;
    // A few strays out in the earth.
    return d < r + 0.7 && hash(i + 9, j + 4) < 0.12;
  };
  m.quad({ x: cx - span, y: cy - span, z: 0 }, { x: span * 2, y: 0, z: 0 }, { x: 0, y: span * 2, z: 0 }, (u, v) => {
    const gx = cx - span + u * span * 2;
    const gy = cy - span + v * span * 2;
    const ci = Math.floor(gx / cell);
    const cj = Math.floor(gy / cell);
    let d1 = Infinity;
    let d2 = Infinity;
    let best = { i: 0, j: 0, x: 0, y: 0 };
    for (let j = cj - 2; j <= cj + 2; j++) {
      for (let i = ci - 2; i <= ci + 2; i++) {
        const s = seed(i, j);
        const d = Math.hypot(gx - s.x, gy - s.y);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          best = { i, j, ...s };
        } else if (d < d2) d2 = d;
      }
    }
    if (!kept(best.i, best.j)) return null;
    const gap = d2 - d1;
    const h = hash(best.i * 5 + 1, best.j * 3 + 7);
    // Smaller stones are shrunk inside their cells, leaving earth and grass round them.
    const shrink = h < 0.3 ? 0.05 : 0.02;
    if (gap < shrink) {
      // The cracks: earth, with tufts of grass and moss here and there.
      const g = hash(Math.floor(gx * 40), Math.floor(gy * 40));
      if (Math.hypot(gx - cx, gy - cy) < 0.75) return P.mortar;
      return g < 0.35 ? P.grass : g < 0.55 ? P.moss : g < 0.7 ? P.grassDark : P.dirtDark;
    }
    let c = FIELDSTONE[Math.floor(h * FIELDSTONE.length)];
    // Each stone slightly domed: lit along its back edges (towards the light), shadowed at the front.
    const dx = gx - best.x;
    const dy = gy - best.y;
    if (gap < shrink + 0.04) c = dx + dy < 0 ? mix(c, 0xdcdae2, 0.35) : darken(c, 0.68);
    else if (dx + dy > 0.08) c = darken(c, 0.9);
    // Lichen and wear.
    const speck = hash(Math.floor(gx * 60), Math.floor(gy * 60) + 3);
    if (speck > 0.965) c = mix(c, 0xb4b070, 0.45);
    else if (speck < 0.04) c = darken(c, 0.82);
    // Moss creeps over the stones furthest out.
    const far = Math.hypot(gx - cx, gy - cy) / reach(Math.atan2(gy - cy, gx - cx));
    if (far > 0.75 && hash(Math.floor(gx * 50), Math.floor(gy * 50) + 9) < (far - 0.75) * 1.2) c = mix(c, P.moss, 0.45);
    return c;
  });
  return m;
}

/** An iron lantern on a wooden post. Lit after dark (see the map's lights). */
function lampPost(): IsoModel {
  const m = new IsoModel();
  m.box(0.4, 0.4, 0, 0.2, 0.2, 4, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.box(0.45, 0.45, 4, 0.1, 0.1, 40, { top: P.barkLight, left: P.bark, right: P.barkDark });
  m.box(0.38, 0.38, 44, 0.24, 0.24, 10, {
    top: P.iron,
    left: (u, v) => (u < 0.15 || u > 0.85 || v < 0.12 || v > 0.88 ? P.iron : P.glassLit),
    right: (u, v) => (u < 0.15 || u > 0.85 || v < 0.12 || v > 0.88 ? P.iron : P.fireOrange),
  });
  m.box(0.42, 0.42, 54, 0.16, 0.16, 3, { top: P.ironLight, left: P.iron, right: P.iron });
  return m;
}

/** A plank bench along x, to sit on facing +y. */
function bench(): IsoModel {
  const m = new IsoModel();
  const leg = { top: P.plank, left: P.plank, right: P.plankDark };
  m.box(0.15, 0.4, 0, 0.1, 0.25, 10, leg);
  m.box(0.75, 0.4, 0, 0.1, 0.25, 10, leg);
  m.box(0.08, 0.35, 10, 0.84, 0.35, 3, { top: P.plankLight, left: P.plank, right: P.plankDark });
  return m;
}

/** A pile of wooden crates. */
function crates(): IsoModel {
  const m = new IsoModel();
  const side = planks(3, P.plank, P.plankDark, P.plankLight, 6);
  const crate = (x: number, y: number, z: number, s: number) =>
    m.box(x, y, z, s, s, s * 30, { top: (u, v) => (u < 0.08 || u > 0.92 || v < 0.08 || v > 0.92 ? P.plankDark : P.plankLight), left: side, right: (u, v) => darken(side(u, v) ?? P.plank) });
  crate(0.1, 0.15, 0, 0.55);
  crate(0.45, 0.5, 0, 0.45);
  crate(0.18, 0.22, 16.5, 0.42);
  return m;
}

/** A signpost with arms pointing along the road. */
function signpost(): IsoModel {
  const m = new IsoModel();
  m.box(0.45, 0.45, 0, 0.1, 0.1, 50, { top: P.barkLight, left: P.bark, right: P.barkDark });
  const board: Shader = (u, v) => (v < 0.2 || v > 0.8 || u < 0.03 ? P.plankDark : (u * 7 + v) % 1 < 0.5 && v > 0.4 && v < 0.6 ? P.ink : P.plankLight);
  // One arm along -x (towards the market) and one along +y.
  m.quad({ x: 0.0, y: 0.48, z: 46 }, { x: 0.5, y: 0, z: 0 }, { x: 0, y: 0, z: -9 }, board);
  m.quad({ x: 0.56, y: 0.5, z: 36 }, { x: 0, y: 0.55, z: 0 }, { x: 0, y: 0, z: -9 }, board);
  return m;
}

/** Roof tiles: rows of overlapping clay tiles, each a little different. */
function tileRoof(base: number): Shader {
  const dark = darken(base, 0.72);
  return (u, v) => {
    const row = Math.floor(v * 10);
    const lv = (v * 10) % 1;
    const col = Math.floor(u * 22 + (row % 2) * 0.5);
    if (v > 0.95 || lv > 0.8) return dark;
    const n = hash(col, row);
    if ((u * 22 + (row % 2) * 0.5) % 1 < 0.08) return dark;
    return n < 0.2 ? dark : n > 0.85 || lv < 0.15 ? lighten(base) : base;
  };
}

/** Slates: small, thin and close-laid, blue-grey with the odd lighter or rustier one, and a little moss low down. */
function slateRoof(base: number): Shader {
  const dark = darken(base, 0.62);
  return (u, v) => {
    const row = Math.floor(v * 16);
    const lv = (v * 16) % 1;
    const fu = u * 34 + (row % 2) * 0.5;
    if (v > 0.96 || lv > 0.78 || fu % 1 < 0.07) return dark;
    const n = hash(Math.floor(fu), row + 40);
    let c = n < 0.15 ? darken(base, 0.85) : n > 0.88 ? lighten(base) : n > 0.8 ? mix(base, 0x8a6a5a, 0.35) : base;
    if (lv < 0.18) c = mix(c, 0xc8c8d4, 0.2);
    if (v > 0.7 && hash(Math.floor(u * 60), Math.floor(v * 40) + 7) < (v - 0.7) * 0.6) c = mix(c, P.moss, 0.55);
    return c;
  };
}

/** Wooden shingles, split by hand: uneven widths, weathered grey at the tips. */
function shingleRoof(base: number): Shader {
  const dark = darken(base, 0.6);
  return (u, v) => {
    const row = Math.floor(v * 12);
    const lv = (v * 12) % 1;
    const fu = u * 26 + hash(row, 5) * 3;
    const warped = fu + 0.3 * Math.sin(fu * 1.7 + row);
    if (v > 0.95 || lv > 0.82 || warped % 1 < 0.08) return dark;
    const n = hash(Math.floor(warped), row + 11);
    let c = n < 0.25 ? darken(base, 0.85) : n > 0.8 ? lighten(base) : base;
    if (lv > 0.55) c = mix(c, 0x8a8478, 0.3);
    return c;
  };
}

/**
 * Thatch: long straw combed down the slope in streaks, a darker trimmed edge
 * at the eaves, and moss gathered in the hollows where the rain runs off.
 */
function thatchRoof(base: number): Shader {
  return (u, v) => {
    const streak = hash(Math.floor(u * 140), Math.floor(v * 9 + hash(Math.floor(u * 140), 2) * 3));
    let c = streak < 0.3 ? darken(base, 0.82) : streak > 0.85 ? mix(base, 0xf0dca0, 0.35) : base;
    // Courses of thatch, each overlapping the one below in a soft shadow.
    const course = (v * 6) % 1;
    if (course > 0.88) c = darken(c, 0.8);
    // Patches of moss and weathering, lumped together rather than speckled.
    const lump = Math.sin(u * 23 + 1.3) * Math.sin(v * 13 + u * 9) + 0.5 * Math.sin(u * 57 + v * 21);
    const grain = hash(Math.floor(u * 70), Math.floor(v * 30) + 5);
    if (lump > 1.05 && grain < 0.8) c = mix(c, P.moss, 0.5);
    else if (lump > 0.8 && grain < 0.6) c = mix(c, 0x7a6a48, 0.35);
    // The trimmed edge at the eaves: thick and darker.
    if (v > 0.92) c = v > 0.97 ? darken(base, 0.5) : darken(base, 0.68);
    return c;
  };
}

function lighten(c: number): number {
  const ch = (shift: number) => Math.min(255, Math.round(((c >> shift) & 0xff) * 1.2)) << shift;
  return ch(16) | ch(8) | ch(0);
}

/**
 * Rough rubble walling, in pixels: courses of uneven fieldstones like the
 * well's, each lit along its top and shadowed below, with moss at the foot.
 */
function rubble(x: number, y: number, height: number, seed: number): number {
  const rowH = 6 + Math.floor(hash(Math.floor(y / 7), seed) * 2);
  const row = Math.floor(y / rowH);
  const ly = (y % rowH) / rowH;
  const s = (x + hash(row, seed + 1) * 20) / (8 + hash(row, seed + 2) * 6);
  const warped = s + 0.35 * Math.sin(s * 2.1 + row);
  const stone = Math.floor(warped);
  const lu = warped - stone;
  if (ly < 0.16 || lu < 0.1) return P.mortar;
  let c = FIELDSTONE[Math.floor(hash(stone + row * 17, seed + 3) * FIELDSTONE.length)];
  if (ly < 0.34 || lu < 0.22) c = mix(c, 0xd2d0d8, 0.28);
  else if (ly > 0.82) c = darken(c, 0.78);
  if (y > height - 8 && hash(Math.floor(x), Math.floor(y) + seed) < (y - height + 8) / 14) c = mix(c, P.moss, 0.7);
  return c;
}

/** Dressed stone blocks, laid in neat courses. */
function ashlar(x: number, y: number): number {
  const row = Math.floor(y / 6);
  const brick = Math.floor(x / 9 + (row % 2) * 0.5);
  if (y % 6 < 1 || (x / 9 + (row % 2) * 0.5) % 1 < 0.08) return P.mortar;
  const n = hash(brick, row);
  return n < 0.3 ? P.stoneDark : n > 0.8 ? P.stoneLight : P.stone;
}

/** Red brick in a running bond, every brick fired a little differently. */
function brick(x: number, y: number): number {
  const row = Math.floor(y / 3);
  const fx = x / 7 + (row % 2) * 0.5;
  if (y % 3 < 0.8 || fx % 1 < 0.1) return 0x8a7e72;
  const n = hash(Math.floor(fx), row + 9);
  return n < 0.2 ? 0x7a3a2a : n > 0.85 ? 0xb8684a : n > 0.6 ? 0xa0503a : 0x92462f;
}

export type RoofKind = 'tile' | 'slate' | 'shingle' | 'thatch';

export interface TownhouseStyle {
  roof: number;
  plaster: number;
  /**
   * Which face the door is on: the front (+y), the side (+x), or 'back' for
   * houses whose door is on a face the camera can't see (a house on the near
   * side of the square, facing into it, shows only its back walls).
   */
  door: 'front' | 'side' | 'back';
  /** What the roof is covered with (clay tiles if not given). */
  roofKind?: RoofKind;
  /** The ground floor: dressed stone (the default), rough fieldstone rubble, or brick. */
  ground?: 'ashlar' | 'rubble' | 'brick';
  /**
   * The upper floor: timber framing with diagonal braces (the default), close
   * upright studs, chevrons, or no framing at all, just more rubble stone.
   */
  upper?: 'braced' | 'studded' | 'chevron' | 'rubble';
  /** Colour of the framing timbers. */
  timber?: number;
  /** Painted shutters either side of the windows. */
  shutters?: number;
  /** Window boxes under the upstairs windows, with flowers in these colours. */
  flowers?: number[];
  /** Ivy (or hops) climbing a wall from the ground: which face, and how far along it (0..1). */
  ivy?: { face: 'front' | 'side'; at: number; hops?: boolean };
  /** A hanging sign over the door (an inn, a shop). */
  sign?: number;
  /** Something painted on the sign: the Crooked Tankard's tilted tankard. */
  emblem?: 'tankard';
  /** The Crooked Tankard: bow window, porch, leaning chimney and a big sign. */
  inn?: boolean;
}

/** The painted face of a hanging sign: plain, or with the Crooked Tankard's tankard, tipped at a jaunty angle. */
function signPaint(style: TownhouseStyle, u: number, v: number): number {
  if (style.emblem === 'tankard') {
    const tu = u - (v - 0.5) * 0.25;
    if (tu > 0.28 && tu < 0.62 && v > 0.34 && v < 0.82) return tu < 0.36 ? 0x9a5a2a : 0x7a4420;
    if (tu > 0.26 && tu < 0.66 && v > 0.22 && v <= 0.34) return 0xfaf2e0;
    if (tu >= 0.62 && tu < 0.76 && v > 0.42 && v < 0.7 && !(tu < 0.7 && v > 0.48 && v < 0.64)) return 0x7a4420;
  }
  return style.sign!;
}

const IVY = [0x2f5a2a, 0x3d6b33, 0x4c8038, 0x2a4a26];
const HOPS = [0x4c8038, 0x619a43, 0x3d6b33, 0xb8d070];

/**
 * A two-storey townhouse on a 3x3 footprint: a stone or brick ground floor,
 * timber framing over limewashed plaster above (or more stone), and a steep
 * roof of tiles, slates, shingles or thatch with a chimney. Seen from the
 * square, with its door on the front or side. The style picks the materials,
 * so no two houses round the square need look alike.
 */
function townhouse(style: TownhouseStyle): IsoModel {
  const m = new IsoModel();
  const S = 3;
  const H = 84;
  const R = 44;
  const thatched = style.roofKind === 'thatch';
  const o = thatched ? 0.36 : 0.28;
  const roofPaint = { tile: tileRoof, slate: slateRoof, shingle: shingleRoof, thatch: thatchRoof }[style.roofKind ?? 'tile'](style.roof);
  const timber = style.timber ?? P.bark;
  const timberDark = darken(timber, 0.7);
  const seed = Math.floor(style.plaster % 97) + Math.floor(style.roof % 89);
  const upperH = H - 38;

  const ivyAt = (face: 'front' | 'side', u: number, y: number): number | null => {
    const iv = style.ivy;
    if (!iv || iv.face !== face) return null;
    const spread = Math.abs(u - iv.at) / 0.2;
    if (spread > 1) return null;
    const reach = (H - 6) * (1 - spread * spread) * (0.75 + 0.25 * Math.sin(u * 40));
    if (y < H - reach) return null;
    const leaf = hash(Math.floor(u * 96 / 2), Math.floor(y / 2) + 31);
    const edge = (y - (H - reach)) / 10;
    if (leaf > 0.55 + (edge < 1 ? 0.35 * (1 - edge) : 0)) return null;
    const pal = iv.hops ? HOPS : IVY;
    return pal[Math.floor(hash(Math.floor(u * 96), Math.floor(y)) * pal.length)];
  };

  const timberUpper = (u: number, y: number, f: (c: number) => number): number | null => {
    if (style.upper === 'rubble') return null;
    const beam = u < 0.025 || u > 0.975 || y < 3 || Math.abs(u - 0.5) < 0.02;
    if (beam) return f(timber);
    const bay = (u * 2) % 1;
    const t = y / upperH;
    if (style.upper === 'studded') {
      if ((u * 12) % 1 < 0.18) return f(timber);
      if (Math.abs(y - upperH * 0.55) < 1.5) return f(timberDark);
    } else if (style.upper === 'chevron') {
      const up = 1 - t;
      if (Math.abs(bay - up * 0.5) < 0.03 || Math.abs(bay - (1 - up * 0.5)) < 0.03) return f(timberDark);
    } else if (Math.abs(bay - t) < 0.035 || Math.abs(bay - (1 - t)) < 0.035) return f(timberDark);
    return null;
  };

  const shutterAt = (u: number, a: number, b: number): number | null => {
    if (style.shutters === undefined) return null;
    const w = 0.06;
    if ((u > a - w && u <= a) || (u >= b && u < b + w)) {
      const su = u <= a ? (u - (a - w)) / w : (u - b) / w;
      return su < 0.15 || su > 0.85 || Math.abs(su - 0.5) < 0.08 ? darken(style.shutters, 0.7) : style.shutters;
    }
    return null;
  };

  const wall = (face: 'front' | 'side', windows: Array<[number, number]>, groundWindows: Array<[number, number]>, door: [number, number] | null, shade: boolean): Shader => (u, v) => {
    const x = u * S * 32;
    const y = v * H;
    const f = (c: number) => (shade ? darken(c, 0.8) : c);
    // Climbing ivy (or hops) over everything but the door.
    const inDoor = door && u > door[0] && u < door[1] && y > H - 30;
    if (!inDoor) {
      const iv = ivyAt(face, u, y);
      if (iv !== null) return f(iv);
    }
    // Ground floor.
    if (y > H - 34) {
      if (inDoor) {
        const du = (u - door![0]) / (door![1] - door![0]);
        if (du < 0.1 || du > 0.9 || y < H - 28) return f(timberDark);
        if (style.inn) {
          // Double doors, studded with iron, and an arched fanlight over them.
          if (y < H - 23) return Math.abs(du - 0.5) < 0.06 ? f(timberDark) : P.glassLit;
          if (Math.abs(du - 0.5) < 0.03) return f(P.leatherDark);
          if ((Math.floor(du * 8) + Math.floor(y / 4)) % 4 === 0 && Math.floor(y) % 4 === 0) return P.ironLight;
          return f(0x3a5a3a);
        }
        if (Math.abs(du - 0.5) < 0.04) return f(P.leatherDark);
        if (Math.abs(du - 0.75) < 0.05 && Math.abs(y - (H - 14)) < 2) return P.gold;
        return f(P.leather);
      }
      for (const [a, b] of groundWindows) {
        if (u > a && u < b && y > H - 26 && y < H - 12) {
          const wu = (u - a) / (b - a);
          if (wu < 0.14 || wu > 0.86 || y < H - 24 || y > H - 14) return f(timberDark);
          return Math.abs(wu - 0.5) < 0.07 ? P.bark : P.glassLit;
        }
        if (y > H - 26 && y < H - 12) {
          const sh = shutterAt(u, a, b);
          if (sh !== null) return f(sh);
        }
      }
      const g = style.ground ?? 'ashlar';
      return f(g === 'rubble' ? rubble(x, y, H, seed) : g === 'brick' ? brick(x, y) : ashlar(x, y));
    }
    // Jetty beam between the floors, or a stone string course on a stone house.
    if (y > H - 38) {
      if (style.upper === 'rubble') return f(y < H - 36 ? P.stoneLight : P.stoneDark);
      return f(y < H - 36 ? lighten(timber) : timberDark);
    }
    // Upper floor: windows, then framing, then plaster (or stone).
    for (const [a, b] of windows) {
      if (u > a && u < b && y > 12 && y < 36) {
        const wu = (u - a) / (b - a);
        if (wu < 0.14 || wu > 0.86 || y < 14 || y > 34) return f(timberDark);
        if (style.inn) {
          // Leaded diamond panes.
          const d1 = (wu * 6 + y / 4) % 1;
          const d2 = (wu * 6 - y / 4 + 10) % 1;
          if (d1 < 0.12 || d2 < 0.12) return P.leatherDark;
          return y < 24 ? P.glassLit : P.fireOrange;
        }
        if (Math.abs(wu - 0.5) < 0.07 || Math.abs(y - 24) < 1) return P.bark;
        return y < 24 ? P.glassLit : P.fireOrange;
      }
      if (y > 12 && y < 36) {
        const sh = shutterAt(u, a, b);
        if (sh !== null) return f(sh);
      }
    }
    if (style.upper === 'rubble') return f(rubble(x, y + 3, H, seed + 5));
    const fr = timberUpper(u, y, f);
    if (fr !== null) return fr;
    const n = hash(Math.floor(x / 3), Math.floor(y / 3));
    return f(n < 0.1 ? darken(style.plaster, 0.92) : style.plaster);
  };

  const front = style.door === 'front';
  // Back roof slope, then the chimney through it.
  m.quad({ x: -o, y: S / 2, z: H + R }, { x: S + o, y: 0, z: 0 }, { x: 0, y: -S / 2 - o, z: -R - 8 }, roofPaint);
  const chimneyPaint = {
    top: P.soot,
    left: (u: number, v: number) => ((v * 8) % 1 < 0.15 || (u * 3 + Math.floor(v * 8) * 0.5) % 1 < 0.1 ? P.mortar : P.stone),
    right: (_u: number, v: number) => ((v * 8) % 1 < 0.15 ? P.mortar : P.stoneDark),
  };
  if (style.inn) {
    // The crooked chimney the inn is named for: it leans further with every course, and wears a pot on top.
    const h = (R + 22) / INN_LEAN.parts;
    for (let i = 0; i < INN_LEAN.parts; i++) {
      const lean = (i * i) / (INN_LEAN.parts * INN_LEAN.parts);
      m.box(0.4 + lean * INN_LEAN.x, 0.5 + lean * INN_LEAN.y, H + i * h, 0.45, 0.45, h + 0.5, chimneyPaint);
    }
    m.cylinder(INN_CHIMNEY.gx, INN_CHIMNEY.gy, H + R + 22, 0.12, 7, (u) => (u < 0.4 ? 0xb8684a : 0x8a4a32), P.soot);
  } else {
    m.box(0.4, 0.5, H, 0.45, 0.45, R + 22, chimneyPaint);
  }
  const frontWindows: Array<[number, number]> = [[0.12, 0.3], [0.7, 0.88]];
  const sideWindows: Array<[number, number]> = [[0.15, 0.33], [0.67, 0.85]];
  // The inn's bow window takes the place of its left-hand ground-floor window.
  const frontGround: Array<[number, number]> = style.inn ? [[0.7, 0.88]] : frontWindows;
  m.quad({ x: 0, y: S, z: H }, { x: S, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, wall('front', frontWindows, frontGround, front ? [0.4, 0.6] : null, false));
  m.quad({ x: S, y: 0, z: H }, { x: 0, y: S, z: 0 }, { x: 0, y: 0, z: -H }, wall('side', sideWindows, sideWindows, style.door === 'side' ? [0.4, 0.6] : null, true));
  // Gable over the side, finished like the upper floor.
  m.quad({ x: S, y: 0, z: H }, { x: 0, y: S, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => {
    if (v > 1 - Math.abs(u * 2 - 1)) return null;
    if (style.upper === 'rubble') {
      if (Math.abs(u - 0.5) < 0.05 && v > 0.3 && v < 0.5) return P.ink;
      return darken(rubble(u * 96, (1 - v) * R + 40, H + 100, seed + 9), 0.8);
    }
    if (v < 0.06 || Math.abs(u - 0.5) < 0.02) return darken(timberDark, 0.8);
    if (style.upper === 'studded' && (u * 12) % 1 < 0.18) return darken(timber, 0.8);
    if (Math.abs(u - 0.5) < 0.08 && v > 0.3 && v < 0.55) return P.ink;
    return darken(style.plaster, 0.8);
  });
  // The roof's edge over the gable: thick and rounded for thatch.
  m.quad({ x: S, y: S / 2, z: H + R }, { x: o, y: 0, z: 0 }, { x: 0, y: -S / 2 - o, z: -R - 8 }, darken(style.roof, 0.6));
  m.quad({ x: -o, y: S / 2, z: H + R }, { x: S + o * 2, y: 0, z: 0 }, { x: 0, y: S / 2 + o, z: -R - 8 }, roofPaint);
  if (thatched) {
    // Thick thatch shows its cut ends along the gable, and a ridge roll pegged down with criss-crossed spars.
    m.quad({ x: S + o, y: S / 2, z: H + R }, { x: 0, y: S / 2 + o, z: -R - 8 }, { x: 0, y: 0, z: -6 }, (u) => (hash(Math.floor(u * 60), 3) < 0.4 ? darken(style.roof, 0.5) : darken(style.roof, 0.65)));
    m.box(-o, S / 2 - 0.16, H + R - 3, S + o * 2, 0.32, 7, {
      top: lighten(style.roof),
      left: (u, v) => {
        const zig = Math.abs(((u * 24) % 1) - 0.5) * 2;
        if (Math.abs(v - zig) < 0.12 || Math.abs(v - (1 - zig)) < 0.12) return P.barkDark;
        return v > 0.85 ? darken(style.roof, 0.6) : style.roof;
      },
      right: darken(style.roof, 0.7),
    });
  } else {
    m.box(-o, S / 2 - 0.06, H + R - 2, S + o * 2, 0.12, 4, { top: lighten(style.roof), left: darken(style.roof, 0.7), right: darken(style.roof, 0.7) });
  }

  // Window boxes under the upstairs windows, spilling flowers.
  if (style.flowers) {
    const fl = style.flowers;
    const bloom: Shader = (u, v) => {
      const n = hash(Math.floor(u * 30), Math.floor(v * 4) + 3);
      if (n < 0.35) return IVY[Math.floor(n * 10) % IVY.length];
      return fl[Math.floor(n * 97) % fl.length];
    };
    const tuft: Shader = (u, v) => {
      const n = hash(Math.floor(u * 30), 17);
      if (v < 1 - n * 1.2) return null;
      return n > 0.5 ? fl[Math.floor(n * 31) % fl.length] : IVY[Math.floor(n * 10) % IVY.length];
    };
    const boxPaint = { top: bloom, left: planks(1, P.plank, P.plankDark, P.plankLight), right: P.plankDark };
    for (const [a, b] of frontWindows) {
      m.box(a * S, S, H - 52, (b - a) * S, 0.14, 4, boxPaint);
      m.quad({ x: a * S, y: S + 0.07, z: H - 44 }, { x: (b - a) * S, y: 0, z: 0 }, { x: 0, y: 0, z: -4 }, tuft);
    }
    for (const [a, b] of sideWindows) {
      m.box(S, a * S, H - 52, 0.14, (b - a) * S, 4, boxPaint);
      m.quad({ x: S + 0.07, y: a * S, z: H - 44 }, { x: 0, y: (b - a) * S, z: 0 }, { x: 0, y: 0, z: -4 }, tuft);
    }
  }

  if (style.inn) {
    // A bow window of bottle glass, bulging from the taproom onto the square, on a low stone sill wall.
    const bx = 0.3;
    const bw = 0.66;
    const bd = 0.22;
    m.box(bx, S, 0, bw, bd, 7, { top: P.stoneLight, left: (u, v) => rubble(u * 40, v * 7 + 77, 84, seed), right: P.stoneDark });
    const panes = (dim: number): Shader => (u, v) => {
      if (v < 0.08 || v > 0.92 || u < 0.05 || u > 0.95) return darken(P.barkDark, dim);
      if ((u * 5) % 1 < 0.1) return darken(P.barkDark, dim);
      // Round bottle-glass bullseyes, each with a bright knot in the middle.
      const cu = ((u * 10) % 1) - 0.5;
      const cv = ((v * 4) % 1) - 0.5;
      const r = cu * cu + cv * cv;
      if (r < 0.03) return 0xfff2c0;
      return darken(r < 0.15 ? P.glassLit : P.fireOrange, dim);
    };
    m.box(bx, S, 7, bw, bd, 16, { top: P.plankLight, left: panes(1), right: panes(0.8) });
    m.quad({ x: bx - 0.04, y: S, z: 28 }, { x: bw + 0.08, y: 0, z: 0 }, { x: 0, y: bd + 0.1, z: -5 }, shingleRoof(P.plank));
    // A porch hood over the door on two curved brackets.
    m.box(1.22, S, 26, 0.06, 0.32, 3, { top: timber, left: timberDark, right: timberDark });
    m.box(1.72, S, 26, 0.06, 0.32, 3, { top: timber, left: timberDark, right: timberDark });
    m.quad({ x: 1.12, y: S, z: 38 }, { x: 0.76, y: 0, z: 0 }, { x: 0, y: 0.4, z: -9 }, roofPaint);
    m.quad({ x: 1.12, y: S + 0.4, z: 29 }, { x: 0.76, y: 0, z: 0 }, { x: 0, y: 0, z: -2 }, darken(style.roof, 0.55));
    // A lantern on an iron arm beside the door.
    m.box(1.95, S, 36, 0.04, 0.18, 1, { top: P.iron, left: P.iron, right: P.iron });
    m.box(1.94, S + 0.1, 28, 0.1, 0.1, 7, {
      top: P.iron,
      left: (u, v) => (u < 0.2 || u > 0.8 || v < 0.15 || v > 0.85 ? P.iron : P.glassLit),
      right: (u, v) => (u < 0.2 || u > 0.8 || v < 0.15 || v > 0.85 ? P.iron : P.fireOrange),
    });
    // The big sign, swinging from a long scrolled bracket at the corner of the upper floor.
    const sx = 0.14;
    m.box(sx, S, H - 30, 0.05, 0.8, 2, { top: P.ironLight, left: P.iron, right: P.iron });
    m.quad({ x: sx, y: S, z: H - 40 }, { x: 0, y: 0.35, z: 0 }, { x: 0, y: 0, z: 10 }, (u, v) => (Math.abs(v - u) < 0.12 ? P.iron : null));
    m.box(sx, S + 0.25, H - 32, 0.03, 0.03, 2, { top: P.iron, left: P.iron, right: P.iron });
    m.box(sx, S + 0.72, H - 32, 0.03, 0.03, 2, { top: P.iron, left: P.iron, right: P.iron });
    m.quad({ x: sx, y: S + 0.18, z: H - 32 }, { x: 0, y: 0.62, z: 0 }, { x: 0, y: 0, z: -22 }, (u, v) => {
      if (u < 0.06 || u > 0.94 || v < 0.07 || v > 0.93) return P.barkDark;
      if (u < 0.1 || u > 0.9 || v < 0.12 || v > 0.88) return P.gold;
      return signPaint(style, u, v);
    });
  } else if (style.sign !== undefined) {
    // A bracket and a painted board hanging over the door.
    const sx = front ? 1.5 : S;
    const sy = front ? S : 1.5;
    if (front) {
      m.box(sx + 0.2, sy, H - 30, 0.05, 0.5, 2, { top: P.iron, left: P.iron, right: P.iron });
      m.quad({ x: sx + 0.2, y: sy + 0.15, z: H - 32 }, { x: 0, y: 0.35, z: 0 }, { x: 0, y: 0, z: -14 }, (u, v) => (u < 0.08 || u > 0.92 || v < 0.1 || v > 0.9 ? P.barkDark : signPaint(style, u, v)));
    } else {
      m.box(sx, sy + 0.2, H - 30, 0.5, 0.05, 2, { top: P.iron, left: P.iron, right: P.iron });
      m.quad({ x: sx + 0.15, y: sy + 0.2, z: H - 32 }, { x: 0.35, y: 0, z: 0 }, { x: 0, y: 0, z: -14 }, (u, v) => (u < 0.08 || u > 0.92 || v < 0.1 || v > 0.9 ? P.barkDark : signPaint(style, u, v)));
    }
  }
  return m;
}

/** Height (pixels) and position of a townhouse's chimney top, relative to its corner, for the smoke. */
export const TOWNHOUSE_CHIMNEY = { gx: 0.62, gy: 0.72, z: 150 };
/** How far the Crooked Tankard's chimney leans over by its top course, in tiles. */
const INN_LEAN = { parts: 6, x: 0.55, y: -0.25 };
const INN_TOP = (INN_LEAN.parts - 1) ** 2 / INN_LEAN.parts ** 2;
/** The Crooked Tankard's leaning chimney tops out further over, and higher for its pot. */
export const INN_CHIMNEY = { gx: 0.625 + INN_TOP * INN_LEAN.x, gy: 0.725 + INN_TOP * INN_LEAN.y, z: 157 };

const BLACK_OAK = 0x2e2622;
const FLOWERS_RED = [0xc8434a, 0xe86a5a, 0xf2e2c8];
const FLOWERS_BLUE = [0x6a7ad0, 0xb0a0e8, 0xf2e2c8];
const FLOWERS_GOLD = [0xe6b54a, 0xf2d27a, 0xc8434a];

/**
 * Every house round the square is dressed differently: slate, shingle or tile;
 * dressed stone, rubble or brick below; braces, studs, chevrons or bare stone
 * above; and shutters, window boxes or ivy here and there.
 */
export const TOWNHOUSES: Record<string, TownhouseStyle> = {
  'bld-house-cooper': { roof: 0xa4583a, plaster: 0xe8dcc0, door: 'front', ground: 'ashlar', flowers: FLOWERS_RED },
  'bld-house-weaver': { roof: 0x5a5a6e, plaster: 0xdcd4c4, door: 'front', roofKind: 'slate', ground: 'rubble', upper: 'rubble', shutters: 0x3a5a8a, ivy: { face: 'side', at: 0.5 } },
  'bld-house-chandler': { roof: 0x7a6250, plaster: 0xf0ece0, door: 'front', roofKind: 'shingle', ground: 'brick', upper: 'studded', timber: BLACK_OAK, flowers: FLOWERS_BLUE },
  'bld-house-reeve': { roof: 0x8a5a34, plaster: 0xe6cf98, door: 'front', ground: 'rubble', upper: 'chevron', shutters: 0x8a3a30, ivy: { face: 'front', at: 0.92 } },
  'bld-house-miller': { roof: 0x5e6272, plaster: 0xd4dccc, door: 'front', roofKind: 'slate', ground: 'ashlar', timber: 0x5a3a24, flowers: FLOWERS_GOLD, shutters: 0x4e6a3a },
  'bld-inn': {
    roof: 0xa89058, plaster: 0xe2b49a, door: 'front', roofKind: 'thatch', ground: 'rubble', upper: 'studded', timber: BLACK_OAK,
    shutters: 0x3a5a3a, flowers: FLOWERS_GOLD, ivy: { face: 'side', at: 0.12, hops: true }, sign: P.gold, emblem: 'tankard', inn: true,
  },
  // Seen from behind: the houses along the near side of the square, facing into it.
  'bld-house-back-slate': { roof: 0x5a5a6e, plaster: 0xeae2d0, door: 'back', roofKind: 'slate', ground: 'rubble', upper: 'studded', timber: 0x4a3020 },
  'bld-house-back-tile': { roof: 0xa4583a, plaster: 0xe8dcc0, door: 'back', ground: 'brick', ivy: { face: 'front', at: 0.25 }, shutters: 0x6a4a7a },
  'bld-house-back-shingle': { roof: 0x6e5a48, plaster: 0xe6cf98, door: 'back', roofKind: 'shingle', ground: 'ashlar', upper: 'rubble', flowers: FLOWERS_RED },
};

export function generateMarket(scene: Phaser.Scene): void {
  const put = (key: string, model: IsoModel, outline = true) => {
    const r = model.render(outline);
    const tex = r.canvas.toTexture(scene, key);
    MODEL_ART[key] = { key, originX: r.anchorX / tex.width, originY: r.anchorY / tex.height };
  };
  for (const kind of Object.keys(AWNINGS) as StallKind[]) {
    put(`mkt-stall-${kind}`, stall(kind));
    put(`mkt-stall-${kind}-closed`, stall(kind, true));
  }
  for (const [key, style] of Object.entries(TOWNHOUSES)) put(key, townhouse(style));
  put('mkt-well', well());
  put('mkt-well-stones', wellStones(), false);
  put('mkt-lamp', lampPost());
  put('mkt-bench', bench());
  put('mkt-crates', crates());
  put('mkt-signpost', signpost());
}
