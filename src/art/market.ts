import Phaser from 'phaser';
import { IsoModel, planks, Shader } from './IsoModel';
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
 * A market stall on a 2x2 footprint facing +y: a trestle counter across the
 * front row, draped with cloth and laid with goods, on four rough poles lashed
 * together, under a striped canvas awning that sags between its beams and is
 * hemmed with a fringed valance. The stallholder stands in the back row, in
 * front of a rack of more stock, and is seen beneath the awning.
 * Closed for the night, the goods are gone and a sheet is roped over the counter.
 */
function stall(kind: StallKind, closed = false): IsoModel {
  const m = new IsoModel();
  const [stripe, stripe2, cloth] = AWNINGS[kind];
  const counterTop = 24;
  const backZ = 88;
  const frontZ = 74;
  const sag = 5;

  // A rough pole: round, with bark grain, lit on its left.
  const pole = (x: number, y: number, h: number) =>
    m.cylinder(x, y, 0, 0.055, h, (u, v) => {
      const grain = hash(Math.floor(u * 6), Math.floor(v * h / 3) + Math.floor(x * 10 + y * 7));
      const c = u < 0.3 ? P.barkLight : u > 0.7 ? P.barkDark : P.bark;
      return grain < 0.12 ? darken(c, 0.8) : c;
    }, P.barkLight);
  // Rope lashing where poles meet.
  const lashing = (x: number, y: number, z: number) =>
    m.cylinder(x, y, z - 4, 0.065, 4, (_u, v) => ((v * 4) % 1 < 0.3 ? P.strawDark : P.straw), P.straw);
  const beam = { top: P.barkLight, left: (u: number, v: number) => (v < 0.3 ? P.barkLight : hash(Math.floor(u * 30), 2) < 0.15 ? P.barkDark : P.bark), right: P.barkDark };

  // Back poles and the back beam, then the rack of stock behind the trader.
  pole(0.12, 0.12, backZ);
  pole(1.88, 0.12, backZ);
  m.box(0.08, 0.08, backZ - 4, 1.84, 0.08, 3, beam);
  backRack(m, kind, closed);

  // The trestle counter: legs, a thick board top with cloth over it, and the cloth hanging down the front in folds.
  for (const x of [0.2, 1.72]) {
    m.box(x, 1.08, 0, 0.08, 0.06, counterTop - 2, { top: P.plank, left: P.plank, right: P.plankDark });
    m.box(x, 1.5, 0, 0.08, 0.06, counterTop - 2, { top: P.plank, left: P.plank, right: P.plankDark });
  }
  // A sack and a basket tucked under the counter.
  m.cylinder(0.62, 1.32, 0, 0.16, 10, (u, v) => (v < 0.2 ? darken(0xb8a47c, 0.85) : u < 0.35 ? 0xc8b48c : u > 0.7 ? 0x8a7a58 : 0xb8a47c), 0xa8946c);
  m.cylinder(1.3, 1.3, 0, 0.15, 7, (u, v) => ((Math.floor(u * 18) + Math.floor(v * 4)) % 2 ? P.strawDark : P.straw), P.strawDark);
  const fold = (u: number) => 0.5 + 0.5 * Math.sin(u * Math.PI * 14);
  const hem = (v: number) => v > 0.82 && v < 0.92;
  m.box(0.08, 1.02, counterTop - 3, 1.84, 0.62, 3, { top: P.plankLight, left: P.plank, right: P.plankDark });
  // The cloth: across the top, then down the front and the right-hand end, a little ragged at the hem.
  m.quad({ x: 0.06, y: 1.0, z: counterTop }, { x: 1.88, y: 0, z: 0 }, { x: 0, y: 0.66, z: 0 }, (u, v) => {
    const n = hash(Math.floor(u * 50), Math.floor(v * 16));
    return n < 0.08 ? darken(cloth, 0.9) : v > 0.9 ? lighten(cloth) : cloth;
  });
  m.quad({ x: 0.06, y: 1.66, z: counterTop }, { x: 1.88, y: 0, z: 0 }, { x: 0, y: 0, z: -17 }, (u, v) => {
    if (v > 0.94 - 0.06 * Math.abs(Math.sin(u * 37))) return null;
    const base = hem(v) ? stripe : cloth;
    const f = fold(u);
    return f < 0.18 ? darken(base, 0.78) : f > 0.85 ? lighten(base) : base;
  });
  m.quad({ x: 1.94, y: 1.0, z: counterTop }, { x: 0, y: 0.66, z: 0 }, { x: 0, y: 0, z: -17 }, (u, v) => {
    if (v > 0.94 - 0.06 * Math.abs(Math.sin(u * 23))) return null;
    const base = darken(hem(v) ? stripe : cloth, 0.8);
    return fold(u * 0.5) < 0.2 ? darken(base, 0.8) : base;
  });
  if (closed) coverUp(m, counterTop);
  else goods(m, kind, counterTop);

  // Front poles, lashed to the front beam.
  pole(0.12, 1.66, frontZ);
  pole(1.88, 1.66, frontZ);
  m.box(0.08, 1.62, frontZ - 4, 1.84, 0.08, 3, beam);
  for (const [x, y, z] of [[0.12, 0.12, backZ], [1.88, 0.12, backZ], [0.12, 1.66, frontZ], [1.88, 1.66, frontZ]] as const) lashing(x, y, z);

  // The awning: canvas stretched from the back beam to the front, sagging between them.
  // Drawn in strips from back to front so the dip in the middle shows.
  const strips = 10;
  const y0 = -0.04;
  const y1 = 1.8;
  const zAt = (t: number) => backZ + 2 + (frontZ - 2 - backZ) * t - sag * Math.sin(Math.PI * Math.min(1, t / 0.92));
  const canvas = (u: number, t: number) => {
    const band = Math.floor(u * 10) % 2 === 0;
    let c = band ? stripe : stripe2;
    // Light falls on the slope; the hollow in the middle is a touch darker, and the canvas is weathered.
    const dip = Math.sin(Math.PI * Math.min(1, t / 0.92));
    c = mix(c, 0x2a2430, 0.12 * dip);
    const stain = hash(Math.floor(u * 24), Math.floor(t * 10) + 3);
    if (stain < 0.07) c = darken(c, 0.88);
    // Seams where the canvas widths are sewn together.
    if ((u * 5) % 1 < 0.015) c = darken(c, 0.8);
    return c;
  };
  for (let i = 0; i < strips; i++) {
    const ta = i / strips;
    const tb = (i + 1) / strips;
    const ya = y0 + (y1 - y0) * ta;
    const yb = y0 + (y1 - y0) * tb;
    const za = zAt(ta);
    const zb = zAt(tb);
    m.quad({ x: -0.06, y: ya, z: za }, { x: 2.12, y: 0, z: 0 }, { x: 0, y: yb - ya, z: zb - za }, (u, v) => {
      const t = ta + (tb - ta) * v;
      return t > 0.985 ? darken(canvas(u, t), 0.75) : canvas(u, t);
    });
  }
  // The awning's side edge, seen on the right, hanging down a little.
  m.quad({ x: 2.06, y: y0, z: zAt(0) }, { x: 0, y: y1 - y0, z: zAt(1) - zAt(0) }, { x: 0, y: 0, z: -6 }, (u, v) => {
    const t = u;
    if (v > 0.7 + 0.3 * Math.abs(Math.sin(u * Math.PI * 6))) return null;
    const ext = zAt(t) - (zAt(0) + (zAt(1) - zAt(0)) * t);
    if (v * 6 < -ext - 0.5) return null;
    return darken(Math.floor(t * 8) % 2 ? stripe2 : stripe, 0.72);
  });
  // A scalloped valance hanging from the front edge, with a fringe of tassels.
  const vz = zAt(1);
  m.quad({ x: -0.06, y: y1 - 0.02, z: vz }, { x: 2.12, y: 0, z: 0 }, { x: 0, y: 0, z: -12 }, (u, v) => {
    const scallop = 0.6 + 0.3 * Math.abs(Math.sin(u * Math.PI * 10));
    const tassel = (u * 40) % 1 < 0.35;
    if (v > scallop + (tassel ? 0.12 : 0)) return null;
    if (v > scallop) return P.gold;
    const base = Math.floor(u * 10) % 2 === 0 ? stripe : stripe2;
    if (v < 0.12) return darken(base, 0.7);
    return v > scallop - 0.1 ? darken(base, 0.8) : darken(base, 0.92);
  });

  return m;
}

