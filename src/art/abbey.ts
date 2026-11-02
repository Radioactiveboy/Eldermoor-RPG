import Phaser from 'phaser';
import { IsoModel, lipped, planks, Shader } from './IsoModel';
import { MODEL_ART } from './interior';
import { coping, ELDA, rubble, SLATE, slates } from './monastery';
import { PALETTE as P } from './palette';

/**
 * Saint Elda's within the walls: the stone ranges round the cloister (seen
 * over the wall from outside, and walked among inside), turrets and towers,
 * the cloister arcade, the herb garden with its moonpetal, the brothers'
 * graves, and the furnishings of the chapel, infirmary, scriptorium and
 * refectory, with their stone walls.
 *
 * Everything is an IsoModel registered in MODEL_ART, anchored at its back
 * grid corner, for maps to place. Long buildings are drawn along x with their
 * fronts to +y; mirrored (flipX) they run along y with their fronts to +x.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A step darker, for faces turned from the light. */
const SHADE: Record<number, number> = {
  [P.stoneLight]: P.stone,
  [P.stone]: P.stoneDark,
  [P.stoneDark]: P.mortar,
  [P.glassLit]: P.fireOrange,
  [P.plankLight]: P.plank,
  [P.plank]: P.plankDark,
  [P.logLight]: P.log,
  [P.log]: P.logDark,
  [SLATE.light]: SLATE.base,
  [SLATE.base]: SLATE.dark,
};
const shaded = (s: Shader): Shader => (u, v) => {
  const c = s(u, v);
  return c === null ? null : (SHADE[c] ?? c);
};

/** Dressed stone in neat courses: the brothers' newer building, paler and squarer than the old wall. */
function ashlar(width: number, height: number, seed: number, mossy = 0.03): Shader {
  return (u, v) => {
    const y = v * height;
    const row = Math.floor(y / 8);
    const x = u * width * 32 + (row % 2) * 7 + seed * 5;
    const col = Math.floor(x / 14);
    if (y % 8 < 1 || x % 14 < 1) return P.mortar;
    const n = hash(col + seed, row);
    if (v > 0.85 && n < mossy * 6) return P.moss;
    return n < 0.22 ? P.stone : n > 0.8 ? P.stoneLight : 0x8a8894;
  };
}

/** A pointed (lancet) arch: true inside it. dx is pixels from its middle, y pixels up from its foot. */
function lancet(dx: number, y: number, half: number, spring: number, top: number): boolean {
  if (Math.abs(dx) >= half || y < 0) return false;
  if (y < spring) return true;
  return ((Math.abs(dx) + half * 0.6) / (half * 1.6)) ** 2 + ((y - spring) / (top - spring)) ** 2 < 1;
}

/** Leaded glass in an arched window, lit warm from within, or stained in the Saint's colours. */
function glass(dx: number, y: number, stained: boolean): number {
  if (Math.abs(dx) < 0.6 || Math.round(y) % 6 === 0) return P.iron;
  if (!stained) return y % 12 < 6 ? P.glassLit : P.fireOrange;
  const n = hash(Math.floor(dx + 9), Math.floor(y / 6));
  return n < 0.3 ? ELDA.blue : n < 0.5 ? ELDA.blueLight : n < 0.7 ? P.flowerRed : n < 0.85 ? P.gold : P.glassLit;
}

/** An arched oak door with iron straps, for a pixel position on a wall (dx from its middle, y up from the ground). */
function oakDoor(dx: number, y: number, half: number, height: number): number | null {
  const ax = Math.abs(dx);
  const spring = height - half;
  const inArch = (h: number) => ax < h && (y < spring || ax ** 2 + (y - spring) ** 2 < h * h);
  if (!inArch(half + 2) || y < 0) return null;
  if (!inArch(half)) return P.stoneLight;
  if (ax < 0.6) return P.barkDark;
  if (Math.abs(y - 9) < 1.2 || Math.abs(y - height + 12) < 1.2) return P.iron;
  if (Math.abs(dx - 3) < 1 && Math.abs(y - 16) < 1.5) return P.gold;
  return Math.floor(dx + 40) % 4 === 0 ? P.plankDark : dx < 0 ? P.plankLight : P.plank;
}

// ---------------------------------------------------------------- buildings

interface HallLook {
  /** Length along x and depth along y, in tiles; height of the walls and the roof, in pixels. */
  L: number;
  D: number;
  H: number;
  R: number;
  seed: number;
  /** Which bay (tile along the front) has the door, if any. */
  door?: number;
  /** Where chimneys rise from the back of the roof (tiles along x). */
  chimneys?: number[];
  /** One tall storey of lancet windows (a chapel), rather than two of windows. */
  tall?: boolean;
  /** Stained glass in the tall windows. */
  stained?: boolean;
  /** A little bell-cote on the ridge. */
  bellcote?: boolean;
}

