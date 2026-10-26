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
 */
function stall(kind: StallKind): IsoModel {
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
  goods(m, kind, counterTop);
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

/** The village well: a round stone wall, a little shingled roof on two posts, and a bucket. */
function well(): IsoModel {
  const m = new IsoModel();
  const stones: Shader = (u, v) => {
    const row = Math.floor(v * 3);
    const brick = Math.floor(u * 14 + row * 0.5);
    if ((v * 3) % 1 < 0.14 || (u * 14 + row * 0.5) % 1 < 0.06) return P.mortar;
    return hash(brick, row) < 0.3 ? P.stoneDark : u < 0.35 ? P.stoneLight : P.stone;
  };
  m.box(0.95, 0.35, 0, 0.1, 0.1, 54, { top: P.barkLight, left: P.bark, right: P.barkDark });
  m.cylinder(1, 1, 0, 0.72, 20, stones, (u, v) => {
    const d = (u - 0.5) ** 2 + (v - 0.5) ** 2;
    return d < 0.16 ? (d < 0.12 ? P.waterDeep : P.mortar) : P.stoneLight;
  });
  // Crossbar with the rope and bucket.
  m.box(0.95, 0.35, 46, 0.1, 1.3, 4, { top: P.barkLight, left: P.bark, right: P.barkDark });
  m.box(0.99, 0.99, 24, 0.02, 0.02, 22, { top: P.linenDark, left: P.linen, right: P.linenDark });
  m.cylinder(1, 1, 18, 0.12, 8, (u, v) => (v < 0.2 ? P.iron : u < 0.4 ? P.plankLight : P.plank), P.plank);
  m.box(0.95, 1.55, 0, 0.1, 0.1, 54, { top: P.barkLight, left: P.bark, right: P.barkDark });
  // A little gabled roof of wooden shingles.
  const shingles: Shader = (u, v) => ((v * 5) % 1 < 0.2 || (u * 6 + Math.floor(v * 5) * 0.5) % 1 < 0.08 ? P.barkDark : P.plank);
  m.quad({ x: 0.45, y: 0.2, z: 54 }, { x: 0.55, y: 0, z: 16 }, { x: 0, y: 1.6, z: 0 }, (u, v) => darken(shingles(u, v) ?? P.plank));
  m.quad({ x: 1.0, y: 0.2, z: 70 }, { x: 0.55, y: 0, z: -16 }, { x: 0, y: 1.6, z: 0 }, shingles);
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

function lighten(c: number): number {
  const ch = (shift: number) => Math.min(255, Math.round(((c >> shift) & 0xff) * 1.2)) << shift;
  return ch(16) | ch(8) | ch(0);
}

export interface TownhouseStyle {
  roof: number;
  plaster: number;
  /**
   * Which face the door is on: the front (+y), the side (+x), or 'back' for
   * houses whose door is on a face the camera can't see (a house on the near
   * side of the square, facing into it, shows only its back walls).
   */
  door: 'front' | 'side' | 'back';
  /** A hanging sign over the door (an inn, a shop). */
  sign?: number;
}

/**
 * A two-storey townhouse on a 3x3 footprint: a stone ground floor, timber
 * framing over whitewashed plaster above, and a steep clay-tiled roof with a
 * chimney. Seen from the square, with its door on the front or side.
 */
function townhouse(style: TownhouseStyle): IsoModel {
  const m = new IsoModel();
  const S = 3;
  const H = 84;
  const R = 44;
  const o = 0.28;
  const roof = tileRoof(style.roof);
  const wall = (windows: Array<[number, number]>, door: [number, number] | null, shade: boolean): Shader => (u, v) => {
    const x = u * S * 32;
    const y = v * H;
    const f = (c: number) => (shade ? darken(c, 0.8) : c);
    // Stone plinth and ground floor.
    if (y > H - 34) {
      if (door && u > door[0] && u < door[1] && y > H - 30) {
        const du = (u - door[0]) / (door[1] - door[0]);
        if (du < 0.1 || du > 0.9 || y < H - 28) return f(P.barkDark);
        if (Math.abs(du - 0.5) < 0.04) return f(P.leatherDark);
        if (Math.abs(du - 0.75) < 0.05 && Math.abs(y - (H - 14)) < 2) return P.gold;
        return f(P.leather);
      }
      for (const [a, b] of windows) {
        if (u > a && u < b && y > H - 26 && y < H - 12) {
          const wu = (u - a) / (b - a);
          if (wu < 0.14 || wu > 0.86 || y < H - 24 || y > H - 14) return f(P.barkDark);
          return Math.abs(wu - 0.5) < 0.07 ? P.bark : P.glassLit;
        }
      }
      const row = Math.floor(y / 6);
      const brick = Math.floor(x / 9 + (row % 2) * 0.5);
      if (y % 6 < 1 || (x / 9 + (row % 2) * 0.5) % 1 < 0.08) return f(P.mortar);
      return f(hash(brick, row) < 0.3 ? P.stoneDark : hash(brick, row) > 0.8 ? P.stoneLight : P.stone);
    }
    // Jetty beam between the floors.
    if (y > H - 38) return f(y < H - 36 ? P.barkLight : P.barkDark);
    // Upper floor: timber frame and plaster, with windows.
    for (const [a, b] of windows) {
      if (u > a && u < b && y > 12 && y < 36) {
        const wu = (u - a) / (b - a);
        if (wu < 0.14 || wu > 0.86 || y < 14 || y > 34) return f(P.barkDark);
        if (Math.abs(wu - 0.5) < 0.07 || Math.abs(y - 24) < 1) return P.bark;
        return y < 24 ? P.glassLit : P.fireOrange;
      }
    }
    const beam = u < 0.025 || u > 0.975 || y < 3 || Math.abs(u - 0.5) < 0.02;
    if (beam) return f(P.bark);
    // Diagonal braces in each bay.
    const bay = (u * 2) % 1;
    const t = y / (H - 38);
    if (Math.abs(bay - t) < 0.035 || Math.abs(bay - (1 - t)) < 0.035) return f(P.barkDark);
    const n = hash(Math.floor(x / 3), Math.floor(y / 3));
    return f(n < 0.1 ? darken(style.plaster, 0.92) : style.plaster);
  };

  const front = style.door === 'front';
  // Back roof slope, then the chimney through it.
  m.quad({ x: -o, y: S / 2, z: H + R }, { x: S + o, y: 0, z: 0 }, { x: 0, y: -S / 2 - o, z: -R - 8 }, roof);
  m.box(0.4, 0.5, H, 0.45, 0.45, R + 22, {
    top: P.soot,
    left: (u, v) => ((v * 8) % 1 < 0.15 || (u * 3 + Math.floor(v * 8) * 0.5) % 1 < 0.1 ? P.mortar : P.stone),
    right: (_u, v) => ((v * 8) % 1 < 0.15 ? P.mortar : P.stoneDark),
  });
  m.quad({ x: 0, y: S, z: H }, { x: S, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, wall([[0.12, 0.3], [0.7, 0.88]], front ? [0.4, 0.6] : null, false));
  m.quad({ x: S, y: 0, z: H }, { x: 0, y: S, z: 0 }, { x: 0, y: 0, z: -H }, wall([[0.15, 0.33], [0.67, 0.85]], style.door === 'side' ? [0.4, 0.6] : null, true));
  // Gable over the side, plastered and framed like the upper floor.
  m.quad({ x: S, y: 0, z: H }, { x: 0, y: S, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => {
    if (v > 1 - Math.abs(u * 2 - 1)) return null;
    if (v < 0.06 || Math.abs(u - 0.5) < 0.02) return P.barkDark;
    if (Math.abs(u - 0.5) < 0.08 && v > 0.3 && v < 0.55) return P.ink;
    return darken(style.plaster, 0.8);
  });
  m.quad({ x: S, y: S / 2, z: H + R }, { x: o, y: 0, z: 0 }, { x: 0, y: -S / 2 - o, z: -R - 8 }, darken(style.roof, 0.6));
  m.quad({ x: -o, y: S / 2, z: H + R }, { x: S + o * 2, y: 0, z: 0 }, { x: 0, y: S / 2 + o, z: -R - 8 }, roof);
  m.box(-o, S / 2 - 0.06, H + R - 2, S + o * 2, 0.12, 4, { top: lighten(style.roof), left: darken(style.roof, 0.7), right: darken(style.roof, 0.7) });
  if (style.sign !== undefined) {
    // A bracket and a painted board hanging over the door.
    const sx = front ? 1.5 : S;
    const sy = front ? S : 1.5;
    if (front) {
      m.box(sx + 0.2, sy, H - 30, 0.05, 0.5, 2, { top: P.iron, left: P.iron, right: P.iron });
      m.quad({ x: sx + 0.2, y: sy + 0.15, z: H - 32 }, { x: 0, y: 0.35, z: 0 }, { x: 0, y: 0, z: -14 }, (u, v) => (u < 0.08 || u > 0.92 || v < 0.1 || v > 0.9 ? P.barkDark : style.sign!));
    } else {
      m.box(sx, sy + 0.2, H - 30, 0.5, 0.05, 2, { top: P.iron, left: P.iron, right: P.iron });
      m.quad({ x: sx + 0.15, y: sy + 0.2, z: H - 32 }, { x: 0.35, y: 0, z: 0 }, { x: 0, y: 0, z: -14 }, (u, v) => (u < 0.08 || u > 0.92 || v < 0.1 || v > 0.9 ? P.barkDark : style.sign!));
    }
  }
  return m;
}

/** Height (pixels) and position of a townhouse's chimney top, relative to its corner, for the smoke. */
export const TOWNHOUSE_CHIMNEY = { gx: 0.62, gy: 0.72, z: 150 };

export const TOWNHOUSES: Record<string, TownhouseStyle> = {
  'bld-house-red': { roof: 0xa4583a, plaster: 0xe8dcc0, door: 'front' },
  'bld-house-slate': { roof: 0x5a5a6e, plaster: 0xdcd4c4, door: 'front' },
  'bld-house-ochre': { roof: 0x8a5a34, plaster: 0xe6cf98, door: 'front' },
  'bld-inn': { roof: 0x7a3a2e, plaster: 0xeee4cc, door: 'front', sign: P.gold },
  // Seen from behind: the houses along the near side of the square, facing into it.
  'bld-house-red-back': { roof: 0xa4583a, plaster: 0xe8dcc0, door: 'back' },
  'bld-house-slate-back': { roof: 0x5a5a6e, plaster: 0xdcd4c4, door: 'back' },
  'bld-house-ochre-back': { roof: 0x8a5a34, plaster: 0xe6cf98, door: 'back' },
};

export function generateMarket(scene: Phaser.Scene): void {
  const put = (key: string, model: IsoModel) => {
    const r = model.render();
    const tex = r.canvas.toTexture(scene, key);
    MODEL_ART[key] = { key, originX: r.anchorX / tex.width, originY: r.anchorY / tex.height };
  };
  for (const kind of Object.keys(AWNINGS) as StallKind[]) put(`mkt-stall-${kind}`, stall(kind));
  for (const [key, style] of Object.entries(TOWNHOUSES)) put(key, townhouse(style));
  put('mkt-well', well());
  put('mkt-lamp', lampPost());
  put('mkt-bench', bench());
  put('mkt-crates', crates());
  put('mkt-signpost', signpost());
}
