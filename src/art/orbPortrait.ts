import Phaser from 'phaser';
import { ORB_PORTRAIT } from './sizes';

/**
 * The orb in the brood hall, for whoever speaks through it: a ball of glass held up in bone
 * talons, with a pool of colour turning slowly inside it, and deep in the pool the faint shape
 * of someone hooded, looking out. No face: only the idea of one.
 *
 * Unlike the other portraits (pixel art, three frames for talking and blinking), this one is
 * painted smooth and bigger, and moves all the time: a loop of {@link ORB_PORTRAIT.frames}
 * frames, then the same loop again "stirred" (brighter, faster, the figure nearer the glass) for
 * while the voice is speaking. DialogueScene plays the loop and fades the stirred one in and out.
 */

const N = ORB_PORTRAIT.size;
const FRAMES = ORB_PORTRAIT.frames;
const COLS = 8;
/** The orb's middle and radius, in pixels. */
const OX = N / 2;
const OY = N * 0.46;
const R = N * 0.38;
const TAU = Math.PI * 2;

type RGB = [number, number, number];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * The pool's colours, round a wheel: deep indigo, violet, magenta, ember gold, sea teal, and back.
 * Jewel tones rather than a rainbow, so it reads as one strange light.
 */
const WHEEL: RGB[] = [
  [0.16, 0.08, 0.42],
  [0.46, 0.16, 0.78],
  [0.86, 0.24, 0.66],
  [1.0, 0.62, 0.3],
  [0.2, 0.74, 0.78],
  [0.14, 0.3, 0.7],
];
function wheel(h: number): RGB {
  const f = (((h % 1) + 1) % 1) * WHEEL.length;
  const i = Math.floor(f);
  const t = f - i;
  return lerp(WHEEL[i], WHEEL[(i + 1) % WHEEL.length], t * t * (3 - 2 * t));
}

/** A float RGBA canvas with "over" blending, so soft edges, glows and glass can be layered. */
class Paint {
  readonly px = new Float32Array(N * N * 4);
  over(x: number, y: number, c: RGB, a: number): void {
    if (a <= 0 || x < 0 || y < 0 || x >= N || y >= N) return;
    a = Math.min(1, a);
    const i = (y * N + x) * 4;
    const da = this.px[i + 3];
    const oa = a + da * (1 - a);
    for (let k = 0; k < 3; k++) this.px[i + k] = (c[k] * a + this.px[i + k] * da * (1 - a)) / oa;
    this.px[i + 3] = oa;
  }
  /** Adds light on top of what is there (for glints and motes), without changing coverage. */
  add(x: number, y: number, c: RGB, a: number): void {
    if (a <= 0 || x < 0 || y < 0 || x >= N || y >= N) return;
    const i = (y * N + x) * 4;
    for (let k = 0; k < 3; k++) this.px[i + k] = Math.min(1, this.px[i + k] + c[k] * a);
    this.px[i + 3] = Math.max(this.px[i + 3], Math.min(1, a));
  }
}

/** How much of the hooded figure covers a point inside the orb (in orb units, -1..1), 0..1, soft-edged. */
function figure(x: number, y: number, near: number): number {
  // It sits a little low and grows as it leans nearer the glass.
  const s = 1 / (0.9 + near * 0.16);
  x *= s;
  y = (y - 0.08) * s;
  // The hood: a tall rounded dome, a little narrower at the top.
  const hx = x / (0.25 - Math.max(0, -y - 0.12) * 0.32);
  const hy = (y + 0.04) / 0.36;
  const hood = 1 - Math.hypot(hx, hy);
  // Shoulders and a cloak falling away below, wider the lower it goes.
  const sx = x / (0.62 + Math.max(0, y - 0.35) * 0.7);
  const sy = (y - 0.6) / 0.4;
  const body = 1 - Math.hypot(sx, Math.min(0, sy));
  // A soft union, so the hood flows down into the shoulders.
  const k = 9;
  const joined = Math.log(Math.exp(k * hood) + Math.exp(k * body)) / k;
  return smooth(-0.04, 0.22, joined);
}

/**
 * Everything about each pixel that doesn't change from frame to frame (where it is on the glass,
 * how the glass bends it, the highlights), worked out once so every frame paints quickly.
 */
interface Geo {
  /** Pixels on the orb: index, and per pixel the values below. */
  idx: Int32Array;
  nx: Float32Array;
  ny: Float32Array;
  cover: Float32Array;
  qr: Float32Array;
  th: Float32Array;
  /** How hard the vortex twists here (times the twist strength). */
  twist: Float32Array;
  eye: Float32Array;
  heart: Float32Array;
  heartTint: Float32Array;
  rim: Float32Array;
  fres: Float32Array;
  shine: Float32Array;
  caustic: Float32Array;
  /** Pixels in the glow round the orb, and how strong it is there. */
  glowIdx: Int32Array;
  glow: Float32Array;
}