/** Stock kept behind the trader: loaves on shelves, tools on a rack, hides over a rail. */
function backRack(m: IsoModel, kind: StallKind, closed: boolean): void {
  const wood = { top: P.plankLight, left: P.plank, right: P.plankDark };
  if (kind === 'baker') {
    // A crate of flour sacks, and a shelf of loaves against the back poles.
    m.box(0.25, 0.2, 0, 0.5, 0.35, 14, { top: P.plankLight, left: planks(2, P.plank, P.plankDark, P.plankLight, 4), right: P.plankDark });
    m.cylinder(0.42, 0.36, 14, 0.12, 8, (u) => (u < 0.4 ? 0xeee8dc : 0xc8c0b0), 0xf2ecdc);
    m.cylinder(0.62, 0.34, 14, 0.1, 7, (u) => (u < 0.4 ? 0xeee8dc : 0xc8c0b0), 0xf2ecdc);
    for (const z of [26, 42]) {
      m.box(1.15, 0.14, z, 0.7, 0.2, 2, wood);
      if (!closed) for (const x of [1.25, 1.45, 1.65]) m.cylinder(x, 0.24, z + 2, 0.08, 4, (u) => (u < 0.4 ? 0xd09048 : 0xa8642e), 0xd8a058);
    }
  } else if (kind === 'smith') {
    // A tool rack hung with tongs, hammers and horseshoes, and a small anvil on a stump.
    m.box(0.2, 0.14, 50, 1.6, 0.04, 3, wood);
    if (!closed) {
      for (let i = 0; i < 7; i++) {
        const x = 0.3 + i * 0.22;
        if (i % 3 === 0) {
          m.box(x, 0.16, 32, 0.03, 0.02, 18, { top: P.iron, left: P.iron, right: P.iron });
          m.box(x - 0.04, 0.16, 30, 0.1, 0.02, 4, { top: P.ironLight, left: P.ironLight, right: P.iron });
        } else if (i % 3 === 1) {
          m.quad({ x: x - 0.06, y: 0.17, z: 48 }, { x: 0.14, y: 0, z: 0 }, { x: 0, y: 0, z: -10 }, (u, v) => {
            const d = Math.hypot(u - 0.5, (v - 0.45) * 1.2);
            return d < 0.45 && d > 0.28 && v < 0.85 ? (u < 0.4 ? P.ironLight : P.iron) : null;
          });
        } else {
          m.box(x, 0.16, 26, 0.03, 0.02, 22, { top: P.plank, left: P.plank, right: P.plankDark });
          m.box(x - 0.05, 0.15, 24, 0.13, 0.05, 5, { top: P.ironLight, left: P.iron, right: P.iron });
        }
      }
    }
    m.cylinder(1.55, 0.4, 0, 0.16, 12, (u) => (u < 0.4 ? P.barkLight : P.bark), 0xb08860);
    m.box(1.42, 0.33, 12, 0.26, 0.14, 6, { top: P.ironLight, left: P.iron, right: 0x3a3a44 });
  } else {
    // A rail along the back with hides thrown over it, and a bundle of rolled leather.
    m.box(0.12, 0.16, 46, 1.76, 0.05, 3, wood);
    if (!closed) {
      const hides = [0x8f5c38, 0xa07a54, 0x6e4228, 0x7a7480];
      hides.forEach((c, i) => {
        const x = 0.2 + i * 0.4;
        m.quad({ x, y: 0.2, z: 49 }, { x: 0.36, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }, (u, v) => {
          const edge = 0.75 + 0.2 * Math.sin(u * 11 + i) + 0.05 * Math.sin(u * 37);
          if (v > edge || u < 0.04 * Math.sin(v * 9) + 0.02) return null;
          const f = Math.sin(u * 14 + i) > 0.6 ? darken(c, 0.82) : c;
          return v < 0.08 ? darken(c, 0.7) : f;
        });
      });
    }
    for (const [x, y] of [[1.45, 0.42], [1.62, 0.4], [1.54, 0.56]]) m.cylinder(x, y, 0, 0.09, 14, (u) => (u < 0.4 ? P.leatherLight : P.leather), P.leatherDark);
  }
}

