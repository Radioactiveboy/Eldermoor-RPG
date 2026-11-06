import { PixelCanvas, seededRandom } from './PixelCanvas';
import { LightBuffer, noise2, nudge, type Ramp } from './trees';

/**
 * Rocks and the small things on the ground (grass tufts, flowers, mushrooms,
 * pebbles), lit the same way as the trees: from the upper left, with form
 * shading stepped onto short colour ramps.
 */

const STONE: Ramp = [0x2c2a34, 0x43414d, 0x5b5966, 0x777583, 0x9694a1, 0xb9b7c2];
const MOSS: Ramp = [0x2c3d22, 0x3f5a2c, 0x587a36, 0x76984a, 0x9ab85e];
const GRASS: Ramp = [0x2a4a26, 0x3b632e, 0x4f7d36, 0x679840, 0x86b452, 0xa9cc6a];

/**
 * A boulder: a couple of rounded lumps of stone broken into flat facets,
 * each facet lit as one plane, with cracks along some of the seams and moss
 * on the tops where the rain sits.
 */
export function boulder(seed: number): PixelCanvas {
  const W = 44;
  const H = 34;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  const n = noise2(seed);
  const big = seed % 2 === 0;
  const buf = new LightBuffer(W, H);

  // [cx, cy, rx, ry]: the main stone, and a smaller one beside it, in front.
  const lumps: Array<[number, number, number, number]> = [
    [22, 19, big ? 17 : 14, big ? 12.5 : 10.5],
    [big ? 33 : 10, 25, 7.5, 5.5],
  ];
  // Facet seeds: each pixel takes the light of the nearest one, so the stone breaks into planes.
  const facets: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 14; i++) facets.push({ x: 4 + rnd() * (W - 8), y: 6 + rnd() * (H - 10) });
  const facetOf = (x: number, y: number) => {
    let best = 0;
    let bd = Infinity;
    facets.forEach((f, i) => {
      const d = (f.x - x) ** 2 + ((f.y - y) * 1.4) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };
  const facetIds = new Int16Array(W * H).fill(-1);

  lumps.forEach(([cx, cy, rx, ry], li) => {
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
        const dx = (x + 0.5 - cx) / rx;
        // Flatter underneath, where it sits in the earth.
        const dy = (y + 0.5 - cy) / (y > cy ? ry * 0.85 : ry);
        const rim = 1 + (n(x * 0.35, y * 0.35) - 0.5) * 0.3;
        if (dx * dx + dy * dy > rim * rim) continue;
        // Light from the facet's own seed point, mixed with the pixel's, so planes stay a little soft.
        const f = facets[facetOf(x, y)];
        const fx = Math.max(-1, Math.min(1, (f.x - cx) / rx));
        const fy = Math.max(-1, Math.min(1, (f.y - cy) / ry));
        const nx = fx * 0.7 + dx * 0.3;
        const ny = fy * 0.7 + dy * 0.3;
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, nx * nx + ny * ny)));
        let v = 0.38 - nx * 0.36 - ny * 0.4 + nz * 0.24;
        v += (n(x / 1.6 + 30, y / 1.6) - 0.5) * 0.12;
        // Ground contact: dark along the base.
        if (dy > 0.6) v -= (dy - 0.6) * 0.5;
        buf.put(x, y, li, v);
        facetIds[y * W + x] = facetOf(x, y);
      }
    }
  });
  buf.occlude(0, 1, 0.12, 0.2);
  buf.paint(c, () => STONE, 0.05);

  // Seams between facets: a dark crack on some, a bright edge where a plane turns to the light on others.
  for (let y = 1; y < H; y++) {
    for (let x = 1; x < W; x++) {
      const id = facetIds[y * W + x];
      if (id < 0) continue;
      const left = facetIds[y * W + x - 1];
      const up = facetIds[(y - 1) * W + x];
      if ((left >= 0 && left !== id) || (up >= 0 && up !== id)) {
        const seam = (id * 7 + Math.max(left, up) * 3) % 5;
        if (seam < 2) nudge(c, x, y, STONE, -2);
        else if (seam < 4 && buf.value[y * W + x] > 0.4) nudge(c, x, y, STONE, 1);
      }
    }
  }
  // Moss on the tops, thickest where the light is flattest.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (buf.ownerAt(x, y) < 0) continue;
      const top = buf.ownerAt(x, y - 3) < 0 || buf.ownerAt(x, y - 2) < 0;
      const m = n(x / 2.5 + 90, y / 2.5);
      if (top && m > 0.5) {
        const v = buf.value[y * W + x];
        c.set(x, y, MOSS[Math.max(0, Math.min(MOSS.length - 1, Math.floor(v * MOSS.length + (m - 0.5) * 2)))]);
      }
    }
  }
  c.outline();
  return c;
}

/** A tuft of grass: tapering blades that bend away from the centre, dark at the root, sunlit at the tips. */
export function grassTuft(seed: number): PixelCanvas {
  const W = 14;
  const H = 12;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  const blades = 7;
  for (let i = 0; i < blades; i++) {
    const f = i / (blades - 1);
    const x0 = 3 + f * 8 + (rnd() - 0.5);
    const h = 5 + rnd() * 5 + Math.sin(f * Math.PI) * 2;
    const lean = (f - 0.5) * 5 + (rnd() - 0.5) * 2;
    for (let s = 0; s <= h; s++) {
      const t = s / h;
      const x = x0 + lean * t * t;
      const y = H - 1 - s;
      // Lit blades on the left of the tuft, shaded on the right; brighter up the blade.
      const v = 0.2 + t * 0.6 - f * 0.18 + (rnd() - 0.5) * 0.08;
      const col = GRASS[Math.max(0, Math.min(GRASS.length - 1, Math.floor(v * GRASS.length)))];
      c.set(x, y, col);
      // Blades are two pixels wide at the root.
      if (t < 0.35) c.set(x + 1, y, GRASS[Math.max(0, GRASS.indexOf(col) - 1)]);
    }
  }
  return c;
}

