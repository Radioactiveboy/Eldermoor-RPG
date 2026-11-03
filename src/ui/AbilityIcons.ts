import Phaser from 'phaser';
import type { AbilityId } from '../systems/Abilities';

/**
 * Small painted icons for the combat hotbar, drawn with shapes so there are no
 * image files. Each is drawn centred on (0, 0) and about 34px across.
 */
type G = Phaser.GameObjects.Graphics;

const INK = 0x1b120a;
const STEEL = 0xd6dbe0;
const STEEL_DARK = 0x8c96a0;
const WOOD = 0x9a6a3a;
const GOLD = 0xe8c977;
const RED = 0xc8352a;
const GREEN = 0x6fbf5a;
const BLUE = 0x6fb3e8;

function blade(g: G, x1: number, y1: number, x2: number, y2: number, width = 5): void {
  g.lineStyle(width + 3, INK, 1).lineBetween(x1, y1, x2, y2);
  g.lineStyle(width, STEEL, 1).lineBetween(x1, y1, x2, y2);
  g.lineStyle(1.5, STEEL_DARK, 1).lineBetween(x1 + 1, y1 + 1, x2 + 1, y2 + 1);
}

function sword(g: G, angle = -Math.PI / 4, scale = 1): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;
  const tip = 15 * scale;
  const hilt = -9 * scale;
  blade(g, dx * hilt, dy * hilt, dx * tip, dy * tip, 5 * scale);
  // crossguard
  g.lineStyle(5, INK, 1).lineBetween(dx * hilt + px * 7, dy * hilt + py * 7, dx * hilt - px * 7, dy * hilt - py * 7);
  g.lineStyle(3, GOLD, 1).lineBetween(dx * hilt + px * 6, dy * hilt + py * 6, dx * hilt - px * 6, dy * hilt - py * 6);
  // grip
  g.lineStyle(5, INK, 1).lineBetween(dx * hilt, dy * hilt, dx * (hilt - 7), dy * (hilt - 7));
  g.lineStyle(3, WOOD, 1).lineBetween(dx * hilt, dy * hilt, dx * (hilt - 7), dy * (hilt - 7));
}

function arrowHead(g: G, x: number, y: number, angle: number, color: number, size = 6): void {
  const a = angle;
  g.fillStyle(color, 1);
  g.fillTriangle(
    x + Math.cos(a) * size,
    y + Math.sin(a) * size,
    x + Math.cos(a + 2.4) * size,
    y + Math.sin(a + 2.4) * size,
    x + Math.cos(a - 2.4) * size,
    y + Math.sin(a - 2.4) * size,
  );
}

