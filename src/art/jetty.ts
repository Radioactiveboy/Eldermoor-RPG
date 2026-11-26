import Phaser from 'phaser';
import { MODEL_ART, registerModel } from './interior';
import { inFrontOf, IsoModel, project, RenderedModel, SEAT_TOP, Shader, Vec3 } from './IsoModel';
import { PALETTE as P } from './palette';
import { PixelCanvas, seededRandom } from './PixelCanvas';
import { smoothNoise } from './scorch';

/**
 * Adowvale Jetty (see world/JettyMap.ts), the village's landing on the river
 * Wend: the timber pier on its piles, the stone quay and its crane, the Grey
 * Heron (Maren Tull's single-masted river boat) and the rowing boats, the
 * fishing huts, smokehouse and boathouse along the front, nets and eel traps
 * and creels, reeds and lilies along the banks, and a heron on the eyot.
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
const lighten = (c: number, f = 0.2) => mix(c, 0xffffff, f);

// ---------------------------------------------------------------- colours

/** Silvered oak, weathered by the river: the pier, the piles, the slipway. */
const OAK = 0x8c7c66;
const OAK_DARK = 0x5e5040;
const OAK_LIGHT = 0xb0a088;
const OAK_GAP = 0x2a231c;
/** Wet timber at the waterline, green with weed. */
const WEED = 0x3e5a36;
const WEED_DARK = 0x26381f;
const SLIME = 0x5a6e3a;
/** Tarred weatherboard on the huts and the boathouse. */
const TAR = 0x3c3632;
const TAR_DARK = 0x272220;
const TAR_LIGHT = 0x524a44;
/** Limewashed boards on the Pellows' hut. */
const LIME = 0xd8d2c2;
const LIME_DARK = 0xaaa290;
/** Hemp nets and rope. */
const NET = 0x8a7a5a;
const NET_DARK = 0x5e523a;
const ROPE = 0xc0a878;
const ROPE_DARK = 0x8a764e;
/** Cork floats on the nets, and the red-painted ones. */
const CORK = 0xc89a5a;
const FLOAT_RED = 0xb8423a;
/** Wicker: eel traps, creels and baskets. */
const WICKER = 0xb89058;
const WICKER_DARK = 0x7e5e32;
const WICKER_LIGHT = 0xd8b478;
/** Fish: silver scales, and smoked gold. */
const SILVER = 0xc8d0d4;
const SILVER_DARK = 0x7e8a94;
const SMOKED = 0xc08a3a;
const SMOKED_DARK = 0x7a4e1e;
/** The Grey Heron's paint: grey-blue topsides, a white band and a red rubbing strake. */
const HERON_GREY = 0x6e8090;
const HERON_GREY_DARK = 0x4a5866;
const HERON_WHITE = 0xe8e4d8;
const HERON_RED = 0xa83a2e;
/** Tanned canvas, furled. */
const SAIL = 0xb8865a;
const SAIL_DARK = 0x8a5e3a;
const SAIL_LIGHT = 0xd8a878;
/** River stone for the quay, and its mortar. */
const QUAY = 0x8a8680;
const QUAY_DARK = 0x5e5a56;
const QUAY_LIGHT = 0xaaa69e;
const MORTAR = 0x6a665e;
/** Reeds and flags. */
const REED = 0x7a9a4a;
const REED_DARK = 0x4a6a2e;
const REED_LIGHT = 0xa8c06a;
const REED_DRY = 0xc0b070;
const MACE = 0x6a4428;
const FLAG_YELLOW = 0xf0c838;

// ---------------------------------------------------------------- shaders

/** Weathered planks along u, `count` across v, with dark gaps, grain, nail heads and the odd newer board. */
function boards(count: number, seed: number, base = OAK, dark = OAK_DARK, light = OAK_LIGHT): Shader {
  return (u, v) => {
    const fv = v * count;
    const row = Math.floor(fv);
    const lv = fv - row;
    if (lv < 0.11) return OAK_GAP;
    // Board ends, staggered.
    const joint = (u * 1.3 + hash(row, seed) * 0.9) % 1;
    if (joint < 0.02) return OAK_GAP;
    const fresh = hash(row, seed + 7) < 0.12;
    const b = fresh ? mix(base, 0xb08a5a, 0.45) : base;
    // Nail heads near each board end.
    if ((joint < 0.06 || joint > 0.94) && Math.abs(lv - 0.55) < 0.16) return P.iron;
    const grain = Math.sin(u * 70 + row * 13 + seed) * Math.sin(u * 23 + row * 3);
    if (grain > 0.78) return dark;
    if (lv < 0.24) return light;
    if (lv > 0.88) return mix(b, dark, 0.5);
    const n = smoothNoise(u * 12, v * 3 + row, seed);
    return n > 0.68 ? mix(b, light, 0.4) : n < 0.28 ? mix(b, dark, 0.35) : b;
  };
}

/** Overlapping weatherboards, horizontal, `count` up the face, each throwing a shadow on the one below. */
function weatherboard(count: number, seed: number, base: number, dark: number, light: number): Shader {
  return (u, v) => {
    const fv = v * count;
    const row = Math.floor(fv);
    const lv = fv - row;
    if (lv > 0.86) return darken(dark, 0.7);
    if (lv < 0.14) return light;
    const n = hash(Math.floor(u * 40), row + seed);
    const patch = hash(Math.floor(u * 5 + row * 0.3), row + seed + 3) < 0.08;
    const b = patch ? mix(base, 0x7a5a3a, 0.35) : base;
    return n < 0.12 ? dark : n > 0.9 ? light : b;
  };
}

/** Dressed river stone in courses, mortared, with moss in the joints and weed and slime below the waterline. */
function quayStone(seed: number, water: number): Shader {
  return (u, v) => {
    const courses = 4;
    const row = Math.floor(v * courses);
    const lv = v * courses - row;
    const off = (row % 2) * 0.5 + hash(row, seed) * 0.3;
    const fu = u * 2.2 + off;
    const block = Math.floor(fu);
    const lu = fu - block;
    const wet = v > water;
    if (lv < 0.09 || lu < 0.05) return wet ? WEED_DARK : v < 0.3 && hash(block, row + seed) < 0.4 ? P.moss : MORTAR;
    const n = hash(block + seed * 3, row);
    let c = n < 0.3 ? QUAY_DARK : n > 0.75 ? QUAY_LIGHT : QUAY;
    c = mix(c, 0x9a8870, hash(block, row + 5) * 0.25);
    if (lv < 0.2) c = lighten(c, 0.12);
    if (lv > 0.85) c = darken(c, 0.85);
    // Weed thick at the waterline, slime under it, darker and greener the deeper it goes.
    if (wet) {
      const d = (v - water) / (1 - water);
      c = mix(c, d < 0.25 ? SLIME : WEED, 0.55 + d * 0.35);
    } else if (v > water - 0.08 && hash(Math.floor(u * 60), 3) < 0.6) c = mix(c, SLIME, 0.5);
    return c;
  };
}

/** Thatch combed down the slope, with a darker trimmed edge at the eaves and moss in the hollows. */
function thatch(seed: number): Shader {
  return (u, v) => {
    const streak = hash(Math.floor(u * 120), Math.floor(v * 8 + hash(Math.floor(u * 120), seed) * 3));
    let c: number = streak < 0.3 ? P.thatchDark : streak > 0.85 ? P.thatchLight : P.thatch;
    if ((v * 5) % 1 > 0.86) c = darken(c, 0.82);
    const lump = smoothNoise(u * 6, v * 4, seed);
    if (lump > 0.72) c = mix(c, P.moss, 0.5);
    if (v > 0.9) c = v > 0.96 ? darken(P.thatch, 0.5) : darken(P.thatch, 0.7);
    return c;
  };
}

/** Split shingles, grey with age, a little moss towards the eaves. */
function shingles(seed: number, base = 0x7a7068): Shader {
  return (u, v) => {
    const row = Math.floor(v * 10);
    const lv = v * 10 - row;
    const fu = u * 18 + hash(row, seed) * 3;
    if (lv > 0.8 || fu % 1 < 0.07 || v > 0.96) return darken(base, 0.6);
    const n = hash(Math.floor(fu), row + seed);
    let c = n < 0.25 ? darken(base, 0.85) : n > 0.82 ? lighten(base, 0.15) : base;
    if (v > 0.6 && smoothNoise(u * 8, v * 6, seed) > 0.66) c = mix(c, P.moss, 0.45);
    return c;
  };
}

/** Wicker: an over-and-under weave. */
function weave(scale: number, seed = 1): Shader {
  return (u, v) => {
    const a = Math.floor(u * scale);
    const b = Math.floor(v * scale * 0.6);
    const over = (a + b) % 2 === 0;
    const n = hash(a + seed, b);
    return over ? (n > 0.7 ? WICKER_LIGHT : WICKER) : n < 0.3 ? darken(WICKER_DARK, 0.85) : WICKER_DARK;
  };
}

/** Rough bark on a pole. */
const poleBark = (shade: boolean): Shader => (u, v) =>
  hash(Math.floor(v * 30), Math.floor(u * 3)) < 0.15 ? OAK_DARK : shade ? OAK_DARK : u < 0.3 ? OAK_LIGHT : OAK;

/** A thin upright pole from (x, y) on the ground, `h` pixels tall, `t` tiles thick. */
function pole(m: IsoModel, x: number, y: number, h: number, t = 0.08, z = 0, light = OAK_LIGHT): void {
  m.box(x - t / 2, y - t / 2, z, t, t, h, { top: light, left: poleBark(false), right: poleBark(true) });
}

/** A straight line between two points (grid x, y; z in pixels), as a thin ribbon: rope, rigging, a spar. */
function line(m: IsoModel, a: Vec3, b: Vec3, color: number, w = 0.03): void {
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  m.quad({ x: a.x - w / 2, y: a.y + w / 2, z: a.z }, d, { x: w, y: -w, z: 0 }, color);
  m.quad({ x: a.x, y: a.y, z: a.z + 0.8 }, d, { x: 0, y: 0, z: -0.8 }, color);
}

/** A rope sagging between two points, as a chain of short straight pieces. */
function sag(m: IsoModel, a: Vec3, b: Vec3, droop: number, color: number, w = 0.03): void {
  const n = 8;
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t - Math.sin(Math.PI * t) * droop };
    line(m, prev, p, color, w);
    prev = p;
  }
}

/** Where grid point p lands in a rendered model's canvas. */
function at(r: RenderedModel, p: Vec3): { x: number; y: number } {
  const s = project(p);
  return { x: Math.round(r.anchorX + s.x), y: Math.round(r.anchorY + s.y) };
}

/** Grows a rendered model's canvas by `pad` pixels on every side, keeping the anchor on the same spot. */
function padded(r: RenderedModel, pad: number): RenderedModel {
  const c = new PixelCanvas(r.canvas.width + pad * 2, r.canvas.height + pad * 2);
  c.blit(r.canvas, pad, pad);
  let keys: Float32Array | undefined;
  if (r.keys) {
    keys = new Float32Array(c.width * c.height).fill(-Infinity);
    for (let y = 0; y < r.canvas.height; y++) keys.set(r.keys.subarray(y * r.canvas.width, (y + 1) * r.canvas.width), (y + pad) * c.width + pad);
  }
  return { canvas: c, anchorX: r.anchorX + pad, anchorY: r.anchorY + pad, keys };
}

/**
 * Where something floats: a soft dark ring of shadow on the water round it and a broken line of
 * light lapping at its waterline, painted under it into its canvas (so the boat carries them as it bobs).
 */
function waterline(r: RenderedModel, outline: (t: number) => { x: number; y: number }, steps = 80): void {
  const c = r.canvas;
  const under = new PixelCanvas(c.width, c.height);
  for (let i = 0; i < steps; i++) {
    const p = outline(i / steps);
    const s = at(r, { x: p.x, y: p.y, z: 0 });
    // Ripples spreading off the hull.
    for (let k = 1; k <= 3; k++) {
      const cx = at(r, { x: p.x, y: p.y, z: 0 });
      if (hash(i, k) < 0.55) under.set(cx.x + (hash(i, k + 4) - 0.5) * 6 * k, cx.y + k * 2, k === 1 ? P.foam : P.waterLight, k === 1 ? 200 : 110);
    }
    under.set(s.x, s.y + 1, P.waterDeep, 150);
    under.set(s.x, s.y + 2, P.waterDeep, 90);
  }
  // Under the hull first, then the hull over it.
  const top = new PixelCanvas(c.width, c.height);
  top.blit(under, 0, 0);
  top.blit(c, 0, 0);
  c.blit(top, 0, 0);
}

// ---------------------------------------------------------------- the pier

/**
 * One tile of the pier's deck, lying flat at the water's level: planks across
 * the pier, nailed down, worn paler along the middle where feet go. Along each
 * open edge (`n` is -y, `e` +x, `s` +y, `w` -x) a stringer beam shows, and a
 * pile goes down into the water at each end of it, green and slimy at the
 * waterline, with the deck's shadow falling on the water beside it.
 */
