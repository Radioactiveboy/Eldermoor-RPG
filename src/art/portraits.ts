import Phaser from 'phaser';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Talking portraits for conversations: head and shoulders, lit from the
 * upper left. Every surface is painted from a five-tone ramp (see
 * {@link ramp}) with a little ordered dithering where tones meet, so faces,
 * hair and cloth read as rounded rather than flat. Each speaker is built from
 * shared pieces (face, eyes, brows, nose, mouth, hair, clothes) plus their own
 * touches: Bram's feather, the smith's soot, the baker's flour.
 *
 * Each portrait has three frames: 0 mouth closed, 1 mouth open, 2 blinking.
 */

export const PORTRAIT_SIZE = 96;
const S = PORTRAIT_SIZE;
/** The middle of the face. */
const CX = 48;
/** Where the eyes sit (their middle row), and how far either side of the middle. */
const EYE_Y = 47;
const EYE_DX = 8;

/** Five tones of one colour, dark to light: deep shadow, shade, base, light, highlight. */
type Ramp = [number, number, number, number, number];

function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 0xff) * (1 - t) + ((b >> s) & 0xff) * t) << s;
  return ch(16) | ch(8) | ch(0);
}

/** A ramp around a base colour. Shadows lean cool and purple, lights lean warm, as in the rest of the art. */
function ramp(base: number): Ramp {
  return [mix(mix(base, 0x000000, 0.5), 0x2a1838, 0.3), mix(mix(base, 0x000000, 0.24), 0x3a2a5a, 0.14), base, mix(base, 0xfff0cc, 0.2), mix(base, 0xfffbea, 0.45)];
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** A tone from a ramp for a lightness 0..1, dithering only in a narrow band where two tones meet. */
function tone(r: Ramp, v: number, x: number, y: number): number {
  const l = Math.max(0, Math.min(3.999, v * 4));
  const i = Math.floor(l);
  const f = Math.max(0, Math.min(1, (l - i - 0.5) * 2.6 + 0.5));
  return r[i + (f > BAYER[(y & 3) * 4 + (x & 3)] ? 1 : 0)];
}

/** Light comes from the upper left and a little in front. */
const LIGHT = (() => {
  const v = [-0.5, -0.6, 0.62];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((k) => k / n);
})();

/** Lightness 0..1 of a surface facing (nx, ny), bulging towards the viewer. */
function lightness(nx: number, ny: number, bias = 0): number {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  return Math.max(0, Math.min(1, 0.2 + d * 0.62 + bias));
}

/** Small deterministic hash of a pair of ints, 0..1, for hair strands and cloth weave. */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A filled ellipse lit as a rounded lump. `shape` can bend the lightness per pixel (strands, folds). */
function blob(
  c: PixelCanvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  r: Ramp,
  bias = 0,
  shape?: (x: number, y: number, nx: number, ny: number) => number,
  clip?: (x: number, y: number) => boolean,
): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1 || (clip && !clip(x, y))) continue;
      const v = lightness(nx * 0.9, ny * 0.9, bias) + (shape ? shape(x, y, nx, ny) : 0);
      c.set(x, y, tone(r, v, x, y));
    }
  }
}

/** Hair texture: strands that follow the way it falls, and a band of sheen. */
function strands(dir: (x: number, y: number) => number, sheenY?: number, seed = 1) {
  return (x: number, y: number) => {
    const s = Math.floor(dir(x, y));
    const n = (hash(s, seed) - 0.5) * 0.34 + (hash(s, Math.floor(y / 3) + seed * 7) - 0.5) * 0.12;
    const sheen = sheenY !== undefined ? Math.max(0, 1 - Math.abs(y - sheenY - Math.abs(x - CX) * 0.12) / 3) * 0.28 : 0;
    return n + sheen;
  };
}

interface FaceOpts {
  skin: Ramp;
  /** Half the face's width at the cheekbones. */
  width: number;
  /** Half the chin's width. */
  jaw: number;
  /** Top of the forehead and bottom of the chin. */
  top: number;
  chin: number;
  /** Rows above this are in a hat brim's shadow. */
  shadowAbove?: number;
}

/** Half the face's width on row y, or null above or below it. */
function faceHalf(f: FaceOpts, y: number): number | null {
  const t = (y + 0.5 - f.top) / (f.chin - f.top);
  if (t < 0 || t > 1) return null;
  if (t < 0.45) return f.width * Math.sqrt(1 - Math.pow((0.45 - t) / 0.5, 2));
  const u = (t - 0.45) / 0.55;
  let w = f.width - (f.width - f.jaw) * Math.pow(u, 1.7);
  if (u > 0.82) w *= Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.82) / 0.2, 2) * 0.75));
  return w;
}

function face(c: PixelCanvas, f: FaceOpts): void {
  const mid = (f.top + f.chin) / 2;
  for (let y = f.top; y <= f.chin; y++) {
    const w = faceHalf(f, y);
    if (w === null) continue;
    for (let x = Math.floor(CX - w); x <= Math.ceil(CX + w - 1); x++) {
      const dx = x + 0.5 - CX;
      if (Math.abs(dx) > w) continue;
      const nx = dx / (w + 1.5);
      const ny = ((y - mid) / (f.chin - mid)) * 0.5;
      let v = lightness(nx, ny, 0.08);
      // Cheekbones catch the light; the eye sockets and under the cheekbones don't.
      const cheek = Math.abs(Math.abs(dx) - 10) < 4 && Math.abs(y - (EYE_Y + 6)) < 2;
      if (cheek) v += 0.06;
      if (Math.abs(dx) > 3 && Math.abs(dx) < 13 && y >= EYE_Y - 3 && y <= EYE_Y - 2) v -= 0.12;
      if (f.shadowAbove !== undefined && y < f.shadowAbove) v -= 0.3;
      c.set(x, y, tone(f.skin, v, x, y));
    }
  }
}

/** Ears at the sides of the head, half hidden by the face's edge. */
function ears(c: PixelCanvas, skin: Ramp, half: number): void {
  for (const side of [-1, 1]) {
    const ex = CX + side * (half + 0.5);
    blob(c, ex, EYE_Y + 4, 3.2, 6, skin, side > 0 ? -0.15 : 0.05);
    c.set(Math.round(ex + side * 0.5), EYE_Y + 3, skin[1]);
    c.set(Math.round(ex + side * 0.5), EYE_Y + 4, skin[0]);
    c.set(Math.round(ex + side * 0.5), EYE_Y + 5, skin[1]);
  }
}

/** The neck, mostly in the chin's shadow. */
function neck(c: PixelCanvas, skin: Ramp, half: number, top: number, bottom = S - 10): void {
  for (let y = top; y < bottom; y++) {
    for (let x = CX - half; x < CX + half; x++) {
      const v = lightness((x + 0.5 - CX) / (half + 2), 0, -0.22) - (y < top + 5 ? 0.12 : 0);
      c.set(x, y, tone(skin, v, x, y));
    }
  }
}

interface EyeOpts {
  iris: number;
  blink: boolean;
  skin: Ramp;
  /** Lashes flick out at the outer corners. */
  lashes?: boolean;
  /** Heavy lids or shadows underneath. */
  tired?: boolean;
  /** Pixels the gaze is turned (negative looks screen-left). */
  look?: number;
}

function eyes(c: PixelCanvas, o: EyeOpts): void {
  const lid = P.outline;
  const iris = ramp(o.iris);
  for (const side of [-1, 1]) {
    const ex = CX + side * EYE_DX;
    const y = EYE_Y;
    const outer = ex + side * 3;
    // Lid crease above, lower lid below.
    for (let x = ex - 2; x <= ex + 2; x++) c.set(x, y - 2, o.skin[1]);
    for (let x = ex - 2; x <= ex + 2; x++) c.set(x, y + 2, o.tired ? o.skin[0] : o.skin[1]);
    if (o.tired) for (let x = ex - 1; x <= ex + 2; x++) c.set(x + (side > 0 ? 0 : -1), y + 3, o.skin[1]);
    if (o.blink) {
      for (let x = ex - 3; x <= ex + 3; x++) c.set(x, y + 1, lid);
      c.set(ex - 3, y, o.skin[1]);
      c.set(ex + 3, y, o.skin[1]);
      if (o.lashes) c.set(outer + side, y + 1, lid);
      continue;
    }
    // Upper lid line, the whites, then the iris tucked under the lid.
    for (let x = ex - 3; x <= ex + 3; x++) c.set(x, y - 1, lid);
    for (let x = ex - 2; x <= ex + 2; x++) {
      c.set(x, y, x === ex + side * 2 ? 0xc8bcb8 : 0xe9e2da);
      c.set(x, y + 1, x === ex + side * 2 ? 0xc8bcb8 : 0xddd4cc);
    }
    c.set(outer, y, lid);
    if (o.lashes) c.set(outer + side, y - 2, lid);
    const ix = ex + (o.look ?? 0);
    c.set(ix - 1, y, iris[1]);
    c.set(ix, y, 0x140c16);
    c.set(ix + 1, y, iris[1]);
    c.set(ix - 1, y + 1, iris[2]);
    c.set(ix, y + 1, iris[3]);
    c.set(ix + 1, y + 1, iris[2]);
    c.set(ix - 1, y, 0xfffaf0); // catch-light
  }
}

