import Phaser from 'phaser';
import { MODEL_ART } from './interior';
import { IsoModel, planks, Shader } from './IsoModel';
import { PALETTE as P } from './palette';

/**
 * Lord Morten's toll gate on the road north out of Adowvale: two stone
 * pillars under a timber lintel, a heavy plank gate between them (shut, or
 * swung open once the tithe is paid), sharpened-stake palisade either side,
 * the guards' booth and a banner in Morten's crimson and black.
 */

/** Lord Morten's colours. */
export const MORTEN = { crimson: 0x8a1c26, crimsonLight: 0xb0303a, crimsonDark: 0x5e121a, black: 0x262028 };

/** Dressed stone in courses, with staggered joints. */
const ashlar = (base: number, dark: number, courses = 7): Shader => (u, v) => {
  const row = Math.floor(v * courses);
  if ((v * courses) % 1 < 0.14) return P.mortar;
  if ((u * 2 + row * 0.5) % 1 < 0.07) return P.mortar;
  return (row + Math.floor(u * 2 + row * 0.5)) % 3 === 0 ? dark : base;
};

/** Upright boards with iron bands, and (with `points`) sharpened tops. */
function gateBoards(boards: number, points: boolean): Shader {
  return (u, v) => {
    const fu = (u * boards) % 1;
    if (points && v < 0.1 && Math.abs(fu - 0.5) > (v / 0.1) * 0.5) return null;
    if (fu < 0.12) return P.plankDark;
    if ((v > 0.22 && v < 0.29) || (v > 0.72 && v < 0.79)) return Math.abs(fu - 0.5) < 0.12 ? P.ironLight : P.iron;
    return fu > 0.8 ? P.plank : P.plankLight;
  };
}

