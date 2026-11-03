import Phaser from 'phaser';

/**
 * Painted icons for everything the hero can carry: food, pelts, tools, gear
 * and keepsakes. Like the combat hotbar's icons (ui/AbilityIcons.ts), each is
 * painted once with the browser's canvas, with gradients, soft shadows, a dark
 * ink outline and a few strokes of texture (fur, straw, bark, grain), into a
 * texture 'item-<name>' ICON_SIZE pixels square, and shown scaled down so the
 * edges stay smooth. The background is left clear, so the icons sit on the
 * satchel's slots, the shop's shelves and the pick-up toasts alike.
 *
 * To add an icon, add a painter to PAINTERS. Paint on a 128 square, keeping
 * the subject roughly inside 8..120 so its shadow has room.
 */
export const ICON_SIZE = 128;

/**
 * The scale that shows an icon at the size a 16-pixel icon had at scale `s`.
 * Every caller sizes icons through this, so they all stay in proportion.
 */
export function itemScale(s: number): number {
  return (s * 16) / ICON_SIZE;
}

type Ctx = CanvasRenderingContext2D;
type Stops = Array<[number, string]>;
type Pt = [number, number];

// ------------------------------------------------------------ helpers

const INK = '#1a0f08';

function lin(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Stops): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

/** A radial gradient lit from (x, y), reaching r. */
function rad(c: Ctx, x: number, y: number, r: number, stops: Stops): CanvasGradient {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

/** Stroke the current path with the dark ink outline every icon has. */
function ink(c: Ctx, width = 3.5): void {
  c.strokeStyle = INK;
  c.lineWidth = width;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.stroke();
}

/** Fill the current path, then ink it. */
function fillInk(c: Ctx, fill: string | CanvasGradient, width = 3.5): void {
  c.fillStyle = fill;
  c.fill();
  ink(c, width);
}

/** Run `draw` with a soft drop shadow under it. */
function drop(c: Ctx, draw: () => void, blur = 7, dy = 4): void {
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.6)';
  c.shadowBlur = blur;
  c.shadowOffsetY = dy;
  draw();
  c.restore();
}

/** Run `draw` with the origin moved to (x, y), turned by `angle` and scaled by `s`. */
function at(c: Ctx, x: number, y: number, angle: number, draw: () => void, s = 1): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(s, s);
  draw();
  c.restore();
}

/** Run `draw` clipped to the current path. */
function clipped(c: Ctx, draw: () => void): void {
  c.save();
  c.clip();
  draw();
  c.restore();
}

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

/** A soft white gleam: the light catching a rounded surface. */
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

/** A closed, smooth outline through `pts` (each point pulls the curve towards it). */
function smooth(c: Ctx, pts: Pt[]): void {
  const n = pts.length;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  c.beginPath();
  const start = mid(pts[n - 1], pts[0]);
  c.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    c.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  c.closePath();
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** A small seeded random generator, so texture strokes land in the same places every time. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Short wisps of steam rising from (x, y). */
function steam(c: Ctx, x: number, y: number, spread = 14): void {
  c.save();
  c.lineCap = 'round';
  for (const [dx, h, a] of [
    [-spread, 26, 0.45],
    [0, 34, 0.6],
    [spread, 24, 0.4],
  ] as Array<[number, number, number]>) {
    c.beginPath();
    c.moveTo(x + dx, y);
    c.bezierCurveTo(x + dx - 7, y - h * 0.35, x + dx + 7, y - h * 0.65, x + dx, y - h);
    c.strokeStyle = `rgba(255,250,240,${a})`;
    c.lineWidth = 4;
    c.stroke();
  }
  c.restore();
}

const STEEL: Stops = [
  [0, '#4a545e'],
  [0.35, '#dfe6ec'],
  [0.5, '#ffffff'],
  [0.65, '#aab4be'],
  [1, '#3c4650'],
];
const GOLD: Stops = [
  [0, '#6e4a12'],
  [0.4, '#f4d27a'],
  [0.55, '#fff2c0'],
  [1, '#8a5c14'],
];
const LEATHER: Stops = [
  [0, '#3a2010'],
  [0.45, '#8a5530'],
  [1, '#2e180a'],
];
const WOOD: Stops = [
  [0, '#3b2210'],
  [0.4, '#a26a38'],
  [0.6, '#b97c44'],
  [1, '#3b2210'],
];

// ------------------------------------------------------------ shared shapes

/**
 * A stretched hide: a body with four leg flaps, a neck and a tail, seen flat
 * from above. Painted with a lit middle, a darker stripe down the spine and
 * strokes of fur raying out from it.
 */
function hide(
  c: Ctx,
  o: { light: string; mid: string; dark: string; spine: string; fur: string[]; seed: number; spots?: string; glow?: string },
): void {
  const right: Pt[] = [
    [64, 10],
    [77, 16],
    [83, 29],
    [106, 21],
    [117, 33],
    [94, 47],
    [96, 76],
    [117, 95],
    [107, 108],
    [84, 97],
    [71, 104],
  ];
  const pts: Pt[] = [...right, [64, 123], ...right.slice(1).reverse().map(([x, y]): Pt => [128 - x, y])];
  const path = () => smooth(c, pts);
  drop(c, () => {
    if (o.glow) {
      c.shadowColor = o.glow;
      c.shadowBlur = 16;
      c.shadowOffsetY = 0;
    }
    path();
    c.fillStyle = o.mid;
    c.fill();
  });
  path();
  clipped(c, () => {
    c.fillStyle = rad(c, 58, 52, 72, [
      [0, o.light],
      [0.55, o.mid],
      [1, o.dark],
    ]);
    c.fillRect(0, 0, 128, 128);
    // The darker stripe of fur down the spine.
    c.fillStyle = lin(c, 44, 0, 84, 0, [
      [0, 'rgba(0,0,0,0)'],
      [0.5, o.spine],
      [1, 'rgba(0,0,0,0)'],
    ]);
    c.fillRect(44, 0, 40, 128);
    if (o.spots) {
      const r = rng(o.seed + 7);
      for (let i = 0; i < 14; i++) {
        const side = i % 2 ? 1 : -1;
        ellipse(c, 64 + side * (9 + r() * 18), 30 + r() * 66, 2.6 + r() * 1.6, 2 + r() * 1.2);
        c.fillStyle = o.spots;
        c.fill();
      }
    }
    // Fur: short strokes raying out from the spine.
    const r = rng(o.seed);
    c.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const y = 8 + r() * 116;
      const x = 14 + r() * 100;
      const dir = x < 64 ? -1 : 1;
      const len = 5 + r() * 7;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + dir * len * 0.6, y + len * 0.2, x + dir * len, y + len * 0.7);
      c.strokeStyle = o.fur[i % o.fur.length];
      c.lineWidth = 1.4 + r() * 1.2;
      c.stroke();
    }
    // Shade the rim so the hide looks thick.
    c.fillStyle = rad(c, 64, 62, 66, [
      [0.62, 'rgba(0,0,0,0)'],
      [1, 'rgba(0,0,0,0.45)'],
    ]);
    c.fillRect(0, 0, 128, 128);
  });
  path();
  ink(c, 3.5);
}

/** A wooden tankard with iron hoops and a frothing head over `drink`. */
function tankard(c: Ctx, foam: Stops, drink: string): void {
  drop(c, () => {
    roundRect(c, 26, 34, 62, 80, 8);
    c.fillStyle = '#6a4020';
    c.fill();
  });
  // The handle.
  c.beginPath();
  c.moveTo(86, 48);
  c.bezierCurveTo(116, 46, 118, 94, 86, 94);
  c.lineWidth = 15;
  c.strokeStyle = INK;
  c.lineCap = 'round';
  c.stroke();
  c.lineWidth = 9;
  c.strokeStyle = lin(c, 90, 0, 114, 0, WOOD);
  c.stroke();
  // The body, in staves.
  roundRect(c, 26, 34, 62, 80, 8);
  clipped(c, () => {
    c.fillStyle = lin(c, 26, 0, 88, 0, WOOD);
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(40,20,8,0.7)';
    c.lineWidth = 2;
    for (const x of [38, 50, 62, 74]) {
      c.beginPath();
      c.moveTo(x, 34);
      c.lineTo(x, 114);
      c.stroke();
    }
    // Grain.
    const r = rng(11);
    c.strokeStyle = 'rgba(255,220,170,0.18)';
    c.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const x = 28 + r() * 58;
      c.beginPath();
      c.moveTo(x, 40 + r() * 20);
      c.lineTo(x + r() * 2 - 1, 70 + r() * 40);
      c.stroke();
    }
    // Iron hoops.
    for (const y of [46, 98]) {
      c.fillStyle = lin(c, 0, y - 5, 0, y + 5, STEEL);
      c.fillRect(20, y - 5, 80, 10);
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.strokeRect(20, y - 5, 80, 10);
      for (const x of [32, 56, 80]) {
        c.beginPath();
        c.arc(x, y, 1.8, 0, Math.PI * 2);
        c.fillStyle = '#2a3036';
        c.fill();
      }
    }
  });
  roundRect(c, 26, 34, 62, 80, 8);
  ink(c);
  // The drink just showing, and the froth spilling over the rim.
  ellipse(c, 57, 34, 31, 7);
  c.fillStyle = drink;
  c.fill();
  c.beginPath();
  c.moveTo(22, 36);
  for (const [x, y, r] of [
    [30, 28, 11],
    [46, 22, 13],
    [64, 20, 14],
    [80, 26, 12],
    [90, 34, 8],
  ] as Array<[number, number, number]>) {
    c.arc(x, y, r, Math.PI * 0.9, Math.PI * 2.1);
  }
  c.lineTo(92, 40);
  c.bezierCurveTo(70, 44, 40, 44, 22, 40);
  c.closePath();
  fillInk(c, lin(c, 0, 8, 0, 44, foam), 3);
  // A drip running down the side.
  c.beginPath();
  c.moveTo(30, 38);
  c.quadraticCurveTo(29, 52, 32, 56);
  c.quadraticCurveTo(36, 52, 36, 40);
  fillInk(c, foam[1][1], 2.5);
  shine(c, 52, 18, 10, 4, -0.1, 0.8);
}

/** A boot seen from the side, toe to the right. */
function boot(c: Ctx, x: number, y: number, s: number, tall: boolean, body: Stops, cuff: string): void {
  at(
    c,
    x,
    y,
    0,
    () => {
      const top = tall ? -64 : -40;
      c.beginPath();
      c.moveTo(-16, top);
      c.lineTo(12, top);
      c.lineTo(12, -18);
      c.bezierCurveTo(16, -12, 34, -12, 40, -6);
      c.quadraticCurveTo(46, 0, 42, 6);
      c.lineTo(-18, 6);
      c.quadraticCurveTo(-20, -2, -18, -10);
      c.closePath();
      drop(c, () => {
        c.fillStyle = body[1][1];
        c.fill();
      });
      clipped(c, () => {
        c.fillStyle = lin(c, -20, top, 40, 6, body);
        c.fillRect(-30, top - 4, 80, 80);
        c.fillStyle = rad(c, -4, top + 20, 40, [
          [0, 'rgba(255,220,180,0.25)'],
          [1, 'rgba(0,0,0,0)'],
        ]);
        c.fillRect(-30, top - 4, 80, 80);
        // Creases at the ankle.
        c.strokeStyle = 'rgba(20,10,4,0.55)';
        c.lineWidth = 2;
        for (const dy of [-22, -16]) {
          c.beginPath();
          c.moveTo(-12, dy);
          c.quadraticCurveTo(0, dy - 4, 10, dy + 2);
          c.stroke();
        }
      });
      ink(c);
      // The sole.
      roundRect(c, -20, 1, 64, 8, 3);
      fillInk(c, '#2a1a10', 2.5);
      // A heel.
      roundRect(c, -20, 4, 16, 9, 2);
      fillInk(c, '#3a2414', 2.5);
      // The cuff, folded over.
      roundRect(c, -19, top - 4, 34, 13, 4);
      fillInk(c, cuff, 2.5);
      if (tall) {
        // A strap and brass buckle across the shin.
        c.fillStyle = '#2a160a';
        c.fillRect(-16, top + 26, 28, 6);
        roundRect(c, -2, top + 24, 10, 10, 2);
        c.strokeStyle = '#e8c060';
        c.lineWidth = 2.5;
        c.stroke();
      } else {
        // Laces up the front.
        c.strokeStyle = '#d8c090';
        c.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.moveTo(4, top + 16 + i * 8);
          c.lineTo(12, top + 20 + i * 8);
          c.stroke();
        }
      }
    },
    s,
  );
}