function geometry(): Geo {
  const orb: number[] = [];
  const glowIdx: number[] = [];
  const glowV: number[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const r = Math.hypot(x + 0.5 - OX, y + 0.5 - OY) / R;
      if (r <= 1 + 1 / R) orb.push(y * N + x);
      if (r >= 0.98 && r <= 1.4) {
        // Faded out before the edge of the frame, so it never ends in a hard line.
        const edge = clamp01(Math.min(x, y, N - 1 - x) / 10);
        glowIdx.push(y * N + x);
        glowV.push(Math.pow(clamp01(1 - (r - 1) / 0.4), 2.2) * 0.55 * edge);
      }
    }
  }
  const n = orb.length;
  const f = () => new Float32Array(n);
  const g: Geo = {
    idx: Int32Array.from(orb), nx: f(), ny: f(), cover: f(), qr: f(), th: f(), twist: f(), eye: f(),
    heart: f(), heartTint: f(), rim: f(), fres: f(), shine: f(), caustic: f(),
    glowIdx: Int32Array.from(glowIdx), glow: Float32Array.from(glowV),
  };
  for (let k = 0; k < n; k++) {
    const x = orb[k] % N;
    const y = Math.floor(orb[k] / N);
    const nx = (x + 0.5 - OX) / R;
    const ny = (y + 0.5 - OY) / R;
    const r = Math.hypot(nx, ny);
    const z = Math.sqrt(Math.max(0, 1 - r * r));
    // Looking into the glass bends the pool: it bunches up towards the rim.
    const bend = 1 + 0.45 * (1 - z);
    const qx = nx * bend;
    const qy = ny * bend;
    const qr = Math.hypot(qx, qy);
    g.nx[k] = nx;
    g.ny[k] = ny;
    g.cover[k] = clamp01((1 - r) * R + 0.5);
    g.qr[k] = qr;
    g.th[k] = Math.atan2(qy, qx);
    // The vortex twists harder towards the middle.
    g.twist[k] = Math.pow(1 - Math.min(1, qr / 1.4), 1.6);
    // Right in the eye of the vortex the streamers would pinch to a point, so they melt there.
    g.eye[k] = smooth(0.08, 0.5, qr);
    // A light burns in the heart of the pool, behind the figure, so it stands dark against it.
    const hd = qx * qx * 1.3 + (qy - 0.05) * (qy - 0.05) * 0.8;
    g.heart[k] = Math.exp(-hd * 3.2);
    g.heartTint[k] = Math.exp(-hd * 4) * 0.55;
    // The glass: darker and cooler at the rim, then a thin bright edge where light wraps round.
    g.rim[k] = Math.pow(1 - z, 2.5) * 0.55;
    g.fres[k] = Math.pow(1 - z, 6) * 0.8;
    // A broad soft window of light in the top left, and a tight glint inside it.
    const hx = nx + 0.4;
    const hy = ny + 0.44;
    const soft = Math.exp(-(hx * hx * 9 + hy * hy * 14)) * 0.45;
    const glint = Math.exp(-((nx + 0.44) ** 2 + (ny + 0.5) ** 2) * 260) * 0.95;
    g.shine[k] = (soft + glint) * g.cover[k];
    // And the light that comes through the glass and gathers on the far side, low right.
    g.caustic[k] = Math.exp(-((nx - 0.32) ** 2 * 10 + (ny - 0.62) ** 2 * 26)) * 0.28 * g.cover[k];
  }
  return g;
}

