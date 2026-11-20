import Phaser from 'phaser';

/**
 * The world map's pen work (scenes/MapScene.ts): little inked pictures in the style of an old
 * hand-drawn fantasy map, coloured with a thin wash. Each takes the spot it stands on (its
 * foot) and a size in pixels, and draws into a Graphics.
 */
type G = Phaser.GameObjects.Graphics;
type Rnd = Phaser.Math.RandomDataGenerator;

export const MAP_INK = 0x3b2a1a;
export const PARCHMENT = 0xe8d6ab;
export const PARCHMENT_DARK = 0xc9ad78;
const WATER = 0x9dbcb4;
const WATER_DEEP = 0x7fa39d;
const LEAF = 0x7e9152;
const LEAF_DARK = 0x56693a;
const PINE = 0x5f7a4c;
const PINE_DARK = 0x3f5634;
const ROOF = 0xa45a3c;
const ROOF_SLATE = 0x6d6f7a;
const WALL = 0xe8dcc0;
const STONE = 0xbdb6a4;
const ROAD = 0x8a6338;

const pt = (x: number, y: number) => new Phaser.Geom.Point(x, y);

/** The sheet itself: aged paper, mottled and stained, darker towards the burnt edges. */
export function parchment(g: G, w: number, h: number, rnd: Rnd): void {
  const hw = w / 2;
  const hh = h / 2;
  g.fillStyle(PARCHMENT, 1);
  g.fillRect(-hw, -hh, w, h);
  // Mottling: big soft blotches, lighter and darker.
  for (let i = 0; i < 700; i++) {
    const dark = rnd.frac() < 0.6;
    g.fillStyle(dark ? PARCHMENT_DARK : 0xf6e9c8, rnd.realInRange(0.025, 0.06));
    g.fillCircle(rnd.realInRange(-hw, hw), rnd.realInRange(-hh, hh), rnd.realInRange(8, 50));
  }
  // Fibres in the paper.
  for (let i = 0; i < 260; i++) {
    const x = rnd.realInRange(-hw, hw);
    const y = rnd.realInRange(-hh, hh);
    const a = rnd.realInRange(0, Math.PI);
    const l = rnd.realInRange(3, 10);
    g.lineStyle(1, PARCHMENT_DARK, rnd.realInRange(0.12, 0.3));
    g.lineBetween(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l);
  }
  // An old cup ring.
  for (let i = 0; i < 1; i++) {
    const x = rnd.realInRange(-hw * 0.8, hw * 0.8);
    const y = rnd.realInRange(-hh * 0.7, hh * 0.7);
    const r = rnd.realInRange(30, 46);
    g.lineStyle(3, 0x9a7444, 0.08);
    g.strokeCircle(x, y, r);
    g.lineStyle(1, 0x9a7444, 0.12);
    g.strokeCircle(x + 1, y + 1, r - 2);
  }
  // Burnt, darkened edges, deepest at the corners.
  for (let i = 0; i < 18; i++) {
    const inset = i * 4;
    g.lineStyle(8, 0x7a5126, 0.07 * (1 - i / 18) ** 1.5 * 2.4);
    g.strokeRect(-hw + inset, -hh + inset, w - inset * 2, h - inset * 2);
  }
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0x6a4520, 0.05);
      g.fillCircle(sx * hw, sy * hh, 30 + i * 18);
    }
  }
}

/** The frame: a heavy rule and a fine one, with a band of alternating marks between, and knots at the corners. */
export function frame(g: G, w: number, h: number): void {
  const hw = w / 2 - 22;
  const hh = h / 2 - 22;
  g.lineStyle(3, MAP_INK, 0.9);
  g.strokeRect(-hw, -hh, hw * 2, hh * 2);
  g.lineStyle(1, MAP_INK, 0.8);
  g.strokeRect(-hw + 9, -hh + 9, hw * 2 - 18, hh * 2 - 18);
  // The band: dark and light lengths, like a chart's graticule.
  const step = 24;
  g.fillStyle(MAP_INK, 0.75);
  for (let x = -hw + 9, i = 0; x < hw - 9 - step; x += step, i++) {
    if (i % 2) continue;
    g.fillRect(x, -hh + 1.5, step, 6);
    g.fillRect(x, hh - 7.5, step, 6);
  }
  for (let y = -hh + 9, i = 0; y < hh - 9 - step; y += step, i++) {
    if (i % 2) continue;
    g.fillRect(-hw + 1.5, y, 6, step);
    g.fillRect(hw - 7.5, y, 6, step);
  }
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = sx * (hw - 4.5);
    const cy = sy * (hh - 4.5);
    g.fillStyle(PARCHMENT, 1);
    g.fillCircle(cx, cy, 9);
    g.lineStyle(1.5, MAP_INK, 0.9);
    g.strokeCircle(cx, cy, 9);
    g.strokeCircle(cx, cy, 5);
    g.fillStyle(0x8e2f22, 0.9);
    g.fillCircle(cx, cy, 2.5);
  }
}

