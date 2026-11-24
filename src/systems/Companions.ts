import { Battle, Combatant, CombatantDef, Dice, WeaponEffect } from './Combat';
import { bondCombatBonus, Relationships } from './Relationships';
import { SaveGame } from './SaveGame';
import type { AreaId } from '../world/MapData';

/**
 * Companions: people the hero can take along. Each one is met somewhere in
 * the world (Sigrun at the Crooked Tankard, Wat in Adowvale's square), agrees
 * to come (for coin, or for nothing), and then follows the hero from area to
 * area and fights beside them, taking their own turns (see
 * scenes/CombatScene.ts and {@link chooseCompanionAction}).
 *
 * The hero picks who comes: up to {@link MAX_PARTY} at once. Anyone sent
 * away goes back to where they were met (their `home`), and can be asked
 * along again there. Who has agreed to come, who is with the hero now, and
 * how hurt each one is are all kept in the save.
 *
 * To add someone: give them an NPC (entities/Npc.ts) where they wait, add
 * them to {@link COMPANIONS}, and offer the `companion:hire:<id>` (or
 * `companion:join:<id>`) action from their conversation (see
 * scenes/game/companions.ts, which adds the asking to their talk for you).
 * Someone who shouldn't fight (a guide) sets `fights: false`.
 */

export type CompanionId = 'sigrun' | 'wat';

/** How a companion chooses what to do on their turn (see chooseCompanionAction). */
export type Tactic =
  /** A seasoned fighter: shield-bashes the biggest foe off its feet now and then, and finishes off whatever is nearly dead. */
  | 'veteran'
  /** Fights shoulder to shoulder: goes for whatever the hero is fighting, and raises his guard when badly hurt. */
  | 'shieldmate';

export interface CompanionDef {
  id: CompanionId;
  /** Their full name, as the menus give it ("Sigrun the Sellsword"). */
  name: string;
  /** What they're called in the fight log and on the turn-order cards ("Sigrun"). */
  short: string;
  /** "she"/"her" or "he"/"his", for the fight log. */
  pronoun: { they: string; their: string; them: string };
  /** Their dialogue speaker (see dialogue/Dialogue.ts). */
  speaker: string;
  /** The NPC who stands for them where they wait (hidden while they travel with the hero). */
  npc: string;
  /** Their walking figure (a 3D folk sheet, see art/folk.ts). */
  texture: string;
  /** Where they go back to when sent away, and what it's called. */
  home: { area: AreaId; place: string };
  /** False for someone who comes along but keeps out of fights. */
  fights: boolean;
  /** One line on them, for the party screen. */
  blurb: string;
  /** What they ask to come, if anything; `freeFlag` set (the Headman paying) means they come for nothing. */
  hire?: { coins: number; freeFlag?: string };
  /** The story flag that must be set before they'll come at all. */
  needs?: string;
  /** Not to be found where they wait at all until then (Wat only keeps the east watch once the goblins have been). */
  hiddenUntilNeeded?: boolean;
  combat: {
    hp: number;
    /** More health for each of the hero's levels above 1 (they get better as the hero does). */
    hpPerLevel: number;
    ac: number;
    toHit: number;
    damage: Dice;
    quickness: number;
    verb: string;
    weapon?: WeaponEffect;
    tactic: Tactic;
  };
  /** Things they say: on joining, on being sent away, after a fight is won, and on coming round after being knocked down. */
  barks: { join: string; leave: string; won: string[]; revived: string };
}

/** At most this many companions travel with the hero at once. */
export const MAX_PARTY = 2;
/** Health a companion gets back each in-game hour out of a fight. */
export const REGEN_PER_HOUR = 4;
/** A companion knocked down in a fight that was won gets up with this share of their health. */
export const REVIVE_SHARE = 0.25;
/** Turns between Sigrun's shield bashes. */
export const BASH_COOLDOWN = 3;
/** A shieldmate raises his guard once he's down to this share of his health. */
export const GUARD_BELOW = 0.3;