/** A sackcloth sheet over the bare counter, tied down with rope, for the night. */
function coverUp(m: IsoModel, z: number): void {
  const sack = 0xb8a47c;
  const rope = (u: number) => Math.abs(u - 0.22) < 0.02 || Math.abs(u - 0.78) < 0.02;
  m.box(0.1, 1.03, z, 1.8, 0.56, 7, {
    top: (u, v) => (rope(u) ? P.strawDark : hash(Math.floor(u * 40), Math.floor(v * 12)) < 0.15 ? darken(sack, 0.9) : sack),
    left: (u, v) => (rope(u) ? P.strawDark : v > 0.6 && Math.sin(u * 40) > 0.5 ? darken(sack, 0.75) : darken(sack, 0.85)),
    right: darken(sack, 0.7),
  });
}

/** A round loaf with a scored, glazed top. */
function loaf(m: IsoModel, x: number, y: number, z: number, r: number, crust = 0xb8702e): void {
  m.cylinder(x, y, z, r, 3, (u) => (u < 0.35 ? lighten(crust) : u > 0.7 ? darken(crust, 0.7) : crust), crust);
  m.cylinder(x, y, z + 3, r * 0.78, 2, (u) => (u < 0.4 ? lighten(crust) : crust), (u, v) => (Math.abs(u - v) < 0.08 || Math.abs(u + v - 1) < 0.08 ? 0xe8c890 : lighten(crust)));
}