/** A soft-edged, wobbling outline round a box: where a region's colour wash goes. */
export function blob(cx: number, cy: number, hw: number, hh: number, rnd: Rnd, wobble = 0.07): Phaser.Geom.Point[] {
  const phases = [rnd.frac(), rnd.frac(), rnd.frac()].map((p) => p * Math.PI * 2);
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    // A squarish ellipse, so the wash fills its box without spilling far past it.
    const ex = Math.sign(c) * Math.abs(c) ** 0.45;
    const ey = Math.sign(s) * Math.abs(s) ** 0.45;
    const n = 1 + wobble * (Math.sin(t * 3 + phases[0]) * 0.5 + Math.sin(t * 7 + phases[1]) * 0.3 + Math.sin(t * 13 + phases[2]) * 0.2);
    pts.push(pt(cx + ex * hw * n, cy + ey * hh * n));
  }
  return pts;
}

/** A broadleaf tree: a round crown shaded on its lee side, inked round, on a short trunk. */
export function tree(g: G, x: number, y: number, s: number): void {
  g.lineStyle(Math.max(1, s * 0.18), MAP_INK, 0.9);
  g.lineBetween(x, y, x, y - s * 0.7);
  g.fillStyle(LEAF, 1);
  g.fillCircle(x, y - s * 1.15, s * 0.75);
  g.fillStyle(LEAF_DARK, 0.85);
  g.slice(x, y - s * 1.15, s * 0.75, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(120));
  g.fillPath();
  g.lineStyle(Math.max(0.8, s * 0.13), MAP_INK, 0.9);
  g.strokeCircle(x, y - s * 1.15, s * 0.75);
}

/** A fir: a tall inked triangle, dark on one side. */
export function pine(g: G, x: number, y: number, s: number): void {
  const top = y - s * 2.1;
  const half = s * 0.62;
  g.fillStyle(PINE, 1);
  g.fillTriangle(x, top, x - half, y - s * 0.35, x + half, y - s * 0.35);
  g.fillStyle(PINE_DARK, 0.9);
  g.fillTriangle(x, top, x, y - s * 0.35, x + half, y - s * 0.35);
  g.lineStyle(Math.max(0.8, s * 0.13), MAP_INK, 0.9);
  g.strokeTriangle(x, top, x - half, y - s * 0.35, x + half, y - s * 0.35);
  g.lineBetween(x, y - s * 0.35, x, y);
}

/** A rounded hill with hatching down its shaded side. */
export function hill(g: G, x: number, y: number, s: number): void {
  const w = s * 1.6;
  g.fillStyle(0xcdb98a, 0.9);
  g.beginPath();
  g.arc(x, y, w, Math.PI, 0, false);
  g.closePath();
  g.fillPath();
  g.lineStyle(Math.max(1, s * 0.16), MAP_INK, 0.9);
  g.beginPath();
  g.arc(x, y, w, Math.PI * 1.02, -0.02, false);
  g.strokePath();
  g.lineStyle(Math.max(0.7, s * 0.09), MAP_INK, 0.6);
  for (let i = 1; i <= 4; i++) {
    const a = -Math.PI / 2 + i * 0.32;
    g.lineBetween(x + Math.cos(a) * w, y + Math.sin(a) * w, x + Math.cos(a) * w * 0.55, y + Math.sin(a) * w * 0.55 + s * 0.2);
  }
}

/** A few blades of grass. */
export function tuft(g: G, x: number, y: number, s: number): void {
  g.lineStyle(Math.max(0.7, s * 0.12), MAP_INK, 0.45);
  g.lineBetween(x - s * 0.35, y, x - s * 0.5, y - s * 0.6);
  g.lineBetween(x, y, x, y - s * 0.75);
  g.lineBetween(x + s * 0.35, y, x + s * 0.5, y - s * 0.6);
}