/** A sword pointing up the local y axis, its hilt at the origin. */
function sword(c: Ctx, length: number, width: number): void {
  const hw = width / 2;
  c.beginPath();
  c.moveTo(-hw, 0);
  c.lineTo(-hw, -length + width * 1.4);
  c.lineTo(0, -length);
  c.lineTo(hw, -length + width * 1.4);
  c.lineTo(hw, 0);
  c.closePath();
  c.fillStyle = lin(c, -hw, 0, hw, 0, STEEL);
  c.fill();
  ink(c, 2.5);
  c.beginPath();
  c.moveTo(0, -4);
  c.lineTo(0, -length + width * 2.2);
  c.lineWidth = width * 0.18;
  c.strokeStyle = 'rgba(70,82,96,0.7)';
  c.stroke();
  roundRect(c, -width * 2.1, -1, width * 4.2, width * 0.8, width * 0.3);
  fillInk(c, lin(c, 0, -1, 0, width * 0.8, GOLD), 2.5);
  const grip = width * 2.4;
  roundRect(c, -width * 0.4, width * 0.75, width * 0.8, grip, 2);
  fillInk(c, lin(c, -width * 0.4, 0, width * 0.4, 0, LEATHER), 2.5);
  c.strokeStyle = 'rgba(0,0,0,0.5)';
  c.lineWidth = 1.2;
  for (let y = width * 1.0; y < width * 0.7 + grip; y += width * 0.42) {
    c.beginPath();
    c.moveTo(-width * 0.4, y);
    c.lineTo(width * 0.4, y + width * 0.2);
    c.stroke();
  }
  c.beginPath();
  c.arc(0, width * 0.95 + grip, width * 0.6, 0, Math.PI * 2);
  fillInk(c, rad(c, -width * 0.2, width * 0.75 + grip, width * 0.8, [
    [0, '#fff2c0'],
    [0.5, '#d9a843'],
    [1, '#6e4a12'],
  ]), 2.5);
}

// ------------------------------------------------------------ painters

/**
 * A cut of meat, raw or cooked. `shape` is a hare's leg (with its bone), a
 * flat slab, or a round joint with its rind; `flesh` is light, mid and dark.
 * Raw meat is wet and marbled with fat; cooked meat is browned, with grill
 * marks and a glaze.
 */