function deckTile(edges: string, seed: number): RenderedModel {
  const m = new IsoModel();
  const n = edges.includes('n');
  const e = edges.includes('e');
  const s = edges.includes('s');
  const w = edges.includes('w');
  const DROP = 7;
  const PILE = 30;
  const pileBark: Shader = (u, v) => {
    // v runs from the top (deck) down; the waterline at about a third.
    if (v > 0.36) return v > 0.42 ? WEED_DARK : SLIME;
    return hash(Math.floor(v * 20), Math.floor(u * 3)) < 0.2 ? OAK_DARK : u < 0.35 ? OAK_LIGHT : OAK;
  };
  const pileAt = (x: number, y: number) => m.box(x - 0.08, y - 0.08, -PILE, 0.16, 0.16, PILE + 1, { top: OAK_LIGHT, left: pileBark, right: (u, v) => darken(pileBark(u, v) ?? OAK, 0.72) });
  // Piles at the corners of open edges, back ones first.
  const corners: Array<[number, number]> = [];
  if (n || w) corners.push([0.08, 0.08]);
  if (n || e) corners.push([0.92, 0.08]);
  if (s || w) corners.push([0.08, 0.92]);
  if (s || e) corners.push([0.92, 0.92]);
  for (const [x, y] of corners) pileAt(x, y);
  // Cross-bracing between the piles under the open sides you can see.
  if (e) line(m, { x: 1, y: 0.1, z: -4 }, { x: 1, y: 0.9, z: -22 }, OAK_DARK, 0.05);
  if (s) line(m, { x: 0.1, y: 1, z: -22 }, { x: 0.9, y: 1, z: -4 }, OAK_DARK, 0.05);
  // The stringer beams along the open edges you can see (+x and +y faces), under the boards.
  const beam: Shader = (u, v) => (v < 0.25 ? OAK : hash(Math.floor(u * 30), 2) < 0.1 ? OAK_GAP : v > 0.8 ? darken(OAK_DARK, 0.8) : OAK_DARK);
  if (e) m.quad({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -DROP }, (u, v) => darken(beam(u, v) ?? OAK, 0.8));
  if (s) m.quad({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -DROP }, beam);
  // The boards: across the pier (along x), worn paler down the middle.
  const plank = boards(5, seed);
  m.quad({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, (u, v) => {
    const c = plank(u, v);
    if (c === null || c === OAK_GAP || c === P.iron) return c;
    const worn = smoothNoise(u * 4 + seed, v * 4, seed) * 0.3 + (1 - Math.abs(u - 0.5) * 2) * 0.15;
    // Damp and dark along the open edges, where the spray reaches.
    const damp = (e && u > 0.9) || (w && u < 0.1) || (s && v > 0.9) || (n && v < 0.1);
    return damp ? mix(c, OAK_DARK, 0.35) : mix(c, OAK_LIGHT, worn);
  });
  const r = padded(m.render(false), 4);
  // The deck's shadow on the water along the open edges you can see, and a dark lip under the beam.
  const c = r.canvas;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    for (const [on, p] of [[e, { x: 1, y: t, z: -DROP }], [s, { x: t, y: 1, z: -DROP }]] as const) {
      if (!on) continue;
      const q = at(r, p);
      for (let k = 1; k <= 4; k++) if (!c.isSolid(q.x, q.y + k)) c.set(q.x, q.y + k, P.waterDeep, 150 - k * 30);
    }
  }
  return r;
}

/**
 * The edge of the quay where it drops into the river: big coping stones along
 * the top at the water's edge, and the wall below them going down into the
 * water, weedy at the waterline, with iron rings let into it to tie up to.
 */
function quayEdge(seed: number, steps = false): RenderedModel {
  const m = new IsoModel();
  const DROP = 22;
  // The face, down into the water.
  m.quad({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -DROP }, quayStone(seed, 0.45));
  if (steps) {
    // Steps cut down the face to the water, each tread a slab jutting out.
    for (let i = 0; i < 4; i++) {
      const z = -4 - i * 5;
      const d = 0.12 + i * 0.12;
      m.box(0.3, 1, z - 5, 0.45, d, 5, { top: (_u, v) => (v < 0.15 ? QUAY_LIGHT : i > 1 ? mix(QUAY, SLIME, 0.5) : QUAY), left: quayStone(seed + i, i > 1 ? 0 : 0.6), right: QUAY_DARK });
    }
  }
  // Coping stones along the top: long dressed blocks, a lip over the face.
  m.box(0, 0.62, 0, 1, 0.4, 2, {
    top: (u, v) => {
      const block = Math.floor(u * 2.5 + hash(seed, 1));
      const lu = (u * 2.5 + hash(seed, 1)) % 1;
      if (lu < 0.04) return MORTAR;
      const n = hash(block + seed, 9);
      const c = n < 0.3 ? QUAY : n > 0.7 ? QUAY_LIGHT : mix(QUAY, QUAY_LIGHT, 0.5);
      return v > 0.85 ? lighten(c, 0.1) : hash(Math.floor(u * 40), Math.floor(v * 10) + block) < 0.06 ? QUAY_DARK : c;
    },
    left: (u) => ((u * 2.5 + hash(seed, 1)) % 1 < 0.04 ? MORTAR : QUAY_DARK),
    right: QUAY_DARK,
  });
  const r = padded(m.render(false), 3);
  // An iron mooring ring on the face, now and then.
  if (seed % 3 === 1 && !steps) {
    const p = at(r, { x: 0.5, y: 1, z: -6 });
    for (let a = 0; a < 12; a++) r.canvas.set(p.x + Math.round(Math.cos((a / 12) * Math.PI * 2) * 2.5), p.y + 2 + Math.round(Math.sin((a / 12) * Math.PI * 2) * 2.5), a < 6 ? P.iron : P.ironLight);
  }
  // Shadow on the water at the foot of the wall.
  for (let i = 0; i <= 40; i++) {
    const q = at(r, { x: i / 40, y: 1, z: -DROP });
    for (let k = 0; k <= 3; k++) if (!r.canvas.isSolid(q.x, q.y + k + 1)) r.canvas.set(q.x, q.y + k + 1, P.waterDeep, 140 - k * 30);
  }
  return r;
}

/** A mooring bollard: a squat post of black oak with an iron cap, a rope looped round it. */
function bollard(): IsoModel {
  const m = new IsoModel();
  // A squat oak post, tarred, with an iron cap, and a turn of rope round its waist.
  m.cylinder(0.5, 0.5, 0, 0.17, 10, (u, v) => (v < 0.12 ? TAR_DARK : u > 0.62 ? TAR_DARK : u < 0.25 ? TAR_LIGHT : TAR), P.iron);
  m.cylinder(0.5, 0.5, 10, 0.2, 2.5, (u) => (u < 0.3 ? P.ironLight : P.iron), (u, v) => (Math.hypot(u - 0.42, v - 0.42) < 0.2 ? P.ironLight : P.iron));
  m.cylinder(0.5, 0.5, 4, 0.185, 2.5, (u) => (Math.floor(u * 16) % 2 ? ROPE : ROPE_DARK), ROPE);
  return m;
}

/** A coil of rope, flat on the boards. */
function ropeCoil(): IsoModel {
  const m = new IsoModel();
  for (let i = 0; i < 4; i++) {
    m.cylinder(0.5, 0.55, i * 1.6, 0.26 - i * 0.03, 1.6, (u) => (Math.floor(u * 22 + i) % 2 ? ROPE : ROPE_DARK), (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5);
      return d < 0.22 ? null : Math.floor(d * 14) % 2 ? ROPE : ROPE_DARK;
    });
  }
  sag(m, { x: 0.7, y: 0.6, z: 5 }, { x: 0.85, y: 0.95, z: 0 }, 1, ROPE, 0.05);
  return m;
}

/** A lantern on an oak post at the pier's edge, hung from an iron arm out over the water. */
function pierLamp(east: boolean): IsoModel {
  const m = new IsoModel();
  const x = east ? 0.86 : 0.14;
  pole(m, x, 0.5, 40, 0.1);
  m.box(x - 0.06, 0.44, 40, 0.12, 0.12, 2, { top: P.iron, left: P.iron, right: 0x3a3a44 });
  // The arm, out over the water, and the lantern swinging from it.
  const tip = { x: x + (east ? 0.32 : -0.32), y: 0.5, z: 38 };
  line(m, { x, y: 0.5, z: 38 }, tip, P.iron, 0.04);
  line(m, { x, y: 0.5, z: 30 }, { x: tip.x, y: 0.5, z: 38 }, P.iron, 0.03);
  const pane: Shader = (u, v) => (u < 0.15 || u > 0.85 || v < 0.12 || v > 0.88 ? P.iron : Math.abs(u - 0.5) < 0.06 ? 0x3a3a44 : v < 0.45 ? mix(P.glassLit, 0xfff4d0, 0.4) : P.glassLit);
  m.box(tip.x - 0.09, 0.41, 24, 0.18, 0.18, 9, { top: P.iron, left: pane, right: (u, v) => (pane(u, v) === P.glassLit ? P.fireOrange : pane(u, v)) });
  m.box(tip.x - 0.1, 0.4, 33, 0.2, 0.2, 2, { top: P.ironLight, left: P.iron, right: 0x3a3a44 });
  return m;
}

/** A basket of the morning's catch, silver and slippery, by the pier's edge. */
function fishBasket(): IsoModel {
  const m = new IsoModel();
  m.cylinder(0.6, 0.5, 0, 0.22, 9, weave(18, 3), WICKER_DARK);
  // Fish heaped over the rim.
  const rnd = seededRandom(55);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * 0.13;
    const fx = 0.6 + Math.cos(a) * d;
    const fy = 0.5 + Math.sin(a) * d;
    m.box(fx - 0.1, fy - 0.03, 9 + rnd() * 2, 0.2, 0.06, 1.5, { top: (u) => (u < 0.15 ? SILVER_DARK : u > 0.85 ? 0x6a7a84 : rnd() < 0.5 ? SILVER : lighten(SILVER, 0.2)), left: SILVER_DARK, right: SILVER_DARK });
  }
  return m;
}

// ---------------------------------------------------------------- the quay's furniture

/**
 * The crane at the quay's edge: a stout post braced with struts, a jib swung
 * out over the water with a block at its end, the rope down to a cargo net of
 * crates, and the winch drum at the foot of the post with its handle.
 */
function crane(): IsoModel {
  const m = new IsoModel();
  // Struts from the foot up to the post.
  for (const [dx, dy] of [[-0.42, 0], [0, -0.42], [0.36, 0.1]]) line(m, { x: 0.5 + dx, y: 0.5 + dy, z: 0 }, { x: 0.5, y: 0.5, z: 30 }, OAK_DARK, 0.07);
  m.box(0.36, 0.36, 0, 0.28, 0.28, 4, { top: QUAY_LIGHT, left: QUAY, right: QUAY_DARK });
  pole(m, 0.5, 0.5, 78, 0.16, 4);
  // The winch drum at the foot, rope wound on it, and a crank handle.
  m.box(0.6, 0.38, 14, 0.12, 0.24, 8, { top: OAK, left: (_u, v) => (Math.floor(v * 8) % 2 ? ROPE : ROPE_DARK), right: OAK_DARK });
  line(m, { x: 0.72, y: 0.5, z: 18 }, { x: 0.86, y: 0.52, z: 12 }, P.iron, 0.04);
  // The jib: out over the water (+y), braced back to the post.
  const head = { x: 0.5, y: 1.55, z: 86 };
  m.box(0.44, 0.42, 80, 0.12, 1.16, 4, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  line(m, { x: 0.5, y: 0.5, z: 54 }, { x: 0.5, y: 1.2, z: 80 }, OAK_DARK, 0.06);
  // The block at the jib's end, the rope down from it, and the net of crates hanging just over the quay's edge.
  m.box(0.46, head.y - 0.06, 76, 0.08, 0.1, 6, { top: OAK, left: OAK_DARK, right: P.iron });
  line(m, { x: 0.5, y: head.y, z: 76 }, { x: 0.5, y: head.y, z: 34 }, ROPE, 0.03);
  line(m, { x: 0.5, y: 0.5, z: 22 }, { x: 0.5, y: 1.4, z: 82 }, ROPE_DARK, 0.025);
  const netted: Shader = (u, v) => ((Math.floor(u * 9) + Math.floor(v * 7)) % 2 === 0 ? NET_DARK : null);
  const crate = (x: number, y: number, z: number, s: number) =>
    m.box(x, y, z, s, s, s * 22, {
      top: (u, v) => netted(u, v) ?? (u < 0.08 || u > 0.92 ? OAK_DARK : OAK_LIGHT),
      left: (u, v) => netted(u, v) ?? ((v * 3) % 1 < 0.15 ? OAK_DARK : OAK),
      right: (u, v) => netted(u, v) ?? ((v * 3) % 1 < 0.15 ? OAK_GAP : OAK_DARK),
    });
  crate(0.33, head.y - 0.17, 18, 0.32);
  crate(0.4, head.y - 0.1, 25, 0.22);
  for (const [dx, dy] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) line(m, { x: 0.5 + dx, y: head.y + dy, z: 25 }, { x: 0.5, y: head.y, z: 34 }, ROPE_DARK, 0.02);
  return m;
}

/** An open barrel of herring in salt, and another with its lid on. */
function fishBarrels(): IsoModel {
  const m = new IsoModel();
  const staves = (u: number, v: number) => (v < 0.1 || Math.abs(v - 0.5) < 0.05 || v > 0.92 ? P.iron : Math.floor(u * 12) % 2 ? OAK : OAK_DARK);
  m.cylinder(0.3, 0.35, 0, 0.22, 14, staves, OAK_LIGHT);
  m.cylinder(0.6, 0.62, 0, 0.26, 16, staves, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5);
    if (d > 0.42) return OAK_DARK;
    // Herring heads and tails packed in salt.
    const n = hash(Math.floor(u * 14), Math.floor(v * 14));
    return n < 0.45 ? (n < 0.12 ? 0x2a3038 : SILVER) : n < 0.6 ? SILVER_DARK : 0xeeeae0;
  });
  return m;
}