const ICONS: Record<AbilityId, (g: G) => void> = {
  strike: (g) => sword(g),
  heavy: (g) => {
    // A great hammer coming down, with impact lines.
    g.lineStyle(6, INK, 1).lineBetween(-10, 12, 6, -6);
    g.lineStyle(4, WOOD, 1).lineBetween(-10, 12, 6, -6);
    g.fillStyle(INK, 1).fillRoundedRect(-2, -17, 20, 13, 3);
    g.fillStyle(STEEL, 1).fillRoundedRect(0, -15, 16, 9, 2);
    g.fillStyle(STEEL_DARK, 1).fillRect(0, -9, 16, 3);
    g.lineStyle(2, GOLD, 1);
    g.lineBetween(10, 4, 16, 8).lineBetween(8, 9, 11, 15).lineBetween(14, -1, 19, 0);
  },
  stagger: (g) => {
    sword(g, -Math.PI / 4, 0.8);
    // Stars of a ringing head.
    g.fillStyle(GOLD, 1);
    for (const [x, y, r] of [[-10, -10, 4], [11, 9, 3.5], [-12, 8, 3]] as const) {
      g.fillTriangle(x - r, y, x + r, y, x, y - r * 1.6);
      g.fillTriangle(x - r, y, x + r, y, x, y + r * 1.6);
    }
  },
  sweep: (g) => {
    // A wide arc with a blade at its end.
    g.lineStyle(7, INK, 1).beginPath().arc(0, 6, 14, Math.PI * 1.05, Math.PI * 1.95).strokePath();
    g.lineStyle(4, STEEL, 1).beginPath().arc(0, 6, 14, Math.PI * 1.05, Math.PI * 1.95).strokePath();
    g.lineStyle(2, GOLD, 0.8).beginPath().arc(0, 6, 9, Math.PI * 1.15, Math.PI * 1.85).strokePath();
    arrowHead(g, 13, 2, Math.PI * 0.45, STEEL, 7);
    g.fillStyle(RED, 1).fillCircle(-12, 14, 2.5).fillCircle(0, 15, 2.5).fillCircle(12, 14, 2.5);
  },
  brace: (g) => {
    // A round shield.
    g.fillStyle(INK, 1).fillCircle(0, 0, 16);
    g.fillStyle(WOOD, 1).fillCircle(0, 0, 14);
    g.lineStyle(2, 0x6a4422, 1).lineBetween(-14, 0, 14, 0).lineBetween(0, -14, 0, 14);
    g.lineStyle(3, STEEL_DARK, 1).strokeCircle(0, 0, 13);
    g.fillStyle(STEEL, 1).fillCircle(0, 0, 5);
    g.fillStyle(0xffffff, 0.5).fillCircle(-1.5, -1.5, 2);
  },
  item: (g) => {
    // A loaf of bread.
    g.fillStyle(INK, 1).fillEllipse(0, 3, 32, 22);
    g.fillStyle(0xc9873e, 1).fillEllipse(0, 2, 28, 18);
    g.fillStyle(0xe0a85a, 1).fillEllipse(-2, -1, 22, 10);
    g.lineStyle(2, 0x8a5622, 1).lineBetween(-7, -4, -3, 4).lineBetween(0, -5, 4, 3).lineBetween(7, -4, 10, 2);
  },
  flee: (g) => {
    // A running boot with speed lines.
    g.fillStyle(INK, 1).fillRoundedRect(-6, -14, 12, 22, 3).fillRoundedRect(-6, 4, 22, 10, 4);
    g.fillStyle(0x7a5232, 1).fillRoundedRect(-4, -12, 8, 19, 2).fillRoundedRect(-4, 6, 18, 6, 3);
    g.lineStyle(2.5, GOLD, 1).lineBetween(-17, -8, -10, -8).lineBetween(-19, -1, -10, -1).lineBetween(-17, 6, -10, 6);
  },
  shove: (g) => {
    // An open palm pushing, with a push arrow.
    g.fillStyle(INK, 1).fillRoundedRect(-14, -12, 16, 22, 5);
    g.fillStyle(0xe2b48a, 1).fillRoundedRect(-12, -10, 12, 18, 4);
    g.fillStyle(0xe2b48a, 1);
    for (let i = 0; i < 4; i++) g.fillRoundedRect(-1, -9 + i * 4.5, 6, 3.5, 1.5);
    g.lineStyle(4, GOLD, 1).lineBetween(7, 0, 14, 0);
    arrowHead(g, 17, 0, 0, GOLD, 6);
  },
  mark: (g) => {
    // A target ring with a red eye at its centre.
    g.lineStyle(5, INK, 1).strokeCircle(0, 0, 14);
    g.lineStyle(3, RED, 1).strokeCircle(0, 0, 14);
    g.lineStyle(2, GOLD, 1).lineBetween(0, -18, 0, -9).lineBetween(0, 9, 0, 18).lineBetween(-18, 0, -9, 0).lineBetween(9, 0, 18, 0);
    g.fillStyle(INK, 1).fillEllipse(0, 0, 14, 9);
    g.fillStyle(0xf3e2b3, 1).fillEllipse(0, 0, 12, 7);
    g.fillStyle(RED, 1).fillCircle(0, 0, 3);
  },
  secondwind: (g) => {
    // A heart with a rising breath.
    const heart = (x: number, y: number, s: number, c: number) => {
      g.fillStyle(c, 1);
      g.fillCircle(x - 5 * s, y - 3 * s, 6 * s).fillCircle(x + 5 * s, y - 3 * s, 6 * s);
      g.fillTriangle(x - 10.8 * s, y - 1 * s, x + 10.8 * s, y - 1 * s, x, y + 12 * s);
    };
    heart(0, 2, 1.15, INK);
    heart(0, 2, 1, RED);
    g.fillStyle(0xffffff, 0.4).fillCircle(-5, -3, 2.5);
    g.lineStyle(2.5, GREEN, 1).lineBetween(10, -6, 10, -16);
    arrowHead(g, 10, -17, -Math.PI / 2, GREEN, 5);
  },
  ready: (g) => {
    // A sword drawn up from a sheath.
    g.fillStyle(INK, 1).fillRoundedRect(-6, 2, 12, 16, 3);
    g.fillStyle(0x5a3a22, 1).fillRoundedRect(-4, 4, 8, 12, 2);
    sword(g, -Math.PI / 2, 0.85);
    g.lineStyle(2, BLUE, 0.9).lineBetween(-12, -4, -12, -14).lineBetween(12, -4, 12, -14);
  },
};

export function drawAbilityIcon(g: G, id: AbilityId): void {
  ICONS[id](g);
}
