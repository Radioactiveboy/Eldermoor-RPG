/**
 * The rules of a fight, kept apart from how it looks (see scenes/CombatScene.ts).
 *
 * Combat works like a tabletop game. Everyone rolls initiative (a d20 plus
 * their quickness) and acts in that order, one turn each, round after round.
 * An attack rolls a d20 plus the attacker's bonus; if it reaches the target's
 * armour class (AC) it hits and rolls damage. A natural 20 is a critical hit
 * (damage dice rolled twice); a natural 1 always misses.
 */

export type Side = 'party' | 'foes';

/** Dice like "2d4+2": roll `count` dice with `sides` sides and add `bonus`. */
export interface Dice {
  count: number;
  sides: number;
  bonus: number;
}

export function diceText(d: Dice): string {
  return `${d.count}d${d.sides}${d.bonus > 0 ? `+${d.bonus}` : d.bonus < 0 ? d.bonus : ''}`;
}

/**
 * Lasting effects on a fighter (see STATUSES). `turns` counts down at the end
 * of the owner's own turns; a few (like a raised guard) instead end when the
 * owner's next turn starts. `by` is who put it there, for effects that only
 * help the one who caused them (a marked foe is only marked for its hunter).
 */
export type StatusId = 'guarded' | 'prone' | 'dazed' | 'marked' | 'bleeding' | 'rallied';

export interface Status {
  id: StatusId;
  turns: number;
  /** Bleeding: damage at the start of each of the owner's turns. */
  value?: number;
  by?: string;
}

export interface StatusDef {
  name: string;
  /** Two or three letters for the turn-order cards. */
  tag: string;
  color: number;
  /** Helps the one who has it (blue/green) or hurts them (red/orange). */
  good: boolean;
  /** Ends when the owner's next turn starts, instead of counting down. */
  endsAtTurnStart?: boolean;
  describe: string;
}

export const STATUSES: Record<StatusId, StatusDef> = {
  guarded: { name: 'Guarded', tag: 'GRD', color: 0x6fb3e8, good: true, endsAtTurnStart: true, describe: `+${4} armour until their next turn.` },
  prone: { name: 'Prone', tag: 'PRN', color: 0xd9822b, good: false, endsAtTurnStart: true, describe: 'Knocked down: attacks against them roll with advantage. Getting up costs their next turn (the hero: their bonus action).' },
  dazed: { name: 'Dazed', tag: 'DZD', color: 0xc9a43a, good: false, describe: 'Reeling: their attacks roll with disadvantage.' },
  marked: { name: 'Marked', tag: 'MRK', color: 0xd0473a, good: false, describe: 'Marked as prey: the hunter gets +2 to hit and +1d4 damage against them.' },
  bleeding: { name: 'Bleeding', tag: 'BLD', color: 0xa8201a, good: false, describe: 'Loses health at the start of each turn.' },
  rallied: { name: 'Rallied', tag: 'RAL', color: 0x8fbf6a, good: true, describe: '+2 to hit, roused by the pack leader.' },
};

/**
 * What makes a beast more than a bag of hit points. Traits are read by
 * Battle.attack (trip, rend, charge), by shove (steady) and by the beasts'
 * own turns (howl). Add new kinds here and handle them in those places.
 */
export type FoeTrait =
  /** On a hit, the target must beat `dc` with d20 + quickness or be knocked prone (wolves drag their prey down). */
  | { kind: 'trip'; dc: number }
  /** On a hit, the wound bleeds `damage` a turn for `turns` turns. */
  | { kind: 'rend'; damage: number; turns: number }
  /** The first attack of the fight hits harder: `extra` dice of damage. */
  | { kind: 'charge'; extra: Dice }
  /** Rallies the rest of its pack (+2 to hit for 2 turns), every `cooldown` turns. */
  | { kind: 'howl'; cooldown: number }
  /** Heavy and sure-footed: resists being shoved with advantage. */
  | { kind: 'steady' };

export interface CombatantDef {
  id: string;
  name: string;
  side: Side;
  hp: number;
  maxHp: number;
  /** Armour class: an attack roll must reach this to hit. */
  ac: number;
  /** Added to the d20 when attacking. */
  toHit: number;
  damage: Dice;
  /** Added to the d20 for initiative, running away, and keeping your feet. */
  quickness: number;
  /** How the attack reads in the log, up to the target ("lunges at", "swing your staff at"). */
  verb: string;
  /** Game that would rather run: the chance each turn that it bolts (doubled once it's hurt). */
  skittish?: number;
  /** Never runs, however badly hurt (a boar fights to the end). */
  stubborn?: boolean;
  traits?: readonly FoeTrait[];
}

