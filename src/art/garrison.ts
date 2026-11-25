import Phaser from 'phaser';
import { IsoModel, planks, SEAT_TOP, Shader } from './IsoModel';
import { MODEL_ART } from './interior';
import { PALETTE as P } from './palette';
import { GARRISON, PANEL_WALL_HEIGHT, RESIDENCE, RESIDENCE_CHIMNEYS } from './sizes';

/**
 * The lane past the back of Adowvale's square (see world/MarketMap.ts
 * addGarrisonLane): the militia's garrison, a squat stone blockhouse with a
 * crenellated parapet and the outside hatch down to its jail, and next door
 * the Headman's residence, a tall house of dressed stone behind a low garden
 * wall. Inside (world/GarrisonMaps.ts): the garrison's spear rack, the jail's
 * barred cells, and the residence's panelled walls, long table and writing desk.
 *
 * Everything is an IsoModel registered in MODEL_ART, anchored at its back
 * grid corner, as in market.ts.
 */

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function darken(c: number, f = 0.78): number {
  const ch = (shift: number) => Math.round(((c >> shift) & 0xff) * f) << shift;
  return ch(16) | ch(8) | ch(0);
}

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 0xff) * (1 - t) + ((b >> s) & 0xff) * t) << s;
  return ch(16) | ch(8) | ch(0);
}

/** The militia's colours: the blue and gold of their tabards. */
const MILITIA_BLUE = 0x2e4a7a;
/** The Headman's house is built of honey-coloured dressed stone, and roofed in blue slate. */
const HONEY = [0xc8b48a, 0xb8a47a, 0xd8c49a, 0xbfae86];
const HONEY_MORTAR = 0x8a7a5e;
const SLATE = [0x4e5466, 0x5a6074, 0x464c5c, 0x666c80];

/** Rough grey fieldstone in uneven courses, for the garrison's thick walls. `x` and `y` in pixels, y down from the top. */
function fieldstone(x: number, y: number, height: number, seed: number): number {
  const rowH = 7;
  const row = Math.floor(y / rowH);
  const ly = (y % rowH) / rowH;
  const s = (x + hash(row, seed + 1) * 20) / (9 + hash(row, seed + 2) * 6);
  const warped = s + 0.3 * Math.sin(s * 2.1 + row);
  const stone = Math.floor(warped);
  const lu = warped - stone;
  if (ly < 0.15 || lu < 0.09) return P.mortar;
  const tones = [0x8a8790, 0x7c7a86, 0x9d9ba6, 0x8c8478, 0x76716a, 0x6c6a74];
  let c = tones[Math.floor(hash(stone + row * 17, seed + 3) * tones.length)];
  if (ly < 0.32 || lu < 0.2) c = mix(c, 0xd2d0d8, 0.25);
  else if (ly > 0.82) c = darken(c, 0.8);
  // Damp and moss creeping up from the ground.
  if (y > height - 9 && hash(Math.floor(x), Math.floor(y) + seed) < (y - height + 9) / 14) c = mix(c, P.moss, 0.65);
  return c;
}

/** Honey-coloured ashlar in neat, tall courses. */
function honeyAshlar(x: number, y: number, seed = 0): number {
  const row = Math.floor(y / 7);
  const fx = x / 16 + (row % 2) * 0.5 + seed * 0.37;
  if (y % 7 < 1 || fx % 1 < 0.05) return HONEY_MORTAR;
  const n = hash(Math.floor(fx), row + seed * 13);
  return HONEY[Math.floor(n * HONEY.length)];
}

/** Blue slates in staggered rows down a roof slope (v runs from the ridge down). */
function slateRoof(width: number): Shader {
  return (u, v) => {
    const row = Math.floor(v * 22);
    const fx = u * width * 6 + (row % 2) * 0.5;
    if ((v * 22) % 1 < 0.14) return 0x34384a;
    if (fx % 1 < 0.08) return 0x3a3e50;
    const n = hash(Math.floor(fx), row);
    const c = SLATE[Math.floor(n * SLATE.length)];
    return v < 0.05 ? mix(c, 0xa0a6b8, 0.4) : c;
  };
}

// ---------------------------------------------------------------- the garrison


/**
 * The militia's garrison: a squat blockhouse of rough grey fieldstone, four
 * tiles by three, with a crenellated parapet round a flat leaded roof, arrow
 * slits and one barred window, a heavy iron-studded door under the militia's
 * painted shield, a lantern, and their blue-and-gold banner over the roof.
 * Its door is on the front (+y), the jail hatch beside its side wall (+x).
 */
