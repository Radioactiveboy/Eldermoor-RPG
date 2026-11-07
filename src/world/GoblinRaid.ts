import Phaser from 'phaser';
import { fenceKey, FENCE_MASKS } from '../art/farm';
import { GameAudio } from '../audio/Audio';
import { HERO_NAME } from '../config';
import type { Creature } from '../entities/Creature';
import type { Npc } from '../entities/Npc';
import { depthAt, gridToScreen, Vec2 } from '../iso/IsoMath';
import type { FoeKind } from '../systems/Combat';
import { QuestLog } from '../systems/Quests';
import type { Speaker } from '../ui/SpeechBubbles';
import type { IsoMap } from './IsoMap';
import { MapData, MapObject, placeObject, Prop } from './MapData';

/**
 * The goblin raid on the cottage, the morning after Mother takes her
 * tincture: how the farm looks while it's under attack and afterwards, and
 * the scripted morning itself (see {@link RaidDirector}).
 *
 * Where the story is, as saved flags:
 * - 'raid-pending': the tincture's been given; the hero must sleep.
 * - 'raid-morning': woken at dawn to shouting; the goblins are in the yard.
 * - 'raid-over': beaten and left for dead; the cottage burnt, Mother gone.
 */
export type RaidStage = 'none' | 'pending' | 'morning' | 'over';

export function raidStage(): RaidStage {
  if (QuestLog.hasFlag('raid-over')) return 'over';
  if (QuestLog.hasFlag('raid-morning')) return 'morning';
  if (QuestLog.hasFlag('raid-pending')) return 'pending';
  return 'none';
}

/** The ids of the raiders in the yard, and the one who leads them. */
export const RAID_LEADER = 'raid-brute';

/** What the hero hears, and what the log says, as the fight turns against them. */
export const RAID_DOOM = {
  round: 3,
  leader: RAID_LEADER,
  text: 'More of them pour in from all sides. The Brute sounds his horn, and they close round me.',
  trapped: 'They have me surrounded. There is nowhere to run.',
};

/** What the raiders shriek as they go about it. */
const GOBLIN_CRIES = [
  'Burn it! Burn it all!', 'Chickens! Grab the chickens!', 'Hee hee hee!', 'Smash! SMASH!', 'Find the old one!',
  'Mine! That one is MINE!', 'Skrrrah!', 'Pull it down!', 'Fire! More fire!', 'Man-meat! Over there!',
];
const BRUTE_CRIES = ['BREAK THE DOOR!', 'Take everything. Leave nothing standing.', 'The old woman. Bring her to me.', 'ON THEM!'];

/** The house's corner and the run's, found from the world map's buildings. */
function farmCorners(data: MapData): { home?: MapObject; hut?: MapObject; coop?: MapObject } {
  const objects = data.objects ?? [];
  return {
    home: objects.find((o) => o.key === 'bld-cottage'),
    hut: objects.find((o) => o.key === 'bld-hut'),
    coop: objects.find((o) => o.key === 'farm-coop'),
  };
}

/** Nobody about but the goblins: the travellers have fled the road, Iran is shut in with his children, and the hens are taken. */
function emptyTheFarm(data: MapData): void {
  const gone = new Set(['pedlar', 'pilgrim', 'drover', 'iran']);
  data.npcs = (data.npcs ?? []).filter((n) => !gone.has(n.id));
  data.creatures = (data.creatures ?? []).filter((c) => c.id !== 'cottage-wolf');
  if (data.hens) data.hens = { ...data.hens, flock: [] };
}

/** A flat mark on the ground (blood, ash, feathers), if there's room for it there. */
function decal(data: MapData, key: string, tx: number, ty: number, w = 1, h = 1): void {
  if (tx < 0 || ty < 0 || tx + w > data.width || ty + h > data.height) return;
  placeObject(data, { key, tx, ty, w, h, flat: true });
}

/** The garden's crops trodden into the mud: gone from the rows, and the soil churned. */
function trampleGarden(data: MapData): void {
  const crops = data.crops ?? [];
  for (const c of crops) if (data.props[c.ty]?.[c.tx] === Prop.Blocked) data.props[c.ty][c.tx] = Prop.None;
  const rows = new Map<number, number[]>();
  for (const c of crops) (rows.get(c.ty) ?? rows.set(c.ty, []).get(c.ty)!).push(c.tx);
  let i = 0;
  for (const [y, xs] of rows) for (const x of xs) if ((x + y) % 2 === 0) decal(data, `decal-trampled-${i++ % 3}`, x, y);
  data.crops = [];
}