export interface Combatant extends CombatantDef {
  initiative: number;
  statuses: Status[];
  /** Turns left before each ability can be used again (Infinity: once a fight, already used). */
  cooldowns: Record<string, number>;
  /** Attacks made so far this fight (a charge only works the first time). */
  attacksMade: number;
  /** Left the fight by running away. */
  fled: boolean;
}

export const DEFEND_AC_BONUS = 4;
/** Being marked by a hunter: their bonus to hit, and extra damage. */
export const MARK_TO_HIT = 2;
export const MARK_DAMAGE: Dice = { count: 1, sides: 4, bonus: 0 };
export const RALLY_TO_HIT = 2;
/** Running away: beat this (plus 2 for each extra foe still standing) with d20 + quickness. */
export const FLEE_DC = 10;

/** +1: advantage (roll two d20, keep the higher). -1: disadvantage (keep the lower). 0: one die. */
export type RollMode = -1 | 0 | 1;

export interface AttackOptions {
  /** Added to the roll to hit (a heavy blow is -2). */
  toHit?: number;
  /** How many times the damage dice are rolled (a heavy blow rolls them twice). */
  times?: number;
  /** Half damage, rounded down but at least 1 (a sweep that catches everyone). */
  half?: boolean;
}

export interface AttackResult {
  attacker: Combatant;
  target: Combatant;
  /** The d20 that counted. */
  roll: number;
  /** Both dice, when rolling with advantage or disadvantage. */
  rolls: number[];
  mode: RollMode;
  total: number;
  ac: number;
  hit: boolean;
  crit: boolean;
  damage: number;
  killed: boolean;
  /** A wolf's bite: whether the target kept their feet. */
  trip?: { roll: number; total: number; dc: number; fell: boolean };
  /** A rat's bite left the target bleeding. */
  rend?: boolean;
  /** A boar's opening charge added to the damage. */
  charged?: boolean;
}

export interface FleeResult {
  roll: number;
  total: number;
  dc: number;
  success: boolean;
}

export interface ShoveResult {
  roll: number;
  total: number;
  /** The target's roll to keep its feet (the kept die, if it rolled two). */
  resist: number;
  resistTotal: number;
  steady: boolean;
  success: boolean;
}

/** What happened as a fighter's turn began. */
export interface TurnStart {
  /** Damage taken from bleeding. */
  bled: number;
  /** Was lying on the ground, and gets up. */
  stood: boolean;
  /** Effects that wore off. */
  expired: StatusId[];
}

export type Outcome = 'ongoing' | 'victory' | 'defeat' | 'escaped';

export type Rng = () => number;

export class Battle {
  readonly combatants: Combatant[];
  /** Turn order, highest initiative first. */
  order: Combatant[] = [];
  round = 1;
  private turn = 0;
  private readonly rng: Rng;

  constructor(defs: CombatantDef[], rng: Rng = Math.random) {
    this.rng = rng;
    this.combatants = defs.map((d) => ({ ...d, initiative: 0, statuses: [], cooldowns: {}, attacksMade: 0, fled: false }));
  }

  d(sides: number): number {
    return 1 + Math.floor(this.rng() * sides);
  }

  rollDice(dice: Dice, times = 1): number {
    let total = dice.bonus;
    for (let i = 0; i < dice.count * times; i++) total += this.d(dice.sides);
    return Math.max(1, total);
  }

  /** A d20 with advantage, disadvantage or neither: the die that counts, and every die rolled. */
  d20(mode: RollMode): { roll: number; rolls: number[] } {
    if (mode === 0) {
      const roll = this.d(20);
      return { roll, rolls: [roll] };
    }
    const rolls = [this.d(20), this.d(20)];
    return { roll: mode > 0 ? Math.max(...rolls) : Math.min(...rolls), rolls };
  }

  /** Everyone rolls d20 + quickness. Ties go to the quicker one, then to the party. */
  rollInitiative(): Array<{ who: Combatant; roll: number }> {
    const rolls = this.combatants.map((c) => {
      const roll = this.d(20);
      c.initiative = roll + c.quickness;
      return { who: c, roll };
    });
    this.order = [...this.combatants].sort(
      (a, b) => b.initiative - a.initiative || b.quickness - a.quickness || (a.side === 'party' ? -1 : 1),
    );
    this.turn = 0;
    this.round = 1;
    return rolls;
  }

