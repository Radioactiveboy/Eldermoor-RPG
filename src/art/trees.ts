import { PixelCanvas, seededRandom } from './PixelCanvas';

/**
 * The broadleaf and pine trees that stand all over the outdoor maps.
 *
 * Each tree is painted as light on a form, not as flat shapes: every pixel
 * gets a brightness from the way its surface faces the sun (upper left, as
 * the rest of the art is lit), and only at the end is that brightness
 * stepped onto a short colour ramp. So a crown reads as one round mass made
 * of many leafy clumps, each clump lit on its own and casting a little shade
 * on the clumps behind it; a pine reads as tiers of drooping boughs, each
 * one shading the tier beneath.
 */

type Ramp = readonly number[];

/** Six steps of leaf, from the shade deep inside the crown to sunlit tips. */
const OAK_RAMPS: Ramp[] = [
  [0x142a1e, 0x1f4128, 0x2f6034, 0x447f3c, 0x62a046, 0x93c45a],
  // A warmer, yellower crown, for a little variety along the woods.
  [0x182b1c, 0x284625, 0x3e6631, 0x578439, 0x7aa245, 0xa6c25c],
  // A darker, cooler one, like an old elm.
  [0x112420, 0x1b3a2c, 0x2a5638, 0x3d7240, 0x59904a, 0x84b260],
];
const PINE_RAMPS: Ramp[] = [
  [0x0b1c16, 0x132f24, 0x1d4630, 0x295f3a, 0x3c7a45, 0x5c9a58],
  // Blue-green spruce.
  [0x0c1b1c, 0x14302d, 0x1f473d, 0x2c614b, 0x417c5c, 0x67a07a],
];
const BARK: Ramp = [0x22150f, 0x352217, 0x4f3321, 0x6c4a2f, 0x8c6640, 0xa8835a];
const MOSS = 0x56703a;

/** Smooth value noise in 0..1, stable for a seed. */
function noise2(seed: number): (x: number, y: number) => number {
  const hash = (ix: number, iy: number) => {
    let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy) + (hash(ix + 1, iy) - hash(ix, iy)) * sx;
    const b = hash(ix, iy + 1) + (hash(ix + 1, iy + 1) - hash(ix, iy + 1)) * sx;
    return a + (b - a) * sy;
  };
}

/**
 * A brightness buffer the size of the picture. `owner` says which part
 * (clump, tier, trunk) covers each pixel; parts drawn later stand in front.
 */
class LightBuffer {
  readonly owner: Int16Array;
  readonly value: Float32Array;
  constructor(readonly w: number, readonly h: number) {
    this.owner = new Int16Array(w * h).fill(-1);
    this.value = new Float32Array(w * h);
  }
  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  put(x: number, y: number, owner: number, v: number): void {
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    this.owner[i] = owner;
    this.value[i] = v;
  }
  ownerAt(x: number, y: number): number {
    return this.inside(x, y) ? this.owner[y * this.w + x] : -1;
  }

  /**
   * Shade where a part tucks in behind one standing in front of it: a soft
   * rim of shadow all round the nearer part, deeper on the side the sun
   * casts it (down and to the right).
   */
  occlude(from: number, to: number, rim: number, cast: number): void {
    const src = this.owner.slice();
    const at = (x: number, y: number) => (this.inside(x, y) ? src[y * this.w + x] : -1);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const o = at(x, y);
        if (o < from || o > to) continue;
        const front = (q: number) => q > o && q >= from && q <= to;
        let d = 0;
        if (front(at(x - 1, y)) || front(at(x + 1, y)) || front(at(x, y - 1)) || front(at(x, y + 1))) d += rim;
        else if (front(at(x - 2, y)) || front(at(x, y - 2)) || front(at(x + 2, y)) || front(at(x, y + 2))) d += rim * 0.5;
        if (front(at(x - 1, y - 2)) || front(at(x - 2, y - 3)) || front(at(x - 3, y - 4))) d += cast;
        this.value[y * this.w + x] -= d;
      }
    }
  }

  /** Step each part's brightness onto its ramp, with a touch of ordered dither at the seams. */
  paint(c: PixelCanvas, rampOf: (owner: number) => Ramp | null, dither = 0.05): void {
    const bayer = [0, 0.5, 0.75, 0.25];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const o = this.owner[i];
        if (o < 0) continue;
        const ramp = rampOf(o);
        if (!ramp) continue;
        const v = this.value[i] + (bayer[(y & 1) * 2 + (x & 1)] - 0.375) * dither * 2;
        const step = Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length)));
        c.set(x, y, ramp[step]);
      }
    }
  }
}

/** One step brighter or darker on the ramp a pixel's colour came from. */
function nudge(c: PixelCanvas, x: number, y: number, ramp: Ramp, by: number): void {
  const col = c.get(x, y);
  if (col === null) return;
  const i = ramp.indexOf(col);
  if (i < 0) return;
  c.set(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, i + by))]);
}

