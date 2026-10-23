import Phaser from 'phaser';
import { FEET_Y, FRAME_H } from '../art/character';
import type { DialogueScript } from '../dialogue/Dialogue';
import { MOTHER_INTRO, MOTHER_WAITING } from '../dialogue/mother';
import { depthAt, gridToScreen } from '../iso/IsoMath';
import { QuestLog } from '../systems/Quests';
import type { IsoMap } from '../world/IsoMap';

/** How close (in tiles) the player must be to talk. */
export const TALK_RANGE = 1.7;

interface NpcDef {
  texture: string;
  anim: string;
  /** Which conversation to have, given the story so far. */
  script: () => DialogueScript;
}

const NPCS: Record<string, NpcDef> = {
  mother: {
    texture: 'npc-mother',
    anim: 'mother-idle',
    script: () => (QuestLog.has('mother-medicine') ? MOTHER_WAITING : MOTHER_INTRO),
  },
};

/** Someone standing in the world who can be talked to. Blocks the tile they stand on. */
export class Npc {
  readonly id: string;
  readonly gx: number;
  readonly gy: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly def: NpcDef;

  constructor(scene: Phaser.Scene, map: IsoMap, id: string, gx: number, gy: number) {
    const def = NPCS[id];
    if (!def) throw new Error(`Unknown NPC: ${id}`);
    this.id = id;
    this.def = def;
    this.gx = gx;
    this.gy = gy;
    const p = gridToScreen(gx, gy);
    scene.add.image(p.x, p.y, 'shadow').setDepth(depthAt(gx, gy) - 0.5);
    this.sprite = scene.add
      .sprite(p.x, p.y, def.texture, 0)
      .setOrigin(0.5, (FEET_Y + 0.5) / FRAME_H)
      .setDepth(depthAt(gx, gy));
    this.sprite.play({ key: def.anim, startFrame: Math.floor(Math.random() * 4) });
    map.setOccupied(Math.floor(gx), Math.floor(gy), true);
  }

  get tileX(): number {
    return Math.floor(this.gx);
  }

  get tileY(): number {
    return Math.floor(this.gy);
  }

  /** World position just above their head, for the talk prompt. */
  get promptPoint(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y - FEET_Y - 6 };
  }

  script(): DialogueScript {
    return this.def.script();
  }

  /** Turn to face the player (the sprite is drawn facing forward, so this just mirrors it). */
  faceTowards(gx: number, gy: number): void {
    const screenDx = gridToScreen(gx - this.gx, gy - this.gy).x;
    if (Math.abs(screenDx) > 4) this.sprite.setFlipX(screenDx < 0);
  }

  distanceTo(gx: number, gy: number): number {
    return Math.hypot(gx - this.gx, gy - this.gy);
  }
}
