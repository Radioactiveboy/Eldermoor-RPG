import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { Wayfarers } from '../dialogue/wayfarers';
import type { Creature } from '../entities/Creature';
import { Goat } from '../entities/Goat';
import { foodToShare, Npc } from '../entities/Npc';
import type { Vec2 } from '../iso/IsoMath';
import type { Interaction } from '../scenes/GameScene';
import type { FoeKind } from '../systems/Combat';
import { Experience } from '../systems/Experience';
import { Inventory } from '../systems/Inventory';
import { findPath } from '../systems/Pathfinding';
import { QuestLog } from '../systems/Quests';
import type { IsoMap } from './IsoMap';

/**
 * Chance meetings out on Adowvale Plains. Now and then, while the hero is out
 * on the plains, something happens along the Lord's Road: footpads step out of
 * the grass and ask for half the hero's purse; Jory the tinker has stopped to
 * rest his pack and will trade; Mags the goatherd has lost her goat; Hal,
 * Lord Morten's messenger, sits nursing a twisted ankle and would be glad of
 * something to eat; or, at night, a wolf pack is out hunting on the plain.
 * Which depends on the hour (and a roll of the dice), and none comes twice
 * running. Each lasts until it's played out, or the hero leaves it far behind.
 *
 * Add `?event=footpads` (or tinker, goat, courier, wolves) to the URL to have
 * that one happen a few seconds after arriving on the plains.
 */
export type RoadEventKind = 'footpads' | 'tinker' | 'goat' | 'courier' | 'wolves';
const KINDS: RoadEventKind[] = ['footpads', 'tinker', 'goat', 'courier', 'wolves'];

/** What the game lends the plains' events: people, beasts, conversations and fights. */
export interface RoadHost {
  scene: Phaser.Scene;
  map: IsoMap;
  player(): Vec2;
  /** Talking, fighting, in a menu or otherwise not free to be stopped on the road. */
  busy(): boolean;
  hour(): number;
  addNpc(id: string, gx: number, gy: number): Npc;
  removeNpc(npc: Npc): void;
  talk(npc: Npc): void;
  /** Runs once the conversation now going on has closed. */
  afterTalk(fn: () => void): void;
  addCreature(id: string, kind: FoeKind, gx: number, gy: number): Creature;
  removeCreature(creature: Creature): void;
  fight(first: Creature): void;
  hint(text: string): void;
  give(item: Parameters<typeof Inventory.add>[0], count: number): void;
}

/** Seconds on the plains before the first meeting may happen, and the chance it does. */
const FIRST_DELAY: [number, number] = [12, 30];
const FIRST_CHANCE = 0.75;
/** Seconds after one meeting before another might, and the chance each time the dice are rolled after that. */
const BETWEEN: [number, number] = [120, 240];
const RETRY_SECONDS = 40;
const LATER_CHANCE = 0.5;
/** Once the hero is this far from a meeting (in tiles), it's left behind and ends. */
const LEFT_BEHIND = 42;

/** The last kind of meeting, so the same one doesn't happen twice running (even across visits). */
let lastKind: RoadEventKind | undefined;

/** How likely each kind of meeting is at an hour of the day. */
function weights(hour: number): Record<RoadEventKind, number> {
  const night = hour >= 21 || hour < 5;
  const dusk = hour >= 18 || hour < 7;
  if (night) return { footpads: 3, wolves: 3, tinker: 0, goat: 0, courier: 0 };
  if (dusk) return { footpads: 3, wolves: 1, tinker: 1, goat: 1, courier: 1 };
  return { footpads: 1, wolves: 0, tinker: 3, goat: 3, courier: 2 };
}

const between = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo);

/** One meeting under way. */
interface Meeting {
  kind: RoadEventKind;
  /** Where it's centred, to tell when the hero has left it behind. */
  at: Vec2;
  /** Seconds since it began. */
  age: number;
  npcs: Npc[];
  creatures: Creature[];
  goat?: Goat;
  /** Seconds until someone next calls out. */
  callIn: number;
  /** Where it's got to (each kind has its own steps). */
  step: string;
  /** Seconds until the footpads next fix on where the hero is. */
  chaseIn: number;
}

