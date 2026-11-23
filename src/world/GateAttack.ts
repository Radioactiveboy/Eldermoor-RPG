import type Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import type { Creature } from '../entities/Creature';
import { gridToScreen, Vec2 } from '../iso/IsoMath';
import type { FoeKind } from '../systems/Combat';
import { CutScene } from '../ui/CutScene';
import type { Speaker } from '../ui/SpeechBubbles';
import { gateWaves } from './GateNight';
import type { IsoMap } from './IsoMap';

export { gateAttackDue, gateAttackHour, gateWaves } from './GateNight';

/**
 * The night the goblins come for Adowvale (the 'the-gate' quest): after the
 * hero has fought the goblins keeping their camp on the Greyfells, the next
 * time they're in Adowvale after dark, a horn sounds out on the old road from
 * the Hollow and the goblins come up it into the village. The militia raise
 * the alarm and hold the square's end as best they can; the hero has to stop
 * the goblins on the road, in two waves. It's a real fight, and it can be lost.
 *
 * Whether the hero warned the militia first matters: warned, they're ready on
 * the road with torches lit, and the goblins come in smaller bands; caught
 * unready, each wave has another goblin in it.
 */

/** Where they come in: along the old road from the Hollow, at the east edge of the village. */
export const GATE_ROAD = { x: 31.2, y: 17.6 };
/** Where the militia make their stand, across the road at the end of the square. */
export const GATE_LINE = { x: 27.5, y: 17.5 };

/** What the goblins shriek as they come up the road. */
const CRIES = ['Burn it! Burn the man-village!', 'Where is it? Where is the whelp?', 'Skrrrah!', 'Fire! Fire on the roofs!', 'They took our camp! Take theirs!', 'Hee hee hee!'];
/** What the militia shout. */
export const MILITIA_SHOUTS = ['GOBLINS! On the road!', 'Hold the line! HOLD!', 'Ring the bell! Wake the village!', 'Torches! Get the torches!', "Garrick, your spear's on backwards!"];

/** A goblin's voice: a bubble over its head when it shrieks something. */
class Cry implements Speaker {
  speech?: string;
  private left = 0;
  constructor(readonly creature: Creature) {}

  get promptPoint(): { x: number; y: number } {
    const s = this.creature.sprite;
    return { x: s.x, y: s.y - s.displayHeight * s.originY + 4 };
  }

  get speechPoint(): { x: number; y: number } {
    return this.promptPoint;
  }

  say(text: string, seconds = 2.6): void {
    this.speech = text;
    this.left = seconds;
  }

  update(dt: number): void {
    if (!this.speech) return;
    this.left -= dt;
    if (this.left <= 0) this.speech = undefined;
  }
}

/** What the attack needs from the game scene. */
export interface GateHooks {
  scene: Phaser.Scene;
  map: IsoMap;
  player: () => Vec2;
  follow: () => void;
  hint: (text: string) => void;
  hold: () => boolean;
  release: () => void;
  addCreature: (id: string, kind: FoeKind, gx: number, gy: number) => Creature;
  /** Fight these, as one band. */
  fight: (foes: Creature[]) => void;
  /** Walk the hero to a spot. */
  walkTo: (to: Vec2) => void;
  /** Someone of the militia says something, in a bubble over their head (if any of them is about). */
  militia: (text: string) => void;
  /** It's over: the goblins beaten off (true), or the hero beaten (false). */
  done: (held: boolean) => void;
}

export class GateAttack {
  private readonly h: GateHooks;
  private readonly cries: Cry[] = [];
  private readonly waves: FoeKind[][];
  private wave = -1;
  private band: Creature[] = [];
  private shoutTimer = 2;
  private begun = false;
  /** The goblins are in the village: a fight is on or about to be. */
  active = false;

  constructor(hooks: GateHooks, warned: boolean) {
    this.h = hooks;
    this.waves = gateWaves(warned);
  }

  get speakers(): Speaker[] {
    return this.cries;
  }

