import Phaser from 'phaser';
import { MODEL_ART } from './interior';
import { IsoModel, planks, Shader } from './IsoModel';
import { PALETTE as P } from './palette';
import { PALISADE_CUTS } from './sizes';

/**
 * Adowvale's stockade: the ring of sharpened stakes round the village, out
 * among the trees at the edge of the clearing (see addPalisade in
 * world/MarketMap.ts). Runs of stakes in a few cuts so the line
 * doesn't look stamped out, stouter posts at the corners, timber gateways
 * where the roads go through, and watchtowers on stilts looking out over it.
 * All of it is laid out along x; along y it's the same art mirrored.
 */

/** A small, steady hash for picking stake heights and quirks. */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Bark on a log: lit down one side, shaded down the other, with knots and splits. */
const bark = (tone: number): Shader => (u, v) => {
  if (u > 0.72) return P.logDark;
  if (u < 0.18) return tone > 0.6 ? P.ashLight : P.logLight;
  const grain = (v * 11 + u * 3 + tone * 5) % 1;
  if (grain < 0.1) return P.logDark;
  if (tone > 0.75 && grain > 0.55 && grain < 0.62) return P.barkLight;
  return tone < 0.3 ? P.bark : P.log;
};

/** Hemp lashing round a stake. */
const rope: Shader = (u, v) => ((v * 3 + u * 2) % 1 < 0.35 ? P.strawDark : P.straw);

/** A whittled point on top of a stake of radius r standing h high. */
function point(m: IsoModel, cx: number, cy: number, r: number, h: number, tone: number): void {
  m.cylinder(cx, cy, h, r * 0.72, 3, () => (tone > 0.5 ? P.ashLight : P.logLight), P.ashLight);
  m.cylinder(cx, cy, h + 3, r * 0.42, 3, () => P.ashLight, P.ashLight);
  m.cylinder(cx, cy, h + 6, r * 0.18, 2, () => P.ash, P.ash);
}

/**
 * One tile of palisade: six or seven stakes of uneven height along x, lashed
 * to two rails behind them. `cut` picks the heights and quirks: a short
 * stake, a rope binding, a stake that's been patched with a fresh pale one.
 */
function stakes(cut: number): IsoModel {
  const m = new IsoModel();
  const n = cut % 2 === 0 ? 6 : 7;
  // The rails first, on the inside of the stakes, so the stakes stand in front of them.
  for (const z of [9 + (cut % 3), 27 + (cut % 2) * 2]) m.box(0, 0.62, z, 1, 0.06, 3, { top: P.plankLight, left: P.plank, right: P.plankDark });
  for (let i = 0; i < n; i++) {
    const k = cut * 13 + i;
    const r = 0.07 + hash(k) * 0.025;
    const cx = (i + 0.5) / n + (hash(k + 5) - 0.5) * 0.03;
    const cy = 0.5 + (hash(k + 9) - 0.5) * 0.06;
    const h = 34 + Math.floor(hash(k + 2) * 10) - (hash(k + 7) < 0.12 ? 6 : 0);
    const tone = hash(k + 3);
    m.cylinder(cx, cy, 0, r, h, bark(tone), P.logLight);
    point(m, cx, cy, r, h, tone);
    if (hash(k + 11) < 0.25) m.cylinder(cx, cy, 18 + (k % 4), r + 0.012, 3, rope, P.straw);
  }
  // Earth heaped up along the foot of the stakes.
  m.box(0, 0.36, 0, 1, 0.3, 2, { top: P.dirtDark, left: P.dirtDark, right: P.dirtDark });
  return m;
}

/** A stout corner post: a big log, banded in iron, standing a head taller than the stakes. */
function cornerPost(): IsoModel {
  const m = new IsoModel();
  m.box(0.22, 0.22, 0, 0.56, 0.56, 2, { top: P.dirtDark, left: P.dirtDark, right: P.dirtDark });
  m.cylinder(0.5, 0.5, 0, 0.17, 54, bark(0.4), P.logLight);
  for (const z of [12, 40]) m.cylinder(0.5, 0.5, z, 0.18, 3, (u) => (u < 0.3 ? P.ironLight : P.iron), P.iron);
  point(m, 0.5, 0.5, 0.17, 54, 0.4);
  return m;
}