/** Water: overlapping pools of colour inked round the outside, so neighbouring patches merge into one shore. */
export function water(g: G, cells: Array<{ x: number; y: number }>, r: number, rnd: Rnd): void {
  g.fillStyle(MAP_INK, 0.85);
  for (const c of cells) g.fillCircle(c.x, c.y, r + 1.3);
  g.fillStyle(WATER, 1);
  for (const c of cells) g.fillCircle(c.x, c.y, r);
  g.fillStyle(WATER_DEEP, 0.5);
  for (const c of cells) g.fillCircle(c.x, c.y, r * 0.55);
  // Ripples.
  g.lineStyle(1, 0x4f6f6c, 0.55);
  for (const c of cells) {
    if (rnd.frac() > 0.45) continue;
    const x = c.x + rnd.realInRange(-r * 0.4, r * 0.4);
    const y = c.y + rnd.realInRange(-r * 0.4, r * 0.4);
    g.lineBetween(x - r * 0.4, y, x + r * 0.4, y);
    g.lineBetween(x - r * 0.15, y + 2.5, x + r * 0.25, y + 2.5);
  }
}

/** A road: a dashed brown track, a little wavering. Returns the curve it drew. */
export function road(g: G, points: Array<{ x: number; y: number }>, width = 1.8, dashed = false): Array<{ x: number; y: number }> {
  if (points.length < 2) return points;
  // A smooth curve through the points (Catmull-Rom), in short steps.
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const steps = Math.max(2, Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 4));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  pts.push(points[points.length - 1]);
  g.lineStyle(width, ROAD, 0.95);
  for (let i = 1; i < pts.length; i++) {
    if (dashed && i % 2) continue;
    g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  }
  return pts;
}

/** Paving: a pale stone patch, flagged with a faint grid. */
export function paving(g: G, x: number, y: number, w: number, h: number): void {
  // A hair bigger than its cell, so neighbouring patches run together into one square.
  g.fillStyle(STONE, 0.6);
  g.fillRect(x - w / 2 - 0.5, y - h / 2 - 0.5, w + 1, h + 1);
}

/** A mountain: a jagged peak, lit on the west and hatched down its shaded east face. */
export function mountain(g: G, x: number, y: number, s: number, rnd: Rnd): void {
  const w = s * rnd.realInRange(1.1, 1.5);
  const h = s * rnd.realInRange(1.3, 1.8);
  const px = x + rnd.realInRange(-0.15, 0.15) * w;
  const top = y - h;
  // A shoulder partway down the west side, so no two peaks are the same.
  const sx = x - w * 0.55;
  const sy = y - h * rnd.realInRange(0.35, 0.5);
  g.fillStyle(0xe2d2a8, 1);
  g.fillTriangle(x - w, y, px, top, x + w, y);
  g.fillStyle(0xb39a6c, 0.95);
  g.fillTriangle(px, top, x + w, y, px + w * 0.1, y);
  g.lineStyle(Math.max(0.6, s * 0.07), MAP_INK, 0.55);
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const ax = px + (x + w - px) * t;
    const ay = top + (y - top) * t;
    g.lineBetween(ax, ay, ax - w * 0.18, ay + h * 0.22 * (1 - t) + s * 0.15);
  }
  g.lineStyle(Math.max(0.9, s * 0.12), MAP_INK, 0.92);
  g.beginPath();
  g.moveTo(x - w, y);
  g.lineTo(sx, sy);
  g.lineTo(sx + w * 0.12, sy + h * 0.06);
  g.lineTo(px, top);
  g.lineTo(x + w, y);
  g.strokePath();
  // The ridge line down from the peak.
  g.lineStyle(Math.max(0.6, s * 0.08), MAP_INK, 0.7);
  g.lineBetween(px, top, px + w * 0.1, y - h * 0.15);
}

/** Tilled ground: a little patchwork of furrowed plots. */
export function field(g: G, x: number, y: number, s: number, rnd: Rnd): void {
  g.fillStyle(rnd.frac() < 0.5 ? 0xb9a46a : 0xa7b06a, 0.7);
  g.fillRect(x - s / 2, y - s / 2, s, s);
  g.lineStyle(0.8, MAP_INK, 0.45);
  for (let i = 1; i < 4; i++) g.lineBetween(x - s / 2, y - s / 2 + (s * i) / 4, x + s / 2, y - s / 2 + (s * i) / 4);
  g.strokeRect(x - s / 2, y - s / 2, s, s);
}