function meat(c: Ctx, shape: 'leg' | 'slab' | 'joint', cooked: boolean, flesh: [string, string, string]): void {
  const [light, mid, dark] = flesh;
  if (shape === 'leg') {
    // The bone, sticking out at the top right.
    c.beginPath();
    c.moveTo(80, 50);
    c.lineTo(102, 22);
    c.strokeStyle = INK;
    c.lineWidth = 13;
    c.lineCap = 'round';
    c.stroke();
    c.strokeStyle = cooked ? '#e8d8b0' : '#f4ecd8';
    c.lineWidth = 7;
    c.stroke();
    for (const [x, y] of [
      [100, 15],
      [109, 23],
    ]) {
      c.beginPath();
      c.arc(x, y, 7, 0, Math.PI * 2);
      fillInk(c, cooked ? '#e0cca0' : '#f8f0e0', 3);
    }
  }
  const outline = (): void => {
    if (shape === 'leg') {
      c.beginPath();
      c.moveTo(86, 46);
      c.bezierCurveTo(96, 66, 84, 104, 54, 106);
      c.bezierCurveTo(24, 108, 14, 82, 24, 62);
      c.bezierCurveTo(36, 40, 70, 30, 86, 46);
      c.closePath();
    } else if (shape === 'slab') {
      smooth(c, [
        [22, 54],
        [52, 36],
        [92, 40],
        [112, 62],
        [104, 92],
        [70, 104],
        [30, 98],
        [16, 76],
      ]);
    } else {
      smooth(c, [
        [26, 50],
        [64, 28],
        [104, 48],
        [112, 84],
        [84, 110],
        [40, 110],
        [14, 84],
      ]);
    }
  };
  outline();
  drop(c, () => {
    c.fillStyle = dark;
    c.fill();
  });
  outline();
  clipped(c, () => {
    c.fillStyle = rad(c, 50, 58, 64, [
      [0, light],
      [0.5, mid],
      [1, dark],
    ]);
    c.fillRect(0, 0, 128, 128);
    if (shape === 'joint') {
      // The rind and a thick layer of fat along the bottom.
      c.beginPath();
      c.ellipse(64, 118, 70, 30, 0, 0, Math.PI * 2);
      c.fillStyle = cooked ? '#c8782a' : '#f4e0d0';
      c.fill();
      c.beginPath();
      c.ellipse(64, 124, 70, 26, 0, 0, Math.PI * 2);
      c.fillStyle = cooked ? '#8a4012' : '#e8c8b8';
      c.fill();
      if (cooked) {
        // Scored crackling.
        c.strokeStyle = 'rgba(60,20,4,0.7)';
        c.lineWidth = 2;
        for (let x = 20; x < 120; x += 12) {
          c.beginPath();
          c.moveTo(x, 92);
          c.lineTo(x + 10, 112);
          c.stroke();
        }
      }
    }
    if (cooked) {
      // Grill marks and a crust darkening the edges.
      c.strokeStyle = 'rgba(30,10,2,0.55)';
      c.lineWidth = 5;
      for (const d of [-24, -4, 16]) {
        c.beginPath();
        c.moveTo(30 + d, 40);
        c.lineTo(70 + d, 96);
        c.stroke();
      }
      c.fillStyle = rad(c, 56, 64, 56, [
        [0.65, 'rgba(0,0,0,0)'],
        [1, 'rgba(40,14,2,0.8)'],
      ]);
      c.fillRect(0, 0, 128, 128);
    } else {
      // Marbling of fat through the raw meat.
      c.strokeStyle = 'rgba(255,235,225,0.6)';
      c.lineWidth = 2.2;
      const r = rng(shape.length * 7);
      for (let i = 0; i < 5; i++) {
        const x0 = 26 + r() * 50;
        const y0 = 48 + r() * 40;
        c.beginPath();
        c.moveTo(x0, y0);
        c.quadraticCurveTo(x0 + 14, y0 - 10 + r() * 20, x0 + 28 + r() * 10, y0 + r() * 10 - 5);
        c.stroke();
      }
      if (shape === 'slab') {
        // A ragged edge of grey fur, left on the wolf meat.
        c.fillStyle = '#7a7478';
        for (let i = 0; i < 14; i++) {
          c.beginPath();
          c.arc(20 + i * 7, 102 + Math.sin(i * 2.1) * 3, 6, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  });
  outline();
  ink(c);
  shine(c, 44, 56, 12, 7, -0.5, cooked ? 0.45 : 0.7);
}

/** A wooden bowl of something thick and hot, with chunks of what went into it and a spoon. */
function bowl(c: Ctx, broth: [string, string, string], chunks: string[]): void {
  steam(c, 58, 40, 16);
  c.beginPath();
  c.moveTo(80, 60);
  c.lineTo(104, 18);
  c.strokeStyle = INK;
  c.lineWidth = 10;
  c.lineCap = 'round';
  c.stroke();
  c.strokeStyle = lin(c, 80, 0, 104, 0, WOOD);
  c.lineWidth = 5;
  c.stroke();
  c.beginPath();
  c.moveTo(10, 62);
  c.bezierCurveTo(12, 104, 40, 116, 64, 116);
  c.bezierCurveTo(88, 116, 116, 104, 118, 62);
  c.closePath();
  drop(c, () => {
    c.fillStyle = '#6a4020';
    c.fill();
  });
  c.fillStyle = lin(c, 10, 0, 118, 0, WOOD);
  c.fill();
  ink(c);
  ellipse(c, 64, 62, 54, 16);
  fillInk(c, rad(c, 56, 58, 54, [
    [0, broth[0]],
    [0.6, broth[1]],
    [1, broth[2]],
  ]));
  const spots: Pt[] = [
    [38, 60],
    [56, 66],
    [76, 58],
    [92, 66],
    [48, 55],
  ];
  spots.forEach(([x, y], i) => {
    roundRect(c, x - 7, y - 4.5, 14, 9, 3);
    fillInk(c, chunks[i % chunks.length], 2);
  });
  ellipse(c, 80, 62, 8, 5, -0.4);
  fillInk(c, '#a26a38', 2.5);
  shine(c, 44, 56, 12, 3, 0, 0.35);
}

const PAINTERS: Record<string, (c: Ctx) => void> = {
  // ---------------------------------------------------------------- produce
  carrot: (c) =>
    at(c, 82, 44, Math.PI / 4, () => {
      // Feathery tops, then the root tapering down to its tip.
      c.lineCap = 'round';
      for (const [ex, ey] of [
        [-16, -40],
        [0, -50],
        [16, -40],
      ]) {
        c.beginPath();
        c.moveTo(0, -2);
        c.quadraticCurveTo(ex * 0.3, ey * 0.6, ex, ey);
        c.strokeStyle = INK;
        c.lineWidth = 7;
        c.stroke();
        c.strokeStyle = '#4e8a30';
        c.lineWidth = 4;
        c.stroke();
        for (let t = 0.35; t <= 1; t += 0.22) {
          ellipse(c, ex * t, ey * t, 7, 4, Math.atan2(ey, ex) + 0.6);
          fillInk(c, t > 0.7 ? '#9ad060' : '#6aae40', 2);
        }
      }
      c.beginPath();
      c.moveTo(-17, 0);
      c.bezierCurveTo(-18, -11, 18, -11, 17, 0);
      c.bezierCurveTo(15, 30, 6, 62, 0, 86);
      c.bezierCurveTo(-6, 62, -15, 30, -17, 0);
      c.closePath();
      drop(c, () => {
        c.fillStyle = '#d06a20';
        c.fill();
      });
      clipped(c, () => {
        c.fillStyle = lin(c, -17, 0, 17, 0, [
          [0, '#ffb060'],
          [0.35, '#f08a2a'],
          [1, '#8a3c10'],
        ]);
        c.fillRect(-20, -12, 40, 100);
        c.strokeStyle = 'rgba(120,50,10,0.7)';
        c.lineWidth = 2;
        for (const y of [14, 28, 42, 58]) {
          c.beginPath();
          c.moveTo(-14 + y * 0.12, y);
          c.quadraticCurveTo(-4, y + 3, 2, y + 1);
          c.stroke();
        }
      });
      ink(c);
      shine(c, -8, 12, 3, 12, 0.1, 0.5);
    }),

  cabbage: (c) => {
    drop(c, () => {
      ellipse(c, 64, 70, 48, 44);
      c.fillStyle = '#4f7e3a';
      c.fill();
    });
    // Outer leaves cupping the head.
    for (const [x, y, rx, ry, rot, col] of [
      [34, 78, 28, 34, -0.5, '#4e8a38'],
      [94, 78, 28, 34, 0.5, '#4e8a38'],
      [64, 92, 40, 24, 0, '#5a9a40'],
    ] as Array<[number, number, number, number, number, string]>) {
      ellipse(c, x, y, rx, ry, rot);
      fillInk(c, rad(c, x - 6, y - 10, rx * 1.3, [
        [0, '#a8d878'],
        [0.5, col],
        [1, '#2c5420'],
      ]));
    }
    ellipse(c, 64, 62, 36, 34);
    fillInk(c, rad(c, 54, 48, 44, [
      [0, '#e8f8c0'],
      [0.45, '#a8d47a'],
      [1, '#4e8a38'],
    ]));
    // Veins and the fold of the inner leaves.
    c.strokeStyle = 'rgba(240,255,220,0.75)';
    c.lineWidth = 2;
    c.lineCap = 'round';
    for (const [x0, y0, cx, cy, x1, y1] of [
      [64, 96, 60, 70, 52, 34],
      [60, 70, 44, 66, 34, 56],
      [61, 60, 74, 50, 84, 44],
      [34, 90, 30, 78, 26, 66],
      [94, 90, 98, 78, 102, 66],
    ]) {
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo(cx, cy, x1, y1);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(34, 50);
    c.bezierCurveTo(48, 34, 80, 32, 96, 52);
    c.strokeStyle = 'rgba(40,80,30,0.6)';
    c.lineWidth = 2.5;
    c.stroke();
    shine(c, 50, 44, 12, 7, -0.4, 0.5);
  },

  turnip: (c) => {
    // Leaves.
    for (const [ex, ey, rot] of [
      [44, 16, -0.5],
      [64, 8, 0],
      [84, 16, 0.5],
    ]) {
      c.beginPath();
      c.moveTo(64, 46);
      c.quadraticCurveTo(ex - 14 * Math.sign(rot || 0.001), ey + 20, ex, ey);
      c.quadraticCurveTo(ex + 14 * Math.sign(rot || 1), ey + 18, 64, 46);
      fillInk(c, lin(c, ex, ey, 64, 46, [
        [0, '#8acc58'],
        [1, '#3e7a2a'],
      ]), 3);
    }
    c.beginPath();
    c.moveTo(64, 44);
    c.bezierCurveTo(100, 42, 108, 82, 86, 100);
    c.quadraticCurveTo(72, 110, 66, 124);
    c.quadraticCurveTo(62, 110, 42, 100);
    c.bezierCurveTo(20, 82, 28, 42, 64, 44);
    c.closePath();
    drop(c, () => {
      c.fillStyle = '#e8dcd0';
      c.fill();
    });
    clipped(c, () => {
      c.fillStyle = rad(c, 54, 82, 50, [
        [0, '#ffffff'],
        [0.5, '#f0e8dc'],
        [1, '#a89888'],
      ]);
      c.fillRect(0, 0, 128, 128);
      // The purple shoulders, fading into the white.
      c.fillStyle = lin(c, 0, 44, 0, 84, [
        [0, '#6a2a70'],
        [0.45, '#a24a9a'],
        [0.75, 'rgba(200,120,190,0.45)'],
        [1, 'rgba(255,255,255,0)'],
      ]);
      c.fillRect(0, 40, 128, 50);
      c.strokeStyle = 'rgba(120,100,90,0.35)';
      c.lineWidth = 1.5;
      for (const y of [94, 102]) {
        c.beginPath();
        c.moveTo(48, y);
        c.quadraticCurveTo(64, y + 3, 82, y - 2);
        c.stroke();
      }
    });
    ink(c);
    shine(c, 48, 62, 7, 11, 0.4, 0.6);
  },

  apple: (c) => {
    c.beginPath();
    c.moveTo(64, 40);
    c.bezierCurveTo(84, 26, 114, 36, 110, 70);
    c.bezierCurveTo(106, 100, 86, 118, 72, 114);
    c.quadraticCurveTo(64, 110, 56, 114);
    c.bezierCurveTo(42, 118, 22, 100, 18, 70);
    c.bezierCurveTo(14, 36, 44, 26, 64, 40);
    c.closePath();
    drop(c, () => {
      c.fillStyle = '#a02028';
      c.fill();
    });
    clipped(c, () => {
      c.fillStyle = rad(c, 48, 58, 70, [
        [0, '#ff8a70'],
        [0.3, '#e0343a'],
        [0.75, '#9a1820'],
        [1, '#4a0810'],
      ]);
      c.fillRect(0, 0, 128, 128);
      // Faint streaks in the skin.
      c.strokeStyle = 'rgba(255,200,120,0.18)';
      c.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        c.beginPath();
        c.moveTo(30 + i * 11, 44);
        c.quadraticCurveTo(28 + i * 11, 80, 40 + i * 8, 112);
        c.stroke();
      }
    });
    ink(c);
    // Stem and leaf.
    c.beginPath();
    c.moveTo(64, 44);
    c.quadraticCurveTo(62, 26, 70, 14);
    c.strokeStyle = INK;
    c.lineWidth = 7;
    c.stroke();
    c.strokeStyle = '#6a4020';
    c.lineWidth = 4;
    c.stroke();
    c.beginPath();
    c.moveTo(68, 24);
    c.bezierCurveTo(78, 8, 96, 10, 102, 16);
    c.bezierCurveTo(94, 28, 78, 32, 68, 24);
    fillInk(c, lin(c, 68, 24, 102, 16, [
      [0, '#4e8a30'],
      [1, '#9ad060'],
    ]), 3);
    c.beginPath();
    c.moveTo(70, 23);
    c.quadraticCurveTo(84, 18, 98, 17);
    c.strokeStyle = 'rgba(30,60,20,0.6)';
    c.lineWidth = 1.5;
    c.stroke();
    shine(c, 40, 58, 9, 14, 0.3, 0.7);
  },

  // ---------------------------------------------------------------- baking & larder
  bread: (c) => {
    c.beginPath();
    c.moveTo(14, 84);
    c.bezierCurveTo(10, 50, 40, 32, 66, 34);
    c.bezierCurveTo(96, 32, 120, 52, 114, 84);
    c.quadraticCurveTo(112, 98, 96, 98);
    c.lineTo(32, 98);
    c.quadraticCurveTo(16, 98, 14, 84);
    c.closePath();
    drop(c, () => {
      c.fillStyle = '#a8642e';
      c.fill();
    });
    clipped(c, () => {
      c.fillStyle = rad(c, 54, 44, 80, [
        [0, '#f4c47a'],
        [0.4, '#d08a40'],
        [0.8, '#8a4a1e'],
        [1, '#5a2e10'],
      ]);
      c.fillRect(0, 0, 128, 128);
    });
    ink(c);
    // Scores across the top, showing the pale crumb.
    for (const x of [38, 60, 82]) {
      c.beginPath();
      c.moveTo(x - 6, 62);
      c.quadraticCurveTo(x + 2, 46, x + 12, 40);
      c.quadraticCurveTo(x + 6, 54, x - 2, 66);
      c.closePath();
      fillInk(c, lin(c, x, 66, x + 10, 40, [
        [0, '#c08848'],
        [0.5, '#fbe8bc'],
        [1, '#e8c890'],
      ]), 2.5);
    }
    // A dusting of flour.
    const r = rng(5);
    c.fillStyle = 'rgba(255,250,235,0.6)';
    for (let i = 0; i < 40; i++) {
      c.beginPath();
      c.arc(26 + r() * 76, 42 + r() * 24, 0.8 + r() * 1.2, 0, Math.PI * 2);
      c.fill();
    }
    shine(c, 46, 44, 12, 5, -0.3, 0.45);
  },

  cheese: (c) => {
    // A wedge: the rind-topped face, the cut face with its holes, and the end.
    const top: Pt[] = [
      [14, 62],
      [86, 30],
      [116, 50],
      [46, 84],
    ];
    const front: Pt[] = [
      [14, 62],
      [46, 84],
      [46, 112],
      [14, 92],
    ];
    const side: Pt[] = [
      [46, 84],
      [116, 50],
      [116, 78],
      [46, 112],
    ];
    const poly = (pts: Pt[]) => {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
    };
    drop(c, () => {
      poly([top[0], top[1], top[2], side[2], side[3], front[3]]);
      c.fillStyle = '#e8b040';
      c.fill();
    });
    poly(front);
    fillInk(c, lin(c, 14, 0, 46, 0, [
      [0, '#e8a838'],
      [1, '#c88a20'],
    ]));
    poly(side);
    c.save();
    c.fillStyle = lin(c, 46, 80, 116, 64, [
      [0, '#ffe08a'],
      [1, '#f0c050'],
    ]);
    c.fill();
    c.clip();
    // Holes in the cut face.
    for (const [x, y, rr] of [
      [64, 90, 6],
      [86, 76, 8],
      [104, 70, 4],
      [74, 102, 3.5],
      [100, 84, 4.5],
    ]) {
      ellipse(c, x, y, rr, rr * 0.8);
      c.fillStyle = rad(c, x + rr * 0.3, y + rr * 0.3, rr, [
        [0, '#c08a20'],
        [1, '#a06a10'],
      ]);
      c.fill();
      c.strokeStyle = 'rgba(120,70,10,0.6)';
      c.lineWidth = 1.5;
      c.stroke();
    }
    c.restore();
    poly(side);
    ink(c);
    poly(top);
    fillInk(c, lin(c, 30, 40, 100, 80, [
      [0, '#fff0b0'],
      [1, '#f0c050'],
    ]));
    ellipse(c, 70, 56, 5, 3, -0.4);
    c.fillStyle = 'rgba(180,120,20,0.6)';
    c.fill();
    // The waxed rind along the back edge.
    c.beginPath();
    c.moveTo(14, 62);
    c.lineTo(86, 30);
    c.lineTo(116, 50);
    c.strokeStyle = '#b8401c';
    c.lineWidth = 4;
    c.stroke();
    shine(c, 58, 52, 16, 4, -0.42, 0.5);
  },

  pie: (c) => {
    // The tin.
    drop(c, () => {
      c.beginPath();
      c.moveTo(10, 72);
      c.lineTo(22, 104);
      c.quadraticCurveTo(64, 120, 106, 104);
      c.lineTo(118, 72);
      c.closePath();
      c.fillStyle = '#6a7078';
      c.fill();
    });
    c.beginPath();
    c.moveTo(10, 72);
    c.lineTo(22, 104);
    c.quadraticCurveTo(64, 120, 106, 104);
    c.lineTo(118, 72);
    c.closePath();
    fillInk(c, lin(c, 10, 0, 118, 0, STEEL));
    // The domed crust, crimped round the edge.
    c.beginPath();
    c.moveTo(8, 72);
    c.bezierCurveTo(10, 30, 118, 30, 120, 72);
    c.bezierCurveTo(100, 86, 28, 86, 8, 72);
    c.closePath();
    fillInk(c, rad(c, 54, 46, 70, [
      [0, '#fbd890'],
      [0.45, '#e09a48'],
      [1, '#8a4a1a'],
    ]));
    c.strokeStyle = 'rgba(120,60,20,0.75)';
    c.lineWidth = 2;
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const x = 10 + t * 108;
      const y = 72 + Math.sin(t * Math.PI) * 10;
      c.beginPath();
      c.arc(x, y - 3, 4.5, 0.2, Math.PI - 0.2);
      c.stroke();
    }
    // Vents in the lid, dark with gravy.
    for (const [x, y, rot] of [
      [50, 56, -0.5],
      [64, 50, 0],
      [78, 56, 0.5],
    ]) {
      ellipse(c, x, y, 2.5, 8, rot);
      c.fillStyle = '#5a2810';
      c.fill();
    }
    shine(c, 46, 48, 16, 6, -0.2, 0.5);
    steam(c, 64, 38, 16);
  },

  'honey-cake': (c) => {
    // A square cake, honey glaze running down its sides.
    drop(c, () => {
      roundRect(c, 18, 44, 92, 66, 10);
      c.fillStyle = '#b8783a';
      c.fill();
    });
    roundRect(c, 18, 44, 92, 66, 10);
    fillInk(c, lin(c, 0, 44, 0, 110, [
      [0, '#e8b46a'],
      [0.5, '#c4844a'],
      [1, '#8a5428'],
    ]));
    // A layer of cream through the middle.
    c.fillStyle = '#fff2d0';
    c.fillRect(20, 76, 88, 7);
    c.strokeStyle = 'rgba(80,40,10,0.5)';
    c.lineWidth = 1.5;
    c.strokeRect(20, 76, 88, 7);
    // The glaze.
    c.beginPath();
    c.moveTo(16, 50);
    c.quadraticCurveTo(16, 36, 30, 36);
    c.lineTo(98, 36);
    c.quadraticCurveTo(112, 36, 112, 50);
    c.lineTo(112, 60);
    for (const [x, d] of [
      [104, 18],
      [92, 6],
      [80, 26],
      [66, 8],
      [52, 20],
      [38, 6],
      [26, 14],
    ]) {
      c.quadraticCurveTo(x + 6, 60, x + 4, 60 + d);
      c.arc(x, 60 + d, 4, 0, Math.PI);
      c.quadraticCurveTo(x - 4, 60, x - 6, 60);
    }
    c.lineTo(16, 60);
    c.closePath();
    fillInk(c, lin(c, 0, 36, 0, 84, [
      [0, '#ffe080'],
      [0.5, '#f0a820'],
      [1, '#b06a10'],
    ]), 3);
    shine(c, 52, 44, 22, 4, 0, 0.75);
    shine(c, 96, 46, 5, 3, 0, 0.6);
    // A bee on top for luck.
    at(c, 82, 30, -0.3, () => {
      ellipse(c, -6, -6, 6, 4, -0.6);
      c.fillStyle = 'rgba(230,245,255,0.8)';
      c.fill();
      ink(c, 1.5);
      ellipse(c, 0, 0, 8, 5.5);
      fillInk(c, '#f0b020', 2.5);
      c.fillStyle = INK;
      c.fillRect(-3, -5, 2.5, 10);
      c.fillRect(2, -5, 2.5, 10);
    });
  },

  egg: (c) => {
    // A brown egg on a twist of straw.
    c.lineCap = 'round';
    const r = rng(3);
    for (let i = 0; i < 16; i++) {
      c.beginPath();
      const y = 100 + r() * 12;
      c.moveTo(16 + r() * 30, y);
      c.quadraticCurveTo(64, y - 10 + r() * 20, 82 + r() * 30, y + r() * 8 - 4);
      c.strokeStyle = i % 3 ? '#d8b860' : '#a88838';
      c.lineWidth = 3;
      c.stroke();
    }
    c.beginPath();
    c.moveTo(64, 14);
    c.bezierCurveTo(96, 14, 104, 74, 98, 88);
    c.bezierCurveTo(90, 112, 38, 112, 30, 88);
    c.bezierCurveTo(24, 74, 32, 14, 64, 14);
    c.closePath();
    drop(c, () => {
      c.fillStyle = '#d0a070';
      c.fill();
    });
    clipped(c, () => {
      c.fillStyle = rad(c, 52, 44, 72, [
        [0, '#fff4e4'],
        [0.4, '#e8c49a'],
        [1, '#8a5a34'],
      ]);
      c.fillRect(0, 0, 128, 128);
      const s = rng(9);
      c.fillStyle = 'rgba(120,70,40,0.45)';
      for (let i = 0; i < 26; i++) {
        c.beginPath();
        c.arc(36 + s() * 60, 26 + s() * 76, 0.8 + s() * 1.6, 0, Math.PI * 2);
        c.fill();
      }
    });
    ink(c);
    shine(c, 50, 38, 8, 14, 0.3, 0.8);
  },

  venison: (c) => {
    // A haunch on dock leaves, the bone end showing.
    for (const [x, y, rot] of [
      [40, 96, -0.3],
      [86, 98, 0.25],
    ]) {
      ellipse(c, x, y, 34, 13, rot);
      fillInk(c, lin(c, x - 30, y, x + 30, y, [
        [0, '#2e5a22'],
        [0.5, '#5a9a3a'],
        [1, '#2e5a22'],
      ]), 3);
      c.beginPath();
      c.moveTo(x - 30 * Math.cos(rot), y - 30 * Math.sin(rot));
      c.lineTo(x + 30 * Math.cos(rot), y + 30 * Math.sin(rot));
      c.strokeStyle = 'rgba(200,240,160,0.6)';
      c.lineWidth = 1.5;
      c.stroke();
    }
    // The bone.
    c.beginPath();
    c.moveTo(78, 52);
    c.lineTo(100, 26);
    c.strokeStyle = INK;
    c.lineWidth = 15;
    c.lineCap = 'round';
    c.stroke();
    c.strokeStyle = '#f4ecd8';
    c.lineWidth = 9;
    c.stroke();
    for (const [x, y] of [
      [98, 18],
      [108, 26],
    ]) {
      c.beginPath();
      c.arc(x, y, 8, 0, Math.PI * 2);
      fillInk(c, rad(c, x - 2, y - 2, 9, [
        [0, '#ffffff'],
        [1, '#d8ccb0'],
      ]), 3);
    }
    // The meat.
    c.beginPath();
    c.moveTo(84, 46);
    c.bezierCurveTo(98, 64, 88, 100, 58, 100);
    c.bezierCurveTo(28, 102, 14, 78, 22, 60);
    c.bezierCurveTo(32, 38, 66, 30, 84, 46);
    c.closePath();
    drop(c, () => {
      c.fillStyle = '#8a2a20';
      c.fill();
    });
    clipped(c, () => {
      c.fillStyle = rad(c, 46, 58, 60, [
        [0, '#e07060'],
        [0.4, '#b03a30'],
        [1, '#5a1410'],
      ]);
      c.fillRect(0, 0, 128, 128);
      // Marbling of fat.
      c.strokeStyle = 'rgba(255,225,215,0.55)';
      c.lineWidth = 2;
      for (const [x0, y0, cx, cy, x1, y1] of [
        [30, 62, 46, 54, 60, 62],
        [40, 82, 56, 72, 74, 80],
        [56, 50, 70, 44, 82, 54],
      ]) {
        c.beginPath();
        c.moveTo(x0, y0);
        c.quadraticCurveTo(cx, cy, x1, y1);
        c.stroke();
      }
      // A rim of browned crust.
      c.fillStyle = rad(c, 54, 66, 48, [
        [0.75, 'rgba(0,0,0,0)'],
        [1, 'rgba(70,24,10,0.75)'],
      ]);
      c.fillRect(0, 0, 128, 128);
    });
    ink(c);
    shine(c, 40, 56, 10, 6, -0.5, 0.55);
  },

  stew: (c) => {
    steam(c, 58, 40, 16);
    // The spoon, behind the far rim.
    c.beginPath();
    c.moveTo(80, 60);
    c.lineTo(104, 18);
    c.strokeStyle = INK;
    c.lineWidth = 10;
    c.lineCap = 'round';
    c.stroke();
    c.strokeStyle = lin(c, 80, 0, 104, 0, WOOD);
    c.lineWidth = 5;
    c.stroke();
    // The bowl.
    c.beginPath();
    c.moveTo(10, 62);
    c.bezierCurveTo(12, 104, 40, 116, 64, 116);
    c.bezierCurveTo(88, 116, 116, 104, 118, 62);
    c.closePath();
    drop(c, () => {
      c.fillStyle = '#6a4020';
      c.fill();
    });
    c.fillStyle = lin(c, 10, 0, 118, 0, WOOD);
    c.fill();
    clipped(c, () => {
      c.strokeStyle = 'rgba(40,20,6,0.5)';
      c.lineWidth = 1.5;
      for (const y of [76, 90, 102]) {
        c.beginPath();
        c.moveTo(10, y);
        c.quadraticCurveTo(64, y + 10, 118, y);
        c.stroke();
      }
    });
    ink(c);
    // The stew, with chunks of carrot, potato and greens.
    ellipse(c, 64, 62, 54, 16);
    fillInk(c, rad(c, 56, 58, 54, [
      [0, '#a86a3a'],
      [0.6, '#7a4220'],
      [1, '#4a2410'],
    ]));
    for (const [x, y, w, h, col] of [
      [40, 60, 7, 5, '#f08a2a'],
      [60, 66, 8, 5, '#f0e0b0'],
      [78, 58, 7, 5, '#f08a2a'],
      [90, 66, 6, 4, '#f0e0b0'],
      [52, 56, 5, 3, '#8ac050'],
      [70, 54, 5, 3, '#8ac050'],
      [30, 66, 5, 3.5, '#f0e0b0'],
    ] as Array<[number, number, number, number, string]>) {
      roundRect(c, x - w, y - h, w * 2, h * 2, 2);
      fillInk(c, col, 2);
    }
    // The spoon's bowl, sunk in the stew.
    ellipse(c, 80, 62, 8, 5, -0.4);
    fillInk(c, '#a26a38', 2.5);
    shine(c, 44, 56, 12, 3, 0, 0.35);
  },

  'chicken-feed': (c) => {
    // A burlap sack, tied at the neck, grain spilling at its foot.
    c.beginPath();
    c.moveTo(48, 36);
    c.bezierCurveTo(24, 46, 14, 86, 22, 108);
    c.quadraticCurveTo(64, 120, 106, 108);
    c.bezierCurveTo(114, 86, 104, 46, 80, 36);
    c.closePath();
    drop(c, () => {
      c.fillStyle = '#c8b080';
      c.fill();
    });
    clipped(c, () => {
      c.fillStyle = rad(c, 54, 66, 62, [
        [0, '#f0e0b8'],
        [0.55, '#cfb888'],
        [1, '#7a6440'],
      ]);
      c.fillRect(0, 0, 128, 128);
      // The weave.
      c.strokeStyle = 'rgba(100,80,40,0.28)';
      c.lineWidth = 1;
      for (let x = 10; x < 120; x += 5) {
        c.beginPath();
        c.moveTo(x, 30);
        c.lineTo(x, 120);
        c.stroke();
      }
      for (let y = 30; y < 120; y += 5) {
        c.beginPath();
        c.moveTo(10, y);
        c.lineTo(120, y);
        c.stroke();
      }
      // A painted hen on the front.
      c.fillStyle = 'rgba(150,50,30,0.75)';
      ellipse(c, 64, 84, 13, 10);
      c.fill();
      c.beginPath();
      c.arc(74, 72, 5, 0, Math.PI * 2);
      c.fill();
      c.fillRect(58, 92, 2, 8);
      c.fillRect(66, 92, 2, 8);
    });
    ink(c);
    // The gathered neck and its cord.
    c.beginPath();
    c.moveTo(48, 38);
    c.lineTo(40, 14);
    c.quadraticCurveTo(64, 22, 88, 14);
    c.lineTo(80, 38);
    c.closePath();
    fillInk(c, lin(c, 40, 0, 88, 0, [
      [0, '#9a8458'],
      [0.5, '#e8d8b0'],
      [1, '#8a7448'],
    ]), 3);
    roundRect(c, 44, 32, 40, 8, 3);
    fillInk(c, '#7a3a20', 2.5);
    // Grain spilling out.
    const r = rng(17);
    for (let i = 0; i < 26; i++) {
      const x = 18 + r() * 92;
      const y = 108 + r() * 12;
      ellipse(c, x, y, 2.8, 1.8, r() * 3);
      c.fillStyle = i % 3 ? '#e8c860' : '#c89a38';
      c.fill();
      c.strokeStyle = 'rgba(60,40,10,0.6)';
      c.lineWidth = 1;
      c.stroke();
    }
  },

  // ---------------------------------------------------------------- drink
  ale: (c) =>
    tankard(
      c,
      [
        [0, '#ffffff'],
        [0.6, '#f4ead4'],
        [1, '#c8b890'],
      ],
      '#a8681e',
    ),

  cider: (c) =>
    tankard(
      c,
      [
        [0, '#fffbe0'],
        [0.6, '#f4e08a'],
        [1, '#c8a848'],
      ],
      '#e0a020',
    ),

  mead: (c) => {
    // A drinking horn, curling up to its brimming mouth, banded in brass.
    const path = () => {
      c.beginPath();
      c.moveTo(16, 104);
      c.bezierCurveTo(26, 116, 52, 108, 74, 82);
      c.lineTo(96, 52);
      c.lineTo(122, 52);
      c.lineTo(110, 18);
      c.lineTo(86, 36);
      c.lineTo(62, 70);
      c.bezierCurveTo(46, 90, 28, 96, 16, 104);
      c.closePath();
    };
    drop(c, () => {
      path();
      c.fillStyle = '#d8c8a0';
      c.fill();
    });
    path();
    clipped(c, () => {
      c.fillStyle = lin(c, 40, 110, 110, 30, [
        [0, '#4a3a2a'],
        [0.25, '#a89070'],
        [0.6, '#f4ead0'],
        [1, '#d8c8a0'],
      ]);
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = lin(c, 60, 50, 90, 80, [
        [0, 'rgba(255,255,255,0.4)'],
        [0.5, 'rgba(255,255,255,0)'],
      ]);
      c.fillRect(0, 0, 128, 128);
      // Brass bands.
      for (const [x, y, rot] of [
        [52, 84, 0.85],
        [86, 50, 0.75],
      ]) {
        at(c, x, y, rot, () => {
          c.fillStyle = lin(c, -5, 0, 5, 0, GOLD);
          c.fillRect(-5, -30, 10, 60);
          c.strokeStyle = INK;
          c.lineWidth = 2;
          c.strokeRect(-5, -30, 10, 60);
        });
      }
    });
    ink(c);
    // The brimming mouth.
    ellipse(c, 108, 35, 9, 18, -0.33);
    fillInk(c, rad(c, 104, 30, 18, [
      [0, '#fff0a0'],
      [0.5, '#f0b030'],
      [1, '#a06a10'],
    ]), 3);
    shine(c, 104, 28, 3, 7, -0.3, 0.8);
    // A tip of polished silver.
    c.beginPath();
    c.arc(18, 104, 6, 0, Math.PI * 2);
    fillInk(c, rad(c, 16, 102, 7, [
      [0, '#ffffff'],
      [1, '#8a96a2'],
    ]), 2.5);
  },

  'spiced-wine': (c) => {
    // A pewter goblet of red wine, steam rising.
    steam(c, 64, 30, 14);
    c.beginPath();
    c.moveTo(26, 38);
    c.lineTo(102, 38);
    c.bezierCurveTo(102, 70, 86, 82, 70, 84);
    c.lineTo(70, 100);
    c.quadraticCurveTo(70, 106, 90, 110);
    c.lineTo(90, 116);
    c.lineTo(38, 116);
    c.lineTo(38, 110);
    c.quadraticCurveTo(58, 106, 58, 100);
    c.lineTo(58, 84);
    c.bezierCurveTo(42, 82, 26, 70, 26, 38);
    c.closePath();
    drop(c, () => {
      c.fillStyle = '#7a8088';
      c.fill();
    });
    c.fillStyle = lin(c, 26, 0, 102, 0, [
      [0, '#3c4248'],
      [0.3, '#c8ced4'],
      [0.45, '#f0f4f8'],
      [0.7, '#8a929a'],
      [1, '#3c4248'],
    ]);
    c.fill();
    ink(c);
    // A band of engraving.
    c.beginPath();
    c.moveTo(30, 58);
    c.quadraticCurveTo(64, 66, 98, 58);
    c.strokeStyle = 'rgba(40,46,52,0.6)';
    c.lineWidth = 2;
    c.stroke();
    ellipse(c, 64, 38, 38, 8);
    fillInk(c, rad(c, 56, 36, 38, [
      [0, '#c03048'],
      [0.6, '#7a1424'],
      [1, '#3a0610'],
    ]), 3);
    shine(c, 54, 36, 12, 2.5, 0, 0.6);
    // A stick of cinnamon.
    c.beginPath();
    c.moveTo(82, 40);
    c.lineTo(96, 16);
    c.strokeStyle = INK;
    c.lineWidth = 9;
    c.lineCap = 'round';
    c.stroke();
    c.strokeStyle = '#a0522d';
    c.lineWidth = 5;
    c.stroke();
  },

  // ---------------------------------------------------------------- forest & field
  pinecone: (c) =>
    at(c, 64, 64, 0.35, () => {
      c.beginPath();
      c.moveTo(0, -54);
      c.bezierCurveTo(28, -40, 34, 20, 0, 54);
      c.bezierCurveTo(-34, 20, -28, -40, 0, -54);
      c.closePath();
      drop(c, () => {
        c.fillStyle = '#5a3418';
        c.fill();
      });
      c.fillStyle = '#3a2010';
      c.fill();
      // Rows of scales, overlapping from the tip down.
      clipped(c, () => {
        for (let row = 0; row < 9; row++) {
          const y = -46 + row * 12;
          const w = Math.sin(((row + 0.8) / 10) * Math.PI) * 28 + 6;
          const n = row % 2 ? 4 : 3;
          for (let k = 0; k < n; k++) {
            const x = -w + ((k + 0.5) / n) * w * 2;
            c.beginPath();
            c.moveTo(x - 9, y);
            c.quadraticCurveTo(x - 9, y + 12, x, y + 14);
            c.quadraticCurveTo(x + 9, y + 12, x + 9, y);
            c.closePath();
            c.fillStyle = lin(c, x, y, x, y + 14, [
              [0, '#5a3418'],
              [0.6, '#a86a38'],
              [1, '#d8a060'],
            ]);
            c.fill();
            c.strokeStyle = INK;
            c.lineWidth = 1.8;
            c.stroke();
          }
        }
        c.fillStyle = lin(c, -34, 0, 34, 0, [
          [0, 'rgba(255,220,160,0.25)'],
          [0.5, 'rgba(0,0,0,0)'],
          [1, 'rgba(0,0,0,0.45)'],
        ]);
        c.fillRect(-40, -60, 80, 120);
      });
      c.beginPath();
      c.moveTo(0, -54);
      c.bezierCurveTo(28, -40, 34, 20, 0, 54);
      c.bezierCurveTo(-34, 20, -28, -40, 0, -54);
      c.closePath();
      ink(c);
      // A stub of stalk.
      roundRect(c, -4, -62, 8, 12, 3);
      fillInk(c, '#6a4020', 2.5);
    }),

  stick: (c) => {
    // A forked branch with knots and a last green leaf.
    const limb = (pts: Pt[], w: number) => {
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = INK;
      c.lineWidth = w + 5;
      c.stroke();
      c.strokeStyle = '#6a4424';
      c.lineWidth = w;
      c.stroke();
      c.strokeStyle = 'rgba(200,150,100,0.5)';
      c.lineWidth = w * 0.3;
      c.save();
      c.translate(-w * 0.2, -w * 0.2);
      c.stroke();
      c.restore();
    };
    drop(c, () => limb([[16, 114], [60, 70], [112, 14]], 10));
    limb([[60, 70], [96, 62], [114, 50]], 6);
    limb([[16, 114], [60, 70], [112, 14]], 10);
    for (const [x, y] of [
      [40, 90],
      [84, 44],
    ]) {
      ellipse(c, x, y, 4, 3, -0.8);
      fillInk(c, '#3a2010', 2);
    }
    c.beginPath();
    c.moveTo(96, 62);
    c.bezierCurveTo(98, 76, 112, 86, 122, 84);
    c.bezierCurveTo(120, 70, 108, 60, 96, 62);
    fillInk(c, lin(c, 96, 62, 122, 84, [
      [0, '#4e8a30'],
      [1, '#a8d870'],
    ]), 2.5);
  },

  'willow-bark': (c) => {
    // Three long curls of white willow bark, tied with twine: grey and furrowed outside, cream where they were cut from the wood.
    const rnd = rng(37);
    const strip = (x: number, y: number, angle: number, len: number, w: number) =>
      at(c, x, y, angle, () => {
        drop(c, () => {
          smooth(c, [
            [-w, -len / 2],
            [w * 0.9, -len / 2 + 4],
            [w * 1.1, 0],
            [w, len / 2],
            [-w * 0.8, len / 2 - 3],
            [-w * 1.15, 0],
          ]);
          fillInk(c, lin(c, -w, 0, w, 0, [
            [0, '#bdb5a2'],
            [0.45, '#8e8676'],
            [1, '#5a5348'],
          ]));
        });
        // Furrows running down the bark.
        smooth(c, [[-w, -len / 2], [w * 0.9, -len / 2 + 4], [w * 1.1, 0], [w, len / 2], [-w * 0.8, len / 2 - 3], [-w * 1.15, 0]]);
        clipped(c, () => {
          c.strokeStyle = 'rgba(40,32,24,0.55)';
          c.lineWidth = 1.6;
          for (let i = 0; i < 7; i++) {
            const fx = -w + (i + 0.5) * ((2 * w) / 7) + (rnd() - 0.5) * 2;
            c.beginPath();
            c.moveTo(fx, -len / 2);
            c.bezierCurveTo(fx + (rnd() - 0.5) * 6, -len / 6, fx + (rnd() - 0.5) * 6, len / 6, fx + (rnd() - 0.5) * 4, len / 2);
            c.stroke();
          }
          // The pale inner bark, showing where the strip curls over at the top.
          ellipse(c, 0, -len / 2 + 3, w * 1.2, 7);
          c.fillStyle = lin(c, 0, -len / 2 - 4, 0, -len / 2 + 10, [
            [0, '#fff4d6'],
            [1, '#e2c890'],
          ]);
          c.fill();
        });
        ellipse(c, 0, -len / 2 + 3, w * 1.05, 5.5);
        ink(c, 2);
        shine(c, -w * 0.45, -len / 8, w * 0.35, len / 4, 0, 0.3);
      });
    strip(40, 66, -0.38, 92, 11);
    strip(88, 64, 0.34, 88, 10);
    strip(64, 60, 0.02, 100, 12);
    // Twine round the middle of the bundle.
    for (const [y, tilt] of [[70, -0.06], [79, 0.05]] as const) {
      at(c, 64, y, tilt, () => {
        roundRect(c, -34, -3, 68, 6, 3);
        fillInk(c, lin(c, 0, -3, 0, 3, [
          [0, '#e8cc8c'],
          [1, '#a4824a'],
        ]), 2);
      });
    }
    at(c, 96, 78, 0.5, () => {
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(8, 10, 4, 22);
      c.strokeStyle = INK;
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.stroke();
      c.strokeStyle = '#c8a46a';
      c.lineWidth = 3;
      c.stroke();
    });
  },
  moonpetal: (c) => {
    // A sprig of pale, star-shaped flowers, glowing faintly.
    c.save();
    c.shadowColor = 'rgba(160,210,255,0.9)';
    c.shadowBlur = 18;
    c.beginPath();
    c.moveTo(64, 120);
    c.quadraticCurveTo(60, 80, 64, 40);
    c.moveTo(63, 88);
    c.quadraticCurveTo(44, 74, 34, 54);
    c.moveTo(63, 72);
    c.quadraticCurveTo(84, 62, 94, 40);
    c.strokeStyle = INK;
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.stroke();
    c.restore();
    c.beginPath();
    c.moveTo(64, 120);
    c.quadraticCurveTo(60, 80, 64, 40);
    c.moveTo(63, 88);
    c.quadraticCurveTo(44, 74, 34, 54);
    c.moveTo(63, 72);
    c.quadraticCurveTo(84, 62, 94, 40);
    c.strokeStyle = '#5a9a50';
    c.lineWidth = 3.5;
    c.stroke();
    for (const [x, y, rot] of [
      [52, 104, -0.9],
      [76, 96, 0.9],
    ]) {
      ellipse(c, x, y, 13, 5, rot);
      fillInk(c, lin(c, x - 12, y, x + 12, y, [
        [0, '#3e7a3a'],
        [1, '#8acc78'],
      ]), 2.5);
    }
    const flower = (x: number, y: number, r: number) => {
      c.save();
      c.shadowColor = 'rgba(180,220,255,1)';
      c.shadowBlur = 16;
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.42 : r;
        c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      c.closePath();
      c.fillStyle = rad(c, x, y, r, [
        [0, '#ffffff'],
        [0.6, '#e4f0ff'],
        [1, '#a8c4ec'],
      ]);
      c.fill();
      c.restore();
      ink(c, 2.5);
      c.beginPath();
      c.arc(x, y, r * 0.22, 0, Math.PI * 2);
      c.fillStyle = '#f8e080';
      c.fill();
    };
    flower(64, 34, 20);
    flower(32, 50, 15);
    flower(96, 36, 15);
    // Motes of light.
    c.fillStyle = 'rgba(220,240,255,0.9)';
    for (const [x, y, r] of [
      [20, 26, 2],
      [108, 66, 2.5],
      [40, 16, 1.5],
      [88, 12, 1.8],
    ]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  },

  // ---------------------------------------------------------------- pelts & spoils
  'wolf-pelt': (c) =>
    hide(c, {
      light: '#c8ccd0',
      mid: '#8a9098',
      dark: '#3c4248',
      spine: 'rgba(40,44,50,0.65)',
      fur: ['rgba(230,234,240,0.55)', 'rgba(40,44,50,0.5)', 'rgba(160,166,172,0.6)'],
      seed: 21,
    }),

  'white-hide': (c) =>
    hide(c, {
      light: '#ffffff',
      mid: '#e4ecf4',
      dark: '#8aa0b8',
      spine: 'rgba(160,190,220,0.45)',
      fur: ['rgba(255,255,255,0.8)', 'rgba(150,175,205,0.45)', 'rgba(210,225,240,0.7)'],
      seed: 33,
      glow: 'rgba(170,215,255,0.95)',
    }),

  'deer-hide': (c) =>
    hide(c, {
      light: '#e0a070',
      mid: '#b06a3a',
      dark: '#5a2e14',
      spine: 'rgba(90,40,16,0.6)',
      fur: ['rgba(255,210,170,0.4)', 'rgba(80,36,14,0.45)', 'rgba(200,120,70,0.6)'],
      seed: 45,
      spots: 'rgba(255,245,225,0.85)',
    }),

  'hare-pelt': (c) => {
    // The long ears first, then a small soft pelt over them.
    for (const [x, rot] of [
      [52, -0.25],
      [76, 0.25],
    ]) {
      at(c, x, 34, rot, () => {
        ellipse(c, 0, -10, 9, 24);
        fillInk(c, lin(c, -9, 0, 9, 0, [
          [0, '#5e4630'],
          [0.5, '#b48e64'],
          [1, '#5e4630'],
        ]), 3);
        ellipse(c, 0, -8, 4, 16);
        c.fillStyle = '#e8b8a8';
        c.fill();
        // Black tips.
        c.beginPath();
        c.ellipse(0, -10, 9, 24, 0, Math.PI * 1.25, Math.PI * 1.75);
        c.lineTo(0, -10);
        c.closePath();
        c.fillStyle = '#2a1e16';
        c.fill();
      });
    }
    at(
      c,
      14,
      26,
      0,
      () =>
        hide(c, {
          light: '#e0c4a0',
          mid: '#a6825a',
          dark: '#5a4028',
          spine: 'rgba(90,64,40,0.5)',
          fur: ['rgba(255,240,220,0.5)', 'rgba(70,50,30,0.45)', 'rgba(190,160,120,0.6)'],
          seed: 57,
        }),
      0.78,
    );
    // The white scut of a tail.
    c.beginPath();
    c.arc(64, 118, 6, 0, Math.PI * 2);
    fillInk(c, '#f8f4ec', 2.5);
  },

  'boar-tusk': (c) => {
    // A curved tusk, yellowed at the root, polished at the tip.
    const path = () => {
      c.beginPath();
      c.moveTo(14, 104);
      c.bezierCurveTo(30, 60, 74, 22, 116, 18);
      c.bezierCurveTo(86, 32, 52, 70, 40, 116);
      c.quadraticCurveTo(24, 118, 14, 104);
      c.closePath();
    };
    drop(c, () => {
      path();
      c.fillStyle = '#e8dcbc';
      c.fill();
    });
    path();
    clipped(c, () => {
      c.fillStyle = lin(c, 24, 112, 110, 20, [
        [0, '#8a6a30'],
        [0.3, '#d8bc80'],
        [0.7, '#f8f0dc'],
        [1, '#ffffff'],
      ]);
      c.fillRect(0, 0, 128, 128);
      c.strokeStyle = 'rgba(120,90,40,0.4)';
      c.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.moveTo(14 + i * 9, 110 - i * 13);
        c.lineTo(32 + i * 11, 118 - i * 15);
        c.stroke();
      }
    });
    ink(c);
    c.beginPath();
    c.moveTo(30, 92);
    c.bezierCurveTo(44, 64, 70, 38, 102, 24);
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 3;
    c.stroke();
  },

  'rat-tail': (c) => {
    // A long pink tail, curling, with a tuft of grey fur at the root.
    const pts: Pt[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const a = t * Math.PI * 2.4;
      const r = 44 * (1 - t * 0.75);
      pts.push([64 + Math.cos(a + 2.4) * r + t * 10, 64 + Math.sin(a + 2.4) * r * 0.85]);
    }
    const draw = (extra: number, col: (t: number) => string) => {
      for (let i = 0; i < pts.length; i++) {
        const t = i / (pts.length - 1);
        c.beginPath();
        c.arc(pts[i][0], pts[i][1], 7 * (1 - t * 0.8) + extra, 0, Math.PI * 2);
        c.fillStyle = col(t);
        c.fill();
      }
    };
    drop(c, () => draw(2, () => INK));
    draw(0, (t) => (t < 0.5 ? '#c88080' : '#e0a0a0'));
    // Rings down its length, and a gleam along the top.
    for (let i = 2; i < pts.length; i += 3) {
      const t = i / (pts.length - 1);
      c.beginPath();
      c.arc(pts[i][0], pts[i][1], 7 * (1 - t * 0.8) - 0.5, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(120,60,60,0.45)';
      c.lineWidth = 1;
      c.stroke();
    }
    for (let i = 0; i < pts.length - 4; i++) {
      const t = i / (pts.length - 1);
      c.beginPath();
      c.arc(pts[i][0] - 1.5, pts[i][1] - 1.5, 2.2 * (1 - t * 0.8), 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,230,230,0.5)';
      c.fill();
    }
    const [bx, by] = pts[0];
    smooth(c, [
      [bx - 14, by - 6],
      [bx - 4, by - 14],
      [bx + 10, by - 10],
      [bx + 12, by + 6],
      [bx, by + 14],
      [bx - 12, by + 8],
    ]);
    fillInk(c, rad(c, bx - 3, by - 3, 16, [
      [0, '#a89890'],
      [1, '#4a3e38'],
    ]), 3);
  },

  // ---------------------------------------------------------------- tools & keepsakes
  'walking-staff': (c) =>
    at(c, 64, 64, Math.PI / 4, () => {
      const len = 78;
      drop(c, () => {
        roundRect(c, -5, -len, 10, len * 2, 5);
        c.fillStyle = '#7a5030';
        c.fill();
      });
      roundRect(c, -5, -len + 6, 10, len * 2 - 6, 5);
      fillInk(c, lin(c, -5, 0, 5, 0, WOOD), 3);
      // Knots along the shaft.
      for (const y of [-20, 18, 50]) {
        ellipse(c, 2, y, 3, 2);
        c.fillStyle = '#3b2210';
        c.fill();
      }
      // A gnarled head.
      smooth(c, [
        [-12, -len - 6],
        [0, -len - 14],
        [12, -len - 4],
        [10, -len + 12],
        [-8, -len + 14],
      ]);
      fillInk(c, rad(c, -3, -len - 6, 18, [
        [0, '#c08a50'],
        [1, '#4a2a12'],
      ]));
      // A leather grip, bound round.
      roundRect(c, -7, -len + 22, 14, 26, 3);
      fillInk(c, lin(c, -7, 0, 7, 0, LEATHER), 2.5);
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = 1.5;
      for (let y = -len + 26; y < -len + 46; y += 5) {
        c.beginPath();
        c.moveTo(-7, y);
        c.lineTo(7, y + 3);
        c.stroke();
      }
      // An iron ferrule at the foot.
      roundRect(c, -6, len - 10, 12, 12, 3);
      fillInk(c, lin(c, -6, 0, 6, 0, STEEL), 2.5);
    }),

  'river-stone': (c) => {
    // A smooth river stone, a rune scratched into it, on a leather cord.
    c.beginPath();
    c.moveTo(22, 10);
    c.bezierCurveTo(20, 50, 48, 62, 64, 64);
    c.bezierCurveTo(80, 62, 108, 50, 106, 10);
    c.strokeStyle = INK;
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.stroke();
    c.strokeStyle = '#8a5530';
    c.lineWidth = 3.5;
    c.stroke();
    roundRect(c, 58, 56, 12, 12, 3);
    fillInk(c, lin(c, 58, 0, 70, 0, LEATHER), 2.5);
    ellipse(c, 64, 92, 30, 26, 0.2);
    drop(c, () => {
      c.fillStyle = '#6a7880';
      c.fill();
    });
    ellipse(c, 64, 92, 30, 26, 0.2);
    fillInk(c, rad(c, 52, 80, 40, [
      [0, '#d8e4ea'],
      [0.45, '#8a9ca8'],
      [1, '#3a4650'],
    ]));
    // A faint band of quartz, and the rune.
    c.save();
    ellipse(c, 64, 92, 30, 26, 0.2);
    c.clip();
    c.beginPath();
    c.moveTo(30, 100);
    c.quadraticCurveTo(64, 86, 98, 104);
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 4;
    c.stroke();
    c.restore();
    c.save();
    c.shadowColor = 'rgba(140,220,255,0.9)';
    c.shadowBlur = 8;
    c.beginPath();
    c.moveTo(64, 78);
    c.lineTo(64, 106);
    c.moveTo(64, 84);
    c.lineTo(74, 92);
    c.moveTo(64, 92);
    c.lineTo(54, 100);
    c.strokeStyle = '#c8ecff';
    c.lineWidth = 3;
    c.stroke();
    c.restore();
    shine(c, 50, 80, 10, 6, -0.5, 0.6);
  },

  'silver-ring': (c) => {
    // A thick silver band at an angle, a garnet set in the top.
    drop(c, () => {
      ellipse(c, 64, 76, 44, 30);
      c.lineWidth = 16;
      c.strokeStyle = '#a0a8b0';
      c.stroke();
    });
    ellipse(c, 64, 76, 44, 30);
    c.strokeStyle = INK;
    c.lineWidth = 20;
    c.stroke();
    c.strokeStyle = lin(c, 20, 0, 108, 0, [
      [0, '#5a646e'],
      [0.25, '#e8eef4'],
      [0.4, '#ffffff'],
      [0.6, '#9aa4ae'],
      [0.85, '#dfe6ec'],
      [1, '#4a545e'],
    ]);
    c.lineWidth = 13;
    c.stroke();
    ellipse(c, 64, 82, 42, 26);
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 2;
    c.stroke();
    // The setting and the stone.
    c.beginPath();
    c.moveTo(46, 50);
    c.lineTo(82, 50);
    c.lineTo(74, 32);
    c.lineTo(54, 32);
    c.closePath();
    fillInk(c, lin(c, 46, 0, 82, 0, STEEL), 3);
    c.save();
    c.shadowColor = 'rgba(255,60,80,0.8)';
    c.shadowBlur = 10;
    c.beginPath();
    c.moveTo(64, 10);
    c.lineTo(80, 24);
    c.lineTo(74, 40);
    c.lineTo(54, 40);
    c.lineTo(48, 24);
    c.closePath();
    c.fillStyle = rad(c, 60, 20, 26, [
      [0, '#ffb0b8'],
      [0.35, '#d02040'],
      [1, '#4a0612'],
    ]);
    c.fill();
    c.restore();
    ink(c, 3);
    c.beginPath();
    c.moveTo(48, 24);
    c.lineTo(80, 24);
    c.moveTo(64, 10);
    c.lineTo(58, 24);
    c.lineTo(64, 40);
    c.strokeStyle = 'rgba(255,200,210,0.5)';
    c.lineWidth = 1.5;
    c.stroke();
  },

  'straw-hat': (c) => {
    // A wide-brimmed straw hat with a red band.
    ellipse(c, 64, 82, 58, 24);
    drop(c, () => {
      c.fillStyle = '#c8a050';
      c.fill();
    });
    ellipse(c, 64, 82, 58, 24);
    clipped(c, () => {
      c.fillStyle = rad(c, 54, 74, 64, [
        [0, '#fbe6a0'],
        [0.6, '#e0b860'],
        [1, '#8a6420'],
      ]);
      c.fillRect(0, 0, 128, 128);
      c.strokeStyle = 'rgba(140,100,30,0.45)';
      c.lineWidth = 1.5;
      for (let r = 30; r < 64; r += 6) {
        ellipse(c, 64, 82, r, r * 0.41);
        c.stroke();
      }
    });
    ink(c);
    c.beginPath();
    c.moveTo(30, 80);
    c.bezierCurveTo(28, 30, 100, 30, 98, 80);
    c.bezierCurveTo(80, 90, 48, 90, 30, 80);
    c.closePath();
    fillInk(c, rad(c, 54, 46, 54, [
      [0, '#fff0b8'],
      [0.5, '#e8c070'],
      [1, '#9a7028'],
    ]));
    // Weave on the crown.
    c.save();
    c.clip();
    c.strokeStyle = 'rgba(140,100,30,0.4)';
    c.lineWidth = 1.5;
    for (let y = 44; y < 80; y += 6) {
      c.beginPath();
      c.moveTo(28, y);
      c.quadraticCurveTo(64, y + 6, 100, y);
      c.stroke();
    }
    c.restore();
    c.beginPath();
    c.moveTo(31, 68);
    c.bezierCurveTo(48, 78, 80, 78, 97, 68);
    c.lineTo(98, 78);
    c.bezierCurveTo(80, 88, 48, 88, 30, 78);
    c.closePath();
    fillInk(c, lin(c, 0, 68, 0, 86, [
      [0, '#e05040'],
      [1, '#7a1a14'],
    ]), 2.5);
    shine(c, 50, 48, 10, 6, -0.3, 0.5);
  },

  'hunting-knife': (c) =>
    at(c, 60, 70, Math.PI / 4, () => {
      // A clip-point blade over a stag-horn handle.
      c.beginPath();
      c.moveTo(-8, 0);
      c.lineTo(-8, -50);
      c.quadraticCurveTo(-6, -64, 2, -76);
      c.lineTo(6, -60);
      c.lineTo(9, -54);
      c.lineTo(9, 0);
      c.closePath();
      drop(c, () => {
        c.fillStyle = '#8a929a';
        c.fill();
      });
      c.fillStyle = lin(c, -8, 0, 9, 0, STEEL);
      c.fill();
      ink(c, 3);
      c.beginPath();
      c.moveTo(-4, -4);
      c.lineTo(-4, -50);
      c.quadraticCurveTo(-2, -60, 2, -68);
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 2;
      c.stroke();
      roundRect(c, -15, -2, 30, 8, 3);
      fillInk(c, lin(c, 0, -2, 0, 6, GOLD), 2.5);
      c.beginPath();
      c.moveTo(-8, 6);
      c.lineTo(8, 6);
      c.quadraticCurveTo(12, 30, 8, 46);
      c.quadraticCurveTo(0, 52, -8, 46);
      c.quadraticCurveTo(-11, 30, -8, 6);
      c.closePath();
      fillInk(c, lin(c, -10, 0, 10, 0, [
        [0, '#5a4630'],
        [0.4, '#e0d0b0'],
        [1, '#6a5438'],
      ]), 3);
      c.strokeStyle = 'rgba(70,50,30,0.6)';
      c.lineWidth = 1.5;
      for (const y of [16, 26, 36]) {
        c.beginPath();
        c.moveTo(-6, y);
        c.lineTo(4, y + 3);
        c.stroke();
      }
    }),

  'short-sword': (c) =>
    at(c, 52, 76, Math.PI / 4, () => {
      drop(c, () => sword(c, 70, 13));
      sword(c, 70, 13);
    }),

  // ---------------------------------------------------------------- clothing & armour
  tunic: (c) => {
    // A linen tunic, sleeves out, laced at the neck.
    const path = () => {
      c.beginPath();
      c.moveTo(46, 16);
      c.quadraticCurveTo(64, 26, 82, 16);
      c.lineTo(110, 28);
      c.lineTo(122, 64);
      c.lineTo(104, 70);
      c.lineTo(96, 50);
      c.lineTo(98, 114);
      c.quadraticCurveTo(64, 120, 30, 114);
      c.lineTo(32, 50);
      c.lineTo(24, 70);
      c.lineTo(6, 64);
      c.lineTo(18, 28);
      c.closePath();
    };
    drop(c, () => {
      path();
      c.fillStyle = '#d8c8a8';
      c.fill();
    });
    path();
    clipped(c, () => {
      c.fillStyle = rad(c, 54, 46, 80, [
        [0, '#fff8e8'],
        [0.5, '#e4d4b4'],
        [1, '#9a8a6a'],
      ]);
      c.fillRect(0, 0, 128, 128);
      // Folds and a woven belt.
      c.strokeStyle = 'rgba(120,100,70,0.45)';
      c.lineWidth = 2;
      for (const [x0, x1] of [
        [44, 40],
        [80, 86],
        [62, 60],
      ]) {
        c.beginPath();
        c.moveTo(x0, 92);
        c.lineTo(x1, 114);
        c.stroke();
      }
      c.fillStyle = lin(c, 0, 80, 0, 90, [
        [0, '#8a5530'],
        [1, '#4a2a14'],
      ]);
      c.fillRect(20, 80, 90, 10);
      c.fillStyle = '#e8c060';
      c.fillRect(58, 79, 12, 12);
      c.fillStyle = '#5a3a14';
      c.fillRect(61, 82, 6, 6);
      // Cuff hems.
      c.fillStyle = 'rgba(140,110,70,0.5)';
      c.beginPath();
      c.moveTo(6, 64);
      c.lineTo(24, 70);
      c.lineTo(26, 64);
      c.lineTo(9, 57);
      c.fill();
      c.beginPath();
      c.moveTo(122, 64);
      c.lineTo(104, 70);
      c.lineTo(102, 64);
      c.lineTo(119, 57);
      c.fill();
    });
    ink(c);
    // The neck slit and its lacing.
    c.beginPath();
    c.moveTo(64, 24);
    c.lineTo(64, 46);
    c.strokeStyle = INK;
    c.lineWidth = 2.5;
    c.stroke();
    c.beginPath();
    c.moveTo(58, 28);
    c.lineTo(70, 34);
    c.moveTo(70, 28);
    c.lineTo(58, 34);
    c.moveTo(58, 36);
    c.lineTo(70, 42);
    c.moveTo(70, 36);
    c.lineTo(58, 42);
    c.strokeStyle = '#7a4a2a';
    c.lineWidth = 2;
    c.stroke();
  },

  jerkin: (c) => {
    // A sleeveless leather jerkin, stitched, buckled down the front.
    const path = () => {
      c.beginPath();
      c.moveTo(42, 12);
      c.lineTo(56, 14);
      c.lineTo(64, 34);
      c.lineTo(72, 14);
      c.lineTo(86, 12);
      c.quadraticCurveTo(96, 30, 108, 38);
      c.lineTo(104, 112);
      c.quadraticCurveTo(64, 122, 24, 112);
      c.lineTo(20, 38);
      c.quadraticCurveTo(32, 30, 42, 12);
      c.closePath();
    };
    drop(c, () => {
      path();
      c.fillStyle = '#6a3e20';
      c.fill();
    });
    path();
    clipped(c, () => {
      c.fillStyle = rad(c, 52, 50, 80, [
        [0, '#c0804a'],
        [0.5, '#8a5028'],
        [1, '#3a1e0c'],
      ]);
      c.fillRect(0, 0, 128, 128);
      // Panels of stitching.
      c.setLineDash([3, 3]);
      c.strokeStyle = 'rgba(240,210,160,0.6)';
      c.lineWidth = 1.5;
      for (const x of [30, 98]) {
        c.beginPath();
        c.moveTo(x, 42);
        c.lineTo(x + (x < 64 ? 2 : -2), 110);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(24, 70);
      c.quadraticCurveTo(64, 78, 104, 70);
      c.stroke();
      c.setLineDash([]);
      // The front seam.
      c.beginPath();
      c.moveTo(64, 34);
      c.lineTo(64, 118);
      c.strokeStyle = 'rgba(30,14,4,0.8)';
      c.lineWidth = 2.5;
      c.stroke();
    });
    ink(c);
    // Straps and brass buckles.
    for (const y of [52, 76, 98]) {
      c.fillStyle = '#2e180a';
      c.fillRect(52, y - 3, 24, 6);
      roundRect(c, 58, y - 6, 12, 12, 2);
      c.strokeStyle = INK;
      c.lineWidth = 4.5;
      c.stroke();
      c.strokeStyle = '#f0c868';
      c.lineWidth = 2.5;
      c.stroke();
    }
    // Shoulder studs.
    for (const [x, y] of [
      [36, 26],
      [92, 26],
      [44, 18],
      [84, 18],
    ]) {
      c.beginPath();
      c.arc(x, y, 3, 0, Math.PI * 2);
      fillInk(c, rad(c, x - 1, y - 1, 3, [
        [0, '#ffffff'],
        [1, '#8a96a2'],
      ]), 1.5);
    }
  },

  'wool-hood': (c) => {
    // A grey wool hood and shoulder cape, its opening in shadow.
    const path = () => {
      c.beginPath();
      c.moveTo(64, 8);
      c.bezierCurveTo(98, 8, 104, 50, 98, 70);
      c.quadraticCurveTo(118, 84, 120, 112);
      c.quadraticCurveTo(64, 124, 8, 112);
      c.quadraticCurveTo(10, 84, 30, 70);
      c.bezierCurveTo(24, 50, 30, 8, 64, 8);
      c.closePath();
    };
    drop(c, () => {
      path();
      c.fillStyle = '#7a7470';
      c.fill();
    });
    path();
    clipped(c, () => {
      c.fillStyle = rad(c, 52, 34, 90, [
        [0, '#d8d0c4'],
        [0.45, '#968c80'],
        [1, '#3a3430'],
      ]);
      c.fillRect(0, 0, 128, 128);
      // The knit of the wool.
      const r = rng(71);
      c.strokeStyle = 'rgba(60,54,48,0.25)';
      c.lineWidth = 1.2;
      for (let i = 0; i < 120; i++) {
        const x = 8 + r() * 112;
        const y = 8 + r() * 114;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + 2, y + 3);
        c.lineTo(x + 4, y);
        c.stroke();
      }
      // Folds in the cape.
      c.strokeStyle = 'rgba(40,36,32,0.45)';
      c.lineWidth = 2.5;
      for (const [x0, x1] of [
        [36, 26],
        [92, 102],
        [56, 52],
        [74, 78],
      ]) {
        c.beginPath();
        c.moveTo(x0, 82);
        c.quadraticCurveTo((x0 + x1) / 2 + 3, 98, x1, 118);
        c.stroke();
      }
    });
    ink(c);
    // The opening.
    c.beginPath();
    c.moveTo(64, 24);
    c.bezierCurveTo(86, 24, 88, 56, 80, 76);
    c.quadraticCurveTo(64, 84, 48, 76);
    c.bezierCurveTo(40, 56, 42, 24, 64, 24);
    c.closePath();
    fillInk(c, rad(c, 64, 60, 34, [
      [0, '#0a0806'],
      [0.7, '#1e1a16'],
      [1, '#4a4440'],
    ]), 3);
    // A wooden toggle at the throat.
    roundRect(c, 58, 82, 12, 6, 3);
    fillInk(c, '#a26a38', 2);
    shine(c, 50, 22, 9, 5, -0.6, 0.45);
  },

  'iron-cap': (c) => {
    // A riveted iron skullcap with a nasal guard.
    c.beginPath();
    c.moveTo(16, 86);
    c.bezierCurveTo(14, 20, 114, 20, 112, 86);
    c.closePath();
    drop(c, () => {
      c.fillStyle = '#5a646e';
      c.fill();
    });
    fillInk(c, rad(c, 48, 38, 80, [
      [0, '#ffffff'],
      [0.18, '#d8e0e8'],
      [0.55, '#7a8692'],
      [1, '#2a3038'],
    ]));
    // A raised ridge over the crown.
    c.beginPath();
    c.moveTo(64, 36);
    c.lineTo(64, 86);
    c.strokeStyle = INK;
    c.lineWidth = 9;
    c.stroke();
    c.strokeStyle = lin(c, 58, 0, 70, 0, STEEL);
    c.lineWidth = 5;
    c.stroke();
    // The brow band.
    roundRect(c, 12, 80, 104, 14, 5);
    fillInk(c, lin(c, 0, 80, 0, 94, STEEL));
    for (const x of [24, 44, 84, 104]) {
      c.beginPath();
      c.arc(x, 87, 3, 0, Math.PI * 2);
      fillInk(c, rad(c, x - 1, 86, 3, [
        [0, '#ffffff'],
        [1, '#5a646e'],
      ]), 1.5);
    }
    // The nasal.
    c.beginPath();
    c.moveTo(58, 84);
    c.lineTo(70, 84);
    c.lineTo(68, 118);
    c.quadraticCurveTo(64, 122, 60, 118);
    c.closePath();
    fillInk(c, lin(c, 58, 0, 70, 0, STEEL), 3);
    shine(c, 42, 44, 12, 7, -0.6, 0.6);
  },

  buckler: (c) => {
    // A round wooden buckler, rimmed in iron, with a domed boss.
    ellipse(c, 64, 64, 54, 54);
    drop(c, () => {
      c.fillStyle = '#6a4020';
      c.fill();
    });
    ellipse(c, 64, 64, 54, 54);
    clipped(c, () => {
      c.fillStyle = lin(c, 10, 0, 118, 0, WOOD);
      c.fillRect(0, 0, 128, 128);
      c.strokeStyle = 'rgba(30,14,4,0.7)';
      c.lineWidth = 2;
      for (const x of [30, 48, 80, 98]) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, 128);
        c.stroke();
      }
      // Painted quarters: a green cross over the boards.
      c.fillStyle = 'rgba(40,110,60,0.7)';
      c.fillRect(54, 0, 20, 128);
      c.fillRect(0, 54, 128, 20);
      c.fillStyle = rad(c, 50, 46, 80, [
        [0, 'rgba(255,230,190,0.25)'],
        [0.6, 'rgba(0,0,0,0)'],
        [1, 'rgba(0,0,0,0.5)'],
      ]);
      c.fillRect(0, 0, 128, 128);
    });
    ink(c);
    // The iron rim, studded.
    ellipse(c, 64, 64, 50, 50);
    c.strokeStyle = INK;
    c.lineWidth = 11;
    c.stroke();
    c.strokeStyle = lin(c, 14, 14, 114, 114, STEEL);
    c.lineWidth = 7;
    c.stroke();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      c.beginPath();
      c.arc(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50, 2.4, 0, Math.PI * 2);
      c.fillStyle = '#2a3038';
      c.fill();
    }
    // The boss.
    c.beginPath();
    c.arc(64, 64, 17, 0, Math.PI * 2);
    fillInk(c, rad(c, 58, 58, 22, [
      [0, '#ffffff'],
      [0.3, '#c8d0d8'],
      [1, '#3a424a'],
    ]));
  },

  boots: (c) => {
    boot(c, 58, 96, 1.25, false, LEATHER, '#a87048');
    boot(c, 36, 108, 1.25, false, [
      [0, '#4a2a14'],
      [0.45, '#a06a3c'],
      [1, '#3a2010'],
    ], '#c08858');
  },

  'riding-boots': (c) => {
    const black: Stops = [
      [0, '#16100c'],
      [0.45, '#5a3e2c'],
      [1, '#120c08'],
    ];
    boot(c, 62, 92, 1.15, true, black, '#7a5438');
    boot(c, 40, 106, 1.15, true, black, '#8a6040');
  },

  // ---------------------------------------------------------------- coin
  coin: (c) => {
    // A thick copper penny, its rim milled, a cross struck in the middle.
    ellipse(c, 64, 70, 50, 50);
    drop(c, () => {
      c.fillStyle = '#7a4418';
      c.fill();
    });
    ellipse(c, 64, 70, 50, 50);
    fillInk(c, '#6a3a14');
    ellipse(c, 64, 62, 50, 50);
    fillInk(c, rad(c, 48, 44, 74, [
      [0, '#ffd8a0'],
      [0.35, '#e09848'],
      [0.8, '#9a5a22'],
      [1, '#6a3a14'],
    ]));
    ellipse(c, 64, 62, 38, 38);
    c.strokeStyle = 'rgba(90,46,14,0.7)';
    c.lineWidth = 3;
    c.stroke();
    c.save();
    c.shadowColor = 'rgba(70,30,6,0.8)';
    c.shadowOffsetX = 2;
    c.shadowOffsetY = 2;
    c.fillStyle = '#f8c080';
    roundRect(c, 58, 36, 12, 52, 3);
    c.fill();
    roundRect(c, 40, 56, 48, 12, 3);
    c.fill();
    c.restore();
    shine(c, 44, 40, 14, 8, -0.6, 0.65);
  },

  // ---------------------------------------------------- brewing and cooking

  'fever-tincture': (c) => {
    // A small round-bellied flask of pale, glowing moonpetal tincture, corked, with a sprig tied at the neck.
    const flask = (): void => {
      c.beginPath();
      c.moveTo(54, 22);
      c.lineTo(74, 22);
      c.lineTo(74, 44);
      c.bezierCurveTo(104, 52, 112, 82, 100, 100);
      c.bezierCurveTo(90, 116, 38, 116, 28, 100);
      c.bezierCurveTo(16, 82, 24, 52, 54, 44);
      c.closePath();
    };
    flask();
    drop(c, () => {
      c.fillStyle = 'rgba(190,220,235,0.35)';
      c.fill();
    });
    flask();
    clipped(c, () => {
      c.fillStyle = rad(c, 64, 84, 50, [
        [0, '#f4fff8'],
        [0.35, '#a8e8e0'],
        [0.8, '#4aa0b8'],
        [1, '#2a5a7a'],
      ]);
      c.fillRect(0, 60, 128, 68);
      // The meniscus.
      ellipse(c, 64, 60, 40, 5);
      c.fillStyle = 'rgba(230,255,250,0.7)';
      c.fill();
      // A few motes of moonpetal, still shining.
      const r = rng(21);
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.arc(36 + r() * 56, 68 + r() * 36, 1.2 + r() * 2, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,255,240,0.9)';
        c.fill();
      }
    });
    flask();
    ink(c);
    // The cork.
    roundRect(c, 50, 10, 28, 16, 4);
    fillInk(c, lin(c, 50, 0, 78, 0, [
      [0, '#8a6038'],
      [0.5, '#c89860'],
      [1, '#7a5030'],
    ]), 3);
    // A cord and a little sprig of willow leaves at the neck.
    c.beginPath();
    c.moveTo(52, 34);
    c.lineTo(76, 34);
    c.strokeStyle = '#d8c090';
    c.lineWidth = 3;
    c.stroke();
    for (const [x, y, rot] of [
      [84, 38, 0.6],
      [88, 30, -0.1],
    ]) {
      ellipse(c, x, y, 10, 4, rot);
      fillInk(c, '#8ab070', 2);
    }
    shine(c, 44, 72, 7, 16, 0.3, 0.7);
  },

  'raw-hare': (c) => meat(c, 'leg', false, ['#f0a8a0', '#d06a64', '#7a2a28']),
  'wolf-meat': (c) => meat(c, 'slab', false, ['#c86058', '#8e2a28', '#4a1010']),
  'boar-meat': (c) => meat(c, 'joint', false, ['#f0a090', '#c85a50', '#6a2018']),
  'roast-hare': (c) => {
    steam(c, 56, 34, 12);
    meat(c, 'leg', true, ['#e8a858', '#a85a24', '#4a200a']);
  },
  'wolf-steak': (c) => {
    steam(c, 60, 38, 14);
    meat(c, 'slab', true, ['#b8703a', '#6a3014', '#2e1206']);
  },
  'venison-steak': (c) => {
    steam(c, 60, 36, 14);
    meat(c, 'slab', true, ['#a8582e', '#5a2210', '#2a0c04']);
    // A sprig of rosemary laid over it.
    c.beginPath();
    c.moveTo(36, 66);
    c.lineTo(90, 52);
    c.strokeStyle = '#3a5a2a';
    c.lineWidth = 3;
    c.stroke();
    for (let i = 0; i < 8; i++) {
      const x = 40 + i * 6.5;
      const y = 65 - i * 1.7;
      ellipse(c, x, y - 4, 2, 6, 0.5);
      c.fillStyle = '#5a8a40';
      c.fill();
      ellipse(c, x + 2, y + 4, 2, 6, -0.6);
      c.fill();
    }
  },
  'roast-boar': (c) => {
    steam(c, 56, 30, 16);
    meat(c, 'joint', true, ['#e8a050', '#a0501c', '#4a1e08']);
  },
  'boiled-egg': (c) => {
    // Two halves of a boiled egg, the yolk bright.
    for (const [x, rot] of [
      [42, -0.25],
      [86, 0.25],
    ]) {
      at(c, x, 76, rot, () => {
        c.beginPath();
        c.moveTo(-28, 0);
        c.bezierCurveTo(-28, 30, 28, 30, 28, 0);
        c.bezierCurveTo(28, -30, -28, -30, -28, 0);
        drop(c, () => fillInk(c, rad(c, -8, -8, 36, [
          [0, '#ffffff'],
          [0.7, '#f0ece0'],
          [1, '#c8bca0'],
        ])));
        ellipse(c, 0, 0, 13, 12);
        fillInk(c, rad(c, -3, -3, 14, [
          [0, '#ffe890'],
          [0.6, '#f8b830'],
          [1, '#d88a10'],
        ]), 2.5);
        shine(c, -4, -5, 5, 3, 0, 0.6);
      });
    }
  },
  'hare-stew': (c) => bowl(c, ['#b8783e', '#86481e', '#4a2410'], ['#f08a2a', '#f0e0b0', '#e0a0a0', '#f08a2a', '#c8a0f0']),
  'hunters-pottage': (c) => bowl(c, ['#8a8a40', '#5a5a20', '#2e2e10'], ['#6a2a1a', '#8ac050', '#d8b070', '#6a2a1a', '#8ac050']),
};

