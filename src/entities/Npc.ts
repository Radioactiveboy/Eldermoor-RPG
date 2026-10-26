import Phaser from 'phaser';
import { DrawnDir, FEET_Y, FRAME_H } from '../art/character';
import type { DialogueScript } from '../dialogue/Dialogue';
import { MOTHER_INTRO, MOTHER_WAITING } from '../dialogue/mother';
import { BAKER, GUARD, SMITH, TANNER } from '../dialogue/market';
import { DROVER, PEDLAR, PILGRIM } from '../dialogue/travellers';
import { depthAt, gridToScreen, Vec2 } from '../iso/IsoMath';
import { findPath } from '../systems/Pathfinding';
import { QuestLog } from '../systems/Quests';
import type { Body, IsoMap } from '../world/IsoMap';

/** How close (in tiles) the player must be to talk. */
export const TALK_RANGE = 1.7;
/** Travellers stop and turn to the player when they come this close. */
const NOTICE_RANGE = 2.4;
const WALK_SPEED = 1.3;

interface NpcDef {
  texture: string;
  /** Idle animation, for people who stay put. Walkers use '<texture>-idle-<dir>' and '-walk-'. */
  anim?: string;
  /** Which conversation to have, given the story so far. */
  script: () => DialogueScript;
  /** Wanders up and down the road, up to this many steps either side of where it started. */
  wander?: number;
  /** Strolls about anywhere within this many tiles of where it started (the militia on their rounds). */
  roam?: number;
  /** Talking distance, if not TALK_RANGE: stallholders are spoken to across their counters. */
  talkRange?: number;
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

const NPCS: Record<string, NpcDef> = {
  mother: {
    texture: 'npc-mother',
    anim: 'mother-idle',
    script: () => (QuestLog.has('mother-medicine') ? MOTHER_WAITING : MOTHER_INTRO),
  },
  pedlar: { texture: 'folk-pedlar', script: traveller('pedlar', PEDLAR), wander: 7 },
  pilgrim: { texture: 'folk-pilgrim', script: traveller('pilgrim', PILGRIM), wander: 5 },
  drover: { texture: 'folk-drover', script: traveller('drover', DROVER), wander: 9 },
  // The market's stallholders stand behind their counters.
  baker: { texture: 'folk-baker', script: traveller('baker', BAKER), talkRange: 2.6 },
  smith: { texture: 'folk-smith', script: traveller('smith', SMITH), talkRange: 2.6 },
  tanner: { texture: 'folk-tanner', script: traveller('tanner', TANNER), talkRange: 2.6 },
  // The village militia, walking their rounds of the square.
  ...Object.fromEntries(
    [1, 2, 3, 4].map((n) => [`guard-${n}`, { texture: 'folk-guard', script: anyOf(GUARD, ['greet', 'tired', 'bored']), roam: 5 }]),
  ),
};

/**
 * Someone in the world who can be talked to. People who stay put (Mother, the
 * stallholders) block the tile they stand on; travellers stroll along the
 * road and the militia about the square, stopping to look about, and are
 * bumped into like any solid thing (see IsoMap.bodies).
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

  constructor(scene: Phaser.Scene, map: IsoMap, id: string, gx: number, gy: number) {
    const def = NPCS[id];
    if (!def) throw new Error(`Unknown NPC: ${id}`);
    this.id = id;
    this.def = def;
    this.map = map;
    this.gx = gx;
    this.gy = gy;
    this.origin = { x: gx, y: gy };
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
    this.sync(false);
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

  get talkRange(): number {
    return this.def.talkRange ?? TALK_RANGE;
  }

  /** Walks about (along the road, or round the square) rather than standing in one place. */
  private get moves(): boolean {
    return this.road.length > 0 || !!this.def.roam;
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
  update(dt: number, player: Vec2, paused: boolean): void {
    if (!this.moves) return;
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
    const d = this.moves ? this.map.characterDepth(this.gx, this.gy) : depthAt(this.gx, this.gy);
    this.shadow.setDepth(d - 0.5);
    this.sprite.setDepth(d);
    if (this.def.anim) return;
    // Facings 0..4 are drawn (s, se, e, ne, n); 5..7 are the east ones mirrored.
    const names: DrawnDir[] = ['s', 'se', 'e', 'ne', 'n'];
    const mirrored = this.facing > 4;
    this.sprite.setFlipX(mirrored);
    this.sprite.play(`${this.def.texture}-${moving ? 'walk' : 'idle'}-${names[mirrored ? 8 - this.facing : this.facing]}`, true);
  }
}
