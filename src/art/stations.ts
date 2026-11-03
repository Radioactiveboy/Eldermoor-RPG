import Phaser from 'phaser';

/**
 * The brewing still and the cooking pot shown in the station window
 * (scenes/StationScene.ts), painted like the item icons (art/items.ts): canvas
 * gradients, a dark ink outline, hammered and riveted metal, glints of light.
 *
 * Each station is painted in layers so the moving parts can go in between:
 *
 *   still:   'stn-still' (brazier, copper pot, swan-neck pipe, empty flask)
 *            then the liquid (drawn by the scene), then 'stn-flask-shine'.
 *   hearth:  'stn-hearth-back' (back stones and logs), the flames
 *            ('stn-flame-<0..2>', tweened by the scene), 'stn-cauldron'
 *            (tripod, chain and pot), then 'stn-hearth-front' (front stones).
 *
 * Every layer is painted on the same STATION_W x STATION_H canvas, at
 * STATION_RES times the size it's shown, and centred on the same point, so
 * the scene places them all at one spot with origin 0.5 and scale
 * 1 / STATION_RES. STATION_POINTS says where things are (the pot's mouth, the
 * flask, where the flames stand) relative to that centre.
 */
export const STATION_W = 320;
export const STATION_H = 280;
export const STATION_RES = 2;

/** Points on the paintings, relative to their centre, in shown pixels. */
export const STATION_POINTS = {
  /** The copper pot's open mouth, and its size. */
  stillMouth: { x: -40, y: -60, rx: 21, ry: 6 },
  /** The middle of the round receiving flask, and its radius inside the glass. */
  flask: { x: 80, y: 52, r: 27 },
  /** Where drips leave the pipe, over the flask's neck. */
  drip: { x: 80, y: -2 },
  /** The coals in the brazier. */
  coals: { x: -40, y: 66 },
  /** The cauldron's mouth. */
  potMouth: { x: 0, y: -24, rx: 58, ry: 12 },
  /** Bases of the flames, along the logs. */
  flames: [-46, -24, 0, 22, 44].map((x, i) => ({ x, y: 78 - (i % 2) * 4 })),
};

type Ctx = CanvasRenderingContext2D;
type Stops = Array<[number, string]>;

const INK = '#1a0f08';
/** Painting coordinates are in shown pixels, with (0, 0) at the canvas's centre. */
const CX = STATION_W / 2;
const CY = STATION_H / 2;

function lin(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Stops): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

function rad(c: Ctx, x: number, y: number, r: number, stops: Stops, x1 = x, y1 = y): CanvasGradient {
  const g = c.createRadialGradient(x, y, 0, x1, y1, r);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

function ink(c: Ctx, width = 3): void {
  c.strokeStyle = INK;
  c.lineWidth = width;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.stroke();
}

function fillInk(c: Ctx, fill: string | CanvasGradient, width = 3): void {
  c.fillStyle = fill;
  c.fill();
  ink(c, width);
}

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function shine(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0, alpha = 0.55): void {
  c.save();
  ellipse(c, x, y, rx, ry, rot);
  c.fillStyle = rad(c, x, y, Math.max(rx, ry), [
    [0, `rgba(255,255,255,${alpha})`],
    [1, 'rgba(255,255,255,0)'],
  ]);
  c.fill();
  c.restore();
}

function drop(c: Ctx, draw: () => void, blur = 10, dy = 6): void {
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.6)';
  c.shadowBlur = blur;
  c.shadowOffsetY = dy;
  draw();
  c.restore();
}

function clipped(c: Ctx, draw: () => void): void {
  c.save();
  c.clip();
  draw();
  c.restore();
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Little dents and dapples across a clipped area: hammered metal. */
function hammered(c: Ctx, x: number, y: number, w: number, h: number, seed: number, light: string, dark: string): void {
  const r = rng(seed);
  for (let i = 0; i < 90; i++) {
    const px = x + r() * w;
    const py = y + r() * h;
    const s = 2 + r() * 4;
    ellipse(c, px, py, s, s * 0.7, r() * Math.PI);
    c.fillStyle = r() < 0.5 ? light : dark;
    c.fill();
  }
}

/** A row of rivet heads along a curve: each a dark dot with a lit top. */
function rivets(c: Ctx, pts: Array<[number, number]>, r = 2.6): void {
  for (const [x, y] of pts) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = '#5a2e12';
    c.fill();
    c.beginPath();
    c.arc(x - r * 0.3, y - r * 0.35, r * 0.5, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,220,170,0.8)';
    c.fill();
  }
}

