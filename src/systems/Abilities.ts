import { Battle, Combatant, DEFEND_AC_BONUS, Dice, diceText, MARK_DAMAGE, MARK_TO_HIT } from './Combat';

/**
 * The hero's fighting skills, as data. Each turn the hero has one Action and
 * one Bonus action to spend, in either order, plus stamina. Some skills cost
 * stamina, some need a few turns to recover (cooldown), and a few are only
 * learned at higher levels or need a weapon in hand.
 *
 * To add a skill: add its id to AbilityId, an entry to ABILITIES (the order
 * there is the order on the hotbar), an icon in ui/AbilityIcons.ts, and what
 * it does in CombatScene.useAbility.
 */
export type AbilityId =
  | 'strike'
  | 'heavy'
  | 'stagger'
  | 'sweep'
  | 'brace'
  | 'item'
  | 'flee'
  | 'shove'
  | 'mark'
  | 'secondwind'
  | 'ready';

export type ActionCost = 'action' | 'bonus';

/** Who a skill is aimed at: one foe (the hero picks), every foe, or no one. */
export type Targeting = 'foe' | 'all-foes' | 'self';

/** What a skill's numbers and availability are worked out from. */
export interface AbilityContext {
  battle: Battle;
  hero: Combatant;
  level: number;
  stamina: number;
  hasWeapon: boolean;
  /** Something in the satchel to eat, and a weapon in the satchel to take up. */
  hasFood: boolean;
  spareWeapon: boolean;
}