type BrowShape = 'flat' | 'worried' | 'heavy' | 'arched' | 'stern';
const BROWS: Record<BrowShape, number[]> = {
  // Row offsets from the inner end outwards.
  flat: [0, -1, -1, -1, -1, -1, 0, 0],
  worried: [-2, -2, -1, -1, 0, 0, 0, 1],
  heavy: [1, 0, 0, -1, -1, -1, -1, 0],
  arched: [0, -1, -2, -2, -2, -2, -1, 0],
  stern: [1, 1, 0, 0, -1, -1, -1, -1],
};

function brows(c: PixelCanvas, color: number, shape: BrowShape, thick = 2): void {
  const r = ramp(color);
  const offs = BROWS[shape];
  for (const side of [-1, 1]) {
    const inner = CX + side * 3;
    offs.forEach((dy, i) => {
      const x = inner + side * i;
      const y = EYE_Y - 5 + dy;
      for (let t = 0; t < thick; t++) c.set(x, y + t, t === 0 && i > 1 && i < 6 ? r[2] : r[1]);
    });
  }
}

/** Nose: a lit bridge, a shadowed side, a rounded tip with nostrils. */
function nose(c: PixelCanvas, skin: Ramp, big = 0): void {
  const top = EYE_Y + 1;
  const tip = EYE_Y + 9 + big;
  for (let y = top; y < tip - 1; y++) {
    c.set(CX - 1, y, skin[3]);
    if (y > top + 1) c.set(CX + 2, y, skin[1]);
  }
  blob(c, CX + 0.5, tip - 0.5, 2.5 + big * 0.5, 2 + big * 0.3, skin, 0.08);
  c.set(CX - 1, tip - 1, skin[4]);
  c.set(CX - 2 - big, tip + 1, skin[0]);
  c.set(CX + 2 + big, tip + 1, skin[0]);
  for (let x = CX - 1; x <= CX + 2; x++) c.set(x, tip + 2, skin[1]);
  c.set(CX + 3 + big, tip, skin[1]);
}

interface MouthOpts {
  skin: Ramp;
  lip: number;
  open: boolean;
  /** 1 smiles, -1 frowns. */
  curve?: number;
  half?: number;
  y?: number;
}

function mouth(c: PixelCanvas, o: MouthOpts): void {
  const lip = ramp(o.lip);
  const y = o.y ?? EYE_Y + 15;
  const h = o.half ?? 4;
  const curve = o.curve ?? 0;
  if (o.open) {
    for (let x = CX - h + 1; x <= CX + h - 1; x++) {
      c.set(x, y - 1, lip[1]);
      c.set(x, y, 0x2a1418);
      c.set(x, y + 1, 0x3a1c22);
      c.set(x, y + 2, lip[2]);
    }
    for (let x = CX - h + 2; x <= CX + h - 2; x++) c.set(x, y, 0xe6dccc); // teeth
    c.set(CX - 1, y + 2, lip[3]);
    c.set(CX - h, y, lip[0]);
    c.set(CX + h, y, lip[0]);
    for (let x = CX - 2; x <= CX + 2; x++) c.set(x, y + 3, o.skin[1]);
    return;
  }
  // Upper lip line, curling at the corners; fuller lower lip with a highlight.
  for (let x = CX - h; x <= CX + h; x++) c.set(x, y, Math.abs(x - CX) === h ? o.skin[0] : lip[0]);
  c.set(CX - h - 1, y - curve, o.skin[1]);
  c.set(CX + h + 1, y - curve, o.skin[1]);
  for (let x = CX - h + 1; x <= CX + h - 1; x++) c.set(x, y + 1, Math.abs(x - CX) < 2 ? lip[3] : lip[2]);
  for (let x = CX - 2; x <= CX + 2; x++) c.set(x, y + 3, o.skin[1]);
}

/** Lines of age: crow's feet, smile lines, a furrowed brow. */
function wrinkles(c: PixelCanvas, skin: Ramp, deep = false): void {
  for (const side of [-1, 1]) {
    const ex = CX + side * (EYE_DX + 5);
    c.set(ex, EYE_Y - 1, skin[1]);
    c.set(ex, EYE_Y + 1, skin[1]);
    c.set(ex + side, EYE_Y + 2, skin[1]);
    // From the nose round the mouth.
    for (let i = 0; i < 6; i++) c.set(CX + side * (4 + Math.floor(i / 2)), EYE_Y + 10 + i, skin[1]);
  }
  for (let x = CX - 3; x <= CX + 3; x++) c.set(x, EYE_Y - 10, skin[1]);
  if (deep) for (let x = CX - 5; x <= CX + 4; x++) c.set(x, EYE_Y - 13, skin[1]);
}

/** A soft flush of colour across the cheeks, dithered. */
function blush(c: PixelCanvas, color: number, strength = 0.5): void {
  for (const side of [-1, 1]) {
    const bx = CX + side * 10;
    for (let y = EYE_Y + 4; y <= EYE_Y + 8; y++) {
      for (let x = bx - 3; x <= bx + 3; x++) {
        const d = ((x - bx) / 3.5) ** 2 + ((y - EYE_Y - 6) / 2.5) ** 2;
        if (d > 1 || BAYER[(y & 3) * 4 + (x & 3)] > strength * (1 - d)) continue;
        const here = c.get(x, y);
        if (here !== null) c.set(x, y, mix(here, color, 0.35));
      }
    }
  }
}

function freckles(c: PixelCanvas, skin: Ramp, seed: number): void {
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const x = CX + side * Math.round(4 + hash(i, seed) * 10);
    const y = EYE_Y + 4 + Math.round(hash(seed, i) * 4);
    c.set(x, y, skin[1]);
  }
}

/** Shoulders and chest: sloping from the neck to rounded shoulder caps, lit from the left, with a few folds. */
function shoulders(c: PixelCanvas, cloth: Ramp, top = 74, slope = 10, folds = true): void {
  for (let x = 0; x < S; x++) {
    const d = Math.abs(x + 0.5 - CX);
    const line = top + Math.max(0, d - 11) * 0.028 * slope + (d > 34 ? (d - 34) ** 2 * 0.1 : 0);
    for (let y = Math.ceil(line); y < S; y++) {
      const below = Math.min(1, (y - line) / 12);
      let v = lightness((x + 0.5 - CX) / 52, -0.75 + below * 0.75, 0.04);
      if (folds) v += Math.sin((x - CX) * 0.38 + (y - top) * 0.1) * below * 0.05;
      c.set(x, y, tone(cloth, v, x, y));
    }
  }
}

/** A V of shirt at the collar. */
function collar(c: PixelCanvas, cloth: Ramp, top: number, depth: number, width = 7): void {
  for (let y = top; y < top + depth; y++) {
    const half = Math.max(0, width - (y - top) * (width / depth));
    for (let x = Math.round(CX - half); x < Math.round(CX + half); x++) {
      c.set(x, y, tone(cloth, lightness((x - CX) / (width + 3), -0.2, -0.05), x, y));
    }
  }
}

/** A pixel-art outline round the figure, softened to a dark tone of what it borders. */
function finish(c: PixelCanvas): void {
  // Cool light from behind catches the right-hand edges.
  for (let y = 0; y < S; y++) {
    for (let x = S - 1; x > 0; x--) {
      const here = c.get(x, y);
      if (here !== null && c.get(x + 1, y) === null) {
        c.set(x, y, mix(here, 0xb4c4ec, 0.35));
        const in1 = c.get(x - 1, y);
        if (in1 !== null) c.set(x - 1, y, mix(in1, 0xb4c4ec, 0.15));
      }
    }
  }
  c.outline();
}

