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
export type StatusId = 'guarded' | 'prone' | 'dazed' | 'marked' | 'bleeding' | 'rallied' | 'anointed' | 'stout' | 'windup' | 'enraged';

export interface Status {
  id: StatusId;
  turns: number;
  /** Bleeding: damage at the start of each of the owner's turns. */
  value?: number;
  by?: string;
  /** Wolfsbane: which kind of foe it bites. */
  family?: string;
  /** Winding up a blow: who it is meant for. */
  target?: string;
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
  // From brews at Old Maud's bench (see FightBoon), lasting the rest of the fight.
  anointed: { name: 'Wolfsbane', tag: 'BNE', color: 0x9a6ad0, good: true, describe: 'The blade is oiled with wolfsbane: extra damage against wolves.' },
  stout: { name: 'Stout', tag: 'STT', color: 0xb89a5a, good: true, describe: 'Braced by a draught of sage and nettle: more armour.' },
  // The Goblin Brute's (see FoeTrait 'smash' and 'enrage').
  windup: { name: 'Winding up', tag: 'WND', color: 0xe0602a, good: false, describe: 'Club raised high: next turn it comes down for double damage and knocks its target flat. Knock him down first, or raise your guard.' },
  enraged: { name: 'Enraged', tag: 'RGE', color: 0xc0281e, good: true, describe: `Berserk with pain: +${2} to hit and +1d6 damage, and shrugs off being dazed.` },
};

/**
 * What a brew does in a fight, beyond the health or stamina it gives (read
 * from the item, see systems/Inventory.ts). Using it is the Eat action; the
 * effect lasts the rest of the fight.
 */
export type FightBoon =
  /** Oil on the blade: `sides` more damage (one die) on every hit against foes of this `family`. */
  | { kind: 'bane'; family: 'wolf'; sides: number }
  /** `armour` more armour. */
  | { kind: 'ward'; armour: number };

/** One line on what a boon does, for tooltips and the fight's Eat menu. */
export function boonText(b: FightBoon): string {
  switch (b.kind) {
    case 'bane':
      return `+1d${b.sides} damage against wolves for the fight`;
    case 'ward':
      return `+${b.armour} armour for the fight`;
  }
}

/** Puts a brew's effect on someone for the rest of the fight. */
export function applyBoon(battle: Battle, c: Combatant, b: FightBoon): void {
  if (b.kind === 'bane') battle.addStatus(c, 'anointed', Infinity, { value: b.sides, family: b.family });
  else battle.addStatus(c, 'stout', Infinity, { value: b.armour });
}

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
  | { kind: 'steady' }
  /**
   * Every `cooldown` turns, raises its weapon for a crushing blow (the 'windup'
   * status, there for all to see), and brings it down on its next turn: damage
   * dice rolled twice, and the target knocked flat unless they beat `dc` with
   * d20 + quickness. Knocked down meanwhile, it loses the blow.
   */
  | { kind: 'smash'; cooldown: number; dc: number }
  /**
   * Every `cooldown` turns, beats the ground so it shakes under the whole party:
   * each must beat `dc` with d20 + quickness or take `damage` and be knocked
   * prone (half damage, and on their feet, if they make it). No armour helps.
   */
  | { kind: 'quake'; cooldown: number; dc: number; damage: Dice }
  /** Once, when brought below `below` of its health: shakes off a daze or a fall and fights on enraged (see STATUSES). */
  | { kind: 'enrage'; below: number }
  /** Has it in for the hero above all: goes for them first, unless someone else is about to drop. */
  | { kind: 'grudge' };

/**
 * What a weapon does beyond its damage, read by Battle.attack when the hero
 * swings it (each weapon's numbers are on its item, see systems/Inventory.ts).
 */
export type WeaponEffect =
  /** Set against a charge: `toHit` more against a foe that hasn't attacked yet this fight (it's still coming at you). */
  | { kind: 'set'; toHit: number }
  /** On a hit, a `chance` (0-1) that the wound bleeds `damage` a turn for `turns` turns. */
  | { kind: 'cleave'; chance: number; damage: number; turns: number }
  /** On a hit, a `chance` (0-1) that the foe is dazed for `turns` turns (its attacks roll with disadvantage). */
  | { kind: 'daze'; chance: number; turns: number }
  /** Ranged: one free shot before the first round, while the foes are still closing in. */
  | { kind: 'opening' };

