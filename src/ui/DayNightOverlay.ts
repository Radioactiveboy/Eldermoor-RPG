import Phaser from 'phaser';
import type { Ambient } from '../systems/TimeOfDay';

const GLOW_KEY = 'light-glow';

export interface ScreenLight {
  x: number;
  y: number;
  /** In world pixels; scaled by the camera zoom. */
  radius: number;
  alpha: number;
}
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
  /** Lightning: a cold white light added over everything for a moment. */
  private readonly flash: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    DayNightOverlay.makeGlowTexture(scene);
    this.layer = scene.add
      .renderTexture(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.glow = scene.make.image({ key: GLOW_KEY }, false).setBlendMode(Phaser.BlendModes.ADD);
    this.flash = scene.add
      .rectangle(0, 0, scene.scale.width, scene.scale.height, 0xc8d4ff)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
  }

  resize(width: number, height: number): void {
    this.layer.resize(width, height);
    this.flash.setSize(width, height);
  }

  setDepth(depth: number): void {
    this.layer.setDepth(depth);
    this.flash.setDepth(depth);
  }

  /**
   * @param ambient current light colour and darkness
   * @param lanternScreen the player's position on screen, in pixels (or null for no lantern)
   * @param zoom the world camera's zoom, so the light scales with the world
   * @param lights other light sources, already in screen pixels
   * @param flash lightning, 0..1 (see systems/Weather.ts)
   */
  update(
    ambient: Ambient,
    lanternScreen: Phaser.Types.Math.Vector2Like | null,
    zoom: number,
    lights: ScreenLight[] = [],
    flash = 0,
  ): void {
    const layer = this.layer;
    this.flash.setVisible(flash > 0.01).setAlpha(flash * 0.22);
    // Full daylight: skip the work, the layer would be pure white anyway.
    if (ambient.color === 0xffffff && ambient.darkness === 0) {
      layer.setVisible(false);
      return;
    }
    layer.setVisible(true);
    layer.fill(ambient.color);
    if (ambient.darkness > 0.02 && lanternScreen) {
      const size = (LANTERN_RADIUS * 2 * zoom) / GLOW_SIZE;
      this.glow.setScale(size).setAlpha(Math.min(1, ambient.darkness * 1.1));
      layer.draw(this.glow, lanternScreen.x, lanternScreen.y);
    }
    for (const light of lights) {
      this.glow.setScale((light.radius * 2 * zoom) / GLOW_SIZE).setAlpha(light.alpha);
      layer.draw(this.glow, light.x, light.y);
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