/** A stack of creels: lobster-pot shaped wicker baskets with netting funnels, piled two high. */
function creels(): IsoModel {
  const m = new IsoModel();
  const creel = (x: number, y: number, z: number) => {
    m.box(x, y, z, 0.36, 0.3, 8, { top: weave(14, 2), left: weave(14, 4), right: (u, v) => darken(weave(14, 5)(u, v) ?? WICKER, 0.75) });
    // The netting funnel at its mouth, and the arched hoops over the top.
    m.quad({ x: x + 0.36, y: y + 0.05, z: z + 7 }, { x: 0, y: 0.2, z: 0 }, { x: 0, y: 0, z: -6 }, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.3 ? 0x1e1a14 : (Math.floor(u * 6) + Math.floor(v * 6)) % 2 ? NET : null));
    for (const hx of [0.08, 0.18, 0.28]) sag(m, { x: x + hx, y, z: z + 8 }, { x: x + hx, y: y + 0.3, z: z + 8 }, -3, WICKER_DARK, 0.03);
  };
  creel(0.1, 0.12, 0);
  creel(0.5, 0.55, 0);
  creel(0.12, 0.56, 0);
  creel(0.28, 0.3, 9);
  // A cork float on a line, dropped on top.
  m.box(0.6, 0.2, 0, 0.12, 0.12, 4, { top: CORK, left: CORK, right: darken(CORK, 0.75) });
  return m;
}

/** An old iron anchor lying on the stones, its ring and a length of chain. */
function anchor(): IsoModel {
  const m = new IsoModel();
  const rust = (u: number, v: number) => (hash(Math.floor(u * 10), Math.floor(v * 10)) < 0.3 ? 0x7a4a2a : P.iron);
  // The shank lying along y, the arms curving up at the crown, the stock across.
  m.box(0.46, 0.1, 0, 0.08, 0.8, 3, { top: rust, left: P.iron, right: 0x3a3a44 });
  for (const s of [-1, 1]) line(m, { x: 0.5, y: 0.88, z: 1 }, { x: 0.5 + s * 0.3, y: 0.72, z: 9 }, P.iron, 0.06);
  m.box(0.2, 0.18, 0, 0.6, 0.06, 2, { top: OAK_DARK, left: OAK_DARK, right: OAK_GAP });
  // The ring, and the chain off it.
  m.cylinder(0.5, 0.06, 0, 0.06, 2, () => P.ironLight, (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.25 ? null : P.iron));
  for (let i = 0; i < 6; i++) m.box(0.5 + i * 0.07, 0.02 - i * 0.03, 0, 0.06, 0.04, 1.5, { top: i % 2 ? P.ironLight : P.iron, left: P.iron, right: 0x3a3a44 });
  return m;
}

/** A painted signboard on two posts: "ADOWVALE JETTY" over a painted fish and a boat. */
function signboard(): IsoModel {
  const m = new IsoModel();
  pole(m, 0.25, 0.5, 38, 0.08);
  pole(m, 0.75, 0.5, 38, 0.08);
  const board: Shader = (u, v) => {
    if (u < 0.04 || u > 0.96 || v < 0.06 || v > 0.94) return OAK_DARK;
    // Lettering along the top half, a fish and a boat below.
    if (v < 0.42 && v > 0.14) {
      const col = Math.floor(u * 34);
      const row = Math.floor((v - 0.14) * 22);
      if (col % 2 === 0 && col > 2 && col < 31 && hash(col, row) < 0.55) return 0xe8dcc0;
      return 0x2e4a5a;
    }
    const fish = Math.hypot((u - 0.32) / 0.16, (v - 0.68) / 0.12) < 1 || (u > 0.13 && u < 0.18 && Math.abs(v - 0.68) < (0.18 - u) * 2 + 0.1);
    if (fish) return SILVER;
    const hull = v > 0.72 && v < 0.84 && u > 0.55 && u < 0.88 && v - 0.72 < 0.12 - Math.abs(u - 0.715) * 0.4;
    if (hull) return HERON_RED;
    if (Math.abs(u - 0.7) < 0.012 && v > 0.5 && v < 0.74) return OAK_DARK;
    if (u > 0.7 && u < 0.82 && v > 0.52 && v < 0.7 && u - 0.7 < (v - 0.52) * 0.9) return 0xe8dcc0;
    return 0x2e4a5a;
  };
  m.quad({ x: 0.15, y: 0.5, z: 38 }, { x: 0.7, y: 0, z: 0 }, { x: 0, y: 0, z: -18 }, board);
  m.box(0.13, 0.45, 38, 0.74, 0.1, 2, { top: OAK, left: OAK_DARK, right: OAK_DARK });
  return m;
}

/** A low three-legged stool. */
function stool(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.42, 0.38], [0.6, 0.46], [0.44, 0.6]]) line(m, { x, y, z: 0 }, { x: 0.5 + (x - 0.5) * 0.4, y: 0.5 + (y - 0.5) * 0.4, z: SEAT_TOP - 2 }, OAK_DARK, 0.04);
  m.cylinder(0.5, 0.5, SEAT_TOP - 2, 0.125, 2, () => OAK, OAK_LIGHT);
  return m;
}

/** A heap of net being mended, with cork floats along its head-rope, and the netting needle stuck in it. */
function netHeap(): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(21);
  for (let i = 0; i < 7; i++) {
    const x = 0.3 + rnd() * 0.45;
    const y = 0.25 + rnd() * 0.4;
    const r = 0.14 + rnd() * 0.1;
    m.cylinder(x, y, 0, r, 3 + rnd() * 3, (u, v) => ((Math.floor(u * 30) + Math.floor(v * 6)) % 2 ? NET : NET_DARK), (u, v) => ((Math.floor(u * 10) + Math.floor(v * 10)) % 3 === 0 ? NET_DARK : NET));
  }
  for (let i = 0; i < 6; i++) m.box(0.2 + i * 0.1, 0.72 - (i % 2) * 0.05, 0, 0.08, 0.06, 3, { top: i === 2 ? FLOAT_RED : CORK, left: CORK, right: darken(CORK, 0.7) });
  line(m, { x: 0.5, y: 0.4, z: 5 }, { x: 0.62, y: 0.3, z: 11 }, OAK_LIGHT, 0.03);
  return m;
}

// ---------------------------------------------------------------- the boats

/**
 * A hull along y (bow at y = 0), as cross-sections: at each, how far it is from
 * the middle line to the gunwale, and how high the gunwale stands above the water.
 */
interface Hull {
  /** Length along y and greatest half-beam, in tiles. */
  length: number;
  beam: number;
  /** Gunwale height amidships, and how much the ends rise (the sheer), in pixels. */
  freeboard: number;
  bowRise: number;
  sternRise: number;
  /** The stern's half-width at the transom, as a share of the beam (0 for a double-ender). */
  transom: number;
}

function halfBeam(h: Hull, t: number): number {
  // A fine bow and a fuller stern.
  const bow = Math.sin(Math.min(1, t / 0.42) * (Math.PI / 2));
  const stern = t > 0.75 ? 1 - ((t - 0.75) / 0.25) ** 2 * (1 - h.transom) : 1;
  return h.beam * Math.pow(bow, 0.8) * stern;
}
function sheer(h: Hull, t: number): number {
  return h.freeboard + h.bowRise * (1 - t) ** 3 + h.sternRise * t ** 3;
}

/**
 * Paints a hull at (cx, y0) along y: the visible +x side in clinker strakes
 * (the top ones painted, tar below, weed at the waterline), the transom at the
 * stern, and the gunwale's capping rail. `inside` draws what's within it
 * (thwarts, deck), after the far side and before the near side.
 */
function hull(m: IsoModel, h: Hull, cx: number, y0: number, paint: { top: number; band?: number; strake?: number; tar: number }, inside?: () => void, stations = 30): void {
  const stake = (t: number) => ({ y: y0 + t * h.length, w: halfBeam(h, t), z: sheer(h, t) });
  const SUNK = 4;
  const side = (sign: number, shade: number): void => {
    for (let i = 0; i < stations; i++) {
      const a = stake(i / stations);
      const b = stake((i + 1) / stations);
      const top0 = { x: cx + sign * a.w, y: a.y, z: a.z };
      // Down to the waterline (and a little under it), drawing in towards the keel.
      const shader: Shader = (_u, v) => {
        const zz = a.z - v * (a.z + SUNK);
        const strakes = 5;
        const k = (a.z - zz) / (a.z + SUNK);
        const sIdx = Math.floor(k * strakes);
        const lk = k * strakes - sIdx;
        let c: number;
        if (zz < -1) c = mix(paint.tar, P.waterDeep, 0.55);
        else if (zz < 1.5) c = WEED;
        else if (sIdx === 0) c = paint.strake ?? paint.top;
        else if (sIdx === 1 && paint.band !== undefined) c = paint.band;
        else if (sIdx <= 2) c = paint.top;
        else c = paint.tar;
        // Each strake overlaps the next: a light upper edge, a dark lower lip.
        if (lk > 0.82) c = darken(c, 0.7);
        else if (lk < 0.15) c = lighten(c, 0.12);
        if (hash(i, Math.floor(k * 30)) < 0.05) c = darken(c, 0.85);
        return darken(c, shade);
      };
      m.quad(top0, { x: sign * (b.w - a.w), y: b.y - a.y, z: b.z - a.z }, { x: -sign * a.w * 0.3, y: 0, z: -(a.z + SUNK) }, shader);
    }
  };
  // Far side first (only its inner face shows, over the gunwale), then what's inside, then the near side.
  for (let i = 0; i < stations; i++) {
    const a = stake(i / stations);
    const b = stake((i + 1) / stations);
    m.quad({ x: cx - a.w, y: a.y, z: a.z }, { x: -(b.w - a.w), y: b.y - a.y, z: b.z - a.z }, { x: a.w * 0.15, y: 0, z: -6 }, (_u, v) => (v < 0.2 ? OAK_LIGHT : OAK));
  }
  // Turned, the far side's outside may come round to face the camera too.
  if (m.isTurned) side(-1, 0.7);
  inside?.();
  side(1, 0.82);
  // The transom at the stern, facing the viewer.
  const st = stake(1);
  if (h.transom > 0) {
    m.quad({ x: cx - st.w, y: st.y, z: st.z }, { x: st.w * 2, y: 0, z: 0 }, { x: 0, y: 0, z: -(st.z + SUNK) }, (u, v) => {
      const narrow = Math.abs(u - 0.5) * 2 > 1 - v * 0.35;
      if (narrow) return null;
      const zz = st.z - v * (st.z + SUNK);
      if (zz < 1.5) return zz < -1 ? mix(paint.tar, P.waterDeep, 0.5) : WEED;
      const k = Math.floor((1 - zz / st.z) * 5);
      return k <= 1 ? paint.top : k === 2 && paint.band !== undefined ? paint.band : paint.tar;
    });
  }
  // The capping rail along the near gunwale.
  for (let i = 0; i < stations; i++) {
    const a = stake(i / stations);
    const b = stake((i + 1) / stations);
    m.quad({ x: cx + a.w, y: a.y, z: a.z + 1 }, { x: b.w - a.w, y: b.y - a.y, z: b.z - a.z }, { x: -0.05, y: 0, z: -1.5 }, i % 6 === 0 ? OAK_DARK : OAK_LIGHT);
  }
}

/** The outline of a hull at the waterline, for its ripples (t round from the bow). */
function hullRing(h: Hull, cx: number, y0: number): (t: number) => { x: number; y: number } {
  return (t) => {
    const k = t < 0.5 ? t * 2 : (1 - t) * 2;
    const sign = t < 0.5 ? 1 : -1;
    const w = halfBeam(h, k) * 0.78 + 0.04;
    return { x: cx + sign * w, y: y0 + k * h.length };
  };
}

/**
 * A rowing boat (1 x 2 tiles, bow at y = 0): clinker built, painted along the
 * top strakes, tarred below, with three thwarts across her, bottom boards,
 * and a pair of oars shipped along her length.
 */