/** A stretch of wall: a thick stone line with merlons along it. */
export function wall(g: G, ax: number, ay: number, bx: number, by: number): void {
  g.lineStyle(3.2, MAP_INK, 0.9);
  g.lineBetween(ax, ay, bx, by);
  g.lineStyle(1.8, STONE, 1);
  g.lineBetween(ax, ay, bx, by);
}

/** A house, its roof red-tiled or slate, as a little front-on picture. */
export function house(g: G, x: number, y: number, s: number, slate = false): void {
  const w = s * 1.1;
  const h = s * 0.7;
  g.fillStyle(WALL, 1);
  g.fillRect(x - w / 2, y - h, w, h);
  g.fillStyle(slate ? ROOF_SLATE : ROOF, 1);
  g.fillTriangle(x - w / 2 - s * 0.12, y - h, x + w / 2 + s * 0.12, y - h, x, y - h - s * 0.6);
  g.lineStyle(Math.max(0.8, s * 0.1), MAP_INK, 0.95);
  g.strokeRect(x - w / 2, y - h, w, h);
  g.strokeTriangle(x - w / 2 - s * 0.12, y - h, x + w / 2 + s * 0.12, y - h, x, y - h - s * 0.6);
  g.fillStyle(MAP_INK, 0.9);
  g.fillRect(x - s * 0.1, y - h * 0.55, s * 0.2, h * 0.55);
}

/** A cottage with a curl of smoke from its chimney. */
export function cottage(g: G, x: number, y: number, s: number): void {
  house(g, x, y, s);
  g.lineStyle(Math.max(0.8, s * 0.1), MAP_INK, 0.95);
  g.fillStyle(WALL, 1);
  g.fillRect(x + s * 0.18, y - s * 1.2, s * 0.16, s * 0.3);
  g.strokeRect(x + s * 0.18, y - s * 1.2, s * 0.16, s * 0.3);
  g.lineStyle(Math.max(0.6, s * 0.07), MAP_INK, 0.45);
  g.beginPath();
  g.arc(x + s * 0.4, y - s * 1.45, s * 0.18, Math.PI * 0.8, Math.PI * 1.9);
  g.strokePath();
  g.beginPath();
  g.arc(x + s * 0.55, y - s * 1.75, s * 0.15, Math.PI * 0.8, Math.PI * 1.9);
  g.strokePath();
}

/** An inn: a bigger house with a hanging sign. */
export function inn(g: G, x: number, y: number, s: number): void {
  house(g, x, y, s * 1.3);
  g.lineStyle(Math.max(0.8, s * 0.1), MAP_INK, 0.95);
  g.lineBetween(x + s * 0.72, y - s * 0.7, x + s * 1.05, y - s * 0.7);
  g.fillStyle(0xc9a14a, 1);
  g.fillRect(x + s * 0.9, y - s * 0.66, s * 0.26, s * 0.22);
  g.strokeRect(x + s * 0.9, y - s * 0.66, s * 0.26, s * 0.22);
}

/** A chapel: a steep-roofed nave with a spire and a cross. */
export function church(g: G, x: number, y: number, s: number): void {
  house(g, x - s * 0.3, y, s * 1.2, true);
  const tx = x + s * 0.55;
  g.fillStyle(STONE, 1);
  g.fillRect(tx - s * 0.22, y - s * 1.3, s * 0.44, s * 1.3);
  g.fillStyle(ROOF_SLATE, 1);
  g.fillTriangle(tx - s * 0.3, y - s * 1.3, tx + s * 0.3, y - s * 1.3, tx, y - s * 2.2);
  g.lineStyle(Math.max(0.8, s * 0.1), MAP_INK, 0.95);
  g.strokeRect(tx - s * 0.22, y - s * 1.3, s * 0.44, s * 1.3);
  g.strokeTriangle(tx - s * 0.3, y - s * 1.3, tx + s * 0.3, y - s * 1.3, tx, y - s * 2.2);
  g.lineBetween(tx, y - s * 2.2, tx, y - s * 2.55);
  g.lineBetween(tx - s * 0.1, y - s * 2.42, tx + s * 0.1, y - s * 2.42);
}

