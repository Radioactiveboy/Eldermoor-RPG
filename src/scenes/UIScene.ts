import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { DayNightOverlay } from '../ui/DayNightOverlay';
import { Minimap } from '../ui/Minimap';
import { StatusBars } from '../ui/StatusBars';
import { TimeWheel } from '../ui/TimeWheel';
import { drawPanel, UI_COLORS, UI_FONT } from '../ui/theme';
import type { GameScene } from './GameScene';

const CONTROLS = 'WASD / arrows: move   Shift: sprint   Click or tap: walk to tile   Wheel: zoom   Hold T: fast-forward time';
const MARGIN = 14;
/** Below this screen width the HUD switches to a compact layout. */
const NARROW = 760;
const PAUSE_SIZE = 44;

/**
 * HUD drawn on top of the game in its own scene so it ignores camera zoom/scroll.
 * Also hosts the day/night lighting layer, drawn underneath the HUD widgets.
 */
export class UIScene extends Phaser.Scene {
  private world!: GameScene;
  private lighting!: DayNightOverlay;
  private bars!: StatusBars;
  private wheel!: TimeWheel;
  private minimap?: Minimap;
  private hint!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Container;

  constructor() {
    super('UI');
  }

  create(): void {
    this.world = this.scene.get('Game') as GameScene;
    this.lighting = new DayNightOverlay(this);
    this.bars = new StatusBars(this);
    this.wheel = new TimeWheel(this);
    this.hint = this.add
      .text(0, 0, '', { fontFamily: UI_FONT, fontSize: '13px', color: UI_COLORS.textMuted, backgroundColor: '#00000088' })
      .setPadding(8, 5, 8, 5)
      .setOrigin(0, 1);
    this.pauseButton = this.makePauseButton();
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));
  }

  update(_time: number, deltaMs: number): void {
    const game = this.world;
    if (!game.player) return;
    if (!this.minimap) {
      // The world is built by now, so the minimap can bake its terrain.
      this.minimap = new Minimap(this, game.map);
      this.layout();
    }

    const dt = Math.min(deltaMs / 1000, 0.1);
    const cam = game.cameras.main;
    const ambient = game.clock.ambient;
    const sprite = game.player.sprite;
    const lantern = {
      x: (sprite.x - cam.worldView.x) * cam.zoom,
      y: (sprite.y - 20 - cam.worldView.y) * cam.zoom,
    };
    this.lighting.update(ambient, lantern, cam.zoom);
    this.bars.update(game.stats, dt);
    this.wheel.update(game.clock);
    this.minimap.update(sprite, cam.worldView, ambient.color);

    const fps = Math.round(this.game.loop.actualFps);
    this.hint.setText(`${CONTROLS}\nTile ${game.player.tileX}, ${game.player.tileY}   ${fps} fps`);
  }

  private layout(): void {
    const { width, height } = this.scale;
    const narrow = width < NARROW;
    this.lighting.resize(width, height);
    this.lighting.setDepth(-1);
    this.bars.setMaxWidth(narrow ? width - this.wheel.width - MARGIN * 3 : Infinity);
    this.bars.setPosition(MARGIN, MARGIN);

    if (narrow) {
      // Phones: dial top-right, minimap bottom-right and a little smaller.
      this.wheel.setPosition(width - MARGIN - this.wheel.width, MARGIN);
      if (this.minimap) {
        this.minimap.setScale(0.75);
        this.minimap.setPosition(width - MARGIN - this.minimap.width, height - MARGIN - this.minimap.height);
      }
    } else {
      this.wheel.setPosition((width - this.wheel.width) / 2, MARGIN);
      if (this.minimap) {
        this.minimap.setScale(1);
        this.minimap.setPosition(width - MARGIN - this.minimap.width, MARGIN);
      }
    }

    // Pause button: under the dial on phones, bottom-right on wider screens.
    if (narrow) {
      this.pauseButton.setPosition(width - MARGIN - PAUSE_SIZE / 2, MARGIN + this.wheel.height + 8 + PAUSE_SIZE / 2);
    } else {
      this.pauseButton.setPosition(width - MARGIN - PAUSE_SIZE / 2, height - MARGIN - PAUSE_SIZE / 2);
    }

    const hintWidth = narrow && this.minimap ? width - this.minimap.width - MARGIN * 3 : width - MARGIN * 2;
    this.hint.setWordWrapWidth(Math.min(Math.max(hintWidth, 120), 620)).setPosition(MARGIN, height - MARGIN);
  }

  /** On-screen pause, since phones have no Esc key. */
  private makePauseButton(): Phaser.GameObjects.Container {
    const half = PAUSE_SIZE / 2;
    const bg = this.add.graphics();
    drawPanel(bg, -half, -half, PAUSE_SIZE, PAUSE_SIZE);
    const icon = this.add.graphics();
    icon.fillStyle(UI_COLORS.trim, 1);
    icon.fillRect(-8, -9, 5, 18);
    icon.fillRect(3, -9, 5, 18);
    const button = this.add.container(0, 0, [bg, icon]);
    button.setSize(PAUSE_SIZE, PAUSE_SIZE).setInteractive({ useHandCursor: true });
    button.on('pointerover', () => button.setScale(1.08));
    button.on('pointerout', () => button.setScale(1));
    button.on('pointerup', () => {
      GameAudio.click();
      this.world.openPauseMenu();
    });
    return button;
  }
}
