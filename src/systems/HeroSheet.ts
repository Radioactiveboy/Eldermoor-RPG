import { Experience } from './Experience';
import { Inventory, weaponOf } from './Inventory';

/** The hero's fighting numbers, as the combat rules use them and the equipment screen shows them. */
export interface HeroSheet {
  /** What a foe has to roll to hit: 10 plus the defence of everything worn. */
  ac: number;
  /** Added to the hero's attack rolls: 3, plus gear, plus a point every other level. */
  toHit: number;
  /** The weapon's die (bare fists without one). */
  die: number;
  /** Added to each hit's damage: gear, plus a point every third level. */
  damageBonus: number;
}

export function heroSheet(): HeroSheet {
  const gear = Inventory.totals;
  return {
    ac: 10 + gear.defence,
    toHit: 3 + gear.attack + Experience.toHitBonus,
    die: weaponOf(Inventory.equipped.mainHand).die,
    damageBonus: gear.attack + Experience.damageBonus,
  };
}
