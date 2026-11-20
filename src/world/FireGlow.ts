import Phaser from 'phaser';
import { WALL_HEIGHT } from '../art/interior';
import { generateWeatherArt } from '../art/weather';
import { gridToScreen } from '../iso/IsoMath';
import type { MapData } from './MapData';

/** On the walls: in front of them (0.8, 0.9 at the corner), behind the floor's contents. */
const WALL_GLOW_DEPTH = 0.95;
/** Only fires flicker this much (a hearth, a brazier); candles and lanterns are too small to light a wall. */
const FIRE_FLICKER = 0.8;

interface Glow {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  size: number;
  /** How strongly the fire reaches this patch of wall (nearer is brighter). */
  strength: number;
  /** The fire's own offset, so two fires don't dance in step; and a touch of lag with distance. */
  phase: number;
}

/**
 * The hearth's light dancing on the walls of a room: warm patches along the
 * walls near each fire that brighten and dim, swell and sway as the flames
 * do, all together, strongest nearest the fire. (The room's overall lighting,
 * flickering with it, is the HUD's night overlay; see ui/DayNightOverlay.ts.)
 */
export class FireGlow {
  private readonly glows: Glow[] = [];
  private time = Math.random() * 10;

  constructor(scene: Phaser.Scene, data: MapData) {
    if (!data.walls || data.underground) return;
    generateWeatherArt(scene);
    const height = data.walls.height ?? WALL_HEIGHT;
    // Patches of wall, a tile apart along the back wall (y = 0) and the side wall (x = 0).
    const spots = [
      ...data.walls.back.map((_, i) => ({ gx: i + 0.5, gy: 0, back: true })),
      ...data.walls.side.map((_, i) => ({ gx: 0, gy: i + 0.5, back: false })),
    ];
    for (const [i, l] of (data.lights ?? []).entries()) {
      if (l.flicker < FIRE_FLICKER) continue;
      const reach = Math.max(3, l.radius / 40);
      for (const s of spots) {
        const d = Math.hypot(s.gx - l.gx, s.gy - l.gy);
        // Right behind the fire the chimney breast hides the wall anyway.
        if (d < 1.1) continue;
        const strength = 1 - d / reach;
        if (strength < 0.2) continue;
        const foot = gridToScreen(s.gx, s.gy);
        const x = foot.x;
        const y = foot.y - height * 0.45;
        const size = 0.75 + strength * 0.35;
        const image = scene.add
          .image(x, y, 'fire-wall-glow')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(WALL_GLOW_DEPTH)
          .setScale(size * 0.8, size);
        this.glows.push({ image, x, y, size, strength, phase: i * 2.3 + d * 0.15 });
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    for (const g of this.glows) {
      // Out-of-step waves, as in the overlay's flicker, plus a slower swell as the fire settles and flares.
      const quick = Math.sin(t * 8.7 + g.phase) * 0.5 + Math.sin(t * 21.3 + g.phase * 1.7) * 0.3;
      const slow = Math.sin(t * 1.3 + g.phase) * 0.5 + 0.5;
      g.image.setAlpha(g.strength * (0.2 + slow * 0.16 + quick * 0.12));
      g.image.setScale(g.size * (0.8 + quick * 0.04), g.size * (1 + slow * 0.08 + quick * 0.04));
      g.image.setPosition(g.x + Math.sin(t * 3.1 + g.phase) * 2, g.y - slow * 3);
    }
  }
}
