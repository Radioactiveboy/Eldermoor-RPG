import Phaser from 'phaser';
import { TILE_HEIGHT } from '../config';
import type { CropKind } from '../systems/Farm';
import { CROP_H, CROP_ORIGIN_Y, cropKey } from './farm';
import { MODEL_ART } from './interior';
import { IsoModel, lipped, Shader } from './IsoModel';
import { PALETTE as P } from './palette';

/**
 * The grounds outside Saint Elda's monastery: its old grey wall and gatehouse
 * (shut for now), the chapel and bell tower showing over the top, wayside
 * shrines with candles, a statue of the Saint, the brothers' bean rows and
 * beehives, and lilies on their fish ponds. Built with IsoModel and registered
 * in MODEL_ART for maps to place.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Saint Elda's blue, on the brothers' banners and the gate's roundel. */
export const ELDA = { blue: 0x3a5a8a, blueDark: 0x2a4066, blueLight: 0x5a7eb0 };

const SLATE = { base: 0x56586a, dark: 0x3e3f4e, light: 0x70728a };

/**
 * Old rubble stone laid in rough courses, weathered and patched with moss
 * (more of it towards the ground). `width` is the face's length in tiles so
 * stones keep the same size on long and short faces.
 */
function rubble(width: number, height: number, seed: number, mossy = 0.12): Shader {
  return (u, v) => {
    const y = v * height;
    const row = Math.floor(y / 7);
    const x = u * width * 32 + row * 9.5 + seed * 13;
    const col = Math.floor(x / 11);
    if (y % 7 < 1.1 || x % 11 < 1.2) return P.mortar;
    const n = hash(col + seed, row);
    if (n < mossy * (0.4 + v)) return n < mossy * 0.25 ? P.leafDark : P.moss;
    return n < 0.3 ? P.stoneDark : n > 0.85 ? P.stoneLight : P.stone;
  };
}

/** Flat coping stones along the top of a wall. */
const coping = { top: P.stoneLight, left: lipped(P.stone, P.stoneLight, 0.3), right: P.stoneDark };

/** A tile of the monastery's wall along x, its face to +y. Some sections have ivy climbing them. */
function wall(seed: number, ivy: boolean): IsoModel {
  const m = new IsoModel();
  const h = 46;
  const face = rubble(1, h, seed);
  const ivyAt = (u: number, v: number) => {
    // A climbing spread of leaves, densest at the foot.
    const reach = 0.25 + 0.75 * Math.pow(1 - Math.abs(u - 0.45) * 1.9, 0.6);
    return ivy && v > 1 - reach && hash(Math.floor(u * 22), Math.floor(v * 30)) > 0.35;
  };
  m.box(0, 0.3, 0, 1, 0.4, h, {
    top: P.stone,
    left: (u, v) => (ivyAt(u, v) ? (hash(Math.floor(u * 22) + 3, Math.floor(v * 30)) > 0.6 ? P.leafLight : P.leaf) : face(u, v)),
    right: rubble(0.4, h, seed + 5),
  });
  m.box(-0.02, 0.24, h, 1.04, 0.52, 4, coping);
  return m;
}

