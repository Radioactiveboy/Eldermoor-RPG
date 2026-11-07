import Phaser from 'phaser';
import { GameAudio } from '../audio/Audio';
import { CREATURE_ART, CREATURE_FRAME } from '../art/creatures';
import { HERO_NAME } from '../config';
import type { Creature } from '../entities/Creature';
import { Vec2 } from '../iso/IsoMath';
import {
  ABILITIES,
  AbilityContext,
  AbilityDef,
  AbilityId,
  BRACE_STAMINA,
  HEAVY_TO_HIT,
  SECOND_WIND,
  SWEEP_TO_HIT,
  TurnBudget,
  whyNot,
} from '../systems/Abilities';
import {
  AttackOptions,
  AttackResult,
  Battle,
  chooseFoeAction,
  Combatant,
  CombatantDef,
  diceText,
  FoeKind,
  FOES,
  isArmed,
  isGoblin,
  isOutlaw,
  Outcome,
  RALLY_TO_HIT,
  RollMode,
  shouldHowl,
  STATUSES,
  TurnStart,
} from '../systems/Combat';
import { Experience } from '../systems/Experience';
import { Inventory, itemDef, ItemId } from '../systems/Inventory';
import { abilityIconKey, ensureAbilityIcons } from '../ui/AbilityIcons';
import { PORTRAIT_SIZE } from '../art/portraits';
import { bodyStyle, THEME, titleStyle } from '../ui/Widgets';
import type { GameScene } from './GameScene';

export interface CombatSceneData {
  foes: Creature[];
  /**
   * A fight the hero can't win (the goblins' raid): from this round on, or
   * sooner if the hero gets the better of the leader, every blow of theirs
   * lands and every one of the hero's goes wide, until they're beaten.
   */
  doom?: {
    round: number;
    /** The foe whose being hurt brings it on early. */
    leader?: string;
    /** What the log says as it turns. */
    text: string;
    /** Why Flee can't be used. */
    trapped: string;
  };
}

/** How a fight ended, and which beasts are gone for good. */
export interface CombatResult {
  outcome: Outcome;
  slain: string[];
  fled: string[];
}

/** A combatant plus the sprite that stands for it in the world. */
interface Actor {
  c: Combatant;
  sprite: Phaser.GameObjects.Sprite;
  /** Screen-pixel nudge the entity applies to its sprite (for lunges). */
  offset: Vec2;
  pos: () => Vec2;
  /** How far above the feet the head is, in world pixels. */
  height: number;
  creature?: Creature;
}

interface MenuOption {
  id: string;
  label: string;
  hint: string;
  disabled?: boolean;
  /** Hotbar slots: the skill, and why it can't be used right now. */
  ability?: AbilityDef;
  reason?: string;
}

/** How the waiting options are shown: the hotbar of skills, or a row of buttons (targets, food) above it. */
type MenuStyle = 'hotbar' | 'list';

const FONT = 'Georgia, "Times New Roman", serif';
const BTN_H = 46;
const GAP = 8;
const MARGIN = 14;
/** Below this width the list buttons go in two columns. */
const NARROW = 760;
const CHIP_W = 72;
const CHIP_H = 92;
const LOG_LINES = 4;

// The hotbar along the bottom (laid out at this size, then scaled down to fit narrower windows).
const SLOT = 60;
const SLOT_GAP = 6;
const GROUP_GAP = 26;
const PANEL_PAD = 14;
const HERO_W = 236;
const END_W = 96;
const LABEL_H = 22;
const PANEL_H = PANEL_PAD * 2 + LABEL_H + SLOT;
const TIP_W = 300;
/** Action slots are marked green (a circle), bonus actions orange (a triangle). */
const ACTION_COLOR = 0x6fbf5a;
const BONUS_COLOR = 0xe8913a;
const ACTION_TEXT = '#8fdf7a';
const BONUS_TEXT = '#f0a860';
/** Hotkeys for the hotbar slots, in order (Space ends the turn). */
const SLOT_KEYS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO', 'MINUS', 'PLUS'];
const SLOT_KEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

/** Names to tell several of a kind apart in one fight. */
const PACK_NAMES: Partial<Record<FoeKind, string[]>> = {
  wolf: ['Grey Wolf', 'Scarred Wolf', 'Lean Wolf', 'Old Wolf', 'Young Wolf', 'Black Wolf'],
  rat: ['Cellar Rat', 'Fat Rat', 'Mangy Rat', 'Bold Rat', 'One-eared Rat', 'Big Rat'],
  goblin: ['Goblin Cutter', 'Scarred Cutter', 'Snaggletooth', 'One-ear'],
  goblinspear: ['Goblin Spearman', 'Painted Spearman', 'Bone-neck'],
  goblintorch: ['Goblin Firebrand', 'Sooty Firebrand', 'Grinning Firebrand'],
};

/** How each kind of beast's fight reads: how it starts, the banner, and how it runs off. */
const FOE_TEXT: Record<FoeKind, { start: string; banner: string; flee: string }> = {
  wolf: {
    start: 'The wolf lowers its head and snarls, circling you. It means to fight!',
    banner: 'A wolf attacks!',
    flee: 'yelps, tucks its tail and bolts for the trees!',
  },
  wolfmother: {
    start: 'A great white she-wolf rises from her bed of bones, twice the size of any wolf you have seen. Her eyes are like ice.',
    banner: 'The Wolf Mother!',
    flee: 'turns and lopes away into the dark!',
  },
  deer: {
    start: 'You close in on the red deer. It wheels round to face you and lowers its antlers!',
    banner: 'The hunt is on!',
    flee: 'wheels away and bounds off across the plain!',
  },
  hare: {
    start: 'You pounce at the hare. It freezes, ears flat, ready to bolt!',
    banner: 'The hunt is on!',
    flee: 'jinks away through the long grass and is gone!',
  },
  rat: {
    start: 'Rats boil out of the dark between the barrels, squealing, teeth bared!',
    banner: 'Rats!',
    flee: 'squeals and vanishes into a hole in the wall!',
  },
  boar: {
    start: 'The boar squeals, lowers its tusks and charges!',
    banner: 'A boar charges!',
    flee: 'squeals and crashes off into the thicket!',
  },
  footpad: {
    start: 'Rook hefts his cudgel and Nab slides a knife out of his sleeve. They spread out, to come at you from both sides!',
    banner: 'Footpads!',
    flee: 'throws down his cudgel and runs for the trees!',
  },
  cutpurse: {
    start: 'Nab slides a knife out of his sleeve and comes at you, low and quick!',
    banner: 'Footpads!',
    flee: 'squeals, drops his knife and legs it across the grass!',
  },
  goblin: {
    start: 'The goblin bares its tusks and comes at you, cleaver high!',
    banner: 'Goblins!',
    flee: 'shrieks and scuttles away!',
  },
  goblinspear: {
    start: 'The goblin levels its spear at your belly and hisses.',
    banner: 'Goblins!',
    flee: 'shrieks and scuttles away!',
  },
  goblintorch: {
    start: 'The goblin waves its torch in your face, cackling.',
    banner: 'Goblins!',
    flee: 'shrieks and scuttles away, torch and all!',
  },
  goblinbrute: {
    start: 'The Goblin Brute bangs its club on its shield and roars. Its goblins swarm round you, shrieking!',
    banner: 'The Goblin Brute!',
    flee: 'backs off, snarling.',
  },
};

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * A turn-based fight, played out over the world. Everyone rolls initiative
 * and takes turns in that order (shown along the top). On the hero's turn the
 * hotbar along the bottom offers their skills: each turn they have one Action
 * and one Bonus action to spend (see systems/Abilities.ts), some skills cost
 * stamina or need a few turns to recover. Each roll of the dice pops up over
 * whoever rolled it, and a log above the hotbar spells out the sums. Beasts
 * choose their own moves (see systems/Combat.ts). Emits 'combat-ended' with a
 * CombatResult when it's over.
 */
export class CombatScene extends Phaser.Scene {
  private world!: GameScene;
  private battle!: Battle;
  private hero!: Actor;
  private foes: Actor[] = [];
  private actors: Actor[] = [];

  private orderBar!: Phaser.GameObjects.Container;
  private logBox!: Phaser.GameObjects.Container;
  private logLines: string[] = [];
  private menuBox!: Phaser.GameObjects.Container;
  private hotbar!: Phaser.GameObjects.Container;
  private tooltip!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private menuTitle!: Phaser.GameObjects.Text;
  /** Click areas over the beasts while choosing a target. */
  private targetZones: Phaser.GameObjects.Zone[] = [];

  private menuOptions: MenuOption[] = [];
  private menuStyle: MenuStyle = 'list';
  private menuButtons: Array<(selected: boolean) => void> = [];
  private menuResolve?: (id: string) => void;
  private menuOnSelect?: (option: MenuOption) => void;
  private menuHeading = '';
  private selected = 0;
  /** The hero's turn so far: what's left to spend, and the skill being aimed (lit on the hotbar). */
  private budget: TurnBudget = { action: false, bonus: false };
  private heroActing = false;
  private aiming?: AbilityId;
  private doom?: CombatSceneData['doom'];
  private doomed = false;

  constructor() {
    super('Combat');
  }

