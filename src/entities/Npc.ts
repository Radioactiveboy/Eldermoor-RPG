import Phaser from 'phaser';
import { DrawnDir, FEET_Y, FRAME_H } from '../art/character';
import type { DialogueScript } from '../dialogue/Dialogue';
import { MOTHER_INTRO, MOTHER_WAITING } from '../dialogue/mother';
import { BAKER, GUARD, SMITH, TANNER } from '../dialogue/market';
import { droverScript, PEDLAR, PILGRIM, SheepStage } from '../dialogue/travellers';
import { FeedStage, iranScript } from '../dialogue/iran';
import { CARTER, HERBWIFE, tollGuardScript } from '../dialogue/plains';
import { fishermanScript } from '../dialogue/fisherman';
import { TOLL } from '../world/MarketMap';
import { depthAt, gridToScreen, Vec2 } from '../iso/IsoMath';
import { marketOpen } from '../systems/MarketHours';
import { Inventory } from '../systems/Inventory';
import { findPath } from '../systems/Pathfinding';
import { QuestLog } from '../systems/Quests';
import type { Body, IsoMap } from '../world/IsoMap';
import type { Commute } from '../world/MapData';

/** How close (in tiles) the player must be to talk. */
export const TALK_RANGE = 1.7;
/** Travellers stop and turn to the player when they come this close. */
const NOTICE_RANGE = 2.4;
const WALK_SPEED = 1.3;

interface NpcDef {
  texture: string;
  /** Idle animation, for people who stay put. Walkers use '<texture>-idle-<dir>' and '-walk-'. */
  anim?: string;
  /** Which conversation to have, given the story so far and the hour of the day. */
  script: (hour: number) => DialogueScript;
  /**
   * A trader's conversation while their stall is shut: it opens on 'closing' as
   * they pack up and walk home, and on 'opening' on their way back in the morning.
   */
  offDuty?: DialogueScript;
  /** Wanders up and down the road, up to this many steps either side of where it started. */
  wander?: number;
  /** Strolls about anywhere within this many tiles of where it started (the militia on their rounds). */
  roam?: number;
  /** Talking distance, if not TALK_RANGE: stallholders are spoken to across their counters. */
  talkRange?: number;
  /** Sits where they are (on a stool, say) rather than standing. */
  sits?: boolean;
}

/** Travellers met before, who get a shorter hello next time. */
const met = new Set<string>();

/** A conversation that opens on one of several greetings, picked at random. */
function anyOf(script: DialogueScript, starts: string[]): () => DialogueScript {
  return () => ({ ...script, start: starts[Math.floor(Math.random() * starts.length)] });
}

/** A traveller's conversation: the long greeting the first time, the short one after. */
function traveller(id: string, script: DialogueScript): () => DialogueScript {
  return () => {
    const first = !met.has(id);
    met.add(id);
    return { ...script, start: first ? 'greet' : 'again' };
  };
}

/** How far along the hunt for Wil's ewes is (see the 'lost-sheep' quest). */
function sheepStage(): SheepStage {
  const quest = QuestLog.get('lost-sheep');
  if (!quest) return QuestLog.hasFlag('saw-bess') && QuestLog.hasFlag('saw-bramble') ? 'found-first' : 'none';
  if (quest.completed) return 'done';
  return quest.done.has('find') ? 'found' : 'active';
}

/** The militia grumble about their feet by day; after hours, they tell you the market is shut. */
const daytimeGuard = anyOf(GUARD, ['greet', 'tired', 'bored']);
function guardScript(hour: number): DialogueScript {
  return marketOpen(hour) ? daytimeGuard() : { ...GUARD, start: 'closed' };
}

/**
 * Where a trader is in their day: at the stall, covering it over at closing
 * time, walking home, indoors for the night, or walking back in the morning.
 */
type Shift = 'open' | 'packing' | 'leaving' | 'away' | 'arriving';
/** Seconds spent covering the stall before setting off home. */
const PACKING_SECONDS = 2.5;
/** Seconds to fade in or out at the front door. */
const DOOR_FADE_MS = 500;

/** How Farmer Iran's errand for chicken feed stands (see the 'chicken-feed' quest). */
function feedStage(): FeedStage {
  const quest = QuestLog.get('chicken-feed');
  if (!quest) return 'none';
  if (quest.completed) return 'done';
  return Inventory.count('chicken-feed') > 0 ? 'carrying' : 'active';
}