/** A square buttress pier where the wall ends or turns, a little taller than the wall. */
function wallPier(): IsoModel {
  const m = new IsoModel();
  m.box(0.15, 0.2, 0, 0.7, 0.6, 56, { top: P.stone, left: rubble(0.7, 56, 3), right: rubble(0.6, 56, 4) });
  m.box(0.1, 0.15, 56, 0.8, 0.7, 4, coping);
  m.box(0.3, 0.35, 60, 0.4, 0.3, 6, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  return m;
}

/**
 * The gatehouse, four tiles along x: a pointed arch through a tall stone front
 * between two buttresses, its oak doors barred shut, Saint Elda's star carved
 * in a roundel above, and a little bellcote on top with its bell.
 */
function gatehouse(): IsoModel {
  const m = new IsoModel();
  const H = 84;
  // The front, from x 0.6 to 3.4: stone, with the archway and doors cut into it.
  const W = 2.8;
  const stone = rubble(W, H, 11, 0.06);
  const front: Shader = (u, v) => {
    const x = (u - 0.5) * W; // tiles from the middle
    const y = (1 - v) * H; // pixels up from the ground
    // A pointed arch: straight sides up to the spring, then two arcs meeting at the top.
    const arch = (half: number, spring: number, top: number) =>
      Math.abs(x) < half && (y < spring || ((Math.abs(x) + half * 0.6) / (half * 1.6)) ** 2 + ((y - spring) / (top - spring)) ** 2 < 1);
    const half = 0.82;
    const spring = 38;
    const inside = arch(half, spring, 60);
    const ring = !inside && arch(half + 0.14, spring, 66);
    if (inside) {
      // The two leaves of the door, planked, with iron straps and studs, and a ring handle.
      const leaf = x < 0 ? x + half : x;
      if (Math.abs(x) < 0.025) return P.barkDark;
      const fu = (leaf / half) * 7;
      if (fu % 1 < 0.12) return P.plankDark;
      if (Math.abs(y - 12) < 1.6 || Math.abs(y - 34) < 1.6) return (fu * 3) % 1 < 0.2 ? P.ironLight : P.iron;
      if (Math.abs(Math.abs(x) - 0.12) < 0.04 && Math.abs(y - 24) < 3) return P.iron;
      return fu % 1 > 0.8 ? P.plank : P.logLight;
    }
    if (ring) {
      // Dressed stones round the arch.
      if (y < spring) return Math.floor(y / 7) % 2 ? P.stoneLight : P.stone;
      return Math.floor(Math.atan2(y - spring, x) * 5) % 2 ? P.stoneLight : P.stone;
    }
    // Saint Elda's star in a roundel over the arch.
    const ry = y - 72;
    const r = Math.hypot(x * 24, ry);
    if (r < 7.5) {
      if (r > 6.2) return P.stoneLight;
      const ang = Math.atan2(ry, x * 24);
      const star = 2.4 + 2.8 * Math.pow(Math.abs(Math.cos(ang * 4)), 6);
      return r < star ? P.gold : ELDA.blue;
    }
    return stone(u, v);
  };
  // Back to front: the buttresses' backs, the front block, then the buttresses and the bellcote.
  m.box(0.6, 0.25, 0, W, 0.5, H, { top: P.stone, left: front, right: rubble(0.5, H, 12) });
  // A low gable over the middle, coped with flat stones.
  const g = 14;
  m.quad({ x: 0.6, y: 0.75, z: H }, { x: W, y: 0, z: 0 }, { x: 0, y: 0, z: g }, (u, v) => (v > 1 - Math.abs(u * 2 - 1) ? null : rubble(W, g, 15, 0)(u, 1 - v)));
  m.quad({ x: 0.56, y: 0.75, z: H - 1 }, { x: W / 2 + 0.04, y: 0, z: g + 1 }, { x: 0, y: -0.5, z: 0 }, P.stoneLight);
  m.quad({ x: 0.6 + W / 2, y: 0.75, z: H + g }, { x: W / 2 + 0.04, y: 0, z: -g - 1 }, { x: 0, y: -0.5, z: 0 }, P.stone);
  // The bellcote: two little piers and a gable, with the bell hanging between.
  const top = H + 10;
  m.box(1.62, 0.38, top, 0.14, 0.24, 26, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.cylinder(2.0, 0.5, top + 8, 0.12, 12, (u, v) => (v > 0.8 ? P.goldLight : u < 0.35 ? P.goldLight : u > 0.75 ? 0x9a7430 : P.gold), P.gold);
  m.box(1.97, 0.47, top + 20, 0.06, 0.06, 6, { top: P.barkLight, left: P.bark, right: P.barkDark });
  m.box(2.24, 0.38, top, 0.14, 0.24, 26, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.box(1.56, 0.34, top + 26, 0.88, 0.32, 4, coping);
  m.quad({ x: 1.56, y: 0.66, z: top + 30 }, { x: 0.44, y: 0, z: 10 }, { x: 0, y: -0.32, z: 0 }, P.stoneLight);
  m.quad({ x: 2.0, y: 0.66, z: top + 40 }, { x: 0.44, y: 0, z: -10 }, { x: 0, y: -0.32, z: 0 }, P.stone);
  m.box(1.98, 0.48, top + 39, 0.04, 0.04, 8, { top: P.gold, left: P.gold, right: 0x9a7430 });
  m.box(1.94, 0.48, top + 44, 0.12, 0.04, 2, { top: P.gold, left: P.gold, right: 0x9a7430 });
  // Stepped buttresses either side, standing proud of the front.
  for (const x of [0.1, 3.4]) {
    m.box(x, 0.2, 0, 0.5, 0.75, 70, { top: P.stone, left: rubble(0.5, 70, 21 + x), right: rubble(0.75, 70, 23 + x) });
    m.box(x + 0.04, 0.3, 70, 0.42, 0.55, 10, { top: P.stoneLight, left: rubble(0.42, 10, 25), right: P.stoneDark });
    m.box(x + 0.1, 0.38, 80, 0.3, 0.38, 6, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
    // A blue banner of the Saint hung on each.
    m.quad({ x: x + 0.1, y: 0.96, z: 64 }, { x: 0.3, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }, (u, v) => {
      if (v > 0.84 && Math.abs(u - 0.5) < (v - 0.84) * 3) return null;
      if (u < 0.1 || u > 0.9 || v < 0.06) return P.goldLight;
      const r = Math.hypot((u - 0.5) * 9, (v - 0.4) * 30);
      if (r < 3) return P.gold;
      return u > 0.7 ? ELDA.blueDark : ELDA.blue;
    });
  }
  return m;
}

/** Roof slates, row upon row, a little uneven. */
function slates(): Shader {
  return (u, v) => {
    const row = Math.floor(v * 14);
    const lv = (v * 14) % 1;
    const col = Math.floor(u * 30 + (row % 2) * 0.5);
    if (lv > 0.82 || (u * 30 + (row % 2) * 0.5) % 1 < 0.07) return SLATE.dark;
    const n = hash(col, row);
    return n < 0.18 ? SLATE.dark : n > 0.86 || lv < 0.15 ? SLATE.light : SLATE.base;
  };
}

/**
 * The chapel inside the walls, along x: tall stone walls with lancet windows
 * glowing, under a steep slate roof. Only its upper part shows over the wall.
 */
function chapel(): IsoModel {
  const m = new IsoModel();
  const L = 7;
  const D = 3;
  const H = 76;
  const R = 50;
  const o = 0.25;
  const windows = (count: number, len: number): Shader => {
    const stone = rubble(len, H, 31, 0.05);
    return (u, v) => {
      const y = (1 - v) * H;
      const k = (u * count) % 1;
      const dx = Math.abs(k - 0.5) * (len / count) * 32;
      const archTop = 64;
      if (y > 30 && dx < 4.5 && (y < 56 || (dx / 4.5) ** 2 + ((y - 56) / (archTop - 56)) ** 2 < 1)) {
        if (dx > 3.6) return P.stoneLight;
        if (Math.abs(y - 44) < 0.8 || dx < 0.6) return P.iron;
        return y > 48 ? P.glassLit : P.fireOrange;
      }
      return stone(u, v);
    };
  };
  m.quad({ x: -o, y: D / 2, z: H + R }, { x: L + o, y: 0, z: 0 }, { x: 0, y: -D / 2 - o, z: -R - 6 }, slates());
  m.quad({ x: 0, y: D, z: H }, { x: L, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, windows(5, L));
  m.quad({ x: L, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: -H }, (u, v) => {
    const c = rubble(D, H, 33, 0.05)(u, v);
    return c === P.stoneLight ? P.stone : c === P.stone ? P.stoneDark : c;
  });
  // The gable end, with a round rose window.
  m.quad({ x: L, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => {
    if (v > 1 - Math.abs(u * 2 - 1)) return null;
    const r = Math.hypot((u - 0.5) * D * 32, (v - 0.35) * R);
    if (r < 9) {
      if (r > 7.5) return P.stoneLight;
      const spoke = Math.abs(Math.sin(Math.atan2(v - 0.35, u - 0.5) * 4)) < 0.2 || r < 2;
      return spoke ? P.iron : r < 5 ? ELDA.blueLight : P.glassLit;
    }
    const c = rubble(D, R, 35, 0)(u, v);
    return c === P.stoneLight ? P.stone : c === P.stone ? P.stoneDark : c;
  });
  m.quad({ x: L, y: D / 2, z: H + R }, { x: o, y: 0, z: 0 }, { x: 0, y: -D / 2 - o, z: -R - 6 }, SLATE.dark);
  m.quad({ x: -o, y: D / 2, z: H + R }, { x: L + o * 2, y: 0, z: 0 }, { x: 0, y: D / 2 + o, z: -R - 6 }, slates());
  m.box(-o, D / 2 - 0.06, H + R - 2, L + o * 2, 0.12, 4, { top: SLATE.light, left: SLATE.dark, right: SLATE.dark });
  // A stone cross on the gable.
  m.box(L - 0.06, D / 2 - 0.06, H + R, 0.12, 0.12, 18, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.box(L - 0.06, D / 2 - 0.3, H + R + 10, 0.12, 0.6, 4, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  return m;
}

/** The bell tower: a tall square tower with open belfry arches and a slate spire, seen over the wall. */
function tower(): IsoModel {
  const m = new IsoModel();
  const S = 2;
  const H = 150;
  const belfry: (len: number, seed: number, shade: boolean) => Shader = (len, seed, shade) => {
    const stone = rubble(len, H, seed, 0.04);
    return (u, v) => {
      const y = (1 - v) * H;
      const dx = Math.abs(u - 0.5) * len * 32;
      if (y > 112 && y < 140 && dx < 9 && (y < 132 || (dx / 9) ** 2 + ((y - 132) / 8) ** 2 < 1)) {
        if (dx > 7.5) return P.stoneLight;
        return Math.abs(dx - 2) < 2.5 && y > 118 && y < 128 ? P.gold : P.ink;
      }
      if (y > 60 && y < 76 && dx < 2.5) return shade ? P.ink : P.glassLit;
      if (Math.abs(y - 108) < 2 || Math.abs(y - 144) < 2) return P.stoneLight;
      const c = stone(u, v);
      return shade && c === P.stone ? P.stoneDark : c;
    };
  };
  m.box(0, 0, 0, S, S, H, { top: P.stone, left: belfry(S, 41, false), right: belfry(S, 43, true) });
  // A low parapet, then the spire.
  m.box(-0.08, -0.08, H, S + 0.16, S + 0.16, 6, coping);
  const spire = 70;
  const c = S / 2;
  m.quad({ x: 0, y: S, z: H + 6 }, { x: S, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, SLATE.dark);
  // Two visible faces of a four-sided spire, as triangles.
  m.quad({ x: 0, y: S, z: H + 6 }, { x: S, y: 0, z: 0 }, { x: 0, y: -c, z: spire }, (u, v) => (Math.abs(u - 0.5) * 2 > 1 - v ? null : slates()(u, v)));
  m.quad({ x: S, y: 0, z: H + 6 }, { x: 0, y: S, z: 0 }, { x: -c, y: 0, z: spire }, (u, v) => {
    if (Math.abs(u - 0.5) * 2 > 1 - v) return null;
    const s = slates()(u, v);
    return s === SLATE.base ? SLATE.dark : s === SLATE.light ? SLATE.base : s;
  });
  m.box(c - 0.04, c - 0.04, H + 6 + spire - 4, 0.08, 0.08, 14, { top: P.gold, left: P.gold, right: 0x9a7430 });
  m.box(c - 0.04, c - 0.2, H + spire + 10, 0.08, 0.4, 3, { top: P.gold, left: P.gold, right: 0x9a7430 });
  return m;
}

/**
 * A wayside shrine: a stepped plinth, a short pillar, and a little gabled
 * niche with a figure of the Saint inside, candles burning and a few flowers
 * left at its foot. Lit at night (see the map's lights).
 */
function shrine(flowers: number): IsoModel {
  const m = new IsoModel();
  m.box(0.15, 0.15, 0, 0.7, 0.7, 4, { top: P.stoneLight, left: rubble(0.7, 4, 51, 0.2), right: P.stoneDark });
  m.box(0.25, 0.25, 4, 0.5, 0.5, 4, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  // Flowers on the step.
  const petals = [P.flowerRed, P.flowerWhite, P.flowerYellow, P.flowerBlue];
  for (let i = 0; i < 3; i++) {
    const x = 0.24 + i * 0.12;
    m.box(x, 0.78, 4, 0.03, 0.03, 4, { top: P.leaf, left: P.leaf, right: P.leafDark });
    m.box(x - 0.03, 0.75, 8, 0.09, 0.09, 3, { top: petals[(i + flowers) % 4], left: petals[(i + flowers) % 4], right: P.flowerRed });
  }
  m.box(0.35, 0.35, 8, 0.3, 0.3, 26, { top: P.stone, left: rubble(0.3, 26, 53, 0.15), right: rubble(0.3, 26, 54, 0.1) });
  // The niche: back and sides, the figure inside, then the roof.
  const z = 34;
  m.box(0.26, 0.26, z, 0.48, 0.48, 3, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.box(0.28, 0.28, z + 3, 0.44, 0.08, 22, { top: P.stone, left: P.stoneDark, right: P.stoneDark });
  m.box(0.28, 0.28, z + 3, 0.08, 0.44, 22, { top: P.stone, left: P.ink, right: P.stoneDark });
  // The Saint, robed in blue, a pale face, hands together.
  m.cylinder(0.5, 0.5, z + 3, 0.09, 13, (u, v) => (v < 0.15 ? P.flowerWhite : u < 0.3 ? ELDA.blueLight : u > 0.75 ? ELDA.blueDark : ELDA.blue), ELDA.blueLight);
  m.cylinder(0.5, 0.5, z + 16, 0.05, 4, (u) => (u < 0.4 ? P.skinPale : P.skinPaleShade), P.flowerWhite);
  m.cylinder(0.5, 0.5, z + 20, 0.06, 2, () => P.goldLight, P.goldLight);
  // Two candles burning in front.
  for (const x of [0.33, 0.64]) {
    m.box(x, 0.66, z + 3, 0.04, 0.04, 5, { top: P.flowerWhite, left: P.flowerWhite, right: P.linen });
    m.box(x, 0.66, z + 8, 0.04, 0.04, 2, { top: P.fireYellow, left: P.fireYellow, right: P.fireOrange });
  }
  m.box(0.72, 0.28, z + 3, 0.04, 0.44, 22, { top: P.stone, left: P.stoneDark, right: P.stone });
  // Little gabled stone roof with a cross.
  const r = z + 25;
  m.quad({ x: 0.2, y: 0.2, z: r }, { x: 0.6, y: 0, z: 0 }, { x: 0, y: 0.3, z: 10 }, P.stone);
  m.quad({ x: 0.2, y: 0.5, z: r + 10 }, { x: 0.6, y: 0, z: 0 }, { x: 0, y: 0.3, z: -10 }, P.stoneLight);
  m.quad({ x: 0.8, y: 0.2, z: r }, { x: 0, y: 0.6, z: 0 }, { x: 0, y: 0, z: 10 }, (u, v) => (1 - v < Math.abs(u * 2 - 1) ? null : P.stoneDark));
  m.box(0.47, 0.47, r + 10, 0.06, 0.06, 9, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.box(0.47, 0.38, r + 15, 0.06, 0.24, 2, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  return m;
}

/**
 * Saint Elda herself, larger than life on a plinth in front of the gate: a
 * hooded figure in a long robe, holding out a bowl, with moss in the folds.
 */
function statue(): IsoModel {
  const m = new IsoModel();
  // Two-tile plinth with steps.
  m.box(0.1, 0.1, 0, 1.8, 1.8, 5, { top: P.stoneLight, left: rubble(1.8, 5, 61, 0.3), right: rubble(1.8, 5, 62, 0.3) });
  m.box(0.4, 0.4, 5, 1.2, 1.2, 14, {
    top: P.stoneLight,
    left: (u, v) => (Math.abs(v - 0.5) < 0.18 && u > 0.2 && u < 0.8 && (u * 18) % 1 < 0.6 ? P.stoneDark : lipped(P.stone, P.stoneLight, 0.15)(u, v)),
    right: lipped(P.stoneDark, P.stone, 0.15),
  });
  const robe: Shader = (u, v) => {
    const fold = Math.sin(u * 22) * 0.5 + 0.5;
    if (hash(Math.floor(u * 20), Math.floor(v * 30)) < 0.06 + v * 0.1) return P.moss;
    return u < 0.3 || fold > 0.8 ? P.stoneLight : u > 0.75 || fold < 0.15 ? P.stoneDark : P.stone;
  };
  // The robe, widening to the hem.
  m.cylinder(1, 1, 19, 0.4, 10, robe, P.stone);
  m.cylinder(1, 1, 29, 0.34, 18, robe, P.stone);
  m.cylinder(1, 1, 47, 0.27, 14, robe, P.stone);
  // Shoulders and the hood, the face in its shadow.
  m.cylinder(1, 1, 61, 0.25, 5, robe, P.stoneLight);
  m.cylinder(1, 1, 66, 0.16, 12, (u, v) => (u > 0.3 && u < 0.62 && v > 0.25 && v < 0.85 ? (v < 0.4 ? P.stoneDark : P.stone) : u < 0.3 ? P.stoneLight : P.stoneDark), P.stoneLight);
  m.cylinder(1, 1, 78, 0.1, 3, () => P.stone, P.stoneLight);
  // Arms held out in front, with the bowl.
  m.box(0.86, 1.18, 48, 0.28, 0.24, 6, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.cylinder(1, 1.4, 52, 0.16, 4, (u) => (u < 0.4 ? P.stoneLight : P.stoneDark), (u, v) => ((u - 0.5) ** 2 + (v - 0.5) ** 2 < 0.12 ? P.waterLight : P.stoneLight));
  return m;
}

/** A row of runner beans climbing hazel canes, along x, with red flowers and hanging pods. */
function beans(seed: number): IsoModel {
  const m = new IsoModel();
  const cane = { top: P.barkLight, left: P.barkLight, right: P.bark };
  for (let i = 0; i < 3; i++) {
    const x = 0.18 + i * 0.32;
    m.box(x, 0.36, 0, 0.04, 0.04, 34, cane);
    m.box(x + 0.02, 0.6, 0, 0.04, 0.04, 34, cane);
  }
  m.box(0.1, 0.46, 32, 0.8, 0.04, 2, cane);
  // The leafy vines over the canes, on both faces.
  const vine: Shader = (u, v) => {
    const n = hash(Math.floor(u * 18) + seed, Math.floor(v * 16));
    if (v < 0.08 && n < 0.5) return null;
    if (n < 0.12) return null;
    if (n > 0.93) return P.flowerRed;
    if (n > 0.88 && v > 0.3) return P.leafGlow;
    return n < 0.4 ? P.leafDark : n < 0.75 ? P.leaf : P.leafLight;
  };
  m.quad({ x: 0.12, y: 0.66, z: 34 }, { x: 0.78, y: 0, z: 0 }, { x: 0, y: 0, z: -30 }, vine);
  m.quad({ x: 0.9, y: 0.36, z: 34 }, { x: 0, y: 0.3, z: 0 }, { x: 0, y: 0, z: -30 }, (u, v) => {
    const c = vine(u, v);
    return c === P.leafLight ? P.leaf : c === P.leaf ? P.leafDark : c;
  });
  return m;
}

/** A straw beehive skep on a little wooden stand. */
function skep(): IsoModel {
  const m = new IsoModel();
  const leg = { top: P.plank, left: P.plank, right: P.plankDark };
  m.box(0.25, 0.3, 0, 0.08, 0.08, 10, leg);
  m.box(0.67, 0.3, 0, 0.08, 0.08, 10, leg);
  m.box(0.25, 0.66, 0, 0.08, 0.08, 10, leg);
  m.box(0.67, 0.66, 0, 0.08, 0.08, 10, leg);
  m.box(0.18, 0.22, 10, 0.64, 0.6, 3, { top: P.plankLight, left: P.plank, right: P.plankDark });
  const straw = (k: number): Shader => (u, v) => ((v * 3 + k) % 1 < 0.25 ? P.strawDark : u < 0.3 ? P.strawLight : u > 0.78 ? P.strawDark : P.straw);
  const radii = [0.27, 0.26, 0.24, 0.2, 0.15, 0.08];
  radii.forEach((r, i) => {
    m.cylinder(0.5, 0.52, 13 + i * 4, r, 4, (u, v) => {
      // The little entrance at the foot, facing the viewer.
      if (i === 0 && v > 0.4 && Math.abs(u - 0.5) < 0.08) return P.ink;
      return straw(i * 0.37)(u, v);
    }, P.strawLight);
  });
  return m;
}

/** Water lilies: flat pads and a pink-white flower, laid on a pond tile. */
function lilies(seed: number): IsoModel {
  const m = new IsoModel();
  const pads = [[0.3, 0.35, 0.16], [0.65, 0.55, 0.13], [0.4, 0.72, 0.11], [0.72, 0.25, 0.09]];
  pads.forEach(([x, y, r], i) => {
    if (hash(seed, i) < 0.2) return;
    m.quad({ x: x - r, y: y - r, z: 0 }, { x: r * 2, y: 0, z: 0 }, { x: 0, y: r * 2, z: 0 }, (u, v) => {
      const dx = u * 2 - 1;
      const dy = v * 2 - 1;
      if (dx * dx + dy * dy > 1) return null;
      // A notch cut into each pad.
      if (dx > 0 && Math.abs(dy) < dx * 0.3) return null;
      return dx + dy < -0.6 ? P.leafLight : dx * dx + dy * dy > 0.7 ? P.leafDark : P.leaf;
    });
  });
  const fx = 0.32;
  const fy = 0.36;
  m.quad({ x: fx - 0.07, y: fy - 0.07, z: 1 }, { x: 0.14, y: 0, z: 0 }, { x: 0, y: 0.14, z: 0 }, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.5) return null;
    return d < 0.15 ? P.flowerYellow : (Math.atan2(v - 0.5, u - 0.5) * 3) % 1 < 0.5 ? 0xf0c0d0 : P.flowerWhite;
  });
  return m;
}

export function generateMonastery(scene: Phaser.Scene): void {
  const put = (key: string, model: IsoModel, outline = true) => {
    const r = model.render(outline);
    const tex = r.canvas.toTexture(scene, key);
    MODEL_ART[key] = { key, originX: r.anchorX / tex.width, originY: r.anchorY / tex.height };
  };
  for (let i = 0; i < 3; i++) put(`mon-wall-${i}`, wall(i * 7 + 1, false));
  put('mon-wall-ivy', wall(17, true));
  put('mon-wall-pier', wallPier());
  put('mon-gate', gatehouse());
  put('mon-chapel', chapel());
  put('mon-tower', tower());
  put('mon-shrine-0', shrine(0));
  put('mon-shrine-1', shrine(2));
  put('mon-statue', statue());
  put('mon-beans-0', beans(3));
  put('mon-beans-1', beans(9));
  put('mon-skep', skep());
  put('mon-lilies-0', lilies(1), false);
  put('mon-lilies-1', lilies(4), false);
  // The brothers' vegetables use the garden's crop art, set as objects in the beds.
  for (const kind of ['carrot', 'cabbage', 'turnip'] as CropKind[]) {
    const key = cropKey(kind, true);
    MODEL_ART[`mon-crop-${kind}`] = { key, originX: 0.5, originY: (CROP_ORIGIN_Y - TILE_HEIGHT / 2) / CROP_H };
  }
}