// --- The speakers -----------------------------------------------------------

interface Frame {
  open: boolean;
  blink: boolean;
}

type Painter = (c: PixelCanvas, f: Frame) => void;

/** Mother: grey hair in a bun, pale and worried, a rust shawl over a plum dress. */
const mother: Painter = (c, fr) => {
  const skin = ramp(P.skinPale);
  const hair = ramp(P.hairGrey);
  const dress = ramp(P.dress);
  const shawl = ramp(P.shawl);
  const hairTex = strands((x, y) => (x - CX) * 0.9 + (y - 30) * Math.sign(x - CX) * 0.35, 30, 3);
  // Bun, then the hair at the back of the head.
  blob(c, CX + 1, 16, 10, 8, hair, 0.05, strands((x, y) => (x - CX) * 0.8 + y * 0.6, 14, 5));
  c.rect(CX - 6, 22, 13, 1, hair[1]);
  blob(c, CX, 42, 25, 24, hair, 0, hairTex);
  neck(c, skin, 7, 64);
  shoulders(c, dress, 76);
  collar(c, ramp(P.linen), 76, 10, 8);
  // The shawl crosses over the collar from both shoulders, knotted at the front.
  for (let y = 74; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.abs(x + 0.5 - CX);
      const inner = 5 + (y - 74) * 0.75;
      const outer = 18 + (y - 74) * 1.6;
      if (d < inner || d > outer) continue;
      const v = lightness((x - CX) / 44, -0.4 + (y - 74) / 40, 0.05) + Math.sin(d * 0.7 + y * 0.2) * 0.06;
      c.set(x, y, tone(shawl, v, x, y));
    }
  }
  for (let x = 6; x < S - 6; x += 3) c.set(x, 88 + (x % 2), shawl[0]); // fringe
  blob(c, CX, 89, 4, 3.2, shawl, 0.1);
  c.set(CX - 1, 88, shawl[4]);
  ears(c, skin, 17);
  face(c, { skin, width: 17.5, jaw: 6.5, top: 26, chin: 70 });
  eyes(c, { iris: 0x6a7a8a, blink: fr.blink, skin, lashes: true, tired: true });
  brows(c, P.hairGreyDark, 'worried');
  nose(c, skin);
  wrinkles(c, skin, true);
  blush(c, 0xc8706a, 0.3);
  mouth(c, { skin, lip: P.lip, open: fr.open, curve: -1, half: 4 });
  // Front hair: swept back from a middle parting, framing the face down to the ears.
  for (let y = 18; y < 58; y++) {
    for (let x = 22; x < 75; x++) {
      const nx = (x + 0.5 - CX) / 25;
      const ny = (y + 0.5 - 42) / 24;
      if (nx * nx + ny * ny > 1) continue;
      const dx = Math.abs(x + 0.5 - CX);
      const line = 32 + Math.pow(dx / 15, 2) * 9;
      const side = dx > 16.5 && y < 57 - (dx - 16) * 2;
      if (y > line && !side) continue;
      c.set(x, y, tone(hair, lightness(nx * 0.8, ny * 0.8) + hairTex(x, y), x, y));
    }
  }
  c.set(CX, 26, hair[0]);
  c.set(CX, 27, hair[0]);
  c.set(CX, 28, hair[1]);
  finish(c);
};

/** Bram the pedlar: a battered felt hat with a feather, grizzled beard, ruddy cheeks, mustard coat. */
const pedlar: Painter = (c, fr) => {
  const skin = ramp(0xe0a884);
  const hair = ramp(0x8a7868);
  const beard = ramp(0xa09484);
  const coat = ramp(0xa07a34);
  const vest = ramp(0x8a3e30);
  const hat = ramp(0x5e4a3a);
  blob(c, CX, 44, 23, 20, hair, -0.05, strands((x) => x * 0.8, undefined, 2));
  neck(c, skin, 8, 64);
  shoulders(c, coat, 74);
  // Red waistcoat and linen shirt under the coat's lapels.
  for (let y = 76; y < S; y++) {
    const half = 8 + (y - 76) * 0.55;
    for (let x = Math.round(CX - half); x < Math.round(CX + half); x++) c.set(x, y, tone(vest, lightness((x - CX) / 18, 0, 0), x, y));
    for (const side of [-1, 1]) {
      const lx = Math.round(CX + side * half);
      for (let k = 0; k < 3; k++) c.set(lx + side * k, y, k === 0 ? coat[0] : coat[3]);
    }
  }
  collar(c, ramp(P.linen), 75, 8, 5);
  for (let y = 84; y < S; y += 5) c.set(CX + 1, y, P.goldLight); // buttons
  // Pack straps.
  for (const side of [-1, 1]) {
    for (let y = 76; y < S; y++) {
      const x = Math.round(CX + side * (24 + (y - 76) * 0.3));
      c.set(x, y, P.leather);
      c.set(x + 1, y, P.leatherDark);
      c.set(x - 1, y, P.leatherLight);
    }
    c.rect(Math.round(CX + side * 27) - 1, 88, 3, 2, P.gold);
  }
  ears(c, skin, 17.5);
  face(c, { skin, width: 18, jaw: 8, top: 26, chin: 70, shadowAbove: 38 });
  eyes(c, { iris: 0x5a3e2a, blink: fr.blink, skin });
  brows(c, 0x8a7868, 'heavy', 3);
  nose(c, skin, 1);
  blush(c, 0xc8504a, 0.7);
  wrinkles(c, skin);
  // Full grizzled beard and moustache.
  const beardTex = strands((x, y) => x * 0.9 + y * 0.15, undefined, 9);
  for (let y = EYE_Y + 9; y < 76; y++) {
    for (let x = CX - 19; x <= CX + 19; x++) {
      const dx = Math.abs(x + 0.5 - CX);
      const w = faceHalf({ skin, width: 18, jaw: 8, top: 26, chin: 70 }, Math.min(y, 70)) ?? 8;
      const lowest = 70 + 6 * (1 - (dx / 16) ** 2);
      if (dx > w + 1 || y > lowest) continue;
      if (y < EYE_Y + 13 && dx < 7) continue; // above the moustache
      if (y >= EYE_Y + 13 && y <= EYE_Y + 15 && dx > 3 && dx < 6 && !fr.open) continue;
      const grey = hash(x, y * 3) > 0.7;
      c.set(x, y, grey ? beard[4] : tone(beard, lightness((x - CX) / 22, (y - 66) / 24) + beardTex(x, y), x, y));
    }
  }
  mouth(c, { skin, lip: 0x9a4a44, open: fr.open, half: 3, y: EYE_Y + 16 });
  for (let x = CX - 6; x <= CX + 6; x++) {
    c.set(x, EYE_Y + 13, tone(beard, 0.62 - Math.abs(x - CX) * 0.03, x, EYE_Y + 13));
    c.set(x, EYE_Y + 14, tone(beard, 0.5 - Math.abs(x - CX) * 0.03, x, EYE_Y + 14));
  }
  // The hat: battered crown, wide drooping brim, a band and a pheasant feather.
  blob(c, CX + 1, 22, 18, 13, hat, 0.05, (x, y) => (Math.abs(x - CX - 1) < 2 && y < 18 ? -0.25 : 0));
  for (let y = 26; y <= 40; y++) {
    for (let x = 0; x < S; x++) {
      const nx = (x + 0.5 - CX) / 40;
      const ny = (y + 0.5 - 33 - Math.abs(nx) * 3) / 6.5;
      if (nx * nx + ny * ny > 1) continue;
      const under = ny > 0.35 && Math.abs(nx) < 0.5;
      c.set(x, y, under ? hat[0] : tone(hat, lightness(nx, ny * 0.5 - 0.3, 0.05), x, y));
    }
  }
  for (let x = CX - 16; x <= CX + 17; x++) {
    c.set(x, 25, P.leather);
    c.set(x, 26, P.leatherDark);
  }
  for (let i = 0; i < 16; i++) {
    const x = CX + 14 + Math.round(i * 0.6);
    const y = 25 - i;
    c.set(x, y, i % 3 ? 0xa04a2a : 0xe0b060);
    c.set(x + 1, y, i % 4 ? 0x6a2e1c : 0x3a5a3a);
    if (i > 3 && i < 13) c.set(x - 1, y, 0x7a3a20);
  }
  finish(c);
};