  get current(): Combatant {
    return this.order[this.turn];
  }

  isUp(c: Combatant): boolean {
    return c.hp > 0 && !c.fled;
  }

  standing(side: Side): Combatant[] {
    return this.combatants.filter((c) => c.side === side && this.isUp(c));
  }

  outcome(): Outcome {
    if (this.standing('party').length === 0) {
      return this.combatants.some((c) => c.side === 'party' && c.fled) ? 'escaped' : 'defeat';
    }
    if (this.standing('foes').length === 0) return 'victory';
    return 'ongoing';
  }

  // ------------------------------------------------------------ statuses

  status(c: Combatant, id: StatusId): Status | undefined {
    return c.statuses.find((s) => s.id === id);
  }

  has(c: Combatant, id: StatusId): boolean {
    return !!this.status(c, id);
  }

  /** Puts an effect on someone. Getting it again renews it (the longer of the two lasts). */
  addStatus(c: Combatant, id: StatusId, turns: number, extra: Partial<Status> = {}): void {
    const had = this.status(c, id);
    if (had) Object.assign(had, extra, { turns: Math.max(had.turns, turns) });
    else c.statuses.push({ id, turns, ...extra });
  }

  removeStatus(c: Combatant, id: StatusId): void {
    c.statuses = c.statuses.filter((s) => s.id !== id);
  }

  trait<K extends FoeTrait['kind']>(c: Combatant, kind: K): Extract<FoeTrait, { kind: K }> | undefined {
    return c.traits?.find((t) => t.kind === kind) as Extract<FoeTrait, { kind: K }> | undefined;
  }

  // ------------------------------------------------------------ turns

  /**
   * Call as each fighter's turn begins: a raised guard drops, a fallen fighter
   * gets up, bleeding wounds hurt, and cooldowns tick down.
   */
  beginTurn(): TurnStart {
    const c = this.current;
    const start: TurnStart = { bled: 0, stood: false, expired: [] };
    for (const key of Object.keys(c.cooldowns)) {
      c.cooldowns[key] -= 1;
      if (c.cooldowns[key] <= 0) delete c.cooldowns[key];
    }
    const bleeding = this.status(c, 'bleeding');
    if (bleeding) {
      start.bled = Math.min(c.hp, bleeding.value ?? 1);
      c.hp -= start.bled;
    }
    start.stood = this.has(c, 'prone');
    for (const s of c.statuses) if (STATUSES[s.id].endsAtTurnStart) start.expired.push(s.id);
    c.statuses = c.statuses.filter((s) => !STATUSES[s.id].endsAtTurnStart);
    return start;
  }

  /** Effects tick down as the turn ends; then on to the next one still in the fight. A new round starts after the last. */
  endTurn(): StatusId[] {
    const c = this.current;
    const expired: StatusId[] = [];
    for (const s of c.statuses) if (!STATUSES[s.id].endsAtTurnStart && --s.turns <= 0) expired.push(s.id);
    c.statuses = c.statuses.filter((s) => !expired.includes(s.id));
    if (this.outcome() !== 'ongoing') return expired;
    do {
      this.turn++;
      if (this.turn >= this.order.length) {
        this.turn = 0;
        this.round++;
      }
    } while (!this.isUp(this.current));
    return expired;
  }

  ready(c: Combatant, ability: string): boolean {
    return !c.cooldowns[ability];
  }

  /** Starts an ability's cooldown: it can be used again after `turns` of the user's own turns (Infinity: not again this fight). */
  cooldown(c: Combatant, ability: string, turns: number): void {
    if (turns > 0) c.cooldowns[ability] = turns + 1;
  }

  // ------------------------------------------------------------ attacking

  armourOf(c: Combatant): number {
    return c.ac + (this.has(c, 'guarded') ? DEFEND_AC_BONUS : 0);
  }

  /** Bonus for fighting alongside others of your side, like wolves in a pack. */
  packBonus(attacker: Combatant): number {
    return attacker.side === 'foes' && this.standing('foes').length > 1 ? 2 : 0;
  }

  /** Is the target marked as prey by this attacker? */
  marks(attacker: Combatant, target: Combatant): boolean {
    return this.status(target, 'marked')?.by === attacker.id;
  }