/** A tapering trunk, round in section, with its bark furrowed and its roots splayed. */
function trunk(
  buf: LightBuffer,
  owner: number,
  cx: number,
  base: number,
  top: number,
  halfBase: number,
  halfTop: number,
  bend: number,
  rnd: () => number,
): void {
  const furrows = [-0.55, -0.1, 0.35, 0.75].map((f) => f + (rnd() - 0.5) * 0.12);
  for (let y = top; y <= base; y++) {
    const t = (y - top) / (base - top);
    // Roots flare out over the last few rows.
    const flare = Math.max(0, (t - 0.82) / 0.18);
    const half = halfTop + (halfBase - halfTop) * t + flare * flare * 4.5;
    const mid = cx + Math.sin(t * Math.PI) * bend;
    for (let x = Math.floor(mid - half); x <= Math.ceil(mid + half); x++) {
      const n = (x + 0.5 - mid) / half;
      if (Math.abs(n) > 1) continue;
      // Lit as a cylinder: bright on the left, falling to deep shade on the right.
      let v = 0.58 - n * 0.48 - Math.abs(n) ** 3 * 0.14 + (rnd() - 0.5) * 0.08;
      for (const f of furrows) {
        const wiggle = Math.sin(y * 0.7 + f * 9) * 0.06;
        const dist = Math.abs(n - f - wiggle);
        if (dist < 0.11) v -= 0.3;
        else if (dist < 0.22 && n < f) v += 0.06;
      }
      // Darker where the trunk meets the ground.
      if (t > 0.9) v -= (t - 0.9) * 1.4;
      buf.put(x, y, owner, v);
    }
  }
}

/** A limb from (x0, y0) to (x1, y1), as a run of small lit discs. */
function limb(buf: LightBuffer, owner: number, x0: number, y0: number, x1: number, y1: number, r0: number, r1: number): void {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    const r = r0 + (r1 - r0) * t;
    for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
      for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
        const nx = (x + 0.5 - px) / r;
        const ny = (y + 0.5 - py) / r;
        if (nx * nx + ny * ny > 1) continue;
        buf.put(x, y, owner, 0.55 - nx * 0.35 - ny * 0.1);
      }
    }
  }
}

interface Clump {
  x: number;
  y: number;
  r: number;
}

/**
 * A broadleaf tree, oak-like: a stout, slightly bent trunk forking into
 * limbs, under a round crown built up of leafy clumps. `shape` picks the
 * crown: 0 round, 1 tall, 2 broad and spreading.
 */
