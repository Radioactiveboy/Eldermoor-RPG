import Phaser from 'phaser';
import type { AbilityId } from '../systems/Abilities';

/**
 * Painted icons for the combat hotbar. Each is drawn once with the browser's
 * canvas (gradients, glows and soft shadows, so they read as small paintings
 * rather than flat shapes) into a texture 'ability-<id>', at ICON_SIZE pixels,
 * and shown scaled down on the hotbar so the edges stay smooth.
 *
 * Every icon sits on a dark tile lit from the middle in its own colour, with
 * its corners rounded. To add one, add a painter to PAINTERS.
 */
export const ICON_SIZE = 128;
const S = ICON_SIZE;
const RADIUS = 18;

type Ctx = CanvasRenderingContext2D;

interface Painter {
  /** The glow behind the subject. */
  glow: string;
  paint: (c: Ctx) => void;
}

// ------------------------------------------------------------ helpers

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Run `draw` with the origin moved to (x, y) and turned by `angle` (radians). */
function at(c: Ctx, x: number, y: number, angle: number, draw: () => void): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  draw();
  c.restore();
}

/** A soft dark shadow under whatever `draw` paints. */
function shadowed(c: Ctx, draw: () => void, blur = 10, dy = 5): void {
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.65)';
  c.shadowBlur = blur;
  c.shadowOffsetY = dy;
  draw();
  c.restore();
}

/** A gradient across a band from x0 to x1 (horizontal in the current frame). */
function across(c: Ctx, x0: number, x1: number, stops: Array<[number, string]>): CanvasGradient {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

function down(c: Ctx, y0: number, y1: number, stops: Array<[number, string]>): CanvasGradient {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

function radial(c: Ctx, x: number, y: number, r: number, stops: Array<[number, string]>): CanvasGradient {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [t, col] of stops) g.addColorStop(t, col);
  return g;
}

const STEEL: Array<[number, string]> = [
  [0, '#5d6874'],
  [0.35, '#e9eef2'],
  [0.5, '#ffffff'],
  [0.62, '#b9c3cc'],
  [1, '#46505a'],
];
const GOLD: Array<[number, string]> = [
  [0, '#6e4a12'],
  [0.4, '#f4d27a'],
  [0.55, '#fff2c0'],
  [1, '#8a5c14'],
];
const LEATHER: Array<[number, string]> = [
  [0, '#2e1a0e'],
  [0.45, '#7a4a28'],
  [1, '#2a170c'],
];
const WOOD: Array<[number, string]> = [
  [0, '#3b2210'],
  [0.4, '#a26a38'],
  [0.6, '#b97c44'],
  [1, '#3b2210'],
];

/** A sword pointing up the local y axis, its hilt at the origin. */
function sword(c: Ctx, length: number, width: number): void {
  const hw = width / 2;
  // Blade.
  c.beginPath();
  c.moveTo(-hw, 0);
  c.lineTo(-hw, -length + width * 1.4);
  c.lineTo(0, -length);
  c.lineTo(hw, -length + width * 1.4);
  c.lineTo(hw, 0);
  c.closePath();
  c.fillStyle = across(c, -hw, hw, STEEL);
  c.fill();
  c.lineWidth = 1.5;
  c.strokeStyle = 'rgba(20,24,30,0.9)';
  c.stroke();
  // Fuller down the middle.
  c.beginPath();
  c.moveTo(0, -4);
  c.lineTo(0, -length + width * 2.2);
  c.lineWidth = width * 0.18;
  c.strokeStyle = 'rgba(70,82,96,0.7)';
  c.stroke();
  // Crossguard.
  roundRect(c, -width * 2.1, -1, width * 4.2, width * 0.75, width * 0.3);
  c.fillStyle = down(c, -1, width * 0.75, GOLD);
  c.fill();
  c.strokeStyle = 'rgba(40,24,6,0.9)';
  c.lineWidth = 1.5;
  c.stroke();
  // Grip, wrapped in leather.
  const grip = width * 2.4;
  roundRect(c, -width * 0.38, width * 0.7, width * 0.76, grip, 2);
  c.fillStyle = across(c, -width * 0.38, width * 0.38, LEATHER);
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.5)';
  c.lineWidth = 1;
  for (let y = width * 0.95; y < width * 0.7 + grip; y += width * 0.42) {
    c.beginPath();
    c.moveTo(-width * 0.38, y);
    c.lineTo(width * 0.38, y + width * 0.2);
    c.stroke();
  }
  // Pommel.
  c.beginPath();
  c.arc(0, width * 0.85 + grip, width * 0.55, 0, Math.PI * 2);
  c.fillStyle = radial(c, -width * 0.2, width * 0.65 + grip, width * 0.7, [
    [0, '#fff2c0'],
    [0.5, '#d9a843'],
    [1, '#6e4a12'],
  ]);
  c.fill();
  c.strokeStyle = 'rgba(40,24,6,0.9)';
  c.stroke();
}