/**
 * A range of the monastery: stone walls under a steep slate roof, a gable at
 * the +x end, and windows in every bay of the front: small square ones below
 * and arched ones above, or one tall lancet a bay for a chapel. The door, if
 * any, is in the front, so the building is entered from +y.
 */
function hall(o: HallLook): IsoModel {
  const m = new IsoModel();
  const { L, D, H, R } = o;
  const ov = 0.25;
  const front = ashlar(L, H, o.seed);
  const frontFace: Shader = (u, v) => {
    const x = u * L * 32;
    const y = (1 - v) * H;
    const bay = Math.floor(x / 32);
    const dx = x - bay * 32 - 16;
    if (y < 5) return y < 2 ? P.stoneDark : P.stone;
    // Pilaster strips between bays, and a string course between the storeys.
    if (x % 32 < 2 && x > 1 && x < L * 32 - 1) return P.stoneLight;
    if (!o.tall && Math.abs(y - H * 0.48) < 1.5) return P.stoneLight;
    if (bay === o.door) {
      const d = oakDoor(dx, y - 4, 8, 34);
      if (d !== null) return d;
    } else if (o.tall) {
      if (lancet(dx, y - 16, 6, H - 40, H - 22)) return lancet(dx, y - 16, 4.6, H - 40, H - 24) ? glass(dx, y, !!o.stained) : P.stoneLight;
    } else {
      if (Math.abs(dx) < 4.5 && y > 12 && y < 24) return Math.abs(dx) < 3.4 && y > 13 && y < 23 ? glass(dx, y, false) : P.stoneLight;
    }
    if (!o.tall) {
      const up = H * 0.48 + 6;
      if (lancet(dx, y - up, 5, 12, 20)) return lancet(dx, y - up, 3.6, 12, 18) ? glass(dx, y, false) : P.stoneLight;
    }
    return front(u, v);
  };
  // Back roof slope, then chimneys rising through it.
  m.quad({ x: -ov, y: D / 2, z: H + R }, { x: L + ov, y: 0, z: 0 }, { x: 0, y: -D / 2 - ov, z: -R - 6 }, slates());
  for (const cx of o.chimneys ?? []) {
    m.box(cx, D * 0.22, H, 0.5, 0.5, R * 0.6 + 26, { top: P.soot, left: ashlar(0.5, 40, o.seed + cx), right: shaded(ashlar(0.5, 40, o.seed + cx + 1)) });
    m.box(cx - 0.05, D * 0.22 - 0.05, H + R * 0.6 + 26, 0.6, 0.6, 4, coping);
  }
  m.quad({ x: 0, y: D, z: H }, { x: L, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, frontFace);
  // The +x end, in shade, with a window under the gable.
  const end = ashlar(D, H, o.seed + 3);
  m.quad({ x: L, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: -H }, shaded((u, v) => {
    const dx = (u - 0.5) * D * 32;
    const y = (1 - v) * H;
    if (lancet(dx, y - H * 0.45, 5, 14, 22)) return lancet(dx, y - H * 0.45, 3.6, 14, 20) ? glass(dx, y, !!o.stained) : P.stoneLight;
    return end(u, v);
  }));
  m.quad({ x: L, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => {
    if (v > 1 - Math.abs(u * 2 - 1)) return null;
    const r = Math.hypot((u - 0.5) * D * 32, (v - 0.35) * R);
    if (r < 5) return r > 3.6 ? P.stone : P.ink;
    return SHADE[end(u, v) ?? P.stone] ?? P.stoneDark;
  });
  m.quad({ x: L, y: D / 2, z: H + R }, { x: ov, y: 0, z: 0 }, { x: 0, y: -D / 2 - ov, z: -R - 6 }, SLATE.dark);
  m.quad({ x: -ov, y: D / 2, z: H + R }, { x: L + ov * 2, y: 0, z: 0 }, { x: 0, y: D / 2 + ov, z: -R - 6 }, slates());
  m.box(-ov, D / 2 - 0.06, H + R - 2, L + ov * 2, 0.12, 4, { top: SLATE.light, left: SLATE.dark, right: SLATE.dark });
  // A stone cross on the gable end.
  m.box(L - 0.05, D / 2 - 0.05, H + R, 0.1, 0.1, 14, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.box(L - 0.05, D / 2 - 0.25, H + R + 8, 0.1, 0.5, 3, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  if (o.bellcote) {
    const bx = L * 0.3;
    const z = H + R - 4;
    m.box(bx, D / 2 - 0.12, z, 0.12, 0.24, 22, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
    m.cylinder(bx + 0.32, D / 2, z + 6, 0.1, 10, (u) => (u < 0.35 ? P.goldLight : u > 0.75 ? 0x9a7430 : P.gold), P.gold);
    m.box(bx + 0.52, D / 2 - 0.12, z, 0.12, 0.24, 22, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
    m.box(bx - 0.04, D / 2 - 0.16, z + 22, 0.72, 0.32, 4, coping);
  }
  return m;
}

/** A round stair turret with a conical slate cap and a gilded finial. */
function turret(r: number, H: number, cap: number): IsoModel {
  const m = new IsoModel();
  const c = r + 0.05;
  const stone = rubble(r * 3, H, 71, 0.04);
  m.cylinder(c, c, 0, r, H, (u, v) => {
    const y = (1 - v) * H;
    // Arrow slits up the stair.
    if (Math.abs(u - 0.45) < 0.035 && [0.3, 0.55, 0.8].some((t) => Math.abs(y - H * t) < 5)) return P.ink;
    const col = stone(u, v);
    return u > 0.7 ? (SHADE[col ?? P.stone] ?? col) : u < 0.2 && col === P.stone ? P.stoneLight : col;
  }, P.stone);
  m.cylinder(c, c, H, r + 0.06, 3, (u) => (u < 0.25 ? P.stoneLight : u > 0.7 ? P.stoneDark : P.stone), P.stoneLight);
  const steps = Math.ceil(cap / 3);
  for (let i = 0; i < steps; i++) {
    const rr = (r + 0.08) * (1 - i / steps);
    m.cylinder(c, c, H + 3 + i * 3, Math.max(0.02, rr), 3, (u) => (u < 0.25 ? SLATE.light : u > 0.7 ? SLATE.dark : SLATE.base), SLATE.base);
  }
  m.box(c - 0.03, c - 0.03, H + 3 + cap, 0.06, 0.06, 10, { top: P.gold, left: P.gold, right: 0x9a7430 });
  return m;
}

/** A square tower on the precinct wall, battlemented, with arrow slits: two tiles square. */
function wallTower(H: number): IsoModel {
  const m = new IsoModel();
  const slit = (seed: number, len: number): Shader => {
    const stone = rubble(len, H, seed, 0.08);
    return (u, v) => {
      const y = (1 - v) * H;
      if (Math.abs(u - 0.5) < 0.03 && (Math.abs(y - H * 0.4) < 6 || Math.abs(y - H * 0.72) < 6)) return P.ink;
      return stone(u, v);
    };
  };
  m.box(0.15, 0.15, 0, 1.7, 1.7, H, { top: P.stone, left: slit(81, 1.7), right: shaded(slit(83, 1.7)) });
  m.box(0.08, 0.08, H, 1.84, 1.84, 6, { top: P.stoneDark, left: lipped(P.stone, P.stoneLight, 0.3), right: P.stoneDark });
  // Merlons round the top.
  for (let i = 0; i < 4; i++) {
    const t = 0.08 + i * 0.5;
    m.box(t, 0.08, H + 6, 0.3, 0.22, 9, coping);
    m.box(0.08, t, H + 6, 0.22, 0.3, 9, coping);
  }
  for (let i = 0; i < 4; i++) {
    const t = 0.08 + i * 0.5;
    m.box(1.7, t, H + 6, 0.22, 0.3, 9, coping);
    m.box(t, 1.7, H + 6, 0.3, 0.22, 9, coping);
  }
  // Saint Elda's banner from a pole on top.
  m.box(0.98, 0.98, H + 6, 0.05, 0.05, 40, { top: P.barkLight, left: P.bark, right: P.barkDark });
  m.quad({ x: 1.03, y: 1.0, z: H + 44 }, { x: 0.6, y: 0, z: -4 }, { x: 0, y: 0, z: -14 }, (u, v) => {
    if (u > 0.75 && Math.abs(v - 0.5) < (u - 0.75) * 2) return null;
    return v < 0.15 || v > 0.85 ? P.goldLight : u > 0.4 ? ELDA.blueDark : ELDA.blue;
  });
  return m;
}

/**
 * One tile of the cloister walk along x: a run of two pointed arches on slim
 * columns, open right through, under a little slate roof. Mirrored, it runs along y.
 */
function arcade(): IsoModel {
  const m = new IsoModel();
  const H = 40;
  const arches = (dark: boolean): Shader => (u, v) => {
    const x = u * 32;
    const y = (1 - v) * H;
    for (const c of [8, 24]) if (lancet(x - c, y - 4, 6, 20, 30)) return null;
    if (y < 4) return dark ? P.stoneDark : P.stone;
    if (y > H - 4) return dark ? P.stone : P.stoneLight;
    const col = Math.floor(y / 7) % 2 ? P.stoneLight : 0x8a8894;
    return dark ? (SHADE[col] ?? P.stoneDark) : col;
  };
  m.quad({ x: 0, y: 0.32, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, arches(true));
  // The walk's floor between the two arcades, flagged.
  m.quad({ x: 0, y: 0.32, z: 0.5 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0.36, z: 0 }, (u) => (Math.floor(u * 4) % 2 ? P.stone : P.stoneLight));
  m.quad({ x: 0, y: 0.68, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, arches(false));
  m.quad({ x: -0.02, y: 0.5, z: H + 12 }, { x: 1.04, y: 0, z: 0 }, { x: 0, y: -0.26, z: -12 }, SLATE.dark);
  m.quad({ x: -0.02, y: 0.5, z: H + 12 }, { x: 1.04, y: 0, z: 0 }, { x: 0, y: 0.26, z: -12 }, slates());
  return m;
}

/** A square pier where two runs of the cloister walk meet. */
function arcadeCorner(): IsoModel {
  const m = new IsoModel();
  m.box(0.28, 0.28, 0, 0.44, 0.44, 46, { top: P.stoneLight, left: ashlar(0.44, 46, 91), right: shaded(ashlar(0.44, 46, 92)) });
  m.box(0.22, 0.22, 46, 0.56, 0.56, 6, coping);
  m.cylinder(0.5, 0.5, 52, 0.14, 4, () => SLATE.base, SLATE.light);
  return m;
}

// ---------------------------------------------------------------- the garden

/** The kinds of herb in Brother Anselm's beds: leaf colours (dark, mid, light) and the flower. */
const HERBS = [
  { leaf: [0x56684e, 0x74866a, 0x96a888], flower: 0x8a6ab8 }, // lavender
  { leaf: [0x5e6e58, 0x82927a, 0xa8b6a0], flower: 0xb0a0d0 }, // sage
  { leaf: [0x2e4e34, 0x42683e, 0x5c8a4c], flower: 0x7a9ae0 }, // rosemary
  { leaf: [0x3a6030, 0x4e7a3a, 0x6e9a4c], flower: 0xf09a2a }, // marigold
];

/** A clump of herbs: a rounded bush of leaves dotted with flowers. */
function herbs(kind: number): IsoModel {
  const m = new IsoModel();
  const { leaf, flower } = HERBS[kind];
  const bush = (seed: number, dark: boolean): Shader => (u, v) => {
    const h = 1 - v;
    if (((u - 0.5) * 2) ** 2 + h ** 2 * 1.1 > 1) return null;
    const n = hash(Math.floor(u * 16) + seed, Math.floor(v * 10));
    if (n < 0.1) return null;
    if (h > 0.4 && n > 0.86) return flower;
    const i = n < 0.35 ? 0 : n < 0.75 ? 1 : 2;
    return leaf[Math.max(0, i - (dark ? 1 : 0))];
  };
  m.quad({ x: 0.5, y: 0.12, z: 18 }, { x: 0, y: 0.76, z: 0 }, { x: 0, y: 0, z: -18 }, bush(kind * 7 + 3, true));
  m.quad({ x: 0.12, y: 0.5, z: 18 }, { x: 0.76, y: 0, z: 0 }, { x: 0, y: 0, z: -18 }, bush(kind * 7, false));
  return m;
}

/**
 * Moonpetal: tall slender stems with pale, star-shaped flowers that shine
 * silver-blue, among long leaves. Picked, only the leaves and bare stems are left.
 */
function moonpetal(picked: boolean): IsoModel {
  const m = new IsoModel();
  const leaves: Shader = (u, v) => {
    const k = (u * 5) % 1;
    const h = 1 - v;
    if (Math.abs(k - 0.5) > 0.5 * (1 - h)) return null;
    return k < 0.45 ? 0x6a9a8a : 0x4a7a6a;
  };
  m.quad({ x: 0.15, y: 0.55, z: 10 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0, z: -10 }, leaves);
  const stems: Array<[number, number, number]> = [[0.3, 0.4, 26], [0.55, 0.35, 32], [0.7, 0.6, 22], [0.4, 0.68, 28], [0.62, 0.5, 18]];
  for (const [x, y, h] of stems) {
    const top = picked ? h * 0.45 : h;
    m.box(x, y, 0, 0.025, 0.025, top, { top: 0x5a8a6a, left: 0x5a8a6a, right: 0x3e6a52 });
    if (picked) continue;
    // The flower: a little five-pointed star of petals, white at the tips and blue at the heart.
    m.quad({ x: x - 0.09, y: y - 0.09, z: top + 1 }, { x: 0.2, y: 0, z: 0 }, { x: 0, y: 0.2, z: 0 }, (u, v) => {
      const dx = u - 0.5;
      const dy = v - 0.5;
      const r = Math.hypot(dx, dy);
      const petal = 0.22 + 0.28 * Math.abs(Math.cos(Math.atan2(dy, dx) * 2.5));
      if (r > petal) return null;
      return r < 0.12 ? 0x7ab8ff : r < 0.3 ? 0xc8e0ff : 0xf4f8ff;
    });
  }
  m.quad({ x: 0.5, y: 0.2, z: 12 }, { x: 0, y: 0.65, z: 0 }, { x: 0, y: 0, z: -12 }, (u, v) => {
    const c = leaves(u, v);
    return c === null ? null : 0x3e6a5a;
  });
  return m;
}

/** A brother's grave: a low mound and a weathered headstone (or a stone cross). */
function grave(cross: boolean, seed: number): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.2, y: 0.15, z: 1 }, { x: 0.6, y: 0, z: 0 }, { x: 0, y: 0.7, z: 0 }, (u, v) => {
    if (((u - 0.5) * 2) ** 2 + ((v - 0.5) * 2) ** 2 > 1) return null;
    return hash(Math.floor(u * 8) + seed, Math.floor(v * 10)) < 0.2 ? P.grassTip : u < 0.4 ? P.grassLight : P.grass;
  });
  const stone = rubble(0.4, 22, seed, 0.25);
  if (cross) {
    m.box(0.45, 0.2, 0, 0.1, 0.1, 26, { top: P.stoneLight, left: stone, right: P.stoneDark });
    m.box(0.33, 0.2, 16, 0.34, 0.1, 5, { top: P.stoneLight, left: stone, right: P.stoneDark });
  } else {
    m.box(0.3, 0.18, 0, 0.4, 0.1, 20, {
      top: P.stoneLight,
      left: (u, v) => {
        const h = (1 - v) * 20;
        if (h > 14 && ((u - 0.5) * 2) ** 2 + ((h - 14) / 6) ** 2 > 1) return null;
        if (Math.abs(h - 12) < 0.8 && u > 0.25 && u < 0.75 && (u * 20) % 1 < 0.6) return P.stoneDark;
        return stone(u, v);
      },
      right: P.stoneDark,
    });
  }
  return m;
}

// ---------------------------------------------------------------- indoors

/** Height of the rooms' stone walls, in pixels. */
export const ABBEY_WALL_HEIGHT = 100;

type StoneWallKind = 'plain' | 'window' | 'stained' | 'door' | 'niche' | 'books' | 'herbs' | 'cross' | 'board';

/** A stone inner wall, with a window, door, shelf of books or something else in it. */
function stoneWall(kind: StoneWallKind, index: number): Shader {
  const H = ABBEY_WALL_HEIGHT;
  const stone = ashlar(1, H, index * 3 + 1, 0);
  return (u, v) => {
    const x = u * 32;
    const y = (1 - v) * H; // up from the floor
    const dx = x - 16;
    if (y < 6) return y < 2 ? P.stoneDark : P.stone;
    if (y > H - 4) return P.stoneLight;
    if (kind === 'window' || kind === 'stained') {
      if (lancet(dx, y - 34, 8, 30, 50)) return lancet(dx, y - 34, 6.4, 30, 48) ? glass(dx, y, kind === 'stained') : P.stoneLight;
      if (Math.abs(dx) < 9 && y > 31 && y <= 34) return P.stoneLight;
    }
    if (kind === 'door') {
      const d = oakDoor(dx, y - 4, 10, 52);
      if (d !== null) return d;
    }
    if (kind === 'niche') {
      // An arched alcove with a candle burning in it.
      if (lancet(dx, y - 36, 7, 14, 24)) {
        if (Math.abs(dx) < 1 && y > 38 && y < 46) return P.flowerWhite;
        if (Math.abs(dx) < 1.2 && y >= 46 && y < 50) return y < 48 ? P.fireOrange : P.fireYellow;
        return lancet(dx, y - 36, 5.6, 14, 22) ? P.ink : P.stoneLight;
      }
    }
    if (kind === 'cross') {
      if ((Math.abs(dx) < 1.6 && y > 38 && y < 70) || (Math.abs(y - 61) < 1.6 && Math.abs(dx) < 8)) return dx > 0.5 ? 0x9a7430 : P.gold;
    }
    if (kind === 'board') {
      // A slate board in a wooden frame, chalked with the week's meals.
      if (Math.abs(dx) < 11 && y > 40 && y < 66) {
        if (Math.abs(dx) > 9.5 || y < 41.5 || y > 64.5) return P.plank;
        return (Math.floor(y) % 5 === 0 && Math.abs(dx) < 8 && hash(Math.floor(x), Math.floor(y)) < 0.7) ? P.linen : 0x2e3036;
      }
    }
    if (kind === 'books') {
      if (y > 20 && y < 76 && Math.abs(dx) < 14) {
        const shelf = Math.floor((y - 20) / 14);
        const ly = (y - 20) % 14;
        if (ly < 2 || Math.abs(dx) > 12.5) return P.plankDark;
        const book = Math.floor((x + shelf * 3) / 2.5);
        const n = hash(book, shelf + index * 5);
        if (ly > 2 + n * 5) {
          const cols = [0x7a2a2a, 0x2a4a6a, 0x3a5a2a, 0x6a4a2a, 0x8a6a3a, P.linen];
          return cols[Math.floor(n * cols.length)];
        }
        return P.ink;
      }
    }
    if (kind === 'herbs') {
      // Bunches of herbs hung upside down to dry from a pole.
      if (Math.abs(y - 74) < 1.2 && Math.abs(dx) < 14) return P.bark;
      for (const [i, c] of [-9, 0, 9].entries()) {
        const bx = dx - c;
        if (Math.abs(bx) < 0.6 && y > 66 && y < 74) return P.strawDark;
        if (y > 46 && y <= 66 && Math.abs(bx) < (66 - y) * 0.22 + 1 && hash(Math.floor(x), Math.floor(y)) < 0.7) {
          const herb = HERBS[i];
          return hash(Math.floor(x) + 1, Math.floor(y)) < 0.3 ? herb.flower : herb.leaf[1];
        }
      }
    }
    return stone(u, v);
  };
}

function makeStoneWall(scene: Phaser.Scene, key: string, side: 'back' | 'side', kind: StoneWallKind, index: number): void {
  const m = new IsoModel();
  const H = ABBEY_WALL_HEIGHT;
  const face = stoneWall(kind, index);
  const cap = 0.16;
  if (side === 'back') {
    m.quad({ x: 0, y: 0, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, face);
    m.quad({ x: 0, y: -cap, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: cap, z: 0 }, P.stoneLight);
  } else {
    m.quad({ x: 0, y: 0, z: H }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -H }, shaded(face));
    m.quad({ x: -cap, y: 0, z: H }, { x: cap, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, P.stoneLight);
  }
  put(scene, key, m, false);
}

/** The stone altar: a white cloth with a gold hem, a gilt cross and two candles burning. */
function altar(): IsoModel {
  const m = new IsoModel();
  m.box(0.1, 0.1, 0, 1.8, 0.7, 4, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.box(0.2, 0.2, 4, 1.6, 0.5, 24, {
    top: P.flowerWhite,
    left: (u, v) => (v < 0.3 ? (v > 0.24 ? P.gold : P.flowerWhite) : Math.abs(u - 0.5) < 0.12 && v > 0.4 && v < 0.85 ? ELDA.blue : ashlar(1.6, 24, 101)(u, v)),
    right: (_u, v) => (v < 0.3 ? P.linen : P.stoneDark),
  });
  for (const x of [0.38, 1.58]) {
    m.box(x, 0.4, 28, 0.06, 0.06, 8, { top: P.gold, left: P.gold, right: 0x9a7430 });
    m.box(x, 0.4, 36, 0.05, 0.05, 6, { top: P.flowerWhite, left: P.flowerWhite, right: P.linen });
    m.box(x, 0.4, 42, 0.05, 0.05, 3, { top: P.fireYellow, left: P.fireYellow, right: P.fireOrange });
  }
  m.box(0.97, 0.3, 28, 0.07, 0.07, 26, { top: P.goldLight, left: P.gold, right: 0x9a7430 });
  m.box(0.85, 0.3, 46, 0.31, 0.07, 4, { top: P.goldLight, left: P.gold, right: 0x9a7430 });
  return m;
}

/** A plain oak pew along x, two tiles long, its back to the viewer. */
function pew(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.plankLight, left: P.plank, right: P.plankDark };
  m.box(0.1, 0.3, 0, 0.08, 0.45, 26, wood);
  m.box(0.15, 0.3, 11, 1.7, 0.36, 3, wood);
  m.box(0.15, 0.62, 11, 1.7, 0.07, 16, { top: P.plankLight, left: planks(3, P.plank, P.plankDark, P.plankLight, 4), right: P.plankDark });
  m.box(1.82, 0.3, 0, 0.08, 0.45, 26, wood);
  return m;
}

/** A tall iron stand of candles. */
function candlestand(): IsoModel {
  const m = new IsoModel();
  const iron = { top: P.ironLight, left: P.iron, right: P.ink };
  m.box(0.38, 0.38, 0, 0.24, 0.24, 3, iron);
  m.box(0.47, 0.47, 3, 0.06, 0.06, 36, iron);
  m.box(0.3, 0.3, 39, 0.4, 0.4, 2, iron);
  for (const [x, y, h] of [[0.36, 0.4, 7], [0.55, 0.36, 9], [0.45, 0.58, 6], [0.6, 0.56, 8]] as const) {
    m.box(x, y, 41, 0.05, 0.05, h, { top: P.flowerWhite, left: P.flowerWhite, right: P.linen });
    m.box(x, y, 41 + h, 0.05, 0.05, 3, { top: P.fireYellow, left: P.fireYellow, right: P.fireOrange });
  }
  return m;
}

/** A lectern with the great book open on it. */
function lectern(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.plankLight, left: P.plank, right: P.plankDark };
  m.box(0.3, 0.3, 0, 0.4, 0.4, 3, wood);
  m.box(0.45, 0.45, 3, 0.1, 0.1, 26, wood);
  m.quad({ x: 0.22, y: 0.3, z: 34 }, { x: 0.56, y: 0, z: 0 }, { x: 0, y: 0.4, z: -6 }, P.plank);
  m.quad({ x: 0.25, y: 0.33, z: 35 }, { x: 0.5, y: 0, z: 0 }, { x: 0, y: 0.34, z: -5 }, (u, v) => {
    if (Math.abs(u - 0.5) < 0.03) return P.linenDark;
    if (v > 0.15 && v < 0.85 && (v * 9) % 1 < 0.35 && Math.abs(u - 0.5) > 0.08 && Math.abs(u - 0.5) < 0.42) return u < 0.2 && v < 0.35 ? P.flowerRed : 0x6a5a4a;
    return P.linen;
  });
  return m;
}

/** A scribe's desk: a sloping top with a page half written, an inkhorn and a quill. */
function desk(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.plankLight, left: P.plank, right: P.plankDark };
  for (const [x, y] of [[0.15, 0.2], [0.75, 0.2], [0.15, 0.7], [0.75, 0.7]]) m.box(x, y, 0, 0.08, 0.08, 22, wood);
  m.box(0.12, 0.6, 6, 0.74, 0.06, 3, wood);
  m.quad({ x: 0.1, y: 0.15, z: 30 }, { x: 0.8, y: 0, z: 0 }, { x: 0, y: 0.7, z: -8 }, P.plankLight);
  m.quad({ x: 0.25, y: 0.25, z: 30 }, { x: 0.45, y: 0, z: 0 }, { x: 0, y: 0.5, z: -5.5 }, (u, v) => {
    if (v > 0.1 && v < 0.6 && (v * 12) % 1 < 0.4 && u > 0.1 && u < 0.9) return 0x4a3a30;
    if (v < 0.25 && u < 0.25) return ELDA.blue;
    return P.linen;
  });
  m.box(0.75, 0.6, 24, 0.07, 0.07, 4, { top: P.ink, left: P.iron, right: P.ink });
  m.box(0.78, 0.62, 28, 0.02, 0.02, 10, { top: P.flowerWhite, left: P.flowerWhite, right: P.linen });
  return m;
}

/** Tall bookshelves against a wall, two tiles long, crammed with books and scrolls. */
function bookcase(): IsoModel {
  const m = new IsoModel();
  const H = 64;
  m.box(0.05, 0.05, 0, 1.9, 0.38, H, {
    top: P.plankLight,
    left: (u, v) => {
      const x = u * 1.9 * 32;
      const y = (1 - v) * H;
      if (y < 3 || y > H - 3 || x < 2 || x > 1.9 * 32 - 2) return P.plank;
      const shelf = Math.floor(y / 15);
      const ly = y % 15;
      if (ly < 2) return P.plankDark;
      const book = Math.floor(x / 3);
      const n = hash(book, shelf);
      if (n < 0.08) return P.ink;
      if (ly > 11 + n * 3) return P.ink;
      if (n > 0.9) return P.linen; // a scroll
      return [0x7a2a2a, 0x2a4a6a, 0x3a5a2a, 0x6a4a2a, 0x8a6a3a][Math.floor(n * 5)];
    },
    right: P.plankDark,
  });
  return m;
}

/** Brother Anselm's work table: jars of dried herbs, a mortar and pestle, a bunch of moonpetal drying. */
function herbTable(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.plankLight, left: P.plank, right: P.plankDark };
  for (const [x, y] of [[0.12, 0.15], [1.8, 0.15], [0.12, 0.75], [1.8, 0.75]]) m.box(x, y, 0, 0.08, 0.08, 20, wood);
  m.box(0.08, 0.1, 20, 1.84, 0.8, 4, wood);
  const jar = (x: number, y: number, h: number, c: number) => {
    m.cylinder(x, y, 24, 0.08, h, (u) => (u < 0.3 ? P.glassLight : u > 0.7 ? P.glassDark : c), c);
    m.cylinder(x, y, 24 + h, 0.06, 2, () => P.leather, P.leatherLight);
  };
  jar(0.3, 0.3, 10, 0x8a9a6a);
  jar(0.5, 0.25, 12, 0xa08a5a);
  jar(0.7, 0.32, 8, 0x8a6ab8);
  m.cylinder(1.2, 0.55, 24, 0.14, 6, (u) => (u < 0.3 ? P.stoneLight : u > 0.7 ? P.stoneDark : P.stone), P.stoneDark);
  m.box(1.24, 0.5, 26, 0.04, 0.04, 12, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.quad({ x: 1.5, y: 0.4, z: 24.5 }, { x: 0.3, y: 0, z: 0 }, { x: 0, y: 0.3, z: 0 }, (u, v) => (hash(Math.floor(u * 8), Math.floor(v * 8)) < 0.5 ? null : u > 0.6 ? 0xf4f8ff : 0x6a9a8a));
  return m;
}

/** A great black pot on a trivet, for the brothers' pottage. */
function cauldron(): IsoModel {
  const m = new IsoModel();
  const iron = { top: P.ironLight, left: P.iron, right: P.ink };
  for (const [x, y] of [[0.25, 0.3], [0.7, 0.3], [0.48, 0.72]]) m.box(x, y, 0, 0.05, 0.05, 8, iron);
  m.cylinder(0.5, 0.5, 6, 0.32, 16, (u, v) => (v > 0.85 ? P.ink : u < 0.25 ? P.ironLight : u > 0.7 ? P.ink : P.iron), (u, v) => (((u - 0.5) * 2) ** 2 + ((v - 0.5) * 2) ** 2 < 0.7 ? 0x8a6a3a : P.iron));
  return m;
}

// ---------------------------------------------------------------- registry

function put(scene: Phaser.Scene, key: string, model: IsoModel, outline = true): void {
  const r = model.render(outline);
  const tex = r.canvas.toTexture(scene, key);
  MODEL_ART[key] = { key, originX: r.anchorX / tex.width, originY: r.anchorY / tex.height };
}

/** The monastery's buildings, by art key. Footprints are L x D tiles along x and y. */
const HALLS: Record<string, HallLook> = {
  'abbey-chapel': { L: 8, D: 4, H: 92, R: 58, seed: 3, door: 3, tall: true, stained: true, bellcote: true },
  'abbey-dorter': { L: 10, D: 3, H: 76, R: 46, seed: 7, chimneys: [2.5, 7] },
  'abbey-infirmary': { L: 7, D: 3, H: 66, R: 42, seed: 11, door: 3, chimneys: [5.2] },
  'abbey-scriptorium': { L: 7, D: 3, H: 70, R: 44, seed: 13, door: 2 },
  'abbey-refectory': { L: 8, D: 3, H: 70, R: 44, seed: 17, door: 2, chimneys: [6.2] },
  'abbey-lodging': { L: 5, D: 3, H: 70, R: 40, seed: 19, chimneys: [1] },
};
export type AbbeyBuilding = keyof typeof HALLS;

/** A building's footprint (w along x, h along y), the bay its door is in, and the tops of its chimneys for smoke. */
export function abbeyBuilding(key: string): { w: number; h: number; door?: number; chimneys: Array<{ gx: number; gy: number; z: number }> } {
  const o = HALLS[key];
  return {
    w: o.L,
    h: o.D,
    door: o.door,
    chimneys: (o.chimneys ?? []).map((cx) => ({ gx: cx + 0.3, gy: o.D * 0.22 + 0.3, z: o.H + o.R * 0.6 + 30 })),
  };
}

export function generateAbbey(scene: Phaser.Scene): void {
  for (const [key, look] of Object.entries(HALLS)) put(scene, key, hall(look));
  put(scene, 'abbey-turret', turret(0.42, 120, 48));
  put(scene, 'abbey-turret-short', turret(0.36, 84, 36));
  put(scene, 'abbey-wall-tower', wallTower(88));
  put(scene, 'abbey-arcade', arcade());
  put(scene, 'abbey-arcade-corner', arcadeCorner());
  for (let i = 0; i < HERBS.length; i++) put(scene, `abbey-herbs-${i}`, herbs(i));
  put(scene, 'abbey-moonpetal', moonpetal(false));
  put(scene, 'abbey-moonpetal-picked', moonpetal(true));
  put(scene, 'abbey-grave-0', grave(false, 3));
  put(scene, 'abbey-grave-1', grave(true, 5));
  put(scene, 'abbey-grave-2', grave(false, 9));
  put(scene, 'abbey-altar', altar());
  put(scene, 'abbey-pew', pew());
  put(scene, 'abbey-candles', candlestand());
  put(scene, 'abbey-lectern', lectern());
  put(scene, 'abbey-desk', desk());
  put(scene, 'abbey-bookcase', bookcase());
  put(scene, 'abbey-herbtable', herbTable());
  put(scene, 'abbey-cauldron', cauldron());
  const kinds: StoneWallKind[] = ['plain', 'window', 'stained', 'door', 'niche', 'books', 'herbs', 'cross', 'board'];
  for (const kind of kinds) {
    for (let i = 0; i < 2; i++) {
      makeStoneWall(scene, `swall-back-${kind}-${i}`, 'back', kind, i);
      makeStoneWall(scene, `swall-side-${kind}-${i}`, 'side', kind, i);
    }
  }
  const corner = new IsoModel();
  corner.box(-0.16, -0.16, 0, 0.3, 0.3, ABBEY_WALL_HEIGHT + 2, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  put(scene, 'swall-corner', corner);
}
