import Phaser from 'phaser';
import { CREATURE_FRAME } from '../art/creatures';
import { GameAudio } from '../audio/Audio';
import type { Creature } from '../entities/Creature';
import type { Npc } from '../entities/Npc';
import { gridToScreen, Vec2 } from '../iso/IsoMath';
import type { FoeKind } from '../systems/Combat';
import { findPath } from '../systems/Pathfinding';
import { GoblinCry } from './GoblinCry';
import type { IsoMap } from './IsoMap';

/**
 * The fighting all round the hero on the night the goblins come for Adowvale
 * (see GateAttack.ts): while the hero meets the bands on the road, the militia
 * are at it too, each man at his post a little way either side of the road with
 * a goblin of his own come at him out of the dark. It's all for show (the hero
 * can't join in, and it doesn't change how the night goes), but blows trade,
 * sparks fly, goblins go down or run, now and then one of the militia is knocked
 * flat and gets up again, and the next goblin comes running up the road.
 */

/** Where each of the militia stands (and the goblin that comes at him), clear of the road the hero fights on. */
const POSTS: ReadonlyArray<{ guard: Vec2; goblin: Vec2 }> = [
  { guard: { x: 29.6, y: 15.4 }, goblin: { x: 30.6, y: 14.7 } },
  { guard: { x: 26.2, y: 15.7 }, goblin: { x: 27.2, y: 14.9 } },
  { guard: { x: 29.3, y: 19.7 }, goblin: { x: 30.4, y: 20.3 } },
  { guard: { x: 25.9, y: 19.6 }, goblin: { x: 26.9, y: 20.5 } },
];
/** Where the goblins come running in from: the old road, at the village's east edge. */
const ROAD_IN = { x: 32.8, y: 17.6 };
/** How fast the militia run to their posts, and the goblins to them, in tiles a second. */
const GUARD_RUN = 3.4;
const GOBLIN_RUN = 2.8;
const KINDS: FoeKind[] = ['goblin', 'goblin', 'goblinspear', 'goblintorch'];

const SAY = {
  hit: ['Take that!', 'Back! Get back!', "Got you, you little—!", 'Ha!', 'Come on then!'],
  hurt: ['Argh! My arm!', 'It bit me! It BIT me!', 'Mind your left!', 'Ow!'],
  down: ["I'm down! I'm down!", 'Ugh...', 'Help! Get it off me!'],
  up: ['Right. RIGHT.', "That's it, you've had it now!", 'Still here!'],
  felled: ['One less!', "That's one!", 'Got him!', 'And stay down!'],
  fled: ['Aye, run! RUN!', "And don't come back!", "That's right, off you go!"],
  next: ["There's another one!", 'Here comes another!', 'More of them!'],
};
const JEERS = ['Stab stab stab!', 'Squishy man!', 'Hee hee! Got you!', 'Skrrrah!', 'Bite his knees!', 'Fall down, man!'];

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** One of the militia at his post, and whatever goblin is at him. */
interface Scuffle {
  post: (typeof POSTS)[number];
  guard: Npc;
  /** His way to the post, still to run. */
  route: Vec2[];
  goblin?: Creature;
  cry?: GoblinCry;
  /** The goblin is still running in. */
  arriving: boolean;
  /** Seconds to the next blow (or, with no goblin, until the next one comes). */
  next: number;
  /** Blows left before this goblin's fight is decided. */
  blows: number;
  /** Seconds he's still to lie on the ground, knocked flat. */
  down: number;
  /** A blow is in the air. */
  swinging: boolean;
}

/** What the scuffles need from the game scene. */
export interface SkirmishHooks {
  scene: Phaser.Scene;
  map: IsoMap;
  /** The militia on hand in the square. */
  guards: () => Npc[];
  /** A goblin for show: on the map, but no part of the hero's fights. */
  addGoblin: (id: string, kind: FoeKind, gx: number, gy: number) => Creature;
}

export class GateSkirmish {
  private readonly h: SkirmishHooks;
  private readonly scuffles: Scuffle[] = [];
  private readonly cries: GoblinCry[] = [];
  private count = 0;
  /** Goblins are still coming: a scuffle that ends sends for another. */
  private on = false;

  constructor(hooks: SkirmishHooks) {
    this.h = hooks;
  }

  /** The skirmishing goblins' bubbles. */
  get speakers(): GoblinCry[] {
    return this.cries;
  }

  /** The goblins in the scuffles that are still on their feet (for the attack's shrieks). */
  get goblinCries(): GoblinCry[] {
    return this.cries.filter((c) => c.creature.active);
  }

  /** The militia run to their posts across the road, and the goblins start coming at them. */
  begin(): void {
    if (this.on) return;
    this.on = true;
    const guards = [...this.h.guards()];
    for (const post of POSTS) {
      if (guards.length === 0) break;
      guards.sort((a, b) => a.distanceTo(post.guard.x, post.guard.y) - b.distanceTo(post.guard.x, post.guard.y));
      const guard = guards.shift()!;
      guard.scripted = true;
      this.scuffles.push({
        post, guard, route: this.routeTo(guard, post.guard), arriving: false, next: 0.6 + Math.random() * 1.6, blows: 0, down: 0, swinging: false,
      });
    }
  }

