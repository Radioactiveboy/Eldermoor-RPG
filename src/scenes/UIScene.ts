import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { QuestLog, QuestEvent } from '../systems/Quests';
import { Ambient } from '../systems/TimeOfDay';
import { DayNightOverlay, ScreenLight } from '../ui/DayNightOverlay';
import { Minimap } from '../ui/Minimap';
import { QuestTracker } from '../ui/QuestTracker';
import { StatusBars } from '../ui/StatusBars';
import { TimeWheel } from '../ui/TimeWheel';
import { Toasts } from '../ui/Toasts';
import { drawPanel, UI_COLORS, UI_FONT } from '../ui/theme';
import { gridToScreen } from '../iso/IsoMath';
import type { IsoMap } from '../world/IsoMap';
import type { GameScene } from './GameScene';

const CONTROLS =
  'WASD / arrows: move   Shift: sprint   Click or tap: walk to tile   E: talk   J: journal   Wheel: zoom   Hold T: fast-forward time';
/** Indoors the room is lit mostly by the fire: the daylight is dimmed and warmed. */
const INDOOR_TINT = 0x8a6a66;
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
  private journalButton!: Phaser.GameObjects.Container;
  private tracker!: QuestTracker;
  private toasts!: Toasts;
  private talkPrompt!: Phaser.GameObjects.Container;
  private talkLabel!: Phaser.GameObjects.Text;
  private talkBg!: Phaser.GameObjects.Graphics;
  /** The map the minimap was baked from, so it can be rebuilt when the player changes area. */
  private minimapOf?: IsoMap;

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
    this.pauseButton = this.makeIconButton((g) => {
      g.fillStyle(UI_COLORS.trim, 1);
      g.fillRect(-8, -9, 5, 18);
      g.fillRect(3, -9, 5, 18);
    }, () => this.world.openPauseMenu());
    this.journalButton = this.makeIconButton((g) => this.drawBookIcon(g), () => this.world.openJournal());
    this.tracker = new QuestTracker(this, () => this.world.openJournal());
    this.toasts = new Toasts(this);
    this.talkPrompt = this.makeTalkPrompt();

    this.world.onHint = (text) => this.toasts.thought(text);
    const off = QuestLog.onChange((e) => this.onQuestEvent(e));

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.layout, this);
      off();
      this.world.onHint = undefined;
      this.minimap?.destroy();
      this.minimap = undefined;
      this.minimapOf = undefined;
    });
  }

  private onQuestEvent(e: QuestEvent): void {
    if (e.type === 'started') this.toasts.quest('New quest', e.quest.def.title);
    else if (e.type === 'progress' && e.objective.id !== 'talk') {
      // Point at what to do next rather than repeating what was just done.
      const next = QuestLog.current(e.quest);
      if (next) this.toasts.quest('Quest updated', next.text);
    }
    else if (e.type === 'completed') this.toasts.quest('Quest complete', e.quest.def.title);
    else if (e.type === 'diary') this.toasts.thought('Journal updated. Press J or tap the book to read it.');
  }

  update(_time: number, deltaMs: number): void {
    const game = this.world;
    if (!game.player) return;
    if (this.minimapOf !== game.map) {
      // A new area was built, so the minimap can bake its terrain. Rooms are too small to need one.
      this.minimap?.destroy();
      this.minimap = new Minimap(this, game.map);
      this.minimap.setVisible(!game.map.data.indoor);
      this.minimapOf = game.map;
      this.layout();
    }

    const dt = Math.min(deltaMs / 1000, 0.1);
    const cam = game.cameras.main;
    const outdoor = game.clock.ambient;
    const indoor = !!game.map.data.indoor;
    const ambient = indoor ? this.indoorAmbient(outdoor) : outdoor;
    const sprite = game.player.sprite;
    const toScreen = (x: number, y: number) => ({ x: (x - cam.worldView.x) * cam.zoom, y: (y - cam.worldView.y) * cam.zoom });
    const lantern = indoor ? null : toScreen(sprite.x, sprite.y - 20);
    this.lighting.update(ambient, lantern, cam.zoom, this.roomLights(toScreen));
    this.bars.update(game.stats, dt);
    this.wheel.update(game.clock);
    this.minimap!.update(sprite, cam.worldView, outdoor.color);
    this.tracker.update();
    this.updateTalkPrompt(toScreen);

    const fps = Math.round(this.game.loop.actualFps);
    this.hint.setText(`${CONTROLS}\nTile ${game.player.tileX}, ${game.player.tileY}   ${fps} fps`);
  }

  /** The daylight let in by the windows, warmed and dimmed, so the fire does most of the lighting. */
  private indoorAmbient(outdoor: Ambient): Ambient {
    const a = Phaser.Display.Color.IntegerToColor(outdoor.color);
    const b = Phaser.Display.Color.IntegerToColor(INDOOR_TINT);
    const mix = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 1, 0.5);
    return { color: Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b), darkness: Math.max(0.6, outdoor.darkness) };
  }

  /** The area's fires and candles, flickering, in screen pixels. */
  private roomLights(toScreen: (x: number, y: number) => { x: number; y: number }): ScreenLight[] {
    const lights = this.world.map.data.lights ?? [];
    const t = this.time.now / 1000;
    return lights.map((l, i) => {
      const p = gridToScreen(l.gx, l.gy);
      // Two out-of-step waves make a flicker that never visibly repeats.
      const wobble = (Math.sin(t * 9.3 + i * 2) * 0.6 + Math.sin(t * 23.7 + i) * 0.4) * l.flicker;
      return { ...toScreen(p.x, p.y - l.z), radius: l.radius * (1 + wobble * 0.04), alpha: 0.85 + wobble * 0.12 };
    });
  }

  /** "E  Talk" bubble over whoever the player is close enough to talk to. */
  private updateTalkPrompt(toScreen: (x: number, y: number) => { x: number; y: number }): void {
    const npc = this.world.talkTarget;
    if (!npc || this.world.busy) {
      this.talkPrompt.setVisible(false);
      return;
    }
    const head = npc.promptPoint;
    const p = toScreen(head.x, head.y);
    const bob = Math.sin(this.time.now / 260) * 3;
    this.talkPrompt.setVisible(true).setPosition(Math.round(p.x), Math.round(p.y - 8 + bob));
  }

  private makeTalkPrompt(): Phaser.GameObjects.Container {
    const touch = this.sys.game.device.input.touch;
    this.talkBg = this.add.graphics();
    this.talkLabel = this.add
      .text(0, 0, touch ? 'Tap to talk' : 'Talk', { fontFamily: UI_FONT, fontSize: '15px', color: UI_COLORS.text })
      .setOrigin(0, 0.5);
    const parts: Phaser.GameObjects.GameObject[] = [this.talkBg];
    let x = -this.talkLabel.width / 2;
    if (!touch) {
      // A little key cap showing which key to press.
      const cap = this.add.graphics();
      cap.fillStyle(0xf3e9d2, 1);
      cap.fillRoundedRect(-12, -12, 24, 24, 5);
      cap.fillStyle(0xb8a888, 1);
      cap.fillRect(-12, 8, 24, 4);
      const keyText = this.add.text(0, -1, 'E', { fontFamily: UI_FONT, fontSize: '15px', color: '#1c1712', fontStyle: 'bold' }).setOrigin(0.5);
      const capC = this.add.container(0, 0, [cap, keyText]);
      const total = 24 + 8 + this.talkLabel.width;
      capC.x = -total / 2 + 12;
      x = -total / 2 + 32;
      parts.push(capC);
    }
    this.talkLabel.x = x;
    const w = (touch ? this.talkLabel.width : this.talkLabel.width + 32) + 22;
    this.talkBg.fillStyle(UI_COLORS.panel, 0.92);
    this.talkBg.fillRoundedRect(-w / 2, -17, w, 34, 9);
    this.talkBg.lineStyle(2, UI_COLORS.trim, 1);
    this.talkBg.strokeRoundedRect(-w / 2, -17, w, 34, 9);
    // Little pointer down towards their head.
    this.talkBg.fillStyle(UI_COLORS.trim, 1);
    this.talkBg.fillTriangle(-6, 17, 6, 17, 0, 24);
    parts.push(this.talkLabel);
    const prompt = this.add.container(0, 0, parts).setVisible(false);
    prompt.setSize(w, 34).setInteractive({ useHandCursor: true });
    prompt.on('pointerup', () => this.world.interact());
    return prompt;
  }

  private layout(): void {
    const { width, height } = this.scale;
    const narrow = width < NARROW;
    this.lighting.resize(width, height);
    this.lighting.setDepth(-1);
    this.bars.setMaxWidth(narrow ? width - this.wheel.width - MARGIN * 3 : Infinity);
    this.bars.setPosition(MARGIN, MARGIN);
    this.tracker.setMaxWidth(narrow ? this.bars.width : 300);
    this.tracker.setPosition(MARGIN, MARGIN + this.bars.height + 8);
    this.tracker.update();
    if (narrow) {
      this.toasts.setPosition(width / 2, MARGIN + this.bars.height + this.tracker.height + 24, width - MARGIN * 2);
    } else {
      this.toasts.setPosition(width / 2, MARGIN + this.wheel.height + 14, width - MARGIN * 2);
    }

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

    // Pause and journal buttons: under the dial on phones, bottom-right on wider screens.
    if (narrow) {
      const y = MARGIN + this.wheel.height + 8 + PAUSE_SIZE / 2;
      this.pauseButton.setPosition(width - MARGIN - PAUSE_SIZE / 2, y);
      this.journalButton.setPosition(width - MARGIN - PAUSE_SIZE / 2, y + PAUSE_SIZE + 8);
    } else {
      this.pauseButton.setPosition(width - MARGIN - PAUSE_SIZE / 2, height - MARGIN - PAUSE_SIZE / 2);
      this.journalButton.setPosition(width - MARGIN - PAUSE_SIZE * 1.5 - 8, height - MARGIN - PAUSE_SIZE / 2);
    }

    const minimapShown = this.minimap && !this.world.map?.data.indoor;
    const hintWidth = narrow && minimapShown ? width - this.minimap!.width - MARGIN * 3 : width - MARGIN * 2 - PAUSE_SIZE * 2;
    this.hint.setWordWrapWidth(Math.min(Math.max(hintWidth, 120), 620)).setPosition(MARGIN, height - MARGIN);
  }

  /** Square HUD button (pause, journal), since phones have no keyboard. */
  private makeIconButton(drawIcon: (g: Phaser.GameObjects.Graphics) => void, onClick: () => void): Phaser.GameObjects.Container {
    const half = PAUSE_SIZE / 2;
    const bg = this.add.graphics();
    drawPanel(bg, -half, -half, PAUSE_SIZE, PAUSE_SIZE);
    const icon = this.add.graphics();
    drawIcon(icon);
    const button = this.add.container(0, 0, [bg, icon]);
    button.setSize(PAUSE_SIZE, PAUSE_SIZE).setInteractive({ useHandCursor: true });
    button.on('pointerover', () => button.setScale(1.08));
    button.on('pointerout', () => button.setScale(1));
    button.on('pointerup', () => {
      GameAudio.click();
      onClick();
    });
    return button;
  }

  /** A closed leather book with a ribbon. */
  private drawBookIcon(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xe8dcc0, 1);
    g.fillRect(-9, -11, 20, 22);
    g.fillStyle(0x8e3a2a, 1);
    g.fillRoundedRect(-11, -12, 20, 23, 2);
    g.fillStyle(0x6a2a1e, 1);
    g.fillRect(-11, -12, 4, 23);
    g.lineStyle(1, UI_COLORS.trim, 1);
    g.strokeRect(-5, -8, 11, 15);
    g.fillStyle(UI_COLORS.trim, 1);
    g.fillRect(-1, -4, 3, 7);
    g.fillStyle(0xc04040, 1);
    g.fillRect(4, 10, 3, 6);
  }
}