function rowboat(colour: number, band: number | undefined, seed: number, afloat: boolean): RenderedModel {
  const m = new IsoModel();
  const h: Hull = { length: 1.84, beam: 0.36, freeboard: 9, bowRise: 5, sternRise: 3, transom: 0.55 };
  const cx = 0.5;
  const y0 = 0.08;
  hull(m, h, cx, y0, { top: colour, band, strake: darken(colour, 0.8), tar: TAR }, () => {
    // Bottom boards, and the thwarts across.
    for (let i = 0; i < 12; i++) {
      const t = 0.15 + (i / 12) * 0.78;
      const w = halfBeam(h, t) * 0.7;
      m.quad({ x: cx - w, y: y0 + t * h.length, z: 2 }, { x: w * 2, y: 0, z: 0 }, { x: 0, y: (0.78 / 12) * h.length, z: 0 }, (u) => (Math.floor(u * 6) % 2 ? OAK : OAK_LIGHT));
    }
    for (const t of [0.3, 0.55, 0.85]) {
      const w = halfBeam(h, t);
      m.box(cx - w, y0 + t * h.length, sheer(h, t) - 3, w * 2, 0.1, 1.5, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
    }
    // The oars, shipped, blades towards the bow.
    for (const dx of [-0.1, 0.1]) {
      line(m, { x: cx + dx, y: y0 + 0.35, z: 7 }, { x: cx + dx * 0.6, y: y0 + 1.7, z: 9 }, OAK_LIGHT, 0.04);
      m.box(cx + dx - 0.05, y0 + 0.25, 6.5, 0.1, 0.28, 1, { top: hash(seed, dx) < 0.5 ? colour : OAK_LIGHT, left: OAK, right: OAK_DARK });
    }
  }, 22);
  // A painter rope off the bow, up to its post.
  sag(m, { x: cx, y: y0 + 0.02, z: sheer(h, 0) }, { x: cx, y: -0.3, z: 4 }, 3, ROPE, 0.03);
  const r = padded(m.render(), 6);
  if (afloat) waterline(r, hullRing(h, cx, y0));
  return r;
}

/** A rowing boat drawn up on the shingle, heeled over on her bilge, with a shadow and the scrape she made coming up. */
function beachedBoat(): RenderedModel {
  const m = new IsoModel();
  const h: Hull = { length: 1.8, beam: 0.36, freeboard: 9, bowRise: 5, sternRise: 3, transom: 0.55 };
  const cx = 0.5;
  // The scrape in the shingle behind her, down to the water.
  m.quad({ x: 0.2, y: 1.6, z: 0 }, { x: 0.6, y: 0, z: 0 }, { x: 0, y: 0.4, z: 0 }, (u, v) => (hash(Math.floor(u * 8), Math.floor(v * 6)) < 0.4 ? P.sandDark : null));
  hull(m, h, cx, 0.1, { top: 0x6a5a3a, band: 0xd8c8a0, strake: 0x4a3e28, tar: TAR }, () => {
    for (const t of [0.3, 0.6, 0.85]) {
      const w = halfBeam(h, t);
      m.box(cx - w, 0.1 + t * h.length, sheer(h, t) - 3, w * 2, 0.1, 1.5, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
    }
    // An old sack and a bailer left in her.
    m.box(cx - 0.12, 0.9, 2, 0.24, 0.2, 3, { top: 0xa89a74, left: 0x8a7c5a, right: 0x6a5e44 });
  }, 22);
  // Raised a little out of the shingle (it hides her waterline) and heeled: the whole thing tilts by shifting z with x.
  m.mapShaders((shade) => shade);
  const r = padded(m.render(), 6);
  // Her shadow on the shingle.
  const c = r.canvas;
  for (let t = 0; t <= 1; t += 0.02) {
    const w = halfBeam(h, t) + 0.12;
    for (let k = 0; k <= 6; k++) {
      const q = at(r, { x: cx + w * (k / 6) - 0.02, y: 0.1 + t * h.length + 0.05, z: 0 });
      if (!c.isSolid(q.x, q.y)) c.set(q.x, q.y, 0x3a2e20, 90);
    }
  }
  return r;
}

/** A rowing boat upturned on two trestles, half tarred, the brush in the pot. */
function upturnedBoat(): IsoModel {
  const m = new IsoModel();
  const trestle = (y: number) => {
    for (const x of [0.15, 0.85]) line(m, { x, y: y - 0.1, z: 0 }, { x: 0.5 + (x - 0.5) * 0.7, y, z: 14 }, OAK_DARK, 0.05);
    for (const x of [0.15, 0.85]) line(m, { x, y: y + 0.1, z: 0 }, { x: 0.5 + (x - 0.5) * 0.7, y, z: 14 }, OAK_DARK, 0.05);
    m.box(0.2, y - 0.04, 14, 0.6, 0.08, 2, { top: OAK, left: OAK_DARK, right: OAK_GAP });
  };
  trestle(0.45);
  trestle(1.5);
  // The hull upside down: keel up, the bottom half done in fresh black tar, the rest weathered green paint.
  const len = 1.84;
  for (let i = 0; i < 24; i++) {
    const t = i / 24;
    const t2 = (i + 1) / 24;
    const hw = (k: number) => 0.38 * Math.sin(Math.min(1, k / 0.42) * (Math.PI / 2)) ** 0.8 * (k > 0.8 ? 1 - ((k - 0.8) / 0.2) ** 2 * 0.4 : 1);
    const y = 0.08 + t * len;
    const dy = (t2 - t) * len;
    const keel = 24 - Math.abs(t - 0.5) * 4;
    const gun = 16;
    const paint: Shader = (u, v) => {
      const tarred = t > 0.35;
      const strake = Math.floor(v * 4);
      const lv = v * 4 - strake;
      const base = tarred ? (v < 0.85 ? TAR : 0x4a6a4a) : v < 0.2 ? 0x5a7a5a : 0x4a6a4a;
      const c = lv > 0.85 ? darken(base, 0.7) : lv < 0.12 ? lighten(base, 0.12) : base;
      return tarred && hash(Math.floor(u * 4), strake) < 0.2 ? lighten(c, 0.15) : c;
    };
    // The near (+x) side of the bottom, from keel down to gunwale.
    m.quad({ x: 0.5, y, z: keel }, { x: 0, y: dy, z: 0 }, { x: hw(t), y: 0, z: gun - keel }, (u, v) => darken(paint(u, v) ?? TAR, 0.85));
    // The far side's top, seen from above.
    m.quad({ x: 0.5, y, z: keel }, { x: 0, y: dy, z: 0 }, { x: -hw(t), y: 0, z: gun - keel }, paint);
  }
  // The keel along the top.
  m.box(0.47, 0.1, 23, 0.06, len - 0.04, 2, { top: OAK_DARK, left: TAR_DARK, right: TAR_DARK });
  return m;
}

/** The tar pot: a black iron pot on a ring of stones over a little fire, the brush stood in it. */
function tarPot(): IsoModel {
  const m = new IsoModel();
  const rnd = seededRandom(8);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    m.box(0.5 + Math.cos(a) * 0.28 - 0.06, 0.5 + Math.sin(a) * 0.28 - 0.05, 0, 0.12, 0.1, 3 + rnd() * 2, { top: QUAY_LIGHT, left: QUAY, right: QUAY_DARK });
  }
  // Embers under it.
  m.quad({ x: 0.3, y: 0.3, z: 0.5 }, { x: 0.4, y: 0, z: 0 }, { x: 0, y: 0.4, z: 0 }, (u, v) => (Math.hypot(u - 0.5, v - 0.5) > 0.5 ? null : hash(Math.floor(u * 8), Math.floor(v * 8)) < 0.5 ? P.ember : P.fireOrange));
  m.cylinder(0.5, 0.5, 4, 0.2, 10, (u, v) => (v < 0.12 ? P.ironLight : u > 0.6 ? 0x1e1e24 : P.iron), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.4 ? 0x14100c : P.iron));
  line(m, { x: 0.48, y: 0.5, z: 13 }, { x: 0.65, y: 0.42, z: 24 }, OAK_LIGHT, 0.04);
  return m;
}

// ---------------------------------------------------------------- the Grey Heron

/** Her hull's shape: 7 tiles long, a little under 2 across. */
const HERON_HULL: Hull = { length: 6.7, beam: 0.86, freeboard: 16, bowRise: 12, sternRise: 6, transom: 0.62 };

/** The middle of her, on the water, in her 2 x 7 tile footprint: what she turns about when she's under way. */
export const HERON_PIVOT = { x: 1, y: 0.15 + HERON_HULL.length / 2 };

/** The Grey Heron under way: which way she's heading, and whether her sail is let fall yet (see {@link heronUnderwayKey}). */
export interface HeronUnderway {
  /**
   * Radians clockwise (seen from above) from how she lies at the pier, bow up the screen towards -y:
   * a quarter turn heads her down the river, towards +x; minus a quarter, up it.
   */
  heading: number;
  sail: boolean;
}

/** The headings she's drawn at under way, every 15 degrees from a quarter turn one way to a quarter turn the other. */
export const HERON_HEADINGS = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((k) => (k * Math.PI) / 12);

/** The texture of the Grey Heron at one of her headings (an index into {@link HERON_HEADINGS}), sail set or furled. */
export function heronUnderwayKey(index: number, sail: boolean): string {
  return `jt-heron-${sail ? 'sail' : 'furled'}-${index}`;
}

/**
 * Who stands aboard her under way, from her middle unturned (bow towards -y), in tiles, and how high
 * the deck is under them, in pixels: the hero aft of the hatch, and Maren at the tiller.
 */
export type HeronRider = 'hero' | 'maren';
export const HERON_RIDERS: Record<HeronRider, Vec3> = {
  hero: { x: -0.02, y: 1.57, z: 16.6 },
  maren: { x: 0.05, y: 3.25, z: 19.7 },
};

/**
 * The texture of whatever of her stands in front of one of her riders, at a heading (see
 * {@link heronUnderwayKey}): drawn over them, it hides them behind the cabin, a gunwale or the sail.
 */
export function heronFrontKey(index: number, sail: boolean, rider: HeronRider): string {
  return `${heronUnderwayKey(index, sail)}-front-${rider}`;
}

/**
 * Draws the Grey Heron under way at the headings asked for, sail set or furled, for her leaving a pier
 * (scenes/game/voyages.ts), each with the parts of her in front of each rider. Each is the same 2 x 7
 * tile footprint turned about {@link HERON_PIVOT}. They're drawn the first time they're wanted, which
 * takes a moment, and kept.
 */
export function generateHeronUnderway(scene: Phaser.Scene, wanted: ReadonlyArray<{ index: number; sail: boolean }>): void {
  for (const { index, sail } of wanted) {
    const key = heronUnderwayKey(index, sail);
    const fronts = (Object.keys(HERON_RIDERS) as HeronRider[]).map((rider) => ({ rider, key: heronFrontKey(index, sail, rider) }));
    if (scene.textures.exists(key) && fronts.every((f) => scene.textures.exists(f.key))) continue;
    const heading = HERON_HEADINGS[index];
    const r = greyHeron({ heading, sail });
    if (!scene.textures.exists(key)) registerModel(scene, key, r);
    const c = Math.cos(heading);
    const sn = Math.sin(heading);
    for (const f of fronts) {
      const p = HERON_RIDERS[f.rider];
      const x = HERON_PIVOT.x + p.x * c - p.y * sn;
      const y = HERON_PIVOT.y + p.x * sn + p.y * c;
      if (!scene.textures.exists(f.key)) registerModel(scene, f.key, { ...r, canvas: inFrontOf(r, x, y) });
    }
  }
}

/**
 * Her square sail let fall from the yard and filled by a wind from astern: a broad sheet of tanned
 * canvas hanging from the yard to a little above the deck, bellied out towards the bow, sewn in
 * vertical cloths with a reef band across, its foot sheeted down aft on either side.
 */
function setSail(m: IsoModel, mast: { x: number; y: number }, yw: number, top: number, foot: number, sheetTo: Vec3): void {
  const NU = 18;
  const NV = 14;
  const half = yw * 0.96;
  /** A point on the sail: u across from port to starboard, v down from the yard. */
  const pt = (u: number, v: number): Vec3 => {
    const belly = 0.42 * Math.sin(Math.PI * u) ** 0.8 * Math.sin(Math.PI * (0.12 + v * 0.8));
    return { x: mast.x - half + u * half * 2, y: mast.y - 0.08 - belly, z: top - v * (top - foot) };
  };
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NV; j++) {
      const u0 = i / NU;
      const v0 = j / NV;
      const a = pt(u0, v0);
      const b = pt(u0 + 1 / NU, v0);
      const c = pt(u0, v0 + 1 / NV);
      // Lit where the belly turns to the sky, shaded where it falls away, with the cloths' seams and the reef band.
      const lift = Math.sin(Math.PI * (u0 + 0.5 / NU));
      m.quad(a, { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z }, (su, sv) => {
        const u = u0 + su / NU;
        const v = v0 + sv / NV;
        if (Math.abs(((u * 7) % 1) - 0.5) > 0.47) return SAIL_DARK;
        if (Math.abs(v - 0.3) < 0.012) return ROPE_DARK;
        if (Math.abs(v - 0.3) < 0.03 && Math.floor(u * 28) % 2 === 0) return ROPE;
        const weather = smoothNoise(u * 5, v * 7, 4) * 0.2;
        const c0 = lift > 0.75 ? SAIL_LIGHT : lift > 0.4 ? SAIL : SAIL_DARK;
        return mix(v > 0.94 ? SAIL_DARK : c0, SAIL_DARK, weather + (v > 0.85 ? 0.25 : 0));
      });
    }
  }
  // The bolt rope along the foot, and the sheets down to the gunwales aft.
  for (let i = 0; i < NU; i++) line(m, pt(i / NU, 1), pt((i + 1) / NU, 1), ROPE_DARK, 0.02);
  for (const [u, k] of [[0, -1], [1, 1]] as const) line(m, pt(u, 1), { x: sheetTo.x + k * 0.7, y: sheetTo.y, z: sheetTo.z + 2 }, 0x2e2a24, 0.018);
}

/**
 * The Grey Heron, Maren Tull's river boat (2 x 7 tiles, alongside the pier,
 * bow towards the quay): a broad clinker hull in grey-blue with a white band
 * and a red rubbing strake, a carved heron's head on her stem-post, decked
 * fore and aft with a hatch over the hold amidships, a stout mast stepped
 * forward of it with the tan sail furled on its yard, shrouds and stays, a
 * pennant at the masthead, a little cabin aft with a lit window and a stovepipe,
 * the tiller over the stern and a lantern on its post at the transom.
 */