export function oakTree(seed: number, shape: 0 | 1 | 2, rampIndex: number): PixelCanvas {
  const W = 64;
  const H = 90;
  const BASE = 86;
  const CX = 32;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  const leafNoise = noise2(seed);
  const leaf = OAK_RAMPS[rampIndex % OAK_RAMPS.length];
  const buf = new LightBuffer(W, H);
  const TRUNK = 0;
  const LIMB = 1;
  const FIRST_CLUMP = 10;

  // The crown's overall mass: centre and radii.
  const crown = [
    { cx: CX, cy: 36, rx: 25, ry: 25 },
    { cx: CX, cy: 34, rx: 21, ry: 29 },
    { cx: CX, cy: 39, rx: 28, ry: 22 },
  ][shape];
  const crownBottom = crown.cy + crown.ry;

  // Trunk and limbs, drawn first so the leaves cover most of them.
  const bend = rnd() < 0.5 ? -2.5 : 2.5;
  trunk(buf, TRUNK, CX + 1, BASE, crownBottom - 14, 5.2, 2.8, bend, rnd);
  const forkY = crownBottom - 8;
  // A low bough reaching out from the trunk below the leaves.
  const side = bend > 0 ? -1 : 1;
  limb(buf, LIMB, CX + 1, crownBottom + 7, CX + 1 + side * 11, crownBottom - 3, 2, 1.1);
  limb(buf, LIMB, CX + 1, forkY, CX - crown.rx * 0.55, crown.cy + 2, 2.6, 1.2);
  limb(buf, LIMB, CX + 1, forkY, CX + crown.rx * 0.5, crown.cy - 2, 2.4, 1.1);
  limb(buf, LIMB, CX + 1, forkY - 2, CX - 2, crown.cy - crown.ry * 0.5, 2.2, 1);

  // Clumps: a ring round the back of the crown, a ring in the middle, and a row along the front and bottom.
  const clumps: Clump[] = [];
  const ring = (count: number, fx: number, fy: number, dy: number, r: number) => {
    for (let i = 0; i < count; i++) {
      const a = Math.PI * 2 * (i / count) + rnd() * 0.5;
      clumps.push({
        x: crown.cx + Math.cos(a) * crown.rx * fx + (rnd() - 0.5) * 3,
        y: crown.cy + dy + Math.sin(a) * crown.ry * fy + (rnd() - 0.5) * 3,
        r: r * (0.85 + rnd() * 0.3),
      });
    }
  };
  ring(6, 0.6, 0.6, -3, crown.rx * 0.4);
  ring(4, 0.3, 0.28, 0, crown.rx * 0.42);
  // Front clumps hang lowest and are drawn last.
  const front = shape === 2 ? 4 : 3;
  for (let i = 0; i < front; i++) {
    const f = i / (front - 1);
    clumps.push({
      x: crown.cx - crown.rx * 0.55 + f * crown.rx * 1.1 + (rnd() - 0.5) * 3,
      y: crown.cy + crown.ry * 0.5 + (rnd() - 0.5) * 3 - Math.sin(f * Math.PI) * 2,
      r: crown.rx * (0.3 + rnd() * 0.06),
    });
  }
  clumps.push({ x: crown.cx - crown.rx * 0.18, y: crown.cy - crown.ry * 0.68, r: crown.rx * 0.36 });
  // Back first: the higher a clump sits, the further back it is.
  clumps.sort((a, b) => a.y - b.y);

  clumps.forEach((k, idx) => {
    const owner = FIRST_CLUMP + idx;
    const p1 = rnd() * Math.PI * 2;
    const p2 = rnd() * Math.PI * 2;
    const reach = Math.ceil(k.r * 1.25);
    for (let y = Math.floor(k.y - reach); y <= Math.ceil(k.y + reach); y++) {
      for (let x = Math.floor(k.x - reach); x <= Math.ceil(k.x + reach); x++) {
        const dx = x + 0.5 - k.x;
        const dy = (y + 0.5 - k.y) * 1.08;
        const a = Math.atan2(dy, dx);
        // A scalloped rim of leaf tufts, not a smooth disc.
        const rim = k.r * (1 + 0.12 * Math.sin(a * 5 + p1) + 0.07 * Math.sin(a * 11 + p2) + (leafNoise(x * 0.6, y * 0.6) - 0.5) * 0.26);
        const d = Math.hypot(dx, dy) / rim;
        if (d > 1) continue;
        // Normal: mostly the clump's own roundness, partly the whole crown's.
        const lx = dx / rim;
        const ly = dy / rim;
        const gx = (x + 0.5 - crown.cx) / crown.rx;
        const gy = (y + 0.5 - crown.cy) / crown.ry;
        const nx = lx * 0.72 + gx * 0.28;
        const ny = ly * 0.72 + gy * 0.28;
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, nx * nx + ny * ny)));
        let v = 0.4 - nx * 0.34 - ny * 0.42 + nz * 0.2;
        // The underside of the whole crown is in its own shade.
        v -= Math.max(0, gy) * 0.16;
        // Leaf-sized mottling.
        v += (leafNoise(x / 2.2 + 40, y / 2.2) - 0.5) * 0.22;
        buf.put(x, y, owner, v);
      }
    }
  });
  buf.occlude(FIRST_CLUMP, FIRST_CLUMP + clumps.length, 0.16, 0.22);

  // Shade cast by the crown onto the top of the trunk.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = buf.ownerAt(x, y);
      if (o !== TRUNK && o !== LIMB) continue;
      let above = 0;
      for (let k = 1; k <= 5; k++) if (buf.ownerAt(x - Math.floor(k / 2), y - k) >= FIRST_CLUMP) above++;
      if (above) buf.value[y * W + x] -= 0.1 + above * 0.05;
    }
  }

  buf.paint(c, (o) => (o >= FIRST_CLUMP ? leaf : BARK), 0.06);

  // Sunlit leaf sprigs on the lit faces and a few dark ones in the shade, two pixels each.
  for (let y = 1; y < H; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (buf.ownerAt(x, y) < FIRST_CLUMP) continue;
      const v = buf.value[y * W + x];
      const r = rnd();
      if (v > 0.55 && r < 0.07) {
        nudge(c, x, y, leaf, 1);
        nudge(c, x + 1, y - 1, leaf, 1);
      } else if (v < 0.4 && v > 0.12 && r < 0.06) {
        nudge(c, x, y, leaf, -1);
        nudge(c, x - 1, y + 1, leaf, -1);
      }
    }
  }
  // Light catches the leafy rim on the sunny side.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (buf.ownerAt(x, y) < FIRST_CLUMP) continue;
      const open = buf.ownerAt(x - 1, y) < FIRST_CLUMP || buf.ownerAt(x, y - 1) < FIRST_CLUMP;
      if (open && buf.value[y * W + x] > 0.42) nudge(c, x, y, leaf, 1);
    }
  }
  // A little moss on the shady side of the roots.
  for (let y = BASE - 7; y <= BASE; y++) {
    for (let x = CX; x < W; x++) {
      if (buf.ownerAt(x, y) === TRUNK && buf.ownerAt(x + 1, y) !== TRUNK && rnd() < 0.6) c.set(x, y, MOSS);
    }
  }

  c.outline();
  return c;
}