/** What each trader sets out on the counter. */
function goods(m: IsoModel, kind: StallKind, z: number): void {
  if (kind === 'baker') {
    // A wicker basket of loaves, a long plait, a cheese with a wedge cut out, a pie, and a heap of rolls.
    m.box(0.16, 1.06, z, 0.62, 0.44, 5, {
      top: P.strawDark,
      left: (u, v) => ((Math.floor(u * 24) + Math.floor(v * 3)) % 2 ? P.strawDark : P.straw),
      right: (u, v) => ((Math.floor(u * 16) + Math.floor(v * 3)) % 2 ? darken(P.strawDark, 0.85) : P.strawDark),
    });
    for (const [x, y] of [[0.3, 1.18], [0.52, 1.2], [0.4, 1.36], [0.64, 1.38]]) loaf(m, x, y, z + 4, 0.11);
    for (let i = 0; i < 5; i++) m.cylinder(0.9 + i * 0.07, 1.2 + i * 0.03, z, 0.06, 4, (u) => (u < 0.4 ? 0xd8a058 : 0xa8642e), 0xd8a058);
    m.cylinder(1.3, 1.24, z, 0.19, 7, (u) => (u < 0.5 ? 0xf2d27a : 0xc89a30), (u, v) => (u > 0.5 && v > 0.5 && Math.abs(u - v) < 0.35 ? null : 0xfbe6a0));
    m.cylinder(1.68, 1.22, z, 0.15, 4, (u) => (u < 0.4 ? 0xd09048 : 0x7a4420), (u, v) => ((Math.floor(u * 6) + Math.floor(v * 6)) % 2 ? 0xe8b060 : 0xc88a40));
    for (const [x, y] of [[1.0, 1.44], [1.14, 1.48], [1.07, 1.38], [1.62, 1.48], [1.5, 1.5]]) loaf(m, x, y, z, 0.06, 0xc88038);
  } else if (kind === 'smith') {
    // Blades on a dark cloth, with brass-wired hilts; a helm, a stack of horseshoes, and a shield propped in front.
    m.quad({ x: 0.12, y: 1.06, z: z + 0.5 }, { x: 0.95, y: 0, z: 0 }, { x: 0, y: 0.5, z: 0 }, 0x3a3032);
    for (const x of [0.22, 0.44, 0.66, 0.88]) {
      m.box(x, 1.1, z + 1, 0.06, 0.32, 1, { top: (_u, v) => (v < 0.15 ? 0xe8e8f0 : P.ironLight), left: P.iron, right: P.iron });
      m.box(x - 0.04, 1.42, z + 1, 0.14, 0.03, 2, { top: P.gold, left: P.gold, right: darken(P.gold) });
      m.box(x, 1.45, z + 1, 0.06, 0.09, 2, { top: P.leather, left: P.leatherDark, right: P.leatherDark });
    }
    m.cylinder(1.3, 1.24, z, 0.16, 7, (u) => (u < 0.35 ? P.ironLight : P.iron), P.stoneLight);
    m.cylinder(1.3, 1.24, z + 7, 0.12, 3, (u) => (u < 0.35 ? P.ironLight : P.iron), P.ironLight);
    m.cylinder(1.3, 1.24, z, 0.22, 1, () => P.iron, P.ironLight);
    for (let i = 0; i < 4; i++) {
      m.quad({ x: 1.58, y: 1.14, z: z + i * 1.5 + 0.5 }, { x: 0.22, y: 0, z: 0 }, { x: 0, y: 0.2, z: 0 }, (u, v) => {
        const d = Math.hypot(u - 0.5, v - 0.55);
        return d < 0.48 && d > 0.3 && v < 0.9 ? (i === 3 ? P.ironLight : P.iron) : null;
      });
    }
    // A round shield propped against the front of the counter: painted boards, an iron rim and a boss.
    m.quad({ x: 1.42, y: 1.7, z: 21 }, { x: 0.38, y: 0, z: 0 }, { x: 0, y: 0, z: -19 }, (u, v) => {
      const d = (u - 0.5) ** 2 + (v - 0.5) ** 2;
      if (d > 0.25) return null;
      if (d > 0.19) return u < 0.4 ? P.ironLight : P.iron;
      if (d < 0.012) return 0xe8e8f0;
      if (d < 0.025) return P.ironLight;
      return Math.abs(u - v) < 0.12 ? P.gold : Math.floor(v * 5) % 2 ? 0x2e4a7a : 0x3a5a8a;
    });
  } else {
    // Folded hides in a pile, a grey pelt draped over the end, belts in a coil, and a pair of boots.
    const hides = [0x8f5c38, 0x6e4228, 0xa07a54];
    hides.forEach((c, i) => m.box(0.2 + i * 0.05, 1.1 + i * 0.03, z + i * 3, 0.65, 0.38, 3, { top: (u) => (Math.sin(u * 20 + i) > 0.7 ? lighten(c) : c), left: darken(c), right: darken(c, 0.6) }));
    m.box(1.1, 1.05, z, 0.7, 0.5, 2, { top: (u, v) => (hash(Math.floor(u * 30), Math.floor(v * 10)) < 0.3 ? 0x8a8490 : 0x7a7480), left: 0x4b4652, right: 0x4b4652 });
    m.quad({ x: 1.1, y: 1.62, z }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0, z: -14 }, (u, v) => (v > 0.7 + 0.3 * Math.sin(u * 9) ? null : hash(Math.floor(u * 40), Math.floor(v * 10)) < 0.25 ? 0xa29ca6 : u < 0.3 ? 0x9a94a0 : 0x7a7480));
    m.cylinder(1.28, 1.22, z + 2, 0.1, 3, (u) => (u < 0.4 ? P.leatherLight : P.leather), (u, v) => (((u - 0.5) ** 2 + (v - 0.5) ** 2) % 0.06 < 0.02 ? P.leatherDark : P.leather));
    for (const x of [1.52, 1.66]) {
      m.box(x, 1.18, z + 2, 0.1, 0.24, 3, { top: P.leatherDark, left: P.leather, right: P.leatherDark });
      m.box(x, 1.18, z + 5, 0.1, 0.1, 9, { top: P.leatherDark, left: P.leatherLight, right: P.leather });
    }
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

/**
 * An iron lantern on a squared oak post: a rough stone footing, chamfered
 * timber, an iron cap, and a tapered lantern with a pyramid hood and a ring
 * on top. Lit after dark (see the map's lights).
 */
function lampPost(): IsoModel {
  const m = new IsoModel();
  // Footing: a couple of rough stones round the foot of the post.
  m.box(0.36, 0.36, 0, 0.28, 0.28, 5, { top: (u, v) => rubble(u * 20, v * 6 + 2, 40, 3), left: (u, v) => rubble(u * 18, v * 5 + 30, 36, 4), right: (u, v) => darken(rubble(u * 18, v * 5 + 30, 36, 5), 0.8) });
  // The post, with chamfered corners picked out light and dark.
  m.box(0.45, 0.45, 5, 0.1, 0.1, 39, {
    top: P.barkLight,
    left: (u, v) => (u < 0.15 ? P.barkLight : hash(Math.floor(u * 4), Math.floor(v * 14)) < 0.12 ? P.barkDark : P.bark),
    right: (u) => (u > 0.85 ? darken(P.barkDark, 0.8) : P.barkDark),
  });
  m.box(0.43, 0.43, 42, 0.14, 0.14, 2, { top: P.ironLight, left: P.iron, right: 0x3a3a44 });
  // The lantern: a frame of iron round panes of glowing glass, narrower at the foot.
  const pane = (lit: number): Shader => (u, v) => {
    const taper = v * 0.12;
    if (u < 0.12 + taper || u > 0.88 - taper || v < 0.1 || v > 0.9) return P.iron;
    if (Math.abs(u - 0.5) < 0.05) return 0x3a3a44;
    return v < 0.4 ? mix(lit, 0xfff4d0, 0.4) : lit;
  };
  m.box(0.38, 0.38, 44, 0.24, 0.24, 10, { top: P.iron, left: pane(P.glassLit), right: pane(P.fireOrange) });
  // A hood like a little pyramid, and a ring to lift it by.
  m.quad({ x: 0.36, y: 0.64, z: 54 }, { x: 0.28, y: 0, z: 0 }, { x: 0.14, y: -0.14, z: 6 }, (u, v) => (v > 1 - Math.abs(u - 0.5) * 2 ? null : u < 0.5 ? P.ironLight : P.iron));
  m.quad({ x: 0.64, y: 0.36, z: 54 }, { x: 0, y: 0.28, z: 0 }, { x: -0.14, y: 0.14, z: 6 }, (u, v) => (v > 1 - Math.abs(u - 0.5) * 2 ? null : 0x3a3a44));
  m.quad({ x: 0.5, y: 0.5, z: 64 }, { x: 0.06, y: -0.06, z: 0 }, { x: 0, y: 0, z: -4 }, (u, v) => (Math.hypot(u - 0.5, v - 0.5) > 0.5 || Math.hypot(u - 0.5, v - 0.5) < 0.28 ? null : P.iron));
  return m;
}

/** A sturdy bench along x, to sit on facing +y: two boards on splayed legs with a stretcher between them. */
function bench(): IsoModel {
  const m = new IsoModel();
  const leg = { top: P.plank, left: (u: number) => (u < 0.3 ? P.plankLight : P.plank), right: P.plankDark };
  m.box(0.16, 0.4, 0, 0.09, 0.08, 10, leg);
  m.box(0.75, 0.4, 0, 0.09, 0.08, 10, leg);
  m.box(0.2, 0.42, 4, 0.6, 0.04, 2, { top: P.plank, left: P.plankDark, right: P.plankDark });
  m.box(0.16, 0.57, 0, 0.09, 0.08, 10, leg);
  m.box(0.75, 0.57, 0, 0.09, 0.08, 10, leg);
  // Two seat boards, worn paler where people sit, with a gap between them.
  const seat = (shift: number): Shader => (u, v) => {
    const grain = Math.sin(u * 60 + v * 3 + shift) * Math.sin(u * 23 + shift);
    const worn = Math.abs(u - 0.3) < 0.12 || Math.abs(u - 0.72) < 0.12;
    if (grain > 0.85) return P.plankDark;
    return worn ? mix(P.plankLight, 0xc8a078, 0.3) : P.plankLight;
  };
  m.box(0.08, 0.35, 10, 0.84, 0.17, 3, { top: seat(0), left: P.plank, right: P.plankDark });
  m.box(0.08, 0.53, 10, 0.84, 0.17, 3, { top: seat(2), left: (u) => (u < 0.02 || u > 0.98 ? P.plankDark : P.plank), right: P.plankDark });
  return m;
}

/** A pile of wooden crates: slatted, cross-braced and nailed, one with its lid off and straw spilling out. */
function crates(): IsoModel {
  const m = new IsoModel();
  const face = (seed: number, dim = 1): Shader => (u, v) => {
    // Frame boards round the edge, a diagonal brace, nail heads at the corners.
    if ((u < 0.12 || u > 0.88) && (v < 0.12 || v > 0.88)) return (u * 20) % 2 < 1 && (v * 20) % 2 < 1 ? P.iron : darken(P.plankLight, dim);
    if (u < 0.13 || u > 0.87 || v < 0.13 || v > 0.87) return darken(u < 0.03 || v < 0.03 ? 0xb08858 : P.plankLight, dim);
    if (Math.abs(u - v) < 0.09) return darken(Math.abs(u - v) < 0.03 ? P.plankLight : 0x9a7048, dim);
    const slat = (v * 3) % 1 < 0.1;
    if (slat) return darken(0x3a2416, dim);
    return darken(hash(Math.floor(u * 6), Math.floor(v * 3) + seed) < 0.3 ? 0x5a3c26 : P.plankDark, dim);
  };
  const top: Shader = (u, v) => (u < 0.1 || u > 0.9 || v < 0.1 || v > 0.9 ? P.plankLight : (v * 3) % 1 < 0.1 ? P.plankDark : P.plank);
  const crate = (x: number, y: number, z: number, s: number, seed: number, open = false) =>
    m.box(x, y, z, s, s, s * 30, {
      top: open ? (u, v) => (u < 0.1 || u > 0.9 || v < 0.1 || v > 0.9 ? P.plankLight : hash(Math.floor(u * 20), Math.floor(v * 20)) < 0.5 ? P.straw : P.strawDark) : top,
      left: face(seed),
      right: face(seed + 1, 0.75),
    });
  crate(0.1, 0.15, 0, 0.55, 1);
  crate(0.45, 0.5, 0, 0.45, 3, true);
  // Straw poking up out of the open crate.
  m.quad({ x: 0.5, y: 0.75, z: 13.5 }, { x: 0.36, y: 0, z: 0 }, { x: 0, y: 0, z: 4 }, (u, v) => (v > hash(Math.floor(u * 16), 4) ? null : P.straw));
  crate(0.18, 0.22, 16.5, 0.42, 5);
  return m;
}

/** A signpost: a round post with a cap, and arrow-shaped arms with their letters carved in. */
function signpost(): IsoModel {
  const m = new IsoModel();
  m.box(0.4, 0.4, 0, 0.2, 0.2, 3, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.cylinder(0.5, 0.5, 0, 0.055, 52, (u, v) => (hash(Math.floor(u * 6), Math.floor(v * 16)) < 0.12 ? P.barkDark : u < 0.3 ? P.barkLight : u > 0.7 ? P.barkDark : P.bark), P.barkLight);
  m.cylinder(0.5, 0.5, 52, 0.075, 3, (u) => (u < 0.4 ? P.plankLight : P.plank), P.plankLight);
  // An arm: a board with a pointed end, carved letters, and a darker edge.
  const arm = (pointAt: 'start' | 'end'): Shader => (u, v) => {
    const tip = pointAt === 'start' ? u : 1 - u;
    if (tip < 0.16 && Math.abs(v - 0.5) > tip / 0.16 * 0.5) return null;
    if (v < 0.14 || v > 0.86) return P.plankDark;
    const carved = (u * 9) % 1 < 0.55 && v > 0.38 && v < 0.62 && tip > 0.22 && tip < 0.92 && hash(Math.floor(u * 9), 2) > 0.2;
    if (carved) return P.ink;
    return (Math.sin(u * 50 + v * 4) > 0.9) ? P.plank : P.plankLight;
  };
  // One arm along -x (towards the market) and one along +y.
  m.quad({ x: -0.05, y: 0.48, z: 47 }, { x: 0.55, y: 0, z: 0 }, { x: 0, y: 0, z: -10 }, arm('start'));
  m.quad({ x: 0.56, y: 0.5, z: 37 }, { x: 0, y: 0.6, z: 0 }, { x: 0, y: 0, z: -10 }, arm('end'));
  return m;
}

/** A wheel standing upright in the plane y = const: iron tyre, felloes, spokes and a hub. */
function wheel(m: IsoModel, cx: number, y: number, r: number, dim = 1): void {
  const rz = r * 36;
  m.quad({ x: cx - r, y, z: rz * 2 }, { x: r * 2, y: 0, z: 0 }, { x: 0, y: 0, z: -rz * 2 }, (u, v) => {
    const dx = u * 2 - 1;
    const dy = v * 2 - 1;
    const d = Math.hypot(dx, dy);
    if (d > 1) return null;
    if (d > 0.9) return darken(dy < -0.3 ? P.ironLight : P.iron, dim);
    if (d > 0.74) return darken(d > 0.86 ? P.plankDark : dy < 0 ? 0xb08858 : P.plankLight, dim);
    if (d < 0.18) return darken(d < 0.08 ? P.iron : P.plankDark, dim);
    const a = Math.atan2(dy, dx) * 6 / Math.PI;
    if (Math.abs(a - Math.round(a)) < 0.1 / Math.max(d, 0.3)) return darken(dx < 0 ? 0xb08858 : P.plankLight, dim);
    return null;
  });
}

/** Loose straw: streaky gold, paler on top. */
const straw: Shader = (u, v) => {
  const n = hash(Math.floor(u * 50), Math.floor(v * 14));
  return n < 0.25 ? P.strawDark : n > 0.85 ? P.strawLight : P.straw;
};

/**
 * A hay cart along x, its shafts resting on the ground at the -x end: a plank
 * bed with slatted sides on two big spoked wheels, piled high with hay.
 */
function hayCart(): IsoModel {
  const m = new IsoModel();
  wheel(m, 1.2, 0.12, 0.36, 0.75);
  // Shafts down to the ground.
  for (const y of [0.3, 0.66]) {
    m.quad({ x: 0.02, y, z: 1 }, { x: 0.48, y: 0, z: 14 }, { x: 0, y: 0.05, z: 0 }, P.plankLight);
    m.quad({ x: 0.02, y: y + 0.05, z: 1 }, { x: 0.48, y: 0, z: 14 }, { x: 0, y: 0, z: -2 }, P.plankDark);
  }
  // The bed, and its slatted sides.
  m.box(0.45, 0.18, 12, 1.5, 0.64, 4, { top: planks(4, P.plank, P.plankDark, P.plankLight), left: P.plank, right: P.plankDark });
  const slats = (dim: number): Shader => (u, v) => ((v * 3) % 1 < 0.35 || u < 0.03 || u > 0.97 || Math.abs(u - 0.5) < 0.02 ? darken(P.plank, dim) : null);
  // Hay heaped up in the bed: a few layers, each smaller, ragged at the edges.
  const heap = [[0.5, 0.2, 16, 1.4, 0.6, 7], [0.58, 0.24, 23, 1.24, 0.52, 6], [0.7, 0.3, 29, 1.0, 0.42, 5], [0.86, 0.36, 34, 0.7, 0.3, 4]];
  for (const [x, y, z, sx, sy, sz] of heap) {
    m.box(x, y, z, sx, sy, sz, {
      top: straw,
      left: (u, v) => (v > 0.7 + 0.3 * hash(Math.floor(u * 40), 1) ? null : straw(u, v + 0.5)),
      right: (u, v) => (v > 0.7 + 0.3 * hash(Math.floor(u * 30), 2) ? null : darken(straw(u, v) ?? P.straw, 0.8)),
    });
  }
  // The near side's slats, with wisps of hay poking through and hanging over.
  m.quad({ x: 0.45, y: 0.82, z: 26 }, { x: 1.5, y: 0, z: 0 }, { x: 0, y: 0, z: -10 }, slats(1));
  m.quad({ x: 1.95, y: 0.18, z: 26 }, { x: 0, y: 0.64, z: 0 }, { x: 0, y: 0, z: -10 }, slats(0.75));
  m.quad({ x: 0.5, y: 0.83, z: 24 }, { x: 1.4, y: 0, z: 0 }, { x: 0, y: 0, z: -8 }, (u, v) => (v > hash(Math.floor(u * 40), 7) * 0.9 ? null : straw(u, v)));
  wheel(m, 1.2, 0.86, 0.36);
  // A pitchfork leaning on the back of the cart.
  m.quad({ x: 1.98, y: 0.5, z: 0 }, { x: 0.02, y: 0, z: 40 }, { x: 0.02, y: 0, z: 0 }, P.plankLight);
  m.quad({ x: 1.96, y: 0.46, z: 40 }, { x: 0.06, y: 0.08, z: 0 }, { x: 0, y: 0, z: 8 }, (u) => (Math.floor(u * 5) % 2 ? null : P.iron));
  return m;
}

/** A stone horse trough along x, brimming with water, moss on its foot and a bucket at one end. */
function trough(): IsoModel {
  const m = new IsoModel();
  m.box(0.12, 0.28, 0, 1.76, 0.48, 13, {
    top: (u, v) => {
      if (u < 0.05 || u > 0.95 || v < 0.16 || v > 0.84) return u < 0.5 ? P.stoneLight : P.stone;
      // Water: dark with the sky caught in it, and a few ripples.
      const ripple = Math.sin(u * 60 + v * 8) > 0.92;
      return ripple ? 0x8ab4d0 : v < 0.4 ? P.waterLight : P.water;
    },
    left: (u, v) => rubble(u * 110, v * 13 + 26, 39, 21),
    right: (u, v) => darken(rubble(u * 30, v * 13 + 26, 39, 22), 0.78),
  });
  m.cylinder(1.88, 0.92, 0, 0.1, 9, (u, v) => (Math.abs(v - 0.3) < 0.1 ? P.iron : u < 0.4 ? P.plankLight : u > 0.7 ? P.plankDark : P.plank), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.38 ? P.water : P.plank));
  return m;
}

/** What's pegged out on the washing line: where along it (0..1), how wide, what colour, and what it is. */
const WASHING: Array<[number, number, number, 'shirt' | 'sheet' | 'hose' | 'apron']> = [
  [0.06, 0.16, 0xeae4d4, 'shirt'],
  [0.26, 0.28, 0xd8d0c0, 'sheet'],
  [0.58, 0.07, 0x6a4a7a, 'hose'],
  [0.67, 0.07, 0x6a4a7a, 'hose'],
  [0.78, 0.15, 0x8a5a3a, 'apron'],
];

/**
 * A washing line along y between two posts, sagging under the day's washing:
 * a shirt, a sheet, a pair of hose and an apron, pegged out to dry.
 */
function washingLine(): IsoModel {
  const m = new IsoModel();
  const y0 = 0.2;
  const y1 = 2.8;
  const top = 46;
  const lineZ = (t: number) => top - 2 - 7 * Math.sin(Math.PI * t);
  const post = { top: P.barkLight, left: P.bark, right: P.barkDark };
  m.box(0.46, y0 - 0.04, 0, 0.08, 0.08, top, post);
  // The line: a thin rope sagging between the posts.
  const segs = 12;
  for (let i = 0; i < segs; i++) {
    const ta = i / segs;
    const tb = (i + 1) / segs;
    m.quad({ x: 0.5, y: y0 + (y1 - y0) * ta, z: lineZ(ta) }, { x: 0, y: (y1 - y0) / segs, z: lineZ(tb) - lineZ(ta) }, { x: 0, y: 0, z: -1 }, P.linen);
  }
  for (const [at, w, colour, kind] of WASHING) {
    const za = lineZ(at);
    const zb = lineZ(at + w);
    const drop = kind === 'sheet' ? 26 : kind === 'shirt' ? 18 : kind === 'hose' ? 20 : 16;
    m.quad({ x: 0.5, y: y0 + (y1 - y0) * at, z: za }, { x: 0, y: (y1 - y0) * w, z: zb - za }, { x: 0, y: 0, z: -drop }, (u, v) => {
      let c = colour;
      if (kind === 'shirt') {
        // Sleeves hanging at the sides, a body down the middle, and a collar.
        const body = u > 0.25 && u < 0.75;
        if (!body && v > 0.45) return null;
        if (v > 0.95 - 0.05 * Math.sin(u * 20)) return null;
        if (body && v < 0.1 && Math.abs(u - 0.5) < 0.08) c = darken(colour, 0.8);
      } else if (kind === 'sheet') {
        if (v > 0.92 + 0.08 * Math.sin(u * 9)) return null;
        // A stripe woven along the edge, and folds where it hangs.
        if (v > 0.8 && v < 0.85) c = 0x6a7ad0;
      } else if (kind === 'hose') {
        if (u < 0.15 || u > 0.85 || v > 0.96) return null;
        if (v > 0.85) c = darken(colour, 0.7);
      } else {
        if (v > 0.9 || (v > 0.6 && (u < 0.1 || u > 0.9))) return null;
        if (v < 0.1) c = darken(colour, 0.8);
      }
      const fold = Math.sin(u * Math.PI * 6);
      c = fold > 0.75 ? lighten(c) : fold < -0.75 ? darken(c, 0.85) : c;
      // Clothes pegs along the top.
      if (v < 0.06 && (u < 0.1 || u > 0.9)) return P.plankLight;
      return darken(c, 0.88);
    });
  }
  m.box(0.46, y1 - 0.04, 0, 0.08, 0.08, top, post);
  return m;
}

/** Grain sacks leaning together, one tied and one slumped open, and a basket of apples. */
function sacks(): IsoModel {
  const m = new IsoModel();
  const sack = 0xc8b48c;
  const side = (u: number, v: number) => {
    const c = u < 0.35 ? lighten(sack) : u > 0.7 ? darken(sack, 0.72) : sack;
    return Math.sin(u * 30 + v * 5) > 0.85 ? darken(c, 0.9) : c;
  };
  m.cylinder(0.32, 0.3, 0, 0.17, 16, side, sack);
  m.cylinder(0.32, 0.3, 16, 0.09, 4, side, darken(sack, 0.85));
  m.cylinder(0.32, 0.3, 17, 0.1, 1, () => P.strawDark, P.strawDark);
  m.cylinder(0.62, 0.36, 0, 0.18, 12, side, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.32 ? 0xe8dcb8 : sack));
  // A basket of red apples in front.
  m.cylinder(0.45, 0.7, 0, 0.17, 7, (u, v) => ((Math.floor(u * 18) + Math.floor(v * 3)) % 2 ? P.strawDark : P.straw), P.strawDark);
  for (const [x, y] of [[0.4, 0.66], [0.5, 0.64], [0.45, 0.74], [0.54, 0.72], [0.37, 0.75]]) {
    m.cylinder(x, y, 7, 0.045, 2.5, (u) => (u < 0.4 ? 0xe86a5a : 0xa8302a), (u, v) => (u + v < 0.7 ? 0xf2a090 : 0xc8434a));
  }
  return m;
}