/** A gate pier of dressed stone with a capstone, and Morten's pennant on its face. */
function pier(m: IsoModel, x: number): void {
  const h = 60;
  const w = 0.84;
  m.box(x, 0.3, 0, w, 0.4, h, {
    top: P.stoneLight,
    left: (u, v) => {
      if (u > 0.3 && u < 0.7 && v > 0.08 && v < 0.52 - Math.abs(u - 0.5) * 0.4) {
        if (u < 0.34 || u > 0.66 || v < 0.13) return MORTEN.black;
        return Math.abs(u - 0.5) < 0.05 && v > 0.16 && v < 0.4 ? P.gold : MORTEN.crimson;
      }
      return ashlar(P.stone, P.stoneDark)(u, v);
    },
    right: ashlar(P.stoneDark, P.mortar),
  });
  m.box(x - 0.04, 0.26, h, w + 0.08, 0.48, 5, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.box(x + 0.2, 0.38, h + 5, w - 0.4, 0.24, 4, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
}

/**
 * The gate, four tiles wide along x: a stone pier on the outer tiles and the
 * two leaves across the road between them. Shut, or swung back to let the road through.
 */
function gate(open: boolean): IsoModel {
  const m = new IsoModel();
  const leaf = { top: P.plankLight, left: gateBoards(8, true), right: P.plankDark };
  const swung = { top: P.plankLight, left: P.plankDark, right: gateBoards(7, true) };
  pier(m, 0.12);
  if (open) {
    // Each leaf swung back on its hinges, standing out from its pier.
    m.box(0.96, 0.5, 0, 0.07, 0.95, 46, swung);
  } else {
    m.box(0.96, 0.46, 0, 1.04, 0.08, 46, leaf);
    m.box(2.0, 0.46, 0, 1.04, 0.08, 46, leaf);
  }
  if (open) m.box(2.97, 0.5, 0, 0.07, 0.95, 46, swung);
  pier(m, 3.04);
  // A heavy timber lintel from pier to pier.
  m.box(0.4, 0.42, 69, 3.2, 0.16, 7, { top: P.plankLight, left: planks(2, P.plank, P.plankDark, P.plankLight, 3), right: P.plankDark });
  return m;
}

/** A tile of palisade: sharpened logs along x, lashed to two rails. */
function palisade(): IsoModel {
  const m = new IsoModel();
  const bark: Shader = (u, v) => (u > 0.7 ? P.logDark : u < 0.2 ? P.logLight : (v * 9 + u * 3) % 1 < 0.12 ? P.logDark : P.log);
  for (let i = 0; i < 6; i++) {
    const cx = 0.085 + i * 0.166;
    const h = 38 + ((i * 7) % 5);
    m.cylinder(cx, 0.5, 0, 0.08, h, bark, P.logLight);
    // Whittled to a point.
    m.cylinder(cx, 0.5, h, 0.055, 3, () => P.logLight, P.ashLight);
    m.cylinder(cx, 0.5, h + 3, 0.03, 3, () => P.ashLight, P.ashLight);
  }
  for (const z of [10, 28]) m.box(0, 0.6, z, 1, 0.05, 3, { top: P.plankLight, left: P.plank, right: P.plankDark });
  return m;
}

/** The guards' booth: a plank hut with a shingled roof and a serving hatch looking onto the road. */
function booth(): IsoModel {
  const m = new IsoModel();
  m.box(0.12, 0.12, 0, 0.76, 0.76, 36, {
    top: P.plank,
    left: (u, v) => {
      if (u > 0.25 && u < 0.75 && v > 0.22 && v < 0.55) return v > 0.5 ? P.plankLight : P.ink;
      return planks(6, P.plank, P.plankDark, P.plankLight, 5)(u, v);
    },
    right: planks(6, P.plankDark, P.barkDark, P.plank, 9),
  });
  const shingles: Shader = (u, v) => {
    const row = Math.floor(v * 5);
    return (u * 6 + row * 0.5) % 1 < 0.1 || (v * 5) % 1 > 0.85 ? MORTEN.crimsonDark : MORTEN.crimson;
  };
  m.box(0.02, 0.02, 36, 0.96, 0.96, 3, { top: shingles, left: MORTEN.crimsonDark, right: MORTEN.crimsonDark });
  m.box(0.16, 0.16, 39, 0.68, 0.68, 4, { top: shingles, left: MORTEN.crimsonDark, right: MORTEN.crimsonDark });
  m.box(0.34, 0.34, 43, 0.32, 0.32, 3, { top: MORTEN.crimsonLight, left: MORTEN.crimsonDark, right: MORTEN.crimsonDark });
  return m;
}

/** A tall pole flying Lord Morten's banner: crimson, bordered in black, with a gold tower. */
function banner(): IsoModel {
  const m = new IsoModel();
  m.box(0.46, 0.46, 0, 0.08, 0.08, 84, { top: P.gold, left: P.bark, right: P.barkDark });
  m.box(0.3, 0.48, 78, 0.5, 0.04, 2, { top: P.barkLight, left: P.bark, right: P.barkDark });
  m.quad({ x: 0.32, y: 0.5, z: 77 }, { x: 0.46, y: 0, z: 0 }, { x: 0, y: 0, z: -34 }, (u, v) => {
    // A swallow-tailed hem.
    if (v > 0.86 && Math.abs(u - 0.5) < (v - 0.86) * 3) return null;
    if (u < 0.1 || u > 0.9 || v < 0.06) return MORTEN.black;
    const tower = (Math.abs(u - 0.5) < 0.13 && v > 0.3 && v < 0.7) || (v > 0.24 && v < 0.32 && Math.abs(u - 0.5) < 0.18 && (u * 12) % 1 < 0.6);
    if (tower) return P.gold;
    return u > 0.75 ? MORTEN.crimsonDark : MORTEN.crimson;
  });
  return m;
}

export function generateTollGate(scene: Phaser.Scene): void {
  const put = (key: string, model: IsoModel) => {
    const r = model.render();
    const tex = r.canvas.toTexture(scene, key);
    MODEL_ART[key] = { key, originX: r.anchorX / tex.width, originY: r.anchorY / tex.height };
  };
  put('toll-gate', gate(false));
  put('toll-gate-open', gate(true));
  put('toll-palisade', palisade());
  put('toll-booth', booth());
  put('toll-banner', banner());
}
