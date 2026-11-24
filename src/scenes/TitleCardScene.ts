import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { UI_FONT } from '../ui/theme';
import { bodyStyle, THEME, titleStyle } from '../ui/Widgets';

export interface TitleCardSceneData {
  title: string;
  /** A line under the title, after a gilt rule. */
  subtitle?: string;
  /** Called once the card has faded away, with the screen left black. */
  onDone: () => void;
}

/** How long the card holds once it is all up, before fading. */
const HOLD_MS = 5200;

/**
 * The game's title, coming up out of the dark at the end of the prologue (after
 * Mother's burial, see scenes/game/warren.ts): embers drifting up, the name in
 * gilt, a rule drawn out beneath it and a line under that, and the theme from
 * the title screen. Any key or a tap (after a moment) hurries it on.
 */
export class TitleCardScene extends Phaser.Scene {
  constructor() {
    super('TitleCard');
  }

  create(data: TitleCardSceneData): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2 - 20;
    this.add.rectangle(0, 0, width, height, 0x000000, 1).setOrigin(0).setInteractive();
    GameAudio.playMusic('menu', 3);

    // Embers, rising slowly out of the dark below and going out.
    const embers = this.add.container(0, 0);
    const ember = () => {
      const x = Phaser.Math.Between(0, width);
      const dot = this.add.circle(x, height + 8, Phaser.Math.FloatBetween(1.4, 3.4), Phaser.Utils.Array.GetRandom([0xffb050, 0xff8a30, 0xffd890]), 1);
      dot.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      embers.add(dot);
      const rise = Phaser.Math.Between(height * 0.45, height * 0.9);
      this.tweens.add({ targets: dot, y: height - rise, x: x + Phaser.Math.Between(-60, 60), duration: Phaser.Math.Between(5000, 9000), ease: 'Sine.easeOut', onComplete: () => dot.destroy() });
      this.tweens.add({ targets: dot, alpha: { from: 0, to: Phaser.Math.FloatBetween(0.5, 0.95) }, duration: 900, yoyo: true, hold: Phaser.Math.Between(1500, 4000) });
    };
    const sparks = this.time.addEvent({ delay: 90, loop: true, callback: ember });
    // A warm glow behind the name, soft at the edges.
    if (!this.textures.exists('titlecard-glow')) {
      const tex = this.textures.createCanvas('titlecard-glow', 256, 256);
      if (tex) {
        const c = tex.getContext();
        const grad = c.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0, 'rgba(255,150,70,1)');
        grad.addColorStop(0.45, 'rgba(200,90,40,0.45)');
        grad.addColorStop(1, 'rgba(120,40,10,0)');
        c.fillStyle = grad;
        c.fillRect(0, 0, 256, 256);
        tex.refresh();
      }
    }
    const glow = this.add.image(cx, cy, 'titlecard-glow').setDisplaySize(Math.min(900, width * 1.1), 300).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.22, delay: 1200, duration: 3000 });
    this.tweens.add({ targets: glow, scaleY: glow.scaleY * 1.08, delay: 4200, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const size = Math.round(Math.min(110, width / 6.5));
    const title = this.add.text(cx, cy, data.title.toUpperCase(), { ...titleStyle(size), align: 'center' }).setOrigin(0.5).setAlpha(0);
    title.setLetterSpacing(Math.round(size * 0.16));
    title.setScale(1.08);
    this.tweens.add({ targets: title, alpha: 1, scale: 1, delay: 1600, duration: 3200, ease: 'Cubic.easeOut' });

    const ruleY = cy + size * 0.62;
    const ruleW = Math.min(420, width * 0.6);
    const rule = this.add.rectangle(cx, ruleY, ruleW, 2, 0xc8a04a, 1).setScale(0, 1).setAlpha(0.85);
    const diamond = this.add.rectangle(cx, ruleY, 8, 8, 0xe8c66a, 1).setAngle(45).setAlpha(0);
    this.tweens.add({ targets: rule, scaleX: 1, delay: 3600, duration: 1500, ease: 'Cubic.easeInOut' });
    this.tweens.add({ targets: diamond, alpha: 1, delay: 4200, duration: 800 });

    const parts: Phaser.GameObjects.GameObject[] = [glow, title, rule, diamond];
    if (data.subtitle) {
      const sub = this.add
        .text(cx, ruleY + 34, data.subtitle, { ...bodyStyle(Math.round(Math.min(24, width / 30)), THEME.dimText), fontFamily: UI_FONT, fontStyle: 'italic', align: 'center' })
        .setOrigin(0.5)
        .setAlpha(0);
      sub.setLetterSpacing(2);
      this.tweens.add({ targets: sub, alpha: 0.9, delay: 4800, duration: 1800 });
      parts.push(sub);
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      sparks.remove();
      GameAudio.stopMusic();
      this.tweens.add({
        targets: [...parts, embers],
        alpha: 0,
        duration: 2200,
        onComplete: () => {
          this.scene.stop();
          data.onDone();
        },
      });
    };
    this.time.delayedCall(4800 + 1800 + HOLD_MS, finish);
    this.time.delayedCall(4000, () => {
      this.input.keyboard?.on('keydown', finish);
      this.input.on('pointerup', finish);
    });
  }
}
