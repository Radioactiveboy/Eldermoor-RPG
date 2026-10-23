import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';

/** Shared look for menus: dark wood-and-ink panels with gold trim. */
export const THEME = {
  font: 'Cinzel, Georgia, "Times New Roman", serif',
  gold: 0xd9b45a,
  goldText: '#e8c977',
  text: '#f3e2b3',
  dimText: '#a89a7a',
  panel: 0x17121c,
  panelLight: 0x2a2030,
};

export function titleStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: THEME.font,
    fontSize: `${size}px`,
    color: THEME.goldText,
    stroke: '#2a1a08',
    strokeThickness: Math.max(2, size / 12),
    shadow: { offsetX: 0, offsetY: 3, color: '#000000', blur: 8, fill: true, stroke: true },
  };
}

export function bodyStyle(size = 20, color = THEME.text): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: THEME.font, fontSize: `${size}px`, color };
}

/** A framed panel centred on (0, 0), for use inside a container. */
export function makePanel(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, 14);
  g.fillStyle(THEME.panel, 0.94);
  g.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
  g.lineStyle(2, THEME.gold, 0.9);
  g.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);
  g.lineStyle(1, THEME.gold, 0.35);
  g.strokeRoundedRect(-width / 2 + 7, -height / 2 + 7, width - 14, height - 14, 10);
  return g;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 280,
): Phaser.GameObjects.Container {
  const height = 52;
  const bg = scene.add.graphics();
  const draw = (hover: boolean) => {
    bg.clear();
    bg.fillStyle(hover ? THEME.panelLight : THEME.panel, 0.92);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
    bg.lineStyle(2, THEME.gold, hover ? 1 : 0.6);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
  };
  draw(false);

  const text = scene.add.text(0, 0, label, bodyStyle(22)).setOrigin(0.5);
  const button = scene.add.container(x, y, [bg, text]);
  button.setSize(width, height).setInteractive({ useHandCursor: true });

  button.on('pointerover', () => {
    draw(true);
    text.setColor(THEME.goldText);
    GameAudio.hover();
    scene.tweens.add({ targets: button, scale: 1.04, duration: 100 });
  });
  button.on('pointerout', () => {
    draw(false);
    text.setColor(THEME.text);
    scene.tweens.add({ targets: button, scale: 1, duration: 100 });
  });
  button.on('pointerup', () => {
    GameAudio.click();
    onClick();
  });
  return button;
}

/** Labelled 0..1 slider. Drag the knob or click anywhere on the bar. */
export function makeSlider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  value: number,
  onChange: (v: number) => void,
  width = 220,
): Phaser.GameObjects.Container {
  const labelText = scene.add.text(-width / 2 - 150, 0, label, bodyStyle(20)).setOrigin(0, 0.5);
  const valueText = scene.add.text(width / 2 + 18, 0, '', bodyStyle(18, THEME.dimText)).setOrigin(0, 0.5);
  const bar = scene.add.graphics();
  const knob = scene.add.circle(0, 0, 11, THEME.gold).setStrokeStyle(2, 0x2a1a08);

  const set = (v: number, notify: boolean) => {
    value = Phaser.Math.Clamp(v, 0, 1);
    const left = -width / 2;
    bar.clear();
    bar.fillStyle(0x000000, 0.6);
    bar.fillRoundedRect(left, -5, width, 10, 5);
    bar.fillStyle(THEME.gold, 0.85);
    bar.fillRoundedRect(left, -5, Math.max(10, width * value), 10, 5);
    knob.x = left + width * value;
    valueText.setText(`${Math.round(value * 100)}%`);
    if (notify) onChange(value);
  };
  set(value, false);

  const container = scene.add.container(x, y, [labelText, bar, knob, valueText]);

  // A generous invisible hit area over the bar, so it's easy to grab on touch screens.
  const hit = scene.add.zone(0, 0, width + 24, 34).setInteractive({ useHandCursor: true, draggable: true });
  container.add(hit);
  const fromPointer = (p: Phaser.Input.Pointer) => {
    const local = container.getWorldTransformMatrix().applyInverse(p.x, p.y);
    set((local.x + width / 2) / width, true);
  };
  hit.on('pointerdown', fromPointer);
  hit.on('drag', fromPointer);
  hit.on('dragend', () => GameAudio.click());
  return container;
}