const NPCS: Record<string, NpcDef> = {
  mother: {
    texture: 'npc-mother',
    anim: 'mother-idle',
    script: () => (QuestLog.has('mother-medicine') ? MOTHER_WAITING : MOTHER_INTRO),
  },
  pedlar: { texture: 'folk-pedlar', script: traveller('pedlar', PEDLAR), wander: 7 },
  pilgrim: { texture: 'folk-pilgrim', script: traveller('pilgrim', PILGRIM), wander: 5 },
  drover: {
    texture: 'folk-drover',
    script: () => {
      const first = !met.has('drover');
      met.add('drover');
      return droverScript(sheepStage(), first);
    },
    wander: 9,
  },
  // Farmer Iran, keeping an eye on his hens.
  iran: {
    texture: 'folk-iran',
    script: () => {
      const first = !met.has('iran');
      met.add('iran');
      return iranScript(feedStage(), first);
    },
  },
  // Old Tobin, on his stool on the far shore of the lake, watching his float.
  fisherman: {
    texture: 'folk-fisherman',
    sits: true,
    script: () => {
      const first = !met.has('fisherman');
      met.add('fisherman');
      return fishermanScript(first, QuestLog.hasFlag('found-cave-door'));
    },
  },
  // The market's stallholders stand behind their counters, while the market is open.
  baker: { texture: 'folk-baker', script: traveller('baker', BAKER), offDuty: BAKER, talkRange: 2.6 },
  smith: { texture: 'folk-smith', script: traveller('smith', SMITH), offDuty: SMITH, talkRange: 2.6 },
  tanner: { texture: 'folk-tanner', script: traveller('tanner', TANNER), offDuty: TANNER, talkRange: 2.6 },
  // Lord Morten's men at the toll gate, who stand their ground.
  'tollguard-1': { texture: 'folk-tollguard', script: () => tollGuardScript(QuestLog.hasFlag('paid-toll'), Inventory.coins >= TOLL, TOLL, false) },
  'tollguard-2': { texture: 'folk-tollguard', script: () => tollGuardScript(QuestLog.hasFlag('paid-toll'), Inventory.coins >= TOLL, TOLL, true) },
  // Travellers on the Lord's Road across the plains.
  carter: { texture: 'folk-carter', script: traveller('carter', CARTER), wander: 14 },
  herbwife: { texture: 'folk-herbwife', script: traveller('herbwife', HERBWIFE), wander: 10 },
  // The village militia, walking their rounds of the square, day and night.
  ...Object.fromEntries(
    [1, 2, 3, 4].map((n) => [`guard-${n}`, { texture: 'folk-guard', script: guardScript, roam: 5 }]),
  ),
};

/**
 * Someone in the world who can be talked to. People who stay put (Mother, the
 * stallholders) block the tile they stand on; travellers stroll along the
 * road and the militia about the square, stopping to look about, and are
 * bumped into like any solid thing (see IsoMap.bodies). Stallholders keep
 * market hours: in the evening they cover their stalls and walk home, and in
 * the morning they walk back and open up again.
 */
export class Npc implements Body {
  readonly id: string;
  gx: number;
  gy: number;
  readonly radius = 0.28;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly def: NpcDef;
  private readonly map: IsoMap;
  /** Facing as one of 8 screen directions: 0 = south, 2 = east, 4 = north, 6 = west. */
  private facing = 0;
  // Wandering along the road.
  private readonly road: Vec2[] = [];
  private roadIndex = 0;
  private home = 0;
  /** Which side of the road they keep to: a nudge across it, in tiles. */
  private lane = 0;
  /** Points to walk through, with the road index each one is at (-1 off the road). */
  private route: Array<{ point: Vec2; index: number }> = [];
  private wait = 0;
  /** Where a roaming NPC started, which it never strays far from. */
  private readonly origin: Vec2;
  /** A trader's walk between their stall and their front door, and where they are in their day. */
  private readonly commute?: Commute;
  private shift: Shift = 'open';
  /** The hour of the day, as of the last update. */
  private hour: number;
  /** Something said out loud, shown in a bubble over their head (see ui/SpeechBubbles.ts). */
  speech?: string;
  private speechLeft = 0;

  /** For someone who stays put: the way they look when nobody is talking to them (the fisherman, at his float). */
  private readonly looking?: Vec2;