export interface AbilityDef {
  id: AbilityId;
  name: string;
  cost: ActionCost;
  target: Targeting;
  stamina?: number;
  /** Turns before it can be used again. Infinity: once a fight. */
  cooldown?: number;
  /** Learned at this level. */
  level?: number;
  needsWeapon?: boolean;
  /** One line of flavour. */
  blurb: string;
  /** The numbers, a line each. */
  details: (ctx: AbilityContext) => string[];
  /** A reason it can't be used right now, beyond cost, cooldown, level and weapon (no food, no target). */
  blocked?: (ctx: AbilityContext) => string | undefined;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const twice = (d: Dice): Dice => ({ count: d.count * 2, sides: d.sides, bonus: d.bonus });
const hitLine = (ctx: AbilityContext, mod = 0) => `To hit: d20 ${signed(ctx.hero.toHit + mod)}`;

export const HEAVY_TO_HIT = -2;
export const SWEEP_TO_HIT = -2;
export const BRACE_STAMINA = 20;
export const SECOND_WIND: Dice = { count: 1, sides: 8, bonus: 0 };

export const ABILITIES: AbilityDef[] = [
  // ------------------------------------------------ actions
  {
    id: 'strike',
    name: 'Strike',
    cost: 'action',
    target: 'foe',
    blurb: 'A plain, honest blow.',
    details: (ctx) => [hitLine(ctx), `Damage: ${diceText(ctx.hero.damage)}`],
  },
  {
    id: 'heavy',
    name: 'Heavy Blow',
    cost: 'action',
    target: 'foe',
    stamina: 30,
    blurb: 'Put your whole weight behind it. Harder to land, but it hurts.',
    details: (ctx) => [hitLine(ctx, HEAVY_TO_HIT), `Damage: ${diceText(twice(ctx.hero.damage))}`],
  },
  {
    id: 'stagger',
    name: 'Staggering Blow',
    cost: 'action',
    target: 'foe',
    stamina: 15,
    cooldown: 2,
    blurb: 'A blow to the head. If it lands, the foe is Dazed: its attacks roll with disadvantage on its next turn.',
    details: (ctx) => [hitLine(ctx), `Damage: ${diceText(ctx.hero.damage)}`, 'On a hit: Dazed for 1 turn'],
  },
  {
    id: 'sweep',
    name: 'Sweeping Blow',
    cost: 'action',
    target: 'all-foes',
    stamina: 20,
    cooldown: 3,
    level: 2,
    needsWeapon: true,
    blurb: 'Swing wide and catch every foe around you. Each one is rolled for separately.',
    details: (ctx) => [hitLine(ctx, SWEEP_TO_HIT) + ' against each', `Damage: half of ${diceText(ctx.hero.damage)}`],
  },
  {
    id: 'brace',
    name: 'Brace',
    cost: 'action',
    target: 'self',
    blurb: 'Raise your guard and steady your breathing.',
    details: () => [`+${DEFEND_AC_BONUS} armour until your next turn`, `Recover ${BRACE_STAMINA} stamina`],
  },
  {
    id: 'item',
    name: 'Eat',
    cost: 'action',
    target: 'self',
    blurb: 'Wolf down something from your satchel.',
    details: () => ['Restores health and stamina, as the food says'],
    blocked: (ctx) => (ctx.hasFood ? undefined : 'Nothing to eat in your satchel.'),
  },
  {
    id: 'flee',
    name: 'Flee',
    cost: 'action',
    target: 'self',
    blurb: 'Run for it. If you fail, your turn is wasted.',
    details: (ctx) => [`Roll d20 ${signed(ctx.hero.quickness)} against ${ctx.battle.fleeDc(ctx.hero)}`, '+2 for each extra foe still standing'],
  },
  // ------------------------------------------------ bonus actions
  {
    id: 'shove',
    name: 'Shove',
    cost: 'bonus',
    target: 'foe',
    stamina: 10,
    cooldown: 2,
    blurb: 'Knock a foe off its feet. While it is Prone your attacks roll with advantage, and it spends its next turn getting up.',
    details: (ctx) => [`Your d20 ${signed(ctx.hero.toHit)} against its d20 + quickness`, 'Big, sure-footed beasts resist with advantage'],
  },
  {
    id: 'mark',
    name: 'Mark Prey',
    cost: 'bonus',
    target: 'foe',
    stamina: 10,
    cooldown: 4,
    level: 3,
    blurb: 'Fix your eyes on one foe and learn how it moves.',
    details: () => [`For 3 of its turns: +${MARK_TO_HIT} to hit it`, `and +${diceText(MARK_DAMAGE)} damage against it`],
  },
  {
    id: 'secondwind',
    name: 'Second Wind',
    cost: 'bonus',
    target: 'self',
    cooldown: Infinity,
    blurb: 'Grit your teeth and find a little more in you.',
    details: (ctx) => [`Heal ${diceText({ ...SECOND_WIND, bonus: ctx.level })}`, 'Once a fight'],
    blocked: (ctx) => (ctx.hero.hp >= ctx.hero.maxHp ? 'You are unhurt.' : undefined),
  },
  {
    id: 'ready',
    name: 'Ready Weapon',
    cost: 'bonus',
    target: 'self',
    blurb: 'Take up a weapon from your satchel.',
    details: () => ['Fists roll d4 damage; a weapon d6 plus its Attack'],
    blocked: (ctx) => (ctx.spareWeapon ? undefined : 'No weapon in your satchel.'),
  },
];

export function ability(id: AbilityId): AbilityDef {
  return ABILITIES.find((a) => a.id === id)!;
}

/** Spent or not, this turn. */
export interface TurnBudget {
  action: boolean;
  bonus: boolean;
}

/** Why a skill can't be used right now, or undefined if it can. */
export function whyNot(a: AbilityDef, ctx: AbilityContext, budget: TurnBudget): string | undefined {
  if (a.level && ctx.level < a.level) return `Learned at level ${a.level}.`;
  if (a.needsWeapon && !ctx.hasWeapon) return 'Needs a weapon in hand.';
  const cd = ctx.hero.cooldowns[a.id];
  if (cd === Infinity) return 'Already used this fight.';
  if (cd) return `Ready again in ${cd} turn${cd === 1 ? '' : 's'}.`;
  if (a.cost === 'action' && !budget.action) return 'You have used your action this turn.';
  if (a.cost === 'bonus' && !budget.bonus) return 'You have used your bonus action this turn.';
  if (a.stamina && ctx.stamina < a.stamina) return `Needs ${a.stamina} stamina.`;
  return a.blocked?.(ctx);
}