/**
 * The yard on the morning of the raid: the hens gone, the travellers fled,
 * and the garden already trampled (the burning is added as it happens, by
 * the {@link RaidDirector}).
 */
export function raidWorld(data: MapData): void {
  emptyTheFarm(data);
  trampleGarden(data);
  const { home, coop } = farmCorners(data);
  if (home) {
    for (const [dx, dy, k] of [[4, 3, 0], [6, 5, 1], [2, 4, 2]] as const) decal(data, `decal-trampled-${k}`, home.tx + dx, home.ty + dy);
  }
  if (coop) {
    decal(data, 'decal-feathers-0', coop.tx + 2, coop.ty + 1);
    decal(data, 'decal-feathers-1', coop.tx + 3, coop.ty + 2);
  }
}

/**
 * The farm the day after: the cottage a burnt-out shell, still smoking; the
 * garden trampled flat; the fences broken and charred; Iran's coop burnt to
 * its frame and his hut scorched; feathers and blood across the yard; and
 * nobody on the road.
 */
export function ruinWorld(data: MapData): void {
  emptyTheFarm(data);
  trampleGarden(data);
  const { home, hut, coop } = farmCorners(data);
  for (const obj of data.objects ?? []) {
    if (obj.key === 'bld-cottage') obj.key = 'bld-cottage-burnt';
    else if (obj.key === 'bld-hut') obj.key = 'bld-hut-scorched';
    else if (obj.key === 'farm-coop') obj.key = 'farm-coop-burnt';
    else if (obj.key === 'farm-trough') obj.key = 'farm-trough-burnt';
    else if (FENCE_MASKS.some((m) => obj.key === fenceKey(m))) obj.key = `${obj.key}-burnt`;
  }
  // Every so often a piece of fence knocked flat altogether (and out of the way).
  const fences = (data.objects ?? []).filter((o) => o.key.startsWith('fence-'));
  fences.forEach((f, i) => {
    if ((f.tx * 7 + f.ty * 13 + i) % 5 !== 0) return;
    data.objects = data.objects!.filter((o) => o !== f);
    if (data.props[f.ty]?.[f.tx] === Prop.Blocked) data.props[f.ty][f.tx] = Prop.None;
    decal(data, `decal-debris-${i % 3}`, f.tx, f.ty);
  });
  data.chimneys = (data.chimneys ?? []).filter((c) => !home || Math.hypot(c.gx - home.tx, c.gy - home.ty) > 2);
  if (home) {
    const { tx, ty } = home;
    // Scorched ground all round the house, ash blown across the yard, blood where the hero fell.
    for (const [dx, dy, k] of [[-1, 2, 0], [2, 3, 1], [-1, -1, 2], [3, -2, 0]] as const) decal(data, `decal-scorch-${k}`, tx + dx, ty + dy, 2, 2);
    for (const [dx, dy, k] of [[4, 3, 0], [5, 0, 1], [1, 5, 2], [6, 4, 0]] as const) decal(data, `decal-ash-${k}`, tx + dx, ty + dy);
    decal(data, 'decal-blood-smear', tx + 5, ty + 2, 2, 1);
    decal(data, 'decal-blood-drops', tx + 4, ty + 4);
    decal(data, 'decal-debris-1', tx + 4, ty + 2);
    for (const [dx, dy, k] of [[5, 6, 0], [7, 5, 1], [3, 7, 2]] as const) decal(data, `decal-trampled-${k}`, tx + dx, ty + dy);
    // The ruins still smoking.
    (data.chimneys ??= []).push({ gx: tx + 1.2, gy: ty + 1.4, z: 40 }, { gx: tx + 2.4, gy: ty + 0.6, z: 30 });
  }
  if (coop) {
    for (const [dx, dy, k] of [[0, 2, 0], [2, 1, 1], [3, 3, 2], [1, 3, 0]] as const) decal(data, `decal-feathers-${k}`, coop.tx + dx, coop.ty + dy);
    decal(data, 'decal-scorch-1', coop.tx, coop.ty - 1, 2, 2);
    decal(data, 'decal-blood-drops', coop.tx + 2, coop.ty + 3);
    (data.chimneys ??= []).push({ gx: coop.tx + 1, gy: coop.ty + 0.6, z: 18 });
  }
  if (hut) decal(data, 'decal-scorch-2', hut.tx + 2, hut.ty + 2, 2, 2);
}