function greyHeron(under?: HeronUnderway): RenderedModel {
  const h = HERON_HULL;
  const cx = 1;
  const y0 = 0.15;
  const m = under ? IsoModel.turned(under.heading, HERON_PIVOT) : new IsoModel();
  const yAt = (t: number) => y0 + t * h.length;
  const deckZ = (t: number) => sheer(h, t) - 2;
  // Stays first that run behind things: the backstay off the far side.
  const mastT = 0.34;
  const MAST = 132;
  const mast = { x: cx, y: yAt(mastT) };
  hull(m, h, cx, y0, { top: HERON_GREY, band: HERON_WHITE, strake: HERON_RED, tar: TAR }, () => {
    // The deck, planked fore and aft.
    for (let i = 0; i < 40; i++) {
      const t = 0.02 + (i / 40) * 0.96;
      const t2 = 0.02 + ((i + 1) / 40) * 0.96;
      const w = halfBeam(h, t) * 0.96;
      m.quad({ x: cx - w, y: yAt(t), z: deckZ(t) }, { x: w * 2, y: 0, z: 0 }, { x: 0, y: yAt(t2) - yAt(t), z: deckZ(t2) - deckZ(t) }, (u) => {
        const plank = Math.floor(u * 9);
        const c = plank % 2 ? OAK_LIGHT : mix(OAK_LIGHT, OAK, 0.4);
        return (u * 9) % 1 < 0.1 ? OAK_GAP : hash(plank, i >> 2) < 0.1 ? OAK : c;
      });
    }
    // The hatch over the hold, a tarpaulin lashed over it.
    const h0 = 0.44;
    const h1 = 0.66;
    m.box(cx - 0.5, yAt(h0), deckZ(h0), 1, yAt(h1) - yAt(h0), 5, { top: OAK, left: OAK_DARK, right: OAK_DARK });
    m.box(cx - 0.46, yAt(h0) + 0.04, deckZ(h0) + 5, 0.92, yAt(h1) - yAt(h0) - 0.08, 3, {
      top: (u, v) => (Math.abs(u - 0.5) < 0.02 || (v * 4) % 1 < 0.05 ? ROPE_DARK : smoothNoise(u * 4, v * 6, 3) > 0.6 ? 0x6a6448 : 0x5a5640),
      left: 0x4a4634,
      right: 0x3a3626,
    });
    // Barrels and a crate on deck, forward of the hatch, and a coil of rope.
    m.cylinder(cx + 0.3, yAt(0.38), deckZ(0.38), 0.16, 11, (u, v) => (v < 0.12 || v > 0.88 ? P.iron : Math.floor(u * 10) % 2 ? OAK : OAK_DARK), OAK_LIGHT);
    m.cylinder(cx - 0.25, yAt(0.4), deckZ(0.4), 0.16, 11, (u, v) => (v < 0.12 || v > 0.88 ? P.iron : Math.floor(u * 10) % 2 ? OAK : OAK_DARK), OAK_LIGHT);
    m.box(cx + 0.1, yAt(0.7), deckZ(0.7), 0.34, 0.3, 9, { top: OAK_LIGHT, left: (u, v) => (u < 0.08 || u > 0.92 || (v * 2) % 1 < 0.1 ? OAK_DARK : OAK), right: OAK_DARK });
    m.cylinder(cx - 0.3, yAt(0.72), deckZ(0.72), 0.18, 3, (u) => (Math.floor(u * 18) % 2 ? ROPE : ROPE_DARK), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.18 ? OAK : ROPE));
    // The cabin aft: low timber walls, a curved roof, a door forward with a lit window by it, a stovepipe.
    const c0 = 0.78;
    const c1 = 0.97;
    const cw = halfBeam(h, 0.86) * 0.72;
    const cz = deckZ(0.86);
    const CH = 15;
    const cabinWall: Shader = (u, v) => {
      if (v < 0.12) return OAK_LIGHT;
      // A little window, lit.
      if (u > 0.3 && u < 0.62 && v > 0.25 && v < 0.65) return u < 0.34 || u > 0.58 || v < 0.29 || v > 0.61 || Math.abs(u - 0.46) < 0.02 ? OAK_DARK : v < 0.42 ? mix(P.glassLit, 0xfff4d0, 0.3) : P.glassLit;
      return weatherboard(4, 9, HERON_GREY, HERON_GREY_DARK, lighten(HERON_GREY, 0.15))(u, v);
    };
    m.box(cx - cw, yAt(c0), cz, cw * 2, yAt(c1) - yAt(c0), CH, {
      top: OAK,
      left: cabinWall,
      right: (u, v) => {
        // The door, forward, on the near side.
        if (u > 0.08 && u < 0.36 && v > 0.15) return u < 0.11 || u > 0.33 ? OAK_DARK : Math.abs(u - 0.22) < 0.01 ? OAK_DARK : HERON_RED;
        if (u > 0.55 && u < 0.8 && v > 0.25 && v < 0.6) return u < 0.58 || u > 0.77 || v < 0.28 || v > 0.57 ? OAK_DARK : P.glassLit;
        return darken(weatherboard(4, 11, HERON_GREY, HERON_GREY_DARK, lighten(HERON_GREY, 0.15))(u, v) ?? HERON_GREY, 0.85);
      },
    });
    // The roof, cambered: a few strips stepping up to the middle.
    for (let k = 0; k < 4; k++) {
      const inset = k * cw * 0.22;
      m.box(cx - cw + inset - 0.04, yAt(c0) - 0.04, cz + CH + k * 1.2, (cw - inset) * 2 + 0.08, yAt(c1) - yAt(c0) + 0.08, 1.2, { top: k === 3 ? lighten(0x5a5248, 0.1) : 0x5a5248, left: 0x3a3430, right: 0x2e2824 });
    }
    m.cylinder(cx - cw * 0.5, yAt(0.84), cz + CH + 4, 0.05, 9, (u) => (u < 0.3 ? P.ironLight : P.iron), 0x1a1a1e);
  });
  // The stem-post at the bow, rising into a carved heron's head and beak.
  const bowZ = sheer(h, 0);
  m.box(cx - 0.05, y0 - 0.06, bowZ - 6, 0.1, 0.12, 14, { top: HERON_WHITE, left: OAK, right: OAK_DARK });
  m.box(cx - 0.06, y0 - 0.12, bowZ + 6, 0.12, 0.16, 6, { top: HERON_WHITE, left: HERON_WHITE, right: 0xb8b4a8 });
  m.box(cx - 0.02, y0 - 0.34, bowZ + 8, 0.04, 0.24, 1.5, { top: FLAG_YELLOW, left: 0xc89a28, right: 0xa87a18 });
  m.box(cx - 0.065, y0 - 0.05, bowZ + 9, 0.13, 0.04, 1, { top: 0x1a1a1a, left: 0x1a1a1a, right: 0x1a1a1a });
  // The mast, the yard across it with the sail furled along it, the masthead and its pennant.
  m.cylinder(mast.x, mast.y, deckZ(mastT), 0.09, MAST, (u, v) => (v < 0.02 ? OAK_DARK : u > 0.6 ? OAK_DARK : u < 0.25 ? OAK_LIGHT : OAK), OAK_LIGHT);
  const yardZ = deckZ(mastT) + MAST - 38;
  // Shrouds down either side to the gunwale, and the forestay to the stem.
  for (const k of [-1, 1]) {
    for (const dt of [-0.03, 0.03]) {
      const t = mastT + dt + 0.04;
      line(m, { x: mast.x, y: mast.y, z: yardZ + 18 }, { x: cx + k * halfBeam(h, t), y: yAt(t), z: sheer(h, t) }, 0x2e2a24, 0.02);
    }
  }
  line(m, { x: mast.x, y: mast.y, z: yardZ + 20 }, { x: cx, y: y0 - 0.06, z: bowZ + 7 }, 0x2e2a24, 0.02);
  line(m, { x: mast.x, y: mast.y, z: deckZ(mastT) + MAST - 2 }, { x: cx, y: yAt(0.99), z: sheer(h, 1) + 6 }, 0x2e2a24, 0.02);
  // The yard (across the boat) with the sail in a fat roll along it, and its lashings; or, under way, the sail let fall and full of wind.
  const yw = 1.15;
  m.box(mast.x - yw, mast.y - 0.05, yardZ, yw * 2, 0.1, 3, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  if (under?.sail) setSail(m, mast, yw, yardZ, deckZ(mastT) + 20, { x: cx, y: yAt(0.62), z: deckZ(0.62) });
  const N = under?.sail ? 0 : 22;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const x = mast.x - yw * 0.92 + t * yw * 1.84;
    const fat = 0.1 * Math.sin(Math.PI * (0.08 + t * 0.84)) + 0.035;
    const lashing = i % 4 === 2;
    m.box(x, mast.y - fat, yardZ - fat * 46, (yw * 1.84) / N + 0.005, fat * 2, fat * 46, {
      top: lashing ? ROPE_DARK : SAIL_LIGHT,
      left: (u, v) => {
        if (lashing) return ROPE_DARK;
        const fold = Math.sin(u * 5 + i * 1.7 + v * 6);
        return v > 0.8 ? SAIL_DARK : fold > 0.5 ? SAIL_LIGHT : fold < -0.6 ? SAIL_DARK : SAIL;
      },
      right: (_u, v) => (lashing ? ROPE_DARK : v > 0.7 ? SAIL_DARK : darken(SAIL, 0.85)),
    });
  }
  // Lifts from the masthead to the yard-arms.
  for (const k of [-1, 1]) line(m, { x: mast.x, y: mast.y, z: deckZ(mastT) + MAST }, { x: mast.x + k * yw, y: mast.y, z: yardZ + 3 }, 0x2e2a24, 0.018);
  // The masthead truck, and the pennant streaming off it downstream, grey and white.
  m.cylinder(mast.x, mast.y, deckZ(mastT) + MAST, 0.11, 3, () => OAK_DARK, OAK);
  const pz = deckZ(mastT) + MAST - 1;
  m.quad({ x: mast.x, y: mast.y, z: pz + 3 }, { x: 0.95, y: -0.15, z: -3 }, { x: 0, y: 0, z: -6 }, (u, v) => {
    if (Math.abs(v - 0.5) * 2 > 1 - u * 0.85) return null;
    const wave = Math.sin(u * 9) * 0.1;
    return v + wave < 0.5 ? HERON_GREY : HERON_WHITE;
  });
  // The tiller over the stern, and the rudder hung on the transom.
  const st = sheer(h, 1);
  m.box(cx - 0.06, yAt(1) - 0.06, -4, 0.12, 0.14, st + 6, { top: OAK, left: OAK_DARK, right: TAR_DARK });
  line(m, { x: cx, y: yAt(1), z: st + 2 }, { x: cx - 0.1, y: yAt(0.9), z: st + 6 }, OAK_LIGHT, 0.06);
  // The stern lantern on its post.
  pole(m, cx + 0.38, yAt(0.99), 16, 0.06, st - 2);
  const pane: Shader = (u, v) => (u < 0.15 || u > 0.85 || v < 0.12 || v > 0.88 ? P.iron : v < 0.45 ? mix(P.glassLit, 0xfff4d0, 0.4) : P.glassLit);
  m.box(cx + 0.31, yAt(0.99) - 0.07, st + 14, 0.14, 0.14, 7, { top: P.iron, left: pane, right: (u, v) => (pane(u, v) === P.glassLit ? P.fireOrange : pane(u, v)) });
  // Fenders hung over the near side: old rope-wrapped bundles.
  for (const t of [0.25, 0.55, 0.85]) {
    const w = halfBeam(h, t);
    line(m, { x: cx + w, y: yAt(t), z: sheer(h, t) }, { x: cx + w + 0.02, y: yAt(t), z: sheer(h, t) - 5 }, ROPE, 0.02);
    m.cylinder(cx + w + 0.03, yAt(t), sheer(h, t) - 11, 0.06, 6, (u) => (Math.floor(u * 10) % 2 ? ROPE : ROPE_DARK), ROPE);
  }
  const r = padded(m.render(), 8);
  const ring = hullRing(h, cx, y0);
  waterline(r, (t) => m.place({ ...ring(t), z: 0 }), 160);
  // Her name carved on the transom: a pale little heron, standing on one leg (out of sight once she's turned).
  if (under) return r;
  const tr = at(r, { x: cx, y: yAt(1), z: sheer(h, 1) - 6 });
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 1], [0, 2], [1, 2], [2, -1], [3, -2], [3, -3], [4, -3], [5, -3], [0, 3], [0, 4]]) r.canvas.set(tr.x + dx - 1, tr.y + dy - 1, HERON_WHITE);
  return r;
}

// ---------------------------------------------------------------- the front: huts, smokehouse, boathouse

interface HutLook {
  wall: [number, number, number];
  roof: 'thatch' | 'shingle';
  seed: number;
  /** Nets and floats hung along the front wall, a pike's head over the door, a water butt, a bean row. */
  nets?: boolean;
  pike?: boolean;
  butt?: boolean;
  beans?: boolean;
}

/**
 * A fisherman's hut (3 x 3 tiles, its door on the +y side facing the river):
 * low walls of overlapping weatherboard on a stone footing, a deep roof with
 * the ridge along x, a stone chimney at the back, a door and a lit window,
 * and whatever its folk have hung about it.
 */