/** Paints one frame of the loop into `p`. `t` runs 0..1 round the loop; `stir` is 0 calm or 1 speaking. */
function paintFrame(p: Paint, G: Geo, t: number, stir: number, claws: Paint): void {
  const ph = t * TAU;
  // Everything that moves does so a whole number of times per loop, so the loop has no seam.
  const near = stir * 0.6 + 0.2 + 0.2 * Math.sin(ph);
  const glowPulse = 0.75 + 0.25 * Math.sin(ph * 2) + stir * 0.35;

  // The glow the orb throws on the dark around it: the pool's colour, breathing.
  const glowHue = wheel(0.15 + 0.1 * Math.sin(ph));
  const glowCol = lerp(glowHue, [0.85, 0.7, 1], 0.3);
  for (let k = 0; k < G.glowIdx.length; k++) {
    const i = G.glowIdx[k];
    p.over(i % N, Math.floor(i / N), glowCol, G.glow[k] * glowPulse);
  }

  const twistBy = 2.4 + stir * 0.8;
  const spin1 = ph * (stir > 0.5 ? 2 : 1);
  const heartBy = 0.7 + 0.2 * Math.sin(ph * 2) + stir * 0.3;
  for (let k = 0; k < G.idx.length; k++) {
    const x = G.idx[k] % N;
    const y = Math.floor(G.idx[k] / N);
    const qr = G.qr[k];
    const th = G.th[k];
    const eye = G.eye[k];

    // A vortex: the angle is twisted harder towards the middle, and the whole of it turns.
    const twist = twistBy * G.twist[k];
    const warp = 0.55 * Math.sin(2 * th - 5 * qr + ph) + 0.3 * Math.sin(3 * th + 4 * qr - ph * 2);
    const a = th + twist + warp;
    // Two layers of streamers, turning against each other.
    const band1 = 0.5 + 0.5 * eye * Math.sin(3 * a + 7 * qr - spin1);
    const band2 = 0.5 + 0.5 * eye * Math.sin(5 * (th - twist * 0.6) - 9 * qr + ph * 2 + 1.7 + warp * 1.3);
    const b2 = band2 * band2;
    const filament = band1 * band1 * band1 * 0.75 + b2 * b2 * band2 * 0.6;

    // Colour drifts round the wheel with the swirl, so neighbouring streamers differ.
    const hue = 0.55 * band1 + 0.3 * band2 + qr * 0.35 + 0.12 * eye * Math.sin(a + ph) + t;
    let col = lerp(wheel(hue), [1, 0.74, 0.86], G.heartTint[k]);
    // Darker between, then lit up where the streamers cross.
    const bright = 0.22 + 0.4 * qr + G.heart[k] * heartBy + filament * (0.9 + stir * 0.35);
    col = [col[0] * bright, col[1] * bright, col[2] * bright];
    // The hottest streamers burn towards white.
    const hot = smooth(0.85, 1.25, filament * (1 + stir * 0.3));
    col = lerp(col, [1, 0.94, 0.98], hot * 0.6);

    // The figure: a shadow deep in the pool, its edge lit by the colour behind it. Streamers
    // pass in front of it, so it comes and goes.
    const fig = figure(G.nx[k], G.ny[k], near);
    if (fig > 0) {
      const veil = 1 - 0.5 * b2 * b2;
      const dark = fig * (0.82 + 0.12 * stir) * veil;
      col = lerp(col, [0.03, 0.01, 0.07], dark);
      const edge = fig * (1 - fig) * 4;
      col = lerp(col, lerp(wheel(hue + 0.3), [1, 1, 1], 0.3), edge * 0.35 * (0.6 + stir * 0.6) * veil);
    }

    col = lerp(col, [0.05, 0.03, 0.14], G.rim[k]);
    col = lerp(col, [0.78, 0.72, 1], G.fres[k]);
    p.over(x, y, [clamp01(col[0]), clamp01(col[1]), clamp01(col[2])], G.cover[k]);
    p.add(x, y, [1, 1, 1], G.shine[k]);
    p.add(x, y, lerp(wheel(hue), [1, 1, 1], 0.5), G.caustic[k] * glowPulse);
  }

  // Motes of light drifting round inside, each on its own orbit.
  for (let i = 0; i < 9; i++) {
    const turns = i % 3 === 0 ? -1 : 1;
    const ang = (i / 9) * TAU + ph * turns;
    const rad = 0.3 + 0.5 * ((i * 0.37) % 1);
    const mx = OX + Math.cos(ang) * rad * R * 0.92;
    const my = OY + Math.sin(ang) * rad * R * 0.62 + Math.sin(ph * 2 + i) * R * 0.08;
    // Behind the figure, not in front of it, or they would read as eyes.
    const hidden = figure((mx - OX) / R, (my - OY) / R, near);
    const twinkle = (0.5 + 0.5 * Math.sin(ph * 3 + i * 2.1)) * (1 - hidden);
    const c = wheel(i * 0.17 + t);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dy);
        const a = Math.exp(-d * d * 0.5) * (0.5 + stir * 0.3) * twinkle;
        p.add(Math.round(mx + dx), Math.round(my + dy), lerp(c, [1, 1, 1], 0.6), a);
      }
    }
  }

  // The talons are the same in every frame of a loop, so they are painted once and laid over.
  for (let i = 0; i < N * N; i++) {
    const a = claws.px[i * 4 + 3];
    if (a > 0) p.over(i % N, Math.floor(i / N), [claws.px[i * 4], claws.px[i * 4 + 1], claws.px[i * 4 + 2]], a);
  }
}