/** Sister Ysolde: a deep grey hood over a white wimple, calm, with a pilgrim's shell. */
const pilgrim: Painter = (c, fr) => {
  const skin = ramp(0xeac0a0);
  const wool = ramp(0x8a8690);
  const linen = ramp(0xe4ddd0);
  // The hood: rounded to a soft point on top, falling in folds over the shoulders.
  shoulders(c, wool, 72, 12);
  for (let y = 10; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - CX;
      let half: number;
      if (y < 46) {
        const ny = (y + 0.5 - 46) / 34;
        half = 27 * Math.sqrt(Math.max(0, 1 - ny * ny)) * (1 - Math.max(0, -ny - 0.55) * 0.9);
      } else half = 27 + (y - 46) * 0.3;
      if (Math.abs(dx) > half) continue;
      const fold = y > 56 ? Math.sin(dx * 0.45) * 0.07 : 0;
      c.set(x, y, tone(wool, lightness(dx / 32, (y - 44) / 46, 0.04) + fold, x, y));
    }
  }
  // Inside the hood is in shadow; a white wimple frames the face, shadowed under the hood's rim.
  blob(c, CX, 51, 21, 25.5, ramp(wool[0]), -0.3);
  for (let y = 28; y < 78; y++) {
    for (let x = CX - 19; x <= CX + 19; x++) {
      const nx = (x + 0.5 - CX) / 19;
      const ny = (y + 0.5 - 52) / 23.5;
      if (nx * nx + ny * ny > 1) continue;
      c.set(x, y, tone(linen, lightness(nx * 0.8, ny * 0.6, -0.04) - Math.max(0, (36 - y) / 10) * 0.3, x, y));
    }
  }
  const shape = { skin, width: 15, jaw: 6, top: 31, chin: 69 };
  face(c, shape);
  // The wimple's band across the forehead.
  for (let y = 31; y <= 35; y++) {
    const w = (faceHalf(shape, y) ?? 0) + 1;
    for (let x = Math.floor(CX - w); x < Math.ceil(CX + w); x++) {
      c.set(x, y, y === 35 ? linen[1] : tone(linen, lightness((x - CX) / 20, -0.2, -0.05) - (y < 33 ? 0.15 : 0), x, y));
    }
  }
  eyes(c, { iris: 0x5a7a5a, blink: fr.blink, skin, lashes: true, look: 0 });
  brows(c, 0x4a3a34, 'arched');
  nose(c, skin);
  blush(c, 0xd07a70, 0.35);
  mouth(c, { skin, lip: 0xb06a64, open: fr.open, curve: 1, half: 3 });
  // A scallop shell on a cord.
  for (let i = 0; i < 9; i++) {
    c.set(CX - 9 + i, 78 + Math.round(i * 0.9), P.leatherDark);
    c.set(CX + 9 - i, 78 + Math.round(i * 0.9), P.leatherDark);
  }
  blob(c, CX, 89, 4.5, 4, ramp(0xe8d8bc), 0.1);
  for (const dx of [-2, 0, 2]) {
    c.set(CX + dx, 87, 0xb8a080);
    c.set(CX + dx, 88, 0xb8a080);
  }
  finish(c);
};

/** Wil the drover: a freckled lad, tousled ginger hair, blue tunic laced at the neck, chewing a straw. */
const drover: Painter = (c, fr) => {
  const skin = ramp(P.skin);
  const hair = ramp(0xb4562a);
  const tunic = ramp(0x3d5a8a);
  const hairTex = strands((x, y) => x * 0.7 + y * 0.3, 27, 11);
  blob(c, CX, 40, 23, 20, hair, 0, hairTex);
  neck(c, skin, 7, 62);
  shoulders(c, tunic, 76);
  collar(c, ramp(P.linen), 76, 12, 6);
  for (let y = 78; y < 90; y += 3) {
    c.set(CX - 2, y, P.leatherDark);
    c.set(CX + 2, y + 1, P.leatherDark);
    c.set(CX - 1, y + 1, P.leather);
    c.set(CX + 1, y + 2, P.leather);
  }
  ears(c, skin, 16.5);
  face(c, { skin, width: 16.5, jaw: 7, top: 28, chin: 68 });
  eyes(c, { iris: 0x4a7ab0, blink: fr.blink, skin, look: 1 });
  brows(c, 0x9a4420, 'arched');
  nose(c, skin);
  freckles(c, skin, 4);
  blush(c, 0xd06a5a, 0.45);
  mouth(c, { skin, lip: 0xb06058, open: fr.open, curve: 1, half: 4 });
  // A stalk of straw at the corner of his mouth (out when he talks).
  if (!fr.open) {
    for (let i = 0; i < 10; i++) c.set(CX + 5 + i, EYE_Y + 15 - Math.round(i * 0.45), i % 3 ? P.straw : P.strawLight);
  }
  // Messy fringe: locks of uneven length.
  for (let y = 18; y < 44; y++) {
    for (let x = 24; x < 73; x++) {
      const nx = (x + 0.5 - CX) / 24;
      const ny = (y + 0.5 - 38) / 21;
      if (nx * nx + ny * ny > 1) continue;
      const lock = Math.floor((x + 2) / 4);
      const line = 33 + hash(lock, 3) * 7 - Math.abs(x - CX) * 0.05 + ((x + 2) % 4 === 0 ? -1 : 0);
      const side = Math.abs(x + 0.5 - CX) > 15.5 && y < 50;
      if (y > line && !side) continue;
      c.set(x, y, tone(hair, lightness(nx * 0.8, ny * 0.8) + hairTex(x, y), x, y));
    }
  }
  finish(c);
};

/** Hilde the baker: fair braids under a kerchief, rosy and smiling, flour on her cheek. */
const baker: Painter = (c, fr) => {
  const skin = ramp(0xf2caa4);
  const hair = ramp(0xd8b060);
  const dress = ramp(0xb0605a);
  const apron = ramp(0xece4d4);
  const scarf = ramp(0xc8423a);
  blob(c, CX, 42, 23, 22, hair, 0.05, strands((x) => x * 0.7, 32, 6));
  // Braids over each shoulder.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) blob(c, CX + side * (21 + i * 0.6), 56 + i * 5, 4, 3.2, hair, 0.05);
    c.rect(Math.round(CX + side * 24.5) - 1, 86, 3, 2, scarf[2]);
  }
  neck(c, skin, 7, 64);
  shoulders(c, dress, 76);
  // Apron bib with straps.
  for (let y = 80; y < S; y++) {
    for (let x = CX - 13; x < CX + 13; x++) c.set(x, y, tone(apron, lightness((x - CX) / 22, (y - 86) / 30, 0.04), x, y));
  }
  for (const side of [-1, 1]) for (let y = 74; y < 82; y++) c.rect(Math.round(CX + side * (14 + (y - 74) * 0.2)) - 1, y, 3, 1, apron[2]);
  collar(c, ramp(0xece4d4), 75, 6, 7);
  for (const [x, y] of [[CX - 6, 88], [CX + 4, 92], [CX - 1, 84], [CX + 8, 86]]) c.set(x, y, 0xfffaf0);
  ears(c, skin, 16.5);
  face(c, { skin, width: 16.5, jaw: 6.5, top: 28, chin: 69 });
  eyes(c, { iris: 0x7a6a3a, blink: fr.blink, skin, lashes: true });
  brows(c, 0xa88440, 'arched');
  nose(c, skin);
  blush(c, 0xe0605a, 0.75);
  mouth(c, { skin, lip: 0xc0605a, open: fr.open, curve: 1, half: 5 });
  // A dab of flour on her cheek.
  for (const [x, y] of [[CX - 13, EYE_Y + 7], [CX - 12, EYE_Y + 8], [CX - 14, EYE_Y + 8], [CX - 11, EYE_Y + 7]]) c.set(x, y, 0xf6f0e4);
  // Kerchief over the hair, tied at the back, with white spots.
  for (let y = 16; y < 40; y++) {
    for (let x = 22; x < 75; x++) {
      const nx = (x + 0.5 - CX) / 24;
      const ny = (y + 0.5 - 36) / 20;
      if (nx * nx + ny * ny > 1) continue;
      const line = 34 + Math.pow((x - CX) / 13, 2) * 4;
      if (y > line) continue;
      const spot = (x % 6 === 0 && y % 6 === 0) || ((x + 3) % 6 === 0 && (y + 3) % 6 === 0);
      c.set(x, y, spot ? 0xf0e0d0 : tone(scarf, lightness(nx * 0.85, ny * 0.85, 0.05) + Math.sin(x * 0.5 + y * 0.2) * 0.04, x, y));
    }
  }
  for (let x = CX - 14; x <= CX + 14; x++) c.set(x, Math.round(34 + Math.pow((x - CX) / 13, 2) * 4) + 1, scarf[0]);
  finish(c);
};