/** A long hall (a dorter, a refectory): a low, wide building. */
export function hall(g: G, x: number, y: number, s: number): void {
  const w = s * 2;
  const h = s * 0.6;
  g.fillStyle(STONE, 1);
  g.fillRect(x - w / 2, y - h, w, h);
  g.fillStyle(ROOF_SLATE, 1);
  g.fillRect(x - w / 2 - s * 0.08, y - h - s * 0.35, w + s * 0.16, s * 0.35);
  g.lineStyle(Math.max(0.8, s * 0.1), MAP_INK, 0.95);
  g.strokeRect(x - w / 2, y - h, w, h);
  g.strokeRect(x - w / 2 - s * 0.08, y - h - s * 0.35, w + s * 0.16, s * 0.35);
  g.fillStyle(MAP_INK, 0.8);
  for (let i = -2; i <= 2; i++) g.fillRect(x + i * s * 0.35 - s * 0.05, y - h * 0.7, s * 0.1, h * 0.35);
}

/** A tower with battlements. */
export function tower(g: G, x: number, y: number, s: number, ruined = false): void {
  const w = s * 0.6;
  const h = s * 1.7;
  g.fillStyle(STONE, 1);
  g.fillRect(x - w / 2, y - h, w, h);
  g.lineStyle(Math.max(0.8, s * 0.1), MAP_INK, 0.95);
  g.strokeRect(x - w / 2, y - h, w, h);
  const m = w / 5;
  g.fillStyle(STONE, 1);
  for (let i = 0; i < 5; i += 2) {
    if (ruined && i === 4) continue;
    g.fillRect(x - w / 2 + i * m, y - h - m, m, m);
    g.strokeRect(x - w / 2 + i * m, y - h - m, m, m);
  }
  g.fillStyle(MAP_INK, 0.9);
  g.fillRect(x - s * 0.06, y - h * 0.7, s * 0.12, s * 0.25);
  if (ruined) {
    g.lineStyle(Math.max(0.6, s * 0.07), MAP_INK, 0.8);
    g.lineBetween(x + w / 2, y - h * 0.8, x + w * 0.15, y - h * 0.55);
  }
}

/** A cave: a hill with a dark mouth in it. */
export function cave(g: G, x: number, y: number, s: number): void {
  hill(g, x, y, s * 1.2);
  g.fillStyle(0x1e140c, 1);
  g.beginPath();
  g.arc(x - s * 0.2, y, s * 0.55, Math.PI, 0, false);
  g.closePath();
  g.fillPath();
}

/** A great willow, its branches hanging down. */
export function willow(g: G, x: number, y: number, s: number): void {
  g.lineStyle(Math.max(1, s * 0.16), MAP_INK, 0.9);
  g.lineBetween(x, y, x, y - s);
  g.fillStyle(0x93a35e, 1);
  g.fillEllipse(x, y - s * 1.3, s * 1.9, s * 1.2);
  g.lineStyle(Math.max(0.8, s * 0.1), MAP_INK, 0.9);
  g.strokeEllipse(x, y - s * 1.3, s * 1.9, s * 1.2);
  g.lineStyle(Math.max(0.6, s * 0.08), LEAF_DARK, 0.9);
  for (let i = -3; i <= 3; i++) g.lineBetween(x + i * s * 0.25, y - s * 1.0, x + i * s * 0.28, y - s * 0.35);
}

/** A gate in a palisade: two posts and a bar. */
export function gate(g: G, x: number, y: number, s: number): void {
  g.lineStyle(Math.max(1, s * 0.18), MAP_INK, 0.95);
  g.lineBetween(x - s * 0.5, y, x - s * 0.5, y - s);
  g.lineBetween(x + s * 0.5, y, x + s * 0.5, y - s);
  g.lineBetween(x - s * 0.65, y - s * 0.85, x + s * 0.65, y - s * 0.85);
  g.fillStyle(0x8e2f22, 1);
  g.fillTriangle(x - s * 0.5, y - s, x - s * 0.5, y - s * 1.45, x - s * 0.15, y - s * 1.3);
}