/** What the tinker and the others call out as the hero comes near. */
const CALLS: Partial<Record<string, string[]>> = {
  tinker: ['Pots! Pans! Knives ground sharp!', 'Kettles mended while you wait!', 'Tinker! Tinker on the road!'],
  goatherd: ['Clover! Clooover!', 'Clover, you horrible goat, come BACK!', 'Has anyone seen a goat?'],
  courier: ['Ow. Ow, ow, ow.', 'Stupid hare.', "Hello? Is someone there? I'm not dead, just resting."],
};

export class PlainsEvents {
  private readonly host: RoadHost;
  private meeting?: Meeting;
  /** Seconds until the dice are next rolled for a meeting. */
  private nextRoll: number;
  private chance = FIRST_CHANCE;
  /** A meeting asked for in the URL, for testing. */
  private forced?: RoadEventKind;

  constructor(host: RoadHost) {
    this.host = host;
    const asked = new URLSearchParams(window.location.search).get('event');
    this.forced = KINDS.find((k) => k === asked);
    this.nextRoll = this.forced ? 3 : between(FIRST_DELAY);
  }

  /** What the hero can do with the meeting's goat (lead her), as well as talking to its people. */
  interactions(): Interaction[] {
    const goat = this.meeting?.goat;
    if (!goat || goat.following || Wayfarers.goat === 'home') return [];
    const p = goat.promptPoint;
    return [{
      key: 'goat', label: 'Lead', target: 'Clover', gx: goat.gx, gy: goat.gy, range: 1.9, promptX: p.x, promptY: p.y,
      tile: { x: Math.floor(goat.gx), y: Math.floor(goat.gy) },
      run: () => this.leadGoat(),
    }];
  }

  update(dt: number): void {
    const busy = this.host.busy();
    this.meeting?.goat?.update(dt, busy);
    if (!this.meeting) {
      this.nextRoll -= dt;
      if (this.nextRoll > 0 || busy) return;
      const kind = this.forced ?? (Math.random() < this.chance ? this.pick() : undefined);
      this.forced = undefined;
      this.chance = LATER_CHANCE;
      this.nextRoll = RETRY_SECONDS;
      if (kind && !this.begin(kind)) this.nextRoll = 5;
      return;
    }
    const m = this.meeting;
    m.age += dt;
    const me = this.host.player();
    if (Math.hypot(me.x - m.at.x, me.y - m.at.y) > LEFT_BEHIND && m.step !== 'fighting') {
      this.end();
      return;
    }
    if (busy) return;
    switch (m.kind) {
      case 'footpads':
        this.updateFootpads(dt, m, me);
        break;
      case 'goat':
        this.updateGoat(m, me);
        break;
      case 'wolves':
        if (m.creatures.every((c) => !c.active)) this.end(false);
        break;
    }
    this.callOut(dt, m, me);
  }