function garrison(): IsoModel {
  const m = new IsoModel();
  const { w: W, h: D, height: H } = GARRISON;
  const PH = 13;
  const stoneTop = { top: P.stoneLight, left: (u: number, v: number) => fieldstone(u * 40, v * PH + 3, 200, 7), right: (u: number, v: number) => darken(fieldstone(u * 40, v * PH + 3, 200, 9)) };

  // The far parapets first, then the leaded roof inside them.
  m.box(0, 0, H, W, 0.22, PH, stoneTop);
  m.box(0, 0, H, 0.22, D, PH, stoneTop);
  m.quad({ x: 0.22, y: 0.22, z: H + 1 }, { x: W - 0.44, y: 0, z: 0 }, { x: 0, y: D - 0.44, z: 0 }, (u, v) => {
    const seam = (u * (W - 0.44) * 3) % 1 < 0.06;
    return seam ? 0x4a4e58 : v < 0.2 ? 0x5e626e : 0x6a6e7a;
  });
  // A hatch onto the roof, and the banner pole by the back corner.
  m.box(0.6, 0.6, H + 1, 0.5, 0.5, 2, { top: planks(3, P.plank, P.plankDark, P.plankLight, 3), left: P.plankDark, right: P.plankDark });
  m.box(W - 0.75, 0.45, H, 0.06, 0.06, 64, { top: P.barkLight, left: P.bark, right: P.barkDark });
  m.box(W - 0.79, 0.41, H + 64, 0.14, 0.14, 3, { top: P.goldLight, left: P.gold, right: 0xb08830 });
  // The banner, hanging from its cross-bar towards the viewer: blue, gold-edged, with a gold spearhead.
  m.box(W - 0.76, 0.48, H + 60, 0.03, 0.9, 1, { top: P.bark, left: P.bark, right: P.barkDark });
  m.quad({ x: W - 0.74, y: 0.5, z: H + 60 }, { x: 0, y: 0.85, z: -4 }, { x: 0, y: 0, z: -30 }, (u, v) => {
    // A swallowtail cut out of the hem.
    if (v > 0.82 && Math.abs(u - 0.5) < (v - 0.82) * 2.2) return null;
    if (u < 0.08 || u > 0.92 || v < 0.06) return P.gold;
    const cu = u - 0.5;
    if (Math.abs(cu) < 0.06 && v > 0.25 && v < 0.75) return P.goldLight;
    if (v > 0.18 && v < 0.36 && Math.abs(cu) < (0.36 - v) * 0.9) return P.goldLight;
    return u < 0.3 ? 0x40629a : MILITIA_BLUE;
  });

  const wall = (face: 'front' | 'side'): Shader => (u, v) => {
    const len = face === 'front' ? W : D;
    const x = u * len * 32;
    const y = v * H;
    const t = u * len;
    const shade = (c: number) => (face === 'side' ? darken(c, 0.8) : c);
    // A plinth of bigger stones along the foot.
    if (y > H - 6) return shade(y < H - 5 ? P.stoneLight : (Math.floor(x / 14) % 2 ? P.stone : P.stoneDark));
    if (face === 'front') {
      // The door: a round-headed opening in a dressed-stone surround, oak planks studded with iron.
      const dc = GARRISON.doorTile + 0.5;
      const dx = (t - dc) * 32;
      const archTop = H - 44 + (dx * dx) / 16;
      if (Math.abs(dx) < 15 && y > archTop - 3) {
        if (Math.abs(dx) > 11.5 || y < archTop) return (Math.floor((y + (dx > 0 ? 3 : 0)) / 5) % 2) ? P.stoneLight : P.stone;
        if (y > H - 7) return P.stoneDark;
        if (Math.abs(dx) < 0.8) return P.barkDark;
        if ((Math.floor(dx + 12) % 6 === 2) && Math.floor(y) % 5 === 0) return P.ironLight;
        if (Math.abs(y - (H - 30)) < 1.5 || Math.abs(y - (H - 14)) < 1.5) return dx < 0 ? P.ironLight : P.iron;
        if (Math.abs(dx - 5) < 1.2 && Math.abs(y - (H - 21)) < 1.2) return P.ink;
        return Math.floor(dx + 12) % 6 === 0 ? P.leatherDark : dx < 0 ? P.leatherLight : P.leather;
      }
      // The militia's shield over the door: blue, gold-rimmed, with a gold spear upright.
      const sy = y - (H - 66);
      if (Math.abs(dx) < 9 && sy > 0 && sy < 18) {
        const half = sy < 9 ? 9 : 9 - (sy - 9) * 1.0;
        if (Math.abs(dx) < half) {
          if (Math.abs(dx) > half - 1.6 || sy < 1.4) return P.gold;
          if (Math.abs(dx) < 1 && sy > 2.5 && sy < 16) return P.goldLight;
          if (sy > 2.5 && sy < 6 && Math.abs(dx) < (6 - sy) * 0.8) return P.goldLight;
          return dx < 0 ? 0x40629a : MILITIA_BLUE;
        }
      }
      // A lantern on an iron arm beside the door.
      const lx = (t - (dc + 0.62)) * 32;
      const ly = y - (H - 52);
      if (Math.abs(lx) < 3 && ly > 0 && ly < 9) return Math.abs(lx) > 2 || ly < 1.5 || ly > 7.5 ? P.iron : ly < 5 ? P.fireYellow : P.fireOrange;
      if (Math.abs(lx + 1) < 4 && ly > -2 && ly <= 0) return P.iron;
    }
    // Arrow slits, deep and dark, splayed a little at the foot.
    const slits = face === 'front' ? [0.55, 3.45] : [0.7, 2.3];
    for (const sx of slits) {
      const dx = (t - sx) * 32;
      if (Math.abs(dx) < 1.6 && y > 14 && y < 40) return P.ink;
      if (Math.abs(dx) < 3.4 && y > 12 && y < 42) return shade(P.stoneLight);
      if (Math.abs(dx) < 3 && y >= 42 && y < 44) return shade(P.stoneLight);
    }
    // One barred window on the side, for the guardroom.
    if (face === 'side') {
      const dx = (t - 1.5) * 32;
      if (Math.abs(dx) < 8 && y > 20 && y < 36) {
        if (Math.abs(dx) > 6.5 || y < 21.5 || y > 34.5) return shade(P.stoneLight);
        if (Math.abs(dx % 4) < 0.9) return P.iron;
        return y < 28 ? P.glassLit : P.fireOrange;
      }
    }
    // Dressed quoins at the corners.
    const corner = face === 'front' ? Math.min(t, W - t) : Math.min(t, D - t);
    if (corner < 0.28 && Math.floor(y / 8) % 2 === (corner * 32 < 5 ? 0 : 1)) return shade((Math.floor(y / 8) % 4 === 0 ? P.stoneLight : 0xaeacb6));
    return shade(fieldstone(x + (face === 'side' ? 200 : 0), y, H, 5));
  };
  m.quad({ x: 0, y: D, z: H }, { x: W, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, wall('front'));
  m.quad({ x: W, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: -H }, wall('side'));
  // The near parapets: merlons with crenels between, along the front and the side.
  for (let i = 0; i < W * 2; i++) {
    const tall = i % 2 === 0;
    m.box(i * 0.5, D - 0.22, H, 0.5, 0.22, tall ? PH : 6, stoneTop);
  }
  for (let i = 0; i < D * 2; i++) {
    const tall = i % 2 === 1;
    m.box(W - 0.22, i * 0.5, H, 0.22, 0.5, tall ? PH : 6, stoneTop);
  }
  // A mounting block and a water butt by the door.
  m.box(GARRISON.doorTile + 1.05, D + 0.05, 0, 0.45, 0.3, 9, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.cylinder(0.45, D + 0.3, 0, 0.24, 16, (u, v) => (v < 0.1 || Math.abs(v - 0.5) < 0.05 ? P.iron : u < 0.3 ? P.plankLight : u > 0.75 ? P.plankDark : P.plank), 0x3d5a78);
  return m;
}

/**
 * The outside hatch down to the jail: a pair of oak leaves, bound with iron and
 * padlocked shut by day (but the militia leave the key in it), set in a stone
 * curb against the garrison's side wall, sloping down away from it.
 */
function hatch(): IsoModel {
  const m = new IsoModel();
  m.box(0.08, 0.08, 0, 0.84, 0.84, 3, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  const leaf = (half: number): Shader => (u, v) => {
    if (u < 0.05 || u > 0.95 || v < 0.06 || v > 0.94) return P.barkDark;
    if (Math.abs(v - 0.25) < 0.05 || Math.abs(v - 0.72) < 0.05) return u < 0.5 ? P.ironLight : P.iron;
    if ((u * 4) % 1 < 0.07) return P.barkDark;
    return half ? P.plankDark : P.plank;
  };
  // Two leaves meeting down the middle, sloping from the wall (x = 0) out to the curb.
  m.quad({ x: 0.14, y: 0.14, z: 12 }, { x: 0.72, y: 0, z: -9 }, { x: 0, y: 0.36, z: 0 }, leaf(0));
  m.quad({ x: 0.14, y: 0.5, z: 12 }, { x: 0.72, y: 0, z: -9 }, { x: 0, y: 0.36, z: 0 }, leaf(1));
  // The hasp and padlock where they meet.
  m.box(0.6, 0.46, 5, 0.1, 0.08, 4, { top: P.ironLight, left: P.iron, right: P.ink });
  return m;
}

// ---------------------------------------------------------------- the Headman's residence


/**
 * The Headman's residence: two tall storeys of honey-coloured ashlar, seven
 * tiles by four, under a steep blue slate roof with a chimney at each end and
 * two dormers. Sash windows in stone surrounds, a string course between the
 * floors, quoins, and a pillared porch over the front door with the village's
 * arms (a gold wheatsheaf on green) carved in its pediment. Front to +y.
 */
function residence(): IsoModel {
  const m = new IsoModel();
  const { w: W, h: D, height: H, ridge: R, porch: PC } = RESIDENCE;
  const o = 0.3;
  const roof = slateRoof(W + 2 * o);
  const chimney = { top: P.soot, left: (u: number, v: number) => honeyAshlar(u * 20, v * 70, 3), right: (u: number, v: number) => darken(honeyAshlar(u * 20, v * 70, 5)) };

  // The back slope, then the chimneys up through it.
  m.quad({ x: -o, y: D / 2, z: H + R }, { x: W + 2 * o, y: 0, z: 0 }, { x: 0, y: -D / 2 - o, z: -R - 8 }, roof);
  for (const c of RESIDENCE_CHIMNEYS) {
    m.box(c.gx - 0.35, c.gy - 0.3, H + R - 30, 0.7, 0.5, 42, chimney);
    m.box(c.gx - 0.4, c.gy - 0.35, H + R + 10, 0.8, 0.6, 2, { top: HONEY[2], left: HONEY[0], right: darken(HONEY[0]) });
    for (const dx of [-0.17, 0.17]) m.cylinder(c.gx + dx, c.gy - 0.05, H + R + 12, 0.08, 5, (u) => (u < 0.4 ? 0xb8684a : 0x8a4a32), P.soot);
  }

  // Ground floor windows either side of the porch; upstairs, five across.
  const groundWins = [0.75, 1.95, 5.05, 6.25];
  const upperWins = [0.75, 1.95, PC, 5.05, 6.25];
  const sideWins = [1.0, 3.0];
  const wall = (face: 'front' | 'side'): Shader => (u, v) => {
    const len = face === 'front' ? W : D;
    const t = u * len;
    const x = t * 32;
    const y = v * H;
    const shade = (c: number) => (face === 'side' ? darken(c, 0.8) : c);
    // A plinth, and a string course between the floors.
    if (y > H - 7) return shade(y < H - 6 ? HONEY[2] : darken(HONEY[1], 0.82));
    if (y > 44 && y < 50) return shade(y < 46 ? 0xe2d2aa : y > 48 ? darken(HONEY[1], 0.85) : HONEY[2]);
    // A cornice under the eaves.
    if (y < 5) return shade(y < 2 ? 0xe2d2aa : darken(HONEY[1], 0.8));
    const upstairs = y < 46;
    const wins = face === 'side' ? sideWins : upstairs ? upperWins : groundWins;
    for (const wc of wins) {
      const dx = (t - wc) * 32;
      // Window heights: tall below, a little shorter above.
      const top = upstairs ? 11 : 58;
      const bottom = upstairs ? 40 : 88;
      if (Math.abs(dx) < 9 && y > top - 3 && y < bottom + 3) {
        // The stone surround, with a keystone over the window and a sill under it.
        if (Math.abs(dx) < 2.4 && y < top + 1) return shade(0xe8dab4);
        if (Math.abs(dx) > 7.2 || y < top || y > bottom) return shade(y > bottom ? 0xe2d2aa : 0xd8c8a0);
        // Sashes: glazing bars in a grid of panes, lit warm.
        if (Math.abs(dx) < 0.7 || (y - top) % 7 < 1) return shade(0xf0ece0);
        if (Math.abs(y - (top + bottom) / 2) < 1) return shade(0xf0ece0);
        return y < (top + bottom) / 2 ? P.glassLit : P.fireOrange;
      }
    }
    // Quoins at the corners.
    const edge = Math.min(t, len - t);
    if (edge < 0.3 && (Math.floor(y / 7) % 2 === 0 || edge < 0.18)) return shade(0xe2d2aa);
    return shade(honeyAshlar(x + (face === 'side' ? 300 : 0), y));
  };
  m.quad({ x: 0, y: D, z: H }, { x: W, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, wall('front'));
  m.quad({ x: W, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: -H }, wall('side'));
  // The gable over the side, in the same stone, with a round window in it.
  m.quad({ x: W, y: 0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => {
    if (v > 1 - Math.abs(u * 2 - 1)) return null;
    const r = Math.hypot((u - 0.5) * D * 32, (v - 0.35) * R);
    if (r < 5) return r < 1 ? 0xf0ece0 : P.glassLit;
    if (r < 7) return darken(0xe2d2aa, 0.8);
    return darken(honeyAshlar(u * D * 32 + 500, (1 - v) * R + 30), 0.8);
  });
  // The roof's edge over the gable, then the front slope.
  m.quad({ x: W, y: D / 2, z: H + R }, { x: o, y: 0, z: 0 }, { x: 0, y: -D / 2 - o, z: -R - 8 }, 0x34384a);
  m.quad({ x: -o, y: D / 2, z: H + R }, { x: W + 2 * o, y: 0, z: 0 }, { x: 0, y: D / 2 + o, z: -R - 8 }, roof);
  m.box(-o, D / 2 - 0.08, H + R - 2, W + 2 * o, 0.16, 4, { top: 0x7a8094, left: 0x464c5c, right: 0x3a3e50 });
  // Two dormers on the front slope, each a little gabled window.
  for (const dc of [1.95, 5.05]) {
    const dy = D / 2 + 0.9;
    const dz = H + R * 0.42;
    m.quad({ x: dc - 0.42, y: dy, z: dz + 22 }, { x: 0.84, y: 0, z: 0 }, { x: 0, y: 0, z: -22 }, (u, v) => {
      if (u < 0.1 || u > 0.9 || v < 0.08 || v > 0.9) return 0xe8dab4;
      if (Math.abs(u - 0.5) < 0.05 || Math.abs(v - 0.5) < 0.05) return 0xf0ece0;
      return v < 0.5 ? P.glassLit : P.fireOrange;
    });
    m.quad({ x: dc + 0.42, y: dy, z: dz + 22 }, { x: 0, y: -0.6, z: 0 }, { x: 0, y: 0, z: -22 }, darken(HONEY[0], 0.75));
    // Its little roof, two slopes meeting over the window.
    m.quad({ x: dc - 0.5, y: dy - 0.62, z: dz + 34 }, { x: 0.5, y: 0, z: 0 }, { x: 0, y: 0.68, z: -12 }, slateRoof(1));
    m.quad({ x: dc, y: dy - 0.62, z: dz + 34 }, { x: 0.5, y: 0, z: 0 }, { x: 0, y: 0.68, z: -12 }, (u, v) => darken(slateRoof(1)(u, v) ?? SLATE[0], 0.85));
    m.quad({ x: dc - 0.5, y: dy + 0.06, z: dz + 22 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 12 }, (u, v) => (v > 1 - Math.abs(u * 2 - 1) ? null : 0xe2d2aa));
  }

  // The porch: two pillars holding up a pediment, the front door behind them.
  const pw = 1.5;
  const px = PC - pw / 2;
  const depth = 0.7;
  // The door in the wall, panelled oak painted deep green, with a fanlight.
  m.quad({ x: PC - 0.42, y: D + 0.01, z: 58 }, { x: 0.84, y: 0, z: 0 }, { x: 0, y: 0, z: -58 }, (u, v) => {
    const y = v * 58;
    if (u < 0.07 || u > 0.93 || y < 3) return 0xe2d2aa;
    if (y < 15) {
      // The fanlight's spokes.
      const a = Math.atan2(15 - y, (u - 0.5) * 27);
      if (Math.abs((a * 6 / Math.PI) % 1) < 0.12) return 0xf0ece0;
      return P.glassLit;
    }
    if (Math.abs(u - 0.5) < 0.03) return 0x1e3a2a;
    const pu = (u * 2) % 1;
    const panel = pu > 0.2 && pu < 0.8 && ((y > 19 && y < 34) || (y > 38 && y < 54));
    if (Math.abs(u - 0.63) < 0.04 && Math.abs(y - 36) < 1.5) return P.gold;
    return panel ? 0x2e5a3e : 0x264a34;
  });
  // Two steps up to it.
  m.box(px - 0.1, D, 0, pw + 0.2, depth + 0.25, 3, { top: 0xe2d2aa, left: HONEY[1], right: darken(HONEY[1]) });
  m.box(px, D, 3, pw, depth, 3, { top: 0xe8dab4, left: HONEY[0], right: darken(HONEY[0]) });
  for (const cx of [px + 0.12, px + pw - 0.12]) {
    m.cylinder(cx, D + depth - 0.12, 6, 0.1, 40, (u) => (u < 0.3 ? 0xf0e6c8 : u > 0.75 ? 0xc8b890 : 0xe2d2aa), 0xe8dab4);
    m.box(cx - 0.14, D + depth - 0.26, 46, 0.28, 0.28, 3, { top: 0xf0e6c8, left: 0xe2d2aa, right: 0xc8b890 });
  }
  // The entablature over the pillars, and the triangular pediment on it.
  m.box(px - 0.08, D, 49, pw + 0.16, depth + 0.06, 6, { top: 0xe8dab4, left: 0xe2d2aa, right: 0xc8b890 });
  m.quad({ x: px - 0.08, y: D + depth + 0.06, z: 55 }, { x: pw + 0.16, y: 0, z: 0 }, { x: 0, y: 0, z: 18 }, (u, v) => {
    if (v > 1 - Math.abs(u * 2 - 1)) return null;
    if (v > 0.86 - Math.abs(u * 2 - 1) || v < 0.12) return 0xf0e6c8;
    // A wheatsheaf, gold on green, carved in the middle.
    const du = (u - 0.5) * 2;
    if (Math.abs(du) < 0.22 && v > 0.2 && v < 0.72) {
      if (Math.abs(v - 0.42) < 0.05) return 0x9a7430;
      if (v > 0.5 ? Math.abs(du) < 0.06 + (v - 0.5) * 0.5 : Math.abs(du) < 0.08 + (0.5 - v) * 0.4) return (Math.floor(du * 40) + Math.floor(v * 20)) % 2 ? P.gold : P.goldLight;
      return 0x3a6a42;
    }
    return 0xe2d2aa;
  });
  m.quad({ x: px - 0.12, y: D, z: 74 }, { x: (pw + 0.24) / 2, y: 0, z: 0 }, { x: 0, y: depth + 0.12, z: -19 }, slateRoof(1));
  m.quad({ x: PC, y: D, z: 74 }, { x: (pw + 0.24) / 2, y: 0, z: 0 }, { x: 0, y: depth + 0.12, z: -19 }, (u, v) => darken(slateRoof(1)(u, v) ?? SLATE[0], 0.8));
  // Lanterns either side of the door.
  for (const lx of [PC - 0.62, PC + 0.62]) {
    m.box(lx - 0.05, D + 0.02, 34, 0.1, 0.1, 9, {
      top: P.iron,
      left: (_u, v) => (v < 0.15 || v > 0.85 ? P.iron : P.glassLit),
      right: (_u, v) => (v < 0.15 || v > 0.85 ? P.iron : P.fireOrange),
    });
  }
  // Box hedges in tubs along the front, and climbing roses on the side.
  for (const bx of [0.75, 1.95, 5.05, 6.25]) {
    m.box(bx - 0.28, D + 0.08, 0, 0.56, 0.3, 10, { top: P.leafDark, left: (u, v) => (hash(Math.floor(u * 18), Math.floor(v * 6)) < 0.3 ? P.leafLight : P.leaf), right: P.leafDark });
  }
  return m;
}

/** A length of the low garden wall round the residence's forecourt, along x: honey stone with a rounded coping. */
function gardenWall(): IsoModel {
  const m = new IsoModel();
  m.box(0, 0.36, 0, 1, 0.28, 14, {
    top: 0xe2d2aa,
    left: (u, v) => honeyAshlar(u * 32, v * 14 + 40, 2),
    right: (u, v) => darken(honeyAshlar(u * 9, v * 14 + 40, 4)),
  });
  m.box(-0.02, 0.32, 14, 1.04, 0.36, 3, { top: 0xf0e6c8, left: 0xe2d2aa, right: 0xc8b890 });
  return m;
}

/** A gate pier: a square stone pillar with a ball on top. */
function gatePier(): IsoModel {
  const m = new IsoModel();
  m.box(0.22, 0.22, 0, 0.56, 0.56, 30, {
    top: 0xe2d2aa,
    left: (u, v) => honeyAshlar(u * 18, v * 30 + 20, 6),
    right: (u, v) => darken(honeyAshlar(u * 18, v * 30 + 20, 8)),
  });
  m.box(0.17, 0.17, 30, 0.66, 0.66, 4, { top: 0xf0e6c8, left: 0xe2d2aa, right: 0xc8b890 });
  m.cylinder(0.5, 0.5, 34, 0.16, 9, (u) => (u < 0.3 ? 0xf0e6c8 : u > 0.75 ? 0xc8b890 : 0xe2d2aa), 0xf0e6c8);
  return m;
}

/** A raised bed of roses and lavender, two tiles long, edged with stone. */
function flowerBed(): IsoModel {
  const m = new IsoModel();
  m.box(0.08, 0.15, 0, 1.84, 0.7, 6, { top: 0x5a3e28, left: (u, v) => honeyAshlar(u * 60, v * 6 + 10, 1), right: darken(HONEY[1]) });
  const blooms = [0xc8434a, 0xe86a7a, 0x9a7ad0, 0xf2e2c8, 0xb08ae0];
  for (let i = 0; i < 18; i++) {
    const bx = 0.2 + hash(i, 1) * 1.6;
    const by = 0.25 + hash(i, 2) * 0.5;
    const h = 4 + hash(i, 3) * 5;
    m.box(bx, by, 6, 0.12, 0.12, h, { top: blooms[i % blooms.length], left: P.leaf, right: P.leafDark });
  }
  return m;
}

// ---------------------------------------------------------------- inside the garrison and the jail

/** A rack of the militia's spears against the wall, with a round shield hung beside them. */
function spearRack(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.plankLight, left: P.plank, right: P.plankDark };
  m.box(0.1, 0.12, 0, 0.8, 0.12, 3, wood);
  m.box(0.1, 0.12, 30, 0.8, 0.12, 3, wood);
  for (let i = 0; i < 5; i++) {
    const x = 0.17 + i * 0.16;
    m.box(x, 0.16, 0, 0.04, 0.04, 66, { top: P.barkLight, left: P.bark, right: P.barkDark });
    m.box(x - 0.01, 0.15, 66, 0.06, 0.06, 9, { top: 0xe8ecf4, left: 0xb8bcc8, right: 0x7a7e8a });
  }
  return m;
}

/** Shields on the wall: the militia's round targes, blue with a gold boss. */
function shields(): IsoModel {
  const m = new IsoModel();
  for (const [x, z] of [[0.28, 52], [0.72, 40]] as const) {
    m.quad({ x: x - 0.22, y: 0.06, z: z + 14 }, { x: 0.44, y: 0, z: 0 }, { x: 0, y: 0, z: -28 }, (u, v) => {
      const r = Math.hypot(u - 0.5, (v - 0.5) * 1);
      if (r > 0.5) return null;
      if (r > 0.44) return P.bark;
      if (r < 0.1) return r < 0.05 ? P.goldLight : P.gold;
      return Math.floor((Math.atan2(v - 0.5, u - 0.5) / Math.PI) * 4 + 4) % 2 ? MILITIA_BLUE : 0xd8c8a4;
    });
  }
  return m;
}

/**
 * A length of iron bars along x, one tile long, on the tile's back edge (y = 0),
 * set in a stone sill and a beam overhead: a cell's front. `door` makes it the
 * cell door, hinged on one side and locked on the other.
 */
function bars(door: boolean): IsoModel {
  const m = new IsoModel();
  const H = 58;
  const iron = { top: P.ironLight, left: P.iron, right: 0x34343c };
  m.box(0, -0.04, 0, 1, 0.08, 2, { top: P.stoneLight, left: P.stone, right: P.stoneDark });
  m.box(0, -0.03, H, 1, 0.06, 3, iron);
  const n = 5;
  for (let i = 0; i < n; i++) m.box(0.06 + (i * 0.88) / (n - 1), -0.012, 2, 0.03, 0.03, H - 2, iron);
  // A cross-band or two, and the door's frame, hinges and lock.
  for (const z of door ? [12, 40] : [30]) m.box(0.02, -0.02, z, 0.96, 0.04, 2, iron);
  if (door) {
    for (const x of [0.03, 0.93]) m.box(x, -0.025, 2, 0.05, 0.05, H - 2, iron);
    m.box(0.8, 0.0, 26, 0.12, 0.08, 8, { top: P.ironLight, left: P.ink, right: P.ink });
    m.box(0.84, 0.06, 28, 0.04, 0.02, 3, { top: P.gold, left: P.gold, right: P.gold });
  }
  return m;
}

/** A wooden bucket, a stool and a pewter jug: a cell's comforts. */
function cellBits(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.3, 0.7, 0, 0.16, 10, (u, v) => (v < 0.15 || Math.abs(v - 0.6) < 0.08 ? P.iron : u < 0.3 ? P.plankLight : u > 0.7 ? P.plankDark : P.plank), 0x3a2e2a);
  m.cylinder(0.72, 0.3, 0, 0.08, 9, (u) => (u < 0.3 ? 0xb0b0ba : u > 0.7 ? 0x5e5e66 : 0x8a8a92), 0x5e5e66);
  return m;
}

/** A plain writing table, two tiles along x: a ledger open on it, a candle, an inkhorn and a pile of papers. */
function writingTable(rich: boolean): IsoModel {
  const m = new IsoModel();
  const top = rich ? 0x5a3420 : P.plankLight;
  const wood = rich ? { top, left: 0x4a2a18, right: 0x3a2012 } : { top, left: P.plank, right: P.plankDark };
  for (const [x, y] of [[0.12, 0.12], [1.8, 0.12], [0.12, 0.78], [1.8, 0.78]]) m.box(x, y, 0, 0.08, 0.08, 22, wood);
  if (rich) {
    // A carved front, drawers, and a green leather top.
    m.box(0.1, 0.84, 6, 1.8, 0.04, 16, { top, left: (u, v) => ((u * 3) % 1 < 0.04 || v < 0.1 || v > 0.9 ? 0x3a2012 : Math.abs(((u * 3) % 1) - 0.5) < 0.05 && Math.abs(v - 0.5) < 0.1 ? P.gold : 0x5a3420), right: 0x3a2012 });
  }
  m.box(0.05, 0.08, 22, 1.9, 0.84, 3, wood);
  if (rich) m.quad({ x: 0.2, y: 0.18, z: 25.1 }, { x: 1.6, y: 0, z: 0 }, { x: 0, y: 0.64, z: 0 }, (u, v) => (u < 0.03 || u > 0.97 || v < 0.05 || v > 0.95 ? P.gold : 0x2e5a3e));
  // The ledger, open.
  m.quad({ x: 0.55, y: 0.3, z: 25.5 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0.42, z: 0 }, (u, v) => {
    if (Math.abs(u - 0.5) < 0.02) return P.linenDark;
    if ((v * 10) % 1 < 0.3 && v > 0.12 && v < 0.88 && Math.abs(u - 0.5) > 0.06 && Math.abs(u - 0.5) < 0.44) return 0x6a5a4a;
    return 0xf0e6cc;
  });
  // Papers, an inkhorn with a quill, and a candle in a brass stick.
  m.box(1.4, 0.25, 25, 0.32, 0.4, 2, { top: 0xe8dcc0, left: 0xd8ccb0, right: 0xc8bca0 });
  m.box(1.47, 0.6, 25, 0.08, 0.08, 4, { top: P.ink, left: P.ink, right: P.ink });
  m.quad({ x: 1.51, y: 0.62, z: 29 }, { x: 0.12, y: -0.05, z: 10 }, { x: 0.03, y: 0, z: 0 }, 0xf8f4ec);
  m.box(0.22, 0.3, 25, 0.12, 0.12, 2, { top: P.goldLight, left: P.gold, right: 0x9a7430 });
  m.box(0.25, 0.33, 27, 0.06, 0.06, 7, { top: P.flowerWhite, left: P.flowerWhite, right: P.linen });
  m.box(0.25, 0.33, 34, 0.06, 0.06, 3, { top: P.fireYellow, left: P.fireYellow, right: P.fireOrange });
  return m;
}

// ---------------------------------------------------------------- inside the residence

export type PanelWallKind = 'plain' | 'window' | 'portrait' | 'tapestry' | 'door' | 'sconce';

const OAK = 0x6a4428;
const OAK_DARK = 0x4a2c18;
const OAK_LIGHT = 0x8a5c36;
const PLASTER = 0xe6dcc4;

/**
 * The residence's walls: oak panelling to the dado rail, warm plaster above
 * under a moulded cornice, hung with portraits of past Headmen, a tapestry of
 * the harvest, candle sconces, or a tall window.
 */
function panelWall(kind: PanelWallKind, index: number): Shader {
  const H = PANEL_WALL_HEIGHT;
  return (u, v) => {
    const x = u * 32;
    const y = v * H;
    if (y < 6) return y < 2 ? OAK_LIGHT : y < 4 ? OAK : OAK_DARK;
    if (y > H - 5) return y > H - 2 ? OAK_DARK : OAK;
    // The door: a tall panelled doorway in a moulded frame.
    if (kind === 'door' && x > 5 && x < 27 && y > 22) {
      if (x < 7.5 || x > 24.5 || y < 25) return OAK_LIGHT;
      if (Math.abs(x - 16) < 0.7) return OAK_DARK;
      const pu = ((x - 7.5) / 8.5) % 1;
      if (pu > 0.18 && pu < 0.82 && ((y > 30 && y < 55) || (y > 60 && y < 90))) return pu < 0.24 || y < 32 || (y > 60 && y < 62) ? OAK_LIGHT : OAK;
      if (Math.abs(x - 21) < 1 && Math.abs(y - 58) < 1.5) return P.gold;
      return OAK_DARK;
    }
    if (kind === 'window' && x > 6 && x < 26 && y > 14 && y < 74) {
      if (x < 8 || x > 24 || y < 16 || y > 72) return 0xf0ece0;
      if (Math.abs(x - 16) < 0.7 || (y - 16) % 9 < 1 || Math.abs(x - 12) < 0.4 || Math.abs(x - 20) < 0.4) return 0xf0ece0;
      const glint = (x - y + 80) % 16;
      if (glint < 2) return P.glassLight;
      return y < 44 ? P.glass : P.glassDark;
    }
    if (kind === 'window' && x > 4 && x < 28 && y >= 74 && y < 78) return OAK_LIGHT;
    // Above the dado: plaster, and what hangs on it.
    if (y < 58) {
      if (y > 55) return y < 56.5 ? OAK_LIGHT : OAK;
      if (kind === 'portrait' && x > 6 && x < 26 && y > 12 && y < 48) {
        if (x < 8 || x > 24 || y < 14 || y > 46) return (Math.floor(x + y) % 3 === 0) ? P.goldLight : P.gold;
        // A stern old Headman in black, his chain of office catching the light.
        const fx = x - 16;
        const fy = y - 24;
        const sitter = index % 2 === 0 ? 0x2a2026 : 0x3a2a1e;
        if (fx * fx / 16 + fy * fy / 22 < 1) return fy < -3 ? (index % 2 ? 0x8a7a6a : 0x4a3a30) : fx < 0 ? 0xd8a888 : 0xb88868;
        if (y > 29 && Math.abs(fx) < 2 + (y - 29) * 0.55) {
          if (Math.abs(Math.abs(fx) - (y - 29) * 0.3) < 0.8 && y < 40) return P.gold;
          return sitter;
        }
        return y < 30 ? 0x3a4a3a : 0x2a3a2e;
      }
      if (kind === 'tapestry' && x > 3 && x < 29 && y > 8 && y < 54) {
        if (y < 10) return P.barkDark;
        if (x < 5 || x > 27 || y > 51) return P.gold;
        // A harvest: gold sheaves standing in a green field under a blue sky.
        if (y < 24) return (Math.floor(x / 3) + Math.floor(y / 3)) % 7 === 0 ? 0xe8e0d0 : 0x4a6a9a;
        const sheaf = (Math.floor(x / 6) % 2 === 0) && y > 28 && Math.abs(((x % 6) - 3)) < (y < 36 ? 2.5 - (y - 28) * 0.15 : 1.4);
        if (sheaf) return (Math.floor(y) % 2) ? P.gold : 0xc8962e;
        return (Math.floor(x) + Math.floor(y)) % 5 === 0 ? 0x3a5a2a : 0x4a7a3a;
      }
      if (kind === 'sconce' && Math.abs(x - 16) < 4 && y > 24 && y < 44) {
        if (y > 38) return Math.abs(x - 16) < 3 ? P.gold : PLASTER;
        if (Math.abs(x - 16) < 1.2 && y > 30) return P.flowerWhite;
        if (Math.abs(x - 16) < 1.4 && y > 25 && y <= 30) return y < 27 ? P.fireYellow : P.fireOrange;
      }
      const n = hash(Math.floor(x / 4), Math.floor(y / 4) + index * 7);
      return n < 0.08 ? 0xdcd0b4 : PLASTER;
    }
    // Oak panelling: raised panels in a frame of rails and stiles.
    const px = x % 16;
    const py = (y - 58) % 19;
    if (px < 2 || px > 14 || py < 2 || py > 17) return OAK_DARK;
    if (px < 3 || py < 3) return OAK_LIGHT;
    if (px > 13 || py > 16) return 0x3a2212;
    return hash(Math.floor(x / 16) + index, Math.floor(y / 19)) < 0.5 ? OAK : 0x72482a;
  };
}

function makePanelWall(scene: Phaser.Scene, key: string, side: 'back' | 'side', kind: PanelWallKind, index: number): void {
  const m = new IsoModel();
  const H = PANEL_WALL_HEIGHT;
  const face = panelWall(kind, index);
  const cap = 0.16;
  if (side === 'back') {
    m.quad({ x: 0, y: 0, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -H }, face);
    m.quad({ x: 0, y: -cap, z: H }, { x: 1, y: 0, z: 0 }, { x: 0, y: cap, z: 0 }, OAK_LIGHT);
  } else {
    m.quad({ x: 0, y: 0, z: H }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -H }, (u, v) => {
      const c = face(u, v);
      return c === null ? null : darken(c, 0.84);
    });
    m.quad({ x: -cap, y: 0, z: H }, { x: cap, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, OAK_LIGHT);
  }
  put(scene, key, m, false);
}

/** The long table in the hall, three tiles along x: a white runner, pewter plates and two candlesticks. */
/**
 * One tile of the long dining table, so each piece sorts with the chairs
 * beside it: 0 is the end nearest the hall's side wall, 1 the middle, 2 the
 * far end. Legs at the ends, a linen runner the whole length, pewter plates
 * for both sides, candlesticks near each end and apples in the middle.
 */
function tablePiece(i: 0 | 1 | 2): IsoModel {
  const m = new IsoModel();
  const wood = { top: 0x5a3420, left: 0x4a2a18, right: 0x3a2012 };
  const x0 = i === 0 ? 0.05 : 0;
  const x1 = i === 2 ? 0.95 : 1;
  for (const lx of i === 0 ? [0.15] : i === 2 ? [0.75] : []) for (const ly of [0.15, 0.75]) m.box(lx, ly, 0, 0.1, 0.1, 22, wood);
  m.box(x0, 0.08, 22, x1 - x0, 0.84, 3, wood);
  m.quad({ x: x0, y: 0.33, z: 25.1 }, { x: x1 - x0, y: 0, z: 0 }, { x: 0, y: 0.34, z: 0 }, (_u, v) => (v < 0.08 || v > 0.92 ? 0xc8b48a : 0xf4eedc));
  for (const py of [0.22, 0.78]) m.cylinder(0.5, py, 25, 0.13, 1, () => 0x8a8a92, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0x9a9aa4 : 0xb0b0ba));
  if (i === 1) {
    m.cylinder(0.5, 0.5, 25, 0.18, 4, () => 0x8a6a4a, 0x6a4a2a);
    for (const [ax, ay] of [[0.44, 0.44], [0.56, 0.5], [0.48, 0.58]]) m.cylinder(ax, ay, 28, 0.06, 3, (u) => (u < 0.4 ? 0xe8604a : 0xa83a2a), 0xc84a3a);
  } else {
    const cx = i === 0 ? 0.88 : 0.12;
    m.cylinder(cx, 0.5, 25, 0.06, 12, (u) => (u < 0.4 ? P.goldLight : P.gold), P.gold);
    m.box(cx - 0.03, 0.47, 37, 0.06, 0.06, 7, { top: P.flowerWhite, left: P.flowerWhite, right: P.linen });
    m.box(cx - 0.03, 0.47, 44, 0.06, 0.06, 3, { top: P.fireYellow, left: P.fireYellow, right: P.fireOrange });
  }
  return m;
}

/**
 * A high-backed oak chair. As drawn it has its back to the room's back wall
 * (y = 0) and faces +y; `turned` puts the back on the near side (y = 1), so it
 * faces -y, towards the back wall. Mirroring either (flipX) swaps x and y: the
 * plain one then faces +x, the turned one -x.
 */
function chair(grand: boolean, turned = false): IsoModel {
  const m = new IsoModel();
  const wood = { top: OAK_LIGHT, left: OAK, right: OAK_DARK };
  const seat = grand ? 0x7a2a2a : 0x2e5a3e;
  for (const [x, y] of [[0.22, 0.22], [0.7, 0.22], [0.22, 0.7], [0.7, 0.7]]) m.box(x, y, 0, 0.08, 0.08, SEAT_TOP - 3, wood);
  m.box(0.2, 0.2, SEAT_TOP - 3, 0.6, 0.6, 3, { top: seat, left: darken(seat), right: darken(seat, 0.6) });
  const back = SEAT_TOP + (grand ? 38 : 24);
  const by = turned ? 0.72 : 0.2;
  const face = (u: number, v: number) => (u < 0.12 || u > 0.88 || v < 0.1 ? OAK_DARK : grand && v < 0.4 && Math.abs(u - 0.5) < 0.12 ? P.gold : seat);
  m.box(0.2, by, SEAT_TOP - 3, 0.6, 0.08, back - SEAT_TOP + 3, turned
    // Seen from behind: plain oak with a carved rail.
    ? { top: OAK_LIGHT, left: (u, v) => (u < 0.12 || u > 0.88 || v < 0.1 || Math.abs(v - 0.45) < 0.04 ? OAK_DARK : OAK), right: OAK_DARK }
    : { top: OAK_LIGHT, left: face, right: OAK_DARK });
  if (grand) for (const x of [0.2, 0.72]) m.box(x, by, back, 0.08, 0.08, 6, { top: P.goldLight, left: P.gold, right: 0x9a7430 });
  return m;
}

/** A Turkey carpet in red, blue and gold, `w` by `h` tiles, laid under the table or the desk. */
function carpet(w: number, h: number): IsoModel {
  const m = new IsoModel();
  m.quad({ x: 0.1, y: 0.1, z: 0 }, { x: w - 0.2, y: 0, z: 0 }, { x: 0, y: h - 0.2, z: 0 }, (u, v) => {
    const eu = Math.min(u, 1 - u) * (w - 0.2);
    const ev = Math.min(v, 1 - v) * (h - 0.2);
    const e = Math.min(eu, ev);
    if (e < 0.04) return (Math.floor(u * w * 10) + Math.floor(v * h * 10)) % 2 ? 0xe8dcc0 : null;
    if (e < 0.18) return Math.floor((eu < ev ? v * h : u * w) * 4) % 2 ? 0x2a3a6a : 0x7a2420;
    if (e < 0.22) return P.gold;
    const d = Math.abs(u - 0.5) * w * 0.5 + Math.abs(v - 0.5) * h * 0.5;
    if (Math.abs(d - 0.7) < 0.06 || Math.abs(d - 0.3) < 0.05) return P.gold;
    if (d < 0.3) return 0x2a3a6a;
    return (Math.floor(u * w * 3) + Math.floor(v * h * 3)) % 2 ? 0x8a2a24 : 0x9a3028;
  });
  return m;
}

/** The kitchen corner's work bench along the side wall (two tiles in y): a chopping board, a loaf, onions and a jug, with sacks and a crock underneath. */
function kitchenBench(): IsoModel {
  const m = new IsoModel();
  const wood = { top: P.plankLight, left: P.plank, right: P.plankDark };
  for (const [x, y] of [[0.1, 0.08], [0.1, 1.82], [0.78, 0.08], [0.78, 1.82]]) m.box(x, y, 0, 0.08, 0.08, 20, wood);
  m.box(0.05, 0.05, 6, 0.85, 1.9, 2, wood);
  m.box(0.05, 0.05, 20, 0.85, 1.9, 4, { top: (_u, v) => ((v * 12) % 1 < 0.06 ? P.plank : P.plankLight), left: P.plank, right: P.plankDark });
  // A chopping board with a loaf and a knife, onions, a jug.
  m.box(0.25, 0.25, 24, 0.5, 0.6, 1.5, { top: 0xc8a070, left: 0xa88050, right: 0x886030 });
  m.cylinder(0.5, 0.45, 25.5, 0.16, 6, (u) => (u < 0.4 ? 0xd8a058 : 0xa8702c), 0xc88a40);
  m.box(0.45, 0.68, 25.5, 0.06, 0.16, 0.6, { top: 0xd8dce4, left: 0xb8bcc8, right: 0x8a8e9a });
  for (const [ox, oy] of [[0.35, 1.1], [0.55, 1.18], [0.42, 1.3]]) m.cylinder(ox, oy, 24, 0.07, 4, (u) => (u < 0.4 ? 0xe8d8a8 : 0xb89868), 0xd8c088);
  m.cylinder(0.5, 1.6, 24, 0.12, 12, (u) => (u < 0.4 ? 0xc89070 : 0x9a6248), 0x5a3420);
  // Sacks and a crock underneath.
  m.cylinder(0.45, 0.5, 8, 0.22, 10, (u) => (u < 0.4 ? 0xd8c8a0 : 0xa89870), 0xc8b890);
  m.cylinder(0.45, 1.3, 8, 0.2, 9, (u) => (u < 0.4 ? 0xb07a4a : 0x80502a), 0x6a4020);
  return m;
}

/** A suit of old armour on a stand: a great helm, a mail coat, and a kite shield in the village's green and gold. */
function armour(): IsoModel {
  const m = new IsoModel();
  const steel = { top: 0xe8ecf4, left: 0xb8bcc8, right: 0x7a7e8a };
  m.box(0.3, 0.3, 0, 0.4, 0.4, 3, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.box(0.47, 0.47, 3, 0.06, 0.06, 20, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  m.box(0.32, 0.38, 22, 0.36, 0.24, 26, { top: 0xb8bcc8, left: (u, v) => ((Math.floor(u * 20) + Math.floor(v * 30)) % 2 ? 0x9a9aa6 : 0xb8bcc8), right: 0x7a7e8a });
  m.box(0.36, 0.4, 48, 0.28, 0.2, 14, steel);
  m.box(0.36, 0.6, 54, 0.28, 0.01, 2, { top: P.ink, left: P.ink, right: P.ink });
  m.quad({ x: 0.22, y: 0.7, z: 46 }, { x: 0.3, y: 0, z: 0 }, { x: 0, y: 0, z: -28 }, (u, v) => {
    if (u > 1 - v * 0.2 && v > 0.6) return null;
    const w = v < 0.55 ? 0.5 : 0.5 - (v - 0.55) * 1.1;
    if (Math.abs(u - 0.5) > w) return null;
    if (Math.abs(u - 0.5) > w - 0.08 || v < 0.06) return P.gold;
    return Math.abs(u - 0.5) < 0.08 && v > 0.15 && v < 0.75 ? P.gold : 0x3a6a42;
  });
  return m;
}

/** A tall dresser of the household's best plates and jugs. */
function dresser(): IsoModel {
  const m = new IsoModel();
  m.box(0.05, 0.1, 0, 0.9, 0.5, 26, { top: OAK_LIGHT, left: (u, v) => (v < 0.08 || (u * 2) % 1 < 0.05 ? OAK_DARK : Math.abs(((u * 2) % 1) - 0.5) < 0.04 && Math.abs(v - 0.4) < 0.08 ? P.gold : OAK), right: OAK_DARK });
  m.box(0.05, 0.1, 26, 0.9, 0.18, 40, {
    top: OAK_LIGHT,
    left: (u, v) => {
      const y = v * 40;
      if (u < 0.05 || u > 0.95 || y < 3) return OAK_DARK;
      const shelf = Math.floor(y / 12.5);
      const ly = y % 12.5;
      if (ly < 1.6) return OAK_LIGHT;
      // Plates stood on edge, and a jug at each end.
      const pu = (u * 5) % 1;
      const pr = Math.hypot(pu - 0.5, (ly - 7) / 10);
      if (pr < 0.32) return pr < 0.12 ? 0x4a6a9a : pr > 0.27 ? 0x4a6a9a : 0xf0ece0;
      return shelf === 1 ? 0x3a2212 : OAK_DARK;
    },
    right: OAK_DARK,
  });
  return m;
}

// ---------------------------------------------------------------- registry

function put(scene: Phaser.Scene, key: string, model: IsoModel, outline = true): void {
  const r = model.render(outline);
  const tex = r.canvas.toTexture(scene, key);
  MODEL_ART[key] = { key, originX: r.anchorX / tex.width, originY: r.anchorY / tex.height };
}

export function generateGarrison(scene: Phaser.Scene): void {
  put(scene, 'bld-garrison', garrison());
  put(scene, 'gar-hatch', hatch());
  put(scene, 'bld-residence', residence());
  put(scene, 'res-gardenwall', gardenWall());
  put(scene, 'res-pier', gatePier());
  put(scene, 'res-flowerbed', flowerBed());
  put(scene, 'gar-rack', spearRack());
  put(scene, 'gar-shields', shields(), false);
  // Drawn without an outline, so the bars stay thin enough to see who's behind them.
  put(scene, 'gar-bars', bars(false), false);
  put(scene, 'gar-bars-door', bars(true), false);
  put(scene, 'gar-cellbits', cellBits());
  put(scene, 'gar-desk', writingTable(false));
  put(scene, 'res-desk', writingTable(true));
  for (const i of [0, 1, 2] as const) put(scene, `res-table-${i}`, tablePiece(i));
  put(scene, 'res-chair', chair(false));
  put(scene, 'res-chair-turned', chair(false, true));
  put(scene, 'res-chair-grand', chair(true));
  put(scene, 'res-carpet-dining', carpet(5, 3), false);
  put(scene, 'res-carpet-study', carpet(4, 3), false);
  put(scene, 'res-kitchen-bench', kitchenBench());
  put(scene, 'res-armour', armour());
  put(scene, 'res-dresser', dresser());
  const kinds: PanelWallKind[] = ['plain', 'window', 'portrait', 'tapestry', 'door', 'sconce'];
  for (const kind of kinds) {
    for (let i = 0; i < 2; i++) {
      makePanelWall(scene, `pwall-back-${kind}-${i}`, 'back', kind, i);
      makePanelWall(scene, `pwall-side-${kind}-${i}`, 'side', kind, i);
    }
  }
  const corner = new IsoModel();
  corner.box(-0.16, -0.16, 0, 0.3, 0.3, PANEL_WALL_HEIGHT + 2, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  put(scene, 'pwall-corner', corner);
}
