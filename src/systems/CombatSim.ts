import { HEALTH, STAMINA } from '../config';
import { BRACE_STAMINA, HEAVY_TO_HIT, SECOND_WIND, SWEEP_TO_HIT, ability } from './Abilities';
import { Battle, Combatant, CombatantDef, chooseFoeAction, FoeKind, FOES, Outcome, Rng, shouldHowl } from './Combat';
import { BASH_COOLDOWN, chooseCompanionAction, COMPANIONS, CompanionId, combatDefOf, fighterId, maxHpOf } from './Companions';
import { HEALTH_PER_LEVEL } from './Experience';
import { ItemId, itemDef, weaponOf } from './Inventory';

/**
 * Fights played out with no screen, to tune the numbers in FOES. The hero
 * follows a few plain rules of thumb (see heroTurn) with a typical kit for
 * their level; the beasts fight exactly as they do in the game (chooseFoeAction,
 * howls). Run `npm run sim` for the full table (tools/balance.ts).
 *
 * The hero's numbers are worked out the same way CombatScene.heroStats does:
 * 10 + defence armour, 3 + attack + level bonus to hit, the weapon's die plus
 * attack + level bonus damage, and 100 health plus 10 a level.
 */

/** A small seeded random number generator (mulberry32), so a run can be repeated exactly. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What the hero wears and carries into the fight. */
export interface Kit {
  /** Every item worn (the main-hand weapon among them, or none for fists). */
  worn: ItemId[];
  /** Pieces of food in the satchel, each eaten for this much health. */
  food?: { count: number; health: number };
}

/**
 * What a hero of each level might be wearing: the cottage's own things at
 * first, then what the smith and the tailor sell as the coin comes in.
 */
export const KIT_BY_LEVEL: Record<number, Kit> = {
  1: { worn: ['walking-staff', 'straw-hat', 'tunic', 'boots'], food: { count: 2, health: 10 } },
  2: { worn: ['hunting-knife', 'straw-hat', 'tunic', 'boots'], food: { count: 2, health: 10 } },
  3: { worn: ['hunting-knife', 'buckler', 'straw-hat', 'tunic', 'boots'], food: { count: 2, health: 20 } },
  4: { worn: ['spear', 'buckler', 'wool-hood', 'tunic', 'boots'], food: { count: 2, health: 20 } },
  5: { worn: ['spear', 'buckler', 'iron-cap', 'jerkin', 'boots'], food: { count: 3, health: 20 } },
  6: { worn: ['short-sword', 'buckler', 'iron-cap', 'jerkin', 'riding-boots'], food: { count: 3, health: 20 } },
};

/** The best the smith and tailor have, and the silver ring: what a hero might wear down into the warren (about level 11). */
export const LATE_KIT: Kit = { worn: ['short-sword', 'buckler', 'iron-cap', 'jerkin', 'riding-boots', 'silver-ring'], food: { count: 3, health: 20 } };

/** The hero's fighting numbers at a level, in a kit: the same sums as CombatScene.heroStats. */
export function heroDef(level: number, kit: Kit): CombatantDef {
  let defence = 0;
  let attack = 0;
  for (const id of kit.worn) {
    defence += itemDef(id).defence ?? 0;
    attack += itemDef(id).attack ?? 0;
  }
  const main = kit.worn.find((id) => itemDef(id).slot === 'mainHand');
  const weapon = weaponOf(main);
  const maxHp = HEALTH.max + (level - 1) * HEALTH_PER_LEVEL;
  return {
    id: 'hero',
    name: 'Arthus',
    side: 'party',
    hp: maxHp,
    maxHp,
    ac: 10 + defence,
    toHit: 3 + attack + Math.floor((level - 1) / 2),
    damage: { count: 1, sides: weapon.die, bonus: attack + Math.floor((level - 1) / 3) },
    quickness: 2,
    verb: weapon.verb!,
    weapon: weapon.effect,
  };
}