/** Osric the smith: bald and black-bearded, soot on his brow, a scorched leather apron over broad shoulders. */
const smith: Painter = (c, fr) => {
  const skin = ramp(0xd09a74);
  const shirt = ramp(0x6e6a62);
  const apron = ramp(0x4e3626);
  neck(c, skin, 11, 60);
  shoulders(c, shirt, 70, 8);
  // Apron bib, scorched in patches, with a heavy strap round the neck.
  for (let y = 78; y < S; y++) {
    const half = 15 + (y - 78) * 0.25;
    for (let x = Math.round(CX - half); x < Math.round(CX + half); x++) {
      const scorch = hash(Math.floor(x / 3), Math.floor(y / 3)) > 0.84;
      c.set(x, y, scorch ? apron[0] : tone(apron, lightness((x - CX) / 24, (y - 86) / 30, 0.05), x, y));
    }
  }
  for (const side of [-1, 1]) for (let y = 66; y < 80; y++) c.rect(Math.round(CX + side * (11 + (y - 66) * 0.3)) - 1, y, 3, 1, P.leatherDark);
  ears(c, skin, 19);
  // A broad, square head; bald, with the light catching his scalp.
  const shape = { skin, width: 19.5, jaw: 12, top: 20, chin: 70 };
  face(c, shape);
  for (const [x, y] of [[CX - 9, 24], [CX - 8, 24], [CX - 7, 23], [CX - 10, 25], [CX - 6, 23]]) c.set(x, y, skin[4]);
  const beard = ramp(0x2c2226);
  const beardTex = strands((x, y) => x * 0.8 + y * 0.12, undefined, 13);
  const bristle = (x: number, y: number, v: number) => tone(beard, v + beardTex(x, y), x, y);
  // Close-cropped hair round the back of the head, above the ears.
  for (let y = 34; y < EYE_Y + 8; y++) {
    const w = faceHalf(shape, y) ?? 0;
    for (let x = Math.floor(CX - w); x < Math.ceil(CX + w); x++) {
      const dx = Math.abs(x + 0.5 - CX);
      if (dx < w - 2.5 || BAYER[(y & 3) * 4 + (x & 3)] > 0.75) continue;
      c.set(x, y, bristle(x, y, lightness((x - CX) / 22, -0.2, 0.05)));
    }
  }
  eyes(c, { iris: 0x3a2a22, blink: fr.blink, skin });
  brows(c, 0x2e2428, 'stern', 3);
  nose(c, skin, 1);
  wrinkles(c, skin, true);
  // Soot smudges and an old burn scar across the brow.
  for (const [x, y] of [[CX + 9, 34], [CX + 10, 34], [CX + 11, 35], [CX + 10, 35], [CX + 12, 35], [CX - 13, EYE_Y + 5], [CX - 12, EYE_Y + 6]]) c.set(x, y, skin[0]);
  for (let i = 0; i < 6; i++) c.set(CX - 13 + i, 33 - Math.floor(i / 2), skin[3]);
  mouth(c, { skin, lip: 0x8a4a40, open: fr.open, half: 3, y: EYE_Y + 16 });
  // A great bushy beard from the sideburns down over his chest, and a heavy moustache.
  for (let y = EYE_Y + 4; y < 88; y++) {
    for (let x = CX - 22; x <= CX + 22; x++) {
      const dx = Math.abs(x + 0.5 - CX);
      const w = (faceHalf(shape, Math.min(y, 69)) ?? 12) + 1.5;
      const lowest = 72 + 14 * (1 - (dx / 21) ** 2);
      if (dx > w || y > lowest) continue;
      // Bare cheeks above the beard line, which dips from the sideburns to the moustache.
      const cheekLine = EYE_Y + 4 + Math.max(0, 15 - dx) * 0.75;
      if (y < cheekLine) continue;
      // Leave the mouth showing under the moustache.
      if (y >= EYE_Y + 15 && y <= EYE_Y + (fr.open ? 19 : 17) && dx < 4.5) continue;
      c.set(x, y, bristle(x, y, lightness((x - CX) / 24, (y - 70) / 32, 0.06)));
    }
  }
  finish(c);
};

/** Tamsin the tanner: long red hair tied back, freckles, a green jerkin and a short brown cloak with a clasp. */
const tanner: Painter = (c, fr) => {
  const skin = ramp(0xf0c8a6);
  const hair = ramp(0xb04a24);
  const jerkin = ramp(0x4e6a3a);
  const cloak = ramp(0x7a5434);
  const hairTex = strands((x, y) => (x - CX) * 0.9 + (y - 26) * 0.25 * Math.sign(x - CX + 6), 30, 17);
  // Long hair behind, down past the shoulders.
  for (let y = 22; y < 90; y++) {
    const half = y < 44 ? 24 * Math.sqrt(1 - ((44 - y) / 23) ** 2) : 24 - (y - 44) * 0.12;
    for (let x = Math.round(CX - half); x < Math.round(CX + half); x++) {
      c.set(x, y, tone(hair, lightness((x - CX) / (half + 3), (y - 44) / 50, -0.05) + hairTex(x, y), x, y));
    }
  }
  neck(c, skin, 7, 64);
  shoulders(c, cloak, 76);
  // Jerkin showing between the cloak's edges, laced up the front.
  for (let y = 78; y < S; y++) {
    const half = 9 + (y - 78) * 0.45;
    for (let x = Math.round(CX - half); x < Math.round(CX + half); x++) c.set(x, y, tone(jerkin, lightness((x - CX) / 18, 0, 0.02), x, y));
  }
  collar(c, ramp(P.linen), 76, 8, 6);
  for (let y = 86; y < S; y += 3) {
    c.set(CX - 1, y, P.leatherDark);
    c.set(CX + 1, y + 1, P.leatherDark);
  }
  // Cloak clasp: a bronze disc on each side.
  for (const side of [-1, 1]) blob(c, CX + side * 12, 80, 2.5, 2.5, ramp(0xc08a3a), 0.1);
  ears(c, skin, 16);
  face(c, { skin, width: 16, jaw: 6, top: 28, chin: 69 });
  eyes(c, { iris: 0x4a8a4a, blink: fr.blink, skin, lashes: true, look: -1 });
  brows(c, 0x8a3418, 'flat');
  nose(c, skin);
  freckles(c, skin, 9);
  mouth(c, { skin, lip: 0xb05a52, open: fr.open, curve: 0, half: 4 });
  // Side-parted front hair, and loose strands falling either side of the face.
  for (let y = 18; y < 62; y++) {
    for (let x = 23; x < 73; x++) {
      const nx = (x + 0.5 - CX) / 24;
      const ny = (y + 0.5 - 42) / 24;
      if (nx * nx + ny * ny > 1) continue;
      const dx = x + 0.5 - (CX - 5);
      const line = 31 + (dx < 0 ? (dx / 10) ** 2 * 6 : (dx / 16) ** 2 * 3 + 1);
      const strand = Math.abs(x + 0.5 - CX) > 15 && Math.abs(x + 0.5 - CX) < 19 && y < 62;
      if (y > line && !strand) continue;
      c.set(x, y, tone(hair, lightness(nx * 0.8, ny * 0.8) + hairTex(x, y), x, y));
    }
  }
  finish(c);
};