/** Which painter makes each texture. */
const ICONS: Array<[string, string]> = [
  ['item-carrot', 'carrot'],
  ['item-cabbage', 'cabbage'],
  ['item-turnip', 'turnip'],
  ['item-apple', 'apple'],
  ['item-bread', 'bread'],
  ['item-pinecone', 'pinecone'],
  ['item-stick', 'stick'],
  ['item-staff', 'walking-staff'],
  ['item-hat', 'straw-hat'],
  ['item-tunic', 'tunic'],
  ['item-boots', 'boots'],
  ['item-charm', 'river-stone'],
  ['item-ring', 'silver-ring'],
  ['item-pelt', 'wolf-pelt'],
  ['item-cheese', 'cheese'],
  ['item-pie', 'pie'],
  ['item-honeycake', 'honey-cake'],
  ['item-knife', 'hunting-knife'],
  ['item-sword', 'short-sword'],
  ['item-buckler', 'buckler'],
  ['item-ironcap', 'iron-cap'],
  ['item-jerkin', 'jerkin'],
  ['item-hood', 'wool-hood'],
  ['item-ridingboots', 'riding-boots'],
  ['item-coin', 'coin'],
  ['item-feed', 'chicken-feed'],
  ['item-egg', 'egg'],
  ['item-venison', 'venison'],
  ['item-deerhide', 'deer-hide'],
  ['item-harepelt', 'hare-pelt'],
  ['item-tusk', 'boar-tusk'],
  ['item-whitehide', 'white-hide'],
  ['item-moonpetal', 'moonpetal'],
  ['item-willowbark', 'willow-bark'],
  ['item-ale', 'ale'],
  ['item-cider', 'cider'],
  ['item-mead', 'mead'],
  ['item-wine', 'spiced-wine'],
  ['item-stew', 'stew'],
  ['item-rattail', 'rat-tail'],
  ['item-fever-tincture', 'fever-tincture'],
  ['item-raw-hare', 'raw-hare'],
  ['item-wolf-meat', 'wolf-meat'],
  ['item-boar-meat', 'boar-meat'],
  ['item-roast-hare', 'roast-hare'],
  ['item-wolf-steak', 'wolf-steak'],
  ['item-venison-steak', 'venison-steak'],
  ['item-roast-boar', 'roast-boar'],
  ['item-boiled-egg', 'boiled-egg'],
  ['item-hare-stew', 'hare-stew'],
  ['item-hunters-pottage', 'hunters-pottage'],
];

export function generateItemIcons(scene: Phaser.Scene): void {
  for (const [key, painter] of ICONS) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, ICON_SIZE, ICON_SIZE);
    if (!tex) continue;
    const c = tex.getContext();
    c.save();
    PAINTERS[painter](c);
    c.restore();
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
}