/** Foes for one fight: `count` of a kind, and optionally some others beside them (the Wolf Mother's wolves). */
export function foeDefs(kind: FoeKind, count = 1, escort: Partial<Record<FoeKind, number>> = {}): CombatantDef[] {
  const defs: CombatantDef[] = [];
  const add = (k: FoeKind, n: number) => {
    for (let i = 0; i < n; i++) defs.push({ ...FOES[k], id: `${k}-${defs.length}`, side: 'foes', hp: FOES[k].maxHp });
  };
  add(kind, count);
  for (const [k, n] of Object.entries(escort)) add(k as FoeKind, n ?? 0);
  return defs;
}

export interface FightResult {
  outcome: Outcome;
  /** Rounds the fight lasted. */
  rounds: number;
  /** Health the hero had left, and lost. */
  heroHp: number;
  taken: number;
  dealt: number;
  /** Beasts slain, and beasts that ran. */
  slain: number;
  fled: number;
}

/** Rounds after which a fight is called off (it never gets near this). */
const MAX_ROUNDS = 100;

/**
 * One fight, start to finish. The hero's rules of thumb, in order:
 *  - Bonus action: Second Wind once below half health; else Mark Prey (from
 *    level 3) on the foe being fought; else Shove it over if it isn't
 *    sure-footed, so the blow that follows has advantage.
 *  - Action: eat when below a third of health and there's food; Sweeping
 *    Blow when three or more foes are up; Staggering Blow when it's ready;
 *    a Heavy Blow while stamina lasts; otherwise a plain Strike.
 *  - Always at the weakest foe still standing. Never runs.
 */