/** The militia: a kettle helm over a mail coif, stubbled, a blue-and-gold tabard. */
const guard: Painter = (c, fr) => {
  const skin = ramp(P.skin);
  const iron = ramp(0x7a7a86);
  const tabard = ramp(0x2e4a7a);
  const mail = (x: number, y: number, v: number) => tone(iron, v + ((x + (y % 2)) % 2 ? -0.18 : 0.06), x, y);
  // Mail shoulders under the tabard.
  for (let y = 70; y < S; y++) {
    const half = 18 + Math.pow(Math.min(1, (y - 70) / 10), 0.55) * 30;
    for (let x = Math.floor(CX - half); x < Math.ceil(CX + half); x++) c.set(x, y, mail(x, y, lightness((x - CX) / (half + 4), -0.4 + (y - 70) / 40)));
  }
  // Tabard: blue, with a gold band down the middle.
  for (let y = 80; y < S; y++) {
    for (let x = CX - 20; x < CX + 20; x++) {
      const gold = Math.abs(x + 0.5 - CX) < 3;
      c.set(x, y, tone(gold ? ramp(P.gold) : tabard, lightness((x - CX) / 30, (y - 86) / 30, 0.02), x, y));
    }
  }
  for (let x = CX - 20; x < CX + 20; x++) c.set(x, 80, P.gold);
  // Coif round the face and under the chin.
  for (let y = 26; y < 82; y++) {
    for (let x = CX - 25; x < CX + 25; x++) {
      const nx = (x + 0.5 - CX) / 25;
      const ny = (y + 0.5 - 52) / 30;
      if (nx * nx + ny * ny > 1) continue;
      c.set(x, y, mail(x, y, lightness(nx * 0.9, ny * 0.9)));
    }
  }
  face(c, { skin, width: 16.5, jaw: 7.5, top: 30, chin: 69, shadowAbove: 37 });
  // Stubble along the jaw.
  for (let y = EYE_Y + 10; y <= 69; y++) {
    const w = faceHalf({ skin, width: 16.5, jaw: 7.5, top: 30, chin: 69 }, y) ?? 0;
    for (let x = Math.round(CX - w); x < Math.round(CX + w); x++) {
      if (BAYER[(y & 3) * 4 + (x & 3)] < 0.35 && Math.abs(x - CX) > 5 - (y - EYE_Y - 10) * 0.6) c.set(x, y, skin[1]);
    }
  }
  eyes(c, { iris: 0x5a3e2a, blink: fr.blink, skin });
  brows(c, 0x4a3020, 'stern');
  nose(c, skin);
  mouth(c, { skin, lip: 0xa05a50, open: fr.open, curve: -1, half: 4 });
  // Kettle helm: a rounded crown with a broad brim and a ring of rivets.
  blob(c, CX, 26, 21, 14, iron, 0.08, (x, y) => (x === CX - 9 && y > 16 && y < 30 ? 0.3 : 0), (_x, y) => y < 34);
  for (let y = 30; y <= 40; y++) {
    for (let x = 0; x < S; x++) {
      const nx = (x + 0.5 - CX) / 34;
      const ny = (y + 0.5 - 35) / 4.5;
      if (nx * nx + ny * ny > 1) continue;
      c.set(x, y, ny > 0.4 ? iron[0] : tone(iron, lightness(nx, -0.5, 0.05), x, y));
    }
  }
  for (let x = CX - 18; x <= CX + 18; x += 4) c.set(x, 31, iron[4]);
  finish(c);
};

/** Farmer Iran: weathered and smiling, a short grey beard, a frayed straw hat with a hen's feather in the band, a wool smock. */
const iran: Painter = (c, fr) => {
  const skin = ramp(0xc8906a);
  const hair = ramp(0x4a3e38);
  const beard = ramp(0x8a827c);
  const smock = ramp(0x9a8a6a);
  const straw = ramp(P.straw);
  const hairTex = strands((x, y) => (x - CX) * 0.8 + y * 0.2, 40, 21);
  // Hair showing under the hat at the back and sides.
  blob(c, CX, 46, 23, 18, hair, -0.05, hairTex);
  neck(c, skin, 8, 62);
  shoulders(c, smock, 74, 12);
  collar(c, ramp(0x7a5a3a), 74, 9, 7);
  // A cord lacing the smock at the neck.
  for (let y = 76; y < 86; y += 3) {
    c.set(CX - 2, y, P.leatherDark);
    c.set(CX + 2, y + 1, P.leatherDark);
  }
  ears(c, skin, 17.5);
  const shape = { skin, width: 17.5, jaw: 9, top: 26, chin: 70, shadowAbove: 33 };
  face(c, shape);
  eyes(c, { iris: 0x5a4030, blink: fr.blink, skin });
  brows(c, 0x6a5e58, 'heavy', 2);
  nose(c, skin, 1);
  wrinkles(c, skin, true);
  blush(c, 0xc0604a, 0.4);
  mouth(c, { skin, lip: 0x9a5a4a, open: fr.open, curve: 1, half: 4, y: EYE_Y + 16 });
  // A short, neat grey beard along the jaw and round the mouth.
  const beardTex = strands((x, y) => x * 0.9 + y * 0.1, undefined, 23);
  for (let y = EYE_Y + 8; y < 78; y++) {
    for (let x = CX - 20; x <= CX + 20; x++) {
      const dx = Math.abs(x + 0.5 - CX);
      const w = (faceHalf(shape, Math.min(y, 69)) ?? 9) + 1;
      const lowest = 72 + 5 * (1 - (dx / 18) ** 2);
      if (dx > w || y > lowest) continue;
      if (y < EYE_Y + 8 + Math.max(0, 14 - dx) * 0.55) continue;
      if (y >= EYE_Y + 15 && y <= EYE_Y + (fr.open ? 19 : 17) && dx < 4.5) continue;
      c.set(x, y, tone(beard, lightness((x - CX) / 22, (y - 68) / 30, 0.05) + beardTex(x, y), x, y));
    }
  }
  // The straw hat: a wide, frayed brim and a round crown with a band.
  const weave = (x: number, y: number) => ((x + y) % 4 === 0 ? -0.12 : (x - y) % 4 === 0 ? 0.06 : 0);
  blob(c, CX, 22, 19, 13, straw, 0.1, weave, (_x, y) => y < 32);
  for (let y = 26; y <= 38; y++) {
    for (let x = 0; x < S; x++) {
      const nx = (x + 0.5 - CX) / 38;
      const ny = (y + 0.5 - 32) / 5.5;
      if (nx * nx + ny * ny > 1) continue;
      // Frayed ends round the rim.
      if (nx * nx + ny * ny > 0.82 && hash(x, y) < 0.35) continue;
      c.set(x, y, ny > 0.35 ? straw[1] : tone(straw, lightness(nx, -0.6, 0.08) + weave(x, y), x, y));
    }
  }
  for (let x = CX - 18; x <= CX + 18; x++) {
    c.set(x, 28, 0x6a3a22);
    c.set(x, 29, 0x4a2818);
  }
  // A brown-and-white hen's feather tucked in the band.
  for (let i = 0; i < 12; i++) {
    const x = CX + 14 + Math.round(i * 0.55);
    const y = 28 - i;
    c.set(x, y, i % 3 ? 0xa2622e : 0xece6d6);
    c.set(x + 1, y, i % 2 ? 0x7a4420 : 0xc48448);
    if (i > 2 && i < 10) c.set(x - 1, y, 0xc48448);
  }
  finish(c);
};

