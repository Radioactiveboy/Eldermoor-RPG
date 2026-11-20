import Phaser from 'phaser';
import { GameAudio, type TrackName } from '../audio/Audio';
import { gridToScreen } from '../iso/IsoMath';
import type { LetterboxScene } from '../scenes/LetterboxScene';
import { captionMs } from './CutSceneLayout';

export interface CutSceneOptions {
  /** The music to hold for the scene; without one, whatever's playing is held. */
  music?: TrackName;
  /** How far the world's background sounds drop meanwhile (1 = not at all). */
  ambience?: number;
  /** Puts the camera back on the hero once it's over (GameScene.fitCamera). */
  follow?: () => void;
  /** Lets the camera go past the edges of the map (small rooms are smaller than the screen). */
  free?: boolean;
}

/**
 * Framing for a story moment: black bars slide in over the top and bottom of
 * the screen, the HUD steps aside (UIScene sees the bars and clears away), the music is held, and the camera moves on
 * its own in slow pans. What's said or thought is written in the bottom bar.
 *
 *     const cut = CutScene.begin(scene, { music: 'raid', follow: () => g.fitCamera() });
 *     cut.caption('Goblins!');
 *     await cut.pan(x, y, 2400);
 *     cut.end();
 *
 * It doesn't take the controls: the scene that starts it does that (and gives
 * them back). Leaving the scene ends it at once.
 */
export class CutScene {
  private ended = false;
  private readonly baseZoom: number;
  private readonly cam: Phaser.Cameras.Scene2D.Camera;

  private constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: CutSceneOptions,
  ) {
    this.cam = scene.cameras.main;
    this.baseZoom = this.cam.zoom;
  }

  /** Starts the framing over this (world) scene. */
  static begin(scene: Phaser.Scene, opts: CutSceneOptions = {}): CutScene {
    const cut = new CutScene(scene, opts);
    const plugin = scene.scene;
    if (plugin.isActive('Letterbox')) plugin.stop('Letterbox');
    plugin.launch('Letterbox');
    GameAudio.holdMusic(opts.music);
    GameAudio.duckAmbience(opts.ambience ?? 0.45, 1.2);
    cut.cam.stopFollow();
    if (opts.free) cut.cam.removeBounds();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => cut.end(true));
    return cut;
  }

  get active(): boolean {
    return !this.ended;
  }

  private get letterbox(): LetterboxScene {
    return this.scene.scene.get('Letterbox') as LetterboxScene;
  }

  /** A line in the bottom bar: a thought (no speaker), or someone's words. */
  caption(text: string, speaker?: string, ms = captionMs(text)): void {
    if (this.ended) return;
    this.letterbox.caption(text, speaker, ms);
  }

  /**
   * Moves the camera slowly to look at this point (world pixels), easing in
   * and out; `zoom` is a multiple of the camera's zoom when the scene began.
   */
  pan(x: number, y: number, ms = 2400, zoom?: number): Promise<void> {
    if (this.ended) return Promise.resolve();
    return new Promise((resolve) => {
      this.cam.pan(x, y, ms, 'Sine.easeInOut', true, (_c: Phaser.Cameras.Scene2D.Camera, t: number) => {
        if (t >= 1) resolve();
      });
      if (zoom !== undefined) this.cam.zoomTo(this.baseZoom * zoom, ms, 'Sine.easeInOut', true);
    });
  }

  /** The same, to a spot on the map (grid tiles), `lift` pixels above the ground. */
  panTo(gx: number, gy: number, ms = 2400, opts: { zoom?: number; lift?: number } = {}): Promise<void> {
    const p = gridToScreen(gx, gy);
    return this.pan(p.x, p.y - (opts.lift ?? 0), ms, opts.zoom);
  }

  /** Puts the camera straight on a spot (no pan), e.g. before the scene fades in. */
  lookAt(gx: number, gy: number, zoom?: number): void {
    if (this.ended) return;
    if (zoom !== undefined) this.cam.setZoom(this.baseZoom * zoom);
    const p = gridToScreen(gx, gy);
    this.cam.centerOn(p.x, p.y);
  }

  /** Waits a while (in the scene's own time, so it stops when the scene is paused). */
  wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }

  /**
   * Over: the bars slide away, the HUD comes back, the music and sounds are let
   * go and the camera is handed back to the hero (zoomed as it was).
   * @param now the scene is closing, so skip the niceties
   */
  end(now = false): void {
    if (this.ended) return;
    this.ended = true;
    GameAudio.releaseMusic();
    if (now) {
      this.scene.scene.stop('Letterbox');
      return;
    }
    GameAudio.duckAmbience(1, 1.5);
    this.cam.zoomEffect.reset();
    this.cam.panEffect.reset();
    this.cam.setZoom(this.baseZoom);
    this.letterbox.close();
    this.opts.follow?.();
  }
}