export function simulateFight(
  hero: CombatantDef,
  foes: CombatantDef[],
  rng: Rng,
  kit: Kit = { worn: [] },
  level = 1,
  allies: CompanionId[] = [],
): FightResult {
  const battle = new Battle([hero, ...allies.map((id) => combatDefOf(id, level, maxHpOf(id, level))), ...foes], rng);
  const h = battle.combatants[0];
  let stamina = STAMINA.max;
  let food = kit.food?.count ?? 0;
  let dealt = 0;
  const startHp = h.hp;
  const armed = kit.worn.some((id) => itemDef(id).slot === 'mainHand');
  const swing = (target: Combatant, opts: Parameters<Battle['attack']>[2] = {}) => {
    const r = battle.attack(h, target, opts);
    dealt += r.damage;
    return r;
  };
  const weakest = () => battle.standing('foes').reduce((a, b) => (b.hp < a.hp ? b : a));
  const can = (id: Parameters<typeof ability>[0]) => {
    const a = ability(id);
    if (a.level && level < a.level) return false;
    return battle.ready(h, id) && stamina >= (a.stamina ?? 0);
  };
  const spend = (id: Parameters<typeof ability>[0]) => {
    const a = ability(id);
    stamina -= a.stamina ?? 0;
    if (a.cooldown) battle.cooldown(h, id, a.cooldown);
  };

  const allyOf = (c: Combatant) => allies.find((id) => fighterId(id) === c.id);
  if (h.weapon?.kind === 'opening') swing(weakest());
  battle.rollInitiative();
  while (battle.outcome() === 'ongoing' && battle.round <= MAX_ROUNDS) {
    const c = battle.current;
    const start = battle.beginTurn();
    if (battle.isUp(c)) {
      if (c === h) {
        // Bonus action.
        if (!start.stood) {
          const target = weakest();
          if (h.hp < h.maxHp / 2 && can('secondwind')) {
            spend('secondwind');
            battle.heal(h, battle.rollDice({ ...SECOND_WIND, bonus: level }));
          } else if (can('mark') && !battle.marks(h, target) && target.hp > 8) {
            spend('mark');
            battle.addStatus(target, 'marked', 3, { by: h.id });
          } else if (can('shove') && !battle.trait(target, 'steady') && !battle.has(target, 'prone')) {
            spend('shove');
            battle.shove(h, target);
          }
        }
        // Action.
        if (battle.outcome() === 'ongoing') {
          const target = weakest();
          const many = battle.standing('foes').length >= 3;
          const aimedAtMe = battle.standing('foes').some((f) => battle.status(f, 'windup')?.target === h.id);
          if (h.hp < h.maxHp / 3 && food > 0) {
            food--;
            battle.heal(h, kit.food!.health);
          } else if (aimedAtMe && h.hp < h.maxHp / 2) {
            // A crushing blow is coming: raise your guard against it.
            battle.defend(h);
          } else if (many && armed && can('sweep')) {
            spend('sweep');
            for (const f of battle.standing('foes')) if (battle.outcome() === 'ongoing') swing(f, { toHit: SWEEP_TO_HIT, half: true });
          } else if (can('stagger')) {
            spend('stagger');
            const r = swing(target);
            if (r.hit && !r.killed) battle.addStatus(target, 'dazed', 1);
          } else if (can('heavy') && target.hp > h.damage.bonus + h.damage.sides / 2) {
            spend('heavy');
            swing(target, { toHit: HEAVY_TO_HIT, times: 2 });
          } else if (stamina < 15 && battle.standing('foes').length === 1 && target.hp > 10 && h.hp > h.maxHp / 2) {
            // Winded against one foe: catch your breath behind a raised guard.
            battle.defend(h);
            stamina = Math.min(STAMINA.max, stamina + BRACE_STAMINA);
          } else {
            swing(target);
          }
        }
      } else if (allyOf(c)) {
        // Companions fight as they do in CombatScene.companionTurn.
        const action = chooseCompanionAction(battle, c, COMPANIONS[allyOf(c)!].combat.tactic, { stood: start.stood, heroId: h.id });
        if (action.type === 'attack') {
          dealt += battle.attack(c, action.target).damage;
        } else if (action.type === 'bash') {
          battle.cooldown(c, 'bash', BASH_COOLDOWN);
          battle.shove(c, action.target);
        } else if (action.type === 'guard') {
          battle.defend(c);
        }
      } else {
        // The beasts fight as they do in CombatScene.foeTurn.
        if (battle.shouldEnrage(c)) battle.enrage(c);
        const action = chooseFoeAction(battle, c, start.stood, rng);
        if (action.type === 'attack' || action.type === 'windup') {
          if (shouldHowl(battle, c)) {
            battle.cooldown(c, 'howl', battle.trait(c, 'howl')!.cooldown);
            for (const f of battle.standing('foes')) if (f !== c) battle.addStatus(f, 'rallied', 2);
          }
          if (action.type === 'attack') battle.attack(c, action.target);
          else battle.windUp(c, action.target);
        } else if (action.type === 'smash') {
          battle.smash(c, action.target);
        } else if (action.type === 'quake') {
          battle.quake(c);
        } else if (action.type === 'flee') {
          c.fled = true;
        }
      }
    }
    battle.endTurn();
  }
  return {
    outcome: battle.outcome(),
    rounds: battle.round,
    heroHp: h.hp,
    taken: Math.max(0, startHp - h.hp),
    dealt,
    slain: battle.combatants.filter((c) => c.side === 'foes' && c.hp <= 0).length,
    fled: battle.combatants.filter((c) => c.side === 'foes' && c.fled).length,
  };
}

export interface SimSummary {
  fights: number;
  /** Share of fights the hero came out of on their feet (beasts slain or driven off). */
  winRate: number;
  /** Average rounds, over the fights won. */
  rounds: number;
  /** Average share of the hero's health lost, over the fights won. */
  hurt: number;
}

/** Many fights of one match-up, summed up. */
export function simulate(
  level: number,
  kind: FoeKind,
  count = 1,
  opts: { fights?: number; seed?: number; kit?: Kit; escort?: Partial<Record<FoeKind, number>>; allies?: CompanionId[] } = {},
): SimSummary {
  const fights = opts.fights ?? 1000;
  const kit = opts.kit ?? KIT_BY_LEVEL[level];
  const rng = seeded(opts.seed ?? 1);
  let wins = 0;
  let rounds = 0;
  let hurt = 0;
  for (let i = 0; i < fights; i++) {
    const hero = heroDef(level, kit);
    const r = simulateFight(hero, foeDefs(kind, count, opts.escort), rng, kit, level, opts.allies);
    if (r.outcome === 'victory') {
      wins++;
      rounds += r.rounds;
      hurt += r.taken / hero.maxHp;
    }
  }
  return { fights, winRate: wins / fights, rounds: wins ? rounds / wins : 0, hurt: wins ? hurt / wins : 0 };
}