  /** A dialogue action from one of the meeting's people (the part after 'road:'). */
  action(action: string): void {
    const m = this.meeting;
    switch (action) {
      case 'footpads-paid': {
        const toll = Math.min(Wayfarers.toll, Inventory.coins);
        if (toll > 0 && Inventory.addCoins(-toll)) GameAudio.coins();
        QuestLog.writeDiary(
          `Two footpads stopped me on the Lord's Road, a lanky one in a hood called Rook and a bald one with a knife called Nab. ` +
            `I paid them ${toll} coins to let me by. Lord Morten takes his toll at the gate, and they take theirs out on the plains.`,
        );
        this.host.afterTalk(() => this.footpadsGo(false));
        break;
      }
      case 'footpads-leave':
        QuestLog.writeDiary("Two footpads stopped me on the Lord's Road, but my purse was empty. They let me go out of pity. I am not sure how I feel about that.");
        this.host.afterTalk(() => this.footpadsGo(false));
        break;
      case 'footpads-scared':
        Experience.gain(25, 'Faced down the footpads');
        QuestLog.writeDiary(
          "Two footpads stopped me on the Lord's Road and asked for half my purse. I told them I killed the Wolf Mother. " +
            'They went white, and found somewhere else to be. It seems her hide is spoken of in the Tankard.',
        );
        this.host.afterTalk(() => this.footpadsGo(true));
        break;
      case 'footpads-fight':
        this.host.afterTalk(() => this.footpadsFight());
        break;
      case 'goat-search':
        if (Wayfarers.goat === 'lost') Wayfarers.goat = 'searching';
        this.host.afterTalk(() => this.host.hint("A brown goat with a white face and a bell. She can't have gone far."));
        break;
      case 'goat-home':
        if (!m || Wayfarers.goat !== 'following') return;
        Wayfarers.goat = 'home';
        this.host.give('cheese', 2);
        Inventory.reward(6);
        GameAudio.coins();
        Experience.gain(35, 'Found Clover the goat');
        QuestLog.writeDiary(
          "Found a little goatherd called Mags on the Lord's Road, crying for her goat. I found Clover grazing out in the long grass and " +
            'led her back by her collar. Mags gave me two cheeses and six coins, which I think was everything she had.',
        );
        this.host.afterTalk(() => this.goatGoesHome());
        break;
      case 'courier-fed': {
        const food = foodToShare();
        if (!m || Wayfarers.courierFed || !food) return;
        Inventory.remove(food, 1);
        Wayfarers.courierFed = true;
        Inventory.reward(15);
        GameAudio.coins();
        Experience.gain(30, 'Helped a lamed messenger');
        QuestLog.writeDiary(
          "Met Hal, Lord Morten's messenger, sitting by the Lord's Road with his ankle swollen up like a turnip. I gave him something to eat " +
            'and he gave me fifteen coins and the news from Harrowford. He is limping on to the toll gate to beg a cart.',
        );
        this.host.afterTalk(() => {
          const hal = m.npcs[0];
          if (hal) this.walkOff(m, hal, this.roadAway(hal, -14));
        });
        break;
      }
      default:
        console.warn(`Unknown road action: ${action}`);
    }
  }

  /** The hero has left the plains: everyone goes with them. */
  shutdown(): void {
    this.meeting?.goat?.destroy();
    this.meeting = undefined;
  }

  /** Called when a fight on the plains has ended, so the footpads' meeting can finish. */
  fightOver(): void {
    if (this.meeting?.step === 'fighting') this.end(false);
  }

  // ------------------------------------------------------------ choosing and setting up

  private pick(): RoadEventKind | undefined {
    const w = weights(this.host.hour());
    const kinds = KINDS.filter((k) => k !== lastKind && w[k] > 0);
    const total = kinds.reduce((n, k) => n + w[k], 0);
    let roll = Math.random() * total;
    for (const k of kinds) {
      roll -= w[k];
      if (roll < 0) return k;
    }
    return kinds[0];
  }

  /** Start a meeting somewhere ahead of the hero. False if there was nowhere good to put it. */
  private begin(kind: RoadEventKind): boolean {
    const m: Meeting = { kind, at: { x: 0, y: 0 }, age: 0, npcs: [], creatures: [], callIn: 2, step: 'start', chaseIn: 0 };
    const ok = kind === 'footpads' ? this.beginFootpads(m)
      : kind === 'wolves' ? this.beginWolves(m)
        : kind === 'goat' ? this.beginGoat(m)
          : this.beginWaiting(m, kind === 'tinker' ? 'tinker' : 'courier');
    if (!ok) {
      for (const npc of m.npcs) this.host.removeNpc(npc);
      for (const c of m.creatures) this.host.removeCreature(c);
      m.goat?.destroy();
      return false;
    }
    lastKind = kind;
    this.meeting = m;
    return true;
  }