/** Points along the lower half of an ellipse, for rivets round a band. */
function arcPoints(x: number, y: number, rx: number, ry: number, n: number, from = 0.05, to = 0.95): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (from + ((to - from) * i) / (n - 1));
    out.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
  }
  return out;
}

const COPPER: Stops = [
  [0, '#f6c08a'],
  [0.25, '#e0904e'],
  [0.6, '#b0602a'],
  [1, '#5a2a10'],
];

const IRON: Stops = [
  [0, '#7a7a86'],
  [0.35, '#4a4a56'],
  [1, '#16141a'],
];

// ------------------------------------------------------------ the still

/** The brazier, the copper pot over it, its swan-neck pipe and the receiving flask on its stand. */
function paintStill(c: Ctx): void {
  const px = -40;
  const py = 10;
  // The brazier's three legs and its iron bowl.
  c.lineCap = 'round';
  for (const [x0, x1] of [
    [-86, -96],
    [6, 16],
    [-40, -40],
  ]) {
    c.beginPath();
    c.moveTo(x0, 82);
    c.lineTo(x1, 124);
    c.strokeStyle = INK;
    c.lineWidth = 8;
    c.stroke();
    c.strokeStyle = '#4a4a56';
    c.lineWidth = 4;
    c.stroke();
  }
  drop(c, () => {
    c.beginPath();
    c.moveTo(-96, 62);
    c.lineTo(16, 62);
    c.quadraticCurveTo(12, 92, -40, 94);
    c.quadraticCurveTo(-92, 92, -96, 62);
    c.closePath();
    c.fillStyle = '#2a2a30';
    c.fill();
  });
  c.beginPath();
  c.moveTo(-96, 62);
  c.lineTo(16, 62);
  c.quadraticCurveTo(12, 92, -40, 94);
  c.quadraticCurveTo(-92, 92, -96, 62);
  c.closePath();
  fillInk(c, lin(c, -96, 0, 16, 0, [
    [0, '#2a2a32'],
    [0.35, '#6a6a76'],
    [1, '#1a1a20'],
  ]));
  // Its slatted sides glowing from within.
  for (let i = 0; i < 6; i++) {
    const x = -82 + i * 17;
    c.beginPath();
    c.moveTo(x, 68);
    c.lineTo(x + 2, 84);
    c.strokeStyle = 'rgba(255,140,50,0.85)';
    c.lineWidth = 3;
    c.stroke();
  }
  // The heap of coals.
  const r = rng(5);
  for (let i = 0; i < 18; i++) {
    const x = -88 + r() * 96;
    const y = 58 + r() * 6;
    ellipse(c, x, y, 7 + r() * 4, 5 + r() * 2);
    c.fillStyle = rad(c, x - 2, y - 2, 10, [
      [0, '#fff0a0'],
      [0.35, '#ff9a30'],
      [1, '#7a1a08'],
    ]);
    c.fill();
    ink(c, 1.5);
  }
  ellipse(c, -40, 62, 58, 8);
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.stroke();

  // The receiving flask's wooden ring stand.
  const fx = STATION_POINTS.flask.x;
  const fy = STATION_POINTS.flask.y;
  for (const dx of [-20, 20]) {
    c.beginPath();
    c.moveTo(fx + dx, fy + 22);
    c.lineTo(fx + dx * 1.3, fy + 66);
    c.strokeStyle = INK;
    c.lineWidth = 8;
    c.stroke();
    c.strokeStyle = '#7d5434';
    c.lineWidth = 4;
    c.stroke();
  }
  ellipse(c, fx, fy + 24, 26, 6);
  fillInk(c, lin(c, fx - 26, 0, fx + 26, 0, [
    [0, '#4a2c18'],
    [0.4, '#9a6a3c'],
    [1, '#3b2618'],
  ]), 2.5);

  // The copper pot: a fat round belly with a band of riveted copper round the middle.
  const belly = (): void => {
    c.beginPath();
    c.moveTo(px - 20, py - 44);
    c.bezierCurveTo(px - 74, py - 36, px - 78, py + 40, px - 40, py + 52);
    c.quadraticCurveTo(px, py + 60, px + 40, py + 52);
    c.bezierCurveTo(px + 78, py + 40, px + 74, py - 36, px + 20, py - 44);
    c.closePath();
  };
  belly();
  drop(c, () => {
    c.fillStyle = '#6a3014';
    c.fill();
  });
  belly();
  clipped(c, () => {
    c.fillStyle = rad(c, px - 22, py - 14, 86, COPPER, px - 4, py + 6);
    c.fillRect(px - 90, py - 60, 180, 130);
    hammered(c, px - 76, py - 46, 152, 104, 11, 'rgba(255,210,160,0.18)', 'rgba(90,40,10,0.18)');
    // The flame's glow on the underside.
    c.fillStyle = rad(c, px, py + 60, 60, [
      [0, 'rgba(255,140,40,0.55)'],
      [1, 'rgba(255,140,40,0)'],
    ]);
    c.fillRect(px - 90, py - 60, 180, 130);
    // The riveted band.
    c.beginPath();
    c.ellipse(px, py + 2, 80, 20, 0, 0, Math.PI);
    c.lineWidth = 9;
    c.strokeStyle = '#8a4418';
    c.stroke();
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(255,200,150,0.6)';
    c.beginPath();
    c.ellipse(px, py - 2, 80, 20, 0, 0.05, Math.PI - 0.05);
    c.stroke();
  });
  rivets(c, arcPoints(px, py + 2, 62, 19, 8, 0.14, 0.86));
  belly();
  ink(c, 3.5);
  shine(c, px - 32, py - 14, 13, 24, 0.35, 0.65);
  shine(c, px + 36, py + 18, 5, 10, -0.4, 0.3);

  // The neck, and the lip round the mouth.
  const m = STATION_POINTS.stillMouth;
  c.beginPath();
  c.moveTo(m.x - 18, m.y + 2);
  c.lineTo(px - 20, py - 42);
  c.lineTo(px + 20, py - 42);
  c.lineTo(m.x + 18, m.y + 2);
  c.closePath();
  fillInk(c, lin(c, m.x - 20, 0, m.x + 20, 0, [
    [0, '#7a3a14'],
    [0.3, '#f0a868'],
    [0.6, '#c06e34'],
    [1, '#5a2a10'],
  ]));
  ellipse(c, m.x, m.y, m.rx + 5, m.ry + 3);
  fillInk(c, lin(c, m.x - 26, 0, m.x + 26, 0, [
    [0, '#8a4418'],
    [0.35, '#ffd0a0'],
    [1, '#6a3014'],
  ]));
  // The dark inside of the mouth (the scene pours the liquid in over it).
  ellipse(c, m.x, m.y, m.rx, m.ry);
  c.fillStyle = '#1a0c06';
  c.fill();

  // The swan-neck pipe from the neck over to the flask, with a joint collar.
  const pipe = (): void => {
    c.beginPath();
    c.moveTo(m.x + 16, m.y + 16);
    c.bezierCurveTo(m.x + 60, m.y - 4, 60, -90, 80, -40);
    c.lineTo(STATION_POINTS.drip.x, STATION_POINTS.drip.y);
  };
  pipe();
  c.strokeStyle = INK;
  c.lineWidth = 13;
  c.stroke();
  pipe();
  c.strokeStyle = '#b0602a';
  c.lineWidth = 8;
  c.stroke();
  pipe();
  c.strokeStyle = 'rgba(255,210,160,0.7)';
  c.lineWidth = 2.5;
  c.stroke();
  for (const [x, y] of [
    [m.x + 18, m.y + 15],
    [80, -16],
  ]) {
    ellipse(c, x, y, 8, 5);
    fillInk(c, '#d88a4a', 2);
  }

  paintFlaskGlass(c, false);
}