/** A well: a little round wall with a roof over it. */
export function well(g: G, x: number, y: number, s: number): void {
  g.fillStyle(STONE, 1);
  g.fillEllipse(x, y - s * 0.2, s * 0.9, s * 0.45);
  g.lineStyle(Math.max(0.8, s * 0.1), MAP_INK, 0.9);
  g.strokeEllipse(x, y - s * 0.2, s * 0.9, s * 0.45);
  g.lineBetween(x - s * 0.35, y - s * 0.2, x - s * 0.35, y - s * 0.8);
  g.lineBetween(x + s * 0.35, y - s * 0.2, x + s * 0.35, y - s * 0.8);
  g.fillStyle(ROOF, 1);
  g.fillTriangle(x - s * 0.5, y - s * 0.8, x + s * 0.5, y - s * 0.8, x, y - s * 1.15);
}

/**
 * The compass rose: eight points, light and dark halves, rings, and a fleur
 * of a point for north at the top.
 */
export function compassRose(g: G, x: number, y: number, r: number): void {
  g.lineStyle(1, MAP_INK, 0.8);
  g.strokeCircle(x, y, r * 0.78);
  g.strokeCircle(x, y, r * 0.72);
  g.lineStyle(0.6, MAP_INK, 0.5);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    g.lineBetween(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72, x + Math.cos(a) * r * (i % 4 ? 0.76 : 0.82), y + Math.sin(a) * r * (i % 4 ? 0.76 : 0.82));
  }
  const star = (len: number, width: number, offset: number, dark: number, light: number) => {
    for (let i = 0; i < 4; i++) {
      const a = offset + (i * Math.PI) / 2 - Math.PI / 2;
      const tip = { x: x + Math.cos(a) * len, y: y + Math.sin(a) * len };
      const l = { x: x + Math.cos(a - Math.PI / 2) * width, y: y + Math.sin(a - Math.PI / 2) * width };
      const rr = { x: x + Math.cos(a + Math.PI / 2) * width, y: y + Math.sin(a + Math.PI / 2) * width };
      g.fillStyle(light, 1);
      g.fillTriangle(tip.x, tip.y, l.x, l.y, x, y);
      g.fillStyle(i === 0 && offset === 0 ? 0x8e2f22 : dark, 1);
      g.fillTriangle(tip.x, tip.y, rr.x, rr.y, x, y);
      g.lineStyle(0.8, MAP_INK, 0.9);
      g.strokeTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y);
    }
  };
  star(r * 0.62, r * 0.12, Math.PI / 4, 0x6e5a3e, 0xe8d6ab);
  star(r, r * 0.17, 0, MAP_INK, 0xf1e4c4);
  g.fillStyle(0xc9a14a, 1);
  g.fillCircle(x, y, r * 0.07);
  g.lineStyle(0.8, MAP_INK, 1);
  g.strokeCircle(x, y, r * 0.07);
}

/** A ribbon banner for the title, its tails folded back behind. */
export function banner(g: G, x: number, y: number, w: number, h: number): void {
  const tail = h * 1.1;
  const drop = h * 0.35;
  for (const side of [-1, 1]) {
    const ex = x + side * (w / 2);
    const pts = [pt(ex - side * h * 0.4, y - h / 2 + drop), pt(ex + side * tail, y - h / 2 + drop), pt(ex + side * tail * 0.7, y + drop), pt(ex + side * tail, y + h / 2 + drop), pt(ex - side * h * 0.4, y + h / 2 + drop)];
    g.fillStyle(0xc9b082, 1);
    g.fillPoints(pts, true);
    g.lineStyle(1.4, MAP_INK, 0.9);
    g.strokePoints(pts, true);
  }
  g.fillStyle(0xeee0bd, 1);
  g.fillRect(x - w / 2, y - h / 2, w, h);
  g.lineStyle(1.6, MAP_INK, 0.95);
  g.strokeRect(x - w / 2, y - h / 2, w, h);
  g.lineStyle(0.8, MAP_INK, 0.6);
  g.strokeRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8);
}

/** The scale of leagues: a bar of alternating lengths. */
export function scaleBar(g: G, x: number, y: number, unit: number, parts: number): void {
  for (let i = 0; i < parts; i++) {
    g.fillStyle(i % 2 ? PARCHMENT : MAP_INK, 1);
    g.fillRect(x + i * unit, y, unit, 5);
  }
  g.lineStyle(1, MAP_INK, 1);
  g.strokeRect(x, y, unit * parts, 5);
}