  /** Someone resting by the side of the road a little way off: the tinker, or the lamed messenger. */
  private beginWaiting(m: Meeting, id: 'tinker' | 'courier'): boolean {
    const spot = this.roadside(9, 16, 1.6);
    if (!spot) return false;
    if (id === 'courier') Wayfarers.courierFed = false;
    m.at = spot;
    m.npcs.push(this.host.addNpc(id, spot.x, spot.y));
    return true;
  }

  private beginGoat(m: Meeting): boolean {
    const spot = this.roadside(9, 15, 1.6);
    if (!spot) return false;
    // Clover has wandered off into the long grass, well away from the road.
    const graze = this.openGround(spot, 12, 20);
    if (!graze) return false;
    Wayfarers.goat = 'lost';
    m.at = spot;
    m.npcs.push(this.host.addNpc('goatherd', spot.x, spot.y));
    m.goat = new Goat(this.host.scene, this.host.map, graze.x, graze.y);
    return true;
  }

  /** Rook and Nab, waiting in the grass a little off the road ahead. */
  private beginFootpads(m: Meeting): boolean {
    const road = this.roadSpot(12, 18);
    const lurk = road && this.openGround(road, 3, 6);
    if (!lurk) return false;
    m.at = lurk;
    m.npcs.push(this.host.addNpc('footpad', lurk.x, lurk.y));
    m.npcs.push(this.host.addNpc('cutpurse', lurk.x + 0.9, lurk.y + 0.7));
    m.step = 'lurking';
    return true;
  }

  /** A pack of three wolves out hunting on the plain, at night. */
  private beginWolves(m: Meeting): boolean {
    const me = this.host.player();
    const den = this.openGround(me, 15, 22);
    if (!den) return false;
    m.at = den;
    const spots = [[0, 0], [1.2, 0.8], [-0.8, 1.3]];
    spots.forEach(([dx, dy], i) => {
      const x = den.x + dx;
      const y = den.y + dy;
      if (this.host.map.isWalkable(Math.floor(x), Math.floor(y))) m.creatures.push(this.host.addCreature(`road-wolf-${Date.now()}-${i}`, 'wolf', x, y));
    });
    this.host.scene.time.delayedCall(1500, () => {
      GameAudio.growl();
      this.host.hint('Howling, out across the plain. Something is hunting out there tonight. Best keep my distance, or keep low.');
    });
    return m.creatures.length > 0;
  }

  // ------------------------------------------------------------ while it plays out

  /** Rook and Nab come out of the grass and cut across to the hero, then Rook does the talking. */
  private updateFootpads(dt: number, m: Meeting, me: Vec2): void {
    if (m.step !== 'lurking' && m.step !== 'closing') return;
    const [rook, nab] = m.npcs;
    const near = rook.distanceTo(me.x, me.y);
    if (m.step === 'lurking' && near < 14) {
      m.step = 'closing';
      rook.say('You there! Hold up a moment, friend!', 3.5);
    }
    if (m.step !== 'closing') return;
    m.at = { x: rook.gx, y: rook.gy };
    if (near < 2.2 && rook.present) {
      m.step = 'talking';
      this.host.talk(rook);
      return;
    }
    // Outrun them, and they give it up as a bad job.
    if (near > 24) {
      rook.say('Ah, let him go. Not worth the running.', 3);
      this.footpadsGo(false);
      return;
    }
    m.chaseIn -= dt;
    if (m.chaseIn > 0) return;
    m.chaseIn = 1.2;
    const away = { x: rook.gx - me.x, y: rook.gy - me.y };
    const len = Math.hypot(away.x, away.y) || 1;
    rook.goTo({ x: me.x + (away.x / len) * 1.4, y: me.y + (away.y / len) * 1.4 });
    nab.goTo({ x: me.x + (away.x / len) * 1.6 - (away.y / len) * 1.2, y: me.y + (away.y / len) * 1.6 + (away.x / len) * 1.2 });
  }