/** The flask's glass: the empty bulb (under the liquid), or just its gleams (over it). */
function paintFlaskGlass(c: Ctx, gleamsOnly: boolean): void {
  const { x, y, r } = STATION_POINTS.flask;
  const outline = (): void => {
    c.beginPath();
    c.moveTo(x - 8, y - r - 30);
    c.lineTo(x - 8, y - r + 2);
    c.arc(x, y, r + 3, -Math.PI / 2 - 0.28, Math.PI * 1.5 + 0.28, true);
    c.lineTo(x + 8, y - r - 30);
    c.closePath();
  };
  if (!gleamsOnly) {
    outline();
    c.fillStyle = 'rgba(150,200,220,0.22)';
    c.fill();
    ink(c, 3);
    ellipse(c, x, y - r - 30, 10, 3.5);
    fillInk(c, 'rgba(190,230,240,0.6)', 2);
    return;
  }
  shine(c, x - 12, y - 8, 6, 13, 0.4, 0.75);
  shine(c, x + 14, y + 12, 3, 6, -0.4, 0.4);
  c.beginPath();
  c.moveTo(x - 4, y - r - 26);
  c.lineTo(x - 4, y - r);
  c.strokeStyle = 'rgba(255,255,255,0.45)';
  c.lineWidth = 2;
  c.stroke();
}