function hut(look: HutLook): IsoModel {
  const m = new IsoModel();
  const W = 3;
  const D = 2.3;
  const y0 = 0.3;
  const H = 34;
  const R = 34;
  const o = 0.32;
  const [base, dark, light] = look.wall;
  const roof = look.roof === 'thatch' ? thatch(look.seed) : shingles(look.seed);
  const ridgeY = y0 + D / 2;
  // The back slope of the roof, then the chimney through it.
  m.quad({ x: -o, y: ridgeY, z: H + R }, { x: W + o, y: 0, z: 0 }, { x: 0, y: -D / 2 - o, z: -R - 6 }, roof);
  m.box(0.25, y0 + 0.2, 0, 0.6, 0.55, H + R + 14, {
    top: P.soot,
    left: (u, v) => ((v * 14) % 1 < 0.14 || (u * 3 + Math.floor(v * 14) * 0.5) % 1 < 0.08 ? MORTAR : hash(Math.floor(u * 3), Math.floor(v * 14)) < 0.3 ? QUAY_DARK : QUAY),
    right: (_u, v) => ((v * 14) % 1 < 0.14 ? MORTAR : QUAY_DARK),
  });
  // The stone footing.
  m.box(0, y0, 0, W, D, 5, { top: QUAY, left: quayStone(look.seed, 2), right: (u, v) => darken(quayStone(look.seed + 1, 2)(u, v) ?? QUAY, 0.8) });
  const front: Shader = (u, v) => {
    const y = v * H;
    // The door, left of middle: planked, with strap hinges.
    if (u > 0.36 && u < 0.56 && y > 6) {
      const du = (u - 0.36) / 0.2;
      if (du < 0.1 || du > 0.9 || y < 8) return TAR_DARK;
      if (Math.abs(y - 14) < 1 || Math.abs(y - 28) < 1) return du < 0.6 ? P.iron : OAK;
      return Math.floor(du * 4) % 2 ? OAK : mix(OAK, OAK_DARK, 0.3);
    }
    // The window, lit, with a little shutter propped open.
    if (u > 0.68 && u < 0.86 && y > 8 && y < 20) {
      const wu = (u - 0.68) / 0.18;
      if (wu < 0.14 || wu > 0.86 || y < 10 || y > 18) return TAR_DARK;
      if (Math.abs(wu - 0.5) < 0.07 || Math.abs(y - 14) < 0.8) return OAK_DARK;
      return y < 13 ? mix(P.glassLit, 0xfff4d0, 0.3) : P.glassLit;
    }
    if (u > 0.86 && u < 0.92 && y > 8 && y < 20) return OAK;
    // Corner posts.
    if (u < 0.025 || u > 0.975) return dark;
    return weatherboard(9, look.seed, base, dark, light)(u, v);
  };
  const side: Shader = (u, v) => {
    if (u < 0.03 || u > 0.97) return darken(dark, 0.85);
    if (u > 0.4 && u < 0.6 && v > 0.35 && v < 0.65) {
      // A small shuttered window in the gable end.
      return Math.abs(u - 0.5) < 0.01 ? TAR_DARK : OAK_DARK;
    }
    return darken(weatherboard(9, look.seed + 2, base, dark, light)(u, v) ?? base, 0.82);
  };
  m.box(0, y0, 5, W, D, H - 5, { top: base, left: front, right: side });
  // The gable end over the side wall.
  m.quad({ x: W, y: y0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => {
    const half = Math.abs(u - 0.5) * 2;
    if (v > 1 - half) return null;
    if (v > 0.25 && v < 0.5 && Math.abs(u - 0.5) < 0.07) return Math.abs(u - 0.5) < 0.02 ? TAR_DARK : 0x1a1612;
    return darken(weatherboard(7, look.seed + 4, base, dark, light)(u, v) ?? base, 0.8);
  });
  // The front slope, overhanging; a bargeboard at its end.
  m.quad({ x: -o, y: ridgeY, z: H + R }, { x: W + o * 2, y: 0, z: 0 }, { x: 0, y: D / 2 + o, z: -R - 6 }, roof);
  m.quad({ x: W + o, y: ridgeY, z: H + R + 1 }, { x: 0, y: D / 2 + o, z: -R - 6 }, { x: 0.05, y: 0, z: -2 }, OAK_DARK);
  // A ridge capping.
  m.box(-o, ridgeY - 0.08, H + R - 1, W + o * 2, 0.16, 3, { top: look.roof === 'thatch' ? P.thatchDark : darken(0x7a7068, 0.7), left: look.roof === 'thatch' ? P.thatchDark : 0x5a524c, right: 0x3a3430 });
  const fy = y0 + D;
  if (look.nets) {
    // A net hung along the wall to the left of the door, its floats along the top, and a lifebuoy-like ring of cork.
    m.quad({ x: 0.15, y: fy + 0.02, z: 30 }, { x: 0.85, y: 0, z: 0 }, { x: 0, y: 0, z: -22 }, (u, v) => {
      const drape = v + Math.sin(u * Math.PI) * 0.1;
      if (drape > 1 || v < 0) return null;
      if (v < 0.08) return Math.floor(u * 8) % 2 ? CORK : ROPE_DARK;
      return (Math.floor(u * 22) + Math.floor(drape * 14)) % 2 === 0 ? NET_DARK : null;
    });
    // An oar and a boathook leaning by the door.
    line(m, { x: 1.85, y: fy + 0.12, z: 0 }, { x: 1.75, y: fy + 0.02, z: 32 }, OAK_LIGHT, 0.05);
    m.box(1.8, fy + 0.06, 0, 0.1, 0.05, 9, { top: OAK, left: OAK_LIGHT, right: OAK });
  }
  if (look.pike) {
    // The pike's head over the door, dried hard, jaws open.
    m.box(1.24, fy + 0.01, 31, 0.36, 0.04, 4, { top: 0x9a8a5a, left: (u) => (u > 0.75 ? 0xe8e0c8 : u < 0.2 ? 0x6a5e3a : 0x8a7a4a), right: 0x6a5e3a });
  }
  if (look.butt) {
    m.cylinder(2.75, fy + 0.25, 0, 0.2, 14, (u, v) => (v < 0.1 || v > 0.9 ? P.iron : Math.floor(u * 10) % 2 ? OAK : OAK_DARK), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.38 ? P.waterDeep : OAK));
  }
  if (look.beans) {
    // A row of beans up hazel poles along the gable end.
    for (let i = 0; i < 4; i++) {
      const y = y0 + 0.3 + i * 0.55;
      line(m, { x: W + 0.3, y, z: 0 }, { x: W + 0.25, y: y + 0.1, z: 30 }, OAK_LIGHT, 0.03);
      for (let k = 0; k < 7; k++) m.box(W + 0.2 + (k % 2) * 0.08, y - 0.06 + k * 0.02, 4 + k * 3.6, 0.14, 0.12, 3, { top: P.leafLight, left: k % 3 === 0 ? P.flowerRed : P.leaf, right: P.leafDark });
    }
  }
  return m;
}

/**
 * The smokehouse (2 x 2): a tall, narrow shed of smoke-blackened boards, a
 * louvred vent along its ridge leaking smoke, the door hooked open on rows of
 * eels and herring hanging gold in the smoke over a red glow.
 */
function smokehouse(): IsoModel {
  const m = new IsoModel();
  const W = 1.7;
  const D = 1.6;
  const x0 = 0.15;
  const y0 = 0.2;
  const H = 50;
  const R = 20;
  const sooty = (s: number): Shader => (u, v) => {
    const c = weatherboard(12, s, 0x4a3e34, 0x2e2620, 0x5e5044)(u, v) ?? TAR;
    return mix(c, 0x1a1410, Math.max(0, 0.5 - v) * 0.8);
  };
  m.quad({ x: x0 - 0.15, y: y0 + D / 2, z: H + R }, { x: W + 0.15, y: 0, z: 0 }, { x: 0, y: -D / 2 - 0.15, z: -R - 3 }, shingles(41, 0x5a5048));
  m.box(x0, y0, 0, W, D, H, {
    top: TAR,
    left: (u, v) => {
      // The open doorway, and inside: fish hung in rows, gold in the smoke, the fire's glow at the bottom.
      if (u > 0.3 && u < 0.7 && v > 0.22) {
        const du = (u - 0.3) / 0.4;
        if (du < 0.08 || du > 0.92 || v < 0.26) return TAR_DARK;
        const y = (v - 0.26) / 0.74;
        if (y > 0.82) return hash(Math.floor(du * 10), 1) < 0.5 ? P.ember : P.fireOrange;
        const row = Math.floor(y * 5);
        const ly = y * 5 - row;
        const fish = Math.floor(du * 7);
        if (row < 4 && ly > 0.15 && (du * 7) % 1 > 0.3 && (du * 7) % 1 < 0.7) return ly > 0.7 ? SMOKED_DARK : mix(SMOKED, P.fireOrange, y * 0.4 + hash(fish, row) * 0.2);
        return mix(0x1a120c, P.ember, y * 0.5);
      }
      return sooty(43)(u, v);
    },
    right: (u, v) => darken(sooty(47)(u, v) ?? TAR, 0.8),
  });
  // The door, hooked open against the wall.
  m.quad({ x: x0 + W * 0.3, y: y0 + D, z: H * 0.78 }, { x: -0.38, y: 0.3, z: 0 }, { x: 0, y: 0, z: -H * 0.78 }, (u, v) => ((u * 4) % 1 < 0.1 ? TAR_DARK : Math.abs(v - 0.3) < 0.03 || Math.abs(v - 0.75) < 0.03 ? P.iron : OAK_DARK));
  m.quad({ x: x0 + W, y: y0, z: H }, { x: 0, y: D, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => (v > 1 - Math.abs(u - 0.5) * 2 ? null : darken(sooty(49)(u, v) ?? TAR, 0.78)));
  m.quad({ x: x0 - 0.15, y: y0 + D / 2, z: H + R }, { x: W + 0.3, y: 0, z: 0 }, { x: 0, y: D / 2 + 0.15, z: -R - 3 }, shingles(45, 0x5a5048));
  // The louvred vent along the ridge.
  m.box(x0 + 0.3, y0 + D / 2 - 0.2, H + R - 2, W - 0.6, 0.4, 9, {
    top: 0x3a322c,
    left: (_u, v) => ((v * 4) % 1 < 0.5 ? 0x1a1410 : OAK_DARK),
    right: (_u, v) => ((v * 4) % 1 < 0.5 ? 0x14100c : TAR_DARK),
  });
  m.box(x0 + 0.24, y0 + D / 2 - 0.26, H + R + 7, W - 0.48, 0.52, 2, { top: 0x5a5048, left: 0x3a322c, right: 0x2a241f });
  // Split logs stacked against the side for the fire.
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 3 - (i > 1 ? 1 : 0); k++) {
      m.cylinder(x0 + W + 0.14, y0 + 0.2 + k * 0.4 + (i % 2) * 0.2, i * 4, 0.12, 4, (u) => (u < 0.3 ? P.logLight : P.log), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.25 ? 0xc8a070 : P.logLight));
    }
  }
  return m;
}

/** The gutting table by the smokehouse: a plank top on trestles, fish, a knife, and a bucket of guts for the gulls. */
function gutTable(): IsoModel {
  const m = new IsoModel();
  for (const [x, y] of [[0.18, 0.28], [0.82, 0.28], [0.18, 0.72], [0.82, 0.72]]) m.box(x - 0.04, y - 0.04, 0, 0.08, 0.08, 12, { top: OAK, left: OAK, right: OAK_DARK });
  m.box(0.1, 0.2, 12, 0.8, 0.6, 2, {
    top: (u, v) => (hash(Math.floor(u * 20), Math.floor(v * 10)) < 0.08 ? 0x7a3a2a : (v * 3) % 1 < 0.06 ? OAK_GAP : mix(OAK_LIGHT, 0xd8c8b0, 0.3)),
    left: OAK,
    right: OAK_DARK,
  });
  for (const [x, y] of [[0.25, 0.35], [0.45, 0.48], [0.3, 0.6]]) m.box(x, y, 14, 0.3, 0.07, 1.5, { top: (u) => (u < 0.15 ? SILVER_DARK : SILVER), left: SILVER_DARK, right: SILVER_DARK });
  line(m, { x: 0.65, y: 0.35, z: 14.5 }, { x: 0.85, y: 0.4, z: 14.5 }, P.ironLight, 0.03);
  m.cylinder(0.85, 0.88, 0, 0.12, 7, (u, v) => (v < 0.15 ? P.iron : u > 0.6 ? OAK_DARK : OAK), (u, v) => (Math.hypot(u - 0.5, v - 0.5) < 0.38 ? 0x6a2a20 : OAK));
  return m;
}

/** Nets hung up to dry over a pole between two posts (2 x 1), corks along the head-rope, a red float or two. */
function netRack(): IsoModel {
  const m = new IsoModel();
  pole(m, 0.12, 0.5, 32, 0.09);
  pole(m, 1.88, 0.5, 32, 0.09);
  m.box(0.08, 0.46, 30, 1.84, 0.08, 2, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
  // Two curtains of net, one behind the other, sagging, ragged at the hem.
  for (const [dy, seed] of [[-0.06, 3], [0.06, 5]] as const) {
    m.quad({ x: 0.16, y: 0.5 + dy, z: 30 }, { x: 1.68, y: 0, z: 0 }, { x: 0, y: 0, z: -28 }, (u, v) => {
      const hem = 0.78 + 0.14 * Math.sin(u * 9 + seed) + 0.06 * Math.sin(u * 23);
      if (v > hem) return null;
      if (v < 0.05) return Math.floor(u * 14) % 2 ? CORK : ROPE_DARK;
      const mesh = (Math.floor(u * 40 + Math.sin(v * 6) * 0.6) + Math.floor(v * 22)) % 2 === 0;
      if (!mesh) return null;
      return seed === 3 ? NET_DARK : NET;
    });
  }
  // A couple of red-painted end floats hung off the posts.
  for (const x of [0.2, 1.8]) m.box(x - 0.06, 0.58, 16, 0.12, 0.12, 6, { top: FLOAT_RED, left: FLOAT_RED, right: darken(FLOAT_RED, 0.7) });
  return m;
}

/** A rack of split fish drying in the wind (1 x 2): poles and cross-sticks hung thick with them. */
function fishRack(): IsoModel {
  const m = new IsoModel();
  for (const y of [0.15, 1.85]) {
    line(m, { x: 0.3, y, z: 0 }, { x: 0.5, y, z: 30 }, OAK_DARK, 0.06);
    line(m, { x: 0.7, y, z: 0 }, { x: 0.5, y, z: 30 }, OAK_DARK, 0.06);
  }
  for (const z of [28, 18]) {
    m.box(0.47, 0.12, z, 0.06, 1.76, 1.5, { top: OAK_LIGHT, left: OAK, right: OAK_DARK });
    for (let i = 0; i < 11; i++) {
      const y = 0.22 + i * 0.15;
      const c = hash(i, z) < 0.5 ? SMOKED : SILVER;
      m.quad({ x: 0.5, y, z }, { x: 0, y: 0.09, z: 0 }, { x: 0, y: 0.01, z: -9 }, (u, v) => {
        const w = 0.5 - Math.abs(v - 0.45) * 0.6;
        if (Math.abs(u - 0.5) > w) return null;
        if (v > 0.85) return darken(c, 0.6);
        return u < 0.4 ? lighten(c, 0.15) : u > 0.65 ? darken(c, 0.75) : c;
      });
    }
  }
  return m;
}

/** Eel traps: long wicker bottles with funnel necks, stacked and leaning. */
function eelTraps(): IsoModel {
  const m = new IsoModel();
  const trap = (x: number, y: number, z: number, len: number, along: 'x' | 'y') => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = 0.06 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.2));
      const px = along === 'x' ? x + t * len : x;
      const py = along === 'y' ? y + t * len : y;
      m.cylinder(px, py, z + (0.16 - r) * 30, r, r * 60, weave(10, i), WICKER_DARK);
    }
  };
  trap(0.15, 0.25, 0, 0.7, 'x');
  trap(0.2, 0.6, 0, 0.65, 'x');
  trap(0.3, 0.42, 9, 0.6, 'x');
  return m;
}