  /** The footpads stroll off (or hurry, if they've had a fright), back into the grass. */
  private footpadsGo(scared: boolean): void {
    const m = this.meeting;
    if (!m || m.kind !== 'footpads') return;
    m.step = 'leaving';
    const me = this.host.player();
    const [rook, nab] = m.npcs;
    if (!rook || !nab) return;
    const away = this.openGround({ x: rook.gx, y: rook.gy }, 9, 14, me) ?? { x: rook.gx, y: rook.gy };
    if (scared) nab.say('Very much only passing!', 2.5);
    else rook.say(Inventory.coins > 0 ? 'Pleasure doing business.' : 'Go on, then.', 2.5);
    this.walkOff(m, rook, away);
    this.walkOff(m, nab, { x: away.x + 0.8, y: away.y + 0.6 });
  }

  /** Words fail: Rook and Nab square up. They're swapped for fighters in the same spots, and the fight begins. */
  private footpadsFight(): void {
    const m = this.meeting;
    if (!m || m.kind !== 'footpads') return;
    const stamp = Date.now();
    const kinds: FoeKind[] = ['footpad', 'cutpurse'];
    const foes = m.npcs.map((npc, i) => {
      const c = this.host.addCreature(`road-${kinds[i]}-${stamp}`, kinds[i], npc.gx, npc.gy);
      c.faceTowards(this.host.player().x, this.host.player().y);
      this.host.removeNpc(npc);
      return c;
    });
    m.npcs = [];
    m.creatures = foes;
    m.step = 'fighting';
    this.host.fight(foes[0]);
  }

  private leadGoat(): void {
    const goat = this.meeting?.goat;
    if (!goat) return;
    goat.follow(() => this.host.player());
    Wayfarers.goat = 'following';
    GameAudio.pickup();
    this.host.hint('I take her by the collar. Come on, Clover. Back to Mags with you.');
  }

  /** Once Clover is back beside Mags, Mags notices (and talks to the hero, if they're there too). */
  private updateGoat(m: Meeting, me: Vec2): void {
    const mags = m.npcs[0];
    const goat = m.goat;
    if (!mags || !goat || Wayfarers.goat !== 'following') return;
    m.at = { x: mags.gx, y: mags.gy };
    if (Math.hypot(goat.gx - mags.gx, goat.gy - mags.gy) > 3.2 || m.step === 'reunited') return;
    if (mags.distanceTo(me.x, me.y) > 3.4) return;
    m.step = 'reunited';
    this.host.talk(mags);
  }

  /** Mags takes Clover by the collar, and off they go down the road home. */
  private goatGoesHome(): void {
    const m = this.meeting;
    const mags = m?.npcs[0];
    if (!m || !mags || !m.goat) return;
    const goat = m.goat;
    goat.follow(() => ({ x: mags.gx, y: mags.gy }));
    mags.say('Come on, you. Home.', 3);
    this.walkOff(m, mags, this.roadAway(mags, 14), () => goat.fadeAway(500));
  }

  /** Someone near the hero calls out now and then: the tinker crying his wares, Mags calling for her goat. */
  private callOut(dt: number, m: Meeting, me: Vec2): void {
    m.callIn -= dt;
    if (m.callIn > 0) return;
    m.callIn = 7 + Math.random() * 7;
    const who = m.npcs.find((n) => n.present && !n.speech && CALLS[n.id] && n.distanceTo(me.x, me.y) < 14 && n.distanceTo(me.x, me.y) > 2.5);
    if (!who) return;
    if (who.id === 'goatherd' && Wayfarers.goat === 'home') return;
    if (who.id === 'courier' && Wayfarers.courierFed) return;
    const lines = CALLS[who.id]!;
    who.say(lines[Math.floor(Math.random() * lines.length)], 3.5);
  }

  /** Send someone off, and end the meeting once everyone in it has gone. */
  private walkOff(m: Meeting, npc: Npc, to: Vec2, then?: () => void): void {
    npc.leave(to, () => {
      this.host.removeNpc(npc);
      m.npcs = m.npcs.filter((n) => n !== npc);
      then?.();
      if (m.npcs.length === 0 && this.meeting === m) this.end(false);
    });
  }

