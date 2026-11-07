import Phaser from 'phaser';
import { Settings } from '../settings/Settings';

/**
 * How the game is drawn on the screen: at what resolution, and how big the
 * menus, HUD and text are.
 *
 * The canvas is drawn at `render` canvas pixels for every CSS pixel of the
 * page (the screen's own pixel density, or a fraction of it for speed), so it
 * stays sharp on high-density displays. The menus and HUD are laid out in
 * "interface pixels", `zoom` canvas pixels each: a scene's `this.scale.width`
 * and `height` are given in them, and its cameras are zoomed to match, so a
 * layout written for a 1280x800 window reads the same, only bigger and
 * sharper, on a 2560x1440 one.
 *
 * The world (the Game scene) isn't laid out in interface pixels: its camera
 * works in canvas pixels and multiplies its own zoom by `render`.
 */

/** Scenes that draw the world, whose cameras look after themselves. */
const WORLD_SCENES = new Set(['Game']);

/** The interface sizes offered in the settings (0 is automatic). */
export const UI_SCALES = [0, 0.75, 1, 1.25, 1.5, 1.75, 2];
/** The resolutions offered: fractions of the screen's own (1 is native). */
export const RENDER_SCALES = [1, 0.75, 0.5];

class DisplayState {
  /** Canvas pixels per CSS pixel. */
  render = 1;
  /** Interface pixels per CSS pixel. */
  ui = 1;
  private game?: Phaser.Game;
  /** Cameras in interface scenes that look at the world (the main menu's drifting map): zoomed for sharpness only. */
  readonly worldCameras = new WeakSet<Phaser.Cameras.Scene2D.Camera>();

  /** Canvas pixels per interface pixel. */
  get zoom(): number {
    return this.render * this.ui;
  }

  /** The screen's own pixel density (capped, so a 4x phone doesn't draw 16 times the pixels). */
  get density(): number {
    return Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  }

  /** The game's area of the page, in CSS pixels. */
  get page(): { width: number; height: number } {
    const el = document.getElementById('game');
    return { width: el?.clientWidth || window.innerWidth, height: el?.clientHeight || window.innerHeight };
  }

  /** The interface size that suits a page this big: larger on big monitors, never smaller than normal. */
  autoUi(): number {
    const { width, height } = this.page;
    const fit = Math.min(height / 850, width / 1400);
    return Phaser.Math.Clamp(Math.round(fit * 4) / 4, 1, 2);
  }

  /** The canvas size, in pixels, for a resolution setting (for the settings' labels). */
  canvasSize(renderScale: number): { width: number; height: number } {
    const { width, height } = this.page;
    const r = this.density * (renderScale || 1);
    return { width: Math.round(width * r), height: Math.round(height * r) };
  }

  /** Works out the sizes from the settings. */
  compute(): void {
    const s = Settings.get();
    this.render = this.density * (s.renderScale || 1);
    this.ui = s.uiScale || this.autoUi();
  }

  /** The game config's scale section, for starting the game at the right size. */
  scaleConfig(): Phaser.Types.Core.ScaleConfig {
    this.compute();
    const { width, height } = this.page;
    return { mode: Phaser.Scale.NONE, width: Math.round(width * this.render), height: Math.round(height * this.render), zoom: 1 / this.render };
  }

  /** Hooks the game up: every scene laid out in interface pixels, and resized with the window and the settings. */
  install(game: Phaser.Game): void {
    this.game = game;
    window.addEventListener('resize', () => this.apply());
    document.addEventListener('fullscreenchange', () => window.setTimeout(() => this.apply(), 50));
    let last = `${Settings.get().renderScale}/${Settings.get().uiScale}`;
    Settings.onChange((s) => {
      // Only the display settings (not every nudge of a volume slider).
      const now = `${s.renderScale}/${s.uiScale}`;
      if (now === last) return;
      last = now;
      this.apply();
    });
    this.apply();
  }

