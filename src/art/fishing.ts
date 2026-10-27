import Phaser from 'phaser';
import { IsoModel, project, Shader, Vec3 } from './IsoModel';
import { MODEL_ART } from './interior';
import { PALETTE as P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Old Tobin's fishing spot on the far shore of the lake: his rod, propped on a
 * forked stick with its line out to a float on the water, and the wicker creel
 * he keeps his catch in (when there is one). He sits on a stool between them.
 *
 * The rod is laid out from the back corner of the water tile in front of the
 * stool: it reaches out across the water along +y, which is the way Tobin
 * faces (see FISHING_ROD).
 */

/** Where the rod's parts are, relative to its object's back corner: grid x, y and height in pixels. */
export const FISHING_ROD = {
  butt: { x: 0.6, y: -0.35, z: 12 },
  fork: { x: 0.64, y: 0.06, z: 22 },
  tip: { x: 0.74, y: 2.0, z: 64 },
  float: { x: 0.8, y: 2.35, z: 0 },
};

const ROD = { dark: 0x5a4024, base: 0x8a6a3c, light: 0xb08a50 };
const LINE = 0xd8d4c4;
const FLOAT = { red: 0xc8434a, white: 0xeee8dc };

/** A straight line of pixels from a to b. */
function line(c: PixelCanvas, a: { x: number; y: number }, b: { x: number; y: number }, color: (t: number) => number): void {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    c.set(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t), color(t));
  }
}

function rod(): { canvas: PixelCanvas; anchorX: number; anchorY: number } {
  const { butt, fork, tip, float } = FISHING_ROD;
  const pts: Vec3[] = [butt, fork, { ...fork, z: 0 }, tip, float];
  const projected = pts.map(project);
  const minX = Math.floor(Math.min(...projected.map((p) => p.x))) - 6;
  const maxX = Math.ceil(Math.max(...projected.map((p) => p.x))) + 6;
  const minY = Math.floor(Math.min(...projected.map((p) => p.y))) - 4;
  const maxY = Math.ceil(Math.max(...projected.map((p) => p.y))) + 4;
  const c = new PixelCanvas(maxX - minX, maxY - minY);
  const ax = -minX;
  const ay = -minY;
  const at = (p: Vec3) => {
    const s = project(p);
    return { x: ax + s.x, y: ay + s.y };
  };

  // The forked stick it rests on, pushed into the sand at the water's edge.
  const forkTop = at(fork);
  const forkFoot = at({ ...fork, z: 0 });
  line(c, forkFoot, { x: forkTop.x, y: forkTop.y + 2 }, (t) => (t < 0.2 ? P.barkDark : P.bark));
  c.set(Math.round(forkTop.x) - 1, Math.round(forkTop.y), P.barkLight);
  c.set(Math.round(forkTop.x) + 1, Math.round(forkTop.y), P.bark);
  c.set(Math.round(forkTop.x) - 1, Math.round(forkTop.y) + 1, P.bark);
  c.set(Math.round(forkTop.x) + 1, Math.round(forkTop.y) + 1, P.barkDark);
  // The rod: a thick, leather-gripped butt, then a whippy top half too thin to outline.
  const a = at(butt);
  const b = at(tip);
  const mid = { x: a.x + (b.x - a.x) * 0.45, y: a.y + (b.y - a.y) * 0.45 };
  line(c, a, mid, (t) => (t < 0.3 ? P.leather : ROD.base));
  c.outline();
  line(c, mid, b, (t) => (t < 0.5 ? ROD.dark : ROD.base));
  line(c, { x: mid.x + 1, y: mid.y }, { x: mid.x + (b.x - mid.x) * 0.35 + 1, y: mid.y + (b.y - mid.y) * 0.35 }, () => ROD.dark);

  // The line, sagging a little from the tip down to the float, which rides on a ring of ripples.
  const f = at(float);
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = b.x + (f.x - b.x) * t;
    const y = b.y + (f.y - 2 - b.y) * t + Math.sin(t * Math.PI) * 3;
    c.set(Math.round(x), Math.round(y), LINE, 200);
  }
  c.ellipse(f.x, f.y + 1, 5, 2, P.foam);
  c.ellipse(f.x, f.y + 1, 3.5, 1.2, P.waterLight);
  c.rect(Math.round(f.x) - 1, Math.round(f.y) - 2, 2, 2, FLOAT.red);
  c.rect(Math.round(f.x) - 1, Math.round(f.y), 2, 1, FLOAT.white);
  c.set(Math.round(f.x) - 1, Math.round(f.y) - 2, 0xf08a7a);
  return { canvas: c, anchorX: ax, anchorY: ay };
}

/** A wicker creel with a lid and a leather strap. */
function creel(): IsoModel {
  const m = new IsoModel();
  const weave =
    (light: number, base: number, dark: number): Shader =>
    (u, v) => {
      const row = Math.floor(v * 7);
      const col = Math.floor(u * 10 + (row % 2) * 0.5);
      if (Math.abs(v - 0.2) < 0.06) return P.leatherDark;
      return (row + col) % 2 ? base : (u < 0.3 ? light : dark);
    };
  m.box(0.34, 0.36, 0, 0.34, 0.28, 11, {
    top: P.strawDark,
    left: weave(P.strawLight, P.straw, P.strawDark),
    right: weave(P.straw, P.strawDark, P.thatchDark),
  });
  // The lid, a touch wider, and its strap.
  m.box(0.32, 0.34, 11, 0.38, 0.32, 2, { top: (u, v) => ((u * 8 + v * 3) % 1 < 0.5 ? P.straw : P.strawLight), left: P.strawDark, right: P.thatchDark });
  m.box(0.48, 0.34, 13, 0.06, 0.32, 1, { top: P.leather, left: P.leatherDark, right: P.leatherDark });
  return m;
}

export function generateFishing(scene: Phaser.Scene): void {
  const r = rod();
  r.canvas.toTexture(scene, 'fish-rod');
  MODEL_ART['fish-rod'] = { key: 'fish-rod', originX: r.anchorX / r.canvas.width, originY: r.anchorY / r.canvas.height };
  const c = creel().render();
  c.canvas.toTexture(scene, 'fish-creel');
  MODEL_ART['fish-creel'] = { key: 'fish-creel', originX: c.anchorX / c.canvas.width, originY: c.anchorY / c.canvas.height };
}