/**
 * The boathouse (4 x 4) above the shingle, gable end to the river: tarred
 * boards on a stone footing, a steep shingled roof, the great doors folded
 * open on the dark inside where a boat stands on the stocks half-built, a
 * lantern on a bracket over the doors, and oars and a mast stood against the side.
 */
function boathouse(): IsoModel {
  const m = new IsoModel();
  const x0 = 0.2;
  const y0 = 0.1;
  const W = 3.4;
  const D = 3.4;
  const H = 40;
  const R = 46;
  const roof = shingles(61, 0x6e645c);
  // Gable to +y: ridge along y.
  const ridgeX = x0 + W / 2;
  m.quad({ x: ridgeX, y: y0 - 0.25, z: H + R }, { x: 0, y: D + 0.5, z: 0 }, { x: -W / 2 - 0.3, y: 0, z: -R - 6 }, roof);
  m.box(x0, y0, 0, W, D, 6, { top: QUAY, left: quayStone(63, 2), right: (u, v) => darken(quayStone(64, 2)(u, v) ?? QUAY, 0.8) });
  const tarred = (s: number) => weatherboard(11, s, TAR, TAR_DARK, TAR_LIGHT);
  m.box(x0, y0, 6, W, D, H - 6, {
    top: TAR,
    left: (u, v) => {
      // The great doorway, open on the dark: ribs of a half-built boat on the stocks inside.
      if (u > 0.18 && u < 0.82 && v > 0.08) {
        const du = (u - 0.18) / 0.64;
        if (du < 0.05 || du > 0.95 || v < 0.13) return TAR_DARK;
        const y = (v - 0.13) / 0.87;
        // The keel along the floor, ribs curving up from it.
        if (y > 0.78 && y < 0.86 && du > 0.12 && du < 0.88) return OAK;
        for (const rib of [0.22, 0.34, 0.46, 0.58, 0.7, 0.82]) {
          const ry = 0.3 + Math.abs(du - 0.5) * 0.4;
          if (Math.abs(du - rib) < 0.018 && y > ry && y < 0.8) return mix(OAK_LIGHT, OAK, (y - ry) * 2);
        }
        if (y > 0.86) return hash(Math.floor(du * 30), Math.floor(y * 20)) < 0.3 ? 0xc8a878 : 0x2a221c;
        return mix(0x0e0c0a, 0x2a2018, y * 0.6);
      }
      return tarred(65)(u, v);
    },
    right: (u, v) => {
      if (u > 0.45 && u < 0.6 && v > 0.3 && v < 0.55) return u < 0.47 || u > 0.58 || v < 0.32 || v > 0.53 ? TAR_DARK : P.glassLit;
      return darken(tarred(67)(u, v) ?? TAR, 0.8);
    },
  });
  // The gable over the doors, with a hoist beam sticking out and a block on it.
  m.quad({ x: x0, y: y0 + D, z: H }, { x: W, y: 0, z: 0 }, { x: 0, y: 0, z: R }, (u, v) => {
    const half = Math.abs(u - 0.5) * 2;
    if (v > 1 - half) return null;
    if (v > 0.25 && v < 0.5 && Math.abs(u - 0.5) < 0.08) return Math.abs(u - 0.5) < 0.06 && v > 0.28 && v < 0.47 ? 0x0e0c0a : OAK_DARK;
    return tarred(69)(u, v);
  });
  m.box(ridgeX - 0.06, y0 + D - 0.4, H + R * 0.62, 0.12, 0.9, 4, { top: OAK, left: OAK_DARK, right: TAR_DARK });
  line(m, { x: ridgeX, y: y0 + D + 0.45, z: H + R * 0.62 }, { x: ridgeX, y: y0 + D + 0.45, z: H - 6 }, ROPE, 0.025);
  m.box(ridgeX - 0.05, y0 + D + 0.4, H + R * 0.62 - 5, 0.1, 0.1, 5, { top: OAK, left: OAK_DARK, right: P.iron });
  // The near roof slope, and bargeboards at the gable.
  m.quad({ x: ridgeX, y: y0 - 0.25, z: H + R }, { x: 0, y: D + 0.5, z: 0 }, { x: W / 2 + 0.3, y: 0, z: -R - 6 }, roof);
  for (const k of [-1, 1]) m.quad({ x: ridgeX, y: y0 + D + 0.25, z: H + R + 1 }, { x: k * (W / 2 + 0.3), y: 0, z: -R - 6 }, { x: 0, y: 0.02, z: -3 }, OAK_DARK);
  // The doors, folded back against the front.
  for (const [u0, du] of [[0.18, -0.5], [0.82, 0.5]] as const) {
    m.quad({ x: x0 + W * u0, y: y0 + D, z: H - 4 }, { x: du * 0.6, y: 0.35, z: 0 }, { x: 0, y: 0, z: -(H - 10) }, (u, v) => ((u * 5) % 1 < 0.1 ? TAR_DARK : Math.abs(v - 0.2) < 0.03 || Math.abs(v - 0.8) < 0.03 ? P.iron : TAR_LIGHT));
  }
  // The lantern over the doors.
  m.box(ridgeX - 0.05, y0 + D, H - 2, 0.1, 0.3, 1.5, { top: P.iron, left: P.iron, right: P.iron });
  m.box(ridgeX - 0.08, y0 + D + 0.22, H - 12, 0.16, 0.16, 8, { top: P.iron, left: (u, v) => (u < 0.15 || u > 0.85 || v < 0.12 || v > 0.88 ? P.iron : P.glassLit), right: P.fireOrange });
  // Oars and a spare mast stood against the far side.
  for (let i = 0; i < 4; i++) line(m, { x: x0 + W + 0.12 + i * 0.03, y: y0 + 0.6 + i * 0.4, z: 0 }, { x: x0 + W + 0.02, y: y0 + 0.5 + i * 0.4, z: 44 + (i % 2) * 6 }, i === 3 ? OAK : OAK_LIGHT, 0.05);
  return m;
}

/** The slipway: greased timber rails and cross-sleepers running down the shingle into the water (2 x 1 per piece). */
function slip(top: boolean): RenderedModel {
  const m = new IsoModel();
  // Sleepers across, and the two rails along y.
  for (let i = 0; i < 3; i++) m.box(0.15, 0.1 + i * 0.33, 0, 1.7, 0.12, 1.2, { top: OAK_DARK, left: OAK_GAP, right: OAK_GAP });
  for (const x of [0.55, 1.35]) m.box(x, 0, 1.2, 0.12, 1, 1.5, { top: (_u, v) => (hash(Math.floor(v * 10), x * 10) < 0.3 ? 0x2a241c : top ? OAK : mix(OAK, SLIME, 0.4)), left: OAK_DARK, right: OAK_GAP });
  return padded(m.render(false), 2);
}

/**
 * A wayside shrine by the water: a squat stone pillar with a niche in it, the
 * Saints' ring cut over the niche, candle stubs burning inside, and
 * offerings on the ledge and wildflowers round its foot.
 */
function shrine(): IsoModel {
  const m = new IsoModel();
  m.box(0.22, 0.28, 0, 0.56, 0.5, 4, { top: QUAY_LIGHT, left: QUAY, right: QUAY_DARK });
  const face: Shader = (u, v) => {
    // The niche: a rounded arch, dark, with a candle flame in it.
    const nu = (u - 0.5) / 0.28;
    const nv = (v - 0.5) / 0.3;
    const arch = nv > -0.4 ? Math.abs(nu) < 1 : Math.hypot(nu, (nv + 0.4) * 1.6) < 1;
    if (arch && nv < 1) {
      if (Math.abs(nu) < 0.12 && nv > 0.3 && nv < 0.7) return nv < 0.45 ? P.fireYellow : 0xe8e0c8;
      if (Math.abs(nu + 0.5) < 0.1 && nv > 0.55 && nv < 0.9) return nv < 0.62 ? P.fireOrange : 0xd8d0b8;
      return nv > 0.8 ? 0x3a2a1a : 0x1a1410;
    }
    // The Saints' ring cut over the niche.
    const ring = Math.hypot((u - 0.5) / 0.14, (v - 0.12) / 0.07);
    if (ring > 0.75 && ring < 1.05) return QUAY_DARK;
    const n = hash(Math.floor(u * 6), Math.floor(v * 8));
    return v > 0.85 && n < 0.5 ? P.moss : n < 0.2 ? QUAY_DARK : n > 0.8 ? QUAY_LIGHT : QUAY;
  };
  m.box(0.28, 0.34, 4, 0.44, 0.38, 30, { top: QUAY_LIGHT, left: face, right: (u, v) => (hash(Math.floor(u * 6), Math.floor(v * 8)) < 0.3 ? QUAY_DARK : darken(QUAY, 0.82)) });
  // A little gabled cap of stone.
  m.quad({ x: 0.22, y: 0.53, z: 40 }, { x: 0.56, y: 0, z: 0 }, { x: 0, y: -0.25, z: -6 }, QUAY_LIGHT);
  m.quad({ x: 0.22, y: 0.53, z: 40 }, { x: 0.56, y: 0, z: 0 }, { x: 0, y: 0.25, z: -6 }, (u) => (u < 0.1 ? QUAY : mix(QUAY, P.moss, 0.25)));
  // Offerings on the plinth, and flowers round the foot.
  m.box(0.3, 0.72, 4, 0.06, 0.04, 2, { top: 0x8a6a3a, left: 0x6a4a2a, right: 0x4a3a2a });
  m.box(0.55, 0.74, 4, 0.08, 0.05, 1.5, { top: P.ironLight, left: P.iron, right: P.iron });
  const rnd = seededRandom(91);
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const x = 0.5 + Math.cos(a) * 0.38;
    const y = 0.55 + Math.sin(a) * 0.38;
    m.box(x, y, 0, 0.04, 0.04, 3 + rnd() * 3, { top: [P.flowerYellow, P.flowerWhite, P.flowerBlue, 0xc88ad8][i % 4], left: P.leafDark, right: P.leafDark });
  }
  return m;
}

// ---------------------------------------------------------------- the banks

/**
 * A clump of reeds standing in the shallows (drawn on one tile): tall blades
 * leaning every way, some green and some gone straw-coloured, bulrushes with
 * their brown heads, and yellow flags in flower among them.
 */
function reeds(seed: number): PixelCanvas {
  const W = 64;
  const H = 76;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  const foot = { x: W / 2, y: H - 14 };
  // Ripples round the stems.
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 12 + rnd() * 9;
    c.set(foot.x + Math.cos(a) * r, foot.y + 3 + Math.sin(a) * r * 0.45, P.waterLight, 140);
  }
  const blades = 34 + Math.floor(rnd() * 10);
  for (let i = 0; i < blades; i++) {
    const bx = foot.x + (rnd() - 0.5) * 30;
    const by = foot.y + (rnd() - 0.5) * 9;
    const len = 16 + rnd() * 26;
    const lean = (rnd() - 0.5) * 0.9;
    const dry = rnd() < 0.25;
    const col = dry ? REED_DRY : rnd() < 0.5 ? REED : REED_LIGHT;
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const x = bx + lean * k + Math.sin(t * 3 + i) * 0.6 * t * 3;
      const y = by - k;
      c.set(x, y, t < 0.2 ? REED_DARK : t > 0.85 && !dry ? REED_LIGHT : col);
      if (t < 0.4) c.set(x + 1, y, REED_DARK);
    }
    // A bulrush head on some of the taller ones.
    if (len > 34 && rnd() < 0.45) {
      const tx = bx + lean * (len - 8);
      for (let k = 0; k < 7; k++) {
        c.set(tx, by - len + 8 + k, k < 1 ? REED_DARK : MACE);
        c.set(tx + 1, by - len + 8 + k, k === 0 ? REED_DARK : darken(MACE, 0.7));
      }
    }
  }
  // Yellow flag irises.
  for (let i = 0; i < 3; i++) {
    if (rnd() < 0.35) continue;
    const x = foot.x + (rnd() - 0.5) * 22;
    const y = foot.y - 22 - rnd() * 14;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 1], [2, 1], [0, 1], [1, 1], [0, 2]]) c.set(x + dx, y + dy, dy === 2 ? 0xc89a18 : FLAG_YELLOW);
  }
  c.outline();
  return c;
}

/** Water lilies on a tile: round pads with a notch, overlapping, and white flowers with gold hearts. */
function lilies(seed: number): PixelCanvas {
  const c = new PixelCanvas(64, 32);
  const rnd = seededRandom(seed);
  for (let i = 0; i < 7; i++) {
    const x = 12 + rnd() * 40;
    const y = 8 + rnd() * 16;
    const r = 4 + rnd() * 3;
    const notch = rnd() * Math.PI * 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r * 2; dx <= r * 2; dx++) {
        const d = Math.hypot(dx / 2, dy);
        if (d > r) continue;
        const a = Math.atan2(dy, dx / 2);
        if (Math.abs(Phaser.Math.Angle.Wrap(a - notch)) < 0.3 && d > 1) continue;
        const col = d > r - 1 ? P.leafDark : dx < -r * 0.6 ? P.leafLight : P.leaf;
        c.set(x + dx, y + dy, col);
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    const x = Math.round(16 + rnd() * 32);
    const y = Math.round(10 + rnd() * 12);
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) c.set(x + dx, y + dy, P.flowerWhite);
    c.set(x, y, P.flowerYellow);
    c.set(x, y - 2, 0xf4d8e0);
  }
  return c;
}