  update(dt: number): void {
    for (const c of this.cries) c.update(dt);
    for (const s of this.scuffles) {
      s.goblin?.update(dt);
      if (s.route.length > 0) {
        this.run(s, dt);
        continue;
      }
      const g = s.guard;
      const foe = s.goblin?.active ? s.goblin : undefined;
      if (g.scripted) g.pose(g.gx, g.gy, foe ? { x: foe.gx, y: foe.gy } : ROAD_IN, false);
      if (s.down > 0) {
        s.down -= dt;
        if (s.down <= 0) this.getUp(s);
        continue;
      }
      if (!this.on) continue;
      if (!s.goblin) {
        s.next -= dt;
        if (s.next <= 0) this.sendGoblin(s);
        continue;
      }
      if (s.arriving || s.swinging) continue;
      s.next -= dt;
      if (s.next <= 0) this.blow(s);
    }
  }

  /** The night's won: the goblins still about turn and run, and the militia are left standing. */
  rout(): void {
    this.on = false;
    for (const s of this.scuffles) {
      // Whatever he was shouting at his goblin, it's over: the cheering's next.
      s.guard.speech = undefined;
      const c = s.goblin;
      if (c?.active) {
        this.h.scene.tweens.killTweensOf([c, c.offset]);
        c.offset.x = c.offset.y = 0;
        void c.flee(c.gx - 1, c.gy).then(() => c.destroy());
      }
      s.goblin = undefined;
    }
    this.h.scene.time.delayedCall(4000, () => this.release());
  }

  /** The night's lost (or the scene is going): stop where it is. */
  stop(): void {
    this.on = false;
  }

  /** Let the militia go back to their rounds. */
  private release(): void {
    for (const s of this.scuffles) {
      const g = s.guard;
      if (!g.sprite.active) continue;
      this.h.scene.tweens.killTweensOf([g.offset, g.sprite]);
      g.offset.x = g.offset.y = 0;
      g.sprite.setAngle(0).clearTint();
      s.route = [];
      g.scripted = false;
    }
  }

  // ------------------------------------------------------------ getting there

  /** Round the stalls to the post, through the open ground. */
  private routeTo(guard: Npc, to: Vec2): Vec2[] {
    const m = this.h.map;
    const path = findPath({ x: Math.floor(guard.gx), y: Math.floor(guard.gy) }, { x: Math.floor(to.x), y: Math.floor(to.y) }, m.width, m.height, (x, y) => m.isWalkable(x, y), 4000);
    const route = (path ?? []).map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
    if (route.length > 0) route.pop();
    route.push(to);
    return route;
  }

  /** Running to his post. */
  private run(s: Scuffle, dt: number): void {
    const g = s.guard;
    const next = s.route[0];
    const dx = next.x - g.gx;
    const dy = next.y - g.gy;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(dist, GUARD_RUN * dt);
    if (dist - step < 0.02) s.route.shift();
    const at = dist > 0 ? { x: g.gx + (dx / dist) * step, y: g.gy + (dy / dist) * step } : next;
    g.pose(at.x, at.y, s.route.length > 0 ? next : ROAD_IN, s.route.length > 0);
  }

  /** The next goblin comes running up the road at him. */
  private sendGoblin(s: Scuffle): void {
    const kind = pick(KINDS);
    const c = this.h.addGoblin(`gate-scuffle-${this.count++}`, kind, ROAD_IN.x + Math.random() * 0.6, ROAD_IN.y - 0.8 + Math.random() * 1.6);
    c.engage();
    const cry = new GoblinCry(c);
    this.cries.push(cry);
    s.goblin = c;
    s.cry = cry;
    s.arriving = true;
    if (this.count > POSTS.length && Math.random() < 0.6) s.guard.say(pick(SAY.next), 2.4);
    const to = s.post.goblin;
    const ms = (Math.hypot(to.x - c.gx, to.y - c.gy) / GOBLIN_RUN) * 1000;
    void c.moveTo(to.x, to.y, ms).then(() => {
      if (s.goblin !== c || !c.active) return;
      s.arriving = false;
      s.blows = 4 + Math.floor(Math.random() * 6);
      s.next = 0.3 + Math.random() * 0.5;
      c.faceTowards(s.guard.gx, s.guard.gy);
      if (Math.random() < 0.4) cry.say(pick(JEERS), 2);
    });
  }

  // ------------------------------------------------------------ the fighting

