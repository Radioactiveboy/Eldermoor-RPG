import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { depthAt, gridToScreen } from '../iso/IsoMath';
import type { MapData } from './MapData';

/**
 * Water dripping from the cave's stalactites: every so often a drop falls
 * from one of the map's drip points to the floor, splashes, and (if it's
 * close enough to the hero to hear) plinks.
 */
export class Drips {
  private timer = 0.5;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly data: MapData,
  ) {}

  update(dt: number, player: { x: number; y: number }): void {
    const points = this.data.drips ?? [];
    if (points.length === 0) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.35 + Math.random() * 1.1;
    const d = points[Math.floor(Math.random() * points.length)];
    const floor = gridToScreen(d.gx, d.gy);
    const drop = this.scene.add.rectangle(floor.x, floor.y - d.z, 1, 3, 0xbfd8e8).setDepth(depthAt(d.gx, d.gy) + 0.2);
    this.scene.tweens.add({
      targets: drop,
      y: floor.y - 1,
      duration: Math.sqrt(d.z) * 42,
      ease: 'Quad.easeIn',
      onComplete: () => {
        drop.destroy();
        this.splash(floor.x, floor.y, depthAt(d.gx, d.gy));
        const near = Math.hypot(d.gx - player.x, d.gy - player.y);
        if (near < 9) GameAudio.drip(1 - near / 10);
      },
    });
  }

  /** A little ring spreading on the wet rock. */
  private splash(x: number, y: number, depth: number): void {
    const ring = this.scene.add.ellipse(x, y, 4, 2).setStrokeStyle(1, 0xbfd8e8, 0.8).setDepth(depth);
    this.scene.tweens.add({ targets: ring, scaleX: 3, scaleY: 3, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
  }
}