  /** The meeting is over: clear away whoever is left (they've been left behind, so nobody sees them go). */
  private end(clear = true): void {
    const m = this.meeting;
    if (!m) return;
    this.meeting = undefined;
    this.nextRoll = between(BETWEEN);
    if (!clear) {
      // Those walking off finish their walk; a goat left behind goes with the meeting.
      if (m.goat && Wayfarers.goat !== 'home') m.goat.destroy();
      return;
    }
    for (const npc of m.npcs) this.host.removeNpc(npc);
    for (const c of m.creatures) if (c.active) this.host.removeCreature(c);
    m.goat?.destroy();
  }

  // ------------------------------------------------------------ finding places

  /** A point on the Lord's Road between `min` and `max` tiles from the hero, if there is one. */
  private roadSpot(min: number, max: number): Vec2 | undefined {
    const me = this.host.player();
    const road = this.host.map.data.road ?? [];
    const options = road.filter((p) => {
      const d = Math.hypot(p.x - me.x, p.y - me.y);
      return d >= min && d <= max;
    });
    return Phaser.Utils.Array.GetRandom(options) as Vec2 | undefined;
  }

  /** A walkable spot at the side of the road, `edge` tiles off its middle. */
  private roadside(min: number, max: number, edge: number): Vec2 | undefined {
    const road = this.host.map.data.road ?? [];
    for (let tries = 0; tries < 12; tries++) {
      const p = this.roadSpot(min, max);
      if (!p) return undefined;
      const i = road.indexOf(p);
      const next = road[Math.min(road.length - 1, i + 1)];
      const prev = road[Math.max(0, i - 1)];
      const along = { x: next.x - prev.x, y: next.y - prev.y };
      const len = Math.hypot(along.x, along.y) || 1;
      const side = Math.random() < 0.5 ? 1 : -1;
      const spot = { x: p.x - (along.y / len) * edge * side, y: p.y + (along.x / len) * edge * side };
      if (this.host.map.isWalkable(Math.floor(spot.x), Math.floor(spot.y)) && !this.host.map.blocked(spot.x, spot.y, 0.35)) return spot;
    }
    return undefined;
  }

  /**
   * Somewhere open and reachable between `min` and `max` tiles from `from`
   * (grass, not road), away from `avoid` if given.
   */
  private openGround(from: Vec2, min: number, max: number, avoid?: Vec2): Vec2 | undefined {
    const map = this.host.map;
    for (let tries = 0; tries < 30; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = min + Math.random() * (max - min);
      const tx = Math.floor(from.x + Math.cos(a) * r);
      const ty = Math.floor(from.y + Math.sin(a) * r);
      if (!map.isWalkable(tx, ty) || map.blocked(tx + 0.5, ty + 0.5, 0.4)) continue;
      if (avoid && Math.hypot(tx - avoid.x, ty - avoid.y) < Math.hypot(from.x - avoid.x, from.y - avoid.y)) continue;
      const path = findPath({ x: Math.floor(from.x), y: Math.floor(from.y) }, { x: tx, y: ty }, map.width, map.height, (x, y) => map.isWalkable(x, y), 2500);
      if (!path || path.length > max * 2.2) continue;
      return { x: tx + 0.5, y: ty + 0.5 };
    }
    return undefined;
  }

  /** A point `steps` along the road from where someone stands (negative: back towards the toll gate). */
  private roadAway(npc: Npc, steps: number): Vec2 {
    const road = this.host.map.data.road ?? [];
    let best = 0;
    road.forEach((p, i) => {
      if (npc.distanceTo(p.x, p.y) < npc.distanceTo(road[best].x, road[best].y)) best = i;
    });
    // The road runs from the toll gate (index 0) to the east edge.
    const i = Phaser.Math.Clamp(best + steps, 0, road.length - 1);
    return road[i] ?? { x: npc.gx, y: npc.gy };
  }
}