/** Where the raiders stand about the farm, relative to the cottage's back corner, and what each is. */
const RAIDERS: Array<{ id: string; kind: FoeKind; at: Vec2 }> = [
  { id: RAID_LEADER, kind: 'goblinbrute', at: { x: 6.2, y: 4.4 } },
  { id: 'raid-cutter-1', kind: 'goblin', at: { x: 7.5, y: 0.5 } },
  { id: 'raid-cutter-2', kind: 'goblin', at: { x: 5.6, y: 6.6 } },
  { id: 'raid-spear', kind: 'goblinspear', at: { x: 7.8, y: 3.0 } },
  { id: 'raid-torch-1', kind: 'goblintorch', at: { x: 1.6, y: 3.7 } },
  { id: 'raid-torch-2', kind: 'goblintorch', at: { x: 3.4, y: -1.3 } },
];

/** Fires on the cottage and about the yard: where (relative to the house), which art, and how far up. */
const FIRES: Array<{ at: Vec2; art: 'fire-big' | 'fire-small'; z: number; scale?: number }> = [
  { at: { x: 1.1, y: 1.7 }, art: 'fire-big', z: 70, scale: 1.35 },
  { at: { x: 2.0, y: 0.9 }, art: 'fire-big', z: 82, scale: 1.2 },
  { at: { x: 0.5, y: 2.4 }, art: 'fire-big', z: 58, scale: 1.1 },
  { at: { x: 1.6, y: 0.4 }, art: 'fire-big', z: 88, scale: 1 },
  { at: { x: 0.4, y: 1.0 }, art: 'fire-small', z: 72, scale: 1.3 },
  { at: { x: 2.4, y: 1.9 }, art: 'fire-small', z: 62, scale: 1.2 },
  { at: { x: 2.7, y: 2.6 }, art: 'fire-small', z: 24 },
  { at: { x: 0.6, y: 3.3 }, art: 'fire-small', z: 0 },
];

/** A raider's voice: a bubble over its head when it shrieks something. */
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

/** What the raid needs from the game scene. */
export interface RaidHooks {
  scene: Phaser.Scene;
  map: IsoMap;
  player: () => Vec2;
  /** The camera follows the hero again. */
  follow: () => void;
  hint: (text: string) => void;
  /** Take the controls (true if it could), or hand them back. */
  hold: () => boolean;
  release: () => void;
  addCreature: (id: string, kind: FoeKind, gx: number, gy: number) => Creature;
  /** Start the fight that can't be won, against these. */
  fight: (foes: Creature[]) => void;
  /** Ask a question with the given answers. */
  ask: (question: string, note: string, yes: string, no: string, onAnswer: (yes: boolean) => void) => void;
  /** Back inside the cottage, with the goblins at the door. */
  retreat: () => void;
  mother?: () => Npc | undefined;
  /** Walk the hero away from the door, into the room. */
  backAway?: (to: Vec2) => void;
}

/**
 * The morning of the raid, as it plays out:
 * - Outside: the goblins about the yard, setting fire to the house. The camera
 *   takes it in, the Brute bellows, and the hero chooses to stand and fight or
 *   run back indoors. Either way it ends with a fight that can't be won.
 * - Indoors: the shouting outside; then (once the hero has run back in, or if
 *   they wait too long) the door is beaten on, splinters, and the Brute and two
 *   of his raiders come in.
 */
export class RaidDirector {
  private readonly h: RaidHooks;
  private readonly cries: Cry[] = [];
  private raiders: Creature[] = [];
  private shoutTimer = 1.2;
  private breakInTimer = Infinity;
  private started = false;
  private readonly fires: Phaser.GameObjects.Sprite[] = [];

  constructor(hooks: RaidHooks) {
    this.h = hooks;
  }