// ------------------------------------------------------------ the hearth

/** Rounded fieldstones in a ring: the back half or the front half. */
function stones(c: Ctx, front: boolean): void {
  const r = rng(front ? 41 : 17);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = front ? Math.PI * (0.05 + (0.9 * i) / (n - 1)) : Math.PI * (1.08 + (0.84 * i) / (n - 1));
    const x = Math.cos(a) * 96 + (r() - 0.5) * 6;
    const y = 92 + Math.sin(a) * 26;
    const w = 15 + r() * 6;
    const h = 11 + r() * 4;
    drop(c, () => {
      ellipse(c, x, y, w, h, (r() - 0.5) * 0.5);
      c.fillStyle = '#3a3840';
      c.fill();
    }, 6, 3);
    ellipse(c, x, y, w, h);
    fillInk(c, rad(c, x - w * 0.3, y - h * 0.4, w * 1.3, [
      [0, front ? '#9a96a0' : '#7a7884'],
      [0.6, front ? '#625e6a' : '#4a4854'],
      [1, '#34323c'],
    ]), 2.5);
    if (front) {
      // Firelight on the stones facing the fire.
      ellipse(c, x, y - h * 0.4, w * 0.8, h * 0.45);
      c.fillStyle = 'rgba(255,140,50,0.35)';
      c.fill();
    } else {
      shine(c, x - w * 0.3, y - h * 0.35, w * 0.35, h * 0.25, 0, 0.3);
    }
  }
}