/** A tapering bone talon along a curve, lit from above left and by the orb on its inner side. */
function talon(p: Paint, pts: Array<[number, number]>, w0: number, w1: number, orbLight: RGB, glow: number): void {
  const bone: RGB = [0.86, 0.8, 0.68];
  const shade: RGB = [0.32, 0.24, 0.3];
  const steps = 120;
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    // A quadratic curve through the three points.
    const [a, b, c] = pts;
    const x = (1 - u) ** 2 * a[0] + 2 * (1 - u) * u * b[0] + u * u * c[0];
    const y = (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * b[1] + u * u * c[1];
    const w = w0 + (w1 - w0) * Math.pow(u, 0.8);
    for (let dy = -Math.ceil(w) - 1; dy <= Math.ceil(w) + 1; dy++) {
      for (let dx = -Math.ceil(w) - 1; dx <= Math.ceil(w) + 1; dx++) {
        const d = Math.hypot(dx, dy) / w;
        const cover = clamp01((1 - d) * w + 0.5);
        if (cover <= 0) continue;
        const lx = dx / w;
        const ly = dy / w;
        // Lit from the upper left; the orb's light from its side.
        const lit = clamp01(0.55 - lx * 0.35 - ly * 0.35);
        const towardOrb = clamp01(((OX - (x + dx)) * lx + (OY - (y + dy)) * ly) / (R * 0.4));
        let col = lerp(shade, bone, lit);
        col = lerp(col, orbLight, towardOrb * 0.45 * glow);
        // Rings round the bone, like a knuckle's.
        const ring = 0.5 + 0.5 * Math.sin(u * 26);
        col = lerp(col, shade, ring * 0.12);
        p.over(Math.round(x + dx), Math.round(y + dy), col, cover);
      }
    }
  }
}

/** Bone talons holding the orb up from below, and the knuckle they grow from. */
function talons(p: Paint, orbLight: RGB, glow: number): void {
  const base = N - 6;
  // The knuckle at the bottom, dark, catching a little of the orb's light on top.
  for (let y = base - 14; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const nx = (x + 0.5 - OX) / (R * 0.62);
      const ny = (y + 0.5 - (base + 2)) / 12;
      const d = Math.hypot(nx, ny);
      if (d > 1.05) continue;
      const cover = clamp01((1 - d) * 12 + 0.5);
      let col = lerp([0.2, 0.15, 0.18], [0.62, 0.56, 0.5], clamp01(0.5 - ny * 0.6 - nx * 0.2));
      col = lerp(col, orbLight, clamp01(-ny) * 0.35 * glow);
      p.over(x, y, col, cover);
    }
  }
  const lift = OY + R * 0.78;
  talon(p, [[OX - R * 0.5, base - 4], [OX - R * 1.2, lift], [OX - R * 0.72, OY - R * 0.05]], 7.5, 0.9, orbLight, glow);
  talon(p, [[OX + R * 0.5, base - 4], [OX + R * 1.2, lift], [OX + R * 0.72, OY - R * 0.05]], 7.5, 0.9, orbLight, glow);
}

/**
 * Paints 'portrait-orb': a sheet of 2 × FRAMES frames, the calm loop first (frames 0..FRAMES-1)
 * then the stirred one. Smooth-filtered, since it is painted smooth.
 */
export function generateOrbPortrait(scene: Phaser.Scene): void {
  const total = FRAMES * 2;
  const rows = Math.ceil(total / COLS);
  const key = 'portrait-orb';
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, N * COLS, N * rows)!;
  const G = geometry();
  const calm = new Paint();
  talons(calm, wheel(0.15), 0.75);
  const stirred = new Paint();
  talons(stirred, wheel(0.15), 1.1);
  for (let i = 0; i < total; i++) {
    const p = new Paint();
    paintFrame(p, G, (i % FRAMES) / FRAMES, i < FRAMES ? 0 : 1, i < FRAMES ? calm : stirred);
    const img = tex.context.createImageData(N, N);
    for (let k = 0; k < N * N; k++) {
      for (let c = 0; c < 3; c++) img.data[k * 4 + c] = Math.round(p.px[k * 4 + c] * 255);
      img.data[k * 4 + 3] = Math.round(p.px[k * 4 + 3] * 255);
    }
    const fx = (i % COLS) * N;
    const fy = Math.floor(i / COLS) * N;
    tex.context.putImageData(img, fx, fy);
  }
  tex.refresh();
  for (let i = 0; i < total; i++) tex.add(i, 0, (i % COLS) * N, Math.floor(i / COLS) * N, N, N);
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}