/** A five-pointed star with a soft glow. */
function star(c: Ctx, x: number, y: number, r: number, color: string): void {
  c.save();
  c.shadowColor = color;
  c.shadowBlur = r * 1.4;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fillStyle = radial(c, x - r * 0.2, y - r * 0.2, r, [
    [0, '#fffbe6'],
    [0.6, color],
    [1, '#b07a10'],
  ]);
  c.fill();
  c.restore();
}

/** A tapering crescent of light: a blade's trail. */
function slash(c: Ctx, cx: number, cy: number, r: number, from: number, to: number, thick: number, color: string): void {
  const steps = 40;
  c.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = from + (to - from) * t;
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const a = from + (to - from) * t;
    const rr = r - thick * Math.sin(Math.PI * Math.pow(t, 0.8));
    c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  c.closePath();
  c.save();
  c.shadowColor = color;
  c.shadowBlur = 14;
  const g = c.createLinearGradient(cx + Math.cos(from) * r, cy + Math.sin(from) * r, cx + Math.cos(to) * r, cy + Math.sin(to) * r);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.6, color);
  g.addColorStop(1, '#ffffff');
  c.fillStyle = g;
  c.fill();
  c.restore();
}

/** Short streaks of movement. */
function streaks(c: Ctx, lines: Array<[number, number, number]>, color: string, width = 4): void {
  c.lineCap = 'round';
  for (const [x, y, len] of lines) {
    const g = c.createLinearGradient(x, y, x + len, y);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, color);
    c.strokeStyle = g;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + len, y);
    c.stroke();
  }
}

function heartPath(c: Ctx, x: number, y: number, s: number): void {
  c.beginPath();
  c.moveTo(x, y + s * 0.95);
  c.bezierCurveTo(x - s * 1.25, y + s * 0.1, x - s * 1.05, y - s * 0.95, x, y - s * 0.38);
  c.bezierCurveTo(x + s * 1.05, y - s * 0.95, x + s * 1.25, y + s * 0.1, x, y + s * 0.95);
  c.closePath();
}

// ------------------------------------------------------------ the icons