  /** Everything added to the d20 when this attacker swings at this target. */
  toHitAgainst(attacker: Combatant, target: Combatant, opts: AttackOptions = {}): number {
    return (
      attacker.toHit +
      this.packBonus(attacker) +
      (this.has(attacker, 'rallied') ? RALLY_TO_HIT : 0) +
      (this.marks(attacker, target) ? MARK_TO_HIT : 0) +
      (opts.toHit ?? 0)
    );
  }

  /** Advantage when the target is down; disadvantage when the attacker is dazed or down. */
  rollMode(attacker: Combatant, target: Combatant): RollMode {
    let n = 0;
    if (this.has(target, 'prone')) n++;
    if (this.has(attacker, 'dazed')) n--;
    if (this.has(attacker, 'prone')) n--;
    return Math.sign(n) as RollMode;
  }

  /** The chance (0-1) that an attack lands, counting natural 1s and 20s and advantage. */
  hitChance(attacker: Combatant, target: Combatant, opts: AttackOptions = {}): number {
    const need = this.armourOf(target) - this.toHitAgainst(attacker, target, opts);
    let faces = 0;
    for (let r = 2; r <= 20; r++) if (r === 20 || r >= need) faces++;
    const p = faces / 20;
    const mode = this.rollMode(attacker, target);
    return mode > 0 ? 1 - (1 - p) ** 2 : mode < 0 ? p * p : p;
  }

  attack(attacker: Combatant, target: Combatant, opts: AttackOptions = {}): AttackResult {
    const mode = this.rollMode(attacker, target);
    const { roll, rolls } = this.d20(mode);
    const total = roll + this.toHitAgainst(attacker, target, opts);
    const ac = this.armourOf(target);
    const crit = roll === 20;
    const hit = roll !== 1 && (crit || total >= ac);
    const result: AttackResult = { attacker, target, roll, rolls, mode, total, ac, hit, crit, damage: 0, killed: false };
    const charge = this.trait(attacker, 'charge');
    if (hit) {
      const times = (crit ? 2 : 1) * (opts.times ?? 1);
      let damage = this.rollDice(attacker.damage, times);
      if (this.marks(attacker, target)) damage += this.rollDice(MARK_DAMAGE, crit ? 2 : 1);
      if (charge && attacker.attacksMade === 0) {
        damage += this.rollDice(charge.extra, crit ? 2 : 1);
        result.charged = true;
      }
      if (opts.half) damage = Math.max(1, Math.floor(damage / 2));
      result.damage = damage;
      target.hp = Math.max(0, target.hp - damage);
      result.killed = target.hp === 0;
    }
    attacker.attacksMade++;
    if (hit && !result.killed) {
      const trip = this.trait(attacker, 'trip');
      if (trip && !this.has(target, 'prone')) {
        const save = this.d(20);
        const saveTotal = save + target.quickness;
        const fell = save !== 20 && (save === 1 || saveTotal < trip.dc);
        if (fell) this.addStatus(target, 'prone', 1);
        result.trip = { roll: save, total: saveTotal, dc: trip.dc, fell };
      }
      const rend = this.trait(attacker, 'rend');
      if (rend) {
        this.addStatus(target, 'bleeding', rend.turns, { value: rend.damage });
        result.rend = true;
      }
    }
    return result;
  }

  defend(c: Combatant): void {
    this.addStatus(c, 'guarded', 1);
  }

  heal(c: Combatant, amount: number): void {
    c.hp = Math.min(c.maxHp, c.hp + amount);
  }

  /**
   * Knock someone off their feet: d20 + to-hit against their d20 + quickness
   * (with advantage for the heavy and sure-footed). Success leaves them prone.
   */
  shove(c: Combatant, target: Combatant): ShoveResult {
    const roll = this.d(20);
    const total = roll + c.toHit;
    const steady = !!this.trait(target, 'steady');
    const resist = this.d20(steady ? 1 : 0).roll;
    const resistTotal = resist + target.quickness;
    const success = total > resistTotal;
    if (success) this.addStatus(target, 'prone', 1);
    return { roll, total, resist, resistTotal, steady, success };
  }

  fleeDc(c: Combatant): number {
    const enemies = this.standing(c.side === 'party' ? 'foes' : 'party').length;
    return FLEE_DC + 2 * Math.max(0, enemies - 1);
  }

  tryFlee(c: Combatant): FleeResult {
    const roll = this.d(20);
    const total = roll + c.quickness;
    const dc = this.fleeDc(c);
    const success = roll === 20 || (roll !== 1 && total >= dc);
    if (success) c.fled = true;
    return { roll, total, dc, success };
  }
}