/** A clump of wild flowers: stems and leaves, with five-petal heads, the shaded petals a step darker. */
export function wildFlowers(seed: number, petal: number, petalShade: number, eye: number): PixelCanvas {
  const W = 16;
  const H = 12;
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(seed);
  for (let i = 0; i < 4; i++) {
    const x = 2 + Math.floor(rnd() * 12);
    const y = 2 + Math.floor(rnd() * 5);
    // Stem down to the ground, with a leaf off one side.
    for (let yy = y + 1; yy < H; yy++) c.set(x, yy, yy > H - 3 ? GRASS[1] : GRASS[2]);
    const side = rnd() < 0.5 ? -1 : 1;
    c.set(x + side, y + 4, GRASS[3]);
    c.set(x + side * 2, y + 3, GRASS[4]);
    // Petals: lit up and left, shaded down and right.
    c.set(x, y - 1, petal);
    c.set(x - 1, y, petal);
    c.set(x + 1, y, petalShade);
    c.set(x, y + 1, petalShade);
    c.set(x, y, eye);
  }
  return c;
}

/** Two toadstools: a domed red cap with white flecks and a lit rim, a shadow of gills under it, on a pale stalk. */
export function toadstools(): PixelCanvas {
  const c = new PixelCanvas(16, 14);
  const CAP: Ramp = [0x5a1a1c, 0x8a2a28, 0xb83a32, 0xd85a44, 0xf08a64];
  const STALK: Ramp = [0x8a7c64, 0xb8a888, 0xd8c8a4, 0xeee2c4];
  const one = (x: number, y: number, r: number) => {
    // Stalk, round: lit left, shaded right, darker under the cap.
    for (let yy = y; yy < y + r + 1; yy++) {
      for (let xx = -1; xx <= 1; xx++) c.set(x + xx, yy, STALK[yy === y ? 0 : xx < 0 ? 3 : xx === 0 ? 2 : 1]);
    }
    // The gills, a dark band under the cap.
    for (let xx = -Math.round(r) + 1; xx < Math.round(r); xx++) c.set(x + xx, y, xx < 0 ? STALK[1] : STALK[0]);
    // The cap, a half dome.
    for (let yy = Math.floor(y - r * 0.8); yy < y; yy++) {
      for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
        const nx = (xx + 0.5 - x) / r;
        const ny = (yy + 0.5 - y) / (r * 0.8);
        if (nx * nx + ny * ny > 1 || ny > 0) continue;
        const v = 0.55 - nx * 0.35 + ny * -0.1 + (ny > -0.3 ? -0.15 : 0);
        c.set(xx, yy, CAP[Math.max(0, Math.min(CAP.length - 1, Math.floor(v * CAP.length)))]);
      }
    }
    c.set(x - 1, y - Math.round(r * 0.5), 0xf4eee0);
    c.set(x + 1, y - Math.round(r * 0.3) - 1, 0xe0d8c8);
    if (r > 3) c.set(x - 2, y - 1, 0xf4eee0);
  };
  one(6, 8, 4);
  one(11, 10, 2.6);
  c.outline();
  return c;
}

/** A few small pebbles, each lit as a little dome. */
export function pebbleScatter(seed: number): PixelCanvas {
  const c = new PixelCanvas(14, 8);
  const rnd = seededRandom(seed);
  const stones: Array<[number, number, number, number]> = [
    [4, 4, 2.6, 1.8],
    [9, 3, 2, 1.4],
    [10.5, 6, 1.3, 1],
  ];
  for (const [cx, cy, rx, ry] of stones) {
    const tint = rnd() < 0.5 ? 0 : 1;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const v = 0.68 - nx * 0.3 - ny * 0.35 + tint * 0.08;
        c.set(x, y, STONE[Math.max(0, Math.min(STONE.length - 1, Math.floor(v * STONE.length)))]);
      }
    }
  }
  c.outline(STONE[0]);
  return c;
}

/**
 * The shade a tree throws on the ground: a dark pool under the trunk that
 * spreads out to the lower right (away from the sun) with a ragged, leafy
 * edge and flecks of light coming through the leaves.
 */
export function treeShade(w: number, h: number, seed: number): PixelCanvas {
  const c = new PixelCanvas(w, h);
  const n = noise2(seed);
  // The trunk stands at the texture's centre; the pool's centre is pushed away from the sun.
  const cx = w / 2 + w * 0.08;
  const cy = h / 2 + h * 0.06;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - cx) / (w * 0.5);
      const ny = (y + 0.5 - cy) / (h * 0.5);
      const d = Math.sqrt(nx * nx + ny * ny);
      const edge = 0.82 + (n(x / 3, y / 1.8) - 0.5) * 0.36;
      if (d > edge) continue;
      // Darkest right at the foot of the trunk.
      const fx = (x + 0.5 - w / 2) / (w * 0.16);
      const fy = (y + 0.5 - h / 2) / (h * 0.3);
      const foot = fx * fx + fy * fy < 1;
      let a = foot ? 130 : d < edge * 0.55 ? 92 : 64;
      // Dapples: little gaps where the sun gets through the crown.
      if (!foot && d > edge * 0.35 && n(x / 2.6 + 50, y / 1.6) > 0.68) a = 40;
      c.set(x, y, 0x0b0812, a);
    }
  }
  return c;
}