/** One of Lord Morten's toll guards: a black nasal helm, a broken nose, a sour look, Morten's crimson over mail. */
const tollguard: Painter = (c, fr) => {
  const skin = ramp(0xd8a482);
  const steel = ramp(0x4e4a56);
  const iron = ramp(0x7a7a86);
  const tabard = ramp(0x8a1c26);
  const mail = (x: number, y: number, v: number) => tone(iron, v + ((x + (y % 2)) % 2 ? -0.18 : 0.06), x, y);
  for (let y = 70; y < S; y++) {
    const half = 18 + Math.pow(Math.min(1, (y - 70) / 10), 0.55) * 30;
    for (let x = Math.floor(CX - half); x < Math.ceil(CX + half); x++) c.set(x, y, mail(x, y, lightness((x - CX) / (half + 4), -0.4 + (y - 70) / 40)));
  }
  // Crimson tabard with a black chevron.
  for (let y = 80; y < S; y++) {
    for (let x = CX - 21; x < CX + 21; x++) {
      const chevron = Math.abs(y - 84 - Math.abs(x + 0.5 - CX) * 0.45) < 2.2;
      c.set(x, y, chevron ? 0x262028 : tone(tabard, lightness((x - CX) / 30, (y - 86) / 30, 0.02), x, y));
    }
  }
  for (let x = CX - 21; x < CX + 21; x++) c.set(x, 80, 0x262028);
  // Mail coif round the face.
  for (let y = 30; y < 82; y++) {
    for (let x = CX - 25; x < CX + 25; x++) {
      const nx = (x + 0.5 - CX) / 25;
      const ny = (y + 0.5 - 54) / 28;
      if (nx * nx + ny * ny > 1) continue;
      c.set(x, y, mail(x, y, lightness(nx * 0.9, ny * 0.9) - 0.1));
    }
  }
  const shape = { skin, width: 16.5, jaw: 8.5, top: 31, chin: 70, shadowAbove: 40 };
  face(c, shape);
  // Dark stubble along the jaw.
  for (let y = EYE_Y + 9; y <= 70; y++) {
    const w = faceHalf(shape, y) ?? 0;
    for (let x = Math.round(CX - w); x < Math.round(CX + w); x++) {
      if (BAYER[(y & 3) * 4 + (x & 3)] < 0.5 && Math.abs(x - CX) > 5 - (y - EYE_Y - 9) * 0.6) c.set(x, y, skin[1]);
    }
  }
  eyes(c, { iris: 0x4a3a2a, blink: fr.blink, skin, look: -1 });
  brows(c, 0x2e2420, 'stern', 3);
  nose(c, skin, 1);
  // Broken once, set crooked.
  c.set(CX + 1, EYE_Y + 4, skin[1]);
  c.set(CX + 2, EYE_Y + 5, skin[3]);
  // A pale scar through the left brow.
  for (let i = 0; i < 6; i++) c.set(CX - 11 + Math.round(i * 0.4), EYE_Y - 7 + i, skin[4]);
  mouth(c, { skin, lip: 0x9a5048, open: fr.open, curve: -1, half: 4 });
  // A drooping black moustache.
  for (let x = CX - 6; x <= CX + 6; x++) {
    const droop = Math.abs(x - CX) > 4 ? 1 : 0;
    c.set(x, EYE_Y + 13 + droop, 0x2a2024);
    if (Math.abs(x - CX) < 5) c.set(x, EYE_Y + 12, 0x3a2e2a);
  }
  // The helm: a tall cone of blackened steel with a nose guard and a brow band.
  for (let y = 8; y < 41; y++) {
    const t = (y - 8) / 32;
    const half = 3 + Math.pow(t, 0.6) * 21;
    for (let x = Math.floor(CX - half); x < Math.ceil(CX + half); x++) {
      const nx = (x + 0.5 - CX) / (half + 1);
      c.set(x, y, tone(steel, lightness(nx, t - 0.6, 0.05) + (Math.abs(x + 0.5 - CX + 6) < 1.2 && y > 14 ? 0.35 : 0), x, y));
    }
  }
  for (let x = CX - 24; x <= CX + 24; x++) {
    c.set(x, 37, steel[3]);
    c.set(x, 38, steel[2]);
    c.set(x, 39, steel[1]);
    c.set(x, 40, steel[0]);
    if ((x - CX) % 5 === 0) c.set(x, 38, iron[4]);
  }
  for (let y = 40; y < EYE_Y + 7; y++) {
    c.set(CX - 1, y, steel[3]);
    c.set(CX, y, steel[2]);
    c.set(CX + 1, y, steel[1]);
  }
  finish(c);
};

/** Odo the carter: round and ruddy, a bushy brown moustache, a flat cap and a russet coat with a spotted neckerchief. */
const carter: Painter = (c, fr) => {
  const skin = ramp(0xe0a07c);
  const hair = ramp(0x6a4a30);
  const coat = ramp(0x8a4a2a);
  const cap = ramp(0x5a5a3e);
  const kerchief = ramp(0x2e5a7a);
  blob(c, CX, 46, 24, 18, hair, -0.05, strands((x, y) => x * 0.7 + y * 0.2, undefined, 31));
  neck(c, skin, 9, 64);
  shoulders(c, coat, 73, 8);
  // Neckerchief knotted at the throat, with white spots.
  for (let y = 70; y < 82; y++) {
    const half = 14 - (y - 70) * 0.8;
    for (let x = Math.round(CX - half); x < Math.round(CX + half); x++) {
      const spot = (x + y * 2) % 7 === 0;
      c.set(x, y, spot ? 0xe8e0d0 : tone(kerchief, lightness((x - CX) / 16, (y - 74) / 14), x, y));
    }
  }
  blob(c, CX + 1, 82, 3.5, 2.8, kerchief, 0.1);
  for (let y = 84; y < S; y++) {
    c.set(CX - 6 + Math.round((y - 84) * 0.3), y, coat[0]);
    c.set(CX + 6 - Math.round((y - 84) * 0.3), y, coat[0]);
  }
  ears(c, skin, 18.5);
  const shape = { skin, width: 18.5, jaw: 10, top: 28, chin: 70, shadowAbove: 36 };
  face(c, shape);
  eyes(c, { iris: 0x4a6a8a, blink: fr.blink, skin });
  brows(c, 0x5a3c26, 'heavy', 3);
  nose(c, skin, 2);
  blush(c, 0xd0504a, 0.9);
  wrinkles(c, skin);
  mouth(c, { skin, lip: 0xa0504a, open: fr.open, curve: 1, half: 4, y: EYE_Y + 17 });
  // A great bushy moustache.
  const tash = strands((x) => x * 1.3, undefined, 33);
  for (let y = EYE_Y + 11; y <= EYE_Y + 16; y++) {
    for (let x = CX - 11; x <= CX + 11; x++) {
      const dx = Math.abs(x + 0.5 - CX);
      const top = EYE_Y + 11 + Math.max(0, dx - 6) * 0.35;
      const bottom = EYE_Y + 14 + Math.max(0, dx - 4) * 0.25 - (dx < 2 ? 1 : 0);
      if (y < top || y > bottom) continue;
      c.set(x, y, tone(hair, lightness((x - CX) / 14, (y - EYE_Y - 13) / 4, 0.05) + tash(x, y), x, y));
    }
  }
  // Flat cap with a short peak.
  blob(c, CX - 1, 27, 24, 10, cap, 0.05, (x, y) => ((x * 2 + y) % 6 === 0 ? -0.08 : 0), (_x, y) => y < 35);
  for (let y = 31; y <= 37; y++) {
    for (let x = CX - 22; x <= CX + 20; x++) {
      const nx = (x + 0.5 - CX) / 22;
      const ny = (y + 0.5 - 34) / 3.6;
      if (nx * nx + ny * ny > 1) continue;
      c.set(x, y, ny > 0.3 ? cap[0] : tone(cap, lightness(nx, -0.4, 0.04), x, y));
    }
  }
  c.set(CX - 1, 18, cap[3]);
  finish(c);
};

/** Ness the herb-gatherer: weathered and kind, grey-streaked hair under a sage-green hood, a sprig of herbs at her ear. */
const herbwife: Painter = (c, fr) => {
  const skin = ramp(0xd8a888);
  const hair = ramp(0x6a625e);
  const cloak = ramp(0x6a7a52);
  const dress = ramp(0x7a5a46);
  shoulders(c, cloak, 72, 12);
  // Hood up, a little back from the face, showing her hair.
  for (let y = 12; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - CX;
      let half: number;
      if (y < 46) {
        const ny = (y + 0.5 - 46) / 32;
        half = 28 * Math.sqrt(Math.max(0, 1 - ny * ny));
      } else half = 28 + (y - 46) * 0.3;
      if (Math.abs(dx) > half) continue;
      const fold = y > 56 ? Math.sin(dx * 0.4) * 0.07 : 0;
      c.set(x, y, tone(cloak, lightness(dx / 32, (y - 44) / 46, 0.04) + fold, x, y));
    }
  }
  blob(c, CX, 50, 22, 26, ramp(cloak[0]), -0.3);
  const hairTex = strands((x, y) => (x - CX) * 0.9 + (y - 30) * Math.sign(x - CX) * 0.4, 30, 35);
  blob(c, CX, 46, 21, 22, hair, 0, (x, y) => hairTex(x, y) + (hash(x, y * 2) > 0.8 ? 0.25 : 0));
  neck(c, skin, 7, 64);
  // The dress showing at the neck, and the cloak's clasp.
  for (let y = 74; y < S; y++) {
    const half = 7 + (y - 74) * 0.45;
    for (let x = Math.round(CX - half); x < Math.round(CX + half); x++) c.set(x, y, tone(dress, lightness((x - CX) / 16, 0), x, y));
  }
  blob(c, CX, 76, 2.6, 2.2, ramp(P.ironLight), 0.1);
  ears(c, skin, 16);
  face(c, { skin, width: 16, jaw: 6.5, top: 30, chin: 69 });
  eyes(c, { iris: 0x6a7a3a, blink: fr.blink, skin, lashes: true, look: 1 });
  brows(c, 0x5a524e, 'arched');
  nose(c, skin);
  wrinkles(c, skin, true);
  blush(c, 0xc0706a, 0.4);
  mouth(c, { skin, lip: 0xa86460, open: fr.open, curve: 1, half: 4 });
  // Hair parted in the middle, falling either side of the face.
  for (let y = 26; y < 62; y++) {
    for (let x = CX - 21; x <= CX + 21; x++) {
      const dx = Math.abs(x + 0.5 - CX);
      const line = 33 + Math.pow(dx / 14, 2) * 7;
      const side = dx > 15.5 && y < 61 - (dx - 15) * 1.5;
      if (y > line && !side) continue;
      const nx = (x + 0.5 - CX) / 22;
      if (nx * nx + ((y + 0.5 - 46) / 22) ** 2 > 1) continue;
      c.set(x, y, tone(hair, lightness(nx * 0.8, (y - 46) / 30) + hairTex(x, y) + (hash(x * 3, y) > 0.82 ? 0.3 : 0), x, y));
    }
  }
  // A sprig of rosemary and a pale flower tucked by her ear.
  for (let i = 0; i < 10; i++) {
    const x = CX + 19 + Math.round(i * 0.3);
    const y = 50 - i;
    c.set(x, y, P.leafDark);
    if (i % 2) c.set(x + 1, y, P.leafLight);
    else c.set(x - 1, y, P.leaf);
  }
  blob(c, CX + 22, 39, 2.2, 2, ramp(0xe8e4f0), 0.1);
  c.set(CX + 22, 39, P.goldLight);
  finish(c);
};