export const COMPANIONS: Record<CompanionId, CompanionDef> = {
  // A sellsword who came for the Wolf Mother's bounty and stayed for the ale (see dialogue/tavern.ts).
  sigrun: {
    id: 'sigrun',
    name: 'Sigrun the Sellsword',
    short: 'Sigrun',
    pronoun: { they: 'she', their: 'her', them: 'her' },
    speaker: 'sigrun',
    npc: 'sigrun',
    texture: 'folk-sigrun',
    home: { area: 'tavern', place: 'the Crooked Tankard' },
    fights: true,
    blurb: 'A sellsword with a long memory. Hits hard, and knocks the big ones off their feet.',
    hire: { coins: 40, freeFlag: 'headman-pays-sigrun' },
    needs: 'raid-over',
    combat: {
      hp: 38,
      hpPerLevel: 5,
      ac: 15,
      toHit: 5,
      damage: { count: 1, sides: 10, bonus: 3 },
      quickness: 2,
      verb: 'brings her sword round at',
      tactic: 'veteran',
    },
    barks: {
      join: 'Lead on. Not too fast.',
      leave: "I'll be at the Tankard. Don't get killed before you pay me again.",
      won: ['Hm. Next.', 'That was the easy part.', 'There will be more where they came from.', 'Wipe your blade. It rusts.'],
      revived: "I'm up. Stop fussing.",
    },
  },
  // A young militiaman who saw the smoke from the square and wants to do something about it.
  wat: {
    id: 'wat',
    name: 'Wat of the Militia',
    short: 'Wat',
    pronoun: { they: 'he', their: 'his', them: 'him' },
    speaker: 'wat',
    npc: 'wat',
    texture: 'folk-wat',
    home: { area: 'market', place: "Adowvale's square" },
    fights: true,
    blurb: 'A militia lad, keen and green. His spear catches a charge, and he stands by you.',
    needs: 'raid-over',
    hiddenUntilNeeded: true,
    combat: {
      hp: 26,
      hpPerLevel: 4,
      ac: 13,
      toHit: 3,
      damage: { count: 1, sides: 8, bonus: 1 },
      quickness: 1,
      verb: 'jabs his spear at',
      weapon: { kind: 'set', toHit: 2 },
      tactic: 'shieldmate',
    },
    barks: {
      join: "Right behind you! Sergeant won't miss me. Probably.",
      leave: "I'll be in the square, then. Shout if you need me.",
      won: ['We did it! ...We did, didn\'t we?', 'My hands are shaking. Is that normal?', "Wait till I tell the lads.", 'Is it dead? Poke it.'],
      revived: "I'm all right! I'm all right. Ow.",
    },
  },
};

export const COMPANION_IDS = Object.keys(COMPANIONS) as CompanionId[];

export function isCompanion(id: string): id is CompanionId {
  return Object.hasOwn(COMPANIONS, id);
}

/** The fight id a companion goes by (beside 'hero' and the foes' own ids). */
export const fighterId = (id: CompanionId) => `companion-${id}`;

/** The companion a fighter is, if it's one of them. */
export function companionOf(fighter: { id: string }): CompanionId | undefined {
  const id = fighter.id.replace(/^companion-/, '');
  return fighter.id.startsWith('companion-') && isCompanion(id) ? id : undefined;
}

/** A companion's most health, at the hero's level. */
export function maxHpOf(id: CompanionId, heroLevel: number): number {
  const c = COMPANIONS[id].combat;
  return c.hp + c.hpPerLevel * Math.max(0, heroLevel - 1);
}

/** A companion's numbers for a fight, with the health they have now. */
export function combatDefOf(id: CompanionId, heroLevel: number, hp: number): CombatantDef {
  const def = COMPANIONS[id];
  const c = def.combat;
  const maxHp = maxHpOf(id, heroLevel);
  // A little better aim every third level of the hero's, as they learn to fight together,
  // and better still beside a friend (see systems/Relationships.ts).
  const bond = bondCombatBonus(Relationships.level(id));
  const toHit = c.toHit + Math.floor(Math.max(0, heroLevel - 1) / 3) + bond.toHit;
  return {
    id: fighterId(id),
    name: def.short,
    side: 'party',
    hp: Math.max(1, Math.min(maxHp, Math.round(hp))),
    maxHp,
    ac: c.ac + bond.ac,
    toHit,
    damage: c.damage,
    quickness: c.quickness,
    verb: c.verb,
    weapon: c.weapon,
  };
}

export type CompanionAction =
  | { type: 'attack'; target: Combatant }
  /** Knock the target off its feet (see Battle.shove), before the next turn's attacks. */
  | { type: 'bash'; target: Combatant }
  | { type: 'guard' }
  | { type: 'stand' }
  | { type: 'wait' };

/**
 * What a companion does on their turn. A companion knocked down spends it
 * getting up. Otherwise:
 * - a veteran (Sigrun) finishes off a foe she can likely kill with one blow;
 *   failing that, she shield-bashes a foe winding up a crushing blow, or
 *   every few turns the toughest foe still
 *   on its feet; failing that, she hits whatever is hurting the hero most.
 * - a shieldmate (Wat) raises his guard when badly hurt (and someone else is
 *   still fighting), and otherwise goes for whatever the hero is fighting:
 *   the foe the hero has marked, or the one most hurt.
 * `bashReady` is whether the shield bash is off cooldown (see Battle.ready).
 */