/** A weapon's rules: its damage die, and what else it does. */
export interface Weapon {
  /** Sides of the damage die (a d6 if not given). */
  die: number;
  /** How a swing reads in the log, up to the target ("thrust your spear at"). */
  verb?: string;
  effect?: WeaponEffect;
}

/** Fists, and a weapon that doesn't say otherwise. */
export const FIST_DIE = 4;
export const WEAPON_DIE = 6;

/** One line on what a weapon's effect does, for its tooltip. */
export function weaponEffectText(e: WeaponEffect): string {
  switch (e.kind) {
    case 'set':
      return `+${e.toHit} to hit a foe still charging in`;
    case 'cleave':
      return `${Math.round(e.chance * 100)}% a hit bleeds (${e.damage} for ${e.turns} turns)`;
    case 'daze':
      return `${Math.round(e.chance * 100)}% a hit dazes${e.turns > 1 ? ` for ${e.turns} turns` : ''}`;
    case 'opening':
      return 'Ranged: a free shot as they close in';
  }
}

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
  /** The hero's weapon's own rule (see WeaponEffect). */
  weapon?: WeaponEffect;
  /** What sort of beast it is, for things that only work on some ('wolf' for wolfsbane). */
  family?: string;
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
/** Enraged: to hit, and extra damage. */
export const ENRAGE_TO_HIT = 2;
export const ENRAGE_DAMAGE: Dice = { count: 1, sides: 6, bonus: 0 };
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
  /** Wolfsbane on the blade: the extra damage it did. */
  bane?: number;
  /** A spear set against a foe still charging in: the bonus it gave to hit. */
  set?: number;
  /** A hatchet's hit opened a bleeding wound. */
  cleaved?: boolean;
  /** A cudgel's hit left the foe dazed. */
  dazed?: boolean;
}