/**
 * A pine: a straight trunk under five tiers of boughs, each tier wider than
 * the one above, with needled boughs drooping to ragged tips. Higher tiers
 * hang over lower ones and shade them.
 */
export function pineTree(seed: number, rampIndex: number): PixelCanvas {
  const W = 52;
  const H = 96;
  const BASE = 91;
  const CX = 26;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  const needleNoise = noise2(seed + 7);
  const needles = PINE_RAMPS[rampIndex % PINE_RAMPS.length];
  const buf = new LightBuffer(W, H);
  const TRUNK = 0;
  const FIRST_TIER = 10;

  trunk(buf, TRUNK, CX, BASE, 66, 3.6, 2.4, 0, rnd);

  // [top, bottom, half-width at the bottom], top tier last.
  const tiers: Array<[number, number, number]> = [
    [50, 80, 23],
    [37, 66, 19.5],
    [24, 52, 15.5],
    [12, 38, 11.5],
    [2, 24, 7],
  ].map(([t, b, h]) => [t, b + Math.round((rnd() - 0.5) * 2), h + (rnd() - 0.5) * 1.5] as [number, number, number]);

  tiers.forEach(([top, bottom, half], idx) => {
    const owner = FIRST_TIER + idx;
    const lobes = Math.max(3, Math.round(half / 3.2));
    const phase = rnd() * Math.PI * 2;
    for (let y = top; y <= bottom + 5; y++) {
      const t = (y - top) / (bottom - top);
      const w = half * Math.min(1, t) ** 0.85 + 0.6;
      for (let x = Math.floor(CX - w - 2); x <= Math.ceil(CX + w + 2); x++) {
        const rel = (x + 0.5 - CX) / w;
        if (Math.abs(rel) > 1) continue;
        // The lower edge droops into bough tips: lower towards the outside, notched between boughs.
        const lobe = Math.abs(Math.sin((rel * lobes * Math.PI) / 2 + phase));
        const edge = bottom - 2 + Math.abs(rel) * 3 + lobe * 3 - (1 - lobe) * 1.5;
        if (y > edge) continue;
        // Boughs on the left catch the sun, the right falls into shade; the top of a tier faces the sky.
        const nz = Math.sqrt(Math.max(0, 1 - rel * rel));
        let v = 0.46 - rel * 0.42 + nz * 0.08 + (0.5 - t) * 0.24;
        // The drooping tips are a little darker underneath.
        if (y > edge - 2) v -= 0.08;
        // Needle texture: short strokes slanting down and out.
        const slant = rel < 0 ? 1 : -1;
        v += (needleNoise((x + y * slant * 0.9) / 1.4, y / 3.5) - 0.5) * 0.3;
        buf.put(x, y, owner, v);
      }
    }
  });
  buf.occlude(FIRST_TIER, FIRST_TIER + tiers.length, 0.1, 0.2);

  // The upper tiers cast a band of shade over the one below.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = buf.ownerAt(x, y);
      if (o < FIRST_TIER) continue;
      for (let k = 1; k <= 4; k++) {
        if (buf.ownerAt(x, y - k) > o) {
          buf.value[y * W + x] -= 0.2 - k * 0.03;
          break;
        }
      }
    }
  }
  // Shade on the trunk under the lowest boughs.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (buf.ownerAt(x, y) !== TRUNK) continue;
      for (let k = 1; k <= 5; k++) {
        if (buf.ownerAt(x, y - k) >= FIRST_TIER) {
          buf.value[y * W + x] -= 0.3 - k * 0.04;
          break;
        }
      }
    }
  }

  buf.paint(c, (o) => (o >= FIRST_TIER ? needles : BARK), 0.05);

  // Bright needle tips along the sunny boughs, and the rim of light on the sunny edge.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = buf.ownerAt(x, y);
      if (o < FIRST_TIER) continue;
      const v = buf.value[y * W + x];
      if (v > 0.5 && rnd() < 0.08) {
        nudge(c, x, y, needles, 1);
        nudge(c, x - (x < CX ? 1 : -1), y + 1, needles, 1);
      }
      if (x < CX && buf.ownerAt(x - 1, y) < FIRST_TIER && v > 0.35) nudge(c, x, y, needles, 1);
      if (buf.ownerAt(x, y - 1) < FIRST_TIER && x <= CX + 2 && v > 0.3) nudge(c, x, y, needles, 1);
    }
  }
  // The leading shoot at the very top.
  c.set(CX, 1, needles[4]);
  c.set(CX, 0, needles[5]);

  c.outline();
  return c;
}