export function chooseCompanionAction(
  battle: Battle,
  me: Combatant,
  tactic: Tactic,
  opts: { stood: boolean; heroId?: string },
): CompanionAction {
  if (opts.stood) return { type: 'stand' };
  const foes = battle.standing('foes');
  if (foes.length === 0) return { type: 'wait' };
  const heroId = opts.heroId ?? 'hero';
  const mostHurt = foes.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
  const toughest = foes.reduce((a, b) => (b.hp > a.hp ? b : a));
  if (tactic === 'veteran') {
    const avgHit = me.damage.count * ((me.damage.sides + 1) / 2) + me.damage.bonus;
    const finish = foes.filter((f) => f.hp <= avgHit).sort((a, b) => b.hp - a.hp)[0];
    if (finish) return { type: 'attack', target: finish };
    // A blow being wound up is stopped by knocking the one swinging it flat.
    const winding = foes.find((f) => battle.has(f, 'windup'));
    if (winding && battle.ready(me, 'bash')) return { type: 'bash', target: winding };
    if (battle.ready(me, 'bash') && !battle.has(toughest, 'prone') && toughest.hp > avgHit * 2) return { type: 'bash', target: toughest };
    return { type: 'attack', target: toughest };
  }
  const others = battle.standing('party').filter((c) => c !== me);
  if (me.hp / me.maxHp <= GUARD_BELOW && others.length > 0 && !battle.has(me, 'guarded')) return { type: 'guard' };
  const marked = foes.find((f) => battle.status(f, 'marked')?.by === heroId);
  return { type: 'attack', target: marked ?? mostHurt };
}

type Listener = () => void;

/** Who has agreed to come, who is with the hero, and how each one is. */
class CompanionStore {
  /** Everyone who has agreed to come (and been paid, if they asked), whether with the hero now or not. */
  readonly recruited = new Set<CompanionId>();
  /** Those travelling with the hero now, in the order they joined (the first walks closest). */
  party: CompanionId[] = [];
  /** Health as it stands, by companion (missing: full). */
  private health = new Map<CompanionId, number>();
  /** The clock (TimeOfDay.elapsedHours) when health last came back. */
  private lastTick?: number;
  private listeners = new Set<Listener>();

  reset(): void {
    this.recruited.clear();
    this.party = [];
    this.health.clear();
    this.lastTick = undefined;
    this.emit();
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  isRecruited(id: CompanionId): boolean {
    return this.recruited.has(id);
  }

  isWith(id: CompanionId): boolean {
    return this.party.includes(id);
  }

  get full(): boolean {
    return this.party.length >= MAX_PARTY;
  }

  /** Those with the hero who fight. */
  get fighters(): CompanionId[] {
    return this.party.filter((id) => COMPANIONS[id].fights);
  }

  /**
   * They've agreed to come (any price is paid by the caller). They join the
   * hero straight away if there's room, which this returns.
   */
  recruit(id: CompanionId): boolean {
    this.recruited.add(id);
    return this.join(id);
  }

  /** Someone who has agreed to come joins the hero. False if they haven't agreed, or the party is full. */
  join(id: CompanionId): boolean {
    if (!this.recruited.has(id)) return false;
    if (this.isWith(id)) return true;
    if (this.full) return false;
    this.party.push(id);
    this.emit();
    return true;
  }

  /** Sent back to where they wait. They'll come again if asked there. */
  leave(id: CompanionId): void {
    if (!this.isWith(id)) return;
    this.party = this.party.filter((p) => p !== id);
    this.emit();
  }

  hp(id: CompanionId, heroLevel: number): number {
    return Math.min(maxHpOf(id, heroLevel), this.health.get(id) ?? maxHpOf(id, heroLevel));
  }

  setHp(id: CompanionId, hp: number, heroLevel: number): void {
    const max = maxHpOf(id, heroLevel);
    const v = Math.max(0, Math.min(max, Math.round(hp)));
    if (v >= max) this.health.delete(id);
    else this.health.set(id, v);
    this.emit();
  }

  /** Everyone gets health back as time passes (call it each frame out of a fight with TimeOfDay.elapsedHours). */
  tick(nowHours: number, heroLevel: number): void {
    const last = this.lastTick ?? nowHours;
    this.lastTick = nowHours;
    const hours = nowHours - last;
    if (hours <= 0 || this.health.size === 0) return;
    for (const [id, hp] of [...this.health]) {
      const next = hp + hours * REGEN_PER_HOUR;
      if (next >= maxHpOf(id, heroLevel)) this.health.delete(id);
      else this.health.set(id, next);
    }
    this.emit();
  }

  /** A night's sleep (or a long rest): everyone is whole again. */
  rested(): void {
    if (this.health.size === 0) return;
    this.health.clear();
    this.emit();
  }

  toSave(): { recruited: CompanionId[]; party: CompanionId[]; health: Partial<Record<CompanionId, number>> } {
    return { recruited: [...this.recruited], party: [...this.party], health: Object.fromEntries(this.health) };
  }

  fromSave(data: Partial<ReturnType<CompanionStore['toSave']>> | undefined): void {
    this.reset();
    for (const id of data?.recruited ?? []) if (isCompanion(id)) this.recruited.add(id);
    this.party = (data?.party ?? []).filter((id) => isCompanion(id) && this.recruited.has(id)).slice(0, MAX_PARTY);
    for (const [id, hp] of Object.entries(data?.health ?? {})) if (isCompanion(id) && typeof hp === 'number') this.health.set(id, hp);
    this.emit();
  }
}

export const Companions = new CompanionStore();

SaveGame.register('companions', {
  save: () => Companions.toSave(),
  load: (data) => Companions.fromSave(data as Parameters<typeof Companions.fromSave>[0]),
});