  /** Resizes the canvas to the page and the settings, and refits every scene to it. */
  apply(): void {
    const game = this.game;
    if (!game) return;
    const before = this.render;
    this.compute();
    const { width, height } = this.page;
    const scale = game.scale;
    // Phaser leaves the canvas's CSS size alone when it happens to match the canvas's, so set it ourselves
    // (before resizing, so the input sees the right bounds).
    game.canvas.style.width = `${width}px`;
    game.canvas.style.height = `${height}px`;
    scale.zoom = 1 / this.render;
    scale.resize(Math.round(width * this.render), Math.round(height * this.render));
    game.canvas.style.width = `${width}px`;
    game.canvas.style.height = `${height}px`;
    scale.updateBounds();
    for (const scene of game.scene.getScenes(false)) {
      if (WORLD_SCENES.has(scene.sys.settings.key)) {
        const cam = scene.cameras?.main;
        if (cam && before !== this.render) cam.setZoom((cam.zoom * this.render) / before);
      } else {
        this.fitCameras(scene);
      }
      this.sharpenText(scene.children?.list ?? []);
    }
    // Let every scene lay itself out again at the new size.
    scale.emit(Phaser.Scale.Events.RESIZE, scale.gameSize, scale.baseSize, scale.displaySize, scale.width, scale.height);
  }

  /** Called as each scene boots: interface sizes for its `this.scale`, and its cameras zoomed to them. */
  boot(scene: Phaser.Scene): void {
    if (WORLD_SCENES.has(scene.sys.settings.key)) return;
    const real = scene.sys.scale;
    scene.scale = new Proxy(real, {
      get: (target, prop) => {
        if (prop === 'width') return target.width / this.zoom;
        if (prop === 'height') return target.height / this.zoom;
        const v = Reflect.get(target, prop, target);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    // Each time the scene starts, its new main camera is zoomed to interface pixels.
    scene.sys.events.on(Phaser.Scenes.Events.START, () => this.fitCameras(scene));
  }

  /** Every camera of an interface scene drawn from its top left corner at the interface zoom. */
  fitCameras(scene: Phaser.Scene, cams: Phaser.Cameras.Scene2D.Camera[] = scene.cameras?.cameras ?? []): void {
    for (const cam of cams) {
      if (this.worldCameras.has(cam)) {
        cam.setZoom(this.render);
        continue;
      }
      cam.setOrigin(0, 0).setZoom(this.zoom);
    }
  }

  /** Text redrawn at the canvas's resolution, so it stays crisp however big it's shown. */
  sharpenText(list: Phaser.GameObjects.GameObject[]): void {
    for (const o of list) {
      if (o instanceof Phaser.GameObjects.Text) {
        if (o.style.resolution !== this.textResolution) o.setResolution(this.textResolution);
      } else if (o instanceof Phaser.GameObjects.Container) {
        this.sharpenText(o.list);
      }
    }
  }

  /** The resolution text is drawn at (a little extra for the world camera's zoom wouldn't hurt, but costs memory). */
  get textResolution(): number {
    return Math.min(4, Math.max(1, Math.ceil(this.zoom * 2) / 2));
  }

  /** A pointer's position in interface pixels (pointer.x and y are canvas pixels). */
  point(p: { x: number; y: number }): { x: number; y: number } {
    return { x: p.x / this.zoom, y: p.y / this.zoom };
  }
}

export const Display = new DisplayState();

// Hook every scene as it boots, and draw all text at the canvas's resolution unless told otherwise.
type SystemsInit = { init(game: Phaser.Game): void };
const systems = Phaser.Scenes.Systems.prototype as unknown as SystemsInit & { scene: Phaser.Scene };
const init = systems.init;
systems.init = function (this: SystemsInit & { scene: Phaser.Scene }, game: Phaser.Game) {
  init.call(this, game);
  Display.boot(this.scene);
};
const setStyle = Phaser.GameObjects.TextStyle.prototype.setStyle;
Phaser.GameObjects.TextStyle.prototype.setStyle = function (this: Phaser.GameObjects.TextStyle, style, updateText, setDefaults) {
  const out = setStyle.call(this, style, updateText, setDefaults);
  if (!this.resolution) this.resolution = Display.textResolution;
  return out;
};
