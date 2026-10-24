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
  /** Added to the d20 for initiative and for running away. */
  quickness: number;
  /** How the attack reads in the log, up to the target ("lunges at", "swing your staff at"). */
  verb: string;
}

export interface Combatant extends CombatantDef {
  initiative: number;
  /** Defending: harder to hit until their next turn starts. */
  defending: boolean;
  /** Left the fight by running away. */
  fled: boolean;
}

export const DEFEND_AC_BONUS = 4;
/** Heavy blows trade accuracy for damage: the damage dice are rolled twice. */
export const HEAVY_TO_HIT = -2;
export const HEAVY_STAMINA = 30;
export const DEFEND_STAMINA = 20;
/** Running away: beat this (plus 2 for each extra foe still standing) with d20 + quickness. */
export const FLEE_DC = 10;

export interface AttackResult {
  attacker: Combatant;
  target: Combatant;
  roll: number;
  total: number;
  ac: number;
  hit: boolean;
  crit: boolean;
  damage: number;
  killed: boolean;
  heavy: boolean;
}

export interface FleeResult {
  roll: number;
  total: number;
  dc: number;
  success: boolean;
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
    this.combatants = defs.map((d) => ({ ...d, initiative: 0, defending: false, fled: false }));
  }

  d(sides: number): number {
    return 1 + Math.floor(this.rng() * sides);
  }

  rollDice(dice: Dice, times = 1): number {
    let total = dice.bonus;
    for (let i = 0; i < dice.count * times; i++) total += this.d(dice.sides);
    return Math.max(1, total);
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
    this.startTurn();
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

  /** Moves on to the next one still in the fight. A new round starts after the last. */
  endTurn(): void {
    if (this.outcome() !== 'ongoing') return;
    do {
      this.turn++;
      if (this.turn >= this.order.length) {
        this.turn = 0;
        this.round++;
      }
    } while (!this.isUp(this.current));
    this.startTurn();
  }

  private startTurn(): void {
    // A raised guard lasts until your own next turn.
    if (this.current) this.current.defending = false;
  }

  armourOf(c: Combatant): number {
    return c.ac + (c.defending ? DEFEND_AC_BONUS : 0);
  }

  /** Bonus for fighting alongside others of your side, like wolves in a pack. */
  packBonus(attacker: Combatant): number {
    return attacker.side === 'foes' && this.standing('foes').length > 1 ? 2 : 0;
  }

  attack(attacker: Combatant, target: Combatant, heavy = false): AttackResult {
    const roll = this.d(20);
    const total = roll + attacker.toHit + this.packBonus(attacker) + (heavy ? HEAVY_TO_HIT : 0);
    const ac = this.armourOf(target);
    const crit = roll === 20;
    const hit = roll !== 1 && (crit || total >= ac);
    let damage = 0;
    if (hit) {
      damage = this.rollDice(attacker.damage, (crit ? 2 : 1) * (heavy ? 2 : 1));
      target.hp = Math.max(0, target.hp - damage);
    }
    return { attacker, target, roll, total, ac, hit, crit, damage, killed: hit && target.hp === 0, heavy };
  }

  defend(c: Combatant): void {
    c.defending = true;
  }

  heal(c: Combatant, amount: number): void {
    c.hp = Math.min(c.maxHp, c.hp + amount);
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

export type FoeAction = { type: 'attack'; target: Combatant } | { type: 'flee' } | { type: 'wait' };

/**
 * How a beast fights: it goes for whoever is weakest, and when badly hurt it
 * may lose its nerve and bolt (more likely if it's the last of its pack).
 */
export function chooseFoeAction(battle: Battle, foe: Combatant, rng: Rng = Math.random): FoeAction {
  const targets = battle.standing('party');
  if (targets.length === 0) return { type: 'wait' };
  const hurt = foe.hp / foe.maxHp;
  const alone = battle.standing('foes').length === 1;
  if (hurt <= 0.3 && rng() < (alone ? 0.45 : 0.2)) return { type: 'flee' };
  const target = targets.reduce((a, b) => (b.hp < a.hp ? b : a));
  return { type: 'attack', target };
}

/** The beasts that can be met in the wild. */
export const FOES = {
  wolf: {
    name: 'Grey Wolf',
    maxHp: 22,
    ac: 12,
    toHit: 4,
    damage: { count: 2, sides: 4, bonus: 2 },
    quickness: 2,
    verb: 'lunges at',
  },
} satisfies Record<string, Omit<CombatantDef, 'id' | 'side' | 'hp'>>;

export type FoeKind = keyof typeof FOES;
