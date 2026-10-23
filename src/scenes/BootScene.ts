import Phaser from 'phaser';
import { TILE_HEIGHT, TILE_WIDTH } from '../config';

/**
 * Generates placeholder art at runtime so the project runs with zero asset
 * files. When real art arrives, load it here with this.load.image / spritesheet
 * using the same texture keys and nothing else needs to change.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.makeTile('tile-grass', 0x4f8a3c, 0x3f7230);
    this.makeTile('tile-dirt', 0x9a7448, 0x7f5e39);
    this.makeTile('tile-stone', 0x8d8f96, 0x74767d);
    this.makeTile('tile-water', 0x2f6fae, 0x285f96);
    this.makeTile('tile-sand', 0xd8c38a, 0xbfa96f);
    this.makeHighlight();
    this.makeTree();
    this.makeRock();
    this.makePlayer();
    this.makeShadow();

    this.scene.start('MainMenu');
  }

  private diamond(): Phaser.Geom.Point[] {
    const w = TILE_WIDTH;
    const h = TILE_HEIGHT;
    return [
      new Phaser.Geom.Point(w / 2, 0),
      new Phaser.Geom.Point(w, h / 2),
      new Phaser.Geom.Point(w / 2, h),
      new Phaser.Geom.Point(0, h / 2),
    ];
  }

  private makeTile(key: string, fill: number, edge: number): void {
    const g = this.add.graphics();
    g.fillStyle(fill, 1);
    g.fillPoints(this.diamond(), true);
    g.lineStyle(1, edge, 1);
    g.strokePoints(this.diamond(), true);
    g.generateTexture(key, TILE_WIDTH, TILE_HEIGHT);
    g.destroy();
  }

  private makeHighlight(): void {
    const g = this.add.graphics();
    g.lineStyle(2, 0xffe9a8, 1);
    g.strokePoints(this.diamond(), true);
    g.generateTexture('tile-highlight', TILE_WIDTH, TILE_HEIGHT);
    g.destroy();
  }

  private makeTree(): void {
    const g = this.add.graphics();
    g.fillStyle(0x5b3a1e, 1);
    g.fillRect(29, 60, 6, 18);
    g.fillStyle(0x1f4d22, 1);
    g.fillTriangle(32, 4, 8, 50, 56, 50);
    g.fillStyle(0x2a6430, 1);
    g.fillTriangle(32, 18, 4, 66, 60, 66);
    g.fillStyle(0x34783a, 1);
    g.fillTriangle(32, 4, 32, 66, 60, 66);
    g.generateTexture('prop-tree', 64, 80);
    g.destroy();
  }

  private makeRock(): void {
    const g = this.add.graphics();
    g.fillStyle(0x6b6d73, 1);
    g.fillEllipse(24, 22, 40, 26);
    g.fillStyle(0x86888f, 1);
    g.fillEllipse(20, 17, 26, 14);
    g.generateTexture('prop-rock', 48, 36);
    g.destroy();
  }

  private makePlayer(): void {
    const g = this.add.graphics();
    // cloak
    g.fillStyle(0x6a2b8a, 1);
    g.fillTriangle(16, 14, 3, 44, 29, 44);
    // body
    g.fillStyle(0x9a4fc0, 1);
    g.fillRect(10, 18, 12, 22);
    // head
    g.fillStyle(0xf0c9a0, 1);
    g.fillCircle(16, 12, 7);
    // hood
    g.fillStyle(0x4b1d63, 1);
    g.fillTriangle(16, 0, 7, 11, 25, 11);
    g.generateTexture('player', 32, 46);
    g.destroy();
  }

  private makeShadow(): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(16, 6, 30, 12);
    g.generateTexture('shadow', 32, 12);
    g.destroy();
  }
}