/** A gate post: a tall log with a cross-brace foot and a lantern bracket, for either side of a gateway. */
function gatePost(m: IsoModel, x: number, lantern: boolean): void {
  m.box(x - 0.24, 0.26, 0, 0.48, 0.48, 3, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.cylinder(x, 0.5, 3, 0.16, 74, bark(0.5), P.logLight);
  for (const z of [16, 52]) m.cylinder(x, 0.5, z, 0.17, 3, (u) => (u < 0.3 ? P.ironLight : P.iron), P.iron);
  if (lantern) {
    // An iron arm out over the road, and a lantern on it.
    const out = x < 2 ? 0.2 : -0.36;
    m.box(x + out, 0.48, 60, 0.16, 0.04, 2, { top: P.iron, left: P.iron, right: P.iron });
    const lx = x + (x < 2 ? 0.34 : -0.34);
    m.box(lx - 0.01, 0.49, 50, 0.02, 0.02, 10, { top: P.iron, left: P.iron, right: P.iron });
    m.box(lx - 0.07, 0.43, 38, 0.14, 0.14, 12, {
      top: P.iron,
      left: (u, v) => (u > 0.2 && u < 0.8 && v > 0.15 && v < 0.85 ? P.fireYellow : P.iron),
      right: (u, v) => (u > 0.2 && u < 0.8 && v > 0.15 && v < 0.85 ? P.fireOrange : P.iron),
    });
  }
}

/**
 * A gate leaf of boards and braces, swung back inwards against its post
 * (inside the stockade is towards -y): a thin board wall along y, its face to the road.
 */
function leaf(m: IsoModel, x: number): void {
  const boards: Shader = (u, v) => {
    const fu = (u * 6) % 1;
    if (v < 0.08 && Math.abs(fu - 0.5) > (v / 0.08) * 0.5) return null;
    // A Z of bracing across the boards.
    const brace = Math.abs(v - 0.24) < 0.05 || Math.abs(v - 0.8) < 0.05 || Math.abs(v - (0.24 + u * 0.56)) < 0.05;
    if (brace) return P.plankDark;
    if (fu < 0.1) return P.plankDark;
    return fu > 0.8 ? P.plank : P.plankLight;
  };
  m.box(x, -0.5, 0, 0.07, 0.86, 44, { top: P.plankLight, left: P.plankDark, right: boards });
}

/**
 * A gateway through the stockade, four tiles along x: a gate post on each
 * outer tile, the road through the middle two under a timber lintel with a
 * little shingled hood and a lantern hung off each post, and the two leaves
 * swung back inside.
 */
function gateway(): IsoModel {
  const m = new IsoModel();
  leaf(m, 0.74);
  leaf(m, 3.19);
  gatePost(m, 0.55, true);
  gatePost(m, 3.45, true);
  // The lintel, and a hood of shingles over it to keep the rain off.
  m.box(0.3, 0.4, 70, 3.4, 0.2, 8, { top: P.plankLight, left: planks(2, P.plank, P.plankDark, P.plankLight, 3), right: P.plankDark });
  const shingles: Shader = (u, v) => {
    const row = Math.floor(v * 3);
    return (u * 18 + row * 0.5) % 1 < 0.12 || (v * 3) % 1 > 0.82 ? P.barkDark : row % 2 ? P.bark : P.barkLight;
  };
  m.quad({ x: 0.22, y: 0.18, z: 86 }, { x: 3.56, y: 0, z: 0 }, { x: 0, y: 0.32, z: -8 }, shingles);
  m.quad({ x: 0.22, y: 0.5, z: 86 }, { x: 3.56, y: 0, z: 0 }, { x: 0, y: 0.32, z: -8 }, shingles);
  m.box(0.2, 0.47, 85, 3.6, 0.06, 2, { top: P.barkLight, left: P.bark, right: P.barkDark });
  // A carved board hung under the lintel: Adowvale's sheaf, in gold on green.
  m.box(1.5, 0.6, 58, 1.0, 0.04, 10, {
    top: P.plank,
    left: (u, v) => {
      if (u < 0.05 || u > 0.95 || v < 0.12 || v > 0.88) return P.plankDark;
      const stalk = Math.abs(u - 0.5) < 0.18 && Math.abs(((u - 0.5) * 9) % 1) < 0.25 && v > 0.25;
      if (stalk || (Math.abs(u - 0.5) < 0.22 && v > 0.48 && v < 0.6)) return P.gold;
      return P.cloak;
    },
    right: P.plankDark,
  });
  for (const x of [1.7, 2.3]) m.box(x, 0.61, 68, 0.02, 0.02, 2, { top: P.iron, left: P.iron, right: P.iron });
  return m;
}

/**
 * A watchtower: a platform on four log legs braced with crosspieces, a
 * stake parapet round the top, a ladder up the front, a brazier on the
 * platform and a thatched roof on four posts over it. Two tiles square.
 */
function watchtower(): IsoModel {
  const m = new IsoModel();
  const legs: Array<[number, number]> = [[0.3, 0.3], [1.7, 0.3], [0.3, 1.7], [1.7, 1.7]];
  const deck = 74;
  // Back legs and braces first, front ones last.
  const order = [0, 1, 2, 3];
  for (const i of order) {
    const [x, y] = legs[i];
    m.box(x - 0.18, y - 0.18, 0, 0.36, 0.36, 3, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
    m.cylinder(x, y, 3, 0.11, deck - 3, bark(0.3 + i * 0.15), P.logLight);
  }
  // Cross braces on the two faces the camera sees.
  const braceL: Shader = (u, v) => (Math.abs(v - u) < 0.07 || Math.abs(v - (1 - u)) < 0.07 ? (v < 0.5 ? P.log : P.logDark) : null);
  m.quad({ x: 0.3, y: 1.72, z: deck - 6 }, { x: 1.4, y: 0, z: 0 }, { x: 0, y: 0, z: -56 }, braceL);
  m.quad({ x: 1.72, y: 0.3, z: deck - 6 }, { x: 0, y: 1.4, z: 0 }, { x: 0, y: 0, z: -56 }, braceL);
  // The ladder up the front-left face.
  const ladder: Shader = (u, v) => (u < 0.14 || u > 0.86 ? P.plank : (v * 10) % 1 < 0.22 ? P.plankLight : null);
  m.quad({ x: 0.75, y: 2.02, z: deck + 2 }, { x: 0.5, y: 0, z: 0 }, { x: 0, y: 0.4, z: -deck - 2 }, ladder);
  // The deck, its beams showing at the edge.
  m.box(0.1, 0.1, deck, 1.8, 1.8, 6, { top: planks(6, P.plank, P.plankDark, P.plankLight, 4), left: P.plankDark, right: P.barkDark });
  // A brazier on the deck, behind the parapet, its coals lit.
  m.cylinder(1.0, 1.0, deck + 6, 0.05, 12, () => P.iron, P.iron);
  m.cylinder(1.0, 1.0, deck + 18, 0.22, 8, (u) => (u < 0.3 ? P.ironLight : P.iron), (u, v) => ((u * 7 + v * 5) % 1 < 0.4 ? P.fireYellow : P.fireOrange));
  // The corner posts carry on up to hold the roof.
  for (const [x, y] of legs) m.cylinder(x, y, deck + 6, 0.08, 46, bark(0.5), P.logLight);
  // The parapet: short stakes all round, on the two faces we see.
  const parapet: Shader = (u, v) => {
    const fu = (u * 12) % 1;
    if (v < 0.16 && Math.abs(fu - 0.5) > (v / 0.16) * 0.5) return null;
    if (fu < 0.14) return P.logDark;
    return Math.abs(v - 0.5) < 0.06 ? P.plankDark : fu > 0.75 ? P.log : P.logLight;
  };
  m.quad({ x: 0.1, y: 1.9, z: deck + 26 }, { x: 1.8, y: 0, z: 0 }, { x: 0, y: 0, z: -20 }, parapet);
  m.quad({ x: 1.9, y: 0.1, z: deck + 26 }, { x: 0, y: 1.8, z: 0 }, { x: 0, y: 0, z: -20 }, parapet);
  // A thatched hip roof over it all.
  const thatch: Shader = (u, v) => {
    const s = (u * 23 + v * 3) % 1;
    if ((v * 6) % 1 > 0.88) return P.thatchDark;
    return s < 0.2 ? P.thatchDark : s > 0.75 ? P.thatchLight : P.thatch;
  };
  const eave = deck + 52;
  const peak = { x: 1.0, y: 1.0, z: eave + 50 };
  const corners = [{ x: -0.1, y: -0.1 }, { x: 2.1, y: -0.1 }, { x: 2.1, y: 2.1 }, { x: -0.1, y: 2.1 }];
  // Two visible slopes as triangles drawn with quads whose far corner meets the peak.
  const slope = (a: { x: number; y: number }, b: { x: number; y: number }, dark: boolean) => {
    const o = { x: a.x, y: a.y, z: eave };
    m.quad(o, { x: b.x - a.x, y: b.y - a.y, z: 0 }, { x: peak.x - a.x, y: peak.y - a.y, z: peak.z - eave }, (u, v) => {
      if (u > 1 - v + 0.001) return null;
      const c = thatch(u, v);
      return dark && c === P.thatch ? P.thatchDark : c;
    });
  };
  slope(corners[1], corners[2], true);
  slope(corners[3], corners[2], false);
  // A weathervane pole at the peak, with a little pennant in Adowvale green.
  m.box(peak.x - 0.02, peak.y - 0.02, peak.z - 2, 0.04, 0.04, 18, { top: P.iron, left: P.iron, right: P.iron });
  m.quad({ x: peak.x, y: peak.y, z: peak.z + 15 }, { x: 0.35, y: 0, z: 0 }, { x: 0, y: 0, z: -7 }, (u, v) => (Math.abs(v - 0.5) > (1 - u) * 0.5 ? null : u < 0.15 ? P.gold : P.cloakLight));
  return m;
}

export function generatePalisade(scene: Phaser.Scene): void {
  const put = (key: string, model: IsoModel) => {
    const r = model.render();
    const tex = r.canvas.toTexture(scene, key);
    MODEL_ART[key] = { key, originX: r.anchorX / tex.width, originY: r.anchorY / tex.height };
  };
  for (let i = 0; i < PALISADE_CUTS; i++) put(`palisade-${i}`, stakes(i));
  put('palisade-post', cornerPost());
  put('palisade-gateway', gateway());
  put('palisade-tower', watchtower());
}