  /**
   * @param commute for a trader, their walk home (see MapData.Commute)
   * @param hour the hour of the day now, so a trader who has gone home isn't there to begin with
   * @param looking for someone who stays put, the grid direction they face when left alone
   */
  constructor(scene: Phaser.Scene, map: IsoMap, id: string, gx: number, gy: number, commute?: Commute, hour = 12, looking?: Vec2) {
    const def = NPCS[id];
    if (!def) throw new Error(`Unknown NPC: ${id}`);
    this.id = id;
    this.def = def;
    this.map = map;
    this.gx = gx;
    this.gy = gy;
    this.origin = { x: gx, y: gy };
    this.commute = commute;
    this.hour = hour;
    this.looking = looking;
    if (looking) this.face(looking);
    this.shadow = scene.add.image(0, 0, 'shadow');
    this.sprite = scene.add.sprite(0, 0, def.texture, 0).setOrigin(0.5, (FEET_Y + 0.5) / FRAME_H);
    if (def.wander && map.data.road?.length) {
      this.road = map.data.road;
      this.roadIndex = this.home = this.nearestRoadIndex(gx, gy);
      this.lane = (Math.random() - 0.5) * 0.6;
      this.facing = Math.floor(Math.random() * 8);
      this.wait = 1 + Math.random() * 3;
      map.bodies.add(this);
    } else if (def.roam) {
      this.facing = Math.floor(Math.random() * 8);
      this.wait = 1 + Math.random() * 4;
      map.bodies.add(this);
    } else {
      map.setOccupied(Math.floor(gx), Math.floor(gy), true);
    }
    if (def.anim) this.sprite.play({ key: def.anim, startFrame: Math.floor(Math.random() * 4) });
    if (commute && !marketOpen(hour, commute.late)) {
      // Already gone home for the night.
      this.shift = 'away';
      this.setVisible(false);
      map.setObjectArt(commute.stall, `${commute.stall.key}-closed`);
    }
    this.sync(false);
  }

  /** Here to be seen and talked to (not indoors for the night). */
  get present(): boolean {
    return this.shift !== 'away';
  }

  /** Say something out loud, in a bubble over their head, for a few seconds. */
  say(text: string, seconds = 5): void {
    this.speech = text;
    this.speechLeft = seconds;
  }

  get tileX(): number {
    return Math.floor(this.gx);
  }

  get tileY(): number {
    return Math.floor(this.gy);
  }