/** Where the road runs, in grid space: the middle of it in y at column x (as in MarketMap's roadMiddle). */
function roadLine(x: number): number {
  if (x >= 22) {
    const t = Math.min(1, (x - 22) / (34 - 27));
    return 18 - 1.2 * Math.sin(Math.PI * t);
  }
  // On into the square, carrying on the way it was heading and bending towards the well as it fades.
  const d = x - 22;
  return 18 - 0.54 * d - 0.2 * d * d;
}

/** Puddles lying in the ruts: where (x along the road), which rut, and how long. */
const PUDDLES: Array<[number, number, number]> = [[23.4, -1, 0.42], [25.9, 1, 0.5], [29.8, -1, 0.38], [32.2, 1, 0.34]];

/**
 * Cart ruts worn into the road and on into the square: two grooves the width
 * of an axle apart, with a ridge thrown up beside each and puddles lying in
 * them, fading out as the road opens into the square. Painted flat into the
 * ground; placed at the map's corner, as it is drawn in map coordinates.
 */
function ruts(): IsoModel {
  const m = new IsoModel();
  const x0 = 16;
  const x1 = 34.5;
  const ya = 11;
  const yb = 21;
  m.quad({ x: x0, y: ya, z: 0 }, { x: x1 - x0, y: 0, z: 0 }, { x: 0, y: yb - ya, z: 0 }, (u, v) => {
    const gx = x0 + u * (x1 - x0);
    const gy = ya + v * (yb - ya);
    // Wobble the line a little so the ruts don't look ruled.
    const mid = roadLine(gx) + 0.05 * Math.sin(gx * 2.3);
    const fade = gx < 19 ? 0 : gx < 21.5 ? (gx - 19) / 2.5 : 1;
    for (const side of [-1, 1]) {
      const d = gy - (mid + side * 0.3);
      for (const [px, ps, len] of PUDDLES) {
        if (ps !== side) continue;
        const e = ((gx - px) / len) ** 2 + (d / (0.15 + 0.03 * Math.sin(gx * 9))) ** 2;
        if (e < 1) return e < 0.15 && d < 0 ? 0x9ab4c4 : e > 0.7 ? 0x4a5458 : 0x5a6e7c;
        if (e < 1.4) return P.dirtDark;
      }
      if (hash(Math.floor(gx * 30), Math.floor(gy * 30)) > fade) continue;
      if (Math.abs(d) < 0.045) return hash(Math.floor(gx * 40), side + 3) < 0.3 ? 0x523820 : P.dirtDark;
      if (d > 0.045 && d < 0.075) return P.dirtLight;
    }
    return null;
  });
  return m;
}