  create(data: CombatSceneData): void {
    this.world = this.scene.get('Game') as GameScene;
    this.menuOptions = [];
    this.menuResolve = undefined;
    this.menuOnSelect = undefined;
    this.logLines = [];
    this.targetZones = [];
    this.budget = { action: false, bonus: false };
    this.heroActing = false;
    this.aiming = undefined;
    this.doom = data.doom;
    this.doomed = false;

    const stats = this.world.stats;
    stats.health = Math.max(1, Math.round(stats.health));
    const player = this.world.player;
    this.hero = {
      c: { ...this.heroStats(), initiative: 0, statuses: [], cooldowns: {}, attacksMade: 0, fled: false },
      sprite: player.sprite,
      offset: player.offset,
      pos: () => ({ x: player.gx, y: player.gy }),
      height: 44,
    };
    const defs: CombatantDef[] = [this.hero.c];
    data.foes.forEach((creature, i) => {
      const foe = FOES[creature.kind];
      const names = PACK_NAMES[creature.kind];
      const name = data.foes.length === 1 || !names ? foe.name : names[i % names.length];
      defs.push({ ...foe, id: creature.id, name, side: 'foes', hp: foe.maxHp });
    });
    this.battle = new Battle(defs);
    const byId = new Map(this.battle.combatants.map((c) => [c.id, c]));
    this.hero.c = byId.get('hero')!;
    this.foes = data.foes.map((creature) => ({
      c: byId.get(creature.id)!,
      sprite: creature.sprite,
      offset: creature.offset,
      pos: () => ({ x: creature.gx, y: creature.gy }),
      height: CREATURE_ART[creature.kind].tall ?? (CREATURE_ART[creature.kind].feetY - 3) * (CREATURE_ART[creature.kind].scale ?? 1),
      creature,
    }));
    this.actors = [this.hero, ...this.foes];

    ensureAbilityIcons(this);
    this.orderBar = this.add.container(0, 0);
    this.logBox = this.add.container(0, 0);
    this.hotbar = this.add.container(0, 0);
    this.menuBox = this.add.container(0, 0);
    this.tooltip = this.add.container(0, 0).setDepth(10);
    this.menuTitle = this.add.text(0, 0, '', { ...bodyStyle(17, THEME.goldText), fontFamily: FONT }).setOrigin(0.5, 1);
    this.hintText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: THEME.text, stroke: '#000000', strokeThickness: 3, align: 'center' })
      .setOrigin(0.5, 1);

    const kb = this.input.keyboard!;
    SLOT_KEYS.forEach((key, i) => kb.on(`keydown-${key}`, () => this.pick(i)));
    for (const key of ['LEFT', 'UP', 'A', 'W']) kb.on(`keydown-${key}`, () => this.moveSelection(-1));
    for (const key of ['RIGHT', 'DOWN', 'D', 'S']) kb.on(`keydown-${key}`, () => this.moveSelection(1));
    for (const key of ['ENTER', 'E']) kb.on(`keydown-${key}`, () => this.pick(this.selected));
    kb.on('keydown-SPACE', () => {
      if (this.menuStyle === 'hotbar') this.pickId('end');
      else this.pick(this.selected);
    });
    for (const key of ['ESC', 'BACKSPACE']) kb.on(`keydown-${key}`, () => this.pickId('back'));

    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.layout, this));
    this.layout();
    void this.run();
  }

  // ------------------------------------------------------------ the fight

  private async run(): Promise<void> {
    const first = this.foes[0];
    // The Wolf Mother comes with her pack, but it's her fight.
    const mother = this.foes.find((f) => f.creature!.kind === 'wolfmother');
    this.world.player.faceTowards(first.pos().x, first.pos().y);
    this.log(
      mother
        ? `${FOE_TEXT.wolfmother.start}${this.foes.length > 1 ? ' Her wolves fan out round you.' : ''}`
        : this.foes.length > 1 && first.creature!.kind === 'rat'
        ? FOE_TEXT.rat.start
        : this.foes.some((f) => f.creature!.kind === 'goblinbrute')
        ? FOE_TEXT.goblinbrute.start
        : this.foes.length > 1 && isGoblin(first.creature!.kind)
        ? 'Goblins swarm round you, shrieking and cackling!'
        : this.foes.length > 1 && isOutlaw(first.creature!.kind)
        ? FOE_TEXT.footpad.start
        : this.foes.length > 1
        ? this.world.map.data.underground
          ? 'Eyes shine in the lantern light. Wolves pad out of the dark, hackles raised. You are surrounded!'
          : 'Wolves slink out of the grass, hackles raised. You are surrounded!'
        : FOE_TEXT[first.creature!.kind].start,
    );
    // The beasts close in, and the camera settles on the fight.
    const spots: Vec2[] = [];
    for (const f of this.foes) spots.push(this.closeInSpot(f, spots));
    await Promise.all(this.foes.map((f, i) => f.creature!.moveTo(spots[i].x, spots[i].y, 650)));
    const here = this.hero.pos();
    for (const f of this.foes) f.creature!.faceTowards(here.x, here.y);
    this.world.player.faceTowards(first.pos().x, first.pos().y);
    this.world.frameFight(this.actors.map((a) => a.pos()));
    this.banner(
      mother ? FOE_TEXT.wolfmother.banner
        : this.foes.some((f) => f.creature!.kind === 'goblinbrute') ? FOE_TEXT.goblinbrute.banner
        : this.foes.length > 1 && first.creature!.kind !== 'rat' && !isArmed(first.creature!.kind) ? 'Wolves attack!'
          : FOE_TEXT[first.creature!.kind].banner,
    );
    await this.wait(900);

    if (!Inventory.equipped.mainHand) {
      this.log(
        this.spareWeapons().length > 0
          ? 'You have nothing in your hands. Ready Weapon (a bonus action) takes one up from your satchel.'
          : 'You have nothing in your hands but your fists.',
      );
    }
    this.log('Roll for initiative!');
    const rolls = this.battle.rollInitiative();
    await Promise.all(rolls.map((r) => this.rollDie(this.actorOf(r.who), r.roll, signed(r.who.quickness))));
    this.log(`Turn order: ${this.battle.order.map((c) => `${c.name} ${c.initiative}`).join(', ')}.`);
    this.drawOrder();
    await this.wait(500);

    while (this.battle.outcome() === 'ongoing') {
      await this.checkDoom();
      const c = this.battle.current;
      const actor = this.actorOf(c);
      this.drawOrder();
      this.banner(c.side === 'party' ? 'Your turn' : `${c.name}'s turn`, c.side === 'party');
      await this.wait(c.side === 'party' ? 350 : 650);
      const start = this.battle.beginTurn();
      this.drawOrder();
      if (start.bled > 0) await this.bleed(actor, start.bled);
      if (this.battle.isUp(c)) {
        if (c === this.hero.c) await this.heroTurn(start);
        else await this.foeTurn(actor, start);
      }
      this.drawOrder();
      await this.wait(400);
      const expired = this.battle.endTurn();
      if (expired.includes('dazed') && this.battle.isUp(c)) this.log(`${this.nameOf(actor, true)} ${actor === this.hero ? 'shake' : 'shakes'} off the daze.`);
    }
    await this.finish(this.battle.outcome());
  }

  private async heroTurn(start: TurnStart): Promise<void> {
    const hero = this.hero.c;
    this.budget = { action: true, bonus: true };
    this.heroActing = true;
    if (start.stood) {
      this.budget.bonus = false;
      this.float(this.hero, 'On your feet', THEME.text);
      await this.hop(this.hero.offset, 0, -5);
      this.log('You scramble back to your feet. That takes your bonus action.');
    }
    for (;;) {
      if (this.battle.outcome() !== 'ongoing' || !this.battle.isUp(hero)) break;
      const options = this.hotbarOptions();
      // Nothing left worth doing (both spent, or whatever's left is out of reach): the turn ends by itself.
      if (options.every((o) => o.disabled || o.id === 'end')) {
        await this.wait(250);
        break;
      }
      const choice = await this.showMenu('', options, 'hotbar');
      if (choice === 'end') break;
      const a = ABILITIES.find((x) => x.id === choice)!;
      await this.useAbility(a);
      this.drawOrder();
    }
    this.heroActing = false;
    this.budget = { action: false, bonus: false };
    this.clearMenu();
    this.buildHotbar(false);
  }

  /** Spend what a skill costs, once the hero is committed to it. */
  private commit(a: AbilityDef): void {
    this.budget[a.cost] = false;
    if (a.stamina) this.world.stats.restoreStamina(-a.stamina);
    if (a.cooldown) this.battle.cooldown(this.hero.c, a.id, a.cooldown);
    this.aiming = a.id;
    this.buildHotbar(false);
  }

  /** Carry out one of the hero's skills. Choosing a target or a food can be backed out of, which spends nothing. */
  private async useAbility(a: AbilityDef): Promise<void> {
    const hero = this.hero.c;
    const stats = this.world.stats;
    this.aiming = a.id;
    switch (a.id) {
      case 'strike':
      case 'heavy':
      case 'stagger': {
        const target = await this.chooseTarget(a, a.id === 'heavy' ? { toHit: HEAVY_TO_HIT } : {});
        if (!target) break;
        this.commit(a);
        const r = await this.attack(this.hero, this.actorOf(target), a.id === 'heavy' ? { toHit: HEAVY_TO_HIT, times: 2 } : {}, {
          heavy: a.id === 'heavy',
          verb: a.id === 'heavy' ? 'put all your strength into a blow at' : a.id === 'stagger' ? 'aim a blow at the head of' : undefined,
        });
        if (a.id === 'stagger' && r.hit && !r.killed && this.battle.isUp(target)) {
          this.battle.addStatus(target, 'dazed', 1);
          this.float(this.actorOf(target), 'Dazed', hex(STATUSES.dazed.color));
          this.log(`The ${target.name} reels, dazed: its next attacks roll with disadvantage.`);
        }
        break;
      }
      case 'sweep': {
        this.commit(a);
        this.log('You swing wide at everything around you!');
        for (const foe of this.battle.standing('foes')) {
          if (this.battle.outcome() !== 'ongoing') break;
          await this.attack(this.hero, this.actorOf(foe), { toHit: SWEEP_TO_HIT, half: true }, { verb: 'sweep through', quick: true });
        }
        break;
      }
      case 'brace': {
        this.commit(a);
        this.battle.defend(hero);
        stats.restoreStamina(BRACE_STAMINA);
        GameAudio.click();
        this.float(this.hero, 'On guard', '#9cd3ff');
        await this.hop(this.hero.offset, 0, -4);
        this.log(`You raise your guard (armour ${this.battle.armourOf(hero)}) and steady your breathing.`);
        break;
      }
      case 'item': {
        const use = await this.showMenu('Eat what?', [...this.foodOptions(), { id: 'back', label: 'Back', hint: 'Choose something else.' }]);
        if (use === 'back') break;
        this.commit(a);
        await this.eat(use);
        break;
      }
      case 'ready': {
        const use = await this.showMenu('Take up which?', [...this.weaponOptions(), { id: 'back', label: 'Back', hint: 'Choose something else.' }]);
        if (use === 'back') break;
        this.commit(a);
        await this.takeUp(use);
        break;
      }
      case 'flee': {
        this.commit(a);
        const r = this.battle.tryFlee(hero);
        await this.rollDie(this.hero, r.roll, signed(hero.quickness));
        if (r.success) {
          this.log(`You run for it: ${r.roll} ${signed(hero.quickness)} = ${r.total} against ${r.dc}. You get away!`);
          await this.hop(this.hero.offset, 0, -6);
        } else {
          this.log(`You try to run: ${r.roll} ${signed(hero.quickness)} = ${r.total} against ${r.dc}. You're cut off!`);
          this.float(this.hero, 'Cut off!', '#d8c8a4');
        }
        break;
      }
      case 'shove': {
        const target = await this.chooseTarget(a);
        if (!target) break;
        this.commit(a);
        const foe = this.actorOf(target);
        const r = this.battle.shove(hero, target);
        await this.rollDie(this.hero, r.roll, signed(hero.toHit));
        GameAudio.swing(false);
        await this.lunge(this.hero, foe, false);
        const man = !!foe.creature && isOutlaw(foe.creature.kind);
        const sum = `${r.roll} ${signed(hero.toHit)} = ${r.total} against ${man ? 'his' : 'its'} ${r.resistTotal}${r.steady ? ' (it stands firm, with advantage)' : ''}`;
        if (r.success) {
          GameAudio.hit(false);
          this.knockDown(foe);
          this.float(foe, 'Prone!', hex(STATUSES.prone.color));
          this.log(`You shove the ${target.name}: ${sum}. ${man ? 'He' : 'It'} goes sprawling! Attacks against ${man ? 'him' : 'it'} roll with advantage.`);
        } else {
          this.float(foe, 'Holds firm', '#d8c8a4');
          void this.hop(foe.offset, 4, 0);
          this.log(`You shove the ${target.name}: ${sum}. ${man ? 'He keeps his' : 'It keeps its'} feet.`);
        }
        break;
      }
      case 'mark': {
        const target = await this.chooseTarget(a);
        if (!target) break;
        this.commit(a);
        this.battle.addStatus(target, 'marked', 3, { by: hero.id });
        GameAudio.click();
        this.float(this.actorOf(target), 'Marked', hex(STATUSES.marked.color));
        this.log(`You fix your eyes on the ${target.name}, watching how it moves. You'll strike it truer for a while.`);
        await this.wait(400);
        break;
      }
      case 'secondwind': {
        this.commit(a);
        const healed = Math.min(hero.maxHp - hero.hp, this.battle.rollDice({ ...SECOND_WIND, bonus: Experience.level }));
        this.battle.heal(hero, healed);
        stats.heal(healed);
        GameAudio.pickup();
        this.float(this.hero, `+${healed}`, '#8fe08a');
        this.log(`You grit your teeth and find your second wind: ${healed} health back.`);
        await this.wait(450);
        break;
      }
    }
    this.aiming = undefined;
  }

  private async foeTurn(foe: Actor, start: TurnStart): Promise<void> {
    const action = chooseFoeAction(this.battle, foe.c, start.stood);
    if (action.type === 'stand') {
      this.standUp(foe);
      await this.hop(foe.offset, 0, -4);
      this.log(`The ${foe.c.name} scrambles back onto ${isOutlaw(foe.creature!.kind) ? 'his' : 'its'} feet.`);
      return;
    }
    if (action.type === 'attack' && shouldHowl(this.battle, foe.c)) await this.howl(foe);
    if (action.type === 'attack') {
      await this.attack(foe, this.actorOf(action.target));
    } else if (action.type === 'flee') {
      foe.c.fled = true;
      this.cry(foe);
      this.log(`The ${foe.c.name} ${FOE_TEXT[foe.creature!.kind].flee}`);
      const from = this.hero.pos();
      await foe.creature!.flee(from.x, from.y);
    }
  }

  /** A beast's yelp, or a goblin's shriek, as it's hurt (footpads just grunt). */
  private cry(actor: Actor): void {
    const kind = actor.creature?.kind;
    if (!kind) return;
    if (isGoblin(kind)) GameAudio.shriek(kind === 'goblinbrute');
    else if (!isOutlaw(kind)) GameAudio.yelp();
  }

  /**
   * A fight that can't be won turns: once its round comes (or the hero has the
   * leader badly hurt, or only the leader is left), the foes can't miss and the
   * hero can't hit, until the hero goes down.
   */
  private async checkDoom(): Promise<void> {
    const doom = this.doom;
    if (!doom || this.doomed) return;
    const leader = doom.leader ? this.foes.find((f) => f.c.id === doom.leader) : undefined;
    const leaderHurt = !!leader && leader.c.hp < leader.c.maxHp * 0.5;
    const alone = this.battle.standing('foes').length <= 1;
    if (this.battle.round < doom.round && !leaderHurt && !alone) return;
    this.doomed = true;
    const hero = this.hero.c;
    this.battle.fate = {
      decide: (attacker) => (attacker.side === 'foes' ? 'hit' : 'miss'),
      minDamage: () => Math.ceil(hero.maxHp * 0.2),
    };
    if (leader && leader.c.hp < leader.c.maxHp * 0.5) leader.c.hp = Math.ceil(leader.c.maxHp * 0.5);
    for (const f of this.foes) if (this.battle.isUp(f.c)) this.battle.addStatus(f.c, 'rallied', 99);
    GameAudio.warHorn();
    this.world.cameras.main.shake(400, 0.008);
    this.banner('Overwhelmed!');
    this.log(doom.text);
    this.drawOrder();
    await this.wait(1100);
  }

  /** A pack leader's howl rouses the rest of the pack. */
  private async howl(leader: Actor): Promise<void> {
    const howl = this.battle.trait(leader.c, 'howl')!;
    this.battle.cooldown(leader.c, 'howl', howl.cooldown);
    GameAudio.growl();
    await this.hop(leader.offset, 0, -6);
    const pack = this.foes.filter((f) => f !== leader && this.battle.isUp(f.c));
    for (const f of pack) {
      this.battle.addStatus(f.c, 'rallied', 2);
      this.float(f, 'Rallied', hex(STATUSES.rallied.color));
    }
    this.log(
      isGoblin(leader.creature!.kind)
        ? `The ${leader.c.name} bangs its club on its shield and bellows. Its goblins shriek back, wild-eyed (${signed(RALLY_TO_HIT)} to hit for 2 turns).`
        : `The ${leader.c.name} throws back her head and howls. Her wolves answer, eyes blazing (${signed(RALLY_TO_HIT)} to hit for 2 turns).`,
    );
    this.drawOrder();
    await this.wait(700);
  }

  /** A bleeding wound hurts as the turn begins. */
  private async bleed(actor: Actor, amount: number): Promise<void> {
    if (actor === this.hero) this.world.stats.damage(amount);
    this.flash(actor);
    this.float(actor, `-${amount}`, hex(STATUSES.bleeding.color));
    this.log(`${this.nameOf(actor, true)} ${actor === this.hero ? 'bleed' : 'bleeds'} for ${amount}.`);
    this.drawOrder();
    await this.wait(450);
    if (actor.c.hp <= 0) await this.fall(actor);
  }

  /**
   * Choosing which beast a skill is aimed at: click it in the world, or its
   * button (each shows the chance to hit), or use the keys. With only one
   * beast left there's nothing to choose.
   */
  private async chooseTarget(a: AbilityDef, opts: AttackOptions = {}): Promise<Combatant | undefined> {
    const foes = this.battle.standing('foes');
    if (foes.length === 1) return foes[0];
    const attacking = a.id !== 'mark' && a.id !== 'shove';
    const chance = (f: Combatant) => Math.round(this.battle.hitChance(this.hero.c, f, opts) * 100);
    const options: MenuOption[] = foes.map((f) => ({
      id: f.id,
      label: `${f.name}  ${f.hp}/${f.maxHp}${attacking ? `  ·  ${chance(f)}%` : ''}`,
      hint: attacking
        ? `Armour ${this.battle.armourOf(f)}. You need to roll ${Math.max(2, this.battle.armourOf(f) - this.battle.toHitAgainst(this.hero.c, f, opts))} or more` +
          `${this.battle.rollMode(this.hero.c, f) > 0 ? ', with advantage' : this.battle.rollMode(this.hero.c, f) < 0 ? ', with disadvantage' : ''}.`
        : a.id === 'shove'
        ? `Quickness ${signed(f.quickness)}${this.battle.trait(f, 'steady') ? ', and sure-footed (resists with advantage)' : ''}.`
        : `${f.hp}/${f.maxHp} health.`,
    }));
    options.push({ id: 'back', label: 'Back', hint: 'Choose something else.' });
    // A gold arrow bobs over whichever one is picked, and each beast can be clicked.
    const arrow = this.add.graphics().setVisible(false);
    arrow.fillStyle(THEME.gold, 1).lineStyle(2, 0x2a1a08, 1);
    arrow.fillTriangle(-12, -16, 12, -16, 0, 0).strokeTriangle(-12, -16, 12, -16, 0, 0);
    const bob = this.tweens.add({ targets: arrow, scale: { from: 1, to: 0.8 }, duration: 300, yoyo: true, repeat: -1 });
    const labels: Phaser.GameObjects.Text[] = [];
    const zoom = this.world.cameras.main.zoom;
    foes.forEach((f, i) => {
      const actor = this.actorOf(f);
      const head = this.headOf(actor);
      const h = actor.height * zoom + 14;
      const zone = this.add.zone(head.x, head.y + h / 2, Math.max(56, h * 1.4), h).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.select(i));
      zone.on('pointerup', () => this.pick(i));
      this.targetZones.push(zone);
      if (attacking) {
        labels.push(
          this.add
            .text(head.x, head.y - 22, `${chance(f)}%`, { fontFamily: FONT, fontSize: '15px', color: THEME.goldText, stroke: '#000000', strokeThickness: 4, fontStyle: 'bold' })
            .setOrigin(0.5, 1),
        );
      }
    });
    this.menuOnSelect = (o) => {
      const foe = this.foes.find((f) => f.c.id === o.id);
      arrow.setVisible(!!foe);
      if (foe) arrow.setPosition(this.headOf(foe).x, this.headOf(foe).y + 4);
      labels.forEach((l, k) => l.setAlpha(foes[k].id === o.id ? 1 : 0.6));
    };
    const verb = { strike: 'Strike', heavy: 'Heavy blow on', stagger: 'Stagger', shove: 'Shove', mark: 'Mark' }[a.id as string] ?? a.name;
    const id = await this.showMenu(`${verb} which?`, options);
    bob.stop();
    arrow.destroy();
    labels.forEach((l) => l.destroy());
    this.targetZones.forEach((z) => z.destroy());
    this.targetZones = [];
    return foes.find((f) => f.id === id);
  }

  /** Food in the satchel, one button per kind. */
  private foodOptions(): MenuOption[] {
    const options: MenuOption[] = [];
    const seen = new Set<ItemId>();
    Inventory.bag.forEach((stack, index) => {
      if (!stack || seen.has(stack.id)) return;
      const def = itemDef(stack.id);
      if (!def.eat) return;
      seen.add(stack.id);
      const gains = [def.eat.health && `${def.eat.health} health`, def.eat.stamina && `${def.eat.stamina} stamina`].filter(Boolean);
      options.push({ id: `${index}`, label: `${def.name} x${Inventory.count(stack.id)}`, hint: `Eat it: restores ${gains.join(' and ')}.` });
    });
    return options;
  }

  private spareWeapons(): number[] {
    const found: number[] = [];
    const seen = new Set<ItemId>();
    Inventory.bag.forEach((stack, index) => {
      if (!stack || seen.has(stack.id) || itemDef(stack.id).slot !== 'mainHand') return;
      seen.add(stack.id);
      found.push(index);
    });
    return found;
  }

  private weaponOptions(): MenuOption[] {
    return this.spareWeapons().map((index) => {
      const def = itemDef(Inventory.bag[index]!.id);
      return { id: `${index}`, label: `Take ${def.name}`, hint: `Take it up as your weapon: ${signed(def.attack ?? 0)} attack, and d6 damage.` };
    });
  }

  private async eat(slot: string): Promise<void> {
    const index = Number(slot);
    const stack = Inventory.bag[index];
    if (!stack) return;
    const def = itemDef(stack.id);
    const before = this.world.stats.health;
    this.world.eat(index);
    this.hero.c.hp = Math.round(this.world.stats.health);
    const healed = Math.round(this.world.stats.health - before);
    this.float(this.hero, healed > 0 ? `+${healed}` : 'Refreshed', '#8fe08a');
    this.log(`You ${def.drink ? 'gulp' : 'wolf'} down the ${def.name.toLowerCase()}${healed > 0 ? ` and recover ${healed} health` : ''}.`);
    await this.wait(500);
  }

  private async takeUp(slot: string): Promise<void> {
    const index = Number(slot);
    const stack = Inventory.bag[index];
    if (!stack) return;
    const def = itemDef(stack.id);
    Inventory.equip(index);
    Object.assign(this.hero.c, this.heroStats());
    GameAudio.pickup();
    this.float(this.hero, def.name, THEME.goldText);
    this.log(`You take up the ${def.name.toLowerCase()}. Attacks now roll d20 ${signed(this.hero.c.toHit)}, ${diceText(this.hero.c.damage)} damage.`);
    await this.wait(500);
  }

  /** Roll to hit, lunge, and show what happened. */
  private async attack(
    attacker: Actor,
    target: Actor,
    opts: AttackOptions = {},
    style: { verb?: string; heavy?: boolean; quick?: boolean } = {},
  ): Promise<AttackResult> {
    const r = this.battle.attack(attacker.c, target.c, opts);
    const at = target.pos();
    if (attacker.creature) attacker.creature.faceTowards(at.x, at.y);
    else this.world.player.faceTowards(at.x, at.y);

    await this.rollDie(attacker, r.roll, signed(r.total - r.roll), r.mode);
    if (attacker.creature) {
      attacker.creature.setFrame(CREATURE_FRAME.bite);
      if (isArmed(attacker.creature.kind)) GameAudio.swing(false);
      else GameAudio.bite();
    } else {
      GameAudio.swing(!!style.heavy);
    }
    await this.lunge(attacker, target, !!style.heavy);
    if (attacker.creature && attacker.c.hp > 0) attacker.creature.setFrame(CREATURE_FRAME.snarl);

    const who = this.nameOf(attacker, true);
    const whom = this.nameOf(target, false);
    const verb = style.verb ?? attacker.c.verb;
    const dice = r.mode === 0 ? '' : ` (${r.mode > 0 ? 'advantage' : 'disadvantage'}: rolled ${r.rolls.join(' and ')})`;
    const sum = `${r.roll} ${signed(r.total - r.roll)} = ${r.total} against armour ${r.ac}${dice}`;
    if (r.hit) {
      GameAudio.hit(r.crit);
      if (target === this.hero) {
        this.world.stats.damage(r.damage);
        this.world.cameras.main.shake(160, r.crit ? 0.012 : 0.006);
      }
      this.flash(target);
      this.float(target, r.crit ? `Critical! -${r.damage}` : `-${r.damage}`, r.crit ? '#ffd76a' : '#ff6b5a', r.crit);
      if (target.creature && !r.killed) {
        this.cry(target);
        target.creature.setFrame(CREATURE_FRAME.hurt);
        this.time.delayedCall(350, () => {
          if (target.c.hp > 0 && !target.c.fled && !this.battle.has(target.c, 'prone')) target.creature!.setFrame(CREATURE_FRAME.snarl);
        });
      }
      const how = r.crit ? 'A natural 20, a critical hit!' : 'Hit!';
      this.log(`${who} ${verb} ${whom}: ${sum}. ${how} ${r.damage} damage.${r.charged ? ' The charge puts weight behind it.' : ''}`);
      if (r.trip) {
        const save = `${r.trip.roll} ${signed(r.trip.total - r.trip.roll)} = ${r.trip.total} against ${r.trip.dc}`;
        if (r.trip.fell) {
          await this.wait(250);
          this.knockDown(target);
          this.float(target, 'Prone!', hex(STATUSES.prone.color));
          this.log(`${capital(whom)} ${target === this.hero ? 'are' : 'is'} dragged to the ground (${save})!`);
        } else {
          this.log(`${capital(whom)} ${target === this.hero ? 'keep your' : 'keeps its'} feet (${save}).`);
        }
      }
      if (r.rend) {
        this.float(target, 'Bleeding', hex(STATUSES.bleeding.color));
        this.log(
          attacker.creature?.kind === 'goblintorch'
            ? `The flames catch; ${whom} ${target === this.hero ? 'are' : 'is'} burning.`
            : `The bite tears; ${whom} ${target === this.hero ? 'are' : 'is'} bleeding.`,
        );
      }
    } else {
      this.float(target, 'Miss', '#d8c8a4');
      void this.hop(target.offset, target === this.hero ? -6 : 6, 0);
      const how = r.roll === 1 ? 'A 1: a clumsy miss.' : 'Miss.';
      this.log(`${who} ${verb} ${whom}: ${sum}. ${how}`);
    }
    this.drawOrder();

    if (r.killed) {
      await this.wait(350);
      await this.fall(target);
    }
    await this.wait(style.quick ? 100 : 250);
    return r;
  }

  /** Someone has dropped: a beast dies (and the hero earns its experience), or the hero blacks out. */
  private async fall(actor: Actor): Promise<void> {
    if (actor.creature) {
      this.cry(actor);
      actor.offset.y = 0;
      actor.creature.die();
      const xp = FOES[actor.creature.kind].xp;
      this.log(`The ${actor.c.name} crumples to the ground and lies still. You earn ${xp} experience.`);
      this.float(actor, `+${xp} XP`, THEME.goldText);
      this.gainXp(xp, actor.c.name);
    } else {
      this.log('Your legs give way and the world goes dark...');
    }
    this.drawOrder();
  }

  /** Knocked off their feet: a beast sprawls (shown hurt and sunk a little). */
  private knockDown(actor: Actor): void {
    if (actor.creature) {
      actor.creature.setFrame(CREATURE_FRAME.hurt);
      void this.nudge(actor.offset, 0, 5, 120);
    } else {
      void this.nudge(actor.offset, 0, 4, 120);
    }
    this.drawOrder();
  }

  private standUp(actor: Actor): void {
    if (actor.creature) actor.creature.setFrame(CREATURE_FRAME.snarl);
    void this.nudge(actor.offset, 0, 0, 120);
  }

  /** "You" / "you" for the hero, "The Grey Wolf" / "the Grey Wolf" for a beast. */
  private nameOf(actor: Actor, start: boolean): string {
    if (actor === this.hero) return start ? 'You' : 'you';
    return `${start ? 'The' : 'the'} ${actor.c.name}`;
  }

  private async finish(outcome: Outcome): Promise<void> {
    this.clearMenu();
    this.hintText.setText('');
    const slain = this.foes.filter((f) => f.c.hp <= 0).map((f) => f.c.id);
    const fled = this.foes.filter((f) => f.c.fled).map((f) => f.c.id);
    if (outcome === 'victory' && slain.length === 0) {
      // Everything ran off (game that bolted, a wolf that lost its nerve).
      this.banner(this.foes.length > 1 ? 'They got away!' : 'It got away!', true);
    } else if (outcome === 'victory') {
      GameAudio.victory();
      this.banner('Victory!', true);
    } else if (outcome === 'defeat') {
      GameAudio.defeat();
      this.hero.sprite.setTint(0x777777);
      this.banner('You have fallen...');
    } else {
      this.banner('You got away!', true);
    }
    await this.wait(1700);
    this.hero.sprite.clearTint();
    this.hero.offset.x = this.hero.offset.y = 0;
    for (const f of this.foes) f.offset.x = f.offset.y = 0;
    this.tweens.add({
      targets: [this.orderBar, this.logBox, this.menuBox, this.hotbar, this.tooltip, this.hintText, this.menuTitle],
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.events.emit('combat-ended', { outcome, slain, fled } satisfies CombatResult);
        this.scene.stop();
      },
    });
  }

  /** Experience for a kill. A level gained mid-fight counts at once: the new health is there to use. */
  private gainXp(xp: number, reason: string): void {
    Experience.gain(xp, reason);
    const stats = this.world.stats;
    if (stats.maxHealth !== this.hero.c.maxHp) {
      Object.assign(this.hero.c, this.heroStats());
      this.drawOrder();
    }
  }

  /** The hero's numbers, from their level and what they're wearing and wielding. */
  private heroStats(): CombatantDef {
    const gear = Inventory.totals;
    const weapon = Inventory.equipped.mainHand;
    const stats = this.world.stats;
    return {
      id: 'hero',
      name: HERO_NAME,
      side: 'party',
      hp: Math.round(stats.health),
      maxHp: stats.maxHealth,
      ac: 10 + gear.defence,
      toHit: 3 + gear.attack + Experience.toHitBonus,
      damage: { count: 1, sides: weapon ? 6 : 4, bonus: gear.attack + Experience.damageBonus },
      quickness: 2,
      verb: weapon ? `swing your ${itemDef(weapon).name.toLowerCase()} at` : 'throw a punch at',
    };
  }

  private actorOf(c: Combatant): Actor {
    return this.actors.find((a) => a.c === c)!;
  }

  /** Where a beast stands to fight: beside the hero on its own side, clear of the spots others took. */
  private closeInSpot(foe: Actor, taken: Vec2[]): Vec2 {
    const h = this.hero.pos();
    const p = foe.pos();
    const base = Math.atan2(p.y - h.y, p.x - h.x);
    const map = this.world.map;
    for (const turn of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
      const x = h.x + Math.cos(base + turn) * 1.7;
      const y = h.y + Math.sin(base + turn) * 1.7;
      const free = taken.every((t) => Math.hypot(t.x - x, t.y - y) > 1.1);
      if (free && map.isWalkable(Math.floor(x), Math.floor(y))) return { x, y };
    }
    return p;
  }

  // ------------------------------------------------------------ the hotbar

  private abilityContext(): AbilityContext {
    return {
      battle: this.battle,
      hero: this.hero.c,
      level: Experience.level,
      stamina: Math.floor(this.world.stats.stamina),
      hasWeapon: !!Inventory.equipped.mainHand,
      hasFood: this.foodOptions().length > 0,
      spareWeapon: this.spareWeapons().length > 0,
      trapped: this.doom?.trapped,
    };
  }

  /** A slot for every skill (greyed out, with the reason, when it can't be used now), then End turn. */
  private hotbarOptions(): MenuOption[] {
    const ctx = this.abilityContext();
    const options: MenuOption[] = ABILITIES.map((a) => {
      const reason = this.heroActing ? whyNot(a, ctx, this.budget) : 'Wait for your turn.';
      return { id: a.id, label: a.name, hint: a.blurb, ability: a, reason, disabled: !!reason };
    });
    options.push({ id: 'end', label: 'End turn', hint: 'Finish your turn (Space).', disabled: !this.heroActing });
    return options;
  }

  /** Where the hotbar panel sits on screen, and how much it's scaled down to fit. */
  private panelGeometry(): { x: number; y: number; w: number; scale: number; actionX: number; bonusX: number; endX: number } {
    const { width, height } = this.scale;
    const actions = ABILITIES.filter((a) => a.cost === 'action').length;
    const bonus = ABILITIES.length - actions;
    const span = (n: number) => n * SLOT + (n - 1) * SLOT_GAP;
    const actionX = PANEL_PAD + HERO_W + 14;
    const bonusX = actionX + span(actions) + GROUP_GAP;
    const endX = bonusX + span(bonus) + 16;
    const w = endX + END_W + PANEL_PAD;
    const scale = Math.min(1, (width - MARGIN * 2) / w);
    return { x: Math.round(width / 2 - (w * scale) / 2), y: Math.round(height - 10 - PANEL_H * scale), w, scale, actionX, bonusX, endX };
  }

  /**
   * The bar along the bottom: the hero's portrait, health, stamina and what's
   * on them; the Action and Bonus action slots, each with its own pip that
   * empties once spent; and End turn. Interactive only while the hero is
   * choosing; otherwise it's drawn dimmed, as a reminder of what's to hand.
   */
  private buildHotbar(active: boolean): void {
    this.hotbar.removeAll(true);
    const geo = this.panelGeometry();
    this.hotbar.setPosition(geo.x, geo.y).setScale(geo.scale);
    const options = active ? this.menuOptions : this.hotbarOptions();
    if (active) this.menuButtons = [];

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.45).fillRoundedRect(4, 6, geo.w, PANEL_H, 14);
    bg.fillStyle(THEME.panel, 0.95).fillRoundedRect(0, 0, geo.w, PANEL_H, 14);
    bg.lineStyle(2, THEME.gold, 0.9).strokeRoundedRect(0, 0, geo.w, PANEL_H, 14);
    bg.lineStyle(1, THEME.gold, 0.3).strokeRoundedRect(5, 5, geo.w - 10, PANEL_H - 10, 10);
    // Dividers between the hero, the actions, the bonus actions and End turn.
    bg.lineStyle(1, THEME.gold, 0.35);
    bg.lineBetween(geo.actionX - 8, 12, geo.actionX - 8, PANEL_H - 12);
    bg.lineBetween(geo.bonusX - GROUP_GAP / 2, 12, geo.bonusX - GROUP_GAP / 2, PANEL_H - 12);
    bg.lineBetween(geo.endX - 8, 12, geo.endX - 8, PANEL_H - 12);
    this.hotbar.add(bg);
    this.drawHeroBlock();

    // The group headings, each with its pip: lit while it's still there to spend.
    const heading = (x: number, text: string, color: number, textColor: string, available: boolean, triangle: boolean) => {
      const pip = this.add.graphics();
      const cx = x + 7;
      const cy = PANEL_PAD + 7;
      pip.lineStyle(2, color, 1);
      if (available) pip.fillStyle(color, 1);
      else pip.fillStyle(0x000000, 0.4);
      if (triangle) {
        pip.fillTriangle(cx, cy - 7, cx + 7, cy + 6, cx - 7, cy + 6).strokeTriangle(cx, cy - 7, cx + 7, cy + 6, cx - 7, cy + 6);
      } else {
        pip.fillCircle(cx, cy, 6.5).strokeCircle(cx, cy, 6.5);
      }
      const label = this.add.text(x + 20, cy, text, { fontFamily: FONT, fontSize: '13px', color: available ? textColor : THEME.dimText }).setOrigin(0, 0.5);
      this.hotbar.add([pip, label]);
    };
    heading(geo.actionX, 'ACTION', ACTION_COLOR, ACTION_TEXT, this.heroActing && this.budget.action, false);
    heading(geo.bonusX, 'BONUS ACTION', BONUS_COLOR, BONUS_TEXT, this.heroActing && this.budget.bonus, true);

    const top = PANEL_PAD + LABEL_H;
    let actionN = 0;
    let bonusN = 0;
    options.forEach((option, i) => {
      if (option.id === 'end') {
        this.addEndTurn(option, i, geo.endX, top, active);
        return;
      }
      const a = option.ability!;
      const x = a.cost === 'action' ? geo.actionX + actionN++ * (SLOT + SLOT_GAP) : geo.bonusX + bonusN++ * (SLOT + SLOT_GAP);
      this.addSlot(option, i, x, top, active);
    });
    if (!active) this.tooltip.removeAll(true);
  }

  /** One skill's square: its icon, hotkey, cost marker and stamina, darkened while it recovers. */
  private addSlot(option: MenuOption, i: number, x: number, y: number, active: boolean): void {
    const a = option.ability!;
    const ctx = this.abilityContext();
    const color = a.cost === 'action' ? ACTION_COLOR : BONUS_COLOR;
    const locked = !!a.level && ctx.level < a.level;
    const cd = this.hero.c.cooldowns[a.id];
    const lit = this.aiming === a.id;
    const bg = this.add.graphics();
    const icon = this.add.image(SLOT / 2, SLOT / 2, abilityIconKey(a.id)).setDisplaySize(SLOT - 4, SLOT - 4);
    const border = this.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [bg, icon, border];

    const marker = this.add.graphics();
    marker.fillStyle(color, 1).lineStyle(1, 0x000000, 0.8);
    marker.lineStyle(1.5, 0x000000, 0.9);
    if (a.cost === 'action') marker.fillCircle(SLOT - 9, 9, 4.5).strokeCircle(SLOT - 9, 9, 4.5);
    else marker.fillTriangle(SLOT - 9, 3.5, SLOT - 3.5, 13, SLOT - 14.5, 13).strokeTriangle(SLOT - 9, 3.5, SLOT - 3.5, 13, SLOT - 14.5, 13);
    parts.push(marker);
    if (i < SLOT_KEY_LABELS.length) {
      parts.push(this.add.text(6, 3, SLOT_KEY_LABELS[i], { fontFamily: FONT, fontSize: '12px', color: THEME.text, stroke: '#000000', strokeThickness: 3, fontStyle: 'bold' }));
    }
    if (a.stamina) {
      // Its stamina cost in a little dark pill in the corner, with a bolt.
      const short = ctx.stamina < a.stamina;
      const col = short ? 0xff7a6a : 0x8fd0ff;
      const pill = this.add.graphics();
      pill.fillStyle(0x000000, 0.72).fillRoundedRect(SLOT - 29, SLOT - 17, 26, 14, 5);
      pill.fillStyle(col, 1).fillTriangle(SLOT - 24, SLOT - 9, SLOT - 19, SLOT - 15, SLOT - 20, SLOT - 9).fillTriangle(SLOT - 21, SLOT - 10, SLOT - 20, SLOT - 4, SLOT - 16, SLOT - 11);
      parts.push(pill);
      parts.push(this.add.text(SLOT - 5, SLOT - 10, `${a.stamina}`, { fontFamily: FONT, fontSize: '11px', color: hex(col), fontStyle: 'bold' }).setOrigin(1, 0.5));
    }
    const shade = this.add.graphics();
    parts.push(shade);
    if (locked) {
      shade.fillStyle(0x000000, 0.7).fillRoundedRect(0, 0, SLOT, SLOT, 9);
      parts.push(this.add.text(SLOT / 2, SLOT / 2, `Lv ${a.level}`, { fontFamily: FONT, fontSize: '14px', color: THEME.dimText }).setOrigin(0.5));
    } else if (cd) {
      shade.fillStyle(0x000000, 0.62).fillRoundedRect(0, 0, SLOT, SLOT, 9);
      parts.push(
        this.add
          .text(SLOT / 2, SLOT / 2, cd === Infinity ? 'Used' : `${cd}`, {
            fontFamily: FONT, fontSize: cd === Infinity ? '13px' : '22px', color: THEME.text, stroke: '#000000', strokeThickness: 3, fontStyle: 'bold',
          })
          .setOrigin(0.5),
      );
    }
    const slot = this.add.container(x, y, parts);
    const draw = (on: boolean) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.5).fillRoundedRect(1, 3, SLOT, SLOT, 9);
      bg.fillStyle(0x0f0b12, 1).fillRoundedRect(0, 0, SLOT, SLOT, 9);
      border.clear();
      border.lineStyle(on || lit ? 3 : 2, on || lit ? THEME.gold : color, on || lit ? 1 : 0.7).strokeRoundedRect(0, 0, SLOT, SLOT, 9);
      if (on || lit) border.lineStyle(1, 0xfff2c0, 0.5).strokeRoundedRect(3, 3, SLOT - 6, SLOT - 6, 7);
      // Greyed out when it can't be used now (a slot on cooldown or not yet learned has its own cover instead).
      slot.setAlpha(option.disabled && !lit && !locked && !cd ? 0.42 : 1);
      slot.y = on && !option.disabled ? y - 3 : y;
    };
    draw(false);
    if (active) {
      const hit = this.add.zone(SLOT / 2, SLOT / 2, SLOT, SLOT).setInteractive({ useHandCursor: !option.disabled });
      hit.on('pointerover', () => this.select(i));
      hit.on('pointerup', () => this.pick(i));
      slot.add(hit);
      this.menuButtons.push(draw);
    }
    this.hotbar.add(slot);
  }

  private addEndTurn(option: MenuOption, i: number, x: number, y: number, active: boolean): void {
    const bg = this.add.graphics();
    // Once nothing's left to spend, End turn glows to say so.
    const nudge = this.heroActing && !this.budget.action;
    const label = this.add.text(END_W / 2, SLOT / 2 - 7, 'End turn', { fontFamily: FONT, fontSize: '16px', color: THEME.text }).setOrigin(0.5);
    const key = this.add.text(END_W / 2, SLOT / 2 + 12, 'Space', { fontFamily: FONT, fontSize: '11px', color: THEME.dimText }).setOrigin(0.5);
    const button = this.add.container(x, y, [bg, label, key]);
    const draw = (on: boolean) => {
      bg.clear();
      bg.fillStyle(on ? 0x3a2a1a : 0x231a12, 1).fillRoundedRect(0, 0, END_W, SLOT, 10);
      bg.lineStyle(on || nudge ? 2.5 : 1.5, THEME.gold, on || nudge ? 1 : 0.6).strokeRoundedRect(0, 0, END_W, SLOT, 10);
      label.setColor(option.disabled ? THEME.dimText : on || nudge ? THEME.goldText : THEME.text);
      button.setAlpha(option.disabled ? 0.5 : 1);
    };
    draw(false);
    if (nudge && active) this.tweens.add({ targets: label, scale: { from: 1, to: 1.08 }, duration: 520, yoyo: true, repeat: -1 });
    if (active) {
      const hit = this.add.zone(END_W / 2, SLOT / 2, END_W, SLOT).setInteractive({ useHandCursor: !option.disabled });
      hit.on('pointerover', () => this.select(i));
      hit.on('pointerup', () => this.pick(i));
      button.add(hit);
      this.menuButtons.push(draw);
    }
    this.hotbar.add(button);
  }

  /** The hero's corner of the hotbar: portrait, name, health and stamina, and the effects on them. */
  private drawHeroBlock(): void {
    const old = this.hotbar.getByName('hero-block');
    old?.destroy();
    const c = this.hero.c;
    const stats = this.world.stats;
    const block = this.add.container(PANEL_PAD, PANEL_PAD).setName('hero-block');
    // The hero's painted portrait in a framed square, lit green while it's their turn.
    const P = PANEL_H - PANEL_PAD * 2;
    const yourTurn = this.battle.order.length > 0 && this.battle.current === c;
    const frame = this.add.graphics();
    frame.fillStyle(0x000000, 0.5).fillRoundedRect(2, 3, P, P, 10);
    frame.fillGradientStyle(0x3a2c3e, 0x3a2c3e, 0x140f18, 0x140f18, 1).fillRoundedRect(0, 0, P, P, 10);
    const portrait = this.add.image(P / 2, P - 2, 'portrait-hero', 0).setOrigin(0.5, 1).setScale((P - 6) / PORTRAIT_SIZE);
    const rim = this.add.graphics();
    rim.lineStyle(yourTurn ? 3 : 2.5, yourTurn ? 0x8fbf6a : THEME.gold, 1).strokeRoundedRect(0, 0, P, P, 10);
    rim.lineStyle(1, 0xfff2c0, 0.25).strokeRoundedRect(3, 3, P - 6, P - 6, 8);
    if (c.hp <= 0) portrait.setTint(0x777777);
    block.add([frame, portrait, rim]);

    const r = P / 2;
    const x = r * 2 + 12;
    const w = HERO_W - x - 6;
    const name = this.add.text(x, 2, HERO_NAME, { fontFamily: FONT, fontSize: '16px', color: THEME.goldText });
    const bars = this.add.graphics();
    const bar = (y: number, t: number, fill: number, text: string) => {
      bars.fillStyle(0x000000, 0.6).fillRoundedRect(x, y, w, 13, 4);
      if (t > 0.02) bars.fillStyle(fill, 1).fillRoundedRect(x, y, Math.max(8, w * Phaser.Math.Clamp(t, 0, 1)), 13, 4);
      bars.lineStyle(1, THEME.gold, 0.5).strokeRoundedRect(x, y, w, 13, 4);
      block.add(this.add.text(x + w / 2, y + 6.5, text, { fontFamily: FONT, fontSize: '10px', color: '#ffffff', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5));
    };
    block.add([name, bars]);
    const hp = c.hp / c.maxHp;
    bar(26, hp, hp > 0.5 ? 0x5fae3c : hp > 0.25 ? 0xd9a22a : 0xc8352a, `${c.hp} / ${c.maxHp}`);
    bar(44, stats.stamina / stats.maxStamina, 0x3f8fd0, `${Math.floor(stats.stamina)} / ${stats.maxStamina} stamina`);
    // What's on the hero: guarded, prone, bleeding...
    let tx = x;
    for (const s of c.statuses) {
      const def = STATUSES[s.id];
      const tag = this.add.text(tx, 63, def.name, { fontFamily: FONT, fontSize: '10px', color: hex(def.color), stroke: '#000000', strokeThickness: 2 });
      block.add(tag);
      tx += tag.width + 6;
    }
    this.hotbar.add(block);
  }

  /** The card above the hotbar describing the chosen skill: cost, cooldown, numbers, and why it can't be used. */
  private showTooltip(option: MenuOption): void {
    this.tooltip.removeAll(true);
    if (this.menuStyle !== 'hotbar') return;
    const geo = this.panelGeometry();
    const w = TIP_W;
    const pad = 12;
    const parts: Phaser.GameObjects.Text[] = [];
    let y = pad;
    const line = (text: string, size: number, color: string, gap = 4) => {
      const t = this.add.text(pad, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, wordWrap: { width: w - pad * 2 } });
      parts.push(t);
      y += t.height + gap;
    };
    const a = option.ability;
    if (a) {
      line(a.name, 18, THEME.goldText, 2);
      const cost = [a.cost === 'action' ? 'Action' : 'Bonus action'];
      if (a.stamina) cost.push(`${a.stamina} stamina`);
      if (a.cooldown === Infinity) cost.push('once a fight');
      else if (a.cooldown) cost.push(`${a.cooldown}-turn cooldown`);
      line(cost.join('  ·  '), 13, a.cost === 'action' ? ACTION_TEXT : BONUS_TEXT, 6);
      line(a.blurb, 13, THEME.text, 6);
      for (const d of a.details(this.abilityContext())) line(d, 13, '#d8c8a4', 2);
      if (option.reason) {
        y += 4;
        line(option.reason, 13, '#ff8a7a', 0);
      }
    } else {
      line(option.label, 18, THEME.goldText, 2);
      line(option.hint, 13, THEME.text, 0);
    }
    const h = y + pad;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.4).fillRoundedRect(3, 5, w, h, 10);
    bg.fillStyle(THEME.panel, 0.97).fillRoundedRect(0, 0, w, h, 10);
    bg.lineStyle(1.5, THEME.gold, 0.85).strokeRoundedRect(0, 0, w, h, 10);
    this.tooltip.add([bg, ...parts]);
    // Above the right-hand end of the hotbar, clear of the log on the left.
    this.tooltip.setPosition(geo.x + geo.w * geo.scale - w, geo.y - h - 8);
  }

  // ------------------------------------------------------------ menu

  private showMenu(heading: string, options: MenuOption[], style: MenuStyle = 'list'): Promise<string> {
    return new Promise((resolve) => {
      this.menuHeading = heading;
      this.menuOptions = options;
      this.menuStyle = style;
      this.menuResolve = resolve;
      // The hotbar remembers its place between choices; lists start at the first thing that can be picked.
      const keep = style === 'hotbar' && this.selected < options.length && !options[this.selected].disabled;
      if (!keep) this.selected = Math.max(0, options.findIndex((o) => !o.disabled));
      this.buildMenu();
      this.select(this.selected);
    });
  }

  private pick(i: number): void {
    const option = this.menuOptions[i];
    const resolve = this.menuResolve;
    if (!option || !resolve) return;
    if (option.disabled) {
      GameAudio.hover();
      this.select(i);
      return;
    }
    GameAudio.click();
    this.clearMenu();
    resolve(option.id);
  }

  private pickId(id: string): void {
    const i = this.menuOptions.findIndex((o) => o.id === id);
    if (i >= 0) this.pick(i);
  }

  private clearMenu(): void {
    this.menuResolve = undefined;
    this.menuOnSelect = undefined;
    this.menuOptions = [];
    this.menuButtons = [];
    this.menuBox.removeAll(true);
    this.tooltip.removeAll(true);
    this.menuTitle.setText('');
    this.hintText.setText('');
  }

  private moveSelection(step: number): void {
    const n = this.menuOptions.length;
    if (n === 0) return;
    let i = this.selected;
    // The hotbar steps through every slot (greyed ones explain themselves); lists skip what can't be picked.
    for (let k = 0; k < n; k++) {
      i = (i + step + n) % n;
      if (this.menuStyle === 'hotbar' || !this.menuOptions[i].disabled) break;
    }
    if (i !== this.selected) GameAudio.hover();
    this.select(i);
  }

  private select(i: number): void {
    this.selected = i;
    this.menuButtons.forEach((draw, k) => draw(k === i));
    const option = this.menuOptions[i];
    if (!option) return;
    if (this.menuStyle === 'hotbar') this.showTooltip(option);
    else this.hintText.setText(option.hint);
    this.menuOnSelect?.(option);
  }

  private buildMenu(): void {
    this.menuBox.removeAll(true);
    this.menuButtons = [];
    if (this.menuStyle === 'hotbar') {
      this.menuTitle.setText('');
      this.hintText.setText('');
      this.buildHotbar(true);
      this.layoutLog();
      return;
    }
    this.buildHotbar(false);
    this.buildList();
  }

  /** Lays list options (targets, food) out as a row of buttons just above the hotbar. */
  private buildList(): void {
    const options = this.menuOptions;
    if (options.length === 0) return;
    const { width } = this.scale;
    const narrow = width < NARROW;
    const cols = narrow ? 2 : Math.min(options.length, 5);
    const rows = Math.ceil(options.length / cols);
    const totalW = Math.min(narrow ? width - MARGIN * 2 : 820, width - MARGIN * 2);
    const bw = (totalW - GAP * (cols - 1)) / cols;
    const top = this.panelGeometry().y - 10 - rows * BTN_H - (rows - 1) * GAP;

    options.forEach((option, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Centre a short last row.
      const inRow = row === rows - 1 ? options.length - row * cols : cols;
      const rowW = inRow * bw + (inRow - 1) * GAP;
      const x = width / 2 - rowW / 2 + col * (bw + GAP) + bw / 2;
      const y = top + row * (BTN_H + GAP) + BTN_H / 2;
      const bg = this.add.graphics();
      const key = this.add.text(-bw / 2 + 12, 0, `${i + 1}`, { fontFamily: FONT, fontSize: '13px', color: THEME.dimText }).setOrigin(0, 0.5);
      const label = this.add
        .text(6, 0, option.label, { fontFamily: FONT, fontSize: narrow ? '16px' : '17px', color: THEME.text })
        .setOrigin(0.5);
      if (label.width > bw - 34) label.setScale((bw - 34) / label.width);
      const button = this.add.container(x, y, [bg, key, label]);
      const draw = (on: boolean) => {
        bg.clear();
        bg.fillStyle(on ? THEME.panelLight : THEME.panel, 0.94);
        bg.fillRoundedRect(-bw / 2, -BTN_H / 2, bw, BTN_H, 9);
        bg.lineStyle(on ? 2.5 : 1.5, THEME.gold, on ? 1 : 0.55);
        bg.strokeRoundedRect(-bw / 2, -BTN_H / 2, bw, BTN_H, 9);
        label.setColor(option.disabled ? THEME.dimText : on ? THEME.goldText : THEME.text);
        button.setAlpha(option.disabled ? 0.55 : 1);
      };
      button.setSize(bw, BTN_H).setInteractive({ useHandCursor: !option.disabled });
      button.on('pointerover', () => this.select(i));
      button.on('pointerup', () => this.pick(i));
      this.menuBox.add(button);
      this.menuButtons.push(draw);
    });

    this.menuTitle.setText(this.menuHeading).setPosition(width / 2, top - 30);
    this.hintText.setPosition(width / 2, top - 8).setWordWrapWidth(Math.min(width - MARGIN * 2, 720));
    this.layoutLog();
  }

  // ------------------------------------------------------------ order bar and log

  /** The turn order along the top: a card for each fighter, the one acting raised and lit, with what's on them. */
  private drawOrder(): void {
    this.orderBar.removeAll(true);
    const order = this.battle.order.length > 0 ? this.battle.order : this.battle.combatants;
    const current = this.battle.order.length > 0 ? this.battle.current : undefined;
    const totalW = order.length * CHIP_W + (order.length - 1) * 6;
    const round = this.add
      .text(0, 0, this.battle.order.length > 0 ? `Round ${this.battle.round}` : 'Initiative', {
        fontFamily: FONT, fontSize: '14px', color: THEME.goldText, stroke: '#000000', strokeThickness: 3,
      })
      .setOrigin(0.5, 0);
    this.orderBar.add(round);
    order.forEach((c, i) => {
      const x = -totalW / 2 + i * (CHIP_W + 6);
      const active = c === current;
      const out = c.hp <= 0 || c.fled;
      const chip = this.add.container(x, active ? 22 : 26);
      const bg = this.add.graphics();
      bg.fillStyle(THEME.panel, 0.92);
      bg.fillRoundedRect(0, 0, CHIP_W, CHIP_H, 8);
      bg.lineStyle(active ? 3 : 1.5, c.side === 'party' ? 0x8fbf6a : THEME.gold, active ? 1 : 0.5);
      bg.strokeRoundedRect(0, 0, CHIP_W, CHIP_H, 8);
      const beast = c.side === 'party' ? undefined : this.actorOf(c).creature!;
      const portrait = beast ? this.add.image(CHIP_W / 2, 50, beast.sprite.texture.key, beast.portraitFrame) : this.add.image(CHIP_W / 2, 54, 'player', 0);
      portrait.setOrigin(0.5, 1);
      if (beast) portrait.setScale(Math.min(1, (CHIP_W - 4) / portrait.width, 46 / portrait.height));
      if (c.side === 'party') portrait.setCrop(0, 4, 32, 40);
      const name = this.add
        .text(CHIP_W / 2, 56, c.side === 'party' ? 'You' : c.name, { fontFamily: FONT, fontSize: '11px', color: active ? THEME.goldText : THEME.text })
        .setOrigin(0.5, 0);
      if (name.width > CHIP_W - 6) name.setScale((CHIP_W - 6) / name.width);
      const bar = this.add.graphics();
      const t = Phaser.Math.Clamp(c.hp / c.maxHp, 0, 1);
      bar.fillStyle(0x3a0e0b, 1);
      bar.fillRect(8, 73, CHIP_W - 16, 5);
      bar.fillStyle(t > 0.5 ? 0x5fae3c : t > 0.25 ? 0xd9a22a : 0xc8352a, 1);
      bar.fillRect(8, 73, (CHIP_W - 16) * t, 5);
      const hp = this.add
        .text(CHIP_W / 2, 79, out ? (c.fled ? 'fled' : 'down') : `${c.hp}/${c.maxHp}`, { fontFamily: FONT, fontSize: '10px', color: THEME.dimText })
        .setOrigin(0.5, 0);
      chip.add([bg, portrait, name, bar, hp]);
      // A little tag for each effect on them, down the card's left edge.
      if (!out) {
        c.statuses.forEach((s, k) => {
          const def = STATUSES[s.id];
          const pill = this.add.graphics();
          pill.fillStyle(def.color, 0.95).fillRoundedRect(3, 4 + k * 14, 26, 12, 4);
          pill.lineStyle(1, 0x000000, 0.7).strokeRoundedRect(3, 4 + k * 14, 26, 12, 4);
          const tag = this.add.text(16, 10 + k * 14, def.tag, { fontFamily: FONT, fontSize: '8px', color: '#140c06', fontStyle: 'bold' }).setOrigin(0.5);
          chip.add([pill, tag]);
        });
      }
      if (out) {
        chip.setAlpha(0.45);
        portrait.setTint(0x888888);
      }
      if (active) {
        const arrow = this.add.graphics();
        arrow.fillStyle(THEME.gold, 1);
        arrow.fillTriangle(CHIP_W / 2 - 6, CHIP_H + 4, CHIP_W / 2 + 6, CHIP_H + 4, CHIP_W / 2, CHIP_H + 10);
        chip.add(arrow);
      }
      this.orderBar.add(chip);
    });
    // The hero's health, stamina and effects on the hotbar follow along.
    if (this.hotbar.length > 0) this.drawHeroBlock();
  }

  private log(line: string): void {
    this.logLines.push(line);
    if (this.logLines.length > LOG_LINES) this.logLines.shift();
    this.layoutLog();
  }

  /** The last few lines of what happened: above the hotbar's left side, or above the buttons when there's a list to choose from. */
  private layoutLog(): void {
    this.logBox.removeAll(true);
    if (this.logLines.length === 0) return;
    const geo = this.panelGeometry();
    const list = this.menuStyle === 'list' && this.menuOptions.length > 0;
    const panelW = geo.w * geo.scale;
    const w = list ? Math.min(this.scale.width - MARGIN * 2, 760) : Math.max(320, panelW - TIP_W - 12);
    const left = list ? this.scale.width / 2 - w / 2 : geo.x;
    const texts = this.logLines.map((line, i) =>
      this.add.text(0, 0, line, {
        fontFamily: FONT,
        fontSize: '14px',
        color: i === this.logLines.length - 1 ? THEME.text : THEME.dimText,
        wordWrap: { width: w - 24 },
      }),
    );
    const h = texts.reduce((n, t) => n + t.height + 3, 0) + 14;
    const bottom = list ? this.menuTitle.y - 28 : geo.y - 8;
    const top = bottom - h;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(left, top, w, h, 8);
    this.logBox.add(bg);
    let y = top + 7;
    for (const t of texts) {
      t.setPosition(left + 12, y);
      y += t.height + 3;
      this.logBox.add(t);
    }
  }

  private layout(): void {
    const { width } = this.scale;
    const chipsW = this.battle.combatants.length * (CHIP_W + 6);
    // Beside the health bars when there's room, otherwise just below them.
    const y = width >= chipsW + 2 * 210 ? MARGIN - 6 : 68;
    this.orderBar.setPosition(Math.round(width / 2), y);
    this.drawOrder();
    if (this.menuOptions.length > 0) {
      this.buildMenu();
      this.select(this.selected);
    } else {
      this.buildHotbar(false);
      this.layoutLog();
    }
  }

  // ------------------------------------------------------------ effects

  /** Screen position just above an actor's head. */
  private headOf(actor: Actor): Vec2 {
    const cam = this.world.cameras.main;
    return {
      x: (actor.sprite.x - cam.worldView.x) * cam.zoom,
      y: (actor.sprite.y - actor.height - cam.worldView.y) * cam.zoom - 10,
    };
  }

  /** A d20 tumbles over the actor's head and lands on `value`. */
  private rollDie(actor: Actor, value: number, bonus: string, mode: RollMode = 0): Promise<void> {
    GameAudio.dice();
    const p = this.headOf(actor);
    const die = this.add.graphics();
    const r = 18;
    const corners = Array.from({ length: 6 }, (_, k) => {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      return new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r);
    });
    die.fillStyle(0xf3e2b3, 1);
    die.fillPoints(corners, true);
    die.lineStyle(2, 0x2a1a08, 1);
    die.strokePoints(corners, true, true);
    // The facets of the near face.
    die.lineStyle(1, 0x8a6a3a, 0.8);
    die.strokeTriangle(0, -r * 0.62, r * 0.6, r * 0.38, -r * 0.6, r * 0.38);
    const text = this.add.text(0, 2, '?', { fontFamily: FONT, fontSize: '17px', color: '#2a1a08', fontStyle: 'bold' }).setOrigin(0.5);
    const extra = this.add
      .text(r + 4, 2, '', { fontFamily: FONT, fontSize: '15px', color: THEME.goldText, stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0, 0.5);
    const box = this.add.container(p.x, p.y, [die, text, extra]).setScale(0.4);
    this.tweens.add({ targets: box, scale: 1, angle: { from: -200, to: 0 }, duration: 460, ease: 'Back.easeOut' });
    const spin = this.time.addEvent({ delay: 55, repeat: 7, callback: () => text.setText(`${1 + Math.floor(Math.random() * 20)}`) });
    return new Promise((resolve) => {
      this.time.delayedCall(520, () => {
        spin.remove();
        text.setText(`${value}`).setColor(value === 20 ? '#a86e00' : value === 1 ? '#a8201a' : '#2a1a08');
        extra.setText(mode > 0 ? `${bonus}  adv` : mode < 0 ? `${bonus}  dis` : bonus);
        this.tweens.add({ targets: box, scale: 1.2, duration: 90, yoyo: true });
        this.tweens.add({ targets: box, alpha: 0, y: p.y - 14, delay: 900, duration: 300, onComplete: () => box.destroy() });
        this.time.delayedCall(260, () => resolve());
      });
    });
  }

  /** Floating words or numbers rising from an actor. */
  private float(actor: Actor, text: string, color: string, big = false): void {
    const p = this.headOf(actor);
    const t = this.add
      .text(p.x, p.y - 4, text, {
        fontFamily: FONT, fontSize: big ? '24px' : '19px', color, stroke: '#000000', strokeThickness: 4, fontStyle: 'bold',
      })
      .setOrigin(0.5, 1);
    this.tweens.add({ targets: t, y: p.y - 40, duration: 1100, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 750, duration: 400, onComplete: () => t.destroy() });
  }

  /** Big words across the middle of the screen. */
  private banner(text: string, friendly = false): void {
    const { width, height } = this.scale;
    const t = this.add
      .text(width / 2, height * 0.36, text, titleStyle(width < NARROW ? 26 : 34))
      .setOrigin(0.5)
      .setAlpha(0);
    if (!friendly) t.setColor('#e8a07a');
    this.tweens.add({ targets: t, alpha: 1, scale: { from: 0.85, to: 1 }, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 800, duration: 300, onComplete: () => t.destroy() });
  }

  /** Lunge towards the target and back (a heavy blow winds up first). */
  private async lunge(attacker: Actor, target: Actor, heavy: boolean): Promise<void> {
    const dx = target.sprite.x - attacker.sprite.x;
    const dy = target.sprite.y - attacker.sprite.y;
    const len = Math.hypot(dx, dy) || 1;
    const reach = attacker.creature ? 16 : heavy ? 14 : 10;
    if (heavy) await this.nudge(attacker.offset, (-dx / len) * 5, (-dy / len) * 5, 160);
    await this.nudge(attacker.offset, (dx / len) * reach, (dy / len) * reach, 110);
    void this.nudge(attacker.offset, 0, 0, 180);
  }

  /** A quick hop or sidestep, returning to where it was. */
  private async hop(offset: Vec2, x: number, y: number): Promise<void> {
    await this.nudge(offset, x, y, 100);
    await this.nudge(offset, 0, 0, 140);
  }

  private nudge(offset: Vec2, x: number, y: number, ms: number): Promise<void> {
    return new Promise((resolve) => this.tweens.add({ targets: offset, x, y, duration: ms, ease: 'Sine.easeOut', onComplete: () => resolve() }));
  }

  /** Flash red when struck. */
  private flash(actor: Actor): void {
    actor.sprite.setTintFill(0xff5040);
    this.time.delayedCall(90, () => actor.sprite.clearTint());
    this.time.delayedCall(170, () => actor.sprite.setTintFill(0xff5040));
    this.time.delayedCall(250, () => actor.sprite.clearTint());
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }
}