export type FoeAction = { type: 'attack'; target: Combatant } | { type: 'flee' } | { type: 'stand' } | { type: 'wait' };

/**
 * How a beast fights: it goes for whoever is weakest, and when badly hurt it
 * may lose its nerve and bolt (more likely if it's the last of its pack). A
 * beast knocked down spends its turn getting up.
 */
export function chooseFoeAction(battle: Battle, foe: Combatant, stood: boolean, rng: Rng = Math.random): FoeAction {
  if (stood) return { type: 'stand' };
  const targets = battle.standing('party');
  if (targets.length === 0) return { type: 'wait' };
  const hurt = foe.hp / foe.maxHp;
  const alone = battle.standing('foes').length === 1;
  if (foe.skittish && rng() < foe.skittish * (hurt < 1 ? 2 : 1)) return { type: 'flee' };
  if (!foe.stubborn && hurt <= 0.3 && rng() < (alone ? 0.45 : 0.2)) return { type: 'flee' };
  const target = targets.reduce((a, b) => (b.hp < a.hp ? b : a));
  return { type: 'attack', target };
}

/** A pack leader howls (before attacking) when it's ready and there's a pack still standing to rouse. */
export function shouldHowl(battle: Battle, foe: Combatant): boolean {
  const howl = battle.trait(foe, 'howl');
  return !!howl && battle.ready(foe, 'howl') && battle.standing('foes').some((f) => f !== foe && !battle.has(f, 'rallied'));
}

/**
 * The beasts that can be met in the wild, the experience each is worth when
 * slain, and whether others of its kind nearby join in (`packs`).
 */
export const FOES = {
  wolf: {
    name: 'Grey Wolf',
    maxHp: 22,
    ac: 12,
    toHit: 4,
    damage: { count: 2, sides: 4, bonus: 2 },
    quickness: 2,
    verb: 'lunges at',
    xp: 40,
    packs: true,
    traits: [{ kind: 'trip', dc: 9 }],
  },
  // The great white she-wolf who leads the wolves on the Lord's Road, from her den on the plains (see world/DenMap.ts).
  wolfmother: {
    name: 'Wolf Mother',
    maxHp: 64,
    ac: 13,
    toHit: 5,
    damage: { count: 2, sides: 6, bonus: 2 },
    quickness: 3,
    verb: 'savages',
    xp: 180,
    packs: true,
    stubborn: true,
    traits: [{ kind: 'trip', dc: 12 }, { kind: 'howl', cooldown: 3 }, { kind: 'steady' }],
  },
  // Plains game (see world/PlainsMap.ts): it would rather run than fight, so bring it down quickly.
  deer: {
    name: 'Red Deer',
    maxHp: 16,
    ac: 11,
    toHit: 2,
    damage: { count: 1, sides: 6, bonus: 0 },
    quickness: 4,
    verb: 'lashes out with its antlers at',
    xp: 25,
    packs: false,
    skittish: 0.12,
  },
  hare: {
    name: 'Brown Hare',
    maxHp: 5,
    ac: 13,
    toHit: 0,
    damage: { count: 1, sides: 2, bonus: 0 },
    quickness: 6,
    verb: 'kicks at',
    xp: 8,
    packs: false,
    skittish: 0.2,
  },
  boar: {
    name: 'Wild Boar',
    maxHp: 30,
    ac: 13,
    toHit: 4,
    damage: { count: 1, sides: 8, bonus: 2 },
    quickness: 1,
    verb: 'gores',
    xp: 60,
    packs: false,
    stubborn: true,
    traits: [{ kind: 'charge', extra: { count: 1, sides: 6, bonus: 0 } }, { kind: 'steady' }],
  },
  // The rats in the Crooked Tankard's cellar (see world/TavernMap.ts): weak alone, but they come in swarms.
  rat: {
    name: 'Cellar Rat',
    maxHp: 6,
    ac: 10,
    toHit: 1,
    damage: { count: 1, sides: 3, bonus: 0 },
    quickness: 3,
    verb: 'bites at',
    xp: 10,
    packs: true,
    traits: [{ kind: 'rend', damage: 1, turns: 2 }],
  },
} satisfies Record<string, Omit<CombatantDef, 'id' | 'side' | 'hp'> & { xp: number; packs: boolean }>;

export type FoeKind = keyof typeof FOES;