  /** One of them swings at the other: it lands, or it's turned aside with a clang. */
  private blow(s: Scuffle): void {
    const g = s.guard;
    const c = s.goblin!;
    const scene = this.h.scene;
    const guardSwings = Math.random() < 0.55;
    const gp = gridToScreen(g.gx, g.gy);
    const cp = gridToScreen(c.gx, c.gy);
    const len = Math.hypot(cp.x - gp.x, cp.y - gp.y) || 1;
    const ux = (cp.x - gp.x) / len;
    const uy = (cp.y - gp.y) / len;
    const sign = guardSwings ? 1 : -1;
    const attacker = guardSwings ? g.offset : c.offset;
    const defender = guardSwings ? c.offset : g.offset;
    s.swinging = true;
    if (!guardSwings) c.setFrame(CREATURE_FRAME.bite);
    scene.tweens.add({
      targets: attacker,
      x: ux * 10 * sign,
      y: uy * 10 * sign,
      duration: 120,
      yoyo: true,
      ease: 'Quad.easeOut',
      onYoyo: () => {
        if (!c.active) return;
        const lands = Math.random() < 0.5;
        const mid = { x: (gp.x + cp.x) / 2, y: (gp.y + cp.y) / 2 - 20 };
        if (lands) {
          GameAudio.scuffle('hit');
          this.sparks(mid.x, mid.y, 0xff6a4a, 4, c);
          scene.tweens.add({ targets: defender, x: ux * 5 * sign, y: uy * 5 * sign, duration: 80, yoyo: true });
          const hurt = guardSwings ? c.sprite : g.sprite;
          hurt.setTint(0xff9a8a);
          scene.time.delayedCall(110, () => hurt.active && hurt.clearTint());
          if (guardSwings) {
            c.setFrame(CREATURE_FRAME.hurt);
            if (Math.random() < 0.25) g.say(pick(SAY.hit), 1.8);
          } else if (Math.random() < 0.3) {
            GameAudio.scuffle('hurt');
            g.say(pick(SAY.hurt), 1.8);
          }
        } else {
          GameAudio.scuffle('clash');
          this.sparks(mid.x, mid.y, 0xffe08a, 7, c);
        }
        s.blows -= guardSwings && lands ? 1.5 : 1;
      },
      onComplete: () => {
        attacker.x = attacker.y = 0;
        s.swinging = false;
        if (!c.active) return;
        c.setFrame(CREATURE_FRAME.snarl);
        s.next = 0.45 + Math.random() * 0.9;
        if (s.blows <= 0) this.decide(s);
      },
    });
  }

  /** The end of this one: the goblin cut down, or running for it, or the militiaman knocked flat (and up again after). */
  private decide(s: Scuffle): void {
    const c = s.goblin!;
    const g = s.guard;
    const r = Math.random();
    if (r < 0.6) {
      c.setFrame(CREATURE_FRAME.hurt);
      GameAudio.scuffle('death');
      c.die();
      if (Math.random() < 0.6) g.say(pick(SAY.felled), 2);
      // The body lies a while, then fades into the dark (it's not one of the hero's to loot).
      this.h.scene.tweens.add({ targets: c.sprite, alpha: 0, delay: 6000, duration: 1200, onComplete: () => c.destroy() });
      this.after(s);
    } else if (r < 0.8) {
      if (Math.random() < 0.7) g.say(pick(SAY.fled), 2);
      // Away down the road, east, back the way it came.
      void c.flee(c.gx - 1, c.gy).then(() => c.destroy());
      this.after(s);
    } else {
      this.knockDown(s);
    }
  }

  /** This goblin done with, the next one comes after a breather. */
  private after(s: Scuffle): void {
    s.goblin = undefined;
    s.cry = undefined;
    s.next = 2 + Math.random() * 3.5;
  }

  /** Knocked flat on his back: he lies a moment, and the goblin crows over him. */
  private knockDown(s: Scuffle): void {
    const g = s.guard;
    GameAudio.scuffle('hurt');
    g.say(pick(SAY.down), 2.2);
    const away = gridToScreen(g.gx, g.gy).x < gridToScreen(s.goblin!.gx, s.goblin!.gy).x ? -1 : 1;
    this.h.scene.tweens.add({ targets: g.sprite, angle: 80 * away, duration: 220, ease: 'Quad.easeIn' });
    s.down = 2.2 + Math.random() * 1.2;
    s.cry?.say(pick(JEERS), 2);
  }

  private getUp(s: Scuffle): void {
    const g = s.guard;
    this.h.scene.tweens.add({ targets: g.sprite, angle: 0, duration: 300, ease: 'Quad.easeOut' });
    if (this.on && Math.random() < 0.6) g.say(pick(SAY.up), 2);
    s.blows = 3 + Math.floor(Math.random() * 3);
    s.next = 0.8;
    if (!s.goblin?.active) this.after(s);
  }

  /** A spray of sparks where weapons meet (yellow for steel on steel, red for a blow that lands). */
  private sparks(x: number, y: number, color: number, n: number, near: Creature): void {
    const scene = this.h.scene;
    const depth = near.sprite.depth + 1;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 8 + Math.random() * 14;
      const spark = scene.add.rectangle(x, y, 3, 3, color).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({
        targets: spark,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d + 6,
        alpha: 0,
        duration: 220 + Math.random() * 180,
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }
}