/** A grey heron standing in the shallows on one leg, neck drawn in, watching the water. */
function heronBird(): PixelCanvas {
  const c = new PixelCanvas(40, 56);
  const G = 0x9aa4ac;
  const GD = 0x6a747c;
  const GL = 0xd8dcdc;
  const fx = 20;
  const fy = 48;
  // The leg, into the water, and its ripple.
  for (let y = fy - 12; y <= fy; y++) c.set(fx, y, 0xc8a050);
  for (let a = 0; a < 20; a++) c.set(fx + Math.cos((a / 20) * Math.PI * 2) * 6, fy + 1 + Math.sin((a / 20) * Math.PI * 2) * 2, P.waterLight, 160);
  // The body: a teardrop tilted up, darker wings, the plumes trailing.
  c.ellipse(fx, fy - 18, 7, 6, G, GD, GL);
  for (let i = 0; i < 6; i++) c.set(fx + 6 + i, fy - 14 + Math.floor(i / 2), GD);
  for (let x = -6; x <= 4; x++) c.set(fx + x, fy - 15, GD);
  // The neck, drawn back in an S, white with a black streak, and the head with its black crest.
  for (let i = 0; i < 9; i++) {
    const x = fx - 3 + Math.round(Math.sin(i * 0.5) * 2);
    c.set(x, fy - 24 - i, GL);
    c.set(x + 1, fy - 24 - i, i % 3 === 0 ? 0x2a2a2e : GL);
  }
  c.ellipse(fx - 2, fy - 34, 3, 2.5, GL, G, 0xffffff);
  for (let i = 0; i < 6; i++) c.set(fx + 1 + i, fy - 35 + Math.floor(i / 3), 0x1a1a1e);
  c.set(fx - 3, fy - 35, 0x1a1a1e);
  // The dagger of a beak.
  for (let i = 0; i < 9; i++) c.set(fx - 5 - i, fy - 34 + Math.floor(i / 4), i < 2 ? 0xd8a030 : 0xe8b848);
  c.outline();
  return c;
}


/** A strip of frames, each `w` wide, registered as one texture with numbered frames. */
function strip(scene: Phaser.Scene, key: string, c: PixelCanvas, frames: number): void {
  const tex = c.toTexture(scene, key);
  const w = c.width / frames;
  for (let i = 0; i < frames; i++) tex.add(i, 0, i * w, 0, w, c.height);
}

/**
 * A herring gull, side on, facing right: standing (0), crying with its head
 * thrown up (1), wings up (2) and wings down (3) in flight. White, with a grey
 * mantle, black wingtips and a yellow beak with its red spot.
 */
function gull(): PixelCanvas {
  const W = 18;
  const H = 16;
  const c = new PixelCanvas(W * 4, H);
  const WHITE = 0xf2f2ee;
  const SHADE = 0xc8ccd0;
  const MANTLE = 0x9aa6b2;
  const MANTLE_D = 0x6e7a88;
  const TIP = 0x1e2026;
  const BEAK = 0xf0c838;
  const LEG = 0xe0a8a0;
  for (let f = 0; f < 4; f++) {
    const o = f * W;
    if (f < 2) {
      // Body: a white teardrop, grey wing folded over its back, black tips crossed at the tail.
      c.ellipse(o + 8, 9, 5, 3, WHITE, SHADE, 0xffffff);
      c.rect(o + 5, 7, 7, 2, MANTLE);
      c.rect(o + 4, 8, 6, 1, MANTLE_D);
      c.set(o + 2, 8, TIP);
      c.set(o + 1, 8, TIP);
      c.set(o + 2, 9, TIP);
      c.set(o + 3, 9, WHITE);
      const up = f === 1;
      const hx = up ? o + 12 : o + 13;
      const hy = up ? 3 : 5;
      c.ellipse(hx, hy, 2, 2, WHITE, SHADE, 0xffffff);
      c.set(o + 12, up ? 5 : 6, WHITE);
      c.set(hx + 1, hy - 1, 0x1a1a1a);
      if (up) {
        c.set(hx + 1, hy - 2, BEAK);
        c.set(hx + 2, hy - 3, BEAK);
        c.set(hx + 2, hy - 1, BEAK);
        c.set(hx + 3, hy - 2, 0xd04030);
      } else {
        c.set(hx + 2, hy, BEAK);
        c.set(hx + 3, hy, BEAK);
        c.set(hx + 3, hy + 1, 0xd04030);
      }
      c.set(o + 7, 12, LEG);
      c.set(o + 9, 12, LEG);
      c.set(o + 7, 13, LEG);
      c.set(o + 9, 13, LEG);
      c.set(o + 6, 13, LEG);
      c.set(o + 10, 13, LEG);
    } else {
      // In flight: a long slim body and the wings swept up (2) or down (3).
      c.ellipse(o + 9, 8, 5, 2, WHITE, SHADE, 0xffffff);
      c.ellipse(o + 14, 7, 2, 1.5, WHITE, SHADE, 0xffffff);
      c.set(o + 16, 7, BEAK);
      c.set(o + 17, 7, BEAK);
      c.set(o + 4, 8, WHITE);
      c.set(o + 3, 8, SHADE);
      const dir = f === 2 ? -1 : 1;
      for (let i = 0; i < 7; i++) {
        const y = 7 + dir * Math.round(i * 0.85);
        const x = o + 9 - Math.round(i * 0.55);
        c.set(x, y, i > 4 ? TIP : MANTLE);
        c.set(x + 1, y, i > 4 ? TIP : i > 2 ? MANTLE : MANTLE_D);
        c.set(x + 2, y, i > 5 ? TIP : MANTLE);
      }
    }
  }
  c.outline();
  return c;
}

/** A mallard drake (0, 1: paddling, the wake in two places) and up-ended, dabbling (2); a brown duck (3, 4, 5) the same. */
function ducks(): PixelCanvas {
  const W = 16;
  const H = 12;
  const c = new PixelCanvas(W * 6, H);
  for (let f = 0; f < 6; f++) {
    const o = f * W;
    const drake = f < 3;
    const body = drake ? 0xb8b4ac : 0x8a6a46;
    const bodyD = drake ? 0x7a766e : 0x5e4630;
    const bodyL = drake ? 0xdcd8d0 : 0xa88460;
    const head = drake ? 0x2a6a3a : 0x7a5a3a;
    const wake = (f % 3) % 2;
    if (f % 3 === 2) {
      // Tail up, head under.
      c.ellipse(o + 8, 8, 3, 3, body, bodyD, bodyL);
      c.set(o + 8, 4, drake ? 0x1a1a1e : bodyD);
      c.set(o + 9, 5, drake ? 0x1a1a1e : bodyD);
      c.set(o + 7, 5, drake ? 0xf4f0e6 : bodyL);
      for (let a = 0; a < 14; a++) c.set(o + 8 + Math.round(Math.cos((a / 14) * Math.PI * 2) * 5), 10 + Math.round(Math.sin((a / 14) * Math.PI * 2) * 1.2), P.waterLight, 200);
      continue;
    }
    c.ellipse(o + 7, 8, 5, 2.5, body, bodyD, bodyL);
    c.set(o + 2, 7, bodyD);
    c.set(o + 1, 6, drake ? 0x1a1a1e : bodyD);
    if (drake) {
      c.set(o + 5, 7, 0x3a52a0);
      c.set(o + 6, 7, 0x3a52a0);
      c.rect(o + 9, 7, 2, 2, 0x7a4a2e);
    }
    c.ellipse(o + 11, 4, 2, 2, head, darken(head, 0.7), lighten(head, 0.25));
    c.set(o + 11, 6, drake ? 0xf4f0e6 : head);
    c.set(o + 12, 3, 0x1a1a1a);
    c.set(o + 13, 4, drake ? 0xe8c838 : 0xc88a3a);
    c.set(o + 14, 4, drake ? 0xe8c838 : 0xc88a3a);
    // The wake: a broken bright line behind and a ripple at the breast.
    for (let i = 0; i < 4; i++) c.set(o + 1 - i + wake, 10 - (i % 2), P.waterLight, 210 - i * 40);
    c.set(o + 12, 10, P.waterLight, 200);
    c.set(o + 13, 9 + wake, P.waterLight, 160);
  }
  c.outline();
  return c;
}

/** A streak of the current: a thin, bright glint on the water that drifts downstream. */
function currentStreak(): PixelCanvas {
  const c = new PixelCanvas(14, 3);
  for (let x = 0; x < 14; x++) {
    const t = Math.sin((x / 13) * Math.PI);
    c.set(x, 1, 0xcfe4f0, Math.round(220 * t));
    if (x > 3 && x < 10) c.set(x + 1, 2, 0x8ab8d8, Math.round(120 * t));
  }
  return c;
}

// ---------------------------------------------------------------- registering

/** Registers a canvas drawn around one tile's middle, `footY` pixels down from its top. */
function registerOnTile(scene: Phaser.Scene, key: string, c: PixelCanvas, footY: number): void {
  c.toTexture(scene, key);
  // The tile's back corner is half a tile above its middle.
  MODEL_ART[key] = { key, originX: 0.5, originY: (footY - 16) / c.height };
}

/** Every combination of open edges a deck tile can have ('' for none), in the order n, e, s, w. */
export function deckKey(open: { n: boolean; e: boolean; s: boolean; w: boolean }): string {
  return `jt-deck-${open.n ? 'n' : ''}${open.e ? 'e' : ''}${open.s ? 's' : ''}${open.w ? 'w' : ''}`;
}

export function generateJetty(scene: Phaser.Scene): void {
  for (let mask = 0; mask < 16; mask++) {
    const open = { n: !!(mask & 1), e: !!(mask & 2), s: !!(mask & 4), w: !!(mask & 8) };
    registerModel(scene, deckKey(open), deckTile(`${open.n ? 'n' : ''}${open.e ? 'e' : ''}${open.s ? 's' : ''}${open.w ? 'w' : ''}`, 3 + mask * 7));
  }
  for (let i = 0; i < 3; i++) registerModel(scene, `jt-quay-${i}`, quayEdge(11 + i * 5));
  registerModel(scene, 'jt-quay-steps', quayEdge(29, true));
  registerModel(scene, 'jt-bollard', bollard().render());
  registerModel(scene, 'jt-ropecoil', ropeCoil().render());
  registerModel(scene, 'jt-pierlamp-w', pierLamp(false).render());
  registerModel(scene, 'jt-pierlamp-e', pierLamp(true).render());
  registerModel(scene, 'jt-fishbasket', fishBasket().render());
  registerModel(scene, 'jt-crane', crane().render());
  registerModel(scene, 'jt-barrels-fish', fishBarrels().render());
  registerModel(scene, 'jt-creels', creels().render());
  registerModel(scene, 'jt-anchor', anchor().render());
  registerModel(scene, 'jt-signboard', signboard().render());
  registerModel(scene, 'jt-stool', stool().render());
  registerModel(scene, 'jt-netmend', netHeap().render());
  registerModel(scene, 'jt-heron', greyHeron());
  // Lying at Gloomhaven, bow upstream (west), as she does under way at a quarter turn back (see GLOOM_HERON).
  registerModel(scene, heronUnderwayKey(0, false), greyHeron({ heading: HERON_HEADINGS[0], sail: false }));
  registerModel(scene, 'jt-rowboat-0', rowboat(0x4a6e4a, 0xd8c8a0, 1, true));
  registerModel(scene, 'jt-rowboat-1', rowboat(0x3e5a86, 0xe0d8c4, 2, true));
  registerModel(scene, 'jt-rowboat-2', rowboat(0x8a4a32, undefined, 3, true));
  registerModel(scene, 'jt-rowboat-beached', beachedBoat());
  registerModel(scene, 'jt-upturned', upturnedBoat().render());
  registerModel(scene, 'jt-tarpot', tarPot().render());
  registerModel(scene, 'jt-hut-ebb', hut({ wall: [TAR, TAR_DARK, TAR_LIGHT], roof: 'thatch', seed: 71, nets: true, pike: true }).render());
  registerModel(scene, 'jt-hut-pellow', hut({ wall: [LIME, LIME_DARK, 0xeee8da], roof: 'shingle', seed: 73, butt: true, beans: true }).render());
  registerModel(scene, 'jt-smokehouse', smokehouse().render());
  registerModel(scene, 'jt-guttable', gutTable().render());
  registerModel(scene, 'jt-netrack', netRack().render());
  registerModel(scene, 'jt-fishrack', fishRack().render());
  registerModel(scene, 'jt-eeltraps', eelTraps().render());
  registerModel(scene, 'jt-boathouse', boathouse().render());
  registerModel(scene, 'jt-slip', slip(false));
  registerModel(scene, 'jt-slip-top', slip(true));
  registerModel(scene, 'jt-shrine', shrine().render());
  for (let i = 0; i < 3; i++) registerOnTile(scene, `jt-reeds-${i}`, reeds(401 + i * 17), 76 - 14);
  for (let i = 0; i < 2; i++) registerOnTile(scene, `jt-lilies-${i}`, lilies(501 + i * 11), 16);
  registerOnTile(scene, 'jt-heronbird', heronBird(), 48);
  strip(scene, 'jt-gull', gull(), 4);
  strip(scene, 'jt-duck', ducks(), 6);
  currentStreak().toTexture(scene, 'jt-current');
}
