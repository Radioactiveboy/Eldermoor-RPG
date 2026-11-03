import Phaser from 'phaser';
import { TILE_HEIGHT } from '../config';
import { MODEL_ART } from './interior';
import { PixelCanvas, seededRandom } from './PixelCanvas';

/**
 * The old white willow up on Adowvale Plains (see world/PlainsMap.ts), where
 * the hero strips the bark for Mother's tincture: a squat, hollowed, leaning
 * trunk that forks into great limbs, and a dome of narrow leaves that hangs
 * in long curtains nearly to the ground. White willow is silvery under its
 * leaves, so the curtains are flecked with silver-green. Stripped, the trunk
 * shows a long pale wound where the bark was cut away.
 *
 * It stands on a 3x3 footprint with its trunk in the middle tile.
 */

const W = 216;
const H = 200;
/** Where the foot of the trunk is in the picture: the middle of the footprint's middle tile. */
const BASE = { x: 112, y: 188 };

const LEAF = 0x86a446;
const LEAF_DARK = 0x56772e;
const LEAF_DEEP = 0x3a5622;
const LEAF_LIGHT = 0xb0c662;
const SILVER = 0xc9d4ac;
const WOOD = 0x6a5a48;
const WOOD_DARK = 0x40362a;
const WOOD_LIGHT = 0x8c7a62;
const CUT = 0xeedcae;
const CUT_DARK = 0xc8ac78;

/** Thick tapering limb from (x0, y0) to (x1, y1), as a run of shaded discs. */
function limb(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, r0: number, r1: number): void {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Phaser.Math.Linear(x0, x1, t);
    const y = Phaser.Math.Linear(y0, y1, t);
    const r = Phaser.Math.Linear(r0, r1, t);
    c.ellipse(x, y, r, r * 0.9, WOOD, WOOD_DARK, WOOD_LIGHT);
  }
}

