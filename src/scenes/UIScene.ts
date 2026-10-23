import Phaser from 'phaser';
import type { GameScene } from './GameScene';

const CONTROLS = 'WASD / arrows: move   Click or tap: walk to tile   Wheel: zoom';

/** HUD drawn on top of the game in its own scene so it ignores camera zoom/scroll. */
export class UIScene extends Phaser.Scene {
  private hud!: Phaser.GameObjects.Text;

  constructor() {
    super('UI');
  }

  create(): void {
    this.hud = this.add
      .text(12, 12, '', { fontFamily: 'monospace', fontSize: '14px', color: '#f3e9d2', backgroundColor: '#00000088' })
      .setPadding(8, 6, 8, 6)
      .setScrollFactor(0);
    this.fitToScreen();
    this.scale.on('resize', this.fitToScreen, this);
  }

  update(): void {
    const game = this.scene.get('Game') as GameScene;
    if (!game.player) return;
    const fps = Math.round(this.game.loop.actualFps);
    this.hud.setText(`${CONTROLS}\nTile ${game.player.tileX}, ${game.player.tileY}   ${fps} fps`);
  }

  private fitToScreen(): void {
    this.hud.setWordWrapWidth(Math.min(this.scale.width - 40, 620));
  }
}
