import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { PORTRAIT_SIZE } from '../art/sizes';
import { COMPANION_IDS, COMPANIONS, CompanionId, Companions, MAX_PARTY, maxHpOf } from '../systems/Companions';
import { Experience } from '../systems/Experience';
import { bodyStyle, makeButton, makePanel, THEME, titleStyle } from '../ui/Widgets';

export interface PartySceneData {
  /** Send someone travelling with the hero back to where they wait. */
  onSendHome: (id: CompanionId) => void;
}

const W = 600;
const ROW_H = 118;
const PAD = 26;
const FACE = 84;

/**
 * Who the hero travels with (P, or clicking a companion's card on the HUD):
 * everyone who has agreed to come, whether they're with the hero now or
 * waiting where they were met, with their health and what they're good for.
 * Someone travelling with the hero can be sent home from here; to take
 * someone along again, go and ask them where they wait. Emits 'party-closed'.
 */
export class PartyScene extends Phaser.Scene {
  private data_!: PartySceneData;
  private dim!: Phaser.GameObjects.Rectangle;
  private root!: Phaser.GameObjects.Container;
  private closing = false;

  constructor() {
    super('Party');
  }

  create(data: PartySceneData): void {
    this.data_ = data;
    this.closing = false;
    this.dim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.5).setOrigin(0).setInteractive();
    this.dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      // A click outside the panel closes it.
      const b = this.root.getBounds();
      if (!b.contains(p.x, p.y)) this.close();
    });
    this.root = this.add.container(0, 0);
    this.build();
    const kb = this.input.keyboard!;
    for (const key of ['ESC', 'P', 'ENTER']) kb.on(`keydown-${key}`, () => this.close());
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));
  }

  private build(): void {
    this.root.removeAll(true);
    const level = Experience.level;
    // Those with the hero first, then those waiting.
    const known = COMPANION_IDS.filter((id) => Companions.isRecruited(id)).sort(
      (a, b) => Number(Companions.isWith(b)) - Number(Companions.isWith(a)) || Companions.party.indexOf(a) - Companions.party.indexOf(b),
    );
    const rows = Math.max(1, known.length);
    const h = 150 + rows * ROW_H;
    const parts: Phaser.GameObjects.GameObject[] = [makePanel(this, W, h)];
    const top = -h / 2;
    parts.push(this.add.text(0, top + 40, 'Companions', titleStyle(32)).setOrigin(0.5));
    parts.push(
      this.add
        .text(0, top + 74, `${Companions.party.length} of ${MAX_PARTY} travelling with you`, bodyStyle(15, THEME.dimText))
        .setOrigin(0.5),
    );
    if (known.length === 0) {
      parts.push(
        this.add
          .text(0, top + 100 + ROW_H / 2, 'Nobody travels with you yet. Sellswords drink at the Crooked Tankard of an evening, and since the raid the militia keep a watch on the Hollow road.', {
            ...bodyStyle(16), align: 'center', wordWrap: { width: W - PAD * 3 },
          })
          .setOrigin(0.5),
      );
    }
    known.forEach((id, i) => parts.push(...this.row(id, top + 100 + i * ROW_H, level)));
    parts.push(this.add.text(0, h / 2 - 22, 'Esc or P to close', bodyStyle(12, THEME.dimText)).setOrigin(0.5));
    this.root.add(parts);
  }

  private row(id: CompanionId, y: number, level: number): Phaser.GameObjects.GameObject[] {
    const def = COMPANIONS[id];
    const with_ = Companions.isWith(id);
    const left = -W / 2 + PAD;
    const out: Phaser.GameObjects.GameObject[] = [];
    const frame = this.add.graphics();
    frame.fillStyle(0x000000, 0.35).fillRoundedRect(left, y + 6, FACE, FACE, 8);
    frame.lineStyle(2, with_ ? 0x8fbf6a : THEME.gold, with_ ? 1 : 0.5).strokeRoundedRect(left, y + 6, FACE, FACE, 8);
    const portrait = this.add.image(left + FACE / 2, y + 6 + FACE - 2, `portrait-${def.speaker === 'wat' ? 'guard' : def.speaker}`, 0).setOrigin(0.5, 1);
    portrait.setScale((FACE - 6) / PORTRAIT_SIZE);
    if (!with_) portrait.setAlpha(0.75);
    out.push(frame, portrait);
    const x = left + FACE + 16;
    const textW = W - PAD * 2 - FACE - 16 - (with_ ? 150 : 0);
    out.push(this.add.text(x, y + 4, def.name, bodyStyle(19, THEME.goldText)));
    out.push(
      this.add.text(x, y + 30, with_ ? 'Travelling with you' : `Waiting at ${def.home.place}`, bodyStyle(13, with_ ? '#9fdc8a' : THEME.dimText)),
    );
    out.push(this.add.text(x, y + 50, def.blurb, { ...bodyStyle(13), wordWrap: { width: textW } }));
    const hp = Math.round(Companions.hp(id, level));
    const max = maxHpOf(id, level);
    const t = Phaser.Math.Clamp(hp / max, 0, 1);
    const bar = this.add.graphics();
    const by = y + 92;
    bar.fillStyle(0x000000, 0.6).fillRoundedRect(x, by, 160, 10, 3);
    bar.fillStyle(t > 0.5 ? 0x5fae3c : t > 0.25 ? 0xd9a22a : 0xc8352a, 1).fillRoundedRect(x, by, Math.max(6, 160 * t), 10, 3);
    out.push(bar, this.add.text(x + 168, by - 3, `${hp} / ${max} health`, bodyStyle(12, THEME.dimText)));
    if (with_) {
      out.push(
        makeButton(this, W / 2 - PAD - 66, y + 46, 'Send home', () => {
          this.data_.onSendHome(id);
          GameAudio.click();
          this.build();
        }, 132),
      );
    }
    return out;
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    this.events.emit('party-closed');
    this.scene.stop();
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.dim.setSize(width, height);
    const b = this.root.getBounds();
    const scale = Math.min(1, (width - 24) / W, (height - 24) / Math.max(1, b.height / this.root.scale));
    this.root.setScale(scale).setPosition(width / 2, height / 2);
  }
}
