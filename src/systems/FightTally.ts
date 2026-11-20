import type { AttackResult } from './Combat';

/**
 * The sums kept through one fight, for the card shown at the end of it
 * (CombatScene.showSummary): damage dealt and taken, rounds and turns, the
 * experience earned, and whatever was taken from the fallen afterwards.
 */
export class FightTally {
  /** Damage the hero did, and took (bleeding included). */
  dealt = 0;
  taken = 0;
  /** The hero's swings that landed and missed, and how many were critical. */
  hits = 0;
  misses = 0;
  crits = 0;
  /** Turns the hero took. */
  turns = 0;
  xp = 0;
  /** Levels reached during the fight. */
  levels: number[] = [];
  /** Items taken from the fallen, in the order they were picked up, and coins. */
  readonly loot = new Map<string, number>();
  coins = 0;

  /** Count an attack, from either side. `heroId` says which fighter is the hero. */
  attack(r: Pick<AttackResult, 'hit' | 'crit' | 'damage'> & { attacker: { id: string }; target: { id: string } }, heroId = 'hero'): void {
    if (r.attacker.id === heroId) {
      if (r.hit) this.hits++;
      else this.misses++;
      if (r.crit && r.hit) this.crits++;
      this.dealt += r.damage;
    } else if (r.target.id === heroId) {
      this.taken += r.damage;
    }
  }

  /** Bleeding (or any other damage outside an attack). */
  hurt(who: { id: string }, amount: number, heroId = 'hero'): void {
    if (who.id === heroId) this.taken += amount;
    else this.dealt += amount;
  }

  gained(xp: number): void {
    this.xp += Math.max(0, Math.round(xp));
  }

  levelled(level: number): void {
    this.levels.push(level);
  }

  took(item: string, count: number): void {
    this.loot.set(item, (this.loot.get(item) ?? 0) + count);
  }

  /** The share of the hero's swings that landed, 0-1 (0 if they never swung). */
  get accuracy(): number {
    const swings = this.hits + this.misses;
    return swings === 0 ? 0 : this.hits / swings;
  }
}

/** "Wolf Pelt x3" style: an item's name with its count, for the end-of-fight card. */
export function lootLine(name: string, count: number): string {
  return count > 1 ? `${name} x${count}` : name;
}