  /** The horn on the road, and the first band coming up it. */
  begin(): void {
    if (this.begun) return;
    if (!this.h.hold()) {
      this.h.scene.time.delayedCall(400, () => this.begin());
      return;
    }
    this.begun = true;
    this.active = true;
    const cam = this.h.scene.cameras.main;
    const cut = CutScene.begin(this.h.scene, { music: 'raid', ambience: 0.6, follow: this.h.follow });
    GameAudio.warHorn();
    cam.shake(400, 0.003);
    // Caught out on the road itself, the hero falls back to the militia's line, so the band comes at them up the road.
    const me = this.h.player();
    if (Math.hypot(me.x - GATE_ROAD.x, me.y - GATE_ROAD.y) < 4) this.h.walkTo({ x: GATE_LINE.x + 0.5, y: GATE_LINE.y });
    cut.caption('A horn. Out on the old road from the Hollow. Then another, closer.', undefined, 2400);
    const road = gridToScreen(GATE_ROAD.x - 2, GATE_ROAD.y);
    this.h.scene.time.delayedCall(1200, () => void cut.pan(road.x, road.y - 20, 1600));
    this.h.scene.time.delayedCall(2200, () => this.spawnWave());
    this.h.scene.time.delayedCall(3600, () => {
      this.h.militia(MILITIA_SHOUTS[0]);
      cut.caption('GOBLINS! On the road! Ring the bell!', 'The militia', 2200);
    });
    this.h.scene.time.delayedCall(6000, () => {
      const me = this.h.player();
      const p = gridToScreen(me.x, me.y);
      void cut.pan(p.x, p.y, 900);
    });
    this.h.scene.time.delayedCall(7000, () => {
      cut.end();
      this.h.release();
      this.h.hint('They came. Just as I knew they would. Stop them on the road, before they reach the houses.');
      this.charge();
    });
  }

  update(dt: number): void {
    for (const c of this.cries) c.update(dt);
    if (!this.active) return;
    this.shoutTimer -= dt;
    if (this.shoutTimer > 0) return;
    this.shoutTimer = 1.8 + Math.random() * 2.2;
    const alive = this.cries.filter((c) => c.creature.active);
    if (alive.length > 0 && Math.random() < 0.65) {
      alive[Math.floor(Math.random() * alive.length)].say(CRIES[Math.floor(Math.random() * CRIES.length)]);
      GameAudio.shriek(false);
    } else {
      this.h.militia(MILITIA_SHOUTS[1 + Math.floor(Math.random() * (MILITIA_SHOUTS.length - 1))]);
    }
  }

  /** The next band comes up the road from the east edge. */
  private spawnWave(): void {
    this.wave++;
    const kinds = this.waves[this.wave];
    this.band = kinds.map((kind, i) => {
      const gx = GATE_ROAD.x - (i % 2) * 0.9 - Math.floor(i / 2) * 0.5;
      const gy = GATE_ROAD.y - 0.7 + (i % 3) * 0.7;
      const c = this.h.addCreature(`gate-${this.wave}-${i}`, kind, gx, gy);
      c.engage();
      this.cries.push(new Cry(c));
      return c;
    });
    GameAudio.shriek(true);
    this.cries[this.cries.length - 1]?.say(CRIES[this.wave % CRIES.length], 3);
  }

  /** The band a goblin of tonight's belongs to (one that reaches the hero first brings the rest with it). */
  bandFor(c: Creature): Creature[] | undefined {
    return this.active && this.band.includes(c) ? this.band.filter((b) => b.active) : undefined;
  }

  /** The band runs at the hero, and it's a fight. */
  private charge(): void {
    this.h.scene.time.delayedCall(900, () => this.h.fight(this.band));
  }

  /** A fight on the road is over: on to the next band, or the night's won. */
  won(): void {
    if (!this.active) return;
    if (this.wave + 1 < this.waves.length) {
      this.h.hint('More of them! Coming up the road, with torches!');
      this.h.scene.time.delayedCall(1400, () => {
        this.spawnWave();
        this.h.militia('Here they come again!');
        this.charge();
      });
      return;
    }
    this.active = false;
    this.h.militia('They\'re running! They\'re RUNNING!');
    this.h.scene.time.delayedCall(1200, () => this.h.done(true));
  }

  /** The hero went down on the road. */
  lost(): void {
    if (!this.active) return;
    this.active = false;
    this.h.done(false);
  }
}