/** The back of the hearth: the far stones, a bed of embers, and two crossed logs. */
function paintHearthBack(c: Ctx): void {
  stones(c, false);
  ellipse(c, 0, 94, 84, 20);
  c.fillStyle = rad(c, 0, 94, 84, [
    [0, '#ffcf60'],
    [0.35, '#e0582a'],
    [0.8, '#4a1a0e'],
    [1, '#1a0c08'],
  ]);
  c.fill();
  for (const [x0, y0, x1, y1] of [
    [-74, 100, 60, 80],
    [-60, 80, 74, 100],
  ]) {
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.strokeStyle = INK;
    c.lineWidth = 20;
    c.lineCap = 'round';
    c.stroke();
    c.strokeStyle = lin(c, 0, y0 - 10, 0, y0 + 10, [
      [0, '#93693f'],
      [0.5, '#5c3b23'],
      [1, '#2a1a10'],
    ]);
    c.lineWidth = 14;
    c.stroke();
    // Bark lines, and the charred, glowing undersides.
    c.strokeStyle = 'rgba(30,16,8,0.6)';
    c.lineWidth = 1.5;
    for (let t = 0.15; t < 0.9; t += 0.18) {
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      c.beginPath();
      c.moveTo(x - 4, y - 5);
      c.lineTo(x + 4, y + 5);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(x0 + 6, y0 + 5);
    c.lineTo(x1 - 6, y1 + 5);
    c.strokeStyle = 'rgba(255,120,40,0.7)';
    c.lineWidth = 3;
    c.stroke();
    // The cut ends.
    for (const [x, y] of [
      [x0, y0],
      [x1, y1],
    ]) {
      ellipse(c, x, y, 6, 9);
      fillInk(c, rad(c, x, y, 9, [
        [0, '#d8b07a'],
        [0.6, '#a57b4b'],
        [1, '#5c3b23'],
      ]), 2);
    }
  }
}

/** One tongue of flame, frame `f` of three: a teardrop of white-yellow fading to red, painted at the canvas's centre. */
function paintFlame(c: Ctx, f: number): void {
  const lean = [-6, 0, 6][f];
  const h = [58, 66, 54][f];
  const x = 0;
  const y = 40;
  const tongue = (scale: number): void => {
    c.beginPath();
    c.moveTo(x - 16 * scale, y);
    c.bezierCurveTo(x - 20 * scale, y - h * 0.45 * scale, x + lean * scale - 6, y - h * 0.7 * scale, x + lean * scale, y - h * scale);
    c.bezierCurveTo(x + lean * scale + 6, y - h * 0.65 * scale, x + 20 * scale, y - h * 0.4 * scale, x + 16 * scale, y);
    c.quadraticCurveTo(x, y + 8 * scale, x - 16 * scale, y);
    c.closePath();
  };
  c.save();
  c.shadowColor = 'rgba(255,140,40,0.9)';
  c.shadowBlur = 16;
  tongue(1);
  c.fillStyle = lin(c, 0, y, 0, y - h, [
    [0, '#e8401a'],
    [0.5, '#f07a20'],
    [1, 'rgba(240,90,30,0.2)'],
  ]);
  c.fill();
  c.restore();
  tongue(0.72);
  c.fillStyle = lin(c, 0, y, 0, y - h * 0.72, [
    [0, '#ffb030'],
    [1, 'rgba(255,200,60,0.3)'],
  ]);
  c.fill();
  tongue(0.4);
  c.fillStyle = lin(c, 0, y, 0, y - h * 0.4, [
    [0, '#fffbe0'],
    [1, 'rgba(255,240,160,0.4)'],
  ]);
  c.fill();
}

/** The iron tripod with its chain, and the black cauldron hanging from it. */
function paintCauldron(c: Ctx): void {
  const m = STATION_POINTS.potMouth;
  // Tripod legs, the back one first.
  const leg = (x0: number, y0: number): void => {
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(0, -116);
    c.strokeStyle = INK;
    c.lineWidth = 9;
    c.lineCap = 'round';
    c.stroke();
    c.strokeStyle = lin(c, x0, 0, x0 + 6, 0, [
      [0, '#6a6a76'],
      [1, '#2a2a32'],
    ]);
    c.lineWidth = 5;
    c.stroke();
  };
  leg(6, 70);
  leg(-104, 118);
  leg(104, 118);
  ellipse(c, 0, -116, 7, 5);
  fillInk(c, '#4a4a56', 2);
  // The chain: links down to the hook.
  for (let i = 0; i < 6; i++) {
    const y = -108 + i * 9;
    ellipse(c, 0, y, i % 2 ? 2.5 : 4, 5);
    c.strokeStyle = INK;
    c.lineWidth = 3.5;
    c.stroke();
    c.strokeStyle = i % 2 ? '#5a5a66' : '#8a8a96';
    c.lineWidth = 1.8;
    c.stroke();
  }
  // The bail handle, from ear to ear, through the hook.
  c.beginPath();
  c.moveTo(-m.rx - 4, m.y + 4);
  c.quadraticCurveTo(0, -112, m.rx + 4, m.y + 4);
  c.strokeStyle = INK;
  c.lineWidth = 7;
  c.stroke();
  c.strokeStyle = '#5a5a66';
  c.lineWidth = 3.5;
  c.stroke();

  // The pot's round black belly, a little lip, and three stubby feet.
  for (const x of [-36, 0, 36]) {
    c.beginPath();
    c.moveTo(x - 6, 52);
    c.lineTo(x - 4, 66);
    c.lineTo(x + 4, 66);
    c.lineTo(x + 6, 52);
    fillInk(c, '#2a2a32', 2.5);
  }
  const belly = (): void => {
    c.beginPath();
    c.moveTo(-m.rx - 4, m.y + 6);
    c.bezierCurveTo(-m.rx - 30, m.y + 50, -40, 64, 0, 64);
    c.bezierCurveTo(40, 64, m.rx + 30, m.y + 50, m.rx + 4, m.y + 6);
    c.closePath();
  };
  belly();
  drop(c, () => {
    c.fillStyle = '#16141a';
    c.fill();
  });
  belly();
  clipped(c, () => {
    c.fillStyle = rad(c, -30, -4, 110, IRON, -10, 10);
    c.fillRect(-110, m.y - 10, 220, 110);
    hammered(c, -96, m.y, 192, 90, 23, 'rgba(160,160,180,0.12)', 'rgba(0,0,0,0.25)');
    // Soot, and the fire's glow on the underside.
    c.fillStyle = rad(c, 0, 70, 70, [
      [0, 'rgba(255,120,40,0.5)'],
      [0.6, 'rgba(120,40,10,0.2)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    c.fillRect(-110, m.y - 10, 220, 110);
    // A cast seam round the belly.
    c.beginPath();
    c.ellipse(0, m.y + 34, m.rx + 18, 14, 0, 0, Math.PI);
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = 3;
    c.stroke();
    c.beginPath();
    c.ellipse(0, m.y + 32, m.rx + 18, 14, 0, 0.1, Math.PI - 0.1);
    c.strokeStyle = 'rgba(180,180,200,0.25)';
    c.lineWidth = 1.5;
    c.stroke();
  });
  belly();
  ink(c, 3.5);
  shine(c, -44, m.y + 26, 10, 18, 0.5, 0.35);
  // The ears the handle hooks into.
  for (const sx of [-1, 1]) {
    ellipse(c, sx * (m.rx + 4), m.y + 6, 6, 6);
    fillInk(c, '#3a3a44', 2.5);
  }
  // The thick rim, and the dark inside (the scene pours the stew in over it).
  ellipse(c, 0, m.y, m.rx + 8, m.ry + 5);
  fillInk(c, lin(c, 0, m.y - m.ry - 5, 0, m.y + m.ry + 5, [
    [0, '#9a9aa6'],
    [0.4, '#4a4a56'],
    [1, '#1a1820'],
  ]));
  ellipse(c, 0, m.y, m.rx, m.ry);
  c.fillStyle = '#0c0a0e';
  c.fill();
  shine(c, -30, m.y - m.ry - 2, 16, 2.5, 0, 0.5);
  // A wooden ladle left in the pot, its handle resting on the rim.
  c.beginPath();
  c.moveTo(18, m.y + 2);
  c.lineTo(78, m.y - 46);
  c.strokeStyle = INK;
  c.lineWidth = 9;
  c.lineCap = 'round';
  c.stroke();
  c.strokeStyle = lin(c, 18, 0, 78, 0, [
    [0, '#5c3b23'],
    [0.5, '#a57b4b'],
    [1, '#7d5434'],
  ]);
  c.lineWidth = 5;
  c.stroke();
}

/** The front of the hearth: the near stones, lit by the fire, and a few loose embers. */
function paintHearthFront(c: Ctx): void {
  stones(c, true);
  const r = rng(77);
  for (let i = 0; i < 10; i++) {
    const x = -70 + r() * 140;
    const y = 102 + r() * 10;
    c.beginPath();
    c.arc(x, y, 1.5 + r() * 2, 0, Math.PI * 2);
    c.fillStyle = r() < 0.5 ? '#ffd25a' : '#ff7a3a';
    c.fill();
  }
}

/** A soft round glow (for the coals and the fire), drawn additively by the scene. */
function paintGlow(c: Ctx): void {
  c.fillStyle = rad(c, 0, 0, 120, [
    [0, 'rgba(255,170,70,0.75)'],
    [0.4, 'rgba(255,110,40,0.3)'],
    [1, 'rgba(255,90,30,0)'],
  ]);
  c.fillRect(-CX, -CY, STATION_W, STATION_H);
}

const LAYERS: Array<[string, (c: Ctx) => void]> = [
  ['stn-still', paintStill],
  ['stn-flask-shine', (c) => paintFlaskGlass(c, true)],
  ['stn-hearth-back', paintHearthBack],
  ['stn-cauldron', paintCauldron],
  ['stn-hearth-front', paintHearthFront],
  ['stn-flame-0', (c) => paintFlame(c, 0)],
  ['stn-flame-1', (c) => paintFlame(c, 1)],
  ['stn-flame-2', (c) => paintFlame(c, 2)],
  ['stn-glow', paintGlow],
];

export function generateStationArt(scene: Phaser.Scene): void {
  for (const [key, paint] of LAYERS) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, STATION_W * STATION_RES, STATION_H * STATION_RES);
    if (!tex) continue;
    const c = tex.getContext();
    c.save();
    c.scale(STATION_RES, STATION_RES);
    c.translate(CX, CY);
    paint(c);
    c.restore();
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
