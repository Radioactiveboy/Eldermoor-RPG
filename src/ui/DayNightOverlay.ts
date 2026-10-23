import Phaser from 'phaser';
import type { Ambient } from '../systems/TimeOfDay';

const GLOW_KEY = 'light-glow';
const GLOW_SIZE = 256;
/** Radius of the player's lantern light, in world pixels. */
const LANTERN_RADIUS = 210;

/**
 * Tints the world to match the time of day. A full-screen layer is filled with
 * the ambient colour and multiplied over the game, so white leaves the world
 * untouched and dark blue turns it to night. Light sources (for now, a lantern
 * around the player) are added into that layer, which brightens their
 * surroundings back up after dark.
 *
 * Lives in the UI scene underneath the HUD, so the HUD itself is never darkened.
 */
export class DayNightOverlay {
  private readonly layer: Phaser.GameObjects.RenderTexture;
  private readonly glow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    DayNightOverlay.makeGlowTexture(scene);
    this.layer = scene.add
      .renderTexture(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.glow = scene.make.image({ key: GLOW_KEY }, false).setBlendMode(Phaser.BlendModes.ADD);
  }

  resize(width: number, height: number): void {
    this.layer.resize(width, height);
  }

  setDepth(depth: number): void {
    this.layer.setDepth(depth);
  }

  /**
   * @param ambient current light colour and darkness
   * @param lanternScreen the player's position on screen, in pixels
   * @param zoom the world camera's zoom, so the light scales with the world
   */
  update(ambient: Ambient, lanternScreen: Phaser.Types.Math.Vector2Like, zoom: number): void {
    const layer = this.layer;
    // Full daylight: skip the work, the layer would be pure white anyway.
    if (ambient.color === 0xffffff && ambient.darkness === 0) {
      layer.setVisible(false);
      return;
    }
    layer.setVisible(true);
    layer.fill(ambient.color);
    if (ambient.darkness > 0.02) {
      const size = (LANTERN_RADIUS * 2 * zoom) / GLOW_SIZE;
      this.glow.setScale(size).setAlpha(Math.min(1, ambient.darkness * 1.1));
      layer.draw(this.glow, lanternScreen.x, lanternScreen.y);
    }
  }

  /** A soft warm circle of light, made once at runtime. */
  private static makeGlowTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(GLOW_KEY)) return;
    const tex = scene.textures.createCanvas(GLOW_KEY, GLOW_SIZE, GLOW_SIZE)!;
    const ctx = tex.getContext();
    const c = GLOW_SIZE / 2;
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255, 214, 160, 1)');
    grad.addColorStop(0.35, 'rgba(230, 170, 110, 0.7)');
    grad.addColorStop(0.7, 'rgba(150, 100, 70, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
    tex.refresh();
  }
}
