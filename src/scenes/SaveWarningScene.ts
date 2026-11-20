import Phaser from 'phaser';
import { downloadSave, SaveData, SaveProblem, saveProblemText } from '../systems/SaveGame';
import { bodyStyle, makeButton, makePanel, THEME, titleStyle } from '../ui/Widgets';

export interface SaveWarningSceneData {
  save: SaveData;
  problem?: SaveProblem;
}

const PANEL_W = 460;
const PANEL_H = 400;
const SERIF = 'Merriweather, Georgia, "Times New Roman", serif';

/**
 * "Your game could not be saved." Shown on waking when browser storage refused
 * the save (see SaveGame.write), so sleeping never pretends to have saved. The
 * world is frozen while it's open. The player can download the save as a file
 * and load it later from the title screen's "Load from File".
 */
export class SaveWarningScene extends Phaser.Scene {
  private dim!: Phaser.GameObjects.Rectangle;
  private ui!: Phaser.GameObjects.Container;
  /** Whether this scene froze the world, so it only wakes it if it did. */
  private froze = false;

  constructor() {
    super('SaveWarning');
  }

  create(data: SaveWarningSceneData): void {
    this.froze = this.scene.isActive('Game');
    if (this.froze) this.scene.pause('Game');

    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.5).setOrigin(0).setInteractive();
    const panel = makePanel(this, PANEL_W, PANEL_H);
    const title = this.add.text(0, -150, 'Not Saved', titleStyle(36)).setOrigin(0.5);
    const wrap = { width: PANEL_W - 70 };
    const warning = this.add
      .text(0, -98, saveProblemText(data.problem), { ...bodyStyle(18, THEME.goldText), align: 'center', wordWrap: wrap })
      .setOrigin(0.5, 0);
    const advice = this.add
      .text(
        0,
        warning.y + warning.height + 14,
        'This sleep is only kept until you close the page. Download your save to keep it, then choose Load from File on the title screen to carry on.',
        { ...bodyStyle(15, THEME.dimText), fontFamily: SERIF, align: 'center', wordWrap: wrap, lineSpacing: 4 },
      )
      .setOrigin(0.5, 0);
    const download = makeButton(this, 0, 92, 'Download Save', () => {
      downloadSave(data.save);
      advice.setText('Downloaded. Keep the file safe: Load from File on the title screen brings you back to this morning.');
    });
    const carryOn = makeButton(this, 0, 156, 'Carry On', () => this.close());
    this.ui = this.add.container(0, 0, [panel, title, warning, advice, download, carryOn]);

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.close());
    kb.on('keydown-ENTER', () => this.close());
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));

    this.ui.setAlpha(0);
    this.tweens.add({ targets: this.ui, alpha: 1, duration: 200 });
  }

  private close(): void {
    if (this.froze) this.scene.resume('Game');
    this.scene.stop();
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    this.ui.setPosition(width / 2, height / 2);
    this.ui.setScale(Math.min(1, (width - 24) / PANEL_W, (height - 24) / PANEL_H));
  }
}