  get speakers(): Speaker[] {
    return this.cries;
  }

  /** In the yard: the goblins and the fires, then the scene. */
  beginOutside(): void {
    const home = farmCorners(this.h.map.data).home;
    if (!home) return;
    this.raiders = RAIDERS.map((r) => {
      const at = this.open(home.tx + r.at.x, home.ty + r.at.y);
      const c = this.h.addCreature(r.id, r.kind, at.x, at.y);
      this.cries.push(new Cry(c));
      // The Brute stands his ground in the yard, watching the house burn; his band run about.
      if (r.kind === 'goblinbrute') c.engage();
      return c;
    });
    for (const f of FIRES) this.light(home.tx + f.at.x, home.ty + f.at.y, f.art, f.z, f.scale, depthAt(home.tx + 3, home.ty + 3) + 1);
    // Smoke rising off the thatch.
    (this.h.map.data.chimneys ??= []).push({ gx: home.tx + 1.3, gy: home.ty + 1.4, z: 120 }, { gx: home.tx + 2, gy: home.ty + 0.8, z: 110 });
    GameAudio.playMusic('raid');
    this.h.scene.time.delayedCall(300, () => this.cutscene());
  }

  /** Indoors on the raid morning: shouting outside, and in time the door broken down. */
  beginInside(retreated: boolean): void {
    GameAudio.playMusic('raid');
    this.breakInTimer = retreated ? 3 : 50;
    this.shoutTimer = 2;
    if (retreated) {
      this.h.scene.time.delayedCall(300, () => this.h.backAway?.({ x: 4.5, y: 2.4 }));
      this.h.scene.time.delayedCall(700, () => this.h.hint('I slam the door and drop the bar across it. Outside, something laughs.'));
    }
  }

  update(dt: number, busy: boolean): void {
    for (const c of this.cries) c.update(dt);
    this.shoutTimer -= dt;
    if (this.shoutTimer <= 0) {
      this.shoutTimer = 1.6 + Math.random() * 2.4;
      this.shout();
    }
    if (busy || this.started) return;
    this.breakInTimer -= dt;
    if (this.breakInTimer <= 0) this.breakIn();
  }

  /** Someone out there shrieks; outdoors, one of the raiders, in a bubble. */
  private shout(): void {
    if (this.cries.length > 0) {
      const cry = this.cries[Math.floor(Math.random() * this.cries.length)];
      if (!cry.creature.active) return;
      const brute = cry.creature.kind === 'goblinbrute';
      const lines = brute ? BRUTE_CRIES : GOBLIN_CRIES;
      cry.say(lines[Math.floor(Math.random() * lines.length)]);
      GameAudio.shriek(brute);
      return;
    }
    if (!this.started) GameAudio.shriek(Math.random() < 0.2);
  }