/** One of the party, as the ground shook under them. */
export interface QuakeResult {
  target: Combatant;
  roll: number;
  total: number;
  dc: number;
  /** Kept their feet: half damage, and still standing. */
  kept: boolean;
  damage: number;
  killed: boolean;
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
  /**
   * A fight that's already decided (the goblins' raid): once set, it says
   * whether each attack hits or misses, whatever the dice would have said,
   * and the least damage a hit does. The d20 shown is still one that would
   * give that result, so the fight reads as plain bad luck.
   */
  fate?: { decide: (attacker: Combatant, target: Combatant) => 'hit' | 'miss' | undefined; minDamage?: (attacker: Combatant) => number };

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
    // Knocked flat, a blow being wound up is lost; and nothing dazes a berserker.
    if (id === 'prone') this.removeStatus(c, 'windup');
    if (id === 'dazed' && this.has(c, 'enraged')) return;
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
    return c.ac + (this.has(c, 'guarded') ? DEFEND_AC_BONUS : 0) + (this.status(c, 'stout')?.value ?? 0);
  }

  /** Bonus for fighting alongside others of your side, like wolves in a pack. */
  packBonus(attacker: Combatant): number {
    return attacker.side === 'foes' && this.standing('foes').length > 1 ? 2 : 0;
  }

  /** Is the target marked as prey by this attacker? */
  marks(attacker: Combatant, target: Combatant): boolean {
    return this.status(target, 'marked')?.by === attacker.id;
  }

  /** A spear's bonus against a foe that hasn't attacked yet (it's still charging in), or 0. */
  setBonus(attacker: Combatant, target: Combatant): number {
    return attacker.weapon?.kind === 'set' && target.attacksMade === 0 ? attacker.weapon.toHit : 0;
  }

  /** Everything added to the d20 when this attacker swings at this target. */
  toHitAgainst(attacker: Combatant, target: Combatant, opts: AttackOptions = {}): number {
    return (
      attacker.toHit +
      this.packBonus(attacker) +
      (this.has(attacker, 'rallied') ? RALLY_TO_HIT : 0) +
      (this.has(attacker, 'enraged') ? ENRAGE_TO_HIT : 0) +
      (this.marks(attacker, target) ? MARK_TO_HIT : 0) +
      this.setBonus(attacker, target) +
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
    let { roll, rolls } = this.d20(mode);
    const bonus = this.toHitAgainst(attacker, target, opts);
    const set = this.setBonus(attacker, target);
    const ac = this.armourOf(target);
    const fated = this.fate?.decide(attacker, target);
    if (fated) {
      // A roll that gives what fate has decided: enough to hit (never a 1), or too little (never a 20).
      const need = Math.max(2, ac - bonus);
      roll = fated === 'hit'
        ? need > 19 ? 20 : need + Math.floor(this.rng() * (20 - need))
        : need <= 2 ? 1 : 1 + Math.floor(this.rng() * Math.min(19, need - 1));
      rolls = [roll];
    }
    const total = roll + bonus;
    const crit = roll === 20;
    const hit = roll !== 1 && (crit || total >= ac);
    const result: AttackResult = { attacker, target, roll, rolls, mode, total, ac, hit, crit, damage: 0, killed: false };
    if (set) result.set = set;
    const charge = this.trait(attacker, 'charge');
    if (hit) {
      const times = (crit ? 2 : 1) * (opts.times ?? 1);
      let damage = this.rollDice(attacker.damage, times);
      if (this.marks(attacker, target)) damage += this.rollDice(MARK_DAMAGE, crit ? 2 : 1);
      if (this.has(attacker, 'enraged')) damage += this.rollDice(ENRAGE_DAMAGE, crit ? 2 : 1);
      const bane = this.status(attacker, 'anointed');
      if (bane && target.family && bane.family === target.family) {
        const extra = this.rollDice({ count: 1, sides: bane.value ?? 6, bonus: 0 }, crit ? 2 : 1);
        damage += extra;
        result.bane = extra;
      }
      if (charge && attacker.attacksMade === 0) {
        damage += this.rollDice(charge.extra, crit ? 2 : 1);
        result.charged = true;
      }
      if (opts.half) damage = Math.max(1, Math.floor(damage / 2));
      if (fated === 'hit' && this.fate?.minDamage) damage = Math.max(damage, this.fate.minDamage(attacker));
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
      const w = attacker.weapon;
      if (w?.kind === 'cleave' && this.rng() < w.chance) {
        this.addStatus(target, 'bleeding', w.turns, { value: w.damage, by: attacker.id });
        result.cleaved = true;
      }
      if (w?.kind === 'daze' && this.rng() < w.chance) {
        this.addStatus(target, 'dazed', w.turns, { by: attacker.id });
        result.dazed = true;
      }
    }
    return result;
  }

  /** Raises a crushing blow for next turn, meant for `target` (see FoeTrait 'smash'). */
  windUp(c: Combatant, target: Combatant): void {
    const smash = this.trait(c, 'smash');
    if (smash) this.cooldown(c, 'smash', smash.cooldown);
    // Lasts through the end of this turn, and is spent at the start of the next.
    this.addStatus(c, 'windup', 2, { target: target.id });
  }

  /** Brings a wound-up blow down: an attack with its damage rolled twice, that knocks the target flat unless they keep their feet. */
  smash(c: Combatant, target: Combatant): AttackResult {
    const smash = this.trait(c, 'smash');
    this.removeStatus(c, 'windup');
    const r = this.attack(c, target, { times: 2 });
    if (r.hit && !r.killed && smash && !this.has(target, 'prone')) {
      const save = this.d(20);
      const saveTotal = save + target.quickness;
      const fell = save !== 20 && (save === 1 || saveTotal < smash.dc);
      if (fell) this.addStatus(target, 'prone', 1);
      r.trip = { roll: save, total: saveTotal, dc: smash.dc, fell };
    }
    return r;
  }

  /** The ground shakes under everyone on the other side (see FoeTrait 'quake'). */
  quake(c: Combatant): QuakeResult[] {
    const quake = this.trait(c, 'quake');
    if (!quake) return [];
    this.cooldown(c, 'quake', quake.cooldown);
    const results: QuakeResult[] = [];
    for (const target of this.standing(c.side === 'foes' ? 'party' : 'foes')) {
      const roll = this.d(20);
      const total = roll + target.quickness;
      const fated = this.fate?.decide(c, target);
      const kept = fated ? fated === 'miss' : roll === 20 || (roll !== 1 && total >= quake.dc);
      let damage = this.rollDice(quake.damage);
      if (kept) damage = Math.max(1, Math.floor(damage / 2));
      if (this.has(c, 'enraged')) damage += kept ? 0 : this.rollDice(ENRAGE_DAMAGE);
      target.hp = Math.max(0, target.hp - damage);
      const killed = target.hp === 0;
      if (!kept && !killed) this.addStatus(target, 'prone', 1);
      results.push({ target, roll, total, dc: quake.dc, kept, damage, killed });
    }
    return results;
  }

  /** Whether the beast flies into its rage now (see FoeTrait 'enrage'). */
  shouldEnrage(c: Combatant): boolean {
    const enrage = this.trait(c, 'enrage');
    return !!enrage && c.hp > 0 && c.hp <= c.maxHp * enrage.below && this.ready(c, 'enrage');
  }

  /** Flies into a rage: on its feet, clear-headed, and enraged for the rest of the fight. */
  enrage(c: Combatant): void {
    c.cooldowns.enrage = Infinity;
    this.removeStatus(c, 'prone');
    this.removeStatus(c, 'dazed');
    this.addStatus(c, 'enraged', Infinity);
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

export type FoeAction =
  | { type: 'attack'; target: Combatant }
  /** Raise a crushing blow for next turn (see FoeTrait 'smash'). */
  | { type: 'windup'; target: Combatant }
  /** Bring the wound-up blow down. */
  | { type: 'smash'; target: Combatant }
  /** Shake the ground under the whole party (see FoeTrait 'quake'). */
  | { type: 'quake' }
  | { type: 'flee' }
  | { type: 'stand' }
  | { type: 'wait' };

/** What a fighter's blow does on average. */
export function averageDamage(c: Combatant | CombatantDef): number {
  return c.damage.count * ((c.damage.sides + 1) / 2) + c.damage.bonus;
}

/**
 * Who a beast goes for. One it can likely finish with this blow comes first
 * (the most dangerous of them, if there are several). Otherwise it picks at
 * random, leaning towards the hero (twice as likely as a companion, as they
 * lead the fight; far more for a foe with a grudge) and towards whoever is
 * most hurt, by share of their health, so a companion with less health than
 * the hero isn't hounded the whole fight just for that.
 */
export function chooseFoeTarget(battle: Battle, foe: Combatant, rng: Rng = Math.random, heroId = 'hero'): Combatant {
  const targets = battle.standing('party');
  if (targets.length === 1) return targets[0];
  const finishable = targets.filter((t) => t.hp <= averageDamage(foe));
  if (finishable.length > 0) return finishable.reduce((a, b) => (averageDamage(b) > averageDamage(a) ? b : a));
  const grudge = !!battle.trait(foe, 'grudge');
  const weight = (t: Combatant) => (t.id === heroId ? (grudge ? 6 : 2) : 1) * (2 - t.hp / t.maxHp);
  const total = targets.reduce((sum, t) => sum + weight(t), 0);
  let pick = rng() * total;
  for (const t of targets) {
    pick -= weight(t);
    if (pick < 0) return t;
  }
  return targets[targets.length - 1];
}

/**
 * How a beast fights: it goes for one of the party (see chooseFoeTarget), and
 * when badly hurt it may lose its nerve and bolt (more likely if it's the last
 * of its pack). A beast knocked down spends its turn getting up. A Brute with
 * a blow wound up brings it down; when his quake or smash is ready he uses it.
 */
export function chooseFoeAction(battle: Battle, foe: Combatant, stood: boolean, rng: Rng = Math.random): FoeAction {
  if (stood) return { type: 'stand' };
  const targets = battle.standing('party');
  if (targets.length === 0) return { type: 'wait' };
  const windup = battle.status(foe, 'windup');
  if (windup) {
    const meant = targets.find((t) => t.id === windup.target);
    return { type: 'smash', target: meant ?? chooseFoeTarget(battle, foe, rng) };
  }
  const hurt = foe.hp / foe.maxHp;
  const alone = battle.standing('foes').length === 1;
  if (foe.skittish && rng() < foe.skittish * (hurt < 1 ? 2 : 1)) return { type: 'flee' };
  if (!foe.stubborn && hurt <= 0.3 && rng() < (alone ? 0.45 : 0.2)) return { type: 'flee' };
  // Worth shaking the ground when it catches more than one, or the one left is still on their feet.
  const quake = battle.trait(foe, 'quake');
  if (quake && battle.ready(foe, 'quake') && targets.some((t) => !battle.has(t, 'prone'))) return { type: 'quake' };
  const target = chooseFoeTarget(battle, foe, rng);
  if (battle.trait(foe, 'smash') && battle.ready(foe, 'smash') && target.hp > averageDamage(foe)) return { type: 'windup', target };
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
 *
 * The numbers are tuned with the fight simulator (`npm run sim`, see
 * systems/CombatSim.ts): a level-1 hero beats a lone wolf nearly always but
 * loses about a fifth of their health, two wolves about 3 times in 4, and the
 * Wolf Mother in her den about 60% of the time at levels 3-4. Re-run it
 * after changing anything here.
 */
export const FOES = {
  wolf: {
    name: 'Grey Wolf',
    maxHp: 22,
    ac: 12,
    toHit: 4,
    damage: { count: 2, sides: 6, bonus: 2 },
    quickness: 2,
    verb: 'lunges at',
    xp: 40,
    packs: true,
    family: 'wolf',
    traits: [{ kind: 'trip', dc: 9 }],
  },
  // The great white she-wolf who leads the wolves on the Lord's Road, from her den on the plains (see world/DenMap.ts).
  wolfmother: {
    name: 'Wolf Mother',
    maxHp: 80,
    ac: 13,
    toHit: 6,
    damage: { count: 2, sides: 8, bonus: 4 },
    quickness: 3,
    verb: 'savages',
    xp: 180,
    packs: true,
    family: 'wolf',
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
    maxHp: 34,
    ac: 13,
    toHit: 5,
    damage: { count: 2, sides: 6, bonus: 3 },
    quickness: 1,
    verb: 'gores',
    xp: 60,
    packs: false,
    stubborn: true,
    traits: [{ kind: 'charge', extra: { count: 1, sides: 6, bonus: 0 } }, { kind: 'steady' }],
  },
  // The wild cats of the north woods (see world/NorthWoodsMap.ts): small, but quick and savage, and they fight alone.
  // Their claws open wounds that bleed. Tuned with `npm run sim`: a fresh hero always wins but loses about a fifth of
  // their health, a little more than to a lone wolf, and the fight takes as long as a wolf's.
  wildcat: {
    name: 'Wild Cat',
    maxHp: 18,
    ac: 15,
    toHit: 5,
    damage: { count: 1, sides: 6, bonus: 3 },
    quickness: 5,
    verb: 'rakes its claws across',
    xp: 40,
    packs: false,
    traits: [{ kind: 'rend', damage: 1, turns: 2 }],
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
  // Footpads who waylay travellers on the Lord's Road (see world/PlainsEvents.ts). They fight together, and run once it goes badly.
  footpad: {
    name: 'Footpad',
    maxHp: 30,
    ac: 12,
    toHit: 5,
    damage: { count: 1, sides: 8, bonus: 4 },
    quickness: 2,
    verb: 'swings his cudgel at',
    xp: 70,
    packs: true,
    outlaw: true,
  },
  cutpurse: {
    name: 'Cutpurse',
    maxHp: 18,
    ac: 13,
    toHit: 5,
    damage: { count: 1, sides: 6, bonus: 4 },
    quickness: 4,
    verb: 'slashes his knife at',
    xp: 50,
    packs: true,
    outlaw: true,
    skittish: 0.06,
  },
  // The goblins who raid the Hollow (see world/GoblinRaid.ts): vicious little things that come in a mob, led by a Brute.
  goblin: {
    name: 'Goblin Cutter',
    maxHp: 14,
    ac: 12,
    toHit: 4,
    damage: { count: 1, sides: 6, bonus: 1 },
    quickness: 3,
    verb: 'hacks its cleaver at',
    xp: 35,
    packs: true,
    goblin: true,
  },
  goblinspear: {
    name: 'Goblin Spearman',
    maxHp: 16,
    ac: 12,
    toHit: 4,
    damage: { count: 1, sides: 8, bonus: 0 },
    quickness: 2,
    verb: 'jabs its spear at',
    xp: 40,
    packs: true,
    goblin: true,
    traits: [{ kind: 'trip', dc: 8 }],
  },
  goblintorch: {
    name: 'Goblin Firebrand',
    maxHp: 12,
    ac: 11,
    toHit: 3,
    damage: { count: 1, sides: 4, bonus: 2 },
    quickness: 4,
    verb: 'swings its torch at',
    xp: 30,
    packs: true,
    goblin: true,
    traits: [{ kind: 'rend', damage: 1, turns: 2 }],
  },
  // He has it in for the hero, from the Hollow on. Beyond his howl he has three tricks of his own (see FoeTrait):
  // a crushing blow he winds up a turn ahead (knock him down, or raise your guard), a stamp that shakes the
  // whole party off their feet, and a rage once he's brought to half health. Tuned with `npm run sim -- --brute`:
  // at level 11 in the best kit, with Sigrun and Wat beside you, you win but lose about a third of your health
  // (about half with Sigrun alone); alone, you win about 7 times in 10. (In the raid he's weaker: RAID_BRUTE.)
  goblinbrute: {
    name: 'Goblin Brute',
    maxHp: 140,
    ac: 16,
    toHit: 11,
    damage: { count: 2, sides: 10, bonus: 7 },
    quickness: 1,
    verb: 'brings its club down on',
    xp: 320,
    packs: true,
    goblin: true,
    stubborn: true,
    traits: [
      { kind: 'grudge' },
      { kind: 'smash', cooldown: 3, dc: 14 },
      { kind: 'quake', cooldown: 3, dc: 13, damage: { count: 2, sides: 8, bonus: 3 } },
      { kind: 'enrage', below: 0.5 },
      { kind: 'howl', cooldown: 3 },
      { kind: 'steady' },
    ],
  },
  // The brigands holding out in the old beacon tower on Corbie Tor (see world/BeaconMap.ts), late in the story: old
  // soldiers, and the hardest men met yet. They fight as one band (outlaws, so only beside their own). Tuned with
  // `npm run sim -- --beacon`: at level 11 in the best kit the hero alone wins about half the time (a little more at 12), and with
  // Sigrun and Wat nearly always, losing about a third of their health.
  brigandcaptain: {
    name: 'Corwin Haske',
    maxHp: 70,
    ac: 16,
    toHit: 8,
    damage: { count: 2, sides: 6, bonus: 4 },
    quickness: 3,
    verb: 'cuts his falchion at',
    xp: 160,
    packs: true,
    outlaw: true,
    stubborn: true,
    traits: [{ kind: 'howl', cooldown: 3 }, { kind: 'grudge' }, { kind: 'steady' }],
  },
  brigandbrute: {
    name: 'Big Garth',
    maxHp: 62,
    ac: 13,
    toHit: 7,
    damage: { count: 2, sides: 8, bonus: 3 },
    quickness: 1,
    verb: 'swings his maul at',
    xp: 130,
    packs: true,
    outlaw: true,
    stubborn: true,
    traits: [{ kind: 'smash', cooldown: 3, dc: 13 }, { kind: 'steady' }],
  },
  brigandcutter: {
    name: 'Teg',
    maxHp: 40,
    ac: 15,
    toHit: 7,
    damage: { count: 2, sides: 4, bonus: 3 },
    quickness: 5,
    verb: 'hacks both hatchets at',
    xp: 90,
    packs: true,
    outlaw: true,
    traits: [{ kind: 'rend', damage: 2, turns: 2 }],
  },
  brigandarcher: {
    name: 'Linnet',
    maxHp: 32,
    ac: 14,
    toHit: 8,
    damage: { count: 1, sides: 8, bonus: 3 },
    quickness: 5,
    verb: 'looses an arrow at',
    xp: 80,
    packs: true,
    outlaw: true,
    skittish: 0.05,
  },
} satisfies Record<string, Omit<CombatantDef, 'id' | 'side' | 'hp'> & { xp: number; packs: boolean; outlaw?: boolean; goblin?: boolean }>;

/**
 * The Brute as he is in the raid on the Hollow (see world/GoblinRaid.ts), a
 * fight the hero can't win and that turns on its third round: he leaves the
 * work to his band and keeps his tricks for the brood hall, so the hero isn't
 * knocked flat before the story has them overwhelmed.
 */
export const RAID_BRUTE: Partial<CombatantDef> = {
  maxHp: 72,
  toHit: 6,
  damage: { count: 2, sides: 6, bonus: 3 },
  traits: [{ kind: 'grudge' }, { kind: 'howl', cooldown: 3 }, { kind: 'steady' }],
};

/** Footpads and their like: men, not beasts (they swing rather than bite, and only fight beside their own). */
export function isOutlaw(kind: FoeKind): boolean {
  return 'outlaw' in FOES[kind];
}

export type FoeKind = keyof typeof FOES;

/** Goblins: they swing weapons rather than bite, and only fight beside their own. */
export function isGoblin(kind: FoeKind): boolean {
  return 'goblin' in FOES[kind];
}

/** Who fights beside whom: beasts with beasts, footpads with footpads, goblins with goblins. */
export function faction(kind: FoeKind): 'beast' | 'outlaw' | 'goblin' {
  return isGoblin(kind) ? 'goblin' : isOutlaw(kind) ? 'outlaw' : 'beast';
}

/** Fights with a weapon in its hands (so it swings and grunts, rather than bites and yelps). */
export function isArmed(kind: FoeKind): boolean {
  return isOutlaw(kind) || isGoblin(kind);
}