/** How one of Saint Elda's brothers looks: they share the tonsure and the habit, and differ in the rest. */
interface MonkLook {
  skin: number;
  /** The ring of hair left round the tonsure. */
  hair: number;
  habit: number;
  iris: number;
  brow: BrowShape;
  /** 1 smiles, 0 is solemn. */
  smile: number;
  /** Lines round the eyes. */
  old?: boolean;
  /** Face width and jaw, for thin or round faces. */
  width?: number;
  jaw?: number;
  beard?: number;
  /** A smudge of garden earth on the cheek. */
  muddy?: boolean;
}

/**
 * A brother of Saint Elda's: the crown of the head shaved in a tonsure with a
 * ring of hair round it, a plain wool habit with its hood down in a roll at
 * the neck, and a little wooden cross on a cord.
 */
function monk(look: MonkLook): Painter {
  return (c, fr) => {
    const skin = ramp(look.skin);
    const hair = ramp(look.hair);
    const habit = ramp(look.habit);
    const width = look.width ?? 17;
    const jaw = look.jaw ?? 8;
    shoulders(c, habit, 74, 12);
    // The hood, down, in a thick roll round the neck.
    blob(c, CX, 74, 27, 9, habit, -0.05, (x) => Math.sin((x - CX) * 0.5) * 0.06);
    neck(c, skin, 8, 62, 72);
    // The shaven crown, then the ring of hair round it.
    blob(c, CX, 42, width + 3, 21, skin, 0.08);
    const hairTex = strands((x, y) => (x - CX) * 0.9 + y * 0.3, undefined, 41);
    for (let y = 20; y < 58; y++) {
      for (let x = CX - width - 4; x <= CX + width + 4; x++) {
        const dx = x + 0.5 - CX;
        const nx = dx / (width + 3.5);
        const ny = (y + 0.5 - 42) / 21.5;
        if (nx * nx + ny * ny > 1) continue;
        const band = 29 + (dx / (width + 3)) ** 2 * 9;
        if (y < band || (y > band + 6 && Math.abs(dx) < width - 2)) continue;
        c.set(x, y, tone(hair, lightness(nx, ny, 0.02) + hairTex(x, y), x, y));
      }
    }
    ears(c, skin, width);
    const shape = { skin, width, jaw, top: 35, chin: 70 };
    face(c, shape);
    eyes(c, { iris: look.iris, blink: fr.blink, skin, tired: look.old });
    brows(c, look.hair, look.brow, 2);
    nose(c, skin, look.old ? 1 : 0);
    if (look.old) wrinkles(c, skin, true);
    blush(c, 0xc8706a, look.muddy ? 0.7 : 0.35);
    mouth(c, { skin, lip: 0x9a5a52, open: fr.open, curve: look.smile, half: 4, y: EYE_Y + 16 });
    if (look.muddy) {
      for (const [dx, dy] of [[-12, 9], [-11, 10], [-13, 10], [-10, 9], [-12, 11]]) c.set(CX + dx, EYE_Y + dy, P.dirt);
    }
    if (look.beard !== undefined) {
      const beard = ramp(look.beard);
      const tex = strands((x, y) => x * 0.9 + y * 0.1, undefined, 43);
      for (let y = EYE_Y + 10; y < 80; y++) {
        for (let x = CX - 20; x <= CX + 20; x++) {
          const dx = Math.abs(x + 0.5 - CX);
          const w = (faceHalf(shape, Math.min(y, 69)) ?? 8) + 1;
          if (dx > w + 1 || y > 73 + 5 * (1 - (dx / 16) ** 2)) continue;
          // A full beard: up the jaw to the ears, and a moustache over the lip.
          if (y < EYE_Y + 13 - Math.max(0, dx - 8) * 0.5 && !(dx < 7 && y >= EYE_Y + 12)) continue;
          if (y >= EYE_Y + 15 && y <= EYE_Y + (fr.open ? 19 : 17) && dx < 4.5) continue;
          c.set(x, y, tone(beard, lightness((x - CX) / 22, (y - 68) / 30, 0.05) + tex(x, y), x, y));
        }
      }
    }
    // A little wooden cross on a cord.
    for (let i = 0; i < 12; i++) {
      c.set(CX - 10 + Math.round(i * 0.8), 80 + i, P.leatherDark);
      c.set(CX + 10 - Math.round(i * 0.8), 80 + i, P.leatherDark);
    }
    for (let y = 90; y < S - 1; y++) {
      c.set(CX, y, P.barkLight);
      c.set(CX + 1, y, P.bark);
    }
    for (let x = CX - 3; x <= CX + 4; x++) c.set(x, 92, x > CX ? P.bark : P.barkLight);
    finish(c);
  };
}

/** Brother Wystan, the porter: old and thin, white-haired, solemn, keeping the gate. */
const porter = monk({ skin: 0xe2b896, hair: 0xd8d4d0, habit: 0x5a4636, iris: 0x5a6a7a, brow: 'heavy', smile: 0, old: true, width: 15.5, jaw: 7 });
/** Brother Cuthbert, the gardener: round and cheerful, sandy-haired, earth on his cheek. */
const gardener = monk({ skin: 0xe6a882, hair: 0xb08a4a, habit: 0x6a5240, iris: 0x4a7a4a, brow: 'arched', smile: 1, width: 19, jaw: 11, muddy: true });
/** Brother Aldo, under a vow of silence: dark, bearded, with a knowing look. */
const silent = monk({ skin: 0xb88262, hair: 0x2a2024, habit: 0x4e4a46, iris: 0x3a2a20, brow: 'flat', smile: 0, beard: 0x2a2024 });
/** Brother Tobin, a novice: young, freckled, eager, with a mop of red at the sides. */
const novice = monk({ skin: 0xf0c49a, hair: 0xb4562a, habit: 0x8a7a64, iris: 0x4a6a8a, brow: 'worried', smile: 1, width: 16, jaw: 7 });

const PAINTERS: Record<string, Painter> = {
  mother, pedlar, pilgrim, drover, baker, smith, tanner, guard, iran, tollguard, carter, herbwife,
  porter, gardener, silent, novice,
};

/** Paints every speaker's portrait as 'portrait-<id>', three frames wide. */
export function generatePortraits(scene: Phaser.Scene): void {
  const frames: Frame[] = [
    { open: false, blink: false },
    { open: true, blink: false },
    { open: false, blink: true },
  ];
  for (const [id, paint] of Object.entries(PAINTERS)) {
    const sheet = new PixelCanvas(S * frames.length, S);
    frames.forEach((f, i) => {
      const frame = new PixelCanvas(S, S);
      paint(frame, f);
      sheet.blit(frame, i * S, 0);
    });
    const tex = sheet.toTexture(scene, `portrait-${id}`);
    frames.forEach((_f, i) => tex.add(i, 0, i * S, 0, S, S));
  }
}