  /** The top of their head, where a speech bubble's tail points. */
  get speechPoint(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y - FEET_Y + 7 };
  }

  /** World position just above their head, for the talk prompt. */
  get promptPoint(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y - FEET_Y - 6 };
  }

  script(): DialogueScript {
    if (this.shift !== 'open' && this.def.offDuty) {
      return { ...this.def.offDuty, start: this.shift === 'arriving' ? 'opening' : 'closing' };
    }
    return this.def.script(this.hour);
  }

  /** Stallholders are spoken to across their counters; out from behind them, up close like anyone else. */
  get talkRange(): number {
    return (this.shift === 'open' || this.shift === 'packing') && this.def.talkRange ? this.def.talkRange : TALK_RANGE;
  }

  /** Walks about (along the road, round the square, or home from the market) rather than standing in one place. */
  private get moves(): boolean {
    return this.road.length > 0 || !!this.def.roam || this.commuting;
  }

  private get commuting(): boolean {
    return this.shift === 'leaving' || this.shift === 'arriving';
  }

  /** Turn to face a point (Mother is only drawn facing forward, so she just mirrors). */
  faceTowards(gx: number, gy: number): void {
    if (this.def.anim) {
      const screenDx = gridToScreen(gx - this.gx, gy - this.gy).x;
      if (Math.abs(screenDx) > 4) this.sprite.setFlipX(screenDx < 0);
      return;
    }
    this.face({ x: gx - this.gx, y: gy - this.gy });
    this.sync(false);
  }

  distanceTo(gx: number, gy: number): number {
    return Math.hypot(gx - this.gx, gy - this.gy);
  }

  /**
   * Stroll along the road (or about the square): walk a few steps, stop and
   * look about, repeat. Stops to face the player when they come near, so
   * they're easy to talk to.
   */
  update(dt: number, player: Vec2, paused: boolean, hour: number): void {
    this.hour = hour;
    if (this.speech && !paused) {
      this.speechLeft -= dt;
      if (this.speechLeft <= 0) this.speech = undefined;
    }
    if (this.commute) {
      this.keepHours(dt, paused);
      return;
    }
    if (!this.moves) {
      // Once the player has gone, back to what they were doing.
      if (this.looking && !paused && this.distanceTo(player.x, player.y) > NOTICE_RANGE) {
        this.face(this.looking);
        this.sync(false);
      }
      return;
    }
    if (paused || this.distanceTo(player.x, player.y) < NOTICE_RANGE) {
      if (this.distanceTo(player.x, player.y) < NOTICE_RANGE) this.face({ x: player.x - this.gx, y: player.y - this.gy });
      this.sync(false);
      return;
    }
    if (this.route.length === 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.decide();
      this.sync(false);
      return;
    }
    const next = this.route[0].point;
    const dx = next.x - this.gx;
    const dy = next.y - this.gy;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(dist, WALK_SPEED * dt);
    const nx = this.gx + (dx / dist) * step;
    const ny = this.gy + (dy / dist) * step;
    if (this.map.blocked(nx, ny, this.radius, true, this)) {
      // Someone else on the road: wait a moment, then think again.
      this.route = [];
      this.wait = 0.8 + Math.random();
      this.sync(false);
      return;
    }
    this.gx = nx;
    this.gy = ny;
    this.face({ x: dx, y: dy });
    if (dist - step < 0.02) {
      const reached = this.route.shift()!.index;
      if (reached >= 0) this.roadIndex = reached;
    }
    this.sync(true);
  }

  /**
   * A trader's day: at closing time, cover the stall and walk home; at opening
   * time, come out of the front door and walk back to the stall. They don't
   * stop for the player on the way (it's been a long day), but will stop to talk.
   */
  private keepHours(dt: number, paused: boolean): void {
    const c = this.commute!;
    const open = marketOpen(this.hour, c.late);
    if (paused) {
      if (this.commuting) this.sync(false);
      return;
    }
    switch (this.shift) {
      case 'open':
        if (open) return;
        this.shift = 'packing';
        this.wait = PACKING_SECONDS;
        this.map.setObjectArt(c.stall, `${c.stall.key}-closed`);
        return;
      case 'packing':
        this.wait -= dt;
        if (this.wait > 0) return;
        this.shift = 'leaving';
        this.route = this.commuteRoute(this.origin, c.exit, c.home);
        return;
      case 'away':
        if (!open) return;
        this.shift = 'arriving';
        this.gx = c.home.x;
        this.gy = c.home.y;
        this.route = this.commuteRoute(c.home, c.exit, this.origin, true);
        this.setVisible(true, true);
        return;
      default:
        if (this.walkRoute(dt)) return;
        if (this.shift === 'leaving') {
          // Home: in at the door, gone till morning.
          this.shift = 'away';
          this.setVisible(false, true);
        } else {
          // Back behind the counter: uncover the goods.
          this.shift = 'open';
          this.facing = 0;
          this.map.setObjectArt(c.stall, c.stall.key);
          this.sync(false);
        }
    }
  }

  /**
   * The way between the stall and home: out from behind the counter (which
   * only the trader may walk through), then by the open ground to the door.
   * @param reverse walking from home to the stall rather than from the stall home
   */
  private commuteRoute(from: Vec2, exit: Vec2, to: Vec2, reverse = false): Array<{ point: Vec2; index: number }> {
    const ground = reverse ? from : to;
    const a = { x: Math.floor(exit.x), y: Math.floor(exit.y) };
    const b = { x: Math.floor(ground.x), y: Math.floor(ground.y) };
    const tiles = findPath(reverse ? b : a, reverse ? a : b, this.map.width, this.map.height, (x, y) => this.map.isWalkable(x, y), 4000) ?? [];
    const middle = tiles.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
    const points = reverse ? [...middle, exit, to] : [exit, ...middle, to];
    return points.map((point) => ({ point, index: -1 }));
  }

  /** Walk on along the route, through anything in the way. False once it's walked. */
  private walkRoute(dt: number): boolean {
    const next = this.route[0]?.point;
    if (!next) return false;
    const dx = next.x - this.gx;
    const dy = next.y - this.gy;
    const dist = Math.hypot(dx, dy);
    const step = Math.min(dist, WALK_SPEED * dt);
    if (dist > 0) {
      this.gx += (dx / dist) * step;
      this.gy += (dy / dist) * step;
      this.face({ x: dx, y: dy });
    }
    if (dist - step < 0.02) this.route.shift();
    this.sync(true);
    return true;
  }

  /** Show or hide them, fading at the front door. */
  private setVisible(visible: boolean, fade = false): void {
    const targets = [this.sprite, this.shadow];
    this.sprite.scene.tweens.killTweensOf(targets);
    if (!fade) {
      for (const t of targets) t.setVisible(visible).setAlpha(1);
      return;
    }
    for (const t of targets) t.setVisible(true).setAlpha(visible ? 0 : 1);
    this.sprite.scene.tweens.add({
      targets,
      alpha: visible ? 1 : 0,
      duration: DOOR_FADE_MS,
      onComplete: () => {
        if (!visible) for (const t of targets) t.setVisible(false);
      },
    });
  }

  /** Pick what to do next: usually a short walk along the road, sometimes just a look round. */
  private decide(): void {
    if (this.def.roam) {
      this.roamSomewhere(this.def.roam);
      return;
    }
    const span = this.def.wander ?? 0;
    const lo = Math.max(0, this.home - span);
    const hi = Math.min(this.road.length - 1, this.home + span);
    if (Math.random() < 0.3) {
      this.facing = Math.floor(Math.random() * 8);
      this.wait = 1.5 + Math.random() * 2.5;
      return;
    }
    const target = Phaser.Math.Between(lo, hi);
    const dir = Math.sign(target - this.roadIndex);
    for (let i = this.roadIndex + dir; dir !== 0 && i !== target + dir; i += dir) {
      const p = this.road[i];
      this.route.push({ point: { x: p.x + this.lane, y: p.y + this.lane }, index: i });
    }
    this.wait = 2 + Math.random() * 4;
  }

  /**
   * Walk to a random open spot near where they started, or now and then just
   * stand and look about. Pauses are long: the militia are in no hurry.
   */
  private roamSomewhere(radius: number): void {
    if (Math.random() < 0.35) {
      this.facing = Math.floor(Math.random() * 8);
      this.wait = 2 + Math.random() * 3;
      return;
    }
    const from = { x: Math.floor(this.gx), y: Math.floor(this.gy) };
    for (let tries = 0; tries < 8; tries++) {
      const tx = Math.floor(this.origin.x + (Math.random() * 2 - 1) * radius);
      const ty = Math.floor(this.origin.y + (Math.random() * 2 - 1) * radius);
      if (!this.map.isWalkable(tx, ty) || (tx === from.x && ty === from.y)) continue;
      const path = findPath(from, { x: tx, y: ty }, this.map.width, this.map.height, (x, y) => this.map.isWalkable(x, y), 2000);
      if (!path || path.length === 0 || path.length > radius * 3) continue;
      this.route = path.map((p) => ({ point: { x: p.x + 0.5, y: p.y + 0.5 }, index: -1 }));
      break;
    }
    this.wait = 3 + Math.random() * 5;
  }

  private nearestRoadIndex(gx: number, gy: number): number {
    let best = 0;
    this.road.forEach((p, i) => {
      if (Math.hypot(p.x - gx, p.y - gy) < Math.hypot(this.road[best].x - gx, this.road[best].y - gy)) best = i;
    });
    return best;
  }

  /** Turn to face a grid-space direction, using its on-screen angle (as the player does). */
  private face(dir: Vec2): void {
    if (dir.x === 0 && dir.y === 0) return;
    const screen = gridToScreen(dir.x, dir.y);
    this.facing = (Math.round(Math.atan2(screen.x, screen.y) / (Math.PI / 4)) + 8) % 8;
  }

  private sync(moving: boolean): void {
    const p = gridToScreen(this.gx, this.gy);
    this.shadow.setPosition(p.x, p.y);
    this.sprite.setPosition(p.x, p.y);
    // Seated, drawn in front of the seat (as the player is).
    const d = (this.moves ? this.map.characterDepth(this.gx, this.gy) : depthAt(this.gx, this.gy)) + (this.def.sits ? 2 : 0);
    this.shadow.setDepth(d - 0.5);
    this.sprite.setDepth(d);
    if (this.def.anim) return;
    // Facings 0..4 are drawn (s, se, e, ne, n); 5..7 are the east ones mirrored.
    const names: DrawnDir[] = ['s', 'se', 'e', 'ne', 'n'];
    const mirrored = this.facing > 4;
    this.sprite.setFlipX(mirrored);
    const pose = moving ? 'walk' : this.def.sits ? 'sit' : 'idle';
    this.sprite.play(`${this.def.texture}-${pose}-${names[mirrored ? 8 - this.facing : this.facing]}`, true);
  }
}
