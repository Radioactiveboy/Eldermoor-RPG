import type Phaser from 'phaser';

/** Shared look for HUD widgets: dark leather panels with gold trim. */
export const UI_FONT = 'Georgia, "Times New Roman", serif';

export const UI_COLORS = {
  panel: 0x1c1712,
  panelAlpha: 0.85,
  trim: 0xc9a14a,
  trimDark: 0x7a5f28,
  text: '#f3e9d2',
  textMuted: '#c8b894',
};

/** Draws a rounded panel with a double gold border. */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(UI_COLORS.panel, UI_COLORS.panelAlpha);
  g.fillRoundedRect(x, y, w, h, 8);
  g.lineStyle(2, UI_COLORS.trim, 1);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.lineStyle(1, UI_COLORS.trimDark, 1);
  g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 5);
}