  /** A walkable spot as near as can be to (gx, gy). */
  private open(gx: number, gy: number): Vec2 {
    const map = this.h.map;
    for (let r = 0; r < 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const tx = Math.floor(gx) + dx;
          const ty = Math.floor(gy) + dy;
          if (map.isWalkable(tx, ty)) return { x: tx + (gx - Math.floor(gx)), y: ty + (gy - Math.floor(gy)) };
        }
      }
    }
    return { x: gx, y: gy };
  }

  private light(gx: number, gy: number, art: 'fire-big' | 'fire-small', z: number, scale = 1, depth?: number): void {
    const p = gridToScreen(gx, gy);
    const s = this.h.scene.add.sprite(p.x, p.y - z, art, Math.floor(Math.random() * 6)).setOrigin(0.5, 0.95).setScale(scale);
    s.play({ key: `${art}-burn`, startFrame: Math.floor(Math.random() * 6) });
    s.setDepth(depth ?? depthAt(gx, gy) + 0.5);
    this.fires.push(s);
  }

  /** The camera takes in the yard, the Brute calls them on, and the hero must choose. */
  private cutscene(): void {
    if (!this.h.hold()) {
      this.h.scene.time.delayedCall(300, () => this.cutscene());
      return;
    }
    const cam = this.h.scene.cameras.main;
    const brute = this.raiders.find((r) => r.id === RAID_LEADER)!;
    const cry = this.cries.find((c) => c.creature === brute)!;
    const me = this.h.player();
    this.h.hint('Goblins! Dozens of them, all over the farm. And the roof... the roof is on fire!');
    cam.stopFollow();
    const at = gridToScreen(brute.gx, brute.gy);
    cam.pan(at.x, at.y - 30, 1800, 'Sine.easeInOut');
    this.h.scene.time.delayedCall(1900, () => {
      GameAudio.warHorn();
      cam.shake(500, 0.004);
      brute.faceTowards(me.x, me.y);
      cry.say(`THERE! The whelp from the house! KILL IT!`, 3.4);
      for (const r of this.raiders) r.faceTowards(me.x, me.y);
    });
    this.h.scene.time.delayedCall(4200, () => {
      const p = gridToScreen(me.x, me.y);
      cam.pan(p.x, p.y, 900, 'Sine.easeInOut');
    });
    this.h.scene.time.delayedCall(5300, () => {
      this.h.follow();
      this.h.ask(
        'The goblins are coming for me!',
        `Mother is still inside, asleep. What do I do?`,
        'Stand and fight',
        'Retreat inside',
        (fight) => {
          this.h.release();
          if (fight) this.standAndFight();
          else this.h.retreat();
        },
      );
    });
  }

  private standAndFight(): void {
    this.started = true;
    this.h.hint(`"Get away from our house!"`);
    const me = this.h.player();
    const near = [...this.raiders].sort((a, b) => a.distanceTo(me.x, me.y) - b.distanceTo(me.x, me.y));
    // The Brute and the three nearest of his band come at the hero.
    const brute = near.find((r) => r.id === RAID_LEADER)!;
    const band = [brute, ...near.filter((r) => r !== brute).slice(0, 3)];
    this.h.scene.time.delayedCall(400, () => this.h.fight(band));
  }

  /** Indoors: hammering on the door, Mother waking, then the door gives way and they come in. */
  private breakIn(): void {
    if (!this.h.hold()) return;
    this.started = true;
    const scene = this.h.scene;
    const cam = scene.cameras.main;
    const mother = this.h.mother?.();
    const beat = (n: number, at: number) =>
      scene.time.delayedCall(at, () => {
        GameAudio.bang();
        cam.shake(180, 0.006 + n * 0.002);
      });
    beat(0, 0);
    beat(1, 700);
    beat(2, 1300);
    scene.time.delayedCall(900, () => mother?.say(`${HERO_NAME}? What's that banging? Who's there?`, 3.5));
    beat(3, 2300);
    beat(4, 2800);
    scene.time.delayedCall(3000, () => this.h.hint("They're breaking down the door!"));
    scene.time.delayedCall(4100, () => {
      GameAudio.smash();
      GameAudio.warHorn();
      cam.shake(500, 0.012);
      cam.flash(160, 90, 60, 30);
      const door = this.h.map.data.entries?.door ?? { x: 1.2, y: 5.5 };
      const band: Array<[string, FoeKind, number, number]> = [
        [RAID_LEADER, 'goblinbrute', door.x + 0.3, door.y - 0.2],
        ['raid-cutter-1', 'goblin', door.x + 0.6, door.y - 1.1],
        ['raid-torch-1', 'goblintorch', door.x + 1.2, door.y - 0.1],
      ];
      this.raiders = band.map(([id, kind, gx, gy]) => {
        const c = this.h.addCreature(id, kind, gx, gy);
        this.cries.push(new Cry(c));
        return c;
      });
      const brute = this.cries[0];
      brute.say('Here it is. And the old one, in her bed. Take them.', 3.4);
      mother?.say('No! Get away from my child! Get away!', 4);
    });
    scene.time.delayedCall(6000, () => {
      this.h.release();
      scene.time.delayedCall(120, () => this.h.fight(this.raiders));
    });
  }

  shutdown(): void {
    for (const f of this.fires) f.destroy();
  }
}

/** A short while in the dark: what the hero half remembers between going down and coming round. */
export const RAID_BLACKOUT = [
  'Blows, from every side.',
  'The ground coming up to meet me.',
  `Mother, screaming my name. "${HERO_NAME}! ${HERO_NAME}!"`,
  'Smoke. Laughing. Heat on my face.',
  'Then nothing at all.',
];