/**
 * A strip of cobbles laid along the front of a house, 3 tiles long and a tile
 * deep, close-set against the wall and breaking up raggedly towards the square.
 */
function cobbles(): IsoModel {
  const m = new IsoModel();
  const cell = 0.17;
  const seed = (i: number, j: number) => ({ x: (i + 0.2 + hash(i, j + 50) * 0.6) * cell, y: (j + 0.2 + hash(j + 70, i) * 0.6) * cell });
  m.quad({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const gx = u * 3;
    const gy = v;
    const ci = Math.floor(gx / cell);
    const cj = Math.floor(gy / cell);
    let d1 = Infinity;
    let d2 = Infinity;
    let best = { i: 0, j: 0, x: 0, y: 0 };
    for (let j = cj - 1; j <= cj + 1; j++) {
      for (let i = ci - 1; i <= ci + 1; i++) {
        const s = seed(i, j);
        const d = Math.hypot(gx - s.x, gy - s.y);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          best = { i, j, ...s };
        } else if (d < d2) d2 = d;
      }
    }
    // Ragged towards the front, and thinning at the ends.
    const edge = 0.55 + 0.2 * Math.sin(best.x * 3.1) + 0.1 * Math.sin(best.x * 7.3);
    const ends = Math.min(best.x, 3 - best.x);
    if (best.y > edge || ends < 0.05) return null;
    if (best.y > edge - 0.2 && hash(best.i + 3, best.j + 9) < 0.4) return null;
    if (d2 - d1 < 0.03) return hash(Math.floor(gx * 40), Math.floor(gy * 40)) < 0.3 ? P.moss : P.dirtDark;
    let c = FIELDSTONE[Math.floor(hash(best.i, best.j + 5) * FIELDSTONE.length)];
    const dx = gx - best.x;
    const dy = gy - best.y;
    if (d2 - d1 < 0.06) c = dx + dy < 0 ? mix(c, 0xdcdae2, 0.35) : darken(c, 0.7);
    return c;
  });
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
  put('mkt-haycart', hayCart());
  put('mkt-trough', trough());
  put('mkt-washing', washingLine());
  put('mkt-sacks', sacks());
  put('mkt-ruts', ruts(), false);
  put('mkt-cobbles', cobbles(), false);
}