function willow(stripped: boolean): PixelCanvas {
  const c = new PixelCanvas(W, H);
  const rnd = seededRandom(31);

  // Curtains at the back, behind the trunk: darker, as the light doesn't reach them.
  const curtain = (x: number, top: number, bottom: number, front: boolean) => {
    const sway = rnd() * 2 - 1;
    for (let y = top; y < bottom; y++) {
      const t = (y - top) / (bottom - top);
      const px = x + sway * t * t * 5;
      const r = rnd();
      let col: number;
      if (!front) col = r < 0.15 ? LEAF_DEEP : LEAF_DARK;
      else if (r < 0.1) col = SILVER;
      else if (r < 0.32) col = LEAF_LIGHT;
      else if (r < 0.8) col = LEAF;
      else col = LEAF_DARK;
      c.set(px, y, col);
      // Strands thin to a single leaf at the tip.
      if (t < 0.8) c.set(px + 1, y, front && px < BASE.x - 10 ? LEAF_LIGHT : LEAF_DARK);
    }
  };
  for (let x = BASE.x - 86; x <= BASE.x + 82; x += 2) {
    curtain(x + Math.round(rnd() * 2), 60 + Math.round(rnd() * 14), BASE.y - 14 - Math.round(rnd() * 24), false);
  }

  // The trunk: squat and broad, leaning towards the water, with roots gripping the bank.
  limb(c, BASE.x + 4, BASE.y - 6, BASE.x - 6, BASE.y - 64, 20, 15);
  c.ellipse(BASE.x - 18, BASE.y - 4, 10, 5, WOOD, WOOD_DARK, WOOD_LIGHT);
  c.ellipse(BASE.x + 22, BASE.y - 2, 11, 5, WOOD, WOOD_DARK, WOOD_LIGHT);
  c.ellipse(BASE.x + 2, BASE.y + 1, 9, 4, WOOD_DARK, WOOD_DARK);
  // The great limbs, forking off the top of it.
  limb(c, BASE.x - 8, BASE.y - 66, BASE.x - 52, BASE.y - 118, 12, 5);
  limb(c, BASE.x - 4, BASE.y - 68, BASE.x + 10, BASE.y - 132, 11, 5);
  limb(c, BASE.x - 2, BASE.y - 64, BASE.x + 50, BASE.y - 110, 10, 4);
  // Deep furrows running up the bark, a dark hollow at the heart, and a knot or two.
  for (let i = 0; i < 9; i++) {
    const x0 = BASE.x - 14 + i * 4 + Math.round(rnd() * 2);
    for (let y = BASE.y - 4; y > BASE.y - 64; y--) {
      const lean = (BASE.y - y) * 0.17;
      if (rnd() < 0.85 && c.get(Math.round(x0 - lean), y) !== null) c.set(x0 - lean, y, WOOD_DARK);
    }
  }
  c.ellipse(BASE.x - 12, BASE.y - 52, 4, 7, 0x1c140e);
  c.ellipse(BASE.x - 13, BASE.y - 53, 2.5, 4.5, 0x0e0a08);
  c.ellipse(BASE.x + 8, BASE.y - 22, 2.5, 2, WOOD_DARK, WOOD_DARK);
  // Moss on the side away from the sun.
  for (let y = BASE.y - 56; y < BASE.y - 4; y++) {
    for (let x = BASE.x + 8; x < BASE.x + 26; x++) {
      if (c.get(x, y) !== null && c.get(x + 3, y) === null && rnd() < 0.5) c.set(x, y, 0x5a6e30);
    }
  }

  if (stripped) {
    // A long pale wound where the bark was cut away, cream wood edged with the torn bark.
    const cx = BASE.x + 7;
    for (let y = BASE.y - 36; y < BASE.y - 10; y++) {
      const t = (y - (BASE.y - 36)) / 26;
      const half = 2 + Math.round(Math.sin(t * Math.PI) * 4);
      const lean = (BASE.y - y) * 0.17;
      for (let x = -half - 1; x <= half + 1; x++) {
        const edge = Math.abs(x) > half;
        c.set(cx - lean + x, y, edge ? 0x2a1e14 : x > half - 2 ? CUT_DARK : CUT);
      }
    }
    // A curl of bark left hanging off the bottom of it.
    c.set(cx - 2, BASE.y - 9, WOOD_LIGHT);
    c.set(cx - 2, BASE.y - 8, WOOD_LIGHT);
    c.set(cx - 1, BASE.y - 7, CUT_DARK);
  }

  // The crown: a broad, low dome of leaf, the back mounds first and darker.
  const mounds: Array<[number, number, number, number]> = [
    [BASE.x - 40, 50, 34, 22],
    [BASE.x + 6, 38, 38, 24],
    [BASE.x + 46, 54, 32, 20],
    [BASE.x - 70, 72, 28, 18],
    [BASE.x + 72, 76, 24, 16],
    [BASE.x - 20, 72, 40, 22],
    [BASE.x + 30, 76, 38, 20],
  ];
  for (const [x, y, rx, ry] of mounds) c.ellipse(x, y, rx, ry, LEAF, LEAF_DARK, LEAF_LIGHT);
  // Feathery texture: narrow leaves and silver undersides glinting all over the crown.
  for (let y = 10; y < 100; y++) {
    for (let x = 0; x < W; x++) {
      const col = c.get(x, y);
      if (col === null || (col !== LEAF && col !== LEAF_DARK && col !== LEAF_LIGHT)) continue;
      const r = rnd();
      if (r < 0.07) c.set(x, y, SILVER);
      else if (r < 0.2) c.set(x, y, col === LEAF_DARK ? LEAF_DEEP : LEAF_LIGHT);
      else if (r < 0.3 && col === LEAF) c.set(x, y, LEAF_DARK);
    }
  }

  // The front curtains, hanging from the crown's rim nearly to the ground, parted where the trunk shows through.
  for (let x = BASE.x - 92; x <= BASE.x + 88; x += 3) {
    const gap = x > BASE.x - 26 && x < BASE.x + 28;
    const rim = 78 + Math.round(Math.sqrt(Math.max(0, 1 - ((x - BASE.x) / 96) ** 2)) * 14);
    const bottom = gap ? rim + 26 + Math.round(rnd() * 16) : BASE.y - 6 - Math.round(rnd() * 26) - (Math.abs(x - BASE.x) > 70 ? 14 : 0);
    curtain(x + Math.round(rnd() * 2), rim - 6, bottom, true);
  }

  c.outline();
  // A dark pool of shade on the ground under the boughs (after the outline, so it has none).
  for (let y = BASE.y - 22; y <= BASE.y + 10; y++) {
    for (let x = BASE.x - 96; x <= BASE.x + 92; x++) {
      const d = ((x - BASE.x + 6) / 94) ** 2 + ((y - BASE.y + 6) / 16) ** 2;
      if (d <= 1 && c.get(x, y) === null) c.set(x, y, 0x0b0812, d < 0.5 ? 80 : 50);
    }
  }
  return c;
}

export function generateWillow(scene: Phaser.Scene): void {
  // The picture is anchored at the footprint's back corner: 1.5 tiles in along both x and y from the trunk's foot.
  const anchorY = BASE.y - TILE_HEIGHT * 1.5;
  for (const [key, stripped] of [['plains-willow', false], ['plains-willow-stripped', true]] as const) {
    const c = willow(stripped);
    c.toTexture(scene, key);
    MODEL_ART[key] = { key, originX: BASE.x / W, originY: anchorY / H };
  }
}
