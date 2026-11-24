import type Phaser from 'phaser';

/**
 * Small flat glyphs for the satchel and equipment screen, drawn once into
 * textures ('glyph-<name>'): the outlines that sit in empty equipment slots
 * (a helm where the head goes), the satchel's filter tabs and the hero's
 * stats. They're painted white so they can be tinted to suit.
 */
export const GLYPH_SIZE = 64;

export type GlyphName =
  | 'head'
  | 'neck'
  | 'cloak'
  | 'body'
  | 'hands'
  | 'ring'
  | 'trinket'
  | 'feet'
  | 'mainHand'
  | 'offHand'
  | 'all'
  | 'food'
  | 'gear'
  | 'materials'
  | 'quest'
  | 'heart'
  | 'shield'
  | 'aim'
  | 'die'
  | 'coin';

type Paint = (c: CanvasRenderingContext2D) => void;

/** Each glyph on a 64-pixel square, filled (and sometimes cut out) in white. */
const GLYPHS: Record<GlyphName, Paint> = {
  head(c) {
    // A rounded helm with a nasal guard.
    c.beginPath();
    c.moveTo(12, 44);
    c.bezierCurveTo(10, 18, 22, 10, 32, 10);
    c.bezierCurveTo(42, 10, 54, 18, 52, 44);
    c.lineTo(42, 44);
    c.lineTo(40, 32);
    c.lineTo(35, 32);
    c.lineTo(35, 50);
    c.lineTo(29, 50);
    c.lineTo(29, 32);
    c.lineTo(24, 32);
    c.lineTo(22, 44);
    c.closePath();
    c.fill();
    c.fillRect(10, 44, 14, 5);
    c.fillRect(40, 44, 14, 5);
  },
  neck(c) {
    // A chain hanging to a pendant.
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(14, 12);
    c.bezierCurveTo(14, 34, 24, 40, 32, 40);
    c.bezierCurveTo(40, 40, 50, 34, 50, 12);
    c.stroke();
    c.beginPath();
    c.moveTo(32, 38);
    c.lineTo(42, 48);
    c.lineTo(32, 58);
    c.lineTo(22, 48);
    c.closePath();
    c.fill();
  },
  cloak(c) {
    c.beginPath();
    c.moveTo(24, 8);
    c.lineTo(40, 8);
    c.lineTo(44, 16);
    c.bezierCurveTo(50, 30, 54, 44, 56, 56);
    c.lineTo(44, 54);
    c.lineTo(38, 58);
    c.lineTo(32, 54);
    c.lineTo(26, 58);
    c.lineTo(20, 54);
    c.lineTo(8, 56);
    c.bezierCurveTo(10, 44, 14, 30, 20, 16);
    c.closePath();
    c.fill();
    cut(c, () => {
      c.beginPath();
      c.arc(32, 15, 3.5, 0, Math.PI * 2);
      c.fill();
    });
  },
  body(c) {
    // A tunic with sleeves.
    c.beginPath();
    c.moveTo(22, 8);
    c.lineTo(27, 12);
    c.lineTo(37, 12);
    c.lineTo(42, 8);
    c.lineTo(56, 16);
    c.lineTo(52, 30);
    c.lineTo(46, 28);
    c.lineTo(46, 56);
    c.lineTo(18, 56);
    c.lineTo(18, 28);
    c.lineTo(12, 30);
    c.lineTo(8, 16);
    c.closePath();
    c.fill();
    cut(c, () => c.fillRect(18, 38, 28, 3));
  },
  hands(c) {
    // A gauntlet, fingers up.
    c.beginPath();
    c.moveTo(18, 58);
    c.lineTo(18, 36);
    c.lineTo(10, 28);
    c.lineTo(14, 24);
    c.lineTo(20, 28);
    c.lineTo(20, 12);
    c.quadraticCurveTo(23, 8, 26, 12);
    c.lineTo(26, 26);
    c.lineTo(28, 26);
    c.lineTo(28, 8);
    c.quadraticCurveTo(31, 4, 34, 8);
    c.lineTo(34, 26);
    c.lineTo(36, 26);
    c.lineTo(36, 10);
    c.quadraticCurveTo(39, 6, 42, 10);
    c.lineTo(42, 28);
    c.lineTo(44, 28);
    c.lineTo(44, 16);
    c.quadraticCurveTo(47, 12, 50, 16);
    c.lineTo(50, 40);
    c.lineTo(44, 48);
    c.lineTo(44, 58);
    c.closePath();
    c.fill();
    cut(c, () => c.fillRect(18, 48, 26, 3));
  },
  ring(c) {
    c.lineWidth = 6;
    c.beginPath();
    c.arc(32, 38, 15, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(32, 8);
    c.lineTo(40, 16);
    c.lineTo(32, 24);
    c.lineTo(24, 16);
    c.closePath();
    c.fill();
  },
  trinket(c) {
    // A charm: a stone bound in a loop of cord.
    c.lineWidth = 3.5;
    c.beginPath();
    c.arc(32, 14, 6, Math.PI, 0);
    c.stroke();
    c.beginPath();
    c.ellipse(32, 38, 15, 18, 0, 0, Math.PI * 2);
    c.fill();
    cut(c, () => {
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(18, 30);
      c.lineTo(46, 46);
      c.moveTo(46, 30);
      c.lineTo(18, 46);
      c.stroke();
    });
  },
  feet(c) {
    c.beginPath();
    c.moveTo(20, 8);
    c.lineTo(34, 8);
    c.lineTo(34, 38);
    c.bezierCurveTo(44, 40, 56, 42, 56, 52);
    c.lineTo(56, 56);
    c.lineTo(14, 56);
    c.lineTo(16, 30);
    c.closePath();
    c.fill();
    cut(c, () => c.fillRect(19, 16, 15, 3));
  },
  mainHand(c) {
    // A sword, point up.
    c.beginPath();
    c.moveTo(32, 4);
    c.lineTo(37, 12);
    c.lineTo(36, 40);
    c.lineTo(28, 40);
    c.lineTo(27, 12);
    c.closePath();
    c.fill();
    c.fillRect(18, 40, 28, 5);
    c.fillRect(29, 45, 6, 10);
    c.beginPath();
    c.arc(32, 57, 4, 0, Math.PI * 2);
    c.fill();
  },
  offHand(c) {
    // A heater shield with a boss.
    c.beginPath();
    c.moveTo(12, 10);
    c.lineTo(52, 10);
    c.lineTo(52, 30);
    c.bezierCurveTo(52, 46, 42, 54, 32, 60);
    c.bezierCurveTo(22, 54, 12, 46, 12, 30);
    c.closePath();
    c.fill();
    cut(c, () => {
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(32, 14);
      c.lineTo(32, 54);
      c.moveTo(16, 28);
      c.lineTo(48, 28);
      c.stroke();
    });
  },
  all(c) {
    // The satchel itself.
    c.beginPath();
    c.moveTo(10, 24);
    c.lineTo(54, 24);
    c.lineTo(50, 56);
    c.lineTo(14, 56);
    c.closePath();
    c.fill();
    c.lineWidth = 4;
    c.beginPath();
    c.arc(32, 24, 12, Math.PI, 0);
    c.stroke();
    cut(c, () => {
      c.beginPath();
      c.moveTo(10, 24);
      c.lineTo(54, 24);
      c.lineTo(50, 36);
      c.lineTo(14, 36);
      c.closePath();
      c.lineWidth = 2.5;
      c.stroke();
    });
    c.fillRect(29, 34, 6, 8);
  },
  food(c) {
    // An apple with a leaf.
    c.beginPath();
    c.moveTo(32, 22);
    c.bezierCurveTo(22, 14, 8, 20, 10, 36);
    c.bezierCurveTo(12, 52, 24, 60, 32, 54);
    c.bezierCurveTo(40, 60, 52, 52, 54, 36);
    c.bezierCurveTo(56, 20, 42, 14, 32, 22);
    c.closePath();
    c.fill();
    c.fillRect(30, 8, 4, 14);
    c.beginPath();
    c.ellipse(42, 12, 8, 4, -0.4, 0, Math.PI * 2);
    c.fill();
  },
  gear(c) {
    // Crossed sword over a shield's rim.
    c.save();
    c.translate(32, 32);
    for (const a of [-0.75, 0.75]) {
      c.save();
      c.rotate(a);
      c.beginPath();
      c.moveTo(0, -28);
      c.lineTo(4, -22);
      c.lineTo(4, 10);
      c.lineTo(-4, 10);
      c.lineTo(-4, -22);
      c.closePath();
      c.fill();
      c.fillRect(-11, 10, 22, 4);
      c.fillRect(-2.5, 14, 5, 10);
      c.restore();
    }
    c.restore();
  },
  materials(c) {
    // A leaf, for herbs, hides and odds and ends.
    c.beginPath();
    c.moveTo(12, 54);
    c.bezierCurveTo(10, 24, 30, 8, 54, 8);
    c.bezierCurveTo(56, 34, 40, 54, 12, 54);
    c.closePath();
    c.fill();
    cut(c, () => {
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(12, 54);
      c.quadraticCurveTo(30, 36, 48, 14);
      c.stroke();
    });
  },
  quest(c) {
    // A rolled letter, sealed.
    c.beginPath();
    c.roundRect(12, 10, 40, 44, 6);
    c.fill();
    cut(c, () => {
      for (const y of [20, 28, 36]) c.fillRect(19, y, 26, 3);
    });
    c.beginPath();
    c.arc(44, 48, 9, 0, Math.PI * 2);
    c.fill();
    cut(c, () => {
      c.beginPath();
      c.arc(44, 48, 4, 0, Math.PI * 2);
      c.fill();
    });
  },
  heart(c) {
    c.beginPath();
    c.moveTo(32, 56);
    c.bezierCurveTo(4, 36, 6, 12, 20, 12);
    c.bezierCurveTo(26, 12, 30, 16, 32, 20);
    c.bezierCurveTo(34, 16, 38, 12, 44, 12);
    c.bezierCurveTo(58, 12, 60, 36, 32, 56);
    c.closePath();
    c.fill();
  },
  shield(c) {
    GLYPHS.offHand(c);
  },
  aim(c) {
    c.lineWidth = 5;
    c.beginPath();
    c.arc(32, 32, 20, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(32, 32, 7, 0, Math.PI * 2);
    c.fill();
    for (const [x, y, w, h] of [
      [29, 2, 6, 14],
      [29, 48, 6, 14],
      [2, 29, 14, 6],
      [48, 29, 14, 6],
    ]) c.fillRect(x, y, w, h);
  },
  die(c) {
    // A twenty-sided die, seen face on.
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      c[i ? 'lineTo' : 'moveTo'](32 + Math.cos(a) * 27, 32 + Math.sin(a) * 27);
    }
    c.closePath();
    c.fill();
    cut(c, () => {
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(32, 14);
      c.lineTo(48, 42);
      c.lineTo(16, 42);
      c.closePath();
      c.stroke();
    });
  },
  coin(c) {
    c.beginPath();
    c.arc(32, 32, 24, 0, Math.PI * 2);
    c.fill();
    cut(c, () => {
      c.lineWidth = 3;
      c.beginPath();
      c.arc(32, 32, 17, 0, Math.PI * 2);
      c.stroke();
    });
  },
};

/** Draws `draw` as a hole through what's painted so far. */
function cut(c: CanvasRenderingContext2D, draw: () => void): void {
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.strokeStyle = '#000';
  c.fillStyle = '#000';
  draw();
  c.restore();
}

export function glyphKey(name: GlyphName): string {
  return `glyph-${name}`;
}

/** Paints any glyphs not yet made into textures. Cheap after the first time. */
export function ensureGlyphs(scene: Phaser.Scene): void {
  for (const name of Object.keys(GLYPHS) as GlyphName[]) {
    const key = glyphKey(name);
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, GLYPH_SIZE, GLYPH_SIZE);
    if (!tex) continue;
    const c = tex.context;
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#ffffff';
    c.lineJoin = 'round';
    c.lineCap = 'round';
    GLYPHS[name](c);
    tex.refresh();
  }
}
