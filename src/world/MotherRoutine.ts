import type { Npc } from '../entities/Npc';
import { NpcWorld } from '../entities/Npc';
import { gridToScreen, Vec2 } from '../iso/IsoMath';
import { QuestLog } from '../systems/Quests';
import type { IsoMap } from './IsoMap';
import type { MapObject, Seat } from './MapData';

/** What Mother is doing at an hour of the day. */
export type MotherActivity = 'bed' | 'table' | 'about';

/**
 * Mother's day, once the hero has first spoken to her (before that she waits
 * by her bed to talk to them): in bed from nine at night till seven, and for a
 * nap after dinner; at the table for breakfast, dinner and supper; and the rest
 * of the time pottering about the cottage (the hearth, the cupboard, the window).
 * The night of the tincture, and the morning after, she sleeps in her bed.
 */
export function motherActivity(hour: number): MotherActivity {
  if (QuestLog.hasFlag('raid-pending') || QuestLog.hasFlag('raid-morning')) return 'bed';
  if (hour >= 21 || hour < 7 || (hour >= 13.5 && hour < 15)) return 'bed';
  if ((hour >= 7 && hour < 8.5) || (hour >= 12 && hour < 13.5) || (hour >= 18 && hour < 19.5)) return 'table';
  return 'about';
}

/** Places she potters to, with the way she faces when she gets there and what she might say. */
const SPOTS: Array<{ at: Vec2; face: Vec2; says: string[] }> = [
  { at: { x: 3.9, y: 1.45 }, face: { x: 0, y: -1 }, says: ['*cough* That pot wants stirring.', 'Just a little more wood on, I think.'] },
  { at: { x: 6.5, y: 1.4 }, face: { x: 0, y: -1 }, says: ['Now where did I put that ladle...', 'We are low on oats again.'] },
  { at: { x: 7.4, y: 1.5 }, face: { x: 0, y: -1 }, says: ['Half a barrel of apples. That will see us to spring.'] },
  { at: { x: 0.85, y: 2.5 }, face: { x: -1, y: 0 }, says: ['Grey again. Still, the rain is good for the turnips.', 'Is that Iran\'s rooster? Noisy creature.'] },
  { at: { x: 1.4, y: 3.5 }, face: { x: -1, y: 0 }, says: ["Your father's old cloak. I can't bring myself to cut it up."] },
  { at: { x: 4.6, y: 2.2 }, face: { x: 0, y: 1 }, says: [] },
];

/** Beside the bed, where she gets in and out. */
const BEDSIDE: Vec2 = { x: 2.5, y: 1.2 };
/** Lying in it (the bed covers tiles (1, 0) and (1, 1)). */
const IN_BED: Vec2 = { x: 1.5, y: 1.1 };

/**
 * Walks Mother through her day in the cottage (see {@link motherActivity}):
 * when the hour comes, she gets up and goes to the table, or to bed, or about
 * her chores. Arriving in the cottage, she is already wherever she should be.
 */
export class MotherRoutine {
  private readonly mother: Npc;
  private readonly map: IsoMap;
  private readonly bed?: MapObject;
  private readonly seats: Seat[];
  /** What she's doing (or on her way to do). */
  private doing?: MotherActivity;
  private walking = false;
  private seat?: Seat;
  /** Seconds before she moves on to another chore. */
  private dwell = 0;
  private spot = -1;

  /** @param taken the seat the hero is sitting on, if any, so she doesn't sit in their lap */
  constructor(mother: Npc, map: IsoMap, private readonly taken: () => Seat | undefined) {
    this.mother = mother;
    this.map = map;
    this.bed = map.data.objects?.find((o) => o.key === 'furn-bed');
    this.seats = map.data.seats ?? [];
  }

  /** Before the hero has first spoken to her, she stays by her bed, waiting for them. */
  private get started(): boolean {
    return QuestLog.has('mother-medicine');
  }

  /** Put her straight wherever the hour has her. */
  settle(hour: number): void {
    if (!this.started) return;
    const now = motherActivity(hour);
    this.doing = now;
    this.walking = false;
    if (now === 'bed') this.lieDown();
    else if (now === 'table') this.sitDown(true);
    else this.potter(true);
  }

  update(dt: number, hour: number, busy: boolean): void {
    if (!this.started || busy || this.walking) return;
    const now = motherActivity(hour);
    if (this.doing === undefined) {
      // Just spoken to her for the first time: she goes about her day from here.
      this.doing = now === 'bed' ? 'about' : now;
      if (this.doing === 'table') this.sitDown(false);
      else this.potter(false);
      return;
    }
    if (now !== this.doing) {
      this.change(now);
      return;
    }
    if (now === 'about') {
      this.dwell -= dt;
      if (this.dwell <= 0) this.potter(false);
    }
  }

  /** From what she's doing to something else: up out of bed or off her stool first. */
  private change(to: MotherActivity): void {
    if (this.doing === 'bed') this.getUp();
    if (this.doing === 'table') this.standUp();
    this.doing = to;
    if (to === 'bed') {
      this.walkTo(BEDSIDE, () => this.lieDown());
    } else if (to === 'table') {
      this.sitDown(false);
    } else {
      this.potter(false);
    }
  }

  private walkTo(at: Vec2, then: () => void): void {
    this.walking = true;
    this.mother.goTo(at, () => {
      this.walking = false;
      then();
    });
  }

  private lieDown(): void {
    this.mother.sitting = false;
    this.mother.placeAt(IN_BED.x, IN_BED.y);
    if (this.bed) this.map.setObjectArt(this.bed, 'furn-bed-mother');
    const pillow = gridToScreen(1.5, 0.5);
    this.mother.tuck({ x: pillow.x, y: pillow.y - 30 });
    NpcWorld.motherInBed = true;
  }

  private getUp(): void {
    if (this.bed) this.map.setObjectArt(this.bed, 'furn-bed');
    this.mother.placeAt(BEDSIDE.x, BEDSIDE.y);
    this.mother.tuck();
    NpcWorld.motherInBed = false;
  }

  /** To the table: walk round to a free stool and sit on it, facing the table. */
  private sitDown(now: boolean): void {
    const mine = this.taken();
    const seat = this.seats.find((s) => s !== mine) ?? this.seats[0];
    if (!seat) {
      this.potter(now);
      return;
    }
    this.seat = seat;
    const sit = () => {
      this.mother.placeAt(seat.gx, seat.gy);
      this.mother.sitting = true;
      this.mother.turnTo({ x: seat.faceX, y: seat.faceY });
    };
    if (now) sit();
    else this.walkTo({ x: seat.standX, y: seat.standY }, sit);
  }

  private standUp(): void {
    this.mother.sitting = false;
    if (this.seat) this.mother.placeAt(this.seat.standX, this.seat.standY);
    this.seat = undefined;
  }

  /** On to another chore about the house, and now and then a word to herself when she gets there. */
  private potter(now: boolean): void {
    let next = Math.floor(Math.random() * SPOTS.length);
    if (next === this.spot) next = (next + 1) % SPOTS.length;
    this.spot = next;
    const spot = SPOTS[next];
    const arrive = () => {
      this.mother.turnTo(spot.face);
      this.dwell = 7 + Math.random() * 8;
      if (!now && spot.says.length > 0 && Math.random() < 0.45) this.mother.say(spot.says[Math.floor(Math.random() * spot.says.length)], 4);
    };
    if (now) {
      this.mother.placeAt(spot.at.x, spot.at.y);
      arrive();
    } else {
      this.walkTo(spot.at, arrive);
    }
  }
}
