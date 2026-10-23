import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { Inventory, InventoryEvent, itemDef } from '../systems/Inventory';
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
  private pauseButton!: Phaser.GameObjects.Container;
  private journalButton!: Phaser.GameObjects.Container;
  private satchelButton!: Phaser.GameObjects.Container;
  private tracker!: QuestTracker;
  private toasts!: Toasts;
  /** The "E  Talk" style prompt over whatever the player can use; rebuilt when its label changes. */
  private prompt?: Phaser.GameObjects.Container;
  private promptLabel = '';
  /** Progress bar over the player's head while picking or shaking. */
  private progress!: Phaser.GameObjects.Graphics;
  private progressLabel!: Phaser.GameObjects.Text;
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
    this.pauseButton = this.makeIconButton((g) => {
      g.fillStyle(UI_COLORS.trim, 1);
      g.fillRect(-8, -9, 5, 18);
      g.fillRect(3, -9, 5, 18);
    }, () => this.world.openPauseMenu());
    this.journalButton = this.makeIconButton((g) => this.drawBookIcon(g), () => this.world.openJournal());
    this.satchelButton = this.makeIconButton((g) => this.drawSatchelIcon(g), () => this.world.openInventory());
    this.tracker = new QuestTracker(this, () => this.world.openJournal());
    this.toasts = new Toasts(this);
    this.progress = this.add.graphics().setVisible(false);
    this.progressLabel = this.add
      .text(0, 0, '', { fontFamily: UI_FONT, fontSize: '13px', color: UI_COLORS.text, stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.prompt = undefined;
    this.promptLabel = '';

    this.world.onHint = (text) => this.toasts.thought(text);
    const off = QuestLog.onChange((e) => this.onQuestEvent(e));
    const offItems = Inventory.onChange((e) => this.onInventoryEvent(e));

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.layout, this);
      off();
      offItems();
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
    else if (e.type === 'diary') {
      this.toasts.thought('Something worth writing down. My journal is updated.');
      this.nudge(this.journalButton);
    }
  }

  /** "+2 Carrot" floating up from the hero when something goes in the satchel. */
  private onInventoryEvent(e: InventoryEvent): void {
    if (e.type !== 'added') return;
    const cam = this.world.cameras.main;
    const sprite = this.world.player.sprite;
    const x = (sprite.x - cam.worldView.x) * cam.zoom;
    const y = (sprite.y - cam.worldView.y) * cam.zoom - 48 * cam.zoom;
    const def = itemDef(e.id);
    const icon = this.add.image(0, 0, def.icon).setScale(2).setOrigin(1, 0.5);
    const text = this.add
      .text(4, 0, `+${e.count} ${def.name}`, { fontFamily: UI_FONT, fontSize: '16px', color: '#fff6e0', stroke: '#000000', strokeThickness: 4 })
      .setOrigin(0, 0.5);
    const pop = this.add.container(Math.round(x - text.width / 2 + 16), Math.round(y), [icon, text]).setDepth(5);
    this.tweens.add({ targets: pop, y: y - 36, duration: 1400, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: pop, alpha: 0, delay: 900, duration: 500, onComplete: () => pop.destroy() });
    this.nudge(this.satchelButton);
  }

  /** Bounce a HUD button to draw the eye to it. */
  private nudge(button: Phaser.GameObjects.Container): void {
    this.tweens.add({ targets: button, scale: { from: 1.25, to: 1 }, duration: 380, ease: 'Back.easeOut', repeat: 1 });
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
    this.updatePrompt(toScreen);
    this.updateProgress(toScreen);
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

  /** "E  Talk" (or "E  Sit", "E  Go inside"...) bubble over whatever the player can use. */
  private updatePrompt(toScreen: (x: number, y: number) => { x: number; y: number }): void {
    const focus = this.world.focus;
    if (!focus || this.world.busy) {
      this.prompt?.setVisible(false);
      return;
    }
    if (!this.prompt || focus.label !== this.promptLabel) {
      this.prompt?.destroy();
      this.prompt = this.makePrompt(focus.label);
      this.promptLabel = focus.label;
    }
    const p = toScreen(focus.promptX, focus.promptY);
    const bob = Math.sin(this.time.now / 260) * 3;
    this.prompt.setVisible(true).setPosition(Math.round(p.x), Math.round(p.y - 8 + bob));
  }

  private makePrompt(text: string): Phaser.GameObjects.Container {
    const touch = this.sys.game.device.input.touch;
    const bg = this.add.graphics();
    const label = this.add
      .text(0, 0, touch ? `Tap: ${text}` : text, { fontFamily: UI_FONT, fontSize: '15px', color: UI_COLORS.text })
      .setOrigin(0, 0.5);
    const parts: Phaser.GameObjects.GameObject[] = [bg];
    let x = -label.width / 2;
    if (!touch) {
      // A little key cap showing which key to press.
      const cap = this.add.graphics();
      cap.fillStyle(0xf3e9d2, 1);
      cap.fillRoundedRect(-12, -12, 24, 24, 5);
      cap.fillStyle(0xb8a888, 1);
      cap.fillRect(-12, 8, 24, 4);
      const keyText = this.add.text(0, -1, 'E', { fontFamily: UI_FONT, fontSize: '15px', color: '#1c1712', fontStyle: 'bold' }).setOrigin(0.5);
      const capC = this.add.container(0, 0, [cap, keyText]);
      const total = 24 + 8 + label.width;
      capC.x = -total / 2 + 12;
      x = -total / 2 + 32;
      parts.push(capC);
    }
    label.x = x;
    const w = (touch ? label.width : label.width + 32) + 22;
    bg.fillStyle(UI_COLORS.panel, 0.92);
    bg.fillRoundedRect(-w / 2, -17, w, 34, 9);
    bg.lineStyle(2, UI_COLORS.trim, 1);
    bg.strokeRoundedRect(-w / 2, -17, w, 34, 9);
    // Little pointer down towards the thing it's about.
    bg.fillStyle(UI_COLORS.trim, 1);
    bg.fillTriangle(-6, 17, 6, 17, 0, 24);
    parts.push(label);
    const prompt = this.add.container(0, 0, parts).setVisible(false);
    prompt.setSize(w, 34).setInteractive({ useHandCursor: true });
    prompt.on('pointerup', () => this.world.interact());
    return prompt;
  }

  /** A small bar over the hero's head that fills while picking or shaking. */
  private updateProgress(toScreen: (x: number, y: number) => { x: number; y: number }): void {
    const c = this.world.channel;
    this.progress.setVisible(!!c);
    this.progressLabel.setVisible(!!c);
    if (!c) return;
    const sprite = this.world.player.sprite;
    const zoom = this.world.cameras.main.zoom;
    const p = toScreen(sprite.x, sprite.y);
    const w = 64;
    const h = 9;
    const x = Math.round(p.x - w / 2);
    const y = Math.round(p.y - 50 * zoom - 10);
    const t = Phaser.Math.Clamp(c.elapsed / c.seconds, 0, 1);
    const g = this.progress.clear();
    g.fillStyle(UI_COLORS.panel, 0.9);
    g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 5);
    g.lineStyle(1.5, UI_COLORS.trim, 1);
    g.strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, 5);
    if (t > 0.02) {
      g.fillStyle(0xd9b45a, 1);
      g.fillRoundedRect(x, y, w * t, h, 3);
      g.fillStyle(0xf7dc84, 1);
      g.fillRect(x + 2, y + 1, Math.max(0, w * t - 4), 2);
    }
    const dots = '.'.repeat(1 + (Math.floor(this.time.now / 300) % 3));
    this.progressLabel.setText(`${c.label}${dots}`).setPosition(p.x, y - 6);
  }

  private layout(): void {
    const { width, height } = this.scale;
    const narrow = width < NARROW;
    this.lighting.resize(width, height);
    this.lighting.setDepth(-1);
    this.bars.setMaxWidth(narrow ? width - this.wheel.width - MARGIN * 3 : Infinity);
    this.bars.setPosition(MARGIN, MARGIN);
    this.tracker.setMaxWidth(narrow ? width - this.wheel.width - MARGIN * 3 : 300);
    this.tracker.setPosition(MARGIN, MARGIN + this.bars.height + 8);
    this.tracker.update();
    if (narrow) {
      // Beside the column of buttons down the right-hand side.
      const room = width - MARGIN * 3 - PAUSE_SIZE;
      this.toasts.setPosition(MARGIN + room / 2, MARGIN + this.bars.height + this.tracker.height + 24, room);
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

    // Pause, journal and satchel buttons: a column under the dial on phones, a row bottom-right on wider screens.
    const buttons = [this.pauseButton, this.journalButton, this.satchelButton];
    buttons.forEach((button, i) => {
      if (narrow) {
        button.setPosition(width - MARGIN - PAUSE_SIZE / 2, MARGIN + this.wheel.height + 8 + PAUSE_SIZE / 2 + i * (PAUSE_SIZE + 8));
      } else {
        button.setPosition(width - MARGIN - PAUSE_SIZE / 2 - i * (PAUSE_SIZE + 8), height - MARGIN - PAUSE_SIZE / 2);
      }
    });
  }

  /** Square HUD button (pause, journal, satchel), since phones have no keyboard. */
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

  /** A leather satchel with a buckled flap. */
  private drawSatchelIcon(g: Phaser.GameObjects.Graphics): void {
    g.lineStyle(2, 0x5a3a22, 1);
    g.beginPath();
    g.arc(0, -4, 8, Math.PI, 0);
    g.strokePath();
    g.fillStyle(0x8f5c38, 1);
    g.fillRoundedRect(-11, -5, 22, 16, 3);
    g.fillStyle(0x6e4228, 1);
    g.fillRoundedRect(-11, -6, 22, 9, { tl: 3, tr: 3, bl: 6, br: 6 });
    g.fillStyle(0x4a2c1b, 1);
    g.fillRect(-11, 8, 22, 3);
    g.fillStyle(UI_COLORS.trim, 1);
    g.fillRect(-2, 1, 4, 4);
    g.fillStyle(0x4a2c1b, 1);
    g.fillRect(-1, 2, 2, 2);
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