const PAINTERS: Record<AbilityId, Painter> = {
  strike: {
    glow: '#5a7fa8',
    paint: (c) => {
      slash(c, 40, 92, 64, -Math.PI * 0.62, -Math.PI * 0.05, 14, 'rgba(190,220,255,0.85)');
      shadowed(c, () => at(c, 50, 82, Math.PI / 4, () => sword(c, 70, 13)));
    },
  },
  heavy: {
    glow: '#b0521e',
    paint: (c) => {
      // The impact: a burst of sparks where the hammer lands.
      c.fillStyle = radial(c, 98, 52, 44, [
        [0, 'rgba(255,230,150,0.95)'],
        [0.35, 'rgba(255,140,40,0.6)'],
        [1, 'rgba(255,80,0,0)'],
      ]);
      c.fillRect(40, 0, 88, 110);
      c.strokeStyle = '#ffe6a0';
      c.lineCap = 'round';
      for (const [a, l] of [[-0.2, 22], [0.5, 18], [1.2, 20], [-0.9, 16], [2.0, 14]] as const) {
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(100 + Math.cos(a) * 26, 54 + Math.sin(a) * 26);
        c.lineTo(100 + Math.cos(a) * (26 + l), 54 + Math.sin(a) * (26 + l));
        c.stroke();
      }
      shadowed(c, () =>
        at(c, 30, 116, Math.PI / 4.5, () => {
          // Haft.
          roundRect(c, -5, -78, 10, 92, 4);
          c.fillStyle = across(c, -5, 5, WOOD);
          c.fill();
          c.strokeStyle = 'rgba(0,0,0,0.7)';
          c.lineWidth = 1.5;
          c.stroke();
          roundRect(c, -6, -10, 12, 18, 3);
          c.fillStyle = across(c, -6, 6, LEATHER);
          c.fill();
          // Head: a heavy iron block with bevelled faces.
          roundRect(c, -30, -98, 60, 30, 5);
          c.fillStyle = down(c, -98, -68, [
            [0, '#f2f5f8'],
            [0.3, '#b8c2cc'],
            [0.7, '#69737e'],
            [1, '#2e353c'],
          ]);
          c.fill();
          c.strokeStyle = '#151a1f';
          c.lineWidth = 2;
          c.stroke();
          c.fillStyle = 'rgba(255,255,255,0.35)';
          c.fillRect(-26, -94, 52, 4);
          roundRect(c, -8, -100, 16, 34, 3);
          c.fillStyle = across(c, -8, 8, GOLD);
          c.fill();
          c.stroke();
        }),
      );
    },
  },
  stagger: {
    glow: '#a8862a',
    paint: (c) => {
      // Stars wheeling round a dazed head.
      c.save();
      c.strokeStyle = 'rgba(255,220,120,0.55)';
      c.lineWidth = 3;
      c.setLineDash([8, 7]);
      c.beginPath();
      c.ellipse(60, 40, 40, 14, -0.15, 0, Math.PI * 2);
      c.stroke();
      c.restore();
      star(c, 24, 42, 12, '#ffd34a');
      star(c, 66, 26, 10, '#ffd34a');
      star(c, 96, 46, 13, '#ffd34a');
      shadowed(c, () => at(c, 70, 112, -Math.PI / 7, () => sword(c, 68, 12)));
    },
  },
  sweep: {
    glow: '#3f78a0',
    paint: (c) => {
      slash(c, 64, 82, 52, Math.PI * 0.95, Math.PI * 2.05, 18, 'rgba(170,215,255,0.9)');
      slash(c, 64, 82, 38, Math.PI * 1.05, Math.PI * 1.95, 9, 'rgba(255,255,255,0.55)');
      shadowed(c, () => at(c, 98, 92, Math.PI * 0.32, () => sword(c, 58, 11)));
      // The foes caught by it.
      for (const [x, y] of [[22, 104], [46, 112], [82, 112]] as const) {
        c.fillStyle = radial(c, x, y, 9, [
          [0, 'rgba(255,120,90,0.95)'],
          [1, 'rgba(160,30,20,0)'],
        ]);
        c.beginPath();
        c.arc(x, y, 9, 0, Math.PI * 2);
        c.fill();
      }
    },
  },
  brace: {
    glow: '#5f6f8a',
    paint: (c) => {
      shadowed(c, () => {
        const cx = 64;
        const cy = 64;
        // Planks.
        c.beginPath();
        c.arc(cx, cy, 46, 0, Math.PI * 2);
        c.fillStyle = radial(c, cx - 14, cy - 16, 64, [
          [0, '#c8884c'],
          [0.6, '#7c4a24'],
          [1, '#3a200e'],
        ]);
        c.fill();
        c.save();
        c.clip();
        c.strokeStyle = 'rgba(40,20,8,0.6)';
        c.lineWidth = 2;
        for (let x = cx - 46; x < cx + 46; x += 15) {
          c.beginPath();
          c.moveTo(x, cy - 50);
          c.lineTo(x, cy + 50);
          c.stroke();
        }
        c.restore();
        // Iron rim with rivets.
        c.beginPath();
        c.arc(cx, cy, 46, 0, Math.PI * 2);
        c.lineWidth = 8;
        c.strokeStyle = down(c, cy - 46, cy + 46, [
          [0, '#e3e8ec'],
          [0.5, '#7c8792'],
          [1, '#2a3036'],
        ]);
        c.stroke();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          c.beginPath();
          c.arc(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46, 2.4, 0, Math.PI * 2);
          c.fillStyle = '#f2f5f8';
          c.fill();
        }
        // Boss.
        c.beginPath();
        c.arc(cx, cy, 15, 0, Math.PI * 2);
        c.fillStyle = radial(c, cx - 5, cy - 6, 18, [
          [0, '#ffffff'],
          [0.3, '#cfd6dc'],
          [1, '#3c444c'],
        ]);
        c.fill();
        c.strokeStyle = '#1a1f24';
        c.lineWidth = 2;
        c.stroke();
      });
      // A glint of guard.
      c.strokeStyle = 'rgba(150,210,255,0.8)';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(64, 64, 56, -Math.PI * 0.85, -Math.PI * 0.35);
      c.stroke();
    },
  },
  item: {
    glow: '#9a6a26',
    paint: (c) => {
      // Steam rising off a warm loaf.
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 4;
      c.lineCap = 'round';
      for (const x of [46, 64, 82]) {
        c.beginPath();
        c.moveTo(x, 50);
        c.bezierCurveTo(x - 10, 38, x + 10, 30, x, 16);
        c.stroke();
      }
      shadowed(c, () => {
        c.beginPath();
        c.ellipse(64, 80, 48, 28, 0, 0, Math.PI * 2);
        c.fillStyle = radial(c, 52, 66, 60, [
          [0, '#f4c47a'],
          [0.45, '#c9822e'],
          [1, '#5e3010'],
        ]);
        c.fill();
        c.strokeStyle = '#3a1c08';
        c.lineWidth = 2;
        c.stroke();
      });
      // Scored crust.
      c.lineCap = 'round';
      for (const x of [40, 58, 76, 94]) {
        c.strokeStyle = '#6e3a12';
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(x - 6, 72);
        c.quadraticCurveTo(x, 66, x + 6, 74);
        c.stroke();
        c.strokeStyle = 'rgba(255,230,170,0.6)';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x - 5, 69);
        c.quadraticCurveTo(x, 64, x + 4, 70);
        c.stroke();
      }
    },
  },
  flee: {
    glow: '#3f7a50',
    paint: (c) => {
      streaks(c, [[8, 46, 30], [4, 62, 34], [10, 78, 28]], 'rgba(220,240,200,0.85)', 5);
      // Dust kicked up behind.
      for (const [x, y, r] of [[30, 104, 9], [18, 110, 6], [42, 112, 5]] as const) {
        c.fillStyle = 'rgba(200,180,140,0.45)';
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
      shadowed(c, () =>
        at(c, 70, 64, -0.18, () => {
          // A boot mid-stride.
          c.beginPath();
          c.moveTo(-14, -42);
          c.lineTo(12, -42);
          c.lineTo(14, 14);
          c.quadraticCurveTo(40, 14, 46, 26);
          c.lineTo(46, 34);
          c.lineTo(-16, 34);
          c.closePath();
          c.fillStyle = across(c, -16, 46, [
            [0, '#3a2210'],
            [0.3, '#8a5630'],
            [0.55, '#a46a3c'],
            [1, '#4a2a12'],
          ]);
          c.fill();
          c.strokeStyle = '#1e1006';
          c.lineWidth = 2.5;
          c.stroke();
          // Cuff, sole and laces.
          roundRect(c, -17, -48, 32, 12, 4);
          c.fillStyle = across(c, -17, 15, LEATHER);
          c.fill();
          c.stroke();
          roundRect(c, -18, 30, 66, 8, 3);
          c.fillStyle = '#20140a';
          c.fill();
          c.strokeStyle = 'rgba(255,230,180,0.6)';
          c.lineWidth = 2;
          for (let y = -30; y < 8; y += 9) {
            c.beginPath();
            c.moveTo(4, y);
            c.lineTo(13, y + 4);
            c.stroke();
          }
        }),
      );
    },
  },
  shove: {
    glow: '#b0601e',
    paint: (c) => {
      // Shockwaves ahead of the blow.
      c.lineCap = 'round';
      for (const [r, a] of [[30, 0.9], [42, 0.6], [54, 0.35]] as const) {
        c.strokeStyle = `rgba(255,200,120,${a})`;
        c.lineWidth = 5;
        c.beginPath();
        c.arc(54, 64, r, -0.7, 0.7);
        c.stroke();
      }
      streaks(c, [[4, 50, 24], [2, 78, 26]], 'rgba(255,230,190,0.7)', 4);
      shadowed(c, () => {
        // Bracer.
        roundRect(c, 14, 46, 30, 36, 6);
        c.fillStyle = down(c, 46, 82, LEATHER);
        c.fill();
        c.strokeStyle = '#1e1006';
        c.lineWidth = 2;
        c.stroke();
        c.strokeStyle = '#d9a843';
        c.beginPath();
        c.moveTo(22, 46);
        c.lineTo(22, 82);
        c.moveTo(34, 46);
        c.lineTo(34, 82);
        c.stroke();
        // The fist: knuckles to the right, in a leather glove.
        roundRect(c, 40, 40, 44, 48, 14);
        c.fillStyle = radial(c, 54, 50, 50, [
          [0, '#c08452'],
          [0.6, '#7a4a28'],
          [1, '#3a200e'],
        ]);
        c.fill();
        c.strokeStyle = '#1e1006';
        c.stroke();
        for (let i = 0; i < 4; i++) {
          c.beginPath();
          c.arc(82, 46 + i * 12, 6.5, -Math.PI / 2, Math.PI / 2);
          c.fillStyle = '#8e5a32';
          c.fill();
          c.stroke();
        }
        // Thumb across the front.
        roundRect(c, 50, 70, 28, 11, 5);
        c.fillStyle = '#9a6238';
        c.fill();
        c.stroke();
      });
    },
  },
  mark: {
    glow: '#9a2a24',
    paint: (c) => {
      // A target ring glowing red, crosshairs, and an eye at its heart.
      c.save();
      c.shadowColor = '#ff4030';
      c.shadowBlur = 16;
      c.strokeStyle = '#e8463a';
      c.lineWidth = 6;
      c.beginPath();
      c.arc(64, 64, 42, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 3;
      c.beginPath();
      c.arc(64, 64, 30, 0, Math.PI * 2);
      c.stroke();
      c.restore();
      c.strokeStyle = '#f4d27a';
      c.lineWidth = 4;
      c.lineCap = 'round';
      for (const [x1, y1, x2, y2] of [[64, 8, 64, 30], [64, 98, 64, 120], [8, 64, 30, 64], [98, 64, 120, 64]] as const) {
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
      }
      shadowed(c, () => {
        c.beginPath();
        c.moveTo(40, 64);
        c.quadraticCurveTo(64, 42, 88, 64);
        c.quadraticCurveTo(64, 86, 40, 64);
        c.closePath();
        c.fillStyle = down(c, 50, 78, [
          [0, '#ffffff'],
          [1, '#cbbfa4'],
        ]);
        c.fill();
        c.strokeStyle = '#1a0a06';
        c.lineWidth = 2.5;
        c.stroke();
      }, 6, 2);
      c.beginPath();
      c.arc(64, 64, 10, 0, Math.PI * 2);
      c.fillStyle = radial(c, 61, 61, 12, [
        [0, '#ffd070'],
        [0.5, '#c84a10'],
        [1, '#4a1004'],
      ]);
      c.fill();
      c.beginPath();
      c.arc(64, 64, 4, 0, Math.PI * 2);
      c.fillStyle = '#0a0402';
      c.fill();
      c.beginPath();
      c.arc(60, 60, 2.5, 0, Math.PI * 2);
      c.fillStyle = '#ffffff';
      c.fill();
    },
  },
  secondwind: {
    glow: '#9a2a40',
    paint: (c) => {
      // Breath swirling up round the heart.
      c.strokeStyle = 'rgba(160,240,170,0.85)';
      c.lineWidth = 4;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(18, 104);
      c.bezierCurveTo(4, 70, 30, 40, 24, 16);
      c.stroke();
      c.beginPath();
      c.moveTo(108, 100);
      c.bezierCurveTo(124, 66, 96, 44, 106, 18);
      c.stroke();
      shadowed(c, () => {
        heartPath(c, 64, 62, 40);
        c.fillStyle = radial(c, 50, 46, 60, [
          [0, '#ff9a9a'],
          [0.35, '#e0303a'],
          [1, '#5a0810'],
        ]);
        c.fill();
        c.strokeStyle = '#2a0408';
        c.lineWidth = 2.5;
        c.stroke();
      });
      c.beginPath();
      c.ellipse(46, 46, 9, 5, -0.6, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.fill();
      // A green cross of healing.
      c.save();
      c.shadowColor = '#80ff90';
      c.shadowBlur = 10;
      c.fillStyle = '#a8ffb0';
      roundRect(c, 58, 52, 12, 34, 3);
      c.fill();
      roundRect(c, 47, 63, 34, 12, 3);
      c.fill();
      c.restore();
    },
  },
  ready: {
    glow: '#4a6a8a',
    paint: (c) => {
      // A sword half drawn from its scabbard, hilt up, a glint on the bared steel.
      shadowed(c, () => at(c, 64, 56, Math.PI, () => sword(c, 60, 12)));
      shadowed(c, () => {
        roundRect(c, 51, 80, 26, 46, 6);
        c.fillStyle = across(c, 51, 77, LEATHER);
        c.fill();
        c.strokeStyle = '#1e1006';
        c.lineWidth = 2;
        c.stroke();
        roundRect(c, 48, 76, 32, 10, 3);
        c.fillStyle = down(c, 76, 86, GOLD);
        c.fill();
        c.stroke();
      });
      star(c, 72, 66, 9, '#ffffff');
    },
  },
};

/** Paints every icon into a texture, once. */
export function ensureAbilityIcons(scene: Phaser.Scene): void {
  for (const [id, painter] of Object.entries(PAINTERS) as Array<[AbilityId, Painter]>) {
    const key = abilityIconKey(id);
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, S, S);
    if (!tex) continue;
    const c = tex.getContext();
    c.save();
    roundRect(c, 0, 0, S, S, RADIUS);
    c.clip();
    // The tile: dark, lit from the middle in the icon's own colour, darker at the corners.
    c.fillStyle = '#0d0a10';
    c.fillRect(0, 0, S, S);
    c.fillStyle = radial(c, S / 2, S * 0.45, S * 0.75, [
      [0, painter.glow],
      [0.55, 'rgba(20,14,24,0.6)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    c.fillRect(0, 0, S, S);
    painter.paint(c);
    // A vignette, so the subject sits in the middle.
    c.fillStyle = radial(c, S / 2, S / 2, S * 0.72, [
      [0.6, 'rgba(0,0,0,0)'],
      [1, 'rgba(0,0,0,0.55)'],
    ]);
    c.fillRect(0, 0, S, S);
    // A sheen along the top edge.
    c.fillStyle = down(c, 0, S * 0.4, [
      [0, 'rgba(255,255,255,0.14)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    c.fillRect(0, 0, S, S * 0.4);
    c.restore();
    tex.refresh();
  }
}

export function abilityIconKey(id: AbilityId): string {
  return `ability-${id}`;
}
